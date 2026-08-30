// Real-PostgreSQL verifier for migration 0039 - Foreground GENERATING Turn
// Recovery v1. Proves, against live semantics (never grep alone): the frozen
// 120-second server-owned generation lease stamped by the unchanged-signature
// claim command; live leases are never recovered early; expired GENERATING
// terminalizes to FAILED atomically with exactly one canonical content-free
// ConversationTurnFailed v1 outbox event and no assistant; recovery is
// idempotent; late finalization/failure cannot mutate the recovered terminal
// turn; terminal and cross-tenant rows are unrecoverable; legacy/null-lease
// GENERATING rows use the bounded updated_at fallback fail-closed; recovery is
// service-role-only; and a real two-connection row-lock race converges on one
// FAILED transition with one outbox event. No model/provider concept exists
// anywhere in the path and nothing is replayed.
import assert from 'node:assert/strict'; import { randomUUID } from 'node:crypto'; import process from 'node:process'; import pg from 'pg';
const { Client } = pg; const databaseUrl = process.env.DATABASE_URL; if (!databaseUrl) throw new Error('DATABASE_URL is required in the ignored local .env file.');
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

const RECOVER = 'public.recover_expired_generating_conversation_turn_v1(uuid,uuid,uuid,uuid,uuid,uuid)';
const CLAIM = 'public.claim_conversation_turn(uuid,uuid,uuid,text,text)';
const LEASE_FN = 'public.foreground_generation_lease_interval_v1()';
const FAILED_PAYLOAD_KEYS = ['orchestration_id', 'processing_path', 'routing_reason', 'session_id', 'source_turn_id', 'terminal_status', 'user_id'];

const recover = (session, user, turn, eventId = randomUUID(), correlationId = null, orchestrationId = null) =>
  rows('SELECT * FROM recover_expired_generating_conversation_turn_v1($1,$2,$3,$4,$5,$6)', [session, user, turn, eventId, correlationId, orchestrationId]);
const assistantCount = async (turn) => Number((await rows("SELECT count(*) count FROM public.conversation_turns WHERE source_turn_id=$1 AND role='ASSISTANT'", [turn]))[0].count);
const outboxRows = (type, turn) => rows('SELECT * FROM public.runtime_event_outbox WHERE event_type=$1 AND subject_turn_id=$2', [type, turn]);
const createOwnedTurn = async (owner, session, content, idempotencyKey = null) => {
  await identity('authenticated', owner);
  const id = randomUUID();
  await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [id, session, content, idempotencyKey]);
  await identity('postgres');
  return id;
};
const expireLease = (turn) => q("UPDATE public.conversation_turns SET generation_claimed_at=now()-interval '10 minutes', generation_lease_expires_at=now()-interval '8 minutes' WHERE id=$1", [turn]);

async function verifyStaticAuthority() {
  stage = 'static authority';
  const [contract] = await rows(`SELECT
    to_regprocedure($1) IS NOT NULL recover_present,
    to_regprocedure($2) IS NOT NULL claim_present,
    to_regprocedure($3) IS NOT NULL lease_present,
    public.foreground_generation_lease_interval_v1() = interval '120 seconds' lease_exact,
    pg_get_functiondef(to_regprocedure($1)) recover_definition,
    pg_get_functiondef(to_regprocedure($2)) claim_definition`,
  [RECOVER, CLAIM, LEASE_FN]);
  assert.equal(contract.recover_present, true, 'recovery command present with the exact six-parameter signature');
  assert.equal(contract.claim_present, true, 'claim keeps its exact external signature');
  assert.equal(contract.lease_present, true, 'the single lease constant function exists');
  assert.equal(contract.lease_exact, true, 'the frozen v1 generation lease is exactly 120 seconds');
  for (const [name, definition] of [['recovery', contract.recover_definition], ['claim', contract.claim_definition]]) {
    assert.match(definition, /SECURITY DEFINER/u, `${name} is SECURITY DEFINER`);
    assert.match(definition, /search_path TO ''/u, `${name} search path is fixed empty`);
    assert.doesNotMatch(definition, /model|provider|openai|anthropic|http|fetch/iu, `${name} carries no model/provider concept`);
  }
  assert.doesNotMatch(contract.recover_definition, /auth\.uid|request\.jwt/iu, 'recovery derives no identity from caller claims: ownership is explicit');
  assert.match(contract.recover_definition, /status='GENERATING'/u, 'recovery only ever locks a GENERATING source turn');
  assert.doesNotMatch(contract.recover_definition, /'RECEIVED'/u, 'recovery never moves any turn back to RECEIVED');
  for (const [signature, expectations] of [
    [RECOVER, { service: true, authenticated: false, anon: false, public: false }],
    [CLAIM, { service: true, authenticated: false, anon: false, public: false }],
    [LEASE_FN, { service: false, authenticated: false, anon: false, public: false }],
  ]) {
    const [acl] = await rows("SELECT has_function_privilege('service_role',$1,'EXECUTE') service,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('public',$1,'EXECUTE') public", [signature]);
    assert.deepEqual(acl, expectations, `ACL mismatch for ${signature}`);
  }
  for (const signature of [RECOVER, CLAIM, LEASE_FN]) {
    const [{ owner }] = await rows('SELECT pg_get_userbyid(p.proowner) owner FROM pg_proc p WHERE p.oid=$1::regprocedure', [signature]);
    assert.equal(owner, 'postgres', `${signature} owner`);
  }
  const [columns] = await rows(`SELECT
    count(*) FILTER (WHERE column_name IN ('generation_claimed_at','generation_lease_expires_at') AND data_type='timestamp with time zone' AND is_nullable='YES') lease_columns
    FROM information_schema.columns WHERE table_schema='public' AND table_name='conversation_turns'`);
  assert.equal(Number(columns.lease_columns), 2, 'both nullable timestamptz lease columns exist');
  const [{ count: pairConstraint }] = await rows("SELECT count(*) count FROM pg_constraint WHERE conname='conversation_turns_generation_lease_pair_check' AND conrelid=to_regclass('public.conversation_turns')");
  assert.equal(Number(pairConstraint), 1, 'the bounded lease pair-integrity constraint exists');
  // Migration 0025 table authority is untouched: still no direct role DML.
  for (const role of ['authenticated', 'service_role', 'anon']) {
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
      const [{ allowed }] = await rows("SELECT has_table_privilege($1,'public.conversation_turns',$2) allowed", [role, privilege]);
      assert.equal(allowed, false, `${role} must not hold ${privilege} on conversation_turns`);
    }
  }
}

async function verifyLeaseClaim(owner, session) {
  stage = 'lease claim';
  const turn = await createOwnedTurn(owner, session, 'lease claim source', 'recovery-idem-1');
  await identity('service_role');
  const claimed = await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, turn, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']);
  assert.equal(claimed.length, 1, 'exactly one valid owner/server claim succeeds');
  assert.equal(claimed[0].status, 'GENERATING');
  assert.equal(claimed[0].processing_path, 'FAST');
  assert.equal(claimed[0].routing_reason, 'RUNTIME_ROUTING_V2_FAST_DEFAULT');
  // Migration 0062 narrowed NEW claims to the five v2 pairs: an invalid
  // pairing - and the retired legacy reason itself - is still rejected.
  await rejected(() => q('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, randomUUID(), 'FAST', 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT']), ['22023']);
  // One claimant wins: the same turn cannot be claimed twice.
  const reclaimed = await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, turn, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']);
  assert.equal(reclaimed.length, 0, 'a second claim on the same turn returns no row');
  await identity('postgres');
  const [lease] = await rows(`SELECT generation_claimed_at IS NOT NULL claimed_set,
    generation_lease_expires_at IS NOT NULL expires_set,
    (generation_lease_expires_at - generation_claimed_at) = interval '120 seconds' exact_lease,
    abs(extract(epoch FROM (generation_claimed_at - now()))) < 5 fresh_claim
    FROM public.conversation_turns WHERE id=$1`, [turn]);
  assert.deepEqual(lease, { claimed_set: true, expires_set: true, exact_lease: true, fresh_claim: true },
    'the successful claim stamps both lease timestamps with the exact frozen 120-second policy at transaction time');
  return turn;
}

async function verifyLiveGenerationIsNeverRecoveredEarly(owner, session, turn) {
  stage = 'live generation';
  await identity('service_role');
  const result = await recover(session, owner, turn);
  assert.equal(result.length, 0, 'recovery of a non-expired GENERATING turn returns no row');
  await identity('postgres');
  const [{ status }] = await rows('SELECT status FROM public.conversation_turns WHERE id=$1', [turn]);
  assert.equal(status, 'GENERATING', 'the live source turn remains GENERATING');
  assert.equal(await assistantCount(turn), 0, 'no assistant was created');
  assert.equal((await outboxRows('ConversationTurnFailed', turn)).length, 0, 'no failed outbox event was created');
}

async function verifyExpiredGenerationTerminalizes(owner, session, turn) {
  stage = 'expired generation';
  await identity('postgres');
  await expireLease(turn);
  const eventId = randomUUID(), correlationId = randomUUID(), orchestrationId = randomUUID();
  await identity('service_role');
  const result = await recover(session, owner, turn, eventId, correlationId, orchestrationId);
  assert.equal(result.length, 1, 'recovery returns the exact recovered source turn');
  assert.equal(result[0].id, turn);
  assert.equal(result[0].role, 'USER');
  assert.equal(result[0].status, 'FAILED', 'expired GENERATING transitions exactly to FAILED');
  assert.equal(result[0].content, 'lease claim source', 'the source turn content is untouched');
  assert.equal(result[0].idempotency_key, 'recovery-idem-1', 'the idempotency key is unchanged and stays bound to the failed turn');
  assert.equal(result[0].processing_path, 'FAST', 'the processing path is unchanged');
  assert.equal(result[0].routing_reason, 'RUNTIME_ROUTING_V2_FAST_DEFAULT', 'the routing reason is unchanged');
  assert.equal(result[0].completed_at, null, 'canonical fail semantics: completed_at stays null for FAILED');
  await identity('postgres');
  assert.equal(await assistantCount(turn), 0, 'no assistant exists after recovery');
  const events = await outboxRows('ConversationTurnFailed', turn);
  assert.equal(events.length, 1, 'exactly one ConversationTurnFailed outbox row exists');
  const event = events[0];
  assert.equal(event.event_id, eventId);
  assert.equal(event.event_version, '1.0', 'the existing v1 failed-event version is reused, never a new version');
  assert.equal(event.schema_ref, 'qandeel.runtime.conversation-turn-failed.v1');
  assert.equal(event.producer, 'conversation-service');
  assert.equal(event.contains_content, false);
  assert.equal(event.classification, 'SENSITIVE');
  assert.equal(event.correlation_id, correlationId);
  assert.deepEqual(Object.keys(event.payload).sort(), FAILED_PAYLOAD_KEYS, 'the exact canonical content-free payload vocabulary is reused');
  assert.deepEqual(
    { user: event.payload.user_id, session: event.payload.session_id, source: event.payload.source_turn_id, terminal: event.payload.terminal_status, path: event.payload.processing_path, reason: event.payload.routing_reason, orchestration: event.payload.orchestration_id },
    { user: owner, session, source: turn, terminal: 'FAILED', path: 'FAST', reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT', orchestration: orchestrationId },
    'the payload matches the canonical v1 failed-event schema');
  assert.doesNotMatch(JSON.stringify(event.payload), /lease claim source/u, 'the event stays content-free');
  return event;
}

async function verifyIdempotentRecoveryAndLateTerminalSafety(owner, session, turn) {
  stage = 'idempotent recovery';
  const [before] = await rows('SELECT to_jsonb(t) row FROM public.conversation_turns t WHERE id=$1', [turn]);
  await identity('service_role');
  const again = await recover(session, owner, turn);
  assert.equal(again.length, 0, 'repeated recovery after FAILED returns zero rows');
  await identity('postgres');
  const [after] = await rows('SELECT to_jsonb(t) row FROM public.conversation_turns t WHERE id=$1', [turn]);
  assert.deepEqual(after.row, before.row, 'repeated recovery mutates nothing');
  assert.equal((await outboxRows('ConversationTurnFailed', turn)).length, 1, 'no second failed outbox event exists');

  stage = 'late completion safety';
  await identity('service_role');
  const lateFinalize = await rows('SELECT * FROM finalize_conversation_turn($1,$2,$3,$4,$5,$6,$7,$8,$9)', [session, owner, turn, randomUUID(), 'late provider text', 'ALLOW', randomUUID(), null, null]);
  assert.equal(lateFinalize.length, 0, 'a late canonical finalization returns no completed pair');
  const lateFail = await rows('SELECT * FROM fail_conversation_turn($1,$2,$3,$4,$5,$6)', [session, owner, turn, randomUUID(), null, null]);
  assert.equal(lateFail.length, 0, 'a late canonical failure is a no-op on the recovered terminal turn');
  await identity('postgres');
  assert.equal(await assistantCount(turn), 0, 'no assistant is created after recovery');
  assert.equal((await outboxRows('ConversationTurnCompleted', turn)).length, 0, 'no ConversationTurnCompleted event appears');
  assert.equal((await outboxRows('ConversationTurnFailed', turn)).length, 1, 'the single failed event remains the only terminal event');
}

async function verifyTerminalAndForeignNoOps(owner, other, session, otherSession) {
  stage = 'terminal/no-op cases';
  // RECEIVED is never "recovered": recovery only applies to GENERATING.
  const received = await createOwnedTurn(owner, session, 'still received');
  await identity('service_role');
  assert.equal((await recover(session, owner, received)).length, 0, 'a RECEIVED turn cannot be recovered');
  await identity('postgres');
  assert.equal((await rows('SELECT status FROM public.conversation_turns WHERE id=$1', [received]))[0].status, 'RECEIVED');

  // COMPLETED cannot be recovered as stale generation.
  const completed = await createOwnedTurn(owner, session, 'to complete');
  await identity('service_role');
  await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, completed, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']);
  const finalized = await rows('SELECT * FROM finalize_conversation_turn($1,$2,$3,$4,$5,$6,$7,$8,$9)', [session, owner, completed, randomUUID(), 'assistant reply', 'ALLOW', randomUUID(), null, null]);
  assert.equal(finalized.length, 1, 'fixture finalization succeeded');
  assert.equal((await recover(session, owner, completed)).length, 0, 'a COMPLETED turn cannot be recovered');
  await identity('postgres');
  assert.equal(await assistantCount(completed), 1, 'the completed pair is untouched by the recovery attempt');
  assert.equal((await outboxRows('ConversationTurnFailed', completed)).length, 0);

  // CANCELLED cannot be recovered.
  const cancelled = await createOwnedTurn(owner, session, 'to cancel');
  await identity('authenticated', owner);
  await rows('SELECT * FROM cancel_conversation_turn($1,$2,$3,$4,$5,$6)', [session, owner, cancelled, randomUUID(), null, null]);
  await identity('service_role');
  assert.equal((await recover(session, owner, cancelled)).length, 0, 'a CANCELLED turn cannot be recovered');

  // Cross-tenant forgery fails closed: a caller cannot recover another
  // user's/session's turn even through the privileged channel.
  const foreign = await createOwnedTurn(owner, session, 'foreign target');
  await identity('service_role');
  await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, foreign, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']);
  await identity('postgres');
  await expireLease(foreign);
  await identity('service_role');
  await rejected(() => q('SELECT * FROM recover_expired_generating_conversation_turn_v1($1,$2,$3,$4,$5,$6)', [session, other, foreign, randomUUID(), null, null]));
  await rejected(() => q('SELECT * FROM recover_expired_generating_conversation_turn_v1($1,$2,$3,$4,$5,$6)', [session, null, foreign, randomUUID(), null, null]), ['22023']);
  assert.equal((await recover(otherSession, other, foreign)).length, 0, 'an owned foreign session cannot capture another tenant turn');
  assert.equal((await recover(session, owner, randomUUID())).length, 0, 'a mismatched source turn id recovers nothing');
  await identity('postgres');
  assert.equal((await rows('SELECT status FROM public.conversation_turns WHERE id=$1', [foreign]))[0].status, 'GENERATING', 'every rejected/no-op attempt left the expired turn intact');
  assert.equal((await outboxRows('ConversationTurnFailed', foreign)).length, 0);
}

async function verifyLegacyNullLeaseFallback(owner, session) {
  stage = 'legacy/null lease compatibility';
  await identity('postgres');
  // Verifier-only legacy fixtures under postgres authority: GENERATING rows
  // with NULL lease metadata, as historical or verifier-created edge rows.
  const staleLegacy = randomUUID(), freshLegacy = randomUUID();
  await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason,updated_at) VALUES($1,$2,$3,'USER','GENERATING','stale legacy','FAST','FAST_DEFAULT',now()-interval '10 minutes')", [staleLegacy, session, owner]);
  await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason) VALUES($1,$2,$3,'USER','GENERATING','fresh legacy','FAST','FAST_DEFAULT')", [freshLegacy, session, owner]);
  await identity('service_role');
  // Fail-closed: a fresh null-lease row still gets its full bounded window.
  assert.equal((await recover(session, owner, freshLegacy)).length, 0, 'a fresh legacy null-lease row is not expired and is not recovered');
  const recovered = await recover(session, owner, staleLegacy);
  assert.equal(recovered.length, 1, 'the documented updated_at fallback terminalizes a stale legacy row');
  assert.equal(recovered[0].status, 'FAILED');
  await identity('postgres');
  const [legacyLease] = await rows(`SELECT generation_claimed_at IS NOT NULL claimed_set,
    (generation_lease_expires_at - generation_claimed_at) = interval '120 seconds' bounded_window
    FROM public.conversation_turns WHERE id=$1`, [staleLegacy]);
  assert.deepEqual(legacyLease, { claimed_set: true, bounded_window: true }, 'the terminal legacy record carries coherent bounded claim metadata');
  assert.equal(await assistantCount(staleLegacy), 0, 'no application/provider replay is involved in legacy recovery');
  assert.equal((await outboxRows('ConversationTurnFailed', staleLegacy)).length, 1, 'legacy recovery emits the same single canonical failed event');
  assert.equal((await rows('SELECT status FROM public.conversation_turns WHERE id=$1', [freshLegacy]))[0].status, 'GENERATING');
}

async function verifyRuntimeAcl(owner, session) {
  stage = 'runtime ACL';
  const target = await createOwnedTurn(owner, session, 'acl target');
  await identity('service_role');
  await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, target, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']);
  await identity('postgres');
  await expireLease(target);
  await identity('authenticated', owner);
  await rejected(() => q('SELECT * FROM recover_expired_generating_conversation_turn_v1($1,$2,$3,$4,$5,$6)', [session, owner, target, randomUUID(), null, null]));
  await rejected(() => q('SELECT public.foreground_generation_lease_interval_v1()'));
  await rejected(() => q("UPDATE public.conversation_turns SET status='FAILED' WHERE id=$1", [target]));
  await rejected(() => q("UPDATE public.conversation_turns SET generation_lease_expires_at=now() WHERE id=$1", [target]));
  await identity('anon');
  await rejected(() => q('SELECT * FROM recover_expired_generating_conversation_turn_v1($1,$2,$3,$4,$5,$6)', [session, owner, target, randomUUID(), null, null]));
  await identity('postgres');
  assert.equal((await rows('SELECT status FROM public.conversation_turns WHERE id=$1', [target]))[0].status, 'GENERATING', 'no unauthorized role terminalized the turn');
}

async function verifyConcurrentRecoveryConverges() {
  stage = 'two-connection concurrency';
  const raceUser = randomUUID(), raceSession = randomUUID(), raceTurn = randomUUID();
  const clientA = new Client({ connectionString: databaseUrl });
  const clientB = new Client({ connectionString: databaseUrl });
  try {
    await q('INSERT INTO auth.users(id) VALUES($1)', [raceUser]);
    await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [raceSession, raceUser]);
    await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason,generation_claimed_at,generation_lease_expires_at) VALUES($1,$2,$3,'USER','GENERATING','race target','FAST','FAST_DEFAULT',now()-interval '10 minutes',now()-interval '8 minutes')", [raceTurn, raceSession, raceUser]);
    await clientA.connect(); await clientB.connect();
    await clientA.query('SET ROLE service_role'); await clientB.query('SET ROLE service_role');
    // A recovers inside an open transaction and HOLDS the row lock; B's
    // concurrent recovery must block on FOR UPDATE, then observe the committed
    // FAILED state and become a no-op — never a second transition or event.
    await clientA.query('BEGIN');
    const resultA = await clientA.query('SELECT * FROM recover_expired_generating_conversation_turn_v1($1,$2,$3,$4,$5,$6)', [raceSession, raceUser, raceTurn, randomUUID(), null, null]);
    assert.equal(resultA.rows.length, 1, 'the first concurrent recovery wins the row lock and terminalizes');
    assert.equal(resultA.rows[0].status, 'FAILED');
    const pendingB = clientB.query('SELECT * FROM recover_expired_generating_conversation_turn_v1($1,$2,$3,$4,$5,$6)', [raceSession, raceUser, raceTurn, randomUUID(), null, null]);
    pendingB.catch(() => undefined); // guarded branch: a teardown-path rejection must never become an unhandled rejection
    const winner = await Promise.race([pendingB.then(() => 'COMPLETED', () => 'COMPLETED'), new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), 750))]);
    assert.equal(winner, 'BLOCKED', 'the concurrent recovery blocks on the database row lock instead of racing');
    await clientA.query('COMMIT');
    const resultB = await pendingB;
    assert.equal(resultB.rows.length, 0, 'the lock loser observes the terminal state and recovers nothing');
    const [{ status }] = (await q('SELECT status FROM public.conversation_turns WHERE id=$1', [raceTurn])).rows;
    assert.equal(status, 'FAILED', 'exactly one FAILED transition survived the race');
    const events = (await q("SELECT count(*) count FROM public.runtime_event_outbox WHERE event_type='ConversationTurnFailed' AND subject_turn_id=$1", [raceTurn])).rows;
    assert.equal(Number(events[0].count), 1, 'exactly one terminal recovery outbox event survived the race');
    assert.equal(await assistantCount(raceTurn), 0, 'no assistant exists for the raced source turn');
    // A late finalization from a fresh connection cannot complete the
    // committed recovered turn.
    const lateFinalize = await clientB.query('SELECT * FROM finalize_conversation_turn($1,$2,$3,$4,$5,$6,$7,$8,$9)', [raceSession, raceUser, raceTurn, randomUUID(), 'late text', 'ALLOW', randomUUID(), null, null]);
    assert.equal(lateFinalize.rows.length, 0, 'late finalization after committed recovery is a no-op');
  } finally {
    await clientA.end().catch(() => undefined); await clientB.end().catch(() => undefined);
    await q('DELETE FROM public.runtime_event_outbox WHERE subject_turn_id=$1', [raceTurn]);
    await q('DELETE FROM public.conversation_turns WHERE user_id=$1', [raceUser]);
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
    await verifyStaticAuthority();
    await q('BEGIN');
    try {
      await identity('postgres');
      const owner = randomUUID(), other = randomUUID();
      const session = randomUUID(), otherSession = randomUUID();
      await q('INSERT INTO auth.users(id) VALUES($1),($2)', [owner, other]);
      await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT'),($3,$4,'ACTIVE','TEXT')", [session, owner, otherSession, other]);

      const turn = await verifyLeaseClaim(owner, session);
      await verifyLiveGenerationIsNeverRecoveredEarly(owner, session, turn);
      await verifyExpiredGenerationTerminalizes(owner, session, turn);
      await verifyIdempotentRecoveryAndLateTerminalSafety(owner, session, turn);
      await verifyTerminalAndForeignNoOps(owner, other, session, otherSession);
      await verifyLegacyNullLeaseFallback(owner, session);
      await verifyRuntimeAcl(owner, session);
      await identity('postgres');
    } finally { await q('ROLLBACK'); }
    await verifyConcurrentRecoveryConverges();
    console.log('Verified migration 0039: frozen 120-second server-owned generation lease on claim, live leases never recovered early, expired GENERATING terminalized to FAILED atomically with exactly one canonical content-free ConversationTurnFailed v1 event and no assistant, idempotent recovery, late finalization/failure no-ops, terminal and cross-tenant rows unrecoverable, bounded legacy null-lease fallback, service-role-only authority, and row-lock race convergence with zero provider replay and zero fixture residue.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Foreground GENERATING turn recovery verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
