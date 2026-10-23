// S8A-03 CP2 - Personal Understanding (natural acquisition and semantic Memory retrieval): the real-PostgreSQL verifier
// for migration 0171.
//
// Against a fully migrated database (API CI applies every migration first), it proves the durable half of the Founder's
// CP2 option B and the CP2 acceptance criteria that live in the database:
//   C-1  the catalog: the two index tables (owner-only RLS, SELECT only, composite CASCADE FKs, no API write), the
//        retirement trigger, every new function's owner / security mode / empty search_path / EXECUTE, the effect,
//        attribution and AI-COST-01 CHECKs widened by exactly one value each;
//   P-1  the typed effect result: the identifiers-only payload validator and the three admitted effect states;
//   A-1  the ONE atomic capture command: model-assisted Memories are USER_STATED, ACTIVE, confidence 0.80, SELF /
//        MODEL_ASSISTED_CAPTURE naming the execution, indexed with their profile and terms, and the effect completes
//        with their identifiers only (criterion 1);
//   A-2  repetition and partial failure never contradict (criterion 8): a replay is NO_OP, a second execution with the
//        same words is skipped as an equivalent, a failure after a write rolls the whole command back and leaves the
//        effect CLAIMED, an invalid batch writes nothing;
//   A-3  the 0152 rules per item: nothing captured on a Memory-command turn (the backfill still indexes), nothing a
//        later FORGET / CORRECT withdrew, nothing equivalent to an ACTIVE SELF / UNATTRIBUTED Memory of any type, while
//        the same words about someone else are a different fact;
//   B-1  the bounded backfill read: execution-scoped, owner-only, eligible and unindexed Memories, newest first, at most
//        four; the index command skips anything ineligible and never re-indexes;
//   Q-1  retrieval outside the 32 most recent Memories, by a term the Memory is indexed under (criteria 2-3);
//   Q-2  a correction removes the old version from the index and from every read; the new one is backfilled (crit. 4);
//   Q-3  a forget removes the Memory's index and every read of it (criterion 5); an expired Memory is never served;
//   Q-4  cross-user isolation (criterion 7): RLS on both tables, retrieval never serves another owner's Memory, the
//        functions are executable only by their one role;
//   Q-5  same slot (CP2 R1): two CURRENT SELF facts in one slot are both served, flagged UNSETTLED (never a confirmed
//        conflict); a PAST fact, a plan and someone else's fact are never UNSETTLED; a Memory with no slot is retrieved normally (slots never filter retrieval);
//   E-1  deleting a Memory (the governed erasure's path) cascades its index.
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
async function actAs(role, userId = null, extra = {}) {
  await client.query('RESET ROLE');
  await client.query(`SET LOCAL ROLE ${role}`);
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [userId ? JSON.stringify({ sub: userId, role, ...extra }) : '{}']);
}
async function asOwner() {
  await client.query('RESET ROLE');
  await client.query("SELECT set_config('request.jwt.claims', '{}', true)");
}
async function asServer(work) {
  await actAs('service_role');
  const value = await work();
  await asOwner();
  return value;
}

// ------------------------------------------------------------------------------------------------------------------
// Fixtures. Explicit, strictly increasing instants: "newest first" and "a later command" are orders, and every row of
// one transaction would otherwise share CURRENT_TIMESTAMP.
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
async function userTurn(userId, sessionId, { status = 'GENERATING', content = 'رسالة عادية' } = {}) {
  const id = randomUUID();
  const at = nextInstant();
  await client.query(
    `INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, created_at, updated_at, completed_at)
     VALUES ($1, $2, $3, 'USER', $4, $5, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', $6, $6, CASE WHEN $4 = 'COMPLETED' THEN $6::timestamptz END)`,
    [id, sessionId, userId, status, content, at],
  );
  return id;
}
/** One owned Memory written as the table owner (an earlier writer's row), at an explicit instant. */
async function memory(userId, { content, type = 'PERSONAL_FACT', status = 'ACTIVE', subject = 'SELF', expiresAt = null, at = nextInstant() } = {}) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status, expires_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'USER_STATED', 0.95, 0.65, $5, $6, $7, $7)`,
    [id, userId, type, content ?? `verifier-0171 fact ${tick}`, status, expiresAt, at],
  );
  if (subject && status === 'ACTIVE' && (expiresAt === null || new Date(expiresAt) > new Date())) await client.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis) VALUES ($1, $2, $3, 'EXPLICIT_STATEMENT')", [id, userId, subject]);
  return id;
}
/** A Memory that expired long ago (expiry is an immutable historical field, so it is created expired). */
const expiredMemory = (userId, content) => memory(userId, { content, type: 'TEMPORARY_STATE', at: '2020-01-01T00:00:00.000Z', expiresAt: '2020-01-02T00:00:00.000Z' });

/** A completed user turn (or the given one) with its RUNNING execution and UNDERSTANDING_CAPTURE_PROVIDER claimed. */
async function captureExecution(userId, sessionId, { content = 'أنا ساكن في المعادي', turn = null, claim = true, state = 'RUNNING' } = {}) {
  const sourceTurn = turn ?? await userTurn(userId, sessionId, { status: 'COMPLETED', content });
  const id = randomUUID();
  await client.query(`INSERT INTO public.post_response_intelligence_executions (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path,
      safety_disposition, state, current_stage, terminal_at) VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', $6, 'VERIFIER_0171',
      CASE WHEN $6 = 'RUNNING' THEN NULL ELSE CURRENT_TIMESTAMP END)`, [id, randomUUID(), userId, sessionId, sourceTurn, state]);
  if (claim) await client.query("INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state) VALUES ($1, 'UNDERSTANDING_CAPTURE_PROVIDER', 'CLAIMED')", [id]);
  return { id, turn: sourceTurn };
}
const CAPTURE = `SELECT public.complete_post_response_personal_capture_v1($1, $2::uuid[], $3::text[], $4::text[], $5::double precision[], $6::timestamptz[],
  $7::text[], $8::text[], $9::uuid[], $10::text[], $11::text[], $12::uuid[], $13::text[]) AS answer`;
/** The capture command exactly as the repository sends it: parallel arrays, terms flattened. */
function captureArgs(executionId, { items = [], index = [] }) {
  const terms = [...items, ...index].flatMap((entry) => (entry.terms ?? []).map((term) => [entry.id, term]));
  return [executionId,
    items.map((i) => i.id), items.map((i) => i.type ?? 'PERSONAL_FACT'), items.map((i) => i.content), items.map((i) => i.importance ?? 0.65),
    items.map((i) => i.expiresAt ?? null), items.map((i) => i.slot ?? null), items.map((i) => i.temporal ?? 'CURRENT'),
    index.map((i) => i.id), index.map((i) => i.slot ?? null), index.map((i) => i.temporal ?? 'CURRENT'),
    terms.map(([id]) => id), terms.map(([, term]) => term)];
}
const capture = async (executionId, command) => (await asServer(() => one(CAPTURE, captureArgs(executionId, command)))).answer;
const effectOf = (executionId) => one("SELECT state, result_code, result_reference, result_payload FROM public.post_response_intelligence_effects WHERE execution_id = $1 AND effect_key = 'UNDERSTANDING_CAPTURE_PROVIDER'", [executionId]);
const termsOf = async (memoryId) => (await rows('SELECT term FROM public.memory_retrieval_terms WHERE memory_id = $1 ORDER BY term', [memoryId])).map((r) => r.term);
const profileOf = (memoryId) => one('SELECT semantic_indexed, slot, temporal FROM public.memory_retrieval_profiles WHERE memory_id = $1', [memoryId]);
const backfill = async (sourceTurnId, limit = 4) => asServer(() => rows('SELECT * FROM public.background_unindexed_memories_v1($1, $2)', [sourceTurnId, limit]));
async function retrieve(userId, terms, limit = 12) {
  await actAs('authenticated', userId);
  const answer = await rows('SELECT * FROM public.retrieve_personal_memory_candidates_v1($1::text[], $2)', [terms, limit]);
  await asOwner();
  return answer;
}
/** Index an existing Memory through the real command (a backfill row), with its terms. */
async function index(userId, sessionId, memoryId, terms, { slot = null, temporal = 'CURRENT' } = {}) {
  const execution = await captureExecution(userId, sessionId, { content: 'تمام' });
  assert.equal(await capture(execution.id, { index: [{ id: memoryId, slot, temporal, terms }] }), 'COMPLETED');
}

// The 0152 conversational command (v2), exactly as the 0152 verifier drives it.
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

// ------------------------------------------------------------------------------------------------------------------
// C-1. The catalog.
// ------------------------------------------------------------------------------------------------------------------
const FUNCTIONS = {
  'public.retire_memory_retrieval_index_v1()': { definer: true, roles: [] },
  'public.post_response_personal_capture_result_valid_v1(jsonb)': { definer: false, roles: [] },
  'public.background_unindexed_memories_v1(uuid,integer)': { definer: true, roles: ['service_role'] },
  'public.complete_post_response_personal_capture_v1(uuid,uuid[],text[],text[],double precision[],timestamp with time zone[],text[],text[],uuid[],text[],text[],uuid[],text[])': { definer: true, roles: ['service_role'] },
  'public.retrieve_personal_memory_candidates_v1(text[],integer)': { definer: false, roles: ['authenticated'] },
};
const API_ROLES = ['anon', 'authenticated', 'service_role'];
const constraintDef = async (table, name) => (await one('SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1::regclass AND conname = $2', [table, name])).def;

async function verifyCatalog() {
  stage = 'C-1 catalog: the two index tables';
  for (const table of ['memory_retrieval_profiles', 'memory_retrieval_terms']) {
    const posture = await one('SELECT c.relrowsecurity AS rls, pg_get_userbyid(c.relowner) AS owner FROM pg_class c WHERE c.oid = $1::regclass', [`public.${table}`]);
    assert.deepEqual(posture, { rls: true, owner: 'postgres' }, `${table}: RLS on, owned by postgres`);
    for (const role of API_ROLES) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        assert.equal((await one('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, `public.${table}`, privilege])).allowed, false, `${role} has no ${privilege} on ${table}`);
      }
      assert.equal((await one('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, `public.${table}`, 'SELECT'])).allowed, role !== 'anon', `${role} SELECT on ${table}`);
    }
    const policies = await rows('SELECT cmd, roles::text AS roles, qual FROM pg_policies WHERE schemaname = $1 AND tablename = $2', ['public', table]);
    assert.equal(policies.length, 1, `${table}: one policy`);
    assert.deepEqual([policies[0].cmd, policies[0].roles], ['SELECT', '{authenticated}']);
    assert.match(policies[0].qual, /user_id = \( SELECT auth\.uid\(\)/u, `${table}: owner-only`);
    const fks = await rows("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'f'", [`public.${table}`]);
    assert.equal(fks.length, 1);
    assert.match(fks[0].def, /^FOREIGN KEY \(memory_id, user_id\) REFERENCES memories\(id, user_id\) ON DELETE CASCADE$/u, `${table}: composite FK, CASCADE`);
  }
  assert.match(await constraintDef('public.memory_retrieval_terms', 'memory_retrieval_terms_term_check'), /char_length\(term\) >= 2.*char_length\(term\) <= 48/u);

  stage = 'C-1 catalog: the retirement trigger';
  const trigger = await one("SELECT pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid = 'public.memories'::regclass AND tgname = 'memories_retire_retrieval_index'");
  assert.match(trigger.def, /AFTER UPDATE OF status ON public\.memories FOR EACH ROW WHEN \(\(\(old\.status = 'ACTIVE'::text\) AND \(new\.status <> 'ACTIVE'::text\)\)\) EXECUTE FUNCTION retire_memory_retrieval_index_v1\(\)/u);

  stage = 'C-1 catalog: every new function - owner, security mode, empty search_path, EXECUTE';
  for (const [signature, expected] of Object.entries(FUNCTIONS)) {
    const fn = await one(`SELECT p.prosecdef AS definer, pg_get_userbyid(p.proowner) AS owner, p.proconfig AS config FROM pg_proc p WHERE p.oid = $1::regprocedure`, [signature]);
    assert.deepEqual([fn.definer, fn.owner, fn.config], [expected.definer, 'postgres', ['search_path=""']], signature);
    for (const role of [...API_ROLES, 'public']) {
      const allowed = role === 'public'
        ? (await one("SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE p.oid = $1::regprocedure AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS allowed", [signature])).allowed
        : (await one('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, signature, 'EXECUTE'])).allowed;
      assert.equal(allowed, expected.roles.includes(role), `${signature}: EXECUTE for ${role}`);
    }
  }

  stage = 'C-1 catalog: the widened CHECKs carry exactly the one new value each';
  assert.match(await constraintDef('public.post_response_intelligence_effects', 'post_response_intelligence_effects_effect_key_check'), /'UNDERSTANDING_CAPTURE_PROVIDER'::text/u);
  assert.equal((await constraintDef('public.post_response_intelligence_effects', 'post_response_intelligence_effects_effect_key_check')).match(/'[A-Z_]+'::text/gu).length, 9);
  assert.match(await constraintDef('public.ai_provider_calls', 'ai_provider_calls_feature_family_check'), /'PERSONAL_UNDERSTANDING_CAPTURE'::text/u);
  assert.equal((await constraintDef('public.ai_provider_calls', 'ai_provider_calls_feature_family_check')).match(/'[A-Z_]+'::text/gu).length, 9);
  assert.match(await constraintDef('public.memory_subject_attributions', 'memory_subject_attributions_basis_check'), /'MODEL_ASSISTED_CAPTURE'::text/u);
  assert.match(await constraintDef('public.memory_subject_attributions', 'memory_subject_attributions_capture_self_check'), /MODEL_ASSISTED_CAPTURE.*OR \(subject = 'SELF'::text\)/u);
}

// ------------------------------------------------------------------------------------------------------------------
// P-1. The typed effect result.
// ------------------------------------------------------------------------------------------------------------------
async function verifyResult() {
  stage = 'P-1 the payload validator: identifiers only, bounded, distinct, never empty';
  const a = randomUUID(); const b = randomUUID();
  const valid = async (value) => (await one('SELECT public.post_response_personal_capture_result_valid_v1($1::jsonb) AS ok', [value === undefined ? null : JSON.stringify(value)])).ok;
  for (const value of [{ memoryIds: [a], indexedMemoryIds: [] }, { memoryIds: [], indexedMemoryIds: [a, b] }, { memoryIds: [a, b, randomUUID()], indexedMemoryIds: [randomUUID(), randomUUID(), randomUUID(), randomUUID()] }]) {
    assert.equal(await valid(value), true, JSON.stringify(value));
  }
  for (const value of [undefined, [], { memoryIds: [], indexedMemoryIds: [] }, { memoryIds: [a] }, { memoryIds: [a], indexedMemoryIds: [], content: 'x' },
    { memoryIds: [a, a], indexedMemoryIds: [] }, { memoryIds: ['not-a-uuid'], indexedMemoryIds: [] }, { memoryIds: [a.toUpperCase()], indexedMemoryIds: [] },
    { memoryIds: [randomUUID(), randomUUID(), randomUUID(), randomUUID()], indexedMemoryIds: [] }, { memoryIds: [], indexedMemoryIds: Array.from({ length: 5 }, randomUUID) },
    { memoryIds: [1], indexedMemoryIds: [] }, { memoryIds: 'x', indexedMemoryIds: [] }]) {
    assert.equal(await valid(value), false, JSON.stringify(value));
  }

  stage = 'P-1 the effect admits exactly CLAIMED, NO_UNDERSTANDING_RECORDED and UNDERSTANDING_RECORDED with a valid payload';
  const me = await reader();
  const s = await session(me);
  const { id } = await captureExecution(me, s);
  const set = (code, payload, state = 'COMPLETED', reference = null) => client.query(`UPDATE public.post_response_intelligence_effects SET state = $2, result_code = $3, result_payload = $4::jsonb,
    result_reference = $5, completed_at = CURRENT_TIMESTAMP WHERE execution_id = $1 AND effect_key = 'UNDERSTANDING_CAPTURE_PROVIDER'`, [id, state, code, payload === null ? null : JSON.stringify(payload), reference]);
  for (const [name, args] of [
    ['a result-less completion (the generic 0024 completion cannot complete it)', [null, null]],
    ['UNDERSTANDING_RECORDED without a payload', ['UNDERSTANDING_RECORDED', null]],
    ['an empty payload', ['UNDERSTANDING_RECORDED', { memoryIds: [], indexedMemoryIds: [] }]],
    ['NO_UNDERSTANDING_RECORDED with a payload', ['NO_UNDERSTANDING_RECORDED', { memoryIds: [a], indexedMemoryIds: [] }]],
    ['a result reference', ['UNDERSTANDING_RECORDED', { memoryIds: [a], indexedMemoryIds: [] }, 'COMPLETED', `memory:${a}`]],
    ['another effect\'s result code', ['AUTHORIZED_COMMANDS', [], 'COMPLETED']],
    ['a result on a CLAIMED row', ['NO_UNDERSTANDING_RECORDED', null, 'CLAIMED']],
  ]) {
    stage = `P-1 the effect refuses ${name}`;
    await rejected(() => set(...args), ['23514']);
  }
  stage = 'P-1 the effect admits both typed results';
  await set('UNDERSTANDING_RECORDED', { memoryIds: [a], indexedMemoryIds: [] });
  await set('NO_UNDERSTANDING_RECORDED', null);
}

// ------------------------------------------------------------------------------------------------------------------
// A. The capture command.
// ------------------------------------------------------------------------------------------------------------------
async function verifyCapture() {
  const me = await reader();
  const s = await session(me);

  stage = 'A-1 two verified facts and one backfill row commit together, as the user said them, SELF / MODEL_ASSISTED_CAPTURE, 0.80';
  const older = await memory(me, { content: 'بحب القهوة الصبح.', type: 'STABLE_PREFERENCE' });
  const execution = await captureExecution(me, s, { content: 'أنا ساكن في المعادي وبشتغل مهندس' });
  const home = randomUUID(); const work = randomUUID();
  assert.equal(await capture(execution.id, {
    items: [
      { id: home, content: 'أنا ساكن في المعادي.', slot: 'RESIDENCE', terms: ['ساكن', 'معاد', 'سكن', 'home'] },
      { id: work, content: 'وبشتغل مهندس.', slot: 'OCCUPATION', terms: ['بشتغل', 'مهندس', 'شغل', 'job'] },
    ],
    index: [{ id: older, terms: ['قهوه', 'coffee'] }],
  }), 'COMPLETED');
  for (const [id, content] of [[home, 'أنا ساكن في المعادي.'], [work, 'وبشتغل مهندس.']]) {
    const row = await one('SELECT user_id, type, content, source, confidence, status, expires_at FROM public.memories WHERE id = $1', [id]);
    assert.deepEqual(row, { user_id: me, type: 'PERSONAL_FACT', content, source: 'USER_STATED', confidence: 0.8, status: 'ACTIVE', expires_at: null });
    assert.deepEqual(await one('SELECT subject, basis, command_id, execution_id FROM public.memory_subject_attributions WHERE memory_id = $1', [id]),
      { subject: 'SELF', basis: 'MODEL_ASSISTED_CAPTURE', command_id: null, execution_id: execution.id });
  }
  assert.deepEqual(await profileOf(home), { semantic_indexed: true, slot: 'RESIDENCE', temporal: 'CURRENT' });
  assert.deepEqual(await profileOf(older), { semantic_indexed: true, slot: null, temporal: 'CURRENT' });
  assert.deepEqual(await termsOf(home), ['home', 'ساكن', 'سكن', 'معاد'].sort());
  assert.deepEqual(await termsOf(older), ['coffee', 'قهوه'].sort());
  const effect = await effectOf(execution.id);
  assert.deepEqual([effect.state, effect.result_code, effect.result_reference], ['COMPLETED', 'UNDERSTANDING_RECORDED', null]);
  assert.deepEqual(effect.result_payload, { memoryIds: [home, work], indexedMemoryIds: [older] }, 'identifiers only - no word of content in the ledger');
  assert.doesNotMatch(JSON.stringify(effect), /ساكن|مهندس|قهوه/u);

  stage = 'A-2 a replay is NO_OP and writes nothing; an execution not RUNNING or without the claim writes nothing';
  const before = await count('SELECT count(*) AS n FROM public.memories WHERE user_id = $1', [me]);
  assert.equal(await capture(execution.id, { items: [{ id: randomUUID(), content: 'أنا ساكن في المعادي.' }] }), 'NO_OP');
  const unclaimed = await captureExecution(me, s, { claim: false });
  assert.equal(await capture(unclaimed.id, { items: [{ id: randomUUID(), content: 'أنا عندي قطة.' }] }), 'NO_OP');
  const finished = await captureExecution(me, s, { state: 'COMPLETED' });
  assert.equal(await capture(finished.id, { items: [{ id: randomUUID(), content: 'أنا عندي قطة.' }] }), 'NO_OP');
  assert.equal(await capture(randomUUID(), { items: [{ id: randomUUID(), content: 'أنا عندي قطة.' }] }), 'NO_OP');
  assert.equal(await count('SELECT count(*) AS n FROM public.memories WHERE user_id = $1', [me]), before);

  stage = 'A-2 the same words from a later execution are an equivalent: no second Memory, no contradiction';
  const again = await captureExecution(me, s);
  assert.equal(await capture(again.id, { items: [{ id: randomUUID(), content: 'أنا  ساكن في المعادي', type: 'PERSONAL_FACT' }, { id: randomUUID(), content: 'أنا ساكن في المعادي.', type: 'RELATIONSHIP_CONTEXT' }] }), 'COMPLETED');
  assert.deepEqual(await effectOf(again.id), { state: 'COMPLETED', result_code: 'NO_UNDERSTANDING_RECORDED', result_reference: null, result_payload: null });
  assert.equal(await count("SELECT count(*) AS n FROM public.memories WHERE user_id = $1 AND content LIKE '%ساكن في المعادي%'", [me]), 1);

  stage = 'A-2 a failure after the first write rolls the whole command back and leaves the effect CLAIMED';
  const failing = await captureExecution(me, s);
  // Two items within the batch-wide bound (65 terms <= 64 x 2), so both Memories, their attributions and profiles are
  // written before the per-Memory bound fails on the first: the whole command must roll back.
  const doomed = randomUUID(); const sibling = randomUUID();
  await rejected(() => capture(failing.id, {
    items: [{ id: doomed, content: 'أنا عندي عربية.', terms: Array.from({ length: 65 }, (_, n) => `ك${n}x`) }, { id: sibling, content: 'أنا عندي موتوسيكل.' }],
  }), ['22023'], /INVALID_UNDERSTANDING_CAPTURE/u);
  assert.equal(await count('SELECT count(*) AS n FROM public.memories WHERE id = ANY ($1::uuid[])', [[doomed, sibling]]), 0);
  assert.equal(await count('SELECT count(*) AS n FROM public.memory_retrieval_profiles WHERE memory_id = ANY ($1::uuid[])', [[doomed, sibling]]), 0);
  assert.equal((await effectOf(failing.id)).state, 'CLAIMED');

  stage = 'A-2 an invalid batch is refused before anything is written';
  const id = () => randomUUID();
  const later = new Date(Date.now() + 20 * 86_400_000).toISOString();
  const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
  for (const [name, command] of [
    ['four facts', { items: Array.from({ length: 4 }, (_, n) => ({ id: id(), content: `أنا عندي ${n} قطط.` })) }],
    ['five index rows', { index: Array.from({ length: 5 }, () => ({ id: id() })) }],
    ['a repeated identifier', (() => { const x = id(); return { items: [{ id: x, content: 'أنا عندي قطة.' }], index: [{ id: x }] }; })()],
    ['an Interaction Preference', { items: [{ id: id(), type: 'INTERACTION_PREFERENCE', content: 'كلمني بالعربي.' }] }],
    ['a Derived Insight', { items: [{ id: id(), type: 'DERIVED_INSIGHT', content: 'أنا عندي قطة.' }] }],
    ['an unknown slot', { items: [{ id: id(), content: 'أنا عندي قطة.', slot: 'CITY' }] }],
    ['an unknown temporal', { items: [{ id: id(), content: 'أنا عندي قطة.', temporal: 'FOREVER' }] }],
    ['a temporary state without expiry', { items: [{ id: id(), type: 'TEMPORARY_STATE', temporal: 'TEMPORARY', content: 'عندي امتحان بكرة.' }] }],
    ['an expiry on a lasting fact', { items: [{ id: id(), content: 'أنا عندي قطة.', expiresAt: soon }] }],
    ['an expiry beyond fifteen days', { items: [{ id: id(), type: 'TEMPORARY_STATE', temporal: 'TEMPORARY', content: 'عندي امتحانات.', expiresAt: later }] }],
    ['content beyond 280 characters', { items: [{ id: id(), content: `أنا ${'ا'.repeat(280)}` }] }],
    ['a term with white space', { items: [{ id: id(), content: 'أنا عندي قطة.', terms: ['قطه بيضا'] }] }],
    ['a one-letter term', { items: [{ id: id(), content: 'أنا عندي قطة.', terms: ['ق'] }] }],
  ]) {
    stage = `A-2 an invalid batch is refused before anything is written: ${name}`;
    const target = await captureExecution(me, s);
    await rejected(() => capture(target.id, command), ['22023', '23514']);
    assert.equal((await effectOf(target.id)).state, 'CLAIMED');
  }
  stage = 'A-2 a temporary state with a bounded expiry is kept';
  const exam = randomUUID();
  const temporary = await captureExecution(me, s);
  assert.equal(await capture(temporary.id, { items: [{ id: exam, type: 'TEMPORARY_STATE', temporal: 'TEMPORARY', content: 'عندي امتحان بكرة.', importance: 0.5, expiresAt: soon, terms: ['امتحان'] }] }), 'COMPLETED');
  assert.deepEqual(await profileOf(exam), { semantic_indexed: true, slot: null, temporal: 'TEMPORARY' });
}

async function verifyCaptureRules() {
  const me = await reader();
  const s = await session(me);

  stage = 'A-3 a Memory-command turn captures nothing, while its backfill still indexes';
  const pending = await memory(me, { content: 'بحب الشاي بالنعناع.', type: 'STABLE_PREFERENCE' });
  const commandTurn = await userTurn(me, s, { content: 'افتكر إني بحب الكشري' });
  assert.deepEqual(await finalize2({ session: s, user: me, turn: commandTurn, kind: 'REMEMBER', outcome: 'REMEMBERED', type: 'STABLE_PREFERENCE', content: 'أنا بحب الكشري.', subject: 'SELF' }), ['REMEMBERED']);
  const onCommand = await captureExecution(me, s, { turn: commandTurn });
  const skipped = randomUUID();
  assert.equal(await capture(onCommand.id, { items: [{ id: skipped, content: 'أنا بحب الكشري جدا.' }], index: [{ id: pending, terms: ['شاي'] }] }), 'COMPLETED');
  assert.equal(await count('SELECT count(*) AS n FROM public.memories WHERE id = $1', [skipped]), 0);
  assert.deepEqual((await effectOf(onCommand.id)).result_payload, { memoryIds: [], indexedMemoryIds: [pending] });

  stage = 'A-3 a fact a later FORGET withdrew is never re-created by an earlier turn\'s capture';
  const early = await captureExecution(me, s, { content: 'أنا بشتغل في البنك' });
  const bank = await memory(me, { content: 'أنا بشتغل في البنك.' });
  const forgetTurn = await userTurn(me, s, { content: 'انسى إني بشتغل في البنك' });
  assert.deepEqual(await finalize2({ session: s, user: me, turn: forgetTurn, kind: 'FORGET', outcome: 'FORGOTTEN', target: bank }), ['FORGOTTEN']);
  const revived = randomUUID();
  assert.equal(await capture(early.id, { items: [{ id: revived, content: 'أنا بشتغل في البنك.' }] }), 'COMPLETED');
  assert.equal(await count('SELECT count(*) AS n FROM public.memories WHERE id = $1', [revived]), 0, 'SUPERSEDED_BY_LATER_COMMAND');

  stage = 'A-3 an equivalent ACTIVE SELF or UNATTRIBUTED Memory of any type is never re-stated; the same words about someone else are another fact';
  await memory(me, { content: 'عندي عربية حمرا.', type: 'STABLE_PREFERENCE', subject: null });
  const sister = await memory(me, { content: 'ساكنة في طنطا.', subject: 'OTHER' });
  void sister;
  const rules = await captureExecution(me, s);
  const car = randomUUID(); const tanta = randomUUID();
  assert.equal(await capture(rules.id, { items: [{ id: car, content: 'عندي عربية حمرا.' }, { id: tanta, content: 'ساكنة في طنطا.' }] }), 'COMPLETED');
  assert.equal(await count('SELECT count(*) AS n FROM public.memories WHERE id = $1', [car]), 0);
  assert.equal(await count('SELECT count(*) AS n FROM public.memories WHERE id = $1', [tanta]), 1, 'the OTHER Memory does not block the user\'s own fact');

  stage = 'A-3 the background never changes an existing Memory';
  const census = await rows("SELECT id, status, version, content FROM public.memories WHERE user_id = $1 AND id <> ALL ($2::uuid[]) ORDER BY id", [me, [tanta]]);
  const another = await captureExecution(me, s);
  await capture(another.id, { items: [{ id: randomUUID(), content: 'أنا بحب الكشري.' }] });
  assert.deepEqual(await rows("SELECT id, status, version, content FROM public.memories WHERE user_id = $1 AND id <> ALL ($2::uuid[]) ORDER BY id", [me, [tanta]]), census);
}

// ------------------------------------------------------------------------------------------------------------------
// B-1. The backfill read and index rows.
// ------------------------------------------------------------------------------------------------------------------
async function verifyBackfill() {
  const me = await reader();
  const other = await reader();
  const s = await session(me);

  stage = 'B-1 the backfill read is execution-scoped: no RUNNING execution for the turn, no read';
  const idle = await userTurn(me, s, { status: 'COMPLETED' });
  await rejected(() => backfill(idle), ['42501'], /UNDERSTANDING_EXECUTION_NOT_ASSOCIATED/u);
  await rejected(() => backfill(randomUUID()), ['42501']);
  await rejected(() => asServer(() => rows('SELECT * FROM public.background_unindexed_memories_v1($1, $2)', [idle, -1])), ['22023']);

  stage = 'B-1 the owner\'s eligible, unindexed Memories only, newest first, at most four';
  const eligible = [];
  for (let n = 0; n < 6; n += 1) eligible.push(await memory(me, { content: `ملاحظة ${n}.` }));
  await memory(me, { content: 'كلمني بالعربي.', type: 'INTERACTION_PREFERENCE' });
  await memory(me, { content: 'اتنسيت.', status: 'DELETED' });
  await expiredMemory(me, 'عندي امتحان امبارح.');
  await memory(other, { content: 'مش بتاعي.' });
  const execution = await captureExecution(me, s);
  assert.deepEqual((await backfill(execution.turn)).map((r) => r.memory_id), eligible.slice(2).reverse());
  assert.deepEqual((await backfill(execution.turn, 2)).map((r) => r.memory_id), eligible.slice(4).reverse());
  assert.equal((await backfill(execution.turn, 40)).length, 4);

  stage = 'B-1 the index command skips anything ineligible, never re-indexes, and an indexed Memory leaves the backlog';
  const foreign = await memory(other, { content: 'سر غيري.' });
  const preference = await memory(me, { content: 'رد عليا باختصار.', type: 'INTERACTION_PREFERENCE' });
  const forgotten = await memory(me, { content: 'اتمسحت.', status: 'DELETED' });
  assert.equal(await capture(execution.id, { index: [
    { id: eligible[5], slot: 'STUDY', terms: ['دراسه'] }, { id: foreign, terms: ['سر'] }, { id: preference, terms: ['اختصار'] },
    { id: forgotten, terms: ['مسح'] },
  ] }), 'COMPLETED');
  assert.deepEqual((await effectOf(execution.id)).result_payload, { memoryIds: [], indexedMemoryIds: [eligible[5]] });
  for (const skipped of [foreign, preference, forgotten]) {
    assert.equal(await count('SELECT count(*) AS n FROM public.memory_retrieval_terms WHERE memory_id = $1', [skipped]), 0);
    assert.equal(await profileOf(skipped), undefined);
  }
  const next = await captureExecution(me, s);
  assert.ok(!(await backfill(next.turn)).some((r) => r.memory_id === eligible[5]), 'an indexed Memory leaves the backlog');
  assert.equal(await capture(next.id, { index: [{ id: eligible[5], slot: 'RESIDENCE', terms: ['تاني'] }] }), 'COMPLETED');
  assert.deepEqual(await effectOf(next.id), { state: 'COMPLETED', result_code: 'NO_UNDERSTANDING_RECORDED', result_reference: null, result_payload: null }, 'never re-indexed');
  assert.deepEqual([(await profileOf(eligible[5])).slot, await termsOf(eligible[5])], ['STUDY', ['دراسه']]);

  stage = 'B-1 (CP2 R3) a Memory settled with NO term leaves the backlog, so older eligible Memories move into the window';
  const window = (await backfill(next.turn)).map((r) => r.memory_id);
  assert.deepEqual(window, [eligible[4], eligible[3], eligible[2], eligible[1]]);
  assert.equal(await capture(next.id, { index: window.map((id) => ({ id, terms: [] })) }), 'NO_OP', 'the completed effect writes nothing');
  const settle = await captureExecution(me, s);
  assert.equal(await capture(settle.id, { index: window.map((id) => ({ id, terms: [] })) }), 'COMPLETED');
  for (const id of window) assert.deepEqual([(await profileOf(id)).semantic_indexed, await termsOf(id)], [true, []]);
  const after = await captureExecution(me, s);
  assert.deepEqual((await backfill(after.turn)).map((r) => r.memory_id), [eligible[0]], 'the oldest eligible Memory is reached');
}

// ------------------------------------------------------------------------------------------------------------------
// Q. Retrieval.
// ------------------------------------------------------------------------------------------------------------------
async function verifyRetrieval() {
  const me = await reader();
  const s = await session(me);

  stage = 'Q-1 an indexed Memory older than the 32 most recent is served by a term it is indexed under (no «فاكر» needed)';
  const work = await memory(me, { content: 'أنا شغال في فودافون.' });
  for (let n = 0; n < 40; n += 1) await memory(me, { content: `حاجة عادية رقم ${n}.` });
  const recent = (await rows("SELECT id FROM public.memories WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY updated_at DESC, id DESC LIMIT 32", [me])).map((r) => r.id);
  assert.ok(!recent.includes(work), 'the fixture sits outside the 32-Memory recall window');
  await index(me, s, work, ['شغال', 'فودافون', 'شغل', 'وظيفه', 'job', 'employer'], { slot: 'EMPLOYER' });
  const served = await retrieve(me, ['بشتغل', 'وظيفه', 'فين']);
  assert.deepEqual(served.map((r) => [r.id, r.hits, r.slot, r.unsettled, r.subject, r.status]), [[work, 1, 'EMPLOYER', false, 'SELF', 'ACTIVE']]);
  assert.deepEqual(Object.keys(served[0]).sort(), ['confidence', 'content', 'created_at', 'expires_at', 'hits', 'id', 'importance', 'scope', 'slot', 'source',
    'status', 'subject', 'supersedes_memory_id', 'type', 'unsettled', 'updated_at', 'user_id', 'version'].sort());
  assert.deepEqual(await retrieve(me, ['حاجه_مش_موجوده']), []);
  assert.deepEqual(await retrieve(me, []), []);
  assert.equal((await retrieve(me, ['job'], 0)).length, 0, 'the caller\'s limit bounds the read');

  stage = 'Q-2 a correction removes the old version from the index and from every read; the new version is backfilled';
  const correctTurn = await userTurn(me, s, { content: 'لا أنا شغال في أورنج' });
  const corrected = randomUUID();
  assert.deepEqual(await finalize2({ session: s, user: me, turn: correctTurn, kind: 'CORRECT', outcome: 'CORRECTED', target: work, newId: corrected, content: 'أنا شغال في أورنج.', subject: 'SELF' }), ['CORRECTED']);
  assert.deepEqual([await termsOf(work), await profileOf(work)], [[], undefined], 'the old version takes its index with it');
  assert.deepEqual(await retrieve(me, ['فودافون', 'وظيفه']), []);
  const onCorrection = await captureExecution(me, s, { turn: correctTurn });
  assert.equal((await backfill(onCorrection.turn, 1))[0].memory_id, corrected, 'the corrected Memory is the newest unindexed one');
  assert.equal(await capture(onCorrection.id, { index: [{ id: corrected, slot: 'EMPLOYER', terms: ['شغال', 'اورنج', 'وظيفه'] }] }), 'COMPLETED');
  assert.deepEqual((await retrieve(me, ['وظيفه'])).map((r) => r.id), [corrected]);

  stage = 'Q-3 a forget removes the Memory from the index and from every read';
  const forgetTurn = await userTurn(me, s, { content: 'انسى شغلي' });
  assert.deepEqual(await finalize2({ session: s, user: me, turn: forgetTurn, kind: 'FORGET', outcome: 'FORGOTTEN', target: corrected }), ['FORGOTTEN']);
  assert.deepEqual([await termsOf(corrected), await profileOf(corrected)], [[], undefined]);
  assert.deepEqual(await retrieve(me, ['وظيفه', 'اورنج']), []);
  const afterForget = await captureExecution(me, s);
  assert.ok(!(await backfill(afterForget.turn)).some((r) => r.memory_id === corrected));

  stage = 'Q-3 eligibility is decided at read time: an expired Memory is never served though its terms remain';
  const exam = await memory(me, { content: 'عندي امتحان بكرة.', type: 'TEMPORARY_STATE', expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
  await index(me, s, exam, ['امتحان'], { temporal: 'TEMPORARY' });
  assert.deepEqual((await retrieve(me, ['امتحان'])).map((r) => r.id), [exam]);
  const lapsed = await expiredMemory(me, 'عندي امتحان امبارح.');
  // The index command never indexes an expired Memory, so its rows are seeded as the table owner: the read must still
  // refuse it, because eligibility comes from public.memories, never from the index.
  await client.query("INSERT INTO public.memory_retrieval_profiles (memory_id, user_id, semantic_indexed, temporal) VALUES ($1, $2, true, 'TEMPORARY')", [lapsed, me]);
  await client.query("INSERT INTO public.memory_retrieval_terms (memory_id, user_id, term) VALUES ($1, $2, 'امتحان')", [lapsed, me]);
  assert.deepEqual((await retrieve(me, ['امتحان'])).map((r) => r.id), [exam]);
  const lapsedExecution = await captureExecution(me, s);
  assert.ok(!(await backfill(lapsedExecution.turn, 4)).some((r) => r.memory_id === lapsed));

  stage = 'Q-3 the explicit cleanup: the owner\'s next capture removes the index of every expired Memory, and only that';
  assert.equal(await capture(lapsedExecution.id, {}), 'COMPLETED');
  assert.deepEqual([await termsOf(lapsed), await profileOf(lapsed)], [[], undefined]);
  assert.deepEqual(await termsOf(exam), ['امتحان'], 'an unexpired temporary state keeps its index');

  stage = 'Q-3 a DISABLED Memory is never served either';
  const tea = await memory(me, { content: 'بحب الشاي.', type: 'STABLE_PREFERENCE' });
  await index(me, s, tea, ['شاي']);
  await client.query("UPDATE public.memories SET status = 'DISABLED' WHERE id = $1", [tea]);
  assert.deepEqual([await termsOf(tea), await retrieve(me, ['شاي'])], [[], []]);
}

async function verifyIsolation() {
  const alice = await reader();
  const bob = await reader();
  const sa = await session(alice);
  const sb = await session(bob);

  stage = 'Q-4 two owners indexed under the same term: each reads only their own';
  const mine = await memory(alice, { content: 'أنا ساكنة في الزمالك.' });
  const theirs = await memory(bob, { content: 'أنا ساكن في الزمالك.' });
  await index(alice, sa, mine, ['زمالك', 'سكن'], { slot: 'RESIDENCE' });
  await index(bob, sb, theirs, ['زمالك', 'سكن'], { slot: 'RESIDENCE' });
  assert.deepEqual((await retrieve(alice, ['زمالك'])).map((r) => [r.id, r.user_id]), [[mine, alice]]);
  assert.deepEqual((await retrieve(bob, ['زمالك'])).map((r) => [r.id, r.user_id]), [[theirs, bob]]);

  stage = 'Q-4 RLS: the owner sees only their own index rows; anon sees nothing';
  await actAs('authenticated', alice);
  assert.deepEqual((await rows('SELECT DISTINCT user_id FROM public.memory_retrieval_terms')).map((r) => r.user_id), [alice]);
  assert.deepEqual((await rows('SELECT DISTINCT user_id FROM public.memory_retrieval_profiles')).map((r) => r.user_id), [alice]);
  await asOwner();
  await actAs('anon');
  await rejected(() => rows('SELECT * FROM public.memory_retrieval_terms'), ['42501']);
  await rejected(() => rows('SELECT * FROM public.retrieve_personal_memory_candidates_v1($1::text[], 12)', [['زمالك']]), ['42501']);
  await asOwner();

  stage = 'Q-4 no other role reaches the functions, and the owner cannot write the index';
  await actAs('service_role');
  await rejected(() => rows('SELECT * FROM public.retrieve_personal_memory_candidates_v1($1::text[], 12)', [['زمالك']]), ['42501']);
  await asOwner();
  await actAs('authenticated', alice);
  await rejected(() => rows('SELECT * FROM public.background_unindexed_memories_v1($1, 4)', [randomUUID()]), ['42501']);
  await rejected(() => rows(CAPTURE, captureArgs(randomUUID(), {})), ['42501']);
  await rejected(() => client.query("INSERT INTO public.memory_retrieval_terms (memory_id, user_id, term) VALUES ($1, $2, 'xx')", [mine, alice]), ['42501']);
  await rejected(() => client.query('DELETE FROM public.memory_retrieval_terms'), ['42501']);
  await rejected(() => client.query('UPDATE public.memory_retrieval_profiles SET slot = NULL'), ['42501']);
  await asOwner();

  stage = 'Q-4 an execution indexes only its own owner\'s Memories';
  const cross = await captureExecution(alice, sa);
  const bobsOther = await memory(bob, { content: 'بحب الفول.' });
  assert.equal(await capture(cross.id, { index: [{ id: bobsOther, terms: ['فول'] }] }), 'COMPLETED');
  assert.deepEqual(await termsOf(bobsOther), []);
  assert.ok(!(await backfill(cross.turn)).some((r) => r.memory_id === bobsOther));

  stage = 'Q-4 the index can never name a Memory of another owner (composite FK)';
  await rejected(() => client.query("INSERT INTO public.memory_retrieval_terms (memory_id, user_id, term) VALUES ($1, $2, 'xx')", [theirs, alice]), ['23503']);
}

async function verifyUnsettled() {
  const me = await reader();
  const s = await session(me);

  stage = 'Q-5 two CURRENT SELF facts in one slot are both served and flagged UNSETTLED; the unmatched one follows';
  const maadi = await memory(me, { content: 'أنا ساكن في المعادي.' });
  const nasr = await memory(me, { content: 'أنا عايش في مدينة نصر.' });
  const tanta = await memory(me, { content: 'كنت ساكن في طنطا.' });
  const plan = await memory(me, { content: 'هنقل إسكندرية.', type: 'GOAL' });
  const sister = await memory(me, { content: 'ساكنة في أسوان.', subject: 'OTHER' });
  const free = await memory(me, { content: 'بحب البحر.', type: 'STABLE_PREFERENCE' });
  await index(me, s, maadi, ['ساكن', 'معاد', 'سكن'], { slot: 'RESIDENCE' });
  await index(me, s, nasr, ['عايش', 'نصر'], { slot: 'RESIDENCE' });
  await index(me, s, tanta, ['ساكن', 'طنطا', 'سكن'], { slot: 'RESIDENCE', temporal: 'PAST' });
  await index(me, s, plan, ['اسكندريه', 'سكن'], { temporal: 'PLANNED' });
  await index(me, s, sister, ['ساكنه', 'اسوان', 'سكن'], { slot: 'RESIDENCE' });
  await index(me, s, free, ['بحر', 'سكن']);
  const served = await retrieve(me, ['معاد']);
  assert.deepEqual(served.map((r) => [r.id, r.hits, r.unsettled]), [[maadi, 1, true], [nasr, 0, true]]);

  stage = 'Q-5 a PAST fact, a plan, someone else\'s fact and a slot-less Memory are retrieved normally and are never UNSETTLED';
  const broad = Object.fromEntries((await retrieve(me, ['سكن'])).map((r) => [r.id, r.unsettled]));
  assert.deepEqual(broad, { [maadi]: true, [tanta]: false, [plan]: false, [sister]: false, [free]: false, [nasr]: true });

  stage = 'Q-5 once one side is corrected away, nothing is UNSETTLED any more';
  const correctTurn = await userTurn(me, s, { content: 'لا أنا مش ساكن في المعادي' });
  assert.deepEqual(await finalize2({ session: s, user: me, turn: correctTurn, kind: 'CORRECT', outcome: 'CORRECTED', target: maadi, content: 'أنا عزلت.', subject: 'SELF' }), ['CORRECTED']);
  assert.deepEqual((await retrieve(me, ['نصر'])).map((r) => [r.id, r.unsettled]), [[nasr, false]]);

  stage = 'Q-5 (CP2 R1) two employers held at once are served together as UNSETTLED; the read claims no conflict at all';
  const bank = await memory(me, { content: 'أنا بشتغل في بنك مصر الصبح.' });
  const clinic = await memory(me, { content: 'وبشتغل كمان في عيادة بالليل.' });
  await index(me, s, bank, ['بنك', 'شغل'], { slot: 'EMPLOYER' });
  await index(me, s, clinic, ['عياده', 'شغل'], { slot: 'EMPLOYER' });
  const jobs = await retrieve(me, ['بنك']);
  assert.deepEqual(jobs.map((r) => [r.id, r.unsettled]), [[bank, true], [clinic, true]]);
  assert.ok(jobs.every((r) => !('conflicting' in r)), 'no row of the read asserts a conflict');
  const signature = await one("SELECT pg_get_function_result('public.retrieve_personal_memory_candidates_v1(text[],integer)'::regprocedure) AS r");
  assert.match(signature.r, /unsettled boolean/u);
  assert.doesNotMatch(signature.r, /conflict/iu);
}

async function verifyErasure() {
  stage = 'E-1 the governed Personal erasure removes the index with its Memories (CASCADE), and is not BLOCKED';
  const alice = await reader();
  const bob = await reader();
  for (const userId of [alice, bob]) {
    const s = await session(userId);
    const fact = await memory(userId, { content: 'أنا عندي كلب.' });
    await index(userId, s, fact, ['كلب', 'dog']);
  }
  const footprint = async (userId) => [await count('SELECT count(*) AS n FROM public.memory_retrieval_terms WHERE user_id = $1', [userId]),
    await count('SELECT count(*) AS n FROM public.memory_retrieval_profiles WHERE user_id = $1', [userId])];
  assert.deepEqual([await footprint(alice), await footprint(bob)], [[2, 1], [2, 1]], 'the fixture populates both tables');
  await actAs('authenticated', alice, { amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - 1 }] });
  assert.equal((await one('SELECT * FROM public.request_own_account_deletion_v1($1)', [randomUUID()])).outcome, 'ACCEPTED');
  await asOwner();
  await client.query(`UPDATE personal_data_private.account_deletions SET requested_at = clock_timestamp() - interval '8 days', final_at = clock_timestamp() - interval '1 day'
    WHERE user_id = $1 AND status = 'SCHEDULED'`, [alice]);
  const { id: deletionId } = await one("SELECT id FROM personal_data_private.account_deletions WHERE user_id = $1 AND status <> 'CANCELLED'", [alice]);
  await asServer(() => rows('SELECT * FROM public.server_claim_due_account_deletions_v1(20)'));
  assert.equal((await asServer(() => one('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId]))).outcome, 'ERASED');
  assert.deepEqual([await footprint(alice), await footprint(bob)], [[0, 0], [2, 1]], 'zero index rows of the account remain; another reader is untouched');
}

async function main() {
  try {
    await client.connect();
    for (const step of [verifyCatalog, verifyResult, verifyCapture, verifyCaptureRules, verifyBackfill, verifyRetrieval, verifyIsolation, verifyUnsettled, verifyErasure]) {
      await client.query('BEGIN');
      try { await step(); } finally { await client.query('ROLLBACK'); }
    }
    console.log('Verified migration 0171 Personal Understanding: owner-only, read-only index tables that leave with their Memory, an identifiers-only typed capture effect, one atomic capture command that keeps the user\'s own words as SELF / MODEL_ASSISTED_CAPTURE at 0.80 under every 0152 rule (command turns, later commands, equivalents of any type) with no replay, no partial write and no change to an existing Memory, a bounded execution-scoped backfill, and an RLS-bound semantic read with read-time eligibility that serves Memories outside the recent window, never a forgotten, corrected, disabled or expired one, never another owner\'s, and every current fact of a shared slot together as UNSETTLED, never as a confirmed conflict.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Migration 0171 verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
