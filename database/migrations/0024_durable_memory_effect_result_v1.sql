BEGIN;

ALTER TABLE public.post_response_intelligence_effects
  ADD COLUMN result_code text,
  ADD COLUMN result_reference text,
  ADD CONSTRAINT post_response_intelligence_effects_claimed_result_check CHECK (state = 'COMPLETED' OR (result_code IS NULL AND result_reference IS NULL)),
  ADD CONSTRAINT post_response_intelligence_effects_non_memory_result_check CHECK (effect_key = 'MEMORY_WRITE' OR (result_code IS NULL AND result_reference IS NULL)),
  ADD CONSTRAINT post_response_intelligence_effects_memory_result_check CHECK (
    (result_code IS NULL AND result_reference IS NULL) OR
    (effect_key = 'MEMORY_WRITE' AND state = 'COMPLETED' AND result_code = 'NO_FRESH_EVIDENCE' AND result_reference IS NULL) OR
    (effect_key = 'MEMORY_WRITE' AND state = 'COMPLETED' AND result_code = 'FRESH_EVIDENCE_CREATED' AND result_reference ~ '^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  );

CREATE OR REPLACE FUNCTION public.complete_post_response_intelligence_effect_v1(p_execution_id uuid,p_effect_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_effect_key='MEMORY_WRITE' THEN RAISE EXCEPTION 'MEMORY_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP WHERE execution_id=p_execution_id AND effect_key=p_effect_key AND state='CLAIMED';
 RETURN FOUND;
END;$$;

CREATE FUNCTION public.complete_post_response_memory_write_effect_v1(p_execution_id uuid,p_result_code text,p_result_reference text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE execution_user_id uuid;memory_id uuid;
BEGIN
 IF p_result_code='NO_FRESH_EVIDENCE' THEN
  IF p_result_reference IS NOT NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_RESULT' USING ERRCODE='22023';END IF;
 ELSIF p_result_code='FRESH_EVIDENCE_CREATED' THEN
  IF p_result_reference IS NULL OR p_result_reference !~ '^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'INVALID_MEMORY_RESULT' USING ERRCODE='22023';END IF;
  memory_id=substring(p_result_reference from 8)::uuid;
 ELSE RAISE EXCEPTION 'INVALID_MEMORY_RESULT' USING ERRCODE='22023';
 END IF;
 SELECT user_id INTO execution_user_id FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 IF memory_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.memories WHERE id=memory_id AND user_id=execution_user_id) THEN RAISE EXCEPTION 'INVALID_MEMORY_OWNERSHIP' USING ERRCODE='42501';END IF;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code=p_result_code,result_reference=p_result_reference WHERE execution_id=p_execution_id AND effect_key='MEMORY_WRITE' AND state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL;
 RETURN FOUND;
END;$$;

ALTER FUNCTION public.complete_post_response_memory_write_effect_v1(uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_post_response_memory_write_effect_v1(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_post_response_memory_write_effect_v1(uuid,text,text) TO service_role;

COMMIT;
