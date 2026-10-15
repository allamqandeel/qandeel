-- S6-04 - Private Proposal Review and Decisions v1.
--
-- Product authority: the Product Owner's S6-04 Task Contract v1.0 and its twelve binding decisions D1-D12
-- (2026-10-15). The execution record is docs/e2e/QANDEEL_S6_04_IMPLEMENTATION_RECORD_v1.md. This migration is that
-- task's database part, and nothing more.
--
-- Until now no application role could read or act on a matching proposal at all: every I-07B boundary is executable by
-- nobody (0112 section 10, 0120 section 8), and the I-07 record (section 22) leaves the wrapping of the four human
-- decision cores to a later, reviewed boundary. The Product Owner's GATE-21 gives Stage 6 those closed integration
-- boundaries and keeps launch clearance with CW2-08 / Stage 9. This migration adds exactly them, and every one is a thin
-- authenticated shell over the existing cores: no decision rule is re-implemented here.
--
-- ## What is added (authenticated only; the human is auth.uid(); no actor, recipient or role parameter anywhere)
--
--   list_my_matching_proposals_v1(after, limit)     the caller's own delivered proposals, newest delivery first, in
--                                                   bounded pages (at most 20; a technical page size, not a Product cap)
--   get_my_matching_proposal_v1(proposal)           one of them; anything else is the same empty answer
--   approve_my_matching_proposal_forward_v1(...)    over approve_matching_proposal_forward_core_v1      (0114)
--   decline_my_matching_proposal_v1(...)            over decline_matching_proposal_as_first_core_v1     (0120) or
--                                                        decline_matching_proposal_as_second_core_v1    (0120),
--                                                   chosen on the server from the caller's own current view
--   withdraw_my_matching_proposal_v1(...)           over withdraw_matching_proposal_core_v1             (0120)
--
-- and one private helper, executable by nobody, that every one of them shares:
--
--   resolve_my_matching_proposal_presentation_v1(proposal)
--       the frozen neutral projection resolve_my_matching_proposal_v1 (0156: the first name and the conclusion stay
--       NULL), plus the server's own answer to "what may this human do now". It is the ONE place that answer is made.
--
-- ## What a reader is shown
--
-- An opaque view identity, an opaque proposal identity, one of the five frozen neutral outcomes and the decisions this
-- human may take now. No first name, no conclusion, no field, no role, no internal state, no date, no reason and nothing
-- about the other human. The listing reads only the caller's own recipient views, so the second recipient sees nothing
-- before forward approval delivered them a view (CW2-06 section 16 / I-07 section 21); a page cursor that is not one of
-- the caller's own proposals answers with the same empty page as the end of the list.
--
-- ## The decisions a human may take (server-authoritative; D5, D7, D8)
--
--   AWAITING_YOU as the first recipient   APPROVE_FORWARD, DECLINE
--   AWAITING_YOU as the second recipient  DECLINE        (accepting is the atomic Mutual Match commit: S6-05)
--   IN_PROGRESS as the first recipient    WITHDRAW       (after forward approval and before Mutual Match only)
--   anything else                         nothing
--
-- APPROVE_FORWARD and DECLINE are consequential and require the CW2-08 seam to answer CLEARED; it answers
-- NOT_EVALUATED in production, so the listing presents neither and the cores refuse both. WITHDRAW ends the human's own
-- exposure and is deliberately ungated, exactly as the 0112 core is (D7): it is never hidden because launch is closed.
--
-- ## Clock enforcement after expiry, and a proposal that no longer revalidates
--
-- The decision cores never read the proposal deadline; only expiry and the sweeper do (0112 section 8, 0157). A live
-- proposal whose deadline has passed is therefore presented as NO_LONGER_AVAILABLE with no decision - the answer an
-- expiry already gives - and every decision refuses it, deciding against the database clock read AFTER the canonical
-- two-human lock, so a decision that waited past the deadline decides nothing (the 0120 ASSURE-F01 lesson).
--
-- In the same way, a live proposal that fails its own revalidation (resolve_matching_proposal_validity_v1: a pause, an
-- opt-out, a moved authority...) is presented as NO_LONGER_AVAILABLE with no decision, the answer the sweeper's STALE
-- will give. What is read and what is accepted therefore never disagree, so no private change can be inferred from a
-- decision refused while the read still offers it; only the boolean is read, never the private reason.
--
-- ## Order, idempotency and refusals
--
-- Each decision boundary: refuses an anonymous caller (42501) and a missing argument (22023); enters through
-- enter_matching_proposal_decision_v1 (the bounded not-found from immutable membership BEFORE any lock, then the lock);
-- lets the core answer a replay of an already committed command from durable rows before any currentness is consulted;
-- otherwise requires the decision to be one the presentation helper offers under that lock; and then calls the core,
-- which keeps its own exact-view, revalidation and CW2-08 order (gate LAST). Every refusal is one fixed word and rolls
-- back everything the attempt touched, the lock row included:
--
--   RECORDED          the core committed (or a replay of the committed command), with the core's neutral outcome
--   CHANGED           the exact view or the proposal moved underneath the caller (the cores' 40001): read again
--                     (the one 40001 that is not a move - the proposal failing its own revalidation - is UNAVAILABLE)
--   UNAVAILABLE       nothing to decide: not theirs, not offered to them, no longer live, past its deadline, no longer
--                     valid, or not a decision offered now - one answer, so it reveals none of those reasons (and the
--                     reads already present each of those as NO_LONGER_AVAILABLE or as no row)
--   NOT_AVAILABLE_NOW the CW2-08 seam did not answer CLEARED (55000)
--   COMMAND_CONFLICT  this command id already names a different request (23505)
--
-- The cores' 40001 is absorbed here, never sent to PostgREST, which re-runs a 40001 transaction without bound before
-- v16 (PROD-RETRY-01, QAN-BL-PROD-06); the handler names PT409 too, so it is no CATCH_TRAP. A contradictory durable state
-- (P0001) is not repaired and not absorbed.
--
-- ## What is deliberately NOT here
--
-- No acceptance by the second recipient, no Mutual Match, no World (S6-05); no first name, conclusion or field
-- presentation; no change to any I-07 core, projection, seam, policy or privilege; the resolve_my_matching_proposal_fields_v1
-- projection stays executable by nobody; no enrollment, producer, orchestrator or sweeper; no Activity or notification.
-- Forward-only. Migrations 0001-0157 are byte-unchanged.
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE ONE PRESENTATION ANSWER (private; executable by nobody).
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_my_matching_proposal_presentation_v1(p_proposal_id uuid)
RETURNS TABLE(recipient_view_id uuid, neutral_outcome text, decision_actions text[], presented_actions text[],
              recipient_role text, proposal_state text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u uuid := auth.uid();
  mine record;
  proposal public.matching_proposals;
  role_of text;
  outcome text;
  actions text[] := ARRAY[]::text[];
  valid boolean;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  -- The frozen neutral projection: the caller's own current view, or the bounded not-found (P0002).
  SELECT * INTO mine FROM public.resolve_my_matching_proposal_v1(p_proposal_id) r;
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  SELECT v.recipient_role INTO role_of FROM public.matching_recipient_proposal_views v WHERE v.id = mine.recipient_view_id;
  outcome := mine.neutral_outcome;

  IF outcome IN ('AWAITING_YOU', 'IN_PROGRESS') THEN
    SELECT v.still_valid INTO valid FROM public.resolve_matching_proposal_validity_v1(p_proposal_id) v;
  END IF;

  IF outcome IN ('AWAITING_YOU', 'IN_PROGRESS') AND (proposal.expires_at <= clock_timestamp() OR valid IS NOT TRUE) THEN
    -- Past its deadline, or no longer valid, a live proposal decides nothing and reads as any other ending does.
    outcome := 'NO_LONGER_AVAILABLE';
  ELSIF outcome = 'AWAITING_YOU' AND role_of = 'FIRST_RECIPIENT' THEN
    actions := ARRAY['APPROVE_FORWARD', 'DECLINE'];
  ELSIF outcome = 'AWAITING_YOU' AND role_of = 'CANDIDATE' THEN
    actions := ARRAY['DECLINE'];
  ELSIF outcome = 'IN_PROGRESS' AND role_of = 'FIRST_RECIPIENT'
        AND proposal.proposal_state IN ('FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND') THEN
    actions := ARRAY['WITHDRAW'];
  END IF;

  RETURN QUERY SELECT mine.recipient_view_id, outcome, actions,
    CASE WHEN actions && ARRAY['APPROVE_FORWARD', 'DECLINE'] THEN
      (SELECT CASE WHEN g.clearance = 'CLEARED' THEN actions ELSE array_remove(array_remove(actions, 'APPROVE_FORWARD'), 'DECLINE') END
         FROM public.resolve_matching_proposal_prerequisites_v1(p_proposal_id) g)
    ELSE actions END,
    role_of, proposal.proposal_state;
END$$;

COMMENT ON FUNCTION public.resolve_my_matching_proposal_presentation_v1(uuid) IS
  'S6-04: the frozen neutral projection of the caller''s own current view plus the decisions this human may take now '
  '(decision_actions: whatever the launch seam says; presented_actions: what may be shown). A live proposal past its '
  'deadline, or failing its own revalidation, reads NO_LONGER_AVAILABLE and offers nothing. Private: executable by nobody; role and state never leave '
  'the S6-04 boundaries.';

-- ---------------------------------------------------------------------------
-- 2. THE READS.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.list_my_matching_proposals_v1(p_after_proposal_id uuid, p_limit integer)
RETURNS TABLE(recipient_view_id uuid, matching_proposal_id uuid, neutral_outcome text, available_actions text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u uuid := auth.uid();
  after_at timestamptz;
  item record;
  here record;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 20 THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_after_proposal_id IS NOT NULL THEN
    SELECT min(v.materialized_at) INTO after_at FROM public.matching_recipient_proposal_views v
     WHERE v.proposal_id = p_after_proposal_id AND v.recipient_user_id = u;
    -- A cursor that is not one of the caller's own proposals is the end of the list, whatever it names.
    IF after_at IS NULL THEN RETURN; END IF;
  END IF;
  FOR item IN
    SELECT st.proposal_id, min(v.materialized_at) AS delivered_at
      FROM public.matching_recipient_proposal_view_state st
      JOIN public.matching_recipient_proposal_views v
        ON v.proposal_id = st.proposal_id AND v.recipient_user_id = st.recipient_user_id
     WHERE st.recipient_user_id = u
     GROUP BY st.proposal_id
    HAVING after_at IS NULL OR (min(v.materialized_at), st.proposal_id) < (after_at, p_after_proposal_id)
     ORDER BY min(v.materialized_at) DESC, st.proposal_id DESC
     LIMIT p_limit
  LOOP
    SELECT * INTO here FROM public.resolve_my_matching_proposal_presentation_v1(item.proposal_id) r;
    RETURN QUERY SELECT here.recipient_view_id, item.proposal_id, here.neutral_outcome, here.presented_actions;
  END LOOP;
END$$;

COMMENT ON FUNCTION public.list_my_matching_proposals_v1(uuid, integer) IS
  'S6-04 (D2): the caller''s own delivered matching proposals, newest delivery first, at most 20 per page; the cursor '
  'is the last proposal of the previous page and anything that is not the caller''s own is the end of the list. Each '
  'row: opaque view and proposal identities, the neutral outcome, the decisions offered now. authenticated only.';

CREATE FUNCTION public.get_my_matching_proposal_v1(p_proposal_id uuid)
RETURNS TABLE(recipient_view_id uuid, matching_proposal_id uuid, neutral_outcome text, available_actions text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u uuid := auth.uid();
  here record;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_proposal_id IS NULL THEN RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE = '22023'; END IF;
  BEGIN
    SELECT * INTO here FROM public.resolve_my_matching_proposal_presentation_v1(p_proposal_id) r;
  EXCEPTION WHEN no_data_found THEN
    -- Another human's proposal, one never offered to the caller and one that does not exist: one empty answer.
    RETURN;
  END;
  RETURN QUERY SELECT here.recipient_view_id, p_proposal_id, here.neutral_outcome, here.presented_actions;
END$$;

COMMENT ON FUNCTION public.get_my_matching_proposal_v1(uuid) IS
  'S6-04: one of the caller''s own delivered matching proposals, exactly as the listing presents it, or no row at all '
  'for anything else. authenticated only.';

-- ---------------------------------------------------------------------------
-- 3. THE DECISIONS - thin shells over the existing cores.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.approve_my_matching_proposal_forward_v1(p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid)
RETURNS TABLE(outcome text, neutral_outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u uuid := auth.uid();
  here record;
  done record;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_command_id IS NULL OR p_proposal_id IS NULL OR p_expected_view_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  BEGIN
    PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);
    IF NOT EXISTS (SELECT 1 FROM public.matching_proposal_transitions t
                    WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id) THEN
      SELECT * INTO here FROM public.resolve_my_matching_proposal_presentation_v1(p_proposal_id) r;
      IF NOT ('APPROVE_FORWARD' = ANY (here.decision_actions)) THEN
        RAISE EXCEPTION 'MATCHING_PROPOSAL_DECISION_UNAVAILABLE' USING ERRCODE = 'P0002';
      END IF;
    END IF;
    SELECT * INTO done FROM public.approve_matching_proposal_forward_core_v1(p_command_id, p_proposal_id, p_expected_view_id) c;
  EXCEPTION
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      -- The proposal's own revalidation failed: nothing to decide, one answer, no reason. Anything else moved: read again.
      RETURN QUERY SELECT CASE WHEN SQLERRM = 'MATCHING_PROPOSAL_NO_LONGER_VALID' THEN 'UNAVAILABLE' ELSE 'CHANGED' END, NULL::text;
      RETURN;
    WHEN no_data_found OR invalid_parameter_value THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::text; RETURN;
    WHEN object_not_in_prerequisite_state THEN
      RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::text; RETURN;
    WHEN unique_violation THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::text; RETURN;
  END;
  RETURN QUERY SELECT 'RECORDED'::text, done.neutral_outcome;
END$$;

COMMENT ON FUNCTION public.approve_my_matching_proposal_forward_v1(uuid, uuid, uuid) IS
  'S6-04 (D5): the first recipient lets QANDEEL send the other human an independent, private proposal. Not a Mutual '
  'Match and not an Introduction. Over approve_matching_proposal_forward_core_v1, CW2-08 gated (last). '
  'RECORDED | CHANGED | UNAVAILABLE | NOT_AVAILABLE_NOW | COMMAND_CONFLICT. authenticated only.';

CREATE FUNCTION public.decline_my_matching_proposal_v1(p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid)
RETURNS TABLE(outcome text, neutral_outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.matching_proposal_transitions;
  here record;
  done record;
  as_second boolean;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_command_id IS NULL OR p_proposal_id IS NULL OR p_expected_view_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  BEGIN
    PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);
    SELECT * INTO committed FROM public.matching_proposal_transitions t
     WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id;
    IF FOUND THEN
      -- A replay goes to the core that committed it; the core compares the whole request from durable rows.
      as_second := committed.resulting_state = 'SECOND_DECLINED';
    ELSE
      SELECT * INTO here FROM public.resolve_my_matching_proposal_presentation_v1(p_proposal_id) r;
      IF NOT ('DECLINE' = ANY (here.decision_actions)) THEN
        RAISE EXCEPTION 'MATCHING_PROPOSAL_DECISION_UNAVAILABLE' USING ERRCODE = 'P0002';
      END IF;
      as_second := here.recipient_role = 'CANDIDATE';
    END IF;
    IF as_second THEN
      SELECT * INTO done FROM public.decline_matching_proposal_as_second_core_v1(p_command_id, p_proposal_id, p_expected_view_id) c;
    ELSE
      SELECT * INTO done FROM public.decline_matching_proposal_as_first_core_v1(p_command_id, p_proposal_id, p_expected_view_id) c;
    END IF;
  EXCEPTION
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      -- The proposal's own revalidation failed: nothing to decide, one answer, no reason. Anything else moved: read again.
      RETURN QUERY SELECT CASE WHEN SQLERRM = 'MATCHING_PROPOSAL_NO_LONGER_VALID' THEN 'UNAVAILABLE' ELSE 'CHANGED' END, NULL::text;
      RETURN;
    WHEN no_data_found OR invalid_parameter_value THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::text; RETURN;
    WHEN object_not_in_prerequisite_state THEN
      RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::text; RETURN;
    WHEN unique_violation THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::text; RETURN;
  END;
  RETURN QUERY SELECT 'RECORDED'::text, done.neutral_outcome;
END$$;

COMMENT ON FUNCTION public.decline_my_matching_proposal_v1(uuid, uuid, uuid) IS
  'S6-04 (D6, D8): either recipient declines, with no reason. The core is chosen on the server from the caller''s own '
  'current view (first recipient: decline_matching_proposal_as_first_core_v1; second: _as_second_core_v1); the client '
  'never names a role. CW2-08 gated (last). RECORDED | CHANGED | UNAVAILABLE | NOT_AVAILABLE_NOW | COMMAND_CONFLICT.';

CREATE FUNCTION public.withdraw_my_matching_proposal_v1(p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid)
RETURNS TABLE(outcome text, neutral_outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.matching_proposal_transitions;
  here record;
  done record;
  expected_state text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_command_id IS NULL OR p_proposal_id IS NULL OR p_expected_view_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  BEGIN
    PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);
    -- The core binds the exact state it moves out of. The client never supplies one: it is read here, under the lock,
    -- from the proposal itself - or, for a replay of a committed withdrawal, from that durable transition.
    SELECT * INTO committed FROM public.matching_proposal_transitions t
     WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id AND t.resulting_state = 'WITHDRAWN';
    IF FOUND THEN
      expected_state := committed.prior_state;
    ELSE
      SELECT * INTO here FROM public.resolve_my_matching_proposal_presentation_v1(p_proposal_id) r;
      IF NOT ('WITHDRAW' = ANY (here.decision_actions)) THEN
        RAISE EXCEPTION 'MATCHING_PROPOSAL_DECISION_UNAVAILABLE' USING ERRCODE = 'P0002';
      END IF;
      expected_state := here.proposal_state;
    END IF;
    SELECT * INTO done FROM public.withdraw_matching_proposal_core_v1(p_command_id, p_proposal_id, p_expected_view_id, expected_state) c;
  EXCEPTION
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      -- The proposal's own revalidation failed: nothing to decide, one answer, no reason. Anything else moved: read again.
      RETURN QUERY SELECT CASE WHEN SQLERRM = 'MATCHING_PROPOSAL_NO_LONGER_VALID' THEN 'UNAVAILABLE' ELSE 'CHANGED' END, NULL::text;
      RETURN;
    WHEN no_data_found OR invalid_parameter_value THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::text; RETURN;
    WHEN unique_violation THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::text; RETURN;
  END;
  RETURN QUERY SELECT 'RECORDED'::text, done.neutral_outcome;
END$$;

COMMENT ON FUNCTION public.withdraw_my_matching_proposal_v1(uuid, uuid, uuid) IS
  'S6-04 (D7): the first recipient withdraws their forward approval before any Mutual Match, also while the proposal is '
  'with the other human. Ungated, as the core is: launch closure never blocks it. The expected state is read on the '
  'server under the lock. RECORDED | CHANGED | UNAVAILABLE | COMMAND_CONFLICT. authenticated only.';

-- ---------------------------------------------------------------------------
-- 4. OWNERSHIP AND ACL.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  boundary text;
BEGIN
  FOREACH boundary IN ARRAY ARRAY[
    'public.resolve_my_matching_proposal_presentation_v1(uuid)',
    'public.list_my_matching_proposals_v1(uuid,integer)',
    'public.get_my_matching_proposal_v1(uuid)',
    'public.approve_my_matching_proposal_forward_v1(uuid,uuid,uuid)',
    'public.decline_my_matching_proposal_v1(uuid,uuid,uuid)',
    'public.withdraw_my_matching_proposal_v1(uuid,uuid,uuid)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', boundary);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', boundary);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', boundary);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', boundary);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', boundary);
    END IF;
  END LOOP;
END$$;

GRANT EXECUTE ON FUNCTION
  public.list_my_matching_proposals_v1(uuid, integer),
  public.get_my_matching_proposal_v1(uuid),
  public.approve_my_matching_proposal_forward_v1(uuid, uuid, uuid),
  public.decline_my_matching_proposal_v1(uuid, uuid, uuid),
  public.withdraw_my_matching_proposal_v1(uuid, uuid, uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  exposed text[] := ARRAY[
    'public.list_my_matching_proposals_v1(uuid,integer)',
    'public.get_my_matching_proposal_v1(uuid)',
    'public.approve_my_matching_proposal_forward_v1(uuid,uuid,uuid)',
    'public.decline_my_matching_proposal_v1(uuid,uuid,uuid)',
    'public.withdraw_my_matching_proposal_v1(uuid,uuid,uuid)'];
  hidden text[] := ARRAY[
    'public.resolve_my_matching_proposal_presentation_v1(uuid)',
    -- every I-07 human-decision core and projection keeps its 0112 / 0114 / 0120 / 0156 posture
    'public.approve_matching_proposal_forward_core_v1(uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_first_core_v1(uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_second_core_v1(uuid,uuid,uuid)',
    'public.withdraw_matching_proposal_core_v1(uuid,uuid,uuid,text)',
    'public.resolve_my_matching_proposal_v1(uuid)',
    'public.resolve_my_matching_proposal_fields_v1(uuid)',
    'public.enter_matching_proposal_decision_v1(uuid,uuid)',
    'public.resolve_matching_proposal_prerequisites_v1(uuid)'];
  fn text;
  r text;
BEGIN
  FOREACH fn IN ARRAY exposed || hidden LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef
                     AND pg_get_userbyid(p.proowner) = 'postgres' AND p.proconfig @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'S6-04: % must be postgres-owned, SECURITY DEFINER and search_path-pinned', fn;
    END IF;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['anon', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      FOREACH fn IN ARRAY exposed || hidden LOOP
        IF has_function_privilege(r, fn, 'EXECUTE') THEN
          RAISE EXCEPTION 'S6-04: % must not execute %', r, fn;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    FOREACH fn IN ARRAY exposed LOOP
      IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-04: authenticated must execute %', fn;
      END IF;
    END LOOP;
    FOREACH fn IN ARRAY hidden LOOP
      IF has_function_privilege('authenticated', fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-04: authenticated must not execute %', fn;
      END IF;
    END LOOP;
  END IF;
  FOREACH fn IN ARRAY exposed || ARRAY['public.resolve_my_matching_proposal_presentation_v1(uuid)'] LOOP
    IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure
                 AND p.prosrc ~* '(first_name|permitted_text|disclosed_value|private_reason_code|subject_user_id|_fields_v1)') THEN
      RAISE EXCEPTION 'S6-04: % reads no name, conclusion, field, reason or counterparty identity', fn;
    END IF;
  END LOOP;
END$$;

COMMIT;
