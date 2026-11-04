-- INTEL-04 — Thread Lifecycle Derivation Correction (QAN-BL-INTEL-04), under the Product Owner's execution order of
-- 2026-11-04 (option A of the S8B-06 CP3 F-H decision memo, once tests prove it). Forward-only. Not hosted: a hosted
-- migration goes only through HOSTED-DEPLOY-01.
--
-- ## The defect (proven, not assumed)
--
--   For every committed CU the database re-derives the Thread lifecycle transitions
--   (derive_conversation_thread_lifecycle_transitions_v1, 0070) and refuses a payload that differs
--   (THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL, 22023). SUSTAINED_DEPARTURE needs the current CU AND the immediately
--   preceding committed CU (session_position - 1) to be away from the Thread, and "away" is read through
--   conversation_thread_cu_relation_v1. Its attention_on predicate counted a binding only when it was made STRICTLY
--   before the CU whose relation is read (b.bound_sp < cu.session_position). The CU that establishes a Thread (or binds
--   an existing one by Session continuity) carries the binding at its OWN position, so the relation answered "away"
--   for the establishing CU and its own Thread. When that CU was followed directly by a CU whose attention is elsewhere,
--   the database derived ACTIVE -> DORMANT (SUSTAINED_DEPARTURE) after ONE departure; the application's reducer
--   (thread-lifecycle-reducer.ts), which sees every binding visible to the current CU, derived nothing; and the canonical
--   payload was refused on every attempt, the call analysis item PARKED, and the Session's ordered analysis stopped.
--   The record agrees with the reducer: a CU is never away "when its attention is on the Thread's bound focus"
--   (docs/thread-lifecycle-cross-session-continuity-v1.md section 3).
--
-- ## The correction (one predicate)
--
--   conversation_thread_cu_relation_v1.attention_on counts a binding made AT OR BEFORE the CU whose relation is read:
--   b.bound_sp <= cu.session_position. That is exactly the reducer's reading. The derivation reads the relation for the
--   current CU and for the CU at session_position - 1; the validator runs BEFORE the current CU's own binding row is
--   written, so for the current CU the change admits nothing new, and for the previous CU it admits exactly the binding
--   that CU made itself. A binding made at the current position (written only after validation, and re-derivable later)
--   is always the current CU's own focus bound to a Thread that is NOT in the derivation's loop (that loop keeps
--   `bound_sp < current`), so it changes no transition either.
--
-- ## Deliberately unchanged (each `<` is intended and stays)
--
--   * targets_thread keeps `b.bound_sp < cu.session_position`: a CU's target is an earlier CU, and a target focus bound
--     at the reading CU's own position is that CU's own attention focus, already counted by attention_on; it changes no
--     derivation, so it is not touched for uniformity.
--   * derive_conversation_thread_lifecycle_transitions_v1 (0070) is not replaced: its loop over Threads bound strictly
--     before the current CU (the reducer's threadStates: a Thread first bound at this CU is a baseline, never a
--     transition), its own_thread read and its order are unchanged.
--   * conversation_thread_session_lifecycle_state_v1 (strictly before p_before_sp), the validator's structural refusal of
--     a binding at or after the current position, the semantic batch state, the readiness audit, the writers, the
--     coordinators, the identities, the bindings, the Homes and the same-SP sequencing are unchanged.
--   * No row is written, rewritten, backfilled or re-derived; no item of any queue is touched; no grant is added; nothing
--     is executable by an application role that was not before. Migration 0070 itself is byte-identical.
--
-- ## Existing data
--
--   Every lifecycle row 0070 ever accepted was equal to the reducer's result AND the old derivation. The new derivation is
--   the reducer's result, so every stored row stays re-derivable. A call analysis item PARKED by this refusal is retried by
--   its own existing rule (the parked retry, in its order, within the daily budget); nothing here reprocesses it.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE RELATION, replaced in place (same signature, same OUT columns, same volatility, owner, definer and search_path).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.conversation_thread_cu_relation_v1(
  p_cu_id uuid,
  p_thread_id uuid,
  OUT attention_on boolean,
  OUT targets_thread boolean,
  OUT local_clarification boolean,
  OUT away boolean,
  OUT explicit_shift boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  cu public.conversation_units;
  att public.conversation_emerging_focus_attention_events;
  sem public.conversation_unit_focus_semantics;
BEGIN
  SELECT * INTO cu FROM public.conversation_units u WHERE u.id = p_cu_id;
  SELECT * INTO att FROM public.conversation_emerging_focus_attention_events e WHERE e.cu_id = p_cu_id;
  SELECT * INTO sem FROM public.conversation_unit_focus_semantics s WHERE s.cu_id = p_cu_id;
  IF cu.id IS NULL OR att.cu_id IS NULL OR sem.cu_id IS NULL THEN
    RAISE EXCEPTION 'INCOMPLETE_PRIOR_THREAD_HISTORY' USING ERRCODE='55000',
      DETAIL='A lifecycle relation is only derivable for a committed CU whose canonical B1 semantics are durable.';
  END IF;
  -- INTEL-04 (0194): a binding made AT the CU's own position counts; the CU establishing (or binding) a Thread is on it.
  attention_on := att.attention_kind <> 'NO_INDEPENDENT_FOCUS' AND EXISTS (
    SELECT 1 FROM public.conversation_thread_focus_bindings b
     WHERE b.thread_id = p_thread_id AND b.session_id = cu.session_id
       AND b.emerging_focus_id = att.emerging_focus_id AND b.bound_sp <= cu.session_position);
  targets_thread := sem.target_cu_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.conversation_emerging_focus_attention_events ta
      JOIN public.conversation_thread_focus_bindings b
        ON b.emerging_focus_id = ta.emerging_focus_id AND b.session_id = ta.session_id
     WHERE ta.cu_id = sem.target_cu_id AND ta.attention_kind <> 'NO_INDEPENDENT_FOCUS'
       AND b.thread_id = p_thread_id AND b.bound_sp < cu.session_position);
  local_clarification := att.attention_reason = 'LOCAL_CLARIFICATION_OR_CORRECTION' AND (attention_on OR targets_thread);
  away := att.attention_kind IN ('START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS') AND NOT attention_on AND NOT local_clarification;
  explicit_shift := away AND 'FOCUS_SHIFT' = ANY (sem.functions);
END;$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE SAME POSTURE as 0070 section 21: postgres-owned, executable by no application role.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER FUNCTION public.conversation_thread_cu_relation_v1(uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.conversation_thread_cu_relation_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.conversation_thread_cu_relation_v1(uuid,uuid) FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. SELF-PROOF, in this transaction: the posture held, and only attention_on changed.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn record;
  body text;
  role_name text;
BEGIN
  SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS definer, p.provolatile AS volatility, p.proconfig AS config
    INTO fn FROM pg_proc p WHERE p.oid = to_regprocedure('public.conversation_thread_cu_relation_v1(uuid,uuid)');
  IF fn.owner IS DISTINCT FROM 'postgres' OR fn.definer IS DISTINCT FROM true OR fn.volatility IS DISTINCT FROM 's'
     OR fn.config IS DISTINCT FROM ARRAY['search_path=""'] THEN
    RAISE EXCEPTION 'INTEL_04_RELATION_POSTURE_CHANGED' USING ERRCODE = '55000';
  END IF;
  body := pg_get_functiondef(to_regprocedure('public.conversation_thread_cu_relation_v1(uuid,uuid)'));
  IF position('AND b.emerging_focus_id = att.emerging_focus_id AND b.bound_sp <= cu.session_position)' IN body) = 0
     OR position('AND b.thread_id = p_thread_id AND b.bound_sp < cu.session_position)' IN body) = 0
     OR (length(body) - length(replace(body, 'b.bound_sp', ''))) / length('b.bound_sp') <> 2 THEN
    RAISE EXCEPTION 'INTEL_04_RELATION_NOT_AS_DECIDED' USING ERRCODE = '55000';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name)
       AND has_function_privilege(role_name, 'public.conversation_thread_cu_relation_v1(uuid,uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'INTEL_04_RELATION_GRANTED' USING ERRCODE = '55000', DETAIL = role_name;
    END IF;
  END LOOP;
END$$;

COMMIT;
