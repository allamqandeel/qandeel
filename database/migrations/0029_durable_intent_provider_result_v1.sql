-- Finding 06 - Durable Intent Provider Result Persistence v1 (QAN-AUD-04).
--
-- The post-response dispatcher already refuses to replay an effect marked
-- COMPLETED, and migration 0024 gave MEMORY_WRITE a bounded typed durable
-- result so a completed Memory effect can be recovered deterministically.
-- INTENT_PROVIDER had no such result: the dispatcher held the authorized intent
-- only in a local variable and then completed the effect through the generic
-- result-less RPC. A redelivery after that durable completion correctly skipped
-- the provider, found no local intent, and produced a false
-- SKIPPED / INTENT_NOT_AUTHORIZED - converting a real, already-paid, authorized
-- provider result into a non-authorization purely because the process died
-- after the effect was durably completed.
--
-- The defect is durable effect completion without durable effect result. This
-- forward-only migration makes result persistence and CLAIMED -> COMPLETED
-- atomic for INTENT_PROVIDER, using exactly the pattern migration 0024
-- established for MEMORY_WRITE:
--   * result_payload jsonb is added to the existing effect ledger - no new
--     table, queue or idempotency store;
--   * the result domain is tightened so a CLAIMED effect carries no result at
--     all, untyped effects carry no result at all, MEMORY_WRITE keeps exactly
--     its 0024 semantics, and INTENT_PROVIDER is either a legacy all-null row,
--     a payload-free INTENT_NOT_AUTHORIZED, or an INTENT_AUTHORIZED whose
--     payload is a schema-valid canonical AuthorizedHypothesisGenerationIntent;
--   * one narrow service-role-only command writes the typed result and the
--     COMPLETED transition together, after cross-checking the payload's turn
--     and session provenance against the canonical execution;
--   * the generic result-less completion can no longer complete a new
--     INTENT_PROVIDER.
--
-- Only the post-authority canonical intent is durable. Raw provider output,
-- prompts, hidden reasoning, provider metadata, credentials and error text are
-- never persisted, and a durable NOT_AUTHORIZED carries no invented reason.
--
-- Pre-0029 completed INTENT_PROVIDER rows with all-null result fields stay
-- valid and are NOT backfilled: their real provider outcome is unknowable, so
-- runtime recovery treats them as INDETERMINATE and quarantines. Nothing is
-- inferred from Hypotheses, Memory or later canonical state, and no effect is
-- replayed. This migration also does not implement the parked PR #121
-- Association result contract.

BEGIN;

-- 1. Durable typed payload. Nullable and defaultless, so every existing row
--    keeps its stored bytes and simply reads NULL for the new column.
ALTER TABLE public.post_response_intelligence_effects ADD COLUMN result_payload jsonb;

-- 2. Canonical authorized-intent payload validator. It validates durable SHAPE
--    only - exact keys, canonical vocabulary and bounds - and deliberately
--    reads no table: Memory, Hypotheses, conversation turns and sessions are
--    all current world state, and the authority decision this payload records
--    already happened before completion. Re-running authorization here would
--    let a later world change silently rewrite a past authorized result.
--    It mirrors HypothesisGenerationIntentAuthorityService /
--    HypothesisGenerationRequestAssemblerService exactly: problem text bounded
--    to MAX_STATEMENT_LENGTH code points, scope serialized as
--    CONVERSATION_SESSION:<sessionId> within MAX_SCOPE_LENGTH, and 1..8
--    duplicate-free canonical memory:<uuid> Evidence identifiers in their
--    authority-preserved order (this function never re-ranks or re-sorts them).
--    It is deliberately not STRICT: a NULL payload must be a hard false, never
--    a NULL that a CHECK constraint would treat as satisfied.
CREATE FUNCTION public.post_response_authorized_intent_valid_v1(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
DECLARE
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  evidence_pattern constant text := '^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  problem jsonb; scope jsonb; evidence jsonb; session_id text;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value)<>'object' THEN RETURN false; END IF;
  IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p_value) k)
     IS DISTINCT FROM ARRAY['domain','evidenceIds','problem','scope'] THEN RETURN false; END IF;

  problem := p_value->'problem';
  IF jsonb_typeof(problem)<>'object' THEN RETURN false; END IF;
  IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(problem) k)
     IS DISTINCT FROM ARRAY['source','sourceTurnId','text'] THEN RETURN false; END IF;
  IF jsonb_typeof(problem->'text')<>'string' THEN RETURN false; END IF;
  -- Bounded, non-blank, and stored exactly as the authority produced it: the
  -- text is post-authority canonical data and is never transformed here.
  IF char_length(problem->>'text') NOT BETWEEN 1 AND 2000 THEN RETURN false; END IF;
  IF btrim(problem->>'text')='' THEN RETURN false; END IF;
  IF jsonb_typeof(problem->'source')<>'string' OR problem->>'source'<>'CURRENT_USER_TURN' THEN RETURN false; END IF;
  IF jsonb_typeof(problem->'sourceTurnId')<>'string' OR problem->>'sourceTurnId' !~* uuid_pattern THEN RETURN false; END IF;

  IF jsonb_typeof(p_value->'domain')<>'string'
     OR p_value->>'domain' NOT IN ('GENERAL','RELATIONSHIP','WORK','DECISION','GOAL','INTERACTION') THEN RETURN false; END IF;

  scope := p_value->'scope';
  IF jsonb_typeof(scope)<>'object' THEN RETURN false; END IF;
  IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(scope) k)
     IS DISTINCT FROM ARRAY['kind','serialized','sessionId'] THEN RETURN false; END IF;
  IF jsonb_typeof(scope->'kind')<>'string' OR scope->>'kind'<>'CONVERSATION_SESSION' THEN RETURN false; END IF;
  IF jsonb_typeof(scope->'sessionId')<>'string' OR scope->>'sessionId' !~* uuid_pattern THEN RETURN false; END IF;
  session_id := scope->>'sessionId';
  IF jsonb_typeof(scope->'serialized')<>'string'
     OR scope->>'serialized'<>'CONVERSATION_SESSION:'||session_id
     OR char_length(scope->>'serialized')>500 THEN RETURN false; END IF;

  evidence := p_value->'evidenceIds';
  IF jsonb_typeof(evidence)<>'array' THEN RETURN false; END IF;
  IF jsonb_array_length(evidence) NOT BETWEEN 1 AND 8 THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(evidence) element WHERE jsonb_typeof(element.value)<>'string') THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(evidence) element(value) WHERE element.value !~* evidence_pattern) THEN RETURN false; END IF;
  IF (SELECT count(DISTINCT element.value) FROM jsonb_array_elements_text(evidence) element(value))
     <> jsonb_array_length(evidence) THEN RETURN false; END IF;

  RETURN true;
END;$$;

ALTER FUNCTION public.post_response_authorized_intent_valid_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.post_response_authorized_intent_valid_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- 3. Result domain. Migration 0024's three checks are replaced by four
--    effect-scoped checks so Memory and Intent can each state their own domain
--    without one forbidding the other. Memory's branches are migration 0024's,
--    unchanged apart from also requiring a null payload.
ALTER TABLE public.post_response_intelligence_effects
  DROP CONSTRAINT post_response_intelligence_effects_claimed_result_check,
  DROP CONSTRAINT post_response_intelligence_effects_non_memory_result_check,
  DROP CONSTRAINT post_response_intelligence_effects_memory_result_check,
  -- A claimed effect carries no result of any kind.
  ADD CONSTRAINT post_response_intelligence_effects_claimed_result_check CHECK (
    state='COMPLETED' OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
  ),
  -- Only the two typed effects may carry a result at all.
  ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK (
    effect_key IN ('MEMORY_WRITE','INTENT_PROVIDER')
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
  ),
  -- Memory: migration 0024 semantics exactly, plus no payload.
  ADD CONSTRAINT post_response_intelligence_effects_memory_result_check CHECK (
    effect_key<>'MEMORY_WRITE'
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='NO_FRESH_EVIDENCE' AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='FRESH_EVIDENCE_CREATED' AND result_payload IS NULL
        AND result_reference ~ '^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ),
  -- Intent: legacy all-null row, payload-free NOT_AUTHORIZED, or AUTHORIZED
  -- with a schema-valid canonical intent payload. There is no third intent
  -- result code, no provider-specific code and no free-form reason.
  ADD CONSTRAINT post_response_intelligence_effects_intent_result_check CHECK (
    effect_key<>'INTENT_PROVIDER'
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='INTENT_NOT_AUTHORIZED' AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='INTENT_AUTHORIZED' AND result_reference IS NULL
        AND result_payload IS NOT NULL AND public.post_response_authorized_intent_valid_v1(result_payload))
  );

-- 4. The generic result-less completion can no longer complete either typed
--    effect. MEMORY_WRITE keeps migration 0024's error contract verbatim; a new
--    INTENT_PROVIDER now fails closed the same way instead of silently
--    completing with no recoverable result. Every other effect key is
--    untouched: CANDIDATE_PROVIDER, ASSOCIATION_PROVIDER,
--    HYPOTHESIS_PERSISTENCE and CONFIDENCE_BATCH still complete generically.
CREATE OR REPLACE FUNCTION public.complete_post_response_intelligence_effect_v1(p_execution_id uuid,p_effect_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_effect_key='MEMORY_WRITE' THEN RAISE EXCEPTION 'MEMORY_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='INTENT_PROVIDER' THEN RAISE EXCEPTION 'INTENT_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP WHERE execution_id=p_execution_id AND effect_key=p_effect_key AND state='CLAIMED';
 RETURN FOUND;
END;$$;

-- 5. Typed Intent completion. This is the only way a new INTENT_PROVIDER effect
--    can become COMPLETED, and it writes the durable result and the transition
--    in one statement, so a completed intent effect can never exist without a
--    recoverable result. The effect key is fixed - there is no p_effect_key
--    parameter to point it at another effect.
--
--    Order matters: the typed result is validated before the execution is
--    touched, so an invalid result leaves the effect CLAIMED and result-less.
--    The execution is then locked and must still be RUNNING; a wrong or
--    terminal execution returns false without mutating anything. For an
--    authorized result the payload's own provenance is cross-checked against
--    the canonical execution identity, which is what stops a result from one
--    execution being injected into another. The final UPDATE requires
--    state='CLAIMED' with all result columns still null, so the first durable
--    result of an effect is immutable - a second completion returns false and
--    changes nothing.
CREATE FUNCTION public.complete_post_response_intent_provider_effect_v1(p_execution_id uuid,p_result_code text,p_result_payload jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE execution_row public.post_response_intelligence_executions;
BEGIN
 IF p_result_code='INTENT_NOT_AUTHORIZED' THEN
  IF p_result_payload IS NOT NULL THEN RAISE EXCEPTION 'INVALID_INTENT_RESULT' USING ERRCODE='22023';END IF;
 ELSIF p_result_code='INTENT_AUTHORIZED' THEN
  IF p_result_payload IS NULL OR NOT public.post_response_authorized_intent_valid_v1(p_result_payload) THEN RAISE EXCEPTION 'INVALID_INTENT_RESULT' USING ERRCODE='22023';END IF;
 ELSE RAISE EXCEPTION 'INVALID_INTENT_RESULT' USING ERRCODE='22023';
 END IF;
 SELECT * INTO execution_row FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 IF p_result_code='INTENT_AUTHORIZED' THEN
  IF (p_result_payload->'problem'->>'sourceTurnId')::uuid<>execution_row.source_turn_id
   OR (p_result_payload->'scope'->>'sessionId')::uuid<>execution_row.session_id
  THEN RAISE EXCEPTION 'INTENT_PROVENANCE_MISMATCH' USING ERRCODE='42501';END IF;
 END IF;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code=p_result_code,result_payload=p_result_payload
  WHERE execution_id=p_execution_id AND effect_key='INTENT_PROVIDER' AND state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL;
 RETURN FOUND;
END;$$;

ALTER FUNCTION public.complete_post_response_intent_provider_effect_v1(uuid,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_post_response_intent_provider_effect_v1(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_post_response_intent_provider_effect_v1(uuid,text,jsonb) TO service_role;

COMMIT;
