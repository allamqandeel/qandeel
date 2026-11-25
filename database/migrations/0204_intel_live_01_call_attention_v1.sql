-- INTEL-LIVE-01 CP1 — continuous in-speech understanding: the call's provisional attention, its evidence coverage and its
-- settlement. Product Owner "INTEL-LIVE-01 — Final PO Execution Authorization" (2026-11-25) on the CP0 contract stack
-- v1.0 -> v1.1 -> A1 (v1.2, semantic-driven) -> A2 (final execution conditions); D-2 and D-4 approved. Not hosted.
--
-- ## What this is
--
--   While a person speaks in a live call, every FINAL segment of their speech (and every heard piece of QANDEEL's) is
--   evidence that DeepSeek, QANDEEL's semantic authority, evaluates in order: one evaluation in flight per call, the next
--   admitted the moment the previous resolves, covering ALL the evidence since the last covered position. An evaluation
--   yields DEVELOPMENTS (attention events) or NONE. This migration is the durable truth of that lane:
--
--   A. voice_private.call_attention_evaluations — THE COVERAGE LEDGER. One row per admission or recorded miss: the evidence
--      span it accounts for (track + call-clock range), its outcome, and its measurements. Nothing is silently lost: a span
--      is covered (DEVELOPMENTS / NONE), explicitly missed (MISSED_HANDOVER / DEGRADED_SUSPENDED), or still pending.
--   B. voice_private.call_attention_events — THE ATTENTION EVENTS. SET / WITHDRAW from an evaluation; CONFIRMED / EXPIRED
--      from settlement. Content is a subject key, a short label, a kind, a confidence and an optional reference to one of
--      the person's OWN durable Threads — never a transcript, never an INTERIM, never audio. Three instants per producer
--      event on the call clock: the words' position (anchor), the evidence's arrival (evidence), the interpretation's
--      production (produced); the fourth, the commit, is the row's xact_id. Arrival on the phone is NOT recorded (unproven).
--   C. voice_private.call_attention_settlements — one marker per settled half (call, track, call turn): when the durable
--      analysis of a turn has completed, every attention subject still open on that track up to the turn's end is closed
--      CONFIRMED (its Thread reference is one of the Threads that half bound — identity by id, never by text) or EXPIRED.
--   D. public.server_record_call_attention_evaluation_v1 — THE ONE WRITER: the coverage row, its events and the
--      watermark's advance in ONE transaction, numbered under the call's lock and fenced by the connection epoch.
--      Idempotent (ALREADY_COVERED); a late or overlapping result is recorded and refused (STALE_RESULT,
--      STALE_AFTER_SETTLEMENT, STALE_AFTER_END): no late evaluation overwrites newer understanding.
--   E. public.server_read_call_attention_state_v1 — the per-track watermark and the open subjects (a resumed or moved
--      connection starts from it; nothing open is reported once the call has ended: attention expires with the call).
--      public.server_read_call_attention_threads_v1 — the person's named Threads of the session the evaluator may refer
--      to (the names COSMOS shows, 0198 D-3), by id.
--   F. public.server_settle_call_attention_v1 / public.server_settle_due_call_attention_v1 — settlement after a half's
--      durable completion, and its sweep for a crash between that completion and the settlement. Idempotent; no model.
--   G. Narrow widenings: the background permit kind PROVISIONAL_ATTENTION (0191) and the AI-COST-01 feature family
--      LIVE_ATTENTION_EVALUATION (0135 / 0184).
--
-- ## What is deliberately NOT here
--
--   * Nothing provisional is written to CUs, Threads, Live Focus, Memory, the semantic clock or its ledger (0201), and the
--     durable path reads nothing here. Settlement reads durable ids only after the durable commit.
--   * No Replay read and no certification of these rows (CP3's), no protocol message (CP2's), no hosted deployment.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE COVERAGE LEDGER (A).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.call_attention_evaluations (
  call_id uuid NOT NULL,
  eval_seq bigint NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  connection_epoch bigint NOT NULL,
  track text NOT NULL,
  covers_from_clock_ms bigint NOT NULL,
  covers_to_clock_ms bigint NOT NULL,
  outcome text NOT NULL,
  admitted_clock_ms bigint,
  produced_clock_ms bigint,
  produced_at timestamptz,
  provider_ms integer,
  prompt_tokens integer,
  cache_hit_tokens integer,
  completion_tokens integer,
  xact_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT call_attention_evaluations_pk PRIMARY KEY (call_id, eval_seq),
  CONSTRAINT call_attention_evaluations_call_fk FOREIGN KEY (call_id) REFERENCES voice_private.calls (id) ON DELETE CASCADE,
  CONSTRAINT call_attention_evaluations_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT call_attention_evaluations_shape_check CHECK (
    eval_seq >= 1 AND connection_epoch >= 1 AND track IN ('USER', 'QANDEEL')
    AND covers_from_clock_ms >= 0 AND covers_to_clock_ms > covers_from_clock_ms
    AND outcome IN ('DEVELOPMENTS', 'NONE', 'TIMEOUT', 'REFUSED', 'PROVIDER_FAILED', 'DEFERRED_PERMIT', 'MISSED_HANDOVER',
                    'DEGRADED_SUSPENDED', 'STALE_RESULT', 'STALE_AFTER_SETTLEMENT', 'STALE_AFTER_END')
    AND (admitted_clock_ms IS NULL OR admitted_clock_ms >= 0)
    AND (produced_clock_ms IS NULL OR (admitted_clock_ms IS NOT NULL AND produced_clock_ms >= admitted_clock_ms))
    AND ((outcome IN ('DEVELOPMENTS', 'NONE')) <= (produced_clock_ms IS NOT NULL AND produced_at IS NOT NULL))
    AND (provider_ms IS NULL OR provider_ms >= 0) AND (prompt_tokens IS NULL OR prompt_tokens >= 0)
    AND (cache_hit_tokens IS NULL OR (cache_hit_tokens >= 0 AND prompt_tokens IS NOT NULL AND cache_hit_tokens <= prompt_tokens))
    AND (completion_tokens IS NULL OR completion_tokens >= 0))
);
-- A successful evaluation of a span is recorded once: a resend of the same result is ALREADY_COVERED.
CREATE UNIQUE INDEX call_attention_evaluations_covered_key ON voice_private.call_attention_evaluations (call_id, track, covers_from_clock_ms)
  WHERE outcome IN ('DEVELOPMENTS', 'NONE');
CREATE INDEX call_attention_evaluations_track_idx ON voice_private.call_attention_evaluations (call_id, track, covers_to_clock_ms);
CREATE INDEX call_attention_evaluations_user_idx ON voice_private.call_attention_evaluations (user_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE ATTENTION EVENTS (B).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.call_attention_events (
  call_id uuid NOT NULL,
  event_seq bigint NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  track text NOT NULL,
  op text NOT NULL,
  subject_key text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL,
  confidence text NOT NULL,
  thread_ref uuid,
  eval_seq bigint,
  anchor_clock_ms bigint,
  evidence_clock_ms bigint,
  produced_clock_ms bigint,
  settles_event_seq bigint,
  call_turn_index integer,
  xact_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT call_attention_events_pk PRIMARY KEY (call_id, event_seq),
  CONSTRAINT call_attention_events_call_fk FOREIGN KEY (call_id) REFERENCES voice_private.calls (id) ON DELETE CASCADE,
  CONSTRAINT call_attention_events_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT call_attention_events_evaluation_fk FOREIGN KEY (call_id, eval_seq)
    REFERENCES voice_private.call_attention_evaluations (call_id, eval_seq) ON DELETE CASCADE,
  CONSTRAINT call_attention_events_shape_check CHECK (
    event_seq >= 1 AND track IN ('USER', 'QANDEEL') AND op IN ('SET', 'WITHDRAW', 'CONFIRMED', 'EXPIRED')
    AND subject_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$' AND char_length(label) BETWEEN 1 AND 40 AND label !~ '[[:cntrl:]]'
    AND kind IN ('TOPIC', 'PERSON', 'PLACE', 'EXPERIENCE', 'CONCERN', 'PLAN') AND confidence IN ('HIGH', 'MEDIUM', 'LOW')
    AND (op IN ('SET', 'WITHDRAW')) = (eval_seq IS NOT NULL AND settles_event_seq IS NULL AND call_turn_index IS NULL
         AND anchor_clock_ms IS NOT NULL AND evidence_clock_ms IS NOT NULL AND produced_clock_ms IS NOT NULL)
    AND (op IN ('CONFIRMED', 'EXPIRED')) = (eval_seq IS NULL AND settles_event_seq IS NOT NULL AND call_turn_index IS NOT NULL)
    AND (op <> 'CONFIRMED' OR thread_ref IS NOT NULL)
    AND (anchor_clock_ms IS NULL OR (anchor_clock_ms >= 0 AND evidence_clock_ms >= anchor_clock_ms
                                     AND produced_clock_ms >= evidence_clock_ms)))
);
CREATE INDEX call_attention_events_subject_idx ON voice_private.call_attention_events (call_id, track, subject_key, event_seq);
CREATE INDEX call_attention_events_user_idx ON voice_private.call_attention_events (user_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE SETTLEMENT MARKERS (C).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.call_attention_settlements (
  call_id uuid NOT NULL,
  track text NOT NULL,
  call_turn_index integer NOT NULL,
  user_id uuid NOT NULL,
  half_state text NOT NULL,
  window_start_ms bigint,
  window_end_ms bigint,
  settled_through_clock_ms bigint,
  confirmed integer NOT NULL,
  expired integer NOT NULL,
  settled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT call_attention_settlements_pk PRIMARY KEY (call_id, track, call_turn_index),
  CONSTRAINT call_attention_settlements_call_fk FOREIGN KEY (call_id) REFERENCES voice_private.calls (id) ON DELETE CASCADE,
  CONSTRAINT call_attention_settlements_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT call_attention_settlements_shape_check CHECK (
    track IN ('USER', 'QANDEEL') AND call_turn_index >= 1 AND half_state IN ('COMPLETE', 'ABANDONED_INTEGRITY')
    AND (window_start_ms IS NULL) = (window_end_ms IS NULL) AND (window_end_ms IS NULL) = (settled_through_clock_ms IS NULL)
    AND (window_end_ms IS NULL OR (window_end_ms > window_start_ms AND settled_through_clock_ms >= window_end_ms))
    AND confirmed >= 0 AND expired >= 0)
);
CREATE INDEX call_attention_settlements_user_idx ON voice_private.call_attention_settlements (user_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. INTERNALS: the call's lock, the per-track watermarks, the open subjects.
-- ---------------------------------------------------------------------------------------------------------------------
-- A SET's words may end a little after the endpointer's speech end (recognizer word times vs. the energy endpoint): a
-- turn's settlement closes what is open up to its window end plus this slack.
CREATE FUNCTION voice_private.call_attention_settlement_slack_ms_v1() RETURNS bigint
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT 1000::bigint $$;

-- Every writer of a call's attention rows takes this transaction lock first: numbers are assigned in one order.
CREATE FUNCTION voice_private.lock_call_attention_v1(p_call_id uuid) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.call-attention.v1:' || p_call_id::text, 0));
$$;

-- The track's ACCOUNTED position: the end of the furthest span covered (DEVELOPMENTS / NONE) or explicitly missed
-- (MISSED_HANDOVER / DEGRADED_SUSPENDED). A TIMEOUT, REFUSED, PROVIDER_FAILED or DEFERRED_PERMIT span never advances it.
CREATE FUNCTION voice_private.call_attention_accounted_to_v1(p_call_id uuid, p_track text) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(max(e.covers_to_clock_ms), 0) FROM voice_private.call_attention_evaluations e
   WHERE e.call_id = p_call_id AND e.track = p_track
     AND e.outcome IN ('DEVELOPMENTS', 'NONE', 'MISSED_HANDOVER', 'DEGRADED_SUSPENDED');
$$;

CREATE FUNCTION voice_private.call_attention_settled_through_v1(p_call_id uuid, p_track text) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(max(s.settled_through_clock_ms), -1) FROM voice_private.call_attention_settlements s
   WHERE s.call_id = p_call_id AND s.track = p_track;
$$;

-- The subjects whose LATEST event is a SET: open attention. Settlement and withdrawal close a subject; a later SET of the
-- same subject opens it again.
CREATE FUNCTION voice_private.call_attention_open_v1(p_call_id uuid, p_track text)
RETURNS SETOF voice_private.call_attention_events
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT x.* FROM (
    SELECT DISTINCT ON (e.subject_key) e.* FROM voice_private.call_attention_events e
     WHERE e.call_id = p_call_id AND e.track = p_track
     ORDER BY e.subject_key, e.event_seq DESC) x
   WHERE x.op = 'SET'
   ORDER BY x.event_seq;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. THE ONE WRITER (D).
-- ---------------------------------------------------------------------------------------------------------------------
-- p_events (DEVELOPMENTS only): a JSON array, in the model's order, of
--   { "op": SET|WITHDRAW, "subjectKey", "label", "kind", "confidence", "threadRef": uuid|null,
--     "anchorClockMs", "evidenceClockMs" }   (produced = the evaluation's produced_clock_ms)
-- A threadRef must be one of the person's own Threads. Outcomes: RECORDED (with the numbers), ALREADY_COVERED (the same
-- span's success was already recorded: nothing written), STALE_RESULT / STALE_AFTER_SETTLEMENT / STALE_AFTER_END (the
-- refusal is recorded, no event), FENCED (an older connection: nothing written), NOT_FOUND.
CREATE FUNCTION public.server_record_call_attention_evaluation_v1(
  p_user_id uuid, p_call_id uuid, p_connection_epoch bigint, p_track text, p_covers_from_clock_ms bigint,
  p_covers_to_clock_ms bigint, p_outcome text, p_admitted_clock_ms bigint, p_produced_clock_ms bigint, p_provider_ms integer,
  p_prompt_tokens integer, p_cache_hit_tokens integer, p_completion_tokens integer, p_events jsonb)
RETURNS TABLE (outcome text, eval_seq bigint, accounted_to_clock_ms bigint, first_event_seq bigint, last_event_seq bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_call voice_private.calls;
  v_outcome text := p_outcome;
  v_eval bigint;
  v_event bigint;
  v_first bigint;
  v_existing bigint;
  v_success boolean := p_outcome IN ('DEVELOPMENTS', 'NONE');
  v_ev jsonb;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL OR p_track NOT IN ('USER', 'QANDEEL')
     OR p_covers_from_clock_ms IS NULL OR p_covers_to_clock_ms IS NULL OR p_covers_from_clock_ms < 0
     OR p_covers_to_clock_ms <= p_covers_from_clock_ms
     OR p_outcome NOT IN ('DEVELOPMENTS', 'NONE', 'TIMEOUT', 'REFUSED', 'PROVIDER_FAILED', 'DEFERRED_PERMIT', 'MISSED_HANDOVER',
                          'DEGRADED_SUSPENDED')
     OR (v_success AND (p_admitted_clock_ms IS NULL OR p_produced_clock_ms IS NULL))
     OR ((p_outcome = 'DEVELOPMENTS') <> (p_events IS NOT NULL AND jsonb_typeof(p_events) = 'array' AND jsonb_array_length(p_events) BETWEEN 1 AND 24))
     OR (p_outcome <> 'DEVELOPMENTS' AND p_events IS NOT NULL) THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id AND c.user_id = p_user_id FOR SHARE;
  IF v_call.id IS NULL THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bigint, NULL::bigint, NULL::bigint, NULL::bigint; RETURN;
  END IF;
  IF v_call.connection_epoch IS DISTINCT FROM p_connection_epoch THEN
    RETURN QUERY SELECT 'FENCED'::text, NULL::bigint, NULL::bigint, NULL::bigint, NULL::bigint; RETURN;
  END IF;
  PERFORM voice_private.lock_call_attention_v1(p_call_id);
  IF v_success THEN
    SELECT e.eval_seq INTO v_existing FROM voice_private.call_attention_evaluations e
     WHERE e.call_id = p_call_id AND e.track = p_track AND e.covers_from_clock_ms = p_covers_from_clock_ms
       AND e.outcome IN ('DEVELOPMENTS', 'NONE');
    IF v_existing IS NOT NULL THEN
      RETURN QUERY SELECT 'ALREADY_COVERED'::text, v_existing, voice_private.call_attention_accounted_to_v1(p_call_id, p_track),
                          NULL::bigint, NULL::bigint;
      RETURN;
    END IF;
    IF v_call.state = 'ENDED' THEN
      v_outcome := 'STALE_AFTER_END';
    ELSIF p_covers_from_clock_ms < voice_private.call_attention_accounted_to_v1(p_call_id, p_track) THEN
      v_outcome := 'STALE_RESULT';
    ELSIF p_covers_to_clock_ms <= voice_private.call_attention_settled_through_v1(p_call_id, p_track) THEN
      v_outcome := 'STALE_AFTER_SETTLEMENT';
    END IF;
  END IF;
  SELECT coalesce(max(e.eval_seq), 0) + 1 INTO v_eval FROM voice_private.call_attention_evaluations e WHERE e.call_id = p_call_id;
  INSERT INTO voice_private.call_attention_evaluations
    (call_id, eval_seq, user_id, session_id, connection_epoch, track, covers_from_clock_ms, covers_to_clock_ms, outcome,
     admitted_clock_ms, produced_clock_ms, produced_at, provider_ms, prompt_tokens, cache_hit_tokens, completion_tokens)
  VALUES (p_call_id, v_eval, p_user_id, v_call.session_id, p_connection_epoch, p_track, p_covers_from_clock_ms,
          p_covers_to_clock_ms, v_outcome, p_admitted_clock_ms, p_produced_clock_ms,
          CASE WHEN p_produced_clock_ms IS NULL THEN NULL ELSE clock_timestamp() END, p_provider_ms, p_prompt_tokens,
          p_cache_hit_tokens, p_completion_tokens);
  IF v_outcome = 'DEVELOPMENTS' THEN
    SELECT coalesce(max(e.event_seq), 0) INTO v_event FROM voice_private.call_attention_events e WHERE e.call_id = p_call_id;
    v_first := v_event + 1;
    FOR v_ev IN SELECT x FROM jsonb_array_elements(p_events) WITH ORDINALITY AS a(x, n) ORDER BY a.n LOOP
      IF (v_ev ->> 'op') NOT IN ('SET', 'WITHDRAW')
         OR (v_ev ->> 'anchorClockMs')::bigint NOT BETWEEN p_covers_from_clock_ms AND p_covers_to_clock_ms
         OR (v_ev ->> 'evidenceClockMs')::bigint NOT BETWEEN (v_ev ->> 'anchorClockMs')::bigint AND p_produced_clock_ms
         OR (jsonb_typeof(v_ev -> 'threadRef') = 'string' AND NOT EXISTS (
               SELECT 1 FROM public.conversation_threads t WHERE t.id = (v_ev ->> 'threadRef')::uuid AND t.user_id = p_user_id)) THEN
        RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
      END IF;
      v_event := v_event + 1;
      INSERT INTO voice_private.call_attention_events
        (call_id, event_seq, user_id, session_id, track, op, subject_key, label, kind, confidence, thread_ref, eval_seq,
         anchor_clock_ms, evidence_clock_ms, produced_clock_ms)
      VALUES (p_call_id, v_event, p_user_id, v_call.session_id, p_track, v_ev ->> 'op', v_ev ->> 'subjectKey', v_ev ->> 'label',
              v_ev ->> 'kind', v_ev ->> 'confidence',
              CASE WHEN jsonb_typeof(v_ev -> 'threadRef') = 'string' THEN (v_ev ->> 'threadRef')::uuid END, v_eval,
              (v_ev ->> 'anchorClockMs')::bigint, (v_ev ->> 'evidenceClockMs')::bigint, p_produced_clock_ms);
    END LOOP;
    RETURN QUERY SELECT 'RECORDED'::text, v_eval, voice_private.call_attention_accounted_to_v1(p_call_id, p_track), v_first, v_event;
    RETURN;
  END IF;
  RETURN QUERY SELECT CASE WHEN v_outcome = p_outcome THEN 'RECORDED' ELSE v_outcome END, v_eval,
                      voice_private.call_attention_accounted_to_v1(p_call_id, p_track), NULL::bigint, NULL::bigint;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. THE STATE READER (E).
-- ---------------------------------------------------------------------------------------------------------------------
-- One row per track that has anything (the open subjects as a JSON array in event order). An ENDED call reports no open
-- subject: every attention still open expired with the call, by rule, without a row being written.
CREATE FUNCTION public.server_read_call_attention_state_v1(p_user_id uuid, p_call_id uuid)
RETURNS TABLE (track text, accounted_to_clock_ms bigint, settled_through_clock_ms bigint, last_eval_seq bigint,
               last_event_seq bigint, call_ended boolean, open_subjects jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_call voice_private.calls;
  v_track text;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id AND c.user_id = p_user_id;
  IF v_call.id IS NULL THEN RETURN; END IF;
  FOREACH v_track IN ARRAY ARRAY['USER', 'QANDEEL'] LOOP
    RETURN QUERY SELECT v_track, voice_private.call_attention_accounted_to_v1(p_call_id, v_track),
      voice_private.call_attention_settled_through_v1(p_call_id, v_track),
      (SELECT max(e.eval_seq) FROM voice_private.call_attention_evaluations e WHERE e.call_id = p_call_id),
      (SELECT max(e.event_seq) FROM voice_private.call_attention_events e WHERE e.call_id = p_call_id),
      v_call.state = 'ENDED',
      CASE WHEN v_call.state = 'ENDED' THEN '[]'::jsonb ELSE coalesce((
        SELECT jsonb_agg(jsonb_build_object('eventSeq', o.event_seq, 'subjectKey', o.subject_key, 'label', o.label,
                                            'kind', o.kind, 'confidence', o.confidence, 'threadRef', o.thread_ref,
                                            'anchorClockMs', o.anchor_clock_ms) ORDER BY o.event_seq)
          FROM voice_private.call_attention_open_v1(p_call_id, v_track) o), '[]'::jsonb) END;
  END LOOP;
END$$;

-- The Threads the evaluator may refer to: the person's own durable Threads of the call's session (established, focus-bound
-- or continued in it), most recently bound first, each under the name COSMOS shows (0198, D-3: the person's newest alias,
-- else their own grounding wording; never an AI title). A Thread with no truthful name is not listed: nothing could match
-- it by meaning. Read-only; read when a connection opens and after each commit, never on the audio path.
CREATE FUNCTION public.server_read_call_attention_threads_v1(p_user_id uuid, p_call_id uuid, p_limit integer)
RETURNS TABLE (thread_id uuid, name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_session uuid;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT c.session_id INTO v_session FROM voice_private.calls c WHERE c.id = p_call_id AND c.user_id = p_user_id;
  IF v_session IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH bound AS (
    SELECT b.thread_id AS id, b.bound_sp AS sp FROM public.conversation_thread_focus_bindings b
     WHERE b.session_id = v_session AND b.user_id = p_user_id
    UNION ALL
    SELECT r.thread_id, r.session_position FROM public.conversation_thread_semantic_unit_results r
     WHERE r.session_id = v_session AND r.user_id = p_user_id AND r.thread_id IS NOT NULL
    UNION ALL
    SELECT t.id, t.established_sp FROM public.conversation_threads t
     WHERE t.established_session_id = v_session AND t.user_id = p_user_id
  ), latest AS (SELECT bound.id, max(bound.sp) AS sp FROM bound GROUP BY bound.id)
  SELECT t.id, coalesce(al.alias, gw.wording)
    FROM latest l
    JOIN public.conversation_threads t ON t.id = l.id AND t.user_id = p_user_id
    LEFT JOIN LATERAL (
      SELECT a.alias FROM public.conversation_thread_aliases a
       WHERE a.thread_id = t.id AND a.user_id = p_user_id ORDER BY a.id DESC LIMIT 1) al ON true
    LEFT JOIN LATERAL (
      SELECT left(btrim(regexp_replace(rr.anchor_text, '\s+', ' ', 'g')), 80) AS wording
        FROM public.conversation_emerging_focuses f
        JOIN public.conversation_reference_resolutions rr ON rr.resolved_handle_id = f.grounding_handle_id AND rr.session_id = f.session_id
       WHERE f.id = t.grounding_emerging_focus_id AND rr.session_position <= t.established_sp AND btrim(rr.anchor_text) <> ''
       ORDER BY rr.session_position, rr.same_sp_event_sequence, rr.reference_index LIMIT 1) gw ON true
   WHERE coalesce(al.alias, gw.wording) IS NOT NULL
   ORDER BY l.sp DESC, t.id
   LIMIT p_limit;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. SETTLEMENT (F).
-- ---------------------------------------------------------------------------------------------------------------------
-- The durable Threads a turn's committed units were bound to: a Thread a unit continued or was resolved into, a Thread a
-- unit's focus was bound to, a Thread established at one of its units. Identity by id only.
CREATE FUNCTION voice_private.call_attention_turn_threads_v1(p_turn_id uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.thread_id FROM public.conversation_units u
    JOIN public.conversation_thread_semantic_unit_results r ON r.cu_id = u.id
   WHERE u.source_turn_id = p_turn_id AND r.thread_id IS NOT NULL
  UNION
  SELECT b.thread_id FROM public.conversation_units u
    JOIN public.conversation_thread_focus_bindings b ON b.bound_cu_id = u.id
   WHERE u.source_turn_id = p_turn_id
  UNION
  SELECT t.id FROM public.conversation_units u
    JOIN public.conversation_threads t ON t.established_cu_id = u.id
   WHERE u.source_turn_id = p_turn_id;
$$;

-- One half (USER or ASSISTANT) of a call turn whose durable analysis has reached a terminal state. Idempotent: a half
-- already settled answers ALREADY_SETTLED; a half not terminal answers NOT_READY and writes nothing.
CREATE FUNCTION voice_private.settle_call_attention_half_v1(p_call_id uuid, p_call_turn_index integer, p_half text,
  OUT outcome text, OUT confirmed integer, OUT expired integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_q voice_private.call_analysis_queue;
  v_track text := CASE p_half WHEN 'USER' THEN 'USER' WHEN 'ASSISTANT' THEN 'QANDEEL' END;
  v_start bigint;
  v_end bigint;
  v_through bigint;
  v_event bigint;
  v_open voice_private.call_attention_events;
  v_confirm boolean;
BEGIN
  confirmed := 0; expired := 0;
  IF v_track IS NULL THEN outcome := 'NOT_READY'; RETURN; END IF;
  SELECT * INTO v_q FROM voice_private.call_analysis_queue q
   WHERE q.call_id = p_call_id AND q.call_turn_index = p_call_turn_index AND q.half = p_half;
  IF v_q.call_id IS NULL OR v_q.queue_state NOT IN ('COMPLETE', 'ABANDONED_INTEGRITY') THEN outcome := 'NOT_READY'; RETURN; END IF;
  PERFORM voice_private.lock_call_attention_v1(p_call_id);
  IF EXISTS (SELECT 1 FROM voice_private.call_attention_settlements s
              WHERE s.call_id = p_call_id AND s.track = v_track AND s.call_turn_index = p_call_turn_index) THEN
    outcome := 'ALREADY_SETTLED'; RETURN;
  END IF;
  SELECT v.anchor_start_ms, v.anchor_end_ms INTO v_start, v_end FROM public.conversation_turn_voice_sources v
   WHERE v.turn_id = v_q.turn_id AND v.anchor_start_ms IS NOT NULL AND v.anchor_end_ms > v.anchor_start_ms;
  IF v_end IS NOT NULL THEN
    v_through := v_end + voice_private.call_attention_settlement_slack_ms_v1();
    SELECT coalesce(max(e.event_seq), 0) INTO v_event FROM voice_private.call_attention_events e WHERE e.call_id = p_call_id;
    FOR v_open IN SELECT * FROM voice_private.call_attention_open_v1(p_call_id, v_track) o WHERE o.anchor_clock_ms <= v_through LOOP
      v_confirm := v_q.queue_state = 'COMPLETE' AND v_open.thread_ref IS NOT NULL
                   AND v_open.thread_ref IN (SELECT voice_private.call_attention_turn_threads_v1(v_q.turn_id));
      v_event := v_event + 1;
      INSERT INTO voice_private.call_attention_events
        (call_id, event_seq, user_id, session_id, track, op, subject_key, label, kind, confidence, thread_ref, settles_event_seq,
         call_turn_index)
      VALUES (p_call_id, v_event, v_open.user_id, v_open.session_id, v_track, CASE WHEN v_confirm THEN 'CONFIRMED' ELSE 'EXPIRED' END,
              v_open.subject_key, v_open.label, v_open.kind, v_open.confidence, v_open.thread_ref, v_open.event_seq, p_call_turn_index);
      IF v_confirm THEN confirmed := confirmed + 1; ELSE expired := expired + 1; END IF;
    END LOOP;
  END IF;
  INSERT INTO voice_private.call_attention_settlements
    (call_id, track, call_turn_index, user_id, half_state, window_start_ms, window_end_ms, settled_through_clock_ms, confirmed, expired)
  VALUES (p_call_id, v_track, p_call_turn_index, v_q.user_id, v_q.queue_state, v_start, v_end, v_through, confirmed, expired);
  outcome := 'SETTLED';
END$$;

-- After a half's durable completion, by the worker that completed it (any instance).
CREATE FUNCTION public.server_settle_call_attention_v1(p_user_id uuid, p_call_id uuid, p_call_turn_index integer, p_half text)
RETURNS TABLE (outcome text, confirmed integer, expired integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_call_turn_index IS NULL OR p_half NOT IN ('USER', 'ASSISTANT') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM voice_private.calls c WHERE c.id = p_call_id AND c.user_id = p_user_id) THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, 0, 0; RETURN;
  END IF;
  RETURN QUERY SELECT s.outcome, s.confirmed, s.expired FROM voice_private.settle_call_attention_half_v1(p_call_id, p_call_turn_index, p_half) s;
END$$;

-- The sweep: terminal halves of calls that hold attention events and have no settlement marker yet (a worker crashed
-- between the durable completion and the settlement, or a kick was lost). Oldest completion first, bounded.
CREATE FUNCTION public.server_settle_due_call_attention_v1(p_limit integer)
RETURNS TABLE (call_id uuid, call_turn_index integer, half text, outcome text, confirmed integer, expired integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_due record;
  v_s record;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  FOR v_due IN
    SELECT q.call_id, q.call_turn_index, q.half FROM voice_private.call_analysis_queue q
     WHERE q.half IN ('USER', 'ASSISTANT') AND q.queue_state IN ('COMPLETE', 'ABANDONED_INTEGRITY')
       AND EXISTS (SELECT 1 FROM voice_private.call_attention_events e WHERE e.call_id = q.call_id)
       AND NOT EXISTS (SELECT 1 FROM voice_private.call_attention_settlements s
                        WHERE s.call_id = q.call_id AND s.call_turn_index = q.call_turn_index
                          AND s.track = CASE q.half WHEN 'USER' THEN 'USER' ELSE 'QANDEEL' END)
     ORDER BY q.settled_at, q.call_id, q.call_turn_index, q.half
     LIMIT p_limit
  LOOP
    SELECT * INTO v_s FROM voice_private.settle_call_attention_half_v1(v_due.call_id, v_due.call_turn_index, v_due.half);
    RETURN QUERY SELECT v_due.call_id, v_due.call_turn_index, v_due.half, v_s.outcome, v_s.confirmed, v_s.expired;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. NARROW WIDENINGS (G).
-- ---------------------------------------------------------------------------------------------------------------------
-- 0191's background permits: one more work kind. Same capacity, same per-person limit, same critical window (L2); the
-- provisional evaluator asks with no wait and defers when not granted. The acquire body is 0191's, with the one list
-- widened.
ALTER TABLE voice_private.background_provider_permits DROP CONSTRAINT background_provider_permits_shape_check;
ALTER TABLE voice_private.background_provider_permits ADD CONSTRAINT background_provider_permits_shape_check CHECK (
  slot BETWEEN 1 AND 64 AND lease_until > granted_at
  AND work_kind IN ('CALL_ANALYSIS', 'TEXT_SEMANTIC_ANALYSIS', 'POST_RESPONSE_INTELLIGENCE', 'PROVISIONAL_ATTENTION'));

CREATE OR REPLACE FUNCTION public.server_acquire_background_permit_v1(p_user_id uuid, p_work_kind text, p_holder uuid,
  p_respect_critical_window boolean)
RETURNS TABLE (outcome text, slot integer, lease_until timestamptz, capacity integer, live_generations integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_policy voice_private.background_permit_policy := voice_private.background_permit_policy_v1();
  v_live integer;
  v_cap integer;
  v_slot integer;
  v_until timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_holder IS NULL OR p_respect_critical_window IS NULL OR p_work_kind IS NULL
     OR p_work_kind NOT IN ('CALL_ANALYSIS', 'TEXT_SEMANTIC_ANALYSIS', 'POST_RESPONSE_INTELLIGENCE', 'PROVISIONAL_ATTENTION') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_respect_critical_window AND voice_private.user_in_critical_window_v1(p_user_id) THEN
    RETURN QUERY SELECT 'WAIT_CRITICAL_WINDOW'::text, NULL::integer, NULL::timestamptz, NULL::integer, NULL::integer; RETURN;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.background-provider-permits.v1', 0));
  DELETE FROM voice_private.background_provider_permits p WHERE p.lease_until <= clock_timestamp();
  SELECT count(*)::integer INTO v_live FROM voice_private.call_exchanges e
   WHERE e.exchange_state = 'OPEN' AND e.generation_state = 'GENERATING' AND e.committed_at > clock_timestamp() - interval '2 minutes';
  v_cap := greatest(v_policy.minimum_permits, v_policy.total_permits - v_policy.live_generation_weight * v_live);
  v_until := clock_timestamp() + make_interval(secs => v_policy.lease_seconds);
  UPDATE voice_private.background_provider_permits p SET lease_until = v_until
   WHERE p.holder = p_holder AND p.user_id = p_user_id
  RETURNING p.slot INTO v_slot;
  IF v_slot IS NOT NULL THEN
    RETURN QUERY SELECT 'GRANTED'::text, v_slot, v_until, v_cap, v_live; RETURN;
  END IF;
  IF (SELECT count(*) FROM voice_private.background_provider_permits p WHERE p.user_id = p_user_id) >= v_policy.per_user_permits THEN
    RETURN QUERY SELECT 'WAIT_USER_LIMIT'::text, NULL::integer, NULL::timestamptz, v_cap, v_live; RETURN;
  END IF;
  -- The cap is a COUNT of the permits held, never a range of slot numbers: when live generations shrink it, permits granted
  -- under the larger cap keep their slots until they are released, and no new permit is granted until fewer than the cap
  -- remain (a free low slot alone would admit work past it, at the moment a live reply needs the capacity).
  IF (SELECT count(*) FROM voice_private.background_provider_permits p) >= v_cap THEN
    RETURN QUERY SELECT 'WAIT_CAPACITY'::text, NULL::integer, NULL::timestamptz, v_cap, v_live; RETURN;
  END IF;
  SELECT min(s) INTO v_slot FROM generate_series(1, 64) s
   WHERE NOT EXISTS (SELECT 1 FROM voice_private.background_provider_permits p WHERE p.slot = s);
  IF v_slot IS NULL THEN
    RETURN QUERY SELECT 'WAIT_CAPACITY'::text, NULL::integer, NULL::timestamptz, v_cap, v_live; RETURN;
  END IF;
  INSERT INTO voice_private.background_provider_permits (slot, user_id, work_kind, holder, lease_until)
  VALUES (v_slot, p_user_id, p_work_kind, p_holder, v_until);
  RETURN QUERY SELECT 'GRANTED'::text, v_slot, v_until, v_cap, v_live;
END$$;

-- AI-COST-01: the provisional evaluator's DeepSeek calls are their own feature family, paid by the person speaking.
ALTER TABLE public.ai_provider_calls DROP CONSTRAINT ai_provider_calls_feature_family_check;
ALTER TABLE public.ai_provider_calls ADD CONSTRAINT ai_provider_calls_feature_family_check CHECK (feature_family IN (
  'CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION', 'THREAD_FORMATION', 'THREAD_CONTINUITY',
  'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION',
  'PERSONAL_UNDERSTANDING_CAPTURE', 'SHARED_SEMANTIC_READING', 'SHARED_KNOWLEDGE_RECALL', 'SHARED_SPATIAL_PLACEMENT',
  'SHARED_DISCLOSURE_JUDGE', 'PUBLIC_SEMANTIC_INTERPRETATION', 'PUBLIC_QANDEEL_REPLY', 'LIVE_ATTENTION_EVALUATION',
  'VOICE_NOTE_TRANSCRIPTION', 'LIVE_CALL_TRANSCRIPTION', 'SPEECH_SYNTHESIS', 'SPEECH_RENDERING'));

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. ACCOUNT ERASURE COVERAGE. Each relation names a person and cascades from the account (and from the call).
-- ---------------------------------------------------------------------------------------------------------------------
INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('voice_private.call_attention_evaluations', 'ACCOUNT_CASCADE'),
    ('voice_private.call_attention_events', 'ACCOUNT_CASCADE'),
    ('voice_private.call_attention_settlements', 'ACCOUNT_CASCADE');

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. OWNERSHIP, RLS AND ACL. No role holds a privilege on a new relation; service_role executes the five public
--     functions only.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  rel text;
  fn text;
  r text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['voice_private.call_attention_evaluations', 'voice_private.call_attention_events',
                             'voice_private.call_attention_settlements'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', rel);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', rel);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', rel);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'qandeel_replay_media'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', rel, r); END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'voice_private.call_attention_settlement_slack_ms_v1()',
    'voice_private.lock_call_attention_v1(uuid)',
    'voice_private.call_attention_accounted_to_v1(uuid,text)',
    'voice_private.call_attention_settled_through_v1(uuid,text)',
    'voice_private.call_attention_open_v1(uuid,text)',
    'voice_private.call_attention_turn_threads_v1(uuid)',
    'voice_private.settle_call_attention_half_v1(uuid,integer,text)',
    'public.server_record_call_attention_evaluation_v1(uuid,uuid,bigint,text,bigint,bigint,text,bigint,bigint,integer,integer,integer,integer,jsonb)',
    'public.server_read_call_attention_state_v1(uuid,uuid)',
    'public.server_read_call_attention_threads_v1(uuid,uuid,integer)',
    'public.server_settle_call_attention_v1(uuid,uuid,integer,text)',
    'public.server_settle_due_call_attention_v1(integer)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'qandeel_replay_media'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
    END LOOP;
    IF fn LIKE 'public.%' AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 11. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
  r text;
  v_count integer;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'voice_private.call_attention_settlement_slack_ms_v1()',
    'voice_private.lock_call_attention_v1(uuid)',
    'voice_private.call_attention_accounted_to_v1(uuid,text)',
    'voice_private.call_attention_settled_through_v1(uuid,text)',
    'voice_private.call_attention_open_v1(uuid,text)',
    'voice_private.call_attention_turn_threads_v1(uuid)',
    'voice_private.settle_call_attention_half_v1(uuid,integer,text)',
    'public.server_record_call_attention_evaluation_v1(uuid,uuid,bigint,text,bigint,bigint,text,bigint,bigint,integer,integer,integer,integer,jsonb)',
    'public.server_read_call_attention_state_v1(uuid,uuid)',
    'public.server_read_call_attention_threads_v1(uuid,uuid,integer)',
    'public.server_settle_call_attention_v1(uuid,uuid,integer,text)',
    'public.server_settle_due_call_attention_v1(integer)'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef AND p.proowner = 'postgres'::regrole
                      AND p.proconfig = ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'INTEL-LIVE-01: % is not a postgres-owned, search_path-pinned definer', fn;
    END IF;
    IF (SELECT p.prosrc FROM pg_proc p WHERE p.oid = fn::regprocedure) ~* '(EXCEPTION\s+WHEN|\mEXECUTE\M|40001|40P01|PT409)' THEN
      RAISE EXCEPTION 'INTEL-LIVE-01: % must hold no handler, no dynamic SQL and no retryable SQLSTATE', fn;
    END IF;
    -- The provisional lane never writes durable understanding.
    IF (SELECT p.prosrc FROM pg_proc p WHERE p.oid = fn::regprocedure)
       ~* '(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.(conversation_units|conversation_thread|conversation_live_focus|session_semantic|memory)' THEN
      RAISE EXCEPTION 'INTEL-LIVE-01: % writes durable understanding', fn;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'qandeel_replay_media'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'INTEL-LIVE-01: % is reachable by %', fn, r;
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
       AND has_function_privilege('service_role', fn, 'EXECUTE') <> (fn LIKE 'public.%') THEN
      RAISE EXCEPTION 'INTEL-LIVE-01: service_role must reach exactly the public functions (%)', fn;
    END IF;
  END LOOP;
  SELECT count(*) INTO v_count FROM pg_constraint c
   WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass
     AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g);
  IF v_count <> 0 THEN RAISE EXCEPTION 'INTEL-LIVE-01: a relation referencing the account is unregistered'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'voice_private' AND g.table_name LIKE 'call\_attention\_%'
                AND g.grantee IN ('anon', 'authenticated', 'service_role', 'qandeel_replay_media', 'PUBLIC')) THEN
    RAISE EXCEPTION 'INTEL-LIVE-01: an attention relation is reachable by a role';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname = 'background_provider_permits_shape_check'
                    AND pg_get_constraintdef(c.oid) ~ 'PROVISIONAL_ATTENTION')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname = 'ai_provider_calls_feature_family_check'
                       AND pg_get_constraintdef(c.oid) ~ 'LIVE_ATTENTION_EVALUATION') THEN
    RAISE EXCEPTION 'INTEL-LIVE-01: the permit kind and the cost family must be admitted';
  END IF;
END$$;

COMMIT;
