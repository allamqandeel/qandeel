// Durable Intent Provider Result (migration 0029) adversarial verifier.
//
// Runs against a fully migrated database. It reconstructs the pre-0029 state -
// the generic result-less RPC completing INTENT_PROVIDER - and shows that the
// resulting durable row carries nothing from which the authorized intent could
// ever be recovered, which is the defect QAN-AUD-04 names. It then proves,
// against the live hardened state, that a new INTENT_PROVIDER can only become
// COMPLETED through the narrow typed command; that the command validates the
// bounded canonical payload and cross-checks its turn/session provenance
// against the canonical execution before writing anything; that result and
// completion are written together and the first durable result is immutable;
// that the generic completion now fails closed for both typed effects while
// every other effect key keeps generic parity; that MEMORY_WRITE semantics are
// untouched; that legacy all-null intent rows stay representable and are never
// backfilled; and that a pre-0029 database upgrades with every existing row
// byte-identical apart from the new nullable column reading null. Every fixture
// is rolled back; no data is retained.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const migrationSql = await readFile(new URL('./migrations/0029_durable_intent_provider_result_v1.sql', import.meta.url), 'utf8');
const previousSql = await readFile(new URL('./migrations/0024_durable_memory_effect_result_v1.sql', import.meta.url), 'utf8');
// Migration 0031 made ASSOCIATION_PROVIDER the third typed-result effect on the
// same ledger. The upgrade simulation below rebuilds the true pre-0029 state
// from the live post-0031 schema and re-applies both migrations to return to
// it, and the final-state assertions recognise the Association result domain
// without weakening any Intent invariant.
const associationSql = await readFile(new URL('./migrations/0031_durable_association_provider_result_v1.sql', import.meta.url), 'utf8');
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

const VALIDATOR = 'public.post_response_authorized_intent_valid_v1(jsonb)';
const COMPLETION = 'public.complete_post_response_intent_provider_effect_v1(uuid,text,jsonb)';
const GENERIC = 'public.complete_post_response_intelligence_effect_v1(uuid,text)';
const MEMORY = 'public.complete_post_response_memory_write_effect_v1(uuid,text,text)';
const ACQUIRE = 'SELECT * FROM public.acquire_post_response_intelligence_execution_v1($1,$2,$3,$4,$5,$6,$7,$8)';
const CLAIM = 'SELECT public.claim_post_response_intelligence_effect_v1($1,$2) ok';
const COMPLETE_INTENT = 'SELECT public.complete_post_response_intent_provider_effect_v1($1,$2,$3) ok';
const COMPLETE_GENERIC = 'SELECT public.complete_post_response_intelligence_effect_v1($1,$2) ok';
const COMPLETE_MEMORY = 'SELECT public.complete_post_response_memory_write_effect_v1($1,$2,$3) ok';
const VALID = 'SELECT public.post_response_authorized_intent_valid_v1($1::jsonb) valid';
const EFFECT = "SELECT * FROM public.post_response_intelligence_effects WHERE execution_id=$1 AND effect_key=$2";
const EFFECT_KEYS = ['MEMORY_WRITE', 'INTENT_PROVIDER', 'CANDIDATE_PROVIDER', 'ASSOCIATION_PROVIDER', 'HYPOTHESIS_PERSISTENCE', 'CONFIDENCE_BATCH'];

const userId = randomUUID();

// A canonical AuthorizedHypothesisGenerationIntent for one execution identity.
const intentFor = (execution, overrides = {}) => ({
  problem: { text: 'Why do I repeat this pattern?', source: 'CURRENT_USER_TURN', sourceTurnId: execution.turn },
  domain: 'GENERAL',
  scope: { kind: 'CONVERSATION_SESSION', sessionId: execution.session, serialized: `CONVERSATION_SESSION:${execution.session}` },
  evidenceIds: [`memory:${randomUUID()}`],
  ...overrides,
});

// A fresh RUNNING execution with an INTENT_PROVIDER effect already CLAIMED.
async function newExecution({ claim = 'INTENT_PROVIDER' } = {}) {
  const execution = { id: randomUUID(), event: randomUUID(), session: randomUUID(), turn: randomUUID() };
  await identity('postgres');
  await q(ACQUIRE, [execution.id, execution.event, userId, execution.session, execution.turn, '2.0', 'FAST', 'ALLOW']);
  if (claim) {
    await identity('service_role');
    assert.equal((await one(CLAIM, [execution.id, claim])).ok, true, `claim ${claim}`);
  }
  return execution;
}

// Section 17.6 / 20.
async function verifySurfaceAndAcls() {
  stage = 'schema surface and ACLs';
  await identity('postgres');
  const column = await one(
    `SELECT data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='post_response_intelligence_effects' AND column_name='result_payload'`,
  );
  assert.ok(column, 'result_payload exists');
  assert.equal(column.data_type, 'jsonb');
  assert.equal(column.is_nullable, 'YES');
  assert.equal(column.column_default, null, 'the new column is defaultless so no existing row is rewritten');

  const constraints = (await rows(
    `SELECT conname FROM pg_constraint WHERE conrelid='public.post_response_intelligence_effects'::regclass
       AND conname LIKE 'post_response_intelligence_effects_%_result_check' ORDER BY conname`,
  )).map((row) => row.conname);
  assert.deepEqual(constraints, [
    'post_response_intelligence_effects_association_result_check',
    'post_response_intelligence_effects_claimed_result_check',
    'post_response_intelligence_effects_intent_result_check',
    'post_response_intelligence_effects_memory_result_check',
    'post_response_intelligence_effects_untyped_result_check',
  ]);
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
    [MEMORY, { service_role: true, authenticated: false, anon: false, public: false }],
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
    "SELECT p.provolatile volatile FROM pg_proc p WHERE p.oid=$1::regprocedure", [VALIDATOR],
  );
  assert.equal(validatorVolatility, 'i', 'the validator is IMMUTABLE');
  assert.equal((await one('SELECT public.post_response_authorized_intent_valid_v1(NULL) valid')).valid, false,
    'a NULL payload is a hard false, never a NULL a CHECK would treat as satisfied');
  // No application role gained direct table mutation.
  for (const role of ['authenticated', 'anon', 'service_role']) {
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
      const { allowed } = await one('SELECT has_table_privilege($1,$2,$3) allowed', [role, 'public.post_response_intelligence_effects', privilege]);
      assert.equal(allowed, false, `${role} ${privilege} on the effect ledger`);
    }
  }
}

// Section 17.3.
async function verifyPayloadValidator() {
  stage = 'canonical payload validation';
  await identity('postgres');
  const execution = { session: randomUUID(), turn: randomUUID() };
  const valid = intentFor(execution);
  assert.equal((await one(VALID, [JSON.stringify(valid)])).valid, true, 'the exact canonical payload is accepted');
  // Eight Evidence identifiers are the bound, not a rejection.
  assert.equal((await one(VALID, [JSON.stringify({ ...valid, evidenceIds: Array.from({ length: 8 }, () => `memory:${randomUUID()}`) })])).valid, true);
  for (const domain of ['GENERAL', 'RELATIONSHIP', 'WORK', 'DECISION', 'GOAL', 'INTERACTION']) {
    assert.equal((await one(VALID, [JSON.stringify({ ...valid, domain })])).valid, true, `canonical domain ${domain}`);
  }

  const clone = () => JSON.parse(JSON.stringify(valid));
  const mutate = (change) => { const payload = clone(); change(payload); return payload; };
  const invalid = [
    ['non-object payload', '"text"'],
    ['array payload', '[]'],
    ['numeric payload', '7'],
    ['json null payload', 'null'],
    ['extra top-level key', JSON.stringify({ ...valid, extra: 1 })],
    ['missing top-level key', JSON.stringify(mutate((p) => { delete p.domain; }))],
    ['malformed problem object', JSON.stringify({ ...valid, problem: 'text' })],
    ['extra problem key', JSON.stringify(mutate((p) => { p.problem.extra = 1; }))],
    ['missing problem key', JSON.stringify(mutate((p) => { delete p.problem.source; }))],
    ['non-string problem text', JSON.stringify(mutate((p) => { p.problem.text = 7; }))],
    ['blank problem text', JSON.stringify(mutate((p) => { p.problem.text = '   '; }))],
    ['empty problem text', JSON.stringify(mutate((p) => { p.problem.text = ''; }))],
    ['oversized problem text', JSON.stringify(mutate((p) => { p.problem.text = 'x'.repeat(2001); }))],
    ['wrong problem source', JSON.stringify(mutate((p) => { p.problem.source = 'ASSISTANT_TURN'; }))],
    ['invalid sourceTurnId', JSON.stringify(mutate((p) => { p.problem.sourceTurnId = 'not-a-uuid'; }))],
    ['invalid domain', JSON.stringify({ ...valid, domain: 'HEALTH' })],
    ['non-string domain', JSON.stringify({ ...valid, domain: 3 })],
    ['malformed scope object', JSON.stringify({ ...valid, scope: null })],
    ['extra scope key', JSON.stringify(mutate((p) => { p.scope.extra = 1; }))],
    ['wrong scope kind', JSON.stringify(mutate((p) => { p.scope.kind = 'GLOBAL'; }))],
    ['invalid sessionId', JSON.stringify(mutate((p) => { p.scope.sessionId = 'not-a-uuid'; }))],
    ['serialized/session mismatch', JSON.stringify(mutate((p) => { p.scope.serialized = `CONVERSATION_SESSION:${randomUUID()}`; }))],
    ['unserialized scope', JSON.stringify(mutate((p) => { p.scope.serialized = p.scope.sessionId; }))],
    ['non-array evidenceIds', JSON.stringify({ ...valid, evidenceIds: `memory:${randomUUID()}` })],
    ['zero evidenceIds', JSON.stringify({ ...valid, evidenceIds: [] })],
    ['nine evidenceIds', JSON.stringify({ ...valid, evidenceIds: Array.from({ length: 9 }, () => `memory:${randomUUID()}`) })],
    ['malformed evidence id', JSON.stringify({ ...valid, evidenceIds: ['memory:not-a-uuid'] })],
    ['bare uuid evidence id', JSON.stringify({ ...valid, evidenceIds: [randomUUID()] })],
    ['non-string evidence id', JSON.stringify({ ...valid, evidenceIds: [1] })],
    ['duplicate evidence ids', JSON.stringify({ ...valid, evidenceIds: [valid.evidenceIds[0], valid.evidenceIds[0]] })],
  ];
  for (const [label, payload] of invalid) {
    assert.equal((await one(VALID, [payload])).valid, false, `rejects ${label}`);
  }
}

// Section 17.2.
async function verifyResultDomain() {
  stage = 'result domain constraints';
  const execution = await newExecution();
  const payload = JSON.stringify(intentFor(execution));
  await identity('postgres');
  const patch = (set, key = 'INTENT_PROVIDER') => () => q(
    `UPDATE public.post_response_intelligence_effects SET ${set} WHERE execution_id=$1 AND effect_key=$2`,
    [execution.id, key],
  );
  // A CLAIMED effect may carry no result of any kind.
  await rejected(patch(`result_code='INTENT_AUTHORIZED',result_payload='${payload}'::jsonb`), ['23514']);
  await rejected(patch("result_code='INTENT_NOT_AUTHORIZED'"), ['23514']);
  await rejected(patch("result_reference='memory:x'"), ['23514']);
  await rejected(patch(`result_payload='${payload}'::jsonb`), ['23514']);

  const complete = (set) => `state='COMPLETED',completed_at=CURRENT_TIMESTAMP,${set}`;
  // INTENT_AUTHORIZED requires a valid payload and no reference.
  await rejected(patch(complete("result_code='INTENT_AUTHORIZED'")), ['23514']);
  await rejected(patch(complete("result_code='INTENT_AUTHORIZED',result_payload='{}'::jsonb")), ['23514']);
  await rejected(patch(complete(`result_code='INTENT_AUTHORIZED',result_payload='${payload}'::jsonb,result_reference='memory:x'`)), ['23514']);
  // INTENT_NOT_AUTHORIZED must carry neither payload nor reference.
  await rejected(patch(complete(`result_code='INTENT_NOT_AUTHORIZED',result_payload='${payload}'::jsonb`)), ['23514']);
  await rejected(patch(complete("result_code='INTENT_NOT_AUTHORIZED',result_reference='memory:x'")), ['23514']);
  // There is no third intent result code, and Memory codes are not intent codes.
  for (const code of ['INTENT_MAYBE', 'AUTHORIZED', 'NO_FRESH_EVIDENCE', 'FRESH_EVIDENCE_CREATED']) {
    await rejected(patch(complete(`result_code='${code}'`)), ['23514']);
  }
  // The valid completed shapes are accepted by the schema.
  await q('SAVEPOINT accepted');
  await q(`UPDATE public.post_response_intelligence_effects SET ${complete(`result_code='INTENT_AUTHORIZED',result_payload='${payload}'::jsonb`)} WHERE execution_id=$1 AND effect_key='INTENT_PROVIDER'`, [execution.id]);
  await q('ROLLBACK TO SAVEPOINT accepted');
  await q(`UPDATE public.post_response_intelligence_effects SET ${complete("result_code='INTENT_NOT_AUTHORIZED'")} WHERE execution_id=$1 AND effect_key='INTENT_PROVIDER'`, [execution.id]);
  await q('ROLLBACK TO SAVEPOINT accepted');
  await q('RELEASE SAVEPOINT accepted');

  // Untyped effects can carry no result at all, payload included.
  const untyped = await newExecution({ claim: 'CANDIDATE_PROVIDER' });
  await identity('postgres');
  for (const set of [
    `result_payload='${payload}'::jsonb`,
    "state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code='INTENT_AUTHORIZED'",
    `state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_payload='${payload}'::jsonb`,
  ]) {
    await rejected(() => q(
      `UPDATE public.post_response_intelligence_effects SET ${set} WHERE execution_id=$1 AND effect_key='CANDIDATE_PROVIDER'`,
      [untyped.id],
    ), ['23514']);
  }
  // A Memory effect may never carry a payload; its 0024 branches are otherwise unchanged.
  const memory = await newExecution({ claim: 'MEMORY_WRITE' });
  await identity('postgres');
  await rejected(() => q(
    `UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code='NO_FRESH_EVIDENCE',result_payload='${payload}'::jsonb WHERE execution_id=$1 AND effect_key='MEMORY_WRITE'`,
    [memory.id],
  ), ['23514']);

  // A legacy pre-0029 completed intent row with no result at all stays valid.
  const legacy = await newExecution({ claim: null });
  await identity('postgres');
  await q(
    "INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state,completed_at) VALUES($1,'INTENT_PROVIDER','COMPLETED',CURRENT_TIMESTAMP)",
    [legacy.id],
  );
  const legacyRow = await one(EFFECT, [legacy.id, 'INTENT_PROVIDER']);
  assert.deepEqual(
    { code: legacyRow.result_code, reference: legacyRow.result_reference, payload: legacyRow.result_payload },
    { code: null, reference: null, payload: null },
    'a legacy completed intent row is representable and distinguishable',
  );
  return legacy;
}

// Section 17.7.
async function verifyGenericCompletion() {
  stage = 'generic completion';
  const execution = await newExecution();
  await identity('service_role');
  const intentError = await rejected(() => q(COMPLETE_GENERIC, [execution.id, 'INTENT_PROVIDER']), ['22023']);
  assert.equal(intentError.message, 'INTENT_RESULT_REQUIRED');
  const memoryError = await rejected(() => q(COMPLETE_GENERIC, [execution.id, 'MEMORY_WRITE']), ['22023']);
  assert.equal(memoryError.message, 'MEMORY_RESULT_REQUIRED', 'the Memory error contract is unchanged');
  // The rejected generic completion left the claimed effect untouched.
  await identity('postgres');
  const untouched = await one(EFFECT, [execution.id, 'INTENT_PROVIDER']);
  assert.deepEqual(
    { state: untouched.state, code: untouched.result_code, payload: untouched.result_payload, completed: untouched.completed_at },
    { state: 'CLAIMED', code: null, payload: null, completed: null },
  );
  // Every effect key without a typed durable result keeps generic parity.
  // ASSOCIATION_PROVIDER became the third typed effect in migration 0031; its
  // generic rejection and typed completion are proven by verify-migration-0031.
  const generic = await newExecution({ claim: null });
  await identity('service_role');
  for (const key of EFFECT_KEYS.filter((value) => value !== 'MEMORY_WRITE' && value !== 'INTENT_PROVIDER' && value !== 'ASSOCIATION_PROVIDER')) {
    assert.equal((await one(CLAIM, [generic.id, key])).ok, true, `claim ${key}`);
    assert.equal((await one(COMPLETE_GENERIC, [generic.id, key])).ok, true, `generic completion parity for ${key}`);
  }
}

// Sections 17.4 and 17.5.
async function verifyTypedCompletion() {
  stage = 'typed intent completion';

  // Authorized: result and completion are written together, exactly as supplied.
  const authorized = await newExecution();
  const payload = intentFor(authorized);
  await identity('service_role');
  assert.equal((await one(COMPLETE_INTENT, [authorized.id, 'INTENT_AUTHORIZED', JSON.stringify(payload)])).ok, true);
  await identity('postgres');
  const stored = await one(EFFECT, [authorized.id, 'INTENT_PROVIDER']);
  assert.equal(stored.state, 'COMPLETED');
  assert.ok(stored.completed_at, 'completion timestamp is written with the result');
  assert.equal(stored.result_code, 'INTENT_AUTHORIZED');
  assert.equal(stored.result_reference, null);
  assert.deepEqual(stored.result_payload, payload, 'the durable payload is the exact canonical intent');
  assert.deepEqual(stored.result_payload.evidenceIds, payload.evidenceIds, 'Evidence order is preserved, never re-ranked');

  // Not authorized: durable outcome only, with no invented reason.
  const notAuthorized = await newExecution();
  await identity('service_role');
  assert.equal((await one(COMPLETE_INTENT, [notAuthorized.id, 'INTENT_NOT_AUTHORIZED', null])).ok, true);
  await identity('postgres');
  const skipped = await one(EFFECT, [notAuthorized.id, 'INTENT_PROVIDER']);
  assert.deepEqual(
    { state: skipped.state, code: skipped.result_code, reference: skipped.result_reference, payload: skipped.result_payload },
    { state: 'COMPLETED', code: 'INTENT_NOT_AUTHORIZED', reference: null, payload: null },
  );

  // 17.5: an invalid result leaves the effect CLAIMED and result-less.
  const invalid = await newExecution();
  const invalidPayload = intentFor(invalid);
  await identity('service_role');
  for (const [code, body] of [
    ['INTENT_AUTHORIZED', null],
    ['INTENT_AUTHORIZED', JSON.stringify({})],
    ['INTENT_AUTHORIZED', JSON.stringify({ ...invalidPayload, extra: 1 })],
    ['INTENT_AUTHORIZED', JSON.stringify({ ...invalidPayload, evidenceIds: [] })],
    ['INTENT_NOT_AUTHORIZED', JSON.stringify(invalidPayload)],
    ['INTENT_MAYBE', JSON.stringify(invalidPayload)],
    ['NO_FRESH_EVIDENCE', null],
    [null, null],
  ]) {
    const error = await rejected(() => q(COMPLETE_INTENT, [invalid.id, code, body]), ['22023']);
    assert.equal(error.message, 'INVALID_INTENT_RESULT');
  }
  await identity('postgres');
  const stillClaimed = await one(EFFECT, [invalid.id, 'INTENT_PROVIDER']);
  assert.deepEqual(
    { state: stillClaimed.state, code: stillClaimed.result_code, payload: stillClaimed.result_payload, completed: stillClaimed.completed_at },
    { state: 'CLAIMED', code: null, payload: null, completed: null },
    'a rejected result never completes the effect',
  );

  // 17.4: payload provenance is cross-checked against the canonical execution.
  await identity('service_role');
  for (const [label, forged] of [
    ['a different source turn', { ...invalidPayload, problem: { ...invalidPayload.problem, sourceTurnId: randomUUID() } }],
    ['a different session', (() => { const session = randomUUID(); return { ...invalidPayload, scope: { kind: 'CONVERSATION_SESSION', sessionId: session, serialized: `CONVERSATION_SESSION:${session}` } }; })()],
  ]) {
    const error = await rejected(() => q(COMPLETE_INTENT, [invalid.id, 'INTENT_AUTHORIZED', JSON.stringify(forged)]), ['42501']);
    assert.equal(error.message, 'INTENT_PROVENANCE_MISMATCH', `rejects ${label}`);
  }
  // Cross-execution injection: a payload authorized for one execution cannot
  // complete another.
  const other = await newExecution();
  await identity('service_role');
  const injection = await rejected(() => q(COMPLETE_INTENT, [other.id, 'INTENT_AUTHORIZED', JSON.stringify(invalidPayload)]), ['42501']);
  assert.equal(injection.message, 'INTENT_PROVENANCE_MISMATCH');
  await identity('postgres');
  const otherEffect = await one(EFFECT, [other.id, 'INTENT_PROVIDER']);
  assert.equal(otherEffect.state, 'CLAIMED', 'cross-execution injection mutates nothing');

  // An unknown execution and a terminal execution complete nothing.
  await identity('service_role');
  assert.equal((await one(COMPLETE_INTENT, [randomUUID(), 'INTENT_NOT_AUTHORIZED', null])).ok, false);
  const terminal = await newExecution();
  await identity('service_role');
  await q("SELECT public.finish_post_response_intelligence_execution_v1($1,'QUARANTINED','INDETERMINATE_EFFECT','TEST')", [terminal.id]);
  assert.equal((await one(COMPLETE_INTENT, [terminal.id, 'INTENT_NOT_AUTHORIZED', null])).ok, false,
    'a terminal execution cannot complete an effect');
  await identity('postgres');
  assert.equal((await one(EFFECT, [terminal.id, 'INTENT_PROVIDER'])).state, 'CLAIMED');

  // 17.5: the first durable result is immutable.
  await identity('service_role');
  assert.equal((await one(COMPLETE_INTENT, [authorized.id, 'INTENT_AUTHORIZED', JSON.stringify(payload)])).ok, false,
    'repeating the same completion changes nothing');
  assert.equal((await one(COMPLETE_INTENT, [authorized.id, 'INTENT_NOT_AUTHORIZED', null])).ok, false,
    'a second, different result cannot replace the first');
  assert.equal((await one(COMPLETE_INTENT, [notAuthorized.id, 'INTENT_AUTHORIZED', JSON.stringify(intentFor(notAuthorized))])).ok, false);
  await identity('postgres');
  assert.deepEqual(await one(EFFECT, [authorized.id, 'INTENT_PROVIDER']), stored, 'the completed intent row is byte-identical after both attempts');
  assert.deepEqual(await one(EFFECT, [notAuthorized.id, 'INTENT_PROVIDER']), skipped);

  // 17.6: no end-user role can drive the typed command.
  for (const role of ['authenticated', 'anon']) {
    const denied = await newExecution();
    await identity(role);
    await rejected(() => q(COMPLETE_INTENT, [denied.id, 'INTENT_NOT_AUTHORIZED', null]), ['42501']);
    await rejected(() => q(VALID, [JSON.stringify(intentFor(denied))]), ['42501']);
  }
  // The service role holds EXECUTE on the command but not on the validator: the
  // validator is reachable only as the definer's owner.
  await identity('service_role');
  await rejected(() => q(VALID, [JSON.stringify(payload)]), ['42501']);
  return { authorized, stored };
}

// Section 17.7 / 22: Memory durable results are untouched.
async function verifyMemoryUnchanged() {
  stage = 'Memory semantics unchanged';
  await identity('postgres');
  const memoryId = randomUUID();
  await q(
    "INSERT INTO public.memories(id,user_id,type,content,source,confidence,importance,status) VALUES($1,$2,'GOAL','intent verifier fixture','USER_STATED',1,1,'ACTIVE')",
    [memoryId, userId],
  );
  const skip = await newExecution({ claim: 'MEMORY_WRITE' });
  await identity('service_role');
  assert.equal((await one(COMPLETE_MEMORY, [skip.id, 'NO_FRESH_EVIDENCE', null])).ok, true);
  const write = await newExecution({ claim: 'MEMORY_WRITE' });
  await identity('service_role');
  assert.equal((await one(COMPLETE_MEMORY, [write.id, 'FRESH_EVIDENCE_CREATED', `memory:${memoryId}`])).ok, true);
  await identity('postgres');
  const skipped = await one(EFFECT, [skip.id, 'MEMORY_WRITE']);
  const written = await one(EFFECT, [write.id, 'MEMORY_WRITE']);
  assert.deepEqual(
    { code: skipped.result_code, reference: skipped.result_reference, payload: skipped.result_payload },
    { code: 'NO_FRESH_EVIDENCE', reference: null, payload: null },
  );
  assert.deepEqual(
    { code: written.result_code, reference: written.result_reference, payload: written.result_payload },
    { code: 'FRESH_EVIDENCE_CREATED', reference: `memory:${memoryId}`, payload: null },
  );
  // The Memory command still rejects the same malformed results and still
  // refuses to complete an intent effect.
  await identity('service_role');
  await rejected(() => q(COMPLETE_MEMORY, [skip.id, 'UNKNOWN', null]), ['22023']);
  await rejected(() => q(COMPLETE_MEMORY, [skip.id, 'FRESH_EVIDENCE_CREATED', 'memory:bad']), ['22023']);
  const intentOnly = await newExecution();
  await identity('service_role');
  assert.equal((await one(COMPLETE_MEMORY, [intentOnly.id, 'NO_FRESH_EVIDENCE', null])).ok, false,
    'the Memory command cannot complete an INTENT_PROVIDER effect');
  return memoryId;
}

// Migration 0024's historical text, used to reconstruct a genuine pre-0029
// database rather than a hand-written approximation of one.
function historicalConstraints() {
  const start = previousSql.indexOf('ADD CONSTRAINT post_response_intelligence_effects_claimed_result_check');
  const end = previousSql.indexOf('CREATE OR REPLACE FUNCTION');
  return `ALTER TABLE public.post_response_intelligence_effects\n  ${previousSql.slice(start, previousSql.lastIndexOf(';', end) + 1)}`;
}
function historicalGenericCompletion() {
  const start = previousSql.indexOf('CREATE OR REPLACE FUNCTION public.complete_post_response_intelligence_effect_v1');
  const terminator = 'END;$$;';
  return previousSql.slice(start, previousSql.indexOf(terminator, start) + terminator.length);
}

// Sections 17.1 and 16.
async function verifyUpgradeFromPreCanonicalState() {
  stage = 'pre-0029 reproduction and upgrade';
  await q('SAVEPOINT upgrade');
  await identity('postgres');
  for (const constraint of ['association', 'claimed', 'untyped', 'memory', 'intent']) {
    await q(`ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_${constraint}_result_check`);
  }
  await q(`DROP FUNCTION ${COMPLETION}`);
  await q(`DROP FUNCTION ${VALIDATOR}`);
  // The 0031 Association surface postdates 0029 and is removed the same way so
  // the reconstructed baseline is the true pre-0029 schema.
  await q('DROP FUNCTION public.complete_post_response_association_provider_effect_v1(uuid,text,jsonb)');
  await q('DROP FUNCTION public.post_response_association_commands_valid_v1(jsonb)');
  await q('ALTER TABLE public.post_response_intelligence_effects DROP COLUMN result_payload');
  await q(historicalConstraints());
  await q(historicalGenericCompletion());

  // Pre-0029 the generic result-less RPC really did complete INTENT_PROVIDER.
  const legacyIntent = await newExecution();
  await identity('service_role');
  assert.equal((await one(COMPLETE_GENERIC, [legacyIntent.id, 'INTENT_PROVIDER'])).ok, true,
    'pre-0029: the generic completion accepted INTENT_PROVIDER');
  await identity('postgres');
  const legacyRow = await one(EFFECT, [legacyIntent.id, 'INTENT_PROVIDER']);
  assert.equal(legacyRow.state, 'COMPLETED');
  assert.deepEqual({ code: legacyRow.result_code, reference: legacyRow.result_reference }, { code: null, reference: null },
    'pre-0029: a durably COMPLETED intent effect carried no result at all');
  assert.ok(!('result_payload' in legacyRow), 'pre-0029: there was nowhere to record one');
  // This is the defect: the ledger alone cannot say whether the provider
  // authorized anything, so a redelivery had nothing to recover and the run
  // degraded into a false INTENT_NOT_AUTHORIZED.
  const { recoverable } = await one(
    `SELECT count(*)::int recoverable FROM public.post_response_intelligence_effects
      WHERE execution_id=$1 AND effect_key='INTENT_PROVIDER' AND state='COMPLETED'
        AND (result_code IS NOT NULL OR result_reference IS NOT NULL)`, [legacyIntent.id],
  );
  assert.equal(recoverable, 0, 'pre-0029: nothing in the durable row can recover the authorized intent');

  // A pre-0029 database also holds a typed Memory result and untyped effects.
  const legacyMemory = await newExecution({ claim: 'MEMORY_WRITE' });
  await identity('service_role');
  assert.equal((await one(COMPLETE_MEMORY, [legacyMemory.id, 'NO_FRESH_EVIDENCE', null])).ok, true);
  assert.equal((await one(CLAIM, [legacyMemory.id, 'CONFIDENCE_BATCH'])).ok, true);
  assert.equal((await one(COMPLETE_GENERIC, [legacyMemory.id, 'CONFIDENCE_BATCH'])).ok, true);

  await identity('postgres');
  const executionIds = [legacyIntent.id, legacyMemory.id];
  const before = await rows(
    'SELECT to_jsonb(effect) row FROM public.post_response_intelligence_effects effect WHERE execution_id=ANY($1) ORDER BY execution_id, effect_key',
    [executionIds],
  );
  const executionsBefore = await rows(
    'SELECT to_jsonb(execution) row FROM public.post_response_intelligence_executions execution WHERE id=ANY($1) ORDER BY id', [executionIds],
  );
  const { total: totalBefore } = await one('SELECT count(*)::int total FROM public.post_response_intelligence_effects');

  await q(migrationSql.replace(/^\s*BEGIN;/mu, '').replace(/^\s*COMMIT;\s*$/mu, ''));

  const after = await rows(
    "SELECT to_jsonb(effect)-'result_payload' row, effect.result_payload payload FROM public.post_response_intelligence_effects effect WHERE execution_id=ANY($1) ORDER BY execution_id, effect_key",
    [executionIds],
  );
  assert.deepEqual(after.map((r) => r.row), before.map((r) => r.row),
    'the upgrade leaves existing effect rows byte-identical apart from the new column');
  assert.ok(after.every((r) => r.payload === null), 'the new nullable column simply reads null on historical rows');
  assert.deepEqual(
    await rows('SELECT to_jsonb(execution) row FROM public.post_response_intelligence_executions execution WHERE id=ANY($1) ORDER BY id', [executionIds]),
    executionsBefore, 'the upgrade leaves executions byte-identical',
  );
  assert.equal((await one('SELECT count(*)::int total FROM public.post_response_intelligence_effects')).total, totalBefore,
    'the upgrade deletes nothing');
  // The historical intent result is not inferred: it stays exactly as unknowable
  // as it was, and the legacy row is still readable.
  const preserved = await one(EFFECT, [legacyIntent.id, 'INTENT_PROVIDER']);
  assert.deepEqual(
    { state: preserved.state, code: preserved.result_code, reference: preserved.result_reference, payload: preserved.result_payload },
    { state: 'COMPLETED', code: null, reference: null, payload: null },
  );

  // Migration 0031 follows 0029 on the canonical chain, so re-applying it
  // returns the schema to the live final state before it is re-verified. It
  // touches no existing row.
  await q(associationSql.replace(/^\s*BEGIN;/mu, '').replace(/^\s*COMMIT;\s*$/mu, ''));
  assert.deepEqual(
    (await rows("SELECT to_jsonb(effect)-'result_payload' row FROM public.post_response_intelligence_effects effect WHERE execution_id=ANY($1) ORDER BY execution_id, effect_key", [executionIds])).map((r) => r.row),
    before.map((r) => r.row),
    'migration 0031 also leaves existing rows byte-identical apart from the nullable column',
  );

  // After the upgrade the same generic completion is prohibited, and the typed
  // command works on a fresh effect.
  await verifySurfaceAndAcls();
  stage = 'pre-0029 reproduction and upgrade';
  const upgraded = await newExecution();
  await identity('service_role');
  const blocked = await rejected(() => q(COMPLETE_GENERIC, [upgraded.id, 'INTENT_PROVIDER']), ['22023']);
  assert.equal(blocked.message, 'INTENT_RESULT_REQUIRED');
  const upgradedPayload = intentFor(upgraded);
  assert.equal((await one(COMPLETE_INTENT, [upgraded.id, 'INTENT_AUTHORIZED', JSON.stringify(upgradedPayload)])).ok, true);
  await identity('postgres');
  assert.deepEqual((await one(EFFECT, [upgraded.id, 'INTENT_PROVIDER'])).result_payload, upgradedPayload);
  // Memory typed completion still works on the upgraded database.
  const upgradedMemory = await newExecution({ claim: 'MEMORY_WRITE' });
  await identity('service_role');
  assert.equal((await one(COMPLETE_MEMORY, [upgradedMemory.id, 'NO_FRESH_EVIDENCE', null])).ok, true);

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

    await verifySurfaceAndAcls();
    await verifyPayloadValidator();
    // The upgrade simulation drops and re-adds result_payload, so it runs
    // before any durable payload fixture exists: a row written by a later
    // section would lose its payload to the column drop and then fail the
    // re-added constraint for a reason that has nothing to do with the upgrade.
    await verifyUpgradeFromPreCanonicalState();
    const legacy = await verifyResultDomain();
    await verifyGenericCompletion();
    const { authorized, stored } = await verifyTypedCompletion();
    await verifyMemoryUnchanged();

    // Nothing above disturbed the durable results already written, and the
    // legacy all-null row was never backfilled.
    await identity('postgres');
    assert.deepEqual(await one(EFFECT, [authorized.id, 'INTENT_PROVIDER']), stored);
    const untouchedLegacy = await one(EFFECT, [legacy.id, 'INTENT_PROVIDER']);
    assert.deepEqual(
      { code: untouchedLegacy.result_code, reference: untouchedLegacy.result_reference, payload: untouchedLegacy.result_payload },
      { code: null, reference: null, payload: null },
    );

    console.log('Verified migration 0029: reproduced the pre-0029 result-less INTENT_PROVIDER completion, then proved a bounded immutable canonical intent payload, service-role-only typed completion with execution provenance cross-checks, atomic result-plus-transition with a write-once first result, fail-closed rejection that leaves the effect CLAIMED, the generic completion closed for both typed effects while every other effect key keeps parity, unchanged MEMORY_WRITE semantics, legacy all-null intent rows representable and never backfilled, internal-only validator ACLs, and a clean upgrade that leaves every historical row byte-identical apart from the new nullable column.');
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Durable Intent result verification failed at ${stage} (${code}): ${error?.message ?? 'unknown assertion'}. Connection details were suppressed.`);
  process.exitCode = 1;
});
