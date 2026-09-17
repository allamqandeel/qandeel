-- I-07B - Matching proposal choreography, revalidation, expiry, withdrawal and
-- the neutral recipient projection v1.
--
-- Migration 0110 created the persistence and 0111 created the private evaluation
-- and the one-way disclosure boundary. This forward-only migration creates the
-- CHOREOGRAPHY: preparation, the first offer, the first decline, forward
-- approval, the independent second-recipient proposal, the second decline,
-- withdrawal, expiry, staleness on a material setup change, and the two
-- recipient-safe projections - the only things in I-07B shaped like something a
-- human could eventually be shown.
--
-- It stops exactly where the frozen boundary stops. There is no second-party
-- ACCEPTANCE here, and no state for one to write. Acceptance must revalidate its
-- exact view AND claim both humans' Introduction slots in one transaction; split
-- across two slices it would need a durable "accepted but not matched" state,
-- which the architecture deliberately does not have. That transaction is I-07C.
--
-- ## Still executable by nobody (task section 23)
--
-- Every boundary below is postgres-owned, SECURITY DEFINER, empty-search_path
-- and revoked from PUBLIC, anon, authenticated and service_role, for the reason
-- 0111's header gives: proposal delivery and human proposal decisions are
-- consequential disclosure about two humans, and the CW2-08 Launch Gate that
-- must clear them does not exist in this repository.
--
-- The four HUMAN DECISION cores nevertheless derive their human from auth.uid()
-- and take no actor parameter at all, exactly as every I-07A command does. That
-- is what lets I-09 wrap them later by granting EXECUTE, with no step that turns
-- a system credential into human consent. A core that took an actor id would
-- have to be rewritten at that point, and rewriting a consent boundary at launch
-- time is the thing this shape exists to avoid.
--
-- ## The exact-view check is INSIDE the serialization region, and that is an order
--
-- Every human decision begins with `enter_matching_proposal_decision_v1`, which
-- answers the bounded not-found from the proposal's own immutable membership and
-- THEN takes the canonical two-human lock. Everything a decision reads about
-- currentness - the committed transition, the exact recipient view version, the
-- proposal state - is read after that, under the same lock a recipient-view
-- materialization holds.
--
-- The order is load-bearing rather than tidy. `materialize_matching_recipient_view_core_v1`
-- supersedes a view while holding that lock, so a decision that checked the view
-- FIRST and locked afterwards would leave a window: it accepts V1, a concurrent
-- materialization commits V2 and releases, the decision then takes the lock and
-- acts on a view that is no longer current. The compare-and-swap on the proposal
-- state does not close that window, because materializing a view does not change
-- the proposal state, so the swap still succeeds. The terminal self-assertion
-- refuses a decision body whose order drifts back, and a two-connection race in
-- the verifier is the authority.
--
-- ## The CW2-08 gate is the LAST gate, and only on the consequential half
--
-- Delivery and every human decision require exactly CLEARED from
-- `resolve_matching_proposal_prerequisites_v1`, AFTER every privacy, authority
-- and revalidation gate has already passed - so a clearance refusal never
-- reveals that the other gates would have passed.
--
-- Expiry, staleness and WITHDRAWAL deliberately do NOT require clearance. All
-- three are the protective direction: they end exposure rather than create it. A
-- proposal that could not be withdrawn or staled because a launch gate was
-- unavailable would be the exact opposite of fail-closed.
--
-- ## Revalidation, and why a snapshot is not an authority (task section 19)
--
-- `resolve_matching_snapshot_validity_v1` compares every identity the
-- eligibility snapshot bound against the humans' CURRENT truth, and answers with
-- the PRIVATE reason when one has moved: participation that is no longer ACTIVE,
-- a withdrawn or reconfirmed Matching Context Grant, a new Introduction Profile
-- version, a new requirement version, a new or revoked Pre-Match Disclosure
-- Authority, a changed or newly unconfigured proposal policy identity, or an
-- Introduction that has since begun.
--
-- There is ONE implementation of that comparison and everything else delegates
-- to it, including the proposal-scoped form. Two copies of a revalidation rule
-- is two rules the day somebody edits one.
--
-- Every advancing step revalidates inline before it advances, so a proposal can
-- never be delivered on an authority that has already moved. The snapshot
-- records what WAS true; it never certifies what IS.
--
-- PAUSE AND OPT-OUT WIN, and neither is a special case: both stop participation
-- being ACTIVE, which is the first thing revalidation asks. A pause accumulates
-- no backlog, because cadence is DERIVED from the proposals that exist rather
-- than from a counter that keeps running while nobody is looking.
--
-- ## Privacy of an ending (task sections 10, 17, 18)
--
-- The private reason a proposal ended lives on the transition row. The two
-- recipient projections never return it, never return a terminal state name and
-- never return the counterparty's stable identifier. They answer with a NEUTRAL
-- OUTCOME, and the mapping IS the privacy property:
--
--     AWAITING_YOU          live, and this recipient is the one being asked
--     IN_PROGRESS           live, and they are not
--     CLOSED_BY_YOU         terminal by this recipient's own act
--     NO_LONGER_AVAILABLE   terminal any other way, whatever the way was
--     MATCH_CONCLUDED       the one I-07C terminal both humans are party to
--
-- A first recipient therefore cannot distinguish a second decline from an
-- expiry, from a private invalidation, or from a competing match that cancelled
-- the proposal: all four are one answer. A second recipient cannot distinguish a
-- withdrawal from an expiry. And neither learns anything at all about a proposal
-- they hold no view of - the projections answer only about a proposal THIS EXACT
-- CALLER has a current recipient view for, and every other question (another
-- human's proposal, one never offered to them, one that does not exist) is the
-- SAME bounded not-found.
--
-- That last rule is what keeps the candidate from having a "proposal existed"
-- oracle before forward approval. A candidate holds no view until the first
-- recipient explicitly approves forwarding, so until then every question they
-- could ask answers exactly as it would for a proposal that was never prepared.
--
-- Migrations 0001-0111 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. REVALIDATION - one implementation, and everything delegates to it.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_matching_snapshot_validity_v1(p_eligibility_snapshot_id uuid)
RETURNS TABLE(still_valid boolean, private_reason_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  snapshot public.matching_eligibility_snapshots;
  low_state record;
  high_state record;
  current_cadence uuid;
  current_pending uuid;
  current_expiry uuid;
BEGIN
  SELECT * INTO snapshot FROM public.matching_eligibility_snapshots s
   WHERE s.id = p_eligibility_snapshot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_ELIGIBILITY_SNAPSHOT_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO low_state FROM public.resolve_matching_setup_state_v1(snapshot.lower_user_id);
  SELECT * INTO high_state FROM public.resolve_matching_setup_state_v1(snapshot.higher_user_id);

  -- PAUSE AND OPT-OUT ARE NOT SPECIAL CASES. Both stop participation being
  -- ACTIVE, and that is the first thing asked. The pause REASON is never carried
  -- out of here: the answer is one private code that says participation moved.
  IF low_state.participation_state <> 'ACTIVE' OR high_state.participation_state <> 'ACTIVE' THEN
    RETURN QUERY SELECT false, 'PARTICIPATION_NOT_ACTIVE'::text; RETURN;
  END IF;
  IF low_state.matching_context_grant_id IS DISTINCT FROM snapshot.lower_context_grant_id
     OR high_state.matching_context_grant_id IS DISTINCT FROM snapshot.higher_context_grant_id THEN
    RETURN QUERY SELECT false, 'MATCHING_CONTEXT_GRANT_CHANGED'::text; RETURN;
  END IF;
  IF low_state.introduction_profile_version_id IS DISTINCT FROM snapshot.lower_profile_version_id
     OR high_state.introduction_profile_version_id IS DISTINCT FROM snapshot.higher_profile_version_id THEN
    RETURN QUERY SELECT false, 'INTRODUCTION_PROFILE_VERSION_CHANGED'::text; RETURN;
  END IF;
  IF low_state.matching_requirement_version_id IS DISTINCT FROM snapshot.lower_requirement_version_id
     OR high_state.matching_requirement_version_id IS DISTINCT FROM snapshot.higher_requirement_version_id THEN
    RETURN QUERY SELECT false, 'MATCHING_REQUIREMENT_VERSION_CHANGED'::text; RETURN;
  END IF;
  IF low_state.pre_match_disclosure_authority_id IS DISTINCT FROM snapshot.lower_disclosure_authority_id
     OR high_state.pre_match_disclosure_authority_id IS DISTINCT FROM snapshot.higher_disclosure_authority_id THEN
    RETURN QUERY SELECT false, 'DISCLOSURE_AUTHORITY_CHANGED'::text; RETURN;
  END IF;

  -- A policy that MOVED and a policy that became UNCONFIGURED are the same
  -- answer, because a missing pointer reads as NULL and NULL is distinct from
  -- the bound identity. Unconfigured is never a permissive default.
  SELECT st.current_policy_version_id INTO current_cadence
    FROM public.matching_proposal_policy_state st WHERE st.policy_kind = 'PROPOSAL_CADENCE';
  SELECT st.current_policy_version_id INTO current_pending
    FROM public.matching_proposal_policy_state st WHERE st.policy_kind = 'PENDING_PROPOSAL_LIMIT';
  SELECT st.current_policy_version_id INTO current_expiry
    FROM public.matching_proposal_policy_state st WHERE st.policy_kind = 'PROPOSAL_EXPIRY';
  IF current_cadence IS DISTINCT FROM snapshot.cadence_policy_version_id
     OR current_pending IS DISTINCT FROM snapshot.pending_policy_version_id
     OR current_expiry IS DISTINCT FROM snapshot.expiry_policy_version_id THEN
    RETURN QUERY SELECT false, 'PROPOSAL_POLICY_CHANGED'::text; RETURN;
  END IF;

  IF (SELECT r.has_active_introduction
        FROM public.resolve_matching_active_introduction_v1(snapshot.lower_user_id) r)
     OR (SELECT r.has_active_introduction
           FROM public.resolve_matching_active_introduction_v1(snapshot.higher_user_id) r) THEN
    RETURN QUERY SELECT false, 'ACTIVE_INTRODUCTION_PRESENT'::text; RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END$$;

COMMENT ON FUNCTION public.resolve_matching_snapshot_validity_v1(uuid) IS
  'Whether an eligibility snapshot still binds the humans'' CURRENT truth, and '
  'the PRIVATE reason if it does not. This is the ONE implementation of '
  'revalidation in I-07B; a second copy would be a second rule the day somebody '
  'edited one of them. The reason it returns is private operational state and no '
  'recipient projection carries it.';

CREATE FUNCTION public.resolve_matching_proposal_validity_v1(p_proposal_id uuid)
RETURNS TABLE(still_valid boolean, private_reason_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  bound_snapshot uuid;
BEGIN
  SELECT p.eligibility_snapshot_id INTO bound_snapshot
    FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF bound_snapshot IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  RETURN QUERY SELECT v.still_valid, v.private_reason_code
    FROM public.resolve_matching_snapshot_validity_v1(bound_snapshot) v;
END$$;

COMMENT ON FUNCTION public.resolve_matching_proposal_validity_v1(uuid) IS
  'The proposal-scoped form of revalidation. It delegates entirely to the '
  'snapshot form and adds no rule of its own.';

-- ---------------------------------------------------------------------------
-- 2. THE SHARED TRANSITION WRITER.
--
--    One place appends a transition and moves the pointer, so the chain, the
--    idempotency law and the compare-and-swap cannot be implemented nine
--    slightly different ways. It is not a state machine of its own: the legal
--    (from, to) pairs and the role that may have acted are CHECK constraints in
--    0110, so this function cannot write something the database would refuse.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.append_matching_proposal_transition_v1(
  p_command_id uuid, p_proposal_id uuid, p_expected_state text, p_resulting_state text,
  p_first_actor_id uuid, p_candidate_actor_id uuid, p_private_reason_code text
) RETURNS TABLE(transition_id uuid, resulting_proposal_state text, superseded_transition_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  proposal public.matching_proposals;
  committed public.matching_proposal_transitions;
BEGIN
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;

  -- An equivalent retry answers with the ALREADY COMMITTED transition, read back
  -- from the committed row. The comparison covers the WHOLE immutable request.
  SELECT * INTO committed FROM public.matching_proposal_transitions t WHERE t.id = p_command_id;
  IF FOUND THEN
    IF committed.proposal_id = p_proposal_id AND committed.prior_state = p_expected_state
       AND committed.resulting_state = p_resulting_state
       AND committed.first_recipient_actor_id IS NOT DISTINCT FROM p_first_actor_id
       AND committed.candidate_actor_id IS NOT DISTINCT FROM p_candidate_actor_id
       AND committed.private_reason_code IS NOT DISTINCT FROM p_private_reason_code THEN
      RETURN QUERY SELECT committed.id, committed.resulting_state, committed.prior_transition_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- COMPARE AND SWAP. Nothing is ever applied to "whatever is current".
  IF proposal.proposal_state IS DISTINCT FROM p_expected_state THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001',
      DETAIL='A proposal transition names the exact state it expects to move out of.';
  END IF;

  INSERT INTO public.matching_proposal_transitions
    (id, proposal_id, prior_state, resulting_state, prior_transition_id,
     first_recipient_actor_id, candidate_actor_id, private_reason_code)
  VALUES (p_command_id, p_proposal_id, p_expected_state, p_resulting_state,
          proposal.current_transition_id, p_first_actor_id, p_candidate_actor_id, p_private_reason_code);

  UPDATE public.matching_proposals p
     SET proposal_state = p_resulting_state, current_transition_id = p_command_id
   WHERE p.id = p_proposal_id AND p.proposal_state = p_expected_state;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;

  RETURN QUERY SELECT p_command_id, p_resulting_state, proposal.current_transition_id;
END$$;

COMMENT ON FUNCTION public.append_matching_proposal_transition_v1(uuid, uuid, text, text, uuid, uuid, text) IS
  'The ONE writer of a proposal transition. It appends the immutable transition '
  'and moves the current pointer together, answers an equivalent retry from the '
  'committed row, refuses the same command id carrying a different request, and '
  'refuses any current state but the exact one the caller named.';

-- ---------------------------------------------------------------------------
-- 3. ENTERING A HUMAN DECISION: the bounded answer first, then the lock.
--
--    Every human decision begins here, and the ORDER is the whole of it.
--
--    The exact-view check below must run INSIDE the canonical two-human
--    serialization region, because `materialize_matching_recipient_view_core_v1`
--    supersedes a recipient view while holding exactly that lock. Checking the
--    view first and locking afterwards leaves a window in which a concurrent
--    materialization commits V2 between the two - and a human action that had
--    already accepted V1 would then proceed on a view that is no longer current,
--    which is precisely what "a stale view authorizes nothing" forbids. The
--    compare-and-swap on the proposal state does not close it: materializing a
--    view does not change the proposal state, so the swap still succeeds.
--
--    The bounded not-found is nevertheless taken BEFORE the lock, from the
--    proposal's own immutable membership. A caller who is no part of this
--    proposal therefore never causes a serialization row to be written for two
--    humans they have nothing to do with - and the answer is unchanged: a
--    proposal that does not exist, one this human is no part of, and one they
--    hold no view of are all the same `MATCHING_PROPOSAL_NOT_FOUND`.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.enter_matching_proposal_decision_v1(p_proposal_id uuid, p_actor_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  proposal public.matching_proposals;
BEGIN
  IF p_proposal_id IS NULL OR p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  -- Two separate refusals rather than one `OR`: after a SELECT INTO that found
  -- nothing every field is NULL, and `p_actor_user_id NOT IN (NULL, NULL)` is
  -- NULL rather than true, which an `IF` reads as false.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  IF p_actor_user_id NOT IN (proposal.first_recipient_user_id, proposal.candidate_user_id) THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  PERFORM public.lock_matching_pair_humans_v1(proposal.lower_user_id, proposal.higher_user_id);
END$$;

COMMENT ON FUNCTION public.enter_matching_proposal_decision_v1(uuid, uuid) IS
  'The one entry point of every human proposal decision: the bounded not-found '
  'for a proposal this human is no part of, taken from immutable membership '
  'BEFORE any lock, and then the canonical two-human serialization lock. '
  'Everything a decision reads about currentness - the committed transition, the '
  'exact recipient view version, the proposal state - is read after it, under '
  'the same lock a recipient-view materialization holds, so a view cannot be '
  'superseded between the check and the act.';

-- ---------------------------------------------------------------------------
-- 4. THE EXACT-VIEW GUARD the four human decisions share.
--
--    It is only ever called from inside the serialized region above, and the
--    terminal self-assertion refuses a decision body that calls it before it.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.assert_matching_recipient_view_current_v1(
  p_proposal_id uuid, p_viewer_user_id uuid, p_expected_view_id uuid, p_expected_role text
) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  current_view uuid;
  actual_role text;
BEGIN
  IF p_proposal_id IS NULL OR p_expected_view_id IS NULL OR p_viewer_user_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- ONE BOUNDED ANSWER for every question this human is not entitled to ask. A
  -- proposal that is not theirs, one they hold no view of, and one that never
  -- existed are indistinguishable - which is what stops a candidate learning
  -- that a proposal about them was ever offered to somebody else.
  SELECT st.current_view_id INTO current_view
    FROM public.matching_recipient_proposal_view_state st
   WHERE st.proposal_id = p_proposal_id AND st.recipient_user_id = p_viewer_user_id;
  IF current_view IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  SELECT v.recipient_role INTO actual_role
    FROM public.matching_recipient_proposal_views v WHERE v.id = current_view;
  IF actual_role IS DISTINCT FROM p_expected_role THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  -- A STALE VIEW CANNOT AUTHORIZE A CURRENT CONSEQUENTIAL ACTION. The human acts
  -- on the exact version they were shown; a superseded one stays history and
  -- authorizes nothing.
  IF current_view IS DISTINCT FROM p_expected_view_id THEN
    RAISE EXCEPTION 'MATCHING_RECIPIENT_VIEW_STALE' USING ERRCODE='40001',
      DETAIL='Every human action binds the exact recipient view version that human saw.';
  END IF;
END$$;

COMMENT ON FUNCTION public.assert_matching_recipient_view_current_v1(uuid, uuid, uuid, text) IS
  'The anti-oracle and exact-view guard every human proposal decision shares. A '
  'proposal the caller holds no current view of answers with the SAME bounded '
  'not-found as one that never existed, and a superseded view authorizes nothing.';

-- ---------------------------------------------------------------------------
-- 5. PROPOSAL PREPARATION - cadence and pending limits DERIVED, never counted.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.prepare_matching_proposal_core_v1(
  p_proposal_id uuid, p_eligibility_snapshot_id uuid, p_first_recipient_user_id uuid
) RETURNS TABLE(prepared_proposal_id uuid, prepared_pair_id uuid, prepared_first_recipient_id uuid,
                prepared_candidate_id uuid, prepared_state text, expiry_instant timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  snapshot public.matching_eligibility_snapshots;
  committed public.matching_proposals;
  validity record;
  other uuid;
  expiry_hours integer;
  cadence_window integer;
  cadence_max integer;
  pending_max integer;
  human uuid;
  used integer;
  deadline timestamptz;
  violated text;
BEGIN
  IF p_proposal_id IS NULL OR p_eligibility_snapshot_id IS NULL OR p_first_recipient_user_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT * INTO snapshot FROM public.matching_eligibility_snapshots s WHERE s.id = p_eligibility_snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_ELIGIBILITY_SNAPSHOT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF p_first_recipient_user_id NOT IN (snapshot.lower_user_id, snapshot.higher_user_id) THEN
    RAISE EXCEPTION 'MATCHING_RECIPIENT_NOT_IN_PAIR' USING ERRCODE='22023';
  END IF;
  other := CASE p_first_recipient_user_id WHEN snapshot.lower_user_id THEN snapshot.higher_user_id
                                          ELSE snapshot.lower_user_id END;

  PERFORM public.lock_matching_pair_humans_v1(snapshot.lower_user_id, snapshot.higher_user_id);

  SELECT * INTO committed FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF FOUND THEN
    IF committed.eligibility_snapshot_id = p_eligibility_snapshot_id
       AND committed.first_recipient_user_id = p_first_recipient_user_id THEN
      RETURN QUERY SELECT committed.id, committed.pair_id, committed.first_recipient_user_id,
                          committed.candidate_user_id, committed.proposal_state, committed.expires_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- The snapshot says what WAS true. Preparation asks what IS.
  SELECT * INTO validity FROM public.resolve_matching_snapshot_validity_v1(p_eligibility_snapshot_id);
  IF NOT validity.still_valid THEN
    RAISE EXCEPTION 'MATCHING_ELIGIBILITY_NO_LONGER_CURRENT' USING ERRCODE='40001',
      DETAIL='A proposal is prepared from a snapshot whose bound identities are still the current ones.';
  END IF;

  SELECT v.window_days, v.max_count INTO cadence_window, cadence_max
    FROM public.matching_proposal_policy_versions v WHERE v.id = snapshot.cadence_policy_version_id;
  SELECT v.max_count INTO pending_max
    FROM public.matching_proposal_policy_versions v WHERE v.id = snapshot.pending_policy_version_id;
  SELECT v.expiry_hours INTO expiry_hours
    FROM public.matching_proposal_policy_versions v WHERE v.id = snapshot.expiry_policy_version_id;

  -- CADENCE AND PENDING ARE DERIVED FROM THE PROPOSALS THAT EXIST, never from a
  -- stored counter. A counter keeps running while a human is paused and hands
  -- them the backlog when they come back; a derivation cannot, because a pause
  -- creates no proposals to count.
  FOREACH human IN ARRAY ARRAY[p_first_recipient_user_id, other] LOOP
    SELECT count(*)::int INTO used FROM public.matching_proposals p
     WHERE (p.first_recipient_user_id = human OR p.candidate_user_id = human)
       AND p.prepared_at > CURRENT_TIMESTAMP - make_interval(days => cadence_window);
    IF used >= cadence_max THEN
      RAISE EXCEPTION 'MATCHING_PROPOSAL_CADENCE_EXCEEDED' USING ERRCODE='55000',
        DETAIL='The configured proposal cadence for this window is already used. The window and the count are a Product policy identity, not constants in this runtime.';
    END IF;
    SELECT count(*)::int INTO used FROM public.matching_proposals p
     WHERE (p.first_recipient_user_id = human OR p.candidate_user_id = human)
       AND p.proposal_state IN ('PREPARED', 'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND');
    IF used >= pending_max THEN
      RAISE EXCEPTION 'MATCHING_PENDING_PROPOSAL_LIMIT_EXCEEDED' USING ERRCODE='55000';
    END IF;
  END LOOP;

  deadline := CURRENT_TIMESTAMP + make_interval(hours => expiry_hours);

  -- AT MOST ONE LIVE PROPOSAL PER UNORDERED PAIR. A simultaneous (A,B) and (B,A)
  -- preparation resolve to the SAME pair row, so the partial unique index sees
  -- one key and exactly one of the two survives whichever order they arrive in.
  BEGIN
    INSERT INTO public.matching_proposals
      (id, pair_id, lower_user_id, higher_user_id, first_recipient_user_id, candidate_user_id,
       eligibility_snapshot_id, expires_at)
    VALUES (p_proposal_id, snapshot.pair_id, snapshot.lower_user_id, snapshot.higher_user_id,
            p_first_recipient_user_id, other, p_eligibility_snapshot_id, deadline);
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    IF violated = 'matching_proposals_one_live_per_pair_idx' THEN
      RAISE EXCEPTION 'MATCHING_LIVE_PROPOSAL_ALREADY_EXISTS' USING ERRCODE='23505',
        DETAIL='At most one proposal per canonical unordered pair is live at a time, in either direction.';
    END IF;
    RAISE;
  END;

  RETURN QUERY SELECT p_proposal_id, snapshot.pair_id, p_first_recipient_user_id, other,
                      'PREPARED'::text, deadline;
END$$;

COMMENT ON FUNCTION public.prepare_matching_proposal_core_v1(uuid, uuid, uuid) IS
  'Prepares one proposal from an eligibility snapshot whose bound identities are '
  'still current, within the configured cadence and pending limits. Both limits '
  'are DERIVED from the proposals that exist rather than from a stored counter, '
  'so a pause accumulates no backlog and returning cannot produce a flood. At '
  'most one proposal per unordered pair is live in either direction, and the '
  '0110 trigger refuses a snapshot whose every hard dealbreaker is not PASS.';

-- ---------------------------------------------------------------------------
-- 6. DELIVERY - the first offer, and the INDEPENDENT second proposal.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.offer_matching_proposal_to_first_core_v1(
  p_command_id uuid, p_proposal_id uuid, p_view_id uuid, p_permitted_conclusion_id uuid
) RETURNS TABLE(offer_transition_id uuid, offered_state text, offered_view_id uuid,
                offered_field_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  proposal public.matching_proposals;
  validity record;
  gate record;
  view_result record;
  committed_view uuid;
  already integer;
BEGIN
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  PERFORM public.lock_matching_pair_humans_v1(proposal.lower_user_id, proposal.higher_user_id);

  -- IDEMPOTENCY FIRST, before any gate. An equivalent retry answers from the
  -- COMMITTED rows even if clearance, authority or the view has moved since - a
  -- retry must not be able to produce a different answer than the call it
  -- repeats - and the same command id carrying a different view fails closed.
  IF EXISTS (SELECT 1 FROM public.matching_proposal_transitions t
              WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
                AND t.prior_state = 'PREPARED' AND t.resulting_state = 'OFFERED_TO_FIRST') THEN
    SELECT st.current_view_id INTO committed_view
      FROM public.matching_recipient_proposal_view_state st
     WHERE st.proposal_id = p_proposal_id AND st.recipient_user_id = proposal.first_recipient_user_id;
    IF committed_view IS DISTINCT FROM p_view_id THEN
      RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    SELECT count(*)::int INTO already FROM public.matching_recipient_proposal_view_fields f
     WHERE f.view_id = committed_view;
    RETURN QUERY SELECT p_command_id, 'OFFERED_TO_FIRST'::text, committed_view, already;
    RETURN;
  END IF;

  SELECT * INTO validity FROM public.resolve_matching_proposal_validity_v1(p_proposal_id);
  IF NOT validity.still_valid THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NO_LONGER_VALID' USING ERRCODE='40001',
      DETAIL='A proposal is delivered on the authority it was built on, revalidated at the instant of delivery.';
  END IF;
  IF proposal.expires_at <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_EXPIRED' USING ERRCODE='55000';
  END IF;

  -- THE LAST GATE, after every privacy and authority gate has already passed, so
  -- a clearance refusal never reveals that the others would have passed.
  SELECT * INTO gate FROM public.resolve_matching_proposal_prerequisites_v1(p_proposal_id);
  IF gate.clearance <> 'CLEARED' THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL=gate.basis;
  END IF;

  SELECT * INTO view_result FROM public.materialize_matching_recipient_view_core_v1(
    p_view_id, p_proposal_id, proposal.first_recipient_user_id, p_permitted_conclusion_id);

  PERFORM public.append_matching_proposal_transition_v1(
    p_command_id, p_proposal_id, 'PREPARED', 'OFFERED_TO_FIRST', NULL, NULL, NULL);

  -- THE CANDIDATE IS NOT NOTIFIED. Nothing here creates a candidate-side view, a
  -- candidate-side pointer or any row a candidate can read, so their questions
  -- answer exactly as they would for a proposal that was never prepared.
  RETURN QUERY SELECT p_command_id, 'OFFERED_TO_FIRST'::text, p_view_id, view_result.disclosed_field_count;
END$$;

COMMENT ON FUNCTION public.offer_matching_proposal_to_first_core_v1(uuid, uuid, uuid, uuid) IS
  'Delivers the proposal to the FIRST recipient: revalidate, require CW2-08 '
  'clearance as the last gate, materialize that recipient''s own view through the '
  'disclosure gate, append the transition. The candidate is not notified and '
  'gains no readable row, so no "a proposal existed" oracle is created for them.';

CREATE FUNCTION public.forward_matching_proposal_to_second_core_v1(
  p_command_id uuid, p_proposal_id uuid, p_view_id uuid, p_permitted_conclusion_id uuid
) RETURNS TABLE(forward_transition_id uuid, forwarded_state text, forwarded_view_id uuid,
                forwarded_field_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  proposal public.matching_proposals;
  validity record;
  gate record;
  view_result record;
  committed_view uuid;
  already integer;
BEGIN
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  PERFORM public.lock_matching_pair_humans_v1(proposal.lower_user_id, proposal.higher_user_id);

  IF EXISTS (SELECT 1 FROM public.matching_proposal_transitions t
              WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
                AND t.prior_state = 'FIRST_FORWARD_APPROVED'
                AND t.resulting_state = 'FORWARDED_TO_SECOND') THEN
    SELECT st.current_view_id INTO committed_view
      FROM public.matching_recipient_proposal_view_state st
     WHERE st.proposal_id = p_proposal_id AND st.recipient_user_id = proposal.candidate_user_id;
    IF committed_view IS DISTINCT FROM p_view_id THEN
      RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    SELECT count(*)::int INTO already FROM public.matching_recipient_proposal_view_fields f
     WHERE f.view_id = committed_view;
    RETURN QUERY SELECT p_command_id, 'FORWARDED_TO_SECOND'::text, committed_view, already;
    RETURN;
  END IF;

  SELECT * INTO validity FROM public.resolve_matching_proposal_validity_v1(p_proposal_id);
  IF NOT validity.still_valid THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NO_LONGER_VALID' USING ERRCODE='40001',
      DETAIL='A material change between forward approval and forwarding revalidates the proposal rather than delivering on the authority that has already moved.';
  END IF;
  IF proposal.expires_at <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_EXPIRED' USING ERRCODE='55000';
  END IF;

  SELECT * INTO gate FROM public.resolve_matching_proposal_prerequisites_v1(p_proposal_id);
  IF gate.clearance <> 'CLEARED' THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL=gate.basis;
  END IF;

  -- AN INDEPENDENT DISCLOSURE, not a copy with the names swapped. The gate is
  -- asked for the CANDIDATE's own view: a different subject, a different
  -- disclosure authority, a different profile version and a conclusion written
  -- for them. There is no path here that reads the first recipient's view at all.
  SELECT * INTO view_result FROM public.materialize_matching_recipient_view_core_v1(
    p_view_id, p_proposal_id, proposal.candidate_user_id, p_permitted_conclusion_id);

  PERFORM public.append_matching_proposal_transition_v1(
    p_command_id, p_proposal_id, 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND', NULL, NULL, NULL);

  RETURN QUERY SELECT p_command_id, 'FORWARDED_TO_SECOND'::text, p_view_id, view_result.disclosed_field_count;
END$$;

COMMENT ON FUNCTION public.forward_matching_proposal_to_second_core_v1(uuid, uuid, uuid, uuid) IS
  'Delivers the INDEPENDENT second-recipient proposal after the first recipient '
  'approved forwarding. It materializes the candidate''s own view over their own '
  'subject, authority, profile version and recipient-specific conclusion; it '
  'never reads the first recipient''s view, so there is no copy path and no name '
  'swap. A material change between approval and forwarding revalidates rather '
  'than delivering.';

-- ---------------------------------------------------------------------------
-- 7. THE FOUR HUMAN DECISIONS.
--
--    Each derives its human from auth.uid() and takes NO actor parameter, each
--    binds the EXACT recipient view version that human saw, and each answers an
--    equivalent retry before it consults any gate - because a retry must not be
--    able to produce a different answer than the call it repeats.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.decline_matching_proposal_as_first_core_v1(
  p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid
) RETURNS TABLE(decline_transition_id uuid, declined_state text, neutral_outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  gate record;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);
  IF EXISTS (SELECT 1 FROM public.matching_proposal_transitions t
              WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
                AND t.resulting_state = 'FIRST_DECLINED' AND t.first_recipient_actor_id = u) THEN
    RETURN QUERY SELECT p_command_id, 'FIRST_DECLINED'::text, 'CLOSED_BY_YOU'::text; RETURN;
  END IF;
  PERFORM public.assert_matching_recipient_view_current_v1(p_proposal_id, u, p_expected_view_id, 'FIRST_RECIPIENT');

  SELECT * INTO gate FROM public.resolve_matching_proposal_prerequisites_v1(p_proposal_id);
  IF gate.clearance <> 'CLEARED' THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL=gate.basis;
  END IF;

  -- TERMINAL, AND THE CANDIDATE LEARNS NOTHING. No candidate-side row is
  -- created, no notification exists, no reciprocal proposal is made, and the
  -- reason is recorded where only private operational state lives.
  PERFORM public.append_matching_proposal_transition_v1(
    p_command_id, p_proposal_id, 'OFFERED_TO_FIRST', 'FIRST_DECLINED', u, NULL, 'RECIPIENT_DECLINED');

  RETURN QUERY SELECT p_command_id, 'FIRST_DECLINED'::text, 'CLOSED_BY_YOU'::text;
END$$;

COMMENT ON FUNCTION public.decline_matching_proposal_as_first_core_v1(uuid, uuid, uuid) IS
  'The first recipient declines, terminally. The candidate learns nothing: no '
  'candidate-side row, no notification, no audit projection and no reciprocal '
  'proposal exists, and the private decline reason never leaves the transition.';

CREATE FUNCTION public.approve_matching_proposal_forward_core_v1(
  p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid
) RETURNS TABLE(approval_transition_id uuid, approved_state text, neutral_outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  validity record;
  gate record;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);
  IF EXISTS (SELECT 1 FROM public.matching_proposal_transitions t
              WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
                AND t.resulting_state = 'FIRST_FORWARD_APPROVED' AND t.first_recipient_actor_id = u) THEN
    RETURN QUERY SELECT p_command_id, 'FIRST_FORWARD_APPROVED'::text, 'IN_PROGRESS'::text; RETURN;
  END IF;
  PERFORM public.assert_matching_recipient_view_current_v1(p_proposal_id, u, p_expected_view_id, 'FIRST_RECIPIENT');

  SELECT * INTO validity FROM public.resolve_matching_proposal_validity_v1(p_proposal_id);
  IF NOT validity.still_valid THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NO_LONGER_VALID' USING ERRCODE='40001';
  END IF;
  SELECT * INTO gate FROM public.resolve_matching_proposal_prerequisites_v1(p_proposal_id);
  IF gate.clearance <> 'CLEARED' THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL=gate.basis;
  END IF;

  -- FORWARD APPROVAL AUTHORIZES EXACTLY ONE THING: that QANDEEL may send THIS
  -- candidate an independent proposal about this human. It creates no Mutual
  -- Match, no World, no Introduction and no direct contact; it widens no I-07A
  -- disclosure authority; and it gives the second recipient no access to raw
  -- first-party Matching context. This body writes one transition and nothing
  -- else, which is the whole of the proof.
  PERFORM public.append_matching_proposal_transition_v1(
    p_command_id, p_proposal_id, 'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', u, NULL, NULL);

  RETURN QUERY SELECT p_command_id, 'FIRST_FORWARD_APPROVED'::text, 'IN_PROGRESS'::text;
END$$;

COMMENT ON FUNCTION public.approve_matching_proposal_forward_core_v1(uuid, uuid, uuid) IS
  'Explicit proposal-scoped human authority to send THIS candidate an '
  'independent proposal, bound to the exact view version the approver saw. It '
  'creates no Mutual Match, no World, no Introduction and no contact route, and '
  'widens no I-07A disclosure authority: it writes one transition.';

CREATE FUNCTION public.decline_matching_proposal_as_second_core_v1(
  p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid
) RETURNS TABLE(decline_transition_id uuid, declined_state text, neutral_outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  gate record;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);
  IF EXISTS (SELECT 1 FROM public.matching_proposal_transitions t
              WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
                AND t.resulting_state = 'SECOND_DECLINED' AND t.candidate_actor_id = u) THEN
    RETURN QUERY SELECT p_command_id, 'SECOND_DECLINED'::text, 'CLOSED_BY_YOU'::text; RETURN;
  END IF;
  PERFORM public.assert_matching_recipient_view_current_v1(p_proposal_id, u, p_expected_view_id, 'CANDIDATE');

  SELECT * INTO gate FROM public.resolve_matching_proposal_prerequisites_v1(p_proposal_id);
  IF gate.clearance <> 'CLEARED' THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL=gate.basis;
  END IF;

  -- THERE IS NO ACCEPTANCE COUNTERPART TO THIS FUNCTION IN I-07B, and the
  -- asymmetry is the point rather than an omission: declining is terminal and
  -- needs nothing but this proposal, while accepting must revalidate the exact
  -- view AND claim both humans' Introduction slots in one transaction.
  PERFORM public.append_matching_proposal_transition_v1(
    p_command_id, p_proposal_id, 'FORWARDED_TO_SECOND', 'SECOND_DECLINED', NULL, u, 'RECIPIENT_DECLINED');

  RETURN QUERY SELECT p_command_id, 'SECOND_DECLINED'::text, 'CLOSED_BY_YOU'::text;
END$$;

COMMENT ON FUNCTION public.decline_matching_proposal_as_second_core_v1(uuid, uuid, uuid) IS
  'The second recipient declines, terminally and privately. There is deliberately '
  'no acceptance counterpart in I-07B: acceptance must converge atomically with '
  'the Mutual Match transaction, and that is I-07C.';

CREATE FUNCTION public.withdraw_matching_proposal_core_v1(
  p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid, p_expected_state text
) RETURNS TABLE(withdraw_transition_id uuid, withdrawn_state text, neutral_outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_expected_state IS NULL
     OR p_expected_state NOT IN ('OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND') THEN
    RAISE EXCEPTION 'MATCHING_WITHDRAWAL_STATE_INVALID' USING ERRCODE='22023',
      DETAIL='A human withdraws a proposal they were shown. A PREPARED proposal has been shown to nobody, so no I-07B path withdraws one.';
  END IF;
  PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);
  -- The retry comparison pins the prior state too, because WITHDRAWN is legal
  -- from three of them: the same command id carrying a different expected state
  -- must fail closed rather than answer as though it matched.
  IF EXISTS (SELECT 1 FROM public.matching_proposal_transitions t
              WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
                AND t.resulting_state = 'WITHDRAWN' AND t.prior_state = p_expected_state
                AND t.first_recipient_actor_id = u) THEN
    RETURN QUERY SELECT p_command_id, 'WITHDRAWN'::text, 'CLOSED_BY_YOU'::text; RETURN;
  END IF;
  PERFORM public.assert_matching_recipient_view_current_v1(p_proposal_id, u, p_expected_view_id, 'FIRST_RECIPIENT');

  -- Withdrawal is the human ending their OWN exposure, so it is deliberately not
  -- gated on the launch prerequisite. A proposal that could not be withdrawn
  -- because a gate was unavailable would be the opposite of fail-closed.
  PERFORM public.append_matching_proposal_transition_v1(
    p_command_id, p_proposal_id, p_expected_state, 'WITHDRAWN', u, NULL, 'WITHDRAWN_BY_FIRST_PARTY');

  -- If the second recipient has already been shown a proposal, their delivered
  -- view is NOT erased and their projection now answers NO_LONGER_AVAILABLE -
  -- the same answer an expiry gives, with no reason, no timing detail and no
  -- hint that any other proposal activity exists.
  RETURN QUERY SELECT p_command_id, 'WITHDRAWN'::text, 'CLOSED_BY_YOU'::text;
END$$;

COMMENT ON FUNCTION public.withdraw_matching_proposal_core_v1(uuid, uuid, uuid, text) IS
  'The first party withdraws before any Mutual Match, binding the exact view '
  'version they hold and the exact current state. A second recipient who was '
  'already shown a proposal keeps their delivered view and is told only that it '
  'is no longer available - the same answer an expiry gives.';

-- ---------------------------------------------------------------------------
-- 8. EXPIRY AND STALENESS - the protective terminals, ungated on purpose.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.expire_matching_proposal_core_v1(p_command_id uuid, p_proposal_id uuid)
RETURNS TABLE(expiry_transition_id uuid, expired_state text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  proposal public.matching_proposals;
BEGIN
  IF EXISTS (SELECT 1 FROM public.matching_proposal_transitions t
              WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
                AND t.resulting_state = 'EXPIRED') THEN
    RETURN QUERY SELECT p_command_id, 'EXPIRED'::text; RETURN;
  END IF;
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  PERFORM public.lock_matching_pair_humans_v1(proposal.lower_user_id, proposal.higher_user_id);
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;

  IF proposal.proposal_state NOT IN ('PREPARED', 'OFFERED_TO_FIRST',
                                     'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND') THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_LIVE' USING ERRCODE='55000';
  END IF;
  -- THE DATABASE CLOCK DECIDES. There is no timestamp parameter through which a
  -- caller could supply one.
  IF proposal.expires_at > CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_YET_EXPIRED' USING ERRCODE='55000';
  END IF;

  PERFORM public.append_matching_proposal_transition_v1(
    p_command_id, p_proposal_id, proposal.proposal_state, 'EXPIRED', NULL, NULL, 'PROPOSAL_EXPIRED');
  RETURN QUERY SELECT p_command_id, 'EXPIRED'::text;
END$$;

COMMENT ON FUNCTION public.expire_matching_proposal_core_v1(uuid, uuid) IS
  'Expires one live proposal once the database clock has passed its deadline. It '
  'is deliberately not gated on the launch prerequisite: expiry ends exposure '
  'rather than creating it, and a proposal that outlived its expiry because a '
  'gate was unavailable would be the opposite of fail-closed.';

CREATE FUNCTION public.revalidate_matching_proposal_core_v1(p_command_id uuid, p_proposal_id uuid)
RETURNS TABLE(stale_transition_id uuid, current_state text, private_reason_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  proposal public.matching_proposals;
  validity record;
  committed public.matching_proposal_transitions;
BEGIN
  SELECT * INTO committed FROM public.matching_proposal_transitions t
   WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id AND t.resulting_state = 'STALE';
  IF FOUND THEN
    RETURN QUERY SELECT committed.id, 'STALE'::text, committed.private_reason_code; RETURN;
  END IF;
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  PERFORM public.lock_matching_pair_humans_v1(proposal.lower_user_id, proposal.higher_user_id);
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;

  IF proposal.proposal_state NOT IN ('PREPARED', 'OFFERED_TO_FIRST',
                                     'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND') THEN
    RETURN QUERY SELECT NULL::uuid, proposal.proposal_state, NULL::text; RETURN;
  END IF;

  SELECT * INTO validity FROM public.resolve_matching_proposal_validity_v1(p_proposal_id);
  IF validity.still_valid THEN
    RETURN QUERY SELECT NULL::uuid, proposal.proposal_state, NULL::text; RETURN;
  END IF;

  -- The proposal becomes terminal and DELIVERED VIEWS ARE NOT ERASED: what a
  -- human was already shown stays exactly as it was, and only what they may do
  -- next changes.
  PERFORM public.append_matching_proposal_transition_v1(
    p_command_id, p_proposal_id, proposal.proposal_state, 'STALE', NULL, NULL, validity.private_reason_code);
  RETURN QUERY SELECT p_command_id, 'STALE'::text, validity.private_reason_code;
END$$;

COMMENT ON FUNCTION public.revalidate_matching_proposal_core_v1(uuid, uuid) IS
  'Revalidates one live proposal against the humans'' current truth and makes it '
  'STALE when a pause, an opt-out, a new profile or requirement version, a '
  'changed grant or disclosure authority, a changed proposal policy or a newly '
  'active Introduction has moved underneath it. It erases no delivered view, and '
  'the private reason it records never reaches a recipient.';

-- ---------------------------------------------------------------------------
-- 9. THE NEUTRAL RECIPIENT PROJECTIONS.
--
--    The only I-07B boundaries shaped like something a human could be shown, and
--    the only ones whose result columns are audited as an audience contract.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_matching_proposal_neutral_outcome_v1(
  p_proposal_id uuid, p_viewer_user_id uuid
) RETURNS TABLE(neutral_outcome text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  proposal public.matching_proposals;
  role_of text;
  actor_is_viewer boolean;
BEGIN
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  role_of := CASE p_viewer_user_id WHEN proposal.first_recipient_user_id THEN 'FIRST_RECIPIENT'
                                   WHEN proposal.candidate_user_id THEN 'CANDIDATE' END;
  IF role_of IS NULL THEN RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;

  -- The one terminal both humans are by definition party to. What a matched
  -- human actually sees is the I-07C / I-07D Introduction surface, not this
  -- projection, and answering it here rather than collapsing it into the neutral
  -- terminal is what keeps this mapping from being wrong the day I-07C lands.
  IF proposal.proposal_state = 'MUTUAL_MATCH_COMMITTED' THEN
    RETURN QUERY SELECT 'MATCH_CONCLUDED'::text; RETURN;
  END IF;

  IF proposal.proposal_state IN ('PREPARED', 'OFFERED_TO_FIRST',
                                 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND') THEN
    IF (proposal.proposal_state = 'OFFERED_TO_FIRST' AND role_of = 'FIRST_RECIPIENT')
       OR (proposal.proposal_state = 'FORWARDED_TO_SECOND' AND role_of = 'CANDIDATE') THEN
      RETURN QUERY SELECT 'AWAITING_YOU'::text; RETURN;
    END IF;
    RETURN QUERY SELECT 'IN_PROGRESS'::text; RETURN;
  END IF;

  SELECT (CASE role_of WHEN 'FIRST_RECIPIENT' THEN t.first_recipient_actor_id = p_viewer_user_id
                       ELSE t.candidate_actor_id = p_viewer_user_id END)
    INTO actor_is_viewer
    FROM public.matching_proposal_transitions t WHERE t.id = proposal.current_transition_id;
  IF coalesce(actor_is_viewer, false) THEN
    RETURN QUERY SELECT 'CLOSED_BY_YOU'::text; RETURN;
  END IF;

  -- EVERY OTHER ENDING IS ONE ANSWER. A second decline, an expiry, a private
  -- invalidation, a withdrawal by the other party and a competing match that
  -- cancelled this proposal are indistinguishable here, which is the whole point.
  RETURN QUERY SELECT 'NO_LONGER_AVAILABLE'::text;
END$$;

COMMENT ON FUNCTION public.resolve_matching_proposal_neutral_outcome_v1(uuid, uuid) IS
  'The recipient-safe neutral projection of a proposal''s outcome. Every terminal '
  'that is not this viewer''s own act is ONE answer, so a decline, an expiry, a '
  'private invalidation, the other party''s withdrawal and a competing-match '
  'cancellation cannot be told apart. It is separate from the private event '
  'truth on purpose, and it never returns a terminal state name or a reason.';

CREATE FUNCTION public.resolve_my_matching_proposal_v1(p_proposal_id uuid)
RETURNS TABLE(recipient_view_id uuid, matching_proposal_id uuid, presented_first_name text,
              safe_compatibility_conclusion text, neutral_outcome text, action_available boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  current_view uuid;
  view_row public.matching_recipient_proposal_views;
  outcome text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  -- The human is derived from auth.uid() and there is NO recipient parameter, so
  -- a caller cannot even phrase a question about somebody else's proposal. A
  -- proposal this caller holds no current view of answers with the SAME bounded
  -- not-found as one that never existed.
  SELECT st.current_view_id INTO current_view
    FROM public.matching_recipient_proposal_view_state st
   WHERE st.proposal_id = p_proposal_id AND st.recipient_user_id = u;
  IF current_view IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO view_row FROM public.matching_recipient_proposal_views v WHERE v.id = current_view;
  SELECT n.neutral_outcome INTO outcome
    FROM public.resolve_matching_proposal_neutral_outcome_v1(p_proposal_id, u) n;

  -- WHAT IS RETURNED IS THE WHOLE OF WHAT MAY BE: an opaque view identity, an
  -- opaque proposal identity, a first name, the filtered safe conclusion, a
  -- neutral outcome and whether this human may act. There is no counterparty
  -- user id, no snapshot, no authority, no profile version, no requirement, no
  -- evidence, no provenance, no private reason and no terminal state name.
  RETURN QUERY
    SELECT view_row.id, view_row.proposal_id, view_row.subject_first_name,
           c.permitted_text, outcome, (outcome = 'AWAITING_YOU')
      FROM public.matching_permitted_safe_conclusions c
     WHERE c.id = view_row.permitted_conclusion_id;
END$$;

COMMENT ON FUNCTION public.resolve_my_matching_proposal_v1(uuid) IS
  'The caller''s own current recipient proposal view, derived from auth.uid() '
  'with no recipient parameter at all. It answers with an opaque view identity, '
  'an opaque proposal identity, a first name, the filtered safe conclusion, a '
  'neutral outcome and one affordance - never the counterparty''s stable '
  'identifier, never private evidence or provenance, never a terminal state name '
  'and never the reason anything ended.';

CREATE FUNCTION public.resolve_my_matching_proposal_fields_v1(p_proposal_id uuid)
RETURNS TABLE(disclosed_field_key text, disclosed_field_value text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  current_view uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT st.current_view_id INTO current_view
    FROM public.matching_recipient_proposal_view_state st
   WHERE st.proposal_id = p_proposal_id AND st.recipient_user_id = u;
  IF current_view IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  RETURN QUERY SELECT f.field_key, f.disclosed_value
    FROM public.matching_recipient_proposal_view_fields f
   WHERE f.view_id = current_view ORDER BY f.field_key;
END$$;

COMMENT ON FUNCTION public.resolve_my_matching_proposal_fields_v1(uuid) IS
  'The approved, Product-permitted, value-filtered field set of the caller''s own '
  'current recipient view. Every row it can return already crossed both '
  'disclosure gates at materialization time; this reads what the gate wrote and '
  'decides nothing.';

-- ---------------------------------------------------------------------------
-- 10. OWNERSHIP AND LEAST-PRIVILEGE ACL. Still nobody.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  boundary text;
BEGIN
  FOREACH boundary IN ARRAY ARRAY[
    'public.resolve_matching_snapshot_validity_v1(uuid)',
    'public.resolve_matching_proposal_validity_v1(uuid)',
    'public.append_matching_proposal_transition_v1(uuid,uuid,text,text,uuid,uuid,text)',
    'public.enter_matching_proposal_decision_v1(uuid,uuid)',
    'public.assert_matching_recipient_view_current_v1(uuid,uuid,uuid,text)',
    'public.prepare_matching_proposal_core_v1(uuid,uuid,uuid)',
    'public.offer_matching_proposal_to_first_core_v1(uuid,uuid,uuid,uuid)',
    'public.forward_matching_proposal_to_second_core_v1(uuid,uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_first_core_v1(uuid,uuid,uuid)',
    'public.approve_matching_proposal_forward_core_v1(uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_second_core_v1(uuid,uuid,uuid)',
    'public.withdraw_matching_proposal_core_v1(uuid,uuid,uuid,text)',
    'public.expire_matching_proposal_core_v1(uuid,uuid)',
    'public.revalidate_matching_proposal_core_v1(uuid,uuid)',
    'public.resolve_matching_proposal_neutral_outcome_v1(uuid,uuid)',
    'public.resolve_my_matching_proposal_v1(uuid)',
    'public.resolve_my_matching_proposal_fields_v1(uuid)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', boundary);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', boundary);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', boundary);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 11. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  all_boundaries text[] := ARRAY[
    'public.resolve_matching_snapshot_validity_v1(uuid)',
    'public.resolve_matching_proposal_validity_v1(uuid)',
    'public.append_matching_proposal_transition_v1(uuid,uuid,text,text,uuid,uuid,text)',
    'public.enter_matching_proposal_decision_v1(uuid,uuid)',
    'public.assert_matching_recipient_view_current_v1(uuid,uuid,uuid,text)',
    'public.prepare_matching_proposal_core_v1(uuid,uuid,uuid)',
    'public.offer_matching_proposal_to_first_core_v1(uuid,uuid,uuid,uuid)',
    'public.forward_matching_proposal_to_second_core_v1(uuid,uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_first_core_v1(uuid,uuid,uuid)',
    'public.approve_matching_proposal_forward_core_v1(uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_second_core_v1(uuid,uuid,uuid)',
    'public.withdraw_matching_proposal_core_v1(uuid,uuid,uuid,text)',
    'public.expire_matching_proposal_core_v1(uuid,uuid)',
    'public.revalidate_matching_proposal_core_v1(uuid,uuid)',
    'public.resolve_matching_proposal_neutral_outcome_v1(uuid,uuid)',
    'public.resolve_my_matching_proposal_v1(uuid)',
    'public.resolve_my_matching_proposal_fields_v1(uuid)'];
  human_decisions text[] := ARRAY[
    'public.decline_matching_proposal_as_first_core_v1(uuid,uuid,uuid)',
    'public.approve_matching_proposal_forward_core_v1(uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_second_core_v1(uuid,uuid,uuid)',
    'public.withdraw_matching_proposal_core_v1(uuid,uuid,uuid,text)'];
  audience_facing text[] := ARRAY[
    'public.resolve_my_matching_proposal_v1(uuid)',
    'public.resolve_my_matching_proposal_fields_v1(uuid)'];
  cleared_required text[] := ARRAY[
    'public.offer_matching_proposal_to_first_core_v1(uuid,uuid,uuid,uuid)',
    'public.forward_matching_proposal_to_second_core_v1(uuid,uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_first_core_v1(uuid,uuid,uuid)',
    'public.approve_matching_proposal_forward_core_v1(uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_second_core_v1(uuid,uuid,uuid)'];
  protective text[] := ARRAY[
    'public.expire_matching_proposal_core_v1(uuid,uuid)',
    'public.revalidate_matching_proposal_core_v1(uuid,uuid)',
    'public.withdraw_matching_proposal_core_v1(uuid,uuid,uuid,text)'];
  fn text;
  p record;
  target_role text;
  offending text;
  cleaned text;
BEGIN
  FOREACH fn IN ARRAY all_boundaries LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc,
           pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-07B: % must be postgres-owned', fn; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-07B: % must be SECURITY DEFINER', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-07B: % must pin an empty search_path', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-07B: PUBLIC must not execute %', fn;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-07B: % must not execute % before the CW2-08 Launch Gate exists', target_role, fn;
      END IF;
    END LOOP;
    -- NOTHING REWRITES OR ERASES HISTORY. The proposal row's current pointer is
    -- the one thing an UPDATE may touch, and the 0110 truth trigger bounds that.
    IF p.prosrc ~* '(DELETE FROM|TRUNCATE)'
       OR p.prosrc ~ ('UPDATE public\.(matching_proposal_transitions|matching_recipient_proposal_views'
                   || '|matching_recipient_proposal_view_fields|matching_eligibility_snapshots'
                   || '|matching_hard_requirement_results|matching_permitted_safe_conclusions'
                   || '|matching_sensitive_filter_refusals|matching_private_reasoning_notes'
                   || '|matching_pairs|matching_proposal_policy_versions)') THEN
      RAISE EXCEPTION 'I-07B: % may never rewrite or erase Matching history', fn;
    END IF;
    -- NO CALLER-SUPPLIED CLOCK. The INPUT parameter names are read from
    -- proargnames/proargmodes rather than from pg_get_function_arguments,
    -- because for a RETURNS TABLE function that form also reports the RESULT
    -- columns - several of which legitimately name an instant.
    SELECT string_agg(a.name, ', ') INTO offending
      FROM pg_proc pr,
           LATERAL unnest(pr.proargnames,
                          coalesce(pr.proargmodes,
                                   array_fill('i'::"char",
                                              ARRAY[coalesce(array_length(pr.proargnames, 1), 0)])))
             AS a(name, mode)
     WHERE pr.oid = fn::regprocedure AND a.mode = 'i'
       AND a.name ~* '(timestamp|_at$|occurred|clock|now)';
    IF offending IS NOT NULL THEN
      RAISE EXCEPTION 'I-07B: % must not accept a caller-supplied instant: %', fn, offending;
    END IF;
  END LOOP;

  -- THE FOUR HUMAN DECISIONS DERIVE THEIR HUMAN FROM auth.uid() AND TAKE NO
  -- ACTOR. This is what lets I-09 grant EXECUTE later with no step that turns a
  -- system credential into human consent.
  FOREACH fn IN ARRAY human_decisions LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc !~ 'auth\.uid\(\)' THEN
      RAISE EXCEPTION 'I-07B: % is a human decision and must derive its human from auth.uid()', fn;
    END IF;
    IF p.prosrc !~ 'assert_matching_recipient_view_current_v1' THEN
      RAISE EXCEPTION 'I-07B: % must bind the exact recipient view version the human saw', fn;
    END IF;
    -- THE EXACT-VIEW CHECK IS INSIDE THE SERIALIZED REGION, and the order is
    -- what makes it true. `materialize_matching_recipient_view_core_v1`
    -- supersedes a view while holding the canonical two-human lock, so a
    -- decision that checked the view BEFORE taking that lock could accept V1,
    -- wait for the lock, and act on a view the concurrent transaction has since
    -- replaced. The compare-and-swap on the proposal state does not close that
    -- window, because materializing a view does not change the proposal state.
    --
    -- Comment lines are removed before the positions are compared, because the
    -- prose above names both functions in the opposite order in order to explain
    -- the order, and `prosrc` includes comments.
    SELECT string_agg(l.line, E'\n' ORDER BY l.n) INTO cleaned
      FROM regexp_split_to_table(p.prosrc, E'\n') WITH ORDINALITY AS l(line, n)
     WHERE btrim(l.line) NOT LIKE '--%';
    IF strpos(cleaned, 'enter_matching_proposal_decision_v1') = 0
       OR strpos(cleaned, 'assert_matching_recipient_view_current_v1') = 0
       OR strpos(cleaned, 'enter_matching_proposal_decision_v1')
          > strpos(cleaned, 'assert_matching_recipient_view_current_v1') THEN
      RAISE EXCEPTION 'I-07B: % must enter the canonical two-human serialization region BEFORE it checks the exact recipient view, or a concurrent materialization can supersede that view between the check and the act', fn;
    END IF;
    SELECT string_agg(a.name, ', ') INTO offending
      FROM pg_proc pr,
           LATERAL unnest(pr.proargnames,
                          coalesce(pr.proargmodes,
                                   array_fill('i'::"char",
                                              ARRAY[coalesce(array_length(pr.proargnames, 1), 0)])))
             AS a(name, mode)
     WHERE pr.oid = fn::regprocedure AND a.mode = 'i'
       AND a.name ~* '(user|human|actor|recipient_user|grantor|owner|subject|on_behalf|candidate)';
    IF offending IS NOT NULL THEN
      RAISE EXCEPTION 'I-07B: % must not accept an identity parameter: %', fn, offending;
    END IF;
  END LOOP;

  -- THE CW2-08 GATE IS REQUIRED WHERE IT MUST BE, AND ABSENT WHERE IT MUST NOT.
  FOREACH fn IN ARRAY cleared_required LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc !~ 'resolve_matching_proposal_prerequisites_v1' OR p.prosrc !~ '''CLEARED''' THEN
      RAISE EXCEPTION 'I-07B: % must require exactly CLEARED from the CW2-08 prerequisite seam', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY protective LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc ~ 'resolve_matching_proposal_prerequisites_v1' THEN
      RAISE EXCEPTION 'I-07B: % ends exposure rather than creating it and must not be gated on an unavailable launch gate', fn;
    END IF;
  END LOOP;

  -- THE AUDIENCE CONTRACT. A recipient projection answers with an opaque view
  -- identity, an opaque proposal identity, a first name, the filtered
  -- conclusion, a neutral outcome and an affordance. Anything else is a leak,
  -- and this refuses it BY NAME rather than by review.
  FOREACH fn IN ARRAY audience_facing LOOP
    SELECT pr.provolatile, pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-07B: % must be STABLE and write nothing', fn; END IF;
    IF p.prosrc !~ 'auth\.uid\(\)' THEN
      RAISE EXCEPTION 'I-07B: % must derive its human from auth.uid() and take no recipient parameter', fn;
    END IF;
    IF p.prosrc ~ ('public\.(matching_private_reasoning_notes|matching_sensitive_filter_refusals'
                || '|matching_hard_requirement_results|matching_eligibility_snapshots'
                || '|matching_safe_conclusion_candidates|matching_pairs)') THEN
      RAISE EXCEPTION 'I-07B: % may not read private evaluation state', fn;
    END IF;
    SELECT string_agg(a.name, ', ') INTO offending
      FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS a(name, mode)
     WHERE pr.oid = fn::regprocedure AND a.mode = 't'
       AND a.name ~* ('(user_id|subject|candidate|counterpart|auth|email|phone|contact|handle'
                   || '|snapshot|authority|profile_version|requirement|evidence|provenance|source'
                   || '|private|reason|score|rank|percent|pair|proposal_state|world|session)');
    IF offending IS NOT NULL THEN
      RAISE EXCEPTION 'I-07B: a recipient projection may not return %: %', fn, offending;
    END IF;
  END LOOP;

  -- THERE IS NO SECOND ACCEPTANCE ANYWHERE IN THE MATCHING NAMESPACE.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.proname ~* 'matching'
     AND pr.prosrc ~* '(SECOND_ACCEPTED|ACCEPTED_PENDING_MATCH|MATCH_PENDING|INTRODUCTION_RESERVED)';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07B: there is no second acceptance state and nothing may spell one; found %', offending;
  END IF;

  -- EXACTLY ONE FUNCTION WRITES A PROPOSAL TRANSITION.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\.matching_proposal_transitions'
     AND pr.proname <> 'append_matching_proposal_transition_v1';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07B: exactly one function writes a proposal transition; found %', offending;
  END IF;

  -- THE TWO RESERVED I-07C STATES HAVE NO PRODUCER. The scan is bounded to the
  -- functions that actually WRITE a transition, because the neutral projection
  -- legitimately READS `MUTUAL_MATCH_COMMITTED` in order to project it and
  -- writes nothing at all - it is asserted STABLE above.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public'
     AND pr.prosrc ~ 'append_matching_proposal_transition_v1'
     AND pr.prosrc ~ '(''MUTUAL_MATCH_COMMITTED''|''CANCELLED_BY_COMPETING_MATCH'')';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07B: the two reserved I-07C states are representable and have no I-07B producer; found %', offending;
  END IF;

  -- NO SHARED WORLD OR INTRODUCTION BIRTH, AND NO MATCH HANDOFF PACKAGE.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.proname ~* 'matching'
     AND (pr.prosrc ~ 'INSERT INTO public\.(shared_worlds|shared_world_membership_episodes)'
       OR pr.prosrc ~* 'MATCH_HANDOFF');
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07B: Shared World birth, Introduction birth and the Match handoff package belong to I-07C; found %', offending;
  END IF;

  -- THE I-07A BOUNDARY IS UNCHANGED, AND THE I-07B SUBSTRATE IS STILL SEALED.
  IF NOT has_function_privilege('authenticated', 'public.get_my_matching_setup_v1()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.get_my_matching_setup_v1()', 'EXECUTE') THEN
    RAISE EXCEPTION 'I-07B: the I-07A human command boundary must be exactly as 0109 left it';
  END IF;
  FOREACH fn IN ARRAY ARRAY['public.matching_proposals', 'public.matching_proposal_transitions',
                            'public.matching_recipient_proposal_views',
                            'public.matching_recipient_proposal_view_fields',
                            'public.matching_private_reasoning_notes'] LOOP
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_table_privilege(target_role, fn, 'SELECT') THEN
        RAISE EXCEPTION 'I-07B: % must not hold SELECT on %', target_role, fn;
      END IF;
    END LOOP;
  END LOOP;
END$$;

COMMIT;
