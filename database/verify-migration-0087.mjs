// Real-PostgreSQL verifier for migration 0087 - I-04F Selective Historical Access
// v1 (PART A).
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// behaviour rather than from the migration text:
//
//   * catalog: the ten relations exist once and still carry every column they OWN
//     - name, type, nullability AND the absence of a default - unchanged and in
//     their original positions; every owned unique binding, check and foreign key
//     is pinned by name, local columns, parent and restrictive deletion; RLS is on
//     with zero policies; and PUBLIC, anon, authenticated and service_role hold no
//     privilege at all;
//   * catalog: the three mutation primitives are postgres-owned, SECURITY
//     DEFINER, search_path-pinned, VOLATILE and executable by NO application role,
//     because the frozen Launch Gate precondition is unimplemented; the visibility
//     resolver is STABLE and service_role-only;
//   * H01 a new member without a grant sees only baseline-visible items from their
//     own membership interval forward, and hidden history returns no row and no
//     placeholder of any kind;
//   * H02 / H03 a rejoining member sees baseline-visible items from their prior
//     authorized membership episodes plus their current episode forward, and never
//     the absence interval;
//   * H04 an explicit committed grant adds exactly the absence-period items;
//   * H05 the manifest is immutable and binds exact World, exact grantee episode
//     and exact item set;
//   * H06 / H07 / H08 the required approver set is the exact union of item-level
//     material authorities, is never caller-supplied, and one approver can never
//     satisfy another human's requirement;
//   * H09 a former member who is still an exact required material authority can
//     approve, without regaining any World access;
//   * H10 missing or contradictory item authority metadata fails closed, and an
//     empty required set is legitimate only under explicit NO_HUMAN_APPROVAL_REQUIRED;
//   * H11 a changed availability revision after preparation stales the commit;
//   * H12 changed package content requires a new manifest, and old approvals do
//     not authorize it;
//   * H13 / H14 a grantee leave stales the manifest, and a same-human rejoin under
//     a NEW episode never revives it;
//   * H15 / H16 a committed grant survives a leave as historical authority without
//     restoring World browsing, and contributes again on a later valid rejoin;
//   * H17 later visibility never changes an item occurred_at or an episode timing;
//   * H19 / H20 a DELETED_BY_OWNER or UNAVAILABLE item is never returned even when
//     a grant exists, and the grant, approval and command rows are not erased;
//   * concurrency, with real independent connections: a grant commit racing a
//     grantee leave resolves serially in both orders with no deadlock, and two
//     competing commits of one manifest produce exactly one grant;
//   * forward safety: the I-04G material store bound to the history item identity,
//     a reviewed availability writer, a provenance relation, an Introduction
//     closed-history consumer, a Launch Gate, later additive columns, indexes and
//     audit triggers are created for real inside a rolled-back SAVEPOINT and this
//     verifier still passes - then every regression to something 0087 OWNS is
//     planted and must still be refused;
//   * zero fixture residue after completion.
//
// There is deliberately NO live census of any kind here: this file runs against a
// fully migrated database, so a fixed list of table names required to stay absent,
// an exact count of live constraints or a catalog sweep for future names would be
// a ceiling on the whole roadmap rather than a fact about migration 0087. What
// 0087 itself did NOT create is proven from 0087's own text, by
// database/tests/shared-world-selective-history-access-v1.test.mjs.
//
// I-04F implements no material writer: the reviewed one belongs to I-04G. The
// history projection, its baseline audience and its per-item material authorities
// are therefore seeded and mutated HERE as the database owner, exactly as the task
// authorizes, and exactly as a later I-04G writer will do it transactionally. The
// synthetic history Worlds are likewise provisioned directly as the database owner
// so their timeline is explicit and in the past; the staleness and race Worlds go
// through the frozen I-04B birth and I-04C leave primitives, so the substrate is
// also proven to compose with the real reviewed lifecycle.
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
const OWN_TABLES = [ITEMS, BASELINE, ITEM_APPROVERS, MANIFESTS, MANIFEST_ITEMS,
  PACKAGE_APPROVERS, PACKAGE_APPROVALS, GRANTS, GRANTED_EVENTS, GRANT_COMMANDS];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

const PREPARE_FN = 'public.prepare_shared_world_history_package_v1(uuid,uuid,uuid,uuid[])';
const APPROVE_FN = 'public.commit_shared_world_history_package_approval_v1(uuid,uuid)';
const GRANT_FN = 'public.commit_shared_world_history_access_grant_v1(uuid,uuid,uuid,uuid)';
const RESOLVE_FN = 'public.resolve_shared_world_history_visibility_v1(uuid,uuid)';
const TRUTH_FN = 'public.shared_world_history_item_temporal_truth_v1()';
const MUTATION_FUNCTIONS = [PREPARE_FN, APPROVE_FN, GRANT_FN];

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
const PREPARE_SQL = `SELECT outcome, prepared_manifest_version_id, prepared_world_id, prepared_grantee_user_id,
                            prepared_grantee_episode_id, prepared_item_count, prepared_required_approver_count,
                            prepared_at
                       FROM public.prepare_shared_world_history_package_v1($1,$2,$3,$4)`;
const APPROVE_SQL = `SELECT outcome, committed_approval_id, approved_manifest_version_id, approving_user_id,
                            approval_committed_at
                       FROM public.commit_shared_world_history_package_approval_v1($1,$2)`;
const GRANT_SQL = `SELECT outcome, history_command_id, granted_world_id, granted_manifest_version_id,
                          committed_grant_id, committed_event_id, history_granted_at
                     FROM public.commit_shared_world_history_access_grant_v1($1,$2,$3,$4)`;
const RESOLVE_SQL = 'SELECT world_id, history_item_id, occurred_at FROM public.resolve_shared_world_history_visibility_v1($1,$2)';

const preparePackage = (manifestId, worldId, granteeId, itemIds) => rows(PREPARE_SQL, [manifestId, worldId, granteeId, itemIds]);
const approvePackage = (approvalId, manifestId) => rows(APPROVE_SQL, [approvalId, manifestId]);
const commitGrant = (commandId, manifestId, grantId, eventId) => rows(GRANT_SQL, [commandId, manifestId, grantId, eventId]);
const leave = (commandId, worldId, eventId) => rows(LEAVE_SQL, [commandId, worldId, eventId]);

const opaqueRef = (label) => `ref:i04f-history:${label}:${randomUUID()}`;

const UUID = 'uuid';
const BIGINT = 'bigint';
const TSTZ = 'timestamp with time zone';
const TEXT = 'text';

const OWNED_COLUMNS = {
  [ITEMS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['occurred_at', TSTZ, 'NO', null],
    ['authority_requirement_mode', TEXT, 'NO', null], ['availability_state', TEXT, 'NO', null],
    ['availability_revision', BIGINT, 'NO', null], ['registered_at', TSTZ, 'NO', null],
  ],
  [BASELINE]: [['history_item_id', UUID, 'NO', null], ['user_id', UUID, 'NO', null]],
  [ITEM_APPROVERS]: [['history_item_id', UUID, 'NO', null], ['approver_user_id', UUID, 'NO', null]],
  [MANIFESTS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['grantee_user_id', UUID, 'NO', null],
    ['grantee_membership_episode_id', UUID, 'NO', null], ['created_at', TSTZ, 'NO', null],
  ],
  [MANIFEST_ITEMS]: [
    ['manifest_version_id', UUID, 'NO', null], ['world_id', UUID, 'NO', null],
    ['history_item_id', UUID, 'NO', null], ['captured_availability_revision', BIGINT, 'NO', null],
  ],
  [PACKAGE_APPROVERS]: [['manifest_version_id', UUID, 'NO', null], ['approver_user_id', UUID, 'NO', null]],
  [PACKAGE_APPROVALS]: [
    ['id', UUID, 'NO', null], ['manifest_version_id', UUID, 'NO', null],
    ['approver_user_id', UUID, 'NO', null], ['approved_at', TSTZ, 'NO', null],
  ],
  [GRANTS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['grantee_user_id', UUID, 'NO', null],
    ['grantee_membership_episode_id', UUID, 'NO', null], ['manifest_version_id', UUID, 'NO', null],
    ['granted_at', TSTZ, 'NO', null],
  ],
  [GRANTED_EVENTS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['history_access_grant_id', UUID, 'NO', null],
    ['manifest_version_id', UUID, 'NO', null], ['occurred_at', TSTZ, 'NO', null],
  ],
  [GRANT_COMMANDS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['manifest_version_id', UUID, 'NO', null],
    ['history_access_grant_id', UUID, 'NO', null], ['history_granted_event_id', UUID, 'NO', null],
    ['committed_at', TSTZ, 'NO', null],
  ],
};

const OWNED_FOREIGN_KEYS = {
  shared_world_history_items_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_history_item_baseline_viewers_item_fk: 'FOREIGN KEY (history_item_id) REFERENCES shared_world_history_items(id) ON DELETE RESTRICT',
  shared_world_history_item_baseline_viewers_user_fk: 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_history_item_required_approvers_item_fk: 'FOREIGN KEY (history_item_id) REFERENCES shared_world_history_items(id) ON DELETE RESTRICT',
  shared_world_history_item_required_approvers_user_fk: 'FOREIGN KEY (approver_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_history_package_manifest_versions_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_history_package_manifest_versions_grantee_fk: 'FOREIGN KEY (grantee_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_history_package_manifest_versions_episode_fk: 'FOREIGN KEY (grantee_membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_history_package_manifest_items_manifest_fk: 'FOREIGN KEY (manifest_version_id, world_id) REFERENCES shared_world_history_package_manifest_versions(id, world_id) ON DELETE RESTRICT',
  shared_world_history_package_manifest_items_item_fk: 'FOREIGN KEY (history_item_id, world_id) REFERENCES shared_world_history_items(id, world_id) ON DELETE RESTRICT',
  shared_world_history_package_required_approvers_manifest_fk: 'FOREIGN KEY (manifest_version_id) REFERENCES shared_world_history_package_manifest_versions(id) ON DELETE RESTRICT',
  shared_world_history_package_required_approvers_user_fk: 'FOREIGN KEY (approver_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_history_package_approvals_required_fk: 'FOREIGN KEY (manifest_version_id, approver_user_id) REFERENCES shared_world_history_package_required_approvers(manifest_version_id, approver_user_id) ON DELETE RESTRICT',
  shared_world_history_access_grants_manifest_fk: 'FOREIGN KEY (manifest_version_id, world_id, grantee_user_id, grantee_membership_episode_id) REFERENCES shared_world_history_package_manifest_versions(id, world_id, grantee_user_id, grantee_membership_episode_id) ON DELETE RESTRICT',
  shared_world_history_granted_events_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_history_granted_events_grant_fk: 'FOREIGN KEY (history_access_grant_id, world_id) REFERENCES shared_world_history_access_grants(id, world_id) ON DELETE RESTRICT',
  shared_world_history_granted_events_manifest_fk: 'FOREIGN KEY (manifest_version_id) REFERENCES shared_world_history_package_manifest_versions(id) ON DELETE RESTRICT',
  shared_world_history_grant_commands_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_history_grant_commands_grant_fk: 'FOREIGN KEY (history_access_grant_id, world_id) REFERENCES shared_world_history_access_grants(id, world_id) ON DELETE RESTRICT',
  shared_world_history_grant_commands_manifest_fk: 'FOREIGN KEY (manifest_version_id) REFERENCES shared_world_history_package_manifest_versions(id) ON DELETE RESTRICT',
  shared_world_history_grant_commands_event_fk: 'FOREIGN KEY (history_granted_event_id) REFERENCES shared_world_history_granted_events(id) ON DELETE RESTRICT',
};

const OWNED_BINDINGS = [
  [ITEMS, 'shared_world_history_items_pk', /PRIMARY KEY \(id\)/u],
  [ITEMS, 'shared_world_history_items_world_item_key', /UNIQUE \(world_id, id\)/u],
  [ITEMS, 'shared_world_history_items_authority_mode_check', /EXACT_HUMAN_APPROVER_SET[\s\S]*NO_HUMAN_APPROVAL_REQUIRED/u],
  [ITEMS, 'shared_world_history_items_availability_check', /AVAILABLE[\s\S]*DELETED_BY_OWNER[\s\S]*UNAVAILABLE/u],
  [ITEMS, 'shared_world_history_items_revision_check', /availability_revision > 0/u],
  [BASELINE, 'shared_world_history_item_baseline_viewers_pk', /PRIMARY KEY \(history_item_id, user_id\)/u],
  [ITEM_APPROVERS, 'shared_world_history_item_required_approvers_pk', /PRIMARY KEY \(history_item_id, approver_user_id\)/u],
  [MANIFESTS, 'shared_world_history_package_manifest_versions_pk', /PRIMARY KEY \(id\)/u],
  [MANIFESTS, 'shared_world_history_package_manifest_versions_world_key', /UNIQUE \(id, world_id\)/u],
  [MANIFESTS, 'shared_world_history_package_manifest_versions_grantee_key',
    /UNIQUE \(id, world_id, grantee_user_id, grantee_membership_episode_id\)/u],
  [MANIFEST_ITEMS, 'shared_world_history_package_manifest_items_pk', /PRIMARY KEY \(manifest_version_id, history_item_id\)/u],
  [MANIFEST_ITEMS, 'shared_world_history_package_manifest_items_revision_check', /captured_availability_revision > 0/u],
  [PACKAGE_APPROVERS, 'shared_world_history_package_required_approvers_pk', /PRIMARY KEY \(manifest_version_id, approver_user_id\)/u],
  [PACKAGE_APPROVALS, 'shared_world_history_package_approvals_pk', /PRIMARY KEY \(id\)/u],
  [PACKAGE_APPROVALS, 'shared_world_history_package_approvals_one_per_approver_key', /UNIQUE \(manifest_version_id, approver_user_id\)/u],
  [GRANTS, 'shared_world_history_access_grants_pk', /PRIMARY KEY \(id\)/u],
  [GRANTS, 'shared_world_history_access_grants_manifest_key', /UNIQUE \(manifest_version_id\)/u],
  [GRANTS, 'shared_world_history_access_grants_world_key', /UNIQUE \(id, world_id\)/u],
  [GRANTED_EVENTS, 'shared_world_history_granted_events_grant_key', /UNIQUE \(history_access_grant_id\)/u],
  [GRANTED_EVENTS, 'shared_world_history_granted_events_manifest_key', /UNIQUE \(manifest_version_id\)/u],
  [GRANT_COMMANDS, 'shared_world_history_grant_commands_manifest_key', /UNIQUE \(manifest_version_id\)/u],
  [GRANT_COMMANDS, 'shared_world_history_grant_commands_grant_key', /UNIQUE \(history_access_grant_id\)/u],
  [GRANT_COMMANDS, 'shared_world_history_grant_commands_event_key', /UNIQUE \(history_granted_event_id\)/u],
];

// ---------------------------------------------------------------------------

async function verifyCatalog() {
  stage = 'catalog: every relation 0087 owns exists exactly once';
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
      `${table} still carries every column migration 0087 owns, unchanged and in its original position`);
    for (const [name] of owned) {
      assert.equal(observed.filter((column) => column[0] === name).length, 1, `${table}.${name} appears exactly once`);
    }
  }
  stage = 'catalog: the frozen meaning of occurred_at is deployed, not merely commented';
  const [occurred] = await rows(
    `SELECT col_description($1::regclass, c.ordinal_position::int) AS note
       FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'shared_world_history_items'
        AND c.column_name = 'occurred_at'`, [ITEMS]);
  assert.match(occurred?.note ?? '', /canonical Shared-World establishment\/commit instant/u,
    'occurred_at is the Shared-World establishment instant of the history item, in the catalog where a later slice reads it');
  assert.match(occurred?.note ?? '', /only instant history visibility compares against a membership episode/u,
    'and it is the instant membership-interval comparison uses');
  assert.match(occurred?.note ?? '', /NOT an underlying recalled event time, source-event semantic timestamp or provenance event time/u,
    'and never a source or provenance event time: those belong to I-04G');

  // There is deliberately NO migration-wide column NAME or TYPE filter over the live
  // column list, for the same reason 0085 and 0086 carry none: it would refuse every
  // column a later REVIEWED slice appends, which is that slice's business rather than
  // 0087's to forbid - and the forward-safety probe below appends exactly such a
  // column. That migration 0087 ITSELF created no content, payload or role column is
  // a claim about 0087's own text, and it is proven there.

  stage = 'catalog: the exact bindings and foreign keys 0087 owns';
  const constraintsOf = async (table) => rows(
    'SELECT conname name, contype type, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY conname',
    [table]);
  const live = new Map();
  for (const table of OWN_TABLES) live.set(table, await constraintsOf(table));
  const defOf = (table, name) => (live.get(table).find((c) => c.name === name) ?? { def: `MISSING CONSTRAINT ${name}` }).def;
  for (const [table, name, shape] of OWNED_BINDINGS) {
    assert.match(defOf(table, name), shape, `${name} is the exact binding migration 0087 owns`);
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

  stage = 'catalog: the three mutation primitives are sealed, pinned, VOLATILE and app-unreachable';
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
    assert.doesNotMatch(fn.prosrc, /conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|consent|matching|introduction/iu,
      `${fnName} reads no Personal context and touches no grant or consent state`);
    assert.doesNotMatch(fn.prosrc, /DELETE FROM|TRUNCATE/iu, `${fnName} deletes no canonical history`);
    assert.doesNotMatch(fn.prosrc, /pg_advisory|LOCK TABLE/iu, `${fnName} takes only canonical row locks`);
    assert.doesNotMatch(fn.prosrc, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u,
      `${fnName} persists one database-owned instant`);
    assert.doesNotMatch(fn.prosrc, /INSERT INTO public\.shared_world_membership_episodes|UPDATE public\.shared_world_membership_episodes/u,
      `${fnName} opens and closes no membership episode: a history grant is not membership`);
    assert.doesNotMatch(fn.prosrc, /UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds/u,
      `${fnName} creates, closes and mutates no Shared World`);
    assert.doesNotMatch(fn.prosrc, /revoke[d_]|withdraw|rescind|retroactive/iu,
      `${fnName} invents no history-grant withdrawal: frozen canon defers that policy`);
    assert.match(fn.prosrc, /FROM public\.shared_worlds w WHERE w\.id = /u, `${fnName} locks the exact World row`);
  }
  const [prepareSource] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [PREPARE_FN]);
  assert.match(prepareSource.prosrc, /SELECT DISTINCT p_manifest_version_id, ra\.approver_user_id/u,
    'the required approver set is DERIVED as the exact union over the included items');
  assert.match(prepareSource.prosrc, /ORDER BY i\.id FOR UPDATE/u,
    'the selected items are locked in deterministic identity order');
  const [approveSource] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [APPROVE_FN]);
  assert.match(approveSource.prosrc, /u uuid := auth\.uid\(\);/u, 'the approving human is the session subject');
  const [grantSource] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [GRANT_FN]);
  assert.doesNotMatch(grantSource.prosrc, /auth\.uid/u,
    'the grant commit derives no granting actor: the authority is the completed material-authority set');

  stage = 'catalog: the visibility resolver is STABLE and service-role-only';
  const [resolver] = await rows(
    `SELECT pr.prosecdef secdef, pr.provolatile volatility, pr.proconfig config, pr.prosrc,
            pg_get_userbyid(pr.proowner) owner FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [RESOLVE_FN]);
  assert.ok(resolver, 'the visibility resolver exists');
  assert.equal(resolver.owner, 'postgres');
  assert.equal(resolver.secdef, true, 'the visibility resolver is SECURITY DEFINER');
  assert.equal(resolver.volatility, 's', 'the visibility resolver is STABLE (read-only)');
  assert.ok((resolver.config ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'));
  assert.doesNotMatch(resolver.prosrc, /INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt/u,
    'the resolver mutates nothing, locks nothing and trusts no client claim');
  assert.match(resolver.prosrc, /i\.availability_state = 'AVAILABLE'/u, 'availability dominates every visibility mode');
  const [{ allowed: resolverPublic }] = await rows("SELECT has_function_privilege('public', $1, 'EXECUTE') AS allowed", [RESOLVE_FN]);
  assert.equal(resolverPublic, false, 'PUBLIC must not execute the visibility resolver');
  for (const role of ['anon', 'authenticated']) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, RESOLVE_FN, 'EXECUTE']);
    assert.equal(allowed, false, `${role} must not execute the visibility resolver`);
  }
  const [{ allowed: serviceExecute }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed',
    ['service_role', RESOLVE_FN, 'EXECUTE']);
  assert.equal(serviceExecute, true, 'service_role is the only executor of the visibility resolver');

  stage = 'catalog: temporal truth is immutable and owner deletion is terminal';
  const [truth] = await rows(
    'SELECT pr.prosrc, pg_get_userbyid(pr.proowner) owner FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
    [TRUTH_FN]);
  assert.ok(truth, 'the immutability trigger function exists');
  assert.equal(truth.owner, 'postgres');
  assert.match(truth.prosrc, /NEW\.occurred_at <> OLD\.occurred_at/u, 'an item time can never be rewritten in place');
  assert.match(truth.prosrc, /OLD\.availability_state = 'DELETED_BY_OWNER'/u,
    'owner deletion must stay terminal: no revision may resurrect or relabel an owner-deleted item');
  assert.match(truth.prosrc, /SHARED_WORLD_HISTORY_OWNER_DELETION_TERMINAL/u,
    'and the terminal rule must fail closed with its own bounded class');
  const [{ n: truthTriggers }] = await rows(
    `SELECT count(*)::int n FROM pg_trigger t JOIN pg_proc pr ON pr.oid = t.tgfoid
      WHERE t.tgrelid = $1::regclass AND NOT t.tgisinternal AND pr.proname = 'shared_world_history_item_temporal_truth_v1'`,
    [ITEMS]);
  assert.equal(truthTriggers, 1, 'and it is really wired to the history projection');
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
  stage = 'ACL: no application role may execute any mutation primitive';
  for (const role of APPLICATION_ROLES) {
    await identity(role, randomUUID());
    await rejected(() => rows(PREPARE_SQL, [randomUUID(), randomUUID(), randomUUID(), [randomUUID()]]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => rows(APPROVE_SQL, [randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => rows(GRANT_SQL, [randomUUID(), randomUUID(), randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
  }
  stage = 'ACL: anon and authenticated cannot read history through the resolver either';
  for (const role of ['anon', 'authenticated']) {
    await identity(role, randomUUID());
    await rejected(() => rows(RESOLVE_SQL, [randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');
}

// ---------------------------------------------------------------------------
// Fixture provisioning. The synthetic history Worlds carry an EXPLICIT timeline
// anchored in the past, so "inside this episode" and "during the absence" are
// exact rather than accidental; they are written directly as the database owner,
// which is reachable by no application role and produces exactly the shape the
// frozen birth and governed add produce. The staleness and race Worlds go through
// the frozen I-04B birth primitive instead, so the substrate is also proven to
// compose with the real reviewed lifecycle.
// ---------------------------------------------------------------------------

async function provisionTimelineWorld(spec) {
  const worldId = randomUUID();
  await q(`INSERT INTO ${WORLDS}(id, lifecycle, phase, birth_basis, born_at)
           VALUES($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION', now() - interval '10 days')`, [worldId]);
  const episodes = [];
  for (const episode of spec) {
    const id = randomUUID();
    await q(`INSERT INTO ${EPISODES}(id, world_id, user_id, joined_at, ended_at, end_reason)
             VALUES($1,$2,$3, now() - interval '10 days' + ($4::int * interval '1 hour'),
                    CASE WHEN $5::int IS NULL THEN NULL
                         ELSE now() - interval '10 days' + ($5::int * interval '1 hour') END,
                    CASE WHEN $5::int IS NULL THEN NULL ELSE 'VOLUNTARY_LEAVE' END)`,
      [id, worldId, episode.user, episode.from, episode.to ?? null]);
    episodes.push({ id, ...episode });
  }
  return { worldId, episodes };
}

async function provisionBornWorld(inviter, target, label) {
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

/** Seed one history item, its exact baseline audience and its exact material authorities. */
async function seedItem(worldId, { hours = 0, viewers = [], approvers = [], mode = null, state = 'AVAILABLE', revision = 1 }) {
  const id = randomUUID();
  const resolvedMode = mode ?? (approvers.length > 0 ? 'EXACT_HUMAN_APPROVER_SET' : 'NO_HUMAN_APPROVAL_REQUIRED');
  await q(`INSERT INTO ${ITEMS}(id, world_id, occurred_at, authority_requirement_mode, availability_state,
                                availability_revision, registered_at)
           VALUES($1,$2, now() - interval '10 days' + ($3::int * interval '1 hour'), $4, $5, $6, clock_timestamp())`,
    [id, worldId, hours, resolvedMode, state, revision]);
  for (const viewer of viewers) {
    await q(`INSERT INTO ${BASELINE}(history_item_id, user_id) VALUES($1,$2)`, [id, viewer]);
  }
  for (const approver of approvers) {
    await q(`INSERT INTO ${ITEM_APPROVERS}(history_item_id, approver_user_id) VALUES($1,$2)`, [id, approver]);
  }
  return id;
}

/** The I-04G availability writer, simulated as the database owner exactly as the task authorizes. */
const setAvailability = (itemId, state) => q(
  `UPDATE ${ITEMS} SET availability_state = $2, availability_revision = availability_revision + 1 WHERE id = $1`,
  [itemId, state]);

const visibleFor = async (worldId, userId) => (await rows(RESOLVE_SQL, [worldId, userId])).map((row) => row.history_item_id);

/** Resolve as service_role, which is the only role the frozen posture lets read history. */
async function visibleAsService(worldId, userId) {
  await identity('service_role');
  const seen = await visibleFor(worldId, userId);
  await identity('postgres');
  return seen;
}

async function approveAs(human, approvalId, manifestId) {
  await identity('postgres', human);
  const result = await approvePackage(approvalId, manifestId);
  await identity('postgres');
  return result;
}

// ---------------------------------------------------------------------------

async function verifyMembershipPeriodVisibility(f) {
  stage = 'H01: a new member sees only baseline-visible items from their own membership interval forward';
  const w = await provisionTimelineWorld([
    { user: f.anchor, from: 0 },
    { user: f.newcomer, from: 10 },
  ]);
  const oldPrivate = await seedItem(w.worldId, { hours: 2, viewers: [f.anchor] });
  const oldShared = await seedItem(w.worldId, { hours: 3, viewers: [f.anchor, f.newcomer] });
  const newShared = await seedItem(w.worldId, { hours: 12, viewers: [f.anchor, f.newcomer] });
  const newPrivate = await seedItem(w.worldId, { hours: 13, viewers: [f.anchor] });

  assert.deepEqual((await visibleAsService(w.worldId, f.newcomer)).sort(), [newShared].sort(),
    'FROM_JOIN_FORWARD: the newcomer sees exactly the item that is both inside their episode and in its baseline audience');
  assert.deepEqual((await visibleAsService(w.worldId, f.anchor)).sort(),
    [oldPrivate, oldShared, newShared, newPrivate].sort(),
    'and the long-standing member sees every item they were actually an audience of');

  stage = 'H18: hidden history produces zero rows, not ghost counts, names or placeholders';
  const seen = await rows(RESOLVE_SQL, [w.worldId, f.newcomer]);
  assert.equal(seen.length, 1, 'exactly one row, and nothing standing in for the three hidden items');
  assert.deepEqual(Object.keys(seen[0]).sort(), ['history_item_id', 'occurred_at', 'world_id'],
    'the resolver returns item identity and time only - never content and never a count');
  assert.equal(seen[0].world_id, w.worldId);

  stage = 'membership interval alone is never historical visibility';
  // oldShared names the newcomer in its baseline audience and is still invisible,
  // because it happened before their episode began; newPrivate is inside their
  // episode and is still invisible, because they were never in its audience.
  assert.ok(!(await visibleAsService(w.worldId, f.newcomer)).includes(oldShared));
  assert.ok(!(await visibleAsService(w.worldId, f.newcomer)).includes(newPrivate));

  stage = 'a human who is not a current member of an ACTIVE World gets no browsing at all';
  assert.deepEqual(await visibleAsService(w.worldId, f.outsider), [],
    'and a truthful empty answer rather than a distinguishable error, so this is no membership oracle');
  return w;
}

async function verifyRejoinVisibility(f) {
  stage = 'H02 / H03: rejoin restores prior authorized membership-period history and never the absence interval';
  const w = await provisionTimelineWorld([
    { user: f.anchor, from: 0 },
    { user: f.rejoiner, from: 0, to: 5 },
    { user: f.rejoiner, from: 20 },
  ]);
  const duringFirst = await seedItem(w.worldId, { hours: 2, viewers: [f.anchor, f.rejoiner] });
  const duringAbsence = await seedItem(w.worldId, { hours: 10, viewers: [f.anchor, f.rejoiner] });
  const absenceOther = await seedItem(w.worldId, { hours: 11, viewers: [f.anchor] });
  const duringSecond = await seedItem(w.worldId, { hours: 22, viewers: [f.anchor, f.rejoiner] });

  assert.deepEqual((await visibleAsService(w.worldId, f.rejoiner)).sort(), [duringFirst, duringSecond].sort(),
    'the rejoiner sees both membership periods and neither absence-period item');

  stage = 'H04: an explicit committed grant adds exactly the absence-period item';
  const manifest = randomUUID();
  const [prepared] = await preparePackage(manifest, w.worldId, f.rejoiner, [duringAbsence]);
  assert.equal(prepared.outcome, 'PREPARED');
  assert.equal(prepared.prepared_required_approver_count, 0, 'an explicitly approval-free item requires no human');
  assert.equal(prepared.prepared_item_count, 1);
  const [granted] = await commitGrant(randomUUID(), manifest, randomUUID(), randomUUID());
  assert.equal(granted.outcome, 'HISTORY_GRANTED');
  assert.deepEqual((await visibleAsService(w.worldId, f.rejoiner)).sort(),
    [duringFirst, duringAbsence, duringSecond].sort(),
    'the grant contributes exactly the granted absence-period item, and widens nothing else');
  assert.ok(!(await visibleAsService(w.worldId, f.rejoiner)).includes(absenceOther),
    'an ungranted absence-period item stays hidden');
  return { world: w, duringAbsence, grantedManifest: manifest };
}

async function verifyExactAuthority(f) {
  stage = 'H06 / H07: the required approver set is the exact union of item-level material authorities';
  const w = await provisionTimelineWorld([
    { user: f.anchor, from: 0 },
    { user: f.firstAuthority, from: 0 },
    { user: f.secondAuthority, from: 0 },
    { user: f.grantee, from: 30 },
  ]);
  const firstOwned = await seedItem(w.worldId, { hours: 1, viewers: [f.anchor, f.firstAuthority], approvers: [f.firstAuthority] });
  const secondOwned = await seedItem(w.worldId, { hours: 2, viewers: [f.anchor, f.secondAuthority], approvers: [f.secondAuthority] });
  const free = await seedItem(w.worldId, { hours: 3, viewers: [f.anchor], mode: 'NO_HUMAN_APPROVAL_REQUIRED' });

  const manifest = randomUUID();
  const [prepared] = await preparePackage(manifest, w.worldId, f.grantee, [firstOwned, secondOwned, free]);
  assert.deepEqual(Object.keys(prepared).sort(), [
    'outcome', 'prepared_at', 'prepared_grantee_episode_id', 'prepared_grantee_user_id', 'prepared_item_count',
    'prepared_manifest_version_id', 'prepared_required_approver_count', 'prepared_world_id',
  ].sort(), 'the preparation returns exactly the bounded immutable result');
  assert.equal(prepared.prepared_item_count, 3);
  assert.equal(prepared.prepared_required_approver_count, 2,
    'the derived set is the exact UNION over the included items, and the approval-free item adds nobody');
  const derived = (await rows(`SELECT approver_user_id FROM ${PACKAGE_APPROVERS} WHERE manifest_version_id = $1 ORDER BY 1`, [manifest]))
    .map((row) => row.approver_user_id);
  assert.deepEqual(derived.sort(), [f.firstAuthority, f.secondAuthority].sort(),
    'exactly the two humans who actually hold material authority over the included items');
  assert.ok(!derived.includes(f.anchor), 'World membership alone creates no approval requirement and no veto');

  stage = 'H07 / H08: a mixed-owner package needs every exact human, and one cannot satisfy another';
  await rejected(() => commitGrant(randomUUID(), manifest, randomUUID(), randomUUID()), INCOMPLETE,
    /SHARED_WORLD_HISTORY_APPROVALS_INCOMPLETE/u);
  const [firstApproval] = await approveAs(f.firstAuthority, randomUUID(), manifest);
  assert.equal(firstApproval.outcome, 'APPROVED');
  assert.equal(firstApproval.approving_user_id, f.firstAuthority, 'the approver is derived from the session, never supplied');
  await rejected(() => commitGrant(randomUUID(), manifest, randomUUID(), randomUUID()), INCOMPLETE,
    /SHARED_WORLD_HISTORY_APPROVALS_INCOMPLETE/u);
  // The first authority cannot approve twice to cover the second human's requirement.
  await rejected(() => approveAs(f.firstAuthority, randomUUID(), manifest), CONFLICT, /SHARED_WORLD_HISTORY_ID_CONFLICT/u);
  // Nor can an unrelated World member, however senior, stand in for a material authority.
  await rejected(() => approveAs(f.anchor, randomUUID(), manifest), UNAVAILABLE, /SHARED_WORLD_HISTORY_NOT_AVAILABLE/u);

  stage = 'H09: a former member who is still an exact required material authority can approve';
  // The second authority leaves the World whose history they own material in - a
  // direct episode close, which is exactly the shape the frozen I-04C leave
  // produces, applied here to this explicit synthetic timeline.
  await q(`UPDATE ${EPISODES} SET ended_at = clock_timestamp(), end_reason = 'VOLUNTARY_LEAVE'
            WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL`, [w.worldId, f.secondAuthority]);
  assert.deepEqual(await visibleAsService(w.worldId, f.secondAuthority), [],
    'the former member has no World browsing at all any more');
  const [secondApproval] = await approveAs(f.secondAuthority, randomUUID(), manifest);
  assert.equal(secondApproval.outcome, 'APPROVED',
    'and still exercises the material authority they retain over their own material');
  assert.deepEqual(await visibleAsService(w.worldId, f.secondAuthority), [],
    'approving restored no World browsing whatsoever');

  stage = 'an unrelated World mutation never stales this package';
  const unrelated = await provisionBornWorld(f.anchor, f.outsider, 'unrelated');
  await identity('postgres', f.outsider);
  await leave(randomUUID(), unrelated.worldId, randomUUID());
  await identity('postgres');

  const grantId = randomUUID();
  const eventId = randomUUID();
  const [committed] = await commitGrant(randomUUID(), manifest, grantId, eventId);
  assert.equal(committed.outcome, 'HISTORY_GRANTED');
  assert.deepEqual(Object.keys(committed).sort(), [
    'outcome', 'committed_event_id', 'committed_grant_id', 'granted_manifest_version_id', 'granted_world_id',
    'history_command_id', 'history_granted_at',
  ].sort(), 'the grant commit returns exactly the bounded immutable result');
  const [{ oneInstant }] = await rows(
    `SELECT (g.granted_at = ev.occurred_at AND ev.occurred_at = cmd.committed_at) AS "oneInstant"
       FROM ${GRANTS} g JOIN ${GRANTED_EVENTS} ev ON ev.history_access_grant_id = g.id
       JOIN ${GRANT_COMMANDS} cmd ON cmd.history_access_grant_id = g.id WHERE g.id = $1`, [grantId]);
  assert.equal(oneInstant, true, 'granted_at, occurred_at and committed_at are ONE database-owned instant');
  assert.deepEqual((await visibleAsService(w.worldId, f.grantee)).sort(), [firstOwned, secondOwned, free].sort(),
    'the grantee now sees exactly the granted package, and nothing adjacent to it');

  stage = 'H05: one manifest commits at most one grant, and its identity is never re-bound';
  await rejected(() => commitGrant(randomUUID(), manifest, randomUUID(), randomUUID()), CONFLICT,
    /SHARED_WORLD_HISTORY_ID_CONFLICT/u);
  await rejected(() => preparePackage(manifest, w.worldId, f.grantee, [firstOwned]), CONFLICT,
    /SHARED_WORLD_HISTORY_ID_CONFLICT/u);
  await rejected(() => preparePackage(manifest, w.worldId, f.anchor, [firstOwned, secondOwned, free]), CONFLICT,
    /SHARED_WORLD_HISTORY_ID_CONFLICT/u);
  assert.deepEqual(await preparePackage(manifest, w.worldId, f.grantee, [free, secondOwned, firstOwned]), [prepared],
    'an equivalent retry - the same identity, World, grantee and exact item set in any order - returns committed history');

  stage = 'H12: a changed package is a NEW manifest, and old approvals do not authorize it';
  const narrower = randomUUID();
  const [narrowed] = await preparePackage(narrower, w.worldId, f.grantee, [firstOwned]);
  assert.equal(narrowed.prepared_required_approver_count, 1, 'the narrower package derives its own exact required set');
  await rejected(() => commitGrant(randomUUID(), narrower, randomUUID(), randomUUID()), INCOMPLETE,
    /SHARED_WORLD_HISTORY_APPROVALS_INCOMPLETE/u);
  await approveAs(f.firstAuthority, randomUUID(), narrower);
  const [narrowGrant] = await commitGrant(randomUUID(), narrower, randomUUID(), randomUUID());
  assert.equal(narrowGrant.outcome, 'HISTORY_GRANTED', 'and needs NEWLY collected approvals of its own');

  stage = 'H10: missing or contradictory item authority metadata fails closed';
  const missingMetadata = await seedItem(w.worldId, { hours: 4, viewers: [f.anchor], mode: 'EXACT_HUMAN_APPROVER_SET' });
  const contradictory = await seedItem(w.worldId, { hours: 5, viewers: [f.anchor], mode: 'NO_HUMAN_APPROVAL_REQUIRED' });
  await q(`INSERT INTO ${ITEM_APPROVERS}(history_item_id, approver_user_id) VALUES($1,$2)`, [contradictory, f.firstAuthority]);
  await rejected(() => preparePackage(randomUUID(), w.worldId, f.grantee, [missingMetadata]), CONTRADICTORY,
    /SHARED_WORLD_HISTORY_CONTRADICTORY_STATE/u);
  await rejected(() => preparePackage(randomUUID(), w.worldId, f.grantee, [contradictory]), CONTRADICTORY,
    /SHARED_WORLD_HISTORY_CONTRADICTORY_STATE/u);
  await rejected(() => preparePackage(randomUUID(), w.worldId, f.grantee, [free, missingMetadata]), CONTRADICTORY,
    /SHARED_WORLD_HISTORY_CONTRADICTORY_STATE/u);
  // An empty required set is legitimate ONLY under an explicit approval-free package.
  const freeOnly = randomUUID();
  const [freePrepared] = await preparePackage(freeOnly, w.worldId, f.grantee, [free]);
  assert.equal(freePrepared.prepared_required_approver_count, 0);
  const [freeGrant] = await commitGrant(randomUUID(), freeOnly, randomUUID(), randomUUID());
  assert.equal(freeGrant.outcome, 'HISTORY_GRANTED', 'an explicitly approval-free package commits with zero approvals');

  stage = 'an item that gains a required human after preparation can no longer be granted under the narrower set';
  const lateManifest = randomUUID();
  await preparePackage(lateManifest, w.worldId, f.grantee, [free]);
  await q(`INSERT INTO ${ITEM_APPROVERS}(history_item_id, approver_user_id) VALUES($1,$2)`, [free, f.firstAuthority]);
  await rejected(() => commitGrant(randomUUID(), lateManifest, randomUUID(), randomUUID()), CONTRADICTORY,
    /SHARED_WORLD_HISTORY_CONTRADICTORY_STATE/u);
  await q(`DELETE FROM ${ITEM_APPROVERS} WHERE history_item_id = $1 AND approver_user_id = $2`, [free, f.firstAuthority]);

  stage = 'bounded refusals and command invalidity';
  await rejected(() => preparePackage(randomUUID(), randomUUID(), f.grantee, [free]), UNAVAILABLE, /NOT_AVAILABLE/u);
  await rejected(() => preparePackage(randomUUID(), w.worldId, f.outsider, [free]), UNAVAILABLE, /NOT_AVAILABLE/u);
  await rejected(() => preparePackage(randomUUID(), w.worldId, f.grantee, []), INVALID_PARAMETER);
  await rejected(() => preparePackage(randomUUID(), w.worldId, f.grantee, [free, free]), INVALID_PARAMETER);
  await rejected(() => preparePackage(randomUUID(), w.worldId, f.grantee, [null]), INVALID_PARAMETER);
  await rejected(() => preparePackage(randomUUID(), w.worldId, f.grantee, [randomUUID()]), UNAVAILABLE, /NOT_AVAILABLE/u);
  // A manifest that does not exist reaches the same bounded class as a human who is
  // not a required approver - asked under a real session, because the approval
  // primitive fails closed on an absent one before it looks at anything else.
  await identity('postgres', f.firstAuthority);
  await rejected(() => approvePackage(randomUUID(), randomUUID()), UNAVAILABLE, /NOT_AVAILABLE/u);
  await identity('postgres');
  await rejected(() => commitGrant(randomUUID(), randomUUID(), randomUUID(), randomUUID()), UNAVAILABLE, /NOT_AVAILABLE/u);
  await rejected(() => rows(RESOLVE_SQL, [randomUUID(), f.grantee]), UNAVAILABLE, /NOT_AVAILABLE/u);
  await rejected(() => rows(RESOLVE_SQL, [null, f.grantee]), INVALID_PARAMETER);
  // An unauthenticated approval fails closed rather than defaulting to anybody.
  await identity('postgres');
  await rejected(() => approvePackage(randomUUID(), manifest), INSUFFICIENT_PRIVILEGE, /AUTHENTICATION_REQUIRED/u);
  return { world: w, items: { firstOwned, secondOwned, free }, manifest, grantId };
}

async function verifyAvailabilityAndStaleness(f) {
  stage = 'H11: a changed availability revision after preparation stales the commit';
  const w = await provisionTimelineWorld([
    { user: f.anchor, from: 0 },
    { user: f.grantee, from: 30 },
  ]);
  const moved = await seedItem(w.worldId, { hours: 1, viewers: [f.anchor], approvers: [f.anchor] });
  const staleManifest = randomUUID();
  await preparePackage(staleManifest, w.worldId, f.grantee, [moved]);
  await setAvailability(moved, 'UNAVAILABLE');
  // The required human tries to approve: the item staleness is found before the
  // approver check, so even the right human cannot approve a moved package.
  await rejected(() => approveAs(f.anchor, randomUUID(), staleManifest), STALE, /SHARED_WORLD_HISTORY_STALE/u);
  await rejected(() => commitGrant(randomUUID(), staleManifest, randomUUID(), randomUUID()), STALE,
    /SHARED_WORLD_HISTORY_STALE/u);
  // Even restoring AVAILABLE does not revive it: the revision moved, and the
  // manifest captured the exact revision it was prepared over.
  await setAvailability(moved, 'AVAILABLE');
  await rejected(() => commitGrant(randomUUID(), staleManifest, randomUUID(), randomUUID()), STALE,
    /SHARED_WORLD_HISTORY_STALE/u);

  stage = 'H19 / H20: an owner-deleted item is never returned, and the audit rows are not erased';
  const deletable = await seedItem(w.worldId, { hours: 2, viewers: [f.anchor] });
  const liveManifest = randomUUID();
  await preparePackage(liveManifest, w.worldId, f.grantee, [deletable]);
  const grantId = randomUUID();
  const eventId = randomUUID();
  const commandId = randomUUID();
  await commitGrant(commandId, liveManifest, grantId, eventId);
  assert.deepEqual(await visibleAsService(w.worldId, f.grantee), [deletable], 'the granted item is visible');
  await setAvailability(deletable, 'DELETED_BY_OWNER');
  assert.deepEqual(await visibleAsService(w.worldId, f.grantee), [],
    'a DELETED_BY_OWNER item is never returned, even though the grant exists');
  const [{ n: audit }] = await rows(
    `SELECT (SELECT count(*) FROM ${GRANTS} WHERE id = $1)
          + (SELECT count(*) FROM ${GRANTED_EVENTS} WHERE id = $2)
          + (SELECT count(*) FROM ${GRANT_COMMANDS} WHERE id = $3)
          + (SELECT count(*) FROM ${MANIFEST_ITEMS} WHERE manifest_version_id = $4) AS n`,
    [grantId, eventId, commandId, liveManifest]);
  assert.equal(Number(audit), 4, 'the grant, its event, its command and its manifest items all remain');

  stage = 'owner deletion is TERMINAL: no revision can resurrect or relabel a DELETED_BY_OWNER item';
  // Both transitions are refused even when a HIGHER revision is offered, which is
  // the only way they could otherwise have slipped past the revision rules.
  await rejected(() => q(
    `UPDATE ${ITEMS} SET availability_state = 'AVAILABLE', availability_revision = availability_revision + 1
      WHERE id = $1`, [deletable]), CONTRADICTORY, /SHARED_WORLD_HISTORY_OWNER_DELETION_TERMINAL/u);
  await rejected(() => q(
    `UPDATE ${ITEMS} SET availability_state = 'UNAVAILABLE', availability_revision = availability_revision + 1
      WHERE id = $1`, [deletable]), CONTRADICTORY, /SHARED_WORLD_HISTORY_OWNER_DELETION_TERMINAL/u);
  // The revision alone is frozen too: the historical truth that the OWNER deleted
  // it, and at which revision, is part of what must survive.
  await rejected(() => q(
    `UPDATE ${ITEMS} SET availability_revision = availability_revision + 1 WHERE id = $1`, [deletable]),
    CONTRADICTORY, /SHARED_WORLD_HISTORY_OWNER_DELETION_TERMINAL/u);
  const [terminal] = await rows(
    `SELECT availability_state, availability_revision FROM ${ITEMS} WHERE id = $1`, [deletable]);
  assert.equal(terminal.availability_state, 'DELETED_BY_OWNER', 'the item still reads exactly as its owner left it');
  assert.equal(Number(terminal.availability_revision), 2);
  assert.deepEqual(await visibleAsService(w.worldId, f.grantee), [], 'and it stays invisible');
  const [{ n: auditAfter }] = await rows(
    `SELECT (SELECT count(*) FROM ${GRANTS} WHERE id = $1)
          + (SELECT count(*) FROM ${GRANTED_EVENTS} WHERE id = $2)
          + (SELECT count(*) FROM ${GRANT_COMMANDS} WHERE id = $3)
          + (SELECT count(*) FROM ${MANIFEST_ITEMS} WHERE manifest_version_id = $4) AS n`,
    [grantId, eventId, commandId, liveManifest]);
  assert.equal(Number(auditAfter), 4, 'and the whole grant audit is still intact');

  stage = 'UNAVAILABLE is deliberately NOT terminal: frozen canon does not require it';
  // `moved` was taken AVAILABLE -> UNAVAILABLE -> AVAILABLE above, which is exactly
  // the transition an item that is merely unavailable must still be able to make.
  const [recoverable] = await rows(`SELECT availability_state FROM ${ITEMS} WHERE id = $1`, [moved]);
  assert.equal(recoverable.availability_state, 'AVAILABLE',
    'an item that was only UNAVAILABLE legitimately became available again');

  stage = 'temporal truth is immutable: an item time can never be rewritten';
  await rejected(() => q(`UPDATE ${ITEMS} SET occurred_at = clock_timestamp() WHERE id = $1`, [moved]),
    CONTRADICTORY, /TEMPORAL_TRUTH_IMMUTABLE/u);
  await rejected(() => q(`UPDATE ${ITEMS} SET authority_requirement_mode = 'NO_HUMAN_APPROVAL_REQUIRED' WHERE id = $1`, [moved]),
    CONTRADICTORY, /TEMPORAL_TRUTH_IMMUTABLE/u);
  await rejected(() => q(`UPDATE ${ITEMS} SET availability_state = 'UNAVAILABLE' WHERE id = $1`, [moved]),
    CONTRADICTORY, /AVAILABILITY_REVISION_REQUIRED/u);
  await rejected(() => q(`UPDATE ${ITEMS} SET availability_revision = 1 WHERE id = $1`, [moved]),
    CONTRADICTORY, /AVAILABILITY_REVISION_REGRESSED/u);
  return w;
}

async function verifyGranteeLifecycle(f) {
  stage = 'H13: a grantee leave stales the manifest prepared under their old episode';
  const born = await provisionBornWorld(f.anchor, f.mover, 'grantee-lifecycle');
  // The item predates every episode of this World, so ONLY an explicit grant can
  // ever make it visible - the membership-period basis can never account for it.
  const item = await seedItem(born.worldId, { hours: 0, viewers: [f.anchor] });
  const firstManifest = randomUUID();
  const [firstPrepared] = await preparePackage(firstManifest, born.worldId, f.mover, [item]);
  assert.equal(firstPrepared.prepared_grantee_episode_id, born.targetEpisode,
    'the manifest binds the grantee EXACT open episode');
  await identity('postgres', f.mover);
  await leave(randomUUID(), born.worldId, randomUUID());
  await identity('postgres');
  await rejected(() => approveAs(f.anchor, randomUUID(), firstManifest), STALE, /SHARED_WORLD_HISTORY_STALE/u);
  await rejected(() => commitGrant(randomUUID(), firstManifest, randomUUID(), randomUUID()), STALE,
    /SHARED_WORLD_HISTORY_STALE/u);

  stage = 'H14: a same-human rejoin creates a NEW episode and never revives the old manifest';
  const secondEpisode = randomUUID();
  await q(`INSERT INTO ${EPISODES}(id, world_id, user_id, joined_at) VALUES($1,$2,$3, clock_timestamp())`,
    [secondEpisode, born.worldId, f.mover]);
  await rejected(() => commitGrant(randomUUID(), firstManifest, randomUUID(), randomUUID()), STALE,
    /SHARED_WORLD_HISTORY_STALE/u);
  const secondManifest = randomUUID();
  const [secondPrepared] = await preparePackage(secondManifest, born.worldId, f.mover, [item]);
  assert.equal(secondPrepared.prepared_grantee_episode_id, secondEpisode,
    'a fresh episode requires a fresh manifest, and the fresh manifest binds the fresh episode');
  assert.notEqual(secondPrepared.prepared_grantee_episode_id, firstPrepared.prepared_grantee_episode_id);
  const grantId = randomUUID();
  await commitGrant(randomUUID(), secondManifest, grantId, randomUUID());
  assert.deepEqual(await visibleAsService(born.worldId, f.mover), [item], 'the new grant is effective');

  stage = 'H15: a committed grant survives a leave as historical authority, and restores no browsing';
  await identity('postgres', f.mover);
  await leave(randomUUID(), born.worldId, randomUUID());
  await identity('postgres');
  assert.deepEqual(await visibleAsService(born.worldId, f.mover), [],
    'while not a current member of an ACTIVE World, an old grant restores no browsing');
  const [{ n: survived }] = await rows(`SELECT count(*)::int n FROM ${GRANTS} WHERE id = $1`, [grantId]);
  assert.equal(survived, 1, 'and the grant itself is not erased by the leave');

  stage = 'H16: on a later valid rejoin the committed grant contributes again';
  await q(`INSERT INTO ${EPISODES}(id, world_id, user_id, joined_at) VALUES($1,$2,$3, clock_timestamp())`,
    [randomUUID(), born.worldId, f.mover]);
  assert.deepEqual(await visibleAsService(born.worldId, f.mover), [item],
    'the previously committed explicit grant again contributes to effective history access');
  return born;
}

async function verifyTemporalTruthPreserved(before) {
  stage = 'H17: later visibility never changed any item occurred_at or any episode timing';
  const after = await rows(
    `SELECT id, occurred_at FROM ${ITEMS} WHERE id = ANY($1::uuid[]) ORDER BY id`, [before.itemIds]);
  assert.deepEqual(after, before.items, 'every history item still occurred exactly when it occurred');
  const episodes = await rows(
    `SELECT id, joined_at FROM ${EPISODES} WHERE id = ANY($1::uuid[]) ORDER BY id`, [before.episodeIds]);
  assert.deepEqual(episodes, before.episodes, 'and every membership episode still began exactly when it began');
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

    stage = 'concurrency 1: a grantee leave winning first stales the queued history grant';
    const w1 = c.worlds.leaveFirst;
    await asOwnerFor(a, w1.grantee);
    const leaveRun = a.query(LEAVE_SQL, [randomUUID(), w1.worldId, randomUUID()]);
    assert.equal(await blocks(leaveRun), 'COMPLETED');
    await asOwnerFor(b, c.anchor);
    const queuedGrant = b.query(GRANT_SQL, [randomUUID(), w1.manifest, randomUUID(), randomUUID()]);
    assert.equal(await blocks(queuedGrant), 'BLOCKED', 'the grant queues on the exact World row the leave holds');
    await a.query('COMMIT');
    const staleError = await failureOf(queuedGrant);
    assert.equal(staleError?.code, '40001', 'and then finds the grantee episode stale, rather than deadlocking');
    await b.query('ROLLBACK');
    const [{ n: noGrant }] = await rows(`SELECT count(*)::int n FROM ${GRANTS} WHERE world_id = $1`, [w1.worldId]);
    assert.equal(noGrant, 0, 'the losing grant commit changed nothing');

    stage = 'concurrency 2: a history grant winning first changes no topology, and the later leave still succeeds';
    const w2 = c.worlds.grantFirst;
    await asOwnerFor(a, c.anchor);
    const grantRun = a.query(GRANT_SQL, [randomUUID(), w2.manifest, randomUUID(), randomUUID()]);
    assert.equal(await blocks(grantRun), 'COMPLETED');
    assert.equal((await grantRun).rows[0].outcome, 'HISTORY_GRANTED');
    await asOwnerFor(b, w2.grantee);
    const queuedLeave = b.query(LEAVE_SQL, [randomUUID(), w2.worldId, randomUUID()]);
    assert.equal(await blocks(queuedLeave), 'BLOCKED', 'the leave queues on the World row the grant commit holds');
    await a.query('COMMIT');
    assert.equal((await queuedLeave).rows[0].outcome, 'LEFT', 'and then proceeds: a history grant blocks no membership mutation');
    await b.query('COMMIT');
    const [{ n: stillOpen }] = await rows(
      `SELECT count(*)::int n FROM ${EPISODES} WHERE world_id = $1 AND ended_at IS NULL`, [w2.worldId]);
    assert.equal(stillOpen, 1, 'the grant commit itself changed no membership topology');

    stage = 'concurrency 3: two competing commits of one manifest produce exactly one grant';
    const w3 = c.worlds.twoCommits;
    await asOwnerFor(a, c.anchor); await asOwnerFor(b, c.anchor);
    const firstCommit = a.query(GRANT_SQL, [randomUUID(), w3.manifest, randomUUID(), randomUUID()]);
    assert.equal(await blocks(firstCommit), 'COMPLETED');
    const secondCommit = b.query(GRANT_SQL, [randomUUID(), w3.manifest, randomUUID(), randomUUID()]);
    assert.equal(await blocks(secondCommit), 'BLOCKED', 'the second commit queues on the same World row');
    await a.query('COMMIT');
    const conflict = await failureOf(secondCommit);
    assert.equal(conflict?.code, '23505', 'and then finds the one grant this manifest may commit already committed');
    await b.query('ROLLBACK');
    const [{ n: grants }] = await rows(`SELECT count(*)::int n FROM ${GRANTS} WHERE manifest_version_id = $1`, [w3.manifest]);
    assert.equal(grants, 1, 'exactly one grant exists for the manifest');

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
  stage = 'forward safety: the I-04G material store, a reviewed availability writer and a Launch Gate do not fail this verifier';
  await identity('postgres');
  const probe = `i04f_hist_probe_${randomUUID().replace(/-/gu, '').slice(0, 12)}`;
  await q('SAVEPOINT forward_safety');
  try {
    // I-04G: real Shared material bound to the history item identity this slice owns.
    await q(`CREATE TABLE public.${probe}_shared_material (id uuid PRIMARY KEY, history_item_id uuid NOT NULL,
             body text, audio_url text)`);
    await q(`ALTER TABLE public.${probe}_shared_material ADD CONSTRAINT ${probe}_material_item_fk
             FOREIGN KEY (history_item_id) REFERENCES ${ITEMS} (id) ON DELETE RESTRICT`);
    // I-04G: the reviewed owner-delete availability writer, following World-first order.
    await q(`CREATE FUNCTION public.${probe}_availability_writer(p_world_id uuid, p_item_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             DECLARE w public.shared_worlds;
             BEGIN
               SELECT * INTO w FROM public.shared_worlds x WHERE x.id = p_world_id FOR UPDATE;
               UPDATE public.shared_world_history_items i
                  SET availability_state = 'DELETED_BY_OWNER', availability_revision = i.availability_revision + 1
                WHERE i.id = p_item_id;
             END$fn$`);
    // A later reviewed provenance / dependency relation.
    await q(`CREATE TABLE public.${probe}_provenance (id uuid PRIMARY KEY, history_item_id uuid
             REFERENCES ${ITEMS} (id) ON DELETE RESTRICT, dependency_kind text)`);
    // A later reviewed Introduction closed-history consumer.
    await q(`CREATE TABLE public.${probe}_introduction_closed_history (id uuid PRIMARY KEY, world_id uuid NOT NULL)`);
    // CW2-08's Launch Gate and a launch-gated application wrapper.
    await q(`CREATE TABLE public.${probe}_launch_gates (id uuid PRIMARY KEY, capability text NOT NULL, state text NOT NULL)`);
    await q(`CREATE FUNCTION public.${probe}_grant_history_gated_v1(p_command_id uuid, p_manifest_id uuid,
             p_grant_id uuid, p_event_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    await q(`GRANT EXECUTE ON FUNCTION public.${probe}_grant_history_gated_v1(uuid, uuid, uuid, uuid) TO authenticated`);
    // Later additive history metadata, with column names and types 0087 would never
    // have written itself.
    await q(`ALTER TABLE ${ITEMS} ADD COLUMN ${probe}_item_consumer_metadata jsonb`);
    await q(`ALTER TABLE ${ITEMS} ADD COLUMN ${probe}_material_class text`);
    await q(`ALTER TABLE ${GRANTS} ADD COLUMN ${probe}_delivery_epoch bigint`);
    await q(`ALTER TABLE ${MANIFESTS} ADD CONSTRAINT ${probe}_manifest_created_check CHECK (created_at IS NOT NULL)`);
    await q(`CREATE INDEX ${probe}_items_availability_idx ON ${ITEMS} (world_id, availability_state)`);
    // A later reviewed AUDIT trigger on a table 0087 owns. Deliberately inert: an
    // AFTER ... FOR EACH ROW trigger whose return value PostgreSQL discards.
    await q(`CREATE FUNCTION public.${probe}_audit_fn() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN RETURN NULL; END$fn$`);
    await q(`CREATE TRIGGER ${probe}_items_audit AFTER INSERT ON ${ITEMS}
             FOR EACH ROW EXECUTE FUNCTION public.${probe}_audit_fn()`);
    await verifyCatalog();

    stage = 'forward safety: the whole selective-history journey still works beside the authorized future';
    const w = await provisionTimelineWorld([
      { user: f.anchor, from: 0 },
      { user: f.forwardGrantee, from: 30 },
    ]);
    const item = await seedItem(w.worldId, { hours: 1, viewers: [f.anchor], approvers: [f.anchor] });
    const manifest = randomUUID();
    const [prepared] = await preparePackage(manifest, w.worldId, f.forwardGrantee, [item]);
    assert.equal(prepared.outcome, 'PREPARED', 'a package still prepares beside the later authorized schema');
    await approveAs(f.anchor, randomUUID(), manifest);
    const [granted] = await commitGrant(randomUUID(), manifest, randomUUID(), randomUUID());
    assert.equal(granted.outcome, 'HISTORY_GRANTED', 'and still commits');
    assert.deepEqual(await visibleAsService(w.worldId, f.forwardGrantee), [item],
      'and the resolver still answers correctly beside later columns, tables, indexes and triggers');
    // The reviewed availability writer narrows visibility exactly as I-04F requires.
    await q(`SELECT public.${probe}_availability_writer($1, $2)`, [w.worldId, item]);
    assert.deepEqual(await visibleAsService(w.worldId, f.forwardGrantee), [],
      'a later reviewed owner deletion removes source visibility without touching the grant');

    stage = 'forward safety: a real regression to something 0087 OWNS is still refused';
    for (const [reason, plant, refuses] of [
      ['an approval can come from outside the derived required set',
        `ALTER TABLE ${PACKAGE_APPROVALS} DROP CONSTRAINT shared_world_history_package_approvals_required_fk`,
        /shared_world_history_package_approvals_required_fk/u],
      ['one human can approve one manifest twice',
        `ALTER TABLE ${PACKAGE_APPROVALS} DROP CONSTRAINT shared_world_history_package_approvals_one_per_approver_key`,
        /shared_world_history_package_approvals_one_per_approver_key/u],
      ['one manifest can commit two grants',
        `ALTER TABLE ${GRANTS} DROP CONSTRAINT shared_world_history_access_grants_manifest_key`,
        /shared_world_history_access_grants_manifest_key/u],
      ['the grant stops binding its exact World, grantee and episode',
        `ALTER TABLE ${GRANTS} DROP CONSTRAINT shared_world_history_access_grants_manifest_fk,
         ADD CONSTRAINT shared_world_history_access_grants_manifest_fk
           FOREIGN KEY (manifest_version_id) REFERENCES ${MANIFESTS} (id) ON DELETE RESTRICT`,
        /shared_world_history_access_grants_manifest_fk/u],
      ['a manifest item can belong to another World',
        `ALTER TABLE ${MANIFEST_ITEMS} DROP CONSTRAINT shared_world_history_package_manifest_items_item_fk`,
        /shared_world_history_package_manifest_items_item_fk/u],
      ['an item can carry an authority mode outside the frozen vocabulary',
        `ALTER TABLE ${ITEMS} DROP CONSTRAINT shared_world_history_items_authority_mode_check`,
        /shared_world_history_items_authority_mode_check/u],
      ['an item can carry an availability outside the canonical vocabulary',
        `ALTER TABLE ${ITEMS} DROP CONSTRAINT shared_world_history_items_availability_check`,
        /shared_world_history_items_availability_check/u],
      ['an owned column is dropped',
        `ALTER TABLE ${MANIFESTS} DROP COLUMN grantee_membership_episode_id CASCADE`,
        /still carries every column migration 0087 owns/u],
      ['an owned column becomes optional',
        `ALTER TABLE ${ITEMS} ALTER COLUMN occurred_at DROP NOT NULL`,
        /still carries every column migration 0087 owns/u],
      ['an owned column gains a default the primitives never write',
        `ALTER TABLE ${ITEMS} ALTER COLUMN availability_state SET DEFAULT 'AVAILABLE'`,
        /still carries every column migration 0087 owns/u],
      ['the frozen meaning of occurred_at is stripped from the catalog',
        `COMMENT ON COLUMN ${ITEMS}.occurred_at IS NULL`,
        /canonical Shared-World establishment\/commit instant/u],
      ['occurred_at is reinterpreted as an underlying source event time',
        `COMMENT ON COLUMN ${ITEMS}.occurred_at IS 'The underlying real-world event time this item refers to.'`,
        /canonical Shared-World establishment\/commit instant/u],
      ['owner deletion stops being terminal',
        `CREATE OR REPLACE FUNCTION public.shared_world_history_item_temporal_truth_v1()
         RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
         BEGIN RETURN NEW; END$fn$`,
        /owner deletion must stay terminal/u],
      ['a history relation becomes directly readable by an application role',
        `GRANT SELECT ON ${ITEMS} TO authenticated`,
        /authenticated must not hold SELECT/u],
      ['a mutation primitive becomes executable by an application role',
        `GRANT EXECUTE ON FUNCTION ${GRANT_FN} TO authenticated`,
        /must not hold EXECUTE/u],
      ['the visibility resolver becomes readable by authenticated',
        `GRANT EXECUTE ON FUNCTION ${RESOLVE_FN} TO authenticated`,
        /authenticated must not execute the visibility resolver/u],
      ['the visibility resolver stops requiring availability',
        `CREATE OR REPLACE FUNCTION public.resolve_shared_world_history_visibility_v1(p_world_id uuid, p_user_id uuid)
         RETURNS TABLE(world_id uuid, history_item_id uuid, occurred_at timestamptz)
         LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
         BEGIN RETURN; END$fn$`,
        /availability dominates every visibility mode/u],
      ['the grant commit starts deriving a granting actor',
        `CREATE OR REPLACE FUNCTION public.commit_shared_world_history_access_grant_v1(
           p_command_id uuid, p_manifest_version_id uuid, p_history_access_grant_id uuid,
           p_history_granted_event_id uuid)
         RETURNS TABLE(outcome text, history_command_id uuid, granted_world_id uuid,
                       granted_manifest_version_id uuid, committed_grant_id uuid,
                       committed_event_id uuid, history_granted_at timestamptz)
         LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
         DECLARE u uuid := auth.uid(); target public.shared_worlds;
         BEGIN
           SELECT * INTO target FROM public.shared_worlds w WHERE w.id = p_command_id FOR UPDATE;
           RETURN;
         END$fn$`,
        /derives no granting actor/u],
    ]) {
      stage = `forward safety: regression - ${reason}`;
      await q('SAVEPOINT forward_safety_regression');
      try {
        await q(plant);
        await assert.rejects(verifyCatalog(), refuses, `a database where ${reason} must still be refused`);
      } finally {
        // Always reverted, even when the plant itself or the assertion threw.
        await q('ROLLBACK TO SAVEPOINT forward_safety_regression');
        await q('RELEASE SAVEPOINT forward_safety_regression');
      }
    }
    stage = 'forward safety: every planted regression was reverted';
    await verifyCatalog();
  } finally {
    // ROLLBACK FIRST: if anything above raised, the transaction is aborted and a
    // RESET ROLE issued before the rollback would replace the real cause with 25P02.
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

/** The committed fixtures the multi-connection races need: three Worlds with prepared manifests. */
async function provisionRaceWorlds(c) {
  const worlds = {};
  for (const [key, grantee] of [['leaveFirst', c.raceGranteeA], ['grantFirst', c.raceGranteeB], ['twoCommits', c.raceGranteeC]]) {
    const born = await provisionBornWorld(c.anchor, grantee, `race-${key}`);
    const item = await seedItem(born.worldId, { hours: 0, viewers: [c.anchor] });
    const manifest = randomUUID();
    const [prepared] = await preparePackage(manifest, born.worldId, grantee, [item]);
    assert.equal(prepared.outcome, 'PREPARED');
    worlds[key] = { ...born, grantee, item, manifest };
  }
  return worlds;
}

async function main() {
  const f = {
    anchor: randomUUID(), newcomer: randomUUID(), outsider: randomUUID(), rejoiner: randomUUID(),
    firstAuthority: randomUUID(), secondAuthority: randomUUID(), grantee: randomUUID(),
    mover: randomUUID(), forwardGrantee: randomUUID(),
  };
  f.humans = Object.values(f);
  const c = {
    anchor: randomUUID(), raceGranteeA: randomUUID(), raceGranteeB: randomUUID(), raceGranteeC: randomUUID(),
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
      await verifyMembershipPeriodVisibility(f);
      await verifyRejoinVisibility(f);
      await verifyExactAuthority(f);
      await verifyAvailabilityAndStaleness(f);
      await verifyGranteeLifecycle(f);
      const before = {
        itemIds: (await rows(`SELECT id FROM ${ITEMS} ORDER BY id`)).map((row) => row.id),
        episodeIds: (await rows(`SELECT id FROM ${EPISODES} ORDER BY id`)).map((row) => row.id),
      };
      before.items = await rows(`SELECT id, occurred_at FROM ${ITEMS} WHERE id = ANY($1::uuid[]) ORDER BY id`, [before.itemIds]);
      before.episodes = await rows(`SELECT id, joined_at FROM ${EPISODES} WHERE id = ANY($1::uuid[]) ORDER BY id`, [before.episodeIds]);
      await verifyForwardSafety(f);
      await verifyTemporalTruthPreserved(before);
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
            + (SELECT count(*) FROM ${ITEMS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${MANIFESTS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${GRANTS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${GRANTED_EVENTS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${GRANT_COMMANDS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${EPISODES} WHERE user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($2::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
      [humans, bornWorlds]);
    assert.equal(Number(n), 0, 'no fixture row remains after completion');

    console.log('migration 0087 verified: selective historical access - membership is not historical access');
  } catch (error) {
    console.error(`migration 0087 verification FAILED at stage: ${stage}`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

await main();
