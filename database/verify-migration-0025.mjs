// Conversation Authority Hardening (migration 0025) adversarial verifier.
//
// Runs against a fully migrated database. It first reconstructs the pre-0025
// permissive authority inside a rolled-back savepoint to prove the forgery
// vulnerability was real, then proves — against the live hardened state — that
// clients can no longer forge or mutate server-authoritative conversation
// history, that user-turn creation is a narrow authenticated command, that
// claim/finalize/fail are server-only, and that cancellation stays a safe user
// action. Every fixture is rolled back; no data is retained.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const client = new Client({ connectionString: process.env.DATABASE_URL });
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

const FINALIZE = 'public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid)';
// QIR-006 (migration 0063): the 0025 finalization signature above is retired to
// a revoked writeless tombstone; the CURRENT finalization authority is the
// versioned v2 command below. The 0025 phase guarantees - server-only
// finalization, explicit ownership validation, atomic assistant insertion and
// duplicate-finalization no-op - are proven against the current authority.
const FINALIZE_V2 = 'public.finalize_conversation_turn_v2(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid,uuid)';
const CLAIM = 'public.claim_conversation_turn(uuid,uuid,uuid,text,text)';
const FAIL = 'public.fail_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid)';
const CREATE = 'public.create_user_conversation_turn(uuid,uuid,text,text)';
const CANCEL = 'public.cancel_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid)';

async function verifyEffectiveAcls() {
  stage = 'effective ACLs';
  const priv = [
    ['authenticated', 'public.conversation_turns', 'SELECT', true],
    ['authenticated', 'public.conversation_turns', 'INSERT', false],
    ['authenticated', 'public.conversation_turns', 'UPDATE', false],
    ['authenticated', 'public.conversation_turns', 'DELETE', false],
    // The server REST role can read turns (background intelligence) but cannot mutate them directly.
    ['service_role', 'public.conversation_turns', 'SELECT', true],
    ['service_role', 'public.conversation_turns', 'INSERT', false],
    ['service_role', 'public.conversation_turns', 'UPDATE', false],
    ['service_role', 'public.conversation_turns', 'DELETE', false],
  ];
  for (const [role, table, p, expected] of priv) {
    const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, p]);
    assert.equal(allowed, expected, `${role} ${p} on ${table}`);
  }
  const fn = [
    ['authenticated', CREATE, true], ['service_role', CREATE, false],
    ['authenticated', CLAIM, false], ['service_role', CLAIM, true],
    // Migration 0063 retired the 0025 finalization signature: no application
    // role may execute the tombstone, and the versioned v2 authority carries
    // the exact server-only posture the 0025 signature held.
    ['authenticated', FINALIZE, false], ['service_role', FINALIZE, false], ['anon', FINALIZE, false],
    ['authenticated', FINALIZE_V2, false], ['service_role', FINALIZE_V2, true], ['anon', FINALIZE_V2, false],
    ['authenticated', FAIL, false], ['service_role', FAIL, true],
    ['authenticated', CANCEL, true], ['anon', CANCEL, false],
  ];
  for (const [role, signature, expected] of fn) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed', [role, signature, 'EXECUTE']);
    assert.equal(allowed, expected, `${role} EXECUTE ${signature}`);
  }
  const policies = (await rows(
    "SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='conversation_turns' ORDER BY policyname",
  )).map((r) => r.policyname);
  assert.deepEqual(policies, ['conversation_turns_select_own'], 'only the read policy survives on conversation_turns');
  for (const signature of [CREATE, CLAIM, FINALIZE, FINALIZE_V2, FAIL]) {
    const [{ owner, definer, config }] = await rows(
      "SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config FROM pg_proc p WHERE p.oid=$1::regprocedure",
      [signature],
    );
    assert.equal(owner, 'postgres', `${signature} owner`);
    assert.equal(definer, true, `${signature} is SECURITY DEFINER`);
    assert.ok(Array.isArray(config) && config.length === 1 && config[0].startsWith('search_path='), `${signature} hardened search_path`);
  }
}

async function reproduceBaselineVulnerability(owner, session) {
  stage = 'baseline vulnerability reconstruction';
  await q('SAVEPOINT baseline');
  // Reconstruct exactly the pre-0025 permissive authority that migration 0002
  // granted and that migration 0022 exposed.
  await q('GRANT INSERT, UPDATE ON public.conversation_turns TO authenticated');
  await q("CREATE POLICY conversation_turns_insert_own ON public.conversation_turns FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()))");
  await q("CREATE POLICY conversation_turns_update_own ON public.conversation_turns FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()))");
  await q(`GRANT EXECUTE ON FUNCTION ${FINALIZE_V2} TO authenticated`);

  const forgeUser = randomUUID(), forgeAssistant = randomUUID(), forgeSystem = randomUUID(), forgeSource = randomUUID();
  // A GENERATING source turn the attacker will finalize with forged content.
  await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason) VALUES($1,$2,$3,'USER','GENERATING','q','FAST','FAST_DEFAULT')", [forgeSource, session, owner]);

  await identity('authenticated', owner);
  // Exploit #3: fabricate a COMPLETED USER turn directly.
  await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,completed_at) VALUES($1,$2,$3,'USER','COMPLETED','forged user',CURRENT_TIMESTAMP)", [forgeUser, session, owner]);
  // Exploit #2: fabricate a COMPLETED ASSISTANT turn linked to it — a
  // ContextBuilder-authoritative exchange with attacker-controlled content.
  await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,source_turn_id,completed_at) VALUES($1,$2,$3,'ASSISTANT','COMPLETED','forged authority',$4,CURRENT_TIMESTAMP)", [forgeAssistant, session, owner, forgeUser]);
  // Exploit: fabricate a SYSTEM turn.
  await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content) VALUES($1,$2,$3,'SYSTEM','RECEIVED','forged system')", [forgeSystem, session, owner]);
  const [eligible] = await rows(
    `SELECT count(*)::int n FROM public.conversation_turns u JOIN public.conversation_turns a ON a.source_turn_id=u.id
      WHERE u.id=$1 AND u.role='USER' AND u.status='COMPLETED' AND a.role='ASSISTANT' AND a.status='COMPLETED'`,
    [forgeUser],
  );
  assert.equal(eligible.n, 1, 'baseline: forged pair satisfies the ContextBuilder authoritative predicate');
  // Exploit #5: caller-controlled finalize produces an ASSISTANT with forged content.
  const forged = await rows(`SELECT * FROM ${'finalize_conversation_turn_v2'}($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [session, owner, forgeSource, randomUUID(), 'attacker assistant', 'ALLOW', randomUUID(), null, null]);
  assert.equal(forged.length, 1, 'baseline: authenticated finalize forged an assistant');
  assert.equal(forged[0].assistant_turn.content, 'attacker assistant');

  await identity('postgres');
  await q('ROLLBACK TO SAVEPOINT baseline');
  await q('RELEASE SAVEPOINT baseline');
}

async function verifyDirectTableAttacksRejected(owner, session, receivedTurn) {
  stage = 'authenticated direct table attacks';
  await identity('authenticated', owner);
  const insert = (role, status) => () => q(
    "INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content) VALUES($1,$2,$3,$4,$5,'x')",
    [randomUUID(), session, owner, role, status],
  );
  await rejected(insert('USER', 'RECEIVED'));
  await rejected(insert('ASSISTANT', 'COMPLETED'));
  await rejected(insert('SYSTEM', 'RECEIVED'));
  await rejected(() => q("UPDATE public.conversation_turns SET content='mutated' WHERE id=$1", [receivedTurn]));
  await rejected(() => q("UPDATE public.conversation_turns SET role='ASSISTANT' WHERE id=$1", [receivedTurn]));
  await rejected(() => q("UPDATE public.conversation_turns SET status='COMPLETED' WHERE id=$1", [receivedTurn]));
  await rejected(() => q("UPDATE public.conversation_turns SET processing_path='FAST',routing_reason='FAST_DEFAULT' WHERE id=$1", [receivedTurn]));
  await rejected(() => q('UPDATE public.conversation_turns SET source_turn_id=$1 WHERE id=$2', [receivedTurn, receivedTurn]));
  await rejected(() => q('DELETE FROM public.conversation_turns WHERE id=$1', [receivedTurn]));
}

async function verifyNarrowUserCreation(owner, other, session, otherSession) {
  stage = 'narrow user-turn creation';
  await identity('authenticated', owner);
  const id = randomUUID();
  const [created] = await rows(`SELECT * FROM ${'create_user_conversation_turn'}($1,$2,$3,$4)`, [id, session, 'user says hi', 'idem-1']);
  assert.equal(created.role, 'USER');
  assert.equal(created.status, 'RECEIVED');
  assert.equal(created.user_id, owner);
  assert.equal(created.processing_path, null);
  assert.equal(created.routing_reason, null);
  assert.equal(created.source_turn_id, null);
  assert.equal(created.completed_at, null);
  assert.equal(created.content, 'user says hi');
  // Idempotency duplicate surfaces as a unique violation (PostgREST -> 409).
  await rejected(() => q(`SELECT ${'create_user_conversation_turn'}($1,$2,$3,$4)`, [randomUUID(), session, 'again', 'idem-1']), ['23505']);
  // Cross-user session creation fails closed.
  await rejected(() => q(`SELECT ${'create_user_conversation_turn'}($1,$2,$3,$4)`, [randomUUID(), otherSession, 'intrude', null]));
  // The command cannot be executed as another tenant's identity for an owned row it does not own.
  await identity('authenticated', other);
  await rejected(() => q(`SELECT ${'create_user_conversation_turn'}($1,$2,$3,$4)`, [randomUUID(), session, 'intrude', null]));
}

async function verifyServerOnlyLifecycle(owner, session) {
  stage = 'server-only lifecycle';
  // A fresh RECEIVED USER turn created by the owner.
  await identity('authenticated', owner);
  const turnId = randomUUID();
  await rows(`SELECT ${'create_user_conversation_turn'}($1,$2,$3,$4)`, [turnId, session, 'server lifecycle', null]);

  // Authenticated cannot drive server lifecycle.
  await rejected(() => q(`SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)`, [session, owner, turnId, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']));
  await rejected(() => q(`SELECT * FROM finalize_conversation_turn($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [session, owner, turnId, randomUUID(), 'x', 'ALLOW', randomUUID(), null, null]));
  await rejected(() => q(`SELECT * FROM finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [session, owner, turnId, randomUUID(), 'x', 'ALLOW', randomUUID(), null, null]));
  await rejected(() => q(`SELECT * FROM fail_conversation_turn($1,$2,$3,$4,$5,$6)`, [session, owner, turnId, randomUUID(), null, null]));

  // Server authority can claim and finalize.
  await identity('service_role');
  const claimed = await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, turnId, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']);
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].status, 'GENERATING');
  // Mismatched user/session fails closed even for the server role.
  await rejected(() => q('SELECT * FROM finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9)', [session, randomUUID(), turnId, randomUUID(), 'x', 'ALLOW', randomUUID(), null, null]));
  const finalized = await rows('SELECT * FROM finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9)', [session, owner, turnId, randomUUID(), 'server assistant', 'ALLOW', randomUUID(), null, null]);
  assert.equal(finalized.length, 1);
  await identity('postgres');
  const assistants = await rows("SELECT id,content FROM public.conversation_turns WHERE source_turn_id=$1 AND role='ASSISTANT'", [turnId]);
  assert.equal(assistants.length, 1, 'exactly one linked assistant');
  assert.equal(assistants[0].content, 'server assistant');
  // Duplicate finalization is a no-op and does not create a second assistant.
  await identity('service_role');
  const duplicate = await rows('SELECT * FROM finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9)', [session, owner, turnId, randomUUID(), 'second', 'ALLOW', randomUUID(), null, null]);
  assert.equal(duplicate.length, 0);
  await identity('postgres');
  assert.equal((await rows("SELECT count(*)::int n FROM public.conversation_turns WHERE source_turn_id=$1 AND role='ASSISTANT'", [turnId]))[0].n, 1);
  // The legitimate server-created pair is ContextBuilder-authoritative.
  const [eligible] = await rows(
    `SELECT count(*)::int n FROM public.conversation_turns u JOIN public.conversation_turns a ON a.source_turn_id=u.id
      WHERE u.id=$1 AND u.role='USER' AND u.status='COMPLETED' AND a.role='ASSISTANT' AND a.status='COMPLETED'`,
    [turnId],
  );
  assert.equal(eligible.n, 1);
}

async function verifyCancellation(owner, other, session) {
  stage = 'cancellation';
  await identity('authenticated', owner);
  const cancelable = randomUUID();
  await rows(`SELECT ${'create_user_conversation_turn'}($1,$2,$3,$4)`, [cancelable, session, 'to cancel', null]);
  // Cross-user cancellation fails closed.
  await identity('authenticated', other);
  await rejected(() => q('SELECT * FROM cancel_conversation_turn($1,$2,$3,$4,$5,$6)', [session, owner, cancelable, randomUUID(), null, null]));
  // Owner cancels its own non-terminal USER turn.
  await identity('authenticated', owner);
  const cancelled = await rows('SELECT * FROM cancel_conversation_turn($1,$2,$3,$4,$5,$6)', [session, owner, cancelable, randomUUID(), null, null]);
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0].status, 'CANCELLED');
  assert.equal(cancelled[0].role, 'USER');
  assert.equal(cancelled[0].content, 'to cancel');
  // A terminal turn cannot be cancelled again.
  const again = await rows('SELECT * FROM cancel_conversation_turn($1,$2,$3,$4,$5,$6)', [session, owner, cancelable, randomUUID(), null, null]);
  assert.equal(again.length, 0);
}

async function verifyTenantIsolation(owner, other, session, otherSession) {
  stage = 'tenant isolation';
  await identity('authenticated', owner);
  const visible = (await rows('SELECT session_id FROM public.conversation_turns')).map((r) => r.session_id);
  assert.ok(visible.every((s) => s === session), 'owner sees only own turns');
  await identity('authenticated', other);
  const otherVisible = (await rows('SELECT session_id FROM public.conversation_turns')).map((r) => r.session_id);
  assert.ok(otherVisible.every((s) => s === otherSession), 'other tenant sees only its own turns');
}

async function main() {
  try {
    await client.connect();
    await q('BEGIN');
    await identity('postgres');
    const owner = randomUUID(), other = randomUUID();
    const session = randomUUID(), otherSession = randomUUID(), received = randomUUID();
    await q('INSERT INTO auth.users(id) VALUES($1),($2)', [owner, other]);
    // Fixture sessions are deliberately ACTIVE/TEXT: migration 0030 narrowed
    // create_user_conversation_turn admission to owned ACTIVE/TEXT parents, so
    // every Finding-02 turn-authority assertion here still runs against an
    // admissible session. The non-admissible matrix is proven by
    // verify-migration-0030.mjs.
    await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT'),($3,$4,'ACTIVE','TEXT')", [session, owner, otherSession, other]);
    await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content) VALUES($1,$2,$3,'USER','RECEIVED','baseline')", [received, session, owner]);

    await verifyEffectiveAcls();
    await reproduceBaselineVulnerability(owner, session);
    await verifyDirectTableAttacksRejected(owner, session, received);
    await verifyNarrowUserCreation(owner, other, session, otherSession);
    await verifyServerOnlyLifecycle(owner, session);
    await verifyCancellation(owner, other, session);
    await verifyTenantIsolation(owner, other, session, otherSession);

    await identity('postgres');
    console.log('Verified migration 0025: reproduced the baseline forgery, then proved hardened server-only conversation authority, narrow user creation, safe cancellation, and tenant isolation.');
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Conversation authority verification failed at ${stage} (${code}). Connection details were suppressed.`);
  process.exitCode = 1;
});
