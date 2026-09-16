-- I-05C - Public Experience Disappearance Runtime v1 (PART B).
--
-- Migration 0098 made an already-published package stop being public the moment
-- it stops being legitimately public, through the ONE canonical visibility
-- truth, with no row written anywhere. This migration is the DURABLE
-- CONVERGENCE that follows: the authorized controller removal, the deterministic
-- reconciliation of an Experience whose eligibility ended, the ONE controlled
-- path to `ABSENT_FROM_PUBLIC_WORLD`, and the sealed internal evidence of both.
--
-- ===========================================================================
-- Convergence is defense in depth. It is never what enforces privacy
-- ===========================================================================
--
-- Everything here runs AFTER canonical truth has already gone dark. A withdrawn
-- required approval, a source that became canonically unavailable, a published
-- package whose authority no longer derives - each of those made
-- `resolve_public_visibility_state_v1` answer `NOT_PUBLICLY_VISIBLE` at the
-- instant it committed, in migration 0098, without this migration existing. What
-- these primitives add is that the lifecycle stops CLAIMING `PUBLISHED`, that
-- the disappearance is auditable, and that the derived search projection stops
-- retaining a copy of the public text.
--
-- No scheduler, daemon, queue, webhook or cross-service event system is
-- introduced. The reconciliation is a DB-owned deterministic primitive in the
-- exact shape the frozen 0097 derived-state writers already use - machine
-- driven, no `auth.uid()`, executable by no application role - because that is
-- where this repository already puts recomputation.
--
-- ===========================================================================
-- The ONE controlled path to ABSENT_FROM_PUBLIC_WORLD
-- ===========================================================================
--
-- `apply_public_experience_disappearance_v1` is the only thing in this
-- repository that writes that lifecycle value. Both consequential primitives
-- delegate to it; neither contains a lifecycle assignment of its own. It reads
-- the exact version and manifest that disappear FROM the immutable publication
-- record rather than from a parameter, it refuses any predecessor state but
-- `PUBLISHED` bound to its own current version, it is atomic with the
-- disappearance decision, and it appends the transition to the frozen 0091
-- append-only lifecycle truth.
--
-- It can never reactivate anything: no I-05C function contains an assignment of
-- `PUBLISHED`, and the frozen 0093 preparation admits `DRAFT` alone, so an
-- absent Experience reaches no successor package either. Whether a reviewed
-- republication path should exist is a question migrations 0091-0097 do not
-- answer, and I-05C does not answer it by accident: absence is terminal here.
--
-- The application roles cannot take this path around. They hold no privilege on
-- `public_experiences` at all - RLS on, zero policies, every privilege revoked
-- since migration 0091 - and every primitive created here is executable by
-- none of them, behind the same unimplemented CW2-08 Launch Gate every I-05A
-- and I-05B primitive waits for. There is deliberately no trigger refusing the
-- value schema-wide: a guard that a later authorized slice would have to remove
-- is a ceiling on the roadmap rather than an invariant of this one, and the
-- frozen 0091 lifecycle vocabulary exists precisely so this transition is
-- additive.
--
-- ===========================================================================
-- One bounded internal vocabulary, and no translation layer
-- ===========================================================================
--
-- `disappearance_basis` is exactly the authorized-removal act plus the three
-- convergeable ineligibility classes migration 0098 already decides, spelled
-- identically, so the reconciliation passes the class straight through and
-- there is no second taxonomy to drift from the first:
--
--   AUTHORIZED_CONTROLLER_REMOVAL     the exact Experience controller asked
--   REQUIRED_APPROVAL_NOT_EFFECTIVE   a required approval is missing, withdrawn,
--                                     superseded or bound elsewhere
--   PUBLISHED_SOURCE_NOT_AVAILABLE    an exact required source is no longer
--                                     canonically available or visible
--   PUBLICATION_AUTHORITY_INVALIDATED the published package no longer derives
--
-- `PUBLICATION_BINDING_INVALID` is deliberately NOT a basis. A `PUBLISHED`
-- Experience whose publication binding does not hold is contradictory state
-- rather than a disappearance cause - no canonical primitive can produce it,
-- because the frozen preparation refuses a non-DRAFT Experience - and serving
-- is already dark for it. The reconciliation reports `NOT_APPLICABLE` and
-- writes nothing rather than inventing a reason.
--
-- No basis names a source, a World, a Session, a human, a revision or a digest,
-- and no relation here carries one. The bounded class is the whole reason.
--
-- ===========================================================================
-- The I-05C extension of the canonical Public lock order
-- ===========================================================================
--
--   1  public_world_state         FOR UPDATE   removal, reconciliation
--   2  public_experiences         FOR UPDATE   removal, reconciliation
--   3  the exact manifest         FOR SHARE    reconciliation
--   4  shared_worlds              FOR SHARE    reconciliation   (I-04 order)
--   5  shared_world_materials     FOR SHARE    reconciliation
--   6  shared_world_history_items FOR SHARE    reconciliation
--   7  conversation_units         FOR SHARE    reconciliation
--   8  the rows the primitive writes
--
-- Both take a PREFIX of the frozen order migrations 0093 and 0095 established
-- and neither takes anything in a different relative order, so a removal, a
-- reconciliation, a publication and a withdrawal queue behind one another and
-- can never cycle. The removal consults no source, so it takes no source lock;
-- the reconciliation consults every source through continuing eligibility, so
-- it holds them SHARE while it decides and while it writes - otherwise the
-- eligibility answer could go stale between the decision and the transition.
-- No advisory lock, table lock, TRUNCATE or process mutex exists anywhere here.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- It erases no immutable evidence: the version, the manifest, the items, the
-- public bodies, the sealed provenance, the per-item authority, the required
-- approver set, the approvals, the withdrawals, the publication record, the
-- lifecycle transitions and the internal discussion, placement and Public
-- QANDEEL history all survive exactly as they were. The public contract is zero
-- public exposure, not a pretence that the event never happened internally.
-- It is not an account-deletion or erasure engine. It writes no successor
-- package, no republication and no restoration; it grants nothing to any
-- application role; it invents no Launch, Safety or commercial-entitlement
-- policy; it adds no route, controller, RPC or mobile surface. The ONE change
-- to a frozen relation is the additive exact-identity candidate key in section
-- 0 - a constraint that touches no row. Migrations 0091-0098 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. THE EXACT PUBLICATION IDENTITY, AS A CANDIDATE KEY ON THE FROZEN RECORD.
--
--    A disappearance must name the exact publication that disappeared. The
--    frozen 0095 record already keys `experience_id` and uniquely keys
--    `published_experience_version_id`, but two INDEPENDENT foreign keys into
--    those keys do not prove that a duplicated (Experience, version, manifest)
--    triple names the SAME publication row. The triple below is trivially
--    unique - it contains the primary key - and exists only so ONE composite
--    foreign key per relation can bind Experience, published version and
--    published manifest read from one row.
--
--    Binding the PUBLICATION rather than the version is deliberate: it makes a
--    disappearance record for an Experience that never published, and one
--    naming a version that is not the published one, both unrepresentable.
--    Additive: no row is touched and migration 0095 is not edited.
-- ---------------------------------------------------------------------------
ALTER TABLE public.public_experience_publication_state
    ADD CONSTRAINT public_experience_publication_state_exact_identity_key
        UNIQUE (experience_id, published_experience_version_id, published_manifest_version_id);

-- ---------------------------------------------------------------------------
-- 1. THE DURABLE DISAPPEARANCE COMMAND HISTORY.
--
--    One narrow relation for both command families, in the frozen 0093 shape:
--    the row is the idempotency key AND the exact committed answer, and
--    `request_ref` binds the whole immutable request so an equivalent retry and
--    a different request under the same command identity are distinguishable.
--
--    The two families are kept apart by shape rather than by discipline. A
--    CONTROLLER_REMOVAL is a human act and carries the exact actor; a
--    DISAPPEARANCE_RECONCILIATION is machine convergence and carries none -
--    there is no human to record, and recording one would suggest a human
--    authorized what the database derived.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_experience_disappearance_commands (
    id uuid NOT NULL,
    command_kind text NOT NULL,
    experience_id uuid NOT NULL,
    target_experience_version_id uuid,
    target_manifest_version_id uuid,
    actor_user_id uuid,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT public_experience_disappearance_commands_pk PRIMARY KEY (id),
    CONSTRAINT public_experience_disappearance_commands_kind_check
        CHECK (command_kind IN ('CONTROLLER_REMOVAL', 'DISAPPEARANCE_RECONCILIATION')),
    CONSTRAINT public_experience_disappearance_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    -- A human act carries its exact human; machine convergence carries none.
    -- Both directions, so neither can pose as the other.
    CONSTRAINT public_experience_disappearance_commands_actor_shape_check
        CHECK ((command_kind = 'CONTROLLER_REMOVAL') = (actor_user_id IS NOT NULL)),
    -- The target publication is named whole or not at all. A half-specified
    -- tuple would slip past the composite foreign key, which is MATCH SIMPLE.
    CONSTRAINT public_experience_disappearance_commands_target_shape_check
        CHECK ((target_experience_version_id IS NULL) = (target_manifest_version_id IS NULL)),
    -- A controller removal always concerns an exact publication; only a
    -- reconciliation of an Experience that never published may name none.
    CONSTRAINT public_experience_disappearance_commands_removal_target_check
        CHECK (command_kind <> 'CONTROLLER_REMOVAL' OR target_experience_version_id IS NOT NULL),
    CONSTRAINT public_experience_disappearance_commands_experience_fk
        FOREIGN KEY (experience_id) REFERENCES public.public_experiences (id) ON DELETE RESTRICT,
    -- Experience, published version and published manifest are ONE exact
    -- publication row, structurally: a command naming version V1 beside the
    -- manifest of V2, or naming a version that is not the published one, is
    -- unrepresentable. One composite foreign key onto the section-0 candidate
    -- key, never two independent ones.
    CONSTRAINT public_experience_disappearance_commands_publication_fk
        FOREIGN KEY (experience_id, target_experience_version_id, target_manifest_version_id)
        REFERENCES public.public_experience_publication_state
                   (experience_id, published_experience_version_id, published_manifest_version_id)
        ON DELETE RESTRICT,
    CONSTRAINT public_experience_disappearance_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

CREATE INDEX public_experience_disappearance_commands_experience_idx
    ON public.public_experience_disappearance_commands (experience_id, committed_at);

COMMENT ON TABLE public.public_experience_disappearance_commands IS
  'The durable I-05C disappearance command history: an authorized controller '
  'removal carrying its exact human, or a machine reconciliation carrying none. '
  'The target is ONE exact publication row - Experience, published version and '
  'published manifest together - through one composite foreign key.';

-- ---------------------------------------------------------------------------
-- 2. THE SEALED, APPEND-ONLY DISAPPEARANCE RECORD.
--
--    One row per Experience, forever: an Experience disappears from the Public
--    World once. It names the exact publication that disappeared and ONE
--    bounded internal basis, and it carries no cause detail, no source
--    identifier, no World, no Session, no account, no revision and no digest -
--    internal audit that discloses provenance would be the leak the whole
--    package boundary exists to prevent.
--
--    It is append-only for every role including the table owner, for the reason
--    migration 0091 already established: privileges do not bind the owner, and
--    a future accidental GRANT would otherwise reopen mutation.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_experience_disappearance_state (
    experience_id uuid NOT NULL,
    absent_experience_version_id uuid NOT NULL,
    absent_manifest_version_id uuid NOT NULL,
    disappearance_basis text NOT NULL,
    absent_since timestamptz NOT NULL,
    CONSTRAINT public_experience_disappearance_state_pk PRIMARY KEY (experience_id),
    CONSTRAINT public_experience_disappearance_state_version_key UNIQUE (absent_experience_version_id),
    -- The authorized act plus the exact three convergeable ineligibility
    -- classes migration 0098 decides, spelled identically. No broader taxonomy.
    CONSTRAINT public_experience_disappearance_state_basis_check
        CHECK (disappearance_basis IN ('AUTHORIZED_CONTROLLER_REMOVAL',
                                       'REQUIRED_APPROVAL_NOT_EFFECTIVE',
                                       'PUBLISHED_SOURCE_NOT_AVAILABLE',
                                       'PUBLICATION_AUTHORITY_INVALIDATED')),
    -- ONE exact publication row: the Experience, the exact version it published
    -- and that version's exact manifest, all three read from the same immutable
    -- record. A disappearance for an Experience that never published, and one
    -- naming a version that is not the published one, are unrepresentable.
    CONSTRAINT public_experience_disappearance_state_publication_fk
        FOREIGN KEY (experience_id, absent_experience_version_id, absent_manifest_version_id)
        REFERENCES public.public_experience_publication_state
                   (experience_id, published_experience_version_id, published_manifest_version_id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.public_experience_disappearance_state IS
  'The sealed append-only record that one Public Experience left the Public '
  'World: the exact publication that disappeared and ONE bounded internal '
  'basis. It is evidence, never authority - canonical visibility had already '
  'stopped serving the Experience before this row was written, and stays dark '
  'whether or not it exists.';

CREATE FUNCTION public.reject_public_disappearance_state_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'PUBLIC_DISAPPEARANCE_STATE_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='The record that a Public Experience left the Public World is append-only: UPDATE and DELETE are refused for every role, including the table owner.';
END$$;

ALTER FUNCTION public.reject_public_disappearance_state_mutation_v1() OWNER TO postgres;

CREATE TRIGGER public_experience_disappearance_state_immutable
    BEFORE UPDATE OR DELETE ON public.public_experience_disappearance_state
    FOR EACH ROW EXECUTE FUNCTION public.reject_public_disappearance_state_mutation_v1();

-- ---------------------------------------------------------------------------
-- 3. THE ONE CONTROLLED DISAPPEARANCE PRIMITIVE.
--
--    Internal. Both consequential primitives delegate to it, so the lifecycle
--    transition, the append-only transition record, the sealed evidence and the
--    projection cleanup exist in ONE place rather than in two that could drift.
--
--    It decides no authority of its own: the caller has already proved the
--    exact controller, or has already derived the ineligibility from canonical
--    state, and the caller already holds the canonical locks. What it proves for
--    itself is the transition's own legality - the Experience is `PUBLISHED`,
--    bound to its own current version, with an immutable publication record -
--    so no illegal predecessor state can reach `ABSENT_FROM_PUBLIC_WORLD`
--    however the primitive is called.
--
--    `p_disappearance_basis` is the ONE parameter that carries a derived value,
--    and it is the reason this function exists: it is the bounded class the
--    caller determined, pinned by the CHECK in section 2, and neither
--    consequential primitive accepts one from anybody.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.apply_public_experience_disappearance_v1(
  p_transition_id uuid, p_experience_id uuid, p_disappearance_basis text
) RETURNS TABLE(absent_experience_version_id uuid, absent_manifest_version_id uuid,
                absent_since timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  record_version uuid;
  record_manifest uuid;
  instant timestamptz;
BEGIN
  IF p_transition_id IS NULL OR p_experience_id IS NULL OR p_disappearance_basis IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- THE EXACT PUBLICATION THAT DISAPPEARS IS READ FROM THE IMMUTABLE RECORD,
  -- never supplied, and the only legal predecessor state is PUBLISHED bound to
  -- its own current version.
  SELECT s.published_experience_version_id, s.published_manifest_version_id
    INTO record_version, record_manifest
    FROM public.public_experiences e
    JOIN public.public_experience_publication_state s ON s.experience_id = e.id
   WHERE e.id = p_experience_id
     AND e.current_lifecycle = 'PUBLISHED'
     AND e.current_experience_version_id = s.published_experience_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of this
  -- disappearance: the transition, the evidence and the caller's command.
  instant := clock_timestamp();

  UPDATE public.public_experiences e
     SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD',
         experience_revision = e.experience_revision + 1
   WHERE e.id = p_experience_id;

  -- The transition reuses the caller's command identity, so a caller that
  -- reuses one uuid across two command families is refused with a bounded class
  -- rather than a raw constraint name.
  BEGIN
    INSERT INTO public.public_experience_lifecycle_events
      (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
    VALUES (p_transition_id, p_experience_id, record_version,
            'PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD', instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  INSERT INTO public.public_experience_disappearance_state
    (experience_id, absent_experience_version_id, absent_manifest_version_id,
     disappearance_basis, absent_since)
  VALUES (p_experience_id, record_version, record_manifest, p_disappearance_basis, instant);

  -- DEFENSE IN DEPTH, NEVER THE AUTHORITY. The derived search / lens projection
  -- is removed for the same reason the frozen 0097 rebuild removes it - no
  -- projection outlives the visibility it was derived from - and because it is
  -- the one derived relation that retains a copy of the public text. Canonical
  -- truth was already dark before this statement ran and stays dark if it is
  -- never reached: the frozen readers serve a stored row only while it
  -- describes the CURRENTLY visible version, and there is no longer one.
  -- Vitality is left exactly as the frozen 0097 recompute leaves it: two counts
  -- and an instant, servable only for a visible version, and no public content.
  DELETE FROM public.public_experience_search_projection pr WHERE pr.experience_id = p_experience_id;

  RETURN QUERY SELECT record_version, record_manifest, instant;
END$$;

ALTER FUNCTION public.apply_public_experience_disappearance_v1(uuid, uuid, text) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 4. AUTHORIZED REMOVAL FROM THE PUBLIC WORLD.
--
--    The removing human is exactly `auth.uid()` and must hold EXPERIENCE
--    CONTROL AUTHORITY over the exact Experience. There is no controller,
--    actor, authority or force parameter of any kind, and current Shared
--    membership is never consulted: content rights are not container control
--    (CW2-04 D8), so a rightsholder who is not a controller cannot remove, and
--    a controller who is not a rightsholder can - removing your own Public
--    Experience is a container act.
--
--    A non-controller and a nonexistent Experience receive ONE bounded class,
--    so the command is not an existence oracle; a command identity reused
--    against a different target is refused before anything about that target is
--    read, so idempotency keys cannot probe either.
--
--    A repeated legitimate removal converges: the same command identity replays
--    its committed answer, and a fresh command against an already-absent
--    Experience is `ALREADY_ABSENT` rather than an error - the frozen 0094
--    `ALREADY_WITHDRAWN` idiom.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.remove_public_experience_from_public_world_v1(
  p_command_id uuid, p_experience_id uuid, p_experience_version_id uuid
) RETURNS TABLE(outcome text, experience_id uuid, absent_experience_version_id uuid,
                disappearance_basis text, current_lifecycle text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_experience_disappearance_commands;
  experience public.public_experiences;
  publication public.public_experience_publication_state;
  applied record;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_experience_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_DISAPPEARANCE_COMMAND_V1' || E'\n'
   || 'kind=CONTROLLER_REMOVAL' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'experienceVersion=' || lower(p_experience_version_id::text), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, reading only immutable
  -- command history. A reused identity carrying a different request is refused
  -- here, so it never discloses anything about the target it named.
  SELECT * INTO committed FROM public.public_experience_disappearance_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        committed.target_experience_version_id,
                        (SELECT d.disappearance_basis FROM public.public_experience_disappearance_state d
                          WHERE d.experience_id = committed.experience_id),
                        (SELECT e.current_lifecycle FROM public.public_experiences e
                          WHERE e.id = committed.experience_id),
                        committed.committed_at;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEPS 1 AND 2.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  -- THE EXACT CONTROLLER, and nobody else. One bounded class for a nonexistent
  -- Experience and a non-controller alike, exactly as the frozen publish
  -- boundary answers: a caller learns nothing about whether a guessed
  -- identifier names anything.
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                                WHERE c.experience_id = p_experience_id AND c.controller_user_id = u) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the locks, so two competing
  -- removals serialize and the loser returns the committed result.
  SELECT * INTO committed FROM public.public_experience_disappearance_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        committed.target_experience_version_id,
                        (SELECT d.disappearance_basis FROM public.public_experience_disappearance_state d
                          WHERE d.experience_id = committed.experience_id),
                        experience.current_lifecycle, committed.committed_at;
    RETURN;
  END IF;

  -- A DRAFT and a READY_FOR_REVIEW Experience were never in the Public World,
  -- so there is nothing to remove FROM it. Public disappearance is not a
  -- general delete, and I-05C invents no lifecycle it was not given.
  IF experience.current_lifecycle NOT IN ('PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD') THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID' USING ERRCODE='55000';
  END IF;

  SELECT * INTO publication FROM public.public_experience_publication_state s
   WHERE s.experience_id = p_experience_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  -- THE EXACT TARGET. The caller names the exact published version, and it must
  -- be the one the immutable record holds; the manifest is read from that same
  -- record and is never a parameter, so the command row binds ONE exact
  -- publication.
  IF publication.published_experience_version_id IS DISTINCT FROM p_experience_version_id THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;

  IF experience.current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD' THEN
    instant := clock_timestamp();
    INSERT INTO public.public_experience_disappearance_commands
      (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
       actor_user_id, request_ref, committed_at)
    VALUES (p_command_id, 'CONTROLLER_REMOVAL', p_experience_id,
            publication.published_experience_version_id, publication.published_manifest_version_id,
            u, request, instant);
    RETURN QUERY SELECT 'ALREADY_ABSENT'::text, p_experience_id,
                        publication.published_experience_version_id,
                        (SELECT d.disappearance_basis FROM public.public_experience_disappearance_state d
                          WHERE d.experience_id = p_experience_id),
                        experience.current_lifecycle, instant;
    RETURN;
  END IF;

  -- THE ONE CONTROLLED PATH. Atomic with the decision: the lifecycle, the
  -- transition, the sealed evidence, the projection cleanup and the command
  -- below are one transaction, and any failure leaves nothing behind.
  SELECT * INTO applied FROM public.apply_public_experience_disappearance_v1(
    p_command_id, p_experience_id, 'AUTHORIZED_CONTROLLER_REMOVAL');

  INSERT INTO public.public_experience_disappearance_commands
    (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
     actor_user_id, request_ref, committed_at)
  VALUES (p_command_id, 'CONTROLLER_REMOVAL', p_experience_id,
          applied.absent_experience_version_id, applied.absent_manifest_version_id,
          u, request, applied.absent_since);

  RETURN QUERY SELECT 'REMOVED_FROM_PUBLIC_WORLD'::text, p_experience_id,
                      applied.absent_experience_version_id, 'AUTHORIZED_CONTROLLER_REMOVAL'::text,
                      'ABSENT_FROM_PUBLIC_WORLD'::text, applied.absent_since;
END$$;

-- ---------------------------------------------------------------------------
-- 5. DETERMINISTIC DISAPPEARANCE RECONCILIATION.
--
--    Machine state: there is no `auth.uid()` here and no human at all, exactly
--    as the frozen 0097 derived-state writers have none. It authorizes nothing
--    and decides nothing of its own - it asks the ONE continuing-eligibility
--    truth and converges the lifecycle to match an answer that was already true
--    before it ran.
--
--    It reads no Experience control, because it is not a control action: a
--    publication whose required consent ended or whose source disappeared stops
--    being public whether or not anybody with authority ever asks.
--
--    Every outcome is bounded and deterministic for the same database state:
--
--      DISAPPEARANCE_CONVERGED  PUBLISHED and ineligible for a nameable basis
--      STILL_ELIGIBLE           PUBLISHED and still legitimately public
--      ALREADY_ABSENT           the convergence already happened
--      NOT_APPLICABLE           never published, or contradictory binding
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reconcile_public_experience_disappearance_v1(
  p_command_id uuid, p_experience_id uuid
) RETURNS TABLE(outcome text, experience_id uuid, absent_experience_version_id uuid,
                disappearance_basis text, current_lifecycle text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  committed public.public_experience_disappearance_commands;
  experience public.public_experiences;
  publication public.public_experience_publication_state;
  eligibility record;
  applied record;
  request text;
  instant timestamptz;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_DISAPPEARANCE_COMMAND_V1' || E'\n'
   || 'kind=DISAPPEARANCE_RECONCILIATION' || E'\n'
   || 'experience=' || lower(p_experience_id::text), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS.
  SELECT * INTO committed FROM public.public_experience_disappearance_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        committed.target_experience_version_id,
                        (SELECT d.disappearance_basis FROM public.public_experience_disappearance_state d
                          WHERE d.experience_id = committed.experience_id),
                        (SELECT e.current_lifecycle FROM public.public_experiences e
                          WHERE e.id = committed.experience_id),
                        committed.committed_at;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEPS 1 AND 2.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  IF NOT FOUND THEN
    -- An identifier that names nothing is NOT_APPLICABLE, not an error: this
    -- primitive is machine convergence and is not an existence oracle either.
    -- No command row is recorded, because a command may not name an Experience
    -- that does not exist.
    RETURN QUERY SELECT 'NOT_APPLICABLE'::text, p_experience_id, NULL::uuid, NULL::text,
                        NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO committed FROM public.public_experience_disappearance_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        committed.target_experience_version_id,
                        (SELECT d.disappearance_basis FROM public.public_experience_disappearance_state d
                          WHERE d.experience_id = committed.experience_id),
                        experience.current_lifecycle, committed.committed_at;
    RETURN;
  END IF;

  SELECT * INTO publication FROM public.public_experience_publication_state s
   WHERE s.experience_id = p_experience_id;
  instant := clock_timestamp();

  -- AN EXPERIENCE THAT NEVER PUBLISHED HAS NOTHING TO CONVERGE. The absence of
  -- the record is read from the row variable rather than from FOUND, because an
  -- assignment sits between the query and this test and FOUND is a shared flag.
  IF publication.experience_id IS NULL
     OR experience.current_lifecycle NOT IN ('PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD') THEN
    INSERT INTO public.public_experience_disappearance_commands
      (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
       actor_user_id, request_ref, committed_at)
    VALUES (p_command_id, 'DISAPPEARANCE_RECONCILIATION', p_experience_id, NULL, NULL, NULL, request, instant);
    RETURN QUERY SELECT 'NOT_APPLICABLE'::text, p_experience_id, NULL::uuid, NULL::text,
                        experience.current_lifecycle, instant;
    RETURN;
  END IF;

  IF experience.current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD' THEN
    INSERT INTO public.public_experience_disappearance_commands
      (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
       actor_user_id, request_ref, committed_at)
    VALUES (p_command_id, 'DISAPPEARANCE_RECONCILIATION', p_experience_id,
            publication.published_experience_version_id, publication.published_manifest_version_id,
            NULL, request, instant);
    RETURN QUERY SELECT 'ALREADY_ABSENT'::text, p_experience_id,
                        publication.published_experience_version_id,
                        (SELECT d.disappearance_basis FROM public.public_experience_disappearance_state d
                          WHERE d.experience_id = p_experience_id),
                        experience.current_lifecycle, instant;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 3: the exact manifest, FOR SHARE. It is
  -- immutable, so this documents the hierarchy rather than defending a column.
  PERFORM 1 FROM public.publication_package_manifest_versions m
   WHERE m.id = publication.published_manifest_version_id FOR SHARE;
  -- CANONICAL LOCK ORDER, STEPS 4-7: the exact source rows, in the SAME
  -- relative order every I-04 consequential mutation uses - the Shared World
  -- row first, then materials by id, then history items by id, then the
  -- Personal units. Holding them is what stops the eligibility answer below
  -- from going stale between the decision and the transition.
  PERFORM 1 FROM public.shared_worlds w
    WHERE w.id IN (SELECT p.shared_world_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = publication.published_manifest_version_id
                      AND p.source_class = 'SHARED_WORLD')
    ORDER BY w.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_materials m
    WHERE m.id IN (SELECT p.shared_material_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = publication.published_manifest_version_id
                      AND p.source_class = 'SHARED_WORLD')
    ORDER BY m.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id IN (SELECT p.shared_history_item_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = publication.published_manifest_version_id
                      AND p.source_class = 'SHARED_WORLD')
    ORDER BY i.id FOR SHARE;
  PERFORM 1 FROM public.conversation_units cu
    WHERE cu.id IN (SELECT p.personal_conversation_unit_id FROM public.publication_package_item_provenance p
                     WHERE p.manifest_version_id = publication.published_manifest_version_id
                       AND p.source_class = 'MY_WORLD')
    ORDER BY cu.id FOR SHARE;

  -- THE ONE CONTINUING ELIGIBILITY TRUTH, under those locks.
  SELECT * INTO eligibility FROM public.derive_public_continuing_eligibility_v1(p_experience_id);

  IF eligibility.eligibility_state = 'ELIGIBLE' THEN
    INSERT INTO public.public_experience_disappearance_commands
      (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
       actor_user_id, request_ref, committed_at)
    VALUES (p_command_id, 'DISAPPEARANCE_RECONCILIATION', p_experience_id,
            publication.published_experience_version_id, publication.published_manifest_version_id,
            NULL, request, instant);
    RETURN QUERY SELECT 'STILL_ELIGIBLE'::text, p_experience_id, NULL::uuid, NULL::text,
                        experience.current_lifecycle, instant;
    RETURN;
  END IF;

  -- A PUBLISHED Experience whose publication binding does not hold is
  -- contradictory state, not a disappearance cause. Serving is already dark for
  -- it; the convergence refuses to invent a reason and writes no evidence.
  IF eligibility.ineligibility_class NOT IN ('REQUIRED_APPROVAL_NOT_EFFECTIVE',
                                             'PUBLISHED_SOURCE_NOT_AVAILABLE',
                                             'PUBLICATION_AUTHORITY_INVALIDATED') THEN
    INSERT INTO public.public_experience_disappearance_commands
      (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
       actor_user_id, request_ref, committed_at)
    VALUES (p_command_id, 'DISAPPEARANCE_RECONCILIATION', p_experience_id, NULL, NULL, NULL, request, instant);
    RETURN QUERY SELECT 'NOT_APPLICABLE'::text, p_experience_id, NULL::uuid, NULL::text,
                        experience.current_lifecycle, instant;
    RETURN;
  END IF;

  -- THE ONE CONTROLLED PATH, with the class passed straight through: there is
  -- no second vocabulary to translate into and therefore nothing to drift.
  SELECT * INTO applied FROM public.apply_public_experience_disappearance_v1(
    p_command_id, p_experience_id, eligibility.ineligibility_class);

  INSERT INTO public.public_experience_disappearance_commands
    (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
     actor_user_id, request_ref, committed_at)
  VALUES (p_command_id, 'DISAPPEARANCE_RECONCILIATION', p_experience_id,
          applied.absent_experience_version_id, applied.absent_manifest_version_id,
          NULL, request, applied.absent_since);

  RETURN QUERY SELECT 'DISAPPEARANCE_CONVERGED'::text, p_experience_id,
                      applied.absent_experience_version_id, eligibility.ineligibility_class,
                      'ABSENT_FROM_PUBLIC_WORLD'::text, applied.absent_since;
END$$;

-- ---------------------------------------------------------------------------
-- 6. THE ONE INTERNAL DISAPPEARANCE AUDIT READ BOUNDARY.
--
--    It answers, for one exact Experience, the sealed record of section 2 and
--    nothing else. It is INTERNAL - executable by no application role, like
--    every consequential primitive here - because the frozen contracts grant no
--    Public or ordinary-role access to disappearance evidence, and reading
--    "this Experience was removed because a rightsholder withdrew" is exactly
--    the private cause the public surface must never expose.
--
--    It exists so audit does not require a direct table read, and it discloses
--    no source, World, Session, account, revision or digest: the bounded basis
--    and the exact public identities of the publication, nothing more.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_public_experience_disappearance_audit_v1(p_experience_id uuid)
RETURNS TABLE(experience_id uuid, absent_experience_version_id uuid, absent_manifest_version_id uuid,
              disappearance_basis text, absent_since timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT d.experience_id, d.absent_experience_version_id, d.absent_manifest_version_id,
         d.disappearance_basis, d.absent_since
    FROM public.public_experience_disappearance_state d
   WHERE d.experience_id = p_experience_id;
END$$;

-- ---------------------------------------------------------------------------
-- 7. SECURITY POSTURE.
--
--    Every relation is postgres-owned, RLS-enabled with zero policies, and
--    revoked from PUBLIC, anon, authenticated and service_role. Every function
--    - the controlled core, both consequential primitives and the internal
--    audit boundary - is postgres-owned, SECURITY DEFINER, search_path-pinned
--    and executable by NO application role: the frozen CW2-08 Launch Gate
--    precondition that would make any of them reachable is still unimplemented,
--    so granting EXECUTE now would be manufacturing a launch decision I-05C has
--    no authority to make.
-- ---------------------------------------------------------------------------
ALTER TABLE public.public_experience_disappearance_commands OWNER TO postgres;
ALTER TABLE public.public_experience_disappearance_state OWNER TO postgres;
ALTER TABLE public.public_experience_disappearance_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_experience_disappearance_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_experience_disappearance_commands,
                    public.public_experience_disappearance_state
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.public_experience_disappearance_commands, public.public_experience_disappearance_state FROM service_role';
END IF;END$$;

ALTER FUNCTION public.remove_public_experience_from_public_world_v1(uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.reconcile_public_experience_disappearance_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_public_experience_disappearance_audit_v1(uuid) OWNER TO postgres;

DO $$
DECLARE
  internal text[] := ARRAY[
    'public.reject_public_disappearance_state_mutation_v1()',
    'public.apply_public_experience_disappearance_v1(uuid, uuid, text)',
    'public.remove_public_experience_from_public_world_v1(uuid, uuid, uuid)',
    'public.reconcile_public_experience_disappearance_v1(uuid, uuid)',
    'public.resolve_public_experience_disappearance_audit_v1(uuid)'];
  fn text;
BEGIN
  FOREACH fn IN ARRAY internal LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 8. SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  core text := 'public.apply_public_experience_disappearance_v1(uuid, uuid, text)';
  removal text := 'public.remove_public_experience_from_public_world_v1(uuid, uuid, uuid)';
  reconcile text := 'public.reconcile_public_experience_disappearance_v1(uuid, uuid)';
  audit text := 'public.resolve_public_experience_disappearance_audit_v1(uuid)';
  internal text[] := ARRAY[
    'public.apply_public_experience_disappearance_v1(uuid, uuid, text)',
    'public.remove_public_experience_from_public_world_v1(uuid, uuid, uuid)',
    'public.reconcile_public_experience_disappearance_v1(uuid, uuid)',
    'public.resolve_public_experience_disappearance_audit_v1(uuid)'];
  commands text[] := ARRAY[
    'public.remove_public_experience_from_public_world_v1(uuid, uuid, uuid)',
    'public.reconcile_public_experience_disappearance_v1(uuid, uuid)'];
  mutating text[] := ARRAY[
    'public.apply_public_experience_disappearance_v1(uuid, uuid, text)',
    'public.remove_public_experience_from_public_world_v1(uuid, uuid, uuid)',
    'public.reconcile_public_experience_disappearance_v1(uuid, uuid)'];
  own_tables text[] := ARRAY['public_experience_disappearance_commands',
                             'public_experience_disappearance_state'];
  fn text;
  t text;
  role_name text;
  p record;
BEGIN
  -- EVERY FUNCTION IS POSTGRES-OWNED, SECURITY DEFINER, search_path PINNED, AND
  -- EXECUTABLE BY NO APPLICATION ROLE. There is no serving surface here at all:
  -- the audit boundary is internal too, because disappearance evidence names a
  -- private cause.
  FOREACH fn IN ARRAY internal LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc,
           pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-05C: % must be owned by postgres', fn; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-05C: % must be SECURITY DEFINER', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-05C: % must pin an empty search_path', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-05C: PUBLIC must not execute % before the frozen CW2-08 Launch Gate exists', fn;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name)
         AND has_function_privilege(role_name, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-05C: % must not execute % before the frozen CW2-08 Launch Gate exists', role_name, fn;
      END IF;
    END LOOP;
  END LOOP;
  IF (SELECT pr.provolatile FROM pg_proc pr WHERE pr.oid = audit::regprocedure) <> 's' THEN
    RAISE EXCEPTION 'I-05C: the disappearance audit boundary must be STABLE';
  END IF;

  -- THE THREE MUTATIONS ARE VOLATILE, READ ONE DATABASE CLOCK, TAKE NO ADVISORY
  -- OR TABLE LOCK, AND MUTATE NO SOURCE, EVIDENCE, PACKAGE OR CONTROL.
  FOREACH fn IN ARRAY mutating LOOP
    SELECT pr.prosrc, pr.provolatile INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.provolatile <> 'v' THEN
      RAISE EXCEPTION 'I-05C: consequential primitive % must be VOLATILE', fn;
    END IF;
    IF p.prosrc ~* 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
      RAISE EXCEPTION 'I-05C: % accepts no clock but one read of the database clock', fn;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' OR p.prosrc ~* 'TRUNCATE' THEN
      RAISE EXCEPTION 'I-05C: % locks rows in the canonical order and truncates nothing', fn;
    END IF;
    IF p.prosrc ~ '(INSERT INTO|UPDATE|DELETE FROM) public\.(shared_world|conversation_|users|memories|hypothes|standing_context|matching_|introduction|publication_manifest_approvals|publication_manifest_required_approvers|publication_approval_withdrawal|public_experience_controllers|publication_package|public_experience_publication_state|public_experience_versions|public_identities|public_identity_display_state|public_discussion_posts|public_qandeel_responses|public_experience_semantic_placements)' THEN
      RAISE EXCEPTION 'I-05C: % must erase no immutable evidence and mutate no source, package, approval, control, presence or identity', fn;
    END IF;
    IF p.prosrc ~ 'shared_world_membership_episodes' OR p.prosrc ~ 'shared_world_history_access_grants'
       OR p.prosrc ~ 'shared_world_standard_closed_view_entitlements'
       OR p.prosrc ~ 'shared_world_history_package_manifest_items' THEN
      RAISE EXCEPTION 'I-05C: % must not re-implement Shared membership or history authorization', fn;
    END IF;
    -- NO CALLER-SUPPLIED STATE OF ANY KIND. Declared INPUT names only (mode
    -- 'i'), because for a RETURNS TABLE function `proargnames` also holds the
    -- result columns and these primitives RETURN the basis and the lifecycle
    -- they derived.
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 'i'
         AND arg.name ~ '(approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|clear|launch|safety|entitle|allow|effective|eligib|absent|cause|reason|force|fingerprint)'
    ) THEN
      RAISE EXCEPTION 'I-05C: % may not accept an authority audience visibility eligibility or instant parameter', fn;
    END IF;
  END LOOP;

  -- THE ONE CONTROLLED PATH TO ABSENT_FROM_PUBLIC_WORLD. The core is the only
  -- function that writes the value, both commands delegate to it and write no
  -- lifecycle of their own, and no I-05C function can reactivate a publication.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = core::regprocedure;
  IF (SELECT count(*) FROM regexp_matches(p.prosrc, 'SET current_lifecycle = ''ABSENT_FROM_PUBLIC_WORLD''', 'g')) <> 1 THEN
    RAISE EXCEPTION 'I-05C: the controlled disappearance core must write ABSENT_FROM_PUBLIC_WORLD exactly once';
  END IF;
  IF p.prosrc !~ 'e\.current_lifecycle = ''PUBLISHED'''
     OR p.prosrc !~ 'e\.current_experience_version_id = s\.published_experience_version_id' THEN
    RAISE EXCEPTION 'I-05C: the controlled disappearance core must refuse every predecessor state but PUBLISHED bound to its own current version';
  END IF;
  IF p.prosrc !~ 'public_experience_lifecycle_events'
     OR p.prosrc !~ '''PUBLISHED'', ''ABSENT_FROM_PUBLIC_WORLD''' THEN
    RAISE EXCEPTION 'I-05C: the disappearance transition must be appended to the frozen append-only lifecycle truth';
  END IF;
  IF p.prosrc !~ 'public_experience_disappearance_state' THEN
    RAISE EXCEPTION 'I-05C: the disappearance must be auditable';
  END IF;
  IF p.prosrc ~ 'auth\.uid\(\)' THEN
    RAISE EXCEPTION 'I-05C: the controlled disappearance core decides no authority of its own';
  END IF;
  FOREACH fn IN ARRAY commands LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc ~ 'SET current_lifecycle' THEN
      RAISE EXCEPTION 'I-05C: % must reach ABSENT_FROM_PUBLIC_WORLD only through the ONE controlled primitive', fn;
    END IF;
    IF p.prosrc !~ 'apply_public_experience_disappearance_v1' THEN
      RAISE EXCEPTION 'I-05C: % must delegate the transition to the ONE controlled primitive', fn;
    END IF;
    IF p.prosrc !~ 'FROM public\.public_world_state w WHERE w\.singleton FOR UPDATE'
       OR p.prosrc !~ 'FROM public\.public_experiences e WHERE e\.id = p_experience_id FOR UPDATE' THEN
      RAISE EXCEPTION 'I-05C: % must take the canonical Public lock prefix', fn;
    END IF;
    IF (SELECT count(*) FROM regexp_matches(p.prosrc, 'WHERE c\.id = p_command_id', 'g')) <> 2 THEN
      RAISE EXCEPTION 'I-05C: % must check durable idempotency before any lock and again under it', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY internal LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc ~ 'SET current_lifecycle = ''PUBLISHED'''
       OR p.prosrc ~ 'SET current_lifecycle = ''DRAFT'''
       OR p.prosrc ~ 'SET current_lifecycle = ''READY_FOR_REVIEW''' THEN
      RAISE EXCEPTION 'I-05C: no I-05C primitive may reactivate an absent Experience: % writes a serving lifecycle', fn;
    END IF;
  END LOOP;

  -- THE REMOVAL IS A CONTROL ACT: the exact controller from auth.uid(), with no
  -- controller parameter, and it never reads content rights.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = removal::regprocedure;
  IF p.prosrc !~ 'auth\.uid\(\)' OR p.prosrc !~ 'public_experience_controllers' THEN
    RAISE EXCEPTION 'I-05C: removal must require the exact Experience controller derived from auth.uid()';
  END IF;
  IF p.prosrc !~ 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' THEN
    RAISE EXCEPTION 'I-05C: a non-controller and a nonexistent Experience must reach ONE bounded class';
  END IF;
  IF p.prosrc ~ 'publication_manifest_approvals' OR p.prosrc ~ 'publication_manifest_required_approvers'
     OR p.prosrc ~ 'publication_approval_withdrawal_events' THEN
    RAISE EXCEPTION 'I-05C: container control is not content rights: removal reads no approval';
  END IF;
  IF p.prosrc !~ 'published_experience_version_id IS DISTINCT FROM p_experience_version_id' THEN
    RAISE EXCEPTION 'I-05C: removal must bind the exact published version the immutable record holds';
  END IF;
  IF p.prosrc !~ 'ALREADY_ABSENT' THEN
    RAISE EXCEPTION 'I-05C: a repeated legitimate removal must converge rather than error';
  END IF;

  -- THE RECONCILIATION IS MACHINE CONVERGENCE: no human, no control, bounded by
  -- the ONE continuing-eligibility truth, holding the sources while it decides.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = reconcile::regprocedure;
  IF p.prosrc ~ 'auth\.uid\(\)' THEN
    RAISE EXCEPTION 'I-05C: disappearance reconciliation derives no human: machine convergence is not a control action';
  END IF;
  IF p.prosrc ~ 'public_experience_controllers' THEN
    RAISE EXCEPTION 'I-05C: disappearance reconciliation is not a control action and reads no control';
  END IF;
  IF p.prosrc !~ 'derive_public_continuing_eligibility_v1' THEN
    RAISE EXCEPTION 'I-05C: disappearance reconciliation must consume the ONE continuing-eligibility truth';
  END IF;
  IF p.prosrc !~ 'FROM public\.shared_worlds w'
     OR p.prosrc !~ 'ORDER BY m\.id FOR SHARE' OR p.prosrc !~ 'ORDER BY i\.id FOR SHARE'
     OR p.prosrc !~ 'ORDER BY cu\.id FOR SHARE' THEN
    RAISE EXCEPTION 'I-05C: disappearance reconciliation must hold the exact sources in the frozen I-04 order while it decides';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['DISAPPEARANCE_CONVERGED', 'STILL_ELIGIBLE',
                                   'ALREADY_ABSENT', 'NOT_APPLICABLE'] LOOP
    IF p.prosrc !~ role_name THEN
      RAISE EXCEPTION 'I-05C: the bounded reconciliation outcome vocabulary must include %', role_name;
    END IF;
  END LOOP;

  -- THE AUDIT BOUNDARY DISCLOSES NO SOURCE AND NO PRIVATE IDENTITY, and it is
  -- not a public surface: it reads the sealed record alone.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = audit::regprocedure;
  IF p.prosrc ~ 'publication_package_item_provenance' OR p.prosrc ~ 'shared_world'
     OR p.prosrc ~ 'conversation_unit' OR p.prosrc ~ 'public_identities' THEN
    RAISE EXCEPTION 'I-05C: the disappearance audit boundary must read no sealed provenance and no private identity';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
     WHERE pr.oid = audit::regprocedure AND arg.mode = 't'
       AND arg.name ~ '(user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material_id|history_item|availability|context_ref|world_id|provenance|digest|fingerprint)'
  ) THEN
    RAISE EXCEPTION 'I-05C: the disappearance audit boundary must disclose no private identity and no sealed provenance';
  END IF;

  -- STRUCTURE: both relations bind ONE exact publication row through ONE
  -- composite restrictive foreign key onto the additive candidate key, never
  -- through an independent partial one, and neither carries a cause detail, a
  -- source identifier or a decision column of its own.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.public_experience_publication_state'::regclass
       AND c.conname = 'public_experience_publication_state_exact_identity_key' AND c.contype = 'u'
       AND (SELECT array_agg(a.attname::text ORDER BY k.ord)
              FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)
           = ARRAY['experience_id', 'published_experience_version_id', 'published_manifest_version_id']
  ) THEN
    RAISE EXCEPTION 'I-05C: the frozen publication record must carry the additive exact-identity candidate key (experience, version, manifest)';
  END IF;
  FOREACH t IN ARRAY own_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND (c.confrelid = 'public.publication_package_manifest_versions'::regclass
              OR (c.confrelid = 'public.public_experience_publication_state'::regclass
                  AND cardinality(c.confkey) <> 3))
    ) THEN
      RAISE EXCEPTION 'I-05C: % may not bind the publication through an independent partial or direct manifest foreign key', t;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid = 'public.public_experience_publication_state'::regclass AND c.confdeltype = 'r'
         AND (SELECT array_agg(a.attname::text ORDER BY k.ord)
                FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
                JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)
             = CASE t WHEN 'public_experience_disappearance_state'
                      THEN ARRAY['experience_id', 'absent_experience_version_id', 'absent_manifest_version_id']
                      ELSE ARRAY['experience_id', 'target_experience_version_id', 'target_manifest_version_id'] END
         AND (SELECT array_agg(a.attname::text ORDER BY k.ord)
                FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
                JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum)
             = ARRAY['experience_id', 'published_experience_version_id', 'published_manifest_version_id']
    ) THEN
      RAISE EXCEPTION 'I-05C: % must bind the exact publication - Experience, published version and published manifest of the same row - through one composite restrictive foreign key', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(safety|moderation|launch|entitlement|premium|feature_flag|allow|visib|semantic|placement|vitality|discussion|reply|detail|note|message|session|turn|conversation_unit|world_id|shared_|material_id|history_item|availability|email|phone|contact|credential|digest)'
    ) THEN
      RAISE EXCEPTION 'I-05C: relation % may carry no Safety Launch entitlement visibility serving source or free-text cause column', t;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.public_experience_disappearance_state'::regclass
       AND c.conname = 'public_experience_disappearance_state_basis_check'
       AND pg_get_constraintdef(c.oid) ~ 'AUTHORIZED_CONTROLLER_REMOVAL'
       AND pg_get_constraintdef(c.oid) ~ 'REQUIRED_APPROVAL_NOT_EFFECTIVE'
       AND pg_get_constraintdef(c.oid) ~ 'PUBLISHED_SOURCE_NOT_AVAILABLE'
       AND pg_get_constraintdef(c.oid) ~ 'PUBLICATION_AUTHORITY_INVALIDATED'
  ) OR EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.public_experience_disappearance_state'::regclass
       AND c.conname = 'public_experience_disappearance_state_basis_check'
       AND pg_get_constraintdef(c.oid) ~ 'PUBLICATION_BINDING_INVALID'
  ) THEN
    RAISE EXCEPTION 'I-05C: the disappearance basis must be exactly the authorized act and the three convergeable ineligibility classes';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.public_experience_disappearance_state'::regclass
                    AND tg.tgname = 'public_experience_disappearance_state_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05C: the disappearance record must be append-only for every role';
  END IF;

  -- NO APPLICATION ROLE CAN TAKE THIS PATH AROUND: the frozen Experience
  -- relation holds no privilege for any of them, so a direct lifecycle update
  -- by an application role is not merely refused, it is unreachable.
  FOREACH role_name IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
    CONTINUE WHEN role_name <> 'public'
              AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name);
    IF has_table_privilege(role_name, 'public.public_experiences'::regclass, 'UPDATE')
       OR has_table_privilege(role_name, 'public.public_experiences'::regclass, 'SELECT') THEN
      RAISE EXCEPTION 'I-05C: % must hold no direct privilege on the Experience lifecycle relation', role_name;
    END IF;
  END LOOP;

  -- DENY BY DEFAULT ON EVERY RELATION THIS MIGRATION CREATED.
  FOREACH t IN ARRAY own_tables LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-05C: relation % must have row level security enabled', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-05C: relation % must carry zero policies', t;
    END IF;
    IF (SELECT c.relowner FROM pg_class c WHERE c.oid = ('public.' || t)::regclass)
       <> (SELECT r.oid FROM pg_roles r WHERE r.rolname = 'postgres') THEN
      RAISE EXCEPTION 'I-05C: relation % must be postgres-owned', t;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN role_name <> 'public'
                AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name);
      IF has_table_privilege(role_name, ('public.' || t)::regclass, 'SELECT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'INSERT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'UPDATE')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'DELETE') THEN
        RAISE EXCEPTION 'I-05C: relation % must hold no privilege for %', t, role_name;
      END IF;
    END LOOP;
  END LOOP;

  -- THE FROZEN BOUNDARIES PART B CONSUMES MUST STILL BE INTACT, and PART A must
  -- already be the canonical visibility truth: the convergence is defense in
  -- depth over a derivation that already went dark, never a substitute for it.
  IF (SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = 'public.resolve_public_visibility_state_v1(uuid)'::regprocedure)
     !~ 'derive_public_continuing_eligibility_v1' THEN
    RAISE EXCEPTION 'I-05C: the canonical visibility derivation must already consume continuing eligibility before any convergence exists';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.public_experience_lifecycle_events'::regclass
                    AND tg.tgname = 'public_experience_lifecycle_events_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05C: the frozen 0091 lifecycle truth must still be append-only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.public_experience_publication_state'::regclass
                    AND tg.tgname = 'public_experience_publication_state_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05C: the frozen 0095 publication record must still be append-only';
  END IF;
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)'::regprocedure)
     !~ 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'I-05C: the CW2-08 prerequisite seam must still answer NOT_EVALUATED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.public_audience_policy_state ps
                  WHERE ps.singleton AND ps.signed_out_viewing_policy = 'UNRESOLVED') THEN
    RAISE EXCEPTION 'I-05C: the frozen CW2-08 signed-out viewing requirement must remain UNRESOLVED';
  END IF;
END$$;

COMMIT;
