-- QAN-CW-REM-02 - Matching proposal temporal correctness and exact-view
-- decision identity v1.
--
-- Two accepted phase-wide assurance findings, both of them defect classes I-07C
-- already found and fixed at ONE site while the sibling I-07B sites kept them.
--
-- ## ASSURE-F01 - a transaction clock decided a deadline AFTER a lock wait
--
-- Migration 0112 delivers a proposal like this:
--
--     PERFORM lock_matching_pair_humans_v1(...);   -- may block for minutes
--     ...
--     IF proposal.expires_at <= CURRENT_TIMESTAMP THEN
--       RAISE EXCEPTION 'MATCHING_PROPOSAL_EXPIRED';
--     END IF;
--     materialize the recipient view          -- irreversible disclosure
--     append the transition
--
-- `CURRENT_TIMESTAMP` is the TRANSACTION-START timestamp in PostgreSQL, and so
-- are `now()`, `transaction_timestamp()` and `statement_timestamp()` for this
-- purpose: every one of them is settled BEFORE the command ever waits on the
-- canonical two-human lock. A delivery that began while the proposal was live,
-- blocked on that lock, crossed `expires_at` while blocked and then resumed
-- would compare a moment that had already gone by, and would disclose protected
-- proposal material after the real deadline.
--
-- I-07C found exactly this in the Mutual Match commit (review finding
-- I07C-TIME-01) and fixed it by deciding the deadline against one
-- `clock_timestamp()` captured after every gate and before the first write.
-- This migration applies that class to the two remaining delivery siblings:
-- `offer_matching_proposal_to_first_core_v1` and
-- `forward_matching_proposal_to_second_core_v1`.
--
-- ## The clock is NOT replaced everywhere, and that is the finding, not laziness
--
-- Every transaction-fixed clock in the proposal choreography was classified.
-- Two of five are the harmful class and are corrected here; the other three are
-- left EXACTLY as they are, because in each of them a stale clock can only
-- refuse, delay or shorten - never widen authority or exposure:
--
--   prepare_matching_proposal_core_v1, cadence window
--     `prepared_at > CURRENT_TIMESTAMP - window`. An older clock moves the
--     window's lower bound EARLIER, counts MORE prior proposals and therefore
--     refuses MORE often. SAFE-CONSERVATIVE.
--
--   prepare_matching_proposal_core_v1, the deadline it mints
--     `deadline := CURRENT_TIMESTAMP + expiry_hours`. The transaction instant is
--     deliberately the ONE coherent preparation moment - `prepared_at` defaults
--     to the same clock and `expires_at > prepared_at` is a CHECK over the pair -
--     and an older clock yields a SHORTER life, never a longer one. Replacing it
--     with a wall clock read after the lock would LENGTHEN every proposal, which
--     is the wrong direction. SAFE-SNAPSHOT.
--
--   expire_matching_proposal_core_v1, the not-yet-expired refusal
--     `expires_at > CURRENT_TIMESTAMP` refuses to expire. An older clock can
--     only make that refusal MORE likely: it can delay an ending, and it can
--     never end a proposal that is not really past its deadline. A protective
--     terminal that occasionally declines to fire is the fail-closed direction,
--     and after this migration a proposal past its real deadline can no longer
--     be delivered whether or not anything expired it. SAFE-CONSERVATIVE.
--
-- The four human decisions read no clock at all.
--
-- ## Where the instant is captured, and why exactly there
--
-- After the canonical pair lock, after historical idempotency, after
-- revalidation, after the CW2-08 clearance gate, and immediately before the
-- first irreversible delivery write:
--
--     canonical pair lock
--       -> historical idempotency
--       -> revalidation
--       -> CW2-08 clearance
--       -> delivery_at := clock_timestamp()
--       -> expires_at <= delivery_at  ->  MATCHING_PROPOSAL_EXPIRED
--       -> materialize the recipient view
--       -> append the transition
--
-- `materialize_matching_recipient_view_core_v1` does take one more row lock -
-- `FOR UPDATE` on this recipient's view-state pointer - but it cannot WAIT on
-- it: the only writer of that row is that same primitive, and it takes the
-- two-human lock first, which this delivery already holds. The only real wait in
-- the path is the pair lock, and the instant is read after it.
--
-- ## ASSURE-F08 - three decision retries proved no exact view
--
-- The four I-07B human decisions each take `p_expected_view_id`, because a
-- consequential human act is authorized by the exact recipient view version that
-- human saw. Migration 0114 made the FIRST_FORWARD_APPROVED retry prove it
-- (review finding I07C-AUTH-01). Its three siblings still answered historical
-- success from the transition alone:
--
--     decline_matching_proposal_as_first_core_v1
--     decline_matching_proposal_as_second_core_v1
--     withdraw_matching_proposal_core_v1
--
-- A retry of any of them carrying a DIFFERENT exact view received the original
-- committed answer, which is a different request answered under a reused command
-- id. Each now writes `matching_proposal_decision_view_bindings` in the same
-- transaction as its transition, and each retry answers from that durable row.
--
--   same command + same immutable request + same exact view -> historical result
--   same command + different exact view                     -> command conflict
--   committed transition + missing binding                  -> contradictory
--
-- The historical view is NEVER inferred from the current view pointer, because
-- the current view may have moved since the act. A committed decision whose
-- binding is absent proves nothing and is not repaired here: it fails closed.
--
-- ## Transitions committed before this migration
--
-- No historical exact-view evidence is invented. A FIRST_DECLINED,
-- SECOND_DECLINED or WITHDRAWN transition committed before 0120 keeps its row,
-- its private terminal reason and its terminal proposal lifecycle exactly as
-- they are; nothing is backfilled and nothing is deleted. What such a command
-- can no longer do is claim an equivalent retry, because it cannot prove the
-- exact view that authorized it - so that retry is contradictory rather than
-- successful. That is the only honest answer available, and it is the same one
-- 0114 chose for a forward approval with no binding.
--
-- ## Withdrawal keeps its extra immutable input
--
-- `WITHDRAWN` is legal from three states, so `p_expected_state` is part of the
-- withdrawal's command identity and stays part of it. The retry now compares the
-- committed prior state AND the bound exact view, and any difference in either
-- is one bounded `MATCHING_COMMAND_ID_CONFLICT` - decided from durable rows,
-- with no currentness consulted.
--
-- ## What is deliberately unchanged
--
-- `matching_forward_approval_view_bindings` is untouched and remains the
-- authoritative first-acceptance evidence the Mutual Match consumes; the new
-- relation is a second, separate binding for the three TERMINAL decisions and
-- replaces nothing. `enter_matching_proposal_decision_v1` still enters the
-- serialization region before any currentness is read (I07B-CONC-01). The
-- CW2-08 gate is still required on the four consequential boundaries and still
-- absent from withdrawal. Every neutral recipient outcome, every anti-oracle
-- refusal and the whole pre-launch ACL are exactly as they were: the binding is
-- internal authority evidence and no projection can reach it.
--
-- Migrations 0001-0119 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ONE ADDITIVE CANDIDATE KEY ON A PREDECESSOR RELATION.
--
--    A candidate key over an existing primary key. It refuses nothing the
--    predecessor accepted, changes no row and adds no column; it exists so the
--    binding below can bind a view's ROLE as an exact row rather than as a
--    remembered check. Migration 0113 added six of exactly this shape for
--    exactly this reason.
-- ---------------------------------------------------------------------------
ALTER TABLE public.matching_recipient_proposal_views
    ADD CONSTRAINT matching_recipient_proposal_views_role_identity_key
    UNIQUE (id, recipient_role);

-- ---------------------------------------------------------------------------
-- 2. THE DURABLE EXACT-VIEW BINDING OF A TERMINAL HUMAN PROPOSAL DECISION.
--
--    One row per committed FIRST_DECLINED, SECOND_DECLINED or WITHDRAWN
--    transition, naming the exact recipient view version that authorized it.
--
--    Binding a human's decision to ANOTHER human's view is unrepresentable
--    rather than merely refused, and the chain is entirely structural:
--
--      decision_state fixes decider_role            (role CHECK)
--      decider_role   fixes the view's own role     (role foreign key)
--      the view is a view OF THIS PROPOSAL FOR THIS HUMAN  (audience foreign key)
--      a view's role fixes which member its recipient is   (the 0110 audience CHECK)
--      the transition is THIS proposal's transition into THIS decision
--                                                    (transition foreign key)
--      which role may have acted is fixed by the resulting state
--                                                    (the 0110 actor CHECK)
--
--    so a FIRST_DECLINED binding can only ever carry the first recipient's own
--    FIRST_RECIPIENT view of this proposal, and a SECOND_DECLINED binding can
--    only ever carry the candidate's own CANDIDATE view of it.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_proposal_decision_view_bindings (
    -- The terminal decision transition id, which IS the decision command id.
    decision_transition_id uuid PRIMARY KEY,
    proposal_id uuid NOT NULL,
    decision_state text NOT NULL,
    decider_role text NOT NULL,
    decider_user_id uuid NOT NULL,
    decided_view_id uuid NOT NULL,
    bound_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- All three decisions are TERMINAL, so a proposal carries at most one.
    CONSTRAINT matching_proposal_decision_view_bindings_proposal_key UNIQUE (proposal_id),
    -- The composite identity a retry compares: this transition, this proposal,
    -- this exact decided view.
    CONSTRAINT matching_proposal_decision_view_bindings_exact_key
        UNIQUE (decision_transition_id, proposal_id, decided_view_id),
    CONSTRAINT matching_proposal_decision_view_bindings_state_check
        CHECK (decision_state IN ('FIRST_DECLINED', 'SECOND_DECLINED', 'WITHDRAWN')),
    -- WHICH ROLE MAY HAVE DECIDED IS FIXED BY THE DECISION, exactly as 0110
    -- fixes which actor slot a resulting state may fill.
    CONSTRAINT matching_proposal_decision_view_bindings_role_check
        CHECK (decider_role = CASE decision_state
                                WHEN 'SECOND_DECLINED' THEN 'CANDIDATE'
                                ELSE 'FIRST_RECIPIENT' END),
    -- The bound transition is THIS proposal's transition into exactly THAT
    -- decision - never another proposal's, and never another decision.
    CONSTRAINT matching_proposal_decision_view_bindings_transition_fk
        FOREIGN KEY (decision_transition_id, proposal_id, decision_state)
        REFERENCES public.matching_proposal_transitions (id, proposal_id, resulting_state) ON DELETE RESTRICT,
    -- The decided view is a view OF THIS PROPOSAL FOR THAT HUMAN.
    CONSTRAINT matching_proposal_decision_view_bindings_view_fk
        FOREIGN KEY (decided_view_id, proposal_id, decider_user_id)
        REFERENCES public.matching_recipient_proposal_views (id, proposal_id, recipient_user_id) ON DELETE RESTRICT,
    -- ... and it is a view of exactly THAT ROLE, which the 0110 audience CHECK
    -- then pins to exactly one of the proposal's two members.
    CONSTRAINT matching_proposal_decision_view_bindings_role_fk
        FOREIGN KEY (decided_view_id, decider_role)
        REFERENCES public.matching_recipient_proposal_views (id, recipient_role) ON DELETE RESTRICT
);

CREATE INDEX matching_proposal_decision_view_bindings_decider_idx
    ON public.matching_proposal_decision_view_bindings (decider_user_id, bound_at);

COMMENT ON TABLE public.matching_proposal_decision_view_bindings IS
  'The durable, immutable binding of one TERMINAL human proposal decision - a '
  'first decline, a second decline or a withdrawal - to the exact proposal, the '
  'exact deciding human in their exact role, and the exact recipient view '
  'version that authorized the act. An equivalent retry is answered from this '
  'row; a retry naming any other view is a different request under a reused '
  'command id. It is internal authority evidence and no recipient projection '
  'reaches it. It neither replaces nor weakens '
  'matching_forward_approval_view_bindings, which remains the authoritative '
  'first-acceptance evidence a Mutual Match consumes.';

-- Append-only, through the trigger function 0110 already installed for exactly
-- this: a decision's authorizing view is history the moment it is written.
CREATE TRIGGER matching_proposal_decision_view_bindings_immutable
    BEFORE UPDATE OR DELETE ON public.matching_proposal_decision_view_bindings
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();

-- ---------------------------------------------------------------------------
-- 3. DENY-BY-DEFAULT ACCESS POSTURE, exactly as 0110 and 0113 left theirs.
-- ---------------------------------------------------------------------------
ALTER TABLE public.matching_proposal_decision_view_bindings OWNER TO postgres;
ALTER TABLE public.matching_proposal_decision_view_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.matching_proposal_decision_view_bindings FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.matching_proposal_decision_view_bindings FROM service_role';
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 4. THE TWO DELIVERY PATHS, with the deadline decided on the real instant.
--
--    Byte-for-byte the 0112 boundaries in their signature, their result shape,
--    their idempotency, their gates, their ordering and their ACL. The ONE
--    change in each is WHERE and AGAINST WHAT the deadline is decided.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.offer_matching_proposal_to_first_core_v1(
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
  delivery_at timestamptz;
BEGIN
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  PERFORM public.lock_matching_pair_humans_v1(proposal.lower_user_id, proposal.higher_user_id);

  -- IDEMPOTENCY FIRST, before any gate. An equivalent retry answers from the
  -- COMMITTED rows even if clearance, authority, the view or the DEADLINE has
  -- moved since - a retry must not be able to produce a different answer than
  -- the call it repeats, and a delivery that committed while the proposal was
  -- live is not re-decided against today's deadline - and the same command id
  -- carrying a different view fails closed.
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

  -- THE LAST GATE, after every privacy and authority gate has already passed, so
  -- a clearance refusal never reveals that the others would have passed.
  SELECT * INTO gate FROM public.resolve_matching_proposal_prerequisites_v1(p_proposal_id);
  IF gate.clearance <> 'CLEARED' THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL=gate.basis;
  END IF;

  -- THE REAL DELIVERY INSTANT, read from the database clock once, after every
  -- gate and with nothing written yet. A transaction-fixed clock is settled
  -- BEFORE this command waits on the canonical pair lock above: a delivery that
  -- entered while the proposal was live, blocked on that lock and resumed past
  -- the deadline would compare a moment that had already gone by and disclose
  -- protected material the proposal no longer authorized (assurance finding
  -- ASSURE-F01, the class I-07C fixed for the Mutual Match). The instant this
  -- delivery would REALLY happen at is the only lawful basis for the decision.
  delivery_at := clock_timestamp();
  IF proposal.expires_at <= delivery_at THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_EXPIRED' USING ERRCODE='55000';
  END IF;

  -- THE IRREVERSIBLE DELIVERY BEGINS HERE, and nothing between the instant and
  -- this line can wait: the only writer of this recipient's view-state pointer
  -- takes the two-human lock this transaction already holds.
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
  'clearance as the last gate, decide the deadline against the REAL delivery '
  'instant read after the canonical pair lock, materialize that recipient''s own '
  'view through the disclosure gate, append the transition. A delivery that '
  'waited on the lock past the deadline fails closed with nothing written; a '
  'delivery that already committed while the proposal was live still answers its '
  'equivalent retry from the committed rows. The candidate is not notified and '
  'gains no readable row, so no "a proposal existed" oracle is created for them.';

CREATE OR REPLACE FUNCTION public.forward_matching_proposal_to_second_core_v1(
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
  delivery_at timestamptz;
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

  SELECT * INTO gate FROM public.resolve_matching_proposal_prerequisites_v1(p_proposal_id);
  IF gate.clearance <> 'CLEARED' THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL=gate.basis;
  END IF;

  -- THE REAL DELIVERY INSTANT, for the reason the first delivery records above.
  -- This proof is independent of that one: the second delivery has its own lock
  -- wait, its own gates and its own disclosure, and the candidate is a different
  -- human being told about a different subject.
  delivery_at := clock_timestamp();
  IF proposal.expires_at <= delivery_at THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_EXPIRED' USING ERRCODE='55000';
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
  'approved forwarding, with the deadline decided against the REAL delivery '
  'instant read after the canonical pair lock. It materializes the candidate''s '
  'own view over their own subject, authority, profile version and '
  'recipient-specific conclusion; it never reads the first recipient''s view, so '
  'there is no copy path and no name swap. A material change between approval '
  'and forwarding revalidates rather than delivering, and a forward that waited '
  'past the deadline delivers nothing at all.';

-- ---------------------------------------------------------------------------
-- 5. THE THREE TERMINAL HUMAN DECISIONS, each durably bound to its exact view.
--
--    Byte-for-byte the 0112 boundaries in their authority, their
--    serialized-region ordering, their gates, their answers and their ACL, plus
--    ONE additional write in the same transaction and ONE strengthened retry
--    comparison. The retry reads durable rows and nothing else: not clearance,
--    not the current view, not the current proposal state, not the deadline and
--    not the Matching setup.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decline_matching_proposal_as_first_core_v1(
  p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid
) RETURNS TABLE(decline_transition_id uuid, declined_state text, neutral_outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  gate record;
  bound public.matching_proposal_decision_view_bindings;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);
  IF EXISTS (SELECT 1 FROM public.matching_proposal_transitions t
              WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
                AND t.resulting_state = 'FIRST_DECLINED' AND t.first_recipient_actor_id = u) THEN
    -- The committed decline binds ONE exact view. An equivalent retry answers
    -- from the committed rows; a retry naming any other view is a different
    -- request under a reused id and fails closed. A committed decline whose
    -- binding is MISSING cannot prove which view authorized it: it is
    -- contradictory rather than repairable, no historical view is inferred, and
    -- nothing is read from the current view pointer, which may have moved since
    -- (assurance finding ASSURE-F08).
    SELECT * INTO bound FROM public.matching_proposal_decision_view_bindings b
     WHERE b.decision_transition_id = p_command_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MATCHING_DECISION_CONTRADICTORY_STATE' USING ERRCODE='P0001',
        DETAIL='A committed human proposal decision carries its durable exact-view binding; one without it proves nothing and is not repaired here.';
    END IF;
    IF bound.decided_view_id IS DISTINCT FROM p_expected_view_id THEN
      RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
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
  -- reason is recorded where only private operational state lives. The binding
  -- is written in the same transaction as the transition, so no successful
  -- decline can exist without the view that authorized it.
  PERFORM public.append_matching_proposal_transition_v1(
    p_command_id, p_proposal_id, 'OFFERED_TO_FIRST', 'FIRST_DECLINED', u, NULL, 'RECIPIENT_DECLINED');
  INSERT INTO public.matching_proposal_decision_view_bindings
    (decision_transition_id, proposal_id, decision_state, decider_role, decider_user_id, decided_view_id)
  VALUES (p_command_id, p_proposal_id, 'FIRST_DECLINED', 'FIRST_RECIPIENT', u, p_expected_view_id);

  RETURN QUERY SELECT p_command_id, 'FIRST_DECLINED'::text, 'CLOSED_BY_YOU'::text;
END$$;

COMMENT ON FUNCTION public.decline_matching_proposal_as_first_core_v1(uuid, uuid, uuid) IS
  'The first recipient declines, terminally, bound to the exact view version '
  'they were shown and - since QAN-CW-REM-02 - durably recorded as such, so an '
  'equivalent retry proves the same exact view and a retry naming another one '
  'fails closed. The candidate learns nothing: no candidate-side row, no '
  'notification, no audit projection and no reciprocal proposal exists, and the '
  'private decline reason never leaves the transition.';

CREATE OR REPLACE FUNCTION public.decline_matching_proposal_as_second_core_v1(
  p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid
) RETURNS TABLE(decline_transition_id uuid, declined_state text, neutral_outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  gate record;
  bound public.matching_proposal_decision_view_bindings;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);
  IF EXISTS (SELECT 1 FROM public.matching_proposal_transitions t
              WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
                AND t.resulting_state = 'SECOND_DECLINED' AND t.candidate_actor_id = u) THEN
    -- The same durable comparison the first decline makes, over the CANDIDATE's
    -- own exact view. Nothing here reads the current view pointer.
    SELECT * INTO bound FROM public.matching_proposal_decision_view_bindings b
     WHERE b.decision_transition_id = p_command_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MATCHING_DECISION_CONTRADICTORY_STATE' USING ERRCODE='P0001',
        DETAIL='A committed human proposal decision carries its durable exact-view binding; one without it proves nothing and is not repaired here.';
    END IF;
    IF bound.decided_view_id IS DISTINCT FROM p_expected_view_id THEN
      RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
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
  INSERT INTO public.matching_proposal_decision_view_bindings
    (decision_transition_id, proposal_id, decision_state, decider_role, decider_user_id, decided_view_id)
  VALUES (p_command_id, p_proposal_id, 'SECOND_DECLINED', 'CANDIDATE', u, p_expected_view_id);

  RETURN QUERY SELECT p_command_id, 'SECOND_DECLINED'::text, 'CLOSED_BY_YOU'::text;
END$$;

COMMENT ON FUNCTION public.decline_matching_proposal_as_second_core_v1(uuid, uuid, uuid) IS
  'The second recipient declines, terminally and privately, bound to the exact '
  'candidate view version they were shown and - since QAN-CW-REM-02 - durably '
  'recorded as such. There is deliberately no acceptance counterpart in I-07B: '
  'acceptance must converge atomically with the Mutual Match transaction, and '
  'that is I-07C.';

CREATE OR REPLACE FUNCTION public.withdraw_matching_proposal_core_v1(
  p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid, p_expected_state text
) RETURNS TABLE(withdraw_transition_id uuid, withdrawn_state text, neutral_outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.matching_proposal_transitions;
  bound public.matching_proposal_decision_view_bindings;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_expected_state IS NULL
     OR p_expected_state NOT IN ('OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND') THEN
    RAISE EXCEPTION 'MATCHING_WITHDRAWAL_STATE_INVALID' USING ERRCODE='22023',
      DETAIL='A human withdraws a proposal they were shown. A PREPARED proposal has been shown to nobody, so no I-07B path withdraws one.';
  END IF;
  PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);
  -- THE WHOLE IMMUTABLE REQUEST, compared from durable rows. The branch is
  -- entered from the committed WITHDRAWAL itself rather than from a match on the
  -- whole request, because a command id that already withdrew this proposal and
  -- is now replayed with a different expected prior state or a different exact
  -- view is a DIFFERENT REQUEST UNDER A REUSED ID - and must be told exactly
  -- that, rather than sent on to a currentness check that would answer with
  -- some other class. WITHDRAWN is legal from three states, so the prior state
  -- is part of this command's identity and stays part of it.
  SELECT * INTO committed FROM public.matching_proposal_transitions t
   WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
     AND t.resulting_state = 'WITHDRAWN' AND t.first_recipient_actor_id = u;
  IF FOUND THEN
    SELECT * INTO bound FROM public.matching_proposal_decision_view_bindings b
     WHERE b.decision_transition_id = p_command_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MATCHING_DECISION_CONTRADICTORY_STATE' USING ERRCODE='P0001',
        DETAIL='A committed human proposal decision carries its durable exact-view binding; one without it proves nothing and is not repaired here.';
    END IF;
    IF committed.prior_state IS DISTINCT FROM p_expected_state
       OR bound.decided_view_id IS DISTINCT FROM p_expected_view_id THEN
      RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT p_command_id, 'WITHDRAWN'::text, 'CLOSED_BY_YOU'::text; RETURN;
  END IF;
  PERFORM public.assert_matching_recipient_view_current_v1(p_proposal_id, u, p_expected_view_id, 'FIRST_RECIPIENT');

  -- Withdrawal is the human ending their OWN exposure, so it is deliberately not
  -- gated on the launch prerequisite. A proposal that could not be withdrawn
  -- because a gate was unavailable would be the opposite of fail-closed.
  PERFORM public.append_matching_proposal_transition_v1(
    p_command_id, p_proposal_id, p_expected_state, 'WITHDRAWN', u, NULL, 'WITHDRAWN_BY_FIRST_PARTY');
  INSERT INTO public.matching_proposal_decision_view_bindings
    (decision_transition_id, proposal_id, decision_state, decider_role, decider_user_id, decided_view_id)
  VALUES (p_command_id, p_proposal_id, 'WITHDRAWN', 'FIRST_RECIPIENT', u, p_expected_view_id);

  -- If the second recipient has already been shown a proposal, their delivered
  -- view is NOT erased and their projection now answers NO_LONGER_AVAILABLE -
  -- the same answer an expiry gives, with no reason, no timing detail and no
  -- hint that any other proposal activity exists.
  RETURN QUERY SELECT p_command_id, 'WITHDRAWN'::text, 'CLOSED_BY_YOU'::text;
END$$;

COMMENT ON FUNCTION public.withdraw_matching_proposal_core_v1(uuid, uuid, uuid, text) IS
  'The first party withdraws before any Mutual Match, binding the exact view '
  'version they hold and the exact current state, and - since QAN-CW-REM-02 - '
  'durably recording that view so an equivalent retry proves BOTH the prior '
  'state and the exact view. Any difference in either under a reused command id '
  'is one bounded conflict, decided from durable rows with no currentness '
  'consulted. A second recipient who was already shown a proposal keeps their '
  'delivered view and is told only that it is no longer available - the same '
  'answer an expiry gives.';

-- ---------------------------------------------------------------------------
-- 6. OWNERSHIP AND THE PRE-LAUNCH ACL: still executable by nobody.
--
--    CREATE OR REPLACE preserves an ACL, so the posture is revoked again
--    explicitly rather than trusted - exactly as 0114 did for the one I-07B
--    boundary it replaced.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  boundary text;
BEGIN
  FOREACH boundary IN ARRAY ARRAY[
    'public.offer_matching_proposal_to_first_core_v1(uuid,uuid,uuid,uuid)',
    'public.forward_matching_proposal_to_second_core_v1(uuid,uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_first_core_v1(uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_second_core_v1(uuid,uuid,uuid)',
    'public.withdraw_matching_proposal_core_v1(uuid,uuid,uuid,text)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', boundary);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', boundary);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', boundary);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 7. TERMINAL SELF-ASSERTIONS.
--
--     The migration refuses to deploy a correction that is application-
--     executable, caller-identified, unpinned, wrongly ordered, that lets a
--     transaction clock decide either delivery deadline, that writes a
--     transition itself, that leaves a decision producer without its binding,
--     that answers a retry without reading one, that weakens the I-07C
--     first-acceptance binding, or that globally bans a clock this task
--     classified as safe.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  deliveries text[] := ARRAY[
    'public.offer_matching_proposal_to_first_core_v1(uuid,uuid,uuid,uuid)',
    'public.forward_matching_proposal_to_second_core_v1(uuid,uuid,uuid,uuid)'];
  decisions text[] := ARRAY[
    'public.decline_matching_proposal_as_first_core_v1(uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_second_core_v1(uuid,uuid,uuid)',
    'public.withdraw_matching_proposal_core_v1(uuid,uuid,uuid,text)'];
  replaced text[] := ARRAY[
    'public.offer_matching_proposal_to_first_core_v1(uuid,uuid,uuid,uuid)',
    'public.forward_matching_proposal_to_second_core_v1(uuid,uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_first_core_v1(uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_second_core_v1(uuid,uuid,uuid)',
    'public.withdraw_matching_proposal_core_v1(uuid,uuid,uuid,text)'];
  gated text[] := ARRAY[
    'public.offer_matching_proposal_to_first_core_v1(uuid,uuid,uuid,uuid)',
    'public.forward_matching_proposal_to_second_core_v1(uuid,uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_first_core_v1(uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_second_core_v1(uuid,uuid,uuid)'];
  -- The 0112 input parameter list of each replaced boundary, in order, as one
  -- joined string per boundary: a one-dimensional array so the comparison is a
  -- plain equality rather than a slice of a ragged nested one.
  expected_inputs text[] := ARRAY[
    'p_command_id, p_proposal_id, p_view_id, p_permitted_conclusion_id',
    'p_command_id, p_proposal_id, p_view_id, p_permitted_conclusion_id',
    'p_command_id, p_proposal_id, p_expected_view_id',
    'p_command_id, p_proposal_id, p_expected_view_id',
    'p_command_id, p_proposal_id, p_expected_view_id, p_expected_state'];
  fn text;
  p record;
  cleaned text;
  offending text;
  target_role text;
  lock_pos integer;
  retry_pos integer;
  validity_pos integer;
  gate_pos integer;
  clock_pos integer;
  deadline_pos integer;
  view_pos integer;
  writer_pos integer;
  entry_pos integer;
  binding_read_pos integer;
  missing_pos integer;
  compare_pos integer;
  historical_pos integer;
  bind_pos integer;
  i integer;
BEGIN
  -- ------------------------------------------------------------- the posture
  FOREACH fn IN ARRAY replaced LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pr.proargnames, pr.proargmodes,
           pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'QAN-CW-REM-02: % must be postgres-owned', fn; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'QAN-CW-REM-02: % must be SECURITY DEFINER', fn; END IF;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'QAN-CW-REM-02: % is a mutation and must be VOLATILE', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must pin an empty search_path', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: PUBLIC must not execute % before the CW2-08 Launch Gate exists', fn;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'QAN-CW-REM-02: % must not execute % - a correction never widens a consequential boundary', target_role, fn;
      END IF;
    END LOOP;
    -- NOTHING REWRITES OR ERASES HISTORY, and every transition still goes
    -- through the ONE writer.
    IF p.prosrc ~* '(DELETE FROM|TRUNCATE)' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % may never erase Matching history', fn;
    END IF;
    IF p.prosrc ~ 'INSERT INTO public\.matching_proposal_transitions' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must append every transition through append_matching_proposal_transition_v1', fn;
    END IF;
    IF p.prosrc ~* '(pg_advisory|LOCK TABLE)' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % takes no advisory lock and no table lock', fn;
    END IF;
    -- NO CALLER-SUPPLIED CLOCK ANYWHERE, read from proargnames/proargmodes
    -- because for a RETURNS TABLE function a rendered signature also reports the
    -- RESULT columns, several of which legitimately name an instant.
    SELECT string_agg(a.name, ', ') INTO offending
      FROM unnest(p.proargnames,
                  coalesce(p.proargmodes,
                           array_fill('i'::"char", ARRAY[coalesce(array_length(p.proargnames, 1), 0)])))
             AS a(name, mode)
     WHERE a.mode = 'i' AND a.name ~* '(timestamp|_at$|occurred|clock|now|deadline|expir)';
    IF offending IS NOT NULL THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must not accept a caller-supplied instant: %', fn, offending;
    END IF;
  END LOOP;

  -- THE SIGNATURES DID NOT MOVE. A forward replacement that quietly changed a
  -- parameter would be a new boundary wearing an old name.
  FOR i IN 1 .. array_length(replaced, 1) LOOP
    SELECT string_agg(a.name, ', ' ORDER BY a.ord) INTO offending
      FROM pg_proc pr,
           LATERAL unnest(pr.proargnames, pr.proargmodes) WITH ORDINALITY AS a(name, mode, ord)
     WHERE pr.oid = replaced[i]::regprocedure AND a.mode = 'i';
    IF offending IS DISTINCT FROM expected_inputs[i] THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must keep its exact 0112 input parameters, found %', replaced[i], offending;
    END IF;
  END LOOP;

  -- ------------------------------------------- ASSURE-F01: the delivery clock
  FOREACH fn IN ARRAY deliveries LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    -- A TRANSACTION-FIXED CLOCK IS SETTLED BEFORE THE LOCK WAIT, so none of them
    -- may appear in a delivery path at all. This is over the WHOLE source
    -- including comments, which is why the bodies above describe the defect
    -- without spelling any of these names.
    IF p.prosrc ~* '(current_timestamp|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp)' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % may read no transaction-fixed clock: it is settled before the canonical pair lock wait', fn;
    END IF;
    IF (length(p.prosrc) - length(replace(p.prosrc, 'clock_timestamp()', ''))) / length('clock_timestamp()') <> 1 THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must capture the real delivery instant exactly once', fn;
    END IF;
    -- THE PLACEMENT IS THE PROPERTY. Comment lines are removed before the
    -- positions are compared, because prosrc includes comments and the prose
    -- above names these steps in explanatory order.
    SELECT string_agg(l.line, E'\n' ORDER BY l.n) INTO cleaned
      FROM regexp_split_to_table(p.prosrc, E'\n') WITH ORDINALITY AS l(line, n)
     WHERE btrim(l.line) NOT LIKE '--%';
    lock_pos := strpos(cleaned, 'lock_matching_pair_humans_v1');
    retry_pos := strpos(cleaned, 'FROM public.matching_proposal_transitions t');
    validity_pos := strpos(cleaned, 'resolve_matching_proposal_validity_v1');
    gate_pos := strpos(cleaned, 'gate.clearance <> ''CLEARED''');
    clock_pos := strpos(cleaned, 'delivery_at := clock_timestamp()');
    deadline_pos := strpos(cleaned, 'proposal.expires_at <= delivery_at');
    view_pos := strpos(cleaned, 'materialize_matching_recipient_view_core_v1');
    writer_pos := strpos(cleaned, 'append_matching_proposal_transition_v1');
    IF lock_pos = 0 OR retry_pos = 0 OR validity_pos = 0 OR gate_pos = 0 OR clock_pos = 0
       OR deadline_pos = 0 OR view_pos = 0 OR writer_pos = 0
       OR NOT (lock_pos < retry_pos AND retry_pos < validity_pos AND validity_pos < gate_pos
               AND gate_pos < clock_pos AND clock_pos < deadline_pos AND deadline_pos < view_pos
               AND view_pos < writer_pos) THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must lock, answer an equivalent retry, revalidate, gate, capture the real delivery instant, decide the deadline against it, and only then disclose and append', fn;
    END IF;
    IF p.prosrc !~ 'resolve_matching_proposal_prerequisites_v1' OR p.prosrc !~ '''CLEARED''' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must still require exactly CLEARED from the CW2-08 prerequisite seam', fn;
    END IF;
    IF p.prosrc !~ 'MATCHING_PROPOSAL_EXPIRED' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must keep the exact existing expiry refusal', fn;
    END IF;
  END LOOP;

  -- THE CLASSIFIED-SAFE CLOCKS ARE UNTOUCHED. This task corrected a defect
  -- class, not every clock: a global ban would have shortened no exposure and
  -- would have LENGTHENED every proposal by minting its deadline from a later
  -- instant. Asserting that they are still there is what keeps the correction
  -- honest about its own scope.
  FOREACH fn IN ARRAY ARRAY[
    'public.prepare_matching_proposal_core_v1(uuid,uuid,uuid)',
    'public.expire_matching_proposal_core_v1(uuid,uuid)'] LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc !~ 'CURRENT_TIMESTAMP' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % keeps its classified-safe transaction clock and must not have been rewritten here', fn;
    END IF;
    IF p.prosrc ~ 'clock_timestamp' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % was classified SAFE and is out of scope; it may not have gained a wall clock', fn;
    END IF;
  END LOOP;

  -- THE I-07C CROSS-DEADLINE FIX IS NON-REGRESSED, in the sibling that found the
  -- class in the first place.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.commit_matching_mutual_match_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid)'::regprocedure;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'clock_timestamp()', ''))) / length('clock_timestamp()') <> 1
     OR p.prosrc ~* '(now\(\)|localtimestamp|current_timestamp|transaction_timestamp|statement_timestamp)'
     OR p.prosrc !~ 'proposal\.expires_at <= birth_at' THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: the I-07C Mutual Match must still decide its deadline against its one captured birth instant';
  END IF;

  -- ------------------------------------ ASSURE-F08: the exact-view identity
  FOREACH fn IN ARRAY decisions LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc !~ 'auth\.uid\(\)' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % is a human decision and must derive its human from auth.uid()', fn;
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
      RAISE EXCEPTION 'QAN-CW-REM-02: % must not accept an identity parameter: %', fn, offending;
    END IF;
    SELECT string_agg(l.line, E'\n' ORDER BY l.n) INTO cleaned
      FROM regexp_split_to_table(p.prosrc, E'\n') WITH ORDINALITY AS l(line, n)
     WHERE btrim(l.line) NOT LIKE '--%';
    -- I07B-CONC-01 IS NON-REGRESSED: the serialization region is entered before
    -- any currentness is read, and the pair lock is reached only through it.
    entry_pos := strpos(cleaned, 'enter_matching_proposal_decision_v1');
    view_pos := strpos(cleaned, 'assert_matching_recipient_view_current_v1');
    IF entry_pos = 0 OR view_pos = 0 OR entry_pos > view_pos THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must enter the canonical two-human serialization region BEFORE it checks the exact recipient view', fn;
    END IF;
    IF cleaned ~ '(lock_matching_pair_humans_v1|INSERT INTO public\.matching_setup_locks)' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must reach the setup locks only through the one entry point', fn;
    END IF;
    -- THE RETRY PROVES THE EXACT VIEW FROM A DURABLE ROW, in this order:
    -- read the binding; fail closed when it is missing; compare the bound view;
    -- and only then answer historically.
    binding_read_pos := strpos(cleaned, 'FROM public.matching_proposal_decision_view_bindings b');
    missing_pos := strpos(cleaned, '''MATCHING_DECISION_CONTRADICTORY_STATE''');
    compare_pos := strpos(cleaned, 'bound.decided_view_id IS DISTINCT FROM p_expected_view_id');
    historical_pos := strpos(cleaned, '''CLOSED_BY_YOU''::text; RETURN;');
    bind_pos := strpos(cleaned, 'INSERT INTO public.matching_proposal_decision_view_bindings');
    writer_pos := strpos(cleaned, 'append_matching_proposal_transition_v1');
    IF binding_read_pos = 0 OR missing_pos = 0 OR compare_pos = 0 OR historical_pos = 0
       OR bind_pos = 0 OR writer_pos = 0
       OR NOT (entry_pos < binding_read_pos AND binding_read_pos < missing_pos
               AND missing_pos < compare_pos AND compare_pos < historical_pos
               AND historical_pos < view_pos AND view_pos < writer_pos AND writer_pos < bind_pos) THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must read its durable exact-view binding, fail closed when it is absent, compare the bound view, answer historically, and otherwise append and bind in that order', fn;
    END IF;
    -- A RETRY CONSULTS NO CURRENT TRUTH. Everything between entering and the
    -- historical answer reads durable rows only.
    IF substr(cleaned, binding_read_pos, historical_pos - binding_read_pos)
       ~ '(current_view_id|resolve_matching_proposal_prerequisites_v1|resolve_matching_proposal_validity_v1|expires_at|proposal_state)' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: the % retry path may read no current view, clearance, validity, deadline or proposal state', fn;
    END IF;
    IF p.prosrc ~* '(current_timestamp|clock_timestamp|now\(\)|transaction_timestamp|statement_timestamp)' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % decides nothing on a clock and must read none', fn;
    END IF;
  END LOOP;

  -- Withdrawal, and only withdrawal, also compares its exact prior state - and
  -- it is still the one consequential decision the CW2-08 gate does not hold,
  -- because it ends exposure rather than creating it.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.withdraw_matching_proposal_core_v1(uuid,uuid,uuid,text)'::regprocedure;
  IF p.prosrc !~ 'committed\.prior_state IS DISTINCT FROM p_expected_state' THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: a withdrawal retry must still prove the exact prior state its command named';
  END IF;
  IF p.prosrc ~ 'resolve_matching_proposal_prerequisites_v1' THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: withdrawal ends exposure rather than creating it and must not be gated on an unavailable launch gate';
  END IF;
  FOREACH fn IN ARRAY gated LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc !~ 'resolve_matching_proposal_prerequisites_v1' OR p.prosrc !~ '''CLEARED''' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must require exactly CLEARED from the CW2-08 prerequisite seam', fn;
    END IF;
  END LOOP;

  -- EXACTLY THE THREE REVIEWED PRODUCERS WRITE THE NEW BINDING, live.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\.matching_proposal_decision_view_bindings';
  IF offending IS DISTINCT FROM ('decline_matching_proposal_as_first_core_v1, '
                              || 'decline_matching_proposal_as_second_core_v1, '
                              || 'withdraw_matching_proposal_core_v1') THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: exactly the three corrected decisions write a decision view binding; found %', offending;
  END IF;

  -- THE I-07C FIRST-ACCEPTANCE BINDING IS NEITHER REPLACED NOR WEAKENED: still
  -- one relation, still written by exactly the forward approval, and still the
  -- thing the Mutual Match reads.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\.matching_forward_approval_view_bindings';
  IF offending IS DISTINCT FROM 'approve_matching_proposal_forward_core_v1' THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: exactly the forward approval still writes a first-acceptance view binding; found %', offending;
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.approve_matching_proposal_forward_core_v1(uuid,uuid,uuid)'::regprocedure;
  IF p.prosrc !~ 'matching_forward_approval_view_bindings'
     OR p.prosrc ~ 'matching_proposal_decision_view_bindings' THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: the forward approval keeps its own 0114 binding relation and gains nothing from this correction';
  END IF;

  -- EXACTLY ONE FUNCTION STILL WRITES A PROPOSAL TRANSITION.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\.matching_proposal_transitions'
     AND pr.proname <> 'append_matching_proposal_transition_v1';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: exactly one function writes a proposal transition; found %', offending;
  END IF;

  -- THE BINDING RELATION IS STRUCTURAL, SEALED AND APPEND-ONLY.
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relname = 'matching_proposal_decision_view_bindings'
                    AND c.relkind = 'r' AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: the decision view binding relation must exist with row level security enabled';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy pol
              WHERE pol.polrelid = 'public.matching_proposal_decision_view_bindings'::regclass) THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: the decision view binding relation carries no policy: it is reachable through the reviewed producers alone';
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
       AND (has_table_privilege(target_role, 'public.matching_proposal_decision_view_bindings', 'SELECT')
         OR has_table_privilege(target_role, 'public.matching_proposal_decision_view_bindings', 'INSERT')) THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must hold no privilege on the decision view binding relation', target_role;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.matching_proposal_decision_view_bindings'::regclass
                    AND tg.tgname = 'matching_proposal_decision_view_bindings_immutable'
                    AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: a decision view binding is append-only history the moment it is written';
  END IF;
  FOREACH fn IN ARRAY ARRAY[
    'matching_proposal_decision_view_bindings_transition_fk',
    'matching_proposal_decision_view_bindings_view_fk',
    'matching_proposal_decision_view_bindings_role_fk',
    'matching_proposal_decision_view_bindings_state_check',
    'matching_proposal_decision_view_bindings_role_check',
    'matching_proposal_decision_view_bindings_proposal_key',
    'matching_proposal_decision_view_bindings_exact_key'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint con
                    WHERE con.conrelid = 'public.matching_proposal_decision_view_bindings'::regclass
                      AND con.conname = fn) THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: the structural binding constraint % must exist', fn;
    END IF;
  END LOOP;
  -- EVERY FOREIGN KEY IS ON DELETE RESTRICT, as every I-07B key is: a binding
  -- can never be silently removed by something happening to its parents.
  SELECT string_agg(con.conname, ', ' ORDER BY con.conname) INTO offending
    FROM pg_constraint con
   WHERE con.conrelid = 'public.matching_proposal_decision_view_bindings'::regclass
     AND con.contype = 'f' AND con.confdeltype <> 'r';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: every decision binding foreign key is ON DELETE RESTRICT; found %', offending;
  END IF;
  -- The additive candidate key the role binding needs is a key over a primary
  -- key, so it refuses nothing the predecessor already accepted.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint con
                  WHERE con.conrelid = 'public.matching_recipient_proposal_views'::regclass
                    AND con.conname = 'matching_recipient_proposal_views_role_identity_key'
                    AND con.contype = 'u'
                    AND pg_get_constraintdef(con.oid) = 'UNIQUE (id, recipient_role)') THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: the additive recipient-view role identity key must exist over the primary key';
  END IF;

  -- NO RECIPIENT PROJECTION CAN REACH THE NEW EVIDENCE. It is internal
  -- authority, and the two audience boundaries are still STABLE and still
  -- answer exactly what they always answered.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public'
     AND pr.proname IN ('resolve_my_matching_proposal_v1', 'resolve_my_matching_proposal_fields_v1',
                        'resolve_matching_proposal_neutral_outcome_v1')
     AND (pr.prosrc ~ 'matching_proposal_decision_view_bindings' OR pr.provolatile <> 's');
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: a recipient projection may not read the decision view binding and must stay STABLE; found %', offending;
  END IF;

  -- THE I-07A AND I-07B EXECUTION BOUNDARIES ARE EXACTLY AS 0109 AND 0112 LEFT
  -- THEM: a correction widens nothing.
  IF NOT has_function_privilege('authenticated', 'public.get_my_matching_setup_v1()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.get_my_matching_setup_v1()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.prepare_matching_proposal_core_v1(uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.expire_matching_proposal_core_v1(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: the I-07A and I-07B execution boundaries must be exactly as 0109 and 0112 left them';
  END IF;
END$$;

COMMIT;
