import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const migration=read('../migrations/0026_durable_association_effect_result_v1.sql'),verifier=read('../verify-migration-0026.mjs'),module=read('../../apps/api/src/post-response-intelligence/durable-association-result.ts'),repository=read('../../apps/api/src/post-response-intelligence/post-response-intelligence.repository.ts'),dispatcher=read('../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts');

test('0026 adds a bounded, structurally validated durable Association result column',()=>{
 assert.match(migration,/^BEGIN;/mu);assert.match(migration,/COMMIT;\s*$/u);
 assert.match(migration,/ADD COLUMN result_commands jsonb/u);
 for(const proof of['post_response_association_commands_valid','NO_ASSOCIATION','AUTHORIZED_COMMANDS','jsonb_array_length\\(p_commands\\)<1 OR jsonb_array_length\\(p_commands\\)>4','count\\(\\*\\) FROM jsonb_object_keys\\(e\\)\\)<>4','SUPPORTING','CONTRADICTING'])assert.match(migration,new RegExp(proof,'u'));
});

test('0026 supersedes the 0024 memory/non-memory checks with one disjoint result-domain check',()=>{
 assert.match(migration,/DROP CONSTRAINT post_response_intelligence_effects_non_memory_result_check/u);
 assert.match(migration,/DROP CONSTRAINT post_response_intelligence_effects_memory_result_check/u);
 assert.match(migration,/ADD CONSTRAINT post_response_intelligence_effects_result_domain_check CHECK/u);
 assert.match(migration,/ADD CONSTRAINT post_response_intelligence_effects_claimed_result_check[\s\S]+result_commands IS NULL/u);
});

test('0026 completion is atomic, service-role only, and binds commands to the fresh Evidence',()=>{
 assert.match(migration,/CREATE FUNCTION public\.complete_post_response_association_effect_v1\(p_execution_id uuid,p_result_code text,p_result_commands jsonb DEFAULT NULL\)/u);
 assert.match(migration,/SECURITY DEFINER SET search_path=''/u);
 assert.match(migration,/FROM public\.post_response_intelligence_executions WHERE id=p_execution_id FOR UPDATE/u);
 assert.match(migration,/effect_key='MEMORY_WRITE' AND state='COMPLETED' AND result_code='FRESH_EVIDENCE_CREATED'/u);
 assert.match(migration,/ASSOCIATION_EVIDENCE_MISMATCH/u);assert.match(migration,/ASSOCIATION_EVIDENCE_UNAVAILABLE/u);
 assert.match(migration,/state='CLAIMED' AND result_code IS NULL AND result_commands IS NULL/u);
 assert.match(migration,/ALTER FUNCTION public\.complete_post_response_association_effect_v1\(uuid,text,jsonb\) OWNER TO postgres/u);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.complete_post_response_association_effect_v1\(uuid,text,jsonb\) FROM PUBLIC,anon,authenticated/u);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.complete_post_response_association_effect_v1\(uuid,text,jsonb\) TO service_role/u);
});

test('the generic completion function fails closed for both typed effects',()=>{
 assert.match(migration,/p_effect_key IN \('MEMORY_WRITE','ASSOCIATION_PROVIDER'\) THEN RAISE EXCEPTION 'TYPED_RESULT_REQUIRED'/u);
});

test('the pure result module maps and recovers without inferring or replaying commands',()=>{
 assert.match(module,/toDurableAssociationResult/u);assert.match(module,/recoverAssociationResult/u);
 assert.match(module,/MAX_DURABLE_ASSOCIATION_COMMANDS/u);
 assert.match(module,/'NO_ASSOCIATION'/u);assert.match(module,/'AUTHORIZED_COMMANDS'/u);assert.match(module,/'INDETERMINATE'/u);
 assert.doesNotMatch(module,/\.propose|proposeAndAuthorize|fetch\(|randomUUID\(|HypothesisUpdateService|apply_hypothesis_evidence_update/u);
});

test('repository routes ASSOCIATION completion through its dedicated typed RPC only',()=>{
 assert.match(repository,/complete_post_response_association_effect_v1/u);
 assert.match(repository,/result\.code==='NO_ASSOCIATION'[\s\S]+p_result_commands:null[\s\S]+result\.commands/u);
});

test('dispatcher persists and recovers the durable Association result and performs no mutation',()=>{
 assert.match(dispatcher,/toDurableAssociationResult/u);assert.match(dispatcher,/recoverAssociationResult/u);
 assert.match(dispatcher,/completeAssociation\(execution\.id,durable\)/u);
 assert.match(dispatcher,/INDETERMINATE'\)return this\.terminal\(execution,'QUARANTINED','INDETERMINATE_EFFECT','ASSOCIATION_RECOVERY'\)/u);
 assert.doesNotMatch(dispatcher,/HypothesisUpdateService|apply_hypothesis_evidence_update|attachHypothesisEvidence|createConfidenceEvaluation/u);
});

test('the verifier adversarially proves persistence, atomicity, binding, fail-closed, and cleanup',()=>{
 for(const proof of['NO_ASSOCIATION durable result mismatch','Authorized command fields not preserved','Rejected completion was not atomic','Malformed payload was persisted','Wrong-evidence authorized batch was persisted','Authorized batch completed without durable fresh Evidence','Association completed against a non-RUNNING execution','Generic guard mutated the association effect','Association completion RPC ACL mismatch','residue detected'])assert.match(verifier,new RegExp(proof,'iu'));
 assert.doesNotMatch(verifier,/TRUNCATE|DROP TABLE|DELETE FROM/iu);
});
