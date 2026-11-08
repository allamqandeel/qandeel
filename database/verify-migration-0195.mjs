// Real-PostgreSQL verifier for migration 0195 (S8B-07 CP1-A, Original Audio Source Truth).
//
// The acceptance of the S8B-07 CP1-A Execution Order v1.1 §4, with the Product Owner's four mandatory corrections of the
// CP1-A authorization (2026-11-05):
//
//   S1  catalogue: one nullable text column; the binding CHECK, and the schema / medium / timing CHECKs keyed on the
//       schema (V1 exactly 0102's values, V2 the D-04 values); the truth CHECK untouched; replay_render_contract_digest_v1
//       byte-identical (body hash); every new function postgres-owned, pinned and executable by nobody but the plan read
//       (service_role); no storage key, URL, path or text anywhere in them or in the plan's columns
//   S2  D-08(a): the creator's reconciliation is the ONLY writer of an I-06D source-availability event; the sweep and the
//       deletion name no Replay; no trigger on a recording reaches a Replay (no automatic event is claimed)
//   S3  the NULL-anchor stop rule, structurally: the only writer of a NULL anchor writes it exactly when nothing was heard,
//       and then the turn's text is empty, and a unit can only be a non-empty slice of its turn's text
//   S4  every voice gate still DISABLED / UNSATISFIED, the Personal Replay gate has no open state, the file forward-only
//   B1  PO correction 1: a V2 row with a NULL binding, a V2 row with a malformed binding and a V1 row with any binding are
//       each refused by the binding CHECK (real INSERTs); a V1 row bearing audio is refused by the medium CHECK
//   B2  an all-text selection builds V1 exactly as before: NULL binding, the digest is replay_render_contract_digest_v1 of
//       its own row, no plan
//   B3  a voice note of TWO units plus text: V2, the binding is the canonical preimage recomputed here independently, both
//       units map to the ONE window of their turn (PO correction 2), the plan presents it once; retention unchanged
//   B4  a mixed text + note + call selection: overlap (MIX) and barge-in, HELD with its exact elapsed time, a recorded gap
//       clipped and never filled, CROSS_RECORDING untimed; a STORED segment wider than its window is named by its own
//       clock range, the window is the bound (PO correction 3)
//   B5  every refusal, its internal cause pinned and no contract row written: a partial turn, no anchor (the planted
//       NULL-anchor unit), a note without its duration or with another, a call window with no stored audio, a hole (a
//       discarded segment without its WRITER_LOSS gap, admitted once the gap exists), an overlap, a track / role
//       mismatch, an unreadable recording, and another human everywhere
//   B6  PO correction 4, expiry: unavailable at the instant, with no sweep and no reconciliation (no event exists); the
//       creator's reconciliation then records NOT_CURRENT; retention unchanged
//   B7  PO correction 4, early deletion and account erasure: unavailable at once with no event; reconciliation records it;
//       a preview finalized after the deletion is refused
//   B8  truth: a V2 preview whose windows moved (a new gap) finalizes as ANALYSIS_CHANGED; no hindsight once finalized
//   B9  the gate: with PERSONAL_REPLAY closed, an audio draft is not created
//   R1  two sessions: a preview holding its recording FOR SHARE serializes the owner's deletion; once deleted, the
//       finalization is refused
//
// Every scenario but R1 runs inside one transaction that is rolled back; R1 commits its fixtures and removes them
// (session_replication_role = replica, fixture surgery only). No media byte exists anywhere: objects are rows only.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import process from 'node:process';
import pg from 'pg';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { fixtureCall } from './live-call-0189-anchor.mjs';

const M0195 = '0195_s8b_07_replay_original_audio_source_truth_v1.sql';
const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, actAs } = rt;
const owner = () => asRole('postgres');

const F = Object.freeze({
  RESOLVE: 'public.replay_resolve_source_windows_v1(uuid,uuid)',
  BINDING: 'public.replay_derive_source_window_binding_v1(uuid,uuid)',
  DIGEST2: 'public.replay_render_contract_digest_v2(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,integer,integer,text)',
  PLAN: 'public.resolve_replay_version_audio_plan_v1(uuid,uuid)',
  DIGEST1: 'public.replay_render_contract_digest_v1(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,integer,integer)',
  BUILDER: 'public.build_replay_render_contract_v1(uuid,uuid,integer,uuid,timestamp with time zone)',
  TRUTH: 'public.derive_replay_version_truth_currency_v1(uuid)',
  CURRENCY: 'public.derive_replay_source_manifest_currency_v1(uuid)',
  LOCK: 'public.replay_lock_source_manifest_v1(uuid)',
});
const DIGEST1_BODY_SHA256 = '073b3faac39f67873090af74a10a3fe3e604782cf7964706aa90eecb97ab5ee4';
const NO_KEY = /storage_key|object_key|url|path|bucket|_text$|^text|transcript|content|body/u;

async function rejected(operation, codes, message = null) {
  await q('SAVEPOINT rj');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally { await q('ROLLBACK TO SAVEPOINT rj'); await q('RELEASE SAVEPOINT rj'); }
  await owner();
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.ok(codes.includes(error.code), `unexpected rejection ${error.code}: ${error.message}`);
  if (message) assert.match(`${error.message} ${error.constraint ?? ''}`, message);
  return error;
}
async function server(sql, values = []) {
  await asRole('service_role');
  const result = await rows(sql, values);
  await owner();
  return result;
}

// ------------------------------------------------------------------ fixtures (direct rows: the definers are proven by 0183 - 0192)
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
/** A STORED note; `expiresIn` (seconds) brings its 30-day expiry that close to now. */
async function noteRecording(user, session, { expiresIn = null } = {}) {
  const id = randomUUID();
  await owner();
  await q(`WITH n AS (SELECT CASE WHEN $4::integer IS NULL THEN clock_timestamp()
                                  ELSE clock_timestamp() - interval '30 days' + make_interval(secs => $4::integer) END AS t)
           INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, begin_command_id, accepted_at,
                                                 retention_expires_at, recording_state)
           SELECT $1, $2, $3, 'VOICE_NOTE', gen_random_uuid(), n.t, n.t + interval '30 days', 'STORED' FROM n`, [id, user, session, expiresIn]);
  await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state,
                                                        content_type, byte_size, upload_deadline, stored_at)
           VALUES ($1, 'NOTE', 0, $2, 'STORED', 'audio/mp4', 2048, clock_timestamp(), clock_timestamp())`, [id, `voice-note/${randomUUID()}`]);
  return id;
}
/**
 * A sealed (WRITER) call recording: `tracks` maps USER / QANDEEL to its pieces in clock order, each
 * ['S', start, end] a STORED segment, ['D', start, end] a DISCARDED one, or [GAP_KIND, start, end] a recorded gap.
 */
async function callRecording(user, session, tracks) {
  const id = randomUUID();
  await owner();
  const [{ t }] = await rows('SELECT clock_timestamp()::text AS t');
  const call = await fixtureCall(q, rows, { id: randomUUID(), user, session, startedAt: t });
  await q(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(), grace_until = NULL,
             seat_lease_until = NULL WHERE id = $1`, [call]);
  await q(`INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, retention_expires_at,
                                                 recording_state, sealed_by)
           VALUES ($1, $2, $3, 'LIVE_CALL', $4, $5::timestamptz, $5::timestamptz + interval '30 days', 'STORED', 'WRITER')`,
  [id, user, session, call, t]);
  for (const [track, pieces] of Object.entries(tracks)) {
    let index = 0;
    for (const [kind, start, end] of pieces) {
      if (kind === 'S' || kind === 'D') {
        await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type,
                   byte_size, clock_start_ms, clock_end_ms, upload_deadline, stored_at)
                 VALUES ($1, $2, $3, $4, $5, 'audio/ogg', 1000, $6, $7, clock_timestamp(), CASE WHEN $5 = 'STORED' THEN clock_timestamp() END)`,
        [id, track, index, `voice-call/${randomUUID()}`, kind === 'S' ? 'STORED' : 'DISCARDED', start, end]);
        index += 1;
      } else {
        await addGap(id, track, start, end, kind);
      }
    }
  }
  return id;
}
const addGap = (recording, track, start, end, kind) => q(`INSERT INTO voice_private.recording_gaps (recording_id, track, clock_start_ms,
    clock_end_ms, gap_kind) VALUES ($1, $2, $3, $4, $5)`, [recording, track, start, end, kind]);

/**
 * One conversation of whole messages: each turn { role, units, voice: { recording, modality, a, b, delivery }, duration }.
 * A voice source is written before its units (as attach requires); a note's recorded duration after its turn.
 */
async function conversation(user, session, turns) {
  await owner();
  let sp = Number((await rows('SELECT coalesce((SELECT current_sp FROM public.session_semantic_clocks WHERE session_id = $1), 0) AS sp',
    [session]))[0].sp);
  const out = [];
  for (const [t, turn] of turns.entries()) {
    const id = randomUUID();
    const batch = randomUUID();
    const content = `message ${t + 1}`;
    await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
             VALUES ($1, $2, $3, $4, 'COMPLETED', $5)`, [id, session, user, turn.role, content]);
    await q(`INSERT INTO public.conversation_unit_commit_batches (id, user_id, session_id, source_turn_id, canonical_fingerprint,
               source_content_sha256, unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
               segmentation_prompt_version)
             VALUES ($1, $2, $3, $4, sha256($5::bytea), sha256($5::bytea), $6, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
    [batch, user, session, id, Buffer.from(`${session}:${id}`), turn.units]);
    const v = turn.voice;
    if (v) {
      const assistant = turn.role === 'ASSISTANT';
      await q(`INSERT INTO public.conversation_turn_voice_sources
                 (turn_id, user_id, session_id, source_role, source_modality, transcript_origin, asr_confidence_band, recording_id,
                  anchor_start_ms, anchor_end_ms, spoken, delivery_state)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, user, session, turn.role, v.modality, assistant ? null : 'MACHINE_ASR', assistant ? null : 'HIGH', v.recording,
        v.a, v.b, assistant ? true : null, assistant ? (v.delivery ?? 'COMPLETE') : null]);
      if (turn.duration !== undefined) {
        await q(`INSERT INTO voice_private.note_transcriptions (recording_id, user_id, session_id, state, duration_ms, committed_turn_id)
                 VALUES ($1, $2, $3, 'COMMITTED', $4, $5)`, [v.recording, user, session, turn.duration, id]);
      }
    }
    const sps = [];
    for (let u = 0; u < turn.units; u += 1) {
      sp += 1;
      const body = `${content}, sentence ${u + 1}`;
      await q(`INSERT INTO public.conversation_units (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
                 source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'RESOLVED', $6, $7, 0, $8, $9, sha256(convert_to($9, 'UTF8')), $10)`,
      [user, session, id, batch, turn.role, v ? v.modality : 'TEXT', u, [...body].length, body, sp]);
      sps.push(sp);
    }
    out.push({ id, sps, units: turn.units, voice: v ?? null });
  }
  await q('UPDATE public.session_semantic_clocks SET current_sp = $2 WHERE session_id = $1', [session, sp]);
  return out;
}
/** Plus one trailing text turn, so every selected position is SEALED (the projection reads sealed moments only). */
const withTail = (turns) => [...turns, { role: turns.length % 2 === 0 ? 'USER' : 'ASSISTANT', units: 1 }];

async function latestSpec(replay) {
  await owner();
  return (await rows(`SELECT sp.id FROM public.replay_selection_spec_versions sp WHERE sp.replay_id = $1
                       ORDER BY sp.selection_revision DESC LIMIT 1`, [replay]))[0].id;
}
async function bindingOf(spec, user) {
  await owner();
  const [b] = await rows('SELECT * FROM public.replay_derive_source_window_binding_v1($1, $2)', [spec, user]);
  return b;
}
async function contractOf(version) {
  await owner();
  return (await rows(`SELECT c.* FROM public.replay_versions v JOIN public.replay_render_contract_versions c ON c.id = v.render_contract_version_id
                       WHERE v.id = $1`, [version]))[0];
}
async function contractCount(replay) {
  await owner();
  return Number((await rows('SELECT count(*) n FROM public.replay_render_contract_versions WHERE replay_id = $1', [replay]))[0].n);
}
const plan = (user, version) => server('SELECT * FROM public.resolve_replay_version_audio_plan_v1($1, $2)', [user, version]);
async function availability(replay, version) {
  await owner();
  return (await rows('SELECT * FROM public.derive_replay_version_current_availability_v1($1, $2)', [replay, version]))[0].availability_state;
}
async function events(version) {
  await owner();
  return rows('SELECT observed_availability_state FROM public.replay_source_availability_reconciliation_events WHERE replay_version_id = $1', [version]);
}
/** The truth revalidation as the creator meets it (the historical projection is read as the asking human). */
async function truthOf(user, version) {
  await actAs(user);
  const [t] = await rows('SELECT * FROM public.derive_replay_version_truth_currency_v1($1)', [version]);
  await owner();
  return t;
}
async function recordingRow(id) {
  await owner();
  return (await rows('SELECT recording_state, retention_expires_at::text AS expires FROM voice_private.recordings WHERE id = $1', [id]))[0];
}
async function reconcile(user, replay, version) {
  await actAs(user);
  const [r] = await rows('SELECT * FROM public.reconcile_replay_post_finalization_state_v1($1, $2, $3, NULL)', [randomUUID(), replay, version]);
  await owner();
  return r;
}

/** A draft of [first, last], previewed, and (when asked) finalized, through the 0169 wrappers. */
async function replayOf(user, session, first, last, { finalize = false } = {}) {
  const created = await rt.create(user, randomUUID(), session, first, last);
  assert.equal(created.outcome, 'CREATED', `fixture: the draft is created (${created.outcome})`);
  const previewed = await rt.preview(user, randomUUID(), created.replay_id, created.draft_revision);
  const result = { replay: created.replay_id, created, previewed, version: previewed.replay_version_id };
  if (finalize && previewed.outcome === 'PREVIEW_READY') {
    result.finalized = await rt.finalize(user, randomUUID(), created.replay_id, previewed.replay_version_id);
  }
  return result;
}

/** The binding digest, recomputed here from first principles (package v1.1 §C.3.1 step 3). */
function expectedBinding(spec, items, windows) {
  const lines = ['QANDEEL_REPLAY_SOURCE_WINDOW_BINDING_V1', `selection=${spec}`, `items=${items.length}`];
  for (const [ord, k] of items) lines.push(`i|${ord}|${k ? `W${k}` : 'TEXT'}`);
  lines.push(`windows=${windows.length}`);
  for (const [i, w] of windows.entries()) {
    const k = i + 1;
    lines.push(`W${k}|turn=${w.turn}|units=${w.units}|recording=${w.recording}|kind=${w.kind}|track=${w.track}|start=${w.a}|end=${w.b}`);
    for (const [idx, cs, ce] of w.segments) lines.push(cs === null ? `W${k}|s|${idx}|NOTE` : `W${k}|s|${idx}|${cs}|${ce}`);
    for (const [kind, cs, ce] of w.gaps ?? []) lines.push(`W${k}|g|${kind}|${cs}|${ce}`);
  }
  return `sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`;
}
const planShape = (planRows) => planRows.map((r) => [r.entry_ordinal, r.row_kind, r.window_ordinal, r.selected_ordinal,
  r.recording_id, r.track, r.clock_start_ms === null ? null : Number(r.clock_start_ms), r.clock_end_ms === null ? null : Number(r.clock_end_ms),
  r.elapsed_ms === null ? null : Number(r.elapsed_ms), r.gap_kind, r.boundary_kind]);

// ------------------------------------------------------------------ catalogue
async function verifyCatalogue(report) {
  await report.section('S1a the render contract: one nullable text column, the keyed CHECKs, the truth CHECK untouched', async () => {
    await owner();
    const cols = await rows(`SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull, a.atthasdef
                               FROM pg_attribute a WHERE a.attrelid = 'public.replay_render_contract_versions'::regclass
                                AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`);
    assert.equal(cols.length, 24, 'exactly one column is added');
    assert.deepEqual(cols.at(-1), { attname: 'source_window_binding_digest', type: 'text', attnotnull: false, atthasdef: false });
    const defs = Object.fromEntries((await rows(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'public.replay_render_contract_versions'::regclass AND contype = 'c'`)).map((r) => [r.conname, r.def]));
    const binding = defs.replay_render_contract_versions_window_binding_check;
    assert.ok(binding, 'the binding CHECK exists');
    assert.match(binding, /'QANDEEL_REPLAY_RENDER_CONTRACT_V1'::text\) AND \(source_window_binding_digest IS NULL\)/u, 'V1 binds nothing');
    assert.match(binding, /'QANDEEL_REPLAY_RENDER_CONTRACT_V2'::text\) AND \(source_window_binding_digest IS NOT NULL\) AND \(source_window_binding_digest ~ '\^sha256:\[0-9a-f\]\{64\}\$'::text\)/u,
      'PO correction 1: the V2 branch states IS NOT NULL as well as the pattern');
    for (const [name, v1, v2] of [
      ['medium', ["'ORIGINAL_TEXT_ONLY'", "'PRESERVE_ORIGINAL_MEDIUM_ONLY'", "'EXACT_SOURCE_TEXT'::text"],
        ["'ORIGINAL_MEDIA_PRESERVED'", "'PRESERVE_ORIGINAL_MEDIUM_ONLY'", "'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED'"]],
      ['timing', ["'PRESENTATION_PACING_DECLARED'"], ["'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING'"]],
    ]) {
      const def = defs[`replay_render_contract_versions_${name}_check`];
      const [left, right] = def.split("'QANDEEL_REPLAY_RENDER_CONTRACT_V2'");
      assert.ok(left.includes("'QANDEEL_REPLAY_RENDER_CONTRACT_V1'") && right, `${name}: keyed on the schema`);
      for (const value of v1) assert.ok(left.includes(value), `${name}: the V1 branch keeps ${value}`);
      for (const value of v2) assert.ok(right.includes(value), `${name}: the V2 branch is ${value}`);
    }
    assert.match(defs.replay_render_contract_versions_schema_check, /QANDEEL_REPLAY_RENDER_CONTRACT_V1.*QANDEEL_REPLAY_RENDER_CONTRACT_V2/u);
    assert.doesNotMatch(defs.replay_render_contract_versions_truth_check, /contract_schema_id|V2/u, 'the truth CHECK is not keyed');
    assert.match(defs.replay_render_contract_versions_truth_check, /WHOLE_ITEM_ONLY_PROVEN_SAFE/u);
    const fks = await rows(`SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_class p ON p.oid = c.confrelid JOIN pg_namespace pn ON pn.oid = p.relnamespace
       WHERE c.contype = 'f' AND n.nspname = 'public' AND t.relname LIKE 'replay\\_%' AND pn.nspname = 'voice_private'`);
    assert.deepEqual(fks, [], 'no Replay relation binds voice_private');
  });

  await report.section('S1b the functions: digest_v1 byte-identical; postures; grants; no key, URL, path or text anywhere', async () => {
    await owner();
    const [{ hash, volatile }] = await rows(`SELECT encode(sha256(convert_to(replace(prosrc, chr(13), ''), 'UTF8')), 'hex') AS hash,
        provolatile AS volatile FROM pg_proc WHERE oid = $1::regprocedure`, [F.DIGEST1]);
    assert.equal(hash, DIGEST1_BODY_SHA256, 'replay_render_contract_digest_v1 is byte-identical to 0103');
    assert.equal(volatile, 'i');
    for (const fn of [F.RESOLVE, F.BINDING, F.DIGEST2, F.PLAN]) {
      const p = await rt.functionPosture(fn);
      const [{ owner: who, vol, config }] = await rows(`SELECT pg_get_userbyid(proowner) AS owner, provolatile AS vol, proconfig AS config
          FROM pg_proc WHERE oid = $1::regprocedure`, [fn]);
      assert.equal(who, 'postgres', `${fn} is postgres-owned`);
      assert.ok((config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'), `${fn} pins search_path`);
      assert.equal(vol, fn === F.DIGEST2 ? 'i' : 's', `${fn} volatility`);
      if (fn !== F.DIGEST2) assert.equal(p.secdef, true, `${fn} is SECURITY DEFINER`);
      assert.doesNotMatch(p.prosrc, /storage_key|INSERT INTO|DELETE FROM|UPDATE (public|voice_private)\.|retention_expires_at|auth\.uid|pg_advisory/u,
        `${fn} reads no key, writes nothing, touches no retention, asks no session`);
      for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
        assert.equal(await rt.canExecute(role, fn), role === 'service_role' && fn === F.PLAN, `${role} on ${fn}`);
      }
    }
    for (const fn of [F.BUILDER, F.TRUTH, F.CURRENCY, F.LOCK]) {
      for (const role of ['public', 'anon', 'authenticated', 'service_role']) assert.equal(await rt.canExecute(role, fn), false, `${role} on ${fn}`);
    }
    const planCols = await rows(`SELECT unnest(proargnames[3:]) AS name FROM pg_proc WHERE oid = $1::regprocedure`, [F.PLAN]);
    assert.ok(planCols.length === 11, 'the plan returns eleven columns');
    for (const { name } of planCols) assert.doesNotMatch(name, NO_KEY, `the plan column ${name} names no key, URL, path or text`);
    // R05 of verify-0155: the source currency has exactly its consumers; the plan asks the ONE availability derivation.
    const plan = await rt.functionPosture(F.PLAN);
    assert.doesNotMatch(plan.prosrc, /derive_replay_source_manifest_currency_v1\(/u, 'the plan never calls the source currency directly');
    assert.match(plan.prosrc, /derive_replay_version_current_availability_v1\(/u);
    const truth = await rt.functionPosture(F.TRUTH);
    assert.equal((await rows('SELECT provolatile v FROM pg_proc WHERE oid = $1::regprocedure', [F.TRUTH]))[0].v, 's', 'truth stays STABLE');
    assert.doesNotMatch(truth.prosrc, /INSERT INTO|UPDATE public|DELETE FROM/u);
    const lock = await rt.functionPosture(F.LOCK);
    assert.match(lock.prosrc, /FROM voice_private\.recordings rec[\s\S]*ORDER BY rec\.id FOR SHARE;/u, 'the lock takes the bound recordings FOR SHARE');
    assert.doesNotMatch(lock.prosrc, /pg_advisory|LOCK TABLE|clock_timestamp/u);
  });

  await report.section('S2 D-08(a): the creator\'s reconciliation is the only I-06D writer; expiry and deletion write no event', async () => {
    await owner();
    const writers = await rows(`SELECT p.oid::regprocedure::text AS sig FROM pg_proc p
        WHERE p.prosrc ~ 'INSERT INTO public\\.replay_source_availability_reconciliation_events'`);
    assert.deepEqual(writers.map((w) => w.sig), ['reconcile_replay_post_finalization_state_v1(uuid,uuid,uuid,uuid)'], 'exactly one writer');
    const reconcileBody = (await rt.functionPosture('public.reconcile_replay_post_finalization_state_v1(uuid,uuid,uuid,uuid)')).prosrc;
    assert.match(reconcileBody, /u uuid := auth\.uid\(\)/u, 'it is the creator\'s own act');
    for (const fn of ['public.server_sweep_voice_recordings_v1(integer)', 'public.server_delete_voice_recording_v1(uuid,uuid)']) {
      const [{ src }] = await rows(`SELECT string_agg(p.prosrc, E'\\n') AS src FROM pg_proc p WHERE p.oid::regprocedure::text LIKE $1`,
        [`${fn.replace(/^public\./u, '').replace(/\(.*$/u, '')}(%`]);
      assert.ok(src, `${fn} exists`);
      assert.doesNotMatch(src, /replay/iu, `${fn} names no Replay: it writes no I-06D event`);
    }
    const triggers = await rows(`SELECT t.tgname FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgrelid IN ('voice_private.recordings'::regclass, 'voice_private.recording_objects'::regclass) AND p.prosrc ~* 'replay'`);
    assert.deepEqual(triggers, [], 'no recording trigger reaches a Replay: no automatic event exists');
  });

  await report.section('S3 the NULL-anchor stop rule is structurally unreachable: no unit can stand on a turn of which nothing was heard', async () => {
    await owner();
    const writers = await rows(`SELECT p.oid::regprocedure::text AS sig, p.prosrc FROM pg_proc p
        WHERE p.prosrc LIKE '%INSERT INTO public.conversation_turn_voice_sources%'`);
    const nullable = writers.filter((w) => !/p_anchor_start_ms IS NULL OR p_anchor_end_ms IS NULL/u.test(w.prosrc)
      && !/anchor_start_ms, anchor_end_ms[^;]*VALUES[^;]*0, v_duration/su.test(w.prosrc));
    for (const w of nullable) {
      if (!/'ASSISTANT'/u.test(w.prosrc)) continue;
      assert.match(w.prosrc, /IF v_mark > 0 THEN\s+v_start := v_ex\.reply_clock_start_ms;\s+v_end := v_ex\.reply_clock_start_ms \+ v_mark;/u,
        `${w.sig}: the anchor is written exactly when something was heard`);
      assert.match(w.prosrc, /s\.end_offset_ms <= v_mark;/u, `${w.sig}: the text is the segments heard by the mark`);
    }
    assert.ok(nullable.some((w) => w.sig.startsWith('voice_private.close_call_exchange_core_v1')), 'the close core is the NULL-anchor writer');
    const [{ seg }] = await rows("SELECT pg_get_constraintdef(oid) AS seg FROM pg_constraint WHERE conname = 'call_reply_segments_shape_check'");
    assert.match(seg, /\(start_offset_ms >= 0\) AND \(end_offset_ms > start_offset_ms\)/u, 'no segment ends at or before 0: nothing heard is empty text');
    const [{ span }] = await rows("SELECT pg_get_constraintdef(oid) AS span FROM pg_constraint WHERE conname = 'conversation_units_span_check'");
    assert.match(span, /source_span_end > source_span_start/u, 'a unit is a non-empty span');
    const unitWriters = await rows(`SELECT p.oid::regprocedure::text AS sig, p.prosrc FROM pg_proc p
        WHERE p.prosrc ~ 'INSERT INTO public\\.conversation_units\\s*\\('`);
    assert.ok(unitWriters.length > 0);
    for (const w of unitWriters) {
      assert.match(w.prosrc, /substring\(turn_row\.content from/u, `${w.sig} slices a unit from its turn's text`);
      assert.match(w.prosrc, /source_length/u, `${w.sig} bounds a span by the turn's length`);
    }
  });

  await report.section('S4 every gate closed; the migration is forward-only, one transaction, grants nothing to a client', async () => {
    await owner();
    const voice = await rows('SELECT feature_flag_state, launch_requirements_state FROM voice_private.voice_launch_capability_states');
    assert.equal(voice.length, 4);
    assert.ok(voice.every((s) => s.feature_flag_state === 'DISABLED' && s.launch_requirements_state === 'UNSATISFIED'), 'every voice scope DISABLED');
    const replay = await rows("SELECT 1 FROM replay_private.replay_launch_capability_states WHERE feature_flag_state <> 'DISABLED' OR launch_requirements_state <> 'UNSATISFIED'");
    assert.deepEqual(replay, [], 'no open Personal Replay gate');
    const files = readdirSync(new URL('./migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
    // RE-ANCHORED by S8B-07 CP1-B (was: 0195 is the last migration; the Product Owner's CP1-B execution authorization, a
    // declared re-anchor): exactly 0196, the transient media authority, follows 0195 and nothing else does (verify-migration-0196).
    assert.equal(files.at(-2), M0195, '0195 is followed only by 0196');
    assert.equal(files.at(-1), '0196_s8b_07_transient_media_v1.sql', 'exactly 0196 follows 0195');
    const sql = readFileSync(new URL(`./migrations/${M0195}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
    const code = sql.replace(/^\s*--.*$/gmu, '').replace(/\$\$[\s\S]*?\$\$/gu, '$$$$');
    assert.equal((code.match(/^BEGIN;$/gmu) ?? []).length, 1);
    assert.equal((code.match(/^COMMIT;$/gmu) ?? []).length, 1);
    assert.doesNotMatch(code, /GRANT [^;]*TO (?:anon|authenticated|PUBLIC)\b/u, 'no client role is granted anything');
    assert.doesNotMatch(code, /INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE/u, 'no row is written, backfilled or removed');
    assert.doesNotMatch(sql, /set_voice_launch_capability_v1\(|set_replay_launch_capability_v1\(/u, 'no gate is set');
    const [{ n }] = await rows('SELECT count(*)::int n FROM public.replay_render_contract_versions WHERE source_window_binding_digest IS NOT NULL');
    assert.ok(n >= 0);
  });
}

// ------------------------------------------------------------------ the rolled-back behaviour
async function verifyBehaviour(report) {
  await owner();
  await q('BEGIN');
  try {
    await report.isolated('B1 PO correction 1: V2 with NULL, V2 malformed and V1 with any binding are refused by the CHECK', async () => {
      const A = await human();
      const session = await newSession(A);
      await conversation(A, session, withTail([{ role: 'USER', units: 1 }, { role: 'ASSISTANT', units: 1 }]));
      await rt.setGate();
      const text = await replayOf(A, session, 1, 2, { finalize: true });
      assert.equal(text.finalized.outcome, 'FINALIZED');
      const base = await contractOf(text.version);
      const V2 = { contract_schema_id: 'QANDEEL_REPLAY_RENDER_CONTRACT_V2', source_medium_class: 'ORIGINAL_MEDIA_PRESERVED',
        source_text_policy: 'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED', timing_integrity_policy: 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING' };
      const insert = (patch) => q(`INSERT INTO public.replay_render_contract_versions
          SELECT (jsonb_populate_record(c, $2::jsonb)).* FROM public.replay_render_contract_versions c WHERE c.id = $1`,
      [base.id, JSON.stringify({ id: randomUUID(), contract_revision: 50 + Math.floor(Math.random() * 1000), ...patch })]);
      const good = `sha256:${'a'.repeat(64)}`;
      const refusal = async (patch, constraint, label) => {
        const error = await rejected(() => insert(patch), ['23514']);
        assert.equal(error.constraint, constraint, `${label} (${error.constraint})`);
      };
      await refusal({ ...V2, source_window_binding_digest: null }, 'replay_render_contract_versions_window_binding_check', 'V2 with a NULL binding');
      for (const bad of ['sha256:', `sha256:${'A'.repeat(64)}`, `sha256:${'a'.repeat(63)}`, `${'a'.repeat(64)}`, `sha256:${'a'.repeat(64)}\n`, '']) {
        await refusal({ ...V2, source_window_binding_digest: bad }, 'replay_render_contract_versions_window_binding_check', `V2 with ${JSON.stringify(bad)}`);
      }
      await refusal({ source_window_binding_digest: good }, 'replay_render_contract_versions_window_binding_check', 'V1 with a binding');
      await refusal({ source_medium_class: 'ORIGINAL_MEDIA_PRESERVED' }, 'replay_render_contract_versions_medium_check', 'a V1 row bearing audio');
      await refusal({ ...V2, timing_integrity_policy: 'PRESENTATION_PACING_DECLARED', source_window_binding_digest: good },
        'replay_render_contract_versions_timing_check', 'V2 with V1 pacing');
      await refusal({ ...V2, source_text_policy: 'EXACT_SOURCE_TEXT', source_window_binding_digest: good },
        'replay_render_contract_versions_medium_check', 'V2 claiming exact source text for audio');
      const unknown = await rejected(() => insert({ contract_schema_id: 'QANDEEL_REPLAY_RENDER_CONTRACT_V3' }), ['23514']);
      assert.match(unknown.constraint, /^replay_render_contract_versions_(schema|medium|timing|window_binding)_check$/u, 'an unknown schema is refused');
      await q('SAVEPOINT ok');
      await insert({ ...V2, source_window_binding_digest: good });
      await q('ROLLBACK TO SAVEPOINT ok');
    });

    await report.isolated('B2 an all-text selection builds V1 exactly as before: no binding, the V1 digest of its own row, no plan', async () => {
      const A = await human();
      const session = await newSession(A);
      await conversation(A, session, withTail([{ role: 'USER', units: 2 }, { role: 'ASSISTANT', units: 1 }]));
      await rt.setGate();
      const text = await replayOf(A, session, 1, 3, { finalize: true });
      assert.equal(text.finalized.outcome, 'FINALIZED');
      const c = await contractOf(text.version);
      assert.equal(c.contract_schema_id, 'QANDEEL_REPLAY_RENDER_CONTRACT_V1');
      assert.equal(c.source_medium_class, 'ORIGINAL_TEXT_ONLY');
      assert.equal(c.timing_integrity_policy, 'PRESENTATION_PACING_DECLARED');
      assert.equal(c.source_window_binding_digest, null, 'a V1 row binds nothing');
      const [{ golden }] = await rows(`SELECT public.replay_render_contract_digest_v1(c.replay_id, c.source_manifest_version_id,
          c.selection_spec_version_id, c.analytical_projection_version_id, p.projection_digest, c.contract_schema_id, c.source_medium_class,
          c.original_medium_policy, c.source_text_policy, c.semantic_cut_policy, c.temporal_discontinuity_policy, c.timing_integrity_policy,
          c.analytical_projection_policy, c.camera_emphasis_policy, c.motion_policy, c.caption_provenance_policy,
          c.accessibility_parity_policy, c.reduced_motion_parity_policy, c.editorial_annotation_policy, c.discontinuity_count,
          p.point_count) AS golden
          FROM public.replay_render_contract_versions c JOIN public.replay_analytical_projection_versions p ON p.id = c.analytical_projection_version_id
         WHERE c.id = $1`, [c.id]);
      assert.equal(c.contract_digest, golden, 'the V1 digest is digest_v1 of its own row (digest_v1 byte-identical, S1b)');
      assert.deepEqual(await plan(A, text.version), [], 'a V1 version has no audio plan');
      const truth = await truthOf(A, text.version);
      assert.equal(truth.currency_state, 'CURRENT', JSON.stringify(truth));
    });

    await report.isolated('B3 a note of TWO units plus text: V2 bound to the ONE window of the turn, the binding recomputed here; retention unchanged', async () => {
      const A = await human();
      const session = await newSession(A);
      const note = await noteRecording(A, session);
      const before = await recordingRow(note);
      const turns = await conversation(A, session, withTail([
        { role: 'USER', units: 2, voice: { recording: note, modality: 'VOICE_NOTE', a: 0, b: 4200 }, duration: 4200 },
        { role: 'ASSISTANT', units: 2 }]));
      await rt.setGate();
      const r = await replayOf(A, session, 1, 4, { finalize: true });
      assert.equal(r.previewed.outcome, 'PREVIEW_READY', `the audio draft previews (${r.previewed.outcome})`);
      assert.equal(r.finalized.outcome, 'FINALIZED', `and finalizes (${r.finalized.outcome})`);
      const c = await contractOf(r.version);
      assert.deepEqual([c.contract_schema_id, c.source_medium_class, c.original_medium_policy, c.source_text_policy, c.timing_integrity_policy],
        ['QANDEEL_REPLAY_RENDER_CONTRACT_V2', 'ORIGINAL_MEDIA_PRESERVED', 'PRESERVE_ORIGINAL_MEDIUM_ONLY',
          'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED', 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING'], 'the D-04 values');
      const spec = c.selection_spec_version_id;
      const expected = expectedBinding(spec, [[1, 1], [2, 1], [3, null], [4, null]],
        [{ turn: turns[0].id, units: 2, recording: note, kind: 'VOICE_NOTE', track: 'NOTE', a: 0, b: 4200, segments: [[0, null, null]] }]);
      assert.equal(c.source_window_binding_digest, expected, 'the stored binding is the canonical preimage, recomputed independently');
      const [{ v2 }] = await rows(`SELECT public.replay_render_contract_digest_v2(c.replay_id, c.source_manifest_version_id,
          c.selection_spec_version_id, c.analytical_projection_version_id, p.projection_digest, c.contract_schema_id, c.source_medium_class,
          c.original_medium_policy, c.source_text_policy, c.semantic_cut_policy, c.temporal_discontinuity_policy, c.timing_integrity_policy,
          c.analytical_projection_policy, c.camera_emphasis_policy, c.motion_policy, c.caption_provenance_policy,
          c.accessibility_parity_policy, c.reduced_motion_parity_policy, c.editorial_annotation_policy, c.discontinuity_count,
          p.point_count, $2) AS v2
          FROM public.replay_render_contract_versions c JOIN public.replay_analytical_projection_versions p ON p.id = c.analytical_projection_version_id
         WHERE c.id = $1`, [c.id, expected]);
      assert.equal(c.contract_digest, v2, 'the V2 digest commits the binding');
      const p = await plan(A, r.version);
      assert.deepEqual(planShape(p), [
        [1, 'RUN', null, null, note, null, 0, 4200, null, null, null],
        [1, 'ITEM', 1, 1, null, null, null, null, null, null, null],
        [1, 'ITEM', 1, 2, null, null, null, null, null, null, null],
        [1, 'WINDOW', 1, null, note, 'NOTE', 0, 4200, null, null, null],
        [1, 'AUDIBLE', null, null, null, 'NOTE', 0, 4200, null, null, null],
        [2, 'TEXT', null, 3, null, null, null, null, null, null, null],
        [3, 'TEXT', null, 4, null, null, null, null, null, null, null],
      ], 'PO correction 2: both units map to the ONE window, presented once; no time is given to a unit inside the turn');
      const flat = JSON.stringify(p);
      assert.doesNotMatch(flat, /voice-(note|call)\//u, 'the plan carries no storage key');
      assert.deepEqual(await recordingRow(note), before, 'retention is unchanged by preview and finalization');
      const truth = await truthOf(A, r.version);
      assert.equal(truth.currency_state, 'CURRENT', JSON.stringify(truth));
      assert.equal(await availability(r.replay, r.version), 'CURRENT');
    });

    await report.isolated('B4 text + note + call: MIX, barge-in, HELD elapsed, a clipped gap never filled, CROSS_RECORDING untimed, a wider segment', async () => {
      const A = await human();
      const session = await newSession(A);
      const note = await noteRecording(A, session);
      const call = await callRecording(A, session, {
        USER: [['S', 0, 6500], ['MUTED', 6500, 7000], ['S', 7000, 10000]],
        QANDEEL: [['NOT_SPEAKING', 0, 2000], ['S', 2000, 6000]],
      });
      const turns = await conversation(A, session, withTail([
        { role: 'USER', units: 1, voice: { recording: note, modality: 'VOICE_NOTE', a: 0, b: 3000 }, duration: 3000 },
        { role: 'ASSISTANT', units: 1 },
        { role: 'USER', units: 1, voice: { recording: call, modality: 'LIVE_CALL_SPEECH', a: 1000, b: 3000 } },
        { role: 'ASSISTANT', units: 2, voice: { recording: call, modality: 'LIVE_CALL_SPEECH', a: 2500, b: 5000, delivery: 'INTERRUPTED' } },
        { role: 'USER', units: 1, voice: { recording: call, modality: 'LIVE_CALL_SPEECH', a: 6000, b: 8000 } }]));
      await rt.setGate();
      const r = await replayOf(A, session, 1, 6, { finalize: true });
      assert.equal(r.previewed.outcome, 'PREVIEW_READY', `the mixed draft previews (${r.previewed.outcome})`);
      assert.equal(r.finalized.outcome, 'FINALIZED');
      const c = await contractOf(r.version);
      const expected = expectedBinding(c.selection_spec_version_id, [[1, 1], [2, null], [3, 2], [4, 3], [5, 3], [6, 4]], [
        { turn: turns[0].id, units: 1, recording: note, kind: 'VOICE_NOTE', track: 'NOTE', a: 0, b: 3000, segments: [[0, null, null]] },
        { turn: turns[2].id, units: 1, recording: call, kind: 'LIVE_CALL', track: 'USER', a: 1000, b: 3000, segments: [[0, 0, 6500]] },
        { turn: turns[3].id, units: 2, recording: call, kind: 'LIVE_CALL', track: 'QANDEEL', a: 2500, b: 5000, segments: [[0, 2000, 6000]] },
        { turn: turns[4].id, units: 1, recording: call, kind: 'LIVE_CALL', track: 'USER', a: 6000, b: 8000,
          segments: [[0, 0, 6500], [1, 7000, 10000]], gaps: [['MUTED', 6500, 7000]] },
      ]);
      assert.equal(c.source_window_binding_digest, expected, 'PO correction 3: a segment wider than its window is named by its own range');
      assert.deepEqual(planShape(await plan(A, r.version)), [
        [1, 'RUN', null, null, note, null, 0, 3000, null, null, null],
        [1, 'ITEM', 1, 1, null, null, null, null, null, null, null],
        [1, 'WINDOW', 1, null, note, 'NOTE', 0, 3000, null, null, null],
        [1, 'AUDIBLE', null, null, null, 'NOTE', 0, 3000, null, null, null],
        [2, 'TEXT', null, 2, null, null, null, null, null, null, null],
        [3, 'BOUNDARY', null, null, null, null, null, null, null, null, 'CROSS_RECORDING'],
        [4, 'RUN', null, null, call, null, 1000, 8000, null, null, null],
        [4, 'ITEM', 2, 3, null, null, null, null, null, null, null],
        [4, 'ITEM', 3, 4, null, null, null, null, null, null, null],
        [4, 'ITEM', 3, 5, null, null, null, null, null, null, null],
        [4, 'ITEM', 4, 6, null, null, null, null, null, null, null],
        [4, 'WINDOW', 2, null, call, 'USER', 1000, 3000, null, null, null],
        [4, 'WINDOW', 3, null, call, 'QANDEEL', 2500, 5000, null, null, null],
        [4, 'WINDOW', 4, null, call, 'USER', 6000, 8000, null, null, null],
        [4, 'AUDIBLE', null, null, null, 'USER', 1000, 3000, null, null, null],
        [4, 'AUDIBLE', null, null, null, 'QANDEEL', 2500, 5000, null, null, null],
        [4, 'AUDIBLE', null, null, null, 'USER', 6000, 8000, null, null, null],
        [4, 'MIX', null, null, null, null, 2500, 3000, null, null, null],
        [4, 'HELD', null, null, null, null, 5000, 6000, 1000, null, null],
        [4, 'GAP', 4, null, null, 'USER', 6500, 7000, null, 'MUTED', null],
      ], 'L-1..L-5, L-7: each track only inside its windows; overlap mixed; held time exact; the gap kept; different clocks untimed');
    });

    await report.isolated('B4b a recorded gap at a window edge is clipped to the window; SAME_RECORDING across text keeps its elapsed time', async () => {
      const A = await human();
      const session = await newSession(A);
      const call = await callRecording(A, session, { USER: [['S', 0, 2000], ['RECONNECTION', 2000, 4000], ['S', 4000, 9000]] });
      await conversation(A, session, withTail([
        { role: 'USER', units: 1, voice: { recording: call, modality: 'LIVE_CALL_SPEECH', a: 1000, b: 3000 } },
        { role: 'ASSISTANT', units: 1 },
        { role: 'USER', units: 1, voice: { recording: call, modality: 'LIVE_CALL_SPEECH', a: 6000, b: 7000 } }]));
      await rt.setGate();
      const r = await replayOf(A, session, 1, 3);
      assert.equal(r.previewed.outcome, 'PREVIEW_READY', r.previewed.outcome);
      const previewPlan = await plan(A, r.version);
      const f = await rt.finalize(A, randomUUID(), r.replay, r.version);
      assert.equal(f.outcome, 'FINALIZED');
      assert.deepEqual(await plan(A, r.version), previewPlan, 'finalization changes nothing the plan derives');
      assert.deepEqual(planShape(await plan(A, r.version)).filter(([, kind]) => ['GAP', 'BOUNDARY', 'TEXT'].includes(kind)), [
        [1, 'GAP', 1, null, null, 'USER', 2000, 3000, null, 'RECONNECTION', null],
        [2, 'TEXT', null, 2, null, null, null, null, null, null, null],
        [3, 'BOUNDARY', null, null, null, null, null, null, 3000, null, 'SAME_RECORDING'],
      ], 'the gap is clipped to [start, end) of its window; one recording keeps one clock');
    });

    await report.isolated('B5 every refusal names its cause, writes no contract row, and the wrapper answers one bounded word', async () => {
      const A = await human();
      const B = await human();
      const session = await newSession(A);
      const noDuration = await noteRecording(A, session);
      const otherDuration = await noteRecording(A, session);
      const hole = await callRecording(A, session, { USER: [['S', 0, 1000], ['D', 1000, 2000], ['S', 2000, 3000]] });
      const overlap = await callRecording(A, session, { USER: [['S', 0, 1000], ['MUTED', 500, 1500], ['S', 1500, 3000]] });
      const silent = await callRecording(A, session, { USER: [['S', 0, 1000], ['MUTED', 1000, 5000]], QANDEEL: [['S', 0, 400]] });
      const callForNote = await callRecording(A, session, { USER: [['S', 0, 5000]] });
      const turns = await conversation(A, session, withTail([
        { role: 'USER', units: 2, voice: { recording: noDuration, modality: 'VOICE_NOTE', a: 0, b: 4200 } },          // sp 1-2
        { role: 'ASSISTANT', units: 1 },                                                                                  // sp 3
        { role: 'USER', units: 1, voice: { recording: otherDuration, modality: 'VOICE_NOTE', a: 0, b: 4000 }, duration: 4200 }, // sp 4
        { role: 'ASSISTANT', units: 1 },                                                                                  // sp 5
        { role: 'USER', units: 1, voice: { recording: hole, modality: 'LIVE_CALL_SPEECH', a: 500, b: 2500 } },          // sp 6
        { role: 'ASSISTANT', units: 1, voice: { recording: hole, modality: 'LIVE_CALL_SPEECH', a: null, b: null, delivery: 'INTERRUPTED' } }, // sp 7
        { role: 'USER', units: 1, voice: { recording: overlap, modality: 'LIVE_CALL_SPEECH', a: 200, b: 2000 } },       // sp 8
        { role: 'ASSISTANT', units: 1 },                                                                                  // sp 9
        { role: 'USER', units: 1, voice: { recording: silent, modality: 'LIVE_CALL_SPEECH', a: 2000, b: 3000 } },       // sp 10
        { role: 'ASSISTANT', units: 1 },                                                                                  // sp 11
        { role: 'USER', units: 1, voice: { recording: callForNote, modality: 'VOICE_NOTE', a: 0, b: 4200 } },            // sp 12
      ]));
      assert.equal(turns.length, 12);
      await rt.setGate();
      const refusedAs = async (first, last, cause, word = 'SELECTION_NOT_SUPPORTED') => {
        const created = await rt.create(A, randomUUID(), session, first, last);
        assert.equal(created.outcome, 'CREATED', `[${first}, ${last}] the draft is created (${created.outcome})`);
        const spec = await latestSpec(created.replay_id);
        const b = await bindingOf(spec, A);
        assert.deepEqual([b.binding_digest, b.refusal_cause], [null, cause], `[${first}, ${last}] the cause is ${cause}`);
        const previewed = await rt.preview(A, randomUUID(), created.replay_id, created.draft_revision);
        assert.equal(previewed.outcome, word, `[${first}, ${last}] the wrapper answers ${word} (${previewed.outcome})`);
        assert.equal(await contractCount(created.replay_id), 0, `[${first}, ${last}] no contract row, no V1 fallback`);
        return { created, spec };
      };
      for (const [first, last] of [[1, 1], [2, 3]]) {
        const partial = await rt.create(A, randomUUID(), session, first, last);
        assert.equal(partial.outcome, 'NOT_WHOLE_MESSAGES', `[${first}, ${last}] the wrapper refuses part of a message first (${partial.outcome})`);
      }
      const nd = await refusedAs(1, 2, 'NOTE_SHAPE_INVALID');
      // L-4 in depth: a selection holding only one unit of a two-unit voice turn, written through the raw selection
      // primitive as its creator, is refused by the resolver itself.
      await owner();
      const [{ manifest, unit }] = await rows(`SELECT mi.manifest_version_id AS manifest, mi.personal_conversation_unit_id AS unit
          FROM public.replay_source_manifest_items mi JOIN public.replay_source_manifest_versions mv ON mv.id = mi.manifest_version_id
         WHERE mv.replay_id = $1 ORDER BY mi.source_item_ordinal LIMIT 1`, [nd.created.replay_id]);
      const partialSpec = randomUUID();
      await actAs(A);
      await rows(`SELECT * FROM public.replay_resolve_selection_spec_v1($1, $2, $3, 2, ARRAY[$4]::uuid[], ARRAY[NULL]::integer[],
          ARRAY[NULL]::integer[], 'HIGHLIGHT_SELECTION', clock_timestamp())`, [nd.created.replay_id, manifest, partialSpec, unit]);
      const pb = await bindingOf(partialSpec, A);
      assert.deepEqual([pb.binding_digest, pb.refusal_cause], [null, 'TURN_PARTIALLY_SELECTED'], 'one unit of a two-unit turn is refused');
      await refusedAs(4, 4, 'NOTE_SHAPE_INVALID');
      await refusedAs(6, 6, 'COVERAGE_HOLE');
      await refusedAs(7, 7, 'ANCHOR_ABSENT');
      await refusedAs(8, 8, 'COVERAGE_OVERLAP');
      await refusedAs(10, 10, 'WINDOW_WITHOUT_STORED_AUDIO');
      await refusedAs(12, 12, 'TRACK_ROLE_MISMATCH');
      // Another human: the binding is OWNER_MISMATCH, the plan answers nothing, the clients reach nothing.
      const b = await bindingOf(nd.spec, B);
      assert.deepEqual([b.binding_digest, b.refusal_cause], [null, 'OWNER_MISMATCH']);
      for (const role of ['authenticated', 'anon']) {
        await rejected(async () => { await asRole(role, A); return rows('SELECT * FROM public.resolve_replay_version_audio_plan_v1($1, $2)', [A, randomUUID()]); }, ['42501']);
        await rejected(async () => { await asRole(role, A); return rows('SELECT * FROM public.replay_derive_source_window_binding_v1($1, $2)', [nd.spec, A]); }, ['42501']);
        await rejected(async () => { await asRole(role, A); return rows('SELECT * FROM public.replay_resolve_source_windows_v1($1, $2)', [nd.spec, A]); }, ['42501']);
      }
      await rejected(async () => { await asRole('service_role'); return rows('SELECT * FROM public.replay_resolve_source_windows_v1($1, $2)', [nd.spec, A]); }, ['42501']);
      // A hole is legitimate only through its WRITER_LOSS gap: once recorded, the same window is admitted and the gap kept.
      await owner();
      await addGap(hole, 'USER', 1000, 2000, 'WRITER_LOSS');
      const admitted = await replayOf(A, session, 6, 6, { finalize: true });
      assert.equal(admitted.previewed.outcome, 'PREVIEW_READY', admitted.previewed.outcome);
      assert.equal(admitted.finalized.outcome, 'FINALIZED');
      assert.deepEqual(planShape(await plan(A, admitted.version)).filter(([, kind]) => kind === 'GAP'),
        [[1, 'GAP', 1, null, null, 'USER', 1000, 2000, null, 'WRITER_LOSS', null]], 'the discarded range is a gap, never filled');
      assert.deepEqual(await plan(B, admitted.version), [], 'another human gets no plan of it');
      // An unreadable recording: the source currency refuses the preview first; the resolver names it.
      await owner();
      const [{ outcome }] = await server('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [A, otherDuration]);
      assert.equal(outcome, 'DELETED');
      const unreadable = await rt.create(A, randomUUID(), session, 4, 4);
      const ub = await bindingOf(await latestSpec(unreadable.replay_id), A);
      assert.equal(ub.refusal_cause, 'RECORDING_NOT_READABLE');
      const up = await rt.preview(A, randomUUID(), unreadable.replay_id, unreadable.draft_revision);
      assert.equal(up.outcome, 'SOURCE_CHANGED', up.outcome);
      assert.equal(await contractCount(unreadable.replay_id), 0);
    });

    await report.isolated('B6 PO correction 4, expiry: unavailable at the instant with no sweep and no event; the creator\'s reconciliation records it', async () => {
      const A = await human();
      const session = await newSession(A);
      const note = await noteRecording(A, session, { expiresIn: 4 });
      const before = await recordingRow(note);
      await conversation(A, session, withTail([
        { role: 'USER', units: 1, voice: { recording: note, modality: 'VOICE_NOTE', a: 0, b: 2000 }, duration: 2000 },
        { role: 'ASSISTANT', units: 1 }]));
      await rt.setGate();
      const r = await replayOf(A, session, 1, 2, { finalize: true });
      assert.equal(r.finalized?.outcome, 'FINALIZED', `fixture: finalized before the expiry (${r.previewed.outcome} / ${r.finalized?.outcome})`);
      assert.equal(await availability(r.replay, r.version), 'CURRENT');
      assert.ok((await plan(A, r.version)).length > 0, 'the plan answers while the source is available');
      await q("SELECT pg_sleep(GREATEST(0, EXTRACT(EPOCH FROM ($1::timestamptz - clock_timestamp()))) + 0.2)", [before.expires]);
      // Immediately, with no sweep and no reconciliation:
      assert.equal(await availability(r.replay, r.version), 'NOT_CURRENT', 'unavailable at the instant');
      assert.deepEqual(await plan(A, r.version), [], 'no plan of an expired source');
      assert.equal((await recordingRow(note)).recording_state, 'STORED', 'no sweep ran: the state is still STORED');
      assert.deepEqual(await events(r.version), [], 'and no I-06D event exists: nothing is written automatically');
      // Separately, the creator's reconciliation records what it observes.
      const rec = await reconcile(A, r.replay, r.version);
      assert.equal(rec.availability_answer, 'NOT_CURRENT');
      assert.deepEqual(await events(r.version), [{ observed_availability_state: 'NOT_CURRENT' }], 'the event is written at reconciliation');
      assert.deepEqual(await recordingRow(note), before, 'retention unchanged');
    });

    await report.isolated('B7 PO correction 4, deletion and account erasure: unavailable at once, no event until reconciled; a later finalization refused', async () => {
      const A = await human();
      const session = await newSession(A);
      const n1 = await noteRecording(A, session);
      const n2 = await noteRecording(A, session);
      await conversation(A, session, withTail([
        { role: 'USER', units: 1, voice: { recording: n1, modality: 'VOICE_NOTE', a: 0, b: 2000 }, duration: 2000 },
        { role: 'ASSISTANT', units: 1 },
        { role: 'USER', units: 1, voice: { recording: n2, modality: 'VOICE_NOTE', a: 0, b: 2000 }, duration: 2000 }]));
      await rt.setGate();
      const r = await replayOf(A, session, 1, 2, { finalize: true });
      assert.equal(r.finalized.outcome, 'FINALIZED');
      const pending = await replayOf(A, session, 3, 3);
      assert.equal(pending.previewed.outcome, 'PREVIEW_READY');
      for (const rec of [n1, n2]) assert.equal((await server('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [A, rec]))[0].outcome, 'DELETED');
      assert.equal(await availability(r.replay, r.version), 'NOT_CURRENT', 'unavailable at once after the deletion');
      assert.deepEqual(await events(r.version), [], 'no event is written by the deletion');
      assert.equal((await reconcile(A, r.replay, r.version)).availability_answer, 'NOT_CURRENT');
      assert.deepEqual(await events(r.version), [{ observed_availability_state: 'NOT_CURRENT' }]);
      const late = await rt.finalize(A, randomUUID(), pending.replay, pending.version);
      assert.equal(late.outcome, 'SOURCE_CHANGED', `a preview of a since-deleted recording is not finalized (${late.outcome})`);
      // A due account erasure: unreadable at its final instant.
      const C = await human();
      const cs = await newSession(C);
      const n3 = await noteRecording(C, cs);
      await conversation(C, cs, withTail([{ role: 'USER', units: 1, voice: { recording: n3, modality: 'VOICE_NOTE', a: 0, b: 2000 }, duration: 2000 },
        { role: 'ASSISTANT', units: 1 }]));
      const e = await replayOf(C, cs, 1, 2, { finalize: true });
      assert.equal(e.finalized.outcome, 'FINALIZED');
      await owner();
      await q(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
               VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 second')`, [C]);
      assert.equal(await availability(e.replay, e.version), 'NOT_CURRENT', 'unavailable once the account erasure is due');
      assert.deepEqual(await events(e.version), []);
    });

    await report.isolated('B8 truth: windows that moved after the preview finalize as ANALYSIS_CHANGED; no hindsight once finalized', async () => {
      const A = await human();
      const session = await newSession(A);
      const call = await callRecording(A, session, { USER: [['S', 0, 5000]] });
      const conv = await conversation(A, session, withTail([
        { role: 'USER', units: 1, voice: { recording: call, modality: 'LIVE_CALL_SPEECH', a: 1000, b: 3000 } },
        { role: 'ASSISTANT', units: 1 }]));
      await rt.setGate();
      const moved = await replayOf(A, session, 1, 2);
      assert.equal(moved.previewed.outcome, 'PREVIEW_READY');
      await owner();
      await addGap(call, 'USER', 2000, 2500, 'MUTED');
      const truth = await truthOf(A, moved.version);
      assert.deepEqual([truth.currency_state, truth.divergence_class], ['DIVERGED', 'RENDER_CONTRACT_MOVED'], 'the binding no longer re-derives ' + JSON.stringify(truth));
      const f = await rt.finalize(A, randomUUID(), moved.replay, moved.version);
      assert.equal(f.outcome, 'ANALYSIS_CHANGED', f.outcome);
      // No hindsight: a finalized V2 version keeps its binding and its plan as the conversation grows.
      const call2 = await callRecording(A, session, { USER: [['S', 0, 5000]] });
      const later = await conversation(A, session, [
        { role: conv.length % 2 === 0 ? 'USER' : 'ASSISTANT', units: 1 },
        { role: 'USER', units: 1, voice: { recording: call2, modality: 'LIVE_CALL_SPEECH', a: 0, b: 4000 } },
        { role: 'ASSISTANT', units: 1 }]);
      void later;
      const sp = Number((await rows('SELECT current_sp FROM public.session_semantic_clocks WHERE session_id = $1', [session]))[0].current_sp);
      const kept = await replayOf(A, session, sp - 1, sp - 1, { finalize: true });
      assert.equal(kept.finalized.outcome, 'FINALIZED', kept.previewed.outcome);
      const p1 = await plan(A, kept.version);
      const c1 = await contractOf(kept.version);
      await rt.commitMessage(A, { session, liveHead: sp, units: [] });
      assert.deepEqual(await plan(A, kept.version), p1, 'the plan is unchanged by a later message');
      assert.equal((await contractOf(kept.version)).source_window_binding_digest, c1.source_window_binding_digest);
      const t2 = await truthOf(A, kept.version);
      assert.equal(t2.currency_state, 'CURRENT');
    });

    await report.isolated('B9 the gate: with PERSONAL_REPLAY closed, an audio draft is not created; every voice gate stays DISABLED', async () => {
      const A = await human();
      const session = await newSession(A);
      const note = await noteRecording(A, session);
      await conversation(A, session, withTail([{ role: 'USER', units: 1, voice: { recording: note, modality: 'VOICE_NOTE', a: 0, b: 2000 }, duration: 2000 }]));
      await rt.setGate('DISABLED', 'UNSATISFIED');
      const created = await rt.create(A, randomUUID(), session, 1, 1);
      assert.notEqual(created.outcome, 'CREATED', `the closed gate refuses (${created.outcome})`);
      assert.equal(await rt.capability(A), false);
      await owner();
      const voice = await rows("SELECT count(*)::int n FROM voice_private.voice_launch_capability_states WHERE feature_flag_state = 'DISABLED'");
      assert.equal(voice[0].n, 4);
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ R1: two sessions (committed fixtures, removed)
async function verifyRace(report, humans, recordings) {
  await report.section('R1 a preview holding its recording FOR SHARE serializes the deletion; once deleted, finalization is refused', async () => {
    const A = randomUUID();
    humans.push(A);
    await rt.provisionHumans([A]);
    const session = await newSession(A);
    const note = await noteRecording(A, session);
    recordings.push(note);
    await conversation(A, session, withTail([{ role: 'USER', units: 1, voice: { recording: note, modality: 'VOICE_NOTE', a: 0, b: 2000 }, duration: 2000 },
      { role: 'ASSISTANT', units: 1 }]));
    await rt.setGate();
    const created = await rt.create(A, randomUUID(), session, 1, 2);
    assert.equal(created.outcome, 'CREATED');
    const second = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await second.connect();
    try {
      await q('BEGIN');
      const previewed = await rt.preview(A, randomUUID(), created.replay_id, created.draft_revision);
      assert.equal(previewed.outcome, 'PREVIEW_READY');
      await second.query("SET lock_timeout = '700ms'");
      await second.query('SET ROLE service_role');
      let blocked = null;
      try {
        await second.query('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [A, note]);
      } catch (error) {
        blocked = error.code;
      }
      assert.equal(blocked, '55P03', 'the deletion waits for the preview (FOR SHARE held until it commits)');
      await q('COMMIT');
      await owner();
      const [{ outcome }] = (await second.query('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [A, note])).rows;
      assert.equal(outcome, 'DELETED', 'once the preview committed, the deletion proceeds');
      const late = await rt.finalize(A, randomUUID(), created.replay_id, previewed.replay_version_id);
      assert.equal(late.outcome, 'SOURCE_CHANGED', `the version of a deleted recording is not finalized (${late.outcome})`);
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await second.end();
      await owner();
    }
  });
}
async function removeRaceFixtures(humans, recordings) {
  if (humans.length === 0) return;
  await owner();
  await q('BEGIN');
  try {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q(`DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key IN
               (SELECT storage_key FROM voice_private.recording_objects WHERE recording_id = ANY($1::uuid[]))`, [recordings]);
    await q('DELETE FROM public.conversation_turn_voice_sources WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.note_transcriptions WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.recording_objects WHERE recording_id = ANY($1::uuid[])', [recordings]);
    await q('DELETE FROM voice_private.recording_gaps WHERE recording_id = ANY($1::uuid[])', [recordings]);
    await q('DELETE FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])', [humans]);
    await q("SET LOCAL session_replication_role = 'origin'");
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK');
    throw error;
  }
  await rt.removeCommittedFixtures(humans);
  await rt.resetGate();
}

runVerifier('0195', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('0195', { query: q, restore: () => owner() });
  setStage('catalogue');
  await verifyCatalogue(report);
  setStage('behaviour');
  await verifyBehaviour(report);
  const humans = [];
  const recordings = [];
  setStage('race');
  try {
    await verifyRace(report, humans, recordings);
  } finally {
    setStage('teardown');
    await removeRaceFixtures(humans, recordings);
  }
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM voice_private.recordings WHERE id = ANY($2::uuid[]))
      + (SELECT count(*) FROM replay_private.replay_launch_capability_states) AS residue`, [humans, recordings]);
  assert.equal(Number(residue), 0, 'the run leaves nothing behind');
}, () => rt.client.end().catch(() => undefined));
