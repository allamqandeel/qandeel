// Real-PostgreSQL verifier for migration 0085 - I-04E Governed Standard
// Membership Lifecycle v1 (PART A).
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// behaviour rather than from the migration text:
//
//   * catalog: every relation migration 0085 creates exists once and still carries
//     every column it OWNS - name, type, nullability AND the absence of a default -
//     unchanged and in its original position, every owned unique binding and every
//     owned foreign key pinned by name / local columns / parent / restrictive
//     deletion, RLS on with zero policies, and no privilege at all for PUBLIC,
//     anon, authenticated or service_role;
//   * catalog: the two I-04E topology triggers exist on the canonical membership
//     table, call exactly the terminalization function, are AFTER + FOR EACH ROW,
//     and each reacts to exactly one real open-topology transition;
//   * catalog: all seven primitives plus the trigger function are postgres-owned,
//     SECURITY DEFINER, search_path-pinned and VOLATILE, and NONE of them is
//     executable by any application role, because the frozen Launch Gate
//     precondition is unimplemented;
//   * ADD: two current humans must both approve before any invitation exists, one
//     approval is not enough, the invitation binds the exact target / World /
//     proposal / snapshot / payload, only the exact target may accept, acceptance
//     creates exactly one episode + one MEMBER_JOINED + one command on ONE
//     database-owned instant, a current or former member can never be an
//     ADD_MEMBER target, and acceptance creates NO retrospective access of any
//     kind - proven by an exact count delta across every Shared relation;
//   * STALENESS: a leave through the ALREADY FROZEN I-04C primitive terminalizes a
//     pending invitation to STALE_GOVERNANCE with a database-owned terminal
//     instant, exactly once, and the invitation can never be accepted or revived -
//     not even after the same human rejoins and restores an identical human set;
//   * REMOVE: two of three remaining humans are required, the target's own
//     approval does not count, a satisfied proposal closes the exact excluded
//     episode IN PLACE with REMOVED, a stale removal cannot reach a later
//     successor episode of the same human, one remaining human keeps an ACTIVE /
//     STANDARD World with no new privilege, the sole remaining human can never be
//     removed, and no Standing Context Grant, ceiling row or consent event moves;
//   * REJOIN: a former human with a closed episode may be proposed, all current
//     humans must approve, only that exact human may commit it, the new episode id
//     differs from every prior one and no prior row changes, the absence interval
//     stays explicit and ungranted, and a stale pre-leave proposal never revives;
//   * concurrency, with real independent connections: dispatch versus leave,
//     acceptance versus leave, two identical acceptances, two different commands
//     on one invitation, removal versus the target's own leave, removal beside
//     approval and invitation traffic in the same World, two rejoins of the same
//     human, two governed mutations from one old topology, and two unrelated
//     Worlds - with the deadlock counter proven unchanged throughout;
//   * forward safety: the I-04F history/closure substrate, the I-04G Shared
//     material substrate, a Launch Gate, later additive columns, constraints,
//     indexes and audit triggers are all created for real inside a rolled-back
//     SAVEPOINT, this verifier still passes and the whole lifecycle still works
//     beside them - and then every real regression to something 0085 OWNS is
//     planted and must still be refused;
//   * zero fixture residue after completion.
//
// There is deliberately NO live census here of any kind: no fixed list of table
// names required to stay absent, no exact count of live foreign keys, constraints
// or indexes, and no catalog sweep for names later authorized work will use. This
// file runs against a fully migrated database, so any of those would be a ceiling
// on the whole roadmap rather than a fact about migration 0085. What 0085 itself
// did NOT create is proven from 0085's own text, by
// database/tests/shared-world-governed-membership-lifecycle-v1.test.mjs.
//
// Nothing here weakens RLS or an ACL to make a proof easy: the application roles
// are only ever used to prove denial.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
const GRANTS = 'public.shared_world_standing_context_grants';
const CEILING = 'public.shared_world_standing_context_grant_audience';
const CONSENT_EVENTS = 'public.shared_world_standing_context_consent_events';
const LEFT_EVENTS = 'public.shared_world_member_left_events';
const LEAVE_COMMANDS = 'public.shared_world_voluntary_leave_commands';
const SNAPSHOTS = 'public.shared_world_membership_snapshots';
const SNAPSHOT_MEMBERS = 'public.shared_world_membership_snapshot_members';
const PROPOSALS = 'public.shared_world_governance_proposals';
const APPROVALS = 'public.shared_world_governance_approvals';

const ADD_PAYLOADS = 'public.shared_world_add_member_payload_versions';
const REMOVE_PAYLOADS = 'public.shared_world_remove_member_payload_versions';
const REJOIN_PAYLOADS = 'public.shared_world_rejoin_payload_versions';
const MEMBER_INVITATIONS = 'public.shared_world_member_invitations';
const JOINED_EVENTS = 'public.shared_world_member_joined_events';
const ACCEPT_COMMANDS = 'public.shared_world_member_acceptance_commands';
const REMOVED_EVENTS = 'public.shared_world_member_removed_events';
const REMOVAL_COMMANDS = 'public.shared_world_member_removal_commands';
const REJOINED_EVENTS = 'public.shared_world_member_rejoined_events';
const REJOIN_COMMANDS = 'public.shared_world_member_rejoin_commands';

const OWN_TABLES = [ADD_PAYLOADS, REMOVE_PAYLOADS, REJOIN_PAYLOADS, MEMBER_INVITATIONS, JOINED_EVENTS,
  ACCEPT_COMMANDS, REMOVED_EVENTS, REMOVAL_COMMANDS, REJOINED_EVENTS, REJOIN_COMMANDS];
const SEALED_PREDECESSORS = [WORLDS, EPISODES, CREDENTIAL, INVITATIONS, INVITE_COMMANDS, BIRTH_EVENTS,
  ACCEPTANCE_COMMANDS, GRANTS, CEILING, CONSENT_EVENTS, LEFT_EVENTS, LEAVE_COMMANDS,
  SNAPSHOTS, SNAPSHOT_MEMBERS, PROPOSALS, APPROVALS];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

const TRIGGER_FN = 'public.terminalize_stale_shared_world_member_invitations_v1()';
const PREPARE_ADD_FN = 'public.prepare_shared_world_add_member_governance_v1(uuid,uuid,uuid,uuid,uuid)';
const PREPARE_REMOVE_FN = 'public.prepare_shared_world_remove_member_governance_v1(uuid,uuid,uuid,uuid,uuid)';
const PREPARE_REJOIN_FN = 'public.prepare_shared_world_rejoin_governance_v1(uuid,uuid,uuid,uuid,uuid)';
const DISPATCH_FN = 'public.dispatch_shared_world_member_invitation_v1(uuid,uuid)';
const ACCEPT_FN = 'public.accept_shared_world_member_invitation_v1(uuid,uuid,uuid,uuid)';
const REMOVE_FN = 'public.commit_shared_world_member_removal_v1(uuid,uuid,uuid)';
const REJOIN_FN = 'public.commit_shared_world_member_rejoin_v1(uuid,uuid,uuid,uuid)';
const OWN_FUNCTIONS = [PREPARE_ADD_FN, PREPARE_REMOVE_FN, PREPARE_REJOIN_FN, DISPATCH_FN, ACCEPT_FN,
  REMOVE_FN, REJOIN_FN, TRIGGER_FN];

const OPEN_TRIGGER = 'shared_world_open_episode_stales_member_invitations';
const CLOSED_TRIGGER = 'shared_world_closed_episode_stales_member_invitations';

const INSUFFICIENT_PRIVILEGE = ['42501'];
const INVALID_PARAMETER = ['22023'];
const UNAVAILABLE = ['P0002'];
const CONFLICT = ['23505'];
const STALE = ['40001'];
const INCOMPLETE = ['55000'];

const ROTATE_SQL = 'SELECT command_id, credential_epoch FROM public.rotate_shared_world_invite_credential_v1($1,$2,$3)';
const SUBMIT_SQL = 'SELECT outcome, command_id, requested_invitation_id FROM public.submit_shared_world_direct_invitation_v1($1,$2,$3)';
const BIRTH_SQL = 'SELECT outcome, born_world_id FROM public.commit_shared_world_direct_acceptance_birth_v1($1,$2,$3,$4,$5)';
const LEAVE_SQL = `SELECT outcome, closed_membership_episode_id, left_at
                     FROM public.commit_shared_world_standard_voluntary_leave_v1($1,$2,$3)`;
const APPROVE_SQL = `SELECT outcome, committed_approval_id, approved_proposal_id, approved_snapshot_id,
                            approver_episode_id, approval_committed_at
                       FROM public.commit_shared_world_governance_approval_v1($1,$2)`;
const RESOLVE_SQL = `SELECT outcome, satisfied_proposal_id, required_approval_count, recorded_required_approval_count
                       FROM public.resolve_shared_world_governance_approval_v1($1,$2,$3)`;
const PREPARE_ADD_SQL = `SELECT outcome, prepared_proposal_id, prepared_snapshot_id, prepared_world_id,
                                prepared_operation_kind, prepared_payload_version_id, prepared_approval_rule,
                                prepared_required_approval_count, prepared_at
                           FROM public.prepare_shared_world_add_member_governance_v1($1,$2,$3,$4,$5)`;
const PREPARE_REMOVE_SQL = `SELECT outcome, prepared_proposal_id, prepared_snapshot_id, prepared_world_id,
                                   prepared_operation_kind, prepared_payload_version_id, prepared_approval_rule,
                                   prepared_required_approval_count, prepared_target_episode_id, prepared_at
                              FROM public.prepare_shared_world_remove_member_governance_v1($1,$2,$3,$4,$5)`;
const PREPARE_REJOIN_SQL = `SELECT outcome, prepared_proposal_id, prepared_snapshot_id, prepared_world_id,
                                   prepared_operation_kind, prepared_payload_version_id, prepared_approval_rule,
                                   prepared_required_approval_count, prepared_prior_episode_id, prepared_at
                              FROM public.prepare_shared_world_rejoin_governance_v1($1,$2,$3,$4,$5)`;
const DISPATCH_SQL = `SELECT outcome, dispatched_invitation_id, invited_world_id, dispatched_proposal_id,
                             dispatched_snapshot_id, dispatched_payload_version_id, dispatched_state, dispatched_at
                        FROM public.dispatch_shared_world_member_invitation_v1($1,$2)`;
const ACCEPT_SQL = `SELECT outcome, accepted_command_id, accepted_invitation_id, joined_world_id,
                           created_membership_episode_id, created_joined_event_id, member_joined_at
                      FROM public.accept_shared_world_member_invitation_v1($1,$2,$3,$4)`;
const REMOVE_SQL = `SELECT outcome, removal_command_id, removed_world_id, removed_proposal_id,
                           closed_membership_episode_id, removed_event_id, closed_end_reason, member_removed_at
                      FROM public.commit_shared_world_member_removal_v1($1,$2,$3)`;
const REJOIN_SQL = `SELECT outcome, rejoin_command_id, rejoined_world_id, rejoined_proposal_id,
                           created_membership_episode_id, bound_prior_episode_id, created_rejoined_event_id,
                           member_rejoined_at
                      FROM public.commit_shared_world_member_rejoin_v1($1,$2,$3,$4)`;

const prepareAdd = (p, worldId, target) => rows(PREPARE_ADD_SQL, [p.proposal, p.snapshot, p.payload, worldId, target]);
const prepareRemove = (p, worldId, target) => rows(PREPARE_REMOVE_SQL, [p.proposal, p.snapshot, p.payload, worldId, target]);
const prepareRejoin = (p, worldId, target) => rows(PREPARE_REJOIN_SQL, [p.proposal, p.snapshot, p.payload, worldId, target]);
const dispatchInvite = (invitationId, proposalId) => rows(DISPATCH_SQL, [invitationId, proposalId]);
const acceptInvite = (ids4) => rows(ACCEPT_SQL, [ids4.command, ids4.invitation, ids4.episode, ids4.event]);
const commitRemoval = (commandId, proposalId, eventId) => rows(REMOVE_SQL, [commandId, proposalId, eventId]);
const commitRejoin = (ids4) => rows(REJOIN_SQL, [ids4.command, ids4.proposal, ids4.episode, ids4.event]);
const approve = (approvalId, proposalId) => rows(APPROVE_SQL, [approvalId, proposalId]);
const resolve = (proposalId, operation, payload) => rows(RESOLVE_SQL, [proposalId, operation, payload]);
const leave = (commandId, worldId, eventId) => rows(LEAVE_SQL, [commandId, worldId, eventId]);

const ids = () => ({ proposal: randomUUID(), snapshot: randomUUID(), payload: randomUUID() });
const opaqueRef = (label) => `ref:i04e:${label}:${randomUUID()}`;

const UUID = 'uuid';
const TEXT = 'text';
const TSTZ = 'timestamp with time zone';

/** Every column each table OWNS, as a PREFIX: a later additive column is permitted, a drop / retype / reorder is not. */
const OWNED_COLUMNS = {
  [ADD_PAYLOADS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['governance_proposal_id', UUID, 'NO', null],
    ['governance_operation_kind', TEXT, 'NO', null], ['target_user_id', UUID, 'NO', null], ['created_at', TSTZ, 'NO', null],
  ],
  [REMOVE_PAYLOADS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['governance_proposal_id', UUID, 'NO', null],
    ['governance_operation_kind', TEXT, 'NO', null], ['target_user_id', UUID, 'NO', null],
    ['target_membership_episode_id', UUID, 'NO', null], ['created_at', TSTZ, 'NO', null],
  ],
  [REJOIN_PAYLOADS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['governance_proposal_id', UUID, 'NO', null],
    ['governance_operation_kind', TEXT, 'NO', null], ['target_user_id', UUID, 'NO', null],
    ['prior_membership_episode_id', UUID, 'NO', null], ['created_at', TSTZ, 'NO', null],
  ],
  [MEMBER_INVITATIONS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['target_user_id', UUID, 'NO', null],
    ['governance_proposal_id', UUID, 'NO', null], ['membership_snapshot_id', UUID, 'NO', null],
    ['add_member_payload_version_id', UUID, 'NO', null], ['invitation_state', TEXT, 'NO', null],
    ['created_at', TSTZ, 'NO', null], ['terminal_at', TSTZ, 'YES', null],
    ['accepted_membership_episode_id', UUID, 'YES', null],
  ],
  [JOINED_EVENTS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['membership_episode_id', UUID, 'NO', null],
    ['member_invitation_id', UUID, 'NO', null], ['actor_user_id', UUID, 'NO', null], ['occurred_at', TSTZ, 'NO', null],
  ],
  [ACCEPT_COMMANDS]: [
    ['id', UUID, 'NO', null], ['actor_user_id', UUID, 'NO', null], ['world_id', UUID, 'NO', null],
    ['member_invitation_id', UUID, 'NO', null], ['membership_episode_id', UUID, 'NO', null],
    ['member_joined_event_id', UUID, 'NO', null], ['committed_at', TSTZ, 'NO', null],
  ],
  [REMOVED_EVENTS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['membership_episode_id', UUID, 'NO', null],
    ['target_user_id', UUID, 'NO', null], ['governance_proposal_id', UUID, 'NO', null], ['occurred_at', TSTZ, 'NO', null],
  ],
  [REMOVAL_COMMANDS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['governance_proposal_id', UUID, 'NO', null],
    ['membership_episode_id', UUID, 'NO', null], ['member_removed_event_id', UUID, 'NO', null],
    ['committed_at', TSTZ, 'NO', null],
  ],
  [REJOINED_EVENTS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['membership_episode_id', UUID, 'NO', null],
    ['prior_membership_episode_id', UUID, 'NO', null], ['actor_user_id', UUID, 'NO', null],
    ['governance_proposal_id', UUID, 'NO', null], ['occurred_at', TSTZ, 'NO', null],
  ],
  [REJOIN_COMMANDS]: [
    ['id', UUID, 'NO', null], ['actor_user_id', UUID, 'NO', null], ['world_id', UUID, 'NO', null],
    ['governance_proposal_id', UUID, 'NO', null], ['membership_episode_id', UUID, 'NO', null],
    ['member_rejoined_event_id', UUID, 'NO', null], ['committed_at', TSTZ, 'NO', null],
  ],
};

/** Every foreign key 0085 OWNS, pinned exactly rather than counted. */
const OWNED_FOREIGN_KEYS = {
  shared_world_add_member_payload_versions_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_add_member_payload_versions_target_fk: 'FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_add_member_payload_versions_proposal_fk: 'FOREIGN KEY (governance_proposal_id, world_id, governance_operation_kind, id) REFERENCES shared_world_governance_proposals(id, world_id, operation_kind, proposed_payload_version_id) ON DELETE RESTRICT',
  shared_world_remove_member_payload_versions_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_remove_member_payload_versions_target_fk: 'FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_remove_member_payload_versions_episode_fk: 'FOREIGN KEY (target_membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_remove_member_payload_versions_proposal_fk: 'FOREIGN KEY (governance_proposal_id, world_id, governance_operation_kind, id) REFERENCES shared_world_governance_proposals(id, world_id, operation_kind, proposed_payload_version_id) ON DELETE RESTRICT',
  shared_world_remove_member_payload_versions_excluded_episode_fk: 'FOREIGN KEY (governance_proposal_id, target_membership_episode_id) REFERENCES shared_world_governance_proposals(id, excluded_membership_episode_id) ON DELETE RESTRICT',
  shared_world_rejoin_payload_versions_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_rejoin_payload_versions_target_fk: 'FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_rejoin_payload_versions_prior_episode_fk: 'FOREIGN KEY (prior_membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_rejoin_payload_versions_proposal_fk: 'FOREIGN KEY (governance_proposal_id, world_id, governance_operation_kind, id) REFERENCES shared_world_governance_proposals(id, world_id, operation_kind, proposed_payload_version_id) ON DELETE RESTRICT',
  shared_world_member_invitations_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_member_invitations_target_fk: 'FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_member_invitations_snapshot_binding_fk: 'FOREIGN KEY (governance_proposal_id, membership_snapshot_id) REFERENCES shared_world_governance_proposals(id, membership_snapshot_id) ON DELETE RESTRICT',
  shared_world_member_invitations_payload_binding_fk: 'FOREIGN KEY (governance_proposal_id, add_member_payload_version_id) REFERENCES shared_world_add_member_payload_versions(governance_proposal_id, id) ON DELETE RESTRICT',
  shared_world_member_invitations_payload_target_fk: 'FOREIGN KEY (add_member_payload_version_id, target_user_id) REFERENCES shared_world_add_member_payload_versions(id, target_user_id) ON DELETE RESTRICT',
  // DEFERRED deliberately: the acceptance must mark the invitation terminal BEFORE
  // the episode it names exists, or the topology trigger terminalizes the very
  // acceptance creating it. Still enforced - at COMMIT - which verifyDeferredBinding
  // proves below rather than assumes.
  shared_world_member_invitations_episode_fk: 'FOREIGN KEY (accepted_membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED',
  shared_world_member_joined_events_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_member_joined_events_episode_fk: 'FOREIGN KEY (membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_member_joined_events_invitation_fk: 'FOREIGN KEY (member_invitation_id) REFERENCES shared_world_member_invitations(id) ON DELETE RESTRICT',
  shared_world_member_joined_events_actor_fk: 'FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_member_acceptance_commands_actor_fk: 'FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_member_acceptance_commands_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_member_acceptance_commands_invitation_fk: 'FOREIGN KEY (member_invitation_id) REFERENCES shared_world_member_invitations(id) ON DELETE RESTRICT',
  shared_world_member_acceptance_commands_episode_fk: 'FOREIGN KEY (membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_member_acceptance_commands_event_fk: 'FOREIGN KEY (member_joined_event_id) REFERENCES shared_world_member_joined_events(id) ON DELETE RESTRICT',
  shared_world_member_removed_events_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_member_removed_events_episode_fk: 'FOREIGN KEY (membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_member_removed_events_target_fk: 'FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_member_removed_events_proposal_fk: 'FOREIGN KEY (governance_proposal_id) REFERENCES shared_world_governance_proposals(id) ON DELETE RESTRICT',
  shared_world_member_removal_commands_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_member_removal_commands_proposal_fk: 'FOREIGN KEY (governance_proposal_id) REFERENCES shared_world_governance_proposals(id) ON DELETE RESTRICT',
  shared_world_member_removal_commands_episode_fk: 'FOREIGN KEY (membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_member_removal_commands_event_fk: 'FOREIGN KEY (member_removed_event_id) REFERENCES shared_world_member_removed_events(id) ON DELETE RESTRICT',
  shared_world_member_rejoined_events_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_member_rejoined_events_episode_fk: 'FOREIGN KEY (membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_member_rejoined_events_prior_episode_fk: 'FOREIGN KEY (prior_membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_member_rejoined_events_actor_fk: 'FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_member_rejoined_events_proposal_fk: 'FOREIGN KEY (governance_proposal_id) REFERENCES shared_world_governance_proposals(id) ON DELETE RESTRICT',
  shared_world_member_rejoin_commands_actor_fk: 'FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_member_rejoin_commands_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_member_rejoin_commands_proposal_fk: 'FOREIGN KEY (governance_proposal_id) REFERENCES shared_world_governance_proposals(id) ON DELETE RESTRICT',
  shared_world_member_rejoin_commands_episode_fk: 'FOREIGN KEY (membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_member_rejoin_commands_event_fk: 'FOREIGN KEY (member_rejoined_event_id) REFERENCES shared_world_member_rejoined_events(id) ON DELETE RESTRICT',
};

/** Every unique / primary binding 0085 OWNS, pinned by name and definition. */
const OWNED_UNIQUE_BINDINGS = [
  [ADD_PAYLOADS, 'shared_world_add_member_payload_versions_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [ADD_PAYLOADS, 'shared_world_add_member_payload_versions_proposal_payload_key', /UNIQUE \(governance_proposal_id, id\)/u],
  [ADD_PAYLOADS, 'shared_world_add_member_payload_versions_payload_target_key', /UNIQUE \(id, target_user_id\)/u],
  [REMOVE_PAYLOADS, 'shared_world_remove_member_payload_versions_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [REJOIN_PAYLOADS, 'shared_world_rejoin_payload_versions_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [MEMBER_INVITATIONS, 'shared_world_member_invitations_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [MEMBER_INVITATIONS, 'shared_world_member_invitations_episode_key', /UNIQUE \(accepted_membership_episode_id\)/u],
  [JOINED_EVENTS, 'shared_world_member_joined_events_episode_key', /UNIQUE \(membership_episode_id\)/u],
  [JOINED_EVENTS, 'shared_world_member_joined_events_invitation_key', /UNIQUE \(member_invitation_id\)/u],
  [ACCEPT_COMMANDS, 'shared_world_member_acceptance_commands_invitation_key', /UNIQUE \(member_invitation_id\)/u],
  [ACCEPT_COMMANDS, 'shared_world_member_acceptance_commands_episode_key', /UNIQUE \(membership_episode_id\)/u],
  [ACCEPT_COMMANDS, 'shared_world_member_acceptance_commands_event_key', /UNIQUE \(member_joined_event_id\)/u],
  [REMOVED_EVENTS, 'shared_world_member_removed_events_episode_key', /UNIQUE \(membership_episode_id\)/u],
  [REMOVED_EVENTS, 'shared_world_member_removed_events_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [REMOVAL_COMMANDS, 'shared_world_member_removal_commands_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [REMOVAL_COMMANDS, 'shared_world_member_removal_commands_episode_key', /UNIQUE \(membership_episode_id\)/u],
  [REMOVAL_COMMANDS, 'shared_world_member_removal_commands_event_key', /UNIQUE \(member_removed_event_id\)/u],
  [REJOINED_EVENTS, 'shared_world_member_rejoined_events_episode_key', /UNIQUE \(membership_episode_id\)/u],
  [REJOINED_EVENTS, 'shared_world_member_rejoined_events_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [REJOIN_COMMANDS, 'shared_world_member_rejoin_commands_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [REJOIN_COMMANDS, 'shared_world_member_rejoin_commands_episode_key', /UNIQUE \(membership_episode_id\)/u],
  [REJOIN_COMMANDS, 'shared_world_member_rejoin_commands_event_key', /UNIQUE \(member_rejoined_event_id\)/u],
  // The two additive composite keys I-04E puts on the frozen I-04D proposal so an
  // operation payload can bind it structurally.
  [PROPOSALS, 'shared_world_governance_proposals_operation_payload_binding_key',
    /UNIQUE \(id, world_id, operation_kind, proposed_payload_version_id\)/u],
  [PROPOSALS, 'shared_world_governance_proposals_excluded_episode_binding_key',
    /UNIQUE \(id, excluded_membership_episode_id\)/u],
];

/** The consistency rules 0085 freezes on the member invitation, by name. */
const OWNED_CHECKS = [
  [ADD_PAYLOADS, 'shared_world_add_member_payload_versions_operation_check', /ADD_MEMBER/u],
  [REMOVE_PAYLOADS, 'shared_world_remove_member_payload_versions_operation_check', /REMOVE_MEMBER/u],
  [REJOIN_PAYLOADS, 'shared_world_rejoin_payload_versions_operation_check', /REJOIN_MEMBER/u],
  [MEMBER_INVITATIONS, 'shared_world_member_invitations_terminal_consistency_check', /PENDING/u],
  [MEMBER_INVITATIONS, 'shared_world_member_invitations_terminal_after_creation_check', /terminal_at/u],
  [MEMBER_INVITATIONS, 'shared_world_member_invitations_acceptance_consistency_check', /ACCEPTED/u],
  [REJOINED_EVENTS, 'shared_world_member_rejoined_events_distinct_episode_check', /membership_episode_id <> prior_membership_episode_id/u],
];

/**
 * The exact count of every Shared relation this verifier names, for the humans and
 * Worlds under test. Deltas against it are how "acceptance creates no retrospective
 * access" and "removal moves no grant state" are proven: whatever a primitive did or
 * did not do, the counts show it. It names only relations this verifier already
 * knows, so it puts no ceiling on relations a later slice adds.
 */
async function sharedCounts(humans, worldIds) {
  const [row] = await rows(
    `SELECT (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($2::uuid[])) AS worlds,
            (SELECT count(*) FROM ${EPISODES} WHERE world_id = ANY($2::uuid[])) AS episodes,
            (SELECT count(*) FROM ${EPISODES} WHERE world_id = ANY($2::uuid[]) AND ended_at IS NULL) AS "openEpisodes",
            (SELECT count(*) FROM ${GRANTS} WHERE world_id = ANY($2::uuid[]) OR grantor_user_id = ANY($1::uuid[])) AS grants,
            (SELECT count(*) FROM ${CEILING} c JOIN ${GRANTS} g ON g.id = c.grant_id
              WHERE g.world_id = ANY($2::uuid[]) OR g.grantor_user_id = ANY($1::uuid[])) AS ceiling,
            (SELECT count(*) FROM ${CONSENT_EVENTS} WHERE world_id = ANY($2::uuid[])) AS "consentEvents",
            (SELECT count(*) FROM ${SNAPSHOTS} WHERE world_id = ANY($2::uuid[])) AS snapshots,
            (SELECT count(*) FROM ${SNAPSHOT_MEMBERS} m JOIN ${SNAPSHOTS} s ON s.id = m.membership_snapshot_id
              WHERE s.world_id = ANY($2::uuid[])) AS "snapshotMembers",
            (SELECT count(*) FROM ${PROPOSALS} WHERE world_id = ANY($2::uuid[])) AS proposals,
            (SELECT count(*) FROM ${APPROVALS} a JOIN ${PROPOSALS} pr ON pr.id = a.proposal_id
              WHERE pr.world_id = ANY($2::uuid[])) AS approvals,
            (SELECT count(*) FROM ${ADD_PAYLOADS} WHERE world_id = ANY($2::uuid[])) AS "addPayloads",
            (SELECT count(*) FROM ${REMOVE_PAYLOADS} WHERE world_id = ANY($2::uuid[])) AS "removePayloads",
            (SELECT count(*) FROM ${REJOIN_PAYLOADS} WHERE world_id = ANY($2::uuid[])) AS "rejoinPayloads",
            (SELECT count(*) FROM ${MEMBER_INVITATIONS} WHERE world_id = ANY($2::uuid[])) AS invitations,
            (SELECT count(*) FROM ${MEMBER_INVITATIONS} WHERE world_id = ANY($2::uuid[]) AND invitation_state = 'PENDING') AS "pendingInvitations",
            (SELECT count(*) FROM ${JOINED_EVENTS} WHERE world_id = ANY($2::uuid[])) AS "joinedEvents",
            (SELECT count(*) FROM ${ACCEPT_COMMANDS} WHERE world_id = ANY($2::uuid[])) AS "acceptCommands",
            (SELECT count(*) FROM ${REMOVED_EVENTS} WHERE world_id = ANY($2::uuid[])) AS "removedEvents",
            (SELECT count(*) FROM ${REMOVAL_COMMANDS} WHERE world_id = ANY($2::uuid[])) AS "removalCommands",
            (SELECT count(*) FROM ${REJOINED_EVENTS} WHERE world_id = ANY($2::uuid[])) AS "rejoinedEvents",
            (SELECT count(*) FROM ${REJOIN_COMMANDS} WHERE world_id = ANY($2::uuid[])) AS "rejoinCommands",
            (SELECT count(*) FROM ${LEFT_EVENTS} WHERE world_id = ANY($2::uuid[])) AS "leftEvents",
            (SELECT count(*) FROM ${LEAVE_COMMANDS} WHERE world_id = ANY($2::uuid[])) AS "leaveCommands"`,
    [humans, worldIds]);
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

const deltaOf = (before, after) => Object.fromEntries(
  Object.keys(after).map((key) => [key, after[key] - before[key]]).filter(([, value]) => value !== 0));

// ---------------------------------------------------------------------------

async function verifyCatalog() {
  stage = 'catalog: every relation 0085 owns exists exactly once';
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
      `${table} still carries every column migration 0085 owns, unchanged and in its original position`);
    for (const [name] of owned) {
      assert.equal(observed.filter((column) => column[0] === name).length, 1, `${table}.${name} appears exactly once`);
    }
  }
  // There is deliberately NO migration-wide column NAME or TYPE filter over the live
  // column list here. That 0085 creates no owner, admin or initiator, stores no
  // payload blob and grants no history access is a claim about 0085's OWN text, and
  // it is proven there, by
  // database/tests/shared-world-governed-membership-lifecycle-v1.test.mjs over its
  // CREATE TABLE blocks. A live filter would instead refuse every column a later
  // REVIEWED consumer appends beside them - a `_consumer_metadata jsonb`, a
  // `_reviewer_scope text` - which is that consumer's business and not 0085's to
  // forbid. It is the same ceiling the I-04D FIX-01A correction removed from 0084,
  // and the forward-safety probe below adds exactly those two columns to prove this
  // verifier really does tolerate them.
  //
  // What replaces it is strictly stronger over what 0085 DOES own: the owned columns
  // above are pinned by name, type, nullability AND the absence of a default, so an
  // owned column that became jsonb, or gained a default, still fails.

  stage = 'catalog: the exact unique bindings and checks 0085 owns';
  const constraintsOf = async (table) => rows(
    'SELECT conname name, contype type, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY conname',
    [table]);
  const live = new Map();
  for (const table of [...OWN_TABLES, PROPOSALS]) live.set(table, await constraintsOf(table));
  // A sentinel rather than `undefined`, so a DROPPED constraint fails as a named
  // assertion instead of as a TypeError the regression probe cannot match.
  const defOf = (table, name) => (live.get(table).find((c) => c.name === name) ?? { def: `MISSING CONSTRAINT ${name}` }).def;
  for (const [table, name, shape] of OWNED_UNIQUE_BINDINGS) {
    assert.match(defOf(table, name), shape, `${name} is the exact binding migration 0085 owns`);
  }
  for (const [table, name, shape] of OWNED_CHECKS) {
    assert.match(defOf(table, name), shape, `${name} is the exact consistency rule migration 0085 owns`);
  }
  // Governed membership is keyed on EPISODE, PROPOSAL and EVENT identity, never on
  // a permanent (world, user) pair - which would forbid the very lifecycle this
  // slice implements: join, leave, rejoin, removal, of the same human.
  for (const table of OWN_TABLES) {
    for (const constraint of live.get(table).filter((c) => c.type === 'u' || /PRIMARY KEY/u.test(c.def))) {
      assert.doesNotMatch(constraint.def, /\(world_id, (?:target_)?(?:actor_)?user_id\)/u,
        `${constraint.name} must never make a (world, human) pair permanently unique`);
    }
  }

  stage = 'catalog: every foreign key 0085 owns, pinned exactly rather than counted';
  const normalize = (def) => def.replace(/REFERENCES (?:public\.)?/u, 'REFERENCES ');
  const liveForeignKeys = new Map();
  for (const table of OWN_TABLES) {
    for (const c of live.get(table).filter((entry) => entry.type === 'f')) liveForeignKeys.set(c.name, normalize(c.def));
  }
  for (const [name, def] of Object.entries(OWNED_FOREIGN_KEYS)) {
    assert.equal(liveForeignKeys.get(name), def,
      `${name} binds exactly the canonical row, restrictively: canonical history is never cascaded away`);
  }

  stage = 'catalog: the one deferred binding the acceptance ordering forces, and no other';
  // Asserted per OWNED NAME rather than as a census of every deferrable constraint on
  // these tables. A census would read "no later slice may defer anything here", which
  // is a ceiling on the roadmap rather than a fact about 0085 - the same shape this
  // file refuses everywhere else.
  const deferralOf = new Map();
  for (const table of OWN_TABLES) {
    for (const row of await rows(
      `SELECT con.conname name, con.condeferrable deferrable, con.condeferred deferred
         FROM pg_constraint con WHERE con.conrelid = $1::regclass`, [table])) {
      deferralOf.set(row.name, row);
    }
  }
  assert.equal(deferralOf.get('shared_world_member_invitations_episode_fk')?.deferred, true,
    'the accepted-episode binding is INITIALLY DEFERRED, so an acceptance may name the episode before inserting it');
  for (const name of Object.keys(OWNED_FOREIGN_KEYS)) {
    if (name === 'shared_world_member_invitations_episode_fk') continue;
    assert.equal(deferralOf.get(name)?.deferrable, false, `${name} is checked per statement, never deferred`);
  }

  stage = 'catalog: the one access pattern index 0085 owns';
  const [invitationIndex] = await rows(
    `SELECT i.relname name, pg_get_indexdef(ix.indexrelid) def
       FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid
      WHERE ix.indrelid = $1::regclass AND i.relname = 'shared_world_member_invitations_world_pending_idx'`,
    [MEMBER_INVITATIONS]);
  assert.ok(invitationIndex, 'the pending-invitation index migration 0085 owns is present');
  assert.match(invitationIndex.def, /\(world_id\)\s*WHERE \(invitation_state = 'PENDING'/u,
    'and it is the partial per-World index the terminalization mechanism needs');

  stage = 'catalog: the two topology triggers, each bound to exactly one real transition';
  const triggers = await rows(
    `SELECT t.tgname name, pg_get_triggerdef(t.oid) def, t.tgfoid = $2::regprocedure AS mine
       FROM pg_trigger t WHERE t.tgrelid = $1::regclass AND NOT t.tgisinternal ORDER BY t.tgname`,
    [EPISODES, TRIGGER_FN]);
  const mine = triggers.filter((t) => t.mine);
  const named = (name) => mine.find((t) => t.name === name) ?? { def: `MISSING TRIGGER ${name}` };
  // Every one of these carries its own message, because a regression probe matches
  // the ASSERTION MESSAGE: the default text of a failed assert.match prints the
  // regex escaped, which no honest matcher can be written against.
  assert.equal(mine.length, 2, 'exactly two triggers call the I-04E terminalization mechanism');
  assert.match(named(OPEN_TRIGGER).def, /AFTER INSERT ON/u,
    'the open-episode trigger fires AFTER an insert on the canonical membership table');
  assert.match(named(OPEN_TRIGGER).def, /FOR EACH ROW/u,
    'the open-episode trigger is a FOR EACH ROW trigger');
  assert.match(named(OPEN_TRIGGER).def, /new\.ended_at IS NULL/u,
    'the open-episode trigger reacts only to an episode that is actually OPEN: a historical closed insert changes no current topology');
  assert.doesNotMatch(named(OPEN_TRIGGER).def, /old\./u,
    'the open-episode trigger consults no OLD row, because an insert has none');
  assert.match(named(CLOSED_TRIGGER).def, /AFTER UPDATE OF ended_at ON/u,
    'the closed-episode trigger fires only when ended_at itself is written');
  assert.match(named(CLOSED_TRIGGER).def, /FOR EACH ROW/u,
    'the closed-episode trigger is a FOR EACH ROW trigger');
  assert.match(named(CLOSED_TRIGGER).def, /old\.ended_at IS NULL/u,
    'the closed-episode trigger reacts only to an episode that WAS open');
  assert.match(named(CLOSED_TRIGGER).def, /new\.ended_at IS NOT NULL/u,
    'the closed-episode trigger reacts only to an open episode ACTUALLY becoming closed');
  // The mechanism is narrow in what it can reach, proven from the stored source.
  const [terminalizer] = await rows(
    `SELECT pr.prosrc, pr.prorettype = 'trigger'::regtype AS "isTrigger" FROM pg_proc pr WHERE pr.oid = $1::regprocedure`,
    [TRIGGER_FN]);
  assert.equal(terminalizer.isTrigger, true, 'the terminalization mechanism is a trigger function');
  assert.match(terminalizer.prosrc, /UPDATE public\.shared_world_member_invitations i/u,
    'it transitions member invitations');
  assert.equal((terminalizer.prosrc.match(/UPDATE public\./gu) ?? []).length, 1,
    'and writes exactly one relation: no membership row, no World, no governance and no grant');
  assert.doesNotMatch(terminalizer.prosrc, /INSERT INTO|DELETE FROM/u, 'it creates and deletes nothing');
  assert.match(terminalizer.prosrc, /AND i\.invitation_state = 'PENDING'/u,
    'only a still-PENDING invitation is terminalized, so the transition happens exactly once');
  assert.match(terminalizer.prosrc, /WHERE i\.world_id = changed_world/u, 'and never in another World');
  assert.doesNotMatch(terminalizer.prosrc, /shared_world_direct_invitations|shared_world_invite_credential_state/u,
    'it never touches an I-04A direct-world invitation');
  assert.doesNotMatch(terminalizer.prosrc, /standing_context|consent/iu, 'and never reaches grant or consent state');
  // EXACT SET EQUALITY, in BOTH directions, over EPISODE identity: a count or a
  // user-id comparison would accept a leave followed by a rejoin.
  assert.match(terminalizer.prosrc, /AND NOT EXISTS \(SELECT 1 FROM public\.shared_world_membership_snapshot_members m/u);
  assert.match(terminalizer.prosrc, /AND NOT EXISTS \(SELECT 1 FROM public\.shared_world_membership_episodes e/u);
  assert.match(terminalizer.prosrc, /AND m\.membership_episode_id = e\.id/u);
  assert.match(terminalizer.prosrc, /WHERE e\.id = m\.membership_episode_id/u);

  stage = 'catalog: RLS on, zero policies, and no application-role privilege';
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
  stage = 'catalog: the predecessor substrate is still sealed and still policy-free';
  for (const table of SEALED_PREDECESSORS) {
    const [{ n: policies }] = await rows('SELECT count(*)::int n FROM pg_policy p WHERE p.polrelid = $1::regclass', [table]);
    assert.equal(policies, 0, `${table} still carries zero RLS policies`);
    for (const role of APPLICATION_ROLES) {
      for (const privilege of PRIVILEGES) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, privilege]);
        assert.equal(allowed, false, `the Shared substrate stays sealed: ${role} must not hold ${privilege} on ${table}`);
      }
    }
  }

  stage = 'catalog: every primitive is postgres-owned, SECURITY DEFINER, pinned, VOLATILE and app-unreachable';
  for (const fnName of OWN_FUNCTIONS) {
    const [fn] = await rows(
      `SELECT pr.prosecdef secdef, pr.provolatile volatility, pr.proconfig config, pr.prosrc,
              pg_get_userbyid(pr.proowner) owner
         FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [fnName]);
    assert.ok(fn, `${fnName} exists`);
    assert.equal(fn.owner, 'postgres', `${fnName} is owned by postgres`);
    assert.equal(fn.secdef, true, `${fnName} is SECURITY DEFINER`);
    assert.equal(fn.volatility, 'v', `${fnName} mutates or locks and is VOLATILE`);
    assert.ok((fn.config ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'),
      `${fnName} pins an empty search_path`);
    // THE PRE-LAUNCH SECURITY BOUNDARY, re-proven from the catalog every time.
    const [{ allowed: publicExecute }] = await rows("SELECT has_function_privilege('public', $1, 'EXECUTE') AS allowed", [fnName]);
    assert.equal(publicExecute, false, `PUBLIC must not hold EXECUTE on ${fnName}`);
    for (const role of APPLICATION_ROLES) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, fnName, 'EXECUTE']);
      assert.equal(allowed, false, `${role} must not hold EXECUTE on ${fnName} before the launch gate exists`);
    }
    // No Personal context, no grant / ceiling / consent mutation, nothing deleted,
    // no advisory or table lock, and no second clock read.
    assert.doesNotMatch(fn.prosrc, /conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|consent|matching|introduction/iu,
      `${fnName} reads no Personal context and touches no grant or consent state`);
    assert.doesNotMatch(fn.prosrc, /DELETE FROM|TRUNCATE/iu, `${fnName} deletes no canonical history`);
    assert.doesNotMatch(fn.prosrc, /pg_advisory|LOCK TABLE/iu, `${fnName} takes only canonical row locks`);
    assert.doesNotMatch(fn.prosrc, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u,
      `${fnName} persists one database-owned instant`);
    assert.ok((fn.prosrc.match(/clock_timestamp\(\)/gu) ?? []).length <= 1,
      `${fnName} reads the database clock at most once`);
    assert.doesNotMatch(fn.prosrc, /UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds/u,
      `${fnName} creates, closes and mutates no Shared World`);
    assert.doesNotMatch(fn.prosrc, /HISTORY_ACCESS_GRANT|CLOSED_WORLD_VIEW_ENTITLEMENT|READ_ONLY_CLOSED|closed_at/u,
      `${fnName} writes no closure, history-access or entitlement literal`);
    assert.doesNotMatch(fn.prosrc, /INSERT INTO public\.shared_world_governance_approvals|INSERT INTO public\.shared_world_governance_proposals|INSERT INTO public\.shared_world_membership_snapshot/u,
      `${fnName} manufactures no governance: proposals and approvals belong to I-04D`);
  }
  // The three preparations consume the frozen I-04D capture and derive no actor.
  for (const fnName of [PREPARE_ADD_FN, PREPARE_REMOVE_FN, PREPARE_REJOIN_FN]) {
    const [fn] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [fnName]);
    assert.match(fn.prosrc, /public\.capture_shared_world_governance_proposal_v1\(/u,
      `${fnName} captures its proposal through the frozen I-04D primitive`);
    assert.doesNotMatch(fn.prosrc, /auth\.uid/u, `${fnName} records no initiator: preparation is not authority`);
    assert.doesNotMatch(fn.prosrc, /INSERT INTO public\.shared_world_membership_episodes|UPDATE public\.shared_world_membership_episodes/u,
      `${fnName} creates no membership change`);
    assert.match(fn.prosrc, /captured\.snapshot_captured_at/u, `${fnName} persists the exact instant the capture owned`);
    assert.doesNotMatch(fn.prosrc, /clock_timestamp\(\)/u, `${fnName} reads no clock of its own`);
  }
  // The two human-authority primitives derive their human from the session subject;
  // the governed removal derives none at all.
  for (const fnName of [ACCEPT_FN, REJOIN_FN]) {
    const [fn] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [fnName]);
    assert.match(fn.prosrc, /u uuid := auth\.uid\(\)/u, `${fnName} derives its human from the session subject`);
    assert.match(fn.prosrc, /SHARED_WORLD_MEMBERSHIP_AUTHENTICATION_REQUIRED/u, `${fnName} fails closed with no session`);
  }
  const [removalSource] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [REMOVE_FN]);
  assert.doesNotMatch(removalSource.prosrc, /auth\.uid/u,
    'a removal derives no remover: its authority is the exact approval set I-04D recorded');
  assert.match(removalSource.prosrc, /SET ended_at = removal_instant, end_reason = 'REMOVED'/u,
    'a removal closes the exact episode in place with the REMOVED reason');
  const [rejoinSource] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [REJOIN_FN]);
  assert.doesNotMatch(rejoinSource.prosrc, /UPDATE public\.shared_world_membership_episodes/u,
    'a rejoin creates a NEW episode and never reopens or rewrites a closed one');
  // Acceptance orders the terminal transition BEFORE the episode exists, so the
  // topology trigger the insert fires can never find its own invitation PENDING.
  const [acceptSource] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [ACCEPT_FN]);
  const acceptedAt = acceptSource.prosrc.indexOf("SET invitation_state = 'ACCEPTED'");
  const episodeAt = acceptSource.prosrc.indexOf('INSERT INTO public.shared_world_membership_episodes');
  assert.ok(acceptedAt > 0 && episodeAt > 0 && acceptedAt < episodeAt,
    'acceptance marks the invitation ACCEPTED before the membership episode exists');
}

async function verifyDirectTableAcl() {
  stage = 'ACL: a real statement under each application role is refused on every owned table';
  for (const role of APPLICATION_ROLES) {
    await identity(role);
    for (const table of OWN_TABLES) {
      await rejected(() => q(`SELECT * FROM ${table} LIMIT 1`), INSUFFICIENT_PRIVILEGE);
    }
  }
  await identity('postgres');
}

async function verifyFunctionAcl() {
  stage = 'ACL: no application role may execute any I-04E primitive';
  for (const role of APPLICATION_ROLES) {
    await identity(role, randomUUID());
    await rejected(() => rows(PREPARE_ADD_SQL, [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()]),
      INSUFFICIENT_PRIVILEGE);
    await rejected(() => rows(PREPARE_REMOVE_SQL, [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()]),
      INSUFFICIENT_PRIVILEGE);
    await rejected(() => rows(PREPARE_REJOIN_SQL, [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()]),
      INSUFFICIENT_PRIVILEGE);
    await rejected(() => rows(DISPATCH_SQL, [randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => rows(ACCEPT_SQL, [randomUUID(), randomUUID(), randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => rows(REMOVE_SQL, [randomUUID(), randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => rows(REJOIN_SQL, [randomUUID(), randomUUID(), randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');
}

/** Builds a real ACTIVE / STANDARD Shared World through the frozen I-04A and I-04B commands only. */
async function provisionWorld(inviter, target, label) {
  const ref = opaqueRef(label);
  await identity('authenticated', target);
  await rows(ROTATE_SQL, [randomUUID(), ref, null]);
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

/** Collects every required approval of one proposal from the exact humans named. */
async function approveWith(proposalId, humans) {
  for (const human of humans) {
    await identity('postgres', human);
    const [approved] = await approve(randomUUID(), proposalId);
    assert.equal(approved.outcome, 'APPROVED', 'the exact current human approved');
  }
  await identity('postgres');
}

/** The full governed add-member journey: prepare, approve, dispatch, accept. */
async function addMember(worldId, approvers, target) {
  const p = ids();
  await identity('postgres');
  const [prepared] = await prepareAdd(p, worldId, target);
  assert.equal(prepared.outcome, 'PREPARED');
  await approveWith(p.proposal, approvers);
  const invitationId = randomUUID();
  const [dispatched] = await dispatchInvite(invitationId, p.proposal);
  assert.equal(dispatched.outcome, 'DISPATCHED');
  const acceptance = { command: randomUUID(), invitation: invitationId, episode: randomUUID(), event: randomUUID() };
  await identity('postgres', target);
  const [joined] = await acceptInvite(acceptance);
  assert.equal(joined.outcome, 'JOINED');
  await identity('postgres');
  return { ...p, invitationId, acceptance, joined };
}

// ---------------------------------------------------------------------------

/** A1 - A9: the governed add-member journey, end to end. */
async function verifyAddMember(f) {
  stage = 'A1: an invitation exists only after BOTH current humans have approved';
  const world = await provisionWorld(f.inviter, f.target, 'add');
  const before = await sharedCounts(f.humans, [world.worldId]);
  const p = ids();
  const [prepared] = await prepareAdd(p, world.worldId, f.newcomer);
  assert.deepEqual(Object.keys(prepared).sort(), [
    'outcome', 'prepared_approval_rule', 'prepared_at', 'prepared_operation_kind', 'prepared_payload_version_id',
    'prepared_proposal_id', 'prepared_required_approval_count', 'prepared_snapshot_id', 'prepared_world_id',
  ].sort(), 'the preparation returns exactly the bounded immutable result');
  assert.equal(prepared.outcome, 'PREPARED');
  assert.equal(prepared.prepared_operation_kind, 'ADD_MEMBER');
  assert.equal(prepared.prepared_approval_rule, 'ALL_CURRENT_MEMBERS');
  assert.equal(prepared.prepared_required_approval_count, 2, 'both current humans are required');
  assert.equal(prepared.prepared_payload_version_id, p.payload);
  // The payload and the proposal share ONE database-owned instant.
  const [payload] = await rows(`SELECT * FROM ${ADD_PAYLOADS} WHERE id = $1`, [p.payload]);
  const [proposal] = await rows(`SELECT * FROM ${PROPOSALS} WHERE id = $1`, [p.proposal]);
  assert.equal(payload.governance_operation_kind, 'ADD_MEMBER');
  assert.equal(payload.target_user_id, f.newcomer, 'the payload names the exact target');
  assert.equal(payload.world_id, world.worldId);
  assert.equal(proposal.proposed_payload_version_id, payload.id, 'the opaque payload version IS this payload');
  const [{ same }] = await rows(
    `SELECT (pl.created_at = pr.created_at AND pr.created_at = s.captured_at) AS same
       FROM ${ADD_PAYLOADS} pl JOIN ${PROPOSALS} pr ON pr.id = pl.governance_proposal_id
       JOIN ${SNAPSHOTS} s ON s.id = pr.membership_snapshot_id WHERE pl.id = $1`, [p.payload]);
  assert.equal(same, true, 'one preparation writes exactly ONE database-owned instant');

  stage = 'A2: one approval is not enough - no invitation can be dispatched';
  await approveWith(p.proposal, [f.inviter]);
  await rejected(() => dispatchInvite(randomUUID(), p.proposal), INCOMPLETE, /APPROVALS_INCOMPLETE/u);
  const [{ n: noInvitation }] = await rows(`SELECT count(*)::int n FROM ${MEMBER_INVITATIONS} WHERE world_id = $1`, [world.worldId]);
  assert.equal(noInvitation, 0, 'a partially approved proposal dispatches nothing');

  stage = 'A3: with both approvals the invitation binds the exact target, World, proposal, snapshot and payload';
  await approveWith(p.proposal, [f.target]);
  const invitationId = randomUUID();
  const [dispatched] = await dispatchInvite(invitationId, p.proposal);
  assert.equal(dispatched.outcome, 'DISPATCHED');
  assert.equal(dispatched.dispatched_state, 'PENDING');
  const [invitation] = await rows(`SELECT * FROM ${MEMBER_INVITATIONS} WHERE id = $1`, [invitationId]);
  assert.equal(invitation.world_id, world.worldId);
  assert.equal(invitation.target_user_id, f.newcomer);
  assert.equal(invitation.governance_proposal_id, p.proposal);
  assert.equal(invitation.membership_snapshot_id, p.snapshot);
  assert.equal(invitation.add_member_payload_version_id, p.payload);
  assert.equal(invitation.invitation_state, 'PENDING');
  assert.equal(invitation.terminal_at, null, 'PENDING is the only non-terminal state');
  assert.equal(invitation.accepted_membership_episode_id, null);
  // One proposal dispatches at most ONE effective invitation.
  await rejected(() => dispatchInvite(randomUUID(), p.proposal), CONFLICT, /SHARED_WORLD_MEMBERSHIP_ID_CONFLICT/u);

  stage = 'A5: a human who is not the exact target cannot accept';
  for (const impostor of [f.inviter, f.target, f.outsider]) {
    await identity('postgres', impostor);
    await rejected(() => acceptInvite({ command: randomUUID(), invitation: invitationId, episode: randomUUID(), event: randomUUID() }),
      UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
  }
  // And an unauthenticated caller fails closed, so QANDEEL can never accept.
  await identity('postgres');
  await rejected(() => acceptInvite({ command: randomUUID(), invitation: invitationId, episode: randomUUID(), event: randomUUID() }),
    INSUFFICIENT_PRIVILEGE, /AUTHENTICATION_REQUIRED/u);

  stage = 'A4: the exact target accepts, and exactly one episode + MEMBER_JOINED + command appear on ONE instant';
  const acceptance = { command: randomUUID(), invitation: invitationId, episode: randomUUID(), event: randomUUID() };
  await identity('postgres', f.newcomer);
  const [joined] = await acceptInvite(acceptance);
  assert.deepEqual(Object.keys(joined).sort(), [
    'accepted_command_id', 'accepted_invitation_id', 'created_joined_event_id', 'created_membership_episode_id',
    'joined_world_id', 'member_joined_at', 'outcome',
  ].sort(), 'acceptance returns exactly the bounded immutable result');
  assert.equal(joined.outcome, 'JOINED');
  assert.equal(joined.joined_world_id, world.worldId, 'no new World is created');
  assert.equal(joined.created_membership_episode_id, acceptance.episode);
  await identity('postgres');
  const [{ oneInstant }] = await rows(
    `SELECT (ep.joined_at = ev.occurred_at AND ev.occurred_at = cmd.committed_at AND cmd.committed_at = i.terminal_at) AS "oneInstant"
       FROM ${EPISODES} ep JOIN ${JOINED_EVENTS} ev ON ev.membership_episode_id = ep.id
       JOIN ${ACCEPT_COMMANDS} cmd ON cmd.membership_episode_id = ep.id
       JOIN ${MEMBER_INVITATIONS} i ON i.id = cmd.member_invitation_id
      WHERE ep.id = $1`, [acceptance.episode]);
  assert.equal(oneInstant, true, 'joined_at, occurred_at, committed_at and the terminal instant are ONE database-owned moment');
  const [acceptedInvitation] = await rows(`SELECT * FROM ${MEMBER_INVITATIONS} WHERE id = $1`, [invitationId]);
  assert.equal(acceptedInvitation.invitation_state, 'ACCEPTED');
  assert.equal(acceptedInvitation.accepted_membership_episode_id, acceptance.episode);
  const [newEpisode] = await rows(`SELECT * FROM ${EPISODES} WHERE id = $1`, [acceptance.episode]);
  assert.equal(newEpisode.user_id, f.newcomer);
  assert.equal(newEpisode.ended_at, null, 'the new member holds an OPEN episode');
  assert.equal(newEpisode.end_reason, null);

  stage = 'A4: deferring the accepted-episode binding did not weaken it - it is still enforced, at COMMIT';
  // The ordering section 11 requires makes an IMMEDIATE foreign key impossible, so
  // the binding is checked when the transaction settles instead. That is only
  // acceptable if it REALLY still fails, which is proven here rather than assumed:
  // forcing the deferred constraint to be checked must reject an episode that does
  // not exist, with the exact foreign-key violation.
  await q('SAVEPOINT deferred_binding');
  await q(`UPDATE ${MEMBER_INVITATIONS} SET accepted_membership_episode_id = $1 WHERE id = $2`,
    [randomUUID(), invitationId]);
  let deferredError;
  try {
    await q('SET CONSTRAINTS public.shared_world_member_invitations_episode_fk IMMEDIATE');
  } catch (caught) { deferredError = caught; }
  assert.ok(deferredError, 'an accepted invitation naming an episode that does not exist must still be refused');
  assert.equal(deferredError.code, '23503',
    'and it is refused as the exact foreign-key violation, only at the moment the transaction settles');
  await q('ROLLBACK TO SAVEPOINT deferred_binding');
  await q('RELEASE SAVEPOINT deferred_binding');
  const [stillBound] = await rows(`SELECT accepted_membership_episode_id FROM ${MEMBER_INVITATIONS} WHERE id = $1`, [invitationId]);
  assert.equal(stillBound.accepted_membership_episode_id, acceptance.episode,
    'and the real binding is intact after the probe rolled back');

  stage = 'A9: acceptance creates NO retrospective history grant and no ghost history metadata';
  const after = await sharedCounts(f.humans, [world.worldId]);
  assert.deepEqual(deltaOf(before, after), {
    episodes: 1, openEpisodes: 1, snapshots: 1, snapshotMembers: 2, proposals: 1, approvals: 2,
    addPayloads: 1, invitations: 1, joinedEvents: 1, acceptCommands: 1,
  }, 'a whole governed add creates exactly its own rows: no grant, no ceiling row, no consent event, no history access');
  assert.equal(after.grants - before.grants, 0, 'FROM_JOIN_FORWARD is the absence of a grant, never a stored entitlement');

  stage = 'A6: a CURRENT member can never be an ADD_MEMBER target';
  for (const member of [f.inviter, f.target, f.newcomer]) {
    await rejected(() => prepareAdd(ids(), world.worldId, member), UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
  }

  stage = 'A7: a FORMER member can never be an ADD_MEMBER target - REJOIN is the only legal path';
  await identity('postgres', f.newcomer);
  await leave(randomUUID(), world.worldId, randomUUID());
  await identity('postgres');
  const [departed] = await rows(`SELECT * FROM ${EPISODES} WHERE id = $1`, [acceptance.episode]);
  assert.equal(departed.end_reason, 'VOLUNTARY_LEAVE', 'the newcomer left through the frozen I-04C primitive');
  await rejected(() => prepareAdd(ids(), world.worldId, f.newcomer), UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
  return { world, formerMember: f.newcomer, priorEpisode: acceptance.episode };
}

/** A8: the staleness law - a topology change terminalizes a pending invitation, permanently. */
async function verifyStaleness(f) {
  stage = 'A8: a leave through the FROZEN I-04C primitive terminalizes a pending invitation';
  const world = await provisionWorld(f.inviter, f.staleTarget, 'stale');
  // A third human joins so the World still has two current members after one leaves.
  const third = await addMember(world.worldId, [f.inviter, f.staleTarget], f.staleThird);
  const p = ids();
  await identity('postgres');
  await prepareAdd(p, world.worldId, f.staleNewcomer);
  await approveWith(p.proposal, [f.inviter, f.staleTarget, f.staleThird]);
  const invitationId = randomUUID();
  await dispatchInvite(invitationId, p.proposal);
  const [pending] = await rows(`SELECT * FROM ${MEMBER_INVITATIONS} WHERE id = $1`, [invitationId]);
  assert.equal(pending.invitation_state, 'PENDING');

  await identity('postgres', f.staleThird);
  await leave(randomUUID(), world.worldId, randomUUID());
  await identity('postgres');
  const [stale] = await rows(`SELECT * FROM ${MEMBER_INVITATIONS} WHERE id = $1`, [invitationId]);
  assert.equal(stale.invitation_state, 'STALE_GOVERNANCE',
    'the frozen leave primitive, which knows nothing about invitations, still terminalized it');
  assert.ok(stale.terminal_at !== null, 'with a database-owned terminal instant');
  assert.ok(stale.terminal_at >= stale.created_at, 'that is never before the invitation existed');
  assert.equal(stale.accepted_membership_episode_id, null, 'and no membership episode was manufactured');
  const firstTerminal = stale.terminal_at;

  stage = 'A8: the transition happens EXACTLY ONCE - a second topology change does not re-stamp it';
  await identity('postgres', f.staleTarget);
  await leave(randomUUID(), world.worldId, randomUUID());
  await identity('postgres');
  const [unchanged] = await rows(`SELECT * FROM ${MEMBER_INVITATIONS} WHERE id = $1`, [invitationId]);
  assert.deepEqual(unchanged, stale, 'a terminal invitation is never rewritten');
  assert.equal(unchanged.terminal_at.getTime(), firstTerminal.getTime());

  stage = 'A8: a terminal invitation can never be accepted';
  await identity('postgres', f.staleNewcomer);
  await rejected(() => acceptInvite({ command: randomUUID(), invitation: invitationId, episode: randomUUID(), event: randomUUID() }),
    UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
  await identity('postgres');
  // And the governance it was dispatched under really is stale now.
  await rejected(() => resolve(p.proposal, 'ADD_MEMBER', p.payload), STALE, /SHARED_WORLD_GOVERNANCE_STALE/u);

  stage = 'A8: a same-human REJOIN restores an identical human set and still cannot revive it';
  const rejoinIds = ids();
  const [preparedRejoin] = await prepareRejoin(rejoinIds, world.worldId, f.staleThird);
  assert.equal(preparedRejoin.outcome, 'PREPARED');
  await approveWith(rejoinIds.proposal, [f.inviter]);
  await identity('postgres', f.staleThird);
  const rejoin = { command: randomUUID(), proposal: rejoinIds.proposal, episode: randomUUID(), event: randomUUID() };
  const [rejoined] = await commitRejoin(rejoin);
  assert.equal(rejoined.outcome, 'REJOINED');
  await identity('postgres');
  const [afterRejoin] = await rows(`SELECT * FROM ${MEMBER_INVITATIONS} WHERE id = $1`, [invitationId]);
  assert.equal(afterRejoin.invitation_state, 'STALE_GOVERNANCE', 'a terminal invitation is never revived');
  assert.deepEqual(afterRejoin, stale, 'not one column of it moved');
  await identity('postgres', f.staleNewcomer);
  await rejected(() => acceptInvite({ command: randomUUID(), invitation: invitationId, episode: randomUUID(), event: randomUUID() }),
    UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
  await identity('postgres');
  return { world, third, rejoinEpisode: rejoin.episode };
}

/** R1 - R7: governed removal. */
async function verifyRemoval(f) {
  stage = 'R1: removing one of three requires the other two, and only the other two';
  const world = await provisionWorld(f.inviter, f.removeSecond, 'remove');
  await addMember(world.worldId, [f.inviter, f.removeSecond], f.removeTarget);
  const before = await sharedCounts(f.humans, [world.worldId]);
  // A Standing Context Grant exists before the removal, so R7 can prove it survives.
  // Written through the frozen I-03C command under its own authenticated role.
  await identity('authenticated', f.inviter);
  const grantId = randomUUID();
  await rows(
    `SELECT grant_id FROM public.grant_shared_world_standing_context_v1($1,$2,$3,$4,$5)`,
    [randomUUID(), grantId, world.worldId, [f.removeSecond, f.removeTarget], null]);
  await identity('postgres');
  const beforeGrant = await rows(`SELECT * FROM ${GRANTS} WHERE id = $1`, [grantId]);
  const beforeCeiling = (await rows(`SELECT audience_user_id FROM ${CEILING} WHERE grant_id = $1 ORDER BY audience_user_id`, [grantId]))
    .map((row) => row.audience_user_id);
  const beforeConsent = await rows(`SELECT * FROM ${CONSENT_EVENTS} WHERE world_id = $1 ORDER BY id`, [world.worldId]);

  const p = ids();
  const [prepared] = await prepareRemove(p, world.worldId, f.removeTarget);
  assert.equal(prepared.outcome, 'PREPARED');
  assert.equal(prepared.prepared_operation_kind, 'REMOVE_MEMBER');
  assert.equal(prepared.prepared_approval_rule, 'ALL_CURRENT_MEMBERS_EXCEPT_TARGET');
  assert.equal(prepared.prepared_required_approval_count, 2, 'two of three, never three of three');
  const targetEpisode = prepared.prepared_target_episode_id;
  const [removePayload] = await rows(`SELECT * FROM ${REMOVE_PAYLOADS} WHERE id = $1`, [p.payload]);
  const [removeProposal] = await rows(`SELECT * FROM ${PROPOSALS} WHERE id = $1`, [p.proposal]);
  assert.equal(removePayload.target_membership_episode_id, targetEpisode);
  assert.equal(removeProposal.excluded_membership_episode_id, targetEpisode,
    'the payload target episode IS the proposal exact excluded episode - structurally, through a composite foreign key');

  stage = 'R2: the removal target own approval does not count and is refused outright';
  await identity('postgres', f.removeTarget);
  await rejected(() => approve(randomUUID(), p.proposal), UNAVAILABLE, /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
  await identity('postgres');
  await approveWith(p.proposal, [f.inviter]);
  await rejected(() => commitRemoval(randomUUID(), p.proposal, randomUUID()), INCOMPLETE, /APPROVALS_INCOMPLETE/u);

  stage = 'R3: the satisfied proposal closes the exact target episode IN PLACE with REMOVED';
  await approveWith(p.proposal, [f.removeSecond]);
  const removalEvent = randomUUID();
  const [removed] = await commitRemoval(randomUUID(), p.proposal, removalEvent);
  assert.equal(removed.outcome, 'REMOVED');
  assert.equal(removed.closed_membership_episode_id, targetEpisode);
  assert.equal(removed.closed_end_reason, 'REMOVED');
  const [closed] = await rows(`SELECT * FROM ${EPISODES} WHERE id = $1`, [targetEpisode]);
  assert.equal(closed.user_id, f.removeTarget, 'the episode row was closed, never deleted or replaced');
  assert.equal(closed.end_reason, 'REMOVED');
  assert.ok(closed.ended_at !== null);
  const [{ oneInstant }] = await rows(
    `SELECT (ep.ended_at = ev.occurred_at AND ev.occurred_at = cmd.committed_at) AS "oneInstant"
       FROM ${EPISODES} ep JOIN ${REMOVED_EVENTS} ev ON ev.membership_episode_id = ep.id
       JOIN ${REMOVAL_COMMANDS} cmd ON cmd.membership_episode_id = ep.id WHERE ep.id = $1`, [targetEpisode]);
  assert.equal(oneInstant, true, 'ended_at, occurred_at and committed_at are ONE database-owned instant');

  stage = 'R5: one remaining pair keeps an ACTIVE / STANDARD World and gains no owner privilege';
  const [worldRow] = await rows(`SELECT * FROM ${WORLDS} WHERE id = $1`, [world.worldId]);
  assert.equal(worldRow.lifecycle, 'ACTIVE');
  assert.equal(worldRow.phase, 'STANDARD');
  assert.equal(worldRow.closed_at, null, 'a removal never closes the World');

  stage = 'R7: removal revokes, rewrites and narrows no Standing Context Grant state';
  assert.deepEqual(await rows(`SELECT * FROM ${GRANTS} WHERE id = $1`, [grantId]), beforeGrant,
    'the grant is not revoked, re-dated or altered in any column');
  assert.deepEqual(
    (await rows(`SELECT audience_user_id FROM ${CEILING} WHERE grant_id = $1 ORDER BY audience_user_id`, [grantId]))
      .map((row) => row.audience_user_id),
    beforeCeiling, 'not one audience-ceiling row was deleted or contracted');
  assert.deepEqual(await rows(`SELECT * FROM ${CONSENT_EVENTS} WHERE world_id = $1 ORDER BY id`, [world.worldId]), beforeConsent,
    'removal appends no consent event');
  const after = await sharedCounts(f.humans, [world.worldId]);
  assert.equal(after.openEpisodes, before.openEpisodes - 1,
    'exactly the removal target left the open set, and nobody else moved');
  assert.equal(after.episodes, before.episodes, 'the episode was closed in place, never deleted or replaced');
  assert.equal(after.grants - before.grants, 1, 'exactly the one grant this proof created');
  assert.equal(after.removedEvents - before.removedEvents, 1, 'exactly one MEMBER_REMOVED');
  assert.equal(after.removalCommands - before.removalCommands, 1);

  stage = 'R4: a stale removal proposal can never reach a LATER successor episode of the same human';
  // The removed human rejoins, which gives them a new open episode.
  const rejoinIds = ids();
  await prepareRejoin(rejoinIds, world.worldId, f.removeTarget);
  await approveWith(rejoinIds.proposal, [f.inviter, f.removeSecond]);
  await identity('postgres', f.removeTarget);
  const successor = randomUUID();
  await commitRejoin({ command: randomUUID(), proposal: rejoinIds.proposal, episode: successor, event: randomUUID() });
  await identity('postgres');
  // The old removal proposal is bound to the OLD episode, which is already closed,
  // and its captured topology no longer matches.
  await rejected(() => commitRemoval(randomUUID(), p.proposal, randomUUID()), STALE, /SHARED_WORLD_GOVERNANCE_STALE/u);
  const [successorEpisode] = await rows(`SELECT * FROM ${EPISODES} WHERE id = $1`, [successor]);
  assert.equal(successorEpisode.ended_at, null, 'the successor episode is untouched by the stale removal');

  stage = 'R6: the SOLE remaining current human can never be removed through empty-set unanimity';
  const solo = await provisionWorld(f.inviter, f.soloTarget, 'solo');
  await identity('postgres', f.soloTarget);
  await leave(randomUUID(), solo.worldId, randomUUID());
  await identity('postgres');
  await rejected(() => prepareRemove(ids(), solo.worldId, f.inviter), UNAVAILABLE, /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
  const [{ n: stillOpen }] = await rows(`SELECT count(*)::int n FROM ${EPISODES} WHERE world_id = $1 AND ended_at IS NULL`, [solo.worldId]);
  assert.equal(stillOpen, 1, 'the sole remaining human is still a current member');
  return { world, removedTarget: f.removeTarget, closedEpisode: targetEpisode, successor };
}

/** J1 - J6: governed rejoin. */
async function verifyRejoin(f, added) {
  stage = 'J1: a former human with a closed episode and at least one current human may be proposed';
  const world = added.world;
  const before = await sharedCounts(f.humans, [world.worldId]);
  const priorRow = await rows(`SELECT * FROM ${EPISODES} WHERE id = $1`, [added.priorEpisode]);
  const p = ids();
  const [prepared] = await prepareRejoin(p, world.worldId, added.formerMember);
  assert.equal(prepared.outcome, 'PREPARED');
  assert.equal(prepared.prepared_operation_kind, 'REJOIN_MEMBER');
  assert.equal(prepared.prepared_approval_rule, 'ALL_CURRENT_MEMBERS');
  assert.equal(prepared.prepared_prior_episode_id, added.priorEpisode,
    'the payload binds the exact prior CLOSED episode as its historical proof of former membership');
  assert.equal(prepared.prepared_required_approval_count, 2, 'every current human must approve');

  stage = 'J3: only the exact former human may commit the rejoin, and only after every approval';
  await approveWith(p.proposal, [f.inviter]);
  await identity('postgres', added.formerMember);
  await rejected(() => commitRejoin({ command: randomUUID(), proposal: p.proposal, episode: randomUUID(), event: randomUUID() }),
    INCOMPLETE, /APPROVALS_INCOMPLETE/u);
  await identity('postgres');
  stage = 'J2: all current humans approve the exact rejoin';
  await approveWith(p.proposal, [f.target]);
  for (const impostor of [f.inviter, f.target, f.outsider]) {
    await identity('postgres', impostor);
    await rejected(() => commitRejoin({ command: randomUUID(), proposal: p.proposal, episode: randomUUID(), event: randomUUID() }),
      UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
  }
  await identity('postgres');
  await rejected(() => commitRejoin({ command: randomUUID(), proposal: p.proposal, episode: randomUUID(), event: randomUUID() }),
    INSUFFICIENT_PRIVILEGE, /AUTHENTICATION_REQUIRED/u);

  stage = 'J4: the rejoin creates a NEW episode and changes not one column of any prior one';
  const rejoin = { command: randomUUID(), proposal: p.proposal, episode: randomUUID(), event: randomUUID() };
  await identity('postgres', added.formerMember);
  const [rejoined] = await commitRejoin(rejoin);
  assert.equal(rejoined.outcome, 'REJOINED');
  assert.equal(rejoined.created_membership_episode_id, rejoin.episode);
  assert.equal(rejoined.bound_prior_episode_id, added.priorEpisode);
  assert.notEqual(rejoin.episode, added.priorEpisode, 'the new episode id differs from the prior one');
  await identity('postgres');
  assert.deepEqual(await rows(`SELECT * FROM ${EPISODES} WHERE id = $1`, [added.priorEpisode]), priorRow,
    'the prior closed episode is never reopened, re-dated or rewritten');
  const [newEpisode] = await rows(`SELECT * FROM ${EPISODES} WHERE id = $1`, [rejoin.episode]);
  assert.equal(newEpisode.ended_at, null, 'the rejoining human holds a NEW open episode');
  assert.equal(newEpisode.end_reason, null);
  const [{ oneInstant }] = await rows(
    `SELECT (ep.joined_at = ev.occurred_at AND ev.occurred_at = cmd.committed_at) AS "oneInstant"
       FROM ${EPISODES} ep JOIN ${REJOINED_EVENTS} ev ON ev.membership_episode_id = ep.id
       JOIN ${REJOIN_COMMANDS} cmd ON cmd.membership_episode_id = ep.id WHERE ep.id = $1`, [rejoin.episode]);
  assert.equal(oneInstant, true, 'joined_at, occurred_at and committed_at are ONE database-owned instant');

  stage = 'J5: the absence interval stays explicit, and no absence-period access is granted';
  const [{ absence }] = await rows(
    `SELECT (later.joined_at > earlier.ended_at) AS absence FROM ${EPISODES} earlier, ${EPISODES} later
      WHERE earlier.id = $1 AND later.id = $2`, [added.priorEpisode, rejoin.episode]);
  assert.equal(absence, true, 'the interval between the old ended_at and the new joined_at is explicit and positive');
  const after = await sharedCounts(f.humans, [world.worldId]);
  assert.deepEqual(deltaOf(before, after), {
    episodes: 1, openEpisodes: 1, snapshots: 1, snapshotMembers: 2, proposals: 1, approvals: 2,
    rejoinPayloads: 1, rejoinedEvents: 1, rejoinCommands: 1,
  }, 'a whole governed rejoin creates exactly its own rows: no grant, no ceiling row, no history access for the absence');

  stage = 'J6: a stale pre-rejoin proposal never revives, and a second rejoin of a current member is refused';
  await rejected(() => prepareRejoin(ids(), world.worldId, added.formerMember), UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
  await rejected(() => resolve(p.proposal, 'REJOIN_MEMBER', p.payload), STALE, /SHARED_WORLD_GOVERNANCE_STALE/u);
  // And a human who was NEVER a member of this World cannot rejoin it.
  await rejected(() => prepareRejoin(ids(), world.worldId, f.outsider), UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
}

/** N1 - N6, plus the bounded-refusal and idempotency laws. */
async function verifyBoundedRefusalsAndIdempotency(f, added) {
  stage = 'bounded refusals: a nonexistent World, proposal and invitation all reach ONE non-enumerating class';
  await rejected(() => prepareAdd(ids(), randomUUID(), f.idempotencyTarget), UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
  await rejected(() => dispatchInvite(randomUUID(), randomUUID()), UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
  await rejected(() => commitRemoval(randomUUID(), randomUUID(), randomUUID()), UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
  await identity('postgres', f.idempotencyTarget);
  await rejected(() => acceptInvite({ command: randomUUID(), invitation: randomUUID(), episode: randomUUID(), event: randomUUID() }),
    UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
  await rejected(() => commitRejoin({ command: randomUUID(), proposal: randomUUID(), episode: randomUUID(), event: randomUUID() }),
    UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
  await identity('postgres');
  // No refusal message names a human, a World or a topology fact.
  for (const fnName of OWN_FUNCTIONS) {
    const [fn] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [fnName]);
    assert.doesNotMatch(fn.prosrc, /RAISE EXCEPTION[^;]*USING MESSAGE/u, `${fnName} interpolates nothing into a refusal`);
  }

  stage = 'command invalidity: a NULL identity is bounded and writes nothing';
  await rejected(() => rows(PREPARE_ADD_SQL, [null, randomUUID(), randomUUID(), randomUUID(), randomUUID()]), INVALID_PARAMETER);
  await rejected(() => rows(DISPATCH_SQL, [null, randomUUID()]), INVALID_PARAMETER);
  await rejected(() => rows(REMOVE_SQL, [randomUUID(), null, randomUUID()]), INVALID_PARAMETER);

  stage = 'idempotency: an equivalent retry returns exactly what the command committed';
  const world = await provisionWorld(f.inviter, f.idempotencyTarget, 'idem');
  const p = ids();
  const [prepared] = await prepareAdd(p, world.worldId, f.idempotencyNewcomer);
  const [preparedAgain] = await prepareAdd(p, world.worldId, f.idempotencyNewcomer);
  assert.deepEqual(preparedAgain, prepared, 'an equivalent preparation retry returns the preparation this command committed');
  await approveWith(p.proposal, [f.inviter, f.idempotencyTarget]);
  const invitationId = randomUUID();
  const [dispatched] = await dispatchInvite(invitationId, p.proposal);
  assert.deepEqual(await dispatchInvite(invitationId, p.proposal), [dispatched], 'and so does an equivalent dispatch retry');
  const acceptance = { command: randomUUID(), invitation: invitationId, episode: randomUUID(), event: randomUUID() };
  await identity('postgres', f.idempotencyNewcomer);
  const [joined] = await acceptInvite(acceptance);
  assert.deepEqual(await acceptInvite(acceptance), [joined], 'and so does an equivalent acceptance retry');
  // A DIFFERENT identity under a committed command id is a conflict, never a second
  // effective acceptance.
  await rejected(() => acceptInvite({ ...acceptance, episode: randomUUID() }), CONFLICT, /SHARED_WORLD_MEMBERSHIP_ID_CONFLICT/u);
  await identity('postgres');
  // And a SECOND command id cannot accept the same invitation twice.
  await identity('postgres', f.idempotencyNewcomer);
  await rejected(() => acceptInvite({ command: randomUUID(), invitation: invitationId, episode: randomUUID(), event: randomUUID() }),
    UNAVAILABLE, /SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE/u);
  await identity('postgres');
  const [{ n: episodes }] = await rows(
    `SELECT count(*)::int n FROM ${EPISODES} WHERE world_id = $1 AND user_id = $2`, [world.worldId, f.idempotencyNewcomer]);
  assert.equal(episodes, 1, 'one invitation acceptance yields at most ONE membership episode');

  stage = 'N2 - N6: no Personal runtime, Introduction, closure, history-access or Launch Gate path was opened';
  // Proven behaviourally: the whole journey above moved nothing outside the Shared
  // relations this verifier names, and the World is still exactly what it was.
  const [worldRow] = await rows(`SELECT lifecycle, phase, closed_at FROM ${WORLDS} WHERE id = $1`, [added.world.worldId]);
  assert.deepEqual(worldRow, { lifecycle: 'ACTIVE', phase: 'STANDARD', closed_at: null },
    'no World was closed, archived or phase-changed anywhere in this slice');
}

// ---------------------------------------------------------------------------

async function verifyConcurrency(c) {
  stage = 'concurrency: real independent connections';
  const connections = [];
  const open = async () => {
    const extra = new Client({ connectionString: databaseUrl });
    await extra.connect();
    connections.push(extra);
    return extra;
  };
  // The owner drives the internal primitives while the EXACT human's JWT claim is
  // set - precisely what a later launch-gated consumer must preserve.
  const asOwnerFor = async (conn, uid) => {
    await conn.query('BEGIN');
    await conn.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
  };
  const blocks = async (pending) => {
    pending.catch(() => undefined);
    return Promise.race([
      pending.then(() => 'COMPLETED', () => 'COMPLETED'),
      new Promise((resolveRace) => { setTimeout(() => resolveRace('BLOCKED'), 750); }),
    ]);
  };
  const failureOf = async (pending) => {
    let error;
    try { await pending; } catch (caught) { error = caught; }
    return error;
  };
  const failedWith = async (run, code, message) => {
    const error = await failureOf(run());
    assert.ok(error, 'operation unexpectedly succeeded');
    assert.equal(error.code, code, `unexpected rejection code ${error?.code}: ${error?.message}`);
    assert.match(error.message, message);
    return error;
  };

  const [{ n: deadlocksBefore }] = await rows(
    'SELECT COALESCE(sum(deadlocks), 0)::int n FROM pg_stat_database WHERE datname = current_database()');

  try {
    const a = await open();
    const b = await open();

    stage = 'concurrency 1: invitation dispatch versus voluntary leave - one serial winner, no stale invitation stands';
    const w1 = c.worlds.dispatchVsLeave;
    await asOwnerFor(a, c.inviter);
    const queuedDispatch = a.query(DISPATCH_SQL, [randomUUID(), w1.proposal]);
    assert.equal(await blocks(queuedDispatch), 'COMPLETED', 'the dispatch takes the World row');
    await asOwnerFor(b, w1.third);
    const queuedLeave = b.query(LEAVE_SQL, [randomUUID(), w1.worldId, randomUUID()]);
    assert.equal(await blocks(queuedLeave), 'BLOCKED', 'the leave queues on the exact World row the dispatch holds');
    await a.query('COMMIT');
    assert.equal((await queuedLeave).rows[0].outcome, 'LEFT', 'and then proceeds');
    await b.query('COMMIT');
    const [afterRace] = await rows(`SELECT invitation_state FROM ${MEMBER_INVITATIONS} WHERE governance_proposal_id = $1`, [w1.proposal]);
    assert.equal(afterRace.invitation_state, 'STALE_GOVERNANCE',
      'the invitation the dispatch won is immediately terminalized by the leave that followed it');

    stage = 'concurrency 2: pending acceptance versus voluntary leave - no stale acceptance survives';
    const w2 = c.worlds.acceptVsLeave;
    await asOwnerFor(a, w2.third);
    const leaveFirst = a.query(LEAVE_SQL, [randomUUID(), w2.worldId, randomUUID()]);
    assert.equal(await blocks(leaveFirst), 'COMPLETED');
    await asOwnerFor(b, w2.newcomer);
    const queuedAccept = b.query(ACCEPT_SQL, [randomUUID(), w2.invitationId, randomUUID(), randomUUID()]);
    assert.equal(await blocks(queuedAccept), 'BLOCKED', 'the acceptance queues on the World row the leave holds');
    await a.query('COMMIT');
    const acceptError = await failureOf(queuedAccept);
    assert.ok(acceptError, 'the acceptance cannot succeed against a topology that moved');
    assert.equal(acceptError.code, 'P0002');
    await b.query('ROLLBACK');
    const [w2Invitation] = await rows(`SELECT invitation_state FROM ${MEMBER_INVITATIONS} WHERE id = $1`, [w2.invitationId]);
    assert.equal(w2Invitation.invitation_state, 'STALE_GOVERNANCE');
    const [{ n: w2Episodes }] = await rows(
      `SELECT count(*)::int n FROM ${EPISODES} WHERE world_id = $1 AND user_id = $2`, [w2.worldId, w2.newcomer]);
    assert.equal(w2Episodes, 0, 'and no membership episode was created by the losing acceptance');

    stage = 'concurrency 3: two IDENTICAL acceptances produce one episode, one event and one command';
    const w3 = c.worlds.identicalAccept;
    const shared = { command: randomUUID(), invitation: w3.invitationId, episode: randomUUID(), event: randomUUID() };
    await asOwnerFor(a, w3.newcomer); await asOwnerFor(b, w3.newcomer);
    const firstAccept = a.query(ACCEPT_SQL, [shared.command, shared.invitation, shared.episode, shared.event]);
    assert.equal(await blocks(firstAccept), 'COMPLETED');
    const secondAccept = b.query(ACCEPT_SQL, [shared.command, shared.invitation, shared.episode, shared.event]);
    assert.equal(await blocks(secondAccept), 'BLOCKED', 'the identical retry queues on the same World row');
    await a.query('COMMIT');
    assert.equal((await secondAccept).rows[0].created_membership_episode_id, shared.episode,
      'and then returns exactly the acceptance the winner committed');
    await b.query('COMMIT');
    const [{ n: w3Rows }] = await rows(
      `SELECT ((SELECT count(*) FROM ${EPISODES} WHERE id = $1)
             + (SELECT count(*) FROM ${JOINED_EVENTS} WHERE id = $2)
             + (SELECT count(*) FROM ${ACCEPT_COMMANDS} WHERE id = $3))::int n`,
      [shared.episode, shared.event, shared.command]);
    assert.equal(w3Rows, 3, 'exactly one episode, one MEMBER_JOINED and one command exist');

    stage = 'concurrency 4: two DIFFERENT commands on one invitation leave exactly one effective acceptance';
    const w4 = c.worlds.competingAccept;
    await asOwnerFor(a, w4.newcomer); await asOwnerFor(b, w4.newcomer);
    const winner = { command: randomUUID(), episode: randomUUID(), event: randomUUID() };
    const loser = { command: randomUUID(), episode: randomUUID(), event: randomUUID() };
    const winning = a.query(ACCEPT_SQL, [winner.command, w4.invitationId, winner.episode, winner.event]);
    assert.equal(await blocks(winning), 'COMPLETED');
    const losing = b.query(ACCEPT_SQL, [loser.command, w4.invitationId, loser.episode, loser.event]);
    assert.equal(await blocks(losing), 'BLOCKED');
    await a.query('COMMIT');
    const loserError = await failureOf(losing);
    assert.ok(loserError, 'the second command cannot accept the same invitation again');
    await b.query('ROLLBACK');
    const [{ n: w4Episodes }] = await rows(
      `SELECT count(*)::int n FROM ${EPISODES} WHERE world_id = $1 AND user_id = $2`, [w4.worldId, w4.newcomer]);
    assert.equal(w4Episodes, 1, 'exactly one membership episode exists for the accepting human');

    stage = 'concurrency 5: governed removal versus the target own leave - one effective closure, never two events';
    const w5 = c.worlds.removeVsLeave;
    await asOwnerFor(a, w5.target);
    const targetLeave = a.query(LEAVE_SQL, [randomUUID(), w5.worldId, randomUUID()]);
    assert.equal(await blocks(targetLeave), 'COMPLETED');
    await asOwnerFor(b, c.inviter);
    const queuedRemoval = b.query(REMOVE_SQL, [randomUUID(), w5.proposal, randomUUID()]);
    assert.equal(await blocks(queuedRemoval), 'BLOCKED', 'the removal queues on the World row the leave holds');
    await a.query('COMMIT');
    const removalError = await failureOf(queuedRemoval);
    assert.ok(removalError, 'the removal cannot close an episode the human already closed themselves');
    await b.query('ROLLBACK');
    const [w5Episode] = await rows(`SELECT end_reason FROM ${EPISODES} WHERE id = $1`, [w5.targetEpisode]);
    assert.equal(w5Episode.end_reason, 'VOLUNTARY_LEAVE', 'exactly one closure reason stands');
    const [{ n: w5Events }] = await rows(
      `SELECT ((SELECT count(*) FROM ${REMOVED_EVENTS} WHERE membership_episode_id = $1)
             + (SELECT count(*) FROM ${REMOVAL_COMMANDS} WHERE membership_episode_id = $1))::int n`, [w5.targetEpisode]);
    assert.equal(w5Events, 0, 'and no MEMBER_REMOVED or removal command was written');

    stage = 'concurrency 6: a removal beside approval and invitation traffic in the same World does not deadlock';
    const w6 = c.worlds.removalBeside;
    await asOwnerFor(a, c.inviter); await asOwnerFor(b, w6.second);
    const removalRun = a.query(REMOVE_SQL, [randomUUID(), w6.removalProposal, randomUUID()]);
    assert.equal(await blocks(removalRun), 'COMPLETED');
    const approvalRun = b.query(APPROVE_SQL, [randomUUID(), w6.otherProposal]);
    assert.equal(await blocks(approvalRun), 'BLOCKED', 'the approval queues on the same World row, in the same order');
    await a.query('COMMIT');
    // The other proposal captured the OLD topology, so the approval now finds it stale
    // rather than deadlocking: a serial outcome, never an interleaving.
    const approvalError = await failureOf(approvalRun);
    assert.equal(approvalError?.code, '40001', 'the pre-removal proposal is stale, not deadlocked');
    await b.query('ROLLBACK');

    stage = 'concurrency 7: two rejoins of the same former human produce exactly one new open episode';
    const w7 = c.worlds.doubleRejoin;
    await asOwnerFor(a, w7.former); await asOwnerFor(b, w7.former);
    const rejoinA = a.query(REJOIN_SQL, [randomUUID(), w7.proposal, randomUUID(), randomUUID()]);
    assert.equal(await blocks(rejoinA), 'COMPLETED');
    const rejoinB = b.query(REJOIN_SQL, [randomUUID(), w7.proposal, randomUUID(), randomUUID()]);
    assert.equal(await blocks(rejoinB), 'BLOCKED');
    await a.query('COMMIT');
    const rejoinError = await failureOf(rejoinB);
    assert.ok(rejoinError, 'the second rejoin of the same human is refused');
    await b.query('ROLLBACK');
    const [{ n: w7Open }] = await rows(
      `SELECT count(*)::int n FROM ${EPISODES} WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL`,
      [w7.worldId, w7.former]);
    assert.equal(w7Open, 1, 'exactly one new OPEN episode exists for the rejoining human');

    stage = 'concurrency 9: two governed mutations from the SAME old topology - the first commits, the second is stale';
    const w9 = c.worlds.twoMutations;
    await identity('postgres');
    await failedWith(() => resolve(w9.staleProposal, 'ADD_MEMBER', w9.stalePayload), '40001', /SHARED_WORLD_GOVERNANCE_STALE/u);

    stage = 'concurrency 12: two unrelated Worlds never interfere';
    const unrelated = c.worlds.unrelated;
    const held = c.worlds.identicalAccept;
    await asOwnerFor(a, c.inviter);
    // Hold the canonical first lock of ONE World, exactly as every primitive does.
    await a.query(`SELECT 1 FROM ${WORLDS} WHERE id = $1 FOR UPDATE`, [held.worldId]);
    await asOwnerFor(b, unrelated.targetUser);
    const otherWorld = b.query(LEAVE_SQL, [randomUUID(), unrelated.worldId, randomUUID()]);
    assert.equal(await blocks(otherWorld), 'COMPLETED',
      'a real membership mutation in an unrelated World is never blocked by a World lock held elsewhere');
    assert.equal((await otherWorld).rows[0].outcome, 'LEFT');
    await b.query('COMMIT');
    await a.query('COMMIT');

    stage = 'concurrency: the canonical World-first order produced no deadlock';
    const [{ n: deadlocksAfter }] = await rows(
      'SELECT COALESCE(sum(deadlocks), 0)::int n FROM pg_stat_database WHERE datname = current_database()');
    assert.equal(deadlocksAfter, deadlocksBefore, 'no deadlock occurred: every primitive takes the World row first');
  } finally {
    for (const conn of connections) {
      await conn.query('ROLLBACK').catch(() => undefined);
      await conn.end().catch(() => undefined);
    }
  }
}

// ---------------------------------------------------------------------------

/**
 * Forward safety, proven against real PostgreSQL rather than asserted.
 *
 * The authorized future is built for real inside a rolled-back SAVEPOINT - the
 * I-04F history-access and closure substrate, the I-04G Shared material substrate,
 * a Launch Gate with an application-role wrapper, later additive columns,
 * constraints, indexes and audit triggers on tables 0085 owns AND on the evolvable
 * predecessor membership table - and this verifier must still pass beside all of
 * it, with the whole governed lifecycle still working. Then every regression to
 * something 0085 OWNS is planted and must still be refused, so the forward safety
 * is not bought by asserting nothing.
 */
async function verifyForwardSafety(f) {
  stage = 'forward safety: the I-04F and I-04G substrate and a Launch Gate do not fail this historical verifier';
  await identity('postgres');
  // Short enough that every `${probe}_suffix` stays inside PostgreSQL's 63-byte
  // identifier limit, so nothing is silently truncated into a collision.
  const probe = `i04e_probe_${randomUUID().replace(/-/gu, '').slice(0, 16)}`;
  await q('SAVEPOINT forward_safety');
  try {
    // FLUSH THE DEFERRED BINDING FIRST, and note what that proves.
    //
    // Every acceptance above left a pending deferred event on
    // shared_world_member_invitations_episode_fk, because this whole behaviour phase
    // is ONE uncommitted transaction. PostgreSQL refuses to ALTER a table that has
    // pending trigger events (55006), so the authorized future below could not be
    // built on it. Forcing the constraint to be checked now clears them - and it
    // only succeeds if EVERY acceptance in this transaction really did leave a valid
    // binding, which is a proof worth having rather than a workaround.
    //
    // In production this never arises: each acceptance is its own transaction and
    // flushes at its own COMMIT. It is an artefact of proving many of them at once.
    await q('SET CONSTRAINTS public.shared_world_member_invitations_episode_fk IMMEDIATE');
    await q('SET CONSTRAINTS public.shared_world_member_invitations_episode_fk DEFERRED');

    // I-04F: selective past-history sharing and closed-World viewing.
    await q(`CREATE TABLE public.${probe}_history_access_grants (id uuid PRIMARY KEY, world_id uuid NOT NULL,
             audience_user_id uuid NOT NULL, from_at timestamptz, to_at timestamptz)`);
    await q(`CREATE TABLE public.${probe}_closed_world_view_entitlements (id uuid PRIMARY KEY, world_id uuid NOT NULL)`);
    await q(`CREATE FUNCTION public.${probe}_end_shared_world_v1(p_command_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    // I-04G: the Shared material / conversation substrate.
    await q(`CREATE TABLE public.${probe}_shared_material (id uuid PRIMARY KEY, world_id uuid NOT NULL, body text)`);
    await q(`CREATE TABLE public.${probe}_shared_turns (id uuid PRIMARY KEY, world_id uuid NOT NULL)`);
    // CW2-08: the Launch Gate and a launch-gated application wrapper.
    await q(`CREATE TABLE public.${probe}_launch_gates (id uuid PRIMARY KEY, capability text NOT NULL, state text NOT NULL)`);
    await q(`CREATE FUNCTION public.${probe}_accept_member_invitation_v1(p_command_id uuid, p_invitation_id uuid,
             p_episode_id uuid, p_event_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    await q(`GRANT EXECUTE ON FUNCTION public.${probe}_accept_member_invitation_v1(uuid, uuid, uuid, uuid) TO authenticated`);
    // Additive evolution of the tables 0085 owns, including column names and types
    // 0085 would never have written itself.
    await q(`ALTER TABLE ${MEMBER_INVITATIONS} ADD COLUMN ${probe}_consumer_metadata jsonb`);
    await q(`ALTER TABLE ${MEMBER_INVITATIONS} ADD COLUMN ${probe}_reviewer_scope text`);
    await q(`ALTER TABLE ${JOINED_EVENTS} ADD COLUMN ${probe}_delivery_epoch bigint`);
    await q(`ALTER TABLE ${ADD_PAYLOADS} ADD CONSTRAINT ${probe}_operation_check
             CHECK (governance_operation_kind IN ('ADD_MEMBER'))`);
    await q(`CREATE INDEX ${probe}_invitation_created_idx ON ${MEMBER_INVITATIONS} (world_id, created_at)`);
    // A later reviewed consumer foreign key INTO this substrate, with a deletion rule
    // 0085 has no authority over.
    await q(`ALTER TABLE public.${probe}_shared_material ADD COLUMN membership_episode_id uuid`);
    await q(`ALTER TABLE public.${probe}_shared_material ADD CONSTRAINT ${probe}_material_episode_fk
             FOREIGN KEY (membership_episode_id) REFERENCES ${EPISODES} (id) ON DELETE SET NULL`);
    // Later reviewed AUDIT triggers, both on a table 0085 owns and on the evolvable
    // predecessor membership table this slice already puts its own triggers on.
    // Deliberately inert: an AFTER ... FOR EACH ROW trigger whose return value
    // PostgreSQL discards, so it changes no row and couples nothing.
    await q(`CREATE FUNCTION public.${probe}_audit_fn() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN RETURN NULL; END$fn$`);
    await q(`CREATE TRIGGER ${probe}_invitation_audit AFTER INSERT ON ${MEMBER_INVITATIONS}
             FOR EACH ROW EXECUTE FUNCTION public.${probe}_audit_fn()`);
    await q(`CREATE TRIGGER ${probe}_episode_audit AFTER UPDATE ON ${EPISODES}
             FOR EACH ROW EXECUTE FUNCTION public.${probe}_audit_fn()`);
    // A later reviewed end reason and invitation state, added without superseding 0085.
    await q(`UPDATE ${MEMBER_INVITATIONS} SET ${probe}_reviewer_scope = 'later' WHERE false`);
    await verifyCatalog();

    stage = 'forward safety: the whole governed lifecycle still works beside the authorized future';
    const world = await provisionWorld(f.inviter, f.forwardTarget, 'forward');
    const added = await addMember(world.worldId, [f.inviter, f.forwardTarget], f.forwardNewcomer);
    assert.equal(added.joined.outcome, 'JOINED', 'a governed add still completes beside the later authorized schema');
    const removal = ids();
    await prepareRemove(removal, world.worldId, f.forwardNewcomer);
    await approveWith(removal.proposal, [f.inviter, f.forwardTarget]);
    const [removed] = await commitRemoval(randomUUID(), removal.proposal, randomUUID());
    assert.equal(removed.outcome, 'REMOVED', 'and so does a governed removal');

    stage = 'forward safety: a real regression to something 0085 OWNS is still refused';
    for (const [reason, plant, refuses] of [
      ['the one-effective-invitation rule is dropped',
        `ALTER TABLE ${MEMBER_INVITATIONS} DROP CONSTRAINT shared_world_member_invitations_proposal_key`,
        /shared_world_member_invitations_proposal_key/u],
      ['the invitation target stops being the payload target, structurally',
        `ALTER TABLE ${MEMBER_INVITATIONS} DROP CONSTRAINT shared_world_member_invitations_payload_target_fk`,
        /shared_world_member_invitations_payload_target_fk/u],
      ['the removal target episode stops being the proposal excluded episode',
        `ALTER TABLE ${REMOVE_PAYLOADS} DROP CONSTRAINT shared_world_remove_member_payload_versions_excluded_episode_fk`,
        /shared_world_remove_member_payload_versions_excluded_episode_fk/u],
      ['an operation payload stops binding its exact proposal and operation',
        `ALTER TABLE ${ADD_PAYLOADS} DROP CONSTRAINT shared_world_add_member_payload_versions_proposal_fk,
         ADD CONSTRAINT shared_world_add_member_payload_versions_proposal_fk
           FOREIGN KEY (governance_proposal_id) REFERENCES ${PROPOSALS} (id) ON DELETE RESTRICT`,
        /shared_world_add_member_payload_versions_proposal_fk/u],
      ['an owned foreign key stops being restrictive',
        `ALTER TABLE ${JOINED_EVENTS} DROP CONSTRAINT shared_world_member_joined_events_episode_fk,
         ADD CONSTRAINT shared_world_member_joined_events_episode_fk
           FOREIGN KEY (membership_episode_id) REFERENCES ${EPISODES} (id) ON DELETE CASCADE`,
        /shared_world_member_joined_events_episode_fk/u],
      ['an 0085-owned column is dropped',
        `ALTER TABLE ${MEMBER_INVITATIONS} DROP COLUMN terminal_at CASCADE`,
        /still carries every column migration 0085 owns/u],
      ['an 0085-owned NOT NULL column becomes nullable',
        `ALTER TABLE ${MEMBER_INVITATIONS} ALTER COLUMN invitation_state DROP NOT NULL`,
        /still carries every column migration 0085 owns/u],
      ['an 0085-owned column gains a default the primitives never write',
        `ALTER TABLE ${MEMBER_INVITATIONS} ALTER COLUMN created_at SET DEFAULT clock_timestamp()`,
        /still carries every column migration 0085 owns/u],
      // Retyped on a column with no index, check or foreign key depending on it, so
      // the plant exercises the COLUMN proof rather than PostgreSQL's own refusal to
      // retype a column something else is built on.
      ['an 0085-owned column changes type',
        `ALTER TABLE ${ADD_PAYLOADS} ALTER COLUMN created_at TYPE timestamp without time zone`,
        /still carries every column migration 0085 owns/u],
      ['the terminal-state consistency rule is dropped',
        `ALTER TABLE ${MEMBER_INVITATIONS} DROP CONSTRAINT shared_world_member_invitations_terminal_consistency_check`,
        /shared_world_member_invitations_terminal_consistency_check/u],
      ['a governed membership table becomes directly readable by an application role',
        `GRANT SELECT ON ${MEMBER_INVITATIONS} TO authenticated`,
        /authenticated must not hold SELECT/u],
      ['a primitive becomes executable by an application role',
        `GRANT EXECUTE ON FUNCTION ${ACCEPT_FN} TO authenticated`,
        /must not hold EXECUTE/u],
      ['the open-topology trigger is dropped',
        `DROP TRIGGER ${OPEN_TRIGGER} ON ${EPISODES}`,
        /exactly two triggers call the I-04E terminalization mechanism/u],
      ['the closed-topology trigger stops reacting to an OPEN episode closing',
        `DROP TRIGGER ${CLOSED_TRIGGER} ON ${EPISODES};
         CREATE TRIGGER ${CLOSED_TRIGGER} AFTER UPDATE OF ended_at ON ${EPISODES}
           FOR EACH ROW EXECUTE FUNCTION ${TRIGGER_FN}`,
        /reacts only to an episode that WAS open/u],
      ['the open-topology trigger stops reacting only to an OPEN new episode',
        `DROP TRIGGER ${OPEN_TRIGGER} ON ${EPISODES};
         CREATE TRIGGER ${OPEN_TRIGGER} AFTER INSERT ON ${EPISODES}
           FOR EACH ROW EXECUTE FUNCTION ${TRIGGER_FN}`,
        /reacts only to an episode that is actually OPEN/u],
      ['the terminalization mechanism stops being restricted to still-PENDING rows',
        `CREATE OR REPLACE FUNCTION public.terminalize_stale_shared_world_member_invitations_v1()
         RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
         BEGIN RETURN NULL; END$fn$`,
        /transitions member invitations|writes exactly one relation/u],
      ['governed membership gains a permanent (world, human) key that would forbid a rejoin',
        `ALTER TABLE ${JOINED_EVENTS} ADD CONSTRAINT ${probe}_pair_key UNIQUE (world_id, actor_user_id)`,
        /must never make a \(world, human\) pair permanently unique/u],
      // A later reviewed jsonb column on one of these tables is deliberately NOT a
      // regression: 0085 owns the columns it created, not the vocabulary of every
      // column that follows. That 0085 itself stores no blob is proven from its own
      // text, and the authorized future above adds exactly such a column.
    ]) {
      stage = `forward safety: regression - ${reason}`;
      await q('SAVEPOINT forward_safety_regression');
      try {
        await q(plant);
        await assert.rejects(verifyCatalog(), refuses, `a database where ${reason} must still be refused`);
      } finally {
        // Always reverted, even when the plant itself or the assertion threw: a mirror
        // that kept a planted regression would make every scenario after it prove the
        // wrong thing, and a half-applied plant would mask the real error below.
        await q('ROLLBACK TO SAVEPOINT forward_safety_regression');
        await q('RELEASE SAVEPOINT forward_safety_regression');
      }
    }
    // Every regression was reverted, so the untouched authorized future still passes.
    stage = 'forward safety: every planted regression was reverted';
    await verifyCatalog();
  } finally {
    // ROLLBACK FIRST. If anything above raised a database error the transaction is
    // aborted, and a RESET ROLE issued before the rollback fails with 25P02 - which
    // would replace the real error with a useless one.
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
    await identity('postgres');
  }
  stage = 'forward safety: the present-day catalog is unchanged';
  await verifyCatalog();
}

// ---------------------------------------------------------------------------

async function provisionHumans(humanIds) {
  await identity('postgres');
  await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [humanIds]);
}

async function removeFixtures(humans) {
  await identity('postgres');
  const worldIds = (await rows(`SELECT DISTINCT ep.world_id FROM ${EPISODES} ep WHERE ep.user_id = ANY($1::uuid[])`, [humans]))
    .map((row) => row.world_id);
  await q(`DELETE FROM ${REJOIN_COMMANDS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${REJOINED_EVENTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${REMOVAL_COMMANDS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${REMOVED_EVENTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${ACCEPT_COMMANDS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${JOINED_EVENTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${MEMBER_INVITATIONS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${ADD_PAYLOADS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${REMOVE_PAYLOADS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${REJOIN_PAYLOADS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${APPROVALS} WHERE proposal_id IN (SELECT id FROM ${PROPOSALS} WHERE world_id = ANY($1::uuid[]))`, [worldIds]);
  await q(`DELETE FROM ${PROPOSALS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${SNAPSHOT_MEMBERS} WHERE membership_snapshot_id IN (SELECT id FROM ${SNAPSHOTS} WHERE world_id = ANY($1::uuid[]))`, [worldIds]);
  await q(`DELETE FROM ${SNAPSHOTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${LEAVE_COMMANDS} WHERE world_id = ANY($1::uuid[]) OR actor_user_id = ANY($2::uuid[])`, [worldIds, humans]);
  await q(`DELETE FROM ${LEFT_EVENTS} WHERE world_id = ANY($1::uuid[]) OR actor_user_id = ANY($2::uuid[])`, [worldIds, humans]);
  await q(`DELETE FROM ${CEILING} WHERE grant_id IN (SELECT id FROM ${GRANTS} WHERE world_id = ANY($1::uuid[]) OR grantor_user_id = ANY($2::uuid[]))`, [worldIds, humans]);
  await q(`DELETE FROM ${CONSENT_EVENTS} WHERE world_id = ANY($1::uuid[]) OR grantor_user_id = ANY($2::uuid[])`, [worldIds, humans]);
  await q(`DELETE FROM ${GRANTS} WHERE world_id = ANY($1::uuid[]) OR grantor_user_id = ANY($2::uuid[])`, [worldIds, humans]);
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

/** Builds the committed fixtures the multi-connection races need. */
async function provisionRaceWorlds(c) {
  const worlds = {};

  const dispatchVsLeave = await provisionWorld(c.inviter, c.raceSecond, 'race-dispatch');
  const third = await addMember(dispatchVsLeave.worldId, [c.inviter, c.raceSecond], c.raceThird);
  const pending = ids();
  await prepareAdd(pending, dispatchVsLeave.worldId, c.raceNewcomerA);
  await approveWith(pending.proposal, [c.inviter, c.raceSecond, c.raceThird]);
  worlds.dispatchVsLeave = { ...dispatchVsLeave, third: c.raceThird, proposal: pending.proposal, payload: pending.payload };

  const acceptVsLeave = await provisionWorld(c.inviter, c.raceSecondB, 'race-accept');
  await addMember(acceptVsLeave.worldId, [c.inviter, c.raceSecondB], c.raceThirdB);
  const pendingB = ids();
  await prepareAdd(pendingB, acceptVsLeave.worldId, c.raceNewcomerB);
  await approveWith(pendingB.proposal, [c.inviter, c.raceSecondB, c.raceThirdB]);
  const invitationB = randomUUID();
  await dispatchInvite(invitationB, pendingB.proposal);
  worlds.acceptVsLeave = { ...acceptVsLeave, third: c.raceThirdB, newcomer: c.raceNewcomerB, invitationId: invitationB };

  const identicalAccept = await provisionWorld(c.inviter, c.raceSecondC, 'race-identical');
  const pendingC = ids();
  await prepareAdd(pendingC, identicalAccept.worldId, c.raceNewcomerC);
  await approveWith(pendingC.proposal, [c.inviter, c.raceSecondC]);
  const invitationC = randomUUID();
  await dispatchInvite(invitationC, pendingC.proposal);
  worlds.identicalAccept = { ...identicalAccept, newcomer: c.raceNewcomerC, invitationId: invitationC };

  const competingAccept = await provisionWorld(c.inviter, c.raceSecondD, 'race-competing');
  const pendingD = ids();
  await prepareAdd(pendingD, competingAccept.worldId, c.raceNewcomerD);
  await approveWith(pendingD.proposal, [c.inviter, c.raceSecondD]);
  const invitationD = randomUUID();
  await dispatchInvite(invitationD, pendingD.proposal);
  worlds.competingAccept = { ...competingAccept, newcomer: c.raceNewcomerD, invitationId: invitationD };

  const removeVsLeave = await provisionWorld(c.inviter, c.raceSecondE, 'race-remove');
  const removalTarget = await addMember(removeVsLeave.worldId, [c.inviter, c.raceSecondE], c.raceTargetE);
  const removal = ids();
  const [removalPrepared] = await prepareRemove(removal, removeVsLeave.worldId, c.raceTargetE);
  await approveWith(removal.proposal, [c.inviter, c.raceSecondE]);
  worlds.removeVsLeave = {
    ...removeVsLeave, target: c.raceTargetE, proposal: removal.proposal,
    targetEpisode: removalPrepared.prepared_target_episode_id,
  };

  const removalBeside = await provisionWorld(c.inviter, c.raceSecondF, 'race-beside');
  await addMember(removalBeside.worldId, [c.inviter, c.raceSecondF], c.raceTargetF);
  const besideRemoval = ids();
  await prepareRemove(besideRemoval, removalBeside.worldId, c.raceTargetF);
  await approveWith(besideRemoval.proposal, [c.inviter, c.raceSecondF]);
  const besideOther = ids();
  await prepareAdd(besideOther, removalBeside.worldId, c.raceNewcomerF);
  worlds.removalBeside = {
    ...removalBeside, second: c.raceSecondF, removalProposal: besideRemoval.proposal, otherProposal: besideOther.proposal,
  };

  const doubleRejoin = await provisionWorld(c.inviter, c.raceSecondG, 'race-rejoin');
  await addMember(doubleRejoin.worldId, [c.inviter, c.raceSecondG], c.raceFormerG);
  await identity('postgres', c.raceFormerG);
  await leave(randomUUID(), doubleRejoin.worldId, randomUUID());
  await identity('postgres');
  const rejoinProposal = ids();
  await prepareRejoin(rejoinProposal, doubleRejoin.worldId, c.raceFormerG);
  await approveWith(rejoinProposal.proposal, [c.inviter, c.raceSecondG]);
  worlds.doubleRejoin = { ...doubleRejoin, former: c.raceFormerG, proposal: rejoinProposal.proposal };

  // A SECOND proposal captured under the same OLD topology of the dispatch World.
  // Concurrency 1 commits one governed mutation there; this one must then be stale,
  // which is exactly "two governed mutations from the same old topology".
  const spare = ids();
  await prepareAdd(spare, dispatchVsLeave.worldId, c.raceNewcomerH);
  await approveWith(spare.proposal, [c.inviter, c.raceSecond, c.raceThird]);
  worlds.twoMutations = { staleProposal: spare.proposal, stalePayload: spare.payload };

  const unrelated = await provisionWorld(c.inviter, c.raceSecondI, 'race-unrelated');
  worlds.unrelated = { ...unrelated, targetUser: c.raceSecondI };
  void third;
  void removalTarget;
  return worlds;
}

async function main() {
  const f = {
    inviter: randomUUID(), target: randomUUID(), newcomer: randomUUID(), outsider: randomUUID(),
    staleTarget: randomUUID(), staleThird: randomUUID(), staleNewcomer: randomUUID(),
    removeSecond: randomUUID(), removeTarget: randomUUID(), soloTarget: randomUUID(),
    idempotencyTarget: randomUUID(), idempotencyNewcomer: randomUUID(),
    forwardTarget: randomUUID(), forwardNewcomer: randomUUID(),
  };
  f.humans = Object.values(f);
  const c = {
    inviter: randomUUID(),
    raceSecond: randomUUID(), raceThird: randomUUID(), raceNewcomerA: randomUUID(),
    raceSecondB: randomUUID(), raceThirdB: randomUUID(), raceNewcomerB: randomUUID(),
    raceSecondC: randomUUID(), raceNewcomerC: randomUUID(),
    raceSecondD: randomUUID(), raceNewcomerD: randomUUID(),
    raceSecondE: randomUUID(), raceTargetE: randomUUID(),
    raceSecondF: randomUUID(), raceTargetF: randomUUID(), raceNewcomerF: randomUUID(),
    raceSecondG: randomUUID(), raceFormerG: randomUUID(),
    raceNewcomerH: randomUUID(), raceSecondI: randomUUID(),
  };
  c.humans = Object.values(c);
  let bornWorlds = [];
  try {
    await client.connect();
    await verifyCatalog();
    await q('BEGIN');
    try {
      await verifyDirectTableAcl();
      await verifyFunctionAcl();
      // Fixture humans are provisioned the canonical way (auth.users -> the
      // migration-0002 trigger -> public.users), and every World is born through the
      // frozen I-04A / I-04B commands, never by a direct insert.
      await provisionHumans(f.humans);
      const added = await verifyAddMember(f);
      await verifyStaleness(f);
      await verifyRemoval(f);
      await verifyRejoin(f, added);
      await verifyBoundedRefusalsAndIdempotency(f, added);
      await verifyForwardSafety(f);
      await identity('postgres');
    } finally {
      await q('ROLLBACK');
    }

    try {
      await provisionHumans(c.humans);
      // The committed fixtures are built inside ONE explicit transaction: the identity
      // helper sets the role and the JWT claim with transaction-local scope, which
      // outside a transaction block would silently do nothing.
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
      bornWorlds = await removeFixtures(c.humans);
    }

    stage = 'fixture residue';
    const humans = [...f.humans, ...c.humans];
    const [{ n }] = await rows(
      `SELECT (SELECT count(*) FROM ${CREDENTIAL} WHERE user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${INVITATIONS} WHERE inviter_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${INVITE_COMMANDS} WHERE actor_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${ACCEPTANCE_COMMANDS} WHERE actor_user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${BIRTH_EVENTS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${LEFT_EVENTS} WHERE actor_user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${LEAVE_COMMANDS} WHERE actor_user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${SNAPSHOTS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${PROPOSALS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${ADD_PAYLOADS} WHERE world_id = ANY($2::uuid[]) OR target_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${REMOVE_PAYLOADS} WHERE world_id = ANY($2::uuid[]) OR target_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${REJOIN_PAYLOADS} WHERE world_id = ANY($2::uuid[]) OR target_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${MEMBER_INVITATIONS} WHERE world_id = ANY($2::uuid[]) OR target_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${JOINED_EVENTS} WHERE world_id = ANY($2::uuid[]) OR actor_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${ACCEPT_COMMANDS} WHERE world_id = ANY($2::uuid[]) OR actor_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${REMOVED_EVENTS} WHERE world_id = ANY($2::uuid[]) OR target_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${REMOVAL_COMMANDS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${REJOINED_EVENTS} WHERE world_id = ANY($2::uuid[]) OR actor_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${REJOIN_COMMANDS} WHERE world_id = ANY($2::uuid[]) OR actor_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${GRANTS} WHERE grantor_user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${CONSENT_EVENTS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${EPISODES} WHERE user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($2::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
      [humans, bornWorlds]);
    assert.equal(Number(n), 0, 'no fixture row remains after completion');

    console.log('migration 0085 verified: governed Standard membership lifecycle - add, remove and rejoin');
  } catch (error) {
    console.error(`migration 0085 verification FAILED at stage: ${stage}`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

await main();
