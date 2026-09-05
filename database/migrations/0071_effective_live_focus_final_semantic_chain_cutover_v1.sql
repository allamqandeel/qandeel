-- T-03D - Effective Live Focus + FINAL Same-SP Semantic Chain + Production
-- Authority Cutover v1, one Architecture-sized task.
--
-- This migration closes the semantic chain that deliberately stayed
-- production-inert through T-03B1, T-03B2 and T-03B3, and it is the ONE
-- authorized activation act:
--
--   committed CU / SP
--   -> B1 reference + conversational focus + Emerging Focus         [seq 1]
--   -> the FINAL Thread layer (0068 + 0070)                          [seq 2, at most one]
--   -> effective Live Focus (LF)                                     [seq 2 or 3, at most one]
--   -> durable LF transition history + technical LF capture
--   -> authenticated LF snapshot / catch-up delivery
--   -> the FINAL B1 + B2 + B3 + LF runtime authority (service_role)
--   -> retirement of the temporary T-03A2-only live writer
--
-- Frozen Live Focus constitution (Stage 6.5 v3 SDM-04, LF-01 .. LF-04):
--
--   LF = CURRENT LIVE CONVERSATIONAL ATTENTION ONLY.
--   LF = NONE | EMERGING(emerging_focus_id) | THREAD(thread_id).
--
--   It is NOT importance, rank, confidence, analytical strength, centrality,
--   permanent priority, Inspected Focus, the latest Map click, the current
--   viewport or an explicit user-owned Context Activation. Only an Emerging
--   Focus and an Established Thread may be direct LF values. Map navigation
--   never changes LF. LF changes passively when committed conversation
--   changes attention, and never because of elapsed time.
--
-- Architecture Decision D-01 (deterministic reducer, NO provider): effective
-- LF is a pure function of the canonical B1 bundle of the CU, its FINAL
-- Thread-layer unit result, the prior effective LF, the durable canonical B1
-- history needed for target closure and the Session focus -> Thread bindings
-- visible to the CU. No timestamp, Map state, camera, inspection, analytical
-- object, confidence, similarity, Home coordinate, Thread importance or future
-- CU participates. The database RE-DERIVES the effective LF of every CU from
-- the durable rows and refuses any payload that differs.
--
-- Same-SP rule (frozen): B1 = seq 1; the whole Thread layer = optional seq 2;
-- an LF transition = seq 2 when no Thread-layer event exists at the CU and
-- seq 3 when the Thread layer used seq 2; an unchanged LF reserves NO
-- sequence. A sealed SP is never reopened or backdated: the next CU may only
-- advance the clock after this CU's LF decision is durable.
--
-- AF66-01 lock order, provable from the writer body:
--
--   Session Semantic Clock FOR UPDATE                     <- FIRST
--     -> source turn -> B1 semantic rows
--     -> user/world Thread Identity Clock                 (technical version)
--     -> user/world spatial authority (NEW establishment only)
--     -> Thread / Home / focus-binding / lifecycle rows
--     -> LF transition + LF capture rows
--
-- The cutover is ALL-OR-NOTHING and lives in section 14: the final coordinator
-- and its two reads (plus the 0070 dossier page) become executable by
-- service_role, the temporary T-03A2 mutation grants are retired, no
-- temporal-only fallback writer remains granted, and every predecessor
-- integrated writer stays ungranted (callable only from inside a postgres-
-- owned SECURITY DEFINER body). Migrations 0064-0070 are byte-identical; no
-- legacy row is backfilled; the readiness audit (section 13) is the explicit
-- deployment blocker when incompatible legacy canonical batches exist.
--
-- Audit timestamps exist only as audit metadata. No timestamp decides SP, LF,
-- identity, availability or ordering anywhere below.

BEGIN;

-- ===========================================================================
-- 0. Preconditions: the frozen UTF-8 contract and the 0065 / 0066 / 0068 /
--    0069 / 0070 objects this migration extends and reuses.
-- ===========================================================================
DO $$BEGIN
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'T-03D requires a UTF8 server encoding; found %', current_setting('server_encoding')
      USING ERRCODE='0A000';
  END IF;
  IF to_regprocedure('public.reserve_session_same_sp_event_v1(uuid,uuid)') IS NULL
     OR to_regprocedure('public.persist_conversation_unit_focus_semantics_v1(public.conversation_units,uuid,jsonb,bigint)') IS NULL
     OR to_regprocedure('public.validate_conversation_thread_decision_v1(public.conversation_units,jsonb)') IS NULL
     OR to_regprocedure('public.persist_conversation_thread_establishment_v1(public.conversation_units,uuid,jsonb,bigint,numeric,numeric,integer,numeric,numeric,bytea,bytea)') IS NULL
     OR to_regprocedure('public.compute_canonical_home_placement_v1(text,text,text,text[],text[],numeric[],numeric[])') IS NULL
     OR to_regprocedure('public.canonical_thread_identities_v1(uuid,uuid)') IS NULL
     OR to_regprocedure('public.canonical_uuid_v5_v1(uuid,text)') IS NULL
     OR to_regprocedure('public.validate_conversation_thread_lifecycle_decision_v1(public.conversation_units,jsonb,jsonb)') IS NULL
     OR to_regprocedure('public.persist_conversation_thread_lifecycle_layer_v1(public.conversation_units,uuid,jsonb,bigint)') IS NULL
     OR to_regprocedure('public.conversation_thread_semantic_batch_state_v1(uuid,uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.commit_conversation_units_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text)') IS NULL
     OR to_regprocedure('public.get_conversation_thread_lifecycle_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.get_conversation_thread_lifecycle_runtime_context_v1(uuid,uuid)') IS NULL
     OR to_regprocedure('public.get_conversation_thread_identity_dossier_page_v1(uuid,bigint,uuid,integer)') IS NULL
     OR to_regprocedure('public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)') IS NULL
     OR to_regprocedure('public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)') IS NULL
     OR to_regclass('public.conversation_thread_focus_bindings') IS NULL
     OR to_regclass('public.conversation_thread_semantic_unit_results') IS NULL
     OR to_regclass('public.conversation_thread_semantic_commit_batches') IS NULL
     OR to_regclass('public.conversation_emerging_focuses') IS NULL
     OR to_regclass('public.conversation_emerging_focus_attention_events') IS NULL
     OR to_regclass('public.conversation_unit_focus_semantics') IS NULL
     OR to_regclass('public.conversation_threads') IS NULL THEN
    RAISE EXCEPTION 'T-03D requires the T-03A2 seam, the T-03B1b1 focus substrate, the T-03B2b2 Thread substrate, the T-03B2b3 reads and the T-03B3 final Thread layer'
      USING ERRCODE='55000';
  END IF;
END$$;

-- ===========================================================================
-- 1. Durable LF transition history: one append-only row per CHANGE of the
--    effective Live Focus, at the exact (SP, same-SP sequence) the writer
--    reserved for it. No row exists for an unchanged LF, and no row ever has
--    from == to. Kinds are the closed LF domain; a NONE carries no reference,
--    an EMERGING references a same-Session Emerging Focus, a THREAD references
--    a same-user canonical Thread (both re-validated by the writer and by the
--    completeness authority; a conditional FK is not expressible).
--
--    What deliberately cannot live here: a label, a name, a Home coordinate,
--    a direction, a relation count, a confidence, an importance, committed
--    text, a timeline position or a K(TC) projection.
-- ===========================================================================
CREATE TABLE public.conversation_live_focus_transitions (
  event_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  cu_id uuid NOT NULL,
  commit_batch_id uuid NOT NULL,
  session_position integer NOT NULL,
  same_sp_event_sequence bigint NOT NULL,
  from_kind text NOT NULL,
  from_ref uuid,
  to_kind text NOT NULL,
  to_ref uuid,
  reason_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT live_focus_transitions_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT live_focus_transitions_cu_fk
    FOREIGN KEY (cu_id) REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
  CONSTRAINT live_focus_transitions_batch_fk
    FOREIGN KEY (commit_batch_id) REFERENCES public.conversation_unit_commit_batches (id) ON DELETE RESTRICT,
  CONSTRAINT live_focus_transitions_sp_fk
    FOREIGN KEY (session_id, session_position) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT live_focus_transitions_kind_check CHECK (
    from_kind IN ('NONE', 'EMERGING', 'THREAD') AND to_kind IN ('NONE', 'EMERGING', 'THREAD')),
  CONSTRAINT live_focus_transitions_shape_check CHECK (
    ((from_kind = 'NONE') = (from_ref IS NULL)) AND ((to_kind = 'NONE') = (to_ref IS NULL))),
  CONSTRAINT live_focus_transitions_change_check CHECK (
    from_kind <> to_kind OR from_ref IS DISTINCT FROM to_ref),
  CONSTRAINT live_focus_transitions_reason_check CHECK (
    reason_code IN ('NEW_INDEPENDENT_FOCUS', 'THREAD_PROMOTION', 'RETURN_TO_THREAD', 'FOCUS_REPLACEMENT', 'STABLE_DEPARTURE_NO_REPLACEMENT')),
  CONSTRAINT live_focus_transitions_reason_shape_check CHECK (
    ((to_kind = 'NONE') = (reason_code = 'STABLE_DEPARTURE_NO_REPLACEMENT'))
    AND ((from_kind = 'NONE' AND to_kind <> 'NONE') = (reason_code = 'NEW_INDEPENDENT_FOCUS'))
    AND (reason_code NOT IN ('THREAD_PROMOTION', 'RETURN_TO_THREAD') OR to_kind = 'THREAD')
    AND (reason_code <> 'THREAD_PROMOTION' OR from_kind = 'EMERGING')),
  CONSTRAINT live_focus_transitions_position_check CHECK (
    session_position >= 1 AND same_sp_event_sequence IN (2, 3)),
  CONSTRAINT live_focus_transitions_one_per_cu UNIQUE (session_id, cu_id),
  CONSTRAINT live_focus_transitions_one_per_sp UNIQUE (session_id, session_position)
);

CREATE INDEX live_focus_transitions_session_idx
  ON public.conversation_live_focus_transitions (session_id, session_position DESC, same_sp_event_sequence DESC);
CREATE INDEX live_focus_transitions_batch_idx
  ON public.conversation_live_focus_transitions (commit_batch_id);

-- ===========================================================================
-- 2. The TECHNICAL LF capture: one row per committed-CU batch so that "LF
--    evaluated and unchanged for every CU" and "LF never evaluated" stay
--    distinguishable forever. It is capture metadata, not a Product Timeline
--    object: it carries NO SP and NO same-SP sequence. `canonical_fingerprint`
--    is DB-derived SHA-256 over the ordered canonical LF decisions of every
--    unit (unit id, effective kind / ref, transition yes/no, reason if any,
--    deterministic event id if any) plus the reducer identity; the allocated
--    same-SP sequence and the audit timestamp are excluded.
-- ===========================================================================
CREATE TABLE public.conversation_live_focus_commit_batches (
  commit_batch_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  source_turn_id uuid NOT NULL,
  unit_count integer NOT NULL,
  transition_count integer NOT NULL,
  canonical_fingerprint bytea NOT NULL,
  lf_reducer_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT live_focus_batches_batch_fk
    FOREIGN KEY (commit_batch_id) REFERENCES public.conversation_unit_commit_batches (id) ON DELETE RESTRICT,
  CONSTRAINT live_focus_batches_thread_semantic_batch_fk
    FOREIGN KEY (commit_batch_id) REFERENCES public.conversation_thread_semantic_commit_batches (commit_batch_id) ON DELETE RESTRICT,
  CONSTRAINT live_focus_batches_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT live_focus_batches_turn_fk
    FOREIGN KEY (source_turn_id) REFERENCES public.conversation_turns (id) ON DELETE RESTRICT,
  CONSTRAINT live_focus_batches_count_check CHECK (
    unit_count >= 0 AND transition_count >= 0 AND transition_count <= unit_count),
  CONSTRAINT live_focus_batches_digest_check CHECK (length(canonical_fingerprint) = 32),
  CONSTRAINT live_focus_batches_reducer_check CHECK (
    length(btrim(lf_reducer_version)) > 0 AND length(lf_reducer_version) <= 64)
);

-- ===========================================================================
-- 3. Append-only enforcement, binding the owner too, exactly as 0064-0070 do.
-- ===========================================================================
CREATE FUNCTION public.reject_conversation_live_focus_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'CANONICAL_LIVE_FOCUS_ROW_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='LF transitions and the technical LF capture are append-only truth: UPDATE and DELETE are refused for every role, including the table owner. There is no repair, no rewrite and no backdating path.';
END;$$;

CREATE TRIGGER conversation_live_focus_transitions_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_live_focus_transitions
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_live_focus_mutation_v1();
CREATE TRIGGER conversation_live_focus_commit_batches_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_live_focus_commit_batches
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_live_focus_mutation_v1();

-- ===========================================================================
-- 4. Deterministic LF event identity: the exact RFC 4122 version-5 derivation
--    of 0068 (`canonical_uuid_v5_v1`) under ONE frozen namespace derived from
--    its documented URI. Neither the provider nor the application can author
--    it; the database re-derives and requires exact equality.
--
--      lf_event_id = uuidV5(LF_EVENT_NAMESPACE, sessionId + ':' + cuId + ':' + toKind + ':' + (toRef ?? 'NONE'))
--      LF_EVENT_NAMESPACE = uuidV5(RFC4122_URL, 'https://qandeel.app/runtime/live-focus-transition/v1')
-- ===========================================================================
CREATE FUNCTION public.canonical_live_focus_transition_id_v1(p_session_id uuid, p_cu_id uuid, p_to_kind text, p_to_ref uuid)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  live_focus_namespace constant uuid := '14cd67f4-be9d-54f6-b735-cbe38a7cb311';
BEGIN
  IF p_session_id IS NULL OR p_cu_id IS NULL OR p_to_kind IS NULL OR p_to_kind NOT IN ('NONE', 'EMERGING', 'THREAD')
     OR ((p_to_kind = 'NONE') <> (p_to_ref IS NULL)) THEN
    RAISE EXCEPTION 'INVALID_LIVE_FOCUS_IDENTITY' USING ERRCODE='22023';
  END IF;
  RETURN public.canonical_uuid_v5_v1(live_focus_namespace,
    p_session_id::text || ':' || p_cu_id::text || ':' || p_to_kind || ':' || COALESCE(p_to_ref::text, 'NONE'));
END;$$;

-- ===========================================================================
-- 5. The current LF authority, DB-derived from the transition history alone:
--    no transition yet -> NONE; otherwise the latest transition by canonical
--    (session_position, same_sp_event_sequence). NEVER timestamp order, same
--    Session / user only, no global cross-Session LF.
--
--    `conversation_session_live_focus_before_v1` is the internal "prior LF"
--    of a CU: the latest transition strictly before its Session Position.
-- ===========================================================================
CREATE FUNCTION public.conversation_session_live_focus_before_v1(p_session_id uuid, p_before_sp integer)
RETURNS TABLE(live_focus_kind text, live_focus_ref uuid, live_focus_sp integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  SELECT t.to_kind, t.to_ref, t.session_position INTO live_focus_kind, live_focus_ref, live_focus_sp
    FROM public.conversation_live_focus_transitions t
   WHERE t.session_id = p_session_id AND (p_before_sp IS NULL OR t.session_position < p_before_sp)
   ORDER BY t.session_position DESC, t.same_sp_event_sequence DESC
   LIMIT 1;
  IF NOT FOUND THEN
    live_focus_kind := 'NONE';
    live_focus_ref := NULL;
    live_focus_sp := NULL;
  END IF;
  RETURN NEXT;
END;$$;

CREATE FUNCTION public.conversation_session_current_live_focus_v1(p_session_id uuid, p_user_id uuid)
RETURNS TABLE(live_focus_kind text, live_focus_ref uuid, live_focus_sp integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_sessions s WHERE s.id = p_session_id AND s.user_id = p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT b.live_focus_kind, b.live_focus_ref, b.live_focus_sp
    FROM public.conversation_session_live_focus_before_v1(p_session_id, NULL) b;
END;$$;

-- ===========================================================================
-- 6. The deterministic LF reducer, mirrored in SQL (D-01). For ONE committed
--    CU whose B1 bundle and FINAL Thread-layer unit result are already
--    durable, it derives the prior LF, the effective LF, whether they differ
--    and the transition reason, from durable rows alone:
--
--      focus-bearing CU (START_NEW_FOCUS / ATTEND_EXISTING_FOCUS with a focus):
--        final Thread-layer outcome binds the focus to a Thread
--          (ESTABLISH_NEW / ATTEND_EXISTING / ACTIVATE_EXISTING_IN_SESSION /
--           REOPEN_EXISTING)                          -> THREAD(thread_id)
--        otherwise (NO_THREAD_ACTION / IDENTITY_AMBIGUOUS)
--                                                     -> EMERGING(focus)
--      NO_INDEPENDENT_FOCUS CU                        -> prior LF, except the
--        conservative LF-04 departure: prior LF is not NONE, the canonical B1
--        functions include FOCUS_SHIFT, the attention reason is not
--        LOCAL_CLARIFICATION_OR_CORRECTION, the canonical target_cu_id (if
--        any) does NOT anchor the CU back to the prior LF (an EMERGING prior
--        is anchored by a target CU attending that focus; a THREAD prior by a
--        target CU attending a focus bound to that Thread), AND (R1-01) a
--        THREAD prior's frozen Session lifecycle state after this CU is
--        DORMANT - an ACTIVE / REOPENED Thread keeps the LF   -> NONE
--
--    Reason of a change: to NONE -> STABLE_DEPARTURE_NO_REPLACEMENT; from NONE
--    -> NEW_INDEPENDENT_FOCUS; to THREAD from EMERGING(the CU's own focus) ->
--    THREAD_PROMOTION (the same focus, now a Thread, at this SAME SP); to a
--    THREAD established at this CU from another value -> FOCUS_REPLACEMENT;
--    to a pre-existing THREAD -> RETURN_TO_THREAD; to EMERGING -> FOCUS_REPLACEMENT.
--
--    Nothing else exists as input: no elapsed time, no turn count, no "two
--    quiet CUs", no Map / inspection / camera, no analysis, no confidence.
-- ===========================================================================
CREATE FUNCTION public.derive_conversation_effective_live_focus_v1(p_cu public.conversation_units)
RETURNS TABLE(prior_kind text, prior_ref uuid, effective_kind text, effective_ref uuid, changed boolean, reason_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  att public.conversation_emerging_focus_attention_events;
  sem public.conversation_unit_focus_semantics;
  result_row public.conversation_thread_semantic_unit_results;
  target_att public.conversation_emerging_focus_attention_events;
  anchored boolean;
  departure_stable boolean;
BEGIN
  SELECT * INTO att FROM public.conversation_emerging_focus_attention_events e WHERE e.cu_id = p_cu.id;
  SELECT * INTO sem FROM public.conversation_unit_focus_semantics s WHERE s.cu_id = p_cu.id;
  SELECT * INTO result_row FROM public.conversation_thread_semantic_unit_results r WHERE r.cu_id = p_cu.id;
  IF att.cu_id IS NULL OR sem.cu_id IS NULL OR result_row.cu_id IS NULL THEN
    RAISE EXCEPTION 'INCOMPLETE_PRIOR_SEMANTIC_HISTORY' USING ERRCODE='55000',
      DETAIL='LIVE_FOCUS_INPUT_NOT_DURABLE: effective LF is derivable only for a committed CU whose canonical B1 bundle and FINAL Thread-layer unit result are durable.';
  END IF;
  SELECT b.live_focus_kind, b.live_focus_ref INTO prior_kind, prior_ref
    FROM public.conversation_session_live_focus_before_v1(p_cu.session_id, p_cu.session_position) b;

  IF att.attention_kind IN ('START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS') THEN
    IF att.emerging_focus_id IS NULL OR result_row.emerging_focus_id IS DISTINCT FROM att.emerging_focus_id THEN
      RAISE EXCEPTION 'LIVE_FOCUS_INPUT_MISMATCH' USING ERRCODE='55000',
        DETAIL='The FINAL Thread-layer unit result names exactly the stable Emerging Focus the canonical B1 attention starts or attends.';
    END IF;
    IF result_row.outcome IN ('ESTABLISH_NEW', 'ATTEND_EXISTING', 'ACTIVATE_EXISTING_IN_SESSION', 'REOPEN_EXISTING') THEN
      IF result_row.thread_id IS NULL THEN
        RAISE EXCEPTION 'LIVE_FOCUS_INPUT_MISMATCH' USING ERRCODE='55000';
      END IF;
      effective_kind := 'THREAD';
      effective_ref := result_row.thread_id;
    ELSE
      effective_kind := 'EMERGING';
      effective_ref := att.emerging_focus_id;
    END IF;
  ELSE
    effective_kind := prior_kind;
    effective_ref := prior_ref;
    IF prior_kind <> 'NONE' AND 'FOCUS_SHIFT' = ANY (sem.functions)
       AND att.attention_reason <> 'LOCAL_CLARIFICATION_OR_CORRECTION' THEN
      anchored := false;
      IF sem.target_cu_id IS NOT NULL THEN
        SELECT * INTO target_att FROM public.conversation_emerging_focus_attention_events e WHERE e.cu_id = sem.target_cu_id;
        IF target_att.cu_id IS NULL THEN
          RAISE EXCEPTION 'INCOMPLETE_PRIOR_SEMANTIC_HISTORY' USING ERRCODE='55000',
            DETAIL='LIVE_FOCUS_TARGET_NOT_DURABLE: the canonical target CU of a departure candidate must carry durable B1 attention.';
        END IF;
        IF target_att.attention_kind <> 'NO_INDEPENDENT_FOCUS' AND target_att.emerging_focus_id IS NOT NULL THEN
          IF prior_kind = 'EMERGING' THEN
            anchored := target_att.emerging_focus_id = prior_ref;
          ELSE
            anchored := EXISTS (SELECT 1 FROM public.conversation_thread_focus_bindings b
                                 WHERE b.session_id = p_cu.session_id AND b.emerging_focus_id = target_att.emerging_focus_id
                                   AND b.thread_id = prior_ref AND b.bound_sp <= p_cu.session_position);
          END IF;
        END IF;
      END IF;
      -- R1-01 (B3 -> D same-Moment closure): a departure is only as stable
      -- as the frozen Thread lifecycle says. A prior THREAD LF may depart to
      -- NONE only when that Thread's Session lifecycle state AFTER this CU's
      -- FINAL Thread-layer truth is DORMANT; an ACTIVE or REOPENED Thread
      -- keeps the LF. The chain can therefore never say "stably departed
      -- Thread T" and "Thread T remains ACTIVE" for the same Moment. An
      -- EMERGING prior has no lifecycle and departs as before.
      departure_stable := prior_kind <> 'THREAD'
        OR public.conversation_thread_session_lifecycle_state_v1(prior_ref, p_cu.session_id, p_cu.session_position + 1) = 'DORMANT';
      IF NOT anchored AND departure_stable THEN
        effective_kind := 'NONE';
        effective_ref := NULL;
      END IF;
    END IF;
  END IF;

  changed := effective_kind <> prior_kind OR effective_ref IS DISTINCT FROM prior_ref;
  reason_code := NULL;
  IF changed THEN
    IF effective_kind = 'NONE' THEN
      reason_code := 'STABLE_DEPARTURE_NO_REPLACEMENT';
    ELSIF prior_kind = 'NONE' THEN
      reason_code := 'NEW_INDEPENDENT_FOCUS';
    ELSIF effective_kind = 'THREAD' THEN
      IF prior_kind = 'EMERGING' AND prior_ref = att.emerging_focus_id THEN
        reason_code := 'THREAD_PROMOTION';
      ELSIF result_row.outcome = 'ESTABLISH_NEW' THEN
        reason_code := 'FOCUS_REPLACEMENT';
      ELSE
        reason_code := 'RETURN_TO_THREAD';
      END IF;
    ELSE
      reason_code := 'FOCUS_REPLACEMENT';
    END IF;
  END IF;
  RETURN NEXT;
END;$$;

-- ===========================================================================
-- 7. Validating ONE canonical LF decision against the DB derivation and
--    persisting its transition (if any) at the reserved same-SP sequence.
--    The caller (the writer) reserves the sequence; this helper never does.
-- ===========================================================================
CREATE FUNCTION public.validate_conversation_live_focus_decision_v1(p_cu public.conversation_units, p_decision jsonb)
RETURNS TABLE(changed boolean, prior_kind text, prior_ref uuid, effective_kind text, effective_ref uuid, reason_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  uuid_shape constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  derived record;
  claimed_ref uuid;
  claimed_event uuid;
BEGIN
  IF jsonb_typeof(p_decision) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_decision)) <> 6
     OR NOT (p_decision ? 'unit_id') OR NOT (p_decision ? 'effective_kind') OR NOT (p_decision ? 'effective_ref')
     OR NOT (p_decision ? 'transition') OR NOT (p_decision ? 'reason_code') OR NOT (p_decision ? 'transition_event_id') THEN
    RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023',
      DETAIL='A canonical LF decision carries exactly unit_id, effective_kind, effective_ref, transition, reason_code and transition_event_id.';
  END IF;
  IF jsonb_typeof(p_decision -> 'unit_id') <> 'string' OR (p_decision ->> 'unit_id') !~ uuid_shape
     OR (p_decision ->> 'unit_id')::uuid <> p_cu.id THEN
    RAISE EXCEPTION 'LIVE_FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(p_decision -> 'transition') <> 'boolean' THEN
    RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  claimed_ref := NULL;
  IF jsonb_typeof(p_decision -> 'effective_ref') = 'string' THEN
    IF (p_decision ->> 'effective_ref') !~ uuid_shape THEN
      RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023';
    END IF;
    claimed_ref := (p_decision ->> 'effective_ref')::uuid;
  ELSIF jsonb_typeof(p_decision -> 'effective_ref') <> 'null' THEN
    RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  claimed_event := NULL;
  IF jsonb_typeof(p_decision -> 'transition_event_id') = 'string' THEN
    IF (p_decision ->> 'transition_event_id') !~ uuid_shape THEN
      RAISE EXCEPTION 'INVALID_LIVE_FOCUS_IDENTITY' USING ERRCODE='22023';
    END IF;
    claimed_event := (p_decision ->> 'transition_event_id')::uuid;
  ELSIF jsonb_typeof(p_decision -> 'transition_event_id') <> 'null' THEN
    RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;

  SELECT * INTO derived FROM public.derive_conversation_effective_live_focus_v1(p_cu);
  IF (p_decision ->> 'effective_kind') IS DISTINCT FROM derived.effective_kind
     OR claimed_ref IS DISTINCT FROM derived.effective_ref
     OR (p_decision -> 'transition')::boolean IS DISTINCT FROM derived.changed
     OR (p_decision ->> 'reason_code') IS DISTINCT FROM derived.reason_code THEN
    RAISE EXCEPTION 'LIVE_FOCUS_NOT_CANONICAL' USING ERRCODE='22023',
      DETAIL='Effective Live Focus is derived deterministically from the canonical B1 bundle, the FINAL Thread-layer result, the prior LF and the durable history; a payload may neither force another value, invent a transition, hide one, nor author a reason.';
  END IF;
  IF derived.changed THEN
    IF claimed_event IS DISTINCT FROM public.canonical_live_focus_transition_id_v1(p_cu.session_id, p_cu.id, derived.effective_kind, derived.effective_ref) THEN
      RAISE EXCEPTION 'INVALID_LIVE_FOCUS_IDENTITY' USING ERRCODE='22023',
        DETAIL='An LF transition identity is the deterministic RFC 4122 version-5 derivation of the Session, the CU, the target kind and the target reference; no other UUID is admissible.';
    END IF;
  ELSIF claimed_event IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023', DETAIL='An unchanged LF carries no transition identity.';
  END IF;
  changed := derived.changed;
  prior_kind := derived.prior_kind;
  prior_ref := derived.prior_ref;
  effective_kind := derived.effective_kind;
  effective_ref := derived.effective_ref;
  reason_code := derived.reason_code;
  RETURN NEXT;
END;$$;

CREATE FUNCTION public.persist_conversation_live_focus_transition_v1(
  p_cu public.conversation_units,
  p_commit_batch_id uuid,
  p_prior_kind text,
  p_prior_ref uuid,
  p_effective_kind text,
  p_effective_ref uuid,
  p_reason_code text,
  p_event_sequence bigint
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_event_sequence IS NULL OR p_event_sequence NOT IN (2, 3) THEN
    RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
      DETAIL='An LF transition is same-SP sequence 2 (no Thread-layer event) or 3 (after the Thread-layer sequence 2), never anything else.';
  END IF;
  INSERT INTO public.conversation_live_focus_transitions (
    event_id, user_id, session_id, cu_id, commit_batch_id, session_position, same_sp_event_sequence,
    from_kind, from_ref, to_kind, to_ref, reason_code)
  VALUES (
    public.canonical_live_focus_transition_id_v1(p_cu.session_id, p_cu.id, p_effective_kind, p_effective_ref),
    p_cu.user_id, p_cu.session_id, p_cu.id, p_commit_batch_id, p_cu.session_position, p_event_sequence,
    p_prior_kind, p_prior_ref, p_effective_kind, p_effective_ref, p_reason_code);
END;$$;

-- ===========================================================================
-- 8. The ONE structural full-chain completeness authority. It REUSES the 0070
--    B3 authority (which itself reuses 0068's) for the commitment, B1, B2 and
--    B3 layers and adds the LF layer:
--
--      ABSENT    every layer absent - the only state a NEW batch may start from
--      COMPLETE  B3 COMPLETE by 0070 AND the LF capture row present with the
--                batch's own counts AND, for every CU of the batch, the
--                DB-re-derived effective LF agrees with the stored transition
--                history: a transition row exists exactly when the LF changed,
--                at the CU's SP, at sequence 3 when the Thread layer used 2 and
--                sequence 2 otherwise, with the derived from / to / reason and
--                the derived identity, referencing a real same-Session Emerging
--                Focus or a real same-user canonical Thread
--      PARTIAL   anything else, including legacy T-03A2-only, B1-only,
--                B2-only, B3-only-without-LF, a missing / extra / wrong-SP /
--                wrong-sequence / wrong-value / wrong-reason / wrong-identity
--                transition, a transition where from == to, or an orphan row
--
--    Read-only, zero-mutation, timestamp-free. A derivation that cannot run
--    over the durable rows (a legacy neighbour) is PARTIAL, never an error.
-- ===========================================================================
CREATE FUNCTION public.conversation_full_semantic_batch_state_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_source_turn_id uuid,
  p_batch_id uuid
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  base_state text;
  commit_row public.conversation_unit_commit_batches;
  lf_row public.conversation_live_focus_commit_batches;
  cu public.conversation_units;
  result_row public.conversation_thread_semantic_unit_results;
  transition public.conversation_live_focus_transitions;
  derived record;
  expected_sequence bigint;
  row_total integer;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  base_state := public.conversation_thread_semantic_batch_state_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id);
  SELECT * INTO lf_row FROM public.conversation_live_focus_commit_batches l WHERE l.commit_batch_id = p_batch_id;
  IF base_state = 'ABSENT' THEN
    RETURN CASE WHEN lf_row.commit_batch_id IS NULL THEN 'ABSENT' ELSE 'PARTIAL' END;
  END IF;
  IF base_state <> 'COMPLETE' OR lf_row.commit_batch_id IS NULL THEN
    RETURN 'PARTIAL';
  END IF;
  SELECT * INTO commit_row FROM public.conversation_unit_commit_batches b WHERE b.id = p_batch_id;
  IF lf_row.user_id <> p_user_id OR lf_row.session_id <> p_session_id OR lf_row.source_turn_id <> p_source_turn_id
     OR lf_row.unit_count <> commit_row.unit_count THEN
    RETURN 'PARTIAL';
  END IF;
  -- Every transition row of this batch belongs to one of its CUs, and the
  -- recorded transition count is what the rows say.
  SELECT count(*) INTO row_total FROM public.conversation_live_focus_transitions t WHERE t.commit_batch_id = p_batch_id;
  IF row_total <> lf_row.transition_count THEN RETURN 'PARTIAL'; END IF;
  SELECT count(*) INTO row_total
    FROM public.conversation_live_focus_transitions t JOIN public.conversation_units u ON u.id = t.cu_id
   WHERE t.commit_batch_id = p_batch_id AND u.commit_batch_id = p_batch_id AND t.session_position = u.session_position
     AND t.session_id = u.session_id AND t.user_id = u.user_id;
  IF row_total <> lf_row.transition_count THEN RETURN 'PARTIAL'; END IF;

  FOR cu IN SELECT u.* FROM public.conversation_units u WHERE u.commit_batch_id = p_batch_id ORDER BY u.session_position LOOP
    BEGIN
      SELECT * INTO derived FROM public.derive_conversation_effective_live_focus_v1(cu);
    EXCEPTION WHEN SQLSTATE '55000' THEN
      RETURN 'PARTIAL';
    END;
    SELECT * INTO result_row FROM public.conversation_thread_semantic_unit_results r WHERE r.cu_id = cu.id;
    SELECT * INTO transition FROM public.conversation_live_focus_transitions t WHERE t.session_id = cu.session_id AND t.cu_id = cu.id;
    IF derived.changed THEN
      IF transition.event_id IS NULL THEN RETURN 'PARTIAL'; END IF;
      expected_sequence := CASE WHEN result_row.thread_layer_event_sequence = 2 THEN 3 ELSE 2 END;
      IF transition.commit_batch_id <> p_batch_id OR transition.session_position <> cu.session_position
         OR transition.same_sp_event_sequence <> expected_sequence
         OR transition.from_kind <> derived.prior_kind OR transition.from_ref IS DISTINCT FROM derived.prior_ref
         OR transition.to_kind <> derived.effective_kind OR transition.to_ref IS DISTINCT FROM derived.effective_ref
         OR transition.reason_code <> derived.reason_code
         OR transition.event_id <> public.canonical_live_focus_transition_id_v1(cu.session_id, cu.id, derived.effective_kind, derived.effective_ref) THEN
        RETURN 'PARTIAL';
      END IF;
      IF transition.to_kind = 'EMERGING' AND NOT EXISTS (SELECT 1 FROM public.conversation_emerging_focuses f
                                                            WHERE f.id = transition.to_ref AND f.session_id = p_session_id AND f.user_id = p_user_id) THEN
        RETURN 'PARTIAL';
      END IF;
      IF transition.to_kind = 'THREAD' AND NOT EXISTS (SELECT 1 FROM public.conversation_threads t
                                                          WHERE t.id = transition.to_ref AND t.user_id = p_user_id) THEN
        RETURN 'PARTIAL';
      END IF;
    ELSIF transition.event_id IS NOT NULL THEN
      RETURN 'PARTIAL';
    END IF;
  END LOOP;
  RETURN 'COMPLETE';
END;$$;

-- ===========================================================================
-- 9. The FINAL integrated per-Moment writer: B1 + B2 + B3 + LF. This is the
--    ONLY writer that may seal a Session Position after T-03D, and it is
--    reachable by an application role only through the coordinator below.
--
--    It preserves the ENTIRE 0064 / 0065 commitment contract, the ENTIRE
--    0066 B1 contract, the ENTIRE 0068 B2 contract and the ENTIRE 0070 B3
--    contract (their validators and persistence helpers are CALLED, never
--    re-implemented) and adds the LF layer at the SAME SP. For a NEW batch it
--    deliberately does NOT delegate to the 0070 batch writer: that writer
--    advances the clock CU by CU and would seal a Moment before its LF is
--    durable. Only the replay path delegates (zero mutation).
--
--    Per CU, in canonical source order, inside ONE clock-locked transaction:
--
--      A  insert this CU with its next SP
--      B  set clock.current_sp = this SP, reset same_sp_event_sequence = 0
--         reserve sequence 1 through the ONE T-03A2 seam
--         persist the whole T-03B1 bundle at (SP, 1)   - B1 truth complete
--      C  validate B2 (0068) and B3 (0070); when the Thread layer changes:
--         lock the identity clock / spatial authority, reserve sequence 2
--         ONCE, persist Thread + Home + binding + evidence + lifecycle + unit
--         result (this is the FINAL Thread-layer truth of the CU)
--      D  derive the effective LF AFTER the FINAL Thread-layer truth (D-01)
--      E  compare with the prior effective LF (the DB derivation does both)
--      F  changed  -> reserve the same-SP event ONCE, require exactly 2 when
--                     the Thread layer reserved nothing and exactly 3 when it
--                     took 2, insert the LF transition
--      G  unchanged -> reserve nothing
--      H  the LF capture identity was written for the whole batch up front
--         and every unit claim was proven against the derivation here
--      I  only then does the loop advance to the next CU, whose clock update
--         seals this SP - so the LF of CU i is part of the prior LF of CU i+1
-- ===========================================================================
CREATE FUNCTION public.commit_conversation_units_with_full_semantic_chain_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_source_turn_id uuid,
  p_batch_id uuid,
  p_units jsonb,
  p_evaluator_version text,
  p_policy_version text,
  p_segmentation_provider text,
  p_segmentation_model text,
  p_segmentation_prompt_version text,
  p_focus_units jsonb,
  p_focus_evaluator_version text,
  p_focus_policy_version text,
  p_focus_provider text,
  p_focus_model text,
  p_focus_prompt_version text,
  p_focus_schema_version integer,
  p_thread_units jsonb,
  p_thread_evaluator_version text,
  p_thread_policy_version text,
  p_thread_provider text,
  p_thread_model text,
  p_thread_prompt_version text,
  p_thread_schema_version integer,
  p_lifecycle_units jsonb,
  p_continuity_evaluator_version text,
  p_continuity_policy_version text,
  p_continuity_provider text,
  p_continuity_model text,
  p_continuity_prompt_version text,
  p_continuity_schema_version integer,
  p_lifecycle_reducer_version text,
  p_live_focus_units jsonb,
  p_lf_reducer_version text
) RETURNS SETOF public.conversation_units
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  uuid_shape constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  max_units constant integer := 64;
  clock_row public.session_semantic_clocks;
  session_row public.conversation_sessions;
  turn_row public.conversation_turns;
  identity_row public.conversation_world_thread_identity_clocks;
  authority_row public.conversation_world_spatial_authorities;
  lf_batch_row public.conversation_live_focus_commit_batches;
  transition_row public.conversation_live_focus_transitions;
  inserted_cu public.conversation_units;
  derived_digest bytea;
  derived_modality constant text := 'TEXT';
  derived_speaker constant text := 'RESOLVED';
  source_length integer;
  unit_count integer;
  establishment_count integer := 0;
  continuity_count integer := 0;
  lifecycle_count integer := 0;
  ambiguous_count integer := 0;
  transition_count integer := 0;
  unit jsonb;
  decision jsonb;
  lifecycle jsonb;
  lf_unit jsonb;
  outcome text;
  idx integer;
  unit_ids uuid[] := ARRAY[]::uuid[];
  span_starts integer[] := ARRAY[]::integer[];
  span_ends integer[] := ARRAY[]::integer[];
  cursor_pos integer;
  frontier integer;
  next_ordinal integer;
  first_sp integer;
  this_sp integer;
  reserved_sp integer;
  reserved_sequence bigint;
  has_change boolean;
  lf_decision record;
  canonical jsonb;
  fingerprint bytea;
  focus_canonical jsonb;
  focus_fingerprint bytea;
  thread_canonical jsonb;
  thread_fingerprint bytea;
  lifecycle_canonical jsonb;
  lifecycle_fingerprint bytea;
  lf_canonical jsonb;
  lf_fingerprint bytea;
  batch_state text;
  canonical_thread_id uuid;
  world_thread_ids text[];
  world_x numeric[];
  world_y numeric[];
  origin_ids text[];
  placement record;
BEGIN
  ---------------------------------------------------------------------------
  -- COMMON SETUP. Identical structure and identical rejections to 0070, plus
  -- the LF payload and provenance. THE SESSION CLOCK IS THE FIRST LOCK.
  ---------------------------------------------------------------------------
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF p_units IS NULL OR jsonb_typeof(p_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_focus_units IS NULL OR jsonb_typeof(p_focus_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_thread_units IS NULL OR jsonb_typeof(p_thread_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_lifecycle_units IS NULL OR jsonb_typeof(p_lifecycle_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_live_focus_units IS NULL OR jsonb_typeof(p_live_focus_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_lf_reducer_version IS NULL OR length(btrim(p_lf_reducer_version)) = 0 OR length(p_lf_reducer_version) > 64 THEN
    RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PROVENANCE' USING ERRCODE='22023';
  END IF;
  IF p_continuity_evaluator_version IS NULL OR length(btrim(p_continuity_evaluator_version)) = 0 OR length(p_continuity_evaluator_version) > 64
     OR p_continuity_policy_version IS NULL OR length(btrim(p_continuity_policy_version)) = 0 OR length(p_continuity_policy_version) > 64
     OR p_continuity_provider IS NULL OR length(btrim(p_continuity_provider)) = 0 OR length(p_continuity_provider) > 64
     OR p_continuity_model IS NULL OR length(btrim(p_continuity_model)) = 0 OR length(p_continuity_model) > 128
     OR p_continuity_prompt_version IS NULL OR length(btrim(p_continuity_prompt_version)) = 0 OR length(p_continuity_prompt_version) > 64
     OR p_continuity_schema_version IS NULL OR p_continuity_schema_version < 1
     OR p_lifecycle_reducer_version IS NULL OR length(btrim(p_lifecycle_reducer_version)) = 0 OR length(p_lifecycle_reducer_version) > 64 THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PROVENANCE' USING ERRCODE='22023';
  END IF;
  IF p_thread_evaluator_version IS NULL OR length(btrim(p_thread_evaluator_version)) = 0 OR length(p_thread_evaluator_version) > 64
     OR p_thread_policy_version IS NULL OR length(btrim(p_thread_policy_version)) = 0 OR length(p_thread_policy_version) > 64
     OR p_thread_provider IS NULL OR length(btrim(p_thread_provider)) = 0 OR length(p_thread_provider) > 64
     OR p_thread_model IS NULL OR length(btrim(p_thread_model)) = 0 OR length(p_thread_model) > 128
     OR p_thread_prompt_version IS NULL OR length(btrim(p_thread_prompt_version)) = 0 OR length(p_thread_prompt_version) > 64
     OR p_thread_schema_version IS NULL OR p_thread_schema_version < 1 THEN
    RAISE EXCEPTION 'INVALID_THREAD_PROVENANCE' USING ERRCODE='22023';
  END IF;
  IF p_evaluator_version IS NULL OR length(btrim(p_evaluator_version)) = 0 OR length(p_evaluator_version) > 64
     OR p_policy_version IS NULL OR length(btrim(p_policy_version)) = 0 OR length(p_policy_version) > 64
     OR p_segmentation_provider IS NULL OR length(btrim(p_segmentation_provider)) = 0 OR length(p_segmentation_provider) > 64
     OR p_segmentation_model IS NULL OR length(btrim(p_segmentation_model)) = 0 OR length(p_segmentation_model) > 128
     OR p_segmentation_prompt_version IS NULL OR length(btrim(p_segmentation_prompt_version)) = 0
     OR length(p_segmentation_prompt_version) > 64 THEN
    RAISE EXCEPTION 'INVALID_COMMIT_PROVENANCE' USING ERRCODE='22023';
  END IF;
  IF p_focus_evaluator_version IS NULL OR length(btrim(p_focus_evaluator_version)) = 0 OR length(p_focus_evaluator_version) > 64
     OR p_focus_policy_version IS NULL OR length(btrim(p_focus_policy_version)) = 0 OR length(p_focus_policy_version) > 64
     OR p_focus_provider IS NULL OR length(btrim(p_focus_provider)) = 0 OR length(p_focus_provider) > 64
     OR p_focus_model IS NULL OR length(btrim(p_focus_model)) = 0 OR length(p_focus_model) > 128
     OR p_focus_prompt_version IS NULL OR length(btrim(p_focus_prompt_version)) = 0 OR length(p_focus_prompt_version) > 64
     OR p_focus_schema_version IS NULL OR p_focus_schema_version < 1 THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PROVENANCE' USING ERRCODE='22023';
  END IF;

  unit_count := jsonb_array_length(p_units);
  IF unit_count > max_units THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023',
      DETAIL='A commitment batch carries at most 64 committed conversational units.';
  END IF;
  IF jsonb_array_length(p_focus_units) <> unit_count THEN
    RAISE EXCEPTION 'FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_thread_units) <> unit_count THEN
    RAISE EXCEPTION 'THREAD_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_lifecycle_units) <> unit_count THEN
    RAISE EXCEPTION 'THREAD_LIFECYCLE_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_live_focus_units) <> unit_count THEN
    RAISE EXCEPTION 'LIVE_FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
      DETAIL='Exactly one canonical LF decision corresponds to exactly one proposed committed CU, in the same order.';
  END IF;

  -- AF66-01: the Session Semantic Clock is the FIRST lock of the semantic
  -- transaction, taken before the source turn, before any semantic row, before
  -- the user/world identity version and long before the spatial authority.
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO session_row FROM public.conversation_sessions s
    WHERE s.id = p_session_id AND s.user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO turn_row FROM public.conversation_turns t
    WHERE t.id = p_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  IF turn_row.role NOT IN ('USER', 'ASSISTANT') THEN
    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_ROLE' USING ERRCODE='22023';
  END IF;
  IF turn_row.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'SOURCE_TURN_NOT_COMMITTABLE' USING ERRCODE='55000',
      DETAIL='Provisional, cancelled, failed and superseded source never becomes committed conversational truth.';
  END IF;
  IF session_row.channel <> 'TEXT' THEN
    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_MODALITY' USING ERRCODE='22023';
  END IF;
  derived_digest := sha256(convert_to(turn_row.content, 'UTF8'));
  source_length := length(turn_row.content);

  -- The 1:1 mapping between the five payloads, in order.
  cursor_pos := 0;
  FOR idx IN 0 .. unit_count - 1 LOOP
    unit := p_units -> idx;
    IF jsonb_typeof(unit) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(unit)) <> 3
       OR NOT (unit ? 'unit_id') OR NOT (unit ? 'span_start') OR NOT (unit ? 'span_end')
       OR jsonb_typeof(unit -> 'unit_id') <> 'string'
       OR jsonb_typeof(unit -> 'span_start') <> 'number'
       OR jsonb_typeof(unit -> 'span_end') <> 'number'
       OR (unit ->> 'unit_id') !~* uuid_shape
       OR (unit ->> 'span_start') !~ '^[0-9]{1,9}$'
       OR (unit ->> 'span_end') !~ '^[0-9]{1,9}$' THEN
      RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023';
    END IF;
    unit_ids := array_append(unit_ids, (unit ->> 'unit_id')::uuid);
    span_starts := array_append(span_starts, (unit ->> 'span_start')::integer);
    span_ends := array_append(span_ends, (unit ->> 'span_end')::integer);
    IF span_ends[idx + 1] <= span_starts[idx + 1] OR span_ends[idx + 1] > source_length THEN
      RAISE EXCEPTION 'SPAN_OUT_OF_RANGE' USING ERRCODE='22023';
    END IF;
    IF idx > 0 AND span_starts[idx + 1] < cursor_pos THEN
      RAISE EXCEPTION 'SPAN_NOT_FORWARD_ORDERED' USING ERRCODE='22023';
    END IF;
    cursor_pos := span_ends[idx + 1];

    unit := p_focus_units -> idx;
    IF jsonb_typeof(unit) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF NOT (unit ? 'unit_id') OR jsonb_typeof(unit -> 'unit_id') <> 'string'
       OR (unit ->> 'unit_id') !~* uuid_shape OR (unit ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
    END IF;

    decision := p_thread_units -> idx;
    IF jsonb_typeof(decision) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF NOT (decision ? 'unit_id') OR jsonb_typeof(decision -> 'unit_id') <> 'string'
       OR (decision ->> 'unit_id') !~* uuid_shape OR (decision ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'THREAD_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
    END IF;
    IF (decision ->> 'decision') = 'ESTABLISH_THREAD' THEN
      establishment_count := establishment_count + 1;
    END IF;

    lifecycle := p_lifecycle_units -> idx;
    IF jsonb_typeof(lifecycle) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF NOT (lifecycle ? 'unit_id') OR jsonb_typeof(lifecycle -> 'unit_id') <> 'string'
       OR (lifecycle ->> 'unit_id') !~* uuid_shape OR (lifecycle ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'THREAD_LIFECYCLE_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
    END IF;
    -- The B2 decision and the final outcome of one CU must agree before any batch row exists.
    IF ((decision ->> 'decision') = 'ESTABLISH_THREAD') <> ((lifecycle ->> 'outcome') = 'ESTABLISH_NEW') THEN
      RAISE EXCEPTION 'THREAD_ESTABLISHMENT_CONTINUITY_MISMATCH' USING ERRCODE='22023',
        DETAIL='ESTABLISH_NEW is truthful exactly when the B2 decision establishes and the continuity resolution is DISTINCT_NEW; a BIND or AMBIGUOUS continuity outcome forbids a new Thread.';
    END IF;
    IF (lifecycle ->> 'outcome') = 'ACTIVATE_EXISTING_IN_SESSION' THEN continuity_count := continuity_count + 1; END IF;
    IF (lifecycle ->> 'outcome') = 'IDENTITY_AMBIGUOUS' THEN ambiguous_count := ambiguous_count + 1; END IF;
    IF jsonb_typeof(lifecycle -> 'lifecycle_transitions') = 'array' THEN
      lifecycle_count := lifecycle_count + jsonb_array_length(lifecycle -> 'lifecycle_transitions');
    END IF;

    -- The LF decision: exact shape and 1:1 mapping now; its truth is proven
    -- against the DB derivation per CU below.
    lf_unit := p_live_focus_units -> idx;
    IF jsonb_typeof(lf_unit) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(lf_unit)) <> 6
       OR NOT (lf_unit ? 'unit_id') OR NOT (lf_unit ? 'effective_kind') OR NOT (lf_unit ? 'effective_ref')
       OR NOT (lf_unit ? 'transition') OR NOT (lf_unit ? 'reason_code') OR NOT (lf_unit ? 'transition_event_id') THEN
      RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023',
        DETAIL='A canonical LF decision carries exactly unit_id, effective_kind, effective_ref, transition, reason_code and transition_event_id.';
    END IF;
    IF jsonb_typeof(lf_unit -> 'unit_id') <> 'string'
       OR (lf_unit ->> 'unit_id') !~* uuid_shape OR (lf_unit ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'LIVE_FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
    END IF;
    IF jsonb_typeof(lf_unit -> 'effective_kind') <> 'string' OR (lf_unit ->> 'effective_kind') NOT IN ('NONE', 'EMERGING', 'THREAD')
       OR jsonb_typeof(lf_unit -> 'transition') <> 'boolean'
       OR ((lf_unit ->> 'effective_kind') = 'NONE') <> (jsonb_typeof(lf_unit -> 'effective_ref') = 'null')
       OR (jsonb_typeof(lf_unit -> 'effective_ref') NOT IN ('null', 'string'))
       OR (jsonb_typeof(lf_unit -> 'effective_ref') = 'string' AND (lf_unit ->> 'effective_ref') !~ uuid_shape) THEN
      RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023',
        DETAIL='Exactly three LF values are representable: NONE without a reference, EMERGING(emerging_focus_id), THREAD(thread_id).';
    END IF;
    IF (lf_unit -> 'transition')::boolean THEN
      IF jsonb_typeof(lf_unit -> 'reason_code') <> 'string'
         OR (lf_unit ->> 'reason_code') NOT IN ('NEW_INDEPENDENT_FOCUS', 'THREAD_PROMOTION', 'RETURN_TO_THREAD', 'FOCUS_REPLACEMENT', 'STABLE_DEPARTURE_NO_REPLACEMENT')
         OR jsonb_typeof(lf_unit -> 'transition_event_id') <> 'string' OR (lf_unit ->> 'transition_event_id') !~ uuid_shape THEN
        RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023',
          DETAIL='An LF transition carries exactly one of the five frozen reasons and its derived identity.';
      END IF;
      transition_count := transition_count + 1;
    ELSIF jsonb_typeof(lf_unit -> 'reason_code') <> 'null' OR jsonb_typeof(lf_unit -> 'transition_event_id') <> 'null' THEN
      RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023',
        DETAIL='An unchanged LF carries neither a reason nor a transition identity.';
    END IF;
  END LOOP;
  IF unit_count > 1 AND (SELECT count(DISTINCT d.u) FROM unnest(unit_ids) AS d(u)) <> unit_count THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023',
      DETAIL='Unit identities inside a commitment batch must be distinct.';
  END IF;

  -- The DB-derived canonical fingerprints, byte-identical to 0065 / 0066 /
  -- 0068 / 0070 so every writer recognises the same batch identity.
  canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'source_role', turn_row.role,
    'speaker_state', derived_speaker,
    'source_modality', derived_modality,
    'source_content_sha256', encode(derived_digest, 'hex'),
    'evaluator_version', p_evaluator_version,
    'policy_version', p_policy_version,
    'segmentation_provider', p_segmentation_provider,
    'segmentation_model', p_segmentation_model,
    'segmentation_prompt_version', p_segmentation_prompt_version,
    'unit_count', unit_count,
    'units', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'unit_id', unit_ids[g.i],
               'span_start', span_starts[g.i],
               'span_end', span_ends[g.i]) ORDER BY g.i)
        FROM generate_series(1, unit_count) AS g(i)), '[]'::jsonb));
  fingerprint := sha256(convert_to(canonical::text, 'UTF8'));
  focus_canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'focus_evaluator_version', p_focus_evaluator_version,
    'focus_policy_version', p_focus_policy_version,
    'focus_provider', p_focus_provider,
    'focus_model', p_focus_model,
    'focus_prompt_version', p_focus_prompt_version,
    'focus_schema_version', p_focus_schema_version,
    'unit_count', unit_count,
    'focus_units', p_focus_units);
  focus_fingerprint := sha256(convert_to(focus_canonical::text, 'UTF8'));
  thread_canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'thread_evaluator_version', p_thread_evaluator_version,
    'thread_policy_version', p_thread_policy_version,
    'thread_provider', p_thread_provider,
    'thread_model', p_thread_model,
    'thread_prompt_version', p_thread_prompt_version,
    'thread_schema_version', p_thread_schema_version,
    'unit_count', unit_count,
    'establishment_count', establishment_count,
    'thread_units', p_thread_units);
  thread_fingerprint := sha256(convert_to(thread_canonical::text, 'UTF8'));
  lifecycle_canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'continuity_evaluator_version', p_continuity_evaluator_version,
    'continuity_policy_version', p_continuity_policy_version,
    'continuity_provider', p_continuity_provider,
    'continuity_model', p_continuity_model,
    'continuity_prompt_version', p_continuity_prompt_version,
    'continuity_schema_version', p_continuity_schema_version,
    'lifecycle_reducer_version', p_lifecycle_reducer_version,
    'unit_count', unit_count,
    'establishment_count', establishment_count,
    'continuity_binding_count', continuity_count,
    'lifecycle_transition_count', lifecycle_count,
    'ambiguous_count', ambiguous_count,
    'lifecycle_units', p_lifecycle_units);
  lifecycle_fingerprint := sha256(convert_to(lifecycle_canonical::text, 'UTF8'));
  -- The DB-derived canonical LF capture fingerprint: the ordered canonical LF
  -- decisions plus the reducer identity; SP, sequence and timestamp excluded.
  lf_canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'lf_reducer_version', p_lf_reducer_version,
    'unit_count', unit_count,
    'transition_count', transition_count,
    'live_focus_units', p_live_focus_units);
  lf_fingerprint := sha256(convert_to(lf_canonical::text, 'UTF8'));

  -- The ONE full-chain completeness authority decides the path.
  batch_state := public.conversation_full_semantic_batch_state_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id);

  ---------------------------------------------------------------------------
  -- PATH B - NEW INTEGRATED BATCH. Allowed only when NO layer exists yet.
  ---------------------------------------------------------------------------
  IF batch_state = 'ABSENT' THEN
    SELECT COALESCE(MAX(cu.source_span_end), 0), COALESCE(MAX(cu.ordinal_within_turn) + 1, 0)
      INTO frontier, next_ordinal
      FROM public.conversation_units cu WHERE cu.source_turn_id = turn_row.id;
    IF unit_count > 0 AND span_starts[1] < frontier THEN
      RAISE EXCEPTION 'SPAN_BEFORE_SOURCE_FRONTIER' USING ERRCODE='22023';
    END IF;

    INSERT INTO public.conversation_unit_commit_batches (
      id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256,
      unit_count, evaluator_version, policy_version,
      segmentation_provider, segmentation_model, segmentation_prompt_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, fingerprint, derived_digest,
      unit_count, p_evaluator_version, p_policy_version,
      p_segmentation_provider, p_segmentation_model, p_segmentation_prompt_version);
    INSERT INTO public.conversation_focus_commit_batches (
      commit_batch_id, user_id, session_id, source_turn_id, unit_count, canonical_fingerprint,
      focus_evaluator_version, focus_policy_version, focus_provider, focus_model,
      focus_prompt_version, focus_schema_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, focus_fingerprint,
      p_focus_evaluator_version, p_focus_policy_version, p_focus_provider, p_focus_model,
      p_focus_prompt_version, p_focus_schema_version);
    INSERT INTO public.conversation_thread_commit_batches (
      commit_batch_id, user_id, session_id, source_turn_id, unit_count, establishment_count,
      canonical_fingerprint, thread_evaluator_version, thread_policy_version,
      thread_provider, thread_model, thread_prompt_version, thread_schema_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, establishment_count,
      thread_fingerprint, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version);
    INSERT INTO public.conversation_thread_semantic_commit_batches (
      commit_batch_id, user_id, session_id, source_turn_id, unit_count, establishment_count,
      continuity_binding_count, lifecycle_transition_count, ambiguous_count, canonical_fingerprint,
      continuity_evaluator_version, continuity_policy_version, continuity_provider, continuity_model,
      continuity_prompt_version, continuity_schema_version, lifecycle_reducer_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, establishment_count,
      continuity_count, lifecycle_count, ambiguous_count, lifecycle_fingerprint,
      p_continuity_evaluator_version, p_continuity_policy_version, p_continuity_provider, p_continuity_model,
      p_continuity_prompt_version, p_continuity_schema_version, p_lifecycle_reducer_version);
    -- H (up front): the technical LF capture identity of the whole batch.
    INSERT INTO public.conversation_live_focus_commit_batches (
      commit_batch_id, user_id, session_id, source_turn_id, unit_count, transition_count,
      canonical_fingerprint, lf_reducer_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, transition_count,
      lf_fingerprint, p_lf_reducer_version);

    -- A ZERO-CU batch is a complete evaluation batch at all five layers:
    -- no SP, no same-SP sequence, no LF transition, LF unchanged.
    IF unit_count = 0 THEN
      RETURN;
    END IF;

    this_sp := COALESCE(clock_row.current_sp, 0);
    FOR idx IN 1 .. unit_count LOOP
      -- A: this CU is born at the next Session Position.
      this_sp := this_sp + 1;
      IF idx = 1 THEN first_sp := this_sp; END IF;
      INSERT INTO public.conversation_units (
        id, user_id, session_id, source_turn_id, commit_batch_id,
        source_role, speaker_state, source_modality,
        ordinal_within_turn, source_span_start, source_span_end,
        committed_text, source_content_sha256, session_position)
      VALUES (unit_ids[idx], turn_row.user_id, turn_row.session_id, turn_row.id, p_batch_id,
        turn_row.role, derived_speaker, derived_modality,
        next_ordinal + idx - 1, span_starts[idx], span_ends[idx],
        substring(turn_row.content from span_starts[idx] + 1 for span_ends[idx] - span_starts[idx]),
        derived_digest, this_sp)
      RETURNING * INTO inserted_cu;

      -- B: this SP becomes the open head; every earlier SP is sealed. Then the
      -- ONE same-SP sequence authority: B1 is always sequence 1.
      UPDATE public.session_semantic_clocks c
         SET current_sp = this_sp, same_sp_event_sequence = 0
       WHERE c.session_id = turn_row.session_id;
      SELECT r.session_position, r.event_sequence INTO reserved_sp, reserved_sequence
        FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r;
      IF reserved_sp IS DISTINCT FROM this_sp OR reserved_sequence IS DISTINCT FROM 1::bigint THEN
        RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
          DETAIL='The first Stage-6 semantic layer after commitment is sequence 1 on the SP the CU was born at.';
      END IF;
      PERFORM public.persist_conversation_unit_focus_semantics_v1(
        inserted_cu, p_batch_id, p_focus_units -> (idx - 1), reserved_sequence);

      decision := p_thread_units -> (idx - 1);
      lifecycle := p_lifecycle_units -> (idx - 1);
      lf_unit := p_live_focus_units -> (idx - 1);
      outcome := lifecycle ->> 'outcome';

      -- C: the deterministic DB gates of the B2 and B3 layers (0068 / 0070),
      -- against the rows this transaction has already made durable at this
      -- exact SP; then the FINAL Thread layer, at sequence 2 or not at all.
      PERFORM public.validate_conversation_thread_decision_v1(inserted_cu, decision);
      PERFORM public.validate_conversation_thread_lifecycle_decision_v1(inserted_cu, decision, lifecycle);

      has_change := outcome IN ('ESTABLISH_NEW', 'ACTIVATE_EXISTING_IN_SESSION')
        OR jsonb_array_length(lifecycle -> 'lifecycle_transitions') > 0;

      IF has_change THEN
        -- A dossier change locks the user/world Thread Identity Clock -
        -- after the Session clock, before the spatial authority.
        IF outcome IN ('ESTABLISH_NEW', 'ACTIVATE_EXISTING_IN_SESSION') THEN
          INSERT INTO public.conversation_world_thread_identity_clocks (user_id)
          VALUES (turn_row.user_id)
          ON CONFLICT (user_id) DO NOTHING;
          SELECT * INTO identity_row FROM public.conversation_world_thread_identity_clocks w
            WHERE w.user_id = turn_row.user_id
            FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'WORLD_THREAD_IDENTITY_CLOCK_MISSING' USING ERRCODE='55000';
          END IF;
        END IF;

        -- A NEW establishment locks the spatial authority and computes the
        -- canonical Home against the locked world, exactly as 0068 / 0070 do.
        IF (decision ->> 'decision') = 'ESTABLISH_THREAD' THEN
          INSERT INTO public.conversation_world_spatial_authorities (user_id, address_scheme)
          VALUES (turn_row.user_id, 'QANDEEL_OSDAP_V1')
          ON CONFLICT (user_id) DO NOTHING;
          SELECT * INTO authority_row FROM public.conversation_world_spatial_authorities w
            WHERE w.user_id = turn_row.user_id
            FOR UPDATE;
          IF NOT FOUND OR authority_row.address_scheme <> 'QANDEEL_OSDAP_V1' THEN
            RAISE EXCEPTION 'CANONICAL_WORLD_AUTHORITY_MISSING' USING ERRCODE='55000';
          END IF;
          SELECT COALESCE(array_agg(h.thread_id::text ORDER BY h.thread_id), ARRAY[]::text[]),
                 COALESCE(array_agg(h.placement_x ORDER BY h.thread_id), ARRAY[]::numeric[]),
                 COALESCE(array_agg(h.placement_y ORDER BY h.thread_id), ARRAY[]::numeric[])
            INTO world_thread_ids, world_x, world_y
            FROM public.conversation_thread_homes h
           WHERE h.user_id = turn_row.user_id AND h.address_scheme = authority_row.address_scheme;
          SELECT COALESCE(array_agg(m.value #>> '{}' ORDER BY m.ordinality), ARRAY[]::text[])
            INTO origin_ids
            FROM jsonb_array_elements(decision -> 'origin_thread_ids') WITH ORDINALITY AS m(value, ordinality);
          SELECT c.thread_id INTO canonical_thread_id
            FROM public.canonical_thread_identities_v1(turn_row.user_id, (decision ->> 'emerging_focus_id')::uuid) c;
          SELECT p.placement_x, p.placement_y, p.placement_attempt, p.base_x, p.base_y, p.world_fingerprint, p.origin_fingerprint
            INTO placement
            FROM public.compute_canonical_home_placement_v1(
                   turn_row.user_id::text, canonical_thread_id::text, (decision ->> 'origin_state'),
                   origin_ids, world_thread_ids, world_x, world_y) p;
        END IF;

        -- The ONE same-SP sequence authority, ONCE for the whole Thread layer.
        SELECT r.session_position, r.event_sequence INTO reserved_sp, reserved_sequence
          FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r;
        IF reserved_sp IS DISTINCT FROM this_sp OR reserved_sequence IS DISTINCT FROM 2::bigint THEN
          RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
            DETAIL='The final Thread layer is the second Stage-6 semantic layer on the SP the CU was born at, reserved exactly once, and B1 must already hold sequence 1 there.';
        END IF;

        -- Every Thread-layer row of this CU at (this_sp, 2).
        IF (decision ->> 'decision') = 'ESTABLISH_THREAD' THEN
          PERFORM public.persist_conversation_thread_establishment_v1(
            inserted_cu, p_batch_id, decision, reserved_sequence,
            placement.placement_x, placement.placement_y, placement.placement_attempt,
            placement.base_x, placement.base_y, placement.world_fingerprint, placement.origin_fingerprint);
        END IF;
        PERFORM public.persist_conversation_thread_lifecycle_layer_v1(inserted_cu, p_batch_id, lifecycle, reserved_sequence);
      ELSE
        PERFORM public.persist_conversation_thread_lifecycle_layer_v1(inserted_cu, p_batch_id, lifecycle, NULL);
      END IF;

      -- D + E: the effective LF, derived AFTER the FINAL Thread-layer truth of
      -- this CU, compared with the prior effective LF, and proven against the
      -- canonical LF decision the application proposed.
      SELECT * INTO lf_decision FROM public.validate_conversation_live_focus_decision_v1(inserted_cu, lf_unit);

      IF lf_decision.changed THEN
        -- F: the ONE same-SP sequence authority, ONCE for the LF transition:
        -- exactly 2 when the Thread layer reserved nothing, exactly 3 after
        -- a Thread-layer sequence 2.
        SELECT r.session_position, r.event_sequence INTO reserved_sp, reserved_sequence
          FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r;
        IF reserved_sp IS DISTINCT FROM this_sp
           OR reserved_sequence IS DISTINCT FROM (CASE WHEN has_change THEN 3::bigint ELSE 2::bigint END) THEN
          RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
            DETAIL='An LF transition is sequence 2 on a Moment with no Thread-layer event and sequence 3 after the Thread-layer sequence 2, reserved exactly once, on the SP the CU was born at.';
        END IF;
        PERFORM public.persist_conversation_live_focus_transition_v1(
          inserted_cu, p_batch_id, lf_decision.prior_kind, lf_decision.prior_ref,
          lf_decision.effective_kind, lf_decision.effective_ref, lf_decision.reason_code, reserved_sequence);
      END IF;
      -- G: an unchanged LF reserved nothing. I: only now may the next CU
      -- advance the clock and seal this SP.
    END LOOP;

    INSERT INTO public.conversation_unit_commit_events (
      commit_batch_id, user_id, session_id, source_turn_id, first_sp, last_sp, unit_count)
    VALUES (p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, first_sp, this_sp, unit_count);

    RETURN QUERY SELECT cu.* FROM public.conversation_units cu
      WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
    RETURN;
  END IF;

  ---------------------------------------------------------------------------
  -- PATH A - REPLAY. Every layer must be COMPLETE by the ONE full-chain
  -- authority: a batch that carries CU + B1 + B2 + B3 truth but no LF capture
  -- is PARTIAL / LEGACY state whose SP may already be sealed, and it is never
  -- upgraded, backfilled or completed here.
  ---------------------------------------------------------------------------
  IF batch_state <> 'COMPLETE' THEN
    RAISE EXCEPTION 'FULL_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
      DETAIL='This commitment batch is structurally partial at the commitment, B1, B2, B3 or LF layer; partial, corrupted or legacy state is never repaired, upgraded, replayed or backfilled from today''s inference.';
  END IF;

  -- The frozen 0070 writer verifies the CU, B1, B2 and B3 layers tuple by
  -- tuple with ZERO mutation; then the LF capture identity must match exactly.
  PERFORM * FROM public.commit_conversation_units_with_focus_thread_lifecycle_v1(
    p_session_id, p_user_id, p_source_turn_id, p_batch_id, p_units,
    p_evaluator_version, p_policy_version, p_segmentation_provider,
    p_segmentation_model, p_segmentation_prompt_version,
    p_focus_units, p_focus_evaluator_version, p_focus_policy_version,
    p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
    p_thread_units, p_thread_evaluator_version, p_thread_policy_version,
    p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version,
    p_lifecycle_units, p_continuity_evaluator_version, p_continuity_policy_version,
    p_continuity_provider, p_continuity_model, p_continuity_prompt_version, p_continuity_schema_version,
    p_lifecycle_reducer_version);

  SELECT * INTO lf_batch_row FROM public.conversation_live_focus_commit_batches l WHERE l.commit_batch_id = p_batch_id;
  IF lf_batch_row.user_id <> turn_row.user_id
     OR lf_batch_row.session_id <> turn_row.session_id
     OR lf_batch_row.source_turn_id <> turn_row.id
     OR lf_batch_row.unit_count <> unit_count
     OR lf_batch_row.transition_count <> transition_count
     OR lf_batch_row.lf_reducer_version <> p_lf_reducer_version
     OR lf_batch_row.canonical_fingerprint IS DISTINCT FROM lf_fingerprint THEN
    RAISE EXCEPTION 'LIVE_FOCUS_BATCH_PAYLOAD_CONFLICT' USING ERRCODE='22023',
      DETAIL='An LF capture identity is immutable: the same batch id can never be replayed with a different effective LF, transition, reason, identity or reducer provenance.';
  END IF;

  -- Payload-level replay identity beyond the fingerprint: every stored
  -- transition is exactly what this canonical payload names.
  FOR idx IN 1 .. unit_count LOOP
    lf_unit := p_live_focus_units -> (idx - 1);
    SELECT * INTO transition_row FROM public.conversation_live_focus_transitions t WHERE t.cu_id = unit_ids[idx];
    IF (lf_unit -> 'transition')::boolean THEN
      IF transition_row.event_id IS NULL OR transition_row.commit_batch_id <> p_batch_id
         OR transition_row.event_id IS DISTINCT FROM (lf_unit ->> 'transition_event_id')::uuid
         OR transition_row.to_kind <> (lf_unit ->> 'effective_kind')
         OR transition_row.to_ref IS DISTINCT FROM (lf_unit ->> 'effective_ref')::uuid
         OR transition_row.reason_code <> (lf_unit ->> 'reason_code') THEN
        RAISE EXCEPTION 'FULL_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
          DETAIL='The stored LF transition of this CU is not the transition this canonical payload names; nothing is replayed over a different effective Live Focus.';
      END IF;
    ELSIF transition_row.event_id IS NOT NULL THEN
      RAISE EXCEPTION 'FULL_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
        DETAIL='A stored LF transition exists where this canonical payload names an unchanged Live Focus.';
    END IF;
  END LOOP;

  RETURN QUERY SELECT cu.* FROM public.conversation_units cu
    WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
  RETURN;
END;$$;

-- ===========================================================================
-- 10. The FINAL atomic finalized-exchange coordinator: the ONE application
--     mutation authority after T-03D. Exactly the 0070 shape, extended by the
--     LF payloads, the LF provenance and the LF delivery facts: ONE Session
--     clock acquired FIRST and held across both blocks, the two source rows
--     locked, the finalized-exchange relation proved, BOTH halves classified
--     by the ONE full-chain completeness authority, the Session-clock token
--     compared against the LOCKED clock, then the user/world Thread Identity
--     Clock locked and its version compared - all before any canonical
--     mutation - then the USER block and the ASSISTANT block in canonical
--     conversational order. LF introduces NO third optimistic authority. No
--     provider call happens while a lock is held, and no Home coordinate, LF
--     label or content is accepted or returned.
-- ===========================================================================
CREATE FUNCTION public.commit_finalized_exchange_with_full_semantic_chain_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_user_source_turn_id uuid,
  p_user_batch_id uuid,
  p_user_units jsonb,
  p_user_focus_units jsonb,
  p_user_thread_units jsonb,
  p_user_lifecycle_units jsonb,
  p_user_live_focus_units jsonb,
  p_assistant_source_turn_id uuid,
  p_assistant_batch_id uuid,
  p_assistant_units jsonb,
  p_assistant_focus_units jsonb,
  p_assistant_thread_units jsonb,
  p_assistant_lifecycle_units jsonb,
  p_assistant_live_focus_units jsonb,
  p_evaluator_version text,
  p_policy_version text,
  p_segmentation_provider text,
  p_segmentation_model text,
  p_segmentation_prompt_version text,
  p_focus_evaluator_version text,
  p_focus_policy_version text,
  p_focus_provider text,
  p_focus_model text,
  p_focus_prompt_version text,
  p_focus_schema_version integer,
  p_thread_evaluator_version text,
  p_thread_policy_version text,
  p_thread_provider text,
  p_thread_model text,
  p_thread_prompt_version text,
  p_thread_schema_version integer,
  p_continuity_evaluator_version text,
  p_continuity_policy_version text,
  p_continuity_provider text,
  p_continuity_model text,
  p_continuity_prompt_version text,
  p_continuity_schema_version integer,
  p_lifecycle_reducer_version text,
  p_lf_reducer_version text,
  p_expected_current_sp integer,
  p_expected_same_sp_event_sequence bigint,
  p_expected_world_thread_identity_version bigint
) RETURNS TABLE(
  live_head integer,
  same_sp_event_sequence bigint,
  world_thread_identity_version bigint,
  live_focus_kind text,
  live_focus_ref uuid,
  live_focus_sp integer,
  user_units jsonb,
  assistant_units jsonb,
  user_event jsonb,
  assistant_event jsonb,
  live_focus_transitions jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  clock_row public.session_semantic_clocks;
  identity_row public.conversation_world_thread_identity_clocks;
  user_turn_row public.conversation_turns;
  assistant_turn_row public.conversation_turns;
  user_state text;
  assistant_state text;
  both_exist boolean;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL
     OR p_user_source_turn_id IS NULL OR p_assistant_source_turn_id IS NULL
     OR p_user_batch_id IS NULL OR p_assistant_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF p_user_source_turn_id = p_assistant_source_turn_id OR p_user_batch_id = p_assistant_batch_id THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023',
      DETAIL='A finalized exchange carries two distinct source turns and two distinct commitment batches.';
  END IF;
  IF p_expected_same_sp_event_sequence IS NULL OR p_expected_same_sp_event_sequence < 0
     OR (p_expected_current_sp IS NOT NULL AND p_expected_current_sp < 1) THEN
    RAISE EXCEPTION 'INVALID_FOCUS_CONTEXT_TOKEN' USING ERRCODE='22023',
      DETAIL='The expected semantic-clock token is (current_sp >= 1 or NULL before the first SP, same_sp_event_sequence >= 0).';
  END IF;
  IF p_expected_world_thread_identity_version IS NULL OR p_expected_world_thread_identity_version < 0 THEN
    RAISE EXCEPTION 'INVALID_THREAD_IDENTITY_CONTEXT_TOKEN' USING ERRCODE='22023',
      DETAIL='The expected user/world Thread identity version is a non-negative technical version.';
  END IF;

  -- AF66-01: exactly ONE Session clock, acquired FIRST and held for the whole
  -- exchange transaction, before every source row, semantic row, identity
  -- version, world row and LF row.
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO user_turn_row FROM public.conversation_turns t
    WHERE t.id = p_user_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO assistant_turn_row FROM public.conversation_turns t
    WHERE t.id = p_assistant_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  IF user_turn_row.role <> 'USER'
     OR user_turn_row.status <> 'COMPLETED'
     OR user_turn_row.source_turn_id IS NOT NULL
     OR assistant_turn_row.role <> 'ASSISTANT'
     OR assistant_turn_row.status <> 'COMPLETED'
     OR assistant_turn_row.source_turn_id IS DISTINCT FROM user_turn_row.id THEN
    RAISE EXCEPTION 'INVALID_FINALIZED_EXCHANGE_RELATION' USING ERRCODE='22023',
      DETAIL='A finalized exchange is one COMPLETED USER source turn and the COMPLETED ASSISTANT turn finalized as its response, in that order.';
  END IF;

  -- BOTH halves through the ONE full-chain completeness authority, BEFORE the
  -- token logic and BEFORE either writer: ABSENT + ABSENT or COMPLETE + COMPLETE.
  user_state := public.conversation_full_semantic_batch_state_v1(p_session_id, p_user_id, p_user_source_turn_id, p_user_batch_id);
  assistant_state := public.conversation_full_semantic_batch_state_v1(p_session_id, p_user_id, p_assistant_source_turn_id, p_assistant_batch_id);
  IF NOT ((user_state = 'ABSENT' AND assistant_state = 'ABSENT')
          OR (user_state = 'COMPLETE' AND assistant_state = 'COMPLETE')) THEN
    RAISE EXCEPTION 'FULL_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
      DETAIL='A finalized exchange is committed as a whole or not at all: one half canonical while the other is absent or structurally partial is never completed, replayed or repaired.';
  END IF;

  -- Stale-context protection, first authority: the Session Semantic Clock.
  both_exist := user_state = 'COMPLETE';
  IF NOT both_exist
     AND (clock_row.current_sp IS DISTINCT FROM p_expected_current_sp
          OR clock_row.same_sp_event_sequence IS DISTINCT FROM p_expected_same_sp_event_sequence) THEN
    RAISE EXCEPTION 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' USING ERRCODE='40001',
      DETAIL='The Session Semantic Clock moved after the prior context was read; nothing was written. Re-read the context and evaluate again.';
  END IF;

  -- Stale-context protection, second authority: the user/world Thread
  -- Identity Clock, locked AFTER the Session clock and compared BEFORE any
  -- canonical mutation. LF adds no third authority: the current LF is read
  -- under the same Session clock token, and the token moves with every SP.
  IF NOT both_exist THEN
    INSERT INTO public.conversation_world_thread_identity_clocks (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO identity_row FROM public.conversation_world_thread_identity_clocks w
      WHERE w.user_id = p_user_id
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'WORLD_THREAD_IDENTITY_CLOCK_MISSING' USING ERRCODE='55000';
    END IF;
    IF identity_row.current_version IS DISTINCT FROM p_expected_world_thread_identity_version THEN
      RAISE EXCEPTION 'STALE_THREAD_IDENTITY_CONTEXT' USING ERRCODE='40001',
        DETAIL='The user/world Thread identity dossiers changed after they were screened; nothing was written. Re-read the context and the dossiers and resolve again.';
    END IF;
  END IF;

  -- USER block first, ASSISTANT block second: canonical conversational order.
  SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u.ordinal_within_turn), '[]'::jsonb)
    INTO user_units
    FROM public.commit_conversation_units_with_full_semantic_chain_v1(
      p_session_id, p_user_id, p_user_source_turn_id, p_user_batch_id, p_user_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version,
      p_user_focus_units, p_focus_evaluator_version, p_focus_policy_version,
      p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
      p_user_thread_units, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version,
      p_user_lifecycle_units, p_continuity_evaluator_version, p_continuity_policy_version,
      p_continuity_provider, p_continuity_model, p_continuity_prompt_version, p_continuity_schema_version,
      p_lifecycle_reducer_version, p_user_live_focus_units, p_lf_reducer_version) u;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.ordinal_within_turn), '[]'::jsonb)
    INTO assistant_units
    FROM public.commit_conversation_units_with_full_semantic_chain_v1(
      p_session_id, p_user_id, p_assistant_source_turn_id, p_assistant_batch_id, p_assistant_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version,
      p_assistant_focus_units, p_focus_evaluator_version, p_focus_policy_version,
      p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
      p_assistant_thread_units, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version,
      p_assistant_lifecycle_units, p_continuity_evaluator_version, p_continuity_policy_version,
      p_continuity_provider, p_continuity_model, p_continuity_prompt_version, p_continuity_schema_version,
      p_lifecycle_reducer_version, p_assistant_live_focus_units, p_lf_reducer_version) a;

  SELECT c.current_sp, c.same_sp_event_sequence INTO live_head, same_sp_event_sequence
    FROM public.session_semantic_clocks c WHERE c.session_id = p_session_id;
  SELECT COALESCE((SELECT w.current_version FROM public.conversation_world_thread_identity_clocks w WHERE w.user_id = p_user_id), 0)
    INTO world_thread_identity_version;
  SELECT f.live_focus_kind, f.live_focus_ref, f.live_focus_sp INTO live_focus_kind, live_focus_ref, live_focus_sp
    FROM public.conversation_session_live_focus_before_v1(p_session_id, NULL) f;
  SELECT to_jsonb(e) INTO user_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_user_batch_id;
  SELECT to_jsonb(e) INTO assistant_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_assistant_batch_id;
  -- The LF transitions created or replayed for this exchange, in SP order:
  -- reference identity only, never the same-SP sequence, never a label.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('session_position', t.session_position, 'to_kind', t.to_kind, 'to_ref', t.to_ref)
                            ORDER BY t.session_position), '[]'::jsonb)
    INTO live_focus_transitions
    FROM public.conversation_live_focus_transitions t
   WHERE t.commit_batch_id IN (p_user_batch_id, p_assistant_batch_id);
  RETURN NEXT;
END;$$;

-- ===========================================================================
-- 11. The FINAL runtime reads (service_role), preserved by delegation:
--
--     snapshot  the 0070 integrated snapshot (commitment, B1, B2, B3) PLUS
--               the full-chain completeness authority, the technical LF
--               capture counters, the LF transitions of this batch in SP
--               order (reference identity only) and the Session's current LF
--     context   the 0070 runtime context (token, B1 prior context, canonical
--               B1 bundles, attention history, bindings, lifecycle history,
--               identity version) PLUS the current effective LF. It FAILS
--               CLOSED on any prior batch of the Session that is not full-
--               chain COMPLETE: legacy history is never silently reduced to
--               "no LF yet".
-- ===========================================================================
CREATE FUNCTION public.get_conversation_full_semantic_integrated_batch_snapshot_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_source_turn_id uuid,
  p_batch_id uuid
) RETURNS TABLE(
  batch_exists boolean,
  committed_unit_count integer,
  units jsonb,
  commit_event jsonb,
  source_frontier integer,
  live_head integer,
  focus_batch_exists boolean,
  focus_semantic_count integer,
  focus_attention_count integer,
  focus_complete boolean,
  thread_capture_state text,
  thread_batch_exists boolean,
  thread_unit_count integer,
  thread_establishment_count integer,
  thread_semantic_capture_state text,
  thread_semantic_batch_exists boolean,
  thread_semantic_unit_count integer,
  continuity_binding_count integer,
  lifecycle_transition_count integer,
  full_semantic_capture_state text,
  live_focus_batch_exists boolean,
  live_focus_unit_count integer,
  live_focus_transition_count integer,
  live_focus_transitions jsonb,
  session_live_focus_kind text,
  session_live_focus_ref uuid,
  session_live_focus_sp integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  lf_row public.conversation_live_focus_commit_batches;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  SELECT s.batch_exists, s.committed_unit_count, s.units, s.commit_event, s.source_frontier, s.live_head,
         s.focus_batch_exists, s.focus_semantic_count, s.focus_attention_count, s.focus_complete,
         s.thread_capture_state, s.thread_batch_exists, s.thread_unit_count, s.thread_establishment_count,
         s.thread_semantic_capture_state, s.thread_semantic_batch_exists, s.thread_semantic_unit_count,
         s.continuity_binding_count, s.lifecycle_transition_count
    INTO batch_exists, committed_unit_count, units, commit_event, source_frontier, live_head,
         focus_batch_exists, focus_semantic_count, focus_attention_count, focus_complete,
         thread_capture_state, thread_batch_exists, thread_unit_count, thread_establishment_count,
         thread_semantic_capture_state, thread_semantic_batch_exists, thread_semantic_unit_count,
         continuity_binding_count, lifecycle_transition_count
    FROM public.get_conversation_thread_lifecycle_integrated_batch_snapshot_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id) s;

  full_semantic_capture_state := public.conversation_full_semantic_batch_state_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id);
  live_focus_batch_exists := false;
  live_focus_unit_count := 0;
  live_focus_transition_count := 0;
  SELECT * INTO lf_row FROM public.conversation_live_focus_commit_batches l WHERE l.commit_batch_id = p_batch_id;
  IF FOUND THEN
    IF lf_row.user_id <> p_user_id OR lf_row.session_id <> p_session_id OR lf_row.source_turn_id <> p_source_turn_id THEN
      RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
    END IF;
    live_focus_batch_exists := true;
    live_focus_unit_count := lf_row.unit_count;
    live_focus_transition_count := lf_row.transition_count;
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('session_position', t.session_position, 'to_kind', t.to_kind, 'to_ref', t.to_ref)
                            ORDER BY t.session_position), '[]'::jsonb)
    INTO live_focus_transitions
    FROM public.conversation_live_focus_transitions t
   WHERE t.commit_batch_id = p_batch_id AND t.session_id = p_session_id AND t.user_id = p_user_id;
  SELECT f.live_focus_kind, f.live_focus_ref, f.live_focus_sp INTO session_live_focus_kind, session_live_focus_ref, session_live_focus_sp
    FROM public.conversation_session_current_live_focus_v1(p_session_id, p_user_id) f;
  RETURN NEXT;
END;$$;

CREATE FUNCTION public.get_conversation_full_semantic_runtime_context_v1(
  p_session_id uuid,
  p_user_id uuid
) RETURNS TABLE(
  base_current_sp integer,
  base_same_sp_event_sequence bigint,
  world_thread_identity_version bigint,
  prior_cus jsonb,
  reference_handles jsonb,
  focus_candidates jsonb,
  current_focus_candidate_id uuid,
  prior_focus_semantics jsonb,
  focus_attention_history jsonb,
  established_thread_bindings jsonb,
  session_focus_thread_bindings jsonb,
  session_thread_lifecycle_history jsonb,
  current_live_focus_kind text,
  current_live_focus_ref uuid,
  current_live_focus_sp integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  offending uuid;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;

  -- The T-03B3 read is the authority for everything up to the FINAL Thread layer.
  SELECT c.base_current_sp, c.base_same_sp_event_sequence, c.world_thread_identity_version, c.prior_cus, c.reference_handles,
         c.focus_candidates, c.current_focus_candidate_id, c.prior_focus_semantics, c.focus_attention_history,
         c.established_thread_bindings, c.session_focus_thread_bindings, c.session_thread_lifecycle_history
    INTO base_current_sp, base_same_sp_event_sequence, world_thread_identity_version, prior_cus, reference_handles,
         focus_candidates, current_focus_candidate_id, prior_focus_semantics, focus_attention_history,
         established_thread_bindings, session_focus_thread_bindings, session_thread_lifecycle_history
    FROM public.get_conversation_thread_lifecycle_runtime_context_v1(p_session_id, p_user_id) c;

  -- Fail closed on any prior batch that is not COMPLETE at the LF layer.
  SELECT b.id INTO offending
    FROM public.conversation_unit_commit_batches b
   WHERE b.session_id = p_session_id AND b.user_id = p_user_id
     AND public.conversation_full_semantic_batch_state_v1(b.session_id, b.user_id, b.source_turn_id, b.id) <> 'COMPLETE'
   ORDER BY b.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'INCOMPLETE_PRIOR_SEMANTIC_HISTORY' USING ERRCODE='55000',
      DETAIL=format('PRIOR_BATCH_NOT_FULL_CHAIN_COMPLETE: %s', offending);
  END IF;

  -- An LF transition at a Session Position later than the base token is
  -- structurally impossible; it is refused, never truncated.
  IF EXISTS (SELECT 1 FROM public.conversation_live_focus_transitions t
              WHERE t.session_id = p_session_id AND (base_current_sp IS NULL OR t.session_position > base_current_sp)) THEN
    RAISE EXCEPTION 'INVALID_SEMANTIC_RUNTIME_CONTEXT' USING ERRCODE='55000',
      DETAIL='An LF transition cannot lie at a Session Position later than the base semantic-clock token.';
  END IF;

  SELECT f.live_focus_kind, f.live_focus_ref, f.live_focus_sp INTO current_live_focus_kind, current_live_focus_ref, current_live_focus_sp
    FROM public.conversation_session_current_live_focus_v1(p_session_id, p_user_id) f;
  RETURN NEXT;
END;$$;

-- ===========================================================================
-- 12. The authenticated LF read surface: delivery and catch-up ONLY.
--
--     LH stays derived from the Session Semantic Clock; LF is derived from
--     the transition history. Ownership is server-derived from `auth.uid()`;
--     a caller-supplied user id is never client authorization. Neither route
--     exposes the same-SP sequence, a label, a Home, committed text, a
--     direction, a relation count, a confidence, an importance, a K(TC)
--     projection or any historical analytical material. T-03C owns history.
--
--     `live_focus_sp` is the Session Position at which the current LF became
--     effective (NULL for NONE with no transition yet) so that the client
--     mirror can order later catch-up transitions against its snapshot; it is
--     an SP, never a timestamp and never a sequence.
-- ===========================================================================
CREATE FUNCTION public.get_session_live_state_v1(p_session_id uuid)
RETURNS TABLE(session_id uuid, live_head integer, live_focus_kind text, live_focus_ref uuid, live_focus_sp integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  caller uuid;
BEGIN
  caller := (SELECT auth.uid());
  IF caller IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT c.session_id, c.current_sp, f.live_focus_kind, f.live_focus_ref, f.live_focus_sp
      FROM public.session_semantic_clocks c
      CROSS JOIN LATERAL public.conversation_session_live_focus_before_v1(c.session_id, NULL) f
     WHERE c.session_id = p_session_id AND c.user_id = caller;
END;$$;

CREATE FUNCTION public.get_live_focus_transition_events_v1(
  p_session_id uuid,
  p_after_sp integer DEFAULT NULL,
  p_limit integer DEFAULT 64
) RETURNS TABLE(
  session_id uuid,
  session_position integer,
  to_kind text,
  to_ref uuid
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  caller uuid;
  effective_limit integer;
BEGIN
  caller := (SELECT auth.uid());
  IF caller IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF p_after_sp IS NOT NULL AND p_after_sp < 1 THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_CURSOR' USING ERRCODE='22023',
      DETAIL='A delivery cursor is an addressable Session Position >= 1; SP(0) does not exist.';
  END IF;
  effective_limit := COALESCE(p_limit, 64);
  IF effective_limit < 1 OR effective_limit > 256 THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_LIMIT' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_sessions s
                  WHERE s.id = p_session_id AND s.user_id = caller) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT t.session_id, t.session_position, t.to_kind, t.to_ref
      FROM public.conversation_live_focus_transitions t
     WHERE t.session_id = p_session_id
       AND t.user_id = caller
       AND (p_after_sp IS NULL OR t.session_position > p_after_sp)
     ORDER BY t.session_position
     LIMIT effective_limit;
END;$$;

-- ===========================================================================
-- 13. The full-semantic-chain cutover-readiness audit: a DEPLOYMENT /
--     READINESS PROOF ONLY. It fails closed if ANY committed-CU batch is not
--     COMPLETE by the ONE full-chain authority (legacy T-03A2-only, B1-only,
--     B2-only, B3-only-without-LF, or any LF corruption), if any LF transition
--     is an orphan, or if any Session's LF chain is not contiguous. It
--     backfills, repairs, deletes, mutates and declares nothing (STABLE).
--     Migration 0071 applies WITHOUT this audit passing: the audit is the
--     explicit blocker of application activation against a legacy database.
-- ===========================================================================
CREATE FUNCTION public.assert_conversation_full_semantic_chain_cutover_ready_v1()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  offending uuid;
  offending_state text;
  transition public.conversation_live_focus_transitions;
  chain_session uuid := NULL;
  chain_kind text;
  chain_ref uuid;
BEGIN
  SELECT b.id, public.conversation_full_semantic_batch_state_v1(b.session_id, b.user_id, b.source_turn_id, b.id)
    INTO offending, offending_state
    FROM public.conversation_unit_commit_batches b
   WHERE public.conversation_full_semantic_batch_state_v1(b.session_id, b.user_id, b.source_turn_id, b.id) <> 'COMPLETE'
   ORDER BY b.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'FULL_SEMANTIC_CHAIN_CUTOVER_NOT_READY' USING ERRCODE='55000',
      DETAIL=format('COMMIT_BATCH_NOT_FULL_SEMANTIC_CHAIN_COMPLETE: %s (%s)', offending, offending_state);
  END IF;
  SELECT t.event_id INTO offending FROM public.conversation_live_focus_transitions t
   WHERE NOT EXISTS (SELECT 1 FROM public.conversation_live_focus_commit_batches l WHERE l.commit_batch_id = t.commit_batch_id)
   ORDER BY t.event_id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'FULL_SEMANTIC_CHAIN_CUTOVER_NOT_READY' USING ERRCODE='55000',
      DETAIL=format('ORPHAN_LIVE_FOCUS_TRANSITION: %s', offending);
  END IF;
  -- Every Session's LF history is one contiguous chain: each transition
  -- starts exactly where the previous one ended, from NONE at the beginning.
  FOR transition IN SELECT t.* FROM public.conversation_live_focus_transitions t ORDER BY t.session_id, t.session_position, t.same_sp_event_sequence LOOP
    IF chain_session IS DISTINCT FROM transition.session_id THEN
      chain_session := transition.session_id;
      chain_kind := 'NONE';
      chain_ref := NULL;
    END IF;
    IF transition.from_kind <> chain_kind OR transition.from_ref IS DISTINCT FROM chain_ref THEN
      RAISE EXCEPTION 'FULL_SEMANTIC_CHAIN_CUTOVER_NOT_READY' USING ERRCODE='55000',
        DETAIL=format('INVALID_LIVE_FOCUS_CHAIN: %s', transition.event_id);
    END IF;
    chain_kind := transition.to_kind;
    chain_ref := transition.to_ref;
  END LOOP;
  -- R1-01: no stored departure from a Thread may coexist with that Thread
  -- staying ACTIVE / REOPENED at the same Moment under the frozen lifecycle.
  SELECT t.event_id INTO offending FROM public.conversation_live_focus_transitions t
   WHERE t.from_kind = 'THREAD' AND t.to_kind = 'NONE'
     AND public.conversation_thread_session_lifecycle_state_v1(t.from_ref, t.session_id, t.session_position + 1) IS DISTINCT FROM 'DORMANT'
   ORDER BY t.event_id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'FULL_SEMANTIC_CHAIN_CUTOVER_NOT_READY' USING ERRCODE='55000',
      DETAIL=format('LIVE_FOCUS_DEPARTURE_LIFECYCLE_CONTRADICTION: %s', offending);
  END IF;
END;$$;

-- ===========================================================================
-- 14. Ownership, search_path hardening and THE CUTOVER. This is the exact
--     point at which the complete semantic chain becomes the ONE application
--     mutation authority:
--
--       GRANT  service_role  -> the FINAL coordinator, its two reads, and the
--                               0070 dossier page the final runtime screens
--       GRANT  authenticated -> the LF snapshot and the LF catch-up reads
--       REVOKE service_role  -> the temporary T-03A2 producer and exchange
--                               coordinator (the old live writer path)
--
--     Nothing else is granted. Every predecessor integrated writer /
--     coordinator (0066, 0068, 0070) and this migration's own per-batch
--     writer stay executable by NO application role (postgres-internal calls
--     only), and the same-SP seam stays internal. There is no temporal-only
--     fallback writer: with the T-03A2 grants retired, no application path
--     can seal an SP without B1, the Thread layer and LF.
-- ===========================================================================
ALTER TABLE public.conversation_live_focus_transitions OWNER TO postgres;
ALTER TABLE public.conversation_live_focus_commit_batches OWNER TO postgres;
ALTER TABLE public.conversation_live_focus_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_live_focus_commit_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conversation_live_focus_transitions, public.conversation_live_focus_commit_batches
  FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.reject_conversation_live_focus_mutation_v1() OWNER TO postgres;
ALTER FUNCTION public.canonical_live_focus_transition_id_v1(uuid,uuid,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.conversation_session_live_focus_before_v1(uuid,integer) OWNER TO postgres;
ALTER FUNCTION public.conversation_session_current_live_focus_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.derive_conversation_effective_live_focus_v1(public.conversation_units) OWNER TO postgres;
ALTER FUNCTION public.validate_conversation_live_focus_decision_v1(public.conversation_units,jsonb) OWNER TO postgres;
ALTER FUNCTION public.persist_conversation_live_focus_transition_v1(public.conversation_units,uuid,text,uuid,text,uuid,text,bigint) OWNER TO postgres;
ALTER FUNCTION public.conversation_full_semantic_batch_state_v1(uuid,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.commit_conversation_units_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text,jsonb,text)
  OWNER TO postgres;
ALTER FUNCTION public.commit_finalized_exchange_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,integer,bigint,bigint)
  OWNER TO postgres;
ALTER FUNCTION public.get_conversation_full_semantic_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.get_conversation_full_semantic_runtime_context_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.get_session_live_state_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.get_live_focus_transition_events_v1(uuid,integer,integer) OWNER TO postgres;
ALTER FUNCTION public.assert_conversation_full_semantic_chain_cutover_ready_v1() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.reject_conversation_live_focus_mutation_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.canonical_live_focus_transition_id_v1(uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conversation_session_live_focus_before_v1(uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conversation_session_current_live_focus_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.derive_conversation_effective_live_focus_v1(public.conversation_units) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_conversation_live_focus_decision_v1(public.conversation_units,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_conversation_live_focus_transition_v1(public.conversation_units,uuid,text,uuid,text,uuid,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conversation_full_semantic_batch_state_v1(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_conversation_units_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text,jsonb,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_finalized_exchange_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,integer,bigint,bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_conversation_full_semantic_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_conversation_full_semantic_runtime_context_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_session_live_state_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_live_focus_transition_events_v1(uuid,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_conversation_full_semantic_chain_cutover_ready_v1() FROM PUBLIC, anon, authenticated;

DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.conversation_live_focus_transitions, public.conversation_live_focus_commit_batches FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_conversation_live_focus_mutation_v1() FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.canonical_live_focus_transition_id_v1(uuid,uuid,text,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.conversation_session_live_focus_before_v1(uuid,integer) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.conversation_session_current_live_focus_v1(uuid,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.derive_conversation_effective_live_focus_v1(public.conversation_units) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.validate_conversation_live_focus_decision_v1(public.conversation_units,jsonb) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.persist_conversation_live_focus_transition_v1(public.conversation_units,uuid,text,uuid,text,uuid,text,bigint) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.conversation_full_semantic_batch_state_v1(uuid,uuid,uuid,uuid) FROM service_role';
  -- The per-batch writer is reachable only through the coordinator.
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_conversation_units_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text,jsonb,text) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_session_live_state_v1(uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_live_focus_transition_events_v1(uuid,integer,integer) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.assert_conversation_full_semantic_chain_cutover_ready_v1() FROM service_role';
  -- THE CUTOVER: the FINAL chain becomes the ONE application mutation authority.
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.commit_finalized_exchange_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,integer,bigint,bigint) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_conversation_full_semantic_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_conversation_full_semantic_runtime_context_v1(uuid,uuid) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_conversation_thread_identity_dossier_page_v1(uuid,bigint,uuid,integer) TO service_role';
  -- RETIREMENT of the temporary T-03A2 mutation authority: the old live
  -- writer path can no longer seal a Session Position without the chain.
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text) FROM service_role';
END IF;END$$;

GRANT EXECUTE ON FUNCTION public.get_session_live_state_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_focus_transition_events_v1(uuid,integer,integer) TO authenticated;

-- ===========================================================================
-- 15. Terminal self-assertions. The migration refuses to deploy a chain that
--     is not the ONE mutation authority, that left the T-03A2 writer live,
--     that made a predecessor writer or the same-SP seam reachable, that
--     backfilled anything, that carries an LF label / Home / content / score
--     column, whose frozen namespace or vectors drift, or whose reads are not
--     read-only by declaration.
-- ===========================================================================
DO $$
DECLARE
  final_writer constant text := 'public.commit_conversation_units_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text,jsonb,text)';
  final_coordinator constant text := 'public.commit_finalized_exchange_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,integer,bigint,bigint)';
  final_snapshot constant text := 'public.get_conversation_full_semantic_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  final_context constant text := 'public.get_conversation_full_semantic_runtime_context_v1(uuid,uuid)';
  dossier_page constant text := 'public.get_conversation_thread_identity_dossier_page_v1(uuid,bigint,uuid,integer)';
  lf_snapshot_read constant text := 'public.get_session_live_state_v1(uuid)';
  lf_events_read constant text := 'public.get_live_focus_transition_events_v1(uuid,integer,integer)';
  lf_validator constant text := 'public.validate_conversation_live_focus_decision_v1(public.conversation_units,jsonb)';
  lf_persist constant text := 'public.persist_conversation_live_focus_transition_v1(public.conversation_units,uuid,text,uuid,text,uuid,text,bigint)';
  lf_reducer constant text := 'public.derive_conversation_effective_live_focus_v1(public.conversation_units)';
  lf_before constant text := 'public.conversation_session_live_focus_before_v1(uuid,integer)';
  lf_current constant text := 'public.conversation_session_current_live_focus_v1(uuid,uuid)';
  lf_identity constant text := 'public.canonical_live_focus_transition_id_v1(uuid,uuid,text,uuid)';
  full_batch_state constant text := 'public.conversation_full_semantic_batch_state_v1(uuid,uuid,uuid,uuid)';
  readiness_audit constant text := 'public.assert_conversation_full_semantic_chain_cutover_ready_v1()';
  lifecycle_writer constant text := 'public.commit_conversation_units_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text)';
  lifecycle_coordinator constant text := 'public.commit_finalized_exchange_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,integer,bigint,bigint)';
  lifecycle_snapshot constant text := 'public.get_conversation_thread_lifecycle_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  lifecycle_context constant text := 'public.get_conversation_thread_lifecycle_runtime_context_v1(uuid,uuid)';
  lifecycle_audit constant text := 'public.assert_conversation_thread_lifecycle_cutover_ready_v1()';
  thread_writer constant text := 'public.commit_conversation_units_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer)';
  thread_coordinator constant text := 'public.commit_finalized_exchange_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,integer,bigint)';
  thread_snapshot constant text := 'public.get_conversation_focus_thread_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  thread_context constant text := 'public.get_conversation_focus_thread_runtime_context_v1(uuid,uuid)';
  focus_writer constant text := 'public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)';
  focus_coordinator constant text := 'public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)';
  focus_snapshot constant text := 'public.get_conversation_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  focus_context constant text := 'public.get_conversation_focus_runtime_context_v1(uuid,uuid)';
  same_sp_helper constant text := 'public.reserve_session_same_sp_event_v1(uuid,uuid)';
  legacy_producer constant text := 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
  legacy_coordinator constant text := 'public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)';
  legacy_snapshot constant text := 'public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  temporal_state constant text := 'public.get_session_temporal_state_v1(uuid)';
  delivery_events constant text := 'public.get_conversational_units_committed_events_v1(uuid,integer,integer)';
  rfc4122_url_namespace constant uuid := '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
  lf_tables constant text[] := ARRAY['public.conversation_live_focus_transitions', 'public.conversation_live_focus_commit_batches'];
  lf_functions constant text[] := ARRAY[final_writer, final_coordinator, final_snapshot, final_context, lf_snapshot_read, lf_events_read,
    lf_validator, lf_persist, lf_reducer, lf_before, lf_current, lf_identity, full_batch_state, readiness_audit];
  read_only_functions constant text[] := ARRAY[final_snapshot, final_context, lf_validator, lf_reducer, lf_before, lf_current, full_batch_state, readiness_audit];
  service_role_executable constant text[] := ARRAY[final_coordinator, final_snapshot, final_context, dossier_page, legacy_snapshot];
  service_role_forbidden constant text[] := ARRAY[final_writer, lf_validator, lf_persist, lf_reducer, lf_before, lf_current, lf_identity, full_batch_state,
    readiness_audit, lf_snapshot_read, lf_events_read, lifecycle_writer, lifecycle_coordinator, lifecycle_snapshot, lifecycle_context, lifecycle_audit,
    thread_writer, thread_coordinator, thread_snapshot, thread_context, focus_writer, focus_coordinator, focus_snapshot, focus_context,
    same_sp_helper, legacy_producer, legacy_coordinator, temporal_state, delivery_events];
  authenticated_executable constant text[] := ARRAY[lf_snapshot_read, lf_events_read, temporal_state, delivery_events];
  target_role text;
  target_table text;
  target_privilege text;
  target_function text;
  function_row pg_proc;
  row_total bigint;
  mutation_grants integer;
BEGIN
  -- Nothing was backfilled; every new table is append-only for the owner too.
  FOREACH target_table IN ARRAY lf_tables LOOP
    EXECUTE format('SELECT count(*) FROM %s', target_table) INTO STRICT row_total;
    IF row_total <> 0 THEN
      RAISE EXCEPTION 'T-03D creates a forward-only substrate and backfills nothing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                    WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal
                      AND t.tgfoid = 'public.reject_conversation_live_focus_mutation_v1'::regproc) THEN
      RAISE EXCEPTION 'every T-03D table must be append-only: % lacks its trigger', target_table;
    END IF;
  END LOOP;

  -- The LF domain is exactly three kinds; nothing graded, named, spatial,
  -- textual, historical or projected can live beside it.
  IF EXISTS (SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public'
                AND c.table_name IN ('conversation_live_focus_transitions', 'conversation_live_focus_commit_batches')
                AND c.column_name ~* 'label|name|title|home|placement|coordinate|direction|content|text|payload|score|confidence|importance|rank|weight|centrality|priority|viewport|camera|inspection|timeline|projection|knowledge|version_frontier|pre_first_sp|historical|locat|render|analysis|reading') THEN
    RAISE EXCEPTION 'T-03D introduces no LF label / Home / content / score / projection column';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public' AND c.table_name = 'conversation_live_focus_commit_batches'
                AND c.column_name ~* 'session_position|same_sp_event_sequence|(^|_)sp($|_)') THEN
    RAISE EXCEPTION 'the technical LF capture is not a Timeline object: it carries no SP and no same-SP sequence';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = 'public.conversation_live_focus_transitions'::regclass
                  AND k.contype = 'u' AND k.conname = 'live_focus_transitions_one_per_cu')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = 'public.conversation_live_focus_transitions'::regclass
                  AND k.contype = 'u' AND k.conname = 'live_focus_transitions_one_per_sp')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = 'public.conversation_live_focus_transitions'::regclass
                  AND k.contype = 'c' AND k.conname = 'live_focus_transitions_change_check') THEN
    RAISE EXCEPTION 'T-03D requires at most one LF transition per CU and per SP, never from == to';
  END IF;

  -- Function identity, security posture, search path and read-only declarations.
  FOREACH target_function IN ARRAY lf_functions LOOP
    SELECT * INTO function_row FROM pg_proc WHERE oid = to_regprocedure(target_function);
    IF NOT FOUND THEN RAISE EXCEPTION 'a T-03D function is missing: %', target_function; END IF;
    IF pg_get_userbyid(function_row.proowner) <> 'postgres' OR NOT function_row.prosecdef
       OR NOT EXISTS (SELECT 1 FROM unnest(function_row.proconfig) AS entry(setting)
                       WHERE entry.setting LIKE 'search_path=%') THEN
      RAISE EXCEPTION 'T-03D functions must stay postgres-owned, SECURITY DEFINER and search_path-fixed: %', target_function;
    END IF;
  END LOOP;
  FOREACH target_function IN ARRAY read_only_functions LOOP
    SELECT * INTO function_row FROM pg_proc WHERE oid = to_regprocedure(target_function);
    IF function_row.provolatile <> 's' THEN
      RAISE EXCEPTION 'T-03D reads, derivations and the audit must be STABLE, never writers: %', target_function;
    END IF;
  END LOOP;
  IF to_regprocedure(lifecycle_writer) IS NULL OR to_regprocedure(lifecycle_coordinator) IS NULL OR to_regprocedure(lifecycle_snapshot) IS NULL
     OR to_regprocedure(lifecycle_context) IS NULL OR to_regprocedure(thread_writer) IS NULL OR to_regprocedure(focus_writer) IS NULL
     OR to_regprocedure(legacy_producer) IS NULL OR to_regprocedure(legacy_coordinator) IS NULL OR to_regprocedure(same_sp_helper) IS NULL THEN
    RAISE EXCEPTION 'the 0065 / 0066 / 0068 / 0070 substrate must remain deployed, byte-identical, and callable from inside this chain';
  END IF;
  -- The final chain REUSES every predecessor authority; nothing is duplicated.
  IF position('conversation_thread_semantic_batch_state_v1' IN pg_get_functiondef(to_regprocedure(full_batch_state))) = 0
     OR position('get_conversation_thread_lifecycle_runtime_context_v1' IN pg_get_functiondef(to_regprocedure(final_context))) = 0
     OR position('get_conversation_thread_lifecycle_integrated_batch_snapshot_v1' IN pg_get_functiondef(to_regprocedure(final_snapshot))) = 0
     OR position('conversation_full_semantic_batch_state_v1' IN pg_get_functiondef(to_regprocedure(readiness_audit))) = 0
     OR position('conversation_full_semantic_batch_state_v1' IN pg_get_functiondef(to_regprocedure(final_writer))) = 0
     OR position('conversation_full_semantic_batch_state_v1' IN pg_get_functiondef(to_regprocedure(final_coordinator))) = 0
     OR position('commit_conversation_units_with_focus_thread_lifecycle_v1' IN pg_get_functiondef(to_regprocedure(final_writer))) = 0
     OR position('persist_conversation_thread_lifecycle_layer_v1' IN pg_get_functiondef(to_regprocedure(final_writer))) = 0
     OR position('validate_conversation_thread_lifecycle_decision_v1' IN pg_get_functiondef(to_regprocedure(final_writer))) = 0
     OR position('persist_conversation_unit_focus_semantics_v1' IN pg_get_functiondef(to_regprocedure(final_writer))) = 0 THEN
    RAISE EXCEPTION 'T-03D must reuse the 0066 / 0068 / 0070 authorities and the 0070 reads, never duplicate them';
  END IF;

  -- THE ONE MUTATION AUTHORITY: after the cutover, service_role executes
  -- exactly the final coordinator among every committing function.
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
      IF target_role = 'service_role' THEN
        FOREACH target_function IN ARRAY service_role_executable LOOP
          IF NOT has_function_privilege(target_role, target_function, 'EXECUTE') THEN
            RAISE EXCEPTION 'the T-03D cutover requires service_role EXECUTE on %', target_function;
          END IF;
        END LOOP;
        FOREACH target_function IN ARRAY service_role_forbidden LOOP
          IF has_function_privilege(target_role, target_function, 'EXECUTE') THEN
            RAISE EXCEPTION 'after the T-03D cutover service_role must not execute %', target_function;
          END IF;
        END LOOP;
        SELECT count(*) INTO mutation_grants FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname LIKE 'commit\_%'
           AND has_function_privilege('service_role', p.oid, 'EXECUTE');
        IF mutation_grants <> 1 THEN
          RAISE EXCEPTION 'exactly ONE committing function is executable by service_role after T-03D; found %', mutation_grants;
        END IF;
      ELSE
        FOREACH target_function IN ARRAY lf_functions || ARRAY[dossier_page, lifecycle_writer, lifecycle_coordinator, thread_writer, thread_coordinator,
                                               focus_writer, focus_coordinator, same_sp_helper, legacy_producer, legacy_coordinator, legacy_snapshot] LOOP
          IF has_function_privilege(target_role, target_function, 'EXECUTE')
             AND NOT (target_role = 'authenticated' AND target_function = ANY (authenticated_executable)) THEN
            RAISE EXCEPTION '% must not execute %', target_role, target_function;
          END IF;
        END LOOP;
        IF target_role = 'authenticated' THEN
          FOREACH target_function IN ARRAY authenticated_executable LOOP
            IF NOT has_function_privilege(target_role, target_function, 'EXECUTE') THEN
              RAISE EXCEPTION 'the owner-scoped LF delivery read % must be executable by authenticated', target_function;
            END IF;
          END LOOP;
        END IF;
      END IF;
      FOREACH target_table IN ARRAY lf_tables LOOP
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'the LF substrate must stay unreachable: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  -- The frozen namespace literal re-derives from its documented URI, and the
  -- pinned identity vectors reproduce.
  IF public.canonical_uuid_v5_v1(rfc4122_url_namespace, 'https://qandeel.app/runtime/live-focus-transition/v1')
       <> '14cd67f4-be9d-54f6-b735-cbe38a7cb311'::uuid THEN
    RAISE EXCEPTION 'T-03D requires the exact RFC 4122 version-5 derivation of its frozen namespace';
  END IF;
  IF public.canonical_live_focus_transition_id_v1('33333333-3333-4333-8333-333333333333'::uuid, '11111111-2222-4333-8444-555555555555'::uuid, 'NONE', NULL)
       <> '31ae1e67-d4f8-541a-8188-f9db29f6cc20'::uuid
     OR public.canonical_live_focus_transition_id_v1('33333333-3333-4333-8333-333333333333'::uuid, '11111111-2222-4333-8444-555555555555'::uuid, 'EMERGING', '4ef8538d-ddda-5e11-b7d9-052be85de59a'::uuid)
       <> 'ebf823d1-1081-5ae2-94ac-aa69b9d62ccc'::uuid
     OR public.canonical_live_focus_transition_id_v1('33333333-3333-4333-8333-333333333333'::uuid, '11111111-2222-4333-8444-555555555555'::uuid, 'THREAD', 'afc4fd81-fe54-5738-9545-e1053044d919'::uuid)
       <> '12ac4f9b-1865-5bfd-8c5e-cebb1e178b98'::uuid THEN
    RAISE EXCEPTION 'T-03D requires the frozen LF transition identity vectors';
  END IF;

  -- The clock itself is unchanged: still exactly SP and the internal sequence.
  IF (SELECT array_agg(c.column_name::text ORDER BY c.column_name) FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = 'session_semantic_clocks')
     <> ARRAY['current_sp','same_sp_event_sequence','session_id','user_id'] THEN
    RAISE EXCEPTION 'T-03D must not alter the Session Semantic Clock';
  END IF;
END$$;

COMMIT;
