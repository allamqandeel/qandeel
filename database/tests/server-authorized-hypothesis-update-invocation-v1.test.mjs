import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const migration=read('../migrations/0032_server_authorized_hypothesis_update_invocation_v1.sql'),verifier=read('../verify-migration-0032.mjs'),policy=read('../../apps/api/src/hypothesis/hypothesis-update.policy.ts'),updateService=read('../../apps/api/src/hypothesis/hypothesis-update.service.ts'),dataApi=read('../../apps/api/src/background-intelligence/background-intelligence-data-api.service.ts'),enrichment=read('../../apps/api/src/background-intelligence/background-intelligence-enrichment.service.ts'),dispatcher=read('../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts'),migration0008=read('../migrations/0008_hypothesis_update_loop.sql'),migration0028=read('../migrations/0028_canonical_evidence_eligibility_v1.sql');

const section=(source,start,end)=>{const from=source.indexOf(start);assert.notEqual(from,-1,`missing ${start}`);const to=end?source.indexOf(end,from):source.length;return source.slice(from,to===-1?source.length:to);};

test('0032 is forward-only and creates exactly the three-function invocation architecture',()=>{
 assert.match(migration,/^BEGIN;/mu);assert.match(migration,/COMMIT;\s*$/u);
 const created=[...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map(m=>m[1]).sort();
 assert.deepEqual(created,['apply_hypothesis_evidence_update','apply_hypothesis_evidence_update_core_v1','background_apply_hypothesis_evidence_update_v1']);
 // No table, ledger, effect key, endpoint, or data rewrite of any kind.
 assert.doesNotMatch(migration,/CREATE TABLE|ALTER TABLE|ADD COLUMN|DROP TABLE|TRUNCATE|CREATE POLICY|DROP POLICY/iu);
 assert.doesNotMatch(migration,/GRANT[^;]*ON TABLE|REVOKE[^;]*ON TABLE/iu);
 const outsideBodies=migration.replace(/\$\$[\s\S]*?\$\$/gu,'<<body>>');
 assert.doesNotMatch(outsideBodies,/\b(?:UPDATE|INSERT INTO|DELETE FROM)\s+public\./iu,'no data statement outside the function bodies');
});

test('the internal core holds the one canonical mutation algorithm with no client-facing authority',()=>{
 const core=section(migration,'CREATE FUNCTION public.apply_hypothesis_evidence_update_core_v1','-- 2.');
 assert.match(core,/p_user_id uuid,\s*\n\s*p_update_id uuid,\s*\n\s*p_hypothesis_id uuid,\s*\n\s*p_expected_version integer,\s*\n\s*p_evidence_id text,\s*\n\s*p_evidence_role text/u);
 assert.match(core,/RETURNS TABLE\(update jsonb, hypothesis jsonb\)/u);
 assert.doesNotMatch(core,/SECURITY DEFINER/u,'the core is deliberately not a definer');
 assert.match(core,/SET search_path=''/u);
 assert.doesNotMatch(core,/auth\.uid|set_config|request\.jwt/u);
 for(const invariant of["ERRCODE='40001'","canonical_eligible_memory_ids_v1","Evidence is already attached\\.","'SUPPORTING','CONTRADICTING'",'version=version\\+1','FOR UPDATE','QANDEEL_HYPOTHESIS_UPDATE_LOOP','INSERT INTO public\\.hypothesis_updates'])assert.match(core,new RegExp(invariant,'u'),`core invariant ${invariant}`);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.apply_hypothesis_evidence_update_core_v1\(uuid,uuid,uuid,integer,text,text\) FROM PUBLIC,anon,authenticated,service_role/u);
 assert.match(migration,/ALTER FUNCTION public\.apply_hypothesis_evidence_update_core_v1\(uuid,uuid,uuid,integer,text,text\) OWNER TO postgres/u);
 assert.doesNotMatch(migration,/GRANT EXECUTE ON FUNCTION public\.apply_hypothesis_evidence_update_core_v1/u,'the core is granted to nobody');
});

test('the authenticated wrapper keeps its exact signature, auth derivation, and no second mutation copy',()=>{
 const wrapper=section(migration,'CREATE OR REPLACE FUNCTION public.apply_hypothesis_evidence_update(','-- 3.');
 assert.match(wrapper,/p_update_id uuid,\s*\n\s*p_hypothesis_id uuid,\s*\n\s*p_expected_version integer,\s*\n\s*p_evidence_id text,\s*\n\s*p_evidence_role text/u);
 assert.doesNotMatch(wrapper,/p_user_id/u,'clients never send a userId');
 assert.match(wrapper,/SECURITY DEFINER SET search_path=''/u);
 assert.match(wrapper,/auth\.uid\(\)/u);
 assert.match(wrapper,/Authentication required\.' USING ERRCODE='42501'/u);
 assert.match(wrapper,/apply_hypothesis_evidence_update_core_v1\(/u);
 assert.doesNotMatch(wrapper,/INSERT INTO public\.hypothesis_updates|UPDATE public\.hypotheses|canonical_eligible_memory_ids_v1/u,'the wrapper is thin');
});

test('the background wrapper is service-role-only, session-scope-bound, and reconstructs no JWT',()=>{
 const background=section(migration,'CREATE FUNCTION public.background_apply_hypothesis_evidence_update_v1','-- 4.');
 assert.match(background,/p_user_id uuid,\s*\n\s*p_session_id uuid,\s*\n\s*p_update_id uuid,\s*\n\s*p_hypothesis_id uuid,\s*\n\s*p_expected_version integer,\s*\n\s*p_evidence_id text,\s*\n\s*p_evidence_role text/u);
 assert.match(background,/SECURITY DEFINER SET search_path=''/u);
 assert.match(background,/h\.id=p_hypothesis_id AND h\.user_id=p_user_id/u);
 assert.match(background,/h\.scope='CONVERSATION_SESSION:'\|\|p_session_id::text/u);
 assert.match(background,/apply_hypothesis_evidence_update_core_v1\(/u);
 assert.doesNotMatch(background,/auth\.uid|set_config|request\.jwt|jwt\.claims|conversation_sessions/u);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.background_apply_hypothesis_evidence_update_v1\(uuid,uuid,uuid,uuid,integer,text,text\) FROM PUBLIC,anon,authenticated/u);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.background_apply_hypothesis_evidence_update_v1\(uuid,uuid,uuid,uuid,integer,text,text\) TO service_role/u);
 assert.match(migration,/ALTER FUNCTION public\.background_apply_hypothesis_evidence_update_v1\(uuid,uuid,uuid,uuid,integer,text,text\) OWNER TO postgres/u);
});

test('historical migrations 0008 and 0028 are untouched',()=>{
 assert.match(migration0008,/CREATE FUNCTION public\.apply_hypothesis_evidence_update\(/u);
 assert.match(migration0028,/CREATE OR REPLACE FUNCTION public\.apply_hypothesis_evidence_update\(/u);
 assert.doesNotMatch(migration0008,/core_v1|background_apply_hypothesis_evidence_update/u);
 assert.doesNotMatch(migration0028,/core_v1|background_apply_hypothesis_evidence_update/u);
});

test('foreground and background share the one TypeScript request validator',()=>{
 assert.match(policy,/export function validateHypothesisUpdateRequest/u);
 assert.match(policy,/Malformed hypothesis update identifiers\./u);
 assert.match(policy,/Expected version must be a positive integer\./u);
 assert.match(policy,/Invalid evidence role\./u);
 assert.match(updateService,/validateHypothesisUpdateRequest\(request\)/u);
 assert.doesNotMatch(updateService,/private validate\(/u,'the private copy is gone');
 assert.match(enrichment,/validateHypothesisUpdateRequest\(request\)/u);
});

test('the background Data API method derives identity from the issued context only',()=>{
 const method=section(dataApi,'async applyHypothesisUpdate','async createConfidenceEvaluation');
 assert.match(method,/assertExecutionContext\(context\)/u);
 assert.match(method,/rpc\/background_apply_hypothesis_evidence_update_v1/u);
 assert.match(method,/p_user_id:context\.userId/u);
 assert.match(method,/p_session_id:context\.sessionId/u);
 assert.match(method,/p_update_id:updateId/u);
 assert.doesNotMatch(method,/token|jwt|Authorization|auth\.uid/iu,'no access token or user JWT exists on this path');
});

test('the invocation boundary validates, generates the update UUID, verifies the tuple, and keeps the Confidence contract',()=>{
 const boundary=section(enrichment,'async applyAuthorizedHypothesisUpdate','private assert');
 assert.match(boundary,/this\.assert\(context\)/u);
 assert.match(boundary,/validateHypothesisUpdateRequest\(request\)/u);
 assert.match(boundary,/randomUUID\(\)/u);
 assert.match(boundary,/Hypothesis update target not found\./u);
 assert.match(boundary,/BACKGROUND_HYPOTHESIS_UPDATE_INTEGRITY/u);
 assert.match(boundary,/confidenceStatus:'EVALUATED'/u);
 assert.match(boundary,/confidenceStatus:'PENDING_RETRY',confidenceEvaluation:null/u);
 const integrity=section(enrichment,'function canonicalBackgroundMutation');
 for(const check of['update\\.id===updateId','update\\.user_id===userId','update\\.before_version===request\\.expectedVersion','update\\.after_version===request\\.expectedVersion\\+1','hypothesis\\.version===update\\.after_version','update\\.source===HYPOTHESIS_UPDATE_SOURCE'])assert.match(integrity,new RegExp(check,'u'),`integrity check ${check}`);
});

test('the dispatcher never invokes the update boundary and no automatic command loop exists',()=>{
 assert.doesNotMatch(dispatcher,/applyAuthorizedHypothesisUpdate|applyHypothesisUpdate|background_apply_hypothesis_evidence_update|HypothesisUpdateService|apply_hypothesis_evidence_update/u);
 // A2.3a recovery still mutates nothing and no new mutation effect key exists.
 assert.match(dispatcher,/recoverAssociationResult/u);
 assert.doesNotMatch(dispatcher,/HYPOTHESIS_UPDATE|MUTATION_/u);
});

test('the real PostgreSQL verifier proves the full A2.3b contract adversarially',()=>{
 for(const proof of['empty JWT claims','the core derives no client authority','reconstructs no JWT and reads no request claim','cross-session','40001','canonical_eligible_memory_ids_v1','Already-attached Evidence','audit failure rolls back the Hypothesis mutation','QANDEEL_HYPOTHESIS_UPDATE_LOOP','byte-identical','to_regprocedure'])assert.match(verifier,new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'iu'),`missing proof: ${proof}`);
 assert.doesNotMatch(verifier,/TRUNCATE|DROP TABLE|DELETE FROM/iu);
});
