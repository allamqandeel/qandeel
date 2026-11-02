-- S8B-04 CP2 — the automatic voice reply and the Fast Voice Path (PO decisions D-S1 .. D-S5 and the feasibility decision
-- of 2026-11-01: accept-first, a single continuous audio stream per reply with a server-announced final length), APPROVED
-- at the CP2 gate (2026-11-02: D1 … D8). Bound by the Fast Voice Path controlled amendment FVP v1.0 (Personal Voice Notes
-- only). Not hosted: every voice gate stays DISABLED.
--
-- ## What is added
--
--   A. voice_private.live_voice_notes: one realtime transcription session DURING a recording (D-S1). Admitted only with
--      the person's CURRENT consent (V3, which discloses it), the gate, an ACTIVE text session and the work budget; one
--      open per person; its provider-call ledger row (SPEECHMATICS realtime, GATEWAY_MEASURED audio) begins in the same
--      transaction and settles when it closes. No text column: the words never reach the database here.
--   B. server_accept_live_voice_note_v1: accept v1 (unchanged, called inside) AND the transcription row READY with the
--      live transcript, in ONE transaction - only for a live note of the same person and session, so the batch claim can
--      never race it. voice_private.note_live_transcriptions records which live note a READY transcript came from.
--   C. voice_private.live_reply_streams / live_reply_segments: the automatic voice reply of a committed voice-note turn
--      (D-S3). One stream per turn (a second open is refused: no double paid reply); one ledger row per synthesis attempt,
--      bound to the voice-note USER turn (its assistant turn does not exist yet); at most two synthesizing per person
--      across Listen and live replies; no retry after an UNKNOWN outcome; PCM kept 15 minutes, then deleted; the final
--      length recorded only as a contiguous READY prefix.
--   D. voice_private.voice_note_reply_deliveries + server_finalize_voice_note_withheld_tail_v1 (D-S2): a reply whose rest
--      failed the release guard after a part may have been heard is stored as exactly that part, its delivery recorded
--      WITHHELD_TAIL with the reason, and the turn completed WITHOUT a ConversationTurnCompleted event: no Memory and no
--      post-response intelligence ever reads an incomplete reply. The 0063 trigger releases any SELECTED question.
--   E. The sweep (expired leases settle FAILED usage unknown and are never re-synthesized; expired streams deleted;
--      abandoned live notes settled).
--   F. VOICE_RECORDING_V3, APPROVED verbatim (2026-11-02, D3; K-07 v1.1), installed as the one current version in this
--      same transaction (D4): no consent to V1 or V2 reaches a live note or an automatic reply. V1 and V2 stay
--      byte-identical history; no consent is carried over.
--   G. Account erasure coverage for every new user-scoped relation (ACCOUNT_CASCADE).
--
-- ## What is deliberately NOT here
--
--   * No gate is opened; no client role executes any new definer; nothing is applied to a hosted database.
--   * No earlier statement is replaced. Accept v1, commit v1, finalize v2 and the 0187 Listen definers are unchanged.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. CONTROLLED CONSTANTS.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION voice_private.fast_voice_policy_v1(
  OUT live_note_max interval, OUT reply_ttl interval, OUT max_segments integer, OUT max_synthesizing_per_user integer,
  OUT max_attempts integer, OUT max_segment_bytes integer, OUT max_lease_seconds integer)
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  -- A live note lives at most the recording's ceiling plus slack; a reply's audio 15 minutes; 24 segments (the 0187
  -- renderer's 16 per reply plus room for a long voice-note answer); PCM 24 kHz s16 mono, 3 MiB ≈ 65 s per segment.
  SELECT interval '12 minutes', interval '15 minutes', 24, 2, 2, 3145728, 120
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. LIVE VOICE NOTES (D-S1). RLS on, no policy, no role.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.live_voice_notes (
  live_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  call_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'OPEN',
  audio_ms bigint,
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_at timestamptz,
  CONSTRAINT live_voice_notes_pk PRIMARY KEY (live_id),
  CONSTRAINT live_voice_notes_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT live_voice_notes_session_fk FOREIGN KEY (session_id) REFERENCES public.conversation_sessions (id) ON DELETE CASCADE,
  CONSTRAINT live_voice_notes_call_key UNIQUE (call_id),
  CONSTRAINT live_voice_notes_state_check CHECK (state IN ('OPEN', 'FINISHED', 'CANCELLED', 'FAILED')),
  CONSTRAINT live_voice_notes_shape_check CHECK ((state = 'OPEN') = (closed_at IS NULL) AND (audio_ms IS NULL OR audio_ms BETWEEN 0 AND 720000))
);
CREATE INDEX live_voice_notes_user_idx ON voice_private.live_voice_notes (user_id);
CREATE INDEX live_voice_notes_session_idx ON voice_private.live_voice_notes (session_id);
CREATE UNIQUE INDEX live_voice_notes_one_open_idx ON voice_private.live_voice_notes (user_id) WHERE state = 'OPEN';

-- Which live note a READY transcript came from (provenance; the transcript itself lives only in note_transcriptions until
-- the commit moves it into the turn, exactly as on the batch path).
CREATE TABLE voice_private.note_live_transcriptions (
  recording_id uuid NOT NULL,
  user_id uuid NOT NULL,
  live_id uuid NOT NULL,
  adopted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT note_live_transcriptions_pk PRIMARY KEY (recording_id),
  CONSTRAINT note_live_transcriptions_note_fk FOREIGN KEY (recording_id) REFERENCES voice_private.note_transcriptions (recording_id) ON DELETE CASCADE,
  CONSTRAINT note_live_transcriptions_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT note_live_transcriptions_live_key UNIQUE (live_id)
);
CREATE INDEX note_live_transcriptions_user_idx ON voice_private.note_live_transcriptions (user_id);

CREATE FUNCTION voice_private.lock_live_voice_v1(p_user_id uuid) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.live-voice.v1:' || p_user_id::text, 0));
$$;

-- Settles a live note's realtime call with the audio the gateway sent (never a provider-billed claim), or usage unknown.
CREATE FUNCTION voice_private.settle_live_voice_note_call_v1(p_call_id uuid, p_user_id uuid, p_failed boolean, p_audio_ms bigint) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ai_provider_calls c WHERE c.id = p_call_id AND c.call_state = 'PENDING') THEN RETURN; END IF;
  IF p_audio_ms IS NULL THEN
    PERFORM public.settle_ai_provider_call_v2(p_call_id, p_user_id, 'FAILED', 'ABSENT', '{}'::jsonb, 'PROVIDER_REPORTED');
  ELSE
    PERFORM public.settle_ai_provider_call_v2(p_call_id, p_user_id, CASE WHEN p_failed THEN 'FAILED' ELSE 'SUCCEEDED' END,
      'COMPLETE', pg_catalog.jsonb_build_object('AUDIO_INPUT_MS', p_audio_ms), 'GATEWAY_MEASURED');
  END IF;
END$$;

CREATE FUNCTION public.server_open_live_voice_note_v1(p_user_id uuid, p_session_id uuid, p_live_id uuid, p_call_id uuid,
  p_requested_model text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_session public.conversation_sessions;
  v_existing voice_private.live_voice_notes;
  v_previous voice_private.live_voice_notes;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_live_id IS NULL OR p_call_id IS NULL OR p_requested_model IS NULL
     OR p_requested_model !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM voice_private.lock_live_voice_v1(p_user_id);
  SELECT * INTO v_existing FROM voice_private.live_voice_notes n WHERE n.live_id = p_live_id;
  IF FOUND THEN
    RETURN QUERY SELECT CASE WHEN v_existing.user_id = p_user_id AND v_existing.state = 'OPEN' THEN 'OPENED' ELSE 'NOT_FOUND' END;
    RETURN;
  END IF;
  SELECT * INTO v_session FROM public.conversation_sessions s WHERE s.id = p_session_id AND s.user_id = p_user_id;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text; RETURN; END IF;
  IF v_session.status <> 'ACTIVE' OR v_session.channel <> 'TEXT' THEN RETURN QUERY SELECT 'SESSION_NOT_ACTIVE'::text; RETURN; END IF;
  IF NOT voice_private.capability_enabled_v1('PERSONAL_VOICE_NOTE') OR public.conversation_turn_work_budget_spent_v1(p_user_id) THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text; RETURN;
  END IF;
  -- GRANTED_CURRENT means the CURRENT version: once V3 is current, a V2 grant is not enough (V3 discloses this flow).
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN RETURN QUERY SELECT 'CONSENT_REQUIRED'::text; RETURN; END IF;
  -- One live note per person: an abandoned one (a crashed phone) closes now, its call settled with usage unknown.
  FOR v_previous IN SELECT * FROM voice_private.live_voice_notes n WHERE n.user_id = p_user_id AND n.state = 'OPEN' FOR UPDATE LOOP
    UPDATE voice_private.live_voice_notes n SET state = 'CANCELLED', closed_at = clock_timestamp() WHERE n.live_id = v_previous.live_id;
    PERFORM voice_private.settle_live_voice_note_call_v1(v_previous.call_id, p_user_id, true, NULL);
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.ai_provider_calls c WHERE c.id = p_call_id) THEN
    RAISE EXCEPTION 'AI_PROVIDER_CALL_IDENTITY_CONFLICT' USING ERRCODE = 'PT409';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.ai-provider-call.v1:' || p_user_id::text, 0));
  INSERT INTO public.ai_provider_calls (id, user_id, session_id, source_turn_id, provider, requested_model, operation,
                                        feature_family, processing_path, attempt_number, call_state, started_at)
  VALUES (p_call_id, p_user_id, p_session_id, NULL, 'SPEECHMATICS', p_requested_model, 'SPEECHMATICS_REALTIME_TRANSCRIPTION',
          'VOICE_NOTE_TRANSCRIPTION', NULL, 1, 'PENDING', clock_timestamp());
  INSERT INTO voice_private.live_voice_notes (live_id, user_id, session_id, call_id) VALUES (p_live_id, p_user_id, p_session_id, p_call_id);
  RETURN QUERY SELECT 'OPENED'::text;
END$$;

CREATE FUNCTION public.server_close_live_voice_note_v1(p_user_id uuid, p_live_id uuid, p_state text, p_audio_ms bigint)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_note voice_private.live_voice_notes;
BEGIN
  IF p_user_id IS NULL OR p_live_id IS NULL OR p_state IS NULL OR p_state NOT IN ('FINISHED', 'CANCELLED', 'FAILED')
     OR (p_audio_ms IS NOT NULL AND p_audio_ms NOT BETWEEN 0 AND 720000) THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM voice_private.lock_live_voice_v1(p_user_id);
  SELECT * INTO v_note FROM voice_private.live_voice_notes n WHERE n.live_id = p_live_id AND n.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text; RETURN; END IF;
  IF v_note.state <> 'OPEN' THEN RETURN QUERY SELECT 'ALREADY_CLOSED'::text; RETURN; END IF;
  UPDATE voice_private.live_voice_notes n SET state = p_state, audio_ms = p_audio_ms, closed_at = clock_timestamp()
   WHERE n.live_id = p_live_id;
  PERFORM voice_private.settle_live_voice_note_call_v1(v_note.call_id, p_user_id, p_state = 'FAILED', p_audio_ms);
  RETURN QUERY SELECT 'CLOSED'::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. ACCEPT + LIVE TRANSCRIPT, ONE TRANSACTION (accept-first, PO condition 6).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_accept_live_voice_note_v1(p_user_id uuid, p_recording_id uuid, p_byte_size bigint, p_live_id uuid,
  p_duration_ms bigint, p_transcript text, p_band text, p_uncertain_tokens text[], p_transcript_sha256 text)
RETURNS TABLE (outcome text, accepted_at timestamptz, retention_expires_at timestamptz, transcript_state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a record;
  v_recording voice_private.recordings;
  v_live voice_private.live_voice_notes;
  v_state text;
BEGIN
  IF p_user_id IS NULL OR p_recording_id IS NULL OR p_byte_size IS NULL OR p_live_id IS NULL
     OR p_duration_ms IS NULL OR p_duration_ms NOT BETWEEN 1 AND 601000
     OR p_transcript IS NULL OR length(btrim(p_transcript)) = 0 OR length(p_transcript) > 20000
     -- Only a transcript the batch rule classified HIGH or MEDIUM is ever offered; LOW goes to the batch path.
     OR p_band IS NULL OR p_band NOT IN ('HIGH', 'MEDIUM')
     OR p_uncertain_tokens IS NULL OR cardinality(p_uncertain_tokens) > 64 OR array_position(p_uncertain_tokens, NULL) IS NOT NULL
     OR EXISTS (SELECT 1 FROM unnest(p_uncertain_tokens) u(t) WHERE length(u.t) NOT BETWEEN 1 AND 64)
     OR p_transcript_sha256 IS DISTINCT FROM encode(sha256(convert_to(p_transcript, 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO a FROM public.server_accept_voice_note_v1(p_user_id, p_recording_id, p_byte_size);
  IF a.outcome IS DISTINCT FROM 'ACCEPTED' THEN
    RETURN QUERY SELECT a.outcome, a.accepted_at, a.retention_expires_at, NULL::text; RETURN;
  END IF;
  SELECT * INTO v_recording FROM voice_private.recordings r WHERE r.id = p_recording_id AND r.user_id = p_user_id;
  SELECT * INTO v_live FROM voice_private.live_voice_notes n WHERE n.live_id = p_live_id AND n.user_id = p_user_id;
  -- The live note must be this person's, heard in this recording's session, and not cancelled or failed.
  IF v_live.live_id IS NULL OR v_live.session_id <> v_recording.session_id OR v_live.state NOT IN ('OPEN', 'FINISHED')
     OR NOT voice_private.capability_enabled_v1('PERSONAL_VOICE_NOTE')
     OR voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT a.outcome, a.accepted_at, a.retention_expires_at, NULL::text; RETURN;
  END IF;
  INSERT INTO voice_private.note_transcriptions (recording_id, user_id, session_id, state, duration_ms, transcript_text,
                                                 transcript_sha256, asr_confidence_band, uncertain_tokens)
  VALUES (p_recording_id, p_user_id, v_recording.session_id, 'READY', p_duration_ms, p_transcript, p_transcript_sha256,
          p_band, p_uncertain_tokens)
  ON CONFLICT ON CONSTRAINT note_transcriptions_pk DO NOTHING;
  IF FOUND THEN
    INSERT INTO voice_private.note_live_transcriptions (recording_id, user_id, live_id) VALUES (p_recording_id, p_user_id, p_live_id);
    v_state := 'READY';
  ELSE
    -- A replay of an accepted note: whatever its transcription already is stands (never overwritten).
    SELECT CASE WHEN n.state = 'READY' THEN 'READY' END INTO v_state FROM voice_private.note_transcriptions n
     WHERE n.recording_id = p_recording_id;
  END IF;
  RETURN QUERY SELECT a.outcome, a.accepted_at, a.retention_expires_at, v_state;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE AUTOMATIC VOICE REPLY (D-S3). PCM only, no text column. RLS on, no policy, no role.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.live_reply_streams (
  reply_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  source_turn_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'STREAMING',
  segment_count integer,
  audio_ms bigint,
  assistant_turn_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  finished_at timestamptz,
  CONSTRAINT live_reply_streams_pk PRIMARY KEY (reply_id),
  CONSTRAINT live_reply_streams_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT live_reply_streams_turn_fk FOREIGN KEY (source_turn_id) REFERENCES public.conversation_turns (id) ON DELETE CASCADE,
  CONSTRAINT live_reply_streams_assistant_fk FOREIGN KEY (assistant_turn_id) REFERENCES public.conversation_turns (id) ON DELETE CASCADE,
  -- One automatic reply per voice-note turn: a duplicate, a reconnect or a re-render never opens a second paid reply.
  CONSTRAINT live_reply_streams_turn_key UNIQUE (source_turn_id),
  CONSTRAINT live_reply_streams_state_check CHECK (state IN ('STREAMING', 'COMPLETE', 'WITHHELD_TAIL', 'FAILED', 'CANCELLED')),
  CONSTRAINT live_reply_streams_shape_check CHECK (
    (state = 'STREAMING') = (finished_at IS NULL)
    AND (state = 'STREAMING') = (segment_count IS NULL)
    AND (state = 'STREAMING') = (audio_ms IS NULL)
    AND (segment_count IS NULL OR segment_count BETWEEN 0 AND 24)
    AND (audio_ms IS NULL OR audio_ms >= 0)
    AND ((state IN ('COMPLETE', 'WITHHELD_TAIL')) = (assistant_turn_id IS NOT NULL))),
  CONSTRAINT live_reply_streams_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX live_reply_streams_user_idx ON voice_private.live_reply_streams (user_id);
CREATE INDEX live_reply_streams_expiry_idx ON voice_private.live_reply_streams (expires_at);
CREATE INDEX live_reply_streams_assistant_idx ON voice_private.live_reply_streams (assistant_turn_id) WHERE assistant_turn_id IS NOT NULL;

CREATE TABLE voice_private.live_reply_segments (
  user_id uuid NOT NULL,
  reply_id uuid NOT NULL,
  segment_index integer NOT NULL,
  state text NOT NULL,
  call_id uuid NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  pcm bytea,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT live_reply_segments_pk PRIMARY KEY (user_id, reply_id, segment_index),
  CONSTRAINT live_reply_segments_stream_fk FOREIGN KEY (reply_id) REFERENCES voice_private.live_reply_streams (reply_id) ON DELETE CASCADE,
  CONSTRAINT live_reply_segments_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT live_reply_segments_call_key UNIQUE (call_id),
  CONSTRAINT live_reply_segments_index_check CHECK (segment_index BETWEEN 0 AND 23),
  CONSTRAINT live_reply_segments_state_check CHECK (state IN ('SYNTHESIZING', 'READY', 'FAILED', 'FAILED_UNKNOWN', 'DISCARDED')),
  CONSTRAINT live_reply_segments_attempts_check CHECK (attempts BETWEEN 1 AND 2),
  CONSTRAINT live_reply_segments_pcm_check CHECK (pcm IS NULL OR (octet_length(pcm) BETWEEN 2 AND 3145728 AND octet_length(pcm) % 2 = 0)),
  CONSTRAINT live_reply_segments_shape_check CHECK (
    CASE state
      WHEN 'SYNTHESIZING' THEN pcm IS NULL AND lease_until IS NOT NULL
      WHEN 'DISCARDED' THEN pcm IS NULL AND lease_until IS NOT NULL
      WHEN 'READY' THEN pcm IS NOT NULL AND lease_until IS NULL
      ELSE pcm IS NULL AND lease_until IS NULL
    END)
);
CREATE INDEX live_reply_segments_user_idx ON voice_private.live_reply_segments (user_id);
CREATE INDEX live_reply_segments_lease_idx ON voice_private.live_reply_segments (lease_until) WHERE state IN ('SYNTHESIZING', 'DISCARDED');

-- The source turn: the owner's own USER turn of a voice note, in its session.
CREATE FUNCTION voice_private.live_reply_source_ok_v1(p_user_id uuid, p_session_id uuid, p_source_turn_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_turns t
                   JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = t.id AND vs.user_id = t.user_id
                  WHERE t.id = p_source_turn_id AND t.user_id = p_user_id AND t.session_id = p_session_id AND t.role = 'USER'
                    AND vs.source_role = 'USER' AND vs.source_modality = 'VOICE_NOTE')
$$;

CREATE FUNCTION public.server_open_live_reply_v1(p_user_id uuid, p_reply_id uuid, p_session_id uuid, p_source_turn_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  policy record;
BEGIN
  SELECT * INTO policy FROM voice_private.fast_voice_policy_v1();
  IF p_user_id IS NULL OR p_reply_id IS NULL OR p_session_id IS NULL OR p_source_turn_id IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM voice_private.lock_reply_listen_v1(p_user_id);
  IF EXISTS (SELECT 1 FROM voice_private.live_reply_streams s WHERE s.reply_id = p_reply_id OR s.source_turn_id = p_source_turn_id)
     OR NOT voice_private.live_reply_source_ok_v1(p_user_id, p_session_id, p_source_turn_id)
     OR NOT voice_private.capability_enabled_v1('PERSONAL_VOICE_NOTE')
     OR voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'REFUSED'::text; RETURN;
  END IF;
  INSERT INTO voice_private.live_reply_streams (reply_id, user_id, session_id, source_turn_id, expires_at)
  VALUES (p_reply_id, p_user_id, p_session_id, p_source_turn_id, clock_timestamp() + policy.reply_ttl);
  RETURN QUERY SELECT 'OPENED'::text;
END$$;

-- ONE paid attempt: the segment SYNTHESIZING and its ledger row PENDING, in one transaction. The bound of two synthesizing
-- per person counts Listen (0187) and live replies together.
CREATE FUNCTION public.server_admit_live_reply_segment_v1(p_user_id uuid, p_reply_id uuid, p_segment_index integer, p_call_id uuid,
  p_requested_model text, p_spoken_chars integer, p_lease_seconds integer)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  policy record;
  v_stream voice_private.live_reply_streams;
  v_busy integer;
BEGIN
  SELECT * INTO policy FROM voice_private.fast_voice_policy_v1();
  IF p_user_id IS NULL OR p_reply_id IS NULL OR p_segment_index IS NULL OR p_segment_index NOT BETWEEN 0 AND policy.max_segments - 1
     OR p_call_id IS NULL OR p_requested_model IS NULL OR p_requested_model !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
     OR p_spoken_chars IS NULL OR p_spoken_chars NOT BETWEEN 1 AND 4000
     OR p_lease_seconds IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > policy.max_lease_seconds THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM voice_private.lock_reply_listen_v1(p_user_id);
  SELECT * INTO v_stream FROM voice_private.live_reply_streams s WHERE s.reply_id = p_reply_id AND s.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_stream.state <> 'STREAMING' OR v_stream.expires_at <= clock_timestamp()
     OR EXISTS (SELECT 1 FROM voice_private.live_reply_segments g
                 WHERE g.user_id = p_user_id AND g.reply_id = p_reply_id AND g.segment_index = p_segment_index)
     OR NOT voice_private.capability_enabled_v1('PERSONAL_VOICE_NOTE')
     OR voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'GONE'::text; RETURN;
  END IF;
  SELECT (SELECT count(*) FROM voice_private.reply_speech_segments s WHERE s.user_id = p_user_id AND s.state IN ('SYNTHESIZING', 'DISCARDED'))
       + (SELECT count(*) FROM voice_private.live_reply_segments g WHERE g.user_id = p_user_id AND g.state IN ('SYNTHESIZING', 'DISCARDED'))
    INTO v_busy;
  IF v_busy >= policy.max_synthesizing_per_user THEN RETURN QUERY SELECT 'BUSY'::text; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.ai_provider_calls c WHERE c.id = p_call_id) THEN
    RAISE EXCEPTION 'AI_PROVIDER_CALL_IDENTITY_CONFLICT' USING ERRCODE = 'PT409';
  END IF;
  -- The ledger row is bound to the voice-note USER turn: the reply's assistant turn does not exist while it is spoken.
  PERFORM voice_private.begin_reply_speech_call_v1(p_call_id, p_user_id, v_stream.session_id, v_stream.source_turn_id, p_requested_model);
  INSERT INTO voice_private.live_reply_segments (user_id, reply_id, segment_index, state, call_id, attempts, lease_until)
  VALUES (p_user_id, p_reply_id, p_segment_index, 'SYNTHESIZING', p_call_id, 1, clock_timestamp() + make_interval(secs => p_lease_seconds));
  RETURN QUERY SELECT 'ADMITTED'::text;
END$$;

-- The ONE retry: before any audio, after a known failure whose call is already settled, while the reply streams.
CREATE FUNCTION public.server_retry_live_reply_segment_v1(p_user_id uuid, p_reply_id uuid, p_segment_index integer,
  p_previous_call_id uuid, p_call_id uuid, p_requested_model text, p_lease_seconds integer)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  policy record;
  v_stream voice_private.live_reply_streams;
  seg voice_private.live_reply_segments;
BEGIN
  SELECT * INTO policy FROM voice_private.fast_voice_policy_v1();
  IF p_user_id IS NULL OR p_reply_id IS NULL OR p_segment_index IS NULL OR p_previous_call_id IS NULL OR p_call_id IS NULL
     OR p_requested_model IS NULL OR p_requested_model !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
     OR p_lease_seconds IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > policy.max_lease_seconds THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM voice_private.lock_reply_listen_v1(p_user_id);
  SELECT * INTO v_stream FROM voice_private.live_reply_streams s WHERE s.reply_id = p_reply_id AND s.user_id = p_user_id;
  SELECT * INTO seg FROM voice_private.live_reply_segments g
   WHERE g.user_id = p_user_id AND g.reply_id = p_reply_id AND g.segment_index = p_segment_index FOR UPDATE;
  IF v_stream.reply_id IS NULL OR v_stream.state <> 'STREAMING' OR v_stream.expires_at <= clock_timestamp()
     OR seg.call_id IS NULL OR seg.state <> 'SYNTHESIZING' OR seg.call_id <> p_previous_call_id OR seg.attempts >= policy.max_attempts
     OR NOT EXISTS (SELECT 1 FROM public.ai_provider_calls c
                     WHERE c.id = p_previous_call_id AND c.call_state IN ('FAILED_USAGE_UNKNOWN', 'FAILED_USAGE_REPORTED', 'CANCELLED_BEFORE_PROVIDER')) THEN
    RETURN QUERY SELECT 'GONE'::text; RETURN;
  END IF;
  PERFORM voice_private.begin_reply_speech_call_v1(p_call_id, p_user_id, v_stream.session_id, v_stream.source_turn_id, p_requested_model);
  UPDATE voice_private.live_reply_segments g
     SET call_id = p_call_id, attempts = seg.attempts + 1,
         lease_until = clock_timestamp() + make_interval(secs => p_lease_seconds), updated_at = clock_timestamp()
   WHERE g.user_id = p_user_id AND g.reply_id = p_reply_id AND g.segment_index = p_segment_index;
  RETURN QUERY SELECT 'RETRY_BEGUN'::text;
END$$;

-- Complete: the call settles SUCCEEDED (as reported, or ABSENT - never zero) and the PCM is kept READY in the same
-- transaction, unless the reply was cancelled or expired meanwhile (then the audio is dropped; the settlement stands).
CREATE FUNCTION public.server_complete_live_reply_segment_v1(p_user_id uuid, p_call_id uuid, p_pcm bytea,
  p_usage_completeness text, p_usage jsonb)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  policy record;
  seg voice_private.live_reply_segments;
  v_stream voice_private.live_reply_streams;
BEGIN
  SELECT * INTO policy FROM voice_private.fast_voice_policy_v1();
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_pcm IS NULL OR octet_length(p_pcm) < 2 OR octet_length(p_pcm) % 2 <> 0
     OR octet_length(p_pcm) > policy.max_segment_bytes THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM voice_private.lock_reply_listen_v1(p_user_id);
  PERFORM public.settle_ai_provider_call_v2(p_call_id, p_user_id, 'SUCCEEDED', p_usage_completeness, p_usage, 'PROVIDER_REPORTED');
  SELECT * INTO seg FROM voice_private.live_reply_segments g WHERE g.user_id = p_user_id AND g.call_id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'GONE'::text; RETURN; END IF;
  IF seg.state = 'READY' THEN RETURN QUERY SELECT 'READY'::text; RETURN; END IF;
  SELECT * INTO v_stream FROM voice_private.live_reply_streams s WHERE s.reply_id = seg.reply_id;
  IF seg.state = 'SYNTHESIZING' AND v_stream.state = 'STREAMING' AND v_stream.expires_at > clock_timestamp() THEN
    UPDATE voice_private.live_reply_segments g SET state = 'READY', pcm = p_pcm, lease_until = NULL, updated_at = clock_timestamp()
     WHERE g.user_id = seg.user_id AND g.reply_id = seg.reply_id AND g.segment_index = seg.segment_index;
    RETURN QUERY SELECT 'READY'::text; RETURN;
  END IF;
  IF seg.state IN ('SYNTHESIZING', 'DISCARDED') THEN
    DELETE FROM voice_private.live_reply_segments g
     WHERE g.user_id = seg.user_id AND g.reply_id = seg.reply_id AND g.segment_index = seg.segment_index;
  END IF;
  RETURN QUERY SELECT 'GONE'::text;
END$$;

-- A failed attempt. UNKNOWN (audio may have been produced and billed) settles FAILED with usage unknown and is ALWAYS
-- final (FAILED_UNKNOWN): never re-synthesized. FAILED / CANCELLED_BEFORE_PROVIDER keep the segment for the one retry
-- unless `p_final`.
CREATE FUNCTION public.server_fail_live_reply_segment_v1(p_user_id uuid, p_call_id uuid, p_outcome text, p_final boolean)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  seg voice_private.live_reply_segments;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_final IS NULL OR p_outcome IS NULL
     OR p_outcome NOT IN ('FAILED', 'CANCELLED_BEFORE_PROVIDER', 'UNKNOWN') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM voice_private.lock_reply_listen_v1(p_user_id);
  PERFORM public.settle_ai_provider_call_v2(p_call_id, p_user_id, CASE WHEN p_outcome = 'UNKNOWN' THEN 'FAILED' ELSE p_outcome END,
                                            'ABSENT', '{}'::jsonb, 'PROVIDER_REPORTED');
  SELECT * INTO seg FROM voice_private.live_reply_segments g WHERE g.user_id = p_user_id AND g.call_id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'FAILED'::text; RETURN; END IF;
  IF seg.state = 'DISCARDED' THEN
    DELETE FROM voice_private.live_reply_segments g
     WHERE g.user_id = seg.user_id AND g.reply_id = seg.reply_id AND g.segment_index = seg.segment_index;
    RETURN QUERY SELECT 'FAILED'::text; RETURN;
  END IF;
  IF seg.state = 'SYNTHESIZING' AND (p_final OR p_outcome = 'UNKNOWN') THEN
    UPDATE voice_private.live_reply_segments g
       SET state = CASE WHEN p_outcome = 'UNKNOWN' THEN 'FAILED_UNKNOWN' ELSE 'FAILED' END, lease_until = NULL, updated_at = clock_timestamp()
     WHERE g.user_id = seg.user_id AND g.reply_id = seg.reply_id AND g.segment_index = seg.segment_index;
    RETURN QUERY SELECT 'FAILED'::text; RETURN;
  END IF;
  RETURN QUERY SELECT CASE WHEN seg.state = 'SYNTHESIZING' THEN 'RETRYABLE' ELSE 'FAILED' END;
END$$;

-- Finish: the reply's final state and length. The length is a contiguous READY prefix the database verifies; segments
-- after it are not part of the audio (READY ones deleted, synthesizing ones DISCARDED until their call settles). A
-- COMPLETE or WITHHELD_TAIL reply names its assistant turn, which must answer this voice-note turn.
CREATE FUNCTION public.server_finish_live_reply_v1(p_user_id uuid, p_reply_id uuid, p_state text, p_segment_count integer,
  p_audio_ms bigint, p_assistant_turn_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_stream voice_private.live_reply_streams;
  v_ready integer;
BEGIN
  IF p_user_id IS NULL OR p_reply_id IS NULL OR p_state IS NULL OR p_state NOT IN ('COMPLETE', 'WITHHELD_TAIL', 'FAILED', 'CANCELLED')
     OR p_segment_count IS NULL OR p_segment_count NOT BETWEEN 0 AND 24 OR p_audio_ms IS NULL OR p_audio_ms < 0
     OR ((p_state IN ('COMPLETE', 'WITHHELD_TAIL')) <> (p_assistant_turn_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM voice_private.lock_reply_listen_v1(p_user_id);
  SELECT * INTO v_stream FROM voice_private.live_reply_streams s WHERE s.reply_id = p_reply_id AND s.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text; RETURN; END IF;
  IF v_stream.state <> 'STREAMING' THEN RETURN QUERY SELECT 'ALREADY_FINISHED'::text; RETURN; END IF;
  IF p_assistant_turn_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.conversation_turns t WHERE t.id = p_assistant_turn_id AND t.user_id = p_user_id
          AND t.role = 'ASSISTANT' AND t.source_turn_id = v_stream.source_turn_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT count(*)::integer INTO v_ready FROM voice_private.live_reply_segments g
   WHERE g.user_id = p_user_id AND g.reply_id = p_reply_id AND g.segment_index < p_segment_count AND g.state = 'READY';
  IF v_ready <> p_segment_count THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  UPDATE voice_private.live_reply_segments g SET state = 'DISCARDED', updated_at = clock_timestamp()
   WHERE g.user_id = p_user_id AND g.reply_id = p_reply_id AND g.segment_index >= p_segment_count AND g.state = 'SYNTHESIZING';
  DELETE FROM voice_private.live_reply_segments g
   WHERE g.user_id = p_user_id AND g.reply_id = p_reply_id AND g.segment_index >= p_segment_count AND g.state <> 'DISCARDED';
  UPDATE voice_private.live_reply_streams s
     SET state = p_state, segment_count = p_segment_count, audio_ms = p_audio_ms, assistant_turn_id = p_assistant_turn_id,
         finished_at = clock_timestamp()
   WHERE s.reply_id = p_reply_id;
  RETURN QUERY SELECT 'FINISHED'::text;
END$$;

-- Status: content-free. Expired: nothing.
CREATE FUNCTION public.server_read_live_reply_v1(p_user_id uuid, p_reply_id uuid)
RETURNS TABLE (state text, segment_count integer, audio_ms bigint, assistant_turn_id uuid, segments jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_reply_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
    SELECT s.state, s.segment_count, s.audio_ms, s.assistant_turn_id,
           coalesce((SELECT jsonb_agg(jsonb_build_object('index', g.segment_index, 'state', g.state) ORDER BY g.segment_index)
                       FROM voice_private.live_reply_segments g WHERE g.user_id = p_user_id AND g.reply_id = s.reply_id), '[]'::jsonb)
      FROM voice_private.live_reply_streams s
     WHERE s.reply_id = p_reply_id AND s.user_id = p_user_id AND s.expires_at > clock_timestamp();
END$$;

-- One segment's PCM from the store only (never provider work). The gate and consent are re-checked: a withdrawal stops
-- playback of what is stored too.
CREATE FUNCTION public.server_read_live_reply_segment_v1(p_user_id uuid, p_reply_id uuid, p_segment_index integer)
RETURNS TABLE (outcome text, pcm bytea)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  seg voice_private.live_reply_segments;
BEGIN
  IF p_user_id IS NULL OR p_reply_id IS NULL OR p_segment_index IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT g.* INTO seg FROM voice_private.live_reply_segments g
    JOIN voice_private.live_reply_streams s ON s.reply_id = g.reply_id AND s.user_id = g.user_id
   WHERE g.user_id = p_user_id AND g.reply_id = p_reply_id AND g.segment_index = p_segment_index AND s.expires_at > clock_timestamp();
  IF NOT FOUND OR seg.state <> 'READY' THEN RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bytea; RETURN; END IF;
  IF NOT voice_private.capability_enabled_v1('PERSONAL_VOICE_NOTE') THEN RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::bytea; RETURN; END IF;
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN RETURN QUERY SELECT 'CONSENT_REQUIRED'::text, NULL::bytea; RETURN; END IF;
  RETURN QUERY SELECT 'READY'::text, seg.pcm;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. THE WITHHELD TAIL (D-S2).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.voice_note_reply_deliveries (
  assistant_turn_id uuid NOT NULL,
  user_id uuid NOT NULL,
  source_turn_id uuid NOT NULL,
  delivery text NOT NULL,
  reason text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT voice_note_reply_deliveries_pk PRIMARY KEY (assistant_turn_id),
  CONSTRAINT voice_note_reply_deliveries_turn_fk FOREIGN KEY (assistant_turn_id) REFERENCES public.conversation_turns (id) ON DELETE CASCADE,
  CONSTRAINT voice_note_reply_deliveries_source_fk FOREIGN KEY (source_turn_id) REFERENCES public.conversation_turns (id) ON DELETE CASCADE,
  CONSTRAINT voice_note_reply_deliveries_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT voice_note_reply_deliveries_delivery_check CHECK (delivery = 'WITHHELD_TAIL'),
  CONSTRAINT voice_note_reply_deliveries_reason_check CHECK (reason IN (
    'EMPTY', 'UNREADABLE', 'INTERNAL_CONTAINER', 'GUIDANCE_ECHO', 'MARKUP_MALFORMED', 'PROVIDER_FAILED', 'TRUNCATED'))
);
CREATE INDEX voice_note_reply_deliveries_user_idx ON voice_private.voice_note_reply_deliveries (user_id);
CREATE INDEX voice_note_reply_deliveries_source_idx ON voice_private.voice_note_reply_deliveries (source_turn_id);

-- finalize_conversation_turn_v2's assistant insert and user completion, for a VOICE_NOTE turn only, WITHOUT the
-- ConversationTurnCompleted outbox event and without a question binding (any SELECTED one is RELEASED by the 0063 trigger
-- in this same transaction). A turn that is no longer GENERATING writes nothing.
CREATE FUNCTION public.server_finalize_voice_note_withheld_tail_v1(p_session_id uuid, p_user_id uuid, p_source_turn_id uuid,
  p_assistant_turn_id uuid, p_content text, p_safety_disposition text, p_reason text, p_correlation_id uuid DEFAULT NULL,
  p_orchestration_id uuid DEFAULT NULL)
RETURNS TABLE (user_turn jsonb, assistant_turn jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  source_row public.conversation_turns;
  assistant_row public.conversation_turns;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_source_turn_id IS NULL OR p_assistant_turn_id IS NULL
     OR p_content IS NULL OR length(btrim(p_content)) = 0 OR p_safety_disposition IS NULL OR p_safety_disposition NOT IN ('ALLOW', 'GUIDED')
     OR p_reason IS NULL OR p_reason NOT IN ('EMPTY', 'UNREADABLE', 'INTERNAL_CONTAINER', 'GUIDANCE_ECHO', 'MARKUP_MALFORMED',
                                             'PROVIDER_FAILED', 'TRUNCATED') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_sessions s WHERE s.id = p_session_id AND s.user_id = p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO source_row FROM public.conversation_turns
   WHERE id = p_source_turn_id AND session_id = p_session_id AND user_id = p_user_id AND role = 'USER' AND status = 'GENERATING' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT voice_private.live_reply_source_ok_v1(p_user_id, p_session_id, p_source_turn_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, source_turn_id, completed_at)
  VALUES (p_assistant_turn_id, p_session_id, p_user_id, 'ASSISTANT', 'COMPLETED', p_content, source_row.processing_path,
          source_row.routing_reason, p_source_turn_id, CURRENT_TIMESTAMP)
  RETURNING * INTO assistant_row;
  INSERT INTO voice_private.voice_note_reply_deliveries (assistant_turn_id, user_id, source_turn_id, delivery, reason)
  VALUES (p_assistant_turn_id, p_user_id, p_source_turn_id, 'WITHHELD_TAIL', p_reason);
  UPDATE public.conversation_turns SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
   WHERE id = p_source_turn_id RETURNING * INTO source_row;
  RETURN QUERY SELECT to_jsonb(source_row), to_jsonb(assistant_row);
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. THE SWEEP.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_sweep_fast_voice_v1(p_limit integer)
RETURNS TABLE (leases_expired integer, replies_deleted integer, live_notes_closed integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  policy record;
  seg record;
  note record;
  v_leases integer := 0;
  v_replies integer := 0;
  v_notes integer := 0;
BEGIN
  SELECT * INTO policy FROM voice_private.fast_voice_policy_v1();
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  FOR seg IN SELECT g.user_id, g.reply_id, g.segment_index, g.call_id, g.state FROM voice_private.live_reply_segments g
              WHERE g.state IN ('SYNTHESIZING', 'DISCARDED') AND g.lease_until < clock_timestamp()
              ORDER BY g.lease_until LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
    PERFORM voice_private.settle_reply_speech_call_unknown_v1(seg.call_id);
    IF seg.state = 'DISCARDED' THEN
      DELETE FROM voice_private.live_reply_segments g
       WHERE g.user_id = seg.user_id AND g.reply_id = seg.reply_id AND g.segment_index = seg.segment_index;
    ELSE
      UPDATE voice_private.live_reply_segments g SET state = 'FAILED_UNKNOWN', lease_until = NULL, updated_at = clock_timestamp()
       WHERE g.user_id = seg.user_id AND g.reply_id = seg.reply_id AND g.segment_index = seg.segment_index;
    END IF;
    v_leases := v_leases + 1;
  END LOOP;
  -- An expired reply leaves with its stored audio, once no attempt of it is still running.
  WITH gone AS (
    DELETE FROM voice_private.live_reply_streams s
     WHERE s.reply_id IN (SELECT x.reply_id FROM voice_private.live_reply_streams x
                           WHERE x.expires_at <= clock_timestamp()
                             AND NOT EXISTS (SELECT 1 FROM voice_private.live_reply_segments g
                                              WHERE g.reply_id = x.reply_id AND g.state IN ('SYNTHESIZING', 'DISCARDED'))
                           ORDER BY x.expires_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
    RETURNING 1)
  SELECT count(*)::integer INTO v_replies FROM gone;
  -- A live note still open past the recording's ceiling was abandoned (the server restarted): closed, usage unknown.
  FOR note IN SELECT n.live_id, n.user_id, n.call_id FROM voice_private.live_voice_notes n
               WHERE n.state = 'OPEN' AND n.opened_at < clock_timestamp() - policy.live_note_max
               ORDER BY n.opened_at LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
    UPDATE voice_private.live_voice_notes n SET state = 'FAILED', closed_at = clock_timestamp() WHERE n.live_id = note.live_id;
    PERFORM voice_private.settle_live_voice_note_call_v1(note.call_id, note.user_id, true, NULL);
    v_notes := v_notes + 1;
  END LOOP;
  RETURN QUERY SELECT v_leases, v_replies, v_notes;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. VOICE_RECORDING_V3 — K-01 … K-15, one row per line, in order: V2 with K-07, K-08 and K-13 replaced, as APPROVED by
--    the Product Owner (2026-11-02). install_consent_text_v1 (0183) makes V2 historical and V3 current. V1 and V2 are
--    untouched. The deploy guard pins the digests; apps/api/src/voice-media/voice-consent-text.ts carries the same rows.
-- ---------------------------------------------------------------------------------------------------------------------
SELECT voice_private.install_consent_text_v1(
  'VOICE_RECORDING_V3',
  $consent_ar$التسجيل الصوتي وصوت قنديل
تُحفظ كل رسالة صوتية تُرسل إلى قنديل تسجيلًا صوتيًا. وإذا استخدمت المكالمات مع قنديل عند توفرها، تُحفظ كل مكالمة تسجيلًا صوتيًا يشمل صوت قنديل كما سُمع فيها.
تُحفظ الرسالة الصوتية 30 يومًا من وصولها إلى قنديل، وتُحفظ المكالمة 30 يومًا من بدايتها، ثم يُحذف التسجيل تلقائيًا. ويمكن حذف أي تسجيل قبل ذلك.
يُحوَّل الكلام إلى نص يفهمه قنديل ويرد عليه، ويمكن الاستماع إلى التسجيل طوال مدة حفظه.
عندما يصبح الصوت متاحًا في إعادة عرض المحادثة، يمكن استخدام التسجيل فيها خلال مدة حفظه، وبطلب منك فقط.
يبقى النص المستخرج في المحادثة بعد حذف التسجيل أو انتهاء مدته، ويبقى ما تذكّره قنديل منه حتى يُصحَّح أو يُطلب نسيانه.
تحوّل خدمة Speechmatics الكلام إلى نص. أثناء تسجيل رسالة صوتية يُرسل صوتك إليها مباشرةً لتحويله لحظيًا، قبل الضغط على «إرسال»، ليصل الرد أسرع؛ ووفق شروطها تعالج هذا الصوت اللحظي في الذاكرة دون حفظه. وبعد الإرسال قد يُرسل إليها التسجيل المحفوظ أيضًا لتحويله، ويطلب قنديل منها حذفه بعد التحويل مباشرة. ولم يأذن لها قنديل باستخدام صوتك في تدريب نماذجها. وإذا ألغيت الرسالة قبل إرسالها، لا يُنشئ قنديل منها رسالة ولا يتذكر منها شيئًا، أما ما وصل إلى الخدمة قبل الإلغاء فيكون قد عولج بالفعل.
عندما ترسل رسالة صوتية، يرد قنديل بصوته تلقائيًا: يُرسل نص الرد إلى Google لتحويله إلى صوت أثناء كتابته. ويحدث ذلك أيضًا عند الضغط على «استمع»، وفي المكالمات عند توفرها. ولا تُرسل تسجيلاتك إلى Google. وقد يتضمن نص الرد شيئًا مما قلته. ويُحفظ صوت الرد التلقائي 15 دقيقة لإعادة الاستماع، ثم يُحذف.
لا تستخدم Google هذا النص لتدريب نماذجها. وقد تحتفظ بالنصوص التي ترصدها أنظمتها كإساءة استخدام محتملة مدة تصل إلى 90 يومًا، وقد يراجعها موظفون مخوّلون لديها وفق شروط خدمتها.
لا يراجع أحد في قنديل تسجيلاتك أو محتواك الصوتي.
قد يلتقط التسجيل أصواتًا قريبة.
النسخة التي تُنزَّل أو تُشارَك تخرج من قنديل ولا يمكن استرجاعها.
يمكن سحب الموافقة في أي وقت من الإعدادات. سحبها يوقف الرسائل الصوتية الجديدة والردود الصوتية والمكالمات و«استمع»، ولا يحذف التسجيلات الحالية.
أوافق وأتابع
ليس الآن$consent_ar$,
  $consent_en$Voice recording and Qandeel's voice
Each voice message sent to Qandeel is kept as an audio recording. If you use calls with Qandeel once they're available, each call is kept as an audio recording that includes Qandeel's voice as heard in it.
A voice message is kept for 30 days after it reaches Qandeel, and a call for 30 days from its start; then the recording is deleted automatically. Any recording can be deleted sooner.
Speech is converted to text that Qandeel understands and replies to, and the recording can be listened to while it's kept.
When audio becomes available in Conversation replay, a recording can be used in it while it's kept, and only when you ask.
The transcribed text stays in the conversation after the recording is deleted or expires, and what Qandeel remembers from it stays until it's corrected or forgotten on request.
Speechmatics converts speech to text. While you record a voice message, your voice is streamed to it for live conversion, before you press Send, so the reply comes faster; under its terms, it processes this live audio in memory without storing it. After you send, the saved recording may also be sent to it for conversion, and Qandeel asks it to delete that recording right after conversion. Qandeel hasn't allowed it to use your audio to train its models. If you cancel a message before sending it, Qandeel creates no message and remembers nothing from it, but whatever already reached the service before you cancelled has already been processed.
When you send a voice message, Qandeel replies in its voice automatically: the text of its reply is sent to Google to turn it into speech as it's written. This also happens when you press Listen, and in calls once they're available. Your recordings aren't sent to Google. The reply text may include something you said. The audio of an automatic reply is kept for 15 minutes so you can play it again, then deleted.
Google doesn't use this text to train its models. It may keep text its systems flag as possible misuse for up to 90 days, and authorized Google staff may review it under Google's service terms.
No one at Qandeel reviews your recordings or voice content.
A recording may capture nearby voices.
A downloaded or shared copy leaves Qandeel and cannot be recalled.
Consent can be withdrawn at any time in Settings. Withdrawing it stops new voice messages, spoken replies, calls and Listen, and doesn't delete existing recordings.
Agree and continue
Not now$consent_en$
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. ACCOUNT ERASURE COVERAGE.
-- ---------------------------------------------------------------------------------------------------------------------
INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('voice_private.live_voice_notes', 'ACCOUNT_CASCADE'),
    ('voice_private.note_live_transcriptions', 'ACCOUNT_CASCADE'),
    ('voice_private.live_reply_streams', 'ACCOUNT_CASCADE'),
    ('voice_private.live_reply_segments', 'ACCOUNT_CASCADE'),
    ('voice_private.voice_note_reply_deliveries', 'ACCOUNT_CASCADE');

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. OWNERSHIP, RLS AND ACL.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  rel text;
  fn text;
  r text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['voice_private.live_voice_notes', 'voice_private.note_live_transcriptions',
                             'voice_private.live_reply_streams', 'voice_private.live_reply_segments',
                             'voice_private.voice_note_reply_deliveries'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', rel);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', rel);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', rel);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', rel, r); END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'voice_private.fast_voice_policy_v1()',
    'voice_private.lock_live_voice_v1(uuid)',
    'voice_private.settle_live_voice_note_call_v1(uuid,uuid,boolean,bigint)',
    'voice_private.live_reply_source_ok_v1(uuid,uuid,uuid)',
    'public.server_open_live_voice_note_v1(uuid,uuid,uuid,uuid,text)',
    'public.server_close_live_voice_note_v1(uuid,uuid,text,bigint)',
    'public.server_accept_live_voice_note_v1(uuid,uuid,bigint,uuid,bigint,text,text,text[],text)',
    'public.server_open_live_reply_v1(uuid,uuid,uuid,uuid)',
    'public.server_admit_live_reply_segment_v1(uuid,uuid,integer,uuid,text,integer,integer)',
    'public.server_retry_live_reply_segment_v1(uuid,uuid,integer,uuid,uuid,text,integer)',
    'public.server_complete_live_reply_segment_v1(uuid,uuid,bytea,text,jsonb)',
    'public.server_fail_live_reply_segment_v1(uuid,uuid,text,boolean)',
    'public.server_finish_live_reply_v1(uuid,uuid,text,integer,bigint,uuid)',
    'public.server_read_live_reply_v1(uuid,uuid)',
    'public.server_read_live_reply_segment_v1(uuid,uuid,integer)',
    'public.server_finalize_voice_note_withheld_tail_v1(uuid,uuid,uuid,uuid,text,text,text,uuid,uuid)',
    'public.server_sweep_fast_voice_v1(integer)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
    END LOOP;
    IF fn LIKE 'public.server\_%' AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. DEPLOY GUARD.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  IF (SELECT count(*) FROM voice_private.voice_launch_capability_states s
       WHERE s.feature_flag_state = 'DISABLED' AND s.launch_requirements_state = 'UNSATISFIED') <> 4 THEN
    RAISE EXCEPTION 'S8B-04 CP2: every voice capability scope must remain DISABLED / UNSATISFIED';
  END IF;
  -- Exactly the three approved texts: V3 current (K-01 ... K-15), V2 and V1 historical and unchanged.
  IF (SELECT count(*) FROM voice_private.consent_texts) <> 3
     OR (SELECT count(*) FROM voice_private.consent_texts t WHERE t.is_current) <> 1
     OR NOT EXISTS (SELECT 1 FROM voice_private.consent_texts t
                     WHERE t.purpose = 'VOICE_RECORDING' AND t.version = 'VOICE_RECORDING_V3' AND t.is_current
                       AND t.text_ar_sha256 = '2550241d69c0cf2fc510c3b09e9fa857012ad4fe0360e3febb2b0d7452e0226b'
                       AND t.text_en_sha256 = 'b593945f15f8e0858e35befeef191d89273ab3149cdee28cd5fbcda3e080bec9')
     OR NOT EXISTS (SELECT 1 FROM voice_private.consent_texts t
                     WHERE t.purpose = 'VOICE_RECORDING' AND t.version = 'VOICE_RECORDING_V2' AND NOT t.is_current
                       AND t.text_ar_sha256 = '84b546b49ed718f683bc38388c9191310da125b853a6d6d0e2a97466d3141740'
                       AND t.text_en_sha256 = 'c3297ff4142651fb7b175060172c92769570ca636ec3f0572d15bb479dc5ccce')
     OR NOT EXISTS (SELECT 1 FROM voice_private.consent_texts t
                     WHERE t.purpose = 'VOICE_RECORDING' AND t.version = 'VOICE_RECORDING_V1' AND NOT t.is_current
                       AND t.text_ar_sha256 = '1c2f6a050372da5175a918d040c1259031df798beff5eacfd2a947f3dc4d3f3d'
                       AND t.text_en_sha256 = 'ea01b715e384c14a239f4e18c0366d77006bb86d931ff326ee95e93c88bd1426') THEN
    RAISE EXCEPTION 'S8B-04 CP2: VOICE_RECORDING_V3 must be the current approved text and V2 and V1 historical and unchanged';
  END IF;
  SELECT count(*) INTO v_count FROM pg_constraint c
   WHERE c.contype = 'f'
     AND (c.confrelid = 'public.users'::regclass
          OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'VOICE'))
     AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g);
  IF v_count <> 0 THEN RAISE EXCEPTION 'S8B-04 CP2: a relation referencing the account or a voice relation is unregistered'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'voice_private' AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC'))
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND (p.proname LIKE 'server\_%live\_%' OR p.proname IN ('server_sweep_fast_voice_v1',
                         'server_finalize_voice_note_withheld_tail_v1', 'server_accept_live_voice_note_v1'))
                   AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))) THEN
    RAISE EXCEPTION 'S8B-04 CP2: a voice relation or a fast-voice definer is reachable by a client role';
  END IF;
END$$;

COMMIT;
