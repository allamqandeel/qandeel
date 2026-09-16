// Shared support for the I-06B real-PostgreSQL verifiers (migrations 0102 and
// 0103).
//
// The I-06B verifiers reach their subjects through the SAME fixture shape the
// I-06A Replay verifiers use - the frozen Public support runtime, the frozen
// 0064 Personal source, the frozen I-04 Shared source - so they compose the
// Replay runtime rather than copying it, and add only what a Replay VERSION
// needs: the new relation and function names, a COVERED Personal Session with
// real historical analytical state at distinct Session Positions, a LEGACY
// UNCOVERED Session, the three human primitives, and a teardown that lifts the
// I-06B immutability guards inside ONE transaction and proves them back.
//
// ## Why the historical fixture is built at the substrate level
//
// The canonical analytical state of a Session is a set of typed SP-native
// availability events (migration 0072 section 4), and the canonical projection
// reads exactly those. Driving the full semantic-chain coordinator to produce
// them would make this fixture depend on a dozen unrelated evaluators; writing
// the substrate rows directly - as the frozen 0072 verifier itself does for its
// own legacy Session - produces the same canonical truth with the exact
// coordinates a no-hindsight proof needs. NOTHING here bypasses the projection:
// K(TC) is always computed by `get_session_historical_projection_v1`.
//
// Nothing in this module asserts anything about a migration on its own.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createReplayRuntime } from './replay-verifier-support.mjs';

// ------------------------------------------------------------------ relations
export const V = Object.freeze({
  PROJECTIONS: 'public.replay_analytical_projection_versions',
  POINTS: 'public.replay_analytical_projection_points',
  CUTS: 'public.replay_semantic_cut_assessments',
  GAPS: 'public.replay_temporal_discontinuities',
  CONTRACTS: 'public.replay_render_contract_versions',
  VERSIONS: 'public.replay_versions',
  POINTER: 'public.replay_current_version_state',
  FINALIZATIONS: 'public.replay_version_finalizations',
  LIFECYCLE: 'public.replay_lifecycle_events',
  PREVIEW_COMMANDS: 'public.replay_preview_commands',
  FINALIZE_COMMANDS: 'public.replay_finalization_commands',
  REOPEN_COMMANDS: 'public.replay_revision_reopen_commands',
});

/** Every append-only I-06B relation with the trigger that guards it. */
export const I06B_IMMUTABLE = [
  [V.PROJECTIONS, 'replay_analytical_projection_versions_immutable'],
  [V.POINTS, 'replay_analytical_projection_points_immutable'],
  [V.CUTS, 'replay_semantic_cut_assessments_immutable'],
  [V.GAPS, 'replay_temporal_discontinuities_immutable'],
  [V.CONTRACTS, 'replay_render_contract_versions_immutable'],
  [V.VERSIONS, 'replay_versions_immutable'],
  [V.FINALIZATIONS, 'replay_version_finalizations_immutable'],
  [V.LIFECYCLE, 'replay_lifecycle_events_immutable'],
];

// ------------------------------------------------------------------ functions
export const VFN = Object.freeze({
  FAMILY: 'public.replay_canonical_projection_family_v1(text, jsonb, text[])',
  POINT_DIGEST: 'public.replay_analytical_projection_point_digest_v1(integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)',
  VERSION_DIGEST: 'public.replay_analytical_projection_version_digest_v1(text[])',
  CONTRACT_DIGEST: 'public.replay_render_contract_digest_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer)',
  CUT: 'public.derive_replay_semantic_cut_safety_v1(uuid, timestamptz)',
  GAP: 'public.derive_replay_temporal_discontinuities_v1(uuid)',
  PROJECTION: 'public.build_replay_analytical_projection_v1(uuid, uuid, integer, uuid, timestamptz)',
  CONTRACT: 'public.build_replay_render_contract_v1(uuid, uuid, integer, uuid, timestamptz)',
  TRUTH: 'public.derive_replay_version_truth_currency_v1(uuid)',
  PREVIEW: 'public.prepare_replay_preview_v1(uuid, uuid, bigint, uuid, uuid, uuid)',
  FINALIZE: 'public.finalize_replay_version_v1(uuid, uuid, uuid)',
  REOPEN: 'public.reopen_replay_for_revision_v1(uuid, uuid, uuid)',
  RESOLVER: 'public.resolve_replay_current_version_v1(uuid, uuid)',
  /** The canonical historical projection this slice consumes and never replaces. */
  CANONICAL: 'public.get_session_historical_projection_v1(uuid, integer)',
});

/** Result columns no I-06B read boundary may ever declare. */
export const VERSION_DISCLOSURE_BAN = /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material|history_item|availability|context_ref|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|experience|staleness|divergence/u;

/** The exact policy tuple every render contract at this baseline carries. */
export const CONTRACT_POLICY = Object.freeze({
  schema: 'QANDEEL_REPLAY_RENDER_CONTRACT_V1',
  medium: 'ORIGINAL_TEXT_ONLY',
  originalMedium: 'PRESERVE_ORIGINAL_MEDIUM_ONLY',
  sourceText: 'EXACT_SOURCE_TEXT',
  semanticCut: 'WHOLE_ITEM_ONLY_PROVEN_SAFE',
  discontinuity: 'PERCEPTIBLE_DISCONTINUITY_REQUIRED',
  timing: 'PRESENTATION_PACING_DECLARED',
  projection: 'BOUND_HISTORICAL_PROJECTION_DIGEST',
  camera: 'EMPHASIS_WITHOUT_MEANING_CREATION',
  motion: 'EXPLANATORY_MOTION_ONLY',
  caption: 'DERIVED_CAPTION_DISTINCT_FROM_SOURCE',
  accessibility: 'EQUIVALENT_TRUTH_REQUIRED',
  reducedMotion: 'EQUIVALENT_TRUTH_REQUIRED',
  editorial: 'NO_EDITORIAL_ANNOTATION',
});

// -------------------------------------------------------------------- runtime
export function createReplayVersionRuntime(databaseUrl) {
  const rt = createReplayRuntime(databaseUrl);
  const { q, rows } = rt;

  /** Fixture surgery with every trigger standing aside, as the frozen 0072 verifier does. */
  async function asReplica(work) {
    await rt.asRole('postgres');
    await q("SET LOCAL session_replication_role = 'replica'");
    try { return await work(); } finally { await q("SET LOCAL session_replication_role = 'origin'"); }
  }

  /**
   * A COVERED Personal Session with `units` committed Session Positions and a
   * Live Head at the last of them, plus canonical analytical state that DIFFERS
   * between Session Positions.
   *
   * The Live Head is the last committed position, so every earlier position is
   * SEALED - which is exactly what migration 0072 means by stable - and the
   * last one is the OPEN head, which I-06B must refuse to freeze.
   *
   * The analytical state is deliberately staged:
   *
   *   SP(1)   Reading A becomes known
   *   SP(2)   Reading B becomes known
   *   SP(3)   Reading A advances to a later then-current status
   *
   * so K(1), K(2) and K(3) are three different truths, no later one appears in
   * an earlier one, and a digest that ignored the difference would be caught.
   */
  async function provisionHistoricalSession(owner, { units = 4 } = {}) {
    const session = randomUUID();
    const turn = randomUUID();
    const batch = randomUUID();
    const text = 'a committed sentence of the owner own Session';
    const unitIds = Array.from({ length: units }, () => randomUUID());
    await rt.asRole('postgres');
    await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')",
      [session, owner]);
    await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
             VALUES ($1, $2, $3, 'USER', 'COMPLETED', $4)`, [turn, session, owner, text]);
    await q(`INSERT INTO public.conversation_unit_commit_batches
               (id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256,
                unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
                segmentation_prompt_version)
             VALUES ($1, $2, $3, $4, sha256($5::bytea), sha256($5::bytea), $6, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
    [batch, owner, session, turn, Buffer.from(`${session}:${text}`, 'utf8'), units]);
    for (let index = 0; index < units; index += 1) {
      const body = `${text} ${index + 1}`;
      await q(
        `INSERT INTO public.conversation_units
           (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
            source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text,
            source_content_sha256, session_position)
         VALUES ($1, $2, $3, $4, $5, $6, 'RESOLVED', 'TEXT', $7, 0, $8, $9, sha256(convert_to($9, 'UTF8')), $10)`,
        [unitIds[index], owner, session, turn, batch, index % 2 === 0 ? 'USER' : 'ASSISTANT', index,
          [...body].length, body, index + 1]);
    }
    // The Live Head, which the frozen commit primitive would have advanced.
    await q('UPDATE public.session_semantic_clocks SET current_sp = $2 WHERE session_id = $1', [session, units]);
    const cut = await rows(
      'SELECT b.baseline_world_version::bigint baseline FROM public.session_historical_baselines b WHERE b.session_id = $1',
      [session]);
    assert.equal(cut.length, 1,
      'a COVERED Session cuts exactly one historical baseline at its first committed Session Position');
    const { baseline } = cut[0];
    assert.ok(baseline !== null, 'and that baseline names a world version');

    // The analytical state, as canonical SP-native availability events. Written
    // with triggers standing aside so the capture hooks add nothing of their own
    // and the world versions are exactly the ones this fixture intends.
    const readingA = randomUUID();
    const readingB = randomUUID();
    await asReplica(async () => {
      const hypothesis = (id, statement) => q(
        `INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, status, version)
         VALUES ($1, $2, $3, 'CAUSAL', 'GENERAL', $4, 'SYSTEM_GENERATED', 'CANDIDATE', 1)`,
        [id, owner, statement, `CONVERSATION_SESSION:${session}`]);
      await hypothesis(readingA, 'the first reading of this Session');
      await hypothesis(readingB, 'a reading that did not exist yet at the first position');
      const event = (hypothesisId, kind, fromStatus, toStatus, fromVersion, toVersion, sp, world) => q(
        `INSERT INTO public.historical_reading_events
           (event_id, user_id, hypothesis_id, event_kind, from_status, to_status, from_version, to_version,
            session_id, session_position, same_sp_event_sequence, world_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11)`,
        [randomUUID(), owner, hypothesisId, kind, fromStatus, toStatus, fromVersion, toVersion, session, sp, world]);
      await event(readingA, 'CREATED', null, 'CANDIDATE', null, 1, 1, Number(baseline) + 1);
      await event(readingB, 'CREATED', null, 'CANDIDATE', null, 1, 2, Number(baseline) + 2);
      await event(readingA, 'STATUS_TRANSITION', 'CANDIDATE', 'ACTIVE', 1, 1, 3, Number(baseline) + 3);
    });
    await rt.asRole('postgres');
    return { session, turn, batch, units: unitIds, liveHead: units, readingA, readingB, baseline: Number(baseline) };
  }

  /**
   * A LEGACY UNCOVERED Session: one that already existed when the historical
   * capture authority was deployed, exactly as migration 0072 left it. Its
   * Conversation Runtime is ungated and it never receives a baseline, so the
   * canonical projection refuses it - and so must a Replay.
   */
  async function provisionLegacySession(owner) {
    const session = randomUUID();
    const turn = randomUUID();
    const batch = randomUUID();
    const text = 'a sentence from before the historical capture authority existed';
    const unit = randomUUID();
    await asReplica(async () => {
      await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')",
        [session, owner]);
      await q('INSERT INTO public.session_semantic_clocks (session_id, user_id, current_sp, same_sp_event_sequence) VALUES ($1, $2, 1, 0)',
        [session, owner]);
      await q("INSERT INTO public.session_historical_coverage (session_id, user_id, coverage_state) VALUES ($1, $2, 'LEGACY_UNCOVERED')",
        [session, owner]);
      await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
               VALUES ($1, $2, $3, 'USER', 'COMPLETED', $4)`, [turn, session, owner, text]);
      await q(`INSERT INTO public.conversation_unit_commit_batches
                 (id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256,
                  unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
                  segmentation_prompt_version)
               VALUES ($1, $2, $3, $4, sha256($5::bytea), sha256($5::bytea), 2, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
      [batch, owner, session, turn, Buffer.from(`${session}:${text}`, 'utf8')]);
      for (const [index, id] of [[0, unit], [1, randomUUID()]]) {
        const body = `${text} ${index + 1}`;
        await q(
          `INSERT INTO public.conversation_units
             (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
              source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text,
              source_content_sha256, session_position)
           VALUES ($1, $2, $3, $4, $5, $6, 'RESOLVED', 'TEXT', $7, 0, $8, $9, sha256(convert_to($9, 'UTF8')), $10)`,
          [id, owner, session, turn, batch, index % 2 === 0 ? 'USER' : 'ASSISTANT', index,
            [...body].length, body, index + 1]);
      }
      await q('UPDATE public.session_semantic_clocks SET current_sp = 2 WHERE session_id = $1', [session]);
    });
    await rt.asRole('postgres');
    assert.equal((await rows('SELECT count(*)::int n FROM public.session_historical_baselines WHERE session_id = $1', [session]))[0].n,
      0, 'a LEGACY UNCOVERED Session never receives a historical baseline');
    return { session, turn, batch, unit };
  }

  // ---- the three human primitives, with named arguments
  const preview = (s) => rows(
    'SELECT * FROM public.prepare_replay_preview_v1($1, $2, $3, $4, $5, $6)',
    [s.command, s.replay, s.expectedRevision, s.projection, s.contract, s.version]);
  const finalize = (s) => rows(
    'SELECT * FROM public.finalize_replay_version_v1($1, $2, $3)', [s.command, s.replay, s.version]);
  const reopen = (s) => rows(
    'SELECT * FROM public.reopen_replay_for_revision_v1($1, $2, $3)', [s.command, s.replay, s.version]);
  const currentVersion = (replay, user) =>
    rows('SELECT * FROM public.resolve_replay_current_version_v1($1, $2)', [replay, user]);
  const truthCurrency = (version) =>
    rows('SELECT * FROM public.derive_replay_version_truth_currency_v1($1)', [version]);
  /** K(TC) straight from the canonical projection, for the no-hindsight proofs. */
  const canonicalProjection = (session, tc) =>
    rows('SELECT * FROM public.get_session_historical_projection_v1($1, $2)', [session, tc]);

  /** Fresh opaque identities for one preview. */
  const freshPreview = (replay, expectedRevision) => ({
    command: randomUUID(), replay, expectedRevision,
    projection: randomUUID(), contract: randomUUID(), version: randomUUID(),
  });

  /** The whole immutable I-06B composition of one Replay, for before/after snapshots. */
  async function versionSnapshot(replay) {
    return {
      versions: await rows(`SELECT * FROM ${V.VERSIONS} WHERE replay_id = $1 ORDER BY replay_version_revision`, [replay]),
      projections: await rows(`SELECT * FROM ${V.PROJECTIONS} WHERE replay_id = $1 ORDER BY projection_revision`, [replay]),
      points: await rows(`SELECT p.* FROM ${V.POINTS} p JOIN ${V.PROJECTIONS} v ON v.id = p.projection_version_id
                           WHERE v.replay_id = $1 ORDER BY v.projection_revision, p.selected_ordinal`, [replay]),
      contracts: await rows(`SELECT * FROM ${V.CONTRACTS} WHERE replay_id = $1 ORDER BY contract_revision`, [replay]),
      finalizations: await rows(`SELECT f.* FROM ${V.FINALIZATIONS} f WHERE f.replay_id = $1 ORDER BY f.replay_version_id`, [replay]),
      lifecycle: await rows(`SELECT * FROM ${V.LIFECYCLE} WHERE replay_id = $1 ORDER BY event_ordinal`, [replay]),
    };
  }

  /**
   * Remove every committed I-06B row of the given humans, lifting the eight
   * append-only guards inside ONE transaction and proving them back. Runs BEFORE
   * the I-06A teardown, because every I-06B component binds an I-06A component
   * restrictively.
   */
  async function removeCommittedReplayVersions(humans) {
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      for (const [table, trigger] of I06B_IMMUTABLE) await q(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
      const replays = 'SELECT id FROM public.replays WHERE created_by_user_id = ANY($1::uuid[])';
      const specs = `SELECT id FROM public.replay_selection_spec_versions WHERE replay_id IN (${replays})`;
      const projections = `SELECT id FROM ${V.PROJECTIONS} WHERE replay_id IN (${replays})`;
      await q(`DELETE FROM ${V.PREVIEW_COMMANDS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${V.FINALIZE_COMMANDS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${V.REOPEN_COMMANDS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${V.FINALIZATIONS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${V.LIFECYCLE} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${V.POINTER} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${V.VERSIONS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${V.CONTRACTS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${V.POINTS} WHERE projection_version_id IN (${projections})`, [humans]);
      await q(`DELETE FROM ${V.PROJECTIONS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${V.GAPS} WHERE selection_spec_version_id IN (${specs})`, [humans]);
      await q(`DELETE FROM ${V.CUTS} WHERE selection_spec_version_id IN (${specs})`, [humans]);
      for (const [table, trigger] of I06B_IMMUTABLE) await q(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
    } finally {
      await q('COMMIT').catch(async () => { await q('ROLLBACK'); });
    }
    for (const [table, trigger] of I06B_IMMUTABLE) {
      assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled again after Replay Version teardown`);
    }
  }

  /**
   * Remove the Personal Session fixture of the given humans - the committed
   * units, their Session, the clock, the coverage decision, the baseline and
   * the analytical state - with every guard standing aside.
   *
   * It runs BEFORE the Public support removes the humans, because the committed
   * Personal source and the analytical rows bind them restrictively and a
   * teardown that left them would silently roll the whole removal back.
   */
  async function removeHistoricalFixture(humans) {
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      await q("SET LOCAL session_replication_role = 'replica'");
      const sessions = 'SELECT id FROM public.conversation_sessions WHERE user_id = ANY($1::uuid[])';
      await q('DELETE FROM public.historical_reading_events WHERE user_id = ANY($1::uuid[])', [humans]);
      await q('DELETE FROM public.hypotheses WHERE user_id = ANY($1::uuid[])', [humans]);
      await q('DELETE FROM public.session_historical_baselines WHERE user_id = ANY($1::uuid[])', [humans]);
      await q('DELETE FROM public.session_historical_coverage WHERE user_id = ANY($1::uuid[])', [humans]);
      await q('DELETE FROM public.historical_world_semantic_clocks WHERE user_id = ANY($1::uuid[])', [humans]);
      await q(`DELETE FROM public.conversation_units WHERE session_id IN (${sessions})`, [humans]);
      await q(`DELETE FROM public.conversation_unit_commit_batches WHERE session_id IN (${sessions})`, [humans]);
      await q(`DELETE FROM public.conversation_turns WHERE session_id IN (${sessions})`, [humans]);
      await q(`DELETE FROM public.session_semantic_clocks WHERE session_id IN (${sessions})`, [humans]);
      await q('DELETE FROM public.conversation_sessions WHERE user_id = ANY($1::uuid[])', [humans]);
      await q("SET LOCAL session_replication_role = 'origin'");
    } finally {
      await q('COMMIT').catch(async () => { await q('ROLLBACK'); });
    }
  }

  /**
   * Remove the fixture humans themselves, LAST.
   *
   * It lives here rather than inline in a verifier because a best-effort
   * `.catch()` around a teardown DELETE reads, to the hazard detectors and to
   * the next author, exactly like a swallowed runtime refusal - and one of
   * those really does leave the transaction aborted. Its own transaction makes
   * the intent unambiguous and needs no catch at the call site.
   */
  async function removeFixtureHumans(humans) {
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      await q("SET LOCAL session_replication_role = 'replica'");
      await q('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
      await q('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [humans]);
      await q("SET LOCAL session_replication_role = 'origin'");
    } finally {
      await q('COMMIT').catch(async () => { await q('ROLLBACK'); });
    }
  }

  return {
    ...rt, V, VFN, CONTRACT_POLICY, asReplica,
    provisionHistoricalSession, provisionLegacySession,
    preview, finalize, reopen, currentVersion, truthCurrency, canonicalProjection,
    freshPreview, versionSnapshot, removeCommittedReplayVersions, removeHistoricalFixture,
    removeFixtureHumans,
  };
}

export { runVerifier, APP_ROLES, NONE, SEAM, T } from './public-runtime-verifier-support.mjs';
export { R, FN, REPLAY_IMMUTABLE } from './replay-verifier-support.mjs';
