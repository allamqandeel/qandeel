// Hypothesis Generation Atomicity & Durable Recovery (migration 0033)
// adversarial verifier.
//
// Runs against a fully migrated database. It reconstructs the pre-0033 state -
// the generic result-less RPC completing CANDIDATE_PROVIDER and
// HYPOTHESIS_PERSISTENCE on the canonical 0032 chain, and the old
// multi-request persistence loop - and reproduces both QAN-AUD-05 defects:
// a result-less completed generation pair carries nothing from which the
// accepted Hypothesis IDs could ever be recovered (a redelivery degrades to an
// empty accepted set), and a later create/attach/link request failing leaves a
// partial canonical Hypothesis graph behind. It then proves, against the live
// hardened state: the internal candidate and persisted-ID validators and their
// ACLs; typed service-role-only Candidate completion bound to the durable
// authorized Intent (domain, serialized scope, Evidence subset) with an
// immutable first result; the ONE atomic persistence command that replays the
// durable plan through the existing narrow canonical background primitives and
// completes HYPOTHESIS_PERSISTENCE with the exact ordered persisted IDs in the
// same transaction; that a forced mid-batch Evidence-ineligibility failure
// rolls back every generated write and leaves the effect CLAIMED and
// result-less; that the generic completion fails closed for all five typed
// effects (and, since migration 0035, for the managed CONFIDENCE_BATCH too);
// that legacy all-null generation rows stay representable and are never
// backfilled; and that a pre-0033 database upgrades with every existing row
// byte-identical. Every fixture is rolled back; no data is retained. No paid
// provider is ever invoked.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const migrationSql = await readFile(new URL('./migrations/0033_hypothesis_generation_atomicity_recovery_v1.sql', import.meta.url), 'utf8');
const previousSql = await readFile(new URL('./migrations/0031_durable_association_provider_result_v1.sql', import.meta.url), 'utf8');
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

const CANDIDATE_VALIDATOR = 'public.post_response_generation_candidates_valid_v1(jsonb)';
const IDS_VALIDATOR = 'public.post_response_persisted_hypothesis_ids_valid_v1(jsonb)';
const CANDIDATE_COMPLETION = 'public.complete_post_response_candidate_provider_effect_v1(uuid,text,jsonb)';
const PERSISTENCE_COMMAND = 'public.persist_post_response_hypothesis_generation_v1(uuid)';
const GENERIC = 'public.complete_post_response_intelligence_effect_v1(uuid,text)';
const ACQUIRE = 'SELECT * FROM public.acquire_post_response_intelligence_execution_v1($1,$2,$3,$4,$5,$6,$7,$8)';
const CLAIM = 'SELECT public.claim_post_response_intelligence_effect_v1($1,$2) ok';
const COMPLETE_CANDIDATE = 'SELECT public.complete_post_response_candidate_provider_effect_v1($1,$2,$3) ok';
const PERSIST = 'SELECT public.persist_post_response_hypothesis_generation_v1($1) ok';
const COMPLETE_GENERIC = 'SELECT public.complete_post_response_intelligence_effect_v1($1,$2) ok';
const COMPLETE_MEMORY = 'SELECT public.complete_post_response_memory_write_effect_v1($1,$2,$3) ok';
const COMPLETE_INTENT = 'SELECT public.complete_post_response_intent_provider_effect_v1($1,$2,$3) ok';
const COMPLETE_ASSOCIATION = 'SELECT public.complete_post_response_association_provider_effect_v1($1,$2,$3) ok';
const VALID_CANDIDATES = 'SELECT public.post_response_generation_candidates_valid_v1($1::jsonb) valid';
const VALID_IDS = 'SELECT public.post_response_persisted_hypothesis_ids_valid_v1($1::jsonb) valid';
const EFFECT = 'SELECT * FROM public.post_response_intelligence_effects WHERE execution_id=$1 AND effect_key=$2';
const HYPOTHESIS = 'SELECT * FROM public.hypotheses WHERE id=$1';
const EFFECT_KEYS = ['MEMORY_WRITE', 'INTENT_PROVIDER', 'CANDIDATE_PROVIDER', 'ASSOCIATION_PROVIDER', 'HYPOTHESIS_UPDATE_BATCH', 'HYPOTHESIS_PERSISTENCE', 'CONFIDENCE_BATCH'];

const userId = randomUUID();
const memories = { first: randomUUID(), second: randomUUID(), third: randomUUID() };
const evidence = { first: `memory:${memories.first}`, second: `memory:${memories.second}`, third: `memory:${memories.third}` };
const INTENT_EVIDENCE = [evidence.first, evidence.second, evidence.third];

const scopeFor = (execution) => `CONVERSATION_SESSION:${execution.session}`;
const candidateFor = (execution, over = {}) => ({
  hypothesisId: randomUUID(),
  statement: `Recurring pattern hypothesis ${randomUUID()}`,
  type: 'CAUSAL',
  domain: 'GENERAL',
  scope: scopeFor(execution),
  supportingEvidenceIds: [evidence.first],
  contradictingEvidenceIds: [],
  assumptions: [],
  disconfirmingConditions: [],
  ...over,
});

// A fresh RUNNING execution. withIntent completes a typed INTENT_AUTHORIZED
// result first (the durable provenance anchor); the CANDIDATE_PROVIDER effect
// is then CLAIMED unless told otherwise.
async function newExecution({ withIntent = true, claimCandidate = true, intentCode = 'INTENT_AUTHORIZED' } = {}) {
  const execution = { id: randomUUID(), session: randomUUID(), turn: randomUUID() };
  await identity('postgres');
  await q(ACQUIRE, [execution.id, randomUUID(), userId, execution.session, execution.turn, '2.0', 'FAST', 'ALLOW']);
  await identity('service_role');
  if (withIntent) {
    assert.equal((await one(CLAIM, [execution.id, 'INTENT_PROVIDER'])).ok, true, 'claim INTENT_PROVIDER');
    const payload = intentCode === 'INTENT_AUTHORIZED' ? JSON.stringify({
      problem: { text: 'Why do I repeat this pattern?', source: 'CURRENT_USER_TURN', sourceTurnId: execution.turn },
      domain: 'GENERAL',
      scope: { kind: 'CONVERSATION_SESSION', sessionId: execution.session, serialized: scopeFor(execution) },
      evidenceIds: INTENT_EVIDENCE,
    }) : null;
    assert.equal((await one(COMPLETE_INTENT, [execution.id, intentCode, payload])).ok, true, 'complete INTENT_PROVIDER');
  }
  if (claimCandidate) assert.equal((await one(CLAIM, [execution.id, 'CANDIDATE_PROVIDER'])).ok, true, 'claim CANDIDATE_PROVIDER');
  return execution;
}

async function claimPersistence(execution) {
  await identity('service_role');
  assert.equal((await one(CLAIM, [execution.id, 'HYPOTHESIS_PERSISTENCE'])).ok, true, 'claim HYPOTHESIS_PERSISTENCE');
}

async function hypothesisCount() {
  await identity('postgres');
  return (await one('SELECT count(*)::int total FROM public.hypotheses WHERE user_id=$1', [userId])).total;
}

async function verifySurfaceAndAcls() {
  stage = 'schema surface and ACLs';
  await identity('postgres');
  // The canonical result_payload field is reused; no generation-specific column exists.
  const columns = (await rows(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='post_response_intelligence_effects' AND column_name IN ('result_payload','result_candidates','result_hypotheses')`,
  )).map((row) => row.column_name);
  assert.deepEqual(columns, ['result_payload'], 'result_payload exists and no generation column was added');

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
  ], 'the 0029/0031 checks survive, each generation effect states its own domain, and the 0034/0035 checks join them');
  const registry = (await one(
    `SELECT pg_get_constraintdef(oid) definition FROM pg_constraint
      WHERE conrelid='public.post_response_intelligence_effects'::regclass
        AND conname='post_response_intelligence_effects_effect_key_check'`,
  )).definition;
  assert.deepEqual([...registry.matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]), EFFECT_KEYS, 'the effect registry is unchanged');
  assert.equal((await one("SELECT relrowsecurity rls FROM pg_class WHERE oid='public.post_response_intelligence_effects'::regclass")).rls, true);

  for (const [signature, expected] of [
    // The typed commands are the server's alone; the validators are granted to nobody.
    [CANDIDATE_COMPLETION, { service_role: true, authenticated: false, anon: false, public: false }],
    [PERSISTENCE_COMMAND, { service_role: true, authenticated: false, anon: false, public: false }],
    [CANDIDATE_VALIDATOR, { service_role: false, authenticated: false, anon: false, public: false }],
    [IDS_VALIDATOR, { service_role: false, authenticated: false, anon: false, public: false }],
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
    assert.equal(definer, signature !== CANDIDATE_VALIDATOR && signature !== IDS_VALIDATOR, `${signature} definer posture`);
  }
  for (const validator of [CANDIDATE_VALIDATOR, IDS_VALIDATOR]) {
    const { volatile: volatility } = await one('SELECT p.provolatile volatile FROM pg_proc p WHERE p.oid=$1::regprocedure', [validator]);
    assert.equal(volatility, 'i', `${validator} is IMMUTABLE`);
  }
  assert.equal((await one('SELECT public.post_response_generation_candidates_valid_v1(NULL) valid')).valid, false,
    'a NULL candidate payload is a hard false, never a NULL a CHECK would treat as satisfied');
  assert.equal((await one('SELECT public.post_response_persisted_hypothesis_ids_valid_v1(NULL) valid')).valid, false,
    'a NULL ID payload is a hard false');
  // No application role gained direct table mutation on the ledger or on hypotheses.
  for (const role of ['authenticated', 'anon', 'service_role']) {
    for (const table of ['public.post_response_intelligence_effects', 'public.hypotheses']) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
        const { allowed } = await one('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} ${privilege} on ${table}`);
      }
    }
  }
}

async function verifyCandidateValidator() {
  stage = 'canonical candidate-plan validation';
  await identity('postgres');
  const execution = { session: randomUUID() };
  const base = () => candidateFor(execution);
  assert.equal((await one(VALID_CANDIDATES, [JSON.stringify([base()])])).valid, true, 'a single canonical candidate is accepted');
  assert.equal((await one(VALID_CANDIDATES, [JSON.stringify(Array.from({ length: 5 }, base))])).valid, true, 'five candidates are the bound, not a rejection');
  assert.equal((await one(VALID_CANDIDATES, [JSON.stringify([candidateFor(execution, {
    contradictingEvidenceIds: [evidence.second],
    assumptions: ['Assumes vague goals recur'],
    disconfirmingConditions: ['A vague goal is finished on time'],
  })])])).valid, true, 'contradicting Evidence and structured text lists are canonical');

  const duplicate = base();
  const longStatement = 'x'.repeat(2001);
  const invalid = [
    ['json null', 'null'],
    ['non-array object', JSON.stringify(base())],
    ['string payload', '"candidates"'],
    ['empty plan', '[]'],
    ['six candidates', JSON.stringify(Array.from({ length: 6 }, base))],
    ['non-object element', JSON.stringify([1])],
    ['missing key', JSON.stringify([(({ assumptions, ...rest }) => rest)(base())])],
    ['extra key', JSON.stringify([{ ...base(), extra: true }])],
    ['bad hypothesis uuid', JSON.stringify([candidateFor(execution, { hypothesisId: 'not-a-uuid' })])],
    ['non-string hypothesis id', JSON.stringify([candidateFor(execution, { hypothesisId: 7 })])],
    ['duplicate hypothesis ids', JSON.stringify([duplicate, { ...base(), hypothesisId: duplicate.hypothesisId }])],
    ['non-string statement', JSON.stringify([candidateFor(execution, { statement: 5 })])],
    ['blank statement', JSON.stringify([candidateFor(execution, { statement: '   ' })])],
    ['overlong statement', JSON.stringify([candidateFor(execution, { statement: longStatement })])],
    ['invalid type', JSON.stringify([candidateFor(execution, { type: 'GUESS' })])],
    ['invalid domain', JSON.stringify([candidateFor(execution, { domain: 'EVERYTHING' })])],
    ['blank scope', JSON.stringify([candidateFor(execution, { scope: ' ' })])],
    ['non-array evidence role', JSON.stringify([candidateFor(execution, { supportingEvidenceIds: evidence.first })])],
    ['non-string evidence entry', JSON.stringify([candidateFor(execution, { supportingEvidenceIds: [9] })])],
    ['bad evidence reference', JSON.stringify([candidateFor(execution, { supportingEvidenceIds: ['memory:bad'] })])],
    ['bare uuid evidence', JSON.stringify([candidateFor(execution, { supportingEvidenceIds: [memories.first] })])],
    ['duplicate evidence within a role', JSON.stringify([candidateFor(execution, { supportingEvidenceIds: [evidence.first, evidence.first] })])],
    ['cross-role evidence conflict', JSON.stringify([candidateFor(execution, { contradictingEvidenceIds: [evidence.first] })])],
    ['thirty-three evidence entries', JSON.stringify([candidateFor(execution, { supportingEvidenceIds: Array.from({ length: 33 }, () => `memory:${randomUUID()}`) })])],
    ['nine assumptions', JSON.stringify([candidateFor(execution, { assumptions: Array.from({ length: 9 }, (unused, index) => `Assumption ${index}`) })])],
    ['blank assumption', JSON.stringify([candidateFor(execution, { assumptions: ['  '] })])],
    ['duplicate assumption', JSON.stringify([candidateFor(execution, { assumptions: ['Same', 'Same'] })])],
    ['non-string disconfirming condition', JSON.stringify([candidateFor(execution, { disconfirmingConditions: [4] })])],
    ['duplicate collision key', JSON.stringify([duplicate, { ...base(), statement: duplicate.statement }])],
    ['whitespace-variant collision key', JSON.stringify([duplicate, { ...base(), statement: `  ${duplicate.statement.replace(/ /gu, '  ')} ` }])],
  ];
  for (const [label, payload] of invalid) {
    assert.equal((await one(VALID_CANDIDATES, [payload])).valid, false, `rejects ${label}`);
  }
  // The validators themselves are reachable only as the definer's owner.
  for (const role of ['service_role', 'authenticated', 'anon']) {
    await identity(role);
    await rejected(() => q(VALID_CANDIDATES, [JSON.stringify([base()])]), ['42501']);
    await rejected(() => q(VALID_IDS, [JSON.stringify([randomUUID()])]), ['42501']);
  }
}

async function verifyPersistedIdsValidator() {
  stage = 'canonical persisted-ID validation';
  await identity('postgres');
  assert.equal((await one(VALID_IDS, [JSON.stringify([randomUUID()])])).valid, true, 'a single canonical ID is accepted');
  assert.equal((await one(VALID_IDS, [JSON.stringify(Array.from({ length: 5 }, () => randomUUID()))])).valid, true, 'five IDs are the bound');
  const repeated = randomUUID();
  for (const [label, payload] of [
    ['json null', 'null'],
    ['object payload', '{}'],
    ['empty list', '[]'],
    ['six IDs', JSON.stringify(Array.from({ length: 6 }, () => randomUUID()))],
    ['non-string element', '[3]'],
    ['bad uuid', '["not-a-uuid"]'],
    ['duplicate IDs', JSON.stringify([repeated, repeated])],
  ]) {
    assert.equal((await one(VALID_IDS, [payload])).valid, false, `rejects ${label}`);
  }
}

async function verifyGenericCompletion() {
  stage = 'generic completion';
  const execution = await newExecution();
  await claimPersistence(execution);
  await identity('service_role');
  const candidateError = await rejected(() => q(COMPLETE_GENERIC, [execution.id, 'CANDIDATE_PROVIDER']), ['22023']);
  assert.equal(candidateError.message, 'CANDIDATE_RESULT_REQUIRED');
  const persistenceError = await rejected(() => q(COMPLETE_GENERIC, [execution.id, 'HYPOTHESIS_PERSISTENCE']), ['22023']);
  assert.equal(persistenceError.message, 'HYPOTHESIS_PERSISTENCE_COMMAND_REQUIRED');
  const associationError = await rejected(() => q(COMPLETE_GENERIC, [execution.id, 'ASSOCIATION_PROVIDER']), ['22023']);
  assert.equal(associationError.message, 'ASSOCIATION_RESULT_REQUIRED', 'the Association error contract is unchanged');
  const intentError = await rejected(() => q(COMPLETE_GENERIC, [execution.id, 'INTENT_PROVIDER']), ['22023']);
  assert.equal(intentError.message, 'INTENT_RESULT_REQUIRED', 'the Intent error contract is unchanged');
  const memoryError = await rejected(() => q(COMPLETE_GENERIC, [execution.id, 'MEMORY_WRITE']), ['22023']);
  assert.equal(memoryError.message, 'MEMORY_RESULT_REQUIRED', 'the Memory error contract is unchanged');
  // The rejected generic completions left both claimed generation effects untouched.
  await identity('postgres');
  for (const key of ['CANDIDATE_PROVIDER', 'HYPOTHESIS_PERSISTENCE']) {
    const untouched = await one(EFFECT, [execution.id, key]);
    assert.deepEqual(
      { state: untouched.state, code: untouched.result_code, payload: untouched.result_payload, completed: untouched.completed_at },
      { state: 'CLAIMED', code: null, payload: null, completed: null },
      `${key} stays CLAIMED and result-less`,
    );
  }
  // Migration 0035 made CONFIDENCE_BATCH managed too, so no generic effect
  // remains: the last formerly generic key fails closed on both the ordinary
  // claim and the generic completion. The 0033 generation contracts above are
  // unaffected.
  const generic = await newExecution({ withIntent: false, claimCandidate: false });
  await identity('service_role');
  for (const key of EFFECT_KEYS.filter((value) => value === 'CONFIDENCE_BATCH')) {
    assert.equal((await rejected(() => q(CLAIM, [generic.id, key]), ['22023'])).message, 'CONFIDENCE_BATCH_MANAGED');
    assert.equal((await rejected(() => q(COMPLETE_GENERIC, [generic.id, key]), ['22023'])).message, 'CONFIDENCE_BATCH_COMMAND_REQUIRED');
  }
}

async function verifyTypedCandidateCompletion() {
  stage = 'typed candidate completion';

  // NO_ACCEPTED_CANDIDATES: durable outcome only, no reference, no payload.
  const noAccepted = await newExecution();
  await identity('service_role');
  assert.equal((await one(COMPLETE_CANDIDATE, [noAccepted.id, 'NO_ACCEPTED_CANDIDATES', null])).ok, true);
  await identity('postgres');
  const empty = await one(EFFECT, [noAccepted.id, 'CANDIDATE_PROVIDER']);
  assert.deepEqual(
    { state: empty.state, code: empty.result_code, reference: empty.result_reference, payload: empty.result_payload },
    { state: 'COMPLETED', code: 'NO_ACCEPTED_CANDIDATES', reference: null, payload: null },
  );
  assert.ok(empty.completed_at, 'completion timestamp is written with the result');

  // VALIDATED_CANDIDATES: result and completion are written together, exactly
  // as supplied and in accepted order, for both the single and maximal plan.
  const persisted = [];
  for (const size of [1, 5]) {
    const execution = await newExecution();
    const plan = Array.from({ length: size }, () => candidateFor(execution));
    await identity('service_role');
    assert.equal((await one(COMPLETE_CANDIDATE, [execution.id, 'VALIDATED_CANDIDATES', JSON.stringify(plan)])).ok, true, `size-${size} completion`);
    await identity('postgres');
    const stored = await one(EFFECT, [execution.id, 'CANDIDATE_PROVIDER']);
    assert.equal(stored.state, 'COMPLETED');
    assert.equal(stored.result_code, 'VALIDATED_CANDIDATES');
    assert.equal(stored.result_reference, null);
    assert.deepEqual(stored.result_payload, plan, 'the durable payload is the exact ordered accepted plan with its pre-assigned stable IDs');
    persisted.push({ execution, stored });
  }

  // An invalid result leaves the effect CLAIMED and result-less.
  const invalid = await newExecution();
  await identity('service_role');
  for (const [code, body] of [
    ['NO_ACCEPTED_CANDIDATES', JSON.stringify([candidateFor(invalid)])],
    ['VALIDATED_CANDIDATES', null],
    ['VALIDATED_CANDIDATES', JSON.stringify([])],
    ['VALIDATED_CANDIDATES', JSON.stringify(Array.from({ length: 6 }, () => candidateFor(invalid)))],
    ['VALIDATED_CANDIDATES', JSON.stringify([candidateFor(invalid, { type: 'GUESS' })])],
    ['VALIDATED_CANDIDATES', JSON.stringify([{ ...candidateFor(invalid), extra: true }])],
    ['AUTHORIZED_COMMANDS', null],
    ['HYPOTHESES_PERSISTED', null],
    [null, null],
  ]) {
    const error = await rejected(() => q(COMPLETE_CANDIDATE, [invalid.id, code, body]), ['22023']);
    assert.equal(error.message, 'INVALID_CANDIDATE_RESULT');
  }
  await identity('postgres');
  const stillClaimed = await one(EFFECT, [invalid.id, 'CANDIDATE_PROVIDER']);
  assert.deepEqual(
    { state: stillClaimed.state, code: stillClaimed.result_code, payload: stillClaimed.result_payload, completed: stillClaimed.completed_at },
    { state: 'CLAIMED', code: null, payload: null, completed: null },
    'a rejected result never completes the effect',
  );
  await identity('service_role');
  assert.equal((await one(COMPLETE_CANDIDATE, [invalid.id, 'NO_ACCEPTED_CANDIDATES', null])).ok, true, 'the claimed effect survives rejected attempts');

  // Durable Intent binding: without this execution's completed authorized
  // Intent nothing can complete, and no current-state authorization is re-run.
  const noIntent = await newExecution({ withIntent: false });
  await identity('service_role');
  const unavailable = await rejected(() => q(COMPLETE_CANDIDATE, [noIntent.id, 'NO_ACCEPTED_CANDIDATES', null]), ['42501']);
  assert.equal(unavailable.message, 'CANDIDATE_INTENT_UNAVAILABLE');
  const notAuthorized = await newExecution({ intentCode: 'INTENT_NOT_AUTHORIZED' });
  await identity('service_role');
  const notAuthorizedError = await rejected(() => q(COMPLETE_CANDIDATE, [notAuthorized.id, 'NO_ACCEPTED_CANDIDATES', null]), ['42501']);
  assert.equal(notAuthorizedError.message, 'CANDIDATE_INTENT_UNAVAILABLE', 'a durable non-authorization is not provenance for candidates');
  // Provenance mismatches: wrong domain, wrong serialized scope, Evidence
  // outside the durable Intent set.
  const mismatch = await newExecution();
  await identity('service_role');
  for (const [label, over] of [
    ['domain', { domain: 'WORK' }],
    ['scope', { scope: `CONVERSATION_SESSION:${randomUUID()}` }],
    ['evidence', { supportingEvidenceIds: [`memory:${randomUUID()}`] }],
  ]) {
    const error = await rejected(() => q(COMPLETE_CANDIDATE, [mismatch.id, 'VALIDATED_CANDIDATES', JSON.stringify([candidateFor(mismatch, over)])]), ['42501']);
    assert.equal(error.message, 'CANDIDATE_INTENT_MISMATCH', `durable Intent ${label} mismatch fails closed`);
  }
  await identity('postgres');
  assert.equal((await one(EFFECT, [mismatch.id, 'CANDIDATE_PROVIDER'])).state, 'CLAIMED', 'provenance rejection mutates nothing');

  // An unknown execution and a terminal execution complete nothing.
  await identity('service_role');
  assert.equal((await one(COMPLETE_CANDIDATE, [randomUUID(), 'NO_ACCEPTED_CANDIDATES', null])).ok, false);
  const terminal = await newExecution();
  await identity('service_role');
  await q("SELECT public.finish_post_response_intelligence_execution_v1($1,'QUARANTINED','INDETERMINATE_EFFECT','TEST')", [terminal.id]);
  assert.equal((await one(COMPLETE_CANDIDATE, [terminal.id, 'NO_ACCEPTED_CANDIDATES', null])).ok, false,
    'a terminal execution cannot complete an effect');

  // The first durable result is immutable.
  await identity('service_role');
  assert.equal((await one(COMPLETE_CANDIDATE, [noAccepted.id, 'NO_ACCEPTED_CANDIDATES', null])).ok, false,
    'repeating the same completion changes nothing');
  assert.equal((await one(COMPLETE_CANDIDATE, [noAccepted.id, 'VALIDATED_CANDIDATES', JSON.stringify([candidateFor(noAccepted)])])).ok, false,
    'a second, different result cannot replace the first');
  await identity('postgres');
  assert.deepEqual(await one(EFFECT, [noAccepted.id, 'CANDIDATE_PROVIDER']), empty, 'the completed row is byte-identical after both attempts');
  for (const { execution, stored } of persisted) {
    assert.deepEqual(await one(EFFECT, [execution.id, 'CANDIDATE_PROVIDER']), stored);
  }

  // No end-user role can drive the typed command or mutate durable results.
  for (const role of ['authenticated', 'anon']) {
    await identity(role);
    await rejected(() => q(COMPLETE_CANDIDATE, [noAccepted.id, 'NO_ACCEPTED_CANDIDATES', null]), ['42501']);
    await rejected(() => q("UPDATE public.post_response_intelligence_effects SET result_code='NO_ACCEPTED_CANDIDATES' WHERE execution_id=$1", [noAccepted.id]), ['42501']);
  }
  return persisted[0].execution;
}

async function verifyAtomicPersistence() {
  stage = 'atomic hypothesis batch persistence';

  // Without a typed completed Candidate nothing can persist: absent, still
  // CLAIMED, or legacy result-less completed - all fail closed.
  const noCandidate = await newExecution({ claimCandidate: false });
  await claimPersistence(noCandidate);
  await identity('service_role');
  let error = await rejected(() => q(PERSIST, [noCandidate.id]), ['42501']);
  assert.equal(error.message, 'PERSISTENCE_CANDIDATE_UNAVAILABLE', 'cannot persist without a typed Candidate result');
  const legacyCandidate = await newExecution({ claimCandidate: false });
  await claimPersistence(legacyCandidate);
  await identity('postgres');
  await q(
    "INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state,completed_at) VALUES($1,'CANDIDATE_PROVIDER','COMPLETED',CURRENT_TIMESTAMP)",
    [legacyCandidate.id],
  );
  await identity('service_role');
  error = await rejected(() => q(PERSIST, [legacyCandidate.id]), ['42501']);
  assert.equal(error.message, 'PERSISTENCE_CANDIDATE_UNAVAILABLE', 'a legacy result-less Candidate is unknowable, never inferred and never backfilled');

  // NO_ACCEPTED_CANDIDATES persists no Hypothesis and completes the durable no-op.
  const noAccepted = await newExecution();
  await identity('service_role');
  assert.equal((await one(COMPLETE_CANDIDATE, [noAccepted.id, 'NO_ACCEPTED_CANDIDATES', null])).ok, true);
  await claimPersistence(noAccepted);
  const beforeNoOp = await hypothesisCount();
  await identity('service_role');
  assert.equal((await one(PERSIST, [noAccepted.id])).ok, true);
  assert.equal(await hypothesisCount(), beforeNoOp, 'the no-op path writes zero Hypotheses');
  await identity('postgres');
  const noOpRow = await one(EFFECT, [noAccepted.id, 'HYPOTHESIS_PERSISTENCE']);
  assert.deepEqual(
    { state: noOpRow.state, code: noOpRow.result_code, reference: noOpRow.result_reference, payload: noOpRow.result_payload },
    { state: 'COMPLETED', code: 'NO_HYPOTHESES_PERSISTED', reference: null, payload: null },
  );

  // The full validated batch commits atomically with the exact semantics of
  // the current successful path: create -> supporting -> contradicting ->
  // earlier-competitor links, SYSTEM_GENERATED origin and database-derived
  // version increments. Migration 0036 appended one deterministic phase to the
  // SAME transaction: once the whole generated graph exists, every created
  // target is admitted CANDIDATE -> ACTIVE before the effect may complete, so
  // each row ends durable persistence ACTIVE at exactly one version above its
  // graph-construction version. The graph arithmetic itself is unchanged.
  const full = await newExecution();
  const first = candidateFor(full, {
    supportingEvidenceIds: [evidence.first],
    contradictingEvidenceIds: [evidence.second],
    assumptions: ['Assumes vague goals recur'],
    disconfirmingConditions: ['A vague goal is finished on time'],
  });
  const second = candidateFor(full, { supportingEvidenceIds: [evidence.second] });
  await identity('service_role');
  assert.equal((await one(COMPLETE_CANDIDATE, [full.id, 'VALIDATED_CANDIDATES', JSON.stringify([first, second])])).ok, true);
  // A completed Candidate with an absent Persistence effect is a valid
  // recoverable state: persistence simply continues from the durable plan.
  await claimPersistence(full);
  await identity('service_role');
  assert.equal((await one(PERSIST, [full.id])).ok, true, 'atomic persistence succeeds');
  await identity('postgres');
  const createdFirst = await one(HYPOTHESIS, [first.hypothesisId]);
  const createdSecond = await one(HYPOTHESIS, [second.hypothesisId]);
  assert.ok(createdFirst && createdSecond, 'the exact pre-assigned candidate IDs were created');
  assert.deepEqual(
    {
      user: createdFirst.user_id, statement: createdFirst.statement, type: createdFirst.type, domain: createdFirst.domain,
      scope: createdFirst.scope, origin: createdFirst.origin, status: createdFirst.status, version: createdFirst.version,
      supporting: createdFirst.supporting_evidence_ids, contradicting: createdFirst.contradicting_evidence_ids,
      competing: createdFirst.competing_hypothesis_ids, assumptions: createdFirst.assumptions, disconfirming: createdFirst.disconfirming_conditions,
    },
    {
      user: userId, statement: first.statement, type: 'CAUSAL', domain: 'GENERAL',
      scope: scopeFor(full), origin: 'SYSTEM_GENERATED', status: 'ACTIVE',
      // create(1) + supporting attach(2) + contradicting attach(3) +
      // competitor link(4) + the single 0036 CANDIDATE -> ACTIVE activation(5).
      version: 5,
      supporting: [evidence.first], contradicting: [evidence.second],
      competing: [second.hypothesisId], assumptions: first.assumptions, disconfirming: first.disconfirmingConditions,
    },
    'the first Hypothesis matches the current successful-path semantics exactly',
  );
  assert.deepEqual(
    { supporting: createdSecond.supporting_evidence_ids, competing: createdSecond.competing_hypothesis_ids, version: createdSecond.version, origin: createdSecond.origin, status: createdSecond.status },
    // create(1) + supporting attach(2) + competitor link(3) + activation(4).
    { supporting: [evidence.second], competing: [first.hypothesisId], version: 4, origin: 'SYSTEM_GENERATED', status: 'ACTIVE' },
    'the second Hypothesis and the mutual competitor link match the current path',
  );
  const persistedRow = await one(EFFECT, [full.id, 'HYPOTHESIS_PERSISTENCE']);
  assert.equal(persistedRow.state, 'COMPLETED');
  assert.equal(persistedRow.result_code, 'HYPOTHESES_PERSISTED');
  assert.equal(persistedRow.result_reference, null);
  assert.deepEqual(persistedRow.result_payload, [first.hypothesisId, second.hypothesisId],
    'the durable result is the exact ordered persisted Hypothesis UUID list');
  // The first durable Persistence result is immutable and re-running the
  // command re-creates nothing.
  const afterFull = await hypothesisCount();
  await identity('service_role');
  assert.equal((await one(PERSIST, [full.id])).ok, false, 'a completed Persistence effect cannot be persisted again');
  assert.equal(await hypothesisCount(), afterFull, 'the retry created nothing');
  await identity('postgres');
  assert.deepEqual(await one(EFFECT, [full.id, 'HYPOTHESIS_PERSISTENCE']), persistedRow);

  // Unknown, unclaimed and terminal targets fail without writes.
  await identity('service_role');
  assert.equal((await one(PERSIST, [randomUUID()])).ok, false, 'an unknown execution persists nothing');
  const unclaimed = await newExecution();
  await identity('service_role');
  assert.equal((await one(COMPLETE_CANDIDATE, [unclaimed.id, 'NO_ACCEPTED_CANDIDATES', null])).ok, true);
  assert.equal((await one(PERSIST, [unclaimed.id])).ok, false, 'an unclaimed HYPOTHESIS_PERSISTENCE effect persists nothing');
  const terminal = await newExecution();
  await identity('service_role');
  assert.equal((await one(COMPLETE_CANDIDATE, [terminal.id, 'NO_ACCEPTED_CANDIDATES', null])).ok, true);
  await claimPersistence(terminal);
  await q("SELECT public.finish_post_response_intelligence_execution_v1($1,'QUARANTINED','INDETERMINATE_EFFECT','TEST')", [terminal.id]);
  assert.equal((await one(PERSIST, [terminal.id])).ok, false, 'a terminal execution persists nothing');

  // Forced mid-batch failure: a valid Candidate result completes first, then
  // canonical Evidence state changes so a LATER attachment is no longer
  // eligible. The single database transaction rolls back EVERY generated
  // write - the earlier Hypothesis of the same batch included - and the
  // Persistence effect stays CLAIMED and result-less for the quarantine path.
  const forced = await newExecution();
  const survivorBait = candidateFor(forced, { supportingEvidenceIds: [evidence.first] });
  const poisoned = candidateFor(forced, { supportingEvidenceIds: [evidence.third] });
  await identity('service_role');
  assert.equal((await one(COMPLETE_CANDIDATE, [forced.id, 'VALIDATED_CANDIDATES', JSON.stringify([survivorBait, poisoned])])).ok, true);
  await claimPersistence(forced);
  await identity('postgres');
  await q("UPDATE public.memories SET status='EXPIRED', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [memories.third]);
  const beforeForced = await hypothesisCount();
  await identity('service_role');
  error = await rejected(() => q(PERSIST, [forced.id]), ['22023']);
  assert.equal(error.message, 'Evidence is not eligible.', 'the canonical migration-0028 Evidence eligibility source of truth is preserved at persistence time');
  await identity('postgres');
  assert.equal(await hypothesisCount(), beforeForced, 'the forced failure rolls back every generated write');
  assert.equal(await one(HYPOTHESIS, [survivorBait.hypothesisId]), undefined, 'no earlier Hypothesis from the same batch survives');
  assert.equal(await one(HYPOTHESIS, [poisoned.hypothesisId]), undefined, 'the failing Hypothesis does not survive either');
  const forcedRow = await one(EFFECT, [forced.id, 'HYPOTHESIS_PERSISTENCE']);
  assert.deepEqual(
    { state: forcedRow.state, code: forcedRow.result_code, reference: forcedRow.result_reference, payload: forcedRow.result_payload },
    { state: 'CLAIMED', code: null, reference: null, payload: null },
    'the Persistence effect stays CLAIMED and result-less after the rollback',
  );
  // Restoring eligibility shows the CLAIMED, result-less state is a real
  // database state, not corruption: the same durable plan then persists whole.
  await q("UPDATE public.memories SET status='ACTIVE', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [memories.third]);
  await identity('service_role');
  assert.equal((await one(PERSIST, [forced.id])).ok, true, 'the durable plan persists once Evidence is canonical again');
  await identity('postgres');
  assert.deepEqual((await one(EFFECT, [forced.id, 'HYPOTHESIS_PERSISTENCE'])).result_payload, [survivorBait.hypothesisId, poisoned.hypothesisId]);
}

// Migration 0031's historical generic completion, used to reconstruct a
// genuine pre-0033 database (the canonical 0032 chain state) rather than a
// hand-written approximation of one.
function historicalGenericCompletion() {
  const start = previousSql.indexOf('CREATE OR REPLACE FUNCTION public.complete_post_response_intelligence_effect_v1');
  const terminator = 'END;$$;';
  return previousSql.slice(start, previousSql.indexOf(terminator, start) + terminator.length);
}

async function verifyPre0033DefectsAndUpgrade() {
  stage = 'pre-0033 reproduction and upgrade';
  await q('SAVEPOINT upgrade');
  await identity('postgres');
  // Reconstruct the exact canonical pre-0033 surface: no generation result
  // domain, 0031's three-key untyped check, 0031's generic completion, and no
  // 0033 functions.
  await q('ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_candidate_result_check');
  await q('ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_persistence_result_check');
  await q('ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check');
  await q(`ALTER TABLE public.post_response_intelligence_effects ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK (
    effect_key IN ('MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER')
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL))`);
  await q(`DROP FUNCTION ${CANDIDATE_COMPLETION}`);
  await q(`DROP FUNCTION ${PERSISTENCE_COMMAND}`);
  await q(`DROP FUNCTION ${CANDIDATE_VALIDATOR}`);
  await q(`DROP FUNCTION ${IDS_VALIDATOR}`);
  await q(historicalGenericCompletion());

  // Defect 1 (QAN-AUD-05): pre-0033 the generic result-less RPC really did
  // complete both generation effects, so the durable ledger carried NOTHING
  // from which the accepted Hypothesis IDs could be recovered - a redelivery
  // saw COMPLETED effects, correctly refused to replay the provider, and
  // degraded to an empty local accepted set.
  const legacyGeneration = await newExecution();
  await claimPersistence(legacyGeneration);
  await identity('service_role');
  assert.equal((await one(COMPLETE_GENERIC, [legacyGeneration.id, 'CANDIDATE_PROVIDER'])).ok, true,
    'pre-0033: the generic completion accepted CANDIDATE_PROVIDER');
  assert.equal((await one(COMPLETE_GENERIC, [legacyGeneration.id, 'HYPOTHESIS_PERSISTENCE'])).ok, true,
    'pre-0033: the generic completion accepted HYPOTHESIS_PERSISTENCE');
  await identity('postgres');
  const { recoverable } = await one(
    `SELECT count(*)::int recoverable FROM public.post_response_intelligence_effects
      WHERE execution_id=$1 AND effect_key IN ('CANDIDATE_PROVIDER','HYPOTHESIS_PERSISTENCE') AND state='COMPLETED'
        AND (result_code IS NOT NULL OR result_reference IS NOT NULL OR result_payload IS NOT NULL)`, [legacyGeneration.id],
  );
  assert.equal(recoverable, 0,
    'pre-0033 defect 1: nothing in the durable rows can recover the accepted Hypothesis IDs, so a redelivery loses the accepted set');

  // Defect 2 (QAN-AUD-05): the old application persistence loop issued each
  // create/attach/link as its OWN request. A later request failing did not
  // undo the earlier ones, so a partial canonical Hypothesis graph survived.
  // Each savepoint below models one committed application request.
  const partialSurvivor = randomUUID();
  const partialPoisoned = randomUUID();
  await q("UPDATE public.memories SET status='EXPIRED', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [memories.third]);
  await identity('service_role');
  await q('SAVEPOINT request_one');
  await q('SELECT * FROM public.background_create_system_hypothesis_v1($1,$2,$3,$4,$5,$6,$7,$8)',
    [userId, partialSurvivor, 'Old-path first hypothesis', 'CAUSAL', 'GENERAL', `CONVERSATION_SESSION:${randomUUID()}`, [], []]);
  await q("SELECT * FROM public.background_attach_hypothesis_evidence_v1($1,$2,$3,'SUPPORTING')", [userId, partialSurvivor, evidence.first]);
  await q('RELEASE SAVEPOINT request_one');
  await q('SAVEPOINT request_two');
  await q('SELECT * FROM public.background_create_system_hypothesis_v1($1,$2,$3,$4,$5,$6,$7,$8)',
    [userId, partialPoisoned, 'Old-path second hypothesis', 'CAUSAL', 'GENERAL', `CONVERSATION_SESSION:${randomUUID()}`, [], []]);
  await q('RELEASE SAVEPOINT request_two');
  await rejected(() => q("SELECT * FROM public.background_attach_hypothesis_evidence_v1($1,$2,$3,'SUPPORTING')", [userId, partialPoisoned, evidence.third]), ['22023']);
  await identity('postgres');
  assert.ok(await one(HYPOTHESIS, [partialSurvivor]), 'pre-0033 defect 2: the earlier fully-written Hypothesis survives the later failure');
  const partialRow = await one(HYPOTHESIS, [partialPoisoned]);
  assert.ok(partialRow, 'pre-0033 defect 2: the half-written Hypothesis also survives');
  assert.deepEqual(partialRow.supporting_evidence_ids, [], 'pre-0033 defect 2: it survives WITHOUT its Evidence - a partial canonical graph');
  await q("UPDATE public.memories SET status='ACTIVE', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [memories.third]);

  // A pre-0033 database also holds typed Memory, Intent and Association
  // results and generic completions of the then-untyped effects. Since
  // migration 0035 CONFIDENCE_BATCH is managed and can no longer be claimed
  // ordinarily, so a still-claimable key stands in for them here; the legacy
  // Confidence upgrade path is proven by verify-migration-0035.
  const seeded = await newExecution({ claimCandidate: false });
  await identity('service_role');
  assert.equal((await one(CLAIM, [seeded.id, 'MEMORY_WRITE'])).ok, true);
  assert.equal((await one(COMPLETE_MEMORY, [seeded.id, 'NO_FRESH_EVIDENCE', null])).ok, true);
  assert.equal((await one(CLAIM, [seeded.id, 'ASSOCIATION_PROVIDER'])).ok, true);
  assert.equal((await one(COMPLETE_ASSOCIATION, [seeded.id, 'NO_ASSOCIATION', null])).ok, true);
  assert.equal((await one(CLAIM, [seeded.id, 'CANDIDATE_PROVIDER'])).ok, true);
  assert.equal((await one(COMPLETE_GENERIC, [seeded.id, 'CANDIDATE_PROVIDER'])).ok, true);

  await identity('postgres');
  const executionIds = [legacyGeneration.id, seeded.id];
  const before = await rows(
    'SELECT to_jsonb(effect) row FROM public.post_response_intelligence_effects effect WHERE execution_id=ANY($1) ORDER BY execution_id, effect_key',
    [executionIds],
  );
  const executionsBefore = await rows(
    'SELECT to_jsonb(execution) row FROM public.post_response_intelligence_executions execution WHERE id=ANY($1) ORDER BY id', [executionIds],
  );
  const hypothesesBefore = await rows(
    'SELECT to_jsonb(h) row FROM public.hypotheses h WHERE id=ANY($1) ORDER BY id', [[partialSurvivor, partialPoisoned]],
  );
  const { total: totalBefore } = await one('SELECT count(*)::int total FROM public.post_response_intelligence_effects');
  const { columns: columnsBefore } = await one(
    "SELECT count(*)::int columns FROM information_schema.columns WHERE table_schema='public' AND table_name='post_response_intelligence_effects'",
  );

  await q(migrationSql.replace(/^\s*BEGIN;/mu, '').replace(/^\s*COMMIT;\s*$/mu, ''));

  // 0033 adds no column and rewrites no history: every existing row - the
  // legacy result-less generation pair, typed Memory/Intent/Association
  // results, the generic Confidence completion, and the historical partial
  // Hypothesis graph - is byte-identical. Nothing is backfilled, inferred or
  // repaired.
  const after = await rows(
    'SELECT to_jsonb(effect) row FROM public.post_response_intelligence_effects effect WHERE execution_id=ANY($1) ORDER BY execution_id, effect_key',
    [executionIds],
  );
  assert.deepEqual(after, before, 'the upgrade leaves existing effect rows byte-identical');
  assert.deepEqual(
    await rows('SELECT to_jsonb(execution) row FROM public.post_response_intelligence_executions execution WHERE id=ANY($1) ORDER BY id', [executionIds]),
    executionsBefore, 'the upgrade leaves executions byte-identical',
  );
  assert.deepEqual(
    await rows('SELECT to_jsonb(h) row FROM public.hypotheses h WHERE id=ANY($1) ORDER BY id', [[partialSurvivor, partialPoisoned]]),
    hypothesesBefore, 'the upgrade performs no historical Hypothesis rewrite',
  );
  assert.equal((await one('SELECT count(*)::int total FROM public.post_response_intelligence_effects')).total, totalBefore, 'the upgrade deletes nothing');
  assert.equal((await one(
    "SELECT count(*)::int columns FROM information_schema.columns WHERE table_schema='public' AND table_name='post_response_intelligence_effects'",
  )).columns, columnsBefore, 'the upgrade adds no column (result_payload is reused)');
  const preservedCandidate = await one(EFFECT, [legacyGeneration.id, 'CANDIDATE_PROVIDER']);
  assert.deepEqual(
    { state: preservedCandidate.state, code: preservedCandidate.result_code, reference: preservedCandidate.result_reference, payload: preservedCandidate.result_payload },
    { state: 'COMPLETED', code: null, reference: null, payload: null },
    'the legacy result-less Candidate row stays exactly as unknowable as it was - never backfilled',
  );

  // After the upgrade the generic completions are prohibited and the typed
  // atomic path works on a fresh execution, on this upgraded database.
  await verifySurfaceAndAcls();
  stage = 'pre-0033 reproduction and upgrade';
  const upgraded = await newExecution();
  await claimPersistence(upgraded);
  await identity('service_role');
  const blockedCandidate = await rejected(() => q(COMPLETE_GENERIC, [upgraded.id, 'CANDIDATE_PROVIDER']), ['22023']);
  assert.equal(blockedCandidate.message, 'CANDIDATE_RESULT_REQUIRED');
  const blockedPersistence = await rejected(() => q(COMPLETE_GENERIC, [upgraded.id, 'HYPOTHESIS_PERSISTENCE']), ['22023']);
  assert.equal(blockedPersistence.message, 'HYPOTHESIS_PERSISTENCE_COMMAND_REQUIRED');
  const upgradedPlan = [candidateFor(upgraded)];
  assert.equal((await one(COMPLETE_CANDIDATE, [upgraded.id, 'VALIDATED_CANDIDATES', JSON.stringify(upgradedPlan)])).ok, true);
  assert.equal((await one(PERSIST, [upgraded.id])).ok, true);
  await identity('postgres');
  assert.deepEqual((await one(EFFECT, [upgraded.id, 'HYPOTHESIS_PERSISTENCE'])).result_payload, [upgradedPlan[0].hypothesisId]);
  assert.ok(await one(HYPOTHESIS, [upgradedPlan[0].hypothesisId]), 'the upgraded typed path creates the exact pre-assigned ID');

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
      `INSERT INTO public.memories(id,user_id,type,content,source,confidence,importance,status) VALUES
        ($1,$4,'GOAL','generation fixture one','USER_STATED',1,1,'ACTIVE'),
        ($2,$4,'GOAL','generation fixture two','USER_STATED',1,1,'ACTIVE'),
        ($3,$4,'GOAL','generation fixture three','USER_STATED',1,1,'ACTIVE')`,
      [memories.first, memories.second, memories.third, userId],
    );

    await verifySurfaceAndAcls();
    await verifyCandidateValidator();
    await verifyPersistedIdsValidator();
    await verifyPre0033DefectsAndUpgrade();
    await verifyGenericCompletion();
    const completed = await verifyTypedCandidateCompletion();
    await verifyAtomicPersistence();

    // Nothing above disturbed the durable results already written.
    await identity('postgres');
    assert.equal((await one(EFFECT, [completed.id, 'CANDIDATE_PROVIDER'])).result_code, 'VALIDATED_CANDIDATES');

    console.log('Verified migration 0033: reproduced both pre-0033 QAN-AUD-05 defects on the canonical 0032 chain (a result-less completed generation pair recovers no accepted Hypothesis IDs, and the old multi-request persistence loop leaves a partial canonical graph), then proved the typed durable candidate plan with stable pre-assigned IDs on the reused result_payload field, service-role-only typed Candidate completion bound to the durable authorized Intent (domain, serialized scope, Evidence subset) with an immutable write-once first result, the ONE atomic persistence command that replays the durable plan through the canonical background primitives and completes HYPOTHESIS_PERSISTENCE with the exact ordered persisted IDs in the same transaction, a forced mid-batch Evidence-ineligibility failure that rolls back every generated write and leaves the effect CLAIMED and result-less, the generic completion closed for all five typed effects and for the migration-0035 managed CONFIDENCE_BATCH (CONFIDENCE_BATCH_MANAGED / CONFIDENCE_BATCH_COMMAND_REQUIRED), unchanged Memory/Intent/Association error contracts, legacy all-null generation rows representable and never backfilled, internal-only validator ACLs, and a clean upgrade that leaves every historical row byte-identical.');
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Hypothesis generation atomicity verification failed at ${stage} (${code}): ${error?.message ?? 'unknown assertion'}. Connection details were suppressed.`);
  process.exitCode = 1;
});
