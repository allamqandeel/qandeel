-- A2.3a — Durable Authorized Association Command Persistence v1 (reconciled).
--
-- Before this migration, ASSOCIATION_PROVIDER completed through the generic
-- result-less RPC and stored no durable result. A crash after a successful
-- post-authority authorization therefore could not feed the later A2.3
-- automatic mutation stages: provider replay is forbidden, and reconstructing
-- commands from later canonical state is forbidden, so the paid, authorized
-- result was simply lost with the process.
--
-- This forward-only migration gives ASSOCIATION_PROVIDER a typed durable
-- result on the existing Post-Response Intelligence effect ledger, exactly as
-- migration 0024 did for MEMORY_WRITE and migration 0029 did for
-- INTENT_PROVIDER. It reuses the canonical result fields established there —
-- result_code / result_reference / result_payload — and adds NO new column,
-- table, queue or idempotency store (in particular, no dedicated
-- command-batch column):
--   * the durable successful vocabulary is NO_ASSOCIATION (no reference, no
--     payload) or AUTHORIZED_COMMANDS whose result_payload is the exact
--     post-authority HypothesisUpdateRequest[] batch;
--   * the typed-effect set grows from {MEMORY_WRITE, INTENT_PROVIDER} to
--     {MEMORY_WRITE, INTENT_PROVIDER, ASSOCIATION_PROVIDER}; the claimed-,
--     memory- and intent-result constraints from migration 0029 are untouched;
--   * one narrow service-role-only command writes the typed result and the
--     CLAIMED -> COMPLETED transition together, after cross-checking every
--     command's Evidence identity against the exact durable MEMORY_WRITE
--     result of the SAME execution;
--   * the generic result-less completion can no longer complete a new
--     ASSOCIATION_PROVIDER; the Memory and Intent error contracts are
--     preserved verbatim.
--
-- Only the post-authority command batch is durable. Raw provider output,
-- rejected proposals, prompts, hidden reasoning, provider metadata and error
-- text are never persisted, and a NOT_AUTHORIZED authorization is not a
-- durable success. Pre-0031 completed ASSOCIATION_PROVIDER rows with all-null
-- result fields stay valid and are NOT backfilled: their real provider outcome
-- is unknowable, so runtime recovery treats them as INDETERMINATE and
-- quarantines. A2.3a persists and recovers only; it performs no Hypothesis
-- mutation and invokes no provider on recovery.

BEGIN;

-- 1. Canonical authorized-command batch validator. It validates durable SHAPE
--    only — exact keys, canonical vocabulary and bounds — and deliberately
--    reads no table: Hypotheses, Memory and Evidence eligibility are current
--    world state, and the authority decision this payload records already
--    happened before completion. Re-running authorization here would let a
--    later world change silently rewrite a past authorized result. Each
--    command is exactly {hypothesisId, expectedVersion, evidenceId,
--    evidenceRole}; the batch is 1..4 commands in authority-preserved order,
--    with no duplicate hypothesis target and one shared canonical
--    memory:<uuid> Evidence identity. It is deliberately not STRICT: a NULL
--    payload must be a hard false, never a NULL a CHECK would treat as
--    satisfied.
CREATE FUNCTION public.post_response_association_commands_valid_v1(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
DECLARE
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  evidence_pattern constant text := '^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  element jsonb; targets text[] := '{}'; shared_evidence text;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value)<>'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p_value) NOT BETWEEN 1 AND 4 THEN RETURN false; END IF;
  FOR element IN SELECT value FROM jsonb_array_elements(p_value) AS entry(value) LOOP
    IF jsonb_typeof(element)<>'object' THEN RETURN false; END IF;
    IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(element) k)
       IS DISTINCT FROM ARRAY['evidenceId','evidenceRole','expectedVersion','hypothesisId'] THEN RETURN false; END IF;
    IF jsonb_typeof(element->'hypothesisId')<>'string'
       OR (element->>'hypothesisId') !~ uuid_pattern THEN RETURN false; END IF;
    -- A positive 32-bit integer with no sign, fraction or exponent.
    IF jsonb_typeof(element->'expectedVersion')<>'number'
       OR (element->>'expectedVersion') !~ '^[1-9][0-9]{0,9}$'
       OR (element->'expectedVersion')::numeric > 2147483647 THEN RETURN false; END IF;
    IF jsonb_typeof(element->'evidenceId')<>'string'
       OR (element->>'evidenceId') !~ evidence_pattern THEN RETURN false; END IF;
    IF jsonb_typeof(element->'evidenceRole')<>'string'
       OR (element->>'evidenceRole') NOT IN ('SUPPORTING','CONTRADICTING') THEN RETURN false; END IF;
    IF (element->>'hypothesisId') = ANY(targets) THEN RETURN false; END IF;
    targets := array_append(targets, element->>'hypothesisId');
    IF shared_evidence IS NULL THEN shared_evidence := element->>'evidenceId';
    ELSIF shared_evidence <> (element->>'evidenceId') THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;$$;

ALTER FUNCTION public.post_response_association_commands_valid_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.post_response_association_commands_valid_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- 2. Result domain. Migration 0029's claimed/memory/intent checks are
--    preserved untouched; only the untyped check is widened to admit the third
--    typed effect, and Association states its own domain: a legacy all-null
--    row, a payload-free NO_ASSOCIATION, or AUTHORIZED_COMMANDS whose payload
--    is a schema-valid canonical command batch. There is no third successful
--    Association code and no reference-bearing Association result.
ALTER TABLE public.post_response_intelligence_effects
  DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check,
  ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK (
    effect_key IN ('MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER')
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
  ),
  ADD CONSTRAINT post_response_intelligence_effects_association_result_check CHECK (
    effect_key<>'ASSOCIATION_PROVIDER'
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='NO_ASSOCIATION' AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='AUTHORIZED_COMMANDS' AND result_reference IS NULL
        AND result_payload IS NOT NULL AND public.post_response_association_commands_valid_v1(result_payload))
  );

-- 3. The generic result-less completion can no longer complete any typed
--    effect. MEMORY_WRITE and INTENT_PROVIDER keep their migration 0024/0029
--    error contracts verbatim; a new ASSOCIATION_PROVIDER now fails closed the
--    same way instead of silently completing with no recoverable result.
--    CANDIDATE_PROVIDER, HYPOTHESIS_PERSISTENCE and CONFIDENCE_BATCH still
--    complete generically.
CREATE OR REPLACE FUNCTION public.complete_post_response_intelligence_effect_v1(p_execution_id uuid,p_effect_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_effect_key='MEMORY_WRITE' THEN RAISE EXCEPTION 'MEMORY_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='INTENT_PROVIDER' THEN RAISE EXCEPTION 'INTENT_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='ASSOCIATION_PROVIDER' THEN RAISE EXCEPTION 'ASSOCIATION_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP WHERE execution_id=p_execution_id AND effect_key=p_effect_key AND state='CLAIMED';
 RETURN FOUND;
END;$$;

-- 4. Typed Association completion. This is the only way a new
--    ASSOCIATION_PROVIDER effect can become COMPLETED, and it writes the
--    durable result and the transition in one statement, so a completed
--    Association effect can never exist without a recoverable result. The
--    effect key is fixed — there is no p_effect_key parameter.
--
--    Order matters: the typed result is validated before the execution is
--    touched, so an invalid result leaves the effect CLAIMED and result-less.
--    The execution is then locked and must still be RUNNING; a wrong or
--    terminal execution returns false without mutating anything. For an
--    AUTHORIZED_COMMANDS result the command batch's Evidence identity is
--    cross-checked against the exact durable MEMORY_WRITE result of THIS
--    execution (COMPLETED + FRESH_EVIDENCE_CREATED + canonical reference),
--    which is what stops a result from one execution — or Evidence from
--    another tenant's run — being injected into this one. The final UPDATE
--    requires state='CLAIMED' with all result columns still null, so the first
--    durable result of an effect is immutable — a second completion returns
--    false and changes nothing.
CREATE FUNCTION public.complete_post_response_association_provider_effect_v1(p_execution_id uuid,p_result_code text,p_result_payload jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE execution_row public.post_response_intelligence_executions; fresh_reference text;
BEGIN
 IF p_result_code='NO_ASSOCIATION' THEN
  IF p_result_payload IS NOT NULL THEN RAISE EXCEPTION 'INVALID_ASSOCIATION_RESULT' USING ERRCODE='22023';END IF;
 ELSIF p_result_code='AUTHORIZED_COMMANDS' THEN
  IF p_result_payload IS NULL OR NOT public.post_response_association_commands_valid_v1(p_result_payload) THEN RAISE EXCEPTION 'INVALID_ASSOCIATION_RESULT' USING ERRCODE='22023';END IF;
 ELSE RAISE EXCEPTION 'INVALID_ASSOCIATION_RESULT' USING ERRCODE='22023';
 END IF;
 SELECT * INTO execution_row FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 IF p_result_code='AUTHORIZED_COMMANDS' THEN
  SELECT result_reference INTO fresh_reference FROM public.post_response_intelligence_effects
    WHERE execution_id=p_execution_id AND effect_key='MEMORY_WRITE' AND state='COMPLETED' AND result_code='FRESH_EVIDENCE_CREATED';
  IF NOT FOUND OR fresh_reference IS NULL THEN RAISE EXCEPTION 'ASSOCIATION_EVIDENCE_UNAVAILABLE' USING ERRCODE='42501';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_result_payload) AS entry(value) WHERE entry.value->>'evidenceId' IS DISTINCT FROM fresh_reference)
  THEN RAISE EXCEPTION 'ASSOCIATION_EVIDENCE_MISMATCH' USING ERRCODE='42501';END IF;
 END IF;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code=p_result_code,result_payload=p_result_payload
  WHERE execution_id=p_execution_id AND effect_key='ASSOCIATION_PROVIDER' AND state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL;
 RETURN FOUND;
END;$$;

ALTER FUNCTION public.complete_post_response_association_provider_effect_v1(uuid,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_post_response_association_provider_effect_v1(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_post_response_association_provider_effect_v1(uuid,text,jsonb) TO service_role;

COMMIT;
