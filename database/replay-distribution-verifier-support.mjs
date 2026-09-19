// Shared support for the I-06C real-PostgreSQL verifiers (migrations 0104 and
// 0105).
//
// The I-06C verifiers reach their subjects through the SAME fixture shape the
// I-06A and I-06B Replay verifiers use - the frozen Public support runtime, the
// frozen 0064 Personal source, the canonical historical analytical state - so
// they compose the Replay Version runtime rather than copying it, and add only
// what a DISTRIBUTION needs: the new relation and function names, a Replay taken
// all the way to a historically FINALIZED Replay Version whose selected segments
// are the creator's OWN committed sentences, the two fail-closed seams with
// simulate-and-restore helpers, the four human primitives, and a teardown that
// lifts the I-06C append-only guards inside ONE transaction and proves them back.
//
// ## Why the seams are simulated rather than granted
//
// Production I-06C is fail-closed on two independent seams: the analytical
// distribution authority, which no canonical producer can resolve, and the
// CW2-08 prerequisite, which has no executable runtime. Neither is weakened.
// Every scenario that needs to reach past one of them replaces the seam's BODY
// inside a transaction the verifier rolls back, exactly as the frozen I-05B and
// I-05C verifiers reach PUBLISHED - never a migration, never a grant, never a
// persisted clearance row. `captureSeamDefinition` records the production body
// first and `restoreSeamDefinition` proves it back byte for byte.
//
// Nothing in this module asserts anything about a migration on its own.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createReplayVersionRuntime } from './replay-version-verifier-support.mjs';

// ------------------------------------------------------------------ relations
export const D = Object.freeze({
  PACKAGES: 'public.replay_distribution_package_versions',
  REQUIRED: 'public.replay_distribution_required_approvers',
  APPROVALS: 'public.replay_distribution_approvals',
  WITHDRAWALS: 'public.replay_distribution_approval_withdrawal_events',
  DESCRIPTORS: 'public.replay_distribution_export_descriptors',
  ARTIFACTS: 'public.replay_public_distribution_artifacts',
  AUTHORIZATIONS: 'public.replay_distribution_authorizations',
  PREPARE_COMMANDS: 'public.replay_distribution_prepare_commands',
  WITHDRAWAL_COMMANDS: 'public.replay_distribution_withdrawal_commands',
  AUTHORIZATION_COMMANDS: 'public.replay_distribution_authorization_commands',
});

/** Every append-only I-06C relation with the trigger that guards it. */
export const I06C_IMMUTABLE = [
  [D.PACKAGES, 'replay_distribution_package_versions_immutable'],
  [D.REQUIRED, 'replay_distribution_required_approvers_immutable'],
  [D.APPROVALS, 'replay_distribution_approvals_immutable'],
  [D.WITHDRAWALS, 'replay_distribution_approval_withdrawal_events_immutable'],
  [D.DESCRIPTORS, 'replay_distribution_export_descriptors_immutable'],
  [D.ARTIFACTS, 'replay_public_distribution_artifacts_immutable'],
  [D.AUTHORIZATIONS, 'replay_distribution_authorizations_immutable'],
];

// ------------------------------------------------------------------ functions
export const DFN = Object.freeze({
  ANALYTICAL_SEAM: 'public.resolve_replay_analytical_distribution_authority_v1(uuid)',
  PREREQUISITE_SEAM: 'public.resolve_replay_distribution_prerequisites_v1(uuid, text)',
  DESCRIPTOR_DIGEST: 'public.replay_export_descriptor_digest_v1(text, text, text, text, integer, integer, text, text, text, text, text, text, text, text, text, text, text, text, text)',
  DESCRIPTOR: 'public.derive_replay_export_descriptor_v1(uuid, text, text)',
  FINGERPRINT: 'public.replay_distribution_authority_fingerprint_v1(text, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, text, text, text, uuid[], uuid)',
  APPROVERS: 'public.derive_replay_distribution_required_approvers_v1(uuid)',
  AUTHORITY: 'public.derive_replay_distribution_authority_v1(uuid)',
  APPROVAL_STATE: 'public.derive_replay_distribution_approval_effective_state_v1(uuid)',
  EFFECTIVE: 'public.derive_replay_distribution_effective_approvals_v1(uuid)',
  BRIDGE: 'public.replay_prepare_public_distribution_artifact_v1(uuid, uuid, uuid, uuid, uuid, timestamptz)',
  PREPARE: 'public.prepare_replay_distribution_package_v1(uuid, uuid, uuid, uuid, text, uuid, uuid, uuid, uuid)',
  APPROVE: 'public.approve_replay_distribution_v1(uuid, uuid, uuid)',
  WITHDRAW: 'public.withdraw_replay_distribution_approval_v1(uuid, uuid, uuid)',
  AUTHORIZE: 'public.authorize_replay_distribution_v1(uuid, uuid, uuid)',
  PACKAGE_RESOLVER: 'public.resolve_replay_distribution_package_v1(uuid, uuid)',
  PUBLIC_RESOLVER: 'public.resolve_public_replay_artifact_v1(text, uuid)',
  MUTATION_TRIGGER: 'public.reject_replay_distribution_mutation_v1()',
  OPAQUE_TRIGGER: 'public.replay_distribution_audience_reference_v1()',
  /** The canonical Public authority derivation this slice extends additively. */
  PUBLIC_AUTHORITY: 'public.derive_public_publication_authority_v1(uuid)',
});

/** The three frozen destination actions. */
export const DESTINATIONS = ['PUBLISH_TO_PUBLIC_WORLD', 'SHARE_EXTERNALLY', 'DOWNLOAD'];

/** Result columns no I-06C read boundary may ever declare. */
export const DISTRIBUTION_DISCLOSURE_BAN = /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material|history_item|availability|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|experience|approver_user|basis|reason/u;

/** Result columns the PUBLIC Replay artifact resolver may never declare. */
export const PUBLIC_ARTIFACT_DISCLOSURE_BAN = /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material|history_item|availability|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|replay|manifest|selection|render_contract|distribution/u;

/** The exact sanitized surface every export descriptor carries at this baseline. */
export const SANITIZED_POLICY = Object.freeze({
  sanitization_contract_id: 'QANDEEL_REPLAY_EXPORT_SANITIZATION_V1',
  source_medium_class: 'ORIGINAL_TEXT_ONLY',
  original_medium_policy: 'PRESERVE_ORIGINAL_MEDIUM_ONLY',
  exact_text_policy: 'EXACT_SOURCE_TEXT',
  semantic_cut_policy: 'WHOLE_ITEM_ONLY_PROVEN_SAFE',
  temporal_gap_policy: 'PERCEPTIBLE_DISCONTINUITY_REQUIRED',
  timing_integrity_policy: 'PRESENTATION_PACING_DECLARED',
  analytical_projection_policy: 'BOUND_HISTORICAL_PROJECTION_DIGEST',
  camera_emphasis_policy: 'EMPHASIS_WITHOUT_MEANING_CREATION',
  motion_policy: 'EXPLANATORY_MOTION_ONLY',
  caption_policy: 'DERIVED_CAPTION_DISTINCT_FROM_SOURCE',
  accessibility_parity_policy: 'EQUIVALENT_TRUTH_REQUIRED',
  reduced_motion_parity_policy: 'EQUIVALENT_TRUTH_REQUIRED',
  editorial_annotation_policy: 'NO_EDITORIAL_ANNOTATION',
});

// -------------------------------------------------------------------- runtime
export function createReplayDistributionRuntime(databaseUrl) {
  const rt = createReplayVersionRuntime(databaseUrl);
  const { q, rows } = rt;

  // ---- the four human primitives, with named arguments
  const prepare = (s) => rows(
    'SELECT * FROM public.prepare_replay_distribution_package_v1($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [s.command, s.replay, s.version, s.package, s.destination,
      s.publicExperience ?? null, s.publicManifest ?? null, s.publicVersion ?? null, s.publicItem ?? null]);
  const approve = (s) => rows(
    'SELECT * FROM public.approve_replay_distribution_v1($1, $2, $3)',
    [s.approval, s.package, s.publicApproval ?? null]);
  const withdraw = (s) => rows(
    'SELECT * FROM public.withdraw_replay_distribution_approval_v1($1, $2, $3)',
    [s.command, s.approval, s.publicCommand ?? null]);
  const authorize = (s) => rows(
    'SELECT * FROM public.authorize_replay_distribution_v1($1, $2, $3)',
    [s.command, s.package, s.publicPublishCommand ?? null]);

  // ---- the derivations, as read boundaries a verifier can compare
  const requiredApprovers = (version) =>
    rows('SELECT * FROM public.derive_replay_distribution_required_approvers_v1($1)', [version]);
  const packageAuthority = (packageId) =>
    rows('SELECT * FROM public.derive_replay_distribution_authority_v1($1)', [packageId]);
  const approvalState = (approval) =>
    rows('SELECT * FROM public.derive_replay_distribution_approval_effective_state_v1($1)', [approval]);
  const effectiveApprovals = (packageId) =>
    rows('SELECT * FROM public.derive_replay_distribution_effective_approvals_v1($1)', [packageId]);
  const exportDescriptor = (version, destination, reference) =>
    rows('SELECT * FROM public.derive_replay_export_descriptor_v1($1, $2, $3)', [version, destination, reference]);
  const analyticalAuthority = (projection) =>
    rows('SELECT * FROM public.resolve_replay_analytical_distribution_authority_v1($1)', [projection]);
  const distributionPrerequisites = (packageId, destination) =>
    rows('SELECT * FROM public.resolve_replay_distribution_prerequisites_v1($1, $2)', [packageId, destination]);
  const resolvePackage = (packageId, user) =>
    rows('SELECT * FROM public.resolve_replay_distribution_package_v1($1, $2)', [packageId, user]);
  const resolvePublicArtifact = (reference, viewer) =>
    rows('SELECT * FROM public.resolve_public_replay_artifact_v1($1, $2)', [reference, viewer]);

  /** Fresh opaque identities for one package preparation. */
  const freshPackage = (replay, version, destination) => ({
    command: randomUUID(), replay, version, package: randomUUID(), destination,
  });
  /** The four extra identities a Public preparation needs. */
  const freshPublic = (experience) => ({
    publicExperience: experience, publicManifest: randomUUID(),
    publicVersion: randomUUID(), publicItem: randomUUID(),
  });

  // ---- seam simulation, captured and restored
  /**
   * The production body of one seam, recorded so a scenario can prove it back.
   *
   * `expect` is the exact text the PRODUCTION body must contain and `forbid` the
   * text it must not: a capture that did not check would happily record an
   * already-weakened seam and then "restore" it.
   */
  async function captureSeamDefinition(signature, { expect = [], forbid = [] } = {}) {
    const [row] = await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      [signature]);
    assert.ok(row && row.definition.includes('CREATE OR REPLACE FUNCTION'),
      `${signature} definition is readable`);
    for (const needle of expect) {
      assert.ok(row.prosrc.includes(needle), `the production ${signature} answers ${needle}`);
    }
    for (const needle of forbid) {
      assert.ok(!row.prosrc.includes(needle), `the production ${signature} never answers ${needle}`);
    }
    return { signature, ...row };
  }
  async function restoreSeamDefinition(seam) {
    await q(seam.definition);
    const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      [seam.signature]);
    assert.equal(prosrc, seam.prosrc, `the production ${seam.signature} is restored byte for byte`);
    for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
      assert.equal(await rt.canExecute(role, seam.signature), false,
        `${role} still cannot execute the restored ${seam.signature}`);
    }
  }

  /**
   * VERIFIER-ONLY SIMULATION of a later reviewed protected-human subject
   * authority resolver. Replaces the analytical seam body inside the caller's
   * transaction; the caller rolls back or restores. `approvers` is the exact set
   * that resolver would name - an empty array is a genuinely resolved EMPTY
   * requirement, which is a different fact from an unresolved one.
   */
  async function simulateAnalyticalAuthority(approvers) {
    const state = approvers.length > 0 ? 'RESOLVED_EXACT_HUMAN_REQUIREMENT' : 'RESOLVED_NO_HUMAN_REQUIREMENT';
    const list = approvers.length > 0
      ? `ARRAY[${approvers.map((id) => `'${id}'::uuid`).join(', ')}]`
      : 'ARRAY[]::uuid[]';
    await q(`CREATE OR REPLACE FUNCTION public.resolve_replay_analytical_distribution_authority_v1(
               p_analytical_projection_version_id uuid)
             RETURNS TABLE(resolution_state text, required_approvers uuid[], resolution_basis text)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $probe$
             BEGIN
               IF p_analytical_projection_version_id IS NULL THEN
                 RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
               END IF;
               RETURN QUERY SELECT '${state}'::text, ${list}::uuid[],
                 'I-06C VERIFIER PROBE: simulated protected-human subject authority inside a verifier transaction; never a production state'::text;
             END$probe$`);
  }

  /**
   * VERIFIER-ONLY SIMULATION of a later reviewed CW2-08 runtime. Every dimension
   * is positive unless `overrides` names one, which is how the composition proofs
   * show that no layer manufactures another.
   */
  async function simulateDistributionPrerequisites(overrides = {}) {
    const dimension = (name, positive) => `'${overrides[name] ?? positive}'::text`;
    await q(`CREATE OR REPLACE FUNCTION public.resolve_replay_distribution_prerequisites_v1(
               p_distribution_package_version_id uuid, p_destination_action text)
             RETURNS TABLE(clearance text, safety_state text, moderation_state text, entitlement_state text,
                           feature_state text, launch_state text, clearance_basis text)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $probe$
             BEGIN
               IF p_distribution_package_version_id IS NULL OR p_destination_action IS NULL THEN
                 RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
               END IF;
               RETURN QUERY SELECT ${dimension('clearance', 'CLEARED')},
                 ${dimension('safety_state', 'SAFETY_ALLOW')},
                 ${dimension('moderation_state', 'MODERATION_ALLOW')},
                 ${dimension('entitlement_state', 'ENTITLED')},
                 ${dimension('feature_state', 'FEATURE_ENABLED')},
                 ${dimension('launch_state', 'LAUNCH_CLEARED')},
                 'I-06C VERIFIER PROBE: simulated CW2-08 clearance inside a verifier transaction; never a production state'::text;
             END$probe$`);
  }

  /**
   * A COVERED Personal Session whose SELECTED segments are the creator's OWN
   * committed sentences at SEALED positions, taken all the way to a historically
   * FINALIZED Replay Version through the frozen I-06A and I-06B primitives alone.
   *
   * The session commits five units at positions 1..5 with alternating source
   * roles and a Live Head at 5, so positions 1..4 are sealed. The selection is
   * positions 1 and 3 - both USER-authored and both sealed - which is the only
   * shape a Replay distribution can carry: QANDEEL-authored Personal material
   * fails the source-authority derivation closed, and the open Live Head can
   * never be frozen into a Replay Version at all.
   *
   * The two selected positions are non-adjacent on purpose, so the render
   * contract carries a REAL temporal discontinuity and the sanitized descriptor
   * reports a gap count a verifier can compare rather than a constant zero.
   */
  async function provisionFinalizedReplay(owner) {
    const session = await rt.provisionHistoricalSession(owner, { units: 5 });
    const selected = [session.units[0], session.units[2]];
    const replay = randomUUID();
    const manifest = randomUUID();
    const selection = randomUUID();
    await rt.actAs(owner);
    const [created] = await rt.createDraft({
      command: randomUUID(), replay, manifest, selection, sourceClass: 'MY_WORLD',
      context: session.session, items: selected,
    });
    assert.equal(created.outcome, 'REPLAY_DRAFT_CREATED', 'fixture: the private Replay draft was created');
    const preview = rt.freshPreview(replay, 1);
    const [previewed] = await rt.preview(preview);
    assert.equal(previewed.outcome, 'REPLAY_PREVIEW_READY', 'fixture: one complete Replay Version was built');
    const [finalized] = await rt.finalize({ command: randomUUID(), replay, version: preview.version });
    assert.equal(finalized.outcome, 'REPLAY_VERSION_FINALIZED', 'fixture: that exact version was finalized');
    return { ...session, replay, manifest, selection, selectedUnits: selected, version: preview.version,
      projection: preview.projection, contract: preview.contract };
  }

  /**
   * A DRAFT Public Experience the given human controls, through the frozen I-05A
   * primitives alone.
   *
   * The canonical Public draft primitive is called by its own name rather than
   * through `rt.createDraft`: the Replay runtime legitimately shadows that helper
   * with the REPLAY draft creator, and a verifier that called the wrong one would
   * fail somewhere unrelated to what it was proving.
   */
  async function provisionControlledExperience(owner, ref, label) {
    const experience = randomUUID();
    await rt.actAs(owner);
    await rt.ensureIdentity(randomUUID(), ref, 'PSEUDONYM', label);
    const [drafted] = await rows('SELECT * FROM public.create_public_experience_draft_v1($1, $2)',
      [randomUUID(), experience]);
    assert.ok(drafted, 'fixture: the Public Experience draft was created');
    return experience;
  }

  /**
   * Remove every committed I-06C row of the given humans, lifting the seven
   * append-only guards inside ONE transaction and proving them back. Runs BEFORE
   * the I-06B teardown, because every I-06C relation binds an I-06B component
   * restrictively, and before the Public teardown for the same reason.
   */
  async function removeCommittedDistributions(humans) {
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      for (const [table, trigger] of I06C_IMMUTABLE) await q(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
      const replays = 'SELECT id FROM public.replays WHERE created_by_user_id = ANY($1::uuid[])';
      const packages = `SELECT id FROM ${D.PACKAGES} WHERE replay_id IN (${replays})`;
      await q(`DELETE FROM ${D.AUTHORIZATION_COMMANDS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${D.AUTHORIZATIONS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${D.WITHDRAWAL_COMMANDS} WHERE distribution_package_version_id IN (${packages})`, [humans]);
      await q(`DELETE FROM ${D.WITHDRAWALS} WHERE distribution_package_version_id IN (${packages})`, [humans]);
      await q(`DELETE FROM ${D.APPROVALS} WHERE distribution_package_version_id IN (${packages})`, [humans]);
      await q(`DELETE FROM ${D.REQUIRED} WHERE distribution_package_version_id IN (${packages})`, [humans]);
      await q(`DELETE FROM ${D.ARTIFACTS} WHERE distribution_package_version_id IN (${packages})`, [humans]);
      await q(`DELETE FROM ${D.DESCRIPTORS} WHERE distribution_package_version_id IN (${packages})`, [humans]);
      await q(`DELETE FROM ${D.PREPARE_COMMANDS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${D.PACKAGES} WHERE replay_id IN (${replays})`, [humans]);
      for (const [table, trigger] of I06C_IMMUTABLE) await q(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
    } finally {
      await q('COMMIT').catch(async () => { await q('ROLLBACK'); });
    }
    for (const [table, trigger] of I06C_IMMUTABLE) {
      assert.equal(await rt.triggerEnabled(table, trigger), true,
        `${trigger} is enabled again after Replay distribution teardown`);
    }
  }

  /**
   * Remove the Public Experience fixture these verifiers build - the package a
   * Replay publication created, its approvals, its lifecycle and the Experience
   * itself - lifting the frozen I-05 append-only guards inside ONE transaction.
   *
   * It is narrower than the frozen `removeCommittedFixtures` on purpose: that one
   * also removes the Shared World and the HUMANS, and running it here would try
   * to delete humans whose Personal Session and Replay fixtures are still
   * standing. Those bind restrictively, so the whole teardown would roll back
   * silently and the residue assertion would fail somewhere unrelated to what
   * failed.
   */
  async function removePublicReplayFixture(experiences) {
    if (experiences.length === 0) return;
    const guards = [
      ['public.public_experience_versions', 'public_experience_versions_immutable'],
      ['public.public_experience_lifecycle_events', 'public_experience_lifecycle_events_immutable'],
      ['public.publication_package_manifest_versions', 'publication_package_manifest_versions_immutable'],
      ['public.publication_package_manifest_items', 'publication_package_manifest_items_immutable'],
      ['public.public_experience_text_derivative_bodies', 'public_experience_text_derivative_bodies_immutable'],
      ['public.publication_package_item_provenance', 'publication_package_item_provenance_immutable'],
      ['public.publication_package_item_authority', 'publication_package_item_authority_immutable'],
      ['public.publication_manifest_required_approvers', 'publication_manifest_required_approvers_immutable'],
      ['public.publication_manifest_approvals', 'publication_manifest_approvals_immutable'],
      ['public.publication_approval_withdrawal_events', 'publication_approval_withdrawal_events_immutable'],
      ['public.public_experience_publication_state', 'public_experience_publication_state_immutable'],
    ];
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      for (const [table, trigger] of guards) await q(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
      const manifests = 'SELECT id FROM public.publication_package_manifest_versions WHERE experience_id = ANY($1::uuid[])';
      const ex = [experiences];
      await q(`DELETE FROM public.public_experience_publish_commands WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM public.public_experience_publication_state WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM public.publication_approval_withdrawal_commands WHERE manifest_version_id IN (${manifests})`, ex);
      await q(`DELETE FROM public.publication_approval_withdrawal_events WHERE manifest_version_id IN (${manifests})`, ex);
      await q(`DELETE FROM public.public_experience_review_ready_commands WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM public.publication_package_prepare_commands WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM public.publication_manifest_approvals WHERE manifest_version_id IN (${manifests})`, ex);
      await q(`DELETE FROM public.publication_manifest_required_approvers WHERE manifest_version_id IN (${manifests})`, ex);
      await q(`DELETE FROM public.publication_package_item_authority WHERE manifest_version_id IN (${manifests})`, ex);
      await q(`DELETE FROM public.publication_package_item_provenance WHERE manifest_version_id IN (${manifests})`, ex);
      await q(`DELETE FROM public.public_experience_text_derivative_bodies WHERE package_item_id IN
                 (SELECT package_item_id FROM public.publication_package_manifest_items
                   WHERE manifest_version_id IN (${manifests}))`, ex);
      await q(`DELETE FROM public.public_experience_lifecycle_events WHERE experience_id = ANY($1::uuid[])`, ex);
      await q('UPDATE public.public_experiences SET current_experience_version_id = NULL WHERE id = ANY($1::uuid[])', ex);
      await q(`DELETE FROM public.publication_package_manifest_items WHERE manifest_version_id IN (${manifests})`, ex);
      await q('DELETE FROM public.public_experience_versions WHERE experience_id = ANY($1::uuid[])', ex);
      await q('DELETE FROM public.publication_package_manifest_versions WHERE experience_id = ANY($1::uuid[])', ex);
      await q('DELETE FROM public.public_experience_controllers WHERE experience_id = ANY($1::uuid[])', ex);
      await q('DELETE FROM public.public_experience_draft_commands WHERE experience_id = ANY($1::uuid[])', ex);
      await q('DELETE FROM public.public_experiences WHERE id = ANY($1::uuid[])', ex);
      for (const [table, trigger] of guards) await q(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
    } finally {
      await q('COMMIT').catch(async () => { await q('ROLLBACK'); });
    }
    for (const [table, trigger] of guards) {
      assert.equal(await rt.triggerEnabled(table, trigger), true,
        `${trigger} is enabled again after the Public Replay fixture teardown`);
    }
  }

  /**
   * The Public Identities these verifiers mint, removed after their Experiences.
   *
   * The command history is append-only for every role from 0121 onward
   * (QAN-CW-REM-03 / REM03-HIST-02) - it carries the exact label answer each
   * command returned - so the guard is lifted inside this ONE transaction and
   * proven back afterwards, exactly as every other Public teardown does.
   */
  async function removePublicIdentities(humans) {
    const guard = ['public.public_identity_commands', 'public_identity_commands_immutable'];
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      await q(`ALTER TABLE ${guard[0]} DISABLE TRIGGER ${guard[1]}`);
      await q('DELETE FROM public.public_identity_commands WHERE actor_user_id = ANY($1::uuid[])', [humans]);
      await q(`DELETE FROM public.public_identity_display_state WHERE public_identity_ref IN
                 (SELECT public_identity_ref FROM public.public_identities WHERE user_id = ANY($1::uuid[]))`, [humans]);
      await q('DELETE FROM public.public_identities WHERE user_id = ANY($1::uuid[])', [humans]);
      await q(`ALTER TABLE ${guard[0]} ENABLE TRIGGER ${guard[1]}`);
    } finally {
      await q('COMMIT').catch(async () => { await q('ROLLBACK'); });
    }
    assert.equal(await rt.triggerEnabled(guard[0], guard[1]), true,
      `${guard[1]} is enabled again after the Public Identity teardown`);
  }

  return {
    ...rt, D, DFN, DESTINATIONS, SANITIZED_POLICY,
    removePublicReplayFixture, removePublicIdentities,
    prepare, approve, withdraw, authorize,
    requiredApprovers, packageAuthority, approvalState, effectiveApprovals, exportDescriptor,
    analyticalAuthority, distributionPrerequisites, resolvePackage, resolvePublicArtifact,
    freshPackage, freshPublic,
    captureSeamDefinition, restoreSeamDefinition,
    simulateAnalyticalAuthority, simulateDistributionPrerequisites,
    provisionFinalizedReplay, provisionControlledExperience, removeCommittedDistributions,
  };
}

export { runVerifier, APP_ROLES, NONE, SEAM, T } from './public-runtime-verifier-support.mjs';
export { R, FN, REPLAY_IMMUTABLE } from './replay-verifier-support.mjs';
export { V, VFN, I06B_IMMUTABLE } from './replay-version-verifier-support.mjs';
