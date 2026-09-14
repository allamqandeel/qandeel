-- I-04B - Direct Invitation Acceptance Transaction Core + Atomic
-- ACTIVE/STANDARD Shared World Birth v1.
--
-- I-04A created the prospective direct path and stopped exactly where World
-- birth begins. This is the first migration allowed to create a real Shared
-- World, and it implements CW2-03 section 6 as ONE atomic transaction:
--
--   valid exact-target acceptance
--     -> consume the exact PENDING invitation
--     -> create the SHARED_WORLD                (ACTIVE / STANDARD)
--     -> create the inviter membership episode
--     -> create the target membership episode
--     -> append the direct WORLD_BIRTH fact
--     -> mark the invitation ACCEPTED
--     -> record durable acceptance idempotency
--
-- All seven writes commit together or not at all.
--
-- ===========================================================================
-- THE PRE-LAUNCH SECURITY BOUNDARY - why nothing here is app-callable
-- ===========================================================================
--
-- CW2-03 section 6 lists `system policy allows creation` among the birth
-- preconditions, and CW2-08 section 25 / H18 freezes that a consequential
-- action binds a CURRENT launch gate snapshot before an irreversible commit,
-- with section 40 making UNKNOWN / UNCONFIGURED / UNSATISFIED / UNTESTED
-- fail closed for the scoped capability. The Connected Worlds launch gate does
-- not exist yet in this repository.
--
-- Creating a Shared World is irreversible: CW2-03 section 31 makes World end an
-- archival closure, never a deletion. So this slice implements the transaction
-- core fully and leaves it NON-APPLICATION-EXECUTABLE:
--
--   PUBLIC        -> no EXECUTE
--   anon          -> no EXECUTE
--   authenticated -> no EXECUTE
--   service_role  -> no EXECUTE
--
-- That is not a temporary testing convenience; it is the boundary itself, and
-- the terminal self-assertions below refuse to deploy without it. A later
-- REVIEWED launch-gated wrapper is expected to authenticate the exact human,
-- resolve and revalidate current system/launch policy, preserve that human's
-- own session claims and only then invoke this primitive. Nothing here forbids
-- such a wrapper; this migration simply does not pretend the gate is satisfied.
--
-- The primitive stays safe under that future wrapper because it derives the
-- acceptor from auth.uid() and accepts NO acceptor, actor or target parameter.
-- A wrapper may therefore RESTRICT whether the operation proceeds, but it can
-- never substitute another principal for the exact human target (CW2-01
-- section 7: QANDEEL is never a consent provider; CW2-08 section 2 / H1: no
-- launch or safety mechanism may manufacture missing human authority).
--
-- ===========================================================================
-- What this migration creates
-- ===========================================================================
--
--   * public.shared_world_direct_birth_events - the durable direct WORLD_BIRTH
--     fact (CW2-03 section 46). Table identity IS the event type, so there is
--     no payload, no event-name column, no mutable event state and no generic
--     event engine. One born World has exactly one row, and one direct
--     invitation can source at most one World birth (CW2-03 C6).
--   * public.shared_world_direct_acceptance_commands - the narrow durable
--     acceptance command history that makes the birth idempotent (CW2-03
--     section 47, C41). The row id IS the caller-supplied command id, so the
--     primary key is the idempotency record, and every persistence identity the
--     command produced is bound to it and unique.
--   * public.commit_shared_world_direct_acceptance_birth_v1 - the internal
--     exact-target acceptance and birth transaction primitive.
--
-- Existing frozen tables are REUSED, never replaced or generalized:
-- public.shared_worlds and public.shared_world_membership_episodes (I-02A,
-- 0075), public.shared_world_invite_credential_state and
-- public.shared_world_direct_invitations (I-04A, 0081). No owner, admin,
-- creator, initiator, privilege, role or capability column is added anywhere:
-- the inviter's factual role in the invitation confers no superior World
-- authority (CW2-01 section 5, CW2-03 section 16).
--
-- CANONICAL LOCK ORDER - continued exactly from I-04A:
--
--   1. the target credential-state row   (SELECT ... FOR UPDATE)
--   2. the exact invitation row          (SELECT ... FOR UPDATE)
--
-- Acceptance requires auth.uid() to BE the invitation target, so the target's
-- credential row is the acceptor's own row and can be taken first without
-- reading the invitation at all. Rotation (0081) takes the same row first, so
-- an acceptance racing a rotation on one target serializes on one row and has
-- exactly two canonical outcomes: acceptance commits and the later rotation
-- leaves the now-ACCEPTED invitation untouched, or the rotation commits and the
-- acceptance then sees a non-PENDING or stale-epoch invitation and no World is
-- born. No advisory lock, no table lock and no process-local mutex is used, so
-- the order cannot deadlock.
--
-- ONE canonical birth instant: a single database-owned timestamp is captured
-- once inside the transaction and persisted, unchanged, as the World's born_at,
-- both episodes' joined_at, the birth event's occurred_at, the invitation's
-- terminal_at and the command's committed_at. No client timestamp is accepted
-- and no second clock read can drift.
--
-- Deliberately NOT here: no application wrapper, controller or route; no launch
-- gate, feature flag, emergency disable, entitlement, moderation or block
-- policy; no decline / cancel / expiry / add-member / leave / remove / rejoin
-- command; no World name, description, topic, avatar or settings requirement
-- (CW2-03 section 7); no Shared conversation, message or QANDEEL generation; no
-- Personal-context read of any kind and no Standing Context Grant (CW2-03
-- section 8, C7); no Matching proposal, Mutual Match, IntroductionRecord or
-- INTRODUCTION-phase birth; no account-status, ban, age, entitlement or safety
-- eligibility model - the canonical repository has no such frozen Connected
-- Worlds restriction, and this slice requires only that the canonical human
-- rows exist, which the restrictive foreign keys already enforce. Migrations
-- 0001-0081 are untouched.

BEGIN;

-- 1. The durable direct WORLD_BIRTH fact. Table identity is the logical event
--    WORLD_BIRTH / ACCEPTED_INVITATION, so the row carries only its three
--    facts: which World was born, which invitation sourced it, and when.
CREATE TABLE public.shared_world_direct_birth_events (
    world_id uuid NOT NULL,
    invitation_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    -- One born World has exactly one direct birth event.
    CONSTRAINT shared_world_direct_birth_events_pk PRIMARY KEY (world_id),
    -- One direct invitation sources at most one World birth (CW2-03 C6).
    CONSTRAINT shared_world_direct_birth_events_invitation_key UNIQUE (invitation_id),
    CONSTRAINT shared_world_direct_birth_events_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_direct_birth_events_invitation_fk
        FOREIGN KEY (invitation_id) REFERENCES public.shared_world_direct_invitations (id) ON DELETE RESTRICT
);

-- 2. Durable acceptance command history. id is the caller-supplied command id,
--    so the primary key IS the idempotency record; there is no second
--    idempotency table and no process-local retry cache. Every persistence
--    identity the command produced is unique here as well, so one invitation,
--    one World and each membership episode belong to exactly one committed
--    acceptance and can never be re-bound to a second one.
CREATE TABLE public.shared_world_direct_acceptance_commands (
    id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    invitation_id uuid NOT NULL,
    world_id uuid NOT NULL,
    inviter_membership_episode_id uuid NOT NULL,
    target_membership_episode_id uuid NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT shared_direct_acceptance_pk PRIMARY KEY (id),
    CONSTRAINT shared_direct_acceptance_invitation_key UNIQUE (invitation_id),
    CONSTRAINT shared_direct_acceptance_world_key UNIQUE (world_id),
    CONSTRAINT shared_direct_acceptance_inviter_episode_key UNIQUE (inviter_membership_episode_id),
    CONSTRAINT shared_direct_acceptance_target_episode_key UNIQUE (target_membership_episode_id),
    CONSTRAINT shared_direct_acceptance_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_direct_acceptance_invitation_fk
        FOREIGN KEY (invitation_id) REFERENCES public.shared_world_direct_invitations (id) ON DELETE RESTRICT,
    CONSTRAINT shared_direct_acceptance_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_direct_acceptance_inviter_episode_fk
        FOREIGN KEY (inviter_membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT,
    CONSTRAINT shared_direct_acceptance_target_episode_fk
        FOREIGN KEY (target_membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT,
    -- The two birth episodes are two distinct rows for two distinct humans.
    CONSTRAINT shared_direct_acceptance_distinct_episodes_check
        CHECK (inviter_membership_episode_id <> target_membership_episode_id)
);

-- 3. Deny-by-default posture for both new tables: RLS on, zero policies, every
--    application role revoked from every privilege. There is no direct client
--    read path and no application read boundary in I-04B.
ALTER TABLE public.shared_world_direct_birth_events OWNER TO postgres;
ALTER TABLE public.shared_world_direct_acceptance_commands OWNER TO postgres;
ALTER TABLE public.shared_world_direct_birth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_direct_acceptance_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_world_direct_birth_events,
                    public.shared_world_direct_acceptance_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.shared_world_direct_birth_events, public.shared_world_direct_acceptance_commands FROM service_role';
END IF;END$$;

-- 4. The internal exact-target acceptance and birth transaction primitive.
--
--    The caller supplies only opaque persistence identities: the command id and
--    the three new row identities this birth will create. The kernel
--    (apps/api/src/connected-worlds/kernel/world-invariants.ts) explicitly
--    brands a caller-supplied worldId and never generates one, so no UUID
--    generation policy is invented here either. There is deliberately NO
--    acceptor, actor or target parameter: the human is auth.uid() and the
--    inviter and target are read from the persisted invitation.
CREATE FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(
  p_command_id uuid, p_invitation_id uuid, p_world_id uuid,
  p_inviter_membership_episode_id uuid, p_target_membership_episode_id uuid
) RETURNS TABLE(outcome text, command_id uuid, accepted_invitation_id uuid, born_world_id uuid,
                world_lifecycle text, world_phase text, world_birth_basis text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.shared_world_direct_acceptance_commands;
  invitation public.shared_world_direct_invitations;
  current_epoch bigint;
  birth_at timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'SHARED_DIRECT_ACCEPTANCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_invitation_id IS NULL OR p_world_id IS NULL
     OR p_inviter_membership_episode_id IS NULL OR p_target_membership_episode_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_DIRECT_ACCEPTANCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- The five supplied identities are opaque and pairwise distinct. No identity
  -- semantics is inferred from a UUID value; in particular the invitation id is
  -- never reused as the World id.
  IF (SELECT count(DISTINCT supplied) FROM unnest(ARRAY[p_command_id, p_invitation_id, p_world_id,
        p_inviter_membership_episode_id, p_target_membership_episode_id]) AS supplied) <> 5 THEN
    RAISE EXCEPTION 'SHARED_DIRECT_ACCEPTANCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- Durable idempotency, first pass: BEFORE any lock, so an equivalent retry of
  -- a command that already committed is answered even though the invitation it
  -- consumed is no longer PENDING.
  SELECT * INTO committed FROM public.shared_world_direct_acceptance_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.invitation_id = p_invitation_id
       AND committed.world_id = p_world_id
       AND committed.inviter_membership_episode_id = p_inviter_membership_episode_id
       AND committed.target_membership_episode_id = p_target_membership_episode_id THEN
      -- An equivalent retry returns the result this command COMMITTED, never a
      -- read of the live World row. The birth basis, the sourcing invitation,
      -- the birth membership and the birth instant are immutable facts of the
      -- birth; the World lifecycle is NOT, and a later reviewed slice may
      -- legitimately transition this same stable world id. A historical command
      -- must not start answering differently because of that, so the constants
      -- below are the ones this command committed. What is still required is
      -- that the immutable facts remain coherent: a command whose World or
      -- birth fact has vanished, or whose World is no longer a directly born
      -- one, is contradictory rather than repairable.
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_worlds w
          JOIN public.shared_world_direct_birth_events e ON e.world_id = w.id
         WHERE w.id = committed.world_id
           AND w.birth_basis = 'ACCEPTED_INVITATION'
           AND e.invitation_id = committed.invitation_id
      ) THEN
        RAISE EXCEPTION 'SHARED_DIRECT_BIRTH_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'BORN'::text, committed.id, committed.invitation_id, committed.world_id,
                          'ACTIVE'::text, 'STANDARD'::text, 'ACCEPTED_INVITATION'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_DIRECT_ACCEPTANCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the target credential-state row. A valid
  -- acceptance requires auth.uid() to be the invitation's persisted target, so
  -- the target's credential row IS the caller's own row and is taken before the
  -- invitation is read at all. This is the same row the 0081 rotation command
  -- takes first, which is what makes the two operations serialize.
  SELECT s.epoch INTO current_epoch
    FROM public.shared_world_invite_credential_state s
   WHERE s.user_id = u
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_DIRECT_INVITATION_NOT_ACCEPTABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the exact invitation row.
  SELECT * INTO invitation
    FROM public.shared_world_direct_invitations i
   WHERE i.id = p_invitation_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_DIRECT_INVITATION_NOT_ACCEPTABLE' USING ERRCODE='P0002';
  END IF;

  -- Durable idempotency, second pass: now under both locks, so two concurrent
  -- equivalent acceptances serialize and the loser returns the committed result
  -- instead of attempting a second birth.
  SELECT * INTO committed FROM public.shared_world_direct_acceptance_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.invitation_id = p_invitation_id
       AND committed.world_id = p_world_id
       AND committed.inviter_membership_episode_id = p_inviter_membership_episode_id
       AND committed.target_membership_episode_id = p_target_membership_episode_id THEN
      -- An equivalent retry returns the result this command COMMITTED, never a
      -- read of the live World row. The birth basis, the sourcing invitation,
      -- the birth membership and the birth instant are immutable facts of the
      -- birth; the World lifecycle is NOT, and a later reviewed slice may
      -- legitimately transition this same stable world id. A historical command
      -- must not start answering differently because of that, so the constants
      -- below are the ones this command committed. What is still required is
      -- that the immutable facts remain coherent: a command whose World or
      -- birth fact has vanished, or whose World is no longer a directly born
      -- one, is contradictory rather than repairable.
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_worlds w
          JOIN public.shared_world_direct_birth_events e ON e.world_id = w.id
         WHERE w.id = committed.world_id
           AND w.birth_basis = 'ACCEPTED_INVITATION'
           AND e.invitation_id = committed.invitation_id
      ) THEN
        RAISE EXCEPTION 'SHARED_DIRECT_BIRTH_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'BORN'::text, committed.id, committed.invitation_id, committed.world_id,
                          'ACTIVE'::text, 'STANDARD'::text, 'ACCEPTED_INVITATION'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_DIRECT_ACCEPTANCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- THE CANONICAL CURRENT STATE, revalidated under both locks. Every one of
  -- these is externally the same answer: the prospective object is not
  -- acceptable. The caller learns nothing about the inviter, the target, why
  -- the invitation terminalized, the current epoch, or whether the invitation
  -- ever existed, so no future wrapper can become an existence oracle.
  IF invitation.target_user_id <> u
     OR invitation.status <> 'PENDING'
     OR invitation.target_credential_epoch <> current_epoch THEN
    RAISE EXCEPTION 'SHARED_DIRECT_INVITATION_NOT_ACCEPTABLE' USING ERRCODE='P0002';
  END IF;
  -- Impossible canonical state: a PENDING invitation that already sourced a
  -- birth. Fail closed rather than silently repair or birth a second World.
  IF EXISTS (SELECT 1 FROM public.shared_world_direct_birth_events e WHERE e.invitation_id = p_invitation_id) THEN
    RAISE EXCEPTION 'SHARED_DIRECT_BIRTH_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- THE ONE canonical birth instant, read from the database clock exactly once
  -- and reused for all six persisted moments, so the birth is temporally
  -- coherent and no second clock read can drift.
  birth_at := clock_timestamp();

  BEGIN
    -- A direct birth is ACTIVE / STANDARD with basis ACCEPTED_INVITATION and no
    -- closure moment. No other birth state is legal (CW2-03 section 2).
    INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis, born_at, closed_at)
    VALUES (p_world_id, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION', birth_at, NULL);

    -- Birth membership is EXACTLY the pair that acted: the invitation's inviter
    -- and its exact accepting target, both open. No third human, no system
    -- member, no role column, and both user ids come from the persisted
    -- invitation rather than from any parameter.
    INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)
    VALUES (p_inviter_membership_episode_id, p_world_id, invitation.inviter_user_id, birth_at, NULL),
           (p_target_membership_episode_id, p_world_id, invitation.target_user_id, birth_at, NULL);

    INSERT INTO public.shared_world_direct_birth_events (world_id, invitation_id, occurred_at)
    VALUES (p_world_id, p_invitation_id, birth_at);

    -- Consume the exact invitation in the same transaction. The row is never
    -- removed, its inviter / target binding is never rewritten and its bound
    -- credential epoch is never rewritten: the prospective object stays durable
    -- historical truth.
    UPDATE public.shared_world_direct_invitations i
       SET status = 'ACCEPTED', terminal_at = birth_at
     WHERE i.id = p_invitation_id AND i.status = 'PENDING';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SHARED_DIRECT_BIRTH_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.shared_world_direct_acceptance_commands
      (id, actor_user_id, invitation_id, world_id,
       inviter_membership_episode_id, target_membership_episode_id, committed_at)
    VALUES (p_command_id, u, p_invitation_id, p_world_id,
            p_inviter_membership_episode_id, p_target_membership_episode_id, birth_at);
  EXCEPTION WHEN unique_violation THEN
    -- Durable idempotency, third pass. Two equivalent acceptances by the same
    -- human always serialize on the credential row above, but two commands that
    -- share a command id while resolving to DIFFERENT humans do not, and their
    -- only serialization point is this conflict. So durable history is consulted
    -- before any conflict is classified.
    SELECT * INTO committed FROM public.shared_world_direct_acceptance_commands c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.actor_user_id = u AND committed.invitation_id = p_invitation_id
         AND committed.world_id = p_world_id
         AND committed.inviter_membership_episode_id = p_inviter_membership_episode_id
         AND committed.target_membership_episode_id = p_target_membership_episode_id THEN
        -- An equivalent retry returns the result this command COMMITTED, never a
        -- read of the live World row. The birth basis, the sourcing invitation,
        -- the birth membership and the birth instant are immutable facts of the
        -- birth; the World lifecycle is NOT, and a later reviewed slice may
        -- legitimately transition this same stable world id. A historical command
        -- must not start answering differently because of that, so the constants
        -- below are the ones this command committed. What is still required is
        -- that the immutable facts remain coherent: a command whose World or
        -- birth fact has vanished, or whose World is no longer a directly born
        -- one, is contradictory rather than repairable.
        IF NOT EXISTS (
          SELECT 1 FROM public.shared_worlds w
            JOIN public.shared_world_direct_birth_events e ON e.world_id = w.id
           WHERE w.id = committed.world_id
             AND w.birth_basis = 'ACCEPTED_INVITATION'
             AND e.invitation_id = committed.invitation_id
        ) THEN
          RAISE EXCEPTION 'SHARED_DIRECT_BIRTH_CONTRADICTORY_STATE' USING ERRCODE='P0001';
        END IF;
        RETURN QUERY SELECT 'BORN'::text, committed.id, committed.invitation_id, committed.world_id,
                            'ACTIVE'::text, 'STANDARD'::text, 'ACCEPTED_INVITATION'::text;
        RETURN;
      END IF;
      RAISE EXCEPTION 'SHARED_DIRECT_ACCEPTANCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- A supplied persistence identity was already taken. The whole birth rolls
    -- back together, and the bounded answer names neither the colliding
    -- identity nor the row that already owns it.
    RAISE EXCEPTION 'SHARED_DIRECT_BIRTH_ID_CONFLICT' USING ERRCODE='23505';
  END;

  -- The committed result is the operation and the frozen birth constants, and
  -- carries no human identity, no profile and no private state of any kind.
  RETURN QUERY SELECT 'BORN'::text, p_command_id, p_invitation_id, p_world_id,
                      'ACTIVE'::text, 'STANDARD'::text, 'ACCEPTED_INVITATION'::text;
END$$;

-- 5. Ownership and THE PRE-LAUNCH ACL: this primitive is executable by no
--    application role at all. There is no GRANT statement in this migration.
ALTER FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(uuid, uuid, uuid, uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(uuid, uuid, uuid, uuid, uuid) FROM service_role';
END IF;END$$;

-- 6. Terminal self-assertions. The migration refuses to deploy a birth core
--    that is application-executable, caller-identified, unpinned, wrongly
--    ordered, multi-clocked, Personal-context-reading, policy- or
--    trigger-bearing, or that can birth anything but ACTIVE / STANDARD.
DO $$
DECLARE
  fn text := 'public.commit_shared_world_direct_acceptance_birth_v1(uuid,uuid,uuid,uuid,uuid)';
  own_tables text[] := ARRAY['public.shared_world_direct_birth_events',
                             'public.shared_world_direct_acceptance_commands'];
  p record;
  in_names text[];
  in_types text[];
  out_names text[];
  arg_name text;
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
  credential_pos integer;
  invitation_pos integer;
  world_pos integer;
  episode_pos integer;
BEGIN
  -- Argument NAMES are read from pg_proc.proargnames / proargmodes rather than
  -- from a rendered signature: pg_get_function_identity_arguments returns types
  -- only, which would make every parameter-name check below vacuously true, and
  -- pg_get_function_arguments folds the OUT columns of RETURNS TABLE into the
  -- same string, which would make the caller-supplied-parameter ban fire on this
  -- function's own result shape. The catalog arrays separate the two exactly.
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pr.proargnames, pr.proargmodes,
         pr.proargtypes, pg_get_userbyid(pr.proowner) AS owner
    INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
  IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-04B: % must be owned by postgres', fn; END IF;
  IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-04B: % must be SECURITY DEFINER', fn; END IF;
  IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-04B: % is a mutation and must be VOLATILE', fn; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-04B: % must pin an empty search_path', fn;
  END IF;

  -- THE PRE-LAUNCH SECURITY BOUNDARY, asserted rather than commented. The
  -- frozen system-policy / launch-gate precondition is not implemented, so the
  -- birth core is executable by no application role. This assertion is about
  -- THIS primitive only; a later reviewed launch-gated wrapper is expected.
  IF has_function_privilege('public', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-04B: PUBLIC must not execute the birth core before the launch gate exists';
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04B: % must not execute the birth core before the launch gate exists', target_role;
    END IF;
  END LOOP;

  -- Human acceptance authority is exactly auth.uid(), with no caller-supplied
  -- identity of any kind. The exact signature is pinned, so the negative name
  -- bans below can never pass vacuously against a renamed parameter list.
  IF p.prosrc !~ 'auth\.uid\(\)' THEN
    RAISE EXCEPTION 'I-04B: % must derive the accepting human from auth.uid()', fn;
  END IF;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
         array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
    INTO in_names, out_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id', 'p_invitation_id', 'p_world_id',
                       'p_inviter_membership_episode_id', 'p_target_membership_episode_id'] THEN
    RAISE EXCEPTION 'I-04B: % must accept exactly the five opaque persistence identities, not %', fn, in_names;
  END IF;
  -- pg_proc.proargtypes holds the IN argument types and nothing else, so it is
  -- the authority here. A rendered signature is not: pg_get_function_arguments
  -- folds this function's RETURNS TABLE columns into the same string, and
  -- pg_get_function_identity_arguments does not render what its name suggests
  -- either. Every one of these checks names the observed value when it fails.
  SELECT array_agg(t.typname::text ORDER BY a.ord) INTO in_types
    FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
    JOIN pg_type t ON t.oid = a.argtype;
  IF in_types <> ARRAY['uuid', 'uuid', 'uuid', 'uuid', 'uuid'] THEN
    RAISE EXCEPTION 'I-04B: % must accept only opaque uuid identities, not %', fn, in_types;
  END IF;
  -- The ban is non-vacuous by construction: the exact list above proves these
  -- really are the parameter names being scanned.
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'user_id|acceptor|actor|status|epoch|basis|lifecycle|phase|timestamp|_at$' THEN
      RAISE EXCEPTION 'I-04B: % must not accept an acceptor, actor, target, status, epoch or clock parameter', fn;
    END IF;
  END LOOP;
  -- The committed result is bounded: the operation, the identities the caller
  -- already supplied and the frozen birth constants. No human, profile, epoch or
  -- private column may be added to it.
  IF out_names <> ARRAY['outcome', 'command_id', 'accepted_invitation_id', 'born_world_id',
                        'world_lifecycle', 'world_phase', 'world_birth_basis'] THEN
    RAISE EXCEPTION 'I-04B: % must return exactly the bounded committed result, not %', fn, out_names;
  END IF;

  -- No hidden Personal truth at birth (CW2-03 section 8, C7), no Standing
  -- Context authority, no Matching or Introduction state, and nothing deleted.
  IF p.prosrc ~* 'conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|matching|introduction' THEN
    RAISE EXCEPTION 'I-04B: % must not read Personal context or create Standing Context / Matching state', fn;
  END IF;
  IF p.prosrc ~* 'DELETE FROM' OR p.prosrc ~* 'TRUNCATE' THEN
    RAISE EXCEPTION 'I-04B: % may never delete canonical history', fn;
  END IF;
  IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' THEN
    RAISE EXCEPTION 'I-04B: % locks rows in the canonical order, never a table and never an advisory key', fn;
  END IF;

  -- A direct birth is ACTIVE / STANDARD / ACCEPTED_INVITATION, and no other
  -- phase or lifecycle literal may appear in the birth core.
  IF p.prosrc !~ 'VALUES \(p_world_id, ''ACTIVE'', ''STANDARD'', ''ACCEPTED_INVITATION'', birth_at, NULL\)' THEN
    RAISE EXCEPTION 'I-04B: a direct birth must be exactly ACTIVE / STANDARD / ACCEPTED_INVITATION with no closure moment';
  END IF;
  IF p.prosrc ~ 'READ_ONLY_CLOSED|MUTUAL_MATCH|''DRAFT''|''DORMANT''' THEN
    RAISE EXCEPTION 'I-04B: the direct birth core may create no other lifecycle, phase or birth basis';
  END IF;

  -- DURABLE RESULT IDEMPOTENCY. An equivalent retry must return the result the
  -- command COMMITTED, so it may never read the live World row into its result:
  -- a later reviewed lifecycle slice may transition this same stable world id,
  -- and a historical command must not start answering differently because of it.
  IF p.prosrc ~ 'RETURN QUERY SELECT[^;]*w\.(lifecycle|phase|birth_basis)' THEN
    RAISE EXCEPTION 'I-04B: an equivalent retry must return the committed birth result, never the World current state';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc,
        'RETURN QUERY SELECT ''BORN''::text, committed.id, committed.invitation_id, committed.world_id,', '')))
     / length('RETURN QUERY SELECT ''BORN''::text, committed.id, committed.invitation_id, committed.world_id,') <> 3 THEN
    RAISE EXCEPTION 'I-04B: every equivalent retry must return the identities and constants this command committed';
  END IF;
  -- And the immutable facts must still be coherent, checked once per retry path.
  IF (length(p.prosrc) - length(replace(p.prosrc,
        'JOIN public.shared_world_direct_birth_events e ON e.world_id = w.id', '')))
     / length('JOIN public.shared_world_direct_birth_events e ON e.world_id = w.id') <> 3 THEN
    RAISE EXCEPTION 'I-04B: every equivalent retry must fail closed on a World or birth fact that has vanished';
  END IF;

  -- THE CANONICAL LOCK ORDER, asserted on the stored source: the target
  -- credential-state row, then the exact invitation row, and only then any
  -- birth write.
  credential_pos := strpos(p.prosrc, 'FROM public.shared_world_invite_credential_state s');
  invitation_pos := strpos(p.prosrc, 'FROM public.shared_world_direct_invitations i');
  world_pos := strpos(p.prosrc, 'INSERT INTO public.shared_worlds');
  episode_pos := strpos(p.prosrc, 'INSERT INTO public.shared_world_membership_episodes');
  IF credential_pos = 0 OR invitation_pos = 0 OR world_pos = 0 OR episode_pos = 0
     OR credential_pos > invitation_pos OR invitation_pos > world_pos OR world_pos > episode_pos THEN
    RAISE EXCEPTION 'I-04B: acceptance must lock the target credential-state row, then the invitation row, before any birth write';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'FOR UPDATE', ''))) / length('FOR UPDATE') <> 2 THEN
    RAISE EXCEPTION 'I-04B: the birth core takes exactly two row locks: the credential state and the exact invitation';
  END IF;

  -- ONE database-owned birth instant, captured exactly once.
  IF (length(p.prosrc) - length(replace(p.prosrc, 'birth_at := ', ''))) / length('birth_at := ') <> 1 THEN
    RAISE EXCEPTION 'I-04B: the canonical birth instant must be captured exactly once';
  END IF;
  IF p.prosrc ~ 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp' THEN
    RAISE EXCEPTION 'I-04B: every persisted birth moment must be the one captured instant, never a second clock read';
  END IF;

  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.proname = 'commit_shared_world_direct_acceptance_birth_v1') <> 1 THEN
    RAISE EXCEPTION 'I-04B: exactly one birth core must exist, with one overload';
  END IF;

  -- Both new tables are unreachable by every application role, carry RLS with
  -- no policy, and carry no trigger.
  FOREACH target_table IN ARRAY own_tables LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN RAISE EXCEPTION 'I-04B: row level security must be enabled on %', target_table; END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04B: no RLS policy may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION 'I-04B: no trigger may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = target_table::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-04B: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04B: direct table access stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- Initiating creates no superior World authority, and the birth history is
  -- not a generic event or capability engine.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_world_direct_birth_events','shared_world_direct_acceptance_commands')
       AND (c.column_name ~* '(owner|admin|creator|initiator|privilege|role|capability|kind|event_type|payload|metadata|scope|permission|name|topic|avatar|setting)'
            OR c.data_type IN ('json','jsonb','ARRAY'))
  ) THEN
    RAISE EXCEPTION 'I-04B: birth creates no owner or admin, and the direct birth fact is not a generic event engine';
  END IF;

  -- The 0075 / 0081 substrate keeps its posture: still zero-policy, still with
  -- no application-role privilege and no direct mutation path.
  FOREACH target_table IN ARRAY ARRAY['public.shared_worlds','public.shared_world_membership_episodes',
                                      'public.shared_world_invite_credential_state','public.shared_world_direct_invitations'] LOOP
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04B: no RLS policy may be added to %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04B: the Shared substrate stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END$$;

COMMIT;
