import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const migration=read('../migrations/0038_information_gap_question_integration_v1.sql'),foundation=read('../migrations/0007_question_information_gap_runtime.sql'),verifier=read('../verify-migration-0038.mjs'),parser=read('../../apps/api/src/post-response-intelligence/information-gap-sync-result.ts'),repository=read('../../apps/api/src/post-response-intelligence/post-response-intelligence.repository.ts'),dispatcher=read('../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts'),packageJson=read('../../package.json'),workflow=read('../../.github/workflows/api-ci.yml');

test('0038 adds exactly the shared creation core, the wrapper, the source table and the sync command',()=>{
 assert.match(migration,/^BEGIN;/mu);assert.match(migration,/COMMIT;\s*$/u);
 // Exactly ONE new table: no second effect ledger, no Question queue, no
 // scheduler state, nothing dropped, truncated or backfilled.
 const tables=[...migration.matchAll(/CREATE TABLE public\.(\w+)/gu)].map(m=>m[1]);
 assert.deepEqual(tables,['information_gap_confidence_sources']);
 assert.doesNotMatch(migration,/ADD COLUMN|CREATE SEQUENCE|TRUNCATE|DROP TABLE|DROP FUNCTION|DELETE FROM|CREATE TRIGGER|UPDATE public\./iu);
 const created=[...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map(m=>m[1]).sort();
 assert.deepEqual(created,['create_information_gap','create_information_gap_core_v1','sync_post_response_information_gaps_v1']);
 // The historical background_%_v1 census (six functions, verify-migration-0021)
 // is deliberately not widened, and no new post-response effect key exists.
 assert.doesNotMatch(migration,/background_[a-z_]+_v1\s*\(\s*p_/iu);
 assert.doesNotMatch(migration,/CREATE (?:OR REPLACE )?FUNCTION public\.background_/iu);
 assert.doesNotMatch(migration,/INFORMATION_GAP_SYNC'|effect_key\s*IN|INSERT INTO public\.post_response_intelligence_effects/iu);
});

test('every explicit identifier 0038 introduces fits the PostgreSQL 63-byte identifier limit',()=>{
 const identifiers=[...migration.matchAll(/\b(?:TABLE|FUNCTION|CONSTRAINT|INDEX|TRIGGER)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gu)].map(m=>m[1]);
 assert.ok(identifiers.length>0,'identifiers were actually scanned');
 const oversized=[...new Set(identifiers)].filter(name=>Buffer.byteLength(name,'utf8')>63);
 assert.deepEqual(oversized,[],`identifiers exceed PostgreSQL's 63-byte limit: ${oversized.join(', ')}`);
});

test('the internal core is explicit-owner, auth-free and inaccessible to every application role',()=>{
 const core=migration.slice(migration.indexOf('create_information_gap_core_v1'),migration.indexOf('-- 2.'));
 assert.match(core,/p_user_id uuid, p_gap jsonb/u);
 assert.match(core,/SECURITY DEFINER SET search_path=''/u);
 assert.doesNotMatch(core,/auth\.uid|request\.jwt|jwt_claims/iu);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.create_information_gap_core_v1\(uuid,jsonb\) FROM PUBLIC,anon,authenticated,service_role/u);
 // Exact 0007 creation semantics live in the core, not a second implementation.
 for(const fingerprint of['Too many hypotheses','Invalid hypothesis target','Invalid confidence target','Inconsistent confidence target','Calibration is not a user gap','information_gap_hypotheses'])assert.match(core,new RegExp(fingerprint,'u'),`core is missing 0007 semantic: ${fingerprint}`);
});

test('the authenticated wrapper keeps the exact 0007 signature and auth.uid ownership, and 0007 itself is untouched',()=>{
 const wrapper=migration.slice(migration.indexOf('-- 2.'),migration.indexOf('-- 3.'));
 assert.match(wrapper,/CREATE OR REPLACE FUNCTION public\.create_information_gap\(p_gap jsonb\) RETURNS SETOF public\.information_gaps/u);
 assert.match(wrapper,/canonical_user uuid := \(SELECT auth\.uid\(\)\)/u);
 assert.match(wrapper,/IF canonical_user IS NULL THEN RETURN; END IF/u);
 assert.match(wrapper,/create_information_gap_core_v1\(canonical_user,p_gap\)/u);
 // Historical migration 0007 remains byte-authoritative for its own chain.
 assert.match(foundation,/CREATE FUNCTION public\.create_information_gap\(p_gap jsonb\)/u);
});

test('the source table is internal, exact-owner, tuple-unique and bounded to the three actionable codes',()=>{
 const table=migration.slice(migration.indexOf('CREATE TABLE public.information_gap_confidence_sources'),migration.indexOf('-- 4.'));
 assert.match(table,/PRIMARY KEY\(user_id,hypothesis_id,target_version,missing_information_code\)/u);
 assert.match(table,/CONSTRAINT information_gap_source_single_gap_binding UNIQUE\(information_gap_id\)/u);
 assert.match(table,/missing_information_code IN\('NO_ELIGIBLE_EVIDENCE','UNVERIFIED_ASSUMPTIONS','COMPETING_HYPOTHESES_UNASSESSED'\)/u);
 assert.match(table,/FOREIGN KEY\(information_gap_id,user_id\) REFERENCES public\.information_gaps\(id,user_id\)/u);
 assert.match(table,/FOREIGN KEY\(hypothesis_id,user_id\) REFERENCES public\.hypotheses\(id,user_id\)/u);
 assert.match(table,/FOREIGN KEY\(confidence_evaluation_id,user_id\) REFERENCES public\.confidence_evaluations\(id,user_id\)/u);
 assert.match(table,/ENABLE ROW LEVEL SECURITY/u);
 assert.match(table,/REVOKE ALL ON TABLE public\.information_gap_confidence_sources FROM PUBLIC,anon,authenticated,service_role/u);
 // Durable identities and a timestamp only: no content columns of any kind.
 assert.doesNotMatch(table,/text NOT NULL CHECK\(length|content|transcript|payload|reasoning|diagnosis|personality/iu);
});

test('the sync command is service-role-only, execution-scoped, validate-first and calibration-excluding',()=>{
 const sync=migration.slice(migration.indexOf('CREATE FUNCTION public.sync_post_response_information_gaps_v1'));
 assert.match(sync,/\(p_execution_id uuid\)/u,'the command accepts ONLY the execution identity');
 assert.doesNotMatch(sync,/auth\.uid|request\.jwt|jwt_claims/iu);
 assert.match(sync,/post_response_hypothesis_update_batch_result_valid_v1/u,'Source A reuses the canonical durable receipt validator');
 assert.match(sync,/post_response_confidence_batch_result_valid_v1/u,'Source B reuses the canonical durable receipt validator');
 assert.match(sync,/confidenceStatus'='EVALUATED'/u,'only EVALUATED update receipts are consumable');
 assert.match(sync,/CONTINUE WHEN code='CONFIDENCE_MODEL_UNCALIBRATED'/u,'the calibration-only code is filtered, never materialized');
 assert.match(sync,/pg_advisory_xact_lock/u,'the exact-source race is serialized in the database');
 assert.match(sync,/SOURCE_INTEGRITY_FAILURE/u);
 assert.match(sync,/>27/u,'the bounded 27-tuple contract is enforced fail-closed');
 for(const text of['Eligible evidence for the current Hypothesis version is missing\\.','One or more assumptions in the current Hypothesis remain unverified\\.','Competing Hypotheses remain unassessed in the current Confidence snapshot\\.'])assert.match(sync,new RegExp(text,'u'),'exact controlled gap text');
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.sync_post_response_information_gaps_v1\(uuid\) FROM PUBLIC,anon,authenticated/u);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.sync_post_response_information_gaps_v1\(uuid\) TO service_role/u);
 // No Question Candidate is ever produced by the integration.
 assert.doesNotMatch(sync,/question_candidates|create_validated_question_candidate/iu);
 assert.doesNotMatch(migration,/\bRANKED\b|\bSELECTED\b|\bASKED\b|\bANSWERED\b|\bDECLINED\b|FOLLOW_UP_STATE|information_gain|utility/u);
});

test('the application boundary is one narrow typed repository call routed by the dispatcher at both stages',()=>{
 assert.match(parser,/NO_INFORMATION_GAPS/u);assert.match(parser,/INFORMATION_GAPS_AVAILABLE/u);assert.match(parser,/SOURCE_INTEGRITY_FAILURE/u);
 assert.match(parser,/MAX_INFORMATION_GAP_SYNC_GAPS = 27/u);
 assert.match(repository,/rpc\/sync_post_response_information_gaps_v1/u);
 assert.match(repository,/p_execution_id:id/u);
 assert.match(repository,/parseInformationGapSyncResult/u,'the repository never trusts HTTP 2xx alone');
 assert.match(dispatcher,/INFORMATION_GAP_SYNC/u);
 assert.match(dispatcher,/syncInformationGaps/u);
 // The frozen Question Candidate boundary stays frozen: the dispatcher never
 // touches the Question runtime.
 assert.doesNotMatch(dispatcher,/QuestionService|generateValidated|question_candidates|QuestionCandidateGenerator/u);
});

test('the 0038 verifier is wired into the toolchain and CI without weakening the standalone Question verifier',()=>{
 assert.match(verifier,/sync_post_response_information_gaps_v1/u);
 assert.match(packageJson,/"verify:information-gap-question-integration:integration": "node --env-file-if-exists=\.env database\/verify-migration-0038\.mjs"/u);
 assert.match(workflow,/run: npm run verify:information-gap-question-integration:integration/u);
 assert.match(workflow,/run: npm run verify:question:integration/u,'the standalone Question Runtime verifier remains wired');
});
