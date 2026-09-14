// Real-PostgreSQL verifier for migration 0082 - Direct Invitation Acceptance
// Transaction Core + Atomic ACTIVE/STANDARD Shared World Birth v1 (I-04B).
//
// Runs against a fully migrated database and proves, from live catalogs and live
// behaviour rather than from the migration text:
//
//   * schema: shared_world_direct_birth_events and
//     shared_world_direct_acceptance_commands exist exactly once, owned by
//     postgres, with the exact columns / types / nullability, the exact unique
//     bindings (one World per birth event, one invitation per birth event, one
//     invitation / World / episode per committed acceptance), restrictive
//     foreign keys into users, the 0075 World and membership tables and the
//     0081 invitation table, RLS on, zero policies, no trigger and no owner /
//     admin / role / payload column;
//   * THE PRE-LAUNCH SECURITY BOUNDARY: the birth core is owned by postgres,
//     SECURITY DEFINER, search_path-pinned and VOLATILE, and is executable by
//     NO application role - PUBLIC, anon, authenticated and service_role are all
//     denied in the catalog AND by an actual 42501 - because the frozen
//     system-policy / launch-gate precondition is not implemented yet;
//   * exact-target human authority: the function accepts no acceptor / actor /
//     target parameter, derives the human from auth.uid(), and a birth commits
//     only when auth.uid() IS the invitation's persisted target;
//   * the atomic birth: exactly one ACTIVE / STANDARD / ACCEPTED_INVITATION
//     World with a NULL closure, exactly two open membership episodes for
//     exactly the inviter and the target, exactly one direct birth event, the
//     invitation ACCEPTED, one durable command row - and all six persisted
//     moments equal to ONE database-owned instant, compared in SQL at full
//     precision rather than through a millisecond JavaScript Date;
//   * every refusal creates no World: a non-target caller, an unrelated human,
//     a NULL auth.uid(), an INVALIDATED / DECLINED / CANCELLED / EXPIRED /
//     already-ACCEPTED invitation, a stale bound credential epoch, an absent
//     credential state and a nonexistent invitation id all fail through one
//     bounded non-enumerating class that names no human;
//   * idempotency: an equivalent retry returns the same World and creates no
//     second episode, event or command row; a reused command id with any
//     different identity is 23505; an invitation can never bind to a second
//     command or a second World;
//   * identity collisions roll the WHOLE birth back: a taken World id or a taken
//     membership-episode id leaves no World, no episode, no birth event, no
//     command row and a still-PENDING invitation;
//   * concurrency, with committed fixtures and extra connections: two identical
//     acceptances produce one birth and the same result to both; two different
//     commands racing one invitation produce exactly one winner; acceptance
//     before rotation leaves the born World intact and the ACCEPTED invitation
//     untouched by the later rotation; rotation before acceptance births
//     nothing; a World-id collision and an episode-id collision across
//     different invitations each roll back atomically; and the credential-first
//     lock order makes every one of these resolve without a deadlock;
//   * no hidden Personal truth: no Standing Context Grant, conversation,
//     Memory, hypothesis or any other Personal row changes across the whole run;
//   * zero fixture residue after completion.
//
// Nothing here weakens an ACL. Application roles are used only to prove denial
// and to drive the frozen I-04A commands that build the fixtures; the birth core
// itself is invoked as the database owner with the exact human's JWT claim set,
// which is precisely how a later launch-gated wrapper must preserve auth.uid().
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
const OWN_TABLES = [BIRTH_EVENTS, ACCEPTANCE_COMMANDS];
const SEALED_TABLES = [WORLDS, EPISODES, CREDENTIAL, INVITATIONS, INVITE_COMMANDS];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
const BIRTH_FN = 'public.commit_shared_world_direct_acceptance_birth_v1(uuid,uuid,uuid,uuid,uuid)';

const INSUFFICIENT_PRIVILEGE = ['42501'];
const INVALID_PARAMETER = ['22023'];
const NOT_ACCEPTABLE = ['P0002'];
const CONFLICT = ['23505'];

const BIRTH_SQL = `SELECT outcome, command_id, accepted_invitation_id, born_world_id, world_lifecycle, world_phase, world_birth_basis
                     FROM public.commit_shared_world_direct_acceptance_birth_v1($1,$2,$3,$4,$5)`;
const ROTATE_SQL = 'SELECT command_id, credential_epoch FROM public.rotate_shared_world_invite_credential_v1($1,$2,$3)';
const SUBMIT_SQL = 'SELECT outcome, command_id, requested_invitation_id FROM public.submit_shared_world_direct_invitation_v1($1,$2,$3)';
const birth = (commandId, invitationId, worldId, inviterEpisode, targetEpisode) =>
  rows(BIRTH_SQL, [commandId, invitationId, worldId, inviterEpisode, targetEpisode]);
/** A synthetic opaque reference. The human-facing credential format is not frozen, so this invents none. */
const opaqueRef = (label) => `ref:i04b:${label}:${randomUUID()}`;

const BIRTH_EVENT_COLUMNS = [
  ['world_id', 'uuid', 'NO'],
  ['invitation_id', 'uuid', 'NO'],
  ['occurred_at', 'timestamp with time zone', 'NO'],
];
const ACCEPTANCE_COMMAND_COLUMNS = [
  ['id', 'uuid', 'NO'],
  ['actor_user_id', 'uuid', 'NO'],
  ['invitation_id', 'uuid', 'NO'],
  ['world_id', 'uuid', 'NO'],
  ['inviter_membership_episode_id', 'uuid', 'NO'],
  ['target_membership_episode_id', 'uuid', 'NO'],
  ['committed_at', 'timestamp with time zone', 'NO'],
];

/** Tables this slice must not have introduced: no generic event, lifecycle or launch engine. */
const FORBIDDEN_TABLES = [
  'shared_world_events', 'world_events', 'shared_world_event_log', 'shared_world_settings',
  'shared_world_member_invitations', 'shared_world_launch_gates', 'launch_gate_snapshots',
  'feature_flags', 'shared_world_introductions', 'introduction_records',
];

async function snapshot(humans) {
  const [{ role }] = await rows('SELECT current_user AS role');
  await q('RESET ROLE');
  const [counts] = await rows(
    `SELECT (SELECT count(*)::int FROM ${WORLDS}) worlds,
            (SELECT count(*)::int FROM ${EPISODES}) episodes,
            (SELECT count(*)::int FROM ${BIRTH_EVENTS}) births,
            (SELECT count(*)::int FROM ${ACCEPTANCE_COMMANDS}) acceptances,
            (SELECT count(*)::int FROM ${GRANTS}) grants,
            (SELECT count(*)::int FROM public.conversation_sessions) sessions,
            (SELECT count(*)::int FROM public.conversation_turns) turns,
            (SELECT count(*)::int FROM public.memories) memories,
            (SELECT count(*)::int FROM public.hypotheses) hypotheses,
            (SELECT count(*)::int FROM ${INVITATIONS} WHERE inviter_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[])) invitations,
            (SELECT count(*)::int FROM ${INVITATIONS} WHERE target_user_id = ANY($1::uuid[]) AND status='PENDING') pending`,
    [humans],
  );
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  return counts;
}

const personalOf = (counts) => ({
  grants: counts.grants, sessions: counts.sessions, turns: counts.turns,
  memories: counts.memories, hypotheses: counts.hypotheses,
});
const worldOf = (counts) => ({ worlds: counts.worlds, episodes: counts.episodes, births: counts.births, acceptances: counts.acceptances });

// ---------------------------------------------------------------------------

async function verifyCatalog() {
  stage = 'catalog: migration 0082 created exactly its own two tables, once';
  for (const table of OWN_TABLES) {
    const [{ n }] = await rows(
      "SELECT count(*)::int n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace WHERE ns.nspname='public' AND c.relname=$1 AND c.relkind='r'",
      [table.replace('public.', '')]);
    assert.equal(n, 1, `${table} exists exactly once`);
    const [{ owner }] = await rows('SELECT pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.oid = $1::regclass', [table]);
    assert.equal(owner, 'postgres', `${table} is owned by postgres`);
  }
  for (const name of FORBIDDEN_TABLES) {
    const [{ n }] = await rows("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace WHERE ns.nspname='public' AND c.relname=$1", [name]);
    assert.equal(n, 0, `I-04B introduced no ${name}: this slice is the direct birth core only`);
  }

  stage = 'catalog: the columns migration 0082 owns, unchanged';
  // FORWARD SAFETY (I-04C): what 0082 OWNS, asserted as a PREFIX rather than as a
  // census of the live schema. A drop, a type or nullability change or a reorder
  // still fails; a later reviewed slice may append a column - which is exactly
  // what I-04C's additive `end_reason` does to the canonical episode. The shape
  // bans below keep scanning EVERY column, future ones included.
  for (const [table, expected] of [[BIRTH_EVENTS, BIRTH_EVENT_COLUMNS], [ACCEPTANCE_COMMANDS, ACCEPTANCE_COMMAND_COLUMNS]]) {
    const observed = await rows(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table.replace('public.', '')]);
    const shape = observed.map((r) => [r.column_name, r.data_type, r.is_nullable]);
    assert.deepEqual(shape.slice(0, expected.length), expected,
      `${table} still carries every column migration 0082 owns, unchanged and in its original position`);
    for (const [name] of expected) {
      assert.equal(shape.filter((column) => column[0] === name).length, 1, `${table}.${name} appears exactly once`);
    }
    // Initiating creates no superior authority, and a birth fact is not a payload.
    for (const column of observed.map((r) => r.column_name)) {
      assert.doesNotMatch(column, /owner|admin|creator|initiator|privilege|role|capability|payload|metadata|scope|permission|topic|avatar|setting/iu,
        `${table}.${column}: birth creates no owner or admin and the birth fact is not a generic engine`);
    }
    for (const type of observed.map((r) => r.data_type)) {
      assert.doesNotMatch(type, /json|ARRAY/iu, `${table} stores no JSON payload`);
    }
  }

  stage = 'catalog: the exact unique bindings and restrictive foreign keys';
  // Constraint definitions and regclass names are rendered against the session
  // search_path, so the schema prefix is normalized away rather than assumed,
  // and every result set is sorted in JavaScript rather than by the server.
  const bare = (table) => table.replace('public.', '');
  const normalize = (def) => def.replace(/REFERENCES (?:public\.)?/u, 'REFERENCES ');
  const uniques = await rows(
    `SELECT c.conrelid::regclass::text AS tbl, pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c WHERE c.conrelid = ANY($1::regclass[]) AND c.contype IN ('p','u')`,
    [OWN_TABLES]);
  // Every uniqueness constraint 0082 OWNS is still present and still means what
  // it meant; a later reviewed slice may add its own.
  const liveUniques = new Set(uniques.map((r) => `${bare(r.tbl)} ${r.def}`));
  for (const owned of [
    `${bare(ACCEPTANCE_COMMANDS)} PRIMARY KEY (id)`,
    `${bare(ACCEPTANCE_COMMANDS)} UNIQUE (inviter_membership_episode_id)`,
    `${bare(ACCEPTANCE_COMMANDS)} UNIQUE (invitation_id)`,
    `${bare(ACCEPTANCE_COMMANDS)} UNIQUE (target_membership_episode_id)`,
    `${bare(ACCEPTANCE_COMMANDS)} UNIQUE (world_id)`,
    `${bare(BIRTH_EVENTS)} PRIMARY KEY (world_id)`,
    `${bare(BIRTH_EVENTS)} UNIQUE (invitation_id)`,
  ]) {
    assert.ok(liveUniques.has(owned), `still enforced: ${owned} - one World and one invitation per birth, one of each identity per committed acceptance`);
  }

  const foreignKeys = await rows(
    `SELECT c.conrelid::regclass::text AS tbl, pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c WHERE c.conrelid = ANY($1::regclass[]) AND c.contype = 'f'`,
    [OWN_TABLES]);
  assert.equal(foreignKeys.length, 7, 'exactly seven foreign keys: two from the birth event, five from the acceptance command');
  for (const { tbl, def } of foreignKeys) {
    assert.match(def, /ON DELETE RESTRICT$/u, `${tbl} ${def}: birth history is never silently cascaded away`);
  }
  const liveForeignKeys = new Set(foreignKeys.map((r) => `${bare(r.tbl)} ${normalize(r.def)}`));
  for (const owned of [
    `${bare(ACCEPTANCE_COMMANDS)} FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT`,
    `${bare(ACCEPTANCE_COMMANDS)} FOREIGN KEY (inviter_membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT`,
    `${bare(ACCEPTANCE_COMMANDS)} FOREIGN KEY (invitation_id) REFERENCES shared_world_direct_invitations(id) ON DELETE RESTRICT`,
    `${bare(ACCEPTANCE_COMMANDS)} FOREIGN KEY (target_membership_episode_id) REFERENCES shared_world_membership_episodes(id) ON DELETE RESTRICT`,
    `${bare(ACCEPTANCE_COMMANDS)} FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT`,
    `${bare(BIRTH_EVENTS)} FOREIGN KEY (invitation_id) REFERENCES shared_world_direct_invitations(id) ON DELETE RESTRICT`,
    `${bare(BIRTH_EVENTS)} FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT`,
  ]) {
    assert.ok(liveForeignKeys.has(owned), `still bound to the canonical row: ${owned}`);
  }

  stage = 'catalog: RLS on, zero policies, no trigger';
  for (const table of OWN_TABLES) {
    const [{ rls }] = await rows('SELECT c.relrowsecurity rls FROM pg_class c WHERE c.oid = $1::regclass', [table]);
    assert.equal(rls, true, `${table} has row level security enabled`);
    const [{ n: policies }] = await rows('SELECT count(*)::int n FROM pg_policy WHERE polrelid = $1::regclass', [table]);
    assert.equal(policies, 0, `${table} carries zero RLS policies`);
    const [{ n: triggers }] = await rows('SELECT count(*)::int n FROM pg_trigger WHERE tgrelid = $1::regclass AND NOT tgisinternal', [table]);
    assert.equal(triggers, 0, `${table} carries no trigger`);
  }

  stage = 'catalog: the two commands are pinned SECURITY DEFINER, and the birth core is caller-identity-free';
  // PostgreSQL itself derives the IN and OUT/TABLE name arrays, preserving its
  // own subscript alignment. They are NOT partitioned client-side:
  // pg_proc.proargmodes is a `"char"[]`, which node-postgres has no parser for
  // and hands back as the raw literal `{i,i,i,i,i,t,...}`, so indexing it from
  // JavaScript reads characters rather than modes and misclassifies RETURNS
  // TABLE columns as input parameters. proargtypes stays the authority for the
  // IN argument types.
  const [fn] = await rows(
    `SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc,
            pg_get_userbyid(pr.proowner) AS owner,
            ARRAY(SELECT pr.proargnames[s.i]
                    FROM generate_subscripts(pr.proargnames, 1) AS s(i)
                   WHERE pr.proargmodes[s.i] = 'i'::"char"
                   ORDER BY s.i) AS in_names,
            ARRAY(SELECT pr.proargnames[s.i]
                    FROM generate_subscripts(pr.proargnames, 1) AS s(i)
                   WHERE pr.proargmodes[s.i] IN ('o'::"char", 't'::"char")
                   ORDER BY s.i) AS out_names,
            (SELECT array_agg(t.typname::text ORDER BY a.ord)
               FROM unnest(pr.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
               JOIN pg_type t ON t.oid = a.argtype) AS in_types
       FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [BIRTH_FN]);
  assert.equal(fn.owner, 'postgres', 'the birth core is owned by postgres');
  assert.equal(fn.prosecdef, true, 'the birth core is SECURITY DEFINER');
  assert.equal(fn.provolatile, 'v', 'the birth core is a mutation and is VOLATILE');
  assert.ok((fn.proconfig ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'), 'the birth core pins an empty search_path');
  // pg_proc.proargtypes holds the IN argument types and nothing else, so it is
  // the authority. A rendered signature is not: pg_get_function_arguments folds
  // this function's RETURNS TABLE columns into the same string.
  assert.deepEqual(fn.in_types, ['uuid', 'uuid', 'uuid', 'uuid', 'uuid'], 'every supplied identity is an opaque uuid');
  assert.deepEqual(fn.in_names,
    ['p_command_id', 'p_invitation_id', 'p_world_id', 'p_inviter_membership_episode_id', 'p_target_membership_episode_id'],
    'the birth core accepts exactly the five opaque persistence identities and no acceptor, actor or target');
  for (const name of fn.in_names) {
    assert.doesNotMatch(name, /user_id|acceptor|actor|status|epoch|basis|lifecycle|phase|timestamp|_at$/iu,
      `${name}: no caller-supplied identity, status, epoch or clock`);
  }
  assert.deepEqual(fn.out_names,
    ['outcome', 'command_id', 'accepted_invitation_id', 'born_world_id', 'world_lifecycle', 'world_phase', 'world_birth_basis'],
    'the committed result is bounded and carries no human identity');

  stage = 'catalog: the "char"[] decoding class is locked, so the argument split can never move back into JavaScript';
  // A regression proof, not a restatement: it shows that the naive client-side
  // partition really does produce the wrong answer against this exact function
  // on real PostgreSQL through this exact driver.
  const [raw] = await rows(
    `SELECT pr.proargnames AS names, pr.proargmodes AS modes, pg_typeof(pr.proargmodes)::text AS modes_type
       FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [BIRTH_FN]);
  assert.equal(raw.modes_type, '"char"[]', 'argument modes are a "char"[] in the catalog');
  assert.ok(Array.isArray(raw.names), 'proargnames is a text[] and the driver decodes it as an array');
  if (Array.isArray(raw.modes)) {
    // The driver grew a parser. The hazard is gone, but the split stays in SQL.
    assert.deepEqual(raw.names.filter((_name, index) => raw.modes[index] === 'i'), fn.in_names);
  } else {
    const naive = raw.names.filter((_name, index) => raw.modes[index] === 'i');
    assert.notDeepEqual(naive, fn.in_names,
      'partitioning proargnames client-side by an unparsed "char"[] is provably wrong here, which is why PostgreSQL derives both arrays');
    assert.ok(naive.includes('outcome'),
      'and it misclassifies a RETURNS TABLE column as an input parameter - exactly the defect this proof locks out');
  }
  assert.match(fn.prosrc, /auth\.uid\(\)/u, 'the accepting human is derived from auth.uid()');
  assert.doesNotMatch(fn.prosrc, /conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|matching|introduction/iu,
    'the birth core reads no Personal context and creates no Standing Context, Matching or Introduction state');
  assert.doesNotMatch(fn.prosrc, /DELETE FROM|TRUNCATE/iu, 'the birth core deletes no canonical history');
  assert.doesNotMatch(fn.prosrc, /pg_advisory|LOCK TABLE/iu, 'the birth core takes row locks only');
  assert.doesNotMatch(fn.prosrc, /READ_ONLY_CLOSED|MUTUAL_MATCH/u, 'the direct birth core creates no other lifecycle or birth basis');
  assert.doesNotMatch(fn.prosrc, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u, 'every persisted moment is the ONE captured instant');
  assert.equal((fn.prosrc.match(/FOR UPDATE/gu) ?? []).length, 2, 'exactly two row locks: the credential state and the exact invitation');
  assert.equal((fn.prosrc.match(/birth_at := /gu) ?? []).length, 1, 'the canonical birth instant is captured exactly once');
  // THE CANONICAL LOCK ORDER, from the stored source.
  const credentialAt = fn.prosrc.indexOf('FROM public.shared_world_invite_credential_state s');
  const invitationAt = fn.prosrc.indexOf('FROM public.shared_world_direct_invitations i');
  const worldAt = fn.prosrc.indexOf('INSERT INTO public.shared_worlds');
  const episodeAt = fn.prosrc.indexOf('INSERT INTO public.shared_world_membership_episodes');
  assert.ok(credentialAt > 0 && invitationAt > credentialAt && worldAt > invitationAt && episodeAt > worldAt,
    'the canonical lock order is credential state, then the exact invitation, then the birth writes');
  const [{ n: overloads }] = await rows(
    `SELECT count(*)::int n FROM pg_proc pr JOIN pg_namespace ns ON ns.oid = pr.pronamespace
      WHERE ns.nspname='public' AND pr.proname='commit_shared_world_direct_acceptance_birth_v1'`);
  assert.equal(overloads, 1, 'exactly one birth core exists, with one overload');
}

async function verifyDirectTableAcl() {
  stage = 'ACL: no application role holds direct CRUD on the birth tables, and the whole Shared substrate stays sealed';
  for (const table of [...OWN_TABLES, ...SEALED_TABLES]) {
    const [{ publicAcl }] = await rows(
      'SELECT EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) a WHERE c.oid = $1::regclass AND a.grantee = 0) AS "publicAcl"', [table]);
    assert.equal(publicAcl, false, `PUBLIC holds no privilege on ${table}`);
    for (const role of APPLICATION_ROLES) {
      for (const privilege of PRIVILEGES) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} must hold no ${privilege} on ${table}`);
      }
    }
  }
  // Catalog denial is proven by an actual refusal, not only by the grant tables.
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
  stage = 'THE PRE-LAUNCH BOUNDARY: the birth core is executable by no application role';
  const [{ allowed: publicExecute }] = await rows("SELECT has_function_privilege('public', $1, 'EXECUTE') AS allowed", [BIRTH_FN]);
  assert.equal(publicExecute, false, 'PUBLIC cannot execute the birth core');
  for (const role of APPLICATION_ROLES) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, BIRTH_FN, 'EXECUTE']);
    assert.equal(allowed, false, `${role} cannot execute the birth core before the launch gate exists`);
  }
  // And the denial is real, not only a catalog fact. service_role in particular
  // must never be able to manufacture a human acceptance.
  for (const role of APPLICATION_ROLES) {
    await identity(role, randomUUID());
    const error = await rejected(() => birth(randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()), INSUFFICIENT_PRIVILEGE);
    assert.match(error.message, /permission denied/iu, `${role} is refused execution outright`);
  }
  await identity('postgres');
}

/** Builds a PENDING invitation through the frozen I-04A commands only. */
async function provisionInvitation(inviter, target, label) {
  const ref = opaqueRef(label);
  await identity('authenticated', target);
  await rows(ROTATE_SQL, [randomUUID(), ref, null]);
  await identity('authenticated', inviter);
  const invitationId = randomUUID();
  await rows(SUBMIT_SQL, [randomUUID(), invitationId, ref]);
  await identity('postgres');
  return { invitationId, ref };
}

async function verifyBirth(f) {
  stage = 'birth: a valid exact-target acceptance atomically creates ACTIVE / STANDARD';
  const before = await snapshot(f.humans);
  const { invitationId } = await provisionInvitation(f.inviter, f.target, 'birth');
  const [{ epoch: boundEpoch }] = await rows(`SELECT target_credential_epoch epoch FROM ${INVITATIONS} WHERE id=$1`, [invitationId]);
  assert.equal(Number(boundEpoch), 1, 'the invitation bound the target current credential epoch');

  // The owner invokes the internal primitive while the EXACT human target's JWT
  // claim is set - exactly what a later launch-gated wrapper must preserve.
  await identity('postgres', f.target);
  const command = { id: randomUUID(), world: randomUUID(), inviterEpisode: randomUUID(), targetEpisode: randomUUID() };
  const [born] = await birth(command.id, invitationId, command.world, command.inviterEpisode, command.targetEpisode);
  assert.deepEqual(Object.keys(born).sort(),
    ['accepted_invitation_id', 'born_world_id', 'command_id', 'outcome', 'world_birth_basis', 'world_lifecycle', 'world_phase'].sort());
  assert.equal(born.outcome, 'BORN');
  assert.equal(born.command_id, command.id);
  assert.equal(born.accepted_invitation_id, invitationId);
  assert.equal(born.born_world_id, command.world);
  assert.equal(born.world_lifecycle, 'ACTIVE');
  assert.equal(born.world_phase, 'STANDARD');
  assert.equal(born.world_birth_basis, 'ACCEPTED_INVITATION');
  // The committed result carries no human identity of any kind.
  const serialized = JSON.stringify(born);
  for (const secret of [f.inviter, f.target, f.outsider]) assert.ok(!serialized.includes(secret), 'the birth result reveals no human');

  await identity('postgres');
  stage = 'birth: exactly one ACTIVE / STANDARD / ACCEPTED_INVITATION World with no closure moment';
  const [world] = await rows(`SELECT * FROM ${WORLDS} WHERE id=$1`, [command.world]);
  assert.ok(world, 'exactly one Shared World was created');
  assert.equal(world.lifecycle, 'ACTIVE');
  assert.equal(world.phase, 'STANDARD');
  assert.equal(world.birth_basis, 'ACCEPTED_INVITATION');
  assert.equal(world.closed_at, null, 'a born World carries no closure moment');

  stage = 'birth: membership is exactly the inviter and the exact accepting target, both open';
  const episodes = await rows(`SELECT * FROM ${EPISODES} WHERE world_id=$1`, [command.world]);
  assert.equal(episodes.length, 2, 'exactly two membership episodes - no third human and no system member');
  const byUser = new Map(episodes.map((e) => [e.user_id, e]));
  assert.deepEqual([...byUser.keys()].sort(), [f.inviter, f.target].sort(), 'exactly the inviter and the exact accepting target');
  assert.equal(byUser.get(f.inviter).id, command.inviterEpisode, 'the inviter episode carries the supplied identity');
  assert.equal(byUser.get(f.target).id, command.targetEpisode, 'the target episode carries the supplied identity');
  for (const episode of episodes) assert.equal(episode.ended_at, null, 'both birth episodes are open');
  const [{ n: elsewhere }] = await rows(`SELECT count(*)::int n FROM ${EPISODES} WHERE world_id <> $1 AND user_id = ANY($2::uuid[])`, [command.world, f.humans]);
  assert.equal(elsewhere, 0, 'no membership episode was created in any other World');

  stage = 'birth: one direct WORLD_BIRTH, the invitation ACCEPTED, one durable command';
  const [event] = await rows(`SELECT * FROM ${BIRTH_EVENTS} WHERE world_id=$1`, [command.world]);
  assert.ok(event, 'exactly one direct birth event exists');
  assert.equal(event.invitation_id, invitationId, 'the birth event names the invitation that sourced it');
  const [invitation] = await rows(`SELECT * FROM ${INVITATIONS} WHERE id=$1`, [invitationId]);
  assert.equal(invitation.status, 'ACCEPTED', 'the exact invitation is consumed');
  assert.equal(invitation.inviter_user_id, f.inviter, 'the inviter binding is never rewritten');
  assert.equal(invitation.target_user_id, f.target, 'the target binding is never rewritten');
  assert.equal(Number(invitation.target_credential_epoch), 1, 'the bound credential epoch is never rewritten');
  const [acceptance] = await rows(`SELECT * FROM ${ACCEPTANCE_COMMANDS} WHERE id=$1`, [command.id]);
  assert.equal(acceptance.actor_user_id, f.target, 'the durable command records the exact accepting human');
  assert.equal(acceptance.world_id, command.world);
  assert.equal(acceptance.invitation_id, invitationId);

  stage = 'birth: ONE canonical instant, compared in SQL at full precision';
  const [{ coherent }] = await rows(
    `SELECT (w.born_at = e.occurred_at
         AND w.born_at = i.terminal_at
         AND w.born_at = c.committed_at
         AND w.born_at = mi.joined_at
         AND w.born_at = mt.joined_at) AS coherent
       FROM ${WORLDS} w
       JOIN ${BIRTH_EVENTS} e ON e.world_id = w.id
       JOIN ${ACCEPTANCE_COMMANDS} c ON c.world_id = w.id
       JOIN ${INVITATIONS} i ON i.id = c.invitation_id
       JOIN ${EPISODES} mi ON mi.id = c.inviter_membership_episode_id
       JOIN ${EPISODES} mt ON mt.id = c.target_membership_episode_id
      WHERE w.id = $1`, [command.world]);
  assert.equal(coherent, true, 'born_at, both joined_at, occurred_at, terminal_at and committed_at are ONE database-owned instant');
  const [{ database_owned: databaseOwned }] = await rows(
    `SELECT (w.born_at <= clock_timestamp() AND w.born_at > clock_timestamp() - interval '1 hour') AS database_owned FROM ${WORLDS} w WHERE w.id=$1`,
    [command.world]);
  assert.equal(databaseOwned, true, 'the instant came from the database clock, never from a caller');

  stage = 'birth: no hidden Personal truth and no Standing Context authority';
  const after = await snapshot(f.humans);
  assert.deepEqual(personalOf(after), personalOf(before),
    'birth created no Standing Context Grant and changed no conversation, Memory or hypothesis row');
  assert.deepEqual(worldOf(after), { worlds: before.worlds + 1, episodes: before.episodes + 2, births: before.births + 1, acceptances: before.acceptances + 1 },
    'exactly one World, two episodes, one birth event and one acceptance command were created');
  return { invitationId, command };
}

async function verifyTargetAuthority(f) {
  stage = 'authority: only the exact persisted target may accept';
  const before = await snapshot(f.humans);
  const { invitationId } = await provisionInvitation(f.inviter, f.secondTarget, 'authority');
  const attempt = () => birth(randomUUID(), invitationId, randomUUID(), randomUUID(), randomUUID());
  const failures = [];
  // The inviter cannot accept their own invitation on behalf of the target.
  await identity('postgres', f.inviter);
  failures.push(await rejected(attempt, NOT_ACCEPTABLE));
  // An unrelated human cannot accept it.
  await identity('postgres', f.outsider);
  failures.push(await rejected(attempt, NOT_ACCEPTABLE));
  // A nonexistent invitation is the SAME bounded answer.
  await identity('postgres', f.secondTarget);
  failures.push(await rejected(() => birth(randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()), NOT_ACCEPTABLE));
  for (const failure of failures) {
    assert.match(failure.message, /SHARED_DIRECT_INVITATION_NOT_ACCEPTABLE/u, 'one bounded non-enumerating class');
    for (const secret of [f.inviter, f.target, f.secondTarget, f.outsider]) {
      assert.ok(!failure.message.includes(secret), 'the refusal names no human');
    }
    assert.doesNotMatch(failure.message, /pending|accepted|declined|expired|epoch|exists|not found|target|inviter/iu,
      'the refusal never says which case occurred');
  }
  assert.equal(new Set(failures.map((e) => `${e.code}:${e.message}`)).size, 1,
    'a non-target caller, an unrelated human and a nonexistent invitation are indistinguishable');

  stage = 'authority: QANDEEL has no session identity, so it can never accept';
  await identity('postgres', null);
  await rejected(attempt, INSUFFICIENT_PRIVILEGE, /SHARED_DIRECT_ACCEPTANCE_AUTHENTICATION_REQUIRED/u);

  stage = 'authority: a refused attempt creates no World and does not terminalize the invitation';
  await identity('postgres');
  const after = await snapshot(f.humans);
  assert.deepEqual(worldOf(after), worldOf(before), 'no refused attempt created a World, episode, birth event or command row');
  assert.deepEqual(personalOf(after), personalOf(before));
  const [still] = await rows(`SELECT status, terminal_at FROM ${INVITATIONS} WHERE id=$1`, [invitationId]);
  assert.equal(still.status, 'PENDING', 'a wrong-target attempt leaves the invitation PENDING');
  assert.equal(still.terminal_at, null, 'and does not terminalize it');

  stage = 'authority: malformed identities are refused before anything is written';
  await identity('postgres', f.secondTarget);
  const good = [randomUUID(), invitationId, randomUUID(), randomUUID(), randomUUID()];
  for (let index = 0; index < 5; index += 1) {
    const nulled = [...good]; nulled[index] = null;
    await rejected(() => birth(...nulled), INVALID_PARAMETER, /SHARED_DIRECT_ACCEPTANCE_COMMAND_INVALID/u);
  }
  // The supplied identities must be pairwise distinct: an invitation id is never
  // reused as a World id and an episode id is never reused as either.
  await rejected(() => birth(good[0], invitationId, invitationId, good[3], good[4]), INVALID_PARAMETER, /SHARED_DIRECT_ACCEPTANCE_COMMAND_INVALID/u);
  await rejected(() => birth(good[0], invitationId, good[2], good[2], good[4]), INVALID_PARAMETER, /SHARED_DIRECT_ACCEPTANCE_COMMAND_INVALID/u);
  await rejected(() => birth(good[0], invitationId, good[2], good[3], good[3]), INVALID_PARAMETER, /SHARED_DIRECT_ACCEPTANCE_COMMAND_INVALID/u);
  await identity('postgres');
  assert.deepEqual(worldOf(await snapshot(f.humans)), worldOf(before), 'a malformed command wrote nothing');
  return { invitationId };
}

async function verifyStaleAndTerminal(f, pending) {
  stage = 'stale / terminal: no non-PENDING or stale-epoch invitation can ever birth a World';
  const before = await snapshot(f.humans);
  // Every terminal status, built directly because I-04A owns no decline / cancel
  // / expire command yet: this proves the acceptance guard, not those commands.
  const terminal = [];
  for (const status of ['DECLINED', 'CANCELLED', 'EXPIRED', 'INVALIDATED', 'ACCEPTED']) {
    const id = randomUUID();
    await q(`INSERT INTO ${INVITATIONS}(id, inviter_user_id, target_user_id, target_credential_epoch, status, terminal_at)
             VALUES ($1,$2,$3,1,$4,CURRENT_TIMESTAMP)`, [id, f.inviter, f.secondTarget, status]);
    terminal.push([status, id]);
  }
  // A PENDING invitation bound to an epoch the target has since left behind.
  // This state is not canonically reachable through rotation (which invalidates
  // such rows), so it is constructed directly to prove the epoch guard is real.
  // It uses its OWN human, because rotating any other target here would
  // invalidate that target's still-PENDING invitation as a side effect.
  await identity('authenticated', f.staleTarget);
  await rows(ROTATE_SQL, [randomUUID(), opaqueRef('staleFirst'), null]);
  const [rotated] = await rows(ROTATE_SQL, [randomUUID(), opaqueRef('staleSecond'), 1]);
  assert.equal(Number(rotated.credential_epoch), 2, 'the stale-epoch fixture target is now at epoch 2');
  await identity('postgres');
  const staleEpoch = randomUUID();
  await q(`INSERT INTO ${INVITATIONS}(id, inviter_user_id, target_user_id, target_credential_epoch, status)
           VALUES ($1,$2,$3,1,'PENDING')`, [staleEpoch, f.inviter, f.staleTarget]);
  // A target who never established credential state at all.
  const noCredential = randomUUID();
  await q(`INSERT INTO ${INVITATIONS}(id, inviter_user_id, target_user_id, target_credential_epoch, status)
           VALUES ($1,$2,$3,1,'PENDING')`, [noCredential, f.inviter, f.outsider]);

  const failures = [];
  await identity('postgres', f.secondTarget);
  for (const [status, id] of terminal) {
    const error = await rejected(() => birth(randomUUID(), id, randomUUID(), randomUUID(), randomUUID()), NOT_ACCEPTABLE);
    failures.push([status, error]);
  }
  await identity('postgres', f.staleTarget);
  failures.push(['STALE_EPOCH', await rejected(() => birth(randomUUID(), staleEpoch, randomUUID(), randomUUID(), randomUUID()), NOT_ACCEPTABLE)]);
  await identity('postgres', f.outsider);
  failures.push(['NO_CREDENTIAL', await rejected(() => birth(randomUUID(), noCredential, randomUUID(), randomUUID(), randomUUID()), NOT_ACCEPTABLE)]);
  await identity('postgres');
  for (const [label, error] of failures) {
    assert.match(error.message, /SHARED_DIRECT_INVITATION_NOT_ACCEPTABLE/u, `${label} is the bounded class`);
  }
  assert.equal(new Set(failures.map(([, e]) => `${e.code}:${e.message}`)).size, 1,
    'every terminal status, a stale epoch and an absent credential state are indistinguishable');
  const after = await snapshot(f.humans);
  assert.deepEqual(worldOf(after), worldOf(before), 'no stale or terminal invitation created a World, episode, birth event or command');
  const revived = await rows(`SELECT status FROM ${INVITATIONS} WHERE id = ANY($1::uuid[])`, [terminal.map(([, id]) => id)]);
  assert.deepEqual(revived.map((r) => r.status).sort(), ['ACCEPTED', 'CANCELLED', 'DECLINED', 'EXPIRED', 'INVALIDATED'],
    'no terminal invitation was revived');
  // And the still-PENDING invitation from the authority proof is untouched.
  const [{ status }] = await rows(`SELECT status FROM ${INVITATIONS} WHERE id=$1`, [pending.invitationId]);
  assert.equal(status, 'PENDING');
}

async function verifyIdempotency(f, existing) {
  stage = 'idempotency: an equivalent retry returns the same World and creates nothing new';
  const before = await snapshot(f.humans);
  await identity('postgres', f.target);
  const [again] = await birth(existing.command.id, existing.invitationId, existing.command.world,
    existing.command.inviterEpisode, existing.command.targetEpisode);
  assert.equal(again.outcome, 'BORN');
  assert.equal(again.born_world_id, existing.command.world, 'an equivalent retry returns the committed World');
  assert.equal(again.world_lifecycle, 'ACTIVE');
  assert.equal(again.world_phase, 'STANDARD');
  assert.equal(again.world_birth_basis, 'ACCEPTED_INVITATION');

  stage = 'idempotency: a reused command id with ANY different identity fails closed';
  for (const variant of [
    [randomUUID(), existing.command.world, existing.command.inviterEpisode, existing.command.targetEpisode],
    [existing.invitationId, randomUUID(), existing.command.inviterEpisode, existing.command.targetEpisode],
    [existing.invitationId, existing.command.world, randomUUID(), existing.command.targetEpisode],
    [existing.invitationId, existing.command.world, existing.command.inviterEpisode, randomUUID()],
  ]) {
    await rejected(() => birth(existing.command.id, ...variant), CONFLICT, /SHARED_DIRECT_ACCEPTANCE_COMMAND_ID_CONFLICT/u);
  }
  // A different human may not adopt a committed command id either.
  await identity('postgres', f.inviter);
  await rejected(() => birth(existing.command.id, existing.invitationId, existing.command.world,
    existing.command.inviterEpisode, existing.command.targetEpisode), CONFLICT, /SHARED_DIRECT_ACCEPTANCE_COMMAND_ID_CONFLICT/u);

  stage = 'idempotency: a later legitimate lifecycle closure does not change the historical retry result';
  // A direct World is born ACTIVE / STANDARD, but a later reviewed lifecycle
  // slice may close the same stable world id (CW2-03 section 31). That must not
  // make an already-committed birth command answer differently. The closure is
  // applied here as a fixture through the database owner ONLY - I-04B implements
  // no close command and this proves nothing about how closure will work.
  await identity('postgres');
  await q(`UPDATE ${WORLDS} SET lifecycle='READ_ONLY_CLOSED', closed_at = born_at WHERE id=$1`, [existing.command.world]);
  const [closed] = await rows(`SELECT lifecycle, closed_at FROM ${WORLDS} WHERE id=$1`, [existing.command.world]);
  assert.equal(closed.lifecycle, 'READ_ONLY_CLOSED', 'the fixture closure applied');
  const beforeClosedRetry = await snapshot(f.humans);
  await identity('postgres', f.target);
  const [afterClosure] = await birth(existing.command.id, existing.invitationId, existing.command.world,
    existing.command.inviterEpisode, existing.command.targetEpisode);
  assert.deepEqual(afterClosure, again,
    'the retry returns exactly what the command committed, byte for byte, after the World was closed');
  assert.equal(afterClosure.world_lifecycle, 'ACTIVE', 'the historical birth result stays ACTIVE even though the World is now closed');
  assert.equal(afterClosure.world_phase, 'STANDARD');
  assert.equal(afterClosure.world_birth_basis, 'ACCEPTED_INVITATION');
  assert.equal(afterClosure.outcome, 'BORN');
  await identity('postgres');
  const [stillClosed] = await rows(`SELECT lifecycle, closed_at FROM ${WORLDS} WHERE id=$1`, [existing.command.world]);
  assert.equal(stillClosed.lifecycle, 'READ_ONLY_CLOSED', 'and the retry neither reopened nor mutated the World');
  assert.equal(stillClosed.closed_at.getTime(), closed.closed_at.getTime());
  assert.deepEqual(worldOf(await snapshot(f.humans)), worldOf(beforeClosedRetry),
    'the retry after closure created no World, episode, birth event or command row');
  // Put the fixture back, so the rest of this run sees the canonical born state.
  await q(`UPDATE ${WORLDS} SET lifecycle='ACTIVE', closed_at = NULL WHERE id=$1`, [existing.command.world]);

  stage = 'idempotency: one invitation can never bind to a second command or a second World';
  await identity('postgres', f.target);
  await rejected(() => birth(randomUUID(), existing.invitationId, randomUUID(), randomUUID(), randomUUID()),
    NOT_ACCEPTABLE, /SHARED_DIRECT_INVITATION_NOT_ACCEPTABLE/u);
  await identity('postgres');
  const after = await snapshot(f.humans);
  assert.deepEqual(worldOf(after), worldOf(before), 'no retry, conflict or second acceptance created another World, episode, event or command');
  const [{ n: worldsFromInvitation }] = await rows(`SELECT count(*)::int n FROM ${BIRTH_EVENTS} WHERE invitation_id=$1`, [existing.invitationId]);
  assert.equal(worldsFromInvitation, 1, 'one direct invitation sourced exactly one World birth');
}

async function verifyIdCollisionRollback(f, existing) {
  stage = 'collision: a taken World id or episode id rolls the WHOLE birth back';
  const before = await snapshot(f.humans);
  const { invitationId } = await provisionInvitation(f.inviter, f.thirdTarget, 'collision');
  await identity('postgres', f.thirdTarget);
  for (const [label, world, inviterEpisode, targetEpisode] of [
    ['a World id already taken', existing.command.world, randomUUID(), randomUUID()],
    ['an inviter episode id already taken', randomUUID(), existing.command.inviterEpisode, randomUUID()],
    ['a target episode id already taken', randomUUID(), randomUUID(), existing.command.targetEpisode],
    ['an episode id taken by the other side', randomUUID(), existing.command.targetEpisode, randomUUID()],
  ]) {
    const error = await rejected(() => birth(randomUUID(), invitationId, world, inviterEpisode, targetEpisode), CONFLICT);
    assert.match(error.message, /SHARED_DIRECT_BIRTH_ID_CONFLICT/u, `${label} is the bounded identity-conflict class`);
    // The bounded answer names neither the colliding identity nor its owner.
    for (const secret of [existing.command.world, existing.command.inviterEpisode, existing.command.targetEpisode, f.inviter, f.target]) {
      assert.ok(!error.message.includes(secret), `${label}: the conflict names no existing row`);
    }
  }
  await identity('postgres');
  const after = await snapshot(f.humans);
  assert.deepEqual(worldOf(after), worldOf(before), 'no collision left a partial World, episode, birth event or command row');
  const [still] = await rows(`SELECT status, terminal_at FROM ${INVITATIONS} WHERE id=$1`, [invitationId]);
  assert.equal(still.status, 'PENDING', 'a collision never leaves the invitation partially ACCEPTED');
  assert.equal(still.terminal_at, null);
  return { invitationId };
}

async function verifyConcurrency(c) {
  const connections = [];
  const open = async () => {
    const extra = new Client({ connectionString: databaseUrl });
    await extra.connect();
    connections.push(extra);
    return extra;
  };
  // The birth core is executable by no application role, so a concurrent caller
  // is the database owner carrying the exact human's claim - the shape a later
  // launch-gated wrapper must preserve.
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

  // A baseline rather than an absolute: this counter is cumulative for the whole
  // database, so what must hold is that THESE races add no deadlock.
  const [{ n: deadlocksBefore }] = await rows(
    'SELECT COALESCE(sum(deadlocks), 0)::int n FROM pg_stat_database WHERE datname = current_database()');

  try {
    const a = await open();
    const b = await open();

    stage = 'concurrency: two IDENTICAL acceptances produce ONE birth and the same result to both';
    const identical = c.invitations.identical;
    const shared = { id: randomUUID(), world: randomUUID(), inviterEpisode: randomUUID(), targetEpisode: randomUUID() };
    await asOwnerFor(a, c.targetA); await asOwnerFor(b, c.targetA);
    const won = await a.query(BIRTH_SQL, [shared.id, identical, shared.world, shared.inviterEpisode, shared.targetEpisode]);
    assert.equal(won.rows[0].outcome, 'BORN');
    const duplicate = b.query(BIRTH_SQL, [shared.id, identical, shared.world, shared.inviterEpisode, shared.targetEpisode]);
    assert.equal(await blocks(duplicate), 'BLOCKED', 'the duplicate queues on the target credential-state row');
    await a.query('COMMIT');
    const duplicateResult = await duplicate;
    assert.deepEqual(duplicateResult.rows[0], won.rows[0], 'both callers receive the SAME committed birth result');
    await b.query('COMMIT');
    const [{ n: worldsBorn }] = await rows(`SELECT count(*)::int n FROM ${WORLDS} WHERE id=$1`, [shared.world]);
    assert.equal(worldsBorn, 1, 'exactly one Shared World was born');
    const [{ n: episodesBorn }] = await rows(`SELECT count(*)::int n FROM ${EPISODES} WHERE world_id=$1`, [shared.world]);
    assert.equal(episodesBorn, 2, 'exactly two membership episodes');
    const [{ n: eventsBorn }] = await rows(`SELECT count(*)::int n FROM ${BIRTH_EVENTS} WHERE world_id=$1`, [shared.world]);
    assert.equal(eventsBorn, 1, 'exactly one direct birth event');
    const [{ n: commandsBorn }] = await rows(`SELECT count(*)::int n FROM ${ACCEPTANCE_COMMANDS} WHERE id=$1`, [shared.id]);
    assert.equal(commandsBorn, 1, 'exactly one durable command row');

    stage = 'concurrency: two DIFFERENT acceptance commands racing one invitation have exactly one winner';
    const contested = c.invitations.contested;
    const winner = { id: randomUUID(), world: randomUUID(), inviterEpisode: randomUUID(), targetEpisode: randomUUID() };
    const loser = { id: randomUUID(), world: randomUUID(), inviterEpisode: randomUUID(), targetEpisode: randomUUID() };
    await asOwnerFor(a, c.targetB); await asOwnerFor(b, c.targetB);
    await a.query(BIRTH_SQL, [winner.id, contested, winner.world, winner.inviterEpisode, winner.targetEpisode]);
    const losing = b.query(BIRTH_SQL, [loser.id, contested, loser.world, loser.inviterEpisode, loser.targetEpisode]);
    assert.equal(await blocks(losing), 'BLOCKED', 'the competing command queues on the same credential-state row');
    await a.query('COMMIT');
    const losingError = await failureOf(losing);
    assert.ok(losingError, 'the loser did not birth a second World');
    assert.equal(losingError.code, 'P0002');
    assert.match(losingError.message, /SHARED_DIRECT_INVITATION_NOT_ACCEPTABLE/u, 'the loser sees an already-consumed invitation, bounded');
    await b.query('ROLLBACK');
    const [{ n: fromContested }] = await rows(`SELECT count(*)::int n FROM ${BIRTH_EVENTS} WHERE invitation_id=$1`, [contested]);
    assert.equal(fromContested, 1, 'one contested invitation remains linked to exactly one born World');
    const [{ n: loserWorld }] = await rows(`SELECT count(*)::int n FROM ${WORLDS} WHERE id=$1`, [loser.world]);
    assert.equal(loserWorld, 0, 'the loser created no orphan World');
    const [{ n: loserEpisodes }] = await rows(`SELECT count(*)::int n FROM ${EPISODES} WHERE id = ANY($1::uuid[])`, [[loser.inviterEpisode, loser.targetEpisode]]);
    assert.equal(loserEpisodes, 0, 'and no orphan membership episode');

    stage = 'concurrency: acceptance before rotation - the born World survives and the ACCEPTED invitation is untouched';
    const beforeRotation = c.invitations.beforeRotation;
    const survivor = { id: randomUUID(), world: randomUUID(), inviterEpisode: randomUUID(), targetEpisode: randomUUID() };
    await asOwnerFor(a, c.targetC); await asHuman(b, c.targetC);
    await a.query(BIRTH_SQL, [survivor.id, beforeRotation, survivor.world, survivor.inviterEpisode, survivor.targetEpisode]);
    const queuedRotation = b.query(ROTATE_SQL, [randomUUID(), opaqueRef('afterBirth'), 1]);
    assert.equal(await blocks(queuedRotation), 'BLOCKED', 'the rotation queues behind the acceptance that holds the credential row');
    await a.query('COMMIT');
    const rotationResult = await queuedRotation;
    assert.equal(Number(rotationResult.rows[0].credential_epoch), 2, 'the rotation proceeds afterwards');
    await b.query('COMMIT');
    const [survivorInvitation] = await rows(`SELECT status, target_credential_epoch FROM ${INVITATIONS} WHERE id=$1`, [beforeRotation]);
    assert.equal(survivorInvitation.status, 'ACCEPTED', 'a later rotation never re-terminalizes an ACCEPTED invitation');
    assert.equal(Number(survivorInvitation.target_credential_epoch), 1, 'and never rewrites its bound epoch');
    const [survivorWorld] = await rows(`SELECT lifecycle, phase, closed_at FROM ${WORLDS} WHERE id=$1`, [survivor.world]);
    assert.deepEqual([survivorWorld.lifecycle, survivorWorld.phase, survivorWorld.closed_at], ['ACTIVE', 'STANDARD', null],
      'the born World is entirely unaffected by the later credential rotation');

    stage = 'concurrency: rotation before acceptance - no World is born';
    const afterRotation = c.invitations.afterRotation;
    const unborn = { id: randomUUID(), world: randomUUID(), inviterEpisode: randomUUID(), targetEpisode: randomUUID() };
    await asHuman(a, c.targetD); await asOwnerFor(b, c.targetD);
    await a.query(ROTATE_SQL, [randomUUID(), opaqueRef('beforeAcceptance'), 1]);
    const queuedAcceptance = b.query(BIRTH_SQL, [unborn.id, afterRotation, unborn.world, unborn.inviterEpisode, unborn.targetEpisode]);
    assert.equal(await blocks(queuedAcceptance), 'BLOCKED', 'the acceptance queues behind the rotation that holds the credential row');
    await a.query('COMMIT');
    const unbornError = await failureOf(queuedAcceptance);
    assert.ok(unbornError, 'the acceptance did not commit against a rotated-away epoch');
    assert.equal(unbornError.code, 'P0002');
    assert.match(unbornError.message, /SHARED_DIRECT_INVITATION_NOT_ACCEPTABLE/u);
    await b.query('ROLLBACK');
    const [{ n: unbornWorld }] = await rows(`SELECT count(*)::int n FROM ${WORLDS} WHERE id=$1`, [unborn.world]);
    assert.equal(unbornWorld, 0, 'no World was born from the invalidated invitation');
    const [invalidated] = await rows(`SELECT status FROM ${INVITATIONS} WHERE id=$1`, [afterRotation]);
    assert.equal(invalidated.status, 'INVALIDATED', 'the rotation invalidated the old-epoch PENDING invitation, as I-04A froze');

    stage = 'concurrency: a World-id collision across DIFFERENT invitations rolls the loser back atomically';
    const collidingWorld = randomUUID();
    const first = { id: randomUUID(), inviterEpisode: randomUUID(), targetEpisode: randomUUID() };
    const second = { id: randomUUID(), inviterEpisode: randomUUID(), targetEpisode: randomUUID() };
    await asOwnerFor(a, c.targetE); await asOwnerFor(b, c.targetF);
    await a.query(BIRTH_SQL, [first.id, c.invitations.collideE, collidingWorld, first.inviterEpisode, first.targetEpisode]);
    const collidingBirth = b.query(BIRTH_SQL, [second.id, c.invitations.collideF, collidingWorld, second.inviterEpisode, second.targetEpisode]);
    assert.equal(await blocks(collidingBirth), 'BLOCKED', 'the second birth queues on the World primary key rather than racing it');
    await a.query('COMMIT');
    const collisionError = await failureOf(collidingBirth);
    assert.ok(collisionError, 'only one transaction may own a World id');
    assert.equal(collisionError.code, '23505');
    assert.match(collisionError.message, /SHARED_DIRECT_BIRTH_ID_CONFLICT/u);
    await b.query('ROLLBACK');
    const [{ n: collidedWorlds }] = await rows(`SELECT count(*)::int n FROM ${WORLDS} WHERE id=$1`, [collidingWorld]);
    assert.equal(collidedWorlds, 1, 'exactly one World owns the contested id');
    const [{ n: collidedEpisodes }] = await rows(`SELECT count(*)::int n FROM ${EPISODES} WHERE id = ANY($1::uuid[])`, [[second.inviterEpisode, second.targetEpisode]]);
    assert.equal(collidedEpisodes, 0, 'the loser left no partial episode');
    const [{ n: collidedCommands }] = await rows(`SELECT count(*)::int n FROM ${ACCEPTANCE_COMMANDS} WHERE id=$1`, [second.id]);
    assert.equal(collidedCommands, 0, 'and no partial command row');
    const [loserInvitation] = await rows(`SELECT status, terminal_at FROM ${INVITATIONS} WHERE id=$1`, [c.invitations.collideF]);
    assert.equal(loserInvitation.status, 'PENDING', 'the losing invitation remains PENDING');
    assert.equal(loserInvitation.terminal_at, null);

    stage = 'concurrency: a membership-episode-id collision rolls the whole transaction back';
    const sharedEpisode = randomUUID();
    const third = { id: randomUUID(), world: randomUUID(), targetEpisode: randomUUID() };
    const fourth = { id: randomUUID(), world: randomUUID(), targetEpisode: randomUUID() };
    await asOwnerFor(a, c.targetG); await asOwnerFor(b, c.targetH);
    await a.query(BIRTH_SQL, [third.id, c.invitations.collideG, third.world, sharedEpisode, third.targetEpisode]);
    const collidingEpisode = b.query(BIRTH_SQL, [fourth.id, c.invitations.collideH, fourth.world, sharedEpisode, fourth.targetEpisode]);
    assert.equal(await blocks(collidingEpisode), 'BLOCKED', 'the second birth queues on the membership-episode primary key');
    await a.query('COMMIT');
    const episodeError = await failureOf(collidingEpisode);
    assert.ok(episodeError, 'an episode identity is owned by exactly one birth');
    assert.equal(episodeError.code, '23505');
    assert.match(episodeError.message, /SHARED_DIRECT_BIRTH_ID_CONFLICT/u);
    await b.query('ROLLBACK');
    const [{ n: fourthWorld }] = await rows(`SELECT count(*)::int n FROM ${WORLDS} WHERE id=$1`, [fourth.world]);
    assert.equal(fourthWorld, 0, 'the whole transaction rolled back - even the World row it had already inserted');
    const [{ n: fourthEvent }] = await rows(`SELECT count(*)::int n FROM ${BIRTH_EVENTS} WHERE world_id=$1`, [fourth.world]);
    assert.equal(fourthEvent, 0, 'and no direct birth event');
    const [fourthInvitation] = await rows(`SELECT status FROM ${INVITATIONS} WHERE id=$1`, [c.invitations.collideH]);
    assert.equal(fourthInvitation.status, 'PENDING', 'and the invitation remains PENDING');

    stage = 'concurrency: no deadlock, and no orphan or wrongly-shaped birth among the Worlds these races bore';
    const [{ n: deadlocksAfter }] = await rows(
      'SELECT COALESCE(sum(deadlocks), 0)::int n FROM pg_stat_database WHERE datname = current_database()');
    assert.equal(deadlocksAfter, deadlocksBefore, 'the credential-first lock order produced no deadlock across any of these races');
    // Scoped to the Worlds THESE races gave birth to. A whole-database sweep over
    // every ACCEPTED_INVITATION World would couple this verifier to whatever
    // fixtures the 0075 - 0081 verifiers happen to leave behind, which is not a
    // fact about I-04B.
    const raced = [shared.world, winner.world, survivor.world, collidingWorld, third.world];
    const [shape] = await rows(
      `SELECT (SELECT count(*)::int FROM ${WORLDS} w LEFT JOIN ${BIRTH_EVENTS} e ON e.world_id = w.id
                WHERE w.id = ANY($1::uuid[]) AND e.world_id IS NULL) unwitnessed_worlds,
              (SELECT count(*)::int FROM ${WORLDS} w
                WHERE w.id = ANY($1::uuid[]) AND (SELECT count(*) FROM ${EPISODES} ep WHERE ep.world_id = w.id) <> 2) wrong_membership,
              (SELECT count(*)::int FROM ${WORLDS} w
                WHERE w.id = ANY($1::uuid[]) AND NOT (w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
                  AND w.birth_basis = 'ACCEPTED_INVITATION' AND w.closed_at IS NULL)) wrong_state,
              (SELECT count(*)::int FROM ${WORLDS} w WHERE w.id = ANY($1::uuid[])) worlds,
              (SELECT count(*)::int FROM ${ACCEPTANCE_COMMANDS} ac WHERE ac.world_id = ANY($1::uuid[])) commands,
              (SELECT count(*)::int FROM ${BIRTH_EVENTS} e WHERE e.world_id = ANY($1::uuid[])) events`, [raced]);
    assert.deepEqual(shape, { unwitnessed_worlds: 0, wrong_membership: 0, wrong_state: 0, worlds: 5, commands: 5, events: 5 },
      'these races bore exactly five Worlds, each ACTIVE / STANDARD / ACCEPTED_INVITATION with one birth event, one acceptance command and two membership episodes');
    // Foreign keys make an orphan structurally impossible; asserted anyway so a
    // future migration that weakened one would be caught here rather than silently.
    const [{ n: orphans }] = await rows(
      `SELECT ((SELECT count(*) FROM ${BIRTH_EVENTS} e LEFT JOIN ${WORLDS} w ON w.id = e.world_id WHERE w.id IS NULL)
             + (SELECT count(*) FROM ${ACCEPTANCE_COMMANDS} ac LEFT JOIN ${WORLDS} w ON w.id = ac.world_id WHERE w.id IS NULL)
             + (SELECT count(*) FROM ${EPISODES} ep LEFT JOIN ${WORLDS} w ON w.id = ep.world_id WHERE w.id IS NULL))::int AS n`);
    assert.equal(orphans, 0, 'no birth event, acceptance command or membership episode is orphaned from its World');
  } finally {
    for (const conn of connections) await conn.end().catch(() => undefined);
  }
}

async function provisionHumans(ids) {
  await identity('postgres');
  await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [ids]);
}

async function removeFixtures(humans) {
  await identity('postgres');
  // The Worlds these fixtures gave birth to are captured BEFORE anything is
  // deleted, because every link back to the fixture humans runs through the
  // membership episodes. Deletion then follows the foreign keys inwards.
  const worldIds = (await rows(`SELECT DISTINCT ep.world_id FROM ${EPISODES} ep WHERE ep.user_id = ANY($1::uuid[])`, [humans]))
    .map((row) => row.world_id);
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
    inviter: randomUUID(), target: randomUUID(), secondTarget: randomUUID(), thirdTarget: randomUUID(),
    staleTarget: randomUUID(), outsider: randomUUID(),
  };
  f.humans = [f.inviter, f.target, f.secondTarget, f.thirdTarget, f.staleTarget, f.outsider];
  // Committed fixtures for the multi-connection races, removed afterwards.
  const c = {
    inviter: randomUUID(), targetA: randomUUID(), targetB: randomUUID(), targetC: randomUUID(), targetD: randomUUID(),
    targetE: randomUUID(), targetF: randomUUID(), targetG: randomUUID(), targetH: randomUUID(), invitations: {},
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
      // migration-0002 trigger -> public.users), and every invitation is built
      // through the frozen I-04A commands, never by a direct insert.
      await provisionHumans(f.humans);
      const existing = await verifyBirth(f);
      const pending = await verifyTargetAuthority(f);
      await verifyStaleAndTerminal(f, pending);
      await verifyIdempotency(f, existing);
      await verifyIdCollisionRollback(f, existing);
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
        for (const [key, target] of [['identical', c.targetA], ['contested', c.targetB], ['beforeRotation', c.targetC],
          ['afterRotation', c.targetD], ['collideE', c.targetE], ['collideF', c.targetF], ['collideG', c.targetG], ['collideH', c.targetH]]) {
          c.invitations[key] = (await provisionInvitation(c.inviter, target, key)).invitationId;
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
            + (SELECT count(*) FROM ${EPISODES} WHERE user_id = ANY($1::uuid[]) OR world_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($2::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
      [humans, bornWorlds]);
    assert.equal(Number(n), 0, 'no fixture row remains after completion - not even a Shared World this run gave birth to');
    console.log('Verified migration 0082: shared_world_direct_birth_events and shared_world_direct_acceptance_commands exist once and still carry every column they own, unchanged and in its original position, with later additive schema evolution permitted rather than censused, plus the exact unique bindings (one World and one invitation per direct birth; one invitation, World and membership episode per committed acceptance), seven restrictive foreign keys, RLS on, zero policies, no trigger and no owner/admin/role/payload column, and no direct privilege for PUBLIC/anon/authenticated/service_role; commit_shared_world_direct_acceptance_birth_v1 is a postgres-owned SECURITY DEFINER, search_path-pinned, VOLATILE primitive that PUBLIC, anon, authenticated AND service_role all cannot execute - the frozen system-policy / Launch Gate precondition is not implemented, so the birth core stays non-application-executable and migration 0082 grants EXECUTE to nobody at all; it accepts exactly five opaque uuid identities with the IN and TABLE argument arrays derived by PostgreSQL rather than partitioned client-side with no acceptor, actor, target, status, epoch or clock parameter, derives the accepting human from auth.uid(), reads no Personal context and creates no Standing Context, Matching or Introduction state; a valid exact-target acceptance atomically creates exactly one ACTIVE/STANDARD/ACCEPTED_INVITATION World with a NULL closure, exactly two open membership episodes for exactly the inviter and the exact accepting target, exactly one direct WORLD_BIRTH, the invitation ACCEPTED with its inviter/target/epoch bindings untouched, and one durable command - with born_at, both joined_at, occurred_at, terminal_at and committed_at proven equal in SQL to ONE database-owned instant; the inviter, an unrelated human, a NULL auth.uid(), every terminal invitation status, a stale bound credential epoch, an absent credential state and a nonexistent invitation all fail through one bounded non-enumerating class that names no human and creates no World; an equivalent retry returns the same World while any different identity under a committed command id is 23505 and one invitation sources exactly one World birth; a taken World id or membership-episode id rolls the WHOLE birth back leaving the invitation PENDING; and against real concurrent connections two identical acceptances produce one birth and the same result to both, two competing commands on one invitation have exactly one winner, acceptance before rotation leaves the born World and its ACCEPTED invitation untouched while rotation before acceptance births nothing, World-id and episode-id collisions each roll back atomically, the credential-first lock order produced no deadlock, and no orphan or wrongly-sized membership remains; zero fixture residue.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Direct acceptance World birth verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
