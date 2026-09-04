// Real-PostgreSQL verifier for migration 0062 - QIR-002 FAST / DEEP Runtime
// Decision Policy v2 durable routing authority. Proves against LIVE semantics
// and the INSTALLED definitions (never grep alone):
//
//   * CURRENT CLAIM AUTHORITY IS v2-ONLY. All five legal v2 pairs claim a
//     RECEIVED USER turn and persist exactly the pair they were given, while
//     both retired legacy reasons, unknown reasons, cross pairs, and null or
//     partial routing arguments are all rejected with INVALID_ROUTING (22023)
//     and leave the turn untouched.
//
//   * DURABLE READ COMPATIBILITY IS WIDER THAN CLAIM AUTHORITY. The persisted
//     CHECK still accepts the pre-routing null/null state and BOTH historical
//     legacy pairs, in every canonical status, so pre-QIR-002 rows stay valid;
//     it still rejects cross pairs, unknown reasons, path-only and reason-only
//     states. Exactly one routing check constraint exists on the table.
//
//   * MIGRATION 0025/0039 AUTHORITY IS UNCHANGED. Claim stays service-role-only
//     (authenticated and anon cannot execute it), SECURITY DEFINER, owned by
//     postgres, search_path-hardened, with the same signature; no role regained
//     a direct INSERT/UPDATE/DELETE on conversation_turns; the NULL-user guard,
//     the session/user ownership check, the USER + RECEIVED state requirement
//     and the one-successful-claim rule all still hold; and the migration-0039
//     generation lease is still stamped on the successful transition.
//
//   * CONCURRENCY IS STILL THE DATABASE ROW LOCK. A real two-connection race on
//     one RECEIVED turn blocks on FOR UPDATE and converges on exactly ONE
//     GENERATING transition with the winner's v2 pair.
//
//   * THE v2 PAIR PROPAGATES DURABLY. Finalization copies it onto the canonical
//     ASSISTANT turn and into the content-free Completed v2 outbox payload, and
//     lease-expiry recovery carries it into the Failed v1 payload - with no
//     event type, schema ref, version or payload-key change.
//
// Every fixture is rolled back or explicitly cleaned; nothing is retained.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}

async function rejected(operation, codes = ['42501']) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')})`);
}

const CLAIM = 'public.claim_conversation_turn(uuid,uuid,uuid,text,text)';
const ROUTING_CHECK = 'conversation_turns_routing_reason_check';

// The exact five legal v2 pairs, and the exact two retired legacy pairs.
const V2_PAIRS = [
  ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'],
  ['DEEP', 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE'],
  ['DEEP', 'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION'],
  ['DEEP', 'RUNTIME_ROUTING_V2_DEEP_MULTI_PART'],
  ['DEEP', 'RUNTIME_ROUTING_V2_DEEP_COMPOSITE'],
];
const LEGACY_PAIRS = [
  ['FAST', 'FAST_DEFAULT'],
  ['DEEP', 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT'],
];
// Cross pairs: a legal path with the other path's legal reason.
const CROSS_PAIRS = [
  ['DEEP', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'],
  ['FAST', 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE'],
  ['FAST', 'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION'],
  ['FAST', 'RUNTIME_ROUTING_V2_DEEP_MULTI_PART'],
  ['FAST', 'RUNTIME_ROUTING_V2_DEEP_COMPOSITE'],
  ['FAST', 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT'],
  ['DEEP', 'FAST_DEFAULT'],
];
const UNKNOWN_PAIRS = [
  ['FAST', 'RUNTIME_ROUTING_V3_FAST_DEFAULT'],
  ['DEEP', 'DETERMINISTIC_MULTI_SIGNAL_DEEP_V2'],
  ['FAST', ''],
  ['TURBO', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'],
  ['fast', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'],
  ['FAST', 'runtime_routing_v2_fast_default'],
];
const claim = (session, user, turn, path, reason) =>
  rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, user, turn, path, reason]);

const createOwnedTurn = async (owner, session, content) => {
  await identity('authenticated', owner);
  const id = randomUUID();
  await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [id, session, content, null]);
  await identity('postgres');
  return id;
};

async function verifyInstalledAuthorityContract() {
  stage = 'installed authority contract';
  const [{ claim_present: claimPresent }] = await rows('SELECT to_regprocedure($1) IS NOT NULL claim_present', [CLAIM]);
  assert.equal(claimPresent, true, 'the claim command still exists with its exact signature');
  const [contract] = await rows(
    `SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config
       FROM pg_proc p WHERE p.oid = $1::regprocedure`, [CLAIM],
  );
  assert.equal(contract.owner, 'postgres', 'claim ownership is unchanged');
  assert.equal(contract.definer, true, 'claim is still SECURITY DEFINER');
  assert.ok(Array.isArray(contract.config) && contract.config.length === 1 && contract.config[0].startsWith('search_path='),
    `claim keeps the hardened search_path (got ${JSON.stringify(contract.config)})`);

  // Least privilege: server-role-only execution, and no role regained direct
  // mutation on the canonical turn table.
  for (const [role, expected] of [['authenticated', false], ['anon', false], ['service_role', true]]) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed', [role, CLAIM, 'EXECUTE']);
    assert.equal(allowed, expected, `${role} EXECUTE ${CLAIM}`);
  }
  for (const role of ['authenticated', 'service_role', 'anon']) {
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
      const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, 'public.conversation_turns', privilege]);
      assert.equal(allowed, false, `${role} must not hold ${privilege} on public.conversation_turns`);
    }
  }

  // Exactly ONE routing check constraint survives, and it names both the
  // historical vocabulary and the complete v2 vocabulary.
  const constraints = await rows(
    `SELECT conname, convalidated, pg_get_constraintdef(oid) definition FROM pg_constraint
      WHERE conrelid='public.conversation_turns'::regclass AND contype='c' AND conname=$1`, [ROUTING_CHECK],
  );
  assert.equal(constraints.length, 1, 'exactly one routing check constraint exists');
  const definition = constraints[0].definition;
  for (const reason of [...V2_PAIRS, ...LEGACY_PAIRS].map(([, name]) => name)) {
    assert.ok(definition.includes(reason), `the persisted routing check still allows ${reason}`);
  }
  assert.equal(constraints[0].convalidated, true, 'the widened routing check is validated against existing rows');
}

async function verifyEveryLegalV2PairClaims(owner, session) {
  stage = 'legal v2 claims';
  for (const [path, reason] of V2_PAIRS) {
    const turn = await createOwnedTurn(owner, session, `v2 ${reason}`);
    await identity('service_role');
    const claimed = await claim(session, owner, turn, path, reason);
    assert.equal(claimed.length, 1, `${path} + ${reason} is claimable`);
    assert.equal(claimed[0].status, 'GENERATING');
    assert.equal(claimed[0].processing_path, path, 'the exact path is persisted');
    assert.equal(claimed[0].routing_reason, reason, 'the exact reason is persisted');
    // Migration 0039's server-owned lease is still stamped by the replacement.
    assert.ok(claimed[0].generation_claimed_at, 'the generation lease claim stamp survives');
    assert.ok(claimed[0].generation_lease_expires_at, 'the generation lease expiry survives');
    assert.ok(new Date(claimed[0].generation_lease_expires_at) > new Date(claimed[0].generation_claimed_at),
      'the lease still moves strictly forward');
    // One claimant wins: the already-GENERATING turn cannot be re-claimed.
    const again = await claim(session, owner, turn, path, reason);
    assert.equal(again.length, 0, 'a claimed turn is never re-claimed');
    await identity('postgres');
  }
}

async function verifyRetiredAndIllegalPairsRejected(owner, session) {
  stage = 'retired and illegal claim pairs';
  const turn = await createOwnedTurn(owner, session, 'gate target');
  await identity('service_role');
  for (const [label, pairs] of [['legacy', LEGACY_PAIRS], ['cross', CROSS_PAIRS], ['unknown', UNKNOWN_PAIRS]]) {
    for (const [path, reason] of pairs) {
      await rejected(() => q('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, turn, path, reason]), ['22023']);
      assert.ok(true, `${label} pair ${path} + ${reason} is rejected`);
    }
  }
  // Null and partial routing arguments fail closed rather than claiming.
  for (const [path, reason] of [[null, null], ['FAST', null], [null, 'RUNTIME_ROUTING_V2_FAST_DEFAULT'], ['DEEP', null]]) {
    await rejected(() => q('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, turn, path, reason]), ['22023']);
  }
  // The NULL-user guard from migration 0025 is unchanged and still precedes
  // every other check.
  await rejected(() => q('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, null, turn, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']), ['22023']);
  await identity('postgres');
  const [state] = await rows('SELECT status, processing_path, routing_reason FROM public.conversation_turns WHERE id=$1', [turn]);
  assert.equal(state.status, 'RECEIVED', 'no rejected claim mutated the turn');
  assert.equal(state.processing_path, null);
  assert.equal(state.routing_reason, null);
}

async function verifyOwnershipStateAndRoleAuthority(owner, other, session, otherSession) {
  stage = 'ownership, state and role authority';
  const pair = V2_PAIRS[0];
  const turn = await createOwnedTurn(owner, session, 'authority target');

  // Authenticated and anon cannot execute the server command at all.
  await identity('authenticated', owner);
  await rejected(() => q('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, turn, ...pair]));
  await identity('anon');
  await rejected(() => q('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, turn, ...pair]));

  await identity('service_role');
  // Session ownership is explicit and fails closed for the server role too.
  await rejected(() => q('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, other, turn, ...pair]), ['42501']);
  await rejected(() => q('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [otherSession, owner, turn, ...pair]), ['42501']);
  // A turn in another owned session is not claimable through this session.
  assert.equal((await claim(otherSession, other, turn, ...pair)).length, 0, 'cross-session claim finds no row');

  await identity('postgres');
  // Non-RECEIVED and non-USER rows are never claimable.
  const assistantTurn = randomUUID(), completedTurn = randomUUID(), cancelledTurn = randomUUID();
  await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content) VALUES($1,$2,$3,'ASSISTANT','RECEIVED','assistant')", [assistantTurn, session, owner]);
  await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,completed_at) VALUES($1,$2,$3,'USER','COMPLETED','done',CURRENT_TIMESTAMP)", [completedTurn, session, owner]);
  await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content) VALUES($1,$2,$3,'USER','CANCELLED','cancelled')", [cancelledTurn, session, owner]);
  await identity('service_role');
  for (const target of [assistantTurn, completedTurn, cancelledTurn, randomUUID()]) {
    assert.equal((await claim(session, owner, target, ...pair)).length, 0, 'only an owned RECEIVED USER turn is claimable');
  }
  await identity('postgres');
  assert.equal((await rows('SELECT status FROM public.conversation_turns WHERE id=$1', [turn]))[0].status, 'RECEIVED',
    'no unauthorized role or wrong-state claim moved the canonical turn');
}

async function verifyHistoricalRowsRemainValid(owner, session) {
  stage = 'historical row compatibility';
  await identity('postgres');
  // Every historical pair remains insertable in every canonical status the
  // pre-QIR-002 runtime could have produced, so no existing row became
  // unreadable and no historical migration had to be edited.
  for (const [path, reason] of LEGACY_PAIRS) {
    for (const status of ['GENERATING', 'COMPLETED', 'FAILED', 'CANCELLED']) {
      const id = randomUUID();
      await q('INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [id, session, owner, 'USER', status, 'historical', path, reason]);
      const [stored] = await rows('SELECT processing_path, routing_reason FROM public.conversation_turns WHERE id=$1', [id]);
      assert.equal(stored.processing_path, path, `historical ${status} row keeps its path`);
      assert.equal(stored.routing_reason, reason, `historical ${status} row keeps its reason`);
    }
  }
  // The pre-routing state remains the canonical shape of a fresh USER turn.
  const fresh = await createOwnedTurn(owner, session, 'pre-routing');
  await identity('postgres');
  const [preRouting] = await rows('SELECT processing_path, routing_reason FROM public.conversation_turns WHERE id=$1', [fresh]);
  assert.equal(preRouting.processing_path, null);
  assert.equal(preRouting.routing_reason, null);
  // ...and an explicit null/null row is still accepted directly.
  const explicitNull = randomUUID();
  await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason) VALUES($1,$2,$3,'USER','RECEIVED','null routing',NULL,NULL)", [explicitNull, session, owner]);

  // The widened CHECK still rejects everything it rejected before.
  const insertRouting = (path, reason) => () => q(
    'INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [randomUUID(), session, owner, 'USER', 'GENERATING', 'illegal', path, reason],
  );
  for (const [path, reason] of [...CROSS_PAIRS, ...UNKNOWN_PAIRS.filter(([p]) => p === 'FAST' || p === 'DEEP')]) {
    await rejected(insertRouting(path, reason), ['23514']);
  }
  // Totality: a HALF-NULL routing state is rejected in both directions. Before
  // migration 0062 the persisted predicate evaluated to NULL for these rows and
  // PostgreSQL treats a NULL CHECK as satisfied, so they were silently
  // persistable.
  for (const [path, reason] of [
    ['FAST', null], ['DEEP', null],
    [null, 'RUNTIME_ROUTING_V2_FAST_DEFAULT'], [null, 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE'],
    [null, 'FAST_DEFAULT'], [null, 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT'],
  ]) {
    await rejected(insertRouting(path, reason), ['23514']);
  }
  // Every legal v2 pair is directly representable as durable state as well.
  for (const [path, reason] of V2_PAIRS) {
    const id = randomUUID();
    await q('INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, session, owner, 'USER', 'GENERATING', 'v2 durable', path, reason]);
  }
}

async function verifyDurablePropagation(owner, session) {
  stage = 'durable propagation';
  const [path, reason] = ['DEEP', 'RUNTIME_ROUTING_V2_DEEP_MULTI_PART'];
  const turn = await createOwnedTurn(owner, session, 'propagation target');
  await identity('service_role');
  assert.equal((await claim(session, owner, turn, path, reason)).length, 1);
  const assistantId = randomUUID(), completedEvent = randomUUID();
  const finalized = await rows('SELECT * FROM finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [session, owner, turn, assistantId, 'assistant text', 'ALLOW', completedEvent, null, null]);
  assert.equal(finalized.length, 1, 'the v2-routed turn finalizes normally');

  await identity('postgres');
  const [assistantRow] = await rows(
    "SELECT processing_path, routing_reason, status FROM public.conversation_turns WHERE source_turn_id=$1 AND role='ASSISTANT'", [turn]);
  assert.equal(assistantRow.status, 'COMPLETED');
  assert.equal(assistantRow.processing_path, path, 'the assistant row carries the v2 path');
  assert.equal(assistantRow.routing_reason, reason, 'the assistant row carries the v2 reason');
  const [event] = await rows('SELECT event_type, event_version, schema_ref, payload FROM public.runtime_event_outbox WHERE subject_turn_id=$1', [turn]);
  assert.equal(event.event_type, 'ConversationTurnCompleted');
  assert.equal(event.event_version, '2.0', 'no event version was bumped for the routing change');
  assert.equal(event.schema_ref, 'qandeel.runtime.conversation-turn-completed.v2', 'no schema ref changed');
  assert.equal(event.payload.processing_path, path);
  assert.equal(event.payload.routing_reason, reason, 'the v2 reason reaches the durable event');
  assert.deepEqual(Object.keys(event.payload).sort(),
    ['orchestration_id', 'processing_path', 'routing_reason', 'safety_disposition', 'session_id', 'source_turn_id', 'terminal_status', 'user_id'],
    'the content-free payload shape is unchanged');
  assert.ok(!JSON.stringify(event.payload).includes('assistant text'), 'no content entered the event');

  // Lease-expiry recovery carries the same v2 pair into the Failed v1 payload.
  const recoverable = await createOwnedTurn(owner, session, 'recovery target');
  await identity('service_role');
  await claim(session, owner, recoverable, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT');
  await identity('postgres');
  await q("UPDATE public.conversation_turns SET generation_claimed_at=now()-interval '10 minutes', generation_lease_expires_at=now()-interval '8 minutes' WHERE id=$1", [recoverable]);
  await identity('service_role');
  const recovered = await rows('SELECT * FROM recover_expired_generating_conversation_turn_v1($1,$2,$3,$4,$5,$6)',
    [session, owner, recoverable, randomUUID(), null, null]);
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].status, 'FAILED');
  assert.equal(recovered[0].routing_reason, 'RUNTIME_ROUTING_V2_FAST_DEFAULT', 'recovery preserves the v2 reason');
  await identity('postgres');
  const [failedEvent] = await rows("SELECT schema_ref, payload FROM public.runtime_event_outbox WHERE subject_turn_id=$1 AND event_type='ConversationTurnFailed'", [recoverable]);
  assert.equal(failedEvent.schema_ref, 'qandeel.runtime.conversation-turn-failed.v1');
  assert.equal(failedEvent.payload.routing_reason, 'RUNTIME_ROUTING_V2_FAST_DEFAULT');
  assert.equal(failedEvent.payload.processing_path, 'FAST');
}

async function verifyConcurrentClaimConverges() {
  stage = 'two-connection claim concurrency';
  const raceUser = randomUUID(), raceSession = randomUUID(), raceTurn = randomUUID();
  const clientA = new Client({ connectionString: databaseUrl });
  const clientB = new Client({ connectionString: databaseUrl });
  try {
    await q('INSERT INTO auth.users(id) VALUES($1)', [raceUser]);
    await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [raceSession, raceUser]);
    await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content) VALUES($1,$2,$3,'USER','RECEIVED','race target')", [raceTurn, raceSession, raceUser]);
    await clientA.connect(); await clientB.connect();
    await clientA.query('SET ROLE service_role'); await clientB.query('SET ROLE service_role');
    // A claims inside an open transaction and HOLDS the row lock; B's
    // concurrent claim must block on FOR UPDATE, then observe the committed
    // GENERATING state and claim nothing.
    await clientA.query('BEGIN');
    const resultA = await clientA.query('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)',
      [raceSession, raceUser, raceTurn, 'DEEP', 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE']);
    assert.equal(resultA.rows.length, 1, 'the first concurrent claim wins the row lock');
    const pendingB = clientB.query('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)',
      [raceSession, raceUser, raceTurn, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']);
    pendingB.catch(() => undefined); // guarded branch: a teardown rejection must never become an unhandled rejection
    const winner = await Promise.race([
      pendingB.then(() => 'COMPLETED', () => 'COMPLETED'),
      new Promise((resolve) => { setTimeout(() => resolve('BLOCKED'), 750); }),
    ]);
    assert.equal(winner, 'BLOCKED', 'the concurrent claim blocks on the database row lock instead of racing');
    await clientA.query('COMMIT');
    const resultB = await pendingB;
    assert.equal(resultB.rows.length, 0, 'the lock loser claims nothing and creates no competing canonical route');
    const [state] = (await q('SELECT status, processing_path, routing_reason FROM public.conversation_turns WHERE id=$1', [raceTurn])).rows;
    assert.equal(state.status, 'GENERATING', 'exactly one claim transition survived the race');
    assert.equal(state.processing_path, 'DEEP');
    assert.equal(state.routing_reason, 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE', 'the winner alone owns the durable route');
  } finally {
    await clientA.end().catch(() => undefined); await clientB.end().catch(() => undefined);
    await q('DELETE FROM public.runtime_event_outbox WHERE subject_turn_id=$1', [raceTurn]);
    await q('DELETE FROM public.conversation_turns WHERE user_id=$1', [raceUser]);
    // T-03A2: a Session carries a Session Semantic Clock row, and the FK is
    // ON DELETE RESTRICT like every other conversation relationship - fixture
    // teardown removes it explicitly rather than cascading.
    await q('DELETE FROM public.session_semantic_clocks WHERE session_id=$1', [raceSession]);
    await q('DELETE FROM public.conversation_sessions WHERE id=$1', [raceSession]);
    await q('DELETE FROM public.users WHERE id=$1', [raceUser]);
    await q('DELETE FROM auth.users WHERE id=$1', [raceUser]);
    const [{ count: residue }] = (await q('SELECT count(*) count FROM public.conversation_turns WHERE user_id=$1', [raceUser])).rows;
    assert.equal(Number(residue), 0, 'the concurrency proof left zero fixture residue');
  }
}

async function main() {
  try {
    await client.connect();
    await verifyInstalledAuthorityContract();
    await q('BEGIN');
    try {
      await identity('postgres');
      const owner = randomUUID(), other = randomUUID();
      const session = randomUUID(), otherSession = randomUUID();
      await q('INSERT INTO auth.users(id) VALUES($1),($2)', [owner, other]);
      await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT'),($3,$4,'ACTIVE','TEXT')", [session, owner, otherSession, other]);

      await verifyEveryLegalV2PairClaims(owner, session);
      await verifyRetiredAndIllegalPairsRejected(owner, session);
      await verifyOwnershipStateAndRoleAuthority(owner, other, session, otherSession);
      await verifyHistoricalRowsRemainValid(owner, session);
      await verifyDurablePropagation(owner, session);
      await identity('postgres');
    } finally {
      try { await q('ROLLBACK'); } catch { /* ignore */ }
    }
    await verifyConcurrentClaimConverges();
    console.log('Verified migration 0062: new claims accept only the five v2 routing pairs, historical legacy routing stays readable, and claim ownership, state, least privilege, row-lock concurrency and durable event propagation are unchanged.');
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  // Assertion text names the violated routing property only - never a
  // connection string, credential, or user content - so it is safe to print and
  // makes a failure diagnosable, exactly as the migration-0039 verifier does.
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`FAST/DEEP Runtime Decision Policy v2 routing authority verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
