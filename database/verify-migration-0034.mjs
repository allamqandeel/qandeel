// Automatic Hypothesis Update Invocation + Durable Recovery (migration 0034)
// adversarial verifier.
//
// Runs against a fully migrated database. It proves the managed
// HYPOTHESIS_UPDATE_BATCH contract end to end on real PostgreSQL: the effect
// registry and ACLs (ordinary claim and generic completion both fail closed
// for the managed effect, and since migration 0035 for CONFIDENCE_BATCH too);
// internal invocation-ID and receipt validators; that the managed execute
// command derives user/session from the execution and its commands ONLY from
// the exact durable ASSOCIATION_PROVIDER / AUTHORIZED_COMMANDS result with the
// same-execution durable Memory Evidence provenance; successful one- and
// multi-command batches with exact immutable audit IDs, exact-version
// Confidence and the exact ordered durable receipt; that a stale second
// command rolls back the entire batch (zero mutation, zero audit, zero
// Confidence); that Evidence eligibility drift and cross-user / cross-session
// targets reject deterministically with zero partial mutation; that a
// Confidence failure keeps the committed mutation batch and records a durable
// PENDING_RETRY with no later-version substitution; that an unexpected
// failure aborts the whole managed transaction leaving no batch effect and no
// mutation; that a second execution performs zero duplicate mutation; and that
// the upgrade path rewrites no historical state. Every fixture is rolled
// back; no data is retained. No paid provider is ever invoked.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const migrationSql = await readFile(new URL('./migrations/0034_automatic_hypothesis_update_invocation_recovery_v1.sql', import.meta.url), 'utf8');
const dispatchSql = await readFile(new URL('./migrations/0022_post_response_intelligence_dispatch_v1.sql', import.meta.url), 'utf8');
const generationSql = await readFile(new URL('./migrations/0033_hypothesis_generation_atomicity_recovery_v1.sql', import.meta.url), 'utf8');
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

const IDS_VALIDATOR = 'public.post_response_hypothesis_update_invocation_ids_valid_v1(jsonb)';
const RESULT_VALIDATOR = 'public.post_response_hypothesis_update_batch_result_valid_v1(jsonb)';
const EXECUTE_RPC = 'public.execute_post_response_hypothesis_update_batch_v1(uuid,jsonb)';
const GENERIC = 'public.complete_post_response_intelligence_effect_v1(uuid,text)';
const CLAIM_RPC = 'public.claim_post_response_intelligence_effect_v1(uuid,text)';
const ACQUIRE = 'SELECT * FROM public.acquire_post_response_intelligence_execution_v1($1,$2,$3,$4,$5,$6,$7,$8)';
const CLAIM = 'SELECT public.claim_post_response_intelligence_effect_v1($1,$2) ok';
const COMPLETE_GENERIC = 'SELECT public.complete_post_response_intelligence_effect_v1($1,$2) ok';
const COMPLETE_MEMORY = 'SELECT public.complete_post_response_memory_write_effect_v1($1,$2,$3) ok';
const COMPLETE_ASSOCIATION = 'SELECT public.complete_post_response_association_provider_effect_v1($1,$2,$3) ok';
const EXECUTE = 'SELECT public.execute_post_response_hypothesis_update_batch_v1($1,$2::jsonb) ok';
const VALID_IDS = 'SELECT public.post_response_hypothesis_update_invocation_ids_valid_v1($1::jsonb) valid';
const VALID_RESULT = 'SELECT public.post_response_hypothesis_update_batch_result_valid_v1($1::jsonb) valid';
const EFFECT = 'SELECT * FROM public.post_response_intelligence_effects WHERE execution_id=$1 AND effect_key=$2';
const HYPOTHESIS = 'SELECT * FROM public.hypotheses WHERE id=$1';
const AUDITS = 'SELECT * FROM public.hypothesis_updates WHERE id=ANY($1) ORDER BY after_version';
const CONFIDENCE = 'SELECT * FROM public.confidence_evaluations WHERE id=ANY($1)';
const EFFECT_KEYS = ['MEMORY_WRITE', 'INTENT_PROVIDER', 'CANDIDATE_PROVIDER', 'ASSOCIATION_PROVIDER', 'HYPOTHESIS_UPDATE_BATCH', 'HYPOTHESIS_PERSISTENCE', 'CONFIDENCE_BATCH', 'HIM_BRAIN_CONTEXT_MATERIALIZATION'];

const userId = randomUUID();
const otherUserId = randomUUID();
const memoryId = randomUUID();
const driftMemoryId = randomUUID();
const evidence = `memory:${memoryId}`;
const driftEvidence = `memory:${driftMemoryId}`;

const command = (hypothesisId, over = {}) => ({ hypothesisId, expectedVersion: 1, evidenceId: evidence, evidenceRole: 'SUPPORTING', ...over });
const invocations = (count) => Array.from({ length: count }, () => ({ updateId: randomUUID(), confidenceEvaluationId: randomUUID() }));

// A fresh RUNNING execution with THIS execution's durable fresh-Memory result
// and a claimed Association effect ready for the typed completion.
async function newExecution({ withMemory = true, claimAssociation = true, evidenceReference = evidence } = {}) {
  const execution = { id: randomUUID(), session: randomUUID(), turn: randomUUID() };
  await identity('postgres');
  await q(ACQUIRE, [execution.id, randomUUID(), userId, execution.session, execution.turn, '2.0', 'FAST', 'ALLOW']);
  await identity('service_role');
  if (withMemory) {
    assert.equal((await one(CLAIM, [execution.id, 'MEMORY_WRITE'])).ok, true, 'claim MEMORY_WRITE');
    assert.equal((await one(COMPLETE_MEMORY, [execution.id, 'FRESH_EVIDENCE_CREATED', evidenceReference])).ok, true, 'complete MEMORY_WRITE');
  }
  if (claimAssociation) assert.equal((await one(CLAIM, [execution.id, 'ASSOCIATION_PROVIDER'])).ok, true, 'claim ASSOCIATION_PROVIDER');
  return execution;
}

async function authorize(execution, commands) {
  await identity('service_role');
  assert.equal((await one(COMPLETE_ASSOCIATION, [execution.id, 'AUTHORIZED_COMMANDS', JSON.stringify(commands)])).ok, true, 'complete ASSOCIATION_PROVIDER');
}

// A session-bound Hypothesis owned by the execution user unless told otherwise.
async function newHypothesis(session, { owner = userId, scope } = {}) {
  const id = randomUUID();
  await identity('postgres');
  await q(
    `INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,status)
      VALUES($1,$2,$3,'CAUSAL','GENERAL',$4,'SYSTEM_GENERATED','CANDIDATE')`,
    [id, owner, `automatic update target ${id}`, scope ?? `CONVERSATION_SESSION:${session}`],
  );
  return id;
}

async function hypothesisState(id) {
  await identity('postgres');
  const row = await one(HYPOTHESIS, [id]);
  return { version: row.version, supporting: row.supporting_evidence_ids, contradicting: row.contradicting_evidence_ids };
}

async function verifySurfaceAndAcls() {
  stage = 'effect registry, claim/completion rules and ACLs';
  await identity('postgres');
  const registry = (await one(
    `SELECT pg_get_constraintdef(oid) definition FROM pg_constraint
      WHERE conrelid='public.post_response_intelligence_effects'::regclass
        AND conname='post_response_intelligence_effects_effect_key_check'`,
  )).definition;
  assert.deepEqual([...registry.matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]), EFFECT_KEYS, 'the registry gains exactly the managed key');
  const constraints = (await rows(
    `SELECT conname FROM pg_constraint WHERE conrelid='public.post_response_intelligence_effects'::regclass
       AND conname LIKE 'post_response_intelligence_effects_%_result_check' ORDER BY conname`,
  )).map((row) => row.conname);
  assert.ok(constraints.includes('post_response_intelligence_effects_update_batch_result_check'), 'the managed result check exists');
  assert.equal(constraints.length, 9, 'every earlier result check survives alongside the 0035 Confidence check');

  for (const [signature, expected] of [
    [EXECUTE_RPC, { service_role: true, authenticated: false, anon: false, public: false }],
    [IDS_VALIDATOR, { service_role: false, authenticated: false, anon: false, public: false }],
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
    assert.equal(definer, signature !== IDS_VALIDATOR && signature !== RESULT_VALIDATOR, `${signature} definer posture`);
  }
  for (const validator of [IDS_VALIDATOR, RESULT_VALIDATOR]) {
    const { volatile: volatility } = await one('SELECT p.provolatile volatile FROM pg_proc p WHERE p.oid=$1::regprocedure', [validator]);
    assert.equal(volatility, 'i', `${validator} is IMMUTABLE`);
  }
  assert.equal((await one('SELECT public.post_response_hypothesis_update_invocation_ids_valid_v1(NULL) valid')).valid, false);
  assert.equal((await one('SELECT public.post_response_hypothesis_update_batch_result_valid_v1(NULL) valid')).valid, false);
  // No role gained direct DML anywhere the managed command writes.
  for (const role of ['authenticated', 'anon', 'service_role']) {
    for (const table of ['public.post_response_intelligence_effects', 'public.hypotheses', 'public.hypothesis_updates', 'public.confidence_evaluations']) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
        const { allowed } = await one('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} ${privilege} on ${table}`);
      }
    }
  }

  // Ordinary claim fails closed for the managed effect and keeps parity for
  // every claimable key; generic completion fails closed too. Migration 0035
  // made CONFIDENCE_BATCH managed as well, so no generic parity remains and the
  // A2.3c contracts below are unchanged by it.
  const execution = await newExecution({ withMemory: false, claimAssociation: false });
  await identity('service_role');
  const managedClaim = await rejected(() => q(CLAIM, [execution.id, 'HYPOTHESIS_UPDATE_BATCH']), ['22023']);
  assert.equal(managedClaim.message, 'HYPOTHESIS_UPDATE_BATCH_MANAGED');
  const managedComplete = await rejected(() => q(COMPLETE_GENERIC, [execution.id, 'HYPOTHESIS_UPDATE_BATCH']), ['22023']);
  assert.equal(managedComplete.message, 'HYPOTHESIS_UPDATE_BATCH_COMMAND_REQUIRED');
  for (const key of EFFECT_KEYS.filter((value) => value === 'CONFIDENCE_BATCH')) {
    assert.equal((await rejected(() => q(CLAIM, [execution.id, key]), ['22023'])).message, 'CONFIDENCE_BATCH_MANAGED');
    assert.equal((await rejected(() => q(COMPLETE_GENERIC, [execution.id, key]), ['22023'])).message, 'CONFIDENCE_BATCH_COMMAND_REQUIRED');
  }
  assert.equal((await one(CLAIM, [execution.id, 'CANDIDATE_PROVIDER'])).ok, true, 'claim parity survives for a claimable key');
  for (const [key, message] of [
    ['MEMORY_WRITE', 'MEMORY_RESULT_REQUIRED'], ['INTENT_PROVIDER', 'INTENT_RESULT_REQUIRED'],
    ['ASSOCIATION_PROVIDER', 'ASSOCIATION_RESULT_REQUIRED'], ['CANDIDATE_PROVIDER', 'CANDIDATE_RESULT_REQUIRED'],
    ['HYPOTHESIS_PERSISTENCE', 'HYPOTHESIS_PERSISTENCE_COMMAND_REQUIRED'],
  ]) {
    const error = await rejected(() => q(COMPLETE_GENERIC, [execution.id, key]), ['22023']);
    assert.equal(error.message, message, `${key} keeps its exact error contract`);
  }
  // No end-user role can run the managed command.
  for (const role of ['authenticated', 'anon']) {
    await identity(role);
    await rejected(() => q(EXECUTE, [execution.id, JSON.stringify(invocations(1))]), ['42501']);
  }
}

async function verifyValidators() {
  stage = 'invocation-ID and receipt validators';
  await identity('postgres');
  assert.equal((await one(VALID_IDS, [JSON.stringify(invocations(1))])).valid, true);
  assert.equal((await one(VALID_IDS, [JSON.stringify(invocations(4))])).valid, true);
  const pair = invocations(1)[0];
  for (const [label, payload] of [
    ['json null', 'null'],
    ['object payload', JSON.stringify(pair)],
    ['empty list', '[]'],
    ['five pairs', JSON.stringify(invocations(5))],
    ['missing key', JSON.stringify([{ updateId: randomUUID() }])],
    ['extra key', JSON.stringify([{ ...invocations(1)[0], extra: true }])],
    ['bad update uuid', JSON.stringify([{ updateId: 'not-a-uuid', confidenceEvaluationId: randomUUID() }])],
    ['bad confidence uuid', JSON.stringify([{ updateId: randomUUID(), confidenceEvaluationId: 7 }])],
    ['duplicate update ids', JSON.stringify([{ ...invocations(1)[0], updateId: pair.updateId }, { ...invocations(1)[0], updateId: pair.updateId }])],
    ['duplicate confidence ids', JSON.stringify([{ updateId: randomUUID(), confidenceEvaluationId: pair.confidenceEvaluationId }, { updateId: randomUUID(), confidenceEvaluationId: pair.confidenceEvaluationId }])],
    ['a UUID reused across identity sets', JSON.stringify([{ updateId: pair.updateId, confidenceEvaluationId: pair.updateId }])],
  ]) {
    assert.equal((await one(VALID_IDS, [payload])).valid, false, `rejects ${label}`);
  }

  const receipt = (ordinal, over = {}) => ({
    commandOrdinal: ordinal, updateId: randomUUID(), confidenceEvaluationId: randomUUID(),
    hypothesisId: randomUUID(), expectedVersion: 3, evidenceId: evidence, evidenceRole: 'SUPPORTING',
    beforeVersion: 3, afterVersion: 4, confidenceStatus: 'EVALUATED', ...over,
  });
  assert.equal((await one(VALID_RESULT, [JSON.stringify([receipt(1)])])).valid, true);
  assert.equal((await one(VALID_RESULT, [JSON.stringify([receipt(1), receipt(2, { confidenceStatus: 'PENDING_RETRY' })])])).valid, true);
  const shared = receipt(1);
  for (const [label, payload] of [
    ['an empty receipt list', '[]'],
    ['five receipts', JSON.stringify([receipt(1), receipt(2), receipt(3), receipt(4), receipt(5)])],
    ['a bad ordinal', JSON.stringify([receipt(2)])],
    ['a missing key', JSON.stringify([(({ updateId, ...rest }) => rest)(receipt(1))])],
    ['an extra key', JSON.stringify([{ ...receipt(1), extra: true }])],
    ['a before/expected mismatch', JSON.stringify([receipt(1, { beforeVersion: 4 })])],
    ['a wrong after version', JSON.stringify([receipt(1, { afterVersion: 5 })])],
    ['a bad evidence identity', JSON.stringify([receipt(1, { evidenceId: 'memory:bad' })])],
    ['a bad role', JSON.stringify([receipt(1, { evidenceRole: 'NEUTRAL' })])],
    ['a bad confidence status', JSON.stringify([receipt(1, { confidenceStatus: 'DONE' })])],
    ['duplicate update ids', JSON.stringify([shared, receipt(2, { updateId: shared.updateId })])],
    ['a UUID reused across identity sets', JSON.stringify([receipt(1, { confidenceEvaluationId: shared.updateId, updateId: shared.updateId })])],
  ]) {
    assert.equal((await one(VALID_RESULT, [payload])).valid, false, `rejects ${label}`);
  }
  for (const role of ['service_role', 'authenticated', 'anon']) {
    await identity(role);
    await rejected(() => q(VALID_IDS, [JSON.stringify(invocations(1))]), ['42501']);
    await rejected(() => q(VALID_RESULT, [JSON.stringify([receipt(1)])]), ['42501']);
  }
}

async function verifySingleCommand() {
  stage = 'successful one-command managed batch';
  const execution = await newExecution();
  const target = await newHypothesis(execution.session);
  await authorize(execution, [command(target)]);
  const ids = invocations(1);
  await identity('service_role');
  assert.equal((await one(EXECUTE, [execution.id, JSON.stringify(ids)])).ok, true, 'the managed batch applies');
  await identity('postgres');
  const effect = await one(EFFECT, [execution.id, 'HYPOTHESIS_UPDATE_BATCH']);
  assert.equal(effect.state, 'COMPLETED');
  assert.equal(effect.result_code, 'UPDATES_APPLIED');
  assert.equal(effect.result_reference, null);
  assert.ok(effect.completed_at);
  assert.deepEqual(effect.result_payload, [{
    commandOrdinal: 1, updateId: ids[0].updateId, confidenceEvaluationId: ids[0].confidenceEvaluationId,
    hypothesisId: target, expectedVersion: 1, evidenceId: evidence, evidenceRole: 'SUPPORTING',
    beforeVersion: 1, afterVersion: 2, confidenceStatus: 'EVALUATED',
  }], 'the durable receipt is exact');
  const mutated = await one(HYPOTHESIS, [target]);
  assert.deepEqual({ version: mutated.version, supporting: mutated.supporting_evidence_ids, contradicting: mutated.contradicting_evidence_ids },
    { version: 2, supporting: [evidence], contradicting: [] }, 'the Hypothesis received the Evidence in the requested role exactly once');
  const audit = await one('SELECT * FROM public.hypothesis_updates WHERE id=$1', [ids[0].updateId]);
  assert.deepEqual(
    { user: audit.user_id, target: audit.hypothesis_id, before: audit.before_version, after: audit.after_version, evidence: audit.evidence_id, role: audit.evidence_role, source: audit.source },
    { user: userId, target, before: 1, after: 2, evidence, role: 'SUPPORTING', source: 'QANDEEL_HYPOTHESIS_UPDATE_LOOP' },
    'one immutable audit row with the supplied update ID',
  );
  const confidence = await one('SELECT * FROM public.confidence_evaluations WHERE id=$1', [ids[0].confidenceEvaluationId]);
  assert.deepEqual(
    { user: confidence.user_id, target: confidence.target_id, type: confidence.target_type, version: confidence.target_version, provenance: confidence.provenance },
    { user: userId, target, type: 'HYPOTHESIS', version: 2, provenance: 'QANDEEL_CONFIDENCE_RUNTIME' },
    'exact-version Confidence targets the mutation afterVersion with the supplied evaluation ID',
  );
  // The first durable result is final: a second execution performs zero
  // duplicate mutation, zero new audit and zero new Confidence.
  await identity('service_role');
  assert.equal((await one(EXECUTE, [execution.id, JSON.stringify(invocations(1))])).ok, false, 'a second execution cannot run again');
  await identity('postgres');
  assert.equal((await one(HYPOTHESIS, [target])).version, 2, 'zero duplicate mutation');
  assert.deepEqual(await one(EFFECT, [execution.id, 'HYPOTHESIS_UPDATE_BATCH']), effect, 'the durable receipt is immutable');
  assert.equal((await one('SELECT count(*)::int total FROM public.hypothesis_updates WHERE hypothesis_id=$1', [target])).total, 1);
  assert.equal((await one('SELECT count(*)::int total FROM public.confidence_evaluations WHERE target_id=$1', [target])).total, 1);
  return { execution, target, effect };
}

async function verifyMultiCommand() {
  stage = 'successful multi-command managed batch';
  const execution = await newExecution();
  const targets = [await newHypothesis(execution.session), await newHypothesis(execution.session), await newHypothesis(execution.session)];
  const commands = [
    command(targets[0]),
    command(targets[1], { evidenceRole: 'CONTRADICTING' }),
    command(targets[2]),
  ];
  await authorize(execution, commands);
  const ids = invocations(3);
  await identity('service_role');
  assert.equal((await one(EXECUTE, [execution.id, JSON.stringify(ids)])).ok, true);
  await identity('postgres');
  const effect = await one(EFFECT, [execution.id, 'HYPOTHESIS_UPDATE_BATCH']);
  assert.equal(effect.result_code, 'UPDATES_APPLIED');
  assert.deepEqual(effect.result_payload, commands.map((entry, index) => ({
    commandOrdinal: index + 1, updateId: ids[index].updateId, confidenceEvaluationId: ids[index].confidenceEvaluationId,
    hypothesisId: entry.hypothesisId, expectedVersion: 1, evidenceId: evidence, evidenceRole: entry.evidenceRole,
    beforeVersion: 1, afterVersion: 2, confidenceStatus: 'EVALUATED',
  })), 'receipt order exactly equals the durable Association command order');
  for (const [index, target] of targets.entries()) {
    const mutated = await one(HYPOTHESIS, [target]);
    assert.equal(mutated.version, 2, 'every mutation applied exactly once');
    assert.deepEqual(commands[index].evidenceRole === 'SUPPORTING' ? mutated.supporting_evidence_ids : mutated.contradicting_evidence_ids, [evidence]);
    const audit = await one('SELECT * FROM public.hypothesis_updates WHERE hypothesis_id=$1', [target]);
    assert.equal(audit.id, ids[index].updateId, 'exact immutable audit IDs');
    const confidence = await one('SELECT * FROM public.confidence_evaluations WHERE target_id=$1', [target]);
    assert.deepEqual({ id: confidence.id, version: confidence.target_version }, { id: ids[index].confidenceEvaluationId, version: 2 });
  }
  await identity('service_role');
  assert.equal((await one(EXECUTE, [execution.id, JSON.stringify(invocations(3))])).ok, false, 'the completed batch effect is final');
}

async function verifyAllOrNothingStale() {
  stage = 'all-or-nothing stale-command rollback';
  const execution = await newExecution();
  const healthy = await newHypothesis(execution.session);
  const stale = await newHypothesis(execution.session);
  await authorize(execution, [command(healthy), command(stale)]);
  // A racing update advances the second target AFTER authorization, so its
  // exact expectedVersion is stale at managed-execution time.
  await identity('service_role');
  const racing = (await one('SELECT * FROM public.background_apply_hypothesis_evidence_update_v1($1,$2,$3,$4,$5,$6,$7)',
    [userId, execution.session, randomUUID(), stale, 1, evidence, 'CONTRADICTING'])).update;
  assert.equal(racing.after_version, 2);
  const ids = invocations(2);
  assert.equal((await one(EXECUTE, [execution.id, JSON.stringify(ids)])).ok, false, 'the stale batch does not apply');
  await identity('postgres');
  const effect = await one(EFFECT, [execution.id, 'HYPOTHESIS_UPDATE_BATCH']);
  assert.deepEqual(
    { state: effect.state, code: effect.result_code, reference: effect.result_reference, payload: effect.result_payload },
    { state: 'COMPLETED', code: 'UPDATES_REJECTED', reference: null, payload: null },
    'the batch completes as a deterministic payload-free rejection',
  );
  // The stale second command rolls back the entire batch: the healthy first
  // command's mutation, audit and Confidence are all gone.
  assert.deepEqual(await hypothesisState(healthy), { version: 1, supporting: [], contradicting: [] }, 'command 1 was rolled back');
  assert.equal((await one(HYPOTHESIS, [stale])).version, 2, 'the racing update itself is untouched');
  assert.deepEqual(await rows(AUDITS, [[ids[0].updateId, ids[1].updateId]]), [], 'no batch audit rows remain');
  assert.deepEqual(await rows(CONFIDENCE, [[ids[0].confidenceEvaluationId, ids[1].confidenceEvaluationId]]), [], 'no batch Confidence rows exist');
  // After UPDATES_REJECTED a second execution does not attempt mutation.
  await identity('service_role');
  assert.equal((await one(EXECUTE, [execution.id, JSON.stringify(invocations(2))])).ok, false);
  await identity('postgres');
  assert.deepEqual(await hypothesisState(healthy), { version: 1, supporting: [], contradicting: [] }, 'zero duplicate mutation after rejection');
}

async function verifyEvidenceDrift() {
  stage = 'Evidence eligibility drift rollback';
  const execution = await newExecution({ evidenceReference: driftEvidence });
  const target = await newHypothesis(execution.session);
  await authorize(execution, [command(target, { evidenceId: driftEvidence })]);
  // The Evidence was canonical at authorization time and becomes ineligible
  // before the managed execution; the canonical eligibility source of truth
  // stays authoritative at mutation time.
  await identity('postgres');
  await q("UPDATE public.memories SET status='EXPIRED', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [driftMemoryId]);
  const ids = invocations(1);
  await identity('service_role');
  assert.equal((await one(EXECUTE, [execution.id, JSON.stringify(ids)])).ok, false);
  await identity('postgres');
  assert.equal((await one(EFFECT, [execution.id, 'HYPOTHESIS_UPDATE_BATCH'])).result_code, 'UPDATES_REJECTED');
  assert.deepEqual(await hypothesisState(target), { version: 1, supporting: [], contradicting: [] }, 'no mutation from the drifted batch');
  assert.deepEqual(await rows(AUDITS, [[ids[0].updateId]]), []);
  assert.deepEqual(await rows(CONFIDENCE, [[ids[0].confidenceEvaluationId]]), []);
  await q("UPDATE public.memories SET status='ACTIVE', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [driftMemoryId]);
}

async function verifyCrossUserCrossSession() {
  stage = 'cross-user and cross-session rejection';
  // Cross-user: a syntactically valid command targeting another user's
  // Hypothesis carrying this execution's session scope.
  const crossUser = await newExecution();
  const foreign = await newHypothesis(crossUser.session, { owner: otherUserId });
  await authorize(crossUser, [command(foreign)]);
  await identity('service_role');
  assert.equal((await one(EXECUTE, [crossUser.id, JSON.stringify(invocations(1))])).ok, false);
  await identity('postgres');
  assert.equal((await one(EFFECT, [crossUser.id, 'HYPOTHESIS_UPDATE_BATCH'])).result_code, 'UPDATES_REJECTED');
  assert.deepEqual(await hypothesisState(foreign), { version: 1, supporting: [], contradicting: [] }, 'zero partial mutation across users');
  // Cross-session: the same user's Hypothesis bound to another conversation
  // session. Authority comes from the execution row, never from caller input.
  const crossSession = await newExecution();
  const elsewhere = await newHypothesis(crossSession.session, { scope: `CONVERSATION_SESSION:${randomUUID()}` });
  await authorize(crossSession, [command(elsewhere)]);
  await identity('service_role');
  assert.equal((await one(EXECUTE, [crossSession.id, JSON.stringify(invocations(1))])).ok, false);
  await identity('postgres');
  assert.equal((await one(EFFECT, [crossSession.id, 'HYPOTHESIS_UPDATE_BATCH'])).result_code, 'UPDATES_REJECTED');
  assert.deepEqual(await hypothesisState(elsewhere), { version: 1, supporting: [], contradicting: [] }, 'zero partial mutation across sessions');
}

async function verifyConfidencePendingRetry() {
  stage = 'Confidence failure isolation (PENDING_RETRY with committed mutation)';
  const execution = await newExecution();
  const first = await newHypothesis(execution.session);
  const second = await newHypothesis(execution.session);
  await authorize(execution, [command(first), command(second)]);
  const ids = invocations(2);
  // Bounded verifier-only failure mechanism: the second confidence evaluation
  // identity already exists, so ONLY that Confidence insert fails while both
  // mutations and the first Confidence succeed.
  const decoy = await newHypothesis(execution.session);
  await identity('service_role');
  const preExisting = await one('SELECT * FROM public.background_create_confidence_evaluation_v1($1,$2,$3,$4)', [userId, ids[1].confidenceEvaluationId, decoy, 1]);
  assert.equal(preExisting.id, ids[1].confidenceEvaluationId);
  assert.equal((await one(EXECUTE, [execution.id, JSON.stringify(ids)])).ok, true, 'the mutation batch commits despite the Confidence failure');
  await identity('postgres');
  const effect = await one(EFFECT, [execution.id, 'HYPOTHESIS_UPDATE_BATCH']);
  assert.equal(effect.result_code, 'UPDATES_APPLIED');
  assert.deepEqual(effect.result_payload.map((entry) => entry.confidenceStatus), ['EVALUATED', 'PENDING_RETRY'],
    'the failed Confidence becomes a durable PENDING_RETRY receipt');
  assert.equal((await one(HYPOTHESIS, [first])).version, 2);
  assert.equal((await one(HYPOTHESIS, [second])).version, 2, 'the mutation behind the PENDING_RETRY receipt stays committed');
  assert.equal((await one('SELECT count(*)::int total FROM public.hypothesis_updates WHERE hypothesis_id=ANY($1)', [[first, second]])).total, 2);
  // No later-version substitution: no Confidence row of ANY version was
  // created for the failed target by the managed command.
  assert.equal((await one('SELECT count(*)::int total FROM public.confidence_evaluations WHERE target_id=$1', [second])).total, 0);
  const succeeded = await one('SELECT * FROM public.confidence_evaluations WHERE id=$1', [ids[0].confidenceEvaluationId]);
  assert.deepEqual({ target: succeeded.target_id, version: succeeded.target_version }, { target: first, version: 2 });
  // The committed mutation is never replayed.
  await identity('service_role');
  assert.equal((await one(EXECUTE, [execution.id, JSON.stringify(invocations(2))])).ok, false);
  await identity('postgres');
  assert.equal((await one(HYPOTHESIS, [second])).version, 2);
}

async function verifyUnexpectedRollback() {
  stage = 'unexpected failure aborts the whole managed transaction';
  const execution = await newExecution();
  const target = await newHypothesis(execution.session);
  await authorize(execution, [command(target)]);
  const ids = invocations(1);
  // Bounded verifier-only failure mechanism: the supplied audit identity
  // already exists in hypothesis_updates, so the canonical mutation's audit
  // insert fails with a unique violation - an unexpected failure outside the
  // canonical rejection contract.
  const decoy = await newHypothesis(execution.session);
  await identity('service_role');
  const occupied = (await one('SELECT * FROM public.background_apply_hypothesis_evidence_update_v1($1,$2,$3,$4,$5,$6,$7)',
    [userId, execution.session, ids[0].updateId, decoy, 1, evidence, 'SUPPORTING'])).update;
  assert.equal(occupied.id, ids[0].updateId);
  await rejected(() => q(EXECUTE, [execution.id, JSON.stringify(ids)]), ['23505']);
  await identity('postgres');
  assert.equal(await one(EFFECT, [execution.id, 'HYPOTHESIS_UPDATE_BATCH']), undefined,
    'no managed batch effect persists after the aborted transaction');
  assert.deepEqual(await hypothesisState(target), { version: 1, supporting: [], contradicting: [] }, 'no mutation persists');
  assert.equal((await one('SELECT count(*)::int total FROM public.confidence_evaluations WHERE id=$1', [ids[0].confidenceEvaluationId])).total, 0);
  // Redelivery is safe: the same execution then applies with fresh identities.
  const retry = invocations(1);
  await identity('service_role');
  assert.equal((await one(EXECUTE, [execution.id, JSON.stringify(retry)])).ok, true, 'a later redelivery applies cleanly');
  await identity('postgres');
  assert.equal((await one(HYPOTHESIS, [target])).version, 2);
}

async function verifyAuthorityGuards() {
  stage = 'execution-derived authority guards';
  await identity('service_role');
  assert.equal((await one(EXECUTE, [randomUUID(), JSON.stringify(invocations(1))])).ok, false, 'an unknown execution executes nothing');
  const terminal = await newExecution({ withMemory: false, claimAssociation: false });
  await identity('service_role');
  await q("SELECT public.finish_post_response_intelligence_execution_v1($1,'QUARANTINED','INDETERMINATE_EFFECT','TEST')", [terminal.id]);
  assert.equal((await one(EXECUTE, [terminal.id, JSON.stringify(invocations(1))])).ok, false, 'a terminal execution executes nothing');
  // NO_ASSOCIATION is not a command authority.
  const none = await newExecution();
  await identity('service_role');
  assert.equal((await one(COMPLETE_ASSOCIATION, [none.id, 'NO_ASSOCIATION', null])).ok, true);
  const unavailable = await rejected(() => q(EXECUTE, [none.id, JSON.stringify(invocations(1))]), ['42501']);
  assert.equal(unavailable.message, 'HYPOTHESIS_UPDATE_COMMANDS_UNAVAILABLE');
  // A claimed-but-incomplete Association is not authority either.
  const claimedOnly = await newExecution();
  await identity('service_role');
  const claimedError = await rejected(() => q(EXECUTE, [claimedOnly.id, JSON.stringify(invocations(1))]), ['42501']);
  assert.equal(claimedError.message, 'HYPOTHESIS_UPDATE_COMMANDS_UNAVAILABLE');
  // The invocation-ID count must equal the durable command count exactly.
  const counted = await newExecution();
  const target = await newHypothesis(counted.session);
  await authorize(counted, [command(target)]);
  await identity('service_role');
  const mismatch = await rejected(() => q(EXECUTE, [counted.id, JSON.stringify(invocations(2))]), ['22023']);
  assert.equal(mismatch.message, 'INVALID_HYPOTHESIS_UPDATE_INVOCATION_IDS');
  await rejected(() => q(EXECUTE, [counted.id, JSON.stringify([{ updateId: 'nope', confidenceEvaluationId: randomUUID() }])]), ['22023']);
  await identity('postgres');
  assert.equal(await one(EFFECT, [counted.id, 'HYPOTHESIS_UPDATE_BATCH']), undefined, 'guard rejections write nothing');
  // Durable same-execution Evidence provenance: an Association batch whose
  // Evidence is not THIS execution's durable fresh Memory result fails closed.
  const mismatched = await newExecution({ claimAssociation: false });
  await identity('postgres');
  await q(
    "INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state,completed_at,result_code,result_payload) VALUES($1,'ASSOCIATION_PROVIDER','COMPLETED',CURRENT_TIMESTAMP,'AUTHORIZED_COMMANDS',$2::jsonb)",
    [mismatched.id, JSON.stringify([command(randomUUID(), { evidenceId: driftEvidence })])],
  );
  await identity('service_role');
  const evidenceMismatch = await rejected(() => q(EXECUTE, [mismatched.id, JSON.stringify(invocations(1))]), ['42501']);
  assert.equal(evidenceMismatch.message, 'HYPOTHESIS_UPDATE_EVIDENCE_MISMATCH');
  const noMemory = await newExecution({ withMemory: false, claimAssociation: false });
  await identity('postgres');
  await q(
    "INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state,completed_at,result_code,result_payload) VALUES($1,'ASSOCIATION_PROVIDER','COMPLETED',CURRENT_TIMESTAMP,'AUTHORIZED_COMMANDS',$2::jsonb)",
    [noMemory.id, JSON.stringify([command(randomUUID())])],
  );
  await identity('service_role');
  const noEvidence = await rejected(() => q(EXECUTE, [noMemory.id, JSON.stringify(invocations(1))]), ['42501']);
  assert.equal(noEvidence.message, 'HYPOTHESIS_UPDATE_EVIDENCE_UNAVAILABLE');
}

// Historical texts, to reconstruct a genuine pre-0034 database (the canonical
// 0033 chain state) rather than a hand-written approximation of one.
function historicalFunction(source, marker) {
  const start = source.indexOf(marker);
  const terminator = 'END;$$;';
  return source.slice(start, source.indexOf(terminator, start) + terminator.length);
}

async function verifyUpgradeFromCanonical0033() {
  stage = 'pre-0034 reproduction and upgrade';
  await q('SAVEPOINT upgrade');
  await identity('postgres');
  // Reconstruct the exact canonical pre-0034 surface: the six-key registry,
  // no managed result domain, 0022's claim, 0033's generic completion, and no
  // 0034 functions.
  await q('ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_update_batch_result_check');
  await q('ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check');
  await q(`ALTER TABLE public.post_response_intelligence_effects ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK (
    effect_key IN ('MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER','CANDIDATE_PROVIDER','HYPOTHESIS_PERSISTENCE')
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL))`);
  await q('ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_effect_key_check');
  await q(`ALTER TABLE public.post_response_intelligence_effects ADD CONSTRAINT post_response_intelligence_effects_effect_key_check
    CHECK(effect_key IN('MEMORY_WRITE','INTENT_PROVIDER','CANDIDATE_PROVIDER','ASSOCIATION_PROVIDER','HYPOTHESIS_PERSISTENCE','CONFIDENCE_BATCH'))`);
  await q(`DROP FUNCTION ${EXECUTE_RPC}`);
  await q(`DROP FUNCTION ${IDS_VALIDATOR}`);
  await q(`DROP FUNCTION ${RESULT_VALIDATOR}`);
  await q(historicalFunction(dispatchSql, 'CREATE FUNCTION public.claim_post_response_intelligence_effect_v1').replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION'));
  await q(historicalFunction(generationSql, 'CREATE OR REPLACE FUNCTION public.complete_post_response_intelligence_effect_v1'));

  // Pre-0034 the durable AUTHORIZED_COMMANDS existed and were recovered, but
  // ZERO automatic Hypothesis Update invocation occurred: no update-batch
  // effect key even existed.
  const legacy = await newExecution();
  const legacyTarget = await newHypothesis(legacy.session);
  await authorize(legacy, [command(legacyTarget)]);
  await identity('postgres');
  assert.equal((await one(HYPOTHESIS, [legacyTarget])).version, 1, 'pre-0034: the durable commands mutate nothing');
  assert.equal((await one('SELECT count(*)::int total FROM public.hypothesis_updates WHERE hypothesis_id=$1', [legacyTarget])).total, 0);
  // Seed the surrounding canonical pre-0034 state.
  const seeded = await newExecution({ claimAssociation: false });
  await identity('service_role');
  assert.equal((await one(CLAIM, [seeded.id, 'CONFIDENCE_BATCH'])).ok, true);
  assert.equal((await one(COMPLETE_GENERIC, [seeded.id, 'CONFIDENCE_BATCH'])).ok, true);

  await identity('postgres');
  const executionIds = [legacy.id, seeded.id];
  const before = await rows(
    'SELECT to_jsonb(effect) row FROM public.post_response_intelligence_effects effect WHERE execution_id=ANY($1) ORDER BY execution_id, effect_key',
    [executionIds],
  );
  const hypothesesBefore = await rows('SELECT to_jsonb(h) row FROM public.hypotheses h WHERE id=$1', [legacyTarget]);
  const { total: totalBefore } = await one('SELECT count(*)::int total FROM public.post_response_intelligence_effects');
  const { columns: columnsBefore } = await one(
    "SELECT count(*)::int columns FROM information_schema.columns WHERE table_schema='public' AND table_name='post_response_intelligence_effects'",
  );

  await q(migrationSql.replace(/^\s*BEGIN;/mu, '').replace(/^\s*COMMIT;\s*$/mu, ''));

  // 0034 rewrites no historical state: every row is byte-identical, no column
  // is added, nothing is deleted, and no automatic mutation is backfilled.
  assert.deepEqual(
    await rows('SELECT to_jsonb(effect) row FROM public.post_response_intelligence_effects effect WHERE execution_id=ANY($1) ORDER BY execution_id, effect_key', [executionIds]),
    before, 'the upgrade leaves existing effect rows byte-identical',
  );
  assert.deepEqual(await rows('SELECT to_jsonb(h) row FROM public.hypotheses h WHERE id=$1', [legacyTarget]), hypothesesBefore,
    'the upgrade performs no historical Hypothesis rewrite');
  assert.equal((await one('SELECT count(*)::int total FROM public.post_response_intelligence_effects')).total, totalBefore, 'the upgrade deletes nothing');
  assert.equal((await one(
    "SELECT count(*)::int columns FROM information_schema.columns WHERE table_schema='public' AND table_name='post_response_intelligence_effects'",
  )).columns, columnsBefore, 'the upgrade adds no column');
  assert.equal(await one(EFFECT, [legacy.id, 'HYPOTHESIS_UPDATE_BATCH']), undefined, 'no automatic mutation is backfilled for historical executions');
  // The still-RUNNING execution with durable AUTHORIZED_COMMANDS uses the new
  // managed stage on its next legitimate redelivery.
  const ids = invocations(1);
  await identity('service_role');
  assert.equal((await one(EXECUTE, [legacy.id, JSON.stringify(ids)])).ok, true, 'the upgraded managed path applies the durable commands exactly once');
  await identity('postgres');
  assert.equal((await one(HYPOTHESIS, [legacyTarget])).version, 2);
  assert.equal((await one(EFFECT, [legacy.id, 'HYPOTHESIS_UPDATE_BATCH'])).result_code, 'UPDATES_APPLIED');

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
        ($1,$3,'GOAL','automatic update fixture','USER_STATED',1,1,'ACTIVE'),
        ($2,$3,'GOAL','automatic update drift fixture','USER_CONFIRMED',1,1,'ACTIVE')`,
      [memoryId, driftMemoryId, userId],
    );

    await verifySurfaceAndAcls();
    await verifyValidators();
    await verifyUpgradeFromCanonical0033();
    const single = await verifySingleCommand();
    await verifyMultiCommand();
    await verifyAllOrNothingStale();
    await verifyEvidenceDrift();
    await verifyCrossUserCrossSession();
    await verifyConfidencePendingRetry();
    await verifyUnexpectedRollback();
    await verifyAuthorityGuards();

    // Nothing above disturbed the durable receipts already written.
    await identity('postgres');
    assert.deepEqual(await one(EFFECT, [single.execution.id, 'HYPOTHESIS_UPDATE_BATCH']), single.effect);

    console.log('Verified migration 0034: the managed HYPOTHESIS_UPDATE_BATCH effect joins the registry with ordinary claim and generic completion both failing closed (HYPOTHESIS_UPDATE_BATCH_MANAGED / HYPOTHESIS_UPDATE_BATCH_COMMAND_REQUIRED) while the migration-0035 managed CONFIDENCE_BATCH fails closed the same way (CONFIDENCE_BATCH_MANAGED / CONFIDENCE_BATCH_COMMAND_REQUIRED) and every claimable key keeps 0022 claim parity; the internal invocation-ID and receipt validators are IMMUTABLE and role-inaccessible; the service-role-only managed command derives user/session from the execution and its commands only from the durable A2.3a AUTHORIZED_COMMANDS result with same-execution Memory Evidence provenance; single and multi-command batches apply through the canonical A2.3b boundary with exact immutable audit IDs, exact-version Confidence rows and the exact ordered durable receipt in one transaction; a stale second command rolls back the entire batch to a payload-free UPDATES_REJECTED with zero mutation, audit or Confidence; Evidence eligibility drift and cross-user / cross-session targets reject with zero partial mutation; a Confidence failure keeps the committed mutation batch and records a durable PENDING_RETRY with no later-version substitution; an unexpected failure aborts the whole managed transaction leaving no batch effect or mutation so redelivery is safe; a second execution performs zero duplicate mutation against the immutable first result; and the upgrade from the canonical 0033 chain leaves every historical row byte-identical with no backfilled mutation.');
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Automatic hypothesis update batch verification failed at ${stage} (${code}): ${error?.message ?? 'unknown assertion'}. Connection details were suppressed.`);
  process.exitCode = 1;
});
