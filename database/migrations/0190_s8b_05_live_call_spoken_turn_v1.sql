-- S8B-05 CP2 — the live call's spoken turn, QANDEEL's spoken reply and playout truth, under the Integrated Live Call
-- Contract v1.2 FINAL (Part A → A1 → v1.1 → v1.0; the Product Owner's CP2 execution task of 2026-11-02). Not hosted: every
-- voice gate stays DISABLED.
--
-- ## What is added
--
--   A. public.conversation_call_turns: the call's structural turn order (CA-05-01 R1). One row per committed turn of a
--      call, numbered by voice_private.reserve_call_turn_index_v1 (0189): its call, its call_turn_index, its role, its
--      channel and its retrieval terms (the Memory tokenizer's terms, an array with a GIN index, A1 §4). A turn that has a
--      row here is the call authority's (R2-G).
--   B. voice_private.call_exchanges: one exchange per call turn. N1: at most one OPEN exchange per call; a new turn closes
--      the open one in the SAME transaction. The exchange holds what only the server may decide: the turn's stored Safety
--      disposition (S1 – S3: written once; a different later value is a Safety error), the reply's generation outcome,
--      the audio produced, the ONE confirmed playout mark of the turn (P1: the highest only, only while open) and where the
--      reply's offset 0 lies on the call clock. voice_private.call_reply_segments: the reply's spoken text pieces with
--      their end offsets while the exchange is open (deleted when it closes; the closed reply is the turn's content).
--   C. voice_private.call_analysis_queue: the durable per-session order of a call's analysis halves (R7′). CP2 writes
--      the USER half in the turn's commit transaction; the worker, the coordinator and the ASSISTANT half are CP3's.
--   D. The voice-source corrections (CA-05-04, CA-05-02): delivery_state gains FAILED; an anchor may be NULL only for a
--      reply of which no audio was heard (INTERRUPTED before any audio, or FAILED).
--   E. R2-G: fail / cancel / recover refuse a call turn (CALL_TURN_OWNED_BY_CALL_AUTHORITY), and a status trigger refuses
--      FAILED / CANCELLED / SUPERSEDED for any call turn, whatever the path (R2′).
--   F. The commands, all service_role only, all fenced by the connection epoch: commit a spoken turn (N1 close, index,
--      USER turn, voice source, numbering, exchange, queue item: one transaction), store the turn's Safety, register a
--      reply segment, finish the reply's generation, confirm playout, close the exchange (ONE close function; the first
--      commit wins — natural end, N1, the call's end), and the call's ledger rows (ASR per connection, TTS per attempt).
--      The close freezes the truth: content = the segments whose end ≤ the heard mark, anchor = [start, start + mark)
--      (bounded by what the QANDEEL track holds, so the recorded-as-heard is never more than recorded), delivery_state from
--      the facts, the ASSISTANT turn COMPLETED (technical closure only), the USER turn COMPLETED, and
--      ConversationTurnCompleted v2 with the stored Safety disposition (R5′), exactly the finalize_conversation_turn_v2
--      payload shape.
--   G. Two owner reads, SECURITY INVOKER under row-level security, for the call's context (C2: the session's earlier
--      exchanges in their order, then this call's by call_turn_index) and its in-call retrieval (at most two earlier
--      exchanges: two distinct terms, or one term with a recall cue). No provider is reached by either.
--   H. Export My Data says a spoken reply's delivery state.
--
-- ## What is deliberately NOT here
--
--   * No half coordinator, no queue worker, no O1 / O2 / O3, no sweep closure of an open exchange, no shared permits
--     (CP3). No barge-in, no P4 / P5, no TEXT_TURN numbering (CP4). No gate is opened; nothing is applied to a hosted
--     database. finalize_conversation_turn_v2 is not redefined.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE CALL TURN POLICY (constants; changing one is a migration).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION voice_private.live_call_turn_policy_v1(
  OUT max_turn_chars integer, OUT max_segment_chars integer, OUT max_segments integer, OUT max_call_turns integer,
  OUT max_terms integer, OUT max_term_length integer)
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 4000, 2000, 64, 2000, 64, 48;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE CALL'S TURN ORDER (A).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE public.conversation_call_turns (
  turn_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  call_id uuid NOT NULL,
  call_turn_index integer NOT NULL,
  turn_role text NOT NULL,
  turn_channel text NOT NULL,
  retrieval_terms text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT conversation_call_turns_pk PRIMARY KEY (turn_id),
  CONSTRAINT conversation_call_turns_turn_fk FOREIGN KEY (turn_id) REFERENCES public.conversation_turns (id) ON DELETE CASCADE,
  CONSTRAINT conversation_call_turns_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT conversation_call_turns_call_fk FOREIGN KEY (call_id) REFERENCES voice_private.calls (id) ON DELETE CASCADE,
  CONSTRAINT conversation_call_turns_order_key UNIQUE (call_id, call_turn_index, turn_role),
  CONSTRAINT conversation_call_turns_index_check CHECK (call_turn_index >= 0),
  CONSTRAINT conversation_call_turns_role_check CHECK (turn_role IN ('USER', 'ASSISTANT')),
  -- TEXT: a typed turn during the call (C2; its client path P4 / T1 is CP4's).
  CONSTRAINT conversation_call_turns_channel_check CHECK (turn_channel IN ('SPEECH', 'TEXT')),
  CONSTRAINT conversation_call_turns_terms_check CHECK (cardinality(retrieval_terms) <= 64 AND array_position(retrieval_terms, NULL) IS NULL)
);
CREATE INDEX conversation_call_turns_user_idx ON public.conversation_call_turns (user_id, session_id);
CREATE INDEX conversation_call_turns_terms_idx ON public.conversation_call_turns USING gin (retrieval_terms);

ALTER TABLE public.conversation_call_turns OWNER TO postgres;
ALTER TABLE public.conversation_call_turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conversation_call_turns FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON TABLE public.conversation_call_turns FROM %I', r); END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON TABLE public.conversation_call_turns TO authenticated;
  END IF;
END$$;
-- The owner reads their own call order (the call context and the in-call retrieval run with the owner's token); nothing
-- else is reachable, and no role writes it.
CREATE POLICY conversation_call_turns_owner_select ON public.conversation_call_turns
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE EXCHANGE, ITS REPLY SEGMENTS AND THE ANALYSIS QUEUE (B, C).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.call_exchanges (
  call_id uuid NOT NULL,
  call_turn_index integer NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  user_turn_id uuid NOT NULL,
  -- The epoch that committed the turn (measurement only: every command is fenced by the call's current epoch).
  committed_epoch bigint NOT NULL,
  exchange_state text NOT NULL DEFAULT 'OPEN',
  safety_disposition text,
  generation_state text NOT NULL DEFAULT 'GENERATING',
  produced_audio_ms bigint NOT NULL DEFAULT 0,
  playout_mark_ms bigint NOT NULL DEFAULT 0,
  reply_clock_start_ms bigint,
  late_rejections integer NOT NULL DEFAULT 0,
  assistant_turn_id uuid,
  delivery_state text,
  heard_mark_ms bigint,
  close_reason text,
  committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_at timestamptz,
  CONSTRAINT call_exchanges_pk PRIMARY KEY (call_id, call_turn_index),
  CONSTRAINT call_exchanges_call_fk FOREIGN KEY (call_id) REFERENCES voice_private.calls (id) ON DELETE CASCADE,
  CONSTRAINT call_exchanges_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT call_exchanges_user_turn_fk FOREIGN KEY (user_turn_id) REFERENCES public.conversation_turns (id) ON DELETE CASCADE,
  CONSTRAINT call_exchanges_assistant_fk FOREIGN KEY (assistant_turn_id) REFERENCES public.conversation_turns (id) ON DELETE CASCADE,
  CONSTRAINT call_exchanges_user_turn_key UNIQUE (user_turn_id),
  CONSTRAINT call_exchanges_state_check CHECK (exchange_state IN ('OPEN', 'CLOSED')),
  CONSTRAINT call_exchanges_safety_check CHECK (safety_disposition IS NULL OR safety_disposition IN ('ALLOW', 'GUIDED', 'BLOCK')),
  CONSTRAINT call_exchanges_generation_check CHECK (generation_state IN ('GENERATING', 'COMPLETE', 'WITHHELD_TAIL', 'FAILED')),
  CONSTRAINT call_exchanges_audio_check CHECK (
    produced_audio_ms >= 0 AND produced_audio_ms % 20 = 0 AND playout_mark_ms >= 0 AND late_rejections >= 0
    AND (reply_clock_start_ms IS NULL OR (reply_clock_start_ms >= 0 AND reply_clock_start_ms % 20 = 0))
    AND (generation_state <> 'FAILED' OR produced_audio_ms = 0)),
  CONSTRAINT call_exchanges_shape_check CHECK (
    CASE exchange_state
      WHEN 'OPEN' THEN assistant_turn_id IS NULL AND delivery_state IS NULL AND heard_mark_ms IS NULL AND close_reason IS NULL
                       AND closed_at IS NULL
      ELSE assistant_turn_id IS NOT NULL AND safety_disposition IS NOT NULL AND closed_at IS NOT NULL
           AND coalesce(delivery_state IN ('COMPLETE', 'WITHHELD_TAIL', 'INTERRUPTED', 'FAILED'), false)
           AND heard_mark_ms IS NOT NULL AND heard_mark_ms >= 0 AND heard_mark_ms % 20 = 0
           AND coalesce(close_reason IN ('PLAYED_OUT', 'GENERATION_FAILED', 'NEXT_TURN', 'CALL_ENDING'), false)
    END)
);
-- N1: at most one open exchange per call.
CREATE UNIQUE INDEX call_exchanges_one_open_idx ON voice_private.call_exchanges (call_id) WHERE exchange_state = 'OPEN';
CREATE INDEX call_exchanges_user_idx ON voice_private.call_exchanges (user_id);

CREATE TABLE voice_private.call_reply_segments (
  call_id uuid NOT NULL,
  call_turn_index integer NOT NULL,
  segment_seq integer NOT NULL,
  user_id uuid NOT NULL,
  segment_text text NOT NULL,
  start_offset_ms bigint NOT NULL,
  end_offset_ms bigint NOT NULL,
  retrieval_terms text[] NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT call_reply_segments_pk PRIMARY KEY (call_id, call_turn_index, segment_seq),
  CONSTRAINT call_reply_segments_exchange_fk FOREIGN KEY (call_id, call_turn_index)
      REFERENCES voice_private.call_exchanges (call_id, call_turn_index) ON DELETE CASCADE,
  CONSTRAINT call_reply_segments_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT call_reply_segments_shape_check CHECK (
    segment_seq >= 0 AND length(segment_text) BETWEEN 1 AND 2000 AND start_offset_ms >= 0 AND end_offset_ms > start_offset_ms
    AND start_offset_ms % 20 = 0 AND end_offset_ms % 20 = 0
    AND cardinality(retrieval_terms) <= 64 AND array_position(retrieval_terms, NULL) IS NULL)
);
CREATE INDEX call_reply_segments_user_idx ON voice_private.call_reply_segments (user_id);

CREATE TABLE voice_private.call_analysis_queue (
  call_id uuid NOT NULL,
  call_turn_index integer NOT NULL,
  half text NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  turn_id uuid NOT NULL,
  queue_state text NOT NULL DEFAULT 'PENDING',
  enqueued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT call_analysis_queue_pk PRIMARY KEY (call_id, call_turn_index, half),
  CONSTRAINT call_analysis_queue_call_fk FOREIGN KEY (call_id) REFERENCES voice_private.calls (id) ON DELETE CASCADE,
  CONSTRAINT call_analysis_queue_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT call_analysis_queue_turn_fk FOREIGN KEY (turn_id) REFERENCES public.conversation_turns (id) ON DELETE CASCADE,
  CONSTRAINT call_analysis_queue_half_check CHECK (half IN ('USER', 'ASSISTANT')),
  -- CP2 writes PENDING items only; the worker's states are CP3's.
  CONSTRAINT call_analysis_queue_state_check CHECK (queue_state = 'PENDING')
);
CREATE INDEX call_analysis_queue_session_idx ON voice_private.call_analysis_queue (session_id, call_id, call_turn_index);
CREATE INDEX call_analysis_queue_user_idx ON voice_private.call_analysis_queue (user_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE VOICE-SOURCE CORRECTIONS (D). The table has no production row (every gate DISABLED, never hosted).
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.conversation_turn_voice_sources ALTER COLUMN anchor_start_ms DROP NOT NULL;
ALTER TABLE public.conversation_turn_voice_sources ALTER COLUMN anchor_end_ms DROP NOT NULL;
ALTER TABLE public.conversation_turn_voice_sources DROP CONSTRAINT conversation_turn_voice_sources_role_shape_check;
ALTER TABLE public.conversation_turn_voice_sources DROP CONSTRAINT conversation_turn_voice_sources_anchor_check;
ALTER TABLE public.conversation_turn_voice_sources ADD CONSTRAINT conversation_turn_voice_sources_role_shape_check CHECK (CASE source_role
    WHEN 'USER' THEN transcript_origin IS NOT DISTINCT FROM 'MACHINE_ASR'
        AND coalesce(asr_confidence_band IN ('HIGH', 'MEDIUM', 'LOW'), false)
        AND spoken IS NULL AND delivery_state IS NULL
    WHEN 'ASSISTANT' THEN source_modality = 'LIVE_CALL_SPEECH' AND transcript_origin IS NULL
        AND asr_confidence_band IS NULL AND spoken IS NOT DISTINCT FROM true
        AND coalesce(delivery_state IN ('COMPLETE', 'INTERRUPTED', 'WITHHELD_TAIL', 'FAILED'), false)
    ELSE false END);
-- An anchor is a range on the recording's clock. It is absent only for a reply of which nothing was heard: INTERRUPTED
-- before any audio played, or FAILED (which never has one; F-01 is not the reply's speech).
ALTER TABLE public.conversation_turn_voice_sources ADD CONSTRAINT conversation_turn_voice_sources_anchor_check CHECK (
    (anchor_start_ms IS NULL) = (anchor_end_ms IS NULL)
    AND (anchor_start_ms IS NULL OR (0 <= anchor_start_ms AND anchor_start_ms < anchor_end_ms))
    AND (anchor_start_ms IS NOT NULL OR (source_role = 'ASSISTANT' AND delivery_state IN ('INTERRUPTED', 'FAILED')))
    AND (delivery_state IS DISTINCT FROM 'FAILED' OR anchor_start_ms IS NULL));

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. R2-G / R2′ (E).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fail_conversation_turn(
  p_session_id uuid,p_user_id uuid,p_source_turn_id uuid,p_event_id uuid,p_correlation_id uuid DEFAULT NULL,p_orchestration_id uuid DEFAULT NULL
) RETURNS SETOF public.conversation_turns
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'INVALID_USER' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=p_user_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 -- S8B-05 CP2 (0190, R2-G): a live call's turn is never FAILED, CANCELLED or SUPERSEDED by a generic command.
 IF EXISTS (SELECT 1 FROM public.conversation_call_turns ct WHERE ct.turn_id=p_source_turn_id) THEN RAISE EXCEPTION 'CALL_TURN_OWNED_BY_CALL_AUTHORITY' USING ERRCODE='55000';END IF;
 SELECT * INTO source_row FROM public.conversation_turns WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER' AND status='GENERATING' FOR UPDATE;
 IF NOT FOUND THEN RETURN;END IF;
 UPDATE public.conversation_turns SET status='FAILED',updated_at=CURRENT_TIMESTAMP WHERE id=p_source_turn_id RETURNING * INTO source_row;
 INSERT INTO public.runtime_event_outbox(event_id,event_type,subject_user_id,subject_session_id,subject_turn_id,correlation_id,schema_ref,payload)
 VALUES(p_event_id,'ConversationTurnFailed',p_user_id,p_session_id,p_source_turn_id,p_correlation_id,'qandeel.runtime.conversation-turn-failed.v1',jsonb_build_object('user_id',p_user_id,'session_id',p_session_id,'source_turn_id',p_source_turn_id,'terminal_status','FAILED','processing_path',source_row.processing_path,'routing_reason',source_row.routing_reason,'orchestration_id',p_orchestration_id));
 RETURN NEXT source_row;
END;$$;

CREATE OR REPLACE FUNCTION public.cancel_conversation_turn(p_session_id uuid,p_user_id uuid,p_source_turn_id uuid,p_event_id uuid,p_correlation_id uuid DEFAULT NULL,p_orchestration_id uuid DEFAULT NULL)
RETURNS SETOF public.conversation_turns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns;
BEGIN
 IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 -- S8B-05 CP2 (0190, R2-G): a live call's turn is never FAILED, CANCELLED or SUPERSEDED by a generic command.
 IF EXISTS (SELECT 1 FROM public.conversation_call_turns ct WHERE ct.turn_id=p_source_turn_id) THEN RAISE EXCEPTION 'CALL_TURN_OWNED_BY_CALL_AUTHORITY' USING ERRCODE='55000';END IF;
 SELECT * INTO source_row FROM public.conversation_turns WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER' AND status IN ('RECEIVED','VALIDATED','CONTEXT_BUILDING','PROCESSING','GENERATING','STREAMING') FOR UPDATE;
 IF NOT FOUND THEN RETURN;END IF;
 UPDATE public.conversation_turns SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE id=p_source_turn_id RETURNING * INTO source_row;
 INSERT INTO public.runtime_event_outbox(event_id,event_type,subject_user_id,subject_session_id,subject_turn_id,correlation_id,schema_ref,payload)
 VALUES(p_event_id,'ConversationTurnCancelled',p_user_id,p_session_id,p_source_turn_id,p_correlation_id,'qandeel.runtime.conversation-turn-cancelled.v1',jsonb_build_object('user_id',p_user_id,'session_id',p_session_id,'source_turn_id',p_source_turn_id,'terminal_status','CANCELLED','processing_path',source_row.processing_path,'routing_reason',source_row.routing_reason,'orchestration_id',p_orchestration_id));
 RETURN NEXT source_row;
END;$$;

CREATE OR REPLACE FUNCTION public.recover_expired_generating_conversation_turn_v1(
  p_session_id uuid, p_user_id uuid, p_source_turn_id uuid,
  p_event_id uuid, p_correlation_id uuid DEFAULT NULL, p_orchestration_id uuid DEFAULT NULL
) RETURNS SETOF public.conversation_turns
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns; lease_claimed_at timestamptz; lease_expires_at timestamptz;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'INVALID_USER' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  -- S8B-05 CP2 (0190, R2-G): a live call's turn is never FAILED, CANCELLED or SUPERSEDED by a generic command.
  IF EXISTS (SELECT 1 FROM public.conversation_call_turns ct WHERE ct.turn_id=p_source_turn_id) THEN RAISE EXCEPTION 'CALL_TURN_OWNED_BY_CALL_AUTHORITY' USING ERRCODE='55000';END IF;
  SELECT * INTO source_row FROM public.conversation_turns
    WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER' AND status='GENERATING'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  -- Authoritative expiry: the server-owned lease when present; for
  -- legacy/null-lease rows the bounded fallback is updated_at plus the one
  -- frozen lease interval. Both are fail-closed: nothing expires early.
  lease_claimed_at := COALESCE(source_row.generation_claimed_at, source_row.updated_at);
  lease_expires_at := COALESCE(source_row.generation_lease_expires_at,
                               source_row.updated_at + public.foreground_generation_lease_interval_v1());
  IF lease_expires_at > CURRENT_TIMESTAMP THEN RETURN; END IF;
  UPDATE public.conversation_turns
    SET status='FAILED',
        generation_claimed_at=lease_claimed_at,
        generation_lease_expires_at=lease_expires_at,
        updated_at=CURRENT_TIMESTAMP
    WHERE id=p_source_turn_id RETURNING * INTO source_row;
  INSERT INTO public.runtime_event_outbox(event_id,event_type,subject_user_id,subject_session_id,subject_turn_id,correlation_id,schema_ref,payload)
  VALUES(p_event_id,'ConversationTurnFailed',p_user_id,p_session_id,p_source_turn_id,p_correlation_id,'qandeel.runtime.conversation-turn-failed.v1',jsonb_build_object('user_id',p_user_id,'session_id',p_session_id,'source_turn_id',p_source_turn_id,'terminal_status','FAILED','processing_path',source_row.processing_path,'routing_reason',source_row.routing_reason,'orchestration_id',p_orchestration_id));
  RETURN NEXT source_row;
END;$$;

-- Whatever the path: a call turn never becomes FAILED, CANCELLED or SUPERSEDED.
CREATE FUNCTION voice_private.guard_call_turn_terminal_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.conversation_call_turns ct WHERE ct.turn_id = NEW.id) THEN
    RAISE EXCEPTION 'CALL_TURN_OWNED_BY_CALL_AUTHORITY' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER conversation_turns_call_turn_terminal
  BEFORE UPDATE OF status ON public.conversation_turns
  FOR EACH ROW WHEN (NEW.status IN ('FAILED', 'CANCELLED', 'SUPERSEDED') AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION voice_private.guard_call_turn_terminal_v1();

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. INTERNALS.
-- ---------------------------------------------------------------------------------------------------------------------
-- The terms a turn or a reply segment is indexed under: the API's tokenizer output (memory-retrieval-terms.ts), bounded.
CREATE FUNCTION voice_private.call_terms_valid_v1(p_terms text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_terms IS NOT NULL AND cardinality(p_terms) <= 64 AND array_position(p_terms, NULL) IS NULL
     AND NOT EXISTS (SELECT 1 FROM unnest(p_terms) t WHERE length(t) NOT BETWEEN 2 AND 48 OR t <> lower(t));
$$;

-- The call row for a command of the connection holding `p_connection_epoch`: NULL outcome when it may act, FENCED for an
-- older epoch or a call that is not ACTIVE, NOT_FOUND for another person's call or no call.
CREATE FUNCTION voice_private.call_command_fence_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint, p_exclusive boolean)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_call voice_private.calls;
BEGIN
  IF p_exclusive THEN
    SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id FOR UPDATE;
  ELSE
    SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id FOR SHARE;
  END IF;
  IF NOT FOUND OR v_call.user_id <> p_user_id THEN RETURN 'NOT_FOUND'; END IF;
  IF v_call.state <> 'ACTIVE' OR v_call.connection_epoch <> p_connection_epoch THEN RETURN 'FENCED'; END IF;
  RETURN NULL;
END$$;

-- ONE close of an exchange (P2). Under the exchange row lock: the first commit wins, every later close answers
-- ALREADY_CLOSED with the frozen truth and changes nothing. The truth is taken from the facts at this instant:
--   * the heard mark: the confirmed playout mark, bounded by what the QANDEEL track holds from the reply's start (the
--     recorded-as-heard is never more than what is recorded) and, once the generation ended, by the audio it produced, in
--     whole 20 ms packets;
--   * content: the reply segments whose end ≤ the mark, in order (never text inferred from a cut segment's audio);
--   * delivery_state: FAILED when the generation failed with no audio; COMPLETE / WITHHELD_TAIL when the reply's
--     generation ended so and all its produced audio was heard; otherwise INTERRUPTED;
--   * anchor: [start, start + mark) on the call clock, NULL when nothing was heard.
-- The reply turn is COMPLETED (technical closure only), the user turn COMPLETED, and ConversationTurnCompleted v2 is
-- written with the turn's stored Safety disposition (R5′), the payload of finalize_conversation_turn_v2.
CREATE FUNCTION voice_private.close_call_exchange_core_v1(p_call_id uuid, p_call_turn_index integer, p_reason text,
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
BEGIN
  IF p_call_id IS NULL OR p_call_turn_index IS NULL OR p_assistant_turn_id IS NULL OR p_event_id IS NULL
     OR p_reason IS NULL OR p_reason NOT IN ('PLAYED_OUT', 'GENERATION_FAILED', 'NEXT_TURN', 'CALL_ENDING') THEN
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
  IF v_mark > 0 THEN
    v_start := v_ex.reply_clock_start_ms;
    v_end := v_ex.reply_clock_start_ms + v_mark;
  END IF;
  INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason,
                                         source_turn_id, completed_at)
  VALUES (p_assistant_turn_id, v_ex.session_id, v_ex.user_id, 'ASSISTANT', 'COMPLETED', v_text, v_user.processing_path,
          v_user.routing_reason, v_ex.user_turn_id, CURRENT_TIMESTAMP);
  INSERT INTO public.conversation_turn_voice_sources (turn_id, user_id, session_id, source_role, source_modality,
                                                      transcript_origin, asr_confidence_band, recording_id, anchor_start_ms,
                                                      anchor_end_ms, spoken, delivery_state)
  VALUES (p_assistant_turn_id, v_ex.user_id, v_ex.session_id, 'ASSISTANT', 'LIVE_CALL_SPEECH', NULL, NULL, v_recording,
          v_start, v_end, true, v_delivery);
  INSERT INTO public.conversation_call_turns (turn_id, user_id, session_id, call_id, call_turn_index, turn_role, turn_channel,
                                              retrieval_terms)
  VALUES (p_assistant_turn_id, v_ex.user_id, v_ex.session_id, p_call_id, p_call_turn_index, 'ASSISTANT', 'SPEECH',
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
  RETURN QUERY SELECT 'CLOSED'::text, p_assistant_turn_id, v_delivery, v_mark, v_start, v_end;
END$$;

-- A late command for an exchange that is already closed (P3): rejected, counted for measurement only, nothing changed.
CREATE FUNCTION voice_private.count_late_call_command_v1(p_call_id uuid, p_call_turn_index integer) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  UPDATE voice_private.call_exchanges e SET late_rejections = e.late_rejections + 1
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index AND e.exchange_state = 'CLOSED';
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. THE COMMANDS (F). service_role only; every one fenced by the connection epoch.
-- ---------------------------------------------------------------------------------------------------------------------
-- Commit one turn of the call. ONE transaction: N1 closes the open exchange with its confirmed truth, the turn takes the
-- call's next index, the USER turn is written GENERATING (FAST, the realtime reply's ledger path), the turn is numbered,
-- its exchange opens and its analysis half is queued (R7′). A SPEECH turn carries its machine transcript, band, recording
-- and anchor (a voice source); a TEXT turn (C2: typed during the call; its client path is P4, CP4) carries none and takes
-- the same order. Not 0131's admission: a call's turns are bounded by the call's own policy, so a long call is never
-- stopped by the text windows. Idempotent by the connection's commit id.
CREATE FUNCTION public.server_commit_live_call_turn_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint,
  p_turn_id uuid, p_commit_id uuid, p_turn_channel text, p_content text, p_asr_confidence_band text, p_anchor_start_ms bigint,
  p_anchor_end_ms bigint, p_retrieval_terms text[], p_close_assistant_turn_id uuid, p_close_event_id uuid)
RETURNS TABLE (outcome text, call_turn_index integer, turn_id uuid, closed_call_turn_index integer, closed_assistant_turn_id uuid,
               closed_delivery_state text, closed_heard_mark_ms bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  policy record;
  v_fence text;
  v_call voice_private.calls;
  v_recording voice_private.recordings;
  v_key text;
  v_existing public.conversation_turns;
  v_open voice_private.call_exchanges;
  v_closed_turn uuid;
  v_closed_delivery text;
  v_closed_mark bigint;
  v_index integer;
BEGIN
  SELECT * INTO policy FROM voice_private.live_call_turn_policy_v1();
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL OR p_turn_id IS NULL OR p_commit_id IS NULL
     OR p_content IS NULL OR btrim(p_content) = '' OR length(p_content) > policy.max_turn_chars
     OR p_turn_channel IS NULL OR p_turn_channel NOT IN ('SPEECH', 'TEXT')
     OR (p_turn_channel = 'SPEECH' AND (p_asr_confidence_band IS NULL OR p_asr_confidence_band NOT IN ('HIGH', 'MEDIUM', 'LOW')
         OR p_anchor_start_ms IS NULL OR p_anchor_end_ms IS NULL OR p_anchor_start_ms < 0 OR p_anchor_end_ms <= p_anchor_start_ms))
     OR (p_turn_channel = 'TEXT' AND (p_asr_confidence_band IS NOT NULL OR p_anchor_start_ms IS NOT NULL OR p_anchor_end_ms IS NOT NULL))
     OR NOT voice_private.call_terms_valid_v1(p_retrieval_terms)
     OR p_close_assistant_turn_id IS NULL OR p_close_event_id IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_fence := voice_private.call_command_fence_v1(p_user_id, p_call_id, p_connection_epoch, true);
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id;
  v_key := 'live-call:' || p_call_id::text || ':' || p_commit_id::text;
  IF v_call.id IS NOT NULL AND v_call.user_id = p_user_id THEN
    SELECT * INTO v_existing FROM public.conversation_turns t
     WHERE t.session_id = v_call.session_id AND t.user_id = p_user_id AND t.idempotency_key = v_key;
    IF FOUND THEN
      RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, ct.call_turn_index, v_existing.id, NULL::integer, NULL::uuid, NULL::text, NULL::bigint
        FROM public.conversation_call_turns ct WHERE ct.turn_id = v_existing.id;
      RETURN;
    END IF;
  END IF;
  IF v_fence IS NOT NULL THEN
    RETURN QUERY SELECT v_fence, NULL::integer, NULL::uuid, NULL::integer, NULL::uuid, NULL::text, NULL::bigint; RETURN;
  END IF;
  IF NOT voice_private.capability_enabled_v1('PERSONAL_LIVE_CALL') THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::integer, NULL::uuid, NULL::integer, NULL::uuid, NULL::text, NULL::bigint; RETURN;
  END IF;
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'CONSENT_REQUIRED'::text, NULL::integer, NULL::uuid, NULL::integer, NULL::uuid, NULL::text, NULL::bigint; RETURN;
  END IF;
  IF v_call.next_call_turn_index >= policy.max_call_turns THEN
    RETURN QUERY SELECT 'CALL_TURN_LIMIT'::text, NULL::integer, NULL::uuid, NULL::integer, NULL::uuid, NULL::text, NULL::bigint; RETURN;
  END IF;
  SELECT * INTO v_recording FROM voice_private.recordings r WHERE r.call_id = p_call_id AND r.user_id = p_user_id FOR SHARE;
  IF NOT FOUND OR v_recording.recording_state <> 'RECORDING' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::integer, NULL::uuid, NULL::integer, NULL::uuid, NULL::text, NULL::bigint; RETURN;
  END IF;
  -- The anchor lies inside what the USER track holds (CA-05-04): an anchor never points past the recording.
  IF p_turn_channel = 'SPEECH' AND p_anchor_end_ms > voice_private.track_clock_end_v1(v_recording.id, 'USER') THEN
    RAISE EXCEPTION 'VOICE_SOURCE_INVALID' USING ERRCODE = '22023',
      DETAIL = 'A live call anchor lies inside its track''s recorded or gapped range.';
  END IF;
  -- N1: the open exchange closes first, with its confirmed truth, in this transaction.
  SELECT * INTO v_open FROM voice_private.call_exchanges e WHERE e.call_id = p_call_id AND e.exchange_state = 'OPEN';
  IF FOUND THEN
    SELECT c.assistant_turn_id, c.delivery_state, c.heard_mark_ms INTO v_closed_turn, v_closed_delivery, v_closed_mark
      FROM voice_private.close_call_exchange_core_v1(p_call_id, v_open.call_turn_index, 'NEXT_TURN', p_close_assistant_turn_id,
                                                     p_close_event_id) c;
  END IF;
  v_index := voice_private.reserve_call_turn_index_v1(p_user_id, p_call_id, p_connection_epoch);
  INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason,
                                         source_turn_id, idempotency_key, completed_at)
  VALUES (p_turn_id, v_call.session_id, p_user_id, 'USER', 'GENERATING', p_content, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT',
          NULL, v_key, NULL);
  IF p_turn_channel = 'SPEECH' THEN
    INSERT INTO public.conversation_turn_voice_sources (turn_id, user_id, session_id, source_role, source_modality,
                                                        transcript_origin, asr_confidence_band, recording_id, anchor_start_ms,
                                                        anchor_end_ms)
    VALUES (p_turn_id, p_user_id, v_call.session_id, 'USER', 'LIVE_CALL_SPEECH', 'MACHINE_ASR', p_asr_confidence_band,
            v_recording.id, p_anchor_start_ms, p_anchor_end_ms);
  END IF;
  INSERT INTO public.conversation_call_turns (turn_id, user_id, session_id, call_id, call_turn_index, turn_role, turn_channel,
                                              retrieval_terms)
  VALUES (p_turn_id, p_user_id, v_call.session_id, p_call_id, v_index, 'USER', p_turn_channel, p_retrieval_terms);
  INSERT INTO voice_private.call_exchanges (call_id, call_turn_index, user_id, session_id, user_turn_id, committed_epoch)
  VALUES (p_call_id, v_index, p_user_id, v_call.session_id, p_turn_id, p_connection_epoch);
  INSERT INTO voice_private.call_analysis_queue (call_id, call_turn_index, half, user_id, session_id, turn_id)
  VALUES (p_call_id, v_index, 'USER', p_user_id, v_call.session_id, p_turn_id);
  RETURN QUERY SELECT 'COMMITTED'::text, v_index, p_turn_id, v_open.call_turn_index, v_closed_turn, v_closed_delivery, v_closed_mark;
END$$;

-- S1 – S3: the turn's Safety disposition, stored once before generation. The same value again is SAME; a different value
-- is a Safety error (the gate is deterministic over a fixed input). Allowed while the exchange is open, and as a no-op
-- comparison after it closed.
CREATE FUNCTION public.server_store_call_turn_safety_v1(p_user_id uuid, p_call_id uuid, p_call_turn_index integer,
  p_safety_disposition text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ex voice_private.call_exchanges;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_call_turn_index IS NULL OR p_safety_disposition IS NULL
     OR p_safety_disposition NOT IN ('ALLOW', 'GUIDED', 'BLOCK') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_ex FROM voice_private.call_exchanges e
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index AND e.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text; RETURN; END IF;
  IF v_ex.safety_disposition IS NOT NULL THEN
    IF v_ex.safety_disposition <> p_safety_disposition THEN
      RAISE EXCEPTION 'CALL_TURN_SAFETY_CONFLICT' USING ERRCODE = '55000';
    END IF;
    RETURN QUERY SELECT 'SAME'::text; RETURN;
  END IF;
  IF v_ex.exchange_state <> 'OPEN' THEN RAISE EXCEPTION 'CALL_EXCHANGE_INTEGRITY' USING ERRCODE = '55000'; END IF;
  UPDATE voice_private.call_exchanges e SET safety_disposition = p_safety_disposition
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index;
  RETURN QUERY SELECT 'STORED'::text;
END$$;

-- One spoken text piece of the reply, registered once its audio has been produced in full: contiguous on the reply's
-- offset clock, in order. Only while the exchange is open (P3).
CREATE FUNCTION public.server_register_call_reply_segment_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint,
  p_call_turn_index integer, p_segment_seq integer, p_segment_text text, p_start_offset_ms bigint, p_end_offset_ms bigint,
  p_retrieval_terms text[])
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  policy record;
  v_fence text;
  v_ex voice_private.call_exchanges;
  v_next integer;
  v_end bigint;
BEGIN
  SELECT * INTO policy FROM voice_private.live_call_turn_policy_v1();
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL OR p_call_turn_index IS NULL OR p_segment_seq IS NULL
     OR p_segment_seq < 0 OR p_segment_seq >= policy.max_segments OR p_segment_text IS NULL OR p_segment_text = ''
     OR length(p_segment_text) > policy.max_segment_chars OR p_start_offset_ms IS NULL OR p_end_offset_ms IS NULL
     OR p_start_offset_ms < 0 OR p_end_offset_ms <= p_start_offset_ms OR p_start_offset_ms % 20 <> 0 OR p_end_offset_ms % 20 <> 0
     OR NOT voice_private.call_terms_valid_v1(p_retrieval_terms) THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_fence := voice_private.call_command_fence_v1(p_user_id, p_call_id, p_connection_epoch, false);
  IF v_fence IS NOT NULL THEN RETURN QUERY SELECT v_fence; RETURN; END IF;
  SELECT * INTO v_ex FROM voice_private.call_exchanges e
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index AND e.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text; RETURN; END IF;
  IF v_ex.exchange_state <> 'OPEN' THEN
    PERFORM voice_private.count_late_call_command_v1(p_call_id, p_call_turn_index);
    RETURN QUERY SELECT 'CLOSED'::text; RETURN;
  END IF;
  SELECT count(*)::integer, coalesce(max(s.end_offset_ms), 0) INTO v_next, v_end FROM voice_private.call_reply_segments s
   WHERE s.call_id = p_call_id AND s.call_turn_index = p_call_turn_index;
  IF p_segment_seq <> v_next OR p_start_offset_ms <> v_end OR v_ex.generation_state = 'FAILED'
     OR (v_ex.generation_state <> 'GENERATING' AND p_end_offset_ms > v_ex.produced_audio_ms) THEN
    RAISE EXCEPTION 'CALL_REPLY_SEGMENT_OUT_OF_ORDER' USING ERRCODE = '55000';
  END IF;
  INSERT INTO voice_private.call_reply_segments (call_id, call_turn_index, segment_seq, user_id, segment_text, start_offset_ms,
                                                 end_offset_ms, retrieval_terms)
  VALUES (p_call_id, p_call_turn_index, p_segment_seq, p_user_id, p_segment_text, p_start_offset_ms, p_end_offset_ms,
          p_retrieval_terms);
  RETURN QUERY SELECT 'REGISTERED'::text;
END$$;

-- The reply's generation (text and speech) ended: COMPLETE, WITHHELD_TAIL (stopped after a released part) or FAILED (no
-- audio at all), with the audio produced. Once.
CREATE FUNCTION public.server_finish_call_reply_generation_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint,
  p_call_turn_index integer, p_generation_state text, p_produced_audio_ms bigint)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fence text;
  v_ex voice_private.call_exchanges;
  v_end bigint;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL OR p_call_turn_index IS NULL
     OR p_generation_state IS NULL OR p_generation_state NOT IN ('COMPLETE', 'WITHHELD_TAIL', 'FAILED')
     OR p_produced_audio_ms IS NULL OR p_produced_audio_ms < 0 OR p_produced_audio_ms % 20 <> 0
     OR (p_generation_state = 'FAILED') <> (p_produced_audio_ms = 0) THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_fence := voice_private.call_command_fence_v1(p_user_id, p_call_id, p_connection_epoch, false);
  IF v_fence IS NOT NULL THEN RETURN QUERY SELECT v_fence; RETURN; END IF;
  SELECT * INTO v_ex FROM voice_private.call_exchanges e
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index AND e.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text; RETURN; END IF;
  IF v_ex.exchange_state <> 'OPEN' THEN
    PERFORM voice_private.count_late_call_command_v1(p_call_id, p_call_turn_index);
    RETURN QUERY SELECT 'CLOSED'::text; RETURN;
  END IF;
  IF v_ex.generation_state <> 'GENERATING' THEN
    RETURN QUERY SELECT CASE WHEN v_ex.generation_state = p_generation_state AND v_ex.produced_audio_ms = p_produced_audio_ms
                             THEN 'ALREADY_FINISHED' ELSE 'CONFLICT' END;
    RETURN;
  END IF;
  SELECT coalesce(max(s.end_offset_ms), 0) INTO v_end FROM voice_private.call_reply_segments s
   WHERE s.call_id = p_call_id AND s.call_turn_index = p_call_turn_index;
  IF p_produced_audio_ms < v_end OR p_produced_audio_ms < v_ex.playout_mark_ms THEN
    RAISE EXCEPTION 'CALL_EXCHANGE_INTEGRITY' USING ERRCODE = '55000';
  END IF;
  UPDATE voice_private.call_exchanges e SET generation_state = p_generation_state, produced_audio_ms = p_produced_audio_ms
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index;
  RETURN QUERY SELECT 'FINISHED'::text;
END$$;

-- P1: the ONE confirmation mark of the turn — the highest played position only (an older or repeated one is IGNORED), and
-- only while the exchange is open (a late one is CLOSED, counted, and changes nothing). The first advance fixes where the
-- reply's offset 0 lies on the call clock (converted by the server from the phone's capture clock; never before the
-- QANDEEL track's end).
CREATE FUNCTION public.server_confirm_call_playout_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint,
  p_call_turn_index integer, p_played_ms bigint, p_reply_clock_start_ms bigint)
RETURNS TABLE (outcome text, playout_mark_ms bigint, reply_clock_start_ms bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fence text;
  v_ex voice_private.call_exchanges;
  v_recording uuid;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL OR p_call_turn_index IS NULL OR p_played_ms IS NULL
     OR p_played_ms < 0 OR (p_reply_clock_start_ms IS NOT NULL AND (p_reply_clock_start_ms < 0 OR p_reply_clock_start_ms % 20 <> 0)) THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_fence := voice_private.call_command_fence_v1(p_user_id, p_call_id, p_connection_epoch, false);
  IF v_fence IS NOT NULL THEN RETURN QUERY SELECT v_fence, NULL::bigint, NULL::bigint; RETURN; END IF;
  SELECT * INTO v_ex FROM voice_private.call_exchanges e
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index AND e.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bigint, NULL::bigint; RETURN; END IF;
  IF v_ex.exchange_state <> 'OPEN' THEN
    PERFORM voice_private.count_late_call_command_v1(p_call_id, p_call_turn_index);
    RETURN QUERY SELECT 'CLOSED'::text, v_ex.heard_mark_ms, v_ex.reply_clock_start_ms; RETURN;
  END IF;
  IF p_played_ms <= v_ex.playout_mark_ms THEN
    RETURN QUERY SELECT 'IGNORED'::text, v_ex.playout_mark_ms, v_ex.reply_clock_start_ms; RETURN;
  END IF;
  IF v_ex.reply_clock_start_ms IS NULL THEN
    SELECT r.id INTO v_recording FROM voice_private.recordings r WHERE r.call_id = p_call_id AND r.user_id = p_user_id;
    IF p_reply_clock_start_ms IS NULL OR v_recording IS NULL
       OR p_reply_clock_start_ms < voice_private.track_clock_end_v1(v_recording, 'QANDEEL') THEN
      RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
    END IF;
    v_ex.reply_clock_start_ms := p_reply_clock_start_ms;
  END IF;
  UPDATE voice_private.call_exchanges e SET playout_mark_ms = p_played_ms, reply_clock_start_ms = v_ex.reply_clock_start_ms
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index;
  RETURN QUERY SELECT 'ADVANCED'::text, p_played_ms, v_ex.reply_clock_start_ms;
END$$;

-- P2: a close by the connection holding the call (the natural end once all produced audio was heard, a generation that
-- failed with no audio, or the call's own end). The ONE close core decides; the first commit wins.
CREATE FUNCTION public.server_close_live_call_exchange_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint,
  p_call_turn_index integer, p_reason text, p_assistant_turn_id uuid, p_event_id uuid)
RETURNS TABLE (outcome text, assistant_turn_id uuid, delivery_state text, heard_mark_ms bigint, anchor_start_ms bigint,
               anchor_end_ms bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fence text;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL OR p_call_turn_index IS NULL
     OR p_reason IS NULL OR p_reason NOT IN ('PLAYED_OUT', 'GENERATION_FAILED', 'CALL_ENDING') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_fence := voice_private.call_command_fence_v1(p_user_id, p_call_id, p_connection_epoch, false);
  IF v_fence IS NOT NULL THEN
    RETURN QUERY SELECT v_fence, NULL::uuid, NULL::text, NULL::bigint, NULL::bigint, NULL::bigint; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM voice_private.call_exchanges e
                  WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index AND e.user_id = p_user_id) THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::bigint, NULL::bigint; RETURN;
  END IF;
  RETURN QUERY SELECT * FROM voice_private.close_call_exchange_core_v1(p_call_id, p_call_turn_index, p_reason,
                                                                       p_assistant_turn_id, p_event_id);
END$$;

-- AI-COST-01: one TTS ledger row per synthesis attempt of a call reply, bound to the exchange's USER turn (the reply turn
-- does not exist while it is spoken), begun only while the exchange is open. Settled once (UNKNOWN: FAILED, usage
-- unknown, never retried).
CREATE FUNCTION public.server_begin_call_reply_speech_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint,
  p_call_turn_index integer, p_provider_call_id uuid, p_requested_model text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fence text;
  v_ex voice_private.call_exchanges;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL OR p_call_turn_index IS NULL OR p_provider_call_id IS NULL
     OR p_requested_model IS NULL OR p_requested_model !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_fence := voice_private.call_command_fence_v1(p_user_id, p_call_id, p_connection_epoch, false);
  IF v_fence IS NOT NULL THEN RETURN QUERY SELECT v_fence; RETURN; END IF;
  SELECT * INTO v_ex FROM voice_private.call_exchanges e
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index AND e.user_id = p_user_id FOR SHARE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text; RETURN; END IF;
  IF v_ex.exchange_state <> 'OPEN' THEN RETURN QUERY SELECT 'CLOSED'::text; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.ai_provider_calls c WHERE c.id = p_provider_call_id) THEN
    RAISE EXCEPTION 'AI_PROVIDER_CALL_IDENTITY_CONFLICT' USING ERRCODE = 'PT409';
  END IF;
  PERFORM voice_private.begin_reply_speech_call_v1(p_provider_call_id, p_user_id, v_ex.session_id, v_ex.user_turn_id, p_requested_model);
  RETURN QUERY SELECT 'BEGUN'::text;
END$$;

-- AI-COST-01: the call's realtime recognition, one ledger row per recognition session (per connection), its audio as the
-- gateway measured it (GATEWAY_MEASURED: never evidence of what the provider billed).
CREATE FUNCTION public.server_begin_call_transcription_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint,
  p_provider_call_id uuid, p_requested_model text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fence text;
  v_session uuid;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL OR p_provider_call_id IS NULL
     OR p_requested_model IS NULL OR p_requested_model !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_fence := voice_private.call_command_fence_v1(p_user_id, p_call_id, p_connection_epoch, false);
  IF v_fence IS NOT NULL THEN RETURN QUERY SELECT v_fence; RETURN; END IF;
  SELECT c.session_id INTO v_session FROM voice_private.calls c WHERE c.id = p_call_id;
  IF EXISTS (SELECT 1 FROM public.ai_provider_calls c WHERE c.id = p_provider_call_id) THEN
    RAISE EXCEPTION 'AI_PROVIDER_CALL_IDENTITY_CONFLICT' USING ERRCODE = 'PT409';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.ai-provider-call.v1:' || p_user_id::text, 0));
  INSERT INTO public.ai_provider_calls (id, user_id, session_id, source_turn_id, provider, requested_model, operation,
                                        feature_family, processing_path, attempt_number, call_state, started_at)
  VALUES (p_provider_call_id, p_user_id, v_session, NULL, 'SPEECHMATICS', p_requested_model, 'SPEECHMATICS_REALTIME_TRANSCRIPTION',
          'LIVE_CALL_TRANSCRIPTION', NULL, 1, 'PENDING', clock_timestamp());
  RETURN QUERY SELECT 'BEGUN'::text;
END$$;

-- Settles one of the call's own ledger rows (recognition or synthesis) once; a settled or unknown row is left as it is.
-- Recognition: the gateway-measured audio, or unknown (a crashed session reports ABSENT, never zero). Synthesis: as the
-- provider reported it, or ABSENT; UNKNOWN settles FAILED with usage unknown.
CREATE FUNCTION public.server_settle_call_provider_call_v1(p_user_id uuid, p_provider_call_id uuid, p_outcome text,
  p_usage_completeness text, p_usage jsonb)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row public.ai_provider_calls;
  v_source text;
BEGIN
  IF p_user_id IS NULL OR p_provider_call_id IS NULL OR p_outcome IS NULL
     OR p_outcome NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED_BEFORE_PROVIDER', 'UNKNOWN')
     OR p_usage_completeness IS NULL OR p_usage_completeness NOT IN ('COMPLETE', 'INCOMPLETE', 'ABSENT') OR p_usage IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM public.ai_provider_calls c WHERE c.id = p_provider_call_id AND c.user_id = p_user_id;
  IF NOT FOUND OR NOT (v_row.feature_family = 'LIVE_CALL_TRANSCRIPTION'
                       OR (v_row.feature_family = 'SPEECH_SYNTHESIS' AND EXISTS (
                             SELECT 1 FROM voice_private.call_exchanges e WHERE e.user_turn_id = v_row.source_turn_id))) THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text; RETURN;
  END IF;
  IF v_row.call_state <> 'PENDING' THEN RETURN QUERY SELECT 'ALREADY_SETTLED'::text; RETURN; END IF;
  v_source := CASE WHEN v_row.feature_family = 'LIVE_CALL_TRANSCRIPTION' AND p_usage_completeness <> 'ABSENT'
                   THEN 'GATEWAY_MEASURED' ELSE 'PROVIDER_REPORTED' END;
  IF p_outcome = 'UNKNOWN' THEN
    PERFORM public.settle_ai_provider_call_v2(p_provider_call_id, p_user_id, 'FAILED', 'ABSENT', '{}'::jsonb, 'PROVIDER_REPORTED');
  ELSE
    PERFORM public.settle_ai_provider_call_v2(p_provider_call_id, p_user_id, p_outcome, p_usage_completeness,
                                              CASE WHEN p_usage_completeness = 'ABSENT' THEN '{}'::jsonb ELSE p_usage END, v_source);
  END IF;
  RETURN QUERY SELECT 'SETTLED'::text;
END$$;

-- The history's additive deliveryState (CA-05-02 §2.3): the meaning of each listed call reply of the owner's session, read on
-- the server channel beside the owner's own turns (the voice-source table is readable by no role). A turn that is not a
-- call reply is absent, never a fabricated state.
CREATE FUNCTION public.server_read_call_reply_delivery_v1(p_user_id uuid, p_session_id uuid, p_turn_ids uuid[])
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
     ORDER BY vs.turn_id;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. THE OWNER READS (G). SECURITY INVOKER: row-level security decides; no provider; no definer.
-- ---------------------------------------------------------------------------------------------------------------------
-- C2: the session's closed exchanges before this call, newest first (PRE_CALL), and this call's closed exchanges by
-- call_turn_index, newest first (CALL). The reply is what was heard (C3); the caller orders and bounds the window.
CREATE FUNCTION public.call_context_exchanges_v1(p_session_id uuid, p_call_id uuid, p_limit integer)
RETURNS TABLE (exchange_kind text, call_turn_index integer, user_content text, reply_content text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  (SELECT 'PRE_CALL'::text, NULL::integer, u.content, a.content
     FROM public.conversation_turns a
     JOIN public.conversation_turns u ON u.id = a.source_turn_id AND u.role = 'USER' AND u.session_id = p_session_id
    WHERE a.session_id = p_session_id AND a.role = 'ASSISTANT' AND a.status = 'COMPLETED'
      AND NOT EXISTS (SELECT 1 FROM public.conversation_call_turns c WHERE c.turn_id = u.id AND c.call_id = p_call_id)
    ORDER BY u.created_at DESC, u.id DESC
    LIMIT least(greatest(coalesce(p_limit, 0), 0), 24))
  UNION ALL
  (SELECT 'CALL'::text, c.call_turn_index, u.content, a.content
     FROM public.conversation_call_turns c
     JOIN public.conversation_turns u ON u.id = c.turn_id
     JOIN public.conversation_turns a ON a.source_turn_id = u.id AND a.role = 'ASSISTANT' AND a.status = 'COMPLETED'
    WHERE c.call_id = p_call_id AND c.turn_role = 'USER' AND u.session_id = p_session_id
    ORDER BY c.call_turn_index DESC
    LIMIT least(greatest(coalesce(p_limit, 0), 0), 24));
$$;

-- In-call retrieval (D-05-08, A1 §4): at most two earlier closed exchanges of this call, before `p_before_index`, whose
-- turns share two distinct terms with the current turn, or one term when the turn carries a recall cue. Terms are compared
-- for equality only (the Memory tokenizer normalized both sides). No provider; the caller bounds the bytes and the time.
CREATE FUNCTION public.call_turn_retrieval_v1(p_call_id uuid, p_terms text[], p_recall_cue boolean, p_before_index integer)
RETURNS TABLE (call_turn_index integer, user_content text, reply_content text, matched_terms integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH hits AS (
    SELECT c.call_turn_index, count(DISTINCT t)::integer AS matched
      FROM public.conversation_call_turns c, unnest(c.retrieval_terms) t
     WHERE c.call_id = p_call_id AND c.call_turn_index < p_before_index AND c.retrieval_terms && p_terms
       AND t = ANY (p_terms)
     GROUP BY c.call_turn_index)
  SELECT h.call_turn_index, u.content, a.content, h.matched
    FROM hits h
    JOIN public.conversation_call_turns cu ON cu.call_id = p_call_id AND cu.call_turn_index = h.call_turn_index AND cu.turn_role = 'USER'
    JOIN public.conversation_turns u ON u.id = cu.turn_id
    JOIN public.conversation_turns a ON a.source_turn_id = u.id AND a.role = 'ASSISTANT' AND a.status = 'COMPLETED'
   WHERE h.matched >= 2 OR (h.matched >= 1 AND coalesce(p_recall_cue, false))
   ORDER BY h.matched DESC, h.call_turn_index DESC
   LIMIT 2;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. EXPORT MY DATA (H).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION personal_data_private.build_personal_export_v1(p_subject uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'format', 'qandeel.personal-data-export.v1',
        'preparedAt', clock_timestamp(),
        'account', (
            SELECT jsonb_build_object(
                'name', u.name,
                'loginId', u.login_id,
                'publicId', u.public_id,
                'accountCreatedAt', u.created_at)
              FROM public.users u WHERE u.id = p_subject),
        'conversations', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'startedAt', s.created_at,
                       'lastActivityAt', s.last_activity_at,
                       'turns', coalesce((
                           SELECT jsonb_agg(jsonb_build_object(
                                      'speaker', CASE t.role WHEN 'USER' THEN 'you' ELSE 'qandeel' END,
                                      'text', t.content,
                                      'at', t.created_at,
                                      'state', lower(t.status))
                                  -- S8B-02 (0183, D-7): a voice turn says what it is: a machine transcript, its source
                                  -- and its band. A text turn gains nothing.
                                  || coalesce((SELECT jsonb_strip_nulls(jsonb_build_object(
                                                 'modality', CASE vs.source_modality WHEN 'VOICE_NOTE' THEN 'voice note'
                                                                                     ELSE 'live call' END,
                                                 'transcriptOrigin', vs.transcript_origin,
                                                 'confidenceBand', lower(vs.asr_confidence_band),
                                                 -- S8B-05 CP2 (0190, CA-05-02): what of QANDEEL's spoken reply was heard.
                                                 'deliveryState', lower(vs.delivery_state)))
                                         FROM public.conversation_turn_voice_sources vs WHERE vs.turn_id = t.id), '{}'::jsonb)
                                  ORDER BY t.created_at, t.id)
                             FROM public.conversation_turns t
                            WHERE t.session_id = s.id AND t.user_id = p_subject
                              AND (t.role = 'USER' OR (t.role = 'ASSISTANT' AND t.status = 'COMPLETED'))), '[]'::jsonb))
                   ORDER BY s.created_at, s.id)
              FROM public.conversation_sessions s WHERE s.user_id = p_subject), '[]'::jsonb),
        'memory', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'text', m.content,
                       'kind', lower(m.type),
                       'state', CASE m.status WHEN 'ACTIVE' THEN 'active'
                                              WHEN 'DISABLED' THEN 'not relied on'
                                              WHEN 'DELETED' THEN 'forgotten'
                                              WHEN 'SUPERSEDED' THEN 'replaced by a correction'
                                              ELSE lower(m.status) END,
                       'rememberedAt', m.created_at,
                       'lastChangedAt', m.updated_at,
                       'expiresAt', m.expires_at)
                   ORDER BY m.created_at, m.id)
              FROM public.memories m WHERE m.user_id = p_subject), '[]'::jsonb),
        'understanding', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'statement', h.statement,
                       'status', CASE WHEN h.status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK') THEN 'current'
                                      WHEN h.status = 'REOPENED' THEN 'being reconsidered'
                                      ELSE 'withdrawn' END,
                       'firstFormedAt', h.created_at,
                       'lastChangedAt', h.updated_at,
                       'yourDisagreements', coalesce((
                           SELECT jsonb_agg(c.created_at ORDER BY c.created_at)
                             FROM public.understanding_contests c
                            WHERE c.hypothesis_id = h.id AND c.user_id = p_subject), '[]'::jsonb))
                   ORDER BY h.created_at, h.id)
              FROM public.hypotheses h
             WHERE h.user_id = p_subject
               -- Only an interpretation the owner could have been shown: current now (the statuses the Understanding
               -- surface lists), or current at some point before it was reconsidered or withdrawn. A CANDIDATE, or one
               -- withdrawn before it was ever admitted, is QANDEEL's own unshown reasoning (hypothesis restraint).
               AND (h.status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK')
                    OR (h.status IN ('REOPENED', 'REJECTED', 'RETIRED')
                        AND EXISTS (SELECT 1 FROM public.hypothesis_lifecycle_transitions t
                                     WHERE t.hypothesis_id = h.id AND t.user_id = p_subject
                                       AND t.after_status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK'))))), '[]'::jsonb),
        -- IP-IMP-01 (0153): the owner's four durable interaction preferences, in readable words. No row: all automatic.
        'interactionPreferences', (
            SELECT jsonb_build_object(
                       'replyLength', CASE coalesce(p.reply_length, 'DEFAULT') WHEN 'ALWAYS_BRIEF' THEN 'always brief' ELSE 'automatic' END,
                       'replyLanguage', CASE coalesce(p.reply_language, 'DEFAULT')
                                            WHEN 'EGYPTIAN_ARABIC' THEN 'Egyptian Arabic'
                                            WHEN 'MODERN_STANDARD_ARABIC' THEN 'Modern Standard Arabic'
                                            WHEN 'LEVANTINE_ARABIC' THEN 'Levantine Arabic'
                                            WHEN 'GULF_ARABIC' THEN 'Gulf Arabic'
                                            WHEN 'MAGHREBI_ARABIC' THEN 'Maghrebi Arabic'
                                            WHEN 'ENGLISH' THEN 'English'
                                            ELSE 'automatic' END,
                       'humour', CASE coalesce(p.humour, 'DEFAULT') WHEN 'WELCOME' THEN 'welcome' WHEN 'DECLINED' THEN 'no humour' ELSE 'automatic' END,
                       'explanationStyle', CASE coalesce(p.explanation_style, 'DEFAULT')
                                               WHEN 'SIMPLER' THEN 'simpler'
                                               WHEN 'DIRECT' THEN 'direct'
                                               WHEN 'SIMPLER_AND_DIRECT' THEN 'simple and direct'
                                               ELSE 'automatic' END,
                       'lastChangedAt', p.updated_at)
              FROM (SELECT 1) AS one LEFT JOIN public.interaction_preferences p ON p.user_id = p_subject),
        -- S6-07 (0168): the reader's OWN Matching and Introductions data, in readable words (QAN-BL-PRIV-04, CA-EXP).
        -- Every sub-select is keyed on p_subject as owner, author, actor or bound recipient. Nothing names, quotes or
        -- describes another human; no internal identifier, digest, score, reason, role or proposal state is printed; a
        -- proposal appears only once it was delivered to the reader, and never with the instant it arrived (Q9).
        'matchingAndIntroductions', jsonb_build_object(
            'preparation', jsonb_build_object(
                'draft', (
                    SELECT jsonb_build_object(
                               'shortIntroduction', d.short_introduction,
                               'workField', lower(replace(d.work_field, '_', ' ')),
                               'requirements', jsonb_build_object('answer', lower(replace(d.hard_answer, '_', ' ')), 'items', d.hard_items),
                               'preferences', jsonb_build_object('answer', lower(replace(d.soft_answer, '_', ' ')), 'items', d.soft_items),
                               'skippedSteps', (SELECT coalesce(jsonb_agg(lower(replace(s.step, '_', ' ')) ORDER BY s.step), '[]'::jsonb)
                                                  FROM unnest(d.skipped_steps) AS s(step)),
                               'reviewedAt', d.reviewed_at,
                               'startedAt', d.created_at,
                               'lastChangedAt', d.updated_at)
                      FROM introductions_preparation_private.drafts d WHERE d.user_id = p_subject),
                'declaredFacts', (
                    SELECT jsonb_build_object(
                               'firstName', CASE WHEN f.first_name IS NULL THEN NULL ELSE jsonb_build_object(
                                   'value', f.first_name, 'state', lower(f.first_name_state), 'confirmedAt', f.first_name_confirmed_at) END,
                               'sex', CASE WHEN f.sex IS NULL THEN NULL ELSE jsonb_build_object(
                                   'value', lower(f.sex), 'state', lower(f.sex_state), 'confirmedAt', f.sex_confirmed_at) END,
                               'birth', CASE WHEN f.birth_year IS NULL THEN NULL ELSE jsonb_build_object(
                                   'year', f.birth_year, 'month', f.birth_month, 'state', lower(f.birth_state), 'confirmedAt', f.birth_confirmed_at) END,
                               'area', CASE WHEN f.country_code IS NULL THEN NULL ELSE jsonb_build_object(
                                   'country', f.country_code, 'region', f.region_code, 'state', lower(f.area_state), 'confirmedAt', f.area_confirmed_at) END,
                               'maritalStatus', CASE WHEN f.marital_status IS NULL THEN NULL ELSE jsonb_build_object(
                                   'value', lower(replace(f.marital_status, '_', ' ')), 'state', lower(f.marital_state), 'confirmedAt', f.marital_confirmed_at) END)
                      FROM introductions_preparation_private.declared_facts f WHERE f.user_id = p_subject),
                'notes', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'kind', lower(replace(n.kind, '_', ' ')),
                               'origin', CASE n.origin WHEN 'USER_AUTHORED' THEN 'written by you'
                                                       WHEN 'CONFIRMED_FROM_PRIOR_UNDERSTANDING' THEN 'confirmed by you'
                                                       ELSE 'corrected by you' END,
                               'text', n.body,
                               'writtenAt', n.created_at)
                           ORDER BY n.created_at, n.id)
                      FROM introductions_preparation_private.notes n WHERE n.user_id = p_subject), '[]'::jsonb),
                'earlierUnderstandingDecisions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object('decision', lower(replace(p.decision, '_', ' ')), 'decidedAt', p.decided_at)
                           ORDER BY p.decided_at, p.memory_id)
                      FROM introductions_preparation_private.prior_understanding_decisions p WHERE p.user_id = p_subject), '[]'::jsonb),
                'assistanceConsents', coalesce((
                    SELECT jsonb_agg(jsonb_build_object('version', c.consent_version, 'givenAt', c.granted_at, 'withdrawnAt', c.revoked_at)
                           ORDER BY c.granted_at, c.id)
                      FROM introductions_preparation_private.assistance_consents c WHERE c.user_id = p_subject), '[]'::jsonb)),
            'enrollment', jsonb_build_object(
                'acts', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'act', CASE a.act_kind WHEN 'ENROLL' THEN 'enrolled' WHEN 'CORRECTION' THEN 'corrected'
                                                      WHEN 'RESUME' THEN 'resumed' ELSE 'consent given again' END,
                               'at', a.committed_at,
                               'reviewedDraftVersion', a.draft_version,
                               'consentVersions', jsonb_build_object(
                                   'participation', a.participation_consent_version,
                                   'contextGrant', a.context_consent_version,
                                   'disclosureAuthority', a.disclosure_consent_version))
                           ORDER BY a.committed_at, a.command_id)
                      FROM matching_enrollment_private.enrollment_acts a WHERE a.user_id = p_subject), '[]'::jsonb),
                'participation', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'act', lower(replace(e.participation_act, '_', ' ')),
                               'state', lower(e.resulting_state),
                               'pauseReason', lower(replace(e.resulting_pause_reason, '_', ' ')),
                               'entry', lower(replace(e.activation_entry_channel, '_', ' ')),
                               'at', e.occurred_at)
                           ORDER BY e.occurred_at, e.id)
                      FROM public.matching_participation_events e WHERE e.participant_user_id = p_subject), '[]'::jsonb),
                'contextGrant', coalesce((
                    SELECT jsonb_agg(jsonb_build_object('event', lower(e.event_type), 'at', e.occurred_at) ORDER BY e.occurred_at, e.id)
                      FROM public.matching_context_consent_events e WHERE e.grantor_user_id = p_subject), '[]'::jsonb),
                'disclosureAuthority', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'event', lower(e.event_type),
                               'at', e.occurred_at,
                               'approvedFields', CASE WHEN e.event_type = 'REVOKED' THEN NULL ELSE coalesce((
                                   SELECT jsonb_agg(lower(replace(af.field_key, '_', ' ')) ORDER BY af.field_key)
                                     FROM public.pre_match_disclosure_authority_fields af
                                    WHERE af.authority_id = e.subject_authority_id), '[]'::jsonb) END)
                           ORDER BY e.occurred_at, e.id)
                      FROM public.pre_match_disclosure_authority_events e WHERE e.grantor_user_id = p_subject), '[]'::jsonb),
                'introductionProfileVersions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'createdAt', v.created_at,
                               'fields', coalesce((
                                   SELECT jsonb_agg(jsonb_build_object('field', lower(replace(fv.field_key, '_', ' ')), 'value', fv.field_value)
                                          ORDER BY fv.field_key)
                                     FROM public.introduction_profile_field_values fv WHERE fv.profile_version_id = v.id), '[]'::jsonb))
                           ORDER BY v.created_at, v.id)
                      FROM public.introduction_profile_versions v WHERE v.owner_user_id = p_subject), '[]'::jsonb),
                'requirementVersions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'createdAt', v.created_at,
                               'items', coalesce((
                                   SELECT jsonb_agg(jsonb_build_object(
                                              'requirement', lower(replace(i.requirement_key, '_', ' ')),
                                              'strength', CASE i.requirement_strength WHEN 'HARD_DEALBREAKER' THEN 'required' ELSE 'preferred' END,
                                              'value', i.requirement_value)
                                          ORDER BY i.requirement_strength, i.requirement_key)
                                     FROM public.matching_requirement_items i WHERE i.requirement_version_id = v.id), '[]'::jsonb))
                           ORDER BY v.created_at, v.id)
                      FROM public.matching_requirement_versions v WHERE v.owner_user_id = p_subject), '[]'::jsonb)),
            'confirmedFacts', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'firstName', f.first_name,
                           'sex', lower(f.sex),
                           'birthYear', f.birth_year,
                           'birthMonth', f.birth_month,
                           'country', f.country_code,
                           'region', f.region_code,
                           'maritalStatus', lower(replace(f.marital_status, '_', ' ')),
                           'confirmedAt', jsonb_build_object(
                               'firstName', f.first_name_confirmed_at, 'sex', f.sex_confirmed_at, 'birth', f.birth_confirmed_at,
                               'area', f.area_confirmed_at, 'maritalStatus', f.marital_confirmed_at),
                           'recordedAt', f.recorded_at)
                       ORDER BY f.recorded_at, f.id)
                  FROM public.matching_confirmed_fact_versions f WHERE f.owner_user_id = p_subject), '[]'::jsonb),
            -- A proposal only once it was DELIVERED to the reader (CW2-06 §53): the one neutral word their own proposal
            -- screen shows (resolve_my_matching_proposal_presentation_v1's mapping, a live one past its deadline or no
            -- longer valid included) and the reader's own decisions. Never the other human, a conclusion, a role, a
            -- state, a reason, a deadline or when it arrived.
            'proposals', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'outcome', (
                               SELECT CASE CASE WHEN n.neutral_outcome NOT IN ('AWAITING_YOU', 'IN_PROGRESS') THEN n.neutral_outcome
                                                WHEN p.expires_at <= clock_timestamp() THEN 'NO_LONGER_AVAILABLE'
                                                WHEN (SELECT v.still_valid FROM public.resolve_matching_proposal_validity_v1(p.id) v) IS NOT TRUE
                                                  THEN 'NO_LONGER_AVAILABLE'
                                                ELSE n.neutral_outcome END
                                        WHEN 'AWAITING_YOU' THEN 'awaiting you'
                                        WHEN 'IN_PROGRESS' THEN 'in progress'
                                        WHEN 'CLOSED_BY_YOU' THEN 'closed by you'
                                        WHEN 'MATCH_CONCLUDED' THEN 'matched'
                                        ELSE 'no longer available' END
                                 FROM public.matching_proposals p
                                 CROSS JOIN LATERAL public.resolve_matching_proposal_neutral_outcome_v1(p.id, p_subject) n
                                WHERE p.id = x.proposal_id),
                           'yourDecisions', coalesce((
                               SELECT jsonb_agg(jsonb_build_object('decision', own.decision, 'at', own.at) ORDER BY own.at, own.decision)
                                 FROM (SELECT 'approved'::text AS decision, fa.bound_at AS at
                                         FROM public.matching_forward_approval_view_bindings fa
                                        WHERE fa.proposal_id = x.proposal_id AND fa.approver_user_id = p_subject
                                       UNION ALL
                                       SELECT CASE db.decision_state WHEN 'WITHDRAWN' THEN 'withdrawn' ELSE 'declined' END, db.bound_at
                                         FROM public.matching_proposal_decision_view_bindings db
                                        WHERE db.proposal_id = x.proposal_id AND db.decider_user_id = p_subject
                                       UNION ALL
                                       SELECT 'accepted', mc.committed_at
                                         FROM public.matching_match_commits mc
                                        WHERE mc.proposal_id = x.proposal_id AND mc.candidate_user_id = p_subject) own), '[]'::jsonb))
                       ORDER BY x.first_delivered, x.proposal_id)
                  FROM (SELECT b.proposal_id, min(b.bound_at) AS first_delivered
                          FROM public.matching_proposal_delivery_view_bindings b
                         WHERE b.recipient_user_id = p_subject
                         GROUP BY b.proposal_id) x), '[]'::jsonb),
            -- Each Introduction the reader is one of the two humans of: what the reader themselves wrote, shared and
            -- decided in it - never the other human's words, shares, photo or name, and never who ended it when the
            -- reader did not. Messages are the Introduction era only (after a valid SUCCESS the World is a Shared World,
            -- whose export is QAN-BL-PRIV-05's). A message, share or stage its owner deleted has no body and is absent.
            'introductions', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'startedAt', r.started_at,
                           'state', CASE r.introduction_status WHEN 'ACTIVE' THEN 'active'
                                                               WHEN 'COMPLETED' THEN 'continued as a shared world'
                                                               ELSE 'ended' END,
                           'endedAt', CASE WHEN r.introduction_status = 'CLOSED' THEN r.ended_at END,
                           'endedByYou', CASE WHEN r.introduction_status = 'CLOSED' THEN EXISTS (
                               SELECT 1 FROM public.introduction_ended_events e
                                WHERE e.introduction_record_id = r.id AND e.actor_user_id = p_subject) END,
                           'continuedAt', CASE WHEN r.introduction_status = 'COMPLETED' THEN r.ended_at END,
                           'yourMessages', coalesce((
                               SELECT jsonb_agg(jsonb_build_object('text', b.body_text, 'at', m.established_at) ORDER BY m.established_at, m.id)
                                 FROM public.shared_world_materials m
                                 JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
                                WHERE m.world_id = r.world_id AND m.author_user_id = p_subject AND m.material_kind = 'HUMAN_TEXT'
                                  AND shared_private.is_introduction_era_history_item_v1(m.world_id, m.history_item_id)), '[]'::jsonb),
                           'yourShares', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'kind', lower(replace(v.resource_type, '_', ' ')),
                                          'field', lower(replace(t.field_key, '_', ' ')),
                                          'text', t.text_value,
                                          'sharedAt', v.established_at)
                                      ORDER BY v.established_at, v.id)
                                 FROM public.introduction_disclosure_resource_versions v
                                 JOIN public.introduction_disclosure_text_payloads t ON t.resource_version_id = v.id
                                WHERE v.introduction_record_id = r.id AND v.world_id = r.world_id AND v.owner_user_id = p_subject), '[]'::jsonb),
                           -- The reader's own photo: its state and the derived renditions that still exist (the upload itself
                           -- is never stored), each stage shared or not; the files themselves travel beside the package.
                           'yourPhotos', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'state', CASE WHEN s.series_state IN ('READY', 'DISCLOSING') THEN 'live'
                                                        WHEN EXISTS (SELECT 1 FROM introduction_sharing_private.image_renditions kept
                                                                      WHERE kept.series_id = s.id) THEN 'shared'
                                                        ELSE 'removed' END,
                                          'stages', coalesce((
                                              SELECT jsonb_agg(jsonb_build_object('stage', rr.stage, 'shared', vis.at IS NOT NULL, 'sharedAt', vis.at)
                                                     ORDER BY rr.stage)
                                                FROM introduction_sharing_private.image_renditions rr
                                                LEFT JOIN LATERAL (
                                                    SELECT dv.established_at AS at
                                                      FROM introduction_sharing_private.image_stage_disclosures sd
                                                      JOIN public.introduction_disclosure_media_payloads mp ON mp.resource_version_id = sd.resource_version_id
                                                      JOIN public.introduction_disclosure_resource_versions dv ON dv.id = sd.resource_version_id
                                                     WHERE sd.series_id = rr.series_id AND sd.stage = rr.stage) vis ON true
                                               WHERE rr.series_id = s.id), '[]'::jsonb))
                                      ORDER BY (s.series_state IN ('READY', 'DISCLOSING')), s.id)
                                 FROM introduction_sharing_private.image_series s
                                WHERE s.introduction_record_id = r.id AND s.world_id = r.world_id AND s.owner_user_id = p_subject
                                  AND s.series_state <> 'PENDING'), '[]'::jsonb),
                           'yourNameDisplay', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'act', CASE e.display_act WHEN 'GRANT' THEN 'full name shown' ELSE 'first name shown again' END,
                                          'at', e.occurred_at)
                                      ORDER BY e.occurred_at, e.id)
                                 FROM introduction_sharing_private.name_display_events e
                                WHERE e.world_id = r.world_id AND e.owner_user_id = p_subject), '[]'::jsonb),
                           'yourContinuationApprovals', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'act', CASE e.approval_act WHEN 'APPROVE' THEN 'approved' ELSE 'approval withdrawn' END,
                                          'at', e.occurred_at)
                                      ORDER BY e.occurred_at, e.id)
                                 FROM public.introduction_success_approval_events e
                                 JOIN public.introduction_success_transition_versions tv ON tv.id = e.transition_version_id
                                WHERE tv.introduction_record_id = r.id AND e.approver_user_id = p_subject), '[]'::jsonb))
                       ORDER BY r.started_at, r.world_id)
                  FROM public.introduction_records r WHERE p_subject IN (r.lower_user_id, r.higher_user_id)), '[]'::jsonb),
            -- An ended Introduction whose other human erased their account: the reader's own words they keep (0164).
            'keptIntroductions', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'startedAt', w.born_at,
                           'state', 'ended',
                           'keptAt', rv.retained_at,
                           'yourMessages', coalesce((
                               SELECT jsonb_agg(jsonb_build_object('text', b.body_text, 'at', m.established_at) ORDER BY m.established_at, m.id)
                                 FROM public.introduction_retained_view_items it
                                 JOIN public.shared_world_materials m ON m.history_item_id = it.history_item_id AND m.world_id = it.world_id
                                 JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
                                WHERE it.world_id = rv.world_id AND it.user_id = p_subject
                                  AND m.author_user_id = p_subject AND m.material_kind = 'HUMAN_TEXT'), '[]'::jsonb))
                       ORDER BY w.born_at, rv.world_id)
                  FROM public.introduction_retained_views rv
                  JOIN public.shared_worlds w ON w.id = rv.world_id
                 WHERE rv.user_id = p_subject), '[]'::jsonb),
            'resumedAfterIntroductions', coalesce((
                SELECT jsonb_agg(jsonb_build_object('act', own.act, 'at', own.at) ORDER BY own.at, own.act)
                  FROM (SELECT lower(c.reactivation_act) AS act, c.committed_at AS at
                          FROM public.matching_introduction_reactivation_commands c WHERE c.participant_user_id = p_subject
                        UNION ALL
                        SELECT lower(c.reactivation_act), c.committed_at
                          FROM public.matching_counterpart_erasure_reactivation_commands c WHERE c.participant_user_id = p_subject
                        UNION ALL
                        SELECT 'free to resume', rl.released_at
                          FROM public.matching_counterpart_erasure_releases rl WHERE rl.participant_user_id = p_subject) own), '[]'::jsonb)),
        -- S8A-05 (0179): the reader's OWN private Public topic drafts, as written (title, text, section key). A draft
        -- prepared as a topic says so; nothing of the Public copy, its identity or its review is printed here.
        'publicTopicDrafts', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'title', d.title,
                       'text', d.body,
                       'section', d.section_key,
                       'state', CASE WHEN d.prepared_experience_id IS NULL THEN 'editing' ELSE 'prepared for publication' END,
                       'createdAt', d.created_at,
                       'lastChangedAt', d.updated_at,
                       -- S8A-05 CP2 (0180): the draft's source as a REFERENCE only, never a copied text.
                       'source', CASE d.source_kind
                         WHEN 'CONVERSATION' THEN jsonb_build_object(
                           'kind', 'conversation',
                           'conversationStartedAt', (SELECT s.created_at FROM public.conversation_sessions s
                                                      WHERE s.id = d.source_session_id AND s.user_id = p_subject),
                           'firstPosition', d.source_first_sp,
                           'lastPosition', d.source_last_sp,
                           'includesQandeelReplies', d.source_include_qandeel,
                           'excludedMessagePositions', to_jsonb(d.source_excluded_sps),
                           'emphasizedMessagePositions', to_jsonb(d.source_emphasized_sps))
                         WHEN 'UNDERSTANDING' THEN jsonb_build_object(
                           'kind', 'qandeel understanding',
                           'understandingVersion', d.source_hypothesis_version)
                         END)
                   ORDER BY d.created_at, d.id)
              FROM public_compose_private.topic_drafts d WHERE d.user_id = p_subject), '[]'::jsonb),
        'notYetIncluded', jsonb_build_array('shared', 'public', 'replay'))
    -- S8B-02 (0183, D-7): the retained voice recordings, as metadata only (no key, no audio). An account with none
    -- gains nothing, so its document is unchanged; the files themselves are CP2's per-file route.
    || CASE WHEN EXISTS (SELECT 1 FROM voice_private.recordings r
                          WHERE r.user_id = p_subject AND r.recording_state IN ('RECORDING', 'STORED')
                            AND clock_timestamp() < r.retention_expires_at)
       THEN jsonb_build_object('voiceRecordings', (
              SELECT jsonb_agg(jsonb_build_object(
                         'kind', CASE r.recording_kind WHEN 'VOICE_NOTE' THEN 'voice note' ELSE 'live call' END,
                         'recordedAt', coalesce(r.accepted_at, r.started_at),
                         'availableUntil', r.retention_expires_at,
                         'state', CASE r.recording_state WHEN 'STORED' THEN 'stored' ELSE 'recording' END)
                     ORDER BY coalesce(r.accepted_at, r.started_at), r.id)
                FROM voice_private.recordings r
               WHERE r.user_id = p_subject AND r.recording_state IN ('RECORDING', 'STORED')
                 AND clock_timestamp() < r.retention_expires_at))
       ELSE '{}'::jsonb END;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. ACCOUNT ERASURE COVERAGE. Every new relation cascades from the account row and from its turns (the Personal
--     erasure deletes the turns first; the call record leaves with the account).
-- ---------------------------------------------------------------------------------------------------------------------
INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('conversation_call_turns', 'ACCOUNT_CASCADE'),
    ('voice_private.call_exchanges', 'ACCOUNT_CASCADE'),
    ('voice_private.call_reply_segments', 'ACCOUNT_CASCADE'),
    ('voice_private.call_analysis_queue', 'ACCOUNT_CASCADE');

-- ---------------------------------------------------------------------------------------------------------------------
-- 11. OWNERSHIP, RLS AND ACL.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  rel text;
  fn text;
  r text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['voice_private.call_exchanges', 'voice_private.call_reply_segments', 'voice_private.call_analysis_queue'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', rel);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', rel);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', rel);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', rel, r); END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'voice_private.live_call_turn_policy_v1()',
    'voice_private.guard_call_turn_terminal_v1()',
    'voice_private.call_terms_valid_v1(text[])',
    'voice_private.call_command_fence_v1(uuid,uuid,bigint,boolean)',
    'voice_private.close_call_exchange_core_v1(uuid,integer,text,uuid,uuid)',
    'voice_private.count_late_call_command_v1(uuid,integer)',
    'public.server_commit_live_call_turn_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,bigint,bigint,text[],uuid,uuid)',
    'public.server_store_call_turn_safety_v1(uuid,uuid,integer,text)',
    'public.server_register_call_reply_segment_v1(uuid,uuid,bigint,integer,integer,text,bigint,bigint,text[])',
    'public.server_finish_call_reply_generation_v1(uuid,uuid,bigint,integer,text,bigint)',
    'public.server_confirm_call_playout_v1(uuid,uuid,bigint,integer,bigint,bigint)',
    'public.server_close_live_call_exchange_v1(uuid,uuid,bigint,integer,text,uuid,uuid)',
    'public.server_begin_call_reply_speech_v1(uuid,uuid,bigint,integer,uuid,text)',
    'public.server_begin_call_transcription_v1(uuid,uuid,bigint,uuid,text)',
    'public.server_settle_call_provider_call_v1(uuid,uuid,text,text,jsonb)',
    'public.server_read_call_reply_delivery_v1(uuid,uuid,uuid[])'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
    END LOOP;
    IF fn LIKE 'public.server\_%' AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
  -- The two owner reads: invoker functions, executed by the owner's own token only.
  FOREACH fn IN ARRAY ARRAY['public.call_context_exchanges_v1(uuid,uuid,integer)', 'public.call_turn_retrieval_v1(uuid,text[],boolean,integer)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 12. DEPLOY GUARD.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  IF (SELECT count(*) FROM voice_private.voice_launch_capability_states s
       WHERE s.feature_flag_state = 'DISABLED' AND s.launch_requirements_state = 'UNSATISFIED') <> 4 THEN
    RAISE EXCEPTION 'S8B-05 CP2: every voice capability scope must remain DISABLED / UNSATISFIED';
  END IF;
  SELECT count(*) INTO v_count FROM pg_constraint c
   WHERE c.contype = 'f'
     AND (c.confrelid = 'public.users'::regclass
          OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'VOICE'))
     AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g);
  IF v_count <> 0 THEN RAISE EXCEPTION 'S8B-05 CP2: a relation referencing the account or a voice relation is unregistered'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'voice_private' AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC'))
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND (p.proname LIKE 'server\_%call%')
                   AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))) THEN
    RAISE EXCEPTION 'S8B-05 CP2: a voice relation or a call definer is reachable by a client role';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'public' AND g.table_name = 'conversation_call_turns'
                AND (g.grantee IN ('anon', 'service_role', 'PUBLIC') OR (g.grantee = 'authenticated' AND g.privilege_type <> 'SELECT'))) THEN
    RAISE EXCEPTION 'S8B-05 CP2: the call turn order is readable by its owner only and written by no role';
  END IF;
END$$;

COMMIT;
