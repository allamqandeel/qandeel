// Shared support for the I-06D real-PostgreSQL verifiers (migrations 0106 and
// 0107).
//
// The I-06D verifiers reach their subjects through the SAME fixture shape the
// I-06A, I-06B and I-06C Replay verifiers use - the frozen Public support
// runtime, the frozen 0064 Personal source, the canonical historical analytical
// state, a historically FINALIZED Replay Version - so they compose the
// distribution runtime rather than copying it, and add only what POST-
// FINALIZATION truth needs: the new relation and function names, the source
// surgery that makes a bound source stop being current and puts it back, a
// package taken all the way to AUTHORIZED through the controlled seams, and a
// teardown that lifts the three I-06D append-only guards inside ONE transaction
// and proves them back.
//
// ## Why the source surgery is what it is
//
// At this baseline a bound Personal source CANNOT be hard-deleted: 0100 binds
// `replay_source_manifest_items.personal_conversation_unit_id` to
// `conversation_units` with ON DELETE RESTRICT, so the database refuses to
// remove a committed unit a Replay still names. The source-loss shapes that are
// genuinely reachable for a finalized MY_WORLD Replay are therefore
//
//   SOURCE_CHANGED       the committed bytes moved, so the captured digest no
//                        longer matches
//   SOURCE_UNAVAILABLE   the exact captured row is no longer the creator's at
//                        the captured Session Position
//
// and both are produced here by fixture surgery with triggers standing aside,
// exactly as the frozen 0072 and I-06C verifiers do. Nothing simulates a source
// loss by weakening the currency derivation - that derivation's own delegation
// is proven separately, by a probe that is rolled back.
//
// ## Why the seams are simulated rather than granted
//
// Unchanged from I-06C, and for the same reason. Production is fail-closed on
// the analytical subject-authority seam and on the CW2-08 prerequisite seam.
// Neither is weakened. A scenario that must reach PAST one of them replaces the
// seam's BODY inside a transaction the verifier rolls back, and the production
// body is proven back byte for byte. Production behaviour - that current
// eligibility answers AUTHORITY_UNRESOLVED while the analytical seam is
// unresolved - is proven directly rather than assumed.
//
// Nothing in this module asserts anything about a migration on its own.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createReplayDistributionRuntime } from './replay-distribution-verifier-support.mjs';

// ------------------------------------------------------------------ relations
export const C = Object.freeze({
  SOURCE_EVENTS: 'public.replay_source_availability_reconciliation_events',
  DISTRIBUTION_EVENTS: 'public.replay_distribution_reconciliation_events',
  COMMANDS: 'public.replay_reconciliation_commands',
});

/** Every append-only I-06D relation with the trigger that guards it. */
export const I06D_IMMUTABLE = [
  [C.SOURCE_EVENTS, 'replay_source_availability_reconciliation_events_immutable'],
  [C.DISTRIBUTION_EVENTS, 'replay_distribution_reconciliation_events_immutable'],
  [C.COMMANDS, 'replay_reconciliation_commands_immutable'],
];

// ------------------------------------------------------------------ functions
export const CFN = Object.freeze({
  AVAILABILITY: 'public.derive_replay_version_current_availability_v1(uuid, uuid)',
  USABILITY: 'public.resolve_replay_version_current_usability_v1(uuid, uuid, uuid)',
  ELIGIBILITY: 'public.derive_replay_distribution_current_eligibility_v1(uuid)',
  DISTRIBUTION_STATE: 'public.resolve_replay_distribution_current_state_v1(uuid, uuid)',
  RECONCILE: 'public.reconcile_replay_post_finalization_state_v1(uuid, uuid, uuid, uuid)',
  MUTATION_TRIGGER: 'public.reject_replay_post_finalization_mutation_v1()',
  /** The canonical predecessors this slice consumes and never replaces. */
  SOURCE_CURRENCY: 'public.derive_replay_source_manifest_currency_v1(uuid)',
  TRUTH_CURRENCY: 'public.derive_replay_version_truth_currency_v1(uuid)',
  PUBLIC_VISIBILITY: 'public.resolve_public_visibility_state_v1(uuid)',
});

/** Result columns no I-06D read boundary may ever declare. */
export const CLOSURE_DISCLOSURE_BAN = /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material|history_item|availability_state|staleness|divergence|context_ref|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|experience|approver|manifest|selection|render_contract/u;

/** The bounded creator-facing classes, and the whole of them. */
export const USABILITY_CLASSES = ['REPLAY_VERSION_NOT_FINALIZED', 'SOURCE_NOT_CURRENTLY_AVAILABLE',
  'SOURCE_STATE_CONTRADICTORY', 'ANALYTICAL_EVIDENCE_INCOMPLETE'];
export const DISTRIBUTION_CLASSES = ['NOT_AUTHORIZED', 'SOURCE_NOT_CURRENTLY_AVAILABLE',
  'AUTHORITY_NO_LONGER_CURRENT', 'DESTINATION_NOT_CURRENTLY_SERVING',
  'DISTRIBUTION_PREREQUISITE_UNRESOLVED', 'PACKAGE_STATE_CONTRADICTORY'];

// -------------------------------------------------------------------- runtime
export function createReplayClosureRuntime(databaseUrl) {
  const rt = createReplayDistributionRuntime(databaseUrl);
  const { q, rows } = rt;

  // ---- the I-06D read boundaries and the one primitive, with named arguments
  const availability = (replay, version) =>
    rows('SELECT * FROM public.derive_replay_version_current_availability_v1($1, $2)', [replay, version]);
  const usability = (replay, version, user) =>
    rows('SELECT * FROM public.resolve_replay_version_current_usability_v1($1, $2, $3)', [replay, version, user]);
  const eligibility = (packageId) =>
    rows('SELECT * FROM public.derive_replay_distribution_current_eligibility_v1($1)', [packageId]);
  const distributionState = (packageId, user) =>
    rows('SELECT * FROM public.resolve_replay_distribution_current_state_v1($1, $2)', [packageId, user]);
  const reconcile = (s) => rows(
    'SELECT * FROM public.reconcile_replay_post_finalization_state_v1($1, $2, $3, $4)',
    [s.command, s.replay, s.version, s.package ?? null]);

  /**
   * Fixture surgery with every trigger standing aside, as the frozen 0072 and
   * I-06B helpers do. Foreign keys are trigger-implemented in PostgreSQL, so a
   * unit can be moved out from under a Replay here in a way production could
   * never do - which is exactly the point: the derivation must answer about
   * whatever the world currently is.
   */
  async function asReplica(work) {
    await rt.asRole('postgres');
    await q("SET LOCAL session_replication_role = 'replica'");
    try { return await work(); } finally { await q("SET LOCAL session_replication_role = 'origin'"); }
  }

  /** The exact committed bytes of one source unit, so a scenario can put them back. */
  const sourceTextOf = async (unit) => (await rows(
    'SELECT committed_text FROM public.conversation_units WHERE id = $1', [unit]))[0]?.committed_text ?? null;

  /**
   * THE SOURCE CHANGES. One character is replaced by another rather than
   * appended: the committed text is pinned to its own source span by a frozen
   * CHECK, so identical length and different bytes is the only shape a change
   * can take. The captured digest stops matching, and the canonical derivation
   * answers SOURCE_CHANGED.
   */
  const changeSourceText = (unit, character = 'Z') => asReplica(() => q(
    `UPDATE public.conversation_units
        SET committed_text = overlay(committed_text placing $2 from 1 for 1)
      WHERE id = $1`, [unit, character]));

  /** The exact original bytes back, so the fixture is what it was. */
  const restoreSourceText = (unit, text) => asReplica(() => q(
    'UPDATE public.conversation_units SET committed_text = $2 WHERE id = $1', [unit, text]));

  /**
   * THE SOURCE BECOMES UNAVAILABLE. The captured row is no longer the creator's
   * at the captured Session Position, which is exactly what the canonical
   * derivation tests before it tests anything else, so it answers
   * SOURCE_UNAVAILABLE.
   */
  const detachSourceUnit = (unit, other) => asReplica(() => q(
    'UPDATE public.conversation_units SET user_id = $2 WHERE id = $1', [unit, other]));
  const restoreSourceOwner = (unit, owner) => asReplica(() => q(
    'UPDATE public.conversation_units SET user_id = $2 WHERE id = $1', [unit, owner]));

  /**
   * VERIFIER-ONLY SIMULATION of the canonical source-currency derivation.
   *
   * Used for ONE purpose: proving that the 0106 availability derivation really
   * DELEGATES rather than re-deriving. A canonical answer this fixture cannot
   * produce for a MY_WORLD source - SOURCE_CONTRADICTORY, which the canonical
   * derivation genuinely produces for a Shared or Public manifest - is fed in
   * here, and the mapping either carries it through or it does not. The caller
   * rolls back and proves the production body back byte for byte.
   */
  async function simulateSourceCurrency(state, staleness) {
    await q(`CREATE OR REPLACE FUNCTION public.derive_replay_source_manifest_currency_v1(
               p_source_manifest_version_id uuid)
             RETURNS TABLE(currency_state text, staleness_class text)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $probe$
             BEGIN
               IF p_source_manifest_version_id IS NULL THEN
                 RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
               END IF;
               -- I-06D VERIFIER PROBE: a simulated canonical source answer inside
               -- a verifier transaction; never a production state.
               RETURN QUERY SELECT '${state}'::text, ${staleness === null ? 'NULL' : `'${staleness}'`}::text;
             END$probe$`);
  }

  /**
   * ONE distribution package of an already finalized Replay Version, taken all
   * the way to a historical AUTHORIZED record through the frozen I-06C
   * primitives alone, with BOTH seams simulated by the caller.
   *
   * Returns the package spec plus the approval id, so a scenario can withdraw
   * the exact consent that was given.
   */
  async function authorizePackage(base, creator, destination = 'DOWNLOAD', experience = null) {
    const isPublic = destination === 'PUBLISH_TO_PUBLIC_WORLD';
    const spec = { ...rt.freshPackage(base.replay, base.version, destination),
      ...(isPublic ? rt.freshPublic(experience) : {}) };
    await rt.actAs(creator);
    const [prepared] = await rt.prepare(spec);
    assert.equal(prepared.outcome, 'REPLAY_DISTRIBUTION_PACKAGE_PREPARED',
      'fixture: the distribution package was prepared');
    const approval = randomUUID();
    const [approved] = await rt.approve({
      approval, package: spec.package, publicApproval: isPublic ? randomUUID() : null });
    assert.equal(approved.outcome, 'REPLAY_DISTRIBUTION_APPROVED', 'fixture: the required human approved');

    // A Public destination reaches READY_FOR_REVIEW through the CANONICAL Public
    // primitive, and the canonical Public prerequisite seam is cleared for the
    // duration of the publish exactly as the frozen I-05B verifiers do - then
    // restored, and proven back, whatever happened.
    let publicSeam = null;
    if (isPublic) {
      publicSeam = await rt.captureSeamDefinition(
        'public.resolve_public_publication_prerequisites_v1(uuid, uuid)',
        { expect: ['NOT_EVALUATED'], forbid: ["'CLEARED'"] });
      await rt.actAs(creator);
      await rows('SELECT * FROM public.commit_public_experience_ready_for_review_v1($1, $2, $3)',
        [randomUUID(), experience, spec.publicVersion]);
      await rt.asRole('postgres');
      await rt.clearPrerequisites();
    }
    let authorized;
    try {
      await rt.actAs(creator);
      [authorized] = await rt.authorize({
        command: randomUUID(), package: spec.package,
        publicPublishCommand: isPublic ? randomUUID() : null });
    } finally {
      if (publicSeam) {
        await rt.asRole('postgres');
        await rt.restorePrerequisites(publicSeam);
      }
    }
    assert.ok(['AUTHORIZED_FOR_DELIVERY', 'PUBLIC_PUBLICATION_COMMITTED'].includes(authorized.distribution_state),
      'fixture: the package reached a historical authorization');
    await rt.asRole('postgres');
    return { ...spec, approval, reference: prepared.audience_safe_reference,
      historical: authorized.distribution_state };
  }

  /** Fresh opaque identities for one reconciliation command. */
  const freshReconciliation = (replay, version, packageId = null) => ({
    command: randomUUID(), replay, version, package: packageId,
  });

  /**
   * The CURRENT draft revision of one Replay, read rather than assumed.
   *
   * `prepare_replay_preview_v1` takes the expected revision, and a literal here
   * would encode what the fixture happens to have done so far - which the next
   * scenario that revises a draft would silently make wrong, in a way that reads
   * as a MIGRATION failure rather than as a fixture drift.
   */
  const draftRevision = async (replay) => Number((await rows(
    `SELECT draft_revision FROM ${rt.R.DRAFT_STATE} WHERE replay_id = $1`, [replay]))[0].draft_revision);

  /**
   * Remove the committed I-05C DISAPPEARANCE record of the given Experiences.
   *
   * The frozen I-06C teardown does not do this, and correctly: the I-06C
   * verifier never performs a disappearance, so it never leaves one. The I-06D
   * verifier does - proving that canonical Public disappearance dominates Replay
   * state is the point of P03, P05 and C03 - and both disappearance relations
   * bind `public_experience_publication_state` with ON DELETE RESTRICT. Without
   * this, the frozen helper fails on a foreign key, at teardown, with a message
   * about a table the reader has no reason to connect to what the run proved.
   *
   * It runs BEFORE the frozen helper and lifts only the ONE I-05C guard that
   * exists here, inside ONE transaction, and proves it back.
   */
  async function removePublicDisappearanceRecord(experiences) {
    if (experiences.length === 0) return;
    const guard = ['public.public_experience_disappearance_state',
      'public_experience_disappearance_state_immutable'];
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      await q(`ALTER TABLE ${guard[0]} DISABLE TRIGGER ${guard[1]}`);
      await q('DELETE FROM public.public_experience_disappearance_commands WHERE experience_id = ANY($1::uuid[])',
        [experiences]);
      await q(`DELETE FROM ${guard[0]} WHERE experience_id = ANY($1::uuid[])`, [experiences]);
      await q(`ALTER TABLE ${guard[0]} ENABLE TRIGGER ${guard[1]}`);
    } finally {
      await q('COMMIT').catch(async () => { await q('ROLLBACK'); });
    }
    assert.equal(await rt.triggerEnabled(guard[0], guard[1]), true,
      `${guard[1]} is enabled again after the Public disappearance teardown`);
  }

  /**
   * Remove every committed I-06D row of the given humans, lifting the three
   * append-only guards inside ONE transaction and proving them back. Runs BEFORE
   * the I-06C teardown, because every I-06D relation binds an I-06C or I-06B
   * component restrictively.
   */
  async function removeCommittedReconciliations(humans) {
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      for (const [table, trigger] of I06D_IMMUTABLE) await q(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
      const replays = 'SELECT id FROM public.replays WHERE created_by_user_id = ANY($1::uuid[])';
      await q(`DELETE FROM ${C.COMMANDS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${C.DISTRIBUTION_EVENTS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${C.SOURCE_EVENTS} WHERE replay_id IN (${replays})`, [humans]);
      for (const [table, trigger] of I06D_IMMUTABLE) await q(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
    } finally {
      await q('COMMIT').catch(async () => { await q('ROLLBACK'); });
    }
    for (const [table, trigger] of I06D_IMMUTABLE) {
      assert.equal(await rt.triggerEnabled(table, trigger), true,
        `${trigger} is enabled again after Replay post-finalization teardown`);
    }
  }

  return {
    ...rt, C, CFN, I06D_IMMUTABLE, USABILITY_CLASSES, DISTRIBUTION_CLASSES,
    availability, usability, eligibility, distributionState, reconcile,
    asReplica, sourceTextOf, changeSourceText, restoreSourceText, detachSourceUnit, restoreSourceOwner,
    simulateSourceCurrency, authorizePackage, freshReconciliation, draftRevision,
    removeCommittedReconciliations, removePublicDisappearanceRecord,
  };
}

export { runVerifier, APP_ROLES, NONE, SEAM, T } from './public-runtime-verifier-support.mjs';
export { R, FN, REPLAY_IMMUTABLE } from './replay-verifier-support.mjs';
export { V, VFN, I06B_IMMUTABLE } from './replay-version-verifier-support.mjs';
export { D, DFN, DESTINATIONS, SANITIZED_POLICY, I06C_IMMUTABLE } from './replay-distribution-verifier-support.mjs';
