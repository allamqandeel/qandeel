-- I-07D - Introduction terminal lifecycle v1 (PART B).
--
-- An ACTIVE / INTRODUCTION Shared World has exactly ONE terminal winner
-- (CW2-03):
--
--   SUCCESS -> ACTIVE / STANDARD               requires BOTH matched humans
--   END     -> READ_ONLY_CLOSED / INTRODUCTION unilateral by EITHER of them
--
-- Migration 0113 made both Introduction Record terminal states representable
-- and gave neither a producer; it made the claim release representable and gave
-- it no producer; migration 0108 made POST_INTRODUCTION and POST_SUCCESS
-- representable and gave neither a producer. This migration is the one reviewed
-- producer of all five, and it produces them only inside one atomic terminal
-- transaction that can happen exactly once per Introduction.
--
-- ===========================================================================
-- ONE TERMINAL WINNER, AS A PROPERTY OF THE DATABASE
-- ===========================================================================
--
-- Both outcomes converge on ONE substrate:
--
--   public.introduction_terminal_commits
--   UNIQUE (introduction_record_id)
--
-- That single key is the whole one-winner guarantee. SUCCESS and END are
-- different transactions with different authority, different effects and
-- different callers, and they insert into the SAME relation under the SAME
-- key, last, after every other effect exists. So "exactly one terminal outcome
-- per Introduction Record" is not a procedural check somebody remembered to
-- write and not a status comparison that a concurrent transaction could read
-- stale: it is a unique index. A hybrid state is unrepresentable rather than
-- merely refused.
--
-- The status on `introduction_records` remains the Product truth and the
-- frozen 0113 trigger still allows exactly one move from ACTIVE. Both are
-- true at once on purpose - the task requires that the winner substrate not be
-- only a status check - and the terminal truth trigger below proves they agree.
--
-- ===========================================================================
-- SUCCESS: QANDEEL MAY PROPOSE, TWO HUMANS DECIDE, THE SYSTEM EXECUTES
-- ===========================================================================
--
-- The transition is an IMMUTABLE EXACT VERSION bound to one World and one
-- Introduction Record, with a fixed payload: ACTIVE / INTRODUCTION becomes
-- ACTIVE / STANDARD. Preparing one is not authority and reserves nothing; a
-- record may carry several versions over its life, and an approval of version
-- A can never contribute to version B, because approval rows bind the exact
-- version by foreign key.
--
-- Each matched human's approval is an immutable act chain plus ONE current
-- pointer, exactly as I-07A models participation. APPROVE and WITHDRAW are the
-- two acts; the human is `auth.uid()` and there is no actor parameter, so no
-- caller - QANDEEL included, a future launch-gated wrapper included - can
-- manufacture or withdraw somebody else's consent. Changing one human's
-- approval never touches the other's: they are two rows.
--
-- The commit is a separate SYSTEM execution with NO actor at all. It may
-- execute only BECAUSE both exact current approvals exist over the exact
-- version, revalidated under serialization. It does not create either of them:
-- the terminal self-assertion refuses to deploy a commit that reads
-- `auth.uid()` or writes an approval.
--
-- ===========================================================================
-- END: AN EXIT IS NOT A PRIVILEGE
-- ===========================================================================
--
-- Either matched human may end an ACTIVE / INTRODUCTION unilaterally. There is
-- no counterpart approval, no proposal and no waiting period, and the actor is
-- `auth.uid()`.
--
-- END is deliberately NOT gated on the CW2-08 system/safety prerequisite. A
-- safety system may restrict what a human can CREATE, DISCLOSE or CONTINUE; it
-- must never make a human unable to leave. Disclosure and SUCCESS do require
-- CLEARED, and each has its own seam; END has none, and the self-assertion
-- refuses to deploy an END core that consults one.
--
-- Ending is an archival closure in the exact 0088 shape: the exact visible
-- history of each human is snapshotted through the ONE canonical visibility
-- entry point WHILE the World is still ACTIVE and both matched episodes are
-- still open, and only then does lifecycle change and do the episodes close.
-- No Standard WORLD_ENDED event is fabricated - that fact belongs to Standard
-- governance closure and an Introduction END is not one.
--
-- ===========================================================================
-- MATCHING IS INDEPENDENT AFTER THE MATCH
-- ===========================================================================
--
-- Neither terminal transition requires a Matching Context Grant, an
-- Introduction Profile, a requirement version or a disclosure authority. Those
-- are Matching setup, the Shared World lifecycle is independent after birth,
-- and making an exit depend on a grant the human may have revoked would be
-- exactly backwards.
--
-- What the terminal transition DOES touch is participation, and only in one
-- direction:
--
--   PAUSED / ACTIVE_INTRODUCTION  ->  PAUSED / POST_SUCCESS       (SUCCESS)
--   PAUSED / ACTIVE_INTRODUCTION  ->  PAUSED / POST_INTRODUCTION  (END)
--   OFF                           ->  left OFF, untouched
--   anything else                 ->  fail closed as contradictory
--
-- An explicit human opt-out is never overwritten with a system pause. And the
-- reserved pause a terminal transition writes is NOT resumable by the generic
-- I-07A resume, which stays USER_PAUSED-only: reactivation is migration 0117's
-- dedicated, fully revalidated boundary.
--
-- ===========================================================================
-- THE PUBLISHED CROSS-DOMAIN LOCK ORDER
-- ===========================================================================
--
--   A. the exact Shared World row                      FOR UPDATE
--   B. the exact Introduction Record                   FOR UPDATE
--   C. BOTH humans' matching_setup_locks rows, in canonical ASCENDING user-id
--      order, through the frozen 0111 helper - never in role order, never in
--      pair direction order, never incrementally per counterparty
--   D. the exact membership episodes, participation pointers, approval
--      pointers and HELD claims, each in deterministic identity order
--   E. the entitlement snapshot, the terminal event, the participation acts
--      and the one terminal commit row, last
--
-- No advisory lock, no table lock, no process mutex. Approval and withdrawal
-- take the same World-first order, which is what makes a withdrawal that wins
-- the World lock able to make the success commit observe a missing approval,
-- and an approval that loses it observe a closed Introduction.
--
-- ONE database-owned instant is captured per terminal transaction, AFTER every
-- lock wait and every currentness check, immediately before the irreversible
-- writes, and every effect of that one event uses it. The I-07C lesson is
-- explicit here: CURRENT_TIMESTAMP, now() and transaction_timestamp() are all
-- settled before a lock wait begins and can therefore decide state that
-- changed while the transaction was waiting.
--
-- ===========================================================================
-- What a terminal Introduction is NOT
-- ===========================================================================
--
-- A completed Introduction means exactly one thing: both humans approved
-- leaving guided Introduction mode and continuing in the SAME Shared World as
-- Standard. No column, event, enum or check in this migration encodes a
-- relationship, engagement, exclusivity or marriage status, and the terminal
-- self-assertion refuses to deploy one that does.
--
-- ===========================================================================
-- What this migration deliberately does NOT do
-- ===========================================================================
--
-- It creates no World and no membership episode, admits no third human, writes
-- no Standing Context Grant, no Matching Context Grant, no proposal and no
-- Standard WORLD_ENDED event; it reactivates no Matching participation - that
-- is 0117's; it reads no Personal context, no Public state and no Matching
-- private reasoning; it adds no route, controller, RPC, mobile surface, Launch
-- Gate, feature flag, entitlement or moderation policy. Every historical
-- migration, 0001-0115 included, is untouched and nothing here is replaced.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE IMMUTABLE EXACT SUCCESS TRANSITION VERSION.
--
--    The payload is FIXED by CHECK rather than supplied: from ACTIVE /
--    INTRODUCTION to ACTIVE / STANDARD, and nothing else is representable. A
--    caller cannot propose a different transition, because there is no column
--    a different one could be written into.
--
--    A record may carry SEVERAL versions over its life, so there is no unique
--    key on the record. That is deliberate: it is what makes a stale approval
--    structurally unable to contribute, because an approval binds the exact
--    version and the commit reads the approvals of exactly the version it is
--    committing.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_success_transition_versions (
    id uuid NOT NULL,
    introduction_record_id uuid NOT NULL,
    world_id uuid NOT NULL,
    from_lifecycle text NOT NULL DEFAULT 'ACTIVE',
    from_phase text NOT NULL DEFAULT 'INTRODUCTION',
    to_lifecycle text NOT NULL DEFAULT 'ACTIVE',
    to_phase text NOT NULL DEFAULT 'STANDARD',
    created_at timestamptz NOT NULL,
    CONSTRAINT introduction_success_transition_versions_pk PRIMARY KEY (id),
    -- The composite identity the approvals, the fact and the terminal commit
    -- all bind: this version, of this exact record.
    CONSTRAINT introduction_success_transition_versions_record_key
        UNIQUE (id, introduction_record_id),
    -- THE EXACT FROZEN PAYLOAD. There is no other transition to propose.
    CONSTRAINT introduction_success_transition_versions_from_check
        CHECK (from_lifecycle = 'ACTIVE' AND from_phase = 'INTRODUCTION'),
    CONSTRAINT introduction_success_transition_versions_to_check
        CHECK (to_lifecycle = 'ACTIVE' AND to_phase = 'STANDARD'),
    CONSTRAINT introduction_success_transition_versions_record_fk
        FOREIGN KEY (introduction_record_id, world_id)
        REFERENCES public.introduction_records (id, world_id) ON DELETE RESTRICT
);

CREATE INDEX introduction_success_transition_versions_record_idx
    ON public.introduction_success_transition_versions (introduction_record_id, created_at);

COMMENT ON TABLE public.introduction_success_transition_versions IS
  'One exact immutable INTRODUCTION_SUCCESS_TRANSITION_VERSION: the fixed '
  'ACTIVE / INTRODUCTION to ACTIVE / STANDARD mutation of one exact World and '
  'one exact Introduction Record. QANDEEL may propose one; proposing is not '
  'authority and reserves nothing. Human approval binds THIS exact version, so '
  'an approval of another version can never contribute to this one.';

-- ---------------------------------------------------------------------------
-- 2. THE DERIVED REQUIRED APPROVER SET OF ONE VERSION.
--
--    Exactly the two matched humans of the exact Introduction Record, derived
--    by the preparation primitive. No caller supplies an approver identity or
--    an approval count.
--
--    This relation is the structural law of the whole success model: an
--    approval row binds (version, approver) into HERE by composite foreign
--    key, so it is impossible to record an approval by a human the exact
--    version does not require - however the row is produced, and including by
--    the table owner.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_success_required_approvers (
    transition_version_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    CONSTRAINT introduction_success_required_approvers_pk
        PRIMARY KEY (transition_version_id, approver_user_id),
    CONSTRAINT introduction_success_required_approvers_version_fk
        FOREIGN KEY (transition_version_id)
        REFERENCES public.introduction_success_transition_versions (id) ON DELETE RESTRICT,
    CONSTRAINT introduction_success_required_approvers_user_fk
        FOREIGN KEY (approver_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 3. THE IMMUTABLE APPROVAL ACT CHAIN.
--
--    One act is one human decision about one exact transition version. The row
--    id IS the command id, so the primary key is the durable idempotency
--    record and there is no second idempotency table - the I-07A participation
--    shape, for the same reason.
--
--    The chain stays inside one (version, human): `prior_event_id` is bound by
--    a THREE-column foreign key, so one human's act can never supersede
--    another's and an act of version A can never supersede one of version B.
--    A partial unique index makes the history a chain rather than a tree.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_success_approval_events (
    id uuid NOT NULL,
    transition_version_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    approval_act text NOT NULL,
    resulting_state text NOT NULL,
    prior_event_id uuid,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT introduction_success_approval_events_pk PRIMARY KEY (id),
    -- The composite identity a current pointer and a prior reference bind to.
    CONSTRAINT introduction_success_approval_events_identity_key
        UNIQUE (id, transition_version_id, approver_user_id),
    CONSTRAINT introduction_success_approval_events_act_check
        CHECK (approval_act IN ('APPROVE', 'WITHDRAW')),
    CONSTRAINT introduction_success_approval_events_state_check
        CHECK (resulting_state IN ('APPROVED', 'WITHDRAWN')),
    CONSTRAINT introduction_success_approval_events_act_state_check
        CHECK (resulting_state = CASE approval_act
                                   WHEN 'APPROVE'  THEN 'APPROVED'
                                   WHEN 'WITHDRAW' THEN 'WITHDRAWN'
                                 END),
    CONSTRAINT introduction_success_approval_events_self_check
        CHECK (prior_event_id IS NULL OR prior_event_id <> id),
    -- ONLY A REQUIRED HUMAN MAY EVER HAVE AN APPROVAL ACT, structurally.
    CONSTRAINT introduction_success_approval_events_required_fk
        FOREIGN KEY (transition_version_id, approver_user_id)
        REFERENCES public.introduction_success_required_approvers
                   (transition_version_id, approver_user_id) ON DELETE RESTRICT,
    -- The superseded act belongs to the SAME human and the SAME version.
    CONSTRAINT introduction_success_approval_events_prior_fk
        FOREIGN KEY (prior_event_id, transition_version_id, approver_user_id)
        REFERENCES public.introduction_success_approval_events
                   (id, transition_version_id, approver_user_id) ON DELETE RESTRICT
);

-- An act is superseded at most once: the history is a chain, never a tree.
CREATE UNIQUE INDEX introduction_success_approval_events_prior_idx
    ON public.introduction_success_approval_events (prior_event_id)
    WHERE prior_event_id IS NOT NULL;

CREATE INDEX introduction_success_approval_events_version_idx
    ON public.introduction_success_approval_events (transition_version_id, occurred_at);

-- ---------------------------------------------------------------------------
-- 4. THE ONE CURRENT APPROVAL TRUTH PER (VERSION, HUMAN).
--
--    It duplicates no state: the current approval state is the resulting state
--    of the exact act it names, and is stored nowhere else, so the two cannot
--    disagree. Absence of a row means this human has never acted on this exact
--    version - which is NOT approval.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_success_approval_state (
    transition_version_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    current_event_id uuid NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT introduction_success_approval_state_pk
        PRIMARY KEY (transition_version_id, approver_user_id),
    -- One act is the current act of at most one pointer.
    CONSTRAINT introduction_success_approval_state_event_key UNIQUE (current_event_id),
    -- The pointer names an exact act OF THIS EXACT HUMAN ON THIS EXACT VERSION.
    CONSTRAINT introduction_success_approval_state_event_fk
        FOREIGN KEY (current_event_id, transition_version_id, approver_user_id)
        REFERENCES public.introduction_success_approval_events
                   (id, transition_version_id, approver_user_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.introduction_success_approval_state IS
  'The ONE current approval pointer per (exact success transition version, '
  'exact human). No row means that human has never acted on that exact version, '
  'which is not approval. A withdrawn approval leaves the act history intact '
  'and moves this pointer, so a stale approval can never contribute to a '
  'completion.';

-- ---------------------------------------------------------------------------
-- 5. THE TWO DURABLE TERMINAL FACTS.
--
--    Table identity IS the event type, exactly as 0113's WORLD_BIRTH and
--    INTRODUCTION_STARTED facts. One Introduction Record carries at most one
--    row in each relation, by primary key, and the terminal truth trigger
--    below additionally refuses the OTHER fact - so a hybrid outcome cannot
--    exist even as an accident of two relations.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_completed_events (
    introduction_record_id uuid NOT NULL,
    world_id uuid NOT NULL,
    success_transition_version_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT introduction_completed_events_pk PRIMARY KEY (introduction_record_id),
    CONSTRAINT introduction_completed_events_world_key UNIQUE (world_id),
    CONSTRAINT introduction_completed_events_version_key UNIQUE (success_transition_version_id),
    CONSTRAINT introduction_completed_events_record_fk
        FOREIGN KEY (introduction_record_id, world_id)
        REFERENCES public.introduction_records (id, world_id) ON DELETE RESTRICT,
    -- The exact version that completed, of this exact record.
    CONSTRAINT introduction_completed_events_version_fk
        FOREIGN KEY (success_transition_version_id, introduction_record_id)
        REFERENCES public.introduction_success_transition_versions
                   (id, introduction_record_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.introduction_completed_events IS
  'The durable INTRODUCTION_COMPLETED fact. Table identity is the event type: '
  'one Introduction Record carries exactly one row, naming the exact success '
  'transition version both humans approved. It records that guided Introduction '
  'mode ended and the SAME Shared World continues as Standard. It is not a '
  'relationship, engagement, exclusivity or marriage claim and no column here '
  'may ever assert one.';

CREATE TABLE public.introduction_ended_events (
    introduction_record_id uuid NOT NULL,
    world_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT introduction_ended_events_pk PRIMARY KEY (introduction_record_id),
    CONSTRAINT introduction_ended_events_world_key UNIQUE (world_id),
    CONSTRAINT introduction_ended_events_record_fk
        FOREIGN KEY (introduction_record_id, world_id)
        REFERENCES public.introduction_records (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT introduction_ended_events_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.introduction_ended_events IS
  'The durable INTRODUCTION_ENDED fact. Table identity is the event type: one '
  'Introduction Record carries exactly one row, naming the exact matched human '
  'who ended it unilaterally. This is NOT the Standard WORLD_ENDED fact, which '
  'belongs to unanimous Standard governance closure and is never fabricated for '
  'an Introduction.';

-- ---------------------------------------------------------------------------
-- 6. THE ONE TERMINAL WINNER SUBSTRATE.
--
--    Both outcomes insert here, LAST, after every other effect exists. UNIQUE
--    (introduction_record_id) is the whole one-winner law: SUCCESS versus END,
--    END by A versus END by B, and two competing commands of either kind all
--    resolve to exactly one surviving row, because the second insert violates
--    a unique index rather than losing a procedural comparison.
--
--    Every identity it binds is a foreign key into the exact row it must be:
--    each claim is THIS record's claim FOR THAT EXACT HUMAN, and each
--    participation act is an act OF THAT EXACT HUMAN. What a foreign key
--    cannot say is checked by the truth trigger below, at the instant this row
--    is written and after every other effect is in place.
--
--    A participation event id is NULL exactly when that human had explicitly
--    turned Matching OFF before the terminal transition, because an explicit
--    opt-out is left alone rather than overwritten with a system pause.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_terminal_commits (
    id uuid NOT NULL,
    introduction_record_id uuid NOT NULL,
    world_id uuid NOT NULL,
    match_commit_id uuid NOT NULL,
    terminal_outcome text NOT NULL,
    lower_user_id uuid NOT NULL,
    higher_user_id uuid NOT NULL,
    ending_actor_user_id uuid,
    success_transition_version_id uuid,
    lower_claim_id uuid NOT NULL,
    higher_claim_id uuid NOT NULL,
    lower_participation_event_id uuid,
    higher_participation_event_id uuid,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT introduction_terminal_commits_pk PRIMARY KEY (id),
    -- THE ONE TERMINAL WINNER. Never both, never hybrid, never twice.
    CONSTRAINT introduction_terminal_commits_record_key UNIQUE (introduction_record_id),
    CONSTRAINT introduction_terminal_commits_world_key UNIQUE (world_id),
    -- The composite identity a later reviewed consumer binds as ONE row: this
    -- exact terminal commit, of this exact Introduction. Migration 0117's
    -- reactivation record uses it so a reactivation can never name a terminal
    -- commit of a different Introduction.
    CONSTRAINT introduction_terminal_commits_record_identity_key
        UNIQUE (id, introduction_record_id),
    CONSTRAINT introduction_terminal_commits_outcome_check
        CHECK (terminal_outcome IN ('COMPLETED', 'CLOSED')),
    -- A completion has its exact approved version and no ending actor; an end
    -- has its exact ending human and no version. Neither shape is optional.
    CONSTRAINT introduction_terminal_commits_success_shape_check
        CHECK ((terminal_outcome = 'COMPLETED') = (success_transition_version_id IS NOT NULL)),
    CONSTRAINT introduction_terminal_commits_end_shape_check
        CHECK ((terminal_outcome = 'CLOSED') = (ending_actor_user_id IS NOT NULL)),
    -- The ending human is one of the exact two matched humans.
    CONSTRAINT introduction_terminal_commits_actor_check
        CHECK (ending_actor_user_id IS NULL
            OR ending_actor_user_id IN (lower_user_id, higher_user_id)),
    CONSTRAINT introduction_terminal_commits_humans_check
        CHECK (lower_user_id <> higher_user_id),
    CONSTRAINT introduction_terminal_commits_claims_check
        CHECK (lower_claim_id <> higher_claim_id),
    CONSTRAINT introduction_terminal_commits_events_check
        CHECK (lower_participation_event_id IS NULL
            OR higher_participation_event_id IS NULL
            OR lower_participation_event_id <> higher_participation_event_id),
    CONSTRAINT introduction_terminal_commits_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    -- The exact record, World and Match commit, as ONE row.
    CONSTRAINT introduction_terminal_commits_record_fk
        FOREIGN KEY (introduction_record_id, world_id, match_commit_id)
        REFERENCES public.introduction_records (id, world_id, match_commit_id) ON DELETE RESTRICT,
    -- Each claim is THIS record's claim FOR THAT EXACT HUMAN.
    CONSTRAINT introduction_terminal_commits_lower_claim_fk
        FOREIGN KEY (lower_claim_id, introduction_record_id, lower_user_id)
        REFERENCES public.matching_active_introduction_claims
                   (id, introduction_record_id, user_id) ON DELETE RESTRICT,
    CONSTRAINT introduction_terminal_commits_higher_claim_fk
        FOREIGN KEY (higher_claim_id, introduction_record_id, higher_user_id)
        REFERENCES public.matching_active_introduction_claims
                   (id, introduction_record_id, user_id) ON DELETE RESTRICT,
    -- Each post-terminal pause is an act OF THAT EXACT HUMAN.
    CONSTRAINT introduction_terminal_commits_lower_event_fk
        FOREIGN KEY (lower_participation_event_id, lower_user_id)
        REFERENCES public.matching_participation_events (id, participant_user_id) ON DELETE RESTRICT,
    CONSTRAINT introduction_terminal_commits_higher_event_fk
        FOREIGN KEY (higher_participation_event_id, higher_user_id)
        REFERENCES public.matching_participation_events (id, participant_user_id) ON DELETE RESTRICT,
    -- The exact approved version, of this exact record.
    CONSTRAINT introduction_terminal_commits_version_fk
        FOREIGN KEY (success_transition_version_id, introduction_record_id)
        REFERENCES public.introduction_success_transition_versions
                   (id, introduction_record_id) ON DELETE RESTRICT,
    CONSTRAINT introduction_terminal_commits_actor_fk
        FOREIGN KEY (ending_actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.introduction_terminal_commits IS
  'THE ONE TERMINAL WINNER of one Introduction. Both SUCCESS and END insert '
  'here, last, under UNIQUE (introduction_record_id): exactly one terminal '
  'outcome - COMPLETED or CLOSED - can ever persist per Introduction Record, '
  'never both and never a hybrid, because the second insert violates a unique '
  'index rather than losing a procedural comparison. An equivalent retry is '
  'answered from this row; the same command id carrying any different request '
  'fails closed.';

-- ---------------------------------------------------------------------------
-- 7. Deny-by-default posture for all seven new relations.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_tables text[] := ARRAY['public.introduction_success_transition_versions',
                             'public.introduction_success_required_approvers',
                             'public.introduction_success_approval_events',
                             'public.introduction_success_approval_state',
                             'public.introduction_completed_events',
                             'public.introduction_ended_events',
                             'public.introduction_terminal_commits'];
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY own_tables LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', target_table);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', target_table);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM service_role', target_table);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 8. IMMUTABILITY.
--
--    A proposed transition version, a derived required-approver row, an
--    approval act, a terminal fact and a terminal commit are all durable
--    history: UPDATE and DELETE are refused for every role INCLUDING the table
--    owner, because a privilege does not bind the owner.
--
--    The current-approval pointer is deliberately NOT in this set: moving it
--    is exactly what APPROVE and WITHDRAW do. Its own guard below allows the
--    pointer to move and refuses everything else.
--
--    The Introduction closed-view entitlements migration 0115 created are
--    frozen here, beside the terminal law that writes them: an entitlement is
--    snapshotted once, inside the one terminal transaction, and is never
--    widened, narrowed or deleted afterwards. What narrows the EFFECTIVE view
--    later is availability, which is read live and is not this relation.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_introduction_terminal_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'INTRODUCTION_TERMINAL_RECORD_IS_DURABLE'
    USING ERRCODE='55000',
          DETAIL='A success transition version, its derived required approvers, an approval act, a terminal Introduction fact, a terminal commit and a frozen closed-view entitlement are durable history: UPDATE and DELETE are refused for every role, including the table owner.';
END$$;

ALTER FUNCTION public.reject_introduction_terminal_mutation_v1() OWNER TO postgres;

CREATE TRIGGER introduction_success_transition_versions_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_success_transition_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_introduction_terminal_mutation_v1();
CREATE TRIGGER introduction_success_required_approvers_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_success_required_approvers
    FOR EACH ROW EXECUTE FUNCTION public.reject_introduction_terminal_mutation_v1();
CREATE TRIGGER introduction_success_approval_events_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_success_approval_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_introduction_terminal_mutation_v1();
CREATE TRIGGER introduction_completed_events_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_completed_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_introduction_terminal_mutation_v1();
CREATE TRIGGER introduction_ended_events_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_ended_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_introduction_terminal_mutation_v1();
CREATE TRIGGER introduction_terminal_commits_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_terminal_commits
    FOR EACH ROW EXECUTE FUNCTION public.reject_introduction_terminal_mutation_v1();
CREATE TRIGGER introduction_closed_view_entitlements_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_closed_view_entitlements
    FOR EACH ROW EXECUTE FUNCTION public.reject_introduction_terminal_mutation_v1();
CREATE TRIGGER introduction_closed_view_entitlement_items_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_closed_view_entitlement_items
    FOR EACH ROW EXECUTE FUNCTION public.reject_introduction_terminal_mutation_v1();

-- The approval pointer moves forward within one exact (version, human) and
-- does nothing else: its identity is frozen, the act it names belongs to it,
-- and it is never deleted. Both moves - APPROVE over a withdrawal and WITHDRAW
-- over an approval - are exactly what a human may do before the commit.
CREATE FUNCTION public.introduction_success_approval_pointer_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  moved public.introduction_success_approval_events;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_APPROVAL_POINTER_IS_DURABLE'
      USING ERRCODE='55000', DETAIL='A current approval pointer is durable: a human withdraws an approval, which moves the pointer; nothing deletes it.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.transition_version_id <> OLD.transition_version_id
       OR NEW.approver_user_id <> OLD.approver_user_id THEN
      RAISE EXCEPTION 'INTRODUCTION_SUCCESS_APPROVAL_POINTER_IS_FROZEN'
        USING ERRCODE='55000', DETAIL='A current approval pointer always names the same exact version and the same exact human. Only the act it names may move.';
    END IF;
    -- The act it moves TO supersedes the act it moved FROM, so the chain and
    -- the pointer can never disagree about this human's history.
    SELECT * INTO moved FROM public.introduction_success_approval_events e WHERE e.id = NEW.current_event_id;
    IF NOT FOUND OR moved.prior_event_id IS DISTINCT FROM OLD.current_event_id THEN
      RAISE EXCEPTION 'INTRODUCTION_SUCCESS_APPROVAL_POINTER_NOT_SUCCESSOR'
        USING ERRCODE='55000', DETAIL='A current approval pointer moves only to the act that supersedes the act it currently names.';
    END IF;
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.introduction_success_approval_pointer_truth_v1() OWNER TO postgres;

CREATE TRIGGER introduction_success_approval_state_truth
    BEFORE UPDATE OR DELETE ON public.introduction_success_approval_state
    FOR EACH ROW EXECUTE FUNCTION public.introduction_success_approval_pointer_truth_v1();

-- ---------------------------------------------------------------------------
-- 9. THE TERMINAL COMMIT TRUTH.
--
--    Every identity the commit binds is a foreign key; what a foreign key
--    cannot say is checked HERE, at the instant the commit row is written and
--    after every other effect exists. It is the 0113 Match-commit guard's
--    counterpart for the other end of the Introduction, and it proves the two
--    truths agree - the one-winner substrate and the Product status - rather
--    than trusting either alone.
--
--    NO HYBRID: the fact of the OTHER outcome must not exist, in either
--    direction. NO GHOST RELEASE: both claims are RELEASED at exactly this
--    instant. NO ORPHAN TRANSITION: every participation act this commit names
--    is a POST_* pause at this instant superseding the exact ACTIVE_INTRODUCTION
--    pause the Match created, and is what the human's current pointer names;
--    and where it names none, that human's current act really is OFF.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.introduction_terminal_commit_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  world public.shared_worlds;
  record_row public.introduction_records;
  match_row public.matching_match_commits;
  human uuid;
  act_id uuid;
  expected_pause uuid;
  act_row public.matching_participation_events;
  current_act public.matching_participation_events;
  open_episodes integer;
  closed_episodes integer;
  entitlements integer;
BEGIN
  SELECT * INTO record_row FROM public.introduction_records r WHERE r.id = NEW.introduction_record_id;
  IF NOT FOUND OR record_row.world_id <> NEW.world_id
     OR record_row.match_commit_id <> NEW.match_commit_id
     OR record_row.introduction_status <> NEW.terminal_outcome
     OR record_row.ended_at IS DISTINCT FROM NEW.committed_at
     OR record_row.lower_user_id <> NEW.lower_user_id
     OR record_row.higher_user_id <> NEW.higher_user_id THEN
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_RECORD_INCOHERENT'
      USING ERRCODE='55000', DETAIL='A terminal commit binds an Introduction Record that reached exactly this outcome, at exactly this instant, for exactly these two matched humans.';
  END IF;

  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = NEW.world_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_WORLD_INCOHERENT'
      USING ERRCODE='55000', DETAIL='A terminal commit binds an existing Shared World.';
  END IF;
  SELECT count(*)::integer INTO open_episodes
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = NEW.world_id AND e.ended_at IS NULL;

  IF NEW.terminal_outcome = 'COMPLETED' THEN
    -- SUCCESS: the SAME World continues, now Standard, with the SAME two open
    -- membership episodes and no closure instant of any kind.
    IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' OR world.closed_at IS NOT NULL THEN
      RAISE EXCEPTION 'INTRODUCTION_TERMINAL_WORLD_INCOHERENT'
        USING ERRCODE='55000', DETAIL='A completed Introduction leaves the SAME World ACTIVE / STANDARD and unclosed.';
    END IF;
    IF open_episodes <> 2
       OR (SELECT count(*) FROM public.shared_world_membership_episodes e WHERE e.world_id = NEW.world_id) <> 2 THEN
      RAISE EXCEPTION 'INTRODUCTION_TERMINAL_MEMBERSHIP_INCOHERENT'
        USING ERRCODE='55000', DETAIL='A completed Introduction keeps exactly the same two open membership episodes: no episode closes and no third human appears.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.introduction_completed_events ev
                    WHERE ev.introduction_record_id = NEW.introduction_record_id
                      AND ev.world_id = NEW.world_id
                      AND ev.success_transition_version_id = NEW.success_transition_version_id
                      AND ev.occurred_at = NEW.committed_at) THEN
      RAISE EXCEPTION 'INTRODUCTION_TERMINAL_FACT_INCOHERENT'
        USING ERRCODE='55000', DETAIL='A completed Introduction carries exactly one INTRODUCTION_COMPLETED fact naming the exact approved version at the terminal instant.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.introduction_ended_events ev
                WHERE ev.introduction_record_id = NEW.introduction_record_id) THEN
      RAISE EXCEPTION 'INTRODUCTION_TERMINAL_OUTCOME_IS_HYBRID'
        USING ERRCODE='55000', DETAIL='An Introduction has exactly one terminal outcome. A completed Introduction can never also carry an INTRODUCTION_ENDED fact.';
    END IF;
    -- NO CLOSED-VIEW ENTITLEMENT ON SUCCESS: nothing closed, so nothing froze.
    IF EXISTS (SELECT 1 FROM public.introduction_closed_view_entitlements ent
                WHERE ent.world_id = NEW.world_id) THEN
      RAISE EXCEPTION 'INTRODUCTION_TERMINAL_ENTITLEMENT_INCOHERENT'
        USING ERRCODE='55000', DETAIL='A completed Introduction freezes no closed-view entitlement: the World is still ACTIVE and ordinary Standard history applies.';
    END IF;
  ELSE
    -- END: the SAME World is archived, both episodes close at this instant and
    -- each matched human carries exactly one frozen entitlement.
    IF world.lifecycle <> 'READ_ONLY_CLOSED' OR world.phase <> 'INTRODUCTION'
       OR world.closed_at IS DISTINCT FROM NEW.committed_at THEN
      RAISE EXCEPTION 'INTRODUCTION_TERMINAL_WORLD_INCOHERENT'
        USING ERRCODE='55000', DETAIL='An ended Introduction leaves the SAME World READ_ONLY_CLOSED / INTRODUCTION, closed at the terminal instant.';
    END IF;
    SELECT count(*)::integer INTO closed_episodes
      FROM public.shared_world_membership_episodes e
     WHERE e.world_id = NEW.world_id AND e.ended_at = NEW.committed_at AND e.end_reason = 'WORLD_CLOSED';
    IF open_episodes <> 0 OR closed_episodes <> 2
       OR (SELECT count(*) FROM public.shared_world_membership_episodes e WHERE e.world_id = NEW.world_id) <> 2 THEN
      RAISE EXCEPTION 'INTRODUCTION_TERMINAL_MEMBERSHIP_INCOHERENT'
        USING ERRCODE='55000', DETAIL='An ended Introduction closes exactly the two matched membership episodes at the terminal instant with WORLD_CLOSED, and leaves none open.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.introduction_ended_events ev
                    WHERE ev.introduction_record_id = NEW.introduction_record_id
                      AND ev.world_id = NEW.world_id
                      AND ev.actor_user_id = NEW.ending_actor_user_id
                      AND ev.occurred_at = NEW.committed_at) THEN
      RAISE EXCEPTION 'INTRODUCTION_TERMINAL_FACT_INCOHERENT'
        USING ERRCODE='55000', DETAIL='An ended Introduction carries exactly one INTRODUCTION_ENDED fact naming the exact ending human at the terminal instant.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.introduction_completed_events ev
                WHERE ev.introduction_record_id = NEW.introduction_record_id) THEN
      RAISE EXCEPTION 'INTRODUCTION_TERMINAL_OUTCOME_IS_HYBRID'
        USING ERRCODE='55000', DETAIL='An Introduction has exactly one terminal outcome. An ended Introduction can never also carry an INTRODUCTION_COMPLETED fact.';
    END IF;
    -- EXACTLY ONE ENTITLEMENT PER MATCHED HUMAN, frozen at this instant. Its
    -- ITEM set may legitimately be empty, and is not counted here.
    SELECT count(*)::integer INTO entitlements
      FROM public.introduction_closed_view_entitlements ent
     WHERE ent.world_id = NEW.world_id AND ent.entitled_at = NEW.committed_at
       AND ent.introduction_record_id = NEW.introduction_record_id
       AND ent.user_id IN (NEW.lower_user_id, NEW.higher_user_id);
    IF entitlements <> 2
       OR (SELECT count(*) FROM public.introduction_closed_view_entitlements ent
            WHERE ent.world_id = NEW.world_id) <> 2 THEN
      RAISE EXCEPTION 'INTRODUCTION_TERMINAL_ENTITLEMENT_INCOHERENT'
        USING ERRCODE='55000', DETAIL='An ended Introduction freezes exactly one closed-view entitlement per matched human, at the terminal instant, and none for anybody else.';
    END IF;
    -- No Standard WORLD_ENDED fact is fabricated for an Introduction END.
    IF EXISTS (SELECT 1 FROM public.shared_world_ended_events ev WHERE ev.world_id = NEW.world_id) THEN
      RAISE EXCEPTION 'INTRODUCTION_TERMINAL_FACT_INCOHERENT'
        USING ERRCODE='55000', DETAIL='An Introduction END never fabricates the Standard WORLD_ENDED fact: that belongs to unanimous Standard governance closure.';
    END IF;
  END IF;

  -- BOTH CLAIMS ARE RELEASED AT EXACTLY THIS INSTANT, in both outcomes. A
  -- terminal commit that left one HELD cannot exist.
  IF (SELECT count(*) FROM public.matching_active_introduction_claims c
       WHERE c.introduction_record_id = NEW.introduction_record_id) <> 2
     OR EXISTS (SELECT 1 FROM public.matching_active_introduction_claims c
                 WHERE c.introduction_record_id = NEW.introduction_record_id
                   AND (c.claim_state <> 'RELEASED' OR c.released_at IS DISTINCT FROM NEW.committed_at)) THEN
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_CLAIM_INCOHERENT'
      USING ERRCODE='55000', DETAIL='A terminal Introduction commit releases exactly both of its claims, at exactly the terminal instant. Neither may remain HELD.';
  END IF;

  SELECT * INTO match_row FROM public.matching_match_commits c WHERE c.id = NEW.match_commit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_RECORD_INCOHERENT'
      USING ERRCODE='55000', DETAIL='A terminal commit binds the exact Match commit that created this Introduction.';
  END IF;

  -- THE POST-TERMINAL PARTICIPATION TRUTH, for each exact human.
  FOR human, act_id IN
    SELECT h, a FROM unnest(ARRAY[NEW.lower_user_id, NEW.higher_user_id],
                            ARRAY[NEW.lower_participation_event_id, NEW.higher_participation_event_id]) AS t(h, a)
  LOOP
    -- The exact ACTIVE_INTRODUCTION pause this human received at the Match.
    expected_pause := CASE WHEN human = match_row.first_recipient_user_id
                           THEN match_row.first_recipient_pause_event_id
                           ELSE match_row.candidate_pause_event_id END;
    SELECT e.* INTO current_act
      FROM public.matching_participation_state s
      JOIN public.matching_participation_events e ON e.id = s.current_event_id
     WHERE s.participant_user_id = human;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INTRODUCTION_TERMINAL_PARTICIPATION_INCOHERENT'
        USING ERRCODE='55000', DETAIL='Every matched human has a current Matching participation pointer, because being matched required an ACTIVE one.';
    END IF;
    IF act_id IS NULL THEN
      -- NO TRANSITION WAS WRITTEN: this human had explicitly turned Matching
      -- OFF, and an explicit opt-out is left exactly as it is.
      IF current_act.resulting_state <> 'OFF'
         OR current_act.prior_event_id IS DISTINCT FROM expected_pause THEN
        RAISE EXCEPTION 'INTRODUCTION_TERMINAL_PARTICIPATION_INCOHERENT'
          USING ERRCODE='55000', DETAIL='A terminal commit writes no participation act for a human only when that human is explicitly OFF over the exact ACTIVE_INTRODUCTION pause of this Introduction.';
      END IF;
    ELSE
      SELECT * INTO act_row FROM public.matching_participation_events e WHERE e.id = act_id;
      IF NOT FOUND OR act_row.participant_user_id <> human
         OR act_row.participation_act <> 'PAUSE' OR act_row.resulting_state <> 'PAUSED'
         OR act_row.occurred_at <> NEW.committed_at
         OR act_row.prior_event_id IS DISTINCT FROM expected_pause
         OR act_row.resulting_pause_reason <> (CASE WHEN NEW.terminal_outcome = 'COMPLETED'
                                                    THEN 'POST_SUCCESS' ELSE 'POST_INTRODUCTION' END)
         OR current_act.id <> act_id THEN
        RAISE EXCEPTION 'INTRODUCTION_TERMINAL_PARTICIPATION_INCOHERENT'
          USING ERRCODE='55000', DETAIL='A post-terminal pause is that exact human''s PAUSE act at the terminal instant, carrying the outcome''s exact reserved reason, superseding the exact ACTIVE_INTRODUCTION pause of this Introduction, and named by their current pointer.';
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END$$;

ALTER FUNCTION public.introduction_terminal_commit_truth_v1() OWNER TO postgres;

CREATE TRIGGER introduction_terminal_commits_truth
    BEFORE INSERT ON public.introduction_terminal_commits
    FOR EACH ROW EXECUTE FUNCTION public.introduction_terminal_commit_truth_v1();

-- ---------------------------------------------------------------------------
-- 10. THE FAIL-CLOSED CW2-08 SEAM FOR THE SUCCESS COMMIT.
--
--     SUCCESS is a continuation capability and requires exactly CLEARED as its
--     LAST gate. END is an EXIT and has no seam at all - deliberately, and the
--     terminal self-assertion proves the END core reads none.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_introduction_success_prerequisites_v1(p_introduction_record_id uuid)
RETURNS TABLE(clearance text, basis text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RETURN QUERY SELECT 'NOT_EVALUATED'::text,
    ('CW2-08 safety, moderation, entitlement, feature and Launch Gate evaluation has no canonical '
     || 'runtime in this repository, so the Introduction success transition is not cleared.')::text;
END$$;

ALTER FUNCTION public.resolve_introduction_success_prerequisites_v1(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.resolve_introduction_success_prerequisites_v1(uuid) IS
  'The CW2-08 prerequisite seam for the Introduction SUCCESS commit. Its only '
  'answer is NOT_EVALUATED, and the commit requires exactly CLEARED from it as '
  'its LAST gate, after both human approvals have been proven current. The END '
  'core consults no seam at all: a human must always be able to leave.';

-- ---------------------------------------------------------------------------
-- 11. PREPARE THE EXACT SUCCESS TRANSITION VERSION.
--
--     QANDEEL may propose the transition. This is that proposal, and it is NOT
--     authority: it creates an immutable version and derives its exact
--     required approver set, and it reserves, approves and changes nothing.
--     There is no actor at all - a proposal is not a consent act, and deriving
--     one would let a proposer look like a party to the decision.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.prepare_introduction_success_transition_v1(
  p_transition_version_id uuid, p_world_id uuid
) RETURNS TABLE(outcome text, prepared_transition_version_id uuid, prepared_world_id uuid,
                prepared_introduction_record_id uuid, prepared_required_approver_count integer,
                prepared_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.introduction_success_transition_versions;
  world public.shared_worlds;
  record_row public.introduction_records;
  approvers integer;
  prepare_instant timestamptz;
BEGIN
  IF p_transition_version_id IS NULL OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, over immutable columns
  -- only, so an equivalent retry is answered even after the Introduction has
  -- reached a terminal outcome.
  SELECT * INTO committed FROM public.introduction_success_transition_versions v
   WHERE v.id = p_transition_version_id;
  IF FOUND THEN
    IF committed.world_id = p_world_id THEN
      SELECT count(*)::integer INTO approvers
        FROM public.introduction_success_required_approvers ra
       WHERE ra.transition_version_id = committed.id;
      RETURN QUERY SELECT 'SUCCESS_TRANSITION_PREPARED'::text, committed.id, committed.world_id,
                          committed.introduction_record_id, approvers, committed.created_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP A: the exact World row, before anything else.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.introduction_success_transition_versions v
   WHERE v.id = p_transition_version_id;
  IF FOUND THEN
    IF committed.world_id = p_world_id THEN
      SELECT count(*)::integer INTO approvers
        FROM public.introduction_success_required_approvers ra
       WHERE ra.transition_version_id = committed.id;
      RETURN QUERY SELECT 'SUCCESS_TRANSITION_PREPARED'::text, committed.id, committed.world_id,
                          committed.introduction_record_id, approvers, committed.created_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'INTRODUCTION' THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP B: the exact Introduction Record of that World.
  SELECT * INTO record_row FROM public.introduction_records r
   WHERE r.world_id = p_world_id FOR UPDATE;
  IF NOT FOUND OR record_row.introduction_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  prepare_instant := clock_timestamp();

  BEGIN
    INSERT INTO public.introduction_success_transition_versions
      (id, introduction_record_id, world_id, created_at)
    VALUES (p_transition_version_id, record_row.id, p_world_id, prepare_instant);

    -- THE DERIVED REQUIRED APPROVER SET: exactly the two matched humans of the
    -- exact Introduction Record. Never a caller-supplied list, never World
    -- membership, and never QANDEEL - a system actor is not a consent provider.
    INSERT INTO public.introduction_success_required_approvers (transition_version_id, approver_user_id)
    SELECT p_transition_version_id, h.matched
      FROM unnest(ARRAY[record_row.lower_user_id, record_row.higher_user_id]) AS h(matched);
    GET DIAGNOSTICS approvers = ROW_COUNT;
    IF approvers <> 2 THEN
      RAISE EXCEPTION 'INTRODUCTION_SUCCESS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'SUCCESS_TRANSITION_PREPARED'::text, p_transition_version_id, p_world_id,
                      record_row.id, approvers, prepare_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 12. THE HUMAN APPROVAL CORE - one act, one exact human, one exact version.
--
--     The approving human is exactly the session subject, derived rather than
--     supplied: there is no actor parameter, no approver parameter and no
--     instant parameter, so no caller - QANDEEL included, and including a
--     future launch-gated wrapper - can manufacture or withdraw a human's
--     consent.
--
--     Both acts take the SAME World-first order as the terminal commit, which
--     is what makes the two serialize: an approval that begins before an END
--     but waits behind the World lock observes the closed Introduction and
--     writes nothing, and a withdrawal that wins the World lock before a
--     success commit makes that commit observe a missing current approval.
--
--     `p_expected_current_event_id` is an exact stale token, not an authority:
--     NULL means "I have never acted on this exact version". A mismatch is a
--     bounded stale-state refusal rather than a silent overwrite, so two
--     concurrent acts by one human cannot lose one another.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.record_introduction_success_approval_core_v1(
  p_command_id uuid, p_transition_version_id uuid, p_expected_current_event_id uuid, p_act text
) RETURNS TABLE(outcome text, approval_event_id uuid, approved_transition_version_id uuid,
                approval_state text, superseded_event_id uuid, approval_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.introduction_success_approval_events;
  version public.introduction_success_transition_versions;
  world public.shared_worlds;
  record_row public.introduction_records;
  current_id uuid;
  current_act public.introduction_success_approval_events;
  resulting text;
  approval_instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_transition_version_id IS NULL OR p_act NOT IN ('APPROVE', 'WITHDRAW') THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  resulting := CASE p_act WHEN 'APPROVE' THEN 'APPROVED' ELSE 'WITHDRAWN' END;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, over immutable columns
  -- only. An equivalent retry by the same exact human is answered from history
  -- even after the Introduction has ended.
  SELECT * INTO committed FROM public.introduction_success_approval_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.transition_version_id = p_transition_version_id AND committed.approver_user_id = u
       AND committed.approval_act = p_act
       AND committed.prior_event_id IS NOT DISTINCT FROM p_expected_current_event_id THEN
      RETURN QUERY SELECT 'SUCCESS_APPROVAL_RECORDED'::text, committed.id, committed.transition_version_id,
                          committed.resulting_state, committed.prior_event_id, committed.occurred_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- WORLD-FIRST ORDER. Only enough of the version is pre-read to discover which
  -- World this approval belongs to; the version itself is never locked first.
  SELECT * INTO version FROM public.introduction_success_transition_versions v
   WHERE v.id = p_transition_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP A: the exact World row.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = version.world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.introduction_success_approval_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.transition_version_id = p_transition_version_id AND committed.approver_user_id = u
       AND committed.approval_act = p_act
       AND committed.prior_event_id IS NOT DISTINCT FROM p_expected_current_event_id THEN
      RETURN QUERY SELECT 'SUCCESS_APPROVAL_RECORDED'::text, committed.id, committed.transition_version_id,
                          committed.resulting_state, committed.prior_event_id, committed.occurred_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- AN APPROVAL IS ONLY MEANINGFUL WHILE THE INTRODUCTION IS STILL LIVE. An
  -- approval that waited behind the World lock while an END committed observes
  -- the closed Introduction here and writes nothing at all.
  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'INTRODUCTION' THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP B: the exact Introduction Record.
  SELECT * INTO record_row FROM public.introduction_records r
   WHERE r.id = version.introduction_record_id FOR UPDATE;
  IF NOT FOUND OR record_row.world_id <> world.id OR record_row.introduction_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- ONLY A REQUIRED HUMAN OF THIS EXACT VERSION MAY ACT. A stranger, the other
  -- human's would-be proxy and a human of a different Introduction all reach the
  -- same bounded class, so this is not a membership oracle.
  IF NOT EXISTS (SELECT 1 FROM public.introduction_success_required_approvers ra
                  WHERE ra.transition_version_id = p_transition_version_id
                    AND ra.approver_user_id = u) THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP D: this human's own current approval pointer.
  SELECT s.current_event_id INTO current_id
    FROM public.introduction_success_approval_state s
   WHERE s.transition_version_id = p_transition_version_id AND s.approver_user_id = u FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_event_id THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_STALE_STATE' USING ERRCODE='40001';
  END IF;
  IF current_id IS NOT NULL THEN
    SELECT * INTO current_act FROM public.introduction_success_approval_events e WHERE e.id = current_id;
    IF current_act.resulting_state = resulting THEN
      RAISE EXCEPTION 'INTRODUCTION_SUCCESS_APPROVAL_UNCHANGED' USING ERRCODE='55000',
        DETAIL='This human already holds exactly this approval state over this exact success transition version.';
    END IF;
  ELSIF p_act = 'WITHDRAW' THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_APPROVAL_UNCHANGED' USING ERRCODE='55000',
      DETAIL='There is no approval to withdraw: this human has never acted on this exact success transition version.';
  END IF;

  approval_instant := clock_timestamp();

  BEGIN
    INSERT INTO public.introduction_success_approval_events
      (id, transition_version_id, approver_user_id, approval_act, resulting_state, prior_event_id, occurred_at)
    VALUES (p_command_id, p_transition_version_id, u, p_act, resulting, p_expected_current_event_id,
            approval_instant);

    IF p_expected_current_event_id IS NULL THEN
      INSERT INTO public.introduction_success_approval_state
        (transition_version_id, approver_user_id, current_event_id, updated_at)
      VALUES (p_transition_version_id, u, p_command_id, approval_instant);
    ELSE
      UPDATE public.introduction_success_approval_state s
         SET current_event_id = p_command_id, updated_at = approval_instant
       WHERE s.transition_version_id = p_transition_version_id AND s.approver_user_id = u
         AND s.current_event_id = p_expected_current_event_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'INTRODUCTION_SUCCESS_STALE_STATE' USING ERRCODE='40001';
      END IF;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'SUCCESS_APPROVAL_RECORDED'::text, p_command_id, p_transition_version_id,
                      resulting, p_expected_current_event_id, approval_instant;
END$$;

-- The two named human acts. The act is a LITERAL here rather than something a
-- caller chooses, so no client can record a withdrawal under an approval
-- identity or the reverse.
CREATE FUNCTION public.approve_introduction_success_v1(
  p_command_id uuid, p_transition_version_id uuid, p_expected_current_event_id uuid DEFAULT NULL
) RETURNS TABLE(outcome text, approval_event_id uuid, approved_transition_version_id uuid,
                approval_state text, superseded_event_id uuid, approval_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RETURN QUERY
    SELECT c.outcome, c.approval_event_id, c.approved_transition_version_id,
           c.approval_state, c.superseded_event_id, c.approval_at
      FROM public.record_introduction_success_approval_core_v1(
             p_command_id, p_transition_version_id, p_expected_current_event_id, 'APPROVE') c;
END$$;

CREATE FUNCTION public.withdraw_introduction_success_approval_v1(
  p_command_id uuid, p_transition_version_id uuid, p_expected_current_event_id uuid
) RETURNS TABLE(outcome text, approval_event_id uuid, approved_transition_version_id uuid,
                approval_state text, superseded_event_id uuid, approval_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RETURN QUERY
    SELECT c.outcome, c.approval_event_id, c.approved_transition_version_id,
           c.approval_state, c.superseded_event_id, c.approval_at
      FROM public.record_introduction_success_approval_core_v1(
             p_command_id, p_transition_version_id, p_expected_current_event_id, 'WITHDRAW') c;
END$$;

-- ---------------------------------------------------------------------------
-- 13. THE SUCCESS COMMIT - system execution, human authority.
--
--     There is NO actor parameter and NO derived actor: the authority IS the
--     exact pair of current human approvals over the exact transition version,
--     exactly as the frozen I-04F grant commit and I-04E governed mutations
--     derive no actor. System execution does not manufacture either approval;
--     it may only execute BECAUSE both already exist.
--
--     Under serialization it revalidates: the World is ACTIVE / INTRODUCTION,
--     the Record is ACTIVE and is this version's, both matched humans, both
--     open episodes, both current approval pointers APPROVED over THIS exact
--     version, both claims HELD and of this record, no prior terminal commit,
--     and the CW2-08 prerequisite CLEARED - last.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_introduction_success_v1(
  p_command_id uuid, p_transition_version_id uuid,
  p_lower_participation_event_id uuid, p_higher_participation_event_id uuid
) RETURNS TABLE(outcome text, terminal_command_id uuid, terminal_record_id uuid,
                terminal_world_id uuid, terminal_result text, released_claim_count integer,
                participation_transition_count integer, terminal_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.introduction_terminal_commits;
  version public.introduction_success_transition_versions;
  world public.shared_worlds;
  record_row public.introduction_records;
  match_row public.matching_match_commits;
  gate record;
  request text;
  lo uuid;
  hi uuid;
  lower_claim uuid;
  higher_claim uuid;
  lower_event uuid;
  higher_event uuid;
  transitions integer := 0;
  affected integer;
  human uuid;
  supplied uuid;
  written uuid;
  expected_pause uuid;
  current_act public.matching_participation_events;
  terminal_instant timestamptz;
BEGIN
  IF p_command_id IS NULL OR p_transition_version_id IS NULL
     OR p_lower_participation_event_id IS NULL OR p_higher_participation_event_id IS NULL
     OR p_lower_participation_event_id = p_higher_participation_event_id THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_INTRODUCTION_SUCCESS_COMMIT_REQUEST_V1' || E'\n'
   || 'transitionVersion=' || lower(p_transition_version_id::text) || E'\n'
   || 'lowerParticipationEvent=' || lower(p_lower_participation_event_id::text) || E'\n'
   || 'higherParticipationEvent=' || lower(p_higher_participation_event_id::text), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, answered ENTIRELY from
  -- the committed row. A retry after later Standard World changes - including a
  -- later Standard closure - still answers the original terminal result,
  -- because nothing on this path reads live World state.
  SELECT * INTO committed FROM public.introduction_terminal_commits c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.terminal_outcome = 'COMPLETED'
       AND committed.success_transition_version_id = p_transition_version_id
       AND committed.request_ref = request THEN
      RETURN QUERY SELECT 'INTRODUCTION_COMPLETED'::text, committed.id, committed.introduction_record_id,
                          committed.world_id, committed.terminal_outcome, 2,
                          (CASE WHEN committed.lower_participation_event_id IS NULL THEN 0 ELSE 1 END)
                          + (CASE WHEN committed.higher_participation_event_id IS NULL THEN 0 ELSE 1 END),
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT * INTO version FROM public.introduction_success_transition_versions v
   WHERE v.id = p_transition_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP A: the exact Shared World row, FIRST.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = version.world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.introduction_terminal_commits c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.terminal_outcome = 'COMPLETED'
       AND committed.success_transition_version_id = p_transition_version_id
       AND committed.request_ref = request THEN
      RETURN QUERY SELECT 'INTRODUCTION_COMPLETED'::text, committed.id, committed.introduction_record_id,
                          committed.world_id, committed.terminal_outcome, 2,
                          (CASE WHEN committed.lower_participation_event_id IS NULL THEN 0 ELSE 1 END)
                          + (CASE WHEN committed.higher_participation_event_id IS NULL THEN 0 ELSE 1 END),
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'INTRODUCTION' THEN
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_ALREADY_SETTLED' USING ERRCODE='55000',
      DETAIL='This Introduction is no longer live. Exactly one terminal outcome may commit, and it is already decided.';
  END IF;

  -- CANONICAL LOCK ORDER, STEP B: the exact Introduction Record / terminal identity.
  SELECT * INTO record_row FROM public.introduction_records r
   WHERE r.id = version.introduction_record_id FOR UPDATE;
  IF NOT FOUND OR record_row.world_id <> world.id THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF record_row.introduction_status <> 'ACTIVE'
     OR EXISTS (SELECT 1 FROM public.introduction_terminal_commits t
                 WHERE t.introduction_record_id = record_row.id) THEN
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_ALREADY_SETTLED' USING ERRCODE='55000',
      DETAIL='This Introduction already reached its one terminal outcome.';
  END IF;
  lo := record_row.lower_user_id;
  hi := record_row.higher_user_id;

  -- CANONICAL LOCK ORDER, STEP C: BOTH humans' Matching serialization rows, in
  -- canonical ASCENDING user-id order, through the frozen I-07B helper. Never
  -- in role order and never in pair direction order, so a concurrent END by
  -- either human cannot deadlock against this.
  PERFORM public.lock_matching_pair_humans_v1(lo, hi);

  -- CANONICAL LOCK ORDER, STEP D: the exact membership episodes, the approval
  -- pointers, the participation pointers and the HELD claims, each in
  -- deterministic identity order.
  PERFORM 1 FROM public.shared_world_membership_episodes e
   WHERE e.world_id = world.id ORDER BY e.id FOR UPDATE;
  SELECT count(*)::integer INTO affected
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = world.id AND e.ended_at IS NULL AND e.user_id IN (lo, hi);
  IF affected <> 2
     OR (SELECT count(*) FROM public.shared_world_membership_episodes e
          WHERE e.world_id = world.id AND e.ended_at IS NULL) <> 2 THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  PERFORM 1 FROM public.introduction_success_approval_state s
   WHERE s.transition_version_id = p_transition_version_id ORDER BY s.approver_user_id FOR UPDATE;

  -- BOTH EXACT CURRENT APPROVALS, over THIS exact version. A withdrawn or
  -- absent approval is not approval, and an approval of a different version is
  -- structurally a different row that this query cannot see.
  SELECT count(*)::integer INTO affected
    FROM public.introduction_success_approval_state s
    JOIN public.introduction_success_approval_events e ON e.id = s.current_event_id
   WHERE s.transition_version_id = p_transition_version_id
     AND s.approver_user_id IN (lo, hi)
     AND e.resulting_state = 'APPROVED';
  IF affected <> 2 THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_APPROVALS_INCOMPLETE' USING ERRCODE='55000',
      DETAIL='A successful Introduction requires BOTH matched humans to hold a CURRENT approval over this exact transition version.';
  END IF;

  PERFORM 1 FROM public.matching_participation_state s
   WHERE s.participant_user_id IN (lo, hi) ORDER BY s.participant_user_id FOR UPDATE;

  SELECT c.id INTO lower_claim FROM public.matching_active_introduction_claims c
   WHERE c.introduction_record_id = record_row.id AND c.user_id = lo AND c.claim_state = 'HELD' FOR UPDATE;
  SELECT c.id INTO higher_claim FROM public.matching_active_introduction_claims c
   WHERE c.introduction_record_id = record_row.id AND c.user_id = hi AND c.claim_state = 'HELD' FOR UPDATE;
  IF lower_claim IS NULL OR higher_claim IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO match_row FROM public.matching_match_commits c WHERE c.id = record_row.match_commit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- THE CW2-08 PREREQUISITE, LAST - after both human approvals have been proven
  -- current, so a refusal here can never be read as an authority answer.
  SELECT * INTO gate FROM public.resolve_introduction_success_prerequisites_v1(record_row.id);
  IF gate.clearance <> 'CLEARED' THEN
    RAISE EXCEPTION 'INTRODUCTION_SUCCESS_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL='The Introduction success transition requires the CW2-08 system/safety prerequisite to be CLEARED. It is not, and the transition fails closed.';
  END IF;

  -- THE ONE canonical terminal instant, read AFTER every lock wait and every
  -- currentness check, immediately before the irreversible writes.
  terminal_instant := clock_timestamp();

  BEGIN
    -- THE SAME WORLD CONTINUES, now Standard. Same id, same history, same
    -- provenance, same two open episodes, no closure instant.
    UPDATE public.shared_worlds w SET phase = 'STANDARD' WHERE w.id = world.id;

    UPDATE public.introduction_records r
       SET introduction_status = 'COMPLETED', ended_at = terminal_instant
     WHERE r.id = record_row.id AND r.introduction_status = 'ACTIVE';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'INTRODUCTION_SUCCESS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.introduction_completed_events
      (introduction_record_id, world_id, success_transition_version_id, occurred_at)
    VALUES (record_row.id, world.id, p_transition_version_id, terminal_instant);

    -- BOTH CLAIMS RELEASED, at the same instant. A terminal commit can never
    -- leave one HELD, and a release can never happen without one.
    UPDATE public.matching_active_introduction_claims c
       SET claim_state = 'RELEASED', released_at = terminal_instant
     WHERE c.id IN (lower_claim, higher_claim) AND c.claim_state = 'HELD';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 2 THEN
      RAISE EXCEPTION 'INTRODUCTION_SUCCESS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- THE POST-TERMINAL PARTICIPATION TRANSITION, for each exact human.
    FOR human, supplied IN
      SELECT h, s FROM unnest(ARRAY[lo, hi],
                              ARRAY[p_lower_participation_event_id, p_higher_participation_event_id]) AS t(h, s)
    LOOP
      expected_pause := CASE WHEN human = match_row.first_recipient_user_id
                             THEN match_row.first_recipient_pause_event_id
                             ELSE match_row.candidate_pause_event_id END;
      SELECT e.* INTO current_act
        FROM public.matching_participation_state s
        JOIN public.matching_participation_events e ON e.id = s.current_event_id
       WHERE s.participant_user_id = human;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'INTRODUCTION_SUCCESS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      written := NULL;
      IF current_act.resulting_state = 'PAUSED'
         AND current_act.resulting_pause_reason = 'ACTIVE_INTRODUCTION'
         AND current_act.id = expected_pause THEN
        INSERT INTO public.matching_participation_events
          (id, participant_user_id, participation_act, resulting_state, resulting_pause_reason,
           activation_entry_channel, prior_event_id, occurred_at)
        VALUES (supplied, human, 'PAUSE', 'PAUSED', 'POST_SUCCESS', NULL, expected_pause, terminal_instant);
        UPDATE public.matching_participation_state s
           SET current_event_id = supplied, updated_at = terminal_instant
         WHERE s.participant_user_id = human AND s.current_event_id = expected_pause;
        GET DIAGNOSTICS affected = ROW_COUNT;
        IF affected <> 1 THEN
          RAISE EXCEPTION 'INTRODUCTION_SUCCESS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
        END IF;
        written := supplied;
        transitions := transitions + 1;
      ELSIF current_act.resulting_state = 'OFF' AND current_act.prior_event_id = expected_pause THEN
        -- AN EXPLICIT OPT-OUT IS LEFT EXACTLY AS IT IS. No post-* pause is
        -- manufactured over a human's own decision to turn Matching off.
        written := NULL;
      ELSE
        -- ANY OTHER CURRENT STATE IS CONTRADICTORY OR STALE, and is refused
        -- rather than silently forced into another state.
        RAISE EXCEPTION 'INTRODUCTION_TERMINAL_PARTICIPATION_CONTRADICTORY' USING ERRCODE='P0001',
          DETAIL='A matched human at a terminal Introduction is either still paused for this exact Introduction or explicitly OFF over it. No other current participation state is transitioned.';
      END IF;
      IF human = lo THEN lower_event := written; ELSE higher_event := written; END IF;
    END LOOP;

    -- THE ONE TERMINAL WINNER, last, after every effect exists. Its truth
    -- trigger proves the whole transaction, and its UNIQUE key is what makes
    -- exactly one terminal outcome survive.
    INSERT INTO public.introduction_terminal_commits
      (id, introduction_record_id, world_id, match_commit_id, terminal_outcome,
       lower_user_id, higher_user_id, ending_actor_user_id, success_transition_version_id,
       lower_claim_id, higher_claim_id, lower_participation_event_id, higher_participation_event_id,
       request_ref, committed_at)
    VALUES (p_command_id, record_row.id, world.id, record_row.match_commit_id, 'COMPLETED',
            lo, hi, NULL, p_transition_version_id, lower_claim, higher_claim,
            lower_event, higher_event, request, terminal_instant);
  EXCEPTION WHEN unique_violation THEN
    -- The whole transition rolls back together, so a refused commit never
    -- leaves a half-completed Introduction behind.
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'INTRODUCTION_COMPLETED'::text, p_command_id, record_row.id, world.id,
                      'COMPLETED'::text, 2, transitions, terminal_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 14. THE UNILATERAL END COMMIT.
--
--     The ending human is exactly `auth.uid()`, derived and never supplied.
--     There is no counterpart approval, no proposal, no waiting period and NO
--     system/safety seam: a human must always be able to leave.
--
--     It snapshots each matched human's exact visible history through the ONE
--     canonical visibility entry point WHILE the World is still ACTIVE and both
--     episodes are still open - so the frozen set is genuinely "what they could
--     see immediately before closure" - and only then closes anything.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_introduction_end_v1(
  p_command_id uuid, p_world_id uuid,
  p_lower_participation_event_id uuid, p_higher_participation_event_id uuid
) RETURNS TABLE(outcome text, terminal_command_id uuid, terminal_record_id uuid,
                terminal_world_id uuid, terminal_result text, released_claim_count integer,
                participation_transition_count integer, terminal_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.introduction_terminal_commits;
  world public.shared_worlds;
  record_row public.introduction_records;
  match_row public.matching_match_commits;
  request text;
  lo uuid;
  hi uuid;
  lower_claim uuid;
  higher_claim uuid;
  lower_event uuid;
  higher_event uuid;
  transitions integer := 0;
  affected integer;
  human uuid;
  supplied uuid;
  written uuid;
  expected_pause uuid;
  current_act public.matching_participation_events;
  terminal_instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_END_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL
     OR p_lower_participation_event_id IS NULL OR p_higher_participation_event_id IS NULL
     OR p_lower_participation_event_id = p_higher_participation_event_id THEN
    RAISE EXCEPTION 'INTRODUCTION_END_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_INTRODUCTION_END_COMMIT_REQUEST_V1' || E'\n'
   || 'world=' || lower(p_world_id::text) || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'lowerParticipationEvent=' || lower(p_lower_participation_event_id::text) || E'\n'
   || 'higherParticipationEvent=' || lower(p_higher_participation_event_id::text), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: answered ENTIRELY from the committed row.
  SELECT * INTO committed FROM public.introduction_terminal_commits c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.terminal_outcome = 'CLOSED' AND committed.world_id = p_world_id
       AND committed.ending_actor_user_id = u AND committed.request_ref = request THEN
      RETURN QUERY SELECT 'INTRODUCTION_ENDED'::text, committed.id, committed.introduction_record_id,
                          committed.world_id, committed.terminal_outcome, 2,
                          (CASE WHEN committed.lower_participation_event_id IS NULL THEN 0 ELSE 1 END)
                          + (CASE WHEN committed.higher_participation_event_id IS NULL THEN 0 ELSE 1 END),
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP A: the exact Shared World row, FIRST.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTRODUCTION_END_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.introduction_terminal_commits c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.terminal_outcome = 'CLOSED' AND committed.world_id = p_world_id
       AND committed.ending_actor_user_id = u AND committed.request_ref = request THEN
      RETURN QUERY SELECT 'INTRODUCTION_ENDED'::text, committed.id, committed.introduction_record_id,
                          committed.world_id, committed.terminal_outcome, 2,
                          (CASE WHEN committed.lower_participation_event_id IS NULL THEN 0 ELSE 1 END)
                          + (CASE WHEN committed.higher_participation_event_id IS NULL THEN 0 ELSE 1 END),
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'INTRODUCTION' THEN
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_ALREADY_SETTLED' USING ERRCODE='55000',
      DETAIL='This Introduction is no longer live. Exactly one terminal outcome may commit, and it is already decided.';
  END IF;

  -- CANONICAL LOCK ORDER, STEP B: the exact Introduction Record.
  SELECT * INTO record_row FROM public.introduction_records r
   WHERE r.world_id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTRODUCTION_END_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF record_row.introduction_status <> 'ACTIVE'
     OR EXISTS (SELECT 1 FROM public.introduction_terminal_commits t
                 WHERE t.introduction_record_id = record_row.id) THEN
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_ALREADY_SETTLED' USING ERRCODE='55000',
      DETAIL='This Introduction already reached its one terminal outcome.';
  END IF;

  -- THE ACTOR IS ONE OF THE EXACT TWO MATCHED HUMANS. An outsider reaches the
  -- same bounded class as a World that does not exist, so ending is not an
  -- existence oracle - and the loser of an END-versus-END race is told only
  -- that the Introduction is already settled, never who won.
  lo := record_row.lower_user_id;
  hi := record_row.higher_user_id;
  IF u NOT IN (lo, hi) THEN
    RAISE EXCEPTION 'INTRODUCTION_END_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP C: BOTH humans' Matching serialization rows, in
  -- canonical ASCENDING user-id order - never in the ending human's direction,
  -- so END by A and END by B cannot deadlock against each other or against a
  -- concurrent SUCCESS.
  PERFORM public.lock_matching_pair_humans_v1(lo, hi);

  -- CANONICAL LOCK ORDER, STEP D.
  PERFORM 1 FROM public.shared_world_membership_episodes e
   WHERE e.world_id = world.id ORDER BY e.id FOR UPDATE;
  SELECT count(*)::integer INTO affected
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = world.id AND e.ended_at IS NULL AND e.user_id IN (lo, hi);
  IF affected <> 2
     OR (SELECT count(*) FROM public.shared_world_membership_episodes e
          WHERE e.world_id = world.id AND e.ended_at IS NULL) <> 2 THEN
    RAISE EXCEPTION 'INTRODUCTION_END_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  PERFORM 1 FROM public.matching_participation_state s
   WHERE s.participant_user_id IN (lo, hi) ORDER BY s.participant_user_id FOR UPDATE;

  SELECT c.id INTO lower_claim FROM public.matching_active_introduction_claims c
   WHERE c.introduction_record_id = record_row.id AND c.user_id = lo AND c.claim_state = 'HELD' FOR UPDATE;
  SELECT c.id INTO higher_claim FROM public.matching_active_introduction_claims c
   WHERE c.introduction_record_id = record_row.id AND c.user_id = hi AND c.claim_state = 'HELD' FOR UPDATE;
  IF lower_claim IS NULL OR higher_claim IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_END_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO match_row FROM public.matching_match_commits c WHERE c.id = record_row.match_commit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTRODUCTION_END_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- THERE IS NO SEAM HERE, BY DESIGN. Ending an Introduction is an exit and a
  -- privacy act; a gate that could ever refuse it would make a human unable to
  -- leave, so this core consults none and the deploy-time assertion proves it.

  -- THE ONE canonical terminal instant, read AFTER every lock wait and every
  -- currentness check, immediately before the irreversible writes.
  terminal_instant := clock_timestamp();

  BEGIN
    -- ONE ENTITLEMENT PER EXACT MATCHED HUMAN, written BEFORE any membership is
    -- destroyed, so the entitled set is exactly the two humans who were in it.
    INSERT INTO public.introduction_closed_view_entitlements
      (world_id, user_id, introduction_record_id, membership_episode_id, entitled_at)
    SELECT e.world_id, e.user_id, record_row.id, e.id, terminal_instant
      FROM public.shared_world_membership_episodes e
     WHERE e.world_id = world.id AND e.ended_at IS NULL;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 2 THEN
      RAISE EXCEPTION 'INTRODUCTION_END_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- THE EXACT ITEM SNAPSHOT, resolved through the ONE canonical visibility
    -- entry point while the World is still ACTIVE / INTRODUCTION and both
    -- episodes are still open. A human with nothing visible keeps their
    -- entitlement row and simply contributes no item row.
    INSERT INTO public.introduction_closed_view_entitlement_items (world_id, user_id, history_item_id)
    SELECT ent.world_id, ent.user_id, visible.history_item_id
      FROM public.introduction_closed_view_entitlements ent
      CROSS JOIN LATERAL public.resolve_shared_world_history_visibility_v1(ent.world_id, ent.user_id) visible
     WHERE ent.world_id = world.id;

    -- ARCHIVAL CLOSURE. The World id, phase, history and provenance all remain;
    -- only the lifecycle and the closure instant change.
    UPDATE public.shared_worlds w
       SET lifecycle = 'READ_ONLY_CLOSED', closed_at = terminal_instant
     WHERE w.id = world.id;

    UPDATE public.introduction_records r
       SET introduction_status = 'CLOSED', ended_at = terminal_instant
     WHERE r.id = record_row.id AND r.introduction_status = 'ACTIVE';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'INTRODUCTION_END_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.introduction_ended_events
      (introduction_record_id, world_id, actor_user_id, occurred_at)
    VALUES (record_row.id, world.id, u, terminal_instant);

    -- BOTH open episodes close IN PLACE at the same instant. No episode is
    -- deleted, replaced or rewritten beyond its own ending, so historical
    -- authorship and presence stay exactly as they were.
    UPDATE public.shared_world_membership_episodes e
       SET ended_at = terminal_instant, end_reason = 'WORLD_CLOSED'
     WHERE e.world_id = world.id AND e.ended_at IS NULL;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 2 THEN
      RAISE EXCEPTION 'INTRODUCTION_END_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    UPDATE public.matching_active_introduction_claims c
       SET claim_state = 'RELEASED', released_at = terminal_instant
     WHERE c.id IN (lower_claim, higher_claim) AND c.claim_state = 'HELD';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 2 THEN
      RAISE EXCEPTION 'INTRODUCTION_END_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    FOR human, supplied IN
      SELECT h, s FROM unnest(ARRAY[lo, hi],
                              ARRAY[p_lower_participation_event_id, p_higher_participation_event_id]) AS t(h, s)
    LOOP
      expected_pause := CASE WHEN human = match_row.first_recipient_user_id
                             THEN match_row.first_recipient_pause_event_id
                             ELSE match_row.candidate_pause_event_id END;
      SELECT e.* INTO current_act
        FROM public.matching_participation_state s
        JOIN public.matching_participation_events e ON e.id = s.current_event_id
       WHERE s.participant_user_id = human;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'INTRODUCTION_END_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      written := NULL;
      IF current_act.resulting_state = 'PAUSED'
         AND current_act.resulting_pause_reason = 'ACTIVE_INTRODUCTION'
         AND current_act.id = expected_pause THEN
        INSERT INTO public.matching_participation_events
          (id, participant_user_id, participation_act, resulting_state, resulting_pause_reason,
           activation_entry_channel, prior_event_id, occurred_at)
        VALUES (supplied, human, 'PAUSE', 'PAUSED', 'POST_INTRODUCTION', NULL, expected_pause, terminal_instant);
        UPDATE public.matching_participation_state s
           SET current_event_id = supplied, updated_at = terminal_instant
         WHERE s.participant_user_id = human AND s.current_event_id = expected_pause;
        GET DIAGNOSTICS affected = ROW_COUNT;
        IF affected <> 1 THEN
          RAISE EXCEPTION 'INTRODUCTION_END_CONTRADICTORY_STATE' USING ERRCODE='P0001';
        END IF;
        written := supplied;
        transitions := transitions + 1;
      ELSIF current_act.resulting_state = 'OFF' AND current_act.prior_event_id = expected_pause THEN
        written := NULL;
      ELSE
        RAISE EXCEPTION 'INTRODUCTION_TERMINAL_PARTICIPATION_CONTRADICTORY' USING ERRCODE='P0001',
          DETAIL='A matched human at a terminal Introduction is either still paused for this exact Introduction or explicitly OFF over it. No other current participation state is transitioned.';
      END IF;
      IF human = lo THEN lower_event := written; ELSE higher_event := written; END IF;
    END LOOP;

    INSERT INTO public.introduction_terminal_commits
      (id, introduction_record_id, world_id, match_commit_id, terminal_outcome,
       lower_user_id, higher_user_id, ending_actor_user_id, success_transition_version_id,
       lower_claim_id, higher_claim_id, lower_participation_event_id, higher_participation_event_id,
       request_ref, committed_at)
    VALUES (p_command_id, record_row.id, world.id, record_row.match_commit_id, 'CLOSED',
            lo, hi, u, NULL, lower_claim, higher_claim,
            lower_event, higher_event, request, terminal_instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'INTRODUCTION_TERMINAL_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'INTRODUCTION_ENDED'::text, p_command_id, record_row.id, world.id,
                      'CLOSED'::text, 2, transitions, terminal_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 15. Ownership and THE PRE-LAUNCH ACL. Every consequential primitive here is
--     executable by NO application role, service_role included, because the
--     frozen CW2-08 Launch Gate does not exist. This migration GRANTS NOTHING
--     to anybody.
--
--     The human-action cores still derive their human from `auth.uid()` so
--     I-09 can later expose reviewed wrappers without a service credential
--     manufacturing a human's consent or a human's exit.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_functions text[] := ARRAY[
    'public.prepare_introduction_success_transition_v1(uuid, uuid)',
    'public.record_introduction_success_approval_core_v1(uuid, uuid, uuid, text)',
    'public.approve_introduction_success_v1(uuid, uuid, uuid)',
    'public.withdraw_introduction_success_approval_v1(uuid, uuid, uuid)',
    'public.commit_introduction_success_v1(uuid, uuid, uuid, uuid)',
    'public.commit_introduction_end_v1(uuid, uuid, uuid, uuid)',
    'public.resolve_introduction_success_prerequisites_v1(uuid)'];
  target_function text;
BEGIN
  FOREACH target_function IN ARRAY own_functions LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', target_function);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', target_function);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', target_function);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 16. Terminal self-assertions. The migration refuses to deploy a terminal
--     lifecycle that is application-reachable, hybrid-capable, consent-
--     manufacturing, exit-blocking, lock-disordered, multi-clocked,
--     relationship-inferring or resume-widening.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  prepare_fn text := 'public.prepare_introduction_success_transition_v1(uuid,uuid)';
  core_fn text := 'public.record_introduction_success_approval_core_v1(uuid,uuid,uuid,text)';
  approve_fn text := 'public.approve_introduction_success_v1(uuid,uuid,uuid)';
  withdraw_fn text := 'public.withdraw_introduction_success_approval_v1(uuid,uuid,uuid)';
  success_fn text := 'public.commit_introduction_success_v1(uuid,uuid,uuid,uuid)';
  end_fn text := 'public.commit_introduction_end_v1(uuid,uuid,uuid,uuid)';
  gate_fn text := 'public.resolve_introduction_success_prerequisites_v1(uuid)';
  resume_fn text := 'public.resume_matching_participation_v1(uuid,uuid)';
  own_tables text[] := ARRAY['public.introduction_success_transition_versions',
                             'public.introduction_success_required_approvers',
                             'public.introduction_success_approval_events',
                             'public.introduction_success_approval_state',
                             'public.introduction_completed_events',
                             'public.introduction_ended_events',
                             'public.introduction_terminal_commits'];
  terminal_cores text[] := ARRAY['public.commit_introduction_success_v1(uuid,uuid,uuid,uuid)',
                                 'public.commit_introduction_end_v1(uuid,uuid,uuid,uuid)'];
  p record;
  in_names text[];
  arg_name text;
  fn_name text;
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
  body text;
  world_pos integer;
  record_pos integer;
  pair_pos integer;
  clock_pos integer;
  write_pos integer;
BEGIN
  -- ===================================================================
  -- THE SEVEN NEW RELATIONS: unreachable, policy-free, blob-free, within the
  -- PostgreSQL identifier limit, and carrying NO relationship vocabulary.
  -- ===================================================================
  FOREACH target_table IN ARRAY own_tables LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN RAISE EXCEPTION 'I-07D: row level security must be enabled on %', target_table; END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-07D: no RLS policy may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = target_table::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-07D: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-07D: the terminal substrate stays sealed: % holds % on %',
              target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
    IF length(split_part(target_table, '.', 2)) > 63 THEN
      RAISE EXCEPTION 'I-07D: relation name % exceeds the PostgreSQL 63-byte identifier limit', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint con
                WHERE con.conrelid = target_table::regclass AND length(con.conname) > 63) THEN
      RAISE EXCEPTION 'I-07D: a constraint name on % exceeds the PostgreSQL 63-byte identifier limit', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class idx JOIN pg_index ix ON ix.indexrelid = idx.oid
                WHERE ix.indrelid = target_table::regclass AND length(idx.relname) > 63) THEN
      RAISE EXCEPTION 'I-07D: an index name on % exceeds the PostgreSQL 63-byte identifier limit', target_table;
    END IF;
  END LOOP;

  -- NO RELATIONSHIP, ENGAGEMENT, EXCLUSIVITY OR MARRIAGE INFERENCE. A completed
  -- Introduction means both humans approved continuing in the same Shared World
  -- as Standard, and the vocabulary may say nothing else.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND ('public.' || c.table_name) = ANY(own_tables)
       AND c.column_name ~* '(relationship|engagement|engaged|marriage|married|fiance|spouse|exclusiv|boyfriend|girlfriend|partner_status|legal_status)'
  ) THEN
    RAISE EXCEPTION 'I-07D: a terminal Introduction creates no relationship, engagement, exclusivity, marriage or legal status';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = ANY (ARRAY(SELECT x.name::regclass::oid FROM unnest(own_tables) AS x(name)))
       AND pg_get_constraintdef(c.oid) ~* '(relationship|engagement|marriage|married|fiance|spouse|exclusiv|boyfriend|girlfriend|partner_status|legal_status)'
  ) THEN
    RAISE EXCEPTION 'I-07D: no terminal constraint may encode a relationship, engagement, exclusivity or marriage claim';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND ('public.' || c.table_name) = ANY(own_tables)
       AND c.data_type IN ('json','jsonb','ARRAY','bytea')
  ) THEN
    RAISE EXCEPTION 'I-07D: the terminal substrate is normalized relations, never a universal JSON or binary payload';
  END IF;

  -- THE ONE TERMINAL WINNER IS A UNIQUE KEY, not a procedural comparison.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.introduction_terminal_commits'::regclass
       AND c.conname = 'introduction_terminal_commits_record_key'
       AND c.contype = 'u'
       AND pg_get_constraintdef(c.oid) = 'UNIQUE (introduction_record_id)'
  ) THEN
    RAISE EXCEPTION 'I-07D: one Introduction Record must have at most one terminal commit, by unique key';
  END IF;

  -- ===================================================================
  -- EVERY CONSEQUENTIAL PRIMITIVE: posture and the PRE-LAUNCH BOUNDARY.
  -- ===================================================================
  FOREACH fn_name IN ARRAY ARRAY[prepare_fn, core_fn, approve_fn, withdraw_fn, success_fn, end_fn] LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn_name::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-07D: % must be owned by postgres', fn_name; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-07D: % must be SECURITY DEFINER', fn_name; END IF;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-07D: % mutates or locks and must be VOLATILE', fn_name; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-07D: % must pin an empty search_path', fn_name;
    END IF;
    IF has_function_privilege('public', fn_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-07D: PUBLIC must not execute the Introduction terminal surface before the launch gate exists';
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, fn_name, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-07D: % must not execute the Introduction terminal surface before the launch gate exists', target_role;
      END IF;
    END LOOP;
    IF p.prosrc ~ 'pg_advisory|LOCK TABLE|TRUNCATE' THEN
      RAISE EXCEPTION 'I-07D: % locks rows in the canonical order, never a table, an advisory key or a mutex', fn_name;
    END IF;
    -- NO MATCHING AUTHORITY DEPENDENCY. A terminal Introduction never requires
    -- a Matching Context Grant, an Introduction Profile, a requirement version
    -- or a disclosure authority, and never revokes one.
    IF p.prosrc ~ 'matching_context_grants|pre_match_disclosure|introduction_profile|matching_requirement' THEN
      RAISE EXCEPTION 'I-07D: % must not depend on or mutate Matching setup authority: the Shared World is independent after the Match', fn_name;
    END IF;
    IF p.prosrc ~ 'relationship|engagement|marriage|exclusiv' THEN
      RAISE EXCEPTION 'I-07D: % must infer no relationship or legal status', fn_name;
    END IF;
  END LOOP;

  -- ===================================================================
  -- THE HUMAN ACTS derive their human and accept no actor.
  -- ===================================================================
  FOREACH fn_name IN ARRAY ARRAY[core_fn, end_fn] LOOP
    SELECT pr.prosrc, pr.proargnames, pr.proargmodes INTO p FROM pg_proc pr WHERE pr.oid = fn_name::regprocedure;
    IF p.prosrc !~ 'u uuid := auth\.uid\(\);' THEN
      RAISE EXCEPTION 'I-07D: % must derive its human from the session subject, never from a parameter', fn_name;
    END IF;
    SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i') INTO in_names
      FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
    FOREACH arg_name IN ARRAY in_names LOOP
      IF arg_name ~* 'user_id|actor|human|approver|counterpart|recipient|owner|subject|on_behalf|timestamp|instant|_at$|clock' THEN
        RAISE EXCEPTION 'I-07D: % must not accept %: the acting human is auth.uid()', fn_name, arg_name;
      END IF;
    END LOOP;
  END LOOP;
  -- THE TWO PUBLIC HUMAN ACTS pin their act as a literal, so no caller can
  -- record a withdrawal under an approval identity or the reverse.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = approve_fn::regprocedure;
  IF p.prosrc !~ '''APPROVE''' OR p.prosrc ~ '''WITHDRAW''' THEN
    RAISE EXCEPTION 'I-07D: the approval boundary pins APPROVE as a literal and can spell nothing else';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = withdraw_fn::regprocedure;
  IF p.prosrc !~ '''WITHDRAW''' OR p.prosrc ~ '''APPROVE''' THEN
    RAISE EXCEPTION 'I-07D: the withdrawal boundary pins WITHDRAW as a literal and can spell nothing else';
  END IF;

  -- ===================================================================
  -- THE SUCCESS COMMIT: system execution, never consent manufacture.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes INTO p FROM pg_proc pr WHERE pr.oid = success_fn::regprocedure;
  body := p.prosrc;
  IF body ~ 'auth\.uid' THEN
    RAISE EXCEPTION 'I-07D: the success commit derives no actor: the authority IS the exact pair of current human approvals';
  END IF;
  IF body ~ 'INSERT INTO public\.introduction_success_approval_events'
     OR body ~ 'UPDATE public\.introduction_success_approval_state'
     OR body ~ 'INSERT INTO public\.introduction_success_approval_state'
     OR body ~ 'INSERT INTO public\.introduction_success_required_approvers' THEN
    RAISE EXCEPTION 'I-07D: system execution must never manufacture, move or widen a human approval';
  END IF;
  IF body !~ 'INTRODUCTION_SUCCESS_APPROVALS_INCOMPLETE' THEN
    RAISE EXCEPTION 'I-07D: the success commit must refuse an incomplete current approval set';
  END IF;
  IF body !~ 'e\.resulting_state = ''APPROVED''' THEN
    RAISE EXCEPTION 'I-07D: only a CURRENT approval counts: a withdrawn or superseded act can never contribute';
  END IF;
  IF body !~ 's\.transition_version_id = p_transition_version_id' THEN
    RAISE EXCEPTION 'I-07D: the success commit must read the approvals of exactly the version it commits';
  END IF;
  IF body !~ 'resolve_introduction_success_prerequisites_v1' THEN
    RAISE EXCEPTION 'I-07D: the success commit must consult the CW2-08 prerequisite seam';
  END IF;
  -- AND THE GATE IS LAST, after both approvals have been proven current.
  IF strpos(body, 'INTRODUCTION_SUCCESS_APPROVALS_INCOMPLETE')
     > strpos(body, 'resolve_introduction_success_prerequisites_v1') THEN
    RAISE EXCEPTION 'I-07D: the CW2-08 gate is the LAST gate, after both human approvals are proven current';
  END IF;
  -- SUCCESS CHANGES ONLY THE PHASE: no closure instant, no episode closes, no
  -- entitlement freezes, no Standard closure fact is fabricated.
  IF body ~ 'closed_at|READ_ONLY_CLOSED|WORLD_CLOSED|introduction_closed_view_entitlement|shared_world_ended_events' THEN
    RAISE EXCEPTION 'I-07D: a successful Introduction closes nothing: same World, same episodes, no entitlement, no closure fact';
  END IF;
  IF body !~ 'SET phase = ''STANDARD''' THEN
    RAISE EXCEPTION 'I-07D: a successful Introduction moves the SAME World to ACTIVE / STANDARD';
  END IF;
  IF body ~ 'INSERT INTO public\.shared_worlds|INSERT INTO public\.shared_world_membership_episodes' THEN
    RAISE EXCEPTION 'I-07D: a successful Introduction creates no new World and no new membership episode';
  END IF;

  -- ===================================================================
  -- THE END COMMIT: unilateral, ungated, and archival in the frozen shape.
  -- ===================================================================
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = end_fn::regprocedure;
  body := p.prosrc;
  -- END IS NEVER BLOCKED BY A SYSTEM/SAFETY CLEARANCE.
  IF body ~ 'prerequisite|clearance|CLEARED|NOT_EVALUATED|launch|safety' THEN
    RAISE EXCEPTION 'I-07D: ending an Introduction is an exit and must not depend on any system, safety or launch clearance';
  END IF;
  IF body ~ 'introduction_success_approval|introduction_success_required_approvers|introduction_success_transition_versions' THEN
    RAISE EXCEPTION 'I-07D: a unilateral end requires no counterpart approval and reads no success transition state';
  END IF;
  IF body !~ 'u NOT IN \(lo, hi\)' THEN
    RAISE EXCEPTION 'I-07D: only one of the exact two matched humans may end the Introduction';
  END IF;
  IF body !~ 'resolve_shared_world_history_visibility_v1\(ent\.world_id, ent\.user_id\)' THEN
    RAISE EXCEPTION 'I-07D: the closed-view snapshot must be resolved through the ONE canonical visibility entry point';
  END IF;
  -- THE SNAPSHOT HAPPENS FIRST, while the World is still ACTIVE and both
  -- episodes are still open. Each position is proven PRESENT before it is
  -- compared, so a missing anchor can never satisfy the ordering vacuously.
  world_pos := strpos(body, 'INSERT INTO public.introduction_closed_view_entitlement_items');
  record_pos := strpos(body, 'SET lifecycle = ''READ_ONLY_CLOSED''');
  clock_pos := strpos(body, 'SET ended_at = terminal_instant, end_reason = ''WORLD_CLOSED''');
  IF world_pos = 0 OR record_pos = 0 OR clock_pos = 0
     OR world_pos > record_pos OR world_pos > clock_pos THEN
    RAISE EXCEPTION 'I-07D: each human''s exact visible history is snapshotted BEFORE the World closes and BEFORE their episode ends';
  END IF;
  IF body ~ 'shared_world_ended_events|shared_world_standard_end_commands|shared_world_end_payload_versions' THEN
    RAISE EXCEPTION 'I-07D: an Introduction END never fabricates a Standard WORLD_ENDED fact or closure command';
  END IF;
  IF body ~ 'shared_world_standard_closed_view_entitlement' THEN
    RAISE EXCEPTION 'I-07D: a failed Introduction freezes its OWN entitlement family, never the Standard one';
  END IF;
  IF body !~ 'SET lifecycle = ''READ_ONLY_CLOSED''' OR body ~ 'SET phase' THEN
    RAISE EXCEPTION 'I-07D: an ended Introduction becomes READ_ONLY_CLOSED and keeps its INTRODUCTION phase';
  END IF;

  -- ===================================================================
  -- BOTH TERMINAL CORES: one instant, the published lock order, both claims.
  -- ===================================================================
  FOREACH fn_name IN ARRAY terminal_cores LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn_name::regprocedure;
    body := p.prosrc;
    -- ONE database-owned instant, read once, AFTER every lock wait. The I-07C
    -- lesson: a transaction-fixed clock is settled before the wait begins.
    IF body ~ 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
      RAISE EXCEPTION 'I-07D: % must persist one database-owned instant, never a transaction clock', fn_name;
    END IF;
    IF (length(body) - length(replace(body, 'clock_timestamp()', ''))) / length('clock_timestamp()') <> 1 THEN
      RAISE EXCEPTION 'I-07D: % must read the canonical terminal instant exactly once', fn_name;
    END IF;
    -- THE PUBLISHED CROSS-DOMAIN LOCK ORDER: World, Record, both setup locks in
    -- canonical ascending order, then the one instant, then the terminal write.
    world_pos := strpos(body, 'FROM public.shared_worlds w WHERE w.id = ');
    record_pos := strpos(body, 'FROM public.introduction_records r');
    pair_pos := strpos(body, 'PERFORM public.lock_matching_pair_humans_v1(lo, hi)');
    clock_pos := strpos(body, 'terminal_instant := clock_timestamp()');
    write_pos := strpos(body, 'INSERT INTO public.introduction_terminal_commits');
    IF world_pos = 0 OR record_pos = 0 OR pair_pos = 0 OR clock_pos = 0 OR write_pos = 0
       OR world_pos > record_pos OR record_pos > pair_pos OR pair_pos > clock_pos OR clock_pos > write_pos THEN
      RAISE EXCEPTION 'I-07D: % must take the World, then the exact Introduction Record, then BOTH setup locks in canonical order, then one instant, then the terminal commit last', fn_name;
    END IF;
    -- The two-human lock is the frozen canonical helper, never re-implemented
    -- and never taken in role or direction order.
    IF body ~ 'INSERT INTO public\.matching_setup_locks' THEN
      RAISE EXCEPTION 'I-07D: % must reach both setup locks only through the frozen canonical two-human helper', fn_name;
    END IF;
    IF body !~ 'RELEASED'', released_at = terminal_instant' THEN
      RAISE EXCEPTION 'I-07D: % must release both claims at the one terminal instant', fn_name;
    END IF;
    IF body !~ 'POST_SUCCESS|POST_INTRODUCTION' THEN
      RAISE EXCEPTION 'I-07D: % must write the outcome''s exact reserved pause reason', fn_name;
    END IF;
    -- AN EXPLICIT OPT-OUT IS NEVER OVERWRITTEN.
    IF body !~ 'current_act\.resulting_state = ''OFF''' THEN
      RAISE EXCEPTION 'I-07D: % must leave an explicitly OFF human OFF', fn_name;
    END IF;
    IF body ~ '''USER_PAUSED''|''SYSTEM_POLICY''|''ACTIVATE''|''RESUME''|''TURN_OFF''' THEN
      RAISE EXCEPTION 'I-07D: % must not spell any participation act or reason outside the one post-terminal pause it owns', fn_name;
    END IF;
    IF body ~ 'DELETE FROM' THEN
      RAISE EXCEPTION 'I-07D: % deletes no canonical history: a terminal transition is archival', fn_name;
    END IF;
  END LOOP;

  -- ===================================================================
  -- THE FAIL-CLOSED SEAM, and the I-07A resume ceiling it must not widen.
  -- ===================================================================
  SELECT pr.prosrc, pr.provolatile INTO p FROM pg_proc pr WHERE pr.oid = gate_fn::regprocedure;
  IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-07D: the success prerequisite seam must be STABLE'; END IF;
  IF p.prosrc ~ '''CLEARED''' THEN
    RAISE EXCEPTION 'I-07D: the success prerequisite seam must never answer CLEARED before CW2-08 exists';
  END IF;
  IF p.prosrc !~ '''NOT_EVALUATED''' THEN
    RAISE EXCEPTION 'I-07D: the success prerequisite seam must answer NOT_EVALUATED';
  END IF;
  -- THE GENERIC I-07A RESUME IS UNTOUCHED and still USER_PAUSED-only: this
  -- slice creates the two reserved POST_* pauses and resumes neither.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = resume_fn::regprocedure;
  IF p.prosrc !~ 'current_act\.resulting_pause_reason <> ''USER_PAUSED''' THEN
    RAISE EXCEPTION 'I-07D: the generic I-07A resume must remain USER_PAUSED-only';
  END IF;
  IF p.prosrc ~ 'POST_SUCCESS|POST_INTRODUCTION|ACTIVE_INTRODUCTION' THEN
    RAISE EXCEPTION 'I-07D: the generic I-07A resume must not learn any reserved pause reason';
  END IF;

  -- ===================================================================
  -- EXACT LIVE PRODUCER OWNERSHIP of the five reserved forward states.
  -- ===================================================================
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ 'UPDATE public\.introduction_records') <> 2 THEN
    RAISE EXCEPTION 'I-07D: exactly the two reviewed terminal cores may move an Introduction Record to a terminal state';
  END IF;
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ 'UPDATE public\.matching_active_introduction_claims') <> 2 THEN
    RAISE EXCEPTION 'I-07D: exactly the two reviewed terminal cores may release an active-Introduction claim';
  END IF;
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ '''POST_SUCCESS''' AND pr.prosrc ~ 'INSERT INTO public\.matching_participation_events') <> 1 THEN
    RAISE EXCEPTION 'I-07D: exactly the reviewed success core may write a POST_SUCCESS pause';
  END IF;
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ '''POST_INTRODUCTION''' AND pr.prosrc ~ 'INSERT INTO public\.matching_participation_events') <> 1 THEN
    RAISE EXCEPTION 'I-07D: exactly the reviewed end core may write a POST_INTRODUCTION pause';
  END IF;
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ 'INSERT INTO public\.introduction_terminal_commits') <> 2 THEN
    RAISE EXCEPTION 'I-07D: exactly the two reviewed terminal cores may write a terminal commit';
  END IF;
  -- AND THE I-07C MATCH / BIRTH SEMANTICS ARE FROZEN: nothing here writes a
  -- Match commit, a claim birth, an Introduction Record birth or a birth fact.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND (pr.prosrc ~ 'INSERT INTO public\.matching_match_commits'
           OR pr.prosrc ~ 'INSERT INTO public\.introduction_records'
           OR pr.prosrc ~ 'INSERT INTO public\.matching_active_introduction_claims'
           OR pr.prosrc ~ 'INSERT INTO public\.shared_world_matching_birth_events'
           OR pr.prosrc ~ 'INSERT INTO public\.shared_world_introduction_started_events')) <> 1 THEN
    RAISE EXCEPTION 'I-07D: the frozen I-07C Match commit remains the ONLY producer of a Match, a Record birth, a claim and the two birth facts';
  END IF;
END$$;

COMMIT;
