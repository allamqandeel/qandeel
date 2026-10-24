// S8A-03 Open Understanding: the real-PostgreSQL verifier for migration 0173.
//
// Against a fully migrated database (API CI applies every migration first), it proves the durable half of the Product
// Owner's Open Understanding decision (2026-10-24, CP2 amendment §10):
//   C-1  the catalog: the two new tables (RLS on, owner SELECT only, no API write privilege, CASCADE from the Memory they
//        name), every new function's owner / security mode / empty search_path / EXECUTE, the capture result CHECK
//        widened by exactly the v3 validator, the 0171 / 0172 commands and reads unchanged, and no address-form object;
//   P-1  the typed v3 result: four identifier lists, bounded, distinct, never empty in total;
//   O-1  someone else's fact is stored only as that person's: OTHER with a person label, any non-temporary type,
//        never slotted; the user's own fact never carries a label; one without a label is refused;
//   G-1  a background forget retires the owner's ACTIVE Memory created before the message (DELETED, its equivalent
//        copies too), records the command (identifiers only), and never acts on a command turn, another owner's,
//        a later or an Interaction Preference Memory;
//   G-2  a background correction supersedes the Memory; the successor keeps the subject and the person label, and an
//        older message never brings the withdrawn words back;
//   L-1  the living state now covers someone else's Memories too (ended / restated), with every 0172 rule;
//   R-1  the known-Memories read: execution-scoped, SELF and OTHER with labels, people first and history last, at most
//        forty, never an Interaction Preference, a Derived Insight, a forgotten or another owner's Memory;
//   K-1  the knowledge read v2: the 0172 read plus the label, the caller's own rows only (RLS + auth.uid());
//   E-1  the governed Personal erasure removes the labels and the command record with the account; others untouched.
// Every step runs in a transaction that is rolled back; nothing is committed.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = []) => (await client.query(text, values)).rows;
const one = async (text, values = []) => (await rows(text, values))[0];
const count = async (text, values = []) => Number((await one(text, values)).n);

async function rejected(operation, codes, message) {
  let refusal;
  await client.query('SAVEPOINT expected_refusal');
  try { await operation(); } catch (error) { refusal = error; } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await client.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code} (${refusal.message})`);
  if (message) assert.match(refusal.message, message);
  return refusal;
}
async function actAs(role, userId = null, claims = {}) {
  await client.query('RESET ROLE');
  await client.query(`SET LOCAL ROLE ${role}`);
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [userId ? JSON.stringify({ sub: userId, role, ...claims }) : '{}']);
}
async function asOwner() {
  await client.query('RESET ROLE');
  await client.query("SELECT set_config('request.jwt.claims', '{}', true)");
}
// No finally: a refused call aborts the transaction, and ROLLBACK TO SAVEPOINT restores the role it set locally.
async function asServer(work) {
  await actAs('service_role');
  const value = await work();
  await asOwner();
  return value;
}

// ------------------------------------------------------------------------------------------------------------------
// Fixtures (the 0172 verifier's, unchanged in meaning). Explicit, strictly increasing instants.
// ------------------------------------------------------------------------------------------------------------------
let tick = 0;
const nextInstant = () => new Date(Date.UTC(2026, 9, 1, 9, 0, 0) + 1000 * tick++).toISOString();

async function reader() {
  const id = randomUUID();
  await client.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  return id;
}
async function session(userId) {
  const id = randomUUID();
  await client.query("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, userId]);
  return id;
}
async function userTurn(userId, sessionId, { status = 'COMPLETED', content = 'رسالة عادية', at = nextInstant() } = {}) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, created_at, updated_at, completed_at)
     VALUES ($1, $2, $3, 'USER', $4, $5, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', $6, $6, CASE WHEN $4 = 'COMPLETED' THEN $6::timestamptz END)`,
    [id, sessionId, userId, status, content, at],
  );
  return { id, at };
}
async function memory(userId, { content, type = 'PERSONAL_FACT', status = 'ACTIVE', subject = 'SELF', expiresAt = null, at = nextInstant(), source = 'USER_STATED' } = {}) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status, expires_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 0.95, 0.65, $6, $7, $8, $8)`,
    [id, userId, type, content ?? `verifier-0173 fact ${tick}`, source, status, expiresAt, at],
  );
  if (subject && status === 'ACTIVE' && (expiresAt === null || new Date(expiresAt) > new Date())) await client.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis) VALUES ($1, $2, $3, 'EXPLICIT_STATEMENT')", [id, userId, subject]);
  return id;
}
/** A person label as an earlier capture would have written it (the table owner writes fixtures). */
const label = (memoryId, userId, name, relation, executionId = randomUUID()) => client.query(
  'INSERT INTO public.memory_person_labels (memory_id, user_id, person_name, person_relation, execution_id) VALUES ($1, $2, $3, $4, $5)',
  [memoryId, userId, name, relation, executionId]);
const profile = (memoryId, userId, { slot = null, temporal = 'CURRENT', indexed = true } = {}) => client.query(
  'INSERT INTO public.memory_retrieval_profiles (memory_id, user_id, semantic_indexed, slot, temporal) VALUES ($1, $2, $3, $4, $5)',
  [memoryId, userId, indexed, slot, temporal]);

async function captureExecution(userId, sessionId, { content = 'رسالة', turn = null, claim = true, state = 'RUNNING', at } = {}) {
  const sourceTurn = turn ?? (await userTurn(userId, sessionId, { content, ...(at ? { at } : {}) })).id;
  const id = randomUUID();
  await client.query(`INSERT INTO public.post_response_intelligence_executions (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path,
      safety_disposition, state, current_stage, terminal_at) VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', $6, 'VERIFIER_0173',
      CASE WHEN $6 = 'RUNNING' THEN NULL ELSE CURRENT_TIMESTAMP END)`, [id, randomUUID(), userId, sessionId, sourceTurn, state]);
  if (claim) await client.query("INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state) VALUES ($1, 'UNDERSTANDING_CAPTURE_PROVIDER', 'CLAIMED')", [id]);
  return { id, turn: sourceTurn };
}

const V3_SIGNATURE = 'public.complete_post_response_personal_capture_v3(uuid,uuid[],text[],text[],double precision[],timestamp with time zone[],text[],text[],text[],text[],text[],uuid[],text[],text[],uuid[],text[],uuid[],uuid[],uuid[],uuid[],uuid[],text[],text[],double precision[],text[],text[])';
const CAPTURE_V3 = `SELECT public.complete_post_response_personal_capture_v3($1, $2::uuid[], $3::text[], $4::text[], $5::double precision[], $6::timestamptz[],
  $7::text[], $8::text[], $9::text[], $10::text[], $11::text[], $12::uuid[], $13::text[], $14::text[], $15::uuid[], $16::text[], $17::uuid[], $18::uuid[],
  $19::uuid[], $20::uuid[], $21::uuid[], $22::text[], $23::text[], $24::double precision[], $25::text[], $26::text[]) AS answer`;
/** The v3 command exactly as the repository sends it: parallel arrays, terms flattened. */
function captureArgs(executionId, { items = [], index = [], reaffirmed = [], ended = [], forget = [], corrections = [] }) {
  const terms = [...items, ...index, ...corrections.map((c) => ({ id: c.newId, terms: c.terms }))].flatMap((entry) => (entry.terms ?? []).map((value) => [entry.id, value]));
  return [executionId,
    items.map((i) => i.id), items.map((i) => i.type ?? 'PERSONAL_FACT'), items.map((i) => i.content), items.map((i) => i.importance ?? 0.65),
    items.map((i) => i.expiresAt ?? null), items.map((i) => i.slot ?? null), items.map((i) => i.temporal ?? 'CURRENT'), items.map((i) => ('subject' in i ? i.subject : 'SELF')),
    items.map((i) => i.name ?? null), items.map((i) => i.relation ?? null),
    index.map((i) => i.id), index.map((i) => i.slot ?? null), index.map((i) => i.temporal ?? 'CURRENT'),
    terms.map(([id]) => id), terms.map(([, value]) => value), reaffirmed, ended, forget,
    corrections.map((c) => c.target), corrections.map((c) => c.newId), corrections.map((c) => c.type ?? 'PERSONAL_FACT'), corrections.map((c) => c.content),
    corrections.map((c) => c.importance ?? 0.65), corrections.map((c) => c.slot ?? null), corrections.map((c) => c.temporal ?? 'CURRENT')];
}
const capture = async (executionId, command) => (await asServer(() => one(CAPTURE_V3, captureArgs(executionId, command)))).answer;
// The 0152 Memory command, exactly as the 0171 / 0172 verifiers drive it.
const V2 = 'SELECT * FROM public.server_finalize_memory_control_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)';
function v2Args(c) {
  const writes = c.outcome === 'REMEMBERED' || c.outcome === 'CORRECTED';
  return [
    c.session, c.user, c.turn, randomUUID(), c.kind, c.outcome,
    c.target ?? null, c.newId ?? (writes ? randomUUID() : null), c.type ?? (writes ? 'PERSONAL_FACT' : null), c.content ?? null,
    writes ? 0.98 : null, writes ? 0.65 : null, null,
    c.candidates ?? [], c.answers ?? null, c.subject ?? null, c.equivalent ?? null,
    `reply:${c.outcome}`,
    ['CORRECTED', 'FORGOTTEN', 'DISABLED'].includes(c.outcome) ? 'reply:TARGET_CHANGED' : null,
    writes ? 'reply:EXISTING' : null,
    randomUUID(), null, null,
  ];
}
const finalize2 = async (c) => (await asServer(() => rows(V2, v2Args(c)))).map((row) => row.outcome);
const effectOf = (executionId) => one("SELECT state, result_code, result_payload FROM public.post_response_intelligence_effects WHERE execution_id = $1 AND effect_key = 'UNDERSTANDING_CAPTURE_PROVIDER'", [executionId]);
const statusOf = async (memoryId) => (await one('SELECT status FROM public.memories WHERE id = $1', [memoryId]))?.status;
const labelOf = (memoryId) => one('SELECT person_name, person_relation FROM public.memory_person_labels WHERE memory_id = $1', [memoryId]);
const stateOf = (memoryId) => one('SELECT temporal, last_stated_at, restated_count, ended_at, ended_execution_id FROM public.memory_retrieval_profiles WHERE memory_id = $1', [memoryId]);
async function knowledge(userId, limit = 120) {
  await actAs('authenticated', userId);
  const value = await rows('SELECT * FROM public.personal_knowledge_sources_v2($1)', [limit]);
  await asOwner();
  return value;
}
const known = (sourceTurnId, limit = 40) => asServer(() => rows('SELECT * FROM public.background_known_memories_v1($1, $2)', [sourceTurnId, limit]));

// ------------------------------------------------------------------------------------------------------------------
// C-1. The catalog.
// ------------------------------------------------------------------------------------------------------------------
const FUNCTIONS = {
  'public.post_response_personal_capture_result_valid_v3(jsonb)': { definer: false, roles: [] },
  'public.background_known_memories_v1(uuid,integer)': { definer: true, roles: ['service_role'] },
  [V3_SIGNATURE]: { definer: true, roles: ['service_role'] },
  'public.personal_knowledge_sources_v2(integer)': { definer: false, roles: ['authenticated'] },
  // Left in place and unchanged by 0173: still the server's / the caller's own; the runtime no longer calls them.
  'public.complete_post_response_personal_capture_v1(uuid,uuid[],text[],text[],double precision[],timestamp with time zone[],text[],text[],uuid[],text[],text[],uuid[],text[])': { definer: true, roles: ['service_role'] },
  'public.complete_post_response_personal_capture_v2(uuid,uuid[],text[],text[],double precision[],timestamp with time zone[],text[],text[],text[],uuid[],text[],text[],uuid[],text[],uuid[],uuid[])': { definer: true, roles: ['service_role'] },
  'public.background_current_state_memories_v1(uuid,integer)': { definer: true, roles: ['service_role'] },
  'public.personal_knowledge_sources_v1(integer)': { definer: false, roles: ['authenticated'] },
};
const API_ROLES = ['anon', 'authenticated', 'service_role'];
const TABLES = ['public.memory_person_labels', 'public.background_memory_commands'];
const constraintDef = async (table, name) => (await one('SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1::regclass AND conname = $2', [table, name]))?.def;

async function verifyCatalog() {
  stage = 'C-1 catalog: the new tables - RLS on, owner SELECT only, no API write privilege';
  for (const table of TABLES) {
    const t = await one("SELECT c.relrowsecurity AS rls, pg_get_userbyid(c.relowner) AS owner FROM pg_class c WHERE c.oid = $1::regclass", [table]);
    assert.deepEqual([t.rls, t.owner], [true, 'postgres'], table);
    for (const role of API_ROLES) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        assert.equal((await one('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, table, privilege])).allowed, false, `${table}: ${role} has no ${privilege}`);
      }
    }
    assert.equal((await one('SELECT has_table_privilege($1, $2, $3) AS allowed', ['anon', table, 'SELECT'])).allowed, false, `${table}: anon reads nothing`);
    const policies = await rows('SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS qual FROM pg_policy WHERE polrelid = $1::regclass', [table]);
    assert.equal(policies.length, 1, `${table}: one policy`);
    assert.equal(policies[0].polcmd, 'r', `${table}: SELECT only`);
    assert.match(policies[0].qual, /user_id = \( SELECT auth\.uid\(\)/u, `${table}: the caller's own rows`);
  }

  stage = 'C-1 catalog: every new row belongs to the Memory it names (CASCADE), and the label is bounded and present';
  assert.match(await constraintDef('public.memory_person_labels', 'memory_person_labels_memory_fk'), /FOREIGN KEY \(memory_id, user_id\) REFERENCES memories\(id, user_id\) ON DELETE CASCADE/u);
  assert.match(await constraintDef('public.background_memory_commands', 'background_memory_commands_target_fk'), /FOREIGN KEY \(target_memory_id, user_id\) REFERENCES memories\(id, user_id\) ON DELETE CASCADE/u);
  assert.match(await constraintDef('public.background_memory_commands', 'background_memory_commands_new_fk'), /FOREIGN KEY \(new_memory_id, user_id\) REFERENCES memories\(id, user_id\) ON DELETE CASCADE/u);
  assert.match(await constraintDef('public.memory_person_labels', 'memory_person_labels_present_check'), /person_name IS NOT NULL\) OR \(person_relation IS NOT NULL/u);
  assert.match(await constraintDef('public.background_memory_commands', 'background_memory_commands_shape_check'), /kind = 'CORRECT'::text\) = \(new_memory_id IS NOT NULL\)/u);
  // The command record holds identifiers only: no column may carry words.
  const commandColumns = await rows("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'background_memory_commands' ORDER BY column_name");
  assert.deepEqual(commandColumns.filter((c) => c.data_type === 'text').map((c) => c.column_name), ['kind']);

  stage = 'C-1 catalog: every function - owner, security mode, empty search_path, EXECUTE';
  for (const [signature, expected] of Object.entries(FUNCTIONS)) {
    const fn = await one('SELECT p.prosecdef AS definer, pg_get_userbyid(p.proowner) AS owner, p.proconfig AS config FROM pg_proc p WHERE p.oid = $1::regprocedure', [signature]);
    assert.deepEqual([fn.definer, fn.owner, fn.config], [expected.definer, 'postgres', ['search_path=""']], signature);
    for (const role of [...API_ROLES, 'public']) {
      const allowed = role === 'public'
        ? (await one("SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE p.oid = $1::regprocedure AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS allowed", [signature])).allowed
        : (await one('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, signature, 'EXECUTE'])).allowed;
      assert.equal(allowed, expected.roles.includes(role), `${signature}: EXECUTE for ${role}`);
    }
  }

  stage = 'C-1 catalog: the capture result CHECK accepts the v2 or the v3 result, nothing else; no address form exists';
  const check = await constraintDef('public.post_response_intelligence_effects', 'post_response_intelligence_effects_understanding_result_check');
  assert.match(check, /post_response_personal_capture_result_valid_v2\(result_payload\).*post_response_personal_capture_result_valid_v3\(result_payload\)/su);
  assert.equal(await count("SELECT count(*) AS n FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname ~ '(address|_exp$)'"), 0);
  assert.equal(await count("SELECT count(*) AS n FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname ~ 'address_form'"), 0);
  assert.equal(await count("SELECT count(*) AS n FROM pg_proc WHERE oid = $1::regprocedure AND pg_get_function_arguments(oid) ~ 'address'", [V3_SIGNATURE]), 0);
}

// ------------------------------------------------------------------------------------------------------------------
// P-1. The typed v3 result.
// ------------------------------------------------------------------------------------------------------------------
async function verifyResult() {
  stage = 'P-1 the v3 validator: four identifier lists, bounded, distinct, never empty in total';
  const ids = (n) => Array.from({ length: n }, randomUUID);
  const v3 = (over = {}) => ({ memoryIds: [], indexedMemoryIds: [], updatedMemoryIds: [], retiredMemoryIds: [], ...over });
  const valid = async (value) => (await one('SELECT public.post_response_personal_capture_result_valid_v3($1::jsonb) AS ok', [value === undefined ? null : JSON.stringify(value)])).ok;
  for (const value of [v3({ retiredMemoryIds: ids(1) }), v3({ memoryIds: ids(8), indexedMemoryIds: ids(4), updatedMemoryIds: ids(20), retiredMemoryIds: ids(5) })]) {
    assert.equal(await valid(value), true, JSON.stringify(value));
  }
  const a = randomUUID();
  for (const value of [undefined, v3(), v3({ memoryIds: ids(9) }), v3({ indexedMemoryIds: ids(5) }), v3({ updatedMemoryIds: ids(21) }), v3({ retiredMemoryIds: ids(6) }),
    v3({ retiredMemoryIds: [a, a] }), v3({ retiredMemoryIds: ['x'] }), { memoryIds: [a], indexedMemoryIds: [], updatedMemoryIds: [] }, v3({ content: 'x', memoryIds: [a] }),
    v3({ memoryIds: [1] })]) {
    assert.equal(await valid(value), false, JSON.stringify(value));
  }
}

// ------------------------------------------------------------------------------------------------------------------
// O-1. Someone else's fact, with its person label.
// ------------------------------------------------------------------------------------------------------------------
async function verifyPeople() {
  const me = await reader();
  const s = await session(me);

  stage = 'O-1 someone else\'s fact is stored as that person\'s: OTHER, MODEL_ASSISTED_RELATION_CAPTURE, with the label';
  const execution = await captureExecution(me, s, { content: 'وسلمى بقت مدرسة إنجليزي، وأنا ساكن في المعادي' });
  const salma = randomUUID(); const home = randomUUID(); const planned = randomUUID();
  assert.equal(await capture(execution.id, { items: [
    { id: salma, content: 'سلمى بقت مدرسة إنجليزي.', subject: 'OTHER', name: 'سلمى', relation: 'مراتي', terms: ['مدرسه'] },
    { id: home, content: 'أنا ساكن في المعادي.', slot: 'RESIDENCE', terms: ['ساكن'] },
    { id: planned, type: 'GOAL', content: 'حسام ناوي يسافر الدوحة.', subject: 'OTHER', relation: 'أخويا', temporal: 'PLANNED' },
  ] }), 'COMPLETED');
  assert.deepEqual(await one('SELECT subject, basis, execution_id FROM public.memory_subject_attributions WHERE memory_id = $1', [salma]),
    { subject: 'OTHER', basis: 'MODEL_ASSISTED_RELATION_CAPTURE', execution_id: execution.id });
  assert.deepEqual(await labelOf(salma), { person_name: 'سلمى', person_relation: 'مراتي' });
  assert.deepEqual(await labelOf(planned), { person_name: null, person_relation: 'أخويا' });
  assert.equal(await labelOf(home), undefined, 'the user\'s own fact never carries a label');
  assert.deepEqual((await stateOf(planned)).temporal, 'PLANNED');
  assert.deepEqual((await effectOf(execution.id)).result_payload, { memoryIds: [salma, home, planned], indexedMemoryIds: [], updatedMemoryIds: [], retiredMemoryIds: [] });

  stage = 'O-1 refused before anything is written: a label on the user\'s own fact, someone else\'s without a label, slotted or time-bound';
  for (const bad of [{ subject: 'SELF', name: 'سلمى' }, { subject: 'OTHER' }, { subject: 'OTHER', name: 'سلمى', slot: 'OCCUPATION' },
    { subject: 'OTHER', name: 'سلمى', type: 'TEMPORARY_STATE', temporal: 'TEMPORARY', expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    { subject: 'OTHER', name: 'س'.repeat(41) }, { subject: 'OTHER', relation: '   ' }, { subject: 'UNCLEAR', name: 'سلمى' }]) {
    const e = await captureExecution(me, s);
    await rejected(() => capture(e.id, { items: [{ id: randomUUID(), content: 'سلمى بتشتغل.', ...bad }] }), ['22023'], /INVALID_UNDERSTANDING_CAPTURE/u);
    assert.equal((await effectOf(e.id)).state, 'CLAIMED');
  }

  stage = 'O-1 the same words are never stored twice as someone else\'s';
  const again = await captureExecution(me, s);
  assert.equal(await capture(again.id, { items: [{ id: randomUUID(), content: 'سلمى  بقت مدرسة إنجليزي', subject: 'OTHER', name: 'سلمى' }] }), 'COMPLETED');
  assert.equal((await effectOf(again.id)).result_code, 'NO_UNDERSTANDING_RECORDED');
}

// ------------------------------------------------------------------------------------------------------------------
// G. Forget and correct.
// ------------------------------------------------------------------------------------------------------------------
async function verifyForgetCorrect() {
  const me = await reader();
  const stranger = await reader();
  const s = await session(me);

  stage = 'G-1 a background forget retires the Memory and its equivalent copy, and records identifiers only';
  const loan = await memory(me, { content: 'عليا قسط عربية.' });
  const copy = await memory(me, { content: 'عليا  قسط عربية' });
  const forgetting = await captureExecution(me, s, { content: 'انسى موضوع القسط' });
  assert.equal(await capture(forgetting.id, { forget: [loan] }), 'COMPLETED');
  assert.deepEqual([await statusOf(loan), await statusOf(copy)], ['DELETED', 'DELETED']);
  assert.deepEqual(await one('SELECT kind, target_memory_id, new_memory_id, source_turn_id, execution_id FROM public.background_memory_commands WHERE user_id = $1', [me]),
    { kind: 'FORGET', target_memory_id: loan, new_memory_id: null, source_turn_id: forgetting.turn, execution_id: forgetting.id });
  assert.equal((await one('SELECT disposition FROM public.memory_equivalence_dispositions WHERE memory_id = $1', [copy])).disposition, 'FORGOTTEN');
  assert.deepEqual((await effectOf(forgetting.id)).result_payload, { memoryIds: [], indexedMemoryIds: [], updatedMemoryIds: [], retiredMemoryIds: [loan] });
  assert.equal(await capture(forgetting.id, { forget: [loan] }), 'NO_OP', 'a replay is NO_OP');

  stage = 'G-1 an older message never brings the forgotten words back';
  const older = await captureExecution(me, s, { at: '2026-09-01T00:00:00.000Z' });
  assert.equal(await capture(older.id, { items: [{ id: randomUUID(), content: 'عليا قسط عربية.' }] }), 'COMPLETED');
  assert.equal((await effectOf(older.id)).result_code, 'NO_UNDERSTANDING_RECORDED');

  stage = 'G-1 never another owner\'s, a later, an Interaction Preference or a Derived Insight Memory; never on a command turn';
  const theirs = await memory(stranger, { content: 'أنا بحب الشاي.' });
  const preference = await memory(me, { content: 'رد عليا باختصار.', type: 'INTERACTION_PREFERENCE' });
  const derived = await memory(me, { content: 'يبدو إنه بيحب النظام.', type: 'DERIVED_INSIGHT', source: 'USER_CONFIRMED' });
  const late = await captureExecution(me, s);
  const after = await memory(me, { content: 'بلعب كورة.', at: '2026-12-01T00:00:00.000Z' });
  assert.equal(await capture(late.id, { forget: [theirs, preference, after], corrections: [{ target: derived, newId: randomUUID(), content: 'بحب النظام.' }] }), 'COMPLETED');
  assert.equal((await effectOf(late.id)).result_code, 'NO_UNDERSTANDING_RECORDED');
  assert.deepEqual([await statusOf(theirs), await statusOf(preference), await statusOf(after), await statusOf(derived)], ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE']);
  const tea = await memory(me, { content: 'بحب الشاي بالنعناع.' });
  const commandTurn = await userTurn(me, s, { status: 'GENERATING', content: 'افتكر إني بشرب قهوة' });
  assert.deepEqual(await finalize2({ session: s, user: me, turn: commandTurn.id, kind: 'REMEMBER', outcome: 'REMEMBERED', type: 'STABLE_PREFERENCE', content: 'أنا بشرب قهوة.', subject: 'SELF' }), ['REMEMBERED']);
  const onCommand = await captureExecution(me, s, { turn: commandTurn.id });
  assert.equal(await capture(onCommand.id, { forget: [tea] }), 'COMPLETED');
  assert.equal(await statusOf(tea), 'ACTIVE', 'nothing on a foreground Memory-command turn');

  stage = 'G-2 a correction supersedes the Memory; the successor keeps the subject and the person label';
  const layla = await memory(me, { content: 'ليلى عندها 7 سنين.', subject: 'OTHER' });
  await label(layla, me, 'ليلى', 'بنتي');
  const job = await memory(me, { content: 'بشتغل في فودافون.' });
  const correcting = await captureExecution(me, s, { content: 'صحح عندك: ليلى عندها 8، وأنا بشتغل في أورنج' });
  const layla8 = randomUUID(); const orange = randomUUID();
  assert.equal(await capture(correcting.id, { corrections: [
    { target: layla, newId: layla8, content: 'ليلى عندها 8 سنين.', terms: ['ليلي'] },
    { target: job, newId: orange, content: 'بشتغل في أورنج.', slot: 'EMPLOYER', terms: ['شغل'] },
  ] }), 'COMPLETED');
  assert.deepEqual([await statusOf(layla), await statusOf(job), await statusOf(layla8), await statusOf(orange)], ['SUPERSEDED', 'SUPERSEDED', 'ACTIVE', 'ACTIVE']);
  assert.deepEqual(await one('SELECT subject, basis FROM public.memory_subject_attributions WHERE memory_id = $1', [layla8]), { subject: 'OTHER', basis: 'MODEL_ASSISTED_RELATION_CAPTURE' });
  assert.deepEqual(await one('SELECT subject, basis FROM public.memory_subject_attributions WHERE memory_id = $1', [orange]), { subject: 'SELF', basis: 'MODEL_ASSISTED_CAPTURE' });
  assert.deepEqual(await labelOf(layla8), { person_name: 'ليلى', person_relation: 'بنتي' });
  assert.equal((await one('SELECT supersedes_memory_id FROM public.memories WHERE id = $1', [orange])).supersedes_memory_id, job);
  assert.equal(await count('SELECT count(*) AS n FROM public.memory_retrieval_terms WHERE memory_id = $1', [orange]), 1);
  assert.deepEqual((await effectOf(correcting.id)).result_payload, { memoryIds: [layla8, orange], indexedMemoryIds: [], updatedMemoryIds: [], retiredMemoryIds: [layla, job] });
  assert.equal(await count("SELECT count(*) AS n FROM public.background_memory_commands WHERE user_id = $1 AND kind = 'CORRECT'", [me]), 2);

  stage = 'G-2 someone else\'s fact never gains a slot through a correction; a time-bound successor is refused';
  const sister = await memory(me, { content: 'أختي ساكنة في طنطا.', subject: 'OTHER' });
  const slotting = await captureExecution(me, s);
  assert.equal(await capture(slotting.id, { corrections: [{ target: sister, newId: randomUUID(), content: 'أختي ساكنة في المنصورة.', slot: 'RESIDENCE' }] }), 'COMPLETED');
  assert.equal(await statusOf(sister), 'ACTIVE');
  await rejected(() => capture(slotting.id, { corrections: [{ target: sister, newId: randomUUID(), content: 'أختي مسافرة.', temporal: 'TEMPORARY' }] }), ['22023']);

  stage = 'G invalid batches are refused before anything is written';
  const bad = await captureExecution(me, s);
  const x = await memory(me, { content: 'سطر للتحقق.' });
  for (const command of [{ forget: [x], ended: [x] }, { forget: [x, x] }, { forget: Array.from({ length: 4 }, randomUUID) },
    { corrections: Array.from({ length: 3 }, () => ({ target: randomUUID(), newId: randomUUID(), content: 'جملة صحيحة.' })) },
    { corrections: [{ target: x, newId: x, content: 'جملة صحيحة.' }] }, { reaffirmed: Array.from({ length: 21 }, randomUUID) }]) {
    await rejected(() => capture(bad.id, command), ['22023']);
  }
  assert.equal((await effectOf(bad.id)).state, 'CLAIMED');
  assert.equal(await statusOf(x), 'ACTIVE');
}

// ------------------------------------------------------------------------------------------------------------------
// L-1. The living state of someone else's Memories.
// ------------------------------------------------------------------------------------------------------------------
async function verifyLivingState() {
  const me = await reader();
  const s = await session(me);

  stage = 'L-1 someone else\'s Memory can be ended or restated, once, never backwards, never an unattributed one';
  const brother = await memory(me, { content: 'حسام شغال في دبي.', subject: 'OTHER' });
  const friend = await memory(me, { content: 'أحمد بيدرس طب.', subject: 'OTHER' });
  const nobody = await memory(me, { content: 'حد بيدرس.', subject: null });
  const e = await captureExecution(me, s);
  assert.equal(await capture(e.id, { ended: [brother], reaffirmed: [friend, nobody] }), 'COMPLETED');
  assert.deepEqual((await effectOf(e.id)).result_payload, { memoryIds: [], indexedMemoryIds: [], updatedMemoryIds: [brother, friend], retiredMemoryIds: [] });
  const ended = await stateOf(brother);
  assert.deepEqual([ended.temporal, ended.ended_execution_id], ['PAST', e.id]);
  assert.equal((await stateOf(friend)).restated_count, 1);
  assert.equal(await stateOf(nobody), undefined);
  const older = await captureExecution(me, s, { at: '2026-09-01T00:00:00.000Z' });
  assert.equal(await capture(older.id, { reaffirmed: [friend] }), 'COMPLETED');
  assert.equal((await stateOf(friend)).restated_count, 1);
}

// ------------------------------------------------------------------------------------------------------------------
// R-1 / K-1. The reads.
// ------------------------------------------------------------------------------------------------------------------
async function verifyReads() {
  const me = await reader();
  const other = await reader();
  const s = await session(me);

  stage = 'R-1 the known-Memories read: execution-scoped, SELF and OTHER with labels, people first and history last';
  const wife = await memory(me, { content: 'مراتي اسمها سلمى.', type: 'RELATIONSHIP_CONTEXT', subject: 'OTHER' });
  await label(wife, me, 'سلمى', 'مراتي');
  const home = await memory(me, { content: 'أنا ساكن في المعادي.' }); await profile(home, me, { slot: 'RESIDENCE' });
  const old = await memory(me, { content: 'كنت ساكن في طنطا.' }); await profile(old, me, { temporal: 'PAST' });
  const unattributed = await memory(me, { content: 'ملاحظة قديمة.', subject: null });
  const preference = await memory(me, { content: 'رد عليا باختصار.', type: 'INTERACTION_PREFERENCE' });
  const derived = await memory(me, { content: 'يبدو إنه منظم.', type: 'DERIVED_INSIGHT', source: 'USER_CONFIRMED' });
  const gone = await memory(me, { content: 'بشرب قهوة كتير.' });
  await client.query("UPDATE public.memories SET status = 'DELETED' WHERE id = $1", [gone]);
  const expired = await memory(me, { content: 'عندي امتحان.', type: 'TEMPORARY_STATE', at: '2020-01-01T00:00:00.000Z', expiresAt: '2020-01-02T00:00:00.000Z' });
  const theirs = await memory(other, { content: 'أنا ساكن في الزمالك.' });
  const reading = await captureExecution(me, s);
  const read = await known(reading.turn);
  assert.deepEqual(read.map((r) => r.memory_id), [wife, home, unattributed, old]);
  assert.deepEqual(read[0], { memory_id: wife, type: 'RELATIONSHIP_CONTEXT', content: 'مراتي اسمها سلمى.', subject: 'OTHER', person_name: 'سلمى', person_relation: 'مراتي', temporal: null, ended: false, terms: [] });
  assert.equal(read[2].subject, 'UNATTRIBUTED');
  for (const never of [preference, derived, gone, expired, theirs]) assert.ok(!read.some((r) => r.memory_id === never));
  assert.equal((await known(reading.turn, 2)).length, 2);
  for (let n = 0; n < 45; n += 1) await memory(me, { content: `حقيقة رقم ${n}.` });
  assert.equal((await known(reading.turn, 500)).length, 40, 'at most forty');
  await rejected(() => known(randomUUID()), ['42501'], /UNDERSTANDING_EXECUTION_NOT_ASSOCIATED/u);
  await rejected(() => known(reading.turn, -1), ['22023']);
  const finished = await captureExecution(me, s, { state: 'COMPLETED', claim: false });
  await rejected(() => known(finished.turn), ['42501'], /UNDERSTANDING_EXECUTION_NOT_ASSOCIATED/u);

  stage = 'K-1 the knowledge read v2: the 0172 rows plus the label, the caller\'s own only';
  const rowsV2 = await knowledge(me);
  const rowsV1 = await (async () => { await actAs('authenticated', me); const v = await rows('SELECT * FROM public.personal_knowledge_sources_v1(120)'); await asOwner(); return v; })();
  assert.deepEqual(rowsV2.map((r) => r.id), rowsV1.map((r) => r.id), 'the same rows in the same order as the 0172 read');
  assert.deepEqual(rowsV2.find((r) => r.id === wife), { ...rowsV1.find((r) => r.id === wife), person_name: 'سلمى', person_relation: 'مراتي' });
  assert.deepEqual([rowsV2.find((r) => r.id === home).person_name, rowsV2.find((r) => r.id === home).person_relation], [null, null]);
  assert.ok(!(await knowledge(other)).some((r) => r.id === wife), 'another reader never sees the row or its label');
  await actAs('authenticated', other);
  assert.equal(await count('SELECT count(*) AS n FROM public.memory_person_labels'), 0, 'RLS: no one else\'s label');
  assert.equal(await count('SELECT count(*) AS n FROM public.background_memory_commands'), 0, 'RLS: no one else\'s command');
  await asOwner();
  assert.ok((await knowledge(me, 3)).length === 3 && (await knowledge(me, 500)).length <= 120, 'bounded');
  for (const role of ['anon', 'service_role']) {
    assert.equal((await one('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, 'public.personal_knowledge_sources_v2(integer)', 'EXECUTE'])).allowed, false);
  }

  stage = 'K-1 a forget removes the Memory and its label from every read';
  await client.query("UPDATE public.memories SET status = 'DELETED' WHERE id = $1", [wife]);
  assert.ok(!(await knowledge(me)).some((r) => r.id === wife));
  assert.ok(!(await known(reading.turn)).some((r) => r.memory_id === wife));
}

async function verifyErasure() {
  stage = 'E-1 the governed Personal erasure removes the labels and the command record with the account';
  const alice = await reader();
  const bob = await reader();
  for (const userId of [alice, bob]) {
    const s = await session(userId);
    const loan = await memory(userId, { content: 'عليا قسط عربية.' });
    const sister = await memory(userId, { content: 'أختي اسمها منى.', subject: 'OTHER', type: 'RELATIONSHIP_CONTEXT' });
    await label(sister, userId, 'منى', 'أختي');
    const execution = await captureExecution(userId, s);
    assert.equal(await capture(execution.id, { forget: [loan], corrections: [{ target: sister, newId: randomUUID(), type: 'RELATIONSHIP_CONTEXT', content: 'أختي اسمها منى وعندها 30 سنة.' }],
      items: [{ id: randomUUID(), content: 'ابني يوسف بيحب الرسم.', subject: 'OTHER', name: 'يوسف', relation: 'ابني' }] }), 'COMPLETED');
  }
  const footprint = async (userId) => [
    await count('SELECT count(*) AS n FROM public.memory_person_labels WHERE user_id = $1', [userId]),
    await count('SELECT count(*) AS n FROM public.background_memory_commands WHERE user_id = $1', [userId])];
  assert.deepEqual([await footprint(alice), await footprint(bob)], [[3, 2], [3, 2]], 'the fixture populates both');
  await actAs('authenticated', alice, { amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - 1 }] });
  assert.equal((await one('SELECT * FROM public.request_own_account_deletion_v1($1)', [randomUUID()])).outcome, 'ACCEPTED');
  await asOwner();
  await client.query(`UPDATE personal_data_private.account_deletions SET requested_at = clock_timestamp() - interval '8 days', final_at = clock_timestamp() - interval '1 day'
    WHERE user_id = $1 AND status = 'SCHEDULED'`, [alice]);
  const { id: deletionId } = await one("SELECT id FROM personal_data_private.account_deletions WHERE user_id = $1 AND status <> 'CANCELLED'", [alice]);
  await asServer(() => rows('SELECT * FROM public.server_claim_due_account_deletions_v1(20)'));
  assert.equal((await asServer(() => one('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId]))).outcome, 'ERASED');
  assert.deepEqual([await footprint(alice), await footprint(bob)], [[0, 0], [3, 2]], 'nothing of the account remains; another reader is untouched');
}

(async () => {
  await client.connect();
  try {
    for (const step of [verifyCatalog, verifyResult, verifyPeople, verifyForgetCorrect, verifyLivingState, verifyReads, verifyErasure]) {
      await client.query('BEGIN');
      try { await step(); } finally { await client.query('ROLLBACK'); }
    }
    console.log('Verified migration 0173 Open Understanding: someone else\'s facts stored only as that person\'s with a grounded label (never slotted, never time-bound, never on the user\'s own fact), background forget and correct applied only to the owner\'s ACTIVE Memories created before the message and never on a command turn, with identifiers-only records and no older message bringing withdrawn words back, the living state of SELF and OTHER Memories, a v3 identifiers-only result, an execution-scoped known-Memories read and an RLS-bound knowledge read with labels, no address form, and erasure that removes every new row with the account.');
  } catch (error) {
    console.error(`FAILED at stage: ${stage}`);
    throw error;
  } finally {
    await client.end();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
