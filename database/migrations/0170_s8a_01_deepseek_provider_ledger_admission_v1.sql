-- S8A-01 - DeepSeek Provider Admission to the AI-COST-01 Ledger v1.
--
-- AI-COST-01's provider registry is closed on purpose: "a fourth provider ... is a reviewed change here, never an
-- implicit widening" (0135 section 1). This is that reviewed change, for DeepSeek, and nothing else:
--
--   * the provider / operation pair ('DEEPSEEK', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE') is known;
--   * a COMPLETE DeepSeek usage is CACHE_READ_INPUT_TOKEN + INPUT_TOKEN + OUTPUT_TOKEN - DeepSeek reports
--     prompt_tokens = prompt_cache_hit_tokens + prompt_cache_miss_tokens, has no cache-write charge, and its
--     completion_tokens include the reasoning trace (reasoning stays OUTPUT_TOKEN, as 0135 already rules);
--   * the begin command admits 'DEEPSEEK'. It still refuses the TEST_PROVIDER and every other name.
--
-- The three registries move TOGETHER, in one transaction. Widening begin alone would be unsafe: for a provider that
-- ai_complete_usage_kinds_v1 does not name, the CASE yields NULL, and a NULL comparison makes the settlement's
-- COMPLETE / INCOMPLETE validation and the Price Card kind CHECK pass instead of refusing. That CASE now also answers
-- an EMPTY partition for any name it does not list, so an unlisted provider can never satisfy COMPLETE, INCOMPLETE or a
-- Price Card kind: it fails closed. Every provider already listed keeps exactly its 0135 partition.
--
-- Each function is replaced in place (CREATE OR REPLACE): the same signature, return type, volatility, SECURITY
-- posture, search_path, owner and grants. The service-role surface stays exactly the five 0135 functions. No table,
-- constraint, row, price, Price Card, Credit policy or grant changes; Credits stay CREDIT_POLICY_NOT_ACTIVATED and
-- DeepSeek calls are UNPRICED until an operator registers a reviewed Price Card. The CHECK constraints that call the
-- two IMMUTABLE functions are not re-validated by a replacement; that is sound here because every existing row's
-- provider keeps the same answer.
--
-- Migrations 0001-0169 are byte-unchanged.

BEGIN;

CREATE OR REPLACE FUNCTION public.ai_provider_operation_is_known_v1(p_provider text, p_operation text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT (p_provider, p_operation) IN (('OPENAI', 'OPENAI_RESPONSES_CREATE'),
                                       ('ANTHROPIC', 'ANTHROPIC_MESSAGES_CREATE'),
                                       ('GEMINI', 'GEMINI_GENERATE_CONTENT'),
                                       ('DEEPSEEK', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE'),
                                       ('TEST_PROVIDER', 'TEST_OPERATION'))
$$;

CREATE OR REPLACE FUNCTION public.ai_complete_usage_kinds_v1(p_provider text) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT CASE p_provider
    WHEN 'OPENAI' THEN ARRAY['CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']
    WHEN 'ANTHROPIC' THEN ARRAY['CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']
    WHEN 'GEMINI' THEN ARRAY['CACHE_READ_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']
    WHEN 'DEEPSEEK' THEN ARRAY['CACHE_READ_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']
    WHEN 'TEST_PROVIDER' THEN ARRAY['CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']
    ELSE ARRAY[]::text[]
  END
$$;

-- The 0135 body, byte for byte, except the one provider allow-list line.
CREATE OR REPLACE FUNCTION public.begin_ai_provider_call_v1(
  p_call_id uuid, p_user_id uuid, p_session_id uuid, p_source_turn_id uuid, p_provider text, p_requested_model text,
  p_operation text, p_feature_family text, p_processing_path text
) RETURNS TABLE (begin_outcome text, attempt_number integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing public.ai_provider_calls; v_attempt integer;
BEGIN
  IF p_call_id IS NULL OR p_user_id IS NULL OR p_provider IS NULL OR p_requested_model IS NULL OR p_operation IS NULL
     OR p_feature_family IS NULL THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL' USING ERRCODE = '22023';
  END IF;
  IF p_provider NOT IN ('OPENAI', 'ANTHROPIC', 'GEMINI', 'DEEPSEEK') THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL' USING ERRCODE = '22023';
  END IF;
  IF p_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.conversation_sessions s WHERE s.id = p_session_id AND s.user_id = p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_source_turn_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.conversation_turns t
     WHERE t.id = p_source_turn_id AND t.user_id = p_user_id AND (p_session_id IS NULL OR t.session_id = p_session_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  -- One account's begins are serialized (attempt numbering); different accounts never wait on each other.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.ai-provider-call.v1:' || p_user_id::text, 0));
  SELECT * INTO existing FROM public.ai_provider_calls c WHERE c.id = p_call_id;
  IF existing.id IS NOT NULL THEN
    IF (existing.user_id, existing.session_id, existing.source_turn_id, existing.provider, existing.requested_model,
        existing.operation, existing.feature_family, existing.processing_path)
       IS NOT DISTINCT FROM
       (p_user_id, p_session_id, p_source_turn_id, p_provider, p_requested_model, p_operation, p_feature_family, p_processing_path) THEN
      RETURN QUERY SELECT 'ALREADY_BEGUN'::text, existing.attempt_number; RETURN;
    END IF;
    RAISE EXCEPTION 'AI_PROVIDER_CALL_IDENTITY_CONFLICT' USING ERRCODE = 'PT409';
  END IF;
  -- Each external attempt for the same work and feature is its own numbered row: a retry is never folded into one.
  SELECT CASE WHEN p_source_turn_id IS NULL THEN 1 ELSE count(*)::integer + 1 END INTO v_attempt
    FROM public.ai_provider_calls c
   WHERE c.user_id = p_user_id AND c.source_turn_id = p_source_turn_id AND c.feature_family = p_feature_family;
  INSERT INTO public.ai_provider_calls (id, user_id, session_id, source_turn_id, provider, requested_model, operation,
                                        feature_family, processing_path, attempt_number, call_state, started_at)
  VALUES (p_call_id, p_user_id, p_session_id, p_source_turn_id, p_provider, p_requested_model, p_operation,
          p_feature_family, p_processing_path, v_attempt, 'PENDING', clock_timestamp());
  RETURN QUERY SELECT 'BEGUN'::text, v_attempt;
END $$;

COMMIT;
