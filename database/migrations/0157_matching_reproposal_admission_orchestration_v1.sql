-- S6-03 - Automatic re-proposal protection, the pre-preparation admission, the internal orchestrator and sweeper, and
-- the preparation instant v1.
--
-- Product authority: the Product Owner's S6-03 Task Contract v1.3 (2026-10-15; D5, D6, C5, C6, R1, R2) and the
-- Controlled Amendment CW2-06B approved on 2026-10-15 (with R4-A and R4-B). This migration realizes CW2-06B-14 and
-- CW2-06B-15, and the R4-A preparation instant of CW2-06B-05 §7. The execution record is
-- docs/e2e/QANDEEL_S6_03_IMPLEMENTATION_RECORD_v1.md.
--
-- ## What is added
--
--   1. public.resolve_matching_pair_reproposal_block_v1 - the continuing automatic block on re-proposal, until a
--      Stage 9 policy is approved, of a canonical unordered pair any of whose proposals ever reached FIRST_DECLINED,
--      SECOND_DECLINED, WITHDRAWN, EXPIRED (PREPARED -> EXPIRED that no human saw included) or MUTUAL_MATCH_COMMITTED
--      (which covers both later Introduction outcomes). It is DERIVED from the immutable transition chain - no
--      rejection ledger, no cooldown - and STALE and CANCELLED_BY_COMPETING_MATCH do not block. EXPIRED is not a
--      refusal: nothing records it as one and nothing projects it as one.
--   2. public.resolve_matching_compatibility_producer_readiness_v1 - the Stage 8A producer seam: UNAVAILABLE.
--   3. public.resolve_matching_pair_prerequisites_v1 - the pair-scoped CW2-08 seam: NOT_EVALUATED, exactly like the
--      proposal-scoped one, which is untouched.
--   4. public.resolve_matching_pair_admission_v1 - the fail-closed pre-preparation admission, decided before any pair,
--      snapshot or proposal is written. Today it never admits.
--   5. public.orchestrate_matching_proposal_preparation_core_v1 and public.sweep_matching_proposals_core_v1 - internal,
--      bounded, executable by no role; no worker, no schedule, no grant. The orchestrator writes nothing today; the
--      sweeper uses only the existing expiry and revalidation cores and needs no clearance.
--
-- ## What is redefined forward (CREATE OR REPLACE; same signature; owner and ACL re-asserted)
--
--   * discover_matching_candidates_core_v1 - also requires both humans' current confirmed facts to satisfy the pair
--     rule, and excludes a blocked pair. Still read-only, bounded and unranked.
--   * prepare_matching_proposal_core_v1 (replaced once, here) - the re-proposal block under the existing pair lock;
--     and R4-A: the deadline is still minted from the transaction instant, but the decision to create the proposal
--     is taken against ONE real instant captured as the last step before the first write - refusing
--     MATCHING_PROPOSAL_EXPIRED when the deadline has already passed and MATCHING_ELIGIBILITY_HORIZON_EXCEEDED when
--     the deadline would outlive the age-certainty horizon of an AGE_RANGE PASS. Either refusal writes nothing.
--
-- ## What is deliberately NOT here
--
--   * No change to any 0114 function, nor to the 0120 offer, forward, decline or withdraw cores, nor to the expiry and
--     revalidation cores; no proposal-scoped seam is cleared or claimed cleared.
--   * No worker, schedule, route, grant, policy row, real proposal or private compatibility note.
--
-- Forward-only. Migrations 0001-0156 are byte-unchanged.
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE AUTOMATIC RE-PROPOSAL BLOCK (CW2-06B-14).
--
--    Read from the immutable transition chain of the pair's proposals. The pair
--    is unordered, so reversing the direction reaches the same rows; another
--    pair is never blocked by one human's history with somebody else; and
--    nothing here lapses with time, restart, resume, 0117 reactivation or the
--    end or completion of an Introduction. Only a later reviewed Stage 9 policy,
--    under its own Controlled Amendment, may define a relaxation, and the
--    absence of one is never permission.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_matching_pair_reproposal_block_v1(p_user_a uuid, p_user_b uuid)
RETURNS TABLE (blocked boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  lo uuid;
  hi uuid;
BEGIN
  SELECT c.lower_user_id, c.higher_user_id INTO lo, hi FROM public.matching_canonical_pair_v1(p_user_a, p_user_b) c;
  IF lo IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PAIR_MEMBERS_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY SELECT EXISTS (
    SELECT 1
      FROM public.matching_pairs pr
      JOIN public.matching_proposals p ON p.pair_id = pr.id
      JOIN public.matching_proposal_transitions t ON t.proposal_id = p.id
     WHERE pr.lower_user_id = lo AND pr.higher_user_id = hi
       AND t.resulting_state IN ('FIRST_DECLINED', 'SECOND_DECLINED', 'WITHDRAWN', 'EXPIRED',
                                 'MUTUAL_MATCH_COMMITTED'));
END$$;

COMMENT ON FUNCTION public.resolve_matching_pair_reproposal_block_v1(uuid, uuid) IS
  'The continuing automatic block on re-proposal of a canonical unordered pair, until a Stage 9 policy is approved '
  '(CW2-06B-14). Derived from the immutable transition chain; no ledger and no cooldown. EXPIRED blocks and is not a '
  'refusal; STALE and CANCELLED_BY_COMPETING_MATCH do not block.';

-- ---------------------------------------------------------------------------
-- 2. THE TWO PREREQUISITE SEAMS (CW2-06B-15 §1, §3).
--
--    Each answers its one truthful value and cannot answer otherwise; a
--    self-assertion below proves it. Neither makes a model call, imports a
--    router or falls back to anything.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_matching_compatibility_producer_readiness_v1()
RETURNS TABLE (readiness text, basis text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- The only truthful answer today. The real Safe Compatibility Conclusion
  -- producer is Stage 8A's and it is not real, evaluated and approved; there is
  -- no fallback producer, and an eligibility PASS is never a conclusion.
  RETURN QUERY SELECT 'UNAVAILABLE'::text,
    ('The Stage 8A Safe Compatibility Conclusion producer is not available, evaluated and approved, '
     || 'so no proposal can be prepared.')::text;
END$$;

CREATE FUNCTION public.resolve_matching_pair_prerequisites_v1(p_user_a uuid, p_user_b uuid)
RETURNS TABLE (clearance text, basis text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- The pair-scoped twin of the proposal-scoped CW2-08 seam, and the same
  -- truthful answer: no canonical CW2-08 runtime exists, so nothing is cleared.
  RETURN QUERY SELECT 'NOT_EVALUATED'::text,
    ('CW2-08 safety, moderation, entitlement, feature and Launch Gate evaluation has no canonical '
     || 'runtime in this repository, so no pair is cleared for preparation.')::text;
END$$;

-- ---------------------------------------------------------------------------
-- 3. THE PRE-PREPARATION ADMISSION (CW2-06B-15 §3-4).
--
--    Evaluated before any pair, snapshot or proposal is written. ADMITTED only
--    when both humans are currently matchable and hold no active Introduction,
--    the pair rule passes on their current confirmed facts, the pair is not
--    blocked, every required policy is configured, the producer seam answers
--    READY and the pair-scoped CW2-08 seam answers CLEARED. Today it never
--    admits, so no PREPARED row is written that a later check already knew could
--    not be delivered.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_matching_pair_admission_v1(p_user_a uuid, p_user_b uuid)
RETURNS TABLE (admission text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  lo uuid;
  hi uuid;
  low_facts record;
  high_facts record;
BEGIN
  SELECT c.lower_user_id, c.higher_user_id INTO lo, hi FROM public.matching_canonical_pair_v1(p_user_a, p_user_b) c;
  IF lo IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PAIR_MEMBERS_INVALID' USING ERRCODE='22023';
  END IF;
  IF NOT (SELECT r.matchable FROM public.resolve_matching_setup_state_v1(lo) r)
     OR NOT (SELECT r.matchable FROM public.resolve_matching_setup_state_v1(hi) r)
     OR (SELECT r.has_active_introduction FROM public.resolve_matching_active_introduction_v1(lo) r)
     OR (SELECT r.has_active_introduction FROM public.resolve_matching_active_introduction_v1(hi) r) THEN
    RETURN QUERY SELECT 'NOT_MATCHABLE'::text; RETURN;
  END IF;
  SELECT * INTO low_facts FROM public.resolve_matching_confirmed_facts_v1(lo);
  SELECT * INTO high_facts FROM public.resolve_matching_confirmed_facts_v1(hi);
  IF low_facts.sex IS NULL OR high_facts.sex IS NULL OR low_facts.sex = high_facts.sex THEN
    RETURN QUERY SELECT 'PAIR_RULE_NOT_SATISFIED'::text; RETURN;
  END IF;
  IF (SELECT b.blocked FROM public.resolve_matching_pair_reproposal_block_v1(lo, hi) b) THEN
    RETURN QUERY SELECT 'REPROPOSAL_BLOCKED'::text; RETURN;
  END IF;
  IF (SELECT count(*) FROM public.matching_proposal_policy_state st
       WHERE st.policy_kind IN ('PROPOSAL_CADENCE', 'PENDING_PROPOSAL_LIMIT', 'PROPOSAL_EXPIRY',
                                'PROPOSAL_SAFE_FIELDS', 'SENSITIVE_CONCLUSION_FILTER')) <> 5 THEN
    RETURN QUERY SELECT 'POLICY_UNCONFIGURED'::text; RETURN;
  END IF;
  IF (SELECT r.readiness FROM public.resolve_matching_compatibility_producer_readiness_v1() r) IS DISTINCT FROM 'READY' THEN
    RETURN QUERY SELECT 'PRODUCER_UNAVAILABLE'::text; RETURN;
  END IF;
  IF (SELECT r.clearance FROM public.resolve_matching_pair_prerequisites_v1(lo, hi) r) IS DISTINCT FROM 'CLEARED' THEN
    RETURN QUERY SELECT 'PREREQUISITES_NOT_CLEARED'::text; RETURN;
  END IF;
  RETURN QUERY SELECT 'ADMITTED'::text;
END$$;

-- ---------------------------------------------------------------------------
-- 4. CANDIDATE DISCOVERY: THE PAIR RULE AND THE BLOCK (CW2-06B-05 §2, CW2-06B-14 §4).
--
--   A candidate is also one whose CURRENT confirmed sex is present and differs from the human's own, and whose pair
--   with the human is not under the automatic re-proposal block. Still read-only, bounded, unranked, and reaching no
--   human.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.discover_matching_candidates_core_v1(p_for_user_id uuid, p_max integer)
 RETURNS TABLE(candidate_user_id uuid, lower_user_id uuid, higher_user_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  self_state record;
  self_facts record;
BEGIN
  IF p_for_user_id IS NULL OR p_max IS NULL OR p_max <= 0 OR p_max > 200 THEN
    RAISE EXCEPTION 'MATCHING_DISCOVERY_REQUEST_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO self_state FROM public.resolve_matching_setup_state_v1(p_for_user_id);
  IF NOT self_state.matchable THEN
    RAISE EXCEPTION 'MATCHING_PARTICIPATION_NOT_MATCHABLE' USING ERRCODE='55000',
      DETAIL='Candidate discovery reads CURRENT eligibility truth and never a cached participation fact.';
  END IF;
  IF (SELECT r.has_active_introduction FROM public.resolve_matching_active_introduction_v1(p_for_user_id) r) THEN
    RAISE EXCEPTION 'MATCHING_ACTIVE_INTRODUCTION_PRESENT' USING ERRCODE='55000';
  END IF;
  -- S6-03 (CW2-06B-05): the Product pair rule reads current confirmed facts only.
  SELECT * INTO self_facts FROM public.resolve_matching_confirmed_facts_v1(p_for_user_id);

  -- Ordering is by canonical identifier, for determinism and for nothing else.
  -- There is no rank, no score, no compatibility percentage and no desirability
  -- order anywhere in this body, and the result is a bounded internal list that
  -- reaches no human and notifies no candidate.
  RETURN QUERY
    SELECT c.participant_user_id,
           least(p_for_user_id, c.participant_user_id),
           greatest(p_for_user_id, c.participant_user_id)
      FROM public.matching_participation_state s
      JOIN public.matching_participation_events c ON c.id = s.current_event_id
     WHERE c.participant_user_id <> p_for_user_id
       AND self_facts.sex IS NOT NULL
       AND (SELECT f.sex FROM public.resolve_matching_confirmed_facts_v1(c.participant_user_id) f)
           IS DISTINCT FROM self_facts.sex
       AND (SELECT f.sex FROM public.resolve_matching_confirmed_facts_v1(c.participant_user_id) f) IS NOT NULL
       AND NOT (SELECT b.blocked
                  FROM public.resolve_matching_pair_reproposal_block_v1(p_for_user_id, c.participant_user_id) b)
       AND (SELECT r.matchable FROM public.resolve_matching_setup_state_v1(c.participant_user_id) r)
       AND NOT (SELECT r.has_active_introduction
                  FROM public.resolve_matching_active_introduction_v1(c.participant_user_id) r)
       AND NOT EXISTS (
             SELECT 1 FROM public.matching_proposals prop
              JOIN public.matching_pairs pr ON pr.id = prop.pair_id
             WHERE pr.lower_user_id = least(p_for_user_id, c.participant_user_id)
               AND pr.higher_user_id = greatest(p_for_user_id, c.participant_user_id)
               AND prop.proposal_state IN ('PREPARED', 'OFFERED_TO_FIRST',
                                           'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND'))
     ORDER BY c.participant_user_id
     LIMIT p_max;
END$function$;

-- ---------------------------------------------------------------------------
-- 5. PREPARATION: THE BLOCK UNDER THE PAIR LOCK, AND THE PREPARATION INSTANT (CW2-06B-14 §4, CW2-06B-05 §7 R4-A).
--
--   Replaced once, here. The order is: the canonical pair lock; the equivalent-retry answer from the committed row;
--   revalidation; the re-proposal block; cadence and pending; the deadline, still minted from the classified-safe
--   transaction instant; H_min, the smallest age-certainty horizon of the snapshot's AGE_RANGE PASS results, read
--   under the pair lock; ONE real instant, captured as the last step before the first write; the two refusals; the
--   first write. The real instant is used only in the two refusals and is never stored, so no proposal's life is
--   lengthened; either refusal writes nothing at all.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_matching_proposal_core_v1(p_proposal_id uuid, p_eligibility_snapshot_id uuid, p_first_recipient_user_id uuid)
 RETURNS TABLE(prepared_proposal_id uuid, prepared_pair_id uuid, prepared_first_recipient_id uuid, prepared_candidate_id uuid, prepared_state text, expiry_instant timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  horizon timestamptz;
  checked_at timestamptz;
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

  -- S6-03 (CW2-06B-14): no automatic re-proposal of a blocked pair, decided
  -- inside the same two-human serialization region every terminal transition
  -- and the Mutual Match commit hold.
  IF (SELECT b.blocked FROM public.resolve_matching_pair_reproposal_block_v1(snapshot.lower_user_id, snapshot.higher_user_id) b) THEN
    RAISE EXCEPTION 'MATCHING_PAIR_REPROPOSAL_BLOCKED' USING ERRCODE='55000',
      DETAIL='This pair is under the continuing automatic block on re-proposal until a Stage 9 policy is approved.';
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

  -- S6-03 (R4): an age PASS is certain only before its horizon, so the
  -- proposal may live only while every AGE_RANGE PASS of this snapshot stays
  -- certain. No AGE_RANGE PASS means no horizon condition.
  SELECT min(public.matching_structured_age_horizon_v1(f.birth_year, f.birth_month, a.max_age)) INTO horizon
    FROM public.matching_hard_requirement_results r
    JOIN public.matching_requirement_items i
      ON i.requirement_version_id = r.requirement_version_id AND i.requirement_key = r.requirement_key
    JOIN public.matching_eligibility_snapshot_fact_bindings b ON b.eligibility_snapshot_id = r.eligibility_snapshot_id
    JOIN public.matching_confirmed_fact_versions f
      ON f.id = CASE r.evaluated_for_user_id WHEN b.lower_user_id THEN b.higher_fact_version_id
                                             ELSE b.lower_fact_version_id END
    CROSS JOIN LATERAL public.matching_structured_age_range_v1(i.requirement_value) a
   WHERE r.eligibility_snapshot_id = p_eligibility_snapshot_id AND r.requirement_key = 'age_range_v1'
     AND r.requirement_outcome = 'PASS';

  -- S6-03 (R4-A): the transaction instant above was fixed before this call
  -- waited on the pair lock, so it decides no creation. The decision is taken
  -- against the real instant, read exactly once, here, as the last step before
  -- the first write; it never becomes the deadline or any stored value.
  checked_at := clock_timestamp();
  IF deadline <= checked_at THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_EXPIRED' USING ERRCODE='55000';
  END IF;
  IF deadline >= horizon THEN
    RAISE EXCEPTION 'MATCHING_ELIGIBILITY_HORIZON_EXCEEDED' USING ERRCODE='55000',
      DETAIL='The configured expiry would carry this proposal past the instant an age requirement it was judged against stops being certain. The deadline is never shortened to fit.';
  END IF;

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
END$function$;

-- ---------------------------------------------------------------------------
-- 6. THE INTERNAL ORCHESTRATOR (CW2-06B-15, CP5.2).
--
--    discovery -> admission -> (only if admitted) pair -> capture ->
--    deterministic evaluation -> preparation, bounded, for one human as the
--    first recipient. It reuses the canonical cores and nothing else, and every
--    one of them takes its own locks. A candidate that is not admitted costs no
--    write at all; an admitted attempt that any core refuses is rolled back as a
--    whole, so no pair, snapshot or result of it survives. It is executable by
--    no role, no worker or schedule calls it, and today the admission never
--    admits, so it writes nothing.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.orchestrate_matching_proposal_preparation_core_v1(p_for_user_id uuid, p_max integer)
RETURNS TABLE (examined integer, admitted integer, prepared integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  candidate record;
  ensured record;
  snapshot_id uuid;
  n_examined integer := 0;
  n_admitted integer := 0;
  n_prepared integer := 0;
BEGIN
  IF p_for_user_id IS NULL OR p_max IS NULL OR p_max <= 0 OR p_max > 200 THEN
    RAISE EXCEPTION 'MATCHING_ORCHESTRATION_REQUEST_INVALID' USING ERRCODE='22023';
  END IF;
  -- A human who is not matchable, or who holds an active Introduction, has no
  -- candidates; that is an empty answer, not an error.
  IF NOT (SELECT r.matchable FROM public.resolve_matching_setup_state_v1(p_for_user_id) r)
     OR (SELECT r.has_active_introduction FROM public.resolve_matching_active_introduction_v1(p_for_user_id) r) THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  FOR candidate IN SELECT d.candidate_user_id FROM public.discover_matching_candidates_core_v1(p_for_user_id, p_max) d LOOP
    n_examined := n_examined + 1;
    IF (SELECT a.admission FROM public.resolve_matching_pair_admission_v1(p_for_user_id, candidate.candidate_user_id) a)
       IS DISTINCT FROM 'ADMITTED' THEN
      CONTINUE;
    END IF;
    n_admitted := n_admitted + 1;
    BEGIN
      SELECT * INTO ensured FROM public.ensure_matching_pair_core_v1(gen_random_uuid(), p_for_user_id, candidate.candidate_user_id);
      snapshot_id := gen_random_uuid();
      PERFORM 1 FROM public.capture_matching_eligibility_snapshot_core_v1(snapshot_id, ensured.pair_id,
                                                                          p_for_user_id, candidate.candidate_user_id);
      PERFORM 1 FROM public.evaluate_matching_structured_requirements_core_v1(snapshot_id);
      -- A hard dealbreaker that is not PASS - FAIL, UNKNOWN, or one no
      -- deterministic evaluator covers - means no proposal. The whole attempt
      -- is rolled back rather than leaving an unusable snapshot behind.
      IF EXISTS (SELECT 1
                   FROM public.matching_eligibility_snapshots s
                   JOIN public.matching_requirement_items i
                     ON i.requirement_version_id IN (s.lower_requirement_version_id, s.higher_requirement_version_id)
                  WHERE s.id = snapshot_id AND i.requirement_strength = 'HARD_DEALBREAKER'
                    AND NOT EXISTS (SELECT 1 FROM public.matching_hard_requirement_results r
                                     WHERE r.eligibility_snapshot_id = s.id
                                       AND r.requirement_version_id = i.requirement_version_id
                                       AND r.requirement_key = i.requirement_key
                                       AND r.requirement_outcome = 'PASS')) THEN
        RAISE EXCEPTION 'MATCHING_PAIR_NOT_ELIGIBLE' USING ERRCODE='55000';
      END IF;
      PERFORM 1 FROM public.prepare_matching_proposal_core_v1(gen_random_uuid(), snapshot_id, p_for_user_id);
      n_prepared := n_prepared + 1;
    EXCEPTION WHEN SQLSTATE '55000' OR unique_violation THEN
      -- Refused closed: a core said no, and nothing of this attempt survives.
      NULL;
    END;
  END LOOP;

  RETURN QUERY SELECT n_examined, n_admitted, n_prepared;
END$$;

-- ---------------------------------------------------------------------------
-- 7. THE INTERNAL SWEEPER (CP5.3).
--
--    Bounded. A live proposal past its deadline is expired, and every other live
--    proposal is revalidated, through the EXISTING expiry and revalidation cores
--    only - the protective transitions need no clearance, disclose nothing and
--    reactivate nothing. A proposal another transaction moved first is skipped.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.sweep_matching_proposals_core_v1(p_max integer)
RETURNS TABLE (expired integer, staled integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  live record;
  outcome record;
  n_expired integer := 0;
  n_staled integer := 0;
BEGIN
  IF p_max IS NULL OR p_max <= 0 OR p_max > 500 THEN
    RAISE EXCEPTION 'MATCHING_SWEEP_REQUEST_INVALID' USING ERRCODE='22023';
  END IF;
  FOR live IN
    SELECT p.id, p.expires_at FROM public.matching_proposals p
     WHERE p.proposal_state IN ('PREPARED', 'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND')
     ORDER BY p.expires_at, p.id
     LIMIT p_max
  LOOP
    BEGIN
      IF live.expires_at <= CURRENT_TIMESTAMP THEN
        PERFORM 1 FROM public.expire_matching_proposal_core_v1(gen_random_uuid(), live.id);
        n_expired := n_expired + 1;
      ELSE
        SELECT * INTO outcome FROM public.revalidate_matching_proposal_core_v1(gen_random_uuid(), live.id);
        IF outcome.stale_transition_id IS NOT NULL THEN
          n_staled := n_staled + 1;
        END IF;
      END IF;
    EXCEPTION WHEN SQLSTATE '55000' THEN
      NULL;
    END;
  END LOOP;
  RETURN QUERY SELECT n_expired, n_staled;
END$$;

-- ---------------------------------------------------------------------------
-- 8. OWNERSHIP AND THE PRE-LAUNCH ACL: still executable by nobody.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  boundary text;
BEGIN
  FOREACH boundary IN ARRAY ARRAY[
    'public.resolve_matching_pair_reproposal_block_v1(uuid,uuid)',
    'public.resolve_matching_compatibility_producer_readiness_v1()',
    'public.resolve_matching_pair_prerequisites_v1(uuid,uuid)',
    'public.resolve_matching_pair_admission_v1(uuid,uuid)',
    'public.discover_matching_candidates_core_v1(uuid,integer)',
    'public.prepare_matching_proposal_core_v1(uuid,uuid,uuid)',
    'public.orchestrate_matching_proposal_preparation_core_v1(uuid,integer)',
    'public.sweep_matching_proposals_core_v1(integer)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', boundary);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', boundary);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', boundary);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 9. TERMINAL SELF-ASSERTIONS.
--
--    The migration refuses to deploy a re-proposal block, an admission, an
--    orchestrator or a sweeper that an application role can run, a seam that
--    can answer anything but its one truthful value, a second proposal
--    producer, a new transition writer, or a preparation whose real instant
--    could become a deadline.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  offending text;
  prepare_source text;
BEGIN
  SELECT string_agg(format('%s:%s', r.rolname, p.oid::regprocedure), ', ') INTO offending
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) r
   WHERE n.nspname = 'public'
     AND p.proname IN ('resolve_matching_pair_reproposal_block_v1', 'resolve_matching_compatibility_producer_readiness_v1',
                       'resolve_matching_pair_prerequisites_v1', 'resolve_matching_pair_admission_v1',
                       'discover_matching_candidates_core_v1', 'prepare_matching_proposal_core_v1',
                       'orchestrate_matching_proposal_preparation_core_v1', 'sweep_matching_proposals_core_v1')
     AND has_function_privilege(r.rolname, p.oid, 'EXECUTE');
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: no application role may execute the block, the admission, the orchestrator or the sweeper: %', offending;
  END IF;

  -- THE SEAMS ANSWER ONLY THEIR ONE TRUTHFUL VALUE: one RETURN, and that literal.
  IF (SELECT r.readiness FROM public.resolve_matching_compatibility_producer_readiness_v1() r) <> 'UNAVAILABLE'
     OR (SELECT p.prosrc FROM pg_proc p
          WHERE p.oid = 'public.resolve_matching_compatibility_producer_readiness_v1()'::regprocedure)
        ~ '(''READY''|SELECT\s+[a-z_.]+\s+FROM|router|model|IF\s)'
     OR (SELECT r.clearance FROM public.resolve_matching_pair_prerequisites_v1(gen_random_uuid(), gen_random_uuid()) r)
        <> 'NOT_EVALUATED'
     OR (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.resolve_matching_pair_prerequisites_v1(uuid,uuid)'::regprocedure)
        ~ '(''CLEARED''|FROM\s+public\.|IF\s)'
     OR (SELECT a.admission FROM public.resolve_matching_pair_admission_v1(gen_random_uuid(), gen_random_uuid()) a) = 'ADMITTED' THEN
    RAISE EXCEPTION 'S6-03: the producer seam answers UNAVAILABLE, the pair seam NOT_EVALUATED, and nothing is admitted';
  END IF;

  -- PREPARATION IS THE ONE PROPOSAL PRODUCER, AND NOTHING NEW WRITES A TRANSITION.
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO offending
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
     AND p.prosrc ~ 'INSERT\s+INTO\s+public\.matching_proposals\M'
     AND p.proname <> 'prepare_matching_proposal_core_v1';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: preparation is the only producer of a proposal; found %', offending;
  END IF;
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO offending
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('resolve_matching_pair_reproposal_block_v1', 'resolve_matching_pair_admission_v1',
                       'orchestrate_matching_proposal_preparation_core_v1', 'sweep_matching_proposals_core_v1',
                       'discover_matching_candidates_core_v1', 'prepare_matching_proposal_core_v1')
     AND p.prosrc ~ '(INSERT\s+INTO\s+public\.matching_proposal_transitions|append_matching_proposal_transition_v1)';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: no new or replaced function writes a transition itself; found %', offending;
  END IF;
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO offending
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('resolve_matching_pair_reproposal_block_v1', 'resolve_matching_pair_admission_v1',
                       'resolve_matching_compatibility_producer_readiness_v1', 'resolve_matching_pair_prerequisites_v1',
                       'discover_matching_candidates_core_v1')
     AND (p.provolatile <> 's' OR p.prosrc ~ '(INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE)');
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: the block, the admission, the seams and discovery are STABLE and write nothing; found %', offending;
  END IF;

  -- R4-A: ONE REAL INSTANT, ONLY IN THE TWO REFUSALS, NEVER A DEADLINE.
  SELECT p.prosrc INTO prepare_source FROM pg_proc p
   WHERE p.oid = 'public.prepare_matching_proposal_core_v1(uuid,uuid,uuid)'::regprocedure;
  IF (length(prepare_source) - length(replace(prepare_source, 'clock_timestamp', ''))) / length('clock_timestamp') <> 1
     OR strpos(prepare_source, 'checked_at := clock_timestamp();') = 0
     OR strpos(prepare_source, 'deadline := CURRENT_TIMESTAMP + make_interval(hours => expiry_hours);') = 0
     OR (length(prepare_source) - length(replace(prepare_source, 'deadline :=', ''))) / length('deadline :=') <> 1
     OR (length(prepare_source) - length(replace(prepare_source, 'checked_at', ''))) / length('checked_at') <> 3
     OR strpos(prepare_source, 'deadline := CURRENT_TIMESTAMP') > strpos(prepare_source, 'checked_at := clock_timestamp();')
     OR strpos(prepare_source, 'INTO horizon') > strpos(prepare_source, 'checked_at := clock_timestamp();')
     OR strpos(prepare_source, 'resolve_matching_pair_reproposal_block_v1')
        > strpos(prepare_source, 'deadline := CURRENT_TIMESTAMP')
     OR strpos(prepare_source, 'MATCHING_ELIGIBILITY_HORIZON_EXCEEDED')
        > strpos(prepare_source, 'INSERT INTO public.matching_proposals') THEN
    RAISE EXCEPTION 'S6-03: preparation reads exactly one real instant, after the deadline and the horizon, used only by its two refusals before the first write';
  END IF;
END$$;

COMMIT;
