// Server-Authorized Hypothesis Update Invocation (migration 0032) verifier.
//
// Runs against a fully migrated database. It proves the three-function
// architecture: one internal mutation core with no client-facing authority and
// no EXECUTE for any role; the unchanged authenticated wrapper that derives
// auth.uid() and converges on the core; and the new service-role-only
// background wrapper that receives the already-authorized canonical user and
// conversation session, binds the target Hypothesis to that owner and session
// scope, and never touches auth.uid(), set_config or request claims. It then
// proves foreground behavioral parity with the pre-0032 contract, the
// background adversarial matrix under EMPTY request JWT claims (cross-user,
// cross-session, stale version, ineligible Evidence, duplicate attachment),
// mutation/audit atomicity with exact before/after versions and the immutable
// QANDEEL_HYPOTHESIS_UPDATE_LOOP source, and a clean upgrade from the true
// pre-0032 schema that leaves every historical row byte-identical. Every
// fixture is rolled back; no data is retained.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const migrationSql = await readFile(new URL('./migrations/0032_server_authorized_hypothesis_update_invocation_v1.sql', import.meta.url), 'utf8');
const previousSql = await readFile(new URL('./migrations/0028_canonical_evidence_eligibility_v1.sql', import.meta.url), 'utf8');
const client = new Client({ connectionString: process.env.DATABASE_URL });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;
const one = async (text, values = []) => (await rows(text, values))[0];

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}

async function rejected(operation, codes) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, 'operation unexpectedly succeeded');
  if (codes) assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')})`);
  return error;
}

const CORE = 'public.apply_hypothesis_evidence_update_core_v1(uuid,uuid,uuid,integer,text,text)';
const WRAPPER = 'public.apply_hypothesis_evidence_update(uuid,uuid,integer,text,text)';
const BACKGROUND = 'public.background_apply_hypothesis_evidence_update_v1(uuid,uuid,uuid,uuid,integer,text,text)';
const WRAPPER_CALL = 'SELECT * FROM public.apply_hypothesis_evidence_update($1,$2,$3,$4,$5)';
const BACKGROUND_CALL = 'SELECT * FROM public.background_apply_hypothesis_evidence_update_v1($1,$2,$3,$4,$5,$6,$7)';
const CORE_CALL = 'SELECT * FROM public.apply_hypothesis_evidence_update_core_v1($1,$2,$3,$4,$5,$6)';
const AUDIT_COUNT = 'SELECT count(*)::int n FROM public.hypothesis_updates WHERE hypothesis_id=$1';
const HYPOTHESIS_ROW = 'SELECT * FROM public.hypotheses WHERE id=$1';

const owner = randomUUID();
const other = randomUUID();
const sessionId = randomUUID();
const otherSessionId = randomUUID();
const scopeOf = (session) => `CONVERSATION_SESSION:${session}`;

async function seedMemory(userId, { content, status = 'ACTIVE', source = 'USER_STATED' } = {}) {
  const id = randomUUID();
  await identity('postgres');
  await q(
    "INSERT INTO public.memories(id,user_id,scope,type,content,source,confidence,importance,status) VALUES($1,$2,'USER','PERSONAL_FACT',$3,$4,.9,.5,$5)",
    [id, userId, content ?? `fixture ${id}`, source, status],
  );
  return id;
}

async function seedHypothesis(userId, scope) {
  const id = randomUUID();
  await identity('postgres');
  await q(
    "INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,status,assumptions) VALUES($1,$2,'seeded','CAUSAL','GENERAL',$3,'HUMAN_REVIEWED','ACTIVE','{}')",
    [id, userId, scope],
  );
  return id;
}

async function verifySurfaceAndAcls() {
  stage = 'surface and ACLs';
  await identity('postgres');
  for (const [signature, expected] of [
    // The internal core carries no authority for any role, application or Data API.
    [CORE, { service_role: false, authenticated: false, anon: false, public: false, definer: false }],
    // The authenticated wrapper keeps exactly its migration-0008 ACL.
    [WRAPPER, { service_role: false, authenticated: true, anon: false, public: false, definer: true }],
    // The background wrapper is the server's alone.
    [BACKGROUND, { service_role: true, authenticated: false, anon: false, public: false, definer: true }],
  ]) {
    for (const role of ['service_role', 'authenticated', 'anon', 'public']) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed', [role, signature, 'EXECUTE']);
      assert.equal(allowed, expected[role], `${role} EXECUTE ${signature}`);
    }
    const [{ owner: functionOwner, definer, config }] = await rows(
      'SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config FROM pg_proc p WHERE p.oid=$1::regprocedure',
      [signature],
    );
    assert.equal(functionOwner, 'postgres', `${signature} owner`);
    assert.equal(definer, expected.definer, `${signature} definer posture`);
    assert.ok(Array.isArray(config) && config.length === 1 && config[0].startsWith('search_path='), `${signature} hardened search_path`);
  }

  const [{ definition: core }] = await rows('SELECT pg_get_functiondef($1::regprocedure) definition', [CORE]);
  const [{ definition: wrapper }] = await rows('SELECT pg_get_functiondef($1::regprocedure) definition', [WRAPPER]);
  const [{ definition: background }] = await rows('SELECT pg_get_functiondef($1::regprocedure) definition', [BACKGROUND]);
  // One canonical mutation algorithm: the core holds it, both wrappers converge on it.
  for (const fingerprint of [/FOR UPDATE/u, /canonical_eligible_memory_ids_v1/u, /version=version\+1/u, /QANDEEL_HYPOTHESIS_UPDATE_LOOP/u, /INSERT INTO public\.hypothesis_updates/u]) {
    assert.match(core, fingerprint, 'the core carries the canonical mutation algorithm');
  }
  assert.doesNotMatch(core, /auth\.uid|set_config|request\.jwt/u, 'the core derives no client authority');
  assert.match(wrapper, /auth\.uid\(\)/u, 'the authenticated wrapper derives auth.uid()');
  assert.match(wrapper, /apply_hypothesis_evidence_update_core_v1/u, 'the authenticated wrapper converges on the core');
  assert.doesNotMatch(wrapper, /INSERT INTO public\.hypothesis_updates|UPDATE public\.hypotheses/u, 'the wrapper holds no second copy of the mutation');
  assert.match(background, /apply_hypothesis_evidence_update_core_v1/u, 'the background wrapper converges on the core');
  assert.match(background, /CONVERSATION_SESSION:'\s*\|\|\s*p_session_id::text/u, 'the background target is bound to the conversation-session scope');
  assert.doesNotMatch(background, /auth\.uid|set_config|request\.jwt|jwt\.claims/u, 'the background wrapper reconstructs no JWT and reads no request claim');
  assert.doesNotMatch(background, /conversation_sessions/u, 'the background wrapper does not consult Session state');

  // No role gained direct Hypothesis or audit-table DML.
  for (const table of ['public.hypotheses', 'public.hypothesis_updates']) {
    for (const role of ['authenticated', 'anon', 'service_role']) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} ${privilege} on ${table}`);
      }
    }
  }
}

async function verifyForegroundParity() {
  stage = 'foreground authenticated parity';
  const eligible = await seedMemory(owner, { content: 'foreground eligible' });
  const second = await seedMemory(owner, { content: 'foreground second' });
  const foreign = await seedMemory(other, { content: 'foreign memory' });
  const superseded = await seedMemory(owner, { content: 'superseded memory', status: 'SUPERSEDED' });
  const target = await seedHypothesis(owner, 'fixed scope');
  const foreignTarget = await seedHypothesis(other, 'fixed scope');

  await identity('authenticated', owner);
  const updateId = randomUUID();
  const [applied] = await rows(WRAPPER_CALL, [updateId, target, 1, `memory:${eligible}`, 'SUPPORTING']);
  assert.equal(applied.update.id, updateId, 'the audit row carries the supplied update UUID');
  assert.equal(applied.update.user_id, owner, 'owner comes from the authenticated identity');
  assert.equal(applied.update.before_version, 1);
  assert.equal(applied.update.after_version, 2);
  assert.equal(applied.update.source, 'QANDEEL_HYPOTHESIS_UPDATE_LOOP');
  assert.equal(applied.hypothesis.version, 2);
  assert.deepEqual(applied.hypothesis.supporting_evidence_ids, [`memory:${eligible}`]);

  // Cross-user target: no mutation, no audit, no existence leak.
  assert.equal((await rows(WRAPPER_CALL, [randomUUID(), foreignTarget, 1, `memory:${eligible}`, 'SUPPORTING'])).length, 0);
  // Stale version keeps the canonical 40001 contract.
  await rejected(() => q(WRAPPER_CALL, [randomUUID(), target, 1, `memory:${second}`, 'SUPPORTING']), ['40001']);
  // Validation contract unchanged.
  await rejected(() => q(WRAPPER_CALL, [randomUUID(), target, 0, `memory:${second}`, 'SUPPORTING']), ['22023']);
  await rejected(() => q(WRAPPER_CALL, [randomUUID(), target, 2, `memory:${second}`, 'NEUTRAL']), ['22023']);
  await rejected(() => q(WRAPPER_CALL, [randomUUID(), target, 2, 'memory:not-a-uuid', 'SUPPORTING']), ['22023']);
  await rejected(() => q(WRAPPER_CALL, [randomUUID(), target, 2, `memory:${foreign}`, 'SUPPORTING']), ['22023']);
  await rejected(() => q(WRAPPER_CALL, [randomUUID(), target, 2, `memory:${superseded}`, 'SUPPORTING']), ['22023']);
  await rejected(() => q(WRAPPER_CALL, [randomUUID(), target, 2, `memory:${eligible}`, 'CONTRADICTING']), ['22023']);
  // Unauthenticated identity keeps the 42501 contract.
  await identity('authenticated', null);
  await rejected(() => q(WRAPPER_CALL, [randomUUID(), target, 2, `memory:${second}`, 'SUPPORTING']), ['42501']);

  await identity('postgres');
  assert.equal((await one(AUDIT_COUNT, [target])).n, 1, 'exactly one audit row despite every failed attempt');
  assert.equal((await one(HYPOTHESIS_ROW, [target])).version, 2, 'failed attempts mutate nothing');
  return { eligible, second, target };
}

async function verifyBackgroundPath() {
  stage = 'background adversarial path';
  const eligible = await seedMemory(owner, { content: 'background eligible' });
  const second = await seedMemory(owner, { content: 'background second' });
  const superseded = await seedMemory(owner, { content: 'background superseded', status: 'SUPERSEDED' });
  const target = await seedHypothesis(owner, scopeOf(sessionId));
  const otherSessionTarget = await seedHypothesis(owner, scopeOf(otherSessionId));
  const foreignTarget = await seedHypothesis(other, scopeOf(sessionId));

  // The server role runs with EMPTY request JWT claims: there is no user JWT
  // to reconstruct, and none is needed.
  await identity('service_role');
  const [{ claims }] = await rows("SELECT current_setting('request.jwt.claims', true) claims");
  assert.equal(claims ?? '', '', 'the background path carries no request JWT claims');

  const updateId = randomUUID();
  const [applied] = await rows(BACKGROUND_CALL, [owner, sessionId, updateId, target, 1, `memory:${eligible}`, 'SUPPORTING']);
  assert.ok(applied, 'a context-bound command succeeds without any JWT');
  assert.equal(applied.update.id, updateId, 'the audit row carries the server-generated update UUID');
  assert.equal(applied.update.user_id, owner, 'owner is the bound canonical user');
  assert.equal(applied.update.before_version, 1);
  assert.equal(applied.update.after_version, 2);
  assert.equal(applied.update.evidence_id, `memory:${eligible}`);
  assert.equal(applied.update.evidence_role, 'SUPPORTING');
  assert.equal(applied.update.source, 'QANDEEL_HYPOTHESIS_UPDATE_LOOP');
  assert.equal(applied.hypothesis.version, 2);
  assert.deepEqual(applied.hypothesis.supporting_evidence_ids, [`memory:${eligible}`]);

  // Cross-user target: fail closed with no mutation and no audit.
  assert.equal((await rows(BACKGROUND_CALL, [owner, sessionId, randomUUID(), foreignTarget, 1, `memory:${eligible}`, 'SUPPORTING'])).length, 0);
  // Cross-session target: the owner matches but the conversation-session
  // binding does not; fail closed the same way.
  assert.equal((await rows(BACKGROUND_CALL, [owner, sessionId, randomUUID(), otherSessionTarget, 1, `memory:${eligible}`, 'SUPPORTING'])).length, 0);
  // A caller cannot bind another user's session scope onto a foreign owner.
  assert.equal((await rows(BACKGROUND_CALL, [other, sessionId, randomUUID(), target, 1, `memory:${eligible}`, 'SUPPORTING'])).length, 0);
  // Stale version keeps the canonical 40001 contract, with no mutation/audit.
  await rejected(() => q(BACKGROUND_CALL, [owner, sessionId, randomUUID(), target, 1, `memory:${second}`, 'SUPPORTING']), ['40001']);
  // Evidence no longer eligible is rejected at mutation time.
  await rejected(() => q(BACKGROUND_CALL, [owner, sessionId, randomUUID(), target, 2, `memory:${superseded}`, 'SUPPORTING']), ['22023']);
  // Already-attached Evidence is rejected, in either role.
  await rejected(() => q(BACKGROUND_CALL, [owner, sessionId, randomUUID(), target, 2, `memory:${eligible}`, 'SUPPORTING']), ['22023']);
  await rejected(() => q(BACKGROUND_CALL, [owner, sessionId, randomUUID(), target, 2, `memory:${eligible}`, 'CONTRADICTING']), ['22023']);
  // The internal core is denied even to the service role, and the background
  // wrapper is denied to end-user roles.
  await rejected(() => q(CORE_CALL, [owner, randomUUID(), target, 2, `memory:${second}`, 'SUPPORTING']), ['42501']);
  for (const role of ['authenticated', 'anon']) {
    await identity(role, role === 'authenticated' ? owner : null);
    await rejected(() => q(BACKGROUND_CALL, [owner, sessionId, randomUUID(), target, 2, `memory:${second}`, 'SUPPORTING']), ['42501']);
    await rejected(() => q(CORE_CALL, [owner, randomUUID(), target, 2, `memory:${second}`, 'SUPPORTING']), ['42501']);
  }

  await identity('postgres');
  const audits = await rows('SELECT * FROM public.hypothesis_updates WHERE hypothesis_id=$1', [target]);
  assert.equal(audits.length, 1, 'exactly one audit row despite every rejected background attempt');
  assert.equal((await one(HYPOTHESIS_ROW, [target])).version, 2, 'rejected background attempts mutate nothing');
  assert.equal((await one(HYPOTHESIS_ROW, [otherSessionTarget])).version, 1, 'the cross-session target was never mutated');
  assert.equal((await one(HYPOTHESIS_ROW, [foreignTarget])).version, 1, 'the cross-user target was never mutated');
  return { target, second };
}

async function verifyAtomicity({ target, second }) {
  stage = 'atomic mutation and audit';
  // Force the audit INSERT to fail after the Hypothesis UPDATE would have
  // succeeded: a pre-existing audit row with the same primary key. The whole
  // invocation must roll back, leaving the Hypothesis untouched.
  const collidingId = randomUUID();
  await identity('postgres');
  await q(
    "INSERT INTO public.hypothesis_updates(id,user_id,hypothesis_id,before_version,after_version,evidence_id,evidence_role,source) SELECT $1,user_id,hypothesis_id,before_version,after_version,evidence_id,evidence_role,source FROM public.hypothesis_updates WHERE hypothesis_id=$2 LIMIT 1",
    [collidingId, target],
  );
  const [{ version: beforeVersion }] = await rows(HYPOTHESIS_ROW, [target]);
  await identity('service_role');
  await rejected(() => q(BACKGROUND_CALL, [owner, sessionId, collidingId, target, beforeVersion, `memory:${second}`, 'SUPPORTING']), ['23505']);
  await identity('postgres');
  const [{ version: afterVersion }] = await rows(HYPOTHESIS_ROW, [target]);
  assert.equal(afterVersion, beforeVersion, 'an audit failure rolls back the Hypothesis mutation');
  const [{ n: auditCount }] = await rows('SELECT count(*)::int n FROM public.hypothesis_updates WHERE hypothesis_id=$1 AND id<>$2', [target, collidingId]);
  assert.equal(auditCount, 1, 'no partial audit row survives the rollback');

  // The same command with a fresh update UUID commits mutation + audit together.
  await identity('service_role');
  const freshId = randomUUID();
  const [applied] = await rows(BACKGROUND_CALL, [owner, sessionId, freshId, target, beforeVersion, `memory:${second}`, 'SUPPORTING']);
  assert.equal(applied.update.id, freshId);
  assert.equal(applied.update.before_version, beforeVersion);
  assert.equal(applied.update.after_version, beforeVersion + 1);
  assert.equal(applied.hypothesis.version, beforeVersion + 1);
  await identity('postgres');
  assert.equal((await one(HYPOTHESIS_ROW, [target])).version, beforeVersion + 1, 'mutation and audit commit as one transaction');
}

// The pre-0032 monolithic Update Loop from migration 0028's historical text,
// used to reconstruct a genuine pre-0032 database rather than an approximation.
function historicalUpdateLoop() {
  const start = previousSql.indexOf('CREATE OR REPLACE FUNCTION public.apply_hypothesis_evidence_update(');
  const terminator = 'END; $$;';
  return previousSql.slice(start, previousSql.indexOf(terminator, start) + terminator.length);
}

async function verifyUpgradeFromPre0032() {
  stage = 'pre-0032 reconstruction and upgrade';
  await q('SAVEPOINT upgrade');
  await identity('postgres');
  await q(historicalUpdateLoop());
  await q(`DROP FUNCTION ${BACKGROUND}`);
  await q(`DROP FUNCTION ${CORE}`);
  assert.equal((await one("SELECT to_regprocedure($1) sig", [BACKGROUND])).sig, null, 'pre-0032: no background invocation surface exists');

  // The pre-0032 foreground path works monolithically.
  const eligible = await seedMemory(owner, { content: 'upgrade eligible' });
  const legacyTarget = await seedHypothesis(owner, scopeOf(sessionId));
  await identity('authenticated', owner);
  const [legacyApplied] = await rows(WRAPPER_CALL, [randomUUID(), legacyTarget, 1, `memory:${eligible}`, 'SUPPORTING']);
  assert.equal(legacyApplied.update.after_version, 2, 'pre-0032: the monolithic Update Loop works');

  // Capture every row the upgrade must not touch.
  await identity('postgres');
  const beforeHypotheses = await rows('SELECT * FROM public.hypotheses ORDER BY id');
  const beforeUpdates = await rows('SELECT * FROM public.hypothesis_updates ORDER BY id');
  const beforeMemories = await rows('SELECT * FROM public.memories ORDER BY id');

  await q(migrationSql.replace(/^\s*BEGIN;/mu, '').replace(/^\s*COMMIT;\s*$/mu, ''));

  assert.deepEqual(await rows('SELECT * FROM public.hypotheses ORDER BY id'), beforeHypotheses, 'the upgrade leaves Hypothesis rows byte-identical');
  assert.deepEqual(await rows('SELECT * FROM public.hypothesis_updates ORDER BY id'), beforeUpdates, 'the upgrade leaves the audit byte-identical');
  assert.deepEqual(await rows('SELECT * FROM public.memories ORDER BY id'), beforeMemories, 'the upgrade leaves Memory rows byte-identical');

  // The upgraded database reaches the hardened three-function contract and
  // both wrappers work.
  await verifySurfaceAndAcls();
  stage = 'pre-0032 reconstruction and upgrade';
  const upgradeSecond = await seedMemory(owner, { content: 'upgrade second' });
  await identity('authenticated', owner);
  const [foregroundUpgraded] = await rows(WRAPPER_CALL, [randomUUID(), legacyTarget, 2, `memory:${upgradeSecond}`, 'CONTRADICTING']);
  assert.equal(foregroundUpgraded.update.after_version, 3, 'post-upgrade: the authenticated wrapper works');
  const upgradeThird = await seedMemory(owner, { content: 'upgrade third' });
  await identity('service_role');
  const [backgroundUpgraded] = await rows(BACKGROUND_CALL, [owner, sessionId, randomUUID(), legacyTarget, 3, `memory:${upgradeThird}`, 'SUPPORTING']);
  assert.equal(backgroundUpgraded.update.after_version, 4, 'post-upgrade: the background wrapper works');

  await identity('postgres');
  await q('ROLLBACK TO SAVEPOINT upgrade');
  await q('RELEASE SAVEPOINT upgrade');
}

async function main() {
  try {
    await client.connect();
    await q('BEGIN');
    await identity('postgres');
    await q('INSERT INTO auth.users(id) VALUES($1),($2)', [owner, other]);

    await verifySurfaceAndAcls();
    await verifyUpgradeFromPre0032();
    await verifyForegroundParity();
    const background = await verifyBackgroundPath();
    await verifyAtomicity(background);

    console.log('Verified migration 0032: one internal mutation core with zero role EXECUTE, the unchanged authenticated wrapper converging on it, a service-role-only background wrapper bound to the canonical owner and conversation-session scope with empty JWT claims and no auth.uid/set_config/request-claim reconstruction, foreground parity (exact versions, 40001, Evidence eligibility, duplicate rejection, single immutable audit), the background adversarial matrix (cross-user, cross-session, stale, ineligible, duplicate, internal-core denial), atomic mutation+audit with rollback on audit failure, and a byte-identical upgrade from the true pre-0032 schema.');
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Server-authorized hypothesis update verification failed at ${stage} (${code}): ${error?.message ?? 'unknown assertion'}. Connection details were suppressed.`);
  process.exitCode = 1;
});
