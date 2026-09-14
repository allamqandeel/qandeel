// Real-PostgreSQL verifier for migration 0081 - Direct Shared Invitation
// Credential + Prospective Invitation Runtime v1 (I-04A).
//
// Runs against a fully migrated database and proves, from live catalogs and live
// behaviour rather than from the migration text:
//
//   * schema: the three tables exist exactly once, owned by postgres, with the
//     exact columns / types / nullability / defaults, the exact checks (epoch
//     floor, opaque reference, distinct humans, the six frozen invitation
//     statuses, PENDING <=> terminal_at IS NULL, per-command-kind shape),
//     restrictive foreign keys to public.users, the exact index set, RLS on,
//     zero policies and no trigger. The invitation table carries NO world id;
//     no expiry column exists on any of them;
//   * direct ACL: PUBLIC, anon, authenticated and service_role hold no SELECT /
//     INSERT / UPDATE / DELETE on any of the three (catalog AND actual 42501
//     under SET LOCAL ROLE), and the 0075 Shared World substrate remains exactly
//     as sealed as it was;
//   * function ACL: authenticated can execute both commands; anon, service_role
//     and PUBLIC cannot (catalog AND actual 42501); an authenticated call with
//     no subject claim is refused because auth.uid() is NULL;
//   * credential behaviour, as the authenticated human inside one rolled-back
//     transaction: first setup yields epoch 1 for exactly auth.uid(); another
//     human cannot touch it; the timestamp is database-owned; exact rotation
//     yields N + 1; a stale or absent expected epoch is a bounded 40001; an
//     equivalent retry is idempotent; a reused command id with different
//     semantics is 23505; a reference already held by another human is bounded
//     and never says so; and a rotation must actually CHANGE the credential -
//     re-presenting the reference that is already current is bounded and writes
//     nothing at all (no epoch, no updated_at, no invalidation sweep, no command
//     row), while a genuinely new reference still rotates;
//   * invitation behaviour: the target is resolved only from the exact current
//     lookup reference; there is no target parameter; a valid reference produces
//     exactly one PENDING row bound to the exact current epoch; self-target,
//     never-existed and retired references all fail through the SAME bounded
//     class with no row created; the result carries no target identity; an
//     equivalent retry creates no second invitation; a command-id semantic
//     mismatch is 23505; an invitation id owned by another command is refused
//     and never re-bound;
//   * rotation invalidation: a PENDING invitation at epoch N becomes INVALIDATED
//     with a database-clock terminal_at when the target rotates to N + 1, in the
//     same transaction; already-terminal rows are untouched; nothing is deleted;
//     the retired reference can no longer create an invitation and the new one
//     can;
//   * no World, ever: shared_worlds and shared_world_membership_episodes are
//     counted before and after every behaviour proof and never change, and no
//     Standing Context grant or consent event is created;
//   * concurrency, with committed fixtures and extra connections: two
//     concurrent IDENTICAL first setups create exactly one credential state and
//     both callers receive the same committed epoch-1 result, while the same
//     command id carrying different semantics still fails closed with 23505 and
//     a DIFFERENT losing first setup still gets bounded stale state; two first
//     setups cannot produce two current states; concurrent rotations serialize
//     on the credential row and the stale one loses with 40001; an invitation
//     racing a rotation resolves to exactly one of the two canonical outcomes;
//     two concurrent identical submissions produce one invitation and the loser
//     returns the committed result;
//   * zero fixture residue after completion.
//
// Nothing here weakens an ACL: application roles are used only to prove denial
// and the ONE authenticated path, and service_role is used only to prove that it
// cannot execute a human invitation command.
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

const CREDENTIAL = 'public.shared_world_invite_credential_state';
const INVITATIONS = 'public.shared_world_direct_invitations';
const COMMANDS = 'public.shared_world_invitation_commands';
const WORLDS = 'public.shared_worlds';
const EPISODES = 'public.shared_world_membership_episodes';
const GRANTS = 'public.shared_world_standing_context_grants';
const OWN_TABLES = [CREDENTIAL, INVITATIONS, COMMANDS];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
const ROTATE_FN = 'public.rotate_shared_world_invite_credential_v1(uuid,text,bigint)';
const SUBMIT_FN = 'public.submit_shared_world_direct_invitation_v1(uuid,uuid,text)';
const INSUFFICIENT_PRIVILEGE = ['42501'];
const INVALID_PARAMETER = ['22023'];
const NOT_USABLE = ['P0002'];
const STALE = ['40001'];
const CONFLICT = ['23505'];

const ROTATE_SQL = 'SELECT command_id, credential_epoch FROM public.rotate_shared_world_invite_credential_v1($1,$2,$3)';
const SUBMIT_SQL = 'SELECT outcome, command_id, requested_invitation_id FROM public.submit_shared_world_direct_invitation_v1($1,$2,$3)';
const rotate = (commandId, ref, expected = null) => rows(ROTATE_SQL, [commandId, ref, expected]);
const submit = (commandId, invitationId, ref) => rows(SUBMIT_SQL, [commandId, invitationId, ref]);
/** A synthetic opaque reference. The human-facing credential format is not frozen, so tests invent none. */
const opaqueRef = (label) => `ref:${label}:${randomUUID()}`;

const CREDENTIAL_COLUMNS = [
  ['user_id', 'uuid', 'NO', null],
  ['credential_lookup_ref', 'text', 'NO', null],
  ['epoch', 'bigint', 'NO', null],
  ['updated_at', 'timestamp with time zone', 'NO', 'CURRENT_TIMESTAMP'],
];
const INVITATION_COLUMNS = [
  ['id', 'uuid', 'NO', null],
  ['inviter_user_id', 'uuid', 'NO', null],
  ['target_user_id', 'uuid', 'NO', null],
  ['target_credential_epoch', 'bigint', 'NO', null],
  ['status', 'text', 'NO', null],
  ['created_at', 'timestamp with time zone', 'NO', 'CURRENT_TIMESTAMP'],
  ['terminal_at', 'timestamp with time zone', 'YES', null],
];
const COMMAND_COLUMNS = [
  ['id', 'uuid', 'NO', null],
  ['actor_user_id', 'uuid', 'NO', null],
  ['command_type', 'text', 'NO', null],
  ['credential_lookup_ref', 'text', 'NO', null],
  ['resulting_credential_epoch', 'bigint', 'YES', null],
  ['invitation_id', 'uuid', 'YES', null],
  ['committed_at', 'timestamp with time zone', 'NO', 'CURRENT_TIMESTAMP'],
];

/** Generic tables this slice must not have introduced (task I-04A section 35). */
const FORBIDDEN_TABLES = [
  'invitations', 'invites', 'world_invitations', 'shared_invitations', 'generic_invitations',
  'invitation_credentials', 'matching_proposals', 'introduction_records', 'shared_world_invitation_expiry',
];

/**
 * Counts every row class the behaviour proofs may touch, PLUS the two 0075
 * tables that must never change. Read as the owner; the caller's application
 * role is restored afterwards so a proof can take a snapshot without leaving the
 * identity it is proving.
 */
async function snapshot(humans) {
  const [{ role }] = await rows('SELECT current_user AS role');
  await q('RESET ROLE');
  const [counts] = await rows(
    `SELECT (SELECT count(*)::int FROM ${CREDENTIAL} WHERE user_id = ANY($1::uuid[])) credentials,
            (SELECT count(*)::int FROM ${INVITATIONS} WHERE inviter_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[])) invitations,
            (SELECT count(*)::int FROM ${INVITATIONS} WHERE (inviter_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[])) AND status='PENDING') pending,
            (SELECT count(*)::int FROM ${COMMANDS} WHERE actor_user_id = ANY($1::uuid[])) commands,
            (SELECT count(*)::int FROM ${WORLDS}) worlds,
            (SELECT count(*)::int FROM ${EPISODES}) episodes,
            (SELECT count(*)::int FROM ${GRANTS}) grants`,
    [humans],
  );
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  return counts;
}

async function verifyCatalog() {
  stage = 'catalog: tables, columns, constraints, indexes, RLS';
  for (const table of OWN_TABLES) {
    const [{ n }] = await rows('SELECT count(*)::int n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname=$1 AND c.relname=$2 AND c.relkind=$3',
      ['public', table.split('.')[1], 'r']);
    assert.equal(n, 1, `${table} exists exactly once`);
    const [{ owner, rls }] = await rows(
      'SELECT pg_get_userbyid(c.relowner) owner, c.relrowsecurity rls FROM pg_class c WHERE c.oid = $1::regclass', [table]);
    assert.equal(owner, 'postgres', `${table} is owned by postgres`);
    assert.equal(rls, true, `${table} has row level security enabled`);
    const policies = await rows('SELECT polname FROM pg_policy WHERE polrelid = $1::regclass', [table]);
    assert.deepEqual(policies, [], `${table} carries zero RLS policies`);
    const triggers = await rows('SELECT tgname FROM pg_trigger WHERE tgrelid = $1::regclass AND NOT tgisinternal', [table]);
    assert.deepEqual(triggers, [], `${table} carries no trigger`);
  }

  for (const [table, expected] of [[CREDENTIAL, CREDENTIAL_COLUMNS], [INVITATIONS, INVITATION_COLUMNS], [COMMANDS, COMMAND_COLUMNS]]) {
    const columns = await rows(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table.split('.')[1]]);
    assert.deepEqual(columns.map((c) => [c.column_name, c.data_type, c.is_nullable, c.column_default]), expected,
      `${table} carries exactly the expected columns`);
  }

  stage = 'catalog: a prospective invitation is not a World, and no expiry policy exists';
  const shaped = await rows(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name = ANY($1::text[])
        AND column_name ~* '(world_id|lifecycle|phase|birth|episode|alias|owner|admin|creator|privilege|expires|ttl|matching|introduction|scope|permission|kind|capability|payload|metadata)'`,
    [OWN_TABLES.map((t) => t.split('.')[1])]);
  assert.deepEqual(shaped, [], 'no World, alias, owner, expiry or generic-engine column exists on an I-04A table');
  const generic = await rows(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[])`, [FORBIDDEN_TABLES]);
  assert.deepEqual(generic, [], 'no generic invitation / matching / expiry table was introduced');

  stage = 'catalog: checks, foreign keys and indexes';
  const checks = await rows(
    `SELECT con.conname, pg_get_constraintdef(con.oid) AS def FROM pg_constraint con
      WHERE con.conrelid = ANY($1::regclass[]) AND con.contype='c' ORDER BY con.conname`, [OWN_TABLES]);
  const checkText = checks.map((c) => c.def).join('\n');
  for (const fragment of [
    '(epoch >= 1)',
    "(length(btrim(credential_lookup_ref)) > 0)",
    '(credential_lookup_ref <> (user_id)::text)',
    '(inviter_user_id <> target_user_id)',
    '(target_credential_epoch >= 1)',
  ]) {
    assert.ok(checkText.includes(fragment), `a CHECK constraint enforces ${fragment}`);
  }
  const statusCheck = checks.find((c) => c.conname === 'shared_world_direct_invitations_status_check');
  assert.ok(statusCheck, 'the invitation status vocabulary is a CHECK constraint');
  assert.deepEqual([...new Set([...statusCheck.def.matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]))].sort(),
    ['ACCEPTED', 'CANCELLED', 'DECLINED', 'EXPIRED', 'INVALIDATED', 'PENDING'],
    'exactly the six frozen CW2-03 invitation states');
  const terminalCheck = checks.find((c) => c.conname === 'shared_world_direct_invitations_terminal_check');
  assert.ok(terminalCheck && /PENDING/u.test(terminalCheck.def) && /terminal_at IS NULL/u.test(terminalCheck.def),
    'PENDING <=> terminal_at IS NULL is enforced by the database');

  const foreignKeys = (await rows(
    `SELECT con.conname, pg_get_constraintdef(con.oid) AS def FROM pg_constraint con
      WHERE con.conrelid = ANY($1::regclass[]) AND con.contype='f'`, [OWN_TABLES]))
    .sort((left, right) => (left.conname < right.conname ? -1 : left.conname > right.conname ? 1 : 0));
  // Five: the credential owner, the inviter, the target, the command actor -
  // all to public.users - and the command's reference to the invitation it
  // created.
  assert.deepEqual(foreignKeys.map((fk) => fk.conname), [
    'shared_world_direct_invitations_inviter_fk',
    'shared_world_direct_invitations_target_fk',
    'shared_world_invitation_commands_actor_fk',
    'shared_world_invitation_commands_invitation_fk',
    'shared_world_invite_credential_user_fk',
  ].sort(), 'exactly the five expected foreign keys');
  for (const fk of foreignKeys) {
    assert.match(fk.def, /ON DELETE RESTRICT/u, `${fk.conname} is restrictive: history never cascades`);
  }
  assert.equal(foreignKeys.filter((fk) => /REFERENCES (?:public\.)?users\(id\)/u.test(fk.def)).length, 4,
    'four human identities, all restrictive');
  assert.equal(foreignKeys.filter((fk) => /REFERENCES (?:public\.)?shared_world_direct_invitations\(id\)/u.test(fk.def)).length, 1);

  const indexes = await rows(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename = ANY($1::text[])`,
    [OWN_TABLES.map((t) => t.split('.')[1])]);
  // Sorted in JS, not by the database: index ordering must not depend on the
  // server's collation.
  assert.deepEqual(indexes.map((i) => i.indexname).sort(), [
    'shared_world_direct_invitations_inviter_idx',
    'shared_world_direct_invitations_pk',
    'shared_world_direct_invitations_target_pending_idx',
    'shared_world_invitation_commands_invitation_idx',
    'shared_world_invitation_commands_pk',
    'shared_world_invite_credential_pk',
    'shared_world_invite_credential_ref_key',
  ], 'exactly the expected index set: three primary keys, the reference identity, the two access patterns and the one-command-per-invitation rule');
  assert.match(indexes.find((i) => i.indexname === 'shared_world_direct_invitations_target_pending_idx').indexdef,
    /\(target_user_id, target_credential_epoch\) WHERE \(status = 'PENDING'::text\)/u);
  assert.match(indexes.find((i) => i.indexname === 'shared_world_invitation_commands_invitation_idx').indexdef,
    /^CREATE UNIQUE INDEX/u, 'one invitation identity is created by exactly one command');

  stage = 'catalog: the two commands are pinned SECURITY DEFINER human self-authority';
  for (const [name, fn] of [['rotate', ROTATE_FN], ['submit', SUBMIT_FN]]) {
    const [p] = await rows(
      // pg_get_function_ARGUMENTS, not _identity_arguments: the identity form
      // returns types only, which would make the parameter-NAME checks below
      // vacuously true.
      `SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner,
              pg_get_function_arguments(pr.oid) AS args
         FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [fn]);
    assert.equal(p.prosecdef, true, `${name} is SECURITY DEFINER`);
    assert.equal(p.provolatile, 'v', `${name} is a mutation and is VOLATILE`);
    assert.ok((p.proconfig ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'), `${name} pins an empty search_path`);
    assert.equal(p.owner, 'postgres', `${name} is owned by postgres`);
    assert.match(p.prosrc, /auth\.uid\(\)/u, `${name} derives the actor from auth.uid()`);
    // No caller-supplied identity of any kind, and specifically no target. The
    // positive check first, so the ban cannot pass vacuously against a string
    // that carries no parameter names at all.
    assert.match(p.args, /p_command_id uuid/u, `${name} accepts the caller-supplied command id by name`);
    assert.doesNotMatch(p.args, /inviter|target|actor|user_id|status|world|timestamp/iu, `${name} accepts no identity, status, World or timestamp parameter`);
    // THE load-bearing invariant, read from the catalog rather than the file.
    assert.doesNotMatch(p.prosrc, /public\.shared_worlds\b|public\.shared_world_membership_episodes/u,
      `${name} cannot create or touch a Shared World or a membership episode`);
    assert.doesNotMatch(p.prosrc, /conversation_|\Wmemor|human_intelligence|hypothes|standing_context|matching|introduction_record/iu,
      `${name} reads no Personal context and creates no Standing Context or Matching state`);
    assert.doesNotMatch(p.prosrc, /DELETE FROM|TRUNCATE|pg_advisory/iu, `${name} deletes nothing and takes no advisory lock`);
    // The canonical lock order, from the stored source.
    const lockAt = p.prosrc.indexOf('FROM public.shared_world_invite_credential_state s');
    const invitationAt = p.prosrc.search(/(?:UPDATE|INSERT INTO) public\.shared_world_direct_invitations/u);
    assert.ok(lockAt > 0 && invitationAt > lockAt, `${name} locks the credential-state row before touching invitation rows`);
    assert.equal((p.prosrc.match(/FOR UPDATE/gu) ?? []).length, 1, `${name} takes exactly one row lock`);
  }
  const [{ n: commandCount }] = await rows(
    `SELECT count(*)::int n FROM pg_proc pr JOIN pg_namespace ns ON ns.oid=pr.pronamespace
      WHERE ns.nspname='public' AND pr.proname IN ('rotate_shared_world_invite_credential_v1','submit_shared_world_direct_invitation_v1')`);
  assert.equal(commandCount, 2, 'exactly the two commands exist, one overload each');
  // I-04A itself invented no acceptance, decline, cancel or expiry command.
  //
  // SCOPED to the two commands migration 0081 created. This was previously a
  // census over every function in the database, which is the mutable-global
  // ceiling shape the I-04A review retired elsewhere: a later reviewed slice
  // legitimately adds exactly such a command - I-04B's internal direct birth
  // core is the first - and a census would fail here the moment that authorized
  // work landed, which is not a fact about I-04A. What 0081 itself created is
  // proven from 0081's own text by
  // database/tests/shared-direct-invitation-runtime-v1.test.mjs, which refuses
  // any `CREATE FUNCTION public.*accept|decline|cancel|expire*` in this
  // migration.
  for (const command of [ROTATE_FN, SUBMIT_FN]) {
    assert.doesNotMatch(command, /accept|decline|cancel|expire/iu,
      `${command} is a prospective-path command, not an acceptance, decline, cancel or expiry command`);
  }
  // The load-bearing consequence is unchanged and still proven live: whatever
  // else comes to exist, I-04A's tables stay unreachable and its two commands
  // stay the only paths it opened.
  const [{ n: writers }] = await rows(
    `SELECT count(*)::int n FROM pg_proc pr JOIN pg_namespace ns ON ns.oid=pr.pronamespace
      WHERE ns.nspname='public' AND pr.proname IN ('rotate_shared_world_invite_credential_v1','submit_shared_world_direct_invitation_v1')
        AND pr.prosrc ~ 'public\\.shared_world_direct_invitations'`);
  assert.equal(writers, 2, "both of I-04A's commands act on the invitation substrate it created");
}

async function verifyDirectTableAcl() {
  stage = 'direct ACL: no application role may read or write an I-04A table';
  for (const table of OWN_TABLES) {
    const [{ publicAcl }] = await rows(
      `SELECT EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                       WHERE c.oid = $1::regclass AND privilege.grantee = 0) AS "publicAcl"`, [table]);
    assert.equal(publicAcl, false, `PUBLIC holds no privilege on ${table}`);
    for (const role of APPLICATION_ROLES) {
      for (const privilege of PRIVILEGES) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} must hold no ${privilege} on ${table}`);
      }
    }
  }
  // Catalog denial AND real denial.
  for (const role of APPLICATION_ROLES) {
    await identity(role, randomUUID());
    for (const table of OWN_TABLES) {
      await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), INSUFFICIENT_PRIVILEGE);
      await rejected(() => q(`DELETE FROM ${table}`), INSUFFICIENT_PRIVILEGE);
    }
  }
  stage = 'direct ACL: the 0075 Shared World substrate is exactly as sealed as it was';
  for (const table of [WORLDS, EPISODES]) {
    const policies = await rows('SELECT polname FROM pg_policy WHERE polrelid = $1::regclass', [table]);
    assert.deepEqual(policies, [], `${table} still carries zero RLS policies`);
    for (const role of APPLICATION_ROLES) {
      for (const privilege of PRIVILEGES) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} must still hold no ${privilege} on ${table}`);
      }
    }
  }
  await identity('postgres');
}

async function verifyFunctionAcl() {
  stage = 'function ACL: authenticated humans only';
  for (const fn of [ROTATE_FN, SUBMIT_FN]) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) AS allowed', ['authenticated', fn, 'EXECUTE']);
    assert.equal(allowed, true, `authenticated may execute ${fn}`);
    for (const role of ['public', 'anon', 'service_role']) {
      const [{ allowed: denied }] = await rows('SELECT has_function_privilege($1,$2,$3) AS allowed', [role, fn, 'EXECUTE']);
      assert.equal(denied, false, `${role} must not execute ${fn}`);
    }
  }
  // Real denial, not only the catalog: a system credential cannot manufacture a
  // human invitation, and neither can an anonymous caller.
  for (const role of ['anon', 'service_role']) {
    await identity(role, randomUUID());
    await rejected(() => rotate(randomUUID(), opaqueRef('denied')), INSUFFICIENT_PRIVILEGE);
    await rejected(() => submit(randomUUID(), randomUUID(), opaqueRef('denied')), INSUFFICIENT_PRIVILEGE);
  }
  // An authenticated session with no subject claim has no auth.uid().
  await identity('authenticated');
  await rejected(() => rotate(randomUUID(), opaqueRef('nosub')), INSUFFICIENT_PRIVILEGE, /SHARED_INVITE_AUTHENTICATION_REQUIRED/u);
  await rejected(() => submit(randomUUID(), randomUUID(), opaqueRef('nosub')), INSUFFICIENT_PRIVILEGE, /SHARED_INVITE_AUTHENTICATION_REQUIRED/u);
  await identity('postgres');
}

async function verifyCredentialBehaviour(f) {
  stage = 'credential: first setup belongs to exactly auth.uid() and starts at epoch 1';
  const before = await snapshot(f.humans);
  await identity('authenticated', f.mohamed);
  const setupCommand = randomUUID();
  const [first] = await rotate(setupCommand, f.mohamedRef1);
  assert.equal(first.command_id, setupCommand);
  assert.equal(Number(first.credential_epoch), 1, 'the first credential epoch is 1');
  await identity('postgres');
  const [state] = await rows(`SELECT user_id, credential_lookup_ref, epoch, updated_at FROM ${CREDENTIAL} WHERE user_id=$1`, [f.mohamed]);
  assert.equal(state.user_id, f.mohamed, 'the state belongs to the exact authenticated human');
  assert.equal(state.credential_lookup_ref, f.mohamedRef1);
  assert.equal(Number(state.epoch), 1);
  assert.ok(state.updated_at instanceof Date, 'updated_at is database-owned');
  const [{ n: others }] = await rows(`SELECT count(*)::int n FROM ${CREDENTIAL} WHERE user_id <> $1 AND user_id = ANY($2::uuid[])`, [f.mohamed, f.humans]);
  assert.equal(others, 0, 'no other human gained credential state');

  stage = 'credential: nobody else can mutate it, and a duplicate reference is bounded';
  await identity('authenticated', f.hadir);
  // Hadir's own first setup cannot take Mohamed's reference, and the refusal
  // never says that somebody else holds it.
  const collision = await rejected(() => rotate(randomUUID(), f.mohamedRef1), CONFLICT, /SHARED_INVITE_CREDENTIAL_REF_UNAVAILABLE/u);
  assert.doesNotMatch(collision.message, new RegExp(f.mohamed, 'u'), 'the collision answer names no human');
  assert.doesNotMatch(collision.message, /another|other user|already held|taken by/iu);
  // And Hadir's own setup is entirely independent.
  await rotate(randomUUID(), f.hadirRef1);
  await identity('postgres');
  const [mohamedState] = await rows(`SELECT credential_lookup_ref, epoch FROM ${CREDENTIAL} WHERE user_id=$1`, [f.mohamed]);
  assert.equal(mohamedState.credential_lookup_ref, f.mohamedRef1, "another human's command did not touch this credential");
  assert.equal(Number(mohamedState.epoch), 1);

  stage = 'credential: compare-and-swap, idempotency and command-id conflicts';
  await identity('authenticated', f.mohamed);
  // A stale expected epoch never rotates "whatever is current".
  await rejected(() => rotate(randomUUID(), opaqueRef('stale'), 7), STALE, /SHARED_INVITE_CREDENTIAL_STALE_STATE/u);
  await rejected(() => rotate(randomUUID(), opaqueRef('stale')), STALE, /SHARED_INVITE_CREDENTIAL_STALE_STATE/u);
  // An equivalent retry of the committed first setup returns the same result.
  const [retry] = await rotate(setupCommand, f.mohamedRef1);
  assert.equal(Number(retry.credential_epoch), 1, 'an equivalent retry returns the committed result');
  // The same command id with different semantics fails closed.
  await rejected(() => rotate(setupCommand, opaqueRef('different')), CONFLICT, /SHARED_INVITE_COMMAND_ID_CONFLICT/u);
  await rejected(() => rotate(setupCommand, f.mohamedRef1, 1), CONFLICT, /SHARED_INVITE_COMMAND_ID_CONFLICT/u);
  // The exact rotation increments by exactly one.
  const rotateCommand = randomUUID();
  const [rotated] = await rotate(rotateCommand, f.mohamedRef2, 1);
  assert.equal(Number(rotated.credential_epoch), 2, 'an exact rotation yields N + 1');
  await identity('postgres');
  const [afterRotation] = await rows(`SELECT credential_lookup_ref, epoch FROM ${CREDENTIAL} WHERE user_id=$1`, [f.mohamed]);
  assert.equal(afterRotation.credential_lookup_ref, f.mohamedRef2);
  assert.equal(Number(afterRotation.epoch), 2);
  const [{ n: stateRows }] = await rows(`SELECT count(*)::int n FROM ${CREDENTIAL} WHERE user_id=$1`, [f.mohamed]);
  assert.equal(stateRows, 1, 'rotation replaces the current state; it never creates a second one');

  stage = 'credential: malformed input is refused before anything is written';
  await identity('authenticated', f.mohamed);
  for (const bad of [[null, f.mohamedRef2, 2], [randomUUID(), null, 2], [randomUUID(), '   ', 2], [randomUUID(), f.mohamed, 2], [randomUUID(), opaqueRef('x'), 0]]) {
    await rejected(() => rotate(...bad), INVALID_PARAMETER, /SHARED_INVITE_COMMAND_INVALID/u);
  }
  await identity('postgres');
  const after = await snapshot(f.humans);
  assert.deepEqual({ worlds: after.worlds, episodes: after.episodes, grants: after.grants },
    { worlds: before.worlds, episodes: before.episodes, grants: before.grants },
    'credential state is not a World: no Shared World, membership episode or Standing Context grant was created');
  return { rotateCommand };
}

async function verifyInvitationBehaviour(f) {
  stage = 'invitation: the target is resolved only from the exact current lookup reference';
  const before = await snapshot(f.humans);
  await identity('authenticated', f.ahmed);
  const commandId = randomUUID();
  const invitationId = randomUUID();
  const [submitted] = await submit(commandId, invitationId, f.mohamedRef2);
  // The result identifies the operation and nothing else.
  assert.deepEqual(Object.keys(submitted).sort(), ['command_id', 'outcome', 'requested_invitation_id']);
  assert.equal(submitted.outcome, 'SUBMITTED');
  assert.equal(submitted.command_id, commandId);
  assert.equal(submitted.requested_invitation_id, invitationId);
  const serialized = JSON.stringify(submitted);
  for (const secret of [f.mohamed, f.mohamedRef2, '"2"', 'epoch']) {
    assert.ok(!serialized.includes(secret), `the submission result never reveals ${secret}`);
  }

  await identity('postgres');
  const [invitation] = await rows(`SELECT * FROM ${INVITATIONS} WHERE id=$1`, [invitationId]);
  assert.ok(invitation, 'exactly one prospective invitation row exists');
  assert.equal(invitation.inviter_user_id, f.ahmed, 'the inviter is the authenticated caller');
  assert.equal(invitation.target_user_id, f.mohamed, 'the target was resolved from the reference, never supplied');
  assert.equal(Number(invitation.target_credential_epoch), 2, 'the invitation binds the exact current target epoch');
  assert.equal(invitation.status, 'PENDING');
  assert.equal(invitation.terminal_at, null, 'a PENDING invitation carries no terminal moment');
  assert.ok(invitation.created_at instanceof Date, 'created_at is database-owned');
  // A prospective invitation is not a World.
  const mid = await snapshot(f.humans);
  assert.deepEqual({ worlds: mid.worlds, episodes: mid.episodes, grants: mid.grants },
    { worlds: before.worlds, episodes: before.episodes, grants: before.grants },
    'one PENDING invitation row created no Shared World, no membership episode and no Standing Context grant');

  stage = 'invitation: every unusable reference fails through the SAME bounded class';
  await identity('authenticated', f.ahmed);
  const failures = [];
  // Never existed.
  failures.push(await rejected(() => submit(randomUUID(), randomUUID(), opaqueRef('nobody')), NOT_USABLE));
  // Retired by rotation - the reference Mohamed used to have.
  failures.push(await rejected(() => submit(randomUUID(), randomUUID(), f.mohamedRef1), NOT_USABLE));
  // Resolves to the caller themselves.
  await identity('authenticated', f.hadir);
  failures.push(await rejected(() => submit(randomUUID(), randomUUID(), f.hadirRef1), NOT_USABLE));
  for (const failure of failures) {
    assert.match(failure.message, /SHARED_INVITE_TARGET_NOT_USABLE/u, 'one bounded non-enumerating class');
    for (const secret of [f.mohamed, f.hadir, f.ahmed]) assert.ok(!failure.message.includes(secret), 'the failure names no human');
    assert.doesNotMatch(failure.message, /exists|not found|self|rotated|retired|unavailable account/iu, 'the failure never says which case occurred');
  }
  assert.equal(new Set(failures.map((e) => `${e.code}:${e.message}`)).size, 1,
    'nonexistent, retired and self-target are indistinguishable to the inviter');
  await identity('postgres');
  const afterFailures = await snapshot(f.humans);
  assert.equal(afterFailures.invitations, mid.invitations, 'an unusable reference creates no invitation row');

  stage = 'invitation: idempotency, command-id conflicts and invitation-id collisions';
  await identity('authenticated', f.ahmed);
  const [again] = await submit(commandId, invitationId, f.mohamedRef2);
  assert.deepEqual(again, submitted, 'an equivalent retry returns the committed result');
  await rejected(() => submit(commandId, randomUUID(), f.mohamedRef2), CONFLICT, /SHARED_INVITE_COMMAND_ID_CONFLICT/u);
  await rejected(() => submit(commandId, invitationId, opaqueRef('other')), CONFLICT, /SHARED_INVITE_COMMAND_ID_CONFLICT/u);
  // A different command may not adopt or re-bind an existing invitation identity.
  await rejected(() => submit(randomUUID(), invitationId, f.mohamedRef2), CONFLICT, /SHARED_DIRECT_INVITATION_ID_CONFLICT/u);
  await identity('authenticated', f.hadir);
  await rejected(() => submit(randomUUID(), invitationId, f.mohamedRef2), CONFLICT, /SHARED_DIRECT_INVITATION_ID_CONFLICT/u);
  await identity('postgres');
  const [stillOne] = await rows(`SELECT inviter_user_id, target_user_id, status FROM ${INVITATIONS} WHERE id=$1`, [invitationId]);
  assert.deepEqual([stillOne.inviter_user_id, stillOne.target_user_id, stillOne.status], [f.ahmed, f.mohamed, 'PENDING'],
    'one invitation identity never changes inviter, target or status through a collision');
  const [{ n: invitationRows }] = await rows(`SELECT count(*)::int n FROM ${INVITATIONS} WHERE inviter_user_id=$1`, [f.ahmed]);
  assert.equal(invitationRows, 1, 'no retry or collision created a second invitation');

  stage = 'invitation: malformed input is refused before anything is written';
  await identity('authenticated', f.ahmed);
  for (const bad of [[null, randomUUID(), f.mohamedRef2], [randomUUID(), null, f.mohamedRef2], [randomUUID(), randomUUID(), null], [randomUUID(), randomUUID(), '  ']]) {
    await rejected(() => submit(...bad), INVALID_PARAMETER, /SHARED_INVITE_COMMAND_INVALID/u);
  }
  await identity('postgres');
  return { invitationId, commandId };
}

async function verifyNoOpRotation(f, pendingIds) {
  // A rotation must actually CHANGE the credential. Re-presenting the reference
  // that is already current would otherwise advance the epoch and invalidate
  // every PENDING invitation while leaving the supposedly retired secret usable.
  // Proven here, with two PENDING invitations standing, so "invalidates nothing"
  // is measured rather than assumed.
  stage = 'rotation: a no-op credential value is refused and writes nothing at all';
  await identity('postgres');
  const [before] = await rows(`SELECT credential_lookup_ref, epoch, updated_at FROM ${CREDENTIAL} WHERE user_id=$1`, [f.mohamed]);
  const [{ n: commandsBefore }] = await rows(`SELECT count(*)::int n FROM ${COMMANDS} WHERE actor_user_id=$1`, [f.mohamed]);
  const substrateBefore = await snapshot(f.humans);

  await identity('authenticated', f.mohamed);
  const refused = await rejected(() => rotate(randomUUID(), f.mohamedRef2, 2), INVALID_PARAMETER, /SHARED_INVITE_CREDENTIAL_UNCHANGED/u);
  for (const secret of [f.hadir, f.ahmed, f.hadirRef1]) {
    assert.ok(!refused.message.includes(secret), 'the refusal discloses no other human and no other credential');
  }

  await identity('postgres');
  const [after] = await rows(`SELECT credential_lookup_ref, epoch, updated_at FROM ${CREDENTIAL} WHERE user_id=$1`, [f.mohamed]);
  assert.equal(after.credential_lookup_ref, before.credential_lookup_ref, 'a no-op rotation changes no reference');
  assert.equal(Number(after.epoch), Number(before.epoch), 'a no-op rotation does not increment the epoch');
  assert.equal(after.updated_at.getTime(), before.updated_at.getTime(), 'a no-op rotation does not move updated_at');
  const [{ n: commandsAfter }] = await rows(`SELECT count(*)::int n FROM ${COMMANDS} WHERE actor_user_id=$1`, [f.mohamed]);
  assert.equal(commandsAfter, commandsBefore, 'a no-op rotation writes no command-history row');
  const stillPending = await rows(`SELECT status, terminal_at FROM ${INVITATIONS} WHERE id = ANY($1::uuid[])`, [pendingIds]);
  assert.equal(stillPending.length, pendingIds.length);
  for (const row of stillPending) {
    assert.equal(row.status, 'PENDING', 'a no-op rotation invalidates no PENDING invitation');
    assert.equal(row.terminal_at, null);
  }
  const substrateAfter = await snapshot(f.humans);
  assert.deepEqual(substrateAfter, substrateBefore, 'a refused rotation created no World, no membership episode, no grant and no row of any kind');
}

async function verifyRotationInvalidation(f, existing) {
  stage = 'rotation invalidation: a PENDING old-epoch invitation becomes INVALIDATED atomically';
  // A second PENDING invitation from another inviter, and one already-terminal
  // row that must stay untouched.
  await identity('authenticated', f.hadir);
  const secondInvitation = randomUUID();
  await submit(randomUUID(), secondInvitation, f.mohamedRef2);
  await identity('postgres');
  const terminalInvitation = randomUUID();
  await q(`INSERT INTO ${INVITATIONS}(id,inviter_user_id,target_user_id,target_credential_epoch,status,terminal_at)
           VALUES($1,$2,$3,$4,'DECLINED',CURRENT_TIMESTAMP)`, [terminalInvitation, f.ahmed, f.mohamed, 1]);
  const [{ declined_at: declinedAt }] = await rows(`SELECT terminal_at AS declined_at FROM ${INVITATIONS} WHERE id=$1`, [terminalInvitation]);
  const before = await snapshot(f.humans);
  assert.equal(before.pending, 2, 'two PENDING invitations exist at epoch 2');

  // With both PENDING invitations standing: a value that is not a change is not
  // a rotation, and a genuinely new reference immediately below still is.
  await verifyNoOpRotation(f, [existing.invitationId, secondInvitation]);

  stage = 'rotation invalidation: a PENDING old-epoch invitation becomes INVALIDATED atomically';
  await identity('authenticated', f.mohamed);
  const [rotated] = await rotate(randomUUID(), f.mohamedRef3, 2);
  assert.equal(Number(rotated.credential_epoch), 3, 'the target epoch becomes N + 1');
  await identity('postgres');
  const invalidated = await rows(`SELECT id, status, terminal_at, target_credential_epoch FROM ${INVITATIONS} WHERE id = ANY($1::uuid[]) ORDER BY id`,
    [[existing.invitationId, secondInvitation]]);
  assert.equal(invalidated.length, 2, 'rotation deletes no invitation row');
  for (const row of invalidated) {
    assert.equal(row.status, 'INVALIDATED', 'every PENDING old-epoch invitation is invalidated');
    assert.ok(row.terminal_at instanceof Date, 'terminal_at is set by the database clock');
    assert.equal(Number(row.target_credential_epoch), 2, 'the historical epoch binding is preserved, not rewritten');
  }
  const [untouched] = await rows(`SELECT status, terminal_at FROM ${INVITATIONS} WHERE id=$1`, [terminalInvitation]);
  assert.equal(untouched.status, 'DECLINED', 'an already-terminal invitation is not re-terminalized');
  assert.equal(untouched.terminal_at.getTime(), declinedAt.getTime(), 'its terminal moment is unchanged');
  const after = await snapshot(f.humans);
  assert.equal(after.invitations, before.invitations, 'nothing was deleted');
  assert.equal(after.pending, 0, 'no PENDING invitation survives the rotation');
  assert.deepEqual({ worlds: after.worlds, episodes: after.episodes, grants: after.grants },
    { worlds: before.worlds, episodes: before.episodes, grants: before.grants },
    'rotation altered no Shared World, created no membership episode and created no Standing Context grant');

  stage = 'rotation invalidation: the retired reference cannot invite, the current one can';
  await identity('authenticated', f.ahmed);
  await rejected(() => submit(randomUUID(), randomUUID(), f.mohamedRef2), NOT_USABLE, /SHARED_INVITE_TARGET_NOT_USABLE/u);
  const freshInvitation = randomUUID();
  await submit(randomUUID(), freshInvitation, f.mohamedRef3);
  await identity('postgres');
  const [fresh] = await rows(`SELECT status, target_credential_epoch FROM ${INVITATIONS} WHERE id=$1`, [freshInvitation]);
  assert.equal(fresh.status, 'PENDING');
  assert.equal(Number(fresh.target_credential_epoch), 3, 'a new invitation binds the new current epoch');
}

async function verifyConcurrency(c) {
  const connections = [];
  const open = async () => {
    const extra = new Client({ connectionString: databaseUrl });
    await extra.connect();
    connections.push(extra);
    return extra;
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

  try {
    stage = 'concurrency: two IDENTICAL first credential setups are idempotent, not a lost update';
    // FIRST setup is the one case the two pre-lock / under-lock idempotency
    // passes structurally cannot cover: there is no credential row, so FOR
    // UPDATE locks nothing and both executions legitimately observe absence. The
    // uniqueness conflict is their serialization point, and an equivalent retry
    // of an already committed command must return that command's result.
    const a = await open();
    const b = await open();
    await asHuman(a, c.idempotentFirst); await asHuman(b, c.idempotentFirst);
    const sharedSetup = randomUUID();
    const wonSetup = await a.query(ROTATE_SQL, [sharedSetup, c.idempotentRef, null]);
    assert.equal(Number(wonSetup.rows[0].credential_epoch), 1);
    const duplicateSetup = b.query(ROTATE_SQL, [sharedSetup, c.idempotentRef, null]);
    assert.equal(await blocks(duplicateSetup), 'BLOCKED', 'the identical first setup waits on the primary key instead of racing');
    await a.query('COMMIT');
    const duplicateSetupResult = await duplicateSetup;
    assert.deepEqual(duplicateSetupResult.rows[0], wonSetup.rows[0], 'both callers receive the SAME committed epoch-1 result');
    assert.equal(Number(duplicateSetupResult.rows[0].credential_epoch), 1);
    await b.query('COMMIT');
    const [{ n: idempotentStates }] = await rows(`SELECT count(*)::int n FROM ${CREDENTIAL} WHERE user_id=$1`, [c.idempotentFirst]);
    assert.equal(idempotentStates, 1, 'exactly one credential state was created');
    const [{ n: idempotentCommands }] = await rows(`SELECT count(*)::int n FROM ${COMMANDS} WHERE id=$1`, [sharedSetup]);
    assert.equal(idempotentCommands, 1, 'and exactly one durable command row');
    const [{ ref: idempotentRef }] = await rows(`SELECT credential_lookup_ref ref FROM ${CREDENTIAL} WHERE user_id=$1`, [c.idempotentFirst]);
    assert.equal(idempotentRef, c.idempotentRef, 'the committed reference is the one both callers asked for');

    stage = 'concurrency: the SAME command id with DIFFERENT semantics still fails closed in the same race';
    await asHuman(a, c.conflictFirst); await asHuman(b, c.conflictFirst);
    const sharedId = randomUUID();
    await a.query(ROTATE_SQL, [sharedId, c.conflictRefA, null]);
    const divergent = b.query(ROTATE_SQL, [sharedId, c.conflictRefB, null]);
    assert.equal(await blocks(divergent), 'BLOCKED', 'the divergent command waits on the same primary key');
    await a.query('COMMIT');
    let error;
    try { await divergent; } catch (caught) { error = caught; }
    assert.ok(error, 'a command id may not be reused for different semantics, even through the conflict path');
    assert.equal(error.code, '23505');
    assert.match(error.message, /SHARED_INVITE_COMMAND_ID_CONFLICT/u);
    await b.query('ROLLBACK');
    const [{ n: conflictStates }] = await rows(`SELECT count(*)::int n FROM ${CREDENTIAL} WHERE user_id=$1 AND credential_lookup_ref=$2`,
      [c.conflictFirst, c.conflictRefA]);
    assert.equal(conflictStates, 1, 'the winner keeps its own reference; the divergent command wrote nothing');

    stage = 'concurrency: two DIFFERENT first credential setups cannot produce two current states';
    await asHuman(a, c.first); await asHuman(b, c.first);
    const wonFirst = await a.query(ROTATE_SQL, [randomUUID(), c.firstRefA, null]);
    assert.equal(Number(wonFirst.rows[0].credential_epoch), 1);
    const losingFirst = b.query(ROTATE_SQL, [randomUUID(), c.firstRefB, null]);
    assert.equal(await blocks(losingFirst), 'BLOCKED', 'the second first-setup waits on the primary key instead of racing');
    await a.query('COMMIT');
    error = undefined;
    try { await losingFirst; } catch (caught) { error = caught; }
    assert.ok(error, 'the loser did not silently establish a second current state');
    assert.equal(error.code, '40001');
    assert.match(error.message, /SHARED_INVITE_CREDENTIAL_STALE_STATE/u);
    await b.query('ROLLBACK');
    const [{ n: states }] = await rows(`SELECT count(*)::int n FROM ${CREDENTIAL} WHERE user_id=$1`, [c.first]);
    assert.equal(states, 1, 'exactly one current credential state exists');

    stage = 'concurrency: concurrent rotations serialize on the credential row and the stale one loses';
    await asHuman(a, c.first); await asHuman(b, c.first);
    const wonRotation = await a.query(ROTATE_SQL, [randomUUID(), c.firstRefC, 1]);
    assert.equal(Number(wonRotation.rows[0].credential_epoch), 2);
    const staleRotation = b.query(ROTATE_SQL, [randomUUID(), c.firstRefD, 1]);
    assert.equal(await blocks(staleRotation), 'BLOCKED', 'the second rotation queues on the locked credential row');
    await a.query('COMMIT');
    error = undefined;
    try { await staleRotation; } catch (caught) { error = caught; }
    assert.ok(error && error.code === '40001', 'the stale rotation loses with a bounded stale state');
    await b.query('ROLLBACK');

    stage = 'concurrency: a submission that wins the lock is invalidated by the rotation that follows it';
    await asHuman(a, c.inviter); await asHuman(b, c.first);
    const racedInvitation = randomUUID();
    await a.query(SUBMIT_SQL, [randomUUID(), racedInvitation, c.firstRefC]);
    const queuedRotation = b.query(ROTATE_SQL, [randomUUID(), c.firstRefE, 2]);
    assert.equal(await blocks(queuedRotation), 'BLOCKED', 'the rotation queues behind the submission that holds the credential row');
    await a.query('COMMIT');
    const rotationResult = await queuedRotation;
    assert.equal(Number(rotationResult.rows[0].credential_epoch), 3);
    await b.query('COMMIT');
    const [raced] = await rows(`SELECT status, target_credential_epoch FROM ${INVITATIONS} WHERE id=$1`, [racedInvitation]);
    assert.equal(raced.status, 'INVALIDATED', 'canonical outcome A: the invitation committed at the pre-rotation epoch and the rotation invalidated it');
    assert.equal(Number(raced.target_credential_epoch), 2);

    stage = 'concurrency: a submission that loses the lock cannot commit against a retired reference';
    await asHuman(a, c.first); await asHuman(b, c.inviter);
    const lostInvitation = randomUUID();
    await a.query(ROTATE_SQL, [randomUUID(), c.firstRefF, 3]);
    const queuedSubmission = b.query(SUBMIT_SQL, [randomUUID(), lostInvitation, c.firstRefE]);
    assert.equal(await blocks(queuedSubmission), 'BLOCKED', 'the submission queues behind the rotation that holds the credential row');
    await a.query('COMMIT');
    error = undefined;
    try { await queuedSubmission; } catch (caught) { error = caught; }
    assert.ok(error, 'the submission did not commit against a stale epoch');
    assert.equal(error.code, 'P0002');
    assert.match(error.message, /SHARED_INVITE_TARGET_NOT_USABLE/u);
    await b.query('ROLLBACK');
    const [{ n: lost }] = await rows(`SELECT count(*)::int n FROM ${INVITATIONS} WHERE id=$1`, [lostInvitation]);
    assert.equal(lost, 0, 'canonical outcome B: the rotation committed first and the retired reference created nothing');
    // No PENDING invitation anywhere is bound to an epoch below the current one.
    const [{ n: staleBindings }] = await rows(
      `SELECT count(*)::int n FROM ${INVITATIONS} i JOIN ${CREDENTIAL} s ON s.user_id = i.target_user_id
        WHERE i.status='PENDING' AND i.target_credential_epoch < s.epoch AND i.target_user_id = $1`, [c.first]);
    assert.equal(staleBindings, 0, 'no race left a PENDING invitation bound to a stale epoch');

    stage = 'concurrency: two identical submissions create exactly one invitation';
    await asHuman(a, c.inviter); await asHuman(b, c.inviter);
    const sharedCommand = randomUUID();
    const sharedInvitation = randomUUID();
    const wonSubmission = await a.query(SUBMIT_SQL, [sharedCommand, sharedInvitation, c.firstRefF]);
    assert.equal(wonSubmission.rows[0].outcome, 'SUBMITTED');
    const duplicate = b.query(SUBMIT_SQL, [sharedCommand, sharedInvitation, c.firstRefF]);
    assert.equal(await blocks(duplicate), 'BLOCKED', 'the duplicate queues on the credential row');
    await a.query('COMMIT');
    const duplicateResult = await duplicate;
    assert.deepEqual(duplicateResult.rows[0], wonSubmission.rows[0], 'the loser returns the committed result rather than creating a second invitation');
    await b.query('COMMIT');
    const [{ n: created }] = await rows(`SELECT count(*)::int n FROM ${INVITATIONS} WHERE id=$1`, [sharedInvitation]);
    assert.equal(created, 1, 'one idempotent command produced exactly one invitation row');

    stage = 'concurrency: no race created a Shared World';
    const [{ worlds, episodes }] = await rows(`SELECT (SELECT count(*)::int FROM ${WORLDS}) worlds, (SELECT count(*)::int FROM ${EPISODES}) episodes`);
    assert.deepEqual({ worlds, episodes }, c.substrate, 'no race created a Shared World or a membership episode');
  } finally {
    for (const conn of connections) await conn.end().catch(() => undefined);
  }
}

async function provisionHumans(ids) {
  await identity('postgres');
  await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [ids]);
}

async function main() {
  // Rolled-back fixtures for the behaviour proofs.
  const f = {
    mohamed: randomUUID(), hadir: randomUUID(), ahmed: randomUUID(),
    mohamedRef1: opaqueRef('m1'), mohamedRef2: opaqueRef('m2'), mohamedRef3: opaqueRef('m3'), hadirRef1: opaqueRef('h1'),
  };
  f.humans = [f.mohamed, f.hadir, f.ahmed];
  // Committed fixtures for the multi-connection races, removed afterwards.
  const c = {
    first: randomUUID(), inviter: randomUUID(), idempotentFirst: randomUUID(), conflictFirst: randomUUID(),
    firstRefA: opaqueRef('cA'), firstRefB: opaqueRef('cB'), firstRefC: opaqueRef('cC'),
    firstRefD: opaqueRef('cD'), firstRefE: opaqueRef('cE'), firstRefF: opaqueRef('cF'),
    idempotentRef: opaqueRef('cI'), conflictRefA: opaqueRef('cJ'), conflictRefB: opaqueRef('cK'),
  };
  c.humans = [c.first, c.inviter, c.idempotentFirst, c.conflictFirst];
  try {
    await client.connect();
    await verifyCatalog();
    await q('BEGIN');
    try {
      await verifyDirectTableAcl();
      await verifyFunctionAcl();
      // Fixture humans are provisioned the canonical way (auth.users -> the
      // migration-0002 trigger -> public.users). No application role creates
      // anything; the two commands under test are the only path that writes a
      // credential, an invitation or a command row.
      await provisionHumans(f.humans);
      await verifyCredentialBehaviour(f);
      const existing = await verifyInvitationBehaviour(f);
      await verifyRotationInvalidation(f, existing);
      await identity('postgres');
    } finally {
      await q('ROLLBACK');
    }

    try {
      await provisionHumans(c.humans);
      const [substrate] = await rows(`SELECT (SELECT count(*)::int FROM ${WORLDS}) worlds, (SELECT count(*)::int FROM ${EPISODES}) episodes`);
      c.substrate = substrate;
      await verifyConcurrency(c);
    } finally {
      stage = 'concurrency: fixture removal';
      await identity('postgres');
      await q(`DELETE FROM ${COMMANDS} WHERE actor_user_id = ANY($1::uuid[])`, [c.humans]);
      await q(`DELETE FROM ${INVITATIONS} WHERE inviter_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[])`, [c.humans]);
      await q(`DELETE FROM ${CREDENTIAL} WHERE user_id = ANY($1::uuid[])`, [c.humans]);
      await q('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [c.humans]);
      await q('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [c.humans]);
    }

    stage = 'fixture residue';
    const humans = [...f.humans, ...c.humans];
    const [{ n }] = await rows(
      `SELECT (SELECT count(*) FROM ${CREDENTIAL} WHERE user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${INVITATIONS} WHERE inviter_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${COMMANDS} WHERE actor_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
      [humans]);
    assert.equal(Number(n), 0, 'no fixture row remains after completion');
    console.log('Verified migration 0081: shared_world_invite_credential_state, shared_world_direct_invitations and shared_world_invitation_commands exist once with the exact columns, checks (epoch >= 1, opaque reference, distinct humans, the six frozen invitation states, PENDING <=> terminal_at IS NULL), restrictive foreign keys, the exact index set, RLS on, zero policies, no trigger and no direct privilege for PUBLIC/anon/authenticated/service_role; the invitation table carries no world id and no expiry column; rotate_shared_world_invite_credential_v1 and submit_shared_world_direct_invitation_v1 are SECURITY DEFINER, search_path-pinned, auth.uid()-derived, authenticated-only commands that anon, service_role and PUBLIC cannot execute and that accept no inviter, target, status, World or timestamp parameter; first setup yields epoch 1 for the exact caller, exact rotation yields N + 1, a stale expected epoch and a duplicate reference are bounded, retries are idempotent and command-id mismatches are 23505; a submission resolves the target only from the exact current opaque reference, binds the exact current epoch, returns no target identity, and nonexistent / retired / self-target references are indistinguishable through one bounded class; a rotation must actually change the credential, so re-presenting the current reference is bounded and writes nothing - no epoch, no updated_at, no invalidation, no command row - while a genuinely new reference still rotates; rotation invalidates every PENDING old-epoch invitation with a database-clock terminal_at while already-terminal rows and the 0075 substrate are untouched; an invitation identity is never re-bound; no command, retry, collision or race ever created a Shared World or a membership episode; the credential-first lock order makes concurrent first setups, rotations, invitation-versus-rotation races and duplicate submissions resolve to exactly the canonical outcomes, and two concurrent IDENTICAL first setups create exactly one credential state and return the same committed epoch-1 result to both callers while the same command id with different semantics still fails closed; zero fixture residue.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Direct Shared invitation runtime verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
