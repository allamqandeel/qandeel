// W3-MEGA-M — Conversational Memory Control & Trust: the real-PostgreSQL verifier for migration 0128 (E2E-D-13).
//
// It proves, against a fully migrated database:
//   1. the catalog: the command table's columns (ids and a bounded outcome only — no content), its owner-scoped keys,
//      the one-record-per-turn and one-answer-per-clarification keys, the immutability trigger, RLS with an owner-only
//      SELECT policy and no client or server-role write; the three functions' DEFINER / INVOKER posture, empty
//      search_path and EXECUTE grants (the two commands: service_role only; the clarification read: authenticated only);
//      and that no role regained direct write on public.memories;
//   2. the DISABLED primitive: ACTIVE → DISABLED moves only status and updated_at; a repeat answers the same row
//      unchanged; another reader's, a missing, a deleted, a superseded and an expired row answer nothing and are left
//      untouched; client roles cannot execute it; a DISABLED row is out of the ACTIVE set retrieval reads;
//   3. the atomic command, inside ONE rolled-back transaction: each outcome's Memory effect, command record and
//      canonical finalization (assistant turn, completed user turn, outbox event) together; a replay of the same turn
//      writes nothing; a target that no longer qualifies commits TARGET_CHANGED with the "changed" reply and no
//      change; FORGOTTEN is lifecycle deletion, never a physical DELETE; clarification candidates and targets must be
//      the caller's own; an answer binds only to the clarification of the immediately preceding user turn and to one of
//      its options, once; malformed requests fail closed writing nothing; the owner-token clarification read sees only
//      the reader's own, immediately preceding clarification;
//   4. concurrency on committed state, across two connections whose second attempt is shown to block: two turns
//      correcting the same Memory → exactly one CORRECTED, one TARGET_CHANGED, one successor; the same turn twice →
//      one Memory, one record, the second answers nothing. Its fixtures are removed and the removal is checked.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = [], on = client) => (await on.query(text, values)).rows;

/** Expect `operation` to be refused with one of `codes`. Must run inside an open transaction. */
async function rejected(operation, codes) {
  let refusal;
  await client.query('SAVEPOINT expected_refusal');
  try {
    await operation();
  } catch (error) {
    refusal = error;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await client.query('RELEASE SAVEPOINT expected_refusal');
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

// Explicit, strictly increasing instants: every fixture row of one transaction would otherwise share CURRENT_TIMESTAMP,
// and "the immediately preceding user turn" is an order.
let tick = 0;
const nextInstant = () => new Date(Date.UTC(2026, 8, 30, 9, 0, tick++)).toISOString();

async function reader(on = client) {
  const id = randomUUID();
  await on.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  return id;
}
async function session(userId, on = client) {
  const id = randomUUID();
  await on.query("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, userId]);
  return id;
}
async function turn(userId, sessionId, status = 'GENERATING', content = 'a Memory request', on = client) {
  const id = randomUUID();
  const at = nextInstant();
  await on.query(
    `INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, created_at, updated_at)
     VALUES ($1, $2, $3, 'USER', $4, $5, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', $6, $6)`,
    [id, sessionId, userId, status, content, at],
  );
  return id;
}
async function memory(userId, content, { status = 'ACTIVE', createdAt = null, expiresAt = null } = {}, on = client) {
  const id = randomUUID();
  await on.query(
    `INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status, created_at, updated_at, expires_at)
     VALUES ($1, $2, 'PERSONAL_FACT', $3, 'USER_STATED', 0.95, 0.65, $4, coalesce($5::timestamptz, CURRENT_TIMESTAMP), coalesce($5::timestamptz, CURRENT_TIMESTAMP), $6)`,
    [id, userId, content, status, createdAt, expiresAt],
  );
  return id;
}
const memoryRow = async (id, on = client) => (await rows('SELECT * FROM public.memories WHERE id = $1', [id], on))[0];
const commandsOf = async (userId, on = client) => rows('SELECT * FROM public.memory_control_commands WHERE user_id = $1 ORDER BY created_at, id', [userId], on);
const turnRow = async (id, on = client) => (await rows('SELECT * FROM public.conversation_turns WHERE id = $1', [id], on))[0];
const replyTo = async (sourceTurnId, on = client) => (await rows("SELECT * FROM public.conversation_turns WHERE source_turn_id = $1 AND role = 'ASSISTANT'", [sourceTurnId], on))[0];
const count = async (text, values, on = client) => Number((await rows(text, values, on))[0].n);

const COMMAND = 'SELECT * FROM public.server_finalize_memory_control_turn_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)';
function commandArgs(c) {
  return [
    c.session, c.user, c.turn, c.assistant ?? randomUUID(), c.kind, c.outcome,
    c.target ?? null, c.newId ?? null, c.type ?? (c.newId ? 'PERSONAL_FACT' : null), c.content ?? null,
    c.confidence ?? (c.newId ? 0.98 : null), c.importance ?? (c.newId ? 0.65 : null), c.expiresAt ?? null,
    c.candidates ?? [], c.answers ?? null, c.reply ?? 'the reply', c.replyIfChanged ?? null, randomUUID(), null, null,
  ];
}
async function command(c, on = client) {
  await actAs('service_role', null, on);
  try {
    return await rows(COMMAND, commandArgs(c), on);
  } finally {
    await asOwner(on);
  }
}
async function disable(userId, memoryId, on = client) {
  await actAs('service_role', null, on);
  try {
    return await rows('SELECT * FROM public.server_disable_memory_v1($1, $2)', [userId, memoryId], on);
  } finally {
    await asOwner(on);
  }
}

// ------------------------------------------------------------------------------------------------------
// 1. Catalog.
// ------------------------------------------------------------------------------------------------------

async function verifyCatalog() {
  stage = 'catalog: the command table holds ids and a bounded outcome only';
  const columns = await rows(`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memory_control_commands' ORDER BY ordinal_position`);
  assert.deepEqual(columns.map((c) => c.column_name), [
    'id', 'user_id', 'session_id', 'source_turn_id', 'kind', 'outcome', 'target_memory_id', 'result_memory_id',
    'candidate_memory_ids', 'answers_command_id', 'created_at',
  ], 'no Memory content, no conversation text, no reasoning, no score');
  const constraints = Object.fromEntries((await rows(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid = 'public.memory_control_commands'::regclass`)).map((c) => [c.conname, c.def]));
  assert.match(constraints.memory_control_commands_source_turn_key, /UNIQUE \(source_turn_id\)/u);
  assert.match(constraints.memory_control_commands_answers_key, /UNIQUE \(answers_command_id\)/u);
  assert.match(constraints.memory_control_commands_session_fk, /FOREIGN KEY \(session_id, user_id\) REFERENCES conversation_sessions\(id, user_id\)/u);
  assert.match(constraints.memory_control_commands_target_fk, /FOREIGN KEY \(target_memory_id, user_id\) REFERENCES memories\(id, user_id\)/u);
  assert.match(constraints.memory_control_commands_result_fk, /FOREIGN KEY \(result_memory_id, user_id\) REFERENCES memories\(id, user_id\)/u);
  assert.match(constraints.memory_control_commands_kind_check, /INSPECT.*REMEMBER.*CORRECT.*FORGET.*DISABLE/u);
  assert.ok(constraints.memory_control_commands_shape_check, 'every outcome has one lawful shape');
  const triggers = await rows(`SELECT t.tgname, pg_get_triggerdef(t.oid) AS def FROM pg_trigger t
    WHERE t.tgrelid = 'public.memory_control_commands'::regclass AND NOT t.tgisinternal`);
  assert.deepEqual(triggers.map((t) => t.tgname), ['memory_control_commands_facts_immutable']);
  assert.match(triggers[0].def, /BEFORE UPDATE ON public\.memory_control_commands FOR EACH ROW/u);

  stage = 'catalog: row-level security and grants';
  const [{ rls }] = await rows("SELECT relrowsecurity AS rls FROM pg_class WHERE oid = 'public.memory_control_commands'::regclass");
  assert.equal(rls, true);
  const policies = await rows("SELECT policyname, cmd, roles::text AS roles FROM pg_policies WHERE schemaname = 'public' AND tablename = 'memory_control_commands'");
  assert.deepEqual(policies.map((p) => [p.policyname, p.cmd, p.roles]), [['memory_control_commands_select_own', 'SELECT', '{authenticated}']]);
  const grants = await rows(`SELECT grantee, privilege_type FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'memory_control_commands' AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC') ORDER BY 1, 2`);
  assert.deepEqual(grants, [{ grantee: 'authenticated', privilege_type: 'SELECT' }], 'nobody writes a command record directly');
  const memoryWrites = await rows(`SELECT grantee, privilege_type FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'memories' AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')`);
  assert.deepEqual(memoryWrites, [], 'no role regained direct Memory write: there is still no generic status updater');

  stage = 'catalog: the function boundary';
  const fns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname IN ('server_disable_memory_v1', 'server_finalize_memory_control_turn_v1', 'pending_memory_clarification_v1')
     ORDER BY 1`);
  assert.deepEqual(fns.map((f) => [f.proname, f.prosecdef]), [
    ['pending_memory_clarification_v1', false],
    ['server_disable_memory_v1', true],
    ['server_finalize_memory_control_turn_v1', true],
  ]);
  for (const fn of fns) assert.deepEqual(fn.proconfig, ['search_path=""']);
  assert.equal(fns[1].args, 'p_user_id uuid, p_memory_id uuid', 'the disable primitive takes an owner and a Memory — never a status');
  const may = async (role, signature) => (await rows('SELECT has_function_privilege($1, $2, \'EXECUTE\') AS ok', [role, signature]))[0].ok;
  const DISABLE = 'public.server_disable_memory_v1(uuid,uuid)';
  const FINALIZE = 'public.server_finalize_memory_control_turn_v1(uuid,uuid,uuid,uuid,text,text,uuid,uuid,text,text,double precision,double precision,timestamptz,uuid[],uuid,text,text,uuid,uuid,uuid)';
  const PENDING = 'public.pending_memory_clarification_v1(uuid,uuid)';
  for (const signature of [DISABLE, FINALIZE]) {
    assert.equal(await may('service_role', signature), true);
    for (const role of ['anon', 'authenticated']) assert.equal(await may(role, signature), false, `${role} cannot execute ${signature}`);
  }
  assert.equal(await may('authenticated', PENDING), true);
  assert.equal(await may('anon', PENDING), false);
  const publicGrants = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace,
      LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
     WHERE n.nspname = 'public' AND p.proname IN ('server_disable_memory_v1', 'server_finalize_memory_control_turn_v1', 'pending_memory_clarification_v1')
       AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'`);
  assert.deepEqual(publicGrants, [], 'PUBLIC executes none of them');
}

// ------------------------------------------------------------------------------------------------------
// 2. The DISABLED primitive.
// ------------------------------------------------------------------------------------------------------

async function verifyDisable() {
  await client.query('BEGIN');
  try {
    const alice = await reader();
    const mallory = await reader();
    stage = 'disable: ACTIVE → DISABLED moves status and updated_at only';
    const tea = await memory(alice, 'I like tea.', { createdAt: '2000-01-01T00:00:00Z' });
    const before = await memoryRow(tea);
    const [disabled] = await disable(alice, tea);
    assert.equal(disabled.status, 'DISABLED');
    const { status: _s, updated_at: _u, ...kept } = before;
    const { status: _s2, updated_at: after, ...keptAfter } = disabled;
    assert.deepEqual(keptAfter, kept, 'content, provenance, scores, version and lineage are untouched');
    assert.ok(new Date(after) > new Date(before.updated_at));

    stage = 'disable: a repeat converges on the same row';
    const [again] = await disable(alice, tea);
    assert.deepEqual(again, disabled);

    stage = 'disable: nothing else is a target';
    assert.deepEqual(await disable(mallory, tea), [], 'another reader\'s Memory');
    assert.deepEqual(await disable(alice, randomUUID()), [], 'a missing Memory');
    for (const status of ['DELETED', 'SUPERSEDED', 'EXPIRED', 'PENDING_CONFIRMATION']) {
      const id = await memory(alice, `a ${status} memory`, { status });
      const row = await memoryRow(id);
      assert.deepEqual(await disable(alice, id), [], `${status} is not disabled`);
      assert.deepEqual(await memoryRow(id), row);
    }
    const lapsed = await memory(alice, 'a lapsed memory', { createdAt: '2020-01-01T00:00:00Z', expiresAt: '2020-01-02T00:00:00Z' });
    assert.deepEqual(await disable(alice, lapsed), [], 'an expired ACTIVE row is not current');
    assert.equal((await memoryRow(lapsed)).status, 'ACTIVE');
    await rejected(() => client.query('SELECT public.server_disable_memory_v1(NULL, $1)', [tea]), ['22023', '42501']);

    stage = 'disable: client roles cannot execute it or write Memory';
    await rejected(async () => { await actAs('authenticated', alice); await client.query('SELECT * FROM public.server_disable_memory_v1($1, $2)', [alice, lapsed]); }, ['42501']);
    await rejected(async () => { await actAs('anon'); await client.query('SELECT * FROM public.server_disable_memory_v1($1, $2)', [alice, lapsed]); }, ['42501']);
    await rejected(async () => { await actAs('authenticated', alice); await client.query("UPDATE public.memories SET status = 'DISABLED' WHERE id = $1", [lapsed]); }, ['42501']);
    await asOwner();

    stage = 'disable: a DISABLED Memory is outside the ACTIVE set retrieval reads';
    await actAs('authenticated', alice);
    const active = await rows("SELECT id FROM public.memories WHERE user_id = $1 AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > now())", [alice]);
    await asOwner();
    assert.ok(!active.some((row) => row.id === tea));
  } finally {
    await client.query('ROLLBACK');
  }
}

// ------------------------------------------------------------------------------------------------------
// 3. The atomic command.
// ------------------------------------------------------------------------------------------------------

async function verifyCommand() {
  await client.query('BEGIN');
  try {
    const alice = await reader();
    const mallory = await reader();
    const s = await session(alice);

    stage = 'command: REMEMBERED creates the Memory, records the command and finalizes the turn together';
    const t1 = await turn(alice, s);
    const newId = randomUUID();
    const assistant = randomUUID();
    const [answer] = await command({ session: s, user: alice, turn: t1, assistant, kind: 'REMEMBER', outcome: 'REMEMBERED', newId, content: '  Ahmed has an exam on Thursday.  ', reply: 'Got it.' });
    assert.equal(answer.outcome, 'REMEMBERED');
    assert.equal(answer.user_turn.status, 'COMPLETED');
    assert.equal(answer.assistant_turn.id, assistant);
    const created = await memoryRow(newId);
    assert.deepEqual([created.user_id, created.content, created.source, created.status, created.version, created.supersedes_memory_id, created.scope],
      [alice, 'Ahmed has an exam on Thursday.', 'USER_STATED', 'ACTIVE', 1, null, 'USER'], 'source and status are forced, not chosen');
    assert.deepEqual((await replyTo(t1)).content, 'Got it.');
    assert.equal((await turnRow(t1)).status, 'COMPLETED');
    assert.equal(await count("SELECT count(*) AS n FROM public.runtime_event_outbox WHERE subject_turn_id = $1 AND event_type = 'ConversationTurnCompleted'", [t1]), 1);
    const [record] = await commandsOf(alice);
    assert.deepEqual([record.kind, record.outcome, record.result_memory_id, record.target_memory_id, record.source_turn_id], ['REMEMBER', 'REMEMBERED', newId, null, t1]);

    stage = 'command: a replay of the same turn writes nothing';
    const memoriesBefore = await count('SELECT count(*) AS n FROM public.memories WHERE user_id = $1', [alice]);
    assert.deepEqual(await command({ session: s, user: alice, turn: t1, kind: 'REMEMBER', outcome: 'REMEMBERED', newId: randomUUID(), content: 'again' }), []);
    assert.equal(await count('SELECT count(*) AS n FROM public.memories WHERE user_id = $1', [alice]), memoriesBefore);
    assert.equal((await commandsOf(alice)).length, 1);

    stage = 'command: CORRECTED is a supersession; the predecessor keeps its row, content and version';
    const october = await memory(alice, 'I live in October.');
    const predecessor = await memoryRow(october);
    const t2 = await turn(alice, s);
    const successorId = randomUUID();
    const [corrected] = await command({ session: s, user: alice, turn: t2, kind: 'CORRECT', outcome: 'CORRECTED', target: october, newId: successorId, content: 'I live in Tanta.', reply: 'Corrected.', replyIfChanged: 'Changed.' });
    assert.equal(corrected.outcome, 'CORRECTED');
    const old = await memoryRow(october);
    assert.deepEqual([old.status, old.content, old.version], ['SUPERSEDED', predecessor.content, predecessor.version]);
    const successor = await memoryRow(successorId);
    assert.deepEqual([successor.supersedes_memory_id, successor.version, successor.status, successor.content], [october, predecessor.version + 1, 'ACTIVE', 'I live in Tanta.']);

    stage = 'command: a target that no longer qualifies commits TARGET_CHANGED, the changed reply, and no change';
    const t3 = await turn(alice, s);
    const [stale] = await command({ session: s, user: alice, turn: t3, kind: 'CORRECT', outcome: 'CORRECTED', target: october, newId: randomUUID(), content: 'I live in Giza.', reply: 'Corrected.', replyIfChanged: 'Changed.' });
    assert.equal(stale.outcome, 'TARGET_CHANGED');
    assert.equal((await replyTo(t3)).content, 'Changed.');
    assert.equal(await count('SELECT count(*) AS n FROM public.memories WHERE supersedes_memory_id = $1', [october]), 1, 'still one successor');
    const staleRecord = (await commandsOf(alice)).find((c) => c.source_turn_id === t3);
    assert.deepEqual([staleRecord.outcome, staleRecord.target_memory_id, staleRecord.result_memory_id], ['TARGET_CHANGED', october, null]);

    stage = 'command: FORGOTTEN is lifecycle deletion — ACTIVE and DISABLED become DELETED, DELETED converges, SUPERSEDED is changed';
    const cafe = await memory(alice, 'I like the Nile cafe.');
    const kept = await memory(alice, 'I like jasmine tea.', { status: 'DISABLED' });
    for (const target of [cafe, kept]) {
      const [forgotten] = await command({ session: s, user: alice, turn: await turn(alice, s), kind: 'FORGET', outcome: 'FORGOTTEN', target, replyIfChanged: 'Changed.' });
      assert.equal(forgotten.outcome, 'FORGOTTEN');
      assert.equal((await memoryRow(target)).status, 'DELETED', 'the row is kept, marked DELETED');
    }
    assert.equal((await command({ session: s, user: alice, turn: await turn(alice, s), kind: 'FORGET', outcome: 'FORGOTTEN', target: cafe, replyIfChanged: 'Changed.' }))[0].outcome, 'FORGOTTEN');
    assert.equal((await command({ session: s, user: alice, turn: await turn(alice, s), kind: 'FORGET', outcome: 'FORGOTTEN', target: october, replyIfChanged: 'Changed.' }))[0].outcome, 'TARGET_CHANGED');
    assert.equal((await memoryRow(october)).status, 'SUPERSEDED');

    stage = 'command: DISABLED goes through the primitive; a deleted target is changed';
    const job = await memory(alice, 'I work at the bank.');
    assert.equal((await command({ session: s, user: alice, turn: await turn(alice, s), kind: 'DISABLE', outcome: 'DISABLED', target: job, replyIfChanged: 'Changed.' }))[0].outcome, 'DISABLED');
    assert.equal((await memoryRow(job)).status, 'DISABLED');
    assert.equal((await command({ session: s, user: alice, turn: await turn(alice, s), kind: 'DISABLE', outcome: 'DISABLED', target: cafe, replyIfChanged: 'Changed.' }))[0].outcome, 'TARGET_CHANGED');
    assert.equal((await memoryRow(cafe)).status, 'DELETED');

    stage = 'command: a clarification records its options and changes nothing';
    const bank = await memory(alice, 'My new job is at the bank.');
    const boss = await memory(alice, 'My boss at work is difficult.');
    const ask = await turn(alice, s, 'GENERATING', 'forget the work topic');
    const statusesBefore = JSON.stringify(await rows('SELECT id, status FROM public.memories WHERE user_id = $1 ORDER BY id', [alice]));
    assert.equal((await command({ session: s, user: alice, turn: ask, kind: 'FORGET', outcome: 'CLARIFICATION_REQUIRED', candidates: [boss, bank], reply: 'Which one?' }))[0].outcome, 'CLARIFICATION_REQUIRED');
    assert.equal(JSON.stringify(await rows('SELECT id, status FROM public.memories WHERE user_id = $1 ORDER BY id', [alice])), statusesBefore);
    const clarification = (await commandsOf(alice)).find((c) => c.source_turn_id === ask);
    assert.deepEqual(clarification.candidate_memory_ids, [boss, bank]);

    stage = 'command: the owner-token read sees the clarification only from the immediately next turn, and only for its reader';
    const reply = await turn(alice, s, 'GENERATING', '2');
    await actAs('authenticated', alice);
    const pending = await rows('SELECT * FROM public.pending_memory_clarification_v1($1, $2)', [s, reply]);
    await actAs('authenticated', mallory);
    const foreign = await rows('SELECT * FROM public.pending_memory_clarification_v1($1, $2)', [s, reply]);
    await asOwner();
    assert.deepEqual(pending.map((p) => [p.command_id, p.kind, p.candidate_memory_ids, p.clarified_turn_content]), [[clarification.id, 'FORGET', [boss, bank], 'forget the work topic']]);
    assert.deepEqual(foreign, [], 'another reader sees nothing');

    stage = 'command: an answer outside the options, or for another kind, fails closed';
    await rejected(() => command({ session: s, user: alice, turn: reply, kind: 'FORGET', outcome: 'FORGOTTEN', target: job, answers: clarification.id, replyIfChanged: 'Changed.' }), ['42501']);
    await rejected(() => command({ session: s, user: alice, turn: reply, kind: 'DISABLE', outcome: 'DISABLED', target: bank, answers: clarification.id, replyIfChanged: 'Changed.' }), ['42501']);
    assert.equal((await turnRow(reply)).status, 'GENERATING', 'a refused command writes nothing');

    stage = 'command: the answer applies to the chosen option only, and binds to its clarification';
    assert.equal((await command({ session: s, user: alice, turn: reply, kind: 'FORGET', outcome: 'FORGOTTEN', target: bank, answers: clarification.id, replyIfChanged: 'Changed.' }))[0].outcome, 'FORGOTTEN');
    assert.deepEqual([(await memoryRow(bank)).status, (await memoryRow(boss)).status], ['DELETED', 'ACTIVE']);
    assert.equal((await commandsOf(alice)).find((c) => c.source_turn_id === reply).answers_command_id, clarification.id);

    stage = 'command: a clarification is answered once, and only by the immediately next user turn';
    const later = await turn(alice, s, 'GENERATING', '1');
    await actAs('authenticated', alice);
    assert.deepEqual(await rows('SELECT * FROM public.pending_memory_clarification_v1($1, $2)', [s, later]), []);
    await asOwner();
    await rejected(() => command({ session: s, user: alice, turn: later, kind: 'FORGET', outcome: 'FORGOTTEN', target: boss, answers: clarification.id, replyIfChanged: 'Changed.' }), ['42501', '23505']);
    assert.equal((await memoryRow(boss)).status, 'ACTIVE');

    stage = 'command: ownership — another reader\'s target or candidate fails closed; another reader\'s turn answers nothing';
    const theirs = await memory(mallory, 'I like the Nile cafe.');
    await rejected(() => command({ session: s, user: alice, turn: later, kind: 'FORGET', outcome: 'FORGOTTEN', target: theirs, replyIfChanged: 'Changed.' }), ['42501']);
    await rejected(() => command({ session: s, user: alice, turn: later, kind: 'FORGET', outcome: 'CLARIFICATION_REQUIRED', candidates: [boss, theirs], reply: 'Which?' }), ['42501']);
    assert.deepEqual(await command({ session: s, user: mallory, turn: later, kind: 'INSPECT', outcome: 'NOTHING_REMEMBERED' }), []);
    assert.equal((await memoryRow(theirs)).status, 'ACTIVE');

    stage = 'command: malformed requests fail closed';
    for (const bad of [
      { kind: 'FORGET', outcome: 'TARGET_CHANGED', target: boss },
      { kind: 'FORGET', outcome: 'FORGOTTEN', target: boss },
      { kind: 'FORGET', outcome: 'FORGOTTEN', target: boss, replyIfChanged: 'Changed.', reply: '   ' },
      { kind: 'REMEMBER', outcome: 'REMEMBERED' },
      { kind: 'REMEMBER', outcome: 'NOTHING_REMEMBERED' },
      { kind: 'INSPECT', outcome: 'INSPECTED', newId: randomUUID(), content: 'x' },
      { kind: 'RESET', outcome: 'INSPECTED' },
      { kind: 'FORGET', outcome: 'CLARIFICATION_REQUIRED', candidates: [boss, boss] },
    ]) {
      await rejected(() => command({ session: s, user: alice, turn: later, ...bad }), ['22023', '23514', '42501']);
    }
    assert.equal((await turnRow(later)).status, 'GENERATING');

    stage = 'command: INSPECT records only its outcome';
    assert.equal((await command({ session: s, user: alice, turn: later, kind: 'INSPECT', outcome: 'INSPECTED', reply: 'Here is what I remember.' }))[0].outcome, 'INSPECTED');

    stage = 'command: a recorded command is immutable, and nobody writes one directly';
    await rejected(() => client.query("UPDATE public.memory_control_commands SET outcome = 'FORGOTTEN' WHERE id = $1", [clarification.id]), ['42501']);
    await rejected(async () => { await actAs('authenticated', alice); await client.query("INSERT INTO public.memory_control_commands (id, user_id, session_id, source_turn_id, kind, outcome) VALUES ($1, $2, $3, $4, 'INSPECT', 'INSPECTED')", [randomUUID(), alice, s, later]); }, ['42501']);
    await rejected(async () => { await actAs('service_role'); await client.query('DELETE FROM public.memory_control_commands WHERE id = $1', [clarification.id]); }, ['42501']);
    await asOwner();
    await actAs('authenticated', mallory);
    assert.deepEqual(await rows('SELECT id FROM public.memory_control_commands'), [], 'owner-only SELECT');
    await asOwner();
  } finally {
    await client.query('ROLLBACK');
  }
}

// ------------------------------------------------------------------------------------------------------
// 4. Concurrency on committed state.
// ------------------------------------------------------------------------------------------------------

async function waitUntilBlocked(pid) {
  for (let i = 0; i < 400; i += 1) {
    const [row] = await rows('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (row?.wait_event_type === 'Lock') return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('the second attempt never blocked on the first');
}

async function race(first, second) {
  const one = new Client({ connectionString: databaseUrl });
  const two = new Client({ connectionString: databaseUrl });
  await one.connect();
  await two.connect();
  try {
    const [{ pid }] = (await two.query('SELECT pg_backend_pid() AS pid')).rows;
    await one.query('BEGIN');
    const a = await command(first, one);
    await two.query('BEGIN');
    const pending = command(second, two);
    await waitUntilBlocked(pid);
    await one.query('COMMIT');
    const b = await pending;
    await two.query('COMMIT');
    return [a, b];
  } finally {
    await one.end();
    await two.end();
  }
}

async function verifyConcurrency() {
  let alice;
  try {
    stage = 'concurrency: committed fixtures';
    await client.query('BEGIN');
    alice = await reader();
    const s1 = await session(alice);
    const s2 = await session(alice);
    const october = await memory(alice, 'I live in October.');
    const t1 = await turn(alice, s1);
    const t2 = await turn(alice, s2);
    const t3 = await turn(alice, s1);
    await client.query('COMMIT');

    stage = 'concurrency: two turns correct one Memory — one successor, the loser is told it changed';
    const [x, y] = await race(
      { session: s1, user: alice, turn: t1, kind: 'CORRECT', outcome: 'CORRECTED', target: october, newId: randomUUID(), content: 'I live in Tanta.', replyIfChanged: 'Changed.' },
      { session: s2, user: alice, turn: t2, kind: 'CORRECT', outcome: 'CORRECTED', target: october, newId: randomUUID(), content: 'I live in Giza.', replyIfChanged: 'Changed.' },
    );
    assert.deepEqual([x[0].outcome, y[0].outcome], ['CORRECTED', 'TARGET_CHANGED']);
    assert.equal(await count('SELECT count(*) AS n FROM public.memories WHERE supersedes_memory_id = $1', [october]), 1);
    assert.equal((await replyTo(t2)).content, 'Changed.');

    stage = 'concurrency: the same turn twice — one Memory, one record, the second answers nothing';
    const memoriesBefore = await count('SELECT count(*) AS n FROM public.memories WHERE user_id = $1', [alice]);
    const [p, q] = await race(
      { session: s1, user: alice, turn: t3, kind: 'REMEMBER', outcome: 'REMEMBERED', newId: randomUUID(), content: 'Ahmed has an exam on Thursday.' },
      { session: s1, user: alice, turn: t3, kind: 'REMEMBER', outcome: 'REMEMBERED', newId: randomUUID(), content: 'Ahmed has an exam on Thursday.' },
    );
    assert.equal(p[0].outcome, 'REMEMBERED');
    assert.deepEqual(q, []);
    assert.equal(await count('SELECT count(*) AS n FROM public.memories WHERE user_id = $1', [alice]), memoriesBefore + 1);
    assert.equal(await count('SELECT count(*) AS n FROM public.memory_control_commands WHERE source_turn_id = $1', [t3]), 1);
  } finally {
    stage = 'concurrency: fixture removal';
    if (alice) await removeCommittedReader(alice);
  }
}

/** Committed fixtures are removed as the table owner, with triggers suspended for THIS session only. */
async function removeCommittedReader(userId) {
  await client.query('ROLLBACK');
  await client.query('BEGIN');
  await client.query("SET LOCAL session_replication_role = 'replica'");
  const tables = await rows(`SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.column_name = 'user_id' AND t.table_type = 'BASE TABLE' ORDER BY 1`);
  for (const { table_name: table } of tables) await client.query(`DELETE FROM public.${table} WHERE user_id = $1`, [userId]);
  await client.query('DELETE FROM public.runtime_event_outbox WHERE subject_user_id = $1', [userId]);
  await client.query('DELETE FROM public.users WHERE id = $1', [userId]);
  await client.query('DELETE FROM auth.users WHERE id = $1', [userId]);
  await client.query('COMMIT');
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.memories WHERE user_id = $1)
    + (SELECT count(*) FROM public.memory_control_commands WHERE user_id = $1)
    + (SELECT count(*) FROM public.conversation_turns WHERE user_id = $1)
    + (SELECT count(*) FROM public.runtime_event_outbox WHERE subject_user_id = $1)
    + (SELECT count(*) FROM public.users WHERE id = $1) + (SELECT count(*) FROM auth.users WHERE id = $1) AS residue`, [userId]);
  assert.equal(Number(residue), 0, 'the committed fixtures are gone');
}

async function main() {
  await client.connect();
  try {
    await verifyCatalog();
    await verifyDisable();
    await verifyCommand();
    await verifyConcurrency();
    console.log('Migration 0128 conversational Memory control verified against real PostgreSQL.');
  } catch (error) {
    console.error(`Migration 0128 verification failed at: ${stage}`);
    throw error;
  } finally {
    await client.end();
  }
}

await main();
