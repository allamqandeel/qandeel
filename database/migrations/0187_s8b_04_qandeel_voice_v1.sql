-- S8B-04 CP1 — QANDEEL's Voice, server and intelligence: the speech channel of a voice-note reply, the temporary Listen
-- audio store with paid creation separated from fetching, the per-attempt accounting of Google Cloud speech generation,
-- the crash settlement, and the consent text VOICE_RECORDING_V2.
--
-- Product authority: the Product Owner's CP1 authorization of the S8B-04 WP0 Research & Execution Contract v1.2
-- (2026-11-01: D-1 .. D-6, VA-11R, Copy Gate K-01 .. K-15 APPROVED for CP1 verbatim, F-01 only). The implementation
-- record is docs/e2e/QANDEEL_S8B_04_QANDEEL_VOICE_IMPLEMENTATION_RECORD_v1.md; the controlled amendment is
-- docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-04_VA-11R_TTS_ABUSE_MONITORING_CONTROLLED_AMENDMENT_v1.0.md.
--
-- ## What is added
--
--   A. voice_private.reply_speech_hints: one row per voice-note reply - its expression (one of the six, default CALM) and
--      its validated pronunciation hints (at most 4: offset + vocalized word). Speech-only: never part of a conversation
--      unit, Memory or history; no spoken text (§6.10 NO-PERSIST).
--   B. voice_private.reply_speech_segments: the temporary Listen store (§8.2). Key (user_id, listen_id, segment_index);
--      audio only, never text; 15 minutes from the listen's start (PROPOSED); one active listen per user (a new listen
--      replaces the old one); at most two segments synthesizing per user. Not a recording: no recording, anchor, Replay,
--      export or object-store link.
--   C. The Listen definers (service_role): read, start, admit (the segment and its ledger row in ONE transaction), the one
--      pre-audio retry (a new ledger row), complete (audio + settlement in ONE transaction), fail, read audio (never a
--      provider call), cancel, sweep (an expired lease is FAILED_UNKNOWN and its call settles FAILED with usage ABSENT -
--      never re-synthesized automatically, I-7).
--   D. VOICE_RECORDING_V2 (K-01 .. K-15) installed and current; VOICE_RECORDING_V1 stays, unchanged and historical, so a
--      V1 grant is VERSION_NOT_CURRENT and a pending transcription is held for consent (AC-14).
--   E. Both relations are ACCOUNT_CASCADE (and leave with their assistant turn).
--
-- ## What is deliberately NOT here
--
--   * No gate is opened; no client role executes any new definer; nothing is applied to a hosted database by this change.
--   * No earlier statement is replaced: every earlier migration and function stays byte-identical. The accounting row of
--     a synthesis is written by the admission definer itself (begin_ai_provider_call_v3 is bound to a recording; Listen
--     is bound to the reply turn), with the 0135 / 0184 ledger's own settlement.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. CONTROLLED CONSTANTS (all PROPOSED, §9.3; tuned only by a controlled change).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION voice_private.reply_listen_policy_v1(
  OUT listen_ttl interval, OUT max_segments integer, OUT max_synthesizing_per_user integer,
  OUT max_attempts integer, OUT max_audio_bytes integer, OUT max_lease_seconds integer, OUT stale_call_seconds integer)
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT interval '15 minutes', 16, 2, 2, 3145728, 120, 300
$$;

CREATE FUNCTION voice_private.reply_speech_hints_valid_v1(p_hints jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT p_hints IS NOT NULL AND pg_catalog.jsonb_typeof(p_hints) = 'array' AND pg_catalog.jsonb_array_length(p_hints) <= 4
     AND NOT EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_array_elements(p_hints) e(h)
        WHERE pg_catalog.jsonb_typeof(e.h) <> 'object'
           OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(e.h)) <> 2
           OR pg_catalog.jsonb_typeof(e.h -> 'offset') <> 'number' OR (e.h ->> 'offset') !~ '^[0-9]{1,6}$'
           OR pg_catalog.jsonb_typeof(e.h -> 'word') <> 'string'
           OR (e.h ->> 'word') !~ '^[ء-يً-ْٰ]{1,30}$' OR (e.h ->> 'word') !~ '[ً-ْٰ]')
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE SPEECH CHANNEL OF A VOICE-NOTE REPLY (§7.1). RLS on, no policy, no role: only the definers below.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.reply_speech_hints (
  assistant_turn_id uuid NOT NULL,
  user_id uuid NOT NULL,
  expression text NOT NULL,
  hints jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT reply_speech_hints_pk PRIMARY KEY (assistant_turn_id),
  CONSTRAINT reply_speech_hints_turn_fk FOREIGN KEY (assistant_turn_id) REFERENCES public.conversation_turns (id) ON DELETE CASCADE,
  CONSTRAINT reply_speech_hints_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT reply_speech_hints_expression_check CHECK (expression IN ('CALM', 'JOY', 'PLAYFUL', 'SURPRISE', 'EMPATHY', 'SERIOUS')),
  CONSTRAINT reply_speech_hints_hints_check CHECK (voice_private.reply_speech_hints_valid_v1(hints))
);
CREATE INDEX reply_speech_hints_user_idx ON voice_private.reply_speech_hints (user_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE TEMPORARY LISTEN STORE (§8.2). Audio only; no text column. RLS on, no policy, no role.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.reply_speech_segments (
  user_id uuid NOT NULL,
  listen_id uuid NOT NULL,
  segment_index integer NOT NULL,
  assistant_turn_id uuid NOT NULL,
  session_id uuid NOT NULL,
  segment_count integer NOT NULL,
  renderer_version text NOT NULL,
  state text NOT NULL DEFAULT 'PENDING',
  call_id uuid,
  attempts integer NOT NULL DEFAULT 0,
  audio bytea,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT reply_speech_segments_pk PRIMARY KEY (user_id, listen_id, segment_index),
  CONSTRAINT reply_speech_segments_turn_fk FOREIGN KEY (assistant_turn_id) REFERENCES public.conversation_turns (id) ON DELETE CASCADE,
  CONSTRAINT reply_speech_segments_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT reply_speech_segments_index_check CHECK (segment_count BETWEEN 1 AND 16 AND segment_index >= 0 AND segment_index < segment_count),
  CONSTRAINT reply_speech_segments_version_check CHECK (renderer_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  CONSTRAINT reply_speech_segments_state_check CHECK (state IN ('PENDING', 'SYNTHESIZING', 'READY', 'FAILED', 'FAILED_UNKNOWN', 'DISCARDED')),
  CONSTRAINT reply_speech_segments_attempts_check CHECK (attempts BETWEEN 0 AND 2),
  CONSTRAINT reply_speech_segments_audio_check CHECK (audio IS NULL OR octet_length(audio) BETWEEN 45 AND 3145728),
  -- The shape of each state: only READY holds audio; a synthesizing (or discarded-while-synthesizing) segment holds its
  -- current call and lease; PENDING has never been admitted.
  CONSTRAINT reply_speech_segments_shape_check CHECK (
    CASE state
      WHEN 'PENDING' THEN audio IS NULL AND call_id IS NULL AND lease_until IS NULL AND attempts = 0
      WHEN 'SYNTHESIZING' THEN audio IS NULL AND call_id IS NOT NULL AND lease_until IS NOT NULL AND attempts >= 1
      WHEN 'DISCARDED' THEN audio IS NULL AND call_id IS NOT NULL AND lease_until IS NOT NULL AND attempts >= 1
      WHEN 'READY' THEN audio IS NOT NULL AND call_id IS NOT NULL AND lease_until IS NULL
      ELSE audio IS NULL AND call_id IS NOT NULL AND lease_until IS NULL
    END),
  CONSTRAINT reply_speech_segments_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX reply_speech_segments_turn_idx ON voice_private.reply_speech_segments (assistant_turn_id);
CREATE INDEX reply_speech_segments_expiry_idx ON voice_private.reply_speech_segments (expires_at);
CREATE INDEX reply_speech_segments_lease_idx ON voice_private.reply_speech_segments (lease_until)
  WHERE state IN ('SYNTHESIZING', 'DISCARDED');
CREATE UNIQUE INDEX reply_speech_segments_call_idx ON voice_private.reply_speech_segments (call_id) WHERE call_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. INTERNAL HELPERS.
-- ---------------------------------------------------------------------------------------------------------------------

-- The owner's completed assistant reply to their own Voice Note turn, or the reason it is not one.
CREATE FUNCTION voice_private.voice_reply_eligibility_v1(p_user_id uuid, p_assistant_turn_id uuid,
  OUT outcome text, OUT session_id uuid, OUT content text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_reply public.conversation_turns;
BEGIN
  SELECT * INTO v_reply FROM public.conversation_turns t
   WHERE t.id = p_assistant_turn_id AND t.user_id = p_user_id AND t.role = 'ASSISTANT' AND t.status = 'COMPLETED';
  IF NOT FOUND THEN outcome := 'NOT_FOUND'; RETURN; END IF;
  IF v_reply.source_turn_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.conversation_turn_voice_sources vs
        WHERE vs.turn_id = v_reply.source_turn_id AND vs.user_id = p_user_id
          AND vs.source_role = 'USER' AND vs.source_modality = 'VOICE_NOTE') THEN
    outcome := 'NOT_VOICE_REPLY'; RETURN;
  END IF;
  IF NOT voice_private.capability_enabled_v1('PERSONAL_VOICE_NOTE') THEN outcome := 'NOT_AVAILABLE_NOW'; RETURN; END IF;
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN outcome := 'CONSENT_REQUIRED'; RETURN; END IF;
  outcome := 'ELIGIBLE';
  session_id := v_reply.session_id;
  content := v_reply.content;
END$$;

-- The per-user lock every Listen write takes (one active listen, the synthesizing bound).
CREATE FUNCTION voice_private.lock_reply_listen_v1(p_user_id uuid) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.reply-listen.v1:' || p_user_id::text, 0));
$$;

-- A new ledger row for one synthesis attempt, bound to the reply turn (one row per attempt, D-2 of AI-COST).
CREATE FUNCTION voice_private.begin_reply_speech_call_v1(p_call_id uuid, p_user_id uuid, p_session_id uuid,
  p_assistant_turn_id uuid, p_requested_model text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_attempt integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.ai-provider-call.v1:' || p_user_id::text, 0));
  SELECT count(*)::integer + 1 INTO v_attempt FROM public.ai_provider_calls c
   WHERE c.user_id = p_user_id AND c.source_turn_id = p_assistant_turn_id AND c.feature_family = 'SPEECH_SYNTHESIS';
  INSERT INTO public.ai_provider_calls (id, user_id, session_id, source_turn_id, provider, requested_model, operation,
                                        feature_family, processing_path, attempt_number, call_state, started_at)
  VALUES (p_call_id, p_user_id, p_session_id, p_assistant_turn_id, 'GEMINI', p_requested_model, 'GEMINI_SPEECH_GENERATION',
          'SPEECH_SYNTHESIS', NULL, v_attempt, 'PENDING', clock_timestamp());
END$$;

-- Settles a PENDING synthesis call as FAILED with usage unknown (the crash rule: never zero, never retried).
CREATE FUNCTION voice_private.settle_reply_speech_call_unknown_v1(p_call_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid;
BEGIN
  SELECT c.user_id INTO v_user FROM public.ai_provider_calls c
   WHERE c.id = p_call_id AND c.call_state = 'PENDING' AND c.operation = 'GEMINI_SPEECH_GENERATION';
  IF FOUND THEN
    PERFORM public.settle_ai_provider_call_v2(p_call_id, v_user, 'FAILED', 'ABSENT', '{}'::jsonb, 'PROVIDER_REPORTED');
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. THE CHANNEL WRITE (service_role, after the reply is committed). Idempotent; a reply that is not the owner's voice-note
--    reply records nothing. The gate and consent are not read here: the channel is part of the reply, not of Listen.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_record_reply_speech_channel_v1(p_user_id uuid, p_assistant_turn_id uuid, p_expression text,
  p_hints jsonb) RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_reply public.conversation_turns;
BEGIN
  IF p_user_id IS NULL OR p_assistant_turn_id IS NULL OR p_expression IS NULL
     OR p_expression NOT IN ('CALM', 'JOY', 'PLAYFUL', 'SURPRISE', 'EMPATHY', 'SERIOUS')
     OR NOT voice_private.reply_speech_hints_valid_v1(p_hints) THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_reply FROM public.conversation_turns t
   WHERE t.id = p_assistant_turn_id AND t.user_id = p_user_id AND t.role = 'ASSISTANT' AND t.status = 'COMPLETED';
  IF NOT FOUND OR v_reply.source_turn_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.conversation_turn_voice_sources vs
        WHERE vs.turn_id = v_reply.source_turn_id AND vs.user_id = p_user_id
          AND vs.source_role = 'USER' AND vs.source_modality = 'VOICE_NOTE') THEN
    RETURN QUERY SELECT 'NOT_VOICE_REPLY'::text; RETURN;
  END IF;
  -- Every hint must name an offset inside the reply.
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_hints) e(h)
              WHERE (e.h ->> 'offset')::integer >= char_length(v_reply.content)) THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  INSERT INTO voice_private.reply_speech_hints (assistant_turn_id, user_id, expression, hints)
  VALUES (p_assistant_turn_id, p_user_id, p_expression, p_hints)
  ON CONFLICT ON CONSTRAINT reply_speech_hints_pk DO NOTHING;
  IF FOUND THEN RETURN QUERY SELECT 'RECORDED'::text; RETURN; END IF;
  RETURN QUERY SELECT 'ALREADY_RECORDED'::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. LISTEN (service_role, on the authenticated user's behalf). No call to any provider happens in the database; the API
--    calls Google only between a successful ADMITTED and its complete / fail.
-- ---------------------------------------------------------------------------------------------------------------------

-- The reply's text and channel for rendering, after every eligibility check (gate, consent, owner, voice-note reply).
CREATE FUNCTION public.server_read_reply_for_listen_v1(p_user_id uuid, p_assistant_turn_id uuid)
RETURNS TABLE (outcome text, content text, expression text, hints jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e record;
BEGIN
  IF p_user_id IS NULL OR p_assistant_turn_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT * INTO e FROM voice_private.voice_reply_eligibility_v1(p_user_id, p_assistant_turn_id);
  IF e.outcome <> 'ELIGIBLE' THEN RETURN QUERY SELECT e.outcome, NULL::text, NULL::text, NULL::jsonb; RETURN; END IF;
  RETURN QUERY
    SELECT 'ELIGIBLE'::text, e.content, coalesce(h.expression, 'CALM'), coalesce(h.hints, '[]'::jsonb)
      FROM (SELECT 1) one
      LEFT JOIN voice_private.reply_speech_hints h ON h.assistant_turn_id = p_assistant_turn_id AND h.user_id = p_user_id;
END$$;

-- Starts (or replays) a listen of `p_segment_count` segments. Costless. A different earlier listen of the user is replaced:
-- its segments still synthesizing become DISCARDED (kept until their call settles), the rest are deleted.
CREATE FUNCTION public.server_start_reply_listen_v1(p_user_id uuid, p_assistant_turn_id uuid, p_listen_id uuid,
  p_segment_count integer, p_renderer_version text)
RETURNS TABLE (outcome text, segment_count integer, expires_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e record;
  policy record;
  v_existing voice_private.reply_speech_segments;
  v_now timestamptz;
  v_expires timestamptz;
BEGIN
  SELECT * INTO policy FROM voice_private.reply_listen_policy_v1();
  IF p_user_id IS NULL OR p_assistant_turn_id IS NULL OR p_listen_id IS NULL OR p_segment_count IS NULL
     OR p_segment_count < 1 OR p_segment_count > policy.max_segments
     OR p_renderer_version IS NULL OR p_renderer_version !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM voice_private.lock_reply_listen_v1(p_user_id);
  SELECT * INTO e FROM voice_private.voice_reply_eligibility_v1(p_user_id, p_assistant_turn_id);
  IF e.outcome <> 'ELIGIBLE' THEN RETURN QUERY SELECT e.outcome, NULL::integer, NULL::timestamptz; RETURN; END IF;
  SELECT * INTO v_existing FROM voice_private.reply_speech_segments s
   WHERE s.user_id = p_user_id AND s.listen_id = p_listen_id ORDER BY s.segment_index LIMIT 1;
  IF FOUND THEN
    IF v_existing.assistant_turn_id <> p_assistant_turn_id OR v_existing.segment_count <> p_segment_count
       OR v_existing.renderer_version <> p_renderer_version THEN
      RETURN QUERY SELECT 'LISTEN_CONFLICT'::text, NULL::integer, NULL::timestamptz; RETURN;
    END IF;
    IF v_existing.expires_at <= clock_timestamp() THEN
      RETURN QUERY SELECT 'EXPIRED'::text, NULL::integer, NULL::timestamptz; RETURN;
    END IF;
    RETURN QUERY SELECT 'ALREADY_STARTED'::text, v_existing.segment_count, v_existing.expires_at; RETURN;
  END IF;
  -- One active listen per user: the earlier one is replaced.
  UPDATE voice_private.reply_speech_segments s SET state = 'DISCARDED', updated_at = clock_timestamp()
   WHERE s.user_id = p_user_id AND s.state = 'SYNTHESIZING';
  DELETE FROM voice_private.reply_speech_segments s WHERE s.user_id = p_user_id AND s.state <> 'DISCARDED';
  v_now := clock_timestamp();
  v_expires := v_now + policy.listen_ttl;
  INSERT INTO voice_private.reply_speech_segments (user_id, listen_id, segment_index, assistant_turn_id, session_id,
                                                   segment_count, renderer_version, created_at, expires_at)
  SELECT p_user_id, p_listen_id, i, p_assistant_turn_id, e.session_id, p_segment_count, p_renderer_version, v_now, v_expires
    FROM generate_series(0, p_segment_count - 1) i;
  RETURN QUERY SELECT 'STARTED'::text, p_segment_count, v_expires;
END$$;

-- Admits ONE paid synthesis of one segment: in one transaction the segment becomes SYNTHESIZING with its lease and the
-- ledger row is written PENDING. A repeat never admits again: READY, IN_PROGRESS or FAILED answers it, free.
CREATE FUNCTION public.server_admit_reply_speech_synthesis_v1(p_user_id uuid, p_listen_id uuid, p_segment_index integer,
  p_call_id uuid, p_requested_model text, p_lease_seconds integer)
RETURNS TABLE (outcome text, call_id uuid, assistant_turn_id uuid, segment_count integer, renderer_version text,
               content text, expression text, hints jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  policy record;
  seg voice_private.reply_speech_segments;
  e record;
  v_busy integer;
BEGIN
  SELECT * INTO policy FROM voice_private.reply_listen_policy_v1();
  IF p_user_id IS NULL OR p_listen_id IS NULL OR p_segment_index IS NULL OR p_call_id IS NULL OR p_requested_model IS NULL
     OR p_requested_model !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
     OR p_lease_seconds IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > policy.max_lease_seconds THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM voice_private.lock_reply_listen_v1(p_user_id);
  SELECT * INTO seg FROM voice_private.reply_speech_segments s
   WHERE s.user_id = p_user_id AND s.listen_id = p_listen_id AND s.segment_index = p_segment_index FOR UPDATE;
  IF NOT FOUND OR seg.state = 'DISCARDED' OR seg.expires_at <= clock_timestamp() THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::text, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;
  IF seg.state <> 'PENDING' THEN
    RETURN QUERY SELECT CASE seg.state WHEN 'READY' THEN 'READY' WHEN 'SYNTHESIZING' THEN 'IN_PROGRESS' ELSE 'FAILED' END,
                        seg.call_id, seg.assistant_turn_id, seg.segment_count, seg.renderer_version,
                        NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;
  SELECT * INTO e FROM voice_private.voice_reply_eligibility_v1(p_user_id, seg.assistant_turn_id);
  IF e.outcome <> 'ELIGIBLE' THEN
    RETURN QUERY SELECT e.outcome, NULL::uuid, NULL::uuid, NULL::integer, NULL::text, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;
  SELECT count(*)::integer INTO v_busy FROM voice_private.reply_speech_segments s
   WHERE s.user_id = p_user_id AND s.state IN ('SYNTHESIZING', 'DISCARDED');
  IF v_busy >= policy.max_synthesizing_per_user THEN
    RETURN QUERY SELECT 'BUSY'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::text, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ai_provider_calls c WHERE c.id = p_call_id) THEN
    RAISE EXCEPTION 'AI_PROVIDER_CALL_IDENTITY_CONFLICT' USING ERRCODE = 'PT409';
  END IF;
  PERFORM voice_private.begin_reply_speech_call_v1(p_call_id, p_user_id, e.session_id, seg.assistant_turn_id, p_requested_model);
  UPDATE voice_private.reply_speech_segments s
     SET state = 'SYNTHESIZING', call_id = p_call_id, attempts = 1,
         lease_until = clock_timestamp() + make_interval(secs => p_lease_seconds), updated_at = clock_timestamp()
   WHERE s.user_id = p_user_id AND s.listen_id = p_listen_id AND s.segment_index = p_segment_index;
  RETURN QUERY
    SELECT 'ADMITTED'::text, p_call_id, seg.assistant_turn_id, seg.segment_count, seg.renderer_version, e.content,
           coalesce(h.expression, 'CALM'), coalesce(h.hints, '[]'::jsonb)
      FROM (SELECT 1) one
      LEFT JOIN voice_private.reply_speech_hints h ON h.assistant_turn_id = seg.assistant_turn_id AND h.user_id = p_user_id;
END$$;

-- The ONE retry (§9.3: before any audio, on a transient answer): its own ledger row. Allowed only while the segment is
-- synthesizing under `p_failed_call_id`, that call is already settled, and no retry was taken.
CREATE FUNCTION public.server_retry_reply_speech_synthesis_v1(p_user_id uuid, p_listen_id uuid, p_segment_index integer,
  p_failed_call_id uuid, p_call_id uuid, p_requested_model text, p_lease_seconds integer)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  policy record;
  seg voice_private.reply_speech_segments;
BEGIN
  SELECT * INTO policy FROM voice_private.reply_listen_policy_v1();
  IF p_user_id IS NULL OR p_listen_id IS NULL OR p_segment_index IS NULL OR p_failed_call_id IS NULL OR p_call_id IS NULL
     OR p_requested_model IS NULL OR p_requested_model !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
     OR p_lease_seconds IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > policy.max_lease_seconds THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM voice_private.lock_reply_listen_v1(p_user_id);
  SELECT * INTO seg FROM voice_private.reply_speech_segments s
   WHERE s.user_id = p_user_id AND s.listen_id = p_listen_id AND s.segment_index = p_segment_index FOR UPDATE;
  IF NOT FOUND OR seg.state <> 'SYNTHESIZING' OR seg.call_id <> p_failed_call_id OR seg.attempts >= policy.max_attempts
     OR seg.expires_at <= clock_timestamp()
     OR EXISTS (SELECT 1 FROM public.ai_provider_calls c WHERE c.id = p_failed_call_id AND c.call_state = 'PENDING') THEN
    RETURN QUERY SELECT 'NOT_ALLOWED'::text; RETURN;
  END IF;
  PERFORM voice_private.begin_reply_speech_call_v1(p_call_id, p_user_id, seg.session_id, seg.assistant_turn_id, p_requested_model);
  UPDATE voice_private.reply_speech_segments s
     SET call_id = p_call_id, attempts = seg.attempts + 1,
         lease_until = clock_timestamp() + make_interval(secs => p_lease_seconds), updated_at = clock_timestamp()
   WHERE s.user_id = p_user_id AND s.listen_id = p_listen_id AND s.segment_index = p_segment_index;
  RETURN QUERY SELECT 'RETRY_BEGUN'::text;
END$$;

-- Completes a synthesis: the call settles SUCCEEDED (usage as reported, or ABSENT - never zero) and, in the same
-- transaction, the audio is kept READY - unless the listen was cancelled, replaced or expired meanwhile, in which case the
-- audio is dropped. The settlement happens whatever became of the segment.
CREATE FUNCTION public.server_complete_reply_speech_synthesis_v1(p_user_id uuid, p_call_id uuid, p_audio bytea,
  p_usage_completeness text, p_usage jsonb)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  policy record;
  seg voice_private.reply_speech_segments;
BEGIN
  SELECT * INTO policy FROM voice_private.reply_listen_policy_v1();
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_audio IS NULL
     OR octet_length(p_audio) < 45 OR octet_length(p_audio) > policy.max_audio_bytes THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM voice_private.lock_reply_listen_v1(p_user_id);
  PERFORM public.settle_ai_provider_call_v2(p_call_id, p_user_id, 'SUCCEEDED', p_usage_completeness, p_usage, 'PROVIDER_REPORTED');
  SELECT * INTO seg FROM voice_private.reply_speech_segments s WHERE s.user_id = p_user_id AND s.call_id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'DROPPED'::text; RETURN; END IF;
  -- A replay of a completion already applied (the settlement above answered ALREADY_SETTLED).
  IF seg.state = 'READY' THEN RETURN QUERY SELECT 'READY'::text; RETURN; END IF;
  IF seg.state = 'SYNTHESIZING' AND seg.expires_at > clock_timestamp() THEN
    UPDATE voice_private.reply_speech_segments s
       SET state = 'READY', audio = p_audio, lease_until = NULL, updated_at = clock_timestamp()
     WHERE s.user_id = seg.user_id AND s.listen_id = seg.listen_id AND s.segment_index = seg.segment_index;
    RETURN QUERY SELECT 'READY'::text; RETURN;
  END IF;
  IF seg.state IN ('SYNTHESIZING', 'DISCARDED') THEN
    DELETE FROM voice_private.reply_speech_segments s
     WHERE s.user_id = seg.user_id AND s.listen_id = seg.listen_id AND s.segment_index = seg.segment_index;
  END IF;
  RETURN QUERY SELECT 'DROPPED'::text;
END$$;

-- A failed attempt: the call settles (FAILED, or CANCELLED_BEFORE_PROVIDER when no request left), and when `p_final` the
-- segment is FAILED (a discarded one is deleted). A non-final failure keeps the segment for the one retry.
CREATE FUNCTION public.server_fail_reply_speech_synthesis_v1(p_user_id uuid, p_call_id uuid, p_outcome text,
  p_usage_completeness text, p_usage jsonb, p_final boolean)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  seg voice_private.reply_speech_segments;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_final IS NULL OR p_outcome IS NULL
     OR p_outcome NOT IN ('FAILED', 'CANCELLED_BEFORE_PROVIDER') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM voice_private.lock_reply_listen_v1(p_user_id);
  PERFORM public.settle_ai_provider_call_v2(p_call_id, p_user_id, p_outcome, p_usage_completeness, p_usage, 'PROVIDER_REPORTED');
  SELECT * INTO seg FROM voice_private.reply_speech_segments s WHERE s.user_id = p_user_id AND s.call_id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'DROPPED'::text; RETURN; END IF;
  IF seg.state = 'DISCARDED' OR (seg.state = 'SYNTHESIZING' AND seg.expires_at <= clock_timestamp()) THEN
    DELETE FROM voice_private.reply_speech_segments s
     WHERE s.user_id = seg.user_id AND s.listen_id = seg.listen_id AND s.segment_index = seg.segment_index;
    RETURN QUERY SELECT 'DROPPED'::text; RETURN;
  END IF;
  IF seg.state = 'SYNTHESIZING' AND p_final THEN
    UPDATE voice_private.reply_speech_segments s SET state = 'FAILED', lease_until = NULL, updated_at = clock_timestamp()
     WHERE s.user_id = seg.user_id AND s.listen_id = seg.listen_id AND s.segment_index = seg.segment_index;
    RETURN QUERY SELECT 'FAILED'::text; RETURN;
  END IF;
  RETURN QUERY SELECT CASE WHEN seg.state = 'SYNTHESIZING' THEN 'RETRYABLE' ELSE seg.state END;
END$$;

-- A segment's audio, from the store only. Never starts any provider work. Ownership, listen and expiry are checked; the
-- gate and consent are re-checked, so a withdrawal stops playback of what is stored too.
CREATE FUNCTION public.server_read_reply_speech_audio_v1(p_user_id uuid, p_listen_id uuid, p_segment_index integer)
RETURNS TABLE (outcome text, audio bytea)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  seg voice_private.reply_speech_segments;
BEGIN
  IF p_user_id IS NULL OR p_listen_id IS NULL OR p_segment_index IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO seg FROM voice_private.reply_speech_segments s
   WHERE s.user_id = p_user_id AND s.listen_id = p_listen_id AND s.segment_index = p_segment_index;
  IF NOT FOUND OR seg.state = 'DISCARDED' OR seg.expires_at <= clock_timestamp() THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bytea; RETURN;
  END IF;
  IF NOT voice_private.capability_enabled_v1('PERSONAL_VOICE_NOTE') THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::bytea; RETURN;
  END IF;
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'CONSENT_REQUIRED'::text, NULL::bytea; RETURN;
  END IF;
  RETURN QUERY SELECT CASE seg.state WHEN 'READY' THEN 'READY' WHEN 'SYNTHESIZING' THEN 'IN_PROGRESS'
                                     WHEN 'PENDING' THEN 'NOT_STARTED' ELSE 'FAILED' END,
                      CASE WHEN seg.state = 'READY' THEN seg.audio END;
END$$;

-- Cancels a listen: its stored audio is deleted now; a segment still synthesizing is DISCARDED until its call settles.
CREATE FUNCTION public.server_cancel_reply_listen_v1(p_user_id uuid, p_listen_id uuid)
RETURNS TABLE (outcome text, deleted integer, discarded integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_discarded integer;
  v_deleted integer;
BEGIN
  IF p_user_id IS NULL OR p_listen_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  PERFORM voice_private.lock_reply_listen_v1(p_user_id);
  UPDATE voice_private.reply_speech_segments s SET state = 'DISCARDED', updated_at = clock_timestamp()
   WHERE s.user_id = p_user_id AND s.listen_id = p_listen_id AND s.state = 'SYNTHESIZING';
  GET DIAGNOSTICS v_discarded = ROW_COUNT;
  DELETE FROM voice_private.reply_speech_segments s
   WHERE s.user_id = p_user_id AND s.listen_id = p_listen_id AND s.state <> 'DISCARDED';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN QUERY SELECT 'CANCELLED'::text, v_deleted, v_discarded;
END$$;

-- The sweeper (§8.3): an expired lease is a crash - its call settles FAILED with usage ABSENT (FAILED_USAGE_UNKNOWN) and
-- the segment is FAILED_UNKNOWN, never re-synthesized; a stale PENDING synthesis call with no segment (its reply or listen
-- left meanwhile) settles the same way; every expired segment is deleted.
CREATE FUNCTION public.server_sweep_reply_speech_v1(p_limit integer)
RETURNS TABLE (leases_expired integer, calls_settled integer, segments_deleted integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  policy record;
  seg record;
  pending_call record;
  v_leases integer := 0;
  v_calls integer := 0;
  v_deleted integer := 0;
BEGIN
  SELECT * INTO policy FROM voice_private.reply_listen_policy_v1();
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  FOR seg IN SELECT s.user_id, s.listen_id, s.segment_index, s.call_id, s.state FROM voice_private.reply_speech_segments s
              WHERE s.state IN ('SYNTHESIZING', 'DISCARDED') AND s.lease_until < clock_timestamp()
              ORDER BY s.lease_until LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
    PERFORM voice_private.settle_reply_speech_call_unknown_v1(seg.call_id);
    IF seg.state = 'DISCARDED' THEN
      DELETE FROM voice_private.reply_speech_segments s
       WHERE s.user_id = seg.user_id AND s.listen_id = seg.listen_id AND s.segment_index = seg.segment_index;
    ELSE
      UPDATE voice_private.reply_speech_segments s SET state = 'FAILED_UNKNOWN', lease_until = NULL, updated_at = clock_timestamp()
       WHERE s.user_id = seg.user_id AND s.listen_id = seg.listen_id AND s.segment_index = seg.segment_index;
    END IF;
    v_leases := v_leases + 1;
  END LOOP;
  FOR pending_call IN SELECT c.id FROM public.ai_provider_calls c
               WHERE c.call_state = 'PENDING' AND c.operation = 'GEMINI_SPEECH_GENERATION' AND c.feature_family = 'SPEECH_SYNTHESIS'
                 AND c.source_turn_id IS NOT NULL
                 AND c.started_at < clock_timestamp() - make_interval(secs => policy.stale_call_seconds)
                 AND NOT EXISTS (SELECT 1 FROM voice_private.reply_speech_segments s WHERE s.call_id = c.id)
               ORDER BY c.started_at LIMIT p_limit LOOP
    PERFORM voice_private.settle_reply_speech_call_unknown_v1(pending_call.id);
    v_calls := v_calls + 1;
  END LOOP;
  WITH gone AS (
    DELETE FROM voice_private.reply_speech_segments s
     WHERE (s.user_id, s.listen_id, s.segment_index) IN (
       SELECT x.user_id, x.listen_id, x.segment_index FROM voice_private.reply_speech_segments x
        WHERE x.expires_at <= clock_timestamp() AND x.state NOT IN ('SYNTHESIZING', 'DISCARDED')
        ORDER BY x.expires_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
    RETURNING 1)
  SELECT count(*)::integer INTO v_deleted FROM gone;
  RETURN QUERY SELECT v_leases, v_calls, v_deleted;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. THE APPROVED CONSENT TEXT V2 (Copy Gate K-01 ... K-15, Product Owner, 2026-11-01): each row on its own line, verbatim.
--    VOICE_RECORDING_V1 stays installed, unchanged, not current.
-- ---------------------------------------------------------------------------------------------------------------------
SELECT voice_private.install_consent_text_v1('VOICE_RECORDING_V2',
$consent_ar$التسجيل الصوتي وصوت قنديل
تُحفظ كل رسالة صوتية تُرسل إلى قنديل تسجيلًا صوتيًا. وإذا استخدمت المكالمات مع قنديل عند توفرها، تُحفظ كل مكالمة تسجيلًا صوتيًا يشمل صوت قنديل كما سُمع فيها.
تُحفظ الرسالة الصوتية 30 يومًا من وصولها إلى قنديل، وتُحفظ المكالمة 30 يومًا من بدايتها، ثم يُحذف التسجيل تلقائيًا. ويمكن حذف أي تسجيل قبل ذلك.
يُحوَّل الكلام إلى نص يفهمه قنديل ويرد عليه، ويمكن الاستماع إلى التسجيل طوال مدة حفظه.
عندما يصبح الصوت متاحًا في إعادة عرض المحادثة، يمكن استخدام التسجيل فيها خلال مدة حفظه، وبطلب منك فقط.
يبقى النص المستخرج في المحادثة بعد حذف التسجيل أو انتهاء مدته، ويبقى ما تذكّره قنديل منه حتى يُصحَّح أو يُطلب نسيانه.
تحوّل خدمة Speechmatics الكلام إلى نص، ويطلب قنديل منها حذف التسجيل بعد التحويل مباشرة.
عند الضغط على «استمع»، وفي المكالمات عند توفرها، يُرسل نص رد قنديل إلى Google لتحويله إلى صوت. ولا تُرسل تسجيلاتك إلى Google. وقد يتضمن نص الرد شيئًا مما قلته.
لا تستخدم Google هذا النص لتدريب نماذجها. وقد تحتفظ بالنصوص التي ترصدها أنظمتها كإساءة استخدام محتملة مدة تصل إلى 90 يومًا، وقد يراجعها موظفون مخوّلون لديها وفق شروط خدمتها.
لا يراجع أحد في قنديل تسجيلاتك أو محتواك الصوتي.
قد يلتقط التسجيل أصواتًا قريبة.
النسخة التي تُنزَّل أو تُشارَك تخرج من قنديل ولا يمكن استرجاعها.
يمكن سحب الموافقة في أي وقت من الإعدادات. سحبها يوقف الرسائل الصوتية الجديدة والمكالمات و«استمع»، ولا يحذف التسجيلات الحالية.
أوافق وأتابع
ليس الآن$consent_ar$,
$consent_en$Voice recording and Qandeel's voice
Each voice message sent to Qandeel is kept as an audio recording. If you use calls with Qandeel once they're available, each call is kept as an audio recording that includes Qandeel's voice as heard in it.
A voice message is kept for 30 days after it reaches Qandeel, and a call for 30 days from its start; then the recording is deleted automatically. Any recording can be deleted sooner.
Speech is converted to text that Qandeel understands and replies to, and the recording can be listened to while it's kept.
When audio becomes available in Conversation replay, a recording can be used in it while it's kept, and only when you ask.
The transcribed text stays in the conversation after the recording is deleted or expires, and what Qandeel remembers from it stays until it's corrected or forgotten on request.
Speechmatics converts speech to text, and Qandeel asks it to delete the recording right after conversion.
When you press Listen, and in calls once they're available, the text of Qandeel's reply is sent to Google to turn it into speech. Your recordings aren't sent to Google. The reply text may include something you said.
Google doesn't use this text to train its models. It may keep text its systems flag as possible misuse for up to 90 days, and authorized Google staff may review it under Google's service terms.
No one at Qandeel reviews your recordings or voice content.
A recording may capture nearby voices.
A downloaded or shared copy leaves Qandeel and cannot be recalled.
Consent can be withdrawn at any time in Settings. Withdrawing it stops new voice messages, calls and Listen, and doesn't delete existing recordings.
Agree and continue
Not now$consent_en$);

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. ACCOUNT ERASURE COVERAGE: both relations cascade from the account row (and from their assistant turn).
-- ---------------------------------------------------------------------------------------------------------------------
INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('voice_private.reply_speech_hints', 'ACCOUNT_CASCADE'),
    ('voice_private.reply_speech_segments', 'ACCOUNT_CASCADE');

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. OWNERSHIP, RLS AND ACL. Both relations: postgres-owned, RLS on, no policy, revoked from every role. Every new function:
--    postgres-owned, revoked from every role; the server_* definers are granted to service_role only.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  rel text;
  fn text;
  r text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['voice_private.reply_speech_hints', 'voice_private.reply_speech_segments'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', rel);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', rel);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', rel);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', rel, r);
      END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'voice_private.reply_listen_policy_v1()',
    'voice_private.reply_speech_hints_valid_v1(jsonb)',
    'voice_private.voice_reply_eligibility_v1(uuid,uuid)',
    'voice_private.lock_reply_listen_v1(uuid)',
    'voice_private.begin_reply_speech_call_v1(uuid,uuid,uuid,uuid,text)',
    'voice_private.settle_reply_speech_call_unknown_v1(uuid)',
    'public.server_record_reply_speech_channel_v1(uuid,uuid,text,jsonb)',
    'public.server_read_reply_for_listen_v1(uuid,uuid)',
    'public.server_start_reply_listen_v1(uuid,uuid,uuid,integer,text)',
    'public.server_admit_reply_speech_synthesis_v1(uuid,uuid,integer,uuid,text,integer)',
    'public.server_retry_reply_speech_synthesis_v1(uuid,uuid,integer,uuid,uuid,text,integer)',
    'public.server_complete_reply_speech_synthesis_v1(uuid,uuid,bytea,text,jsonb)',
    'public.server_fail_reply_speech_synthesis_v1(uuid,uuid,text,text,jsonb,boolean)',
    'public.server_read_reply_speech_audio_v1(uuid,uuid,integer)',
    'public.server_cancel_reply_listen_v1(uuid,uuid)',
    'public.server_sweep_reply_speech_v1(integer)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r);
      END IF;
    END LOOP;
    IF fn LIKE 'public.server\_%' AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. DEPLOY GUARD: the shape this migration promises, checked where it is installed.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  -- G1. All four capability scopes are still closed: this migration opens nothing.
  IF (SELECT count(*) FROM voice_private.voice_launch_capability_states s
       WHERE s.feature_flag_state = 'DISABLED' AND s.launch_requirements_state = 'UNSATISFIED') <> 4
     OR (SELECT count(*) FROM voice_private.voice_launch_capability_states) <> 4 THEN
    RAISE EXCEPTION 'S8B-04: every voice capability scope must remain DISABLED / UNSATISFIED';
  END IF;
  -- G2. Exactly the two approved texts: V2 current (K-01 ... K-15), V1 historical and unchanged (C-01 ... C-11).
  IF (SELECT count(*) FROM voice_private.consent_texts) <> 2
     OR NOT EXISTS (SELECT 1 FROM voice_private.consent_texts t
                     WHERE t.purpose = 'VOICE_RECORDING' AND t.version = 'VOICE_RECORDING_V2' AND t.is_current
                       AND t.text_ar_sha256 = '84b546b49ed718f683bc38388c9191310da125b853a6d6d0e2a97466d3141740'
                       AND t.text_en_sha256 = 'c3297ff4142651fb7b175060172c92769570ca636ec3f0572d15bb479dc5ccce')
     OR NOT EXISTS (SELECT 1 FROM voice_private.consent_texts t
                     WHERE t.purpose = 'VOICE_RECORDING' AND t.version = 'VOICE_RECORDING_V1' AND NOT t.is_current
                       AND t.text_ar_sha256 = '1c2f6a050372da5175a918d040c1259031df798beff5eacfd2a947f3dc4d3f3d'
                       AND t.text_en_sha256 = 'ea01b715e384c14a239f4e18c0366d77006bb86d931ff326ee95e93c88bd1426') THEN
    RAISE EXCEPTION 'S8B-04: VOICE_RECORDING_V2 must be the current approved text and VOICE_RECORDING_V1 historical and unchanged';
  END IF;
  -- G3. Every relation referencing the account or a voice relation is registered.
  SELECT count(*) INTO v_count FROM pg_constraint c
   WHERE c.contype = 'f'
     AND (c.confrelid = 'public.users'::regclass
          OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g
                                              WHERE g.coverage = 'VOICE'))
     AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'S8B-04: a relation referencing the account or a voice relation is missing from the coverage registry';
  END IF;
  -- G4. No application role reaches a voice relation, and no client role executes a new definer.
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'voice_private' AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC'))
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE (n.nspname = 'public' AND p.proname IN (
                          'server_record_reply_speech_channel_v1', 'server_read_reply_for_listen_v1', 'server_start_reply_listen_v1',
                          'server_admit_reply_speech_synthesis_v1', 'server_retry_reply_speech_synthesis_v1',
                          'server_complete_reply_speech_synthesis_v1', 'server_fail_reply_speech_synthesis_v1',
                          'server_read_reply_speech_audio_v1', 'server_cancel_reply_listen_v1', 'server_sweep_reply_speech_v1'))
                   AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))) THEN
    RAISE EXCEPTION 'S8B-04: a voice relation or a Listen definer is reachable by a client role';
  END IF;
END$$;

COMMIT;
