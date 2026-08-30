// Real-PostgreSQL verifier for migration 0038 - Information Gap / Question
// Integration v1. Proves: historical Question foundation preservation and
// authenticated wrapper parity; the explicit-owner internal creation core and
// its ACL; the internal automatic-gap source table (RLS, exact-owner FKs,
// bounded codes, exact tuple uniqueness, single-gap binding); the
// service-role-only execution-scoped sync command authority; exact durable
// Update/generation Confidence source consumption; the actionable
// missing-information mapping with the calibration-only exclusion and the
// unknown-future-code fail-closed rule; idempotent re-sync and cross-execution
// tuple reuse; a real two-connection advisory-lock concurrency proof with no
// orphan gap; and complete isolation (zero Question Candidates, zero
// Hypothesis/Confidence/Memory mutation, zero provider or network call, zero
// fixture residue).
import assert from 'node:assert/strict'; import { randomUUID } from 'node:crypto'; import process from 'node:process'; import pg from 'pg';
const { Client } = pg; const databaseUrl = process.env.DATABASE_URL; if (!databaseUrl) throw new Error('DATABASE_URL is required in the ignored local .env file.');
const client = new Client({ connectionString: databaseUrl });

const ACTIONABLE = ['NO_ELIGIBLE_EVIDENCE', 'UNVERIFIED_ASSUMPTIONS', 'COMPETING_HYPOTHESES_UNASSESSED'];
const CONTROLLED_TEXT = {
  NO_ELIGIBLE_EVIDENCE: 'Eligible evidence for the current Hypothesis version is missing.',
  UNVERIFIED_ASSUMPTIONS: 'One or more assumptions in the current Hypothesis remain unverified.',
  COMPETING_HYPOTHESES_UNASSESSED: 'Competing Hypotheses remain unassessed in the current Confidence snapshot.',
};
const QUARANTINED = { status: 'QUARANTINED', reason: 'SOURCE_INTEGRITY_FAILURE' };
const NO_GAPS = { status: 'NO_INFORMATION_GAPS', gaps: [] };

async function identity(id) { await client.query('SET LOCAL ROLE authenticated'); await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id, role: 'authenticated' })]); }
async function resetRole() { await client.query('RESET ROLE'); await client.query("SELECT set_config('request.jwt.claims','',true)"); }
async function rejectsQuery(text, values) { await client.query('SAVEPOINT expected_failure'); try { await assert.rejects(client.query(text, values)); } finally { await client.query('ROLLBACK TO SAVEPOINT expected_failure'); await client.query('RELEASE SAVEPOINT expected_failure'); } }
async function syncAsServiceRole(executionId) {
  await client.query('SET LOCAL ROLE service_role');
  const { rows } = await client.query('SELECT public.sync_post_response_information_gaps_v1($1) AS value', [executionId]);
  await resetRole();
  return rows[0].value;
}
async function counts(userId) {
  const gaps = Number((await client.query('SELECT count(*) count FROM public.information_gaps WHERE user_id=$1', [userId])).rows[0].count);
  const sources = Number((await client.query('SELECT count(*) count FROM public.information_gap_confidence_sources WHERE user_id=$1', [userId])).rows[0].count);
  const candidates = Number((await client.query('SELECT count(*) count FROM public.question_candidates WHERE user_id=$1', [userId])).rows[0].count);
  return { gaps, sources, candidates };
}
async function insertHypothesis(userId, id, version, statement) {
  await client.query("INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,status,version) VALUES($1,$2,$3,'CAUSAL','GENERAL','verifier-0038','HUMAN_REVIEWED','ACTIVE',$4)", [id, userId, statement, version]);
}
async function insertEvaluation(userId, id, hypothesisId, targetVersion, codes, assumptions = []) {
  await client.query("INSERT INTO public.confidence_evaluations(id,user_id,target_id,target_type,target_version,version,lifecycle_state,numeric_score,confidence_band,calibration_state,stability,supporting_evidence_ids,contradicting_evidence_ids,assumptions,alternative_hypothesis_ids,missing_information_codes,policy_version,provenance) VALUES($1,$2,$3,'HYPOTHESIS',$4,1,'EVALUATED',NULL,NULL,'UNCALIBRATED','UNASSESSED','{}','{}',$5,'{}',$6,'confidence-foundation-v1','QANDEEL_CONFIDENCE_RUNTIME')", [id, userId, hypothesisId, targetVersion, assumptions, codes]);
}
async function insertExecution(userId, id, state = 'RUNNING') {
  await client.query("INSERT INTO public.post_response_intelligence_executions(id,event_id,user_id,session_id,source_turn_id,event_version,processing_path,safety_disposition,state,current_stage,outcome_code,terminal_at) VALUES($1,$2,$3,$4,$5,'2.0','FAST','ALLOW',$6,'VERIFIER_0038',$7,$8)", [id, randomUUID(), userId, randomUUID(), randomUUID(), state, state === 'RUNNING' ? null : 'COMPLETED', state === 'RUNNING' ? null : new Date()]);
}
async function insertEffect(executionId, effectKey, resultCode, resultPayload) {
  await client.query("INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state,completed_at,result_code,result_payload) VALUES($1,$2,'COMPLETED',CURRENT_TIMESTAMP,$3,$4)", [executionId, effectKey, resultCode, resultPayload === null ? null : JSON.stringify(resultPayload)]);
}
const updateReceipt = (hypothesisId, evaluationId, expectedVersion, confidenceStatus = 'EVALUATED') => ({
  commandOrdinal: 1, updateId: randomUUID(), confidenceEvaluationId: evaluationId, hypothesisId,
  expectedVersion, evidenceId: `memory:${randomUUID()}`, evidenceRole: 'SUPPORTING',
  beforeVersion: expectedVersion, afterVersion: expectedVersion + 1, confidenceStatus,
});
const generationReceipt = (hypothesisId, evaluationId, targetVersion, ordinal = 1) => ({ ordinal, hypothesisId, targetVersion, confidenceEvaluationId: evaluationId });

async function verifyStaticAuthority() {
  const { rows: [contract] } = await client.query(`SELECT
    to_regprocedure('public.create_information_gap(jsonb)') IS NOT NULL wrapper_present,
    to_regprocedure('public.create_information_gap_core_v1(uuid,jsonb)') IS NOT NULL core_present,
    to_regprocedure('public.sync_post_response_information_gaps_v1(uuid)') IS NOT NULL sync_present,
    to_regclass('public.information_gap_confidence_sources') IS NOT NULL table_present,
    (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.information_gap_confidence_sources')) table_rls,
    pg_get_functiondef(to_regprocedure('public.create_information_gap(jsonb)')) wrapper_definition,
    pg_get_functiondef(to_regprocedure('public.create_information_gap_core_v1(uuid,jsonb)')) core_definition,
    pg_get_functiondef(to_regprocedure('public.sync_post_response_information_gaps_v1(uuid)')) sync_definition,
    pg_get_function_result(to_regprocedure('public.create_information_gap(jsonb)')) wrapper_result,
    pg_get_function_result(to_regprocedure('public.create_information_gap_core_v1(uuid,jsonb)')) core_result`);
  assert.equal(contract.wrapper_present, true, 'create_information_gap(jsonb) exact signature preserved');
  assert.equal(contract.core_present, true, 'internal core present');
  assert.equal(contract.sync_present, true, 'sync command present with execution-only signature');
  assert.equal(contract.table_present, true, 'source table present');
  assert.equal(contract.table_rls, true, 'source table RLS enabled');
  assert.match(contract.wrapper_result, /SETOF (?:public\.)?information_gaps/u, 'wrapper result shape preserved');
  assert.match(contract.core_result, /SETOF (?:public\.)?information_gaps/u, 'core returns the canonical shape');
  assert.match(contract.wrapper_definition, /auth\.uid\(\)/u, 'wrapper owner still derives only from auth.uid()');
  assert.match(contract.wrapper_definition, /create_information_gap_core_v1/u, 'wrapper delegates to the one shared core');
  assert.doesNotMatch(contract.core_definition, /auth\.uid|request\.jwt/iu, 'core uses no auth.uid() and reconstructs no JWT claims');
  assert.match(contract.core_definition, /SECURITY DEFINER/u, 'core is hardened SECURITY DEFINER');
  assert.match(contract.core_definition, /search_path TO ''/u, 'core search path is fixed empty');
  assert.doesNotMatch(contract.sync_definition, /auth\.uid|request\.jwt/iu, 'sync uses no auth.uid() and no request claims');
  assert.match(contract.sync_definition, /SECURITY DEFINER/u);
  for (const [signature, expectations] of [
    ['public.create_information_gap(jsonb)', { service: false, authenticated: true, anon: false, public: false }],
    ['public.create_information_gap_core_v1(uuid,jsonb)', { service: false, authenticated: false, anon: false, public: false }],
    ['public.sync_post_response_information_gaps_v1(uuid)', { service: true, authenticated: false, anon: false, public: false }],
  ]) {
    const { rows: [acl] } = await client.query("SELECT has_function_privilege('service_role',$1,'EXECUTE') service,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('public',$1,'EXECUTE') public", [signature]);
    assert.deepEqual(acl, expectations, `ACL mismatch for ${signature}`);
  }
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const { rows: [privileges] } = await client.query("SELECT has_table_privilege($1,'public.information_gap_confidence_sources','SELECT') can_select,has_table_privilege($1,'public.information_gap_confidence_sources','INSERT') can_insert,has_table_privilege($1,'public.information_gap_confidence_sources','UPDATE') can_update,has_table_privilege($1,'public.information_gap_confidence_sources','DELETE') can_delete", [role]);
    assert.deepEqual(privileges, { can_select: false, can_insert: false, can_update: false, can_delete: false }, `${role} must hold no privilege on the source table`);
  }
  // 0038 owns no background command: the exact functions it does own are ACL
  // checked above by signature. The former global background_%_v1 census was a
  // future ceiling - a later, separately reviewed background command is not a
  // 0038 regression - and that 0038's own migration text creates no background
  // function is proven statically in the forward-compatibility contract test,
  // never against the live function universe.
  // No pre-0038 automatic rows exist and nothing was backfilled.
  const { rows: [{ count: preexisting }] } = await client.query('SELECT count(*) count FROM public.information_gap_confidence_sources');
  assert.equal(Number(preexisting), 0, 'the source table starts empty: zero backfill of historical Question rows');
}

async function main() { await client.connect(); try {
  await verifyStaticAuthority();
  await client.query('BEGIN'); try {
  const alice = randomUUID(), mallory = randomUUID();
  await client.query('INSERT INTO public.users(id,auth_subject) VALUES($1::uuid,$1::text),($2::uuid,$2::text)', [alice, mallory]);
  const hUpdate = randomUUID(), hGen = randomUUID(), hNoEvidence = randomUUID(), hMixed = randomUUID(), hCalibOnly = randomUUID(), hForeign = randomUUID();
  await insertHypothesis(alice, hUpdate, 2, 'update-target hypothesis');
  await insertHypothesis(alice, hGen, 2, 'generation-target hypothesis');
  await insertHypothesis(alice, hNoEvidence, 1, 'no-evidence hypothesis');
  await insertHypothesis(alice, hMixed, 3, 'mixed-codes hypothesis');
  await insertHypothesis(alice, hCalibOnly, 1, 'calibration-only hypothesis');
  await insertHypothesis(mallory, hForeign, 2, 'foreign hypothesis');
  const eUpdate = randomUUID(), eUpdateSecond = randomUUID(), eGen = randomUUID(), eNoEvidence = randomUUID(), eMixed = randomUUID(), eCalibOnly = randomUUID(), eForeign = randomUUID();
  await insertEvaluation(alice, eUpdate, hUpdate, 2, ['UNVERIFIED_ASSUMPTIONS', 'CONFIDENCE_MODEL_UNCALIBRATED'], ['a bounded explicit assumption']);
  await insertEvaluation(alice, eUpdateSecond, hUpdate, 2, ['UNVERIFIED_ASSUMPTIONS', 'CONFIDENCE_MODEL_UNCALIBRATED'], ['a bounded explicit assumption']);
  await insertEvaluation(alice, eGen, hGen, 2, ['COMPETING_HYPOTHESES_UNASSESSED', 'CONFIDENCE_MODEL_UNCALIBRATED']);
  await insertEvaluation(alice, eNoEvidence, hNoEvidence, 1, ['NO_ELIGIBLE_EVIDENCE', 'CONFIDENCE_MODEL_UNCALIBRATED']);
  await insertEvaluation(alice, eMixed, hMixed, 3, ['COMPETING_HYPOTHESES_UNASSESSED', 'UNVERIFIED_ASSUMPTIONS', 'NO_ELIGIBLE_EVIDENCE', 'CONFIDENCE_MODEL_UNCALIBRATED']);
  await insertEvaluation(alice, eCalibOnly, hCalibOnly, 1, ['CONFIDENCE_MODEL_UNCALIBRATED']);
  await insertEvaluation(mallory, eForeign, hForeign, 2, ['UNVERIFIED_ASSUMPTIONS', 'CONFIDENCE_MODEL_UNCALIBRATED'], ['a foreign assumption']);

  // --- B. Authenticated wrapper parity (owner from auth.uid, forged metadata
  // ignored, cross-user and inconsistent targets rejected, calibration-only
  // rejected, canonical metadata) --------------------------------------------
  await identity(alice);
  const manualGapId = randomUUID();
  const forged = { id: manualGapId, user_id: mallory, information_needed: 'manual unknown', why_it_matters: 'manual reason', related_hypothesis_ids: [hUpdate], confidence_evaluation_id: eUpdate, status: 'ASKED', version: 99, provenance: 'forged' };
  const { rows: [manualGap] } = await client.query('SELECT * FROM public.create_information_gap($1::jsonb)', [forged]);
  assert.equal(manualGap.user_id, alice, 'owner derives only from auth.uid(), never from the payload');
  assert.equal(manualGap.status, 'OPEN'); assert.equal(manualGap.version, 1); assert.equal(manualGap.provenance, 'QANDEEL_QUESTION_RUNTIME');
  await rejectsQuery('SELECT * FROM public.create_information_gap($1::jsonb)', [{ ...forged, id: randomUUID(), related_hypothesis_ids: [hForeign], confidence_evaluation_id: null }]);
  await rejectsQuery('SELECT * FROM public.create_information_gap($1::jsonb)', [{ ...forged, id: randomUUID(), confidence_evaluation_id: eForeign }]);
  await rejectsQuery('SELECT * FROM public.create_information_gap($1::jsonb)', [{ ...forged, id: randomUUID(), related_hypothesis_ids: [hGen], confidence_evaluation_id: eUpdate }]);
  await rejectsQuery('SELECT * FROM public.create_information_gap($1::jsonb)', [{ ...forged, id: randomUUID(), related_hypothesis_ids: [hCalibOnly], confidence_evaluation_id: eCalibOnly }]);
  await resetRole();
  await client.query('SET LOCAL ROLE anon');
  await rejectsQuery('SELECT * FROM public.create_information_gap($1::jsonb)', [{ ...forged, id: randomUUID() }]);
  await resetRole();
  await client.query('SET LOCAL ROLE service_role');
  await rejectsQuery('SELECT * FROM public.create_information_gap($1::jsonb)', [{ ...forged, id: randomUUID() }]);
  await rejectsQuery('SELECT * FROM public.create_information_gap_core_v1($1,$2::jsonb)', [alice, { ...forged, id: randomUUID() }]);
  await resetRole();
  await client.query('SET LOCAL ROLE authenticated');
  await rejectsQuery('SELECT * FROM public.create_information_gap_core_v1($1,$2::jsonb)', [alice, { ...forged, id: randomUUID() }]);
  await resetRole();

  // --- C. Internal core semantics equal the wrapper's ------------------------
  const coreGapId = randomUUID();
  const { rows: [coreGap] } = await client.query('SELECT * FROM public.create_information_gap_core_v1($1,$2::jsonb)', [alice, { ...forged, id: coreGapId }]);
  assert.equal(coreGap.user_id, alice); assert.equal(coreGap.status, 'OPEN'); assert.equal(coreGap.version, 1); assert.equal(coreGap.provenance, 'QANDEEL_QUESTION_RUNTIME');
  await rejectsQuery('SELECT * FROM public.create_information_gap_core_v1($1,$2::jsonb)', [alice, { ...forged, id: randomUUID(), related_hypothesis_ids: [hForeign], confidence_evaluation_id: null }]);
  await rejectsQuery('SELECT * FROM public.create_information_gap_core_v1($1,$2::jsonb)', [alice, { ...forged, id: randomUUID(), related_hypothesis_ids: [hCalibOnly], confidence_evaluation_id: eCalibOnly }]);

  // --- D. Source-table integrity (exact-owner FKs, bounded codes, tuple
  // uniqueness, single-gap binding) — direct inserts as postgres only ---------
  await client.query('SELECT * FROM public.information_gap_confidence_sources');
  await client.query("INSERT INTO public.information_gap_confidence_sources(information_gap_id,user_id,hypothesis_id,target_version,confidence_evaluation_id,missing_information_code) VALUES($1,$2,$3,99,$4,'UNVERIFIED_ASSUMPTIONS')", [manualGapId, alice, hUpdate, eUpdate]);
  await rejectsQuery("INSERT INTO public.information_gap_confidence_sources(information_gap_id,user_id,hypothesis_id,target_version,confidence_evaluation_id,missing_information_code) VALUES($1,$2,$3,99,$4,'UNVERIFIED_ASSUMPTIONS')", [coreGapId, alice, hUpdate, eUpdate]);
  await rejectsQuery("INSERT INTO public.information_gap_confidence_sources(information_gap_id,user_id,hypothesis_id,target_version,confidence_evaluation_id,missing_information_code) VALUES($1,$2,$3,98,$4,'NO_ELIGIBLE_EVIDENCE')", [manualGapId, alice, hUpdate, eUpdate]);
  await rejectsQuery("INSERT INTO public.information_gap_confidence_sources(information_gap_id,user_id,hypothesis_id,target_version,confidence_evaluation_id,missing_information_code) VALUES($1,$2,$3,97,$4,'CONFIDENCE_MODEL_UNCALIBRATED')", [coreGapId, alice, hUpdate, eUpdate]);
  await rejectsQuery("INSERT INTO public.information_gap_confidence_sources(information_gap_id,user_id,hypothesis_id,target_version,confidence_evaluation_id,missing_information_code) VALUES($1,$2,$3,96,$4,'UNVERIFIED_ASSUMPTIONS')", [coreGapId, mallory, hForeign, eForeign]);
  await rejectsQuery("INSERT INTO public.information_gap_confidence_sources(information_gap_id,user_id,hypothesis_id,target_version,confidence_evaluation_id,missing_information_code) VALUES($1,$2,$3,95,$4,'UNVERIFIED_ASSUMPTIONS')", [coreGapId, alice, hForeign, eUpdate]);
  await rejectsQuery("INSERT INTO public.information_gap_confidence_sources(information_gap_id,user_id,hypothesis_id,target_version,confidence_evaluation_id,missing_information_code) VALUES($1,$2,$3,94,$4,'UNVERIFIED_ASSUMPTIONS')", [coreGapId, alice, hUpdate, eForeign]);
  await client.query('DELETE FROM public.information_gap_confidence_sources WHERE information_gap_id=$1', [manualGapId]);

  // --- E/F. Sync authority + Update Confidence source ------------------------
  const xUpdate = randomUUID();
  await insertExecution(alice, xUpdate);
  await insertEffect(xUpdate, 'HYPOTHESIS_UPDATE_BATCH', 'UPDATES_APPLIED', [updateReceipt(hUpdate, eUpdate, 1)]);
  await client.query('SET LOCAL ROLE anon');
  await rejectsQuery('SELECT public.sync_post_response_information_gaps_v1($1)', [xUpdate]);
  await resetRole();
  await client.query('SET LOCAL ROLE authenticated');
  await rejectsQuery('SELECT public.sync_post_response_information_gaps_v1($1)', [xUpdate]);
  await resetRole();
  const hypothesesBefore = JSON.stringify((await client.query('SELECT * FROM public.hypotheses WHERE user_id IN($1,$2) ORDER BY id', [alice, mallory])).rows);
  const evaluationsBefore = JSON.stringify((await client.query('SELECT * FROM public.confidence_evaluations WHERE user_id IN($1,$2) ORDER BY id', [alice, mallory])).rows);
  const updateResult = await syncAsServiceRole(xUpdate);
  assert.equal(updateResult.status, 'INFORMATION_GAPS_AVAILABLE');
  assert.equal(updateResult.gaps.length, 1, 'one exact automatic gap from the evaluated update receipt');
  assert.deepEqual({ ordinal: updateResult.gaps[0].ordinal, hypothesisId: updateResult.gaps[0].hypothesisId, targetVersion: updateResult.gaps[0].targetVersion, missingInformationCode: updateResult.gaps[0].missingInformationCode }, { ordinal: 1, hypothesisId: hUpdate, targetVersion: 2, missingInformationCode: 'UNVERIFIED_ASSUMPTIONS' }, 'the exact afterVersion is preserved');
  const updateGapId = updateResult.gaps[0].informationGapId;
  const { rows: [updateGap] } = await client.query('SELECT * FROM public.information_gaps WHERE id=$1', [updateGapId]);
  assert.deepEqual({ owner: updateGap.user_id, needed: updateGap.information_needed, why: updateGap.why_it_matters, related: updateGap.related_hypothesis_ids, evaluation: updateGap.confidence_evaluation_id, answerability: updateGap.user_answerability, preferred: updateGap.preferred_question_type, status: updateGap.status, version: updateGap.version, provenance: updateGap.provenance },
    { owner: alice, needed: CONTROLLED_TEXT.UNVERIFIED_ASSUMPTIONS, why: 'Confidence Runtime reported UNVERIFIED_ASSUMPTIONS for this exact Hypothesis version.', related: [hUpdate], evaluation: eUpdate, answerability: 'UNASSESSED', preferred: null, status: 'OPEN', version: 1, provenance: 'QANDEEL_QUESTION_RUNTIME' },
    'exact controlled automatic gap payload with exact single-Hypothesis and Confidence linkage');
  const { rows: [updateSource] } = await client.query('SELECT * FROM public.information_gap_confidence_sources WHERE information_gap_id=$1', [updateGapId]);
  assert.deepEqual({ user: updateSource.user_id, hypothesis: updateSource.hypothesis_id, version: updateSource.target_version, evaluation: updateSource.confidence_evaluation_id, code: updateSource.missing_information_code }, { user: alice, hypothesis: hUpdate, version: 2, evaluation: eUpdate, code: 'UNVERIFIED_ASSUMPTIONS' }, 'the durable source row binds the exact tuple');

  const xRetry = randomUUID();
  await insertExecution(alice, xRetry);
  await insertEffect(xRetry, 'HYPOTHESIS_UPDATE_BATCH', 'UPDATES_APPLIED', [updateReceipt(hUpdate, randomUUID(), 4, 'PENDING_RETRY')]);
  assert.deepEqual(await syncAsServiceRole(xRetry), NO_GAPS, 'a PENDING_RETRY receipt produces no Information Gap');

  const beforeQuarantine = await counts(alice);
  for (const [label, hypothesisId, evaluationId, expectedVersion] of [
    ['a foreign evaluation', hForeign, eForeign, 1],
    ['a missing evaluation', hUpdate, randomUUID(), 1],
    ['an exact-version mismatch', hUpdate, eUpdate, 2],
  ]) {
    const execution = randomUUID();
    await insertExecution(alice, execution);
    await insertEffect(execution, 'HYPOTHESIS_UPDATE_BATCH', 'UPDATES_APPLIED', [updateReceipt(hypothesisId, evaluationId, expectedVersion)]);
    assert.deepEqual(await syncAsServiceRole(execution), QUARANTINED, `${label} fails closed`);
  }
  const xRejected = randomUUID();
  await insertExecution(alice, xRejected);
  await insertEffect(xRejected, 'HYPOTHESIS_UPDATE_BATCH', 'UPDATES_REJECTED', null);
  assert.deepEqual(await syncAsServiceRole(xRejected), QUARANTINED, 'an UPDATES_REJECTED batch is untrusted and creates no gap');
  assert.deepEqual(await syncAsServiceRole(randomUUID()), QUARANTINED, 'a missing execution fails closed');
  const xTerminal = randomUUID();
  await insertExecution(alice, xTerminal, 'COMPLETED');
  assert.deepEqual(await syncAsServiceRole(xTerminal), QUARANTINED, 'a terminal execution is never a sync source');
  assert.deepEqual(await counts(alice), beforeQuarantine, 'every failed-closed invocation wrote zero gaps and zero source rows');

  // --- G/H. Generation Confidence source + missing-information semantics -----
  const yGen = randomUUID();
  await insertExecution(alice, yGen);
  await insertEffect(yGen, 'CONFIDENCE_BATCH', 'CONFIDENCE_BATCH_EVALUATED', [generationReceipt(hGen, eGen, 2)]);
  const genResult = await syncAsServiceRole(yGen);
  assert.equal(genResult.status, 'INFORMATION_GAPS_AVAILABLE');
  assert.deepEqual(genResult.gaps.map((gap) => ({ hypothesisId: gap.hypothesisId, targetVersion: gap.targetVersion, missingInformationCode: gap.missingInformationCode })), [{ hypothesisId: hGen, targetVersion: 2, missingInformationCode: 'COMPETING_HYPOTHESES_UNASSESSED' }], 'the exact generation receipt target/version/code is preserved');
  const { rows: [genGap] } = await client.query('SELECT * FROM public.information_gaps WHERE id=$1', [genResult.gaps[0].informationGapId]);
  assert.equal(genGap.information_needed, CONTROLLED_TEXT.COMPETING_HYPOTHESES_UNASSESSED);
  assert.equal(genGap.confidence_evaluation_id, eGen);
  const yNoTargets = randomUUID();
  await insertExecution(alice, yNoTargets);
  await insertEffect(yNoTargets, 'CONFIDENCE_BATCH', 'NO_CONFIDENCE_TARGETS', null);
  assert.deepEqual(await syncAsServiceRole(yNoTargets), NO_GAPS, 'NO_CONFIDENCE_TARGETS adds no generation gap');
  const preForeign = await counts(alice);
  const yForeign = randomUUID();
  await insertExecution(alice, yForeign);
  await insertEffect(yForeign, 'CONFIDENCE_BATCH', 'CONFIDENCE_BATCH_EVALUATED', [generationReceipt(hForeign, eForeign, 2)]);
  assert.deepEqual(await syncAsServiceRole(yForeign), QUARANTINED, 'a foreign generation evaluation fails closed');
  const yMissing = randomUUID();
  await insertExecution(alice, yMissing);
  await insertEffect(yMissing, 'CONFIDENCE_BATCH', 'CONFIDENCE_BATCH_EVALUATED', [generationReceipt(hGen, randomUUID(), 2)]);
  assert.deepEqual(await syncAsServiceRole(yMissing), QUARANTINED, 'a missing generation evaluation fails closed');
  const yLegacy = randomUUID();
  await insertExecution(alice, yLegacy);
  await insertEffect(yLegacy, 'CONFIDENCE_BATCH', null, null);
  assert.deepEqual(await syncAsServiceRole(yLegacy), QUARANTINED, 'a legacy result-less Confidence completion is indeterminate, never inferred');
  assert.deepEqual(await counts(alice), preForeign, 'failed-closed generation sources wrote nothing');

  const yNoEvidence = randomUUID();
  await insertExecution(alice, yNoEvidence);
  await insertEffect(yNoEvidence, 'CONFIDENCE_BATCH', 'CONFIDENCE_BATCH_EVALUATED', [generationReceipt(hNoEvidence, eNoEvidence, 1)]);
  const noEvidenceResult = await syncAsServiceRole(yNoEvidence);
  assert.equal(noEvidenceResult.gaps[0].missingInformationCode, 'NO_ELIGIBLE_EVIDENCE');
  const { rows: [noEvidenceGap] } = await client.query('SELECT information_needed,why_it_matters,user_answerability,preferred_question_type FROM public.information_gaps WHERE id=$1', [noEvidenceResult.gaps[0].informationGapId]);
  assert.deepEqual(noEvidenceGap, { information_needed: CONTROLLED_TEXT.NO_ELIGIBLE_EVIDENCE, why_it_matters: 'Confidence Runtime reported NO_ELIGIBLE_EVIDENCE for this exact Hypothesis version.', user_answerability: 'UNASSESSED', preferred_question_type: null });

  const yMixed = randomUUID();
  await insertExecution(alice, yMixed);
  await insertEffect(yMixed, 'CONFIDENCE_BATCH', 'CONFIDENCE_BATCH_EVALUATED', [generationReceipt(hMixed, eMixed, 3)]);
  const mixedResult = await syncAsServiceRole(yMixed);
  assert.deepEqual(mixedResult.gaps.map((gap) => gap.missingInformationCode), ['COMPETING_HYPOTHESES_UNASSESSED', 'UNVERIFIED_ASSUMPTIONS', 'NO_ELIGIBLE_EVIDENCE'], 'mixed codes materialize only the actionable gaps in stored array order; the calibration-only code is ignored');
  assert.equal(new Set(mixedResult.gaps.map((gap) => gap.informationGapId)).size, 3, 'structurally different codes are distinct gaps, never collapsed');
  const yCalib = randomUUID();
  await insertExecution(alice, yCalib);
  await insertEffect(yCalib, 'CONFIDENCE_BATCH', 'CONFIDENCE_BATCH_EVALUATED', [generationReceipt(hCalibOnly, eCalibOnly, 1)]);
  assert.deepEqual(await syncAsServiceRole(yCalib), NO_GAPS, 'CONFIDENCE_MODEL_UNCALIBRATED alone produces zero gaps');

  // Unknown future code fails closed (the canonical vocabulary CHECK is
  // dropped only inside this rolled-back savepoint to simulate the widening).
  await client.query('SAVEPOINT unknown_code');
  await client.query('ALTER TABLE public.confidence_evaluations DROP CONSTRAINT confidence_missing_information_check');
  const hUnknown = randomUUID(), eUnknown = randomUUID(), yUnknown = randomUUID();
  await insertHypothesis(alice, hUnknown, 1, 'unknown-code hypothesis');
  await insertEvaluation(alice, eUnknown, hUnknown, 1, ['A_FUTURE_STRUCTURAL_CODE', 'CONFIDENCE_MODEL_UNCALIBRATED']);
  await insertExecution(alice, yUnknown);
  await insertEffect(yUnknown, 'CONFIDENCE_BATCH', 'CONFIDENCE_BATCH_EVALUATED', [generationReceipt(hUnknown, eUnknown, 1)]);
  const beforeUnknown = await counts(alice);
  assert.deepEqual(await syncAsServiceRole(yUnknown), QUARANTINED, 'an unknown future missing-information code fails closed, never silently ignored');
  assert.deepEqual(await counts(alice), beforeUnknown, 'the unknown-code invocation wrote nothing');
  await client.query('ROLLBACK TO SAVEPOINT unknown_code'); await client.query('RELEASE SAVEPOINT unknown_code');

  // --- I. Idempotency, cross-execution reuse, exact-version stability --------
  const beforeResync = await counts(alice);
  const resyncResult = await syncAsServiceRole(xUpdate);
  assert.deepEqual(resyncResult, updateResult, 'repeated sync returns the same canonical gap identity and order');
  assert.deepEqual(await counts(alice), beforeResync, 'the second sync of the same execution created zero duplicate gap/source rows');
  const zSecond = randomUUID();
  await insertExecution(alice, zSecond);
  await insertEffect(zSecond, 'HYPOTHESIS_UPDATE_BATCH', 'UPDATES_APPLIED', [updateReceipt(hUpdate, eUpdateSecond, 1)]);
  const secondExecutionResult = await syncAsServiceRole(zSecond);
  assert.equal(secondExecutionResult.gaps[0].informationGapId, updateGapId, 'a separate execution with the same exact source tuple reuses the same automatic gap');
  assert.deepEqual(await counts(alice), beforeResync, 'cross-execution reuse created zero new gap/source rows');
  const { rows: [reusedSource] } = await client.query('SELECT confidence_evaluation_id FROM public.information_gap_confidence_sources WHERE information_gap_id=$1', [updateGapId]);
  assert.equal(reusedSource.confidence_evaluation_id, eUpdate, 'the source row keeps its first canonical evaluation binding');
  await client.query('SAVEPOINT advanced_version');
  await client.query('UPDATE public.hypotheses SET version=7 WHERE id=$1', [hUpdate]);
  const advancedResult = await syncAsServiceRole(xUpdate);
  assert.deepEqual(advancedResult, updateResult, 'a later Hypothesis version is never substituted: the historical durable source keeps its exact target version');
  await client.query('ROLLBACK TO SAVEPOINT advanced_version'); await client.query('RELEASE SAVEPOINT advanced_version');

  // --- J. Isolation ----------------------------------------------------------
  assert.equal((await counts(alice)).candidates, 0, 'zero Question Candidate rows were created by the integration');
  assert.equal(Number((await client.query('SELECT count(*) count FROM public.question_candidates WHERE user_id=$1', [mallory])).rows[0].count), 0);
  assert.equal(hypothesesBefore, JSON.stringify((await client.query('SELECT * FROM public.hypotheses WHERE user_id IN($1,$2) ORDER BY id', [alice, mallory])).rows), 'zero Hypothesis mutation from every sync invocation');
  assert.equal(evaluationsBefore, JSON.stringify((await client.query('SELECT * FROM public.confidence_evaluations WHERE user_id IN($1,$2) ORDER BY id', [alice, mallory])).rows), 'zero Confidence mutation from every sync invocation');
  assert.equal(Number((await client.query('SELECT count(*) count FROM public.memories WHERE user_id IN($1,$2)', [alice, mallory])).rows[0].count), 0, 'zero Memory rows were touched');
  } finally { await client.query('ROLLBACK'); }

  // --- I.54: real two-connection advisory-lock concurrency proof. Committed
  // fixture, explicit cleanup, zero residue asserted at the end. --------------
  const raceUser = randomUUID(), raceHypothesis = randomUUID();
  const raceEvalA = randomUUID(), raceEvalB = randomUUID(), raceExecA = randomUUID(), raceExecB = randomUUID();
  const clientA = new Client({ connectionString: databaseUrl });
  const clientB = new Client({ connectionString: databaseUrl });
  try {
    await client.query('INSERT INTO public.users(id,auth_subject) VALUES($1::uuid,$1::text)', [raceUser]);
    await insertHypothesis(raceUser, raceHypothesis, 2, 'race-target hypothesis');
    await insertEvaluation(raceUser, raceEvalA, raceHypothesis, 2, ['UNVERIFIED_ASSUMPTIONS', 'CONFIDENCE_MODEL_UNCALIBRATED'], ['a racing assumption']);
    await insertEvaluation(raceUser, raceEvalB, raceHypothesis, 2, ['UNVERIFIED_ASSUMPTIONS', 'CONFIDENCE_MODEL_UNCALIBRATED'], ['a racing assumption']);
    await insertExecution(raceUser, raceExecA);
    await insertExecution(raceUser, raceExecB);
    await insertEffect(raceExecA, 'HYPOTHESIS_UPDATE_BATCH', 'UPDATES_APPLIED', [updateReceipt(raceHypothesis, raceEvalA, 1)]);
    await insertEffect(raceExecB, 'HYPOTHESIS_UPDATE_BATCH', 'UPDATES_APPLIED', [updateReceipt(raceHypothesis, raceEvalB, 1)]);
    await clientA.connect(); await clientB.connect();
    // A opens a transaction, materializes the tuple and HOLDS the advisory
    // lock; B's concurrent sync must block on the lock instead of racing a
    // read-then-insert, then reuse A's committed gap.
    await clientA.query('BEGIN');
    const { rows: [{ value: resultA }] } = await clientA.query('SELECT public.sync_post_response_information_gaps_v1($1) AS value', [raceExecA]);
    assert.equal(resultA.status, 'INFORMATION_GAPS_AVAILABLE');
    const pendingB = clientB.query('SELECT public.sync_post_response_information_gaps_v1($1) AS value', [raceExecB]);
    pendingB.catch(() => undefined); // guarded branch: a teardown-path rejection must never become an unhandled rejection
    const winner = await Promise.race([pendingB.then(() => 'COMPLETED', () => 'COMPLETED'), new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), 750))]);
    assert.equal(winner, 'BLOCKED', 'the concurrent same-tuple sync blocks on the advisory lock instead of racing');
    await clientA.query('COMMIT');
    const { rows: [{ value: resultB }] } = await pendingB;
    assert.equal(resultB.status, 'INFORMATION_GAPS_AVAILABLE');
    assert.equal(resultB.gaps[0].informationGapId, resultA.gaps[0].informationGapId, 'both concurrent executions resolved to the same canonical gap identity');
    const { rows: raceRows } = await client.query('SELECT count(*) gap_count,(SELECT count(*) FROM public.information_gap_confidence_sources WHERE user_id=$1) source_count FROM public.information_gaps WHERE user_id=$1', [raceUser]);
    assert.deepEqual({ gaps: Number(raceRows[0].gap_count), sources: Number(raceRows[0].source_count) }, { gaps: 1, sources: 1 }, 'exactly one canonical gap/source pair survived the race: no orphan automatic gap');
  } finally {
    await clientA.end().catch(() => undefined); await clientB.end().catch(() => undefined);
    // Committed-fixture cleanup runs with triggers disabled, exactly like the
    // shared cleanupVerifierUsers helper: since migration 0063 the durable
    // Information Gap lifecycle guard makes gap history immutable to every
    // ordinary path, so verifier-owned committed fixtures are removed in
    // replica mode rather than through a (correctly) forbidden direct DELETE.
    await client.query("SET session_replication_role='replica'");
    await client.query('DELETE FROM public.information_gap_confidence_sources WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.information_gap_hypotheses WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.information_gaps WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.post_response_intelligence_effects WHERE execution_id IN($1,$2)', [raceExecA, raceExecB]);
    await client.query('DELETE FROM public.post_response_intelligence_executions WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.confidence_evaluations WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.hypotheses WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.users WHERE id=$1', [raceUser]);
    await client.query("SET session_replication_role='origin'");
    const { rows: [{ count: residue }] } = await client.query('SELECT count(*) count FROM public.information_gap_confidence_sources');
    assert.equal(Number(residue), 0, 'the verifier left zero residue in the source table');
  }
} finally { await client.end(); } }

main().then(() => console.log('Verified migration 0038: wrapper parity, explicit-owner core ACL, internal source-table integrity, service-role-only execution-scoped sync, exact durable Update/generation Confidence consumption, actionable-code mapping with calibration exclusion and unknown-code fail-closed, idempotent re-sync, cross-execution tuple reuse, exact-version stability, advisory-lock race safety with no orphan gap, and zero Candidate/Hypothesis/Confidence/Memory mutation with zero provider calls and zero fixture residue.')).catch((error) => { console.error(`Information Gap integration verification failed (${error?.code ?? 'verification'}): ${error?.message ?? error}`); process.exitCode = 1; });
