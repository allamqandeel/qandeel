-- I-04C - Standard Voluntary Leave + Membership Episode Closure v1.
--
-- I-04B made a real ACTIVE / STANDARD Shared World with exactly two open
-- membership episodes. This migration adds the first primitive that ENDS one of
-- them, and it is deliberately the only membership mutation frozen canon makes
-- UNILATERAL (CW2-03 section 23, C19; CW2-02 section 35: voluntary leave is an
-- individual authority and requires no group approval). Add-member, removal,
-- rejoin and Standard World end all require a unanimous-governance substrate
-- that does not exist, so none of them is implemented here.
--
-- A valid leave commits, as ONE transaction:
--
--   the exact authenticated human's own open membership episode
--     -> ended_at    = the one canonical leave instant
--     -> end_reason  = VOLUNTARY_LEAVE
--     -> append the MEMBER_LEFT fact
--     -> record durable voluntary-leave idempotency
--
-- All four writes commit together or not at all.
--
-- ===========================================================================
-- THE PRE-LAUNCH SECURITY BOUNDARY - why nothing here is app-callable
-- ===========================================================================
--
-- CW2-08 section 25 / H18 freezes that a consequential action binds a CURRENT
-- launch gate snapshot before an irreversible commit, and section 40 makes
-- UNKNOWN / UNCONFIGURED / UNSATISFIED / UNTESTED fail closed for the scoped
-- capability. Closing a membership episode is irreversible: the episode is
-- permanent historical truth and a later rejoin is a NEW episode, never a
-- reopening (CW2-03 section 28, C25). The Connected Worlds launch gate does not
-- exist in this repository, so this slice implements the transaction core fully
-- and leaves it NON-APPLICATION-EXECUTABLE, exactly as I-04B left the birth
-- core:
--
--   PUBLIC        -> no EXECUTE
--   anon          -> no EXECUTE
--   authenticated -> no EXECUTE
--   service_role  -> no EXECUTE
--
-- The terminal self-assertions below refuse to deploy without that. A later
-- REVIEWED launch-gated wrapper is expected to authenticate the exact human,
-- revalidate current policy, preserve that human's own session claims and only
-- then invoke this primitive. Nothing here forbids such a wrapper. The
-- primitive stays safe under it because the leaving human is auth.uid() and
-- there is NO actor, target or episode parameter at all: a wrapper may RESTRICT
-- whether the operation proceeds, but can never substitute another principal
-- (CW2-01 section 7; CW2-08 section 2 / H1).
--
-- ===========================================================================
-- What this migration creates
-- ===========================================================================
--
--   * an ADDITIVE public.shared_world_membership_episodes.end_reason. Frozen
--     CW2-03 section 15 models the episode as {user, start, end?, end_reason?};
--     migration 0075 created every part of that except the reason. The column is
--     nullable and carries NO check constraint, because a later authorized slice
--     must be able to write REMOVED (section 25) or the closure reason of
--     section 32 without a superseding migration, and because an enum frozen
--     here would freeze exactly the future this slice must not decide. Open
--     episodes keep ended_at = NULL and end_reason = NULL; the only writer in
--     this repository sets both together, in one statement, and the real-PG
--     verifier proves that pairing.
--   * public.shared_world_member_left_events - the durable MEMBER_LEFT fact
--     (CW2-03 section 46). Table identity IS the event type, so there is no
--     payload, no event-name column, no mutable event state and no generic event
--     engine. One closed episode has at most one voluntary-leave event.
--   * public.shared_world_voluntary_leave_commands - the narrow durable command
--     history that makes leave idempotent (CW2-03 section 47, C41). The row id IS
--     the caller-supplied command id, so the primary key is the idempotency
--     record. Uniqueness is per EPISODE and per EVENT, never per (world, user):
--     a future rejoin creates a second episode which may itself later leave
--     (CW2-03 sections 28 - 29, C25), and a permanent (world, user) leave key
--     would forbid that.
--   * public.commit_shared_world_standard_voluntary_leave_v1 - the internal
--     exact-human Standard voluntary-leave transaction primitive.
--
-- CANONICAL LOCK ORDER - the World row FIRST:
--
--   1. the exact shared_worlds row                 (SELECT ... FOR UPDATE)
--   2. the actor's exact open membership episode   (SELECT ... FOR UPDATE)
--
-- Membership topology is a property of the World, not of one human, so every
-- future topology mutation - add-member, removal, rejoin, World end - must bind
-- the exact current topology and therefore must serialize on the World row. The
-- frozen I-03C consent commands already lock that same row first, so a leave
-- racing a grant / reconfirm serializes on one row with exactly two canonical
-- outcomes: the grant commits under current membership and the later leave ends
-- it without revoking anything, or the leave commits and the later grant finds
-- no current membership and fails closed under I-03C's own rule. No advisory
-- lock, no table lock and no process-local mutex is used, so the order cannot
-- deadlock.
--
-- ONE canonical leave instant: a single database-owned timestamp is captured
-- once inside the transaction and persisted, unchanged, as the episode's
-- ended_at, the event's occurred_at and the command's committed_at. No client
-- timestamp is accepted and no second clock read can drift.
--
-- ===========================================================================
-- What leave deliberately does NOT do
-- ===========================================================================
--
-- It does not touch a Standing Context Grant, its audience ceiling or the
-- consent-event history, and it adds no trigger that could. CW2-02 section 32
-- freezes that there is no universal retroactive revocation rule and that a
-- Standing Context Grant is revocable for FUTURE reasoning - explicitly, by its
-- owner - and CW2-02 section 35 makes leave invalidate future use of grants
-- "according to grant policy", not by rewriting the grant. Frozen I-03E states
-- that a departed owner's private context is still unavailable unless there is
-- a valid independent authority basis, and that a valid current Standing
-- Context Grant IS such a basis where all frozen conditions permit it; frozen
-- I-03A deliberately derives nothing from membership. Membership loss and grant
-- revocation are separate canonical truths. What leave changes is the canonical
-- membership topology, and therefore the current human Audience Snapshot that
-- the frozen 0079 resolver derives from open episodes - which is the input the
-- already-frozen authority, admission and delivery-revalidation layers consume.
-- A grant or reconfirm ATTEMPTED after leave still fails, but under I-03C's own
-- unchanged current-membership rule, not under anything invented here.
--
-- It does not close, delete or convert the World. One remaining active human is
-- a valid Shared World with no sole-survivor authority (CW2-03 section 26, C22 -
-- C23); zero remaining active humans is the valid inert NO_ACTIVE_HUMAN_MEMBERS
-- state, DERIVED from zero open episodes rather than stored, with no automatic
-- deletion, conversion or recovery and with empty-set unanimity never treated as
-- approval (section 27, C24).
--
-- It is ACTIVE / STANDARD only. CW2-03 section 14 freezes that ordinary
-- add-member / remove-member / leave mechanics are NOT used during INTRODUCTION,
-- which has its own single terminal transition; and section 35 blocks ordinary
-- mutation on READ_ONLY_CLOSED. All three other legal states are refused
-- through the one bounded unavailable class, and no Introduction-exit semantics
-- is invented.
--
-- Deliberately NOT here: no application wrapper, controller or route; no launch
-- gate, feature flag, entitlement, moderation or block policy; no remove-member,
-- add-member, rejoin, World-end, closed-world-viewing or history-grant command;
-- no INTRODUCTION_ENDED event and no phase transition; no Shared conversation,
-- message or QANDEEL generation; no Personal-context read of any kind. Every
-- historical migration, 0001-0082 included, is untouched.

BEGIN;

-- 1. The additive canonical episode reason. This is the only change to a
--    predecessor table, it adds nothing to any other column, and it is legal for
--    every existing row: an open episode and a historically closed one both
--    carry NULL until a reviewed command writes a reason.
ALTER TABLE public.shared_world_membership_episodes
  ADD COLUMN end_reason text;

-- 2. The durable MEMBER_LEFT fact. Table identity is the logical event, so the
--    row carries only its four facts: which World, which episode ended, which
--    human ended it, and when.
CREATE TABLE public.shared_world_member_left_events (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    membership_episode_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT shared_world_member_left_events_pk PRIMARY KEY (id),
    -- One membership episode is ended by at most one voluntary leave. This is
    -- per EPISODE, so a future rejoin episode may later leave on its own.
    CONSTRAINT shared_world_member_left_events_episode_key UNIQUE (membership_episode_id),
    CONSTRAINT shared_world_member_left_events_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_left_events_episode_fk
        FOREIGN KEY (membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_member_left_events_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

-- 3. Durable voluntary-leave command history. id is the caller-supplied command
--    id, so the primary key IS the idempotency record; there is no second
--    idempotency table and no process-local retry cache. Every persistence
--    identity the command produced is unique here as well, so one episode and
--    one event belong to exactly one committed leave and can never be re-bound.
CREATE TABLE public.shared_world_voluntary_leave_commands (
    id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    world_id uuid NOT NULL,
    membership_episode_id uuid NOT NULL,
    member_left_event_id uuid NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT shared_world_voluntary_leave_commands_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_voluntary_leave_commands_episode_key UNIQUE (membership_episode_id),
    CONSTRAINT shared_world_voluntary_leave_commands_event_key UNIQUE (member_left_event_id),
    CONSTRAINT shared_world_voluntary_leave_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_voluntary_leave_commands_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_voluntary_leave_commands_episode_fk
        FOREIGN KEY (membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_voluntary_leave_commands_event_fk
        FOREIGN KEY (member_left_event_id) REFERENCES public.shared_world_member_left_events (id) ON DELETE RESTRICT
);

-- 4. Deny-by-default posture for both new tables: RLS on, zero policies, every
--    application role revoked from every privilege. There is no direct client
--    read path and no application read boundary in I-04C.
ALTER TABLE public.shared_world_member_left_events OWNER TO postgres;
ALTER TABLE public.shared_world_voluntary_leave_commands OWNER TO postgres;
ALTER TABLE public.shared_world_member_left_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_voluntary_leave_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_world_member_left_events,
                    public.shared_world_voluntary_leave_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.shared_world_member_left_events, public.shared_world_voluntary_leave_commands FROM service_role';
END IF;END$$;

-- 5. The internal exact-human Standard voluntary-leave transaction primitive.
--
--    The caller supplies only opaque persistence identities: the command id, the
--    exact World, and the identity the new MEMBER_LEFT row will carry. There is
--    deliberately NO actor, target, episode, instant or reason parameter: the
--    human is auth.uid(), the episode is resolved from canonical current state,
--    the instant comes from the database clock and the reason is a constant.
--    The RETURNS TABLE columns are named so that none of them collides with a
--    column this body reads: an OUT parameter is a plpgsql variable, and an
--    unqualified reference to a same-named column is an execution-time
--    ambiguity error rather than a compile-time one. For the same reason the
--    single canonical instant is held in `leave_at` while the result column that
--    reports it is `left_at`.
CREATE FUNCTION public.commit_shared_world_standard_voluntary_leave_v1(
  p_command_id uuid, p_world_id uuid, p_member_left_event_id uuid
) RETURNS TABLE(outcome text, command_id uuid, left_world_id uuid, closed_membership_episode_id uuid,
                left_event_id uuid, episode_end_reason text, left_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.shared_world_voluntary_leave_commands;
  world public.shared_worlds;
  episode public.shared_world_membership_episodes;
  open_episodes integer;
  leave_at timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_VOLUNTARY_LEAVE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_member_left_event_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_VOLUNTARY_LEAVE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- The three supplied identities are OPAQUE, and opaqueness is the whole rule:
  -- no meaning is inferred from a UUID value, INCLUDING from one value being
  -- equal to another. They address three different domains - a command, a World
  -- and an event - so equality across those domains is not a contradiction and
  -- nothing frozen makes it one. A cross-domain pairwise-distinctness rule would
  -- be invented identifier algebra, and it is deliberately absent: what actually
  -- has to hold is enforced where it lives, by the primary keys, the unique
  -- bindings and the canonical-state checks below.

  -- Durable idempotency, first pass: before any lock, so an equivalent retry of
  -- a command that already committed is answered even though the episode it
  -- closed is no longer open.
  SELECT * INTO committed FROM public.shared_world_voluntary_leave_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.world_id = p_world_id
       AND committed.member_left_event_id = p_member_left_event_id THEN
      -- An equivalent retry returns the result this command COMMITTED. The
      -- closed episode, its reason and the leave instant are immutable facts;
      -- current membership and the World lifecycle are NOT, and a later
      -- authorized slice may legitimately add a successor episode for the same
      -- human or close this same stable world id. A historical command must not
      -- start answering differently because of that, so nothing below reads
      -- current topology or current World state. What is still required is that
      -- the immutable facts remain coherent.
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_member_left_events ev
          JOIN public.shared_world_membership_episodes ep ON ep.id = ev.membership_episode_id
         WHERE ev.id = committed.member_left_event_id
           AND ev.membership_episode_id = committed.membership_episode_id
           AND ev.world_id = committed.world_id
           AND ev.actor_user_id = committed.actor_user_id
           AND ev.occurred_at = committed.committed_at
           AND ep.world_id = committed.world_id
           AND ep.user_id = committed.actor_user_id
           AND ep.ended_at = committed.committed_at
           AND ep.end_reason = 'VOLUNTARY_LEAVE'
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_LEAVE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'LEFT'::text, committed.id, committed.world_id, committed.membership_episode_id,
                          committed.member_left_event_id, 'VOLUNTARY_LEAVE'::text, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_VOLUNTARY_LEAVE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the exact World row. Membership topology is a
  -- property of the World, so every topology mutation serializes here - which is
  -- also the row the frozen I-03C commands take first.
  SELECT * INTO world
    FROM public.shared_worlds w
   WHERE w.id = p_world_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_STANDARD_LEAVE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- Durable idempotency, second pass: now under the World lock, so two
  -- concurrent equivalent leaves serialize and the loser returns the committed
  -- result instead of attempting a second mutation.
  SELECT * INTO committed FROM public.shared_world_voluntary_leave_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.world_id = p_world_id
       AND committed.member_left_event_id = p_member_left_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_member_left_events ev
          JOIN public.shared_world_membership_episodes ep ON ep.id = ev.membership_episode_id
         WHERE ev.id = committed.member_left_event_id
           AND ev.membership_episode_id = committed.membership_episode_id
           AND ev.world_id = committed.world_id
           AND ev.actor_user_id = committed.actor_user_id
           AND ev.occurred_at = committed.committed_at
           AND ep.world_id = committed.world_id
           AND ep.user_id = committed.actor_user_id
           AND ep.ended_at = committed.committed_at
           AND ep.end_reason = 'VOLUNTARY_LEAVE'
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_LEAVE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'LEFT'::text, committed.id, committed.world_id, committed.membership_episode_id,
                          committed.member_left_event_id, 'VOLUNTARY_LEAVE'::text, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_VOLUNTARY_LEAVE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- ORDINARY MEMBERSHIP MECHANICS ARE ACTIVE / STANDARD ONLY. The three other
  -- legal states are refused through the one bounded class: a paired World has
  -- its own single terminal transition, which this slice neither implements nor
  -- guesses, and an archived World blocks ordinary mutation.
  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_STANDARD_LEAVE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- Impossible canonical state: one human cannot hold two open episodes in one
  -- World. The 0075 partial unique index already forbids it; fail closed rather
  -- than pick one if it is ever observed.
  SELECT count(*) INTO open_episodes
    FROM public.shared_world_membership_episodes probe
   WHERE probe.world_id = p_world_id AND probe.user_id = u AND probe.ended_at IS NULL;
  IF open_episodes > 1 THEN
    RAISE EXCEPTION 'SHARED_WORLD_LEAVE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the actor's OWN exact open episode, resolved
  -- from canonical current state rather than from any parameter. A caller who is
  -- not a current member, or who already left, reaches the same bounded answer
  -- as a caller naming a World that does not exist, so no future wrapper can
  -- become a membership oracle.
  SELECT * INTO episode
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.user_id = u AND e.ended_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_STANDARD_LEAVE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE ONE canonical leave instant, read from the database clock exactly once
  -- and reused for all three persisted moments.
  leave_at := clock_timestamp();

  BEGIN
    -- The episode is CLOSED in place. Its id, World, human and joined_at are
    -- never rewritten, the row is never removed and never replaced: the earlier
    -- membership period stays durable historical truth, and a later rejoin would
    -- be a second row rather than a reopening of this one.
    UPDATE public.shared_world_membership_episodes e
       SET ended_at = leave_at, end_reason = 'VOLUNTARY_LEAVE'
     WHERE e.id = episode.id AND e.ended_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SHARED_WORLD_LEAVE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.shared_world_member_left_events (id, world_id, membership_episode_id, actor_user_id, occurred_at)
    VALUES (p_member_left_event_id, p_world_id, episode.id, u, leave_at);

    INSERT INTO public.shared_world_voluntary_leave_commands
      (id, actor_user_id, world_id, membership_episode_id, member_left_event_id, committed_at)
    VALUES (p_command_id, u, p_world_id, episode.id, p_member_left_event_id, leave_at);
  EXCEPTION WHEN unique_violation THEN
    -- Durable idempotency, third pass. Two equivalent leaves by the same human
    -- always serialize on the World row above, but two commands sharing a
    -- command id while resolving to DIFFERENT humans do not, and this conflict
    -- is their only serialization point. So durable history is consulted before
    -- any conflict is classified.
    SELECT * INTO committed FROM public.shared_world_voluntary_leave_commands c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.actor_user_id = u AND committed.world_id = p_world_id
         AND committed.member_left_event_id = p_member_left_event_id THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.shared_world_member_left_events ev
            JOIN public.shared_world_membership_episodes ep ON ep.id = ev.membership_episode_id
           WHERE ev.id = committed.member_left_event_id
             AND ev.membership_episode_id = committed.membership_episode_id
             AND ev.world_id = committed.world_id
             AND ev.actor_user_id = committed.actor_user_id
             AND ev.occurred_at = committed.committed_at
             AND ep.world_id = committed.world_id
             AND ep.user_id = committed.actor_user_id
             AND ep.ended_at = committed.committed_at
             AND ep.end_reason = 'VOLUNTARY_LEAVE'
        ) THEN
          RAISE EXCEPTION 'SHARED_WORLD_LEAVE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
        END IF;
        RETURN QUERY SELECT 'LEFT'::text, committed.id, committed.world_id, committed.membership_episode_id,
                            committed.member_left_event_id, 'VOLUNTARY_LEAVE'::text, committed.committed_at;
        RETURN;
      END IF;
      RAISE EXCEPTION 'SHARED_WORLD_VOLUNTARY_LEAVE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- A supplied persistence identity was already taken, or the episode was
    -- already consumed by another leave. The whole transaction rolls back, and
    -- the bounded answer names neither the colliding identity nor its owner.
    RAISE EXCEPTION 'SHARED_WORLD_VOLUNTARY_LEAVE_ID_CONFLICT' USING ERRCODE='23505';
  END;

  -- The committed result is the operation, the identities involved and the
  -- frozen reason constant. It carries no human identity, no current membership,
  -- no active-human count and no current World lifecycle: those are mutable
  -- state, not facts of this command.
  RETURN QUERY SELECT 'LEFT'::text, p_command_id, p_world_id, episode.id,
                      p_member_left_event_id, 'VOLUNTARY_LEAVE'::text, leave_at;
END$$;

-- 6. Ownership and THE PRE-LAUNCH ACL: this primitive is executable by no
--    application role at all. There is no GRANT statement in this migration.
ALTER FUNCTION public.commit_shared_world_standard_voluntary_leave_v1(uuid, uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.commit_shared_world_standard_voluntary_leave_v1(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_standard_voluntary_leave_v1(uuid, uuid, uuid) FROM service_role';
END IF;END$$;

-- 7. Terminal self-assertions. The migration refuses to deploy a leave core that
--    is application-executable, caller-identified, unpinned, wrongly ordered,
--    multi-clocked, grant-mutating, World-closing, phase-changing,
--    Personal-context-reading, policy- or trigger-bearing.
DO $$
DECLARE
  fn text := 'public.commit_shared_world_standard_voluntary_leave_v1(uuid,uuid,uuid)';
  own_tables text[] := ARRAY['public.shared_world_member_left_events',
                             'public.shared_world_voluntary_leave_commands'];
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
  update_pos integer;
  event_pos integer;
  episode_columns text[];
BEGIN
  -- Argument NAMES come from pg_proc.proargnames / proargmodes and argument
  -- TYPES from pg_proc.proargtypes. A rendered signature is not the authority:
  -- pg_get_function_arguments folds this function's RETURNS TABLE columns into
  -- the same string, which would make the caller-supplied-parameter ban fire on
  -- its own result shape, and pg_get_function_identity_arguments does not render
  -- what its name suggests either.
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pr.proargnames, pr.proargmodes,
         pr.proargtypes, pg_get_userbyid(pr.proowner) AS owner
    INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
  IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-04C: % must be owned by postgres', fn; END IF;
  IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-04C: % must be SECURITY DEFINER', fn; END IF;
  IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-04C: % is a mutation and must be VOLATILE', fn; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-04C: % must pin an empty search_path', fn;
  END IF;

  -- THE PRE-LAUNCH SECURITY BOUNDARY, asserted rather than commented. This
  -- assertion is about THIS primitive only; a later reviewed launch-gated
  -- wrapper is expected and is not forbidden anywhere in this migration.
  IF has_function_privilege('public', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-04C: PUBLIC must not execute the leave core before the launch gate exists';
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04C: % must not execute the leave core before the launch gate exists', target_role;
    END IF;
  END LOOP;

  -- The leaving human is exactly auth.uid(), with no caller-supplied identity of
  -- any kind. The exact signature is pinned, so the negative name bans below can
  -- never pass vacuously against a renamed parameter list.
  IF p.prosrc !~ 'auth\.uid\(\)' THEN
    RAISE EXCEPTION 'I-04C: % must derive the leaving human from auth.uid()', fn;
  END IF;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
         array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
    INTO in_names, out_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id', 'p_world_id', 'p_member_left_event_id'] THEN
    RAISE EXCEPTION 'I-04C: % must accept exactly the three opaque persistence identities, not %', fn, in_names;
  END IF;
  SELECT array_agg(t.typname::text ORDER BY a.ord) INTO in_types
    FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
    JOIN pg_type t ON t.oid = a.argtype;
  IF in_types <> ARRAY['uuid', 'uuid', 'uuid'] THEN
    RAISE EXCEPTION 'I-04C: % must accept only opaque uuid identities, not %', fn, in_types;
  END IF;
  -- The ban is non-vacuous by construction: the exact list above proves these
  -- really are the parameter names being scanned. No actor, no target, no
  -- episode, no instant, no reason, no audience and no member count.
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'user_id|actor|target|leaver|member(ship)?_episode|episode_id|reason|audience|count|status|lifecycle|phase|timestamp|_at$' THEN
      RAISE EXCEPTION 'I-04C: % must not accept an actor, target, episode, reason, audience, count or clock parameter', fn;
    END IF;
  END LOOP;
  -- The committed result is bounded and immutable: the operation, the identities
  -- involved and the frozen reason constant.
  IF out_names <> ARRAY['outcome', 'command_id', 'left_world_id', 'closed_membership_episode_id',
                        'left_event_id', 'episode_end_reason', 'left_at'] THEN
    RAISE EXCEPTION 'I-04C: % must return exactly the bounded committed result, not %', fn, out_names;
  END IF;

  -- No Personal context, no Standing Context / consent mutation of any kind, no
  -- paired-phase or Matching state, and nothing deleted. A departed owner's
  -- valid current grant is not this command's business to revoke.
  IF p.prosrc ~* 'conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|consent|matching|introduction' THEN
    RAISE EXCEPTION 'I-04C: % must not read Personal context or touch Standing Context / consent state', fn;
  END IF;
  IF p.prosrc ~* 'DELETE FROM' OR p.prosrc ~* 'TRUNCATE' THEN
    RAISE EXCEPTION 'I-04C: % may never delete canonical history', fn;
  END IF;
  IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' THEN
    RAISE EXCEPTION 'I-04C: % locks rows in the canonical order, never a table and never an advisory key', fn;
  END IF;

  -- Leave never closes, reopens, converts or re-phases the World, and never
  -- writes any lifecycle or phase literal.
  IF p.prosrc ~ 'UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds' THEN
    RAISE EXCEPTION 'I-04C: % must not create, close or mutate a Shared World', fn;
  END IF;
  IF p.prosrc ~ 'READ_ONLY_CLOSED|closed_at|MUTUAL_MATCH|birth_basis' THEN
    RAISE EXCEPTION 'I-04C: % must not close a World or touch its birth state', fn;
  END IF;
  -- And it is ACTIVE / STANDARD only, positively.
  IF p.prosrc !~ 'world\.lifecycle <> ''ACTIVE'' OR world\.phase <> ''STANDARD''' THEN
    RAISE EXCEPTION 'I-04C: % must refuse every state that is not ACTIVE / STANDARD', fn;
  END IF;

  -- The episode is CLOSED in place with the canonical reason, in ONE statement,
  -- and no other reason literal may appear.
  IF p.prosrc !~ 'SET ended_at = leave_at, end_reason = ''VOLUNTARY_LEAVE''' THEN
    RAISE EXCEPTION 'I-04C: a voluntary leave must set ended_at and end_reason together, in one statement';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, '''VOLUNTARY_LEAVE''', '')))
     / length('''VOLUNTARY_LEAVE''') <> 8 THEN
    RAISE EXCEPTION 'I-04C: VOLUNTARY_LEAVE is the only reason this slice writes, and every retry path must prove it';
  END IF;
  IF p.prosrc ~ 'REMOVED|WORLD_CLOSED|MEMBER_REMOVED|MEMBER_REJOINED|WORLD_ENDED|INTRODUCTION_ENDED' THEN
    RAISE EXCEPTION 'I-04C: % must not write any end reason or event this slice does not own', fn;
  END IF;

  -- DURABLE RESULT IDEMPOTENCY. An equivalent retry must return the result the
  -- command COMMITTED: never current membership, never the current World row. A
  -- later authorized rejoin or closure must not change a historical answer.
  IF p.prosrc ~ 'RETURN QUERY SELECT[^;]*(world\.|episode\.ended_at|open_episodes)' THEN
    RAISE EXCEPTION 'I-04C: an equivalent retry must return the committed leave result, never current World or membership state';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc,
        'RETURN QUERY SELECT ''LEFT''::text, committed.id, committed.world_id, committed.membership_episode_id,', '')))
     / length('RETURN QUERY SELECT ''LEFT''::text, committed.id, committed.world_id, committed.membership_episode_id,') <> 3 THEN
    RAISE EXCEPTION 'I-04C: every equivalent retry must return the identities and constant this command committed';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc,
        'JOIN public.shared_world_membership_episodes ep ON ep.id = ev.membership_episode_id', '')))
     / length('JOIN public.shared_world_membership_episodes ep ON ep.id = ev.membership_episode_id') <> 3 THEN
    RAISE EXCEPTION 'I-04C: every equivalent retry must fail closed on a closed episode or leave fact that stopped being coherent';
  END IF;

  -- THE CANONICAL LOCK ORDER, asserted on the stored source: the exact World
  -- row, then the actor's own open episode, and only then any write.
  world_pos := strpos(p.prosrc, 'FROM public.shared_worlds w');
  episode_pos := strpos(p.prosrc, 'FROM public.shared_world_membership_episodes e');
  update_pos := strpos(p.prosrc, 'UPDATE public.shared_world_membership_episodes');
  event_pos := strpos(p.prosrc, 'INSERT INTO public.shared_world_member_left_events');
  IF world_pos = 0 OR episode_pos = 0 OR update_pos = 0 OR event_pos = 0
     OR world_pos > episode_pos OR episode_pos > update_pos OR update_pos > event_pos THEN
    RAISE EXCEPTION 'I-04C: leave must lock the exact World row, then the actor own open episode, before any write';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'FOR UPDATE', ''))) / length('FOR UPDATE') <> 2 THEN
    RAISE EXCEPTION 'I-04C: the leave core takes exactly two row locks: the World and the actor own open episode';
  END IF;

  -- ONE database-owned leave instant, captured exactly once.
  IF (length(p.prosrc) - length(replace(p.prosrc, 'leave_at := ', ''))) / length('leave_at := ') <> 1 THEN
    RAISE EXCEPTION 'I-04C: the canonical leave instant must be captured exactly once';
  END IF;
  IF p.prosrc ~ 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp' THEN
    RAISE EXCEPTION 'I-04C: every persisted leave moment must be the one captured instant, never a second clock read';
  END IF;

  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.proname = 'commit_shared_world_standard_voluntary_leave_v1') <> 1 THEN
    RAISE EXCEPTION 'I-04C: exactly one leave core must exist, with one overload';
  END IF;

  -- The canonical episode gained exactly one additive nullable column and lost
  -- nothing: every column migration 0075 owns is still present, in order, and
  -- end_reason is nullable so an open episode carries none.
  --
  --    Asserted as a PREFIX plus one named addition rather than as a census of
  --    the live column list, so this assertion says what 0083 did without
  --    forbidding what a later authorized slice may append.
  SELECT array_agg(c.column_name::text ORDER BY c.ordinal_position) INTO episode_columns
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = 'shared_world_membership_episodes';
  IF episode_columns[1:5] <> ARRAY['id','world_id','user_id','joined_at','ended_at'] THEN
    RAISE EXCEPTION 'I-04C: the canonical episode must keep every column migration 0075 owns, in place, not %', episode_columns;
  END IF;
  IF episode_columns[6] <> 'end_reason' THEN
    RAISE EXCEPTION 'I-04C: end_reason must be APPENDED to the canonical episode, not inserted among 0075 columns, observed %', episode_columns;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name = 'shared_world_membership_episodes'
       AND c.column_name = 'end_reason' AND (c.data_type <> 'text' OR c.is_nullable <> 'YES')
  ) THEN
    RAISE EXCEPTION 'I-04C: end_reason must be an additive nullable text column';
  END IF;

  -- Both new tables are unreachable by every application role, carry RLS with no
  -- policy, and carry no trigger.
  FOREACH target_table IN ARRAY own_tables LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN RAISE EXCEPTION 'I-04C: row level security must be enabled on %', target_table; END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04C: no RLS policy may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION 'I-04C: no trigger may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = target_table::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-04C: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04C: direct table access stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- Leaving creates no superior World authority for whoever stays, and the leave
  -- history is not a generic event or capability engine.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_world_member_left_events','shared_world_voluntary_leave_commands')
       AND (c.column_name ~* '(owner|admin|creator|initiator|survivor|privilege|role|capability|kind|event_type|payload|metadata|scope|permission|reason|approval|vote)'
            OR c.data_type IN ('json','jsonb','ARRAY'))
  ) THEN
    RAISE EXCEPTION 'I-04C: leave creates no owner, admin or sole survivor, and the MEMBER_LEFT fact is not a generic event engine';
  END IF;

  -- MEMBERSHIP AND CONSENT STAY SEPARATE TRUTHS. No trigger anywhere may couple
  -- an episode to a grant, a ceiling or a consent event, in either direction.
  FOREACH target_table IN ARRAY ARRAY['public.shared_world_membership_episodes',
                                      'public.shared_world_standing_context_grants',
                                      'public.shared_world_standing_context_grant_audience',
                                      'public.shared_world_standing_context_consent_events'] LOOP
    IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION 'I-04C: no trigger may couple membership to Standing Context state on %', target_table;
    END IF;
  END LOOP;

  -- The whole Shared substrate keeps its posture: still zero-policy, still with
  -- no application-role privilege and no direct mutation path.
  FOREACH target_table IN ARRAY ARRAY['public.shared_worlds','public.shared_world_membership_episodes',
                                      'public.shared_world_invite_credential_state','public.shared_world_direct_invitations',
                                      'public.shared_world_direct_birth_events','public.shared_world_direct_acceptance_commands',
                                      'public.shared_world_standing_context_grants',
                                      'public.shared_world_standing_context_grant_audience'] LOOP
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04C: no RLS policy may be added to %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04C: the Shared substrate stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END$$;

COMMIT;
