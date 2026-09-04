// Real-PostgreSQL verifier for migration 0065 - Session Semantic Clock + SP
// Allocation/Sealing + LH Establishment + Committed-CU Delivery v1.
//
// Proves against live semantics, never grep alone: gapless per-Session SP
// allocation under the Session Semantic Clock lock; AF66-01 lock order; derived
// sealing with no second mutable flag; LH derived from `current_sp` and never
// zero; the atomic USER -> ASSISTANT exchange with no interleaving SP; the
// dedicated append-only `ConversationalUnitsCommitted` delivery surface with
// exact one-event-per-non-zero-batch idempotency; the internal same-SP
// sequencing seam that fails closed before the first SP and is executable by no
// application role; the service_role-only activation grant; owner-scoped
// temporal reads that cannot cross users; and that every T-03A1 semantic and
// the pre-existing runtime event outbox contract survive untouched. Every
// fixture is rolled back or explicitly removed.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required in the ignored local .env file.');
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}

async function rejected(operation, token, codes = ['22023']) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, `operation unexpectedly succeeded (wanted ${token})`);
  assert.ok(codes.includes(error.code), `unexpected SQLSTATE ${error.code} for ${token}: ${error.message}`);
  assert.ok(String(error.message).includes(token), `expected ${token}, got: ${error.message}`);
}

const PRODUCER = 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
const COORDINATOR = 'public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)';
const SAME_SP_HELPER = 'public.reserve_session_same_sp_event_v1(uuid,uuid)';
const BATCH_SNAPSHOT = 'public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
const TEMPORAL_STATE = 'public.get_session_temporal_state_v1(uuid)';
const DELIVERY_EVENTS = 'public.get_conversational_units_committed_events_v1(uuid,integer,integer)';
const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];
const ROUTE = ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'];

const E1 = 'أنا سبت الشغل امبارح. وبالمناسبة أحمد كلمني. ممكن نرجع لموضوع السفر؟';
const REPLY = 'رد المساعد على الموضوع. وسؤال ثانٍ. وملاحظة ثالثة.';

const points = (value) => Array.from(value);
const spanOf = (content, excerpt, occurrence = 1) => {
  const source = points(content);
  const needle = points(excerpt);
  let seen = 0;
  for (let start = 0; start + needle.length <= source.length; start += 1) {
    if (needle.every((ch, offset) => source[start + offset] === ch)) {
      seen += 1;
      if (seen === occurrence) return { start, end: start + needle.length };
    }
  }
  throw new Error(`fixture excerpt not found: ${excerpt}`);
};
const unit = (content, excerpt, occurrence = 1, id = randomUUID()) => {
  const { start, end } = spanOf(content, excerpt, occurrence);
  return { unit_id: id, span_start: start, span_end: end };
};

const commit = (session, user, turn, batch, units, provenance = PROVENANCE) =>
  rows('SELECT * FROM commit_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)',
    [session, user, turn, batch, JSON.stringify(units), ...provenance]);

const exchange = (session, user, userTurn, userBatch, userUnits, assistantTurn, assistantBatch, assistantUnits) =>
  rows('SELECT * FROM commit_finalized_exchange_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)',
    [session, user, userTurn, userBatch, JSON.stringify(userUnits),
      assistantTurn, assistantBatch, JSON.stringify(assistantUnits), ...PROVENANCE]);

const clockOf = async (session) =>
  (await rows('SELECT * FROM public.session_semantic_clocks WHERE session_id=$1', [session]))[0];
const spsOfSession = async (session) =>
  (await rows('SELECT session_position FROM public.conversation_units WHERE session_id=$1 ORDER BY session_position', [session]))
    .map((row) => row.session_position);
const eventsOfSession = (session) =>
  rows('SELECT * FROM public.conversation_unit_commit_events WHERE session_id=$1 ORDER BY first_sp', [session]);
const sessionSnapshot = async (session) =>
  (await rows('SELECT to_jsonb(cu) row FROM public.conversation_units cu WHERE session_id=$1 ORDER BY session_position', [session]))
    .map((r) => r.row);

async function newSession(owner) {
  const id = randomUUID();
  await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [id, owner]);
  return id;
}

async function completedTurns(owner, session, content = E1, reply = REPLY) {
  await identity('authenticated', owner);
  const userTurn = randomUUID();
  await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [userTurn, session, content, null]);
  await identity('service_role');
  await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, userTurn, ...ROUTE]);
  const assistantTurn = randomUUID();
  const finalized = await rows('SELECT * FROM finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [session, owner, userTurn, assistantTurn, reply, 'ALLOW', randomUUID(), null, null, null]);
  assert.equal(finalized.length, 1, 'fixture exchange finalized');
  await identity('postgres');
  return { userTurn, assistantTurn };
}

// ---------------------------------------------------------------- static gate
async function verifyStaticAuthority() {
  stage = 'static authority (cases 15, 16, 17, 18, 19, 20, 21, 22, 23, 34, 41, 52)';
  for (const [signature, label] of [[PRODUCER, 'producer'], [COORDINATOR, 'exchange coordinator'],
    [SAME_SP_HELPER, 'same-SP seam'], [BATCH_SNAPSHOT, 'batch snapshot'],
    [TEMPORAL_STATE, 'temporal state read'], [DELIVERY_EVENTS, 'delivery catch-up read']]) {
    const [presence] = await rows('SELECT to_regprocedure($1) IS NOT NULL present', [signature]);
    assert.equal(presence.present, true, `the ${label} exists with its exact signature`);
    const [contract] = await rows(
      'SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config FROM pg_proc p WHERE p.oid = to_regprocedure($1)',
      [signature]);
    assert.equal(contract.owner, 'postgres', `${label} is postgres-owned`);
    assert.equal(contract.definer, true, `${label} is SECURITY DEFINER`);
    // PostgreSQL stores the fixed empty search path as `search_path=""`.
    assert.ok(Array.isArray(contract.config) && contract.config.some((entry) => entry.startsWith('search_path=')),
      `${label} has a fixed empty search path`);
  }

  // AF66-01, proven from the DEPLOYED producer body: the Session Semantic Clock
  // lock is acquired BEFORE the source-turn lock, and before any other
  // T-03A2-owned row. This is the live definition, not the migration text.
  const [{ definition }] = await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [PRODUCER]);
  const clockLock = definition.indexOf('FROM public.session_semantic_clocks c');
  const turnLock = definition.indexOf('FROM public.conversation_turns t');
  const clockForUpdate = definition.indexOf('FOR UPDATE', clockLock);
  const turnForUpdate = definition.indexOf('FOR UPDATE', turnLock);
  assert.ok(clockLock > 0 && turnLock > 0, 'the producer body locks both the Session clock and the source turn');
  assert.ok(clockLock < turnLock, 'AF66-01: the Session Semantic Clock is read before the source turn');
  assert.ok(clockForUpdate > 0 && clockForUpdate < turnLock, 'the Session Semantic Clock lock is taken FOR UPDATE first');
  assert.ok(turnForUpdate > clockForUpdate, 'the source-turn lock is taken after the Session clock lock');
  const [{ definition: coordinatorBody }] = await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [COORDINATOR]);
  assert.ok(
    coordinatorBody.indexOf('FROM public.session_semantic_clocks c') < coordinatorBody.indexOf('commit_conversation_units_v1'),
    'the exchange coordinator takes the one Session clock before either commitment block');
  assert.equal((coordinatorBody.match(/FROM public\.session_semantic_clocks c\s+WHERE c\.session_id = p_session_id AND c\.user_id = p_user_id\s+FOR UPDATE/gu) ?? []).length, 1,
    'exactly one Session clock is acquired by one semantic transaction in v1');
  // FIX-T03A2-01: the two source rows are locked AFTER the clock, in the same
  // deterministic USER-then-ASSISTANT order the exchange commits them, and the
  // relation gate runs before either commitment block.
  const coordinatorClock = coordinatorBody.indexOf('FROM public.session_semantic_clocks c');
  const coordinatorUserLock = coordinatorBody.indexOf('INTO user_turn_row');
  const coordinatorAssistantLock = coordinatorBody.indexOf('INTO assistant_turn_row');
  const coordinatorGate = coordinatorBody.indexOf('INVALID_FINALIZED_EXCHANGE_RELATION');
  assert.ok(coordinatorClock > 0 && coordinatorClock < coordinatorUserLock,
    'the exchange coordinator locks the Session clock before the USER source row');
  assert.ok(coordinatorUserLock < coordinatorAssistantLock,
    'the USER source row is locked before the ASSISTANT source row');
  assert.ok(coordinatorGate > coordinatorAssistantLock
    && coordinatorGate < coordinatorBody.indexOf('commit_conversation_units_v1'),
    'the finalized-exchange relation is proven from the locked rows before any commitment block');
  // No timestamp participates in a Session Position decision.
  assert.doesNotMatch(definition.slice(definition.indexOf('next_sp :=')), /CURRENT_TIMESTAMP|now\(\)|clock_timestamp/u,
    'SP allocation reads no wall-clock time');

  // Cases 21/22/23: the activation grant is service_role-only, and the internal
  // same-SP seam is executable by NO application role.
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const [{ producer }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') producer", [role, PRODUCER]);
    const [{ coordinator }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') coordinator", [role, COORDINATOR]);
    const [{ helper }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') helper", [role, SAME_SP_HELPER]);
    assert.equal(helper, false, `${role} must not execute the internal same-SP sequencing seam`);
    if (role === 'service_role') {
      assert.equal(producer, true, 'service_role holds the T-03A2 activation grant on the producer');
      assert.equal(coordinator, true, 'service_role holds the activation grant on the exchange coordinator');
    } else {
      assert.equal(producer, false, `${role} must never execute the canonical producer`);
      assert.equal(coordinator, false, `${role} must never execute the exchange coordinator`);
    }
    // Cases 18/19/20: no direct table write is granted anywhere.
    for (const table of ['public.conversation_units', 'public.conversation_unit_commit_batches',
      'public.session_semantic_clocks', 'public.conversation_unit_commit_events']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const [{ granted }] = await rows('SELECT has_table_privilege($1::name,$2::text,$3::text) granted', [role, table, privilege]);
        assert.equal(granted, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
  }
  const [{ authenticatedState }] = await rows("SELECT has_function_privilege('authenticated'::name,$1::text,'EXECUTE') AS \"authenticatedState\"", [TEMPORAL_STATE]);
  const [{ authenticatedEvents }] = await rows("SELECT has_function_privilege('authenticated'::name,$1::text,'EXECUTE') AS \"authenticatedEvents\"", [DELIVERY_EVENTS]);
  assert.equal(authenticatedState, true, 'the owner-scoped temporal state read is authenticated-callable');
  assert.equal(authenticatedEvents, true, 'the owner-scoped delivery catch-up is authenticated-callable');
  for (const signature of [TEMPORAL_STATE, DELIVERY_EVENTS]) {
    const [{ anonAllowed }] = await rows("SELECT has_function_privilege('anon'::name,$1::text,'EXECUTE') AS \"anonAllowed\"", [signature]);
    assert.equal(anonAllowed, false, 'anonymous callers hold no temporal read');
  }

  // Cases 15/16/17: SP structure.
  const [{ count: spUnique }] = await rows(
    "SELECT count(*) count FROM pg_constraint WHERE conrelid='public.conversation_units'::regclass AND contype='u' AND conname='conversation_units_session_sp_unique'");
  assert.equal(Number(spUnique), 1, 'UNIQUE(session_id, session_position) exists');
  const [spColumn] = await rows(
    "SELECT is_nullable, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='conversation_units' AND column_name='session_position'");
  assert.deepEqual(spColumn, { is_nullable: 'NO', data_type: 'integer' }, 'session_position is a NOT NULL integer');

  // Case 52: no one-batch-per-turn uniqueness was introduced anywhere.
  const batchUniques = (await rows(
    "SELECT pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid='public.conversation_unit_commit_batches'::regclass AND contype='u'"))
    .map((row) => row.def);
  assert.deepEqual(batchUniques.filter((def) => def.includes('source_turn_id')), [],
    'several valid commitment batches per source turn remain legal');

  // Case 34: the delivery event carries no semantic content column at all.
  const eventColumns = await rows(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='conversation_unit_commit_events' ORDER BY column_name");
  assert.deepEqual(eventColumns.map((row) => row.column_name),
    ['commit_batch_id', 'created_at', 'first_sp', 'last_sp', 'session_id', 'source_turn_id', 'unit_count', 'user_id'],
    'the delivery event carries exactly identity and the SP range');
  assert.deepEqual(eventColumns.filter((row) => ['text', 'jsonb', 'json', 'bytea'].includes(row.data_type)), [],
    'the delivery event carries no text, payload or blob column');
  const [{ count: eventTriggers }] = await rows(
    "SELECT count(*) count FROM pg_trigger WHERE tgrelid='public.conversation_unit_commit_events'::regclass AND NOT tgisinternal AND tgname='conversation_unit_commit_events_immutable'");
  assert.equal(Number(eventTriggers), 1, 'the delivery event table is append-only');

  // The Session Semantic Clock carries no second mutable head and no timestamp.
  const clockColumns = (await rows(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='session_semantic_clocks' ORDER BY column_name"))
    .map((row) => row.column_name);
  assert.deepEqual(clockColumns, ['current_sp', 'same_sp_event_sequence', 'session_id', 'user_id'],
    'the clock holds exactly the Session Position and the internal same-SP sequence');

  // Case 41: the pre-existing outbox contract is untouched.
  const [outbox] = await rows(
    "SELECT pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid='public.runtime_event_outbox'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%ConversationTurnCompleted%'");
  assert.ok(outbox, 'the outbox event_type CHECK still exists');
  assert.ok(!outbox.def.includes('ConversationalUnitsCommitted'),
    'committed-CU delivery never reuses the runtime event outbox');
  const [{ count: outboxUnique }] = await rows(
    "SELECT count(*) count FROM pg_constraint WHERE conrelid='public.runtime_event_outbox'::regclass AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (event_type, subject_turn_id)'");
  assert.equal(Number(outboxUnique), 1, 'the outbox one-row-per-turn constraint is unchanged');
}

// ------------------------------------------------------------ SP allocation
async function verifyAllocation(owner) {
  stage = 'SP allocation (cases 1, 2, 3, 4, 6, 7, 8, 44, 51)';
  // Case 44: creating a Session creates exactly one clock row, with no SP.
  const session = await newSession(owner);
  const [{ count: clockRows }] = await rows('SELECT count(*) count FROM public.session_semantic_clocks WHERE session_id=$1', [session]);
  assert.equal(Number(clockRows), 1, 'Session creation created exactly one Session Semantic Clock row');
  assert.deepEqual(await clockOf(session), { session_id: session, user_id: owner, current_sp: null, same_sp_event_sequence: '0' },
    'a new Session has no user-addressable committed Session Position yet');

  // Case 7: a zero-CU batch before the first SP leaves current_sp NULL.
  const first = await completedTurns(owner, session);
  const zeroBatch = randomUUID();
  assert.deepEqual(await commit(session, owner, first.userTurn, zeroBatch, []), [],
    'a zero-CU batch commits no unit');
  assert.equal((await clockOf(session)).current_sp, null, 'a zero-CU batch allocates no Session Position');
  assert.equal((await eventsOfSession(session)).length, 0, 'a zero-CU batch creates no advancement event');
  const [zeroRow] = await rows('SELECT unit_count FROM public.conversation_unit_commit_batches WHERE id=$1', [zeroBatch]);
  assert.equal(zeroRow.unit_count, 0, 'the zero-CU evaluation batch is still recorded');

  // Case 1: the first one-CU commit is SP(1) and LH(1).
  const oneBatch = randomUUID();
  const one = await commit(session, owner, first.userTurn, oneBatch, [unit(E1, 'أنا سبت الشغل امبارح.')]);
  assert.equal(one.length, 1);
  assert.equal(one[0].session_position, 1, 'the first committed CU is SP(1)');
  assert.equal((await clockOf(session)).current_sp, 1, 'LH is SP(1)');

  // Case 42: the T-03A1 source semantics survive the rewrite untouched. Every
  // canonical field is still DB-derived from the locked source row - the
  // committed wording is sliced by the database, the digest is SHA-256 over the
  // explicit UTF-8 bytes, role/speaker/modality are server-forced - and the
  // commitment still produces no runtime outbox event of any kind.
  assert.equal(one[0].committed_text, points(E1).slice(one[0].source_span_start, one[0].source_span_end).join(''),
    'committed wording is still the canonical source slice at the stored span');
  assert.equal(one[0].source_content_sha256.toString('hex'),
    createHash('sha256').update(Buffer.from(E1, 'utf8')).digest('hex'),
    'the stored digest is still the DB-computed SHA-256 of the UTF-8 source');
  assert.deepEqual(
    [one[0].source_role, one[0].speaker_state, one[0].source_modality, one[0].ordinal_within_turn],
    ['USER', 'RESOLVED', 'TEXT', 0],
    'role, speaker state, modality and the global source ordinal are still DB-derived');
  const [{ count: outboxEvents }] = await rows(
    'SELECT count(*) count FROM public.runtime_event_outbox WHERE subject_turn_id=$1 AND event_type<>$2',
    [first.userTurn, 'ConversationTurnCompleted']);
  assert.equal(Number(outboxEvents), 0, 'committed-CU delivery produces no runtime outbox event');

  // Case 3: a second batch on the same turn continues with contiguous SPs.
  const second = await commit(session, owner, first.userTurn, randomUUID(), [
    unit(E1, 'وبالمناسبة أحمد كلمني.'), unit(E1, 'ممكن نرجع لموضوع السفر؟')]);
  assert.deepEqual(second.map((row) => row.session_position), [2, 3], 'the next batch of the same turn continues the Session sequence');
  assert.equal((await clockOf(session)).current_sp, 3);

  // Case 4: the next source turn continues the same Session sequence.
  const next = await completedTurns(owner, session);
  const assistantRow = await rows('SELECT content FROM public.conversation_turns WHERE id=$1', [next.assistantTurn]);
  const assistantContent = assistantRow[0].content;
  const nextBatch = await commit(session, owner, next.assistantTurn, randomUUID(), [unit(assistantContent, 'رد المساعد على الموضوع.')]);
  assert.equal(nextBatch[0].session_position, 4, 'a new source turn continues the Session Position sequence');

  // Case 8: a zero-CU batch after an SP leaves LH unchanged and creates no event.
  const beforeZero = await clockOf(session);
  const eventsBefore = await eventsOfSession(session);
  await commit(session, owner, next.userTurn, randomUUID(), []);
  assert.deepEqual(await clockOf(session), beforeZero, 'a later zero-CU batch changed neither current_sp nor the same-SP sequence');
  assert.equal((await eventsOfSession(session)).length, eventsBefore.length, 'a later zero-CU batch created no advancement event');

  // Case 51: a further distinct valid batch for a source turn remains possible.
  const later = await commit(session, owner, next.assistantTurn, randomUUID(), [unit(assistantContent, 'وسؤال ثانٍ.')]);
  assert.equal(later[0].session_position, 5, 'a later distinct batch for the same turn allocates the next Session Position');
  assert.deepEqual(await spsOfSession(session), [1, 2, 3, 4, 5], 'the Session sequence is gapless and monotone');

  // Case 2 / case 6: an independent Session has its own independent SP(1).
  const other = await newSession(owner);
  const otherTurns = await completedTurns(owner, other);
  const otherBatch = await commit(other, owner, otherTurns.userTurn, randomUUID(), [
    unit(E1, 'أنا سبت الشغل امبارح.'), unit(E1, 'وبالمناسبة أحمد كلمني.'), unit(E1, 'ممكن نرجع لموضوع السفر؟')]);
  assert.deepEqual(otherBatch.map((row) => row.session_position), [1, 2, 3], 'a first three-CU batch is SP(1)..SP(3)');
  assert.equal((await clockOf(session)).current_sp, 5, 'the concurrent Session kept its own independent head');
  return { session, other, sourceTurn: first.userTurn, oneBatch };
}

// -------------------------------------------------------- sealing and replay
async function verifySealingAndReplay(owner, session, sourceTurn, oneBatch) {
  stage = 'sealing and replay (cases 9, 10, 11, 12, 27, 28, 31, 33)';
  // Case 27: sealing is DERIVED. SP(n) is OPEN iff n = current_sp; every
  // earlier Session Position is sealed, and no sealed flag exists to disagree.
  const head = (await clockOf(session)).current_sp;
  const sealed = await rows(
    'SELECT session_position sp, (session_position < $2) AS is_sealed FROM public.conversation_units WHERE session_id=$1 ORDER BY session_position',
    [session, head]);
  assert.deepEqual(sealed.map((row) => row.is_sealed), [true, true, true, true, false],
    'every Session Position before the head is derivably sealed and only the head is open');

  const before = await sessionSnapshot(session);
  const clockBefore = await clockOf(session);

  // Case 9: an exact existing-batch replay mutates nothing at all.
  const storedUnits = await rows('SELECT * FROM public.conversation_units WHERE commit_batch_id=$1 ORDER BY ordinal_within_turn', [oneBatch]);
  const replayPayload = storedUnits.map((row) => ({ unit_id: row.id, span_start: row.source_span_start, span_end: row.source_span_end }));
  const replayed = await commit(session, owner, sourceTurn, oneBatch, replayPayload);
  assert.deepEqual(replayed.map((row) => row.session_position), storedUnits.map((row) => row.session_position),
    'the replay returned the stored Session Positions and never re-derived them');
  assert.deepEqual(await clockOf(session), clockBefore, 'the replay performed zero clock mutation');
  assert.deepEqual(await sessionSnapshot(session), before, 'the replay performed zero row mutation');

  // Case 10: replaying the FIRST batch after later batches advanced the head
  // still returns its historical Session Positions unchanged.
  assert.equal(replayed[0].session_position, 1, 'the historical Session Position survived later advancement');

  // Case 11: the same batch id with any changed payload fails closed.
  await rejected(() => commit(session, owner, sourceTurn, oneBatch, [{ ...replayPayload[0], unit_id: randomUUID() }]),
    'COMMIT_BATCH_PAYLOAD_CONFLICT');
  await rejected(() => commit(session, owner, sourceTurn, oneBatch, []), 'COMMIT_BATCH_PAYLOAD_CONFLICT');
  assert.deepEqual(await clockOf(session), clockBefore, 'a conflicting replay performed zero clock mutation');

  // Case 12: a NEW backward batch is refused by the T-03A1 source frontier and
  // allocates no Session Position.
  await rejected(() => commit(session, owner, sourceTurn, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]),
    'SPAN_BEFORE_SOURCE_FRONTIER');
  assert.deepEqual(await clockOf(session), clockBefore, 'a frontier rejection performed zero clock mutation');
  assert.deepEqual(await sessionSnapshot(session), before, 'a frontier rejection wrote nothing');

  // Case 28: no writer can backdate a NEW committed CU into a sealed Session
  // Position. The allocator only ever produces current_sp + 1, and the
  // structural uniqueness makes a duplicate impossible.
  await rejected(() => q(
    'INSERT INTO public.conversation_units(id,user_id,session_id,source_turn_id,commit_batch_id,source_role,speaker_state,source_modality,ordinal_within_turn,source_span_start,source_span_end,committed_text,source_content_sha256,session_position) '
    + "SELECT $1,cu.user_id,cu.session_id,cu.source_turn_id,cu.commit_batch_id,cu.source_role,cu.speaker_state,cu.source_modality,99,0,3,'أنا',cu.source_content_sha256,1 FROM public.conversation_units cu WHERE cu.session_id=$2 LIMIT 1",
    [randomUUID(), session]), 'conversation_units_session_sp_unique', ['23505']);

  // Cases 31/33: replay creates no duplicate event, and every stored event
  // range matches its batch exactly.
  const events = await eventsOfSession(session);
  assert.equal(new Set(events.map((row) => row.commit_batch_id)).size, events.length, 'no duplicate delivery event exists');
  for (const event of events) {
    const [range] = await rows(
      'SELECT min(session_position) first_sp, max(session_position) last_sp, count(*) units FROM public.conversation_units WHERE commit_batch_id=$1',
      [event.commit_batch_id]);
    assert.equal(event.first_sp, Number(range.first_sp), 'the event first_sp matches the stored batch');
    assert.equal(event.last_sp, Number(range.last_sp), 'the event last_sp matches the stored batch');
    assert.equal(event.unit_count, Number(range.units), 'the event unit_count matches the stored batch');
    assert.equal(event.unit_count, event.last_sp - event.first_sp + 1, 'the event range is internally contiguous');
  }
}

// ------------------------------------------------------- the same-SP seam
async function verifySameSpSeam(owner) {
  stage = 'internal same-SP sequencing seam (cases 24, 25, 26)';
  const session = await newSession(owner);
  // Case 26: before the first SP the seam fails closed. It does not invent
  // PRE_FIRST_SP membership and does not create SP(0).
  await rejected(() => rows('SELECT * FROM reserve_session_same_sp_event_v1($1,$2)', [session, owner]),
    'SESSION_POSITION_NOT_ESTABLISHED', ['55000']);
  assert.equal((await clockOf(session)).current_sp, null, 'the failed reservation created no Session Position');

  const turns = await completedTurns(owner, session);
  await commit(session, owner, turns.userTurn, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]);

  // Case 24: the seam increments deterministically on the current open head.
  for (const expected of [1, 2, 3]) {
    const [reserved] = await rows('SELECT * FROM reserve_session_same_sp_event_v1($1,$2)', [session, owner]);
    assert.equal(reserved.session_position, 1, 'the seam reports the current open Session Position');
    assert.equal(Number(reserved.event_sequence), expected, 'the same-SP sequence increments by one');
  }
  assert.equal(Number((await clockOf(session)).same_sp_event_sequence), 3);

  // Case 25: a new committed CU advance resets the open-head same-SP sequence.
  const advanced = await commit(session, owner, turns.userTurn, randomUUID(), [unit(E1, 'وبالمناسبة أحمد كلمني.')]);
  assert.equal(advanced[0].session_position, 2);
  const clock = await clockOf(session);
  assert.equal(clock.current_sp, 2, 'the head advanced');
  assert.equal(Number(clock.same_sp_event_sequence), 0, 'the same-SP sequence restarted at the new open head');

  // Ownership is validated: a foreign caller cannot reserve inside this Session.
  await rejected(() => rows('SELECT * FROM reserve_session_same_sp_event_v1($1,$2)', [session, randomUUID()]),
    'FORBIDDEN', ['42501']);
}

// -------------------------------------------- the atomic finalized exchange
async function verifyExchangeCoordinator(owner) {
  stage = 'atomic USER -> ASSISTANT exchange (cases 5, 46, 47, 48, 49)';
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session);
  const [{ content: assistantContent }] = await rows('SELECT content FROM public.conversation_turns WHERE id=$1', [turns.assistantTurn]);

  const userBatch = randomUUID();
  const assistantBatch = randomUUID();
  const userUnits = [unit(E1, 'أنا سبت الشغل امبارح.'), unit(E1, 'وبالمناسبة أحمد كلمني.')];
  const assistantUnits = [
    unit(assistantContent, 'رد المساعد على الموضوع.'),
    unit(assistantContent, 'وسؤال ثانٍ.'),
    unit(assistantContent, 'وملاحظة ثالثة.')];

  // Case 5: USER two CUs + ASSISTANT three CUs -> contiguous 1..5 in exact
  // USER-then-ASSISTANT order, with no interleaving Session Position.
  const [result] = await exchange(session, owner, turns.userTurn, userBatch, userUnits,
    turns.assistantTurn, assistantBatch, assistantUnits);
  assert.equal(result.live_head, 5, 'the exchange advanced LH to SP(5)');
  assert.deepEqual(result.user_units.map((row) => row.session_position), [1, 2]);
  assert.deepEqual(result.assistant_units.map((row) => row.session_position), [3, 4, 5]);
  assert.deepEqual(result.user_units.map((row) => row.source_role), ['USER', 'USER']);
  assert.deepEqual(result.assistant_units.map((row) => row.source_role), ['ASSISTANT', 'ASSISTANT', 'ASSISTANT']);
  assert.equal(result.user_event.first_sp, 1);
  assert.equal(result.user_event.last_sp, 2);
  assert.equal(result.assistant_event.first_sp, 3);
  assert.equal(result.assistant_event.last_sp, 5);
  assert.deepEqual(await spsOfSession(session), [1, 2, 3, 4, 5]);

  // Case 47: an exact replay returns the canonical pair with zero mutation.
  const before = await sessionSnapshot(session);
  const clockBefore = await clockOf(session);
  const [replayed] = await exchange(session, owner, turns.userTurn, userBatch, userUnits,
    turns.assistantTurn, assistantBatch, assistantUnits);
  assert.equal(replayed.live_head, 5);
  assert.deepEqual(replayed.user_units.map((row) => row.session_position), [1, 2]);
  assert.deepEqual(replayed.assistant_units.map((row) => row.session_position), [3, 4, 5]);
  assert.deepEqual(await clockOf(session), clockBefore, 'the exchange replay performed zero clock mutation');
  assert.deepEqual(await sessionSnapshot(session), before, 'the exchange replay performed zero row mutation');
  assert.equal((await eventsOfSession(session)).length, 2, 'the exchange replay created no duplicate event');

  // Case 46: an ASSISTANT failure rolls the USER block back with it.
  const rollbackSession = await newSession(owner);
  const rollbackTurns = await completedTurns(owner, rollbackSession);
  await rejected(() => exchange(rollbackSession, owner, rollbackTurns.userTurn, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')],
    rollbackTurns.assistantTurn, randomUUID(), [{ unit_id: randomUUID(), span_start: 0, span_end: 100000 }]),
  'SPAN_OUT_OF_RANGE');
  assert.equal((await clockOf(rollbackSession)).current_sp, null, 'the failed exchange allocated no Session Position');
  assert.deepEqual(await spsOfSession(rollbackSession), [], 'the USER block rolled back with the ASSISTANT block');
  assert.equal((await eventsOfSession(rollbackSession)).length, 0, 'the failed exchange published no delivery event');

  // Case 48: USER zero + ASSISTANT non-zero allocates only ASSISTANT SPs, with
  // no phantom USER Moment.
  const zeroUserSession = await newSession(owner);
  const zeroUserTurns = await completedTurns(owner, zeroUserSession);
  const [{ content: zeroAssistantContent }] = await rows('SELECT content FROM public.conversation_turns WHERE id=$1', [zeroUserTurns.assistantTurn]);
  const [zeroUser] = await exchange(zeroUserSession, owner, zeroUserTurns.userTurn, randomUUID(), [],
    zeroUserTurns.assistantTurn, randomUUID(), [
      unit(zeroAssistantContent, 'رد المساعد على الموضوع.'), unit(zeroAssistantContent, 'وسؤال ثانٍ.')]);
  assert.equal(zeroUser.live_head, 2);
  assert.deepEqual(zeroUser.user_units, []);
  assert.equal(zeroUser.user_event, null, 'a zero-CU USER block publishes no advancement event');
  assert.deepEqual(zeroUser.assistant_units.map((row) => row.session_position), [1, 2],
    'the ASSISTANT block takes the next Session Positions with no phantom USER Moment');

  // Case 49: both halves zero -> LH unchanged and no delivery event at all.
  const bothZeroSession = await newSession(owner);
  const bothZeroTurns = await completedTurns(owner, bothZeroSession);
  const [bothZero] = await exchange(bothZeroSession, owner, bothZeroTurns.userTurn, randomUUID(), [],
    bothZeroTurns.assistantTurn, randomUUID(), []);
  assert.equal(bothZero.live_head, null, 'LH is null, never 0, when nothing was committed');
  assert.deepEqual([bothZero.user_event, bothZero.assistant_event], [null, null], 'both zero halves publish no event');
  assert.equal((await clockOf(bothZeroSession)).current_sp, null);

  // A single exchange may never target one turn twice.
  await rejected(() => exchange(session, owner, turns.userTurn, randomUUID(), [], turns.userTurn, randomUUID(), []),
    'INVALID_COMMIT_IDENTITY');
  return session;
}

// ------------------------------------- FIX-T03A2-01: the exchange relation
async function verifyFinalizedExchangeRelation(owner) {
  stage = 'finalized-exchange relation (cases 53, 54, 55, 56, 57)';
  // The coordinator's PARAMETER NAMES are not authority. These cases prove the
  // relation is derived from the locked source rows, so a privileged caller
  // cannot allocate Session Positions in a false exchange order or present
  // unrelated source as one atomic finalized exchange.
  const session = await newSession(owner);
  const first = await completedTurns(owner, session);
  const second = await completedTurns(owner, session);
  const [{ content: assistantContent }] = await rows('SELECT content FROM public.conversation_turns WHERE id=$1', [first.assistantTurn]);
  const userUnits = [unit(E1, 'أنا سبت الشغل امبارح.')];
  const assistantUnits = [unit(assistantContent, 'رد المساعد على الموضوع.')];

  const untouched = async (label) => {
    assert.equal((await clockOf(session)).current_sp, null, `${label}: no Session Position was allocated`);
    assert.deepEqual(await spsOfSession(session), [], `${label}: no committed CU exists`);
    assert.equal((await eventsOfSession(session)).length, 0, `${label}: no delivery event exists`);
    const [{ count: batches }] = await rows('SELECT count(*) count FROM public.conversation_unit_commit_batches WHERE session_id=$1', [session]);
    assert.equal(Number(batches), 0, `${label}: no commitment batch exists`);
  };
  await untouched('precondition');

  // Case 53: swapped halves - the ASSISTANT turn supplied as the USER half and
  // the USER turn supplied as the ASSISTANT half.
  await rejected(() => exchange(session, owner, first.assistantTurn, randomUUID(), assistantUnits,
    first.userTurn, randomUUID(), userUnits), 'INVALID_FINALIZED_EXCHANGE_RELATION');
  await untouched('swapped halves');

  // Case 54: an unrelated completed ASSISTANT turn of the SAME Session, whose
  // source_turn_id names a different USER turn.
  await rejected(() => exchange(session, owner, first.userTurn, randomUUID(), userUnits,
    second.assistantTurn, randomUUID(), assistantUnits), 'INVALID_FINALIZED_EXCHANGE_RELATION');
  await untouched('unrelated assistant');
  // ... and the mirror: a USER half that is not the source of that ASSISTANT.
  await rejected(() => exchange(session, owner, second.userTurn, randomUUID(), userUnits,
    first.assistantTurn, randomUUID(), assistantUnits), 'INVALID_FINALIZED_EXCHANGE_RELATION');
  await untouched('unrelated user');

  // Case 55: a cross-Session pair. The owner-scoped lookup fails closed as
  // FORBIDDEN without leaking whether the turn exists in another Session -
  // exactly the behaviour the canonical producer already has.
  const otherSession = await newSession(owner);
  const otherTurns = await completedTurns(owner, otherSession);
  await rejected(() => exchange(session, owner, first.userTurn, randomUUID(), userUnits,
    otherTurns.assistantTurn, randomUUID(), assistantUnits), 'FORBIDDEN', ['42501']);
  await untouched('cross-Session assistant');
  await rejected(() => exchange(otherSession, owner, first.userTurn, randomUUID(), userUnits,
    otherTurns.assistantTurn, randomUUID(), assistantUnits), 'FORBIDDEN', ['42501']);
  assert.equal((await clockOf(otherSession)).current_sp, null, 'the other Session allocated nothing either');

  // Case 56: a still-provisional pair is refused even when the relation itself
  // is correct, so the coordinator can never commit uncommittable source.
  await identity('authenticated', owner);
  const provisionalTurn = randomUUID();
  await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [provisionalTurn, session, E1, null]);
  await identity('postgres');
  await rejected(() => exchange(session, owner, provisionalTurn, randomUUID(), userUnits,
    first.assistantTurn, randomUUID(), assistantUnits), 'INVALID_FINALIZED_EXCHANGE_RELATION');
  await untouched('provisional USER half');

  // Case 57: the genuine finalized pair still commits, in the exact same order
  // and with the exact same Session Positions as before the relation gate.
  const [valid] = await exchange(session, owner, first.userTurn, randomUUID(), userUnits,
    first.assistantTurn, randomUUID(), assistantUnits);
  assert.equal(valid.live_head, 2, 'the valid finalized exchange advanced LH to SP(2)');
  assert.deepEqual(valid.user_units.map((row) => row.session_position), [1], 'the USER block still takes SP(1)');
  assert.deepEqual(valid.assistant_units.map((row) => row.session_position), [2], 'the ASSISTANT block still follows at SP(2)');
  assert.deepEqual(valid.user_units.map((row) => row.source_role), ['USER']);
  assert.deepEqual(valid.assistant_units.map((row) => row.source_role), ['ASSISTANT']);
  assert.deepEqual(await spsOfSession(session), [1, 2], 'the Session sequence is exactly the finalized exchange');
}

// ------------------------------------------------------------- LH and reads
async function verifyLiveHeadAndReads(owner, other, populatedSession) {
  stage = 'LH derivation and owner-scoped reads (cases 29, 30, 32, 35, 36, 37, 38, 39, 40, 50)';
  // Case 35: LH equals MAX(session_position) for a Session with committed CUs.
  const [{ head }] = await rows('SELECT current_sp head FROM public.session_semantic_clocks WHERE session_id=$1', [populatedSession]);
  const [{ maximum }] = await rows('SELECT max(session_position) maximum FROM public.conversation_units WHERE session_id=$1', [populatedSession]);
  assert.equal(head, Number(maximum), 'LH is exactly MAX(conversation_units.session_position)');

  // Cases 29/30/32: one event per non-zero batch, none for a zero batch, and
  // distinct events for several batches of one source turn.
  const events = await eventsOfSession(populatedSession);
  const [{ count: nonZeroBatches }] = await rows(
    'SELECT count(*) count FROM public.conversation_unit_commit_batches WHERE session_id=$1 AND unit_count > 0', [populatedSession]);
  assert.equal(events.length, Number(nonZeroBatches), 'exactly one delivery event exists per non-zero committed batch');
  const [{ count: zeroBatchEvents }] = await rows(
    'SELECT count(*) count FROM public.conversation_unit_commit_events e JOIN public.conversation_unit_commit_batches b ON b.id=e.commit_batch_id WHERE b.unit_count=0');
  assert.equal(Number(zeroBatchEvents), 0, 'a zero-CU batch never carries a delivery event');

  // Case 36: a Session with no committed CU returns LH null, never 0.
  const emptySession = await newSession(owner);
  await identity('authenticated', owner);
  const [emptyState] = await rows('SELECT * FROM get_session_temporal_state_v1($1)', [emptySession]);
  assert.deepEqual(emptyState, { session_id: emptySession, live_head: null }, 'an empty Session reports LH null');

  // Case 37: the owner-scoped read cannot cross users.
  const [ownedState] = await rows('SELECT * FROM get_session_temporal_state_v1($1)', [populatedSession]);
  assert.equal(ownedState.live_head, head, 'the owner reads the authoritative Live Head');
  await identity('authenticated', other);
  assert.deepEqual(await rows('SELECT * FROM get_session_temporal_state_v1($1)', [populatedSession]), [],
    'another user cannot read this Session temporal state');

  // Case 38: the catch-up read cannot cross users either.
  await rejected(() => rows('SELECT * FROM get_conversational_units_committed_events_v1($1,$2,$3)', [populatedSession, null, 64]),
    'FORBIDDEN', ['42501']);

  // Cases 39/40: ordering, cursor semantics, and no SP(0) cursor.
  await identity('authenticated', owner);
  const page = await rows('SELECT * FROM get_conversational_units_committed_events_v1($1,$2,$3)', [populatedSession, null, 64]);
  assert.deepEqual(page.map((row) => row.first_sp), [...page.map((row) => row.first_sp)].sort((a, b) => a - b),
    'delivery events are ordered ascending by Session Position');
  assert.deepEqual(page.map((row) => row.commit_batch_id), events.map((row) => row.commit_batch_id));
  assert.ok(page.every((row) => row.session_id === populatedSession), 'the page is Session-scoped');
  const cursor = page[0].last_sp;
  const after = await rows('SELECT * FROM get_conversational_units_committed_events_v1($1,$2,$3)', [populatedSession, cursor, 64]);
  assert.ok(after.every((row) => row.first_sp > cursor), 'afterSp excludes everything at or before the cursor');
  await rejected(() => rows('SELECT * FROM get_conversational_units_committed_events_v1($1,$2,$3)', [populatedSession, 0, 64]),
    'INVALID_DELIVERY_CURSOR');
  await rejected(() => rows('SELECT * FROM get_conversational_units_committed_events_v1($1,$2,$3)', [populatedSession, -1, 64]),
    'INVALID_DELIVERY_CURSOR');
  await rejected(() => rows('SELECT * FROM get_conversational_units_committed_events_v1($1,$2,$3)', [populatedSession, null, 257]),
    'INVALID_DELIVERY_LIMIT');
  const bounded = await rows('SELECT * FROM get_conversational_units_committed_events_v1($1,$2,$3)', [populatedSession, null, 1]);
  assert.equal(bounded.length, Math.min(1, page.length), 'the page size is bounded');
  // The delivered row carries no analytical or internal field.
  assert.deepEqual(Object.keys(page[0]).sort(),
    ['commit_batch_id', 'first_sp', 'last_sp', 'session_id', 'source_turn_id', 'unit_count'],
    'the delivery row carries no content and no same-SP sequence');

  // Case 50: the service-role snapshot read validates ownership explicitly.
  await identity('postgres');
  const [{ id: knownBatch, source_turn_id: knownTurn }] = await rows(
    'SELECT id, source_turn_id FROM public.conversation_unit_commit_batches WHERE session_id=$1 AND unit_count > 0 LIMIT 1', [populatedSession]);
  const [snapshotRow] = await rows('SELECT * FROM get_conversation_unit_commit_batch_snapshot_v1($1,$2,$3,$4)',
    [populatedSession, owner, knownTurn, knownBatch]);
  assert.equal(snapshotRow.batch_exists, true, 'an existing automatic batch is reported as committed');
  assert.ok(snapshotRow.committed_unit_count > 0);
  assert.equal(snapshotRow.event.commit_batch_id, knownBatch, 'the snapshot carries the matching delivery event');
  assert.equal(snapshotRow.live_head, head, 'the snapshot reports the derived Live Head');
  assert.ok(snapshotRow.source_frontier > 0, 'the snapshot reports the committed source frontier');
  const [absent] = await rows('SELECT * FROM get_conversation_unit_commit_batch_snapshot_v1($1,$2,$3,$4)',
    [populatedSession, owner, knownTurn, randomUUID()]);
  assert.equal(absent.batch_exists, false, 'an unknown batch is reported absent, never invented');
  await rejected(() => rows('SELECT * FROM get_conversation_unit_commit_batch_snapshot_v1($1,$2,$3,$4)',
    [populatedSession, other, knownTurn, knownBatch]), 'FORBIDDEN', ['42501']);
  await rejected(() => rows('SELECT * FROM get_conversation_unit_commit_batch_snapshot_v1($1,$2,$3,$4)',
    [emptySession, owner, knownTurn, knownBatch]), 'FORBIDDEN', ['42501']);
}

// ------------------------------------------- append-only delivery protection
async function verifyDeliveryAppendOnly(owner, populatedSession) {
  stage = 'delivery append-only protection (case 20)';
  const [event] = await eventsOfSession(populatedSession);
  for (const attempt of [
    () => q('UPDATE public.conversation_unit_commit_events SET last_sp=99 WHERE commit_batch_id=$1', [event.commit_batch_id]),
    () => q('UPDATE public.conversation_unit_commit_events SET unit_count=0 WHERE commit_batch_id=$1', [event.commit_batch_id]),
    () => q('DELETE FROM public.conversation_unit_commit_events WHERE commit_batch_id=$1', [event.commit_batch_id]),
  ]) {
    await rejected(attempt, 'CONVERSATIONAL_UNITS_COMMITTED_EVENT_IS_IMMUTABLE', ['55000']);
  }
  assert.deepEqual((await eventsOfSession(populatedSession))[0], event, 'no mutation attempt changed the delivery event');
  assert.ok(owner);
}

// ------------------------------------------------------- application ACL gate
async function verifyRuntimeAcl(owner, populatedSession) {
  stage = 'runtime ACL (cases 18, 19, 20, 21, 22, 23)';
  const turns = await completedTurns(owner, populatedSession);
  for (const role of ['anon', 'authenticated']) {
    await identity(role, role === 'authenticated' ? owner : null);
    await rejected(() => commit(populatedSession, owner, turns.userTurn, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]),
      'permission denied', ['42501']);
    await rejected(() => exchange(populatedSession, owner, turns.userTurn, randomUUID(), [], turns.assistantTurn, randomUUID(), []),
      'permission denied', ['42501']);
    await rejected(() => rows('SELECT * FROM reserve_session_same_sp_event_v1($1,$2)', [populatedSession, owner]),
      'permission denied', ['42501']);
    await rejected(() => q('SELECT count(*) FROM public.session_semantic_clocks'), 'permission denied', ['42501']);
    await rejected(() => q('SELECT count(*) FROM public.conversation_unit_commit_events'), 'permission denied', ['42501']);
  }
  // service_role is the authorized producer caller and NOTHING else: it can run
  // the canonical authorities but can never write a table directly.
  await identity('service_role');
  await rejected(() => rows('SELECT * FROM reserve_session_same_sp_event_v1($1,$2)', [populatedSession, owner]),
    'permission denied', ['42501']);
  await rejected(() => q('UPDATE public.session_semantic_clocks SET current_sp=99 WHERE session_id=$1', [populatedSession]),
    'permission denied', ['42501']);
  await rejected(() => q("INSERT INTO public.conversation_unit_commit_events(commit_batch_id,user_id,session_id,source_turn_id,first_sp,last_sp,unit_count) VALUES($1,$2,$3,$4,1,1,1)",
    [randomUUID(), owner, populatedSession, turns.userTurn]), 'permission denied', ['42501']);
  await rejected(() => q("INSERT INTO public.conversation_units(id,user_id,session_id,source_turn_id,commit_batch_id,source_role,speaker_state,source_modality,ordinal_within_turn,source_span_start,source_span_end,committed_text,source_content_sha256,session_position) VALUES($1,$2,$3,$4,$5,'USER','RESOLVED','TEXT',0,0,3,'أنا',sha256(convert_to('x','UTF8')),1)",
    [randomUUID(), owner, populatedSession, turns.userTurn, randomUUID()]), 'permission denied', ['42501']);
  await identity('postgres');
  const beforeCount = (await spsOfSession(populatedSession)).length;
  await identity('service_role');
  const committed = await commit(populatedSession, owner, turns.userTurn, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]);
  assert.equal(committed.length, 1, 'service_role is the authorized caller of the canonical producer');
  assert.equal(committed[0].session_position, beforeCount + 1,
    'the service-role commit allocated exactly the next Session Position');
  await identity('postgres');
  assert.equal((await spsOfSession(populatedSession)).length, beforeCount + 1,
    'exactly one further committed CU exists');
}

// ------------------------------------------------ SP column structural gates
async function verifySpConstraints(owner) {
  stage = 'SP structural constraints (cases 15, 16, 17)';
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session);
  const committed = await commit(session, owner, turns.userTurn, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]);
  const template = committed[0];
  const insert = (sp) => q(
    'INSERT INTO public.conversation_units(id,user_id,session_id,source_turn_id,commit_batch_id,source_role,speaker_state,source_modality,ordinal_within_turn,source_span_start,source_span_end,committed_text,source_content_sha256,session_position) '
    + "VALUES($1,$2,$3,$4,$5,'USER','RESOLVED','TEXT',50,0,3,'أنا',sha256(convert_to('x','UTF8')),$6)",
    [randomUUID(), template.user_id, template.session_id, template.source_turn_id, template.commit_batch_id, sp]);
  // Case 15: a duplicate (session_id, session_position) is impossible.
  await rejected(() => insert(1), 'conversation_units_session_sp_unique', ['23505']);
  // Case 16: SP cannot be null on a committed CU.
  await rejected(() => insert(null), 'session_position', ['23502']);
  // Case 17: SP cannot be zero or negative.
  await rejected(() => insert(0), 'conversation_units_session_position_check', ['23514']);
  await rejected(() => insert(-1), 'conversation_units_session_position_check', ['23514']);
  // The clock itself refuses SP(0).
  await rejected(() => q('UPDATE public.session_semantic_clocks SET current_sp=0 WHERE session_id=$1', [session]),
    'session_semantic_clocks_current_sp_check', ['23514']);
}

// ------------------------------------------- migration-time activation guard
async function verifyActivationGuard(owner) {
  stage = 'activation guard (case 43)';
  const migration = readFileSync(new URL('./migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql', import.meta.url), 'utf8')
    .replace(/\r\n/gu, '\n');
  const start = migration.indexOf('DO $$BEGIN\n  IF current_setting');
  const end = migration.indexOf('END$$;', start) + 'END$$;'.length;
  assert.ok(start > 0 && end > start, 'the activation precondition block was located in the migration');
  const guard = migration.slice(start, end);
  assert.ok(guard.includes('refuses to activate over pre-existing committed conversational units'),
    'the located block is the activation precondition guard');

  // With a committed CU present the guard must refuse, so no future re-run of
  // the activation can backfill a guessed Session Position.
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session);
  await commit(session, owner, turns.userTurn, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]);
  await rejected(() => q(guard), 'refuses to activate over pre-existing committed conversational units', ['55000']);
}

// ------------------------------------------------- one clock row per Session
async function verifyClockProvisioning(owner) {
  stage = 'clock provisioning (cases 44, 45)';
  const session = randomUUID();
  await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [session, owner]);
  assert.equal((await rows('SELECT * FROM public.session_semantic_clocks WHERE session_id=$1', [session])).length, 1,
    'exactly one clock row followed the Session insertion');
  // Case 45: a duplicate Session identity attempt can never create a second
  // clock row - the Session primary key refuses it, and the provisioning insert
  // is conflict-safe on its own.
  await rejected(() => q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [session, owner]),
    'conversation_sessions_pkey', ['23505']);
  assert.equal((await rows('SELECT * FROM public.session_semantic_clocks WHERE session_id=$1', [session])).length, 1,
    'still exactly one clock row');
  const [{ count: orphans }] = await rows(
    'SELECT count(*) count FROM public.conversation_sessions s WHERE NOT EXISTS (SELECT 1 FROM public.session_semantic_clocks c WHERE c.session_id = s.id)');
  assert.equal(Number(orphans), 0, 'every Session has a Session Semantic Clock');
}

// --------------------------------------------------------------- concurrency
async function verifyConcurrency() {
  stage = 'concurrency (cases 13, 14)';
  const owner = randomUUID();
  const session = randomUUID();
  const clientA = new Client({ connectionString: databaseUrl });
  const clientB = new Client({ connectionString: databaseUrl });
  const turnOne = randomUUID();
  const turnTwo = randomUUID();
  const assistantOne = randomUUID();
  const assistantTwo = randomUUID();
  const CALL = 'SELECT * FROM commit_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)';
  const EXCHANGE = 'SELECT * FROM commit_finalized_exchange_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)';
  const first = spanOf(E1, 'أنا سبت الشغل امبارح.');
  const second = spanOf(E1, 'وبالمناسبة أحمد كلمني.');
  const third = spanOf(E1, 'ممكن نرجع لموضوع السفر؟');
  try {
    await q('INSERT INTO auth.users(id) VALUES($1)', [owner]);
    await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [session, owner]);
    for (const [id, role, source] of [[turnOne, 'USER', null], [assistantOne, 'ASSISTANT', turnOne],
      [turnTwo, 'USER', null], [assistantTwo, 'ASSISTANT', turnTwo]]) {
      await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,source_turn_id) VALUES($1,$2,$3,$4,'COMPLETED',$5,$6)",
        [id, session, owner, role, E1, source]);
    }
    await clientA.connect(); await clientB.connect();

    // Case 13: two concurrent commits in the same Session serialize on the
    // Session Semantic Clock; neither duplicates nor gaps a Session Position.
    await clientA.query('BEGIN');
    const held = await clientA.query(CALL, [session, owner, turnOne, randomUUID(),
      JSON.stringify([{ unit_id: randomUUID(), span_start: first.start, span_end: first.end }]), ...PROVENANCE]);
    assert.equal(held.rows[0].session_position, 1, 'the first commit allocated SP(1) inside the open transaction');

    const pending = clientB.query(CALL, [session, owner, turnTwo, randomUUID(),
      JSON.stringify([{ unit_id: randomUUID(), span_start: second.start, span_end: second.end }]), ...PROVENANCE]);
    pending.catch(() => undefined);
    const raced = await Promise.race([
      pending.then(() => 'COMPLETED', () => 'COMPLETED'),
      new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), 750)),
    ]);
    assert.equal(raced, 'BLOCKED', 'the concurrent Session commit blocks on the Session Semantic Clock instead of racing');
    await clientA.query('COMMIT');
    const serialized = await pending;
    assert.equal(serialized.rows[0].session_position, 2, 'the serialized commit took the next Session Position');

    // Case 14: two concurrent atomic exchanges cannot interleave inside either
    // exchange - one completes entirely before the other starts allocating.
    await clientA.query('BEGIN');
    const exchangeA = await clientA.query(EXCHANGE, [session, owner, turnOne, randomUUID(),
      JSON.stringify([{ unit_id: randomUUID(), span_start: second.start, span_end: second.end }]),
      assistantOne, randomUUID(),
      JSON.stringify([{ unit_id: randomUUID(), span_start: first.start, span_end: first.end },
        { unit_id: randomUUID(), span_start: second.start, span_end: second.end }]), ...PROVENANCE]);
    assert.deepEqual(exchangeA.rows[0].user_units.map((row) => row.session_position), [3]);
    assert.deepEqual(exchangeA.rows[0].assistant_units.map((row) => row.session_position), [4, 5]);

    const pendingExchange = clientB.query(EXCHANGE, [session, owner, turnTwo, randomUUID(),
      JSON.stringify([{ unit_id: randomUUID(), span_start: third.start, span_end: third.end }]),
      assistantTwo, randomUUID(),
      JSON.stringify([{ unit_id: randomUUID(), span_start: first.start, span_end: first.end }]), ...PROVENANCE]);
    pendingExchange.catch(() => undefined);
    const racedExchange = await Promise.race([
      pendingExchange.then(() => 'COMPLETED', () => 'COMPLETED'),
      new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), 750)),
    ]);
    assert.equal(racedExchange, 'BLOCKED', 'a concurrent exchange blocks on the same Session clock and cannot interleave');
    await clientA.query('COMMIT');
    const exchangeB = await pendingExchange;
    assert.deepEqual(exchangeB.rows[0].user_units.map((row) => row.session_position), [6],
      'the second exchange started strictly after the first finished');
    assert.deepEqual(exchangeB.rows[0].assistant_units.map((row) => row.session_position), [7]);

    const final = (await q('SELECT session_position FROM public.conversation_units WHERE session_id=$1 ORDER BY session_position', [session]))
      .rows.map((row) => row.session_position);
    assert.deepEqual(final, [1, 2, 3, 4, 5, 6, 7], 'the Session sequence is gapless and duplicate-free after the race');
    const [{ current_sp: head }] = (await q('SELECT current_sp FROM public.session_semantic_clocks WHERE session_id=$1', [session])).rows;
    assert.equal(head, 7, 'LH equals the greatest committed Session Position after the race');
  } finally {
    await clientA.end().catch(() => undefined);
    await clientB.end().catch(() => undefined);
    // Cleanup must bypass the append-only triggers. session_replication_role is
    // superuser-only, session-scoped, and changes no schema.
    await q("SET session_replication_role = 'replica'").catch(() => undefined);
    await q('DELETE FROM public.conversation_unit_commit_events WHERE session_id=$1', [session]).catch(() => undefined);
    await q('DELETE FROM public.conversation_units WHERE session_id=$1', [session]).catch(() => undefined);
    await q('DELETE FROM public.conversation_unit_commit_batches WHERE session_id=$1', [session]).catch(() => undefined);
    await q('DELETE FROM public.session_semantic_clocks WHERE session_id=$1', [session]).catch(() => undefined);
    await q('DELETE FROM public.conversation_turns WHERE session_id=$1', [session]).catch(() => undefined);
    await q('DELETE FROM public.conversation_sessions WHERE id=$1', [session]).catch(() => undefined);
    await q('DELETE FROM public.users WHERE id=$1', [owner]).catch(() => undefined);
    await q('DELETE FROM auth.users WHERE id=$1', [owner]).catch(() => undefined);
    await q("SET session_replication_role = 'origin'").catch(() => undefined);
    const [{ count: residue }] = await rows('SELECT count(*) count FROM public.session_semantic_clocks WHERE session_id=$1', [session]);
    assert.equal(Number(residue), 0, 'the concurrency proof left zero fixture residue');
  }
}

async function main() {
  try {
    await client.connect();
    await verifyStaticAuthority();
    await q('BEGIN');
    try {
      await identity('postgres');
      const owner = randomUUID();
      const other = randomUUID();
      await q('INSERT INTO auth.users(id) VALUES($1),($2)', [owner, other]);

      const { session, sourceTurn, oneBatch } = await verifyAllocation(owner);
      await verifySealingAndReplay(owner, session, sourceTurn, oneBatch);
      await verifySameSpSeam(owner);
      const exchangeSession = await verifyExchangeCoordinator(owner);
      await verifyFinalizedExchangeRelation(owner);
      await verifyLiveHeadAndReads(owner, other, exchangeSession);
      await verifyDeliveryAppendOnly(owner, exchangeSession);
      await verifySpConstraints(owner);
      await verifyClockProvisioning(owner);
      await verifyActivationGuard(owner);
      await verifyRuntimeAcl(owner, exchangeSession);
      await identity('postgres');
    } finally { await q('ROLLBACK'); }
    await verifyConcurrency();
    console.log('Verified migration 0065: gapless per-Session SP allocation under the AF66-01 clock lock, derived sealing with no second mutable authority, LH = current_sp and never 0, the atomic USER -> ASSISTANT exchange with no interleaving SP and a finalized-exchange relation derived from the locked source rows rather than the parameter names, the dedicated append-only ConversationalUnitsCommitted delivery surface with exact one-event-per-non-zero-batch idempotency, the internal same-SP seam failing closed before SP(1) and executable by no application role, the service_role-only activation grant, owner-scoped temporal reads that cannot cross users, an intact T-03A1 substrate and runtime_event_outbox contract, and zero fixture residue.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Session Semantic Clock verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
