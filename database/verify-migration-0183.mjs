// Real-PostgreSQL verifier for migration 0183 (S8B-02 CP1, Voice Foundation).
//
// The acceptance of the S8B-02 Implementation Task Contract v1.0 (FINAL) §4.2, for the 0183 half of CP1:
//
//   S0   catalogue: every new relation postgres-owned, RLS on, no policy, no grant; every definer pinned; only the
//        server_* definers are executable, by service_role alone; the gate setter and consent installer by no role; the
//        four scopes DISABLED; no consent text; every forward-replaced function is its origin statement plus exactly the
//        declared edits (voice-foundation-0183-substitutions.mjs), byte for byte, in the file and live
//   A1   text backward compatibility: a fixed text exchange (units, batches, Memory, Public picker and compose outcome,
//        export, a text Replay draft) fingerprints exactly as on 0182 (GOLDEN, recorded with VERIFY_0183_GOLDEN=print)
//   A2   a VOICE channel is still refused by the producer
//   A3   VA-3: a voice turn commits through the FINAL coordinator with its modality; the assistant turn stays TEXT; the
//        units inherit the turn's anchor and band; attach is refused after units, malformed, across humans or sessions,
//        for a USER turn without MACHINE_ASR or a band; the legacy producer and a raw insert refuse a voice turn; the
//        source row is immutable
//   A4   D-7 readers: LOW writes no Memory, HIGH / MEDIUM write MACHINE_ASR below 0.95; the Public picker, package and
//        compose outcome exclude voice units; the export labels voice turns and lists retained recordings
//   A5   R-1: capture is ORIGINAL_AUDIO for a voice unit; whole items select, a sub-range is refused; the preview of an
//        audio-bearing Replay is refused; Moments never return the text of a non-text item; the I-06C distribution
//        functions and 0104 are untouched (static and catalogue)
//   A6   retention: the expiry is the anchor + 30 days; identity, anchor and expiry are immutable for the table owner;
//        a call recording cannot exist without an expiry; the note transition happens once; a read is refused at the
//        expiry instant with no worker, and the sweep then expires it with its key queued
//   A7   segments: out-of-order and discontinuous segments are refused; a gap makes the clock continuous; store before
//        add is refused; recovery seals RECOVERY, discards pending segments into WRITER_LOSS gaps, the expiry unchanged
//   A8   consent: no text, no grant; an outdated version; a withdrawal; each refuses begin, accept, open, add and store;
//        a seal and the owner's deletion still work; nothing recorded changes; PRIV-W ordering on two connections
//   A9   the gate: DISABLED refuses begin and open; read, delete, export and erasure are not gated; the matrix
//   A10  isolation between two humans
//   A11  account erasure: ERASED, every voice key in the queue and media_pending, no voice row; an injected failure in
//        the voice module rolls everything back; the census refuses a planted unregistered voice relation
//
// Every scenario but the PRIV-W races runs in one transaction that is rolled back. The races commit their fixtures and
// remove them (session_replication_role = replica, fixture surgery only).
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import process from 'node:process';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { SUBSTITUTIONS, extractStatement, substitutedStatement } from './voice-foundation-0183-substitutions.mjs';

const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, actAs } = rt;
/** rt.rejected, naming the line of the refusal that did not happen. */
async function rejected(operation, codes, message = null) {
  const where = (new Error().stack.split('\n')[2] ?? '').trim().replace(/^at .*verify-migration-0183\.mjs:/u, 'line ');
  // rt.rejected holds its own SAVEPOINT and rolls back to it, so an expected refusal never aborts the transaction;
  // a failed expectation is only re-thrown here, with its line, never swallowed.
  return rt.rejected(operation, codes, message).then(undefined, (error) => {
    error.message = `${error.message} [${where}]`;
    throw error;
  });
}
const owner = () => asRole('postgres');
const MIGRATIONS = new URL('./migrations/', import.meta.url);
const migrationFile = (prefix) => readdirSync(MIGRATIONS).find((f) => f.startsWith(prefix));
const migration = (prefix) => readFileSync(new URL(migrationFile(prefix), MIGRATIONS), 'utf8').replace(/\r\n/gu, '\n');
const GOLDEN_MODE = process.env.VERIFY_0183_GOLDEN === 'print';

// The A1 fingerprint of the fixed text exchange, recorded on a database migrated to 0182 (before 0183 existed).
const GOLDEN = '4fa20b868d28f824d4c0a8310801a428f580511fcce1e7f070b23dd79f91b96d';

const RELATIONS = ['voice_private.recordings', 'voice_private.recording_objects', 'voice_private.recording_gaps',
  'voice_private.consent_texts', 'voice_private.recording_consents', 'voice_private.voice_launch_capability_states',
  'voice_private.voice_launch_capability_events', 'public.conversation_turn_voice_sources'];
const SCOPES = ['PERSONAL_LIVE_CALL', 'PERSONAL_VOICE_NOTE', 'REPLAY_AUDIO_DISTRIBUTION', 'SHARED_VOICE_NOTE'];
const NO_ROLE = ['voice_private.set_voice_launch_capability_v1(text,text,text,text,text)',
  'voice_private.install_consent_text_v1(text,text,text)', 'account_erasure_private.erase_voice_v1(uuid,uuid)',
  'account_erasure_private.voice_module_residue_v1(uuid)', 'voice_private.consent_state_v1(uuid)',
  'voice_private.recording_readable_v1(uuid,uuid)', 'voice_private.capability_enabled_v1(text)'];
const CENSUS = `SELECT c.conrelid::regclass::text AS relation FROM pg_constraint c
  WHERE c.contype = 'f'
    AND (c.confrelid = 'public.users'::regclass
         OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'VOICE'))
    AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g)
  ORDER BY 1`;

// ------------------------------------------------------------------ small helpers
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** A value with every instant and the random public handle removed, keys sorted: what a fixed exchange makes identically. */
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value instanceof Date) return '<instant>';
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().filter((k) => !/(_at|At)$/u.test(k) && !['at', 'publicId', 'public_id'].includes(k)).map((k) => [k, stable(value[k])]));
  }
  return value;
}
async function server(sql, values = []) {
  await asRole('service_role');
  const result = await rows(sql, values);
  await owner();
  return result;
}
const one = async (sql, values = []) => (await server(sql, values))[0];
const outcomeOf = (row) => row?.outcome;

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
async function rawTurn(user, session, role = 'USER', content = 'a turn of the fixture conversation') {
  const id = randomUUID();
  await owner();
  await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
           VALUES ($1, $2, $3, $4, 'COMPLETED', $5)`, [id, session, user, role, content]);
  return id;
}
/** A stored Voice Note written directly (fixture surgery: the definers are proven in A6-A9). */
async function storedNote(user, session) {
  const id = randomUUID();
  const key = `voice-note/${randomUUID()}`;
  await owner();
  await q(`WITH n AS (SELECT clock_timestamp() AS t)
           INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, begin_command_id, accepted_at,
                                                 retention_expires_at, recording_state)
           SELECT $1, $2, $3, 'VOICE_NOTE', gen_random_uuid(), n.t, n.t + interval '30 days', 'STORED' FROM n`, [id, user, session]);
  await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state,
                                                        content_type, byte_size, upload_deadline, stored_at)
           VALUES ($1, 'NOTE', 0, $2, 'STORED', 'audio/mp4', 2048, clock_timestamp(), clock_timestamp())`, [id, key]);
  return { id, key };
}
/** A call recording in RECORDING, written directly. */
async function recordingCall(user, session) {
  const id = randomUUID();
  await owner();
  await q(`WITH n AS (SELECT clock_timestamp() AS t)
           INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at,
                                                 retention_expires_at, recording_state, writer_lease_until)
           SELECT $1, $2, $3, 'LIVE_CALL', gen_random_uuid(), n.t, n.t + interval '30 days', 'RECORDING', n.t + interval '60 seconds'
             FROM n`, [id, user, session]);
  return { id };
}
/** A voice source written directly (the attach definer is proven in A3). */
async function plantSource(user, session, turn, recording, { role = 'USER', modality = 'VOICE_NOTE', band = 'HIGH' } = {}) {
  await owner();
  await q(`INSERT INTO public.conversation_turn_voice_sources
             (turn_id, user_id, session_id, source_role, source_modality, transcript_origin, asr_confidence_band, recording_id,
              anchor_start_ms, anchor_end_ms, spoken, delivery_state)
           VALUES ($1, $2, $3, $4, $5, CASE WHEN $4 = 'USER' THEN 'MACHINE_ASR' END, CASE WHEN $4 = 'USER' THEN $6 END, $7,
                   0, 4200, CASE WHEN $4 = 'ASSISTANT' THEN true END, CASE WHEN $4 = 'ASSISTANT' THEN 'COMPLETE' END)`,
  [turn, user, session, role, modality, band, recording]);
}
async function setVoiceGate(scope, flag = 'ENABLED', requirements = 'SATISFIED') {
  await owner();
  return (await rows(`SELECT * FROM voice_private.set_voice_launch_capability_v1($1, $2, $3, 'verify-0183', 'real-PostgreSQL proof')`,
    [scope, flag, requirements]))[0];
}
async function installConsent(version) {
  await owner();
  return (await rows("SELECT * FROM voice_private.install_consent_text_v1($1, 'نص موافقة للتحقق فقط', 'verification-only consent text')", [version]))[0].outcome;
}
const grant = (user, version, command = randomUUID()) =>
  one('SELECT * FROM public.server_grant_voice_recording_consent_v1($1, $2, $3)', [user, command, version]).then(outcomeOf);
const revoke = (user, command = randomUUID()) =>
  one('SELECT * FROM public.server_revoke_voice_recording_consent_v1($1, $2)', [user, command]).then(outcomeOf);
const consentState = (user) => one('SELECT * FROM public.server_voice_consent_state_v1($1)', [user]);
const begin = (user, session, bytes = 2048, command = randomUUID()) =>
  one('SELECT * FROM public.server_begin_voice_note_upload_v1($1, $2, $3, $4)', [user, session, command, bytes]);
const accept = (user, recording, bytes = 2048) =>
  one('SELECT * FROM public.server_accept_voice_note_v1($1, $2, $3)', [user, recording, bytes]);
const openCall = (user, session, { call = randomUUID(), ago = '0 seconds', lease = 30 } = {}) =>
  one('SELECT * FROM public.server_open_call_recording_v1($1, $2, $3, clock_timestamp() - $4::interval, $5)', [user, session, call, ago, lease]);
const addSegment = (user, recording, track, index, start, end, bytes = 1000, lease = 30) =>
  one('SELECT * FROM public.server_add_call_segment_v1($1, $2, $3, $4, $5, $6, $7, $8)', [user, recording, track, index, start, end, bytes, lease]);
const storeSegment = (user, recording, track, index, bytes = 1000) =>
  one('SELECT * FROM public.server_store_call_segment_v1($1, $2, $3, $4, $5)', [user, recording, track, index, bytes]).then(outcomeOf);
const recordGap = (user, recording, track, start, end, kind = 'RECONNECTION') =>
  one('SELECT * FROM public.server_record_call_gap_v1($1, $2, $3, $4, $5, $6)', [user, recording, track, start, end, kind]).then(outcomeOf);
const seal = (user, recording) => one('SELECT * FROM public.server_seal_call_recording_v1($1, $2)', [user, recording]).then(outcomeOf);
const readObjects = (user, recording) => server('SELECT * FROM public.server_read_voice_recording_objects_v1($1, $2)', [user, recording]);
const deleteRecording = (user, recording) => one('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [user, recording]).then(outcomeOf);
const attach = (user, turn, recording, modality, origin, band, start = 0, end = 4200, spoken = null, delivery = null) =>
  one('SELECT * FROM public.server_attach_turn_voice_source_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [user, turn, recording, modality, origin, band, start, end, spoken, delivery]).then(outcomeOf);
const provenance = (user, turn) => server('SELECT * FROM public.server_read_turn_voice_provenance_v1($1, $2)', [user, turn]);
const recordingRow = async (id) => {
  await owner();
  return (await rows(`SELECT recording_state, accepted_at::text, started_at::text, retention_expires_at::text, sealed_by,
                             deleted_reason, terminal_at IS NOT NULL AS terminal FROM voice_private.recordings WHERE id = $1`, [id]))[0];
};
const queued = async (keys) => {
  await owner();
  return (await rows('SELECT storage_key FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[]) ORDER BY 1', [keys]))
    .map((r) => r.storage_key);
};
async function exportOf(user) {
  await owner();
  return (await rows('SELECT personal_data_private.build_personal_export_v1($1) AS doc', [user]))[0].doc;
}

// ------------------------------------------------------------------ the FINAL coordinator (the shapes of verify-0071)
const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];
const FOCUS_PROVENANCE = ['conversational-focus-evaluator-v1', 'stage-1.2-1.3-reference-attention-v1', 'OPENAI', 'gpt-5-mini', 'focus-resolution-anchored-v2', 1];
const THREAD_PROVENANCE = ['thread-establishment-evaluator-v1', 'stage-1.3-thread-establishment-v1', 'OPENAI', 'gpt-5-mini', 'thread-establishment-evidence-path-v1', 1];
const CONTINUITY_PROVENANCE = ['thread-continuity-evaluator-v1', 'stage-1.3-thread-lifecycle-v1', 'OPENAI', 'gpt-5-mini', 'thread-continuity-identity-v1', 1, 'thread-lifecycle-reducer-v1'];
const LF_REDUCER_VERSION = 'live-focus-reducer-v1';
const USER_TEXT = 'أنا بحب البحر. وبحب الجبل كمان.';
const USER_PARTS = ['أنا بحب البحر.', 'وبحب الجبل كمان.'];
const ASSISTANT_TEXT = 'حلو. إيه اللي بيعجبك فيهم؟';
const NO_FOCUS = { kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null };

function spanOf(content, excerpt) {
  const source = [...content];
  const needle = [...excerpt];
  for (let start = 0; start + needle.length <= source.length; start += 1) {
    if (needle.every((ch, offset) => source[start + offset] === ch)) return { span_start: start, span_end: start + needle.length };
  }
  throw new Error(`fixture excerpt not found: ${excerpt}`);
}
const bundle = (unitId, sequence, target = null, functions = ['INFORM_REPORT']) => ({
  unit_id: unitId, functions, sequence_position: sequence, target_cu_id: target, references: [], claim_attributions: [], attention: NO_FOCUS,
});
const noEstablishment = (unitId) => ({
  unit_id: unitId, decision: 'NO_ESTABLISHMENT', no_establishment_reason: 'NO_INDEPENDENT_FOCUS', emerging_focus_id: null, path: null,
  thread_id: null, home_anchor_id: null, thread_established_event_id: null, evidence: [], explicit_selection_grounding: null,
  origin_state: 'NONE', origin_thread_ids: [],
});
const noAction = (unitId) => ({
  unit_id: unitId, outcome: 'NO_THREAD_ACTION', emerging_focus_id: null, thread_id: null, binding_kind: null, focus_binding_id: null,
  identity_evidence: [], prior_identity_evidence: [], candidate_thread_ids: [], lifecycle_transitions: [],
});
const lfNone = (unitId) => ({ unit_id: unitId, effective_kind: 'NONE', effective_ref: null, transition: false, reason_code: null, transition_event_id: null });

/** A finalized exchange (user turn + assistant reply) through the turn runtime; `ids` fixes every identity. */
async function completedTurns(user, session, ids = {}) {
  const userTurn = ids.userTurn ?? randomUUID();
  const assistantTurn = ids.assistantTurn ?? randomUUID();
  await asRole('authenticated', user);
  await rows('SELECT * FROM public.create_user_conversation_turn($1, $2, $3, $4)', [userTurn, session, USER_TEXT, null]);
  await asRole('service_role');
  await rows('SELECT * FROM public.claim_conversation_turn($1, $2, $3, $4, $5)', [session, user, userTurn, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']);
  const finalized = await rows('SELECT * FROM public.finalize_conversation_turn_v2($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [session, user, userTurn, assistantTurn, ASSISTANT_TEXT, 'ALLOW', ids.request ?? randomUUID(), null, null, null]);
  assert.equal(finalized.length, 1, 'fixture: the exchange is finalized');
  await owner();
  return { userTurn, assistantTurn };
}
/** Commits the exchange's units through the FINAL coordinator (0150); `ids` fixes every unit and batch identity. */
async function commitExchange(user, session, turns, ids = {}) {
  const u1 = ids.u1 ?? randomUUID();
  const u2 = ids.u2 ?? randomUUID();
  const a1 = ids.a1 ?? randomUUID();
  const userUnits = [{ unit_id: u1, ...spanOf(USER_TEXT, USER_PARTS[0]) }, { unit_id: u2, ...spanOf(USER_TEXT, USER_PARTS[1]) }];
  const assistantUnits = [{ unit_id: a1, ...spanOf(ASSISTANT_TEXT, ASSISTANT_TEXT) }];
  const userBundles = [bundle(u1, 'INITIATING'), bundle(u2, 'FOLLOW_UP', u1)];
  const assistantBundles = [bundle(a1, 'RESPONSIVE', u2, ['ASK'])];
  const [{ v }] = await rows('SELECT COALESCE((SELECT current_version FROM public.conversation_world_thread_identity_clocks WHERE user_id = $1), 0)::text v', [user]);
  await owner();
  const [result] = await rows(`SELECT * FROM public.commit_finalized_exchange_with_full_semantic_chain_v1(
      $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,
      $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44)`,
  [session, user, turns.userTurn, ids.userBatch ?? randomUUID(), JSON.stringify(userUnits), JSON.stringify(userBundles),
    JSON.stringify([noEstablishment(u1), noEstablishment(u2)]), JSON.stringify([noAction(u1), noAction(u2)]), JSON.stringify([lfNone(u1), lfNone(u2)]),
    turns.assistantTurn, ids.assistantBatch ?? randomUUID(), JSON.stringify(assistantUnits), JSON.stringify(assistantBundles),
    JSON.stringify([noEstablishment(a1)]), JSON.stringify([noAction(a1)]), JSON.stringify([lfNone(a1)]),
    ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, ...CONTINUITY_PROVENANCE, LF_REDUCER_VERSION, null, 0, v]);
  return { result, u1, u2, a1 };
}
/** A RUNNING post-response execution with MEMORY_WRITE claimed (the verify-0152 fixture). */
async function execution(user, session, turn, id = randomUUID(), event = randomUUID()) {
  await owner();
  await q(`INSERT INTO public.post_response_intelligence_executions
             (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path, safety_disposition, state, current_stage)
           VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', 'RUNNING', 'VERIFIER_0183')`, [id, event, user, session, turn]);
  await q("INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state) VALUES ($1, 'MEMORY_WRITE', 'CLAIMED')", [id]);
  return id;
}
const recordMemory = (turn, content, confidence, memory = randomUUID()) =>
  one('SELECT * FROM public.background_record_memory_v1($1, $2, $3, $4, $5, 0.75, NULL)', [turn, memory, 'STABLE_PREFERENCE', content, confidence]);
async function memoryRow(id) {
  await owner();
  return (await rows('SELECT type, content, source, confidence, importance, status FROM public.memories WHERE id = $1', [id]))[0];
}
async function picker(user) {
  await actAs(user);
  const result = await rows('SELECT source_kind, source_id, text_body FROM public_authoring_private.list_own_public_authoring_sources_v1()');
  await owner();
  return result;
}
async function composeOutcome(user, session, first, last) {
  await actAs(user);
  const result = (await rows(`SELECT * FROM public_compose_source_private.draft_source_outcome_v1($1,
      jsonb_populate_record(NULL::public_compose_private.topic_drafts, jsonb_build_object(
        'source_kind', 'CONVERSATION', 'source_session_id', $2::uuid, 'source_first_sp', $3::integer, 'source_last_sp', $4::integer,
        'source_excluded_sps', '{}'::integer[], 'source_emphasized_sps', '{}'::integer[])))`, [user, session, first, last]))[0];
  await owner();
  return result;
}

// ------------------------------------------------------------------ A1: the fixed text exchange (no 0183 object used)
const FIXED = {
  user: 'a1830000-0000-4000-8000-000000000001', session: 'a1830000-0000-4000-8000-000000000002',
  userTurn: 'a1830000-0000-4000-8000-000000000003', assistantTurn: 'a1830000-0000-4000-8000-000000000004',
  request: 'a1830000-0000-4000-8000-000000000005', userBatch: 'a1830000-0000-4000-8000-000000000006',
  assistantBatch: 'a1830000-0000-4000-8000-000000000007', u1: 'a1830000-0000-4000-8000-000000000008',
  u2: 'a1830000-0000-4000-8000-000000000009', a1: 'a1830000-0000-4000-8000-00000000000a',
  execution: 'a1830000-0000-4000-8000-00000000000b', event: 'a1830000-0000-4000-8000-00000000000c',
  memory: 'a1830000-0000-4000-8000-00000000000d', replayCommand: 'a1830000-0000-4000-8000-00000000000e',
};
async function textFingerprint() {
  await rt.provisionHumans([FIXED.user]);
  await owner();
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [FIXED.session, FIXED.user]);
  const turns = await completedTurns(FIXED.user, FIXED.session, FIXED);
  const committed = await commitExchange(FIXED.user, FIXED.session, turns, FIXED);
  const units = await rows(`SELECT to_jsonb(u) AS row FROM public.conversation_units u WHERE u.session_id = $1 ORDER BY u.session_position`, [FIXED.session]);
  const batches = await rows(`SELECT to_jsonb(b) AS row FROM public.conversation_unit_commit_batches b WHERE b.session_id = $1 ORDER BY b.id`, [FIXED.session]);
  await execution(FIXED.user, FIXED.session, turns.userTurn, FIXED.execution, FIXED.event);
  const memory = await recordMemory(turns.userTurn, 'أنا بحب البحر', 0.95, FIXED.memory);
  const memoryState = await memoryRow(FIXED.memory);
  const pick = await picker(FIXED.user);
  const compose = await composeOutcome(FIXED.user, FIXED.session, 1, 2);
  const exported = await exportOf(FIXED.user);
  await rt.setGate();
  const created = await rt.create(FIXED.user, FIXED.replayCommand, FIXED.session, 1, 2);
  await owner();
  const items = await rows(`SELECT mi.source_item_ordinal, mi.original_medium, mi.personal_source_role, mi.personal_session_position
      FROM public.replay_source_manifest_items mi JOIN public.replay_source_manifest_versions mv ON mv.id = mi.manifest_version_id
     WHERE mv.replay_id = $1 ORDER BY mi.source_item_ordinal`, [created?.replay_id ?? null]);
  const parts = {
    exchange: stable(committed.result), units: stable(units.map((r) => r.row)), batches: stable(batches.map((r) => r.row)),
    memory: stable({ ...memory, row: memoryState }), picker: stable(pick), compose: stable(compose), export: stable(exported),
    replay: stable({ created, items }),
  };
  return { parts, fingerprint: digest(parts) };
}

// ------------------------------------------------------------------ S0: catalogue
async function verifyCatalogue(report) {
  await report.section('S0a every new relation: postgres-owned, RLS on, no policy, no grant to any application role', async () => {
    for (const relation of RELATIONS) {
      const [posture] = await rows(`SELECT pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls,
          (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname || '.' || p.tablename = $1) AS policies
          FROM pg_class c WHERE c.oid = $1::regclass`, [relation]);
      assert.deepEqual(posture, { owner: 'postgres', rls: true, policies: 0 }, `S0a ${relation}`);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
          const [{ allowed }] = await rows('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, relation, privilege]);
          assert.equal(allowed, false, `S0a ${role} has no ${privilege} on ${relation}`);
        }
      }
    }
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const [{ usage }] = await rows("SELECT has_schema_privilege($1, 'voice_private', 'USAGE') AS usage", [role]);
      assert.equal(usage, false, `S0a ${role} has no USAGE on voice_private`);
    }
  });

  await report.section('S0b every new function: postgres-owned and pinned; server_* service_role only; operator acts no role', async () => {
    const text = migration('0183');
    const acl = text.indexOf('  FOREACH fn IN ARRAY ARRAY[');
    const declared = [...text.slice(acl, text.indexOf('] LOOP', acl)).matchAll(/'([a-z_]+\.[a-z_0-9]+\([^']*\))'/gu)].map((m) => m[1]);
    assert.equal(declared.length, 40, 'S0b the ACL block names the forty 0183 functions');
    const functions = await rows(`SELECT p.oid::regprocedure::text AS sig, n.nspname AS schema, p.proname AS name, p.prosecdef AS definer,
          p.proconfig AS config, pg_get_userbyid(p.proowner) AS owner,
          EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0) AS to_public
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.oid = ANY ($1::regprocedure[]) OR n.nspname = 'voice_private' ORDER BY 1`, [declared]);
    assert.equal(functions.length, declared.length, 'S0b voice_private holds no function the ACL block does not name');
    for (const f of functions) {
      assert.equal(f.owner, 'postgres', `S0b ${f.sig} is postgres-owned`);
      assert.deepEqual(f.config, ['search_path=""'], `S0b ${f.sig} pins an empty search_path`);
      assert.equal(f.to_public, false, `S0b PUBLIC does not execute ${f.sig}`);
      const server = f.schema === 'public' && f.name.startsWith('server_');
      if (server) assert.equal(f.definer, true, `S0b ${f.sig} is SECURITY DEFINER`);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal(await rt.canExecute(role, f.sig), server && role === 'service_role', `S0b ${role} executes ${f.sig}: ${server && role === 'service_role'}`);
      }
    }
    for (const sig of NO_ROLE) {
      for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await rt.canExecute(role, sig), false, `S0b ${role} must not execute ${sig}`);
    }
  });

  await report.section('S0c the four scopes DISABLED / UNSATISFIED at version 1; the consent catalogue is empty', async () => {
    const scopes = await rows(`SELECT capability_scope, feature_flag_state, launch_requirements_state, restriction_version::int AS v
        FROM voice_private.voice_launch_capability_states ORDER BY 1`);
    assert.deepEqual(scopes, SCOPES.map((s) => ({ capability_scope: s, feature_flag_state: 'DISABLED', launch_requirements_state: 'UNSATISFIED', v: 1 })));
    const [{ events }] = await rows('SELECT count(*)::int AS events FROM voice_private.voice_launch_capability_events');
    assert.equal(events, 4, 'S0c one seed event per scope');
    const [{ texts, grants }] = await rows(`SELECT (SELECT count(*)::int FROM voice_private.consent_texts) AS texts,
        (SELECT count(*)::int FROM voice_private.recording_consents) AS grants`);
    assert.deepEqual([texts, grants], [0, 0], 'S0c no consent text is installed, no grant exists');
  });

  await report.section('S0d every forward-replaced function is its origin statement plus exactly the declared edits, in 0183 and live', async () => {
    const text = migration('0183');
    for (const substitution of SUBSTITUTIONS) {
      const declared = substitutedStatement(substitution);
      const written = extractStatement(text, substitution.header);
      assert.equal(written.statement, declared, `S0d ${substitution.key}: the 0183 statement is the derived one`);
      assert.ok(substitution.edits.some(([, to]) => to.includes('S8B-02 (0183')) || substitution.key === 'memory-shape',
        `S0d ${substitution.key}: the edit names its task where a reader of the live body finds it`);
      const name = /FUNCTION ([a-z_]+\.[a-z_0-9]+)\(/u.exec(substitution.header)[1];
      const live = await rows(`SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname || '.' || p.proname = $1`, [name]);
      assert.ok(live.some((r) => r.prosrc === written.body), `S0d ${substitution.key}: the live body is the 0183 body`);
    }
    // The 0150 coordinator is not re-created: the producer it calls carries VA-3.
    assert.doesNotMatch(text, /FUNCTION public\.commit_finalized_exchange_with_full_semantic_chain_v1\(/u, 'S0d the coordinator is untouched');
  });
}

// ------------------------------------------------------------------ the rolled-back behaviour
async function verifyBehaviour(report) {
  await owner();
  await q('BEGIN');
  try {
    await report.isolated('A1 the fixed text exchange fingerprints exactly as on 0182 (units, batches, Memory, Public, export, Replay)', async () => {
      const { parts, fingerprint } = await textFingerprint();
      assert.equal(fingerprint, GOLDEN, `A1 the 0182 golden fingerprint (parts: ${Object.entries(parts).map(([k, v]) => `${k}=${digest(v).slice(0, 12)}`).join(' ')})`);
      const [{ n }] = await rows('SELECT count(*)::int AS n FROM public.conversation_turn_voice_sources WHERE user_id = $1', [FIXED.user]);
      assert.equal(n, 0, 'A1 a text exchange writes no voice source');
      assert.deepEqual(parts.units.map((u) => u.source_modality), ['TEXT', 'TEXT', 'TEXT'], 'A1 every unit is TEXT');
      assert.equal(parts.memory.row.source, 'USER_STATED', 'A1 the text Memory is USER_STATED, at the confidence it was given');
      assert.equal(JSON.stringify(parts.export).includes('transcriptOrigin'), false, 'A1 the text export gains no voice label');
      assert.equal('voiceRecordings' in parts.export, false, 'A1 the text export gains no recordings section');
    });

    await report.isolated('A2 a VOICE channel is still refused by the producer', async () => {
      const user = await human();
      const session = await newSession(user, 'VOICE');
      const turn = await rawTurn(user, session, 'USER', USER_TEXT);
      const unitId = randomUUID();
      await rejected(() => rows(`SELECT * FROM public.commit_conversation_units_with_full_semantic_chain_v1(
          $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24,$25::jsonb,$26,$27,$28,$29,$30,$31,$32,$33::jsonb,$34)`,
      [session, user, turn, randomUUID(), JSON.stringify([{ unit_id: unitId, ...spanOf(USER_TEXT, USER_PARTS[0]) }]), ...PROVENANCE,
        JSON.stringify([bundle(unitId, 'INITIATING')]), ...FOCUS_PROVENANCE, JSON.stringify([noEstablishment(unitId)]), ...THREAD_PROVENANCE,
        JSON.stringify([noAction(unitId)]), ...CONTINUITY_PROVENANCE, JSON.stringify([lfNone(unitId)]), LF_REDUCER_VERSION]),
      ['22023'], /UNSUPPORTED_SOURCE_MODALITY/u);
      await asRole('authenticated', user);
      await rejected(() => rows('SELECT * FROM public.create_user_conversation_turn($1, $2, $3, $4)', [randomUUID(), session, 'hello', null]),
        ['55000'], /SESSION_NOT_ACTIVE_TEXT/u);
      await owner();
    });

    await report.isolated('A3 VA-3: a voice turn commits through the FINAL coordinator with its modality; attach is guarded; rows immutable', async () => {
      const [A, B] = [await human(), await human()];
      const session = await newSession(A);
      const other = await newSession(A);
      const note = await storedNote(A, session);
      const elsewhere = await storedNote(A, other);
      const turns = await completedTurns(A, session);
      // Refusals before the attach.
      await rejected(() => attach(A, turns.userTurn, note.id, 'VOICE_NOTE', 'MACHINE_ASR', 'HIGH', -1, 10), ['22023'], /VOICE_SOURCE_INVALID/u);
      await rejected(() => attach(A, turns.userTurn, note.id, 'VOICE_NOTE', 'MACHINE_ASR', 'HIGH', 10, 10), ['22023'], /VOICE_SOURCE_INVALID/u);
      await rejected(() => attach(A, turns.userTurn, note.id, 'VOICE_NOTE', null, 'HIGH'), ['22023'], /VOICE_SOURCE_INVALID/u);
      await rejected(() => attach(A, turns.userTurn, note.id, 'VOICE_NOTE', 'MACHINE_ASR', null), ['22023'], /VOICE_SOURCE_INVALID/u);
      await rejected(() => attach(A, turns.userTurn, note.id, 'VOICE_NOTE', 'MACHINE_ASR', 'CERTAIN'), ['22023'], /VOICE_SOURCE_INVALID/u);
      await rejected(() => attach(A, turns.userTurn, note.id, 'LIVE_CALL_SPEECH', 'MACHINE_ASR', 'HIGH'), ['22023'], /VOICE_SOURCE_INVALID/u);
      await rejected(() => attach(A, turns.userTurn, elsewhere.id, 'VOICE_NOTE', 'MACHINE_ASR', 'HIGH'), ['P0002'], /VOICE_SOURCE_NOT_AVAILABLE/u);
      await rejected(() => attach(B, turns.userTurn, note.id, 'VOICE_NOTE', 'MACHINE_ASR', 'HIGH'), ['P0002'], /VOICE_SOURCE_NOT_AVAILABLE/u);
      await rejected(() => attach(A, turns.userTurn, randomUUID(), 'VOICE_NOTE', 'MACHINE_ASR', 'HIGH'), ['P0002'], /VOICE_SOURCE_NOT_AVAILABLE/u);
      // The attach, its replay, and a different second attach.
      assert.equal(await attach(A, turns.userTurn, note.id, 'VOICE_NOTE', 'MACHINE_ASR', 'MEDIUM'), 'ATTACHED', 'A3 attached');
      assert.equal(await attach(A, turns.userTurn, note.id, 'VOICE_NOTE', 'MACHINE_ASR', 'MEDIUM'), 'ALREADY_ATTACHED', 'A3 an identical replay');
      await rejected(() => attach(A, turns.userTurn, note.id, 'VOICE_NOTE', 'MACHINE_ASR', 'HIGH'), ['55000'], /VOICE_SOURCE_ALREADY_ATTACHED/u);
      assert.deepEqual(await provenance(A, turns.userTurn), [{ source_modality: 'VOICE_NOTE', transcript_origin: 'MACHINE_ASR', asr_confidence_band: 'MEDIUM' }]);
      assert.deepEqual(await provenance(A, turns.assistantTurn), [], 'A3 the assistant reply of a note has no voice source');
      // Commit through the FINAL coordinator.
      const committed = await commitExchange(A, session, turns);
      await owner();
      const units = await rows(`SELECT cu.id, cu.source_role, cu.source_modality, vs.anchor_start_ms::int AS s, vs.anchor_end_ms::int AS e,
            vs.asr_confidence_band AS band FROM public.conversation_units cu
            LEFT JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = cu.source_turn_id
           WHERE cu.session_id = $1 ORDER BY cu.session_position`, [session]);
      assert.deepEqual(units.map((u) => [u.id, u.source_role, u.source_modality, u.s, u.e, u.band]), [
        [committed.u1, 'USER', 'VOICE_NOTE', 0, 4200, 'MEDIUM'], [committed.u2, 'USER', 'VOICE_NOTE', 0, 4200, 'MEDIUM'],
        [committed.a1, 'ASSISTANT', 'TEXT', null, null, null]], 'A3 every user unit carries the turn modality, anchor and band; the reply is TEXT');
      // After units: refused for both turns, even with a valid recording.
      await rejected(() => attach(A, turns.assistantTurn, note.id, 'VOICE_NOTE', 'MACHINE_ASR', 'HIGH'), ['55000'], /VOICE_SOURCE_TURN_COMMITTED/u);
      // The legacy producer and a raw insert refuse a voice turn; a raw VOICE_NOTE unit for a text turn is refused too.
      const legacyTurn = await rawTurn(A, session, 'USER', USER_TEXT);
      await plantSource(A, session, legacyTurn, note.id);
      await rejected(() => rows('SELECT * FROM public.commit_conversation_units_v1($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)',
        [session, A, legacyTurn, randomUUID(), JSON.stringify([{ unit_id: randomUUID(), ...spanOf(USER_TEXT, USER_PARTS[0]) }]), ...PROVENANCE]),
      ['22023'], /UNSUPPORTED_SOURCE_MODALITY/u);
      const batch = randomUUID();
      const textTurn = await rawTurn(A, session, 'USER', 'plain text');
      for (const [turn, modality] of [[legacyTurn, 'TEXT'], [legacyTurn, 'LIVE_CALL_SPEECH'], [textTurn, 'VOICE_NOTE']]) {
        await rejected(async () => {
          await q(`INSERT INTO public.conversation_unit_commit_batches (id, user_id, session_id, source_turn_id, canonical_fingerprint,
                     source_content_sha256, unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
                     segmentation_prompt_version)
                   VALUES ($1, $2, $3, $4, sha256('x'::bytea), sha256('x'::bytea), 1, 'v1', 'v1', 'PROBE', 'probe', 'v1')`, [batch, A, session, turn]);
          await q(`INSERT INTO public.conversation_units (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
                     source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
                   VALUES (gen_random_uuid(), $1, $2, $3, $4, 'USER', 'RESOLVED', $5, 0, 0, 1, 'x', sha256('x'::bytea), 100)`, [A, session, turn, batch, modality]);
        }, ['22023'], /UNSUPPORTED_SOURCE_MODALITY/u);
      }
      // Immutable for the owner role itself.
      await rejected(() => q("UPDATE public.conversation_turn_voice_sources SET asr_confidence_band = 'HIGH' WHERE turn_id = $1", [turns.userTurn]), ['55000'], /APPEND_ONLY/u);
      await rejected(() => q('DELETE FROM public.conversation_turn_voice_sources WHERE turn_id = $1', [turns.userTurn]), ['55000'], /APPEND_ONLY/u);
    });

    await report.isolated('A4 D-7 readers: Memory by band, the Public direct text path closed to voice, the export labelled', async () => {
      const A = await human();
      const session = await newSession(A);
      const note = await storedNote(A, session);
      const turnOf = async (band) => {
        const turn = await rawTurn(A, session, 'USER', `voice ${band}`);
        if (band) await plantSource(A, session, turn, note.id, { band });
        await execution(A, session, turn);
        return turn;
      };
      const low = await turnOf('LOW');
      assert.deepEqual(await recordMemory(low, 'بحب الشاي', 0.9), { outcome: 'LOW_CONFIDENCE_MACHINE_ASR', memory_id: null }, 'A4 LOW writes nothing');
      for (const [band, confidence] of [['HIGH', 0.9], ['MEDIUM', 0.75]]) {
        const turn = await turnOf(band);
        await rejected(() => recordMemory(turn, `بحب ${band}`, 0.95), ['22023'], /INVALID_MEMORY_SCORE/u);
        await rejected(() => recordMemory(turn, `بحب ${band}`, 0.98), ['22023'], /INVALID_MEMORY_SCORE/u);
        const written = await recordMemory(turn, `بحب ${band}`, confidence);
        assert.equal(written.outcome, 'CREATED', `A4 ${band} writes a Memory`);
        assert.deepEqual(await memoryRow(written.memory_id), {
          type: 'STABLE_PREFERENCE', content: `بحب ${band}`, source: 'MACHINE_ASR', confidence, importance: 0.75, status: 'ACTIVE' },
        `A4 ${band} is MACHINE_ASR at ${confidence}`);
      }
      const text = await turnOf(null);
      const typed = await recordMemory(text, 'بحب القهوة', 0.95);
      assert.equal((await memoryRow(typed.memory_id)).source, 'USER_STATED', 'A4 a typed turn is unchanged: USER_STATED at 0.95');
      // The Public direct text path: picker, package and compose outcome.
      const voiceTurn = await rawTurn(A, session, 'USER', 'voice words');
      await plantSource(A, session, voiceTurn, note.id);
      const textTurn = await rawTurn(A, session, 'USER', 'typed words');
      const batch = async (turn, modality, sp) => {
        const b = randomUUID(); const id = randomUUID(); const body = modality === 'TEXT' ? 'typed words' : 'voice words';
        await q(`INSERT INTO public.conversation_unit_commit_batches (id, user_id, session_id, source_turn_id, canonical_fingerprint,
                   source_content_sha256, unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
                   segmentation_prompt_version)
                 VALUES ($1, $2, $3, $4, sha256($5::bytea), sha256($5::bytea), 1, 'v1', 'v1', 'PROBE', 'probe', 'v1')`, [b, A, session, turn, Buffer.from(body)]);
        await q(`INSERT INTO public.conversation_units (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
                   source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
                 VALUES ($1, $2, $3, $4, $5, 'USER', 'RESOLVED', $6, 0, 0, $7, $8, sha256(convert_to($8, 'UTF8')), $9)`,
        [id, A, session, turn, b, modality, [...body].length, body, sp]);
        return id;
      };
      const voiceUnit = await batch(voiceTurn, 'VOICE_NOTE', 1);
      const textUnit = await batch(textTurn, 'TEXT', 2);
      await batch(await rawTurn(A, session, 'USER', 'typed words'), 'TEXT', 3);
      await q('UPDATE public.session_semantic_clocks SET current_sp = 3 WHERE session_id = $1', [session]);
      const picked = (await picker(A)).filter((r) => r.source_kind === 'PERSONAL').map((r) => r.source_id);
      assert.ok(picked.includes(textUnit), 'A4 the picker lists the typed unit');
      assert.ok(!picked.includes(voiceUnit), 'A4 the picker never lists a voice unit');
      // The package: a voice unit answers the bounded UNAVAILABLE (the class of a source this human cannot see), and the
      // same draft then packages a typed unit as before.
      await asRole('authenticated', A);
      const [draft] = await rows('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()]);
      const prepareOwn = async (unit) => {
        await asRole('authenticated', A);
        const [r] = await rows('SELECT * FROM public.prepare_own_public_experience_package_v1($1, $2, $3::uuid[], $4::uuid[], $5::uuid[])',
          [randomUUID(), draft.experience_id, [unit], [], []]);
        await owner();
        return r.outcome;
      };
      assert.equal(await prepareOwn(voiceUnit), 'UNAVAILABLE', 'A4 a voice unit is never packaged');
      assert.equal((await rows('SELECT count(*)::int AS n FROM public.publication_package_manifest_versions WHERE experience_id = $1', [draft.experience_id]))[0].n, 0,
        'A4 no package exists');
      assert.equal(await prepareOwn(textUnit), 'PREPARED', 'A4 a typed unit is packaged as before');
      assert.equal((await composeOutcome(A, session, 1, 1)).outcome, 'SOURCE_UNAVAILABLE', 'A4 a range holding a voice unit is unavailable');
      assert.notEqual((await composeOutcome(A, session, 2, 2)).outcome, 'SOURCE_UNAVAILABLE', 'A4 a typed range is still a source');
      // The export.
      const doc = await exportOf(A);
      const exportedTurns = JSON.stringify(doc);
      assert.ok(exportedTurns.includes('"transcriptOrigin": "MACHINE_ASR"') || exportedTurns.includes('"transcriptOrigin":"MACHINE_ASR"'), 'A4 a voice turn is labelled MACHINE_ASR');
      assert.ok(Array.isArray(doc.voiceRecordings) && doc.voiceRecordings.length === 1, 'A4 the retained recording is listed');
      assert.deepEqual(Object.keys(doc.voiceRecordings[0]).sort(), ['availableUntil', 'kind', 'recordedAt', 'state'], 'A4 metadata only: no key, no audio');
      assert.equal(exportedTurns.includes(note.key), false, 'A4 the export never carries a storage key');
    });

    await report.isolated('A5 R-1: capture ORIGINAL_AUDIO, whole items select, a sub-range and the preview are refused; Moments never print a transcript', async () => {
      const A = await human();
      const session = await newSession(A);
      const note = await storedNote(A, session);
      const turnsIds = [];
      let sp = 0;
      for (let t = 0; t < 4; t += 1) {
        const role = t % 2 === 0 ? 'USER' : 'ASSISTANT';
        const turn = await rawTurn(A, session, role, `message ${t + 1}`);
        const voice = t === 0;
        if (voice) await plantSource(A, session, turn, note.id);
        const b = randomUUID();
        await q(`INSERT INTO public.conversation_unit_commit_batches (id, user_id, session_id, source_turn_id, canonical_fingerprint,
                   source_content_sha256, unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
                   segmentation_prompt_version)
                 VALUES ($1, $2, $3, $4, sha256($5::bytea), sha256($5::bytea), 2, 'v1', 'v1', 'PROBE', 'probe', 'v1')`, [b, A, session, turn, Buffer.from(`${t}`)]);
        for (let u = 0; u < 2; u += 1) {
          sp += 1;
          const body = `message ${t + 1}, sentence ${u + 1}`;
          await q(`INSERT INTO public.conversation_units (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
                     source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
                   VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'RESOLVED', $6, $7, 0, $8, $9, sha256(convert_to($9, 'UTF8')), $10)`,
          [A, session, turn, b, role, voice ? 'VOICE_NOTE' : 'TEXT', u, [...body].length, body, sp]);
        }
        turnsIds.push(turn);
      }
      await q('UPDATE public.session_semantic_clocks SET current_sp = $2 WHERE session_id = $1', [session, sp]);
      await rt.setGate();
      // Capture and whole-item selection.
      const created = await rt.create(A, randomUUID(), session, 1, 4);
      assert.equal(created.outcome, 'CREATED', `A5 a voice-bearing draft of whole messages is created (${created.outcome})`);
      await owner();
      const items = await rows(`SELECT mi.personal_session_position::int AS sp, mi.original_medium, mi.personal_conversation_unit_id AS unit,
            mv.id AS manifest FROM public.replay_source_manifest_items mi
            JOIN public.replay_source_manifest_versions mv ON mv.id = mi.manifest_version_id
           WHERE mv.replay_id = $1 ORDER BY mi.source_item_ordinal`, [created.replay_id]);
      assert.deepEqual(items.map((i) => [i.sp, i.original_medium]).filter(([s]) => s <= 4),
        [[1, 'ORIGINAL_AUDIO'], [2, 'ORIGINAL_AUDIO'], [3, 'ORIGINAL_TEXT'], [4, 'ORIGINAL_TEXT']], 'A5 a voice unit is ORIGINAL_AUDIO, never ORIGINAL_TEXT');
      // The shape law: a Personal item claiming another medium than its unit's is refused.
      await rejected(() => q(`INSERT INTO public.replay_source_manifest_items
          SELECT (jsonb_populate_record(mi, jsonb_build_object('source_item_ordinal', 999, 'original_medium', 'ORIGINAL_TEXT'))).*
            FROM public.replay_source_manifest_items mi WHERE mi.manifest_version_id = $1 AND mi.personal_session_position = 1`,
      [items[0].manifest]), ['23514'], /replay_source_manifest_items_shape_check/u);
      // A sub-range of an audio item is refused; the same range of a text item is not refused for its medium.
      const voiceItem = items.find((i) => i.sp === 1).unit;
      const textItem = items.find((i) => i.sp === 3).unit;
      const resolve = (item, start, end) => rows(`SELECT * FROM public.replay_resolve_selection_spec_v1($1, $2, gen_random_uuid(), 2, $3::uuid[],
          $4::integer[], $5::integer[], 'HIGHLIGHT_SELECTION', clock_timestamp())`, [created.replay_id, items[0].manifest, [item], [start], [end]]);
      await actAs(A);
      await rejected(() => resolve(voiceItem, 0, 3), ['22023'], /REPLAY_SELECTION_INVALID/u);
      const textRange = await (async () => { await q('SAVEPOINT r'); try { await resolve(textItem, 0, 3); return 'ACCEPTED'; } catch (e) { return e.message; } finally { await q('ROLLBACK TO SAVEPOINT r'); } })();
      assert.notEqual(textRange, 'REPLAY_SELECTION_INVALID', 'A5 the same sub-range of a text item is not refused');
      await owner();
      // The preview of an audio-bearing Replay is refused (ORIGINAL_TEXT_ONLY), fail-closed.
      const refused = await (async () => {
        await q('SAVEPOINT p');
        try { return { row: await rt.preview(A, randomUUID(), created.replay_id, created.draft_revision) }; } catch (e) { return { error: e }; } finally { await q('ROLLBACK TO SAVEPOINT p'); await owner(); }
      })();
      assert.ok(refused.error ? /REPLAY_RENDER_MEDIUM_UNAVAILABLE/u.test(refused.error.message) : refused.row.outcome !== 'PREVIEW_READY',
        `A5 the preview is refused (${refused.error?.message ?? refused.row?.outcome})`);
      // A text Replay of the same conversation previews and finalizes; its Moments print text. The same item planted as
      // audio (fixture surgery) prints none.
      const text = await rt.bringTo(A, { session }, 'FINALIZED', { first: 5, last: 6 });
      const moments = await rt.moments(A, text.replay, text.version);
      assert.ok(moments.length > 0 && moments.every((m) => m.original_medium === 'ORIGINAL_TEXT' && typeof m.source_text === 'string'), 'A5 a text Moment prints its text');
      await rt.asReplica(() => q(`UPDATE public.replay_source_manifest_items SET original_medium = 'ORIGINAL_AUDIO'
          WHERE manifest_version_id IN (SELECT id FROM public.replay_source_manifest_versions WHERE replay_id = $1)`, [text.replay]));
      const planted = await rt.moments(A, text.replay, text.version);
      assert.ok(planted.length > 0 && planted.every((m) => m.source_text === null), 'A5 a non-text item never prints a transcript');
    });

    await report.section('A5s the I-06C distribution functions and 0104 are untouched by 0183 and 0184 (static and catalogue)', async () => {
      const ours = migration('0183') + migration('0184');
      const before = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f < '0183').sort();
      const bodies = new Map();
      for (const file of before) {
        const text = readFileSync(new URL(file, MIGRATIONS), 'utf8').replace(/\r\n/gu, '\n');
        for (const m of text.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z_]+\.[a-z_0-9]+)\(/gu)) {
          const tail = text.slice(m.index);
          const open = /\bAS\s+(\$[A-Za-z_]*\$)/u.exec(tail);
          const start = open.index + open[0].length;
          if (!bodies.has(m[1])) bodies.set(m[1], new Set());
          bodies.get(m[1]).add(tail.slice(start, tail.indexOf(open[1], start)));
        }
      }
      const in0104 = [...migration('0104').matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z_]+\.[a-z_0-9]+)\(/gu)].map((m) => m[1]);
      const live = await rows(`SELECT n.nspname || '.' || p.proname AS name, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname IN ('public', 'replay_private') AND (p.proname ~ 'distribution' OR n.nspname || '.' || p.proname = ANY($1::text[]))`, [in0104]);
      assert.ok(live.length >= in0104.length, 'A5s the distribution surface exists');
      for (const f of live) {
        assert.equal(new RegExp(`FUNCTION ${f.name.replace('.', '\\.')}\\(`, 'u').test(ours), false, `A5s 0183 / 0184 never re-create ${f.name}`);
        assert.ok(bodies.get(f.name)?.has(f.prosrc.replace(/\r\n/gu, '\n')), `A5s ${f.name} is a body defined before 0183`);
      }
    });

    await report.isolated('A6 retention: anchor + 30 days, immutable for the owner, one transition, cut at the instant with no worker', async () => {
      const A = await human();
      const session = await newSession(A);
      await installConsent('VERIFY_0183_A6');
      assert.equal(await grant(A, 'VERIFY_0183_A6'), 'GRANTED');
      await setVoiceGate('PERSONAL_VOICE_NOTE');
      await setVoiceGate('PERSONAL_LIVE_CALL');
      const begun = await begin(A, session);
      assert.equal(begun.outcome, 'BEGUN');
      assert.match(begun.storage_key, /^voice-note\/[0-9a-f-]{36}$/u, 'A6 the key is generated by the database');
      const accepted = await accept(A, begun.recording_id);
      assert.equal(accepted.outcome, 'ACCEPTED');
      const row = await recordingRow(begun.recording_id);
      const [{ exact }] = await rows("SELECT $1::timestamptz + interval '30 days' = $2::timestamptz AS exact", [row.accepted_at, row.retention_expires_at]);
      assert.equal(exact, true, 'A6 a note expires exactly 30 days after its acceptance');
      const again = await accept(A, begun.recording_id);
      assert.deepEqual([again.outcome, again.accepted_at.toISOString()], ['ACCEPTED', accepted.accepted_at.toISOString()], 'A6 the transition happens once');
      for (const [sql, token] of [
        ["UPDATE voice_private.recordings SET retention_expires_at = retention_expires_at + interval '1 day' WHERE id = $1", 'DURABLE'],
        ["UPDATE voice_private.recordings SET accepted_at = accepted_at - interval '1 day' WHERE id = $1", 'DURABLE'],
        ['UPDATE voice_private.recordings SET user_id = user_id WHERE id = $1 AND false', null],
        ["UPDATE voice_private.recordings SET recording_state = 'EXPIRED', terminal_at = clock_timestamp() WHERE id = $1", 'TRANSITION_REFUSED'],
        ["UPDATE voice_private.recordings SET recording_state = 'PENDING_UPLOAD' WHERE id = $1", 'VOICE_RECORDING'],
        ['DELETE FROM voice_private.recordings WHERE id = $1', 'DURABLE'],
        ["UPDATE voice_private.recording_objects SET byte_size = 1 WHERE recording_id = $1", 'OBJECT_IS_DURABLE'],
      ]) {
        if (token) await rejected(() => q(sql, [begun.recording_id]), ['55000', '23514'], new RegExp(token, 'u'));
      }
      // A call recording never exists without an expiry.
      await rejected(() => q(`INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, recording_state, writer_lease_until)
          VALUES (gen_random_uuid(), $1, $2, 'LIVE_CALL', gen_random_uuid(), clock_timestamp(), 'RECORDING', clock_timestamp())`, [A, session]),
      ['23514'], /recordings_retention_check/u);
      // A call opened 30 days minus 2 seconds ago: readable now, refused at the instant, expired by the sweep.
      const opened = await openCall(A, session, { ago: '30 days -2 seconds' });
      assert.equal(opened.outcome, 'OPENED');
      const added = await addSegment(A, opened.recording_id, 'USER', 0, 0, 1000);
      assert.equal(await storeSegment(A, opened.recording_id, 'USER', 0), 'STORED');
      assert.equal(await seal(A, opened.recording_id), 'SEALED');
      assert.equal((await readObjects(A, opened.recording_id)).length, 1, 'A6 readable before the instant');
      const sealed = await recordingRow(opened.recording_id);
      const [{ exactCall }] = await rows(`SELECT retention_expires_at = started_at + interval '30 days' AS "exactCall"
          FROM voice_private.recordings WHERE id = $1`, [opened.recording_id]);
      assert.equal(exactCall, true, 'A6 the call expires exactly 30 days after started_at');
      await q('SELECT pg_sleep(2.5)');
      assert.deepEqual(await readObjects(A, opened.recording_id), [], 'A6 refused at the expiry instant, with no worker');
      assert.equal((await recordingRow(opened.recording_id)).recording_state, 'STORED', 'A6 still STORED: the cut is the read rule, not a worker');
      const [swept] = await server('SELECT * FROM public.server_sweep_voice_recordings_v1(200)');
      assert.ok(swept.expired >= 1, 'A6 the sweep expires it');
      const after = await recordingRow(opened.recording_id);
      assert.deepEqual([after.recording_state, after.terminal, after.retention_expires_at], ['EXPIRED', true, sealed.retention_expires_at], 'A6 EXPIRED, the expiry unchanged');
      assert.deepEqual(await queued([added.storage_key]), [added.storage_key], 'A6 its key is queued in the same transaction');
      assert.equal(await deleteRecording(A, opened.recording_id), 'ALREADY_GONE', 'A6 terminal is final');
    });

    await report.isolated('A7 segments: order, continuity, gaps, store-after-add, and RECOVERY sealing with WRITER_LOSS', async () => {
      const A = await human();
      const session = await newSession(A);
      await installConsent('VERIFY_0183_A7');
      assert.equal(await grant(A, 'VERIFY_0183_A7'), 'GRANTED');
      await setVoiceGate('PERSONAL_LIVE_CALL');
      const { recording_id: rec } = await openCall(A, session);
      assert.equal(outcomeOf(await addSegment(A, rec, 'USER', 1, 0, 1000)), 'OUT_OF_ORDER', 'A7 index 1 before 0');
      const s0 = await addSegment(A, rec, 'USER', 0, 0, 1000);
      assert.equal(s0.outcome, 'ADDED');
      assert.match(s0.storage_key, /^voice-call\/[0-9a-f-]{36}$/u);
      assert.equal(outcomeOf(await addSegment(A, rec, 'USER', 1, 1500, 2500)), 'DISCONTINUOUS', 'A7 a hole without a gap row');
      assert.equal(outcomeOf(await addSegment(A, rec, 'USER', 1, 900, 2500)), 'DISCONTINUOUS', 'A7 an overlap');
      assert.equal(await recordGap(A, rec, 'USER', 1000, 1500), 'RECORDED');
      assert.equal(await recordGap(A, rec, 'USER', 1000, 1500), 'RECORDED', 'A7 the same gap replays');
      const s1 = await addSegment(A, rec, 'USER', 1, 1500, 2500);
      assert.equal(s1.outcome, 'ADDED', 'A7 the gap makes the clock continuous');
      assert.equal(outcomeOf(await addSegment(A, rec, 'QANDEEL', 0, 0, 800)), 'ADDED', 'A7 each track has its own clock');
      assert.equal(await storeSegment(A, rec, 'USER', 5), 'UNAVAILABLE', 'A7 store before add');
      assert.equal(await storeSegment(A, rec, 'USER', 0, 999), 'SIZE_MISMATCH');
      assert.equal(await storeSegment(A, rec, 'USER', 0), 'STORED');
      const before = await recordingRow(rec);
      await q("UPDATE voice_private.recordings SET writer_lease_until = clock_timestamp() - interval '1 hour' WHERE id = $1", [rec]);
      const [{ recovered }] = await server('SELECT * FROM public.server_recover_stale_call_recordings_v1(200, 0)');
      assert.ok(recovered >= 1, 'A7 the lapsed writer is recovered');
      const after = await recordingRow(rec);
      assert.deepEqual([after.recording_state, after.sealed_by, after.retention_expires_at, after.started_at],
        ['STORED', 'RECOVERY', before.retention_expires_at, before.started_at], 'A7 sealed RECOVERY, the expiry byte-equal');
      const objects = await rows('SELECT track, segment_index, object_state FROM voice_private.recording_objects WHERE recording_id = $1 ORDER BY 1, 2', [rec]);
      assert.deepEqual(objects.map((o) => [o.track, o.segment_index, o.object_state]),
        [['QANDEEL', 0, 'DISCARDED'], ['USER', 0, 'STORED'], ['USER', 1, 'DISCARDED']], 'A7 nothing pending is presented as stored');
      const gaps = await rows(`SELECT track, clock_start_ms::int AS s, clock_end_ms::int AS e, gap_kind FROM voice_private.recording_gaps
          WHERE recording_id = $1 ORDER BY 1, 2`, [rec]);
      assert.deepEqual(gaps.map((g) => [g.track, g.s, g.e, g.gap_kind]),
        [['QANDEEL', 0, 800, 'WRITER_LOSS'], ['USER', 1000, 1500, 'RECONNECTION'], ['USER', 1500, 2500, 'WRITER_LOSS']], 'A7 the gaps are explicit');
      const [{ late }] = await rows(`SELECT bool_and(q.not_before >= o.upload_deadline + voice_private.late_upload_grace_v1()) AS late
          FROM introduction_sharing_private.media_erasure_queue q JOIN voice_private.recording_objects o ON o.storage_key = q.storage_key
         WHERE o.recording_id = $1 AND o.object_state = 'DISCARDED'`, [rec]);
      assert.equal(late, true, 'A7 a discarded key is erased only after its upload can no longer land');
      assert.equal((await readObjects(A, rec)).length, 1, 'A7 only the stored segment is readable');
      assert.equal(await gapAfterSeal(A, rec), 'UNAVAILABLE', 'A7 a sealed recording admits no gap');
    });

    await report.isolated('A8 consent: no text, no grant, an outdated version and a withdrawal refuse every recording act; a seal and deletion still work', async () => {
      const A = await human();
      const session = await newSession(A);
      await setVoiceGate('PERSONAL_VOICE_NOTE');
      await setVoiceGate('PERSONAL_LIVE_CALL');
      assert.deepEqual(await consentState(A), { consent_state: 'NOT_GRANTED', consent_version: null });
      assert.equal(await grant(A, 'ANY_VERSION'), 'VERSION_NOT_CURRENT', 'A8 an empty catalogue grants nothing');
      assert.equal(outcomeOf(await begin(A, session)), 'CONSENT_REQUIRED', 'A8 no grant: begin');
      assert.equal(outcomeOf(await openCall(A, session)), 'CONSENT_REQUIRED', 'A8 no grant: open');
      await installConsent('VERIFY_0183_V1');
      const command = randomUUID();
      assert.equal(await grant(A, 'VERIFY_0183_V1', command), 'GRANTED');
      assert.equal(await grant(A, 'VERIFY_0183_V1', command), 'GRANTED', 'A8 the same command replays');
      const B = await human();
      assert.equal(await grant(B, 'VERIFY_0183_V1', command), 'COMMAND_CONFLICT', 'A8 a command is one human\'s');
      await installConsent('VERIFY_0183_V2');
      assert.deepEqual(await consentState(A), { consent_state: 'VERSION_NOT_CURRENT', consent_version: 'VERIFY_0183_V1' });
      assert.equal(outcomeOf(await begin(A, session)), 'CONSENT_REQUIRED', 'A8 an outdated version: begin');
      assert.equal(await grant(A, 'VERIFY_0183_V2'), 'GRANTED');
      const [{ n: active }] = await rows('SELECT count(*)::int AS n FROM voice_private.recording_consents WHERE user_id = $1 AND revoked_at IS NULL', [A]);
      assert.equal(active, 1, 'A8 the current grant closed the earlier one');
      // Recordings in flight, then the withdrawal.
      const begun = await begin(A, session);
      assert.equal(begun.outcome, 'BEGUN');
      const kept = await storedNote(A, session);
      const { recording_id: call } = await openCall(A, session);
      const segment = await addSegment(A, call, 'USER', 0, 0, 1000);
      assert.equal(segment.outcome, 'ADDED');
      const keptBefore = await recordingRow(kept.id);
      const revokeCommand = randomUUID();
      assert.equal(await revoke(A, revokeCommand), 'WITHDRAWN');
      assert.equal(await revoke(A, revokeCommand), 'WITHDRAWN', 'A8 the same withdrawal replays');
      assert.equal(await revoke(A), 'NOT_GRANTED', 'A8 nothing more to withdraw');
      assert.deepEqual(await consentState(A), { consent_state: 'WITHDRAWN', consent_version: null });
      assert.equal(outcomeOf(await begin(A, session)), 'CONSENT_REQUIRED', 'A8 withdrawn: begin');
      assert.equal(outcomeOf(await accept(A, begun.recording_id)), 'CONSENT_REQUIRED', 'A8 withdrawn: accept');
      assert.equal(outcomeOf(await openCall(A, session)), 'CONSENT_REQUIRED', 'A8 withdrawn: open');
      assert.equal(outcomeOf(await addSegment(A, call, 'USER', 1, 1000, 2000)), 'CONSENT_REQUIRED', 'A8 withdrawn: add');
      assert.equal(await storeSegment(A, call, 'USER', 0), 'CONSENT_REQUIRED', 'A8 withdrawn: store');
      assert.equal(await seal(A, call), 'SEALED', 'A8 a seal records nothing new and still works');
      assert.deepEqual(await recordingRow(kept.id), keptBefore, 'A8 a withdrawal deletes and changes nothing');
      assert.equal((await readObjects(A, kept.id)).length, 1, 'A8 the owner still reads it');
      assert.equal(await deleteRecording(A, kept.id), 'DELETED', 'A8 and can still delete it');
      assert.equal(await deleteRecording(A, begun.recording_id), 'DELETED', 'A8 a pending note is discarded by its owner');
      assert.equal((await recordingRow(begun.recording_id)).recording_state, 'DISCARDED');
      // The consent rows and texts are durable.
      await rejected(() => q("UPDATE voice_private.recording_consents SET granted_at = granted_at - interval '1 day' WHERE user_id = $1", [A]), ['55000'], /VOICE_CONSENT_RECORD_IS_DURABLE/u);
      await rejected(() => q('DELETE FROM voice_private.recording_consents WHERE user_id = $1', [A]), ['55000'], /VOICE_CONSENT_RECORD_IS_DURABLE/u);
      await rejected(() => q("UPDATE voice_private.consent_texts SET text_en = 'changed' WHERE version = 'VERIFY_0183_V2'"), ['55000'], /VOICE_CONSENT_TEXT_IS_IMMUTABLE/u);
    });

    await report.isolated('A9 the gate: DISABLED refuses begin and open; read, delete, export and erasure are not gated; the matrix', async () => {
      const A = await human();
      const session = await newSession(A);
      await installConsent('VERIFY_0183_A9');
      assert.equal(await grant(A, 'VERIFY_0183_A9'), 'GRANTED');
      assert.equal(outcomeOf(await begin(A, session)), 'NOT_AVAILABLE_NOW', 'A9 begin is closed');
      assert.equal(outcomeOf(await openCall(A, session)), 'NOT_AVAILABLE_NOW', 'A9 open is closed');
      const note = await storedNote(A, session);
      assert.equal((await readObjects(A, note.id)).length, 1, 'A9 read is not gated');
      assert.ok(Array.isArray((await exportOf(A)).voiceRecordings), 'A9 the export is not gated');
      assert.equal(await deleteRecording(A, note.id), 'DELETED', 'A9 delete is not gated');
      for (const [flag, requirements, open] of [['INTERNAL', 'SATISFIED', false], ['LIMITED_ROLLOUT', 'SATISFIED', false], ['ENABLED', 'UNSATISFIED', false],
        ['ENABLED', 'UNKNOWN', false], ['EMERGENCY_DISABLED', 'SATISFIED', false], ['ENABLED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE', true], ['ENABLED', 'SATISFIED', true]]) {
        await setVoiceGate('PERSONAL_VOICE_NOTE', flag, requirements);
        const result = outcomeOf(await begin(A, session));
        assert.equal(result === 'BEGUN', open, `A9 ${flag} / ${requirements}: ${result}`);
      }
      await rejected(() => setVoiceGate('VOICE_EVERYTHING'), ['22023'], /VOICE_CAPABILITY_SCOPE_UNKNOWN/u);
      const [{ events }] = await rows("SELECT count(*)::int AS events FROM voice_private.voice_launch_capability_events WHERE capability_scope = 'PERSONAL_VOICE_NOTE'");
      assert.equal(events, 8, 'A9 every decision is an event');
    });

    await report.isolated('A10 isolation: another human cannot attach, read, accept, add, seal, delete or export a recording', async () => {
      const [A, B] = [await human(), await human()];
      const sa = await newSession(A);
      const sb = await newSession(B);
      const note = await storedNote(A, sa);
      const call = await recordingCall(A, sa);
      const turnA = await rawTurn(A, sa);
      const turnB = await rawTurn(B, sb);
      await rejected(() => attach(B, turnA, note.id, 'VOICE_NOTE', 'MACHINE_ASR', 'HIGH'), ['P0002'], /VOICE_SOURCE_NOT_AVAILABLE/u);
      await rejected(() => attach(B, turnB, note.id, 'VOICE_NOTE', 'MACHINE_ASR', 'HIGH'), ['P0002'], /VOICE_SOURCE_NOT_AVAILABLE/u);
      assert.deepEqual(await readObjects(B, note.id), [], 'A10 read');
      assert.equal(outcomeOf(await accept(B, note.id)), 'UNAVAILABLE', 'A10 accept');
      assert.equal(outcomeOf(await addSegment(B, call.id, 'USER', 0, 0, 1000)), 'UNAVAILABLE', 'A10 add');
      assert.equal(await storeSegment(B, call.id, 'USER', 0), 'UNAVAILABLE', 'A10 store');
      assert.equal(await recordGap(B, call.id, 'USER', 0, 10), 'UNAVAILABLE', 'A10 gap');
      assert.equal(await seal(B, call.id), 'UNAVAILABLE', 'A10 seal');
      assert.equal(await deleteRecording(B, note.id), 'UNAVAILABLE', 'A10 delete');
      assert.equal(outcomeOf(await begin(B, sa)), 'UNAVAILABLE', 'A10 begin in another human\'s session');
      await plantSource(A, sa, turnA, note.id);
      assert.deepEqual(await provenance(B, turnA), [], 'A10 provenance');
      assert.equal('voiceRecordings' in (await exportOf(B)), false, 'A10 another human\'s export holds nothing of it');
      assert.equal((await recordingRow(note.id)).recording_state, 'STORED', 'A10 untouched');
      for (const role of ['anon', 'authenticated']) {
        await asRole(role, role === 'authenticated' ? A : null);
        await rejected(() => rows('SELECT * FROM public.conversation_turn_voice_sources'), ['42501']);
        await rejected(() => rows('SELECT * FROM voice_private.recordings'), ['42501']);
        await rejected(() => rows('SELECT * FROM public.server_read_voice_recording_objects_v1($1, $2)', [A, note.id]), ['42501']);
        await owner();
      }
    });

    await report.isolated('A11 account erasure: ERASED, every voice key queued and pending, no voice row; consent leaves with the account', async () => {
      const E = await human();
      const session = await newSession(E);
      await installConsent('VERIFY_0183_A11');
      assert.equal(await grant(E, 'VERIFY_0183_A11'), 'GRANTED');
      const fixture = await voiceFootprint(E, session);
      const deletion = await requestDeletion(E);
      assert.equal(await erase(deletion), 'ERASED');
      await owner();
      const [left] = await rows(`SELECT (SELECT count(*)::int FROM voice_private.recordings WHERE user_id = $1) AS recordings,
          (SELECT count(*)::int FROM voice_private.recording_objects WHERE recording_id = ANY($2::uuid[])) AS objects,
          (SELECT count(*)::int FROM voice_private.recording_gaps WHERE recording_id = ANY($2::uuid[])) AS gaps,
          (SELECT count(*)::int FROM public.conversation_turn_voice_sources WHERE user_id = $1) AS sources,
          (SELECT count(*)::int FROM voice_private.recording_consents WHERE user_id = $1) AS consents,
          (SELECT count(*)::int FROM public.users WHERE id = $1) AS users`, [E, fixture.recordings]);
      assert.deepEqual(left, { recordings: 0, objects: 0, gaps: 0, sources: 0, consents: 0, users: 0 }, 'A11 no voice row is left');
      assert.deepEqual(await queued(fixture.keys), [...fixture.keys].sort(), 'A11 every key is in the erasure queue');
      const pending = (await rows('SELECT storage_key FROM account_erasure_private.media_pending WHERE deletion_id = $1 ORDER BY 1', [deletion])).map((r) => r.storage_key);
      assert.deepEqual(pending, [...fixture.keys].sort(), 'A11 every key is tracked until the worker proves it gone');
    });

    await report.isolated('A11b an injected failure in the voice module rolls the whole erasure back', async () => {
      const E = await human();
      const session = await newSession(E);
      const fixture = await voiceFootprint(E, session);
      const deletion = await requestDeletion(E);
      await owner();
      await q(`CREATE FUNCTION public.verify_0183_injected_failure_v1() RETURNS trigger LANGUAGE plpgsql AS $$
               BEGIN RAISE EXCEPTION 'VERIFY_0183_INJECTED_FAILURE'; END$$`);
      await q(`CREATE TRIGGER zz_verify_0183_injected_failure BEFORE DELETE ON voice_private.recording_gaps
               FOR EACH ROW EXECUTE FUNCTION public.verify_0183_injected_failure_v1()`);
      await q('SAVEPOINT e');
      let outcome;
      try { outcome = await erase(deletion); } catch (error) { outcome = error.message; await q('ROLLBACK TO SAVEPOINT e'); }
      await owner();
      assert.notEqual(outcome, 'ERASED', `A11b the erasure does not complete (${outcome})`);
      const [left] = await rows(`SELECT (SELECT count(*)::int FROM voice_private.recordings WHERE user_id = $1) AS recordings,
          (SELECT count(*)::int FROM public.conversation_turn_voice_sources WHERE user_id = $1) AS sources,
          (SELECT count(*)::int FROM public.users WHERE id = $1) AS users,
          (SELECT count(*)::int FROM account_erasure_private.media_pending WHERE deletion_id = $2) AS pending`, [E, deletion]);
      assert.deepEqual(left, { recordings: fixture.recordings.length, sources: 1, users: 1, pending: 0 }, 'A11b everything is as it was');
    });

    await report.isolated('A11c the census refuses a planted unregistered voice relation; the module deletes from every VOICE relation', async () => {
      assert.deepEqual(await rows(CENSUS), [], 'A11c the registry is complete');
      await q('CREATE TABLE public.verify_0183_planted_recording (id uuid REFERENCES voice_private.recordings (id))');
      await q('CREATE TABLE public.verify_0183_planted_source (turn_id uuid REFERENCES public.conversation_turn_voice_sources (turn_id))');
      assert.deepEqual((await rows(CENSUS)).map((r) => r.relation), ['verify_0183_planted_recording', 'verify_0183_planted_source'],
        'A11c both planted relations are found');
      const [{ src }] = await rows("SELECT prosrc AS src FROM pg_proc WHERE oid = 'account_erasure_private.erase_voice_v1(uuid,uuid)'::regprocedure");
      for (const { relation } of await rows("SELECT relation FROM account_erasure_private.coverage_registry WHERE coverage = 'VOICE' ORDER BY 1")) {
        const qualified = relation.includes('.') ? relation : `public.${relation}`;
        assert.ok(src.includes(`DELETE FROM ${qualified} `), `A11c the voice module deletes from ${qualified}`);
      }
      assert.doesNotMatch(src, /session_replication_role|DISABLE\s+TRIGGER|ALTER\s+TABLE|TRUNCATE|EXECUTE\s/iu, 'A11c no guard is bypassed');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

async function gapAfterSeal(user, recording) {
  return recordGap(user, recording, 'USER', 5000, 6000);
}
/** A note (stored), a call (one stored and one pending segment, a gap), and a voice turn with its source. */
async function voiceFootprint(user, session) {
  const note = await storedNote(user, session);
  const call = await recordingCall(user, session);
  await owner();
  const callKeys = [`voice-call/${randomUUID()}`, `voice-call/${randomUUID()}`];
  await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type, byte_size,
             clock_start_ms, clock_end_ms, upload_deadline, stored_at)
           VALUES ($1, 'USER', 0, $2, 'STORED', 'audio/ogg', 1000, 0, 1000, clock_timestamp(), clock_timestamp()),
                  ($1, 'USER', 1, $3, 'PENDING_UPLOAD', 'audio/ogg', 1000, 1500, 2500, clock_timestamp() + interval '2 minutes', NULL)`,
  [call.id, ...callKeys]);
  await q("INSERT INTO voice_private.recording_gaps (recording_id, track, clock_start_ms, clock_end_ms, gap_kind) VALUES ($1, 'USER', 1000, 1500, 'RECONNECTION')", [call.id]);
  const turn = await rawTurn(user, session);
  await plantSource(user, session, turn, note.id);
  return { recordings: [note.id, call.id], keys: [note.key, ...callKeys] };
}
async function requestDeletion(user) {
  await owner();
  const [row] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
      VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [user]);
  return row.id;
}
async function erase(deletion) {
  await asRole('service_role');
  const [{ outcome }] = await rows('SELECT public.server_erase_account_v1($1) AS outcome', [deletion]);
  await owner();
  return outcome;
}

// ------------------------------------------------------------------ PRIV-W on two connections (committed fixtures)
async function verifyConsentRaces(report, humans, versions) {
  const { q2, close } = await rt.openSecondary();
  try {
    await report.section('A8r PRIV-W ordering: a withdrawal committed first refuses a recording act; an act holding the grant first commits first', async () => {
      const [P] = humans;
      await rt.provisionHumans([P]);
      const session = await newSession(P);
      await installConsent(versions[0]);
      assert.equal(await grant(P, versions[0]), 'GRANTED');
      const call = await recordingCall(P, session);
      // 1. The withdrawal holds the grant row: the act waits, then sees the withdrawal.
      await q2('BEGIN');
      await q2('SET LOCAL ROLE service_role');
      assert.equal((await q2('SELECT * FROM public.server_revoke_voice_recording_consent_v1($1, $2)', [P, randomUUID()])).rows[0].outcome, 'WITHDRAWN');
      await q('BEGIN');
      await q('SET LOCAL ROLE service_role');
      const act = q('SELECT * FROM public.server_add_call_segment_v1($1, $2, $3, $4, $5, $6, $7, $8)', [P, call.id, 'USER', 0, 0, 1000, 1000, 30]);
      assert.equal(await rt.stillPending(act), true, 'A8r the act waits for the withdrawal');
      await q2('COMMIT');
      assert.equal((await act).rows[0].outcome, 'CONSENT_REQUIRED', 'A8r the act sees the committed withdrawal');
      await q('COMMIT');
      await owner();
      const [{ n: none }] = await rows('SELECT count(*)::int AS n FROM voice_private.recording_objects WHERE recording_id = $1', [call.id]);
      assert.equal(none, 0, 'A8r nothing was recorded');
      // 2. The act holds the grant row: the withdrawal waits and commits after it; the next act is refused.
      assert.equal(await committedGrant(P, versions[0]), 'GRANTED');
      await q2('BEGIN');
      await q2('SET LOCAL ROLE service_role');
      assert.equal((await q2('SELECT * FROM public.server_add_call_segment_v1($1, $2, $3, $4, $5, $6, $7, $8)', [P, call.id, 'USER', 0, 0, 1000, 1000, 30])).rows[0].outcome, 'ADDED');
      await q('BEGIN');
      await q('SET LOCAL ROLE service_role');
      const withdrawal = q('SELECT * FROM public.server_revoke_voice_recording_consent_v1($1, $2)', [P, randomUUID()]);
      assert.equal(await rt.stillPending(withdrawal), true, 'A8r the withdrawal waits for the act');
      await q2('COMMIT');
      assert.equal((await withdrawal).rows[0].outcome, 'WITHDRAWN');
      await q('COMMIT');
      await owner();
      await q('BEGIN');
      try {
        assert.equal(await storeSegment(P, call.id, 'USER', 0), 'CONSENT_REQUIRED', 'A8r the next act is refused');
        assert.equal(await seal(P, call.id), 'SEALED', 'A8r the seal still works');
      } finally { await q('ROLLBACK'); await owner(); }
    });
  } finally {
    await close();
    await owner();
  }
}
async function committedGrant(user, version) {
  await q('BEGIN');
  try {
    const result = await grant(user, version);
    await q('COMMIT');
    return result;
  } catch (error) { await q('ROLLBACK'); throw error; }
}
async function removeConsentRaceFixtures(humans, versions) {
  await owner();
  await q('BEGIN');
  try {
    await q("SET LOCAL session_replication_role = 'replica'");
    const recordings = 'SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])';
    await q(`DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key IN
               (SELECT storage_key FROM voice_private.recording_objects WHERE recording_id IN (${recordings}))`, [humans]);
    await q(`DELETE FROM voice_private.recording_gaps WHERE recording_id IN (${recordings})`, [humans]);
    await q(`DELETE FROM voice_private.recording_objects WHERE recording_id IN (${recordings})`, [humans]);
    await q('DELETE FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.recording_consents WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.consent_texts WHERE version = ANY($1::text[])', [versions]);
    await q("SET LOCAL session_replication_role = 'origin'");
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK');
    throw error;
  }
  await rt.removeHistoricalFixture(humans);
  await rt.removeFixtureHumans(humans);
}

// ------------------------------------------------------------------ main
if (GOLDEN_MODE) {
  runVerifier('0183 golden', async () => {
    await rt.client.connect();
    await q('BEGIN');
    try {
      const first = await textFingerprint();
      await q('ROLLBACK');
      await q('BEGIN');
      const second = await textFingerprint();
      assert.deepEqual(second.parts, first.parts, 'the fixed exchange is deterministic');
      console.log(JSON.stringify(first.parts, null, 1));
      console.log(`GOLDEN ${first.fingerprint}`);
    } finally {
      await q('ROLLBACK');
    }
  }, () => rt.client.end().catch(() => undefined));
} else {
  runVerifier('0183', async (setStage) => {
    await rt.client.connect();
    await q("SET lock_timeout = '10s'");
    await q("SET statement_timeout = '120s'");
    const report = createScenarioReport('0183', { query: q, restore: () => owner() });
    const humans = [randomUUID()];
    const versions = [`VERIFY_0183_RACE_${randomUUID().replace(/-/gu, '').slice(0, 12).toUpperCase()}`];
    setStage('catalogue');
    await verifyCatalogue(report);
    setStage('behaviour');
    await verifyBehaviour(report);
    setStage('consent races');
    try {
      await verifyConsentRaces(report, humans, versions);
    } finally {
      setStage('teardown');
      await removeConsentRaceFixtures(humans, versions);
    }
    report.print();
    report.assertAllPassed();
    const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
        + (SELECT count(*) FROM voice_private.consent_texts) + (SELECT count(*) FROM voice_private.recording_consents)
        + (SELECT count(*) FROM voice_private.recordings)
        + (SELECT count(*) FROM voice_private.voice_launch_capability_states WHERE feature_flag_state <> 'DISABLED') AS residue`, [humans]);
    assert.equal(Number(residue), 0, 'the run leaves nothing behind');
  }, () => rt.client.end().catch(() => undefined));
}
