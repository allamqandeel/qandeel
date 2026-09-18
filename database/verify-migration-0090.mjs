// Real-PostgreSQL verifier for migration 0090 - I-04G Shared Material Commit
// Runtime and Owner Deletion v1 (PART B).
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// behaviour rather than from the migration text:
//
//   * catalog: the four relations exist once and still carry every column they OWN
//     - name, type, nullability AND the absence of a default - unchanged and in
//     their original positions; every owned unique binding, check and foreign key
//     is pinned by name, local columns, parent and restrictive deletion; RLS is on
//     with zero policies; and PUBLIC, anon, authenticated and service_role hold no
//     privilege at all;
//   * catalog: all five primitives are postgres-owned, SECURITY DEFINER, VOLATILE,
//     search_path-pinned, World-first, single-clocked and executable by NO
//     application role;
//   * M01 human text atomically creates material, body, history item, baseline
//     audience, author authority, provenance and command - or none of them;
//   * M02 a voice note creates an immutable media reference and an optional
//     transcript; M03 QANDEEL material has system-actor semantics and no human
//     author; M04 it binds exact dependencies and authority requirements;
//   * M05 / M06 ONE database instant across material, history item and command;
//   * M07 a caller cannot supply baseline viewers; M08 the human author is the
//     exact required approver; M09 membership never creates co-ownership;
//   * M10 the QANDEEL approver set is dependency-derived, never every member;
//   * M14 a non-member cannot commit; M15 a one-human ACTIVE World still can;
//     M16 an inert zero-human World cannot; M17 READ_ONLY_CLOSED cannot;
//   * P01 a MATERIAL source must pre-exist its target; P02 self and cyclic
//     dependencies are refused; P03 a REASONING dependency persists no raw private
//     content; P05 an INDEPENDENT target has no source; P06 a reasoning dependency
//     never becomes material authority;
//   * D01-D16 owner deletion: by a current owner, a former member and after
//     closure; refused for another human and for QANDEEL material; text and voice
//     bodies physically absent afterwards; a terminal DELETED_BY_OWNER state; one
//     MATERIAL_DELETED plus one command; a stable identical retry and no double
//     delete; resolvers returning nothing; history grant and closed entitlement
//     audits surviving; direct and transitive MATERIAL_DEPENDENCY targets becoming
//     UNAVAILABLE; REASONING_DEPENDENCY targets surviving; provenance identity
//     surviving;
//   * FIX-A a fabricated audience snapshot, a snapshot staled by a leave, by the
//     SAME human rejoining, and by a governed removal are each refused, and the
//     validated snapshot IS the baseline audience;
//   * FIX-B evidence valid for World A cannot commit into World B even byte for byte;
//   * FIX-C an exact voice retry succeeds while a changed duration conflicts, and a
//     QANDEEL retry binds every evidence reference and both exact dependency sets,
//     answering with COMMITTED counts rather than its own input arrays;
//   * FIX-D unresolved additional human authority is recorded as unresolved, blocks
//     historical widening at the frozen I-04F package, never turns a reasoning
//     grantor into an approver, and never blocks current baseline delivery;
//   * Q01-Q05 QANDEEL never becomes a human authority principal, I-03 readiness is
//     never treated as Safety or Launch clearance, app roles cannot execute the
//     commit core, stale World / audience / dependency state refuses a commit, and
//     exact output evidence cannot be reused for a different body or World;
//   * N02-N05 no Standing Context Grant mutation, no Personal material copied, no
//     Public / Replay / Matching state created and no live call, proven by an exact
//     count delta;
//   * M18 / M19 / M20 concurrency, with real independent connections: a material
//     commit versus a unilateral leave, versus a GOVERNED removal, and versus a
//     World closure, plus two competing owner deletions - all serializing
//     World-first with no deadlock, no hybrid state and no stale audience;
//   * forward safety: a later reviewed Introduction producer, a CW2-08 wrapper,
//     Public and Replay consumers, a Launch Gate, later additive columns, indexes
//     and audit triggers are created for real inside a rolled-back SAVEPOINT and
//     this verifier still passes - then every regression to something 0090 OWNS is
//     planted and must still be refused;
//   * zero fixture residue after completion.
//
// There is deliberately NO live census of any kind here: this file runs against a
// fully migrated database, so a fixed list of table names required to stay absent,
// an exact count of live constraints or a catalog sweep for future names would be
// a ceiling on the whole roadmap rather than a fact about migration 0090. What
// 0090 itself did NOT create is proven from 0090's own text, by
// database/tests/shared-world-material-commit-owner-deletion-v1.test.mjs.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const databaseUrl = process.env.DATABASE_URL;
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}

async function rejected(operation, codes, message = null) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')}): ${error.message}`);
  if (message) assert.match(error.message, message);
  return error;
}

const WORLDS = 'public.shared_worlds';
const EPISODES = 'public.shared_world_membership_episodes';
const CREDENTIAL = 'public.shared_world_invite_credential_state';
const INVITATIONS = 'public.shared_world_direct_invitations';
const INVITE_COMMANDS = 'public.shared_world_invitation_commands';
const BIRTH_EVENTS = 'public.shared_world_direct_birth_events';
const ACCEPTANCE_COMMANDS = 'public.shared_world_direct_acceptance_commands';
const LEFT_EVENTS = 'public.shared_world_member_left_events';
const LEAVE_COMMANDS = 'public.shared_world_voluntary_leave_commands';
const SNAPSHOTS = 'public.shared_world_membership_snapshots';
const SNAPSHOT_MEMBERS = 'public.shared_world_membership_snapshot_members';
const PROPOSALS = 'public.shared_world_governance_proposals';
const APPROVALS = 'public.shared_world_governance_approvals';
const ITEMS = 'public.shared_world_history_items';
const BASELINE = 'public.shared_world_history_item_baseline_viewers';
const ITEM_APPROVERS = 'public.shared_world_history_item_required_approvers';
const MANIFESTS = 'public.shared_world_history_package_manifest_versions';
const MANIFEST_ITEMS = 'public.shared_world_history_package_manifest_items';
const PACKAGE_APPROVERS = 'public.shared_world_history_package_required_approvers';
const PACKAGE_APPROVALS = 'public.shared_world_history_package_approvals';
const GRANTS = 'public.shared_world_history_access_grants';
const GRANTED_EVENTS = 'public.shared_world_history_granted_events';
const GRANT_COMMANDS = 'public.shared_world_history_grant_commands';
const PAYLOADS = 'public.shared_world_end_payload_versions';
const ENTITLEMENTS = 'public.shared_world_standard_closed_view_entitlements';
const ENTITLEMENT_ITEMS = 'public.shared_world_standard_closed_view_entitlement_items';
const ENDED_EVENTS = 'public.shared_world_ended_events';
const END_COMMANDS = 'public.shared_world_standard_end_commands';
const GRANT_STATE = 'public.shared_world_standing_context_grants';
const REMOVE_PAYLOADS = 'public.shared_world_remove_member_payload_versions';
const REMOVED_EVENTS = 'public.shared_world_member_removed_events';
const REMOVAL_COMMANDS = 'public.shared_world_member_removal_commands';

const MATERIALS = 'public.shared_world_materials';
const TEXT_BODIES = 'public.shared_world_text_material_bodies';
const VOICE_BODIES = 'public.shared_world_voice_note_material_bodies';
const DEPENDENCIES = 'public.shared_world_material_dependencies';
const COMMIT_COMMANDS = 'public.shared_world_material_commit_commands';
const EVIDENCE = 'public.shared_world_qandeel_material_evidence';
const AUTHORITY = 'public.shared_world_material_historical_authority';
const DELETED_EVENTS = 'public.shared_world_material_deleted_events';
const DELETE_COMMANDS = 'public.shared_world_material_delete_commands';
const OWN_TABLES = [COMMIT_COMMANDS, EVIDENCE, AUTHORITY, DELETED_EVENTS, DELETE_COMMANDS];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

const HUMAN_CORE = 'public.commit_shared_world_human_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,integer)';
const TEXT_FN = 'public.commit_shared_world_human_text_v1(uuid,uuid,uuid,uuid,text)';
const VOICE_FN = 'public.commit_shared_world_human_voice_note_v1(uuid,uuid,uuid,uuid,text,text,integer)';
const QANDEEL_FN = 'public.commit_shared_world_qandeel_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,uuid[],text[])';
const DELETE_FN = 'public.delete_shared_world_owned_material_v1(uuid,uuid,uuid,uuid)';
const OWN_FUNCTIONS = [HUMAN_CORE, TEXT_FN, VOICE_FN, QANDEEL_FN, DELETE_FN];
const MATERIAL_RESOLVER = 'public.resolve_shared_world_material_v1(uuid,uuid)';
const GATE_FN = 'public.shared_world_material_historical_widening_gate_v1()';

const INSUFFICIENT_PRIVILEGE = ['42501'];
const INVALID_PARAMETER = ['22023'];
const UNAVAILABLE = ['P0002'];
const CONFLICT = ['23505'];
const STALE = ['40001'];
const CONTRADICTORY = ['P0001'];
const INCOMPLETE = ['55000'];

const ROTATE_SQL = 'SELECT command_id, credential_epoch FROM public.rotate_shared_world_invite_credential_v1($1,$2,$3)';
const SUBMIT_SQL = 'SELECT outcome, command_id, requested_invitation_id FROM public.submit_shared_world_direct_invitation_v1($1,$2,$3)';
const BIRTH_SQL = 'SELECT outcome, born_world_id FROM public.commit_shared_world_direct_acceptance_birth_v1($1,$2,$3,$4,$5)';
const LEAVE_SQL = 'SELECT outcome, closed_membership_episode_id FROM public.commit_shared_world_standard_voluntary_leave_v1($1,$2,$3)';
const GOV_APPROVE_SQL = 'SELECT outcome, committed_approval_id FROM public.commit_shared_world_governance_approval_v1($1,$2)';
const END_PREPARE_SQL = `SELECT outcome, prepared_proposal_id FROM public.prepare_shared_world_standard_end_governance_v1($1,$2,$3,$4)`;
const END_COMMIT_SQL = `SELECT outcome, ended_world_id FROM public.commit_shared_world_standard_end_v1($1,$2,$3)`;
const REMOVE_PREPARE_SQL = `SELECT outcome, prepared_proposal_id
  FROM public.prepare_shared_world_remove_member_governance_v1($1,$2,$3,$4,$5)`;
const REMOVE_COMMIT_SQL = `SELECT outcome, removed_world_id
  FROM public.commit_shared_world_member_removal_v1($1,$2,$3)`;
const REJOIN_PREPARE_SQL = `SELECT outcome, prepared_proposal_id
  FROM public.prepare_shared_world_rejoin_governance_v1($1,$2,$3,$4,$5)`;
const REJOIN_COMMIT_SQL = `SELECT outcome, rejoined_world_id
  FROM public.commit_shared_world_member_rejoin_v1($1,$2,$3,$4)`;
const HISTORY_PREPARE_SQL = `SELECT outcome, prepared_manifest_version_id, prepared_required_approver_count
  FROM public.prepare_shared_world_history_package_v1($1,$2,$3,$4)`;
const HISTORY_APPROVE_SQL = 'SELECT outcome, committed_approval_id FROM public.commit_shared_world_history_package_approval_v1($1,$2)';
const HISTORY_GRANT_SQL = `SELECT outcome, committed_grant_id FROM public.commit_shared_world_history_access_grant_v1($1,$2,$3,$4)`;
const TEXT_COMMIT_SQL = `SELECT outcome, command_id, material_world_id, committed_material_id, committed_history_item_id,
  committed_material_kind, audience_size, material_established_at
  FROM public.commit_shared_world_human_text_v1($1,$2,$3,$4,$5)`;
const VOICE_COMMIT_SQL = `SELECT outcome, committed_material_id, committed_history_item_id, audience_size
  FROM public.commit_shared_world_human_voice_note_v1($1,$2,$3,$4,$5,$6,$7)`;
const QANDEEL_COMMIT_SQL = `SELECT outcome, committed_material_id, committed_history_item_id, committed_material_kind,
  audience_size, authority_size, material_dependency_edges, reasoning_dependency_edges, material_established_at
  FROM public.commit_shared_world_qandeel_material_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`;
const DELETE_SQL = `SELECT outcome, command_id, deleted_world_id, deleted_material_id, deleted_history_item_id,
  deleted_event_id, invalidated_targets, deleted_at
  FROM public.delete_shared_world_owned_material_v1($1,$2,$3,$4)`;
const MATERIAL_SQL = `SELECT world_id, material_id, history_item_id, material_kind, established_at,
  author_user_id, text_body, audio_object_ref, transcript_text FROM public.resolve_shared_world_material_v1($1,$2)`;
const VISIBILITY_SQL = 'SELECT world_id, history_item_id, occurred_at FROM public.resolve_shared_world_history_visibility_v1($1,$2)';

const opaqueRef = (label) => `ref:i04g-runtime:${label}:${randomUUID()}`;

/** The exact frozen I-03F output identity: sha256 over the exact UTF-8 bytes. */
const digestOutput = (text) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;

/** The exact frozen I-03G readiness fingerprint, reproduced here from its own definition. */
const READINESS_VERSION = 'QANDEEL_CWV2_SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_V1';
const readinessRef = ({ effectiveContextRef, outputDigest, sourceDisclosureGateRef, authorityRevalidationRef }) =>
  `sha256:${createHash('sha256').update([
    READINESS_VERSION,
    `effectiveContext=${effectiveContextRef}`,
    `output=${outputDigest}`,
    `sourceDisclosureGate=${sourceDisclosureGateRef}`,
    `authorityRevalidation=${authorityRevalidationRef}`,
  ].join('\n'), 'utf8').digest('hex')}`;

/**
 * The exact frozen I-03D audience-state fingerprint of a World's CURRENT audience,
 * reproduced here from the frozen definition.
 *
 * It is per (user, EPISODE) and carries the exact World, which is what makes a
 * leave, a rejoin, a governed topology change and a different World each produce a
 * different reference.
 */
async function currentAudienceSnapshotRef(worldId) {
  const members = await rows(
    'SELECT user_id, membership_episode_id FROM public.resolve_shared_world_human_audience_snapshot_v1($1)', [worldId]);
  const byCodeUnit = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
  const rendered = members
    .map((row) => ({ user: String(row.user_id).toLowerCase(), episode: String(row.membership_episode_id).toLowerCase() }))
    .sort((left, right) => byCodeUnit(left.user, right.user) || byCodeUnit(left.episode, right.episode))
    .map((member) => `${member.user}@${member.episode}`)
    .join(',');
  return `sha256:${createHash('sha256').update([
    'QANDEEL_CWV2_SHARED_HUMAN_AUDIENCE_SNAPSHOT_V1',
    'state=RESOLVED',
    `world=${String(worldId).toLowerCase()}`,
    `members=${rendered}`,
  ].join('\n'), 'utf8').digest('hex')}`;
}

/** One complete, internally consistent I-03 evidence bundle for one exact body and audience. */
function evidenceFor(body, label, audienceSnapshotRef) {
  const effectiveContextRef = `ec:${label}:${randomUUID()}`;
  const sourceDisclosureGateRef = `gate:${label}:${randomUUID()}`;
  const authorityRevalidationRef = `rev:${label}:${randomUUID()}`;
  const outputDigest = digestOutput(body);
  return {
    effectiveContextRef,
    outputDigest,
    sourceDisclosureGateRef,
    authorityRevalidationRef,
    readiness: readinessRef({ effectiveContextRef, outputDigest, sourceDisclosureGateRef, authorityRevalidationRef }),
    audienceSnapshotRef,
  };
}

const UUID = 'uuid';
const TEXT = 'text';
const INT = 'integer';
const TSTZ = 'timestamp with time zone';

const OWNED_COLUMNS = {
  [COMMIT_COMMANDS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['material_id', UUID, 'NO', null],
    ['history_item_id', UUID, 'NO', null], ['material_kind', TEXT, 'NO', null], ['producer_kind', TEXT, 'NO', null],
    ['actor_user_id', UUID, 'YES', null], ['body_digest', TEXT, 'NO', null],
    ['request_ref', TEXT, 'NO', null],
    ['baseline_viewer_count', INT, 'NO', null], ['committed_at', TSTZ, 'NO', null],
  ],
  [EVIDENCE]: [
    ['material_id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['readiness_state', TEXT, 'NO', null],
    ['readiness_ref', TEXT, 'NO', null], ['effective_context_ref', TEXT, 'NO', null],
    ['output_digest', TEXT, 'NO', null], ['source_disclosure_gate_ref', TEXT, 'NO', null],
    ['authority_revalidation_ref', TEXT, 'NO', null], ['audience_snapshot_ref', TEXT, 'NO', null],
  ],
  [AUTHORITY]: [
    ['material_id', UUID, 'NO', null], ['world_id', UUID, 'NO', null],
    ['history_item_id', UUID, 'NO', null], ['resolution_state', TEXT, 'NO', null],
  ],
  [DELETED_EVENTS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['material_id', UUID, 'NO', null],
    ['history_item_id', UUID, 'NO', null], ['occurred_at', TSTZ, 'NO', null],
  ],
  [DELETE_COMMANDS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['material_id', UUID, 'NO', null],
    ['actor_user_id', UUID, 'NO', null], ['material_deleted_event_id', UUID, 'NO', null],
    ['invalidated_target_count', INT, 'NO', null], ['committed_at', TSTZ, 'NO', null],
  ],
};

const OWNED_FOREIGN_KEYS = {
  shared_world_material_commit_commands_material_fk: 'FOREIGN KEY (material_id, world_id) REFERENCES shared_world_materials(id, world_id) ON DELETE RESTRICT',
  shared_world_material_commit_commands_history_item_fk: 'FOREIGN KEY (history_item_id, world_id) REFERENCES shared_world_history_items(id, world_id) ON DELETE RESTRICT',
  shared_world_material_commit_commands_actor_fk: 'FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_qandeel_material_evidence_material_fk: 'FOREIGN KEY (material_id, world_id) REFERENCES shared_world_materials(id, world_id) ON DELETE RESTRICT',
  shared_world_material_historical_authority_material_fk: 'FOREIGN KEY (material_id, world_id) REFERENCES shared_world_materials(id, world_id) ON DELETE RESTRICT',
  shared_world_material_historical_authority_item_fk: 'FOREIGN KEY (history_item_id, world_id) REFERENCES shared_world_history_items(id, world_id) ON DELETE RESTRICT',
  shared_world_material_deleted_events_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_material_deleted_events_material_fk: 'FOREIGN KEY (material_id, world_id) REFERENCES shared_world_materials(id, world_id) ON DELETE RESTRICT',
  shared_world_material_deleted_events_history_item_fk: 'FOREIGN KEY (history_item_id, world_id) REFERENCES shared_world_history_items(id, world_id) ON DELETE RESTRICT',
  shared_world_material_delete_commands_material_fk: 'FOREIGN KEY (material_id, world_id) REFERENCES shared_world_materials(id, world_id) ON DELETE RESTRICT',
  shared_world_material_delete_commands_actor_fk: 'FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_material_delete_commands_event_fk: 'FOREIGN KEY (material_deleted_event_id) REFERENCES shared_world_material_deleted_events(id) ON DELETE RESTRICT',
};

const OWNED_BINDINGS = [
  [COMMIT_COMMANDS, 'shared_world_material_commit_commands_pk', /PRIMARY KEY \(id\)/u],
  [COMMIT_COMMANDS, 'shared_world_material_commit_commands_material_key', /UNIQUE \(material_id\)/u],
  [COMMIT_COMMANDS, 'shared_world_material_commit_commands_history_item_key', /UNIQUE \(history_item_id\)/u],
  [COMMIT_COMMANDS, 'shared_world_material_commit_commands_producer_check', /QANDEEL/u],
  [COMMIT_COMMANDS, 'shared_world_material_commit_commands_digest_check', /sha256/u],
  [COMMIT_COMMANDS, 'shared_world_material_commit_commands_request_check', /sha256/u],
  [AUTHORITY, 'shared_world_material_historical_authority_pk', /PRIMARY KEY \(material_id\)/u],
  [AUTHORITY, 'shared_world_material_historical_authority_item_key', /UNIQUE \(history_item_id\)/u],
  [AUTHORITY, 'shared_world_material_historical_authority_state_check', /UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT/u],
  [COMMIT_COMMANDS, 'shared_world_material_commit_commands_viewers_check', /baseline_viewer_count > 0/u],
  [EVIDENCE, 'shared_world_qandeel_material_evidence_pk', /PRIMARY KEY \(material_id\)/u],
  [EVIDENCE, 'shared_world_qandeel_material_evidence_readiness_key', /UNIQUE \(readiness_ref\)/u],
  [EVIDENCE, 'shared_world_qandeel_material_evidence_state_check', /READY_FOR_LATER_DELIVERY_GATES/u],
  [EVIDENCE, 'shared_world_qandeel_material_evidence_digest_check', /sha256/u],
  [EVIDENCE, 'shared_world_qandeel_material_evidence_opaque_refs_check', /audience_snapshot_ref/u],
  [DELETED_EVENTS, 'shared_world_material_deleted_events_pk', /PRIMARY KEY \(id\)/u],
  [DELETED_EVENTS, 'shared_world_material_deleted_events_material_key', /UNIQUE \(material_id\)/u],
  [DELETED_EVENTS, 'shared_world_material_deleted_events_history_item_key', /UNIQUE \(history_item_id\)/u],
  [DELETE_COMMANDS, 'shared_world_material_delete_commands_pk', /PRIMARY KEY \(id\)/u],
  [DELETE_COMMANDS, 'shared_world_material_delete_commands_material_key', /UNIQUE \(material_id\)/u],
  [DELETE_COMMANDS, 'shared_world_material_delete_commands_event_key', /UNIQUE \(material_deleted_event_id\)/u],
  [DELETE_COMMANDS, 'shared_world_material_delete_commands_invalidated_check', /invalidated_target_count >= 0/u],
];

/** The exact count of every relation this verifier names, for the Worlds under test. */
async function sharedCounts(worldIds, humans) {
  const [row] = await rows(
    `SELECT (SELECT count(*) FROM ${MATERIALS} WHERE world_id = ANY($1::uuid[])) AS materials,
            (SELECT count(*) FROM ${TEXT_BODIES} b JOIN ${MATERIALS} m ON m.id = b.material_id
              WHERE m.world_id = ANY($1::uuid[])) AS "textBodies",
            (SELECT count(*) FROM ${VOICE_BODIES} b JOIN ${MATERIALS} m ON m.id = b.material_id
              WHERE m.world_id = ANY($1::uuid[])) AS "voiceBodies",
            (SELECT count(*) FROM ${DEPENDENCIES} WHERE world_id = ANY($1::uuid[])) AS dependencies,
            (SELECT count(*) FROM ${ITEMS} WHERE world_id = ANY($1::uuid[])) AS items,
            (SELECT count(*) FROM ${GRANTS} WHERE world_id = ANY($1::uuid[])) AS grants,
            (SELECT count(*) FROM ${ENTITLEMENTS} WHERE world_id = ANY($1::uuid[])) AS entitlements,
            (SELECT count(*) FROM ${EPISODES} WHERE world_id = ANY($1::uuid[])) AS episodes,
            (SELECT count(*) FROM ${GRANT_STATE} WHERE grantor_user_id = ANY($2::uuid[])) AS "standingGrants",
            (SELECT count(*) FROM public.conversation_sessions) AS "personalSessions",
            (SELECT count(*) FROM public.conversation_turns) AS "personalTurns"`,
    [worldIds, humans]);
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

const deltaOf = (before, after) => Object.fromEntries(
  Object.keys(after).map((key) => [key, after[key] - before[key]]).filter(([, value]) => value !== 0));

// ---------------------------------------------------------------------------

async function verifyCatalog() {
  stage = 'catalog: every relation 0090 owns exists exactly once';
  for (const table of OWN_TABLES) {
    const [meta] = await rows(
      'SELECT c.relkind kind, c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.oid = $1::regclass',
      [table]);
    assert.ok(meta, `${table} exists`);
    assert.equal(meta.kind, 'r', `${table} is an ordinary table`);
    assert.equal(meta.owner, 'postgres', `${table} is owned by postgres`);
    assert.equal(meta.rls, true, `row level security is enabled on ${table}`);
  }

  stage = 'catalog: the owned columns, unchanged and in their original positions';
  for (const [table, owned] of Object.entries(OWNED_COLUMNS)) {
    const columns = await rows(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [table.replace('public.', '')]);
    const observed = columns.map((c) => [c.column_name, c.data_type, c.is_nullable, c.column_default]);
    assert.deepEqual(
      observed.slice(0, owned.length),
      owned,
      `${table} still carries every column migration 0090 owns, unchanged and in its original position`);
    for (const [name] of owned) {
      assert.equal(observed.filter((column) => column[0] === name).length, 1, `${table}.${name} appears exactly once`);
    }
  }

  stage = 'catalog: the exact bindings and foreign keys 0090 owns';
  const constraintsOf = async (table) => rows(
    'SELECT conname name, contype type, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY conname',
    [table]);
  const live = new Map();
  for (const table of OWN_TABLES) live.set(table, await constraintsOf(table));
  const defOf = (table, name) => (live.get(table).find((c) => c.name === name) ?? { def: `MISSING CONSTRAINT ${name}` }).def;
  for (const [table, name, shape] of OWNED_BINDINGS) {
    assert.match(defOf(table, name), shape, `${name} is the exact binding migration 0090 owns`);
  }
  const normalize = (def) => def.replace(/REFERENCES (?:public\.)?/u, 'REFERENCES ');
  const liveKeys = new Map();
  for (const table of OWN_TABLES) {
    for (const c of live.get(table).filter((entry) => entry.type === 'f')) liveKeys.set(c.name, normalize(c.def));
  }
  for (const [name, def] of Object.entries(OWNED_FOREIGN_KEYS)) {
    assert.equal(liveKeys.get(name), def,
      `${name} binds exactly the canonical row, restrictively: canonical history is never cascaded away`);
  }

  stage = 'catalog: RLS on, zero policies and no application-role privilege';
  for (const table of OWN_TABLES) {
    const [{ n: policies }] = await rows('SELECT count(*)::int n FROM pg_policy p WHERE p.polrelid = $1::regclass', [table]);
    assert.equal(policies, 0, `${table} carries zero RLS policies`);
    const [{ publicAcl }] = await rows(
      'SELECT EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) a WHERE c.oid = $1::regclass AND a.grantee = 0) AS "publicAcl"',
      [table]);
    assert.equal(publicAcl, false, `PUBLIC must not hold any privilege on ${table}`);
    for (const role of APPLICATION_ROLES) {
      for (const privilege of PRIVILEGES) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
  }

  stage = 'catalog: every primitive is sealed, pinned, VOLATILE, World-first and app-unreachable';
  for (const fnName of OWN_FUNCTIONS) {
    const [fn] = await rows(
      `SELECT pr.prosecdef secdef, pr.provolatile volatility, pr.proconfig config, pr.prosrc,
              pg_get_userbyid(pr.proowner) owner FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [fnName]);
    assert.ok(fn, `${fnName} exists`);
    assert.equal(fn.owner, 'postgres', `${fnName} is owned by postgres`);
    assert.equal(fn.secdef, true, `${fnName} is SECURITY DEFINER`);
    assert.equal(fn.volatility, 'v', `${fnName} mutates or locks and is VOLATILE`);
    assert.ok((fn.config ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'),
      `${fnName} pins an empty search_path`);
    const [{ allowed: publicExecute }] = await rows("SELECT has_function_privilege('public', $1, 'EXECUTE') AS allowed", [fnName]);
    assert.equal(publicExecute, false, `PUBLIC must not hold EXECUTE on ${fnName}`);
    for (const role of APPLICATION_ROLES) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, fnName, 'EXECUTE']);
      assert.equal(allowed, false, `${role} must not hold EXECUTE on ${fnName} before the launch gate exists`);
    }
    assert.doesNotMatch(fn.prosrc, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp/u,
      `${fnName} persists one database-owned instant`);
    assert.doesNotMatch(fn.prosrc, /pg_advisory|LOCK TABLE/iu, `${fnName} takes only canonical row locks`);
    assert.doesNotMatch(fn.prosrc, /UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds/u,
      `${fnName} creates, closes and mutates no Shared World`);
    assert.doesNotMatch(fn.prosrc, /INSERT INTO public\.shared_world_membership_episodes|UPDATE public\.shared_world_membership_episodes/u,
      `${fnName} creates and mutates no membership episode`);
    assert.doesNotMatch(fn.prosrc, /shared_world_history_access_grants|shared_world_standard_closed_view_entitlements/u,
      `${fnName} writes no history grant and no closed-World entitlement`);
    if (fn.prosrc.includes('FOR UPDATE')) {
      assert.match(fn.prosrc, /FROM public\.shared_worlds w WHERE w\.id = p_world_id FOR UPDATE/u,
        `${fnName} locks the exact World row first`);
    }
  }

  stage = 'catalog: QANDEEL is a system actor, and only owner deletion deletes anything';
  const sourceOf = async (fnName) => (await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [fnName]))[0].prosrc;
  const qandeel = await sourceOf(QANDEEL_FN);
  assert.doesNotMatch(qandeel, /auth\.uid/u,
    'the QANDEEL commit core derives no human: a system actor is never a consent or ownership principal');
  assert.match(qandeel, /WHEN reasoning_edges > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'/u,
    'and an unresolvable additional human requirement is recorded as unresolved, never as a known-empty one');
  const humanCore = await sourceOf(HUMAN_CORE);
  assert.match(humanCore, /auth\.uid\(\)/u, 'the human commit core derives its human from auth.uid()');
  for (const fnName of [HUMAN_CORE, TEXT_FN, VOICE_FN, QANDEEL_FN]) {
    assert.doesNotMatch(await sourceOf(fnName), /DELETE FROM/iu, `${fnName} deletes nothing: committing destroys nothing`);
  }
  // RECONCILED BY I-07D.
  //
  // 0090 deliberately anticipated a later reviewed Introduction producer: its
  // body-count assertion already allowed a RESERVED-form material to remove
  // ZERO body rows, and its own comment says such material must stay deletable
  // by its own owner without reopening this primitive. What it could not do was
  // destroy a payload relation that did not exist yet.
  //
  // Migration 0115 added exactly one branch - EXPLICIT_DISCLOSURE, by name -
  // so this census is REPAIRED to the exact new target set rather than deleted,
  // and the three things that matter are proven beside it: the new targets are
  // reachable ONLY under that exact kind, no other reserved kind became
  // deletable, and no envelope, history item, audience, approver, dependency,
  // grant, entitlement, episode, resource version or event is ever removed.
  const deletion = await sourceOf(DELETE_FN);
  const deletes = [...deletion.matchAll(/DELETE FROM public\.(\w+)/gu)].map((m) => m[1]);
  assert.deepEqual([...new Set(deletes)].sort(),
    ['introduction_disclosure_media_payloads', 'introduction_disclosure_text_payloads',
      'shared_world_text_material_bodies', 'shared_world_voice_note_material_bodies'],
    'every DELETE owner deletion issues targets a material BODY relation or a reviewed disclosure PAYLOAD, and nothing else');
  assert.match(deletion, /owned\.material_kind = 'EXPLICIT_DISCLOSURE'/u,
    'and the new branch names the exact reserved kind rather than guessing at a body form');
  assert.doesNotMatch(deletion, /WORLD_EVENT_DERIVED_MATERIAL/u,
    'so no OTHER reserved material kind became deletable through guessed semantics');
  // The two new targets are inside the exact-kind branch, and the two frozen
  // ones are outside it: the branch narrows what it added rather than widening
  // what was already there.
  const introductionBranch = deletion.slice(deletion.indexOf("owned.material_kind = 'EXPLICIT_DISCLOSURE'"));
  for (const frozen of ['shared_world_text_material_bodies', 'shared_world_voice_note_material_bodies']) {
    assert.ok(deletion.indexOf(`DELETE FROM public.${frozen}`) < deletion.indexOf("owned.material_kind = 'EXPLICIT_DISCLOSURE'"),
      `the frozen ${frozen} deletion still runs for every kind, outside the new branch`);
  }
  for (const added of ['introduction_disclosure_text_payloads', 'introduction_disclosure_media_payloads']) {
    assert.match(introductionBranch, new RegExp(`DELETE FROM public\\.${added}`, 'u'),
      `and ${added} is destroyed only inside the exact EXPLICIT_DISCLOSURE branch`);
  }
  assert.doesNotMatch(deletion, /SET lifecycle|SET phase|SET closed_at/u,
    'a privacy material mutation never reopens or changes World lifecycle');
  // The canonical owner-deletion primitive is still the ONLY thing in the
  // database that destroys source content of any kind.
  const destroyers = await rows(
    `SELECT DISTINCT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
        AND (pr.prosrc ~ 'DELETE FROM public\\.shared_world_text_material_bodies'
          OR pr.prosrc ~ 'DELETE FROM public\\.shared_world_voice_note_material_bodies'
          OR pr.prosrc ~ 'DELETE FROM public\\.introduction_disclosure_text_payloads'
          OR pr.prosrc ~ 'DELETE FROM public\\.introduction_disclosure_media_payloads') ORDER BY 1`);
  assert.deepEqual(destroyers.map((r) => r.proname), ['delete_shared_world_owned_material_v1'],
    'and it is still the only primitive in the database that destroys any source content');

  stage = 'catalog: RECONCILED BY I-07D - the two commit cores serve BOTH World modes, and Standard is unchanged';
  // 0090 refused every World that was not ACTIVE / STANDARD, and said so in its
  // own header: the SCHEMA is not Standard-only, the PRIMITIVE refused a paired
  // World because I-04G implemented no Introduction producer and would not guess
  // at one. Migration 0118 is that reviewed producer. It does not add a second
  // core beside these - it REPLACES both forward-only, so one canonical truth and
  // history model serves both modes.
  //
  // This verifier therefore stops asserting a Standard-only gate it no longer
  // owns, and asserts instead the three things that actually protect what 0090
  // built: the lifecycle is still an unconditional refusal, the Introduction
  // branch is STRICTER than the Standard one rather than looser, and every
  // Standard semantic in this file is untouched. The runtime probes below prove
  // the last of those against real rows - M14, M16 and M17 all still refuse.
  for (const fnName of [HUMAN_CORE, QANDEEL_FN]) {
    const core = await sourceOf(fnName);
    assert.match(core, /IF world\.lifecycle <> 'ACTIVE' THEN/u,
      `${fnName} still refuses every World that is not ACTIVE, before it considers any phase at all`);
    assert.match(core, /ELSIF world\.phase <> 'STANDARD' THEN/u,
      `${fnName} still refuses every World mode outside the two frozen ones, so a future mode inherits nothing`);
    assert.match(core, /ELSIF world\.phase = 'INTRODUCTION' THEN/u,
      `${fnName} branches on the Introduction phase rather than refusing it`);
    // THE NARROWER ENVELOPE: an Introduction World must additionally have a LIVE
    // Introduction Record and exactly two humans - neither of which any Standard
    // World is ever asked for.
    assert.match(core, /r\.world_id = p_world_id AND r\.introduction_status = 'ACTIVE'/u,
      `${fnName} admits an Introduction World only while its exact Record is still ACTIVE`);
    assert.match(core, /IF world\.phase = 'INTRODUCTION' AND array_length\(audience, 1\) <> 2 THEN/u,
      `${fnName} refuses an Introduction whose derived audience is not exactly the two matched humans`);
    // AND NOTHING 0090 OWNS MOVED. These are the same clauses asserted above for
    // the whole commit family; they are restated here against the exact two
    // replaced bodies so a future replacement cannot quietly relax one of them.
    assert.doesNotMatch(core, /DELETE FROM/iu, `${fnName} still deletes nothing`);
    assert.doesNotMatch(core, /UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds/u,
      `${fnName} still creates, closes and mutates no Shared World`);
    assert.doesNotMatch(core, /UPDATE public\.introduction_records|INSERT INTO public\.introduction_records/u,
      `${fnName} reads the Introduction Record and never moves it: committing material is not a lifecycle act`);
    assert.doesNotMatch(core, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp/u,
      `${fnName} still persists one database-owned instant`);
    assert.match(core, /FROM public\.shared_worlds w WHERE w\.id = p_world_id FOR UPDATE/u,
      `${fnName} still locks the exact World row FIRST, which is what serializes it against a terminal transition`);
    assert.match(core, /public\.resolve_shared_world_human_audience_snapshot_v1\(p_world_id\)/u,
      `${fnName} still derives its audience through the frozen I-03D boundary and never accepts one`);
    assert.doesNotMatch(core, /'EXPLICIT_DISCLOSURE'/u,
      `${fnName} did not acquire the reserved disclosure kind by being extended`);
  }
  // The typed human entry points were NOT replaced: they delegate to the one
  // core and hold no gate of their own, which is why extending it was enough.
  for (const fnName of [TEXT_FN, VOICE_FN]) {
    const typed = await sourceOf(fnName);
    assert.match(typed, /public\.commit_shared_world_human_material_v1/u, `${fnName} still delegates to the ONE core`);
    assert.doesNotMatch(typed, /world\.phase|world\.lifecycle/u, `${fnName} still holds no lifecycle gate of its own`);
  }
  // ONE CANONICAL SHARED TRUTH MODEL. The Introduction did not get a material
  // system of its own, which is the claim this file is best placed to police.
  const producers = await rows(
    `SELECT DISTINCT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
        AND pr.prosrc ~ 'INSERT INTO public\\.shared_world_materials\\y' ORDER BY 1`);
  // Bare `proname`, because that is what the catalog returns: the constants
  // above are full signatures for `regprocedure` lookups and are not names.
  assert.deepEqual(producers.map((r) => r.proname),
    ['commit_introduction_progressive_disclosure_v1',
      'commit_shared_world_human_material_v1',
      'commit_shared_world_qandeel_material_v1'],
    'exactly three reviewed producers write a Shared material: the two extended cores and the one disclosure producer');

  stage = 'catalog: the historical widening gate is installed, sealed and on the exact frozen relation';
  const [gate] = await rows(
    `SELECT pg_get_userbyid(pr.proowner) owner, pr.prosecdef secdef, pr.proconfig config, pr.prosrc
       FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [GATE_FN]);
  assert.ok(gate, 'the widening gate function exists');
  assert.equal(gate.owner, 'postgres');
  assert.equal(gate.secdef, true);
  assert.ok((gate.config ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'));
  assert.match(gate.prosrc, /resolution_state = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'/u,
    'it refuses exactly the unresolved state and nothing else');
  assert.doesNotMatch(gate.prosrc, /INSERT INTO|UPDATE public\.|DELETE FROM|auth\.uid/u,
    'the gate decides; it mutates nothing and trusts no client claim');
  const [{ installed }] = await rows(
    `SELECT EXISTS (SELECT 1 FROM pg_trigger tg
       WHERE tg.tgrelid = 'public.shared_world_history_package_manifest_items'::regclass
         AND tg.tgname = 'shared_world_material_historical_widening_gate'
         AND NOT tg.tgisinternal) AS installed`);
  assert.equal(installed, true,
    'unresolved historical-sharing authority is refused where widening actually happens');

  stage = 'catalog: the ONE material read boundary is unchanged';
  const [{ allowed: resolverExecute }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed',
    ['service_role', MATERIAL_RESOLVER, 'EXECUTE']);
  assert.equal(resolverExecute, true, 'service_role must still execute the ONE narrow material resolver');
}

// ---------------------------------------------------------------------------

async function provisionWorld(inviter, target, label) {
  const ref = opaqueRef(label);
  // The frozen I-04A rotation is a compare-and-swap: a NULL expected epoch means
  // `this human has no credential yet`, and offering it to a human who already has
  // one is a stale-state refusal. A fixture human may legitimately be the target of
  // more than one World here, so the CURRENT epoch is read and offered.
  await identity('postgres');
  const [state] = await rows(`SELECT epoch FROM ${CREDENTIAL} WHERE user_id = $1`, [target]);
  await identity('authenticated', target);
  await rows(ROTATE_SQL, [randomUUID(), ref, state ? state.epoch : null]);
  await identity('authenticated', inviter);
  const invitationId = randomUUID();
  await rows(SUBMIT_SQL, [randomUUID(), invitationId, ref]);
  await identity('postgres', target);
  const worldId = randomUUID();
  const inviterEpisode = randomUUID();
  const targetEpisode = randomUUID();
  const [born] = await rows(BIRTH_SQL, [randomUUID(), invitationId, worldId, inviterEpisode, targetEpisode]);
  assert.equal(born.outcome, 'BORN', 'the fixture World was born through the frozen I-04B primitive');
  await identity('postgres');
  return { worldId, inviterEpisode, targetEpisode, invitationId };
}

async function approveWith(proposalId, humans) {
  for (const human of humans) {
    await identity('postgres', human);
    const [approved] = await rows(GOV_APPROVE_SQL, [randomUUID(), proposalId]);
    assert.equal(approved.outcome, 'APPROVED');
  }
  await identity('postgres');
}

async function leaveAs(worldId, human) {
  await identity('postgres', human);
  const [left] = await rows(LEAVE_SQL, [randomUUID(), worldId, randomUUID()]);
  assert.equal(left.outcome, 'LEFT');
  await identity('postgres');
}

/**
 * THE ACTOR BELONGS TO THE CALL SITE, NEVER TO LEFTOVER SESSION STATE.
 *
 * `commit_shared_world_member_rejoin_v1` is a HUMAN authority in frozen 0085: it
 * derives the rejoining human from `auth.uid()` and admits only the exact former
 * member the approved proposal names. The whole verifier runs inside ONE
 * transaction, so a `SET LOCAL` subject established by one helper survives into
 * the next - and this rejoin was invoked with whatever subject the preceding
 * approvals happened to leave behind, which was none. The frozen runtime refused
 * it correctly. The repair is this helper, not a change to the runtime: the exact
 * actor is established immediately before the call, every time.
 */
async function rejoinAs(targetUserId, proposalId) {
  await identity('postgres', targetUserId);
  const [rejoined] = await rows(REJOIN_COMMIT_SQL, [randomUUID(), proposalId, randomUUID(), randomUUID()]);
  await identity('postgres');
  return rejoined;
}

/** The frozen 0087 package approval also derives its human from `auth.uid()`. */
async function approvePackageAs(human, manifestId) {
  await identity('postgres', human);
  const [approved] = await rows(HISTORY_APPROVE_SQL, [randomUUID(), manifestId]);
  await identity('postgres');
  return approved;
}

/**
 * Governance EXECUTION carries no human authority of its own - frozen 0085 and
 * 0088 derive nothing from `auth.uid()` here, the approvals already did. It is
 * still invoked from an explicit no-actor session rather than from whichever
 * approver went last, so the fixture never depends on that being true.
 */
async function removeMemberBy(proposalId) {
  await identity('postgres');
  const [removed] = await rows(REMOVE_COMMIT_SQL, [randomUUID(), proposalId, randomUUID()]);
  return removed;
}

async function closeWorld(worldId, humans) {
  const proposal = randomUUID();
  await identity('postgres');
  const [prepared] = await rows(END_PREPARE_SQL, [proposal, randomUUID(), randomUUID(), worldId]);
  assert.equal(prepared.outcome, 'PREPARED');
  await approveWith(proposal, humans);
  await identity('postgres');
  const [closed] = await rows(END_COMMIT_SQL, [randomUUID(), proposal, randomUUID()]);
  assert.equal(closed.outcome, 'WORLD_ENDED');
  await identity('postgres');
}

async function commitText(worldId, human, body, commandId = randomUUID(), materialId = randomUUID(), itemId = randomUUID()) {
  await identity('postgres', human);
  const [committed] = await rows(TEXT_COMMIT_SQL, [commandId, worldId, materialId, itemId, body]);
  await identity('postgres');
  return committed;
}

async function commitVoice(worldId, human, audioRef, transcript = null, durationMs = null) {
  await identity('postgres', human);
  const [committed] = await rows(VOICE_COMMIT_SQL,
    [randomUUID(), worldId, randomUUID(), randomUUID(), audioRef, transcript, durationMs]);
  await identity('postgres');
  return committed;
}

async function commitQandeel(worldId, body, {
  kind = 'QANDEEL_ANALYSIS', sources = [], reasoning = [], evidence = null, commandId = randomUUID(),
  materialId = randomUUID(), itemId = randomUUID(),
} = {}) {
  await identity('postgres');
  // A valid fixture uses the REAL canonical I-03D fingerprint of this World's
  // current audience, never a fabricated reference: the core revalidates it.
  const e = evidence ?? evidenceFor(body, 'qandeel', await currentAudienceSnapshotRef(worldId));
  await identity('postgres');
  const [committed] = await rows(QANDEEL_COMMIT_SQL, [
    commandId, worldId, materialId, itemId, kind, body,
    e.effectiveContextRef, e.outputDigest, e.sourceDisclosureGateRef, e.authorityRevalidationRef,
    e.readiness, e.audienceSnapshotRef, sources, reasoning]);
  return { ...committed, evidence: e };
}

async function deleteOwn(worldId, human, materialId, commandId = randomUUID(), eventId = randomUUID()) {
  await identity('postgres', human);
  const [deleted] = await rows(DELETE_SQL, [commandId, worldId, materialId, eventId]);
  await identity('postgres');
  return deleted;
}

const materialFor = async (worldId, userId) => rows(MATERIAL_SQL, [worldId, userId]);
const visibleFor = async (worldId, userId) => (await rows(VISIBILITY_SQL, [worldId, userId])).map((row) => row.history_item_id);

// ---------------------------------------------------------------------------

async function verifyCommit(f) {
  const world = await provisionWorld(f.inviter, f.second, 'commit');

  stage = 'M01: human text atomically creates material, body, history, audience, authority, provenance and command';
  const committed = await commitText(world.worldId, f.inviter, 'a real Shared statement');
  assert.equal(committed.outcome, 'MATERIAL_COMMITTED');
  assert.equal(committed.committed_material_kind, 'HUMAN_TEXT');
  assert.equal(Number(committed.audience_size), 2, 'the exact current human audience of the exact World');
  const [created] = await rows(
    `SELECT (SELECT count(*) FROM ${MATERIALS} WHERE id = $1) materials,
            (SELECT count(*) FROM ${TEXT_BODIES} WHERE material_id = $1) bodies,
            (SELECT count(*) FROM ${ITEMS} WHERE id = $2) items,
            (SELECT count(*) FROM ${BASELINE} WHERE history_item_id = $2) viewers,
            (SELECT count(*) FROM ${ITEM_APPROVERS} WHERE history_item_id = $2) approvers,
            (SELECT count(*) FROM ${DEPENDENCIES} WHERE target_material_id = $1) provenance,
            (SELECT count(*) FROM ${COMMIT_COMMANDS} WHERE material_id = $1) commands`,
    [committed.committed_material_id, committed.committed_history_item_id]);
  assert.deepEqual(Object.fromEntries(Object.entries(created).map(([k, v]) => [k, Number(v)])),
    { materials: 1, bodies: 1, items: 1, viewers: 2, approvers: 1, provenance: 1, commands: 1 },
    'one commit produces exactly one of each, and never a partial state');

  stage = 'M05 / M06: ONE database instant across material, history item and command';
  const [{ single }] = await rows(
    `SELECT (m.established_at = i.occurred_at AND i.occurred_at = i.registered_at
             AND i.registered_at = c.committed_at) AS single
       FROM ${MATERIALS} m JOIN ${ITEMS} i ON i.id = m.history_item_id
       JOIN ${COMMIT_COMMANDS} c ON c.material_id = m.id WHERE m.id = $1`, [committed.committed_material_id]);
  assert.equal(single, true, 'every authoritative moment of one commit is the same instant');

  stage = 'M07 / M08 / M09: the caller supplies no viewers, the author is the exact approver, membership co-owns nothing';
  const viewers = (await rows(`SELECT user_id FROM ${BASELINE} WHERE history_item_id = $1 ORDER BY user_id`,
    [committed.committed_history_item_id])).map((row) => row.user_id);
  assert.deepEqual(viewers.sort(), [f.inviter, f.second].sort(),
    'the baseline audience is the exact current human membership, derived rather than supplied');
  const approvers = (await rows(`SELECT approver_user_id FROM ${ITEM_APPROVERS} WHERE history_item_id = $1`,
    [committed.committed_history_item_id])).map((row) => row.approver_user_id);
  assert.deepEqual(approvers, [f.inviter],
    'the exact human author is the exact and only required material authority: membership co-owns nothing');
  const [{ mode }] = await rows(`SELECT authority_requirement_mode mode FROM ${ITEMS} WHERE id = $1`,
    [committed.committed_history_item_id]);
  assert.equal(mode, 'EXACT_HUMAN_APPROVER_SET');
  // There is no viewer parameter to supply, and a widened call is a signature error.
  await rejected(() => rows(`SELECT 1 FROM public.commit_shared_world_human_text_v1($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), world.worldId, randomUUID(), randomUUID(), 'x', [f.inviter]]), ['42883']);

  stage = 'M02: a voice note persists an immutable media reference and an optional transcript';
  const voice = await commitVoice(world.worldId, f.second, 'media-object-commit-1', 'the spoken words', 3200);
  assert.equal(voice.outcome, 'MATERIAL_COMMITTED');
  const [body] = await rows(`SELECT audio_object_ref a, transcript_text t, duration_ms d FROM ${VOICE_BODIES} WHERE material_id = $1`,
    [voice.committed_material_id]);
  assert.deepEqual([body.a, body.t, body.d], ['media-object-commit-1', 'the spoken words', 3200]);
  const bare = await commitVoice(world.worldId, f.second, 'media-object-commit-2', null, null);
  assert.equal(bare.outcome, 'MATERIAL_COMMITTED', 'a voice note needs no transcript');
  // A transcript alone can never masquerade as an original voice note.
  await identity('postgres', f.second);
  await rejected(() => rows(VOICE_COMMIT_SQL, [randomUUID(), world.worldId, randomUUID(), randomUUID(), null, 'only a transcript', null]),
    INVALID_PARAMETER, /SHARED_WORLD_MATERIAL_COMMAND_INVALID/u);
  await identity('postgres');

  stage = 'M03 / M04 / M10: QANDEEL material has no human author and a dependency-derived authority set';
  const analysis = await commitQandeel(world.worldId, 'an analysis that reproduces what was said',
    { sources: [committed.committed_material_id], reasoning: ['ctx:personal:9f2a'] });
  assert.equal(analysis.outcome, 'MATERIAL_COMMITTED');
  assert.equal(Number(analysis.authority_size), 1, 'exactly the union over its MATERIAL_DEPENDENCY sources');
  assert.equal(Number(analysis.material_dependency_edges), 1);
  assert.equal(Number(analysis.reasoning_dependency_edges), 1);
  const [qandeelMaterial] = await rows(`SELECT producer_kind p, author_user_id a FROM ${MATERIALS} WHERE id = $1`,
    [analysis.committed_material_id]);
  assert.equal(qandeelMaterial.p, 'QANDEEL');
  assert.equal(qandeelMaterial.a, null, 'QANDEEL is a system actor and has no human author');
  const analysisApprovers = (await rows(`SELECT approver_user_id u FROM ${ITEM_APPROVERS} WHERE history_item_id = $1`,
    [analysis.committed_history_item_id])).map((row) => row.u);
  assert.deepEqual(analysisApprovers, [f.inviter],
    'the QANDEEL approver set is the human authority of its source, never every World member');
  assert.equal(analysisApprovers.includes(f.second), false,
    'and the other current member is a VIEWER, never an authority, of somebody else material');

  stage = 'P06: a REASONING dependency alone never becomes material authority, and writes no raw content';
  const reasoningOnly = await commitQandeel(world.worldId, 'an analysis influenced only by private reasoning',
    { reasoning: ['ctx:personal:aa11', 'ctx:personal:bb22'] });
  assert.equal(Number(reasoningOnly.authority_size), 0, 'no material dependency means no propagated human authority');
  const [{ mode: reasoningMode }] = await rows(`SELECT authority_requirement_mode mode FROM ${ITEMS} WHERE id = $1`,
    [reasoningOnly.committed_history_item_id]);
  // Unknown is NOT known-empty. Reasoning-dependent material keeps the exact-approver
  // mode, so the frozen I-04F package path can never read it as approval-free.
  assert.equal(reasoningMode, 'EXACT_HUMAN_APPROVER_SET',
    'an unresolved additional human requirement is never written as approval-free');
  const [{ resolution: reasoningResolution }] = await rows(
    `SELECT resolution_state resolution FROM ${AUTHORITY} WHERE material_id = $1`, [reasoningOnly.committed_material_id]);
  assert.equal(reasoningResolution, 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT');
  const refs = (await rows(
    `SELECT source_context_ref r FROM ${DEPENDENCIES} WHERE target_material_id = $1 AND dependency_kind = 'REASONING_DEPENDENCY' ORDER BY r`,
    [reasoningOnly.committed_material_id])).map((row) => row.r);
  assert.deepEqual(refs, ['ctx:personal:aa11', 'ctx:personal:bb22']);
  for (const ref of refs) assert.doesNotMatch(ref, /\s/u, 'a private source reference is opaque, never prose');

  stage = 'P05: an INDEPENDENT target has no source of any kind';
  const independent = await commitQandeel(world.worldId, 'an independently established analysis');
  const [{ kind: independentKind, src, ctx }] = await rows(
    `SELECT dependency_kind kind, source_material_id src, source_context_ref ctx
       FROM ${DEPENDENCIES} WHERE target_material_id = $1`, [independent.committed_material_id]);
  assert.equal(independentKind, 'INDEPENDENT_TARGET_TRUTH');
  assert.equal(src, null);
  assert.equal(ctx, null);

  stage = 'P01 / P02: a MATERIAL source must pre-exist its target, and self dependency is refused';
  await rejected(() => commitQandeel(world.worldId, 'an analysis of nothing', { sources: [randomUUID()] }),
    UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
  const selfId = randomUUID();
  await rejected(() => commitQandeel(world.worldId, 'an analysis of itself',
    { sources: [selfId], materialId: selfId }), INVALID_PARAMETER, /SHARED_WORLD_MATERIAL_COMMAND_INVALID/u);
  // A source in a DIFFERENT World is not a source here.
  const elsewhere = await provisionWorld(f.inviter, f.third, 'commit-elsewhere');
  const foreign = await commitText(elsewhere.worldId, f.inviter, 'a statement in another World');
  await rejected(() => commitQandeel(world.worldId, 'an analysis reaching across Worlds',
    { sources: [foreign.committed_material_id] }), STALE, /SHARED_WORLD_MATERIAL_STALE/u);

  stage = 'Q05: exact output evidence cannot be reused for a different body or a different World';
  const reused = analysis.evidence;
  await rejected(() => commitQandeel(world.worldId, 'a different body under the same evidence', { evidence: reused }),
    INVALID_PARAMETER, /SHARED_WORLD_MATERIAL_EVIDENCE_INVALID/u);
  // Even the SAME body cannot commit twice under one readiness reference.
  await rejected(() => commitQandeel(world.worldId, 'an analysis that reproduces what was said', { evidence: reused }),
    CONFLICT, /SHARED_WORLD_MATERIAL_ID_CONFLICT/u);
  // And evidence whose readiness reference does not derive from its own parts is refused.
  const tampered = evidenceFor('a fresh analysis body', 'tampered', await currentAudienceSnapshotRef(world.worldId));
  await rejected(() => commitQandeel(world.worldId, 'a fresh analysis body',
    { evidence: { ...tampered, readiness: digestOutput('not the fingerprint') } }),
  INVALID_PARAMETER, /SHARED_WORLD_MATERIAL_EVIDENCE_INVALID/u);

  stage = 'M01 retry: an equivalent commit retry returns the committed result and mutates nothing';
  const retryCommand = randomUUID();
  const retryMaterial = randomUUID();
  const retryItem = randomUUID();
  const firstTry = await commitText(world.worldId, f.inviter, 'an idempotent statement', retryCommand, retryMaterial, retryItem);
  const secondTry = await commitText(world.worldId, f.inviter, 'an idempotent statement', retryCommand, retryMaterial, retryItem);
  assert.deepEqual(secondTry, firstTry, 'an equivalent retry is historically stable');
  await identity('postgres', f.inviter);
  await rejected(() => rows(TEXT_COMMIT_SQL, [retryCommand, world.worldId, retryMaterial, retryItem, 'a DIFFERENT statement']),
    CONFLICT, /SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT/u);
  await identity('postgres');
  return { world, text: committed, voice, analysis, reasoningOnly, independent, elsewhere, foreign };
}

async function verifyLifecycle(f) {
  stage = 'M14: a non-member human cannot commit';
  const world = await provisionWorld(f.inviter, f.second, 'lifecycle');
  await identity('postgres', f.outsider);
  await rejected(() => rows(TEXT_COMMIT_SQL, [randomUUID(), world.worldId, randomUUID(), randomUUID(), 'not mine to say']),
    UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
  await identity('postgres');
  // An unauthenticated caller fails closed rather than committing anonymously.
  await identity('postgres', null);
  await rejected(() => rows(TEXT_COMMIT_SQL, [randomUUID(), world.worldId, randomUUID(), randomUUID(), 'anonymous']),
    INSUFFICIENT_PRIVILEGE, /SHARED_WORLD_MATERIAL_AUTHENTICATION_REQUIRED/u);
  await identity('postgres');

  stage = 'M15: a one-human ACTIVE Standard World can continue ordinary material commit';
  await leaveAs(world.worldId, f.second);
  const sole = await commitText(world.worldId, f.inviter, 'the remaining human still speaks');
  assert.equal(sole.outcome, 'MATERIAL_COMMITTED');
  assert.equal(Number(sole.audience_size), 1, 'and the audience is exactly the one remaining human');

  stage = 'M16: a zero-human inert ACTIVE World cannot commit at all';
  const inert = randomUUID();
  await q(`INSERT INTO ${WORLDS}(id, lifecycle, phase, birth_basis, born_at)
           VALUES($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION', now() - interval '10 days')`, [inert]);
  await identity('postgres', f.inviter);
  await rejected(() => rows(TEXT_COMMIT_SQL, [randomUUID(), inert, randomUUID(), randomUUID(), 'into the void']),
    UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
  await identity('postgres');
  await rejected(() => commitQandeel(inert, 'an analysis for nobody'), UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);

  stage = 'M17: a READ_ONLY_CLOSED World cannot create new ordinary material';
  const closing = await provisionWorld(f.inviter, f.closedSecond, 'lifecycle-closed');
  const beforeClosure = await commitText(closing.worldId, f.inviter, 'said while the World was open');
  await closeWorld(closing.worldId, [f.inviter, f.closedSecond]);
  await identity('postgres', f.inviter);
  await rejected(() => rows(TEXT_COMMIT_SQL, [randomUUID(), closing.worldId, randomUUID(), randomUUID(), 'said after closure']),
    UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
  await identity('postgres');
  await rejected(() => commitQandeel(closing.worldId, 'analysis after closure'), UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
  return { world, inert, closing, beforeClosure };
}

async function verifyDeletion(f, lifecycle) {
  stage = 'D01 / D06 / D08 / D09: a current owner deletes their own human text, physically';
  const world = await provisionWorld(f.inviter, f.second, 'deletion');
  const mine = await commitText(world.worldId, f.inviter, 'something I will withdraw');
  const spoken = await commitVoice(world.worldId, f.inviter, 'media-object-delete-1', 'a transcript that also goes', 900);
  const deleted = await deleteOwn(world.worldId, f.inviter, mine.committed_material_id);
  assert.equal(deleted.outcome, 'MATERIAL_DELETED');
  assert.equal(Number(deleted.invalidated_targets), 0, 'nothing depended on it');
  const [after] = await rows(
    `SELECT (SELECT count(*) FROM ${TEXT_BODIES} WHERE material_id = $1) bodies,
            (SELECT count(*) FROM ${MATERIALS} WHERE id = $1) envelope,
            (SELECT count(*) FROM ${DEPENDENCIES} WHERE target_material_id = $1) provenance,
            (SELECT count(*) FROM ${DELETED_EVENTS} WHERE material_id = $1) events,
            (SELECT count(*) FROM ${DELETE_COMMANDS} WHERE material_id = $1) commands,
            (SELECT availability_state FROM ${ITEMS} WHERE id = $2) state`,
    [mine.committed_material_id, mine.committed_history_item_id]);
  assert.equal(Number(after.bodies), 0, 'D06 the text body is physically absent');
  assert.equal(Number(after.envelope), 1, 'D16 the envelope survives as non-content history');
  assert.equal(Number(after.provenance), 1, 'D16 and so does its provenance identity');
  assert.equal(Number(after.events), 1, 'D09 exactly one MATERIAL_DELETED fact');
  assert.equal(Number(after.commands), 1, 'D09 and exactly one durable delete command');
  assert.equal(after.state, 'DELETED_BY_OWNER', 'D08 the history state is terminal');

  stage = 'D07: a voice note media reference and its stored transcript are physically absent after deletion';
  await deleteOwn(world.worldId, f.inviter, spoken.committed_material_id);
  const [{ n: voiceBodies }] = await rows(`SELECT count(*)::int n FROM ${VOICE_BODIES} WHERE material_id = $1`,
    [spoken.committed_material_id]);
  assert.equal(voiceBodies, 0, 'the playable media reference and the transcript go with the row');

  stage = 'D08: owner deletion is terminal - no later revision resurrects or relabels it';
  await rejected(() => q(
    `UPDATE ${ITEMS} SET availability_state = 'AVAILABLE', availability_revision = availability_revision + 1 WHERE id = $1`,
    [mine.committed_history_item_id]), CONTRADICTORY, /SHARED_WORLD_HISTORY_OWNER_DELETION_TERMINAL/u);
  await rejected(() => q(
    `UPDATE ${ITEMS} SET availability_state = 'UNAVAILABLE', availability_revision = availability_revision + 1 WHERE id = $1`,
    [mine.committed_history_item_id]), CONTRADICTORY, /SHARED_WORLD_HISTORY_OWNER_DELETION_TERMINAL/u);

  stage = 'D04 / D05: another human cannot delete it, and membership cannot delete QANDEEL material';
  const theirs = await commitText(world.worldId, f.second, 'something only they may withdraw');
  const machine = await commitQandeel(world.worldId, 'an analysis nobody owns');
  await identity('postgres', f.inviter);
  await rejected(() => rows(DELETE_SQL, [randomUUID(), world.worldId, theirs.committed_material_id, randomUUID()]),
    UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
  await rejected(() => rows(DELETE_SQL, [randomUUID(), world.worldId, machine.committed_material_id, randomUUID()]),
    UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
  await identity('postgres');
  const [{ n: stillThere }] = await rows(`SELECT count(*)::int n FROM ${TEXT_BODIES} WHERE material_id = ANY($1::uuid[])`,
    [[theirs.committed_material_id, machine.committed_material_id]]);
  assert.equal(stillThere, 2, 'neither body was touched');

  stage = 'D10: an identical retry is stable, and a competing identity cannot double-delete';
  const command = randomUUID();
  const event = randomUUID();
  const first = await deleteOwn(world.worldId, f.second, theirs.committed_material_id, command, event);
  const again = await deleteOwn(world.worldId, f.second, theirs.committed_material_id, command, event);
  assert.deepEqual(again, first, 'an equivalent retry returns the committed result');
  await identity('postgres', f.second);
  await rejected(() => rows(DELETE_SQL, [randomUUID(), world.worldId, theirs.committed_material_id, randomUUID()]),
    UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
  await identity('postgres');

  stage = 'D14 / D15: transitive MATERIAL_DEPENDENCY targets become UNAVAILABLE and analytical ones survive';
  const chain = await provisionWorld(f.inviter, f.chainSecond, 'deletion-chain');
  const source = await commitText(chain.worldId, f.inviter, 'the original statement');
  const direct = await commitQandeel(chain.worldId, 'a summary that reproduces the original',
    { sources: [source.committed_material_id] });
  const transitive = await commitQandeel(chain.worldId, 'a summary of the summary',
    { sources: [direct.committed_material_id] });
  const analytical = await commitQandeel(chain.worldId, 'a conclusion drawn from private reasoning',
    { reasoning: ['ctx:personal:cc33'] });
  const chainDelete = await deleteOwn(chain.worldId, f.inviter, source.committed_material_id);
  assert.equal(Number(chainDelete.invalidated_targets), 2, 'both the direct and the transitive derivative are invalidated');
  const states = Object.fromEntries((await rows(
    `SELECT m.id, i.availability_state s FROM ${MATERIALS} m JOIN ${ITEMS} i ON i.id = m.history_item_id
      WHERE m.id = ANY($1::uuid[])`,
    [[source.committed_material_id, direct.committed_material_id, transitive.committed_material_id, analytical.committed_material_id]]))
    .map((row) => [row.id, row.s]));
  assert.equal(states[source.committed_material_id], 'DELETED_BY_OWNER');
  assert.equal(states[direct.committed_material_id], 'UNAVAILABLE',
    'a source-content-bearing derivative is UNAVAILABLE, and never claims its own owner deleted it');
  assert.equal(states[transitive.committed_material_id], 'UNAVAILABLE', 'transitively, too');
  assert.equal(states[analytical.committed_material_id], 'AVAILABLE',
    'D15 an analytical derivative is not erased merely because an unrelated source disappeared');
  const [{ n: chainBodies }] = await rows(`SELECT count(*)::int n FROM ${TEXT_BODIES} WHERE material_id = ANY($1::uuid[])`,
    [[direct.committed_material_id, transitive.committed_material_id]]);
  assert.equal(chainBodies, 0, 'and their bodies are physically gone too');
  const [{ n: edges }] = await rows(`SELECT count(*)::int n FROM ${DEPENDENCIES} WHERE source_material_id = $1`,
    [source.committed_material_id]);
  assert.equal(edges, 1, 'D16 the dependency identity that recorded the relationship is never erased');
  // And a dependent commit can no longer name the deleted source.
  await rejected(() => commitQandeel(chain.worldId, 'a late summary of a deleted original',
    { sources: [source.committed_material_id] }), STALE, /SHARED_WORLD_MATERIAL_STALE/u);

  stage = 'D02: a former member deletes their own material without regaining any browsing';
  const departed = await provisionWorld(f.inviter, f.departed, 'deletion-departed');
  const theirMaterial = await commitText(departed.worldId, f.departed, 'said before I left');
  await leaveAs(departed.worldId, f.departed);
  await identity('service_role');
  assert.deepEqual(await materialFor(departed.worldId, f.departed), [],
    'a former member browses nothing before deleting');
  await identity('postgres');
  const departedDelete = await deleteOwn(departed.worldId, f.departed, theirMaterial.committed_material_id);
  assert.equal(departedDelete.outcome, 'MATERIAL_DELETED');
  await identity('service_role');
  assert.deepEqual(await materialFor(departed.worldId, f.departed), [],
    'and browses nothing afterwards either: deleting restores no World access');
  await identity('postgres');
  const [{ n: departedEpisodes }] = await rows(
    `SELECT count(*)::int n FROM ${EPISODES} WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL`,
    [departed.worldId, f.departed]);
  assert.equal(departedEpisodes, 0, 'no membership episode was created or reopened');

  stage = 'D03 / D13: an owner deletes after closure, the entitlement audit survives, and lifecycle is untouched';
  const closed = lifecycle.closing;
  const [{ n: entitlementsBefore }] = await rows(`SELECT count(*)::int n FROM ${ENTITLEMENTS} WHERE world_id = $1`, [closed.worldId]);
  assert.ok(entitlementsBefore > 0, 'the closed World really carries entitlements');
  const closedDelete = await deleteOwn(closed.worldId, f.inviter, lifecycle.beforeClosure.committed_material_id);
  assert.equal(closedDelete.outcome, 'MATERIAL_DELETED', 'a privacy mutation is permitted on an archived World');
  const [{ lifecycle: lifecycleAfter }] = await rows(`SELECT lifecycle FROM ${WORLDS} WHERE id = $1`, [closed.worldId]);
  assert.equal(lifecycleAfter, 'READ_ONLY_CLOSED', 'and never reopens it');
  const [{ n: entitlementsAfter }] = await rows(`SELECT count(*)::int n FROM ${ENTITLEMENTS} WHERE world_id = $1`, [closed.worldId]);
  assert.equal(entitlementsAfter, entitlementsBefore, 'D13 the closed entitlement audit survives intact');
  await identity('service_role');
  assert.deepEqual(await materialFor(closed.worldId, f.inviter), [],
    'D11 and the closed resolver no longer returns the deleted source');
  await identity('postgres');

  stage = 'D12: a history grant audit survives a later owner deletion, and the resolver stops returning the source';
  const granted = await provisionWorld(f.inviter, f.grantSecond, 'deletion-grant');
  const older = await commitText(granted.worldId, f.inviter, 'said before the newcomer could see it');
  const manifest = randomUUID();
  await identity('postgres');
  const [prepared] = await rows(HISTORY_PREPARE_SQL, [manifest, granted.worldId, f.grantSecond, [older.committed_history_item_id]]);
  assert.equal(prepared.outcome, 'PREPARED');
  assert.equal(Number(prepared.prepared_required_approver_count), 1, 'the exact author is the derived required approver');
  const approved = await approvePackageAs(f.inviter, manifest);
  assert.equal(approved.outcome, 'APPROVED');
  await identity('postgres');
  const [grantCommitted] = await rows(HISTORY_GRANT_SQL, [randomUUID(), manifest, randomUUID(), randomUUID()]);
  assert.equal(grantCommitted.outcome, 'HISTORY_GRANTED');
  const [{ n: grantsBefore }] = await rows(`SELECT count(*)::int n FROM ${GRANTS} WHERE world_id = $1`, [granted.worldId]);
  await deleteOwn(granted.worldId, f.inviter, older.committed_material_id);
  const [{ n: grantsAfter }] = await rows(`SELECT count(*)::int n FROM ${GRANTS} WHERE world_id = $1`, [granted.worldId]);
  assert.equal(grantsAfter, grantsBefore, 'the grant and its command history remain');
  await identity('service_role');
  assert.equal((await visibleFor(granted.worldId, f.grantSecond)).includes(older.committed_history_item_id), false,
    'but no entitlement can preserve deleted source: the frozen resolver stops returning it');
  assert.deepEqual(await materialFor(granted.worldId, f.grantSecond), [],
    'and neither does the material resolver');
  await identity('postgres');

  stage = 'D11: the ordinary resolver never returns deleted content to a current member either';
  await identity('service_role');
  const remaining = (await materialFor(world.worldId, f.second)).map((row) => row.material_id);
  assert.equal(remaining.includes(mine.committed_material_id), false);
  assert.equal(remaining.includes(theirs.committed_material_id), false);
  assert.equal(remaining.includes(machine.committed_material_id), true, 'while undeleted material is unaffected');
  await identity('postgres');
  return { world, chain, granted, departed };
}

async function verifyQandeelBoundary(f) {
  stage = 'Q01: QANDEEL never becomes a human authority or ownership principal';
  const [{ n: authored }] = await rows(
    `SELECT count(*)::int n FROM ${MATERIALS} WHERE producer_kind = 'QANDEEL' AND author_user_id IS NOT NULL`);
  assert.equal(authored, 0, 'no QANDEEL material carries a human author');
  // And every approver QANDEEL material requires was PROPAGATED from a human
  // material source, never manufactured: an approver with no source that names
  // them would be QANDEEL creating human consent out of nothing.
  const [{ n: manufactured }] = await rows(
    `SELECT count(*)::int n FROM ${ITEM_APPROVERS} ra
       JOIN ${MATERIALS} m ON m.history_item_id = ra.history_item_id
      WHERE m.producer_kind = 'QANDEEL'
        AND NOT EXISTS (
          SELECT 1 FROM ${DEPENDENCIES} d
            JOIN ${MATERIALS} src ON src.id = d.source_material_id
            JOIN ${ITEM_APPROVERS} sra ON sra.history_item_id = src.history_item_id
           WHERE d.target_material_id = m.id AND d.dependency_kind = 'MATERIAL_DEPENDENCY'
             AND sra.approver_user_id = ra.approver_user_id)`);
  assert.equal(manufactured, 0,
    'every human authority QANDEEL material requires was propagated from a MATERIAL_DEPENDENCY source');

  stage = 'Q02: the bound I-03 readiness is recorded as readiness, never as Safety or Launch clearance';
  const states = (await rows(`SELECT DISTINCT readiness_state s FROM ${EVIDENCE}`)).map((row) => row.s);
  assert.deepEqual(states, ['READY_FOR_LATER_DELIVERY_GATES'],
    'the only state this slice records is the exact frozen I-03G state');
  const columns = (await rows(
    `SELECT column_name c FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'shared_world_qandeel_material_evidence'
        AND column_name ~* '(safety|launch|clearance|approved|allowed|permission|entitlement|moderation)'`))
    .map((row) => row.c);
  assert.deepEqual(columns, [], 'and no column in the evidence relation claims otherwise');

  stage = 'Q03: no application role can execute the QANDEEL commit core';
  for (const role of APPLICATION_ROLES) {
    await identity(role, f.inviter);
    await rejected(() => rows(QANDEEL_COMMIT_SQL, [randomUUID(), randomUUID(), randomUUID(), randomUUID(),
      'QANDEEL_OUTPUT', 'x', 'ec', digestOutput('x'), 'gate', 'rev', 'readiness', 'aud', [], []]),
    INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');

  stage = 'Q04: stale World state refuses a QANDEEL commit';
  const stale = await provisionWorld(f.inviter, f.staleSecond, 'qandeel-stale');
  await closeWorld(stale.worldId, [f.inviter, f.staleSecond]);
  await rejected(() => commitQandeel(stale.worldId, 'analysis for a World that has ended'),
    UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
}

/**
 * The Independent Review FIX-01 corrections, proven against real PostgreSQL.
 *
 * FIX-A stale audience evidence, FIX-B cross-World evidence reuse, FIX-C whole-request
 * durable idempotency, FIX-D unresolved historical-sharing authority.
 */
async function verifyReviewFixes(f) {
  const world = await provisionWorld(f.inviter, f.fixSecond, 'review-fix');

  stage = 'FIX-A: a valid CURRENT audience snapshot is accepted, and a fabricated one is refused';
  const validRef = await currentAudienceSnapshotRef(world.worldId);
  const accepted = await commitQandeel(world.worldId, 'an analysis for the exact current audience');
  assert.equal(accepted.outcome, 'MATERIAL_COMMITTED');
  assert.equal(accepted.evidence.audienceSnapshotRef, validRef, 'the fixture used the real canonical fingerprint');
  const fabricatedBody = 'an analysis carrying a fabricated audience snapshot';
  await rejected(() => commitQandeel(world.worldId, fabricatedBody, {
    evidence: evidenceFor(fabricatedBody, 'fabricated', `sha256:${'f'.repeat(64)}`),
  }), STALE, /SHARED_WORLD_MATERIAL_STALE/u);

  stage = 'FIX-A: the validated snapshot IS the baseline audience - there is one audience meaning';
  const viewers = (await rows(`SELECT user_id FROM ${BASELINE} WHERE history_item_id = $1 ORDER BY user_id`,
    [accepted.committed_history_item_id])).map((row) => row.user_id);
  const snapshotMembers = (await rows(
    'SELECT user_id FROM public.resolve_shared_world_human_audience_snapshot_v1($1) ORDER BY user_id',
    [world.worldId])).map((row) => row.user_id);
  assert.deepEqual(viewers, snapshotMembers,
    'the baseline viewers are exactly the audience the validated snapshot described');

  stage = 'FIX-A: a leave AFTER generation stales the snapshot';
  const staleAfterLeave = evidenceFor('an analysis generated before the leave', 'pre-leave',
    await currentAudienceSnapshotRef(world.worldId));
  await leaveAs(world.worldId, f.fixSecond);
  await rejected(() => commitQandeel(world.worldId, 'an analysis generated before the leave',
    { evidence: staleAfterLeave }), STALE, /SHARED_WORLD_MATERIAL_STALE/u);

  stage = 'FIX-A: a leave then the SAME human rejoining stales it too - the human set is not the identity';
  const rejoinProposal = randomUUID();
  await identity('postgres');
  const [rejoinPrepared] = await rows(REJOIN_PREPARE_SQL,
    [rejoinProposal, randomUUID(), randomUUID(), world.worldId, f.fixSecond]);
  assert.equal(rejoinPrepared.outcome, 'PREPARED');
  await approveWith(rejoinProposal, [f.inviter]);
  // ONLY the exact former human may commit their own rejoin, so the actor is
  // established here rather than inherited from the approval that preceded it.
  const rejoined = await rejoinAs(f.fixSecond, rejoinProposal);
  assert.equal(rejoined.outcome, 'REJOINED');
  assert.equal(rejoined.rejoined_world_id, world.worldId, 'the exact World reopened for the exact human');
  const [reopened] = await rows(
    `SELECT user_id FROM ${EPISODES} WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL`,
    [world.worldId, f.fixSecond]);
  assert.ok(reopened, 'and the new open membership episode belongs to the human who committed the rejoin');
  const afterRejoinRef = await currentAudienceSnapshotRef(world.worldId);
  const rejoinMembers = (await rows(
    'SELECT user_id FROM public.resolve_shared_world_human_audience_snapshot_v1($1) ORDER BY user_id',
    [world.worldId])).map((row) => row.user_id);
  assert.deepEqual(rejoinMembers.sort(), [f.inviter, f.fixSecond].sort(),
    'the HUMAN set is exactly what it was before the leave');
  assert.notEqual(afterRejoinRef, validRef,
    'yet the snapshot reference differs, because the membership EPISODE is new');
  await rejected(() => commitQandeel(world.worldId, 'an analysis generated before the rejoin', {
    evidence: evidenceFor('an analysis generated before the rejoin', 'pre-rejoin', validRef),
  }), STALE, /SHARED_WORLD_MATERIAL_STALE/u);
  // And the CURRENT snapshot is accepted, so this is a freshness rule and not a ban.
  const afterRejoin = await commitQandeel(world.worldId, 'an analysis generated after the rejoin');
  assert.equal(afterRejoin.outcome, 'MATERIAL_COMMITTED');

  stage = 'FIX-A: a governed removal stales the snapshot as well';
  const removedWorld = await provisionWorld(f.inviter, f.fixRemoved, 'review-fix-remove');
  const beforeRemoval = evidenceFor('an analysis generated before the removal', 'pre-remove',
    await currentAudienceSnapshotRef(removedWorld.worldId));
  const removeProposal = randomUUID();
  await identity('postgres');
  const [removePrepared] = await rows(REMOVE_PREPARE_SQL,
    [removeProposal, randomUUID(), randomUUID(), removedWorld.worldId, f.fixRemoved]);
  assert.equal(removePrepared.outcome, 'PREPARED');
  await approveWith(removeProposal, [f.inviter]);
  const removed = await removeMemberBy(removeProposal);
  assert.equal(removed.outcome, 'REMOVED');
  await rejected(() => commitQandeel(removedWorld.worldId, 'an analysis generated before the removal',
    { evidence: beforeRemoval }), STALE, /SHARED_WORLD_MATERIAL_STALE/u);

  stage = 'FIX-B: evidence valid for World A cannot commit into World B, identical bytes and all';
  const worldA = await provisionWorld(f.inviter, f.fixCrossA, 'review-fix-cross-a');
  const worldB = await provisionWorld(f.inviter, f.fixCrossB, 'review-fix-cross-b');
  const sharedBody = 'the very same analysis body, byte for byte';
  const evidenceForA = evidenceFor(sharedBody, 'cross', await currentAudienceSnapshotRef(worldA.worldId));
  const inA = await commitQandeel(worldA.worldId, sharedBody, { evidence: evidenceForA });
  assert.equal(inA.outcome, 'MATERIAL_COMMITTED', 'it is genuinely valid evidence, in its own World');
  // World B is a perfectly healthy ACTIVE World with its own valid audience, and
  // the bytes are identical - so the ONLY thing refusing this is the binding.
  await rejected(() => commitQandeel(worldB.worldId, sharedBody, { evidence: evidenceForA }),
    STALE, /SHARED_WORLD_MATERIAL_STALE/u);
  // And World B commits the same bytes perfectly well under its OWN evidence, so
  // the refusal above is about the binding and not about the body.
  const inB = await commitQandeel(worldB.worldId, sharedBody);
  assert.equal(inB.outcome, 'MATERIAL_COMMITTED');

  stage = 'FIX-C1: an exact voice retry succeeds, and a changed duration is a conflict';
  const voiceWorld = await provisionWorld(f.inviter, f.fixVoice, 'review-fix-voice');
  const voiceCommand = randomUUID();
  const voiceMaterial = randomUUID();
  const voiceItem = randomUUID();
  await identity('postgres', f.inviter);
  const [voiceFirst] = await rows(VOICE_COMMIT_SQL,
    [voiceCommand, voiceWorld.worldId, voiceMaterial, voiceItem, 'media-object-review', 'a transcript', 1200]);
  assert.equal(voiceFirst.outcome, 'MATERIAL_COMMITTED');
  const [voiceRetry] = await rows(VOICE_COMMIT_SQL,
    [voiceCommand, voiceWorld.worldId, voiceMaterial, voiceItem, 'media-object-review', 'a transcript', 1200]);
  assert.deepEqual(voiceRetry, voiceFirst, 'an exact retry is historically stable');
  // The SAME command, material, history item, media reference and transcript - and
  // a different duration. That is a different request, not a retry.
  await rejected(() => rows(VOICE_COMMIT_SQL,
    [voiceCommand, voiceWorld.worldId, voiceMaterial, voiceItem, 'media-object-review', 'a transcript', 1201]),
  CONFLICT, /SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT/u);
  // Presence is distinguished from value: dropping the duration entirely is also a conflict.
  await rejected(() => rows(VOICE_COMMIT_SQL,
    [voiceCommand, voiceWorld.worldId, voiceMaterial, voiceItem, 'media-object-review', 'a transcript', null]),
  CONFLICT, /SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT/u);
  await identity('postgres');

  stage = 'FIX-C2: a QANDEEL retry binds the exact evidence and both exact dependency sets';
  const retryWorld = await provisionWorld(f.inviter, f.fixRetry, 'review-fix-retry');
  const anchor = await commitText(retryWorld.worldId, f.inviter, 'a statement the analysis will reproduce');
  const second = await commitText(retryWorld.worldId, f.inviter, 'a second statement');
  const retryBody = 'an analysis whose whole request is its identity';
  const retryEvidence = evidenceFor(retryBody, 'retry', await currentAudienceSnapshotRef(retryWorld.worldId));
  const retryIds = { commandId: randomUUID(), materialId: randomUUID(), itemId: randomUUID() };
  const base = {
    ...retryIds, evidence: retryEvidence,
    sources: [anchor.committed_material_id], reasoning: ['ctx:personal:1111', 'ctx:personal:2222'],
  };
  const firstCommit = await commitQandeel(retryWorld.worldId, retryBody, base);
  assert.equal(firstCommit.outcome, 'MATERIAL_COMMITTED');
  const exactRetry = await commitQandeel(retryWorld.worldId, retryBody, base);
  assert.equal(exactRetry.outcome, 'MATERIAL_COMMITTED', 'an exact retry is still equivalent');
  assert.equal(Number(exactRetry.material_dependency_edges), 1, 'and reports COMMITTED dependency counts');
  assert.equal(Number(exactRetry.reasoning_dependency_edges), 2);
  assert.equal(Number(exactRetry.authority_size), 1);
  // Set ORDER is not identity: the same reasoning set, reversed, is the same request.
  const reordered = await commitQandeel(retryWorld.worldId, retryBody,
    { ...base, reasoning: ['ctx:personal:2222', 'ctx:personal:1111'] });
  assert.deepEqual(reordered, exactRetry, 'canonical ordering makes set order irrelevant to identity');
  // Set CONTENT is identity.
  for (const [reason, changed] of [
    ['a changed MATERIAL_DEPENDENCY source set', { ...base, sources: [second.committed_material_id] }],
    ['an added MATERIAL_DEPENDENCY source', { ...base, sources: [anchor.committed_material_id, second.committed_material_id] }],
    ['a changed REASONING_DEPENDENCY reference set', { ...base, reasoning: ['ctx:personal:3333', 'ctx:personal:2222'] }],
    ['a dropped REASONING_DEPENDENCY reference', { ...base, reasoning: ['ctx:personal:1111'] }],
    ['a changed effective context reference', { ...base, evidence: evidenceFor(retryBody, 'retry-ec', retryEvidence.audienceSnapshotRef) }],
  ]) {
    const error = await rejected(() => commitQandeel(retryWorld.worldId, retryBody, changed), CONFLICT);
    assert.match(error.message, /SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT/u,
      `${reason} must be a bounded command conflict, never a silent equivalence`);
  }
  // A changed BODY is a conflict too, and is caught before the command identity
  // even matters, because the evidence no longer binds these bytes.
  await rejected(() => commitQandeel(retryWorld.worldId, 'an entirely different analysis body', base),
    INVALID_PARAMETER, /SHARED_WORLD_MATERIAL_EVIDENCE_INVALID/u);

  stage = 'FIX-C: a retry after a legitimate owner deletion is still historically stable';
  await deleteOwn(retryWorld.worldId, f.inviter, anchor.committed_material_id);
  const afterDeletion = await commitQandeel(retryWorld.worldId, retryBody, base);
  assert.deepEqual(afterDeletion, exactRetry,
    'the committed answer does not change because a source was later withdrawn');

  // QAN-CW-REM-01 RECONCILES THIS BLOCK FORWARD, and the reason is worth stating
  // where it is read rather than only in the task that made the change.
  //
  // I-04G asserted here that a zero-dependency QANDEEL commit was a "truly known
  // zero human requirement": RESOLVED_NO_HUMAN_REQUIREMENT, approval-free, and
  // packageable. The phase-wide architecture assurance accepted ASSURE-F02
  // against exactly that: nothing in the commit established anything about
  // protected humans, so the absence of a caller-supplied dependency array was
  // being read as proof about them. Migration 0119 corrects the arm, and the old
  // expectation cannot survive it.
  //
  // It is reconciled rather than deleted, because this is still the only place
  // the whole zero-dependency path is exercised against the real boundary, and
  // the three things it always proved all still matter: the material commits,
  // its exact baseline audience is unaffected, and the widening decision is
  // really taken - now in the other direction.
  stage = 'FIX-D: a zero-dependency QANDEEL commit is UNRESOLVED, and cannot be shared historically';
  const authorityWorld = await provisionWorld(f.inviter, f.fixAuthority, 'review-fix-authority');
  const independent = await commitQandeel(authorityWorld.worldId, 'an independently established analysis');
  assert.equal(independent.outcome, 'MATERIAL_COMMITTED',
    'a zero-dependency analysis still commits: the correction narrows WIDENING, not participation');
  const [{ resolution: independentState }] = await rows(
    `SELECT resolution_state resolution FROM ${AUTHORITY} WHERE material_id = $1`, [independent.committed_material_id]);
  assert.equal(independentState, 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
    'absence of known authority evidence is not a resolved-empty authority set');
  const [{ mode: independentMode }] = await rows(
    `SELECT authority_requirement_mode mode FROM ${ITEMS} WHERE id = $1`, [independent.committed_history_item_id]);
  assert.equal(independentMode, 'EXACT_HUMAN_APPROVER_SET',
    'so it is never written as approval-free, and the frozen I-04F package path can never read it as one');
  await identity('postgres');
  await rejected(() => rows(HISTORY_PREPARE_SQL,
    [randomUUID(), authorityWorld.worldId, f.fixAuthority, [independent.committed_history_item_id]]),
  INCOMPLETE, /SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED/u);

  stage = 'FIX-D: reasoning-dependent material is UNRESOLVED and cannot be historically widened';
  const reasoningMaterial = await commitQandeel(authorityWorld.worldId, 'an analysis shaped by private reasoning',
    { reasoning: ['ctx:personal:dddd'] });
  const [{ resolution: reasoningState }] = await rows(
    `SELECT resolution_state resolution FROM ${AUTHORITY} WHERE material_id = $1`,
    [reasoningMaterial.committed_material_id]);
  assert.equal(reasoningState, 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT');
  const [{ mode: reasoningMode }] = await rows(
    `SELECT authority_requirement_mode mode FROM ${ITEMS} WHERE id = $1`,
    [reasoningMaterial.committed_history_item_id]);
  assert.equal(reasoningMode, 'EXACT_HUMAN_APPROVER_SET',
    'unresolved material is never written as approval-free');
  // TWO independent fail-closed paths cover this item, and the FROZEN one reaches
  // it first: I-04F already refuses an item claiming an exact approver set with no
  // enumerable approver, which is exactly what "the requirement exists and is not
  // resolvable" looks like in its vocabulary. That refusal is asserted as it
  // really is, rather than as the one this slice added.
  await rejected(() => rows(HISTORY_PREPARE_SQL,
    [randomUUID(), authorityWorld.worldId, f.fixAuthority, [reasoningMaterial.committed_history_item_id]]),
  CONTRADICTORY, /SHARED_WORLD_HISTORY_CONTRADICTORY_STATE/u);

  stage = 'FIX-D: known material owners alone do NOT resolve a mixed requirement';
  const owned = await commitText(authorityWorld.worldId, f.inviter, 'a statement the mixed analysis reproduces');
  const mixed = await commitQandeel(authorityWorld.worldId, 'an analysis with a known owner AND private reasoning',
    { sources: [owned.committed_material_id], reasoning: ['ctx:personal:eeee'] });
  const [{ resolution: mixedState }] = await rows(
    `SELECT resolution_state resolution FROM ${AUTHORITY} WHERE material_id = $1`, [mixed.committed_material_id]);
  assert.equal(mixedState, 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
    'a known owner does not resolve the whole requirement');
  assert.equal(Number(mixed.authority_size), 1, 'the known owner IS required - that part is resolved');
  // THIS is the case only the I-04G gate catches. The item is perfectly coherent
  // to the frozen I-04F rule - an exact approver set with one enumerable approver -
  // so the frozen fail-closed path lets it through, and it would have been
  // packageable the moment that known owner approved. Known owners alone do not
  // resolve the whole requirement, and preparation is refused before any approval
  // is even relevant.
  await rejected(() => rows(HISTORY_PREPARE_SQL,
    [randomUUID(), authorityWorld.worldId, f.fixAuthority, [mixed.committed_history_item_id]]),
  INCOMPLETE, /SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED/u);
  // And one unresolved item poisons a package it is merely PART of, rather than
  // being silently dropped from it. The other item is the human statement above,
  // whose authority really is resolved - so the refusal is unambiguously caused
  // by the ONE unresolved member rather than by every member being unresolved.
  await rejected(() => rows(HISTORY_PREPARE_SQL, [randomUUID(), authorityWorld.worldId, f.fixAuthority,
    [owned.committed_history_item_id, mixed.committed_history_item_id]]),
  INCOMPLETE, /SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED/u);
  // And that same resolved human item packages perfectly well on its own, which
  // is what proves the refusal above is about authority and not about the World.
  const lawful = randomUUID();
  const [lawfulPackage] = await rows(HISTORY_PREPARE_SQL,
    [lawful, authorityWorld.worldId, f.fixAuthority, [owned.committed_history_item_id]]);
  assert.equal(lawfulPackage.outcome, 'PREPARED', 'ordinary selective history is untouched');
  assert.equal(Number(lawfulPackage.prepared_required_approver_count), 1,
    'with the exact human owner required, exactly as I-04F derived it');

  stage = 'FIX-D: a reasoning dependency never becomes material consent';
  const reasoningApprovers = (await rows(
    `SELECT approver_user_id u FROM ${ITEM_APPROVERS} WHERE history_item_id = $1`,
    [reasoningMaterial.committed_history_item_id])).map((row) => row.u);
  assert.deepEqual(reasoningApprovers, [],
    'no reasoning grantor was turned into an approver: reasoning authority is not material consent');
  const mixedApprovers = (await rows(
    `SELECT approver_user_id u FROM ${ITEM_APPROVERS} WHERE history_item_id = $1`,
    [mixed.committed_history_item_id])).map((row) => row.u);
  assert.deepEqual(mixedApprovers, [f.inviter],
    'exactly the known MATERIAL_DEPENDENCY owner, and nobody the reasoning implicated');

  stage = 'FIX-D: current baseline-audience delivery of unresolved material is UNAFFECTED';
  await identity('service_role');
  const visible = (await materialFor(authorityWorld.worldId, f.fixAuthority)).map((row) => row.material_id);
  assert.ok(visible.includes(reasoningMaterial.committed_material_id),
    'the exact already-authorized baseline audience still sees reasoning-dependent material');
  assert.ok(visible.includes(mixed.committed_material_id));
  assert.ok(visible.includes(independent.committed_material_id),
    'and so does the zero-dependency material QAN-CW-REM-01 moved to unresolved: current delivery is untouched');
  await identity('postgres');

  stage = 'FIX-D: a later reviewed subject-authority resolution extends this additively';
  await q('SAVEPOINT later_resolution');
  try {
    await q(`UPDATE ${AUTHORITY} SET resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT' WHERE material_id = $1`,
      [mixed.committed_material_id]);
    const [nowPackaged] = await rows(HISTORY_PREPARE_SQL,
      [randomUUID(), authorityWorld.worldId, f.fixAuthority, [mixed.committed_history_item_id]]);
    assert.equal(nowPackaged.outcome, 'PREPARED',
      'resolving the requirement makes the same item packageable, with no source history rewritten');
  } finally {
    await q('ROLLBACK TO SAVEPOINT later_resolution');
    await q('RELEASE SAVEPOINT later_resolution');
  }
}

async function verifyNonRegression(f, worldIds) {
  stage = 'N02 / N03 / N04 / N05: no grant, Personal, Public, Replay, Matching or live-call state is created';
  const before = await sharedCounts(worldIds, f.humans);
  const world = await provisionWorld(f.inviter, f.regressionSecond, 'non-regression');
  const committed = await commitText(world.worldId, f.inviter, 'one ordinary statement');
  await commitQandeel(world.worldId, 'one ordinary analysis', { sources: [committed.committed_material_id] });
  await deleteOwn(world.worldId, f.inviter, committed.committed_material_id);
  const after = await sharedCounts([...worldIds, world.worldId], f.humans);
  const delta = deltaOf(before, after);
  assert.equal(delta.standingGrants, undefined, 'N02 no Standing Context Grant is created or mutated');
  assert.equal(delta.personalSessions, undefined, 'N03 no Personal session is touched');
  assert.equal(delta.personalTurns, undefined, 'N03 and no Personal turn is copied merely because it influenced reasoning');
  assert.equal(delta.grants, undefined, 'no history grant is manufactured');
  assert.equal(delta.entitlements, undefined, 'and no closed-World entitlement either');
  assert.ok((delta.materials ?? 0) > 0, 'while the material this scenario really committed is there');
}

// ---------------------------------------------------------------------------

async function verifyForwardSafety(f) {
  stage = 'forward safety: a FURTHER Introduction producer beyond 0118, a CW2-08 wrapper and Public and Replay consumers do not fail this verifier';
  await identity('postgres');
  const probe = `i04g_runtime_probe_${randomUUID().replace(/-/gu, '').slice(0, 12)}`;
  await q('SAVEPOINT forward_safety');
  try {
    await q(`CREATE FUNCTION public.${probe}_introduction_producer_v1(p_world_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    // CW2-08's Launch Gate and a launch-gated wrapper over the sealed core.
    await q(`CREATE TABLE public.${probe}_launch_gates (id uuid PRIMARY KEY, capability text NOT NULL, state text NOT NULL)`);
    await q(`CREATE FUNCTION public.${probe}_cw208_wrapper_v1(p_command_id uuid, p_world_id uuid,
               p_material_id uuid, p_history_item_id uuid, p_body_text text) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    await q(`GRANT EXECUTE ON FUNCTION public.${probe}_cw208_wrapper_v1(uuid, uuid, uuid, uuid, text) TO authenticated`);
    // Public and Replay consumers of committed material.
    await q(`CREATE TABLE public.${probe}_public_consumer (id uuid PRIMARY KEY, material_id uuid NOT NULL
             REFERENCES ${MATERIALS} (id) ON DELETE RESTRICT)`);
    await q(`CREATE TABLE public.${probe}_replay_consumer (id uuid PRIMARY KEY, material_id uuid NOT NULL
             REFERENCES ${MATERIALS} (id) ON DELETE RESTRICT)`);
    // The reviewed protected-human subject-authority resolver this slice fails
    // closed for. When it exists it RESOLVES rows additively; it does not rewrite
    // them, and it does not change the gate.
    await q(`CREATE FUNCTION public.${probe}_subject_authority_resolver_v1(p_material_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN
               UPDATE public.shared_world_material_historical_authority a
                  SET resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT'
                WHERE a.material_id = p_material_id;
             END$fn$`);
    await q(`ALTER TABLE ${AUTHORITY} ADD COLUMN ${probe}_resolver_ref text`);
    // Later additive command metadata, with names and types 0090 would never write.
    await q(`ALTER TABLE ${COMMIT_COMMANDS} ADD COLUMN ${probe}_command_metadata jsonb`);
    await q(`ALTER TABLE ${DELETED_EVENTS} ADD COLUMN ${probe}_delivery_epoch bigint`);
    await q(`ALTER TABLE ${EVIDENCE} ADD CONSTRAINT ${probe}_evidence_present_check CHECK (readiness_ref IS NOT NULL)`);
    await q(`CREATE INDEX ${probe}_commit_commands_time_idx ON ${COMMIT_COMMANDS} (committed_at)`);
    // A later reviewed AUDIT trigger on a table 0090 owns. Deliberately inert.
    await q(`CREATE FUNCTION public.${probe}_audit_fn() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN RETURN NULL; END$fn$`);
    await q(`CREATE TRIGGER ${probe}_commit_audit AFTER INSERT ON ${COMMIT_COMMANDS}
             FOR EACH ROW EXECUTE FUNCTION public.${probe}_audit_fn()`);
    await verifyCatalog();

    stage = 'forward safety: a whole commit and a whole owner deletion still work beside the authorized future';
    const world = await provisionWorld(f.inviter, f.forwardSecond, 'runtime-forward');
    const committed = await commitText(world.worldId, f.inviter, 'said beside the authorized future');
    assert.equal(committed.outcome, 'MATERIAL_COMMITTED');
    const analysis = await commitQandeel(world.worldId, 'analysed beside the authorized future',
      { sources: [committed.committed_material_id] });
    assert.equal(analysis.outcome, 'MATERIAL_COMMITTED');
    const deleted = await deleteOwn(world.worldId, f.inviter, committed.committed_material_id);
    assert.equal(deleted.outcome, 'MATERIAL_DELETED');
    assert.equal(Number(deleted.invalidated_targets), 1, 'and the derivative is still invalidated');

    stage = 'forward safety: a real regression to something 0090 OWNS is still refused';
    for (const [reason, plant, refuses] of [
      ['a material could carry two commit commands',
        `ALTER TABLE ${COMMIT_COMMANDS} DROP CONSTRAINT shared_world_material_commit_commands_material_key`,
        /shared_world_material_commit_commands_material_key/u],
      ['a commit command stops binding its material to its exact World',
        `ALTER TABLE ${COMMIT_COMMANDS} DROP CONSTRAINT shared_world_material_commit_commands_material_fk,
         ADD CONSTRAINT shared_world_material_commit_commands_material_fk
           FOREIGN KEY (material_id) REFERENCES ${MATERIALS} (id) ON DELETE RESTRICT`,
        /shared_world_material_commit_commands_material_fk/u],
      ['QANDEEL could be recorded as a human actor',
        `ALTER TABLE ${COMMIT_COMMANDS} DROP CONSTRAINT shared_world_material_commit_commands_producer_check`,
        /shared_world_material_commit_commands_producer_check/u],
      ['one I-03 readiness could commit many materials',
        `ALTER TABLE ${EVIDENCE} DROP CONSTRAINT shared_world_qandeel_material_evidence_readiness_key`,
        /shared_world_qandeel_material_evidence_readiness_key/u],
      ['the bound readiness state stops being the exact frozen I-03G state',
        `ALTER TABLE ${EVIDENCE} DROP CONSTRAINT shared_world_qandeel_material_evidence_state_check`,
        /shared_world_qandeel_material_evidence_state_check/u],
      ['a material could be deleted twice',
        `ALTER TABLE ${DELETE_COMMANDS} DROP CONSTRAINT shared_world_material_delete_commands_material_key`,
        /shared_world_material_delete_commands_material_key/u],
      ['the historical widening gate is removed',
        `DROP TRIGGER shared_world_material_historical_widening_gate ON public.shared_world_history_package_manifest_items`,
        /unresolved historical-sharing authority is refused where widening actually happens/u],
      ['the widening gate stops refusing the unresolved state',
        `CREATE OR REPLACE FUNCTION public.shared_world_material_historical_widening_gate_v1()
         RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
         BEGIN RETURN NEW; END$fn$`,
        /it refuses exactly the unresolved state and nothing else/u],
      ['the unresolved authority state stops being representable',
        `ALTER TABLE ${AUTHORITY} DROP CONSTRAINT shared_world_material_historical_authority_state_check`,
        /shared_world_material_historical_authority_state_check/u],
      ['a material could carry two historical authority resolutions',
        `ALTER TABLE ${AUTHORITY} DROP CONSTRAINT shared_world_material_historical_authority_pk CASCADE`,
        /shared_world_material_historical_authority_pk/u],
      ['the durable request identity is dropped',
        `ALTER TABLE ${COMMIT_COMMANDS} DROP COLUMN request_ref CASCADE`,
        /still carries every column migration 0090 owns/u],
      ['an owned column is dropped',
        `ALTER TABLE ${COMMIT_COMMANDS} DROP COLUMN body_digest CASCADE`,
        /still carries every column migration 0090 owns/u],
      ['an owned column becomes optional',
        `ALTER TABLE ${DELETE_COMMANDS} ALTER COLUMN actor_user_id DROP NOT NULL`,
        /still carries every column migration 0090 owns/u],
      ['a runtime relation becomes directly readable by an application role',
        `GRANT SELECT ON ${EVIDENCE} TO authenticated`,
        /authenticated must not hold SELECT/u],
      ['a commit primitive becomes executable by an application role',
        `GRANT EXECUTE ON FUNCTION ${TEXT_FN} TO authenticated`,
        /must not hold EXECUTE/u],
      ['the owner-deletion primitive becomes executable by service_role',
        `GRANT EXECUTE ON FUNCTION ${DELETE_FN} TO service_role`,
        /must not hold EXECUTE/u],
      ['the material resolver is taken away from service_role',
        `REVOKE ALL ON FUNCTION ${MATERIAL_RESOLVER} FROM service_role`,
        /service_role must still execute the ONE narrow material resolver/u],
      ['the QANDEEL commit core starts deriving a human principal',
        `CREATE OR REPLACE FUNCTION public.commit_shared_world_qandeel_material_v1(
           p_command_id uuid, p_world_id uuid, p_material_id uuid, p_history_item_id uuid,
           p_material_kind text, p_body_text text,
           p_effective_context_ref text, p_output_digest text, p_source_disclosure_gate_ref text,
           p_authority_revalidation_ref text, p_readiness_ref text, p_audience_snapshot_ref text,
           p_material_source_ids uuid[], p_reasoning_source_refs text[])
         RETURNS TABLE(outcome text, command_id uuid, material_world_id uuid, committed_material_id uuid,
                       committed_history_item_id uuid, committed_material_kind text,
                       audience_size integer, authority_size integer,
                       material_dependency_edges integer, reasoning_dependency_edges integer,
                       material_established_at timestamptz)
         LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
         DECLARE u uuid := auth.uid();
         BEGIN
           -- The World lock stays EXACTLY canonical on purpose: this plant must
           -- isolate the one invariant it is about - QANDEEL deriving a human -
           -- and an incidental lock-order violation would make the verifier raise
           -- a different message than the matcher below expects.
           IF u IS NULL THEN RETURN; END IF;
           PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
           RETURN;
         END$fn$`,
        /derives no human/u],
      ['a commit primitive starts deleting bodies',
        `CREATE OR REPLACE FUNCTION public.commit_shared_world_human_text_v1(
           p_command_id uuid, p_world_id uuid, p_material_id uuid, p_history_item_id uuid, p_body_text text)
         RETURNS TABLE(outcome text, command_id uuid, material_world_id uuid, committed_material_id uuid,
                       committed_history_item_id uuid, committed_material_kind text,
                       audience_size integer, material_established_at timestamptz)
         LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
         BEGIN
           DELETE FROM public.shared_world_text_material_bodies WHERE material_id = p_material_id;
           RETURN;
         END$fn$`,
        /deletes nothing: committing destroys nothing/u],
      // RECONCILED BY I-07D. The two plants below weaken the Introduction branch
      // migration 0118 added, which is the branch this file is now responsible
      // for policing: 0090 owns the commit cores, so a later slice relaxing the
      // envelope they enforce has to be refused HERE, not only in its own
      // verifier. Each stub satisfies every OTHER invariant in this catalog -
      // auth.uid(), the World-row-first lock, no clock, no deletion, no World or
      // episode mutation - so the assertion that fires is the one under test and
      // not an incidental one.
      ['the Introduction branch stops requiring a LIVE Introduction Record',
        `CREATE OR REPLACE FUNCTION public.commit_shared_world_human_material_v1(
           p_command_id uuid, p_world_id uuid, p_material_id uuid, p_history_item_id uuid,
           p_material_kind text, p_body_text text, p_audio_object_ref text,
           p_transcript_text text, p_duration_ms integer)
         RETURNS TABLE(outcome text, command_id uuid, material_world_id uuid, committed_material_id uuid,
                       committed_history_item_id uuid, committed_material_kind text,
                       audience_size integer, material_established_at timestamptz)
         LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
         DECLARE u uuid := auth.uid(); world public.shared_worlds; audience uuid[];
         BEGIN
           IF u IS NULL THEN RETURN; END IF;
           SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
           IF world.lifecycle <> 'ACTIVE' THEN
             RETURN;
           ELSIF world.phase = 'INTRODUCTION' THEN
             NULL;
           ELSIF world.phase <> 'STANDARD' THEN
             RETURN;
           END IF;
           SELECT array_agg(a.user_id) INTO audience
             FROM public.resolve_shared_world_human_audience_snapshot_v1(p_world_id) a;
           IF world.phase = 'INTRODUCTION' AND array_length(audience, 1) <> 2 THEN RETURN; END IF;
           RETURN;
         END$fn$`,
        /only while its exact Record is still ACTIVE/u],
      ['the Introduction branch stops requiring exactly the two matched humans',
        `CREATE OR REPLACE FUNCTION public.commit_shared_world_human_material_v1(
           p_command_id uuid, p_world_id uuid, p_material_id uuid, p_history_item_id uuid,
           p_material_kind text, p_body_text text, p_audio_object_ref text,
           p_transcript_text text, p_duration_ms integer)
         RETURNS TABLE(outcome text, command_id uuid, material_world_id uuid, committed_material_id uuid,
                       committed_history_item_id uuid, committed_material_kind text,
                       audience_size integer, material_established_at timestamptz)
         LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
         DECLARE u uuid := auth.uid(); world public.shared_worlds; audience uuid[];
         BEGIN
           IF u IS NULL THEN RETURN; END IF;
           SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
           IF world.lifecycle <> 'ACTIVE' THEN
             RETURN;
           ELSIF world.phase = 'INTRODUCTION' THEN
             IF NOT EXISTS (
               SELECT 1 FROM public.introduction_records r
                WHERE r.world_id = p_world_id AND r.introduction_status = 'ACTIVE'
             ) THEN
               RETURN;
             END IF;
           ELSIF world.phase <> 'STANDARD' THEN
             RETURN;
           END IF;
           SELECT array_agg(a.user_id) INTO audience
             FROM public.resolve_shared_world_human_audience_snapshot_v1(p_world_id) a;
           RETURN;
         END$fn$`,
        /not exactly the two matched humans/u],
      ['a commit core stops locking the World row first, so nothing serializes it against a terminal transition',
        `CREATE OR REPLACE FUNCTION public.commit_shared_world_human_material_v1(
           p_command_id uuid, p_world_id uuid, p_material_id uuid, p_history_item_id uuid,
           p_material_kind text, p_body_text text, p_audio_object_ref text,
           p_transcript_text text, p_duration_ms integer)
         RETURNS TABLE(outcome text, command_id uuid, material_world_id uuid, committed_material_id uuid,
                       committed_history_item_id uuid, committed_material_kind text,
                       audience_size integer, material_established_at timestamptz)
         LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
         DECLARE u uuid := auth.uid(); world public.shared_worlds; audience uuid[];
         BEGIN
           IF u IS NULL THEN RETURN; END IF;
           -- Every gate is present and correct. Only the LOCK is gone, which is
           -- exactly what would let a commit and a terminal transition both
           -- believe they were first.
           SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id;
           IF world.lifecycle <> 'ACTIVE' THEN
             RETURN;
           ELSIF world.phase = 'INTRODUCTION' THEN
             IF NOT EXISTS (
               SELECT 1 FROM public.introduction_records r
                WHERE r.world_id = p_world_id AND r.introduction_status = 'ACTIVE'
             ) THEN
               RETURN;
             END IF;
           ELSIF world.phase <> 'STANDARD' THEN
             RETURN;
           END IF;
           SELECT array_agg(a.user_id) INTO audience
             FROM public.resolve_shared_world_human_audience_snapshot_v1(p_world_id) a;
           IF world.phase = 'INTRODUCTION' AND array_length(audience, 1) <> 2 THEN RETURN; END IF;
           RETURN;
         END$fn$`,
        /still locks the exact World row FIRST/u],
      ['owner deletion starts reopening the World lifecycle',
        `CREATE OR REPLACE FUNCTION public.delete_shared_world_owned_material_v1(
           p_command_id uuid, p_world_id uuid, p_material_id uuid, p_material_deleted_event_id uuid)
         RETURNS TABLE(outcome text, command_id uuid, deleted_world_id uuid, deleted_material_id uuid,
                       deleted_history_item_id uuid, deleted_event_id uuid,
                       invalidated_targets integer, deleted_at timestamptz)
         LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
         BEGIN
           UPDATE public.shared_worlds SET lifecycle = 'ACTIVE' WHERE id = p_world_id;
           RETURN;
         END$fn$`,
        /creates, closes and mutates no Shared World/u],
    ]) {
      stage = `forward safety: regression - ${reason}`;
      await q('SAVEPOINT forward_safety_regression');
      try {
        await q(plant);
        await assert.rejects(verifyCatalog(), refuses, `a database where ${reason} must still be refused`);
      } finally {
        await q('ROLLBACK TO SAVEPOINT forward_safety_regression');
        await q('RELEASE SAVEPOINT forward_safety_regression');
      }
    }
    stage = 'forward safety: every planted regression was reverted';
    await verifyCatalog();
  } finally {
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
    await identity('postgres');
  }
  stage = 'forward safety: the present-day catalog is unchanged';
  await verifyCatalog();
}

// ---------------------------------------------------------------------------
// Concurrency, with real independent connections.
// ---------------------------------------------------------------------------

async function openConnection(role, uid) {
  const conn = new Client({ connectionString: databaseUrl });
  await conn.connect();
  await conn.query('BEGIN');
  if (role !== 'postgres') await conn.query(`SET LOCAL ROLE ${role}`);
  await conn.query("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
  return conn;
}

async function verifyConcurrency(c) {
  /** Never throws: a rejected query becomes a describable outcome so it can be raced. */
  const outcome = (promise) => promise.then(
    (result) => ({ ok: true, rows: result.rows }),
    (error) => ({ ok: false, code: error?.code, message: error?.message }));

  stage = 'M18: a human material commit and a voluntary leave serialize World-first';
  {
    const committer = await openConnection('postgres', c.inviter);
    const leaver = await openConnection('postgres', c.raceSecond);
    try {
      // The leaver takes the World row first, then the committer blocks on it.
      await leaver.query(LEAVE_SQL, [randomUUID(), c.worlds.leaveFirst.worldId, randomUUID()]);
      const committing = committer.query(TEXT_COMMIT_SQL,
        [randomUUID(), c.worlds.leaveFirst.worldId, randomUUID(), randomUUID(), 'said as they were leaving']);
      await leaver.query('COMMIT');
      // It blocked on the World row rather than deadlocking, and proceeds now.
      const [committed] = (await committing).rows;
      assert.equal(committed.outcome, 'MATERIAL_COMMITTED');
      assert.equal(Number(committed.audience_size), 1,
        'and its baseline audience is the post-leave membership, never the stale one');
      await committer.query('COMMIT');
      // And it never carries the departed human as a baseline viewer.
      const [{ n }] = (await q(
        `SELECT count(*)::int n FROM ${BASELINE} b JOIN ${ITEMS} i ON i.id = b.history_item_id
          WHERE i.world_id = $1 AND b.user_id = $2 AND i.occurred_at > (
            SELECT ended_at FROM ${EPISODES} WHERE world_id = $1 AND user_id = $2 AND ended_at IS NOT NULL)`,
        [c.worlds.leaveFirst.worldId, c.raceSecond])).rows;
      assert.equal(n, 0, 'no material committed after the leave carries the departed human as an original viewer');
    } finally {
      await committer.query('ROLLBACK').catch(() => undefined);
      await leaver.query('ROLLBACK').catch(() => undefined);
      await committer.end().catch(() => undefined);
      await leaver.end().catch(() => undefined);
    }
  }

  stage = 'M19: a material commit and a GOVERNED removal serialize World-first';
  {
    const committer = await openConnection('postgres', c.inviter);
    const remover = await openConnection('postgres', c.inviter);
    try {
      // The governed removal takes the World row first; the commit blocks on it.
      // This is the add / remove / rejoin arm of the same canonical order M18
      // proves for a unilateral leave: every I-04E topology mutation locks
      // shared_worlds first, so material commit serializes against all of them
      // through one row rather than racing each one separately.
      await remover.query(REMOVE_COMMIT_SQL, [randomUUID(), c.worlds.removeFirst.proposal, randomUUID()]);
      const committing = committer.query(TEXT_COMMIT_SQL,
        [randomUUID(), c.worlds.removeFirst.worldId, randomUUID(), randomUUID(), 'said as they were removed']);
      await remover.query('COMMIT');
      const [committed] = (await committing).rows;
      assert.equal(committed.outcome, 'MATERIAL_COMMITTED');
      assert.equal(Number(committed.audience_size), 1,
        'the baseline audience is the post-removal membership, never the stale one');
      await committer.query('COMMIT');
      const viewers = (await q(`SELECT user_id FROM ${BASELINE} WHERE history_item_id = $1`,
        [committed.committed_history_item_id])).rows.map((row) => row.user_id);
      assert.deepEqual(viewers, [c.inviter], 'and the removed human is not one of its original viewers');
    } finally {
      await committer.query('ROLLBACK').catch(() => undefined);
      await remover.query('ROLLBACK').catch(() => undefined);
      await committer.end().catch(() => undefined);
      await remover.end().catch(() => undefined);
    }
  }

  stage = 'M20: a material commit and a World closure have exactly one truthful winner';
  {
    const committer = await openConnection('postgres', c.inviter);
    const closer = await openConnection('postgres', c.inviter);
    try {
      await committer.query(TEXT_COMMIT_SQL,
        [randomUUID(), c.worlds.closeFirst.worldId, randomUUID(), randomUUID(), 'said just before the end']);
      const closing = closer.query(END_COMMIT_SQL, [randomUUID(), c.worlds.closeFirst.proposal, randomUUID()]);
      await committer.query('COMMIT');
      // It blocked on the World row rather than deadlocking, and proceeds now.
      const [closed] = (await closing).rows;
      assert.equal(closed.outcome, 'WORLD_ENDED', 'the closure proceeds once the commit has committed');
      await closer.query('COMMIT');
      const [{ lifecycle }] = (await q(`SELECT lifecycle FROM ${WORLDS} WHERE id = $1`, [c.worlds.closeFirst.worldId])).rows;
      assert.equal(lifecycle, 'READ_ONLY_CLOSED', 'the World really closed');
      // And no further ordinary commit is possible. This runs outside the
      // verifier's own transaction, so the rejection is caught directly rather
      // than through a SAVEPOINT that would have no transaction to attach to.
      const late = await openConnection('postgres', c.inviter);
      try {
        let refusal;
        try {
          await late.query(TEXT_COMMIT_SQL,
            [randomUUID(), c.worlds.closeFirst.worldId, randomUUID(), randomUUID(), 'said after the end']);
        } catch (error) { refusal = error; }
        assert.ok(refusal, 'an ordinary commit into a closed World must be refused');
        assert.ok(UNAVAILABLE.includes(refusal.code),
          `and refused with the bounded unavailable class, got ${refusal.code}: ${refusal.message}`);
      } finally {
        await late.query('ROLLBACK').catch(() => undefined);
        await late.end().catch(() => undefined);
      }
    } finally {
      await committer.query('ROLLBACK').catch(() => undefined);
      await closer.query('ROLLBACK').catch(() => undefined);
      await committer.end().catch(() => undefined);
      await closer.end().catch(() => undefined);
    }
  }

  stage = 'D10 concurrency: two competing owner deletions produce exactly one deletion';
  {
    const first = await openConnection('postgres', c.inviter);
    const second = await openConnection('postgres', c.inviter);
    try {
      // Both are started together; whichever takes the World row first finishes,
      // and the other BLOCKS on that row until the winner's transaction ends. So
      // the winner is committed BEFORE the loser is awaited - awaiting both first
      // would wait forever for a query the winner's own open transaction is
      // holding up.
      const a = outcome(first.query(DELETE_SQL, [randomUUID(), c.worlds.twoDeletes.worldId, c.worlds.twoDeletes.materialId, randomUUID()]));
      const b = outcome(second.query(DELETE_SQL, [randomUUID(), c.worlds.twoDeletes.worldId, c.worlds.twoDeletes.materialId, randomUUID()]));
      const [label, winner] = await Promise.race([a.then((r) => ['a', r]), b.then((r) => ['b', r])]);
      assert.equal(winner.ok, true, `the unblocked owner deletion must commit, got ${winner.code}: ${winner.message}`);
      await (label === 'a' ? first : second).query('COMMIT');
      const loser = await (label === 'a' ? b : a);
      await (label === 'a' ? second : first).query('COMMIT').catch(() => undefined);
      assert.equal(loser.ok, false, 'exactly one owner deletion may commit: the second must be refused');
      assert.ok(['P0002', '23505', '40001'].includes(loser.code),
        `the loser is refused with a bounded class, got ${loser.code}: ${loser.message}`);
      const [{ n }] = (await q(`SELECT count(*)::int n FROM ${DELETED_EVENTS} WHERE material_id = $1`,
        [c.worlds.twoDeletes.materialId])).rows;
      assert.equal(n, 1, 'and exactly one MATERIAL_DELETED fact exists');
    } finally {
      await first.query('ROLLBACK').catch(() => undefined);
      await second.query('ROLLBACK').catch(() => undefined);
      await first.end().catch(() => undefined);
      await second.end().catch(() => undefined);
    }
  }
}

// ---------------------------------------------------------------------------

async function provisionHumans(humanIds) {
  await identity('postgres');
  await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [humanIds]);
}

async function removeFixtures(humans) {
  await identity('postgres');
  const worldIds = (await rows(
    `SELECT DISTINCT ep.world_id FROM ${EPISODES} ep WHERE ep.user_id = ANY($1::uuid[])`, [humans]))
    .map((row) => row.world_id);
  await q(`DELETE FROM ${DELETE_COMMANDS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${DELETED_EVENTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${COMMIT_COMMANDS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${AUTHORITY} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${EVIDENCE} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${DEPENDENCIES} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${TEXT_BODIES} WHERE material_id IN (SELECT id FROM ${MATERIALS} WHERE world_id = ANY($1::uuid[]))`, [worldIds]);
  await q(`DELETE FROM ${VOICE_BODIES} WHERE material_id IN (SELECT id FROM ${MATERIALS} WHERE world_id = ANY($1::uuid[]))`, [worldIds]);
  await q(`DELETE FROM ${MATERIALS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${END_COMMANDS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${ENDED_EVENTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${ENTITLEMENT_ITEMS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${ENTITLEMENTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${PAYLOADS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${GRANT_COMMANDS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${GRANTED_EVENTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${GRANTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${PACKAGE_APPROVALS} WHERE manifest_version_id IN (SELECT id FROM ${MANIFESTS} WHERE world_id = ANY($1::uuid[]))`, [worldIds]);
  await q(`DELETE FROM ${PACKAGE_APPROVERS} WHERE manifest_version_id IN (SELECT id FROM ${MANIFESTS} WHERE world_id = ANY($1::uuid[]))`, [worldIds]);
  await q(`DELETE FROM ${MANIFEST_ITEMS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${MANIFESTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${ITEM_APPROVERS} WHERE history_item_id IN (SELECT id FROM ${ITEMS} WHERE world_id = ANY($1::uuid[]))`, [worldIds]);
  await q(`DELETE FROM ${BASELINE} WHERE history_item_id IN (SELECT id FROM ${ITEMS} WHERE world_id = ANY($1::uuid[]))`, [worldIds]);
  await q(`DELETE FROM ${ITEMS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${REMOVAL_COMMANDS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${REMOVED_EVENTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${REMOVE_PAYLOADS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${APPROVALS} WHERE proposal_id IN (SELECT id FROM ${PROPOSALS} WHERE world_id = ANY($1::uuid[]))`, [worldIds]);
  await q(`DELETE FROM ${PROPOSALS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${SNAPSHOT_MEMBERS} WHERE membership_snapshot_id IN (SELECT id FROM ${SNAPSHOTS} WHERE world_id = ANY($1::uuid[]))`, [worldIds]);
  await q(`DELETE FROM ${SNAPSHOTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${LEAVE_COMMANDS} WHERE world_id = ANY($1::uuid[]) OR actor_user_id = ANY($2::uuid[])`, [worldIds, humans]);
  await q(`DELETE FROM ${LEFT_EVENTS} WHERE world_id = ANY($1::uuid[]) OR actor_user_id = ANY($2::uuid[])`, [worldIds, humans]);
  await q(`DELETE FROM ${ACCEPTANCE_COMMANDS} WHERE actor_user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[])`, [humans, worldIds]);
  await q(`DELETE FROM ${BIRTH_EVENTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${EPISODES} WHERE world_id = ANY($1::uuid[]) OR user_id = ANY($2::uuid[])`, [worldIds, humans]);
  await q(`DELETE FROM ${WORLDS} WHERE id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${INVITE_COMMANDS} WHERE actor_user_id = ANY($1::uuid[])`, [humans]);
  await q(`DELETE FROM ${INVITATIONS} WHERE inviter_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[])`, [humans]);
  await q(`DELETE FROM ${CREDENTIAL} WHERE user_id = ANY($1::uuid[])`, [humans]);
  await q('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
  await q('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [humans]);
  return worldIds;
}

/** The committed fixtures the multi-connection races need. */
async function provisionRaceWorlds(c) {
  const worlds = {};

  worlds.leaveFirst = await provisionWorld(c.inviter, c.raceSecond, 'race-leave');

  // A governed removal, prepared and unanimously approved by every current
  // member EXCEPT the target - which, in a two-human World, is the one other
  // human. The removal itself is left uncommitted so the race can commit it.
  const removeFirst = await provisionWorld(c.inviter, c.raceSecondD, 'race-remove');
  const removeProposal = randomUUID();
  await identity('postgres');
  const [removePrepared] = await rows(REMOVE_PREPARE_SQL,
    [removeProposal, randomUUID(), randomUUID(), removeFirst.worldId, c.raceSecondD]);
  assert.equal(removePrepared.outcome, 'PREPARED');
  await approveWith(removeProposal, [c.inviter]);
  worlds.removeFirst = { ...removeFirst, proposal: removeProposal };

  const closeFirst = await provisionWorld(c.inviter, c.raceSecondB, 'race-close');
  const proposal = randomUUID();
  await identity('postgres');
  const [prepared] = await rows(END_PREPARE_SQL, [proposal, randomUUID(), randomUUID(), closeFirst.worldId]);
  assert.equal(prepared.outcome, 'PREPARED');
  await approveWith(proposal, [c.inviter, c.raceSecondB]);
  worlds.closeFirst = { ...closeFirst, proposal };

  const twoDeletes = await provisionWorld(c.inviter, c.raceSecondC, 'race-two-deletes');
  const target = await commitText(twoDeletes.worldId, c.inviter, 'the statement two deletes will race for');
  worlds.twoDeletes = { ...twoDeletes, materialId: target.committed_material_id };
  return worlds;
}

async function main() {
  const f = {
    inviter: randomUUID(), second: randomUUID(), third: randomUUID(), outsider: randomUUID(),
    departed: randomUUID(), closedSecond: randomUUID(), chainSecond: randomUUID(), grantSecond: randomUUID(),
    staleSecond: randomUUID(), regressionSecond: randomUUID(), forwardSecond: randomUUID(),
    fixSecond: randomUUID(), fixRemoved: randomUUID(), fixCrossA: randomUUID(), fixCrossB: randomUUID(),
    fixVoice: randomUUID(), fixRetry: randomUUID(), fixAuthority: randomUUID(),
  };
  f.humans = Object.values(f);
  const c = {
    inviter: randomUUID(), raceSecond: randomUUID(), raceSecondB: randomUUID(), raceSecondC: randomUUID(),
    raceSecondD: randomUUID(),
  };
  c.humans = Object.values(c);
  try {
    await client.connect();
    await verifyCatalog();
    await q('BEGIN');
    try {
      await provisionHumans(f.humans);
      const committed = await verifyCommit(f);
      const lifecycle = await verifyLifecycle(f);
      const deletion = await verifyDeletion(f, lifecycle);
      await verifyQandeelBoundary(f);
      await verifyReviewFixes(f);
      await verifyNonRegression(f, [committed.world.worldId, deletion.world.worldId]);
      await verifyForwardSafety(f);
      await identity('postgres');
    } finally {
      await q('ROLLBACK');
    }

    try {
      await provisionHumans(c.humans);
      await q('BEGIN');
      try {
        c.worlds = await provisionRaceWorlds(c);
        await identity('postgres');
      } finally {
        await q('COMMIT');
      }
      await verifyConcurrency(c);
    } finally {
      stage = 'concurrency: fixture removal';
      await removeFixtures(c.humans);
    }

    stage = 'fixture residue';
    await identity('postgres');
    const humans = [...f.humans, ...c.humans];
    const [{ n }] = await rows(
      `SELECT (SELECT count(*) FROM ${MATERIALS} WHERE author_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${COMMIT_COMMANDS} WHERE actor_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${DELETE_COMMANDS} WHERE actor_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${EPISODES} WHERE user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${CREDENTIAL} WHERE user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${INVITATIONS} WHERE inviter_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`, [humans]);
    assert.equal(Number(n), 0, 'every fixture this verifier created was rolled back or removed');

    console.log('migration 0090 verified: material committed atomically, deleted physically, and never reachable by an app role');
  } catch (error) {
    console.error(`migration 0090 verification failed at stage: ${stage}`);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

void (async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
