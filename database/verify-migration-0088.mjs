// Real-PostgreSQL verifier for migration 0088 - I-04F Standard World Closure v1
// (PART B).
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// behaviour rather than from the migration text:
//
//   * catalog: the five relations exist once and still carry every column they OWN
//     - name, type, nullability AND the absence of a default - unchanged and in
//     their original positions; every owned unique binding, check and foreign key
//     is pinned by name, local columns, parent and restrictive deletion; RLS is on
//     with zero policies; and PUBLIC, anon, authenticated and service_role hold no
//     privilege at all;
//   * catalog: both primitives are postgres-owned, SECURITY DEFINER,
//     search_path-pinned, VOLATILE, derive NO actor and are executable by NO
//     application role; the closed-history reader is STABLE, service_role-only and
//     consults no membership;
//   * C01 an exact unanimously approved END_WORLD closes ACTIVE/STANDARD to
//     READ_ONLY_CLOSED/STANDARD;
//   * C02 / C03 partial approval cannot close, and payload version A's approvals
//     can never close payload version B;
//   * C04 a topology change after the END_WORLD proposal makes it stale;
//   * C07 two competing end commands produce exactly one closure;
//   * C08 / C09 / C11 every open episode closes IN PLACE with end_reason
//     WORLD_CLOSED on the ONE canonical closure instant that closed_at, the
//     WORLD_ENDED fact, the durable command and every entitlement also carry, and
//     zero episodes stay open;
//   * C10 World identity, phase, settings, governance and every historical row are
//     preserved: archival closure is not deletion;
//   * C12 the entitled humans are exactly the current human set at closure - a
//     human who had already left is never silently restored to browsing;
//   * C13 each entitlement's item set is exactly what that human could resolve
//     immediately before closure, captured through the ONE frozen I-04F resolver;
//   * C14 later history items and later baseline audience rows cannot widen the
//     frozen entitlement;
//   * C15 a later owner deletion narrows what the closed resolver returns without
//     deleting the entitlement audit;
//   * C16 / C17 / C18 a closed viewer is not an active member, and every ordinary
//     I-04C / I-04E / I-04F mutation path refuses a READ_ONLY_CLOSED World;
//   * C19 a pending member invitation cannot survive closure as actionable
//     authority: the reviewed I-04E topology trigger terminalizes it;
//   * C20 an equivalent closure retry is historically stable after a later
//     availability and privacy change;
//   * C21 a zero-active-human inert ACTIVE World cannot manufacture unanimous
//     END_WORLD from an empty set;
//   * C22 unrelated World activity never stales or widens this World's closure;
//   * C23 no Introduction closure is implemented;
//   * C24 no Personal, Public, Replay or Matching state is mutated, proven by an
//     exact count delta;
//   * C05 / C06 concurrency, with real independent connections: end versus leave
//     and end versus settings serialize World-first in both orders with no
//     deadlock and no hybrid state;
//   * forward safety: a later reviewed Introduction closure producer, the I-04G
//     material store, a reviewed privacy material mutation on an already closed
//     World, a Launch Gate, later additive columns, indexes and audit triggers are
//     created for real inside a rolled-back SAVEPOINT and this verifier still
//     passes - then every regression to something 0088 OWNS is planted and must
//     still be refused;
//   * zero fixture residue after completion.
//
// There is deliberately NO live census of any kind here: this file runs against a
// fully migrated database, so a fixed list of table names required to stay absent,
// an exact count of live constraints or a catalog sweep for future names would be
// a ceiling on the whole roadmap rather than a fact about migration 0088. What
// 0088 itself did NOT create is proven from 0088's own text, by
// database/tests/shared-world-standard-closure-v1.test.mjs.
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
const LEFT_EVENTS = 'public.shared_world_member_left_events';
const LEAVE_COMMANDS = 'public.shared_world_voluntary_leave_commands';
const SNAPSHOTS = 'public.shared_world_membership_snapshots';
const SNAPSHOT_MEMBERS = 'public.shared_world_membership_snapshot_members';
const PROPOSALS = 'public.shared_world_governance_proposals';
const APPROVALS = 'public.shared_world_governance_approvals';
const MEMBER_INVITATIONS = 'public.shared_world_member_invitations';
const ADD_PAYLOADS = 'public.shared_world_add_member_payload_versions';
const JOINED_EVENTS = 'public.shared_world_member_joined_events';
const ACCEPT_COMMANDS = 'public.shared_world_member_acceptance_commands';
const SETTINGS_VERSIONS = 'public.shared_world_settings_versions';
const SETTINGS_STATE = 'public.shared_world_settings_state';
const SETTINGS_EVENTS = 'public.shared_world_setting_changed_events';
const SETTINGS_COMMANDS = 'public.shared_world_settings_change_commands';
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
const OWN_TABLES = [PAYLOADS, ENTITLEMENTS, ENTITLEMENT_ITEMS, ENDED_EVENTS, END_COMMANDS];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

const PREPARE_FN = 'public.prepare_shared_world_standard_end_governance_v1(uuid,uuid,uuid,uuid)';
const COMMIT_FN = 'public.commit_shared_world_standard_end_v1(uuid,uuid,uuid)';
const RESOLVE_FN = 'public.resolve_shared_world_closed_history_visibility_v1(uuid,uuid)';
const MUTATION_FUNCTIONS = [PREPARE_FN, COMMIT_FN];

const INSUFFICIENT_PRIVILEGE = ['42501'];
const INVALID_PARAMETER = ['22023'];
const UNAVAILABLE = ['P0002'];
const CONFLICT = ['23505'];
const STALE = ['40001'];
const INCOMPLETE = ['55000'];
const CONTRADICTORY = ['P0001'];
const UNSUPPORTED = ['0A000'];

const ROTATE_SQL = 'SELECT command_id, credential_epoch FROM public.rotate_shared_world_invite_credential_v1($1,$2,$3)';
const SUBMIT_SQL = 'SELECT outcome, command_id, requested_invitation_id FROM public.submit_shared_world_direct_invitation_v1($1,$2,$3)';
const BIRTH_SQL = 'SELECT outcome, born_world_id FROM public.commit_shared_world_direct_acceptance_birth_v1($1,$2,$3,$4,$5)';
const LEAVE_SQL = 'SELECT outcome, closed_membership_episode_id FROM public.commit_shared_world_standard_voluntary_leave_v1($1,$2,$3)';
const GOV_APPROVE_SQL = 'SELECT outcome, committed_approval_id FROM public.commit_shared_world_governance_approval_v1($1,$2)';
const ADD_PREPARE_SQL = `SELECT outcome, prepared_proposal_id FROM public.prepare_shared_world_add_member_governance_v1($1,$2,$3,$4,$5)`;
const DISPATCH_SQL = `SELECT outcome, dispatched_invitation_id, dispatched_state
                        FROM public.dispatch_shared_world_member_invitation_v1($1,$2)`;
const REMOVE_PREPARE_SQL = `SELECT outcome, prepared_proposal_id FROM public.prepare_shared_world_remove_member_governance_v1($1,$2,$3,$4,$5)`;
const SETTINGS_PREPARE_SQL = `SELECT outcome, prepared_proposal_id
                                FROM public.prepare_shared_world_settings_change_governance_v1($1,$2,$3,$4,$5,$6,$7,$8)`;
const SETTINGS_COMMIT_SQL = `SELECT outcome, settings_command_id
                               FROM public.commit_shared_world_settings_change_v1($1,$2,$3)`;
const HISTORY_PREPARE_SQL = `SELECT outcome, prepared_manifest_version_id
                               FROM public.prepare_shared_world_history_package_v1($1,$2,$3,$4)`;
const VISIBILITY_SQL = 'SELECT world_id, history_item_id, occurred_at FROM public.resolve_shared_world_history_visibility_v1($1,$2)';
const CLOSED_VISIBILITY_SQL = 'SELECT world_id, history_item_id, occurred_at FROM public.resolve_shared_world_closed_history_visibility_v1($1,$2)';
const END_PREPARE_SQL = `SELECT outcome, prepared_proposal_id, prepared_snapshot_id, prepared_world_id,
                                prepared_operation_kind, prepared_payload_version_id, prepared_approval_rule,
                                prepared_required_approval_count, prepared_at
                           FROM public.prepare_shared_world_standard_end_governance_v1($1,$2,$3,$4)`;
const END_COMMIT_SQL = `SELECT outcome, end_command_id, ended_world_id, ended_proposal_id, ended_payload_version_id,
                               ended_event_id, closed_entitlement_count, closed_episode_count, world_closed_at
                          FROM public.commit_shared_world_standard_end_v1($1,$2,$3)`;

const prepareEnd = (p, worldId) => rows(END_PREPARE_SQL, [p.proposal, p.snapshot, p.payload, worldId]);
const commitEnd = (commandId, proposalId, eventId) => rows(END_COMMIT_SQL, [commandId, proposalId, eventId]);
const leave = (commandId, worldId, eventId) => rows(LEAVE_SQL, [commandId, worldId, eventId]);
const ids = () => ({ proposal: randomUUID(), snapshot: randomUUID(), payload: randomUUID() });
const opaqueRef = (label) => `ref:i04f-closure:${label}:${randomUUID()}`;

const UUID = 'uuid';
const TEXT = 'text';
const TSTZ = 'timestamp with time zone';

const OWNED_COLUMNS = {
  [PAYLOADS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['governance_proposal_id', UUID, 'NO', null],
    ['governance_operation_kind', TEXT, 'NO', null], ['created_at', TSTZ, 'NO', null],
  ],
  [ENTITLEMENTS]: [
    ['world_id', UUID, 'NO', null], ['user_id', UUID, 'NO', null],
    ['membership_episode_id', UUID, 'NO', null], ['entitled_at', TSTZ, 'NO', null],
  ],
  [ENTITLEMENT_ITEMS]: [
    ['world_id', UUID, 'NO', null], ['user_id', UUID, 'NO', null], ['history_item_id', UUID, 'NO', null],
  ],
  [ENDED_EVENTS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['governance_proposal_id', UUID, 'NO', null],
    ['end_payload_version_id', UUID, 'NO', null], ['occurred_at', TSTZ, 'NO', null],
  ],
  [END_COMMANDS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['governance_proposal_id', UUID, 'NO', null],
    ['end_payload_version_id', UUID, 'NO', null], ['world_ended_event_id', UUID, 'NO', null],
    ['committed_at', TSTZ, 'NO', null],
  ],
};

const OWNED_FOREIGN_KEYS = {
  shared_world_end_payload_versions_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_end_payload_versions_proposal_fk: 'FOREIGN KEY (governance_proposal_id, world_id, governance_operation_kind, id) REFERENCES shared_world_governance_proposals(id, world_id, operation_kind, proposed_payload_version_id) ON DELETE RESTRICT',
  shared_world_standard_closed_view_entitlements_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_standard_closed_view_entitlements_user_fk: 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_standard_closed_view_entitlements_episode_fk: 'FOREIGN KEY (membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_standard_closed_view_entitlement_items_holder_fk: 'FOREIGN KEY (world_id, user_id) REFERENCES shared_world_standard_closed_view_entitlements(world_id, user_id) ON DELETE RESTRICT',
  shared_world_standard_closed_view_entitlement_items_item_fk: 'FOREIGN KEY (history_item_id, world_id) REFERENCES shared_world_history_items(id, world_id) ON DELETE RESTRICT',
  shared_world_ended_events_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_ended_events_payload_fk: 'FOREIGN KEY (world_id, end_payload_version_id) REFERENCES shared_world_end_payload_versions(world_id, id) ON DELETE RESTRICT',
  shared_world_ended_events_proposal_fk: 'FOREIGN KEY (governance_proposal_id) REFERENCES shared_world_governance_proposals(id) ON DELETE RESTRICT',
  shared_world_standard_end_commands_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_standard_end_commands_payload_fk: 'FOREIGN KEY (world_id, end_payload_version_id) REFERENCES shared_world_end_payload_versions(world_id, id) ON DELETE RESTRICT',
  shared_world_standard_end_commands_proposal_fk: 'FOREIGN KEY (governance_proposal_id) REFERENCES shared_world_governance_proposals(id) ON DELETE RESTRICT',
  shared_world_standard_end_commands_event_fk: 'FOREIGN KEY (world_ended_event_id) REFERENCES shared_world_ended_events(id) ON DELETE RESTRICT',
};

const OWNED_BINDINGS = [
  [PAYLOADS, 'shared_world_end_payload_versions_pk', /PRIMARY KEY \(id\)/u],
  [PAYLOADS, 'shared_world_end_payload_versions_operation_check', /END_WORLD/u],
  [PAYLOADS, 'shared_world_end_payload_versions_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [PAYLOADS, 'shared_world_end_payload_versions_world_key', /UNIQUE \(world_id, id\)/u],
  [ENTITLEMENTS, 'shared_world_standard_closed_view_entitlements_pk', /PRIMARY KEY \(world_id, user_id\)/u],
  [ENTITLEMENTS, 'shared_world_standard_closed_view_entitlements_episode_key', /UNIQUE \(membership_episode_id\)/u],
  [ENTITLEMENT_ITEMS, 'shared_world_standard_closed_view_entitlement_items_pk',
    /PRIMARY KEY \(world_id, user_id, history_item_id\)/u],
  [ENDED_EVENTS, 'shared_world_ended_events_pk', /PRIMARY KEY \(id\)/u],
  [ENDED_EVENTS, 'shared_world_ended_events_world_key', /UNIQUE \(world_id\)/u],
  [ENDED_EVENTS, 'shared_world_ended_events_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [ENDED_EVENTS, 'shared_world_ended_events_payload_key', /UNIQUE \(end_payload_version_id\)/u],
  [END_COMMANDS, 'shared_world_standard_end_commands_pk', /PRIMARY KEY \(id\)/u],
  [END_COMMANDS, 'shared_world_standard_end_commands_world_key', /UNIQUE \(world_id\)/u],
  [END_COMMANDS, 'shared_world_standard_end_commands_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [END_COMMANDS, 'shared_world_standard_end_commands_event_key', /UNIQUE \(world_ended_event_id\)/u],
];

/** The exact count of every relation this verifier names, for the Worlds under test. */
async function sharedCounts(worldIds) {
  const [row] = await rows(
    `SELECT (SELECT count(*) FROM ${EPISODES} WHERE world_id = ANY($1::uuid[])) AS episodes,
            (SELECT count(*) FROM ${EPISODES} WHERE world_id = ANY($1::uuid[]) AND ended_at IS NULL) AS "openEpisodes",
            (SELECT count(*) FROM ${MEMBER_INVITATIONS} WHERE world_id = ANY($1::uuid[])) AS invitations,
            (SELECT count(*) FROM ${MEMBER_INVITATIONS} WHERE world_id = ANY($1::uuid[]) AND invitation_state = 'PENDING') AS "pendingInvitations",
            (SELECT count(*) FROM ${SNAPSHOTS} WHERE world_id = ANY($1::uuid[])) AS snapshots,
            (SELECT count(*) FROM ${PROPOSALS} WHERE world_id = ANY($1::uuid[])) AS proposals,
            (SELECT count(*) FROM ${APPROVALS} a JOIN ${PROPOSALS} pr ON pr.id = a.proposal_id
              WHERE pr.world_id = ANY($1::uuid[])) AS approvals,
            (SELECT count(*) FROM ${SETTINGS_VERSIONS} WHERE world_id = ANY($1::uuid[])) AS "settingsVersions",
            (SELECT count(*) FROM ${SETTINGS_STATE} WHERE world_id = ANY($1::uuid[])) AS "settingsPointer",
            (SELECT count(*) FROM ${ITEMS} WHERE world_id = ANY($1::uuid[])) AS items,
            (SELECT count(*) FROM ${GRANTS} WHERE world_id = ANY($1::uuid[])) AS grants,
            (SELECT count(*) FROM ${PAYLOADS} WHERE world_id = ANY($1::uuid[])) AS payloads,
            (SELECT count(*) FROM ${ENTITLEMENTS} WHERE world_id = ANY($1::uuid[])) AS entitlements,
            (SELECT count(*) FROM ${ENTITLEMENT_ITEMS} WHERE world_id = ANY($1::uuid[])) AS "entitlementItems",
            (SELECT count(*) FROM ${ENDED_EVENTS} WHERE world_id = ANY($1::uuid[])) AS "endedEvents",
            (SELECT count(*) FROM ${END_COMMANDS} WHERE world_id = ANY($1::uuid[])) AS "endCommands",
            (SELECT count(*) FROM public.conversation_sessions) AS "personalSessions",
            (SELECT count(*) FROM public.conversation_turns) AS "personalTurns"`,
    [worldIds]);
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

const deltaOf = (before, after) => Object.fromEntries(
  Object.keys(after).map((key) => [key, after[key] - before[key]]).filter(([, value]) => value !== 0));

// ---------------------------------------------------------------------------

async function verifyCatalog() {
  stage = 'catalog: every relation 0088 owns exists exactly once';
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
      `${table} still carries every column migration 0088 owns, unchanged and in its original position`);
    for (const [name] of owned) {
      assert.equal(observed.filter((column) => column[0] === name).length, 1, `${table}.${name} appears exactly once`);
    }
  }

  stage = 'catalog: the exact bindings and foreign keys 0088 owns';
  const constraintsOf = async (table) => rows(
    'SELECT conname name, contype type, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY conname',
    [table]);
  const live = new Map();
  for (const table of OWN_TABLES) live.set(table, await constraintsOf(table));
  const defOf = (table, name) => (live.get(table).find((c) => c.name === name) ?? { def: `MISSING CONSTRAINT ${name}` }).def;
  for (const [table, name, shape] of OWNED_BINDINGS) {
    assert.match(defOf(table, name), shape, `${name} is the exact binding migration 0088 owns`);
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

  stage = 'catalog: both primitives are sealed, pinned, VOLATILE, actor-free and app-unreachable';
  for (const fnName of MUTATION_FUNCTIONS) {
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
    assert.doesNotMatch(fn.prosrc, /auth\.uid/u,
      `${fnName} records no closer: the authority is the exact unanimous END_WORLD approval set`);
    assert.doesNotMatch(fn.prosrc, /conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|consent|matching/iu,
      `${fnName} reads no Personal context and touches no grant or consent state`);
    assert.doesNotMatch(fn.prosrc, /DELETE FROM|TRUNCATE/iu, `${fnName} deletes no canonical history: closure is archival`);
    assert.doesNotMatch(fn.prosrc, /pg_advisory|LOCK TABLE/iu, `${fnName} takes only canonical row locks`);
    assert.doesNotMatch(fn.prosrc, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u,
      `${fnName} persists one database-owned instant`);
    assert.doesNotMatch(fn.prosrc, /INTRODUCTION/u,
      `${fnName} implements no Introduction closure: that belongs to the Introduction line`);
    assert.match(fn.prosrc, /FROM public\.shared_worlds w WHERE w\.id = /u, `${fnName} locks the exact World row`);
    assert.equal((fn.prosrc.match(/FOR UPDATE/gu) ?? []).length, 1,
      `${fnName} takes exactly one row lock of its own, and it is the World row`);
  }
  const [prepareSource] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [PREPARE_FN]);
  assert.match(prepareSource.prosrc, /public\.capture_shared_world_governance_proposal_v1\(/u,
    'the closure preparation captures its proposal through the frozen I-04D primitive');
  assert.match(prepareSource.prosrc, /captured\.snapshot_captured_at/u,
    'and persists the exact instant the frozen capture owned');
  assert.doesNotMatch(prepareSource.prosrc, /clock_timestamp\(\)/u, 'reading no clock of its own');
  const [commitSource] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [COMMIT_FN]);
  assert.match(commitSource.prosrc, /'END_WORLD', payload\.id\)/u,
    'the closure commit revalidates the exact operation AND the exact payload version it applies');
  assert.match(commitSource.prosrc, /public\.resolve_shared_world_history_visibility_v1\(ent\.world_id, ent\.user_id\)/u,
    'the entitlement item snapshot comes from the ONE frozen I-04F visibility resolver');
  assert.match(commitSource.prosrc, /SET ended_at = closure_instant, end_reason = 'WORLD_CLOSED'/u,
    'every open episode closes in place at the closure instant');
  const entitlementAt = commitSource.prosrc.indexOf('INSERT INTO public.shared_world_standard_closed_view_entitlements');
  const episodeAt = commitSource.prosrc.indexOf('UPDATE public.shared_world_membership_episodes e');
  assert.ok(entitlementAt > 0 && episodeAt > entitlementAt,
    'and the entitlement snapshot is taken BEFORE membership is destroyed');

  stage = 'catalog: the closed-history reader is STABLE, service-role-only and membership-free';
  const [resolver] = await rows(
    `SELECT pr.prosecdef secdef, pr.provolatile volatility, pr.proconfig config, pr.prosrc,
            pg_get_userbyid(pr.proowner) owner FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [RESOLVE_FN]);
  assert.ok(resolver, 'the closed-history reader exists');
  assert.equal(resolver.owner, 'postgres');
  assert.equal(resolver.secdef, true, 'the closed-history reader is SECURITY DEFINER');
  assert.equal(resolver.volatility, 's', 'the closed-history reader is STABLE (read-only)');
  assert.ok((resolver.config ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'));
  assert.doesNotMatch(resolver.prosrc, /INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt/u,
    'the closed-history reader mutates nothing, locks nothing and trusts no client claim');
  assert.doesNotMatch(resolver.prosrc, /shared_world_membership_episodes/u,
    'closed viewing is entitlement, never membership');
  assert.match(resolver.prosrc, /i\.availability_state = 'AVAILABLE'/u,
    'a closed entitlement can never reconstruct owner-deleted or unavailable source');
  const [{ allowed: resolverPublic }] = await rows("SELECT has_function_privilege('public', $1, 'EXECUTE') AS allowed", [RESOLVE_FN]);
  assert.equal(resolverPublic, false, 'PUBLIC must not execute the closed-history reader');
  for (const role of ['anon', 'authenticated']) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, RESOLVE_FN, 'EXECUTE']);
    assert.equal(allowed, false, `${role} must not execute the closed-history reader`);
  }
  const [{ allowed: serviceExecute }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed',
    ['service_role', RESOLVE_FN, 'EXECUTE']);
  assert.equal(serviceExecute, true, 'service_role is the only executor of the closed-history reader');
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
  stage = 'ACL: no application role may execute either closure primitive';
  for (const role of APPLICATION_ROLES) {
    await identity(role, randomUUID());
    await rejected(() => rows(END_PREPARE_SQL, [randomUUID(), randomUUID(), randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => rows(END_COMMIT_SQL, [randomUUID(), randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
  }
  for (const role of ['anon', 'authenticated']) {
    await identity(role, randomUUID());
    await rejected(() => rows(CLOSED_VISIBILITY_SQL, [randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');
}

// ---------------------------------------------------------------------------

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

async function approveWith(proposalId, humans) {
  for (const human of humans) {
    await identity('postgres', human);
    const [approved] = await rows(GOV_APPROVE_SQL, [randomUUID(), proposalId]);
    assert.equal(approved.outcome, 'APPROVED');
  }
  await identity('postgres');
}

/**
 * Seed one history item with its exact baseline audience. The item occurs at the
 * current instant plus a deterministic offset, which is AFTER every episode this
 * verifier opens - so membership-period visibility is genuinely exercised rather
 * than accidentally excluded by a synthetic time that precedes the World.
 */
async function seedItem(worldId, viewers, { hours = 0, state = 'AVAILABLE' } = {}) {
  const id = randomUUID();
  await q(`INSERT INTO ${ITEMS}(id, world_id, occurred_at, authority_requirement_mode, availability_state,
                                availability_revision, registered_at)
           VALUES($1,$2, clock_timestamp() + ($3::int * interval '1 millisecond'),
                  'NO_HUMAN_APPROVAL_REQUIRED', $4, 1, clock_timestamp())`, [id, worldId, hours, state]);
  for (const viewer of viewers) {
    await q(`INSERT INTO ${BASELINE}(history_item_id, user_id) VALUES($1,$2)`, [id, viewer]);
  }
  return id;
}

const visibleFor = async (worldId, userId) => (await rows(VISIBILITY_SQL, [worldId, userId])).map((row) => row.history_item_id);

/** The I-04G availability writer, simulated as the database owner. */
const setAvailability = (itemId, state) => q(
  `UPDATE ${ITEMS} SET availability_state = $2, availability_revision = availability_revision + 1 WHERE id = $1`,
  [itemId, state]);

// ---------------------------------------------------------------------------

async function verifyClosure(f) {
  stage = 'C21: a zero-active-human inert ACTIVE World cannot manufacture unanimous END_WORLD';
  const inert = randomUUID();
  await q(`INSERT INTO ${WORLDS}(id, lifecycle, phase, birth_basis, born_at)
           VALUES($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION', now() - interval '10 days')`, [inert]);
  await q(`INSERT INTO ${EPISODES}(id, world_id, user_id, joined_at, ended_at, end_reason)
           VALUES($1,$2,$3, now() - interval '10 days', now() - interval '9 days', 'VOLUNTARY_LEAVE')`,
    [randomUUID(), inert, f.inviter]);
  await rejected(() => prepareEnd(ids(), inert), UNAVAILABLE, /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);

  stage = 'C23: no Introduction closure is implemented';
  const introduction = randomUUID();
  await q(`INSERT INTO ${WORLDS}(id, lifecycle, phase, birth_basis, born_at)
           VALUES($1,'ACTIVE','INTRODUCTION','MUTUAL_MATCH', now() - interval '10 days')`, [introduction]);
  await q(`INSERT INTO ${EPISODES}(id, world_id, user_id, joined_at) VALUES($1,$2,$3, now() - interval '10 days')`,
    [randomUUID(), introduction, f.inviter]);
  await rejected(() => prepareEnd(ids(), introduction), UNAVAILABLE, /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
  await rejected(() => rows(VISIBILITY_SQL, [introduction, f.inviter]), UNSUPPORTED,
    /SHARED_WORLD_HISTORY_VISIBILITY_UNSUPPORTED_WORLD_MODE/u);
  await rejected(() => rows(CLOSED_VISIBILITY_SQL, [introduction, f.inviter]), UNSUPPORTED,
    /SHARED_WORLD_CLOSED_VISIBILITY_UNSUPPORTED_WORLD_MODE/u);
  const [introductionAfter] = await rows(`SELECT lifecycle, phase FROM ${WORLDS} WHERE id = $1`, [introduction]);
  assert.deepEqual(introductionAfter, { lifecycle: 'ACTIVE', phase: 'INTRODUCTION' },
    'the Introduction World is untouched: I-04F closes Standard Worlds only');

  stage = 'C01: an exact unanimously approved END_WORLD closes ACTIVE/STANDARD to READ_ONLY_CLOSED/STANDARD';
  const world = await provisionWorld(f.inviter, f.second, 'closure');
  const thirdEpisode = randomUUID();
  // The third open episode is written directly as the database owner: the shape is
  // identical to what the frozen I-04E governed add produces (CW2-03 section 18), it
  // is reachable by no application role, it uses the canonical clock, and this file's
  // subject is CLOSURE - migration 0085's own verifier is where the add-member
  // journey is proven end to end. The reviewed 0085 topology triggers still fire.
  await q(`INSERT INTO ${EPISODES}(id, world_id, user_id, joined_at) VALUES($1,$2,$3, clock_timestamp())`,
    [thirdEpisode, world.worldId, f.third]);
  // A human who leaves BEFORE closure, and must not be silently restored to browsing.
  const departedEpisode = randomUUID();
  await q(`INSERT INTO ${EPISODES}(id, world_id, user_id, joined_at) VALUES($1,$2,$3, clock_timestamp())`,
    [departedEpisode, world.worldId, f.departed]);

  const shared = await seedItem(world.worldId, [f.inviter, f.second, f.third, f.departed], { hours: 0 });
  const inviterOnly = await seedItem(world.worldId, [f.inviter], { hours: 1 });
  const alreadyGone = await seedItem(world.worldId, [f.inviter, f.second], { hours: 2, state: 'DELETED_BY_OWNER' });
  void alreadyGone;
  // A settings version, so C10 can prove settings survive closure untouched.
  const settings = ids();
  await rows(SETTINGS_PREPARE_SQL, [settings.proposal, settings.snapshot, settings.payload, world.worldId,
    'Evening study', null, 'shared reading', 'lantern']);
  await approveWith(settings.proposal, [f.inviter, f.second, f.third, f.departed]);
  await rows(SETTINGS_COMMIT_SQL, [randomUUID(), settings.proposal, randomUUID()]);

  // The departed human leaves through the frozen I-04C primitive.
  await identity('postgres', f.departed);
  await leave(randomUUID(), world.worldId, randomUUID());
  await identity('postgres');

  // Captured now: everything the ADD dispatch and the closure below create must
  // show up in the exact delta, and nothing else may move.
  const before = await sharedCounts([world.worldId]);

  stage = 'C19: a PENDING member invitation exists before closure and must not survive it as authority';
  const add = ids();
  await rows(ADD_PREPARE_SQL, [add.proposal, add.snapshot, add.payload, world.worldId, f.newcomer]);
  await approveWith(add.proposal, [f.inviter, f.second, f.third]);
  const memberInvitation = randomUUID();
  const [dispatched] = await rows(DISPATCH_SQL, [memberInvitation, add.proposal]);
  assert.equal(dispatched.dispatched_state, 'PENDING', 'the member invitation is pending before closure');

  stage = 'C13: what each exact current human can resolve immediately BEFORE closure';
  const beforeClosure = {
    [f.inviter]: (await visibleFor(world.worldId, f.inviter)).sort(),
    [f.second]: (await visibleFor(world.worldId, f.second)).sort(),
    [f.third]: (await visibleFor(world.worldId, f.third)).sort(),
    [f.departed]: (await visibleFor(world.worldId, f.departed)).sort(),
  };
  assert.deepEqual(beforeClosure[f.inviter], [shared, inviterOnly].sort(),
    'the inviter sees both items they were an audience of, and never the owner-deleted one');
  assert.deepEqual(beforeClosure[f.departed], [],
    'and the departed human already has no browsing at all');

  stage = 'C02: partial approval cannot close';
  const end = ids();
  const [prepared] = await prepareEnd(end, world.worldId);
  assert.deepEqual(Object.keys(prepared).sort(), [
    'outcome', 'prepared_approval_rule', 'prepared_at', 'prepared_operation_kind', 'prepared_payload_version_id',
    'prepared_proposal_id', 'prepared_required_approval_count', 'prepared_snapshot_id', 'prepared_world_id',
  ].sort(), 'the preparation returns exactly the bounded immutable result');
  assert.equal(prepared.prepared_operation_kind, 'END_WORLD');
  assert.equal(prepared.prepared_approval_rule, 'ALL_CURRENT_MEMBERS');
  assert.equal(prepared.prepared_required_approval_count, 3, 'every current human must approve the end of the World');
  const [{ lifecycle: stillActive }] = await rows(`SELECT lifecycle FROM ${WORLDS} WHERE id = $1`, [world.worldId]);
  assert.equal(stillActive, 'ACTIVE', 'preparing a closure changes no lifecycle');
  await approveWith(end.proposal, [f.inviter, f.second]);
  await rejected(() => commitEnd(randomUUID(), end.proposal, randomUUID()), INCOMPLETE,
    /SHARED_WORLD_GOVERNANCE_APPROVALS_INCOMPLETE/u);

  stage = 'C03: payload version A approvals can never close payload version B';
  const rival = ids();
  await rejected(() => prepareEnd({ ...end, payload: rival.payload }, world.worldId), CONFLICT,
    /SHARED_WORLD_GOVERNANCE_ID_CONFLICT/u);
  await rejected(() => prepareEnd({ ...rival, proposal: end.proposal }, world.worldId), CONFLICT,
    /SHARED_WORLD_GOVERNANCE_ID_CONFLICT/u);

  stage = 'C22: unrelated World activity never stales this closure';
  const unrelated = await provisionWorld(f.inviter, f.unrelated, 'unrelated');
  await identity('postgres', f.unrelated);
  await leave(randomUUID(), unrelated.worldId, randomUUID());
  await identity('postgres');

  stage = 'C01 / C08 / C09 / C11: the closure commits on ONE canonical instant';
  await approveWith(end.proposal, [f.third]);
  const commandId = randomUUID();
  const eventId = randomUUID();
  const [closed] = await commitEnd(commandId, end.proposal, eventId);
  assert.equal(closed.outcome, 'WORLD_ENDED');
  assert.equal(closed.ended_world_id, world.worldId);
  assert.equal(closed.closed_entitlement_count, 3, 'exactly the three current humans received an entitlement');
  assert.equal(closed.closed_episode_count, 3, 'and exactly their three open episodes were closed');
  const [archived] = await rows(`SELECT lifecycle, phase, closed_at, born_at, birth_basis FROM ${WORLDS} WHERE id = $1`, [world.worldId]);
  assert.equal(archived.lifecycle, 'READ_ONLY_CLOSED');
  assert.equal(archived.phase, 'STANDARD', 'the phase is preserved: closure changes lifecycle only');
  assert.deepEqual(archived.closed_at, closed.world_closed_at, 'closed_at is the one canonical closure instant');
  const [{ oneInstant }] = await rows(
    `SELECT (w.closed_at = ev.occurred_at AND ev.occurred_at = cmd.committed_at
             AND cmd.committed_at = (SELECT min(ent.entitled_at) FROM ${ENTITLEMENTS} ent WHERE ent.world_id = w.id)
             AND cmd.committed_at = (SELECT max(ent.entitled_at) FROM ${ENTITLEMENTS} ent WHERE ent.world_id = w.id)
             AND cmd.committed_at = (SELECT min(e.ended_at) FROM ${EPISODES} e WHERE e.world_id = w.id AND e.end_reason = 'WORLD_CLOSED')
             AND cmd.committed_at = (SELECT max(e.ended_at) FROM ${EPISODES} e WHERE e.world_id = w.id AND e.end_reason = 'WORLD_CLOSED')) AS "oneInstant"
       FROM ${WORLDS} w JOIN ${ENDED_EVENTS} ev ON ev.world_id = w.id
       JOIN ${END_COMMANDS} cmd ON cmd.world_id = w.id WHERE w.id = $1`, [world.worldId]);
  assert.equal(oneInstant, true,
    'closed_at, WORLD_ENDED, the durable command, every entitlement time and every episode ending are ONE instant');
  const [{ n: stillOpen }] = await rows(
    `SELECT count(*)::int n FROM ${EPISODES} WHERE world_id = $1 AND ended_at IS NULL`, [world.worldId]);
  assert.equal(stillOpen, 0, 'C09: closure leaves zero open membership episodes');
  const reasons = (await rows(
    `SELECT DISTINCT end_reason FROM ${EPISODES} WHERE world_id = $1 AND ended_at IS NOT NULL ORDER BY 1`, [world.worldId]))
    .map((row) => row.end_reason);
  assert.deepEqual(reasons, ['VOLUNTARY_LEAVE', 'WORLD_CLOSED'],
    'C08: the three open episodes closed as WORLD_CLOSED, and the earlier leave kept its own truthful reason');

  stage = 'C19: the pending member invitation terminalized through the reviewed I-04E topology trigger';
  const [invitationAfter] = await rows(
    `SELECT invitation_state, terminal_at FROM ${MEMBER_INVITATIONS} WHERE id = $1`, [memberInvitation]);
  assert.equal(invitationAfter.invitation_state, 'STALE_GOVERNANCE',
    'a pending invitation cannot survive closure as actionable authority');
  assert.ok(invitationAfter.terminal_at !== null, 'and it carries its own terminal instant');

  stage = 'C12 / C13: exactly the current humans are entitled, with exactly what they could resolve';
  const entitled = (await rows(`SELECT user_id FROM ${ENTITLEMENTS} WHERE world_id = $1 ORDER BY 1`, [world.worldId]))
    .map((row) => row.user_id);
  assert.deepEqual(entitled.sort(), [f.inviter, f.second, f.third].sort(),
    'the departed human is NOT restored to browsing, and the pending newcomer never became a member');
  assert.ok(!entitled.includes(f.departed));
  assert.ok(!entitled.includes(f.newcomer));
  for (const human of [f.inviter, f.second, f.third]) {
    const snapshot = (await rows(
      `SELECT history_item_id FROM ${ENTITLEMENT_ITEMS} WHERE world_id = $1 AND user_id = $2 ORDER BY 1`,
      [world.worldId, human])).map((row) => row.history_item_id);
    assert.deepEqual(snapshot.sort(), beforeClosure[human],
      'the entitlement item set is exactly what that human could resolve immediately before closure');
  }

  stage = 'C16 / C13: the closed resolver answers from the entitlement, and a closed viewer is not a member';
  await identity('service_role');
  for (const human of [f.inviter, f.second, f.third]) {
    assert.deepEqual((await visibleFor(world.worldId, human)).sort(), beforeClosure[human],
      'the ONE resolver now answers the closed World from its entitlement snapshot');
    assert.deepEqual(
      (await rows(CLOSED_VISIBILITY_SQL, [world.worldId, human])).map((row) => row.history_item_id).sort(),
      beforeClosure[human], 'and the closed-mode reader agrees exactly');
  }
  assert.deepEqual(await visibleFor(world.worldId, f.departed), [],
    'the departed human sees nothing: closure created no access that did not exist');
  assert.deepEqual(await visibleFor(world.worldId, f.outsider), [],
    'and neither does an outsider');
  await identity('postgres');
  const [{ n: openAgain }] = await rows(
    `SELECT count(*)::int n FROM ${EPISODES} WHERE world_id = $1 AND ended_at IS NULL`, [world.worldId]);
  assert.equal(openAgain, 0, 'C16: a closed viewer is an entitlement holder, never an active member');

  stage = 'C10: World identity, phase, settings, governance and every historical row are preserved';
  const [settingsAfter] = await rows(
    `SELECT v.name, v.topic, v.general_visual_marker FROM ${SETTINGS_STATE} st
       JOIN ${SETTINGS_VERSIONS} v ON v.id = st.current_settings_version_id WHERE st.world_id = $1`, [world.worldId]);
  assert.deepEqual(settingsAfter, { name: 'Evening study', topic: 'shared reading', general_visual_marker: 'lantern' },
    'the settings the World had are exactly the settings it still has');
  const [{ n: historyRows }] = await rows(`SELECT count(*)::int n FROM ${ITEMS} WHERE world_id = $1`, [world.worldId]);
  assert.equal(historyRows, 3, 'every history item remains: archival closure is not deletion');

  stage = 'C24: no Personal state was mutated, and exactly the closure own rows appeared';
  const after = await sharedCounts([world.worldId]);
  assert.deepEqual(deltaOf(before, after), {
    openEpisodes: -3, invitations: 1, snapshots: 2, proposals: 2, approvals: 6,
    payloads: 1, entitlements: 3, entitlementItems: 4, endedEvents: 1, endCommands: 1,
  }, 'the whole ADD dispatch plus closure created exactly its own rows, mutated no Personal state and deleted nothing');

  stage = 'C18 / C17: every ordinary mutation path refuses a READ_ONLY_CLOSED World';
  await identity('postgres', f.inviter);
  await rejected(() => leave(randomUUID(), world.worldId, randomUUID()), UNAVAILABLE,
    /SHARED_WORLD_VOLUNTARY_LEAVE_NOT_AVAILABLE/u);
  await identity('postgres');
  await rejected(() => rows(ADD_PREPARE_SQL, [randomUUID(), randomUUID(), randomUUID(), world.worldId, f.outsider]),
    UNAVAILABLE);
  await rejected(() => rows(REMOVE_PREPARE_SQL, [randomUUID(), randomUUID(), randomUUID(), world.worldId, f.second]),
    UNAVAILABLE);
  await rejected(() => rows(SETTINGS_PREPARE_SQL,
    [randomUUID(), randomUUID(), randomUUID(), world.worldId, 'After', null, null, null]), UNAVAILABLE);
  await rejected(() => rows(HISTORY_PREPARE_SQL, [randomUUID(), world.worldId, f.inviter, [shared]]),
    UNAVAILABLE, /SHARED_WORLD_HISTORY_NOT_AVAILABLE/u);
  await rejected(() => rows(DISPATCH_SQL, [randomUUID(), add.proposal]), UNAVAILABLE);
  // And a second closure of the same World is impossible, under any command id.
  await rejected(() => commitEnd(randomUUID(), end.proposal, randomUUID()), UNAVAILABLE,
    /SHARED_WORLD_CLOSURE_NOT_AVAILABLE/u);

  stage = 'C14: later history items and later baseline audience rows cannot widen a frozen entitlement';
  const afterClosure = await seedItem(world.worldId, [f.inviter, f.second, f.third], { hours: 3 });
  await q(`INSERT INTO ${BASELINE}(history_item_id, user_id) VALUES($1,$2)`, [inviterOnly, f.third]);
  await identity('service_role');
  assert.deepEqual((await visibleFor(world.worldId, f.third)).sort(), beforeClosure[f.third],
    'neither a new item nor a new baseline audience row widens the frozen entitlement');
  assert.ok(!(await visibleFor(world.worldId, f.third)).includes(afterClosure));
  await identity('postgres');

  stage = 'C15: a later owner deletion narrows the closed answer without deleting the entitlement audit';
  await setAvailability(shared, 'DELETED_BY_OWNER');
  await identity('service_role');
  for (const human of [f.inviter, f.second, f.third]) {
    assert.ok(!(await visibleFor(world.worldId, human)).includes(shared),
      'the owner-deleted item disappears from every closed answer');
  }
  await identity('postgres');
  const [{ n: auditRows }] = await rows(
    `SELECT count(*)::int n FROM ${ENTITLEMENT_ITEMS} WHERE world_id = $1 AND history_item_id = $2`,
    [world.worldId, shared]);
  assert.equal(auditRows, 3, 'and the entitlement rows themselves are not erased');

  stage = 'C20: an equivalent closure retry is historically stable after the availability change';
  const [retried] = await commitEnd(commandId, end.proposal, eventId);
  assert.equal(retried.outcome, 'WORLD_ENDED');
  assert.deepEqual(retried.world_closed_at, closed.world_closed_at, 'and returns the exact committed closure instant');
  assert.equal(retried.closed_entitlement_count, 3);
  assert.equal(retried.closed_episode_count, 3);
  await rejected(() => commitEnd(commandId, randomUUID(), eventId), CONFLICT, /SHARED_WORLD_CLOSURE_ID_CONFLICT/u);
  await rejected(() => commitEnd(commandId, end.proposal, randomUUID()), CONFLICT, /SHARED_WORLD_CLOSURE_ID_CONFLICT/u);

  stage = 'bounded refusals and command invalidity';
  await rejected(() => prepareEnd(ids(), randomUUID()), UNAVAILABLE, /SHARED_WORLD_CLOSURE_NOT_AVAILABLE/u);
  await rejected(() => commitEnd(randomUUID(), randomUUID(), randomUUID()), UNAVAILABLE, /SHARED_WORLD_CLOSURE_NOT_AVAILABLE/u);
  await rejected(() => rows(END_PREPARE_SQL, [null, randomUUID(), randomUUID(), randomUUID()]), INVALID_PARAMETER);
  await rejected(() => rows(END_COMMIT_SQL, [randomUUID(), null, randomUUID()]), INVALID_PARAMETER);
  await rejected(() => rows(CLOSED_VISIBILITY_SQL, [null, f.inviter]), INVALID_PARAMETER);
  await rejected(() => rows(CLOSED_VISIBILITY_SQL, [randomUUID(), f.inviter]), UNAVAILABLE);

  stage = 'C04: a topology change after the END_WORLD proposal makes it stale';
  const staleWorld = await provisionWorld(f.inviter, f.staleSecond, 'stale-close');
  const staleEnd = ids();
  await prepareEnd(staleEnd, staleWorld.worldId);
  await approveWith(staleEnd.proposal, [f.inviter, f.staleSecond]);
  await identity('postgres', f.staleSecond);
  await leave(randomUUID(), staleWorld.worldId, randomUUID());
  await identity('postgres');
  await rejected(() => commitEnd(randomUUID(), staleEnd.proposal, randomUUID()), STALE, /SHARED_WORLD_GOVERNANCE_STALE/u);
  const [{ lifecycle: notClosed }] = await rows(`SELECT lifecycle FROM ${WORLDS} WHERE id = $1`, [staleWorld.worldId]);
  assert.equal(notClosed, 'ACTIVE', 'a stale END_WORLD proposal closes nothing and leaves no hybrid state');
  const [{ n: noEntitlements }] = await rows(
    `SELECT count(*)::int n FROM ${ENTITLEMENTS} WHERE world_id = $1`, [staleWorld.worldId]);
  assert.equal(noEntitlements, 0, 'and writes no entitlement');
  return { world, closureInstant: closed.world_closed_at };
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

  const [{ n: deadlocksBefore }] = await rows(
    'SELECT COALESCE(sum(deadlocks), 0)::int n FROM pg_stat_database WHERE datname = current_database()');

  try {
    const a = await open();
    const b = await open();

    stage = 'C05: a leave winning first makes the END_WORLD proposal stale, and no stale approval silently closes';
    const w1 = c.worlds.leaveFirst;
    await asOwnerFor(a, w1.leaver);
    const leaveRun = a.query(LEAVE_SQL, [randomUUID(), w1.worldId, randomUUID()]);
    assert.equal(await blocks(leaveRun), 'COMPLETED');
    await asOwnerFor(b, c.inviter);
    const queuedClose = b.query(END_COMMIT_SQL, [randomUUID(), w1.proposal, randomUUID()]);
    assert.equal(await blocks(queuedClose), 'BLOCKED', 'the closure queues on the exact World row the leave holds');
    await a.query('COMMIT');
    const staleError = await failureOf(queuedClose);
    assert.equal(staleError?.code, '40001', 'and then finds its captured topology stale, rather than deadlocking');
    await b.query('ROLLBACK');
    const [{ lifecycle }] = await rows(`SELECT lifecycle FROM ${WORLDS} WHERE id = $1`, [w1.worldId]);
    assert.equal(lifecycle, 'ACTIVE', 'the losing closure changed nothing');

    stage = 'C06: a closure winning first makes a queued settings change refuse a closed World';
    const w2 = c.worlds.closeFirst;
    await asOwnerFor(a, c.inviter);
    const closeRun = a.query(END_COMMIT_SQL, [randomUUID(), w2.proposal, randomUUID()]);
    assert.equal(await blocks(closeRun), 'COMPLETED');
    assert.equal((await closeRun).rows[0].outcome, 'WORLD_ENDED');
    await asOwnerFor(b, c.inviter);
    const queuedSettings = b.query(SETTINGS_COMMIT_SQL, [randomUUID(), w2.settingsProposal, randomUUID()]);
    assert.equal(await blocks(queuedSettings), 'BLOCKED', 'the settings change queues on the World row the closure holds');
    await a.query('COMMIT');
    const refused = await failureOf(queuedSettings);
    assert.ok(['P0002', 'P0001'].includes(refused?.code),
      'and then refuses a READ_ONLY_CLOSED World rather than committing a hybrid state');
    await b.query('ROLLBACK');
    const [{ n: noPointer }] = await rows(`SELECT count(*)::int n FROM ${SETTINGS_STATE} WHERE world_id = $1`, [w2.worldId]);
    assert.equal(noPointer, 0, 'the losing settings change committed nothing');

    stage = 'C07: two competing end commands produce exactly one closure';
    const w3 = c.worlds.twoCloses;
    await asOwnerFor(a, c.inviter); await asOwnerFor(b, c.inviter);
    const firstClose = a.query(END_COMMIT_SQL, [randomUUID(), w3.proposal, randomUUID()]);
    assert.equal(await blocks(firstClose), 'COMPLETED');
    const secondClose = b.query(END_COMMIT_SQL, [randomUUID(), w3.proposal, randomUUID()]);
    assert.equal(await blocks(secondClose), 'BLOCKED', 'the second command queues on the same World row');
    await a.query('COMMIT');
    const loser = await failureOf(secondClose);
    assert.equal(loser?.code, 'P0002', 'and then finds the World already archived');
    await b.query('ROLLBACK');
    const [{ n: closures }] = await rows(`SELECT count(*)::int n FROM ${ENDED_EVENTS} WHERE world_id = $1`, [w3.worldId]);
    assert.equal(closures, 1, 'exactly one WORLD_ENDED exists for the World');

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

async function verifyForwardSafety(f) {
  stage = 'forward safety: a later Introduction closure, the I-04G material store and a Launch Gate do not fail this verifier';
  await identity('postgres');
  const probe = `i04f_close_probe_${randomUUID().replace(/-/gu, '').slice(0, 12)}`;
  await q('SAVEPOINT forward_safety');
  try {
    // The Introduction closure line, which I-04F deliberately does not implement.
    await q(`CREATE TABLE public.${probe}_introduction_closure (id uuid PRIMARY KEY, world_id uuid NOT NULL,
             introduction_record_id uuid)`);
    await q(`CREATE FUNCTION public.${probe}_end_introduction_v1(p_world_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    // I-04G: real Shared material bound to the history item identity.
    await q(`CREATE TABLE public.${probe}_shared_material (id uuid PRIMARY KEY, history_item_id uuid NOT NULL
             REFERENCES ${ITEMS} (id) ON DELETE RESTRICT, body text)`);
    // A reviewed PRIVACY_MATERIAL_MUTATION, which must stay possible AFTER closure.
    await q(`CREATE FUNCTION public.${probe}_privacy_material_mutation(p_item_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN
               UPDATE public.shared_world_history_items i
                  SET availability_state = 'DELETED_BY_OWNER', availability_revision = i.availability_revision + 1
                WHERE i.id = p_item_id;
             END$fn$`);
    // CW2-08's Launch Gate and a launch-gated application wrapper.
    await q(`CREATE TABLE public.${probe}_launch_gates (id uuid PRIMARY KEY, capability text NOT NULL, state text NOT NULL)`);
    await q(`CREATE FUNCTION public.${probe}_end_world_gated_v1(p_command_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    await q(`GRANT EXECUTE ON FUNCTION public.${probe}_end_world_gated_v1(uuid) TO authenticated`);
    // Later additive closure metadata, with names and types 0088 would never write.
    await q(`ALTER TABLE ${ENTITLEMENTS} ADD COLUMN ${probe}_entitlement_metadata jsonb`);
    await q(`ALTER TABLE ${ENDED_EVENTS} ADD COLUMN ${probe}_delivery_epoch bigint`);
    await q(`ALTER TABLE ${PAYLOADS} ADD CONSTRAINT ${probe}_payload_created_check CHECK (created_at IS NOT NULL)`);
    await q(`CREATE INDEX ${probe}_ended_events_time_idx ON ${ENDED_EVENTS} (occurred_at)`);
    // A later reviewed AUDIT trigger on a table 0088 owns. Deliberately inert.
    await q(`CREATE FUNCTION public.${probe}_audit_fn() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN RETURN NULL; END$fn$`);
    await q(`CREATE TRIGGER ${probe}_ended_audit AFTER INSERT ON ${ENDED_EVENTS}
             FOR EACH ROW EXECUTE FUNCTION public.${probe}_audit_fn()`);
    await verifyCatalog();

    stage = 'forward safety: a whole governed closure still works beside the authorized future';
    const world = await provisionWorld(f.inviter, f.forwardSecond, 'closure-forward');
    const item = await seedItem(world.worldId, [f.inviter, f.forwardSecond], { hours: 0 });
    const end = ids();
    await prepareEnd(end, world.worldId);
    await approveWith(end.proposal, [f.inviter, f.forwardSecond]);
    const [closed] = await commitEnd(randomUUID(), end.proposal, randomUUID());
    assert.equal(closed.outcome, 'WORLD_ENDED', 'closure still commits beside later tables, columns, indexes and triggers');
    await identity('service_role');
    assert.deepEqual((await rows(CLOSED_VISIBILITY_SQL, [world.worldId, f.inviter])).map((row) => row.history_item_id), [item],
      'and the closed entitlement still answers correctly');
    await identity('postgres');
    // The reviewed privacy material mutation runs on an ALREADY CLOSED World and
    // narrows the closed answer, without reopening lifecycle.
    await q(`SELECT public.${probe}_privacy_material_mutation($1)`, [item]);
    await identity('service_role');
    assert.deepEqual(await rows(CLOSED_VISIBILITY_SQL, [world.worldId, f.inviter]), [],
      'a reviewed privacy material mutation after closure still narrows source visibility');
    await identity('postgres');
    const [{ lifecycle }] = await rows(`SELECT lifecycle FROM ${WORLDS} WHERE id = $1`, [world.worldId]);
    assert.equal(lifecycle, 'READ_ONLY_CLOSED', 'and never reopens the lifecycle');

    stage = 'forward safety: a real regression to something 0088 OWNS is still refused';
    for (const [reason, plant, refuses] of [
      ['a World could carry two Standard closures',
        `ALTER TABLE ${ENDED_EVENTS} DROP CONSTRAINT shared_world_ended_events_world_key`,
        /shared_world_ended_events_world_key/u],
      ['an end payload stops binding its exact proposal, World and operation',
        `ALTER TABLE ${PAYLOADS} DROP CONSTRAINT shared_world_end_payload_versions_proposal_fk,
         ADD CONSTRAINT shared_world_end_payload_versions_proposal_fk
           FOREIGN KEY (governance_proposal_id) REFERENCES ${PROPOSALS} (id) ON DELETE RESTRICT`,
        /shared_world_end_payload_versions_proposal_fk/u],
      ['an entitlement item stops binding its exact World',
        `ALTER TABLE ${ENTITLEMENT_ITEMS} DROP CONSTRAINT shared_world_standard_closed_view_entitlement_items_item_fk`,
        /shared_world_standard_closed_view_entitlement_items_item_fk/u],
      ['one human could hold two entitlements for one World',
        `ALTER TABLE ${ENTITLEMENT_ITEMS} DROP CONSTRAINT shared_world_standard_closed_view_entitlement_items_holder_fk;
         ALTER TABLE ${ENTITLEMENTS} DROP CONSTRAINT shared_world_standard_closed_view_entitlements_pk CASCADE`,
        /shared_world_standard_closed_view_entitlements_pk/u],
      ['an end payload can belong to another operation',
        `ALTER TABLE ${PAYLOADS} DROP CONSTRAINT shared_world_end_payload_versions_operation_check`,
        /shared_world_end_payload_versions_operation_check/u],
      ['an owned column is dropped',
        `ALTER TABLE ${ENTITLEMENTS} DROP COLUMN membership_episode_id CASCADE`,
        /still carries every column migration 0088 owns/u],
      ['an owned column becomes optional',
        `ALTER TABLE ${ENDED_EVENTS} ALTER COLUMN occurred_at DROP NOT NULL`,
        /still carries every column migration 0088 owns/u],
      ['a closure relation becomes directly readable by an application role',
        `GRANT SELECT ON ${ENTITLEMENTS} TO authenticated`,
        /authenticated must not hold SELECT/u],
      ['a closure primitive becomes executable by an application role',
        `GRANT EXECUTE ON FUNCTION ${COMMIT_FN} TO authenticated`,
        /must not hold EXECUTE/u],
      ['the closed-history reader becomes executable by authenticated',
        `GRANT EXECUTE ON FUNCTION ${RESOLVE_FN} TO authenticated`,
        /authenticated must not execute the closed-history reader/u],
      ['the closed-history reader starts answering from active membership',
        `CREATE OR REPLACE FUNCTION public.resolve_shared_world_closed_history_visibility_v1(p_world_id uuid, p_user_id uuid)
         RETURNS TABLE(world_id uuid, history_item_id uuid, occurred_at timestamptz)
         LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
         BEGIN
           RETURN QUERY SELECT e.world_id, e.id, e.joined_at
             FROM public.shared_world_membership_episodes e WHERE e.world_id = p_world_id;
         END$fn$`,
        /closed viewing is entitlement, never membership/u],
      ['the closure commit starts deriving a closer',
        `CREATE OR REPLACE FUNCTION public.commit_shared_world_standard_end_v1(
           p_command_id uuid, p_proposal_id uuid, p_world_ended_event_id uuid)
         RETURNS TABLE(outcome text, end_command_id uuid, ended_world_id uuid, ended_proposal_id uuid,
                       ended_payload_version_id uuid, ended_event_id uuid,
                       closed_entitlement_count integer, closed_episode_count integer,
                       world_closed_at timestamptz)
         LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
         DECLARE u uuid := auth.uid(); target public.shared_worlds;
         BEGIN
           SELECT * INTO target FROM public.shared_worlds w WHERE w.id = p_command_id FOR UPDATE;
           RETURN;
         END$fn$`,
        /records no closer/u],
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

async function provisionHumans(humanIds) {
  await identity('postgres');
  await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [humanIds]);
}

async function removeFixtures(humans) {
  await identity('postgres');
  const worldIds = (await rows(
    `SELECT DISTINCT ep.world_id FROM ${EPISODES} ep WHERE ep.user_id = ANY($1::uuid[])`, [humans]))
    .map((row) => row.world_id);
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
  await q(`DELETE FROM ${SETTINGS_COMMANDS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${SETTINGS_EVENTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${SETTINGS_STATE} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${SETTINGS_VERSIONS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${ACCEPT_COMMANDS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${JOINED_EVENTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${MEMBER_INVITATIONS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${ADD_PAYLOADS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
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

/** The committed fixtures the multi-connection races need: three Worlds with approved END_WORLD proposals. */
async function provisionRaceWorlds(c) {
  const worlds = {};

  const leaveFirst = await provisionWorld(c.inviter, c.raceSecond, 'race-leave');
  const leaveEnd = ids();
  await prepareEnd(leaveEnd, leaveFirst.worldId);
  await approveWith(leaveEnd.proposal, [c.inviter, c.raceSecond]);
  worlds.leaveFirst = { ...leaveFirst, leaver: c.raceSecond, proposal: leaveEnd.proposal };

  const closeFirst = await provisionWorld(c.inviter, c.raceSecondB, 'race-close');
  const closeEnd = ids();
  await prepareEnd(closeEnd, closeFirst.worldId);
  const settings = ids();
  await rows(SETTINGS_PREPARE_SQL, [settings.proposal, settings.snapshot, settings.payload, closeFirst.worldId,
    'Never applied', null, null, null]);
  await approveWith(closeEnd.proposal, [c.inviter, c.raceSecondB]);
  await approveWith(settings.proposal, [c.inviter, c.raceSecondB]);
  worlds.closeFirst = { ...closeFirst, proposal: closeEnd.proposal, settingsProposal: settings.proposal };

  const twoCloses = await provisionWorld(c.inviter, c.raceSecondC, 'race-two-closes');
  const bothEnd = ids();
  await prepareEnd(bothEnd, twoCloses.worldId);
  await approveWith(bothEnd.proposal, [c.inviter, c.raceSecondC]);
  worlds.twoCloses = { ...twoCloses, proposal: bothEnd.proposal };
  return worlds;
}

async function main() {
  const f = {
    inviter: randomUUID(), second: randomUUID(), third: randomUUID(), departed: randomUUID(),
    newcomer: randomUUID(), outsider: randomUUID(), unrelated: randomUUID(), staleSecond: randomUUID(),
    forwardSecond: randomUUID(),
  };
  f.humans = Object.values(f);
  const c = {
    inviter: randomUUID(), raceSecond: randomUUID(), raceSecondB: randomUUID(), raceSecondC: randomUUID(),
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
      await provisionHumans(f.humans);
      await verifyClosure(f);
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
            + (SELECT count(*) FROM ${PAYLOADS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${ENTITLEMENTS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${ENTITLEMENT_ITEMS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${ENDED_EVENTS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${END_COMMANDS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${ITEMS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${EPISODES} WHERE user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($2::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
      [humans, bornWorlds]);
    assert.equal(Number(n), 0, 'no fixture row remains after completion');

    console.log('migration 0088 verified: Standard World closure - archival, entitled, and never fake membership');
  } catch (error) {
    console.error(`migration 0088 verification FAILED at stage: ${stage}`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

await main();
