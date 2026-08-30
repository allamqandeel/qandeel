import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// QIR-006 - Question / Information-Gap Closed Loop v1 static contract over the
// FROZEN migration 0063 text. Historical migrations 0001-0062 are asserted
// untouched only through their own existing guards; this file freezes the
// 0063-owned semantics.
const migration = readFileSync(new URL('../migrations/0063_question_information_gap_closed_loop_v1.sql', import.meta.url), 'utf8');
// Negatives run on comment-stripped SQL so the migration's own prose can name
// what it forbids without tripping the guard.
const executable = migration.replace(/^\s*--.*$/gmu, '');

test('the durable Information Gap lifecycle becomes total with exact closure metadata', () => {
  assert.match(migration, /ADD COLUMN closed_at timestamptz,\s*\n\s*ADD COLUMN closure_reason text,\s*\n\s*ADD COLUMN open_epoch integer NOT NULL DEFAULT 1/u);
  assert.match(migration, /DROP CONSTRAINT information_gap_foundation_check/u);
  assert.match(migration, /status IN \('OPEN','RESOLVED','SUPERSEDED'\)/u);
  assert.match(migration, /open_epoch >= 1/u);
  assert.match(migration, /status = 'OPEN' AND closed_at IS NULL AND closure_reason IS NULL/u);
  assert.match(migration, /status = 'RESOLVED' AND closed_at IS NOT NULL AND closure_reason = 'MISSING_INFORMATION_CODE_ABSENT'/u);
  assert.match(migration, /status = 'SUPERSEDED' AND closed_at IS NOT NULL AND closure_reason IN \('HYPOTHESIS_VERSION_ADVANCED','HYPOTHESIS_LIFECYCLE_INELIGIBLE'\)/u);
  // Historical rows are preserved and revalidated, never rewritten: no UPDATE
  // or DELETE of existing information_gaps rows appears outside the guarded
  // lifecycle authorities.
  assert.doesNotMatch(executable, /DELETE\s+FROM\s+public\.information_gaps/iu);
  assert.match(migration, /IF EXISTS\(SELECT 1 FROM public\.information_gaps WHERE open_epoch<>1 OR status<>'OPEN' OR closed_at IS NOT NULL OR closure_reason IS NOT NULL\)/u,
    'the migration proves every historical gap survived as an epoch-1 OPEN row');
});

test('closure and reopen are protected transitions owned by the internal authorization, with reopen at exactly +1', () => {
  assert.match(migration, /CREATE FUNCTION public\.guard_information_gap_lifecycle_mutation\(\)/u);
  assert.match(migration, /qandeel\.information_gap_lifecycle_transition/u);
  assert.match(migration, /OLD\.status='OPEN' AND NEW\.status IN \('RESOLVED','SUPERSEDED'\) AND NEW\.closed_at IS NOT NULL AND NEW\.closure_reason IS NOT NULL AND NEW\.open_epoch=OLD\.open_epoch/u);
  assert.match(migration, /OLD\.status IN \('RESOLVED','SUPERSEDED'\) AND NEW\.status='OPEN' AND NEW\.closed_at IS NULL AND NEW\.closure_reason IS NULL AND NEW\.open_epoch=OLD\.open_epoch\+1/u);
  assert.match(migration, /CREATE TRIGGER information_gap_lifecycle_guard BEFORE UPDATE OR DELETE ON public\.information_gaps/u);
});

test('the formal question binding substrate is internal, exact, and concurrency-final', () => {
  assert.match(migration, /CREATE TABLE public\.formal_question_turn_bindings/u);
  assert.match(migration, /state text NOT NULL DEFAULT 'SELECTED' CHECK\(state IN \('SELECTED','BOUND','RELEASED'\)\)/u);
  assert.match(migration, /question_type text NOT NULL CHECK\(question_type IN \('FACT_FINDING','VALIDATION','DISCRIMINATING'\)\)/u);
  assert.match(migration, /missing_information_code text NOT NULL CHECK\(missing_information_code IN \('NO_ELIGIBLE_EVIDENCE','UNVERIFIED_ASSUMPTIONS','COMPETING_HYPOTHESES_UNASSESSED'\)\)/u);
  assert.match(migration, /CONSTRAINT formal_question_binding_one_per_source_turn UNIQUE\(source_turn_id\)/u);
  assert.match(migration, /formal_question_binding_automatic_source_fk FOREIGN KEY\(information_gap_id\) REFERENCES public\.information_gap_confidence_sources\(information_gap_id\)/u,
    'only an automatic Confidence-backed gap is structurally reservable');
  assert.match(migration, /CREATE UNIQUE INDEX formal_question_one_active_reservation_per_gap_epoch\s*\n\s*ON public\.formal_question_turn_bindings\(information_gap_id,gap_open_epoch\) WHERE state<>'RELEASED'/u);
  assert.match(migration, /CREATE UNIQUE INDEX formal_question_one_selected_reservation_per_session\s*\n\s*ON public\.formal_question_turn_bindings\(session_id\) WHERE state='SELECTED'/u);
  assert.match(migration, /REVOKE ALL ON TABLE public\.formal_question_turn_bindings FROM PUBLIC,anon,authenticated,service_role/u);
  // Misleading lifecycle names are forbidden: the durable states never claim
  // the model asked or the user answered.
  assert.doesNotMatch(executable, /'ASKED'|'ANSWERED'/u);
  // No transcript, provider payload, or hidden-reasoning persistence exists in
  // the binding substrate: its columns are identities, lifecycle, and times.
  assert.doesNotMatch(executable, /question_text|transcript|provider_payload|reasoning/u);
});

test('the binding guard permits only the two protected SELECTED transitions and the release trigger is the ONE terminal mechanism', () => {
  assert.match(migration, /CREATE FUNCTION public\.guard_formal_question_turn_binding_mutation\(\)/u);
  assert.match(migration, /qandeel\.formal_question_binding_transition/u);
  assert.match(migration, /OLD\.state<>'SELECTED'/u);
  assert.match(migration, /CREATE FUNCTION public\.release_formal_question_reservations_v1\(\)/u);
  assert.match(migration, /CREATE TRIGGER conversation_turn_formal_question_release AFTER UPDATE ON public\.conversation_turns/u);
  assert.match(migration, /WHEN \(OLD\.role='USER' AND OLD\.status='GENERATING' AND NEW\.status IS DISTINCT FROM 'GENERATING'\)/u,
    'every canonical terminalizer that moves a USER turn out of GENERATING releases in the same transaction');
  assert.match(migration, /WHERE source_turn_id=NEW\.id AND state='SELECTED'/u, 'release is idempotent by predicate and never touches a BOUND consumption');
});

test('the atomic selection command derives the canonical target and is service-role-only', () => {
  assert.match(migration, /CREATE FUNCTION public\.select_formal_question_opportunity_v1\(\s*\n\s*p_user_id uuid, p_session_id uuid, p_source_turn_id uuid\s*\n\s*\) RETURNS TABLE\(outcome text, binding_id uuid, question_type text\)/u,
    'the application supplies ONLY the caller identity triple');
  assert.match(migration, /IF source_row\.status<>'GENERATING' THEN RAISE EXCEPTION 'SOURCE_TURN_NOT_GENERATING'/u);
  assert.match(migration, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(\s*\n\s*'qandeel_formal_question_selection:'\|\|p_user_id::text\|\|':'\|\|p_session_id::text,0\)\)/u);
  assert.match(migration, /h\.scope='CONVERSATION_SESSION:'\|\|p_session_id::text/u, 'session relevance is the canonical Hypothesis scope authority - never similarity, never an LLM');
  assert.match(migration, /h\.version=s\.target_version/u, 'the exact source target version must equal the CURRENT Hypothesis version');
  assert.match(migration, /public\.question_eligible_hypothesis_lifecycle_v1\(h\.status\)/u);
  assert.match(migration, /SELECT p_status IN \('CANDIDATE','ACTIVE','SUPPORTED','MIXED','WEAK','REOPENED'\);/u,
    'the questioning-eligible lifecycle is exactly the canonical active set');
  assert.match(migration, /b\.gap_open_epoch=g\.open_epoch AND b\.state<>'RELEASED'/u, 'a reserved or consumed epoch is never re-selected; a RELEASED one never blocks');
  assert.match(migration, /g\.status='OPEN' AND g\.open_epoch=b\.gap_open_epoch/u, 'outstanding means BOUND with the gap still OPEN at the exact bound epoch');
  assert.match(migration, /ORDER BY g\.created_at ASC, g\.id ASC\s*\n\s*LIMIT 1/u, 'deterministic DB-owned ordering: canonical creation ordinal, stable UUID tie-break');
  assert.match(migration, /RETURN QUERY SELECT 'OUTSTANDING_OPEN_QUESTION'::text, NULL::uuid, NULL::text/u);
  assert.match(migration, /RETURN QUERY SELECT 'NO_ELIGIBLE_GAP'::text, NULL::uuid, NULL::text/u);
  assert.match(migration, /IMPOSSIBLE_QUESTION_RESERVATION_STATE/u);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.select_formal_question_opportunity_v1\(uuid,uuid,uuid\) FROM PUBLIC,anon,authenticated/u);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.select_formal_question_opportunity_v1\(uuid,uuid,uuid\) TO service_role/u);
  // No utility ranking, no Expected Information Gain, no content heuristic,
  // and no provider participates in selection.
  assert.doesNotMatch(executable, /utility|information_gain|embedding|similarity|rank\b/iu);
});

test('the versioned finalization authority binds atomically and the retired signature cannot bypass it', () => {
  assert.match(migration, /CREATE FUNCTION public\.finalize_conversation_turn_v2\(/u);
  assert.match(migration, /p_question_binding_id uuid DEFAULT NULL/u);
  assert.match(migration, /binding_row\.source_turn_id IS DISTINCT FROM p_source_turn_id/u);
  assert.match(migration, /binding_row\.state IS DISTINCT FROM 'SELECTED'/u);
  assert.match(migration, /binding_gap\.open_epoch IS DISTINCT FROM binding_row\.gap_open_epoch/u);
  assert.match(migration, /INVALID_QUESTION_BINDING/u);
  assert.match(migration, /SET state='BOUND',assistant_turn_id=p_assistant_turn_id,bound_at=CURRENT_TIMESTAMP/u);
  // The identical atomic 0025 semantics survive: assistant insertion, source
  // completion, and the exact v2 outbox event in one transaction.
  assert.match(migration, /'ConversationTurnCompleted','2\.0'/u);
  assert.match(migration, /qandeel\.runtime\.conversation-turn-completed\.v2/u);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.finalize_conversation_turn_v2\(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid,uuid\) TO service_role/u);
  // The retired pre-0063 signature becomes a writeless raising tombstone with
  // zero EXECUTE for every application role.
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.finalize_conversation_turn\(/u);
  assert.match(migration, /RETIRED_CONVERSATION_FINALIZATION_AUTHORITY/u);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.finalize_conversation_turn\(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid\) FROM PUBLIC,anon,authenticated,service_role/u);
  const tombstone = executable.slice(executable.indexOf('CREATE OR REPLACE FUNCTION public.finalize_conversation_turn('), executable.indexOf('CREATE FUNCTION public.sync_post_response_information_gaps_v2'));
  assert.doesNotMatch(tombstone, /INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|runtime_event_outbox/iu, 'the tombstone contains no write and no outbox reach');
});

test('the versioned synchronization authority owns closure/reopen and v1 is a pure delegation', () => {
  assert.match(migration, /CREATE FUNCTION public\.sync_post_response_information_gaps_v2\(p_execution_id uuid\)/u);
  assert.match(migration, /'HYPOTHESIS_VERSION_ADVANCED' ELSE 'HYPOTHESIS_LIFECYCLE_INELIGIBLE'/u);
  assert.match(migration, /closure_reason='MISSING_INFORMATION_CODE_ABSENT'/u);
  assert.match(migration, /open_epoch=reconcile_gap\.open_epoch\+1/u, 'a legitimate recurrence increments the epoch exactly once');
  assert.match(migration, /'qandeel_information_gap_reconciliation:'/u, 'closure races are serialized per hypothesis in the one sorted advisory-lock set');
  // The v2 authority still consumes ONLY the execution identity and validates
  // the entire derived source set before any write - the exact 0038 semantics.
  assert.match(migration, /WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE/u);
  assert.match(migration, /public\.post_response_hypothesis_update_batch_result_valid_v1/u);
  assert.match(migration, /public\.post_response_confidence_batch_result_valid_v1/u);
  assert.match(migration, /jsonb_array_length\(tuples\)>27/u);
  assert.match(migration, /public\.create_information_gap_core_v1\(execution_row\.user_id/u, 'materialization still flows through the ONE shared creation core');
  // v1 delegates: one process-level closure implementation exists.
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.sync_post_response_information_gaps_v1\(p_execution_id uuid\)\s*\n\s*RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS \$\$\s*\n\s*BEGIN\s*\n\s*RETURN public\.sync_post_response_information_gaps_v2\(p_execution_id\);/u);
  // Closure is canonical-state-owned: no conversation text, no
  // answer-detection heuristic, no classifier, and no provider participates.
  // (user_answerability is the frozen 0007 column carried through the shared
  // creation core, so the ban whitelists exactly that identifier.)
  assert.doesNotMatch(executable, /answer(?!ability)|classif|keyword|conversation_turns\.content/iu);
});

test('the migration adds no provider surface and no background effect', () => {
  // QIR-005 remains exact: no new effect key, no provider registry touch, no
  // fourth provider-backed background call.
  assert.doesNotMatch(executable, /post_response_intelligence_effects_effect_key|QUESTION_PROVIDER|ASSOCIATION_PROVIDER|INTENT_PROVIDER|CANDIDATE_PROVIDER/u);
  assert.doesNotMatch(executable, /ADD CONSTRAINT.*effect_key/iu);
  // (CONFIDENCE_MODEL_UNCALIBRATED is the frozen calibration-only code the
  // synchronization authority filters, so the vendor/model ban whitelists
  // exactly that literal.)
  assert.doesNotMatch(executable, /http|fetch|provider_call|(?<!confidence_)model/iu);
});
