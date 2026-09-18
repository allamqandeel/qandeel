-- QAN-CW-REM-02 - Matching proposal temporal correctness and exact-view
-- command identity v1.
--
-- Two accepted phase-wide assurance findings, both of them defect classes I-07C
-- already found and fixed at ONE site while the sibling I-07B sites kept them,
-- and two interim-review findings that proved each of the two corrections was
-- still short of its own rule.
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
--
-- ## REM02-TIME-01 - and "before the first write" means the FIRST WRITE
--
-- The first correction of this task captured that instant in the two delivery
-- cores, immediately before they call the disclosure gate. Interim review
-- proved that is still too early: `materialize_matching_recipient_view_core_v1`
-- re-enters the pair lock, answers its own view idempotency, derives the
-- audience, re-reads the eligibility snapshot, revalidates the subject's
-- CURRENT setup authority, reads the Product field policy, reads the permitted
-- conclusion, resolves the canonical first name, takes the recipient's
-- view-state row FOR UPDATE and scans every approved value through the output
-- filter - and only then inserts. The deadline can cross during all of that.
--
-- So the ONE final decision moved INTO the gate, at its real first-write
-- boundary:
--
--     historical existing-view retry          -> answered, before any deadline
--     canonical pair lock, every current gate
--     view-state row FOR UPDATE
--     every field, policy, name and value check
--     delivery_at := clock_timestamp()
--     expires_at <= delivery_at               -> MATCHING_PROPOSAL_EXPIRED
--     INSERT INTO matching_recipient_proposal_views   -- the first write
--
-- There is exactly ONE wall-clock decision on the delivery path, not two: the
-- two delivery cores now read no clock at all, and the gate reads exactly one.
-- A second, earlier, non-authoritative check would have been a moment nobody
-- acts on and a second thing to keep true.
--
-- That one instant is also what the recipient's current-view pointer records as
-- its `updated_at`, so the gate is single-clocked the way the Mutual Match is.
--
-- ## The clock is NOT replaced everywhere, and that is the finding, not laziness
--
-- Every transaction-fixed clock in the proposal choreography was classified.
-- The delivery decision is the harmful class and is corrected; the other three
-- are left EXACTLY as they are, because in each of them a stale clock can only
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
-- ## ASSURE-F08 - three decision retries proved no exact view
--
-- The four I-07B human decisions each take `p_expected_view_id`, because a
-- consequential human act is authorized by the exact recipient view version
-- that human saw. Migration 0114 made the FIRST_FORWARD_APPROVED retry prove it
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
-- ## REM02-IDEM-01 - and the two DELIVERIES had the same defect
--
-- Interim review ruled that the two facts the first correction reported as
-- observations are the same command-identity defect class. A delivery retry:
--
--   * reconstructed the delivered view from the recipient's CURRENT view
--     pointer - and the frozen I-07B model says in so many words that a view is
--     an immutable version, that currentness is a pointer which may move
--     forward, and that a superseded view remains historical truth. A mutable
--     pointer cannot be the durable identity of a historical command;
--   * never compared `p_permitted_conclusion_id`, which is an immutable input
--     that determines the immutable view being delivered. Same command, same
--     view, different conclusion is a DIFFERENT REQUEST.
--
-- So the deliveries get their own durable binding,
-- `matching_proposal_delivery_view_bindings`, and each retry reads it rather
-- than the pointer. The conclusion is NOT duplicated: the bound view already
-- carries its exact `permitted_conclusion_id` immutably, so the retry compares
-- the caller's against THAT.
--
--   same command + same immutable request                  -> historical result
--   same command + different view or conclusion            -> command conflict
--   committed transition + missing binding                  -> contradictory
--
-- The historical view is NEVER inferred from the current view pointer. A
-- committed delivery or decision whose binding is absent proves nothing and is
-- not repaired here: it fails closed.
--
-- The two bindings are different authority facts and neither replaces the
-- other, exactly as neither replaces the 0114 first-acceptance binding:
--
--     matching_forward_approval_view_bindings   what the first party APPROVED
--     matching_proposal_delivery_view_bindings  what QANDEEL DELIVERED
--     matching_proposal_decision_view_bindings  what a human TERMINALLY DECIDED
--
-- ## Transitions committed before this migration
--
-- No historical exact-view evidence is invented. An OFFERED_TO_FIRST,
-- FORWARDED_TO_SECOND, FIRST_DECLINED, SECOND_DECLINED or WITHDRAWN transition
-- committed before 0120 keeps its row, its view rows, its private terminal
-- reason and its proposal lifecycle exactly as they are; nothing is backfilled
-- and nothing is deleted. What such a command can no longer do is claim an
-- equivalent retry, because it cannot prove the exact view that authorized or
-- carried it - so that retry is contradictory rather than successful. That is
-- the only honest answer available, and it is the same one 0114 chose for a
-- forward approval with no binding.
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
-- `enter_matching_proposal_decision_v1` still enters the serialization region
-- before any currentness is read (I07B-CONC-01). The CW2-08 gate is still
-- required on the four consequential boundaries and still absent from
-- withdrawal. Every neutral recipient outcome, every anti-oracle refusal and the
-- whole pre-launch ACL are exactly as they were: both bindings are internal
-- authority evidence and no projection can reach either.
--
-- Migrations 0001-0119 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ONE ADDITIVE CANDIDATE KEY ON A PREDECESSOR RELATION.
--
--    A candidate key over an existing primary key. It refuses nothing the
--    predecessor accepted, changes no row and adds no column; it exists so both
--    bindings below can bind a view's ROLE as an exact row rather than as a
--    remembered check. Migration 0113 added six of exactly this shape for
--    exactly this reason.
-- ---------------------------------------------------------------------------
ALTER TABLE public.matching_recipient_proposal_views
    ADD CONSTRAINT matching_recipient_proposal_views_role_identity_key
    UNIQUE (id, recipient_role);

-- ---------------------------------------------------------------------------
-- 2. THE DURABLE EXACT-VIEW BINDING OF A PROPOSAL DELIVERY.
--
--    One row per committed OFFERED_TO_FIRST or FORWARDED_TO_SECOND transition,
--    naming the exact immutable recipient view that delivery created. It is the
--    durable identity a delivery retry compares against, in place of the
--    recipient's CURRENT view pointer, which is a forward-moving pointer rather
--    than a historical fact (interim review finding REM02-IDEM-01).
--
--    The conclusion the caller named is NOT copied here. The bound view already
--    carries its exact `permitted_conclusion_id` immutably, and duplicating it
--    would be a second copy of the same Product truth for somebody to edit.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_proposal_delivery_view_bindings (
    -- The delivery transition id, which IS the delivery command id.
    delivery_transition_id uuid PRIMARY KEY,
    proposal_id uuid NOT NULL,
    delivery_state text NOT NULL,
    recipient_role text NOT NULL,
    recipient_user_id uuid NOT NULL,
    delivered_view_id uuid NOT NULL,
    bound_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- One proposal is offered once and forwarded once: the two states are single
    -- edges out of states the chain can never re-enter.
    CONSTRAINT matching_proposal_delivery_view_bindings_state_key UNIQUE (proposal_id, delivery_state),
    -- One view is delivered by at most one command, so two delivery commands can
    -- never claim the same disclosure.
    CONSTRAINT matching_proposal_delivery_view_bindings_view_key UNIQUE (delivered_view_id),
    -- The composite identity a retry compares.
    CONSTRAINT matching_proposal_delivery_view_bindings_exact_key
        UNIQUE (delivery_transition_id, proposal_id, delivered_view_id),
    CONSTRAINT matching_proposal_delivery_view_bindings_state_check
        CHECK (delivery_state IN ('OFFERED_TO_FIRST', 'FORWARDED_TO_SECOND')),
    -- WHICH RECIPIENT A DELIVERY REACHES IS FIXED BY THE DELIVERY, exactly as
    -- 0110 fixes which actor slot a resulting state may fill.
    CONSTRAINT matching_proposal_delivery_view_bindings_role_check
        CHECK (recipient_role = CASE delivery_state
                                  WHEN 'OFFERED_TO_FIRST' THEN 'FIRST_RECIPIENT'
                                  ELSE 'CANDIDATE' END),
    -- The bound transition is THIS proposal's transition into exactly THAT
    -- delivery - never another proposal's, and never another state.
    CONSTRAINT matching_proposal_delivery_view_bindings_transition_fk
        FOREIGN KEY (delivery_transition_id, proposal_id, delivery_state)
        REFERENCES public.matching_proposal_transitions (id, proposal_id, resulting_state) ON DELETE RESTRICT,
    -- The delivered view is a view OF THIS PROPOSAL FOR THAT HUMAN.
    CONSTRAINT matching_proposal_delivery_view_bindings_view_fk
        FOREIGN KEY (delivered_view_id, proposal_id, recipient_user_id)
        REFERENCES public.matching_recipient_proposal_views (id, proposal_id, recipient_user_id) ON DELETE RESTRICT,
    -- ... and it is a view of exactly THAT ROLE, which the 0110 audience CHECK
    -- then pins to exactly one of the proposal's two members.
    CONSTRAINT matching_proposal_delivery_view_bindings_role_fk
        FOREIGN KEY (delivered_view_id, recipient_role)
        REFERENCES public.matching_recipient_proposal_views (id, recipient_role) ON DELETE RESTRICT
);

CREATE INDEX matching_proposal_delivery_view_bindings_recipient_idx
    ON public.matching_proposal_delivery_view_bindings (recipient_user_id, bound_at);

COMMENT ON TABLE public.matching_proposal_delivery_view_bindings IS
  'The durable, immutable binding of one proposal DELIVERY - the first offer or '
  'the independent second-recipient proposal - to the exact proposal, the exact '
  'recipient in their exact role, and the exact immutable recipient view version '
  'that delivery created. An equivalent retry is answered from this row and from '
  'the conclusion that bound view immutably carries, never from the recipient''s '
  'CURRENT view pointer, which is a forward-moving pointer rather than a '
  'historical fact. It is internal authority evidence and no recipient '
  'projection reaches it.';

-- Append-only, through the trigger function 0110 already installed for exactly
-- this: what was delivered is history the moment it is written.
CREATE TRIGGER matching_proposal_delivery_view_bindings_immutable
    BEFORE UPDATE OR DELETE ON public.matching_proposal_delivery_view_bindings
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();

-- ---------------------------------------------------------------------------
-- 3. THE DURABLE EXACT-VIEW BINDING OF A TERMINAL HUMAN PROPOSAL DECISION.
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
  'first-acceptance evidence a Mutual Match consumes, and it is a different '
  'authority fact from the delivery binding above.';

CREATE TRIGGER matching_proposal_decision_view_bindings_immutable
    BEFORE UPDATE OR DELETE ON public.matching_proposal_decision_view_bindings
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();

-- ---------------------------------------------------------------------------
-- 4. DENY-BY-DEFAULT ACCESS POSTURE, exactly as 0110 and 0113 left theirs.
-- ---------------------------------------------------------------------------
ALTER TABLE public.matching_proposal_delivery_view_bindings OWNER TO postgres;
ALTER TABLE public.matching_proposal_delivery_view_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.matching_proposal_delivery_view_bindings FROM PUBLIC, anon, authenticated;
ALTER TABLE public.matching_proposal_decision_view_bindings OWNER TO postgres;
ALTER TABLE public.matching_proposal_decision_view_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.matching_proposal_decision_view_bindings FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.matching_proposal_delivery_view_bindings FROM service_role';
    EXECUTE 'REVOKE ALL ON TABLE public.matching_proposal_decision_view_bindings FROM service_role';
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 5. THE DISCLOSURE GATE, with the final delivery instant at its FIRST WRITE.
--
--    Byte-for-byte the 0111 boundary in its signature, its result shape, its
--    idempotency, its audience derivation, its revalidation, its two-authority
--    intersection, its value filter and its ACL. The ONE change is the last
--    thing it does before it writes: it reads the real instant this disclosure
--    would happen at, and refuses if the proposal's deadline has already passed.
--
--    This is the boundary interim review required (REM02-TIME-01). Everything
--    above the capture can wait - the canonical pair lock, the view-state row
--    lock, the subject's current setup resolution, the first-name seam - and the
--    deadline can cross during any of it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.materialize_matching_recipient_view_core_v1(
  p_view_id uuid, p_proposal_id uuid, p_recipient_user_id uuid, p_permitted_conclusion_id uuid
) RETURNS TABLE(recipient_view_id uuid, proposal_id uuid, recipient_role text,
                superseded_view_id uuid, disclosed_field_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  proposal public.matching_proposals;
  snapshot public.matching_eligibility_snapshots;
  conclusion public.matching_permitted_safe_conclusions;
  committed public.matching_recipient_proposal_views;
  role_of text;
  subject uuid;
  subject_state record;
  bound_profile uuid;
  bound_authority uuid;
  field_policy uuid;
  name_answer record;
  current_view uuid;
  offending_key text;
  disclosed integer;
  delivery_at timestamptz;
BEGIN
  IF p_view_id IS NULL OR p_proposal_id IS NULL OR p_recipient_user_id IS NULL
     OR p_permitted_conclusion_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  PERFORM public.lock_matching_pair_humans_v1(proposal.lower_user_id, proposal.higher_user_id);

  -- AN ALREADY MATERIALIZED VIEW IS HISTORY, AND HISTORY IS NOT RE-DECIDED. This
  -- answer is returned before the deadline decision below, so a view that was
  -- really created while the proposal was live keeps answering its own retry
  -- once the deadline has passed.
  SELECT * INTO committed FROM public.matching_recipient_proposal_views v WHERE v.id = p_view_id;
  IF FOUND THEN
    IF committed.proposal_id = p_proposal_id AND committed.recipient_user_id = p_recipient_user_id
       AND committed.permitted_conclusion_id = p_permitted_conclusion_id THEN
      SELECT count(*)::int INTO disclosed FROM public.matching_recipient_proposal_view_fields f
       WHERE f.view_id = p_view_id;
      RETURN QUERY SELECT committed.id, committed.proposal_id, committed.recipient_role,
                          committed.prior_view_id, disclosed;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- The audience is derived from the proposal's own immutable direction. A
  -- caller cannot name an arbitrary recipient: only the two humans of this exact
  -- proposal have a role at all.
  role_of := CASE p_recipient_user_id
               WHEN proposal.first_recipient_user_id THEN 'FIRST_RECIPIENT'
               WHEN proposal.candidate_user_id THEN 'CANDIDATE'
             END;
  IF role_of IS NULL THEN
    RAISE EXCEPTION 'MATCHING_RECIPIENT_NOT_IN_PROPOSAL' USING ERRCODE='22023';
  END IF;
  subject := CASE role_of WHEN 'FIRST_RECIPIENT' THEN proposal.candidate_user_id
                          ELSE proposal.first_recipient_user_id END;

  SELECT * INTO snapshot FROM public.matching_eligibility_snapshots s
   WHERE s.id = proposal.eligibility_snapshot_id;
  bound_profile := CASE subject WHEN snapshot.lower_user_id THEN snapshot.lower_profile_version_id
                                ELSE snapshot.higher_profile_version_id END;
  bound_authority := CASE subject WHEN snapshot.lower_user_id THEN snapshot.lower_disclosure_authority_id
                                  ELSE snapshot.higher_disclosure_authority_id END;

  -- REVALIDATION, not trust. The snapshot says what was true when it was taken;
  -- disclosure requires those identities to still be the subject's CURRENT ones.
  SELECT * INTO subject_state FROM public.resolve_matching_setup_state_v1(subject);
  IF NOT subject_state.matchable
     OR subject_state.introduction_profile_version_id IS DISTINCT FROM bound_profile
     OR subject_state.pre_match_disclosure_authority_id IS DISTINCT FROM bound_authority THEN
    RAISE EXCEPTION 'MATCHING_DISCLOSURE_AUTHORITY_STALE' USING ERRCODE='40001',
      DETAIL='A recipient view may only be built from the subject''s CURRENT Introduction Profile version and CURRENT Pre-Match Disclosure Authority. An authority over an earlier version never silently covers a later one.';
  END IF;

  SELECT st.current_policy_version_id INTO field_policy
    FROM public.matching_proposal_policy_state st WHERE st.policy_kind = 'PROPOSAL_SAFE_FIELDS';
  IF field_policy IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_POLICY_UNCONFIGURED' USING ERRCODE='55000',
      DETAIL='The Product pre-Match field policy is required. Human authority is necessary and not sufficient, so an unconfigured Product policy discloses nothing.';
  END IF;

  -- The conclusion was filtered FOR THIS RECIPIENT and is ABOUT THIS SUBJECT.
  SELECT * INTO conclusion FROM public.matching_permitted_safe_conclusions c
   WHERE c.id = p_permitted_conclusion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_SAFE_CONCLUSION_NOT_PERMITTED' USING ERRCODE='55000',
      DETAIL='A recipient view binds a conclusion the Sensitive Conclusion Filter permitted. A refused, unclassified or unfiltered conclusion has no row here.';
  END IF;
  IF conclusion.for_recipient_user_id <> p_recipient_user_id OR conclusion.about_user_id <> subject THEN
    RAISE EXCEPTION 'MATCHING_SAFE_CONCLUSION_AUDIENCE_MISMATCH' USING ERRCODE='22023',
      DETAIL='The first-recipient view and the candidate view are independent disclosures. A conclusion written for one is never re-aimed at the other.';
  END IF;

  -- The first name comes from the ONE canonical seam and from nowhere else.
  SELECT * INTO name_answer FROM public.resolve_matching_canonical_first_name_v1(subject);
  IF name_answer.resolution <> 'RESOLVED' OR name_answer.first_name IS NULL THEN
    RAISE EXCEPTION 'MATCHING_CANONICAL_FIRST_NAME_UNRESOLVED' USING ERRCODE='55000',
      DETAIL='A proposal presents a first name from an allowed canonical source. There is none in this repository, so the disclosure gate fails closed rather than inferring one.';
  END IF;

  SELECT st.current_view_id INTO current_view
    FROM public.matching_recipient_proposal_view_state st
   WHERE st.proposal_id = p_proposal_id AND st.recipient_user_id = p_recipient_user_id FOR UPDATE;

  -- THE DISCLOSABLE SET IS AN INTERSECTION: approved by the human AND permitted
  -- by Product. Then every VALUE is put through the proposal-output filter, so a
  -- benign key cannot smuggle a contact route or a source identifier past a
  -- ceiling that only ever inspected keys.
  SELECT fv.field_key INTO offending_key
    FROM public.pre_match_disclosure_authority_fields af
    JOIN public.matching_proposal_safe_field_keys pk
      ON pk.policy_version_id = field_policy AND pk.field_key = af.field_key
    JOIN public.introduction_profile_field_values fv
      ON fv.profile_version_id = bound_profile AND fv.field_key = af.field_key
   WHERE af.authority_id = bound_authority
     AND (public.matching_text_carries_contact_route_v1(fv.field_value)
       OR public.matching_text_carries_hidden_provenance_v1(fv.field_value))
   ORDER BY fv.field_key LIMIT 1;
  IF offending_key IS NOT NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_FIELD_VALUE_REFUSED' USING ERRCODE='55000',
      DETAIL=format('The approved field %L carries a direct contact route or a source identifier in its VALUE. I-07A bans a contact-route field KEY; a benign key may not smuggle one through free text.', offending_key);
  END IF;

  SELECT count(*)::int INTO disclosed
    FROM public.pre_match_disclosure_authority_fields af
    JOIN public.matching_proposal_safe_field_keys pk
      ON pk.policy_version_id = field_policy AND pk.field_key = af.field_key
    JOIN public.introduction_profile_field_values fv
      ON fv.profile_version_id = bound_profile AND fv.field_key = af.field_key
   WHERE af.authority_id = bound_authority;
  IF disclosed = 0 THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_DISCLOSURE_EMPTY' USING ERRCODE='55000',
      DETAIL='Nothing the human approved is also permitted by Product for pre-Match disclosure, so there is no proposal to make.';
  END IF;

  -- THE REAL INSTANT THIS DISCLOSURE HAPPENS AT, read from the database clock
  -- exactly once, after the canonical pair lock, after the view-state row lock,
  -- after every currentness, authority, policy, name and value check, and with
  -- nothing written yet. A transaction-fixed clock is settled BEFORE any of
  -- those waits, so it can decide no deadline of a command that waited
  -- (assurance finding ASSURE-F01); and a wall clock read before this whole
  -- region is a moment the deadline can still cross during it (interim review
  -- finding REM02-TIME-01). The instant the recipient would REALLY be shown this
  -- material is the only lawful basis for the decision, and the line below is
  -- the last statement before the first irreversible write.
  delivery_at := clock_timestamp();
  IF proposal.expires_at <= delivery_at THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_EXPIRED' USING ERRCODE='55000';
  END IF;

  INSERT INTO public.matching_recipient_proposal_views (
    id, proposal_id, recipient_role, recipient_user_id, subject_user_id,
    first_recipient_user_id, candidate_user_id, prior_view_id, eligibility_snapshot_id,
    subject_profile_version_id, subject_disclosure_authority_id,
    safe_field_policy_version_id, permitted_conclusion_id, subject_first_name)
  VALUES (
    p_view_id, p_proposal_id, role_of, p_recipient_user_id, subject,
    proposal.first_recipient_user_id, proposal.candidate_user_id, current_view,
    proposal.eligibility_snapshot_id, bound_profile, bound_authority,
    field_policy, p_permitted_conclusion_id, name_answer.first_name);

  INSERT INTO public.matching_recipient_proposal_view_fields
    (view_id, subject_disclosure_authority_id, safe_field_policy_version_id, field_key, disclosed_value)
  SELECT p_view_id, bound_authority, field_policy, af.field_key, fv.field_value
    FROM public.pre_match_disclosure_authority_fields af
    JOIN public.matching_proposal_safe_field_keys pk
      ON pk.policy_version_id = field_policy AND pk.field_key = af.field_key
    JOIN public.introduction_profile_field_values fv
      ON fv.profile_version_id = bound_profile AND fv.field_key = af.field_key
   WHERE af.authority_id = bound_authority;

  IF current_view IS NULL THEN
    INSERT INTO public.matching_recipient_proposal_view_state
      (proposal_id, recipient_user_id, current_view_id)
    VALUES (p_proposal_id, p_recipient_user_id, p_view_id);
  ELSE
    -- The superseded view is NOT erased: it stays as the historical record of
    -- what this human was actually shown. The pointer moves at the same instant
    -- the disclosure happened, so this gate reads ONE clock and no other.
    UPDATE public.matching_recipient_proposal_view_state st
       SET current_view_id = p_view_id, updated_at = delivery_at
     WHERE st.proposal_id = p_proposal_id AND st.recipient_user_id = p_recipient_user_id
       AND st.current_view_id = current_view;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;
  END IF;

  RETURN QUERY SELECT p_view_id, p_proposal_id, role_of, current_view, disclosed;
END$$;

COMMENT ON FUNCTION public.materialize_matching_recipient_view_core_v1(uuid, uuid, uuid, uuid) IS
  'The ONE disclosure gate: it materializes one immutable recipient proposal '
  'view from the INTERSECTION of what the subject human approved and what '
  'Product permits, over the subject''s CURRENT profile version and CURRENT '
  'disclosure authority, with every value filtered and the first name taken from '
  'the one canonical seam. Since QAN-CW-REM-02 it also decides the proposal '
  'deadline, against the REAL instant read after every lock and every check and '
  'immediately before its first irreversible write - so a delivery that waited, '
  'anywhere, and resumed past the deadline discloses nothing. An already '
  'materialized view answers its own retry before that decision, because history '
  'is not re-decided.';

-- ---------------------------------------------------------------------------
-- 6. THE TWO DELIVERY PATHS: durable delivery identity, and no clock of their own.
--
--    Byte-for-byte the 0112 boundaries in their signature, their result shape,
--    their gates and their ordering. Two changes in each: the retry is answered
--    from a DURABLE binding rather than from the recipient's current view
--    pointer and compares the whole immutable request, and the binding is
--    written in the same transaction as the transition. The deadline decision
--    lives in the gate above, which is the only place it can be final.
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
  bound public.matching_proposal_delivery_view_bindings;
  delivered public.matching_recipient_proposal_views;
  already integer;
BEGIN
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  PERFORM public.lock_matching_pair_humans_v1(proposal.lower_user_id, proposal.higher_user_id);

  -- IDEMPOTENCY FIRST, before any gate. An equivalent retry answers from the
  -- COMMITTED rows even if clearance, authority or the DEADLINE has moved since -
  -- a retry must not be able to produce a different answer than the call it
  -- repeats, and a delivery that committed while the proposal was live is not
  -- re-decided against today's deadline.
  IF EXISTS (SELECT 1 FROM public.matching_proposal_transitions t
              WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
                AND t.prior_state = 'PREPARED' AND t.resulting_state = 'OFFERED_TO_FIRST') THEN
    -- THE WHOLE IMMUTABLE REQUEST, proven from the DURABLE binding. The
    -- recipient's current view pointer is a forward-moving pointer rather than a
    -- historical fact, so it can never be the identity of a historical command
    -- (interim review finding REM02-IDEM-01). The conclusion is compared against
    -- the one the bound view immutably carries rather than against a second copy
    -- of it. A committed delivery whose binding is MISSING cannot prove what it
    -- delivered: it is contradictory rather than repairable, and nothing is
    -- inferred or backfilled from current state.
    SELECT * INTO bound FROM public.matching_proposal_delivery_view_bindings b
     WHERE b.delivery_transition_id = p_command_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MATCHING_DELIVERY_CONTRADICTORY_STATE' USING ERRCODE='P0001',
        DETAIL='A committed proposal delivery carries its durable exact-view binding; one without it cannot prove which view it delivered and is not repaired here.';
    END IF;
    SELECT * INTO delivered FROM public.matching_recipient_proposal_views v
     WHERE v.id = bound.delivered_view_id;
    IF bound.delivered_view_id IS DISTINCT FROM p_view_id
       OR delivered.permitted_conclusion_id IS DISTINCT FROM p_permitted_conclusion_id THEN
      RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    SELECT count(*)::int INTO already FROM public.matching_recipient_proposal_view_fields f
     WHERE f.view_id = bound.delivered_view_id;
    RETURN QUERY SELECT p_command_id, 'OFFERED_TO_FIRST'::text, bound.delivered_view_id, already;
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

  -- THE IRREVERSIBLE DELIVERY. The gate decides the deadline against the real
  -- instant of its own first write and refuses a proposal that has already
  -- expired, so this command reads no clock at all and there is exactly ONE
  -- temporal decision on the path.
  SELECT * INTO view_result FROM public.materialize_matching_recipient_view_core_v1(
    p_view_id, p_proposal_id, proposal.first_recipient_user_id, p_permitted_conclusion_id);

  PERFORM public.append_matching_proposal_transition_v1(
    p_command_id, p_proposal_id, 'PREPARED', 'OFFERED_TO_FIRST', NULL, NULL, NULL);
  INSERT INTO public.matching_proposal_delivery_view_bindings
    (delivery_transition_id, proposal_id, delivery_state, recipient_role, recipient_user_id, delivered_view_id)
  VALUES (p_command_id, p_proposal_id, 'OFFERED_TO_FIRST', 'FIRST_RECIPIENT',
          proposal.first_recipient_user_id, p_view_id);

  -- THE CANDIDATE IS NOT NOTIFIED. Nothing here creates a candidate-side view, a
  -- candidate-side pointer or any row a candidate can read, so their questions
  -- answer exactly as they would for a proposal that was never prepared.
  RETURN QUERY SELECT p_command_id, 'OFFERED_TO_FIRST'::text, p_view_id, view_result.disclosed_field_count;
END$$;

COMMENT ON FUNCTION public.offer_matching_proposal_to_first_core_v1(uuid, uuid, uuid, uuid) IS
  'Delivers the proposal to the FIRST recipient: answer an equivalent retry from '
  'the durable delivery binding, revalidate, require CW2-08 clearance as the last '
  'gate, materialize that recipient''s own view through the disclosure gate - '
  'which decides the deadline against the real instant of its own first write - '
  'append the transition and bind it to the exact view delivered. A delivery that '
  'waited past the deadline discloses nothing; one that already committed while '
  'the proposal was live still answers its equivalent retry, and a retry naming '
  'another view or another conclusion is a different request under a reused id. '
  'The candidate is not notified and gains no readable row, so no "a proposal '
  'existed" oracle is created for them.';

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
  bound public.matching_proposal_delivery_view_bindings;
  delivered public.matching_recipient_proposal_views;
  already integer;
BEGIN
  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  PERFORM public.lock_matching_pair_humans_v1(proposal.lower_user_id, proposal.higher_user_id);

  IF EXISTS (SELECT 1 FROM public.matching_proposal_transitions t
              WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
                AND t.prior_state = 'FIRST_FORWARD_APPROVED'
                AND t.resulting_state = 'FORWARDED_TO_SECOND') THEN
    -- The same durable comparison the first delivery makes, over the CANDIDATE's
    -- own delivered view. Nothing here reads the current view pointer.
    SELECT * INTO bound FROM public.matching_proposal_delivery_view_bindings b
     WHERE b.delivery_transition_id = p_command_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MATCHING_DELIVERY_CONTRADICTORY_STATE' USING ERRCODE='P0001',
        DETAIL='A committed proposal delivery carries its durable exact-view binding; one without it cannot prove which view it delivered and is not repaired here.';
    END IF;
    SELECT * INTO delivered FROM public.matching_recipient_proposal_views v
     WHERE v.id = bound.delivered_view_id;
    IF bound.delivered_view_id IS DISTINCT FROM p_view_id
       OR delivered.permitted_conclusion_id IS DISTINCT FROM p_permitted_conclusion_id THEN
      RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    SELECT count(*)::int INTO already FROM public.matching_recipient_proposal_view_fields f
     WHERE f.view_id = bound.delivered_view_id;
    RETURN QUERY SELECT p_command_id, 'FORWARDED_TO_SECOND'::text, bound.delivered_view_id, already;
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

  -- AN INDEPENDENT DISCLOSURE, not a copy with the names swapped. The gate is
  -- asked for the CANDIDATE's own view: a different subject, a different
  -- disclosure authority, a different profile version and a conclusion written
  -- for them. There is no path here that reads the first recipient's view at
  -- all, and the gate decides this delivery's deadline at its own first write.
  SELECT * INTO view_result FROM public.materialize_matching_recipient_view_core_v1(
    p_view_id, p_proposal_id, proposal.candidate_user_id, p_permitted_conclusion_id);

  PERFORM public.append_matching_proposal_transition_v1(
    p_command_id, p_proposal_id, 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND', NULL, NULL, NULL);
  INSERT INTO public.matching_proposal_delivery_view_bindings
    (delivery_transition_id, proposal_id, delivery_state, recipient_role, recipient_user_id, delivered_view_id)
  VALUES (p_command_id, p_proposal_id, 'FORWARDED_TO_SECOND', 'CANDIDATE',
          proposal.candidate_user_id, p_view_id);

  RETURN QUERY SELECT p_command_id, 'FORWARDED_TO_SECOND'::text, p_view_id, view_result.disclosed_field_count;
END$$;

COMMENT ON FUNCTION public.forward_matching_proposal_to_second_core_v1(uuid, uuid, uuid, uuid) IS
  'Delivers the INDEPENDENT second-recipient proposal after the first recipient '
  'approved forwarding, answering an equivalent retry from the durable delivery '
  'binding and binding the transition to the exact candidate view delivered. It '
  'materializes the candidate''s own view over their own subject, authority, '
  'profile version and recipient-specific conclusion; it never reads the first '
  'recipient''s view, so there is no copy path and no name swap. A material '
  'change between approval and forwarding revalidates rather than delivering, and '
  'a forward that waited past the deadline delivers nothing at all.';

-- ---------------------------------------------------------------------------
-- 7. THE THREE TERMINAL HUMAN DECISIONS, each durably bound to its exact view.
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
-- 8. OWNERSHIP AND THE PRE-LAUNCH ACL: still executable by nobody.
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
    'public.materialize_matching_recipient_view_core_v1(uuid,uuid,uuid,uuid)',
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
-- 9. TERMINAL SELF-ASSERTIONS.
--
--     The migration refuses to deploy a correction that is application-
--     executable, caller-identified, unpinned, wrongly ordered, that lets a
--     transaction clock decide a delivery deadline, that decides it anywhere but
--     at the disclosure gate's own first write, that writes a transition itself,
--     that leaves a delivery or a decision producer without its binding, that
--     answers a retry from the mutable current view pointer, that weakens the
--     I-07C first-acceptance binding, or that globally bans a clock this task
--     classified as safe.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  gate_fn text := 'public.materialize_matching_recipient_view_core_v1(uuid,uuid,uuid,uuid)';
  deliveries text[] := ARRAY[
    'public.offer_matching_proposal_to_first_core_v1(uuid,uuid,uuid,uuid)',
    'public.forward_matching_proposal_to_second_core_v1(uuid,uuid,uuid,uuid)'];
  decisions text[] := ARRAY[
    'public.decline_matching_proposal_as_first_core_v1(uuid,uuid,uuid)',
    'public.decline_matching_proposal_as_second_core_v1(uuid,uuid,uuid)',
    'public.withdraw_matching_proposal_core_v1(uuid,uuid,uuid,text)'];
  replaced text[] := ARRAY[
    'public.materialize_matching_recipient_view_core_v1(uuid,uuid,uuid,uuid)',
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
  -- The 0111 / 0112 input parameter list of each replaced boundary, in order, as
  -- one joined string per boundary: a one-dimensional array so the comparison is
  -- a plain equality rather than a slice of a ragged nested one.
  expected_inputs text[] := ARRAY[
    'p_view_id, p_proposal_id, p_recipient_user_id, p_permitted_conclusion_id',
    'p_command_id, p_proposal_id, p_view_id, p_permitted_conclusion_id',
    'p_command_id, p_proposal_id, p_view_id, p_permitted_conclusion_id',
    'p_command_id, p_proposal_id, p_expected_view_id',
    'p_command_id, p_proposal_id, p_expected_view_id',
    'p_command_id, p_proposal_id, p_expected_view_id, p_expected_state'];
  bindings text[] := ARRAY[
    'matching_proposal_delivery_view_bindings',
    'matching_proposal_decision_view_bindings'];
  fn text;
  relation text;
  p record;
  cleaned text;
  offending text;
  target_role text;
  lock_pos integer;
  retry_pos integer;
  binding_read_pos integer;
  missing_pos integer;
  compare_pos integer;
  historical_pos integer;
  validity_pos integer;
  gate_pos integer;
  clock_pos integer;
  deadline_pos integer;
  view_pos integer;
  writer_pos integer;
  entry_pos integer;
  bind_pos integer;
  lock_row_pos integer;
  disclosed_pos integer;
  insert_pos integer;
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
      RAISE EXCEPTION 'QAN-CW-REM-02: % must keep its exact frozen input parameters, found %', replaced[i], offending;
    END IF;
  END LOOP;

  -- ------------- ASSURE-F01 / REM02-TIME-01: the final delivery instant
  --
  -- The ONE wall-clock decision on the delivery path lives at the disclosure
  -- gate's own first write, and nowhere else.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = gate_fn::regprocedure;
  IF p.prosrc ~* '(current_timestamp|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp)' THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: the disclosure gate may read no transaction-fixed clock: every one of them is settled before its locks and its checks';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'clock_timestamp()', ''))) / length('clock_timestamp()') <> 1 THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: the disclosure gate must capture the real delivery instant exactly once';
  END IF;
  IF p.prosrc !~ 'MATCHING_PROPOSAL_EXPIRED' THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: the disclosure gate must carry the exact existing expiry refusal';
  END IF;
  -- THE PLACEMENT IS THE PROPERTY. Comment lines are removed before the
  -- positions are compared, because prosrc includes comments and the prose
  -- above names these steps in explanatory order.
  SELECT string_agg(l.line, E'\n' ORDER BY l.n) INTO cleaned
    FROM regexp_split_to_table(p.prosrc, E'\n') WITH ORDINALITY AS l(line, n)
   WHERE btrim(l.line) NOT LIKE '--%';
  lock_pos := strpos(cleaned, 'lock_matching_pair_humans_v1');
  retry_pos := strpos(cleaned, 'INTO committed FROM public.matching_recipient_proposal_views v WHERE v.id = p_view_id');
  historical_pos := strpos(cleaned, 'RETURN QUERY SELECT committed.id, committed.proposal_id, committed.recipient_role,');
  lock_row_pos := strpos(cleaned, 'AND st.recipient_user_id = p_recipient_user_id FOR UPDATE');
  disclosed_pos := strpos(cleaned, 'IF disclosed = 0 THEN');
  clock_pos := strpos(cleaned, 'delivery_at := clock_timestamp()');
  deadline_pos := strpos(cleaned, 'proposal.expires_at <= delivery_at');
  insert_pos := strpos(cleaned, 'INSERT INTO public.matching_recipient_proposal_views (');
  IF lock_pos = 0 OR retry_pos = 0 OR historical_pos = 0 OR lock_row_pos = 0 OR disclosed_pos = 0
     OR clock_pos = 0 OR deadline_pos = 0 OR insert_pos = 0
     OR NOT (lock_pos < retry_pos AND retry_pos < historical_pos AND historical_pos < lock_row_pos
             AND lock_row_pos < disclosed_pos AND disclosed_pos < clock_pos
             AND clock_pos < deadline_pos AND deadline_pos < insert_pos) THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: the disclosure gate must answer an already materialized view BEFORE any deadline decision, then lock the pointer row, run every check, capture the real instant, decide the deadline against it, and only then write';
  END IF;
  -- NOTHING SEPARABLE STANDS BETWEEN THE DECISION AND THE WRITE.
  IF insert_pos - deadline_pos > 220 THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: the deadline decision must be the LAST statement before the first irreversible write, not merely somewhere before it';
  END IF;

  -- THE DELIVERY COMMANDS THEMSELVES READ NO CLOCK AT ALL. There is one
  -- temporal decision on the path, and it is the gate's.
  FOREACH fn IN ARRAY deliveries LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc ~* '(current_timestamp|clock_timestamp|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp)' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % reads no clock: the one final delivery instant is the disclosure gate''s', fn;
    END IF;
    IF p.prosrc !~ 'materialize_matching_recipient_view_core_v1' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must disclose through the ONE gate that decides the deadline', fn;
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

  -- ------------ REM02-IDEM-01: the delivery command identity is durable
  FOREACH fn IN ARRAY deliveries LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    SELECT string_agg(l.line, E'\n' ORDER BY l.n) INTO cleaned
      FROM regexp_split_to_table(p.prosrc, E'\n') WITH ORDINALITY AS l(line, n)
     WHERE btrim(l.line) NOT LIKE '--%';
    lock_pos := strpos(cleaned, 'lock_matching_pair_humans_v1');
    retry_pos := strpos(cleaned, 'FROM public.matching_proposal_transitions t');
    binding_read_pos := strpos(cleaned, 'FROM public.matching_proposal_delivery_view_bindings b');
    missing_pos := strpos(cleaned, '''MATCHING_DELIVERY_CONTRADICTORY_STATE''');
    compare_pos := strpos(cleaned, 'delivered.permitted_conclusion_id IS DISTINCT FROM p_permitted_conclusion_id');
    historical_pos := strpos(cleaned, 'bound.delivered_view_id, already;');
    validity_pos := strpos(cleaned, 'resolve_matching_proposal_validity_v1');
    gate_pos := strpos(cleaned, 'gate.clearance <> ''CLEARED''');
    view_pos := strpos(cleaned, 'materialize_matching_recipient_view_core_v1');
    writer_pos := strpos(cleaned, 'append_matching_proposal_transition_v1');
    bind_pos := strpos(cleaned, 'INSERT INTO public.matching_proposal_delivery_view_bindings');
    IF lock_pos = 0 OR retry_pos = 0 OR binding_read_pos = 0 OR missing_pos = 0 OR compare_pos = 0
       OR historical_pos = 0 OR validity_pos = 0 OR gate_pos = 0 OR view_pos = 0 OR writer_pos = 0
       OR bind_pos = 0
       OR NOT (lock_pos < retry_pos AND retry_pos < binding_read_pos
               AND binding_read_pos < missing_pos AND missing_pos < compare_pos
               AND compare_pos < historical_pos AND historical_pos < validity_pos
               AND validity_pos < gate_pos AND gate_pos < view_pos AND view_pos < writer_pos
               AND writer_pos < bind_pos) THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must lock, read its durable delivery binding, fail closed when it is absent, compare the whole immutable request, answer historically, and otherwise revalidate, gate, disclose, append and bind in that order', fn;
    END IF;
    -- THE RETRY NEVER READS THE MUTABLE CURRENT VIEW POINTER, which is exactly
    -- the inference interim review refused.
    IF substr(cleaned, retry_pos, historical_pos - retry_pos)
       ~ '(current_view_id|matching_recipient_proposal_view_state|resolve_matching_proposal_prerequisites_v1|resolve_matching_proposal_validity_v1|expires_at|proposal_state)' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: the % retry path may read no current view pointer, clearance, validity, deadline or proposal state', fn;
    END IF;
    IF p.prosrc ~ 'matching_recipient_proposal_view_state' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % may not reach the current view pointer at all; the durable binding is the historical identity', fn;
    END IF;
    IF p.prosrc !~ 'resolve_matching_proposal_prerequisites_v1' OR p.prosrc !~ '''CLEARED''' THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must still require exactly CLEARED from the CW2-08 prerequisite seam', fn;
    END IF;
  END LOOP;

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

  -- EXACTLY THE REVIEWED PRODUCERS WRITE EACH BINDING, live.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\.matching_proposal_delivery_view_bindings';
  IF offending IS DISTINCT FROM ('forward_matching_proposal_to_second_core_v1, '
                              || 'offer_matching_proposal_to_first_core_v1') THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: exactly the two corrected deliveries write a delivery view binding; found %', offending;
  END IF;
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
  -- thing the Mutual Match reads. The three bindings are three different
  -- authority facts and none of them absorbs another.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\.matching_forward_approval_view_bindings';
  IF offending IS DISTINCT FROM 'approve_matching_proposal_forward_core_v1' THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: exactly the forward approval still writes a first-acceptance view binding; found %', offending;
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.approve_matching_proposal_forward_core_v1(uuid,uuid,uuid)'::regprocedure;
  IF p.prosrc !~ 'matching_forward_approval_view_bindings'
     OR p.prosrc ~ '(matching_proposal_decision_view_bindings|matching_proposal_delivery_view_bindings)' THEN
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

  -- BOTH BINDING RELATIONS ARE STRUCTURAL, SEALED AND APPEND-ONLY.
  FOREACH relation IN ARRAY bindings LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = relation
                      AND c.relkind = 'r' AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % must exist with row level security enabled', relation;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = ('public.' || relation)::regclass) THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % carries no policy: it is reachable through the reviewed producers alone', relation;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND (has_table_privilege(target_role, 'public.' || relation, 'SELECT')
           OR has_table_privilege(target_role, 'public.' || relation, 'INSERT')) THEN
        RAISE EXCEPTION 'QAN-CW-REM-02: % must hold no privilege on %', target_role, relation;
      END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                    WHERE tg.tgrelid = ('public.' || relation)::regclass
                      AND tg.tgname = relation || '_immutable'
                      AND NOT tg.tgisinternal) THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % is append-only history the moment it is written', relation;
    END IF;
    -- EVERY FOREIGN KEY IS ON DELETE RESTRICT, as every I-07B key is: a binding
    -- can never be silently removed by something happening to its parents.
    SELECT string_agg(con.conname, ', ' ORDER BY con.conname) INTO offending
      FROM pg_constraint con
     WHERE con.conrelid = ('public.' || relation)::regclass
       AND con.contype = 'f' AND con.confdeltype <> 'r';
    IF offending IS NOT NULL THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: every % foreign key is ON DELETE RESTRICT; found %', relation, offending;
    END IF;
    IF (SELECT count(*) FROM pg_constraint con
         WHERE con.conrelid = ('public.' || relation)::regclass AND con.contype = 'f') <> 3 THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: % binds its transition, its exact view and that view''s role, and nothing less', relation;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'matching_proposal_delivery_view_bindings_transition_fk',
    'matching_proposal_delivery_view_bindings_view_fk',
    'matching_proposal_delivery_view_bindings_role_fk',
    'matching_proposal_delivery_view_bindings_state_check',
    'matching_proposal_delivery_view_bindings_role_check',
    'matching_proposal_delivery_view_bindings_state_key',
    'matching_proposal_delivery_view_bindings_view_key',
    'matching_proposal_delivery_view_bindings_exact_key',
    'matching_proposal_decision_view_bindings_transition_fk',
    'matching_proposal_decision_view_bindings_view_fk',
    'matching_proposal_decision_view_bindings_role_fk',
    'matching_proposal_decision_view_bindings_state_check',
    'matching_proposal_decision_view_bindings_role_check',
    'matching_proposal_decision_view_bindings_proposal_key',
    'matching_proposal_decision_view_bindings_exact_key'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conname = fn) THEN
      RAISE EXCEPTION 'QAN-CW-REM-02: the structural binding constraint % must exist', fn;
    END IF;
  END LOOP;
  -- The additive candidate key both role bindings need is a key over a primary
  -- key, so it refuses nothing the predecessor already accepted.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint con
                  WHERE con.conrelid = 'public.matching_recipient_proposal_views'::regclass
                    AND con.conname = 'matching_recipient_proposal_views_role_identity_key'
                    AND con.contype = 'u'
                    AND pg_get_constraintdef(con.oid) = 'UNIQUE (id, recipient_role)') THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: the additive recipient-view role identity key must exist over the primary key';
  END IF;

  -- NO RECIPIENT PROJECTION CAN REACH EITHER BINDING. They are internal
  -- authority, and the audience boundaries are still STABLE and still answer
  -- exactly what they always answered.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public'
     AND pr.proname IN ('resolve_my_matching_proposal_v1', 'resolve_my_matching_proposal_fields_v1',
                        'resolve_matching_proposal_neutral_outcome_v1')
     AND (pr.prosrc ~ '(matching_proposal_decision_view_bindings|matching_proposal_delivery_view_bindings)'
       OR pr.provolatile <> 's');
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'QAN-CW-REM-02: a recipient projection may not read a view binding and must stay STABLE; found %', offending;
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
