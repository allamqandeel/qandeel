-- I-04A - Direct Shared Invitation Credential + Prospective Invitation Runtime v1.
--
-- I-04 turns the frozen Shared World architecture into a live runtime, and the
-- very first thing that runtime needs is the state that may exist BEFORE a World
-- does. CW2-01 section 5 / A4 and CW2-03 section 2 are unambiguous:
--
--   No Shared World exists before the corresponding valid creation event.
--   An invitation is not a dormant World.
--
-- So this forward-only migration creates the prospective direct path and stops
-- exactly where World birth begins. It creates NO Shared World, NO membership
-- episode, NO world id, NO WORLD_BIRTH event, NO conversation / material /
-- provenance / Matching / Introduction state, and it grants no mutation path
-- into the 0075 substrate. I-04B owns the atomic exact-target acceptance
-- transaction that creates ACTIVE / STANDARD. Keeping that transaction in its
-- own separately reviewed slice is what makes "no Shared World before
-- acceptance" provable here rather than merely commented.
--
-- What this migration creates, exactly:
--
--   * public.shared_world_invite_credential_state - the secret Shared invitation
--     credential as USER / ACCOUNT state (CW2-01 section 17, CW2-03 section 4):
--     one current row per human, private, non-searchable, rotatable, distinct
--     from Public Alias and never World identity. It carries no world id, no
--     alias, no profile projection, no owner / admin semantics and no searchable
--     column. `epoch` is the frozen credential-epoch counter (CW2-03 section 5),
--     monotonic from 1.
--   * public.shared_world_direct_invitations - the DIRECT_WORLD_INVITATION
--     prospective object (CW2-03 section 3), with exactly the frozen status
--     vocabulary PENDING | ACCEPTED | DECLINED | CANCELLED | EXPIRED |
--     INVALIDATED. It has NO world_id column: a row here is a prospective
--     object, never a dormant World, and the inviter's factual identity confers
--     no owner / admin / superior authority (CW2-01 section 5, CW2-03 section 16).
--   * public.shared_world_invitation_commands - the narrow durable command
--     history that makes both consequential operations idempotent (CW2-03
--     section 47). The row id IS the caller-supplied command id, so the primary
--     key is the idempotency record, and it is consulted before the lock, under
--     the lock, and - for a FIRST setup, where there is no row to lock and a
--     uniqueness conflict is the only serialization point - inside the conflict
--     handler, so an equivalent retry always returns the committed result. It
--     stores the opaque lookup reference the
--     command acted on or with - already the internal derived representation -
--     and deliberately NO target user id: knowing the target is the invitation
--     row's business, and the command history must never become a second way for
--     an inviter to learn who they invited.
--   * public.rotate_shared_world_invite_credential_v1 - first setup and rotation
--     of the caller's OWN credential, which atomically invalidates every PENDING
--     invitation bound to an older epoch.
--   * public.submit_shared_world_direct_invitation_v1 - authenticated,
--     non-enumerating submission of one PENDING direct invitation.
--
-- The credential REPRESENTATION boundary (task I-04A section 5): the
-- human-facing secret credential format is deliberately NOT frozen - no short
-- code length, alphabet, QR shape, URL form, username syntax or Public Alias
-- reuse is chosen anywhere here. Persistence stores only an opaque derived
-- `credential_lookup_ref`: non-empty, exact-match only, no semantic meaning, not
-- the user id (a CHECK refuses that specific naive collapse), not an alias, not
-- World identity, and never returned to another human as target identity. A
-- later reviewed adapter may change how a human secret becomes this reference
-- without touching these tables.
--
-- Human self-authority (CW2-01 section 7 / A3, CW2-02 B2): a credential belongs
-- to the exact human and an invitation is a human act, so BOTH commands derive
-- the actor from auth.uid() and accept NO actor, inviter, target, status,
-- epoch-of-another-human or timestamp parameter. EXECUTE is granted to
-- `authenticated` only; PUBLIC, anon AND service_role cannot execute either one.
-- Possession of the service-role credential must never manufacture a human
-- invitation, and QANDEEL is not an invitation principal.
--
-- Non-enumeration (CW2-03 section 4, CW2-02 section 47 / B33): entering a
-- credential must not reveal the target identity. The submission result carries
-- only SUBMITTED, the command id and the requested invitation id - no target id,
-- name, alias, profile, epoch or existence boolean. A lookup reference that is
-- not currently usable collapses into ONE bounded internal class,
-- SHARED_INVITE_TARGET_NOT_USABLE, whether it never existed, was rotated away,
-- resolves to the caller themselves, or belongs to an unavailable account. The
-- caller cannot tell those apart, so the command is not an existence oracle. The
-- rotation command's own ref-collision answer is bounded the same way: it says
-- the reference is unavailable, never that another human holds it.
--
-- Credential epoch law (CW2-03 section 5): an invitation binds the target's
-- EXACT current epoch as read under the credential-state row lock at commit -
-- never an epoch supplied by the client. A rotation must actually CHANGE the
-- lookup reference: re-presenting the reference that is already current is
-- refused before any mutation, because advancing the epoch and invalidating
-- every PENDING invitation while the supposedly retired secret stays usable is
-- not a rotation. Rotation increments the epoch and, in
-- the same transaction, moves every PENDING invitation of that target bound to
-- an older epoch to INVALIDATED with a database-clock terminal_at. Rows are
-- never deleted, ACCEPTED / DECLINED / CANCELLED / EXPIRED rows are never
-- touched, and an already-born World is entirely unaffected (this migration
-- cannot reach public.shared_worlds at all).
--
-- CANONICAL LOCK ORDER - a transaction invariant I-04B must continue:
--
--   1. the target credential-state row   (SELECT ... FOR UPDATE)
--   2. the invitation row(s)
--
-- Both commands here take the credential-state row first and touch invitation
-- rows only afterwards, so a rotation and a submission racing on the same target
-- serialize on one row and can never deadlock. The race therefore has exactly
-- two canonical outcomes: the submission committed first against the pre-rotation
-- epoch and the rotation then invalidated it, or the rotation committed first and
-- the now-retired lookup reference resolved to nothing. No advisory lock and no
-- process-local mutex is used. I-04B's acceptance transaction must lock the
-- target credential-state row before the invitation row it consumes.
--
-- What is deliberately NOT here: no accept / decline / cancel / expire command
-- (I-04B owns acceptance and birth; INVALIDATED is the only terminal transition
-- this slice performs, and only through rotation); no expiry duration, TTL, cron,
-- expires_at column or background scheduler (CW2-03 section 50 defers invitation
-- expiry); no Matching proposal, Mutual Match or IntroductionRecord (I-07); no
-- Personal context read of any kind - no conversation, memory, HIM, hypothesis or
-- EffectiveContext table is referenced; no Standing Context grant is created; no
-- RLS policy and no direct client or service-role table access; no trigger; no
-- generic invitation / consent / permission engine spanning add-member
-- governance, Matching, Public or Replay. Migrations 0001-0080 are untouched.

BEGIN;

-- 1. The secret Shared invitation credential, as user / account state.
--    updated_at is database-owned; the caller supplies no timestamp.
CREATE TABLE public.shared_world_invite_credential_state (
    user_id uuid NOT NULL,
    credential_lookup_ref text NOT NULL,
    epoch bigint NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT shared_world_invite_credential_pk PRIMARY KEY (user_id),
    CONSTRAINT shared_world_invite_credential_ref_key UNIQUE (credential_lookup_ref),
    CONSTRAINT shared_world_invite_credential_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    -- Monotonic from the first setup; nothing may persist below 1.
    CONSTRAINT shared_world_invite_credential_epoch_check
        CHECK (epoch >= 1),
    CONSTRAINT shared_world_invite_credential_ref_check
        CHECK (length(btrim(credential_lookup_ref)) > 0),
    -- The lookup reference is opaque and derived. It is specifically NOT the
    -- user's own identity: collapsing the two would make every credential
    -- guessable from a user id and would turn the invitation command into an
    -- enumeration oracle.
    CONSTRAINT shared_world_invite_credential_ref_opaque_check
        CHECK (credential_lookup_ref <> user_id::text)
);

-- 2. The prospective DIRECT_WORLD_INVITATION. No world_id: this row is not a
--    World and never becomes one by being updated. created_at / terminal_at are
--    database-owned.
CREATE TABLE public.shared_world_direct_invitations (
    id uuid NOT NULL,
    inviter_user_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    target_credential_epoch bigint NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    terminal_at timestamptz,
    CONSTRAINT shared_world_direct_invitations_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_direct_invitations_inviter_fk
        FOREIGN KEY (inviter_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_direct_invitations_target_fk
        FOREIGN KEY (target_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_direct_invitations_status_check
        CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'INVALIDATED')),
    -- An invitation is always between two distinct humans.
    CONSTRAINT shared_world_direct_invitations_distinct_humans_check
        CHECK (inviter_user_id <> target_user_id),
    CONSTRAINT shared_world_direct_invitations_epoch_check
        CHECK (target_credential_epoch >= 1),
    -- PENDING <=> terminal_at IS NULL; every terminal status carries its moment.
    CONSTRAINT shared_world_direct_invitations_terminal_check
        CHECK ((status = 'PENDING' AND terminal_at IS NULL)
            OR (status <> 'PENDING' AND terminal_at IS NOT NULL)),
    CONSTRAINT shared_world_direct_invitations_terminal_order_check
        CHECK (terminal_at IS NULL OR terminal_at >= created_at)
);

-- The two known access patterns, and nothing speculative. The partial index
-- serves both frozen target-side reads: the exact rotation-invalidation sweep
-- (target + epoch below the new one) and "this target's pending invitations",
-- which I-04B will need. No ranking, search or discovery index exists: a
-- credential is non-searchable and an invitation is not a discoverable object.
CREATE INDEX shared_world_direct_invitations_target_pending_idx
    ON public.shared_world_direct_invitations (target_user_id, target_credential_epoch)
    WHERE status = 'PENDING';

CREATE INDEX shared_world_direct_invitations_inviter_idx
    ON public.shared_world_direct_invitations (inviter_user_id, created_at);

-- 3. Durable command history. id is the caller-supplied command id, so the
--    primary key IS the idempotency record; there is no second idempotency
--    table and no process-local retry cache. There is deliberately no
--    target_user_id column: the command history must not become a second way
--    for an inviter to learn who they invited.
CREATE TABLE public.shared_world_invitation_commands (
    id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    command_type text NOT NULL,
    -- Rotation: the new reference the actor set. Submission: the reference the
    -- inviter submitted. Never a human-facing secret - only the derived ref.
    credential_lookup_ref text NOT NULL,
    resulting_credential_epoch bigint,
    invitation_id uuid,
    committed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT shared_world_invitation_commands_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_invitation_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_invitation_commands_invitation_fk
        FOREIGN KEY (invitation_id) REFERENCES public.shared_world_direct_invitations (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_invitation_commands_type_check
        CHECK (command_type IN ('CREDENTIAL_ROTATION', 'DIRECT_INVITATION_SUBMISSION')),
    -- Each command kind carries exactly its own result and nothing else.
    CONSTRAINT shared_world_invitation_commands_shape_check
        CHECK ((command_type = 'CREDENTIAL_ROTATION'
                  AND resulting_credential_epoch IS NOT NULL AND resulting_credential_epoch >= 1
                  AND invitation_id IS NULL)
            OR (command_type = 'DIRECT_INVITATION_SUBMISSION'
                  AND resulting_credential_epoch IS NULL
                  AND invitation_id IS NOT NULL)),
    CONSTRAINT shared_world_invitation_commands_ref_check
        CHECK (length(btrim(credential_lookup_ref)) > 0)
);

-- One invitation identity is created by exactly one command, so an invitation
-- can never be re-bound to a second command or a second target.
CREATE UNIQUE INDEX shared_world_invitation_commands_invitation_idx
    ON public.shared_world_invitation_commands (invitation_id)
    WHERE invitation_id IS NOT NULL;

-- 4. Deny-by-default posture for all three tables: RLS on, zero policies, every
--    application role revoked from every privilege. The only write path is the
--    two commands below, and there is no direct client read path in I-04A.
ALTER TABLE public.shared_world_invite_credential_state OWNER TO postgres;
ALTER TABLE public.shared_world_direct_invitations OWNER TO postgres;
ALTER TABLE public.shared_world_invitation_commands OWNER TO postgres;
ALTER TABLE public.shared_world_invite_credential_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_direct_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_invitation_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_world_invite_credential_state,
                    public.shared_world_direct_invitations,
                    public.shared_world_invitation_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.shared_world_invite_credential_state, public.shared_world_direct_invitations, public.shared_world_invitation_commands FROM service_role';
END IF;END$$;

-- 5. Credential first setup / rotation. The caller supplies only the command id,
--    the new opaque lookup reference and the exact epoch they believe is current
--    (NULL = "I have no credential yet"). Identity is auth.uid(); the epoch and
--    every timestamp are database-derived.
CREATE FUNCTION public.rotate_shared_world_invite_credential_v1(
  p_command_id uuid, p_new_credential_lookup_ref text, p_expected_epoch bigint DEFAULT NULL
) RETURNS TABLE(command_id uuid, credential_epoch bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  current_epoch bigint;
  current_ref text;
  has_state boolean;
  new_epoch bigint;
  committed public.shared_world_invitation_commands;
  conflict_constraint text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'SHARED_INVITE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_new_credential_lookup_ref IS NULL
     OR length(btrim(p_new_credential_lookup_ref)) = 0 THEN
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- An expected epoch is either "none yet" or a real past epoch. 0 and negative
  -- values are not expressible states, so they are refused rather than coerced.
  IF p_expected_epoch IS NOT NULL AND p_expected_epoch < 1 THEN
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- The reference is opaque and is never the caller's own identity.
  IF p_new_credential_lookup_ref = u::text THEN
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  new_epoch := COALESCE(p_expected_epoch, 0) + 1;

  -- Durable idempotency, first pass: BEFORE any lock, so a retry of a command
  -- that already committed stays answerable even though the caller's own
  -- credential state has since moved on.
  SELECT * INTO committed FROM public.shared_world_invitation_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.command_type = 'CREDENTIAL_ROTATION' AND committed.actor_user_id = u
       AND committed.credential_lookup_ref = p_new_credential_lookup_ref
       AND committed.resulting_credential_epoch = new_epoch THEN
      RETURN QUERY SELECT committed.id, committed.resulting_credential_epoch;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the caller's own credential-state row. Every
  -- rotation and every submission that resolves to this human queues here
  -- before any invitation row is read or written.
  SELECT s.epoch, s.credential_lookup_ref INTO current_epoch, current_ref
    FROM public.shared_world_invite_credential_state s
   WHERE s.user_id = u
   FOR UPDATE;
  has_state := FOUND;

  -- Durable idempotency, second pass: now under the lock, so two concurrent
  -- identical retries serialize and the loser returns the committed result
  -- instead of creating a second current state.
  SELECT * INTO committed FROM public.shared_world_invitation_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.command_type = 'CREDENTIAL_ROTATION' AND committed.actor_user_id = u
       AND committed.credential_lookup_ref = p_new_credential_lookup_ref
       AND committed.resulting_credential_epoch = new_epoch THEN
      RETURN QUERY SELECT committed.id, committed.resulting_credential_epoch;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- Compare-and-swap against the exact current state. A stale client never
  -- rotates "whatever happens to be current".
  IF p_expected_epoch IS NULL THEN
    IF has_state THEN RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_STALE_STATE' USING ERRCODE='40001'; END IF;
  ELSE
    IF NOT has_state OR current_epoch <> p_expected_epoch THEN
      RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_STALE_STATE' USING ERRCODE='40001';
    END IF;
  END IF;

  -- A ROTATION MUST ACTUALLY ROTATE (CW2-03 section 5: lock the current state,
  -- CHANGE the lookup reference, increment the epoch, invalidate the old-epoch
  -- PENDING invitations). Re-presenting the reference that is already current
  -- is not a rotation: PostgreSQL would accept the UPDATE, the epoch would
  -- advance and every PENDING invitation would be invalidated while the secret
  -- the human believes they retired stayed immediately usable. It is refused
  -- BEFORE any mutation, so a no-op value writes nothing at all - no epoch, no
  -- updated_at, no invalidation and no command-history row. The comparison is
  -- against the caller's OWN locked row only, so it discloses no other human's
  -- state and adds no channel that the bounded collision answer below does not
  -- already have.
  IF has_state AND current_ref = p_new_credential_lookup_ref THEN
    RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_UNCHANGED' USING ERRCODE='22023';
  END IF;

  -- The new reference must be free. The answer is bounded: it never says that
  -- another human holds it, so rotation is not an enumeration oracle either.
  BEGIN
    IF has_state THEN
      UPDATE public.shared_world_invite_credential_state s
         SET credential_lookup_ref = p_new_credential_lookup_ref,
             epoch = new_epoch,
             updated_at = CURRENT_TIMESTAMP
       WHERE s.user_id = u AND s.epoch = p_expected_epoch;
      IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_STALE_STATE' USING ERRCODE='40001'; END IF;
    ELSE
      INSERT INTO public.shared_world_invite_credential_state (user_id, credential_lookup_ref, epoch)
      VALUES (u, p_new_credential_lookup_ref, new_epoch);
    END IF;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS conflict_constraint = CONSTRAINT_NAME;
    -- Durable idempotency, THIRD pass. FIRST setup is the one case the two
    -- passes above structurally cannot cover: there is no credential row yet,
    -- so `FOR UPDATE` locks nothing, and two concurrent executions of the SAME
    -- semantic command both legitimately observe absence and both proceed. The
    -- uniqueness conflict IS their serialization point: it resolves only when
    -- the winner commits, and the winner commits its credential state and its
    -- command-history row in one transaction. So the equivalent retry is
    -- answered from durable history here exactly as it would have been under
    -- the lock - an equivalent retry of a committed command returns that
    -- command's committed result, never a stale-state error.
    SELECT * INTO committed FROM public.shared_world_invitation_commands c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.command_type = 'CREDENTIAL_ROTATION' AND committed.actor_user_id = u
         AND committed.credential_lookup_ref = p_new_credential_lookup_ref
         AND committed.resulting_credential_epoch = new_epoch THEN
        RETURN QUERY SELECT committed.id, committed.resulting_credential_epoch;
        RETURN;
      END IF;
      -- The same command id carrying different semantics is still a conflict.
      RAISE EXCEPTION 'SHARED_INVITE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    IF conflict_constraint = 'shared_world_invite_credential_ref_key' THEN
      RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_REF_UNAVAILABLE' USING ERRCODE='23505';
    END IF;
    -- The primary key, reached by a DIFFERENT command: another connection
    -- established this human's first credential state while this one believed
    -- there was none, so this command's view of the state is simply stale.
    RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_STALE_STATE' USING ERRCODE='40001';
  END;

  -- CANONICAL LOCK ORDER, STEP 2: the invitation rows. CW2-03 section 5 - every
  -- PENDING invitation bound to an older epoch is invalidated in this same
  -- transaction. Nothing is deleted, and a row that already reached a terminal
  -- status is not touched.
  UPDATE public.shared_world_direct_invitations i
     SET status = 'INVALIDATED', terminal_at = CURRENT_TIMESTAMP
   WHERE i.target_user_id = u AND i.status = 'PENDING' AND i.target_credential_epoch < new_epoch;

  INSERT INTO public.shared_world_invitation_commands
    (id, actor_user_id, command_type, credential_lookup_ref, resulting_credential_epoch)
  VALUES (p_command_id, u, 'CREDENTIAL_ROTATION', p_new_credential_lookup_ref, new_epoch);
  RETURN QUERY SELECT p_command_id, new_epoch;
END$$;

-- 6. Direct invitation submission. The caller supplies only the command id, the
--    invitation identity they want to create and the opaque lookup reference
--    they were given. There is deliberately NO inviter parameter and NO target
--    parameter: the inviter is auth.uid() and the target is resolved ONLY from
--    the exact current lookup reference, inside this transaction, under the
--    credential-state row lock.
CREATE FUNCTION public.submit_shared_world_direct_invitation_v1(
  p_command_id uuid, p_invitation_id uuid, p_credential_lookup_ref text
) RETURNS TABLE(outcome text, command_id uuid, requested_invitation_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  resolved_user_id uuid;
  resolved_epoch bigint;
  committed public.shared_world_invitation_commands;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'SHARED_INVITE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_invitation_id IS NULL OR p_credential_lookup_ref IS NULL
     OR length(btrim(p_credential_lookup_ref)) = 0 THEN
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- Durable idempotency, first pass: BEFORE any lock, so a retry of a command
  -- that already committed still returns its committed result after the target
  -- rotated the credential it was submitted against.
  SELECT * INTO committed FROM public.shared_world_invitation_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.command_type = 'DIRECT_INVITATION_SUBMISSION' AND committed.actor_user_id = u
       AND committed.invitation_id = p_invitation_id
       AND committed.credential_lookup_ref = p_credential_lookup_ref THEN
      RETURN QUERY SELECT 'SUBMITTED'::text, committed.id, committed.invitation_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the target credential-state row, found by
  -- exact reference match only. A reference that matches nothing is already the
  -- bounded non-enumerating answer.
  SELECT s.user_id, s.epoch INTO resolved_user_id, resolved_epoch
    FROM public.shared_world_invite_credential_state s
   WHERE s.credential_lookup_ref = p_credential_lookup_ref
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_INVITE_TARGET_NOT_USABLE' USING ERRCODE='P0002'; END IF;

  -- Revalidate under the lock (CW2-03 section 5): the row this transaction now
  -- holds must STILL carry the submitted reference. A rotation that committed
  -- while this statement waited retires that reference, and a retired reference
  -- resolves to nothing.
  SELECT s.epoch INTO resolved_epoch
    FROM public.shared_world_invite_credential_state s
   WHERE s.user_id = resolved_user_id AND s.credential_lookup_ref = p_credential_lookup_ref;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_INVITE_TARGET_NOT_USABLE' USING ERRCODE='P0002'; END IF;

  -- A credential that resolves to the caller is the SAME bounded answer as one
  -- that resolves to nobody: the inviter cannot learn which case occurred.
  IF resolved_user_id = u THEN RAISE EXCEPTION 'SHARED_INVITE_TARGET_NOT_USABLE' USING ERRCODE='P0002'; END IF;

  -- Durable idempotency, second pass: under the lock, so two concurrent
  -- identical submissions serialize and the loser returns the committed result
  -- instead of creating a second invitation.
  SELECT * INTO committed FROM public.shared_world_invitation_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.command_type = 'DIRECT_INVITATION_SUBMISSION' AND committed.actor_user_id = u
       AND committed.invitation_id = p_invitation_id
       AND committed.credential_lookup_ref = p_credential_lookup_ref THEN
      RETURN QUERY SELECT 'SUBMITTED'::text, committed.id, committed.invitation_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- One invitation identity is owned by one command forever. An id already in
  -- use by a different command fails closed; nothing is ever re-bound to a new
  -- target, and no existing invitation row is updated by this command.
  IF EXISTS (SELECT 1 FROM public.shared_world_direct_invitations i WHERE i.id = p_invitation_id) THEN
    RAISE EXCEPTION 'SHARED_DIRECT_INVITATION_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the invitation row. The epoch bound here is
  -- the EXACT current epoch read under the lock - never one supplied by the
  -- client.
  INSERT INTO public.shared_world_direct_invitations
    (id, inviter_user_id, target_user_id, target_credential_epoch, status)
  VALUES (p_invitation_id, u, resolved_user_id, resolved_epoch, 'PENDING');
  INSERT INTO public.shared_world_invitation_commands
    (id, actor_user_id, command_type, credential_lookup_ref, invitation_id)
  VALUES (p_command_id, u, 'DIRECT_INVITATION_SUBMISSION', p_credential_lookup_ref, p_invitation_id);

  -- The result identifies the operation, never the target.
  RETURN QUERY SELECT 'SUBMITTED'::text, p_command_id, p_invitation_id;
END$$;

-- 7. Ownership and least-privilege execute ACL: authenticated humans only.
--    service_role is revoked explicitly because a Supabase project grants
--    EXECUTE on new public functions to it by default privilege.
ALTER FUNCTION public.rotate_shared_world_invite_credential_v1(uuid, text, bigint) OWNER TO postgres;
ALTER FUNCTION public.submit_shared_world_direct_invitation_v1(uuid, uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rotate_shared_world_invite_credential_v1(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_shared_world_direct_invitation_v1(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.rotate_shared_world_invite_credential_v1(uuid, text, bigint) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.submit_shared_world_direct_invitation_v1(uuid, uuid, text) FROM service_role';
END IF;END$$;
GRANT EXECUTE ON FUNCTION public.rotate_shared_world_invite_credential_v1(uuid, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_shared_world_direct_invitation_v1(uuid, uuid, text) TO authenticated;

-- 8. Terminal self-assertions. The migration refuses to deploy a prospective
--    substrate that is World-creating, service-role-executable, anonymous,
--    unpinned, caller-identified, table-reachable, policy- or trigger-bearing,
--    generically shaped, or that reversed the canonical lock order.
DO $$
DECLARE
  commands text[] := ARRAY['public.rotate_shared_world_invite_credential_v1(uuid,text,bigint)',
                           'public.submit_shared_world_direct_invitation_v1(uuid,uuid,text)'];
  own_tables text[] := ARRAY['public.shared_world_invite_credential_state',
                             'public.shared_world_direct_invitations',
                             'public.shared_world_invitation_commands'];
  fn text;
  p record;
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
  lock_pos integer;
  invitation_pos integer;
  handler_pos integer;
BEGIN
  FOREACH fn IN ARRAY commands LOOP
    -- pg_get_function_ARGUMENTS, not _identity_arguments: the identity form
    -- returns types only, which would make every parameter-NAME check below
    -- vacuously true.
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_function_arguments(pr.oid) AS args
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-04A: % must be SECURITY DEFINER', fn; END IF;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-04A: % is a mutation and must be VOLATILE', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-04A: % must pin an empty search_path', fn;
    END IF;
    IF p.prosrc !~ 'auth\.uid\(\)' THEN RAISE EXCEPTION 'I-04A: % must derive the actor from auth.uid()', fn; END IF;
    -- No caller-supplied identity, status or clock of any kind. The guard is
    -- non-vacuous by construction: the parameter names it scans really are
    -- present, which the positive check immediately below requires.
    IF p.args !~ 'p_command_id uuid' THEN
      RAISE EXCEPTION 'I-04A: % must accept the caller-supplied command id by name', fn;
    END IF;
    IF p.args ~* 'inviter' OR p.args ~* 'target' OR p.args ~* 'user_id' OR p.args ~* 'actor'
       OR p.args ~* 'status' OR p.args ~* 'timestamp' OR p.args ~* '_at\M' OR p.args ~* 'world' THEN
      RAISE EXCEPTION 'I-04A: % must not accept an inviter, target, actor, status, World or timestamp parameter', fn;
    END IF;
    -- THE load-bearing invariant: no I-04A command can create a Shared World or
    -- a membership episode. I-04B owns the birth transaction.
    IF p.prosrc ~* 'public\.shared_worlds\M' OR p.prosrc ~* 'public\.shared_world_membership_episodes'
       OR p.prosrc ~* 'world_birth' OR p.prosrc ~* 'attemptsharedworldbirth' THEN
      RAISE EXCEPTION 'I-04A: % must not create or touch a Shared World or a membership episode', fn;
    END IF;
    -- No Personal context, no Standing Context authority, no Matching state.
    IF p.prosrc ~* 'conversation_|\Wmemor|human_intelligence|hypothes|standing_context|matching|introduction' THEN
      RAISE EXCEPTION 'I-04A: % must not read Personal context or create Standing Context / Matching state', fn;
    END IF;
    -- Nothing is deleted and no invitation is ever re-bound to another human.
    IF p.prosrc ~* 'DELETE FROM' OR p.prosrc ~* 'TRUNCATE'
       OR p.prosrc ~* 'SET target_user_id' OR p.prosrc ~* 'SET inviter_user_id' THEN
      RAISE EXCEPTION 'I-04A: % may never delete a row or re-bind an invitation', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN RAISE EXCEPTION 'I-04A: PUBLIC must not execute %', fn; END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-04A: % must not execute % (a human invitation is never manufactured by a system credential)', target_role, fn;
      END IF;
    END LOOP;
    IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04A: authenticated must be the only executor of %', fn;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.proname IN ('rotate_shared_world_invite_credential_v1','submit_shared_world_direct_invitation_v1')) <> 2 THEN
    RAISE EXCEPTION 'I-04A: exactly the two invitation commands must exist, one overload each';
  END IF;

  -- The canonical lock order, asserted on the source of both commands: the
  -- credential-state row is locked BEFORE any invitation row is touched.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = commands[1]::regprocedure;
  lock_pos := strpos(p.prosrc, 'FROM public.shared_world_invite_credential_state s');
  invitation_pos := strpos(p.prosrc, 'UPDATE public.shared_world_direct_invitations');
  IF lock_pos = 0 OR invitation_pos = 0 OR lock_pos > invitation_pos THEN
    RAISE EXCEPTION 'I-04A: rotation must lock the credential-state row before invalidating invitation rows';
  END IF;
  IF p.prosrc !~ 'WHERE s\.user_id = u\s+FOR UPDATE' THEN
    RAISE EXCEPTION 'I-04A: rotation must take a row lock on the actor''s own credential state';
  END IF;

  -- A rotation must actually change the credential, and the refusal must come
  -- before every mutation, so a no-op value can never advance an epoch or
  -- invalidate a PENDING invitation.
  IF p.prosrc !~ 'SHARED_INVITE_CREDENTIAL_UNCHANGED' THEN
    RAISE EXCEPTION 'I-04A: rotation must refuse a no-op credential value: re-presenting the current reference is not a rotation';
  END IF;
  lock_pos := strpos(p.prosrc, 'SHARED_INVITE_CREDENTIAL_UNCHANGED');
  invitation_pos := strpos(p.prosrc, 'UPDATE public.shared_world_invite_credential_state s');
  IF invitation_pos = 0 OR lock_pos > invitation_pos THEN
    RAISE EXCEPTION 'I-04A: the no-op credential refusal must precede every mutation';
  END IF;

  -- A concurrent IDENTICAL first setup has no row to lock, so the uniqueness
  -- conflict is its serialization point: the conflict handler must consult
  -- durable command history rather than report stale state.
  handler_pos := strpos(p.prosrc, 'EXCEPTION WHEN unique_violation');
  IF handler_pos = 0 OR strpos(substr(p.prosrc, handler_pos),
       'SELECT * INTO committed FROM public.shared_world_invitation_commands c WHERE c.id = p_command_id') = 0 THEN
    RAISE EXCEPTION 'I-04A: a concurrent identical first setup must be answered from durable command history, never as stale state';
  END IF;

  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = commands[2]::regprocedure;
  lock_pos := strpos(p.prosrc, 'FROM public.shared_world_invite_credential_state s');
  invitation_pos := strpos(p.prosrc, 'INSERT INTO public.shared_world_direct_invitations');
  IF lock_pos = 0 OR invitation_pos = 0 OR lock_pos > invitation_pos THEN
    RAISE EXCEPTION 'I-04A: submission must lock the credential-state row before inserting an invitation row';
  END IF;
  IF p.prosrc !~ 'WHERE s\.credential_lookup_ref = p_credential_lookup_ref\s+FOR UPDATE' THEN
    RAISE EXCEPTION 'I-04A: submission must take a row lock on the resolved credential state';
  END IF;

  -- All three tables are unreachable by every application role, carry RLS with
  -- no policy, and carry no trigger.
  FOREACH target_table IN ARRAY own_tables LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN RAISE EXCEPTION 'I-04A: row level security must be enabled on %', target_table; END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04A: no RLS policy may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION 'I-04A: no trigger may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = target_table::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-04A: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04A: direct table access stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- A prospective invitation is not a World, and a credential is not a World.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_world_invite_credential_state','shared_world_direct_invitations','shared_world_invitation_commands')
       AND c.column_name ~* '(world_id|lifecycle|phase|birth|episode|alias|owner|admin|creator|privilege|expires|ttl|matching|introduction|scope|permission)'
  ) THEN
    RAISE EXCEPTION 'I-04A: a prospective invitation is not a World; no World, alias, owner, expiry or capability column may exist';
  END IF;
  -- Semantics are fixed by table identity: no generic invitation / permission
  -- engine spanning add-member governance, Matching, Public or Replay.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_world_invite_credential_state','shared_world_direct_invitations','shared_world_invitation_commands')
       AND (c.column_name ~* '(kind|capability|channel|surface|payload|metadata|message|note)'
            OR c.data_type IN ('json','jsonb','ARRAY'))
  ) THEN
    RAISE EXCEPTION 'I-04A: this is the DIRECT Shared invitation lifecycle only; no generic invitation engine column may exist';
  END IF;

  -- The 0075 substrate is untouched by this migration: still RLS-on, still
  -- zero-policy, still with no application-role privilege and no mutation path.
  FOREACH target_table IN ARRAY ARRAY['public.shared_worlds','public.shared_world_membership_episodes'] LOOP
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04A: no RLS policy may be added to %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04A: the Shared World substrate stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END$$;

COMMIT;
