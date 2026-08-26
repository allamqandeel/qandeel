import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const migration=read('../migrations/0033_hypothesis_generation_atomicity_recovery_v1.sql'),verifier=read('../verify-migration-0033.mjs'),module=read('../../apps/api/src/post-response-intelligence/durable-generation-result.ts'),types=read('../../apps/api/src/post-response-intelligence/post-response-intelligence.types.ts'),repository=read('../../apps/api/src/post-response-intelligence/post-response-intelligence.repository.ts'),dispatcher=read('../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts'),enrichment=read('../../apps/api/src/background-intelligence/background-intelligence-enrichment.service.ts');

test('0033 reuses the canonical result_payload field and adds no ledger, queue or result column of its own',()=>{
 assert.match(migration,/^BEGIN;/mu);assert.match(migration,/COMMIT;\s*$/u);
 assert.doesNotMatch(migration,/ADD COLUMN/u);
 assert.doesNotMatch(migration,/CREATE TABLE/iu);
 assert.doesNotMatch(migration,/result_candidates|result_hypotheses/u);
 for(const proof of['post_response_generation_candidates_valid_v1','post_response_persisted_hypothesis_ids_valid_v1','NO_ACCEPTED_CANDIDATES','VALIDATED_CANDIDATES','NO_HYPOTHESES_PERSISTED','HYPOTHESES_PERSISTED','jsonb_array_length\\(p_value\\) NOT BETWEEN 1 AND 5',"ARRAY\\['assumptions','contradictingEvidenceIds','disconfirmingConditions','domain','hypothesisId','scope','statement','supportingEvidenceIds','type'\\]",'canonical_evidence_content_key_v1'])assert.match(migration,new RegExp(proof,'u'));
});

test('0033 minimally evolves the result domain: only the untyped check widens and each generation effect gains its own',()=>{
 assert.match(migration,/DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check/u);
 assert.match(migration,/ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK \(\s*effect_key IN \('MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER','CANDIDATE_PROVIDER','HYPOTHESIS_PERSISTENCE'\)/u);
 assert.match(migration,/ADD CONSTRAINT post_response_intelligence_effects_candidate_result_check CHECK/u);
 assert.match(migration,/ADD CONSTRAINT post_response_intelligence_effects_persistence_result_check CHECK/u);
 // The 0029/0031 claimed/memory/intent/association checks are untouched.
 assert.doesNotMatch(migration,/DROP CONSTRAINT post_response_intelligence_effects_(?:claimed|memory|intent|association)_result_check/u);
 assert.match(migration,/state='COMPLETED' AND result_code='NO_ACCEPTED_CANDIDATES' AND result_reference IS NULL AND result_payload IS NULL/u);
 assert.match(migration,/result_code='VALIDATED_CANDIDATES' AND result_reference IS NULL\s*\n?\s*AND result_payload IS NOT NULL AND public\.post_response_generation_candidates_valid_v1\(result_payload\)/u);
 assert.match(migration,/state='COMPLETED' AND result_code='NO_HYPOTHESES_PERSISTED' AND result_reference IS NULL AND result_payload IS NULL/u);
 assert.match(migration,/result_code='HYPOTHESES_PERSISTED' AND result_reference IS NULL\s*\n?\s*AND result_payload IS NOT NULL AND public\.post_response_persisted_hypothesis_ids_valid_v1\(result_payload\)/u);
});

test('both validators are IMMUTABLE, internal-only, and read no table',()=>{
 for(const name of['post_response_generation_candidates_valid_v1','post_response_persisted_hypothesis_ids_valid_v1']){
  assert.match(migration,new RegExp(`CREATE FUNCTION public\\.${name}\\(p_value jsonb\\)[\\s\\S]*?LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path=''`,'u'));
  assert.match(migration,new RegExp(`ALTER FUNCTION public\\.${name}\\(jsonb\\) OWNER TO postgres`,'u'));
  assert.match(migration,new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\(jsonb\\) FROM PUBLIC,anon,authenticated,service_role`,'u'));
  const body=migration.slice(migration.indexOf(`CREATE FUNCTION public.${name}`),migration.indexOf(`ALTER FUNCTION public.${name}`));
  assert.doesNotMatch(body,/FROM public\.post|JOIN public\./u);
 }
});

test('the generic completion fails closed for all five typed effects with their own error contracts',()=>{
 assert.match(migration,/IF p_effect_key='MEMORY_WRITE' THEN RAISE EXCEPTION 'MEMORY_RESULT_REQUIRED'/u);
 assert.match(migration,/IF p_effect_key='INTENT_PROVIDER' THEN RAISE EXCEPTION 'INTENT_RESULT_REQUIRED'/u);
 assert.match(migration,/IF p_effect_key='ASSOCIATION_PROVIDER' THEN RAISE EXCEPTION 'ASSOCIATION_RESULT_REQUIRED'/u);
 assert.match(migration,/IF p_effect_key='CANDIDATE_PROVIDER' THEN RAISE EXCEPTION 'CANDIDATE_RESULT_REQUIRED'/u);
 assert.match(migration,/IF p_effect_key='HYPOTHESIS_PERSISTENCE' THEN RAISE EXCEPTION 'HYPOTHESIS_PERSISTENCE_COMMAND_REQUIRED'/u);
 assert.doesNotMatch(migration,/TYPED_RESULT_REQUIRED/u);
});

test('typed Candidate completion is atomic, service-role only, and provenance-bound to the durable authorized Intent',()=>{
 assert.match(migration,/CREATE FUNCTION public\.complete_post_response_candidate_provider_effect_v1\(p_execution_id uuid,p_result_code text,p_result_payload jsonb DEFAULT NULL\)/u);
 assert.match(migration,/FROM public\.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE/u);
 assert.match(migration,/effect_key='INTENT_PROVIDER' AND effect\.state='COMPLETED' AND effect\.result_code='INTENT_AUTHORIZED'/u);
 assert.match(migration,/CANDIDATE_INTENT_UNAVAILABLE/u);assert.match(migration,/CANDIDATE_INTENT_MISMATCH/u);
 assert.match(migration,/state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL/u);
 assert.match(migration,/ALTER FUNCTION public\.complete_post_response_candidate_provider_effect_v1\(uuid,text,jsonb\) OWNER TO postgres/u);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.complete_post_response_candidate_provider_effect_v1\(uuid,text,jsonb\) FROM PUBLIC,anon,authenticated/u);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.complete_post_response_candidate_provider_effect_v1\(uuid,text,jsonb\) TO service_role/u);
 // The durable authorized Intent is the provenance anchor; live provider/state
 // reauthorization is never re-run inside the completion command.
 const completion=migration.slice(migration.indexOf('CREATE FUNCTION public.complete_post_response_candidate_provider_effect_v1'),migration.indexOf('ALTER FUNCTION public.complete_post_response_candidate_provider_effect_v1'));
 assert.doesNotMatch(completion,/hypotheses|memories|canonical_eligible_memory_ids/u);
});

test('atomic persistence is ONE service-role command that accepts only the execution identity',()=>{
 assert.match(migration,/CREATE FUNCTION public\.persist_post_response_hypothesis_generation_v1\(p_execution_id uuid\)/u);
 const command=migration.slice(migration.indexOf('CREATE FUNCTION public.persist_post_response_hypothesis_generation_v1'),migration.indexOf('ALTER FUNCTION public.persist_post_response_hypothesis_generation_v1'));
 // No candidate payload, user or session parameter exists on this surface.
 assert.doesNotMatch(command,/p_result_payload|p_user_id|p_session_id|p_candidates/u);
 // The durable Candidate result is read from the ledger, and every write goes
 // through the existing narrow canonical background primitives.
 assert.match(command,/effect_key='CANDIDATE_PROVIDER' AND state='COMPLETED'/u);
 assert.match(command,/PERSISTENCE_CANDIDATE_UNAVAILABLE/u);
 assert.match(command,/background_create_system_hypothesis_v1/u);
 assert.match(command,/background_attach_hypothesis_evidence_v1/u);
 assert.match(command,/background_link_competing_hypotheses_v1/u);
 assert.match(command,/effect_key='HYPOTHESIS_PERSISTENCE' FOR UPDATE/u);
 assert.match(command,/result_code='HYPOTHESES_PERSISTED'/u);
 assert.match(command,/result_code='NO_HYPOTHESES_PERSISTED'/u);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.persist_post_response_hypothesis_generation_v1\(uuid\) FROM PUBLIC,anon,authenticated/u);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.persist_post_response_hypothesis_generation_v1\(uuid\) TO service_role/u);
});

test('the pure result module recovers both generation results without providers, inference or new IDs',()=>{
 assert.match(module,/recoverCandidateProviderResult/u);assert.match(module,/recoverHypothesisPersistenceResult/u);
 assert.match(module,/'NO_ACCEPTED_CANDIDATES'/u);assert.match(module,/'VALIDATED_CANDIDATES'/u);
 assert.match(module,/'NO_HYPOTHESES_PERSISTED'/u);assert.match(module,/'HYPOTHESES_PERSISTED'/u);assert.match(module,/'INDETERMINATE'/u);
 assert.match(module,/hypothesisCollisionKey/u);
 assert.match(module,/result_payload/u);assert.doesNotMatch(module,/result_candidates/u);
 // Pure: no provider, no database, no ID generation during recovery.
 assert.doesNotMatch(module,/fetch\(|randomUUID|generate\(|BackgroundIntelligence|createSystemHypothesis/u);
});

test('the effect types leave no generic effect and extend the result-code vocabulary',()=>{
 // Migration 0035 made the last formerly generic key, CONFIDENCE_BATCH,
 // managed, so the generic type is gone; the 0033 generation vocabulary is
 // unchanged.
 assert.doesNotMatch(types,/GenericIntelligenceEffect/u);
 assert.match(types,/ManagedIntelligenceEffect='HYPOTHESIS_UPDATE_BATCH'\|'CONFIDENCE_BATCH'/u);
 assert.match(types,/CandidateProviderEffectResultCode/u);
 assert.match(types,/HypothesisPersistenceEffectResultCode/u);
});

test('repository routes both generation effects through their dedicated commands only',()=>{
 assert.match(repository,/complete_post_response_candidate_provider_effect_v1/u);
 assert.match(repository,/persist_post_response_hypothesis_generation_v1/u);
 assert.match(repository,/result\.code==='NO_ACCEPTED_CANDIDATES'[\s\S]+p_result_payload:null[\s\S]+result\.candidates/u);
});

test('dispatcher generation is sequential, durable, recovery-first, and free of application write loops',()=>{
 assert.doesNotMatch(dispatcher,/claimBoth|GENERATION_PAIR/u);
 assert.match(dispatcher,/recoverCandidateProviderResult/u);assert.match(dispatcher,/recoverHypothesisPersistenceResult/u);
 assert.match(dispatcher,/CANDIDATE_RECOVERY/u);assert.match(dispatcher,/HYPOTHESIS_PERSISTENCE_RECOVERY/u);
 assert.match(dispatcher,/completeCandidateProvider\(execution\.id,plan\)/u);
 assert.match(dispatcher,/persistHypothesisGeneration\(execution\.id\)/u);
 // The application performs no create/attach/link loop and never completes a
 // generation effect generically.
 assert.doesNotMatch(dispatcher,/createSystemHypothesis|attachHypothesisEvidence|linkCompetingHypotheses/u);
 assert.doesNotMatch(dispatcher,/complete\(execution\.id,'CANDIDATE_PROVIDER'\)|complete\(execution\.id,'HYPOTHESIS_PERSISTENCE'\)/u);
 // Candidate stage order: claim, one provider-stage invocation, typed completion.
 assert.ok(dispatcher.indexOf("this.ledger.claim(execution.id,'CANDIDATE_PROVIDER')")<dispatcher.indexOf('generateHypothesisCandidatePlan'));
 assert.ok(dispatcher.indexOf('generateHypothesisCandidatePlan')<dispatcher.indexOf('completeCandidateProvider(execution.id,plan)'));
 assert.ok(dispatcher.indexOf('completeCandidateProvider(execution.id,plan)')<dispatcher.indexOf("this.ledger.claim(execution.id,'HYPOTHESIS_PERSISTENCE')"));
 assert.ok(dispatcher.indexOf("this.ledger.claim(execution.id,'HYPOTHESIS_PERSISTENCE')")<dispatcher.indexOf('persistHypothesisGeneration(execution.id)'));
});

test('the provider stage writes zero Hypotheses and only accepted canonical candidates become durable',()=>{
 assert.match(enrichment,/generateHypothesisCandidatePlan/u);
 const stage=enrichment.slice(enrichment.indexOf('async generateHypothesisCandidatePlan'),enrichment.indexOf('async evaluateHypothesisConfidence'));
 assert.match(stage,/validateHypothesisCandidate/u);
 assert.match(stage,/hypothesisId:randomUUID\(\)/u);
 assert.doesNotMatch(stage,/createSystemHypothesis|attachHypothesisEvidence|linkCompetingHypotheses/u);
 assert.doesNotMatch(enrichment,/async generateHypotheses\(/u);
});

test('the verifier adversarially proves both pre-0033 defects, atomicity, rollback, recovery, and the upgrade',()=>{
 for(const proof of['pre-0033','CANDIDATE_RESULT_REQUIRED','HYPOTHESIS_PERSISTENCE_COMMAND_REQUIRED','CANDIDATE_INTENT_UNAVAILABLE','CANDIDATE_INTENT_MISMATCH','PERSISTENCE_CANDIDATE_UNAVAILABLE','CONFIDENCE_BATCH_MANAGED','byte-identical','never backfilled','rolls back','Evidence is not eligible'])assert.match(verifier,new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'iu'),`missing proof: ${proof}`);
 assert.doesNotMatch(verifier,/TRUNCATE|DROP TABLE|DELETE FROM/iu);
});
