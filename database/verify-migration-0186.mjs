// Real-PostgreSQL verifier for migration 0186 (S8B-03 CP1, Personal Voice Notes: Server & Intelligence).
//
// The acceptance of the S8B-03 contract v1.2 §8.1 that a database can prove:
//
//   C0    catalogue (A20): the transcription relations postgres-owned, RLS on, no policy, no grant; the typed confirmation
//         readable by its owner only and writable by no role; every new definer pinned, service_role only; internal
//         functions no role's; begin v1 keeps its signature and ACL; the four scopes DISABLED; exactly the approved consent
//         text installed (C-01 ... C-11, both digests); the erasure census clean; machine_asr_memory_confidence_v1 IMMUTABLE
//   S0    every forward-replaced or derived function is its origin statement plus exactly the declared edits
//         (voice-notes-0186-substitutions.mjs), in the file and live; v3 delegates to v4
//   V-R   (A1) the replayed begin of an accepted note: ALREADY_ACCEPTED, read-only accept, conflicts, no revival
//   V-T   (A6 A7 A8) the transcription lifecycle: claim, consent hold, SUBMITTING before bytes, crash recovery, unknown
//         outcomes and their quarantine, bounds 3 / 5, permanent failures, NO_SPEECH, duration failures, cancellation
//   V-L   (A9) one ledger row per attempt, bound to the recording; settlement v2 by audio milliseconds
//   V-D   (A25) the deletion path: no READY before the first deletion outcome; schedule; LOCKED retried; UNCONFIRMED on day 7
//   V-C   (A2 A3 A4) the one atomic voice turn: atomic, idempotent, admission-bound, refusals
//   V-E   (A10) Memory and Fresh Evidence by band
//   V-TM  (A11) Truth Maintenance after voice evidence
//   V-P   (A12) no automatic promotion
//   V-G   (A13) matching and shared paths exclude MACHINE_ASR
//   V-OU  (A14 A26) Open Understanding v4 by band, cell by cell; person labels and uncertain words
//   V-MC  (A16) spoken Memory commands by band
//   V-CF  (A22) the typed confirmation
//   V-RC  (A24) consent races (RC3 on two connections, committed fixtures removed after)
//   V-CS  (A27) the score is the band's constant and cannot be chosen
//   V-X   (A17) account erasure removes the transcription state and the typed confirmations
//
// Every scenario but RC3 runs in one transaction that is rolled back.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import process from 'node:process';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { extractStatement } from './voice-foundation-0183-substitutions.mjs';
import { MIGRATION_0186, SUBSTITUTIONS, substitutedStatement, writtenHeader } from './voice-notes-0186-substitutions.mjs';

const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
async function rejected(operation, codes, message = null) {
  const where = (new Error().stack.split('\n')[2] ?? '').trim().replace(/^at .*verify-migration-0186\.mjs:/u, 'line ');
  return rt.rejected(operation, codes, message).then(undefined, (error) => {
    error.message = `${error.message} [${where}]`;
    throw error;
  });
}
const owner = () => asRole('postgres');
const MIGRATIONS = new URL('./migrations/', import.meta.url);
const migration = (prefix) => readFileSync(new URL(readdirSync(MIGRATIONS).find((f) => f.startsWith(prefix)), MIGRATIONS), 'utf8');

const CONSENT_AR_SHA256 = '1c2f6a050372da5175a918d040c1259031df798beff5eacfd2a947f3dc4d3f3d';
const CONSENT_EN_SHA256 = 'ea01b715e384c14a239f4e18c0366d77006bb86d931ff326ee95e93c88bd1426';
const SCOPES = ['PERSONAL_LIVE_CALL', 'PERSONAL_VOICE_NOTE', 'REPLAY_AUDIO_DISTRIBUTION', 'SHARED_VOICE_NOTE'];
const RELATIONS = ['voice_private.note_transcriptions', 'voice_private.note_transcription_attempts'];
const V4 = 'public.complete_post_response_personal_capture_v4(uuid,uuid[],text[],text[],double precision[],timestamp with time zone[],text[],text[],text[],text[],text[],uuid[],text[],text[],uuid[],text[],uuid[],uuid[],uuid[],uuid[],uuid[],text[],text[],double precision[],text[],text[],uuid[])';
const V3 = 'public.complete_post_response_personal_capture_v3(uuid,uuid[],text[],text[],double precision[],timestamp with time zone[],text[],text[],text[],text[],text[],uuid[],text[],text[],uuid[],text[],uuid[],uuid[],uuid[],uuid[],uuid[],text[],text[],double precision[],text[],text[])';
const DEFINERS = [
  'public.server_claim_voice_note_transcription_v1(text,integer,integer)',
  'public.server_renew_voice_note_transcription_lease_v1(uuid,text,integer)',
  'public.server_begin_voice_note_submission_v1(uuid,text,uuid,bigint)',
  'public.server_record_voice_note_submission_v1(uuid,text,text)',
  'public.server_record_voice_note_transcript_v1(uuid,text,text,text,text[],bigint)',
  'public.server_record_voice_note_provider_deletion_v1(uuid,text)',
  'public.server_record_voice_note_transcription_failure_v1(uuid,text,uuid,text)',
  'public.server_hold_voice_note_for_consent_v1(uuid)',
  'public.server_list_voice_note_deletions_due_v1(integer)',
  'public.server_retry_voice_note_transcription_v1(uuid,uuid)',
  'public.server_read_voice_note_status_v1(uuid,uuid)',
  'public.server_list_session_pending_voice_notes_v1(uuid,uuid)',
  'public.server_read_session_voice_turns_v1(uuid,uuid,uuid[])',
  'public.server_read_my_voice_note_capability_v1(uuid)',
  'public.server_read_voice_consent_text_v1()',
  'public.server_read_machine_asr_memory_confidence_v1()',
  'public.server_read_memory_command_voice_v1(uuid,uuid,uuid,uuid)',
  'public.server_commit_voice_note_turn_v1(uuid,uuid)',
  V4,
  'public.background_known_memories_v2(uuid,integer)',
];
const INTERNAL = [
  'voice_private.machine_asr_memory_confidence_v1(text)', 'voice_private.transcription_policy_v1()',
  'voice_private.transcription_failure_is_transient_v1(text)', 'voice_private.provider_deletion_delay_v1(integer)',
  'voice_private.guard_note_transcription_v1()', 'voice_private.note_first_deletions_recorded_v1(uuid)',
  'voice_private.settle_note_v1(uuid,text,text)', 'voice_private.on_recording_terminal_v1()',
  'public.guard_memory_typed_confirmation_v1()', 'public.record_memory_typed_confirmation_v1(uuid,uuid,uuid,text,uuid,uuid)',
];
const CENSUS = `SELECT c.conrelid::regclass::text AS relation FROM pg_constraint c
  WHERE c.contype = 'f'
    AND (c.confrelid = 'public.users'::regclass
         OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'VOICE'))
    AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g)
  ORDER BY 1`;
const TEXT = 'أنا بشتغل مهندس في القاهرة.';
const W = 'verify-0186-worker';

// ------------------------------------------------------------------ small helpers
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
async function server(sql, values = []) {
  await asRole('service_role');
  const result = await rows(sql, values);
  await owner();
  return result;
}
const one = async (sql, values = []) => (await server(sql, values))[0];
let tick = 0;
// Strictly increasing instants three days in the past: orders that "the preceding turn" and "created before" read.
const nextInstant = () => new Date(Date.now() - 3 * 86_400_000 + 1000 * tick++).toISOString();
const jobId = () => `job_${randomUUID().replace(/-/gu, '').slice(0, 20)}`;

// ------------------------------------------------------------------ fixtures
async function human() {
  const id = randomUUID();
  await rt.provisionHumans([id]);
  return id;
}
async function newSession(user, channel = 'TEXT') {
  const id = randomUUID();
  await owner();
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', $3)", [id, user, channel]);
  return id;
}
async function storedNote(user, session, bytes = 2048) {
  const id = randomUUID();
  const key = `voice-note/${randomUUID()}`;
  const command = randomUUID();
  await owner();
  await q(`WITH n AS (SELECT clock_timestamp() AS t)
           INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, begin_command_id, accepted_at,
                                                 retention_expires_at, recording_state)
           SELECT $1, $2, $3, 'VOICE_NOTE', $4, n.t, n.t + interval '30 days', 'STORED' FROM n`, [id, user, session, command]);
  await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state,
                                                        content_type, byte_size, upload_deadline, stored_at)
           VALUES ($1, 'NOTE', 0, $2, 'STORED', 'audio/mp4', $3, clock_timestamp(), clock_timestamp())`, [id, key, bytes]);
  return { id, key, command };
}
async function terminate(recording, state = 'DELETED') {
  await owner();
  if (state === 'EXPIRED') {
    // The guard admits STORED -> EXPIRED only at the expiry (the sweep's path): written as it is after the sweep.
    await q("SET LOCAL session_replication_role = 'replica'");
    await q("UPDATE voice_private.recordings SET recording_state = 'EXPIRED', terminal_at = clock_timestamp() WHERE id = $1", [recording]);
    await q("SET LOCAL session_replication_role = 'origin'");
    // The AFTER trigger did not fire under replica: run its effect exactly as the sweep's update fires it.
    await q("SELECT voice_private.settle_note_v1($1, 'CANCELLED', NULL) WHERE EXISTS (SELECT 1 FROM voice_private.note_transcriptions n WHERE n.recording_id = $1 AND n.state NOT IN ('COMMITTED','CANCELLED','FAILED_FINAL','NO_SPEECH'))", [recording]);
    return;
  }
  await q("UPDATE voice_private.recordings SET recording_state = 'DELETED', deleted_reason = 'OWNER', terminal_at = clock_timestamp() WHERE id = $1", [recording]);
}
async function setVoiceGate(flag = 'ENABLED', requirements = 'SATISFIED') {
  await owner();
  await rows(`SELECT * FROM voice_private.set_voice_launch_capability_v1('PERSONAL_VOICE_NOTE', $1, $2, 'verify-0186', 'real-PostgreSQL proof')`,
    [flag, requirements]);
}
const grant = async (user) => (await one('SELECT * FROM public.server_grant_voice_recording_consent_v1($1, $2, $3)', [user, randomUUID(), 'VOICE_RECORDING_V1'])).outcome;
const revoke = async (user) => (await one('SELECT * FROM public.server_revoke_voice_recording_consent_v1($1, $2)', [user, randomUUID()])).outcome;
/** A human with a session, the gate open and consent current (inside the rolled-back transaction). */
async function ready() {
  const user = await human();
  const session = await newSession(user);
  await setVoiceGate();
  assert.equal(await grant(user), 'GRANTED', 'fixture: consent granted');
  return { user, session };
}

// The worker definers.
const claim = (worker = W, limit = 4) => server('SELECT * FROM public.server_claim_voice_note_transcription_v1($1, 60, $2)', [worker, limit]);
async function claimNote(recording, worker = W) {
  for (let i = 0; i < 100; i += 1) {
    const got = await claim(worker);
    const mine = got.find((r) => r.recording_id === recording);
    if (mine) return mine;
    if (got.length === 0) return undefined;
  }
  return undefined;
}
const renew = async (recording, seconds = 60, worker = W) => (await one('SELECT * FROM public.server_renew_voice_note_transcription_lease_v1($1, $2, $3)', [recording, worker, seconds])).outcome;
const beginSubmission = (recording, attempt, ms = 4200, worker = W) =>
  one('SELECT * FROM public.server_begin_voice_note_submission_v1($1, $2, $3, $4)', [recording, worker, attempt, ms]);
const recordSubmission = async (attempt, outcome, job = null) =>
  (await one('SELECT * FROM public.server_record_voice_note_submission_v1($1, $2, $3)', [attempt, outcome, job])).outcome;
const recordTranscript = (attempt, outcome, text, band, tokens = [], ms = 4200) =>
  one('SELECT * FROM public.server_record_voice_note_transcript_v1($1, $2, $3, $4, $5::text[], $6)',
    [attempt, outcome, text, band, outcome === 'NO_SPEECH' ? null : tokens, ms]);
const recordDeletion = (attempt, outcome) => one('SELECT * FROM public.server_record_voice_note_provider_deletion_v1($1, $2)', [attempt, outcome]);
const recordFailure = (recording, attempt, failure, worker = W) =>
  one('SELECT * FROM public.server_record_voice_note_transcription_failure_v1($1, $2, $3, $4)', [recording, worker, attempt, failure]);
const hold = (recording) => one('SELECT * FROM public.server_hold_voice_note_for_consent_v1($1)', [recording]);
const deletionsDue = (limit = 100) => server('SELECT * FROM public.server_list_voice_note_deletions_due_v1($1)', [limit]);
const retry = async (user, recording) => (await one('SELECT * FROM public.server_retry_voice_note_transcription_v1($1, $2)', [user, recording])).outcome;
const status = (user, recording) => one('SELECT * FROM public.server_read_voice_note_status_v1($1, $2)', [user, recording]);
const commit = (user, recording) => one('SELECT * FROM public.server_commit_voice_note_turn_v1($1, $2)', [user, recording]);
async function noteRow(recording) {
  await owner();
  return (await rows('SELECT * FROM voice_private.note_transcriptions WHERE recording_id = $1', [recording]))[0];
}
async function attemptRow(attempt) {
  await owner();
  return (await rows('SELECT * FROM voice_private.note_transcription_attempts WHERE attempt_id = $1', [attempt]))[0];
}
async function expireLease(recording) {
  await owner();
  await q("UPDATE voice_private.note_transcriptions SET lease_expires_at = clock_timestamp() - interval '1 second' WHERE recording_id = $1 AND lease_owner IS NOT NULL", [recording]);
}
async function due(recording) {
  await owner();
  await q("UPDATE voice_private.note_transcriptions SET next_attempt_at = clock_timestamp() - interval '1 second' WHERE recording_id = $1 AND next_attempt_at IS NOT NULL", [recording]);
}
/** One attempt from claim to CREATED; returns its id. */
async function submitted(recording, ms = 4200) {
  assert.ok(await claimNote(recording), 'fixture: the note is claimed');
  const attempt = randomUUID();
  assert.equal((await beginSubmission(recording, attempt, ms)).outcome, 'SUBMITTING', 'fixture: SUBMITTING');
  assert.equal(await recordSubmission(attempt, 'CREATED', jobId()), 'RECORDED', 'fixture: the job is recorded');
  return attempt;
}
/** A READY note through the worker definers (gate open and consent current). */
async function readyNote(user, session, { band = 'HIGH', text = TEXT, tokens = [], ms = 4200 } = {}) {
  const note = await storedNote(user, session);
  const attempt = await submitted(note.id, ms);
  assert.equal((await recordTranscript(attempt, 'TRANSCRIBED', text, band, tokens, ms)).state, 'DELETION_PENDING');
  assert.equal((await recordDeletion(attempt, 'REQUESTED')).note_state, 'READY');
  return { ...note, attempt };
}

// Memory fixtures (the 0152 / 0173 verifiers' meaning).
async function userTurn(user, session, { status = 'COMPLETED', content = 'رسالة عادية' } = {}) {
  const id = randomUUID();
  const at = nextInstant();
  await owner();
  await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, created_at, updated_at, completed_at)
           VALUES ($1, $2, $3, 'USER', $4, $5, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', $6, $6, CASE WHEN $4 = 'COMPLETED' THEN $6::timestamptz END)`,
  [id, session, user, status, content, at]);
  return id;
}
/** A user turn with a USER voice source of the band, and its committed transcription holding the uncertain words. */
async function voiceTurn(user, session, { band = 'HIGH', status = 'COMPLETED', content = TEXT, tokens = [], recordingState = 'STORED' } = {}) {
  const note = await storedNote(user, session);
  const turn = await userTurn(user, session, { status, content });
  await q(`INSERT INTO public.conversation_turn_voice_sources (turn_id, user_id, session_id, source_role, source_modality, transcript_origin,
             asr_confidence_band, recording_id, anchor_start_ms, anchor_end_ms) VALUES ($1, $2, $3, 'USER', 'VOICE_NOTE', 'MACHINE_ASR', $4, $5, 0, 4200)`,
  [turn, user, session, band, note.id]);
  await q(`INSERT INTO voice_private.note_transcriptions (recording_id, user_id, session_id, state, attempts_auto, attempts_total, duration_ms,
             transcript_sha256, asr_confidence_band, uncertain_tokens, committed_turn_id)
           VALUES ($1, $2, $3, 'COMMITTED', 1, 1, 4200, $4, $5, $6::text[], $7)`, [note.id, user, session, sha256(content), band, tokens, turn]);
  if (recordingState !== 'STORED') await terminate(note.id, recordingState);
  return { turn, recording: note.id };
}
async function memory(user, { content, type = 'PERSONAL_FACT', status = 'ACTIVE', subject = 'SELF', source = 'USER_STATED', confidence = null, expiresAt = null } = {}) {
  const id = randomUUID();
  const at = nextInstant();
  await owner();
  await q(`INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status, expires_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 0.65, $7, $8, $9, $9)`,
  [id, user, type, content ?? `verifier-0186 fact ${tick}`, source, confidence ?? (source === 'MACHINE_ASR' ? 0.9 : 0.95), status, expiresAt, at]);
  if (subject && status === 'ACTIVE') await q("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis) VALUES ($1, $2, $3, 'EXPLICIT_STATEMENT')", [id, user, subject]);
  return id;
}
async function memoryRow(id) {
  await owner();
  return (await rows('SELECT type, content, source, confidence, status FROM public.memories WHERE id = $1', [id]))[0];
}
async function writeExecution(user, session, turn) {
  const id = randomUUID();
  await owner();
  await q(`INSERT INTO public.post_response_intelligence_executions (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path,
             safety_disposition, state, current_stage) VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', 'RUNNING', 'VERIFIER_0186')`,
  [id, randomUUID(), user, session, turn]);
  await q("INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state) VALUES ($1, 'MEMORY_WRITE', 'CLAIMED')", [id]);
  return id;
}
const recordMemory = (turn, content, confidence, memoryId = randomUUID()) =>
  one('SELECT * FROM public.background_record_memory_v1($1, $2, $3, $4, $5, 0.65, NULL)', [turn, memoryId, 'PERSONAL_FACT', content, confidence]);
async function captureExecution(user, session, turn) {
  const id = randomUUID();
  await owner();
  await q(`INSERT INTO public.post_response_intelligence_executions (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path,
             safety_disposition, state, current_stage) VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', 'RUNNING', 'VERIFIER_0186')`,
  [id, randomUUID(), user, session, turn]);
  await q("INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state) VALUES ($1, 'UNDERSTANDING_CAPTURE_PROVIDER', 'CLAIMED')", [id]);
  return id;
}
const CAPTURE_V4 = `SELECT public.complete_post_response_personal_capture_v4($1, $2::uuid[], $3::text[], $4::text[], $5::double precision[], $6::timestamptz[],
  $7::text[], $8::text[], $9::text[], $10::text[], $11::text[], $12::uuid[], $13::text[], $14::text[], $15::uuid[], $16::text[], $17::uuid[], $18::uuid[],
  $19::uuid[], $20::uuid[], $21::uuid[], $22::text[], $23::text[], $24::double precision[], $25::text[], $26::text[], $27::uuid[]) AS answer`;
const CAPTURE_V3 = `SELECT public.complete_post_response_personal_capture_v3($1, $2::uuid[], $3::text[], $4::text[], $5::double precision[], $6::timestamptz[],
  $7::text[], $8::text[], $9::text[], $10::text[], $11::text[], $12::uuid[], $13::text[], $14::text[], $15::uuid[], $16::text[], $17::uuid[], $18::uuid[],
  $19::uuid[], $20::uuid[], $21::uuid[], $22::text[], $23::text[], $24::double precision[], $25::text[], $26::text[]) AS answer`;
/** The v3 / v4 command exactly as the repository sends it: parallel arrays, terms flattened. */
function captureArgs(executionId, { items = [], index = [], reaffirmed = [], ended = [], forget = [], corrections = [] }) {
  const terms = [...items, ...index, ...corrections.map((c) => ({ id: c.newId, terms: c.terms }))].flatMap((e) => (e.terms ?? []).map((v) => [e.id, v]));
  return [executionId,
    items.map((i) => i.id), items.map((i) => i.type ?? 'PERSONAL_FACT'), items.map((i) => i.content), items.map((i) => i.importance ?? 0.65),
    items.map((i) => i.expiresAt ?? null), items.map((i) => i.slot ?? null), items.map((i) => i.temporal ?? 'CURRENT'), items.map((i) => ('subject' in i ? i.subject : 'SELF')),
    items.map((i) => i.name ?? null), items.map((i) => i.relation ?? null),
    index.map((i) => i.id), index.map((i) => i.slot ?? null), index.map((i) => i.temporal ?? 'CURRENT'),
    terms.map(([id]) => id), terms.map(([, v]) => v), reaffirmed, ended, forget,
    corrections.map((c) => c.target), corrections.map((c) => c.newId), corrections.map((c) => c.type ?? 'PERSONAL_FACT'), corrections.map((c) => c.content),
    corrections.map((c) => c.importance ?? 0.65), corrections.map((c) => c.slot ?? null), corrections.map((c) => c.temporal ?? 'CURRENT')];
}
const capture4 = async (executionId, command, confirmed = []) => (await one(CAPTURE_V4, [...captureArgs(executionId, command), confirmed])).answer;
const capture3 = async (executionId, command) => (await one(CAPTURE_V3, captureArgs(executionId, command))).answer;
const effectOf = async (executionId) => {
  await owner();
  return (await rows("SELECT state, result_code, result_payload FROM public.post_response_intelligence_effects WHERE execution_id = $1 AND effect_key = 'UNDERSTANDING_CAPTURE_PROVIDER'", [executionId]))[0];
};
const V2 = 'SELECT * FROM public.server_finalize_memory_control_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)';
function v2Args(c) {
  const writes = c.outcome === 'REMEMBERED' || c.outcome === 'CORRECTED';
  return [c.session, c.user, c.turn, randomUUID(), c.kind, c.outcome,
    c.target ?? null, c.newId ?? (writes ? randomUUID() : null), c.type ?? (writes ? 'PERSONAL_FACT' : null), c.content ?? null,
    'confidence' in c ? c.confidence : (writes ? 0.98 : null), writes ? 0.65 : null, null,
    c.candidates ?? [], c.answers ?? null, c.subject ?? (c.outcome === 'REMEMBERED' ? 'SELF' : null), null,
    `reply:${c.outcome}`, ['CORRECTED', 'FORGOTTEN', 'DISABLED'].includes(c.outcome) ? 'reply:TARGET_CHANGED' : null,
    writes ? 'reply:EXISTING' : null, randomUUID(), null, null];
}
const finalize2 = async (c) => (await server(V2, v2Args(c))).map((row) => row.outcome);
async function commandOf(turn) {
  await owner();
  return (await rows('SELECT * FROM public.memory_control_commands WHERE source_turn_id = $1', [turn]))[0];
}
async function confirmationsOf(memoryId) {
  await owner();
  return rows('SELECT memory_id, source_turn_id, basis, command_id IS NOT NULL AS by_command, execution_id IS NOT NULL AS by_execution FROM public.memory_typed_confirmations WHERE memory_id = $1 ORDER BY confirmed_at', [memoryId]);
}
const standing = async (user, memoryId) => (await rows('SELECT public.personal_evidence_standing_v1($1, $2, CURRENT_TIMESTAMP) AS s', [user, `memory:${memoryId}`]))[0].s;
const eligible = async (user) => (await rows('SELECT memory_id FROM public.canonical_eligible_memory_ids_v1($1, CURRENT_TIMESTAMP)', [user])).map((r) => r.memory_id);

// ------------------------------------------------------------------ C0 / S0
async function verifyCatalogue(report) {
  await report.section('C0a the transcription relations: postgres-owned, RLS on, no policy, no grant; voice_private unreachable', async () => {
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
    }
    const [c] = await rows(`SELECT pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls FROM pg_class c WHERE c.oid = 'public.memory_typed_confirmations'::regclass`);
    assert.deepEqual(c, { owner: 'postgres', rls: true }, 'C0a memory_typed_confirmations posture');
    const policies = await rows("SELECT polcmd, pg_get_expr(polqual, polrelid) AS qual FROM pg_policy WHERE polrelid = 'public.memory_typed_confirmations'::regclass");
    assert.equal(policies.length, 1, 'C0a one policy');
    assert.equal(policies[0].polcmd, 'r', 'C0a SELECT only');
    assert.match(policies[0].qual, /user_id = \( SELECT auth\.uid\(\)/u, 'C0a the owner\'s rows');
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        const [{ allowed }] = await rows("SELECT has_table_privilege($1, 'public.memory_typed_confirmations', $2) AS allowed", [role, privilege]);
        assert.equal(allowed, privilege === 'SELECT' && role !== 'anon', `C0a ${role} ${privilege} on memory_typed_confirmations`);
      }
    }
  });

  await report.section('C0b every new function: postgres-owned, pinned; the definers service_role only; internal functions no role', async () => {
    for (const sig of [...DEFINERS, ...INTERNAL, V3]) {
      const [f] = await rows(`SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS definer, p.proconfig AS config,
          EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0) AS to_public
          FROM pg_proc p WHERE p.oid = $1::regprocedure`, [sig]);
      assert.ok(f, `C0b ${sig} exists`);
      assert.deepEqual([f.owner, f.config, f.to_public], ['postgres', ['search_path=""'], false], `C0b ${sig} posture`);
      const granted = DEFINERS.includes(sig) || sig === V3;
      if (granted) assert.equal(f.definer, true, `C0b ${sig} is SECURITY DEFINER`);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal(await rt.canExecute(role, sig), granted && role === 'service_role', `C0b ${role} executes ${sig}: ${granted && role === 'service_role'}`);
      }
    }
    for (const sig of ['voice_private.set_voice_launch_capability_v1(text,text,text,text,text)', 'voice_private.install_consent_text_v1(text,text,text)']) {
      for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await rt.canExecute(role, sig), false, `C0b ${role} must not execute ${sig}`);
    }
    // voice_private: the twenty 0183 functions and the eight 0186 ones, nothing else.
    const [{ n }] = await rows("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace WHERE s.nspname = 'voice_private'");
    assert.equal(n, 28, 'C0b voice_private holds exactly 20 + 8 functions');
    // v4 has no score parameter: the score is the band's constant.
    const [{ args }] = await rows('SELECT pg_get_function_arguments($1::regprocedure) AS args', [V4]);
    assert.doesNotMatch(args, /confidence/u, 'C0b v4 takes no confidence');
  });

  await report.section('C0c begin v1 keeps its signature, result and ACL (BLOCKER-1 is a body change only)', async () => {
    const sig = 'public.server_begin_voice_note_upload_v1(uuid,uuid,uuid,bigint)';
    const [{ result }] = await rows('SELECT pg_get_function_result($1::regprocedure) AS result', [sig]);
    assert.equal(result, 'TABLE(outcome text, recording_id uuid, storage_key text, upload_deadline timestamp with time zone)');
    for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await rt.canExecute(role, sig), role === 'service_role', `C0c ${role}`);
    const [{ n }] = await rows("SELECT count(*)::int n FROM pg_proc WHERE proname = 'server_begin_voice_note_upload_v1'");
    assert.equal(n, 1, 'C0c no second overload');
  });

  await report.section('C0d the four scopes DISABLED; exactly the approved consent text (C-01 ... C-11) installed and current', async () => {
    const scopes = await rows(`SELECT capability_scope, feature_flag_state, launch_requirements_state FROM voice_private.voice_launch_capability_states ORDER BY 1`);
    assert.deepEqual(scopes, SCOPES.map((s) => ({ capability_scope: s, feature_flag_state: 'DISABLED', launch_requirements_state: 'UNSATISFIED' })));
    const texts = await rows('SELECT purpose, version, is_current, text_ar, text_en, text_ar_sha256, text_en_sha256 FROM voice_private.consent_texts');
    assert.equal(texts.length, 1, 'C0d one consent text');
    const [t] = texts;
    assert.deepEqual([t.purpose, t.version, t.is_current], ['VOICE_RECORDING', 'VOICE_RECORDING_V1', true]);
    assert.deepEqual([t.text_ar_sha256, t.text_en_sha256], [CONSENT_AR_SHA256, CONSENT_EN_SHA256], 'C0d the approved digests');
    assert.deepEqual([sha256(t.text_ar), sha256(t.text_en)], [CONSENT_AR_SHA256, CONSENT_EN_SHA256], 'C0d the stored words are the approved words');
    assert.deepEqual([t.text_ar.split('\n').length, t.text_en.split('\n').length], [11, 11], 'C0d eleven rows, one per line');
    const [read] = await server('SELECT * FROM public.server_read_voice_consent_text_v1()');
    assert.deepEqual([read.consent_version, read.text_ar_sha256], ['VOICE_RECORDING_V1', CONSENT_AR_SHA256], 'C0d the read returns it');
    const [constants] = await server('SELECT * FROM public.server_read_machine_asr_memory_confidence_v1()');
    assert.deepEqual([constants.high, constants.medium], [0.9, 0.75], 'C0d E13 the startup read returns the P-1 constants');
  });

  await report.section('C0e erasure coverage: both relations VOICE; the census is clean; the confidence constants are IMMUTABLE', async () => {
    const registry = await rows("SELECT relation, coverage FROM account_erasure_private.coverage_registry WHERE relation LIKE 'voice_private.note_%' ORDER BY 1");
    assert.deepEqual(registry, RELATIONS.map((relation) => ({ relation, coverage: 'VOICE' })).sort((a, b) => a.relation.localeCompare(b.relation)));
    assert.deepEqual(await rows(CENSUS), [], 'C0e no unregistered relation references the account or a voice relation');
    const [f] = await rows("SELECT provolatile AS v FROM pg_proc WHERE oid = 'voice_private.machine_asr_memory_confidence_v1(text)'::regprocedure");
    assert.equal(f.v, 'i', 'C0e IMMUTABLE');
    const values = await rows(`SELECT voice_private.machine_asr_memory_confidence_v1('HIGH') AS h, voice_private.machine_asr_memory_confidence_v1('MEDIUM') AS m,
        voice_private.machine_asr_memory_confidence_v1('LOW') AS l, voice_private.machine_asr_memory_confidence_v1(NULL) AS n`);
    assert.deepEqual(values[0], { h: 0.9, m: 0.75, l: null, n: null }, 'C0e HIGH 0.90, MEDIUM 0.75, otherwise NULL');
  });

  await report.section('S0 every forward-replaced or derived function is its origin plus exactly the declared edits, in 0186 and live', async () => {
    const text = migration('0186');
    assert.equal(readdirSync(MIGRATIONS).includes(MIGRATION_0186), true, 'S0 the migration file is named as the module says');
    for (const substitution of SUBSTITUTIONS) {
      const declared = substitutedStatement(substitution);
      const written = extractStatement(text, writtenHeader(substitution));
      assert.equal(written.statement, declared, `S0 ${substitution.key}: the 0186 statement is the derived one`);
      assert.ok(substitution.edits.some(([, to]) => to.includes('S8B-03 (0186')) || substitution.target,
        `S0 ${substitution.key}: an edit names its task where a reader of the live body finds it`);
      assert.ok(text.includes(`(substitution "${substitution.key}" in database/voice-notes-0186-substitutions.mjs)`), `S0 ${substitution.key} is announced`);
      const name = /FUNCTION ([a-z_]+\.[a-z_0-9]+)\(/u.exec(writtenHeader(substitution))[1];
      const live = await rows(`SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname || '.' || p.proname = $1`, [name]);
      assert.ok(live.some((r) => r.prosrc === written.body), `S0 ${substitution.key}: the live body is the 0186 body`);
    }
    const [{ src }] = await rows('SELECT prosrc AS src FROM pg_proc WHERE oid = $1::regprocedure', [V3]);
    assert.match(src, /S8B-03 \(0186\)/u, 'S0 v3 names its task');
    assert.match(src, /public\.complete_post_response_personal_capture_v4\(/u, 'S0 v3 delegates to v4');
    assert.match(src, /'\{\}'::uuid\[\]\);\s*$/u, 'S0 with no typed confirmations');
  });
}

// ------------------------------------------------------------------ the rolled-back behaviour
async function verifyBehaviour(report) {
  await q('BEGIN');
  try {
    await report.isolated('V-R1..R7 the replayed begin of an accepted note: ALREADY_ACCEPTED, read-only accept, conflicts, no revival', async () => {
      const { user, session } = await ready();
      const other = await human();
      const otherSession = await newSession(user);
      const first = await one('SELECT * FROM public.server_begin_voice_note_upload_v1($1, $2, $3, 2048)', [user, session, randomUUID()]);
      assert.equal(first.outcome, 'BEGUN');
      const command = (await rows('SELECT begin_command_id AS c FROM voice_private.recordings WHERE id = $1', [first.recording_id]))[0].c;
      // R7: an unfinished upload replays BEGUN with its key, unchanged.
      const again = await one('SELECT * FROM public.server_begin_voice_note_upload_v1($1, $2, $3, 2048)', [user, session, command]);
      assert.deepEqual([again.outcome, again.recording_id, again.storage_key], ['BEGUN', first.recording_id, first.storage_key], 'V-R7 BEGUN replay');
      const accepted = await one('SELECT * FROM public.server_accept_voice_note_v1($1, $2, 2048)', [user, first.recording_id]);
      assert.equal(accepted.outcome, 'ACCEPTED');
      // R1: the same command after acceptance names the note again; no key, no deadline.
      const replay = await one('SELECT * FROM public.server_begin_voice_note_upload_v1($1, $2, $3, 2048)', [user, session, command]);
      assert.deepEqual(replay, { outcome: 'ALREADY_ACCEPTED', recording_id: first.recording_id, storage_key: null, upload_deadline: null }, 'V-R1 ALREADY_ACCEPTED');
      // R2: accept is read-only for a STORED note: the same instant and expiry, nothing changes.
      const reread = await one('SELECT * FROM public.server_accept_voice_note_v1($1, $2, 2048)', [user, first.recording_id]);
      assert.deepEqual(reread, accepted, 'V-R2 the read-only accept answers the first answer');
      // R3: another human, another session, another size: COMMAND_CONFLICT, nothing disclosed.
      for (const [u, s, bytes] of [[other, session, 2048], [user, otherSession, 2048], [user, session, 4096]]) {
        const conflict = await one('SELECT * FROM public.server_begin_voice_note_upload_v1($1, $2, $3, $4)', [u, s, command, bytes]);
        assert.deepEqual(conflict, { outcome: 'COMMAND_CONFLICT', recording_id: null, storage_key: null, upload_deadline: null }, 'V-R3 conflict');
      }
      // R5: the replay creates nothing, even with the gate closed or consent withdrawn; a new command is refused.
      await setVoiceGate('DISABLED', 'UNSATISFIED');
      assert.equal((await one('SELECT * FROM public.server_begin_voice_note_upload_v1($1, $2, $3, 2048)', [user, session, command])).outcome, 'ALREADY_ACCEPTED');
      assert.equal((await one('SELECT * FROM public.server_begin_voice_note_upload_v1($1, $2, $3, 2048)', [user, session, randomUUID()])).outcome, 'NOT_AVAILABLE_NOW', 'V-R5 gate');
      await setVoiceGate();
      assert.equal(await revoke(user), 'WITHDRAWN');
      assert.equal((await one('SELECT * FROM public.server_begin_voice_note_upload_v1($1, $2, $3, 2048)', [user, session, randomUUID()])).outcome, 'CONSENT_REQUIRED', 'V-R5 consent');
      const [{ n }] = await rows('SELECT count(*)::int n FROM voice_private.recordings WHERE user_id = $1', [user]);
      assert.equal(n, 1, 'V-R5 one recording, no revival');
      // R4 / R6: a deleted, expired or discarded note is UNAVAILABLE, never revived.
      assert.equal(await grant(user), 'GRANTED');
      const deleted = await storedNote(user, session);
      await terminate(deleted.id, 'DELETED');
      const expired = await storedNote(user, session);
      await terminate(expired.id, 'EXPIRED');
      for (const r of [deleted, expired]) {
        assert.equal((await one('SELECT * FROM public.server_begin_voice_note_upload_v1($1, $2, $3, 2048)', [user, session, r.command])).outcome, 'UNAVAILABLE', 'V-R4 UNAVAILABLE');
      }
      const discarded = await one('SELECT * FROM public.server_begin_voice_note_upload_v1($1, $2, $3, 2048)', [user, session, randomUUID()]);
      await owner();
      const [{ c: dc }] = await rows('SELECT begin_command_id AS c FROM voice_private.recordings WHERE id = $1', [discarded.recording_id]);
      await q("UPDATE voice_private.recording_objects SET object_state = 'DISCARDED' WHERE recording_id = $1", [discarded.recording_id]);
      await q("UPDATE voice_private.recordings SET recording_state = 'DISCARDED', terminal_at = clock_timestamp() WHERE id = $1", [discarded.recording_id]);
      assert.equal((await one('SELECT * FROM public.server_begin_voice_note_upload_v1($1, $2, $3, 2048)', [user, session, dc])).outcome, 'UNAVAILABLE', 'V-R6 discarded');
      const [{ states }] = await rows('SELECT array_agg(recording_state ORDER BY recording_state) AS states FROM voice_private.recordings WHERE id = ANY($1::uuid[])',
        [[deleted.id, expired.id, discarded.recording_id]]);
      assert.deepEqual(states, ['DELETED', 'DISCARDED', 'EXPIRED'], 'V-R4 nothing revived');
    });

    await report.isolated('V-T1 claim: admitted only with the gate open; no consent holds the note; current consent resumes it', async () => {
      const user = await human();
      const session = await newSession(user);
      const note = await storedNote(user, session);
      assert.equal(await claimNote(note.id), undefined, 'V-T1 the gate closed: nothing is admitted');
      assert.equal(await noteRow(note.id), undefined, 'V-T1 no transcription row');
      await setVoiceGate();
      assert.equal(await claimNote(note.id), undefined, 'V-T1 no consent: not claimed');
      assert.equal((await noteRow(note.id)).state, 'HELD_CONSENT', 'V-T1 held for consent');
      assert.equal((await status(user, note.id)).state, 'HELD_CONSENT');
      assert.equal(await grant(user), 'GRANTED');
      const claimed = await claimNote(note.id);
      assert.ok(claimed, 'V-T1 current consent: claimed');
      assert.equal(claimed.state, 'PENDING');
      assert.equal(claimed.storage_key, note.key, 'V-T1 the worker reads the key (service_role only)');
      assert.equal(await claimNote(note.id, 'another-worker'), undefined, 'V-T1 a held lease is not claimed twice');
      assert.equal(await renew(note.id, 60, 'another-worker'), 'LEASE_LOST');
      assert.equal(await renew(note.id), 'RENEWED');
      assert.equal(await renew(note.id, 0), 'RELEASED');
    });

    await report.isolated('V-T2 SUBMITTING before any byte: the ledger row is begun with it; a replay is ALREADY_BEGUN; one unresolved attempt', async () => {
      const { user, session } = await ready();
      const note = await storedNote(user, session);
      assert.ok(await claimNote(note.id));
      const attempt = randomUUID();
      const begun = await beginSubmission(note.id, attempt);
      assert.deepEqual(begun, { outcome: 'SUBMITTING', ordinal: 1 });
      assert.deepEqual(await beginSubmission(note.id, attempt), { outcome: 'ALREADY_BEGUN', ordinal: 1 }, 'V-T2 replay');
      assert.equal((await beginSubmission(note.id, randomUUID())).outcome, 'NOT_CLAIMABLE', 'V-T2 never a second unresolved attempt');
      const n = await noteRow(note.id);
      assert.deepEqual([n.state, n.attempts_total, n.attempts_auto, n.duration_ms], ['IN_PROGRESS', 1, 1, '4200']);
    });

    await report.isolated('V-T3 a crash after submit, before the job id: OUTCOME_UNKNOWN, no blind resubmission, adoption or quarantine', async () => {
      const { user, session } = await ready();
      const note = await storedNote(user, session);
      assert.ok(await claimNote(note.id));
      const attempt = randomUUID();
      assert.equal((await beginSubmission(note.id, attempt)).outcome, 'SUBMITTING');
      await expireLease(note.id);
      const resumed = await claimNote(note.id, 'second-worker');
      assert.ok(resumed, 'V-T3 a second worker resumes after the lease expires');
      assert.deepEqual([resumed.attempt_id, resumed.attempt_state, resumed.provider_job_id], [attempt, 'OUTCOME_UNKNOWN', null], 'V-T3 OUTCOME_UNKNOWN');
      assert.equal((await beginSubmission(note.id, randomUUID(), 4200, 'second-worker')).outcome, 'NOT_CLAIMABLE', 'V-T3 no blind resubmission');
      await rejected(() => recordFailure(note.id, attempt, 'UNCERTAIN_SUBMISSION', 'second-worker'), ['55000'], /VOICE_TRANSCRIPTION_TRANSITION_REFUSED/u);
      // Adoption: the reconciliation found the job by its reference.
      const job = jobId();
      assert.equal(await recordSubmission(attempt, 'CREATED', job), 'RECORDED', 'V-T3 adopted');
      const adopted = await attemptRow(attempt);
      assert.deepEqual([adopted.attempt_state, adopted.provider_job_id], ['SUBMITTED', job]);
      assert.equal((await noteRow(note.id)).next_attempt_at, null, 'V-T3 adoption ends the quarantine');
      // A second note: no match in a complete listing -> NOT_CREATED, a transient failure (automatic retry).
      const other = await storedNote(user, session);
      assert.ok(await claimNote(other.id));
      const lost = randomUUID();
      assert.equal((await beginSubmission(other.id, lost)).outcome, 'SUBMITTING');
      assert.equal(await recordSubmission(lost, 'UNKNOWN'), 'RECORDED', 'V-T3 UNKNOWN recorded');
      const quarantined = await noteRow(other.id);
      assert.ok(quarantined.next_attempt_at, 'V-T3 the quarantine is set');
      assert.equal(await claimNote(other.id), undefined, 'V-T3 nothing during the quarantine');
      assert.equal((await recordFailure(other.id, lost, 'NOT_CREATED')).state, 'PENDING', 'V-T3 NOT_CREATED retries');
      // A third note: the quarantine ends with no match -> FAILED_RETRYABLE and UNKNOWN_JOB, never an automatic retry.
      const third = await storedNote(user, session);
      assert.ok(await claimNote(third.id));
      const unknown = randomUUID();
      assert.equal((await beginSubmission(third.id, unknown)).outcome, 'SUBMITTING');
      assert.equal(await recordSubmission(unknown, 'UNKNOWN'), 'RECORDED');
      await owner();
      await q("UPDATE voice_private.note_transcription_attempts SET unknown_since = clock_timestamp() - interval '31 minutes' WHERE attempt_id = $1", [unknown]);
      assert.equal((await recordFailure(third.id, unknown, 'UNCERTAIN_SUBMISSION')).state, 'FAILED_RETRYABLE', 'V-T3 FAILED_RETRYABLE after the quarantine');
      const settled = await attemptRow(unknown);
      assert.deepEqual([settled.attempt_state, settled.failure_class, settled.provider_deletion_state], ['FAILED', 'UNCERTAIN_SUBMISSION', 'UNKNOWN_JOB']);
      assert.equal((await status(user, third.id)).can_retry, true, 'V-T3 a user retry remains');
    });

    await report.isolated('V-T4 crash after the job id: the next worker polls the same job; the transcript is kept once', async () => {
      const { user, session } = await ready();
      const note = await storedNote(user, session);
      const attempt = await submitted(note.id);
      const { provider_job_id: job } = await attemptRow(attempt);
      await expireLease(note.id);
      const resumed = await claimNote(note.id, 'second-worker');
      assert.deepEqual([resumed.attempt_id, resumed.attempt_state, resumed.provider_job_id], [attempt, 'SUBMITTED', job], 'V-T4 the same job');
      const kept = await recordTranscript(attempt, 'TRANSCRIBED', TEXT, 'HIGH', ['القاهرة']);
      assert.deepEqual(kept, { outcome: 'RECORDED', state: 'DELETION_PENDING' }, 'V-T4 DELETION_PENDING, not READY');
      assert.deepEqual(await recordTranscript(attempt, 'TRANSCRIBED', TEXT, 'HIGH', ['القاهرة']), { outcome: 'ALREADY_RECORDED', state: 'DELETION_PENDING' }, 'V-T4 idempotent');
      await rejected(() => recordTranscript(attempt, 'TRANSCRIBED', 'نص آخر', 'HIGH'), ['22023'], /VOICE_TRANSCRIPT_IS_DURABLE/u);
      const n = await noteRow(note.id);
      assert.deepEqual([n.transcript_sha256, n.asr_confidence_band, n.uncertain_tokens], [sha256(TEXT), 'HIGH', ['القاهرة']]);
      assert.equal((await commit(user, note.id)).outcome, 'NOT_READY', 'V-T4 nothing commits before the first deletion outcome');
      // V-T4b: a crash after the transcript, before the deletion: the next claim hands the job back for deletion only.
      await expireLease(note.id);
      const again = await claimNote(note.id, 'third-worker');
      assert.equal(again.state, 'DELETION_PENDING');
      assert.deepEqual([again.deletion_attempt_ids, again.deletion_job_ids], [[attempt], [job]], 'V-T4b remove only');
      assert.equal((await recordDeletion(attempt, 'REQUESTED')).note_state, 'READY');
    });

    await report.isolated('V-T5 the bounds: 3 automatic, 5 total; a user retry between; permanent failures final; NO_SPEECH has no turn', async () => {
      const { user, session } = await ready();
      const note = await storedNote(user, session);
      const states = [];
      for (let i = 0; i < 3; i += 1) {
        if (i > 0) await due(note.id);
        assert.ok(await claimNote(note.id), `V-T5 claim ${i + 1}`);
        const a = randomUUID();
        assert.equal((await beginSubmission(note.id, a)).outcome, 'SUBMITTING');
        states.push((await recordFailure(note.id, a, 'PROVIDER_UNAVAILABLE')).state);
      }
      assert.deepEqual(states, ['PENDING', 'PENDING', 'FAILED_RETRYABLE'], 'V-T5 three automatic attempts');
      const backoff = await noteRow(note.id);
      assert.deepEqual([backoff.attempts_auto, backoff.attempts_total], [3, 3]);
      assert.equal(await claimNote(note.id), undefined, 'V-T5 no fourth automatic attempt');
      for (const expected of ['FAILED_RETRYABLE', 'FAILED_FINAL']) {
        assert.equal(await retry(user, note.id), 'RETRY_SCHEDULED', 'V-T5 the user retries');
        assert.ok(await claimNote(note.id));
        const a = randomUUID();
        assert.equal((await beginSubmission(note.id, a)).outcome, 'SUBMITTING');
        assert.equal((await recordFailure(note.id, a, 'PROVIDER_TIMEOUT')).state, expected);
      }
      const final = await noteRow(note.id);
      assert.deepEqual([final.attempts_auto, final.attempts_total, final.state], [3, 5, 'FAILED_FINAL'], 'V-T5 five in total');
      assert.equal(await retry(user, note.id), 'NOT_RETRYABLE');
      const [{ calls }] = await rows("SELECT count(*)::int calls FROM public.ai_provider_calls WHERE source_voice_recording_id = $1", [note.id]);
      assert.equal(calls, 5, 'V-T5 one ledger row per attempt, unknown ones included');
      // A permanent failure is final at once.
      const bad = await storedNote(user, session);
      assert.ok(await claimNote(bad.id));
      const b = randomUUID();
      assert.equal((await beginSubmission(bad.id, b)).outcome, 'SUBMITTING');
      assert.equal((await recordFailure(bad.id, b, 'PROVIDER_UNSUPPORTED_AUDIO')).state, 'FAILED_FINAL', 'V-T5 permanent');
      // NO_SPEECH: no text, no turn.
      const silent = await storedNote(user, session);
      const s = await submitted(silent.id);
      assert.deepEqual(await recordTranscript(s, 'NO_SPEECH', null, null), { outcome: 'RECORDED', state: 'DELETION_PENDING' });
      assert.equal((await recordDeletion(s, 'ABSENT')).note_state, 'NO_SPEECH');
      assert.equal((await commit(user, silent.id)).outcome, 'NOT_READY', 'V-T5 NO_SPEECH has no turn');
      assert.equal((await noteRow(silent.id)).transcript_text, null);
    });

    await report.isolated('V-T6 the duration proof: a failure before any attempt is final, uncounted, with no ledger row; the bound is enforced', async () => {
      const { user, session } = await ready();
      const note = await storedNote(user, session);
      assert.ok(await claimNote(note.id));
      await rejected(() => beginSubmission(note.id, randomUUID(), 602000), ['22023'], /VOICE_REQUEST_INVALID/u);
      assert.equal((await recordFailure(note.id, null, 'AUDIO_DURATION_OVER_LIMIT')).state, 'FAILED_FINAL');
      const n = await noteRow(note.id);
      assert.deepEqual([n.state, n.attempts_total, n.failure_class], ['FAILED_FINAL', 0, 'AUDIO_DURATION_OVER_LIMIT'], 'V-T6 uncounted');
      const [{ calls }] = await rows('SELECT count(*)::int calls FROM public.ai_provider_calls WHERE source_voice_recording_id = $1', [note.id]);
      assert.equal(calls, 0, 'V-T6 no ledger row: nothing was sent');
      assert.equal((await recordFailure(note.id, null, 'AUDIO_CONTAINER_TRUNCATED')).outcome, 'LEASE_LOST', 'V-T6 a final note takes no further failure');
      // 601 s is accepted.
      const ok = await storedNote(user, session);
      assert.ok(await claimNote(ok.id));
      assert.equal((await beginSubmission(ok.id, randomUUID(), 601000)).outcome, 'SUBMITTING', 'V-T6 601 s accepted');
      // Storage unavailable defers without a state change.
      const later = await storedNote(user, session);
      assert.ok(await claimNote(later.id));
      await rejected(() => recordFailure(later.id, null, 'PROVIDER_TIMEOUT'), ['22023'], /VOICE_REQUEST_INVALID/u);
      assert.deepEqual(await recordFailure(later.id, null, 'STORAGE_UNAVAILABLE'), { outcome: 'DEFERRED', state: 'PENDING' });
    });

    await report.isolated('V-T7 a recording deleted or expired during processing: the note is cancelled, its words forgotten, its job still deleted', async () => {
      const { user, session } = await ready();
      const note = await storedNote(user, session);
      const attempt = await submitted(note.id);
      await terminate(note.id, 'DELETED');
      const n = await noteRow(note.id);
      assert.deepEqual([n.state, n.pending_outcome], ['DELETION_PENDING', 'CANCELLED'], 'V-T7 cancelled after the first deletion outcome');
      assert.equal((await attemptRow(attempt)).attempt_state, 'CANCELLED');
      assert.equal(await renew(note.id), 'CANCELLED', 'V-T7 the worker learns it at the next poll round');
      assert.equal((await recordTranscript(attempt, 'TRANSCRIBED', TEXT, 'HIGH')).outcome, 'NOT_SUBMITTED', 'V-T7 no text is kept');
      assert.equal((await recordDeletion(attempt, 'ABSENT')).note_state, 'CANCELLED');
      assert.equal((await noteRow(note.id)).transcript_text, null);
      // A READY note whose recording expires is cancelled and its uncertain words cleared.
      const expiring = await readyNote(user, session, { tokens: ['القاهرة'] });
      await terminate(expiring.id, 'EXPIRED');
      const e = await noteRow(expiring.id);
      assert.deepEqual([e.state, e.transcript_text], ['CANCELLED', null], 'V-T7 READY -> CANCELLED');
      assert.equal((await commit(user, expiring.id)).outcome, 'UNAVAILABLE');
    });

    await report.isolated('V-L1 the ledger: each attempt one SPEECHMATICS batch row bound to the recording; settlement v2 by audio milliseconds', async () => {
      const { user, session } = await ready();
      const note = await readyNote(user, session);
      const [call] = await rows('SELECT user_id, session_id, source_voice_recording_id, provider, requested_model, operation, feature_family, call_state FROM public.ai_provider_calls WHERE id = $1', [note.attempt]);
      assert.deepEqual(call, { user_id: user, session_id: session, source_voice_recording_id: note.id, provider: 'SPEECHMATICS', requested_model: 'enhanced',
        operation: 'SPEECHMATICS_BATCH_TRANSCRIPTION', feature_family: 'VOICE_NOTE_TRANSCRIPTION', call_state: 'PENDING' });
      const [settled] = await server("SELECT * FROM public.settle_ai_provider_call_v2($1, $2, 'SUCCEEDED', 'COMPLETE', '{\"AUDIO_INPUT_MS\": 4100}'::jsonb, 'PROVIDER_REPORTED')", [note.attempt, user]);
      assert.deepEqual([settled.settle_outcome, settled.call_state], ['SETTLED', 'SUCCEEDED_USAGE_REPORTED'], 'V-L1 settled');
      await rejected(() => server("SELECT * FROM public.settle_ai_provider_call_v2($1, $2, 'FAILED', 'ABSENT', '{}'::jsonb, 'GATEWAY_MEASURED')", [randomUUID(), user]), ['22023']);
    });

    await report.isolated('V-D1..D4 deletion: REQUESTED scheduled, retried on LOCKED / TRANSIENT, ABSENT final, UNCONFIRMED on day seven', async () => {
      const { user, session } = await ready();
      const note = await storedNote(user, session);
      const attempt = await submitted(note.id);
      assert.equal((await recordTranscript(attempt, 'TRANSCRIBED', TEXT, 'MEDIUM')).state, 'DELETION_PENDING');
      assert.equal((await status(user, note.id)).state, 'DELETION_PENDING', 'V-D1 no READY before the first deletion outcome');
      const first = await recordDeletion(attempt, 'LOCKED');
      assert.deepEqual([first.provider_deletion_state, first.note_state], ['RETRYING', 'READY'], 'V-D1 any first outcome releases READY');
      const a1 = await attemptRow(attempt);
      assert.equal(a1.deletion_attempts, 1);
      assert.ok(new Date(a1.next_deletion_at) > new Date(Date.now() + 30_000), 'V-D2 the next delete is scheduled');
      assert.equal((await deletionsDue()).some((r) => r.attempt_id === attempt), false, 'V-D2 not due yet');
      await owner();
      await q("UPDATE voice_private.note_transcription_attempts SET next_deletion_at = clock_timestamp() - interval '1 second' WHERE attempt_id = $1", [attempt]);
      const dueRows = await deletionsDue();
      assert.ok(dueRows.some((r) => r.attempt_id === attempt && r.provider_job_id === a1.provider_job_id), 'V-D2 due rows carry the job id to the worker only');
      assert.equal((await deletionsDue()).some((r) => r.attempt_id === attempt), false, 'V-D2 a handed-out row is deferred');
      assert.equal((await recordDeletion(attempt, 'TRANSIENT')).provider_deletion_state, 'RETRYING');
      assert.equal((await recordDeletion(attempt, 'ABSENT')).provider_deletion_state, 'PROVIDER_ABSENT', 'V-D3 404 / 410 final');
      assert.equal((await recordDeletion(attempt, 'REQUESTED')).outcome, 'ALREADY_FINAL');
      // Day seven: an unconfirmed deletion becomes UNCONFIRMED.
      const old = await storedNote(user, session);
      const o = await submitted(old.id);
      assert.equal((await recordTranscript(o, 'TRANSCRIBED', TEXT, 'HIGH')).state, 'DELETION_PENDING');
      assert.equal((await recordDeletion(o, 'REQUESTED')).note_state, 'READY');
      await owner();
      await q("UPDATE voice_private.note_transcription_attempts SET submitted_at = clock_timestamp() - interval '7 days 1 minute' WHERE attempt_id = $1", [o]);
      await deletionsDue();
      assert.equal((await attemptRow(o)).provider_deletion_state, 'UNCONFIRMED', 'V-D4 UNCONFIRMED on day seven');
      // A job recorded after the note moved on is kept only for deletion.
      const moved = await storedNote(user, session);
      assert.ok(await claimNote(moved.id));
      const m = randomUUID();
      assert.equal((await beginSubmission(moved.id, m)).outcome, 'SUBMITTING');
      await terminate(moved.id, 'DELETED');
      assert.equal(await recordSubmission(m, 'CREATED', jobId()), 'RECORDED_FOR_DELETION', 'V-D a late job id is kept to be deleted');
      assert.deepEqual([(await attemptRow(m)).attempt_state, (await attemptRow(m)).provider_deletion_state], ['CANCELLED', 'PENDING']);
    });

    await report.isolated('V-C1..C4 the one atomic voice turn: atomic, idempotent, bounded, refused where it must be', async () => {
      const { user, session } = await ready();
      const note = await readyNote(user, session, { band: 'MEDIUM' });
      // C2: an injected failure after the turn insert rolls everything back.
      await owner();
      await q(`CREATE FUNCTION pg_temp.fail_voice_source() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'INJECTED' USING ERRCODE = 'P0001'; END $$`);
      await q('CREATE TRIGGER verify_0186_inject BEFORE INSERT ON public.conversation_turn_voice_sources FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_voice_source()');
      await rejected(() => commit(user, note.id), ['P0001'], /INJECTED/u);
      await q('DROP TRIGGER verify_0186_inject ON public.conversation_turn_voice_sources');
      const [{ n: none }] = await rows("SELECT count(*)::int n FROM public.conversation_turns WHERE idempotency_key = $1", [`voice-note:${note.id}`]);
      assert.equal(none, 0, 'V-C2 no turn survives the failure');
      assert.equal((await noteRow(note.id)).state, 'READY', 'V-C2 the note is still READY');
      // C1 / C3: one transaction, one turn, replayed.
      const committed = await commit(user, note.id);
      assert.equal(committed.outcome, 'COMMITTED');
      const [turn] = await rows('SELECT role, status, content, idempotency_key, session_id FROM public.conversation_turns WHERE id = $1', [committed.turn_id]);
      assert.deepEqual(turn, { role: 'USER', status: 'RECEIVED', content: TEXT, idempotency_key: `voice-note:${note.id}`, session_id: session });
      const [provenance] = await server('SELECT * FROM public.server_read_turn_voice_provenance_v1($1, $2)', [user, committed.turn_id]);
      assert.deepEqual([provenance.source_modality, provenance.transcript_origin, provenance.asr_confidence_band], ['VOICE_NOTE', 'MACHINE_ASR', 'MEDIUM'], 'V-C1 the source');
      const n = await noteRow(note.id);
      assert.deepEqual([n.state, n.committed_turn_id, n.transcript_text], ['COMMITTED', committed.turn_id, null], 'V-C1 the text lives in the turn only');
      assert.deepEqual(await commit(user, note.id), { outcome: 'ALREADY_COMMITTED', turn_id: committed.turn_id, session_id: session }, 'V-C3 replay');
      const [{ c }] = await rows('SELECT count(*)::int c FROM public.conversation_turns WHERE session_id = $1', [session]);
      assert.equal(c, 1, 'V-C3 one USER turn');
      const history = await server('SELECT * FROM public.server_read_session_voice_turns_v1($1, $2, $3::uuid[])', [user, session, [committed.turn_id]]);
      assert.deepEqual(history.map((h) => [h.turn_id, h.recording_id, h.available, h.duration_ms]), [[committed.turn_id, note.id, true, '4200']], 'V-C history field');
      assert.equal(Object.keys(history[0]).some((k) => /key|band|transcript/u.test(k)), false, 'V-C no key or band reaches history');
      // C4: the admission bound (one in flight per session: the RECEIVED turn above).
      const second = await readyNote(user, session);
      assert.equal((await commit(user, second.id)).outcome, 'ADMISSION_LIMITED', 'V-C4 bounded like a typed turn');
      // C4: refusals.
      const other = await human();
      assert.equal((await commit(other, second.id)).outcome, 'UNAVAILABLE', 'V-C4 another human');
      const s2 = await newSession(user);
      const pendingNote = await storedNote(user, s2);
      assert.equal((await commit(user, pendingNote.id)).outcome, 'NOT_READY', 'V-C4 not READY');
      const s3 = await newSession(user);
      const readyIn3 = await readyNote(user, s3);
      await setVoiceGate('DISABLED', 'UNSATISFIED');
      assert.equal((await commit(user, readyIn3.id)).outcome, 'NOT_AVAILABLE_NOW', 'V-C4 gate closed');
      await setVoiceGate();
      assert.equal(await revoke(user), 'WITHDRAWN');
      assert.equal((await commit(user, readyIn3.id)).outcome, 'CONSENT_REQUIRED', 'V-C4 consent withdrawn');
      assert.equal(await grant(user), 'GRANTED');
      await owner();
      await q("UPDATE public.conversation_sessions SET status = 'CLOSED', closed_at = clock_timestamp() WHERE id = $1", [s3]);
      assert.equal((await commit(user, readyIn3.id)).outcome, 'SESSION_NOT_ACTIVE', 'V-C4 session not active');
      const s4 = await newSession(user);
      const deletedNote = await readyNote(user, s4);
      await terminate(deletedNote.id, 'DELETED');
      assert.equal((await commit(user, deletedNote.id)).outcome, 'UNAVAILABLE', 'V-C4 deleted recording');
      // The pending list of a session and the status read leak no key, transcript or band.
      const pending = await server('SELECT * FROM public.server_list_session_pending_voice_notes_v1($1, $2)', [user, s2]);
      assert.deepEqual(pending.map((p) => [p.recording_id, p.state]), [[pendingNote.id, 'PENDING']]);
      const st = await status(user, pendingNote.id);
      assert.equal(Object.keys(st).some((k) => /key|band|transcript|job/u.test(k)), false, 'V-C status discloses nothing');
    });

    await report.isolated('V-E1..E6 Memory and Fresh Evidence by band; LOW writes nothing; a direct v3 / v4 call on a LOW turn writes nothing', async () => {
      const user = await human();
      const session = await newSession(user);
      for (const [band, score] of [['HIGH', 0.9], ['MEDIUM', 0.75]]) {
        const { turn } = await voiceTurn(user, session, { band });
        await writeExecution(user, session, turn);
        const id = randomUUID();
        const [written] = [await recordMemory(turn, `أنا بحب ${band}`, score, id)];
        assert.equal(written.outcome, 'CREATED', `V-E1 ${band} writes`);
        const row = await memoryRow(id);
        assert.deepEqual([row.source, row.confidence], ['MACHINE_ASR', score], `V-E1 ${band} MACHINE_ASR at its constant`);
        assert.equal(await standing(user, id), 'CURRENT', `V-E2 ${band} Fresh Evidence stands CURRENT`);
        assert.ok((await eligible(user)).includes(id), `V-E3 ${band} enters L2`);
      }
      const low = await voiceTurn(user, session, { band: 'LOW' });
      await writeExecution(user, session, low.turn);
      assert.equal((await recordMemory(low.turn, 'شيء غير واضح', 0.9)).outcome, 'LOW_CONFIDENCE_MACHINE_ASR', 'V-E4 LOW writes no Memory');
      const e = await captureExecution(user, session, (await voiceTurn(user, session, { band: 'LOW' })).turn);
      await rejected(() => capture4(e, { items: [{ id: randomUUID(), content: 'شيء غير واضح.' }] }), ['22023'], /INVALID_UNDERSTANDING_CAPTURE/u);
      await rejected(() => capture3(e, { items: [{ id: randomUUID(), content: 'شيء غير واضح.' }] }), ['22023'], /INVALID_UNDERSTANDING_CAPTURE/u);
      assert.equal((await effectOf(e)).state, 'CLAIMED', 'V-E5 nothing written by a direct call');
      const [{ n }] = await rows("SELECT count(*)::int n FROM public.memories WHERE user_id = $1 AND content LIKE 'شيء غير واضح%'", [user]);
      assert.equal(n, 0, 'V-E6 no Memory from LOW');
    });

    await report.isolated('V-TM1..TM5 Truth Maintenance after voice evidence: WITHDRAWN, CORRECTED with lineage, LAPSED, L2 within CURRENT', async () => {
      const user = await human();
      const session = await newSession(user);
      const voice = await memory(user, { source: 'MACHINE_ASR', content: 'أنا بشتغل في شركة كبيرة.' });
      const corrected = await memory(user, { source: 'MACHINE_ASR', content: 'أنا ساكن في الجيزة.' });
      const lapsed = await memory(user, { source: 'MACHINE_ASR', content: 'أنا تعبان النهارده.' });
      await owner();
      await q("UPDATE public.memories SET status = 'EXPIRED' WHERE id = $1", [lapsed]);
      const hypothesis = randomUUID();
      await owner();
      await q(`INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, status, supporting_evidence_ids, contradicting_evidence_ids, assumptions)
               VALUES ($1, $2, 'verifier-0186 statement.', 'BEHAVIORAL', 'WORK', 'verifier-0186 scope', 'SYSTEM_GENERATED', 'ACTIVE', $3, '{}', ARRAY['verifier-0186'])`,
      [hypothesis, user, [`memory:${voice}`, `memory:${corrected}`]]);
      // TM5: a hypothesis whose evidence is only voice is not withheld while the evidence stands.
      await rows('SELECT public.reevaluate_withdrawn_hypothesis_evidence_core_v1($1, 32)', [user]);
      const [{ s0 }] = await rows('SELECT supporting_evidence_ids AS s0 FROM public.hypotheses WHERE id = $1', [hypothesis]);
      assert.deepEqual(s0, [`memory:${voice}`, `memory:${corrected}`], 'V-TM5 standing voice evidence keeps its link');
      // TM1: a typed forget withdraws it, and housekeeping detaches it.
      const forget = await userTurn(user, session, { status: 'GENERATING', content: 'انسى موضوع الشركة' });
      assert.deepEqual(await finalize2({ session, user, turn: forget, kind: 'FORGET', outcome: 'FORGOTTEN', target: voice }), ['FORGOTTEN']);
      assert.equal(await standing(user, voice), 'WITHDRAWN', 'V-TM1 WITHDRAWN');
      await rows('SELECT public.reevaluate_withdrawn_hypothesis_evidence_core_v1($1, 32)', [user]);
      const [{ s1 }] = await rows('SELECT supporting_evidence_ids AS s1 FROM public.hypotheses WHERE id = $1', [hypothesis]);
      assert.equal(s1.includes(`memory:${voice}`), false, 'V-TM1 detached');
      // TM2: a HIGH voice correction through v4: the predecessor CORRECTED, the successor MACHINE_ASR with its lineage.
      const { turn } = await voiceTurn(user, session, { band: 'HIGH', content: 'لا أنا ساكن في المعادي مش الجيزة' });
      const e = await captureExecution(user, session, turn);
      const successor = randomUUID();
      assert.equal(await capture4(e, { corrections: [{ target: corrected, newId: successor, content: 'أنا ساكن في المعادي.' }] }), 'COMPLETED');
      assert.equal(await standing(user, corrected), 'CORRECTED', 'V-TM2 CORRECTED');
      const s = await memoryRow(successor);
      assert.deepEqual([s.source, s.confidence], ['MACHINE_ASR', 0.9], 'V-TM2 the successor keeps the voice source');
      const [cmd] = await rows('SELECT kind, target_memory_id, new_memory_id FROM public.background_memory_commands WHERE execution_id = $1', [e]);
      assert.deepEqual(cmd, { kind: 'CORRECT', target_memory_id: corrected, new_memory_id: successor }, 'V-TM2 lineage');
      // TM3: LAPSED.
      assert.equal(await standing(user, lapsed), 'LAPSED', 'V-TM3 LAPSED');
      // TM4: L2 is a subset of CURRENT.
      for (const id of await eligible(user)) assert.equal(await standing(user, id), 'CURRENT', `V-TM4 ${id} in L2 stands CURRENT`);
    });

    await report.isolated('V-P1..P4 no automatic promotion: no USER_CONFIRMED writer; a voice turn never writes USER_STATED; typed restatement changes nothing', async () => {
      // P1: every function that names USER_CONFIRMED only reads it (a source filter, the shape list) - none writes it.
      const lines = await rows(`SELECT p.oid::regprocedure::text AS sig, (regexp_matches(p.prosrc, '[^\\n]*USER_CONFIRMED[^\\n]*', 'g'))[1] AS line
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prosrc LIKE '%USER_CONFIRMED%'`);
      for (const { sig, line } of lines) {
        assert.match(line, /source (NOT )?IN \(|'USER_STATED','USER_CONFIRMED','SYSTEM_DERIVED'|USER_CONFIRMED_CURRENT_INTERPRETATION/u, `V-P1 ${sig} only reads USER_CONFIRMED: ${line.trim()}`);
      }
      const updates = await rows(`SELECT p.oid::regprocedure::text AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prosrc ~* 'UPDATE\\s+public\\.memories[^;]*SET[^;]*\\msource\\s*='`);
      assert.deepEqual(updates, [], 'V-P2 no function rewrites a Memory\'s source');
      for (const sig of ['public.server_create_memory_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamp with time zone)',
        'public.server_supersede_memory_v1(uuid,uuid,uuid,text,text,text,double precision,double precision,text,timestamp with time zone)']) {
        for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await rt.canExecute(role, sig), false, `V-P2 ${role} cannot choose a source through ${sig}`);
      }
      // P3: a typed restatement of a voice fact neither changes its source nor records a confirmation.
      const user = await human();
      const session = await newSession(user);
      const voice = await memory(user, { source: 'MACHINE_ASR', content: 'أنا بحب القهوة.' });
      const typed = await userTurn(user, session, { content: 'أنا بحب القهوة' });
      const e = await captureExecution(user, session, typed);
      assert.equal(await capture4(e, { reaffirmed: [voice] }), 'COMPLETED');
      assert.equal((await memoryRow(voice)).source, 'MACHINE_ASR', 'V-P3 the source never changes');
      assert.deepEqual(await confirmationsOf(voice), [], 'V-P3 an ordinary restatement records no confirmation');
      // P4: no voice turn writes USER_STATED, through v4 or finalize v2.
      const { turn } = await voiceTurn(user, session, { band: 'HIGH' });
      const ve = await captureExecution(user, session, turn);
      const item = randomUUID();
      assert.equal(await capture4(ve, { items: [{ id: item, content: 'أنا عندي قطة.' }] }), 'COMPLETED');
      assert.deepEqual([(await memoryRow(item)).source, (await memoryRow(item)).confidence], ['MACHINE_ASR', 0.9], 'V-P4 v4');
      const spoken = (await voiceTurn(user, session, { band: 'HIGH', status: 'GENERATING', content: 'افتكر إني بحب الشاي' })).turn;
      const remembered = randomUUID();
      assert.deepEqual(await finalize2({ session, user, turn: spoken, kind: 'REMEMBER', outcome: 'REMEMBERED', newId: remembered, content: 'أنا بحب الشاي.', confidence: 0.9 }), ['REMEMBERED']);
      assert.equal((await memoryRow(remembered)).source, 'MACHINE_ASR', 'V-P4 finalize v2');
    });

    await report.isolated('V-G1..G2 matching onboarding and the Shared World exclude MACHINE_ASR', async () => {
      const user = await human();
      const voice = await memory(user, { source: 'MACHINE_ASR', content: 'أنا بشتغل مدرس.' });
      const typed = await memory(user, { content: 'أنا بشتغل مهندس.' });
      const prior = async (id) => rows('SELECT * FROM introductions_preparation_private.eligible_prior_item_v1($1, $2)', [user, id]);
      assert.equal((await prior(voice)).length, 0, 'V-G1 matching excludes it');
      assert.equal((await prior(typed)).length, 1, 'V-G1 a typed fact stays eligible');
      const [shared] = await rows('SELECT * FROM shared_knowledge_private.item_v1($1, $2)', [user, voice]);
      assert.deepEqual([shared.availability, shared.reason, shared.content], ['UNAVAILABLE', 'INELIGIBLE', null], 'V-G2 shared excludes it');
    });

    await report.isolated('V-OU1..OU11 Open Understanding v4 by band, cell by cell; labels and uncertain words', async () => {
      const user = await human();
      const session = await newSession(user);
      const earlier = await memory(user, { source: 'MACHINE_ASR', content: 'أنا بلعب كورة كل جمعة.' });
      const ending = await memory(user, { source: 'MACHINE_ASR', content: 'أنا بدرس ألماني.' });
      await owner();
      await q("INSERT INTO public.memory_retrieval_profiles (memory_id, user_id, semantic_indexed, slot, temporal) VALUES ($1, $2, true, NULL, 'CURRENT')", [ending, user]);
      const run = async (band, command, { tokens = [], recordingState = 'STORED', confirmed = [] } = {}) => {
        const { turn } = await voiceTurn(user, session, { band, tokens, recordingState });
        return capture4(await captureExecution(user, session, turn), command, confirmed);
      };
      const refused = (band, command, options) => rejected(() => run(band, command, options), ['22023'], /INVALID_UNDERSTANDING_CAPTURE/u);
      // HIGH: adds (self and other, labelled), restates, ends, corrects; never forgets.
      const self = randomUUID(); const other = randomUUID();
      assert.equal(await run('HIGH', { items: [{ id: self, content: 'أنا بحب السفر.' }, { id: other, content: 'سلمى بقت دكتورة.', subject: 'OTHER', name: 'سلمى', relation: 'أختي' }] }), 'COMPLETED', 'V-OU1 HIGH adds');
      assert.deepEqual([(await memoryRow(other)).source, (await memoryRow(other)).confidence], ['MACHINE_ASR', 0.9], 'V-OU1 about someone else, MACHINE_ASR');
      assert.equal(await run('HIGH', { reaffirmed: [earlier] }), 'COMPLETED', 'V-OU2 HIGH restates');
      assert.equal(await run('HIGH', { ended: [ending] }), 'COMPLETED', 'V-OU3 HIGH ends');
      await refused('HIGH', { forget: [earlier] });
      // MEDIUM: adds about the user and restates; never about someone else, never a change.
      const mid = randomUUID();
      assert.equal(await run('MEDIUM', { items: [{ id: mid, content: 'أنا بحب الرسم.' }] }), 'COMPLETED', 'V-OU4 MEDIUM adds about the user');
      assert.equal((await memoryRow(mid)).confidence, 0.75, 'V-OU4 at 0.75');
      assert.equal(await run('MEDIUM', { reaffirmed: [earlier] }), 'COMPLETED', 'V-OU5 MEDIUM restates');
      await refused('MEDIUM', { items: [{ id: randomUUID(), content: 'سلمى اتنقلت.', subject: 'OTHER', name: 'سلمى' }] });
      await refused('MEDIUM', { corrections: [{ target: earlier, newId: randomUUID(), content: 'أنا بلعب تنس.' }] });
      await refused('MEDIUM', { ended: [earlier] });
      // LOW: nothing but the independent indexing of earlier Memories.
      await refused('LOW', { items: [{ id: randomUUID(), content: 'أنا بحب الشاي.' }] });
      await refused('LOW', { reaffirmed: [earlier] });
      await refused('LOW', { ended: [earlier] });
      await refused('LOW', { corrections: [{ target: earlier, newId: randomUUID(), content: 'x y.' }] });
      const indexed = await memory(user, { content: 'أنا بحب المشي.' });
      assert.equal(await run('LOW', { index: [{ id: indexed, terms: ['مشي'] }] }), 'COMPLETED', 'V-OU8 LOW indexes');
      // OU10 / OU11: a label with a word heard below T_HIGH is refused; unknown words refuse any label.
      await refused('HIGH', { items: [{ id: randomUUID(), content: 'منى بقت مدرسة.', subject: 'OTHER', name: 'منى', relation: 'صاحبتي' }] }, { tokens: ['منى'] });
      assert.equal(await run('HIGH', { items: [{ id: randomUUID(), content: 'هدى بقت مدرسة.', subject: 'OTHER', name: 'هدى' }] }, { tokens: ['منى'] }), 'COMPLETED', 'V-OU10 another word passes');
      await refused('HIGH', { items: [{ id: randomUUID(), content: 'رنا بقت مدرسة.', subject: 'OTHER', name: 'رنا' }] }, { recordingState: 'DELETED' });
      // OU9: a voice turn never writes USER_STATED (no row of this human from a voice turn is USER_STATED).
      const [{ n }] = await rows(`SELECT count(*)::int n FROM public.memories m WHERE m.user_id = $1 AND m.source = 'USER_STATED'
          AND m.id NOT IN ($2::uuid)`, [user, indexed]);
      assert.equal(n, 0, 'V-OU9 no USER_STATED leaks');
    });

    await report.isolated('V-MC1..MC8 spoken Memory commands by band, cell by cell; the database refuses a direct call that breaks a rule', async () => {
      const user = await human();
      const session = await newSession(user);
      const fact = await memory(user, { content: 'أنا بحب كرة السلة.' });
      const vt = async (band, content = 'انسى موضوع كرة السلة') => (await voiceTurn(user, session, { band, status: 'GENERATING', content })).turn;
      // MC1: LOW changes nothing; MC2: NOT_HEARD_CLEARLY names nothing.
      await rejected(async () => finalize2({ session, user, turn: await vt('LOW', 'افتكر إني بحب الشاي'), kind: 'REMEMBER', outcome: 'REMEMBERED', content: 'أنا بحب الشاي.', confidence: 0.9 }), ['42501'], /MACHINE_ASR_MEMORY_COMMAND_REFUSED/u);
      const low = await vt('LOW');
      assert.deepEqual(await finalize2({ session, user, turn: low, kind: 'FORGET', outcome: 'NOT_HEARD_CLEARLY' }), ['NOT_HEARD_CLEARLY'], 'V-MC2');
      const c = await commandOf(low);
      assert.deepEqual([c.outcome, c.target_memory_id, c.result_memory_id, c.candidate_memory_ids, c.answers_command_id], ['NOT_HEARD_CLEARLY', null, null, [], null]);
      assert.equal((await memoryRow(fact)).status, 'ACTIVE');
      // MC3: NOT_HEARD_CLEARLY only for a voice turn, and naming nothing.
      await rejected(async () => finalize2({ session, user, turn: await userTurn(user, session, { status: 'GENERATING' }), kind: 'FORGET', outcome: 'NOT_HEARD_CLEARLY' }), ['22023']);
      await rejected(async () => finalize2({ session, user, turn: await vt('LOW'), kind: 'FORGET', outcome: 'NOT_HEARD_CLEARLY', candidates: [fact] }), ['22023']);
      // MC4: a spoken FORGET is never executed in its own turn: a question first, then a typed yes executes it.
      await rejected(async () => finalize2({ session, user, turn: await vt('HIGH'), kind: 'FORGET', outcome: 'FORGOTTEN', target: fact }), ['42501'], /MACHINE_ASR_MEMORY_COMMAND_REFUSED/u);
      const ask = await vt('HIGH');
      assert.deepEqual(await finalize2({ session, user, turn: ask, kind: 'FORGET', outcome: 'CLARIFICATION_REQUIRED', candidates: [fact] }), ['CLARIFICATION_REQUIRED']);
      const question = await commandOf(ask);
      // MC5: a MEDIUM (or LOW) answer is not accepted.
      await rejected(async () => finalize2({ session, user, turn: await vt('MEDIUM', 'أيوه'), kind: 'FORGET', outcome: 'FORGOTTEN', target: fact, answers: question.id }), ['42501']);
      const yes = await userTurn(user, session, { status: 'GENERATING', content: 'أيوه' });
      assert.deepEqual(await finalize2({ session, user, turn: yes, kind: 'FORGET', outcome: 'FORGOTTEN', target: fact, answers: question.id }), ['FORGOTTEN'], 'V-MC4 a typed yes executes it');
      assert.equal((await memoryRow(fact)).status, 'DELETED');
      // MC6 / MC7: REMEMBER from HIGH / MEDIUM keeps MACHINE_ASR at the constant; MC8: DISABLE like FORGET.
      for (const [band, score] of [['HIGH', 0.9], ['MEDIUM', 0.75]]) {
        const id = randomUUID();
        assert.deepEqual(await finalize2({ session, user, turn: await vt(band, 'افتكر'), kind: 'REMEMBER', outcome: 'REMEMBERED', newId: id, content: `أنا بحب ${band}.`, confidence: score }), ['REMEMBERED']);
        assert.deepEqual([(await memoryRow(id)).source, (await memoryRow(id)).confidence], ['MACHINE_ASR', score], `V-MC6 ${band}`);
      }
      const another = await memory(user, { content: 'أنا بحب الشطرنج.' });
      await rejected(async () => finalize2({ session, user, turn: await vt('HIGH'), kind: 'DISABLE', outcome: 'DISABLED', target: another }), ['42501']);
      // MC9 (E8): the server's read of a command's voice source - this turn's band, and the band of the turn whose words
      // are kept (the turn that asked the question it answers). Another human's turn reads nothing.
      const voiceOf = async (owner, turn, command = null) => (await server(
        'SELECT turn_voice, turn_band, origin_voice, origin_band FROM public.server_read_memory_command_voice_v1($1, $2, $3, $4)',
        [owner, session, turn, command])).map((r) => [r.turn_voice, r.turn_band, r.origin_voice, r.origin_band]);
      assert.deepEqual(await voiceOf(user, ask), [[true, 'HIGH', true, 'HIGH']], 'V-MC9 a HIGH turn');
      assert.deepEqual(await voiceOf(user, yes, question.id), [[false, null, true, 'HIGH']], 'V-MC9 a typed answer to a HIGH question');
      assert.deepEqual(await voiceOf(user, yes), [[false, null, false, null]], 'V-MC9 a typed turn');
      assert.deepEqual(await voiceOf(await human(), ask), [], 'V-MC9 another human reads nothing');
    });

    await report.isolated('V-CF1..CF6 the typed confirmation of a voice fact', async () => {
      const user = await human();
      const session = await newSession(user);
      const voice = await memory(user, { source: 'MACHINE_ASR', content: 'أنا بحب البحر.' });
      // CF2: a typed REMEMBER of the same words: ALREADY_REMEMBERED with an EXPLICIT_MEMORY_COMMAND confirmation.
      const typed = await userTurn(user, session, { status: 'GENERATING', content: 'افتكر إني بحب البحر' });
      assert.deepEqual(await finalize2({ session, user, turn: typed, kind: 'REMEMBER', outcome: 'REMEMBERED', content: 'أنا بحب البحر.' }), ['ALREADY_REMEMBERED']);
      const after = await memoryRow(voice);
      assert.deepEqual([after.source, after.confidence, after.status], ['MACHINE_ASR', 0.9, 'ACTIVE'], 'V-CF2 the source never changes');
      assert.deepEqual((await confirmationsOf(voice)).map((r) => [r.basis, r.by_command]), [['EXPLICIT_MEMORY_COMMAND', true]], 'V-CF2 recorded');
      const [{ n }] = await rows("SELECT count(*)::int n FROM public.memories WHERE user_id = $1 AND status = 'ACTIVE'", [user]);
      assert.equal(n, 1, 'V-CF2 no second Memory');
      // CF3: confirmed ids from a typed turn: MODEL_ASSISTED_CONFIRMATION.
      const other = await memory(user, { source: 'MACHINE_ASR', content: 'أنا بحب الجبل.' });
      const t3 = await userTurn(user, session, { content: 'أيوه أنا فعلًا بحب الجبل' });
      const e3 = await captureExecution(user, session, t3);
      assert.equal(await capture4(e3, {}, [other]), 'COMPLETED');
      assert.deepEqual((await confirmationsOf(other)).map((r) => [r.basis, r.by_execution]), [['MODEL_ASSISTED_CONFIRMATION', true]], 'V-CF3');
      assert.deepEqual((await effectOf(e3)).result_payload.updatedMemoryIds, [other], 'V-CF3 counted as a restatement');
      // The known-memories read v2 carries the source and the typed confirmation to the model.
      const k = await server('SELECT memory_id, source, confirmed_by_typing FROM public.background_known_memories_v2($1, 40)', [t3]);
      assert.deepEqual(k.find((r) => r.memory_id === other), { memory_id: other, source: 'MACHINE_ASR', confirmed_by_typing: true }, 'V-CF known v2');
      // CF1: an ordinary typed restatement records nothing.
      const plain = await memory(user, { source: 'MACHINE_ASR', content: 'أنا بحب الصحرا.' });
      const e1 = await captureExecution(user, session, await userTurn(user, session, { content: 'أنا بحب الصحرا' }));
      assert.equal(await capture4(e1, { reaffirmed: [plain] }), 'COMPLETED');
      assert.deepEqual(await confirmationsOf(plain), [], 'V-CF1 nothing recorded');
      // CF4: confirmed ids from a voice turn are refused.
      const { turn } = await voiceTurn(user, session, { band: 'HIGH' });
      await rejected(async () => capture4(await captureExecution(user, session, turn), {}, [plain]), ['22023'], /INVALID_UNDERSTANDING_CAPTURE/u);
      // CF5: a later correction overrides it: the successor carries no confirmation.
      const corr = await userTurn(user, session, { status: 'GENERATING', content: 'صحح: أنا بحب الجبال العالية' });
      const succ = randomUUID();
      assert.deepEqual(await finalize2({ session, user, turn: corr, kind: 'CORRECT', outcome: 'CORRECTED', target: other, newId: succ, content: 'أنا بحب الجبال العالية.' }), ['CORRECTED']);
      assert.equal((await memoryRow(other)).status, 'SUPERSEDED');
      assert.deepEqual(await confirmationsOf(succ), [], 'V-CF5 the successor has no confirmation');
      assert.equal((await memoryRow(succ)).source, 'USER_STATED', 'V-CF5 a typed correction is the user\'s own words');
      // CF6: a confirmation taints nothing: the evidence still stands.
      assert.equal(await standing(user, voice), 'CURRENT', 'V-CF6 standing unchanged by the confirmation');
    });

    await report.isolated('V-RC1..RC2 consent withdrawn before SUBMITTING sends nothing; during the job: deletion, no text, HELD_CONSENT', async () => {
      const { user, session } = await ready();
      const note = await storedNote(user, session);
      assert.ok(await claimNote(note.id));
      assert.equal(await revoke(user), 'WITHDRAWN');
      assert.deepEqual(await beginSubmission(note.id, randomUUID()), { outcome: 'HELD_CONSENT', ordinal: null }, 'V-RC1 nothing is sent');
      const [{ calls }] = await rows('SELECT count(*)::int calls FROM public.ai_provider_calls WHERE source_voice_recording_id = $1', [note.id]);
      assert.equal(calls, 0, 'V-RC1 no ledger row');
      assert.equal((await noteRow(note.id)).state, 'HELD_CONSENT');
      // RC2: during the job.
      assert.equal(await grant(user), 'GRANTED');
      const during = await storedNote(user, session);
      const attempt = await submitted(during.id);
      assert.equal(await revoke(user), 'WITHDRAWN');
      assert.equal(await renew(during.id), 'CONSENT_WITHDRAWN', 'V-RC2 the poll round sees it');
      assert.equal((await hold(during.id)).state, 'DELETION_PENDING', 'V-RC2 the job is deleted first');
      assert.equal((await attemptRow(attempt)).attempt_state, 'CANCELLED');
      assert.equal((await recordTranscript(attempt, 'TRANSCRIBED', TEXT, 'HIGH')).outcome, 'NOT_SUBMITTED', 'V-RC2 no text is kept');
      assert.equal((await recordDeletion(attempt, 'REQUESTED')).note_state, 'HELD_CONSENT', 'V-RC2 HELD_CONSENT');
      assert.equal((await noteRow(during.id)).transcript_text, null);
      // A transcript that arrives after the withdrawal, before the hold, is not kept either.
      assert.equal(await grant(user), 'GRANTED');
      const late = await storedNote(user, session);
      const l = await submitted(late.id);
      assert.equal(await revoke(user), 'WITHDRAWN');
      assert.equal((await recordTranscript(l, 'TRANSCRIBED', TEXT, 'HIGH')).outcome, 'HELD_CONSENT');
      assert.equal((await noteRow(late.id)).transcript_text, null, 'V-RC2 no text after a withdrawal');
    });

    await report.isolated('V-CS1..CS5 the score is the band\'s constant, exactly; a direct call cannot choose it; typed turns unchanged', async () => {
      const user = await human();
      const session = await newSession(user);
      for (const [band, bad] of [['HIGH', 0.94], ['HIGH', 0.75], ['MEDIUM', 0.8], ['MEDIUM', 0.9], ['HIGH', null]]) {
        const { turn } = await voiceTurn(user, session, { band });
        await writeExecution(user, session, turn);
        await rejected(() => recordMemory(turn, `x ${band} ${bad}`, bad), ['22023'], /INVALID_MEMORY_SCORE/u);
        const spoken = (await voiceTurn(user, session, { band, status: 'GENERATING', content: 'افتكر' })).turn;
        await rejected(() => finalize2({ session, user, turn: spoken, kind: 'REMEMBER', outcome: 'REMEMBERED', content: `y ${band} ${bad}.`, confidence: bad }), ['22023'], /INVALID_MEMORY_SCORE/u);
      }
      // The typed path is unchanged: 0.98 USER_STATED through finalize v2.
      const id = randomUUID();
      assert.deepEqual(await finalize2({ session, user, turn: await userTurn(user, session, { status: 'GENERATING' }), kind: 'REMEMBER', outcome: 'REMEMBERED', newId: id, content: 'أنا بحب العصير.' }), ['REMEMBERED']);
      assert.deepEqual([(await memoryRow(id)).source, (await memoryRow(id)).confidence], ['USER_STATED', 0.98], 'V-CS5 typed unchanged');
    });

    await report.isolated('V-X account erasure: the transcription state, its attempts and the typed confirmations leave with the account', async () => {
      const { user, session } = await ready();
      const note = await readyNote(user, session);
      assert.equal((await commit(user, note.id)).outcome, 'COMMITTED');
      const second = await storedNote(user, session);
      await submitted(second.id);
      const voice = await memory(user, { source: 'MACHINE_ASR', content: 'أنا بحب الكتب.' });
      const typed = await userTurn(user, session, { status: 'GENERATING', content: 'افتكر إني بحب الكتب' });
      assert.deepEqual(await finalize2({ session, user, turn: typed, kind: 'REMEMBER', outcome: 'REMEMBERED', content: 'أنا بحب الكتب.' }), ['ALREADY_REMEMBERED']);
      assert.equal((await confirmationsOf(voice)).length, 1);
      await owner();
      const [row] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
          VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [user]);
      const [{ outcome }] = await server('SELECT public.server_erase_account_v1($1) AS outcome', [row.id]);
      assert.equal(outcome, 'ERASED', 'V-X ERASED');
      const [left] = await rows(`SELECT (SELECT count(*)::int FROM voice_private.note_transcriptions WHERE user_id = $1) AS notes,
          (SELECT count(*)::int FROM voice_private.note_transcription_attempts WHERE user_id = $1) AS attempts,
          (SELECT count(*)::int FROM public.memory_typed_confirmations WHERE user_id = $1) AS confirmations,
          (SELECT count(*)::int FROM public.users WHERE id = $1) AS users`, [user]);
      assert.deepEqual(left, { notes: 0, attempts: 0, confirmations: 0, users: 0 }, 'V-X nothing is left');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ V-RC3 on two connections (committed fixtures)
// Committed: one human, one session, its consent grants. The READY note, the open gate and the commit live only in the
// committing connection's transaction, which is rolled back: the order of the two acts is what is proven.
async function verifyConsentRace(report, P) {
  const { q2, close } = await rt.openSecondary();
  try {
    await report.section('V-RC3 a withdrawal holding the grant refuses the commit; a commit holding the grant makes the withdrawal wait', async () => {
      await rt.provisionHumans([P]);
      const session = await newSession(P);
      const committedGrant = async () => {
        await q('BEGIN');
        try { const g = await grant(P); await q('COMMIT'); return g; } catch (error) { await q('ROLLBACK'); throw error; }
      };
      /** On the main connection, in an open transaction: the gate open and a READY note, written without reading consent. */
      const readyInOpenTransaction = async () => {
        await q('BEGIN');
        await setVoiceGate();
        const note = await storedNote(P, session);
        await owner();
        await q(`INSERT INTO voice_private.note_transcriptions (recording_id, user_id, session_id, state, attempts_auto, attempts_total, duration_ms,
                   transcript_text, transcript_sha256, asr_confidence_band) VALUES ($1, $2, $3, 'READY', 1, 1, 4200, $4, $5, 'HIGH')`,
        [note.id, P, session, TEXT, sha256(TEXT)]);
        return note;
      };
      assert.equal(await committedGrant(), 'GRANTED');
      // 1. The withdrawal holds the grant row: the commit waits, then sees the withdrawal.
      await q2('BEGIN');
      await q2('SET LOCAL ROLE service_role');
      assert.equal((await q2('SELECT * FROM public.server_revoke_voice_recording_consent_v1($1, $2)', [P, randomUUID()])).rows[0].outcome, 'WITHDRAWN');
      const note = await readyInOpenTransaction();
      await q('SET LOCAL ROLE service_role');
      const act = q('SELECT * FROM public.server_commit_voice_note_turn_v1($1, $2)', [P, note.id]);
      assert.equal(await rt.stillPending(act), true, 'V-RC3 the commit waits for the withdrawal');
      await q2('COMMIT');
      assert.equal((await act).rows[0].outcome, 'CONSENT_REQUIRED', 'V-RC3 the commit sees the committed withdrawal');
      await q('ROLLBACK');
      await owner();
      // 2. The commit holds the grant row: the withdrawal waits for it.
      assert.equal(await committedGrant(), 'GRANTED');
      const note2 = await readyInOpenTransaction();
      await q('SET LOCAL ROLE service_role');
      assert.equal((await q('SELECT * FROM public.server_commit_voice_note_turn_v1($1, $2)', [P, note2.id])).rows[0].outcome, 'COMMITTED');
      await q2('BEGIN');
      await q2('SET LOCAL ROLE service_role');
      const withdrawal = q2('SELECT * FROM public.server_revoke_voice_recording_consent_v1($1, $2)', [P, randomUUID()]);
      assert.equal(await rt.stillPending(withdrawal), true, 'V-RC3 the withdrawal waits for the commit');
      await q('ROLLBACK');
      await owner();
      assert.equal((await withdrawal).rows[0].outcome, 'WITHDRAWN');
      await q2('COMMIT');
    });
  } finally {
    await close();
    await owner();
  }
}
async function removeRaceFixtures(humans) {
  await owner();
  await q('BEGIN');
  try {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q('DELETE FROM voice_private.recording_consents WHERE user_id = ANY($1::uuid[])', [humans]);
    await q("SET LOCAL session_replication_role = 'origin'");
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK');
    throw error;
  }
  await rt.removeHistoricalFixture(humans);
  await rt.removeFixtureHumans(humans);
}

runVerifier('0186', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('0186', { query: q, restore: () => owner() });
  const humans = [randomUUID()];
  setStage('catalogue');
  await verifyCatalogue(report);
  setStage('behaviour');
  await verifyBehaviour(report);
  setStage('consent race');
  try {
    await verifyConsentRace(report, humans[0]);
  } finally {
    setStage('teardown');
    await removeRaceFixtures(humans);
  }
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM voice_private.recording_consents) + (SELECT count(*) FROM voice_private.recordings)
      + (SELECT count(*) FROM voice_private.note_transcriptions)
      + (SELECT count(*) FROM voice_private.voice_launch_capability_states WHERE feature_flag_state <> 'DISABLED') AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'the run leaves nothing behind');
}, () => rt.client.end().catch(() => undefined));
