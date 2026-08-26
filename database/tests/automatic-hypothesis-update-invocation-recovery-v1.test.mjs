import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const migration=read('../migrations/0034_automatic_hypothesis_update_invocation_recovery_v1.sql'),verifier=read('../verify-migration-0034.mjs'),module=read('../../apps/api/src/post-response-intelligence/durable-hypothesis-update-batch-result.ts'),types=read('../../apps/api/src/post-response-intelligence/post-response-intelligence.types.ts'),repository=read('../../apps/api/src/post-response-intelligence/post-response-intelligence.repository.ts'),dispatcher=read('../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts');

test('0034 adds exactly the managed effect surface: no second ledger, table, column or queue',()=>{
 assert.match(migration,/^BEGIN;/mu);assert.match(migration,/COMMIT;\s*$/u);
 assert.doesNotMatch(migration,/CREATE TABLE|ADD COLUMN|CREATE SEQUENCE|TRUNCATE|DROP TABLE/iu);
 const created=[...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map(m=>m[1]).sort();
 assert.deepEqual(created,['claim_post_response_intelligence_effect_v1','complete_post_response_intelligence_effect_v1','execute_post_response_hypothesis_update_batch_v1','post_response_hypothesis_update_batch_result_valid_v1','post_response_hypothesis_update_invocation_ids_valid_v1']);
 assert.match(migration,/CHECK\(effect_key IN\('MEMORY_WRITE','INTENT_PROVIDER','CANDIDATE_PROVIDER','ASSOCIATION_PROVIDER','HYPOTHESIS_UPDATE_BATCH','HYPOTHESIS_PERSISTENCE','CONFIDENCE_BATCH'\)\)/u);
 for(const proof of['UPDATES_APPLIED','UPDATES_REJECTED','HYPOTHESIS_UPDATE_BATCH_MANAGED','HYPOTHESIS_UPDATE_BATCH_COMMAND_REQUIRED'])assert.match(migration,new RegExp(proof,'u'));
});

test('the managed claim and generic completion rules preserve every existing contract',()=>{
 assert.match(migration,/IF p_effect_key='HYPOTHESIS_UPDATE_BATCH' THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_BATCH_MANAGED' USING ERRCODE='22023'/u);
 assert.match(migration,/IF p_effect_key='MEMORY_WRITE' THEN RAISE EXCEPTION 'MEMORY_RESULT_REQUIRED'/u);
 assert.match(migration,/IF p_effect_key='INTENT_PROVIDER' THEN RAISE EXCEPTION 'INTENT_RESULT_REQUIRED'/u);
 assert.match(migration,/IF p_effect_key='ASSOCIATION_PROVIDER' THEN RAISE EXCEPTION 'ASSOCIATION_RESULT_REQUIRED'/u);
 assert.match(migration,/IF p_effect_key='CANDIDATE_PROVIDER' THEN RAISE EXCEPTION 'CANDIDATE_RESULT_REQUIRED'/u);
 assert.match(migration,/IF p_effect_key='HYPOTHESIS_PERSISTENCE' THEN RAISE EXCEPTION 'HYPOTHESIS_PERSISTENCE_COMMAND_REQUIRED'/u);
 assert.match(migration,/IF p_effect_key='HYPOTHESIS_UPDATE_BATCH' THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_BATCH_COMMAND_REQUIRED'/u);
});

test('the result domain minimally evolves: only untyped widens and the managed effect states its own domain',()=>{
 assert.match(migration,/DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check/u);
 assert.match(migration,/ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK \(\s*effect_key IN \('MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER','CANDIDATE_PROVIDER','HYPOTHESIS_PERSISTENCE','HYPOTHESIS_UPDATE_BATCH'\)/u);
 assert.match(migration,/ADD CONSTRAINT post_response_intelligence_effects_update_batch_result_check CHECK/u);
 assert.doesNotMatch(migration,/DROP CONSTRAINT post_response_intelligence_effects_(?:claimed|memory|intent|association|candidate|persistence)_result_check/u);
 assert.match(migration,/state='COMPLETED' AND result_code='UPDATES_REJECTED' AND result_reference IS NULL AND result_payload IS NULL/u);
 assert.match(migration,/result_code='UPDATES_APPLIED' AND result_reference IS NULL\s*\n?\s*AND result_payload IS NOT NULL AND public\.post_response_hypothesis_update_batch_result_valid_v1\(result_payload\)/u);
});

test('both validators are IMMUTABLE, internal-only, and read no table',()=>{
 for(const name of['post_response_hypothesis_update_invocation_ids_valid_v1','post_response_hypothesis_update_batch_result_valid_v1']){
  assert.match(migration,new RegExp(`CREATE FUNCTION public\\.${name}\\(p_value jsonb\\)[\\s\\S]*?LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path=''`,'u'));
  assert.match(migration,new RegExp(`ALTER FUNCTION public\\.${name}\\(jsonb\\) OWNER TO postgres`,'u'));
  assert.match(migration,new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\(jsonb\\) FROM PUBLIC,anon,authenticated,service_role`,'u'));
  const body=migration.slice(migration.indexOf(`CREATE FUNCTION public.${name}`),migration.indexOf(`ALTER FUNCTION public.${name}`));
  assert.doesNotMatch(body,/FROM public\.post|JOIN public\.|FROM public\.hyp/u);
 }
});

test('the managed execute command derives all authority from the execution and the durable A2.3a result',()=>{
 assert.match(migration,/CREATE FUNCTION public\.execute_post_response_hypothesis_update_batch_v1\(p_execution_id uuid,p_invocation_ids jsonb\)/u);
 const command=migration.slice(migration.indexOf('CREATE FUNCTION public.execute_post_response_hypothesis_update_batch_v1'),migration.indexOf('ALTER FUNCTION public.execute_post_response_hypothesis_update_batch_v1'));
 // The application supplies ONLY generated identities: no user, session,
 // command payload, token or JWT parameter exists, and no auth.uid runs.
 assert.doesNotMatch(command,/p_user_id|p_session_id|p_commands|p_token|auth\.uid|request\.jwt|set_config/u);
 assert.match(command,/FROM public\.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE/u);
 assert.match(command,/effect_key='ASSOCIATION_PROVIDER' AND state='COMPLETED'/u);
 assert.match(command,/post_response_association_commands_valid_v1/u);
 assert.match(command,/HYPOTHESIS_UPDATE_COMMANDS_UNAVAILABLE/u);
 assert.match(command,/effect_key='MEMORY_WRITE' AND state='COMPLETED' AND result_code='FRESH_EVIDENCE_CREATED'/u);
 assert.match(command,/HYPOTHESIS_UPDATE_EVIDENCE_UNAVAILABLE/u);assert.match(command,/HYPOTHESIS_UPDATE_EVIDENCE_MISMATCH/u);
 // Deterministic session-bound pre-lock, canonical A2.3b mutation boundary,
 // exact-version Confidence, and the atomic receipt completion.
 assert.match(command,/scope='CONVERSATION_SESSION:'\|\|execution_row\.session_id::text/u);
 assert.match(command,/ORDER BY h\.id ASC\s*\n?\s*FOR UPDATE/u);
 assert.match(command,/background_apply_hypothesis_evidence_update_v1/u);
 assert.match(command,/QANDEEL_HYPOTHESIS_UPDATE_LOOP/u);
 assert.match(command,/background_create_confidence_evaluation_v1/u);
 assert.match(command,/->>'afterVersion'\)::integer/u);
 assert.match(command,/result_code='UPDATES_REJECTED'/u);
 assert.match(command,/result_code='UPDATES_APPLIED',result_payload=receipts/u);
 // The mutation algorithm and Confidence construction are not duplicated.
 assert.doesNotMatch(command,/INSERT INTO public\.hypothesis_updates|UPDATE public\.hypotheses|INSERT INTO public\.confidence_evaluations|canonical_eligible_memory_ids_v1/u);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.execute_post_response_hypothesis_update_batch_v1\(uuid,jsonb\) FROM PUBLIC,anon,authenticated/u);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.execute_post_response_hypothesis_update_batch_v1\(uuid,jsonb\) TO service_role/u);
});

test('the pure recovery module cross-checks receipts against the durable commands without replay or inference',()=>{
 assert.match(module,/recoverHypothesisUpdateBatchResult/u);
 assert.match(module,/'UPDATES_APPLIED'/u);assert.match(module,/'UPDATES_REJECTED'/u);assert.match(module,/'INDETERMINATE'/u);
 assert.match(module,/'EVALUATED'/u);assert.match(module,/'PENDING_RETRY'/u);
 assert.match(module,/commandOrdinal/u);
 assert.doesNotMatch(module,/fetch\(|randomUUID|BackgroundIntelligence|applyHypothesisUpdate|findHypothesis/u);
});

test('the effect types add the managed key with compile-time claim exclusion',()=>{
 assert.match(types,/'HYPOTHESIS_UPDATE_BATCH'/u);
 // Migration 0035 joined CONFIDENCE_BATCH to the managed set; the A2.3c key
 // keeps its exact managed posture.
 assert.match(types,/ManagedIntelligenceEffect='HYPOTHESIS_UPDATE_BATCH'\|'CONFIDENCE_BATCH'/u);
 assert.match(types,/ClaimableIntelligenceEffect=Exclude<IntelligenceEffect,ManagedIntelligenceEffect>/u);
 assert.match(types,/HypothesisUpdateBatchEffectResultCode/u);
 assert.match(repository,/claim\(id:string,effect:ClaimableIntelligenceEffect\)/u);
});

test('the repository managed method sends only the execution identity and generated identities',()=>{
 assert.match(repository,/execute_post_response_hypothesis_update_batch_v1/u);
 assert.match(repository,/executeHypothesisUpdateBatch\(id:string,invocationIds:ReadonlyArray<\{updateId:string;confidenceEvaluationId:string\}>\)/u);
 const method=repository.split('\n').find(line=>line.includes('async executeHypothesisUpdateBatch'));
 assert.doesNotMatch(method,/userId|sessionId|commands|token|jwt/iu);
});

test('the dispatcher consumes the durable batch before generation with no token path and no application loop',()=>{
 assert.match(dispatcher,/recoverHypothesisUpdateBatchResult/u);
 assert.match(dispatcher,/executeHypothesisUpdateBatch\(execution\.id,invocationIds\)/u);
 assert.match(dispatcher,/HYPOTHESIS_UPDATE_BATCH_RECOVERY/u);
 // Ordering: the managed batch stage sits after Association and before the
 // generation eligibility/provider stages.
 assert.ok(dispatcher.indexOf('recoverAssociationResult')<dispatcher.indexOf('executeHypothesisUpdateBatch(execution.id,invocationIds)'));
 assert.ok(dispatcher.indexOf('executeHypothesisUpdateBatch(execution.id,invocationIds)')<dispatcher.indexOf('evaluateGenerationEligibility'));
 assert.ok(dispatcher.indexOf('executeHypothesisUpdateBatch(execution.id,invocationIds)')<dispatcher.indexOf('generateHypothesisCandidatePlan'));
 // No ordinary claim of the managed effect, no process-level update boundary,
 // no foreground service, no token/JWT.
 assert.doesNotMatch(dispatcher,/claim\(execution\.id,'HYPOTHESIS_UPDATE_BATCH'\)/u);
 assert.doesNotMatch(dispatcher,/applyAuthorizedHypothesisUpdate|HypothesisUpdateService|apply_hypothesis_evidence_update|accessToken|jwt/u);
});

test('the verifier adversarially proves the managed batch contract end to end',()=>{
 for(const proof of['HYPOTHESIS_UPDATE_BATCH_MANAGED','HYPOTHESIS_UPDATE_BATCH_COMMAND_REQUIRED','UPDATES_APPLIED','UPDATES_REJECTED','rolls back the entire batch','zero duplicate mutation','PENDING_RETRY','no later-version substitution','cross-user','cross-session','byte-identical','CONFIDENCE_BATCH_MANAGED','CONFIDENCE_BATCH_COMMAND_REQUIRED'])assert.match(verifier,new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'iu'),`missing proof: ${proof}`);
 assert.doesNotMatch(verifier,/TRUNCATE|DROP TABLE|DELETE FROM/iu);
});
