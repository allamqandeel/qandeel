// Real-PostgreSQL verifier for migration 0083 - Standard Voluntary Leave +
// Membership Episode Closure v1 (I-04C).
//
// Runs against a fully migrated database and proves, from live catalogs and live
// behaviour rather than from the migration text:
//
//   * schema: the canonical membership episode gained exactly one ADDITIVE
//     nullable end_reason and lost nothing - every column, type, nullability,
//     default, check and foreign key migration 0075 owns is still present and
//     unchanged, and the one-open-episode partial unique index still stands;
//     shared_world_member_left_events and shared_world_voluntary_leave_commands
//     exist exactly once, owned by postgres, with the exact columns, the exact
//     unique bindings (one voluntary leave per EPISODE and per EVENT, never a
//     permanent per-(world, user) key that would forbid a future rejoin),
//     restrictive foreign keys, RLS on, zero policies, no trigger and no owner /
//     admin / survivor / payload column;
//   * THE PRE-LAUNCH SECURITY BOUNDARY: the leave core is owned by postgres,
//     SECURITY DEFINER, search_path-pinned and VOLATILE, and is executable by NO
//     application role - PUBLIC, anon, authenticated and service_role are all
//     denied in the catalog AND by an actual 42501 - because the frozen launch
//     gate precondition is not implemented yet;
//   * exact-human authority: the function accepts no actor / target / episode /
//     instant / reason parameter, derives the leaving human from auth.uid(), and
//     resolves that human's OWN open episode from canonical current state;
//   * the atomic leave: exactly one episode closed in place with end_reason
//     VOLUNTARY_LEAVE, exactly one MEMBER_LEFT event, exactly one durable
//     command - with ended_at, occurred_at and committed_at proven equal in SQL
//     at full precision rather than through a millisecond JavaScript Date - and
//     the World left exactly ACTIVE / STANDARD with no closure moment;
//   * ACTIVE / STANDARD only: ACTIVE / INTRODUCTION, READ_ONLY_CLOSED / STANDARD
//     and READ_ONLY_CLOSED / INTRODUCTION are all refused, through the same one
//     bounded class that answers a non-member, an already-departed human and a
//     World that does not exist, so nothing here is a membership oracle;
//   * the audience transition, through the FROZEN 0079 resolver unchanged: two
//     humans, then only the survivor, then a successful EMPTY - which is the
//     canonical zero-active-human inert state, with the World still ACTIVE /
//     STANDARD, not closed, not deleted and not converted;
//   * STANDING CONTEXT GRANTS SURVIVE: leaving does not revoke the departed
//     grantor's ACTIVE grant, does not touch one ceiling row, appends no consent
//     event and installs no membership-to-grant trigger; explicit revoke still
//     works after leaving, and a NEW grant after leaving still fails under
//     I-03C's own unchanged current-membership rule;
//   * idempotency: an equivalent retry returns the committed historical result
//     and creates no second event or command, including after a later successor
//     episode exists for the same human in the same World; a reused command id
//     with any different identity is 23505;
//   * concurrency, with committed fixtures and extra connections: two identical
//     leaves produce one mutation and the same result to both; two different
//     commands racing one episode produce exactly one winner; both members of a
//     two-person World may leave in sequence, yielding one active human and then
//     zero; a grant racing a leave resolves to exactly the two canonical
//     outcomes in both orders; no deadlock and no orphan row;
//   * zero fixture residue after completion.
//
// Nothing here weakens an ACL. Application roles are used only to prove denial
// and to drive the frozen I-03C / I-04A commands that build the fixtures; the
// internal cores are invoked as the database owner with the exact human's JWT
// claim set, which is precisely how a later launch-gated wrapper must preserve
// auth.uid().
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
const OWN_TABLES = [LEFT_EVENTS, LEAVE_COMMANDS];
const SEALED_TABLES = [WORLDS, EPISODES, CREDENTIAL, INVITATIONS, INVITE_COMMANDS, BIRTH_EVENTS, ACCEPTANCE_COMMANDS, GRANTS, CEILING];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
const LEAVE_FN = 'public.commit_shared_world_standard_voluntary_leave_v1(uuid,uuid,uuid)';

const INSUFFICIENT_PRIVILEGE = ['42501'];
const INVALID_PARAMETER = ['22023'];
const UNAVAILABLE = ['P0002'];
const CONFLICT = ['23505'];

const LEAVE_SQL = `SELECT outcome, command_id, left_world_id, closed_membership_episode_id, left_event_id, episode_end_reason, left_at
                     FROM public.commit_shared_world_standard_voluntary_leave_v1($1,$2,$3)`;
const BIRTH_SQL = `SELECT outcome, born_world_id FROM public.commit_shared_world_direct_acceptance_birth_v1($1,$2,$3,$4,$5)`;
const ROTATE_SQL = 'SELECT command_id, credential_epoch FROM public.rotate_shared_world_invite_credential_v1($1,$2,$3)';
const SUBMIT_SQL = 'SELECT outcome, command_id, requested_invitation_id FROM public.submit_shared_world_direct_invitation_v1($1,$2,$3)';
const GRANT_SQL = 'SELECT consent_event_id, event_type, grant_id, prior_grant_id, grant_status FROM public.grant_shared_world_standing_context_v1($1,$2,$3,$4::uuid[],$5)';
const REVOKE_SQL = 'SELECT consent_event_id, event_type, grant_id, prior_grant_id, grant_status FROM public.revoke_shared_world_standing_context_v1($1,$2,$3)';
const AUDIENCE_SQL = 'SELECT world_id, membership_episode_id, user_id FROM public.resolve_shared_world_human_audience_snapshot_v1($1)';

const leave = (commandId, worldId, eventId) => rows(LEAVE_SQL, [commandId, worldId, eventId]);
/** A synthetic opaque reference. The human-facing credential format is not frozen, so this invents none. */
const opaqueRef = (label) => `ref:i04c:${label}:${randomUUID()}`;

/** Exactly the columns migration 0075 owns on the canonical episode, plus the one I-04C adds. */
const EPISODE_COLUMNS_0075 = [
  ['id', 'uuid', 'NO', null],
  ['world_id', 'uuid', 'NO', null],
  ['user_id', 'uuid', 'NO', null],
  ['joined_at', 'timestamp with time zone', 'NO', null],
  ['ended_at', 'timestamp with time zone', 'YES', null],
];
const EPISODE_COLUMN_ADDED = ['end_reason', 'text', 'YES', null];
/** Exactly the constraints migration 0075 owns on the canonical episode. */
const EPISODE_CONSTRAINTS_0075 = [
  'shared_world_membership_episodes_interval_check',
  'shared_world_membership_episodes_pkey',
  'shared_world_membership_episodes_user_fk',
  'shared_world_membership_episodes_world_fk',
];

const LEFT_EVENT_COLUMNS = [
  ['id', 'uuid', 'NO'],
  ['world_id', 'uuid', 'NO'],
  ['membership_episode_id', 'uuid', 'NO'],
  ['actor_user_id', 'uuid', 'NO'],
  ['occurred_at', 'timestamp with time zone', 'NO'],
];
const LEAVE_COMMAND_COLUMNS = [
  ['id', 'uuid', 'NO'],
  ['actor_user_id', 'uuid', 'NO'],
  ['world_id', 'uuid', 'NO'],
  ['membership_episode_id', 'uuid', 'NO'],
  ['member_left_event_id', 'uuid', 'NO'],
  ['committed_at', 'timestamp with time zone', 'NO'],
];

/**
 * Every foreign key migration 0083 OWNS, by exact name, exact local columns,
 * exact parent and restrictive deletion - not a count. A count is a live-schema
 * ceiling: a later authorized slice may add its own foreign key to one of these
 * tables (a governance proposal reference, for one), and that is not a 0083
 * regression. `REFERENCES public.` is normalized away because pg_get_constraintdef
 * renders against the session search_path.
 */
const OWNED_FOREIGN_KEYS = {
  shared_world_member_left_events_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_member_left_events_episode_fk: 'FOREIGN KEY (membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_member_left_events_actor_fk: 'FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_voluntary_leave_commands_actor_fk: 'FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_voluntary_leave_commands_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_voluntary_leave_commands_episode_fk: 'FOREIGN KEY (membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT',
  shared_world_voluntary_leave_commands_event_fk: 'FOREIGN KEY (member_left_event_id) REFERENCES shared_world_member_left_events(id) ON DELETE RESTRICT',
};

async function snapshot(humans) {
  const [{ role }] = await rows('SELECT current_user AS role');
  await q('RESET ROLE');
  const [counts] = await rows(
    `SELECT (SELECT count(*)::int FROM ${WORLDS}) worlds,
            (SELECT count(*)::int FROM ${EPISODES}) episodes,
            (SELECT count(*)::int FROM ${LEFT_EVENTS}) departures,
            (SELECT count(*)::int FROM ${LEAVE_COMMANDS}) leaves,
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

const consentOf = (counts) => ({ grants: counts.grants, ceiling: counts.ceiling, consent: counts.consent });
const personalOf = (counts) => ({ sessions: counts.sessions, turns: counts.turns, memories: counts.memories, hypotheses: counts.hypotheses });

// ---------------------------------------------------------------------------

async function verifyCatalog() {
  stage = 'catalog: migration 0083 created exactly its own two tables, once';
  for (const table of OWN_TABLES) {
    const name = table.replace('public.', '');
    const [{ n }] = await rows(
      "SELECT count(*)::int n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace WHERE ns.nspname='public' AND c.relname=$1 AND c.relkind='r'",
      [name]);
    assert.equal(n, 1, `${table} exists exactly once as an ordinary table`);
    const [{ owner }] = await rows('SELECT pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.oid = $1::regclass', [table]);
    assert.equal(owner, 'postgres', `${table} is owned by postgres`);
  }
  // That migration 0083 introduced NO governance, removal, rejoin, closure,
  // entitlement or launch substrate is a claim about 0083's own text, and it is
  // proven there, by
  // database/tests/shared-world-standard-voluntary-leave-v1.test.mjs. It is
  // deliberately NOT asserted from the live catalog: this verifier runs against
  // a FULLY migrated database, so a live absence census would reject exactly the
  // later authorized objects the roadmap requires - a governance proposal table,
  // a Launch Gate snapshot table, removal / rejoin / closure / history-grant
  // substrate - the moment any of them legitimately landed.

  stage = 'catalog: the canonical episode gained an ADDITIVE nullable end_reason';
  const episodeColumns = await rows(
    `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='shared_world_membership_episodes' ORDER BY ordinal_position`);
  const observed = episodeColumns.map((c) => [c.column_name, c.data_type, c.is_nullable, c.column_default]);
  // Asserted as a PREFIX plus one named addition, never as a census of the live
  // column list: this verifier must not become the very ceiling I-04C repaired in
  // its four predecessors. A drop, a type / nullability / default change or a
  // reorder still fails; a later reviewed slice may append its own column.
  assert.deepEqual(observed.slice(0, EPISODE_COLUMNS_0075.length), EPISODE_COLUMNS_0075,
    'every column migration 0075 owns is unchanged and still in its original position');
  assert.deepEqual(observed.filter((column) => column[0] === 'end_reason'), [EPISODE_COLUMN_ADDED],
    'end_reason exists exactly once, as nullable text with no default');
  assert.ok(observed.indexOf(EPISODE_COLUMN_ADDED[0]) >= EPISODE_COLUMNS_0075.length
    || observed.findIndex((column) => column[0] === 'end_reason') === EPISODE_COLUMNS_0075.length,
    'and it was APPENDED, not inserted among the columns 0075 owns');

  stage = 'catalog: every constraint and index migration 0075 owns on the episode still stands';
  const episodeConstraints = await rows(
    `SELECT conname name, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY conname`, [EPISODES]);
  const byName = new Map(episodeConstraints.map((c) => [c.name, c.def]));
  for (const name of EPISODE_CONSTRAINTS_0075) assert.ok(byName.has(name), `0075's ${name} is still present`);
  assert.match(byName.get('shared_world_membership_episodes_interval_check'), /ended_at IS NULL\) OR \(ended_at >= joined_at/u,
    'the 0075 interval check is unchanged');
  assert.match(byName.get('shared_world_membership_episodes_world_fk'), /REFERENCES shared_worlds\(id\) ON DELETE RESTRICT/u);
  assert.match(byName.get('shared_world_membership_episodes_user_fk'), /REFERENCES users\(id\) ON DELETE RESTRICT/u);
  const [{ def: oneOpen }] = await rows(
    "SELECT pg_get_indexdef(i.indexrelid) def FROM pg_index i WHERE i.indexrelid = 'public.shared_world_membership_episodes_one_open_idx'::regclass");
  assert.match(oneOpen, /UNIQUE INDEX .* \(world_id, user_id\) WHERE \(ended_at IS NULL\)/u,
    "0075's one-open-episode partial unique index is unchanged");
  // That migration 0083 itself added NO check over end_reason - so a later
  // authorized slice can write REMOVED or a closure reason without a superseding
  // migration - is proven from 0083's own text by
  // database/tests/shared-world-standard-voluntary-leave-v1.test.mjs. It is
  // deliberately NOT asserted from the live catalog here: that would forbid the
  // very future slice this additive column exists to serve.

  stage = 'catalog: the new tables carry exactly their own columns';
  for (const [table, expected] of [[LEFT_EVENTS, LEFT_EVENT_COLUMNS], [LEAVE_COMMANDS, LEAVE_COMMAND_COLUMNS]]) {
    const columns = await rows(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table.replace('public.', '')]);
    // A PREFIX, for the same reason as above: this verifier must not become the
    // ceiling I-04C repaired in its five predecessors.
    const shape = columns.map((c) => [c.column_name, c.data_type, c.is_nullable]);
    assert.deepEqual(shape.slice(0, expected.length), expected,
      `${table} still carries every column migration 0083 owns, unchanged and in its original position`);
    for (const [name] of expected) {
      assert.equal(shape.filter((column) => column[0] === name).length, 1, `${table}.${name} appears exactly once`);
    }
    for (const { column_name: column } of columns) {
      assert.doesNotMatch(column, /owner|admin|creator|survivor|privilege|role|capability|payload|metadata|approval|vote/iu,
        `${table}.${column} creates no superior authority and no generic event engine`);
    }
  }

  stage = 'catalog: the exact unique bindings and restrictive foreign keys';
  const leftEventConstraints = await rows(
    `SELECT conname name, contype type, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY conname`, [LEFT_EVENTS]);
  const leaveConstraints = await rows(
    `SELECT conname name, contype type, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY conname`, [LEAVE_COMMANDS]);
  // A sentinel rather than `undefined`, so a DROPPED constraint fails as a named
  // assertion instead of as a TypeError - which is what the forward-safety
  // regressions below rely on being able to recognise.
  const defOf = (list, name) => (list.find((c) => c.name === name) ?? { def: `MISSING CONSTRAINT ${name}` }).def;
  assert.match(defOf(leftEventConstraints, 'shared_world_member_left_events_pk'), /PRIMARY KEY \(id\)/u);
  assert.match(defOf(leftEventConstraints, 'shared_world_member_left_events_episode_key'), /UNIQUE \(membership_episode_id\)/u,
    'one membership episode is ended by at most one voluntary leave');
  assert.match(defOf(leaveConstraints, 'shared_world_voluntary_leave_commands_pk'), /PRIMARY KEY \(id\)/u);
  assert.match(defOf(leaveConstraints, 'shared_world_voluntary_leave_commands_episode_key'), /UNIQUE \(membership_episode_id\)/u);
  assert.match(defOf(leaveConstraints, 'shared_world_voluntary_leave_commands_event_key'), /UNIQUE \(member_left_event_id\)/u);
  // FORWARD SAFETY, in the schema itself: uniqueness is per episode and per
  // event, never per (world, user). A future rejoin creates a second episode
  // which may itself later leave, and a permanent (world, user) key would
  // forbid exactly that.
  for (const list of [leftEventConstraints, leaveConstraints]) {
    for (const constraint of list.filter((c) => c.type === 'u' || /PRIMARY KEY/u.test(c.def))) {
      assert.doesNotMatch(constraint.def, /\(world_id, actor_user_id\)|\(actor_user_id, world_id\)/u,
        `${constraint.name} must not make a human permanently unable to hold a future episode in the same World`);
    }
  }
  // Every foreign key 0083 OWNS, asserted exactly - name, local columns, parent
  // and restrictive deletion - rather than counted. A later additive foreign key
  // from a reviewed slice is not a 0083 regression.
  const normalize = (def) => def.replace(/REFERENCES (?:public\.)?/u, 'REFERENCES ');
  const liveForeignKeys = new Map([...leftEventConstraints, ...leaveConstraints]
    .filter((c) => c.type === 'f').map((c) => [c.name, normalize(c.def)]));
  for (const [name, def] of Object.entries(OWNED_FOREIGN_KEYS)) {
    assert.equal(liveForeignKeys.get(name), def, `${name} binds exactly the canonical row, restrictively: canonical history is never cascaded away`);
  }

  stage = 'catalog: RLS on, zero policies, no trigger';
  for (const table of OWN_TABLES) {
    const [{ rls }] = await rows('SELECT c.relrowsecurity rls FROM pg_class c WHERE c.oid = $1::regclass', [table]);
    assert.equal(rls, true, `row level security is enabled on ${table}`);
    const [{ n: policies }] = await rows('SELECT count(*)::int n FROM pg_policy p WHERE p.polrelid = $1::regclass', [table]);
    assert.equal(policies, 0, `${table} carries zero RLS policies`);
    const [{ n: triggers }] = await rows('SELECT count(*)::int n FROM pg_trigger t WHERE t.tgrelid = $1::regclass AND NOT t.tgisinternal', [table]);
    assert.equal(triggers, 0, `${table} carries no trigger`);
  }

  stage = 'catalog: the leave core is postgres-owned, SECURITY DEFINER, pinned and VOLATILE';
  const [{ n: overloads }] = await rows(
    `SELECT count(*)::int n FROM pg_proc pr JOIN pg_namespace ns ON ns.oid = pr.pronamespace
      WHERE ns.nspname='public' AND pr.proname='commit_shared_world_standard_voluntary_leave_v1'`);
  assert.equal(overloads, 1, 'exactly one leave core exists, with one overload');
  const [fn] = await rows(
    `SELECT pr.prosecdef secdef, pr.provolatile volatility, pr.proconfig config, pr.prosrc, pg_get_userbyid(pr.proowner) owner
       FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [LEAVE_FN]);
  assert.equal(fn.owner, 'postgres');
  assert.equal(fn.secdef, true, 'SECURITY DEFINER');
  assert.equal(fn.volatility, 'v', 'VOLATILE - it is a mutation');
  assert.ok((fn.config ?? []).some((entry) => entry === 'search_path=' || entry === 'search_path=""'), 'an empty search_path is pinned');

  stage = 'catalog: the exact IN and TABLE argument arrays, derived by PostgreSQL';
  // The arrays are built inside SQL with generate_subscripts rather than
  // partitioned client-side: pg_proc.proargmodes is "char"[], which
  // node-postgres returns as the raw literal {i,i,i,t,...}, so indexing it from
  // JavaScript reads CHARACTERS and silently misclassifies TABLE columns as
  // input parameters. PostgreSQL's own array ordinals are the authority.
  const [args] = await rows(
    `SELECT ARRAY(SELECT pr.proargnames[s.i] FROM generate_subscripts(pr.proargnames, 1) AS s(i)
                   WHERE pr.proargmodes[s.i] = 'i'::"char" ORDER BY s.i) AS in_names,
            ARRAY(SELECT pr.proargnames[s.i] FROM generate_subscripts(pr.proargnames, 1) AS s(i)
                   WHERE pr.proargmodes[s.i] IN ('o'::"char", 't'::"char") ORDER BY s.i) AS out_names,
            ARRAY(SELECT t.typname::text FROM unnest(pr.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
                   JOIN pg_type t ON t.oid = a.argtype ORDER BY a.ord) AS in_types
       FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [LEAVE_FN]);
  assert.deepEqual(args.in_names, ['p_command_id', 'p_world_id', 'p_member_left_event_id'],
    'exactly the three opaque persistence identities');
  assert.deepEqual(args.in_types, ['uuid', 'uuid', 'uuid'], 'and they are opaque uuids');
  assert.deepEqual(args.out_names,
    ['outcome', 'command_id', 'left_world_id', 'closed_membership_episode_id', 'left_event_id', 'episode_end_reason', 'left_at'],
    'and the committed result is exactly the bounded immutable historical shape');
  for (const name of args.in_names) {
    assert.doesNotMatch(name, /user_id|actor|target|leaver|member(ship)?_episode|episode_id|reason|audience|count|status|lifecycle|phase|timestamp|_at$/iu,
      `${name} is not an actor, target, episode, reason, audience, count or clock parameter`);
  }

  stage = 'catalog: the "char"[] decoding trap stays locked';
  const [modes] = await rows(
    `SELECT pg_typeof(pr.proargmodes)::text modes_type, pr.proargnames names, pr.proargmodes::text modes_text
       FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [LEAVE_FN]);
  assert.equal(modes.modes_type, '"char"[]', 'proargmodes is still "char"[]');
  assert.ok(Array.isArray(modes.names), 'node-postgres parses text[] into an array');
  assert.equal(typeof modes.modes_text, 'string', 'and "char"[] arrives as an unparsed literal');
  const naive = modes.names.filter((_, index) => modes.modes_text[index] === 'i');
  assert.notDeepEqual(naive, args.in_names, 'a client-side partition of proargmodes is provably wrong against this exact function and driver');

  stage = 'catalog: the leave core mutates no Standing Context state';
  assert.doesNotMatch(fn.prosrc, /standing_context|consent/iu,
    'leaving neither revokes a grant, contracts a ceiling nor appends a consent event');
  assert.doesNotMatch(fn.prosrc, /UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds/u, 'and never closes or creates a World');
  assert.doesNotMatch(fn.prosrc, /DELETE FROM|TRUNCATE/iu, 'and deletes no canonical history');
  assert.match(fn.prosrc, /auth\.uid\(\)/u, 'the leaving human is auth.uid()');
  assert.equal((fn.prosrc.match(/FOR UPDATE/gu) ?? []).length, 2, 'exactly two row locks');
  const worldAt = fn.prosrc.indexOf('FROM public.shared_worlds w');
  const episodeAt = fn.prosrc.indexOf('FROM public.shared_world_membership_episodes e');
  const updateAt = fn.prosrc.indexOf('UPDATE public.shared_world_membership_episodes');
  assert.ok(worldAt > 0 && episodeAt > worldAt && updateAt > episodeAt,
    'the canonical lock order is the World row, then the actor own open episode, then the write');
  assert.equal((fn.prosrc.match(/leave_at := /gu) ?? []).length, 1, 'the canonical leave instant is captured exactly once');
}

async function verifyDirectTableAcl() {
  stage = 'ACL: no application role holds direct CRUD on the leave tables, and the whole Shared substrate stays sealed';
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
    // And the additive column opened no read path into membership either.
    await rejected(() => q(`SELECT end_reason FROM ${EPISODES} LIMIT 1`), INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');
}

async function verifyFunctionAcl() {
  stage = 'THE PRE-LAUNCH BOUNDARY: the leave core is executable by no application role';
  const [{ allowed: publicExecute }] = await rows("SELECT has_function_privilege('public', $1, 'EXECUTE') AS allowed", [LEAVE_FN]);
  assert.equal(publicExecute, false, 'PUBLIC cannot execute the leave core');
  for (const role of APPLICATION_ROLES) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, LEAVE_FN, 'EXECUTE']);
    assert.equal(allowed, false, `${role} cannot execute the leave core before the launch gate exists`);
  }
  for (const role of APPLICATION_ROLES) {
    await identity(role, randomUUID());
    const error = await rejected(() => leave(randomUUID(), randomUUID(), randomUUID()), INSUFFICIENT_PRIVILEGE);
    assert.match(error.message, /permission denied/iu, `${role} is refused execution outright`);
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

const audienceOf = async (worldId) => {
  const [{ role }] = await rows('SELECT current_user AS role');
  await q('RESET ROLE');
  const resolved = await rows(AUDIENCE_SQL, [worldId]);
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  return resolved.map((row) => `${row.user_id}@${row.membership_episode_id}`).sort();
};

async function verifyLeave(f) {
  stage = 'leave: a current Standard member leaves unilaterally, with no group approval';
  const world = await provisionWorld(f.inviter, f.target, 'leave');
  const before = await snapshot(f.humans);
  const beforeAudience = await audienceOf(world.worldId);
  assert.deepEqual(beforeAudience, [`${f.inviter}@${world.inviterEpisode}`, `${f.target}@${world.targetEpisode}`].sort(),
    'both humans hold an open episode before the first leave');

  await identity('postgres', f.target);
  const command = { id: randomUUID(), event: randomUUID() };
  const [left] = await leave(command.id, world.worldId, command.event);
  assert.deepEqual(Object.keys(left).sort(),
    ['closed_membership_episode_id', 'command_id', 'episode_end_reason', 'left_at', 'left_event_id', 'left_world_id', 'outcome'].sort());
  assert.equal(left.outcome, 'LEFT');
  assert.equal(left.command_id, command.id);
  assert.equal(left.left_world_id, world.worldId);
  assert.equal(left.closed_membership_episode_id, world.targetEpisode, 'the human closed exactly their OWN existing episode');
  assert.equal(left.left_event_id, command.event);
  assert.equal(left.episode_end_reason, 'VOLUNTARY_LEAVE');
  // The committed result carries no human identity and no current-topology fact.
  const serialized = JSON.stringify(left);
  for (const secret of [f.inviter, f.target, f.outsider]) assert.ok(!serialized.includes(secret), 'the leave result reveals no human');

  await identity('postgres');
  stage = 'leave: the episode is CLOSED IN PLACE - never deleted, never replaced';
  const [episode] = await rows(`SELECT * FROM ${EPISODES} WHERE id=$1`, [world.targetEpisode]);
  assert.ok(episode, 'the episode row still exists');
  assert.equal(episode.world_id, world.worldId, 'its World is unchanged');
  assert.equal(episode.user_id, f.target, 'its human is unchanged');
  assert.ok(episode.ended_at !== null, 'it is closed');
  assert.equal(episode.end_reason, 'VOLUNTARY_LEAVE', 'with the canonical reason');
  const [{ n: episodeCount }] = await rows(`SELECT count(*)::int n FROM ${EPISODES} WHERE world_id=$1`, [world.worldId]);
  assert.equal(episodeCount, 2, 'no membership row was deleted and none was added');
  const [{ unchanged }] = await rows(
    `SELECT (e.joined_at = w.born_at) unchanged FROM ${EPISODES} e JOIN ${WORLDS} w ON w.id = e.world_id WHERE e.id=$1`, [world.targetEpisode]);
  assert.equal(unchanged, true, 'the historical join moment is never rewritten');

  stage = 'leave: exactly one MEMBER_LEFT event and exactly one durable command';
  const events = await rows(`SELECT * FROM ${LEFT_EVENTS} WHERE world_id=$1`, [world.worldId]);
  assert.equal(events.length, 1, 'exactly one MEMBER_LEFT fact');
  assert.equal(events[0].id, command.event);
  assert.equal(events[0].membership_episode_id, world.targetEpisode);
  assert.equal(events[0].actor_user_id, f.target, 'the event names the human who left');
  const commands = await rows(`SELECT * FROM ${LEAVE_COMMANDS} WHERE id=$1`, [command.id]);
  assert.equal(commands.length, 1, 'exactly one durable leave command');
  assert.equal(commands[0].actor_user_id, f.target);
  assert.equal(commands[0].membership_episode_id, world.targetEpisode);

  stage = 'leave: ONE canonical instant, compared in SQL at full precision';
  const [{ coherent }] = await rows(
    `SELECT (e.ended_at = ev.occurred_at AND e.ended_at = c.committed_at) AS coherent
       FROM ${EPISODES} e
       JOIN ${LEFT_EVENTS} ev ON ev.membership_episode_id = e.id
       JOIN ${LEAVE_COMMANDS} c ON c.membership_episode_id = e.id
      WHERE e.id = $1`, [world.targetEpisode]);
  assert.equal(coherent, true, 'ended_at, occurred_at and committed_at are ONE database-owned instant');
  const [{ database_owned: databaseOwned }] = await rows(
    `SELECT (e.ended_at <= clock_timestamp() AND e.ended_at > clock_timestamp() - interval '1 hour' AND e.ended_at >= e.joined_at) AS database_owned
       FROM ${EPISODES} e WHERE e.id=$1`, [world.targetEpisode]);
  assert.equal(databaseOwned, true, 'the instant came from the database clock, never from a caller');

  stage = 'leave: the World is untouched and ONE active human remains';
  const [remaining] = await rows(`SELECT lifecycle, phase, closed_at, born_at FROM ${WORLDS} WHERE id=$1`, [world.worldId]);
  assert.deepEqual([remaining.lifecycle, remaining.phase, remaining.closed_at], ['ACTIVE', 'STANDARD', null],
    'voluntary leave never closes, converts or re-phases the World');
  const [{ n: stillOpen }] = await rows(`SELECT count(*)::int n FROM ${EPISODES} WHERE world_id=$1 AND ended_at IS NULL`, [world.worldId]);
  assert.equal(stillOpen, 1, 'exactly the other member remains open');
  const [survivorEpisode] = await rows(`SELECT user_id, end_reason FROM ${EPISODES} WHERE world_id=$1 AND ended_at IS NULL`, [world.worldId]);
  assert.equal(survivorEpisode.user_id, f.inviter, 'and it is the human who did not leave');
  assert.equal(survivorEpisode.end_reason, null, 'an open episode carries no end reason');

  stage = 'leave: no Personal truth and no Standing Context state changed';
  const after = await snapshot(f.humans);
  assert.deepEqual(personalOf(after), personalOf(before), 'no Personal row of any kind changed');
  assert.deepEqual(consentOf(after), consentOf(before), 'no grant, ceiling row or consent event changed');
  return { ...world, command };
}

async function verifyUnavailable(f, departed) {
  stage = 'bounded refusal: one non-enumerating class for every unavailable case';
  const cases = [];
  // A human who is not a member of this World at all.
  cases.push(['an outsider', f.outsider, departed.worldId]);
  // The human who already left - the episode is closed, not reopenable.
  cases.push(['a human who already left', f.target, departed.worldId]);
  // A World that does not exist.
  cases.push(['a nonexistent World', f.inviter, randomUUID()]);
  for (const [label, human, worldId] of cases) {
    await identity('postgres', human);
    const error = await rejected(() => leave(randomUUID(), worldId, randomUUID()), UNAVAILABLE);
    assert.match(error.message, /SHARED_WORLD_STANDARD_LEAVE_NOT_AVAILABLE/u, `${label} reaches the one bounded class`);
    // The refusal names nothing: not the World, not a human, not the topology.
    for (const secret of [f.inviter, f.target, f.outsider, departed.worldId]) {
      assert.ok(!error.message.includes(secret), `${label} learns no identity from the refusal`);
    }
  }

  stage = 'bounded refusal: ordinary leave mechanics are ACTIVE / STANDARD only';
  // The three other legal states, provisioned directly as the owner: the birth
  // primitive makes only ACTIVE / STANDARD, and this slice implements no
  // transition into any other state.
  await identity('postgres');
  const others = [
    ['ACTIVE', 'INTRODUCTION', 'MUTUAL_MATCH', null],
    ['READ_ONLY_CLOSED', 'STANDARD', 'ACCEPTED_INVITATION', '2026-01-02T00:00:00Z'],
    ['READ_ONLY_CLOSED', 'INTRODUCTION', 'MUTUAL_MATCH', '2026-01-02T00:00:00Z'],
  ];
  for (const [lifecycle, phase, basis, closedAt] of others) {
    const worldId = randomUUID();
    const episodeId = randomUUID();
    await q(`INSERT INTO ${WORLDS}(id, lifecycle, phase, birth_basis, born_at, closed_at) VALUES($1,$2,$3,$4,'2026-01-01T00:00:00Z',$5)`,
      [worldId, lifecycle, phase, basis, closedAt]);
    await q(`INSERT INTO ${EPISODES}(id, world_id, user_id, joined_at) VALUES($1,$2,$3,'2026-01-01T00:00:00Z')`, [episodeId, worldId, f.inviter]);
    await identity('postgres', f.inviter);
    const error = await rejected(() => leave(randomUUID(), worldId, randomUUID()), UNAVAILABLE);
    assert.match(error.message, /SHARED_WORLD_STANDARD_LEAVE_NOT_AVAILABLE/u,
      `${lifecycle} / ${phase} is refused - this slice invents no paired-phase exit and no archived mutation`);
    await identity('postgres');
    const [{ ended_at: stillOpen, end_reason: noReason }] = await rows(`SELECT ended_at, end_reason FROM ${EPISODES} WHERE id=$1`, [episodeId]);
    assert.equal(stillOpen, null, `the ${lifecycle} / ${phase} episode was not closed`);
    assert.equal(noReason, null, 'and carries no reason');
    const [{ n: noEvent }] = await rows(`SELECT count(*)::int n FROM ${LEFT_EVENTS} WHERE world_id=$1`, [worldId]);
    assert.equal(noEvent, 0, 'and no MEMBER_LEFT fact was appended');
  }

  stage = 'bounded refusal: no human session identity, and malformed identities';
  await identity('postgres');
  await rejected(() => leave(randomUUID(), departed.worldId, randomUUID()), INSUFFICIENT_PRIVILEGE,
    /SHARED_WORLD_VOLUNTARY_LEAVE_AUTHENTICATION_REQUIRED/u);
  await identity('postgres', f.inviter);
  await rejected(() => leave(null, departed.worldId, randomUUID()), INVALID_PARAMETER);
  await rejected(() => leave(randomUUID(), departed.worldId, null), INVALID_PARAMETER);
  await identity('postgres');
}

/**
 * The three parameters are OPAQUE persistence identities addressing three
 * different domains - a command, a World and an event. Nothing frozen assigns
 * cross-domain inequality semantics to them, so equality between them is legal
 * input and must COMMIT with correct persisted bindings rather than being
 * refused by invented identifier algebra.
 */
async function verifyCrossDomainIdentityEquality(f) {
  stage = 'opaque identities: a command id equal to the event id is legal and commits with exact bindings';
  const shared = await provisionWorld(f.inviter, f.equalityTarget, 'equality');
  const both = randomUUID();
  await identity('postgres', f.equalityTarget);
  const [left] = await leave(both, shared.worldId, both);
  assert.equal(left.outcome, 'LEFT');
  assert.equal(left.command_id, both);
  assert.equal(left.left_event_id, both);
  assert.equal(left.closed_membership_episode_id, shared.targetEpisode);
  await identity('postgres');
  const [event] = await rows(`SELECT * FROM ${LEFT_EVENTS} WHERE id=$1`, [both]);
  const [command] = await rows(`SELECT * FROM ${LEAVE_COMMANDS} WHERE id=$1`, [both]);
  assert.ok(event && command, 'both rows exist under the same opaque value, in their own tables');
  assert.equal(command.member_left_event_id, both, 'the command binds the event by that value');
  assert.equal(event.membership_episode_id, shared.targetEpisode, 'and the event names the episode that actually closed');
  assert.equal(command.membership_episode_id, shared.targetEpisode);
  assert.equal(event.actor_user_id, f.equalityTarget);
  const [{ coherent }] = await rows(
    `SELECT (e.ended_at = ev.occurred_at AND e.ended_at = c.committed_at AND e.end_reason = 'VOLUNTARY_LEAVE') AS coherent
       FROM ${EPISODES} e JOIN ${LEFT_EVENTS} ev ON ev.membership_episode_id = e.id
       JOIN ${LEAVE_COMMANDS} c ON c.membership_episode_id = e.id WHERE e.id=$1`, [shared.targetEpisode]);
  assert.equal(coherent, true, 'the one canonical instant and the reason are unaffected by the equal identities');
  // And the retry is still durable under the equal identities.
  await identity('postgres', f.equalityTarget);
  const [retry] = await leave(both, shared.worldId, both);
  assert.deepEqual(retry, left, 'an equivalent retry under equal identities returns the committed result');
  await identity('postgres');

  stage = 'opaque identities: all three equal is legal too, when the World really is that value';
  const survivor = await provisionWorld(f.inviter, f.equalitySecond, 'equality-triple');
  await identity('postgres', f.equalitySecond);
  const [triple] = await leave(survivor.worldId, survivor.worldId, survivor.worldId);
  assert.equal(triple.outcome, 'LEFT', 'a command id and an event id equal to the World id are still just opaque values');
  assert.equal(triple.left_world_id, survivor.worldId);
  await identity('postgres');
  const [{ n: worldUntouched }] = await rows(
    `SELECT count(*)::int n FROM ${WORLDS} WHERE id=$1 AND lifecycle='ACTIVE' AND phase='STANDARD' AND closed_at IS NULL`, [survivor.worldId]);
  assert.equal(worldUntouched, 1, 'the World row is untouched by an event or command that happens to share its id');
  const [{ n: rowsUnderId }] = await rows(
    `SELECT ((SELECT count(*) FROM ${LEFT_EVENTS} WHERE id=$1) + (SELECT count(*) FROM ${LEAVE_COMMANDS} WHERE id=$1))::int n`, [survivor.worldId]);
  assert.equal(rowsUnderId, 2, 'exactly one event and one command carry that value, each in its own table');
}

async function verifyAudience(f, departed) {
  stage = 'audience: the FROZEN 0079 resolver reports the new canonical topology, unchanged';
  const survivorOnly = await audienceOf(departed.worldId);
  assert.deepEqual(survivorOnly, [`${f.inviter}@${departed.inviterEpisode}`],
    'after the first leave the current audience is exactly the survivor');
  assert.ok(!survivorOnly.some((entry) => entry.startsWith(f.target)), "the departed human's episode is absent from the current audience");
  // The exact ordered (user @ episode) set IS the input the frozen API-side
  // audience fingerprint hashes, so a snapshot bound to the pre-leave set can
  // no longer be current. The frozen fingerprint function itself is proven to
  // turn exactly this transition into AUDIENCE_CHANGED by the test-only spec
  // apps/api/src/connected-worlds/delivery-authority/voluntary-leave-audience-staleness.spec.ts.
  const preLeave = [`${f.inviter}@${departed.inviterEpisode}`, `${f.target}@${departed.targetEpisode}`].sort();
  assert.notDeepEqual(survivorOnly, preLeave, 'the audience state a pre-leave generation bound is no longer the current one');

  stage = 'audience: the LAST active human may also leave - zero active humans is valid';
  await identity('postgres', f.inviter);
  const finalCommand = { id: randomUUID(), event: randomUUID() };
  const [lastOut] = await leave(finalCommand.id, departed.worldId, finalCommand.event);
  assert.equal(lastOut.outcome, 'LEFT', 'no "must retain one member" rule blocks the final leave');
  assert.equal(lastOut.closed_membership_episode_id, departed.inviterEpisode);
  await identity('postgres');

  stage = 'audience: the canonical inert NO_ACTIVE_HUMAN_MEMBERS state';
  const empty = await audienceOf(departed.worldId);
  assert.deepEqual(empty, [], 'zero open episodes resolves as a successful EMPTY audience, not as a failure');
  const [inert] = await rows(`SELECT lifecycle, phase, closed_at FROM ${WORLDS} WHERE id=$1`, [departed.worldId]);
  assert.deepEqual([inert.lifecycle, inert.phase, inert.closed_at], ['ACTIVE', 'STANDARD', null],
    'the World is NOT auto-closed, auto-deleted or converted: the inert state is DERIVED from zero open episodes');
  const [{ n: worldStillThere }] = await rows(`SELECT count(*)::int n FROM ${WORLDS} WHERE id=$1`, [departed.worldId]);
  assert.equal(worldStillThere, 1, 'the World and its history are preserved');
  const [{ n: historyIntact }] = await rows(`SELECT count(*)::int n FROM ${EPISODES} WHERE world_id=$1`, [departed.worldId]);
  assert.equal(historyIntact, 2, 'both historical membership episodes remain, closed');
  const [{ n: departures }] = await rows(`SELECT count(*)::int n FROM ${LEFT_EVENTS} WHERE world_id=$1`, [departed.worldId]);
  assert.equal(departures, 2, 'exactly two MEMBER_LEFT facts exist');
  const [{ n: stillBorn }] = await rows(`SELECT count(*)::int n FROM ${BIRTH_EVENTS} WHERE world_id=$1`, [departed.worldId]);
  assert.equal(stillBorn, 1, 'and the World birth fact is untouched');
  return finalCommand;
}

async function verifyGrants(f) {
  stage = 'grants: a valid current Standing Context Grant survives its grantor leaving';
  const world = await provisionWorld(f.inviter, f.secondTarget, 'grants');
  // The grantor creates a grant through the FROZEN I-03C command, while still a
  // current member, with the exact current audience as its ceiling.
  await identity('authenticated', f.secondTarget);
  const grantId = randomUUID();
  const [granted] = await rows(GRANT_SQL, [randomUUID(), grantId, world.worldId, [f.inviter, f.secondTarget], null]);
  assert.equal(granted.grant_status, 'ACTIVE', 'the grant was committed under current membership');
  await identity('postgres');
  const beforeGrant = await rows(`SELECT * FROM ${GRANTS} WHERE id=$1`, [grantId]);
  const beforeCeiling = (await rows(`SELECT audience_user_id FROM ${CEILING} WHERE grant_id=$1 ORDER BY audience_user_id`, [grantId]))
    .map((row) => row.audience_user_id);
  const beforeConsent = await rows(`SELECT * FROM ${CONSENT_EVENTS} WHERE world_id=$1 ORDER BY id`, [world.worldId]);
  assert.equal(beforeCeiling.length, 2, 'the ceiling names both current humans');

  await identity('postgres', f.secondTarget);
  const [left] = await leave(randomUUID(), world.worldId, randomUUID());
  assert.equal(left.outcome, 'LEFT');
  await identity('postgres');

  stage = 'grants: membership loss and grant revocation are SEPARATE canonical truths';
  const afterGrant = await rows(`SELECT * FROM ${GRANTS} WHERE id=$1`, [grantId]);
  assert.deepEqual(afterGrant, beforeGrant,
    'the departed grantor ACTIVE grant is not revoked, re-dated or altered in any column');
  assert.equal(afterGrant[0].status, 'ACTIVE', 'it is still ACTIVE');
  assert.equal(afterGrant[0].revoked_at, null, 'and carries no revocation moment');
  const afterCeiling = (await rows(`SELECT audience_user_id FROM ${CEILING} WHERE grant_id=$1 ORDER BY audience_user_id`, [grantId]))
    .map((row) => row.audience_user_id);
  assert.deepEqual(afterCeiling, beforeCeiling, 'not one audience-ceiling row was deleted or contracted');
  const afterConsent = await rows(`SELECT * FROM ${CONSENT_EVENTS} WHERE world_id=$1 ORDER BY id`, [world.worldId]);
  assert.deepEqual(afterConsent, beforeConsent, 'leaving appends no revoke consent event');
  // And there is no mechanism by which it could happen implicitly, in either
  // direction, anywhere in the schema.
  const [{ n: couplings }] = await rows(
    `SELECT count(*)::int n FROM pg_trigger t
      WHERE NOT t.tgisinternal AND t.tgrelid = ANY($1::regclass[])`,
    [[EPISODES, GRANTS, CEILING, CONSENT_EVENTS]]);
  assert.equal(couplings, 0, 'no trigger couples membership to Standing Context state');

  stage = 'grants: the departed owner may still explicitly revoke - withdrawal survives leaving';
  await identity('authenticated', f.secondTarget);
  const [revoked] = await rows(REVOKE_SQL, [randomUUID(), world.worldId, grantId]);
  assert.equal(revoked.grant_status, 'REVOKED', 'explicit revoke still works after leaving, under I-03C unchanged');
  assert.equal(revoked.event_type, 'REVOKED');

  stage = 'grants: a NEW grant after leaving still fails under I-03C own current-membership rule';
  const error = await rejected(() => rows(GRANT_SQL, [randomUUID(), randomUUID(), world.worldId, [f.inviter], null]), INSUFFICIENT_PRIVILEGE);
  assert.match(error.message, /STANDING_CONTEXT_GRANTOR_NOT_CURRENT_MEMBER/u,
    'the refusal comes from the frozen I-03C rule, not from anything I-04C invented');
  await identity('postgres');
  return { ...world, grantId };
}

async function verifyStaleness(f, granted) {
  stage = 'staleness: a pre-leave audience state cannot silently remain current';
  // The survivor is still a current member of the grants fixture World, so the
  // audience is non-empty; the departed grantor is gone from it.
  const current = await audienceOf(granted.worldId);
  assert.deepEqual(current, [`${f.inviter}@${granted.inviterEpisode}`], 'the current audience excludes the departed human');
  const [{ absent }] = await rows(
    `SELECT NOT EXISTS (SELECT 1 FROM public.resolve_shared_world_human_audience_snapshot_v1($1) r
                         WHERE r.membership_episode_id = $2) AS absent`, [granted.worldId, granted.targetEpisode]);
  assert.equal(absent, true, 'the exact membership episode a pre-leave generation bound is no longer in the current snapshot');
  // And the grant the departed human still holds is resolvable exactly as
  // persisted: the frozen I-03B boundary reads no membership, so the SURVIVING
  // authority basis and the CHANGED audience stay separate inputs - which is
  // what lets the frozen I-03A / I-03E / I-03F layers decide, unchanged.
  const resolved = await rows('SELECT grant_id, status, audience_user_id FROM public.resolve_shared_world_standing_context_grant_v1($1,$2)',
    [granted.worldId, f.secondTarget]);
  assert.deepEqual(resolved, [], 'after the explicit revoke above, the departed owner has no ACTIVE grant - because they revoked it, not because they left');
}

async function verifyIdempotency(f, departed, finalCommand) {
  stage = 'idempotency: an equivalent retry returns the committed historical result';
  const before = await snapshot(f.humans);
  await identity('postgres', f.target);
  const [first] = await rows(`SELECT * FROM ${LEAVE_COMMANDS} WHERE id=$1`, [departed.command.id]);
  const [retry] = await leave(departed.command.id, departed.worldId, departed.command.event);
  assert.equal(retry.outcome, 'LEFT');
  assert.equal(retry.command_id, departed.command.id);
  assert.equal(retry.closed_membership_episode_id, departed.targetEpisode);
  assert.equal(retry.left_event_id, departed.command.event);
  assert.equal(retry.episode_end_reason, 'VOLUNTARY_LEAVE');
  assert.equal(retry.left_at.getTime(), first.committed_at.getTime(), 'and the historical instant, not a new one');
  await identity('postgres');
  const after = await snapshot(f.humans);
  assert.equal(after.departures, before.departures, 'the retry created no second MEMBER_LEFT fact');
  assert.equal(after.leaves, before.leaves, 'and no second command row');
  assert.equal(after.episodes, before.episodes, 'and no second episode');

  stage = 'idempotency: the historical answer survives a FUTURE successor episode for the same human';
  // A rejoin is not implemented here, but its shape is: a second, later episode
  // for the same human in the same World. The old leave command must keep
  // answering historically rather than inspecting current membership.
  await identity('postgres');
  const successor = randomUUID();
  await q(`INSERT INTO ${EPISODES}(id, world_id, user_id, joined_at) VALUES($1,$2,$3,clock_timestamp())`,
    [successor, departed.worldId, f.target]);
  await identity('postgres', f.target);
  const [afterSuccessor] = await leave(departed.command.id, departed.worldId, departed.command.event);
  assert.deepEqual(afterSuccessor, retry, 'the historical result is byte-for-byte unchanged by a later successor episode');
  assert.equal(afterSuccessor.closed_membership_episode_id, departed.targetEpisode, 'it still names the episode this command actually closed');
  await identity('postgres');
  const [{ ended_at: successorOpen }] = await rows(`SELECT ended_at FROM ${EPISODES} WHERE id=$1`, [successor]);
  assert.equal(successorOpen, null, 'and the retry did not touch the successor episode');
  await q(`DELETE FROM ${EPISODES} WHERE id=$1`, [successor]);

  stage = 'idempotency: a reused command id with ANY different identity fails closed';
  const other = await provisionWorld(f.inviter, f.thirdTarget, 'conflict');
  await identity('postgres', f.target);
  // different World
  await rejected(() => leave(departed.command.id, other.worldId, departed.command.event), CONFLICT,
    /SHARED_WORLD_VOLUNTARY_LEAVE_COMMAND_ID_CONFLICT/u);
  // different event id
  await rejected(() => leave(departed.command.id, departed.worldId, randomUUID()), CONFLICT,
    /SHARED_WORLD_VOLUNTARY_LEAVE_COMMAND_ID_CONFLICT/u);
  // a different human cannot adopt a committed command id
  await identity('postgres', f.thirdTarget);
  await rejected(() => leave(departed.command.id, departed.worldId, departed.command.event), CONFLICT,
    /SHARED_WORLD_VOLUNTARY_LEAVE_COMMAND_ID_CONFLICT/u);
  // and the final leave command of the same World is equally durable
  await identity('postgres', f.inviter);
  const [finalRetry] = await leave(finalCommand.id, departed.worldId, finalCommand.event);
  assert.equal(finalRetry.closed_membership_episode_id, departed.inviterEpisode);
  await identity('postgres');
  const [{ n: unchanged }] = await rows(`SELECT count(*)::int n FROM ${LEAVE_COMMANDS} WHERE world_id=$1`, [departed.worldId]);
  assert.equal(unchanged, 2, 'exactly the two committed leave commands exist for that World');
  return other;
}

async function verifyConcurrency(c) {
  stage = 'concurrency: real independent connections';
  const connections = [];
  const open = async () => {
    const extra = new Client({ connectionString: databaseUrl });
    await extra.connect();
    connections.push(extra);
    return extra;
  };
  // The owner drives the internal primitive while the EXACT human's JWT claim is
  // set - precisely what a later launch-gated wrapper must preserve.
  const asOwnerFor = async (conn, uid) => {
    await conn.query('BEGIN');
    await conn.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
  };
  const asHuman = async (conn, uid) => {
    await conn.query('BEGIN');
    await conn.query('SET LOCAL ROLE authenticated');
    await conn.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
  };
  const blocks = async (pending) => {
    pending.catch(() => undefined);
    return Promise.race([
      pending.then(() => 'COMPLETED', () => 'COMPLETED'),
      new Promise((resolve) => { setTimeout(() => resolve('BLOCKED'), 750); }),
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

    stage = 'concurrency: two IDENTICAL leaves produce ONE mutation and the same result to both';
    const identical = c.worlds.identical;
    const shared = { id: randomUUID(), event: randomUUID() };
    await asOwnerFor(a, c.targetA); await asOwnerFor(b, c.targetA);
    const won = await a.query(LEAVE_SQL, [shared.id, identical.worldId, shared.event]);
    assert.equal(won.rows[0].outcome, 'LEFT');
    const duplicate = b.query(LEAVE_SQL, [shared.id, identical.worldId, shared.event]);
    assert.equal(await blocks(duplicate), 'BLOCKED', 'the duplicate queues on the exact World row');
    await a.query('COMMIT');
    const duplicateResult = await duplicate;
    assert.deepEqual(duplicateResult.rows[0], won.rows[0], 'both callers receive the SAME committed historical result');
    await b.query('COMMIT');
    const [{ n: onceClosed }] = await rows(
      `SELECT count(*)::int n FROM ${EPISODES} WHERE world_id=$1 AND ended_at IS NOT NULL`, [identical.worldId]);
    assert.equal(onceClosed, 1, 'exactly one episode closed');
    const [{ n: oneEvent }] = await rows(`SELECT count(*)::int n FROM ${LEFT_EVENTS} WHERE world_id=$1`, [identical.worldId]);
    assert.equal(oneEvent, 1, 'exactly one MEMBER_LEFT fact');
    const [{ n: oneCommand }] = await rows(`SELECT count(*)::int n FROM ${LEAVE_COMMANDS} WHERE id=$1`, [shared.id]);
    assert.equal(oneCommand, 1, 'exactly one durable command row');

    stage = 'concurrency: two DIFFERENT leave commands racing one episode have exactly one winner';
    const contested = c.worlds.contested;
    const winner = { id: randomUUID(), event: randomUUID() };
    const loser = { id: randomUUID(), event: randomUUID() };
    await asOwnerFor(a, c.targetB); await asOwnerFor(b, c.targetB);
    await a.query(LEAVE_SQL, [winner.id, contested.worldId, winner.event]);
    const losing = b.query(LEAVE_SQL, [loser.id, contested.worldId, loser.event]);
    assert.equal(await blocks(losing), 'BLOCKED', 'the competing command queues on the same World row');
    await a.query('COMMIT');
    const losingError = await failureOf(losing);
    assert.ok(losingError, 'the loser did not close a second episode');
    assert.equal(losingError.code, 'P0002');
    assert.match(losingError.message, /SHARED_WORLD_STANDARD_LEAVE_NOT_AVAILABLE/u, 'the loser sees an already-consumed membership, bounded');
    await b.query('ROLLBACK');
    const [{ n: oneDeparture }] = await rows(`SELECT count(*)::int n FROM ${LEFT_EVENTS} WHERE world_id=$1`, [contested.worldId]);
    assert.equal(oneDeparture, 1, 'the episode closed exactly once');
    const [{ n: noOrphanEvent }] = await rows(`SELECT count(*)::int n FROM ${LEFT_EVENTS} WHERE id=$1`, [loser.event]);
    assert.equal(noOrphanEvent, 0, 'and the loser left no orphan event');
    const [{ n: noOrphanCommand }] = await rows(`SELECT count(*)::int n FROM ${LEAVE_COMMANDS} WHERE id=$1`, [loser.id]);
    assert.equal(noOrphanCommand, 0, 'and no orphan command');

    stage = 'concurrency: BOTH members of a two-person World may leave, in sequence';
    const both = c.worlds.both;
    const firstOut = { id: randomUUID(), event: randomUUID() };
    const secondOut = { id: randomUUID(), event: randomUUID() };
    await asOwnerFor(a, c.targetC); await asOwnerFor(b, c.inviter);
    const firstResult = await a.query(LEAVE_SQL, [firstOut.id, both.worldId, firstOut.event]);
    assert.equal(firstResult.rows[0].outcome, 'LEFT');
    const secondPending = b.query(LEAVE_SQL, [secondOut.id, both.worldId, secondOut.event]);
    assert.equal(await blocks(secondPending), 'BLOCKED', 'the other member queues on the same World row rather than racing it');
    await a.query('COMMIT');
    const secondResult = await secondPending;
    assert.equal(secondResult.rows[0].outcome, 'LEFT', 'the last active human may also leave - no "must retain one member" rule');
    assert.notEqual(secondResult.rows[0].closed_membership_episode_id, firstResult.rows[0].closed_membership_episode_id,
      'each human closed their OWN episode');
    await b.query('COMMIT');
    const [{ n: bothGone }] = await rows(`SELECT count(*)::int n FROM ${EPISODES} WHERE world_id=$1 AND ended_at IS NULL`, [both.worldId]);
    assert.equal(bothGone, 0, 'zero active humans');
    const [{ n: twoDepartures }] = await rows(`SELECT count(*)::int n FROM ${LEFT_EVENTS} WHERE world_id=$1`, [both.worldId]);
    assert.equal(twoDepartures, 2, 'exactly two historical MEMBER_LEFT facts');
    const [inert] = await rows(`SELECT lifecycle, phase, closed_at FROM ${WORLDS} WHERE id=$1`, [both.worldId]);
    assert.deepEqual([inert.lifecycle, inert.phase, inert.closed_at], ['ACTIVE', 'STANDARD', null],
      'and the World is still ACTIVE / STANDARD, inert rather than closed');

    stage = 'concurrency: grant/reconfirm commits FIRST, then leave - the committed grant is not auto-revoked';
    const grantFirst = c.worlds.grantFirst;
    const grantId = randomUUID();
    await asHuman(a, c.targetD); await asOwnerFor(b, c.targetD);
    await a.query(GRANT_SQL, [randomUUID(), grantId, grantFirst.worldId, [c.inviter, c.targetD], null]);
    const queuedLeave = b.query(LEAVE_SQL, [randomUUID(), grantFirst.worldId, randomUUID()]);
    assert.equal(await blocks(queuedLeave), 'BLOCKED', 'the leave queues behind the consent command holding the World row');
    await a.query('COMMIT');
    const leaveAfterGrant = await queuedLeave;
    assert.equal(leaveAfterGrant.rows[0].outcome, 'LEFT', 'the leave then proceeds');
    await b.query('COMMIT');
    const [survivingGrant] = await rows(`SELECT status, revoked_at FROM ${GRANTS} WHERE id=$1`, [grantId]);
    assert.deepEqual([survivingGrant.status, survivingGrant.revoked_at], ['ACTIVE', null],
      'the already-valid grant is NOT revoked merely because its grantor left');
    const [{ n: ceilingIntact }] = await rows(`SELECT count(*)::int n FROM ${CEILING} WHERE grant_id=$1`, [grantId]);
    assert.equal(ceilingIntact, 2, 'and its audience ceiling is not contracted');

    stage = 'concurrency: leave commits FIRST, then grant/reconfirm - no stale grant may commit';
    const leaveFirst = c.worlds.leaveFirst;
    await asOwnerFor(a, c.targetE); await asHuman(b, c.targetE);
    await a.query(LEAVE_SQL, [randomUUID(), leaveFirst.worldId, randomUUID()]);
    const queuedGrant = b.query(GRANT_SQL, [randomUUID(), randomUUID(), leaveFirst.worldId, [c.inviter], null]);
    assert.equal(await blocks(queuedGrant), 'BLOCKED', 'the consent command queues behind the leave holding the World row');
    await a.query('COMMIT');
    const staleGrantError = await failureOf(queuedGrant);
    assert.ok(staleGrantError, 'a grant cannot commit against membership that has just ended');
    assert.equal(staleGrantError.code, '42501');
    assert.match(staleGrantError.message, /STANDING_CONTEXT_GRANTOR_NOT_CURRENT_MEMBER/u,
      "and it fails under I-03C's own unchanged rule, which I-04C did not modify");
    await b.query('ROLLBACK');
    const [{ n: noStaleGrant }] = await rows(`SELECT count(*)::int n FROM ${GRANTS} WHERE world_id=$1 AND status='ACTIVE'`, [leaveFirst.worldId]);
    assert.equal(noStaleGrant, 0, 'no stale grant exists');

    stage = 'concurrency: no deadlock, and no orphan row among the leaves these races produced';
    const [{ n: deadlocksAfter }] = await rows(
      'SELECT COALESCE(sum(deadlocks), 0)::int n FROM pg_stat_database WHERE datname = current_database()');
    assert.equal(deadlocksAfter, deadlocksBefore, 'the World-first lock order produced no deadlock across any of these races');
    const raced = Object.values(c.worlds).map((world) => world.worldId);
    const [shape] = await rows(
      `SELECT (SELECT count(*)::int FROM ${LEFT_EVENTS} ev LEFT JOIN ${EPISODES} e ON e.id = ev.membership_episode_id
                WHERE ev.world_id = ANY($1::uuid[]) AND e.id IS NULL) orphan_events,
              (SELECT count(*)::int FROM ${LEFT_EVENTS} ev JOIN ${EPISODES} e ON e.id = ev.membership_episode_id
                WHERE ev.world_id = ANY($1::uuid[])
                  AND NOT (e.ended_at = ev.occurred_at AND e.end_reason = 'VOLUNTARY_LEAVE' AND e.world_id = ev.world_id
                           AND e.user_id = ev.actor_user_id)) incoherent,
              (SELECT count(*)::int FROM ${LEAVE_COMMANDS} lc LEFT JOIN ${LEFT_EVENTS} ev ON ev.id = lc.member_left_event_id
                WHERE lc.world_id = ANY($1::uuid[]) AND ev.id IS NULL) orphan_commands,
              (SELECT count(*)::int FROM ${WORLDS} w
                WHERE w.id = ANY($1::uuid[]) AND NOT (w.lifecycle='ACTIVE' AND w.phase='STANDARD' AND w.closed_at IS NULL)) closed_worlds,
              (SELECT count(*)::int FROM ${LEFT_EVENTS} ev WHERE ev.world_id = ANY($1::uuid[])) departures`, [raced]);
    assert.deepEqual(shape, { orphan_events: 0, incoherent: 0, orphan_commands: 0, closed_worlds: 0, departures: 6 },
      'these races produced exactly six coherent departures, no orphan row and no World closed by a leave');
  } finally {
    for (const conn of connections) await conn.end().catch(() => undefined);
  }
}

/**
 * FORWARD SAFETY, proven against real PostgreSQL rather than only in the static
 * mirror contract.
 *
 * This verifier runs against a FULLY migrated database, so it is the place where
 * a live-schema ceiling does its damage: it would start failing the moment a
 * later authorized slice evolved the schema, even though nothing about migration
 * 0083 had changed. So the repository is pushed several authorized steps into
 * its future - a governance table, an additive foreign key on an I-04C table, an
 * additive column and an end-reason CHECK on the canonical episode, an additive
 * index - and THIS verifier's own catalog proof is required to still pass. Then
 * the regressions it must still refuse are planted, so the forward safety is not
 * bought by asserting nothing.
 */
async function verifyForwardSafety(f) {
  stage = 'forward safety: later authorized additive schema evolution does not fail this historical verifier';
  await identity('postgres');
  const probe = `i04c_forward_safety_probe_${randomUUID().replace(/-/gu, '')}`;
  await q('SAVEPOINT forward_safety');
  try {
    // A later reviewed slice: governed removal (CW2-03 section 25) with its own
    // proposal substrate and its own broader end-reason vocabulary, plus an
    // additive link from the MEMBER_LEFT fact and an additive read index.
    await q(`CREATE TABLE public.${probe}_proposals (id uuid PRIMARY KEY)`);
    await q(`ALTER TABLE ${LEFT_EVENTS} ADD COLUMN ${probe}_proposal_id uuid`);
    await q(`ALTER TABLE ${LEFT_EVENTS} ADD CONSTRAINT ${probe}_fk
             FOREIGN KEY (${probe}_proposal_id) REFERENCES public.${probe}_proposals (id) ON DELETE RESTRICT`);
    await q(`ALTER TABLE ${EPISODES} ADD COLUMN ${probe}_ended_by uuid`);
    await q(`ALTER TABLE ${EPISODES} ADD CONSTRAINT ${probe}_reason_check
             CHECK (end_reason IS NULL OR end_reason IN ('VOLUNTARY_LEAVE', 'REMOVED', 'WORLD_CLOSED'))`);
    await q(`CREATE INDEX ${probe}_committed_idx ON ${LEAVE_COMMANDS} (committed_at)`);
    await verifyCatalog();

    // And the leave core itself still commits beside all of it.
    const world = await provisionWorld(f.inviter, f.forwardTarget, 'forward');
    await identity('postgres', f.forwardTarget);
    const [stillWorks] = await leave(randomUUID(), world.worldId, randomUUID());
    assert.equal(stillWorks.outcome, 'LEFT', 'a voluntary leave still commits beside the later authorized schema');
    assert.equal(stillWorks.episode_end_reason, 'VOLUNTARY_LEAVE', 'and still writes the reason the broader vocabulary now permits');
    await identity('postgres');

    stage = 'forward safety: a real regression is still refused';
    for (const [reason, plant, refuses] of [
      ['the per-episode uniqueness 0083 owns is dropped',
        `ALTER TABLE ${LEAVE_COMMANDS} DROP CONSTRAINT shared_world_voluntary_leave_commands_episode_key`,
        /shared_world_voluntary_leave_commands_episode_key/u],
      ['a foreign key 0083 owns stops being restrictive',
        `ALTER TABLE ${LEFT_EVENTS} DROP CONSTRAINT shared_world_member_left_events_actor_fk,
         ADD CONSTRAINT shared_world_member_left_events_actor_fk FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE CASCADE`,
        /shared_world_member_left_events_actor_fk/u],
      ['a permanent (World, human) key would forbid a future rejoin from leaving again',
        `ALTER TABLE ${LEFT_EVENTS} ADD CONSTRAINT ${probe}_pair_key UNIQUE (world_id, actor_user_id)`,
        /future episode in the same World/u],
      ['the additive end_reason is dropped',
        `ALTER TABLE ${EPISODES} DROP COLUMN end_reason`,
        /end_reason/u],
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

async function provisionHumans(ids) {
  await identity('postgres');
  await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [ids]);
}

async function removeFixtures(humans) {
  await identity('postgres');
  const worldIds = (await rows(`SELECT DISTINCT ep.world_id FROM ${EPISODES} ep WHERE ep.user_id = ANY($1::uuid[])`, [humans]))
    .map((row) => row.world_id);
  await q(`DELETE FROM ${CONSENT_EVENTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
  await q(`DELETE FROM ${CEILING} WHERE grant_id IN (SELECT id FROM ${GRANTS} WHERE world_id = ANY($1::uuid[]))`, [worldIds]);
  await q(`DELETE FROM ${GRANTS} WHERE world_id = ANY($1::uuid[])`, [worldIds]);
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
    inviter: randomUUID(), target: randomUUID(), secondTarget: randomUUID(), thirdTarget: randomUUID(), outsider: randomUUID(),
    equalityTarget: randomUUID(), equalitySecond: randomUUID(), forwardTarget: randomUUID(),
  };
  f.humans = [f.inviter, f.target, f.secondTarget, f.thirdTarget, f.outsider,
    f.equalityTarget, f.equalitySecond, f.forwardTarget];
  // Committed fixtures for the multi-connection races, removed afterwards.
  const c = {
    inviter: randomUUID(), targetA: randomUUID(), targetB: randomUUID(), targetC: randomUUID(),
    targetD: randomUUID(), targetE: randomUUID(), worlds: {},
  };
  c.humans = [c.inviter, c.targetA, c.targetB, c.targetC, c.targetD, c.targetE];
  try {
    await client.connect();
    await verifyCatalog();
    await q('BEGIN');
    try {
      await verifyDirectTableAcl();
      await verifyFunctionAcl();
      // Fixture humans are provisioned the canonical way (auth.users -> the
      // migration-0002 trigger -> public.users), and every World is born through
      // the frozen I-04A / I-04B commands, never by a direct insert.
      await provisionHumans(f.humans);
      const departed = await verifyLeave(f);
      await verifyUnavailable(f, departed);
      const finalCommand = await verifyAudience(f, departed);
      const granted = await verifyGrants(f);
      await verifyStaleness(f, granted);
      await verifyIdempotency(f, departed, finalCommand);
      await verifyCrossDomainIdentityEquality(f);
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
        for (const [key, target] of [['identical', c.targetA], ['contested', c.targetB], ['both', c.targetC],
          ['grantFirst', c.targetD], ['leaveFirst', c.targetE]]) {
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
            + (SELECT count(*) FROM ${GRANTS} WHERE grantor_user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${CONSENT_EVENTS} WHERE world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${EPISODES} WHERE user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($2::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
      [humans, bornWorlds]);
    assert.equal(Number(n), 0, 'no fixture row remains after completion');
    console.log('Verified migration 0083: the canonical membership episode gained exactly one ADDITIVE nullable end_reason while every column, check, foreign key and the one-open-episode partial unique index migration 0075 owns stayed unchanged, and no constraint freezes the set of future end reasons; shared_world_member_left_events and shared_world_voluntary_leave_commands exist once with the exact columns, uniqueness per EPISODE and per EVENT rather than any permanent (world, user) key that would forbid a future rejoin, seven restrictive foreign keys, RLS on, zero policies, no trigger and no owner/admin/survivor/payload column, and no direct privilege for PUBLIC/anon/authenticated/service_role; commit_shared_world_standard_voluntary_leave_v1 is a postgres-owned SECURITY DEFINER, search_path-pinned, VOLATILE primitive that PUBLIC, anon, authenticated AND service_role all cannot execute - the frozen Launch Gate precondition is not implemented, so the leave core stays non-application-executable and migration 0083 grants EXECUTE to nobody at all; it accepts exactly three opaque uuid identities with the IN and TABLE argument arrays derived by PostgreSQL rather than partitioned client-side, with no actor, target, episode, reason, audience, count or clock parameter, and derives the leaving human from auth.uid(); a valid unilateral leave closes exactly that human own open episode IN PLACE with end_reason VOLUNTARY_LEAVE, appends exactly one MEMBER_LEFT fact and one durable command - with ended_at, occurred_at and committed_at proven equal in SQL to ONE database-owned instant - deletes no membership row, rewrites no joined_at, and leaves the World exactly ACTIVE/STANDARD with no closure moment; an outsider, an already-departed human, a nonexistent World and all three non-ACTIVE/STANDARD states reach the one bounded non-enumerating class that names nobody, and no paired-phase exit is invented; the frozen 0079 resolver then reports two humans, then only the survivor, then a successful EMPTY - the canonical inert zero-active-human state, with the World neither closed, deleted nor converted and both historical episodes preserved; a valid current Standing Context Grant SURVIVES its grantor leaving with its status, every column and every audience-ceiling row unchanged and no consent event appended, no trigger couples membership to Standing Context state in either direction, explicit revoke still works after leaving, and a NEW grant after leaving fails only under I-03C own unchanged current-membership rule; an equivalent retry returns the committed historical result and creates nothing, even once a successor episode exists for the same human, while any different identity under a committed command id is 23505; and against real concurrent connections two identical leaves produce one mutation and the same result to both, two competing commands have exactly one winner, both members may leave in sequence to reach zero active humans, a grant before a leave survives it while a grant after a leave fails closed, the World-first lock order produced no deadlock, and no orphan or incoherent row remains; zero fixture residue.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Standard voluntary leave verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
