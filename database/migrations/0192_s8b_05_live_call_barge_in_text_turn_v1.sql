-- S8B-05 CP4 — full barge-in, the typed turn inside the call (TEXT_TURN) and the guard of the text paths around a call,
-- under the Integrated Live Call Contract v1.2 FINAL (Part A → A1 → v1.1 → v1.0; the Product Owner's CP4 execution
-- direction of 2026-11-03). Not hosted: every voice gate stays DISABLED.
--
-- ## What is added
--
--   A. voice_private.call_exchanges grows what CP4 needs, and nothing it does not:
--        * barge_in_capture_ms: where the person's speech began when a BARGE_IN stopped QANDEEL (P4), the first one while
--          the exchange is open; measurement and the echo bound of the turn that follows. It closes nothing: P2's four
--          closes stay the only ones (the natural end, N1, the sweep, the call's end).
--        * text_reply, text_reply_terms, text_reply_state: the text reply of a typed exchange (D-05-07: the reply to a
--          message written during the call is text, never spoken), stored by the close that creates it (TEXT_REPLIED).
--   B. The ONE close (0190, as 0191 replaced it) takes the exchange's channel from its numbered USER turn. A spoken
--      exchange is closed exactly as before. A typed exchange has no playout, no anchor and no voice source: its reply is
--      its stored text (COMPLETE, or WITHHELD_TAIL when the release guard kept its tail), nothing when its generation
--      failed (FAILED), or nothing when N1 or the call's end closed it first (INTERRUPTED). R5′ and R7′ are unchanged: the
--      event with the stored Safety, the ASSISTANT half queued.
--   C. The commands, service_role only: record a BARGE_IN (fenced by the connection epoch; a BARGE_IN for a closed exchange
--      is late, rejected and counted, P3), and close a typed exchange with its text reply. The text close is not fenced by
--      the epoch: the reply belongs to the conversation, not to the socket that asked for it (a resumed connection, or none,
--      reads it from the history); the first close wins as for every close. And, for P5 / reconnection, a fenced read of the
--      call's open exchange (the one an older connection left open), so the connection now holding the call settles its
--      Safety (S3) before its next commit closes it (N1).
--   D. The delivery read (0190) also answers a typed exchange's text reply, from its exchange (CA-05-02 §2.3: no consumer
--      reads a call reply without its delivery state).
--   E. The 0131 text paths around a call (A1 C2, P4 / P5): a typed REST turn (create_user_conversation_turn) or a Voice Note
--      (server_commit_voice_note_turn_v1) admitted into a session whose call has not ended is refused LIVE_CALL_IN_PROGRESS
--      (55000, nothing written), under the person's call lock, so it cannot interleave with the call's numbered order;
--      during a call the phone sends a message as TEXT_TURN, and after the end as an ordinary message. A BEFORE INSERT
--      trigger on the RECEIVED user row (the only shape those two paths insert; the call's own turns are inserted
--      GENERATING), so neither frozen function is re-created. Outside a call nothing changes.
--
-- ## What is deliberately NOT here
--
--   * No new close reason for a barge-in, no change to the heard mark's rules (P1 – P3 as 0190 wrote them), no new
--     protocol shape, no F-01 file (S8B-06 CP3, after its own approval), no change to M1, L2, the permits or their
--     policy, no SHARED-permit deferral (GCR-01-A). No gate is opened; nothing is applied to a hosted database.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE EXCHANGE (A).
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE voice_private.call_exchanges
  ADD COLUMN barge_in_capture_ms bigint,
  ADD COLUMN text_reply text,
  ADD COLUMN text_reply_terms text[],
  ADD COLUMN text_reply_state text;
ALTER TABLE voice_private.call_exchanges
  ADD CONSTRAINT call_exchanges_barge_in_check CHECK (barge_in_capture_ms IS NULL OR (barge_in_capture_ms >= 0 AND barge_in_capture_ms % 20 = 0)),
  ADD CONSTRAINT call_exchanges_text_reply_check CHECK (
    (text_reply IS NULL AND text_reply_terms IS NULL AND text_reply_state IS NULL)
    OR (text_reply IS NOT NULL AND text_reply_terms IS NOT NULL AND coalesce(text_reply_state IN ('COMPLETE', 'WITHHELD_TAIL'), false)
        AND length(text_reply) <= 4000 AND produced_audio_ms = 0 AND playout_mark_ms = 0 AND reply_clock_start_ms IS NULL)),
  DROP CONSTRAINT call_exchanges_shape_check,
  ADD CONSTRAINT call_exchanges_shape_check CHECK (
    CASE exchange_state
      WHEN 'OPEN' THEN assistant_turn_id IS NULL AND delivery_state IS NULL AND heard_mark_ms IS NULL AND close_reason IS NULL
                       AND closed_at IS NULL
      ELSE assistant_turn_id IS NOT NULL AND safety_disposition IS NOT NULL AND closed_at IS NOT NULL
           AND coalesce(delivery_state IN ('COMPLETE', 'WITHHELD_TAIL', 'INTERRUPTED', 'FAILED'), false)
           AND heard_mark_ms IS NOT NULL AND heard_mark_ms >= 0 AND heard_mark_ms % 20 = 0
           AND coalesce(close_reason IN ('PLAYED_OUT', 'GENERATION_FAILED', 'NEXT_TURN', 'CALL_ENDING', 'TEXT_REPLIED'), false)
           AND (close_reason <> 'TEXT_REPLIED' OR text_reply IS NOT NULL)
    END);

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE ONE CLOSE (B). Forward-replaced from 0191_s8b_05_live_call_ordered_halves_v1.sql (substitution
--    "close-core-text-exchange" in database/live-call-0192-substitutions.mjs).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION voice_private.close_call_exchange_core_v1(p_call_id uuid, p_call_turn_index integer, p_reason text,
  p_assistant_turn_id uuid, p_event_id uuid)
RETURNS TABLE (outcome text, assistant_turn_id uuid, delivery_state text, heard_mark_ms bigint, anchor_start_ms bigint,
               anchor_end_ms bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ex voice_private.call_exchanges;
  v_user public.conversation_turns;
  v_recording uuid;
  v_mark bigint := 0;
  v_text text;
  v_terms text[];
  v_delivery text;
  v_start bigint;
  v_end bigint;
  -- S8B-05 CP4 (0192, D-05-07): the exchange's channel, from its numbered USER turn.
  v_channel text;
BEGIN
  IF p_call_id IS NULL OR p_call_turn_index IS NULL OR p_assistant_turn_id IS NULL OR p_event_id IS NULL
     OR p_reason IS NULL OR p_reason NOT IN ('PLAYED_OUT', 'GENERATION_FAILED', 'NEXT_TURN', 'CALL_ENDING', 'TEXT_REPLIED') THEN
    -- S8B-05 CP4 (0192, D-05-07): TEXT_REPLIED, the close of a typed exchange by its text reply.
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_ex FROM voice_private.call_exchanges e
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::bigint, NULL::bigint; RETURN;
  END IF;
  IF v_ex.exchange_state = 'CLOSED' THEN
    RETURN QUERY SELECT 'ALREADY_CLOSED'::text, v_ex.assistant_turn_id, v_ex.delivery_state, v_ex.heard_mark_ms,
      CASE WHEN v_ex.heard_mark_ms > 0 THEN v_ex.reply_clock_start_ms END,
      CASE WHEN v_ex.heard_mark_ms > 0 THEN v_ex.reply_clock_start_ms + v_ex.heard_mark_ms END;
    RETURN;
  END IF;
  -- S2: the Safety disposition is stored before generation; an exchange is never closed without it (S3 recomputes it).
  IF v_ex.safety_disposition IS NULL THEN
    RAISE EXCEPTION 'CALL_EXCHANGE_SAFETY_UNSETTLED' USING ERRCODE = '55000';
  END IF;
  SELECT * INTO v_user FROM public.conversation_turns t WHERE t.id = v_ex.user_turn_id FOR UPDATE;
  IF NOT FOUND OR v_user.status <> 'GENERATING' THEN
    RAISE EXCEPTION 'CALL_EXCHANGE_INTEGRITY' USING ERRCODE = '55000';
  END IF;
  SELECT r.id INTO v_recording FROM voice_private.recordings r WHERE r.call_id = p_call_id AND r.user_id = v_ex.user_id;
  IF v_recording IS NULL THEN RAISE EXCEPTION 'CALL_EXCHANGE_INTEGRITY' USING ERRCODE = '55000'; END IF;
  -- S8B-05 CP4 (0192, D-05-07): a typed exchange is closed by its text reply, never by a playout; a spoken one never by text.
  SELECT ct.turn_channel INTO v_channel FROM public.conversation_call_turns ct WHERE ct.turn_id = v_ex.user_turn_id;
  IF v_channel IS NULL OR (v_channel = 'TEXT' AND p_reason = 'PLAYED_OUT') OR (v_channel = 'SPEECH' AND p_reason = 'TEXT_REPLIED') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_ex.reply_clock_start_ms IS NOT NULL AND v_ex.playout_mark_ms > 0 THEN
    v_mark := least(v_ex.playout_mark_ms,
                    CASE WHEN v_ex.generation_state = 'GENERATING' THEN v_ex.playout_mark_ms ELSE v_ex.produced_audio_ms END,
                    greatest(0, voice_private.track_clock_end_v1(v_recording, 'QANDEEL') - v_ex.reply_clock_start_ms));
    v_mark := v_mark - (v_mark % 20);
  END IF;
  SELECT coalesce(string_agg(s.segment_text, '' ORDER BY s.segment_seq), ''),
         coalesce((SELECT array_agg(DISTINCT t ORDER BY t) FROM voice_private.call_reply_segments s2, unnest(s2.retrieval_terms) t
                    WHERE s2.call_id = p_call_id AND s2.call_turn_index = p_call_turn_index AND s2.end_offset_ms <= v_mark), '{}')
    INTO v_text, v_terms
    FROM voice_private.call_reply_segments s
   WHERE s.call_id = p_call_id AND s.call_turn_index = p_call_turn_index AND s.end_offset_ms <= v_mark;
  IF v_ex.generation_state = 'FAILED' THEN
    v_delivery := 'FAILED';
  ELSIF v_ex.generation_state IN ('COMPLETE', 'WITHHELD_TAIL') AND v_ex.produced_audio_ms > 0 AND v_mark >= v_ex.produced_audio_ms THEN
    v_delivery := v_ex.generation_state;
  ELSE
    v_delivery := 'INTERRUPTED';
  END IF;
  -- S8B-05 CP4 (0192, D-05-07): a typed exchange's reply is its stored text (no mark: nothing of it was played); closed first by
  -- N1 or the call's end, it is INTERRUPTED with no text, and a failed generation is FAILED with none.
  IF v_channel = 'TEXT' THEN
    v_text := CASE WHEN p_reason = 'TEXT_REPLIED' THEN coalesce(v_ex.text_reply, '') ELSE '' END;
    v_terms := CASE WHEN p_reason = 'TEXT_REPLIED' THEN coalesce(v_ex.text_reply_terms, '{}') ELSE '{}' END;
    v_delivery := CASE p_reason WHEN 'TEXT_REPLIED' THEN v_ex.text_reply_state WHEN 'GENERATION_FAILED' THEN 'FAILED' ELSE 'INTERRUPTED' END;
  END IF;
  IF v_mark > 0 THEN
    v_start := v_ex.reply_clock_start_ms;
    v_end := v_ex.reply_clock_start_ms + v_mark;
  END IF;
  INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason,
                                         source_turn_id, completed_at)
  VALUES (p_assistant_turn_id, v_ex.session_id, v_ex.user_id, 'ASSISTANT', 'COMPLETED', v_text, v_user.processing_path,
          v_user.routing_reason, v_ex.user_turn_id, CURRENT_TIMESTAMP);
  -- S8B-05 CP4 (0192, D-05-07): a text reply was never spoken, so it has no voice source; its delivery state is the exchange's.
  IF v_channel = 'SPEECH' THEN
  INSERT INTO public.conversation_turn_voice_sources (turn_id, user_id, session_id, source_role, source_modality,
                                                      transcript_origin, asr_confidence_band, recording_id, anchor_start_ms,
                                                      anchor_end_ms, spoken, delivery_state)
  VALUES (p_assistant_turn_id, v_ex.user_id, v_ex.session_id, 'ASSISTANT', 'LIVE_CALL_SPEECH', NULL, NULL, v_recording,
          v_start, v_end, true, v_delivery);
  END IF;
  INSERT INTO public.conversation_call_turns (turn_id, user_id, session_id, call_id, call_turn_index, turn_role, turn_channel,
                                              retrieval_terms)
  -- S8B-05 CP4 (0192, D-05-07): the reply takes its exchange's channel.
  VALUES (p_assistant_turn_id, v_ex.user_id, v_ex.session_id, p_call_id, p_call_turn_index, 'ASSISTANT', v_channel,
          v_terms[1:64]);
  UPDATE public.conversation_turns t SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
   WHERE t.id = v_ex.user_turn_id;
  INSERT INTO public.runtime_event_outbox (event_id, event_type, event_version, subject_user_id, subject_session_id,
                                           subject_turn_id, correlation_id, schema_ref, payload)
  VALUES (p_event_id, 'ConversationTurnCompleted', '2.0', v_ex.user_id, v_ex.session_id, v_ex.user_turn_id, NULL,
          'qandeel.runtime.conversation-turn-completed.v2',
          jsonb_build_object('user_id', v_ex.user_id, 'session_id', v_ex.session_id, 'source_turn_id', v_ex.user_turn_id,
                             'terminal_status', 'COMPLETED', 'processing_path', v_user.processing_path,
                             'routing_reason', v_user.routing_reason, 'orchestration_id', NULL,
                             'safety_disposition', v_ex.safety_disposition));
  DELETE FROM voice_private.call_reply_segments s WHERE s.call_id = p_call_id AND s.call_turn_index = p_call_turn_index;
  UPDATE voice_private.call_exchanges e
     SET exchange_state = 'CLOSED', assistant_turn_id = p_assistant_turn_id, delivery_state = v_delivery, heard_mark_ms = v_mark,
         close_reason = p_reason, closed_at = clock_timestamp()
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index;
  -- S8B-05 CP3 (0191, R7′): the reply's analysis half is queued by the close that creates it.
  INSERT INTO voice_private.call_analysis_queue (call_id, call_turn_index, half, user_id, session_id, turn_id)
  VALUES (p_call_id, p_call_turn_index, 'ASSISTANT', v_ex.user_id, v_ex.session_id, p_assistant_turn_id);
  RETURN QUERY SELECT 'CLOSED'::text, p_assistant_turn_id, v_delivery, v_mark, v_start, v_end;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE COMMANDS (C). service_role only.
-- ---------------------------------------------------------------------------------------------------------------------
-- P4: a BARGE_IN for the reply `p_call_turn_index`, fenced by the connection epoch. While the exchange is open the first
-- onset is kept (RECORDED, then ALREADY_RECORDED); it closes nothing (the next turn's commit does, N1). For a closed
-- exchange it is late (P3): rejected, counted, nothing changed (CLOSED).
CREATE FUNCTION public.server_record_call_barge_in_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint,
  p_call_turn_index integer, p_capture_ms bigint)
RETURNS TABLE (outcome text, barge_in_capture_ms bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_fence text;
  v_ex voice_private.call_exchanges;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL OR p_call_turn_index IS NULL OR p_capture_ms IS NULL
     OR p_capture_ms < 0 OR p_capture_ms % 20 <> 0 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_fence := voice_private.call_command_fence_v1(p_user_id, p_call_id, p_connection_epoch, false);
  IF v_fence IS NOT NULL THEN RETURN QUERY SELECT v_fence, NULL::bigint; RETURN; END IF;
  SELECT * INTO v_ex FROM voice_private.call_exchanges e
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index AND e.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bigint; RETURN; END IF;
  IF v_ex.exchange_state <> 'OPEN' THEN
    PERFORM voice_private.count_late_call_command_v1(p_call_id, p_call_turn_index);
    RETURN QUERY SELECT 'CLOSED'::text, v_ex.barge_in_capture_ms; RETURN;
  END IF;
  IF v_ex.barge_in_capture_ms IS NOT NULL THEN
    RETURN QUERY SELECT 'ALREADY_RECORDED'::text, v_ex.barge_in_capture_ms; RETURN;
  END IF;
  UPDATE voice_private.call_exchanges e SET barge_in_capture_ms = p_capture_ms
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index;
  RETURN QUERY SELECT 'RECORDED'::text, p_capture_ms;
END$$;

-- P5 / reconnection: the call's open exchange as the connection now holding the call finds it (fenced by its epoch): the
-- one an older connection left open (its reply stopped when that connection went). The new connection settles its Safety
-- (S3, the same gate over the same reader) before its next commit closes it (N1); nothing else reads it. OPEN or NONE.
CREATE FUNCTION public.server_read_open_call_exchange_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint)
RETURNS TABLE (outcome text, call_turn_index integer, user_turn_id uuid, content text, turn_channel text, safety_disposition text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_fence text;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_fence := voice_private.call_command_fence_v1(p_user_id, p_call_id, p_connection_epoch, false);
  IF v_fence IS NOT NULL THEN
    RETURN QUERY SELECT v_fence, NULL::integer, NULL::uuid, NULL::text, NULL::text, NULL::text; RETURN;
  END IF;
  RETURN QUERY
    SELECT 'OPEN'::text, e.call_turn_index, e.user_turn_id, u.content, ct.turn_channel, e.safety_disposition
      FROM voice_private.call_exchanges e
      JOIN public.conversation_turns u ON u.id = e.user_turn_id
      JOIN public.conversation_call_turns ct ON ct.turn_id = e.user_turn_id
     WHERE e.call_id = p_call_id AND e.user_id = p_user_id AND e.exchange_state = 'OPEN';
  IF NOT FOUND THEN RETURN QUERY SELECT 'NONE'::text, NULL::integer, NULL::uuid, NULL::text, NULL::text, NULL::text; END IF;
END$$;

-- D-05-07: the close of a typed exchange by its reply (COMPLETE / WITHHELD_TAIL with its text and terms, or FAILED with
-- none), through the ONE close: the first close wins (ALREADY_CLOSED with the frozen truth), S2 holds (never without the
-- stored Safety). Not fenced by the epoch: the text reply is the conversation's, readable from the history whatever
-- became of the connection that asked for it. A spoken exchange is refused.
CREATE FUNCTION public.server_close_live_call_text_exchange_v1(p_user_id uuid, p_call_id uuid, p_call_turn_index integer,
  p_reply_state text, p_reply_text text, p_retrieval_terms text[], p_assistant_turn_id uuid, p_event_id uuid)
RETURNS TABLE (outcome text, assistant_turn_id uuid, delivery_state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_call voice_private.calls;
  v_ex voice_private.call_exchanges;
  v_channel text;
  v_result record;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_call_turn_index IS NULL OR p_assistant_turn_id IS NULL OR p_event_id IS NULL
     OR p_reply_state IS NULL OR p_reply_state NOT IN ('COMPLETE', 'WITHHELD_TAIL', 'FAILED')
     OR p_reply_text IS NULL OR length(p_reply_text) > (voice_private.live_call_turn_policy_v1()).max_turn_chars
     OR (p_reply_state = 'FAILED') <> (btrim(p_reply_text) = '')
     OR NOT voice_private.call_terms_valid_v1(p_retrieval_terms)
     OR (p_reply_state = 'FAILED' AND cardinality(p_retrieval_terms) > 0) THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id FOR SHARE;
  IF NOT FOUND OR v_call.user_id <> p_user_id THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, NULL::text; RETURN;
  END IF;
  SELECT * INTO v_ex FROM voice_private.call_exchanges e
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, NULL::text; RETURN; END IF;
  SELECT ct.turn_channel INTO v_channel FROM public.conversation_call_turns ct WHERE ct.turn_id = v_ex.user_turn_id;
  IF v_channel IS DISTINCT FROM 'TEXT' THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  IF v_ex.exchange_state = 'OPEN' AND p_reply_state <> 'FAILED' THEN
    UPDATE voice_private.call_exchanges e
       SET text_reply = p_reply_text, text_reply_terms = p_retrieval_terms, text_reply_state = p_reply_state
     WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index;
  END IF;
  SELECT * INTO v_result FROM voice_private.close_call_exchange_core_v1(p_call_id, p_call_turn_index,
    CASE WHEN p_reply_state = 'FAILED' THEN 'GENERATION_FAILED' ELSE 'TEXT_REPLIED' END, p_assistant_turn_id, p_event_id) c;
  RETURN QUERY SELECT v_result.outcome, v_result.assistant_turn_id, v_result.delivery_state;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE DELIVERY READ (D). Forward-replaced from 0190_s8b_05_live_call_spoken_turn_v1.sql (substitution
--    "delivery-read-text-reply" in database/live-call-0192-substitutions.mjs).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.server_read_call_reply_delivery_v1(p_user_id uuid, p_session_id uuid, p_turn_ids uuid[])
RETURNS TABLE (turn_id uuid, delivery_state text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_turn_ids IS NULL OR cardinality(p_turn_ids) > 100 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT vs.turn_id, vs.delivery_state
      FROM public.conversation_turn_voice_sources vs
     WHERE vs.user_id = p_user_id AND vs.session_id = p_session_id AND vs.turn_id = ANY (p_turn_ids)
       AND vs.source_role = 'ASSISTANT' AND vs.source_modality = 'LIVE_CALL_SPEECH'
    -- S8B-05 CP4 (0192, D-05-07): a typed exchange's text reply, whose delivery state is the exchange's own.
    UNION ALL
    SELECT e.assistant_turn_id, e.delivery_state
      FROM voice_private.call_exchanges e
      JOIN public.conversation_call_turns ct ON ct.turn_id = e.assistant_turn_id AND ct.turn_channel = 'TEXT'
     WHERE e.user_id = p_user_id AND e.session_id = p_session_id AND e.assistant_turn_id = ANY (p_turn_ids) AND e.exchange_state = 'CLOSED'
     ORDER BY 1;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. THE TEXT PATHS AROUND A CALL (E).
-- ---------------------------------------------------------------------------------------------------------------------
-- A typed REST turn or a Voice Note admitted into a session whose call is live would take no place in the call's numbered
-- order (A1 C2: the order is the session before the call, then the call by call_turn_index). "Live" is call-truth's own
-- reading (server_read_call_truth_v1, 0189), failing safe the same way: a lapsed call the sweep has not ended yet does not
-- block the person's typing. Under the person's call lock (the one server_begin_call_v1 takes), so a call that begins
-- concurrently is decided first or after, never between the check and the insert. Nothing is written by a refusal.
CREATE FUNCTION voice_private.refuse_turn_admission_during_call_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_grace interval := make_interval(secs => (voice_private.live_call_policy_v1()).reconnect_grace_seconds);
  v_now timestamptz;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.live-call.v1:' || NEW.user_id::text, 0));
  v_now := clock_timestamp();
  IF EXISTS (SELECT 1 FROM voice_private.calls c
              WHERE c.user_id = NEW.user_id AND c.session_id = NEW.session_id AND c.state <> 'ENDED'
                AND CASE c.state WHEN 'CONNECTING' THEN c.seat_lease_until > v_now AND c.connect_deadline > v_now
                                 WHEN 'ACTIVE' THEN c.seat_lease_until + v_grace > v_now
                                 ELSE c.grace_until > v_now END) THEN
    RAISE EXCEPTION 'LIVE_CALL_IN_PROGRESS' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER conversation_turns_live_call_admission
  BEFORE INSERT ON public.conversation_turns
  FOR EACH ROW WHEN (NEW.role = 'USER' AND NEW.status = 'RECEIVED')
  EXECUTE FUNCTION voice_private.refuse_turn_admission_during_call_v1();

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. OWNERSHIP AND ACL.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
  r text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'voice_private.close_call_exchange_core_v1(uuid,integer,text,uuid,uuid)',
    'voice_private.refuse_turn_admission_during_call_v1()',
    'public.server_record_call_barge_in_v1(uuid,uuid,bigint,integer,bigint)',
    'public.server_read_open_call_exchange_v1(uuid,uuid,bigint)',
    'public.server_close_live_call_text_exchange_v1(uuid,uuid,integer,text,text,text[],uuid,uuid)',
    'public.server_read_call_reply_delivery_v1(uuid,uuid,uuid[])'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
    END LOOP;
    IF fn LIKE 'public.%' AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. DEPLOY GUARD.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  IF (SELECT count(*) FROM voice_private.voice_launch_capability_states s
       WHERE s.feature_flag_state = 'DISABLED' AND s.launch_requirements_state = 'UNSATISFIED') <> 4 THEN
    RAISE EXCEPTION 'S8B-05 CP4: every voice capability scope must remain DISABLED / UNSATISFIED';
  END IF;
  SELECT count(*) INTO v_count FROM pg_constraint c
   WHERE c.contype = 'f'
     AND (c.confrelid = 'public.users'::regclass
          OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'VOICE'))
     AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g);
  IF v_count <> 0 THEN RAISE EXCEPTION 'S8B-05 CP4: a relation referencing the account or a voice relation is unregistered'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'voice_private' AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC'))
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public'
                   AND (p.proname LIKE 'server\_%call%' OR p.proname LIKE 'server\_%background%' OR p.proname LIKE 'server\_%semantic\_lease%'
                        OR p.proname = 'commit_conversation_units_call_half_v1')
                   AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))) THEN
    RAISE EXCEPTION 'S8B-05 CP4: a voice relation, a call definer or the half coordinator is reachable by a client role';
  END IF;
END$$;

COMMIT;
