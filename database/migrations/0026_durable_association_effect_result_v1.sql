-- A2.3a — Durable Authorized Association Command Persistence v1.
--
-- Before this migration, ASSOCIATION_PROVIDER completed through the generic
-- effect-completion function and stored no durable result. A crash after a
-- successful authorization therefore could not feed A2.3 automatic mutation,
-- because provider replay is forbidden and reconstructing commands from later
-- canonical state is forbidden.
--
-- This forward-only migration gives ASSOCIATION_PROVIDER a typed durable result
-- on the existing Post-Response Intelligence effect ledger, exactly as migration
-- 0024 did for MEMORY_WRITE. The durable successful vocabulary is NO_ASSOCIATION
-- or AUTHORIZED_COMMANDS; AUTHORIZED_COMMANDS stores the exact authorized
-- HypothesisUpdateRequest[] batch produced by the association authority service.
-- A2.3a persists and recovers only; it performs no Hypothesis mutation and
-- invokes no provider on recovery.

BEGIN;

-- Structural validator for the durable authorized command batch. Bounded,
-- object-shaped, exact-field, single-fresh-evidence, distinct-target. Used both
-- by the completion function and by the table CHECK so arbitrary/unbounded JSON
-- can never be stored as authoritative Association commands.
CREATE FUNCTION public.post_response_association_commands_valid(p_commands jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE e jsonb; ids text[]:='{}'; evid text;
BEGIN
  IF p_commands IS NULL OR jsonb_typeof(p_commands)<>'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p_commands)<1 OR jsonb_array_length(p_commands)>4 THEN RETURN false; END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(p_commands) AS t(value) LOOP
    IF jsonb_typeof(e)<>'object' THEN RETURN false; END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(e))<>4 THEN RETURN false; END IF;
    IF NOT (e ? 'hypothesisId' AND e ? 'expectedVersion' AND e ? 'evidenceId' AND e ? 'evidenceRole') THEN RETURN false; END IF;
    IF jsonb_typeof(e->'hypothesisId')<>'string'
       OR (e->>'hypothesisId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RETURN false; END IF;
    IF jsonb_typeof(e->'expectedVersion')<>'number'
       OR (e->>'expectedVersion') !~ '^[1-9][0-9]{0,9}$'
       OR (e->'expectedVersion')::numeric > 2147483647 THEN RETURN false; END IF;
    IF jsonb_typeof(e->'evidenceId')<>'string'
       OR (e->>'evidenceId') !~ '^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RETURN false; END IF;
    IF jsonb_typeof(e->'evidenceRole')<>'string'
       OR (e->>'evidenceRole') NOT IN ('SUPPORTING','CONTRADICTING') THEN RETURN false; END IF;
    IF (e->>'hypothesisId') = ANY(ids) THEN RETURN false; END IF;
    ids := array_append(ids, (e->>'hypothesisId'));
    IF evid IS NULL THEN evid := (e->>'evidenceId');
    ELSIF evid <> (e->>'evidenceId') THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;$$;
ALTER FUNCTION public.post_response_association_commands_valid(jsonb) OWNER TO postgres;

-- Durable command payload column and the unified result-domain constraint. The
-- 0024 memory/non-memory result checks are superseded by one domain check that
-- also permits the two ASSOCIATION_PROVIDER result codes.
ALTER TABLE public.post_response_intelligence_effects ADD COLUMN result_commands jsonb;

ALTER TABLE public.post_response_intelligence_effects
  DROP CONSTRAINT post_response_intelligence_effects_non_memory_result_check,
  DROP CONSTRAINT post_response_intelligence_effects_memory_result_check,
  DROP CONSTRAINT post_response_intelligence_effects_claimed_result_check;

ALTER TABLE public.post_response_intelligence_effects
  ADD CONSTRAINT post_response_intelligence_effects_claimed_result_check
    CHECK (state = 'COMPLETED' OR (result_code IS NULL AND result_reference IS NULL AND result_commands IS NULL)),
  ADD CONSTRAINT post_response_intelligence_effects_result_domain_check CHECK (
    (result_code IS NULL AND result_reference IS NULL AND result_commands IS NULL) OR
    (effect_key = 'MEMORY_WRITE' AND state = 'COMPLETED' AND result_code = 'NO_FRESH_EVIDENCE' AND result_reference IS NULL AND result_commands IS NULL) OR
    (effect_key = 'MEMORY_WRITE' AND state = 'COMPLETED' AND result_code = 'FRESH_EVIDENCE_CREATED' AND result_reference ~ '^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AND result_commands IS NULL) OR
    (effect_key = 'ASSOCIATION_PROVIDER' AND state = 'COMPLETED' AND result_code = 'NO_ASSOCIATION' AND result_reference IS NULL AND result_commands IS NULL) OR
    (effect_key = 'ASSOCIATION_PROVIDER' AND state = 'COMPLETED' AND result_code = 'AUTHORIZED_COMMANDS' AND result_reference IS NULL AND public.post_response_association_commands_valid(result_commands))
  );

-- The generic completion function must now reject ASSOCIATION_PROVIDER as well as
-- MEMORY_WRITE, so neither can be observably COMPLETED without its typed result.
CREATE OR REPLACE FUNCTION public.complete_post_response_intelligence_effect_v1(p_execution_id uuid,p_effect_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_effect_key IN ('MEMORY_WRITE','ASSOCIATION_PROVIDER') THEN RAISE EXCEPTION 'TYPED_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP WHERE execution_id=p_execution_id AND effect_key=p_effect_key AND state='CLAIMED';
 RETURN FOUND;
END;$$;

-- Atomic, result-aware completion of a CLAIMED ASSOCIATION_PROVIDER effect. For
-- AUTHORIZED_COMMANDS the command evidence identity must equal the exact fresh
-- Evidence recovered from this execution's durable MEMORY_WRITE result.
CREATE FUNCTION public.complete_post_response_association_effect_v1(p_execution_id uuid,p_result_code text,p_result_commands jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE execution_state text; fresh_reference text;
BEGIN
 IF p_result_code='NO_ASSOCIATION' THEN
  IF p_result_commands IS NOT NULL THEN RAISE EXCEPTION 'INVALID_ASSOCIATION_RESULT' USING ERRCODE='22023';END IF;
 ELSIF p_result_code='AUTHORIZED_COMMANDS' THEN
  IF NOT public.post_response_association_commands_valid(p_result_commands) THEN RAISE EXCEPTION 'INVALID_ASSOCIATION_RESULT' USING ERRCODE='22023';END IF;
 ELSE RAISE EXCEPTION 'INVALID_ASSOCIATION_RESULT' USING ERRCODE='22023';
 END IF;
 SELECT state INTO execution_state FROM public.post_response_intelligence_executions WHERE id=p_execution_id FOR UPDATE;
 IF NOT FOUND OR execution_state<>'RUNNING' THEN RETURN false;END IF;
 IF p_result_code='AUTHORIZED_COMMANDS' THEN
  SELECT result_reference INTO fresh_reference FROM public.post_response_intelligence_effects
    WHERE execution_id=p_execution_id AND effect_key='MEMORY_WRITE' AND state='COMPLETED' AND result_code='FRESH_EVIDENCE_CREATED';
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSOCIATION_EVIDENCE_UNAVAILABLE' USING ERRCODE='22023';END IF;
  IF (p_result_commands->0->>'evidenceId') IS DISTINCT FROM fresh_reference THEN RAISE EXCEPTION 'ASSOCIATION_EVIDENCE_MISMATCH' USING ERRCODE='22023';END IF;
 END IF;
 UPDATE public.post_response_intelligence_effects
   SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code=p_result_code,result_commands=p_result_commands
   WHERE execution_id=p_execution_id AND effect_key='ASSOCIATION_PROVIDER' AND state='CLAIMED' AND result_code IS NULL AND result_commands IS NULL;
 RETURN FOUND;
END;$$;

ALTER FUNCTION public.complete_post_response_association_effect_v1(uuid,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_post_response_association_effect_v1(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_post_response_association_effect_v1(uuid,text,jsonb) TO service_role;

COMMIT;
