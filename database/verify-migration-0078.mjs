// Real-PostgreSQL verifier for migration 0078 - Standing Context Consent
// Commands & Immutable Consent History v1 (I-03C).
//
// Runs against a fully migrated database and proves, from live catalogs and
// live behaviour rather than from the migration text:
//
//   * schema: the consent-event table exists exactly once, owned by postgres,
//     with exactly the expected columns / types / nullability / defaults, the
//     exact checks (event vocabulary, event-type / prior-grant consistency),
//     restrictive foreign keys to shared_worlds, users and the I-02B grant
//     table, the exact index set, RLS on, zero policies, no trigger on the
//     three Standing Context tables (consent events, grants, audience), and
//     no generic grant / consent / permission table. Whether shared_worlds or
//     the membership-episode table carries a trigger is deliberately NOT a
//     0078 property: a later, separately reviewed lifecycle / governance
//     migration may add one without widening any ceiling, and this historical
//     verifier must not become a permanent global ceiling. (The static
//     contract and the migration's own deploy-time self-assertion prove that
//     migration 0078 itself added no trigger, membership hook or automatic
//     audience-mutation path.)
//   * direct ACL: PUBLIC, anon, authenticated and service_role hold no SELECT /
//     INSERT / UPDATE / DELETE on the consent events (catalog AND actual 42501
//     under SET LOCAL ROLE), and the two I-02B grant tables remain directly
//     sealed for anon, authenticated and service_role;
//   * function ACL: authenticated can execute both commands; anon, service_role
//     and PUBLIC cannot (catalog AND actual 42501); an authenticated call with
//     no subject claim is refused because auth.uid() is NULL; the I-03B
//     resolver remains service_role-only;
//   * behaviour, as the authenticated grantor inside one rolled-back
//     transaction: first grant (one ACTIVE grant, exact two ceiling rows, one
//     GRANTED event, no prior grant, exact owner / World); a ceiling that is a
//     proper subset of membership; outsider / former-member / nonexistent
//     ceiling humans rejected with no partial grant or event; a non-member and a
//     former member cannot grant; a closed World and a nonexistent World are
//     refused; an ACTIVE Introduction-phase World is accepted; empty / NULL /
//     NULL-element / duplicate ceilings are rejected, never normalized; the
//     grantor is not required inside the ceiling; reconfirmation revokes the
//     old grant, creates the new grant with its own ceiling and one RECONFIRMED
//     event (prior = old, subject = new) while the old ceiling rows stay
//     unchanged; a stale first grant, a stale reconfirm and a stale revoke fail
//     with 40001 and touch nothing; revoke of the exact current grant leaves one
//     REVOKED event and deletes nothing; another human cannot revoke the
//     grantor's grant; the grantor can still revoke after leaving the World and
//     after the World closed; an equivalent retry of every successful command
//     returns the same committed result with no duplicate grant / event /
//     revocation; a command-id reuse for a different command is 23505 with no
//     mutation; consent history remains while the I-03B resolver returns the
//     ACTIVE grant after grant / reconfirm and zero rows after revoke;
//   * forward safety, inside the same rolled-back transaction: a hypothetical
//     later unrelated trigger on shared_worlds and on the membership-episode
//     table is created, the Standing Context seal proof still passes and both
//     consent commands still commit, so this verifier does not fail merely
//     because such a trigger exists; a trigger on a Standing Context table
//     itself (an automatic ceiling-mutation path) is still refused;
//   * concurrency, with committed fixtures and two extra connections: two
//     first-grant commands from the same grantor for the same World with
//     different command ids block on the World row; exactly one establishes the
//     ACTIVE state, the other fails stale, never two ACTIVE grants, never an
//     orphan event;
//   * zero fixture residue after completion (the forward-safety probe included).
//
// Nothing here weakens an ACL: application roles are used only to prove denial
// and the ONE authenticated path; service_role is used only to prove that it
// cannot execute a consent command and that the I-03B resolver observes the
// committed state.
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
}

const WORLDS = 'public.shared_worlds';
const EPISODES = 'public.shared_world_membership_episodes';
const GRANTS = 'public.shared_world_standing_context_grants';
const AUDIENCE = 'public.shared_world_standing_context_grant_audience';
const EVENTS = 'public.shared_world_standing_context_consent_events';
const SEALED_TABLES = [EVENTS, GRANTS, AUDIENCE];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
const GRANT_FN = 'public.grant_shared_world_standing_context_v1(uuid,uuid,uuid,uuid[],uuid)';
const REVOKE_FN = 'public.revoke_shared_world_standing_context_v1(uuid,uuid,uuid)';
const RESOLVER_FN = 'public.resolve_shared_world_standing_context_grant_v1(uuid,uuid)';
const INSUFFICIENT_PRIVILEGE = ['42501'];
const INVALID_PARAMETER = ['22023'];
const NO_DATA = ['P0002'];
const STALE = ['40001'];
const CONFLICT = ['23505'];
const NOT_ACTIVE = ['55000'];

const GRANT_SQL = 'SELECT consent_event_id, event_type, grant_id, prior_grant_id, grant_status FROM public.grant_shared_world_standing_context_v1($1,$2,$3,$4::uuid[],$5)';
const REVOKE_SQL = 'SELECT consent_event_id, event_type, grant_id, prior_grant_id, grant_status FROM public.revoke_shared_world_standing_context_v1($1,$2,$3)';
const grant = (commandId, newGrantId, worldId, audience, expected = null) => rows(GRANT_SQL, [commandId, newGrantId, worldId, audience, expected]);
const revoke = (commandId, worldId, expected) => rows(REVOKE_SQL, [commandId, worldId, expected]);
const resolve = (worldId, grantorId) => rows('SELECT grant_id, status, audience_user_id FROM public.resolve_shared_world_standing_context_grant_v1($1,$2)', [worldId, grantorId]);
const sorted = (list) => [...list].sort();

const EXPECTED_COLUMNS = [
  ['id', 'uuid', 'NO', null],
  ['world_id', 'uuid', 'NO', null],
  ['grantor_user_id', 'uuid', 'NO', null],
  ['event_type', 'text', 'NO', null],
  ['subject_grant_id', 'uuid', 'NO', null],
  ['prior_grant_id', 'uuid', 'YES', null],
  ['occurred_at', 'timestamp with time zone', 'NO', 'CURRENT_TIMESTAMP'],
];

// Generic tables this slice must not have introduced.
const FORBIDDEN_TABLES = [
  'consent_events', 'consent_event_log', 'consent_requests', 'authority_grants', 'generic_permissions', 'permission_grants',
  'context_admissions', 'grants', 'permissions', 'standing_context_consent_events', 'shared_world_consent_events',
];

// Counts are read as the owner: the current application role is restored
// afterwards so a behaviour proof can take a snapshot without leaving the
// identity it is proving. (The JWT claim setting is transaction-local and
// survives RESET ROLE.)
async function snapshot(worldIds) {
  const [{ role }] = await rows('SELECT current_user AS role');
  await q('RESET ROLE');
  const [counts] = await rows(
    `SELECT (SELECT count(*)::int FROM ${GRANTS} WHERE world_id = ANY($1::uuid[])) grants,
            (SELECT count(*)::int FROM ${GRANTS} WHERE world_id = ANY($1::uuid[]) AND status='ACTIVE') active,
            (SELECT count(*)::int FROM ${AUDIENCE} a JOIN ${GRANTS} g ON g.id=a.grant_id WHERE g.world_id = ANY($1::uuid[])) audience,
            (SELECT count(*)::int FROM ${EVENTS} WHERE world_id = ANY($1::uuid[])) events`,
    [worldIds],
  );
  if (['anon', 'authenticated', 'service_role'].includes(role)) await q(`SET LOCAL ROLE ${role}`);
  return counts;
}

// The three Standing Context tables stay trigger-free and policy-free: a
// trigger on the consent events would be a history-rewrite path, a trigger on
// the grant or audience rows would be an automatic authority / ceiling mutation
// path (CW2-02 B13 / B14). That is a frozen invariant of exactly these
// relations, so it is proven live. It is deliberately not asserted over
// shared_worlds or the membership-episode table (see the header).
async function verifyStandingContextSeal() {
  for (const table of SEALED_TABLES) {
    const [{ n: triggers }] = await rows('SELECT count(*)::int n FROM pg_trigger WHERE tgrelid=$1::regclass AND NOT tgisinternal', [table]);
    assert.equal(triggers, 0, `${table} has no trigger`);
    const [{ n: policies }] = await rows('SELECT count(*)::int n FROM pg_policy WHERE polrelid=$1::regclass', [table]);
    assert.equal(policies, 0, `${table} carries zero RLS policies`);
  }
}

async function verifyCatalog() {
  stage = 'catalog: consent-event table';
  const [{ n: tableCount }] = await rows("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relname='shared_world_standing_context_consent_events'");
  assert.equal(tableCount, 1, 'the consent-event table exists exactly once');
  const [meta] = await rows('SELECT c.relkind kind, c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.oid=$1::regclass', [EVENTS]);
  assert.equal(meta.kind, 'r', 'the consent-event table is an ordinary table');
  assert.equal(meta.owner, 'postgres', 'the consent-event table is owned by postgres');
  assert.equal(meta.rls, true, 'the consent-event table has row level security enabled');
  const [{ n: forbidden }] = await rows(
    "SELECT count(*)::int n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relname = ANY($1::text[])",
    [FORBIDDEN_TABLES],
  );
  assert.equal(forbidden, 0, 'no generic consent, grant, permission or context-admission table exists');

  stage = 'catalog: columns';
  const columns = await rows(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='shared_world_standing_context_consent_events' ORDER BY ordinal_position",
  );
  assert.deepEqual(columns.map((c) => [c.column_name, c.data_type, c.is_nullable, c.column_default]), EXPECTED_COLUMNS, 'the consent-event table carries exactly the expected columns');
  for (const { column_name: name, data_type: type } of columns) {
    assert.doesNotMatch(name, /scope|purpose|action|source|permission|disclos|quote|copy|publish|share|export|provenance|transfer|owner|admin|ttl|expir|material|matching|public/iu, `${name} is not a generic, disclosure-shaped or owner column`);
    assert.ok(!['json', 'jsonb', 'ARRAY'].includes(type), `${name} is not a JSON or array column`);
  }

  stage = 'catalog: constraints';
  const constraints = await rows(
    `SELECT conname name, contype type, pg_get_constraintdef(oid) def, confdeltype ondelete,
            CASE WHEN confrelid <> 0 THEN confrelid::regclass::text ELSE NULL END parent
       FROM pg_constraint WHERE conrelid=$1::regclass ORDER BY conname COLLATE "C"`,
    [EVENTS],
  );
  const byName = Object.fromEntries(constraints.map((c) => [c.name, c]));
  assert.deepEqual(constraints.map((c) => c.name), [
    'shared_world_standing_context_consent_events_event_type_check',
    'shared_world_standing_context_consent_events_grantor_fk',
    'shared_world_standing_context_consent_events_pkey',
    'shared_world_standing_context_consent_events_prior_grant_check',
    'shared_world_standing_context_consent_events_prior_grant_fk',
    'shared_world_standing_context_consent_events_subject_grant_fk',
    'shared_world_standing_context_consent_events_world_fk',
  ], 'the consent-event table carries exactly the expected constraints');
  for (const { name } of constraints) assert.ok(Buffer.byteLength(name) <= 63, `${name} was not silently truncated`);
  assert.equal(byName.shared_world_standing_context_consent_events_pkey.def, 'PRIMARY KEY (id)');
  assert.equal(byName.shared_world_standing_context_consent_events_event_type_check.type, 'c');
  assert.match(byName.shared_world_standing_context_consent_events_event_type_check.def, /'GRANTED'.*'RECONFIRMED'.*'REVOKED'/u);
  assert.doesNotMatch(byName.shared_world_standing_context_consent_events_event_type_check.def, /DECLINED|REQUESTED|EXTENDED|PAUSED|EXPIRED|DISCLOS|MATCHING|PUBLIC/u);
  const prior = byName.shared_world_standing_context_consent_events_prior_grant_check.def;
  assert.equal(byName.shared_world_standing_context_consent_events_prior_grant_check.type, 'c');
  assert.match(prior, /event_type = 'GRANTED'(?:::text)?\)? AND \(?prior_grant_id IS NULL\)/u);
  assert.match(prior, /event_type = 'RECONFIRMED'(?:::text)?\)? AND \(?prior_grant_id IS NOT NULL\)? AND \(?prior_grant_id <> subject_grant_id\)/u);
  assert.match(prior, /event_type = 'REVOKED'(?:::text)?\)? AND \(?prior_grant_id IS NULL\)/u);
  for (const [name, parent] of [
    ['shared_world_standing_context_consent_events_world_fk', 'shared_worlds'],
    ['shared_world_standing_context_consent_events_grantor_fk', 'users'],
    ['shared_world_standing_context_consent_events_subject_grant_fk', 'shared_world_standing_context_grants'],
    ['shared_world_standing_context_consent_events_prior_grant_fk', 'shared_world_standing_context_grants'],
  ]) {
    assert.equal(byName[name].type, 'f', `${name} is a foreign key`);
    assert.equal(byName[name].parent.replace(/^public\./u, ''), parent, `${name} points at public.${parent}`);
    assert.equal(byName[name].ondelete, 'r', `${name} deletes restrictively`);
    assert.match(byName[name].def, /ON DELETE RESTRICT/u);
  }

  stage = 'catalog: indexes';
  const indexes = await rows(
    `SELECT i.relname name, ix.indisunique uniq, pg_get_expr(ix.indpred, ix.indrelid) pred,
            array_to_string(ARRAY(SELECT a.attname FROM unnest(ix.indkey::int2[]) WITH ORDINALITY k(attnum, ord)
                                   JOIN pg_attribute a ON a.attrelid=ix.indrelid AND a.attnum=k.attnum ORDER BY k.ord), ',') cols
       FROM pg_index ix JOIN pg_class i ON i.oid=ix.indexrelid
      WHERE ix.indrelid=$1::regclass ORDER BY i.relname COLLATE "C"`,
    [EVENTS],
  );
  assert.deepEqual(indexes.map((i) => [i.name, i.uniq, i.cols]), [
    ['shared_world_standing_context_consent_events_birth_event_idx', true, 'subject_grant_id'],
    ['shared_world_standing_context_consent_events_pkey', true, 'id'],
    ['shared_world_standing_context_consent_events_prior_grant_idx', true, 'prior_grant_id'],
    ['shared_world_standing_context_consent_events_revoke_event_idx', true, 'subject_grant_id'],
    ['shared_world_standing_context_consent_events_world_grantor_idx', false, 'world_id,grantor_user_id,occurred_at'],
  ], 'the consent-event table carries exactly the expected indexes');
  const predicates = Object.fromEntries(indexes.map((i) => [i.name, i.pred]));
  assert.match(predicates.shared_world_standing_context_consent_events_birth_event_idx, /'GRANTED'.*'RECONFIRMED'/u);
  assert.match(predicates.shared_world_standing_context_consent_events_revoke_event_idx, /event_type = 'REVOKED'/u);
  assert.match(predicates.shared_world_standing_context_consent_events_prior_grant_idx, /prior_grant_id IS NOT NULL/u);

  stage = 'catalog: Standing Context tables carry no trigger and zero policies';
  await verifyStandingContextSeal();

  stage = 'catalog: command functions';
  for (const [name, expectedArgs] of [
    ['grant_shared_world_standing_context_v1', 'p_command_id uuid, p_new_grant_id uuid, p_world_id uuid, p_audience_user_ids uuid[], p_expected_active_grant_id uuid'],
    ['revoke_shared_world_standing_context_v1', 'p_command_id uuid, p_world_id uuid, p_expected_active_grant_id uuid'],
  ]) {
    const procs = await rows(
      `SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) owner,
              pg_get_function_identity_arguments(pr.oid) args, pg_get_function_result(pr.oid) result
         FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace WHERE n.nspname = 'public' AND pr.proname = $1`,
      [name],
    );
    assert.equal(procs.length, 1, `${name} exists exactly once`);
    const [fn] = procs;
    assert.equal(fn.owner, 'postgres', `${name} is owned by postgres`);
    assert.equal(fn.prosecdef, true, `${name} is SECURITY DEFINER`);
    assert.equal(fn.provolatile, 'v', `${name} is a VOLATILE mutation`);
    assert.ok((fn.proconfig ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'), `${name} pins an empty search_path`);
    assert.equal(fn.args, expectedArgs, `${name} takes exactly the expected parameters`);
    assert.equal(fn.result, 'TABLE(consent_event_id uuid, event_type text, grant_id uuid, prior_grant_id uuid, grant_status text)', `${name} returns the narrow command result`);
    assert.match(fn.prosrc, /u uuid := auth\.uid\(\);/u, `${name} derives the grantor from auth.uid()`);
    assert.doesNotMatch(fn.args, /grantor|status|purpose|source|event_type|timestamp|_at\b|material|provenance|audience_ceiling_override/iu, `${name} accepts no grantor / status / purpose / timestamp parameter`);
    assert.match(fn.prosrc, /FROM public\.shared_worlds w WHERE w\.id = p_world_id FOR UPDATE/u, `${name} serializes on the exact World row`);
    assert.match(fn.prosrc, /STANDING_CONTEXT_STALE_STATE' USING ERRCODE='40001'/u);
    assert.match(fn.prosrc, /STANDING_CONTEXT_COMMAND_ID_CONFLICT' USING ERRCODE='23505'/u);
    assert.doesNotMatch(fn.prosrc, /UPDATE public\.shared_world_standing_context_consent_events|UPDATE public\.shared_world_standing_context_grant_audience|DELETE FROM|TRUNCATE|conversation|memor|model|provider/iu, `${name} never rewrites history or reads Personal context`);
  }
  const [{ n: commands }] = await rows("SELECT count(*)::int n FROM pg_proc pr JOIN pg_namespace n ON n.oid=pr.pronamespace WHERE n.nspname='public' AND pr.proname ~ 'standing_context' AND pr.proname !~ '^resolve_'");
  assert.equal(commands, 2, 'exactly two Standing Context command functions exist');
}

async function verifyDirectTableAcl() {
  stage = 'direct table ACL: catalog';
  for (const table of SEALED_TABLES) {
    for (const role of APPLICATION_ROLES) {
      for (const privilege of PRIVILEGES) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
    const [{ n: publicGrants }] = await rows('SELECT count(*)::int n FROM pg_class c, LATERAL aclexplode(c.relacl) a WHERE c.oid=$1::regclass AND a.grantee=0', [table]);
    assert.equal(publicGrants, 0, `no PUBLIC grant on ${table}`);
  }

  stage = 'direct table ACL: behaviour';
  for (const role of APPLICATION_ROLES) {
    await identity(role, role === 'authenticated' ? randomUUID() : null);
    for (const table of SEALED_TABLES) {
      await rejected(() => q(`SELECT * FROM ${table} LIMIT 1`), INSUFFICIENT_PRIVILEGE);
      await rejected(() => q(`DELETE FROM ${table}`), INSUFFICIENT_PRIVILEGE);
    }
    await rejected(() => q(`INSERT INTO ${EVENTS}(id,world_id,grantor_user_id,event_type,subject_grant_id) VALUES($1,$2,$3,'GRANTED',$4)`, [randomUUID(), randomUUID(), randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`UPDATE ${EVENTS} SET event_type='REVOKED'`), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [randomUUID(), randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`UPDATE ${GRANTS} SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP`), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2)`, [randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');
}

async function verifyFunctionAcl() {
  stage = 'function ACL: catalog';
  for (const fn of [GRANT_FN, REVOKE_FN]) {
    for (const role of ['public', 'anon', 'service_role']) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed', [role, fn, 'EXECUTE']);
      assert.equal(allowed, false, `${role} must not execute ${fn}`);
    }
    const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed', ['authenticated', fn, 'EXECUTE']);
    assert.equal(allowed, true, `authenticated executes ${fn}`);
  }
  // The I-03B resolver ACL is untouched.
  for (const role of ['public', 'anon', 'authenticated']) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed', [role, RESOLVER_FN, 'EXECUTE']);
    assert.equal(allowed, false, `${role} still cannot execute the I-03B resolver`);
  }
  const [{ allowed: resolverService }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed', ['service_role', RESOLVER_FN, 'EXECUTE']);
  assert.equal(resolverService, true, 'service_role still executes the I-03B resolver');

  stage = 'function ACL: behaviour (anon and service_role cannot execute a consent command)';
  for (const role of ['anon', 'service_role']) {
    await identity(role);
    await rejected(() => grant(randomUUID(), randomUUID(), randomUUID(), [randomUUID()]), INSUFFICIENT_PRIVILEGE, /permission denied/u);
    await rejected(() => revoke(randomUUID(), randomUUID(), randomUUID()), INSUFFICIENT_PRIVILEGE, /permission denied/u);
  }
  stage = 'function ACL: behaviour (authenticated without a subject is refused by the command itself)';
  await identity('authenticated');
  await rejected(() => grant(randomUUID(), randomUUID(), randomUUID(), [randomUUID()]), INSUFFICIENT_PRIVILEGE, /STANDING_CONTEXT_AUTHENTICATION_REQUIRED/u);
  await rejected(() => revoke(randomUUID(), randomUUID(), randomUUID()), INSUFFICIENT_PRIVILEGE, /STANDING_CONTEXT_AUTHENTICATION_REQUIRED/u);
  await identity('postgres');
}

async function verifyBehaviour(f) {
  const { world, introductionWorld, closedWorld, grantor, hadir, ahmed, former, outsider } = f;
  const worlds = [world, introductionWorld, closedWorld];
  const grantA = randomUUID(), grantB = randomUUID(), grantD = randomUUID(), grantE = randomUUID();
  const cmd1 = randomUUID(), cmd2 = randomUUID(), cmd4 = randomUUID(), cmd6 = randomUUID(), cmd7 = randomUUID(), cmdE = randomUUID(), cmdE2 = randomUUID();

  stage = 'behaviour: first grant';
  await identity('authenticated', grantor);
  assert.deepEqual(await grant(cmd1, grantA, world, [grantor, hadir]),
    [{ consent_event_id: cmd1, event_type: 'GRANTED', grant_id: grantA, prior_grant_id: null, grant_status: 'ACTIVE' }]);
  await identity('postgres');
  const [firstGrant] = await rows(`SELECT world_id, grantor_user_id, status, granted_at = now() clock, revoked_at FROM ${GRANTS} WHERE id=$1`, [grantA]);
  assert.deepEqual(firstGrant, { world_id: world, grantor_user_id: grantor, status: 'ACTIVE', clock: true, revoked_at: null }, 'one ACTIVE grant, owner and World exact, granted_at on the database clock');
  assert.deepEqual(sorted((await rows(`SELECT audience_user_id FROM ${AUDIENCE} WHERE grant_id=$1`, [grantA])).map((r) => r.audience_user_id)), sorted([grantor, hadir]), 'exactly the two explicit ceiling rows');
  const events = await rows(`SELECT id, world_id, grantor_user_id, event_type, subject_grant_id, prior_grant_id, occurred_at = now() clock FROM ${EVENTS} WHERE world_id=$1`, [world]);
  assert.deepEqual(events, [{ id: cmd1, world_id: world, grantor_user_id: grantor, event_type: 'GRANTED', subject_grant_id: grantA, prior_grant_id: null, clock: true }], 'one GRANTED event, no prior grant, owner and World exact, occurred_at on the database clock');
  assert.deepEqual(await snapshot([world]), { grants: 1, active: 1, audience: 2, events: 1 });

  stage = 'behaviour: audience subset (Ahmed is an open member outside the ceiling)';
  const [{ n: ahmedOpen }] = await rows(`SELECT count(*)::int n FROM ${EPISODES} WHERE world_id=$1 AND user_id=$2 AND ended_at IS NULL`, [world, ahmed]);
  assert.equal(ahmedOpen, 1, 'Ahmed is a current member');
  assert.ok(!(await rows(`SELECT 1 FROM ${AUDIENCE} WHERE grant_id=$1 AND audience_user_id=$2`, [grantA, ahmed])).length, 'Ahmed is not in the ceiling: the ceiling is a proper subset of membership, never auto-filled');

  stage = 'behaviour: I-03B resolver composition after first grant';
  await identity('service_role');
  const resolvedA = await resolve(world, grantor);
  assert.deepEqual(resolvedA.map((r) => [r.grant_id, r.status]), [[grantA, 'ACTIVE'], [grantA, 'ACTIVE']]);
  assert.deepEqual(sorted(resolvedA.map((r) => r.audience_user_id)), sorted([grantor, hadir]), 'the resolver returns the new ACTIVE grant with its exact ceiling');
  await identity('authenticated', grantor);

  stage = 'behaviour: outsider / former member / nonexistent human in the ceiling is rejected with no partial grant or event';
  const before = await snapshot(worlds);
  for (const ceiling of [[grantor, outsider], [grantor, former], [grantor, randomUUID()], [outsider]]) {
    await rejected(() => grant(randomUUID(), randomUUID(), world, ceiling, grantA), INSUFFICIENT_PRIVILEGE, /STANDING_CONTEXT_AUDIENCE_NOT_CURRENT_MEMBER/u);
    await rejected(() => grant(randomUUID(), randomUUID(), introductionWorld, ceiling), INSUFFICIENT_PRIVILEGE, /STANDING_CONTEXT_AUDIENCE_NOT_CURRENT_MEMBER/u);
  }
  assert.deepEqual(await snapshot(worlds), before, 'a rejected ceiling mutates nothing');

  stage = 'behaviour: a non-member, a former member and a nonexistent human cannot grant';
  for (const who of [outsider, former, randomUUID()]) {
    await identity('authenticated', who);
    await rejected(() => grant(randomUUID(), randomUUID(), world, [hadir]), INSUFFICIENT_PRIVILEGE, /STANDING_CONTEXT_GRANTOR_NOT_CURRENT_MEMBER/u);
  }
  await identity('authenticated', grantor);
  assert.deepEqual(await snapshot(worlds), before, 'a rejected grantor mutates nothing');

  stage = 'behaviour: World lifecycle and existence';
  await rejected(() => grant(randomUUID(), randomUUID(), closedWorld, [grantor]), NOT_ACTIVE, /STANDING_CONTEXT_WORLD_NOT_ACTIVE/u);
  await rejected(() => grant(randomUUID(), randomUUID(), randomUUID(), [grantor]), NO_DATA, /STANDING_CONTEXT_WORLD_NOT_FOUND/u);
  await rejected(() => revoke(randomUUID(), randomUUID(), grantA), NO_DATA, /STANDING_CONTEXT_WORLD_NOT_FOUND/u);
  // An ACTIVE Introduction-phase Shared World is a Shared World: the ceiling here deliberately excludes the grantor.
  assert.deepEqual(await grant(cmdE, grantE, introductionWorld, [hadir]),
    [{ consent_event_id: cmdE, event_type: 'GRANTED', grant_id: grantE, prior_grant_id: null, grant_status: 'ACTIVE' }], 'an ACTIVE Introduction World accepts a grant and the grantor is not required inside the ceiling');
  assert.deepEqual(await snapshot([introductionWorld]), { grants: 1, active: 1, audience: 1, events: 1 });

  stage = 'behaviour: ceiling and parameter validation (rejected, never normalized)';
  const beforeValidation = await snapshot(worlds);
  await rejected(() => grant(randomUUID(), randomUUID(), world, [], grantA), INVALID_PARAMETER, /STANDING_CONTEXT_AUDIENCE_INVALID/u);
  await rejected(() => grant(randomUUID(), randomUUID(), world, null, grantA), INVALID_PARAMETER, /STANDING_CONTEXT_AUDIENCE_INVALID/u);
  await rejected(() => grant(randomUUID(), randomUUID(), world, [hadir, null], grantA), INVALID_PARAMETER, /STANDING_CONTEXT_AUDIENCE_INVALID/u);
  await rejected(() => grant(randomUUID(), randomUUID(), world, [hadir, hadir], grantA), INVALID_PARAMETER, /STANDING_CONTEXT_AUDIENCE_DUPLICATE/u);
  await rejected(() => grant(randomUUID(), randomUUID(), world, [grantor, hadir, grantor], grantA), INVALID_PARAMETER, /STANDING_CONTEXT_AUDIENCE_DUPLICATE/u);
  await rejected(() => grant(randomUUID(), grantA, world, [hadir], grantA), INVALID_PARAMETER, /STANDING_CONTEXT_NEW_GRANT_ID_INVALID/u);
  await rejected(() => grant(null, randomUUID(), world, [hadir], grantA), INVALID_PARAMETER, /STANDING_CONTEXT_COMMAND_INVALID/u);
  await rejected(() => grant(randomUUID(), null, world, [hadir], grantA), INVALID_PARAMETER, /STANDING_CONTEXT_COMMAND_INVALID/u);
  await rejected(() => grant(randomUUID(), randomUUID(), null, [hadir], grantA), INVALID_PARAMETER, /STANDING_CONTEXT_COMMAND_INVALID/u);
  await rejected(() => revoke(null, world, grantA), INVALID_PARAMETER, /STANDING_CONTEXT_COMMAND_INVALID/u);
  await rejected(() => revoke(randomUUID(), world, null), INVALID_PARAMETER, /STANDING_CONTEXT_COMMAND_INVALID/u);
  assert.deepEqual(await snapshot(worlds), beforeValidation, 'rejected parameters mutate nothing');

  stage = 'behaviour: stale first grant (expected NULL while an ACTIVE grant exists)';
  await rejected(() => grant(randomUUID(), randomUUID(), world, [grantor, hadir]), STALE, /STANDING_CONTEXT_STALE_STATE/u);
  await rejected(() => grant(randomUUID(), randomUUID(), world, [grantor, hadir], randomUUID()), STALE, /STANDING_CONTEXT_STALE_STATE/u);
  assert.deepEqual(await snapshot(worlds), beforeValidation, 'a stale command mutates nothing');

  stage = 'behaviour: reconfirm (revoke old + new grant + new ceiling + RECONFIRMED event)';
  assert.deepEqual(await grant(cmd2, grantB, world, [ahmed, hadir, grantor], grantA),
    [{ consent_event_id: cmd2, event_type: 'RECONFIRMED', grant_id: grantB, prior_grant_id: grantA, grant_status: 'ACTIVE' }]);
  await identity('postgres');
  const history = await rows(`SELECT id, status, revoked_at IS NOT NULL revoked, revoked_at >= granted_at ordered FROM ${GRANTS} WHERE world_id=$1 AND grantor_user_id=$2 ORDER BY granted_at, id`, [world, grantor]);
  assert.deepEqual(history.map((r) => [r.id, r.status, r.revoked, r.ordered]).sort(), [[grantA, 'REVOKED', true, true], [grantB, 'ACTIVE', false, null]].sort(), 'old grant REVOKED, new grant ACTIVE, both kept');
  assert.deepEqual(sorted((await rows(`SELECT audience_user_id FROM ${AUDIENCE} WHERE grant_id=$1`, [grantA])).map((r) => r.audience_user_id)), sorted([grantor, hadir]), 'the old ceiling rows are unchanged');
  assert.deepEqual(sorted((await rows(`SELECT audience_user_id FROM ${AUDIENCE} WHERE grant_id=$1`, [grantB])).map((r) => r.audience_user_id)), sorted([grantor, hadir, ahmed]), 'the new grant carries its own explicit ceiling');
  assert.deepEqual((await rows(`SELECT id, event_type, subject_grant_id, prior_grant_id FROM ${EVENTS} WHERE world_id=$1 ORDER BY occurred_at, event_type`, [world])).map((r) => [r.id, r.event_type, r.subject_grant_id, r.prior_grant_id]),
    [[cmd1, 'GRANTED', grantA, null], [cmd2, 'RECONFIRMED', grantB, grantA]], 'one RECONFIRMED event: subject = new grant, prior = old grant');
  assert.deepEqual(await snapshot([world]), { grants: 2, active: 1, audience: 5, events: 2 });
  await identity('service_role');
  const resolvedB = await resolve(world, grantor);
  assert.ok(resolvedB.length === 3 && resolvedB.every((r) => r.grant_id === grantB && r.status === 'ACTIVE'), 'the resolver returns only the replacement ACTIVE grant');
  await identity('authenticated', grantor);

  stage = 'behaviour: stale reconfirm with the old expected grant after a newer grant exists';
  const beforeStale = await snapshot(worlds);
  await rejected(() => grant(randomUUID(), randomUUID(), world, [grantor, hadir, ahmed], grantA), STALE, /STANDING_CONTEXT_STALE_STATE/u);
  await rejected(() => grant(randomUUID(), randomUUID(), world, [grantor], randomUUID()), STALE, /STANDING_CONTEXT_STALE_STATE/u);
  await rejected(() => grant(randomUUID(), randomUUID(), world, [grantor]), STALE, /STANDING_CONTEXT_STALE_STATE/u);
  assert.deepEqual(await snapshot(worlds), beforeStale, 'the newer grant is untouched and no event is written');
  await identity('postgres');
  assert.equal((await rows(`SELECT status FROM ${GRANTS} WHERE id=$1`, [grantB]))[0].status, 'ACTIVE');
  await identity('authenticated', grantor);

  stage = 'behaviour: grant / reconfirm idempotency (same command id + same semantic command)';
  assert.deepEqual(await grant(cmd2, grantB, world, [grantor, ahmed, hadir], grantA),
    [{ consent_event_id: cmd2, event_type: 'RECONFIRMED', grant_id: grantB, prior_grant_id: grantA, grant_status: 'ACTIVE' }], 'the retry (audience in another order) returns the committed result');
  // The first-grant retry is equivalent even though grant A is now REVOKED and a newer grant is ACTIVE: idempotency precedes compare-and-swap.
  assert.deepEqual(await grant(cmd1, grantA, world, [hadir, grantor]),
    [{ consent_event_id: cmd1, event_type: 'GRANTED', grant_id: grantA, prior_grant_id: null, grant_status: 'ACTIVE' }], 'the first-grant retry returns its committed result');
  assert.deepEqual(await snapshot(worlds), beforeStale, 'no duplicate grant, event or revocation');

  stage = 'behaviour: command-id reuse for a materially different command is a conflict with no mutation';
  await rejected(() => grant(cmd2, grantB, world, [grantor, hadir], grantA), CONFLICT, /STANDING_CONTEXT_COMMAND_ID_CONFLICT/u);
  await rejected(() => grant(cmd2, randomUUID(), world, [grantor, hadir, ahmed], grantA), CONFLICT, /STANDING_CONTEXT_COMMAND_ID_CONFLICT/u);
  await rejected(() => grant(cmd2, grantB, world, [grantor, hadir, ahmed]), CONFLICT, /STANDING_CONTEXT_COMMAND_ID_CONFLICT/u);
  await rejected(() => grant(cmd2, grantB, introductionWorld, [grantor, hadir, ahmed], grantA), CONFLICT, /STANDING_CONTEXT_COMMAND_ID_CONFLICT/u);
  await rejected(() => revoke(cmd2, world, grantB), CONFLICT, /STANDING_CONTEXT_COMMAND_ID_CONFLICT/u);
  await rejected(() => revoke(cmd1, world, grantA), CONFLICT, /STANDING_CONTEXT_COMMAND_ID_CONFLICT/u);
  await identity('authenticated', hadir);
  await rejected(() => grant(cmd2, grantB, world, [grantor, hadir, ahmed], grantA), CONFLICT, /STANDING_CONTEXT_COMMAND_ID_CONFLICT/u);
  stage = 'behaviour: another human cannot revoke the grantor\'s grant, and a replayed grant id is refused';
  await rejected(() => revoke(randomUUID(), world, grantB), NO_DATA, /STANDING_CONTEXT_GRANT_NOT_FOUND/u);
  await rejected(() => grant(randomUUID(), grantB, world, [hadir]), CONFLICT, /STANDING_CONTEXT_GRANT_ID_CONFLICT/u);
  await identity('authenticated', grantor);
  await rejected(() => revoke(randomUUID(), introductionWorld, grantB), NO_DATA, /STANDING_CONTEXT_GRANT_NOT_FOUND/u);
  await rejected(() => revoke(randomUUID(), world, randomUUID()), NO_DATA, /STANDING_CONTEXT_GRANT_NOT_FOUND/u);
  assert.deepEqual(await snapshot(worlds), beforeStale, 'conflicts and refused revocations mutate nothing');

  stage = 'behaviour: revoke the exact current grant';
  assert.deepEqual(await revoke(cmd4, world, grantB),
    [{ consent_event_id: cmd4, event_type: 'REVOKED', grant_id: grantB, prior_grant_id: null, grant_status: 'REVOKED' }]);
  await identity('postgres');
  const [revokedB] = await rows(`SELECT status, revoked_at IS NOT NULL revoked, revoked_at >= granted_at ordered FROM ${GRANTS} WHERE id=$1`, [grantB]);
  assert.deepEqual(revokedB, { status: 'REVOKED', revoked: true, ordered: true }, 'the grant is REVOKED with revoked_at on the database clock');
  assert.deepEqual(await snapshot([world]), { grants: 2, active: 0, audience: 5, events: 3 }, 'no grant or audience row is deleted; one REVOKED event is appended');
  assert.deepEqual((await rows(`SELECT event_type FROM ${EVENTS} WHERE world_id=$1 ORDER BY event_type`, [world])).map((r) => r.event_type), ['GRANTED', 'RECONFIRMED', 'REVOKED'], 'consent history remains after revocation');
  await identity('service_role');
  assert.deepEqual(await resolve(world, grantor), [], 'the resolver returns zero rows after revocation: history is not effective permission');
  await identity('authenticated', grantor);

  stage = 'behaviour: stale revoke (expected grant no longer ACTIVE) and revoke idempotency';
  const beforeRevokeRetry = await snapshot(worlds);
  await rejected(() => revoke(randomUUID(), world, grantA), STALE, /STANDING_CONTEXT_STALE_STATE/u);
  await rejected(() => revoke(randomUUID(), world, grantB), STALE, /STANDING_CONTEXT_STALE_STATE/u);
  assert.deepEqual(await revoke(cmd4, world, grantB),
    [{ consent_event_id: cmd4, event_type: 'REVOKED', grant_id: grantB, prior_grant_id: null, grant_status: 'REVOKED' }], 'the revoke retry returns the committed result although the grant is already REVOKED');
  await rejected(() => revoke(cmd4, world, grantA), CONFLICT, /STANDING_CONTEXT_COMMAND_ID_CONFLICT/u);
  await rejected(() => revoke(cmd4, introductionWorld, grantB), CONFLICT, /STANDING_CONTEXT_COMMAND_ID_CONFLICT/u);
  await rejected(() => grant(cmd4, randomUUID(), world, [grantor]), CONFLICT, /STANDING_CONTEXT_COMMAND_ID_CONFLICT/u);
  assert.deepEqual(await snapshot(worlds), beforeRevokeRetry, 'no second revocation, no duplicate event');

  stage = 'behaviour: a new first grant after revocation, then revoke after leaving the World';
  assert.deepEqual(await grant(cmd6, grantD, world, [grantor, hadir]),
    [{ consent_event_id: cmd6, event_type: 'GRANTED', grant_id: grantD, prior_grant_id: null, grant_status: 'ACTIVE' }], 'with no ACTIVE grant, a new first grant is a new grant identity');
  await identity('postgres');
  await q(`UPDATE ${EPISODES} SET ended_at=CURRENT_TIMESTAMP WHERE world_id=$1 AND user_id=$2 AND ended_at IS NULL`, [world, grantor]);
  await identity('authenticated', grantor);
  await rejected(() => grant(randomUUID(), randomUUID(), world, [grantor, hadir, ahmed], grantD), INSUFFICIENT_PRIVILEGE, /STANDING_CONTEXT_GRANTOR_NOT_CURRENT_MEMBER/u);
  assert.deepEqual(await revoke(cmd7, world, grantD),
    [{ consent_event_id: cmd7, event_type: 'REVOKED', grant_id: grantD, prior_grant_id: null, grant_status: 'REVOKED' }], 'the former member may still revoke their exact ACTIVE grant');
  await identity('postgres');
  assert.deepEqual(await snapshot([world]), { grants: 3, active: 0, audience: 7, events: 5 });
  assert.equal((await rows(`SELECT count(*)::int n FROM ${EVENTS} WHERE world_id=$1 AND event_type='REVOKED'`, [world]))[0].n, 2);

  stage = 'behaviour: revoke after the World closed';
  await q(`UPDATE ${WORLDS} SET lifecycle='READ_ONLY_CLOSED', closed_at=CURRENT_TIMESTAMP WHERE id=$1`, [introductionWorld]);
  await identity('authenticated', grantor);
  await rejected(() => grant(randomUUID(), randomUUID(), introductionWorld, [hadir, grantor], grantE), NOT_ACTIVE, /STANDING_CONTEXT_WORLD_NOT_ACTIVE/u);
  assert.deepEqual(await revoke(cmdE2, introductionWorld, grantE),
    [{ consent_event_id: cmdE2, event_type: 'REVOKED', grant_id: grantE, prior_grant_id: null, grant_status: 'REVOKED' }], 'revocation survives World closure');
  await identity('service_role');
  assert.deepEqual(await resolve(introductionWorld, grantor), []);
  await identity('postgres');
  assert.deepEqual(await snapshot([introductionWorld]), { grants: 1, active: 0, audience: 1, events: 2 });

  stage = 'behaviour: the event log itself is append-only under every application role';
  for (const role of APPLICATION_ROLES) {
    await identity(role, role === 'authenticated' ? grantor : null);
    await rejected(() => q(`UPDATE ${EVENTS} SET event_type='GRANTED' WHERE id=$1`, [cmd4]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`DELETE FROM ${EVENTS} WHERE id=$1`, [cmd4]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`SELECT * FROM ${EVENTS} WHERE id=$1`, [cmd4]), INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');
  return [grantA, grantB, grantD, grantE];
}

// Forward safety / non-vacuity. A later, separately reviewed lifecycle or
// governance migration may legitimately add a trigger on shared_worlds or on
// the membership-episode table without widening any Standing Context ceiling.
// This proves that such a trigger does not make the historical 0078 verifier
// fail merely by existing - the seal proof still passes and both consent
// commands still commit beside it - while a trigger on a Standing Context
// table itself is still refused. Everything is created inside the rolled-back
// fixture transaction.
async function verifyForwardSafety(f) {
  stage = 'forward safety: a later unrelated trigger on shared_worlds / membership episodes is not a 0078 failure';
  await identity('postgres');
  const probe = `i03c_forward_safety_probe_${randomUUID().replace(/-/gu, '')}`;
  await q(`CREATE FUNCTION public.${probe}() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NULL; END$$`);
  await q(`CREATE TRIGGER ${probe}_worlds AFTER UPDATE ON ${WORLDS} FOR EACH ROW EXECUTE FUNCTION public.${probe}()`);
  await q(`CREATE TRIGGER ${probe}_episodes AFTER INSERT OR UPDATE ON ${EPISODES} FOR EACH ROW EXECUTE FUNCTION public.${probe}()`);
  for (const table of [WORLDS, EPISODES]) {
    const [{ n }] = await rows('SELECT count(*)::int n FROM pg_trigger WHERE tgrelid=$1::regclass AND NOT tgisinternal', [table]);
    assert.ok(n >= 1, `${table} now carries the hypothetical later trigger`);
  }
  await verifyStandingContextSeal();
  const [{ n: sealedTriggers }] = await rows('SELECT count(*)::int n FROM pg_trigger WHERE tgrelid = ANY($1::regclass[]) AND NOT tgisinternal', [SEALED_TABLES]);
  assert.equal(sealedTriggers, 0, 'the historical 0078 verifier does not fail merely because a later trigger exists elsewhere');
  // The consent commands are unaffected by the unrelated trigger.
  await identity('authenticated', f.hadir);
  const cmdGrant = randomUUID(), grantH = randomUUID(), cmdRevoke = randomUUID();
  assert.deepEqual(await grant(cmdGrant, grantH, f.world, [f.hadir]),
    [{ consent_event_id: cmdGrant, event_type: 'GRANTED', grant_id: grantH, prior_grant_id: null, grant_status: 'ACTIVE' }], 'a grant still commits beside the unrelated trigger');
  assert.deepEqual(await revoke(cmdRevoke, f.world, grantH),
    [{ consent_event_id: cmdRevoke, event_type: 'REVOKED', grant_id: grantH, prior_grant_id: null, grant_status: 'REVOKED' }], 'a revoke still commits beside the unrelated trigger');
  await identity('postgres');

  stage = 'forward safety: a trigger on a Standing Context table itself is still refused';
  await q('SAVEPOINT forward_safety');
  await q(`CREATE TRIGGER ${probe}_audience AFTER INSERT ON ${AUDIENCE} FOR EACH ROW EXECUTE FUNCTION public.${probe}()`);
  await assert.rejects(verifyStandingContextSeal(), /has no trigger/u, 'an audience-table trigger (an automatic ceiling-mutation path) is refused by the seal proof');
  await q('ROLLBACK TO SAVEPOINT forward_safety');
  await q('RELEASE SAVEPOINT forward_safety');
  return probe;
}

async function verifyConcurrency(f) {
  stage = 'concurrency: two first grants race on the World row';
  const clientA = new Client({ connectionString: databaseUrl });
  const clientB = new Client({ connectionString: databaseUrl });
  const grantX = randomUUID(), grantY = randomUUID(), cmdX = randomUUID(), cmdY = randomUUID();
  const asGrantor = async (c) => {
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE authenticated');
    await c.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: f.grantor, role: 'authenticated' })]);
  };
  try {
    await clientA.connect(); await clientB.connect();
    await asGrantor(clientA); await asGrantor(clientB);
    const held = await clientA.query(GRANT_SQL, [cmdX, grantX, f.world, [f.grantor, f.hadir], null]);
    assert.equal(held.rows[0].event_type, 'GRANTED');
    const pending = clientB.query(GRANT_SQL, [cmdY, grantY, f.world, [f.grantor], null]);
    pending.catch(() => undefined);
    const raced = await Promise.race([
      pending.then(() => 'COMPLETED', () => 'COMPLETED'),
      new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), 750)),
    ]);
    assert.equal(raced, 'BLOCKED', 'the second first-grant command blocks on the locked World row instead of racing');
    await clientA.query('COMMIT');
    let stale;
    try { await pending; } catch (error) { stale = error; }
    assert.ok(stale, 'the loser did not silently establish a second consent state');
    assert.equal(stale.code, '40001');
    assert.match(stale.message, /STANDING_CONTEXT_STALE_STATE/u);
    await clientB.query('ROLLBACK');
    const counts = await snapshot([f.world]);
    assert.deepEqual(counts, { grants: 1, active: 1, audience: 2, events: 1 }, 'exactly one ACTIVE grant, its ceiling and one event; never two ACTIVE grants, never an orphan event');
    assert.equal((await rows(`SELECT count(*)::int n FROM ${EVENTS} WHERE subject_grant_id=$1 OR id=$2`, [grantY, cmdY]))[0].n, 0, 'the loser wrote no event');
    assert.equal((await rows(`SELECT count(*)::int n FROM ${GRANTS} WHERE id=$1`, [grantY]))[0].n, 0, 'the loser wrote no grant');
  } finally {
    await clientA.end().catch(() => undefined);
    await clientB.end().catch(() => undefined);
  }
}

async function provisionFixtures(f, worldSpecs) {
  await identity('postgres');
  await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [[f.grantor, f.hadir, f.ahmed, f.former, f.outsider].filter(Boolean)]);
  for (const [id, lifecycle, phase, birthBasis, bornAt, closedAt] of worldSpecs) {
    await q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis,born_at,closed_at) VALUES($1,$2,$3,$4,COALESCE($5::timestamptz, CURRENT_TIMESTAMP),$6)`, [id, lifecycle, phase, birthBasis, bornAt, closedAt]);
  }
}

async function main() {
  // Rolled-back fixtures for the behaviour proofs.
  const f = { world: randomUUID(), introductionWorld: randomUUID(), closedWorld: randomUUID(), grantor: randomUUID(), hadir: randomUUID(), ahmed: randomUUID(), former: randomUUID(), outsider: randomUUID() };
  // Committed fixtures for the two-connection race, removed afterwards.
  const c = { world: randomUUID(), grantor: randomUUID(), hadir: randomUUID() };
  let grantIds = [];
  let probe = 'i03c_forward_safety_probe_none';
  try {
    await client.connect();
    await verifyCatalog();
    await q('BEGIN');
    try {
      await verifyDirectTableAcl();
      await verifyFunctionAcl();
      // Fixture humans are provisioned the canonical way (auth.users -> the
      // migration-0002 trigger -> public.users); Worlds and episodes are
      // inserted by the owner exactly as the 0075 / 0076 / 0077 verifiers do.
      // No application role creates anything; the commands under test are the
      // only path that writes a grant, a ceiling or a consent event.
      await provisionFixtures(f, [
        [f.world, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION', null, null],
        [f.introductionWorld, 'ACTIVE', 'INTRODUCTION', 'MUTUAL_MATCH', null, null],
        [f.closedWorld, 'READ_ONLY_CLOSED', 'STANDARD', 'ACCEPTED_INVITATION', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'],
      ]);
      for (const [world, user] of [[f.world, f.grantor], [f.world, f.hadir], [f.world, f.ahmed], [f.introductionWorld, f.grantor], [f.introductionWorld, f.hadir], [f.closedWorld, f.grantor]]) {
        await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP)`, [randomUUID(), world, user]);
      }
      // A former member: a closed episode only.
      await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at,ended_at) VALUES($1,$2,$3,'2026-01-01T00:00:00Z','2026-01-02T00:00:00Z')`, [randomUUID(), f.world, f.former]);
      grantIds = await verifyBehaviour(f);
      probe = await verifyForwardSafety(f);
      await identity('postgres');
    } finally {
      await q('ROLLBACK');
    }

    try {
      await provisionFixtures(c, [[c.world, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION', null, null]]);
      for (const user of [c.grantor, c.hadir]) {
        await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP)`, [randomUUID(), c.world, user]);
      }
      await verifyConcurrency(c);
    } finally {
      stage = 'concurrency: fixture removal';
      await identity('postgres');
      await q(`DELETE FROM ${EVENTS} WHERE world_id=$1`, [c.world]);
      await q(`DELETE FROM ${AUDIENCE} WHERE grant_id IN (SELECT id FROM ${GRANTS} WHERE world_id=$1)`, [c.world]);
      await q(`DELETE FROM ${GRANTS} WHERE world_id=$1`, [c.world]);
      await q(`DELETE FROM ${EPISODES} WHERE world_id=$1`, [c.world]);
      await q(`DELETE FROM ${WORLDS} WHERE id=$1`, [c.world]);
      await q('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [[c.grantor, c.hadir]]);
      await q('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [[c.grantor, c.hadir]]);
    }

    stage = 'fixture residue';
    const worlds = [f.world, f.introductionWorld, f.closedWorld, c.world];
    const humans = [f.grantor, f.hadir, f.ahmed, f.former, f.outsider, c.grantor, c.hadir];
    const [{ n }] = await rows(
      `SELECT (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${EPISODES} WHERE world_id = ANY($1::uuid[]) OR user_id = ANY($3::uuid[]))
            + (SELECT count(*) FROM ${GRANTS} WHERE id = ANY($2::uuid[]) OR world_id = ANY($1::uuid[]) OR grantor_user_id = ANY($3::uuid[]))
            + (SELECT count(*) FROM ${AUDIENCE} WHERE grant_id = ANY($2::uuid[]) OR audience_user_id = ANY($3::uuid[]))
            + (SELECT count(*) FROM ${EVENTS} WHERE world_id = ANY($1::uuid[]) OR grantor_user_id = ANY($3::uuid[]) OR subject_grant_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($3::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($3::uuid[]))
            + (SELECT count(*) FROM pg_proc WHERE proname = $4)
            + (SELECT count(*) FROM pg_trigger WHERE tgname LIKE $4 || '%') AS n`,
      [worlds, grantIds, humans, probe],
    );
    assert.equal(Number(n), 0, 'no fixture row remains after completion');
    console.log('Verified migration 0078: shared_world_standing_context_consent_events exists once with the exact append-only columns (GRANTED|RECONFIRMED|REVOKED, event-type/prior-grant consistency, restrictive FKs, RLS on, zero policies, no trigger, no direct privilege for PUBLIC/anon/authenticated/service_role); grant_shared_world_standing_context_v1 and revoke_shared_world_standing_context_v1 are SECURITY DEFINER, search_path-pinned, auth.uid()-derived, authenticated-only commands that anon, service_role and PUBLIC cannot execute; first grant, audience subset, outsider / non-member / closed-World rejection, reconfirm as revoke-old-plus-new-grant with the old ceiling untouched, stale compare-and-swap, revoke (also after leaving and after closure), durable command idempotency and command-id conflicts behave exactly; the I-03B resolver returns the ACTIVE grant after grant / reconfirm and zero rows after revoke while history remains; two racing first grants serialize on the World row with one winner and no orphan; a hypothetical later trigger on shared_worlds or the membership-episode table does not fail this verifier while a trigger on a Standing Context table is still refused; zero fixture residue.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Standing Context consent commands verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
