-- I-04E - Governed Standard Membership Lifecycle v1 (PART A).
--
-- I-04D built the shared governance substrate and implemented no governed
-- operation. This migration is the first CONSUMER of it, and it implements
-- exactly three of the four remaining Standard membership mutations frozen canon
-- makes governed (CW2-03 sections 16, 25 and 28):
--
--   ADD_MEMBER     -> ALL_CURRENT_MEMBERS               -> MEMBER_INVITATION
--                                                       -> exact target accepts
--   REMOVE_MEMBER  -> ALL_CURRENT_MEMBERS_EXCEPT_TARGET -> exact episode closed
--   REJOIN_MEMBER  -> ALL_CURRENT_MEMBERS               -> a NEW episode
--
-- WORLD_SETTINGS_CHANGE is the fourth and lives in migration 0086, because
-- membership topology and World settings have different durable ownership.
-- END_WORLD is not implemented here and is not forbidden here.
--
-- ===========================================================================
-- WHAT THIS SLICE CONSUMES RATHER THAN DUPLICATES
-- ===========================================================================
--
-- Everything about authority is I-04D's. This migration never recomputes a
-- required approver set, never counts approvals, never compares topologies and
-- never decides which rule an operation needs: it calls
-- capture_shared_world_governance_proposal_v1 to open a proposal over the exact
-- current topology, and resolve_shared_world_governance_approval_v1 to prove -
-- inside the SAME transaction as its own irreversible mutation - that the exact
-- proposal is still current and fully approved. A satisfied proof is not a
-- token: it is revalidated at every commit, and the frozen resolver raises its
-- own bounded class when it is not satisfied.
--
-- What IS new here is the operation-owned immutable PAYLOAD. I-04D deliberately
-- left proposed_payload_version_id OPAQUE because it owns no operation's payload
-- schema. Each operation now owns one narrow immutable table, and the binding
-- back to the proposal is STRUCTURAL rather than procedural: a four-column
-- composite foreign key can only name a proposal that really carries this exact
-- World, this exact operation and this exact payload version. A payload row for
-- one operation can therefore never be presented as another operation's payload,
-- however it was produced. There is no JSON column and no generic mutation
-- payload table: a generic payload would be exactly the polymorphic structure
-- I-04D refused to invent.
--
-- ===========================================================================
-- WHY A MEMBER INVITATION IS DURABLE, AND WHY IT CAN DIE WITHOUT BEING TOUCHED
-- ===========================================================================
--
-- CW2-03 section 16 splits add-member into two human acts: the current members
-- unanimously approve an exact target, and the exact target separately accepts.
-- Between those two acts something durable has to exist, and CW2-02 section 51
-- is the worked proof of what it must do when topology moves underneath it: A
-- and B approve inviting C under snapshot M10, B leaves, M10 is stale, and the
-- old approval set cannot create the membership.
--
-- So a MEMBER_INVITATION binds the exact target, World, proposal, captured
-- topology and payload version, and becomes STALE_GOVERNANCE the moment the
-- open-episode topology of that World stops equalling the topology its proposal
-- captured. It is never revived: a later rejoin that restores an identical human
-- set produces a DIFFERENT episode set, which is precisely why I-04D identifies
-- a topology by its episode set and not by its humans.
--
-- THE TERMINALIZATION MECHANISM, and why it is a trigger.
--
-- The topology change that stales an invitation may come from the ALREADY
-- FROZEN I-04C leave primitive, which this slice may not modify and which knows
-- nothing about invitations. A staleness check performed only at acceptance
-- would therefore leave every OTHER pending invitation of that World in a
-- PENDING state that is no longer true, and would make the durable row disagree
-- with canonical topology until somebody happened to look. So terminalization is
-- installed where the topology actually changes: two narrow AFTER triggers on
-- public.shared_world_membership_episodes, each reacting to exactly one real
-- open-topology transition -
--
--   a new OPEN episode appears           (AFTER INSERT  WHEN NEW.ended_at IS NULL)
--   an OPEN episode becomes closed       (AFTER UPDATE OF ended_at
--                                         WHEN OLD.ended_at IS NULL
--                                          AND NEW.ended_at IS NOT NULL)
--
-- and nothing else. Closing an already-closed episode, rewriting an unrelated
-- column, inserting an already-closed historical episode and every non-topology
-- write are all silent. The trigger function transitions only still-PENDING
-- member invitations OF THE EXACT WORLD whose captured topology has actually
-- stopped matching, exactly once, with a database-owned terminal instant. It
-- touches no other World, no I-04A direct-world invitation, no governance
-- proposal or approval, no grant state and no membership row.
--
-- Acceptance is ordered so the trigger cannot race it: the invitation is moved
-- from PENDING to ACCEPTED BEFORE the new episode is inserted, all inside one
-- transaction, so the episode insert can never find its own invitation still
-- PENDING. If any later write in that transaction fails, the whole acceptance -
-- invitation state, episode, event and command - rolls back together.
--
-- ===========================================================================
-- FROM_JOIN_FORWARD IS THE ABSENCE OF A GRANT, NOT A STORED ENTITLEMENT
-- ===========================================================================
--
-- CW2-03 section 17 makes a new member's default boundary the join moment. The
-- new episode's joined_at IS that boundary, and no retrospective history grant
-- is created, so the default is expressed by what does not exist rather than by
-- a row. Storing a synthetic "from join forward" entitlement would manufacture a
-- history-access record this slice has no authority to write, and would make the
-- later selective-history engine (I-04F) reconcile with a fake. Likewise a
-- rejoin creates a new episode and leaves the absence interval between the old
-- ended_at and the new joined_at explicit and ungranted.
--
-- ===========================================================================
-- MEMBERSHIP LOSS IS NOT REVOCATION
-- ===========================================================================
--
-- CW2-02 section 32 freezes that there is no universal retroactive revocation
-- rule, and I-04C already established the consequence for voluntary leave:
-- membership loss and grant revocation are separate canonical truths. Governed
-- removal changes the same thing a leave changes - the canonical membership
-- topology, and therefore the current human Audience Snapshot the frozen 0079 /
-- I-03A / I-03E / I-03F layers derive from open episodes - and it rewrites,
-- revokes, deletes and widens nothing else. Symmetrically, no add or rejoin here
-- creates, reconfirms or widens any audience ceiling: a new member is a new
-- episode, and nothing more.
--
-- ===========================================================================
-- THE PRE-LAUNCH SECURITY BOUNDARY - why nothing here is app-callable
-- ===========================================================================
--
-- CW2-08 section 25 / H18 binds a CURRENT launch gate snapshot before an
-- irreversible commit. The Connected Worlds launch gate does not exist in this
-- repository, so - exactly as I-04B left the birth core, I-04C the leave core
-- and I-04D the governance primitives - every primitive here is implemented
-- fully and left NON-APPLICATION-EXECUTABLE:
--
--   PUBLIC / anon / authenticated / service_role -> no EXECUTE, on all of them.
--
-- The terminal self-assertions refuse to deploy without that. A later REVIEWED
-- launch-gated consumer is expected and is forbidden nowhere in this file. The
-- two primitives that carry human authority stay safe under any such wrapper
-- because the acting human is the session subject and there is no actor
-- parameter at all (CW2-01 section 7; CW2-08 section 2 / H1), and the governed
-- removal carries no actor because its authority is the approval set rather than
-- whoever transmits it.
--
-- ===========================================================================
-- CANONICAL LOCK ORDER - the World row FIRST, in every primitive
-- ===========================================================================
--
-- Membership topology is a property of the World, so every primitive that binds
-- current topology takes public.shared_worlds FOR UPDATE first - the same row
-- the frozen I-03C consent commands, the frozen I-04C leave and the frozen
-- I-04D governance primitives take first. Everything else (the proposal, the
-- invitation, the target episode) is locked after it, so no two orders can
-- interleave and the order cannot deadlock. No advisory lock, no table lock and
-- no process-local mutex is used anywhere.
--
-- ONE canonical instant per committed transaction, read once from the database
-- clock and persisted unchanged across every moment that transaction writes. No
-- client timestamp is accepted anywhere. The trigger reads its own terminal
-- instant because the transition it records is a consequence of a topology
-- change it did not cause - including one caused by the frozen leave primitive,
-- which has no way to share an instant with a slice written after it.
--
-- ===========================================================================
-- What this slice deliberately does NOT do
-- ===========================================================================
--
-- No World is created, ended, closed, archived or phase-changed. No history
-- access grant, absence-period grant, closed-world view entitlement or
-- selective past-history mechanism exists here - that is I-04F. No Shared
-- conversation, message, material or QANDEEL generation exists here - that is
-- I-04G. No Introduction, Matching, Public, Replay, launch gate, feature flag,
-- entitlement, moderation or block policy is invented. No route, controller,
-- public RPC or application wrapper is added. No grant, audience ceiling or
-- consent history is read or written, and no trigger here could do it
-- implicitly: the one trigger function writes member invitations and nothing
-- else. No decline, cancel or expiry lifecycle is invented for a member
-- invitation, and the state vocabulary carries no CHECK constraint for the same
-- reason migration 0083 left end_reason unconstrained and migration 0084 left
-- the operation and rule vocabularies unconstrained: a later reviewed slice must
-- be able to extend it without superseding this migration. What IS frozen is the
-- CONSISTENCY of the states, which is a structural invariant rather than a
-- vocabulary.
--
-- Every historical migration, 0001-0084 included, is untouched. The only change
-- to a predecessor table is additive: two UNIQUE constraints on I-04D's proposal
-- table that expose composite keys for the structural bindings below, which
-- change no I-04D runtime semantics and forbid nothing I-04D allowed.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ADDITIVE STRUCTURAL KEYS ON THE I-04D PROPOSAL.
--
--    I-04D intentionally left proposed_payload_version_id opaque, which leaves
--    the proposal-to-payload binding procedural. These two UNIQUE constraints
--    expose exactly the composite keys an operation-owned payload table needs to
--    make it STRUCTURAL instead:
--
--      (id, world_id, operation_kind, proposed_payload_version_id)
--          -> a payload row can only name a proposal that really carries this
--             exact World, this exact operation and this exact payload version;
--      (id, excluded_membership_episode_id)
--          -> a removal payload's target episode can only be the proposal's own
--             exact excluded episode.
--
--    Both are redundant against the existing primary key, add no column, forbid
--    no row I-04D permitted and change no I-04D behaviour. They are the same
--    device I-04D itself used when it added shared_world_governance_proposals_
--    snapshot_binding_key so an approval could carry a composite foreign key.
-- ---------------------------------------------------------------------------
ALTER TABLE public.shared_world_governance_proposals
  ADD CONSTRAINT shared_world_governance_proposals_operation_payload_binding_key
    UNIQUE (id, world_id, operation_kind, proposed_payload_version_id);

ALTER TABLE public.shared_world_governance_proposals
  ADD CONSTRAINT shared_world_governance_proposals_excluded_episode_binding_key
    UNIQUE (id, excluded_membership_episode_id);

-- ---------------------------------------------------------------------------
-- 2. THE THREE OPERATION-OWNED IMMUTABLE PAYLOAD VERSIONS.
--
--    Each row IS one proposed_payload_version_id: the primary key is the exact
--    opaque identity I-04D's proposal carries, so there is no second identity to
--    disagree with it. governance_operation_kind is pinned to one literal by a
--    CHECK and carried into the composite foreign key, which is what makes "this
--    payload belongs to an ADD_MEMBER proposal" structural rather than a comment.
--    created_at is database-owned and is the proposal's own capture instant, so
--    one preparation writes exactly one moment.
--
--    There is no status, no state, no owner, admin, proposer or initiator, no
--    JSON, no array and no generic metadata column anywhere in these three
--    tables. They are immutable in application semantics: the primitives below
--    only ever INSERT them.
-- ---------------------------------------------------------------------------

-- ADD_MEMBER is for a human who has NEVER held a membership episode in that
-- World. A former member is a REJOIN, which is a different operation with a
-- different payload table, and the preparation primitives enforce the split.
CREATE TABLE public.shared_world_add_member_payload_versions (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    governance_operation_kind text NOT NULL,
    target_user_id uuid NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT shared_world_add_member_payload_versions_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_add_member_payload_versions_operation_check
        CHECK (governance_operation_kind = 'ADD_MEMBER'),
    -- One proposal carries at most one payload, and the composite keys below let
    -- a consumer bind (proposal, payload) and (payload, target) structurally.
    CONSTRAINT shared_world_add_member_payload_versions_proposal_key UNIQUE (governance_proposal_id),
    CONSTRAINT shared_world_add_member_payload_versions_proposal_payload_key UNIQUE (governance_proposal_id, id),
    CONSTRAINT shared_world_add_member_payload_versions_payload_target_key UNIQUE (id, target_user_id),
    CONSTRAINT shared_world_add_member_payload_versions_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_add_member_payload_versions_target_fk
        FOREIGN KEY (target_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_add_member_payload_versions_proposal_fk
        FOREIGN KEY (governance_proposal_id, world_id, governance_operation_kind, id)
        REFERENCES public.shared_world_governance_proposals (id, world_id, operation_kind, proposed_payload_version_id) ON DELETE RESTRICT
);

-- The removal payload additionally carries the target's exact CURRENT membership
-- episode as it stood at proposal time. The second composite foreign key makes
-- that episode provably the proposal's own excluded episode, so a removal can
-- never be committed against an episode the approvers did not exclude.
CREATE TABLE public.shared_world_remove_member_payload_versions (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    governance_operation_kind text NOT NULL,
    target_user_id uuid NOT NULL,
    target_membership_episode_id uuid NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT shared_world_remove_member_payload_versions_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_remove_member_payload_versions_operation_check
        CHECK (governance_operation_kind = 'REMOVE_MEMBER'),
    CONSTRAINT shared_world_remove_member_payload_versions_proposal_key UNIQUE (governance_proposal_id),
    CONSTRAINT shared_world_remove_member_payload_versions_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_remove_member_payload_versions_target_fk
        FOREIGN KEY (target_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_remove_member_payload_versions_episode_fk
        FOREIGN KEY (target_membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_remove_member_payload_versions_proposal_fk
        FOREIGN KEY (governance_proposal_id, world_id, governance_operation_kind, id)
        REFERENCES public.shared_world_governance_proposals (id, world_id, operation_kind, proposed_payload_version_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_remove_member_payload_versions_excluded_episode_fk
        FOREIGN KEY (governance_proposal_id, target_membership_episode_id)
        REFERENCES public.shared_world_governance_proposals (id, excluded_membership_episode_id) ON DELETE RESTRICT
);

-- The rejoin payload carries one exact PRIOR membership episode of the exact
-- target in the exact World. That episode is the immutable historical binding
-- which proves the target really was a former member when the proposal was
-- prepared: it is a real closed episode, it is never reopened, and it remains
-- exactly as it was after the rejoin creates a NEW episode beside it.
CREATE TABLE public.shared_world_rejoin_payload_versions (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    governance_operation_kind text NOT NULL,
    target_user_id uuid NOT NULL,
    prior_membership_episode_id uuid NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT shared_world_rejoin_payload_versions_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_rejoin_payload_versions_operation_check
        CHECK (governance_operation_kind = 'REJOIN_MEMBER'),
    CONSTRAINT shared_world_rejoin_payload_versions_proposal_key UNIQUE (governance_proposal_id),
    CONSTRAINT shared_world_rejoin_payload_versions_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_rejoin_payload_versions_target_fk
        FOREIGN KEY (target_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_rejoin_payload_versions_prior_episode_fk
        FOREIGN KEY (prior_membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_rejoin_payload_versions_proposal_fk
        FOREIGN KEY (governance_proposal_id, world_id, governance_operation_kind, id)
        REFERENCES public.shared_world_governance_proposals (id, world_id, operation_kind, proposed_payload_version_id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 3. THE DURABLE MEMBER INVITATION.
--
--    It binds the exact target, World, ADD_MEMBER proposal, captured topology,
--    payload version, its state, its created instant, its terminal instant when
--    terminal, and the membership episode it produced when accepted. Two
--    composite foreign keys make the important halves structural:
--
--      (governance_proposal_id, membership_snapshot_id)
--          -> only a proposal that really captured that topology;
--      (governance_proposal_id, add_member_payload_version_id)
--          -> only that proposal's own payload, which in turn can only belong to
--             an ADD_MEMBER proposal of the same World;
--      (add_member_payload_version_id, target_user_id)
--          -> the invited human is exactly the payload's target, always.
--
--    UNIQUE (governance_proposal_id) is the one-effective-invitation rule: one
--    proposal dispatches at most one MEMBER_INVITATION, whatever id it arrives
--    under. UNIQUE (accepted_membership_episode_id) makes one acceptance produce
--    at most one membership episode.
--
--    There is no application read surface: the target identity is private
--    internal persistence, and the table is sealed like every Shared relation
--    before it.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_member_invitations (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    membership_snapshot_id uuid NOT NULL,
    add_member_payload_version_id uuid NOT NULL,
    invitation_state text NOT NULL,
    created_at timestamptz NOT NULL,
    terminal_at timestamptz,
    accepted_membership_episode_id uuid,
    CONSTRAINT shared_world_member_invitations_pk PRIMARY KEY (id),
    -- PENDING is the only non-terminal state, in both directions. The state
    -- VOCABULARY is deliberately unconstrained so a later reviewed decline,
    -- cancel or expiry state needs no superseding migration; what is frozen is
    -- that a terminal state carries a terminal instant and PENDING never does.
    CONSTRAINT shared_world_member_invitations_terminal_consistency_check
        CHECK ((invitation_state = 'PENDING') = (terminal_at IS NULL)),
    CONSTRAINT shared_world_member_invitations_terminal_after_creation_check
        CHECK (terminal_at IS NULL OR terminal_at >= created_at),
    -- An accepted membership episode exists exactly when the invitation was
    -- accepted, so no other terminal state can carry one.
    CONSTRAINT shared_world_member_invitations_acceptance_consistency_check
        CHECK ((accepted_membership_episode_id IS NOT NULL) = (invitation_state = 'ACCEPTED')),
    CONSTRAINT shared_world_member_invitations_proposal_key UNIQUE (governance_proposal_id),
    CONSTRAINT shared_world_member_invitations_episode_key UNIQUE (accepted_membership_episode_id),
    CONSTRAINT shared_world_member_invitations_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_invitations_target_fk
        FOREIGN KEY (target_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_invitations_snapshot_binding_fk
        FOREIGN KEY (governance_proposal_id, membership_snapshot_id)
        REFERENCES public.shared_world_governance_proposals (id, membership_snapshot_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_invitations_payload_binding_fk
        FOREIGN KEY (governance_proposal_id, add_member_payload_version_id)
        REFERENCES public.shared_world_add_member_payload_versions (governance_proposal_id, id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_invitations_payload_target_fk
        FOREIGN KEY (add_member_payload_version_id, target_user_id)
        REFERENCES public.shared_world_add_member_payload_versions (id, target_user_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_invitations_episode_fk
        FOREIGN KEY (accepted_membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT
);

-- The one access pattern the terminalization trigger needs: the still-PENDING
-- invitations of one exact World. Partial, so terminal history costs nothing.
CREATE INDEX shared_world_member_invitations_world_pending_idx
    ON public.shared_world_member_invitations (world_id)
    WHERE invitation_state = 'PENDING';

-- ---------------------------------------------------------------------------
-- 4. THE APPEND-ONLY MEMBERSHIP FACTS AND THEIR DURABLE COMMANDS.
--
--    House style from I-04B / I-04C: the table identity IS the logical event, so
--    a row carries only its own facts; the command id is the primary key, so the
--    primary key IS the idempotency record and there is no second idempotency
--    table; and every persistence identity a command produced is UNIQUE here, so
--    one episode, one event and one proposal belong to exactly one committed
--    command and can never be re-bound.
--
--    Uniqueness is per EPISODE, per EVENT and per PROPOSAL, never per
--    (world_id, user_id): a human may legitimately join, leave, rejoin and be
--    removed from the same World over time, and a permanent pair key would
--    forbid exactly the lifecycle this slice implements.
-- ---------------------------------------------------------------------------

CREATE TABLE public.shared_world_member_joined_events (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    membership_episode_id uuid NOT NULL,
    member_invitation_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT shared_world_member_joined_events_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_member_joined_events_episode_key UNIQUE (membership_episode_id),
    CONSTRAINT shared_world_member_joined_events_invitation_key UNIQUE (member_invitation_id),
    CONSTRAINT shared_world_member_joined_events_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_joined_events_episode_fk
        FOREIGN KEY (membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_joined_events_invitation_fk
        FOREIGN KEY (member_invitation_id) REFERENCES public.shared_world_member_invitations (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_joined_events_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

CREATE TABLE public.shared_world_member_acceptance_commands (
    id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    world_id uuid NOT NULL,
    member_invitation_id uuid NOT NULL,
    membership_episode_id uuid NOT NULL,
    member_joined_event_id uuid NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT shared_world_member_acceptance_commands_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_member_acceptance_commands_invitation_key UNIQUE (member_invitation_id),
    CONSTRAINT shared_world_member_acceptance_commands_episode_key UNIQUE (membership_episode_id),
    CONSTRAINT shared_world_member_acceptance_commands_event_key UNIQUE (member_joined_event_id),
    CONSTRAINT shared_world_member_acceptance_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_acceptance_commands_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_acceptance_commands_invitation_fk
        FOREIGN KEY (member_invitation_id) REFERENCES public.shared_world_member_invitations (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_acceptance_commands_episode_fk
        FOREIGN KEY (membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_acceptance_commands_event_fk
        FOREIGN KEY (member_joined_event_id) REFERENCES public.shared_world_member_joined_events (id) ON DELETE RESTRICT
);

-- A removal carries NO actor column. Its authority is the exact approval set
-- I-04D recorded, not whoever transmitted the commit, and inventing a remover
-- identity here would manufacture the initiation authority CW2-01 section 5 and
-- CW2-03 section 16 deny. The exact humans who authorized it are already
-- durable: they are the approvals of the bound proposal.
CREATE TABLE public.shared_world_member_removed_events (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    membership_episode_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT shared_world_member_removed_events_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_member_removed_events_episode_key UNIQUE (membership_episode_id),
    CONSTRAINT shared_world_member_removed_events_proposal_key UNIQUE (governance_proposal_id),
    CONSTRAINT shared_world_member_removed_events_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_removed_events_episode_fk
        FOREIGN KEY (membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_removed_events_target_fk
        FOREIGN KEY (target_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_removed_events_proposal_fk
        FOREIGN KEY (governance_proposal_id) REFERENCES public.shared_world_governance_proposals (id) ON DELETE RESTRICT
);

CREATE TABLE public.shared_world_member_removal_commands (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    membership_episode_id uuid NOT NULL,
    member_removed_event_id uuid NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT shared_world_member_removal_commands_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_member_removal_commands_proposal_key UNIQUE (governance_proposal_id),
    CONSTRAINT shared_world_member_removal_commands_episode_key UNIQUE (membership_episode_id),
    CONSTRAINT shared_world_member_removal_commands_event_key UNIQUE (member_removed_event_id),
    CONSTRAINT shared_world_member_removal_commands_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_removal_commands_proposal_fk
        FOREIGN KEY (governance_proposal_id) REFERENCES public.shared_world_governance_proposals (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_removal_commands_episode_fk
        FOREIGN KEY (membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_removal_commands_event_fk
        FOREIGN KEY (member_removed_event_id) REFERENCES public.shared_world_member_removed_events (id) ON DELETE RESTRICT
);

-- A rejoin DOES carry an actor: CW2-03 section 28 lets current members approve
-- an exact rejoin but never force a human back into a World, so the rejoining
-- human must be the one who commits it.
CREATE TABLE public.shared_world_member_rejoined_events (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    membership_episode_id uuid NOT NULL,
    prior_membership_episode_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT shared_world_member_rejoined_events_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_member_rejoined_events_episode_key UNIQUE (membership_episode_id),
    CONSTRAINT shared_world_member_rejoined_events_proposal_key UNIQUE (governance_proposal_id),
    -- The new episode is never the prior one: a rejoin is a NEW episode, and the
    -- old row is never reopened.
    CONSTRAINT shared_world_member_rejoined_events_distinct_episode_check
        CHECK (membership_episode_id <> prior_membership_episode_id),
    CONSTRAINT shared_world_member_rejoined_events_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_rejoined_events_episode_fk
        FOREIGN KEY (membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_rejoined_events_prior_episode_fk
        FOREIGN KEY (prior_membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_rejoined_events_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_rejoined_events_proposal_fk
        FOREIGN KEY (governance_proposal_id) REFERENCES public.shared_world_governance_proposals (id) ON DELETE RESTRICT
);

CREATE TABLE public.shared_world_member_rejoin_commands (
    id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    world_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    membership_episode_id uuid NOT NULL,
    member_rejoined_event_id uuid NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT shared_world_member_rejoin_commands_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_member_rejoin_commands_proposal_key UNIQUE (governance_proposal_id),
    CONSTRAINT shared_world_member_rejoin_commands_episode_key UNIQUE (membership_episode_id),
    CONSTRAINT shared_world_member_rejoin_commands_event_key UNIQUE (member_rejoined_event_id),
    CONSTRAINT shared_world_member_rejoin_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_rejoin_commands_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_rejoin_commands_proposal_fk
        FOREIGN KEY (governance_proposal_id) REFERENCES public.shared_world_governance_proposals (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_rejoin_commands_episode_fk
        FOREIGN KEY (membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_rejoin_commands_event_fk
        FOREIGN KEY (member_rejoined_event_id) REFERENCES public.shared_world_member_rejoined_events (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 5. Deny-by-default posture for every new table: RLS on, zero policies, every
--    application role revoked from every privilege. There is no direct client
--    read path, no generic membership repository and no application read
--    boundary in I-04E.
-- ---------------------------------------------------------------------------
ALTER TABLE public.shared_world_add_member_payload_versions OWNER TO postgres;
ALTER TABLE public.shared_world_remove_member_payload_versions OWNER TO postgres;
ALTER TABLE public.shared_world_rejoin_payload_versions OWNER TO postgres;
ALTER TABLE public.shared_world_member_invitations OWNER TO postgres;
ALTER TABLE public.shared_world_member_joined_events OWNER TO postgres;
ALTER TABLE public.shared_world_member_acceptance_commands OWNER TO postgres;
ALTER TABLE public.shared_world_member_removed_events OWNER TO postgres;
ALTER TABLE public.shared_world_member_removal_commands OWNER TO postgres;
ALTER TABLE public.shared_world_member_rejoined_events OWNER TO postgres;
ALTER TABLE public.shared_world_member_rejoin_commands OWNER TO postgres;
ALTER TABLE public.shared_world_add_member_payload_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_remove_member_payload_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_rejoin_payload_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_member_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_member_joined_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_member_acceptance_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_member_removed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_member_removal_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_member_rejoined_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_member_rejoin_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_world_add_member_payload_versions,
                    public.shared_world_remove_member_payload_versions,
                    public.shared_world_rejoin_payload_versions,
                    public.shared_world_member_invitations,
                    public.shared_world_member_joined_events,
                    public.shared_world_member_acceptance_commands,
                    public.shared_world_member_removed_events,
                    public.shared_world_member_removal_commands,
                    public.shared_world_member_rejoined_events,
                    public.shared_world_member_rejoin_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.shared_world_add_member_payload_versions, public.shared_world_remove_member_payload_versions, public.shared_world_rejoin_payload_versions, public.shared_world_member_invitations, public.shared_world_member_joined_events, public.shared_world_member_acceptance_commands, public.shared_world_member_removed_events, public.shared_world_member_removal_commands, public.shared_world_member_rejoined_events, public.shared_world_member_rejoin_commands FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 6. THE TOPOLOGY -> MEMBER INVITATION TERMINALIZATION MECHANISM.
--
--    The ONE semantic object this slice owns on a predecessor table. It writes
--    public.shared_world_member_invitations and nothing else: no membership row,
--    no World, no governance proposal or approval, no grant, no ceiling and no
--    event of any other kind. It cannot widen anything, because the only column
--    it can set is an invitation's own terminal state and instant.
--
--    The staleness test is I-04D's own: exact set equality of the captured
--    topology against the current OPEN episode set, by EPISODE identity, in BOTH
--    directions. A count comparison and a user-id comparison would each accept a
--    leave followed by a rejoin - the exact case CW2-02 section 51 exists to
--    reject - so neither may stand in for the set.
--
--    The WHERE clause restricts to still-PENDING rows, which is what makes the
--    transition happen exactly once: a second topology change finds nothing left
--    to terminalize, and an ACCEPTED invitation is never rewritten.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.terminalize_stale_shared_world_member_invitations_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  changed_world uuid := COALESCE(NEW.world_id, OLD.world_id);
BEGIN
  UPDATE public.shared_world_member_invitations i
     SET invitation_state = 'STALE_GOVERNANCE',
         terminal_at = clock_timestamp()
   WHERE i.world_id = changed_world
     AND i.invitation_state = 'PENDING'
     AND (EXISTS (
            SELECT 1 FROM public.shared_world_membership_episodes e
             WHERE e.world_id = i.world_id AND e.ended_at IS NULL
               AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_snapshot_members m
                                WHERE m.membership_snapshot_id = i.membership_snapshot_id
                                  AND m.membership_episode_id = e.id))
       OR EXISTS (
            SELECT 1 FROM public.shared_world_membership_snapshot_members m
             WHERE m.membership_snapshot_id = i.membership_snapshot_id
               AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                                WHERE e.id = m.membership_episode_id
                                  AND e.world_id = i.world_id AND e.ended_at IS NULL)));
  RETURN NULL;
END$$;

-- Exactly the two real open-topology transitions, and nothing else. Closing an
-- already-closed episode, reopening nothing, rewriting an unrelated column and
-- inserting an already-closed historical episode are all silent.
CREATE TRIGGER shared_world_open_episode_stales_member_invitations
  AFTER INSERT ON public.shared_world_membership_episodes
  FOR EACH ROW WHEN (NEW.ended_at IS NULL)
  EXECUTE FUNCTION public.terminalize_stale_shared_world_member_invitations_v1();

CREATE TRIGGER shared_world_closed_episode_stales_member_invitations
  AFTER UPDATE OF ended_at ON public.shared_world_membership_episodes
  FOR EACH ROW WHEN (OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL)
  EXECUTE FUNCTION public.terminalize_stale_shared_world_member_invitations_v1();

-- ---------------------------------------------------------------------------
-- 7. GOVERNANCE PREPARATION - ADD_MEMBER.
--
--    Preparation is NOT authority. It opens an exact proposal over the exact
--    current topology and writes the exact immutable payload; it creates no
--    membership, no invitation and no approval, and it records no proposer,
--    owner or admin. Who may open a proposal is a question a later reviewed
--    launch-gated consumer answers.
--
--    The World row is locked FIRST, by this body, before the operation-specific
--    precondition is read, so the whole preparation binds one consistent
--    topology; the frozen capture primitive then re-takes the same row lock,
--    which is a no-op inside this transaction. The canonical instant is the one
--    the capture primitive returns, so a preparation reads no clock of its own
--    and one preparation writes exactly one moment.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.prepare_shared_world_add_member_governance_v1(
  p_proposal_id uuid, p_membership_snapshot_id uuid, p_payload_version_id uuid,
  p_world_id uuid, p_target_user_id uuid
) RETURNS TABLE(outcome text, prepared_proposal_id uuid, prepared_snapshot_id uuid,
                prepared_world_id uuid, prepared_operation_kind text, prepared_payload_version_id uuid,
                prepared_approval_rule text, prepared_required_approval_count integer,
                prepared_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_add_member_payload_versions;
  captured record;
  world public.shared_worlds;
  historical_required integer;
BEGIN
  IF p_proposal_id IS NULL OR p_membership_snapshot_id IS NULL OR p_payload_version_id IS NULL
     OR p_world_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent retry of
  -- a preparation that already committed is answered from immutable history even
  -- after topology has moved on. Nothing on this path reads CURRENT topology.
  SELECT * INTO committed FROM public.shared_world_add_member_payload_versions c WHERE c.id = p_payload_version_id;
  IF FOUND THEN
    IF committed.governance_proposal_id = p_proposal_id AND committed.world_id = p_world_id
       AND committed.target_user_id = p_target_user_id
       AND EXISTS (SELECT 1 FROM public.shared_world_governance_proposals pr
                    WHERE pr.id = committed.governance_proposal_id
                      AND pr.membership_snapshot_id = p_membership_snapshot_id
                      AND pr.proposed_payload_version_id = committed.id
                      AND pr.created_at = committed.created_at) THEN
      SELECT count(*)::integer INTO historical_required
        FROM public.shared_world_membership_snapshot_members m
       WHERE m.membership_snapshot_id = p_membership_snapshot_id;
      IF historical_required = 0 THEN
        RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'PREPARED'::text, committed.governance_proposal_id, p_membership_snapshot_id,
                          committed.world_id, committed.governance_operation_kind, committed.id,
                          'ALL_CURRENT_MEMBERS'::text, historical_required, committed.created_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the exact World row, before any current state
  -- is read. Every primitive in this migration takes this row first.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- ADD_MEMBER IS FOR A HUMAN WHO WAS NEVER A MEMBER. A current member cannot be
  -- added again, and a FORMER member must go through REJOIN - which is a
  -- different operation, with a different payload table and its own approvals.
  -- Both reach the same bounded class as a World that does not exist, so no
  -- future wrapper can become a membership oracle.
  IF EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
              WHERE e.world_id = p_world_id AND e.user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- The frozen I-04D capture: it derives the topology, refuses zero current
  -- humans, owns the operation-to-rule mapping and owns the canonical instant.
  SELECT * INTO captured FROM public.capture_shared_world_governance_proposal_v1(
    p_proposal_id, p_membership_snapshot_id, p_world_id, 'ADD_MEMBER', p_payload_version_id,
    'ALL_CURRENT_MEMBERS', NULL);
  IF captured.outcome <> 'CAPTURED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  BEGIN
    INSERT INTO public.shared_world_add_member_payload_versions
      (id, world_id, governance_proposal_id, governance_operation_kind, target_user_id, created_at)
    VALUES (p_payload_version_id, p_world_id, p_proposal_id, 'ADD_MEMBER', p_target_user_id,
            captured.snapshot_captured_at);
  EXCEPTION WHEN unique_violation THEN
    -- The payload identity was taken between the first pass and here, or this
    -- proposal already carries another payload. The WHOLE preparation - the
    -- captured topology and the proposal included - rolls back together, so a
    -- refused preparation never leaves an orphan proposal behind.
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'PREPARED'::text, p_proposal_id, p_membership_snapshot_id, p_world_id,
                      'ADD_MEMBER'::text, p_payload_version_id, 'ALL_CURRENT_MEMBERS'::text,
                      captured.required_approval_count, captured.snapshot_captured_at;
END$$;

-- ---------------------------------------------------------------------------
-- 8. GOVERNANCE PREPARATION - REMOVE_MEMBER.
--
--    The target's exact CURRENT open episode is resolved from canonical state
--    under the World lock and never from a parameter, and the frozen capture
--    primitive independently resolves the same human to the same episode as its
--    exclusion. The composite foreign key then makes the two provably identical:
--    a removal payload can only name the proposal's own excluded episode.
--
--    The required approval set is the captured topology MINUS the target, and
--    the capture primitive already refuses a removal that would leave it empty -
--    so a sole current human can never be removed by vacuous unanimity.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.prepare_shared_world_remove_member_governance_v1(
  p_proposal_id uuid, p_membership_snapshot_id uuid, p_payload_version_id uuid,
  p_world_id uuid, p_target_user_id uuid
) RETURNS TABLE(outcome text, prepared_proposal_id uuid, prepared_snapshot_id uuid,
                prepared_world_id uuid, prepared_operation_kind text, prepared_payload_version_id uuid,
                prepared_approval_rule text, prepared_required_approval_count integer,
                prepared_target_episode_id uuid, prepared_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_remove_member_payload_versions;
  captured record;
  world public.shared_worlds;
  target_episode uuid;
  historical_required integer;
BEGIN
  IF p_proposal_id IS NULL OR p_membership_snapshot_id IS NULL OR p_payload_version_id IS NULL
     OR p_world_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT * INTO committed FROM public.shared_world_remove_member_payload_versions c WHERE c.id = p_payload_version_id;
  IF FOUND THEN
    IF committed.governance_proposal_id = p_proposal_id AND committed.world_id = p_world_id
       AND committed.target_user_id = p_target_user_id
       AND EXISTS (SELECT 1 FROM public.shared_world_governance_proposals pr
                    WHERE pr.id = committed.governance_proposal_id
                      AND pr.membership_snapshot_id = p_membership_snapshot_id
                      AND pr.proposed_payload_version_id = committed.id
                      AND pr.excluded_membership_episode_id = committed.target_membership_episode_id
                      AND pr.created_at = committed.created_at) THEN
      SELECT count(*)::integer INTO historical_required
        FROM public.shared_world_membership_snapshot_members m
       WHERE m.membership_snapshot_id = p_membership_snapshot_id
         AND m.membership_episode_id <> committed.target_membership_episode_id;
      IF historical_required = 0 THEN
        RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'PREPARED'::text, committed.governance_proposal_id, p_membership_snapshot_id,
                          committed.world_id, committed.governance_operation_kind, committed.id,
                          'ALL_CURRENT_MEMBERS_EXCEPT_TARGET'::text, historical_required,
                          committed.target_membership_episode_id, committed.created_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- The target must be a CURRENT member, with exactly one open episode. The 0075
  -- partial unique index already guarantees at most one; zero reaches the same
  -- bounded class as every other unavailable case.
  SELECT e.id INTO target_episode
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.user_id = p_target_user_id AND e.ended_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO captured FROM public.capture_shared_world_governance_proposal_v1(
    p_proposal_id, p_membership_snapshot_id, p_world_id, 'REMOVE_MEMBER', p_payload_version_id,
    'ALL_CURRENT_MEMBERS_EXCEPT_TARGET', p_target_user_id);
  IF captured.outcome <> 'CAPTURED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  BEGIN
    INSERT INTO public.shared_world_remove_member_payload_versions
      (id, world_id, governance_proposal_id, governance_operation_kind, target_user_id,
       target_membership_episode_id, created_at)
    VALUES (p_payload_version_id, p_world_id, p_proposal_id, 'REMOVE_MEMBER', p_target_user_id,
            target_episode, captured.snapshot_captured_at);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'PREPARED'::text, p_proposal_id, p_membership_snapshot_id, p_world_id,
                      'REMOVE_MEMBER'::text, p_payload_version_id,
                      'ALL_CURRENT_MEMBERS_EXCEPT_TARGET'::text, captured.required_approval_count,
                      target_episode, captured.snapshot_captured_at;
END$$;

-- ---------------------------------------------------------------------------
-- 9. GOVERNANCE PREPARATION - REJOIN_MEMBER.
--
--    The target must be a FORMER member: at least one closed episode in this
--    exact World, and no open one. The exact prior episode stored is the most
--    recently closed one, resolved from canonical state under the World lock,
--    and it is the immutable historical binding that proves former membership at
--    proposal time. It is never reopened, never rewritten and never consumed:
--    the rejoin creates a NEW episode beside it, and the absence interval
--    between them stays explicit and ungranted.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.prepare_shared_world_rejoin_governance_v1(
  p_proposal_id uuid, p_membership_snapshot_id uuid, p_payload_version_id uuid,
  p_world_id uuid, p_target_user_id uuid
) RETURNS TABLE(outcome text, prepared_proposal_id uuid, prepared_snapshot_id uuid,
                prepared_world_id uuid, prepared_operation_kind text, prepared_payload_version_id uuid,
                prepared_approval_rule text, prepared_required_approval_count integer,
                prepared_prior_episode_id uuid, prepared_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_rejoin_payload_versions;
  captured record;
  world public.shared_worlds;
  prior_episode uuid;
  historical_required integer;
BEGIN
  IF p_proposal_id IS NULL OR p_membership_snapshot_id IS NULL OR p_payload_version_id IS NULL
     OR p_world_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT * INTO committed FROM public.shared_world_rejoin_payload_versions c WHERE c.id = p_payload_version_id;
  IF FOUND THEN
    IF committed.governance_proposal_id = p_proposal_id AND committed.world_id = p_world_id
       AND committed.target_user_id = p_target_user_id
       AND EXISTS (SELECT 1 FROM public.shared_world_governance_proposals pr
                    WHERE pr.id = committed.governance_proposal_id
                      AND pr.membership_snapshot_id = p_membership_snapshot_id
                      AND pr.proposed_payload_version_id = committed.id
                      AND pr.created_at = committed.created_at) THEN
      SELECT count(*)::integer INTO historical_required
        FROM public.shared_world_membership_snapshot_members m
       WHERE m.membership_snapshot_id = p_membership_snapshot_id;
      IF historical_required = 0 THEN
        RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'PREPARED'::text, committed.governance_proposal_id, p_membership_snapshot_id,
                          committed.world_id, committed.governance_operation_kind, committed.id,
                          'ALL_CURRENT_MEMBERS'::text, historical_required,
                          committed.prior_membership_episode_id, committed.created_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- A current member is not a rejoin candidate.
  IF EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
              WHERE e.world_id = p_world_id AND e.user_id = p_target_user_id AND e.ended_at IS NULL) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- A human who was never a member is not one either: that is ADD_MEMBER.
  SELECT e.id INTO prior_episode
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.user_id = p_target_user_id AND e.ended_at IS NOT NULL
   ORDER BY e.ended_at DESC, e.id DESC
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO captured FROM public.capture_shared_world_governance_proposal_v1(
    p_proposal_id, p_membership_snapshot_id, p_world_id, 'REJOIN_MEMBER', p_payload_version_id,
    'ALL_CURRENT_MEMBERS', NULL);
  IF captured.outcome <> 'CAPTURED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  BEGIN
    INSERT INTO public.shared_world_rejoin_payload_versions
      (id, world_id, governance_proposal_id, governance_operation_kind, target_user_id,
       prior_membership_episode_id, created_at)
    VALUES (p_payload_version_id, p_world_id, p_proposal_id, 'REJOIN_MEMBER', p_target_user_id,
            prior_episode, captured.snapshot_captured_at);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'PREPARED'::text, p_proposal_id, p_membership_snapshot_id, p_world_id,
                      'REJOIN_MEMBER'::text, p_payload_version_id, 'ALL_CURRENT_MEMBERS'::text,
                      captured.required_approval_count, prior_episode, captured.snapshot_captured_at;
END$$;

-- ---------------------------------------------------------------------------
-- 10. MEMBER INVITATION DISPATCH.
--
--     The second act of add-member: once the exact ADD_MEMBER proposal is
--     CURRENTLY satisfied, one PENDING invitation is persisted for the exact
--     target. It creates no membership, no history access and no World, and it
--     records no dispatcher: whoever transmits the dispatch gains nothing, and
--     the authority is the approval set the frozen resolver revalidates here.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.dispatch_shared_world_member_invitation_v1(
  p_invitation_id uuid, p_proposal_id uuid
) RETURNS TABLE(outcome text, dispatched_invitation_id uuid, invited_world_id uuid,
                dispatched_proposal_id uuid, dispatched_snapshot_id uuid,
                dispatched_payload_version_id uuid, dispatched_state text,
                dispatched_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_member_invitations;
  payload public.shared_world_add_member_payload_versions;
  world public.shared_worlds;
  proof record;
  target_world uuid;
  dispatch_instant timestamptz;
BEGIN
  IF p_invitation_id IS NULL OR p_proposal_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS. An equivalent retry is answered from the
  -- invitation this dispatch committed, whatever the invitation has since become:
  -- a later topology change may legitimately have terminalized it, and a
  -- historical answer must not start raising because of that.
  SELECT * INTO committed FROM public.shared_world_member_invitations c WHERE c.id = p_invitation_id;
  IF FOUND THEN
    IF committed.governance_proposal_id = p_proposal_id THEN
      RETURN QUERY SELECT 'DISPATCHED'::text, committed.id, committed.world_id,
                          committed.governance_proposal_id, committed.membership_snapshot_id,
                          committed.add_member_payload_version_id, committed.invitation_state,
                          committed.created_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- WORLD-FIRST ORDER: only enough of the proposal is pre-read to discover which
  -- World this dispatch belongs to; the proposal is never locked before the World.
  SELECT pr.world_id INTO target_world FROM public.shared_world_governance_proposals pr WHERE pr.id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the World lock, so two concurrent
  -- equivalent dispatches serialize and the loser returns the committed result.
  SELECT * INTO committed FROM public.shared_world_member_invitations c WHERE c.id = p_invitation_id;
  IF FOUND THEN
    IF committed.governance_proposal_id = p_proposal_id THEN
      RETURN QUERY SELECT 'DISPATCHED'::text, committed.id, committed.world_id,
                          committed.governance_proposal_id, committed.membership_snapshot_id,
                          committed.add_member_payload_version_id, committed.invitation_state,
                          committed.created_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT * INTO payload FROM public.shared_world_add_member_payload_versions pl
   WHERE pl.governance_proposal_id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- Still a human who has never held a membership episode here. A topology that
  -- moved under the proposal is caught by the resolver below; this catches the
  -- target themselves having become a member some other way in the meantime.
  IF EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
              WHERE e.world_id = payload.world_id AND e.user_id = payload.target_user_id) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE CURRENT GOVERNANCE PROOF, from the frozen I-04D resolver: exact
  -- operation, exact payload version, exact topology, every required approval.
  -- It raises its own bounded class when it is not satisfied.
  SELECT * INTO proof FROM public.resolve_shared_world_governance_approval_v1(
    p_proposal_id, 'ADD_MEMBER', payload.id);
  IF proof.outcome <> 'SATISFIED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  dispatch_instant := clock_timestamp();

  BEGIN
    INSERT INTO public.shared_world_member_invitations
      (id, world_id, target_user_id, governance_proposal_id, membership_snapshot_id,
       add_member_payload_version_id, invitation_state, created_at, terminal_at,
       accepted_membership_episode_id)
    VALUES (p_invitation_id, payload.world_id, payload.target_user_id, p_proposal_id,
            proof.satisfied_snapshot_id, payload.id, 'PENDING', dispatch_instant, NULL, NULL);
  EXCEPTION WHEN unique_violation THEN
    -- Either the invitation identity was taken, or this proposal already
    -- dispatched its one effective invitation. Nothing was persisted.
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'DISPATCHED'::text, p_invitation_id, payload.world_id, p_proposal_id,
                      proof.satisfied_snapshot_id, payload.id, 'PENDING'::text, dispatch_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 11. ADD-MEMBER ACCEPTANCE.
--
--     The third act: the exact target, and nobody else, turns a currently valid
--     invitation into exactly one membership episode. The accepting human is the
--     session subject, derived rather than supplied - there is no actor
--     parameter, no target parameter and no instant parameter at all - so no
--     caller, including a future launch-gated wrapper and including QANDEEL, can
--     accept on somebody else's behalf. An unauthenticated call fails closed.
--
--     ORDERING IS LOAD-BEARING: the invitation moves from PENDING to ACCEPTED
--     BEFORE the membership episode is inserted, so the topology trigger the
--     insert fires can never find this invitation still PENDING. Everything is
--     one transaction: if any later write fails, the invitation state, the
--     episode, the event and the command all roll back together.
--
--     FROM_JOIN_FORWARD is the new episode's joined_at and the ABSENCE of any
--     retrospective grant. No history access row is written here, in either
--     direction, because none is what the default means.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.accept_shared_world_member_invitation_v1(
  p_command_id uuid, p_invitation_id uuid, p_membership_episode_id uuid, p_member_joined_event_id uuid
) RETURNS TABLE(outcome text, accepted_command_id uuid, accepted_invitation_id uuid,
                joined_world_id uuid, created_membership_episode_id uuid,
                created_joined_event_id uuid, member_joined_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.shared_world_member_acceptance_commands;
  invitation public.shared_world_member_invitations;
  world public.shared_worlds;
  proof record;
  target_world uuid;
  join_instant timestamptz;
  updated integer;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_invitation_id IS NULL OR p_membership_episode_id IS NULL
     OR p_member_joined_event_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent retry by
  -- the same exact human is answered from immutable history even after the
  -- episode it created has itself been closed by a later leave or removal.
  SELECT * INTO committed FROM public.shared_world_member_acceptance_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.member_invitation_id = p_invitation_id
       AND committed.membership_episode_id = p_membership_episode_id
       AND committed.member_joined_event_id = p_member_joined_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_member_joined_events ev
          JOIN public.shared_world_membership_episodes ep ON ep.id = ev.membership_episode_id
         WHERE ev.id = committed.member_joined_event_id
           AND ev.membership_episode_id = committed.membership_episode_id
           AND ev.member_invitation_id = committed.member_invitation_id
           AND ev.world_id = committed.world_id
           AND ev.actor_user_id = committed.actor_user_id
           AND ev.occurred_at = committed.committed_at
           AND ep.world_id = committed.world_id
           AND ep.user_id = committed.actor_user_id
           AND ep.joined_at = committed.committed_at
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'JOINED'::text, committed.id, committed.member_invitation_id,
                          committed.world_id, committed.membership_episode_id,
                          committed.member_joined_event_id, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- WORLD-FIRST ORDER: the World is discovered from the invitation, then locked,
  -- before the invitation itself is locked.
  SELECT i.world_id INTO target_world FROM public.shared_world_member_invitations i WHERE i.id = p_invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.shared_world_member_acceptance_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.member_invitation_id = p_invitation_id
       AND committed.membership_episode_id = p_membership_episode_id
       AND committed.member_joined_event_id = p_member_joined_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_member_joined_events ev
          JOIN public.shared_world_membership_episodes ep ON ep.id = ev.membership_episode_id
         WHERE ev.id = committed.member_joined_event_id
           AND ev.membership_episode_id = committed.membership_episode_id
           AND ev.member_invitation_id = committed.member_invitation_id
           AND ev.world_id = committed.world_id
           AND ev.actor_user_id = committed.actor_user_id
           AND ev.occurred_at = committed.committed_at
           AND ep.world_id = committed.world_id
           AND ep.user_id = committed.actor_user_id
           AND ep.joined_at = committed.committed_at
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'JOINED'::text, committed.id, committed.member_invitation_id,
                          committed.world_id, committed.membership_episode_id,
                          committed.member_joined_event_id, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the exact invitation.
  SELECT * INTO invitation FROM public.shared_world_member_invitations i WHERE i.id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF invitation.world_id <> target_world THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  -- THE EXACT TARGET, AND NOBODY ELSE. A non-target caller and a terminal
  -- invitation reach the same bounded class as an invitation that does not
  -- exist, so acceptance never confirms who was invited.
  IF invitation.target_user_id <> u OR invitation.invitation_state <> 'PENDING' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- Still never a member of this exact World, under both locks.
  IF EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
              WHERE e.world_id = invitation.world_id AND e.user_id = u) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- The governance proof, revalidated in the SAME transaction as the mutation.
  SELECT * INTO proof FROM public.resolve_shared_world_governance_approval_v1(
    invitation.governance_proposal_id, 'ADD_MEMBER', invitation.add_member_payload_version_id);
  IF proof.outcome <> 'SATISFIED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- THE ONE canonical instant, read from the database clock exactly once and
  -- reused for every persisted moment of this acceptance.
  join_instant := clock_timestamp();

  BEGIN
    -- The invitation becomes terminal BEFORE the episode exists, so the topology
    -- trigger the insert below fires can never see it still PENDING.
    UPDATE public.shared_world_member_invitations i
       SET invitation_state = 'ACCEPTED', terminal_at = join_instant,
           accepted_membership_episode_id = p_membership_episode_id
     WHERE i.id = p_invitation_id AND i.invitation_state = 'PENDING';
    GET DIAGNOSTICS updated = ROW_COUNT;
    IF updated <> 1 THEN
      RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at, end_reason)
    VALUES (p_membership_episode_id, invitation.world_id, u, join_instant, NULL, NULL);

    INSERT INTO public.shared_world_member_joined_events
      (id, world_id, membership_episode_id, member_invitation_id, actor_user_id, occurred_at)
    VALUES (p_member_joined_event_id, invitation.world_id, p_membership_episode_id, p_invitation_id, u, join_instant);

    INSERT INTO public.shared_world_member_acceptance_commands
      (id, actor_user_id, world_id, member_invitation_id, membership_episode_id,
       member_joined_event_id, committed_at)
    VALUES (p_command_id, u, invitation.world_id, p_invitation_id, p_membership_episode_id,
            p_member_joined_event_id, join_instant);
  EXCEPTION WHEN unique_violation THEN
    -- A supplied persistence identity was already taken, or this invitation was
    -- already accepted under another command id. The WHOLE acceptance rolls back
    -- together, so a refused acceptance leaves no episode and no half-accepted
    -- invitation behind, and the bounded answer names nothing.
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'JOINED'::text, p_command_id, p_invitation_id, invitation.world_id,
                      p_membership_episode_id, p_member_joined_event_id, join_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 12. GOVERNED REMOVAL.
--
--     Consumes one CURRENTLY satisfied exact REMOVE_MEMBER proposal and closes
--     the exact target episode IN PLACE with end_reason REMOVED. There is no
--     actor: the authority is the approval set, which already excludes the
--     target, so the target can never have approved their own removal.
--
--     The World stays ACTIVE / STANDARD. One remaining current human is a valid
--     Shared World with no sole-survivor authority; a removal that would leave
--     zero was already impossible, because the capture primitive refuses an
--     empty required set and the resolver refuses a required count of zero.
--     Nothing here revokes, rewrites or narrows a grant, and no authorship
--     history is deleted.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_shared_world_member_removal_v1(
  p_command_id uuid, p_proposal_id uuid, p_member_removed_event_id uuid
) RETURNS TABLE(outcome text, removal_command_id uuid, removed_world_id uuid,
                removed_proposal_id uuid, closed_membership_episode_id uuid,
                removed_event_id uuid, closed_end_reason text, member_removed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_member_removal_commands;
  payload public.shared_world_remove_member_payload_versions;
  episode public.shared_world_membership_episodes;
  world public.shared_worlds;
  proof record;
  target_world uuid;
  remaining integer;
  removal_instant timestamptz;
BEGIN
  IF p_command_id IS NULL OR p_proposal_id IS NULL OR p_member_removed_event_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT * INTO committed FROM public.shared_world_member_removal_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.governance_proposal_id = p_proposal_id
       AND committed.member_removed_event_id = p_member_removed_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_member_removed_events ev
          JOIN public.shared_world_membership_episodes ep ON ep.id = ev.membership_episode_id
         WHERE ev.id = committed.member_removed_event_id
           AND ev.membership_episode_id = committed.membership_episode_id
           AND ev.governance_proposal_id = committed.governance_proposal_id
           AND ev.world_id = committed.world_id
           AND ev.occurred_at = committed.committed_at
           AND ep.world_id = committed.world_id
           AND ep.user_id = ev.target_user_id
           AND ep.ended_at = committed.committed_at
           AND ep.end_reason = 'REMOVED'
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'REMOVED'::text, committed.id, committed.world_id,
                          committed.governance_proposal_id, committed.membership_episode_id,
                          committed.member_removed_event_id, 'REMOVED'::text, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT pr.world_id INTO target_world FROM public.shared_world_governance_proposals pr WHERE pr.id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.shared_world_member_removal_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.governance_proposal_id = p_proposal_id
       AND committed.member_removed_event_id = p_member_removed_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_member_removed_events ev
          JOIN public.shared_world_membership_episodes ep ON ep.id = ev.membership_episode_id
         WHERE ev.id = committed.member_removed_event_id
           AND ev.membership_episode_id = committed.membership_episode_id
           AND ev.governance_proposal_id = committed.governance_proposal_id
           AND ev.world_id = committed.world_id
           AND ev.occurred_at = committed.committed_at
           AND ep.world_id = committed.world_id
           AND ep.user_id = ev.target_user_id
           AND ep.ended_at = committed.committed_at
           AND ep.end_reason = 'REMOVED'
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'REMOVED'::text, committed.id, committed.world_id,
                          committed.governance_proposal_id, committed.membership_episode_id,
                          committed.member_removed_event_id, 'REMOVED'::text, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT * INTO payload FROM public.shared_world_remove_member_payload_versions pl
   WHERE pl.governance_proposal_id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO proof FROM public.resolve_shared_world_governance_approval_v1(
    p_proposal_id, 'REMOVE_MEMBER', payload.id);
  IF proof.outcome <> 'SATISFIED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 3: the exact target episode the approvers
  -- excluded. A stale proposal whose target already left, or whose target now
  -- holds a LATER successor episode, cannot reach this row: the composite
  -- foreign key pinned this exact episode at proposal time, and it must still be
  -- the open one.
  SELECT * INTO episode FROM public.shared_world_membership_episodes e
   WHERE e.id = payload.target_membership_episode_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF episode.world_id <> payload.world_id OR episode.user_id <> payload.target_user_id THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF episode.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_STALE' USING ERRCODE='40001';
  END IF;

  -- ZERO HUMANS IS NEVER MANUFACTURED BY REMOVAL AUTHORITY. It is already
  -- impossible upstream; it is re-proven here rather than assumed.
  SELECT count(*)::integer INTO remaining
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = payload.world_id AND e.ended_at IS NULL AND e.id <> episode.id;
  IF remaining = 0 THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  removal_instant := clock_timestamp();

  BEGIN
    -- CLOSED IN PLACE. The id, World, human and joined_at are never rewritten,
    -- the row is never removed and never replaced: the membership period stays
    -- durable historical truth, and a later rejoin is a second row.
    UPDATE public.shared_world_membership_episodes e
       SET ended_at = removal_instant, end_reason = 'REMOVED'
     WHERE e.id = episode.id AND e.ended_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.shared_world_member_removed_events
      (id, world_id, membership_episode_id, target_user_id, governance_proposal_id, occurred_at)
    VALUES (p_member_removed_event_id, payload.world_id, episode.id, payload.target_user_id,
            p_proposal_id, removal_instant);

    INSERT INTO public.shared_world_member_removal_commands
      (id, world_id, governance_proposal_id, membership_episode_id, member_removed_event_id, committed_at)
    VALUES (p_command_id, payload.world_id, p_proposal_id, episode.id, p_member_removed_event_id, removal_instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'REMOVED'::text, p_command_id, payload.world_id, p_proposal_id, episode.id,
                      p_member_removed_event_id, 'REMOVED'::text, removal_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 13. GOVERNED REJOIN.
--
--     Current members may approve an exact rejoin, but they may never force a
--     human back into a World (CW2-03 section 28), so the rejoining human is the
--     session subject and must be exactly the human the payload names. The
--     result is always a NEW open episode: no closed episode is ever reopened,
--     re-dated or mutated, and the absence interval between the prior ended_at
--     and the new joined_at stays explicit.
--
--     NO ABSENCE-PERIOD ACCESS IS GRANTED. Prior authorized membership-period
--     history remains recoverable later by access composition, and the material
--     of the absence remains hidden unless a separately reviewed slice grants
--     it. This slice writes no history access row at all, in either direction.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_shared_world_member_rejoin_v1(
  p_command_id uuid, p_proposal_id uuid, p_membership_episode_id uuid, p_member_rejoined_event_id uuid
) RETURNS TABLE(outcome text, rejoin_command_id uuid, rejoined_world_id uuid,
                rejoined_proposal_id uuid, created_membership_episode_id uuid,
                bound_prior_episode_id uuid, created_rejoined_event_id uuid,
                member_rejoined_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.shared_world_member_rejoin_commands;
  payload public.shared_world_rejoin_payload_versions;
  prior public.shared_world_membership_episodes;
  world public.shared_worlds;
  proof record;
  target_world uuid;
  current_humans integer;
  rejoin_instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_proposal_id IS NULL OR p_membership_episode_id IS NULL
     OR p_member_rejoined_event_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT * INTO committed FROM public.shared_world_member_rejoin_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.governance_proposal_id = p_proposal_id
       AND committed.membership_episode_id = p_membership_episode_id
       AND committed.member_rejoined_event_id = p_member_rejoined_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_member_rejoined_events ev
          JOIN public.shared_world_membership_episodes ep ON ep.id = ev.membership_episode_id
         WHERE ev.id = committed.member_rejoined_event_id
           AND ev.membership_episode_id = committed.membership_episode_id
           AND ev.governance_proposal_id = committed.governance_proposal_id
           AND ev.world_id = committed.world_id
           AND ev.actor_user_id = committed.actor_user_id
           AND ev.occurred_at = committed.committed_at
           AND ep.world_id = committed.world_id
           AND ep.user_id = committed.actor_user_id
           AND ep.joined_at = committed.committed_at
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'REJOINED'::text, committed.id, committed.world_id,
                          committed.governance_proposal_id, committed.membership_episode_id,
                          (SELECT ev.prior_membership_episode_id FROM public.shared_world_member_rejoined_events ev
                            WHERE ev.id = committed.member_rejoined_event_id),
                          committed.member_rejoined_event_id, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT pr.world_id INTO target_world FROM public.shared_world_governance_proposals pr WHERE pr.id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.shared_world_member_rejoin_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.governance_proposal_id = p_proposal_id
       AND committed.membership_episode_id = p_membership_episode_id
       AND committed.member_rejoined_event_id = p_member_rejoined_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_member_rejoined_events ev
          JOIN public.shared_world_membership_episodes ep ON ep.id = ev.membership_episode_id
         WHERE ev.id = committed.member_rejoined_event_id
           AND ev.membership_episode_id = committed.membership_episode_id
           AND ev.governance_proposal_id = committed.governance_proposal_id
           AND ev.world_id = committed.world_id
           AND ev.actor_user_id = committed.actor_user_id
           AND ev.occurred_at = committed.committed_at
           AND ep.world_id = committed.world_id
           AND ep.user_id = committed.actor_user_id
           AND ep.joined_at = committed.committed_at
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'REJOINED'::text, committed.id, committed.world_id,
                          committed.governance_proposal_id, committed.membership_episode_id,
                          (SELECT ev.prior_membership_episode_id FROM public.shared_world_member_rejoined_events ev
                            WHERE ev.id = committed.member_rejoined_event_id),
                          committed.member_rejoined_event_id, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT * INTO payload FROM public.shared_world_rejoin_payload_versions pl
   WHERE pl.governance_proposal_id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- ONLY THE EXACT FORMER HUMAN MAY COMMIT THEIR OWN REJOIN.
  IF payload.target_user_id <> u THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO proof FROM public.resolve_shared_world_governance_approval_v1(
    p_proposal_id, 'REJOIN_MEMBER', payload.id);
  IF proof.outcome <> 'SATISFIED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- Still a former member, under the World lock: no open episode of their own,
  -- and the exact prior episode the payload bound is still a closed episode of
  -- this exact human in this exact World.
  IF EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
              WHERE e.world_id = payload.world_id AND e.user_id = u AND e.ended_at IS NULL) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO prior FROM public.shared_world_membership_episodes e
   WHERE e.id = payload.prior_membership_episode_id;
  IF NOT FOUND OR prior.world_id <> payload.world_id OR prior.user_id <> u OR prior.ended_at IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- A rejoin needs a World that still has at least one current human: an inert
  -- zero-human World has no unanimity to give, and the frozen resolver already
  -- refuses it. Re-proven here rather than assumed.
  SELECT count(*)::integer INTO current_humans
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = payload.world_id AND e.ended_at IS NULL;
  IF current_humans = 0 THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  rejoin_instant := clock_timestamp();

  BEGIN
    INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at, end_reason)
    VALUES (p_membership_episode_id, payload.world_id, u, rejoin_instant, NULL, NULL);

    INSERT INTO public.shared_world_member_rejoined_events
      (id, world_id, membership_episode_id, prior_membership_episode_id, actor_user_id,
       governance_proposal_id, occurred_at)
    VALUES (p_member_rejoined_event_id, payload.world_id, p_membership_episode_id,
            payload.prior_membership_episode_id, u, p_proposal_id, rejoin_instant);

    INSERT INTO public.shared_world_member_rejoin_commands
      (id, actor_user_id, world_id, governance_proposal_id, membership_episode_id,
       member_rejoined_event_id, committed_at)
    VALUES (p_command_id, u, payload.world_id, p_proposal_id, p_membership_episode_id,
            p_member_rejoined_event_id, rejoin_instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'REJOINED'::text, p_command_id, payload.world_id, p_proposal_id,
                      p_membership_episode_id, payload.prior_membership_episode_id,
                      p_member_rejoined_event_id, rejoin_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 14. Ownership and THE PRE-LAUNCH ACL: every primitive is executable by no
--     application role at all. There is no GRANT statement in this migration.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.terminalize_stale_shared_world_member_invitations_v1() OWNER TO postgres;
ALTER FUNCTION public.prepare_shared_world_add_member_governance_v1(uuid, uuid, uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.prepare_shared_world_remove_member_governance_v1(uuid, uuid, uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.prepare_shared_world_rejoin_governance_v1(uuid, uuid, uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.dispatch_shared_world_member_invitation_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.accept_shared_world_member_invitation_v1(uuid, uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.commit_shared_world_member_removal_v1(uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.commit_shared_world_member_rejoin_v1(uuid, uuid, uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.terminalize_stale_shared_world_member_invitations_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_shared_world_add_member_governance_v1(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_shared_world_remove_member_governance_v1(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_shared_world_rejoin_governance_v1(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dispatch_shared_world_member_invitation_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_shared_world_member_invitation_v1(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_shared_world_member_removal_v1(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_shared_world_member_rejoin_v1(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.terminalize_stale_shared_world_member_invitations_v1() FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.prepare_shared_world_add_member_governance_v1(uuid, uuid, uuid, uuid, uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.prepare_shared_world_remove_member_governance_v1(uuid, uuid, uuid, uuid, uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.prepare_shared_world_rejoin_governance_v1(uuid, uuid, uuid, uuid, uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.dispatch_shared_world_member_invitation_v1(uuid, uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.accept_shared_world_member_invitation_v1(uuid, uuid, uuid, uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_member_removal_v1(uuid, uuid, uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_member_rejoin_v1(uuid, uuid, uuid, uuid) FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 15. Terminal self-assertions. The migration refuses to deploy a governed
--     membership lifecycle that is application-executable, caller-identified,
--     unpinned, wrongly ordered, multi-clocked, topology-guessing,
--     approval-manufacturing, grant-mutating, World-mutating, history-granting,
--     episode-reopening or policy-bearing.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  trigger_fn text := 'public.terminalize_stale_shared_world_member_invitations_v1()';
  add_prepare_fn text := 'public.prepare_shared_world_add_member_governance_v1(uuid,uuid,uuid,uuid,uuid)';
  remove_prepare_fn text := 'public.prepare_shared_world_remove_member_governance_v1(uuid,uuid,uuid,uuid,uuid)';
  rejoin_prepare_fn text := 'public.prepare_shared_world_rejoin_governance_v1(uuid,uuid,uuid,uuid,uuid)';
  dispatch_fn text := 'public.dispatch_shared_world_member_invitation_v1(uuid,uuid)';
  accept_fn text := 'public.accept_shared_world_member_invitation_v1(uuid,uuid,uuid,uuid)';
  removal_fn text := 'public.commit_shared_world_member_removal_v1(uuid,uuid,uuid)';
  rejoin_fn text := 'public.commit_shared_world_member_rejoin_v1(uuid,uuid,uuid,uuid)';
  own_functions text[];
  own_tables text[] := ARRAY['public.shared_world_add_member_payload_versions',
                             'public.shared_world_remove_member_payload_versions',
                             'public.shared_world_rejoin_payload_versions',
                             'public.shared_world_member_invitations',
                             'public.shared_world_member_joined_events',
                             'public.shared_world_member_acceptance_commands',
                             'public.shared_world_member_removed_events',
                             'public.shared_world_member_removal_commands',
                             'public.shared_world_member_rejoined_events',
                             'public.shared_world_member_rejoin_commands'];
  fn_name text;
  p record;
  in_names text[];
  in_types text[];
  out_names text[];
  arg_name text;
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
  world_pos integer;
  lock_pos integer;
  state_pos integer;
  episode_pos integer;
  episodes_table constant text := 'public.shared_world_membership_episodes';
BEGIN
  own_functions := ARRAY[add_prepare_fn, remove_prepare_fn, rejoin_prepare_fn, dispatch_fn,
                         accept_fn, removal_fn, rejoin_fn];

  -- ===================================================================
  -- Every primitive, the trigger function included: ownership, security,
  -- pinning, volatility and the PRE-LAUNCH SECURITY BOUNDARY asserted rather
  -- than commented. Each assertion is about THESE objects only; a later
  -- reviewed launch-gated consumer is expected and is forbidden nowhere here.
  -- ===================================================================
  FOREACH fn_name IN ARRAY own_functions || ARRAY[trigger_fn] LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn_name::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-04E: % must be owned by postgres', fn_name; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-04E: % must be SECURITY DEFINER', fn_name; END IF;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-04E: % mutates or locks and must be VOLATILE', fn_name; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-04E: % must pin an empty search_path', fn_name;
    END IF;
    IF has_function_privilege('public', fn_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04E: PUBLIC must not execute the governed membership lifecycle before the launch gate exists';
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, fn_name, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-04E: % must not execute the governed membership lifecycle before the launch gate exists', target_role;
      END IF;
    END LOOP;

    -- No Personal context, no grant / ceiling / consent-history mutation, no
    -- paired-phase or Matching state, nothing deleted, and no lock that is not a
    -- canonical row lock.
    IF p.prosrc ~* 'conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|consent|matching|introduction' THEN
      RAISE EXCEPTION 'I-04E: % must not read Personal context or touch grant and consent state', fn_name;
    END IF;
    IF p.prosrc ~* 'DELETE FROM' OR p.prosrc ~* 'TRUNCATE' THEN
      RAISE EXCEPTION 'I-04E: % may never delete canonical history', fn_name;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' THEN
      RAISE EXCEPTION 'I-04E: % locks rows in the canonical order, never a table and never an advisory key', fn_name;
    END IF;
    -- No World is created, closed, archived or phase-changed anywhere here.
    IF p.prosrc ~ 'UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds' THEN
      RAISE EXCEPTION 'I-04E: % must not create, close or mutate a Shared World', fn_name;
    END IF;
    IF p.prosrc ~ 'READ_ONLY_CLOSED|closed_at|birth_basis|WORLD_ENDED|HISTORY_ACCESS_GRANT|CLOSED_WORLD_VIEW_ENTITLEMENT' THEN
      RAISE EXCEPTION 'I-04E: % must not write a closure, history-access or entitlement literal it does not own', fn_name;
    END IF;
    -- Approvals and captured topology are I-04D's to write, never this slice's.
    IF p.prosrc ~ 'INSERT INTO public\.shared_world_governance_approvals|UPDATE public\.shared_world_governance_approvals'
       OR p.prosrc ~ 'INSERT INTO public\.shared_world_governance_proposals|UPDATE public\.shared_world_governance_proposals'
       OR p.prosrc ~ 'INSERT INTO public\.shared_world_membership_snapshot' THEN
      RAISE EXCEPTION 'I-04E: % must never manufacture governance: proposals and approvals belong to I-04D', fn_name;
    END IF;
    -- No second clock read anywhere: one database-owned instant per transaction.
    IF p.prosrc ~ 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp' THEN
      RAISE EXCEPTION 'I-04E: % must persist one database-owned instant, never a second clock read', fn_name;
    END IF;
    IF (length(p.prosrc) - length(replace(p.prosrc, 'clock_timestamp()', ''))) / length('clock_timestamp()') > 1 THEN
      RAISE EXCEPTION 'I-04E: % must read the database clock at most once', fn_name;
    END IF;
  END LOOP;

  -- ===================================================================
  -- THE PREPARATION PRIMITIVES: they consume I-04D's capture, they manufacture
  -- no approval, and they change no membership.
  -- ===================================================================
  FOREACH fn_name IN ARRAY ARRAY[add_prepare_fn, remove_prepare_fn, rejoin_prepare_fn] LOOP
    SELECT pr.prosrc, pr.proargnames, pr.proargmodes, pr.proargtypes INTO p
      FROM pg_proc pr WHERE pr.oid = fn_name::regprocedure;
    -- Argument NAMES come from proargnames / proargmodes and TYPES from
    -- proargtypes. A rendered signature is not the authority: this function has
    -- RETURNS TABLE columns, which pg_get_function_arguments folds into the same
    -- string and pg_get_function_identity_arguments renders without names.
    SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
           array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
      INTO in_names, out_names
      FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
    IF in_names <> ARRAY['p_proposal_id','p_membership_snapshot_id','p_payload_version_id',
                         'p_world_id','p_target_user_id'] THEN
      RAISE EXCEPTION 'I-04E: % must accept exactly the frozen preparation parameter list, not %', fn_name, in_names;
    END IF;
    SELECT array_agg(t.typname::text ORDER BY a.ord) INTO in_types
      FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
      JOIN pg_type t ON t.oid = a.argtype;
    IF in_types <> ARRAY['uuid','uuid','uuid','uuid','uuid'] THEN
      RAISE EXCEPTION 'I-04E: % must accept only opaque uuid identities, not %', fn_name, in_types;
    END IF;
    -- The ban is non-vacuous by construction: the exact list above proves these
    -- really are the parameter names being scanned. The operation target is the
    -- ONE human a caller may name, and everything a caller must never supply is
    -- refused: no episode, approver or approval set, no member count, no clock,
    -- and no initiator, owner, admin or launch result.
    FOREACH arg_name IN ARRAY in_names LOOP
      IF arg_name ~* 'initiator|proposer|actor|owner|admin|approver|approval|member_ids|episode|audience|count|launch|gate|timestamp|instant|_at$' THEN
        RAISE EXCEPTION 'I-04E: % must not accept a topology, approver, count, clock or authority parameter', fn_name;
      END IF;
    END LOOP;
    -- PREPARATION IS NOT AUTHORITY: it consults no session identity, so it
    -- invents no proposal-initiation authority semantics.
    IF p.prosrc ~ 'auth\.uid' THEN
      RAISE EXCEPTION 'I-04E: % must not derive or record an initiator: preparation is not authority', fn_name;
    END IF;
    -- It consumes the frozen I-04D capture rather than deriving a topology.
    IF p.prosrc !~ 'public\.capture_shared_world_governance_proposal_v1\(' THEN
      RAISE EXCEPTION 'I-04E: % must capture its proposal through the frozen I-04D primitive', fn_name;
    END IF;
    -- It changes no membership at all.
    IF p.prosrc ~ 'INSERT INTO public\.shared_world_membership_episodes|UPDATE public\.shared_world_membership_episodes' THEN
      RAISE EXCEPTION 'I-04E: % must open and close no membership episode: preparation creates no membership change', fn_name;
    END IF;
    IF p.prosrc ~ 'INSERT INTO public\.shared_world_member_invitations' THEN
      RAISE EXCEPTION 'I-04E: % must dispatch no invitation', fn_name;
    END IF;
    -- WORLD-FIRST: the exact World row is locked before any current state is read.
    world_pos := strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE');
    IF world_pos = 0 THEN
      RAISE EXCEPTION 'I-04E: % must lock the exact World row first', fn_name;
    END IF;
    IF (length(p.prosrc) - length(replace(p.prosrc, 'FOR UPDATE', ''))) / length('FOR UPDATE') <> 1 THEN
      RAISE EXCEPTION 'I-04E: % takes exactly one row lock of its own, and it is the World row', fn_name;
    END IF;
    -- No clock of its own: the canonical instant is the one capture returned.
    IF p.prosrc ~ 'clock_timestamp\(\)' THEN
      RAISE EXCEPTION 'I-04E: % must reuse the capture instant, never read a second clock', fn_name;
    END IF;
    IF p.prosrc !~ 'captured\.snapshot_captured_at' THEN
      RAISE EXCEPTION 'I-04E: % must persist the exact instant the frozen capture owned', fn_name;
    END IF;
  END LOOP;
  -- Each preparation writes its OWN payload table and no other operation's.
  IF (SELECT count(*) FROM pg_proc pr WHERE pr.oid = add_prepare_fn::regprocedure
       AND pr.prosrc ~ 'INSERT INTO public\.shared_world_(remove_member|rejoin)_payload_versions') <> 0
     OR (SELECT count(*) FROM pg_proc pr WHERE pr.oid = remove_prepare_fn::regprocedure
       AND pr.prosrc ~ 'INSERT INTO public\.shared_world_(add_member|rejoin)_payload_versions') <> 0
     OR (SELECT count(*) FROM pg_proc pr WHERE pr.oid = rejoin_prepare_fn::regprocedure
       AND pr.prosrc ~ 'INSERT INTO public\.shared_world_(add_member|remove_member)_payload_versions') <> 0 THEN
    RAISE EXCEPTION 'I-04E: each preparation owns exactly one operation payload table';
  END IF;
  -- The exact operation each preparation may capture, and no other.
  FOREACH arg_name IN ARRAY ARRAY[add_prepare_fn || '|ADD_MEMBER|ALL_CURRENT_MEMBERS',
                                  remove_prepare_fn || '|REMOVE_MEMBER|ALL_CURRENT_MEMBERS_EXCEPT_TARGET',
                                  rejoin_prepare_fn || '|REJOIN_MEMBER|ALL_CURRENT_MEMBERS'] LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr
     WHERE pr.oid = split_part(arg_name, '|', 1)::regprocedure;
    IF strpos(p.prosrc, '''' || split_part(arg_name, '|', 2) || '''') = 0
       OR strpos(p.prosrc, '''' || split_part(arg_name, '|', 3) || '''') = 0 THEN
      RAISE EXCEPTION 'I-04E: % must name its exact operation and its exact frozen rule', split_part(arg_name, '|', 1);
    END IF;
  END LOOP;
  -- The removal exclusion is supplied to capture for REMOVE_MEMBER only.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = remove_prepare_fn::regprocedure;
  IF p.prosrc !~ '''ALL_CURRENT_MEMBERS_EXCEPT_TARGET'', p_target_user_id\)' THEN
    RAISE EXCEPTION 'I-04E: a removal proposal must exclude the exact target through the frozen capture primitive';
  END IF;
  FOREACH fn_name IN ARRAY ARRAY[add_prepare_fn, rejoin_prepare_fn] LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn_name::regprocedure;
    IF p.prosrc !~ '''ALL_CURRENT_MEMBERS'', NULL\)' THEN
      RAISE EXCEPTION 'I-04E: % must supply no exclusion: the exclusion belongs to REMOVE_MEMBER alone', fn_name;
    END IF;
  END LOOP;
  -- ADD_MEMBER is for a human who was never a member; REJOIN is for a former one.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = add_prepare_fn::regprocedure;
  IF p.prosrc !~ 'WHERE e\.world_id = p_world_id AND e\.user_id = p_target_user_id\)' THEN
    RAISE EXCEPTION 'I-04E: ADD_MEMBER must refuse a human who already holds any membership episode of that World';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = rejoin_prepare_fn::regprocedure;
  IF p.prosrc !~ 'AND e\.ended_at IS NOT NULL' THEN
    RAISE EXCEPTION 'I-04E: REJOIN must bind one exact prior CLOSED episode as its historical proof of former membership';
  END IF;

  -- ===================================================================
  -- DISPATCH: an invitation exists only after governance is CURRENTLY satisfied,
  -- and it creates no membership.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes, pr.proargtypes INTO p
    FROM pg_proc pr WHERE pr.oid = dispatch_fn::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i')
    INTO in_names FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_invitation_id','p_proposal_id'] THEN
    RAISE EXCEPTION 'I-04E: the dispatch primitive must accept exactly two opaque identities, not %', in_names;
  END IF;
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'user_id|actor|target|approver|member|episode|snapshot|timestamp|instant|count|_at$' THEN
      RAISE EXCEPTION 'I-04E: the dispatch primitive must not accept an actor, target, episode, count or clock parameter';
    END IF;
  END LOOP;
  IF p.prosrc !~ 'public\.resolve_shared_world_governance_approval_v1\(\s*\n?\s*p_proposal_id, ''ADD_MEMBER''' THEN
    RAISE EXCEPTION 'I-04E: a member invitation may exist only after the exact ADD_MEMBER governance is currently satisfied';
  END IF;
  IF p.prosrc ~ 'INSERT INTO public\.shared_world_membership_episodes|UPDATE public\.shared_world_membership_episodes' THEN
    RAISE EXCEPTION 'I-04E: dispatching an invitation must create no membership';
  END IF;
  IF p.prosrc ~ 'auth\.uid' THEN
    RAISE EXCEPTION 'I-04E: dispatch records no dispatcher: transmitting a satisfied proposal is not authority';
  END IF;
  world_pos := strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
  state_pos := strpos(p.prosrc, 'INSERT INTO public.shared_world_member_invitations');
  IF world_pos = 0 OR state_pos = 0 OR world_pos > state_pos THEN
    RAISE EXCEPTION 'I-04E: dispatch must lock the exact World row before it writes an invitation';
  END IF;

  -- ===================================================================
  -- ACCEPTANCE: the exact target is the session subject, the invitation becomes
  -- terminal BEFORE the episode exists, and no history access is created.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes, pr.proargtypes INTO p
    FROM pg_proc pr WHERE pr.oid = accept_fn::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
         array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
    INTO in_names, out_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id','p_invitation_id','p_membership_episode_id','p_member_joined_event_id'] THEN
    RAISE EXCEPTION 'I-04E: the acceptance primitive must accept exactly the four opaque identities, not %', in_names;
  END IF;
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'user_id|actor|target|approver|snapshot|timestamp|instant|count|reason|_at$' THEN
      RAISE EXCEPTION 'I-04E: the acceptance primitive must not accept an actor, target, count or clock parameter';
    END IF;
  END LOOP;
  IF p.prosrc !~ 'u uuid := auth\.uid\(\)' THEN
    RAISE EXCEPTION 'I-04E: the accepting human must be derived from the session subject, never supplied';
  END IF;
  IF p.prosrc !~ 'IF u IS NULL THEN\s*\n\s*RAISE EXCEPTION ''SHARED_WORLD_MEMBERSHIP_AUTHENTICATION_REQUIRED''' THEN
    RAISE EXCEPTION 'I-04E: a call with no human session identity must fail closed, so QANDEEL can never accept';
  END IF;
  IF p.prosrc !~ 'invitation\.target_user_id <> u' THEN
    RAISE EXCEPTION 'I-04E: only the exact invited human may accept a member invitation';
  END IF;
  IF p.prosrc !~ 'public\.resolve_shared_world_governance_approval_v1\(\s*\n?\s*invitation\.governance_proposal_id, ''ADD_MEMBER''' THEN
    RAISE EXCEPTION 'I-04E: acceptance must revalidate the exact ADD_MEMBER governance in its own transaction';
  END IF;
  -- ORDERING IS LOAD-BEARING: terminal state, then the episode, then the event.
  world_pos := strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
  lock_pos := strpos(p.prosrc, 'WHERE i.id = p_invitation_id FOR UPDATE');
  state_pos := strpos(p.prosrc, 'SET invitation_state = ''ACCEPTED''');
  episode_pos := strpos(p.prosrc, 'INSERT INTO public.shared_world_membership_episodes');
  IF world_pos = 0 OR lock_pos = 0 OR state_pos = 0 OR episode_pos = 0
     OR world_pos > lock_pos OR lock_pos > state_pos OR state_pos > episode_pos THEN
    RAISE EXCEPTION 'I-04E: acceptance must lock the World then the invitation, and mark it ACCEPTED before the episode exists';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'FOR UPDATE', ''))) / length('FOR UPDATE') <> 2 THEN
    RAISE EXCEPTION 'I-04E: acceptance takes exactly two row locks of its own: the World and the invitation';
  END IF;
  IF p.prosrc !~ 'join_instant := clock_timestamp\(\);' THEN
    RAISE EXCEPTION 'I-04E: the acceptance instant must come from the database clock, never from a caller';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'join_instant := ', ''))) / length('join_instant := ') <> 1 THEN
    RAISE EXCEPTION 'I-04E: the canonical acceptance instant must be captured exactly once';
  END IF;

  -- ===================================================================
  -- REMOVAL: no actor at all, the exact excluded episode, closed IN PLACE.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes, pr.proargtypes INTO p
    FROM pg_proc pr WHERE pr.oid = removal_fn::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i')
    INTO in_names FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id','p_proposal_id','p_member_removed_event_id'] THEN
    RAISE EXCEPTION 'I-04E: the removal primitive must accept exactly three opaque identities, not %', in_names;
  END IF;
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'user_id|actor|target|approver|episode|snapshot|timestamp|instant|count|reason|_at$' THEN
      RAISE EXCEPTION 'I-04E: the removal primitive must not accept an actor, target, episode, reason or clock parameter';
    END IF;
  END LOOP;
  -- A removal has no actor: its authority is the approval set, not whoever
  -- transmits it, and no remover identity is derived or recorded.
  IF p.prosrc ~ 'auth\.uid' THEN
    RAISE EXCEPTION 'I-04E: removal derives no remover: the authority is the exact approval set I-04D recorded';
  END IF;
  IF p.prosrc !~ 'public\.resolve_shared_world_governance_approval_v1\(\s*\n?\s*p_proposal_id, ''REMOVE_MEMBER''' THEN
    RAISE EXCEPTION 'I-04E: a removal must revalidate the exact REMOVE_MEMBER governance in its own transaction';
  END IF;
  IF p.prosrc !~ 'SET ended_at = removal_instant, end_reason = ''REMOVED''' THEN
    RAISE EXCEPTION 'I-04E: a removal must close the exact episode in place with the REMOVED reason';
  END IF;
  IF p.prosrc !~ 'payload\.target_membership_episode_id' THEN
    RAISE EXCEPTION 'I-04E: a removal must close the exact episode the approvers excluded, never a later successor';
  END IF;
  IF p.prosrc !~ 'IF remaining = 0 THEN' THEN
    RAISE EXCEPTION 'I-04E: a removal may never manufacture a zero-human World through empty-set authority';
  END IF;
  IF p.prosrc ~ 'INSERT INTO public\.shared_world_membership_episodes' THEN
    RAISE EXCEPTION 'I-04E: a removal opens no membership episode';
  END IF;
  world_pos := strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
  episode_pos := strpos(p.prosrc, 'WHERE e.id = payload.target_membership_episode_id FOR UPDATE');
  state_pos := strpos(p.prosrc, 'UPDATE public.shared_world_membership_episodes e');
  IF world_pos = 0 OR episode_pos = 0 OR state_pos = 0 OR world_pos > episode_pos OR episode_pos > state_pos THEN
    RAISE EXCEPTION 'I-04E: a removal must lock the exact World row, then the exact target episode, before any write';
  END IF;

  -- ===================================================================
  -- REJOIN: the exact former human commits it, and a NEW episode is created.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes, pr.proargtypes INTO p
    FROM pg_proc pr WHERE pr.oid = rejoin_fn::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i')
    INTO in_names FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id','p_proposal_id','p_membership_episode_id','p_member_rejoined_event_id'] THEN
    RAISE EXCEPTION 'I-04E: the rejoin primitive must accept exactly the four opaque identities, not %', in_names;
  END IF;
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'user_id|actor|target|approver|snapshot|timestamp|instant|count|reason|_at$' THEN
      RAISE EXCEPTION 'I-04E: the rejoin primitive must not accept an actor, target, count or clock parameter';
    END IF;
  END LOOP;
  IF p.prosrc !~ 'u uuid := auth\.uid\(\)' THEN
    RAISE EXCEPTION 'I-04E: the rejoining human must be derived from the session subject, never supplied';
  END IF;
  IF p.prosrc !~ 'payload\.target_user_id <> u' THEN
    RAISE EXCEPTION 'I-04E: current members may approve an exact rejoin but may never force a human back into a World';
  END IF;
  IF p.prosrc !~ 'public\.resolve_shared_world_governance_approval_v1\(\s*\n?\s*p_proposal_id, ''REJOIN_MEMBER''' THEN
    RAISE EXCEPTION 'I-04E: a rejoin must revalidate the exact REJOIN_MEMBER governance in its own transaction';
  END IF;
  -- A rejoin NEVER reopens, re-dates or mutates a closed episode.
  IF p.prosrc ~ 'UPDATE public\.shared_world_membership_episodes' THEN
    RAISE EXCEPTION 'I-04E: a rejoin must create a NEW episode and never reopen or rewrite a closed one';
  END IF;
  IF p.prosrc !~ 'INSERT INTO public\.shared_world_membership_episodes \(id, world_id, user_id, joined_at, ended_at, end_reason\)' THEN
    RAISE EXCEPTION 'I-04E: a rejoin must open exactly one new membership episode';
  END IF;

  -- ===================================================================
  -- THE TERMINALIZATION MECHANISM: one narrow trigger function, two narrow
  -- triggers, and nothing else on the canonical membership table.
  -- ===================================================================
  SELECT pr.prosrc, pr.prorettype INTO p FROM pg_proc pr WHERE pr.oid = trigger_fn::regprocedure;
  IF p.prorettype <> 'trigger'::regtype THEN
    RAISE EXCEPTION 'I-04E: the terminalization mechanism must be a trigger function';
  END IF;
  -- It writes member invitations and NOTHING else - no membership row, no World,
  -- no governance, no grant and no event of any other kind.
  IF p.prosrc !~ 'UPDATE public\.shared_world_member_invitations i' THEN
    RAISE EXCEPTION 'I-04E: the terminalization mechanism must transition member invitations';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'UPDATE public.', ''))) / length('UPDATE public.') <> 1
     OR p.prosrc ~ 'INSERT INTO' THEN
    RAISE EXCEPTION 'I-04E: the terminalization mechanism must write exactly one relation, and it is the member invitation';
  END IF;
  IF p.prosrc !~ 'AND i\.invitation_state = ''PENDING''' THEN
    RAISE EXCEPTION 'I-04E: only a still-PENDING invitation may be terminalized, so the transition happens exactly once';
  END IF;
  IF p.prosrc !~ 'WHERE i\.world_id = changed_world' THEN
    RAISE EXCEPTION 'I-04E: the terminalization mechanism must never reach another World';
  END IF;
  IF p.prosrc ~ 'shared_world_direct_invitations|shared_world_invite_credential_state' THEN
    RAISE EXCEPTION 'I-04E: the terminalization mechanism must never touch an I-04A direct-world invitation';
  END IF;
  -- EXACT SET EQUALITY, IN BOTH DIRECTIONS, over EPISODE identity. A count or a
  -- user-id comparison would accept a leave followed by a rejoin.
  IF strpos(p.prosrc, 'AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_snapshot_members m') = 0
     OR strpos(p.prosrc, 'AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e') = 0 THEN
    RAISE EXCEPTION 'I-04E: staleness must compare the captured topology to current topology in BOTH directions';
  END IF;
  IF p.prosrc !~ 'AND m\.membership_episode_id = e\.id' OR p.prosrc !~ 'WHERE e\.id = m\.membership_episode_id' THEN
    RAISE EXCEPTION 'I-04E: staleness must compare EPISODE identity, never a count and never a user id';
  END IF;
  -- Exactly two triggers, on exactly the canonical membership table, each bound
  -- to exactly one real open-topology transition and to this exact function.
  IF (SELECT count(*) FROM pg_trigger t
       WHERE t.tgrelid = episodes_table::regclass AND NOT t.tgisinternal
         AND t.tgfoid = trigger_fn::regprocedure) <> 2 THEN
    RAISE EXCEPTION 'I-04E: exactly two topology triggers must call the terminalization mechanism';
  END IF;
  -- Asserted by SUBSTRING rather than by a whole rendered definition: the
  -- deparser's parenthesisation of a WHEN qual is its own business, and pinning
  -- it would make this migration fail on a PostgreSQL that renders it differently
  -- while proving nothing extra. What must hold is the exact trigger name, the
  -- exact function, AFTER + FOR EACH ROW, the exact UPDATE column list, and the
  -- exact transition predicate.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = episodes_table::regclass AND NOT t.tgisinternal
       AND t.tgname = 'shared_world_open_episode_stales_member_invitations'
       AND t.tgfoid = trigger_fn::regprocedure
       AND pg_get_triggerdef(t.oid) LIKE '%AFTER INSERT ON%'
       AND pg_get_triggerdef(t.oid) LIKE '%FOR EACH ROW%'
       AND pg_get_triggerdef(t.oid) LIKE '%new.ended_at IS NULL%'
       AND pg_get_triggerdef(t.oid) NOT LIKE '%old.%'
  ) THEN
    RAISE EXCEPTION 'I-04E: a new OPEN membership episode, and only that, must stale member invitations on insertion';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = episodes_table::regclass AND NOT t.tgisinternal
       AND t.tgname = 'shared_world_closed_episode_stales_member_invitations'
       AND t.tgfoid = trigger_fn::regprocedure
       AND pg_get_triggerdef(t.oid) LIKE '%AFTER UPDATE OF ended_at ON%'
       AND pg_get_triggerdef(t.oid) LIKE '%FOR EACH ROW%'
       AND pg_get_triggerdef(t.oid) LIKE '%old.ended_at IS NULL%'
       AND pg_get_triggerdef(t.oid) LIKE '%new.ended_at IS NOT NULL%'
  ) THEN
    RAISE EXCEPTION 'I-04E: an OPEN membership episode becoming closed, and only that, must stale member invitations on update';
  END IF;
  -- No trigger anywhere in this slice couples membership to grant or consent
  -- state: the ONE trigger function this migration installs writes invitations.
  IF EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_proc pr ON pr.oid = t.tgfoid
     WHERE t.tgrelid = episodes_table::regclass AND NOT t.tgisinternal
       AND pr.prosrc ~* 'shared_world_standing_context'
  ) THEN
    RAISE EXCEPTION 'I-04E: no trigger on the canonical membership table may reach grant or consent state';
  END IF;

  -- ===================================================================
  -- The ten new tables: unreachable, policy-free and trigger-free, and neither a
  -- generic payload engine nor a superior-authority record.
  -- ===================================================================
  FOREACH target_table IN ARRAY own_tables LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN RAISE EXCEPTION 'I-04E: row level security must be enabled on %', target_table; END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04E: no RLS policy may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION 'I-04E: migration 0085 installs no trigger on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = target_table::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-04E: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04E: direct table access stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  -- No payload blob, no permission engine and no superior participant authority
  -- anywhere in the tables this migration created.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_world_add_member_payload_versions',
                            'shared_world_remove_member_payload_versions',
                            'shared_world_rejoin_payload_versions',
                            'shared_world_member_invitations',
                            'shared_world_member_joined_events',
                            'shared_world_member_acceptance_commands',
                            'shared_world_member_removed_events',
                            'shared_world_member_removal_commands',
                            'shared_world_member_rejoined_events',
                            'shared_world_member_rejoin_commands')
       AND (c.column_name ~* '(owner|admin|creator|initiator|proposer|survivor|privilege|capability|permission|scope|metadata|vote|weight|token|body|blob|document|entitlement|history_access)'
            OR c.data_type IN ('json','jsonb','ARRAY'))
  ) THEN
    RAISE EXCEPTION 'I-04E: the governed membership lifecycle creates no owner, admin or initiator, stores no payload blob and grants no history access';
  END IF;
  -- The three payload identities really ARE the opaque I-04D payload version.
  FOREACH target_table IN ARRAY ARRAY['shared_world_add_member_payload_versions',
                                      'shared_world_remove_member_payload_versions',
                                      'shared_world_rejoin_payload_versions'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint con
       WHERE con.conrelid = ('public.' || target_table)::regclass AND con.contype = 'f'
         AND con.confrelid = 'public.shared_world_governance_proposals'::regclass
         AND pg_get_constraintdef(con.oid) LIKE '%(governance_proposal_id, world_id, governance_operation_kind, id)%'
    ) THEN
      RAISE EXCEPTION 'I-04E: % must bind its exact proposal, World, operation and payload version structurally', target_table;
    END IF;
  END LOOP;
  -- The removal target episode IS the proposal's own excluded episode.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
     WHERE con.conrelid = 'public.shared_world_remove_member_payload_versions'::regclass AND con.contype = 'f'
       AND pg_get_constraintdef(con.oid) LIKE '%(governance_proposal_id, target_membership_episode_id)%'
       AND pg_get_constraintdef(con.oid) LIKE '%(id, excluded_membership_episode_id)%'
  ) THEN
    RAISE EXCEPTION 'I-04E: a removal payload target episode must be the proposal exact excluded episode, structurally';
  END IF;
  -- The invited human IS the payload target, and the invitation carries the
  -- exact proposal, snapshot and payload it was dispatched under.
  FOREACH arg_name IN ARRAY ARRAY['(governance_proposal_id, membership_snapshot_id)',
                                  '(governance_proposal_id, add_member_payload_version_id)',
                                  '(add_member_payload_version_id, target_user_id)'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint con
       WHERE con.conrelid = 'public.shared_world_member_invitations'::regclass AND con.contype = 'f'
         AND pg_get_constraintdef(con.oid) LIKE '%' || arg_name || '%'
    ) THEN
      RAISE EXCEPTION 'I-04E: a member invitation must bind % structurally', arg_name;
    END IF;
  END LOOP;

  -- ===================================================================
  -- The predecessor substrate keeps its posture: still zero-policy, and still
  -- with no application-role privilege. The membership table now carries exactly
  -- the two reviewed I-04E topology triggers, asserted above; no OTHER predecessor
  -- table gains a trigger here.
  -- ===================================================================
  FOREACH target_table IN ARRAY ARRAY['public.shared_worlds',
                                      'public.shared_world_invite_credential_state','public.shared_world_direct_invitations',
                                      'public.shared_world_direct_birth_events','public.shared_world_direct_acceptance_commands',
                                      'public.shared_world_member_left_events','public.shared_world_voluntary_leave_commands',
                                      'public.shared_world_standing_context_grants',
                                      'public.shared_world_standing_context_grant_audience',
                                      'public.shared_world_membership_snapshots','public.shared_world_membership_snapshot_members',
                                      'public.shared_world_governance_proposals','public.shared_world_governance_approvals'] LOOP
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04E: no RLS policy may be added to %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION 'I-04E: migration 0085 installs no trigger on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04E: the Shared substrate stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  -- The canonical episode is untouched by this slice: every column migrations
  -- 0075 and 0083 own is still present, in order. A PREFIX rather than a census,
  -- so this says what 0085 did without forbidding what a later slice may append.
  IF (SELECT array_agg(c.column_name::text ORDER BY c.ordinal_position)
        FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = 'shared_world_membership_episodes')[1:6]
     <> ARRAY['id','world_id','user_id','joined_at','ended_at','end_reason'] THEN
    RAISE EXCEPTION 'I-04E: the canonical membership episode must keep every column its own migrations own, in place';
  END IF;
END$$;

COMMIT;
