// Real-PostgreSQL verifier for migration 0086 - I-04E Governed Shared Settings v1
// (PART B).
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// behaviour rather than from the migration text:
//
//   * catalog: the four relations exist once and still carry every column they OWN
//     - name, type, nullability AND the absence of a default - unchanged and in
//     their original positions; the four frozen v1 settings fields are REAL
//     nullable text columns rather than a JSON blob; every owned unique binding and
//     foreign key is pinned by name, local columns, parent and restrictive
//     deletion; RLS is on with zero policies; and PUBLIC, anon, authenticated and
//     service_role hold no privilege at all;
//   * catalog: both primitives are postgres-owned, SECURITY DEFINER,
//     search_path-pinned and VOLATILE, neither derives any actor, and NEITHER is
//     executable by any application role, because the frozen Launch Gate
//     precondition is unimplemented;
//   * S1: a World with NO current settings row is a valid neutral state;
//   * S2: an exact immutable settings version plus a unanimous current-member
//     proposal commits one current pointer and one SETTING_CHANGED, on ONE
//     database-owned instant;
//   * S3: an old approval can never authorize a changed payload - a different
//     value is a NEW version under a NEW proposal with NEWLY collected approvals,
//     even when the new value equals one an older version already carried;
//   * S4: a settings change alters no membership, terminalizes no member
//     invitation, and moves no grant, ceiling row, consent event or history access
//     - proven by an exact count delta across every Shared relation;
//   * S5: later additive settings schema stays forward-safe;
//   * concurrency, with real independent connections: a settings commit racing a
//     membership topology change resolves serially in both orders with no
//     deadlock, and two settings changes under one unchanged topology stay two
//     separate exact proposals and versions;
//   * forward safety: later settings columns and tables, the I-04F closure
//     substrate and a Launch Gate are created for real inside a rolled-back
//     SAVEPOINT and this verifier still passes - then every regression to
//     something 0086 OWNS is planted and must still be refused;
//   * zero fixture residue after completion.
//
// There is deliberately NO live census of any kind here: this file runs against a
// fully migrated database, so a fixed list of table names required to stay absent,
// an exact count of live constraints or a catalog sweep for future names would be
// a ceiling on the whole roadmap rather than a fact about migration 0086. What
// 0086 itself did NOT create is proven from 0086's own text, by
// database/tests/shared-world-governed-settings-v1.test.mjs.
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
const MEMBER_INVITATIONS = 'public.shared_world_member_invitations';

const VERSIONS = 'public.shared_world_settings_versions';
const SETTINGS_STATE = 'public.shared_world_settings_state';
const CHANGED_EVENTS = 'public.shared_world_setting_changed_events';
const CHANGE_COMMANDS = 'public.shared_world_settings_change_commands';
const OWN_TABLES = [VERSIONS, SETTINGS_STATE, CHANGED_EVENTS, CHANGE_COMMANDS];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

const PREPARE_FN = 'public.prepare_shared_world_settings_change_governance_v1(uuid,uuid,uuid,uuid,text,text,text,text)';
const COMMIT_FN = 'public.commit_shared_world_settings_change_v1(uuid,uuid,uuid)';
const OWN_FUNCTIONS = [PREPARE_FN, COMMIT_FN];

const INSUFFICIENT_PRIVILEGE = ['42501'];
const INVALID_PARAMETER = ['22023'];
const UNAVAILABLE = ['P0002'];
const CONFLICT = ['23505'];
const STALE = ['40001'];
const INCOMPLETE = ['55000'];

const ROTATE_SQL = 'SELECT command_id, credential_epoch FROM public.rotate_shared_world_invite_credential_v1($1,$2,$3)';
const SUBMIT_SQL = 'SELECT outcome, command_id, requested_invitation_id FROM public.submit_shared_world_direct_invitation_v1($1,$2,$3)';
const BIRTH_SQL = 'SELECT outcome, born_world_id FROM public.commit_shared_world_direct_acceptance_birth_v1($1,$2,$3,$4,$5)';
const LEAVE_SQL = `SELECT outcome, closed_membership_episode_id FROM public.commit_shared_world_standard_voluntary_leave_v1($1,$2,$3)`;
const APPROVE_SQL = `SELECT outcome, committed_approval_id FROM public.commit_shared_world_governance_approval_v1($1,$2)`;
const RESOLVE_SQL = `SELECT outcome, satisfied_proposal_id FROM public.resolve_shared_world_governance_approval_v1($1,$2,$3)`;
const PREPARE_SQL = `SELECT outcome, prepared_proposal_id, prepared_snapshot_id, prepared_world_id,
                            prepared_operation_kind, prepared_settings_version_id, prepared_approval_rule,
                            prepared_required_approval_count, prepared_at
                       FROM public.prepare_shared_world_settings_change_governance_v1($1,$2,$3,$4,$5,$6,$7,$8)`;
const COMMIT_SQL = `SELECT outcome, settings_command_id, settings_world_id, settings_proposal_id,
                           applied_settings_version_id, settings_event_id, settings_changed_at
                      FROM public.commit_shared_world_settings_change_v1($1,$2,$3)`;

const prepareSettings = (p, worldId, values) => rows(PREPARE_SQL,
  [p.proposal, p.snapshot, p.version, worldId, values.name, values.description, values.topic, values.marker]);
const commitSettings = (commandId, proposalId, eventId) => rows(COMMIT_SQL, [commandId, proposalId, eventId]);
const approve = (approvalId, proposalId) => rows(APPROVE_SQL, [approvalId, proposalId]);
const resolve = (proposalId, operation, version) => rows(RESOLVE_SQL, [proposalId, operation, version]);
const leave = (commandId, worldId, eventId) => rows(LEAVE_SQL, [commandId, worldId, eventId]);

const ids = () => ({ proposal: randomUUID(), snapshot: randomUUID(), version: randomUUID() });
const opaqueRef = (label) => `ref:i04e-settings:${label}:${randomUUID()}`;
const NEUTRAL = { name: null, description: null, topic: null, marker: null };

const UUID = 'uuid';
const TEXT = 'text';
const TSTZ = 'timestamp with time zone';

const OWNED_COLUMNS = {
  [VERSIONS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['governance_proposal_id', UUID, 'NO', null],
    ['governance_operation_kind', TEXT, 'NO', null], ['name', TEXT, 'YES', null], ['description', TEXT, 'YES', null],
    ['topic', TEXT, 'YES', null], ['general_visual_marker', TEXT, 'YES', null], ['created_at', TSTZ, 'NO', null],
  ],
  [SETTINGS_STATE]: [
    ['world_id', UUID, 'NO', null], ['current_settings_version_id', UUID, 'NO', null], ['changed_at', TSTZ, 'NO', null],
  ],
  [CHANGED_EVENTS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['settings_version_id', UUID, 'NO', null],
    ['governance_proposal_id', UUID, 'NO', null], ['occurred_at', TSTZ, 'NO', null],
  ],
  [CHANGE_COMMANDS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['governance_proposal_id', UUID, 'NO', null],
    ['settings_version_id', UUID, 'NO', null], ['setting_changed_event_id', UUID, 'NO', null],
    ['committed_at', TSTZ, 'NO', null],
  ],
};

const OWNED_FOREIGN_KEYS = {
  shared_world_settings_versions_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_settings_versions_proposal_fk: 'FOREIGN KEY (governance_proposal_id, world_id, governance_operation_kind, id) REFERENCES shared_world_governance_proposals(id, world_id, operation_kind, proposed_payload_version_id) ON DELETE RESTRICT',
  shared_world_settings_state_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_settings_state_version_fk: 'FOREIGN KEY (world_id, current_settings_version_id) REFERENCES shared_world_settings_versions(world_id, id) ON DELETE RESTRICT',
  shared_world_setting_changed_events_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_setting_changed_events_version_fk: 'FOREIGN KEY (world_id, settings_version_id) REFERENCES shared_world_settings_versions(world_id, id) ON DELETE RESTRICT',
  shared_world_setting_changed_events_proposal_fk: 'FOREIGN KEY (governance_proposal_id) REFERENCES shared_world_governance_proposals(id) ON DELETE RESTRICT',
  shared_world_settings_change_commands_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_settings_change_commands_proposal_fk: 'FOREIGN KEY (governance_proposal_id) REFERENCES shared_world_governance_proposals(id) ON DELETE RESTRICT',
  shared_world_settings_change_commands_version_fk: 'FOREIGN KEY (world_id, settings_version_id) REFERENCES shared_world_settings_versions(world_id, id) ON DELETE RESTRICT',
  shared_world_settings_change_commands_event_fk: 'FOREIGN KEY (setting_changed_event_id) REFERENCES shared_world_setting_changed_events(id) ON DELETE RESTRICT',
};

const OWNED_BINDINGS = [
  [VERSIONS, 'shared_world_settings_versions_pk', /PRIMARY KEY \(id\)/u],
  [VERSIONS, 'shared_world_settings_versions_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [VERSIONS, 'shared_world_settings_versions_world_version_key', /UNIQUE \(world_id, id\)/u],
  [VERSIONS, 'shared_world_settings_versions_operation_check', /WORLD_SETTINGS_CHANGE/u],
  [SETTINGS_STATE, 'shared_world_settings_state_pk', /PRIMARY KEY \(world_id\)/u],
  [CHANGED_EVENTS, 'shared_world_setting_changed_events_version_key', /UNIQUE \(settings_version_id\)/u],
  [CHANGED_EVENTS, 'shared_world_setting_changed_events_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [CHANGE_COMMANDS, 'shared_world_settings_change_commands_proposal_key', /UNIQUE \(governance_proposal_id\)/u],
  [CHANGE_COMMANDS, 'shared_world_settings_change_commands_version_key', /UNIQUE \(settings_version_id\)/u],
  [CHANGE_COMMANDS, 'shared_world_settings_change_commands_event_key', /UNIQUE \(setting_changed_event_id\)/u],
];

/** The exact count of every Shared relation this verifier names, for the World under test. */
async function sharedCounts(humans, worldIds) {
  const [row] = await rows(
    `SELECT (SELECT count(*) FROM ${EPISODES} WHERE world_id = ANY($2::uuid[])) AS episodes,
            (SELECT count(*) FROM ${EPISODES} WHERE world_id = ANY($2::uuid[]) AND ended_at IS NULL) AS "openEpisodes",
            (SELECT count(*) FROM ${GRANTS} WHERE world_id = ANY($2::uuid[]) OR grantor_user_id = ANY($1::uuid[])) AS grants,
            (SELECT count(*) FROM ${CEILING} c JOIN ${GRANTS} g ON g.id = c.grant_id
              WHERE g.world_id = ANY($2::uuid[]) OR g.grantor_user_id = ANY($1::uuid[])) AS ceiling,
            (SELECT count(*) FROM ${CONSENT_EVENTS} WHERE world_id = ANY($2::uuid[])) AS "consentEvents",
            (SELECT count(*) FROM ${MEMBER_INVITATIONS} WHERE world_id = ANY($2::uuid[])) AS invitations,
            (SELECT count(*) FROM ${MEMBER_INVITATIONS} WHERE world_id = ANY($2::uuid[]) AND invitation_state = 'PENDING') AS "pendingInvitations",
            (SELECT count(*) FROM ${SNAPSHOTS} WHERE world_id = ANY($2::uuid[])) AS snapshots,
            (SELECT count(*) FROM ${SNAPSHOT_MEMBERS} m JOIN ${SNAPSHOTS} s ON s.id = m.membership_snapshot_id
              WHERE s.world_id = ANY($2::uuid[])) AS "snapshotMembers",
            (SELECT count(*) FROM ${PROPOSALS} WHERE world_id = ANY($2::uuid[])) AS proposals,
            (SELECT count(*) FROM ${APPROVALS} a JOIN ${PROPOSALS} pr ON pr.id = a.proposal_id
              WHERE pr.world_id = ANY($2::uuid[])) AS approvals,
            (SELECT count(*) FROM ${VERSIONS} WHERE world_id = ANY($2::uuid[])) AS versions,
            (SELECT count(*) FROM ${SETTINGS_STATE} WHERE world_id = ANY($2::uuid[])) AS pointer,
            (SELECT count(*) FROM ${CHANGED_EVENTS} WHERE world_id = ANY($2::uuid[])) AS "changedEvents",
            (SELECT count(*) FROM ${CHANGE_COMMANDS} WHERE world_id = ANY($2::uuid[])) AS "changeCommands",
            (SELECT count(*) FROM ${LEFT_EVENTS} WHERE world_id = ANY($2::uuid[])) AS "leftEvents"`,
    [humans, worldIds]);
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

const deltaOf = (before, after) => Object.fromEntries(
  Object.keys(after).map((key) => [key, after[key] - before[key]]).filter(([, value]) => value !== 0));

// ---------------------------------------------------------------------------

async function verifyCatalog() {
  stage = 'catalog: every relation 0086 owns exists exactly once';
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
      `${table} still carries every column migration 0086 owns, unchanged and in its original position`);
    for (const [name] of owned) {
      assert.equal(observed.filter((column) => column[0] === name).length, 1, `${table}.${name} appears exactly once`);
    }
  }
  // THE FROZEN v1 SETTINGS SURFACE: four REAL optional text columns, never a JSON
  // blob, a key/value store or a role record.
  for (const field of ['name', 'description', 'topic', 'general_visual_marker']) {
    const [column] = await rows(
      `SELECT data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'shared_world_settings_versions' AND column_name = $1`,
      [field]);
    assert.ok(column, `the ${field} setting exists as a real column`);
    assert.equal(column.data_type, 'text', `the ${field} setting is text`);
    assert.equal(column.is_nullable, 'YES', `the ${field} setting is optional`);
    assert.equal(column.column_default, null, `the ${field} setting carries no default`);
  }
  // There is deliberately NO migration-wide column NAME or TYPE filter over the live
  // column list here, for the same reason 0085 carries none and the I-04D FIX-01A
  // correction removed one from 0084: it would refuse every column a later REVIEWED
  // slice appends beside the four frozen v1 settings, which is that slice's business
  // rather than 0086's to forbid - and the forward-safety probe below appends exactly
  // such a column. That migration 0086 ITSELF created no blob, key/value store or
  // role column is a claim about 0086's own text, and it is proven there, by
  // database/tests/shared-world-governed-settings-v1.test.mjs over its CREATE TABLE
  // declarations.
  //
  // What stays live is stronger over what 0086 DOES own: the nine owned columns are
  // pinned above by name, type, nullability and the absence of a default, in order,
  // so a frozen v1 setting that was dropped, retyped, made mandatory or given a
  // default still fails.

  stage = 'catalog: the exact bindings and foreign keys 0086 owns';
  const constraintsOf = async (table) => rows(
    'SELECT conname name, contype type, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY conname',
    [table]);
  const live = new Map();
  for (const table of OWN_TABLES) live.set(table, await constraintsOf(table));
  const defOf = (table, name) => (live.get(table).find((c) => c.name === name) ?? { def: `MISSING CONSTRAINT ${name}` }).def;
  for (const [table, name, shape] of OWNED_BINDINGS) {
    assert.match(defOf(table, name), shape, `${name} is the exact binding migration 0086 owns`);
  }
  const normalize = (def) => def.replace(/REFERENCES (?:public\.)?/u, 'REFERENCES ');
  const liveForeignKeys = new Map();
  for (const table of OWN_TABLES) {
    for (const c of live.get(table).filter((entry) => entry.type === 'f')) liveForeignKeys.set(c.name, normalize(c.def));
  }
  for (const [name, def] of Object.entries(OWNED_FOREIGN_KEYS)) {
    assert.equal(liveForeignKeys.get(name), def,
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

  stage = 'catalog: both primitives are postgres-owned, SECURITY DEFINER, pinned, VOLATILE and app-unreachable';
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
    // SETTINGS AUTHORITY IS UNANIMITY, NEVER A ROLE, and never whoever transmits it.
    assert.doesNotMatch(fn.prosrc, /auth\.uid/u,
      `${fnName} records no settings actor: the authority is the exact unanimous approval set`);
    assert.doesNotMatch(fn.prosrc, /conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|consent|matching|introduction/iu,
      `${fnName} reads no Personal context and touches no grant or consent state`);
    assert.doesNotMatch(fn.prosrc, /DELETE FROM|TRUNCATE/iu, `${fnName} deletes no canonical history`);
    assert.doesNotMatch(fn.prosrc, /pg_advisory|LOCK TABLE/iu, `${fnName} takes only canonical row locks`);
    assert.doesNotMatch(fn.prosrc, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u,
      `${fnName} persists one database-owned instant`);
    assert.doesNotMatch(fn.prosrc, /INSERT INTO public\.shared_world_membership_episodes|UPDATE public\.shared_world_membership_episodes/u,
      `${fnName} opens and closes no membership episode`);
    assert.doesNotMatch(fn.prosrc, /public\.shared_world_member_invitations/u,
      `${fnName} terminalizes no member invitation: a settings change moves no topology`);
    assert.doesNotMatch(fn.prosrc, /UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds/u,
      `${fnName} creates, closes and mutates no Shared World`);
    assert.doesNotMatch(fn.prosrc, /HISTORY_ACCESS_GRANT|CLOSED_WORLD_VIEW_ENTITLEMENT|READ_ONLY_CLOSED|closed_at/u,
      `${fnName} writes no closure, history-access or entitlement literal`);
    assert.match(fn.prosrc, /FROM public\.shared_worlds w WHERE w\.id = /u, `${fnName} locks the exact World row`);
    assert.equal((fn.prosrc.match(/FOR UPDATE/gu) ?? []).length, 1,
      `${fnName} takes exactly one row lock of its own, and it is the World row`);
  }
  const [prepareSource] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [PREPARE_FN]);
  assert.match(prepareSource.prosrc, /public\.capture_shared_world_governance_proposal_v1\(/u,
    'the settings preparation captures its proposal through the frozen I-04D primitive');
  assert.match(prepareSource.prosrc, /captured\.snapshot_captured_at/u,
    'and persists the exact instant the frozen capture owned');
  assert.doesNotMatch(prepareSource.prosrc, /clock_timestamp\(\)/u, 'reading no clock of its own');
  assert.doesNotMatch(prepareSource.prosrc, /public\.shared_world_settings_state/u,
    'preparing a settings change moves no current settings pointer');
  const [commitSource] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [COMMIT_FN]);
  assert.match(commitSource.prosrc, /'WORLD_SETTINGS_CHANGE', settings_version\.id\)/u,
    'the settings commit revalidates the exact operation AND the exact version it is about to apply');
  assert.doesNotMatch(commitSource.prosrc, /UPDATE public\.shared_world_settings_versions/u,
    'a committed settings version is immutable: a changed value is a NEW version');
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
  stage = 'ACL: no application role may execute either settings primitive';
  for (const role of APPLICATION_ROLES) {
    await identity(role, randomUUID());
    await rejected(() => rows(PREPARE_SQL, [randomUUID(), randomUUID(), randomUUID(), randomUUID(), 'n', null, null, null]),
      INSUFFICIENT_PRIVILEGE);
    await rejected(() => rows(COMMIT_SQL, [randomUUID(), randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');
}

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
    const [approved] = await approve(randomUUID(), proposalId);
    assert.equal(approved.outcome, 'APPROVED');
  }
  await identity('postgres');
}

/** One whole governed settings change: prepare, unanimous approval, commit. */
async function changeSettings(worldId, approvers, values) {
  const p = ids();
  await identity('postgres');
  const [prepared] = await prepareSettings(p, worldId, values);
  assert.equal(prepared.outcome, 'PREPARED');
  await approveWith(p.proposal, approvers);
  const eventId = randomUUID();
  const [committed] = await commitSettings(randomUUID(), p.proposal, eventId);
  assert.equal(committed.outcome, 'SETTINGS_CHANGED');
  return { ...p, eventId, committed };
}

// ---------------------------------------------------------------------------

async function verifySettings(f) {
  stage = 'S1: a World with NO current settings row is a valid neutral state';
  const world = await provisionWorld(f.inviter, f.second, 'settings');
  const [{ n: neutral }] = await rows(`SELECT count(*)::int n FROM ${SETTINGS_STATE} WHERE world_id = $1`, [world.worldId]);
  assert.equal(neutral, 0, 'a newborn World carries no settings row at all, and that IS its neutral state');
  const before = await sharedCounts(f.humans, [world.worldId]);

  stage = 'S2: an exact immutable version plus unanimous approval commits one pointer and one SETTING_CHANGED';
  const p = ids();
  const values = { name: 'Evening study', description: null, topic: 'shared reading', marker: 'lantern' };
  const [prepared] = await prepareSettings(p, world.worldId, values);
  assert.deepEqual(Object.keys(prepared).sort(), [
    'outcome', 'prepared_approval_rule', 'prepared_at', 'prepared_operation_kind', 'prepared_required_approval_count',
    'prepared_proposal_id', 'prepared_settings_version_id', 'prepared_snapshot_id', 'prepared_world_id',
  ].sort(), 'the preparation returns exactly the bounded immutable result');
  assert.equal(prepared.prepared_operation_kind, 'WORLD_SETTINGS_CHANGE');
  assert.equal(prepared.prepared_approval_rule, 'ALL_CURRENT_MEMBERS');
  assert.equal(prepared.prepared_required_approval_count, 2, 'every current human must approve a World-level setting');
  const [{ n: stillNeutral }] = await rows(`SELECT count(*)::int n FROM ${SETTINGS_STATE} WHERE world_id = $1`, [world.worldId]);
  assert.equal(stillNeutral, 0, 'preparing a change moves no current pointer');
  // One preparation writes exactly ONE database-owned instant.
  const [{ same }] = await rows(
    `SELECT (v.created_at = pr.created_at AND pr.created_at = s.captured_at) AS same
       FROM ${VERSIONS} v JOIN ${PROPOSALS} pr ON pr.id = v.governance_proposal_id
       JOIN ${SNAPSHOTS} s ON s.id = pr.membership_snapshot_id WHERE v.id = $1`, [p.version]);
  assert.equal(same, true, 'the version, the proposal and the captured topology share ONE instant');

  await approveWith(p.proposal, [f.inviter]);
  await rejected(() => commitSettings(randomUUID(), p.proposal, randomUUID()), INCOMPLETE, /APPROVALS_INCOMPLETE/u);
  await approveWith(p.proposal, [f.second]);
  const eventId = randomUUID();
  const [committed] = await commitSettings(randomUUID(), p.proposal, eventId);
  assert.equal(committed.outcome, 'SETTINGS_CHANGED');
  assert.equal(committed.applied_settings_version_id, p.version);
  const [pointer] = await rows(`SELECT * FROM ${SETTINGS_STATE} WHERE world_id = $1`, [world.worldId]);
  assert.equal(pointer.current_settings_version_id, p.version, 'the current pointer is the exact committed version');
  const [version] = await rows(`SELECT * FROM ${VERSIONS} WHERE id = $1`, [p.version]);
  assert.equal(version.name, 'Evening study');
  assert.equal(version.description, null, 'every field is optional');
  assert.equal(version.topic, 'shared reading');
  assert.equal(version.general_visual_marker, 'lantern');
  const [{ oneInstant }] = await rows(
    `SELECT (st.changed_at = ev.occurred_at AND ev.occurred_at = cmd.committed_at) AS "oneInstant"
       FROM ${SETTINGS_STATE} st JOIN ${CHANGED_EVENTS} ev ON ev.world_id = st.world_id
       JOIN ${CHANGE_COMMANDS} cmd ON cmd.setting_changed_event_id = ev.id WHERE st.world_id = $1`, [world.worldId]);
  assert.equal(oneInstant, true, 'changed_at, occurred_at and committed_at are ONE database-owned instant');

  stage = 'S4: a settings change alters no membership, invitation, grant, consent or history-access state';
  const after = await sharedCounts(f.humans, [world.worldId]);
  assert.deepEqual(deltaOf(before, after), {
    snapshots: 1, snapshotMembers: 2, proposals: 1, approvals: 2, versions: 1, pointer: 1,
    changedEvents: 1, changeCommands: 1,
  }, 'a whole governed settings change creates exactly its own rows and moves nothing else');

  stage = 'S3: an old approval can never authorize a changed payload or a second version';
  // The exact same proposal cannot be committed twice, under any command id.
  await rejected(() => commitSettings(randomUUID(), p.proposal, randomUUID()), CONFLICT, /SHARED_WORLD_SETTINGS_ID_CONFLICT/u);
  // A new value under the SAME proposal is refused - and the refusal comes from the
  // FROZEN I-04D capture rather than from this slice, which is the correct boundary:
  // a committed proposal identity is never re-bound to a different payload version,
  // and that is I-04D's rule to enforce. 0086 never gets the chance to have an
  // opinion, and asserting its own class here would have been asserting the wrong
  // layer owns the invariant.
  await rejected(() => prepareSettings({ ...p, version: randomUUID() }, world.worldId, { ...values, name: 'Other' }),
    CONFLICT, /SHARED_WORLD_GOVERNANCE_ID_CONFLICT/u);
  // A DIFFERENT value for the same version id is not an equivalent retry.
  await rejected(() => prepareSettings(p, world.worldId, { ...values, name: 'Different' }),
    CONFLICT, /SHARED_WORLD_SETTINGS_ID_CONFLICT/u);
  // An equivalent retry, with every value identical including the NULL, is.
  assert.deepEqual(await prepareSettings(p, world.worldId, values), [prepared],
    'an equivalent preparation retry returns the preparation this command committed');
  // And the frozen resolver refuses to prove version A for version B.
  await rejected(() => resolve(p.proposal, 'WORLD_SETTINGS_CHANGE', randomUUID()), STALE, /SHARED_WORLD_GOVERNANCE_STALE/u);
  await rejected(() => resolve(p.proposal, 'ADD_MEMBER', p.version), STALE, /SHARED_WORLD_GOVERNANCE_STALE/u);

  stage = 'S3: changing a value BACK to one an older version carried still needs a new version and new approvals';
  const back = await changeSettings(world.worldId, [f.inviter, f.second], { ...values, name: 'Morning study' });
  const restored = await changeSettings(world.worldId, [f.inviter, f.second], values);
  assert.notEqual(restored.version, p.version, 'the restored value is a NEW immutable version, never the old one reused');
  const [currentPointer] = await rows(`SELECT * FROM ${SETTINGS_STATE} WHERE world_id = $1`, [world.worldId]);
  assert.equal(currentPointer.current_settings_version_id, restored.version, 'the pointer moved to the newest version');
  const [{ n: keptVersions }] = await rows(`SELECT count(*)::int n FROM ${VERSIONS} WHERE world_id = $1`, [world.worldId]);
  assert.equal(keptVersions, 3, 'every historical version remains exactly as it was');
  assert.deepEqual(await rows(`SELECT * FROM ${VERSIONS} WHERE id = $1`, [p.version]), [version],
    'the first version was never rewritten when the pointer moved away from it and back');
  void back;

  stage = 'bounded refusals and command invalidity';
  await rejected(() => prepareSettings(ids(), randomUUID(), NEUTRAL), UNAVAILABLE, /SHARED_WORLD_SETTINGS_NOT_AVAILABLE/u);
  await rejected(() => commitSettings(randomUUID(), randomUUID(), randomUUID()), UNAVAILABLE, /SHARED_WORLD_SETTINGS_NOT_AVAILABLE/u);
  await rejected(() => rows(PREPARE_SQL, [null, randomUUID(), randomUUID(), randomUUID(), null, null, null, null]), INVALID_PARAMETER);
  await rejected(() => rows(COMMIT_SQL, [randomUUID(), null, randomUUID()]), INVALID_PARAMETER);
  // A fully neutral proposal is legal: all four fields are optional.
  const neutralChange = await changeSettings(world.worldId, [f.inviter, f.second], NEUTRAL);
  const [neutralVersion] = await rows(`SELECT * FROM ${VERSIONS} WHERE id = $1`, [neutralChange.version]);
  assert.deepEqual(
    [neutralVersion.name, neutralVersion.description, neutralVersion.topic, neutralVersion.general_visual_marker],
    [null, null, null, null], 'a settings version may legally carry no value at all');

  stage = 'a settings proposal goes stale when membership topology moves under it';
  const staleWorld = await provisionWorld(f.inviter, f.staleSecond, 'settings-stale');
  const stale = ids();
  await prepareSettings(stale, staleWorld.worldId, { ...NEUTRAL, name: 'Never applied' });
  await approveWith(stale.proposal, [f.inviter, f.staleSecond]);
  await identity('postgres', f.staleSecond);
  await leave(randomUUID(), staleWorld.worldId, randomUUID());
  await identity('postgres');
  await rejected(() => commitSettings(randomUUID(), stale.proposal, randomUUID()), STALE, /SHARED_WORLD_GOVERNANCE_STALE/u);
  const [{ n: noPointer }] = await rows(`SELECT count(*)::int n FROM ${SETTINGS_STATE} WHERE world_id = $1`, [staleWorld.worldId]);
  assert.equal(noPointer, 0, 'a stale settings proposal changes nothing and leaves the World neutral');
  return { world, versionId: p.version };
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

    stage = 'concurrency 10a: a membership topology change winning first makes the settings proposal stale';
    const w1 = c.worlds.topologyFirst;
    await asOwnerFor(a, w1.third);
    const leaveRun = a.query(LEAVE_SQL, [randomUUID(), w1.worldId, randomUUID()]);
    assert.equal(await blocks(leaveRun), 'COMPLETED');
    await asOwnerFor(b, c.inviter);
    const queuedCommit = b.query(COMMIT_SQL, [randomUUID(), w1.proposal, randomUUID()]);
    assert.equal(await blocks(queuedCommit), 'BLOCKED', 'the settings commit queues on the exact World row the leave holds');
    await a.query('COMMIT');
    const staleError = await failureOf(queuedCommit);
    assert.equal(staleError?.code, '40001', 'and then finds its captured topology stale, rather than deadlocking');
    await b.query('ROLLBACK');
    const [{ n: noPointer }] = await rows(`SELECT count(*)::int n FROM ${SETTINGS_STATE} WHERE world_id = $1`, [w1.worldId]);
    assert.equal(noPointer, 0, 'the losing settings commit changed nothing');

    stage = 'concurrency 10b: a settings commit winning first changes no topology, and the later leave still succeeds';
    const w2 = c.worlds.settingsFirst;
    await asOwnerFor(a, c.inviter);
    const commitRun = a.query(COMMIT_SQL, [randomUUID(), w2.proposal, randomUUID()]);
    assert.equal(await blocks(commitRun), 'COMPLETED');
    assert.equal((await commitRun).rows[0].outcome, 'SETTINGS_CHANGED');
    await asOwnerFor(b, w2.third);
    const queuedLeave = b.query(LEAVE_SQL, [randomUUID(), w2.worldId, randomUUID()]);
    assert.equal(await blocks(queuedLeave), 'BLOCKED', 'the leave queues on the World row the settings commit holds');
    await a.query('COMMIT');
    assert.equal((await queuedLeave).rows[0].outcome, 'LEFT', 'and then proceeds: a settings change blocks no membership mutation');
    await b.query('COMMIT');
    const [{ n: openAfter }] = await rows(
      `SELECT count(*)::int n FROM ${EPISODES} WHERE world_id = $1 AND ended_at IS NULL`, [w2.worldId]);
    assert.equal(openAfter, 2, 'the settings commit itself changed no membership topology');

    stage = 'concurrency 11: two settings changes under one unchanged topology stay two exact proposals and versions';
    const w3 = c.worlds.twoSettings;
    await asOwnerFor(a, c.inviter); await asOwnerFor(b, c.inviter);
    const firstChange = a.query(COMMIT_SQL, [randomUUID(), w3.firstProposal, randomUUID()]);
    assert.equal(await blocks(firstChange), 'COMPLETED');
    const secondChange = b.query(COMMIT_SQL, [randomUUID(), w3.secondProposal, randomUUID()]);
    assert.equal(await blocks(secondChange), 'BLOCKED', 'the second change queues on the same World row');
    await a.query('COMMIT');
    assert.equal((await secondChange).rows[0].outcome, 'SETTINGS_CHANGED',
      'and then commits on its OWN exact proposal and version: no approval was reused');
    await b.query('COMMIT');
    const [pointer] = await rows(`SELECT current_settings_version_id FROM ${SETTINGS_STATE} WHERE world_id = $1`, [w3.worldId]);
    assert.equal(pointer.current_settings_version_id, w3.secondVersion, 'the pointer holds exactly the later committed version');
    const [{ n: versions }] = await rows(`SELECT count(*)::int n FROM ${VERSIONS} WHERE world_id = $1`, [w3.worldId]);
    assert.equal(versions, 2, 'both immutable versions remain, and the earlier one was never rewritten');
    const [{ n: events }] = await rows(`SELECT count(*)::int n FROM ${CHANGED_EVENTS} WHERE world_id = $1`, [w3.worldId]);
    assert.equal(events, 2, 'every committed change appended exactly one SETTING_CHANGED');

    stage = 'concurrency: the canonical World-first order produced no deadlock';
    const [{ n: deadlocksAfter }] = await rows(
      'SELECT COALESCE(sum(deadlocks), 0)::int n FROM pg_stat_database WHERE datname = current_database()');
    assert.equal(deadlocksAfter, deadlocksBefore, 'no deadlock occurred: both primitives take the World row first');
  } finally {
    for (const conn of connections) {
      await conn.query('ROLLBACK').catch(() => undefined);
      await conn.end().catch(() => undefined);
    }
  }
}

// ---------------------------------------------------------------------------

async function verifyForwardSafety(f) {
  stage = 'forward safety: later settings schema, the I-04F closure substrate and a Launch Gate do not fail this verifier';
  await identity('postgres');
  const probe = `i04e_set_probe_${randomUUID().replace(/-/gu, '').slice(0, 12)}`;
  await q('SAVEPOINT forward_safety');
  try {
    // S5: later reviewed settings, added ADDITIVELY without superseding 0086.
    await q(`ALTER TABLE ${VERSIONS} ADD COLUMN ${probe}_language_preference text`);
    await q(`ALTER TABLE ${VERSIONS} ADD COLUMN ${probe}_consumer_metadata jsonb`);
    await q(`CREATE TABLE public.${probe}_settings_media (id uuid PRIMARY KEY, settings_version_id uuid)`);
    await q(`ALTER TABLE public.${probe}_settings_media ADD CONSTRAINT ${probe}_media_version_fk
             FOREIGN KEY (settings_version_id) REFERENCES ${VERSIONS} (id) ON DELETE SET NULL`);
    await q(`CREATE INDEX ${probe}_versions_created_idx ON ${VERSIONS} (world_id, created_at)`);
    // I-04F closure and history access, and CW2-08's Launch Gate with a wrapper.
    await q(`CREATE TABLE public.${probe}_history_access_grants (id uuid PRIMARY KEY, world_id uuid NOT NULL)`);
    await q(`CREATE TABLE public.${probe}_launch_gates (id uuid PRIMARY KEY, capability text NOT NULL)`);
    await q(`CREATE FUNCTION public.${probe}_change_settings_v1(p_command_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    await q(`GRANT EXECUTE ON FUNCTION public.${probe}_change_settings_v1(uuid) TO authenticated`);
    // A later reviewed audit trigger on a table 0086 owns.
    await q(`CREATE FUNCTION public.${probe}_audit_fn() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN RETURN NULL; END$fn$`);
    await q(`CREATE TRIGGER ${probe}_versions_audit AFTER INSERT ON ${VERSIONS}
             FOR EACH ROW EXECUTE FUNCTION public.${probe}_audit_fn()`);
    await verifyCatalog();

    stage = 'forward safety: a whole governed settings change still works beside the authorized future';
    const world = await provisionWorld(f.inviter, f.forwardSecond, 'settings-forward');
    const change = await changeSettings(world.worldId, [f.inviter, f.forwardSecond], { ...NEUTRAL, topic: 'still governed' });
    const [pointer] = await rows(`SELECT current_settings_version_id FROM ${SETTINGS_STATE} WHERE world_id = $1`, [world.worldId]);
    assert.equal(pointer.current_settings_version_id, change.version,
      'the settings surface still commits beside later columns, tables, indexes and triggers');

    stage = 'forward safety: a real regression to something 0086 OWNS is still refused';
    for (const [reason, plant, refuses] of [
      ['a settings version stops binding its exact proposal, World and operation',
        `ALTER TABLE ${VERSIONS} DROP CONSTRAINT shared_world_settings_versions_proposal_fk,
         ADD CONSTRAINT shared_world_settings_versions_proposal_fk
           FOREIGN KEY (governance_proposal_id) REFERENCES ${PROPOSALS} (id) ON DELETE RESTRICT`,
        /shared_world_settings_versions_proposal_fk/u],
      ['the current pointer stops binding its World and version together',
        `ALTER TABLE ${SETTINGS_STATE} DROP CONSTRAINT shared_world_settings_state_version_fk`,
        /shared_world_settings_state_version_fk/u],
      ['one proposal could commit two settings versions',
        `ALTER TABLE ${VERSIONS} DROP CONSTRAINT shared_world_settings_versions_proposal_key`,
        /shared_world_settings_versions_proposal_key/u],
      ['a World could hold two current settings rows',
        `ALTER TABLE ${SETTINGS_STATE} DROP CONSTRAINT shared_world_settings_state_pk CASCADE`,
        /shared_world_settings_state_pk/u],
      ['a frozen v1 setting is dropped',
        `ALTER TABLE ${VERSIONS} DROP COLUMN topic CASCADE`,
        /still carries every column migration 0086 owns/u],
      ['a frozen v1 setting stops being optional',
        `UPDATE ${VERSIONS} SET name = 'x' WHERE name IS NULL;
         ALTER TABLE ${VERSIONS} ALTER COLUMN name SET NOT NULL`,
        /still carries every column migration 0086 owns/u],
      ['a frozen v1 setting gains a default the primitives never write',
        `ALTER TABLE ${VERSIONS} ALTER COLUMN topic SET DEFAULT 'general'`,
        /still carries every column migration 0086 owns/u],
      // A later reviewed jsonb or role column APPENDED beside the frozen v1 surface is
      // deliberately NOT a regression here: 0086 owns the nine columns it created, not
      // the vocabulary of every column that follows, and the authorized future above
      // appends exactly such a column. That 0086 itself created none is proven from
      // 0086's own text by its static contract. What IS a regression is any damage to
      // the frozen surface itself, which the four plants above and below cover.
      ['a settings table becomes directly readable by an application role',
        `GRANT SELECT ON ${VERSIONS} TO authenticated`,
        /authenticated must not hold SELECT/u],
      ['a settings primitive becomes executable by an application role',
        `GRANT EXECUTE ON FUNCTION ${COMMIT_FN} TO authenticated`,
        /must not hold EXECUTE/u],
      ['the settings commit stops naming the exact version it applies',
        `CREATE OR REPLACE FUNCTION public.commit_shared_world_settings_change_v1(
           p_command_id uuid, p_proposal_id uuid, p_setting_changed_event_id uuid)
         RETURNS TABLE(outcome text, settings_command_id uuid, settings_world_id uuid,
                       settings_proposal_id uuid, applied_settings_version_id uuid,
                       settings_event_id uuid, settings_changed_at timestamptz)
         LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
         DECLARE world public.shared_worlds;
         BEGIN
           SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_proposal_id FOR UPDATE;
           RETURN;
         END$fn$`,
        /revalidates the exact operation AND the exact version/u],
      ['a settings primitive starts deriving an actor',
        `CREATE OR REPLACE FUNCTION public.prepare_shared_world_settings_change_governance_v1(
           p_proposal_id uuid, p_membership_snapshot_id uuid, p_settings_version_id uuid, p_world_id uuid,
           p_name text, p_description text, p_topic text, p_general_visual_marker text)
         RETURNS TABLE(outcome text, prepared_proposal_id uuid, prepared_snapshot_id uuid,
                       prepared_world_id uuid, prepared_operation_kind text, prepared_settings_version_id uuid,
                       prepared_approval_rule text, prepared_required_approval_count integer,
                       prepared_at timestamptz)
         LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
         DECLARE u uuid := auth.uid(); world public.shared_worlds;
         BEGIN
           SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
           RETURN;
         END$fn$`,
        /records no settings actor/u],
    ]) {
      await q('SAVEPOINT forward_safety_regression');
      await q(plant);
      await assert.rejects(verifyCatalog(), refuses, `a database where ${reason} must still be refused`);
      await q('ROLLBACK TO SAVEPOINT forward_safety_regression');
      await q('RELEASE SAVEPOINT forward_safety_regression');
    }
    stage = 'forward safety: every planted regression was reverted';
    await verifyCatalog();
  } finally {
    await identity('postgres');
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
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
  await q(`DELETE FROM ${CHANGE_COMMANDS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${CHANGED_EVENTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${SETTINGS_STATE} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${VERSIONS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
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

/** The committed fixtures the multi-connection races need: three Worlds with approved proposals. */
async function provisionRaceWorlds(c) {
  const worlds = {};

  // A three-human World whose settings proposal a leave will make stale.
  //
  // The third open episode is written directly as the database owner rather than
  // through the I-04E governed add. That is deliberate and stated rather than
  // hidden: the shape is identical to what a governed add produces (CW2-03 section
  // 18), it is reachable by no application role, it uses the canonical clock, and
  // this file's subject is the SETTINGS surface - migration 0085's own verifier is
  // where the add-member journey is proven end to end. The 0085 topology triggers
  // still fire on it, which is part of what concurrency 10 relies on.
  const topologyFirst = await provisionWorld(c.inviter, c.raceSecond, 'race-topology');
  await q(`INSERT INTO ${EPISODES}(id, world_id, user_id, joined_at) VALUES($1,$2,$3,clock_timestamp())`,
    [randomUUID(), topologyFirst.worldId, c.raceThird]);
  const first = ids();
  await prepareSettings(first, topologyFirst.worldId, { ...NEUTRAL, name: 'Never applied' });
  await approveWith(first.proposal, [c.inviter, c.raceSecond, c.raceThird]);
  worlds.topologyFirst = { ...topologyFirst, third: c.raceThird, proposal: first.proposal };

  const settingsFirst = await provisionWorld(c.inviter, c.raceSecondB, 'race-settings');
  await q(`INSERT INTO ${EPISODES}(id, world_id, user_id, joined_at) VALUES($1,$2,$3,clock_timestamp())`,
    [randomUUID(), settingsFirst.worldId, c.raceThirdB]);
  const second = ids();
  await prepareSettings(second, settingsFirst.worldId, { ...NEUTRAL, name: 'Applied first' });
  await approveWith(second.proposal, [c.inviter, c.raceSecondB, c.raceThirdB]);
  worlds.settingsFirst = { ...settingsFirst, third: c.raceThirdB, proposal: second.proposal };

  const twoSettings = await provisionWorld(c.inviter, c.raceSecondC, 'race-two-settings');
  const changeA = ids();
  await prepareSettings(changeA, twoSettings.worldId, { ...NEUTRAL, topic: 'first' });
  await approveWith(changeA.proposal, [c.inviter, c.raceSecondC]);
  const changeB = ids();
  await prepareSettings(changeB, twoSettings.worldId, { ...NEUTRAL, topic: 'second' });
  await approveWith(changeB.proposal, [c.inviter, c.raceSecondC]);
  worlds.twoSettings = {
    ...twoSettings, firstProposal: changeA.proposal, secondProposal: changeB.proposal, secondVersion: changeB.version,
  };
  return worlds;
}

async function main() {
  const f = {
    inviter: randomUUID(), second: randomUUID(), staleSecond: randomUUID(),
    forwardSecond: randomUUID(),
  };
  f.humans = Object.values(f);
  const c = {
    inviter: randomUUID(), raceSecond: randomUUID(), raceThird: randomUUID(),
    raceSecondB: randomUUID(), raceThirdB: randomUUID(), raceSecondC: randomUUID(),
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
      await verifySettings(f);
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
            + (SELECT count(*) FROM ${VERSIONS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${SETTINGS_STATE} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${CHANGED_EVENTS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${CHANGE_COMMANDS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${EPISODES} WHERE user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($2::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
      [humans, bornWorlds]);
    assert.equal(Number(n), 0, 'no fixture row remains after completion');

    console.log('migration 0086 verified: governed Shared settings - immutable versions and one current pointer');
  } catch (error) {
    console.error(`migration 0086 verification FAILED at stage: ${stage}`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

await main();
