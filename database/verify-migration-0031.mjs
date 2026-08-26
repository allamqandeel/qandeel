// Durable Association Provider Result (migration 0031) adversarial verifier.
//
// Runs against a fully migrated database. It reconstructs the pre-0031 state -
// the generic result-less RPC completing ASSOCIATION_PROVIDER on the canonical
// 0030 schema - and shows that the resulting durable row carries nothing from
// which the authorized command batch could ever be recovered, which is the
// defect A2.3a closes. It then proves, against the live hardened state, that a
// new ASSOCIATION_PROVIDER can only become COMPLETED through the narrow typed
// command; that the command validates the bounded canonical batch and
// cross-checks every command's Evidence identity against the exact durable
// MEMORY_WRITE result of the same execution before writing anything; that
// result and completion are written together and the first durable result is
// immutable; that the generic completion now fails closed for all three typed
// effects while every other effect key keeps generic parity; that MEMORY_WRITE
// and INTENT_PROVIDER semantics are untouched; that legacy all-null Association
// rows stay representable and are never backfilled; that no result_commands
// column exists (the canonical result_payload field is reused); and that a
// pre-0031 database upgrades with every existing row byte-identical. Every
// fixture is rolled back; no data is retained.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const migrationSql = await readFile(new URL('./migrations/0031_durable_association_provider_result_v1.sql', import.meta.url), 'utf8');
const previousSql = await readFile(new URL('./migrations/0029_durable_intent_provider_result_v1.sql', import.meta.url), 'utf8');
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

const VALIDATOR = 'public.post_response_association_commands_valid_v1(jsonb)';
const COMPLETION = 'public.complete_post_response_association_provider_effect_v1(uuid,text,jsonb)';
const GENERIC = 'public.complete_post_response_intelligence_effect_v1(uuid,text)';
const ACQUIRE = 'SELECT * FROM public.acquire_post_response_intelligence_execution_v1($1,$2,$3,$4,$5,$6,$7,$8)';
const CLAIM = 'SELECT public.claim_post_response_intelligence_effect_v1($1,$2) ok';
const COMPLETE_ASSOCIATION = 'SELECT public.complete_post_response_association_provider_effect_v1($1,$2,$3) ok';
const COMPLETE_GENERIC = 'SELECT public.complete_post_response_intelligence_effect_v1($1,$2) ok';
const COMPLETE_MEMORY = 'SELECT public.complete_post_response_memory_write_effect_v1($1,$2,$3) ok';
const COMPLETE_INTENT = 'SELECT public.complete_post_response_intent_provider_effect_v1($1,$2,$3) ok';
const VALID = 'SELECT public.post_response_association_commands_valid_v1($1::jsonb) valid';
const EFFECT = 'SELECT * FROM public.post_response_intelligence_effects WHERE execution_id=$1 AND effect_key=$2';
const EFFECT_KEYS = ['MEMORY_WRITE', 'INTENT_PROVIDER', 'CANDIDATE_PROVIDER', 'ASSOCIATION_PROVIDER', 'HYPOTHESIS_UPDATE_BATCH', 'HYPOTHESIS_PERSISTENCE', 'CONFIDENCE_BATCH'];

const userId = randomUUID();
const memoryId = randomUUID();
const otherMemoryId = randomUUID();
const evidence = `memory:${memoryId}`;
const otherEvidence = `memory:${otherMemoryId}`;

const command = (over = {}) => ({ hypothesisId: randomUUID(), expectedVersion: 3, evidenceId: evidence, evidenceRole: 'SUPPORTING', ...over });

// A fresh RUNNING execution. withMemory completes a FRESH_EVIDENCE_CREATED
// MEMORY_WRITE result first (the durable Evidence anchor); the
// ASSOCIATION_PROVIDER effect is then CLAIMED unless told otherwise.
async function newExecution({ withMemory = true, claimAssociation = true } = {}) {
  const execution = { id: randomUUID(), session: randomUUID(), turn: randomUUID() };
  await identity('postgres');
  await q(ACQUIRE, [execution.id, randomUUID(), userId, execution.session, execution.turn, '2.0', 'FAST', 'ALLOW']);
  await identity('service_role');
  if (withMemory) {
    assert.equal((await one(CLAIM, [execution.id, 'MEMORY_WRITE'])).ok, true, 'claim MEMORY_WRITE');
    assert.equal((await one(COMPLETE_MEMORY, [execution.id, 'FRESH_EVIDENCE_CREATED', evidence])).ok, true, 'complete MEMORY_WRITE');
  }
  if (claimAssociation) assert.equal((await one(CLAIM, [execution.id, 'ASSOCIATION_PROVIDER'])).ok, true, 'claim ASSOCIATION_PROVIDER');
  return execution;
}

async function verifySurfaceAndAcls() {
  stage = 'schema surface and ACLs';
  await identity('postgres');
  // The canonical result_payload field is reused; no result_commands column exists.
  const columns = (await rows(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='post_response_intelligence_effects' AND column_name IN ('result_payload','result_commands')`,
  )).map((row) => row.column_name);
  assert.deepEqual(columns, ['result_payload'], 'result_payload exists and result_commands does not');

  const constraints = (await rows(
    `SELECT conname FROM pg_constraint WHERE conrelid='public.post_response_intelligence_effects'::regclass
       AND conname LIKE 'post_response_intelligence_effects_%_result_check' ORDER BY conname`,
  )).map((row) => row.conname);
  assert.deepEqual(constraints, [
    'post_response_intelligence_effects_association_result_check',
    'post_response_intelligence_effects_candidate_result_check',
    'post_response_intelligence_effects_claimed_result_check',
    'post_response_intelligence_effects_intent_result_check',
    'post_response_intelligence_effects_memory_result_check',
    'post_response_intelligence_effects_persistence_result_check',
    'post_response_intelligence_effects_untyped_result_check',
    'post_response_intelligence_effects_update_batch_result_check',
  ], 'the 0029 checks survive, Association states its own domain, and the 0033/0034 checks join them');
  const registry = (await one(
    `SELECT pg_get_constraintdef(oid) definition FROM pg_constraint
      WHERE conrelid='public.post_response_intelligence_effects'::regclass
        AND conname='post_response_intelligence_effects_effect_key_check'`,
  )).definition;
  assert.deepEqual([...registry.matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]), EFFECT_KEYS, 'the effect registry is unchanged');
  assert.equal((await one("SELECT relrowsecurity rls FROM pg_class WHERE oid='public.post_response_intelligence_effects'::regclass")).rls, true);

  for (const [signature, expected] of [
    // The typed command is the server's alone; the validator is granted to nobody.
    [COMPLETION, { service_role: true, authenticated: false, anon: false, public: false }],
    [VALIDATOR, { service_role: false, authenticated: false, anon: false, public: false }],
    // Existing post-response authority is unchanged.
    [GENERIC, { service_role: true, authenticated: false, anon: false, public: false }],
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
    assert.equal(definer, signature !== VALIDATOR, `${signature} definer posture`);
  }
  const { volatile: validatorVolatility } = await one(
    'SELECT p.provolatile volatile FROM pg_proc p WHERE p.oid=$1::regprocedure', [VALIDATOR],
  );
  assert.equal(validatorVolatility, 'i', 'the validator is IMMUTABLE');
  assert.equal((await one('SELECT public.post_response_association_commands_valid_v1(NULL) valid')).valid, false,
    'a NULL payload is a hard false, never a NULL a CHECK would treat as satisfied');
  // No application role gained direct table mutation.
  for (const role of ['authenticated', 'anon', 'service_role']) {
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
      const { allowed } = await one('SELECT has_table_privilege($1,$2,$3) allowed', [role, 'public.post_response_intelligence_effects', privilege]);
      assert.equal(allowed, false, `${role} ${privilege} on the effect ledger`);
    }
  }
}

async function verifyCommandValidator() {
  stage = 'canonical command-batch validation';
  await identity('postgres');
  assert.equal((await one(VALID, [JSON.stringify([command()])])).valid, true, 'a single canonical command is accepted');
  const four = Array.from({ length: 4 }, () => command());
  assert.equal((await one(VALID, [JSON.stringify(four)])).valid, true, 'four commands are the bound, not a rejection');
  assert.equal((await one(VALID, [JSON.stringify([command({ evidenceRole: 'CONTRADICTING' })])])).valid, true, 'CONTRADICTING is canonical');
  assert.equal((await one(VALID, [JSON.stringify([command({ expectedVersion: 2147483647 })])])).valid, true, 'the 32-bit ceiling itself is valid');

  const duplicate = command();
  const invalid = [
    ['json null', 'null'],
    ['non-array object', JSON.stringify(command())],
    ['string payload', '"commands"'],
    ['empty batch', '[]'],
    ['five commands', JSON.stringify(Array.from({ length: 5 }, () => command()))],
    ['non-object element', JSON.stringify([1])],
    ['missing key', JSON.stringify([{ hypothesisId: randomUUID(), expectedVersion: 1, evidenceId: evidence }])],
    ['extra key', JSON.stringify([{ ...command(), extra: true }])],
    ['bad hypothesis uuid', JSON.stringify([command({ hypothesisId: 'not-a-uuid' })])],
    ['non-string hypothesis id', JSON.stringify([command({ hypothesisId: 7 })])],
    ['non-number version', JSON.stringify([command({ expectedVersion: '3' })])],
    ['zero version', JSON.stringify([command({ expectedVersion: 0 })])],
    ['negative version', JSON.stringify([command({ expectedVersion: -2 })])],
    ['fractional version', JSON.stringify([command({ expectedVersion: 1.5 })])],
    ['overflow version', JSON.stringify([command({ expectedVersion: 2147483648 })])],
    ['bad evidence reference', JSON.stringify([command({ evidenceId: 'memory:bad' })])],
    ['bare uuid evidence', JSON.stringify([command({ evidenceId: memoryId })])],
    ['non-string evidence', JSON.stringify([command({ evidenceId: 9 })])],
    ['bad role', JSON.stringify([command({ evidenceRole: 'NEUTRAL' })])],
    ['duplicate hypothesis target', JSON.stringify([duplicate, { ...duplicate, evidenceRole: 'CONTRADICTING' }])],
    ['mixed evidence identities', JSON.stringify([command(), command({ evidenceId: otherEvidence })])],
  ];
  for (const [label, payload] of invalid) {
    assert.equal((await one(VALID, [payload])).valid, false, `rejects ${label}`);
  }
  // The validator itself is reachable only as the definer's owner.
  await identity('service_role');
  await rejected(() => q(VALID, [JSON.stringify([command()])]), ['42501']);
  for (const role of ['authenticated', 'anon']) {
    await identity(role);
    await rejected(() => q(VALID, [JSON.stringify([command()])]), ['42501']);
  }
}

async function verifyResultDomain() {
  stage = 'result domain constraints';
  const execution = await newExecution();
  await identity('postgres');
  const payload = JSON.stringify([command()]);
  const patch = (set, key = 'ASSOCIATION_PROVIDER') => () => q(
    `UPDATE public.post_response_intelligence_effects SET ${set} WHERE execution_id=$1 AND effect_key=$2`,
    [execution.id, key],
  );
  // A CLAIMED effect may carry no result of any kind.
  await rejected(patch("result_code='NO_ASSOCIATION'"), ['23514']);
  await rejected(patch(`result_code='AUTHORIZED_COMMANDS',result_payload='${payload}'::jsonb`), ['23514']);
  await rejected(patch(`result_payload='${payload}'::jsonb`), ['23514']);
  await rejected(patch("result_reference='memory:x'"), ['23514']);

  const complete = (set) => `state='COMPLETED',completed_at=CURRENT_TIMESTAMP,${set}`;
  // AUTHORIZED_COMMANDS requires a schema-valid payload and no reference.
  await rejected(patch(complete("result_code='AUTHORIZED_COMMANDS'")), ['23514']);
  await rejected(patch(complete("result_code='AUTHORIZED_COMMANDS',result_payload='[]'::jsonb")), ['23514']);
  await rejected(patch(complete("result_code='AUTHORIZED_COMMANDS',result_payload='{\"arbitrary\":\"json\"}'::jsonb")), ['23514']);
  await rejected(patch(complete(`result_code='AUTHORIZED_COMMANDS',result_payload='${payload}'::jsonb,result_reference='memory:x'`)), ['23514']);
  // NO_ASSOCIATION must carry neither payload nor reference.
  await rejected(patch(complete(`result_code='NO_ASSOCIATION',result_payload='${payload}'::jsonb`)), ['23514']);
  await rejected(patch(complete("result_code='NO_ASSOCIATION',result_reference='memory:x'")), ['23514']);
  // There is no third association result code, and other typed codes are not association codes.
  for (const code of ['PARTIAL', 'AUTHORIZED', 'INTENT_AUTHORIZED', 'NO_FRESH_EVIDENCE']) {
    await rejected(patch(complete(`result_code='${code}'`)), ['23514']);
  }
  // The valid completed shapes are accepted by the schema.
  await q('SAVEPOINT accepted');
  await q(`UPDATE public.post_response_intelligence_effects SET ${complete(`result_code='AUTHORIZED_COMMANDS',result_payload='${payload}'::jsonb`)} WHERE execution_id=$1 AND effect_key='ASSOCIATION_PROVIDER'`, [execution.id]);
  await q('ROLLBACK TO SAVEPOINT accepted');
  await q(`UPDATE public.post_response_intelligence_effects SET ${complete("result_code='NO_ASSOCIATION'")} WHERE execution_id=$1 AND effect_key='ASSOCIATION_PROVIDER'`, [execution.id]);
  await q('ROLLBACK TO SAVEPOINT accepted');
  await q('RELEASE SAVEPOINT accepted');

  // A CANDIDATE_PROVIDER row still rejects Association codes and code-less
  // payloads (via the migration 0033 candidate-scoped check); no Association
  // invariant is weakened by the later typed generation effects.
  const untyped = await newExecution({ withMemory: false, claimAssociation: false });
  await identity('service_role');
  assert.equal((await one(CLAIM, [untyped.id, 'CANDIDATE_PROVIDER'])).ok, true);
  await identity('postgres');
  await rejected(() => q(
    `UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code='NO_ASSOCIATION' WHERE execution_id=$1 AND effect_key='CANDIDATE_PROVIDER'`,
    [untyped.id],
  ), ['23514']);
  await rejected(() => q(
    `UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_payload='${payload}'::jsonb WHERE execution_id=$1 AND effect_key='CANDIDATE_PROVIDER'`,
    [untyped.id],
  ), ['23514']);

  // A legacy pre-0031 completed Association row with no result at all stays valid.
  const legacy = await newExecution({ withMemory: false, claimAssociation: false });
  await identity('postgres');
  await q(
    "INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state,completed_at) VALUES($1,'ASSOCIATION_PROVIDER','COMPLETED',CURRENT_TIMESTAMP)",
    [legacy.id],
  );
  const legacyRow = await one(EFFECT, [legacy.id, 'ASSOCIATION_PROVIDER']);
  assert.deepEqual(
    { code: legacyRow.result_code, reference: legacyRow.result_reference, payload: legacyRow.result_payload },
    { code: null, reference: null, payload: null },
    'a legacy completed association row is representable and distinguishable',
  );
  return legacy;
}

async function verifyGenericCompletion() {
  stage = 'generic completion';
  const execution = await newExecution();
  await identity('service_role');
  const associationError = await rejected(() => q(COMPLETE_GENERIC, [execution.id, 'ASSOCIATION_PROVIDER']), ['22023']);
  assert.equal(associationError.message, 'ASSOCIATION_RESULT_REQUIRED');
  const intentError = await rejected(() => q(COMPLETE_GENERIC, [execution.id, 'INTENT_PROVIDER']), ['22023']);
  assert.equal(intentError.message, 'INTENT_RESULT_REQUIRED', 'the Intent error contract is unchanged');
  const memoryError = await rejected(() => q(COMPLETE_GENERIC, [execution.id, 'MEMORY_WRITE']), ['22023']);
  assert.equal(memoryError.message, 'MEMORY_RESULT_REQUIRED', 'the Memory error contract is unchanged');
  // The rejected generic completion left the claimed effect untouched.
  await identity('postgres');
  const untouched = await one(EFFECT, [execution.id, 'ASSOCIATION_PROVIDER']);
  assert.deepEqual(
    { state: untouched.state, code: untouched.result_code, payload: untouched.result_payload, completed: untouched.completed_at },
    { state: 'CLAIMED', code: null, payload: null, completed: null },
  );
  // Only CONFIDENCE_BATCH keeps generic parity: migration 0033 made both
  // generation effects typed, and verify-migration-0033 proves their own
  // rejection and typed completion contracts.
  const generic = await newExecution({ withMemory: false, claimAssociation: false });
  await identity('service_role');
  for (const key of EFFECT_KEYS.filter((value) => value === 'CONFIDENCE_BATCH')) {
    assert.equal((await one(CLAIM, [generic.id, key])).ok, true, `claim ${key}`);
    assert.equal((await one(COMPLETE_GENERIC, [generic.id, key])).ok, true, `generic completion parity for ${key}`);
  }
}

async function verifyTypedCompletion() {
  stage = 'typed association completion';

  // NO_ASSOCIATION: durable outcome only, no reference, no payload.
  const noAssociation = await newExecution();
  await identity('service_role');
  assert.equal((await one(COMPLETE_ASSOCIATION, [noAssociation.id, 'NO_ASSOCIATION', null])).ok, true);
  await identity('postgres');
  const empty = await one(EFFECT, [noAssociation.id, 'ASSOCIATION_PROVIDER']);
  assert.deepEqual(
    { state: empty.state, code: empty.result_code, reference: empty.result_reference, payload: empty.result_payload },
    { state: 'COMPLETED', code: 'NO_ASSOCIATION', reference: null, payload: null },
  );
  assert.ok(empty.completed_at, 'completion timestamp is written with the result');

  // AUTHORIZED_COMMANDS: result and completion are written together, exactly
  // as supplied and in authority order, for both the single and maximal batch.
  const persisted = [];
  for (const size of [1, 4]) {
    const execution = await newExecution();
    const commands = Array.from({ length: size }, (unused, index) => command({ expectedVersion: size * 7 + index, evidenceRole: index % 2 === 0 ? 'SUPPORTING' : 'CONTRADICTING' }));
    await identity('service_role');
    assert.equal((await one(COMPLETE_ASSOCIATION, [execution.id, 'AUTHORIZED_COMMANDS', JSON.stringify(commands)])).ok, true, `size-${size} completion`);
    await identity('postgres');
    const stored = await one(EFFECT, [execution.id, 'ASSOCIATION_PROVIDER']);
    assert.equal(stored.state, 'COMPLETED');
    assert.equal(stored.result_code, 'AUTHORIZED_COMMANDS');
    assert.equal(stored.result_reference, null);
    assert.ok(stored.completed_at);
    assert.deepEqual(stored.result_payload, commands, 'the durable payload is the exact ordered command batch');
    persisted.push({ execution, stored });
  }

  // An invalid result leaves the effect CLAIMED and result-less.
  const invalid = await newExecution();
  await identity('service_role');
  for (const [code, body] of [
    ['NO_ASSOCIATION', JSON.stringify([command()])],
    ['AUTHORIZED_COMMANDS', null],
    ['AUTHORIZED_COMMANDS', JSON.stringify([])],
    ['AUTHORIZED_COMMANDS', JSON.stringify(Array.from({ length: 5 }, () => command()))],
    ['AUTHORIZED_COMMANDS', JSON.stringify([command({ expectedVersion: 0 })])],
    ['AUTHORIZED_COMMANDS', JSON.stringify([{ ...command(), extra: true }])],
    ['AUTHORIZED_COMMANDS', JSON.stringify([command(), command({ evidenceId: otherEvidence })])],
    ['PARTIAL', null],
    ['INTENT_AUTHORIZED', null],
    [null, null],
  ]) {
    const error = await rejected(() => q(COMPLETE_ASSOCIATION, [invalid.id, code, body]), ['22023']);
    assert.equal(error.message, 'INVALID_ASSOCIATION_RESULT');
  }
  await identity('postgres');
  const stillClaimed = await one(EFFECT, [invalid.id, 'ASSOCIATION_PROVIDER']);
  assert.deepEqual(
    { state: stillClaimed.state, code: stillClaimed.result_code, payload: stillClaimed.result_payload, completed: stillClaimed.completed_at },
    { state: 'CLAIMED', code: null, payload: null, completed: null },
    'a rejected result never completes the effect',
  );
  // The still-claimed effect can complete once a valid result arrives.
  await identity('service_role');
  assert.equal((await one(COMPLETE_ASSOCIATION, [invalid.id, 'NO_ASSOCIATION', null])).ok, true, 'the claimed effect survives rejected attempts');

  // Durable Evidence binding: authorized commands must reference the exact
  // fresh Evidence of THIS execution's durable MEMORY_WRITE result.
  const mismatch = await newExecution();
  await identity('service_role');
  const mismatchError = await rejected(() => q(COMPLETE_ASSOCIATION, [mismatch.id, 'AUTHORIZED_COMMANDS', JSON.stringify([command({ evidenceId: otherEvidence })])]), ['42501']);
  assert.equal(mismatchError.message, 'ASSOCIATION_EVIDENCE_MISMATCH');
  // No durable fresh Evidence at all: nothing can authorize commands.
  const noEvidence = await newExecution({ withMemory: false });
  await identity('service_role');
  const unavailableError = await rejected(() => q(COMPLETE_ASSOCIATION, [noEvidence.id, 'AUTHORIZED_COMMANDS', JSON.stringify([command()])]), ['42501']);
  assert.equal(unavailableError.message, 'ASSOCIATION_EVIDENCE_UNAVAILABLE');
  // Cross-execution injection: a batch bound to another execution's Evidence
  // cannot complete this one, and mutates nothing.
  await identity('postgres');
  for (const failed of [mismatch, noEvidence]) {
    assert.equal((await one(EFFECT, [failed.id, 'ASSOCIATION_PROVIDER'])).state, 'CLAIMED', 'evidence rejection mutates nothing');
  }

  // An unknown execution and a terminal execution complete nothing.
  await identity('service_role');
  assert.equal((await one(COMPLETE_ASSOCIATION, [randomUUID(), 'NO_ASSOCIATION', null])).ok, false);
  const terminal = await newExecution();
  await identity('service_role');
  await q("SELECT public.finish_post_response_intelligence_execution_v1($1,'QUARANTINED','INDETERMINATE_EFFECT','TEST')", [terminal.id]);
  assert.equal((await one(COMPLETE_ASSOCIATION, [terminal.id, 'NO_ASSOCIATION', null])).ok, false,
    'a terminal execution cannot complete an effect');
  await identity('postgres');
  assert.equal((await one(EFFECT, [terminal.id, 'ASSOCIATION_PROVIDER'])).state, 'CLAIMED');

  // The first durable result is immutable.
  await identity('service_role');
  assert.equal((await one(COMPLETE_ASSOCIATION, [noAssociation.id, 'NO_ASSOCIATION', null])).ok, false,
    'repeating the same completion changes nothing');
  assert.equal((await one(COMPLETE_ASSOCIATION, [noAssociation.id, 'AUTHORIZED_COMMANDS', JSON.stringify([command()])])).ok, false,
    'a second, different result cannot replace the first');
  assert.equal((await one(COMPLETE_ASSOCIATION, [persisted[0].execution.id, 'NO_ASSOCIATION', null])).ok, false);
  await identity('postgres');
  assert.deepEqual(await one(EFFECT, [noAssociation.id, 'ASSOCIATION_PROVIDER']), empty, 'the completed row is byte-identical after both attempts');
  for (const { execution, stored } of persisted) {
    assert.deepEqual(await one(EFFECT, [execution.id, 'ASSOCIATION_PROVIDER']), stored);
  }

  // No end-user role can drive the typed command or mutate durable results.
  for (const role of ['authenticated', 'anon']) {
    await identity(role);
    await rejected(() => q(COMPLETE_ASSOCIATION, [noAssociation.id, 'NO_ASSOCIATION', null]), ['42501']);
    await rejected(() => q("UPDATE public.post_response_intelligence_effects SET result_code='NO_ASSOCIATION' WHERE execution_id=$1", [noAssociation.id]), ['42501']);
  }
  return { noAssociation, empty };
}

async function verifyMemoryAndIntentUnchanged() {
  stage = 'Memory and Intent semantics unchanged';
  // Memory typed completion still works and still rejects malformed results.
  const skip = await newExecution({ withMemory: false, claimAssociation: false });
  await identity('service_role');
  assert.equal((await one(CLAIM, [skip.id, 'MEMORY_WRITE'])).ok, true);
  assert.equal((await one(COMPLETE_MEMORY, [skip.id, 'NO_FRESH_EVIDENCE', null])).ok, true);
  await rejected(() => q(COMPLETE_MEMORY, [skip.id, 'UNKNOWN', null]), ['22023']);
  await identity('postgres');
  const skipped = await one(EFFECT, [skip.id, 'MEMORY_WRITE']);
  assert.deepEqual(
    { code: skipped.result_code, reference: skipped.result_reference, payload: skipped.result_payload },
    { code: 'NO_FRESH_EVIDENCE', reference: null, payload: null },
  );
  // Intent typed completion still works with its exact 0029 semantics.
  const intentExecution = await newExecution({ withMemory: false, claimAssociation: false });
  await identity('service_role');
  assert.equal((await one(CLAIM, [intentExecution.id, 'INTENT_PROVIDER'])).ok, true);
  assert.equal((await one(COMPLETE_INTENT, [intentExecution.id, 'INTENT_NOT_AUTHORIZED', null])).ok, true);
  await identity('postgres');
  const intentRow = await one(EFFECT, [intentExecution.id, 'INTENT_PROVIDER']);
  assert.deepEqual(
    { state: intentRow.state, code: intentRow.result_code, reference: intentRow.result_reference, payload: intentRow.result_payload },
    { state: 'COMPLETED', code: 'INTENT_NOT_AUTHORIZED', reference: null, payload: null },
  );
  // The Association command cannot complete another effect key: the key is fixed.
  const memoryOnly = await newExecution({ withMemory: false, claimAssociation: false });
  await identity('service_role');
  assert.equal((await one(CLAIM, [memoryOnly.id, 'MEMORY_WRITE'])).ok, true);
  assert.equal((await one(COMPLETE_ASSOCIATION, [memoryOnly.id, 'NO_ASSOCIATION', null])).ok, false,
    'the Association command cannot complete a MEMORY_WRITE effect');
}

// Migration 0029's historical generic completion, used to reconstruct a genuine
// pre-0031 database (the canonical 0030 chain state) rather than a hand-written
// approximation of one.
function historicalGenericCompletion() {
  const start = previousSql.indexOf('CREATE OR REPLACE FUNCTION public.complete_post_response_intelligence_effect_v1');
  const terminator = 'END;$$;';
  return previousSql.slice(start, previousSql.indexOf(terminator, start) + terminator.length);
}

async function verifyUpgradeFromCanonical0030() {
  stage = 'pre-0031 reproduction and upgrade';
  await q('SAVEPOINT upgrade');
  await identity('postgres');
  // Reconstruct the exact canonical pre-0031 surface: no Association result
  // domain, 0029's two-key untyped check, 0029's generic completion, and no
  // 0031 functions.
  await q('ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_association_result_check');
  await q('ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check');
  await q(`ALTER TABLE public.post_response_intelligence_effects ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK (
    effect_key IN ('MEMORY_WRITE','INTENT_PROVIDER')
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL))`);
  await q(`DROP FUNCTION ${COMPLETION}`);
  await q(`DROP FUNCTION ${VALIDATOR}`);
  await q(historicalGenericCompletion());

  // Pre-0031 the generic result-less RPC really did complete ASSOCIATION_PROVIDER.
  const legacyAssociation = await newExecution();
  await identity('service_role');
  assert.equal((await one(COMPLETE_GENERIC, [legacyAssociation.id, 'ASSOCIATION_PROVIDER'])).ok, true,
    'pre-0031: the generic completion accepted ASSOCIATION_PROVIDER');
  await identity('postgres');
  const legacyRow = await one(EFFECT, [legacyAssociation.id, 'ASSOCIATION_PROVIDER']);
  assert.equal(legacyRow.state, 'COMPLETED');
  assert.deepEqual(
    { code: legacyRow.result_code, reference: legacyRow.result_reference, payload: legacyRow.result_payload },
    { code: null, reference: null, payload: null },
    'pre-0031: a durably COMPLETED association effect carried no result at all',
  );
  // This is the defect: the ledger alone cannot say whether the provider
  // authorized any command, so a redelivery has nothing to recover and the
  // paid, authorized batch is lost with the process.
  const { recoverable } = await one(
    `SELECT count(*)::int recoverable FROM public.post_response_intelligence_effects
      WHERE execution_id=$1 AND effect_key='ASSOCIATION_PROVIDER' AND state='COMPLETED'
        AND (result_code IS NOT NULL OR result_reference IS NOT NULL OR result_payload IS NOT NULL)`, [legacyAssociation.id],
  );
  assert.equal(recoverable, 0, 'pre-0031: nothing in the durable row can recover the authorized commands');

  // A pre-0031 database also holds typed Memory results, both typed Intent
  // results, and generic completions.
  const seeded = { memorySkip: await newExecution({ withMemory: false, claimAssociation: false }) };
  await identity('service_role');
  assert.equal((await one(CLAIM, [seeded.memorySkip.id, 'MEMORY_WRITE'])).ok, true);
  assert.equal((await one(COMPLETE_MEMORY, [seeded.memorySkip.id, 'NO_FRESH_EVIDENCE', null])).ok, true);
  assert.equal((await one(CLAIM, [seeded.memorySkip.id, 'CONFIDENCE_BATCH'])).ok, true);
  assert.equal((await one(COMPLETE_GENERIC, [seeded.memorySkip.id, 'CONFIDENCE_BATCH'])).ok, true);
  seeded.memoryWrite = await newExecution({ claimAssociation: false });
  seeded.intentNotAuthorized = await newExecution({ withMemory: false, claimAssociation: false });
  await identity('service_role');
  assert.equal((await one(CLAIM, [seeded.intentNotAuthorized.id, 'INTENT_PROVIDER'])).ok, true);
  assert.equal((await one(COMPLETE_INTENT, [seeded.intentNotAuthorized.id, 'INTENT_NOT_AUTHORIZED', null])).ok, true);
  seeded.intentAuthorized = await newExecution({ withMemory: false, claimAssociation: false });
  await identity('service_role');
  assert.equal((await one(CLAIM, [seeded.intentAuthorized.id, 'INTENT_PROVIDER'])).ok, true);
  const authorizedIntent = {
    problem: { text: 'Why do I repeat this pattern?', source: 'CURRENT_USER_TURN', sourceTurnId: seeded.intentAuthorized.turn },
    domain: 'GENERAL',
    scope: { kind: 'CONVERSATION_SESSION', sessionId: seeded.intentAuthorized.session, serialized: `CONVERSATION_SESSION:${seeded.intentAuthorized.session}` },
    evidenceIds: [evidence],
  };
  assert.equal((await one(COMPLETE_INTENT, [seeded.intentAuthorized.id, 'INTENT_AUTHORIZED', JSON.stringify(authorizedIntent)])).ok, true);

  await identity('postgres');
  const executionIds = [legacyAssociation.id, seeded.memorySkip.id, seeded.memoryWrite.id, seeded.intentNotAuthorized.id, seeded.intentAuthorized.id];
  const before = await rows(
    'SELECT to_jsonb(effect) row FROM public.post_response_intelligence_effects effect WHERE execution_id=ANY($1) ORDER BY execution_id, effect_key',
    [executionIds],
  );
  const executionsBefore = await rows(
    'SELECT to_jsonb(execution) row FROM public.post_response_intelligence_executions execution WHERE id=ANY($1) ORDER BY id', [executionIds],
  );
  const { total: totalBefore } = await one('SELECT count(*)::int total FROM public.post_response_intelligence_effects');
  const { columns: columnsBefore } = await one(
    "SELECT count(*)::int columns FROM information_schema.columns WHERE table_schema='public' AND table_name='post_response_intelligence_effects'",
  );

  await q(migrationSql.replace(/^\s*BEGIN;/mu, '').replace(/^\s*COMMIT;\s*$/mu, ''));

  // 0031 adds no column: the ledger reuses result_payload, and every existing
  // row — typed Memory, both typed Intent outcomes, generic completions, and
  // the legacy result-less Association — is byte-identical. Nothing is
  // backfilled or reconstructed.
  const after = await rows(
    'SELECT to_jsonb(effect) row FROM public.post_response_intelligence_effects effect WHERE execution_id=ANY($1) ORDER BY execution_id, effect_key',
    [executionIds],
  );
  assert.deepEqual(after, before, 'the upgrade leaves existing effect rows byte-identical');
  assert.deepEqual(
    await rows('SELECT to_jsonb(execution) row FROM public.post_response_intelligence_executions execution WHERE id=ANY($1) ORDER BY id', [executionIds]),
    executionsBefore, 'the upgrade leaves executions byte-identical',
  );
  assert.equal((await one('SELECT count(*)::int total FROM public.post_response_intelligence_effects')).total, totalBefore, 'the upgrade deletes nothing');
  assert.equal((await one(
    "SELECT count(*)::int columns FROM information_schema.columns WHERE table_schema='public' AND table_name='post_response_intelligence_effects'",
  )).columns, columnsBefore, 'the upgrade adds no column (result_payload is reused; no result_commands)');
  const preserved = await one(EFFECT, [legacyAssociation.id, 'ASSOCIATION_PROVIDER']);
  assert.deepEqual(
    { state: preserved.state, code: preserved.result_code, reference: preserved.result_reference, payload: preserved.result_payload },
    { state: 'COMPLETED', code: null, reference: null, payload: null },
    'the legacy result-less Association row stays exactly as unknowable as it was',
  );

  // After the upgrade the same generic completion is prohibited, and the typed
  // command works on a fresh effect.
  await verifySurfaceAndAcls();
  stage = 'pre-0031 reproduction and upgrade';
  const upgraded = await newExecution();
  await identity('service_role');
  const blocked = await rejected(() => q(COMPLETE_GENERIC, [upgraded.id, 'ASSOCIATION_PROVIDER']), ['22023']);
  assert.equal(blocked.message, 'ASSOCIATION_RESULT_REQUIRED');
  const upgradedCommands = [command()];
  assert.equal((await one(COMPLETE_ASSOCIATION, [upgraded.id, 'AUTHORIZED_COMMANDS', JSON.stringify(upgradedCommands)])).ok, true);
  await identity('postgres');
  assert.deepEqual((await one(EFFECT, [upgraded.id, 'ASSOCIATION_PROVIDER'])).result_payload, upgradedCommands);

  await identity('postgres');
  await q('ROLLBACK TO SAVEPOINT upgrade');
  await q('RELEASE SAVEPOINT upgrade');
}

async function main() {
  try {
    await client.connect();
    await q('BEGIN');
    await identity('postgres');
    await q('INSERT INTO public.users(id,auth_subject) VALUES($1::uuid,$1::text)', [userId]);
    await q(
      "INSERT INTO public.memories(id,user_id,type,content,source,confidence,importance,status) VALUES($1,$2,'GOAL','association fixture','USER_STATED',1,1,'ACTIVE'),($3,$2,'GOAL','other fixture','USER_STATED',1,1,'ACTIVE')",
      [memoryId, userId, otherMemoryId],
    );

    await verifySurfaceAndAcls();
    await verifyCommandValidator();
    await verifyUpgradeFromCanonical0030();
    const legacy = await verifyResultDomain();
    await verifyGenericCompletion();
    const { noAssociation, empty } = await verifyTypedCompletion();
    await verifyMemoryAndIntentUnchanged();

    // Nothing above disturbed the durable results already written, and the
    // legacy all-null row was never backfilled.
    await identity('postgres');
    assert.deepEqual(await one(EFFECT, [noAssociation.id, 'ASSOCIATION_PROVIDER']), empty);
    const untouchedLegacy = await one(EFFECT, [legacy.id, 'ASSOCIATION_PROVIDER']);
    assert.deepEqual(
      { code: untouchedLegacy.result_code, reference: untouchedLegacy.result_reference, payload: untouchedLegacy.result_payload },
      { code: null, reference: null, payload: null },
    );

    console.log('Verified migration 0031: reproduced the pre-0031 result-less ASSOCIATION_PROVIDER completion on the canonical 0030 chain, then proved the bounded immutable command batch on the reused result_payload field (no result_commands column), service-role-only typed completion with exact durable Memory Evidence binding and cross-execution rejection, atomic result-plus-transition with a write-once first result, fail-closed rejection that leaves the effect CLAIMED, the generic completion closed for all three typed effects while every other effect key keeps parity, unchanged MEMORY_WRITE and INTENT_PROVIDER semantics, legacy all-null Association rows representable and never backfilled, internal-only validator ACLs, and a clean upgrade that leaves every historical row byte-identical.');
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Durable Association result verification failed at ${stage} (${code}): ${error?.message ?? 'unknown assertion'}. Connection details were suppressed.`);
  process.exitCode = 1;
});
