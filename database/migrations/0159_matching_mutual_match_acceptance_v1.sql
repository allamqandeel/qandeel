-- S6-05 - Mutual Match acceptance by the second recipient v1 (CP2: Mutual Match Secure Integration).
--
-- Product authority: the Product Owner's S6-05 Task Contract v1.0 and its decisions D1-D7, the CP0 rulings R-1 ... R-8
-- and the CP2 authorization (2026-10-15). The execution record is docs/e2e/QANDEEL_S6_05_IMPLEMENTATION_RECORD_v1.md.
-- This migration is that task's CP2 database part, and nothing more.
--
-- The one transaction that births a Mutual Match, its Shared World and its Introduction already exists and is frozen:
-- commit_matching_mutual_match_v1 (0114). It takes twelve identities, derives the accepting human from auth.uid(), and
-- is executable by no application role. S6-04 (0158) left acceptance to S6-05. This migration adds exactly ONE thin
-- authenticated shell over that core, and teaches the S6-04 presentation helper to offer acceptance. No acceptance rule,
-- no Match rule and no birth is re-implemented here, and 0114 is byte-unchanged.
--
-- ## What is added / changed
--
--   accept_my_matching_proposal_v1(command, proposal, expected view)   NEW, authenticated only
--       The second recipient's acceptance. The client supplies its command id, the proposal and the exact view it saw,
--       and nothing else: no human, no counterpart, no World, no internal identity. The nine remaining identities the
--       core needs are DERIVED here, deterministically, from (the human, the proposal, the command): an equivalent retry
--       derives the same nine and the core answers it from its committed row; the same command id naming a different
--       request is refused by the core's own whole-request comparison.
--
--   resolve_my_matching_proposal_presentation_v1(proposal)               REDEFINED (CREATE OR REPLACE), still private
--       The second recipient awaiting a decision is offered ACCEPT beside DECLINE. ACCEPT is consequential, so - exactly
--       like APPROVE_FORWARD and DECLINE - it is presented only when the CW2-08 seam answers CLEARED. It answers
--       NOT_EVALUATED in production, so nobody is shown ACCEPT and the core refuses it (Stage 9 stays closed).
--
-- ## The derivation
--
--   id(slot) = uuid( sha256( 'QANDEEL_S6_05_MUTUAL_MATCH_IDENTITY_V1' \n slot \n human \n proposal \n command ) )
--
-- for the nine slots WORLD, INTRODUCTION_RECORD, FIRST_RECIPIENT_EPISODE, CANDIDATE_EPISODE, FIRST_RECIPIENT_CLAIM,
-- CANDIDATE_CLAIM, FIRST_RECIPIENT_PAUSE, CANDIDATE_PAUSE, HANDOFF_PACKAGE_VERSION, with the version and variant
-- nibbles set exactly as the S6-02 END boundary does (0155). Nothing is stored for it: the core's commit row binds all
-- twelve identities, which is what makes a replay answer the original commit and nothing else.
--
-- ## Order, idempotency and refusals (the S6-04 shape, over the 0114 core)
--
-- Refuses an anonymous caller (42501) and a missing argument (22023); enters through enter_matching_proposal_decision_v1
-- (the bounded not-found from immutable membership BEFORE any lock, then the canonical two-human lock); a command id
-- this proposal already committed as the Mutual Match goes straight to the core, which answers it from durable rows; a
-- command id this proposal already used for another act is a conflict; otherwise ACCEPT must be a decision the
-- presentation helper offers under that lock (the deadline and the proposal's own revalidation decided there, so what
-- is read and what is accepted never disagree); and then the core runs its whole frozen revalidation, CW2-08 LAST, and
-- decides its deadline at the one birth instant. A command id that already names a transition of any other proposal, or
-- another act on this one, is the caller's conflict. A replay takes the pair lock before the core answers it (the core
-- itself would answer before any lock): it waits behind pair work in progress and changes nothing. Every refusal is one fixed word and rolls back everything the attempt
-- touched, the lock row included:
--
--   MATCHED           the core committed the Match (or a replay of that commit): the answer carries the born World's
--                     identity, the one place the accepting human enters it from (D2)
--   CHANGED           the exact view or the proposal moved underneath the caller (stale view / stale state): read again
--   UNAVAILABLE       nothing to accept: not theirs, not offered to them, no longer live, past its deadline, no longer
--                     valid, not committable now, or an identity collision - one answer, so it reveals none of those
--                     reasons; the reads already present each as NO_LONGER_AVAILABLE or as no row
--   NOT_AVAILABLE_NOW the CW2-08 seam did not answer CLEARED
--   COMMAND_CONFLICT  this command id already names a different request
--
-- The core's 40001 is absorbed here and never sent to PostgREST, which re-runs a 40001 transaction without bound before
-- v16 (PROD-RETRY-01, QAN-BL-PROD-06); the handler names PT409 too, so it is no CATCH_TRAP. A real 40P01 is not converted
-- (the existing retry contract): the whole attempt rolls back and a re-run derives the same identities. A contradictory
-- durable state (P0001) is not repaired and not absorbed.
--
-- ## What is deliberately NOT here
--
-- No change to 0113 / 0114 / 0155 or any I-07 core, seam, policy or privilege; no forward producer (QAN-BL-MATCH-06,
-- S6-07); no Introduction read, message, END client or closed history (S6-05 CP3 / CP4); no Activity or notification
-- (S6-07); no name, conclusion or field presentation; no Matching Context Grant transfer. Forward-only. Migrations
-- 0001-0158 are byte-unchanged.
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE ONE PRESENTATION ANSWER, now offering acceptance (private; executable by nobody).
--
--    Byte-for-byte the 0158 helper, except one branch: the second recipient awaiting a decision (the frozen neutral
--    projection answers AWAITING_YOU to the candidate only in FORWARDED_TO_SECOND) is offered ACCEPT and DECLINE, and
--    ACCEPT joins the consequential decisions that are presented only when the CW2-08 seam answers CLEARED.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_my_matching_proposal_presentation_v1(p_proposal_id uuid)
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
    -- S6-05: the second recipient's acceptance is the atomic Mutual Match commit (accept_my_matching_proposal_v1).
    actions := ARRAY['ACCEPT', 'DECLINE'];
  ELSIF outcome = 'IN_PROGRESS' AND role_of = 'FIRST_RECIPIENT'
        AND proposal.proposal_state IN ('FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND') THEN
    actions := ARRAY['WITHDRAW'];
  END IF;

  RETURN QUERY SELECT mine.recipient_view_id, outcome, actions,
    CASE WHEN actions && ARRAY['APPROVE_FORWARD', 'DECLINE', 'ACCEPT'] THEN
      (SELECT CASE WHEN g.clearance = 'CLEARED' THEN actions
                   ELSE array_remove(array_remove(array_remove(actions, 'APPROVE_FORWARD'), 'DECLINE'), 'ACCEPT') END
         FROM public.resolve_matching_proposal_prerequisites_v1(p_proposal_id) g)
    ELSE actions END,
    role_of, proposal.proposal_state;
END$$;

COMMENT ON FUNCTION public.resolve_my_matching_proposal_presentation_v1(uuid) IS
  'S6-04, extended by S6-05: the frozen neutral projection of the caller''s own current view plus the decisions this '
  'human may take now (decision_actions: whatever the launch seam says; presented_actions: what may be shown). The '
  'second recipient awaiting a decision is offered ACCEPT and DECLINE; ACCEPT, APPROVE_FORWARD and DECLINE are presented '
  'only when the CW2-08 seam answers CLEARED. A live proposal past its deadline, or failing its own revalidation, reads '
  'NO_LONGER_AVAILABLE and offers nothing. Private: executable by nobody; role and state never leave the boundaries.';

-- ---------------------------------------------------------------------------
-- 2. THE ACCEPTANCE - a thin shell over the frozen 0114 Mutual Match core.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.accept_my_matching_proposal_v1(p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid)
RETURNS TABLE(outcome text, introduction_world_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.matching_proposal_transitions;
  here record;
  ids uuid[];
  done record;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_command_id IS NULL OR p_proposal_id IS NULL OR p_expected_view_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  -- The nine identities the core binds besides the three the client supplies, derived from (human, proposal, command)
  -- and nothing else, in the core's parameter order. An equivalent retry derives exactly these again.
  SELECT array_agg((substr(d.h, 1, 12) || '4' || substr(d.h, 14, 3) || '8' || substr(d.h, 18, 3) || substr(d.h, 21, 12))::uuid
                   ORDER BY d.n)
    INTO ids
    FROM (SELECT s.n, encode(sha256(convert_to('QANDEEL_S6_05_MUTUAL_MATCH_IDENTITY_V1' || E'\n' || s.slot || E'\n'
                   || lower(u::text) || E'\n' || lower(p_proposal_id::text) || E'\n' || lower(p_command_id::text), 'UTF8')), 'hex') AS h
            FROM unnest(ARRAY['WORLD', 'INTRODUCTION_RECORD', 'FIRST_RECIPIENT_EPISODE', 'CANDIDATE_EPISODE',
                              'FIRST_RECIPIENT_CLAIM', 'CANDIDATE_CLAIM', 'FIRST_RECIPIENT_PAUSE', 'CANDIDATE_PAUSE',
                              'HANDOFF_PACKAGE_VERSION']) WITH ORDINALITY AS s(slot, n)) d;
  BEGIN
    PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);
    SELECT * INTO committed FROM public.matching_proposal_transitions t WHERE t.id = p_command_id;
    IF FOUND AND (committed.proposal_id <> p_proposal_id OR committed.resulting_state <> 'MUTUAL_MATCH_COMMITTED') THEN
      -- This command id already decided something else, on this proposal or another one: the caller's own conflict,
      -- answered before the core could only report it as a colliding identity.
      RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE = '23505';
    ELSIF NOT FOUND THEN
      SELECT * INTO here FROM public.resolve_my_matching_proposal_presentation_v1(p_proposal_id) r;
      IF NOT ('ACCEPT' = ANY (here.decision_actions)) THEN
        RAISE EXCEPTION 'MATCHING_PROPOSAL_DECISION_UNAVAILABLE' USING ERRCODE = 'P0002';
      END IF;
    END IF;
    -- A replay of the committed Match, or an offered acceptance: the core decides, under its own frozen order.
    SELECT * INTO done FROM public.commit_matching_mutual_match_v1(
      p_command_id, p_proposal_id, p_expected_view_id,
      ids[1], ids[2], ids[3], ids[4], ids[5], ids[6], ids[7], ids[8], ids[9]) c;
  EXCEPTION
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      -- The exact view or the proposal moved: read again. Anything else the core refuses as one class
      -- (MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE): nothing to accept, one answer, no reason.
      RETURN QUERY SELECT CASE WHEN SQLERRM IN ('MATCHING_RECIPIENT_VIEW_STALE', 'MATCHING_STALE_STATE') THEN 'CHANGED'
                               ELSE 'UNAVAILABLE' END, NULL::uuid;
      RETURN;
    WHEN no_data_found OR invalid_parameter_value THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid; RETURN;
    WHEN object_not_in_prerequisite_state THEN
      -- The launch seam closed is NOT_AVAILABLE_NOW; a deadline crossed at the birth instant is one more ending.
      RETURN QUERY SELECT CASE WHEN SQLERRM = 'MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED' THEN 'NOT_AVAILABLE_NOW'
                               ELSE 'UNAVAILABLE' END, NULL::uuid;
      RETURN;
    WHEN unique_violation THEN
      -- A reused command id is the caller's own conflict; any other collision names nothing and is no answer.
      RETURN QUERY SELECT CASE WHEN SQLERRM = 'MATCHING_COMMAND_ID_CONFLICT' THEN 'COMMAND_CONFLICT'
                               ELSE 'UNAVAILABLE' END, NULL::uuid;
      RETURN;
  END;
  RETURN QUERY SELECT 'MATCHED'::text, done.born_world_id;
END$$;

COMMENT ON FUNCTION public.accept_my_matching_proposal_v1(uuid, uuid, uuid) IS
  'S6-05 (D2): the second recipient accepts their own proposal, and the frozen 0114 core commits the Mutual Match, the '
  'ACTIVE / INTRODUCTION Shared World and the Introduction atomically, or nothing. The human is auth.uid(); the client '
  'supplies a command id, the proposal and the exact view only; the nine other identities are derived on the server. '
  'CW2-08 gated (last, in the core). MATCHED (+ the World) | CHANGED | UNAVAILABLE | NOT_AVAILABLE_NOW | '
  'COMMAND_CONFLICT. authenticated only.';

-- ---------------------------------------------------------------------------
-- 3. OWNERSHIP AND ACL. CREATE OR REPLACE keeps an ACL, so the redefined helper is revoked again explicitly.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  boundary text;
BEGIN
  FOREACH boundary IN ARRAY ARRAY[
    'public.resolve_my_matching_proposal_presentation_v1(uuid)',
    'public.accept_my_matching_proposal_v1(uuid,uuid,uuid)'] LOOP
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

GRANT EXECUTE ON FUNCTION public.accept_my_matching_proposal_v1(uuid, uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  boundary text := 'public.accept_my_matching_proposal_v1(uuid,uuid,uuid)';
  hidden text[] := ARRAY[
    'public.resolve_my_matching_proposal_presentation_v1(uuid)',
    -- the frozen Mutual Match core and every I-07 decision core and projection keep their posture
    'public.commit_matching_mutual_match_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid)',
    'public.approve_matching_proposal_forward_core_v1(uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_first_core_v1(uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_second_core_v1(uuid,uuid,uuid)',
    'public.withdraw_matching_proposal_core_v1(uuid,uuid,uuid,text)',
    'public.forward_matching_proposal_to_second_core_v1(uuid,uuid,uuid,uuid)',
    'public.resolve_my_matching_proposal_v1(uuid)',
    'public.resolve_my_matching_proposal_fields_v1(uuid)',
    'public.enter_matching_proposal_decision_v1(uuid,uuid)',
    'public.resolve_matching_proposal_prerequisites_v1(uuid)'];
  fn text;
  r text;
  src text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[boundary] || hidden LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef
                     AND pg_get_userbyid(p.proowner) = 'postgres' AND p.proconfig @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'S6-05: % must be postgres-owned, SECURITY DEFINER and search_path-pinned', fn;
    END IF;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['anon', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      FOREACH fn IN ARRAY ARRAY[boundary] || hidden LOOP
        IF has_function_privilege(r, fn, 'EXECUTE') THEN
          RAISE EXCEPTION 'S6-05: % must not execute %', r, fn;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    IF NOT has_function_privilege('authenticated', boundary, 'EXECUTE') THEN
      RAISE EXCEPTION 'S6-05: authenticated must execute %', boundary;
    END IF;
    FOREACH fn IN ARRAY hidden LOOP
      IF has_function_privilege('authenticated', fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-05: authenticated must not execute %', fn;
      END IF;
    END LOOP;
  END IF;
  -- The acceptance is a shell: it calls the frozen core exactly once, writes nothing itself, reads no name, conclusion,
  -- field, reason or counterpart identity, and takes no identity beyond the command, the proposal and the view.
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO src FROM pg_proc p WHERE p.oid = boundary::regprocedure;
  IF (length(src) - length(replace(src, 'public.commit_matching_mutual_match_v1(', ''))) / length('public.commit_matching_mutual_match_v1(') <> 1 THEN
    RAISE EXCEPTION 'S6-05: % must call the frozen Mutual Match core exactly once', boundary;
  END IF;
  IF src ~* '(INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|EXECUTE\s|RAISE;|ISOLATION|_core_v1\()' THEN
    RAISE EXCEPTION 'S6-05: % writes nothing itself, runs no dynamic SQL, re-raises nothing and names no other core', boundary;
  END IF;
  IF src ~* '(first_name|permitted_text|disclosed_value|private_reason_code|subject_user_id|_fields_v1|first_recipient_user_id|candidate_user_id)' THEN
    RAISE EXCEPTION 'S6-05: % reads no name, conclusion, field, reason or counterpart identity', boundary;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = boundary::regprocedure
                   AND p.proargnames[1:3] = ARRAY['p_command_id', 'p_proposal_id', 'p_expected_view_id'] AND p.pronargs = 3) THEN
    RAISE EXCEPTION 'S6-05: % takes exactly a command, a proposal and a view', boundary;
  END IF;
  IF src !~ 'WHEN SQLSTATE ''40001'' OR SQLSTATE ''PT409'' THEN' THEN
    RAISE EXCEPTION 'S6-05: % absorbs the core''s 40001 and names PT409 (PROD-RETRY-01)', boundary;
  END IF;
END$$;

COMMIT;
