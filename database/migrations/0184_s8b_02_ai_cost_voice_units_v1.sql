-- S8B-02 CP1 — AI-COST-01 / VA-5 as amended: the voice providers, operations, billable units, families and the source
-- of a usage quantity.
--
-- Product authority: the Product Owner's S8B-02 WP0 approval (2026-10-30), decisions D-1 (Gemini speech is billed in
-- tokens: INPUT_TOKEN + AUDIO_OUTPUT_TOKEN) and D-2 (Speechmatics usage the gateway measures is GATEWAY_MEASURED, kept
-- distinguishable and never presented as provider-confirmed; its reconciliation is S8B-08's), and the CP1 implementation
-- authorization of the same day. The binding design is the S8B-02 Implementation Task Contract v1.0 FINAL §3.9.
--
-- ## What is added
--
--   A. The provider SPEECHMATICS with SPEECHMATICS_REALTIME_TRANSCRIPTION and SPEECHMATICS_BATCH_TRANSCRIPTION, and the
--      route-neutral GEMINI_SPEECH_GENERATION under GEMINI (its route is S8B-04's).
--   B. The billable kinds AUDIO_INPUT_MS and AUDIO_OUTPUT_TOKEN, in the usage and component CHECKs.
--   C. The complete-usage partition v2, keyed by (provider, operation): Speechmatics [AUDIO_INPUT_MS]; Gemini speech
--      [AUDIO_OUTPUT_TOKEN, INPUT_TOKEN]; EVERY existing pair keeps exactly its v1 partition. The Price Card kind CHECK
--      reads v2, and a usage row whose kind is not in its call's v2 partition is refused, whichever settle wrote it.
--   D. The families VOICE_NOTE_TRANSCRIPTION, LIVE_CALL_TRANSCRIPTION, SPEECH_SYNTHESIS, SPEECH_RENDERING.
--   E. ai_provider_calls.usage_source (PROVIDER_REPORTED / GATEWAY_MEASURED; every existing row is PROVIDER_REPORTED,
--      which it is) and source_voice_recording_id (owner-verified by begin v3; no FK, like the 0175 Shared source).
--   F. begin_ai_provider_call_v3 (the voice begin: one row per provider session, so a reconnect is a new row),
--      settle_ai_provider_call_v2 (v1's settlement plus the usage source; GATEWAY_MEASURED only for the two Speechmatics
--      operations), server_read_ai_usage_operations_summary_v2 (the transcription families' stale bound is controlled
--      configuration: the maximum session length) and server_read_ai_cost_aggregates_v2 (the two sources reported apart).
--
-- ## What is deliberately NOT here
--
--   * No Price Card: every voice call rates UNPRICED. A Speechmatics card (USD 0.80 per hour is not exactly representable
--     on bases 1 / 1,000 / 1,000,000) is the decision of the task that first registers one (S8B-08 / Stage 9).
--   * No Credit change (DRAFT only), no DeepSeek or text-path change. begin v1 / v2, settle v1, the v1 summary and the v1
--     aggregates are byte-identical; ai_complete_usage_kinds_v1 is unchanged.
--
-- Forward-only. Migrations 0001-0183 are byte-unchanged.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- A. PROVIDERS AND OPERATIONS. Every pair 0170 knew keeps its answer, so no stored row changes meaning.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_provider_operation_is_known_v1(p_provider text, p_operation text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT (p_provider, p_operation) IN (('OPENAI', 'OPENAI_RESPONSES_CREATE'),
                                       ('ANTHROPIC', 'ANTHROPIC_MESSAGES_CREATE'),
                                       ('GEMINI', 'GEMINI_GENERATE_CONTENT'),
                                       ('DEEPSEEK', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE'),
                                       ('TEST_PROVIDER', 'TEST_OPERATION'),
                                       -- S8B-02 (0184): the voice operations.
                                       ('GEMINI', 'GEMINI_SPEECH_GENERATION'),
                                       ('SPEECHMATICS', 'SPEECHMATICS_REALTIME_TRANSCRIPTION'),
                                       ('SPEECHMATICS', 'SPEECHMATICS_BATCH_TRANSCRIPTION'))
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- C. THE PARTITION v2, by (provider, operation). An unknown pair has an EMPTY partition, so it can never be COMPLETE,
--    INCOMPLETE or priced: it fails closed (the 0170 rule).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.ai_complete_usage_kinds_v2(p_provider text, p_operation text) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_provider = 'SPEECHMATICS'
         AND p_operation IN ('SPEECHMATICS_REALTIME_TRANSCRIPTION', 'SPEECHMATICS_BATCH_TRANSCRIPTION')
      THEN ARRAY['AUDIO_INPUT_MS']
    WHEN p_provider = 'GEMINI' AND p_operation = 'GEMINI_SPEECH_GENERATION'
      THEN ARRAY['AUDIO_OUTPUT_TOKEN', 'INPUT_TOKEN']
    WHEN public.ai_provider_operation_is_known_v1(p_provider, p_operation)
      THEN public.ai_complete_usage_kinds_v1(p_provider)
    ELSE ARRAY[]::text[]
  END
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- B. THE KINDS, and the Price Card kind CHECK on v2.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.ai_provider_call_usage DROP CONSTRAINT ai_provider_call_usage_kind_check;
ALTER TABLE public.ai_provider_call_usage ADD CONSTRAINT ai_provider_call_usage_kind_check CHECK (usage_kind IN (
  'INPUT_TOKEN', 'OUTPUT_TOKEN', 'CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'AUDIO_INPUT_MS', 'AUDIO_OUTPUT_TOKEN'));
ALTER TABLE public.ai_cost_rating_components DROP CONSTRAINT ai_cost_rating_components_kind_check;
ALTER TABLE public.ai_cost_rating_components ADD CONSTRAINT ai_cost_rating_components_kind_check CHECK (usage_kind IN (
  'INPUT_TOKEN', 'OUTPUT_TOKEN', 'CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'AUDIO_INPUT_MS', 'AUDIO_OUTPUT_TOKEN'));
ALTER TABLE public.ai_price_cards DROP CONSTRAINT ai_price_cards_kind_check;
ALTER TABLE public.ai_price_cards ADD CONSTRAINT ai_price_cards_kind_check
  CHECK (usage_kind = ANY (public.ai_complete_usage_kinds_v2(provider, operation)));

-- A usage quantity is a kind of its own call's partition, whichever settlement wrote it.
CREATE FUNCTION public.guard_ai_provider_call_usage_kind_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ai_provider_calls c
                  WHERE c.id = NEW.provider_call_id
                    AND NEW.usage_kind = ANY (public.ai_complete_usage_kinds_v2(c.provider, c.operation))) THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL_SETTLEMENT' USING ERRCODE = '22023',
      DETAIL = 'A usage kind must belong to its call''s (provider, operation) partition.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_ai_provider_call_usage_kind_v1 BEFORE INSERT ON public.ai_provider_call_usage
  FOR EACH ROW EXECUTE FUNCTION public.guard_ai_provider_call_usage_kind_v1();

-- ---------------------------------------------------------------------------------------------------------------------
-- D / E. FAMILIES, THE USAGE SOURCE AND THE VOICE CORRELATION.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.ai_provider_calls DROP CONSTRAINT ai_provider_calls_feature_family_check;
ALTER TABLE public.ai_provider_calls ADD CONSTRAINT ai_provider_calls_feature_family_check CHECK (feature_family IN (
  'CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION', 'THREAD_FORMATION', 'THREAD_CONTINUITY',
  'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION',
  'PERSONAL_UNDERSTANDING_CAPTURE', 'SHARED_SEMANTIC_READING', 'SHARED_KNOWLEDGE_RECALL', 'SHARED_SPATIAL_PLACEMENT',
  'SHARED_DISCLOSURE_JUDGE', 'PUBLIC_SEMANTIC_INTERPRETATION', 'PUBLIC_QANDEEL_REPLY',
  'VOICE_NOTE_TRANSCRIPTION', 'LIVE_CALL_TRANSCRIPTION', 'SPEECH_SYNTHESIS', 'SPEECH_RENDERING'));

-- D-2: a quantity the gateway measured is never the provider's report. Set once, by the settlement; immutable after it
-- (the 0135 guard refuses every later UPDATE of the row).
ALTER TABLE public.ai_provider_calls
  ADD COLUMN usage_source text NOT NULL DEFAULT 'PROVIDER_REPORTED',
  ADD COLUMN source_voice_recording_id uuid,
  ADD CONSTRAINT ai_provider_calls_usage_source_check CHECK (usage_source IN ('PROVIDER_REPORTED', 'GATEWAY_MEASURED')),
  ADD CONSTRAINT ai_provider_calls_gateway_measured_check CHECK (usage_source = 'PROVIDER_REPORTED'
    OR (provider = 'SPEECHMATICS'
        AND operation IN ('SPEECHMATICS_REALTIME_TRANSCRIPTION', 'SPEECHMATICS_BATCH_TRANSCRIPTION'))),
  ADD CONSTRAINT ai_provider_calls_voice_source_check CHECK (source_voice_recording_id IS NULL
    OR (source_world_id IS NULL AND source_turn_id IS NULL));
CREATE INDEX ai_provider_calls_voice_attempt_idx ON public.ai_provider_calls (user_id, source_voice_recording_id, feature_family)
  WHERE source_voice_recording_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------------------------------
-- F. THE VOICE BEGIN. One external voice session (one provider connection) per row: a reconnect is a new row. The
--    recording it serves must be the payer's own (and in the named session). Only the voice operations.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.begin_ai_provider_call_v3(
  p_call_id uuid, p_user_id uuid, p_session_id uuid, p_source_voice_recording_id uuid, p_provider text,
  p_requested_model text, p_operation text, p_feature_family text, p_processing_path text
) RETURNS TABLE (begin_outcome text, attempt_number integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing public.ai_provider_calls; v_attempt integer;
BEGIN
  IF p_call_id IS NULL OR p_user_id IS NULL OR p_session_id IS NULL OR p_source_voice_recording_id IS NULL
     OR p_provider IS NULL OR p_requested_model IS NULL OR p_operation IS NULL OR p_feature_family IS NULL THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL' USING ERRCODE = '22023';
  END IF;
  IF (p_provider, p_operation) NOT IN (('GEMINI', 'GEMINI_SPEECH_GENERATION'),
                                       ('SPEECHMATICS', 'SPEECHMATICS_REALTIME_TRANSCRIPTION'),
                                       ('SPEECHMATICS', 'SPEECHMATICS_BATCH_TRANSCRIPTION'))
     OR p_feature_family NOT IN ('VOICE_NOTE_TRANSCRIPTION', 'LIVE_CALL_TRANSCRIPTION', 'SPEECH_SYNTHESIS',
                                 'SPEECH_RENDERING') THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM voice_private.recordings r
                  WHERE r.id = p_source_voice_recording_id AND r.user_id = p_user_id AND r.session_id = p_session_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.ai-provider-call.v1:' || p_user_id::text, 0));
  SELECT * INTO existing FROM public.ai_provider_calls c WHERE c.id = p_call_id;
  IF existing.id IS NOT NULL THEN
    IF (existing.user_id, existing.session_id, existing.source_turn_id, existing.source_world_id,
        existing.source_shared_material_id, existing.source_voice_recording_id, existing.provider,
        existing.requested_model, existing.operation, existing.feature_family, existing.processing_path)
       IS NOT DISTINCT FROM
       (p_user_id, p_session_id, NULL::uuid, NULL::uuid, NULL::uuid, p_source_voice_recording_id, p_provider,
        p_requested_model, p_operation, p_feature_family, p_processing_path) THEN
      RETURN QUERY SELECT 'ALREADY_BEGUN'::text, existing.attempt_number; RETURN;
    END IF;
    RAISE EXCEPTION 'AI_PROVIDER_CALL_IDENTITY_CONFLICT' USING ERRCODE = 'PT409';
  END IF;
  SELECT count(*)::integer + 1 INTO v_attempt FROM public.ai_provider_calls c
   WHERE c.user_id = p_user_id AND c.source_voice_recording_id = p_source_voice_recording_id
     AND c.feature_family = p_feature_family;
  INSERT INTO public.ai_provider_calls (id, user_id, session_id, source_turn_id, source_voice_recording_id, provider,
                                        requested_model, operation, feature_family, processing_path, attempt_number,
                                        call_state, started_at)
  VALUES (p_call_id, p_user_id, p_session_id, NULL, p_source_voice_recording_id, p_provider, p_requested_model,
          p_operation, p_feature_family, p_processing_path, v_attempt, 'PENDING', clock_timestamp());
  RETURN QUERY SELECT 'BEGUN'::text, v_attempt;
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- F. THE SETTLEMENT v2: v1's settlement, judged against the v2 partition, with the usage source. A PROVIDER_REPORTED
--    settlement has exactly v1's digest, so the two commands agree on every replay of a v1 call.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.settle_ai_provider_call_v2(
  p_call_id uuid, p_user_id uuid, p_outcome text, p_usage_completeness text, p_usage jsonb, p_usage_source text
) RETURNS TABLE (settle_outcome text, call_state text, rating_state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.ai_provider_calls;
  v_kinds text[];
  v_required text[];
  v_state text;
  v_digest text;
  v_rating text;
BEGIN
  IF p_call_id IS NULL OR p_user_id IS NULL OR p_outcome IS NULL OR p_usage_completeness IS NULL
     OR p_outcome NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED_BEFORE_PROVIDER')
     OR p_usage_completeness NOT IN ('COMPLETE', 'INCOMPLETE', 'ABSENT')
     OR p_usage IS NULL OR pg_catalog.jsonb_typeof(p_usage) <> 'object'
     OR p_usage_source IS NULL OR p_usage_source NOT IN ('PROVIDER_REPORTED', 'GATEWAY_MEASURED')
     OR (p_usage_source = 'GATEWAY_MEASURED' AND p_usage_completeness = 'ABSENT') THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL_SETTLEMENT' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_each(p_usage) e
              WHERE e.key NOT IN ('INPUT_TOKEN', 'OUTPUT_TOKEN', 'CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN',
                                  'AUDIO_INPUT_MS', 'AUDIO_OUTPUT_TOKEN')
                 OR pg_catalog.jsonb_typeof(e.value) <> 'number' OR e.value::text !~ '^[0-9]{1,16}$') THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL_SETTLEMENT' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg(e.key ORDER BY e.key COLLATE "C"), ARRAY[]::text[]) INTO v_kinds FROM pg_catalog.jsonb_object_keys(p_usage) e(key);

  SELECT * INTO c FROM public.ai_provider_calls x WHERE x.id = p_call_id AND x.user_id = p_user_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;

  v_required := public.ai_complete_usage_kinds_v2(c.provider, c.operation);
  IF (p_usage_completeness = 'ABSENT') <> (cardinality(v_kinds) = 0)
     OR (p_usage_completeness = 'COMPLETE' AND v_kinds <> v_required)
     OR (p_usage_completeness = 'INCOMPLETE' AND (NOT v_kinds <@ v_required OR v_kinds = v_required))
     OR (p_outcome = 'CANCELLED_BEFORE_PROVIDER' AND p_usage_completeness <> 'ABSENT')
     -- D-2: only a transcription the gateway measured may say so.
     OR (p_usage_source = 'GATEWAY_MEASURED'
         AND NOT (c.provider = 'SPEECHMATICS'
                  AND c.operation IN ('SPEECHMATICS_REALTIME_TRANSCRIPTION', 'SPEECHMATICS_BATCH_TRANSCRIPTION'))) THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL_SETTLEMENT' USING ERRCODE = '22023';
  END IF;

  v_digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    p_outcome || '|' || p_usage_completeness || '|' ||
    COALESCE((SELECT string_agg(e.key || '=' || (e.value #>> '{}'), ',' ORDER BY e.key) FROM pg_catalog.jsonb_each(p_usage) e), '')
    || CASE WHEN p_usage_source = 'GATEWAY_MEASURED' THEN '|GATEWAY_MEASURED' ELSE '' END,
    'UTF8')), 'hex');
  IF c.call_state <> 'PENDING' THEN
    IF c.settlement_digest = v_digest THEN
      SELECT r.rating_state INTO v_rating FROM public.ai_cost_ratings r WHERE r.provider_call_id = c.id AND r.is_canonical;
      RETURN QUERY SELECT 'ALREADY_SETTLED'::text, c.call_state, v_rating; RETURN;
    END IF;
    RAISE EXCEPTION 'AI_PROVIDER_CALL_SETTLEMENT_CONFLICT' USING ERRCODE = 'PT409';
  END IF;

  v_state := CASE
    WHEN p_outcome = 'CANCELLED_BEFORE_PROVIDER' THEN 'CANCELLED_BEFORE_PROVIDER'
    WHEN p_usage_completeness = 'ABSENT' THEN p_outcome || '_USAGE_UNKNOWN'
    ELSE p_outcome || '_USAGE_REPORTED' END;
  UPDATE public.ai_provider_calls x
     SET call_state = v_state, usage_completeness = p_usage_completeness, settled_at = clock_timestamp(),
         settlement_digest = v_digest, usage_source = p_usage_source
   WHERE x.id = c.id;
  INSERT INTO public.ai_provider_call_usage (provider_call_id, usage_kind, quantity)
  SELECT c.id, e.key, (e.value #>> '{}')::bigint FROM pg_catalog.jsonb_each(p_usage) e;
  IF v_state <> 'CANCELLED_BEFORE_PROVIDER' THEN
    v_rating := public.ai_rate_provider_call_v1(c.id, 'INITIAL_SETTLEMENT');
  END IF;
  RETURN QUERY SELECT 'SETTLED'::text, v_state, v_rating;
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- F. CONTENT-FREE READS v2. The v1 reads are unchanged.
-- ---------------------------------------------------------------------------------------------------------------------

-- v1's summary, except that a transcription session is stale only after the controlled maximum session length (a live
-- call is legitimately longer than five minutes); every other family keeps the five-minute rule. Adds the count of
-- settled calls whose usage the gateway measured.
CREATE FUNCTION public.server_read_ai_usage_operations_summary_v2(p_transcription_stale_seconds integer)
RETURNS TABLE (
  pending_calls bigint, stale_pending_calls bigint, stale_pending_oldest_age_seconds bigint,
  settled_calls_24h bigint, failed_calls_24h bigint, cancelled_calls_24h bigint, usage_unknown_calls_24h bigint,
  rated_calls_24h bigint, unpriced_calls_24h bigint, gateway_measured_calls_24h bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_transcription_stale_seconds IS NULL OR p_transcription_stale_seconds NOT BETWEEN 300 AND 86400 THEN
    RAISE EXCEPTION 'INVALID_STALE_BOUND' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH stale AS (
    SELECT c.started_at FROM public.ai_provider_calls c
     WHERE c.call_state = 'PENDING'
       AND c.started_at < clock_timestamp() - CASE
             WHEN c.feature_family IN ('VOICE_NOTE_TRANSCRIPTION', 'LIVE_CALL_TRANSCRIPTION')
               THEN make_interval(secs => p_transcription_stale_seconds)
             ELSE interval '5 minutes' END)
  SELECT
    (SELECT count(*) FROM public.ai_provider_calls c WHERE c.call_state = 'PENDING'),
    (SELECT count(*) FROM stale),
    (SELECT COALESCE(floor(extract(epoch FROM clock_timestamp() - min(s.started_at)))::bigint, 0) FROM stale s),
    count(*) FILTER (WHERE c.call_state <> 'PENDING'),
    count(*) FILTER (WHERE c.call_state IN ('FAILED_USAGE_REPORTED', 'FAILED_USAGE_UNKNOWN')),
    count(*) FILTER (WHERE c.call_state = 'CANCELLED_BEFORE_PROVIDER'),
    count(*) FILTER (WHERE r.rating_state = 'USAGE_UNKNOWN'),
    count(*) FILTER (WHERE r.rating_state = 'RATED'),
    count(*) FILTER (WHERE r.rating_state = 'UNPRICED'),
    count(*) FILTER (WHERE c.call_state <> 'PENDING' AND c.usage_source = 'GATEWAY_MEASURED')
  FROM public.ai_provider_calls c
  LEFT JOIN public.ai_cost_ratings r ON r.provider_call_id = c.id AND r.is_canonical
  WHERE c.started_at >= clock_timestamp() - interval '24 hours';
END $$;

-- v1's attribution, with the usage source as its own dimension (the two sources are never merged) and the two audio
-- quantities as their own columns.
CREATE FUNCTION public.server_read_ai_cost_aggregates_v2(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
  usage_day date, provider text, requested_model text, operation text, feature_family text, processing_path text,
  call_state text, rating_state text, usage_source text, currency text, calls bigint, input_tokens bigint,
  output_tokens bigint, cache_read_input_tokens bigint, cache_write_input_tokens bigint, audio_input_ms bigint,
  audio_output_tokens bigint, rated_total_amount text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to - p_from > interval '93 days' THEN
    RAISE EXCEPTION 'INVALID_AGGREGATE_WINDOW' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT (c.started_at AT TIME ZONE 'UTC')::date, c.provider, c.requested_model, c.operation, c.feature_family,
         c.processing_path, c.call_state,
         COALESCE(r.rating_state, CASE WHEN c.call_state = 'PENDING' THEN 'PENDING' ELSE 'NOT_RATED' END),
         c.usage_source, r.currency, count(*),
         sum(u.input_tokens)::bigint, sum(u.output_tokens)::bigint, sum(u.cache_read)::bigint, sum(u.cache_write)::bigint,
         sum(u.audio_input_ms)::bigint, sum(u.audio_output_tokens)::bigint, (sum(r.total_amount))::text
    FROM public.ai_provider_calls c
    LEFT JOIN public.ai_cost_ratings r ON r.provider_call_id = c.id AND r.is_canonical
    LEFT JOIN LATERAL (
      SELECT max(x.quantity) FILTER (WHERE x.usage_kind = 'INPUT_TOKEN') AS input_tokens,
             max(x.quantity) FILTER (WHERE x.usage_kind = 'OUTPUT_TOKEN') AS output_tokens,
             max(x.quantity) FILTER (WHERE x.usage_kind = 'CACHE_READ_INPUT_TOKEN') AS cache_read,
             max(x.quantity) FILTER (WHERE x.usage_kind = 'CACHE_WRITE_INPUT_TOKEN') AS cache_write,
             max(x.quantity) FILTER (WHERE x.usage_kind = 'AUDIO_INPUT_MS') AS audio_input_ms,
             max(x.quantity) FILTER (WHERE x.usage_kind = 'AUDIO_OUTPUT_TOKEN') AS audio_output_tokens
        FROM public.ai_provider_call_usage x WHERE x.provider_call_id = c.id) u ON true
   WHERE c.started_at >= p_from AND c.started_at < p_to
   GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
   ORDER BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10;
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- OWNERSHIP AND LEAST PRIVILEGE. Every new function is closed to every role; the four API commands and reads are opened
-- to the server channel only.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER FUNCTION public.ai_complete_usage_kinds_v2(text, text) OWNER TO postgres;
ALTER FUNCTION public.guard_ai_provider_call_usage_kind_v1() OWNER TO postgres;
ALTER FUNCTION public.begin_ai_provider_call_v3(uuid, uuid, uuid, uuid, text, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.settle_ai_provider_call_v2(uuid, uuid, text, text, jsonb, text) OWNER TO postgres;
ALTER FUNCTION public.server_read_ai_usage_operations_summary_v2(integer) OWNER TO postgres;
ALTER FUNCTION public.server_read_ai_cost_aggregates_v2(timestamptz, timestamptz) OWNER TO postgres;

REVOKE ALL ON FUNCTION
  public.ai_complete_usage_kinds_v2(text, text), public.guard_ai_provider_call_usage_kind_v1(),
  public.begin_ai_provider_call_v3(uuid, uuid, uuid, uuid, text, text, text, text, text),
  public.settle_ai_provider_call_v2(uuid, uuid, text, text, jsonb, text),
  public.server_read_ai_usage_operations_summary_v2(integer),
  public.server_read_ai_cost_aggregates_v2(timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.begin_ai_provider_call_v3(uuid, uuid, uuid, uuid, text, text, text, text, text),
  public.settle_ai_provider_call_v2(uuid, uuid, text, text, jsonb, text),
  public.server_read_ai_usage_operations_summary_v2(integer),
  public.server_read_ai_cost_aggregates_v2(timestamptz, timestamptz)
  TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- DEPLOY GUARD.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  -- Every pair 0170 knew keeps exactly its v1 partition.
  IF EXISTS (SELECT 1 FROM (VALUES ('OPENAI', 'OPENAI_RESPONSES_CREATE'), ('ANTHROPIC', 'ANTHROPIC_MESSAGES_CREATE'),
                                   ('GEMINI', 'GEMINI_GENERATE_CONTENT'), ('DEEPSEEK', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE'),
                                   ('TEST_PROVIDER', 'TEST_OPERATION')) AS p(provider, operation)
              WHERE public.ai_complete_usage_kinds_v2(p.provider, p.operation)
                    IS DISTINCT FROM public.ai_complete_usage_kinds_v1(p.provider)) THEN
    RAISE EXCEPTION 'S8B-02: an existing (provider, operation) pair changed its partition';
  END IF;
  -- No Price Card names a voice operation, and no Credit policy is active.
  IF EXISTS (SELECT 1 FROM public.ai_price_cards p
              WHERE p.provider = 'SPEECHMATICS' OR p.operation = 'GEMINI_SPEECH_GENERATION')
     OR EXISTS (SELECT 1 FROM public.ai_credit_policies p WHERE p.lifecycle <> 'DRAFT') THEN
    RAISE EXCEPTION 'S8B-02: no voice price card and no active Credit policy';
  END IF;
  -- Every existing call reads PROVIDER_REPORTED.
  IF EXISTS (SELECT 1 FROM public.ai_provider_calls c WHERE c.usage_source <> 'PROVIDER_REPORTED') THEN
    RAISE EXCEPTION 'S8B-02: an existing call must read PROVIDER_REPORTED';
  END IF;
END$$;

COMMIT;
