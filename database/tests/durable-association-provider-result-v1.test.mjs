import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const migration=read('../migrations/0031_durable_association_provider_result_v1.sql'),verifier=read('../verify-migration-0031.mjs'),module=read('../../apps/api/src/post-response-intelligence/durable-association-result.ts'),types=read('../../apps/api/src/post-response-intelligence/post-response-intelligence.types.ts'),repository=read('../../apps/api/src/post-response-intelligence/post-response-intelligence.repository.ts'),dispatcher=read('../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts');

test('0031 reuses the canonical result_payload field and adds no result column of its own',()=>{
 assert.match(migration,/^BEGIN;/mu);assert.match(migration,/COMMIT;\s*$/u);
 assert.doesNotMatch(migration,/ADD COLUMN/u);
 assert.doesNotMatch(migration,/result_commands/u);
 for(const proof of['post_response_association_commands_valid_v1','NO_ASSOCIATION','AUTHORIZED_COMMANDS','jsonb_array_length\\(p_value\\) NOT BETWEEN 1 AND 4',"ARRAY\\['evidenceId','evidenceRole','expectedVersion','hypothesisId'\\]",'SUPPORTING','CONTRADICTING','2147483647'])assert.match(migration,new RegExp(proof,'u'));
});

test('0031 minimally evolves the 0029 result domain: only the untyped check widens and Association gains its own',()=>{
 assert.match(migration,/DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check/u);
 assert.match(migration,/ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK \(\s*effect_key IN \('MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER'\)/u);
 assert.match(migration,/ADD CONSTRAINT post_response_intelligence_effects_association_result_check CHECK/u);
 // The 0029 claimed/memory/intent checks are untouched.
 assert.doesNotMatch(migration,/DROP CONSTRAINT post_response_intelligence_effects_(?:claimed|memory|intent)_result_check/u);
 // Association's domain: legacy all-null, payload-free NO_ASSOCIATION, or a validated AUTHORIZED_COMMANDS payload.
 assert.match(migration,/state='COMPLETED' AND result_code='NO_ASSOCIATION' AND result_reference IS NULL AND result_payload IS NULL/u);
 assert.match(migration,/result_code='AUTHORIZED_COMMANDS' AND result_reference IS NULL\s*\n?\s*AND result_payload IS NOT NULL AND public\.post_response_association_commands_valid_v1\(result_payload\)/u);
});

test('the validator is IMMUTABLE, internal-only, and reads no table',()=>{
 assert.match(migration,/CREATE FUNCTION public\.post_response_association_commands_valid_v1\(p_value jsonb\)[\s\S]*?LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path=''/u);
 assert.match(migration,/ALTER FUNCTION public\.post_response_association_commands_valid_v1\(jsonb\) OWNER TO postgres/u);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.post_response_association_commands_valid_v1\(jsonb\) FROM PUBLIC,anon,authenticated,service_role/u);
 const validator=migration.slice(migration.indexOf('CREATE FUNCTION public.post_response_association_commands_valid_v1'),migration.indexOf('ALTER FUNCTION public.post_response_association_commands_valid_v1'));
 assert.doesNotMatch(validator,/FROM public\.|JOIN public\./u);
});

test('0031 typed completion is atomic, service-role only, and binds commands to the exact durable Memory Evidence',()=>{
 assert.match(migration,/CREATE FUNCTION public\.complete_post_response_association_provider_effect_v1\(p_execution_id uuid,p_result_code text,p_result_payload jsonb DEFAULT NULL\)/u);
 assert.match(migration,/RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''/u);
 assert.match(migration,/FROM public\.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE/u);
 assert.match(migration,/effect_key='MEMORY_WRITE' AND state='COMPLETED' AND result_code='FRESH_EVIDENCE_CREATED'/u);
 assert.match(migration,/ASSOCIATION_EVIDENCE_UNAVAILABLE/u);assert.match(migration,/ASSOCIATION_EVIDENCE_MISMATCH/u);
 assert.match(migration,/state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL/u);
 assert.match(migration,/ALTER FUNCTION public\.complete_post_response_association_provider_effect_v1\(uuid,text,jsonb\) OWNER TO postgres/u);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.complete_post_response_association_provider_effect_v1\(uuid,text,jsonb\) FROM PUBLIC,anon,authenticated/u);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.complete_post_response_association_provider_effect_v1\(uuid,text,jsonb\) TO service_role/u);
});

test('the generic completion fails closed for all three typed effects with their own error contracts',()=>{
 assert.match(migration,/IF p_effect_key='MEMORY_WRITE' THEN RAISE EXCEPTION 'MEMORY_RESULT_REQUIRED'/u);
 assert.match(migration,/IF p_effect_key='INTENT_PROVIDER' THEN RAISE EXCEPTION 'INTENT_RESULT_REQUIRED'/u);
 assert.match(migration,/IF p_effect_key='ASSOCIATION_PROVIDER' THEN RAISE EXCEPTION 'ASSOCIATION_RESULT_REQUIRED'/u);
 // The old PR's undifferentiated error is not restored.
 assert.doesNotMatch(migration,/TYPED_RESULT_REQUIRED/u);
});

test('the pure result module maps and recovers on result_payload without inferring or replaying commands',()=>{
 assert.match(module,/toDurableAssociationResult/u);assert.match(module,/recoverAssociationResult/u);
 assert.match(module,/MAX_DURABLE_ASSOCIATION_COMMANDS/u);
 assert.match(module,/result_payload/u);assert.doesNotMatch(module,/result_commands/u);
 assert.match(module,/'NO_ASSOCIATION'/u);assert.match(module,/'AUTHORIZED_COMMANDS'/u);assert.match(module,/'INDETERMINATE'/u);
 assert.doesNotMatch(module,/\.propose|proposeAndAuthorize|fetch\(|randomUUID\(|HypothesisUpdateService|apply_hypothesis_evidence_update/u);
});

test('the effect types exclude every typed effect from generic completion and carry no result_commands',()=>{
 // Migration 0033 extended the exclusion with both generation effects and
 // migration 0034 with the managed update batch; the Association exclusion
 // itself is unchanged.
 assert.match(types,/GenericIntelligenceEffect=Exclude<IntelligenceEffect,'MEMORY_WRITE'\|'INTENT_PROVIDER'\|'ASSOCIATION_PROVIDER'\|'CANDIDATE_PROVIDER'\|'HYPOTHESIS_PERSISTENCE'\|'HYPOTHESIS_UPDATE_BATCH'>/u);
 assert.match(types,/AssociationEffectResultCode/u);
 assert.match(types,/result_payload:unknown/u);
 assert.doesNotMatch(types,/result_commands/u);
});

test('repository routes ASSOCIATION completion through its dedicated typed RPC on result_payload only',()=>{
 assert.match(repository,/complete_post_response_association_provider_effect_v1/u);
 assert.match(repository,/result\.code==='NO_ASSOCIATION'[\s\S]+p_result_payload:null[\s\S]+result\.commands/u);
 assert.doesNotMatch(repository,/result_commands|complete_post_response_association_effect_v1\b/u);
});

test('dispatcher persists and recovers the durable Association result, preserves durable Intent recovery, and performs no mutation',()=>{
 assert.match(dispatcher,/toDurableAssociationResult/u);assert.match(dispatcher,/recoverAssociationResult/u);
 assert.match(dispatcher,/completeAssociation\(execution\.id,durable\)/u);
 assert.match(dispatcher,/INDETERMINATE'\)return this\.terminal\(execution,'QUARANTINED','INDETERMINATE_EFFECT','ASSOCIATION_RECOVERY'\)/u);
 // Finding 06 stays intact: durable Intent recovery and typed Intent completion, never a local-only intent result.
 assert.match(dispatcher,/recoverDurableIntentProviderResult/u);
 assert.match(dispatcher,/completeIntent\(execution\.id,extracted\)/u);
 assert.doesNotMatch(dispatcher,/let intentResult/u);
 assert.doesNotMatch(dispatcher,/HypothesisUpdateService|apply_hypothesis_evidence_update|attachHypothesisEvidence|createConfidenceEvaluation/u);
});

test('the verifier adversarially proves persistence, atomicity, binding, fail-closed, and the upgrade from canonical 0030',()=>{
 for(const proof of['pre-0031','result_payload exists and result_commands does not','the durable payload is the exact ordered command batch','a rejected result never completes the effect','ASSOCIATION_EVIDENCE_MISMATCH','ASSOCIATION_EVIDENCE_UNAVAILABLE','a terminal execution cannot complete an effect','a second, different result cannot replace the first','ASSOCIATION_RESULT_REQUIRED','INTENT_RESULT_REQUIRED','MEMORY_RESULT_REQUIRED','generic completion parity for','byte-identical','never backfilled'])assert.match(verifier,new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'iu'),`missing proof: ${proof}`);
 assert.doesNotMatch(verifier,/TRUNCATE|DROP TABLE|DELETE FROM/iu);
});
