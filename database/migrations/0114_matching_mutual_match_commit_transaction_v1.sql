-- I-07C - The atomic Mutual Match commit, the Matching Shared World birth, the
-- ACTIVE_INTRODUCTION pause producer, competing-proposal terminalization and the
-- durable first-acceptance binding v1.
--
-- Migration 0113 created the persistence. This forward-only migration creates
-- the ONE transaction that fills it, and revises the I-07B forward approval so
-- the first acceptance is durably bound to the exact view that authorized it.
--
-- ## The Product transition is indivisible (CW2-06 sections 35-37)
--
--     FORWARDED_TO_SECOND
--       + the first party's still-valid exact-view forward approval
--       + the second party's still-valid exact-view acceptance
--       + both humans still currently eligible and authorized
--       + both humans currently free of any active Introduction
--                 |
--                 v
--     ONE ATOMIC MUTUAL MATCH COMMIT
--       one MATCH_COMMIT_ID
--       one MUTUAL_MATCH_COMMITTED transition, written by the ONE I-07B writer
--       one ACTIVE / INTRODUCTION / MUTUAL_MATCH Shared World
--       exactly two open membership episodes
--       one Introduction Record, ACTIVE
--       WORLD_BIRTH and INTRODUCTION_STARTED facts
--       two HELD active-Introduction claims
--       two PAUSED / ACTIVE_INTRODUCTION participation acts
--       every other live proposal involving either human -> CANCELLED_BY_COMPETING_MATCH
--       one immutable bounded Match Handoff Package
--
-- There is no SECOND_ACCEPTED and no accepted-but-not-matched state. The second
-- recipient's acceptance is durable ONLY as the successful commit of this
-- function, and if any part of it fails no part of it remains.
--
-- ## Who accepts
--
-- The accepting human is auth.uid() and nothing else. There is no actor
-- parameter, no service-role route and no way for a system credential to
-- manufacture a human's acceptance. The caller must be the proposal's exact
-- candidate, acting on the exact CURRENT candidate view; the first party's
-- approval must be durably bound to a FIRST_RECIPIENT view that is STILL that
-- human's current view. A superseded view on either side authorizes nothing.
--
-- ## The canonical lock order, published
--
--   A. BOTH humans' matching_setup_locks, in ascending canonical user id, taken
--      through `enter_matching_proposal_decision_v1` - the same entry point and
--      the same upsert-and-lock statement every I-07A command and every I-07B
--      decision uses. The human lock set is EXACTLY the two humans of the
--      winning proposal, precomputed from the proposal's immutable membership
--      before the first lock, and it never grows: competing cancellation
--      mutates proposal rows and transitions only, never a competitor's setup
--      state, so no competitor's setup lock is ever required and none is ever
--      taken. The terminal self-assertion refuses a second entry into the
--      two-human lock and any direct write to the lock relation, which is what
--      makes "no lock acquired out of order" a property of the text rather than
--      of a review.
--   B. every proposal row this transaction may mutate - the winner and every
--      LIVE proposal involving either human - FOR UPDATE in ascending proposal
--      id, one deterministic global order for every Match in the system.
--   C. the participation pointers of the two humans FOR UPDATE, under (A).
--   D. the unique claim insertions, the World and episode inserts, the
--      Introduction Record and its facts, the handoff package, and last the
--      commit row.
--
-- No advisory lock, no LOCK TABLE, no process-local mutex. Two Matches sharing
-- a human serialize on that human's setup lock and have exactly one winner;
-- two disjoint Matches share no human lock and contend at most on the
-- competing proposal rows they both cancel, which both take in ascending id
-- order, so neither can wait on the other while holding a row the other needs.
-- A competitor that a disjoint Match has already terminalized is read as
-- terminal under its row lock and skipped; the live set can only shrink while
-- the two human locks are held, because every I-07B operation on a proposal
-- involving one of these humans takes that human's setup lock first.
--
-- ## Revalidation, in the serialized region, in one coherent order
--
--   1. the caller is the exact second recipient, holding a current view
--   2. the exact candidate view is current
--   3. the winning proposal is FORWARDED_TO_SECOND, under its row lock
--   4. the proposal has not passed its deadline
--   5. the first approval's bound view is still the first recipient's current view
--   6. the ONE canonical revalidation - `resolve_matching_proposal_validity_v1`
--      - still answers valid: both participations ACTIVE, both Matching Context
--      Grants, both Introduction Profile versions, both requirement versions,
--      both Pre-Match Disclosure Authorities and the three proposal policy
--      identities exactly as the eligibility snapshot bound them, and no active
--      Introduction in the canonical Shared World truth
--   7. no HELD active-Introduction claim for either human
--   8. both current participation pointers name an ACTIVE act, read FOR UPDATE
--   9. `resolve_matching_proposal_prerequisites_v1` answers CLEARED - THE LAST
--      GATE, after every privacy and authority gate, so a clearance refusal never
--      reveals that the others would have passed
--
-- Nothing here is a second copy of an I-07B rule. Currentness of the setup
-- state, of the eligibility snapshot, of the proposal policies and of the
-- active-Introduction truth is asked of the canonical resolvers; this function
-- layers the Match-specific conditions over them and copies none.
--
-- ## Anti-oracle refusals
--
-- After the exact-view check, every current-truth failure - a missing or stale
-- first approval, any invalid revalidation, a held claim, a non-ACTIVE pointer -
-- is ONE bounded class, MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE, with no detail.
-- The candidate therefore never learns that the counterpart paused, changed a
-- version, withdrew an authority or entered another Introduction; a proposal
-- that is no longer FORWARDED_TO_SECOND answers the same MATCHING_STALE_STATE
-- every I-07B decision answers for a terminal proposal, and a proposal this
-- human is no part of or holds no view of answers the same bounded not-found as
-- one that never existed. The winner, the winning proposal, Match timing and
-- the competing set are never named.
--
-- ## Why the cancellation transition ids are database-generated
--
-- Every fixed artifact of the commit takes a caller-supplied opaque id, exactly
-- as 0082 does, and no UUID policy is invented for them. The competing
-- cancellations cannot: their NUMBER is private (CW2-06 section 38), and a
-- caller-supplied list would have to be either long enough - which makes "not
-- enough ids" an oracle for how many competing proposals exist - or open-ended.
-- So the cancellation transition ids, and only they, come from
-- `gen_random_uuid()`, the generator the repository's measurement runtime has
-- used since migration 0012; the private link from each cancellation to this
-- commit is recorded, and the retry answer never depends on them.
--
-- ## The write region and the one instant
--
-- The one instant is captured AFTER every currentness, authority and
-- prerequisite gate and BEFORE anything is written, and the proposal deadline
-- is decided against it - never against `CURRENT_TIMESTAMP`, which PostgreSQL
-- fixes at the start of the transaction and therefore before this command ever
-- waits on the canonical pair lock. A Match that entered while its proposal was
-- live, waited minutes on the lock and resumed past `expires_at` would read a
-- moment that had already gone by and commit a Match the proposal no longer
-- authorized (review finding I07C-TIME-01). Deciding on the real birth instant
-- makes the deadline part of final currentness, and it fails closed with
-- nothing written. There is still exactly ONE Match clock.
--
-- One `clock_timestamp()` is captured exactly once and persisted unchanged as
-- the World's born_at, both episodes' joined_at, the Introduction Record's
-- started_at, both facts' occurred_at, both claims' claimed_at, both pause acts'
-- occurred_at, the handoff package's created_at and the commit's committed_at,
-- and the 0113 commit truth trigger refuses any of them differing. The six
-- reverse bindings onto the commit are re-DEFERRED at the start of the write
-- region and flushed with SET CONSTRAINTS ... IMMEDIATE the moment the commit
-- row exists, so the commit validates its own reverse bindings before it
-- returns and leaves no pending event behind for a later statement to trip on.
--
-- ## What ends here
--
-- After this commit the system stops exactly at ACTIVE / INTRODUCTION, an
-- ACTIVE Introduction Record, two HELD claims, PAUSED / ACTIVE_INTRODUCTION for
-- both humans and an immutable handoff. No claim is released, no World moves to
-- STANDARD or closes, no Introduction disclosure exists and Matching does not
-- resume: all of that is I-07D, and every one of those transitions is
-- representable without touching this migration. No Shared Standing Context
-- Grant is created and no Matching Context Grant is transferred: the born World
-- starts with its own Shared semantics and the bounded handoff, nothing else.
--
-- Migrations 0001-0113 are untouched. The one I-07B function this migration
-- replaces keeps its exact signature, return shape, ordering and ACL, and gains
-- one write: the durable binding of the approval to its exact view.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE REVISED FORWARD APPROVAL: the same decision, now durably view-bound.
--
--    Byte-for-byte the 0112 boundary in its authority, its serialized-region
--    ordering, its gates and its answer, plus ONE additional write in the same
--    transaction: the exact FIRST_RECIPIENT view that authorized the approval is
--    bound to the approval transition, the proposal and the human. An equivalent
--    retry is answered from the committed rows; the same command id naming a
--    different view is a different request and fails closed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_matching_proposal_forward_core_v1(
  p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid
) RETURNS TABLE(approval_transition_id uuid, approved_state text, neutral_outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  validity record;
  gate record;
  bound public.matching_forward_approval_view_bindings;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);
  IF EXISTS (SELECT 1 FROM public.matching_proposal_transitions t
              WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
                AND t.resulting_state = 'FIRST_FORWARD_APPROVED' AND t.first_recipient_actor_id = u) THEN
    -- The committed approval binds ONE exact view. An equivalent retry answers
    -- from the committed rows; a retry naming any other view is a different
    -- request under a reused id and fails closed. A committed approval whose
    -- binding is MISSING cannot prove which view authorized it: it is
    -- contradictory rather than repairable, no historical view is inferred and
    -- nothing is backfilled from the current view (review finding I07C-AUTH-01).
    SELECT * INTO bound FROM public.matching_forward_approval_view_bindings b
     WHERE b.approval_transition_id = p_command_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MATCHING_MATCH_CONTRADICTORY_STATE' USING ERRCODE='P0001',
        DETAIL='A committed forward approval carries its durable exact-view binding; one without it proves nothing and is not repaired here.';
    END IF;
    IF bound.approved_view_id IS DISTINCT FROM p_expected_view_id THEN
      RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
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
  -- first-party Matching context. It writes the one transition and, since
  -- I-07C, the durable binding of that transition to the exact view the human
  -- approved - the first of the two acceptances a Mutual Match must prove.
  PERFORM public.append_matching_proposal_transition_v1(
    p_command_id, p_proposal_id, 'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', u, NULL, NULL);
  INSERT INTO public.matching_forward_approval_view_bindings
    (approval_transition_id, proposal_id, approver_user_id, approved_view_id)
  VALUES (p_command_id, p_proposal_id, u, p_expected_view_id);

  RETURN QUERY SELECT p_command_id, 'FIRST_FORWARD_APPROVED'::text, 'IN_PROGRESS'::text;
END$$;

COMMENT ON FUNCTION public.approve_matching_proposal_forward_core_v1(uuid, uuid, uuid) IS
  'Explicit proposal-scoped human authority to send THIS candidate an '
  'independent proposal, bound to the exact view version the approver saw and - '
  'since I-07C - durably recorded as such, so the Mutual Match can prove the '
  'first acceptance against the exact view it bound. It creates no Mutual Match, '
  'no World, no Introduction and no contact route, and widens no I-07A '
  'disclosure authority: it writes one transition and its view binding.';

-- ---------------------------------------------------------------------------
-- 2. THE ATOMIC MUTUAL MATCH COMMIT.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_matching_mutual_match_v1(
  p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid,
  p_world_id uuid, p_introduction_record_id uuid,
  p_first_recipient_membership_episode_id uuid, p_candidate_membership_episode_id uuid,
  p_first_recipient_claim_id uuid, p_candidate_claim_id uuid,
  p_first_recipient_pause_event_id uuid, p_candidate_pause_event_id uuid,
  p_handoff_package_version_id uuid
) RETURNS TABLE(outcome text, committed_match_id uuid, matched_proposal_id uuid, born_world_id uuid,
                born_introduction_record_id uuid, world_lifecycle text, world_phase text,
                world_birth_basis text, introduction_record_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.matching_match_commits;
  proposal public.matching_proposals;
  binding public.matching_forward_approval_view_bindings;
  first_current_view uuid;
  validity record;
  gate record;
  first_pointer uuid;
  candidate_pointer uuid;
  first_act public.matching_participation_events;
  candidate_act public.matching_participation_events;
  competitor record;
  lock_target uuid;
  lo uuid;
  hi uuid;
  birth_at timestamptz;
  cancellation_id uuid;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_proposal_id IS NULL OR p_expected_view_id IS NULL
     OR p_world_id IS NULL OR p_introduction_record_id IS NULL
     OR p_first_recipient_membership_episode_id IS NULL OR p_candidate_membership_episode_id IS NULL
     OR p_first_recipient_claim_id IS NULL OR p_candidate_claim_id IS NULL
     OR p_first_recipient_pause_event_id IS NULL OR p_candidate_pause_event_id IS NULL
     OR p_handoff_package_version_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- The twelve supplied identities are opaque and pairwise distinct. No
  -- semantics is inferred from a UUID value, and no existing identity is reused
  -- as a new one.
  IF (SELECT count(DISTINCT supplied) FROM unnest(ARRAY[
        p_command_id, p_proposal_id, p_expected_view_id, p_world_id, p_introduction_record_id,
        p_first_recipient_membership_episode_id, p_candidate_membership_episode_id,
        p_first_recipient_claim_id, p_candidate_claim_id,
        p_first_recipient_pause_event_id, p_candidate_pause_event_id,
        p_handoff_package_version_id]) AS supplied) <> 12 THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent retry of
  -- a command that already committed is answered even though the proposal is
  -- now terminal, both humans are PAUSED, an Introduction is active and a later
  -- reviewed slice may have moved the World on. The comparison covers the WHOLE
  -- immutable request: the human, the proposal, the exact accepted view and
  -- every opaque identity the command produced.
  SELECT * INTO committed FROM public.matching_match_commits c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.candidate_user_id = u AND committed.proposal_id = p_proposal_id
       AND committed.candidate_accepted_view_id = p_expected_view_id
       AND committed.world_id = p_world_id
       AND committed.introduction_record_id = p_introduction_record_id
       AND committed.first_recipient_membership_episode_id = p_first_recipient_membership_episode_id
       AND committed.candidate_membership_episode_id = p_candidate_membership_episode_id
       AND committed.first_recipient_claim_id = p_first_recipient_claim_id
       AND committed.candidate_claim_id = p_candidate_claim_id
       AND committed.first_recipient_pause_event_id = p_first_recipient_pause_event_id
       AND committed.candidate_pause_event_id = p_candidate_pause_event_id
       AND committed.handoff_package_version_id = p_handoff_package_version_id THEN
      -- The historical committed answer, never a read of the live World. The
      -- birth basis, the birth membership, the Introduction Record and the birth
      -- instant are immutable facts of the Match; the World lifecycle and phase
      -- and the record status are NOT, because I-07D legitimately transitions
      -- them under the same identities. What must still be coherent is that the
      -- immutable facts exist: a commit whose World, birth fact or record has
      -- vanished is contradictory rather than repairable.
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_worlds w
          JOIN public.shared_world_matching_birth_events b ON b.world_id = w.id
          JOIN public.introduction_records r ON r.id = b.introduction_record_id
         WHERE w.id = committed.world_id AND w.birth_basis = 'MUTUAL_MATCH'
           AND b.match_commit_id = committed.id AND r.match_commit_id = committed.id
      ) THEN
        RAISE EXCEPTION 'MATCHING_MATCH_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'MATCHED'::text, committed.id, committed.proposal_id, committed.world_id,
                          committed.introduction_record_id, 'ACTIVE'::text, 'INTRODUCTION'::text,
                          'MUTUAL_MATCH'::text, 'ACTIVE'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- LOCK ORDER STEP A: the bounded not-found for a proposal this human is no
  -- part of, answered from immutable membership BEFORE any lock, and then BOTH
  -- humans' setup locks in canonical user-id order. This is the ONLY entry into
  -- the two-human lock this function makes, and the human lock set is exactly
  -- the two humans of this proposal.
  PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  lo := proposal.lower_user_id;
  hi := proposal.higher_user_id;

  -- LOCK ORDER STEP B: every proposal row this transaction may mutate - the
  -- winner and every live proposal involving either human - FOR UPDATE in
  -- ascending proposal id. Nothing can add a live proposal involving either
  -- human while their setup locks are held; a disjoint Match may terminalize
  -- one, which is read under the row lock below and skipped.
  FOR lock_target IN
    SELECT p.id FROM public.matching_proposals p
     WHERE p.id = p_proposal_id
        OR (p.proposal_state IN ('PREPARED', 'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND')
            AND (p.first_recipient_user_id IN (lo, hi) OR p.candidate_user_id IN (lo, hi)))
     ORDER BY p.id
  LOOP
    PERFORM 1 FROM public.matching_proposals p WHERE p.id = lock_target FOR UPDATE;
  END LOOP;

  -- DURABLE IDEMPOTENCY, SECOND PASS: under the human locks, so two concurrent
  -- equivalent commands serialize and the loser answers from the committed row.
  SELECT * INTO committed FROM public.matching_match_commits c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.candidate_user_id = u AND committed.proposal_id = p_proposal_id
       AND committed.candidate_accepted_view_id = p_expected_view_id
       AND committed.world_id = p_world_id
       AND committed.introduction_record_id = p_introduction_record_id
       AND committed.first_recipient_membership_episode_id = p_first_recipient_membership_episode_id
       AND committed.candidate_membership_episode_id = p_candidate_membership_episode_id
       AND committed.first_recipient_claim_id = p_first_recipient_claim_id
       AND committed.candidate_claim_id = p_candidate_claim_id
       AND committed.first_recipient_pause_event_id = p_first_recipient_pause_event_id
       AND committed.candidate_pause_event_id = p_candidate_pause_event_id
       AND committed.handoff_package_version_id = p_handoff_package_version_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_worlds w
          JOIN public.shared_world_matching_birth_events b ON b.world_id = w.id
          JOIN public.introduction_records r ON r.id = b.introduction_record_id
         WHERE w.id = committed.world_id AND w.birth_basis = 'MUTUAL_MATCH'
           AND b.match_commit_id = committed.id AND r.match_commit_id = committed.id
      ) THEN
        RAISE EXCEPTION 'MATCHING_MATCH_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'MATCHED'::text, committed.id, committed.proposal_id, committed.world_id,
                          committed.introduction_record_id, 'ACTIVE'::text, 'INTRODUCTION'::text,
                          'MUTUAL_MATCH'::text, 'ACTIVE'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- 1-2. THE SECOND ACCEPTANCE: the caller is the exact candidate holding a
  -- current CANDIDATE view, and it is exactly the view they are accepting. Read
  -- INSIDE the serialized region, because a materialization supersedes a view
  -- while holding the same lock.
  PERFORM public.assert_matching_recipient_view_current_v1(p_proposal_id, u, p_expected_view_id, 'CANDIDATE');

  -- 3-4. The winning proposal, re-read under its own row lock: exactly
  -- FORWARDED_TO_SECOND and this caller its candidate. The DEADLINE is
  -- deliberately NOT decided here; it is decided against the one real instant
  -- below, for the reason recorded there.
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF proposal.candidate_user_id <> u THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  IF proposal.proposal_state <> 'FORWARDED_TO_SECOND' THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001',
      DETAIL='A Mutual Match commits only from FORWARDED_TO_SECOND.';
  END IF;

  -- 5. THE FIRST ACCEPTANCE: durably bound, and its bound view STILL the first
  -- recipient's current view. A stale first approval is not carried forward.
  SELECT * INTO binding FROM public.matching_forward_approval_view_bindings b
   WHERE b.proposal_id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE' USING ERRCODE='40001';
  END IF;
  SELECT st.current_view_id INTO first_current_view
    FROM public.matching_recipient_proposal_view_state st
   WHERE st.proposal_id = p_proposal_id AND st.recipient_user_id = proposal.first_recipient_user_id;
  IF first_current_view IS DISTINCT FROM binding.approved_view_id THEN
    RAISE EXCEPTION 'MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE' USING ERRCODE='40001';
  END IF;

  -- 6. THE ONE CANONICAL REVALIDATION. Participation, grants, profile and
  -- requirement versions, disclosure authorities, proposal policies and the
  -- canonical active-Introduction truth, exactly as the snapshot bound them.
  -- The private reason it answers with is never carried out of here.
  SELECT * INTO validity FROM public.resolve_matching_proposal_validity_v1(p_proposal_id);
  IF NOT validity.still_valid THEN
    RAISE EXCEPTION 'MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE' USING ERRCODE='40001';
  END IF;

  -- 7. The internal single-winner guard: neither human holds an active claim.
  IF EXISTS (SELECT 1 FROM public.matching_active_introduction_claims c
              WHERE c.user_id IN (lo, hi) AND c.claim_state = 'HELD') THEN
    RAISE EXCEPTION 'MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE' USING ERRCODE='40001';
  END IF;

  -- 8. LOCK ORDER STEP C: both current participation pointers, FOR UPDATE, and
  -- both naming an ACTIVE act. The pause producer below supersedes exactly these.
  SELECT s.current_event_id INTO first_pointer
    FROM public.matching_participation_state s
   WHERE s.participant_user_id = proposal.first_recipient_user_id FOR UPDATE;
  SELECT s.current_event_id INTO candidate_pointer
    FROM public.matching_participation_state s
   WHERE s.participant_user_id = proposal.candidate_user_id FOR UPDATE;
  IF first_pointer IS NULL OR candidate_pointer IS NULL THEN
    RAISE EXCEPTION 'MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE' USING ERRCODE='40001';
  END IF;
  SELECT * INTO first_act FROM public.matching_participation_events e WHERE e.id = first_pointer;
  SELECT * INTO candidate_act FROM public.matching_participation_events e WHERE e.id = candidate_pointer;
  IF first_act.resulting_state <> 'ACTIVE' OR candidate_act.resulting_state <> 'ACTIVE' THEN
    RAISE EXCEPTION 'MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE' USING ERRCODE='40001';
  END IF;

  -- 9. THE LAST GATE, after every privacy and authority gate has passed.
  SELECT * INTO gate FROM public.resolve_matching_proposal_prerequisites_v1(p_proposal_id);
  IF gate.clearance <> 'CLEARED' THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL=gate.basis;
  END IF;

  -- THE ONE canonical Match instant, read from the database clock exactly once.
  birth_at := clock_timestamp();

  -- THE DEADLINE DECISION, taken against that exact instant and nothing else,
  -- after every currentness, authority and prerequisite gate and with nothing
  -- written yet. A transaction clock is fixed BEFORE this command waits on the
  -- canonical locks: a Match that entered while the proposal was still live,
  -- then waited on the pair lock until after expires_at, would compare a moment
  -- that has already gone by and commit a Match the proposal no longer
  -- authorizes. The instant this Match would really be born at is the only
  -- lawful basis for the decision, and it is exactly the instant every
  -- persisted moment below carries.
  IF proposal.expires_at <= birth_at THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_EXPIRED' USING ERRCODE='55000';
  END IF;

  -- THE IRREVERSIBLE WRITE REGION. Everything below commits together or not at
  -- all; a supplied identity that is already taken rolls the whole Match back.
  BEGIN
    SET CONSTRAINTS public.introduction_records_match_commit_fk,
                    public.shared_world_matching_birth_events_commit_fk,
                    public.shared_world_introduction_started_events_commit_fk,
                    public.matching_active_introduction_claims_commit_fk,
                    public.matching_match_competing_cancellations_commit_fk,
                    public.matching_match_handoff_packages_commit_fk DEFERRED;

    -- (i) The winning transition, through the ONE writer. The command id IS
    -- the transition id, and the candidate is the actor the structural
    -- state/actor law requires.
    PERFORM public.append_matching_proposal_transition_v1(
      p_command_id, p_proposal_id, 'FORWARDED_TO_SECOND', 'MUTUAL_MATCH_COMMITTED', NULL, u, NULL);

    -- (ii) The Shared World: ACTIVE / INTRODUCTION / MUTUAL_MATCH, no closure,
    -- born at the one instant, on the canonical 0075 substrate.
    INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis, born_at, closed_at)
    VALUES (p_world_id, 'ACTIVE', 'INTRODUCTION', 'MUTUAL_MATCH', birth_at, NULL);

    -- (iii) Exactly the matched pair as two open peer episodes. No third human,
    -- no system member, no role column.
    INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)
    VALUES (p_first_recipient_membership_episode_id, p_world_id, proposal.first_recipient_user_id, birth_at, NULL),
           (p_candidate_membership_episode_id, p_world_id, proposal.candidate_user_id, birth_at, NULL);

    -- (iv) The Introduction Record, ACTIVE, naming this commit.
    INSERT INTO public.introduction_records
      (id, match_commit_id, world_id, pair_id, lower_user_id, higher_user_id,
       introduction_status, started_at, ended_at)
    VALUES (p_introduction_record_id, p_command_id, p_world_id, proposal.pair_id, lo, hi,
            'ACTIVE', birth_at, NULL);

    -- (v) WORLD_BIRTH / MUTUAL_MATCH and INTRODUCTION_STARTED.
    INSERT INTO public.shared_world_matching_birth_events
      (world_id, match_commit_id, introduction_record_id, occurred_at)
    VALUES (p_world_id, p_command_id, p_introduction_record_id, birth_at);
    INSERT INTO public.shared_world_introduction_started_events
      (introduction_record_id, world_id, match_commit_id, occurred_at)
    VALUES (p_introduction_record_id, p_world_id, p_command_id, birth_at);

    -- (vi) LOCK ORDER STEP D: both active-Introduction claims. The partial
    -- unique index makes a second HELD claim for either human impossible.
    INSERT INTO public.matching_active_introduction_claims
      (id, user_id, match_commit_id, introduction_record_id, world_id, claim_state, claimed_at, released_at)
    VALUES (p_first_recipient_claim_id, proposal.first_recipient_user_id, p_command_id,
            p_introduction_record_id, p_world_id, 'HELD', birth_at, NULL),
           (p_candidate_claim_id, proposal.candidate_user_id, p_command_id,
            p_introduction_record_id, p_world_id, 'HELD', birth_at, NULL);

    -- (vii) THE ACTIVE_INTRODUCTION PAUSE PRODUCER. Both humans, atomically,
    -- through the 0108 act chain and the 0108 pointer truth: a PAUSE act
    -- resulting in PAUSED / ACTIVE_INTRODUCTION superseding the exact current
    -- ACTIVE act, and the pointer moved to it. This is not the user pause and
    -- writes no USER_PAUSED; it is the reviewed producer I-07A reserved.
    INSERT INTO public.matching_participation_events
      (id, participant_user_id, participation_act, resulting_state, resulting_pause_reason,
       activation_entry_channel, prior_event_id, occurred_at)
    VALUES (p_first_recipient_pause_event_id, proposal.first_recipient_user_id, 'PAUSE', 'PAUSED',
            'ACTIVE_INTRODUCTION', NULL, first_pointer, birth_at),
           (p_candidate_pause_event_id, proposal.candidate_user_id, 'PAUSE', 'PAUSED',
            'ACTIVE_INTRODUCTION', NULL, candidate_pointer, birth_at);
    UPDATE public.matching_participation_state s
       SET current_event_id = p_first_recipient_pause_event_id, updated_at = birth_at
     WHERE s.participant_user_id = proposal.first_recipient_user_id AND s.current_event_id = first_pointer;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MATCHING_MATCH_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
    UPDATE public.matching_participation_state s
       SET current_event_id = p_candidate_pause_event_id, updated_at = birth_at
     WHERE s.participant_user_id = proposal.candidate_user_id AND s.current_event_id = candidate_pointer;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MATCHING_MATCH_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- (viii) COMPETING PROPOSALS: every OTHER live proposal involving either
    -- human, each under the row lock taken in step B, each moved from the exact
    -- state read under that lock, through the ONE writer, in ascending
    -- proposal id, with the private reason recorded on the transition. The
    -- recipient projection still answers NO_LONGER_AVAILABLE for every one of
    -- them, exactly as for an expiry.
    FOR competitor IN
      SELECT p.id, p.proposal_state FROM public.matching_proposals p
       WHERE p.id <> p_proposal_id
         AND p.proposal_state IN ('PREPARED', 'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND')
         AND (p.first_recipient_user_id IN (lo, hi) OR p.candidate_user_id IN (lo, hi))
       ORDER BY p.id
    LOOP
      cancellation_id := gen_random_uuid();
      PERFORM public.append_matching_proposal_transition_v1(
        cancellation_id, competitor.id, competitor.proposal_state, 'CANCELLED_BY_COMPETING_MATCH',
        NULL, NULL, 'COMPETING_MATCH_COMMITTED');
      INSERT INTO public.matching_match_competing_cancellations
        (cancellation_transition_id, match_commit_id, cancelled_proposal_id)
      VALUES (cancellation_id, p_command_id, competitor.id);
    END LOOP;

    -- (ix) THE MATCH HANDOFF PACKAGE: a one-way projection of the two exact
    -- current views and of nothing else. No private reasoning is read, no
    -- conclusion is composed, no field is fetched from a profile: every row is
    -- copied from a view row that already crossed both disclosure gates and the
    -- value filter, under constraints that make copying anything else
    -- unrepresentable.
    INSERT INTO public.matching_match_handoff_package_versions
      (id, match_commit_id, introduction_record_id, world_id, proposal_id,
       first_recipient_user_id, candidate_user_id, first_recipient_view_id, candidate_view_id, created_at)
    VALUES (p_handoff_package_version_id, p_command_id, p_introduction_record_id, p_world_id, p_proposal_id,
            proposal.first_recipient_user_id, proposal.candidate_user_id,
            binding.approved_view_id, p_expected_view_id, birth_at);
    INSERT INTO public.matching_match_handoff_subjects
      (package_version_id, proposal_id, presented_to_user_id, subject_user_id, source_view_id,
       permitted_conclusion_id, presented_first_name, safe_compatibility_conclusion)
    SELECT p_handoff_package_version_id, v.proposal_id, v.recipient_user_id, v.subject_user_id, v.id,
           v.permitted_conclusion_id, v.subject_first_name, c.permitted_text
      FROM public.matching_recipient_proposal_views v
      JOIN public.matching_permitted_safe_conclusions c ON c.id = v.permitted_conclusion_id
     WHERE v.id IN (binding.approved_view_id, p_expected_view_id);
    INSERT INTO public.matching_match_handoff_fields
      (package_version_id, subject_user_id, source_view_id, field_key, disclosed_value)
    SELECT p_handoff_package_version_id, v.subject_user_id, f.view_id, f.field_key, f.disclosed_value
      FROM public.matching_recipient_proposal_view_fields f
      JOIN public.matching_recipient_proposal_views v ON v.id = f.view_id
     WHERE f.view_id IN (binding.approved_view_id, p_expected_view_id);

    -- (x) THE DURABLE MATCH COMMIT, last, binding every effect above; its truth
    -- trigger re-reads every one of them. Then the six reverse bindings are
    -- checked immediately, so this transaction validates itself.
    INSERT INTO public.matching_match_commits
      (id, proposal_id, pair_id, lower_user_id, higher_user_id,
       first_recipient_user_id, candidate_user_id,
       first_approval_transition_id, first_approved_view_id, candidate_accepted_view_id,
       introduction_record_id, world_id,
       first_recipient_membership_episode_id, candidate_membership_episode_id,
       first_recipient_claim_id, candidate_claim_id,
       first_recipient_pause_event_id, candidate_pause_event_id,
       handoff_package_version_id, committed_at)
    VALUES (p_command_id, p_proposal_id, proposal.pair_id, lo, hi,
            proposal.first_recipient_user_id, proposal.candidate_user_id,
            binding.approval_transition_id, binding.approved_view_id, p_expected_view_id,
            p_introduction_record_id, p_world_id,
            p_first_recipient_membership_episode_id, p_candidate_membership_episode_id,
            p_first_recipient_claim_id, p_candidate_claim_id,
            p_first_recipient_pause_event_id, p_candidate_pause_event_id,
            p_handoff_package_version_id, birth_at);
    SET CONSTRAINTS public.introduction_records_match_commit_fk,
                    public.shared_world_matching_birth_events_commit_fk,
                    public.shared_world_introduction_started_events_commit_fk,
                    public.matching_active_introduction_claims_commit_fk,
                    public.matching_match_competing_cancellations_commit_fk,
                    public.matching_match_handoff_packages_commit_fk IMMEDIATE;
  EXCEPTION WHEN unique_violation THEN
    -- DURABLE IDEMPOTENCY, THIRD PASS. Two equivalent commands by the same
    -- human always serialize on the human locks above, but two commands that
    -- share a command id while resolving to DIFFERENT humans do not, and their
    -- only serialization point is this conflict. Durable history is consulted
    -- before any conflict is classified.
    SELECT * INTO committed FROM public.matching_match_commits c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.candidate_user_id = u AND committed.proposal_id = p_proposal_id
         AND committed.candidate_accepted_view_id = p_expected_view_id
         AND committed.world_id = p_world_id
         AND committed.introduction_record_id = p_introduction_record_id
         AND committed.first_recipient_membership_episode_id = p_first_recipient_membership_episode_id
         AND committed.candidate_membership_episode_id = p_candidate_membership_episode_id
         AND committed.first_recipient_claim_id = p_first_recipient_claim_id
         AND committed.candidate_claim_id = p_candidate_claim_id
         AND committed.first_recipient_pause_event_id = p_first_recipient_pause_event_id
         AND committed.candidate_pause_event_id = p_candidate_pause_event_id
         AND committed.handoff_package_version_id = p_handoff_package_version_id THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.shared_worlds w
            JOIN public.shared_world_matching_birth_events b ON b.world_id = w.id
            JOIN public.introduction_records r ON r.id = b.introduction_record_id
           WHERE w.id = committed.world_id AND w.birth_basis = 'MUTUAL_MATCH'
             AND b.match_commit_id = committed.id AND r.match_commit_id = committed.id
        ) THEN
          RAISE EXCEPTION 'MATCHING_MATCH_CONTRADICTORY_STATE' USING ERRCODE='P0001';
        END IF;
        RETURN QUERY SELECT 'MATCHED'::text, committed.id, committed.proposal_id, committed.world_id,
                            committed.introduction_record_id, 'ACTIVE'::text, 'INTRODUCTION'::text,
                            'MUTUAL_MATCH'::text, 'ACTIVE'::text;
        RETURN;
      END IF;
      RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- A supplied identity was already taken, or a claim for one of these humans
    -- is already HELD. The whole Match rolls back together, and the bounded
    -- answer names neither the colliding identity, nor its owner, nor which of
    -- the two it was.
    RAISE EXCEPTION 'MATCHING_MATCH_ID_CONFLICT' USING ERRCODE='23505';
  END;

  -- The committed result: the operation, the identities the caller already
  -- supplied and the frozen birth constants. No human identity, no counterpart
  -- identifier, no profile, no private state of any kind.
  RETURN QUERY SELECT 'MATCHED'::text, p_command_id, p_proposal_id, p_world_id, p_introduction_record_id,
                      'ACTIVE'::text, 'INTRODUCTION'::text, 'MUTUAL_MATCH'::text, 'ACTIVE'::text;
END$$;

COMMENT ON FUNCTION public.commit_matching_mutual_match_v1(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid) IS
  'The atomic Mutual Match commit and the ONLY producer of MUTUAL_MATCH_COMMITTED, '
  'CANCELLED_BY_COMPETING_MATCH, the ACTIVE_INTRODUCTION pause, the '
  'ACTIVE / INTRODUCTION / MUTUAL_MATCH Shared World birth, the Introduction '
  'Record, the active-Introduction claims and the Match handoff package. The '
  'accepting human is auth.uid() and must be the exact candidate acting on the '
  'exact current candidate view; the first party''s durably bound approval view '
  'must still be current; every current truth is revalidated under both '
  'humans'' canonical setup locks and every mutable proposal row in canonical '
  'id order; the CW2-08 seam must answer CLEARED as the last gate. It is '
  'executable by no application role before I-09.';

-- ---------------------------------------------------------------------------
-- 3. OWNERSHIP AND THE PRE-LAUNCH ACL: executable by nobody.
--
--    The Match commit creates an irreversible Shared World and the CW2-08 gate
--    that must clear it answers NOT_EVALUATED. The revised forward approval
--    keeps its 0112 posture; CREATE OR REPLACE preserves an ACL, so it is
--    revoked again explicitly rather than trusted.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  boundary text;
BEGIN
  FOREACH boundary IN ARRAY ARRAY[
    'public.approve_matching_proposal_forward_core_v1(uuid,uuid,uuid)',
    'public.commit_matching_mutual_match_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', boundary);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', boundary);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', boundary);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 4. TERMINAL SELF-ASSERTIONS.
--
--     The migration refuses to deploy a Match core that is application-
--     executable, caller-identified, unpinned, wrongly ordered, multi-clocked,
--     that locks a table or an advisory key, that enters the two-human lock
--     more than once or writes the lock relation directly, that inserts a
--     transition itself, that reads the private side, that names any
--     lifecycle it may not, or that is not the ONE producer of the states and
--     the pause it owns.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  core text := 'public.commit_matching_mutual_match_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid)';
  approval text := 'public.approve_matching_proposal_forward_core_v1(uuid,uuid,uuid)';
  fn text;
  p record;
  in_names text[];
  in_types text[];
  out_names text[];
  arg_name text;
  target_role text;
  cleaned text;
  offending text;
  retry_answer text := 'RETURN QUERY SELECT ''MATCHED''::text, committed.id, committed.proposal_id, committed.world_id,';
  coherence text := 'JOIN public.shared_world_matching_birth_events b ON b.world_id = w.id';
  entry_pos integer;
  view_pos integer;
  state_pos integer;
  binding_pos integer;
  validity_pos integer;
  claim_pos integer;
  pointer_pos integer;
  gate_pos integer;
  clock_pos integer;
  deadline_pos integer;
  writer_pos integer;
  world_pos integer;
  episode_pos integer;
  record_pos integer;
  claim_write_pos integer;
  pause_pos integer;
  cancel_pos integer;
  handoff_pos integer;
  commit_pos integer;
  flush_pos integer;
BEGIN
  FOREACH fn IN ARRAY ARRAY[core, approval] LOOP
    -- Argument NAMES are read from pg_proc.proargnames / proargmodes and the
    -- IN types from proargtypes, never from a rendered signature: for a RETURNS
    -- TABLE function both rendering forms fold or drop what their names suggest.
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pr.proargnames, pr.proargmodes,
           pr.proargtypes, pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-07C: % must be owned by postgres', fn; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-07C: % must be SECURITY DEFINER', fn; END IF;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-07C: % is a mutation and must be VOLATILE', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-07C: % must pin an empty search_path', fn;
    END IF;
    -- THE PRE-LAUNCH SECURITY BOUNDARY, asserted rather than commented.
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-07C: PUBLIC must not execute % before the CW2-08 Launch Gate exists', fn;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-07C: % must not execute % - a system credential never manufactures a human acceptance', target_role, fn;
      END IF;
    END LOOP;
    IF p.prosrc !~ 'auth\.uid\(\)' THEN
      RAISE EXCEPTION 'I-07C: % must derive the acting human from auth.uid()', fn;
    END IF;
    -- Both are human decisions: they enter the canonical two-human lock through
    -- the ONE entry point, exactly once, never through the pair lock directly
    -- and never by writing the lock relation, and they check the exact
    -- recipient view only AFTER entering. Comment lines are removed before the
    -- positions are compared, because prosrc includes comments and the prose
    -- above names these functions in explanatory order.
    SELECT string_agg(l.line, E'\n' ORDER BY l.n) INTO cleaned
      FROM regexp_split_to_table(p.prosrc, E'\n') WITH ORDINALITY AS l(line, n)
     WHERE btrim(l.line) NOT LIKE '--%';
    IF (length(cleaned) - length(replace(cleaned, 'enter_matching_proposal_decision_v1', '')))
       / length('enter_matching_proposal_decision_v1') <> 1 THEN
      RAISE EXCEPTION 'I-07C: % must enter the canonical two-human serialization region exactly once', fn;
    END IF;
    IF cleaned ~ 'lock_matching_pair_humans_v1' OR cleaned ~ 'INSERT INTO public\.matching_setup_locks' THEN
      RAISE EXCEPTION 'I-07C: % must reach the setup locks only through the one entry point, never directly', fn;
    END IF;
    IF strpos(cleaned, 'enter_matching_proposal_decision_v1') = 0
       OR strpos(cleaned, 'assert_matching_recipient_view_current_v1') = 0
       OR strpos(cleaned, 'enter_matching_proposal_decision_v1') > strpos(cleaned, 'assert_matching_recipient_view_current_v1') THEN
      RAISE EXCEPTION 'I-07C: % must enter the serialized region BEFORE it checks the exact recipient view', fn;
    END IF;
    IF p.prosrc !~ 'resolve_matching_proposal_prerequisites_v1' OR p.prosrc !~ '''CLEARED''' THEN
      RAISE EXCEPTION 'I-07C: % must require exactly CLEARED from the CW2-08 prerequisite seam', fn;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' THEN
      RAISE EXCEPTION 'I-07C: % locks rows in the canonical order, never a table and never an advisory key', fn;
    END IF;
    IF p.prosrc ~* '(DELETE FROM|TRUNCATE)' THEN
      RAISE EXCEPTION 'I-07C: % may never delete canonical history', fn;
    END IF;
    IF p.prosrc ~ 'INSERT INTO public\.matching_proposal_transitions' THEN
      RAISE EXCEPTION 'I-07C: % must append every transition through append_matching_proposal_transition_v1', fn;
    END IF;
    -- No private reasoning, no unfiltered conclusion, no refusal, no evidence,
    -- no eligibility row, no profile source row and no authority is read by
    -- either boundary; the canonical resolvers own those reads.
    IF p.prosrc ~ ('public\.(matching_private_reasoning_notes|matching_safe_conclusion_candidates'
                || '|matching_sensitive_filter_refusals|matching_hard_requirement_results'
                || '|matching_eligibility_snapshots|introduction_profile_field_values|introduction_profile_versions'
                || '|matching_context_grants|matching_context_consent_events|pre_match_disclosure_authorit'
                || '|matching_requirement_versions|matching_requirement_items)') THEN
      RAISE EXCEPTION 'I-07C: % may not read private Matching reasoning, evidence, source rows or any authority relation', fn;
    END IF;
    IF p.prosrc ~* 'standing_context|conversation_|\Wmemor|human_intelligence|hypothes|effective_context|public_experience|replay' THEN
      RAISE EXCEPTION 'I-07C: % creates no Shared Standing Context Grant and reads no Personal, Public or Replay state', fn;
    END IF;
    -- No caller-supplied identity, state, reason or clock parameter.
    SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
           array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
      INTO in_names, out_names
      FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
    FOREACH arg_name IN ARRAY in_names LOOP
      IF arg_name ~* '(user|human|actor|grantor|owner|subject|on_behalf|recipient_user|status|state|reason|basis|lifecycle|phase|timestamp|_at$|occurred|clock)' THEN
        RAISE EXCEPTION 'I-07C: % must not accept an identity, state, reason or clock parameter: %', fn, arg_name;
      END IF;
    END LOOP;
    SELECT array_agg(t.typname::text ORDER BY a.ord) INTO in_types
      FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
      JOIN pg_type t ON t.oid = a.argtype;
    IF EXISTS (SELECT 1 FROM unnest(in_types) t WHERE t <> 'uuid') THEN
      RAISE EXCEPTION 'I-07C: % must accept only opaque uuid identities, not %', fn, in_types;
    END IF;
  END LOOP;

  -- THE MATCH CORE, exactly.
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes INTO p FROM pg_proc pr WHERE pr.oid = core::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
         array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
    INTO in_names, out_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id', 'p_proposal_id', 'p_expected_view_id', 'p_world_id',
                       'p_introduction_record_id', 'p_first_recipient_membership_episode_id',
                       'p_candidate_membership_episode_id', 'p_first_recipient_claim_id', 'p_candidate_claim_id',
                       'p_first_recipient_pause_event_id', 'p_candidate_pause_event_id',
                       'p_handoff_package_version_id'] THEN
    RAISE EXCEPTION 'I-07C: the Match core accepts exactly the command, the proposal, the exact accepted view and nine opaque persistence identities, not %', in_names;
  END IF;
  IF out_names <> ARRAY['outcome', 'committed_match_id', 'matched_proposal_id', 'born_world_id',
                        'born_introduction_record_id', 'world_lifecycle', 'world_phase',
                        'world_birth_basis', 'introduction_record_status'] THEN
    RAISE EXCEPTION 'I-07C: the Match core returns exactly the bounded committed result, not %', out_names;
  END IF;
  SELECT string_agg(l.line, E'\n' ORDER BY l.n) INTO cleaned
    FROM regexp_split_to_table(p.prosrc, E'\n') WITH ORDINALITY AS l(line, n)
   WHERE btrim(l.line) NOT LIKE '--%';

  -- THE PUBLISHED LOCK AND REVALIDATION ORDER, on the executable text: enter
  -- the two-human lock; lock every mutable proposal row in id order; check the
  -- exact candidate view; require FORWARDED_TO_SECOND; require the bound first
  -- approval view; run the ONE canonical revalidation; require empty claims;
  -- lock the pointers; require CLEARED last; capture the ONE instant; decide
  -- the deadline against that instant; then and only then the writes, in their
  -- published order, the commit row last and the deferred flush after it.
  entry_pos := strpos(cleaned, 'enter_matching_proposal_decision_v1');
  view_pos := strpos(cleaned, 'assert_matching_recipient_view_current_v1');
  state_pos := strpos(cleaned, 'proposal.proposal_state <> ''FORWARDED_TO_SECOND''');
  binding_pos := strpos(cleaned, 'FROM public.matching_forward_approval_view_bindings b');
  validity_pos := strpos(cleaned, 'resolve_matching_proposal_validity_v1');
  claim_pos := strpos(cleaned, 'c.claim_state = ''HELD''');
  pointer_pos := strpos(cleaned, 'FROM public.matching_participation_state s');
  gate_pos := strpos(cleaned, 'resolve_matching_proposal_prerequisites_v1');
  clock_pos := strpos(cleaned, 'birth_at := clock_timestamp()');
  deadline_pos := strpos(cleaned, 'proposal.expires_at <= birth_at');
  writer_pos := strpos(cleaned, '''FORWARDED_TO_SECOND'', ''MUTUAL_MATCH_COMMITTED''');
  world_pos := strpos(cleaned, 'INSERT INTO public.shared_worlds');
  episode_pos := strpos(cleaned, 'INSERT INTO public.shared_world_membership_episodes');
  record_pos := strpos(cleaned, 'INSERT INTO public.introduction_records');
  claim_write_pos := strpos(cleaned, 'INSERT INTO public.matching_active_introduction_claims');
  pause_pos := strpos(cleaned, 'INSERT INTO public.matching_participation_events');
  cancel_pos := strpos(cleaned, '''CANCELLED_BY_COMPETING_MATCH''');
  handoff_pos := strpos(cleaned, 'INSERT INTO public.matching_match_handoff_package_versions');
  commit_pos := strpos(cleaned, 'INSERT INTO public.matching_match_commits');
  flush_pos := strpos(cleaned, 'public.matching_match_handoff_packages_commit_fk IMMEDIATE');
  IF entry_pos = 0 OR view_pos = 0 OR state_pos = 0 OR binding_pos = 0 OR validity_pos = 0 OR claim_pos = 0
     OR pointer_pos = 0 OR gate_pos = 0 OR clock_pos = 0 OR deadline_pos = 0 OR writer_pos = 0 OR world_pos = 0
     OR episode_pos = 0
     OR record_pos = 0 OR claim_write_pos = 0 OR pause_pos = 0 OR cancel_pos = 0 OR handoff_pos = 0
     OR commit_pos = 0 OR flush_pos = 0
     OR NOT (entry_pos < view_pos AND view_pos < state_pos AND state_pos < binding_pos
             AND binding_pos < validity_pos AND validity_pos < claim_pos AND claim_pos < pointer_pos
             AND pointer_pos < gate_pos AND gate_pos < clock_pos AND clock_pos < deadline_pos
             AND deadline_pos < writer_pos
             AND writer_pos < world_pos AND world_pos < episode_pos AND episode_pos < record_pos
             AND record_pos < claim_write_pos AND claim_write_pos < pause_pos AND pause_pos < cancel_pos
             AND cancel_pos < handoff_pos AND handoff_pos < commit_pos AND commit_pos < flush_pos) THEN
    RAISE EXCEPTION 'I-07C: the Match core must lock, revalidate, gate, capture one instant, decide the deadline against it and write in exactly the published order, the commit row last';
  END IF;
  IF strpos(cleaned, 'ORDER BY p.id') = 0 OR strpos(cleaned, 'ORDER BY p.id') > view_pos THEN
    RAISE EXCEPTION 'I-07C: every mutable proposal row must be locked in ascending proposal id before any currentness is read';
  END IF;

  -- ONE database-owned instant, captured exactly once, and it is the ONLY clock
  -- this core reads. A transaction-fixed clock is settled before the canonical
  -- lock wait, so it can never decide a deadline (review finding I07C-TIME-01).
  IF (length(p.prosrc) - length(replace(p.prosrc, 'clock_timestamp()', ''))) / length('clock_timestamp()') <> 1 THEN
    RAISE EXCEPTION 'I-07C: the canonical Match instant must be captured exactly once';
  END IF;
  IF p.prosrc ~* 'now\(\)|localtimestamp|current_timestamp|transaction_timestamp|statement_timestamp' THEN
    RAISE EXCEPTION 'I-07C: the one captured instant is the only clock the Match core may read, because a transaction-fixed clock precedes the lock wait';
  END IF;

  -- THE ONE WRITER IS CALLED for the winner and for the competitors, and the
  -- cancellation ids are the only database-generated identities.
  IF (length(p.prosrc) - length(replace(p.prosrc, 'append_matching_proposal_transition_v1', '')))
     / length('append_matching_proposal_transition_v1') <> 2 THEN
    RAISE EXCEPTION 'I-07C: the Match core appends exactly two kinds of transition through the one writer: the winner and each competitor';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'gen_random_uuid()', ''))) / length('gen_random_uuid()') <> 1
     OR strpos(cleaned, 'gen_random_uuid()') < cancel_pos - 400 OR strpos(cleaned, 'gen_random_uuid()') > cancel_pos THEN
    RAISE EXCEPTION 'I-07C: only the competing cancellation transition ids are database-generated, because their number is private';
  END IF;
  IF p.prosrc !~ '''COMPETING_MATCH_COMMITTED''' THEN
    RAISE EXCEPTION 'I-07C: a competing cancellation carries the private reason COMPETING_MATCH_COMMITTED';
  END IF;

  -- The born World is exactly ACTIVE / INTRODUCTION / MUTUAL_MATCH with no
  -- closure, and no other lifecycle, phase or basis literal exists in the core.
  IF p.prosrc !~ 'VALUES \(p_world_id, ''ACTIVE'', ''INTRODUCTION'', ''MUTUAL_MATCH'', birth_at, NULL\)' THEN
    RAISE EXCEPTION 'I-07C: a Matching birth must be exactly ACTIVE / INTRODUCTION / MUTUAL_MATCH with no closure moment';
  END IF;
  -- Over the EXECUTABLE text: the body's own comments explain what it must not
  -- write, and prosrc includes them.
  IF cleaned ~ 'READ_ONLY_CLOSED|''STANDARD''|ACCEPTED_INVITATION|''COMPLETED''|''CLOSED''|''RELEASED''|USER_PAUSED|POST_INTRODUCTION|POST_SUCCESS|SYSTEM_POLICY' THEN
    RAISE EXCEPTION 'I-07C: the Match core may name no I-07D lifecycle, no direct birth and no pause but ACTIVE_INTRODUCTION';
  END IF;
  IF cleaned !~ '''PAUSE'', ''PAUSED'',\s*''ACTIVE_INTRODUCTION''' THEN
    RAISE EXCEPTION 'I-07C: both humans are paused with exactly ACTIVE_INTRODUCTION';
  END IF;

  -- DURABLE RESULT IDEMPOTENCY: three passes, each answering the committed
  -- identities and constants and each failing closed on vanished facts.
  IF (length(p.prosrc) - length(replace(p.prosrc, retry_answer, ''))) / length(retry_answer) <> 3 THEN
    RAISE EXCEPTION 'I-07C: every equivalent retry must return the identities and constants this command committed';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, coherence, ''))) / length(coherence) <> 3 THEN
    RAISE EXCEPTION 'I-07C: every equivalent retry must fail closed on a World, birth fact or record that has vanished';
  END IF;
  IF p.prosrc ~ 'RETURN QUERY SELECT[^;]*w\.(lifecycle|phase|birth_basis)' OR p.prosrc ~ 'RETURN QUERY SELECT[^;]*r\.introduction_status' THEN
    RAISE EXCEPTION 'I-07C: an equivalent retry must return the committed result, never the World or record current state';
  END IF;
  IF p.prosrc ~ 'committed\.candidate_user_id = u AND committed\.proposal_id = p_proposal_id'
     AND (length(p.prosrc) - length(replace(p.prosrc, 'AND committed.handoff_package_version_id = p_handoff_package_version_id', '')))
         / length('AND committed.handoff_package_version_id = p_handoff_package_version_id') <> 3 THEN
    RAISE EXCEPTION 'I-07C: every idempotency pass compares the whole immutable request';
  END IF;

  -- EXACT PRODUCER OWNERSHIP, live. The Match core is the ONE function that
  -- names the two reserved I-07B states beside the writer, the ONE producer of
  -- an ACTIVE_INTRODUCTION pause, the ONE inserter of a Match commit, a claim,
  -- an Introduction Record and a handoff, and - beside the direct birth core -
  -- the ONE function that inserts a Shared World. The writer stays the ONE
  -- direct transition inserter, the approval stays the ONE binding inserter,
  -- and no I-07A command names the reserved pause.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prosrc ~ 'append_matching_proposal_transition_v1'
     AND pr.prosrc ~ '(''MUTUAL_MATCH_COMMITTED''|''CANCELLED_BY_COMPETING_MATCH'')';
  IF offending IS DISTINCT FROM 'commit_matching_mutual_match_v1' THEN
    RAISE EXCEPTION 'I-07C: exactly the Match core produces MUTUAL_MATCH_COMMITTED and CANCELLED_BY_COMPETING_MATCH; found %', offending;
  END IF;
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\.matching_participation_events'
     AND pr.prosrc ~ '''ACTIVE_INTRODUCTION''';
  IF offending IS DISTINCT FROM 'commit_matching_mutual_match_v1' THEN
    RAISE EXCEPTION 'I-07C: exactly the Match core produces an ACTIVE_INTRODUCTION pause; found %', offending;
  END IF;
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.proname IN (
     'activate_matching_participation_v1', 'pause_matching_participation_v1',
     'resume_matching_participation_v1', 'turn_off_matching_participation_v1')
     AND pr.prosrc ~ '''ACTIVE_INTRODUCTION''';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07C: the I-07A human commands still have no producer for ACTIVE_INTRODUCTION; found %', offending;
  END IF;
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public'
     AND (pr.prosrc ~ 'INSERT INTO public\.matching_match_commits'
       OR pr.prosrc ~ 'INSERT INTO public\.matching_active_introduction_claims'
       OR pr.prosrc ~ 'INSERT INTO public\.introduction_records'
       OR pr.prosrc ~ 'INSERT INTO public\.matching_match_handoff'
       OR pr.prosrc ~ 'INSERT INTO public\.shared_world_matching_birth_events'
       OR pr.prosrc ~ 'INSERT INTO public\.shared_world_introduction_started_events'
       OR pr.prosrc ~ 'INSERT INTO public\.matching_match_competing_cancellations');
  IF offending IS DISTINCT FROM 'commit_matching_mutual_match_v1' THEN
    RAISE EXCEPTION 'I-07C: exactly the Match core writes the Match commit, the claims, the Introduction Record, the facts, the cancellation links and the handoff; found %', offending;
  END IF;
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\.shared_worlds';
  IF offending IS DISTINCT FROM 'commit_matching_mutual_match_v1, commit_shared_world_direct_acceptance_birth_v1' THEN
    RAISE EXCEPTION 'I-07C: exactly the two frozen birth paths create a Shared World; found %', offending;
  END IF;
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\.matching_proposal_transitions';
  IF offending IS DISTINCT FROM 'append_matching_proposal_transition_v1' THEN
    RAISE EXCEPTION 'I-07C: exactly one function writes a proposal transition; found %', offending;
  END IF;
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\.matching_forward_approval_view_bindings';
  IF offending IS DISTINCT FROM 'approve_matching_proposal_forward_core_v1' THEN
    RAISE EXCEPTION 'I-07C: exactly the forward approval writes a first-acceptance view binding; found %', offending;
  END IF;
  -- The revised approval still writes the SAME transition it always did, and
  -- writes the binding after it in the same transaction.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = approval::regprocedure;
  IF p.prosrc !~ '''OFFERED_TO_FIRST'', ''FIRST_FORWARD_APPROVED'', u, NULL, NULL'
     OR strpos(p.prosrc, 'append_matching_proposal_transition_v1(') > strpos(p.prosrc, 'INSERT INTO public.matching_forward_approval_view_bindings') THEN
    RAISE EXCEPTION 'I-07C: the forward approval writes its transition through the one writer and then binds it to the exact approved view';
  END IF;
  IF p.prosrc ~* 'MUTUAL_MATCH|shared_worlds|introduction_record|handoff|claim' THEN
    RAISE EXCEPTION 'I-07C: forward approval is not a Mutual Match and creates no World, record, claim or handoff';
  END IF;

  -- NO SECOND ACCEPTANCE ANYWHERE IN THE MATCHING NAMESPACE, still.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.proname ~* 'matching'
     AND pr.prosrc ~* '(SECOND_ACCEPTED|ACCEPTED_PENDING_MATCH|MATCH_PENDING|INTRODUCTION_RESERVED)';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07C: there is no second acceptance state and nothing may spell one; found %', offending;
  END IF;

  -- THE 0082 DIRECT BIRTH CORE IS UNTOUCHED and still births ACTIVE / STANDARD.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.commit_shared_world_direct_acceptance_birth_v1(uuid,uuid,uuid,uuid,uuid)'::regprocedure;
  IF p.prosrc !~ 'VALUES \(p_world_id, ''ACTIVE'', ''STANDARD'', ''ACCEPTED_INVITATION'', birth_at, NULL\)'
     OR p.prosrc ~ 'MUTUAL_MATCH' THEN
    RAISE EXCEPTION 'I-07C: the direct birth core must be exactly as 0082 left it';
  END IF;

  -- THE I-07A AND I-07B BOUNDARIES ARE UNCHANGED: the eleven human commands are
  -- still authenticated-only and every I-07B boundary is still executable by
  -- nobody.
  IF NOT has_function_privilege('authenticated', 'public.get_my_matching_setup_v1()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.activate_matching_participation_v1(uuid,text,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.decline_matching_proposal_as_second_core_v1(uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.prepare_matching_proposal_core_v1(uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I-07C: the I-07A and I-07B execution boundaries must be exactly as 0109 and 0112 left them';
  END IF;
END$$;

COMMIT;
