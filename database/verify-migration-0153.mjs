// IP-IMP-01 — Interaction Preferences v1: the real-PostgreSQL verifier for migration 0153.
//
// It proves, against a FULLY migrated database (never grep alone):
//   1. catalog and privilege boundary: the record's closed CHECKs, RLS with an owner-only SELECT policy, no client write;
//      every 0153 function's schema, security mode, empty search_path and postgres owner; the write core executable by
//      no application role; the owner commands by `authenticated` only; the conversation command by `service_role` only;
//      nothing for anon or PUBLIC;
//   2. Export My Data: the live builder is the 0130 body plus exactly the one added `interactionPreferences` section;
//   3. the owner's Settings command: absent = all DEFAULT / version 0; SAVED advances the version by one; repeating a held
//      value is UNCHANGED (idempotent replay); a different value under a version the caller did not read is STALE and
//      changes nothing (a stale write never overwrites a newer value); DEFAULT is the reset; invalid field / value /
//      version refused; the record's CHECKs refuse an invalid value even from the table owner;
//   4. isolation: another account neither reads nor changes the record; anon reaches nothing;
//   5. the conversation command: ONE transaction finalizes the GENERATING turn with the reply for the outcome actually
//      committed (SAVED / UNCHANGED / STALE) and its completed-turn outbox event; a replay (the turn no longer
//      GENERATING) writes nothing; an injected failure leaves nothing; no Memory, Memory attribution or Memory command
//      is ever written; a client role cannot run it;
//   6. the legacy review: adopts only the owner's ACTIVE, unexpired, SELF INTERACTION_PREFERENCE Memory - OTHER,
//      UNATTRIBUTED, forgotten, expired, another type and another account's are NOT_ELIGIBLE - and never changes the
//      Memory;
//   7. two concurrent first writes of one owner serialize on the owner lock: one SAVED, the other STALE, no deadlock;
//   8. Export My Data carries the record in readable words (all "automatic" without a row), no identifier;
//   9. the governed Personal erasure (0130) leaves no row of the erased account, and another account untouched.
// Every stage but 7 runs inside a transaction that is rolled back; 7 commits its two fixture accounts and removes them.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { cleanupVerifierUsers } from './verifier-fixture-cleanup.mjs';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(root, 'database/migrations');
const migrationText = (name) => readFileSync(join(MIGRATIONS, name), 'utf8').replace(/\r\n/gu, '\n');
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = [], on = client) => (await on.query(text, values)).rows;
const one = async (text, values = [], on = client) => (await rows(text, values, on))[0];
const count = async (text, values = [], on = client) => Number((await one(text, values, on)).n);

async function rejected(operation, codes, on = client) {
  let refusal;
  await on.query('SAVEPOINT expected_refusal');
  try { await operation(); } catch (error) { refusal = error; } finally {
    await on.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await on.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code} (${refusal.message})`);
  return refusal;
}
async function actAs(role, userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [userId ? JSON.stringify({ sub: userId, role }) : '{}']);
}
async function asOwner(on = client) {
  await on.query('RESET ROLE');
  await on.query("SELECT set_config('request.jwt.claims', '{}', true)");
}
async function account(on = client) {
  const id = randomUUID();
  await on.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  return id;
}
async function inTransaction(work) {
  await client.query('BEGIN');
  try { await work(); } finally { await client.query('ROLLBACK'); }
}

const SET = 'SELECT * FROM public.set_own_interaction_preference_v1($1, $2, $3)';
const LEGACY = 'SELECT * FROM public.apply_own_legacy_interaction_preference_v1($1, $2, $3, $4)';
const FINALIZE = 'SELECT * FROM public.server_finalize_interaction_preference_turn_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)';
const RECORD = 'SELECT reply_length, reply_language, humour, explanation_style, version FROM public.interaction_preferences WHERE user_id = $1';
const DEFAULTS = { reply_length: 'DEFAULT', reply_language: 'DEFAULT', humour: 'DEFAULT', explanation_style: 'DEFAULT' };

async function setOwn(userId, field, value, version, on = client) {
  await actAs('authenticated', userId, on);
  const answer = await one(SET, [field, value, version], on);
  await asOwner(on);
  return answer;
}

let tick = 0;
const nextInstant = () => new Date(Date.UTC(2026, 9, 12, 9, 0, 0) + 1000 * tick++).toISOString();
async function session(userId) {
  const id = randomUUID();
  await client.query("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, userId]);
  return id;
}
async function generatingTurn(userId, sessionId, content) {
  const id = randomUUID();
  const at = nextInstant();
  await client.query(
    `INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, created_at, updated_at)
     VALUES ($1, $2, $3, 'USER', 'GENERATING', $4, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', $5, $5)`,
    [id, sessionId, userId, content, at],
  );
  return id;
}
/**
 * One owned Memory written as the table owner, attributed while it is current (the 0152 insert guard). A forgotten
 * fixture is forgotten after its attribution; an expired one is written with its attribution in replica mode (this
 * transaction is rolled back), because a Memory cannot be both attributable and already expired.
 */
async function memory(userId, { content, type = 'INTERACTION_PREFERENCE', forgotten = false, subject = 'SELF', expired = false }) {
  const id = randomUUID();
  if (expired) await client.query("SET LOCAL session_replication_role = 'replica'");
  await client.query(
    `INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status, created_at, updated_at, expires_at)
     VALUES ($1, $2, $3, $4, 'USER_STATED', 0.95, 0.9, 'ACTIVE', now() - CASE WHEN $5 THEN interval '2 days' ELSE interval '0' END,
             now() - CASE WHEN $5 THEN interval '2 days' ELSE interval '0' END, CASE WHEN $5 THEN now() - interval '1 day' END)`,
    [id, userId, type, content, expired],
  );
  if (subject) await client.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis) VALUES ($1, $2, $3, 'EXPLICIT_STATEMENT')", [id, userId, subject]);
  if (expired) await client.query("SET LOCAL session_replication_role = 'origin'");
  if (forgotten) await client.query("UPDATE public.memories SET status = 'DELETED', updated_at = now() WHERE id = $1", [id]);
  return id;
}

// ------------------------------------------------------------------------------------------------------------------
async function verifyCatalog() {
  stage = 'catalog: the record, its CHECKs, RLS and the one owner SELECT policy';
  const columns = await rows(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interaction_preferences' ORDER BY ordinal_position`);
  assert.deepEqual(columns.map((c) => c.column_name), ['user_id', 'reply_length', 'reply_language', 'humour', 'explanation_style', 'version', 'updated_at']);
  assert.ok(columns.every((c) => c.is_nullable === 'NO'), 'no nullable column');
  const checks = (await rows(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid = 'public.interaction_preferences'::regclass AND contype = 'c' ORDER BY conname`)).map((c) => c.conname);
  assert.deepEqual(checks, ['interaction_preferences_explanation_style_check', 'interaction_preferences_humour_check',
    'interaction_preferences_reply_language_check', 'interaction_preferences_reply_length_check', 'interaction_preferences_version_check']);
  const fk = await one(`SELECT confrelid::regclass::text AS target, confdeltype FROM pg_constraint
    WHERE conrelid = 'public.interaction_preferences'::regclass AND contype = 'f'`);
  assert.deepEqual(fk, { target: 'users', confdeltype: 'c' }, 'user_id REFERENCES public.users ON DELETE CASCADE');
  assert.equal((await one("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.interaction_preferences'::regclass")).relrowsecurity, true);
  const policies = await rows("SELECT policyname, cmd, roles::text[] AS roles, qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'interaction_preferences'");
  assert.equal(policies.length, 1);
  assert.equal(policies[0].cmd, 'SELECT');
  assert.deepEqual(policies[0].roles, ['authenticated']);
  assert.match(policies[0].qual, /user_id = \( SELECT auth\.uid\(\)/u);
  for (const [role, privilege, expected] of [
    ['anon', 'SELECT', false], ['anon', 'INSERT', false], ['authenticated', 'SELECT', true], ['authenticated', 'INSERT', false],
    ['authenticated', 'UPDATE', false], ['authenticated', 'DELETE', false], ['service_role', 'SELECT', false], ['service_role', 'UPDATE', false],
  ]) {
    assert.equal((await one('SELECT has_table_privilege($1, \'public.interaction_preferences\', $2) AS v', [role, privilege])).v, expected, `${role} ${privilege}`);
  }

  stage = 'catalog: every 0153 function - schema, security, search_path, owner, and exactly who may run it';
  const FUNCTIONS = {
    'interaction_preference_private.apply_v1(uuid,text,text,integer)': { definer: true, roles: [] },
    'interaction_preference_private.set_own_interaction_preference_v1(text,text,integer)': { definer: true, roles: ['authenticated'] },
    'interaction_preference_private.apply_own_legacy_interaction_preference_v1(uuid,text,text,integer)': { definer: true, roles: ['authenticated'] },
    'public.set_own_interaction_preference_v1(text,text,integer)': { definer: false, roles: ['authenticated'] },
    'public.apply_own_legacy_interaction_preference_v1(uuid,text,text,integer)': { definer: false, roles: ['authenticated'] },
    'public.server_finalize_interaction_preference_turn_v1(uuid,uuid,uuid,uuid,text,text,integer,text,text,text,uuid,uuid,uuid)': { definer: true, roles: ['service_role'] },
  };
  for (const [signature, expected] of Object.entries(FUNCTIONS)) {
    const f = await one(`SELECT p.prosecdef, p.proconfig::text[] AS config, pg_get_userbyid(p.proowner) AS owner,
      has_function_privilege('public', p.oid, 'EXECUTE') AS public_exec FROM pg_proc p WHERE p.oid = $1::regprocedure`, [signature]);
    assert.equal(f.prosecdef, expected.definer, `${signature} security mode`);
    assert.deepEqual(f.config, ['search_path=""'], `${signature} has an empty search_path`);
    assert.equal(f.owner, 'postgres', `${signature} is owned by postgres`);
    assert.equal(f.public_exec, false, `${signature} keeps no PUBLIC EXECUTE`);
    const schema = signature.split('.')[0];
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const reach = await one(`SELECT has_function_privilege($1, $2::regprocedure, 'EXECUTE') AND has_schema_privilege($1, $3, 'USAGE') AS v`, [role, signature, schema]);
      assert.equal(reach.v, expected.roles.includes(role), `${role} ${expected.roles.includes(role) ? 'may' : 'may not'} run ${signature}`);
    }
  }
  const own = await rows(`SELECT n.nspname || '.' || p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'interaction_preference_private' ORDER BY 1`);
  assert.deepEqual(own.map((r) => r.name), ['interaction_preference_private.apply_own_legacy_interaction_preference_v1',
    'interaction_preference_private.apply_v1', 'interaction_preference_private.set_own_interaction_preference_v1'], 'the private schema holds exactly three functions');
  assert.equal((await one("SELECT has_schema_privilege('anon', 'interaction_preference_private', 'USAGE') AS v")).v, false);
  assert.equal((await one("SELECT has_schema_privilege('service_role', 'interaction_preference_private', 'USAGE') AS v")).v, false);

  stage = 'catalog: Export My Data is the 0130 body plus exactly the one added section';
  const body = (text, marker) => {
    const start = text.indexOf(marker);
    assert.ok(start >= 0, `${marker} found`);
    const open = text.indexOf('AS $$', start) + 'AS $$'.length;
    return text.slice(open, text.indexOf('$$;', open));
  };
  const defined0130 = body(migrationText('0130_personal_privacy_export_account_deletion_v1.sql'), 'CREATE FUNCTION personal_data_private.build_personal_export_v1(');
  const defined0153 = body(migrationText('0153_interaction_preferences_v1.sql'), 'CREATE OR REPLACE FUNCTION personal_data_private.build_personal_export_v1(');
  const live = (await one("SELECT prosrc FROM pg_proc WHERE oid = 'personal_data_private.build_personal_export_v1(uuid)'::regprocedure")).prosrc.replace(/\r\n/gu, '\n');
  assert.equal(live, defined0153, 'the live builder is the 0153 body');
  const addedStart = defined0153.indexOf("        -- IP-IMP-01 (0153)");
  const addedEnd = defined0153.indexOf("        'notYetIncluded'");
  assert.ok(addedStart > 0 && addedEnd > addedStart);
  assert.equal(defined0153.slice(0, addedStart) + defined0153.slice(addedEnd), defined0130, 'every other line is 0130\'s, verbatim');
  const posture = await one(`SELECT p.prosecdef, p.proconfig::text[] AS config, pg_get_userbyid(p.proowner) AS owner, p.provolatile
    FROM pg_proc p WHERE p.oid = 'personal_data_private.build_personal_export_v1(uuid)'::regprocedure`);
  assert.deepEqual(posture, { prosecdef: false, config: ['search_path=""'], owner: 'postgres', provolatile: 's' }, 'the builder keeps its 0130 posture');
}

// ------------------------------------------------------------------------------------------------------------------
async function verifySettingsCommand() {
  await inTransaction(async () => {
    const alice = await account();
    const bob = await account();

    stage = 'settings: no row is the "no durable declaration" state';
    await actAs('authenticated', alice);
    assert.deepEqual(await rows(RECORD, [alice]), []);
    await asOwner();

    stage = 'settings: SAVED advances the version by one and changes exactly one field';
    assert.deepEqual(await setOwn(alice, 'REPLY_LANGUAGE', 'EGYPTIAN_ARABIC', 0), { outcome: 'SAVED', version: 1 });
    assert.deepEqual(await one(RECORD, [alice]), { ...DEFAULTS, reply_language: 'EGYPTIAN_ARABIC', version: 1 });

    stage = 'settings: a held value is UNCHANGED, whatever version the replay names (idempotent)';
    assert.deepEqual(await setOwn(alice, 'REPLY_LANGUAGE', 'EGYPTIAN_ARABIC', 0), { outcome: 'UNCHANGED', version: 1 });
    assert.deepEqual(await setOwn(alice, 'REPLY_LANGUAGE', 'EGYPTIAN_ARABIC', 1), { outcome: 'UNCHANGED', version: 1 });
    assert.equal((await one(RECORD, [alice])).version, 1);

    stage = 'settings: a different value under a version the caller did not read is STALE and changes nothing';
    assert.deepEqual(await setOwn(alice, 'REPLY_LANGUAGE', 'ENGLISH', 0), { outcome: 'STALE', version: 1 });
    assert.deepEqual(await setOwn(alice, 'HUMOUR', 'WELCOME', 0), { outcome: 'STALE', version: 1 });
    assert.deepEqual(await one(RECORD, [alice]), { ...DEFAULTS, reply_language: 'EGYPTIAN_ARABIC', version: 1 });

    stage = 'settings: each field independently, every approved value, then the reset';
    let version = 1;
    for (const [field, value] of [['REPLY_LENGTH', 'ALWAYS_BRIEF'], ['HUMOUR', 'DECLINED'], ['HUMOUR', 'WELCOME'], ['EXPLANATION_STYLE', 'SIMPLER'],
      ['EXPLANATION_STYLE', 'DIRECT'], ['EXPLANATION_STYLE', 'SIMPLER_AND_DIRECT'], ['REPLY_LANGUAGE', 'MODERN_STANDARD_ARABIC'],
      ['REPLY_LANGUAGE', 'LEVANTINE_ARABIC'], ['REPLY_LANGUAGE', 'GULF_ARABIC'], ['REPLY_LANGUAGE', 'MAGHREBI_ARABIC'], ['REPLY_LANGUAGE', 'ENGLISH']]) {
      assert.deepEqual(await setOwn(alice, field, value, version), { outcome: 'SAVED', version: version + 1 }, `${field}=${value}`);
      version += 1;
    }
    assert.deepEqual(await one(RECORD, [alice]), { reply_length: 'ALWAYS_BRIEF', reply_language: 'ENGLISH', humour: 'WELCOME', explanation_style: 'SIMPLER_AND_DIRECT', version });
    for (const field of ['REPLY_LENGTH', 'REPLY_LANGUAGE', 'HUMOUR', 'EXPLANATION_STYLE']) {
      assert.deepEqual(await setOwn(alice, field, 'DEFAULT', version), { outcome: 'SAVED', version: version + 1 }, `${field} reset`);
      version += 1;
    }
    assert.deepEqual(await one(RECORD, [alice]), { ...DEFAULTS, version });

    stage = 'settings: invalid field, value or version is refused; the CHECKs hold even for the table owner';
    await actAs('authenticated', alice);
    await rejected(() => client.query(SET, ['TONE', 'DEFAULT', version]), ['22023']);
    await rejected(() => client.query(SET, ['HUMOUR', 'ALWAYS_BRIEF', version]), ['22023']);
    await rejected(() => client.query(SET, ['REPLY_LANGUAGE', 'ARABIC', version]), ['22023']);
    await rejected(() => client.query(SET, ['HUMOUR', 'WELCOME', -1]), ['22023']);
    await rejected(() => client.query(SET, ['HUMOUR', 'WELCOME', null]), ['22023']);
    await asOwner();
    await rejected(() => client.query("UPDATE public.interaction_preferences SET humour = 'SARCASTIC' WHERE user_id = $1", [alice]), ['23514']);
    await rejected(() => client.query("UPDATE public.interaction_preferences SET reply_language = 'ARABIC' WHERE user_id = $1", [alice]), ['23514']);
    await rejected(() => client.query('UPDATE public.interaction_preferences SET version = -1 WHERE user_id = $1', [alice]), ['23514']);

    stage = 'isolation: another account neither reads nor changes the record; no client writes the table directly';
    assert.deepEqual(await setOwn(bob, 'HUMOUR', 'DECLINED', 0), { outcome: 'SAVED', version: 1 });
    await actAs('authenticated', bob);
    assert.deepEqual(await rows('SELECT user_id FROM public.interaction_preferences'), [{ user_id: bob }], 'bob sees only his own row');
    await rejected(() => client.query("UPDATE public.interaction_preferences SET humour = 'WELCOME' WHERE user_id = $1", [alice]), ['42501']);
    await rejected(() => client.query("INSERT INTO public.interaction_preferences (user_id) VALUES ($1)", [randomUUID()]), ['42501']);
    await rejected(() => client.query('SELECT * FROM interaction_preference_private.apply_v1($1, $2, $3, $4)', [alice, 'HUMOUR', 'WELCOME', version]), ['42501']);
    await actAs('anon');
    await rejected(() => client.query(SET, ['HUMOUR', 'WELCOME', 0]), ['42501']);
    await rejected(() => client.query('SELECT * FROM public.interaction_preferences'), ['42501']);
    await asOwner();
    assert.deepEqual(await one(RECORD, [alice]), { ...DEFAULTS, version }, 'alice is untouched by bob');
    await actAs('authenticated', null);
    await rejected(() => client.query(SET, ['HUMOUR', 'WELCOME', 0]), ['42501']);
    await asOwner();
  });
}

// ------------------------------------------------------------------------------------------------------------------
async function verifyConversationCommand() {
  await inTransaction(async () => {
    const alice = await account();
    const sessionId = await session(alice);
    const memoryFootprint = async () => count(`SELECT (SELECT count(*) FROM public.memories WHERE user_id = $1)
      + (SELECT count(*) FROM public.memory_subject_attributions WHERE user_id = $1)
      + (SELECT count(*) FROM public.memory_control_commands WHERE user_id = $1) AS n`, [alice]);
    const finalize = async (turnId, field, value, expectedVersion, on = client) => {
      await actAs('service_role', null, on);
      const result = await rows(FINALIZE, [sessionId, alice, turnId, randomUUID(), field, value, expectedVersion,
        'saved reply', 'unchanged reply', 'stale reply', randomUUID()], on);
      await asOwner(on);
      return result;
    };
    const assistantFor = async (turnId) => rows("SELECT content, status FROM public.conversation_turns WHERE source_turn_id = $1 AND role = 'ASSISTANT'", [turnId]);
    const statusOf = async (turnId) => (await one('SELECT status FROM public.conversation_turns WHERE id = $1', [turnId])).status;
    const events = async (turnId) => count("SELECT count(*) AS n FROM public.runtime_event_outbox WHERE subject_turn_id = $1 AND event_type = 'ConversationTurnCompleted'", [turnId]);

    stage = 'command: SAVED commits the change, the reply and the completed-turn event in one transaction';
    const first = await generatingTurn(alice, sessionId, 'كلمني دايمًا بالمصري');
    const [saved] = await finalize(first, 'REPLY_LANGUAGE', 'EGYPTIAN_ARABIC', 0);
    assert.equal(saved.outcome, 'SAVED');
    assert.equal(saved.version, 1);
    assert.equal(saved.user_turn.status, 'COMPLETED');
    assert.equal(saved.assistant_turn.content, 'saved reply');
    assert.deepEqual(await assistantFor(first), [{ content: 'saved reply', status: 'COMPLETED' }]);
    assert.equal(await events(first), 1);
    assert.deepEqual(await one(RECORD, [alice]), { ...DEFAULTS, reply_language: 'EGYPTIAN_ARABIC', version: 1 });

    stage = 'command: a replay of the same turn (no longer GENERATING) writes nothing and answers no row';
    assert.deepEqual(await finalize(first, 'REPLY_LANGUAGE', 'ENGLISH', 1), []);
    assert.deepEqual(await one(RECORD, [alice]), { ...DEFAULTS, reply_language: 'EGYPTIAN_ARABIC', version: 1 });
    assert.equal((await assistantFor(first)).length, 1);
    assert.equal(await events(first), 1);

    stage = 'command: UNCHANGED and STALE are committed with their own replies; STALE never overwrites the newer value';
    const again = await generatingTurn(alice, sessionId, 'من هنا ورايح كلمني بالمصري');
    assert.equal((await finalize(again, 'REPLY_LANGUAGE', 'EGYPTIAN_ARABIC', 0))[0].outcome, 'UNCHANGED');
    assert.deepEqual(await assistantFor(again), [{ content: 'unchanged reply', status: 'COMPLETED' }]);
    const stale = await generatingTurn(alice, sessionId, 'دايمًا كلمني بالإنجليزي');
    const [refused] = await finalize(stale, 'REPLY_LANGUAGE', 'ENGLISH', 0);
    assert.equal(refused.outcome, 'STALE');
    assert.deepEqual(await assistantFor(stale), [{ content: 'stale reply', status: 'COMPLETED' }]);
    assert.deepEqual(await one(RECORD, [alice]), { ...DEFAULTS, reply_language: 'EGYPTIAN_ARABIC', version: 1 });

    stage = 'command: an injected failure leaves nothing - no change, no reply, the turn still GENERATING';
    const failing = await generatingTurn(alice, sessionId, 'دايمًا اختصر');
    await actAs('service_role');
    await rejected(() => client.query(FINALIZE, [sessionId, alice, failing, randomUUID(), 'REPLY_LENGTH', 'SOMETIMES', 1, 'saved', 'unchanged', 'stale', randomUUID()]), ['22023']);
    await rejected(() => client.query(FINALIZE, [sessionId, alice, failing, randomUUID(), 'REPLY_LENGTH', 'ALWAYS_BRIEF', 1, '  ', 'unchanged', 'stale', randomUUID()]), ['22023']);
    await asOwner();
    assert.equal(await statusOf(failing), 'GENERATING');
    assert.deepEqual(await assistantFor(failing), []);
    assert.equal(await events(failing), 0);
    assert.deepEqual(await one(RECORD, [alice]), { ...DEFAULTS, reply_language: 'EGYPTIAN_ARABIC', version: 1 });

    stage = 'command: another account\'s turn, a wrong Session or a client role reaches nothing';
    const bob = await account();
    assert.deepEqual(await (async () => { await actAs('service_role'); const r = await rows(FINALIZE, [sessionId, bob, failing, randomUUID(), 'REPLY_LENGTH', 'ALWAYS_BRIEF', 0, 's', 'u', 't', randomUUID()]); await asOwner(); return r; })(), []);
    assert.deepEqual(await rows(RECORD, [bob]), []);
    await actAs('authenticated', alice);
    await rejected(() => client.query(FINALIZE, [sessionId, alice, failing, randomUUID(), 'REPLY_LENGTH', 'ALWAYS_BRIEF', 1, 's', 'u', 't', randomUUID()]), ['42501']);
    await asOwner();

    stage = 'command: no Memory, no Memory attribution and no Memory command - the record is the only authority';
    assert.equal(await memoryFootprint(), 0);
  });
}

// ------------------------------------------------------------------------------------------------------------------
async function verifyLegacyReview() {
  await inTransaction(async () => {
    stage = 'legacy: fixtures';
    const alice = await account();
    const bob = await account();
    const self = await memory(alice, { content: 'كلمني بالمصري.' });
    const other = await memory(alice, { content: 'Speak to me in English.', subject: 'OTHER' });
    const unattributed = await memory(alice, { content: 'Speak to me in English.', subject: null });
    const forgotten = await memory(alice, { content: 'Speak to me in English.', forgotten: true });
    const expired = await memory(alice, { content: 'Speak to me in English.', expired: true });
    const anotherType = await memory(alice, { content: 'Speak to me in English.', type: 'STABLE_PREFERENCE' });
    const bobs = await memory(bob, { content: 'Speak to me in English.' });
    const before = await rows('SELECT id, content, status, version, updated_at FROM public.memories WHERE user_id = ANY($1::uuid[]) ORDER BY id', [[alice, bob]]);
    const attributionsBefore = await count('SELECT count(*) AS n FROM public.memory_subject_attributions WHERE user_id = ANY($1::uuid[])', [[alice, bob]]);

    stage = 'legacy: OTHER, UNATTRIBUTED, forgotten, expired, another type and another account are NOT_ELIGIBLE';
    await actAs('authenticated', alice);
    for (const id of [other, unattributed, forgotten, expired, anotherType, bobs, randomUUID()]) {
      assert.deepEqual(await one(LEGACY, [id, 'REPLY_LANGUAGE', 'ENGLISH', 0]), { outcome: 'NOT_ELIGIBLE', version: 0 });
    }
    assert.deepEqual(await rows(RECORD, [alice]), [], 'nothing was written');

    stage = 'legacy: the owner\'s ACTIVE SELF Memory is adopted through the same compare-and-set';
    assert.deepEqual(await one(LEGACY, [self, 'REPLY_LANGUAGE', 'EGYPTIAN_ARABIC', 0]), { outcome: 'SAVED', version: 1 });
    assert.deepEqual(await one(LEGACY, [self, 'REPLY_LANGUAGE', 'EGYPTIAN_ARABIC', 0]), { outcome: 'UNCHANGED', version: 1 });
    assert.deepEqual(await one(LEGACY, [self, 'REPLY_LENGTH', 'ALWAYS_BRIEF', 0]), { outcome: 'STALE', version: 1 });
    await rejected(() => client.query(LEGACY, [self, 'REPLY_LANGUAGE', 'ARABIC', 1]), ['22023']);
    await asOwner();
    assert.deepEqual(await one(RECORD, [alice]), { ...DEFAULTS, reply_language: 'EGYPTIAN_ARABIC', version: 1 });

    stage = 'legacy: no Memory is ever changed, deleted, rewritten or attributed by the review';
    assert.deepEqual(await rows('SELECT id, content, status, version, updated_at FROM public.memories WHERE user_id = ANY($1::uuid[]) ORDER BY id', [[alice, bob]]), before);
    assert.equal(await count('SELECT count(*) AS n FROM public.memory_subject_attributions WHERE user_id = ANY($1::uuid[])', [[alice, bob]]), attributionsBefore);
    assert.deepEqual(await rows(RECORD, [bob]), []);
  });
}

// ------------------------------------------------------------------------------------------------------------------
async function verifyConcurrency() {
  stage = 'concurrency: two concurrent first writes of one owner serialize - one SAVED, one STALE, no deadlock';
  const second = new Client({ connectionString: databaseUrl });
  await second.connect();
  let alice;
  try {
    await client.query('BEGIN');
    alice = await account();
    await client.query('COMMIT');
    await client.query('BEGIN');
    await second.query('BEGIN');
    await actAs('authenticated', alice, client);
    await actAs('authenticated', alice, second);
    const first = await one(SET, ['HUMOUR', 'WELCOME', 0], client);
    const blocked = second.query(SET, ['HUMOUR', 'DECLINED', 0]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await client.query('COMMIT');
    const later = (await blocked).rows[0];
    await second.query('COMMIT');
    assert.deepEqual(first, { outcome: 'SAVED', version: 1 });
    assert.deepEqual(later, { outcome: 'STALE', version: 1 }, 'the second writer saw the committed first write and refused');
    assert.deepEqual(await one(RECORD, [alice]), { ...DEFAULTS, humour: 'WELCOME', version: 1 });
  } finally {
    try { await second.query('ROLLBACK'); } catch { /* already ended */ }
    await second.end();
    if (alice) {
      try { await client.query('ROLLBACK'); } catch { /* none open */ }
      await client.query('RESET ROLE');
      await client.query('DELETE FROM public.interaction_preferences WHERE user_id = $1', [alice]);
      await cleanupVerifierUsers(client, [alice]);
      assert.equal(await count('SELECT count(*) AS n FROM public.interaction_preferences WHERE user_id = $1', [alice]), 0);
    }
  }
}

// ------------------------------------------------------------------------------------------------------------------
async function verifyExportAndErasure() {
  await inTransaction(async () => {
    const alice = await account();
    const bob = await account();
    const exportOf = async (userId) => (await one('SELECT personal_data_private.build_personal_export_v1($1) AS e', [userId])).e;

    stage = 'export: without a row every preference reads "automatic"';
    assert.deepEqual((await exportOf(alice)).interactionPreferences, {
      replyLength: 'automatic', replyLanguage: 'automatic', humour: 'automatic', explanationStyle: 'automatic', lastChangedAt: null,
    });

    stage = 'export: the record in readable words, and nothing internal';
    await setOwn(alice, 'REPLY_LENGTH', 'ALWAYS_BRIEF', 0);
    await setOwn(alice, 'REPLY_LANGUAGE', 'MAGHREBI_ARABIC', 1);
    await setOwn(alice, 'HUMOUR', 'DECLINED', 2);
    await setOwn(alice, 'EXPLANATION_STYLE', 'SIMPLER_AND_DIRECT', 3);
    await setOwn(bob, 'HUMOUR', 'WELCOME', 0);
    const pkg = await exportOf(alice);
    const { lastChangedAt, ...readable } = pkg.interactionPreferences;
    assert.deepEqual(readable, { replyLength: 'always brief', replyLanguage: 'Maghrebi Arabic', humour: 'no humour', explanationStyle: 'simple and direct' });
    assert.ok(typeof lastChangedAt === 'string' && lastChangedAt.length > 0);
    const text = JSON.stringify(pkg);
    assert.doesNotMatch(text, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/u, 'no internal identifier');
    assert.doesNotMatch(text, /"(?:id|userId|version|MAGHREBI_ARABIC|ALWAYS_BRIEF)"/u);
    assert.deepEqual(pkg.notYetIncluded, ['shared', 'public', 'replay', 'introductions']);
    for (const value of [['ENGLISH', 'English'], ['EGYPTIAN_ARABIC', 'Egyptian Arabic'], ['MODERN_STANDARD_ARABIC', 'Modern Standard Arabic'],
      ['LEVANTINE_ARABIC', 'Levantine Arabic'], ['GULF_ARABIC', 'Gulf Arabic']]) {
      const version = (await one(RECORD, [bob])).version;
      await setOwn(bob, 'REPLY_LANGUAGE', value[0], version);
      assert.equal((await exportOf(bob)).interactionPreferences.replyLanguage, value[1]);
    }
    assert.equal((await exportOf(bob)).interactionPreferences.humour, 'welcome');

    stage = 'erasure: the governed Personal erasure leaves no preference row of the erased account';
    const bobBefore = await one(RECORD, [bob]);
    const deletionId = randomUUID();
    await client.query(`INSERT INTO personal_data_private.account_deletions (id, user_id, command_id, status, requested_at, final_at)
      VALUES ($1, $2, $3, 'SCHEDULED', now() - interval '8 days', now() - interval '1 day')`, [deletionId, alice, randomUUID()]);
    await actAs('service_role');
    assert.equal((await one('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId])).outcome, 'ERASED');
    await asOwner();
    assert.equal(await count('SELECT count(*) AS n FROM public.interaction_preferences WHERE user_id = $1', [alice]), 0);
    assert.deepEqual(await one(RECORD, [bob]), bobBefore, 'another account is untouched');
  });
}

try {
  await client.connect();
  await verifyCatalog();
  await verifySettingsCommand();
  await verifyConversationCommand();
  await verifyLegacyReview();
  await verifyConcurrency();
  await verifyExportAndErasure();
  console.log('verify-migration-0153: Interaction Preferences v1 verified (catalog, export body, Settings CAS, isolation, conversation command, legacy review, concurrency, export, erasure).');
} catch (error) {
  console.error(`verify-migration-0153 FAILED at stage: ${stage}`);
  throw error;
} finally {
  await client.end();
}
