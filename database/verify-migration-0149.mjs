// Real-PostgreSQL verifier for migration 0149 - SEC-MATCH-00 Matching setup pre-launch direct-execute narrowing v1.
//
// Runs against a FULLY migrated database and proves, from live catalogs and real `SET ROLE` sessions, what the
// controlled forward amendment to the frozen I-07A surface promises: six widening boundaries no application role can
// execute, five privacy and inspection operations every existing human keeps, and no other route in.
//
//   DIRECT_RPC_DENY            the six are executable by no application role - PUBLIC, anon, authenticated,
//                              service_role, inheritance included - and every real call is 42501 permission denied,
//                              for a fresh human and for one who already has Matching state (correction is suspended)
//   NEW_FOOTPRINT_ZERO         a fresh authenticated human who tries all eleven boundaries commits no Matching row and
//                              holds no Matching reference to the account
//   SELF_INSPECTION_ALLOWED    the projection answers its own caller, fresh or existing, and writes nothing
//   EXISTING_TURN_OFF_ALLOWED  pause and turn off still work, under a real authenticated session, from ACTIVE and PAUSED
//   EXISTING_REVOKE_ALLOWED    both revocations still work while ACTIVE, PAUSED and OFF, and history survives
//   OWNER_ONLY                 another human's identities are not found exactly as nonexistent ones, and nothing moves
//   IDEMPOTENT_RETRY           a retained retry returns the committed answer and writes nothing; a reused id with a
//                              different request is 23505; a replay of a suspended command is refused (42501)
//   X01                        two concurrent retained commands of one human serialize on the caller's own lock row
//   NO_BACKDOOR                followed transitively, the only application-executable functions that reach a Matching
//                              setup write are the four retained commands; nothing wraps the six; no relation exposes
//                              Matching state
//   DELETION_BASELINE_UNCHANGED  every Matching reference to an account is still RESTRICT; an existing footprint still
//                              holds one, so 0149 erases nothing and QAN-BL-ACCT-01 stays open
//   HOSTED_DEFAULT_PRIVILEGES  re-applying 0149 over the hosted Supabase posture (every client role granted, plus an
//                              inherited grant) closes all six, keeps the five, and touches no existing Matching row
//   BODIES_UNCHANGED           all eleven bodies are byte-identical to the 0109 source, and owners are unchanged
//
//   f1..f3 the refused weakenings: a posture in which authenticated inherits the owner, a reopened direct grant, and a
//          client-executable wrapper around one of the six
//
// Behaviour that needs Matching state from BEFORE 0149 is reached the only honest way on a database where 0149 is
// already applied: as the owner with the exact human's claims, inside a transaction that rolls back. Every probe of a
// client's reach runs under SET LOCAL ROLE. Every scenario reports INDEPENDENTLY and the run fails ONCE at the end.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createMatchingRuntime, M, MFN, MATCHING_TABLES, MATCHING_COMMANDS, SEC_MATCH_00_SUSPENDED, SEC_MATCH_00_RETAINED,
  runVerifier, APP_ROLES,
} from './matching-setup-verifier-support.mjs';

const rt = createMatchingRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const MIGRATION_0109 = new URL('./migrations/0109_matching_setup_human_authority_commands_v1.sql', import.meta.url);
const MIGRATION_0149 = new URL('./migrations/0149_matching_setup_pre_launch_direct_execute_narrowing_v1.sql', import.meta.url);
const PERMISSION_DENIED = /permission denied for function/iu;
const PROFILE_V1 = [['life_stage', 'settled and ready'], ['children_plan', 'yes, in time']];
const PROFILE_V2 = [['life_stage', 'settled and ready'], ['relocation_openness', 'same city only']];
const REQUIREMENTS = [['faith_practice_level', 'HARD_DEALBREAKER', 'practising']];
const WRITES_MATCHING = new RegExp(
  String.raw`(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.(${MATCHING_TABLES.map((t) => t.slice('public.'.length)).join('|')})\b`, 'iu');
const nameOf = (signature) => signature.slice('public.'.length, signature.indexOf('('));

/** The 0149 body with its own transaction control removed, so it can be re-applied inside a scenario that rolls back. */
function migrationBody() {
  const source = readFileSync(MIGRATION_0149, 'utf8').replace(/\r\n/gu, '\n');
  const body = source.replace(/^BEGIN;$/mu, '').replace(/^COMMIT;$/mu, '');
  assert.equal(source.length - body.length, 'BEGIN;'.length + 'COMMIT;'.length, '0149 carries exactly one BEGIN; and one COMMIT;');
  return body;
}

/** Every reached call of one boundary, as each application role, is refused for lack of EXECUTE. */
const CALL = {
  [MFN.ACTIVATE]: () => rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY'),
  [MFN.RESUME]: () => rt.resume(randomUUID(), randomUUID()),
  [MFN.GRANT_CONTEXT]: () => rt.grantContext(randomUUID(), randomUUID()),
  [MFN.SET_PROFILE]: () => rt.setProfile(randomUUID(), PROFILE_V1),
  [MFN.SET_REQUIREMENTS]: () => rt.setRequirements(randomUUID(), REQUIREMENTS),
  [MFN.GRANT_DISCLOSURE]: () => rt.grantDisclosure(randomUUID(), randomUUID(), randomUUID(), ['life_stage']),
};

/** A human with every kind of Matching state, committed by the owner with the human's claims (pre-0149 state). */
async function existingSetup(human) {
  await actAs(human);
  const activation = randomUUID();
  const [active] = await rt.activate(activation, 'MANUAL_MY_WORLD_ENTRY');
  const grant = randomUUID();
  await rt.grantContext(randomUUID(), grant);
  const [profile] = await rt.setProfile(randomUUID(), PROFILE_V1);
  const [requirements] = await rt.setRequirements(randomUUID(), REQUIREMENTS);
  const authority = randomUUID();
  await rt.grantDisclosure(randomUUID(), authority, profile.introduction_profile_version_id, ['life_stage']);
  await asRole('postgres');
  return {
    activation, act: active.participation_event_id, grant, authority,
    profile: profile.introduction_profile_version_id, requirements: requirements.matching_requirement_version_id,
  };
}

/** Every Matching-namespace foreign key to the account, with the number of rows that hold one for `human`. */
async function accountReferences(human) {
  const keys = await rows(
    `SELECT c.conrelid::regclass::text AS relation, a.attname AS column_name, c.confdeltype, array_length(c.conkey, 1) AS width
       FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass
        AND c.conrelid::regclass::text ~ '(matching|introduction_profile|pre_match)'
      ORDER BY 1, 2`);
  for (const key of keys) {
    key.held = Number((await rows(`SELECT count(*) AS n FROM ${key.relation} WHERE ${key.column_name} = $1`, [human]))[0].n);
  }
  return keys;
}

// ---------------------------------------------------------------- 1. catalog
/** The canonical regression check: the exact 0149 posture, judged by EFFECTIVE privilege. */
async function verifySuspendedPosture() {
  for (const fn of SEC_MATCH_00_SUSPENDED) {
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await rt.canExecute(role, fn), false, `DIRECT_RPC_DENY ${role} must not execute ${fn}`);
    }
    const [{ grantees }] = await rows(
      `SELECT coalesce(array_agg(DISTINCT CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee)::text END), '{}') AS grantees
         FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        WHERE p.oid = $1::regprocedure AND a.grantee <> p.proowner`, [fn]);
    assert.deepEqual(grantees, [], `DIRECT_RPC_DENY nobody but the owner holds an ACL entry on ${fn}`);
  }
  for (const fn of SEC_MATCH_00_RETAINED) {
    assert.equal(await rt.canExecute('authenticated', fn), true, `RETAINED authenticated keeps ${fn}`);
    for (const role of ['public', 'anon', 'service_role']) {
      assert.equal(await rt.canExecute(role, fn), false, `RETAINED ${role} must not execute ${fn}`);
    }
  }
}

/** Every function in the database that reaches a Matching setup write, directly or through calls, and who executes it. */
async function verifyNoBackdoor() {
  const functions = await rows(
    `SELECT p.oid::int AS oid, p.proname, p.prosrc,
            has_function_privilege('public', p.oid, 'EXECUTE') AS public,
            has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
            has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prokind IN ('f', 'p')`);
  const reach = new Set(functions.filter((f) => WRITES_MATCHING.test(f.prosrc)).map((f) => f.proname));
  assert.ok(reach.size > 0, 'NO_BACKDOOR the census found the Matching writers at all');
  for (let grown = true; grown;) {
    grown = false;
    for (const f of functions) {
      if (reach.has(f.proname)) continue;
      if ([...reach].some((name) => new RegExp(String.raw`\b${name}\s*\(`, 'u').test(f.prosrc))) { reach.add(f.proname); grown = true; }
    }
  }
  const executable = functions.filter((f) => reach.has(f.proname) && (f.public || f.anon || f.authenticated || f.service_role));
  const retainedWriters = SEC_MATCH_00_RETAINED.filter((fn) => fn !== MFN.SETUP).map(nameOf).sort();
  assert.deepEqual(executable.map((f) => f.proname).sort(), retainedWriters,
    'NO_BACKDOOR the only application-executable functions reaching a Matching setup write are the four retained commands');
  for (const f of executable) {
    assert.deepEqual([f.public, f.anon, f.service_role], [false, false, false], `NO_BACKDOOR ${f.proname} is authenticated-only`);
  }
  // Nothing outside the eleven names a suspended boundary at all: no wrapper, no dynamic hand-off.
  for (const fn of SEC_MATCH_00_SUSPENDED) {
    const wrappers = functions.filter((f) => f.proname !== nameOf(fn) && new RegExp(String.raw`\b${nameOf(fn)}\b`, 'u').test(f.prosrc));
    assert.deepEqual(wrappers.map((f) => f.proname), [], `NO_BACKDOOR no function body names ${nameOf(fn)}`);
  }
  // No relation over Matching setup state - the fourteen tables or any view built on them - grants a client anything.
  const relations = await rows(
    `SELECT DISTINCT r.ev_class::regclass::text AS relation FROM pg_depend d JOIN pg_rewrite r ON r.oid = d.objid
      WHERE d.classid = 'pg_rewrite'::regclass AND d.refclassid = 'pg_class'::regclass
        AND d.refobjid = ANY($1::regclass[]) AND r.ev_class <> d.refobjid`, [MATCHING_TABLES]);
  for (const relation of [...MATCHING_TABLES, ...relations.map((r) => r.relation)]) {
    for (const role of ['public', ...APP_ROLES]) {
      const [{ any_privilege }] = await rows(
        `SELECT bool_or(has_table_privilege($1, $2::regclass, p)) AS any_privilege
           FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p`, [role, relation]);
      assert.equal(any_privilege, false, `NO_BACKDOOR ${role} holds no privilege on ${relation}`);
    }
  }
}

async function verifyCatalog(report) {
  await asRole('postgres');
  await report.section('DIRECT_RPC_DENY the six are executable by no application role, and the five keep authenticated', verifySuspendedPosture);
  await report.section('NO_BACKDOOR no other application-executable route reaches Matching setup state', verifyNoBackdoor);
  await report.section('BODIES_UNCHANGED all eleven bodies are the 0109 source byte for byte, with unchanged owners', async () => {
    const source = readFileSync(MIGRATION_0109, 'utf8').replace(/\r\n/gu, '\n');
    for (const fn of [...MATCHING_COMMANDS, MFN.SETUP]) {
      const start = source.indexOf(`CREATE FUNCTION public.${nameOf(fn)}(`);
      assert.ok(start >= 0, `0109 creates ${fn}`);
      const open = source.indexOf('AS $$', start) + 'AS $$'.length;
      const body = source.slice(open, source.indexOf('$$;', open));
      const posture = await rt.functionPosture(fn);
      assert.equal(posture.prosrc.replace(/\r\n/gu, '\n'), body, `BODIES_UNCHANGED ${fn} is the 0109 body`);
      assert.equal(posture.owner, 'postgres', `BODIES_UNCHANGED ${fn} is postgres-owned`);
      assert.equal(posture.secdef, true, `BODIES_UNCHANGED ${fn} is still SECURITY DEFINER`);
    }
  });
  await report.section('DELETION_BASELINE_UNCHANGED every Matching reference to an account is still RESTRICT', async () => {
    const keys = await accountReferences(randomUUID());
    assert.ok(keys.length > 0, 'the Matching namespace still references the account');
    for (const key of keys) {
      assert.equal(key.width, 1, `${key.relation}.${key.column_name} is a single-column reference`);
      assert.equal(key.confdeltype, 'r', `${key.relation}.${key.column_name} still RESTRICTs account deletion: 0149 changes no erasure semantics`);
    }
  });
}

// ------------------------------------------------------ 2. client behaviour
async function verifyClients(report, humans) {
  const [fresh, one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('DIRECT_RPC_DENY every application role is refused all six, fresh human', async () => {
      for (const role of APP_ROLES) {
        await asRole(role, fresh);
        for (const fn of SEC_MATCH_00_SUSPENDED) await rejected(CALL[fn], ['42501'], PERMISSION_DENIED);
      }
    });

    await report.isolated('NEW_FOOTPRINT_ZERO a fresh human who tries all eleven boundaries commits nothing', async () => {
      // A command id another human already committed: replaying it is a conflict, never a write.
      const foreign = await existingSetup(two);
      await asRole('authenticated', fresh);
      for (const fn of SEC_MATCH_00_SUSPENDED) await rejected(CALL[fn], ['42501'], PERMISSION_DENIED);
      await rejected(() => rt.pause(randomUUID(), randomUUID()), ['40001'], /MATCHING_STALE_STATE/u);
      await rejected(() => rt.turnOff(randomUUID(), randomUUID()), ['40001'], /MATCHING_STALE_STATE/u);
      await rejected(() => rt.pause(randomUUID(), null), ['22023'], /MATCHING_COMMAND_INVALID/u);
      await rejected(() => rt.turnOff(foreign.activation, randomUUID()), ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      await rejected(() => rt.revokeContext(randomUUID(), randomUUID()), ['P0002'], /MATCHING_GRANT_NOT_FOUND/u);
      await rejected(() => rt.revokeDisclosure(randomUUID(), randomUUID()), ['P0002'], /MATCHING_DISCLOSURE_AUTHORITY_NOT_FOUND/u);
      const [inspected] = await rt.setup();
      assert.equal(inspected.participation_state, 'OFF', 'NEW_FOOTPRINT_ZERO absence is still OFF');
      await asRole('postgres');
      for (const table of MATCHING_TABLES) {
        const column = (await rows(
          `SELECT a.attname FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attname IN
             ('user_id','participant_user_id','grantor_user_id','owner_user_id') AND NOT a.attisdropped`, [table]))[0]?.attname;
        if (column) assert.equal(await count(table, `${column} = $1`, [fresh]), 0, `NEW_FOOTPRINT_ZERO no ${table} row for the fresh human`);
      }
      const held = (await accountReferences(fresh)).filter((key) => key.held > 0);
      assert.deepEqual(held.map((key) => key.relation), [], 'NEW_FOOTPRINT_ZERO the fresh account holds no Matching deletion blocker');
    });

    await report.isolated('SELF_INSPECTION_ALLOWED the projection answers its own caller and writes nothing', async () => {
      const setup = await existingSetup(one);
      await asRole('authenticated', fresh);
      const [nothing] = await rt.setup();
      assert.deepEqual([nothing.participation_state, nothing.matching_context_grant_id, nothing.introduction_profile_version_id],
        ['OFF', null, null], 'SELF_INSPECTION_ALLOWED a fresh human sees OFF and no authority');
      await asRole('authenticated', one);
      const [mine] = await rt.setup();
      assert.equal(mine.participation_state, 'ACTIVE');
      assert.equal(mine.matching_context_grant_id, setup.grant);
      assert.equal(mine.introduction_profile_version_id, setup.profile);
      assert.equal(mine.matching_requirement_version_id, setup.requirements);
      assert.equal(mine.pre_match_disclosure_authority_id, setup.authority);
      await asRole('postgres');
      assert.equal(await count(M.LOCKS, 'user_id = $1', [fresh]), 0, 'SELF_INSPECTION_ALLOWED inspecting creates no lock row (T7)');
    });

    await report.isolated('DIRECT_RPC_DENY an existing human cannot widen or correct their setup', async () => {
      const setup = await existingSetup(one);
      await asRole('authenticated', one);
      await rejected(() => rt.setProfile(randomUUID(), PROFILE_V2, setup.profile), ['42501'], PERMISSION_DENIED);
      await rejected(() => rt.setRequirements(randomUUID(), REQUIREMENTS, setup.requirements), ['42501'], PERMISSION_DENIED);
      await rejected(() => rt.grantContext(randomUUID(), randomUUID(), setup.grant), ['42501'], PERMISSION_DENIED);
      await rejected(() => rt.grantDisclosure(randomUUID(), randomUUID(), setup.profile, ['life_stage', 'children_plan'], setup.authority),
        ['42501'], PERMISSION_DENIED);
      const [paused] = await rt.pause(randomUUID(), setup.act);
      await rejected(() => rt.resume(randomUUID(), paused.participation_event_id), ['42501'], PERMISSION_DENIED);
      const [off] = await rt.turnOff(randomUUID(), paused.participation_event_id);
      await rejected(() => rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY', off.participation_event_id), ['42501'], PERMISSION_DENIED);
      await asRole('postgres');
      assert.equal(await count(M.PROFILE_VERSIONS, 'owner_user_id = $1', [one]), 1, 'DIRECT_RPC_DENY no profile correction committed');
      assert.equal(await count(M.REQUIREMENT_VERSIONS, 'owner_user_id = $1', [one]), 1, 'DIRECT_RPC_DENY no requirement correction committed');
    });

    await report.isolated('EXISTING_TURN_OFF_ALLOWED pause and turn off work under a real authenticated session', async () => {
      const setup = await existingSetup(one);
      await asRole('authenticated', one);
      const [paused] = await rt.pause(randomUUID(), setup.act);
      assert.deepEqual([paused.participation_state, paused.pause_reason], ['PAUSED', 'USER_PAUSED']);
      const [off] = await rt.turnOff(randomUUID(), paused.participation_event_id);
      assert.equal(off.participation_state, 'OFF', 'EXISTING_TURN_OFF_ALLOWED opting out works from a pause');
      await asRole('postgres');
      const again = await existingSetup(two);
      await asRole('authenticated', two);
      const [direct] = await rt.turnOff(randomUUID(), again.act);
      assert.equal(direct.participation_state, 'OFF', 'EXISTING_TURN_OFF_ALLOWED and straight from ACTIVE');
      const [state] = await rt.setup();
      assert.equal(state.participation_state, 'OFF');
      assert.equal(state.matching_context_grant_id, again.grant, 'turning off revokes no separately owned authority');
    });

    await report.isolated('EXISTING_REVOKE_ALLOWED both revocations work while ACTIVE, PAUSED and OFF', async () => {
      const setup = await existingSetup(one);
      await asRole('authenticated', one);
      const [revokedWhileActive] = await rt.revokeContext(randomUUID(), setup.grant);
      assert.equal(revokedWhileActive.grant_status, 'REVOKED', 'EXISTING_REVOKE_ALLOWED the grant is revoked while ACTIVE');
      const [paused] = await rt.pause(randomUUID(), setup.act);
      const [revokedWhilePaused] = await rt.revokeDisclosure(randomUUID(), setup.authority);
      assert.equal(revokedWhilePaused.authority_event_type, 'REVOKED', 'EXISTING_REVOKE_ALLOWED the authority is revoked while PAUSED');
      await asRole('postgres');
      const other = await existingSetup(two);
      await asRole('authenticated', two);
      await rt.turnOff(randomUUID(), other.act);
      const [contextWhileOff] = await rt.revokeContext(randomUUID(), other.grant);
      const [authorityWhileOff] = await rt.revokeDisclosure(randomUUID(), other.authority);
      assert.deepEqual([contextWhileOff.grant_status, authorityWhileOff.authority_event_type], ['REVOKED', 'REVOKED'],
        'EXISTING_REVOKE_ALLOWED both revocations work while OFF');
      await asRole('authenticated', one);
      const [state] = await rt.setup();
      assert.deepEqual([state.participation_state, state.matching_context_grant_id, state.pre_match_disclosure_authority_id],
        ['PAUSED', null, null], 'self-inspection reflects both revocations');
      assert.equal(paused.participation_state, 'PAUSED');
      await asRole('postgres');
      assert.equal(await count(M.CONSENT, 'grantor_user_id = $1', [one]), 2, 'grant and revocation are both history');
      assert.equal(await count(M.AUTHORITY_FIELDS, 'authority_id = $1', [setup.authority]), 1, 'the approved-field history survives');
      assert.equal(await count(M.PROFILE_VERSIONS, 'owner_user_id = $1', [one]), 1, 'the profile itself is untouched');
    });

    await report.isolated('OWNER_ONLY another human cannot reach or move anything that is not theirs', async () => {
      const setup = await existingSetup(one);
      await asRole('authenticated', two);
      const theirs = await rejected(() => rt.revokeContext(randomUUID(), setup.grant), ['P0002'], /MATCHING_GRANT_NOT_FOUND/u);
      const nothing = await rejected(() => rt.revokeContext(randomUUID(), randomUUID()), ['P0002'], /MATCHING_GRANT_NOT_FOUND/u);
      assert.equal(theirs.message, nothing.message, 'OWNER_ONLY another human grant is reported exactly as a nonexistent one');
      await rejected(() => rt.revokeDisclosure(randomUUID(), setup.authority), ['P0002'], /MATCHING_DISCLOSURE_AUTHORITY_NOT_FOUND/u);
      await rejected(() => rt.pause(randomUUID(), setup.act), ['40001'], /MATCHING_STALE_STATE/u);
      await rejected(() => rt.turnOff(randomUUID(), setup.act), ['40001'], /MATCHING_STALE_STATE/u);
      const [seen] = await rt.setup();
      assert.deepEqual([seen.participation_state, seen.matching_context_grant_id], ['OFF', null], 'OWNER_ONLY two sees only themself');
      await asRole('authenticated', one);
      const [untouched] = await rt.setup();
      assert.deepEqual([untouched.participation_state, untouched.matching_context_grant_id, untouched.pre_match_disclosure_authority_id],
        ['ACTIVE', setup.grant, setup.authority], 'OWNER_ONLY nothing of one moved');
    });

    await report.isolated('IDEMPOTENT_RETRY retained retries are exact, conflicts fail closed, suspended replays are refused', async () => {
      const setup = await existingSetup(one);
      await asRole('authenticated', one);
      const pauseId = randomUUID();
      const [first] = await rt.pause(pauseId, setup.act);
      const [retry] = await rt.pause(pauseId, setup.act);
      assert.deepEqual(retry, first, 'IDEMPOTENT_RETRY an equivalent pause retry returns the committed answer');
      await rejected(() => rt.pause(pauseId, randomUUID()), ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      const revokeId = randomUUID();
      const [revoked] = await rt.revokeContext(revokeId, setup.grant);
      assert.deepEqual((await rt.revokeContext(revokeId, setup.grant))[0], revoked, 'IDEMPOTENT_RETRY a revocation retry is exact');
      await rejected(() => rt.revokeContext(revokeId, randomUUID()), ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      // The amended retry law: a replay of a command committed before 0149 is refused before it can be read back.
      await rejected(() => rt.activate(setup.activation, 'MANUAL_MY_WORLD_ENTRY'), ['42501'], PERMISSION_DENIED);
      await asRole('postgres');
      assert.equal(await count(M.ACTS, 'participant_user_id = $1', [one]), 2, 'IDEMPOTENT_RETRY exactly the activation and one pause');
      assert.equal(await count(M.CONSENT, 'grantor_user_id = $1', [one]), 2, 'IDEMPOTENT_RETRY exactly the grant and one revocation');
    });

    await report.isolated('HOSTED_DEFAULT_PRIVILEGES re-applying 0149 over the hosted posture closes the six and keeps every row', async () => {
      const setup = await existingSetup(one);
      const snapshot = async () => (await rows(
        `SELECT ${MATCHING_TABLES.map((t, i) => `(SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) FROM ${t} x) AS t${i}`).join(', ')}`))[0];
      const before = await snapshot();
      // What a hosted project's default privileges and PostgreSQL's own default would leave on a function created
      // without 0109's revoke, plus a grant a client role only INHERITS.
      const six = SEC_MATCH_00_SUSPENDED.join(', ');
      await q(`GRANT EXECUTE ON FUNCTION ${six} TO PUBLIC, anon, authenticated, service_role`);
      await q('CREATE ROLE sec_match_00_inherited_grant NOLOGIN');
      await q(`GRANT EXECUTE ON FUNCTION ${six} TO sec_match_00_inherited_grant`);
      await q('GRANT sec_match_00_inherited_grant TO authenticated');
      for (const role of ['public', ...APP_ROLES, 'sec_match_00_inherited_grant']) {
        assert.equal(await rt.canExecute(role, MFN.ACTIVATE), true, `the hosted drift is real: ${role} executes before 0149`);
      }
      await asRole('authenticated', fresh);
      const [drifted] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
      assert.equal(drifted.participation_state, 'ACTIVE', 'the drift is real: a fresh human can activate before 0149');
      await asRole('postgres');
      const afterDrift = await snapshot();
      await q(migrationBody());
      await verifySuspendedPosture();
      assert.equal(await rt.canExecute('sec_match_00_inherited_grant', MFN.ACTIVATE), false, 'the inherited grantee lost it too');
      assert.deepEqual(await snapshot(), afterDrift, 'HOSTED_DEFAULT_PRIVILEGES applying 0149 changes no Matching row');
      assert.notDeepEqual(afterDrift, before, 'and the snapshot really does see Matching rows change');
      assert.equal(await rt.currentActOf(one), setup.act, 'the existing human participation is exactly as it was');
    });

    await report.isolated('DELETION_BASELINE_UNCHANGED an existing footprint still blocks erasure; nothing is erased', async () => {
      await existingSetup(one);
      const held = (await accountReferences(one)).filter((key) => key.held > 0).map((key) => key.relation);
      assert.ok(held.includes('matching_setup_locks') || held.includes('public.matching_setup_locks'),
        'DELETION_BASELINE_UNCHANGED the lock row still references the account RESTRICT: the 0130 hard stop still answers BLOCKED');
      // And no governed path removes it: the lock row refuses DELETE even for its owner, exactly as 0108 froze it.
      await rejected(() => q(`DELETE FROM ${M.LOCKS} WHERE user_id = $1`, [one]), ['55000'], /MATCHING_SETUP_LOCK_IS_DURABLE/u);
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ----------------------------------------------------------- 3. serialization
async function verifyConcurrency(report, humans) {
  // A fourth human, because this is the one section that COMMITS.
  const human = humans[3];
  await actAs(human);
  const [active] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
  await asRole('postgres');
  const { q2, close } = await rt.openSecondary();
  try {
    await report.section('X01 two concurrent retained commands of one human serialize on the caller own lock row', async () => {
      await q('BEGIN');
      await asRole('authenticated', human);
      const [paused] = await rt.pause(randomUUID(), active.participation_event_id);
      assert.equal(paused.participation_state, 'PAUSED', 'X01 the first command holds the caller lock row');
      await q2('BEGIN');
      await q2('SET LOCAL ROLE authenticated');
      await q2("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: human, role: 'authenticated' })]);
      const contender = q2('SELECT * FROM public.turn_off_matching_participation_v1($1, $2)', [randomUUID(), active.participation_event_id]);
      assert.equal(await rt.stillPending(contender), true, 'X01 the second command waits on the lock row rather than racing past it');
      await q('COMMIT');
      let refusal = null;
      try {
        await contender;
      } catch (error) {
        refusal = error;
      }
      assert.ok(refusal, 'X01 the loser is refused rather than forking the history');
      assert.equal(refusal.code, '40001', 'X01 and the refusal is the bounded stale-state one');
      await q2('ROLLBACK');
      await asRole('postgres');
      assert.equal(await rt.currentActOf(human), paused.participation_event_id, 'X01 the pointer names the winner');
      assert.equal(await count(M.ACTS, 'participant_user_id = $1', [human]), 2, 'X01 the activation and exactly one pause');
    });
  } finally {
    await close();
  }
}

// --------------------------------------------------------- 4. forward safety
async function verifyForwardSafety(report, humans) {
  const [fresh] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('f1 the terminal assertion refuses a posture in which authenticated inherits the owner', async () => {
      await q('GRANT postgres TO authenticated');
      assert.equal(await rt.canExecute('authenticated', MFN.ACTIVATE), true, 'f1 the inherited owner privilege is real');
      await rejected(() => q(migrationBody()), ['P0001'], /SEC-MATCH-00: authenticated must not execute/u);
    });

    await report.probe('f2 the regression check refuses a reopened direct grant', {
      pristine: `REVOKE EXECUTE ON FUNCTION ${MFN.ACTIVATE} FROM authenticated`,
      mutate: (text) => text.replace('REVOKE EXECUTE', 'GRANT EXECUTE').replace(' FROM authenticated', ' TO authenticated'),
      marker: 'TO authenticated',
      apply: (text) => q(text),
      reject: () => verifySuspendedPosture(),
    });

    await report.probe('f3 the census refuses a client-executable wrapper around a suspended command', {
      pristine: `CREATE FUNCTION public.sec_match_00_probe_wrapper_v1() RETURNS SETOF record
                 LANGUAGE sql SECURITY DEFINER SET search_path='' AS $probe$
                   SELECT * FROM public.get_my_matching_setup_v1() $probe$`,
      mutate: (text) => text.replace('SELECT * FROM public.get_my_matching_setup_v1()',
        "SELECT * FROM public.activate_matching_participation_v1(gen_random_uuid(), 'MANUAL_MY_WORLD_ENTRY', NULL)"),
      marker: 'activate_matching_participation_v1',
      apply: async (text) => {
        await q(text);
        await q('GRANT EXECUTE ON FUNCTION public.sec_match_00_probe_wrapper_v1() TO authenticated');
      },
      reject: () => verifyNoBackdoor(),
    });

    await report.isolated('the regression checks pass again once the probes are rolled back', async () => {
      await asRole('authenticated', fresh);
      await rejected(CALL[MFN.ACTIVATE], ['42501'], PERMISSION_DENIED);
      await asRole('postgres');
      await verifySuspendedPosture();
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ---------------------------------------------------------------------- main
await runVerifier('0149', async (stage) => {
  await rt.client.connect();
  const report = createScenarioReport('0149', { query: q, restore: () => asRole('postgres') });
  // A fresh human who must stay footprint-free, two humans for the rolled-back existing-state sections, and a fourth
  // for the ONE section that commits.
  const humans = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  try {
    stage('catalog');
    await verifyCatalog(report);
    stage('fixture');
    await rt.provisionHumans(humans);
    stage('client behaviour');
    await verifyClients(report, humans);
    stage('serialization');
    await verifyConcurrency(report, humans);
    stage('forward safety');
    await verifyForwardSafety(report, humans);
  } finally {
    stage('fixture removal');
    await rt.removeCommittedMatchingSetup(humans);
    await rt.removeFixtureHumans(humans);
  }

  stage('report');
  await asRole('postgres');
  await report.section('the 0149 posture is intact after every fixture and probe is gone', verifySuspendedPosture);
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${M.ACTS} WHERE participant_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${M.GRANTS} WHERE grantor_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${M.PROFILE_VERSIONS} WHERE owner_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${M.AUTHORITIES} WHERE grantor_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${M.LOCKS} WHERE user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
          + (SELECT count(*) FROM pg_roles WHERE rolname = 'sec_match_00_inherited_grant') AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
