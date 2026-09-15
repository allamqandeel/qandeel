-- I-04D - Exact Membership Snapshot + Shared Governance Approval Foundation v1.
--
-- I-04C added the only Standard membership mutation frozen canon makes UNILATERAL.
-- Every remaining one is governed: CW2-03 sections 16, 25, 28, 30 and 31 require
--
--   ADD_MEMBER             -> ALL_CURRENT_MEMBERS
--   REMOVE_MEMBER(target)  -> ALL_CURRENT_MEMBERS_EXCEPT(target)
--   REJOIN_MEMBER          -> ALL_CURRENT_MEMBERS
--   WORLD_SETTINGS_CHANGE  -> ALL_CURRENT_MEMBERS
--   END_WORLD              -> ALL_CURRENT_MEMBERS
--
-- and CW2-02 section 31 / B20 freezes what an approval actually binds:
--
--   exact operation + exact proposed payload/version + exact membership snapshot
--
-- An approval is never a reusable token. If the proposal or the topology changes,
-- authority is recomputed and approvals are re-collected (CW2-02 section 51 is the
-- worked proof: A and B approve inviting C under snapshot M10, B leaves, M10 is
-- stale, and the old approval set cannot create the invitation).
--
-- This migration builds ONLY that shared substrate. It implements no governed
-- operation. There is no add-member, no removal, no rejoin, no settings mutation,
-- no World end, no MEMBER_INVITATION, no history access and no Launch Gate here.
--
-- ===========================================================================
-- WHY TOPOLOGY IDENTITY IS THE EPISODE SET, NOT THE HUMAN SET
-- ===========================================================================
--
-- Current members are the humans holding an OPEN membership episode (CW2-03
-- section 15), and a rejoin is a NEW episode rather than a reopening (section 28 /
-- C25). So this sequence
--
--   A leaves
--   A later rejoins
--
-- restores an identical human set while producing a DIFFERENT episode set. If a
-- snapshot were identified by member count, by sorted user ids, or by anything
-- else that survives that round trip, a governance proposal approved before A left
-- would silently become "current" again afterwards. Frozen I-03D already made the
-- same choice for the human Audience Snapshot, whose fingerprint binds the episode
-- identity precisely so a leave and a rejoin change it.
--
-- Therefore a captured topology here is the exact set of membership_episode_id, and
-- equality against current topology is exact SET equality in BOTH directions. A
-- count comparison and a user-id comparison are both forbidden, because both accept
-- the rejoin case this rule exists to reject.
--
-- ===========================================================================
-- THE PRE-LAUNCH SECURITY BOUNDARY - why nothing here is app-callable
-- ===========================================================================
--
-- CW2-08 section 25 / H18 binds a CURRENT launch gate snapshot before an
-- irreversible commit, and section 40 makes UNKNOWN / UNCONFIGURED / UNSATISFIED /
-- UNTESTED fail closed for the scoped capability. The Connected Worlds launch gate
-- does not exist in this repository, so - exactly as I-04B left the birth core and
-- I-04C left the leave core - these three primitives are implemented fully and left
-- NON-APPLICATION-EXECUTABLE:
--
--   PUBLIC        -> no EXECUTE
--   anon          -> no EXECUTE
--   authenticated -> no EXECUTE
--   service_role  -> no EXECUTE
--
-- The terminal self-assertions below refuse to deploy without that. A later
-- REVIEWED launch-gated consumer is expected and is forbidden nowhere in this file.
-- The approval primitive stays safe under any such wrapper because the approving
-- human is the session subject and there is NO actor, episode or instant parameter
-- at all: a wrapper may RESTRICT whether an operation proceeds, but can never
-- substitute another principal (CW2-01 section 7; CW2-08 section 2 / H1).
--
-- ===========================================================================
-- INITIATION IS NOT AUTHORITY
-- ===========================================================================
--
-- CW2-01 section 5 and CW2-03 section 16 freeze that no initiator, inviter,
-- proposer, creator or survivor gains owner or admin authority, and CW2-01 section
-- 7 freezes that QANDEEL may propose and mediate but can never substitute for
-- required human authority. So the proposal substrate carries NO initiator,
-- proposer, owner or admin column, and the capture primitive records no actor and
-- consults no session identity of any kind: who may open a proposal is a question a
-- later reviewed launch-gated consumer answers, and inventing an answer here would
-- manufacture exactly the initiation authority canon denies. What this slice does
-- freeze is the other half: a proposal never approves itself, and only a human
-- holding a required open episode of the exact captured topology can record an
-- approval.
--
-- ===========================================================================
-- What this migration creates
-- ===========================================================================
--
--   * public.shared_world_membership_snapshots - durable identity for ONE exact
--     captured topology of one World. It carries no status, no current flag, no
--     member list column, no audience payload and no owner: it is an identity and
--     an instant, and a historical row is never rewritten when topology later
--     changes.
--   * public.shared_world_membership_snapshot_members - the exact captured episode
--     set. The primary key IS the membership, so the set cannot carry a duplicate,
--     and user_id is deliberately NOT duplicated here: the immutable episode
--     already identifies the human, and a second copy could disagree with it.
--   * public.shared_world_governance_proposals - one exact proposed operation bound
--     to one exact captured topology. proposed_payload_version_id is an OPAQUE
--     operation-owned immutable identity: I-04D does not own the future add-member,
--     removal, rejoin, settings or end payload schemas, so there is no JSON column,
--     no generic metadata blob and no speculative polymorphic reference. The
--     operation and rule vocabularies carry NO check constraint, for the same
--     reason migration 0083 left end_reason unconstrained: a later reviewed slice
--     must be able to extend governance without a superseding migration, and an
--     enum frozen here would freeze exactly the future this slice must not decide.
--     The v1 vocabulary is enforced where it belongs - inside the sealed primitives
--     that are the only writers.
--   * public.shared_world_governance_approvals - one exact human approval of one
--     exact proposal under one exact captured topology. Two composite foreign keys
--     make the binding structural rather than procedural: (proposal_id,
--     membership_snapshot_id) can only name a proposal that really carries that
--     snapshot, and (membership_snapshot_id, membership_episode_id) can only name an
--     episode that is really inside it. actor_user_id is deliberately NOT stored:
--     the episode identifies the exact human, and the primitive proves that human is
--     the session subject. UNIQUE (proposal_id, membership_episode_id) makes one
--     snapshot episode worth exactly one effective approval, whatever approval id
--     it arrives under. There is no UPDATE path, no DELETE path, no revocation
--     lifecycle and no decline or cancel lifecycle in this slice.
--   * three internal primitives: exact proposal capture, exact human approval, and
--     the CURRENT satisfaction resolver.
--
-- CANONICAL LOCK ORDER - the World row FIRST, in all three:
--
--   capture:  shared_worlds FOR UPDATE -> current episode set -> writes
--   approve:  shared_worlds FOR UPDATE -> proposal FOR UPDATE -> topology -> write
--   resolve:  shared_worlds FOR UPDATE -> proposal FOR UPDATE -> topology -> proof
--
-- Membership topology is a property of the World, not of one human or one proposal,
-- so everything that binds current topology serializes on that one row - which is
-- the row the frozen I-03C consent commands and the frozen I-04C leave already take
-- first. A proposal racing a leave therefore has exactly two canonical outcomes: the
-- proposal captures the old topology and the later leave makes it stale, or the
-- leave commits and the proposal captures the new topology (or refuses when no human
-- remains). No advisory lock, no table lock and no process-local mutex is used, so
-- the order cannot deadlock.
--
-- ONE canonical instant: a single database-owned timestamp is captured once per
-- committed transaction and persisted unchanged. No client timestamp is accepted.
--
-- ===========================================================================
-- What this slice deliberately does NOT do
-- ===========================================================================
--
-- It mutates NOTHING outside its own four tables. It creates no Shared World, ends
-- none, changes no phase, opens no membership episode and closes none, writes no
-- end reason, touches no Standing Context Grant, no audience ceiling and no consent
-- history, reads no Personal context, and adds no trigger that could do any of it
-- implicitly. A satisfied proof is not a mutation and not a permission token: it is
-- a statement that ONE exact proposal is still current and fully approved AT THE
-- MOMENT IT IS ASKED, and a future operation-specific transaction must revalidate
-- it inside the same transaction as its own irreversible mutation. Nothing here
-- persists a permanent approved flag, and nothing here can be consumed twice as
-- authority for two different operations.
--
-- Zero active humans is the inert NO_ACTIVE_HUMAN_MEMBERS state (CW2-03 section 27 /
-- C24), and empty-set unanimity is never approval: a proposal cannot be captured
-- with no current human, a removal cannot leave an empty required set, and the
-- resolver refuses a required count of zero rather than calling it satisfied.
--
-- Every historical migration, 0001-0083 included, is untouched.

BEGIN;

-- 1. Durable identity for ONE exact captured membership topology.
--
--    Deliberately minimal: which World, and when. No mutable status, no "current"
--    boolean, no member-list JSON, no owner / admin / initiator, no permission and
--    no audience payload. A snapshot is a historical fact; when topology later
--    changes, this row is not rewritten, superseded or marked stale - the proposals
--    that bound it simply stop matching current topology.
CREATE TABLE public.shared_world_membership_snapshots (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    captured_at timestamptz NOT NULL,
    CONSTRAINT shared_world_membership_snapshots_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_membership_snapshots_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT
);

-- 2. The exact captured episode set: every, and only, open membership episode of the
--    exact World at the instant the snapshot was taken under the World lock.
--
--    The primary key IS the membership, so one snapshot can never name one episode
--    twice. user_id is NOT duplicated: the immutable episode already identifies the
--    human, and a duplicate could drift from it.
CREATE TABLE public.shared_world_membership_snapshot_members (
    membership_snapshot_id uuid NOT NULL,
    membership_episode_id uuid NOT NULL,
    CONSTRAINT shared_world_membership_snapshot_members_pk
        PRIMARY KEY (membership_snapshot_id, membership_episode_id),
    CONSTRAINT shared_world_membership_snapshot_members_snapshot_fk
        FOREIGN KEY (membership_snapshot_id) REFERENCES public.shared_world_membership_snapshots (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_membership_snapshot_members_episode_fk
        FOREIGN KEY (membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT
);

-- 3. One exact proposed operation, bound to one exact captured topology.
--
--    UNIQUE (membership_snapshot_id) makes the binding one-to-one, so a captured
--    topology can never be re-used to carry a second, different proposal.
--    UNIQUE (id, membership_snapshot_id) is redundant against the primary key and
--    exists for exactly one reason: it lets an approval carry a COMPOSITE foreign
--    key, which is what turns "this approval belongs to this proposal AND to the
--    snapshot that proposal captured" from a procedural check into a structural one.
--
--    excluded_membership_episode_id is the removal target's exact open episode at
--    capture time, and it is NULL for every other v1 operation. The target stays
--    inside the full captured topology - they were a current member and the
--    snapshot is a truthful record of that - while the REQUIRED approval set is
--    what excludes them (CW2-03 section 25 / C20).
CREATE TABLE public.shared_world_governance_proposals (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    membership_snapshot_id uuid NOT NULL,
    operation_kind text NOT NULL,
    proposed_payload_version_id uuid NOT NULL,
    approval_rule text NOT NULL,
    excluded_membership_episode_id uuid,
    created_at timestamptz NOT NULL,
    CONSTRAINT shared_world_governance_proposals_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_governance_proposals_snapshot_key UNIQUE (membership_snapshot_id),
    CONSTRAINT shared_world_governance_proposals_snapshot_binding_key UNIQUE (id, membership_snapshot_id),
    CONSTRAINT shared_world_governance_proposals_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_governance_proposals_snapshot_fk
        FOREIGN KEY (membership_snapshot_id) REFERENCES public.shared_world_membership_snapshots (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_governance_proposals_excluded_episode_fk
        FOREIGN KEY (excluded_membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT
);

-- 4. One exact human approval of one exact proposal under one exact topology.
--
--    The two composite foreign keys ARE the binding law of CW2-02 section 31:
--      (proposal_id, membership_snapshot_id)      -> that exact proposal, carrying
--                                                    that exact captured topology;
--      (membership_snapshot_id, membership_episode_id)
--                                                 -> an episode really inside it.
--    Together they make it structurally impossible to record an approval against a
--    snapshot the proposal did not capture, or by an episode the snapshot does not
--    contain, however the row is produced.
--
--    UNIQUE (proposal_id, membership_episode_id) is the one-effective-approval rule:
--    two different approval ids from the same snapshot episode cannot both stand, so
--    one human can never cover a two-human requirement.
CREATE TABLE public.shared_world_governance_approvals (
    id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    membership_snapshot_id uuid NOT NULL,
    membership_episode_id uuid NOT NULL,
    approved_at timestamptz NOT NULL,
    CONSTRAINT shared_world_governance_approvals_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_governance_approvals_one_per_episode_key UNIQUE (proposal_id, membership_episode_id),
    CONSTRAINT shared_world_governance_approvals_proposal_fk
        FOREIGN KEY (proposal_id, membership_snapshot_id)
        REFERENCES public.shared_world_governance_proposals (id, membership_snapshot_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_governance_approvals_snapshot_member_fk
        FOREIGN KEY (membership_snapshot_id, membership_episode_id)
        REFERENCES public.shared_world_membership_snapshot_members (membership_snapshot_id, membership_episode_id) ON DELETE RESTRICT
);

-- 5. Deny-by-default posture for all four new tables: RLS on, zero policies, every
--    application role revoked from every privilege. There is no direct client read
--    path, no generic permission or governance repository, and no application read
--    boundary in I-04D.
ALTER TABLE public.shared_world_membership_snapshots OWNER TO postgres;
ALTER TABLE public.shared_world_membership_snapshot_members OWNER TO postgres;
ALTER TABLE public.shared_world_governance_proposals OWNER TO postgres;
ALTER TABLE public.shared_world_governance_approvals OWNER TO postgres;
ALTER TABLE public.shared_world_membership_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_membership_snapshot_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_governance_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_governance_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_world_membership_snapshots,
                    public.shared_world_membership_snapshot_members,
                    public.shared_world_governance_proposals,
                    public.shared_world_governance_approvals
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.shared_world_membership_snapshots, public.shared_world_membership_snapshot_members, public.shared_world_governance_proposals, public.shared_world_governance_approvals FROM service_role';
END IF;END$$;

-- 6. PRIMITIVE A - exact proposal capture over the exact current topology.
--
--    The caller supplies two opaque persistence identities, the exact World, the
--    exact operation, its opaque immutable payload version, the rule that operation
--    requires, and - for a removal only - the exact human being removed. The caller
--    supplies NO member list, NO episode list, NO required-approver list, NO
--    approval set, NO member count, NO instant and NO authority of any kind: the
--    topology is read from canonical current state under the World lock, the count
--    is derived from what was actually captured, and the instant comes from the
--    database clock.
--
--    No session identity is consulted and no initiator is recorded, because
--    initiation is not authority. The RETURNS TABLE columns are named so that none
--    of them collides with a column this body reads: an OUT parameter is a plpgsql
--    variable, and an unqualified reference to a same-named column would be an
--    execution-time ambiguity error rather than a compile-time one.
CREATE FUNCTION public.capture_shared_world_governance_proposal_v1(
  p_proposal_id uuid, p_membership_snapshot_id uuid, p_world_id uuid,
  p_operation_kind text, p_proposed_payload_version_id uuid, p_approval_rule text,
  p_excluded_target_user_id uuid DEFAULT NULL
) RETURNS TABLE(outcome text, captured_proposal_id uuid, captured_snapshot_id uuid,
                governed_world_id uuid, proposed_operation_kind text, payload_version_id uuid,
                required_approval_rule text, snapshot_member_count integer,
                required_approval_count integer, snapshot_captured_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_governance_proposals;
  world public.shared_worlds;
  expected_rule text;
  excluded_episode uuid;
  members integer;
  required integer;
  captured_members integer;
  historical_instant timestamptz;
  capture_instant timestamptz;
BEGIN
  IF p_proposal_id IS NULL OR p_membership_snapshot_id IS NULL OR p_world_id IS NULL
     OR p_operation_kind IS NULL OR p_proposed_payload_version_id IS NULL OR p_approval_rule IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- THE EXACT v1 OPERATION / RULE MAPPING. The mapping is validated here, in the
  -- only writer, rather than frozen into a table constraint, so a later reviewed
  -- slice can extend Shared governance without superseding this migration.
  expected_rule := CASE p_operation_kind
                     WHEN 'ADD_MEMBER' THEN 'ALL_CURRENT_MEMBERS'
                     WHEN 'REMOVE_MEMBER' THEN 'ALL_CURRENT_MEMBERS_EXCEPT_TARGET'
                     WHEN 'REJOIN_MEMBER' THEN 'ALL_CURRENT_MEMBERS'
                     WHEN 'WORLD_SETTINGS_CHANGE' THEN 'ALL_CURRENT_MEMBERS'
                     WHEN 'END_WORLD' THEN 'ALL_CURRENT_MEMBERS'
                   END;
  IF expected_rule IS NULL OR expected_rule <> p_approval_rule THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- The exclusion belongs to REMOVE_MEMBER and to nothing else, in both directions.
  IF (p_operation_kind = 'REMOVE_MEMBER') <> (p_excluded_target_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent retry of a
  -- proposal that already committed is answered from immutable history even after
  -- topology has moved on. Nothing below this point reads CURRENT topology: a
  -- historical answer must not start differing because a human later left or
  -- rejoined.
  SELECT * INTO committed FROM public.shared_world_governance_proposals c WHERE c.id = p_proposal_id;
  IF FOUND THEN
    IF committed.membership_snapshot_id = p_membership_snapshot_id AND committed.world_id = p_world_id
       AND committed.operation_kind = p_operation_kind
       AND committed.proposed_payload_version_id = p_proposed_payload_version_id
       AND committed.approval_rule = p_approval_rule
       AND ((p_excluded_target_user_id IS NULL AND committed.excluded_membership_episode_id IS NULL)
            OR (p_excluded_target_user_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM public.shared_world_membership_episodes ex
                   WHERE ex.id = committed.excluded_membership_episode_id
                     AND ex.user_id = p_excluded_target_user_id))) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_membership_snapshots s
         WHERE s.id = committed.membership_snapshot_id AND s.world_id = committed.world_id
           AND s.captured_at = committed.created_at
      ) OR (committed.excluded_membership_episode_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.shared_world_membership_snapshot_members m
         WHERE m.membership_snapshot_id = committed.membership_snapshot_id
           AND m.membership_episode_id = committed.excluded_membership_episode_id
      )) THEN
        RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      SELECT count(*)::integer INTO members FROM public.shared_world_membership_snapshot_members m
       WHERE m.membership_snapshot_id = committed.membership_snapshot_id;
      SELECT count(*)::integer INTO required FROM public.shared_world_membership_snapshot_members m
       WHERE m.membership_snapshot_id = committed.membership_snapshot_id
         AND m.membership_episode_id IS DISTINCT FROM committed.excluded_membership_episode_id;
      IF members = 0 OR required = 0 THEN
        RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      SELECT s.captured_at INTO historical_instant FROM public.shared_world_membership_snapshots s
       WHERE s.id = committed.membership_snapshot_id;
      RETURN QUERY SELECT 'CAPTURED'::text, committed.id, committed.membership_snapshot_id, committed.world_id,
                          committed.operation_kind, committed.proposed_payload_version_id, committed.approval_rule,
                          members, required, historical_instant;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_ID_CONFLICT' USING ERRCODE='23505';
  END IF;
  -- The snapshot id is the SECOND durable identity, and it is never re-bound: a
  -- topology already captured under this id cannot be silently replaced by the
  -- current one under a new proposal id.
  IF EXISTS (SELECT 1 FROM public.shared_world_membership_snapshots s WHERE s.id = p_membership_snapshot_id) THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the exact World row. Topology is a property of
  -- the World, so everything that binds current topology serializes here - which is
  -- also the row the frozen I-03C commands and the frozen I-04C leave take first.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS: now under the World lock, so two concurrent
  -- equivalent captures serialize and the loser returns the committed result
  -- instead of attempting a second capture.
  SELECT * INTO committed FROM public.shared_world_governance_proposals c WHERE c.id = p_proposal_id;
  IF FOUND THEN
    IF committed.membership_snapshot_id = p_membership_snapshot_id AND committed.world_id = p_world_id
       AND committed.operation_kind = p_operation_kind
       AND committed.proposed_payload_version_id = p_proposed_payload_version_id
       AND committed.approval_rule = p_approval_rule
       AND ((p_excluded_target_user_id IS NULL AND committed.excluded_membership_episode_id IS NULL)
            OR (p_excluded_target_user_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM public.shared_world_membership_episodes ex
                   WHERE ex.id = committed.excluded_membership_episode_id
                     AND ex.user_id = p_excluded_target_user_id))) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_membership_snapshots s
         WHERE s.id = committed.membership_snapshot_id AND s.world_id = committed.world_id
           AND s.captured_at = committed.created_at
      ) OR (committed.excluded_membership_episode_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.shared_world_membership_snapshot_members m
         WHERE m.membership_snapshot_id = committed.membership_snapshot_id
           AND m.membership_episode_id = committed.excluded_membership_episode_id
      )) THEN
        RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      SELECT count(*)::integer INTO members FROM public.shared_world_membership_snapshot_members m
       WHERE m.membership_snapshot_id = committed.membership_snapshot_id;
      SELECT count(*)::integer INTO required FROM public.shared_world_membership_snapshot_members m
       WHERE m.membership_snapshot_id = committed.membership_snapshot_id
         AND m.membership_episode_id IS DISTINCT FROM committed.excluded_membership_episode_id;
      IF members = 0 OR required = 0 THEN
        RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      SELECT s.captured_at INTO historical_instant FROM public.shared_world_membership_snapshots s
       WHERE s.id = committed.membership_snapshot_id;
      RETURN QUERY SELECT 'CAPTURED'::text, committed.id, committed.membership_snapshot_id, committed.world_id,
                          committed.operation_kind, committed.proposed_payload_version_id, committed.approval_rule,
                          members, required, historical_instant;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_ID_CONFLICT' USING ERRCODE='23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_membership_snapshots s WHERE s.id = p_membership_snapshot_id) THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- ORDINARY GOVERNANCE IS ACTIVE / STANDARD ONLY. A paired World has its own
  -- single terminal transition, which this slice neither implements nor guesses,
  -- and an archived World blocks ordinary mutation (CW2-03 sections 14 and 35).
  -- All three other legal states reach the one bounded unavailable class.
  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE EXACT CURRENT TOPOLOGY, read under the World lock. Zero current humans is
  -- the inert state, and it is refused rather than treated as trivially unanimous:
  -- empty-set unanimity is never approval.
  SELECT count(*)::integer INTO members
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.ended_at IS NULL;
  IF members = 0 THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE REMOVAL EXCLUSION. The supplied human is resolved to their exact CURRENT
  -- open episode under the same lock - never to a closed one, never to an episode
  -- in another World and never from a caller-supplied episode id. It must resolve
  -- to exactly one; migration 0075's partial unique index already guarantees at
  -- most one, and zero reaches the same bounded class as every other unavailable
  -- case, so no future wrapper can become a membership oracle.
  excluded_episode := NULL;
  IF p_excluded_target_user_id IS NOT NULL THEN
    IF (SELECT count(*) FROM public.shared_world_membership_episodes probe
         WHERE probe.world_id = p_world_id AND probe.user_id = p_excluded_target_user_id
           AND probe.ended_at IS NULL) <> 1 THEN
      RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    SELECT e.id INTO excluded_episode
      FROM public.shared_world_membership_episodes e
     WHERE e.world_id = p_world_id AND e.user_id = p_excluded_target_user_id AND e.ended_at IS NULL;
  END IF;
  -- The required set is the captured topology minus the exclusion, and it may never
  -- be empty: a sole current human cannot be removed through a vacuously satisfied
  -- rule.
  required := members - (CASE WHEN excluded_episode IS NULL THEN 0 ELSE 1 END);
  IF required = 0 THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE ONE canonical instant, read from the database clock exactly once and reused
  -- for both persisted moments.
  capture_instant := clock_timestamp();

  BEGIN
    INSERT INTO public.shared_world_membership_snapshots (id, world_id, captured_at)
    VALUES (p_membership_snapshot_id, p_world_id, capture_instant);

    -- The captured set is derived, never supplied: exactly the open episodes of the
    -- exact World, by EPISODE identity.
    INSERT INTO public.shared_world_membership_snapshot_members (membership_snapshot_id, membership_episode_id)
    SELECT p_membership_snapshot_id, e.id
      FROM public.shared_world_membership_episodes e
     WHERE e.world_id = p_world_id AND e.ended_at IS NULL;
    GET DIAGNOSTICS captured_members = ROW_COUNT;
    IF captured_members <> members THEN
      RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
    -- The removal target stays INSIDE the captured topology; only the required set
    -- excludes them.
    IF excluded_episode IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.shared_world_membership_snapshot_members m
       WHERE m.membership_snapshot_id = p_membership_snapshot_id
         AND m.membership_episode_id = excluded_episode) THEN
      RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.shared_world_governance_proposals
      (id, world_id, membership_snapshot_id, operation_kind, proposed_payload_version_id,
       approval_rule, excluded_membership_episode_id, created_at)
    VALUES (p_proposal_id, p_world_id, p_membership_snapshot_id, p_operation_kind,
            p_proposed_payload_version_id, p_approval_rule, excluded_episode, capture_instant);
  EXCEPTION WHEN unique_violation THEN
    -- DURABLE IDEMPOTENCY, THIRD PASS. Two equivalent captures of the same World
    -- always serialize on the World row above, but two captures sharing a proposal
    -- id across DIFFERENT Worlds do not, and this conflict is their only
    -- serialization point. So durable history is consulted before any conflict is
    -- classified. Nothing was persisted on this path: the whole capture rolls back
    -- together, so a refused proposal never leaves an orphan snapshot behind.
    SELECT * INTO committed FROM public.shared_world_governance_proposals c WHERE c.id = p_proposal_id;
    IF FOUND THEN
      IF committed.membership_snapshot_id = p_membership_snapshot_id AND committed.world_id = p_world_id
         AND committed.operation_kind = p_operation_kind
         AND committed.proposed_payload_version_id = p_proposed_payload_version_id
         AND committed.approval_rule = p_approval_rule
         AND ((p_excluded_target_user_id IS NULL AND committed.excluded_membership_episode_id IS NULL)
              OR (p_excluded_target_user_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.shared_world_membership_episodes ex
                     WHERE ex.id = committed.excluded_membership_episode_id
                       AND ex.user_id = p_excluded_target_user_id))) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.shared_world_membership_snapshots s
           WHERE s.id = committed.membership_snapshot_id AND s.world_id = committed.world_id
             AND s.captured_at = committed.created_at
        ) OR (committed.excluded_membership_episode_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.shared_world_membership_snapshot_members m
           WHERE m.membership_snapshot_id = committed.membership_snapshot_id
             AND m.membership_episode_id = committed.excluded_membership_episode_id
        )) THEN
          RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
        END IF;
        SELECT count(*)::integer INTO members FROM public.shared_world_membership_snapshot_members m
         WHERE m.membership_snapshot_id = committed.membership_snapshot_id;
        SELECT count(*)::integer INTO required FROM public.shared_world_membership_snapshot_members m
         WHERE m.membership_snapshot_id = committed.membership_snapshot_id
           AND m.membership_episode_id IS DISTINCT FROM committed.excluded_membership_episode_id;
        IF members = 0 OR required = 0 THEN
          RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
        END IF;
        SELECT s.captured_at INTO historical_instant FROM public.shared_world_membership_snapshots s
         WHERE s.id = committed.membership_snapshot_id;
        RETURN QUERY SELECT 'CAPTURED'::text, committed.id, committed.membership_snapshot_id, committed.world_id,
                            committed.operation_kind, committed.proposed_payload_version_id, committed.approval_rule,
                            members, required, historical_instant;
        RETURN;
      END IF;
      RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_ID_CONFLICT' USING ERRCODE='23505';
  END;

  -- The committed result is the immutable proposal: what was proposed, over which
  -- captured topology, how many episodes it contains and how many approvals it
  -- requires. It carries no human identity, no current lifecycle and no current
  -- membership, because those are mutable state rather than facts of this capture.
  RETURN QUERY SELECT 'CAPTURED'::text, p_proposal_id, p_membership_snapshot_id, p_world_id,
                      p_operation_kind, p_proposed_payload_version_id, p_approval_rule,
                      members, required, capture_instant;
END$$;

-- 7. PRIMITIVE B - one exact human approval of one exact proposal.
--
--    The approving human is exactly the session subject, derived rather than
--    supplied: there is no actor parameter, no episode parameter and no instant
--    parameter at all, so no caller - including a future launch-gated wrapper, and
--    including QANDEEL - can manufacture a human approval or record one on behalf
--    of somebody else. An unauthenticated call fails closed.
CREATE FUNCTION public.commit_shared_world_governance_approval_v1(
  p_approval_id uuid, p_proposal_id uuid
) RETURNS TABLE(outcome text, committed_approval_id uuid, approved_proposal_id uuid,
                approved_snapshot_id uuid, approver_episode_id uuid, approval_committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.shared_world_governance_approvals;
  proposal public.shared_world_governance_proposals;
  world public.shared_worlds;
  target_world uuid;
  actor_episode uuid;
  approval_instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_approval_id IS NULL OR p_proposal_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent retry by the
  -- same exact human is answered from immutable history even after the proposal has
  -- become stale. Every row read here is immutable; current topology is not read.
  SELECT * INTO committed FROM public.shared_world_governance_approvals a WHERE a.id = p_approval_id;
  IF FOUND THEN
    IF committed.proposal_id = p_proposal_id AND EXISTS (
         SELECT 1 FROM public.shared_world_membership_episodes e
          WHERE e.id = committed.membership_episode_id AND e.user_id = u) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_governance_proposals pr
          JOIN public.shared_world_membership_snapshot_members m
            ON m.membership_snapshot_id = pr.membership_snapshot_id
         WHERE pr.id = committed.proposal_id
           AND pr.membership_snapshot_id = committed.membership_snapshot_id
           AND m.membership_episode_id = committed.membership_episode_id
           AND pr.excluded_membership_episode_id IS DISTINCT FROM committed.membership_episode_id
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'APPROVED'::text, committed.id, committed.proposal_id,
                          committed.membership_snapshot_id, committed.membership_episode_id, committed.approved_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- WORLD-FIRST ORDER. Only enough of the proposal is pre-read to discover which
  -- World this approval belongs to; the proposal itself is not locked before the
  -- World row, ever.
  SELECT pr.world_id INTO target_world FROM public.shared_world_governance_proposals pr WHERE pr.id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the exact World row.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the World lock.
  SELECT * INTO committed FROM public.shared_world_governance_approvals a WHERE a.id = p_approval_id;
  IF FOUND THEN
    IF committed.proposal_id = p_proposal_id AND EXISTS (
         SELECT 1 FROM public.shared_world_membership_episodes e
          WHERE e.id = committed.membership_episode_id AND e.user_id = u) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_governance_proposals pr
          JOIN public.shared_world_membership_snapshot_members m
            ON m.membership_snapshot_id = pr.membership_snapshot_id
         WHERE pr.id = committed.proposal_id
           AND pr.membership_snapshot_id = committed.membership_snapshot_id
           AND m.membership_episode_id = committed.membership_episode_id
           AND pr.excluded_membership_episode_id IS DISTINCT FROM committed.membership_episode_id
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'APPROVED'::text, committed.id, committed.proposal_id,
                          committed.membership_snapshot_id, committed.membership_episode_id, committed.approved_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the exact proposal.
  SELECT * INTO proposal FROM public.shared_world_governance_proposals pr WHERE pr.id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF proposal.world_id <> target_world THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  -- The proposal to snapshot binding, revalidated under both locks.
  IF NOT EXISTS (
    SELECT 1 FROM public.shared_world_membership_snapshots s
     WHERE s.id = proposal.membership_snapshot_id AND s.world_id = proposal.world_id
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- EXACT SET EQUALITY, IN BOTH DIRECTIONS, over EPISODE identity. A count
  -- comparison and a user-id comparison are both forbidden: each of them accepts a
  -- leave followed by a rejoin, which is precisely the case this rule exists to
  -- reject. A mismatch means the captured topology is stale; the historical rows
  -- stay exactly as they are and are never refreshed or revived.
  IF EXISTS (
       SELECT 1 FROM public.shared_world_membership_episodes e
        WHERE e.world_id = proposal.world_id AND e.ended_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_snapshot_members m
                           WHERE m.membership_snapshot_id = proposal.membership_snapshot_id
                             AND m.membership_episode_id = e.id))
     OR EXISTS (
       SELECT 1 FROM public.shared_world_membership_snapshot_members m
        WHERE m.membership_snapshot_id = proposal.membership_snapshot_id
          AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                           WHERE e.id = m.membership_episode_id
                             AND e.world_id = proposal.world_id AND e.ended_at IS NULL)) THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_STALE' USING ERRCODE='40001';
  END IF;

  -- The approver's OWN exact current open episode, resolved from canonical state
  -- rather than from any parameter. A human who is not a current member of this
  -- exact World reaches the same bounded class as a caller naming a proposal that
  -- does not exist.
  SELECT e.id INTO actor_episode
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = proposal.world_id AND e.user_id = u AND e.ended_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- That episode must be a REQUIRED member of the exact captured topology: inside
  -- the snapshot, and never the excluded removal target. A human cannot approve
  -- their own removal.
  IF NOT EXISTS (
       SELECT 1 FROM public.shared_world_membership_snapshot_members m
        WHERE m.membership_snapshot_id = proposal.membership_snapshot_id
          AND m.membership_episode_id = actor_episode)
     OR proposal.excluded_membership_episode_id IS NOT DISTINCT FROM actor_episode THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  approval_instant := clock_timestamp();

  BEGIN
    INSERT INTO public.shared_world_governance_approvals
      (id, proposal_id, membership_snapshot_id, membership_episode_id, approved_at)
    VALUES (p_approval_id, p_proposal_id, proposal.membership_snapshot_id, actor_episode, approval_instant);
  EXCEPTION WHEN unique_violation THEN
    -- DURABLE IDEMPOTENCY, THIRD PASS. Two equivalent approvals by the same human
    -- serialize on the World row above, but a reused approval id arriving for a
    -- different World does not, and this conflict is its only serialization point.
    SELECT * INTO committed FROM public.shared_world_governance_approvals a WHERE a.id = p_approval_id;
    IF FOUND THEN
      IF committed.proposal_id = p_proposal_id AND EXISTS (
           SELECT 1 FROM public.shared_world_membership_episodes e
            WHERE e.id = committed.membership_episode_id AND e.user_id = u) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.shared_world_governance_proposals pr
            JOIN public.shared_world_membership_snapshot_members m
              ON m.membership_snapshot_id = pr.membership_snapshot_id
           WHERE pr.id = committed.proposal_id
             AND pr.membership_snapshot_id = committed.membership_snapshot_id
             AND m.membership_episode_id = committed.membership_episode_id
             AND pr.excluded_membership_episode_id IS DISTINCT FROM committed.membership_episode_id
        ) THEN
          RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
        END IF;
        RETURN QUERY SELECT 'APPROVED'::text, committed.id, committed.proposal_id,
                            committed.membership_snapshot_id, committed.membership_episode_id, committed.approved_at;
        RETURN;
      END IF;
      RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- The approval id is free, so the collision was the ONE-EFFECTIVE-APPROVAL rule:
    -- this exact snapshot episode already approved this exact proposal under another
    -- id. A second effective approval is refused rather than created.
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_ID_CONFLICT' USING ERRCODE='23505';
  END;

  -- The committed result is the immutable approval fact. Current proposal
  -- satisfaction is deliberately NOT cached on this row: it is a question about
  -- current state, and only the resolver below may answer it.
  RETURN QUERY SELECT 'APPROVED'::text, p_approval_id, p_proposal_id,
                      proposal.membership_snapshot_id, actor_episode, approval_instant;
END$$;

-- 8. PRIMITIVE C - the CURRENT governance satisfaction resolver.
--
--    This is not a generic permission token and it is not a reusable capability. A
--    successful resolution means exactly one thing: at the moment it is asked, this
--    ONE proposal is still current - same World state, same operation, same payload
--    version, same exact topology - and every required approval is recorded. It
--    persists nothing, caches nothing and grants nothing. A future
--    operation-specific transaction must revalidate this proof inside the same
--    transaction as its own irreversible mutation, which is why the World and the
--    proposal are locked here in the canonical order rather than merely read.
CREATE FUNCTION public.resolve_shared_world_governance_approval_v1(
  p_proposal_id uuid, p_expected_operation_kind text, p_expected_payload_version_id uuid
) RETURNS TABLE(outcome text, satisfied_proposal_id uuid, satisfied_snapshot_id uuid,
                governed_world_id uuid, satisfied_operation_kind text, satisfied_payload_version_id uuid,
                required_approval_count integer, recorded_required_approval_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  proposal public.shared_world_governance_proposals;
  world public.shared_worlds;
  target_world uuid;
  expected_rule text;
  required integer;
  recorded integer;
BEGIN
  IF p_proposal_id IS NULL OR p_expected_operation_kind IS NULL OR p_expected_payload_version_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- WORLD-FIRST ORDER, exactly as in the approval primitive: pre-read only enough
  -- to discover the World, then lock the World, then the proposal.
  SELECT pr.world_id INTO target_world FROM public.shared_world_governance_proposals pr WHERE pr.id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO proposal FROM public.shared_world_governance_proposals pr WHERE pr.id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF proposal.world_id <> target_world THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- Ordinary governance is ACTIVE / STANDARD only, here as at capture.
  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE EXACT OPERATION AND THE EXACT PAYLOAD VERSION. An approval set collected
  -- for one operation can never authorize another, and approvals of payload version
  -- A can never authorize version B: the caller must name what it is about to
  -- commit, and a mismatch is stale governance rather than a successful proof of
  -- something else.
  IF proposal.operation_kind <> p_expected_operation_kind
     OR proposal.proposed_payload_version_id <> p_expected_payload_version_id THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_STALE' USING ERRCODE='40001';
  END IF;

  -- The stored rule is revalidated against the same v1 mapping the capture
  -- primitive enforces, so a row that somehow carries an operation and a rule that
  -- do not belong together can never resolve as satisfied.
  expected_rule := CASE proposal.operation_kind
                     WHEN 'ADD_MEMBER' THEN 'ALL_CURRENT_MEMBERS'
                     WHEN 'REMOVE_MEMBER' THEN 'ALL_CURRENT_MEMBERS_EXCEPT_TARGET'
                     WHEN 'REJOIN_MEMBER' THEN 'ALL_CURRENT_MEMBERS'
                     WHEN 'WORLD_SETTINGS_CHANGE' THEN 'ALL_CURRENT_MEMBERS'
                     WHEN 'END_WORLD' THEN 'ALL_CURRENT_MEMBERS'
                   END;
  IF expected_rule IS NULL OR expected_rule <> proposal.approval_rule
     OR (proposal.approval_rule = 'ALL_CURRENT_MEMBERS_EXCEPT_TARGET')
        <> (proposal.excluded_membership_episode_id IS NOT NULL) THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.shared_world_membership_snapshots s
     WHERE s.id = proposal.membership_snapshot_id AND s.world_id = proposal.world_id
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- EXACT SET EQUALITY, IN BOTH DIRECTIONS, over EPISODE identity.
  IF EXISTS (
       SELECT 1 FROM public.shared_world_membership_episodes e
        WHERE e.world_id = proposal.world_id AND e.ended_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_snapshot_members m
                           WHERE m.membership_snapshot_id = proposal.membership_snapshot_id
                             AND m.membership_episode_id = e.id))
     OR EXISTS (
       SELECT 1 FROM public.shared_world_membership_snapshot_members m
        WHERE m.membership_snapshot_id = proposal.membership_snapshot_id
          AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                           WHERE e.id = m.membership_episode_id
                             AND e.world_id = proposal.world_id AND e.ended_at IS NULL)) THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_STALE' USING ERRCODE='40001';
  END IF;

  -- THE REQUIRED SET, derived from the rule and the exclusion rather than stored.
  -- A required count of zero is never satisfied governance.
  SELECT count(*)::integer INTO required
    FROM public.shared_world_membership_snapshot_members m
   WHERE m.membership_snapshot_id = proposal.membership_snapshot_id
     AND m.membership_episode_id IS DISTINCT FROM proposal.excluded_membership_episode_id;
  IF required = 0 THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- EVERY required episode carries an approval of THIS exact proposal under THIS
  -- exact captured topology. The unique binding makes at least one mean exactly one.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_membership_snapshot_members m
     WHERE m.membership_snapshot_id = proposal.membership_snapshot_id
       AND m.membership_episode_id IS DISTINCT FROM proposal.excluded_membership_episode_id
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_governance_approvals a
                        WHERE a.proposal_id = proposal.id
                          AND a.membership_snapshot_id = proposal.membership_snapshot_id
                          AND a.membership_episode_id = m.membership_episode_id)
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_APPROVALS_INCOMPLETE' USING ERRCODE='55000';
  END IF;
  SELECT count(*)::integer INTO recorded
    FROM public.shared_world_governance_approvals a
   WHERE a.proposal_id = proposal.id
     AND a.membership_snapshot_id = proposal.membership_snapshot_id
     AND a.membership_episode_id IS DISTINCT FROM proposal.excluded_membership_episode_id;
  IF recorded <> required THEN
    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_APPROVALS_INCOMPLETE' USING ERRCODE='55000';
  END IF;

  RETURN QUERY SELECT 'SATISFIED'::text, proposal.id, proposal.membership_snapshot_id, proposal.world_id,
                      proposal.operation_kind, proposal.proposed_payload_version_id, required, recorded;
END$$;

-- 9. Ownership and THE PRE-LAUNCH ACL: all three primitives are executable by no
--    application role at all. There is no GRANT statement in this migration.
ALTER FUNCTION public.capture_shared_world_governance_proposal_v1(uuid, uuid, uuid, text, uuid, text, uuid) OWNER TO postgres;
ALTER FUNCTION public.commit_shared_world_governance_approval_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_shared_world_governance_approval_v1(uuid, text, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.capture_shared_world_governance_proposal_v1(uuid, uuid, uuid, text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_shared_world_governance_approval_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_shared_world_governance_approval_v1(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.capture_shared_world_governance_proposal_v1(uuid, uuid, uuid, text, uuid, text, uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_governance_approval_v1(uuid, uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.resolve_shared_world_governance_approval_v1(uuid, text, uuid) FROM service_role';
END IF;END$$;

-- 10. Terminal self-assertions. The migration refuses to deploy a governance
--     foundation that is application-executable, caller-identified, unpinned,
--     wrongly ordered, multi-clocked, topology-guessing, count-comparing,
--     membership-mutating, World-mutating, Standing-Context-touching,
--     Personal-context-reading, policy- or trigger-bearing.
DO $$
DECLARE
  capture_fn text := 'public.capture_shared_world_governance_proposal_v1(uuid,uuid,uuid,text,uuid,text,uuid)';
  approve_fn text := 'public.commit_shared_world_governance_approval_v1(uuid,uuid)';
  resolve_fn text := 'public.resolve_shared_world_governance_approval_v1(uuid,text,uuid)';
  own_tables text[] := ARRAY['public.shared_world_membership_snapshots',
                             'public.shared_world_membership_snapshot_members',
                             'public.shared_world_governance_proposals',
                             'public.shared_world_governance_approvals'];
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
  episode_pos integer;
  snapshot_pos integer;
  member_pos integer;
  proposal_pos integer;
  proposal_lock_pos integer;
  approval_pos integer;
  episode_columns text[];
  -- The two halves of the exact both-directions topology comparison, as they must
  -- appear in the stored source of every primitive that consults current topology.
  current_not_in_snapshot constant text :=
    'AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_snapshot_members m';
  snapshot_not_in_current constant text :=
    'AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e';
BEGIN
  -- ===================================================================
  -- Every primitive: ownership, security, pinning, volatility, and the
  -- PRE-LAUNCH SECURITY BOUNDARY asserted rather than commented. Each assertion is
  -- about THESE primitives only; a later reviewed launch-gated consumer is expected
  -- and is forbidden nowhere in this migration.
  -- ===================================================================
  FOREACH fn_name IN ARRAY ARRAY[capture_fn, approve_fn, resolve_fn] LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn_name::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-04D: % must be owned by postgres', fn_name; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-04D: % must be SECURITY DEFINER', fn_name; END IF;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-04D: % takes row locks and must be VOLATILE', fn_name; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-04D: % must pin an empty search_path', fn_name;
    END IF;
    IF has_function_privilege('public', fn_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04D: PUBLIC must not execute the governance foundation before the launch gate exists';
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, fn_name, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-04D: % must not execute the governance foundation before the launch gate exists', target_role;
      END IF;
    END LOOP;

    -- No Personal context, no Standing Context or consent-history mutation, no
    -- paired-phase or Matching state, nothing deleted, and no lock that is not a
    -- canonical row lock.
    IF p.prosrc ~* 'conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|consent|matching|introduction' THEN
      RAISE EXCEPTION 'I-04D: % must not read Personal context or touch Standing Context state', fn_name;
    END IF;
    IF p.prosrc ~* 'DELETE FROM' OR p.prosrc ~* 'TRUNCATE' THEN
      RAISE EXCEPTION 'I-04D: % may never delete canonical history', fn_name;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' THEN
      RAISE EXCEPTION 'I-04D: % locks rows in the canonical order, never a table and never an advisory key', fn_name;
    END IF;
    -- I-04D mutates NOTHING outside its own four tables: no World, no membership
    -- episode, and therefore no add, removal, rejoin, settings change or closure.
    IF p.prosrc ~ 'UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds' THEN
      RAISE EXCEPTION 'I-04D: % must not create, close or mutate a Shared World', fn_name;
    END IF;
    IF p.prosrc ~ 'UPDATE public\.shared_world_membership_episodes|INSERT INTO public\.shared_world_membership_episodes' THEN
      RAISE EXCEPTION 'I-04D: % must not open or close a membership episode', fn_name;
    END IF;
    IF p.prosrc ~ 'READ_ONLY_CLOSED|closed_at|birth_basis|VOLUNTARY_LEAVE|REMOVED|MEMBER_JOINED|MEMBER_LEFT|WORLD_ENDED' THEN
      RAISE EXCEPTION 'I-04D: % must not write a lifecycle, closure or membership-event literal it does not own', fn_name;
    END IF;
    -- Ordinary governance is ACTIVE / STANDARD, positively, in capture and in the
    -- resolver. The approval primitive deliberately does not repeat the check: a
    -- closed World terminates its open episodes, which makes the captured topology
    -- stale through the equality below, and the resolver is the only place a proof
    -- can be claimed.
    IF fn_name <> approve_fn AND p.prosrc !~ 'world\.lifecycle <> ''ACTIVE'' OR world\.phase <> ''STANDARD''' THEN
      RAISE EXCEPTION 'I-04D: % must refuse every state that is not ACTIVE / STANDARD', fn_name;
    END IF;
    -- No second clock read anywhere.
    IF p.prosrc ~ 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp' THEN
      RAISE EXCEPTION 'I-04D: % must persist one database-owned instant, never a second clock read', fn_name;
    END IF;
  END LOOP;

  -- ===================================================================
  -- PRIMITIVE A: the caller supplies no topology and no authority.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes, pr.proargtypes INTO p
    FROM pg_proc pr WHERE pr.oid = capture_fn::regprocedure;
  -- Argument NAMES come from proargnames / proargmodes and TYPES from proargtypes.
  -- A rendered signature is not the authority: pg_get_function_arguments folds this
  -- function's RETURNS TABLE columns into the same string, and
  -- pg_get_function_identity_arguments renders no names at all.
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
         array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
    INTO in_names, out_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_proposal_id','p_membership_snapshot_id','p_world_id','p_operation_kind',
                       'p_proposed_payload_version_id','p_approval_rule','p_excluded_target_user_id'] THEN
    RAISE EXCEPTION 'I-04D: the capture primitive must accept exactly the frozen parameter list, not %', in_names;
  END IF;
  SELECT array_agg(t.typname::text ORDER BY a.ord) INTO in_types
    FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
    JOIN pg_type t ON t.oid = a.argtype;
  IF in_types <> ARRAY['uuid','uuid','uuid','text','uuid','text','uuid'] THEN
    RAISE EXCEPTION 'I-04D: the capture primitive must accept only the frozen parameter types, not %', in_types;
  END IF;
  -- The ban is non-vacuous by construction: the exact list above proves these
  -- really are the parameter names being scanned. The removal target is the ONE
  -- human identity a caller may name, and everything the caller must never supply
  -- is refused: no member or episode list, no approver or approval set, no member
  -- count, no clock, and no initiator, owner, admin or launch result.
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'initiator|proposer|actor|owner|admin|approver|approval_set|member_ids|episode|audience|count|launch|gate|timestamp|instant|_at$' THEN
      RAISE EXCEPTION 'I-04D: the capture primitive must not accept a topology, approver, count, clock or authority parameter';
    END IF;
  END LOOP;
  IF out_names <> ARRAY['outcome','captured_proposal_id','captured_snapshot_id','governed_world_id',
                        'proposed_operation_kind','payload_version_id','required_approval_rule',
                        'snapshot_member_count','required_approval_count','snapshot_captured_at'] THEN
    RAISE EXCEPTION 'I-04D: the capture primitive must return exactly the bounded immutable result, not %', out_names;
  END IF;
  -- INITIATION IS NOT AUTHORITY: capture consults no session identity and records
  -- no actor, so it invents no proposal-initiation authority semantics.
  IF p.prosrc ~ 'auth\.uid' THEN
    RAISE EXCEPTION 'I-04D: capture must not derive or record an initiator: initiation is not authority';
  END IF;
  -- THE EXACT v1 OPERATION / RULE MAPPING, present in the only writer.
  FOREACH arg_name IN ARRAY ARRAY[
      'WHEN ''ADD_MEMBER'' THEN ''ALL_CURRENT_MEMBERS''',
      'WHEN ''REMOVE_MEMBER'' THEN ''ALL_CURRENT_MEMBERS_EXCEPT_TARGET''',
      'WHEN ''REJOIN_MEMBER'' THEN ''ALL_CURRENT_MEMBERS''',
      'WHEN ''WORLD_SETTINGS_CHANGE'' THEN ''ALL_CURRENT_MEMBERS''',
      'WHEN ''END_WORLD'' THEN ''ALL_CURRENT_MEMBERS'''] LOOP
    IF strpos(p.prosrc, arg_name) = 0 THEN
      RAISE EXCEPTION 'I-04D: the capture primitive must map every v1 operation to its exact rule: %', arg_name;
    END IF;
  END LOOP;
  IF p.prosrc !~ 'IF expected_rule IS NULL OR expected_rule <> p_approval_rule THEN' THEN
    RAISE EXCEPTION 'I-04D: an unsupported operation or a mismatched rule must be refused';
  END IF;
  IF p.prosrc !~ '\(p_operation_kind = ''REMOVE_MEMBER''\) <> \(p_excluded_target_user_id IS NOT NULL\)' THEN
    RAISE EXCEPTION 'I-04D: the exclusion belongs to REMOVE_MEMBER and to nothing else, in both directions';
  END IF;
  -- THE CAPTURED SET IS DERIVED, by EPISODE identity, from canonical current state.
  IF p.prosrc !~ 'INSERT INTO public\.shared_world_membership_snapshot_members \(membership_snapshot_id, membership_episode_id\)\s*\n\s*SELECT p_membership_snapshot_id, e\.id\s*\n\s*FROM public\.shared_world_membership_episodes e\s*\n\s*WHERE e\.world_id = p_world_id AND e\.ended_at IS NULL' THEN
    RAISE EXCEPTION 'I-04D: the captured topology must be exactly the open episodes of the exact World, by episode identity';
  END IF;
  -- Zero current humans refuses, and a removal may never leave an empty required set.
  IF p.prosrc !~ 'IF members = 0 THEN\s*\n\s*RAISE EXCEPTION ''SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE''' THEN
    RAISE EXCEPTION 'I-04D: a proposal must be refused when no current human remains: empty-set unanimity is never approval';
  END IF;
  IF p.prosrc !~ 'IF required = 0 THEN\s*\n\s*RAISE EXCEPTION ''SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE''' THEN
    RAISE EXCEPTION 'I-04D: a removal may never be captured with an empty required approval set';
  END IF;
  -- THE CANONICAL LOCK ORDER: the exact World row, then the current episode set,
  -- then the snapshot, its members and the proposal.
  world_pos := strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE');
  -- The first occurrence of this predicate IS the under-lock current-topology read:
  -- every idempotency pass above it reads immutable history and never names it.
  episode_pos := strpos(p.prosrc, 'WHERE e.world_id = p_world_id AND e.ended_at IS NULL');
  snapshot_pos := strpos(p.prosrc, 'INSERT INTO public.shared_world_membership_snapshots');
  member_pos := strpos(p.prosrc, 'INSERT INTO public.shared_world_membership_snapshot_members');
  proposal_pos := strpos(p.prosrc, 'INSERT INTO public.shared_world_governance_proposals');
  IF world_pos = 0 OR episode_pos = 0 OR snapshot_pos = 0 OR member_pos = 0 OR proposal_pos = 0
     OR world_pos > episode_pos OR episode_pos > snapshot_pos OR snapshot_pos > member_pos
     OR member_pos > proposal_pos THEN
    RAISE EXCEPTION 'I-04D: capture must lock the exact World row, then read current topology, before any write';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'FOR UPDATE', ''))) / length('FOR UPDATE') <> 1 THEN
    RAISE EXCEPTION 'I-04D: capture takes exactly one row lock, and it is the World row';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'capture_instant := ', ''))) / length('capture_instant := ') <> 1 THEN
    RAISE EXCEPTION 'I-04D: the canonical capture instant must be captured exactly once';
  END IF;
  IF p.prosrc !~ 'capture_instant := clock_timestamp\(\);' THEN
    RAISE EXCEPTION 'I-04D: the capture instant must come from the database clock, never from a caller';
  END IF;
  -- DURABLE RESULT IDEMPOTENCY: three passes, each returning what the proposal
  -- COMMITTED, each failing closed on a fact that stopped being coherent, and none
  -- of them reading current topology.
  IF (length(p.prosrc) - length(replace(p.prosrc,
        'RETURN QUERY SELECT ''CAPTURED''::text, committed.id, committed.membership_snapshot_id, committed.world_id,', '')))
     / length('RETURN QUERY SELECT ''CAPTURED''::text, committed.id, committed.membership_snapshot_id, committed.world_id,') <> 3 THEN
    RAISE EXCEPTION 'I-04D: every equivalent retry must return the proposal this capture committed';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'AND s.captured_at = committed.created_at', '')))
     / length('AND s.captured_at = committed.created_at') <> 3 THEN
    RAISE EXCEPTION 'I-04D: every equivalent retry must fail closed on a captured topology that stopped being coherent';
  END IF;
  IF p.prosrc ~ 'RETURN QUERY SELECT[^;]*(world\.|e\.ended_at|captured_members)' THEN
    RAISE EXCEPTION 'I-04D: a committed capture result must never carry current World or current membership state';
  END IF;

  -- ===================================================================
  -- PRIMITIVE B: the approving human is the session subject, and nothing else.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes, pr.proargtypes INTO p
    FROM pg_proc pr WHERE pr.oid = approve_fn::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
         array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
    INTO in_names, out_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_approval_id','p_proposal_id'] THEN
    RAISE EXCEPTION 'I-04D: the approval primitive must accept exactly two opaque identities, not %', in_names;
  END IF;
  SELECT array_agg(t.typname::text ORDER BY a.ord) INTO in_types
    FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
    JOIN pg_type t ON t.oid = a.argtype;
  IF in_types <> ARRAY['uuid','uuid'] THEN
    RAISE EXCEPTION 'I-04D: the approval primitive must accept only opaque uuid identities, not %', in_types;
  END IF;
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'user_id|actor|approver|member|episode|snapshot|timestamp|instant|count|_at$' THEN
      RAISE EXCEPTION 'I-04D: the approval primitive must not accept an actor, episode, snapshot, count or clock parameter';
    END IF;
  END LOOP;
  IF out_names <> ARRAY['outcome','committed_approval_id','approved_proposal_id','approved_snapshot_id',
                        'approver_episode_id','approval_committed_at'] THEN
    RAISE EXCEPTION 'I-04D: the approval primitive must return exactly the bounded immutable result, not %', out_names;
  END IF;
  IF p.prosrc !~ 'u uuid := auth\.uid\(\)' THEN
    RAISE EXCEPTION 'I-04D: the approving human must be derived from the session subject, never supplied';
  END IF;
  IF p.prosrc !~ 'IF u IS NULL THEN\s*\n\s*RAISE EXCEPTION ''SHARED_WORLD_GOVERNANCE_AUTHENTICATION_REQUIRED''' THEN
    RAISE EXCEPTION 'I-04D: a call with no human session identity must fail closed, so QANDEEL can never approve';
  END IF;
  IF p.prosrc !~ 'WHERE e\.world_id = proposal\.world_id AND e\.user_id = u AND e\.ended_at IS NULL' THEN
    RAISE EXCEPTION 'I-04D: the approver episode must be the caller own CURRENT open episode of the exact World';
  END IF;
  IF p.prosrc !~ 'proposal\.excluded_membership_episode_id IS NOT DISTINCT FROM actor_episode' THEN
    RAISE EXCEPTION 'I-04D: the excluded removal target must never be able to approve their own removal';
  END IF;
  -- WORLD-FIRST, never proposal-first.
  world_pos := strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
  proposal_lock_pos := strpos(p.prosrc, 'WHERE pr.id = p_proposal_id FOR UPDATE');
  episode_pos := strpos(p.prosrc, 'SELECT e.id INTO actor_episode');
  approval_pos := strpos(p.prosrc, 'INSERT INTO public.shared_world_governance_approvals');
  IF world_pos = 0 OR proposal_lock_pos = 0 OR episode_pos = 0 OR approval_pos = 0
     OR world_pos > proposal_lock_pos OR proposal_lock_pos > episode_pos OR episode_pos > approval_pos THEN
    RAISE EXCEPTION 'I-04D: an approval must lock the exact World row, then the exact proposal, before any write';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'FOR UPDATE', ''))) / length('FOR UPDATE') <> 2 THEN
    RAISE EXCEPTION 'I-04D: the approval primitive takes exactly two row locks: the World and the proposal';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'approval_instant := ', ''))) / length('approval_instant := ') <> 1 THEN
    RAISE EXCEPTION 'I-04D: the canonical approval instant must be captured exactly once';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc,
        'RETURN QUERY SELECT ''APPROVED''::text, committed.id, committed.proposal_id,', '')))
     / length('RETURN QUERY SELECT ''APPROVED''::text, committed.id, committed.proposal_id,') <> 3 THEN
    RAISE EXCEPTION 'I-04D: every equivalent approval retry must return the approval this command committed';
  END IF;

  -- ===================================================================
  -- PRIMITIVE C: a current proof, never a stored permission.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes, pr.proargtypes INTO p
    FROM pg_proc pr WHERE pr.oid = resolve_fn::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
         array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
    INTO in_names, out_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_proposal_id','p_expected_operation_kind','p_expected_payload_version_id'] THEN
    RAISE EXCEPTION 'I-04D: the resolver must accept exactly the proposal and what the caller expects it to be, not %', in_names;
  END IF;
  SELECT array_agg(t.typname::text ORDER BY a.ord) INTO in_types
    FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
    JOIN pg_type t ON t.oid = a.argtype;
  IF in_types <> ARRAY['uuid','text','uuid'] THEN
    RAISE EXCEPTION 'I-04D: the resolver must accept only the frozen parameter types, not %', in_types;
  END IF;
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'user_id|actor|approver|member|episode|snapshot|count|timestamp|_at$' THEN
      RAISE EXCEPTION 'I-04D: the resolver must not accept an actor, approver, topology or count parameter';
    END IF;
  END LOOP;
  IF out_names <> ARRAY['outcome','satisfied_proposal_id','satisfied_snapshot_id','governed_world_id',
                        'satisfied_operation_kind','satisfied_payload_version_id',
                        'required_approval_count','recorded_required_approval_count'] THEN
    RAISE EXCEPTION 'I-04D: the resolver must return exactly the bounded proof, not %', out_names;
  END IF;
  IF p.prosrc ~ 'auth\.uid' THEN
    RAISE EXCEPTION 'I-04D: the resolver proves governance, never the identity of whoever asks';
  END IF;
  IF p.prosrc !~ 'proposal\.operation_kind <> p_expected_operation_kind\s*\n\s*OR proposal\.proposed_payload_version_id <> p_expected_payload_version_id' THEN
    RAISE EXCEPTION 'I-04D: the resolver must match the exact operation AND the exact payload version';
  END IF;
  IF p.prosrc !~ 'IF required = 0 THEN' THEN
    RAISE EXCEPTION 'I-04D: a required approval count of zero is never satisfied governance';
  END IF;
  IF p.prosrc !~ 'IF recorded <> required THEN' THEN
    RAISE EXCEPTION 'I-04D: satisfaction requires the exact required set to be covered, never a partial one';
  END IF;
  -- The proof is never persisted, cached or stamped onto a row.
  IF p.prosrc ~ 'INSERT INTO|UPDATE public\.' THEN
    RAISE EXCEPTION 'I-04D: the resolver must persist nothing: a proof is not a stored permission';
  END IF;
  world_pos := strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
  proposal_lock_pos := strpos(p.prosrc, 'WHERE pr.id = p_proposal_id FOR UPDATE');
  IF world_pos = 0 OR proposal_lock_pos = 0 OR world_pos > proposal_lock_pos THEN
    RAISE EXCEPTION 'I-04D: the resolver must lock the exact World row before the exact proposal';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'FOR UPDATE', ''))) / length('FOR UPDATE') <> 2 THEN
    RAISE EXCEPTION 'I-04D: the resolver takes exactly two row locks: the World and the proposal';
  END IF;

  -- ===================================================================
  -- EXACT TOPOLOGY EQUALITY, in both primitives that consult current topology.
  -- A count comparison or a user-id comparison would accept a leave followed by a
  -- rejoin, which is exactly the case this rule exists to reject.
  -- ===================================================================
  FOREACH fn_name IN ARRAY ARRAY[approve_fn, resolve_fn] LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn_name::regprocedure;
    IF strpos(p.prosrc, current_not_in_snapshot) = 0 OR strpos(p.prosrc, snapshot_not_in_current) = 0 THEN
      RAISE EXCEPTION 'I-04D: % must compare the captured topology to current topology in BOTH directions', fn_name;
    END IF;
    IF p.prosrc !~ 'AND m\.membership_episode_id = e\.id' OR p.prosrc !~ 'WHERE e\.id = m\.membership_episode_id' THEN
      RAISE EXCEPTION 'I-04D: % must compare EPISODE identity, never a count and never a user id', fn_name;
    END IF;
    -- A count comparison between the two sets would accept a leave followed by a
    -- rejoin, and so would a user-id comparison. Neither may stand in for the set.
    IF p.prosrc ~ 'count\(\*\)[^;]*shared_world_membership_snapshot_members[^;]*=[^;]*count\(\*\)'
       OR p.prosrc ~ 'm\.membership_episode_id[^;\n]*=[^;\n]*e\.user_id|e\.user_id[^;\n]*=[^;\n]*m\.' THEN
      RAISE EXCEPTION 'I-04D: % must not substitute a count or a user-id comparison for exact topology equality', fn_name;
    END IF;
  END LOOP;

  -- ===================================================================
  -- Exactly the three primitives this slice owns, each with one overload.
  -- ===================================================================
  FOREACH arg_name IN ARRAY ARRAY['capture_shared_world_governance_proposal_v1',
                                  'commit_shared_world_governance_approval_v1',
                                  'resolve_shared_world_governance_approval_v1'] LOOP
    IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
         WHERE n.nspname = 'public' AND pr.proname = arg_name) <> 1 THEN
      RAISE EXCEPTION 'I-04D: exactly one % must exist, with one overload', arg_name;
    END IF;
  END LOOP;

  -- ===================================================================
  -- The four new tables: unreachable, policy-free, trigger-free, and neither a
  -- generic permission engine nor a superior-authority record.
  -- ===================================================================
  FOREACH target_table IN ARRAY own_tables LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN RAISE EXCEPTION 'I-04D: row level security must be enabled on %', target_table; END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04D: no RLS policy may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION 'I-04D: no trigger may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = target_table::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-04D: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04D: direct table access stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  -- Proposing creates no owner, admin or initiator; the payload version stays
  -- opaque; and nothing here is a generic permission or capability store.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_world_membership_snapshots','shared_world_membership_snapshot_members',
                            'shared_world_governance_proposals','shared_world_governance_approvals')
       AND (c.column_name ~* '(owner|admin|creator|initiator|proposer|survivor|privilege|capability|permission|scope|metadata|status|state|vote|weight|token|body|blob|document)'
            OR c.data_type IN ('json','jsonb','ARRAY'))
  ) THEN
    RAISE EXCEPTION 'I-04D: governance creates no owner, admin or initiator, stores no payload blob and is not a permission engine';
  END IF;
  -- The proposed payload/version identity stays OPAQUE. I-04D does not own the
  -- future add-member, removal, rejoin, settings or end payload schemas, so this is
  -- an immutable operation-owned uuid and never a structure this slice can read.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name = 'shared_world_governance_proposals'
       AND c.column_name = 'proposed_payload_version_id' AND c.data_type = 'uuid' AND c.is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'I-04D: the proposed payload version must be an opaque non-null uuid identity';
  END IF;
  -- The approval carries no duplicated human identity: the exact approver is the
  -- immutable membership episode, and a second copy could disagree with it.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_world_governance_approvals','shared_world_membership_snapshot_members')
       AND c.column_name = 'actor_user_id'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_world_governance_approvals','shared_world_membership_snapshot_members')
       AND c.column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'I-04D: the exact human is the membership episode, never a duplicated user id';
  END IF;

  -- ===================================================================
  -- The predecessor substrate keeps its posture: still zero-policy, still with no
  -- application-role privilege, and still with no trigger coupling membership to
  -- Standing Context state in either direction.
  -- ===================================================================
  FOREACH target_table IN ARRAY ARRAY['public.shared_worlds','public.shared_world_membership_episodes',
                                      'public.shared_world_invite_credential_state','public.shared_world_direct_invitations',
                                      'public.shared_world_direct_birth_events','public.shared_world_direct_acceptance_commands',
                                      'public.shared_world_member_left_events','public.shared_world_voluntary_leave_commands',
                                      'public.shared_world_standing_context_grants',
                                      'public.shared_world_standing_context_grant_audience'] LOOP
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04D: no RLS policy may be added to %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION 'I-04D: no trigger may couple governance to membership or Standing Context state on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04D: the Shared substrate stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- The canonical episode is untouched by this slice: every column migrations 0075
  -- and 0083 own is still present, in order. Asserted as a PREFIX rather than as a
  -- census of the live column list, so this says what 0084 did without forbidding
  -- what a later authorized slice may append.
  SELECT array_agg(c.column_name::text ORDER BY c.ordinal_position) INTO episode_columns
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = 'shared_world_membership_episodes';
  IF episode_columns[1:6] <> ARRAY['id','world_id','user_id','joined_at','ended_at','end_reason'] THEN
    RAISE EXCEPTION 'I-04D: the canonical membership episode must keep every column its own migrations own, in place, not %', episode_columns;
  END IF;
END$$;

COMMIT;
