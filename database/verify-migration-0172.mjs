// S8A-03 Living Personal Memory: the real-PostgreSQL verifier for migration 0172.
//
// Against a fully migrated database (API CI applies every migration first), it proves the durable half of the
// Founder's "Living Personal Memory - Design Corrections & Controlled Implementation" decision:
//   C-1  the catalog: the living-state columns and their CHECKs, the guard trigger, every new function's owner /
//        security mode / empty search_path / EXECUTE, the attribution basis widened by exactly one value with its own
//        OTHER-only check, the 0171 command and its grant unchanged;
//   P-1  the typed capture result: the 0171 shape, or the same plus updatedMemoryIds - identifiers only, bounded;
//   F-1  family relationship statements: kept as OTHER / MODEL_ASSISTED_RELATION_CAPTURE naming the execution, never as
//        the user's own fact, never slotted, never a time-bound state, never twice;
//   L-1  a restatement (REAFFIRMED, or the same words again) moves last_stated_at forward and counts once per message,
//        never backwards, never on a Memory created after the message;
//   L-2  an explicit ending (ENDED) makes the Memory PAST - still ACTIVE, still true as history - and nothing makes it
//        current again: not the 0171 backfill, not a later index write, not a restatement;
//   L-3  only the owner's ACTIVE, unexpired SELF Memory created before the message can be restated or ended; nothing on
//        a Memory-command turn; replays are NO_OP; invalid batches write nothing;
//   L-4  an ended fact leaves its slot: the other one is no longer UNSETTLED, in both reads;
//   S-1  the bounded current-state read: execution-scoped, SELF current states only, with their terms, at most ten;
//   K-1  the knowledge read: the caller's own eligible Memories only (RLS + auth.uid()), never an Interaction Preference
//        or a Derived Insight, never a forgotten / expired one, with its living state, bounded at 120, authenticated only;
//   K-2  a forget removes the Memory and its living state from every read; erasure cascades.
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
// Fixtures (the 0171 verifier's, unchanged in meaning). Explicit, strictly increasing instants.
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
    [id, userId, type, content ?? `verifier-0172 fact ${tick}`, source, status, expiresAt, at],
  );
  // An attribution is recorded only with a live Memory (0152), so an expired fixture is created expired, unattributed.
  if (subject && status === 'ACTIVE' && (expiresAt === null || new Date(expiresAt) > new Date())) await client.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis) VALUES ($1, $2, $3, 'EXPLICIT_STATEMENT')", [id, userId, subject]);
  return id;
}
/** A profile as an earlier capture would have written it (the table owner writes fixtures). */
const profile = (memoryId, userId, { slot = null, temporal = 'CURRENT', indexed = true } = {}) => client.query(
  'INSERT INTO public.memory_retrieval_profiles (memory_id, user_id, semantic_indexed, slot, temporal) VALUES ($1, $2, $3, $4, $5)',
  [memoryId, userId, indexed, slot, temporal]);
const term = (memoryId, userId, value) => client.query('INSERT INTO public.memory_retrieval_terms (memory_id, user_id, term) VALUES ($1, $2, $3)', [memoryId, userId, value]);

async function captureExecution(userId, sessionId, { content = 'رسالة', turn = null, claim = true, state = 'RUNNING', at } = {}) {
  const sourceTurn = turn ?? (await userTurn(userId, sessionId, { content, ...(at ? { at } : {}) })).id;
  const id = randomUUID();
  await client.query(`INSERT INTO public.post_response_intelligence_executions (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path,
      safety_disposition, state, current_stage, terminal_at) VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', $6, 'VERIFIER_0172',
      CASE WHEN $6 = 'RUNNING' THEN NULL ELSE CURRENT_TIMESTAMP END)`, [id, randomUUID(), userId, sessionId, sourceTurn, state]);
  if (claim) await client.query("INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state) VALUES ($1, 'UNDERSTANDING_CAPTURE_PROVIDER', 'CLAIMED')", [id]);
  return { id, turn: sourceTurn };
}

const CAPTURE_V2 = `SELECT public.complete_post_response_personal_capture_v2($1, $2::uuid[], $3::text[], $4::text[], $5::double precision[], $6::timestamptz[],
  $7::text[], $8::text[], $9::text[], $10::uuid[], $11::text[], $12::text[], $13::uuid[], $14::text[], $15::uuid[], $16::uuid[]) AS answer`;
/** The v2 command exactly as the repository sends it: parallel arrays, terms flattened. */
function captureArgs(executionId, { items = [], index = [], reaffirmed = [], ended = [] }) {
  const terms = [...items, ...index].flatMap((entry) => (entry.terms ?? []).map((value) => [entry.id, value]));
  return [executionId,
    items.map((i) => i.id), items.map((i) => i.type ?? 'PERSONAL_FACT'), items.map((i) => i.content), items.map((i) => i.importance ?? 0.65),
    items.map((i) => i.expiresAt ?? null), items.map((i) => i.slot ?? null), items.map((i) => i.temporal ?? 'CURRENT'), items.map((i) => ('subject' in i ? i.subject : 'SELF')),
    index.map((i) => i.id), index.map((i) => i.slot ?? null), index.map((i) => i.temporal ?? 'CURRENT'),
    terms.map(([id]) => id), terms.map(([, value]) => value), reaffirmed, ended];
}
const capture = async (executionId, command) => (await asServer(() => one(CAPTURE_V2, captureArgs(executionId, command)))).answer;
const CAPTURE_V1 = `SELECT public.complete_post_response_personal_capture_v1($1, $2::uuid[], $3::text[], $4::text[], $5::double precision[], $6::timestamptz[],
  $7::text[], $8::text[], $9::uuid[], $10::text[], $11::text[], $12::uuid[], $13::text[]) AS answer`;
const backfillV1 = async (executionId, memoryId, temporal = 'CURRENT', slot = null) => (await asServer(() => one(CAPTURE_V1,
  [executionId, [], [], [], [], [], [], [], [memoryId], [slot], [temporal], [memoryId], ['مفتاح']]))).answer;
// The 0152 Memory command, exactly as the 0171 verifier drives it.
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
const stateOf = (memoryId) => one('SELECT semantic_indexed, slot, temporal, last_stated_at, restated_count, ended_at, ended_execution_id FROM public.memory_retrieval_profiles WHERE memory_id = $1', [memoryId]);
async function knowledge(userId, limit = 120) {
  await actAs('authenticated', userId);
  const value = await rows('SELECT * FROM public.personal_knowledge_sources_v1($1)', [limit]);
  await asOwner();
  return value;
}
async function retrieve(userId, terms) {
  await actAs('authenticated', userId);
  const value = await rows('SELECT * FROM public.retrieve_personal_memory_candidates_v1($1::text[], 12)', [terms]);
  await asOwner();
  return value;
}
const currentState = (sourceTurnId, limit = 10) => asServer(() => rows('SELECT * FROM public.background_current_state_memories_v1($1, $2)', [sourceTurnId, limit]));

// ------------------------------------------------------------------------------------------------------------------
// C-1. The catalog.
// ------------------------------------------------------------------------------------------------------------------
const FUNCTIONS = {
  'public.keep_memory_living_state_v1()': { definer: false, roles: [] },
  'public.post_response_personal_capture_result_valid_v2(jsonb)': { definer: false, roles: [] },
  'public.background_current_state_memories_v1(uuid,integer)': { definer: true, roles: ['service_role'] },
  'public.complete_post_response_personal_capture_v2(uuid,uuid[],text[],text[],double precision[],timestamp with time zone[],text[],text[],text[],uuid[],text[],text[],uuid[],text[],uuid[],uuid[])': { definer: true, roles: ['service_role'] },
  'public.personal_knowledge_sources_v1(integer)': { definer: false, roles: ['authenticated'] },
  // Unchanged by 0172: still the 0171 command, still the server's.
  'public.complete_post_response_personal_capture_v1(uuid,uuid[],text[],text[],double precision[],timestamp with time zone[],text[],text[],uuid[],text[],text[],uuid[],text[])': { definer: true, roles: ['service_role'] },
};
const API_ROLES = ['anon', 'authenticated', 'service_role'];
const constraintDef = async (table, name) => (await one('SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1::regclass AND conname = $2', [table, name]))?.def;

async function verifyCatalog() {
  stage = 'C-1 catalog: the living-state columns and their CHECKs';
  const columns = await rows(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memory_retrieval_profiles' AND column_name IN ('last_stated_at','restated_count','ended_at','ended_execution_id') ORDER BY column_name`);
  assert.deepEqual(columns.map((c) => [c.column_name, c.data_type, c.is_nullable]), [
    ['ended_at', 'timestamp with time zone', 'YES'], ['ended_execution_id', 'uuid', 'YES'],
    ['last_stated_at', 'timestamp with time zone', 'YES'], ['restated_count', 'integer', 'NO']]);
  assert.match(await constraintDef('public.memory_retrieval_profiles', 'memory_retrieval_profiles_restated_check'), /restated_count >= 0/u);
  assert.match(await constraintDef('public.memory_retrieval_profiles', 'memory_retrieval_profiles_ended_check'), /ended_at IS NULL.*ended_execution_id IS NULL.*'PAST'/su);
  for (const role of API_ROLES) {
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
      assert.equal((await one('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, 'public.memory_retrieval_profiles', privilege])).allowed, false, `${role} has no ${privilege}`);
    }
  }

  stage = 'C-1 catalog: the guard trigger';
  const trigger = await one("SELECT pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid = 'public.memory_retrieval_profiles'::regclass AND tgname = 'memory_retrieval_profiles_keep_living_state'");
  assert.match(trigger.def, /BEFORE UPDATE ON public\.memory_retrieval_profiles FOR EACH ROW EXECUTE FUNCTION keep_memory_living_state_v1\(\)/u);

  stage = 'C-1 catalog: every new function - owner, security mode, empty search_path, EXECUTE';
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

  stage = 'C-1 catalog: the attribution basis widened by exactly one value, OTHER only, naming an execution';
  const basis = await constraintDef('public.memory_subject_attributions', 'memory_subject_attributions_basis_check');
  assert.equal(basis.match(/'[A-Z_]+'::text/gu).length, 7);
  assert.match(basis, /'MODEL_ASSISTED_RELATION_CAPTURE'::text/u);
  assert.match(await constraintDef('public.memory_subject_attributions', 'memory_subject_attributions_relation_capture_check'), /subject = 'OTHER'::text\) AND \(execution_id IS NOT NULL/u);
  assert.match(await constraintDef('public.memory_subject_attributions', 'memory_subject_attributions_capture_self_check'), /MODEL_ASSISTED_CAPTURE.*OR \(subject = 'SELF'::text\)/u);
  assert.doesNotMatch(await constraintDef('public.memory_subject_attributions', 'memory_subject_attributions_capture_self_check'), /RELATION/u);
  assert.match(await constraintDef('public.post_response_intelligence_effects', 'post_response_intelligence_effects_understanding_result_check'), /post_response_personal_capture_result_valid_v2/u);
}

// ------------------------------------------------------------------------------------------------------------------
// P-1. The typed result.
// ------------------------------------------------------------------------------------------------------------------
async function verifyResult() {
  stage = 'P-1 the payload validator: the 0171 shape, or the same plus updatedMemoryIds; identifiers only, bounded';
  const a = randomUUID(); const b = randomUUID();
  const valid = async (value) => (await one('SELECT public.post_response_personal_capture_result_valid_v2($1::jsonb) AS ok', [value === undefined ? null : JSON.stringify(value)])).ok;
  for (const value of [{ memoryIds: [a], indexedMemoryIds: [] }, { memoryIds: [], indexedMemoryIds: [], updatedMemoryIds: [a] },
    { memoryIds: [a], indexedMemoryIds: [b], updatedMemoryIds: Array.from({ length: 13 }, randomUUID) }, { memoryIds: [], indexedMemoryIds: [a], updatedMemoryIds: [a] }]) {
    assert.equal(await valid(value), true, JSON.stringify(value));
  }
  for (const value of [undefined, { memoryIds: [], indexedMemoryIds: [] }, { memoryIds: [], indexedMemoryIds: [], updatedMemoryIds: [] },
    { memoryIds: [], indexedMemoryIds: [], updatedMemoryIds: Array.from({ length: 14 }, randomUUID) }, { memoryIds: [], indexedMemoryIds: [], updatedMemoryIds: [a, a] },
    { memoryIds: [], indexedMemoryIds: [], updatedMemoryIds: ['x'] }, { memoryIds: [], updatedMemoryIds: [a] },
    { memoryIds: [], indexedMemoryIds: [], updatedMemoryIds: [a], content: 'x' }, { memoryIds: [a], indexedMemoryIds: [], ended: [a] }]) {
    assert.equal(await valid(value), false, JSON.stringify(value));
  }
}

// ------------------------------------------------------------------------------------------------------------------
// F-1. Family relationship statements.
// ------------------------------------------------------------------------------------------------------------------
async function verifyFamily() {
  const me = await reader();
  const s = await session(me);

  stage = 'F-1 a family statement is kept as OTHER / MODEL_ASSISTED_RELATION_CAPTURE, never as the user\'s own fact';
  const execution = await captureExecution(me, s, { content: 'أنا ساكن في المعادي ومراتي اسمها سارة' });
  const home = randomUUID(); const wife = randomUUID();
  assert.equal(await capture(execution.id, { items: [
    { id: home, content: 'أنا ساكن في المعادي.', slot: 'RESIDENCE', terms: ['ساكن'] },
    { id: wife, type: 'RELATIONSHIP_CONTEXT', content: 'مراتي اسمها سارة.', subject: 'OTHER', importance: 0.75, terms: ['ساره', 'زوجه'] },
  ] }), 'COMPLETED');
  assert.deepEqual(await one('SELECT subject, basis, execution_id FROM public.memory_subject_attributions WHERE memory_id = $1', [home]),
    { subject: 'SELF', basis: 'MODEL_ASSISTED_CAPTURE', execution_id: execution.id });
  assert.deepEqual(await one('SELECT subject, basis, execution_id FROM public.memory_subject_attributions WHERE memory_id = $1', [wife]),
    { subject: 'OTHER', basis: 'MODEL_ASSISTED_RELATION_CAPTURE', execution_id: execution.id });
  assert.deepEqual(await one('SELECT type, content, source, confidence, status FROM public.memories WHERE id = $1', [wife]),
    { type: 'RELATIONSHIP_CONTEXT', content: 'مراتي اسمها سارة.', source: 'USER_STATED', confidence: 0.8, status: 'ACTIVE' });
  assert.deepEqual((await effectOf(execution.id)).result_payload, { memoryIds: [home, wife], indexedMemoryIds: [], updatedMemoryIds: [] });

  stage = 'F-1 someone else\'s fact is only a family relationship statement: no other type, no slot, no time-bound state';
  for (const bad of [{ type: 'PERSONAL_FACT' }, { slot: 'RESIDENCE' }, { temporal: 'PLANNED' }, { subject: 'UNCLEAR' }, { subject: null }]) {
    const e = await captureExecution(me, s);
    await rejected(() => capture(e.id, { items: [{ id: randomUUID(), type: 'RELATIONSHIP_CONTEXT', content: 'ابني اسمه يوسف.', subject: 'OTHER', ...bad }] }), ['22023'], /INVALID_UNDERSTANDING_CAPTURE/u);
  }
  stage = 'F-1 the attribution itself refuses a relation basis about the user, or without an execution';
  const stray = await memory(me, { content: 'سطر للتحقق.', subject: null });
  await rejected(() => client.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, execution_id) VALUES ($1, $2, 'SELF', 'MODEL_ASSISTED_RELATION_CAPTURE', $3)", [stray, me, execution.id]), ['23514']);
  await rejected(() => client.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis) VALUES ($1, $2, 'OTHER', 'MODEL_ASSISTED_RELATION_CAPTURE')", [stray, me]), ['23514']);

  stage = 'F-1 the same family statement is never kept twice, whoever it was attributed to';
  const again = await captureExecution(me, s);
  assert.equal(await capture(again.id, { items: [{ id: randomUUID(), type: 'RELATIONSHIP_CONTEXT', content: 'مراتي  اسمها سارة', subject: 'OTHER' }] }), 'COMPLETED');
  assert.equal((await effectOf(again.id)).result_code, 'NO_UNDERSTANDING_RECORDED');
  assert.equal(Number((await one("SELECT count(*) AS n FROM public.memories WHERE user_id = $1 AND content LIKE '%اسمها سارة%'", [me])).n), 1);
}

// ------------------------------------------------------------------------------------------------------------------
// L. The living state.
// ------------------------------------------------------------------------------------------------------------------
async function verifyLivingState() {
  const me = await reader();
  const s = await session(me);

  stage = 'L-1 a verified restatement moves last_stated_at to the message and counts once';
  const home = await memory(me, { content: 'أنا ساكن في المعادي.' });
  await profile(home, me, { slot: 'RESIDENCE' });
  const first = await captureExecution(me, s);
  const firstTurn = await one('SELECT created_at FROM public.conversation_turns WHERE id = $1', [first.turn]);
  assert.equal(await capture(first.id, { reaffirmed: [home] }), 'COMPLETED');
  assert.deepEqual((await effectOf(first.id)).result_payload, { memoryIds: [], indexedMemoryIds: [], updatedMemoryIds: [home] });
  let living = await stateOf(home);
  assert.deepEqual([living.restated_count, living.last_stated_at.toISOString(), living.temporal, living.slot], [1, firstTurn.created_at.toISOString(), 'CURRENT', 'RESIDENCE']);
  assert.equal(await capture(first.id, { reaffirmed: [home] }), 'NO_OP', 'a replay is NO_OP');
  assert.equal((await stateOf(home)).restated_count, 1);

  stage = 'L-1 never backwards: a message older than the last statement restates nothing';
  const older = await captureExecution(me, s, { at: '2026-09-01T00:00:00.000Z' });
  assert.equal(await capture(older.id, { reaffirmed: [home] }), 'COMPLETED');
  assert.equal((await effectOf(older.id)).result_code, 'NO_UNDERSTANDING_RECORDED');
  assert.equal((await stateOf(home)).restated_count, 1);

  stage = 'L-1 the same words again restate the existing Memory instead of being dropped silently';
  const same = await captureExecution(me, s);
  assert.equal(await capture(same.id, { items: [{ id: randomUUID(), content: 'أنا  ساكن في المعادي', slot: 'RESIDENCE' }] }), 'COMPLETED');
  assert.deepEqual((await effectOf(same.id)).result_payload, { memoryIds: [], indexedMemoryIds: [], updatedMemoryIds: [home] });
  assert.equal((await stateOf(home)).restated_count, 2);
  assert.equal(Number((await one("SELECT count(*) AS n FROM public.memories WHERE user_id = $1 AND content LIKE '%ساكن في المعادي%'", [me])).n), 1);

  stage = 'L-1 a Memory with no profile yet gets its living state, and the 0171 backfill indexes it later without losing it';
  const coffee = await memory(me, { content: 'بحب القهوة.', type: 'STABLE_PREFERENCE' });
  const third = await captureExecution(me, s);
  assert.equal(await capture(third.id, { reaffirmed: [coffee] }), 'COMPLETED');
  assert.deepEqual([(await stateOf(coffee)).semantic_indexed, (await stateOf(coffee)).restated_count], [false, 1]);
  const indexing = await captureExecution(me, s);
  assert.equal(await backfillV1(indexing.id, coffee), 'COMPLETED');
  living = await stateOf(coffee);
  assert.deepEqual([living.semantic_indexed, living.restated_count, living.temporal], [true, 1, 'CURRENT']);

  stage = 'L-2 an explicit ending makes the Memory PAST - still ACTIVE, still true as history - naming the execution';
  const smoking = await memory(me, { content: 'أنا بدخن.' });
  await profile(smoking, me, { slot: 'SMOKING' });
  const ending = await captureExecution(me, s);
  assert.equal(await capture(ending.id, { ended: [smoking] }), 'COMPLETED');
  living = await stateOf(smoking);
  assert.deepEqual([living.temporal, living.slot, living.ended_execution_id, living.ended_at !== null], ['PAST', 'SMOKING', ending.id, true]);
  assert.equal((await one('SELECT status FROM public.memories WHERE id = $1', [smoking])).status, 'ACTIVE');

  stage = 'L-2 nothing makes an ended Memory current again: not an index write, not a restatement, not a second ending';
  await client.query("UPDATE public.memory_retrieval_profiles SET temporal = 'CURRENT', ended_at = NULL, ended_execution_id = NULL, restated_count = 0, last_stated_at = NULL WHERE memory_id = $1", [smoking]);
  living = await stateOf(smoking);
  assert.deepEqual([living.temporal, living.ended_execution_id], ['PAST', ending.id]);
  const restating = await captureExecution(me, s);
  assert.equal(await capture(restating.id, { reaffirmed: [smoking] }), 'COMPLETED');
  assert.equal((await effectOf(restating.id)).result_code, 'NO_UNDERSTANDING_RECORDED');
  const twice = await captureExecution(me, s);
  assert.equal(await capture(twice.id, { ended: [smoking] }), 'COMPLETED');
  assert.equal((await stateOf(smoking)).ended_execution_id, ending.id);
  const unprofiled = await memory(me, { content: 'ناوي أسافر ألمانيا.' });
  const endUnprofiled = await captureExecution(me, s);
  assert.equal(await capture(endUnprofiled.id, { ended: [unprofiled] }), 'COMPLETED');
  const backfill = await captureExecution(me, s);
  assert.equal(await backfillV1(backfill.id, unprofiled, 'PLANNED'), 'COMPLETED');
  living = await stateOf(unprofiled);
  assert.deepEqual([living.semantic_indexed, living.temporal, living.ended_execution_id], [true, 'PAST', endUnprofiled.id], 'the 0171 backfill never revives an ended Memory');

  stage = 'L-3 only the owner\'s ACTIVE, unexpired SELF Memory created before the message';
  const stranger = await reader();
  const theirs = await memory(stranger, { content: 'أنا بدخن.' });
  const brother = await memory(me, { content: 'أخويا بيدخن.', subject: 'OTHER' });
  const unattributed = await memory(me, { content: 'حد بيدخن.', subject: null });
  const forgotten = await memory(me, { content: 'أنا بشرب شاي كتير.' });
  await client.query("UPDATE public.memories SET status = 'DELETED' WHERE id = $1", [forgotten]);
  const expired = await memory(me, { content: 'عندي امتحان.', type: 'TEMPORARY_STATE', at: '2020-01-01T00:00:00.000Z', expiresAt: '2020-01-02T00:00:00.000Z' });
  const late = await captureExecution(me, s);
  const after = await memory(me, { content: 'أنا بلعب كورة.', at: '2026-12-01T00:00:00.000Z' });
  assert.equal(await capture(late.id, { reaffirmed: [theirs, brother, unattributed, after], ended: [forgotten, expired, randomUUID()] }), 'COMPLETED');
  assert.equal((await effectOf(late.id)).result_code, 'NO_UNDERSTANDING_RECORDED');
  assert.equal(Number((await one('SELECT count(*) AS n FROM public.memory_retrieval_profiles WHERE memory_id = ANY ($1::uuid[])', [[theirs, brother, unattributed, forgotten, expired, after]])).n), 0);

  stage = 'L-3 nothing is restated or ended on a Memory-command turn';
  const commandTurn = await userTurn(me, s, { status: 'GENERATING', content: 'افتكر إني بحب الشاي' });
  assert.deepEqual(await finalize2({ session: s, user: me, turn: commandTurn.id, kind: 'REMEMBER', outcome: 'REMEMBERED', type: 'STABLE_PREFERENCE', content: 'أنا بحب الشاي.', subject: 'SELF' }), ['REMEMBERED']);
  const onCommand = await captureExecution(me, s, { turn: commandTurn.id });
  const before = (await stateOf(home)).restated_count;
  assert.equal(await capture(onCommand.id, { reaffirmed: [home], ended: [coffee] }), 'COMPLETED');
  assert.deepEqual([(await stateOf(home)).restated_count, (await stateOf(coffee)).ended_at], [before, null]);

  stage = 'L-3 an invalid batch is refused before anything is written';
  const bad = await captureExecution(me, s);
  for (const command of [{ reaffirmed: [home], ended: [home] }, { reaffirmed: Array.from({ length: 11 }, randomUUID) },
    { reaffirmed: Array.from({ length: 6 }, randomUUID), ended: Array.from({ length: 5 }, randomUUID) }, { reaffirmed: [home, home] }]) {
    await rejected(() => capture(bad.id, command), ['22023'], /INVALID_UNDERSTANDING_CAPTURE/u);
  }
  await rejected(() => asServer(() => one(CAPTURE_V2, [...captureArgs(bad.id, {}).slice(0, 14), [null], []])), ['22023']);
  assert.equal((await effectOf(bad.id)).state, 'CLAIMED');
}

// ------------------------------------------------------------------------------------------------------------------
// L-4 / S-1 / K. The reads.
// ------------------------------------------------------------------------------------------------------------------
async function verifyReads() {
  const me = await reader();
  const other = await reader();
  const s = await session(me);

  stage = 'L-4 an ended fact leaves its slot: the other one is no longer UNSETTLED, in both reads';
  const maadi = await memory(me, { content: 'أنا ساكن في المعادي.' });
  const zayed = await memory(me, { content: 'أنا ساكن في الشيخ زايد.' });
  await profile(maadi, me, { slot: 'RESIDENCE' }); await profile(zayed, me, { slot: 'RESIDENCE' });
  await term(maadi, me, 'ساكن'); await term(zayed, me, 'ساكن');
  assert.deepEqual((await retrieve(me, ['ساكن'])).map((r) => r.unsettled), [true, true]);
  const moving = await captureExecution(me, s);
  assert.equal(await capture(moving.id, { ended: [maadi] }), 'COMPLETED');
  assert.deepEqual(Object.fromEntries((await retrieve(me, ['ساكن'])).map((r) => [r.id, r.unsettled])), { [maadi]: false, [zayed]: false });
  const read = Object.fromEntries((await knowledge(me)).map((r) => [r.id, r]));
  assert.deepEqual([read[maadi].ended, read[maadi].temporal, read[maadi].unsettled, read[zayed].unsettled], [true, 'PAST', false, false]);

  stage = 'S-1 the current-state read: execution-scoped, the owner\'s SELF current states only, with their terms';
  const plan = await memory(me, { content: 'ناوي أغير شغلي.' }); await profile(plan, me, { temporal: 'PLANNED' });
  const exam = await memory(me, { content: 'عندي امتحان بكرة.', type: 'TEMPORARY_STATE', expiresAt: '2099-01-01T00:00:00.000Z' });
  const decision = await memory(me, { content: 'قررت أبطل السكر.', type: 'DECISION_COMMITMENT' });
  const unslotted = await memory(me, { content: 'بحب الكتب.' }); await profile(unslotted, me);
  const wife = await memory(me, { content: 'مراتي ناوية تسافر.', subject: 'OTHER' }); await profile(wife, me, { temporal: 'PLANNED' });
  const nobody = await memory(me, { content: 'حد ناوي يسافر.', subject: null }); await profile(nobody, me, { temporal: 'PLANNED' });
  const pref = await memory(me, { content: 'رد عليا باختصار.', type: 'INTERACTION_PREFERENCE' }); await profile(pref, me, { temporal: 'PLANNED' });
  const theirs = await memory(other, { content: 'ناوي أسافر.' }); await profile(theirs, other, { temporal: 'PLANNED' });
  const reading = await captureExecution(me, s);
  const state = await currentState(reading.turn);
  assert.deepEqual(new Set(state.map((r) => r.memory_id)), new Set([zayed, plan, exam, decision]));
  assert.deepEqual(state.find((r) => r.memory_id === zayed).terms, ['ساكن']);
  assert.equal((await currentState(reading.turn, 2)).length, 2);
  assert.equal((await currentState(reading.turn, 50)).length <= 10, true);
  await rejected(() => currentState(randomUUID()), ['42501'], /UNDERSTANDING_EXECUTION_NOT_ASSOCIATED/u);
  await rejected(() => currentState(reading.turn, -1), ['22023']);
  void unslotted; void wife; void nobody; void pref; void theirs;

  stage = 'K-1 the knowledge read: the caller\'s own eligible Memories only, with their living state';
  const derived = await memory(me, { content: 'يبدو إنه بيحب النظام.', type: 'DERIVED_INSIGHT', source: 'USER_CONFIRMED' });
  const gone = await memory(me, { content: 'أنا بشرب قهوة كتير.' });
  await client.query("UPDATE public.memories SET status = 'DELETED' WHERE id = $1", [gone]);
  const ids = new Set((await knowledge(me)).map((r) => r.id));
  for (const kept of [maadi, zayed, plan, exam, decision, unslotted, wife, nobody]) assert.ok(ids.has(kept), 'an eligible Memory is read');
  for (const never of [pref, derived, gone, theirs]) assert.ok(!ids.has(never), 'never an Interaction Preference, a Derived Insight, a forgotten one or another owner\'s');
  const row = (await knowledge(me)).find((r) => r.id === wife);
  assert.deepEqual([row.subject, row.temporal, row.ended, row.restated_count], ['OTHER', 'PLANNED', false, 0]);
  assert.ok((await knowledge(me, 3)).length === 3 && (await knowledge(me, 500)).length <= 120, 'bounded');
  const order = (await knowledge(me)).map((r) => r.id);
  assert.equal(order.at(-1), maadi, 'PAST and ended rows come last, so the bound drops them first');
  for (const role of ['anon', 'service_role']) {
    assert.equal((await one('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, 'public.personal_knowledge_sources_v1(integer)', 'EXECUTE'])).allowed, false);
  }
  assert.deepEqual(await knowledge(randomUUID()), [], 'an unknown caller reads nothing');

  stage = 'K-2 a forget removes the Memory and its living state from every read; erasure cascades';
  await client.query("UPDATE public.memories SET status = 'DELETED' WHERE id = $1", [zayed]);
  assert.equal(await stateOf(zayed), undefined, 'the retire trigger removed the profile');
  assert.ok(!(await knowledge(me)).some((r) => r.id === zayed));
  assert.ok(!(await currentState(reading.turn)).some((r) => r.memory_id === zayed));
}

async function verifyErasure() {
  stage = 'K-2 the governed Personal erasure removes the living state and the family attributions with the account';
  const alice = await reader();
  const bob = await reader();
  for (const userId of [alice, bob]) {
    const s = await session(userId);
    const smoking = await memory(userId, { content: 'أنا بدخن.' });
    await profile(smoking, userId, { slot: 'SMOKING' });
    const execution = await captureExecution(userId, s);
    assert.equal(await capture(execution.id, { ended: [smoking], items: [{ id: randomUUID(), type: 'RELATIONSHIP_CONTEXT', content: 'ابني اسمه يوسف.', subject: 'OTHER' }] }), 'COMPLETED');
  }
  const footprint = async (userId) => [
    Number((await one('SELECT count(*) AS n FROM public.memory_retrieval_profiles WHERE user_id = $1 AND ended_at IS NOT NULL', [userId])).n),
    Number((await one("SELECT count(*) AS n FROM public.memory_subject_attributions WHERE user_id = $1 AND basis = 'MODEL_ASSISTED_RELATION_CAPTURE'", [userId])).n)];
  assert.deepEqual([await footprint(alice), await footprint(bob)], [[1, 1], [1, 1]], 'the fixture populates both');
  await actAs('authenticated', alice, { amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - 1 }] });
  assert.equal((await one('SELECT * FROM public.request_own_account_deletion_v1($1)', [randomUUID()])).outcome, 'ACCEPTED');
  await asOwner();
  await client.query(`UPDATE personal_data_private.account_deletions SET requested_at = clock_timestamp() - interval '8 days', final_at = clock_timestamp() - interval '1 day'
    WHERE user_id = $1 AND status = 'SCHEDULED'`, [alice]);
  const { id: deletionId } = await one("SELECT id FROM personal_data_private.account_deletions WHERE user_id = $1 AND status <> 'CANCELLED'", [alice]);
  await asServer(() => rows('SELECT * FROM public.server_claim_due_account_deletions_v1(20)'));
  assert.equal((await asServer(() => one('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId]))).outcome, 'ERASED');
  assert.deepEqual([await footprint(alice), await footprint(bob)], [[0, 0], [1, 1]], 'nothing of the account remains; another reader is untouched');
}

(async () => {
  await client.connect();
  try {
    for (const step of [verifyCatalog, verifyResult, verifyFamily, verifyLivingState, verifyReads, verifyErasure]) {
      await client.query('BEGIN');
      try { await step(); } finally { await client.query('ROLLBACK'); }
    }
    console.log('Verified migration 0172 Living Personal Memory: the living state of a Memory (last stated, restated, explicitly ended) that only moves forward and never revives an ended Memory, family relationship statements kept only as someone else\'s (OTHER / MODEL_ASSISTED_RELATION_CAPTURE), restatements and endings applied only to the owner\'s ACTIVE SELF Memories created before the message and never on a command turn, an identifiers-only result, an execution-scoped current-state read, and an RLS-bound bounded knowledge read with read-time eligibility that never serves an Interaction Preference, a Derived Insight, a forgotten, expired or another owner\'s Memory.');
  } catch (error) {
    console.error(`FAILED at stage: ${stage}`);
    throw error;
  } finally {
    await client.end();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
