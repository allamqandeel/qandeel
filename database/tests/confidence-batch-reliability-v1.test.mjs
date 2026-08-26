import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const migration=read('../migrations/0035_confidence_batch_reliability_v1.sql'),verifier=read('../verify-migration-0035.mjs'),module=read('../../apps/api/src/post-response-intelligence/durable-confidence-batch-result.ts'),types=read('../../apps/api/src/post-response-intelligence/post-response-intelligence.types.ts'),repository=read('../../apps/api/src/post-response-intelligence/post-response-intelligence.repository.ts'),dispatcher=read('../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts'),packageJson=read('../../package.json'),workflow=read('../../.github/workflows/api-ci.yml');

test('0035 adds exactly the bounded child work table, the validator and the managed command',()=>{
 assert.match(migration,/^BEGIN;/mu);assert.match(migration,/COMMIT;\s*$/u);
 // Exactly ONE new table: no second orchestration ledger, no queue, no column
 // added to an existing table, and nothing dropped or truncated.
 const tables=[...migration.matchAll(/CREATE TABLE public\.(\w+)/gu)].map(m=>m[1]);
 assert.deepEqual(tables,['post_response_confidence_batch_items']);
 assert.doesNotMatch(migration,/ADD COLUMN|CREATE SEQUENCE|TRUNCATE|DROP TABLE|DELETE FROM|CREATE TRIGGER/iu);
 const created=[...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map(m=>m[1]).sort();
 assert.deepEqual(created,['claim_post_response_intelligence_effect_v1','complete_post_response_intelligence_effect_v1','execute_post_response_confidence_batch_v1','post_response_confidence_batch_result_valid_v1']);
 // No dynamic per-target effect key was invented.
 assert.doesNotMatch(migration,/CONFIDENCE_TARGET_\d/u);
 for(const proof of['NO_CONFIDENCE_TARGETS','CONFIDENCE_BATCH_EVALUATED','CONFIDENCE_BATCH_MANAGED','CONFIDENCE_BATCH_COMMAND_REQUIRED'])assert.match(migration,new RegExp(proof,'u'));
});

test('the child item table is bounded, exact and service-internal',()=>{
 const table=migration.slice(migration.indexOf('CREATE TABLE public.post_response_confidence_batch_items'),migration.indexOf('ALTER TABLE public.post_response_confidence_batch_items OWNER TO postgres'));
 assert.match(table,/execution_id uuid NOT NULL REFERENCES public\.post_response_intelligence_executions\(id\) ON DELETE RESTRICT/u);
 assert.match(table,/ordinal smallint NOT NULL CHECK\(ordinal BETWEEN 1 AND 5\)/u);
 assert.match(table,/hypothesis_id uuid NOT NULL/u);
 assert.match(table,/target_version integer NOT NULL CHECK\(target_version>0\)/u);
 assert.match(table,/confidence_evaluation_id uuid NOT NULL UNIQUE/u);
 assert.match(table,/state text NOT NULL CHECK\(state IN\('PENDING','RETRY_PENDING','EVALUATED','QUARANTINED'\)\)/u);
 assert.match(table,/failure_code IN\('CONFIDENCE_ATTEMPT_FAILED','TARGET_UNAVAILABLE','TARGET_VERSION_DRIFT','EVALUATION_ID_CONFLICT','RESULT_INTEGRITY_FAILURE'\)/u);
 assert.match(table,/PRIMARY KEY\(execution_id,ordinal\)/u);
 assert.match(table,/UNIQUE\(execution_id,hypothesis_id\)/u);
 assert.match(table,/CHECK\(\(state IN\('PENDING','EVALUATED'\)\)=\(failure_code IS NULL\)\)/u);
 // No content, no free text, no provider payload and no attempt counter.
 assert.doesNotMatch(table,/text\[\]|jsonb|content|statement|payload|error|message|attempt_count/iu);
 assert.match(migration,/ALTER TABLE public\.post_response_confidence_batch_items ENABLE ROW LEVEL SECURITY/u);
 assert.match(migration,/REVOKE ALL ON TABLE public\.post_response_confidence_batch_items FROM PUBLIC,anon,authenticated,service_role/u);
 assert.doesNotMatch(migration,/GRANT (?:INSERT|UPDATE|DELETE|ALL)[\s\S]*post_response_confidence_batch_items/u);
});

test('the receipt validator is IMMUTABLE, internal-only and reads no table',()=>{
 assert.match(migration,/CREATE FUNCTION public\.post_response_confidence_batch_result_valid_v1\(p_value jsonb\)[\s\S]*?LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path=''/u);
 assert.match(migration,/ALTER FUNCTION public\.post_response_confidence_batch_result_valid_v1\(jsonb\) OWNER TO postgres/u);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.post_response_confidence_batch_result_valid_v1\(jsonb\) FROM PUBLIC,anon,authenticated,service_role/u);
 const body=migration.slice(migration.indexOf('CREATE FUNCTION public.post_response_confidence_batch_result_valid_v1'),migration.indexOf('ALTER FUNCTION public.post_response_confidence_batch_result_valid_v1'));
 assert.doesNotMatch(body,/FROM public\.|JOIN public\./u);
 assert.match(body,/ARRAY\['confidenceEvaluationId','hypothesisId','ordinal','targetVersion'\]/u);
 assert.match(body,/jsonb_array_length\(p_value\) NOT BETWEEN 1 AND 5/u);
 assert.match(body,/IF p_value IS NULL/u);
});

test('the result domain minimally evolves: only untyped widens and Confidence states its own domain',()=>{
 assert.match(migration,/DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check/u);
 assert.match(migration,/ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK \(\s*effect_key IN \('MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER','CANDIDATE_PROVIDER','HYPOTHESIS_PERSISTENCE','HYPOTHESIS_UPDATE_BATCH','CONFIDENCE_BATCH'\)/u);
 assert.match(migration,/ADD CONSTRAINT post_response_intelligence_effects_confidence_batch_result_check CHECK/u);
 assert.doesNotMatch(migration,/DROP CONSTRAINT post_response_intelligence_effects_(?:claimed|memory|intent|association|candidate|persistence|update_batch)_result_check/u);
 // A legacy pre-0035 all-null row stays representable and is never rewritten.
 assert.match(migration,/effect_key<>'CONFIDENCE_BATCH'\s*\n?\s*OR \(result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL\)/u);
 assert.match(migration,/state='COMPLETED' AND result_code='NO_CONFIDENCE_TARGETS' AND result_reference IS NULL AND result_payload IS NULL/u);
 assert.match(migration,/result_code='CONFIDENCE_BATCH_EVALUATED' AND result_reference IS NULL\s*\n?\s*AND result_payload IS NOT NULL AND public\.post_response_confidence_batch_result_valid_v1\(result_payload\)/u);
 assert.doesNotMatch(migration,/result_code='CONFIDENCE_BATCH_PARTIAL'|CONFIDENCE_BATCH_FAILED|CONFIDENCE_BATCH_PENDING_RETRY/u);
});

test('CONFIDENCE_BATCH becomes managed: ordinary claim and generic completion both fail closed',()=>{
 assert.match(migration,/IF p_effect_key='CONFIDENCE_BATCH' THEN RAISE EXCEPTION 'CONFIDENCE_BATCH_MANAGED' USING ERRCODE='22023'/u);
 assert.match(migration,/IF p_effect_key='CONFIDENCE_BATCH' THEN RAISE EXCEPTION 'CONFIDENCE_BATCH_COMMAND_REQUIRED' USING ERRCODE='22023'/u);
 // Every earlier error contract is preserved verbatim.
 for(const[key,message]of[['HYPOTHESIS_UPDATE_BATCH','HYPOTHESIS_UPDATE_BATCH_MANAGED']])assert.match(migration,new RegExp(`IF p_effect_key='${key}' THEN RAISE EXCEPTION '${message}'`,'u'));
 for(const[key,message]of[['MEMORY_WRITE','MEMORY_RESULT_REQUIRED'],['INTENT_PROVIDER','INTENT_RESULT_REQUIRED'],['ASSOCIATION_PROVIDER','ASSOCIATION_RESULT_REQUIRED'],['CANDIDATE_PROVIDER','CANDIDATE_RESULT_REQUIRED'],['HYPOTHESIS_PERSISTENCE','HYPOTHESIS_PERSISTENCE_COMMAND_REQUIRED'],['HYPOTHESIS_UPDATE_BATCH','HYPOTHESIS_UPDATE_BATCH_COMMAND_REQUIRED']])assert.match(migration,new RegExp(`IF p_effect_key='${key}' THEN RAISE EXCEPTION '${message}'`,'u'));
});

test('the managed command derives every authority from the execution and the durable persistence result',()=>{
 assert.match(migration,/CREATE FUNCTION public\.execute_post_response_confidence_batch_v1\(p_execution_id uuid\)\s*\nRETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''/u);
 const command=migration.slice(migration.indexOf('CREATE FUNCTION public.execute_post_response_confidence_batch_v1'),migration.indexOf('ALTER FUNCTION public.execute_post_response_confidence_batch_v1'));
 // The application supplies ONLY the execution identity.
 assert.doesNotMatch(command,/p_user_id|p_session_id|p_hypothesis|p_target|p_evaluation|p_token|auth\.uid|request\.jwt|set_config/u);
 assert.match(command,/FROM public\.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE/u);
 assert.match(command,/effect_key='HYPOTHESIS_PERSISTENCE' AND state='COMPLETED'/u);
 assert.match(command,/post_response_persisted_hypothesis_ids_valid_v1/u);
 assert.match(command,/CONFIDENCE_PERSISTENCE_UNAVAILABLE/u);
 // Deterministic UUID-order target pre-lock bound to the execution owner, and
 // the exact current version frozen once at first initialization.
 assert.match(command,/WHERE h\.user_id=execution_row\.user_id/u);
 assert.match(command,/ORDER BY h\.id ASC\s*\n?\s*FOR UPDATE/u);
 assert.match(command,/pg_catalog\.gen_random_uuid\(\)/u);
 assert.match(command,/SELECT p_execution_id,entry\.ordinality::smallint,generated\.id,generated\.version/u);
 // Canonical Confidence creation is reused, never duplicated.
 assert.match(command,/background_create_confidence_evaluation_v1/u);
 assert.doesNotMatch(command,/INSERT INTO public\.confidence_evaluations/u);
 assert.doesNotMatch(command,/canonical_eligible_memory_ids_v1|policy_version|missing_information_codes/u);
 assert.match(command,/QANDEEL_CONFIDENCE_RUNTIME/u);
 // Only unfinished items are evaluated, each isolated in its own sub-block.
 assert.match(command,/state<>'EVALUATED' ORDER BY ordinal FOR UPDATE/u);
 assert.match(command,/WHEN unique_violation THEN/u);
 assert.match(command,/WHEN OTHERS THEN/u);
 assert.match(command,/attempt_state := 'RETRY_PENDING'; attempt_failure := 'CONFIDENCE_ATTEMPT_FAILED'/u);
 assert.match(command,/attempt_state := 'QUARANTINED'; attempt_failure := 'TARGET_VERSION_DRIFT'/u);
 // No exception text, stack trace or provider payload is ever persisted.
 assert.doesNotMatch(command,/SQLERRM|PG_EXCEPTION_CONTEXT|GET STACKED DIAGNOSTICS/u);
 // The typed completion happens only when nothing is unfinished.
 assert.match(command,/IF blocked_total>0 THEN RETURN 'QUARANTINED';END IF;/u);
 assert.match(command,/IF retry_total>0 THEN RETURN 'RETRY_PENDING';END IF;/u);
 assert.match(command,/'CONFIDENCE_BATCH_EVALUATED',receipts\);/u);
 assert.match(command,/'NO_CONFIDENCE_TARGETS'\);/u);
});

test('the managed command is service-role-only with a hardened definer posture',()=>{
 assert.match(migration,/ALTER FUNCTION public\.execute_post_response_confidence_batch_v1\(uuid\) OWNER TO postgres/u);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.execute_post_response_confidence_batch_v1\(uuid\) FROM PUBLIC,anon,authenticated/u);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.execute_post_response_confidence_batch_v1\(uuid\) TO service_role/u);
 // No direct DML authority is widened anywhere.
 assert.doesNotMatch(migration,/GRANT (?:INSERT|UPDATE|DELETE|ALL)[^\n]*ON TABLE/u);
});

test('the pure recovery module is deterministic and never reads current state',()=>{
 assert.match(module,/export function recoverConfidenceBatchResult/u);
 assert.match(module,/status: 'INDETERMINATE'/u);
 assert.match(module,/persistedHypothesisIds\[index\]/u);
 assert.match(module,/RECEIPT_KEYS = \['ordinal', 'hypothesisId', 'targetVersion', 'confidenceEvaluationId'\]/u);
 assert.doesNotMatch(module,/fetch\(|randomUUID|BackgroundIntelligence|evaluateHypothesisConfidence|findHypothesis|version\b.*current/u);
});

test('the effect types make CONFIDENCE_BATCH managed and remove the last generic effect',()=>{
 assert.match(types,/ManagedIntelligenceEffect='HYPOTHESIS_UPDATE_BATCH'\|'CONFIDENCE_BATCH'/u);
 assert.match(types,/ClaimableIntelligenceEffect=Exclude<IntelligenceEffect,ManagedIntelligenceEffect>/u);
 assert.match(types,/CONFIDENCE_BATCH_COMMAND_STATUSES=\['COMPLETED','RETRY_PENDING','QUARANTINED','NO_OP'\]/u);
 assert.doesNotMatch(types,/GenericIntelligenceEffect/u);
 assert.doesNotMatch(repository,/GenericIntelligenceEffect|complete_post_response_intelligence_effect_v1/u);
 assert.match(repository,/executeConfidenceBatch\(id:string\):Promise<ConfidenceBatchCommandStatus>/u);
 const method=repository.split('\n').find(line=>line.includes('async executeConfidenceBatch'));
 assert.doesNotMatch(method,/userId|sessionId|hypothesis|target|evidence|token|jwt/iu);
});

test('the dispatcher runs the managed batch only, with the mandatory post-persistence resume path',()=>{
 assert.match(dispatcher,/recoverConfidenceBatchResult/u);
 assert.match(dispatcher,/this\.ledger\.executeConfidenceBatch\(execution\.id\)/u);
 // The swallowing per-target application loop is gone for good.
 assert.doesNotMatch(dispatcher,/evaluateHypothesisConfidence/u);
 assert.doesNotMatch(dispatcher,/GenericIntelligenceEffect|this\.ledger\.complete\(/u);
 assert.match(dispatcher,/if\(status==='RETRY_PENDING'\)return false;/u);
 assert.match(dispatcher,/if\(status==='QUARANTINED'\)return this\.terminal\(execution,'QUARANTINED','INDETERMINATE_EFFECT','CONFIDENCE_BATCH'\);/u);
 assert.match(dispatcher,/if\(completed\.has\('HYPOTHESIS_PERSISTENCE'\)\)return this\.resumeGenerationConfidence\(execution,effects\);/u);
 const resume=dispatcher.slice(dispatcher.indexOf('private async resumeGenerationConfidence'),dispatcher.indexOf('private async confidenceBatch'));
 // The resume path reads durable state only: no provider, no write, no
 // eligibility recomputation and no Hypothesis read.
 assert.doesNotMatch(resume,/enrichment\.|association\.|extraction\.|assembler\.|claim\(|persistHypothesisGeneration|executeHypothesisUpdateBatch|completeMemory/u);
 for(const recovery of['recoverDurableIntentProviderResult','recoverCandidateProviderResult','recoverHypothesisPersistenceResult'])assert.match(resume,new RegExp(recovery,'u'));
 // The resume check sits after the canonical source-turn/routing reread.
 assert.ok(dispatcher.indexOf("readCanonicalSourceTurn")<dispatcher.indexOf("if(completed.has('HYPOTHESIS_PERSISTENCE'))return this.resumeGenerationConfidence"));
});

test('the QAN-AUD-06 verifier is wired into CI after the 0034 verifier and proves the audit invariants',()=>{
 assert.match(packageJson,/"verify:confidence-batch-reliability:integration": "node --env-file-if-exists=\.env database\/verify-migration-0035\.mjs"/u);
 assert.match(workflow,/run: npm run verify:confidence-batch-reliability:integration/u);
 assert.ok(workflow.indexOf('npm run verify:confidence-batch-reliability:integration')>workflow.indexOf('npm run verify:hypothesis-update-auto-invocation:integration'));
 assert.ok(workflow.indexOf('npm run verify:confidence-batch-reliability:integration')<workflow.indexOf('npm run verify:post-response-dispatch:integration'));
 for(const proof of['NO_CONFIDENCE_TARGETS','CONFIDENCE_BATCH_EVALUATED','TARGET_VERSION_DRIFT','RETRY_PENDING','EVALUATION_ID_CONFLICT','CONFIDENCE_BATCH_MANAGED','CONFIDENCE_BATCH_COMMAND_REQUIRED','byte-identical'])assert.match(verifier,new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'u'),`missing proof: ${proof}`);
 assert.doesNotMatch(verifier,/ANTHROPIC|OPENAI|GEMINI|API_KEY/u);
});
