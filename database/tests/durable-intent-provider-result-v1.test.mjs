import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../migrations/0029_durable_intent_provider_result_v1.sql');
const previous = read('../migrations/0024_durable_memory_effect_result_v1.sql');
const types = read('../../apps/api/src/post-response-intelligence/post-response-intelligence.types.ts');
const repository = read('../../apps/api/src/post-response-intelligence/post-response-intelligence.repository.ts');
const dispatcher = read('../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts');
const recovery = read('../../apps/api/src/post-response-intelligence/durable-intent-provider-result.ts');
// Assertions about behaviour are made against code, not the prose documenting it.
const sqlCode = migration.replace(/^\s*--[^\n]*$/gmu, '');
const repositoryCode = repository.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');

const VALIDATOR = 'public.post_response_authorized_intent_valid_v1(jsonb)';
const COMPLETION = 'public.complete_post_response_intent_provider_effect_v1(uuid,text,jsonb)';
const escape = (value) => value.replace(/[()[\]]/gu, '\\$&');

test('0029 is forward-only and adds the durable payload column without touching history', () => {
  assert.match(migration, /ALTER TABLE public\.post_response_intelligence_effects ADD COLUMN result_payload jsonb;/u);
  // Nullable and defaultless, so no existing row is rewritten.
  assert.doesNotMatch(migration, /ADD COLUMN result_payload[^;]*(?:NOT NULL|DEFAULT)/u);
  const outsideBodies = migration.replace(/\$\$[\s\S]*?\$\$/gu, '<<body>>');
  assert.doesNotMatch(outsideBodies, /\b(?:UPDATE|INSERT INTO|DELETE FROM)\s+public\./iu, 'no data statement outside the new command bodies');
  assert.doesNotMatch(sqlCode, /DROP TABLE|DROP COLUMN|TRUNCATE/iu);
  // No second ledger, queue or idempotency store.
  assert.doesNotMatch(sqlCode, /CREATE TABLE|CREATE SEQUENCE/iu);
  const created = [...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((match) => match[1]).sort();
  assert.deepEqual(created, [
    'complete_post_response_intelligence_effect_v1',
    'complete_post_response_intent_provider_effect_v1',
    'post_response_authorized_intent_valid_v1',
  ]);
});

test('the canonical intent validator is bounded, exact, immutable and reads no table', () => {
  const validator = migration.slice(
    migration.indexOf('CREATE FUNCTION public.post_response_authorized_intent_valid_v1'),
    migration.indexOf('ALTER FUNCTION public.post_response_authorized_intent_valid_v1'),
  );
  assert.match(validator, /LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path=''/u);
  // Not STRICT: a NULL payload must be a hard false, never a NULL that a CHECK
  // constraint would treat as satisfied.
  assert.doesNotMatch(validator, /\bSTRICT\b/u);
  assert.match(validator, /p_value IS NULL OR jsonb_typeof\(p_value\)<>'object'/u);
  // Exact top-level, problem and scope key sets.
  assert.match(validator, /ARRAY\['domain','evidenceIds','problem','scope'\]/u);
  assert.match(validator, /ARRAY\['source','sourceTurnId','text'\]/u);
  assert.match(validator, /ARRAY\['kind','serialized','sessionId'\]/u);
  assert.match(validator, /char_length\(problem->>'text'\) NOT BETWEEN 1 AND 2000/u);
  assert.match(validator, /problem->>'source'<>'CURRENT_USER_TURN'/u);
  assert.match(validator, /scope->>'kind'<>'CONVERSATION_SESSION'/u);
  assert.match(validator, /scope->>'serialized'<>'CONVERSATION_SESSION:'\|\|session_id/u);
  assert.match(validator, /char_length\(scope->>'serialized'\)>500/u);
  assert.match(validator, /jsonb_array_length\(evidence\) NOT BETWEEN 1 AND 8/u);
  assert.match(validator, /count\(DISTINCT element\.value\)/u, 'duplicate Evidence identifiers are rejected');
  for (const domain of ['GENERAL', 'RELATIONSHIP', 'WORK', 'DECISION', 'GOAL', 'INTERACTION']) {
    assert.match(validator, new RegExp(`'${domain}'`, 'u'), `canonical domain ${domain}`);
  }
  // Durable shape only: the validator reads no table, so no later change to
  // current world state can silently rewrite a past authorized result.
  assert.doesNotMatch(validator, /\bFROM\s+public\.\w+/u);
  assert.doesNotMatch(validator, /public\.(?:memories|hypotheses|conversation_turns|conversation_sessions|post_response_intelligence)/u);
  // It never re-ranks, re-sorts or rewrites the payload it validates.
  assert.doesNotMatch(validator, /ORDER BY element|array_agg\(element|RETURN p_value/u);
});

test('the result domain covers claimed, untyped, Memory and Intent effects', () => {
  for (const dropped of ['claimed_result_check', 'non_memory_result_check', 'memory_result_check']) {
    assert.match(migration, new RegExp(`DROP CONSTRAINT post_response_intelligence_effects_${dropped}`, 'u'));
  }
  // A claimed effect carries no result of any kind.
  assert.match(migration, /post_response_intelligence_effects_claimed_result_check CHECK \(\s*\n\s*state='COMPLETED' OR \(result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL\)/u);
  // Only the two typed effects may carry a result at all.
  assert.match(migration, /post_response_intelligence_effects_untyped_result_check CHECK \(\s*\n\s*effect_key IN \('MEMORY_WRITE','INTENT_PROVIDER'\)/u);
  // Memory keeps migration 0024's exact branches, plus a null payload.
  const memory = migration.slice(
    migration.indexOf('post_response_intelligence_effects_memory_result_check CHECK'),
    migration.indexOf('-- Intent: legacy all-null row'),
  );
  assert.match(memory, /result_code='NO_FRESH_EVIDENCE' AND result_reference IS NULL AND result_payload IS NULL/u);
  assert.match(memory, /result_code='FRESH_EVIDENCE_CREATED' AND result_payload IS NULL/u);
  assert.match(memory, /\^memory:\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[1-5\]\[0-9a-f\]\{3\}-\[89ab\]\[0-9a-f\]\{3\}-\[0-9a-f\]\{12\}\$/u);
  assert.ok(previous.includes("result_code = 'NO_FRESH_EVIDENCE'"), 'migration 0024 stays historical text');
  // Intent: legacy all-null, payload-free NOT_AUTHORIZED, or validated AUTHORIZED.
  const intent = migration.slice(migration.indexOf('post_response_intelligence_effects_intent_result_check CHECK'));
  assert.match(intent, /effect_key<>'INTENT_PROVIDER'\s*\n\s*OR \(result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL\)/u);
  assert.match(intent, /result_code='INTENT_NOT_AUTHORIZED' AND result_reference IS NULL AND result_payload IS NULL/u);
  assert.match(intent, /result_code='INTENT_AUTHORIZED' AND result_reference IS NULL\s*\n\s*AND result_payload IS NOT NULL AND public\.post_response_authorized_intent_valid_v1\(result_payload\)/u);
  // Exactly two intent result codes: no third code, no provider-specific code,
  // no free-form reason column.
  assert.deepEqual([...new Set([...migration.matchAll(/'(INTENT_[A-Z_]+)'/gu)].map((match) => match[1]))].sort(), [
    'INTENT_AUTHORIZED', 'INTENT_NOT_AUTHORIZED', 'INTENT_PROVENANCE_MISMATCH', 'INTENT_PROVIDER', 'INTENT_RESULT_REQUIRED',
  ]);
  assert.doesNotMatch(migration, /result_reason|failure_reason|provider_payload|raw_/iu);
});

test('the generic completion fails closed for both typed effects and nothing else', () => {
  const generic = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.complete_post_response_intelligence_effect_v1'),
    migration.indexOf('-- 5. Typed Intent completion'),
  );
  assert.match(generic, /p_effect_key='MEMORY_WRITE' THEN RAISE EXCEPTION 'MEMORY_RESULT_REQUIRED'/u);
  assert.match(generic, /p_effect_key='INTENT_PROVIDER' THEN RAISE EXCEPTION 'INTENT_RESULT_REQUIRED'/u);
  // CANDIDATE_PROVIDER, ASSOCIATION_PROVIDER, HYPOTHESIS_PERSISTENCE and
  // CONFIDENCE_BATCH keep generic completion.
  for (const untouched of ['CANDIDATE_PROVIDER', 'ASSOCIATION_PROVIDER', 'HYPOTHESIS_PERSISTENCE', 'CONFIDENCE_BATCH']) {
    assert.doesNotMatch(generic, new RegExp(untouched, 'u'), `${untouched} still completes generically`);
  }
  assert.match(generic, /UPDATE public\.post_response_intelligence_effects SET state='COMPLETED'.+state='CLAIMED'/u);
});

test('typed Intent completion is atomic, provenance-checked and write-once', () => {
  const command = migration.slice(migration.indexOf('CREATE FUNCTION public.complete_post_response_intent_provider_effect_v1'));
  // Fixed to INTENT_PROVIDER: there is no p_effect_key parameter.
  assert.match(command, /complete_post_response_intent_provider_effect_v1\(p_execution_id uuid,p_result_code text,p_result_payload jsonb DEFAULT NULL\)/u);
  assert.doesNotMatch(command, /p_effect_key/u);
  assert.match(command, /LANGUAGE plpgsql SECURITY DEFINER SET search_path=''/u);
  // The result is validated before the execution is touched, so an invalid
  // result cannot complete anything.
  assert.ok(command.indexOf('INVALID_INTENT_RESULT') < command.indexOf('FOR UPDATE'));
  assert.match(command, /p_result_code='INTENT_NOT_AUTHORIZED'[\s\S]*?p_result_payload IS NOT NULL THEN RAISE EXCEPTION 'INVALID_INTENT_RESULT'/u);
  assert.match(command, /p_result_payload IS NULL OR NOT public\.post_response_authorized_intent_valid_v1\(p_result_payload\)/u);
  assert.match(command, /ELSE RAISE EXCEPTION 'INVALID_INTENT_RESULT'/u);
  assert.match(command, /WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE/u);
  assert.match(command, /\(p_result_payload->'problem'->>'sourceTurnId'\)::uuid<>execution_row\.source_turn_id/u);
  assert.match(command, /\(p_result_payload->'scope'->>'sessionId'\)::uuid<>execution_row\.session_id/u);
  // Result and transition are written by one statement, and only over a
  // still-CLAIMED result-less effect, so the first durable result is immutable.
  assert.match(command, /SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code=p_result_code,result_payload=p_result_payload\s*\n\s*WHERE execution_id=p_execution_id AND effect_key='INTENT_PROVIDER' AND state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL/u);
  // It never re-runs authorization against current world state.
  assert.doesNotMatch(command, /public\.memories|public\.hypotheses|canonical_eligible_memory_ids_v1/u);
});

test('both new functions are postgres-owned and reachable only where required', () => {
  for (const signature of [VALIDATOR, COMPLETION]) {
    assert.match(migration, new RegExp(`ALTER FUNCTION ${escape(signature)} OWNER TO postgres`, 'u'));
  }
  assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION ${escape(VALIDATOR)} FROM PUBLIC,anon,authenticated,service_role`, 'u'));
  assert.doesNotMatch(migration, new RegExp(`GRANT EXECUTE ON FUNCTION ${escape(VALIDATOR)}`, 'u'), 'the validator is granted to nobody');
  assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION ${escape(COMPLETION)} FROM PUBLIC,anon,authenticated`, 'u'));
  assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION ${escape(COMPLETION)} TO service_role`, 'u'));
  assert.doesNotMatch(migration, /GRANT[^;]*TO (?:PUBLIC|anon|authenticated)/u);
  // No table privilege is handed to any application role.
  assert.doesNotMatch(migration, /GRANT[^;]*ON TABLE/u);
});

test('migration 0029 introduces no Association typed-result contract of its own', () => {
  assert.doesNotMatch(migration, /ASSOCIATION_AUTHORIZED|ASSOCIATION_NOT_AUTHORIZED|complete_post_response_association/iu);
  // The Association typed result arrived later in migration 0031 with its own
  // dedicated command surface; it never rides the Intent completion RPC.
  assert.match(repository, /completeAssociation\(id:string,result:DurableAssociationResult\)/u);
  assert.doesNotMatch(repository, /complete_post_response_intent_provider_effect_v1[^\n]*AUTHORIZED_COMMANDS/u);
});

test('the repository exposes a typed Intent completion and excludes typed effects from the generic one', () => {
  assert.match(repository, /completeIntent\(id:string,result:HypothesisGenerationIntentExtractionResult\)/u);
  assert.match(repository, /result\.status==='AUTHORIZED'\?this\.booleanRpc\('complete_post_response_intent_provider_effect_v1',\{p_execution_id:id,p_result_code:'INTENT_AUTHORIZED',p_result_payload:result\.intent\}\)/u);
  assert.match(repository, /p_result_code:'INTENT_NOT_AUTHORIZED',p_result_payload:null/u);
  // The generic completion cannot be handed a typed effect at compile time.
  // Migration 0031 widened the excluded typed set with ASSOCIATION_PROVIDER
  // and migration 0033 with both generation effects; Intent's own exclusion is
  // unchanged.
  assert.match(repository, /async complete\(id:string,effect:GenericIntelligenceEffect\)/u);
  assert.match(types, /export type GenericIntelligenceEffect=Exclude<IntelligenceEffect,'MEMORY_WRITE'\|'INTENT_PROVIDER'\|'ASSOCIATION_PROVIDER'\|'CANDIDATE_PROVIDER'\|'HYPOTHESIS_PERSISTENCE'>;/u);
  assert.match(types, /result_payload:unknown/u);
  assert.match(types, /IntentProviderEffectResultCode='INTENT_AUTHORIZED'\|'INTENT_NOT_AUTHORIZED'/u);
  // Only the post-authority canonical intent is sent: no raw provider output,
  // and no reason for a durable NOT_AUTHORIZED. (result.commands and
  // result.candidates are the Association and Candidate commands' own
  // post-authority payloads, not raw output.)
  assert.doesNotMatch(repositoryCode, /p_result_payload:result(?!\.intent|\.commands|\.candidates)/u);
  assert.doesNotMatch(repositoryCode, /reason|providerOutput|raw/u);
});

test('the dispatcher recovers durable Intent results instead of completing generically', () => {
  assert.doesNotMatch(dispatcher, /this\.effect\(execution,'INTENT_PROVIDER'/u);
  assert.doesNotMatch(dispatcher, /complete\(execution\.id,'INTENT_PROVIDER'\)/u);
  assert.match(dispatcher, /effect\.effect_key==='INTENT_PROVIDER'&&effect\.state==='COMPLETED'/u);
  assert.match(dispatcher, /recoverDurableIntentProviderResult\(persistedIntent,execution\)/u);
  // Recovered indeterminate quarantines; it never becomes a skip.
  assert.match(dispatcher, /recovered\.status==='INDETERMINATE'\)return this\.terminal\(execution,'QUARANTINED','INDETERMINATE_EFFECT','INTENT_RECOVERY'\)/u);
  assert.match(dispatcher, /recovered\.status==='NOT_AUTHORIZED'\)return this\.terminal\(execution,'SKIPPED','INTENT_NOT_AUTHORIZED','INTENT'\)/u);
  // A fresh run claims, extracts once, then persists the typed result before
  // consuming it.
  assert.ok(dispatcher.indexOf("this.ledger.claim(execution.id,'INTENT_PROVIDER')") <
    dispatcher.indexOf('this.extraction.extract('));
  assert.ok(dispatcher.indexOf('this.extraction.extract(') <
    dispatcher.indexOf('this.ledger.completeIntent(execution.id,extracted)'));
  assert.ok(dispatcher.indexOf('this.ledger.completeIntent(execution.id,extracted)') <
    dispatcher.indexOf('this.assembler.assemble(intent)'));
  // The recovered intent is the only thing the assembler ever sees.
  assert.match(dispatcher, /const assembled=this\.assembler\.assemble\(intent\);/u);
});

test('the recovery boundary is pure and never reconstructs an intent', () => {
  assert.match(recovery, /export function recoverDurableIntentProviderResult/u);
  assert.doesNotMatch(recovery, /\.service|Service|Repository|fetch\(|async |await |rpc\//u);
  assert.match(recovery, /if \(effect\.result_code === null\) return INDETERMINATE;/u);
  assert.match(recovery, /problem\.sourceTurnId\.toLowerCase\(\) !== execution\.source_turn_id\.toLowerCase\(\)/u);
  assert.match(recovery, /scope\.sessionId\.toLowerCase\(\) !== execution\.session_id\.toLowerCase\(\)/u);
  // Only an explicit INTENT_NOT_AUTHORIZED with no payload becomes NOT_AUTHORIZED.
  assert.match(recovery, /effect\.result_code === 'INTENT_NOT_AUTHORIZED'/u);
  assert.equal((recovery.match(/status: 'NOT_AUTHORIZED'/gu) ?? []).length, 1);
});

test('provides a secret-free real PostgreSQL adversarial verifier', () => {
  const verifier = read('../verify-migration-0029.mjs');
  assert.match(verifier, /process\.env\.DATABASE_URL/u);
  assert.match(verifier, /SET LOCAL ROLE/u);
  assert.match(verifier, /has_function_privilege/u);
  assert.match(verifier, /ROLLBACK/u);
  assert.match(verifier, /complete_post_response_intent_provider_effect_v1/u);
  assert.match(verifier, /post_response_authorized_intent_valid_v1/u);
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu);
});
