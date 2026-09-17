-- I-07C - Mutual Match, Introduction Record, active-Introduction claim, first
-- forward-approval exact-view binding and Match Handoff Package persistence v1.
--
-- I-07B stopped exactly where the second-party acceptance begins: a proposal in
-- FORWARDED_TO_SECOND, with no durable "accepted but not matched" state and no
-- producer for the two reserved states MUTUAL_MATCH_COMMITTED and
-- CANCELLED_BY_COMPETING_MATCH. This forward-only migration creates the
-- PERSISTENCE the atomic Mutual Match transaction of migration 0114 commits into,
-- and - exactly as 0108 and 0110 did for their slices - it creates persistence
-- and nothing else: no command, no resolver, no read boundary and no
-- application-reachable path of any kind. The second acceptance is durable only
-- as a successful Match commit, and that commit is 0114's work.
--
-- ## The frozen transaction this persistence serves (CW2-06 section 35)
--
--     both participation states current ACTIVE
--     exact pair / proposal / versions current
--     eligibility / authority current
--     both active-Introduction slots EMPTY
--       -> atomically claim both slots
--       -> mark MUTUAL_MATCH_COMMITTED
--       -> create / link ONE Introduction Record
--       -> create exactly ONE SHARED_WORLD / INTRODUCTION
--       -> pause proposal generation for both
--       -> terminalize competing proposals
--       -> create exact bounded MATCH_HANDOFF_PACKAGE_VERSION
--
-- All effects converge under ONE stable MATCH_COMMIT_ID.
--
-- ## MATCH_COMMIT_ID is the command, and the command IS the Match transition
--
-- `public.matching_match_commits.id` is the caller-supplied command id, so the
-- primary key is the durable exactly-once record; there is no second idempotency
-- table and no key that can drift from the result. The same identity is the id
-- of the proposal's MUTUAL_MATCH_COMMITTED transition, written through the ONE
-- I-07B transition writer: a composite foreign key from (id, proposal_id,
-- MUTUAL_MATCH_COMMITTED) onto the transition chain makes "this commit is the
-- Match transition of this exact proposal" structural, and a second one from
-- (id, candidate_user_id) onto the transition's candidate actor makes "the
-- second human is the actor" structural too.
--
-- The commit row is inserted LAST, exactly as the 0082 acceptance command is,
-- and it binds EVERY effect of the transaction with a restrictive foreign key
-- and a UNIQUE: the exact proposal (one proposal -> at most one commit), the
-- exact canonical pair and direction, the first party's durable approval and the
-- exact first-recipient view it approved, the exact candidate view the second
-- party accepted, the Introduction Record, the Shared World, the two membership
-- episodes, the two active-Introduction claims, the two ACTIVE_INTRODUCTION pause
-- acts, and the handoff package version - plus ONE database-owned commit instant.
--
-- Every effect ALSO carries `match_commit_id`, so no Introduction Record, birth
-- fact, claim, cancellation link or handoff package can exist without naming the
-- commit that produced it. Those bindings point at a row that is inserted after
-- them, so they are DEFERRABLE INITIALLY DEFERRED - the one operational
-- consequence 0085 recorded for its accepted-episode binding - and 0114 flushes
-- them with SET CONSTRAINTS ... IMMEDIATE before it returns, so a Match commit
-- validates its own reverse bindings inside its own transaction and leaves no
-- pending event behind. Exactly these six constraints are deferrable; the
-- terminal self-assertion refuses a seventh.
--
-- ## The active-Introduction claim is a concurrency guard, NOT a second truth
--
-- The canonical Product answer to "does this human hold an active Introduction"
-- stays where I-07B put it: `resolve_matching_active_introduction_v1`, derived
-- from the canonical Shared World substrate migration 0075 owns. Nothing here
-- replaces that resolver and nothing here is read as user-facing state.
--
-- `public.matching_active_introduction_claims` exists for ONE reason: two
-- concurrent Matches sharing a human must have a single winner, structurally,
-- even if some future path reached the write region without the serialization
-- 0114 performs. A partial UNIQUE index over (user_id) WHERE claim_state = 'HELD'
-- is that guarantee: at most one HELD claim per human, and the loser's INSERT is
-- refused by the database rather than by whichever check somebody remembered to
-- write. A claim binds the exact Introduction Record, World and Match commit it
-- was born with, is born HELD, may exist only inside a successful Match commit,
-- and rolls back with every other effect. RELEASED is REPRESENTABLE - the
-- vocabulary, the coherence CHECK and the one legal transition exist - and has
-- NO I-07C producer: release is I-07D's, exactly as 0108 reserves four pause
-- reasons and 0110 reserves two proposal states. There is no pre-reservation:
-- nothing here can hold a claim for a human before their Match commits.
--
-- ## The first acceptance is durably view-bound
--
-- I-07B's forward approval validated the exact first-recipient view at decision
-- time but did not persist WHICH view authorized the approval. A Mutual Match is
-- two human acceptances, and the first one has to be provable at the instant of
-- the second, so `public.matching_forward_approval_view_bindings` binds the
-- FIRST_FORWARD_APPROVED transition to the exact proposal, the exact approver
-- (the proposal's first recipient, by composite key onto the transition's actor
-- slot) and the exact FIRST_RECIPIENT view version they approved. 0114 revises
-- the approval boundary to write it atomically with the transition, and the
-- Match commit requires that bound view to STILL be the first recipient's
-- current view. A superseded first approval is refused, never carried forward.
--
-- ## The Match Handoff Package is a one-way structural projection
--
-- Three typed relations - a package header bound to the two exact current
-- recipient views, one subject row per view, one field row per disclosed field -
-- and no JSON, array, payload or free key/value column anywhere. What makes the
-- privacy ceiling STRUCTURAL rather than conventional:
--
--   * a handoff field is bound by composite foreign key to a real row of the
--     exact source view's already-disclosed field set, and a truth trigger
--     refuses a value that differs from that row;
--   * a subject's first name is bound by composite foreign key to the exact
--     source view's (id, subject_first_name), so it can only ever be the name
--     that view already presented;
--   * a subject's conclusion is bound to the exact permitted conclusion the
--     source view carries, by composite key onto the view and a truth trigger
--     that refuses text differing from the PERMITTED row;
--   * no handoff relation carries a foreign key into private reasoning notes,
--     safe conclusion CANDIDATES, filter refusals, hard requirement results,
--     eligibility snapshots or any authority relation - the terminal
--     self-assertion enumerates the only parents a handoff row may have.
--
-- Nothing in the package is computed: it is the two exact views, copied under
-- the constraints that make copying anything else unrepresentable. No Shared
-- Standing Context Grant is created and no Matching Context Grant is transferred.
--
-- ## Forward-only, and what I-07B leaves representable
--
-- The I-07B private-reason vocabulary gains exactly COMPETING_MATCH_COMMITTED,
-- rebuilt here from the 0110 list and never by editing 0110. Four additive
-- candidate keys are added to predecessor relations so that the bindings above
-- can be exact rows rather than remembered checks: (id, first_recipient_actor_id)
-- and (id, candidate_actor_id) on the transition chain, (id, pair_id,
-- lower_user_id, higher_user_id) on proposals, three identity keys on recipient
-- views, and (id, world_id, user_id) on the 0075 membership episodes. Each is a
-- candidate key over a primary key, changes no row and no semantic, and is
-- precisely the kind of later additive constraint every predecessor verifier
-- records as permitted. No column is added to any predecessor relation; in
-- particular `matching_proposals` gains no match-commit, slot, claim, World or
-- handoff column, which the I-07B column ban continues to forbid.
--
-- Migrations 0001-0112 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ADDITIVE CANDIDATE KEYS ON PREDECESSOR RELATIONS.
--
--    Each is a candidate key over an existing primary key: it refuses nothing a
--    predecessor accepts and lets a later row bind an EXACT row of that human,
--    that actor or that World rather than two independently satisfiable halves.
-- ---------------------------------------------------------------------------
ALTER TABLE public.matching_proposal_transitions
    ADD CONSTRAINT matching_proposal_transitions_first_actor_identity_key
        UNIQUE (id, first_recipient_actor_id),
    ADD CONSTRAINT matching_proposal_transitions_candidate_actor_identity_key
        UNIQUE (id, candidate_actor_id);

ALTER TABLE public.matching_proposals
    ADD CONSTRAINT matching_proposals_pair_identity_key
        UNIQUE (id, pair_id, lower_user_id, higher_user_id);

ALTER TABLE public.matching_recipient_proposal_views
    ADD CONSTRAINT matching_recipient_proposal_views_audience_subject_key
        UNIQUE (id, recipient_user_id, subject_user_id),
    ADD CONSTRAINT matching_recipient_proposal_views_first_name_key
        UNIQUE (id, subject_first_name),
    ADD CONSTRAINT matching_recipient_proposal_views_conclusion_key
        UNIQUE (id, permitted_conclusion_id);

ALTER TABLE public.shared_world_membership_episodes
    ADD CONSTRAINT shared_world_membership_episodes_world_member_identity_key
        UNIQUE (id, world_id, user_id);

-- ---------------------------------------------------------------------------
-- 2. THE PRIVATE REASON VOCABULARY GAINS EXACTLY ONE CODE.
--
--    Rebuilt from the 0110 list plus COMPETING_MATCH_COMMITTED - the private
--    reason a live proposal ends when another Match involving one of its humans
--    commits. It is private operational truth: the recipient projection still
--    answers NO_LONGER_AVAILABLE, exactly as for an expiry.
-- ---------------------------------------------------------------------------
ALTER TABLE public.matching_proposal_transitions
    DROP CONSTRAINT matching_proposal_transitions_reason_check;
ALTER TABLE public.matching_proposal_transitions
    ADD CONSTRAINT matching_proposal_transitions_reason_check
        CHECK (private_reason_code IS NULL OR private_reason_code IN (
            'RECIPIENT_DECLINED', 'WITHDRAWN_BY_FIRST_PARTY', 'PROPOSAL_EXPIRED',
            'PARTICIPATION_NOT_ACTIVE', 'MATCHING_CONTEXT_GRANT_CHANGED',
            'INTRODUCTION_PROFILE_VERSION_CHANGED', 'MATCHING_REQUIREMENT_VERSION_CHANGED',
            'DISCLOSURE_AUTHORITY_CHANGED', 'PROPOSAL_POLICY_CHANGED',
            'ACTIVE_INTRODUCTION_PRESENT', 'RECIPIENT_VIEW_SUPERSEDED',
            'COMPETING_MATCH_COMMITTED'));

-- ---------------------------------------------------------------------------
-- 3. THE DURABLE FIRST ACCEPTANCE: forward approval bound to its exact view.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_forward_approval_view_bindings (
    -- The FIRST_FORWARD_APPROVED transition id, which IS the approval command id.
    approval_transition_id uuid PRIMARY KEY,
    proposal_id uuid NOT NULL,
    approval_state text NOT NULL DEFAULT 'FIRST_FORWARD_APPROVED',
    approver_user_id uuid NOT NULL,
    approved_view_id uuid NOT NULL,
    bound_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- One proposal is approved for forwarding at most once.
    CONSTRAINT matching_forward_approval_view_bindings_proposal_key UNIQUE (proposal_id),
    -- The composite identity a Match commit binds: this transition, this
    -- proposal, this exact approved view.
    CONSTRAINT matching_forward_approval_view_bindings_exact_key
        UNIQUE (approval_transition_id, proposal_id, approved_view_id),
    CONSTRAINT matching_forward_approval_view_bindings_state_check
        CHECK (approval_state = 'FIRST_FORWARD_APPROVED'),
    -- The bound transition is THIS proposal's FIRST_FORWARD_APPROVED transition...
    CONSTRAINT matching_forward_approval_view_bindings_transition_fk
        FOREIGN KEY (approval_transition_id, proposal_id, approval_state)
        REFERENCES public.matching_proposal_transitions (id, proposal_id, resulting_state) ON DELETE RESTRICT,
    -- ... whose recorded actor is the approver ...
    CONSTRAINT matching_forward_approval_view_bindings_actor_fk
        FOREIGN KEY (approval_transition_id, approver_user_id)
        REFERENCES public.matching_proposal_transitions (id, first_recipient_actor_id) ON DELETE RESTRICT,
    -- ... who is the proposal's first recipient ...
    CONSTRAINT matching_forward_approval_view_bindings_approver_fk
        FOREIGN KEY (proposal_id, approver_user_id)
        REFERENCES public.matching_proposals (id, first_recipient_user_id) ON DELETE RESTRICT,
    -- ... and the approved view is a view OF THIS PROPOSAL FOR THAT HUMAN, which
    -- the 0110 audience CHECK pins to the FIRST_RECIPIENT role.
    CONSTRAINT matching_forward_approval_view_bindings_view_fk
        FOREIGN KEY (approved_view_id, proposal_id, approver_user_id)
        REFERENCES public.matching_recipient_proposal_views (id, proposal_id, recipient_user_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.matching_forward_approval_view_bindings IS
  'The durable, immutable binding of one FIRST_FORWARD_APPROVED transition to the '
  'exact proposal, the exact approving first recipient and the exact '
  'FIRST_RECIPIENT view version that authorized it. A Mutual Match requires this '
  'bound view to still be that human''s current view; a superseded first '
  'approval is refused rather than carried forward.';

-- ---------------------------------------------------------------------------
-- 4. THE MATCH COMMIT, created first so its children can bind it, and bound to
--    those children afterwards.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_match_commits (
    -- MATCH_COMMIT_ID: the caller-supplied command id, AND the id of the
    -- proposal's MUTUAL_MATCH_COMMITTED transition.
    id uuid PRIMARY KEY,
    proposal_id uuid NOT NULL,
    match_state text NOT NULL DEFAULT 'MUTUAL_MATCH_COMMITTED',
    pair_id uuid NOT NULL,
    lower_user_id uuid NOT NULL,
    higher_user_id uuid NOT NULL,
    first_recipient_user_id uuid NOT NULL,
    candidate_user_id uuid NOT NULL,
    first_approval_transition_id uuid NOT NULL,
    first_approved_view_id uuid NOT NULL,
    candidate_accepted_view_id uuid NOT NULL,
    introduction_record_id uuid NOT NULL,
    world_id uuid NOT NULL,
    first_recipient_membership_episode_id uuid NOT NULL,
    candidate_membership_episode_id uuid NOT NULL,
    first_recipient_claim_id uuid NOT NULL,
    candidate_claim_id uuid NOT NULL,
    first_recipient_pause_event_id uuid NOT NULL,
    candidate_pause_event_id uuid NOT NULL,
    handoff_package_version_id uuid NOT NULL,
    committed_at timestamptz NOT NULL,
    -- One proposal produces at most one Match commit, and one Match commit
    -- produces exactly one of everything else.
    CONSTRAINT matching_match_commits_proposal_key UNIQUE (proposal_id),
    CONSTRAINT matching_match_commits_record_key UNIQUE (introduction_record_id),
    CONSTRAINT matching_match_commits_world_key UNIQUE (world_id),
    CONSTRAINT matching_match_commits_first_episode_key UNIQUE (first_recipient_membership_episode_id),
    CONSTRAINT matching_match_commits_candidate_episode_key UNIQUE (candidate_membership_episode_id),
    CONSTRAINT matching_match_commits_first_claim_key UNIQUE (first_recipient_claim_id),
    CONSTRAINT matching_match_commits_candidate_claim_key UNIQUE (candidate_claim_id),
    CONSTRAINT matching_match_commits_first_pause_key UNIQUE (first_recipient_pause_event_id),
    CONSTRAINT matching_match_commits_candidate_pause_key UNIQUE (candidate_pause_event_id),
    CONSTRAINT matching_match_commits_handoff_key UNIQUE (handoff_package_version_id),
    CONSTRAINT matching_match_commits_state_check CHECK (match_state = 'MUTUAL_MATCH_COMMITTED'),
    CONSTRAINT matching_match_commits_direction_check
        CHECK ((first_recipient_user_id = lower_user_id AND candidate_user_id = higher_user_id)
            OR (first_recipient_user_id = higher_user_id AND candidate_user_id = lower_user_id)),
    CONSTRAINT matching_match_commits_distinct_views_check
        CHECK (first_approved_view_id <> candidate_accepted_view_id),
    CONSTRAINT matching_match_commits_distinct_episodes_check
        CHECK (first_recipient_membership_episode_id <> candidate_membership_episode_id),
    CONSTRAINT matching_match_commits_distinct_claims_check
        CHECK (first_recipient_claim_id <> candidate_claim_id),
    CONSTRAINT matching_match_commits_distinct_pauses_check
        CHECK (first_recipient_pause_event_id <> candidate_pause_event_id),
    -- THE COMMIT IS THE MATCH TRANSITION of this exact proposal, and the second
    -- human is its actor.
    CONSTRAINT matching_match_commits_transition_fk
        FOREIGN KEY (id, proposal_id, match_state)
        REFERENCES public.matching_proposal_transitions (id, proposal_id, resulting_state) ON DELETE RESTRICT,
    CONSTRAINT matching_match_commits_actor_fk
        FOREIGN KEY (id, candidate_user_id)
        REFERENCES public.matching_proposal_transitions (id, candidate_actor_id) ON DELETE RESTRICT,
    -- The exact canonical pair and direction are the proposal's own.
    CONSTRAINT matching_match_commits_pair_fk
        FOREIGN KEY (proposal_id, pair_id, lower_user_id, higher_user_id)
        REFERENCES public.matching_proposals (id, pair_id, lower_user_id, higher_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_match_commits_first_fk
        FOREIGN KEY (proposal_id, first_recipient_user_id)
        REFERENCES public.matching_proposals (id, first_recipient_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_match_commits_candidate_fk
        FOREIGN KEY (proposal_id, candidate_user_id)
        REFERENCES public.matching_proposals (id, candidate_user_id) ON DELETE RESTRICT,
    -- The first acceptance: this proposal's durable approval and its exact view.
    CONSTRAINT matching_match_commits_first_approval_fk
        FOREIGN KEY (first_approval_transition_id, proposal_id, first_approved_view_id)
        REFERENCES public.matching_forward_approval_view_bindings (approval_transition_id, proposal_id, approved_view_id)
        ON DELETE RESTRICT,
    -- The second acceptance: the candidate's exact view of this proposal.
    CONSTRAINT matching_match_commits_second_view_fk
        FOREIGN KEY (candidate_accepted_view_id, proposal_id, candidate_user_id)
        REFERENCES public.matching_recipient_proposal_views (id, proposal_id, recipient_user_id) ON DELETE RESTRICT,
    -- Exactly two membership episodes: each an episode OF THIS WORLD FOR THAT HUMAN.
    CONSTRAINT matching_match_commits_first_episode_fk
        FOREIGN KEY (first_recipient_membership_episode_id, world_id, first_recipient_user_id)
        REFERENCES public.shared_world_membership_episodes (id, world_id, user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_match_commits_candidate_episode_fk
        FOREIGN KEY (candidate_membership_episode_id, world_id, candidate_user_id)
        REFERENCES public.shared_world_membership_episodes (id, world_id, user_id) ON DELETE RESTRICT,
    -- Exactly two ACTIVE_INTRODUCTION pause acts: each an act OF THAT HUMAN.
    CONSTRAINT matching_match_commits_first_pause_fk
        FOREIGN KEY (first_recipient_pause_event_id, first_recipient_user_id)
        REFERENCES public.matching_participation_events (id, participant_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_match_commits_candidate_pause_fk
        FOREIGN KEY (candidate_pause_event_id, candidate_user_id)
        REFERENCES public.matching_participation_events (id, participant_user_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.matching_match_commits IS
  'MATCH_COMMIT_ID: the durable exactly-once record of one Mutual Match. The row '
  'id is the caller-supplied command id and the id of the proposal''s '
  'MUTUAL_MATCH_COMMITTED transition. Inserted last, it binds every effect of the '
  'atomic transaction with a restrictive foreign key and a UNIQUE - the exact '
  'proposal, pair and direction, the first party''s durable approval and view, '
  'the second party''s exact accepted view, the Introduction Record, the Shared '
  'World, both membership episodes, both active-Introduction claims, both '
  'ACTIVE_INTRODUCTION pauses and the handoff package - under one database-owned '
  'commit instant. An equivalent retry answers from this row; the same id '
  'carrying any different request fails closed.';

-- ---------------------------------------------------------------------------
-- 5. THE INTRODUCTION RECORD.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_records (
    id uuid PRIMARY KEY,
    match_commit_id uuid NOT NULL,
    world_id uuid NOT NULL,
    pair_id uuid NOT NULL,
    lower_user_id uuid NOT NULL,
    higher_user_id uuid NOT NULL,
    introduction_status text NOT NULL DEFAULT 'ACTIVE',
    started_at timestamptz NOT NULL,
    ended_at timestamptz,
    -- One Match commit -> one Introduction Record -> one born Match World.
    CONSTRAINT introduction_records_match_commit_key UNIQUE (match_commit_id),
    CONSTRAINT introduction_records_world_key UNIQUE (world_id),
    -- The composite identities children and the commit bind.
    CONSTRAINT introduction_records_world_identity_key UNIQUE (id, world_id),
    CONSTRAINT introduction_records_commit_identity_key UNIQUE (id, world_id, match_commit_id),
    CONSTRAINT introduction_records_pair_identity_key UNIQUE (id, pair_id, lower_user_id, higher_user_id),
    -- The reverse binding onto the commit that is inserted after this row.
    CONSTRAINT introduction_records_match_commit_fk
        FOREIGN KEY (match_commit_id) REFERENCES public.matching_match_commits (id)
        ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT introduction_records_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT introduction_records_pair_fk
        FOREIGN KEY (pair_id, lower_user_id, higher_user_id)
        REFERENCES public.matching_pairs (id, lower_user_id, higher_user_id) ON DELETE RESTRICT,
    -- The frozen CW2-03 vocabulary. COMPLETED and CLOSED are REPRESENTABLE and
    -- have no I-07C producer: I-07D adds the terminal transitions.
    CONSTRAINT introduction_records_status_check
        CHECK (introduction_status IN ('ACTIVE', 'COMPLETED', 'CLOSED')),
    CONSTRAINT introduction_records_closure_consistency_check
        CHECK ((introduction_status = 'ACTIVE') = (ended_at IS NULL)),
    CONSTRAINT introduction_records_ended_after_start_check
        CHECK (ended_at IS NULL OR ended_at >= started_at)
);

COMMENT ON TABLE public.introduction_records IS
  'INTRODUCTION_RECORD: the Introduction lifecycle of one born ACTIVE / '
  'INTRODUCTION Shared World, bound to the exact Match commit that created it, '
  'the exact World and the exact matched pair. Born ACTIVE with the commit '
  'instant. COMPLETED and CLOSED are representable so I-07D adds a producer '
  'rather than relaxing a ceiling; nothing in I-07C can reach either.';

-- ---------------------------------------------------------------------------
-- 6. THE TWO DURABLE FACTS: WORLD_BIRTH / MUTUAL_MATCH and INTRODUCTION_STARTED.
--    Table identity IS the event type, exactly as 0082's direct birth fact.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_matching_birth_events (
    world_id uuid NOT NULL,
    match_commit_id uuid NOT NULL,
    introduction_record_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    -- One born Matching World has exactly one Matching WORLD_BIRTH fact.
    CONSTRAINT shared_world_matching_birth_events_pk PRIMARY KEY (world_id),
    CONSTRAINT shared_world_matching_birth_events_commit_key UNIQUE (match_commit_id),
    CONSTRAINT shared_world_matching_birth_events_record_key UNIQUE (introduction_record_id),
    CONSTRAINT shared_world_matching_birth_events_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_matching_birth_events_record_fk
        FOREIGN KEY (introduction_record_id, world_id, match_commit_id)
        REFERENCES public.introduction_records (id, world_id, match_commit_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_matching_birth_events_commit_fk
        FOREIGN KEY (match_commit_id) REFERENCES public.matching_match_commits (id)
        ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE public.shared_world_matching_birth_events IS
  'The durable WORLD_BIRTH / MUTUAL_MATCH fact. Table identity is the event '
  'type: one born Matching World has exactly one row, bound to the exact '
  'Introduction Record and Match commit. No application caller inserts it.';

CREATE TABLE public.shared_world_introduction_started_events (
    introduction_record_id uuid NOT NULL,
    world_id uuid NOT NULL,
    match_commit_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    -- One Introduction Record has exactly one INTRODUCTION_STARTED fact.
    CONSTRAINT shared_world_introduction_started_events_pk PRIMARY KEY (introduction_record_id),
    CONSTRAINT shared_world_introduction_started_events_world_key UNIQUE (world_id),
    CONSTRAINT shared_world_introduction_started_events_commit_key UNIQUE (match_commit_id),
    CONSTRAINT shared_world_introduction_started_events_record_fk
        FOREIGN KEY (introduction_record_id, world_id, match_commit_id)
        REFERENCES public.introduction_records (id, world_id, match_commit_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_introduction_started_events_commit_fk
        FOREIGN KEY (match_commit_id) REFERENCES public.matching_match_commits (id)
        ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE public.shared_world_introduction_started_events IS
  'The durable INTRODUCTION_STARTED fact. One Introduction Record has exactly one '
  'row, bound to the exact World and Match commit. No application caller '
  'inserts it.';

-- ---------------------------------------------------------------------------
-- 7. THE ACTIVE-INTRODUCTION CLAIM: the internal single-winner guard.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_active_introduction_claims (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    match_commit_id uuid NOT NULL,
    introduction_record_id uuid NOT NULL,
    world_id uuid NOT NULL,
    claim_state text NOT NULL DEFAULT 'HELD',
    claimed_at timestamptz NOT NULL,
    released_at timestamptz,
    -- The composite identity the commit binds: this claim, of this record, for
    -- this human.
    CONSTRAINT matching_active_introduction_claims_record_identity_key
        UNIQUE (id, introduction_record_id, user_id),
    -- One Match claims each of its humans exactly once.
    CONSTRAINT matching_active_introduction_claims_commit_human_key UNIQUE (match_commit_id, user_id),
    CONSTRAINT matching_active_introduction_claims_record_human_key UNIQUE (introduction_record_id, user_id),
    CONSTRAINT matching_active_introduction_claims_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    -- A claim links the exact Introduction Record, World AND Match commit as ONE
    -- row: two claims of one commit therefore always reference one record and
    -- one World.
    CONSTRAINT matching_active_introduction_claims_record_fk
        FOREIGN KEY (introduction_record_id, world_id, match_commit_id)
        REFERENCES public.introduction_records (id, world_id, match_commit_id) ON DELETE RESTRICT,
    CONSTRAINT matching_active_introduction_claims_commit_fk
        FOREIGN KEY (match_commit_id) REFERENCES public.matching_match_commits (id)
        ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    -- HELD | RELEASED. RELEASED is representable and has no I-07C producer.
    CONSTRAINT matching_active_introduction_claims_state_check
        CHECK (claim_state IN ('HELD', 'RELEASED')),
    CONSTRAINT matching_active_introduction_claims_release_consistency_check
        CHECK ((claim_state = 'RELEASED') = (released_at IS NOT NULL)),
    CONSTRAINT matching_active_introduction_claims_released_after_claim_check
        CHECK (released_at IS NULL OR released_at >= claimed_at)
);

-- AT MOST ONE HELD CLAIM PER HUMAN. This is the single-winner guarantee as a
-- property of the database, not of a check somebody remembered to write.
CREATE UNIQUE INDEX matching_active_introduction_claims_one_held_idx
    ON public.matching_active_introduction_claims (user_id)
    WHERE claim_state = 'HELD';

CREATE INDEX matching_active_introduction_claims_record_idx
    ON public.matching_active_introduction_claims (introduction_record_id);

COMMENT ON TABLE public.matching_active_introduction_claims IS
  'The INTERNAL active-Introduction concurrency claim: at most one HELD claim '
  'per human, bound as one row to the exact Introduction Record, World and Match '
  'commit that created it. It is a single-winner and uniqueness guard only - '
  'never user-facing state, never a second lifecycle truth, and never a '
  'replacement for the canonical Shared-World-derived active-Introduction '
  'resolver. It exists only inside a successful Match commit and rolls back with '
  'it; release is I-07D''s and has no producer here.';

-- ---------------------------------------------------------------------------
-- 8. THE PRIVATE LINK from a competing cancellation to the Match that caused it.
--    The recipient projection never reads it; it exists so the winning commit
--    binds every cancellation it performed.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_match_competing_cancellations (
    -- The CANCELLED_BY_COMPETING_MATCH transition id.
    cancellation_transition_id uuid PRIMARY KEY,
    match_commit_id uuid NOT NULL,
    cancelled_proposal_id uuid NOT NULL,
    cancellation_state text NOT NULL DEFAULT 'CANCELLED_BY_COMPETING_MATCH',
    -- A live proposal is cancelled by exactly one Match, because it is terminal
    -- afterwards.
    CONSTRAINT matching_match_competing_cancellations_proposal_key UNIQUE (cancelled_proposal_id),
    CONSTRAINT matching_match_competing_cancellations_state_check
        CHECK (cancellation_state = 'CANCELLED_BY_COMPETING_MATCH'),
    CONSTRAINT matching_match_competing_cancellations_transition_fk
        FOREIGN KEY (cancellation_transition_id, cancelled_proposal_id, cancellation_state)
        REFERENCES public.matching_proposal_transitions (id, proposal_id, resulting_state) ON DELETE RESTRICT,
    CONSTRAINT matching_match_competing_cancellations_commit_fk
        FOREIGN KEY (match_commit_id) REFERENCES public.matching_match_commits (id)
        ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX matching_match_competing_cancellations_commit_idx
    ON public.matching_match_competing_cancellations (match_commit_id);

COMMENT ON TABLE public.matching_match_competing_cancellations IS
  'The private link from one CANCELLED_BY_COMPETING_MATCH transition to the Match '
  'commit that performed it. Private operational state: no recipient projection '
  'reads it, so a losing counterparty learns neither that a Match happened nor '
  'which one.';

-- ---------------------------------------------------------------------------
-- 9. THE MATCH HANDOFF PACKAGE: a one-way structural projection of the two
--    exact current recipient views, and nothing else.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_match_handoff_package_versions (
    id uuid PRIMARY KEY,
    match_commit_id uuid NOT NULL,
    introduction_record_id uuid NOT NULL,
    world_id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    first_recipient_user_id uuid NOT NULL,
    candidate_user_id uuid NOT NULL,
    first_recipient_view_id uuid NOT NULL,
    candidate_view_id uuid NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT matching_match_handoff_packages_commit_key UNIQUE (match_commit_id),
    CONSTRAINT matching_match_handoff_packages_record_key UNIQUE (introduction_record_id),
    CONSTRAINT matching_match_handoff_packages_world_key UNIQUE (world_id),
    CONSTRAINT matching_match_handoff_packages_proposal_key UNIQUE (proposal_id),
    CONSTRAINT matching_match_handoff_packages_first_view_key UNIQUE (first_recipient_view_id),
    CONSTRAINT matching_match_handoff_packages_candidate_view_key UNIQUE (candidate_view_id),
    -- The composite identities the commit and the subject rows bind.
    CONSTRAINT matching_match_handoff_packages_views_identity_key
        UNIQUE (id, introduction_record_id, first_recipient_view_id, candidate_view_id),
    CONSTRAINT matching_match_handoff_packages_proposal_identity_key UNIQUE (id, proposal_id),
    CONSTRAINT matching_match_handoff_packages_distinct_views_check
        CHECK (first_recipient_view_id <> candidate_view_id),
    CONSTRAINT matching_match_handoff_packages_record_fk
        FOREIGN KEY (introduction_record_id, world_id, match_commit_id)
        REFERENCES public.introduction_records (id, world_id, match_commit_id) ON DELETE RESTRICT,
    CONSTRAINT matching_match_handoff_packages_commit_fk
        FOREIGN KEY (match_commit_id) REFERENCES public.matching_match_commits (id)
        ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT matching_match_handoff_packages_first_fk
        FOREIGN KEY (proposal_id, first_recipient_user_id)
        REFERENCES public.matching_proposals (id, first_recipient_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_match_handoff_packages_candidate_fk
        FOREIGN KEY (proposal_id, candidate_user_id)
        REFERENCES public.matching_proposals (id, candidate_user_id) ON DELETE RESTRICT,
    -- The two exact views: each a view OF THIS PROPOSAL FOR THAT HUMAN.
    CONSTRAINT matching_match_handoff_packages_first_view_fk
        FOREIGN KEY (first_recipient_view_id, proposal_id, first_recipient_user_id)
        REFERENCES public.matching_recipient_proposal_views (id, proposal_id, recipient_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_match_handoff_packages_candidate_view_fk
        FOREIGN KEY (candidate_view_id, proposal_id, candidate_user_id)
        REFERENCES public.matching_recipient_proposal_views (id, proposal_id, recipient_user_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.matching_match_handoff_package_versions IS
  'MATCH_HANDOFF_PACKAGE_VERSION: the immutable header of the bounded material a '
  'born Introduction may open with, bound to the exact Match commit, Introduction '
  'Record, World, proposal and the two exact current recipient views it was '
  'projected from. It carries no Matching Context Grant, no private reasoning, '
  'no eligibility evidence and no provenance, and no Shared Standing Context '
  'Grant is created with it.';

CREATE TABLE public.matching_match_handoff_subjects (
    package_version_id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    presented_to_user_id uuid NOT NULL,
    subject_user_id uuid NOT NULL,
    source_view_id uuid NOT NULL,
    permitted_conclusion_id uuid NOT NULL,
    presented_first_name text NOT NULL,
    safe_compatibility_conclusion text NOT NULL,
    CONSTRAINT matching_match_handoff_subjects_pkey PRIMARY KEY (package_version_id, subject_user_id),
    CONSTRAINT matching_match_handoff_subjects_audience_key UNIQUE (package_version_id, presented_to_user_id),
    CONSTRAINT matching_match_handoff_subjects_view_key UNIQUE (package_version_id, source_view_id),
    CONSTRAINT matching_match_handoff_subjects_field_identity_key
        UNIQUE (package_version_id, subject_user_id, source_view_id),
    CONSTRAINT matching_match_handoff_subjects_package_fk
        FOREIGN KEY (package_version_id, proposal_id)
        REFERENCES public.matching_match_handoff_package_versions (id, proposal_id) ON DELETE RESTRICT,
    -- The source view is a view of the package's proposal, presented to exactly
    -- this human, about exactly this subject ...
    CONSTRAINT matching_match_handoff_subjects_audience_fk
        FOREIGN KEY (source_view_id, proposal_id, presented_to_user_id)
        REFERENCES public.matching_recipient_proposal_views (id, proposal_id, recipient_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_match_handoff_subjects_subject_fk
        FOREIGN KEY (source_view_id, presented_to_user_id, subject_user_id)
        REFERENCES public.matching_recipient_proposal_views (id, recipient_user_id, subject_user_id) ON DELETE RESTRICT,
    -- ... the first name IS the name that view already presented ...
    CONSTRAINT matching_match_handoff_subjects_first_name_fk
        FOREIGN KEY (source_view_id, presented_first_name)
        REFERENCES public.matching_recipient_proposal_views (id, subject_first_name) ON DELETE RESTRICT,
    -- ... and the conclusion is the PERMITTED conclusion that view already binds.
    CONSTRAINT matching_match_handoff_subjects_conclusion_fk
        FOREIGN KEY (source_view_id, permitted_conclusion_id)
        REFERENCES public.matching_recipient_proposal_views (id, permitted_conclusion_id) ON DELETE RESTRICT,
    CONSTRAINT matching_match_handoff_subjects_permitted_fk
        FOREIGN KEY (permitted_conclusion_id)
        REFERENCES public.matching_permitted_safe_conclusions (id) ON DELETE RESTRICT,
    CONSTRAINT matching_match_handoff_subjects_audience_check
        CHECK (presented_to_user_id <> subject_user_id),
    -- The 0110 ceilings, repeated on the copy: a handoff can never present what
    -- a view could not.
    CONSTRAINT matching_match_handoff_subjects_name_check
        CHECK (btrim(presented_first_name) = presented_first_name
           AND length(presented_first_name) BETWEEN 1 AND 64
           AND presented_first_name !~ ('[0-9@/]')),
    CONSTRAINT matching_match_handoff_subjects_conclusion_body_check
        CHECK (btrim(safe_compatibility_conclusion) <> '' AND length(safe_compatibility_conclusion) <= 1024),
    CONSTRAINT matching_match_handoff_subjects_provenance_ban_check
        CHECK (safe_compatibility_conclusion !~* ('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')),
    CONSTRAINT matching_match_handoff_subjects_route_ban_check
        CHECK (safe_compatibility_conclusion !~* ('(^|[^a-z0-9])@[a-z0-9._]{2,}')
           AND safe_compatibility_conclusion !~* ('[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}')
           AND safe_compatibility_conclusion !~* ('(https?://|www\.)')
           AND safe_compatibility_conclusion !~ ('[0-9](?:[0-9 ()._+-]*[0-9]){6,}'))
);

COMMENT ON TABLE public.matching_match_handoff_subjects IS
  'One handoff subject per exact recipient view: the human the material is '
  'about, the human it was already presented to, the first name that view '
  'presented and the PERMITTED conclusion that view binds - each bound by '
  'composite foreign key to the exact view row, so nothing can be presented here '
  'that was not already lawfully presented there.';

CREATE TABLE public.matching_match_handoff_fields (
    package_version_id uuid NOT NULL,
    subject_user_id uuid NOT NULL,
    source_view_id uuid NOT NULL,
    field_key text NOT NULL,
    disclosed_value text NOT NULL,
    CONSTRAINT matching_match_handoff_fields_pkey PRIMARY KEY (package_version_id, subject_user_id, field_key),
    CONSTRAINT matching_match_handoff_fields_subject_fk
        FOREIGN KEY (package_version_id, subject_user_id, source_view_id)
        REFERENCES public.matching_match_handoff_subjects (package_version_id, subject_user_id, source_view_id)
        ON DELETE RESTRICT,
    -- A handoff field is a REAL disclosed field row of the exact source view,
    -- which already crossed both disclosure gates and the value filter.
    CONSTRAINT matching_match_handoff_fields_view_field_fk
        FOREIGN KEY (source_view_id, field_key)
        REFERENCES public.matching_recipient_proposal_view_fields (view_id, field_key) ON DELETE RESTRICT,
    CONSTRAINT matching_match_handoff_fields_value_check
        CHECK (btrim(disclosed_value) <> '' AND length(disclosed_value) <= 4096),
    CONSTRAINT matching_match_handoff_fields_route_ban_check
        CHECK (disclosed_value !~* ('(^|[^a-z0-9])@[a-z0-9._]{2,}')
           AND disclosed_value !~* ('[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}')
           AND disclosed_value !~* ('(https?://|www\.)')
           AND disclosed_value !~ ('[0-9](?:[0-9 ()._+-]*[0-9]){6,}')),
    CONSTRAINT matching_match_handoff_fields_provenance_ban_check
        CHECK (disclosed_value !~* ('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'))
);

COMMENT ON TABLE public.matching_match_handoff_fields IS
  'The already-disclosed fields of one handoff subject, each bound by composite '
  'foreign key to the exact view field row it copies and refused by a truth '
  'trigger if its value differs from that row.';

-- ---------------------------------------------------------------------------
-- 10. THE COMMIT BINDS ITS CHILDREN, now that they exist.
-- ---------------------------------------------------------------------------
ALTER TABLE public.matching_match_commits
    ADD CONSTRAINT matching_match_commits_record_fk
        FOREIGN KEY (introduction_record_id, world_id)
        REFERENCES public.introduction_records (id, world_id) ON DELETE RESTRICT,
    ADD CONSTRAINT matching_match_commits_record_pair_fk
        FOREIGN KEY (introduction_record_id, pair_id, lower_user_id, higher_user_id)
        REFERENCES public.introduction_records (id, pair_id, lower_user_id, higher_user_id) ON DELETE RESTRICT,
    ADD CONSTRAINT matching_match_commits_first_claim_fk
        FOREIGN KEY (first_recipient_claim_id, introduction_record_id, first_recipient_user_id)
        REFERENCES public.matching_active_introduction_claims (id, introduction_record_id, user_id) ON DELETE RESTRICT,
    ADD CONSTRAINT matching_match_commits_candidate_claim_fk
        FOREIGN KEY (candidate_claim_id, introduction_record_id, candidate_user_id)
        REFERENCES public.matching_active_introduction_claims (id, introduction_record_id, user_id) ON DELETE RESTRICT,
    ADD CONSTRAINT matching_match_commits_handoff_fk
        FOREIGN KEY (handoff_package_version_id, introduction_record_id, first_approved_view_id, candidate_accepted_view_id)
        REFERENCES public.matching_match_handoff_package_versions (id, introduction_record_id, first_recipient_view_id, candidate_view_id)
        ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 11. IMMUTABILITY AND TRUTH TRIGGERS.
--
--     Triggers rather than privileges alone, for the reason 0108 and 0110
--     established: a privilege does not bind the table owner. None of these is
--     a forward ceiling: I-07D's release of a claim and its terminal Introduction
--     transitions are exactly the moves the guards below leave representable.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_matching_match_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'MATCHING_MATCH_RECORD_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A forward-approval view binding, a Match commit, a Matching World birth fact, an Introduction-started fact, a competing cancellation link and a Match handoff package and its subjects and fields are immutable: UPDATE and DELETE are refused for every role, including the table owner.';
END$$;

ALTER FUNCTION public.reject_matching_match_mutation_v1() OWNER TO postgres;

CREATE TRIGGER matching_forward_approval_view_bindings_immutable
    BEFORE UPDATE OR DELETE ON public.matching_forward_approval_view_bindings
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_match_mutation_v1();
CREATE TRIGGER matching_match_commits_immutable
    BEFORE UPDATE OR DELETE ON public.matching_match_commits
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_match_mutation_v1();
CREATE TRIGGER shared_world_matching_birth_events_immutable
    BEFORE UPDATE OR DELETE ON public.shared_world_matching_birth_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_match_mutation_v1();
CREATE TRIGGER shared_world_introduction_started_events_immutable
    BEFORE UPDATE OR DELETE ON public.shared_world_introduction_started_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_match_mutation_v1();
CREATE TRIGGER matching_match_competing_cancellations_immutable
    BEFORE UPDATE OR DELETE ON public.matching_match_competing_cancellations
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_match_mutation_v1();
CREATE TRIGGER matching_match_handoff_package_versions_immutable
    BEFORE UPDATE OR DELETE ON public.matching_match_handoff_package_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_match_mutation_v1();
CREATE TRIGGER matching_match_handoff_subjects_immutable
    BEFORE UPDATE OR DELETE ON public.matching_match_handoff_subjects
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_match_mutation_v1();
CREATE TRIGGER matching_match_handoff_fields_immutable
    BEFORE UPDATE OR DELETE ON public.matching_match_handoff_fields
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_match_mutation_v1();

-- An Introduction Record is born ACTIVE, its identity is frozen, it is never
-- deleted, and the only moves it can ever make are the two terminal ones CW2-03
-- freezes - which I-07D produces and I-07C leaves representable.
CREATE FUNCTION public.introduction_record_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  changed text[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'INTRODUCTION_RECORD_IS_DURABLE'
      USING ERRCODE='55000', DETAIL='An Introduction Record is durable Introduction history and is never deleted.';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.introduction_status <> 'ACTIVE' OR NEW.ended_at IS NOT NULL THEN
      RAISE EXCEPTION 'INTRODUCTION_RECORD_BORN_ACTIVE'
        USING ERRCODE='55000', DETAIL='An Introduction Record is born ACTIVE with no end instant. COMPLETED and CLOSED are reached only by the terminal transition, which I-07C does not produce.';
    END IF;
    RETURN NEW;
  END IF;
  SELECT array_agg(o.key ORDER BY o.key) INTO changed
    FROM jsonb_each_text(to_jsonb(OLD)) AS o(key, value)
    JOIN jsonb_each_text(to_jsonb(NEW)) AS n(key, value) ON n.key = o.key
   WHERE o.key NOT IN ('introduction_status', 'ended_at')
     AND o.value IS DISTINCT FROM n.value;
  IF changed IS NOT NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_RECORD_IDENTITY_IS_FROZEN'
      USING ERRCODE='55000',
            DETAIL=format('These columns are frozen at Match commit and may never be rewritten: %s.', array_to_string(changed, ', '));
  END IF;
  IF NOT (OLD.introduction_status = 'ACTIVE' AND NEW.introduction_status IN ('COMPLETED', 'CLOSED')
          AND NEW.ended_at IS NOT NULL) THEN
    RAISE EXCEPTION 'INTRODUCTION_RECORD_TRANSITION_INVALID'
      USING ERRCODE='55000',
            DETAIL='Exactly one terminal transition may commit from ACTIVE: COMPLETED or CLOSED, with an end instant. A terminal Introduction Record is never reopened and an active one is never edited in place.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.introduction_record_truth_v1() OWNER TO postgres;

CREATE TRIGGER introduction_records_truth
    BEFORE INSERT OR UPDATE OR DELETE ON public.introduction_records
    FOR EACH ROW EXECUTE FUNCTION public.introduction_record_truth_v1();

-- A claim is born HELD for one of its Introduction Record's two humans, its
-- identity is frozen, it is never deleted, and the only move it can make is
-- HELD -> RELEASED with a release instant - I-07D's move, representable here.
CREATE FUNCTION public.matching_active_introduction_claim_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  changed text[];
  record_row public.introduction_records;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MATCHING_ACTIVE_INTRODUCTION_CLAIM_IS_DURABLE'
      USING ERRCODE='55000', DETAIL='An active-Introduction claim is durable and is never deleted; it is released, and release is not an I-07C act.';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.claim_state <> 'HELD' OR NEW.released_at IS NOT NULL THEN
      RAISE EXCEPTION 'MATCHING_ACTIVE_INTRODUCTION_CLAIM_BORN_HELD'
        USING ERRCODE='55000', DETAIL='A claim is born HELD inside the Match commit that creates it. RELEASED is reached only by the release transition, which I-07C does not produce.';
    END IF;
    SELECT * INTO record_row FROM public.introduction_records r WHERE r.id = NEW.introduction_record_id;
    IF NOT FOUND OR NEW.user_id NOT IN (record_row.lower_user_id, record_row.higher_user_id) THEN
      RAISE EXCEPTION 'MATCHING_ACTIVE_INTRODUCTION_CLAIM_NOT_A_MATCHED_HUMAN'
        USING ERRCODE='55000', DETAIL='A claim is held only by one of the exact two humans of its Introduction Record.';
    END IF;
    RETURN NEW;
  END IF;
  SELECT array_agg(o.key ORDER BY o.key) INTO changed
    FROM jsonb_each_text(to_jsonb(OLD)) AS o(key, value)
    JOIN jsonb_each_text(to_jsonb(NEW)) AS n(key, value) ON n.key = o.key
   WHERE o.key NOT IN ('claim_state', 'released_at')
     AND o.value IS DISTINCT FROM n.value;
  IF changed IS NOT NULL THEN
    RAISE EXCEPTION 'MATCHING_ACTIVE_INTRODUCTION_CLAIM_IDENTITY_IS_FROZEN'
      USING ERRCODE='55000',
            DETAIL=format('These columns are frozen at Match commit and may never be rewritten: %s.', array_to_string(changed, ', '));
  END IF;
  IF NOT (OLD.claim_state = 'HELD' AND NEW.claim_state = 'RELEASED' AND NEW.released_at IS NOT NULL) THEN
    RAISE EXCEPTION 'MATCHING_ACTIVE_INTRODUCTION_CLAIM_TRANSITION_INVALID'
      USING ERRCODE='55000',
            DETAIL='The only legal claim transition is HELD to RELEASED with a release instant. A released claim is never re-held and a held one is never edited in place.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_active_introduction_claim_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_active_introduction_claims_truth
    BEFORE INSERT OR UPDATE OR DELETE ON public.matching_active_introduction_claims
    FOR EACH ROW EXECUTE FUNCTION public.matching_active_introduction_claim_truth_v1();

-- THE MATCH COMMIT TRUTH. Every identity the commit binds is a foreign key; what
-- a foreign key cannot say is checked here, at the instant the commit row is
-- written and after every other effect exists: the World is ACTIVE /
-- INTRODUCTION / MUTUAL_MATCH and born at the commit instant, exactly two open
-- episodes joined at that instant, the Introduction Record is ACTIVE and started
-- at that instant and names this commit, both facts occurred at that instant,
-- both claims are HELD at that instant, both pause acts are PAUSE / PAUSED /
-- ACTIVE_INTRODUCTION at that instant superseding an ACTIVE act and named by the
-- current pointers, and the handoff package was created at that instant and
-- names this commit. ONE instant, structurally.
CREATE FUNCTION public.matching_match_commit_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  world public.shared_worlds;
  record_row public.introduction_records;
  open_episodes integer;
  pause public.matching_participation_events;
  prior public.matching_participation_events;
  human uuid;
  pause_id uuid;
  claim_id uuid;
BEGIN
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = NEW.world_id;
  IF NOT FOUND OR world.lifecycle <> 'ACTIVE' OR world.phase <> 'INTRODUCTION'
     OR world.birth_basis <> 'MUTUAL_MATCH' OR world.closed_at IS NOT NULL
     OR world.born_at <> NEW.committed_at THEN
    RAISE EXCEPTION 'MATCHING_MATCH_COMMIT_WORLD_INCOHERENT'
      USING ERRCODE='55000', DETAIL='A Match commit binds a World that is exactly ACTIVE / INTRODUCTION / MUTUAL_MATCH, unclosed, and born at the commit instant.';
  END IF;
  SELECT count(*)::integer INTO open_episodes
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = NEW.world_id AND e.ended_at IS NULL;
  IF open_episodes <> 2
     OR (SELECT count(*) FROM public.shared_world_membership_episodes e WHERE e.world_id = NEW.world_id) <> 2
     OR NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                     WHERE e.id = NEW.first_recipient_membership_episode_id
                       AND e.ended_at IS NULL AND e.joined_at = NEW.committed_at)
     OR NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                     WHERE e.id = NEW.candidate_membership_episode_id
                       AND e.ended_at IS NULL AND e.joined_at = NEW.committed_at) THEN
    RAISE EXCEPTION 'MATCHING_MATCH_COMMIT_MEMBERSHIP_INCOHERENT'
      USING ERRCODE='55000', DETAIL='A Match World is born with exactly two open membership episodes, the two matched humans, both joined at the commit instant. No third human exists at birth.';
  END IF;
  SELECT * INTO record_row FROM public.introduction_records r WHERE r.id = NEW.introduction_record_id;
  IF NOT FOUND OR record_row.match_commit_id <> NEW.id OR record_row.introduction_status <> 'ACTIVE'
     OR record_row.started_at <> NEW.committed_at THEN
    RAISE EXCEPTION 'MATCHING_MATCH_COMMIT_RECORD_INCOHERENT'
      USING ERRCODE='55000', DETAIL='A Match commit binds an ACTIVE Introduction Record that names this commit and started at the commit instant.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_matching_birth_events b
                  WHERE b.world_id = NEW.world_id AND b.match_commit_id = NEW.id
                    AND b.introduction_record_id = NEW.introduction_record_id AND b.occurred_at = NEW.committed_at)
     OR NOT EXISTS (SELECT 1 FROM public.shared_world_introduction_started_events s
                     WHERE s.introduction_record_id = NEW.introduction_record_id AND s.match_commit_id = NEW.id
                       AND s.world_id = NEW.world_id AND s.occurred_at = NEW.committed_at) THEN
    RAISE EXCEPTION 'MATCHING_MATCH_COMMIT_FACTS_INCOHERENT'
      USING ERRCODE='55000', DETAIL='A Match commit binds exactly one WORLD_BIRTH fact and one INTRODUCTION_STARTED fact, both naming this commit at the commit instant.';
  END IF;
  FOREACH claim_id IN ARRAY ARRAY[NEW.first_recipient_claim_id, NEW.candidate_claim_id] LOOP
    IF NOT EXISTS (SELECT 1 FROM public.matching_active_introduction_claims c
                    WHERE c.id = claim_id AND c.match_commit_id = NEW.id AND c.claim_state = 'HELD'
                      AND c.claimed_at = NEW.committed_at) THEN
      RAISE EXCEPTION 'MATCHING_MATCH_COMMIT_CLAIM_INCOHERENT'
        USING ERRCODE='55000', DETAIL='A Match commit binds two HELD claims that name this commit and were claimed at the commit instant.';
    END IF;
  END LOOP;
  FOR human, pause_id IN
    SELECT h, p FROM unnest(ARRAY[NEW.first_recipient_user_id, NEW.candidate_user_id],
                            ARRAY[NEW.first_recipient_pause_event_id, NEW.candidate_pause_event_id]) AS t(h, p)
  LOOP
    SELECT * INTO pause FROM public.matching_participation_events e WHERE e.id = pause_id;
    IF NOT FOUND OR pause.participation_act <> 'PAUSE' OR pause.resulting_state <> 'PAUSED'
       OR pause.resulting_pause_reason <> 'ACTIVE_INTRODUCTION' OR pause.occurred_at <> NEW.committed_at
       OR pause.prior_event_id IS NULL THEN
      RAISE EXCEPTION 'MATCHING_MATCH_COMMIT_PAUSE_INCOHERENT'
        USING ERRCODE='55000', DETAIL='A Match commit binds, for each matched human, one PAUSE act resulting in PAUSED / ACTIVE_INTRODUCTION at the commit instant, superseding a prior act.';
    END IF;
    SELECT * INTO prior FROM public.matching_participation_events e WHERE e.id = pause.prior_event_id;
    IF NOT FOUND OR prior.resulting_state <> 'ACTIVE' THEN
      RAISE EXCEPTION 'MATCHING_MATCH_COMMIT_PAUSE_INCOHERENT'
        USING ERRCODE='55000', DETAIL='An ACTIVE_INTRODUCTION pause supersedes exactly an ACTIVE act: only an actively participating human can be matched.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.matching_participation_state s
                    WHERE s.participant_user_id = human AND s.current_event_id = pause_id) THEN
      RAISE EXCEPTION 'MATCHING_MATCH_COMMIT_PAUSE_INCOHERENT'
        USING ERRCODE='55000', DETAIL='Both current participation pointers name the ACTIVE_INTRODUCTION pause the Match commit produced.';
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.matching_match_handoff_package_versions h
                  WHERE h.id = NEW.handoff_package_version_id AND h.match_commit_id = NEW.id
                    AND h.world_id = NEW.world_id AND h.proposal_id = NEW.proposal_id
                    AND h.created_at = NEW.committed_at) THEN
    RAISE EXCEPTION 'MATCHING_MATCH_COMMIT_HANDOFF_INCOHERENT'
      USING ERRCODE='55000', DETAIL='A Match commit binds one handoff package that names this commit, this World and this proposal and was created at the commit instant.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_match_commit_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_match_commits_truth
    BEFORE INSERT ON public.matching_match_commits
    FOR EACH ROW EXECUTE FUNCTION public.matching_match_commit_truth_v1();

-- THE HANDOFF TRUTH. The foreign keys bind a subject and a field to exact view
-- rows; what they cannot bind is the TEXT. A subject's conclusion must be the
-- PERMITTED text the view binds and its source view must be one of the package's
-- two exact views; a field's value must be the exact value the view field row
-- carries. A handoff can therefore present nothing a view did not.
CREATE FUNCTION public.matching_match_handoff_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  package public.matching_match_handoff_package_versions;
  permitted_text text;
  view_value text;
BEGIN
  IF TG_TABLE_NAME = 'matching_match_handoff_subjects' THEN
    SELECT * INTO package FROM public.matching_match_handoff_package_versions h WHERE h.id = NEW.package_version_id;
    IF NOT FOUND OR NEW.source_view_id NOT IN (package.first_recipient_view_id, package.candidate_view_id) THEN
      RAISE EXCEPTION 'MATCHING_MATCH_HANDOFF_VIEW_NOT_IN_PACKAGE'
        USING ERRCODE='55000', DETAIL='A handoff subject is projected from one of the two exact current views the package binds, never from an earlier or unrelated view.';
    END IF;
    SELECT c.permitted_text INTO permitted_text
      FROM public.matching_permitted_safe_conclusions c WHERE c.id = NEW.permitted_conclusion_id;
    IF permitted_text IS NULL OR permitted_text <> NEW.safe_compatibility_conclusion THEN
      RAISE EXCEPTION 'MATCHING_MATCH_HANDOFF_CONCLUSION_NOT_PERMITTED_TEXT'
        USING ERRCODE='55000', DETAIL='A handoff conclusion is exactly the PERMITTED text the source view binds. Nothing is composed, rephrased or inferred at Match commit.';
    END IF;
    RETURN NEW;
  END IF;
  SELECT f.disclosed_value INTO view_value
    FROM public.matching_recipient_proposal_view_fields f
   WHERE f.view_id = NEW.source_view_id AND f.field_key = NEW.field_key;
  IF view_value IS NULL OR view_value <> NEW.disclosed_value THEN
    RAISE EXCEPTION 'MATCHING_MATCH_HANDOFF_FIELD_NOT_VIEW_VALUE'
      USING ERRCODE='55000', DETAIL='A handoff field is exactly the value the source view already disclosed. A benign key cannot carry a different value into the Introduction.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_match_handoff_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_match_handoff_subjects_truth
    BEFORE INSERT ON public.matching_match_handoff_subjects
    FOR EACH ROW EXECUTE FUNCTION public.matching_match_handoff_truth_v1();
CREATE TRIGGER matching_match_handoff_fields_truth
    BEFORE INSERT ON public.matching_match_handoff_fields
    FOR EACH ROW EXECUTE FUNCTION public.matching_match_handoff_truth_v1();

-- ---------------------------------------------------------------------------
-- 12. DENY-BY-DEFAULT ACCESS POSTURE.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'public.matching_forward_approval_view_bindings',
    'public.matching_match_commits',
    'public.introduction_records',
    'public.shared_world_matching_birth_events',
    'public.shared_world_introduction_started_events',
    'public.matching_active_introduction_claims',
    'public.matching_match_competing_cancellations',
    'public.matching_match_handoff_package_versions',
    'public.matching_match_handoff_subjects',
    'public.matching_match_handoff_fields'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', target_table);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', target_table);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM service_role', target_table);
    END IF;
  END LOOP;
END$$;

DO $$
DECLARE
  trigger_function text;
BEGIN
  FOREACH trigger_function IN ARRAY ARRAY[
    'public.reject_matching_match_mutation_v1()',
    'public.introduction_record_truth_v1()',
    'public.matching_active_introduction_claim_truth_v1()',
    'public.matching_match_commit_truth_v1()',
    'public.matching_match_handoff_truth_v1()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', trigger_function);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', trigger_function);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 13. TERMINAL SELF-ASSERTIONS.
--
--     The migration refuses to deploy a Match persistence that is
--     application-reachable, policy-bearing, generically shaped, that can
--     represent a second acceptance, that lets a handoff reach private state,
--     that defers any binding but the six reverse ones, that added a column to
--     `matching_proposals`, or whose truth guards are missing.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_tables text[] := ARRAY[
    'matching_forward_approval_view_bindings',
    'matching_match_commits',
    'introduction_records',
    'shared_world_matching_birth_events',
    'shared_world_introduction_started_events',
    'matching_active_introduction_claims',
    'matching_match_competing_cancellations',
    'matching_match_handoff_package_versions',
    'matching_match_handoff_subjects',
    'matching_match_handoff_fields'];
  immutable_tables text[] := ARRAY[
    'matching_forward_approval_view_bindings',
    'matching_match_commits',
    'shared_world_matching_birth_events',
    'shared_world_introduction_started_events',
    'matching_match_competing_cancellations',
    'matching_match_handoff_package_versions',
    'matching_match_handoff_subjects',
    'matching_match_handoff_fields'];
  guarded text[][] := ARRAY[
    ARRAY['introduction_records', 'public.introduction_record_truth_v1()'],
    ARRAY['matching_active_introduction_claims', 'public.matching_active_introduction_claim_truth_v1()'],
    ARRAY['matching_match_commits', 'public.matching_match_commit_truth_v1()'],
    ARRAY['matching_match_handoff_subjects', 'public.matching_match_handoff_truth_v1()'],
    ARRAY['matching_match_handoff_fields', 'public.matching_match_handoff_truth_v1()']];
  handoff_tables text[] := ARRAY[
    'matching_match_handoff_package_versions',
    'matching_match_handoff_subjects',
    'matching_match_handoff_fields'];
  -- The only relations a handoff row may reference: the package itself, the
  -- commit and record it belongs to, the proposal and the two exact views, the
  -- disclosed field rows and the PERMITTED conclusion. Never a private one.
  handoff_parents text[] := ARRAY[
    'matching_match_handoff_package_versions', 'matching_match_handoff_subjects',
    'matching_match_commits', 'introduction_records', 'matching_proposals',
    'matching_recipient_proposal_views', 'matching_recipient_proposal_view_fields',
    'matching_permitted_safe_conclusions'];
  deferred_constraints text[] := ARRAY[
    'introduction_records_match_commit_fk',
    'shared_world_matching_birth_events_commit_fk',
    'shared_world_introduction_started_events_commit_fk',
    'matching_active_introduction_claims_commit_fk',
    'matching_match_competing_cancellations_commit_fk',
    'matching_match_handoff_packages_commit_fk'];
  reasons text[] := ARRAY[
    'RECIPIENT_DECLINED', 'WITHDRAWN_BY_FIRST_PARTY', 'PROPOSAL_EXPIRED',
    'PARTICIPATION_NOT_ACTIVE', 'MATCHING_CONTEXT_GRANT_CHANGED',
    'INTRODUCTION_PROFILE_VERSION_CHANGED', 'MATCHING_REQUIREMENT_VERSION_CHANGED',
    'DISCLOSURE_AUTHORITY_CHANGED', 'PROPOSAL_POLICY_CHANGED',
    'ACTIVE_INTRODUCTION_PRESENT', 'RECIPIENT_VIEW_SUPERSEDED', 'COMPETING_MATCH_COMMITTED'];
  target_table text;
  qualified text;
  target_role text;
  target_privilege text;
  rls_enabled boolean;
  offending text;
  reason text;
  reason_def text;
  i integer;
BEGIN
  FOREACH target_table IN ARRAY own_tables LOOP
    qualified := 'public.' || target_table;
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = qualified::regclass;
    IF NOT rls_enabled THEN
      RAISE EXCEPTION 'I-07C: row level security must be enabled on %', qualified;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = qualified::regclass) THEN
      RAISE EXCEPTION 'I-07C: no RLS policy may exist on %', qualified;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = qualified::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-07C: PUBLIC must hold no privilege on %', qualified;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, qualified, target_privilege) THEN
            RAISE EXCEPTION 'I-07C private Match state must be unreachable: % holds % on %',
              target_role, target_privilege, qualified;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- Every immutable relation really carries its refusal, and every guarded
  -- relation really carries its truth guard.
  FOREACH target_table IN ARRAY immutable_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                    WHERE t.tgrelid = ('public.' || target_table)::regclass AND NOT t.tgisinternal
                      AND t.tgfoid = 'public.reject_matching_match_mutation_v1()'::regprocedure) THEN
      RAISE EXCEPTION 'I-07C: % must be append-only for every role including its owner', target_table;
    END IF;
  END LOOP;
  FOR i IN 1 .. array_length(guarded, 1) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                    WHERE t.tgrelid = ('public.' || guarded[i][1])::regclass AND NOT t.tgisinternal
                      AND t.tgfoid = guarded[i][2]::regprocedure) THEN
      RAISE EXCEPTION 'I-07C: % must carry its truth guard %', guarded[i][1], guarded[i][2];
    END IF;
  END LOOP;

  -- SEMANTICS ARE FIXED BY TABLE IDENTITY: no untyped payload, no generic
  -- event engine, no owner or admin, no ranking, no contact route, no second
  -- acceptance and no private-reason column anywhere in this slice. The
  -- concatenation is PARENTHESIZED: `~*` and `||` share one precedence class.
  SELECT string_agg(format('%s.%s', c.table_name, c.column_name), ', ' ORDER BY c.table_name, c.column_name)
    INTO offending
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name::text = ANY(own_tables)
     AND (c.column_name ~* ('(score|rank|weight|priorit|percent|rating|leaderboard|ordinal|position'
                         || '|owner|admin|creator|initiator|privilege|role|capability|kind|event_type|payload|metadata'
                         || '|scope|permission|second_accepted|accepted_pending|match_pending|reserved_'
                         || '|phone|email|contact|handle|social|url|photo|image|avatar|selfie'
                         || '|reason|evidence|provenance|refusal|snapshot|grant|requirement|note|source_class)')
          OR c.data_type IN ('json','jsonb','ARRAY','bytea'));
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07C: Match semantics are fixed by table identity; these columns may not exist: %', offending;
  END IF;

  -- THE I-07B COLUMN BAN IS PRESERVED: `matching_proposals` gained nothing.
  IF EXISTS (SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public' AND c.table_name = 'matching_proposals'
                AND c.column_name ~* '(match_commit|slot|claim|world|handoff|introduction_record|second_accepted|accepted_pending)') THEN
    RAISE EXCEPTION 'I-07C: MATCH_COMMIT_ID, the active-Introduction claim, the World link and the handoff link live in dedicated relations, never as columns on matching_proposals';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = 'matching_proposals') <> 11 THEN
    RAISE EXCEPTION 'I-07C: matching_proposals carries exactly the eleven columns 0110 gave it';
  END IF;

  -- NOTHING CASCADES.
  SELECT string_agg(con.conname, ', ' ORDER BY con.conname) INTO offending
    FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
   WHERE n.nspname = 'public' AND con.contype = 'f' AND con.confdeltype <> 'r'
     AND cl.relname = ANY(own_tables);
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07C: every foreign key must be ON DELETE RESTRICT; found %', offending;
  END IF;

  -- EXACTLY THE SIX REVERSE BINDINGS ARE DEFERRED, and nothing else is.
  SELECT string_agg(con.conname, ', ' ORDER BY con.conname) INTO offending
    FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
   WHERE n.nspname = 'public' AND cl.relname = ANY(own_tables)
     AND con.condeferrable AND con.conname <> ALL(deferred_constraints);
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07C: only the six reverse bindings onto the Match commit may be deferrable; found %', offending;
  END IF;
  IF (SELECT count(*) FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = 'public' AND cl.relname = ANY(own_tables)
        AND con.conname = ANY(deferred_constraints)
        AND con.condeferrable AND con.condeferred
        AND con.confrelid = 'public.matching_match_commits'::regclass) <> 6 THEN
    RAISE EXCEPTION 'I-07C: every reverse binding onto the Match commit must be DEFERRABLE INITIALLY DEFERRED, or no effect could name a commit that is inserted after it';
  END IF;

  -- THE HANDOFF CAN REACH NO PRIVATE RELATION. Every parent of a handoff
  -- relation is one of the enumerated exact-view sources.
  SELECT string_agg(format('%s -> %s', child.relname, parent.relname), ', ') INTO offending
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = child.relnamespace
   WHERE n.nspname = 'public' AND con.contype = 'f'
     AND child.relname = ANY(handoff_tables)
     AND parent.relname <> ALL(handoff_parents);
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07C: a Match handoff may bind only the exact recipient views, their disclosed fields and their permitted conclusion; found %', offending;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint con
              JOIN pg_class child ON child.oid = con.conrelid
              JOIN pg_class parent ON parent.oid = con.confrelid
             WHERE con.contype = 'f' AND child.relname = ANY(own_tables)
               AND parent.relname IN ('matching_private_reasoning_notes', 'matching_safe_conclusion_candidates',
                                      'matching_sensitive_filter_refusals', 'matching_hard_requirement_results',
                                      'matching_eligibility_snapshots', 'matching_context_grants',
                                      'matching_context_consent_events', 'pre_match_disclosure_authorities',
                                      'pre_match_disclosure_authority_fields', 'introduction_profile_field_values',
                                      'introduction_profile_versions', 'matching_requirement_versions',
                                      'matching_requirement_items', 'shared_world_standing_context_grants')) THEN
    RAISE EXCEPTION 'I-07C: no Match relation may bind private reasoning, unfiltered conclusions, refusals, evidence, eligibility, profile source rows or any Matching or Shared context authority';
  END IF;
  -- The handoff fields bind the exact view field rows and the subject binds the
  -- exact view name and conclusion, structurally.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint con
                  WHERE con.conrelid = 'public.matching_match_handoff_fields'::regclass AND con.contype = 'f'
                    AND con.confrelid = 'public.matching_recipient_proposal_view_fields'::regclass)
     OR NOT EXISTS (SELECT 1 FROM pg_constraint con
                     WHERE con.conrelid = 'public.matching_match_handoff_subjects'::regclass AND con.contype = 'f'
                       AND con.confrelid = 'public.matching_recipient_proposal_views'::regclass
                       AND pg_get_constraintdef(con.oid) LIKE '%(source_view_id, presented_first_name)%')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint con
                     WHERE con.conrelid = 'public.matching_match_handoff_subjects'::regclass AND con.contype = 'f'
                       AND con.confrelid = 'public.matching_recipient_proposal_views'::regclass
                       AND pg_get_constraintdef(con.oid) LIKE '%(source_view_id, permitted_conclusion_id)%') THEN
    RAISE EXCEPTION 'I-07C: a handoff field, first name and conclusion must each be bound to the exact view row they copy';
  END IF;

  -- THE PRIVATE REASON VOCABULARY IS THE 0110 LIST PLUS EXACTLY ONE CODE.
  SELECT pg_get_constraintdef(con.oid) INTO reason_def FROM pg_constraint con
   WHERE con.conrelid = 'public.matching_proposal_transitions'::regclass
     AND con.conname = 'matching_proposal_transitions_reason_check';
  IF reason_def IS NULL THEN
    RAISE EXCEPTION 'I-07C: the private reason CHECK must exist on the transition chain';
  END IF;
  FOREACH reason IN ARRAY reasons LOOP
    IF strpos(reason_def, '''' || reason || '''') = 0 THEN
      RAISE EXCEPTION 'I-07C: the private reason % must be representable', reason;
    END IF;
  END LOOP;
  IF (length(reason_def) - length(replace(reason_def, '''', ''))) / 2 <> array_length(reasons, 1) THEN
    RAISE EXCEPTION 'I-07C: the private reason vocabulary is exactly the eleven 0110 codes plus COMPETING_MATCH_COMMITTED';
  END IF;

  -- THE TWO CW2-03 TERMINAL RECORD STATES AND THE RELEASED CLAIM STATE ARE
  -- REPRESENTABLE with no producer here: no function this migration creates
  -- writes any of them, because this migration creates only trigger functions.
  IF EXISTS (SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
              WHERE n.nspname = 'public'
                AND pr.proname IN ('reject_matching_match_mutation_v1', 'introduction_record_truth_v1',
                                   'matching_active_introduction_claim_truth_v1', 'matching_match_commit_truth_v1',
                                   'matching_match_handoff_truth_v1')
                AND pr.prorettype <> 'trigger'::regtype::oid) THEN
    RAISE EXCEPTION 'I-07C: migration 0113 creates trigger functions and no callable boundary';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
              WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
                AND (pr.prosrc ~ 'INSERT INTO public\.matching_match_commits'
                  OR pr.prosrc ~ 'INSERT INTO public\.matching_active_introduction_claims'
                  OR pr.prosrc ~ 'INSERT INTO public\.introduction_records'
                  OR pr.prosrc ~ 'INSERT INTO public\.matching_match_handoff')) THEN
    RAISE EXCEPTION 'I-07C: migration 0113 creates no producer; the atomic Match commit is migration 0114';
  END IF;

  -- NO SECOND ACCEPTANCE STATE EXISTS, in this slice or in the chain it extends.
  IF EXISTS (SELECT 1 FROM pg_constraint con
              WHERE con.conrelid = 'public.matching_proposals'::regclass
                AND con.conname = 'matching_proposals_state_check'
                AND pg_get_constraintdef(con.oid) ~* '(SECOND_ACCEPTED|ACCEPTED_PENDING|MATCH_PENDING|INTRODUCTION_RESERVED)') THEN
    RAISE EXCEPTION 'I-07C: there is no SECOND_ACCEPTED state; the second acceptance is durable only as a Match commit';
  END IF;

  -- THE FOUR ADDITIVE PREDECESSOR KEYS EXIST and are candidate keys over primary
  -- keys, so they refuse nothing a predecessor accepts.
  FOREACH target_table IN ARRAY ARRAY[
    'matching_proposal_transitions_first_actor_identity_key',
    'matching_proposal_transitions_candidate_actor_identity_key',
    'matching_proposals_pair_identity_key',
    'matching_recipient_proposal_views_audience_subject_key',
    'matching_recipient_proposal_views_first_name_key',
    'matching_recipient_proposal_views_conclusion_key',
    'shared_world_membership_episodes_world_member_identity_key'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conname = target_table AND con.contype = 'u'
                     AND pg_get_constraintdef(con.oid) LIKE 'UNIQUE (id, %') THEN
      RAISE EXCEPTION 'I-07C: the additive candidate key % must exist and include the primary key', target_table;
    END IF;
  END LOOP;

  -- THE MATCH-SHAPED CENSUS OF THE MATCHING NAMESPACE IS EXACTLY THIS SLICE.
  -- I-07B proved this set empty at its own deploy point; every relation now in
  -- it is one this migration created and this assertion names.
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO offending
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p')
     AND c.relname ~* '^(matching_|introduction_|pre_match_)'
     AND c.relname ~* '(mutual|match_commit|_slot|_claim|introduction_record|world|handoff)'
     AND c.relname <> ALL(own_tables);
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07C: every Mutual Match, claim, Introduction record or handoff relation in the Matching namespace is one this slice owns; found %', offending;
  END IF;

  -- THE I-07A AND I-07B SEALS ARE UNCHANGED: no application role gained access
  -- to any predecessor Matching relation.
  FOREACH target_table IN ARRAY ARRAY[
    'public.matching_setup_locks', 'public.matching_participation_events', 'public.matching_participation_state',
    'public.matching_context_grants', 'public.introduction_profile_versions', 'public.introduction_profile_field_values',
    'public.pre_match_disclosure_authorities', 'public.matching_proposals', 'public.matching_proposal_transitions',
    'public.matching_recipient_proposal_views', 'public.matching_recipient_proposal_view_fields',
    'public.matching_private_reasoning_notes', 'public.matching_eligibility_snapshots',
    'public.shared_worlds', 'public.shared_world_membership_episodes'] LOOP
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-07C: no RLS policy may be added to %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-07C: the predecessor seal stays intact: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END$$;

COMMIT;
