import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const verifier=read('../verify-exact-version-confidence.mjs'),confidenceService=read('../../apps/api/src/hypothesis/confidence.service.ts'),updateService=read('../../apps/api/src/hypothesis/hypothesis-update.service.ts'),policy=read('../../apps/api/src/hypothesis/hypothesis-update.policy.ts'),enrichment=read('../../apps/api/src/background-intelligence/background-intelligence-enrichment.service.ts'),dispatcher=read('../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts'),workflow=read('../../.github/workflows/api-ci.yml'),packageJson=read('../../package.json');
const section=(source,start,end)=>{const from=source.indexOf(start);assert.notEqual(from,-1,`missing ${start}`);const to=end?source.indexOf(end,from):source.length;return source.slice(from,to===-1?source.length:to);};

test('Finding 09 adds no migration: the canonical chain still ends at 0033 and the DB guards are reused',()=>{
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.equal(migrations[migrations.length-1],'0033_hypothesis_generation_atomicity_recovery_v1.sql','no 0034 migration exists');
 // The existing exact-version guards are the final authority; the verifier
 // targets the live current schema, not a migration.
 assert.match(verifier,/create_confidence_evaluation/u);
 assert.match(verifier,/background_create_confidence_evaluation_v1/u);
 assert.doesNotMatch(verifier,/CREATE TABLE|CREATE FUNCTION|ALTER TABLE|TRUNCATE|DROP TABLE|DELETE FROM/iu);
});

test('the foreground exact-version method sends the exact caller version and never substitutes a later one',()=>{
 assert.match(confidenceService,/async evaluateHypothesisVersion\(/u);
 assert.match(confidenceService,/target_version: targetVersion/u);
 assert.match(confidenceService,/CONFIDENCE_TARGET_VERSION_INTEGRITY/u);
 assert.match(confidenceService,/Invalid confidence target version\./u);
 // The general/latest evaluation is preserved and still targets the current
 // canonical version.
 assert.match(confidenceService,/async evaluateHypothesis\(/u);
 assert.match(confidenceService,/target_version: hypothesis\.version/u);
});

test('the foreground post-update call site binds Confidence to mutation.update.after_version through the shared integrity policy',()=>{
 assert.match(updateService,/isCanonicalHypothesisUpdateMutation\(mutation, userId, updateId, request\)/u);
 assert.match(updateService,/HYPOTHESIS_UPDATE_INTEGRITY/u);
 assert.match(updateService,/evaluateHypothesisVersion\(\s*userId, token, request\.hypothesisId, mutation\.update\.after_version,\s*\)/u);
 // No ID-only latest-version Confidence call survives on this path.
 assert.doesNotMatch(updateService,/evaluateHypothesis\(userId/u);
 assert.match(updateService,/confidenceStatus: 'PENDING_RETRY', confidenceEvaluation: null/u);
 const integrity=section(policy,'export function isCanonicalHypothesisUpdateMutation');
 for(const check of['update\\.id === updateId','update\\.before_version === request\\.expectedVersion','update\\.after_version === request\\.expectedVersion \\+ 1','hypothesis\\.version === update\\.after_version','update\\.source === HYPOTHESIS_UPDATE_SOURCE'])assert.match(integrity,new RegExp(check,'u'),`integrity check ${check}`);
});

test('the background exact-version method never rediscovers the target and the A2.3b boundary binds to after_version',()=>{
 assert.match(enrichment,/async evaluateHypothesisConfidenceVersion\(/u);
 const exact=section(enrichment,'async evaluateHypothesisConfidenceVersion(','async applyAuthorizedHypothesisUpdate');
 assert.match(exact,/BACKGROUND_CONFIDENCE_INTEGRITY/u);
 assert.match(exact,/createConfidenceEvaluation\(context,randomUUID\(\),hypothesisId,targetVersion\)/u);
 assert.doesNotMatch(exact,/this\.data\.findHypothesis/u,'the exact method never discovers the target from a re-read');
 const boundary=section(enrichment,'async applyAuthorizedHypothesisUpdate','private assert');
 assert.match(boundary,/evaluateHypothesisConfidenceVersion\(context,request\.hypothesisId,mutation\.update\.after_version\)/u);
 assert.match(boundary,/isCanonicalHypothesisUpdateMutation\(mutation,context\.userId,updateId,request\)/u);
 assert.doesNotMatch(boundary,/evaluateHypothesisConfidence\(context,/u,'no latest-version helper on the post-update path');
 // The general/latest method is preserved for the generation Confidence Batch.
 const latest=section(enrichment,'async evaluateHypothesisConfidence(','// Exact-version');
 assert.match(latest,/findHypothesis/u);
 assert.match(latest,/hypothesis\.version/u);
});

test('the dispatcher stays A2.3c-isolated and the generation Confidence Batch is unchanged',()=>{
 assert.doesNotMatch(dispatcher,/applyAuthorizedHypothesisUpdate|applyHypothesisUpdate|evaluateHypothesisConfidenceVersion|HypothesisUpdateService|apply_hypothesis_evidence_update/u);
 assert.match(dispatcher,/evaluateHypothesisConfidence\(context,hypothesisId\)/u);
 assert.match(dispatcher,/CONFIDENCE_BATCH/u);
});

test('the current-schema verifier is wired into CI and proves both authorities adversarially',()=>{
 assert.match(packageJson,/"verify:exact-version-confidence:integration": "node --env-file-if-exists=\.env database\/verify-exact-version-confidence\.mjs"/u);
 assert.match(workflow,/npm run verify:exact-version-confidence:integration/u);
 for(const proof of['Stale hypothesis version','no Confidence row of any version','after_version','no reconstructed user JWT','service_role','QANDEEL_CONFIDENCE_RUNTIME','exact current target version succeeds'])assert.match(verifier,new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'iu'),`missing proof: ${proof}`);
});
