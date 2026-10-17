-- S6-06 - Introduction SUCCESS and post-Introduction reactivation v1 (CP1: Secure Backend & Media).
--
-- Product authority: the Product Owner's S6-06 Task Contract v1.0, WP0 v1.1 and its five-point correction, approved on
-- 2026-10-16 with three execution conditions; this migration carries condition 3. The execution record is
-- docs/e2e/QANDEEL_S6_06_IMPLEMENTATION_RECORD_v1.md. 0162 is the same checkpoint's disclosure and photo part.
--
-- The frozen 0116 SUCCESS cores and the frozen 0117 reactivation core are fully implemented and executable by no
-- application role; each checks its own CW2-08 seam LAST and every seam answers NOT_EVALUATED. Nothing here produces a
-- success transition version: `prepare` stays closed and producer-less until Stage 8A (GATE-33). In production there is
-- therefore no version to approve, and every reactivation answers NOT_AVAILABLE_NOW. No existing function, table, seam,
-- policy or privilege is changed (0001-0162 are byte-unchanged).
--
-- ## Two humans decide, the system executes (D-07, correction 3, condition 3)
--
--   approve (gated)   the frozen approval core, as the session subject (auth.uid()), in ITS OWN transaction. Its answer
--                     is the human's own state only: nothing about the other human's decision is ever returned.
--   withdraw          the frozen approval core's WITHDRAW act, ungated: consent is never trapped.
--   complete          a SEPARATE transaction, after the approval has committed. It takes no actor and passes none: the
--                     authority is the pair of current approvals the frozen commit re-proves under its own locks, with
--                     CW2-08 last. Its command and both participation identities are derived from the transition
--                     version alone, so whichever human (or retry) runs it, there is exactly one terminal commit, and a
--                     second run replays it. A failure of any kind - the gate, a lock conflict (40001), an incomplete
--                     pair - rolls back only this transaction: both approvals stay exactly as they were, the gate is
--                     read and never written, and the next attempt is safe.
--
-- There is no SAVEPOINT (PL/pgSQL does not allow one, and a PostgREST call is one transaction) and the approval is
-- never in the same transaction as the commit, so a commit failure - including a serialization failure - cannot undo a
-- human's approval. The API runs `complete` right after the second approval, and again whenever either human reads the
-- SUCCESS state, so the transition is attempted whenever the gates allow without any background actor: a timer-driven
-- service_role path would be a Matching write reachable by service_role, which SEC-MATCH-00 (0149) forbids.
--
-- `complete` answers COMPLETED, or PENDING for every other case - the gate closed, the other human not (or no longer)
-- approving, a conflict - so it is not an oracle of the other human's decision.
--
-- ## Reactivation (D-08)
--
-- One explicit act by the human, through the frozen 0117 boundary and nothing else: full current revalidation, no
-- revived proposal, no automatic resume, CW2-08 last. The participation identity is derived from the caller's command.
--
-- ## What is deliberately NOT here
--
-- No producer of success transition versions (Stage 8A); no change to a frozen core or seam; no service_role path to
-- any Matching write; no Activity, Push or AI. Forward-only.
BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE SYSTEM COMPLETION (private; executable by no application role).
-- ---------------------------------------------------------------------------------------------------------------------
-- One attempt at the frozen commit for one exact version. Every identity is derived from the version alone (the nil
-- human marks "no human"), so the attempt is the same command whoever triggers it.
CREATE FUNCTION introduction_sharing_private.attempt_introduction_success_v1(p_transition_version_id uuid)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_system constant uuid := '00000000-0000-0000-0000-000000000000';
  v_record uuid;
  v_status text;
BEGIN
  SELECT v.introduction_record_id INTO v_record FROM public.introduction_success_transition_versions v
   WHERE v.id = p_transition_version_id;
  IF NOT FOUND THEN
    RETURN 'PENDING';
  END IF;
  -- The gate first, read-only: a closed gate costs no lock and changes nothing. The frozen commit checks it LAST again.
  IF (SELECT g.clearance FROM public.resolve_introduction_success_prerequisites_v1(v_record) g) IS DISTINCT FROM 'CLEARED' THEN
    RETURN 'PENDING';
  END IF;
  BEGIN
    PERFORM 1 FROM public.commit_introduction_success_v1(
      introduction_sharing_private.derive_identity_v1('SUCCESS_COMMIT', v_system, v_record, p_transition_version_id),
      p_transition_version_id,
      introduction_sharing_private.derive_identity_v1('SUCCESS_LOWER_PARTICIPATION', v_system, v_record, p_transition_version_id),
      introduction_sharing_private.derive_identity_v1('SUCCESS_HIGHER_PARTICIPATION', v_system, v_record, p_transition_version_id));
  EXCEPTION
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' OR SQLSTATE '55000' OR SQLSTATE 'P0002' OR SQLSTATE 'P0001' OR SQLSTATE '23505' THEN
      SELECT r.introduction_status INTO v_status FROM public.introduction_records r WHERE r.id = v_record;
      RETURN CASE WHEN v_status = 'COMPLETED' THEN 'COMPLETED' ELSE 'PENDING' END;
  END;
  RETURN 'COMPLETED';
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE HUMANS' BOUNDARIES (authenticated).
-- ---------------------------------------------------------------------------------------------------------------------
-- The reader's own view: the latest transition version of a live Introduction and the reader's OWN approval state of it.
-- Nothing about the other human. COMPLETED once SUCCESS made the World Standard.
CREATE FUNCTION public.read_my_introduction_success_v1(p_world_id uuid)
RETURNS TABLE(introduction_state text, transition_version_id uuid, my_approval_state text, my_current_event_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_state text;
  v_version uuid;
  v_event uuid;
  v_resulting text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_state := introduction_sharing_private.introduction_state_v1(p_world_id, v_user);
  IF v_state IS NULL THEN
    RETURN;
  END IF;
  IF v_state = 'ACTIVE' THEN
    SELECT v.id INTO v_version FROM public.introduction_success_transition_versions v
      JOIN public.introduction_records r ON r.id = v.introduction_record_id
     WHERE r.world_id = p_world_id
     ORDER BY v.created_at DESC, v.id DESC LIMIT 1;
    IF v_version IS NOT NULL THEN
      SELECT s.current_event_id, e.resulting_state INTO v_event, v_resulting
        FROM public.introduction_success_approval_state s
        JOIN public.introduction_success_approval_events e ON e.id = s.current_event_id
       WHERE s.transition_version_id = v_version AND s.approver_user_id = v_user;
    END IF;
  END IF;
  RETURN QUERY SELECT v_state, v_version,
                      CASE WHEN v_version IS NULL THEN NULL ELSE coalesce(v_resulting, 'NONE') END, v_event;
END$$;

CREATE FUNCTION public.approve_my_introduction_success_v1(
  p_command_id uuid, p_world_id uuid, p_transition_version_id uuid, p_expected_current_event_id uuid
) RETURNS TABLE(outcome text, approval_event_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_record uuid;
  v_event uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_transition_version_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT r.id INTO v_record FROM public.introduction_records r
    JOIN public.introduction_success_transition_versions v ON v.introduction_record_id = r.id
   WHERE r.world_id = p_world_id AND v.id = p_transition_version_id AND v_user IN (r.lower_user_id, r.higher_user_id);
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  -- A new approval is a launch capability: the SUCCESS seam must be CLEARED (D-07). A retry of an approval that already
  -- exists is the frozen core's to answer from history, gate or no gate.
  IF NOT EXISTS (SELECT 1 FROM public.introduction_success_approval_events e WHERE e.id = p_command_id)
     AND (SELECT g.clearance FROM public.resolve_introduction_success_prerequisites_v1(v_record) g) IS DISTINCT FROM 'CLEARED' THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::uuid;
    RETURN;
  END IF;
  BEGIN
    SELECT a.approval_event_id INTO v_event
      FROM public.approve_introduction_success_v1(p_command_id, p_transition_version_id, p_expected_current_event_id) a;
  EXCEPTION
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      RETURN QUERY SELECT 'CHANGED'::text, NULL::uuid;
      RETURN;
    WHEN SQLSTATE '55000' THEN
      -- INTRODUCTION_SUCCESS_APPROVAL_UNCHANGED: this human already approves this exact version.
      RETURN QUERY SELECT CASE WHEN SQLERRM = 'INTRODUCTION_SUCCESS_APPROVAL_UNCHANGED' THEN 'APPROVED' ELSE 'UNAVAILABLE' END, NULL::uuid;
      RETURN;
    WHEN SQLSTATE '23505' THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::uuid;
      RETURN;
    WHEN SQLSTATE 'P0002' OR SQLSTATE 'P0001' THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
      RETURN;
  END;
  RETURN QUERY SELECT 'APPROVED'::text, v_event;
END$$;

CREATE FUNCTION public.withdraw_my_introduction_success_v1(
  p_command_id uuid, p_world_id uuid, p_transition_version_id uuid, p_expected_current_event_id uuid
) RETURNS TABLE(outcome text, approval_event_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_event uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_transition_version_id IS NULL OR p_expected_current_event_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.introduction_records r
                   JOIN public.introduction_success_transition_versions v ON v.introduction_record_id = r.id
                  WHERE r.world_id = p_world_id AND v.id = p_transition_version_id
                    AND v_user IN (r.lower_user_id, r.higher_user_id)) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  -- Ungated, like END: a safety system may stop a human from continuing, never from taking consent back.
  BEGIN
    SELECT a.approval_event_id INTO v_event
      FROM public.withdraw_introduction_success_approval_v1(p_command_id, p_transition_version_id, p_expected_current_event_id) a;
  EXCEPTION
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      RETURN QUERY SELECT 'CHANGED'::text, NULL::uuid;
      RETURN;
    WHEN SQLSTATE '55000' THEN
      RETURN QUERY SELECT CASE WHEN SQLERRM = 'INTRODUCTION_SUCCESS_APPROVAL_UNCHANGED' THEN 'WITHDRAWN' ELSE 'UNAVAILABLE' END, NULL::uuid;
      RETURN;
    WHEN SQLSTATE '23505' THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::uuid;
      RETURN;
    WHEN SQLSTATE 'P0002' OR SQLSTATE 'P0001' THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
      RETURN;
  END;
  RETURN QUERY SELECT 'WITHDRAWN'::text, v_event;
END$$;

-- The system attempt, triggered by either human (after an approval, or on reading the state). It takes no actor and
-- passes none; it answers COMPLETED or PENDING only, so it reveals nothing about the other human's decision.
CREATE FUNCTION public.complete_my_introduction_success_v1(p_world_id uuid)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_state text;
  v_version uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_state := introduction_sharing_private.introduction_state_v1(p_world_id, v_user);
  IF v_state IS NULL OR v_state = 'ENDED' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  IF v_state = 'SHARED_WORLD' THEN
    RETURN QUERY SELECT 'COMPLETED'::text;
    RETURN;
  END IF;
  -- The one version both humans currently approve, if any. Read without a lock: the frozen commit re-proves it.
  SELECT v.id INTO v_version FROM public.introduction_success_transition_versions v
    JOIN public.introduction_records r ON r.id = v.introduction_record_id
   WHERE r.world_id = p_world_id AND r.introduction_status = 'ACTIVE'
     AND (SELECT count(*) FROM public.introduction_success_approval_state s
            JOIN public.introduction_success_approval_events e ON e.id = s.current_event_id
           WHERE s.transition_version_id = v.id AND e.resulting_state = 'APPROVED'
             AND s.approver_user_id IN (r.lower_user_id, r.higher_user_id)) = 2
   ORDER BY v.created_at DESC, v.id DESC LIMIT 1;
  IF v_version IS NULL THEN
    RETURN QUERY SELECT 'PENDING'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT introduction_sharing_private.attempt_introduction_success_v1(v_version);
END$$;

-- One explicit reactivation, through the frozen 0117 boundary, as the session subject.
CREATE FUNCTION public.reactivate_my_introductions_v1(
  p_command_id uuid, p_expected_current_event_id uuid, p_entry_channel text
) RETURNS TABLE(outcome text, participation_state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_state text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_expected_current_event_id IS NULL
     OR (p_entry_channel IS NOT NULL AND p_entry_channel NOT IN ('CONVERSATIONAL_ENTRY', 'MANUAL_MY_WORLD_ENTRY')) THEN
    RAISE EXCEPTION 'INTRODUCTION_REACTIVATION_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  BEGIN
    SELECT a.participation_state INTO v_state
      FROM public.reactivate_matching_after_introduction_v1(
             p_command_id,
             introduction_sharing_private.derive_identity_v1('REACTIVATION_PARTICIPATION_EVENT', v_user, v_user, p_command_id),
             p_expected_current_event_id, p_entry_channel) a;
  EXCEPTION
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      RETURN QUERY SELECT 'CHANGED'::text, NULL::text;
      RETURN;
    WHEN SQLSTATE '55000' THEN
      RETURN QUERY SELECT CASE WHEN SQLERRM = 'MATCHING_REACTIVATION_PREREQUISITE_UNRESOLVED' THEN 'NOT_AVAILABLE_NOW'
                               WHEN SQLERRM = 'MATCHING_REACTIVATION_NOT_ELIGIBLE' THEN 'NOT_ELIGIBLE'
                               ELSE 'UNAVAILABLE' END, NULL::text;
      RETURN;
    WHEN SQLSTATE '23505' THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::text;
      RETURN;
    WHEN SQLSTATE 'P0002' OR SQLSTATE 'P0001' THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::text;
      RETURN;
  END;
  RETURN QUERY SELECT 'REACTIVATED'::text, v_state;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. OWNERSHIP AND ACL.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
  r text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'introduction_sharing_private.attempt_introduction_success_v1(uuid)',
    'public.read_my_introduction_success_v1(uuid)',
    'public.approve_my_introduction_success_v1(uuid,uuid,uuid,uuid)',
    'public.withdraw_my_introduction_success_v1(uuid,uuid,uuid,uuid)',
    'public.complete_my_introduction_success_v1(uuid)',
    'public.reactivate_my_introductions_v1(uuid,uuid,text)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r);
      END IF;
    END LOOP;
  END LOOP;
END$$;

GRANT EXECUTE ON FUNCTION
  public.read_my_introduction_success_v1(uuid),
  public.approve_my_introduction_success_v1(uuid, uuid, uuid, uuid),
  public.withdraw_my_introduction_success_v1(uuid, uuid, uuid, uuid),
  public.complete_my_introduction_success_v1(uuid),
  public.reactivate_my_introductions_v1(uuid, uuid, text)
  TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  boundaries text[] := ARRAY[
    'public.read_my_introduction_success_v1(uuid)',
    'public.approve_my_introduction_success_v1(uuid,uuid,uuid,uuid)',
    'public.withdraw_my_introduction_success_v1(uuid,uuid,uuid,uuid)',
    'public.complete_my_introduction_success_v1(uuid)',
    'public.reactivate_my_introductions_v1(uuid,uuid,text)'];
  hidden text[] := ARRAY[
    'introduction_sharing_private.attempt_introduction_success_v1(uuid)',
    'public.prepare_introduction_success_transition_v1(uuid,uuid)',
    'public.record_introduction_success_approval_core_v1(uuid,uuid,uuid,text)',
    'public.approve_introduction_success_v1(uuid,uuid,uuid)',
    'public.withdraw_introduction_success_approval_v1(uuid,uuid,uuid)',
    'public.commit_introduction_success_v1(uuid,uuid,uuid,uuid)',
    'public.reactivate_matching_after_introduction_v1(uuid,uuid,uuid,text)',
    'public.resolve_introduction_success_prerequisites_v1(uuid)',
    'public.resolve_matching_reactivation_prerequisites_v1(uuid)'];
  fn text;
  r text;
  src text;
  attempt text;
  complete_src text;
BEGIN
  FOREACH fn IN ARRAY boundaries LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef
                     AND pg_get_userbyid(p.proowner) = 'postgres' AND p.proconfig @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'S6-06: % must be postgres-owned, SECURITY DEFINER and search_path-pinned', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S6-06: PUBLIC must not execute %', fn;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-06: % must not execute %', r, fn;
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AND NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S6-06: authenticated must execute %', fn;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_proc p, unnest(p.proargnames) a WHERE p.oid = fn::regprocedure
                AND a ~* '(user|owner|actor|approver|counterpart|recipient)') THEN
      RAISE EXCEPTION 'S6-06: % must take no human identity', fn;
    END IF;
    SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO src FROM pg_proc p WHERE p.oid = fn::regprocedure;
    IF src ~* '(INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|EXECUTE\s|public\.users|prepare_introduction_success)' THEN
      RAISE EXCEPTION 'S6-06: % writes nothing itself, runs no dynamic SQL, reads no account Name and prepares nothing', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY hidden LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-06: % must not execute %', r, fn;
      END IF;
    END LOOP;
  END LOOP;
  -- The system attempt reads no session subject and writes no approval: it executes because both approvals exist.
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO attempt FROM pg_proc p
   WHERE p.oid = 'introduction_sharing_private.attempt_introduction_success_v1(uuid)'::regprocedure;
  IF attempt ~* '(auth\.uid|approval_events|approval_state|approve_introduction|record_introduction_success_approval)' THEN
    RAISE EXCEPTION 'S6-06: the system completion must not read the session subject or touch an approval';
  END IF;
  -- The approval and the commit never share a transaction: no human boundary both approves and commits.
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO complete_src FROM pg_proc p
   WHERE p.oid = 'public.approve_my_introduction_success_v1(uuid,uuid,uuid,uuid)'::regprocedure;
  IF complete_src ~* '(commit_introduction_success|attempt_introduction_success)' THEN
    RAISE EXCEPTION 'S6-06: the approval boundary must not run the commit in the approving transaction';
  END IF;
  IF (SELECT g.clearance FROM public.resolve_introduction_success_prerequisites_v1(gen_random_uuid()) g) <> 'NOT_EVALUATED'
     OR (SELECT g.clearance FROM public.resolve_matching_reactivation_prerequisites_v1(gen_random_uuid()) g) <> 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'S6-06: the SUCCESS and reactivation seams must still answer NOT_EVALUATED';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.prosrc ~ 'prepare_introduction_success_transition_v1\s*\('
               AND p.oid <> 'public.prepare_introduction_success_transition_v1(uuid,uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'S6-06: nothing may call the success preparation before Stage 8A';
  END IF;
END$$;

COMMIT;
