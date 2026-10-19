// Shared support for the S7-01 real-PostgreSQL verifier (migration 0169).
//
// It composes the I-06B Replay Version runtime (which composes the I-06A and Public support runtimes) and adds only
// what the Personal Replay wrappers need: a COVERED Personal conversation of several whole messages (turns) with
// canonical analytical state that differs between Session Positions, the operator's gate switch, the eleven exposed
// wrappers called as one exact human, and a teardown for committed fixtures.
//
// ## Why the conversation is built at the substrate level
//
// Exactly the reason replay-version-verifier-support.mjs gives: the canonical analytical state of a Session is a set of
// typed SP-native availability events (0072), and writing them directly produces the canonical truth with the exact
// coordinates a no-hindsight proof needs. NOTHING here bypasses the projection: K(TC) is always computed by
// `get_session_historical_projection_v1`, and every Replay act goes through the wrappers under test.
//
// Nothing in this module asserts anything about a migration on its own.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createReplayVersionRuntime } from './replay-version-verifier-support.mjs';

/** The eleven exposed wrappers of 0169, by exact signature. */
export const W = Object.freeze({
  CAPABILITY: 'public.read_my_replay_capability_v1()',
  CREATE: 'public.create_my_replay_draft_v1(uuid,uuid,integer,integer)',
  REVISE: 'public.revise_my_replay_draft_v1(uuid,uuid,bigint,integer,integer)',
  PREVIEW: 'public.prepare_my_replay_preview_v1(uuid,uuid,bigint)',
  FINALIZE: 'public.finalize_my_replay_version_v1(uuid,uuid,uuid)',
  REOPEN: 'public.reopen_my_replay_for_revision_v1(uuid,uuid,uuid)',
  READ: 'public.read_my_replay_v1(uuid)',
  VERSION: 'public.read_my_replay_version_v1(uuid,uuid)',
  MOMENTS: 'public.read_my_replay_moments_v1(uuid,uuid)',
  ANALYSIS: 'public.read_my_replay_moment_analysis_v1(uuid,uuid,integer)',
  LIST: 'public.list_my_conversation_replays_v1(uuid)',
});

/** The definers behind them, and the private parts no application role may reach. */
export const P = Object.freeze({
  SET_GATE: 'replay_private.set_replay_launch_capability_v1(text,text,text,text,text)',
  BIND_GATE: 'replay_private.bind_replay_launch_gate_v1()',
  IDENTITY: 'replay_private.derive_identity_v1(text,uuid,uuid)',
  RANGE: 'replay_private.resolve_personal_range_v1(uuid,integer,integer)',
  VIEWING: 'replay_private.version_viewing_state_v1(uuid,uuid)',
  EVIDENCE_GUARD: 'replay_private.reject_personal_replay_launch_evidence_mutation_v1()',
  MODULE: 'account_erasure_private.erase_personal_replays_v1(uuid,uuid)',
  MODULE_RESIDUE: 'account_erasure_private.replay_module_residue_v1(uuid)',
});

/** Result columns no S7-01 read may ever declare: source identity, a human, a digest or a private cause. */
export const PERSONAL_REPLAY_DISCLOSURE_BAN = /user_id|auth_subject|email|session|turn|conversation_unit|unit_id|manifest|selection_spec|digest|fingerprint|staleness|divergence|world_id|material|history_item|package|provenance|audio|transcript|experience|request_ref|actor|creator/u;

/** The gate states an operator may set. */
export const OPEN = Object.freeze(['ENABLED', 'SATISFIED']);

export function createPersonalReplayRuntime(databaseUrl) {
  const rt = createReplayVersionRuntime(databaseUrl);
  const { q, rows } = rt;

  async function provisionHumans(humans) {
    await rt.asRole('postgres');
    await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [humans]);
    const [{ n }] = await rows('SELECT count(*)::int n FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
    assert.equal(n, humans.length, 'the auth provisioning trigger created one public.users row per fixture human');
  }

  /**
   * A COVERED Personal conversation of `turns` whole messages of `unitsPerTurn` committed units each, alternating
   * USER / ASSISTANT by message, so Session Positions 1 .. turns * unitsPerTurn exist and the Live Head is the last of
   * them (every earlier position SEALED, the last one the OPEN head). The analytical state is staged so K(TC) differs:
   *
   *   SP(1)  Reading A becomes known            SP(3)  Reading B becomes known
   *   SP(5)  Reading A advances to ACTIVE        (when the conversation reaches SP 5)
   */
  async function provisionConversation(owner, { turns = 3, unitsPerTurn = 2 } = {}) {
    const session = randomUUID();
    const turnIds = Array.from({ length: turns }, () => randomUUID());
    const units = [];
    await rt.asRole('postgres');
    await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, owner]);
    let sp = 0;
    for (let t = 0; t < turns; t += 1) {
      const role = t % 2 === 0 ? 'USER' : 'ASSISTANT';
      const message = `message ${t + 1} of the owner own conversation`;
      const batch = randomUUID();
      await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
               VALUES ($1, $2, $3, $4, 'COMPLETED', $5)`, [turnIds[t], session, owner, role, message]);
      await q(`INSERT INTO public.conversation_unit_commit_batches
                 (id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256,
                  unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
                  segmentation_prompt_version)
               VALUES ($1, $2, $3, $4, sha256($5::bytea), sha256($5::bytea), $6, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
      [batch, owner, session, turnIds[t], Buffer.from(`${session}:${t}:${message}`, 'utf8'), unitsPerTurn]);
      for (let u = 0; u < unitsPerTurn; u += 1) {
        sp += 1;
        const id = randomUUID();
        const body = `${message}, sentence ${u + 1}`;
        await q(
          `INSERT INTO public.conversation_units
             (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
              source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text,
              source_content_sha256, session_position)
           VALUES ($1, $2, $3, $4, $5, $6, 'RESOLVED', 'TEXT', $7, 0, $8, $9, sha256(convert_to($9, 'UTF8')), $10)`,
          [id, owner, session, turnIds[t], batch, role, u, [...body].length, body, sp]);
        units.push({ id, sp, role, text: body, turn: turnIds[t] });
      }
    }
    await q('UPDATE public.session_semantic_clocks SET current_sp = $2 WHERE session_id = $1', [session, sp]);
    const cut = await rows('SELECT b.baseline_world_version::bigint baseline FROM public.session_historical_baselines b WHERE b.session_id = $1', [session]);
    assert.equal(cut.length, 1, 'a COVERED conversation cuts exactly one historical baseline');
    const baseline = Number(cut[0].baseline);
    const readingA = randomUUID();
    const readingB = randomUUID();
    await rt.asReplica(async () => {
      const hypothesis = (id, statement) => q(
        `INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, status, version)
         VALUES ($1, $2, $3, 'CAUSAL', 'GENERAL', $4, 'SYSTEM_GENERATED', 'CANDIDATE', 1)`,
        [id, owner, statement, `CONVERSATION_SESSION:${session}`]);
      await hypothesis(readingA, 'the first reading of this conversation');
      await hypothesis(readingB, 'a reading that did not exist yet at the first message');
      const event = (hypothesisId, kind, fromStatus, toStatus, fromVersion, toVersion, at, world) => q(
        `INSERT INTO public.historical_reading_events
           (event_id, user_id, hypothesis_id, event_kind, from_status, to_status, from_version, to_version,
            session_id, session_position, same_sp_event_sequence, world_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11)`,
        [randomUUID(), owner, hypothesisId, kind, fromStatus, toStatus, fromVersion, toVersion, session, at, world]);
      await event(readingA, 'CREATED', null, 'CANDIDATE', null, 1, 1, baseline + 1);
      if (sp >= 3) await event(readingB, 'CREATED', null, 'CANDIDATE', null, 1, 3, baseline + 2);
      if (sp >= 5) await event(readingA, 'STATUS_TRANSITION', 'CANDIDATE', 'ACTIVE', 1, 1, 5, baseline + 3);
    });
    await rt.asRole('postgres');
    return { session, turns: turnIds, units, liveHead: sp, readingA, readingB, baseline };
  }

  /** One more whole message committed at the next Session Position (it moves the Live Head). */
  async function commitMessage(owner, conversation, role = 'USER') {
    const turn = randomUUID();
    const batch = randomUUID();
    const sp = conversation.liveHead + 1;
    const body = `a later message at position ${sp}`;
    await rt.asRole('postgres');
    await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
             VALUES ($1, $2, $3, $4, 'COMPLETED', $5)`, [turn, conversation.session, owner, role, body]);
    await q(`INSERT INTO public.conversation_unit_commit_batches
               (id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256,
                unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
                segmentation_prompt_version)
             VALUES ($1, $2, $3, $4, sha256($5::bytea), sha256($5::bytea), 1, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
    [batch, owner, conversation.session, turn, Buffer.from(`${conversation.session}:${sp}`, 'utf8')]);
    const id = randomUUID();
    await q(
      `INSERT INTO public.conversation_units
         (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
          source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text,
          source_content_sha256, session_position)
       VALUES ($1, $2, $3, $4, $5, $6, 'RESOLVED', 'TEXT', 0, 0, $7, $8, sha256(convert_to($8, 'UTF8')), $9)`,
      [id, owner, conversation.session, turn, batch, role, [...body].length, body, sp]);
    await q('UPDATE public.session_semantic_clocks SET current_sp = $2 WHERE session_id = $1', [conversation.session, sp]);
    conversation.units.push({ id, sp, role, text: body, turn });
    conversation.liveHead = sp;
    return { id, sp };
  }

  /** The operator's switch, as the database owner (no application role can reach it). */
  async function setGate(flag = 'ENABLED', requirements = 'SATISFIED') {
    await rt.asRole('postgres');
    return (await rows(`SELECT * FROM ${P.SET_GATE.replace(/\(.*$/u, '')}('PERSONAL_REPLAY', $1, $2, 'verify-0169', 'real-PostgreSQL proof')`,
      [flag, requirements]))[0];
  }

  /** Calls one wrapper as exactly `uid` through the role PostgREST switches to; the claims are the human's own. */
  async function call(uid, fn, args = []) {
    await rt.asRole('authenticated', uid);
    const name = fn.replace(/\(.*$/u, '');
    const params = args.map((_, i) => `$${i + 1}`).join(', ');
    // On a refusal the transaction is aborted: the caller's ROLLBACK TO SAVEPOINT restores the role (SET LOCAL is
    // subtransaction-scoped), and resetting it here would only replace the real refusal with 25P02.
    const result = await rows(`SELECT * FROM ${name}(${params})`, args);
    await rt.asRole('postgres');
    return result;
  }
  const create = (uid, command, session, first, last) => call(uid, W.CREATE, [command, session, first, last]).then((r) => r[0]);
  const revise = (uid, command, replay, expected, first, last) => call(uid, W.REVISE, [command, replay, expected, first, last]).then((r) => r[0]);
  const preview = (uid, command, replay, expected) => call(uid, W.PREVIEW, [command, replay, expected]).then((r) => r[0]);
  const finalize = (uid, command, replay, version) => call(uid, W.FINALIZE, [command, replay, version]).then((r) => r[0]);
  const reopen = (uid, command, replay, version) => call(uid, W.REOPEN, [command, replay, version]).then((r) => r[0]);
  const read = (uid, replay) => call(uid, W.READ, [replay]);
  const version = (uid, replay, v) => call(uid, W.VERSION, [replay, v]);
  const moments = (uid, replay, v) => call(uid, W.MOMENTS, [replay, v]);
  const analysis = (uid, replay, v, ordinal) => call(uid, W.ANALYSIS, [replay, v, ordinal]);
  const list = (uid, session) => call(uid, W.LIST, [session]);
  const capability = async (uid) => (await call(uid, W.CAPABILITY))[0].creation_available;

  /** create -> preview (-> finalize), each asserted, for scenarios that need a Replay in a given state. */
  async function bringTo(uid, conversation, state, { first = 1, last = 4 } = {}) {
    const created = await create(uid, randomUUID(), conversation.session, first, last);
    assert.equal(created.outcome, 'CREATED', `fixture: the draft is created (${created.outcome})`);
    if (state === 'DRAFT') return { replay: created.replay_id, created };
    const previewed = await preview(uid, randomUUID(), created.replay_id, created.draft_revision);
    assert.equal(previewed.outcome, 'PREVIEW_READY', `fixture: the preview is ready (${previewed.outcome})`);
    if (state === 'PREVIEW_READY') return { replay: created.replay_id, version: previewed.replay_version_id, created, previewed };
    const finalized = await finalize(uid, randomUUID(), created.replay_id, previewed.replay_version_id);
    assert.equal(finalized.outcome, 'FINALIZED', `fixture: the version is finalized (${finalized.outcome})`);
    return { replay: created.replay_id, version: previewed.replay_version_id, created, previewed, finalized };
  }

  /** Every Replay row of `user` across every Replay relation, as a count per relation (0 everywhere when erased). */
  async function replayFootprint(user) {
    await rt.asRole('postgres');
    const out = {};
    const replays = 'SELECT id FROM public.replays WHERE created_by_user_id = $1';
    const counts = {
      replays: 'SELECT count(*) n FROM public.replays WHERE created_by_user_id = $1',
      manifests: `SELECT count(*) n FROM public.replay_source_manifest_versions WHERE replay_id IN (${replays})`,
      versions: `SELECT count(*) n FROM public.replay_versions WHERE replay_id IN (${replays})`,
      lifecycle: `SELECT count(*) n FROM public.replay_lifecycle_events WHERE replay_id IN (${replays})`,
      evidence: `SELECT count(*) n FROM replay_private.personal_replay_launch_evidence WHERE replay_id IN (${replays})`,
      creates: 'SELECT count(*) n FROM public.replay_create_commands WHERE actor_user_id = $1',
      finalizations: 'SELECT count(*) n FROM public.replay_version_finalizations WHERE finalized_by_user_id = $1',
    };
    for (const [key, sql] of Object.entries(counts)) out[key] = Number((await rows(sql, [user]))[0].n);
    return out;
  }

  /**
   * Remove every COMMITTED fixture of the given humans - their Replays (with every Replay guard standing aside), their
   * conversations and analytical state - and the humans themselves. Fixture surgery, never Product behaviour.
   */
  async function removeCommittedFixtures(humans) {
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      await q("SET LOCAL session_replication_role = 'replica'");
      const replays = 'SELECT id FROM public.replays WHERE created_by_user_id = ANY($1::uuid[])';
      for (const sql of [
        `DELETE FROM replay_private.personal_replay_launch_evidence WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_finalization_commands WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_revision_reopen_commands WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_preview_commands WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_version_finalizations WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_lifecycle_events WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_current_version_state WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_versions WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_render_contract_versions WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_analytical_projection_points WHERE source_manifest_version_id IN (SELECT id FROM public.replay_source_manifest_versions WHERE replay_id IN (${replays}))`,
        `DELETE FROM public.replay_analytical_projection_versions WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_temporal_discontinuities WHERE source_manifest_version_id IN (SELECT id FROM public.replay_source_manifest_versions WHERE replay_id IN (${replays}))`,
        `DELETE FROM public.replay_semantic_cut_assessments WHERE selection_spec_version_id IN (SELECT id FROM public.replay_selection_spec_versions WHERE replay_id IN (${replays}))`,
        `DELETE FROM public.replay_draft_revision_commands WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_create_commands WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_draft_state WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_selection_spec_items WHERE source_manifest_version_id IN (SELECT id FROM public.replay_source_manifest_versions WHERE replay_id IN (${replays}))`,
        `DELETE FROM public.replay_selection_spec_versions WHERE replay_id IN (${replays})`,
        `DELETE FROM public.replay_source_manifest_items WHERE manifest_version_id IN (SELECT id FROM public.replay_source_manifest_versions WHERE replay_id IN (${replays}))`,
        `DELETE FROM public.replay_source_manifest_versions WHERE replay_id IN (${replays})`,
        'DELETE FROM public.replays WHERE created_by_user_id = ANY($1::uuid[])',
        'DELETE FROM account_erasure_private.deletion_progress WHERE deletion_id IN (SELECT id FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[]))',
        'DELETE FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[])',
      ]) await q(sql, [humans]);
      await q("SET LOCAL session_replication_role = 'origin'");
      await q('COMMIT');
    } catch (error) {
      await q('ROLLBACK');
      throw error;
    }
    await rt.removeHistoricalFixture(humans);
    await rt.removeFixtureHumans(humans);
  }

  /** Closes the gate again after a run: the database is left exactly as the migration left it (no state row). */
  async function resetGate() {
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      await q("SET LOCAL session_replication_role = 'replica'");
      await q('DELETE FROM replay_private.replay_launch_capability_events');
      await q('DELETE FROM replay_private.replay_launch_capability_states');
      await q("SET LOCAL session_replication_role = 'origin'");
      await q('COMMIT');
    } catch (error) {
      await q('ROLLBACK');
      throw error;
    }
  }

  return {
    ...rt, W, P, provisionHumans, provisionConversation, commitMessage, setGate, resetGate, call,
    create, revise, preview, finalize, reopen, read, version, moments, analysis, list, capability, bringTo,
    replayFootprint, removeCommittedFixtures,
  };
}

/**
 * The 0164 coordinator body (`account_erasure_private.erase_account_v1`) with exactly the three edits 0169 makes to it,
 * and nothing else: E1 the account's own Replays locked ascending before the account row, E2 the Personal Replay module
 * and its residue check under the same authorization before 0130, E3 the coverage comment. Each anchor must occur exactly
 * once in the given body, so a drifted 0164 body fails here rather than producing a wrong expectation.
 *
 * Shared by verify-migration-0169 (A07) and every earlier verifier that pins the coordinator byte-for-byte (0166 A03),
 * so the approved S7-01 edit set is written down once.
 */
export function coordinatorWithS701Edits(body0164) {
  const once = (text, from, to, label) => {
    assert.equal(text.split(from).length - 1, 1, `${label}: the 0164 coordinator anchor exists exactly once`);
    return text.replace(from, () => to);
  };
  let coordinator = once(body0164, '    PERFORM 1 FROM public.matching_active_introduction_claims c WHERE c.world_id = ANY (v_worlds) ORDER BY c.id FOR UPDATE;\n',
    '    PERFORM 1 FROM public.matching_active_introduction_claims c WHERE c.world_id = ANY (v_worlds) ORDER BY c.id FOR UPDATE;\n'
    + "    -- S7-01 (0169): the account's own Replays, ascending, before the account row (every Replay path takes its Replay first).\n"
    + '    PERFORM 1 FROM public.replays r WHERE r.created_by_user_id = v_user ORDER BY r.id FOR UPDATE;\n', 'E1');
  coordinator = once(coordinator, "    IF account_erasure_private.module_residue_v1(v_user) THEN\n      RAISE EXCEPTION 'ACCOUNT_ERASURE_MODULE_INCOMPLETE' USING ERRCODE = 'P0001';\n    END IF;\n",
    "    IF account_erasure_private.module_residue_v1(v_user) THEN\n      RAISE EXCEPTION 'ACCOUNT_ERASURE_MODULE_INCOMPLETE' USING ERRCODE = 'P0001';\n    END IF;\n"
    + '    -- S7-01 (0169): the Personal Replay module (QAN-BL-ACCT-02), under the same authorization, before 0130.\n'
    + '    PERFORM account_erasure_private.erase_personal_replays_v1(p_deletion_id, v_user);\n'
    + '    IF account_erasure_private.replay_module_residue_v1(v_user) THEN\n'
    + "      RAISE EXCEPTION 'ACCOUNT_ERASURE_MODULE_INCOMPLETE' USING ERRCODE = 'P0001';\n"
    + '    END IF;\n', 'E2');
  return once(coordinator, '  -- it (none does yet: ACCT-DEL-02 and Stage 7 own them, and cover a class in the same change as its module).\n',
    '  -- it (S7-01 / 0169 covers REPLAY; ACCT-DEL-02 owns Shared STANDARD and Public; QAN-BL-ACCT-03 the Replay remainder).\n', 'E3');
}

export { runVerifier, APP_ROLES } from './public-runtime-verifier-support.mjs';
export { CONTRACT_POLICY, VFN } from './replay-version-verifier-support.mjs';
