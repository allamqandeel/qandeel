-- T-03B2b3 - Thread Runtime Orchestration + Integration Readiness v1:
-- READ / AUDIT substrate ONLY, NO cutover.
--
-- Architecture Correction AC-B2B3-01. The frozen Stage-6 same-SP order is
--
--   CU / SP -> reference + focus -> Emerging Focus continuity      [T-03B1]
--           -> optional Thread establishment + permanent Home      [T-03B2]
--           -> effective LF                                        [T-03D]
--
-- and a sealed SP may never be reopened or backdated. Making the integrated
-- B1+B2 writer live now would seal every new Moment before T-03D could write
-- effective LF truthfully inside the SAME per-Moment transaction. So this
-- migration ADDS three read / audit functions and CHANGES NO AUTHORITY:
--
--   GRANT no integrated writer, coordinator or context to any application role
--   REVOKE no existing T-03A2 service-role authority
--   write / backfill / repair no semantic row
--   allocate no SP, advance no LH, reserve no same-SP sequence
--   declare no historical-enabled state and no activation / cutover flag
--
-- The live T-03A2 path stays exactly live. T-03D owns the final semantic-chain
-- authority cutover; T-03C owns historical-enabled Session coverage. Neither
-- readiness nor completeness here is Product state, a knowledge horizon, KF,
-- PRE_FIRST_SP, Timeline eligibility or partial-history exposure.
--
-- ED-B2B3-01: the ONE structural B2 completeness authority stays migration
-- 0068's `conversation_thread_batch_state_v1`. It is REUSED here, never
-- duplicated and never re-implemented, so the runtime gate, the writer replay
-- gate and this readiness audit can never disagree about "complete".
--
-- 0064 / 0065 / 0066 / 0067 / 0068 remain byte-identical.

BEGIN;

-- ===========================================================================
-- 0. Preconditions: the frozen UTF-8 contract, and the T-03A2 / T-03B1 /
--    T-03B2b2 objects this migration reads.
-- ===========================================================================
DO $$BEGIN
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'T-03B2b3 requires a UTF8 server encoding; found %', current_setting('server_encoding')
      USING ERRCODE='0A000';
  END IF;
  IF to_regprocedure('public.get_conversation_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.get_conversation_focus_runtime_context_v1(uuid,uuid)') IS NULL
     OR to_regprocedure('public.conversation_thread_batch_state_v1(uuid,uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.commit_finalized_exchange_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,integer,bigint)') IS NULL
     OR to_regclass('public.conversation_thread_commit_batches') IS NULL
     OR to_regclass('public.conversation_threads') IS NULL THEN
    RAISE EXCEPTION 'T-03B2b3 requires the T-03B1b2 read substrate and the T-03B2b2 durable Thread substrate'
      USING ERRCODE='55000';
  END IF;
END$$;

-- ===========================================================================
-- 1. The integrated B1+B2 batch snapshot.
--
--    The T-03B1b2 integrated read is the authority for the commitment half and
--    the B1 half (ownership, Session, source turn, stored units, delivery
--    event, source frontier, LH, B1 completeness), preserved by delegation.
--    The B2 half is the single 0068 structural authority, plus the technical
--    capture-batch counters:
--
--      ABSENT    every layer absent - the only state a NEW exchange may
--                start from
--      COMPLETE  commitment + B1 capture + B2 capture structurally whole
--      PARTIAL   anything else: a legacy T-03A2-only batch, a B1-only batch,
--                a missing / extra durable establishment, corrupted evidence,
--                corrupted origin provenance, or Thread / Home / event
--                incoherence
--
--    A zero-CU batch is supported and can be COMPLETE. Malformed partial
--    state is returned as an explicit PARTIAL - never as `batch_exists =
--    false` and never repaired. No timestamp participates. Executable by NO
--    application role in this task.
-- ===========================================================================
CREATE FUNCTION public.get_conversation_focus_thread_integrated_batch_snapshot_v1(
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
  thread_establishment_count integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  thread_row public.conversation_thread_commit_batches;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;

  -- The T-03B1b2 read is the authority for the commitment and B1 halves.
  SELECT s.batch_exists, s.committed_unit_count, s.units, s.commit_event, s.source_frontier, s.live_head,
         s.focus_batch_exists, s.focus_semantic_count, s.focus_attention_count, s.focus_complete
    INTO batch_exists, committed_unit_count, units, commit_event, source_frontier, live_head,
         focus_batch_exists, focus_semantic_count, focus_attention_count, focus_complete
    FROM public.get_conversation_integrated_batch_snapshot_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id) s;

  -- The B2 half: ONE authority, reused, never re-implemented here.
  thread_capture_state := public.conversation_thread_batch_state_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id);

  thread_batch_exists := false;
  thread_unit_count := 0;
  thread_establishment_count := 0;
  SELECT * INTO thread_row FROM public.conversation_thread_commit_batches t WHERE t.commit_batch_id = p_batch_id;
  IF FOUND THEN
    IF thread_row.user_id <> p_user_id OR thread_row.session_id <> p_session_id OR thread_row.source_turn_id <> p_source_turn_id THEN
      RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
    END IF;
    thread_batch_exists := true;
    thread_unit_count := thread_row.unit_count;
    thread_establishment_count := thread_row.establishment_count;
  END IF;
  RETURN NEXT;
END;$$;

-- ===========================================================================
-- 2. The combined B1+B2 runtime context: ONE authoritative prior context read
--    against ONE exact semantic-clock token.
--
--    The T-03B1b1 context read is the authority for the token, the prior CUs,
--    the reference handles, the Emerging Focus candidates and the current
--    focus candidate, preserved by delegation. This function ADDS exactly what
--    the T-03B2a evaluator and the deterministic Conversational-Origin mapping
--    legitimately need:
--
--      prior_focus_semantics       one COMPLETE canonical B1 semantic bundle
--                                  per prior committed CU, ordered by SP
--      focus_attention_history     one append-preserved attention item per
--                                  prior committed CU, ordered by SP
--      established_thread_bindings canonical Thread truth already established
--                                  BEFORE the returned token, in this Session
--
--    It FAILS CLOSED - it never filters, cleans or skips malformed prior
--    history. A committed prior CU without its canonical B1 bundle, without
--    its attention item, or inside a commitment batch whose B2 capture is not
--    COMPLETE by the 0068 authority, is an integrity failure of this runtime
--    path, not "unknown history".
--
--    There is deliberately NO cross-session Thread sameness / reopening
--    inference, NO label or similarity matching, NO Home coordinate, NO
--    lifecycle and NO LF here.
-- ===========================================================================
CREATE FUNCTION public.get_conversation_focus_thread_runtime_context_v1(
  p_session_id uuid,
  p_user_id uuid
) RETURNS TABLE(
  base_current_sp integer,
  base_same_sp_event_sequence bigint,
  prior_cus jsonb,
  reference_handles jsonb,
  focus_candidates jsonb,
  current_focus_candidate_id uuid,
  prior_focus_semantics jsonb,
  focus_attention_history jsonb,
  established_thread_bindings jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed_cu_count integer;
  semantic_bundle_count integer;
  attention_item_count integer;
  offending uuid;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;

  -- The T-03B1b1 read is the authority for the token and the B1 prior context.
  SELECT c.base_current_sp, c.base_same_sp_event_sequence, c.prior_cus, c.reference_handles,
         c.focus_candidates, c.current_focus_candidate_id
    INTO base_current_sp, base_same_sp_event_sequence, prior_cus, reference_handles,
         focus_candidates, current_focus_candidate_id
    FROM public.get_conversation_focus_runtime_context_v1(p_session_id, p_user_id) c;

  -- Fail closed on incomplete prior capture BEFORE returning any context. A
  -- prior committed CU is usable by this runtime path only when its canonical
  -- B1 bundle and attention item exist and its whole commitment batch is
  -- structurally COMPLETE at all three layers by the ONE 0068 authority.
  SELECT count(*) INTO committed_cu_count
    FROM public.conversation_units cu WHERE cu.session_id = p_session_id AND cu.user_id = p_user_id;
  SELECT count(*) INTO semantic_bundle_count
    FROM public.conversation_units cu
    JOIN public.conversation_unit_focus_semantics s ON s.cu_id = cu.id
   WHERE cu.session_id = p_session_id AND cu.user_id = p_user_id
     AND s.session_id = cu.session_id AND s.user_id = cu.user_id AND s.session_position = cu.session_position;
  SELECT count(*) INTO attention_item_count
    FROM public.conversation_units cu
    JOIN public.conversation_emerging_focus_attention_events e ON e.cu_id = cu.id
   WHERE cu.session_id = p_session_id AND cu.user_id = p_user_id
     AND e.session_id = cu.session_id AND e.user_id = cu.user_id AND e.session_position = cu.session_position;
  IF semantic_bundle_count <> committed_cu_count OR attention_item_count <> committed_cu_count THEN
    RAISE EXCEPTION 'INCOMPLETE_PRIOR_THREAD_HISTORY' USING ERRCODE='55000',
      DETAIL='A committed prior CU without its canonical B1 semantic bundle or attention item is incomplete technical history; it is never cleaned, skipped or evaluated as unknown.';
  END IF;
  SELECT b.id INTO offending
    FROM public.conversation_unit_commit_batches b
   WHERE b.session_id = p_session_id AND b.user_id = p_user_id
     AND public.conversation_thread_batch_state_v1(b.session_id, b.user_id, b.source_turn_id, b.id) <> 'COMPLETE'
   ORDER BY b.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'INCOMPLETE_PRIOR_THREAD_HISTORY' USING ERRCODE='55000',
      DETAIL=format('PRIOR_BATCH_NOT_B2_COMPLETE: %s', offending);
  END IF;

  -- One COMPLETE canonical B1 semantic bundle per prior committed CU, in SP
  -- order. `creates_handle` and `creates_focus` are DERIVED from the durable
  -- first-grounding / started-CU columns, never stored twice.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'unit_id', cu.id,
           'functions', to_jsonb(s.functions),
           'sequence_position', s.sequence_position,
           'target_cu_id', s.target_cu_id,
           'references', (
             SELECT COALESCE(jsonb_agg(jsonb_build_object(
                      'reference_index', r.reference_index,
                      'anchor_text', r.anchor_text,
                      'anchor_occurrence', r.anchor_occurrence,
                      'span_start', r.span_start,
                      'span_end', r.span_end,
                      'state', r.state,
                      'resolved_handle_id', r.resolved_handle_id,
                      'creates_handle', (r.resolved_handle_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM public.conversation_reference_handles h
                         WHERE h.id = r.resolved_handle_id AND h.first_cu_id = r.cu_id)),
                      'candidate_handle_ids', (
                        SELECT COALESCE(jsonb_agg(to_jsonb(k.handle_id) ORDER BY k.handle_id::text COLLATE "C"), '[]'::jsonb)
                          FROM public.conversation_reference_resolution_candidates k
                         WHERE k.cu_id = r.cu_id AND k.reference_index = r.reference_index))
                      ORDER BY r.reference_index), '[]'::jsonb)
               FROM public.conversation_reference_resolutions r WHERE r.cu_id = cu.id),
           'claim_attributions', (
             SELECT COALESCE(jsonb_agg(jsonb_build_object(
                      'attribution_index', a.attribution_index,
                      'anchor_text', a.anchor_text,
                      'anchor_occurrence', a.anchor_occurrence,
                      'span_start', a.span_start,
                      'span_end', a.span_end,
                      'claimant_kind', a.claimant_kind,
                      'claimant_handle_id', a.claimant_handle_id,
                      'claim_frame', a.claim_frame)
                      ORDER BY a.attribution_index), '[]'::jsonb)
               FROM public.conversation_claim_attributions a WHERE a.cu_id = cu.id),
           'attention', jsonb_build_object(
             'kind', e.attention_kind,
             'reason', e.attention_reason,
             'emerging_focus_id', e.emerging_focus_id,
             'creates_focus', (e.emerging_focus_id IS NOT NULL AND EXISTS (
               SELECT 1 FROM public.conversation_emerging_focuses f
                WHERE f.id = e.emerging_focus_id AND f.started_cu_id = e.cu_id)),
             'grounding_reference_index', e.grounding_reference_index))
           ORDER BY cu.session_position), '[]'::jsonb)
    INTO prior_focus_semantics
    FROM public.conversation_units cu
    JOIN public.conversation_unit_focus_semantics s ON s.cu_id = cu.id
    JOIN public.conversation_emerging_focus_attention_events e ON e.cu_id = cu.id
   WHERE cu.session_id = p_session_id AND cu.user_id = p_user_id;

  -- One append-preserved attention item per prior committed CU, in SP order:
  -- exactly the T-03B2a `ThreadEstablishmentPriorContext` history shape.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'cu_id', e.cu_id,
           'attention_kind', e.attention_kind,
           'attention_reason', e.attention_reason,
           'emerging_focus_id', e.emerging_focus_id)
           ORDER BY e.session_position), '[]'::jsonb)
    INTO focus_attention_history
    FROM public.conversation_emerging_focus_attention_events e
   WHERE e.session_id = p_session_id AND e.user_id = p_user_id;

  -- Canonical Thread truth already established in THIS Session, BEFORE the
  -- returned token. A Thread at a Session Position later than the base clock
  -- is structurally impossible; it is refused, never truncated.
  IF EXISTS (
    SELECT 1 FROM public.conversation_threads t
     WHERE t.user_id = p_user_id AND t.established_session_id = p_session_id
       AND (base_current_sp IS NULL OR t.established_sp > base_current_sp)) THEN
    RAISE EXCEPTION 'INVALID_THREAD_RUNTIME_CONTEXT' USING ERRCODE='55000',
      DETAIL='A canonical Thread cannot be established at a Session Position later than the base semantic-clock token.';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'thread_id', t.id,
           'emerging_focus_id', t.grounding_emerging_focus_id,
           'established_cu_id', t.established_cu_id,
           'established_sp', t.established_sp)
           ORDER BY t.established_sp), '[]'::jsonb)
    INTO established_thread_bindings
    FROM public.conversation_threads t
   WHERE t.user_id = p_user_id AND t.established_session_id = p_session_id
     AND t.established_sp <= base_current_sp;

  RETURN NEXT;
END;$$;

-- ===========================================================================
-- 3. The Thread-capture cutover-readiness audit. A DEPLOYMENT / READINESS
--    PROOF ONLY: it fails closed if ANY existing committed-CU batch is not
--    structurally COMPLETE by the ONE 0068 authority, and it backfills,
--    repairs, deletes, mutates and declares nothing. It is STABLE, so the
--    database itself refuses any write from inside it.
--
--    A clean empty database passes; a database holding only fully B2
--    integrated batches passes. Every legacy T-03A2-only batch (nonzero and
--    zero-CU), every B1-only batch, every missing / partial / corrupt B2
--    capture, every corrupted evidence or origin provenance and every
--    Thread / Home / event incoherence fails with
--    THREAD_CAPTURE_CUTOVER_NOT_READY. That blocker is REPORTED, never solved
--    here: no guessed, timestamp or migration-time backfill, no deletion or
--    rewrite workaround, and no Product-ready flag.
-- ===========================================================================
CREATE FUNCTION public.assert_conversation_thread_capture_cutover_ready_v1()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  offending uuid;
  offending_state text;
BEGIN
  SELECT b.id, public.conversation_thread_batch_state_v1(b.session_id, b.user_id, b.source_turn_id, b.id)
    INTO offending, offending_state
    FROM public.conversation_unit_commit_batches b
   WHERE public.conversation_thread_batch_state_v1(b.session_id, b.user_id, b.source_turn_id, b.id) <> 'COMPLETE'
   ORDER BY b.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'THREAD_CAPTURE_CUTOVER_NOT_READY' USING ERRCODE='55000',
      DETAIL=format('COMMIT_BATCH_NOT_THREAD_COMPLETE: %s (%s)', offending, offending_state);
  END IF;
END;$$;

-- ===========================================================================
-- 4. Ownership, search_path hardening and the unchanged authority posture.
--    Nothing new is granted; nothing existing is revoked or re-granted.
--    `SET search_path=''` with fully qualified names is the frozen 0064-0068
--    convention and is strictly stronger than a `public, pg_temp` search path.
-- ===========================================================================
ALTER FUNCTION public.get_conversation_focus_thread_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.get_conversation_focus_thread_runtime_context_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.assert_conversation_thread_capture_cutover_ready_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_conversation_focus_thread_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_conversation_focus_thread_runtime_context_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_conversation_thread_capture_cutover_ready_v1() FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  -- PRODUCTION-INERT: none of the three reads is executable by any application
  -- role in this task; the runtime that will call them is wired only at the
  -- final semantic-chain cutover (T-03D).
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_conversation_focus_thread_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_conversation_focus_thread_runtime_context_v1(uuid,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.assert_conversation_thread_capture_cutover_ready_v1() FROM service_role';
END IF;END$$;

-- ===========================================================================
-- 5. Terminal self-assertions: the readiness substrate is unreachable, the
--    T-03B1b1 / T-03B1b2 / T-03B2b2 substrates stay unreachable, the T-03A2
--    activation stays exactly in place, the same-SP seam stays internal, both
--    reads and the audit are read-only by declaration, the B2 completeness
--    authority is not duplicated, and no Product-state column appeared.
-- ===========================================================================
DO $$
DECLARE
  thread_snapshot constant text := 'public.get_conversation_focus_thread_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  thread_context constant text := 'public.get_conversation_focus_thread_runtime_context_v1(uuid,uuid)';
  readiness_audit constant text := 'public.assert_conversation_thread_capture_cutover_ready_v1()';
  batch_state constant text := 'public.conversation_thread_batch_state_v1(uuid,uuid,uuid,uuid)';
  thread_writer constant text := 'public.commit_conversation_units_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer)';
  thread_coordinator constant text := 'public.commit_finalized_exchange_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,integer,bigint)';
  focus_writer constant text := 'public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)';
  focus_coordinator constant text := 'public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)';
  focus_context constant text := 'public.get_conversation_focus_runtime_context_v1(uuid,uuid)';
  focus_snapshot constant text := 'public.get_conversation_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  same_sp_helper constant text := 'public.reserve_session_same_sp_event_v1(uuid,uuid)';
  legacy_producer constant text := 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
  legacy_coordinator constant text := 'public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)';
  legacy_snapshot constant text := 'public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  target_role text;
  target_function text;
  function_row pg_proc;
BEGIN
  FOREACH target_function IN ARRAY ARRAY[thread_snapshot, thread_context, readiness_audit] LOOP
    SELECT * INTO function_row FROM pg_proc WHERE oid = to_regprocedure(target_function);
    IF NOT FOUND THEN RAISE EXCEPTION 'a T-03B2b3 function is missing: %', target_function; END IF;
    IF pg_get_userbyid(function_row.proowner) <> 'postgres' OR NOT function_row.prosecdef
       OR NOT EXISTS (SELECT 1 FROM unnest(function_row.proconfig) AS entry(setting)
                       WHERE entry.setting LIKE 'search_path=%') THEN
      RAISE EXCEPTION 'T-03B2b3 functions must stay postgres-owned, SECURITY DEFINER and search_path-fixed: %', target_function;
    END IF;
    IF function_row.provolatile <> 's' THEN
      RAISE EXCEPTION 'T-03B2b3 adds reads and one audit only: % must be STABLE, never a writer', target_function;
    END IF;
  END LOOP;

  -- ED-B2B3-01: B2 completeness is READ from the single 0068 authority, never
  -- recomputed here. Both the snapshot and the audit must call it by name.
  IF position('conversation_thread_batch_state_v1' IN pg_get_functiondef(to_regprocedure(thread_snapshot))) = 0
     OR position('conversation_thread_batch_state_v1' IN pg_get_functiondef(to_regprocedure(readiness_audit))) = 0
     OR position('conversation_thread_batch_state_v1' IN pg_get_functiondef(to_regprocedure(thread_context))) = 0 THEN
    RAISE EXCEPTION 'T-03B2b3 must reuse the single 0068 B2 completeness authority, never duplicate it';
  END IF;
  IF to_regprocedure(batch_state) IS NULL THEN
    RAISE EXCEPTION 'the 0068 structural B2 completeness authority must remain deployed';
  END IF;

  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
      FOREACH target_function IN ARRAY ARRAY[thread_snapshot, thread_context, readiness_audit, batch_state,
                                             thread_writer, thread_coordinator, focus_writer, focus_coordinator,
                                             focus_context, focus_snapshot, same_sp_helper] LOOP
        IF has_function_privilege(target_role, target_function, 'EXECUTE') THEN
          RAISE EXCEPTION 'T-03B2b3 performs no cutover: % must not execute %', target_role, target_function;
        END IF;
      END LOOP;
      IF target_role = 'service_role' THEN
        IF NOT has_function_privilege(target_role, legacy_producer, 'EXECUTE')
           OR NOT has_function_privilege(target_role, legacy_coordinator, 'EXECUTE')
           OR NOT has_function_privilege(target_role, legacy_snapshot, 'EXECUTE') THEN
          RAISE EXCEPTION 'T-03B2b3 must leave the live T-03A2 service_role grants exactly in place';
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
                AND c.column_name ~* 'focus_enabled|analysis_enabled|thread_enabled|semantic_version|historical_ready|cutover_ready|focus_ready|thread_ready') THEN
    RAISE EXCEPTION 'activation readiness must never become Product or historical eligibility state';
  END IF;
END$$;

COMMIT;
