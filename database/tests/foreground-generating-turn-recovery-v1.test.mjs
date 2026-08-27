import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const migration=read('../migrations/0039_foreground_generating_turn_recovery_v1.sql'),verifier=read('../verify-migration-0039.mjs'),repository=read('../../apps/api/src/conversation/conversation.repository.ts'),orchestrator=read('../../apps/api/src/conversation/conversation-orchestrator.service.ts'),packageJson=read('../../package.json'),workflow=read('../../.github/workflows/api-ci.yml');

test('0039 exists as the ordered forward migration and adds only the recovery schema/authority surface',()=>{
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0039_foreground_generating_turn_recovery_v1.sql'),'migration 0039 exists');
 assert.ok(migrations.indexOf('0039_foreground_generating_turn_recovery_v1.sql')>migrations.indexOf('0038_information_gap_question_integration_v1.sql'),'0039 orders after 0038');
 assert.match(migration,/^BEGIN;/mu);assert.match(migration,/COMMIT;\s*$/u);
 // No new table, trigger, sequence, drop, truncate, or backfill beyond the one
 // bounded GENERATING lease initialization.
 assert.doesNotMatch(migration,/CREATE TABLE|CREATE SEQUENCE|CREATE TRIGGER|TRUNCATE|DROP TABLE|DROP FUNCTION|DELETE FROM/iu);
 const created=[...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map(m=>m[1]).sort();
 assert.deepEqual(created,['claim_conversation_turn','foreground_generation_lease_interval_v1','recover_expired_generating_conversation_turn_v1']);
 const columns=[...migration.matchAll(/ADD COLUMN (\w+)/gu)].map(m=>m[1]).sort();
 assert.deepEqual(columns,['generation_claimed_at','generation_lease_expires_at'],'exactly the two server-owned lease columns');
 assert.match(migration,/conversation_turns_generation_lease_pair_check/u,'the bounded pair-integrity constraint exists');
 assert.match(migration,/generation_lease_expires_at > generation_claimed_at/u);
});

test('every explicit identifier 0039 introduces fits the PostgreSQL 63-byte identifier limit',()=>{
 const identifiers=[...migration.matchAll(/\b(?:TABLE|FUNCTION|CONSTRAINT|INDEX|TRIGGER)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gu)].map(m=>m[1]);
 assert.ok(identifiers.length>0,'identifiers were actually scanned');
 const oversized=[...new Set(identifiers)].filter(name=>Buffer.byteLength(name,'utf8')>63);
 assert.deepEqual(oversized,[],`identifiers exceed PostgreSQL's 63-byte limit: ${oversized.join(', ')}`);
});

test('the 120-second lease is frozen in exactly one SQL constant with no configurable path',()=>{
 // The single named constant function is the ONE definition of the value.
 assert.match(migration,/CREATE FUNCTION public\.foreground_generation_lease_interval_v1\(\) RETURNS interval/u);
 const literals=migration.match(/interval '120 seconds'/gu)??[];
 assert.equal(literals.length,1,'the 120-second literal appears exactly once (inside the constant function)');
 assert.doesNotMatch(migration,/interval '(?!120 seconds)\d+ (?:second|minute|hour)/u,'no second competing duration literal exists');
 // Every consumer references the constant, never a duplicated literal.
 const claimBody=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.claim_conversation_turn'),migration.indexOf('CREATE FUNCTION public.recover_expired_generating_conversation_turn_v1'));
 const recoveryBody=migration.slice(migration.indexOf('CREATE FUNCTION public.recover_expired_generating_conversation_turn_v1'));
 assert.match(claimBody,/foreground_generation_lease_interval_v1\(\)/u,'claim consumes the constant');
 assert.match(recoveryBody,/foreground_generation_lease_interval_v1\(\)/u,'the legacy fallback consumes the constant');
 // The lease is canonical state-machine policy, not provider/client authority.
 assert.doesNotMatch(migration,/current_setting|process\.env|p_lease|p_duration|p_seconds|jwt_claims/iu,'no environment, request, JWT, or parameter can choose the lease');
 assert.doesNotMatch(repository,/lease|120|duration|seconds/iu,'the application repository never carries a lease duration');
});

test('the recovery command has the exact narrow signature and service-role-only ACL',()=>{
 assert.match(migration,/CREATE FUNCTION public\.recover_expired_generating_conversation_turn_v1\(\s*p_session_id uuid, p_user_id uuid, p_source_turn_id uuid,\s*p_event_id uuid, p_correlation_id uuid DEFAULT NULL, p_orchestration_id uuid DEFAULT NULL\s*\) RETURNS SETOF public\.conversation_turns/u,'exact preferred signature');
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.recover_expired_generating_conversation_turn_v1\(uuid,uuid,uuid,uuid,uuid,uuid\) FROM PUBLIC,anon,authenticated/u);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.recover_expired_generating_conversation_turn_v1\(uuid,uuid,uuid,uuid,uuid,uuid\) TO service_role/u);
 // No authenticated recovery path exists anywhere in the migration.
 assert.doesNotMatch(migration,/GRANT EXECUTE ON FUNCTION public\.recover_expired_generating_conversation_turn_v1\(uuid,uuid,uuid,uuid,uuid,uuid\) TO (?:authenticated|anon|PUBLIC)/u);
 // The replaced claim keeps its signature and its service-role-only authority
 // is explicitly re-asserted after CREATE OR REPLACE.
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.claim_conversation_turn\(\s*p_session_id uuid, p_user_id uuid, p_source_turn_id uuid, p_processing_path text, p_routing_reason text\s*\)/u);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.claim_conversation_turn\(uuid,uuid,uuid,text,text\) FROM PUBLIC,anon,authenticated/u);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.claim_conversation_turn\(uuid,uuid,uuid,text,text\) TO service_role/u);
 for(const fn of['foreground_generation_lease_interval_v1','claim_conversation_turn','recover_expired_generating_conversation_turn_v1'])assert.match(migration,new RegExp(`ALTER FUNCTION public\\.${fn}\\([^)]*\\) OWNER TO postgres`,'u'),`${fn} ownership is explicit`);
 assert.match(migration,/SECURITY DEFINER SET search_path=''/u);
});

test('recovery is fail-closed terminalization: FAILED only, no assistant, no replay, no new event vocabulary',()=>{
 const recoveryBody=migration.slice(migration.indexOf('CREATE FUNCTION public.recover_expired_generating_conversation_turn_v1'),migration.indexOf('-- 6.'));
 assert.match(recoveryBody,/status='GENERATING'/u,'only a GENERATING source turn is lockable');
 assert.match(recoveryBody,/FOR UPDATE/u,'race safety is the database row lock');
 assert.match(recoveryBody,/SET status='FAILED'/u);
 assert.doesNotMatch(recoveryBody,/'RECEIVED'|'COMPLETED'|'STREAMING'/u,'recovery never re-opens or completes a turn');
 assert.doesNotMatch(recoveryBody,/INSERT INTO public\.conversation_turns/u,'no replacement USER or ASSISTANT turn is created');
 assert.doesNotMatch(recoveryBody,/idempotency_key/u,'the idempotency key is never touched');
 assert.doesNotMatch(recoveryBody,/completed_at/u,'canonical fail semantics are preserved: completed_at is not reinterpreted');
 // The existing canonical ConversationTurnFailed v1 event is reused exactly:
 // same type, same v1 schema ref, same content-free payload keys, no version
 // widening and no new event type.
 assert.match(recoveryBody,/'ConversationTurnFailed'/u);
 assert.match(recoveryBody,/qandeel\.runtime\.conversation-turn-failed\.v1/u);
 assert.match(recoveryBody,/jsonb_build_object\('user_id',p_user_id,'session_id',p_session_id,'source_turn_id',p_source_turn_id,'terminal_status','FAILED','processing_path',source_row\.processing_path,'routing_reason',source_row\.routing_reason,'orchestration_id',p_orchestration_id\)/u,'the exact canonical failed payload vocabulary is reused');
 assert.doesNotMatch(migration,/event_version_check|ADD CONSTRAINT.*event_version|'ConversationTurnRecovered'|conversation-turn-failed\.v2/iu,'no event schema/version change');
 // The legacy/null-lease fallback is bounded to updated_at + the constant.
 assert.match(recoveryBody,/COALESCE\(source_row\.generation_lease_expires_at,\s*source_row\.updated_at \+ public\.foreground_generation_lease_interval_v1\(\)\)/u);
 // No model/provider concept exists anywhere in the executable SQL (prose
 // comments describing WHY replay is forbidden are exempt).
 const executableSql=migration.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
 assert.doesNotMatch(executableSql,/model|provider|openai|anthropic|gemini|claude|prompt|http|fetch/iu);
});

test('the deployment backfill is safe: only null-lease GENERATING rows, with a fresh full window from migration time',()=>{
 const backfill=migration.slice(migration.indexOf('-- 3.'),migration.indexOf('-- 4.'));
 assert.match(backfill,/UPDATE public\.conversation_turns/u);
 assert.match(backfill,/WHERE status = 'GENERATING' AND generation_claimed_at IS NULL/u,'rows not in GENERATING are never fabricated as active leases');
 assert.match(backfill,/generation_claimed_at = updated_at/u,'bounded historical claim information is retained');
 assert.match(backfill,/greatest\(/u,'an in-flight turn cannot expire merely because the migration deployed');
 assert.match(backfill,/CURRENT_TIMESTAMP \+ public\.foreground_generation_lease_interval_v1\(\)/u);
});

test('the application boundary is one narrow server-authority repository method consumed before all downstream work',()=>{
 assert.match(repository,/recoverExpiredGeneratingTurn/u);
 assert.match(repository,/rpc<ConversationTurn\[\]>\('recover_expired_generating_conversation_turn_v1'/u,'the repository calls only the canonical recovery command');
 const recoveryMethod=repository.slice(repository.indexOf('async recoverExpiredGeneratingTurn'),repository.indexOf('async cancelTurn'));
 assert.match(recoveryMethod,/this\.serviceApi\.rpc/u,'server-role channel only');
 assert.doesNotMatch(recoveryMethod,/accessToken|dataApi/u,'no user access token reaches the recovery RPC');
 assert.match(recoveryMethod,/this\.eventMetadata\(\)/u,'server-generated event/correlation/orchestration metadata');
 // The orchestrator checks bounded recovery for a GENERATING replay before any
 // Context/Safety/HIM/Memory/Hypothesis/Recommendation/model work and never
 // re-claims; the claim-lost loser reuses the same bounded check.
 const generatingGate=orchestrator.indexOf("userTurn.status === 'GENERATING'");
 assert.ok(generatingGate>=0,'the GENERATING replay gate exists');
 assert.ok(generatingGate<orchestrator.indexOf('this.repository.claimTurn'),'the replay gate runs before any claim');
 assert.ok(generatingGate<orchestrator.indexOf('this.contextBuilder.build'),'the replay gate runs before ContextBuilder');
 assert.ok(generatingGate<orchestrator.indexOf('this.safetyGate.evaluate'),'the replay gate runs before Safety');
 assert.ok(generatingGate<orchestrator.indexOf('this.router.generate'),'the replay gate runs before the one provider call');
 assert.equal((orchestrator.match(/recoverExpiredGeneratingTurn/gu)??[]).length,2,'exactly the replay gate and the claim-lost reread consume recovery');
});

test('the 0039 verifier proves live semantics and is wired into the toolchain and CI',()=>{
 for(const proof of['recover_expired_generating_conversation_turn_v1',"interval '120 seconds'",'FAILED','ConversationTurnFailed','SET ROLE service_role','BLOCKED'])assert.match(verifier,new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'u'),`verifier is missing ${proof}`);
 assert.match(packageJson,/"verify:foreground-generating-turn-recovery:integration": "node --env-file-if-exists=\.env database\/verify-migration-0039\.mjs"/u);
 assert.match(workflow,/run: npm run verify:foreground-generating-turn-recovery:integration/u);
 const recoveryStep=workflow.indexOf('run: npm run verify:foreground-generating-turn-recovery:integration');
 assert.ok(recoveryStep>workflow.indexOf('run: npm run verify:conversation-authority:integration'),'the recovery verifier runs after the conversation authority verifier');
 assert.ok(recoveryStep>workflow.indexOf('run: npm run verify:conversation-session-authority:integration'),'the recovery verifier runs after the session authority verifier');
 assert.ok(recoveryStep<workflow.indexOf('run: npm run verify:memory:integration'),'the recovery verifier runs before the downstream intelligence gates');
});
