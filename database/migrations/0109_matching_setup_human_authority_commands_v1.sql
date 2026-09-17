-- I-07A - Matching setup human authority commands and private self-inspection v1.
--
-- Migration 0108 created the private Matching substrate and deliberately left it
-- with no legitimate mutation boundary at all. This forward-only migration
-- creates exactly that boundary and nothing else: the narrow set of commands by
-- which ONE authenticated human controls their own Matching setup, plus one
-- self-inspection projection that can only ever answer about its own caller.
--
-- ## Human self-authority (CW2-01 section 7 / A3, CW2-06)
--
-- Every command derives its human from auth.uid() and accepts NO actor, grantor,
-- owner, participant, target, status, state, pause reason, event type, purpose,
-- source or timestamp parameter. EXECUTE is granted to `authenticated` and to
-- nothing else. PUBLIC, anon AND service_role cannot execute any of them: the
-- server may facilitate the experience later, but possession of the service-role
-- credential must never be able to manufacture, widen or withdraw a human's
-- Matching participation or consent. QANDEEL is not a consent principal here and
-- there is deliberately no server-side "act as user" Matching command.
--
-- ## The commands
--
--   participation   activate_matching_participation_v1
--                   pause_matching_participation_v1
--                   resume_matching_participation_v1
--                   turn_off_matching_participation_v1
--   context grant   grant_matching_context_v1
--                   revoke_matching_context_v1
--   profile         set_introduction_profile_v1
--   requirements    set_matching_requirements_v1
--   disclosure      grant_pre_match_disclosure_authority_v1
--                   revoke_pre_match_disclosure_authority_v1
--   self-inspection get_my_matching_setup_v1
--
-- FOUR participation commands rather than one command with a kind parameter.
-- The act is fixed by FUNCTION IDENTITY exactly as the grant semantics are fixed
-- by table identity: a caller cannot spell an act, cannot spell a pause reason,
-- and cannot reach the resume path by asking an activate command for it. That is
-- what makes the I-07C / I-07D safety rule below structural.
--
-- ## Fail-closed participation law (task I-07A section 5.1)
--
-- Absence of a current pointer IS OFF. Nothing infers ACTIVE from a profile, a
-- requirement set, a Matching Context Grant, a disclosure authority or a
-- conversation, and no command reads any of those to decide participation.
--
-- Activation is an explicit human act carrying one of the two frozen entry
-- channels as PROVENANCE. An offer, prompt or suggestion from QANDEEL is not an
-- activation and has no representation.
--
-- Pause writes PAUSED / USER_PAUSED and nothing else, because the pause reason
-- is fixed by the function's identity. The other four CW2-06 pause reasons -
-- ACTIVE_INTRODUCTION, POST_INTRODUCTION, POST_SUCCESS, SYSTEM_POLICY - remain
-- representable in 0108 and have NO producer in I-07A.
--
-- ## Why the I-07A resume path cannot bypass a later gate (task section 12.10)
--
-- Two rules, and they close the loop together:
--
--   1. The resume command resumes PAUSED / USER_PAUSED and refuses every other
--      pause reason with a bounded MATCHING_PAUSE_NOT_USER_RESUMABLE. An
--      ACTIVE_INTRODUCTION, POST_INTRODUCTION, POST_SUCCESS or SYSTEM_POLICY
--      pause is I-07D's revalidation work and stays fail-closed here.
--
--   2. Activation is not a way around rule 1. Activation requires the current
--      state to be OFF, so it can never be applied to a pause directly. And an
--      OFF that was reached FROM a pause I-07A may not resume is refused with
--      MATCHING_REACTIVATION_REQUIRES_REVALIDATION - because the obvious bypass
--      is two steps, not one: turn off while system-paused, then activate as
--      though nothing had happened. The check is exactly one hop along the
--      immutable act chain, and one hop is the whole of it: the only way a human
--      reaches OFF from a pause is that single TURN_OFF act, and the chain cannot
--      fork because at most one act may supersede any act.
--
-- Turning participation off is never blocked - opting out is the human's own
-- privacy authority and must work from any state, including a pause I-07A cannot
-- resume. It simply does not launder the pause.
--
-- ## Independence of the three authorities (task section 4)
--
-- Turning participation OFF or pausing revokes NOTHING: no participation command
-- reads or writes a grant, a profile, a requirement version or a disclosure
-- authority. Revocation of a Matching Context Grant or a disclosure authority
-- reads NO participation state, so it works while participation is OFF or
-- PAUSED - withdrawing one's own private context can never be gated on still
-- participating. Holding a grant creates no participation, and participating
-- creates no grant. Whether a grant is EFFECTIVE for future candidate work is
-- gated by participation LATER, in I-07B; authority history stays separate here.
--
-- ## Durability law (task section 6)
--
--   * durable command identity: the command id IS the primary key of the row the
--     command commits - a participation act, a consent event, a profile version,
--     a requirement version, a disclosure authority event. There is no second
--     idempotency table and no idempotency key that can drift from the result;
--   * an equivalent retry returns the ALREADY COMMITTED result, read back from
--     the committed row rather than echoed from the retry's own arguments;
--   * the same command id carrying a DIFFERENT request fails closed with
--     23505 MATCHING_COMMAND_ID_CONFLICT. The comparison covers the WHOLE
--     immutable request - the human, every identity the command binds, the exact
--     expected predecessor and the exact committed field or key SET, order
--     ignored - so no part of a request can be changed under a reused id;
--   * compare-and-swap: every consequential command names the exact current
--     identity it expects. Any other current state is a bounded 40001
--     MATCHING_STALE_STATE and nothing is ever applied to "whatever is current";
--   * every committed instant is CURRENT_TIMESTAMP from the database clock;
--   * the canonical serialization point is a durable row, never an advisory lock
--     and never a process-local mutex.
--
-- ## Lock order
--
-- Every command takes the caller's OWN row in public.matching_setup_locks FOR
-- UPDATE first, through the same upsert-and-lock statement, before any state is
-- read, compared or changed. Only one command reaches a second durable family:
--
--   matching_setup_locks                 FOR UPDATE   (the caller's own row)
--     -> introduction_profile_state      FOR SHARE    (disclosure grant only)
--        introduction_profile_versions   FOR SHARE    (disclosure grant only)
--     -> the family the command owns     FOR UPDATE
--
-- A command only ever touches rows of ONE human - its own auth.uid() - so two
-- humans can never contend, and two commands of the same human are serialized by
-- that human's lock row before they can reach anything else. There is no cycle
-- to deadlock on.
--
-- ## No oracle (task section 5.6)
--
-- No command takes a human identifier, so a caller cannot even phrase a question
-- about someone else. The self-inspection projection takes NO parameter at all.
-- Cross-human failures are indistinguishable from nonexistence: a grant,
-- authority or version that is not the caller's own is reported as not found
-- through the same bounded error as one that never existed, so an error can
-- never disclose another human's Matching state. There is no list-all-users, no
-- list-all-profiles, no candidate search and no existence probe of any kind.
--
-- ## What is deliberately NOT here
--
-- No candidate discovery or selection, no pair evaluation, no PAIR_KEY, no
-- eligibility snapshot, no PASS | FAIL | UNKNOWN evaluation, no Safe
-- Compatibility Conclusion, no Sensitive Conclusion Filter, no Matching Proposal
-- Disclosure Gate, no proposal object, cadence, limit or recipient view (I-07B);
-- no Introduction slot, match commit, Mutual Match, two-human acceptance or
-- Shared World birth (I-07C); no progressive Introduction disclosure, no
-- Introduction success transition, no slot release and no post-Introduction
-- resume revalidation (I-07D); no mobile surface, no safety, report or block, no
-- entitlement, flag or pricing, and no ranking, score or compatibility
-- percentage anywhere. No private MY_WORLD material is read or copied: this
-- migration creates authority, not the later candidate-evaluation context
-- resolver, and the I-07B server-side seam is a boundary a later reviewed
-- migration ADDS over this sealed state rather than one opened here.
--
-- Migrations 0001-0108 are untouched. The I-02B / I-03B / I-03C Shared Standing
-- Context runtime is neither read, widened nor generalized: Matching has its own
-- capability-scoped family and no Shared grant table appears in any body below.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. PARTICIPATION - activate.
--
--    Requires the human's current participation to be OFF (or absent). It is not
--    a resume: a paused human is refused, and an OFF reached from a pause this
--    task may not resume is refused too.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.activate_matching_participation_v1(
  p_command_id uuid, p_entry_channel text, p_expected_current_event_id uuid DEFAULT NULL
) RETURNS TABLE(participation_event_id uuid, participation_act text, participation_state text,
                pause_reason text, superseded_event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.matching_participation_events;
  current_id uuid;
  current_act public.matching_participation_events;
  prior_act public.matching_participation_events;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_entry_channel IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- The two frozen entry channels are activation provenance. An offer, prompt or
  -- suggestion from QANDEEL is not one of them and cannot be spelled.
  IF p_entry_channel NOT IN ('CONVERSATIONAL_ENTRY', 'MANUAL_MY_WORLD_ENTRY') THEN
    RAISE EXCEPTION 'MATCHING_ENTRY_CHANNEL_INVALID' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.matching_participation_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.participant_user_id = u AND committed.participation_act = 'ACTIVATE'
       AND committed.activation_entry_channel = p_entry_channel
       AND committed.prior_event_id IS NOT DISTINCT FROM p_expected_current_event_id THEN
      RETURN QUERY SELECT committed.id, committed.participation_act, committed.resulting_state,
                          committed.resulting_pause_reason, committed.prior_event_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT s.current_event_id INTO current_id
    FROM public.matching_participation_state s WHERE s.participant_user_id = u FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_event_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001';
  END IF;

  IF current_id IS NOT NULL THEN
    SELECT * INTO current_act FROM public.matching_participation_events e WHERE e.id = current_id;
    IF current_act.resulting_state = 'ACTIVE' THEN
      RAISE EXCEPTION 'MATCHING_PARTICIPATION_ALREADY_ACTIVE' USING ERRCODE='55000';
    END IF;
    IF current_act.resulting_state = 'PAUSED' THEN
      IF current_act.resulting_pause_reason = 'USER_PAUSED' THEN
        RAISE EXCEPTION 'MATCHING_PARTICIPATION_PAUSED' USING ERRCODE='55000',
          DETAIL='A paused human resumes through the resume command, which is the only path that decides whether this pause may be lifted.';
      END IF;
      RAISE EXCEPTION 'MATCHING_PAUSE_NOT_USER_RESUMABLE' USING ERRCODE='55000',
        DETAIL='This pause requires later revalidation that I-07A does not implement, so it fails closed here.';
    END IF;
    -- The current state is OFF. One hop back along the immutable chain: an OFF
    -- reached FROM a pause this task may not resume is not a clean slate, and
    -- activating over it would be that pause lifted in two steps.
    IF current_act.prior_event_id IS NOT NULL THEN
      SELECT * INTO prior_act FROM public.matching_participation_events e WHERE e.id = current_act.prior_event_id;
      IF prior_act.resulting_state = 'PAUSED' AND prior_act.resulting_pause_reason <> 'USER_PAUSED' THEN
        RAISE EXCEPTION 'MATCHING_REACTIVATION_REQUIRES_REVALIDATION' USING ERRCODE='55000',
          DETAIL='Turning participation off never lifts a pause that requires later revalidation; reactivation after one is not an I-07A decision.';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.matching_participation_events
    (id, participant_user_id, participation_act, resulting_state, resulting_pause_reason,
     activation_entry_channel, prior_event_id)
  VALUES (p_command_id, u, 'ACTIVATE', 'ACTIVE', NULL, p_entry_channel, p_expected_current_event_id);

  IF p_expected_current_event_id IS NULL THEN
    INSERT INTO public.matching_participation_state (participant_user_id, current_event_id)
    VALUES (u, p_command_id);
  ELSE
    UPDATE public.matching_participation_state s
       SET current_event_id = p_command_id, updated_at = CURRENT_TIMESTAMP
     WHERE s.participant_user_id = u AND s.current_event_id = p_expected_current_event_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;
  END IF;

  RETURN QUERY SELECT p_command_id, 'ACTIVATE'::text, 'ACTIVE'::text, NULL::text, p_expected_current_event_id;
END$$;

-- ---------------------------------------------------------------------------
-- 2. PARTICIPATION - pause. The reason is USER_PAUSED because this function is
--    the user pause; there is no reason parameter to widen.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.pause_matching_participation_v1(
  p_command_id uuid, p_expected_current_event_id uuid
) RETURNS TABLE(participation_event_id uuid, participation_act text, participation_state text,
                pause_reason text, superseded_event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.matching_participation_events;
  current_id uuid;
  current_act public.matching_participation_events;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_expected_current_event_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.matching_participation_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.participant_user_id = u AND committed.participation_act = 'PAUSE'
       AND committed.prior_event_id IS NOT DISTINCT FROM p_expected_current_event_id THEN
      RETURN QUERY SELECT committed.id, committed.participation_act, committed.resulting_state,
                          committed.resulting_pause_reason, committed.prior_event_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT s.current_event_id INTO current_id
    FROM public.matching_participation_state s WHERE s.participant_user_id = u FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_event_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001';
  END IF;
  SELECT * INTO current_act FROM public.matching_participation_events e WHERE e.id = current_id;
  IF current_act.resulting_state <> 'ACTIVE' THEN
    RAISE EXCEPTION 'MATCHING_PARTICIPATION_NOT_ACTIVE' USING ERRCODE='55000';
  END IF;

  INSERT INTO public.matching_participation_events
    (id, participant_user_id, participation_act, resulting_state, resulting_pause_reason,
     activation_entry_channel, prior_event_id)
  VALUES (p_command_id, u, 'PAUSE', 'PAUSED', 'USER_PAUSED', NULL, p_expected_current_event_id);

  UPDATE public.matching_participation_state s
     SET current_event_id = p_command_id, updated_at = CURRENT_TIMESTAMP
   WHERE s.participant_user_id = u AND s.current_event_id = p_expected_current_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;

  RETURN QUERY SELECT p_command_id, 'PAUSE'::text, 'PAUSED'::text, 'USER_PAUSED'::text, p_expected_current_event_id;
END$$;

-- ---------------------------------------------------------------------------
-- 3. PARTICIPATION - resume. USER_PAUSED only, for the whole of I-07A.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resume_matching_participation_v1(
  p_command_id uuid, p_expected_current_event_id uuid
) RETURNS TABLE(participation_event_id uuid, participation_act text, participation_state text,
                pause_reason text, superseded_event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.matching_participation_events;
  current_id uuid;
  current_act public.matching_participation_events;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_expected_current_event_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.matching_participation_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.participant_user_id = u AND committed.participation_act = 'RESUME'
       AND committed.prior_event_id IS NOT DISTINCT FROM p_expected_current_event_id THEN
      RETURN QUERY SELECT committed.id, committed.participation_act, committed.resulting_state,
                          committed.resulting_pause_reason, committed.prior_event_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT s.current_event_id INTO current_id
    FROM public.matching_participation_state s WHERE s.participant_user_id = u FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_event_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001';
  END IF;
  SELECT * INTO current_act FROM public.matching_participation_events e WHERE e.id = current_id;
  IF current_act.resulting_state <> 'PAUSED' THEN
    RAISE EXCEPTION 'MATCHING_PARTICIPATION_NOT_PAUSED' USING ERRCODE='55000';
  END IF;
  -- THE I-07A RESUME CEILING. ACTIVE_INTRODUCTION, POST_INTRODUCTION,
  -- POST_SUCCESS and SYSTEM_POLICY each require revalidation that belongs to
  -- I-07C / I-07D, so this path refuses all four rather than guessing.
  IF current_act.resulting_pause_reason <> 'USER_PAUSED' THEN
    RAISE EXCEPTION 'MATCHING_PAUSE_NOT_USER_RESUMABLE' USING ERRCODE='55000',
      DETAIL='Only a pause the human themselves created is resumable in I-07A. Every other pause reason requires later revalidation and stays fail-closed.';
  END IF;

  INSERT INTO public.matching_participation_events
    (id, participant_user_id, participation_act, resulting_state, resulting_pause_reason,
     activation_entry_channel, prior_event_id)
  VALUES (p_command_id, u, 'RESUME', 'ACTIVE', NULL, NULL, p_expected_current_event_id);

  UPDATE public.matching_participation_state s
     SET current_event_id = p_command_id, updated_at = CURRENT_TIMESTAMP
   WHERE s.participant_user_id = u AND s.current_event_id = p_expected_current_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;

  RETURN QUERY SELECT p_command_id, 'RESUME'::text, 'ACTIVE'::text, NULL::text, p_expected_current_event_id;
END$$;

-- ---------------------------------------------------------------------------
-- 4. PARTICIPATION - turn off. Opting out is the human's own privacy authority
--    and works from ACTIVE and from every pause, including the four this task
--    may not resume. It revokes no grant and no disclosure authority.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.turn_off_matching_participation_v1(
  p_command_id uuid, p_expected_current_event_id uuid
) RETURNS TABLE(participation_event_id uuid, participation_act text, participation_state text,
                pause_reason text, superseded_event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.matching_participation_events;
  current_id uuid;
  current_act public.matching_participation_events;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_expected_current_event_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.matching_participation_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.participant_user_id = u AND committed.participation_act = 'TURN_OFF'
       AND committed.prior_event_id IS NOT DISTINCT FROM p_expected_current_event_id THEN
      RETURN QUERY SELECT committed.id, committed.participation_act, committed.resulting_state,
                          committed.resulting_pause_reason, committed.prior_event_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT s.current_event_id INTO current_id
    FROM public.matching_participation_state s WHERE s.participant_user_id = u FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_event_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001';
  END IF;
  SELECT * INTO current_act FROM public.matching_participation_events e WHERE e.id = current_id;
  IF current_act.resulting_state = 'OFF' THEN
    RAISE EXCEPTION 'MATCHING_PARTICIPATION_ALREADY_OFF' USING ERRCODE='55000';
  END IF;

  INSERT INTO public.matching_participation_events
    (id, participant_user_id, participation_act, resulting_state, resulting_pause_reason,
     activation_entry_channel, prior_event_id)
  VALUES (p_command_id, u, 'TURN_OFF', 'OFF', NULL, NULL, p_expected_current_event_id);

  UPDATE public.matching_participation_state s
     SET current_event_id = p_command_id, updated_at = CURRENT_TIMESTAMP
   WHERE s.participant_user_id = u AND s.current_event_id = p_expected_current_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;

  RETURN QUERY SELECT p_command_id, 'TURN_OFF'::text, 'OFF'::text, NULL::text, p_expected_current_event_id;
END$$;

-- ---------------------------------------------------------------------------
-- 5. MATCHING CONTEXT GRANT - first grant or explicit reconfirmation.
--
--    It reads NO participation state: a grant is not participation, and asking
--    would make one authority depend on the other.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.grant_matching_context_v1(
  p_command_id uuid, p_new_grant_id uuid, p_expected_active_grant_id uuid DEFAULT NULL
) RETURNS TABLE(consent_event_id uuid, consent_event_type text, matching_context_grant_id uuid,
                superseded_grant_id uuid, grant_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.matching_context_consent_events;
  intended_event_type text;
  current_active_id uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_new_grant_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_expected_active_grant_id IS NOT NULL AND p_expected_active_grant_id = p_new_grant_id THEN
    RAISE EXCEPTION 'MATCHING_GRANT_ID_INVALID' USING ERRCODE='22023';
  END IF;
  intended_event_type := CASE WHEN p_expected_active_grant_id IS NULL THEN 'GRANTED' ELSE 'RECONFIRMED' END;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.matching_context_consent_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.grantor_user_id = u AND committed.event_type = intended_event_type
       AND committed.subject_grant_id = p_new_grant_id
       AND committed.prior_grant_id IS NOT DISTINCT FROM p_expected_active_grant_id THEN
      RETURN QUERY SELECT committed.id, committed.event_type, committed.subject_grant_id,
                          committed.prior_grant_id, 'ACTIVE'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT g.id INTO current_active_id FROM public.matching_context_grants g
   WHERE g.grantor_user_id = u AND g.status = 'ACTIVE' FOR UPDATE;
  IF current_active_id IS DISTINCT FROM p_expected_active_grant_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.matching_context_grants g WHERE g.id = p_new_grant_id) THEN
    RAISE EXCEPTION 'MATCHING_GRANT_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- A reconfirmation revokes the old authority and creates a NEW identity; the
  -- old row and its history stay exactly as they were.
  IF p_expected_active_grant_id IS NOT NULL THEN
    UPDATE public.matching_context_grants g SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP
     WHERE g.id = p_expected_active_grant_id AND g.status = 'ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;
  END IF;
  INSERT INTO public.matching_context_grants (id, grantor_user_id, status)
  VALUES (p_new_grant_id, u, 'ACTIVE');
  INSERT INTO public.matching_context_consent_events
    (id, grantor_user_id, event_type, subject_grant_id, prior_grant_id)
  VALUES (p_command_id, u, intended_event_type, p_new_grant_id, p_expected_active_grant_id);

  RETURN QUERY SELECT p_command_id, intended_event_type, p_new_grant_id, p_expected_active_grant_id, 'ACTIVE'::text;
END$$;

-- ---------------------------------------------------------------------------
-- 6. MATCHING CONTEXT GRANT - revoke. Deliberately reads no participation
--    state, so withdrawal works while participation is OFF or PAUSED.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.revoke_matching_context_v1(
  p_command_id uuid, p_expected_active_grant_id uuid
) RETURNS TABLE(consent_event_id uuid, consent_event_type text, matching_context_grant_id uuid,
                superseded_grant_id uuid, grant_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.matching_context_consent_events;
  target public.matching_context_grants;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_expected_active_grant_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.matching_context_consent_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.grantor_user_id = u AND committed.event_type = 'REVOKED'
       AND committed.subject_grant_id = p_expected_active_grant_id
       AND committed.prior_grant_id IS NULL THEN
      RETURN QUERY SELECT committed.id, committed.event_type, committed.subject_grant_id,
                          committed.prior_grant_id, 'REVOKED'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- Nonexistent and another human's grant collapse into ONE bounded answer, so
  -- an error never discloses another human's Matching consent state.
  SELECT * INTO target FROM public.matching_context_grants g
   WHERE g.id = p_expected_active_grant_id AND g.grantor_user_id = u FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_GRANT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF target.status <> 'ACTIVE' THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;

  UPDATE public.matching_context_grants g SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP
   WHERE g.id = p_expected_active_grant_id AND g.status = 'ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;
  INSERT INTO public.matching_context_consent_events
    (id, grantor_user_id, event_type, subject_grant_id, prior_grant_id)
  VALUES (p_command_id, u, 'REVOKED', p_expected_active_grant_id, NULL);

  RETURN QUERY SELECT p_command_id, 'REVOKED'::text, p_expected_active_grant_id, NULL::uuid, 'REVOKED'::text;
END$$;

-- ---------------------------------------------------------------------------
-- 7. INTRODUCTION PROFILE - create the next immutable version.
--
--    The command id IS the new version identity, so the version row is the
--    durable idempotency record. Field values come from the caller's own arrays
--    and from nowhere else: this body reads no account, conversation, Shared,
--    Public or Replay relation, so no eligibility-critical value can be inferred
--    from a name, a voice, a photo, a language style or a third-party claim.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.set_introduction_profile_v1(
  p_command_id uuid, p_field_keys text[], p_field_values text[],
  p_expected_current_version_id uuid DEFAULT NULL
) RETURNS TABLE(introduction_profile_version_id uuid, superseded_version_id uuid, field_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.introduction_profile_versions;
  distinct_keys text[];
  committed_count integer;
  matched_count integer;
  current_id uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL THEN RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023'; END IF;
  IF p_field_keys IS NULL OR p_field_values IS NULL
     OR array_ndims(p_field_keys) IS DISTINCT FROM 1 OR array_ndims(p_field_values) IS DISTINCT FROM 1
     OR cardinality(p_field_keys) = 0
     OR cardinality(p_field_keys) IS DISTINCT FROM cardinality(p_field_values)
     OR array_position(p_field_keys, NULL::text) IS NOT NULL
     OR array_position(p_field_values, NULL::text) IS NOT NULL THEN
    RAISE EXCEPTION 'MATCHING_FIELD_SET_INVALID' USING ERRCODE='22023';
  END IF;
  -- Set semantics: a duplicate key is rejected, never silently normalized.
  SELECT array_agg(DISTINCT t.k) INTO distinct_keys FROM unnest(p_field_keys) AS t(k);
  IF cardinality(distinct_keys) IS DISTINCT FROM cardinality(p_field_keys) THEN
    RAISE EXCEPTION 'MATCHING_FIELD_KEY_DUPLICATE' USING ERRCODE='22023';
  END IF;
  IF p_expected_current_version_id IS NOT NULL AND p_expected_current_version_id = p_command_id THEN
    RAISE EXCEPTION 'MATCHING_VERSION_ID_INVALID' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.introduction_profile_versions v WHERE v.id = p_command_id;
  IF FOUND THEN
    SELECT count(*) INTO committed_count
      FROM public.introduction_profile_field_values f WHERE f.profile_version_id = p_command_id;
    SELECT count(*) INTO matched_count
      FROM unnest(p_field_keys, p_field_values) AS r(k, v)
      JOIN public.introduction_profile_field_values f
        ON f.profile_version_id = p_command_id AND f.field_key = r.k AND f.field_value = r.v;
    IF committed.owner_user_id = u
       AND committed.prior_profile_version_id IS NOT DISTINCT FROM p_expected_current_version_id
       AND committed_count = cardinality(p_field_keys) AND matched_count = cardinality(p_field_keys) THEN
      RETURN QUERY SELECT committed.id, committed.prior_profile_version_id, committed_count;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT s.current_profile_version_id INTO current_id
    FROM public.introduction_profile_state s WHERE s.owner_user_id = u FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_version_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001';
  END IF;

  INSERT INTO public.introduction_profile_versions (id, owner_user_id, prior_profile_version_id)
  VALUES (p_command_id, u, p_expected_current_version_id);
  INSERT INTO public.introduction_profile_field_values (profile_version_id, field_key, field_value)
  SELECT p_command_id, r.k, r.v FROM unnest(p_field_keys, p_field_values) AS r(k, v);

  IF p_expected_current_version_id IS NULL THEN
    INSERT INTO public.introduction_profile_state (owner_user_id, current_profile_version_id)
    VALUES (u, p_command_id);
  ELSE
    UPDATE public.introduction_profile_state s
       SET current_profile_version_id = p_command_id, updated_at = CURRENT_TIMESTAMP
     WHERE s.owner_user_id = u AND s.current_profile_version_id = p_expected_current_version_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;
  END IF;

  RETURN QUERY SELECT p_command_id, p_expected_current_version_id, cardinality(p_field_keys);
END$$;

-- ---------------------------------------------------------------------------
-- 8. MATCHING REQUIREMENTS - create the next immutable version.
--
--    It stores the human's bounded self-declared requirement truth and evaluates
--    nobody: no score, no rank, no candidate, and no reinterpretation of a soft
--    preference as a hard gate or of an unknown as a satisfied dealbreaker.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.set_matching_requirements_v1(
  p_command_id uuid, p_requirement_keys text[], p_requirement_strengths text[],
  p_requirement_values text[], p_expected_current_version_id uuid DEFAULT NULL
) RETURNS TABLE(matching_requirement_version_id uuid, superseded_version_id uuid, requirement_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.matching_requirement_versions;
  distinct_keys text[];
  committed_count integer;
  matched_count integer;
  current_id uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL THEN RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023'; END IF;
  IF p_requirement_keys IS NULL OR p_requirement_strengths IS NULL OR p_requirement_values IS NULL
     OR array_ndims(p_requirement_keys) IS DISTINCT FROM 1
     OR array_ndims(p_requirement_strengths) IS DISTINCT FROM 1
     OR array_ndims(p_requirement_values) IS DISTINCT FROM 1
     OR cardinality(p_requirement_keys) = 0
     OR cardinality(p_requirement_strengths) IS DISTINCT FROM cardinality(p_requirement_keys)
     OR cardinality(p_requirement_values) IS DISTINCT FROM cardinality(p_requirement_keys)
     OR array_position(p_requirement_keys, NULL::text) IS NOT NULL
     OR array_position(p_requirement_strengths, NULL::text) IS NOT NULL
     OR array_position(p_requirement_values, NULL::text) IS NOT NULL THEN
    RAISE EXCEPTION 'MATCHING_REQUIREMENT_SET_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT array_agg(DISTINCT t.k) INTO distinct_keys FROM unnest(p_requirement_keys) AS t(k);
  IF cardinality(distinct_keys) IS DISTINCT FROM cardinality(p_requirement_keys) THEN
    RAISE EXCEPTION 'MATCHING_REQUIREMENT_KEY_DUPLICATE' USING ERRCODE='22023';
  END IF;
  IF p_expected_current_version_id IS NOT NULL AND p_expected_current_version_id = p_command_id THEN
    RAISE EXCEPTION 'MATCHING_VERSION_ID_INVALID' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.matching_requirement_versions v WHERE v.id = p_command_id;
  IF FOUND THEN
    SELECT count(*) INTO committed_count
      FROM public.matching_requirement_items i WHERE i.requirement_version_id = p_command_id;
    SELECT count(*) INTO matched_count
      FROM unnest(p_requirement_keys, p_requirement_strengths, p_requirement_values) AS r(k, s, v)
      JOIN public.matching_requirement_items i
        ON i.requirement_version_id = p_command_id AND i.requirement_key = r.k
       AND i.requirement_strength = r.s AND i.requirement_value = r.v;
    IF committed.owner_user_id = u
       AND committed.prior_requirement_version_id IS NOT DISTINCT FROM p_expected_current_version_id
       AND committed_count = cardinality(p_requirement_keys)
       AND matched_count = cardinality(p_requirement_keys) THEN
      RETURN QUERY SELECT committed.id, committed.prior_requirement_version_id, committed_count;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT s.current_requirement_version_id INTO current_id
    FROM public.matching_requirement_state s WHERE s.owner_user_id = u FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_version_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001';
  END IF;

  INSERT INTO public.matching_requirement_versions (id, owner_user_id, prior_requirement_version_id)
  VALUES (p_command_id, u, p_expected_current_version_id);
  INSERT INTO public.matching_requirement_items
    (requirement_version_id, requirement_key, requirement_strength, requirement_value)
  SELECT p_command_id, r.k, r.s, r.v
    FROM unnest(p_requirement_keys, p_requirement_strengths, p_requirement_values) AS r(k, s, v);

  IF p_expected_current_version_id IS NULL THEN
    INSERT INTO public.matching_requirement_state (owner_user_id, current_requirement_version_id)
    VALUES (u, p_command_id);
  ELSE
    UPDATE public.matching_requirement_state s
       SET current_requirement_version_id = p_command_id, updated_at = CURRENT_TIMESTAMP
     WHERE s.owner_user_id = u AND s.current_requirement_version_id = p_expected_current_version_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;
  END IF;

  RETURN QUERY SELECT p_command_id, p_expected_current_version_id, cardinality(p_requirement_keys);
END$$;

-- ---------------------------------------------------------------------------
-- 9. PRE-MATCH PROPOSAL DISCLOSURE AUTHORITY - grant or reconfirm.
--
--    The only command that reaches a second durable family, and it reaches it
--    READ-ONLY and in the documented order. It binds the caller's CURRENT
--    Introduction Profile version exactly: a human authorizes the version they
--    are looking at, and when the profile moves on, the old authority stays bound
--    to the old version rather than silently following.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.grant_pre_match_disclosure_authority_v1(
  p_command_id uuid, p_new_authority_id uuid, p_profile_version_id uuid,
  p_approved_field_keys text[], p_expected_active_authority_id uuid DEFAULT NULL
) RETURNS TABLE(authority_event_id uuid, authority_event_type text, pre_match_disclosure_authority_id uuid,
                superseded_authority_id uuid, bound_profile_version_id uuid, approved_field_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.pre_match_disclosure_authority_events;
  committed_authority public.pre_match_disclosure_authorities;
  intended_event_type text;
  distinct_keys text[];
  committed_count integer;
  matched_count integer;
  current_version_id uuid;
  current_active_id uuid;
  unknown_key text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_new_authority_id IS NULL OR p_profile_version_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_approved_field_keys IS NULL OR array_ndims(p_approved_field_keys) IS DISTINCT FROM 1
     OR cardinality(p_approved_field_keys) = 0
     OR array_position(p_approved_field_keys, NULL::text) IS NOT NULL THEN
    RAISE EXCEPTION 'MATCHING_APPROVED_FIELD_SET_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT array_agg(DISTINCT t.k) INTO distinct_keys FROM unnest(p_approved_field_keys) AS t(k);
  IF cardinality(distinct_keys) IS DISTINCT FROM cardinality(p_approved_field_keys) THEN
    RAISE EXCEPTION 'MATCHING_FIELD_KEY_DUPLICATE' USING ERRCODE='22023';
  END IF;
  IF p_expected_active_authority_id IS NOT NULL AND p_expected_active_authority_id = p_new_authority_id THEN
    RAISE EXCEPTION 'MATCHING_AUTHORITY_ID_INVALID' USING ERRCODE='22023';
  END IF;
  intended_event_type := CASE WHEN p_expected_active_authority_id IS NULL THEN 'GRANTED' ELSE 'RECONFIRMED' END;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.pre_match_disclosure_authority_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    SELECT * INTO committed_authority FROM public.pre_match_disclosure_authorities a
     WHERE a.id = committed.subject_authority_id;
    SELECT count(*) INTO committed_count
      FROM public.pre_match_disclosure_authority_fields f WHERE f.authority_id = committed.subject_authority_id;
    SELECT count(*) INTO matched_count
      FROM unnest(p_approved_field_keys) AS r(k)
      JOIN public.pre_match_disclosure_authority_fields f
        ON f.authority_id = committed.subject_authority_id AND f.field_key = r.k;
    IF committed.grantor_user_id = u AND committed.event_type = intended_event_type
       AND committed.subject_authority_id = p_new_authority_id
       AND committed.prior_authority_id IS NOT DISTINCT FROM p_expected_active_authority_id
       AND committed_authority.introduction_profile_version_id = p_profile_version_id
       AND committed_count = cardinality(p_approved_field_keys)
       AND matched_count = cardinality(p_approved_field_keys) THEN
      RETURN QUERY SELECT committed.id, committed.event_type, committed.subject_authority_id,
                          committed.prior_authority_id, committed_authority.introduction_profile_version_id,
                          committed_count;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- SECOND FAMILY, READ ONLY, IN THE DOCUMENTED ORDER: the caller's current
  -- profile version, then the exact version row it names.
  SELECT s.current_profile_version_id INTO current_version_id
    FROM public.introduction_profile_state s WHERE s.owner_user_id = u FOR SHARE;
  IF current_version_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PROFILE_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  IF current_version_id IS DISTINCT FROM p_profile_version_id THEN
    RAISE EXCEPTION 'MATCHING_PROFILE_VERSION_NOT_CURRENT' USING ERRCODE='40001',
      DETAIL='A disclosure authority binds the exact Introduction Profile version the human is approving. An authority over an earlier version never silently covers a later one.';
  END IF;
  PERFORM 1 FROM public.introduction_profile_versions v
   WHERE v.id = p_profile_version_id AND v.owner_user_id = u FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROFILE_NOT_FOUND' USING ERRCODE='P0002'; END IF;

  -- Every approved key is a real field of THAT exact version. The composite
  -- foreign key makes this structurally true; naming the first offender turns
  -- the refusal into an answerable one.
  SELECT r.k INTO unknown_key
    FROM unnest(p_approved_field_keys) AS r(k)
   WHERE NOT EXISTS (SELECT 1 FROM public.introduction_profile_field_values f
                      WHERE f.profile_version_id = p_profile_version_id AND f.field_key = r.k)
   ORDER BY r.k LIMIT 1;
  IF unknown_key IS NOT NULL THEN
    RAISE EXCEPTION 'MATCHING_APPROVED_FIELD_NOT_IN_PROFILE_VERSION' USING ERRCODE='22023',
      DETAIL=format('The field %L is not part of the Introduction Profile version this authority binds.', unknown_key);
  END IF;

  SELECT a.id INTO current_active_id FROM public.pre_match_disclosure_authorities a
   WHERE a.grantor_user_id = u AND a.status = 'ACTIVE' FOR UPDATE;
  IF current_active_id IS DISTINCT FROM p_expected_active_authority_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pre_match_disclosure_authorities a WHERE a.id = p_new_authority_id) THEN
    RAISE EXCEPTION 'MATCHING_AUTHORITY_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  IF p_expected_active_authority_id IS NOT NULL THEN
    UPDATE public.pre_match_disclosure_authorities a
       SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP
     WHERE a.id = p_expected_active_authority_id AND a.status = 'ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;
  END IF;
  INSERT INTO public.pre_match_disclosure_authorities
    (id, grantor_user_id, introduction_profile_version_id, status)
  VALUES (p_new_authority_id, u, p_profile_version_id, 'ACTIVE');
  INSERT INTO public.pre_match_disclosure_authority_fields
    (authority_id, introduction_profile_version_id, field_key)
  SELECT p_new_authority_id, p_profile_version_id, r.k FROM unnest(p_approved_field_keys) AS r(k);
  INSERT INTO public.pre_match_disclosure_authority_events
    (id, grantor_user_id, event_type, subject_authority_id, prior_authority_id)
  VALUES (p_command_id, u, intended_event_type, p_new_authority_id, p_expected_active_authority_id);

  RETURN QUERY SELECT p_command_id, intended_event_type, p_new_authority_id,
                      p_expected_active_authority_id, p_profile_version_id,
                      cardinality(p_approved_field_keys);
END$$;

-- ---------------------------------------------------------------------------
-- 10. PRE-MATCH PROPOSAL DISCLOSURE AUTHORITY - revoke. Like the context grant,
--     it reads no participation state and no profile state: withdrawing one's own
--     disclosure authority is never gated on anything else.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.revoke_pre_match_disclosure_authority_v1(
  p_command_id uuid, p_expected_active_authority_id uuid
) RETURNS TABLE(authority_event_id uuid, authority_event_type text, pre_match_disclosure_authority_id uuid,
                superseded_authority_id uuid, bound_profile_version_id uuid, approved_field_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.pre_match_disclosure_authority_events;
  target public.pre_match_disclosure_authorities;
  field_total integer;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_expected_active_authority_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.pre_match_disclosure_authority_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.grantor_user_id = u AND committed.event_type = 'REVOKED'
       AND committed.subject_authority_id = p_expected_active_authority_id
       AND committed.prior_authority_id IS NULL THEN
      SELECT * INTO target FROM public.pre_match_disclosure_authorities a
       WHERE a.id = committed.subject_authority_id;
      SELECT count(*) INTO field_total FROM public.pre_match_disclosure_authority_fields f
       WHERE f.authority_id = committed.subject_authority_id;
      RETURN QUERY SELECT committed.id, committed.event_type, committed.subject_authority_id,
                          committed.prior_authority_id, target.introduction_profile_version_id, field_total;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT * INTO target FROM public.pre_match_disclosure_authorities a
   WHERE a.id = p_expected_active_authority_id AND a.grantor_user_id = u FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_DISCLOSURE_AUTHORITY_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF target.status <> 'ACTIVE' THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;

  UPDATE public.pre_match_disclosure_authorities a
     SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP
   WHERE a.id = p_expected_active_authority_id AND a.status = 'ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;
  INSERT INTO public.pre_match_disclosure_authority_events
    (id, grantor_user_id, event_type, subject_authority_id, prior_authority_id)
  VALUES (p_command_id, u, 'REVOKED', p_expected_active_authority_id, NULL);
  SELECT count(*) INTO field_total FROM public.pre_match_disclosure_authority_fields f
   WHERE f.authority_id = p_expected_active_authority_id;

  RETURN QUERY SELECT p_command_id, 'REVOKED'::text, p_expected_active_authority_id, NULL::uuid,
                      target.introduction_profile_version_id, field_total;
END$$;

-- ---------------------------------------------------------------------------
-- 11. SELF-INSPECTION. Exactly one row, about exactly its own caller.
--
--     It takes NO parameter, so a caller cannot phrase a question about another
--     human at all. It answers with IDENTITIES and STATES only - never a profile
--     field value, a requirement value, a private reason or a source - so it is
--     a setup mirror and can never become a candidate browser or a content read
--     path. Reading one's own field values back is deliberately deferred: no
--     Product surface needs it yet, and it is the one place a generic output
--     channel could grow.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.get_my_matching_setup_v1()
RETURNS TABLE(participation_state text, pause_reason text, participation_event_id uuid,
              matching_context_grant_id uuid, introduction_profile_version_id uuid,
              matching_requirement_version_id uuid, pre_match_disclosure_authority_id uuid,
              bound_profile_version_id uuid, approved_field_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  r_state text := 'OFF';
  r_reason text := NULL;
  r_event uuid := NULL;
  r_grant uuid := NULL;
  r_profile uuid := NULL;
  r_requirements uuid := NULL;
  r_authority uuid := NULL;
  r_bound_version uuid := NULL;
  r_fields integer := 0;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;

  -- Absence is OFF. Nothing here infers participation from a profile, a grant or
  -- a disclosure authority.
  SELECT e.id, e.resulting_state, e.resulting_pause_reason INTO r_event, r_state, r_reason
    FROM public.matching_participation_state s
    JOIN public.matching_participation_events e ON e.id = s.current_event_id
   WHERE s.participant_user_id = u;
  IF r_state IS NULL THEN r_state := 'OFF'; END IF;

  SELECT g.id INTO r_grant FROM public.matching_context_grants g
   WHERE g.grantor_user_id = u AND g.status = 'ACTIVE';
  SELECT s.current_profile_version_id INTO r_profile
    FROM public.introduction_profile_state s WHERE s.owner_user_id = u;
  SELECT s.current_requirement_version_id INTO r_requirements
    FROM public.matching_requirement_state s WHERE s.owner_user_id = u;
  SELECT a.id, a.introduction_profile_version_id INTO r_authority, r_bound_version
    FROM public.pre_match_disclosure_authorities a
   WHERE a.grantor_user_id = u AND a.status = 'ACTIVE';
  IF r_authority IS NOT NULL THEN
    SELECT count(*) INTO r_fields FROM public.pre_match_disclosure_authority_fields f
     WHERE f.authority_id = r_authority;
  END IF;

  RETURN QUERY SELECT r_state, r_reason, r_event, r_grant, r_profile, r_requirements,
                      r_authority, r_bound_version, r_fields;
END$$;

-- ---------------------------------------------------------------------------
-- 12. OWNERSHIP AND LEAST-PRIVILEGE EXECUTE ACL.
--
--     `authenticated` humans only. PUBLIC, anon and service_role receive
--     nothing; service_role is revoked explicitly because a Supabase project
--     grants EXECUTE on new public functions to it by default privilege, and a
--     system credential must never be able to manufacture a human's Matching
--     participation or consent.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  boundary text;
BEGIN
  FOREACH boundary IN ARRAY ARRAY[
    'public.activate_matching_participation_v1(uuid,text,uuid)',
    'public.pause_matching_participation_v1(uuid,uuid)',
    'public.resume_matching_participation_v1(uuid,uuid)',
    'public.turn_off_matching_participation_v1(uuid,uuid)',
    'public.grant_matching_context_v1(uuid,uuid,uuid)',
    'public.revoke_matching_context_v1(uuid,uuid)',
    'public.set_introduction_profile_v1(uuid,text[],text[],uuid)',
    'public.set_matching_requirements_v1(uuid,text[],text[],text[],uuid)',
    'public.grant_pre_match_disclosure_authority_v1(uuid,uuid,uuid,text[],uuid)',
    'public.revoke_pre_match_disclosure_authority_v1(uuid,uuid)',
    'public.get_my_matching_setup_v1()'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', boundary);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', boundary);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', boundary);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', boundary);
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 13. TERMINAL SELF-ASSERTIONS.
--
--     The migration refuses to deploy a Matching boundary that is
--     service-role-executable, anonymous, unpinned, caller-identified,
--     participation-coupled where it must not be, or that weakened the 0108 seal.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  mutations text[] := ARRAY[
    'public.activate_matching_participation_v1(uuid,text,uuid)',
    'public.pause_matching_participation_v1(uuid,uuid)',
    'public.resume_matching_participation_v1(uuid,uuid)',
    'public.turn_off_matching_participation_v1(uuid,uuid)',
    'public.grant_matching_context_v1(uuid,uuid,uuid)',
    'public.revoke_matching_context_v1(uuid,uuid)',
    'public.set_introduction_profile_v1(uuid,text[],text[],uuid)',
    'public.set_matching_requirements_v1(uuid,text[],text[],text[],uuid)',
    'public.grant_pre_match_disclosure_authority_v1(uuid,uuid,uuid,text[],uuid)',
    'public.revoke_pre_match_disclosure_authority_v1(uuid,uuid)'];
  projection text := 'public.get_my_matching_setup_v1()';
  -- Commands whose authority must NOT depend on participation: withdrawing or
  -- granting private-context and disclosure authority is separate truth.
  participation_free text[] := ARRAY[
    'public.grant_matching_context_v1(uuid,uuid,uuid)',
    'public.revoke_matching_context_v1(uuid,uuid)',
    'public.set_introduction_profile_v1(uuid,text[],text[],uuid)',
    'public.set_matching_requirements_v1(uuid,text[],text[],text[],uuid)',
    'public.grant_pre_match_disclosure_authority_v1(uuid,uuid,uuid,text[],uuid)',
    'public.revoke_pre_match_disclosure_authority_v1(uuid,uuid)'];
  sealed_tables text[] := ARRAY[
    'public.matching_setup_locks',
    'public.matching_participation_events',
    'public.matching_participation_state',
    'public.matching_context_grants',
    'public.matching_context_consent_events',
    'public.introduction_profile_versions',
    'public.introduction_profile_field_values',
    'public.introduction_profile_state',
    'public.matching_requirement_versions',
    'public.matching_requirement_items',
    'public.matching_requirement_state',
    'public.pre_match_disclosure_authorities',
    'public.pre_match_disclosure_authority_fields',
    'public.pre_match_disclosure_authority_events'];
  fn text;
  p record;
  target_role text;
  target_table text;
  target_privilege text;
BEGIN
  FOREACH fn IN ARRAY mutations || ARRAY[projection] LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc,
           pg_get_function_identity_arguments(pr.oid) AS args
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-07A: % must be SECURITY DEFINER', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-07A: % must pin an empty search_path', fn;
    END IF;
    IF p.prosrc !~ 'auth\.uid\(\)' THEN
      RAISE EXCEPTION 'I-07A: % must derive its human from auth.uid()', fn;
    END IF;
    -- NO caller-supplied identity, state, reason, provenance-of-another-actor or
    -- timestamp. The human is auth.uid(); every state literal is the function's
    -- own identity.
    IF p.args ~* '(user|human|actor|grantor|owner|participant|subject|on_behalf|recipient|candidate|pair|proposal)'
       OR p.args ~* '(status|state|pause|reason|event_type|purpose|source|scope|permission)'
       OR p.args ~* '(timestamp|_at\M|occurred|granted|revoked)' THEN
      RAISE EXCEPTION 'I-07A: % must not accept an identity, state, reason, purpose, scope or timestamp parameter: %', fn, p.args;
    END IF;
    -- Every consequential command serializes on the caller's OWN durable lock
    -- row before it compares or changes anything.
    IF fn <> projection AND p.prosrc !~ 'INSERT INTO public\.matching_setup_locks AS l \(user_id\) VALUES \(u\)' THEN
      RAISE EXCEPTION 'I-07A: % must serialize on the caller''s own Matching lock row', fn;
    END IF;
    -- History is never rewritten by a command.
    IF p.prosrc ~* '(DELETE FROM|TRUNCATE)'
       OR p.prosrc ~* 'UPDATE public\.(matching_participation_events|matching_context_consent_events|introduction_profile_versions|introduction_profile_field_values|matching_requirement_versions|matching_requirement_items|pre_match_disclosure_authority_fields|pre_match_disclosure_authority_events)' THEN
      RAISE EXCEPTION 'I-07A: % may never rewrite or erase Matching history', fn;
    END IF;
    -- No Shared, Public or Replay authority is read, widened or generalized, and
    -- no private MY_WORLD material is read: I-07A creates authority, not the
    -- later candidate-evaluation context resolver.
    IF p.prosrc ~* 'public\.(shared_world|public_world|public_experience|replay|conversation_units|conversation_turns|conversation_sessions|him_)' THEN
      RAISE EXCEPTION 'I-07A: % may not read Shared, Public, Replay or private MY_WORLD state', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-07A: PUBLIC must not execute %', fn;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-07A: % must not execute % - a system credential never manufactures human Matching consent', target_role, fn;
      END IF;
    END LOOP;
    IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-07A: authenticated must be the only executor of %', fn;
    END IF;
  END LOOP;

  FOREACH fn IN ARRAY mutations LOOP
    SELECT pr.provolatile INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-07A: % is a mutation and must be VOLATILE', fn; END IF;
  END LOOP;
  SELECT pr.provolatile INTO p FROM pg_proc pr WHERE pr.oid = projection::regprocedure;
  IF p.provolatile <> 's' THEN
    RAISE EXCEPTION 'I-07A: the self-inspection projection must be STABLE and write nothing';
  END IF;

  -- THE THREE AUTHORITIES STAY INDEPENDENT. A grant, profile, requirement or
  -- disclosure command that consulted participation would make one authority
  -- depend on another and would stop revocation working while OFF or PAUSED.
  FOREACH fn IN ARRAY participation_free LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc ~* 'matching_participation' THEN
      RAISE EXCEPTION 'I-07A: % must not read or write participation state: the three authorities are independent', fn;
    END IF;
  END LOOP;

  -- THE RESUME CEILING IS REAL. The resume path names USER_PAUSED, and the
  -- activation path refuses a reactivation over a pause it may not resume.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.resume_matching_participation_v1(uuid,uuid)'::regprocedure;
  IF p.prosrc !~ 'MATCHING_PAUSE_NOT_USER_RESUMABLE' OR p.prosrc !~ 'USER_PAUSED' THEN
    RAISE EXCEPTION 'I-07A: the resume path must refuse every pause reason but USER_PAUSED';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.activate_matching_participation_v1(uuid,text,uuid)'::regprocedure;
  IF p.prosrc !~ 'MATCHING_REACTIVATION_REQUIRES_REVALIDATION' THEN
    RAISE EXCEPTION 'I-07A: activation must refuse a reactivation over a pause that requires later revalidation';
  END IF;

  -- EXACTLY THESE BOUNDARIES EXIST, one overload each.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.proname ~* '(matching|introduction_profile|pre_match)') <> 11 THEN
    RAISE EXCEPTION 'I-07A: exactly the ten commands and the one self-inspection projection may exist, one overload each';
  END IF;

  -- THE 0108 SEAL IS UNCHANGED: no application role gained direct table access.
  FOREACH target_table IN ARRAY sealed_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-07A: no RLS policy may exist on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-07A: direct table access stays sealed: % holds % on %',
              target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- THE I-02B / I-03C SHARED STANDING CONTEXT RUNTIME IS UNTOUCHED: still
  -- authenticated-only, still not service-role-executable, still its own family.
  IF NOT has_function_privilege('authenticated', 'public.grant_shared_world_standing_context_v1(uuid,uuid,uuid,uuid[],uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.grant_shared_world_standing_context_v1(uuid,uuid,uuid,uuid[],uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I-07A: the Shared Standing Context consent boundary must be exactly as I-03C left it';
  END IF;
END$$;

COMMIT;
