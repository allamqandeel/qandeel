// Real-PostgreSQL verifier for migration 0084 - Exact Membership Snapshot +
// Shared Governance Approval Foundation v1 (I-04D).
//
// Runs against a fully migrated database and proves, from live catalogs and live
// behaviour rather than from the migration text:
//
//   * schema: the four narrow governance relations exist exactly once, owned by
//     postgres, with the exact columns, the exact unique bindings - one proposal per
//     captured topology, one effective approval per snapshot episode - the two
//     COMPOSITE foreign keys that make CW2-02 section 31 structural rather than
//     procedural, restrictive deletion everywhere, RLS on, zero policies, no
//     trigger, and no owner / admin / initiator / payload / status column;
//   * THE PRE-LAUNCH SECURITY BOUNDARY: all three primitives are owned by postgres,
//     SECURITY DEFINER, search_path-pinned and VOLATILE, and are executable by NO
//     application role - PUBLIC, anon, authenticated and service_role are all denied
//     in the catalog AND by an actual 42501 - because the frozen launch gate
//     precondition is not implemented yet;
//   * exact authority: capture derives and records no initiator, the approval
//     primitive accepts no actor / episode / instant parameter and derives the human
//     from auth.uid(), and the resolver consults no identity at all;
//   * the exact captured topology: a two-member ADD_MEMBER proposal captures exactly
//     the two open EPISODE ids and requires both; one approval is not enough; both
//     approvals satisfy the exact operation and payload version;
//   * non-reusability: approvals of payload version A never authorize version B, and
//     approvals collected for one operation never authorize another;
//   * staleness: a leave after the proposal makes it stale while every historical row
//     survives untouched; a leave followed by the same human's REJOIN - a topology
//     with an identical human set, an identical member count and a different episode
//     set - leaves it stale, which is exactly the case a count or user-id comparison
//     would have accepted;
//   * empty-set unanimity is never approval: zero active humans cannot open ordinary
//     governance, a sole current human cannot be removed through an empty required
//     set, and a required count of zero is never satisfied;
//   * the removal exclusion: the target is INSIDE the captured topology and OUTSIDE
//     the required set, and cannot approve their own removal;
//   * non-membership: an outsider, a former member and a later rejoin episode all
//     fail, each through a bounded non-enumerating class;
//   * no Product mutation: proposing, approving and resolving change no membership
//     episode, no World lifecycle, no Standing Context Grant, no audience ceiling, no
//     consent history and no Personal row;
//   * idempotency: equivalent retries return the committed historical result and
//     create no second row, including after topology has moved on; a reused proposal,
//     snapshot or approval id with different semantics is 23505;
//   * concurrency, with committed fixtures and extra connections: proposal versus
//     leave and approval versus leave in BOTH orders; concurrent identical capture
//     and approval retries; a reused proposal id and a reused snapshot id under
//     competing semantics, with no orphan snapshot; two different approval ids from
//     one episode yielding exactly one effective approval; partial then complete
//     coverage of the required set; an unrelated World's topology change staling
//     nothing; and no deadlock anywhere;
//   * forward safety against a hypothetical future that this foundation exists to
//     serve, plus the regressions that must still be refused;
//   * zero fixture residue after completion.
//
// Nothing here weakens an ACL. Application roles are used only to prove denial and
// to drive the frozen I-04A commands that build the fixtures; the internal cores are
// invoked as the database owner with the exact human's JWT claim set, which is
// precisely how a later launch-gated consumer must preserve auth.uid().
//
// Two fixtures are written directly as the database owner, inside the rolled-back
// transaction, and both are stated rather than hidden: a REJOIN episode, because the
// rejoin command is not implemented yet and its shape - a second, later open episode
// for the same human in the same World - is exactly what the staleness rule must be
// tested against; and a THIRD member episode, because add-member is the consumer
// this foundation exists to enable and does not exist yet. Neither is reachable by
// any application role, and both are rolled back.
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
const OWN_TABLES = [SNAPSHOTS, SNAPSHOT_MEMBERS, PROPOSALS, APPROVALS];
const SEALED_TABLES = [WORLDS, EPISODES, CREDENTIAL, INVITATIONS, INVITE_COMMANDS, BIRTH_EVENTS,
  ACCEPTANCE_COMMANDS, LEFT_EVENTS, LEAVE_COMMANDS, GRANTS, CEILING];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

const CAPTURE_FN = 'public.capture_shared_world_governance_proposal_v1(uuid,uuid,uuid,text,uuid,text,uuid)';
const APPROVE_FN = 'public.commit_shared_world_governance_approval_v1(uuid,uuid)';
const RESOLVE_FN = 'public.resolve_shared_world_governance_approval_v1(uuid,text,uuid)';
const OWN_FUNCTIONS = [CAPTURE_FN, APPROVE_FN, RESOLVE_FN];

const INSUFFICIENT_PRIVILEGE = ['42501'];
const INVALID_PARAMETER = ['22023'];
const UNAVAILABLE = ['P0002'];
const CONFLICT = ['23505'];
const STALE = ['40001'];
const INCOMPLETE = ['55000'];

const CAPTURE_SQL = `SELECT outcome, captured_proposal_id, captured_snapshot_id, governed_world_id,
                            proposed_operation_kind, payload_version_id, required_approval_rule,
                            snapshot_member_count, required_approval_count, snapshot_captured_at
                       FROM public.capture_shared_world_governance_proposal_v1($1::uuid,$2::uuid,$3::uuid,$4::text,$5::uuid,$6::text,$7::uuid)`;
const APPROVE_SQL = `SELECT outcome, committed_approval_id, approved_proposal_id, approved_snapshot_id,
                            approver_episode_id, approval_committed_at
                       FROM public.commit_shared_world_governance_approval_v1($1::uuid,$2::uuid)`;
const RESOLVE_SQL = `SELECT outcome, satisfied_proposal_id, satisfied_snapshot_id, governed_world_id,
                            satisfied_operation_kind, satisfied_payload_version_id,
                            required_approval_count, recorded_required_approval_count
                       FROM public.resolve_shared_world_governance_approval_v1($1::uuid,$2::text,$3::uuid)`;
const LEAVE_SQL = `SELECT outcome, closed_membership_episode_id
                     FROM public.commit_shared_world_standard_voluntary_leave_v1($1::uuid,$2::uuid,$3::uuid)`;
const BIRTH_SQL = 'SELECT outcome, born_world_id FROM public.commit_shared_world_direct_acceptance_birth_v1($1,$2,$3,$4,$5)';
const ROTATE_SQL = 'SELECT command_id, credential_epoch FROM public.rotate_shared_world_invite_credential_v1($1,$2,$3)';
const SUBMIT_SQL = 'SELECT outcome, command_id, requested_invitation_id FROM public.submit_shared_world_direct_invitation_v1($1,$2,$3)';

const capture = (ids, worldId, operation, payloadVersion, rule, excludedTarget = null) =>
  rows(CAPTURE_SQL, [ids.proposal, ids.snapshot, worldId, operation, payloadVersion, rule, excludedTarget]);
const approve = (approvalId, proposalId) => rows(APPROVE_SQL, [approvalId, proposalId]);
const resolve = (proposalId, operation, payloadVersion) => rows(RESOLVE_SQL, [proposalId, operation, payloadVersion]);
const leave = (commandId, worldId, eventId) => rows(LEAVE_SQL, [commandId, worldId, eventId]);
const ids = () => ({ proposal: randomUUID(), snapshot: randomUUID() });
/** A synthetic opaque reference. The human-facing credential format is not frozen, so this invents none. */
const opaqueRef = (label) => `ref:i04d:${label}:${randomUUID()}`;

const ALL = 'ALL_CURRENT_MEMBERS';
const EXCEPT_TARGET = 'ALL_CURRENT_MEMBERS_EXCEPT_TARGET';

const SNAPSHOT_COLUMNS = [
  ['id', 'uuid', 'NO'],
  ['world_id', 'uuid', 'NO'],
  ['captured_at', 'timestamp with time zone', 'NO'],
];
const SNAPSHOT_MEMBER_COLUMNS = [
  ['membership_snapshot_id', 'uuid', 'NO'],
  ['membership_episode_id', 'uuid', 'NO'],
];
const PROPOSAL_COLUMNS = [
  ['id', 'uuid', 'NO'],
  ['world_id', 'uuid', 'NO'],
  ['membership_snapshot_id', 'uuid', 'NO'],
  ['operation_kind', 'text', 'NO'],
  ['proposed_payload_version_id', 'uuid', 'NO'],
  ['approval_rule', 'text', 'NO'],
  ['excluded_membership_episode_id', 'uuid', 'YES'],
  ['created_at', 'timestamp with time zone', 'NO'],
];
const APPROVAL_COLUMNS = [
  ['id', 'uuid', 'NO'],
  ['proposal_id', 'uuid', 'NO'],
  ['membership_snapshot_id', 'uuid', 'NO'],
  ['membership_episode_id', 'uuid', 'NO'],
  ['approved_at', 'timestamp with time zone', 'NO'],
];

/**
 * Every foreign key migration 0084 OWNS, by exact name, exact local columns, exact
 * parent and restrictive deletion - not a count. A count is a live-schema ceiling:
 * the add-member consumer this foundation exists to serve WILL add its own foreign
 * key into a proposal, and that is not an 0084 regression. `REFERENCES public.` is
 * normalized away because pg_get_constraintdef renders against the session
 * search_path.
 */
const OWNED_FOREIGN_KEYS = {
  shared_world_membership_snapshots_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_membership_snapshot_members_snapshot_fk: 'FOREIGN KEY (membership_snapshot_id) REFERENCES shared_world_membership_snapshots(id) ON DELETE RESTRICT',
  shared_world_membership_snapshot_members_episode_fk: 'FOREIGN KEY (membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_governance_proposals_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_governance_proposals_snapshot_fk: 'FOREIGN KEY (membership_snapshot_id) REFERENCES shared_world_membership_snapshots(id) ON DELETE RESTRICT',
  shared_world_governance_proposals_excluded_episode_fk: 'FOREIGN KEY (excluded_membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_governance_approvals_proposal_fk: 'FOREIGN KEY (proposal_id, membership_snapshot_id) REFERENCES shared_world_governance_proposals(id, membership_snapshot_id) ON DELETE RESTRICT',
  shared_world_governance_approvals_snapshot_member_fk: 'FOREIGN KEY (membership_snapshot_id, membership_episode_id) REFERENCES shared_world_membership_snapshot_members(membership_snapshot_id, membership_episode_id) ON DELETE RESTRICT',
};

async function snapshotCounts(humans) {
  const [{ role }] = await rows('SELECT current_user AS role');
  await q('RESET ROLE');
  const [counts] = await rows(
    `SELECT (SELECT count(*)::int FROM ${WORLDS}) worlds,
            (SELECT count(*)::int FROM ${EPISODES}) episodes,
            (SELECT count(*)::int FROM ${EPISODES} WHERE ended_at IS NULL) open_episodes,
            (SELECT count(*)::int FROM ${LEFT_EVENTS}) departures,
            (SELECT count(*)::int FROM ${LEAVE_COMMANDS}) leaves,
            (SELECT count(*)::int FROM ${SNAPSHOTS}) snapshots,
            (SELECT count(*)::int FROM ${SNAPSHOT_MEMBERS}) snapshot_members,
            (SELECT count(*)::int FROM ${PROPOSALS}) proposals,
            (SELECT count(*)::int FROM ${APPROVALS}) approvals,
            (SELECT count(*)::int FROM ${GRANTS}) grants,
            (SELECT count(*)::int FROM ${CEILING}) ceiling,
            (SELECT count(*)::int FROM ${CONSENT_EVENTS}) consent,
            (SELECT count(*)::int FROM public.conversation_sessions) sessions,
            (SELECT count(*)::int FROM public.conversation_turns) turns,
            (SELECT count(*)::int FROM public.memories) memories,
            (SELECT count(*)::int FROM public.hypotheses) hypotheses,
            (SELECT count(*)::int FROM ${EPISODES} WHERE user_id = ANY($1::uuid[]) AND ended_at IS NULL) open`,
    [humans],
  );
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  return counts;
}

/** Everything I-04D must never change. */
const productOf = (counts) => ({
  worlds: counts.worlds, episodes: counts.episodes, open_episodes: counts.open_episodes,
  departures: counts.departures, leaves: counts.leaves,
  grants: counts.grants, ceiling: counts.ceiling, consent: counts.consent,
  sessions: counts.sessions, turns: counts.turns, memories: counts.memories, hypotheses: counts.hypotheses,
});

/** The exact captured topology of one snapshot, as a sorted list of episode ids. */
const capturedTopology = async (snapshotId) => (await rows(
  `SELECT membership_episode_id FROM ${SNAPSHOT_MEMBERS} WHERE membership_snapshot_id = $1 ORDER BY membership_episode_id`,
  [snapshotId])).map((row) => row.membership_episode_id);

/** The exact current topology of one World, as a sorted list of open episode ids. */
const currentTopology = async (worldId) => (await rows(
  `SELECT id FROM ${EPISODES} WHERE world_id = $1 AND ended_at IS NULL ORDER BY id`, [worldId])).map((row) => row.id);

// ---------------------------------------------------------------------------

async function verifyCatalog() {
  stage = 'catalog: migration 0084 created exactly its own four tables, once';
  for (const table of OWN_TABLES) {
    const name = table.replace('public.', '');
    const [{ n }] = await rows(
      "SELECT count(*)::int n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace WHERE ns.nspname='public' AND c.relname=$1 AND c.relkind='r'",
      [name]);
    assert.equal(n, 1, `${table} exists exactly once as an ordinary table`);
    const [{ owner }] = await rows('SELECT pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.oid = $1::regclass', [table]);
    assert.equal(owner, 'postgres', `${table} is owned by postgres`);
  }
  // That migration 0084 introduced NO consumer, invitation, entitlement, launch or
  // cross-domain permission substrate is a claim about 0084's own text, and it is
  // proven there, by
  // database/tests/shared-world-governance-approval-foundation-v1.test.mjs. It is
  // deliberately NOT asserted from the live catalog: this verifier runs against a
  // FULLY migrated database, so a live absence census would reject exactly the
  // add-member consumer this foundation exists to enable.

  stage = 'catalog: the four tables carry exactly their own columns';
  for (const [table, expected] of [[SNAPSHOTS, SNAPSHOT_COLUMNS], [SNAPSHOT_MEMBERS, SNAPSHOT_MEMBER_COLUMNS],
    [PROPOSALS, PROPOSAL_COLUMNS], [APPROVALS, APPROVAL_COLUMNS]]) {
    const columns = await rows(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table.replace('public.', '')]);
    // A PREFIX, never a census of the live column list: a later reviewed slice may
    // append its own column, and that is not an 0084 regression. A drop, a type or
    // nullability change and a reorder all still fail.
    const shape = columns.map((c) => [c.column_name, c.data_type, c.is_nullable]);
    assert.deepEqual(shape.slice(0, expected.length), expected,
      `${table} still carries every column migration 0084 owns, unchanged and in its original position`);
    for (const [name] of expected) {
      assert.equal(shape.filter((column) => column[0] === name).length, 1, `${table}.${name} appears exactly once`);
    }
    for (const { column_name: column, data_type: type } of columns) {
      assert.doesNotMatch(column, /owner|admin|creator|initiator|proposer|survivor|privilege|capability|permission|scope|metadata|vote|weight|token/iu,
        `${table}.${column} creates no superior authority and no generic permission store`);
      assert.ok(!['json', 'jsonb', 'ARRAY'].includes(type), `${table}.${column} is not a JSON or array payload`);
    }
  }
  // The exact human is the immutable membership episode, never a duplicated id.
  for (const table of [SNAPSHOT_MEMBERS, APPROVALS]) {
    const [{ duplicated }] = await rows(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns c
         WHERE c.table_schema='public' AND c.table_name=$1 AND c.column_name IN ('user_id','actor_user_id')) AS duplicated`,
      [table.replace('public.', '')]);
    assert.equal(duplicated, false, `${table} duplicates no human id beside the membership episode`);
  }
  // The proposed payload/version identity stays OPAQUE.
  const [{ opaque }] = await rows(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns c
       WHERE c.table_schema='public' AND c.table_name='shared_world_governance_proposals'
         AND c.column_name='proposed_payload_version_id' AND c.data_type='uuid' AND c.is_nullable='NO') AS opaque`);
  assert.equal(opaque, true, 'the proposed payload version is an opaque non-null uuid identity');

  stage = 'catalog: the exact unique bindings that make CW2-02 section 31 structural';
  const constraintsOf = async (table) => rows(
    'SELECT conname name, contype type, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY conname', [table]);
  const snapshotConstraints = await constraintsOf(SNAPSHOTS);
  const memberConstraints = await constraintsOf(SNAPSHOT_MEMBERS);
  const proposalConstraints = await constraintsOf(PROPOSALS);
  const approvalConstraints = await constraintsOf(APPROVALS);
  // A sentinel rather than `undefined`, so a DROPPED constraint fails as a named
  // assertion instead of as a TypeError - which is what the forward-safety
  // regressions below rely on being able to recognise.
  const defOf = (list, name) => (list.find((c) => c.name === name) ?? { def: `MISSING CONSTRAINT ${name}` }).def;
  assert.match(defOf(snapshotConstraints, 'shared_world_membership_snapshots_pk'), /PRIMARY KEY \(id\)/u);
  assert.match(defOf(memberConstraints, 'shared_world_membership_snapshot_members_pk'),
    /PRIMARY KEY \(membership_snapshot_id, membership_episode_id\)/u,
    'a captured topology can never name one episode twice');
  assert.match(defOf(proposalConstraints, 'shared_world_governance_proposals_pk'), /PRIMARY KEY \(id\)/u);
  assert.match(defOf(proposalConstraints, 'shared_world_governance_proposals_snapshot_key'), /UNIQUE \(membership_snapshot_id\)/u,
    'one captured topology carries at most one proposal');
  assert.match(defOf(proposalConstraints, 'shared_world_governance_proposals_snapshot_binding_key'), /UNIQUE \(id, membership_snapshot_id\)/u,
    'and exposes the composite binding an approval must reference');
  assert.match(defOf(approvalConstraints, 'shared_world_governance_approvals_pk'), /PRIMARY KEY \(id\)/u);
  assert.match(defOf(approvalConstraints, 'shared_world_governance_approvals_one_per_episode_key'), /UNIQUE \(proposal_id, membership_episode_id\)/u,
    'shared_world_governance_approvals_one_per_episode_key: one snapshot episode is worth exactly one effective approval, whatever id it arrives under');
  // Governance is never keyed on a human id, which survives a leave and a rejoin.
  for (const list of [memberConstraints, approvalConstraints]) {
    for (const constraint of list.filter((c) => c.type === 'u' || /PRIMARY KEY/u.test(c.def))) {
      assert.doesNotMatch(constraint.def, /user_id/u,
        `${constraint.name} must key governance on episode identity, never on a human id`);
    }
  }
  // Every foreign key 0084 OWNS, asserted exactly - name, local columns, parent and
  // restrictive deletion - rather than counted.
  const normalize = (def) => def.replace(/REFERENCES (?:public\.)?/u, 'REFERENCES ');
  const liveForeignKeys = new Map([...snapshotConstraints, ...memberConstraints, ...proposalConstraints, ...approvalConstraints]
    .filter((c) => c.type === 'f').map((c) => [c.name, normalize(c.def)]));
  for (const [name, def] of Object.entries(OWNED_FOREIGN_KEYS)) {
    assert.equal(liveForeignKeys.get(name), def, `${name} binds exactly the canonical row, restrictively: canonical history is never cascaded away`);
  }

  stage = 'catalog: RLS on, zero policies, no trigger, and no application-role privilege';
  for (const table of OWN_TABLES) {
    const [{ rls }] = await rows('SELECT c.relrowsecurity rls FROM pg_class c WHERE c.oid = $1::regclass', [table]);
    assert.equal(rls, true, `row level security is enabled on ${table}`);
    const [{ n: policies }] = await rows('SELECT count(*)::int n FROM pg_policy p WHERE p.polrelid = $1::regclass', [table]);
    assert.equal(policies, 0, `${table} carries zero RLS policies`);
    const [{ n: triggers }] = await rows('SELECT count(*)::int n FROM pg_trigger t WHERE t.tgrelid = $1::regclass AND NOT t.tgisinternal', [table]);
    assert.equal(triggers, 0, `${table} carries no trigger`);
    const [{ publicAcl }] = await rows(
      'SELECT EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) a WHERE c.oid = $1::regclass AND a.grantee = 0) AS "publicAcl"', [table]);
    assert.equal(publicAcl, false, `PUBLIC must not hold any privilege on ${table}`);
    for (const role of APPLICATION_ROLES) {
      for (const privilege of PRIVILEGES) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
  }
  // THE PRE-LAUNCH SECURITY BOUNDARY, re-proven from the catalog every time this
  // runs - including after the hypothetical future below is in place.
  for (const fnName of OWN_FUNCTIONS) {
    const [{ allowed: publicExecute }] = await rows("SELECT has_function_privilege('public', $1, 'EXECUTE') AS allowed", [fnName]);
    assert.equal(publicExecute, false, `PUBLIC must not hold EXECUTE on ${fnName}`);
    for (const role of APPLICATION_ROLES) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, fnName, 'EXECUTE']);
      assert.equal(allowed, false, `${role} must not hold EXECUTE on ${fnName} before the launch gate exists`);
    }
  }
  // And no trigger couples governance to membership or Standing Context state.
  for (const table of [EPISODES, WORLDS, GRANTS, CEILING]) {
    const [{ n: triggers }] = await rows('SELECT count(*)::int n FROM pg_trigger t WHERE t.tgrelid = $1::regclass AND NOT t.tgisinternal', [table]);
    assert.equal(triggers, 0, `${table} carries no trigger that governance could fire`);
  }

  stage = 'catalog: all three primitives are postgres-owned, SECURITY DEFINER, pinned and VOLATILE';
  for (const fnName of OWN_FUNCTIONS) {
    const [fn] = await rows(
      `SELECT pr.prosecdef secdef, pr.provolatile volatility, pr.proconfig config, pr.prosrc, pg_get_userbyid(pr.proowner) owner
         FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [fnName]);
    assert.equal(fn.owner, 'postgres', `${fnName} is owned by postgres`);
    assert.equal(fn.secdef, true, `${fnName} is SECURITY DEFINER`);
    assert.equal(fn.volatility, 'v', `${fnName} takes row locks and is VOLATILE`);
    assert.ok((fn.config ?? []).some((entry) => entry === 'search_path=' || entry === 'search_path=""'),
      `${fnName} pins an empty search_path`);
    assert.doesNotMatch(fn.prosrc, /standing_context|consent|matching|introduction/iu,
      `${fnName} names no Standing Context, consent, Matching or Introduction state`);
    assert.doesNotMatch(fn.prosrc, /conversation_|\Wmemor|human_intelligence|hypothes|effective_context/iu,
      `${fnName} reads no Personal context of any kind`);
    assert.doesNotMatch(fn.prosrc, /DELETE FROM|TRUNCATE/iu, `${fnName} deletes no canonical history`);
    assert.doesNotMatch(fn.prosrc, /pg_advisory|LOCK TABLE/iu, `${fnName} uses no advisory key and no table lock`);
    assert.doesNotMatch(fn.prosrc, /UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds/u,
      `${fnName} never creates, closes or mutates a Shared World`);
    assert.doesNotMatch(fn.prosrc, /UPDATE public\.shared_world_membership_episodes|INSERT INTO public\.shared_world_membership_episodes/u,
      `${fnName} never opens or closes a membership episode`);
  }

  stage = 'catalog: the exact IN and TABLE argument arrays, derived by PostgreSQL';
  // The arrays are built inside SQL with generate_subscripts rather than partitioned
  // client-side: pg_proc.proargmodes is "char"[], which node-postgres returns as the
  // raw literal {i,i,i,t,...}, so indexing it from JavaScript reads CHARACTERS and
  // silently misclassifies TABLE columns as input parameters.
  const argumentsOf = async (fnName) => {
    const [args] = await rows(
      `SELECT ARRAY(SELECT pr.proargnames[s.i] FROM generate_subscripts(pr.proargnames, 1) AS s(i)
                     WHERE pr.proargmodes[s.i] = 'i'::"char" ORDER BY s.i) AS in_names,
              ARRAY(SELECT pr.proargnames[s.i] FROM generate_subscripts(pr.proargnames, 1) AS s(i)
                     WHERE pr.proargmodes[s.i] IN ('o'::"char", 't'::"char") ORDER BY s.i) AS out_names,
              ARRAY(SELECT t.typname::text FROM unnest(pr.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
                     JOIN pg_type t ON t.oid = a.argtype ORDER BY a.ord) AS in_types
         FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [fnName]);
    return args;
  };
  const captureArgs = await argumentsOf(CAPTURE_FN);
  assert.deepEqual(captureArgs.in_names,
    ['p_proposal_id', 'p_membership_snapshot_id', 'p_world_id', 'p_operation_kind',
      'p_proposed_payload_version_id', 'p_approval_rule', 'p_excluded_target_user_id'],
    'capture accepts exactly the frozen parameter list');
  assert.deepEqual(captureArgs.in_types, ['uuid', 'uuid', 'uuid', 'text', 'uuid', 'text', 'uuid']);
  assert.deepEqual(captureArgs.out_names,
    ['outcome', 'captured_proposal_id', 'captured_snapshot_id', 'governed_world_id', 'proposed_operation_kind',
      'payload_version_id', 'required_approval_rule', 'snapshot_member_count', 'required_approval_count', 'snapshot_captured_at'],
    'and returns exactly the bounded immutable capture result');
  const approveArgs = await argumentsOf(APPROVE_FN);
  assert.deepEqual(approveArgs.in_names, ['p_approval_id', 'p_proposal_id'],
    'an approval accepts exactly two opaque identities: no actor, no episode, no instant');
  assert.deepEqual(approveArgs.in_types, ['uuid', 'uuid']);
  assert.deepEqual(approveArgs.out_names,
    ['outcome', 'committed_approval_id', 'approved_proposal_id', 'approved_snapshot_id', 'approver_episode_id', 'approval_committed_at']);
  const resolveArgs = await argumentsOf(RESOLVE_FN);
  assert.deepEqual(resolveArgs.in_names, ['p_proposal_id', 'p_expected_operation_kind', 'p_expected_payload_version_id'],
    'the resolver accepts the proposal and exactly what the caller expects it to be');
  assert.deepEqual(resolveArgs.in_types, ['uuid', 'text', 'uuid']);
  assert.deepEqual(resolveArgs.out_names,
    ['outcome', 'satisfied_proposal_id', 'satisfied_snapshot_id', 'governed_world_id', 'satisfied_operation_kind',
      'satisfied_payload_version_id', 'required_approval_count', 'recorded_required_approval_count']);
  for (const name of [...captureArgs.in_names, ...approveArgs.in_names, ...resolveArgs.in_names]) {
    assert.doesNotMatch(name, /initiator|proposer|approver|episode|member_ids|audience|count|launch|gate|timestamp|instant/iu,
      `${name} is not a topology, approver, count, clock or launch parameter`);
  }

  stage = 'catalog: INITIATION IS NOT AUTHORITY, and the approving human is the session subject';
  const sourceOf = async (fnName) => (await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [fnName]))[0].prosrc;
  const captureSrc = await sourceOf(CAPTURE_FN);
  const approveSrc = await sourceOf(APPROVE_FN);
  const resolveSrc = await sourceOf(RESOLVE_FN);
  assert.doesNotMatch(captureSrc, /auth\.uid/u, 'capture derives and records no initiator');
  assert.doesNotMatch(resolveSrc, /auth\.uid/u, 'and the resolver proves governance, not the identity of whoever asks');
  assert.match(approveSrc, /u uuid := auth\.uid\(\)/u, 'the approving human is derived, never supplied');

  stage = 'catalog: the canonical World-first lock order, and ONE instant per transaction';
  const captureWorld = captureSrc.indexOf('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE');
  const captureTopology = captureSrc.indexOf('WHERE e.world_id = p_world_id AND e.ended_at IS NULL');
  const captureSnapshot = captureSrc.indexOf('INSERT INTO public.shared_world_membership_snapshots');
  const captureMembers = captureSrc.indexOf('INSERT INTO public.shared_world_membership_snapshot_members');
  const captureProposal = captureSrc.indexOf('INSERT INTO public.shared_world_governance_proposals');
  assert.ok(captureWorld > 0 && captureTopology > captureWorld && captureSnapshot > captureTopology
    && captureMembers > captureSnapshot && captureProposal > captureMembers,
    'capture locks the World row, then reads current topology, before any write');
  assert.equal((captureSrc.match(/FOR UPDATE/gu) ?? []).length, 1, 'capture takes exactly one row lock');
  assert.equal((captureSrc.match(/capture_instant := /gu) ?? []).length, 1, 'and reads the clock exactly once');
  for (const [name, source] of [['approval', approveSrc], ['resolver', resolveSrc]]) {
    const preRead = source.indexOf('SELECT pr.world_id INTO target_world');
    const worldAt = source.indexOf('FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
    const proposalAt = source.indexOf('WHERE pr.id = p_proposal_id FOR UPDATE');
    assert.ok(preRead > 0 && worldAt > preRead && proposalAt > worldAt,
      `the ${name} primitive pre-reads only the World id, then locks the World, then the proposal`);
    assert.equal((source.match(/FOR UPDATE/gu) ?? []).length, 2, `the ${name} primitive takes exactly two row locks`);
  }
  assert.equal((approveSrc.match(/approval_instant := /gu) ?? []).length, 1, 'the approval instant is read exactly once');

  stage = 'catalog: exact topology equality, in both directions, over EPISODE identity';
  for (const [name, source] of [['approval', approveSrc], ['resolver', resolveSrc]]) {
    assert.ok(source.includes('AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_snapshot_members m'),
      `the ${name} primitive refuses a current episode the captured topology does not contain`);
    assert.ok(source.includes('AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e'),
      `the ${name} primitive refuses a captured episode that is no longer currently open`);
    assert.match(source, /AND m\.membership_episode_id = e\.id/u, `the ${name} primitive compares episode identity`);
    assert.match(source, /WHERE e\.id = m\.membership_episode_id/u);
    assert.doesNotMatch(source, /count\(\*\)[^;]*shared_world_membership_snapshot_members[^;]*=[^;]*count\(\*\)/u,
      `the ${name} primitive must not compare the two topologies by size`);
  }
  assert.match(approveSrc, /proposal\.excluded_membership_episode_id IS NOT DISTINCT FROM actor_episode/u,
    'the excluded removal target can never approve their own removal');
  assert.doesNotMatch(resolveSrc, /INSERT INTO|UPDATE public\./u, 'the resolver persists nothing at all');

  stage = 'catalog: the frozen v1 operation / rule mapping lives in the primitives, not in a constraint';
  for (const [operation, rule] of [['ADD_MEMBER', ALL], ['REMOVE_MEMBER', EXCEPT_TARGET], ['REJOIN_MEMBER', ALL],
    ['WORLD_SETTINGS_CHANGE', ALL], ['END_WORLD', ALL]]) {
    assert.ok(captureSrc.includes(`WHEN '${operation}' THEN '${rule}'`), `capture maps ${operation} to ${rule}`);
    assert.ok(resolveSrc.includes(`WHEN '${operation}' THEN '${rule}'`), `and the resolver revalidates it for ${operation}`);
  }
}

async function verifyDirectTableAcl() {
  stage = 'ACL: no application role holds direct CRUD on the governance tables, and the Shared substrate stays sealed';
  for (const table of [...OWN_TABLES, ...SEALED_TABLES]) {
    const [{ publicAcl }] = await rows(
      'SELECT EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) a WHERE c.oid = $1::regclass AND a.grantee = 0) AS "publicAcl"', [table]);
    assert.equal(publicAcl, false, `PUBLIC holds no privilege on ${table}`);
    for (const role of APPLICATION_ROLES) {
      for (const privilege of PRIVILEGES) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
  }
  for (const role of APPLICATION_ROLES) {
    await identity(role, randomUUID());
    for (const table of OWN_TABLES) {
      await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), INSUFFICIENT_PRIVILEGE);
      await rejected(() => q(`DELETE FROM ${table}`), INSUFFICIENT_PRIVILEGE);
    }
  }
  await identity('postgres');
}

async function verifyFunctionAcl() {
  stage = 'THE PRE-LAUNCH BOUNDARY: no application role may execute any of the three primitives';
  for (const fnName of OWN_FUNCTIONS) {
    const [{ allowed: publicExecute }] = await rows("SELECT has_function_privilege('public', $1, 'EXECUTE') AS allowed", [fnName]);
    assert.equal(publicExecute, false, `PUBLIC cannot execute ${fnName}`);
    for (const role of APPLICATION_ROLES) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, fnName, 'EXECUTE']);
      assert.equal(allowed, false, `${role} cannot execute ${fnName} before the launch gate exists`);
    }
  }
  for (const role of APPLICATION_ROLES) {
    await identity(role, randomUUID());
    for (const [label, run] of [
      ['capture', () => capture(ids(), randomUUID(), 'ADD_MEMBER', randomUUID(), ALL)],
      ['approval', () => approve(randomUUID(), randomUUID())],
      ['resolver', () => resolve(randomUUID(), 'ADD_MEMBER', randomUUID())],
    ]) {
      const error = await rejected(run, INSUFFICIENT_PRIVILEGE);
      assert.match(error.message, /permission denied/iu, `${role} is refused execution of the ${label} primitive outright`);
    }
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

/**
 * A controlled future fixture, written as the database owner inside the rolled-back
 * transaction: one additional OPEN membership episode for one human in one World.
 *
 * Neither add-member nor rejoin is implemented yet, and both produce exactly this
 * shape - a new episode row (CW2-03 sections 18 and 28 / C25). Writing it directly
 * is deliberate and stated rather than hidden; it is reachable by no application
 * role, it uses the canonical clock, and it is rolled back.
 */
async function futureEpisode(worldId, human) {
  const [{ role }] = await rows('SELECT current_user AS role');
  await q('RESET ROLE');
  const episodeId = randomUUID();
  await q(`INSERT INTO ${EPISODES}(id, world_id, user_id, joined_at) VALUES($1,$2,$3,clock_timestamp())`,
    [episodeId, worldId, human]);
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  return episodeId;
}
const removeFutureEpisode = async (episodeId) => {
  await identity('postgres');
  await q(`DELETE FROM ${EPISODES} WHERE id = $1`, [episodeId]);
};

// ---------------------------------------------------------------------------

/** G01 - G05: the exact captured topology, and an approval that is exact and non-reusable. */
async function verifyExactProposal(f) {
  stage = 'G01: a two-member ADD_MEMBER proposal captures exactly two open EPISODE ids and requires both';
  const world = await provisionWorld(f.inviter, f.target, 'exact');
  const before = await snapshotCounts(f.humans);
  const addMember = { ...ids(), payload: randomUUID() };
  await identity('postgres');
  const [captured] = await capture(addMember, world.worldId, 'ADD_MEMBER', addMember.payload, ALL);
  assert.deepEqual(Object.keys(captured).sort(), [
    'captured_proposal_id', 'captured_snapshot_id', 'governed_world_id', 'outcome', 'payload_version_id',
    'proposed_operation_kind', 'required_approval_count', 'required_approval_rule', 'snapshot_captured_at', 'snapshot_member_count',
  ].sort());
  assert.equal(captured.outcome, 'CAPTURED');
  assert.equal(captured.captured_proposal_id, addMember.proposal);
  assert.equal(captured.captured_snapshot_id, addMember.snapshot);
  assert.equal(captured.governed_world_id, world.worldId);
  assert.equal(captured.proposed_operation_kind, 'ADD_MEMBER');
  assert.equal(captured.payload_version_id, addMember.payload);
  assert.equal(captured.required_approval_rule, ALL);
  assert.equal(captured.snapshot_member_count, 2, 'exactly the two current members were captured');
  assert.equal(captured.required_approval_count, 2, 'and unanimity of the captured topology is required');
  // The captured set is EPISODE identity, and it is exactly the current one.
  assert.deepEqual(await capturedTopology(addMember.snapshot),
    [world.inviterEpisode, world.targetEpisode].sort(),
    'the captured topology is the exact open episode set, by episode identity');
  assert.deepEqual(await capturedTopology(addMember.snapshot), await currentTopology(world.worldId));
  const [proposal] = await rows(`SELECT * FROM ${PROPOSALS} WHERE id=$1`, [addMember.proposal]);
  assert.equal(proposal.excluded_membership_episode_id, null, 'ADD_MEMBER excludes nobody');
  const [{ one_instant: oneInstant }] = await rows(
    `SELECT (s.captured_at = pr.created_at AND s.world_id = pr.world_id) AS one_instant
       FROM ${SNAPSHOTS} s JOIN ${PROPOSALS} pr ON pr.membership_snapshot_id = s.id WHERE s.id=$1`, [addMember.snapshot]);
  assert.equal(oneInstant, true, 'the snapshot and the proposal carry ONE database-owned instant');
  const [{ database_owned: databaseOwned }] = await rows(
    `SELECT (s.captured_at <= clock_timestamp() AND s.captured_at > clock_timestamp() - interval '1 hour') AS database_owned
       FROM ${SNAPSHOTS} s WHERE s.id=$1`, [addMember.snapshot]);
  assert.equal(databaseOwned, true, 'and it came from the database clock, never from a caller');
  // The committed result reveals no human.
  const serialized = JSON.stringify(captured);
  for (const secret of [f.inviter, f.target, f.outsider]) assert.ok(!serialized.includes(secret), 'the capture result reveals no human');

  stage = 'G02: one approval is not enough';
  await identity('postgres', f.inviter);
  const firstApproval = randomUUID();
  const [approved] = await approve(firstApproval, addMember.proposal);
  assert.deepEqual(Object.keys(approved).sort(), [
    'approval_committed_at', 'approved_proposal_id', 'approved_snapshot_id', 'approver_episode_id', 'committed_approval_id', 'outcome',
  ].sort());
  assert.equal(approved.outcome, 'APPROVED');
  assert.equal(approved.approver_episode_id, world.inviterEpisode, 'the approver is their OWN current open episode');
  assert.equal(approved.approved_snapshot_id, addMember.snapshot);
  await identity('postgres');
  const incomplete = await rejected(() => resolve(addMember.proposal, 'ADD_MEMBER', addMember.payload), INCOMPLETE);
  assert.match(incomplete.message, /SHARED_WORLD_GOVERNANCE_APPROVALS_INCOMPLETE/u, 'one of two approvals is not satisfied governance');

  stage = 'G03: both approvals satisfy the exact operation and payload version';
  await identity('postgres', f.target);
  const secondApproval = randomUUID();
  const [alsoApproved] = await approve(secondApproval, addMember.proposal);
  assert.equal(alsoApproved.approver_episode_id, world.targetEpisode);
  await identity('postgres');
  const [satisfied] = await resolve(addMember.proposal, 'ADD_MEMBER', addMember.payload);
  assert.deepEqual(Object.keys(satisfied).sort(), [
    'governed_world_id', 'outcome', 'recorded_required_approval_count', 'required_approval_count',
    'satisfied_operation_kind', 'satisfied_payload_version_id', 'satisfied_proposal_id', 'satisfied_snapshot_id',
  ].sort());
  assert.equal(satisfied.outcome, 'SATISFIED');
  assert.equal(satisfied.satisfied_proposal_id, addMember.proposal);
  assert.equal(satisfied.satisfied_snapshot_id, addMember.snapshot);
  assert.equal(satisfied.governed_world_id, world.worldId);
  assert.equal(satisfied.required_approval_count, 2);
  assert.equal(satisfied.recorded_required_approval_count, 2);

  stage = 'G04: an approved payload version cannot authorize a different one';
  const otherPayload = randomUUID();
  const staleVersion = await rejected(() => resolve(addMember.proposal, 'ADD_MEMBER', otherPayload), STALE);
  assert.match(staleVersion.message, /SHARED_WORLD_GOVERNANCE_STALE/u,
    'approvals bind the EXACT proposed payload version, never the operation alone');

  stage = 'G05: approvals for one operation cannot authorize another';
  for (const operation of ['REMOVE_MEMBER', 'REJOIN_MEMBER', 'WORLD_SETTINGS_CHANGE', 'END_WORLD']) {
    await rejected(() => resolve(addMember.proposal, operation, addMember.payload), STALE,
      /SHARED_WORLD_GOVERNANCE_STALE/u);
  }
  // And nothing in the Product changed while all of that happened.
  const after = await snapshotCounts(f.humans);
  assert.deepEqual(productOf(after), productOf(before),
    'G17: proposing, approving and resolving mutate no membership, lifecycle, Standing Context or Personal state');
  return { world, addMember, approvals: { first: firstApproval, second: secondApproval } };
}

/** G06 - G08, G14, G15: staleness that a count or a user-id comparison would have missed. */
async function verifyStaleness(f, exact) {
  const { world, addMember } = exact;
  stage = 'G06: a leave after the proposal makes it stale, and every historical row survives';
  const historyBefore = await rows(
    `SELECT (SELECT count(*)::int FROM ${SNAPSHOTS} WHERE id=$1) snapshots,
            (SELECT count(*)::int FROM ${SNAPSHOT_MEMBERS} WHERE membership_snapshot_id=$1) members,
            (SELECT count(*)::int FROM ${PROPOSALS} WHERE id=$2) proposals,
            (SELECT count(*)::int FROM ${APPROVALS} WHERE proposal_id=$2) approvals`,
    [addMember.snapshot, addMember.proposal]);
  await identity('postgres', f.target);
  const [left] = await leave(randomUUID(), world.worldId, randomUUID());
  assert.equal(left.outcome, 'LEFT', 'the frozen I-04C leave still commits beside governance');
  assert.equal(left.closed_membership_episode_id, world.targetEpisode);
  await identity('postgres');
  const stale = await rejected(() => resolve(addMember.proposal, 'ADD_MEMBER', addMember.payload), STALE);
  assert.match(stale.message, /SHARED_WORLD_GOVERNANCE_STALE/u, 'the captured topology no longer matches current topology');
  const historyAfter = await rows(
    `SELECT (SELECT count(*)::int FROM ${SNAPSHOTS} WHERE id=$1) snapshots,
            (SELECT count(*)::int FROM ${SNAPSHOT_MEMBERS} WHERE membership_snapshot_id=$1) members,
            (SELECT count(*)::int FROM ${PROPOSALS} WHERE id=$2) proposals,
            (SELECT count(*)::int FROM ${APPROVALS} WHERE proposal_id=$2) approvals`,
    [addMember.snapshot, addMember.proposal]);
  assert.deepEqual(historyAfter, historyBefore, 'staleness deletes nothing: the historical rows are exactly as they were');
  assert.deepEqual(await capturedTopology(addMember.snapshot), [world.inviterEpisode, world.targetEpisode].sort(),
    'and the captured topology was never rewritten to match the new one');
  // An approval can no longer be recorded against it either.
  await identity('postgres', f.inviter);
  await rejected(() => approve(randomUUID(), addMember.proposal), STALE, /SHARED_WORLD_GOVERNANCE_STALE/u);
  await identity('postgres');

  stage = 'G07 / G15: a leave then a REJOIN by the same human leaves the old proposal stale';
  const rejoined = await futureEpisode(world.worldId, f.target);
  // The trap, made explicit: the human set is identical again and the member count
  // is identical again. Only the EPISODE set differs, which is why episode identity
  // is the topology identity.
  const [{ humans_identical: humansIdentical, counts_identical: countsIdentical }] = await rows(
    `SELECT (SELECT array_agg(DISTINCT e.user_id ORDER BY e.user_id) FROM ${EPISODES} e
              WHERE e.world_id=$1 AND e.ended_at IS NULL)
            = (SELECT array_agg(DISTINCT e2.user_id ORDER BY e2.user_id) FROM ${SNAPSHOT_MEMBERS} m
                 JOIN ${EPISODES} e2 ON e2.id = m.membership_episode_id WHERE m.membership_snapshot_id=$2) AS humans_identical,
            (SELECT count(*) FROM ${EPISODES} e WHERE e.world_id=$1 AND e.ended_at IS NULL)
            = (SELECT count(*) FROM ${SNAPSHOT_MEMBERS} m WHERE m.membership_snapshot_id=$2) AS counts_identical`,
    [world.worldId, addMember.snapshot]);
  assert.equal(humansIdentical, true, 'the current HUMAN set is identical to the captured one again');
  assert.equal(countsIdentical, true, 'and so is the member COUNT: either comparison would have accepted this');
  assert.notDeepEqual(await currentTopology(world.worldId), await capturedTopology(addMember.snapshot),
    'but the EPISODE set differs, which is what exact topology identity means');
  await rejected(() => resolve(addMember.proposal, 'ADD_MEMBER', addMember.payload), STALE, /SHARED_WORLD_GOVERNANCE_STALE/u);
  // G15: the later rejoin episode cannot revive the old proposal by approving it.
  await identity('postgres', f.target);
  await rejected(() => approve(randomUUID(), addMember.proposal), STALE, /SHARED_WORLD_GOVERNANCE_STALE/u);
  await identity('postgres');
  await removeFutureEpisode(rejoined);

  stage = 'G08: a FRESH proposal over the new topology requires exactly the one remaining human, and satisfies';
  assert.deepEqual(await currentTopology(world.worldId), [world.inviterEpisode], 'one active human remains');
  const survivor = { ...ids(), payload: randomUUID() };
  const [fresh] = await capture(survivor, world.worldId, 'WORLD_SETTINGS_CHANGE', survivor.payload, ALL);
  assert.equal(fresh.snapshot_member_count, 1);
  assert.equal(fresh.required_approval_count, 1, 'one current human means exactly one required approval - not zero');
  assert.deepEqual(await capturedTopology(survivor.snapshot), [world.inviterEpisode]);

  stage = 'G14: a FORMER member cannot approve current governance';
  await identity('postgres', f.target);
  await rejected(() => approve(randomUUID(), survivor.proposal), UNAVAILABLE, /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
  stage = 'G13: and neither can a human who was never a member';
  await identity('postgres', f.outsider);
  await rejected(() => approve(randomUUID(), survivor.proposal), UNAVAILABLE, /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
  await identity('postgres', f.inviter);
  const [survivorApproved] = await approve(randomUUID(), survivor.proposal);
  assert.equal(survivorApproved.approver_episode_id, world.inviterEpisode);
  await identity('postgres');
  const [survivorSatisfied] = await resolve(survivor.proposal, 'WORLD_SETTINGS_CHANGE', survivor.payload);
  assert.equal(survivorSatisfied.outcome, 'SATISFIED');
  assert.equal(survivorSatisfied.required_approval_count, 1);
  return { world, survivor };
}

/** G09, G12: empty-set unanimity is never approval. */
async function verifyEmptySetRefusals(f) {
  stage = 'G09: zero active humans cannot open ordinary governance';
  const world = await provisionWorld(f.inviter, f.emptyTarget, 'empty');
  await identity('postgres', f.emptyTarget);
  await leave(randomUUID(), world.worldId, randomUUID());
  await identity('postgres', f.inviter);
  await leave(randomUUID(), world.worldId, randomUUID());
  await identity('postgres');
  assert.deepEqual(await currentTopology(world.worldId), [], 'the World is the inert zero-active-human state');
  const [inert] = await rows(`SELECT lifecycle, phase, closed_at FROM ${WORLDS} WHERE id=$1`, [world.worldId]);
  assert.deepEqual([inert.lifecycle, inert.phase, inert.closed_at], ['ACTIVE', 'STANDARD', null],
    'and it is still ACTIVE / STANDARD, inert rather than closed');
  for (const operation of ['ADD_MEMBER', 'REJOIN_MEMBER', 'WORLD_SETTINGS_CHANGE', 'END_WORLD']) {
    await rejected(() => capture(ids(), world.worldId, operation, randomUUID(), ALL), UNAVAILABLE,
      /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
  }
  const [{ n: noSnapshot }] = await rows(`SELECT count(*)::int n FROM ${SNAPSHOTS} WHERE world_id=$1`, [world.worldId]);
  assert.equal(noSnapshot, 0, 'and no empty captured topology was left behind');

  stage = 'G12: a sole current human cannot be removed through an empty required set';
  const solo = await provisionWorld(f.inviter, f.soloTarget, 'solo');
  await identity('postgres', f.soloTarget);
  await leave(randomUUID(), solo.worldId, randomUUID());
  await identity('postgres');
  assert.deepEqual(await currentTopology(solo.worldId), [solo.inviterEpisode], 'exactly one human remains');
  await rejected(() => capture(ids(), solo.worldId, 'REMOVE_MEMBER', randomUUID(), EXCEPT_TARGET, f.inviter), UNAVAILABLE,
    /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
  const [{ n: noSoloSnapshot }] = await rows(`SELECT count(*)::int n FROM ${SNAPSHOTS} WHERE world_id=$1`, [solo.worldId]);
  assert.equal(noSoloSnapshot, 0, 'a refused removal leaves no orphan captured topology');
  // And a removal naming a human who is not a current member reaches the same
  // bounded class, so nothing here is a membership oracle.
  await rejected(() => capture(ids(), solo.worldId, 'REMOVE_MEMBER', randomUUID(), EXCEPT_TARGET, f.soloTarget), UNAVAILABLE,
    /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
  await rejected(() => capture(ids(), solo.worldId, 'REMOVE_MEMBER', randomUUID(), EXCEPT_TARGET, f.outsider), UNAVAILABLE,
    /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
  return { emptyWorld: world.worldId, soloWorld: solo.worldId };
}

/** G10, G11: the removal exclusion. */
async function verifyRemovalExclusion(f) {
  stage = 'G10: a REMOVE_MEMBER snapshot CONTAINS the target, and the required set excludes only the target';
  const world = await provisionWorld(f.inviter, f.removalTarget, 'removal');
  // Add-member is the consumer this foundation exists to enable and does not exist
  // yet, so the third member arrives as a controlled owner-written episode.
  const thirdEpisode = await futureEpisode(world.worldId, f.removalThird);
  await identity('postgres');
  const removal = { ...ids(), payload: randomUUID() };
  const [captured] = await capture(removal, world.worldId, 'REMOVE_MEMBER', removal.payload, EXCEPT_TARGET, f.removalTarget);
  assert.equal(captured.required_approval_rule, EXCEPT_TARGET);
  assert.equal(captured.snapshot_member_count, 3, 'all three current members are inside the captured topology');
  assert.equal(captured.required_approval_count, 2, 'and exactly the two non-targets are required');
  const topology = await capturedTopology(removal.snapshot);
  assert.deepEqual(topology, [world.inviterEpisode, world.targetEpisode, thirdEpisode].sort(),
    'the removal target WAS a current member, and the captured topology says so truthfully');
  const [proposal] = await rows(`SELECT * FROM ${PROPOSALS} WHERE id=$1`, [removal.proposal]);
  assert.equal(proposal.excluded_membership_episode_id, world.targetEpisode,
    'the exclusion is the target EXACT current open episode, resolved under the World lock');

  stage = 'G11: the excluded removal target cannot approve their own removal';
  await identity('postgres', f.removalTarget);
  const refused = await rejected(() => approve(randomUUID(), removal.proposal), UNAVAILABLE);
  assert.match(refused.message, /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u,
    'and the refusal is the same bounded class a non-member reaches, so it enumerates nothing');
  await identity('postgres');
  const [{ n: noTargetApproval }] = await rows(
    `SELECT count(*)::int n FROM ${APPROVALS} WHERE proposal_id=$1 AND membership_episode_id=$2`,
    [removal.proposal, world.targetEpisode]);
  assert.equal(noTargetApproval, 0, 'no approval was recorded for the excluded target');

  stage = 'G10: satisfaction requires exactly the two non-targets, and nothing else';
  await identity('postgres', f.inviter);
  await approve(randomUUID(), removal.proposal);
  await identity('postgres');
  await rejected(() => resolve(removal.proposal, 'REMOVE_MEMBER', removal.payload), INCOMPLETE,
    /SHARED_WORLD_GOVERNANCE_APPROVALS_INCOMPLETE/u);
  await identity('postgres', f.removalThird);
  await approve(randomUUID(), removal.proposal);
  await identity('postgres');
  const [satisfied] = await resolve(removal.proposal, 'REMOVE_MEMBER', removal.payload);
  assert.equal(satisfied.outcome, 'SATISFIED');
  assert.equal(satisfied.required_approval_count, 2);
  assert.equal(satisfied.recorded_required_approval_count, 2);
  // And satisfaction removed nobody: I-04D commits no membership mutation at all.
  assert.deepEqual(await currentTopology(world.worldId), topology,
    'a satisfied removal proposal is a proof, not a removal: the target is still a current member');
  // The third episode is NOT removed here: the captured topology references it with
  // a restrictive foreign key, which is exactly the protection being proven. The
  // whole behaviour phase is rolled back.
  return { world, removal };
}

/** G18: equivalent historical retries, and every durable identity conflict. */
async function verifyIdempotency(f, exact, staleness, other) {
  const { world, addMember } = exact;
  stage = 'G18: an equivalent capture retry returns the committed historical result, after topology moved on';
  const before = await snapshotCounts(f.humans);
  await identity('postgres');
  const [original] = await rows(`SELECT * FROM ${PROPOSALS} WHERE id=$1`, [addMember.proposal]);
  const [retry] = await capture(addMember, world.worldId, 'ADD_MEMBER', addMember.payload, ALL);
  assert.equal(retry.outcome, 'CAPTURED');
  assert.equal(retry.captured_proposal_id, addMember.proposal);
  assert.equal(retry.captured_snapshot_id, addMember.snapshot);
  assert.equal(retry.snapshot_member_count, 2, 'the HISTORICAL member count, not the current one');
  assert.equal(retry.required_approval_count, 2);
  assert.equal(retry.snapshot_captured_at.getTime(), original.created_at.getTime(), 'and the historical instant, not a new one');
  const after = await snapshotCounts(f.humans);
  assert.equal(after.snapshots, before.snapshots, 'the retry created no second captured topology');
  assert.equal(after.proposals, before.proposals, 'and no second proposal');
  assert.equal(after.snapshot_members, before.snapshot_members, 'and no second membership row');

  stage = 'G18: an equivalent approval retry returns the committed historical approval';
  await identity('postgres', f.inviter);
  const [committedApproval] = await rows(`SELECT * FROM ${APPROVALS} WHERE id=$1`, [exact.approvals.first]);
  const [approvalRetry] = await approve(exact.approvals.first, addMember.proposal);
  assert.equal(approvalRetry.outcome, 'APPROVED');
  assert.equal(approvalRetry.committed_approval_id, exact.approvals.first);
  assert.equal(approvalRetry.approver_episode_id, world.inviterEpisode);
  assert.equal(approvalRetry.approval_committed_at.getTime(), committedApproval.approved_at.getTime());
  await identity('postgres');
  const afterApprovalRetry = await snapshotCounts(f.humans);
  assert.equal(afterApprovalRetry.approvals, before.approvals, 'and created no second approval');

  stage = 'G18: a reused proposal id with ANY different semantics fails closed';
  for (const [label, run] of [
    ['a different World', () => capture({ proposal: addMember.proposal, snapshot: randomUUID() },
      other.world.worldId, 'ADD_MEMBER', addMember.payload, ALL)],
    ['a different captured topology id', () => capture({ proposal: addMember.proposal, snapshot: randomUUID() },
      world.worldId, 'ADD_MEMBER', addMember.payload, ALL)],
    ['a different operation', () => capture(addMember, world.worldId, 'END_WORLD', addMember.payload, ALL)],
    ['a different payload version', () => capture(addMember, world.worldId, 'ADD_MEMBER', randomUUID(), ALL)],
  ]) {
    await rejected(run, CONFLICT, /SHARED_WORLD_GOVERNANCE_ID_CONFLICT/u);
    assert.ok(label, 'every differing identity is a conflict, never a silent rebind');
  }

  stage = 'G18: a captured topology id is NEVER re-bound to a second proposal or to current topology';
  await rejected(() => capture({ proposal: randomUUID(), snapshot: addMember.snapshot },
    world.worldId, 'ADD_MEMBER', randomUUID(), ALL), CONFLICT, /SHARED_WORLD_GOVERNANCE_ID_CONFLICT/u);
  assert.deepEqual(await capturedTopology(addMember.snapshot), [world.inviterEpisode, world.targetEpisode].sort(),
    'the captured topology is exactly what it always was');

  stage = 'G18: a reused approval id with different semantics fails closed';
  await identity('postgres', f.inviter);
  await rejected(() => approve(exact.approvals.first, staleness.survivor.proposal), CONFLICT,
    /SHARED_WORLD_GOVERNANCE_ID_CONFLICT/u);
  // And a DIFFERENT human cannot adopt a committed approval id.
  await identity('postgres', f.target);
  await rejected(() => approve(exact.approvals.first, addMember.proposal), CONFLICT,
    /SHARED_WORLD_GOVERNANCE_ID_CONFLICT/u);
  await identity('postgres');

  stage = 'G18: shape refusals, and an unauthenticated approval';
  await rejected(() => capture({ proposal: randomUUID(), snapshot: randomUUID() }, world.worldId, 'GRANT_HISTORY_ACCESS', randomUUID(), ALL),
    INVALID_PARAMETER, /SHARED_WORLD_GOVERNANCE_COMMAND_INVALID/u);
  await rejected(() => capture({ proposal: randomUUID(), snapshot: randomUUID() }, world.worldId, 'ADD_MEMBER', randomUUID(), EXCEPT_TARGET),
    INVALID_PARAMETER, /SHARED_WORLD_GOVERNANCE_COMMAND_INVALID/u);
  await rejected(() => capture({ proposal: randomUUID(), snapshot: randomUUID() }, world.worldId, 'ADD_MEMBER', randomUUID(), ALL, f.inviter),
    INVALID_PARAMETER, /SHARED_WORLD_GOVERNANCE_COMMAND_INVALID/u);
  await rejected(() => capture({ proposal: randomUUID(), snapshot: randomUUID() }, world.worldId, 'REMOVE_MEMBER', randomUUID(), EXCEPT_TARGET),
    INVALID_PARAMETER, /SHARED_WORLD_GOVERNANCE_COMMAND_INVALID/u);
  // QANDEEL and every service execution path fail closed: an approval with no human
  // session identity can never be manufactured.
  const unauthenticated = await rejected(() => approve(randomUUID(), staleness.survivor.proposal), INSUFFICIENT_PRIVILEGE);
  assert.match(unauthenticated.message, /SHARED_WORLD_GOVERNANCE_AUTHENTICATION_REQUIRED/u,
    'service execution cannot manufacture human approval');
  // A proposal that does not exist reaches the same bounded class as a non-member.
  await identity('postgres', f.inviter);
  await rejected(() => approve(randomUUID(), randomUUID()), UNAVAILABLE, /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
  await identity('postgres');
  await rejected(() => resolve(randomUUID(), 'ADD_MEMBER', randomUUID()), UNAVAILABLE, /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
  await rejected(() => capture(ids(), randomUUID(), 'ADD_MEMBER', randomUUID(), ALL), UNAVAILABLE,
    /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
}

/** G19: another World's topology is not this World's business. */
async function verifyUnrelatedWorld(f, staleness) {
  stage = 'G19: an unrelated World topology change stales nothing here';
  const [beforeSatisfied] = await resolve(staleness.survivor.proposal, 'WORLD_SETTINGS_CHANGE', staleness.survivor.payload);
  assert.equal(beforeSatisfied.outcome, 'SATISFIED');
  const other = await provisionWorld(f.inviter, f.unrelatedTarget, 'unrelated');
  await identity('postgres', f.unrelatedTarget);
  await leave(randomUUID(), other.worldId, randomUUID());
  await identity('postgres');
  const [afterSatisfied] = await resolve(staleness.survivor.proposal, 'WORLD_SETTINGS_CHANGE', staleness.survivor.payload);
  assert.deepEqual(afterSatisfied, beforeSatisfied, 'the proof is unchanged: topology is per exact World');
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
  /**
   * The bounded-refusal assertion for THIS phase.
   *
   * The behaviour phase's `rejected` helper opens a SAVEPOINT, which is only legal
   * inside a transaction block; the concurrency phase runs on the autocommit main
   * connection, so it needs the plain form.
   */
  const failedWith = async (run, code, message) => {
    const error = await failureOf(run());
    assert.ok(error, 'operation unexpectedly succeeded');
    assert.equal(error.code, code, `unexpected rejection code ${error?.code}: ${error?.message}`);
    assert.match(error.message, message);
    return error;
  };
  const captureOn = (conn, identifiers, worldId, operation, payload, rule, excluded = null) =>
    conn.query(CAPTURE_SQL, [identifiers.proposal, identifiers.snapshot, worldId, operation, payload, rule, excluded]);

  const [{ n: deadlocksBefore }] = await rows(
    'SELECT COALESCE(sum(deadlocks), 0)::int n FROM pg_stat_database WHERE datname = current_database()');

  try {
    const a = await open();
    const b = await open();

    stage = 'concurrency 1: a proposal committing FIRST captures the old topology, and the later leave stales it';
    const proposalFirst = c.worlds.proposalFirst;
    const pf = { ...ids(), payload: randomUUID() };
    await asOwnerFor(a, c.inviter); await asOwnerFor(b, c.targetA);
    const capturedFirst = await captureOn(a, pf, proposalFirst.worldId, 'ADD_MEMBER', pf.payload, ALL);
    assert.equal(capturedFirst.rows[0].snapshot_member_count, 2);
    const queuedLeave = b.query(LEAVE_SQL, [randomUUID(), proposalFirst.worldId, randomUUID()]);
    assert.equal(await blocks(queuedLeave), 'BLOCKED', 'the leave queues on the exact World row the capture holds');
    await a.query('COMMIT');
    assert.equal((await queuedLeave).rows[0].outcome, 'LEFT', 'and then proceeds');
    await b.query('COMMIT');
    await failedWith(() => resolve(pf.proposal, 'ADD_MEMBER', pf.payload), '40001', /SHARED_WORLD_GOVERNANCE_STALE/u);

    stage = 'concurrency 1: a leave committing FIRST makes the later proposal capture the NEW topology';
    const leaveFirst = c.worlds.leaveFirst;
    const lf = { ...ids(), payload: randomUUID() };
    await asOwnerFor(a, c.targetB); await asOwnerFor(b, c.inviter);
    await a.query(LEAVE_SQL, [randomUUID(), leaveFirst.worldId, randomUUID()]);
    const queuedCapture = captureOn(b, lf, leaveFirst.worldId, 'ADD_MEMBER', lf.payload, ALL);
    assert.equal(await blocks(queuedCapture), 'BLOCKED', 'the capture queues behind the leave holding the World row');
    await a.query('COMMIT');
    const capturedAfterLeave = await queuedCapture;
    assert.equal(capturedAfterLeave.rows[0].snapshot_member_count, 1, 'it captured the topology the leave produced, not the old one');
    assert.equal(capturedAfterLeave.rows[0].required_approval_count, 1);
    await b.query('COMMIT');
    assert.deepEqual(await capturedTopology(capturedAfterLeave.rows[0].captured_snapshot_id),
      await currentTopology(leaveFirst.worldId), 'and it is exactly the current topology');

    stage = 'concurrency 2: an approval commits historically, and a later leave stales the proposal it belonged to';
    const approvalVsLeave = c.worlds.approvalVsLeave;
    const avl = { ...ids(), payload: randomUUID() };
    await identity('postgres');
    await q('BEGIN');
    await capture(avl, approvalVsLeave.worldId, 'END_WORLD', avl.payload, ALL);
    await q('COMMIT');
    await asOwnerFor(a, c.inviter); await asOwnerFor(b, c.targetC);
    const approvedRace = await a.query(APPROVE_SQL, [randomUUID(), avl.proposal]);
    assert.equal(approvedRace.rows[0].outcome, 'APPROVED');
    const leaveAfterApproval = b.query(LEAVE_SQL, [randomUUID(), approvalVsLeave.worldId, randomUUID()]);
    assert.equal(await blocks(leaveAfterApproval), 'BLOCKED', 'the leave queues on the World row the approval holds');
    await a.query('COMMIT');
    assert.equal((await leaveAfterApproval).rows[0].outcome, 'LEFT');
    await b.query('COMMIT');
    const [{ n: approvalSurvives }] = await rows(`SELECT count(*)::int n FROM ${APPROVALS} WHERE proposal_id=$1`, [avl.proposal]);
    assert.equal(approvalSurvives, 1, 'the committed approval remains historical truth');
    await failedWith(() => resolve(avl.proposal, 'END_WORLD', avl.payload), '40001', /SHARED_WORLD_GOVERNANCE_STALE/u);
    // Old authority never applies to the new topology.
    await asOwnerFor(a, c.inviter);
    const staleApproval = await failureOf(a.query(APPROVE_SQL, [randomUUID(), avl.proposal]));
    assert.equal(staleApproval.code, '40001', 'and no further approval can be added to it either');
    await a.query('ROLLBACK');

    stage = 'concurrency 3: two IDENTICAL capture retries produce ONE topology and ONE proposal';
    const identical = c.worlds.identical;
    const shared = { ...ids(), payload: randomUUID() };
    await asOwnerFor(a, c.inviter); await asOwnerFor(b, c.inviter);
    const won = await captureOn(a, shared, identical.worldId, 'ADD_MEMBER', shared.payload, ALL);
    const duplicate = captureOn(b, shared, identical.worldId, 'ADD_MEMBER', shared.payload, ALL);
    assert.equal(await blocks(duplicate), 'BLOCKED', 'the duplicate queues on the exact World row');
    await a.query('COMMIT');
    const duplicateResult = await duplicate;
    assert.deepEqual(duplicateResult.rows[0], won.rows[0], 'both callers receive the SAME committed historical result');
    await b.query('COMMIT');
    const [{ n: oneSnapshot }] = await rows(`SELECT count(*)::int n FROM ${SNAPSHOTS} WHERE id=$1`, [shared.snapshot]);
    assert.equal(oneSnapshot, 1, 'exactly one captured topology');
    const [{ n: oneProposal }] = await rows(`SELECT count(*)::int n FROM ${PROPOSALS} WHERE id=$1`, [shared.proposal]);
    assert.equal(oneProposal, 1, 'and exactly one proposal');

    stage = 'concurrency 4 / 5: a reused proposal id and a reused topology id under competing semantics leave no orphan';
    const conflict = c.worlds.conflict;
    const loser = { proposal: shared.proposal, snapshot: randomUUID(), payload: randomUUID() };
    await asOwnerFor(a, c.inviter);
    const proposalIdConflict = await failureOf(captureOn(a, loser, conflict.worldId, 'ADD_MEMBER', loser.payload, ALL));
    assert.equal(proposalIdConflict.code, '23505', 'a committed proposal id is never re-bound to another World');
    assert.match(proposalIdConflict.message, /SHARED_WORLD_GOVERNANCE_ID_CONFLICT/u);
    await a.query('ROLLBACK');
    const rebind = { proposal: randomUUID(), snapshot: shared.snapshot, payload: randomUUID() };
    await asOwnerFor(a, c.inviter);
    const snapshotIdConflict = await failureOf(captureOn(a, rebind, conflict.worldId, 'ADD_MEMBER', rebind.payload, ALL));
    assert.equal(snapshotIdConflict.code, '23505', 'and a committed topology id is never re-bound to a second proposal');
    await a.query('ROLLBACK');
    const [{ n: noOrphan }] = await rows(
      `SELECT (SELECT count(*)::int FROM ${SNAPSHOTS} WHERE id=$1)
             + (SELECT count(*)::int FROM ${PROPOSALS} WHERE id=$2) AS n`, [loser.snapshot, rebind.proposal]);
    assert.equal(noOrphan, 0, 'neither refusal left an orphan captured topology or proposal behind');

    stage = 'concurrency 6 / 7: identical approval retries, and two approval ids from ONE episode';
    const identicalApproval = c.worlds.identicalApproval;
    const ia = { ...ids(), payload: randomUUID() };
    await identity('postgres');
    await q('BEGIN');
    await capture(ia, identicalApproval.worldId, 'ADD_MEMBER', ia.payload, ALL);
    await q('COMMIT');
    const sharedApproval = randomUUID();
    await asOwnerFor(a, c.targetF); await asOwnerFor(b, c.targetF);
    const wonApproval = await a.query(APPROVE_SQL, [sharedApproval, ia.proposal]);
    const duplicateApproval = b.query(APPROVE_SQL, [sharedApproval, ia.proposal]);
    assert.equal(await blocks(duplicateApproval), 'BLOCKED', 'the duplicate queues on the exact World row');
    await a.query('COMMIT');
    assert.deepEqual((await duplicateApproval).rows[0], wonApproval.rows[0], 'both callers receive the SAME committed approval');
    await b.query('COMMIT');
    // A DIFFERENT approval id from the same episode cannot create a second effective approval.
    await asOwnerFor(a, c.targetF);
    const secondEffective = await failureOf(a.query(APPROVE_SQL, [randomUUID(), ia.proposal]));
    assert.equal(secondEffective.code, '23505', 'one snapshot episode is worth exactly one effective approval');
    await a.query('ROLLBACK');
    const [{ n: oneApproval }] = await rows(`SELECT count(*)::int n FROM ${APPROVALS} WHERE proposal_id=$1`, [ia.proposal]);
    assert.equal(oneApproval, 1, 'exactly one approval row exists');
    // And one human approving twice never covers a two-human requirement.
    await failedWith(() => resolve(ia.proposal, 'ADD_MEMBER', ia.payload), '55000',
      /SHARED_WORLD_GOVERNANCE_APPROVALS_INCOMPLETE/u);

    stage = 'concurrency 8: different required humans approve safely, and satisfaction appears only when the set is covered';
    const coverage = c.worlds.coverage;
    const cov = { ...ids(), payload: randomUUID() };
    await identity('postgres');
    await q('BEGIN');
    await capture(cov, coverage.worldId, 'WORLD_SETTINGS_CHANGE', cov.payload, ALL);
    await q('COMMIT');
    await asOwnerFor(a, c.inviter); await asOwnerFor(b, c.targetG);
    const firstHalf = await a.query(APPROVE_SQL, [randomUUID(), cov.proposal]);
    assert.equal(firstHalf.rows[0].outcome, 'APPROVED');
    // Inside its OWN transaction the first human sees exactly one approval, and one
    // is not enough. Asked here rather than from the main connection: the resolver
    // locks the World row, and between the two commits that row is held by b.
    await a.query('SAVEPOINT partial_coverage');
    const partial = await failureOf(a.query(RESOLVE_SQL, [cov.proposal, 'WORLD_SETTINGS_CHANGE', cov.payload]));
    assert.equal(partial?.code, '55000', 'one of two required approvals is not satisfied governance');
    assert.match(partial.message, /SHARED_WORLD_GOVERNANCE_APPROVALS_INCOMPLETE/u);
    await a.query('ROLLBACK TO SAVEPOINT partial_coverage');
    const secondHalf = b.query(APPROVE_SQL, [randomUUID(), cov.proposal]);
    assert.equal(await blocks(secondHalf), 'BLOCKED', 'the second human queues on the same World row rather than racing it');
    await a.query('COMMIT');
    assert.equal((await secondHalf).rows[0].outcome, 'APPROVED');
    await b.query('COMMIT');
    const [covered] = await resolve(cov.proposal, 'WORLD_SETTINGS_CHANGE', cov.payload);
    assert.equal(covered.outcome, 'SATISFIED');
    assert.equal(covered.required_approval_count, 2);
    assert.equal(covered.recorded_required_approval_count, 2);

    stage = 'concurrency 9: an unrelated World topology change stales nothing here';
    const unrelated = c.worlds.unrelated;
    await asOwnerFor(a, c.targetH);
    await a.query(LEAVE_SQL, [randomUUID(), unrelated.worldId, randomUUID()]);
    await a.query('COMMIT');
    const [stillCovered] = await resolve(cov.proposal, 'WORLD_SETTINGS_CHANGE', cov.payload);
    assert.deepEqual(stillCovered, covered, 'the proof is unchanged: topology is per exact World');

    stage = 'concurrency: no deadlock, and no orphan or incoherent row among everything these races produced';
    const [{ n: deadlocksAfter }] = await rows(
      'SELECT COALESCE(sum(deadlocks), 0)::int n FROM pg_stat_database WHERE datname = current_database()');
    assert.equal(deadlocksAfter, deadlocksBefore, 'the World-first lock order produced no deadlock across any of these races');
    const raced = Object.values(c.worlds).map((world) => world.worldId);
    const [shape] = await rows(
      `SELECT (SELECT count(*)::int FROM ${PROPOSALS} pr LEFT JOIN ${SNAPSHOTS} s ON s.id = pr.membership_snapshot_id
                WHERE pr.world_id = ANY($1::uuid[]) AND (s.id IS NULL OR s.world_id <> pr.world_id OR s.captured_at <> pr.created_at)) incoherent_proposals,
              (SELECT count(*)::int FROM ${SNAPSHOTS} s LEFT JOIN ${PROPOSALS} pr ON pr.membership_snapshot_id = s.id
                WHERE s.world_id = ANY($1::uuid[]) AND pr.id IS NULL) orphan_snapshots,
              (SELECT count(*)::int FROM ${SNAPSHOT_MEMBERS} m JOIN ${SNAPSHOTS} s ON s.id = m.membership_snapshot_id
                 LEFT JOIN ${EPISODES} e ON e.id = m.membership_episode_id
                WHERE s.world_id = ANY($1::uuid[]) AND (e.id IS NULL OR e.world_id <> s.world_id)) foreign_members,
              (SELECT count(*)::int FROM ${APPROVALS} ap JOIN ${PROPOSALS} pr ON pr.id = ap.proposal_id
                WHERE pr.world_id = ANY($1::uuid[]) AND ap.membership_snapshot_id <> pr.membership_snapshot_id) unbound_approvals,
              (SELECT count(*)::int FROM ${WORLDS} w
                WHERE w.id = ANY($1::uuid[]) AND NOT (w.lifecycle='ACTIVE' AND w.phase='STANDARD' AND w.closed_at IS NULL)) closed_worlds`,
      [raced]);
    assert.deepEqual(shape,
      { incoherent_proposals: 0, orphan_snapshots: 0, foreign_members: 0, unbound_approvals: 0, closed_worlds: 0 },
      'every captured topology belongs to its proposal and its World, every approval to its exact proposal and topology, and no World was closed by governance');
  } finally {
    for (const conn of connections) await conn.end().catch(() => undefined);
  }
}

/**
 * FORWARD SAFETY, proven against real PostgreSQL rather than only in the static
 * mirror contract.
 *
 * This verifier runs against a FULLY migrated database, so it is the place where a
 * live-schema ceiling does its damage: it would start failing the moment the
 * add-member consumer this foundation exists to serve actually landed. So the
 * repository is pushed several authorized steps into its future - a member
 * invitation table, a consumer-owned immutable payload/version table, a consumer
 * foreign key into a proposal, a broader operation vocabulary, an additive column,
 * an additive index and a later Launch Gate table - and THIS verifier's own catalog
 * proof is required to still pass. Then the regressions it must still refuse are
 * planted, so the forward safety is not bought by asserting nothing.
 */
async function verifyForwardSafety(f) {
  stage = 'forward safety: the add-member consumer and a Launch Gate do not fail this historical verifier';
  await identity('postgres');
  const probe = `i04d_forward_safety_probe_${randomUUID().replace(/-/gu, '')}`;
  await q('SAVEPOINT forward_safety');
  try {
    await q(`CREATE TABLE public.${probe}_invitations (id uuid PRIMARY KEY)`);
    await q(`CREATE TABLE public.${probe}_payload_versions (id uuid PRIMARY KEY, target_user_id uuid NOT NULL)`);
    await q(`CREATE TABLE public.${probe}_launch_gates (id uuid PRIMARY KEY, capability text NOT NULL)`);
    // A consumer-specific foreign key INTO this substrate, with a deletion rule 0084
    // has no authority over.
    await q(`ALTER TABLE public.${probe}_invitations ADD COLUMN proposal_id uuid`);
    await q(`ALTER TABLE public.${probe}_invitations ADD CONSTRAINT ${probe}_proposal_fk
             FOREIGN KEY (proposal_id) REFERENCES ${PROPOSALS} (id) ON DELETE RESTRICT`);
    // Additive evolution of the tables 0084 owns.
    await q(`ALTER TABLE ${APPROVALS} ADD COLUMN ${probe}_client_epoch bigint`);
    await q(`ALTER TABLE ${PROPOSALS} ADD COLUMN ${probe}_invitation_id uuid`);
    await q(`ALTER TABLE ${PROPOSALS} ADD CONSTRAINT ${probe}_operation_check
             CHECK (operation_kind IN ('ADD_MEMBER','REMOVE_MEMBER','REJOIN_MEMBER','WORLD_SETTINGS_CHANGE','END_WORLD','GRANT_HISTORY_ACCESS'))`);
    await q(`CREATE INDEX ${probe}_created_idx ON ${PROPOSALS} (world_id, created_at)`);
    // A later operation-specific function, granted to an application role.
    await q(`CREATE FUNCTION public.${probe}_commit_add_member_v1(p_command_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    await q(`GRANT EXECUTE ON FUNCTION public.${probe}_commit_add_member_v1(uuid) TO authenticated`);
    await verifyCatalog();

    // And the whole foundation still works beside all of it.
    const world = await provisionWorld(f.inviter, f.forwardTarget, 'forward');
    const forward = { ...ids(), payload: randomUUID() };
    await identity('postgres');
    const [captured] = await capture(forward, world.worldId, 'ADD_MEMBER', forward.payload, ALL);
    assert.equal(captured.outcome, 'CAPTURED', 'a proposal still captures beside the later authorized schema');
    for (const human of [f.inviter, f.forwardTarget]) {
      await identity('postgres', human);
      await approve(randomUUID(), forward.proposal);
    }
    await identity('postgres');
    const [satisfied] = await resolve(forward.proposal, 'ADD_MEMBER', forward.payload);
    assert.equal(satisfied.outcome, 'SATISFIED', 'and still resolves as satisfied');

    stage = 'forward safety: a real regression is still refused';
    for (const [reason, plant, refuses] of [
      ['the one-effective-approval rule 0084 owns is dropped',
        `ALTER TABLE ${APPROVALS} DROP CONSTRAINT shared_world_governance_approvals_one_per_episode_key`,
        /shared_world_governance_approvals_one_per_episode_key/u],
      ['the proposal-to-snapshot binding is reduced to a single-column reference',
        `ALTER TABLE ${APPROVALS} DROP CONSTRAINT shared_world_governance_approvals_proposal_fk,
         ADD CONSTRAINT shared_world_governance_approvals_proposal_fk
           FOREIGN KEY (proposal_id) REFERENCES ${PROPOSALS} (id) ON DELETE RESTRICT`,
        /shared_world_governance_approvals_proposal_fk/u],
      ['the snapshot-membership binding is dropped',
        `ALTER TABLE ${APPROVALS} DROP CONSTRAINT shared_world_governance_approvals_snapshot_member_fk`,
        /shared_world_governance_approvals_snapshot_member_fk/u],
      ['the captured-topology uniqueness is dropped',
        `ALTER TABLE ${SNAPSHOT_MEMBERS} DROP CONSTRAINT shared_world_membership_snapshot_members_pk CASCADE`,
        /can never name one episode twice/u],
      ['an owned foreign key stops being restrictive',
        `ALTER TABLE ${SNAPSHOT_MEMBERS} DROP CONSTRAINT shared_world_membership_snapshot_members_episode_fk,
         ADD CONSTRAINT shared_world_membership_snapshot_members_episode_fk
           FOREIGN KEY (membership_episode_id) REFERENCES ${EPISODES} (id) ON DELETE CASCADE`,
        /shared_world_membership_snapshot_members_episode_fk/u],
      ['a governance table becomes directly readable by an application role',
        `GRANT SELECT ON ${APPROVALS} TO authenticated`,
        /authenticated must not hold SELECT/u],
      ['the approving human stops being the session subject',
        `CREATE OR REPLACE FUNCTION public.commit_shared_world_governance_approval_v1(p_approval_id uuid, p_proposal_id uuid)
         RETURNS TABLE(outcome text, committed_approval_id uuid, approved_proposal_id uuid,
                       approved_snapshot_id uuid, approver_episode_id uuid, approval_committed_at timestamptz)
         LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN RETURN; END$fn$`,
        /derived, never supplied|refuses a current episode|takes exactly two row locks/u],
      ['a governance table gains a duplicated human id',
        `ALTER TABLE ${APPROVALS} ADD COLUMN actor_user_id uuid`,
        /duplicates no human id/u],
      ['a trigger couples governance to membership',
        `CREATE FUNCTION public.${probe}_trigger_fn() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN RETURN NEW; END$fn$;
         CREATE TRIGGER ${probe}_trigger AFTER INSERT ON ${APPROVALS} FOR EACH ROW EXECUTE FUNCTION public.${probe}_trigger_fn()`,
        /carries no trigger/u],
    ]) {
      await q('SAVEPOINT forward_safety_regression');
      await q(plant);
      await assert.rejects(verifyCatalog(), refuses, `a database where ${reason} must still be refused`);
      await q('ROLLBACK TO SAVEPOINT forward_safety_regression');
      await q('RELEASE SAVEPOINT forward_safety_regression');
    }
    // Every regression was reverted, so the untouched future still passes.
    stage = 'forward safety: every planted regression was reverted';
    await verifyCatalog();
  } finally {
    await identity('postgres');
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
  }
  // And the ordinary present-day catalog is intact once the future is rolled back.
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

async function main() {
  // Rolled-back fixtures for the behaviour proofs.
  const f = {
    inviter: randomUUID(), target: randomUUID(), outsider: randomUUID(),
    emptyTarget: randomUUID(), soloTarget: randomUUID(),
    removalTarget: randomUUID(), removalThird: randomUUID(),
    unrelatedTarget: randomUUID(), forwardTarget: randomUUID(),
  };
  f.humans = [f.inviter, f.target, f.outsider, f.emptyTarget, f.soloTarget,
    f.removalTarget, f.removalThird, f.unrelatedTarget, f.forwardTarget];
  // Committed fixtures for the multi-connection races, removed afterwards.
  const c = {
    inviter: randomUUID(), targetA: randomUUID(), targetB: randomUUID(), targetC: randomUUID(),
    targetD: randomUUID(), targetE: randomUUID(), targetF: randomUUID(), targetG: randomUUID(), targetH: randomUUID(),
    worlds: {},
  };
  c.humans = [c.inviter, c.targetA, c.targetB, c.targetC, c.targetD, c.targetE, c.targetF, c.targetG, c.targetH];
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
      const exact = await verifyExactProposal(f);
      const staleness = await verifyStaleness(f, exact);
      await verifyEmptySetRefusals(f);
      const removal = await verifyRemovalExclusion(f);
      await verifyIdempotency(f, exact, staleness, removal);
      await verifyUnrelatedWorld(f, staleness);
      await verifyForwardSafety(f);
      await identity('postgres');
    } finally {
      await q('ROLLBACK');
    }

    let bornWorlds = [];
    try {
      await provisionHumans(c.humans);
      // The committed fixtures are built inside ONE explicit transaction: the
      // identity helper sets the role and the JWT claim with transaction-local
      // scope, which outside a transaction block would silently do nothing.
      await q('BEGIN');
      try {
        for (const [key, target] of [['proposalFirst', c.targetA], ['leaveFirst', c.targetB], ['approvalVsLeave', c.targetC],
          ['identical', c.targetD], ['conflict', c.targetE], ['identicalApproval', c.targetF],
          ['coverage', c.targetG], ['unrelated', c.targetH]]) {
          c.worlds[key] = await provisionWorld(c.inviter, target, key);
        }
        await identity('postgres');
      } finally {
        await q('COMMIT');
      }
      await verifyConcurrency(c);
    } finally {
      stage = 'concurrency: fixture removal';
      bornWorlds = await removeFixtures(c.humans);
    }

    stage = 'G20: fixture residue';
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
            + (SELECT count(*) FROM ${SNAPSHOT_MEMBERS} m JOIN ${SNAPSHOTS} s ON s.id = m.membership_snapshot_id WHERE s.world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${PROPOSALS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${APPROVALS} a JOIN ${PROPOSALS} pr ON pr.id = a.proposal_id WHERE pr.world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${GRANTS} WHERE grantor_user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${CONSENT_EVENTS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${EPISODES} WHERE user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($2::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
      [humans, bornWorlds]);
    assert.equal(Number(n), 0, 'no fixture row remains after completion');

    console.log('migration 0084 verified: exact membership snapshot + Shared governance approval foundation');
  } catch (error) {
    console.error(`migration 0084 verification FAILED at stage: ${stage}`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

await main();
