import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const sql=read('../migrations/0037_background_him_runtime_consumption_v1.sql'),foundation=read('../migrations/0018_him_intelligence_snapshot_foundation_v1.sql'),verifier=read('../verify-migration-0037.mjs'),dataApi=read('../../apps/api/src/background-intelligence/background-intelligence-data-api.service.ts'),enrichment=read('../../apps/api/src/background-intelligence/background-intelligence-enrichment.service.ts'),dispatcher=read('../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts'),packageJson=read('../../package.json'),workflow=read('../../.github/workflows/api-ci.yml');
test('0037 adds exactly one internal explicit-identity core, one authenticated wrapper, and one session-only service-role wrapper',()=>{
 assert.match(sql,/CREATE FUNCTION public\.read_him_intelligence_snapshot_core_v1\(p_user_id uuid,p_context_kind text,p_context_id text\)/u);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.read_him_intelligence_snapshot_v1\(p_context_kind text,p_context_id text\)/u);
 assert.match(sql,/CREATE FUNCTION public\.background_read_him_conversation_snapshot_v1\(p_user_id uuid,p_session_id uuid\)/u);
 assert.equal((sql.match(/CREATE (?:OR REPLACE )?FUNCTION/gu)??[]).length,3,'exactly three function definitions');
 assert.doesNotMatch(sql,/CREATE TABLE|ALTER TABLE|INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE|CREATE INDEX|CREATE TRIGGER|pg_advisory/iu);
});
test('the core carries the exact frozen 0018 slot matrix and integrity joins with an explicit trusted identity and no auth.uid()',()=>{
 const core=sql.slice(sql.indexOf('CREATE FUNCTION public.read_him_intelligence_snapshot_core_v1'),sql.indexOf('CREATE OR REPLACE FUNCTION'));
 assert.match(core,/u uuid:=p_user_id/u);
 assert.doesNotMatch(core,/auth\.uid/iu);
 for(const slot of["(1,'hse.stress',1,'CONVERSATION_SESSION')","(2,'hse.energy',1,'CONVERSATION_SESSION')","(5,'hse.attention',1,'CONVERSATION_SESSION')","(1,'hse.stress',1,'SITUATION')","(3,'hse.motivation',1,'GOAL')"])assert.match(core,new RegExp(slot.replace(/[().]/g,'\\$&')));
 for(const invariant of['configured<>expected',"m\\.lifecycle='CALIBRATED' AND m\\.environment='PRODUCTION'","sc\\.allowed_codes=ARRAY\\[1,2,3,4,5\\]","HIM Intelligence Snapshot active binding integrity failure","Unknown or unowned HIM Intelligence Snapshot context","Unsupported HIM Intelligence Snapshot context",'statement_timestamp\\(\\)','ORDER BY me\\.created_at DESC,me\\.id DESC LIMIT 1','him_current_structured_measurements'])assert.match(core,new RegExp(invariant));
 // The canonical source semantics are the 0018 semantics: the load-bearing body fragments are byte-identical.
 for(const fragment of foundation.match(/LEFT JOIN LATERAL[^\n]+/gu)??[])assert.ok(core.includes(fragment.trim()),'core reuses the exact 0018 latest-event/correction lateral semantics');
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.read_him_intelligence_snapshot_core_v1\(uuid,text,text\) FROM PUBLIC,anon,authenticated,service_role/u);
});
test('the authenticated wrapper preserves the exact public surface and the background wrapper is CONVERSATION_SESSION-only and JWT-free',()=>{
 const wrapper=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION'),sql.indexOf('CREATE FUNCTION public.background_read_him_conversation_snapshot_v1'));
 assert.match(wrapper,/u uuid:=auth\.uid\(\)/u);
 assert.match(wrapper,/Authentication required/u);
 assert.match(wrapper,/read_him_intelligence_snapshot_core_v1\(u,p_context_kind,p_context_id\)/u);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.read_him_intelligence_snapshot_v1\(text,text\) FROM PUBLIC,anon,service_role/u);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.read_him_intelligence_snapshot_v1\(text,text\) TO authenticated/u);
 const backgroundWrapper=sql.slice(sql.indexOf('CREATE FUNCTION public.background_read_him_conversation_snapshot_v1'));
 assert.match(backgroundWrapper,/read_him_intelligence_snapshot_core_v1\(p_user_id,'CONVERSATION_SESSION',p_session_id::text\)/u);
 assert.doesNotMatch(backgroundWrapper,/auth\.uid|request\.jwt|set_config|SITUATION|DECISION|GOAL/u);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.background_read_him_conversation_snapshot_v1\(uuid,uuid\) FROM PUBLIC,anon,authenticated/u);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.background_read_him_conversation_snapshot_v1\(uuid,uuid\) TO service_role/u);
});
test('the application background path uses only the narrow wrapper before the Candidate claim and never a direct HIM table read or JWT',()=>{
 assert.match(dataApi,/rpc\/background_read_him_conversation_snapshot_v1/u);
 assert.match(dataApi,/p_user_id:context\.userId,p_session_id:context\.sessionId/u);
 assert.doesNotMatch(dataApi,/him_metric_snapshots|him_measurement_observations|him_measurement_events|him_current_structured_measurements\?|read_him_intelligence_snapshot_v1/u);
 assert.match(enrichment,/readHimHypothesisGenerationContext/u);
 assert.match(enrichment,/projectHimIntelligenceSnapshot\('CONVERSATION_SESSION',context\.sessionId,rows\)/u);
 assert.match(enrichment,/himReasoning\.transform/u);
 const fresh=dispatcher.slice(dispatcher.indexOf("completed.has('HYPOTHESIS_PERSISTENCE'))return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_PERSISTENCE_RECOVERY')"));
 assert.ok(fresh.indexOf('readHimHypothesisGenerationContext')<fresh.indexOf("claim(execution.id,'CANDIDATE_PROVIDER')"),'HIM is read BEFORE the Candidate effect claim');
 assert.match(dispatcher,/catch\{return false;\}/u);
});
test('the verifier and CI wire the 0037 gate after the HIM snapshot verifier and before the background gates',()=>{
 assert.match(verifier,/background_read_him_conversation_snapshot_v1/u);
 assert.match(verifier,/ROLLBACK/u);
 assert.doesNotMatch(verifier,/TRUNCATE/iu);
 assert.match(packageJson,/"verify:background-him-runtime-consumption:integration": "node --env-file-if-exists=\.env database\/verify-migration-0037\.mjs"/u);
 const step=workflow.indexOf('run: npm run verify:background-him-runtime-consumption:integration');
 assert.notEqual(step,-1,'CI runs the 0037 verifier');
 assert.ok(step>workflow.indexOf('run: npm run verify:him-snapshot:integration'),'0037 verifier runs after the HIM snapshot verifier');
 assert.ok(step<workflow.indexOf('run: npm run verify:background-intelligence-adapters:integration'),'0037 verifier runs before the background runtime gates');
 assert.ok(step<workflow.indexOf('run: npm run verify:a2-e2e-runtime-smoke'),'0037 verifier runs before the A2 E2E smoke');
});
