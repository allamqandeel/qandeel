// Exact-Version Post-Update Confidence (Finding 09, QAN-AUD-07) current-schema
// verifier.
//
// There is deliberately NO migration for this finding: the canonical
// PostgreSQL Confidence commands already enforce exact target-version
// equality, and QAN-AUD-07 is an application caller-binding defect. This
// verifier proves the database side of the invariant against the live current
// schema, for both authorities, using the REAL mutation commands to advance
// the Hypothesis exactly as the race does:
//   * authenticated: an exact current-version create_confidence_evaluation
//     succeeds and stores the exact target_version; after the Hypothesis
//     advances (update A commits V -> V+1, update B commits V+1 -> V+2), the
//     stale V+1 evaluation on behalf of update A is REJECTED, creates no row
//     at all - neither for V+1 nor silently for the later V+2 - and the exact
//     current V+2 evaluation then succeeds with the exact stored version;
//   * background (service_role, no reconstructed user JWT): the same proof
//     through background_create_confidence_evaluation_v1 and the
//     session-scope-bound background mutation wrapper.
// Every fixture is rolled back; no data is retained. No paid provider is ever
// invoked.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const client = new Client({ connectionString: process.env.DATABASE_URL });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const one = async (text, values = []) => (await q(text, values)).rows[0];

async function identity(role, userId) {
  await q('RESET ROLE');
  if (role === 'authenticated') {
    await q('SET LOCAL ROLE authenticated');
    await q("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: userId, role: 'authenticated' })]);
  } else if (role !== 'postgres') {
    await q(`SET LOCAL ROLE ${role}`);
  }
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

const userId = randomUUID();
const sessionId = randomUUID();
const memories = { supporting: randomUUID(), contradicting: randomUUID() };
const evidence = { supporting: `memory:${memories.supporting}`, contradicting: `memory:${memories.contradicting}` };
const foreground = randomUUID();
const background = randomUUID();

// The whole target_version history of one Hypothesis, read with full
// authority, so a stale call provably created no row of any version.
async function versions(hypothesisId) {
  await q('RESET ROLE');
  const { rows } = await q(
    'SELECT target_version FROM public.confidence_evaluations WHERE target_id=$1 AND user_id=$2 ORDER BY target_version',
    [hypothesisId, userId],
  );
  return rows.map((row) => row.target_version);
}

async function verifyAuthenticated() {
  stage = 'authenticated exact-version Confidence';
  await identity('authenticated', userId);
  // 1. The exact current version succeeds and the stored target is exact.
  const current = await one('SELECT * FROM public.create_confidence_evaluation($1::jsonb)',
    [{ id: randomUUID(), target_id: foreground, target_version: 1 }]);
  assert.equal(current.target_version, 1, 'the exact current target version succeeds');
  assert.equal(current.user_id, userId);
  assert.equal(current.provenance, 'QANDEEL_CONFIDENCE_RUNTIME');
  // 2. The QAN-AUD-07 race, with the REAL mutation command: update A commits
  //    1 -> 2, then update B commits 2 -> 3 before A's Confidence runs.
  const updateA = (await one('SELECT * FROM public.apply_hypothesis_evidence_update($1,$2,$3,$4,$5)',
    [randomUUID(), foreground, 1, evidence.supporting, 'SUPPORTING'])).update;
  assert.equal(updateA.after_version, 2, 'update A returns its exact after_version');
  const updateB = (await one('SELECT * FROM public.apply_hypothesis_evidence_update($1,$2,$3,$4,$5)',
    [randomUUID(), foreground, 2, evidence.contradicting, 'CONTRADICTING'])).update;
  assert.equal(updateB.after_version, 3, 'update B advances the canonical Hypothesis past A');
  // 3. A's exact after_version is now stale: the canonical guard rejects it.
  await identity('authenticated', userId);
  const stale = await rejected(() => q('SELECT * FROM public.create_confidence_evaluation($1::jsonb)',
    [JSON.stringify({ id: randomUUID(), target_id: foreground, target_version: updateA.after_version })]), ['22023']);
  assert.equal(stale.message, 'Stale hypothesis version.');
  // 4. The stale call created NO row: not for the stale version 2, and no
  //    silent later-version substitution row for 3 either.
  assert.deepEqual(await versions(foreground), [1], 'the stale exact call creates no Confidence row of any version');
  // 5. An explicit exact evaluation of the CURRENT version still works and
  //    stores the exact target.
  await identity('authenticated', userId);
  const advanced = await one('SELECT * FROM public.create_confidence_evaluation($1::jsonb)',
    [{ id: randomUUID(), target_id: foreground, target_version: 3 }]);
  assert.equal(advanced.target_version, 3, 'the exact current version after the race succeeds');
  assert.deepEqual(await versions(foreground), [1, 3], 'only exact-version rows exist - never a substituted one');
}

async function verifyBackground() {
  stage = 'background service-role exact-version Confidence';
  // No reconstructed user JWT exists on this path: only the service role.
  await identity('service_role');
  const current = await one('SELECT * FROM public.background_create_confidence_evaluation_v1($1,$2,$3,$4)',
    [userId, randomUUID(), background, 1]);
  assert.equal(current.target_version, 1, 'the exact current target version succeeds');
  assert.equal(current.user_id, userId);
  assert.equal(current.provenance, 'QANDEEL_CONFIDENCE_RUNTIME');
  const updateA = (await one('SELECT * FROM public.background_apply_hypothesis_evidence_update_v1($1,$2,$3,$4,$5,$6,$7)',
    [userId, sessionId, randomUUID(), background, 1, evidence.supporting, 'SUPPORTING'])).update;
  assert.equal(updateA.after_version, 2, 'background update A returns its exact after_version');
  const updateB = (await one('SELECT * FROM public.background_apply_hypothesis_evidence_update_v1($1,$2,$3,$4,$5,$6,$7)',
    [userId, sessionId, randomUUID(), background, 2, evidence.contradicting, 'CONTRADICTING'])).update;
  assert.equal(updateB.after_version, 3, 'background update B advances the canonical Hypothesis past A');
  await identity('service_role');
  const stale = await rejected(() => q('SELECT * FROM public.background_create_confidence_evaluation_v1($1,$2,$3,$4)',
    [userId, randomUUID(), background, updateA.after_version]), ['22023']);
  assert.equal(stale.message, 'Stale hypothesis version.');
  assert.deepEqual(await versions(background), [1], 'the stale exact call creates no Confidence row of any version');
  await identity('service_role');
  const advanced = await one('SELECT * FROM public.background_create_confidence_evaluation_v1($1,$2,$3,$4)',
    [userId, randomUUID(), background, 3]);
  assert.equal(advanced.target_version, 3, 'the exact current version after the race succeeds');
  assert.deepEqual(await versions(background), [1, 3], 'only exact-version rows exist - never a substituted one');
}

async function main() {
  try {
    await client.connect();
    await q('BEGIN');
    await q('RESET ROLE');
    await q('INSERT INTO public.users(id,auth_subject) VALUES($1::uuid,$1::text)', [userId]);
    await q(
      `INSERT INTO public.memories(id,user_id,scope,type,content,source,confidence,importance,status)
        VALUES($1,$3,'USER','GOAL','exact-version supporting fixture','USER_STATED',1,1,'ACTIVE'),
              ($2,$3,'USER','GOAL','exact-version contradicting fixture','USER_CONFIRMED',1,1,'ACTIVE')`,
      [memories.supporting, memories.contradicting, userId],
    );
    await q(
      `INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,status)
        VALUES($1,$3,'foreground exact-version target','CAUSAL','GENERAL','exact-version test','HUMAN_REVIEWED','ACTIVE'),
              ($2,$3,'background exact-version target','CAUSAL','GENERAL','CONVERSATION_SESSION:'||$4::text,'SYSTEM_GENERATED','CANDIDATE')`,
      [foreground, background, userId, sessionId],
    );
    await verifyAuthenticated();
    await verifyBackground();
    console.log('Verified exact-version post-update Confidence on the current schema (no migration): the authenticated create_confidence_evaluation and service-role background_create_confidence_evaluation_v1 commands both accept the exact current target version and store it exactly, both reject the stale exact after_version of a raced update (Stale hypothesis version.), the stale call creates no Confidence row of any version - no later-version substitution - and the exact current version still evaluates after the race, with no reconstructed user JWT on the service-role path.');
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Exact-version Confidence verification failed at ${stage} (${code}): ${error?.message ?? 'unknown assertion'}. Connection details were suppressed.`);
  process.exitCode = 1;
});
