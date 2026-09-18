// Shared support for the I-07D real-PostgreSQL verifiers (migrations 0115,
// 0116 and 0117).
//
// It composes the I-07C Match runtime, because every I-07D fixture starts from
// a REAL committed Mutual Match - a real ACTIVE / INTRODUCTION Shared World,
// two real open membership episodes, a real ACTIVE Introduction Record and two
// real HELD claims - reached through the real I-07A, I-07B and I-07C
// boundaries as the humans involved, never by a direct write.
//
// On top of that it adds everything I-07D needs: the relation and function
// names, one wrapper per boundary, readers over every new relation, the three
// fail-closed seams, the ladder from two matchable humans to a live
// Introduction, and the teardown that removes every I-07D row a committed race
// left behind.
//
// Nothing in this module asserts anything about a migration on its own.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createMatchRuntime, MATCH, matchIds, matchArgs } from './matching-match-verifier-support.mjs';

// ------------------------------------------------------------------ catalog
/** Every relation migration 0115 creates. */
export const I07D_DISCLOSURE_TABLES = [
  'public.introduction_disclosure_resource_versions',
  'public.introduction_disclosure_text_payloads',
  'public.introduction_disclosure_media_payloads',
  'public.introduction_disclosure_granted_events',
  'public.introduction_disclosure_commands',
  'public.introduction_closed_view_entitlements',
  'public.introduction_closed_view_entitlement_items',
];

/** Every relation migration 0116 creates. */
export const I07D_TERMINAL_TABLES = [
  'public.introduction_success_transition_versions',
  'public.introduction_success_required_approvers',
  'public.introduction_success_approval_events',
  'public.introduction_success_approval_state',
  'public.introduction_completed_events',
  'public.introduction_ended_events',
  'public.introduction_terminal_commits',
];

/** The relation migration 0117 creates. */
export const I07D_REACTIVATION_TABLES = ['public.matching_introduction_reactivation_commands'];

export const I07D_TABLES = [...I07D_DISCLOSURE_TABLES, ...I07D_TERMINAL_TABLES, ...I07D_REACTIVATION_TABLES];

/** Table plus the trigger that refuses UPDATE and DELETE on it. */
export const I07D_IMMUTABLE = [
  ['public.introduction_disclosure_resource_versions', 'introduction_disclosure_resource_versions_immutable'],
  ['public.introduction_disclosure_granted_events', 'introduction_disclosure_granted_events_immutable'],
  ['public.introduction_disclosure_commands', 'introduction_disclosure_commands_immutable'],
  ['public.introduction_success_transition_versions', 'introduction_success_transition_versions_immutable'],
  ['public.introduction_success_required_approvers', 'introduction_success_required_approvers_immutable'],
  ['public.introduction_success_approval_events', 'introduction_success_approval_events_immutable'],
  ['public.introduction_completed_events', 'introduction_completed_events_immutable'],
  ['public.introduction_ended_events', 'introduction_ended_events_immutable'],
  ['public.introduction_terminal_commits', 'introduction_terminal_commits_immutable'],
  ['public.introduction_closed_view_entitlements', 'introduction_closed_view_entitlements_immutable'],
  ['public.introduction_closed_view_entitlement_items', 'introduction_closed_view_entitlement_items_immutable'],
  ['public.matching_introduction_reactivation_commands', 'matching_introduction_reactivation_commands_immutable'],
];

/** The payload relations owner deletion must be able to DESTROY but never rewrite. */
export const I07D_PAYLOAD_GUARDED = [
  ['public.introduction_disclosure_text_payloads', 'introduction_disclosure_text_payloads_immutable'],
  ['public.introduction_disclosure_media_payloads', 'introduction_disclosure_media_payloads_immutable'],
];

/** Every guard I-07D installs, for the "still enabled at the end" sweep. */
export const I07D_GUARDS = [
  ...I07D_IMMUTABLE,
  ...I07D_PAYLOAD_GUARDED,
  ['public.introduction_success_approval_state', 'introduction_success_approval_state_truth'],
  ['public.introduction_terminal_commits', 'introduction_terminal_commits_truth'],
];

/** The trigger functions the three migrations install. */
export const I07D_TRIGGER_FUNCTIONS = [
  'public.reject_introduction_disclosure_mutation_v1()',
  'public.reject_introduction_payload_rewrite_v1()',
  'public.reject_introduction_terminal_mutation_v1()',
  'public.introduction_success_approval_pointer_truth_v1()',
  'public.introduction_terminal_commit_truth_v1()',
  'public.reject_matching_reactivation_mutation_v1()',
];

// ------------------------------------------------------------------ relations
export const D = Object.freeze({
  VERSIONS: 'public.introduction_disclosure_resource_versions',
  TEXT: 'public.introduction_disclosure_text_payloads',
  MEDIA: 'public.introduction_disclosure_media_payloads',
  GRANTS: 'public.introduction_disclosure_granted_events',
  COMMANDS: 'public.introduction_disclosure_commands',
  ENTITLEMENTS: 'public.introduction_closed_view_entitlements',
  ENTITLEMENT_ITEMS: 'public.introduction_closed_view_entitlement_items',
  TRANSITIONS: 'public.introduction_success_transition_versions',
  REQUIRED: 'public.introduction_success_required_approvers',
  APPROVALS: 'public.introduction_success_approval_events',
  APPROVAL_STATE: 'public.introduction_success_approval_state',
  COMPLETED: 'public.introduction_completed_events',
  ENDED: 'public.introduction_ended_events',
  TERMINAL: 'public.introduction_terminal_commits',
  REACTIVATIONS: 'public.matching_introduction_reactivation_commands',
  ITEMS: 'public.shared_world_history_items',
  VIEWERS: 'public.shared_world_history_item_baseline_viewers',
  APPROVERS: 'public.shared_world_history_item_required_approvers',
  MATERIALS: 'public.shared_world_materials',
  EPISODES: 'public.shared_world_membership_episodes',
  WORLDS: 'public.shared_worlds',
  ACTS: 'public.matching_participation_events',
  PARTICIPATION: 'public.matching_participation_state',
});

// ------------------------------------------------------------------ functions
export const DFN = Object.freeze({
  DISCLOSE: 'public.commit_introduction_progressive_disclosure_v1(uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text)',
  DISCLOSURE_GATE: 'public.resolve_introduction_disclosure_prerequisites_v1(uuid)',
  RESOLVE_DISCLOSURE: 'public.resolve_shared_world_introduction_disclosure_v1(uuid, uuid)',
  VISIBILITY: 'public.resolve_shared_world_history_visibility_v1(uuid, uuid)',
  CLOSED_VISIBILITY: 'public.resolve_shared_world_closed_history_visibility_v1(uuid, uuid)',
  DELETE_MATERIAL: 'public.delete_shared_world_owned_material_v1(uuid, uuid, uuid, uuid)',
  PREPARE_SUCCESS: 'public.prepare_introduction_success_transition_v1(uuid, uuid)',
  APPROVAL_CORE: 'public.record_introduction_success_approval_core_v1(uuid, uuid, uuid, text)',
  APPROVE: 'public.approve_introduction_success_v1(uuid, uuid, uuid)',
  WITHDRAW: 'public.withdraw_introduction_success_approval_v1(uuid, uuid, uuid)',
  SUCCESS: 'public.commit_introduction_success_v1(uuid, uuid, uuid, uuid)',
  END: 'public.commit_introduction_end_v1(uuid, uuid, uuid, uuid)',
  SUCCESS_GATE: 'public.resolve_introduction_success_prerequisites_v1(uuid)',
  REACTIVATE: 'public.reactivate_matching_after_introduction_v1(uuid, uuid, uuid, text)',
  REACTIVATION_GATE: 'public.resolve_matching_reactivation_prerequisites_v1(uuid)',
});

/** The three fail-closed CW2-08 seams I-07D owns, in deploy order. */
export const I07D_SEAMS = [DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE];

/**
 * Each seam's qualified name and its EXACT input parameter name.
 *
 * The parameter name is load-bearing rather than documentation: PostgreSQL
 * refuses to change an input parameter's name through CREATE OR REPLACE, so a
 * verifier replacement that guessed it would fail with a message about
 * parameters instead of about the seam.
 */
export const I07D_SEAM_PARAMETERS = [
  ['public.resolve_introduction_disclosure_prerequisites_v1', 'p_world_id'],
  ['public.resolve_introduction_success_prerequisites_v1', 'p_introduction_record_id'],
  ['public.resolve_matching_reactivation_prerequisites_v1', 'p_user_id'],
];

// ---------------------------------------------------------------- vocabularies
export const RESOURCE_TYPES = ['PARTIAL_IMAGE', 'FULL_IMAGE', 'FULL_NAME', 'CONTACT_METHOD', 'DEEPER_PERSONAL_FIELD'];
export const TEXT_RESOURCE_TYPES = ['FULL_NAME', 'CONTACT_METHOD', 'DEEPER_PERSONAL_FIELD'];
export const IMAGE_RESOURCE_TYPES = ['PARTIAL_IMAGE', 'FULL_IMAGE'];
export const TERMINAL_OUTCOMES = ['COMPLETED', 'CLOSED'];
export const APPROVAL_ACTS = ['APPROVE', 'WITHDRAW'];
export const POST_TERMINAL_REASONS = ['POST_INTRODUCTION', 'POST_SUCCESS'];

/**
 * Result columns no I-07D boundary may ever declare.
 *
 * An I-07D answer is the operation, the opaque identities the caller supplied
 * and the frozen outcome constants. It is never the counterpart's identity, an
 * authority row, a private Matching reason, a claim id, a proposal id or
 * anything ranked: if one of these appears as a result column the boundary has
 * stopped being a bounded command answer.
 */
export const I07D_RESULT_BAN =
  /counterpart|recipient|audience|viewer|approver_user|owner_user|auth|email|phone|contact_route|handle|snapshot|authority|profile_version|requirement|evidence|provenance|private|reason|score|rank|percent|competing|winner|claim_id|claim_state|proposal|grant_id/u;

/** The exact bounded shape of one disclosure the counterpart can render. */
export const DISCLOSURE_COLUMNS = [
  'world_id', 'material_id', 'history_item_id', 'resource_version_id', 'owner_user_id',
  'resource_type', 'field_key', 'text_value', 'media_object_ref', 'occurred_at',
];

// ------------------------------------------------------------------ fixtures
/** A bounded opaque media object reference in the frozen 0089 shape. */
export const mediaRef = (label) => `introduction-media/${label}/${randomUUID()}`;

/** One fresh set of the six opaque identities a disclosure creates. */
export const disclosureIds = () => ({
  command: randomUUID(), version: randomUUID(), material: randomUUID(),
  item: randomUUID(), event: randomUUID(),
});

/** The ten arguments of the disclosure boundary, in signature order. */
export const disclosureArgs = (ids, world, type, { fieldKey = null, text = null, media = null } = {}) =>
  [ids.command, world, ids.version, ids.material, ids.item, ids.event, type, fieldKey, text, media];

/** One fresh pair of the two opaque participation identities a terminal commit creates. */
export const terminalIds = () => ({
  command: randomUUID(), lowerAct: randomUUID(), higherAct: randomUUID(),
});

// -------------------------------------------------------------------- runtime
export function createIntroductionRuntime(databaseUrl) {
  const rt = createMatchRuntime(databaseUrl);
  const { q, rows, asRole, actAs } = rt;

  // ---- the I-07D boundaries, as named wrappers
  const disclose = (ids, world, type, payload) =>
    rows('SELECT * FROM public.commit_introduction_progressive_disclosure_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      disclosureArgs(ids, world, type, payload));
  const discloseText = (ids, world, type, text, fieldKey = null) =>
    disclose(ids, world, type, { text, fieldKey });
  const discloseImage = (ids, world, type, media) => disclose(ids, world, type, { media });

  const resolveDisclosure = (world, user) =>
    rows('SELECT * FROM public.resolve_shared_world_introduction_disclosure_v1($1,$2)', [world, user]);
  const visibility = (world, user) =>
    rows('SELECT * FROM public.resolve_shared_world_history_visibility_v1($1,$2)', [world, user]);
  const closedVisibility = (world, user) =>
    rows('SELECT * FROM public.resolve_shared_world_closed_history_visibility_v1($1,$2)', [world, user]);
  const deleteMaterial = (command, world, material, event) =>
    rows('SELECT * FROM public.delete_shared_world_owned_material_v1($1,$2,$3,$4)', [command, world, material, event]);

  const prepareSuccess = (version, world) =>
    rows('SELECT * FROM public.prepare_introduction_success_transition_v1($1,$2)', [version, world]);
  const approveSuccess = (command, version, expected = null) =>
    rows('SELECT * FROM public.approve_introduction_success_v1($1,$2,$3)', [command, version, expected]);
  const withdrawSuccess = (command, version, expected) =>
    rows('SELECT * FROM public.withdraw_introduction_success_approval_v1($1,$2,$3)', [command, version, expected]);
  const commitSuccess = (ids, version) =>
    rows('SELECT * FROM public.commit_introduction_success_v1($1,$2,$3,$4)',
      [ids.command, version, ids.lowerAct, ids.higherAct]);
  const commitEnd = (ids, world) =>
    rows('SELECT * FROM public.commit_introduction_end_v1($1,$2,$3,$4)',
      [ids.command, world, ids.lowerAct, ids.higherAct]);

  const reactivate = (command, event, expected, channel = null) =>
    rows('SELECT * FROM public.reactivate_matching_after_introduction_v1($1,$2,$3,$4)',
      [command, event, expected, channel]);

  // ---- readers over every I-07D relation, as postgres
  const versionRow = async (id) => (await rows(`SELECT * FROM ${D.VERSIONS} v WHERE v.id = $1`, [id]))[0] ?? null;
  const textPayload = async (id) => (await rows(`SELECT * FROM ${D.TEXT} t WHERE t.resource_version_id = $1`, [id]))[0] ?? null;
  const mediaPayload = async (id) => (await rows(`SELECT * FROM ${D.MEDIA} m WHERE m.resource_version_id = $1`, [id]))[0] ?? null;
  const grantEvent = async (version) =>
    (await rows(`SELECT * FROM ${D.GRANTS} g WHERE g.resource_version_id = $1`, [version]))[0] ?? null;
  const terminalRow = async (record) =>
    (await rows(`SELECT * FROM ${D.TERMINAL} t WHERE t.introduction_record_id = $1`, [record]))[0] ?? null;
  const approvalStateOf = async (version, human) =>
    (await rows(`SELECT s.*, e.resulting_state, e.approval_act
                   FROM ${D.APPROVAL_STATE} s JOIN ${D.APPROVALS} e ON e.id = s.current_event_id
                  WHERE s.transition_version_id = $1 AND s.approver_user_id = $2`, [version, human]))[0] ?? null;
  const entitlementOf = async (world, human) =>
    (await rows(`SELECT * FROM ${D.ENTITLEMENTS} ent WHERE ent.world_id = $1 AND ent.user_id = $2`, [world, human]))[0] ?? null;
  const entitlementItemsOf = async (world, human) =>
    (await rows(`SELECT it.history_item_id FROM ${D.ENTITLEMENT_ITEMS} it
                  WHERE it.world_id = $1 AND it.user_id = $2 ORDER BY it.history_item_id`, [world, human]))
      .map((r) => r.history_item_id);
  const reactivationOf = async (command) =>
    (await rows(`SELECT * FROM ${D.REACTIVATIONS} c WHERE c.id = $1`, [command]))[0] ?? null;
  const itemRow = async (id) => (await rows(`SELECT * FROM ${D.ITEMS} i WHERE i.id = $1`, [id]))[0] ?? null;
  const materialRow = async (id) => (await rows(`SELECT * FROM ${D.MATERIALS} m WHERE m.id = $1`, [id]))[0] ?? null;
  const baselineViewersOf = async (item) =>
    (await rows(`SELECT b.user_id FROM ${D.VIEWERS} b WHERE b.history_item_id = $1 ORDER BY b.user_id`, [item]))
      .map((r) => r.user_id);
  const requiredApproversOf = async (item) =>
    (await rows(`SELECT a.approver_user_id FROM ${D.APPROVERS} a WHERE a.history_item_id = $1 ORDER BY 1`, [item]))
      .map((r) => r.approver_user_id);

  /**
   * One terminal transition's whole effect, counted by the identities the
   * terminal commit binds, so a scenario can prove "exactly once" or "nothing
   * at all" with one call. Every count is a semantic cardinality (0, 1 or 2),
   * never a running fixture total.
   */
  async function terminalEffects(record, world) {
    const one = async (table, where, values) =>
      Number((await rows(`SELECT count(*) n FROM ${table} WHERE ${where}`, values))[0].n);
    return {
      terminals: await one(D.TERMINAL, 'introduction_record_id = $1', [record]),
      completed: await one(D.COMPLETED, 'introduction_record_id = $1', [record]),
      ended: await one(D.ENDED, 'introduction_record_id = $1', [record]),
      releasedClaims: await one(MATCH.CLAIMS, "introduction_record_id = $1 AND claim_state = 'RELEASED'", [record]),
      heldClaims: await one(MATCH.CLAIMS, "introduction_record_id = $1 AND claim_state = 'HELD'", [record]),
      openEpisodes: await one(D.EPISODES, 'world_id = $1 AND ended_at IS NULL', [world]),
      closedEpisodes: await one(D.EPISODES, "world_id = $1 AND end_reason = 'WORLD_CLOSED'", [world]),
      entitlements: await one(D.ENTITLEMENTS, 'world_id = $1', [world]),
      standardEnded: await one('public.shared_world_ended_events', 'world_id = $1', [world]),
    };
  }

  /** Everything one disclosure produces, counted by the identities it binds. */
  async function disclosureEffects(ids) {
    const one = async (table, where, values) =>
      Number((await rows(`SELECT count(*) n FROM ${table} WHERE ${where}`, values))[0].n);
    return {
      commands: await one(D.COMMANDS, 'id = $1', [ids.command]),
      versions: await one(D.VERSIONS, 'id = $1', [ids.version]),
      texts: await one(D.TEXT, 'resource_version_id = $1', [ids.version]),
      media: await one(D.MEDIA, 'resource_version_id = $1', [ids.version]),
      grants: await one(D.GRANTS, 'id = $1', [ids.event]),
      materials: await one(D.MATERIALS, 'id = $1', [ids.material]),
      items: await one(D.ITEMS, 'id = $1', [ids.item]),
      viewers: await one(D.VIEWERS, 'history_item_id = $1', [ids.item]),
      approvers: await one(D.APPROVERS, 'history_item_id = $1', [ids.item]),
      provenance: await one('public.shared_world_material_dependencies', 'target_material_id = $1', [ids.material]),
      authority: await one('public.shared_world_material_historical_authority', 'material_id = $1', [ids.material]),
    };
  }

  /**
   * The instant one terminal transition persisted, compared in SQL at full
   * precision. A timestamptz that travelled through JavaScript would be a Date
   * with MILLISECOND precision, so clock_timestamp() microseconds would be
   * silently truncated and every equality below would be a coin flip.
   */
  async function terminalInstantCoherence(record) {
    const [row] = await rows(
      `SELECT t.committed_at::text AS committed,
              (SELECT bool_and(x = t.committed_at) FROM unnest(ARRAY[
                 (SELECT r.ended_at FROM ${MATCH.RECORDS} r WHERE r.id = t.introduction_record_id),
                 (SELECT min(k.released_at) FROM ${MATCH.CLAIMS} k WHERE k.introduction_record_id = t.introduction_record_id),
                 (SELECT max(k.released_at) FROM ${MATCH.CLAIMS} k WHERE k.introduction_record_id = t.introduction_record_id),
                 (SELECT ev.occurred_at FROM ${D.COMPLETED} ev WHERE ev.introduction_record_id = t.introduction_record_id),
                 (SELECT ev.occurred_at FROM ${D.ENDED} ev WHERE ev.introduction_record_id = t.introduction_record_id),
                 (SELECT w.closed_at FROM ${D.WORLDS} w WHERE w.id = t.world_id AND w.closed_at IS NOT NULL),
                 (SELECT min(ent.entitled_at) FROM ${D.ENTITLEMENTS} ent WHERE ent.world_id = t.world_id),
                 (SELECT min(e.ended_at) FROM ${D.EPISODES} e WHERE e.world_id = t.world_id AND e.ended_at IS NOT NULL),
                 (SELECT max(e.ended_at) FROM ${D.EPISODES} e WHERE e.world_id = t.world_id AND e.ended_at IS NOT NULL),
                 (SELECT a.occurred_at FROM ${D.ACTS} a WHERE a.id = t.lower_participation_event_id),
                 (SELECT a.occurred_at FROM ${D.ACTS} a WHERE a.id = t.higher_participation_event_id)
               ]) AS x) AS coherent
         FROM ${D.TERMINAL} t WHERE t.introduction_record_id = $1`, [record]);
    return row ?? null;
  }

  // ---- the three fail-closed seams
  /**
   * Makes one I-07D CW2-08 seam answer CLEARED, exactly as a future Launch
   * Gate would.
   *
   * The INPUT PARAMETER NAME is part of the replacement, not decoration:
   * PostgreSQL refuses to change an input parameter's name through CREATE OR
   * REPLACE, so a replacement that guessed the name would fail with a message
   * about parameters rather than about the seam.
   */
  async function clearSeam([name, parameter]) {
    await asRole('postgres');
    await q(`CREATE OR REPLACE FUNCTION ${name}(${parameter} uuid)
             RETURNS TABLE(clearance text, basis text)
             LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $seam$
             BEGIN
               RETURN QUERY SELECT 'CLEARED'::text, 'verifier fixture clearance'::text;
             END$seam$`);
  }

  /** All three I-07D seams, cleared together. */
  const clearAllSeams = async () => {
    for (const seam of I07D_SEAM_PARAMETERS) await clearSeam(seam);
  };

  /** The clearance one seam currently answers, read as postgres. */
  const seamClearance = async (name) => {
    const [row] = await rows(`SELECT clearance FROM ${name}($1)`, [randomUUID()]);
    return row.clearance;
  };

  // ---- the fixture ladder, through the REAL boundaries
  /**
   * Two humans with a REAL committed Mutual Match: a real ACTIVE /
   * INTRODUCTION World, two real open episodes, a real ACTIVE Introduction
   * Record and two real HELD claims. Every step runs through the real I-07A,
   * I-07B and I-07C boundaries as the humans involved.
   *
   * The caller must have already cleared the two I-07B/I-07C seams; this
   * module does not clear them, because which seams a verifier replaces - and
   * restores - is that verifier's own decision to make and to undo.
   */
  async function bringToIntroduction(first, candidate, options = {}) {
    const f = await rt.bringToForwarded(first, candidate, options);
    const ids = matchIds();
    await actAs(candidate);
    const [match] = await rt.commitMatch(ids, f.proposal, f.secondView);
    await asRole('postgres');
    assert.equal(match.world_phase, 'INTRODUCTION', 'the fixture Match really did birth an Introduction World');
    const record = await rt.recordRow(ids.record);
    assert.equal(record.introduction_status, 'ACTIVE', 'and its Introduction Record is ACTIVE');
    return {
      ...f, ids, match,
      world: ids.world,
      record: ids.record,
      matchCommit: ids.command,
      lower: record.lower_user_id,
      higher: record.higher_user_id,
      lowerClaim: (await rt.claimsOf(record.lower_user_id)).find((c) => c.introduction_record_id === ids.record).id,
      higherClaim: (await rt.claimsOf(record.higher_user_id)).find((c) => c.introduction_record_id === ids.record).id,
    };
  }

  /** A live Introduction plus one prepared success transition version. */
  async function bringToSuccessProposed(first, candidate, options = {}) {
    const f = await bringToIntroduction(first, candidate, options);
    const version = randomUUID();
    const [prepared] = await prepareSuccess(version, f.world);
    assert.equal(prepared.prepared_required_approver_count, 2,
      'a prepared success transition derives exactly the two matched humans');
    return { ...f, version };
  }

  /** A live Introduction whose success transition BOTH humans currently approve. */
  async function bringToSuccessApproved(first, candidate, options = {}) {
    const f = await bringToSuccessProposed(first, candidate, options);
    const approvals = {};
    for (const human of [f.lower, f.higher]) {
      await actAs(human);
      const command = randomUUID();
      await approveSuccess(command, f.version, null);
      approvals[human] = command;
    }
    await asRole('postgres');
    return { ...f, approvals };
  }

  /** One real disclosure by one exact owner, through the real boundary. */
  async function discloseAs(owner, world, type, payload) {
    const ids = disclosureIds();
    await actAs(owner);
    const [answer] = await disclose(ids, world, type, payload);
    await asRole('postgres');
    return { ids, answer };
  }

  /** The current participation act of one human, in full, as postgres. */
  const currentActOf = async (human) => {
    const [row] = await rows(
      `SELECT e.* FROM ${D.PARTICIPATION} s JOIN ${D.ACTS} e ON e.id = s.current_event_id
        WHERE s.participant_user_id = $1`, [human]);
    return row ?? null;
  };

  /**
   * Turns one human's Matching participation OFF through the REAL I-07A
   * command, from whatever act they currently hold. Used to reach the third
   * real human state the lifecycle produces: an explicit opt-out taken during
   * a live Introduction, which a terminal transition must then leave alone.
   */
  async function turnOffDuringIntroduction(human) {
    const current = await currentActOf(human);
    await actAs(human);
    const [act] = await rt.turnOff(randomUUID(), current.id);
    await asRole('postgres');
    assert.equal(act.participation_state, 'OFF', 'the fixture human really is explicitly OFF');
    return act.participation_event_id;
  }

  /**
   * Remove every COMMITTED I-07D row of the given humans, leaf-first.
   *
   * Every guard is lifted inside ONE transaction and put back inside the same
   * one, because the terminal commit binds its children restrictively and its
   * children bind it back: nothing can be deleted row by row otherwise. The
   * Match teardown the I-07C module owns runs afterwards and removes the World
   * and its episodes.
   */
  async function removeCommittedIntroductionState(humans) {
    await asRole('postgres');
    await q('BEGIN');
    try {
      for (const table of I07D_TABLES) await q(`ALTER TABLE ${table} DISABLE TRIGGER ALL`);
      const records = `(SELECT r.id FROM ${MATCH.RECORDS} r
                         WHERE r.lower_user_id = ANY($1::uuid[]) OR r.higher_user_id = ANY($1::uuid[]))`;
      const worlds = `(SELECT r.world_id FROM ${MATCH.RECORDS} r
                        WHERE r.lower_user_id = ANY($1::uuid[]) OR r.higher_user_id = ANY($1::uuid[]))`;
      await q(`DELETE FROM ${D.REACTIVATIONS} WHERE participant_user_id = ANY($1::uuid[])`, [humans]);
      await q(`DELETE FROM ${D.TERMINAL} WHERE introduction_record_id IN ${records}`, [humans]);
      await q(`DELETE FROM ${D.COMPLETED} WHERE introduction_record_id IN ${records}`, [humans]);
      await q(`DELETE FROM ${D.ENDED} WHERE introduction_record_id IN ${records}`, [humans]);
      await q(`DELETE FROM ${D.APPROVAL_STATE} WHERE approver_user_id = ANY($1::uuid[])`, [humans]);
      await q(`DELETE FROM ${D.APPROVALS} WHERE approver_user_id = ANY($1::uuid[])`, [humans]);
      await q(`DELETE FROM ${D.REQUIRED} WHERE approver_user_id = ANY($1::uuid[])`, [humans]);
      await q(`DELETE FROM ${D.TRANSITIONS} WHERE introduction_record_id IN ${records}`, [humans]);
      await q(`DELETE FROM ${D.ENTITLEMENT_ITEMS} WHERE world_id IN ${worlds}`, [humans]);
      await q(`DELETE FROM ${D.ENTITLEMENTS} WHERE world_id IN ${worlds}`, [humans]);
      await q(`DELETE FROM ${D.COMMANDS} WHERE owner_user_id = ANY($1::uuid[])`, [humans]);
      await q(`DELETE FROM ${D.GRANTS} WHERE owner_user_id = ANY($1::uuid[])`, [humans]);
      const versions = `(SELECT v.id FROM ${D.VERSIONS} v WHERE v.world_id IN ${worlds})`;
      await q(`DELETE FROM ${D.TEXT} WHERE resource_version_id IN ${versions}`, [humans]);
      await q(`DELETE FROM ${D.MEDIA} WHERE resource_version_id IN ${versions}`, [humans]);
      await q(`DELETE FROM ${D.VERSIONS} WHERE world_id IN ${worlds}`, [humans]);
      // The Shared material this slice produced, and the I-04F projection rows
      // it bound itself to, go with it - children before parents, because the
      // World teardown that follows cannot remove a World that still carries a
      // history item, and a history item cannot go while a material names it.
      const materials = `(SELECT m.id FROM ${D.MATERIALS} m WHERE m.world_id IN ${worlds})`;
      await q(`DELETE FROM public.shared_world_material_delete_commands WHERE material_id IN ${materials}`, [humans]);
      await q(`DELETE FROM public.shared_world_material_deleted_events WHERE material_id IN ${materials}`, [humans]);
      await q(`DELETE FROM public.shared_world_material_historical_authority WHERE material_id IN ${materials}`, [humans]);
      await q(`DELETE FROM public.shared_world_material_dependencies WHERE target_material_id IN ${materials}`, [humans]);
      await q(`DELETE FROM ${D.MATERIALS} WHERE world_id IN ${worlds}`, [humans]);
      const worldItems = `(SELECT i.id FROM ${D.ITEMS} i WHERE i.world_id IN ${worlds})`;
      await q(`DELETE FROM ${D.APPROVERS} WHERE history_item_id IN ${worldItems}`, [humans]);
      await q(`DELETE FROM ${D.VIEWERS} WHERE history_item_id IN ${worldItems}`, [humans]);
      await q(`DELETE FROM ${D.ITEMS} WHERE world_id IN ${worlds}`, [humans]);
      for (const table of I07D_TABLES) await q(`ALTER TABLE ${table} ENABLE TRIGGER ALL`);
      await q('COMMIT');
    } catch (error) {
      await q('ROLLBACK').catch(() => undefined);
      throw error;
    }
    for (const [table, trigger] of I07D_GUARDS) {
      assert.equal(await rt.triggerEnabled(table, trigger), true,
        `${trigger} is enabled again after I-07D teardown`);
    }
  }

  /** Remove everything a race committed: I-07D rows first, then the Match graph. */
  async function cleanupIntroductionRace(humans) {
    await removeCommittedIntroductionState(humans);
    await rt.cleanupRace(humans);
  }

  return {
    ...rt, D, DFN,
    disclose, discloseText, discloseImage, resolveDisclosure, visibility, closedVisibility, deleteMaterial,
    prepareSuccess, approveSuccess, withdrawSuccess, commitSuccess, commitEnd, reactivate,
    versionRow, textPayload, mediaPayload, grantEvent, terminalRow, approvalStateOf,
    entitlementOf, entitlementItemsOf, reactivationOf, itemRow, materialRow,
    baselineViewersOf, requiredApproversOf,
    terminalEffects, disclosureEffects, terminalInstantCoherence,
    clearSeam, clearAllSeams, seamClearance,
    bringToIntroduction, bringToSuccessProposed, bringToSuccessApproved, discloseAs,
    currentActOf, turnOffDuringIntroduction,
    removeCommittedIntroductionState, cleanupIntroductionRace,
  };
}

export { runVerifier, APP_ROLES } from './matching-match-verifier-support.mjs';
export { MATCH, MATCH_TABLES, matchIds, matchArgs, I07C_MATCH_PRODUCER } from './matching-match-verifier-support.mjs';
export { P, PFN } from './matching-match-verifier-support.mjs';
