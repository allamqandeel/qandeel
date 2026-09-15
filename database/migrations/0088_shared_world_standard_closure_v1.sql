-- I-04F - Standard World Closure v1 (PART B).
--
-- The second frozen Shared law missing from persistence after I-04E:
--
--   ACTIVE / STANDARD
--     -> unanimous END_WORLD
--     -> READ_ONLY_CLOSED / STANDARD
--     -> bounded historical viewing without fake active membership
--
-- I-04D already maps END_WORLD -> ALL_CURRENT_MEMBERS and I-04E deliberately left
-- the operation unimplemented. This migration implements it, and the CW2-03 Final
-- Freeze Review tightening F1 that comes with it. It lives in its own migration
-- rather than beside 0087 because closure and selective history have different
-- durable ownership: 0087 owns historical visibility, packages and grants, and
-- 0088 owns World lifecycle closure and the closed-view entitlement. They ship,
-- review and test together as one I-04F slice.
--
-- ===========================================================================
-- ARCHIVAL CLOSURE IS NOT DELETION
-- ===========================================================================
--
-- CW2-03 section 31 freezes that World end is archival closure. The World id, its
-- phase, its whole history, its settings, its governance record and every
-- membership episode ever recorded all remain exactly as they were. What changes
-- is the lifecycle, the closure instant, and the fact that no membership episode
-- stays open.
--
-- ===========================================================================
-- CLOSED VIEWING IS ENTITLEMENT, NEVER MEMBERSHIP
-- ===========================================================================
--
-- CW2-03 sections 32-33 and Final Freeze Review F1: if READ_ONLY_CLOSED retained
-- "current members", later governance code could mistakenly treat them as active
-- participants; if closure simply ended membership, entitled people would lose
-- the Product-promised ability to view the World as history. So closure does BOTH
-- at the same instant: every open episode closes in place with
--
--   end_reason = WORLD_CLOSED
--
-- and every exact current human receives one bounded
--
--   CLOSED_WORLD_VIEW_ENTITLEMENT
--
-- persisted here as one row per (world_id, user_id) plus its exact item snapshot.
-- The entitlement permits historical viewing and nothing else: it grants no new
-- conversation, no governance, no add / remove / rejoin, no new history grant and
-- no private-context reasoning - and it needs no rule to say so, because every
-- ordinary Shared mutation primitive in migrations 0083, 0085, 0086 and 0087
-- already requires ACTIVE / STANDARD and therefore refuses a closed World.
--
-- ===========================================================================
-- WHY THE ENTITLEMENT IS AN EXACT ITEM SNAPSHOT
-- ===========================================================================
--
-- The entitlement persists the EXACT set of history items each human could
-- resolve immediately BEFORE closure, rather than a broad membership-or-grant
-- rule evaluated later. That is deliberate:
--
--   * future new material cannot widen a closed entitlement;
--   * future new grants cannot widen it;
--   * a future rejoin or episode object cannot widen it;
--   * but later owner deletion or unavailability still NARROWS it dynamically,
--     because the closed reader always re-checks current availability. An
--     entitlement can never reconstruct owner-deleted source (CW2-01 A18,
--     CW2-03 section 37).
--
-- A closure entitlement may legitimately contain ZERO item rows and still
-- truthfully represent a historical World viewer.
--
-- The entitled human set is exactly the current human membership snapshot that
-- unanimously approved the exact END_WORLD mutation. A human who had already left
-- or been removed before closure is NOT silently restored to browsing merely
-- because they authored historical material or hold an old grant: their
-- own-material control remains independent and never becomes World browsing
-- (CW2-03 section 24 / C21).
--
-- ===========================================================================
-- ORDINARY VERSUS PRIVACY MUTATION
-- ===========================================================================
--
-- CW2-03 section 35 / C31 separates ORDINARY_WORLD_MUTATION from
-- PRIVACY_MATERIAL_MUTATION. READ_ONLY_CLOSED blocks the first and may still
-- permit the second. So this migration adds NO blanket "nothing may ever mutate"
-- rule and installs no trigger that would create one: a later reviewed
-- owner-deletion path on a closed World's material must stay possible without
-- reopening lifecycle, and migration 0087's availability semantics are written to
-- keep working after closure.
--
-- ===========================================================================
-- INTRODUCTION IS ANTI-SCOPE
-- ===========================================================================
--
-- ACTIVE / INTRODUCTION -> READ_ONLY_CLOSED / INTRODUCTION is NOT implemented
-- here. CW2-03 freezes that Introduction closure eventually uses the same
-- conceptual closed-history entitlement model, but its unilateral end action, its
-- INTRODUCTION_RECORD, its INTRODUCTION_ENDED fact and its Matching races belong
-- to the Introduction / Matching implementation line. Nothing in this migration
-- forbids that later reviewed producer; it simply is not one. No Matching state
-- is read or altered anywhere.
--
-- ===========================================================================
-- THE PRE-LAUNCH SECURITY BOUNDARY, THE LOCK ORDER AND THE ONE INSTANT
-- ===========================================================================
--
-- As in every Connected Worlds mutation slice since 0082: both consequential
-- primitives are fully implemented and executable by NO application role, because
-- the Connected Worlds launch gate does not exist yet. This migration GRANTS
-- NOTHING to anybody: the closed-mode reader is an internal postgres-owned helper
-- that only migration 0087's resolver calls, so I-04F keeps exactly ONE
-- application/server-role historical visibility entry point, and it is 0087's.
-- The exact World row is
-- the canonical first lock, so a closure racing a leave, a removal, a rejoin, a
-- settings change or a history grant has exactly two canonical outcomes and
-- cannot deadlock. ONE database-owned closure instant is read once and reused for
-- every moment the transaction persists: the World's closed_at, every episode's
-- ended_at, every entitlement's time, the WORLD_ENDED fact and the durable
-- command.
--
-- ===========================================================================
-- What this slice deliberately does NOT do
-- ===========================================================================
--
-- It creates no World, adds and removes no member, changes no setting, writes no
-- history item, manifest, approval or grant, touches no Standing Context Grant,
-- audience ceiling or consent history, reads no Personal context, alters no
-- predecessor table, and adds no route, controller, RPC, mobile surface, Launch
-- Gate, feature flag, entitlement policy or safety / moderation policy. Pending
-- member invitations terminalize through the existing reviewed I-04E topology
-- trigger rather than through a second conflicting mechanism invented here. Every
-- historical migration, 0001-0087 included, is untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE IMMUTABLE END_WORLD PAYLOAD VERSION.
--
--    The primary key IS the opaque proposed_payload_version_id the I-04D
--    proposal carries, and the four-column composite foreign key makes "this is
--    the exact END_WORLD payload of that exact proposal, in that exact World"
--    structural rather than procedural - the same binding migration 0086 uses
--    for a settings version.
--
--    The payload carries NO closure reason, NO initiator, NO owner or admin and
--    NO JSON: ending a Shared World is one exact unanimous mutation, and there is
--    nothing about it for a client to describe. created_at is database-owned and
--    is the proposal's own capture instant, so one preparation writes exactly one
--    moment.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_end_payload_versions (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    governance_operation_kind text NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT shared_world_end_payload_versions_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_end_payload_versions_operation_check
        CHECK (governance_operation_kind = 'END_WORLD'),
    CONSTRAINT shared_world_end_payload_versions_proposal_key UNIQUE (governance_proposal_id),
    CONSTRAINT shared_world_end_payload_versions_world_key UNIQUE (world_id, id),
    CONSTRAINT shared_world_end_payload_versions_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_end_payload_versions_proposal_fk
        FOREIGN KEY (governance_proposal_id, world_id, governance_operation_kind, id)
        REFERENCES public.shared_world_governance_proposals
                   (id, world_id, operation_kind, proposed_payload_version_id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 2. THE CLOSED WORLD VIEW ENTITLEMENT.
--
--    One row per (world_id, user_id) for the one irreversible Standard closure of
--    that World. It is NOT a membership episode and carries no open / current
--    state of any kind: membership_episode_id records WHICH exact episode this
--    entitlement derived from, which is historical truth and makes "the closed
--    viewer was a member at closure, and is not one now" auditable without
--    manufacturing a fake active membership.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_standard_closed_view_entitlements (
    world_id uuid NOT NULL,
    user_id uuid NOT NULL,
    membership_episode_id uuid NOT NULL,
    entitled_at timestamptz NOT NULL,
    CONSTRAINT shared_world_standard_closed_view_entitlements_pk PRIMARY KEY (world_id, user_id),
    CONSTRAINT shared_world_standard_closed_view_entitlements_episode_key UNIQUE (membership_episode_id),
    CONSTRAINT shared_world_standard_closed_view_entitlements_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_standard_closed_view_entitlements_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_standard_closed_view_entitlements_episode_fk
        FOREIGN KEY (membership_episode_id)
        REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 3. THE EXACT FROZEN ITEM SNAPSHOT OF ONE ENTITLEMENT.
--
--    Exactly what that human could resolve immediately before closure. The two
--    composite foreign keys make "this item belongs to this exact World, and this
--    row belongs to a real entitlement of that World" structural.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_standard_closed_view_entitlement_items (
    world_id uuid NOT NULL,
    user_id uuid NOT NULL,
    history_item_id uuid NOT NULL,
    CONSTRAINT shared_world_standard_closed_view_entitlement_items_pk
        PRIMARY KEY (world_id, user_id, history_item_id),
    CONSTRAINT shared_world_standard_closed_view_entitlement_items_holder_fk
        FOREIGN KEY (world_id, user_id)
        REFERENCES public.shared_world_standard_closed_view_entitlements (world_id, user_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_standard_closed_view_entitlement_items_item_fk
        FOREIGN KEY (history_item_id, world_id)
        REFERENCES public.shared_world_history_items (id, world_id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 4. The append-only WORLD_ENDED fact and its durable command history.
--
--    UNIQUE (world_id) on the event IS the "one Standard closure per World" rule:
--    a second competing close command cannot manufacture a second closure even if
--    every procedural check above it were somehow bypassed.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_ended_events (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    end_payload_version_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT shared_world_ended_events_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_ended_events_world_key UNIQUE (world_id),
    CONSTRAINT shared_world_ended_events_proposal_key UNIQUE (governance_proposal_id),
    CONSTRAINT shared_world_ended_events_payload_key UNIQUE (end_payload_version_id),
    CONSTRAINT shared_world_ended_events_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_ended_events_payload_fk
        FOREIGN KEY (world_id, end_payload_version_id)
        REFERENCES public.shared_world_end_payload_versions (world_id, id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_ended_events_proposal_fk
        FOREIGN KEY (governance_proposal_id)
        REFERENCES public.shared_world_governance_proposals (id) ON DELETE RESTRICT
);

CREATE TABLE public.shared_world_standard_end_commands (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    end_payload_version_id uuid NOT NULL,
    world_ended_event_id uuid NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT shared_world_standard_end_commands_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_standard_end_commands_world_key UNIQUE (world_id),
    CONSTRAINT shared_world_standard_end_commands_proposal_key UNIQUE (governance_proposal_id),
    CONSTRAINT shared_world_standard_end_commands_event_key UNIQUE (world_ended_event_id),
    CONSTRAINT shared_world_standard_end_commands_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_standard_end_commands_payload_fk
        FOREIGN KEY (world_id, end_payload_version_id)
        REFERENCES public.shared_world_end_payload_versions (world_id, id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_standard_end_commands_proposal_fk
        FOREIGN KEY (governance_proposal_id)
        REFERENCES public.shared_world_governance_proposals (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_standard_end_commands_event_fk
        FOREIGN KEY (world_ended_event_id)
        REFERENCES public.shared_world_ended_events (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 5. Deny-by-default posture for all five new tables.
-- ---------------------------------------------------------------------------
ALTER TABLE public.shared_world_end_payload_versions OWNER TO postgres;
ALTER TABLE public.shared_world_standard_closed_view_entitlements OWNER TO postgres;
ALTER TABLE public.shared_world_standard_closed_view_entitlement_items OWNER TO postgres;
ALTER TABLE public.shared_world_ended_events OWNER TO postgres;
ALTER TABLE public.shared_world_standard_end_commands OWNER TO postgres;
ALTER TABLE public.shared_world_end_payload_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_standard_closed_view_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_standard_closed_view_entitlement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_ended_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_standard_end_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_world_end_payload_versions,
                    public.shared_world_standard_closed_view_entitlements,
                    public.shared_world_standard_closed_view_entitlement_items,
                    public.shared_world_ended_events,
                    public.shared_world_standard_end_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.shared_world_end_payload_versions, public.shared_world_standard_closed_view_entitlements, public.shared_world_standard_closed_view_entitlement_items, public.shared_world_ended_events, public.shared_world_standard_end_commands FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 6. STANDARD END_WORLD GOVERNANCE PREPARATION.
--
--    Creates the exact immutable END_WORLD payload and captures the exact
--    END_WORLD / ALL_CURRENT_MEMBERS proposal over the exact current topology
--    through the frozen I-04D primitive. It changes no lifecycle, closes no
--    episode, records no proposer and reads no clock of its own: the canonical
--    instant is the one the frozen capture owns.
--
--    Zero current humans is refused by the frozen capture itself, so an inert
--    NO_ACTIVE_HUMAN_MEMBERS World can never manufacture unanimous END_WORLD from
--    an empty set (CW2-03 section 27 / C24).
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.prepare_shared_world_standard_end_governance_v1(
  p_proposal_id uuid, p_membership_snapshot_id uuid, p_end_payload_version_id uuid, p_world_id uuid
) RETURNS TABLE(outcome text, prepared_proposal_id uuid, prepared_snapshot_id uuid,
                prepared_world_id uuid, prepared_operation_kind text, prepared_payload_version_id uuid,
                prepared_approval_rule text, prepared_required_approval_count integer,
                prepared_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_end_payload_versions;
  captured record;
  world public.shared_worlds;
  historical_required integer;
BEGIN
  IF p_proposal_id IS NULL OR p_membership_snapshot_id IS NULL OR p_end_payload_version_id IS NULL
     OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, answered from immutable
  -- history even after topology has moved on.
  SELECT * INTO committed FROM public.shared_world_end_payload_versions c WHERE c.id = p_end_payload_version_id;
  IF FOUND THEN
    IF committed.governance_proposal_id = p_proposal_id AND committed.world_id = p_world_id
       AND EXISTS (SELECT 1 FROM public.shared_world_governance_proposals pr
                    WHERE pr.id = committed.governance_proposal_id
                      AND pr.membership_snapshot_id = p_membership_snapshot_id
                      AND pr.proposed_payload_version_id = committed.id
                      AND pr.created_at = committed.created_at) THEN
      SELECT count(*)::integer INTO historical_required
        FROM public.shared_world_membership_snapshot_members m
       WHERE m.membership_snapshot_id = p_membership_snapshot_id;
      IF historical_required = 0 THEN
        RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'PREPARED'::text, committed.governance_proposal_id, p_membership_snapshot_id,
                          committed.world_id, committed.governance_operation_kind, committed.id,
                          'ALL_CURRENT_MEMBERS'::text, historical_required, committed.created_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the exact World row.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO captured FROM public.capture_shared_world_governance_proposal_v1(
    p_proposal_id, p_membership_snapshot_id, p_world_id, 'END_WORLD', p_end_payload_version_id,
    'ALL_CURRENT_MEMBERS', NULL);
  IF captured.outcome <> 'CAPTURED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  BEGIN
    INSERT INTO public.shared_world_end_payload_versions
      (id, world_id, governance_proposal_id, governance_operation_kind, created_at)
    VALUES (p_end_payload_version_id, p_world_id, p_proposal_id, 'END_WORLD', captured.snapshot_captured_at);
  EXCEPTION WHEN unique_violation THEN
    -- The whole preparation - the captured topology and the proposal included -
    -- rolls back together, so a refused preparation leaves no orphan proposal.
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'PREPARED'::text, p_proposal_id, p_membership_snapshot_id, p_world_id,
                      'END_WORLD'::text, p_end_payload_version_id, 'ALL_CURRENT_MEMBERS'::text,
                      captured.required_approval_count, captured.snapshot_captured_at;
END$$;

-- ---------------------------------------------------------------------------
-- 7. THE STANDARD CLOSURE COMMIT.
--
--    There is no actor parameter and no synthetic closer: the authority IS the
--    exact unanimously satisfied END_WORLD proposal, exactly as the governed
--    removal and the governed settings change of I-04E derive no actor.
--
--    The transaction, in this exact order:
--      1  durable idempotency, before any lock;
--      2  discover the exact World from the proposal;
--      3  lock the exact World row FIRST;
--      4  under-lock idempotency;
--      5  require ACTIVE / STANDARD;
--      6  read and revalidate the exact END_WORLD payload of that proposal;
--      7  prove CURRENT governance in the SAME transaction through the frozen
--         I-04D resolver, which also re-locks the proposal, revalidates the exact
--         operation and payload version, and requires the exact captured topology
--         to still equal current topology by EPISODE identity;
--      8  capture ONE database-owned closure instant;
--      9  BEFORE destroying active membership, resolve each exact current human's
--         exact currently-visible history item set through the ONE frozen I-04F
--         visibility resolver - the World is still ACTIVE at this point, so this
--         is genuinely "what they could see immediately before closure";
--     10  persist one entitlement per exact current human and its exact items;
--     11  transition the World to READ_ONLY_CLOSED / STANDARD at that instant;
--     12  close EVERY open episode in place at the same instant, WORLD_CLOSED;
--     13  append exactly one WORLD_ENDED and persist one durable command.
--
--    Step 12 fires the reviewed I-04E topology trigger on every closed episode,
--    which terminalizes any PENDING member invitation of this World to
--    STALE_GOVERNANCE. That is the existing mechanism doing exactly what it
--    already means; no second conflicting mechanism is invented here.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_shared_world_standard_end_v1(
  p_command_id uuid, p_proposal_id uuid, p_world_ended_event_id uuid
) RETURNS TABLE(outcome text, end_command_id uuid, ended_world_id uuid, ended_proposal_id uuid,
                ended_payload_version_id uuid, ended_event_id uuid,
                closed_entitlement_count integer, closed_episode_count integer,
                world_closed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_standard_end_commands;
  payload public.shared_world_end_payload_versions;
  world public.shared_worlds;
  proof record;
  target_world uuid;
  entitlements integer;
  episodes integer;
  historical_entitlements integer;
  historical_episodes integer;
  closure_instant timestamptz;
BEGIN
  IF p_command_id IS NULL OR p_proposal_id IS NULL OR p_world_ended_event_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS. The committed answer is historical and must
  -- stay stable AFTER closure: the World is now READ_ONLY_CLOSED, every episode is
  -- closed, and a later legitimate owner privacy change may have made some
  -- entitlement items unavailable. So this validates only the immutable closure
  -- facts this command OWNS - it never requires the World to still look
  -- pre-closure.
  SELECT * INTO committed FROM public.shared_world_standard_end_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.governance_proposal_id = p_proposal_id
       AND committed.world_ended_event_id = p_world_ended_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_ended_events ev
          JOIN public.shared_worlds w ON w.id = ev.world_id
         WHERE ev.id = committed.world_ended_event_id
           AND ev.world_id = committed.world_id
           AND ev.governance_proposal_id = committed.governance_proposal_id
           AND ev.end_payload_version_id = committed.end_payload_version_id
           AND ev.occurred_at = committed.committed_at
           AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'STANDARD'
           AND w.closed_at = committed.committed_at
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      IF EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                  WHERE e.world_id = committed.world_id AND e.ended_at IS NULL) THEN
        RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      SELECT count(*)::integer INTO historical_entitlements
        FROM public.shared_world_standard_closed_view_entitlements ent
       WHERE ent.world_id = committed.world_id;
      SELECT count(*)::integer INTO historical_episodes
        FROM public.shared_world_membership_episodes e
       WHERE e.world_id = committed.world_id AND e.ended_at = committed.committed_at
         AND e.end_reason = 'WORLD_CLOSED';
      RETURN QUERY SELECT 'WORLD_ENDED'::text, committed.id, committed.world_id,
                          committed.governance_proposal_id, committed.end_payload_version_id,
                          committed.world_ended_event_id, historical_entitlements,
                          historical_episodes, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- WORLD-FIRST ORDER: pre-read only enough of the proposal to discover the
  -- World, then lock the World before anything else.
  SELECT pr.world_id INTO target_world
    FROM public.shared_world_governance_proposals pr WHERE pr.id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.shared_world_standard_end_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.governance_proposal_id = p_proposal_id
       AND committed.world_ended_event_id = p_world_ended_event_id THEN
      SELECT count(*)::integer INTO historical_entitlements
        FROM public.shared_world_standard_closed_view_entitlements ent
       WHERE ent.world_id = committed.world_id;
      SELECT count(*)::integer INTO historical_episodes
        FROM public.shared_world_membership_episodes e
       WHERE e.world_id = committed.world_id AND e.ended_at = committed.committed_at
         AND e.end_reason = 'WORLD_CLOSED';
      RETURN QUERY SELECT 'WORLD_ENDED'::text, committed.id, committed.world_id,
                          committed.governance_proposal_id, committed.end_payload_version_id,
                          committed.world_ended_event_id, historical_entitlements,
                          historical_episodes, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- Closure is an ordinary Standard mutation of a LIVE World. An already archived
  -- World refuses here, which is also why two competing close commands produce
  -- exactly one closure.
  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO payload FROM public.shared_world_end_payload_versions v
   WHERE v.governance_proposal_id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF payload.world_id <> target_world THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- THE CURRENT GOVERNANCE PROOF, revalidated in the SAME transaction as the
  -- irreversible mutation: exact operation, exact payload version, exact topology
  -- by EPISODE identity, every required approval, ACTIVE / STANDARD only. Payload
  -- version A's approvals can never close under version B, and a topology that
  -- moved after the proposal makes it stale rather than silently satisfied.
  SELECT * INTO proof FROM public.resolve_shared_world_governance_approval_v1(
    p_proposal_id, 'END_WORLD', payload.id);
  IF proof.outcome <> 'SATISFIED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- THE ONE canonical closure instant, read from the database clock exactly once
  -- and reused for every moment this transaction persists.
  closure_instant := clock_timestamp();

  BEGIN
    -- ONE ENTITLEMENT PER EXACT CURRENT HUMAN, written BEFORE any membership is
    -- destroyed, so the entitled set is exactly the topology that approved.
    INSERT INTO public.shared_world_standard_closed_view_entitlements
      (world_id, user_id, membership_episode_id, entitled_at)
    SELECT e.world_id, e.user_id, e.id, closure_instant
      FROM public.shared_world_membership_episodes e
     WHERE e.world_id = target_world AND e.ended_at IS NULL;
    GET DIAGNOSTICS entitlements = ROW_COUNT;

    -- THE EXACT ITEM SNAPSHOT, resolved through the ONE frozen I-04F visibility
    -- resolver while the World is still ACTIVE. A human with nothing visible
    -- keeps their entitlement row and simply contributes no item row.
    INSERT INTO public.shared_world_standard_closed_view_entitlement_items
      (world_id, user_id, history_item_id)
    SELECT ent.world_id, ent.user_id, visible.history_item_id
      FROM public.shared_world_standard_closed_view_entitlements ent
      CROSS JOIN LATERAL public.resolve_shared_world_history_visibility_v1(ent.world_id, ent.user_id) visible
     WHERE ent.world_id = target_world;

    -- ARCHIVAL CLOSURE. The World id, phase, history, settings and governance all
    -- remain; only the lifecycle and the closure instant change.
    UPDATE public.shared_worlds w
       SET lifecycle = 'READ_ONLY_CLOSED', phase = 'STANDARD', closed_at = closure_instant
     WHERE w.id = target_world;

    -- EVERY open episode closes IN PLACE at the same instant. No episode is
    -- deleted, replaced or rewritten beyond its own ending, so historical
    -- authorship and presence stay exactly as they were.
    UPDATE public.shared_world_membership_episodes e
       SET ended_at = closure_instant, end_reason = 'WORLD_CLOSED'
     WHERE e.world_id = target_world AND e.ended_at IS NULL;
    GET DIAGNOSTICS episodes = ROW_COUNT;
    IF episodes <> entitlements THEN
      RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.shared_world_ended_events
      (id, world_id, governance_proposal_id, end_payload_version_id, occurred_at)
    VALUES (p_world_ended_event_id, target_world, p_proposal_id, payload.id, closure_instant);

    INSERT INTO public.shared_world_standard_end_commands
      (id, world_id, governance_proposal_id, end_payload_version_id, world_ended_event_id, committed_at)
    VALUES (p_command_id, target_world, p_proposal_id, payload.id, p_world_ended_event_id, closure_instant);
  EXCEPTION WHEN unique_violation THEN
    -- A supplied persistence identity was already taken, or this World already
    -- carries its one Standard closure. The whole closure rolls back together, so
    -- a refused command never leaves a half-closed World behind.
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'WORLD_ENDED'::text, p_command_id, target_world, p_proposal_id, payload.id,
                      p_world_ended_event_id, entitlements, episodes, closure_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 8. THE CLOSED-MODE BRANCH OF THE ONE HISTORICAL VISIBILITY RESOLVER.
--
--    This is not a second resolver, and it is not a second read boundary either.
--    Migration 0087's resolve_shared_world_history_visibility_v1 is the single
--    entry point for "what history may this exact human see in this exact Shared
--    World"; this function is the implementation of its READ_ONLY_CLOSED /
--    STANDARD branch, which lives here because the entitlement snapshot is what
--    THIS migration owns.
--
--    It is INTERNAL: no application role executes it, service_role included. The
--    only caller is 0087's postgres-owned SECURITY DEFINER resolver, which reaches
--    it as its own owner and needs no grant to do so. It also refuses any World
--    that is not an archived Standard World, so it could not answer an ACTIVE
--    World's question behind the entry point's back even if it were reachable.
--
--    Active membership is deliberately NOT consulted: closed viewing is
--    entitlement, never membership. A human with no entitlement gets a truthful
--    empty answer rather than a distinguishable error, so a closed World is not a
--    membership oracle either. Current availability is re-checked on every read,
--    so a later valid owner deletion still removes source visibility from an
--    entitlement that already exists.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_shared_world_closed_history_visibility_v1(p_world_id uuid, p_user_id uuid)
RETURNS TABLE(world_id uuid, history_item_id uuid, occurred_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  world public.shared_worlds;
BEGIN
  IF p_world_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF world.lifecycle <> 'READ_ONLY_CLOSED' OR world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSED_VISIBILITY_UNSUPPORTED_WORLD_MODE' USING ERRCODE='0A000';
  END IF;
  RETURN QUERY
    SELECT i.world_id, i.id, i.occurred_at
      FROM public.shared_world_standard_closed_view_entitlement_items it
      JOIN public.shared_world_history_items i ON i.id = it.history_item_id
     WHERE it.world_id = p_world_id AND it.user_id = p_user_id
       AND i.availability_state = 'AVAILABLE'
     ORDER BY i.occurred_at, i.id;
END$$;

-- ---------------------------------------------------------------------------
-- 9. Ownership and THE PRE-LAUNCH ACL. This migration GRANTS NOTHING to anybody.
--
--    The closed-history reader is an INTERNAL postgres-owned helper, not a second
--    server read boundary: it needs no application-role EXECUTE, because the only
--    thing that calls it is migration 0087's postgres-owned SECURITY DEFINER
--    resolver, which reaches it as its own owner. Granting service_role EXECUTE
--    on it would create a second independently callable historical-visibility
--    entry point, which is exactly what "one narrow server-only resolver" forbids.
--
--    So I-04F keeps EXACTLY ONE application/server-role historical visibility
--    entry point, and it is the one migration 0087 owns:
--
--      public.resolve_shared_world_history_visibility_v1(uuid, uuid)
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.prepare_shared_world_standard_end_governance_v1(uuid, uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.commit_shared_world_standard_end_v1(uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_shared_world_closed_history_visibility_v1(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.prepare_shared_world_standard_end_governance_v1(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_shared_world_standard_end_v1(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_shared_world_closed_history_visibility_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.prepare_shared_world_standard_end_governance_v1(uuid, uuid, uuid, uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_standard_end_v1(uuid, uuid, uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.resolve_shared_world_closed_history_visibility_v1(uuid, uuid) FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 10. Terminal self-assertions. The migration refuses to deploy a closure
--     surface that is application-executable, caller-identified, unpinned,
--     wrongly ordered, multi-clocked, membership-faking, history-deleting,
--     Introduction-implementing or blanket-freezing.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  prepare_fn text := 'public.prepare_shared_world_standard_end_governance_v1(uuid,uuid,uuid,uuid)';
  commit_fn text := 'public.commit_shared_world_standard_end_v1(uuid,uuid,uuid)';
  resolve_fn text := 'public.resolve_shared_world_closed_history_visibility_v1(uuid,uuid)';
  own_tables text[] := ARRAY['public.shared_world_end_payload_versions',
                             'public.shared_world_standard_closed_view_entitlements',
                             'public.shared_world_standard_closed_view_entitlement_items',
                             'public.shared_world_ended_events',
                             'public.shared_world_standard_end_commands'];
  fn_name text;
  p record;
  in_names text[];
  in_types text[];
  arg_name text;
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
  world_pos integer;
  proof_pos integer;
  entitlement_pos integer;
  episode_pos integer;
  transition_pos integer;
BEGIN
  FOREACH fn_name IN ARRAY ARRAY[prepare_fn, commit_fn] LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn_name::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-04F: % must be owned by postgres', fn_name; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-04F: % must be SECURITY DEFINER', fn_name; END IF;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-04F: % mutates or locks and must be VOLATILE', fn_name; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-04F: % must pin an empty search_path', fn_name;
    END IF;
    IF has_function_privilege('public', fn_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04F: PUBLIC must not execute the Standard closure surface before the launch gate exists';
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, fn_name, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-04F: % must not execute the Standard closure surface before the launch gate exists', target_role;
      END IF;
    END LOOP;

    IF p.prosrc ~* 'conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|consent|matching' THEN
      RAISE EXCEPTION 'I-04F: % must not read Personal context or touch Standing Context and Matching state', fn_name;
    END IF;
    -- ARCHIVAL CLOSURE IS NOT DELETION.
    IF p.prosrc ~* 'DELETE FROM' OR p.prosrc ~* 'TRUNCATE' THEN
      RAISE EXCEPTION 'I-04F: % may never delete canonical history: closure is archival', fn_name;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' THEN
      RAISE EXCEPTION 'I-04F: % locks rows in the canonical order, never a table and never an advisory key', fn_name;
    END IF;
    -- CLOSURE AUTHORITY IS UNANIMITY, NEVER A ROLE and never whoever transmits it.
    IF p.prosrc ~ 'auth\.uid' THEN
      RAISE EXCEPTION 'I-04F: % records no closer: the authority is the exact unanimous END_WORLD approval set', fn_name;
    END IF;
    IF p.prosrc ~ 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp' THEN
      RAISE EXCEPTION 'I-04F: % must persist one database-owned instant, never a second clock', fn_name;
    END IF;
    -- INTRODUCTION IS ANTI-SCOPE, and no Matching state is touched.
    IF p.prosrc ~* 'INTRODUCTION' THEN
      RAISE EXCEPTION 'I-04F: % must not implement Introduction closure: that belongs to the Introduction line', fn_name;
    END IF;
    -- Closure manufactures no governance and no history grant of its own.
    IF p.prosrc ~ 'INSERT INTO public\.shared_world_governance_|UPDATE public\.shared_world_governance_'
       OR p.prosrc ~ 'INSERT INTO public\.shared_world_membership_snapshot' THEN
      RAISE EXCEPTION 'I-04F: % must never manufacture governance: proposals and approvals belong to I-04D', fn_name;
    END IF;
    IF p.prosrc ~ 'INSERT INTO public\.shared_world_history_access_grants|INSERT INTO public\.shared_world_history_package_' THEN
      RAISE EXCEPTION 'I-04F: % must commit no history grant: a closure widens nobody''s history', fn_name;
    END IF;
    -- WORLD-FIRST, in both primitives.
    IF strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = ') = 0 OR p.prosrc !~ 'FOR UPDATE' THEN
      RAISE EXCEPTION 'I-04F: % must lock the exact World row', fn_name;
    END IF;
    IF (length(p.prosrc) - length(replace(p.prosrc, 'FOR UPDATE', ''))) / length('FOR UPDATE') <> 1 THEN
      RAISE EXCEPTION 'I-04F: % takes exactly one row lock of its own, and it is the World row', fn_name;
    END IF;
  END LOOP;

  -- ===================================================================
  -- PREPARATION: it consumes the frozen I-04D capture under exactly END_WORLD /
  -- ALL_CURRENT_MEMBERS, changes no lifecycle and reads no clock of its own.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes, pr.proargtypes INTO p
    FROM pg_proc pr WHERE pr.oid = prepare_fn::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i') INTO in_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_proposal_id','p_membership_snapshot_id','p_end_payload_version_id','p_world_id'] THEN
    RAISE EXCEPTION 'I-04F: the closure preparation must accept exactly four opaque identities, not %', in_names;
  END IF;
  SELECT array_agg(t.typname::text ORDER BY a.ord) INTO in_types
    FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
    JOIN pg_type t ON t.oid = a.argtype;
  IF in_types <> ARRAY['uuid','uuid','uuid','uuid'] THEN
    RAISE EXCEPTION 'I-04F: the closure preparation accepts identities only, never a reason or a payload, not %', in_types;
  END IF;
  -- The token is member_ids, never a bare `member`: the frozen parameter
  -- p_membership_snapshot_id is a legitimate opaque persistence identity, and a
  -- bare `member` would make this migration refuse its own valid surface at
  -- deploy. The frozen I-04E precedent in 0086 uses member_ids for exactly this
  -- reason. The exact in_names equality above remains the primary proof that no
  -- additional topology parameter can enter silently; this scan only catches a
  -- parameter whose NAME claims an authority the surface must never accept.
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'initiator|proposer|actor|owner|admin|approver|approval|authority|reason|note|message|member_ids|episode|count|launch|gate|timestamp|instant|_at$' THEN
      RAISE EXCEPTION 'I-04F: the closure preparation must accept no reason, actor, topology, count or clock parameter';
    END IF;
  END LOOP;
  IF p.prosrc !~ 'public\.capture_shared_world_governance_proposal_v1\(' THEN
    RAISE EXCEPTION 'I-04F: the closure preparation must capture its proposal through the frozen I-04D primitive';
  END IF;
  IF p.prosrc !~ '''END_WORLD'', p_end_payload_version_id,\s*\n\s*''ALL_CURRENT_MEMBERS'', NULL\)' THEN
    RAISE EXCEPTION 'I-04F: an end proposal is exactly END_WORLD under ALL_CURRENT_MEMBERS with no exclusion';
  END IF;
  IF p.prosrc ~ 'clock_timestamp\(\)' THEN
    RAISE EXCEPTION 'I-04F: the closure preparation must reuse the capture instant, never read a second clock';
  END IF;
  IF p.prosrc !~ 'captured\.snapshot_captured_at' THEN
    RAISE EXCEPTION 'I-04F: the closure preparation must persist the exact instant the frozen capture owned';
  END IF;
  IF p.prosrc ~ 'UPDATE public\.shared_worlds|UPDATE public\.shared_world_membership_episodes' THEN
    RAISE EXCEPTION 'I-04F: preparing a closure changes no lifecycle and closes no episode';
  END IF;

  -- ===================================================================
  -- COMMIT: the exact proposal and payload, current governance, ONE instant,
  -- the entitlement snapshot BEFORE the membership is destroyed.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes INTO p FROM pg_proc pr WHERE pr.oid = commit_fn::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i') INTO in_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id','p_proposal_id','p_world_ended_event_id'] THEN
    RAISE EXCEPTION 'I-04F: the closure commit must accept exactly three opaque identities, not %', in_names;
  END IF;
  -- Same narrowing as the preparation scan: member_ids, never a bare `member`.
  -- This one does not fire today, because the frozen commit surface carries no
  -- matching parameter - but it is the identical defective shape, and a latent
  -- self-rejection is still a self-rejection.
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'user_id|actor|closer|approver|member_ids|episode|snapshot|reason|timestamp|instant|count|_at$' THEN
      RAISE EXCEPTION 'I-04F: the closure commit must not accept an actor, a reason or a clock parameter';
    END IF;
  END LOOP;
  IF p.prosrc !~ 'public\.resolve_shared_world_governance_approval_v1\(\s*\n?\s*p_proposal_id, ''END_WORLD'', payload\.id\)' THEN
    RAISE EXCEPTION 'I-04F: a closure must revalidate the exact operation AND the exact payload version it is about to apply';
  END IF;
  IF p.prosrc !~ 'closure_instant := clock_timestamp\(\);' THEN
    RAISE EXCEPTION 'I-04F: the closure instant must come from the database clock, never from a caller';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'closure_instant := ', ''))) / length('closure_instant := ') <> 1 THEN
    RAISE EXCEPTION 'I-04F: the canonical closure instant must be captured exactly once';
  END IF;
  IF p.prosrc !~ 'public\.resolve_shared_world_history_visibility_v1\(ent\.world_id, ent\.user_id\)' THEN
    RAISE EXCEPTION 'I-04F: the entitlement item snapshot must come from the ONE frozen I-04F visibility resolver';
  END IF;
  IF p.prosrc !~ 'SET ended_at = closure_instant, end_reason = ''WORLD_CLOSED''' THEN
    RAISE EXCEPTION 'I-04F: every open episode must close in place at the closure instant with WORLD_CLOSED';
  END IF;
  IF p.prosrc !~ 'SET lifecycle = ''READ_ONLY_CLOSED'', phase = ''STANDARD'', closed_at = closure_instant' THEN
    RAISE EXCEPTION 'I-04F: closure must set the archived lifecycle, the Standard phase and the closure instant together';
  END IF;
  -- THE EXACT ORDER: World lock, then the governance proof, then the entitlements
  -- and their item snapshot, then the World transition, then the episode closure.
  -- The snapshot MUST precede the episode closure, or it would record what a human
  -- could see after their membership was already destroyed.
  world_pos := strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
  proof_pos := strpos(p.prosrc, 'public.resolve_shared_world_governance_approval_v1');
  entitlement_pos := strpos(p.prosrc, 'INSERT INTO public.shared_world_standard_closed_view_entitlements');
  transition_pos := strpos(p.prosrc, 'UPDATE public.shared_worlds w');
  episode_pos := strpos(p.prosrc, 'UPDATE public.shared_world_membership_episodes e');
  IF world_pos = 0 OR proof_pos = 0 OR entitlement_pos = 0 OR transition_pos = 0 OR episode_pos = 0
     OR world_pos > proof_pos OR proof_pos > entitlement_pos OR entitlement_pos > transition_pos
     OR transition_pos > episode_pos THEN
    RAISE EXCEPTION 'I-04F: a closure must lock the World, prove governance and snapshot every entitlement BEFORE it destroys membership';
  END IF;

  -- ===================================================================
  -- THE CLOSED-MODE READER: read-only, pinned, service-role-only, content-free
  -- and never a membership check.
  -- ===================================================================
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
    INTO p FROM pg_proc pr WHERE pr.oid = resolve_fn::regprocedure;
  IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-04F: the closed-history reader must be owned by postgres'; END IF;
  IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-04F: the closed-history reader must be SECURITY DEFINER'; END IF;
  IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-04F: the closed-history reader must be STABLE (read-only)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-04F: the closed-history reader must pin an empty search_path';
  END IF;
  IF p.prosrc ~* 'INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt' THEN
    RAISE EXCEPTION 'I-04F: the closed-history reader must mutate nothing, lock nothing and trust no client claim';
  END IF;
  IF p.prosrc ~ 'shared_world_membership_episodes' THEN
    RAISE EXCEPTION 'I-04F: closed viewing is entitlement, never membership: the reader must not consult episodes';
  END IF;
  IF p.prosrc !~ 'i\.availability_state = ''AVAILABLE''' THEN
    RAISE EXCEPTION 'I-04F: a closed entitlement can never reconstruct owner-deleted or unavailable source';
  END IF;
  -- EXACTLY ONE SERVER-ROLE HISTORICAL VISIBILITY ENTRY POINT. The closed-mode
  -- helper is internal: no application role executes it, including service_role.
  IF has_function_privilege('public', resolve_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-04F: PUBLIC must not execute the internal closed-history helper';
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
       AND has_function_privilege(target_role, resolve_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04F: % must not execute the internal closed-history helper: I-04F has ONE historical visibility entry point', target_role;
    END IF;
  END LOOP;
  -- And that one entry point is migration 0087's resolver, which service_role
  -- really can still reach - otherwise this slice would have closed the boundary
  -- rather than narrowed it.
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role',
                                    'public.resolve_shared_world_history_visibility_v1(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I-04F: service_role must still execute the ONE historical visibility entry point';
  END IF;

  -- ===================================================================
  -- The five new relations: unreachable, policy-free, trigger-free, and neither
  -- a fake membership record nor a role record.
  -- ===================================================================
  FOREACH target_table IN ARRAY own_tables LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN RAISE EXCEPTION 'I-04F: row level security must be enabled on %', target_table; END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04F: no RLS policy may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION 'I-04F: migration 0088 installs no trigger on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = target_table::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-04F: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04F: direct table access stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
    IF length(split_part(target_table, '.', 2)) > 63 THEN
      RAISE EXCEPTION 'I-04F: relation name % exceeds the PostgreSQL 63-byte identifier limit', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint con
                WHERE con.conrelid = target_table::regclass AND length(con.conname) > 63) THEN
      RAISE EXCEPTION 'I-04F: a constraint name on % exceeds the PostgreSQL 63-byte identifier limit', target_table;
    END IF;
  END LOOP;
  -- A CLOSED VIEWER IS NOT AN ACTIVE MEMBER: the entitlement carries no open,
  -- current, active or joined state, no role, and no material content.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = ANY(ARRAY['shared_world_end_payload_versions',
                                    'shared_world_standard_closed_view_entitlements',
                                    'shared_world_standard_closed_view_entitlement_items',
                                    'shared_world_ended_events',
                                    'shared_world_standard_end_commands'])
       AND (c.column_name ~* '(joined_at|ended_at|is_active|is_open|is_current|active_|current_|owner|admin|creator|initiator|moderator|privilege|capability|permission|entitlement_status|commercial|safety|moderation|reason|body|transcript|audio|content|payload_body|blob|document|analysis|message)'
            OR c.data_type IN ('json','jsonb'))
  ) THEN
    RAISE EXCEPTION 'I-04F: a closed entitlement is historical viewing authority only, never membership, a role, a reason or material content';
  END IF;

  -- ===================================================================
  -- Migration 0088 alters no predecessor table and installs no trigger anywhere.
  -- Pending member invitations terminalize through the reviewed I-04E mechanism.
  -- ===================================================================
  FOREACH target_table IN ARRAY ARRAY['public.shared_worlds','public.shared_world_membership_episodes',
                                      'public.shared_world_member_invitations',
                                      'public.shared_world_governance_proposals',
                                      'public.shared_world_governance_approvals',
                                      'public.shared_world_settings_versions',
                                      'public.shared_world_history_items',
                                      'public.shared_world_history_access_grants',
                                      'public.shared_world_standing_context_grants'] LOOP
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04F: no RLS policy may be added to %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04F: the Shared substrate stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM pg_trigger t JOIN pg_proc pr ON pr.oid = t.tgfoid
       WHERE t.tgrelid = 'public.shared_world_membership_episodes'::regclass AND NOT t.tgisinternal
         AND pr.proname = 'terminalize_stale_shared_world_member_invitations_v1') <> 2 THEN
    RAISE EXCEPTION 'I-04F: the two reviewed I-04E topology triggers must still be in place: closure terminalizes invitations through them';
  END IF;
  -- The frozen I-04D mapping already carries END_WORLD, so this slice extends the
  -- governance vocabulary nowhere.
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.capture_shared_world_governance_proposal_v1(uuid,uuid,uuid,text,uuid,text,uuid)'::regprocedure)
      !~ 'WHEN ''END_WORLD'' THEN ''ALL_CURRENT_MEMBERS''' THEN
    RAISE EXCEPTION 'I-04F: the frozen I-04D capture must already map END_WORLD to ALL_CURRENT_MEMBERS';
  END IF;
END$$;

COMMIT;
