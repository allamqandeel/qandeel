-- T-03B1b2 - Focus Runtime Orchestration + Activation Readiness v1:
-- readiness / read substrate ONLY, NO cutover.
--
-- Architecture Correction AC-B1B2-01. The frozen Stage-6 same-SP order is
--
--   CU / SP -> reference + focus -> Emerging Focus continuity [T-03B1]
--           -> optional Thread establishment [T-03B2] -> effective LF [T-03D]
--
-- and a sealed SP may never be reopened or backdated. Making the B1-only
-- writer live now would seal every new Moment before T-03B2 / T-03D could
-- write their same-SP facts truthfully. So this migration ADDS two read /
-- audit functions and CHANGES NO AUTHORITY:
--
--   GRANT no new integrated function to service_role
--   REVOKE no existing T-03A2 service-role authority
--   write / backfill no semantic row
--   change no Session clock row
--   change no committed CU
--
-- The live T-03A2 path stays exactly live. T-03D owns the final semantic-chain
-- authority cutover; T-03C owns historical-enabled Session coverage. Neither
-- readiness nor completeness here is Product state, a knowledge horizon, KF,
-- PRE_FIRST_SP, Timeline eligibility or partial-history exposure.
--
-- 0064 / 0065 / 0066 remain byte-identical.

BEGIN;

-- 0. Preconditions: the frozen UTF-8 contract, and the T-03A2 / T-03B1b1
--    objects this migration reads.
DO $$BEGIN
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'T-03B1b2 requires a UTF8 server encoding; found %', current_setting('server_encoding')
      USING ERRCODE='0A000';
  END IF;
  IF to_regprocedure('public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)') IS NULL
     OR to_regclass('public.conversation_focus_commit_batches') IS NULL
     OR to_regclass('public.conversation_unit_focus_semantics') IS NULL
     OR to_regclass('public.conversation_emerging_focus_attention_events') IS NULL THEN
    RAISE EXCEPTION 'T-03B1b2 requires the T-03A2 snapshot read and the T-03B1b1 durable substrate'
      USING ERRCODE='55000';
  END IF;
END$$;

-- 1. The integrated batch snapshot: the T-03A2 commitment snapshot (owner /
--    Session / source-turn validated, replay and source-frontier semantics
--    preserved by delegation) plus TECHNICAL B1 completeness metadata, so the
--    runtime knows BEFORE any provider call whether an exchange is already
--    canonical and B1-complete, partially integrated, or legacy.
--
--    `focus_complete` is true only when the semantic batch exists with the
--    committed unit count and, for a non-zero batch, exactly one agreeing CU
--    semantic row and one agreeing attention row exist for every committed
--    CU. A committed zero-CU batch is complete only when its zero-unit
--    semantic batch row exists. Malformed partial state is returned as an
--    explicit incomplete state - never as `batch_exists = false`. No timestamp
--    participates. Executable by NO application role in this task.
CREATE FUNCTION public.get_conversation_integrated_batch_snapshot_v1(
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
  focus_complete boolean
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  focus_row public.conversation_focus_commit_batches;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;

  -- The T-03A2 read is the authority for the commitment half: ownership,
  -- Session, source turn, stored units, delivery event, source frontier, LH.
  SELECT s.batch_exists, s.committed_unit_count, s.units, s.event, s.source_frontier, s.live_head
    INTO batch_exists, committed_unit_count, units, commit_event, source_frontier, live_head
    FROM public.get_conversation_unit_commit_batch_snapshot_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id) s;

  focus_batch_exists := false;
  focus_semantic_count := 0;
  focus_attention_count := 0;
  focus_complete := false;

  IF batch_exists THEN
    SELECT * INTO focus_row FROM public.conversation_focus_commit_batches f WHERE f.commit_batch_id = p_batch_id;
    IF FOUND THEN
      IF focus_row.user_id <> p_user_id OR focus_row.session_id <> p_session_id OR focus_row.source_turn_id <> p_source_turn_id THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
      END IF;
      focus_batch_exists := true;
      -- Only rows that AGREE with their committed CU count: a bundle whose
      -- SP, Session, owner or batch disagrees is incomplete technical history.
      SELECT count(*) INTO focus_semantic_count
        FROM public.conversation_unit_focus_semantics s
        JOIN public.conversation_units cu ON cu.id = s.cu_id
       WHERE cu.commit_batch_id = p_batch_id
         AND s.focus_commit_batch_id = p_batch_id
         AND s.session_id = cu.session_id AND s.user_id = cu.user_id
         AND s.session_position = cu.session_position;
      SELECT count(*) INTO focus_attention_count
        FROM public.conversation_emerging_focus_attention_events e
        JOIN public.conversation_units cu ON cu.id = e.cu_id
       WHERE cu.commit_batch_id = p_batch_id
         AND e.session_id = cu.session_id AND e.user_id = cu.user_id
         AND e.session_position = cu.session_position;
      focus_complete := focus_row.unit_count = committed_unit_count
                        AND focus_semantic_count = committed_unit_count
                        AND focus_attention_count = committed_unit_count;
    END IF;
  END IF;
  RETURN NEXT;
END;$$;

-- 2. The activation-readiness audit. A DEPLOYMENT / READINESS PROOF ONLY:
--    it fails closed if ANY existing committed-CU batch is not B1-complete,
--    and it backfills, deletes, mutates and declares nothing. It is STABLE, so
--    the database itself refuses any write from inside it. A clean empty
--    database passes; a database holding only fully integrated B1 batches
--    passes; any legacy T-03A2-only batch, and any partial semantic history,
--    fails with FOCUS_CAPTURE_CUTOVER_NOT_READY. That blocker is reported,
--    never solved here (R-B1B2-02: no guessed, timestamp or migration-time
--    backfill, no deletion / rewrite workaround).
CREATE FUNCTION public.assert_conversation_focus_capture_cutover_ready_v1()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  offending uuid;
BEGIN
  -- commit batch exists + no focus batch (including a zero-CU commitment
  -- without its zero-unit focus batch)
  SELECT b.id INTO offending
    FROM public.conversation_unit_commit_batches b
    LEFT JOIN public.conversation_focus_commit_batches f ON f.commit_batch_id = b.id
   WHERE f.commit_batch_id IS NULL
   ORDER BY b.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'FOCUS_CAPTURE_CUTOVER_NOT_READY' USING ERRCODE='55000',
      DETAIL=format('COMMIT_BATCH_WITHOUT_FOCUS_BATCH: %s', offending);
  END IF;

  -- focus batch unit_count mismatch
  SELECT b.id INTO offending
    FROM public.conversation_unit_commit_batches b
    JOIN public.conversation_focus_commit_batches f ON f.commit_batch_id = b.id
   WHERE f.unit_count <> b.unit_count
      OR f.session_id <> b.session_id OR f.user_id <> b.user_id OR f.source_turn_id <> b.source_turn_id
   ORDER BY b.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'FOCUS_CAPTURE_CUTOVER_NOT_READY' USING ERRCODE='55000',
      DETAIL=format('FOCUS_BATCH_UNIT_COUNT_MISMATCH: %s', offending);
  END IF;

  -- nonzero committed CU without CU focus semantics
  SELECT cu.id INTO offending
    FROM public.conversation_units cu
    LEFT JOIN public.conversation_unit_focus_semantics s ON s.cu_id = cu.id
   WHERE s.cu_id IS NULL
   ORDER BY cu.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'FOCUS_CAPTURE_CUTOVER_NOT_READY' USING ERRCODE='55000',
      DETAIL=format('COMMITTED_CU_WITHOUT_FOCUS_SEMANTICS: %s', offending);
  END IF;

  -- nonzero committed CU without attention row
  SELECT cu.id INTO offending
    FROM public.conversation_units cu
    LEFT JOIN public.conversation_emerging_focus_attention_events e ON e.cu_id = cu.id
   WHERE e.cu_id IS NULL
   ORDER BY cu.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'FOCUS_CAPTURE_CUTOVER_NOT_READY' USING ERRCODE='55000',
      DETAIL=format('COMMITTED_CU_WITHOUT_ATTENTION_HISTORY: %s', offending);
  END IF;

  -- semantic or attention row whose SP / Session / owner / batch disagrees with its CU
  SELECT cu.id INTO offending
    FROM public.conversation_units cu
    JOIN public.conversation_unit_focus_semantics s ON s.cu_id = cu.id
   WHERE s.session_position <> cu.session_position OR s.session_id <> cu.session_id
      OR s.user_id <> cu.user_id OR s.focus_commit_batch_id <> cu.commit_batch_id
   ORDER BY cu.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'FOCUS_CAPTURE_CUTOVER_NOT_READY' USING ERRCODE='55000',
      DETAIL=format('FOCUS_SEMANTICS_DISAGREE_WITH_CU: %s', offending);
  END IF;
  SELECT cu.id INTO offending
    FROM public.conversation_units cu
    JOIN public.conversation_emerging_focus_attention_events e ON e.cu_id = cu.id
   WHERE e.session_position <> cu.session_position OR e.session_id <> cu.session_id OR e.user_id <> cu.user_id
   ORDER BY cu.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'FOCUS_CAPTURE_CUTOVER_NOT_READY' USING ERRCODE='55000',
      DETAIL=format('ATTENTION_HISTORY_DISAGREES_WITH_CU: %s', offending);
  END IF;
END;$$;

-- 3. Ownership, search_path hardening and the unchanged authority posture.
--    Nothing new is granted; nothing existing is revoked or re-granted.
ALTER FUNCTION public.get_conversation_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.assert_conversation_focus_capture_cutover_ready_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_conversation_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_conversation_focus_capture_cutover_ready_v1() FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  -- PRODUCTION-INERT: neither read is executable by any application role in
  -- this task; the runtime that will call them is wired only at the final
  -- semantic-chain cutover (T-03D).
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_conversation_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.assert_conversation_focus_capture_cutover_ready_v1() FROM service_role';
END IF;END$$;

-- 4. Terminal self-assertions: the readiness substrate is unreachable, the
--    T-03B1b1 substrate stays unreachable, the T-03A2 activation stays exactly
--    in place, the same-SP seam stays internal, the audit is read-only by
--    declaration, and no Product-state column appeared.
DO $$
DECLARE
  integrated_snapshot constant text := 'public.get_conversation_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  readiness_audit constant text := 'public.assert_conversation_focus_capture_cutover_ready_v1()';
  focus_writer constant text := 'public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)';
  focus_coordinator constant text := 'public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)';
  focus_context constant text := 'public.get_conversation_focus_runtime_context_v1(uuid,uuid)';
  same_sp_helper constant text := 'public.reserve_session_same_sp_event_v1(uuid,uuid)';
  legacy_producer constant text := 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
  legacy_coordinator constant text := 'public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)';
  legacy_snapshot constant text := 'public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  target_role text;
  target_function text;
  function_row pg_proc;
BEGIN
  FOREACH target_function IN ARRAY ARRAY[integrated_snapshot, readiness_audit] LOOP
    SELECT * INTO function_row FROM pg_proc WHERE oid = to_regprocedure(target_function);
    IF NOT FOUND THEN RAISE EXCEPTION 'a T-03B1b2 function is missing: %', target_function; END IF;
    IF pg_get_userbyid(function_row.proowner) <> 'postgres' OR NOT function_row.prosecdef
       OR NOT EXISTS (SELECT 1 FROM unnest(function_row.proconfig) AS entry(setting)
                       WHERE entry.setting LIKE 'search_path=%') THEN
      RAISE EXCEPTION 'T-03B1b2 functions must stay postgres-owned, SECURITY DEFINER and search_path-fixed: %', target_function;
    END IF;
  END LOOP;
  SELECT * INTO function_row FROM pg_proc WHERE oid = to_regprocedure(readiness_audit);
  IF function_row.provolatile <> 's' THEN
    RAISE EXCEPTION 'the cutover-readiness audit must be STABLE: it is a proof, never a writer';
  END IF;

  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
      FOREACH target_function IN ARRAY ARRAY[integrated_snapshot, readiness_audit, focus_writer, focus_coordinator, focus_context, same_sp_helper] LOOP
        IF has_function_privilege(target_role, target_function, 'EXECUTE') THEN
          RAISE EXCEPTION 'T-03B1b2 performs no cutover: % must not execute %', target_role, target_function;
        END IF;
      END LOOP;
      IF target_role = 'service_role' THEN
        IF NOT has_function_privilege(target_role, legacy_producer, 'EXECUTE')
           OR NOT has_function_privilege(target_role, legacy_coordinator, 'EXECUTE')
           OR NOT has_function_privilege(target_role, legacy_snapshot, 'EXECUTE') THEN
          RAISE EXCEPTION 'T-03B1b2 must leave the live T-03A2 service_role grants exactly in place';
        END IF;
      ELSIF has_function_privilege(target_role, legacy_producer, 'EXECUTE')
         OR has_function_privilege(target_role, legacy_coordinator, 'EXECUTE') THEN
        RAISE EXCEPTION 'the canonical producer must never be executable by %', target_role;
      END IF;
    END IF;
  END LOOP;

  -- Readiness is technical only: no Product-state column anywhere.
  IF EXISTS (SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public'
                AND c.column_name ~* 'focus_enabled|analysis_enabled|semantic_version|historical_ready|cutover_ready|focus_ready') THEN
    RAISE EXCEPTION 'activation readiness must never become Product or historical eligibility state';
  END IF;
END$$;

COMMIT;
