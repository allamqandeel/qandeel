// QAN-AUD-06 Confidence Batch Reliability (migration 0035) adversarial
// verifier.
//
// Runs against a fully migrated database. It proves the managed
// CONFIDENCE_BATCH contract end to end on real PostgreSQL: the effect registry
// and ACLs (ordinary claim and generic completion now BOTH fail closed for the
// Confidence batch - CONFIDENCE_BATCH_MANAGED / CONFIDENCE_BATCH_COMMAND_
// REQUIRED - while every earlier error contract is preserved verbatim); the
// bounded child item table's constraints, RLS and zero direct DML for any
// application role; the internal receipt validator; that the managed
// service-role command derives the owner from the execution and its targets
// ONLY from the durable HYPOTHESIS_PERSISTENCE result, freezes the exact
// current target version at first initialization, generates one stable
// evaluation UUID per target and reuses the canonical
// background_create_confidence_evaluation_v1 boundary; the zero-target,
// single-target and ordered multi-target happy paths; that a forced per-target
// failure leaves the batch INCOMPLETE with a durable RETRY_PENDING item, a
// committed sibling evaluation and a still-RUNNING execution; that the retry
// re-evaluates only the failed target with the SAME durable evaluation UUID and
// frozen version; that a version advance before retry quarantines with
// TARGET_VERSION_DRIFT and never substitutes the newer version; that a
// pre-existing conflicting evaluation UUID can never be mistaken for this
// batch; that a corrupted item plan fails closed; that repeated invocation
// after a durable result is a no-op against an immutable first result; and that
// the upgrade from the canonical 0034 chain rewrites no historical row and
// classifies legacy completed/claimed Confidence rows fail-closed. Every
// fixture is rolled back; no data is retained. No paid provider is ever
// invoked.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const migrationSql = await readFile(new URL('./migrations/0035_confidence_batch_reliability_v1.sql', import.meta.url), 'utf8');
const updateBatchSql = await readFile(new URL('./migrations/0034_automatic_hypothesis_update_invocation_recovery_v1.sql', import.meta.url), 'utf8');
const client = new Client({ connectionString: process.env.DATABASE_URL });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;
const one = async (text, values = []) => (await rows(text, values))[0];

async function identity(role) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
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

const RESULT_VALIDATOR = 'public.post_response_confidence_batch_result_valid_v1(jsonb)';
const CONFIDENCE_RPC = 'public.execute_post_response_confidence_batch_v1(uuid)';
const GENERIC = 'public.complete_post_response_intelligence_effect_v1(uuid,text)';
const CLAIM_RPC = 'public.claim_post_response_intelligence_effect_v1(uuid,text)';
const ITEMS_TABLE = 'public.post_response_confidence_batch_items';
const ACQUIRE = 'SELECT * FROM public.acquire_post_response_intelligence_execution_v1($1,$2,$3,$4,$5,$6,$7,$8)';
const CLAIM = 'SELECT public.claim_post_response_intelligence_effect_v1($1,$2) ok';
const COMPLETE_GENERIC = 'SELECT public.complete_post_response_intelligence_effect_v1($1,$2) ok';
const COMPLETE_INTENT = 'SELECT public.complete_post_response_intent_provider_effect_v1($1,$2,$3) ok';
const COMPLETE_CANDIDATE = 'SELECT public.complete_post_response_candidate_provider_effect_v1($1,$2,$3) ok';
const PERSIST = 'SELECT public.persist_post_response_hypothesis_generation_v1($1) ok';
const EXECUTE = 'SELECT public.execute_post_response_confidence_batch_v1($1) status';
const VALID_RESULT = 'SELECT public.post_response_confidence_batch_result_valid_v1($1::jsonb) valid';
const EFFECT = 'SELECT * FROM public.post_response_intelligence_effects WHERE execution_id=$1 AND effect_key=$2';
const ITEMS = `SELECT * FROM ${ITEMS_TABLE} WHERE execution_id=$1 ORDER BY ordinal`;
const HYPOTHESIS = 'SELECT * FROM public.hypotheses WHERE id=$1';
const EFFECT_KEYS = ['MEMORY_WRITE', 'INTENT_PROVIDER', 'CANDIDATE_PROVIDER', 'ASSOCIATION_PROVIDER', 'HYPOTHESIS_UPDATE_BATCH', 'HYPOTHESIS_PERSISTENCE', 'CONFIDENCE_BATCH'];
const FAULT_SETTING = 'qandeel.confidence_fault_target';

const userId = randomUUID();
const otherUserId = randomUUID();
const memories = { first: randomUUID(), second: randomUUID(), drift: randomUUID() };
const evidence = { first: `memory:${memories.first}`, second: `memory:${memories.second}`, drift: `memory:${memories.drift}` };
const INTENT_EVIDENCE = [evidence.first, evidence.second];

const scopeFor = (execution) => `CONVERSATION_SESSION:${execution.session}`;

// Arms or disarms the bounded verifier-only Confidence fault. It is a plain
// transaction-local setting read by one temporary trigger; nothing in the
// canonical runtime knows it exists.
async function armFault(targetId) {
  await identity('postgres');
  await q('SELECT set_config($1,$2,true)', [FAULT_SETTING, targetId ?? '']);
}

// A complete canonical generation chain: a durable authorized Intent, a durable
// validated candidate plan with stable pre-assigned UUIDs, and the ONE atomic
// persistence command - so every Confidence target below is derived from real
// durable HYPOTHESIS_PERSISTENCE output, never from a hand-written fixture.
async function newGeneration(count, { owner = userId } = {}) {
  const execution = { id: randomUUID(), session: randomUUID(), turn: randomUUID() };
  await identity('postgres');
  await q(ACQUIRE, [execution.id, randomUUID(), owner, execution.session, execution.turn, '2.0', 'FAST', 'ALLOW']);
  await identity('service_role');
  assert.equal((await one(CLAIM, [execution.id, 'INTENT_PROVIDER'])).ok, true, 'claim INTENT_PROVIDER');
  const intent = {
    problem: { text: 'Why do I repeat this pattern?', source: 'CURRENT_USER_TURN', sourceTurnId: execution.turn },
    domain: 'GENERAL',
    scope: { kind: 'CONVERSATION_SESSION', sessionId: execution.session, serialized: scopeFor(execution) },
    evidenceIds: INTENT_EVIDENCE,
  };
  assert.equal((await one(COMPLETE_INTENT, [execution.id, 'INTENT_AUTHORIZED', JSON.stringify(intent)])).ok, true, 'complete INTENT_PROVIDER');
  assert.equal((await one(CLAIM, [execution.id, 'CANDIDATE_PROVIDER'])).ok, true, 'claim CANDIDATE_PROVIDER');
  const candidates = Array.from({ length: count }, () => ({
    hypothesisId: randomUUID(),
    statement: `Confidence batch hypothesis ${randomUUID()}`,
    type: 'CAUSAL',
    domain: 'GENERAL',
    scope: scopeFor(execution),
    supportingEvidenceIds: [evidence.first],
    contradictingEvidenceIds: [],
    assumptions: [],
    disconfirmingConditions: [],
  }));
  assert.equal(
    (await one(COMPLETE_CANDIDATE, count === 0
      ? [execution.id, 'NO_ACCEPTED_CANDIDATES', null]
      : [execution.id, 'VALIDATED_CANDIDATES', JSON.stringify(candidates)])).ok,
    true, 'complete CANDIDATE_PROVIDER',
  );
  assert.equal((await one(CLAIM, [execution.id, 'HYPOTHESIS_PERSISTENCE'])).ok, true, 'claim HYPOTHESIS_PERSISTENCE');
  assert.equal((await one(PERSIST, [execution.id])).ok, true, 'atomic HYPOTHESIS_PERSISTENCE');
  await identity('postgres');
  const persisted = (await one(EFFECT, [execution.id, 'HYPOTHESIS_PERSISTENCE']));
  assert.equal(persisted.result_code, count === 0 ? 'NO_HYPOTHESES_PERSISTED' : 'HYPOTHESES_PERSISTED');
  const hypothesisIds = candidates.map((candidate) => candidate.hypothesisId);
  const versions = [];
  for (const hypothesisId of hypothesisIds) versions.push((await one(HYPOTHESIS, [hypothesisId])).version);
  return { execution, hypothesisIds, versions, persisted };
}

async function run(executionId) {
  await identity('service_role');
  return (await one(EXECUTE, [executionId])).status;
}

async function confidenceRows(targetId) {
  await identity('postgres');
  return rows('SELECT * FROM public.confidence_evaluations WHERE target_id=$1 ORDER BY created_at, id', [targetId]);
}

async function verifySurfaceAndAcls() {
  stage = 'item table, effect contract and ACLs';
  await identity('postgres');
  // The registry is untouched: 0035 adds no effect key.
  const registry = (await one(
    `SELECT pg_get_constraintdef(oid) definition FROM pg_constraint
      WHERE conrelid='public.post_response_intelligence_effects'::regclass
        AND conname='post_response_intelligence_effects_effect_key_check'`,
  )).definition;
  assert.deepEqual([...registry.matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]), EFFECT_KEYS, 'the effect registry is unchanged');
  const constraints = (await rows(
    `SELECT conname FROM pg_constraint WHERE conrelid='public.post_response_intelligence_effects'::regclass
       AND conname LIKE 'post_response_intelligence_effects_%_result_check' ORDER BY conname`,
  )).map((row) => row.conname);
  assert.deepEqual(constraints, [
    'post_response_intelligence_effects_association_result_check',
    'post_response_intelligence_effects_candidate_result_check',
    'post_response_intelligence_effects_claimed_result_check',
    'post_response_intelligence_effects_confidence_result_check',
    'post_response_intelligence_effects_intent_result_check',
    'post_response_intelligence_effects_memory_result_check',
    'post_response_intelligence_effects_persistence_result_check',
    'post_response_intelligence_effects_untyped_result_check',
    'post_response_intelligence_effects_update_batch_result_check',
  ], 'every earlier result check survives and the Confidence check joins them');
  // No column was added to the effect ledger: the child plan is its own table.
  assert.equal((await one(
    `SELECT count(*)::int total FROM information_schema.columns
      WHERE table_schema='public' AND table_name='post_response_intelligence_effects'
        AND column_name IN ('confidence_items','confidence_targets','confidence_state')`,
  )).total, 0, 'no Confidence column was added to the effect ledger');

  // The child work table's exact bounded shape.
  const columns = await rows(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='post_response_confidence_batch_items' ORDER BY ordinal_position`,
  );
  assert.deepEqual(columns.map((column) => column.column_name),
    ['execution_id', 'ordinal', 'hypothesis_id', 'target_version', 'confidence_evaluation_id', 'state', 'failure_code', 'created_at', 'updated_at'],
    'the item table carries exactly the audit-required columns and no content');
  assert.deepEqual(columns.filter((column) => column.is_nullable === 'YES').map((column) => column.column_name), ['failure_code']);
  assert.equal((await one(`SELECT relrowsecurity rls FROM pg_class WHERE oid='${ITEMS_TABLE}'::regclass`)).rls, true, 'the item table has RLS enabled');
  assert.equal((await one(`SELECT pg_get_userbyid(relowner) owner FROM pg_class WHERE oid='${ITEMS_TABLE}'::regclass`)).owner, 'postgres');
  const itemConstraints = (await rows(
    `SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='${ITEMS_TABLE}'::regclass ORDER BY conname`,
  )).map((row) => row.definition).join('\n');
  for (const proof of [
    'PRIMARY KEY (execution_id, ordinal)',
    'UNIQUE (execution_id, hypothesis_id)',
    'UNIQUE (confidence_evaluation_id)',
  ]) assert.ok(itemConstraints.includes(proof), `missing item constraint: ${proof}`);
  assert.match(itemConstraints, /FOREIGN KEY \(execution_id\) REFERENCES [\w.]*post_response_intelligence_executions\(id\) ON DELETE RESTRICT/u,
    'items are bound to their execution and can never orphan it');
  assert.match(itemConstraints, /ordinal >= 1/u, 'the plan starts at ordinal one');
  assert.match(itemConstraints, /ordinal <= 5/u, 'the plan is bounded to five items');
  assert.match(itemConstraints, /target_version > 0/u);
  for (const code of ['CONFIDENCE_ATTEMPT_FAILED', 'TARGET_UNAVAILABLE', 'TARGET_VERSION_DRIFT', 'EVALUATION_ID_CONFLICT', 'RESULT_INTEGRITY_FAILURE']) {
    assert.ok(itemConstraints.includes(`'${code}'`), `the bounded failure vocabulary includes ${code}`);
  }
  for (const state of ['PENDING', 'RETRY_PENDING', 'EVALUATED', 'QUARANTINED']) {
    assert.ok(itemConstraints.includes(`'${state}'`), `the bounded item state vocabulary includes ${state}`);
  }
  // A bounded reason is mandatory for retry/quarantine and forbidden otherwise.
  await q('SAVEPOINT bounds');
  const { execution: boundsExecution } = await newGeneration(1);
  await identity('postgres');
  const boundsInsert = (state, failure, ordinal = 1) => q(
    `INSERT INTO ${ITEMS_TABLE}(execution_id,ordinal,hypothesis_id,target_version,confidence_evaluation_id,state,failure_code)
      VALUES($1,$2,$3,1,$4,$5,$6)`,
    [boundsExecution.id, ordinal, randomUUID(), randomUUID(), state, failure],
  );
  for (const [label, state, failure] of [
    ['an unexplained RETRY_PENDING', 'RETRY_PENDING', null],
    ['an unexplained QUARANTINED', 'QUARANTINED', null],
    ['an EVALUATED item carrying a failure code', 'EVALUATED', 'CONFIDENCE_ATTEMPT_FAILED'],
    ['a PENDING item carrying a failure code', 'PENDING', 'CONFIDENCE_ATTEMPT_FAILED'],
    ['an unknown state', 'DONE', null],
    ['an unknown failure code', 'QUARANTINED', 'PROVIDER_EXPLODED'],
  ]) await rejected(() => boundsInsert(state, failure), ['23514']);
  await rejected(() => boundsInsert('EVALUATED', null, 6), ['23514']);
  await q('ROLLBACK TO SAVEPOINT bounds'); await q('RELEASE SAVEPOINT bounds');

  for (const [signature, expected] of [
    [CONFIDENCE_RPC, { service_role: true, authenticated: false, anon: false, public: false }],
    [RESULT_VALIDATOR, { service_role: false, authenticated: false, anon: false, public: false }],
    [GENERIC, { service_role: true, authenticated: false, anon: false, public: false }],
    [CLAIM_RPC, { service_role: true, authenticated: false, anon: false, public: false }],
  ]) {
    for (const [role, allowedExpected] of Object.entries(expected)) {
      const { allowed } = await one('SELECT has_function_privilege($1,$2,$3) allowed', [role, signature, 'EXECUTE']);
      assert.equal(allowed, allowedExpected, `${role} EXECUTE ${signature}`);
    }
    const { owner, definer, config } = await one(
      'SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config FROM pg_proc p WHERE p.oid=$1::regprocedure',
      [signature],
    );
    assert.equal(owner, 'postgres', `${signature} owner`);
    assert.ok(Array.isArray(config) && config.length === 1 && config[0].startsWith('search_path='), `${signature} search_path`);
    assert.equal(definer, signature !== RESULT_VALIDATOR, `${signature} definer posture`);
  }
  assert.equal((await one('SELECT p.provolatile volatile FROM pg_proc p WHERE p.oid=$1::regprocedure', [RESULT_VALIDATOR])).volatile, 'i',
    'the receipt validator is IMMUTABLE');
  assert.equal((await one('SELECT public.post_response_confidence_batch_result_valid_v1(NULL) valid')).valid, false, 'a NULL payload is a hard false');

  // No role gained direct DML anywhere the managed command writes.
  for (const role of ['authenticated', 'anon', 'service_role']) {
    for (const table of [ITEMS_TABLE, 'public.post_response_intelligence_effects', 'public.post_response_intelligence_executions', 'public.hypotheses', 'public.confidence_evaluations']) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
        const { allowed } = await one('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} ${privilege} on ${table}`);
      }
    }
    const { allowed } = await one('SELECT has_table_privilege($1,$2,$3) allowed', [role, ITEMS_TABLE, 'SELECT']);
    assert.equal(allowed, false, `${role} SELECT on ${ITEMS_TABLE}`);
  }

  // Ordinary claim AND generic completion now both fail closed for the managed
  // Confidence batch; every other error contract is byte-for-byte preserved.
  const { execution } = await newGeneration(0);
  await identity('service_role');
  const managedClaim = await rejected(() => q(CLAIM, [execution.id, 'CONFIDENCE_BATCH']), ['22023']);
  assert.equal(managedClaim.message, 'CONFIDENCE_BATCH_MANAGED');
  const managedComplete = await rejected(() => q(COMPLETE_GENERIC, [execution.id, 'CONFIDENCE_BATCH']), ['22023']);
  assert.equal(managedComplete.message, 'CONFIDENCE_BATCH_COMMAND_REQUIRED');
  for (const [key, message] of [
    ['MEMORY_WRITE', 'MEMORY_RESULT_REQUIRED'], ['INTENT_PROVIDER', 'INTENT_RESULT_REQUIRED'],
    ['ASSOCIATION_PROVIDER', 'ASSOCIATION_RESULT_REQUIRED'], ['CANDIDATE_PROVIDER', 'CANDIDATE_RESULT_REQUIRED'],
    ['HYPOTHESIS_PERSISTENCE', 'HYPOTHESIS_PERSISTENCE_COMMAND_REQUIRED'], ['HYPOTHESIS_UPDATE_BATCH', 'HYPOTHESIS_UPDATE_BATCH_COMMAND_REQUIRED'],
  ]) {
    const error = await rejected(() => q(COMPLETE_GENERIC, [execution.id, key]), ['22023']);
    assert.equal(error.message, message, `${key} keeps its exact generic-completion contract`);
  }
  const managedUpdateClaim = await rejected(() => q(CLAIM, [execution.id, 'HYPOTHESIS_UPDATE_BATCH']), ['22023']);
  assert.equal(managedUpdateClaim.message, 'HYPOTHESIS_UPDATE_BATCH_MANAGED', 'the A2.3c claim contract is unchanged');
  // Claim parity survives for every claimable key.
  for (const key of ['MEMORY_WRITE', 'ASSOCIATION_PROVIDER']) {
    assert.equal((await one(CLAIM, [execution.id, key])).ok, true, `claim ${key}`);
  }
  // No end-user role can run the managed command.
  for (const role of ['authenticated', 'anon']) {
    await identity(role);
    await rejected(() => q(EXECUTE, [execution.id]), ['42501']);
    await rejected(() => q(`SELECT count(*) FROM ${ITEMS_TABLE}`), ['42501']);
  }
  await identity('postgres');
}

async function verifyResultValidator() {
  stage = 'durable receipt validator';
  await identity('postgres');
  const receipt = (ordinal, over = {}) => ({
    ordinal, hypothesisId: randomUUID(), targetVersion: 3, confidenceEvaluationId: randomUUID(), ...over,
  });
  assert.equal((await one(VALID_RESULT, [JSON.stringify([receipt(1)])])).valid, true);
  assert.equal((await one(VALID_RESULT, [JSON.stringify([receipt(1), receipt(2), receipt(3), receipt(4), receipt(5)])])).valid, true);
  const shared = receipt(1);
  for (const [label, payload] of [
    ['json null', 'null'],
    ['an object payload', JSON.stringify(receipt(1))],
    ['an empty receipt list', '[]'],
    ['six receipts', JSON.stringify([receipt(1), receipt(2), receipt(3), receipt(4), receipt(5), receipt(6)])],
    ['a non-sequential ordinal', JSON.stringify([receipt(2)])],
    ['a stringified ordinal', JSON.stringify([receipt(1, { ordinal: '1' })])],
    ['a missing key', JSON.stringify([(({ targetVersion, ...rest }) => rest)(receipt(1))])],
    ['an extra key', JSON.stringify([{ ...receipt(1), extra: true }])],
    ['a non-canonical Hypothesis identity', JSON.stringify([receipt(1, { hypothesisId: 'not-a-uuid' })])],
    ['a non-canonical evaluation identity', JSON.stringify([receipt(1, { confidenceEvaluationId: 7 })])],
    ['a duplicate target', JSON.stringify([shared, receipt(2, { hypothesisId: shared.hypothesisId })])],
    ['a duplicate evaluation identity', JSON.stringify([shared, receipt(2, { confidenceEvaluationId: shared.confidenceEvaluationId })])],
    ['a UUID reused across identity sets', JSON.stringify([receipt(1, { confidenceEvaluationId: shared.hypothesisId, hypothesisId: shared.hypothesisId })])],
    ['a zero target version', JSON.stringify([receipt(1, { targetVersion: 0 })])],
    ['a negative target version', JSON.stringify([receipt(1, { targetVersion: -3 })])],
    ['a fractional target version', JSON.stringify([receipt(1, { targetVersion: 1.5 })])],
    ['a stringified target version', JSON.stringify([receipt(1, { targetVersion: '3' })])],
    ['an out-of-int32 target version', JSON.stringify([receipt(1, { targetVersion: 2147483648 })])],
  ]) {
    assert.equal((await one(VALID_RESULT, [payload])).valid, false, `rejects ${label}`);
  }
  for (const role of ['service_role', 'authenticated', 'anon']) {
    await identity(role);
    await rejected(() => q(VALID_RESULT, ['[]']), ['42501']);
  }
  await identity('postgres');
}

async function verifyZeroTargets() {
  stage = 'zero-target typed batch';
  const { execution } = await newGeneration(0);
  assert.equal(await run(execution.id), 'COMPLETED', 'a zero-target batch completes immediately');
  await identity('postgres');
  const effect = await one(EFFECT, [execution.id, 'CONFIDENCE_BATCH']);
  assert.equal(effect.state, 'COMPLETED');
  assert.equal(effect.result_code, 'NO_CONFIDENCE_TARGETS');
  assert.equal(effect.result_reference, null);
  assert.equal(effect.result_payload, null);
  assert.equal((await rows(ITEMS, [execution.id])).length, 0, 'no item row is required for zero targets');
  assert.equal((await one('SELECT count(*)::int total FROM public.confidence_evaluations WHERE user_id=$1', [userId])).total, 0,
    'a zero-target batch writes no Confidence row');
  // Replay changes nothing.
  assert.equal(await run(execution.id), 'COMPLETED');
  await identity('postgres');
  assert.deepEqual(await one(EFFECT, [execution.id, 'CONFIDENCE_BATCH']), effect, 'the first durable result is immutable');
  assert.equal((await rows(ITEMS, [execution.id])).length, 0);
  return execution;
}

async function verifySingleTarget() {
  stage = 'single-target typed batch';
  const { execution, hypothesisIds, versions } = await newGeneration(1);
  const [target] = hypothesisIds;
  const [frozen] = versions;
  assert.ok(frozen > 0, 'the canonical post-persistence version is positive');
  assert.equal(await run(execution.id), 'COMPLETED');
  await identity('postgres');
  const items = await rows(ITEMS, [execution.id]);
  assert.equal(items.length, 1);
  assert.equal(items[0].ordinal, 1);
  assert.equal(items[0].hypothesis_id, target, 'the target came from the durable persistence result');
  assert.equal(items[0].target_version, frozen, 'the exact current post-persistence version was frozen');
  assert.equal(items[0].state, 'EVALUATED');
  assert.equal(items[0].failure_code, null);
  const evaluations = await confidenceRows(target);
  assert.equal(evaluations.length, 1, 'exactly one Confidence evaluation for the target');
  assert.equal(evaluations[0].id, items[0].confidence_evaluation_id, 'the stable durable evaluation identity was used');
  assert.equal(evaluations[0].user_id, userId, 'the owner came from the execution');
  assert.equal(evaluations[0].target_type, 'HYPOTHESIS');
  assert.equal(evaluations[0].target_version, frozen);
  assert.equal(evaluations[0].provenance, 'QANDEEL_CONFIDENCE_RUNTIME', 'the canonical Confidence boundary produced the row');
  assert.equal(evaluations[0].policy_version, 'confidence-foundation-v1');
  const effect = await one(EFFECT, [execution.id, 'CONFIDENCE_BATCH']);
  assert.equal(effect.state, 'COMPLETED');
  assert.equal(effect.result_code, 'CONFIDENCE_BATCH_EVALUATED');
  assert.equal(effect.result_reference, null);
  assert.deepEqual(effect.result_payload, [{
    ordinal: 1, hypothesisId: target, targetVersion: frozen, confidenceEvaluationId: items[0].confidence_evaluation_id,
  }], 'the typed receipt is exact');
  // Replay produces zero duplicate Confidence and never rewrites the result.
  assert.equal(await run(execution.id), 'COMPLETED');
  await identity('postgres');
  assert.equal((await confidenceRows(target)).length, 1, 'redelivery adds no duplicate Confidence row');
  assert.deepEqual(await one(EFFECT, [execution.id, 'CONFIDENCE_BATCH']), effect);
  assert.deepEqual(await rows(ITEMS, [execution.id]), items, 'item identities remain stable');
  return { execution, effect, target };
}

async function verifyMultiTarget() {
  stage = 'ordered multi-target typed batch';
  let generation = await newGeneration(3);
  // Prove the receipt keeps the durable PERSISTENCE order, not the deterministic
  // UUID lock order: insist the two orders differ.
  let attempts = 0;
  while (JSON.stringify(generation.hypothesisIds) === JSON.stringify([...generation.hypothesisIds].sort()) && attempts < 8) {
    generation = await newGeneration(3);
    attempts += 1;
  }
  const { execution, hypothesisIds, versions } = generation;
  assert.equal(await run(execution.id), 'COMPLETED');
  await identity('postgres');
  const items = await rows(ITEMS, [execution.id]);
  assert.deepEqual(items.map((item) => item.ordinal), [1, 2, 3]);
  assert.deepEqual(items.map((item) => item.hypothesis_id), hypothesisIds, 'exact durable persistence order retained');
  assert.deepEqual(items.map((item) => item.target_version), versions, 'each item froze its own exact current version');
  assert.deepEqual(items.map((item) => item.state), ['EVALUATED', 'EVALUATED', 'EVALUATED']);
  assert.equal(new Set(items.map((item) => item.confidence_evaluation_id)).size, 3, 'one stable evaluation identity per target');
  for (const [index, hypothesisId] of hypothesisIds.entries()) {
    const evaluations = await confidenceRows(hypothesisId);
    assert.equal(evaluations.length, 1, `exactly one evaluation for target ${index + 1}`);
    assert.equal(evaluations[0].id, items[index].confidence_evaluation_id);
    assert.equal(evaluations[0].target_version, versions[index]);
  }
  const effect = await one(EFFECT, [execution.id, 'CONFIDENCE_BATCH']);
  assert.equal(effect.result_code, 'CONFIDENCE_BATCH_EVALUATED');
  assert.deepEqual(effect.result_payload.map((entry) => entry.hypothesisId), hypothesisIds, 'the receipt order is the persistence order');
  assert.deepEqual(effect.result_payload.map((entry) => entry.ordinal), [1, 2, 3]);
  // The effect completes exactly once.
  assert.equal(await run(execution.id), 'COMPLETED');
  await identity('postgres');
  assert.deepEqual(await one(EFFECT, [execution.id, 'CONFIDENCE_BATCH']), effect);
  assert.equal((await one('SELECT count(*)::int total FROM public.confidence_evaluations WHERE target_id=ANY($1)', [hypothesisIds])).total, 3);
}

async function verifyPartialFailureAndRetry() {
  stage = 'per-target failure, durable retry state and repaired retry';
  const { execution, hypothesisIds, versions } = await newGeneration(2);
  const [first, second] = hypothesisIds;
  await armFault(second);
  assert.equal(await run(execution.id), 'RETRY_PENDING', 'one failed target can never complete the batch');
  await armFault(null);
  await identity('postgres');
  const firstAttempt = await rows(ITEMS, [execution.id]);
  assert.deepEqual(firstAttempt.map((item) => item.state), ['EVALUATED', 'RETRY_PENDING']);
  assert.deepEqual(firstAttempt.map((item) => item.failure_code), [null, 'CONFIDENCE_ATTEMPT_FAILED']);
  // No raw exception text, stack trace or provider payload was persisted.
  assert.equal(JSON.stringify(firstAttempt).includes('VERIFIER_FORCED_CONFIDENCE_FAULT'), false, 'no exception text is persisted');
  assert.equal((await confidenceRows(first)).length, 1, 'the successful target committed its evaluation');
  assert.equal((await confidenceRows(second)).length, 0, 'the failed target has no Confidence row of any version');
  assert.equal(await one(EFFECT, [execution.id, 'CONFIDENCE_BATCH']), undefined, 'no completed CONFIDENCE_BATCH effect exists');
  assert.equal((await one('SELECT state FROM public.post_response_intelligence_executions WHERE id=$1', [execution.id])).state, 'RUNNING',
    'the execution stays RUNNING for the existing Redis reclaim path');

  // A corrupted item plan fails closed instead of resuming.
  await q('SAVEPOINT corrupt');
  await q(`UPDATE ${ITEMS_TABLE} SET hypothesis_id=$2 WHERE execution_id=$1 AND ordinal=1`, [execution.id, randomUUID()]);
  assert.equal(await run(execution.id), 'QUARANTINED', 'an item plan that no longer matches the durable persistence list quarantines');
  await identity('postgres');
  await q('ROLLBACK TO SAVEPOINT corrupt'); await q('RELEASE SAVEPOINT corrupt');

  // Repair the transient fault and retry: only the unfinished target runs, with
  // the SAME durable evaluation identity and the SAME frozen version.
  assert.equal(await run(execution.id), 'COMPLETED');
  await identity('postgres');
  const retried = await rows(ITEMS, [execution.id]);
  assert.deepEqual(retried.map((item) => item.state), ['EVALUATED', 'EVALUATED']);
  assert.deepEqual(retried.map((item) => item.failure_code), [null, null]);
  assert.deepEqual(retried.map((item) => item.confidence_evaluation_id), firstAttempt.map((item) => item.confidence_evaluation_id),
    'evaluation identities are never regenerated');
  assert.deepEqual(retried.map((item) => item.target_version), versions, 'frozen versions are never rediscovered');
  assert.equal((await confidenceRows(first)).length, 1, 'the already-evaluated target is never re-evaluated');
  const secondEvaluations = await confidenceRows(second);
  assert.equal(secondEvaluations.length, 1, 'the retried target evaluated exactly once');
  assert.equal(secondEvaluations[0].id, retried[1].confidence_evaluation_id);
  assert.equal(secondEvaluations[0].target_version, versions[1]);
  const effect = await one(EFFECT, [execution.id, 'CONFIDENCE_BATCH']);
  assert.equal(effect.result_code, 'CONFIDENCE_BATCH_EVALUATED');
  assert.deepEqual(effect.result_payload.map((entry) => entry.confidenceEvaluationId), retried.map((item) => item.confidence_evaluation_id));
}

async function verifyVersionDrift() {
  stage = 'target version drift before retry';
  const { execution, hypothesisIds, versions } = await newGeneration(2);
  const [first, second] = hypothesisIds;
  await armFault(second);
  assert.equal(await run(execution.id), 'RETRY_PENDING');
  await armFault(null);
  // Advance the unfinished target through an authorized canonical mutation.
  await identity('service_role');
  const mutation = await one(
    'SELECT * FROM public.background_apply_hypothesis_evidence_update_v1($1,$2,$3,$4,$5,$6,$7)',
    [userId, execution.session, randomUUID(), second, versions[1], evidence.drift, 'SUPPORTING'],
  );
  assert.ok(mutation, 'the canonical mutation applied');
  await identity('postgres');
  assert.equal((await one(HYPOTHESIS, [second])).version, versions[1] + 1, 'the target advanced past its frozen version');
  assert.equal(await run(execution.id), 'QUARANTINED', 'a drifted target can never complete the batch');
  await identity('postgres');
  const items = await rows(ITEMS, [execution.id]);
  assert.deepEqual(items.map((item) => item.state), ['EVALUATED', 'QUARANTINED']);
  assert.equal(items[1].failure_code, 'TARGET_VERSION_DRIFT');
  assert.equal(items[1].target_version, versions[1], 'the frozen version is never rewritten to the newer one');
  assert.equal((await confidenceRows(second)).length, 0, 'no Confidence row of ANY version was created for the drifted target');
  assert.equal((await confidenceRows(first)).length, 1, 'the already-evaluated sibling survives untouched');
  assert.equal(await one(EFFECT, [execution.id, 'CONFIDENCE_BATCH']), undefined, 'no batch completion');
  // The quarantine is deterministic on redelivery.
  assert.equal(await run(execution.id), 'QUARANTINED');
  await identity('postgres');
  assert.deepEqual(await rows(ITEMS, [execution.id]), items);
}

async function verifyEvaluationIdConflict() {
  stage = 'pre-existing conflicting evaluation identity';
  const { execution, hypothesisIds } = await newGeneration(1);
  const [target] = hypothesisIds;
  await armFault(target);
  assert.equal(await run(execution.id), 'RETRY_PENDING');
  await armFault(null);
  await identity('postgres');
  const [item] = await rows(ITEMS, [execution.id]);
  assert.equal(item.state, 'RETRY_PENDING');
  // A foreign Confidence row now occupies this item's durable evaluation
  // identity. It must never be mistaken for this batch's success.
  const decoy = await newGeneration(1);
  await identity('service_role');
  const foreign = await one('SELECT * FROM public.background_create_confidence_evaluation_v1($1,$2,$3,$4)',
    [userId, item.confidence_evaluation_id, decoy.hypothesisIds[0], decoy.versions[0]]);
  assert.equal(foreign.id, item.confidence_evaluation_id);
  assert.equal(await run(execution.id), 'QUARANTINED', 'a conflicting evaluation identity fails closed');
  await identity('postgres');
  const [quarantined] = await rows(ITEMS, [execution.id]);
  assert.equal(quarantined.state, 'QUARANTINED');
  assert.equal(quarantined.failure_code, 'EVALUATION_ID_CONFLICT');
  assert.equal((await confidenceRows(target)).length, 0, 'the batch never claimed the foreign row as its own');
  assert.equal(await one(EFFECT, [execution.id, 'CONFIDENCE_BATCH']), undefined);
}

async function verifyAuthorityGuards() {
  stage = 'target and execution authority';
  // A missing or terminal execution is a bounded no-op, never a write.
  assert.equal(await run(randomUUID()), 'NO_OP');
  const { execution } = await newGeneration(1);
  await identity('service_role');
  assert.equal((await one("SELECT public.finish_post_response_intelligence_execution_v1($1,'COMPLETED','COMPLETED','DONE') ok", [execution.id])).ok, true);
  assert.equal(await run(execution.id), 'NO_OP', 'a terminal execution is a no-op');
  await identity('postgres');
  assert.equal((await rows(ITEMS, [execution.id])).length, 0, 'a no-op writes no item');

  // A durable target that is no longer owned by the execution user can never be
  // planned: nothing is fabricated and no item row is written.
  const foreign = await newGeneration(1);
  await identity('postgres');
  await q('UPDATE public.hypotheses SET user_id=$2 WHERE id=$1', [foreign.hypothesisIds[0], otherUserId]);
  assert.equal(await run(foreign.execution.id), 'QUARANTINED', 'a foreign target quarantines before any plan is written');
  await identity('postgres');
  assert.equal((await rows(ITEMS, [foreign.execution.id])).length, 0);
  assert.equal(await one(EFFECT, [foreign.execution.id, 'CONFIDENCE_BATCH']), undefined);

  // A target that vanished after the plan was frozen is bounded, not inferred.
  const vanished = await newGeneration(1);
  await armFault(vanished.hypothesisIds[0]);
  assert.equal(await run(vanished.execution.id), 'RETRY_PENDING');
  await armFault(null);
  await identity('postgres');
  await q('UPDATE public.hypotheses SET user_id=$2 WHERE id=$1', [vanished.hypothesisIds[0], otherUserId]);
  assert.equal(await run(vanished.execution.id), 'QUARANTINED');
  await identity('postgres');
  const [item] = await rows(ITEMS, [vanished.execution.id]);
  assert.equal(item.state, 'QUARANTINED');
  assert.equal(item.failure_code, 'TARGET_UNAVAILABLE');
  assert.equal(await one(EFFECT, [vanished.execution.id, 'CONFIDENCE_BATCH']), undefined);
}

// Historical texts, to reconstruct a genuine pre-0035 database (the canonical
// 0034 chain state) rather than a hand-written approximation of one.
function historicalFunction(source, marker) {
  const start = source.indexOf(marker);
  const terminator = 'END;$$;';
  return source.slice(start, source.indexOf(terminator, start) + terminator.length);
}

async function verifyUpgradeFromCanonical0034() {
  stage = 'pre-0035 reproduction and upgrade';
  await q('SAVEPOINT upgrade');
  await identity('postgres');
  // Reconstruct the exact canonical pre-0035 surface: no child table, no
  // Confidence result domain, and 0034's claim/generic-completion rules.
  await q('ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_confidence_result_check');
  await q('ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check');
  await q(`ALTER TABLE public.post_response_intelligence_effects ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK (
    effect_key IN ('MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER','CANDIDATE_PROVIDER','HYPOTHESIS_PERSISTENCE','HYPOTHESIS_UPDATE_BATCH')
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL))`);
  await q(`DROP FUNCTION ${CONFIDENCE_RPC}`);
  await q(`DROP TABLE ${ITEMS_TABLE}`);
  await q(`DROP FUNCTION ${RESULT_VALIDATOR}`);
  await q(historicalFunction(updateBatchSql, 'CREATE OR REPLACE FUNCTION public.claim_post_response_intelligence_effect_v1'));
  await q(historicalFunction(updateBatchSql, 'CREATE OR REPLACE FUNCTION public.complete_post_response_intelligence_effect_v1'));

  // Pre-0035 CONFIDENCE_BATCH was the sole generic result-less effect: a
  // completed all-null row and an unrecoverable CLAIMED row are the two legacy
  // states this migration must never rewrite or infer from.
  const legacyCompleted = await newGeneration(1);
  await identity('service_role');
  assert.equal((await one(CLAIM, [legacyCompleted.execution.id, 'CONFIDENCE_BATCH'])).ok, true, 'pre-0035 generic claim');
  assert.equal((await one(COMPLETE_GENERIC, [legacyCompleted.execution.id, 'CONFIDENCE_BATCH'])).ok, true, 'pre-0035 generic completion');
  const legacyClaimed = await newGeneration(1);
  await identity('service_role');
  assert.equal((await one(CLAIM, [legacyClaimed.execution.id, 'CONFIDENCE_BATCH'])).ok, true);

  await identity('postgres');
  const executionIds = [legacyCompleted.execution.id, legacyClaimed.execution.id];
  const before = await rows(
    'SELECT to_jsonb(effect) row FROM public.post_response_intelligence_effects effect WHERE execution_id=ANY($1) ORDER BY execution_id, effect_key',
    [executionIds],
  );
  const hypothesesBefore = await rows('SELECT to_jsonb(h) row FROM public.hypotheses h WHERE id=ANY($1) ORDER BY id',
    [[legacyCompleted.hypothesisIds[0], legacyClaimed.hypothesisIds[0]]]);
  const { total: totalBefore } = await one('SELECT count(*)::int total FROM public.post_response_intelligence_effects');
  const { total: confidenceBefore } = await one('SELECT count(*)::int total FROM public.confidence_evaluations');
  const { columns: columnsBefore } = await one(
    "SELECT count(*)::int columns FROM information_schema.columns WHERE table_schema='public' AND table_name='post_response_intelligence_effects'",
  );

  await q(migrationSql.replace(/^\s*BEGIN;/mu, '').replace(/^\s*COMMIT;\s*$/mu, ''));

  // 0035 rewrites no historical state: every row is byte-identical, no column
  // is added, nothing is deleted and no Confidence is backfilled.
  assert.deepEqual(
    await rows('SELECT to_jsonb(effect) row FROM public.post_response_intelligence_effects effect WHERE execution_id=ANY($1) ORDER BY execution_id, effect_key', [executionIds]),
    before, 'the upgrade leaves existing effect rows byte-identical',
  );
  assert.deepEqual(await rows('SELECT to_jsonb(h) row FROM public.hypotheses h WHERE id=ANY($1) ORDER BY id',
    [[legacyCompleted.hypothesisIds[0], legacyClaimed.hypothesisIds[0]]]), hypothesesBefore, 'the upgrade performs no historical Hypothesis rewrite');
  assert.equal((await one('SELECT count(*)::int total FROM public.post_response_intelligence_effects')).total, totalBefore, 'the upgrade deletes nothing');
  assert.equal((await one('SELECT count(*)::int total FROM public.confidence_evaluations')).total, confidenceBefore, 'the upgrade backfills no Confidence');
  assert.equal((await one(
    "SELECT count(*)::int columns FROM information_schema.columns WHERE table_schema='public' AND table_name='post_response_intelligence_effects'",
  )).columns, columnsBefore, 'the upgrade adds no column');
  assert.equal((await one(`SELECT count(*)::int total FROM ${ITEMS_TABLE}`)).total, 0, 'no item plan is backfilled for historical executions');

  // Runtime classification of both legacy states remains fail-closed: neither is
  // inferred as success and neither is blindly replayed.
  assert.equal(await run(legacyCompleted.execution.id), 'QUARANTINED', 'a legacy completed all-null Confidence row is indeterminate');
  assert.equal(await run(legacyClaimed.execution.id), 'QUARANTINED', 'a legacy CLAIMED Confidence row is indeterminate');
  await identity('postgres');
  assert.deepEqual(
    await rows('SELECT to_jsonb(effect) row FROM public.post_response_intelligence_effects effect WHERE execution_id=ANY($1) ORDER BY execution_id, effect_key', [executionIds]),
    before, 'the fail-closed classification rewrites nothing',
  );
  assert.equal((await one(`SELECT count(*)::int total FROM ${ITEMS_TABLE}`)).total, 0);
  assert.equal((await one('SELECT count(*)::int total FROM public.confidence_evaluations')).total, confidenceBefore);

  await identity('postgres');
  await q('ROLLBACK TO SAVEPOINT upgrade');
  await q('RELEASE SAVEPOINT upgrade');
}

async function main() {
  try {
    await client.connect();
    await q('BEGIN');
    await identity('postgres');
    await q('INSERT INTO public.users(id,auth_subject) VALUES($1::uuid,$1::text),($2::uuid,$2::text)', [userId, otherUserId]);
    await q(
      `INSERT INTO public.memories(id,user_id,type,content,source,confidence,importance,status) VALUES
        ($1,$4,'GOAL','confidence batch fixture evidence one','USER_STATED',1,1,'ACTIVE'),
        ($2,$4,'GOAL','confidence batch fixture evidence two','USER_CONFIRMED',1,1,'ACTIVE'),
        ($3,$4,'PERSONAL_FACT','confidence batch drift evidence','USER_STATED',1,1,'ACTIVE')`,
      [memories.first, memories.second, memories.drift, userId],
    );
    // Bounded verifier-only transient fault: one temporary trigger that raises
    // for exactly the target named by a transaction-local setting. It is armed
    // and disarmed explicitly, is invisible to the canonical runtime, and is
    // rolled back with everything else.
    await q(`CREATE FUNCTION public.qandeel_verifier_confidence_fault_v1() RETURNS trigger
      LANGUAGE plpgsql SET search_path='' AS $$
      BEGIN
        IF nullif(current_setting('${FAULT_SETTING}', true),'') IS NOT NULL
           AND NEW.target_id = nullif(current_setting('${FAULT_SETTING}', true),'')::uuid
        THEN RAISE EXCEPTION 'VERIFIER_FORCED_CONFIDENCE_FAULT' USING ERRCODE='P0001'; END IF;
        RETURN NEW;
      END;$$`);
    await q(`CREATE TRIGGER qandeel_verifier_confidence_fault BEFORE INSERT ON public.confidence_evaluations
      FOR EACH ROW EXECUTE FUNCTION public.qandeel_verifier_confidence_fault_v1()`);
    await armFault(null);

    await verifySurfaceAndAcls();
    await verifyResultValidator();
    // The upgrade reconstruction runs BEFORE any typed Confidence result exists
    // in this transaction, so the reconstructed pre-0035 constraints describe a
    // genuine pre-0035 database rather than being weakened to tolerate rows a
    // pre-0035 schema could never have held.
    await verifyUpgradeFromCanonical0034();
    await verifyZeroTargets();
    const single = await verifySingleTarget();
    await verifyMultiTarget();
    await verifyPartialFailureAndRetry();
    await verifyVersionDrift();
    await verifyEvaluationIdConflict();
    await verifyAuthorityGuards();

    // Nothing above disturbed the durable receipt already written.
    await identity('postgres');
    assert.deepEqual(await one(EFFECT, [single.execution.id, 'CONFIDENCE_BATCH']), single.effect);
    assert.equal((await confidenceRows(single.target)).length, 1);

    console.log('Verified migration 0035: CONFIDENCE_BATCH is a managed typed effect whose ordinary claim and generic completion both fail closed (CONFIDENCE_BATCH_MANAGED / CONFIDENCE_BATCH_COMMAND_REQUIRED) while every earlier effect contract is preserved verbatim; the bounded child item table is service-internal with no direct DML for anon, authenticated or service_role, a 1..5 ordinal bound, per-execution target uniqueness, globally unique evaluation identities and a bounded failure vocabulary; the internal IMMUTABLE receipt validator rejects every malformed payload; the service-role-only managed command takes ONLY the execution identity, derives the owner from the execution and the exact ordered targets from the durable HYPOTHESIS_PERSISTENCE result, freezes each target current version once, generates one stable evaluation UUID per target and reuses background_create_confidence_evaluation_v1; a zero-target batch writes NO_CONFIDENCE_TARGETS exactly once with no item and no Confidence row; single- and ordered multi-target batches evaluate each target exactly once and complete with the exact ordered receipt; a forced per-target failure leaves a durable RETRY_PENDING item, a committed sibling evaluation, no completed effect and a still-RUNNING execution; the repaired retry re-evaluates only the unfinished target with the SAME durable evaluation identity and frozen version and never duplicates an immutable Confidence row; a version advance before retry quarantines with TARGET_VERSION_DRIFT and creates no Confidence row of any version; a pre-existing conflicting evaluation identity quarantines with EVALUATION_ID_CONFLICT instead of being mistaken for success; a corrupted item plan, a foreign target and a vanished target all fail closed; repeated invocation after a durable result is a no-op against an immutable first result; and the upgrade from the canonical 0034 chain leaves every historical row byte-identical with no backfilled Confidence and a fail-closed classification of both legacy completed and claimed Confidence rows.');
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Confidence batch reliability verification failed at ${stage} (${code}): ${error?.message ?? 'unknown assertion'}. Connection details were suppressed.`);
  process.exitCode = 1;
});
