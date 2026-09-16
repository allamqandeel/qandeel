-- I-05B - Public Semantic Placement, Discussion and Public QANDEEL v1 (PART C).
--
-- Three Public presences composed over the frozen identity / version / package
-- foundation and the canonical visibility truth of migration 0095. None of
-- them is an authority: a placement publishes nothing, a discussion post
-- approves nothing, and a Public QANDEEL response consents to nothing.
--
-- ===========================================================================
-- Semantic interpretation binds the exact immutable version
-- ===========================================================================
--
-- A semantic placement is a bounded interpretation descriptor - the lens the
-- version is read under and a short semantic label - bound by composite
-- foreign key to ONE exact immutable Public Experience Version of ONE exact
-- Experience (CW2-04 sections 12 and 14 / D14 / D16). There is no floating
-- interpretation attached to an Experience or a package: the version is the
-- unit of meaning, and a NEW version carries its own interpretation.
--
-- Publisher correction is ADDITIVE and AUDITABLE. Every placement row is
-- append-only; a correction is a new row with the next `placement_revision`
-- for the same version, and the current-effective interpretation is the
-- highest revision - deterministic, and history-preserving. Nothing here can
-- touch a version, a manifest, an item, a body, a provenance row, an approval
-- or a controller: a correction changes interpretation and NOTHING about
-- source content, authority, consent or provenance. A correction that would
-- need a different public payload is not a correction at all; it is a new
-- package through the frozen preparation path, and no primitive here offers a
-- shortcut around that.
--
-- The descriptor set is deliberately minimal. No coordinate, embedding, ranking
-- or geometry is invented here; a later reviewed spatial model composes beside
-- this relation by the same version key.
--
-- ===========================================================================
-- Discussion authority is its own authority
-- ===========================================================================
--
-- A discussion post binds a stable Public Identity to a PUBLICLY VISIBLE target
-- and to the exact version that was visible when it was posted. Posting
-- requires exactly three things: an authenticated human, their own stable
-- Public Identity (resolved from auth.uid(), never supplied), and a target the
-- canonical visibility truth serves to an admitted viewer. It requires no
-- Experience control, grants none, and reads no approval: a controller or a
-- rightsholder posts on the same terms as anyone else, because no frozen
-- contract says otherwise. A reply binds its parent in the SAME Experience by
-- composite foreign key, so a reply can never point across Experiences.
--
-- An invisible target and a target that does not exist receive ONE bounded
-- class, so the discussion API is not an existence oracle for DRAFT,
-- READY_FOR_REVIEW or otherwise non-visible Experiences. Posts are ordered by a
-- per-Experience ordinal derived under the Experience lock and are append-only
-- here: deletion and complete public disappearance are a later reviewed slice.
--
-- ===========================================================================
-- Public QANDEEL is machine state, not human authority
-- ===========================================================================
--
-- A Public QANDEEL response is producer output bound to the exact visible
-- version, optionally in reply to one exact post, carrying a context
-- fingerprint over the PUBLIC-domain identities it consumed - the Experience,
-- the version, the manifest, the current placement revision, the reply target
-- and the consumed post identities. The writer derives no human from
-- auth.uid() and its relation carries no author, no account and no approver:
-- it creates no consent, no control and no rightsholder authority, and it
-- never reads sealed provenance, so runtime integrity is preserved without a
-- route back to any private source.
--
-- ===========================================================================
-- Lock order
-- ===========================================================================
--
-- Each writer takes the exact Experience row FOR UPDATE (step 2 of the
-- canonical order) and then writes its own family only. None takes the Public
-- World singleton: none moves a lifecycle or widens an audience. They
-- serialize with publication and with each other and can form no cycle.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- No lifecycle transition, no publication, no visibility decision of its own,
-- no vitality, search, lens or panel (0097); no deletion, moderation, report,
-- block, Safety, Launch or entitlement; no route, controller, RPC or mobile
-- surface. Migrations 0001-0095 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. SEMANTIC PLACEMENT, bound to the exact version, append-only.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_experience_semantic_placements (
    id uuid NOT NULL,
    experience_id uuid NOT NULL,
    experience_version_id uuid NOT NULL,
    placement_revision integer NOT NULL,
    placement_basis text NOT NULL,
    lens_key text NOT NULL,
    semantic_label text NOT NULL,
    recorded_by_public_identity_ref uuid NOT NULL,
    recorded_by_user_id uuid NOT NULL,
    recorded_at timestamptz NOT NULL,
    CONSTRAINT public_experience_semantic_placements_pk PRIMARY KEY (id),
    -- Deterministic revision order within ONE exact version.
    CONSTRAINT public_experience_semantic_placements_revision_key
        UNIQUE (experience_version_id, placement_revision),
    CONSTRAINT public_experience_semantic_placements_revision_check CHECK (placement_revision >= 1),
    CONSTRAINT public_experience_semantic_placements_basis_check
        CHECK (placement_basis IN ('INITIAL_INTERPRETATION', 'PUBLISHER_CORRECTION')),
    -- The first revision is the initial interpretation; every later one is a
    -- correction. Both directions, so a correction cannot pose as an initial.
    CONSTRAINT public_experience_semantic_placements_basis_revision_check
        CHECK ((placement_revision = 1) = (placement_basis = 'INITIAL_INTERPRETATION')),
    CONSTRAINT public_experience_semantic_placements_lens_check
        CHECK (lens_key ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'),
    CONSTRAINT public_experience_semantic_placements_label_check
        CHECK (length(btrim(semantic_label)) > 0 AND length(semantic_label) <= 120
               AND semantic_label !~ '[\n\r]'),
    -- Exact version of the exact Experience, structurally.
    CONSTRAINT public_experience_semantic_placements_version_fk
        FOREIGN KEY (experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT public_experience_semantic_placements_recorder_fk
        FOREIGN KEY (recorded_by_public_identity_ref, recorded_by_user_id)
        REFERENCES public.public_identities (public_identity_ref, user_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.public_experience_semantic_placements IS
  'Semantic interpretation of ONE exact immutable Public Experience Version: the '
  'lens it is read under and a bounded semantic label. Append-only; a publisher '
  'correction is the next revision for the same version and the current-effective '
  'interpretation is the highest revision. It touches no version, package, '
  'provenance, approval or control.';

CREATE TABLE public.public_experience_semantic_placement_commands (
    id uuid NOT NULL,
    placement_id uuid NOT NULL,
    experience_id uuid NOT NULL,
    experience_version_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT public_experience_semantic_placement_commands_pk PRIMARY KEY (id),
    CONSTRAINT public_experience_semantic_placement_commands_placement_key UNIQUE (placement_id),
    CONSTRAINT public_experience_semantic_placement_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT public_experience_semantic_placement_commands_placement_fk
        FOREIGN KEY (placement_id) REFERENCES public.public_experience_semantic_placements (id) ON DELETE RESTRICT,
    CONSTRAINT public_experience_semantic_placement_commands_version_fk
        FOREIGN KEY (experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT public_experience_semantic_placement_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 2. PUBLIC DISCUSSION POSTS AND REPLIES, append-only.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_discussion_posts (
    id uuid NOT NULL,
    experience_id uuid NOT NULL,
    target_experience_version_id uuid NOT NULL,
    parent_post_id uuid,
    post_ordinal bigint NOT NULL,
    author_public_identity_ref uuid NOT NULL,
    author_user_id uuid NOT NULL,
    post_body text NOT NULL,
    posted_at timestamptz NOT NULL,
    CONSTRAINT public_discussion_posts_pk PRIMARY KEY (id),
    -- Lets a reply bind (parent, Experience) in one constraint.
    CONSTRAINT public_discussion_posts_experience_key UNIQUE (id, experience_id),
    -- Deterministic per-Experience order.
    CONSTRAINT public_discussion_posts_order_key UNIQUE (experience_id, post_ordinal),
    CONSTRAINT public_discussion_posts_order_check CHECK (post_ordinal >= 1),
    CONSTRAINT public_discussion_posts_body_check CHECK (length(btrim(post_body)) > 0),
    CONSTRAINT public_discussion_posts_self_check CHECK (parent_post_id IS NULL OR parent_post_id <> id),
    -- The exact version that was publicly visible when the post was made.
    CONSTRAINT public_discussion_posts_target_fk
        FOREIGN KEY (target_experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
    -- A reply targets a post of the SAME Experience, structurally.
    CONSTRAINT public_discussion_posts_parent_fk
        FOREIGN KEY (parent_post_id, experience_id)
        REFERENCES public.public_discussion_posts (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT public_discussion_posts_author_fk
        FOREIGN KEY (author_public_identity_ref, author_user_id)
        REFERENCES public.public_identities (public_identity_ref, user_id) ON DELETE RESTRICT
);

CREATE INDEX public_discussion_posts_parent_idx
    ON public.public_discussion_posts (parent_post_id) WHERE parent_post_id IS NOT NULL;

COMMENT ON TABLE public.public_discussion_posts IS
  'A Public World discussion post or reply, bound to a stable Public Identity, to '
  'the exact publicly visible version it was made against, and - for a reply - to '
  'a parent post of the same Experience. Discussion authority is neither '
  'Experience control nor content rights nor publication approval, and grants none.';

CREATE TABLE public.public_discussion_post_commands (
    id uuid NOT NULL,
    post_id uuid NOT NULL,
    experience_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT public_discussion_post_commands_pk PRIMARY KEY (id),
    CONSTRAINT public_discussion_post_commands_post_key UNIQUE (post_id),
    CONSTRAINT public_discussion_post_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT public_discussion_post_commands_post_fk
        FOREIGN KEY (post_id, experience_id)
        REFERENCES public.public_discussion_posts (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT public_discussion_post_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 3. PUBLIC QANDEEL RESPONSES, machine-produced, append-only.
--
--    No author, no account, no approver column: producer state is distinct
--    from human authority by shape, not by discipline.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_qandeel_responses (
    id uuid NOT NULL,
    experience_id uuid NOT NULL,
    experience_version_id uuid NOT NULL,
    in_reply_to_post_id uuid,
    producer_kind text NOT NULL,
    response_ordinal bigint NOT NULL,
    response_body text NOT NULL,
    context_fingerprint text NOT NULL,
    produced_at timestamptz NOT NULL,
    CONSTRAINT public_qandeel_responses_pk PRIMARY KEY (id),
    CONSTRAINT public_qandeel_responses_order_key UNIQUE (experience_id, response_ordinal),
    CONSTRAINT public_qandeel_responses_producer_check CHECK (producer_kind = 'PUBLIC_QANDEEL'),
    CONSTRAINT public_qandeel_responses_order_check CHECK (response_ordinal >= 1),
    CONSTRAINT public_qandeel_responses_body_check CHECK (length(btrim(response_body)) > 0),
    CONSTRAINT public_qandeel_responses_context_check
        CHECK (context_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT public_qandeel_responses_version_fk
        FOREIGN KEY (experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT public_qandeel_responses_reply_fk
        FOREIGN KEY (in_reply_to_post_id, experience_id)
        REFERENCES public.public_discussion_posts (id, experience_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.public_qandeel_responses IS
  'Public QANDEEL producer output bound to the exact publicly visible version, '
  'optionally in reply to one post of the same Experience, with a context '
  'fingerprint over PUBLIC-domain identities only. It carries no author, account '
  'or approver: machine output is never human consent, control or content rights.';

CREATE TABLE public.public_qandeel_response_commands (
    id uuid NOT NULL,
    response_id uuid NOT NULL,
    experience_id uuid NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT public_qandeel_response_commands_pk PRIMARY KEY (id),
    CONSTRAINT public_qandeel_response_commands_response_key UNIQUE (response_id),
    CONSTRAINT public_qandeel_response_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT public_qandeel_response_commands_response_fk
        FOREIGN KEY (response_id) REFERENCES public.public_qandeel_responses (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 4. IMMUTABILITY OF PLACEMENT, DISCUSSION AND RESPONSE HISTORY.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_public_semantic_presence_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'PUBLIC_SEMANTIC_PRESENCE_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A semantic placement revision, a public discussion post and a Public QANDEEL response are append-only: UPDATE and DELETE are refused for every role, including the table owner. A correction is a new revision.';
END$$;

ALTER FUNCTION public.reject_public_semantic_presence_mutation_v1() OWNER TO postgres;

CREATE TRIGGER public_experience_semantic_placements_immutable
    BEFORE UPDATE OR DELETE ON public.public_experience_semantic_placements
    FOR EACH ROW EXECUTE FUNCTION public.reject_public_semantic_presence_mutation_v1();
CREATE TRIGGER public_discussion_posts_immutable
    BEFORE UPDATE OR DELETE ON public.public_discussion_posts
    FOR EACH ROW EXECUTE FUNCTION public.reject_public_semantic_presence_mutation_v1();
CREATE TRIGGER public_qandeel_responses_immutable
    BEFORE UPDATE OR DELETE ON public.public_qandeel_responses
    FOR EACH ROW EXECUTE FUNCTION public.reject_public_semantic_presence_mutation_v1();

-- ---------------------------------------------------------------------------
-- 5. THE CURRENT-EFFECTIVE INTERPRETATION OF ONE EXACT VERSION.
--
--    The highest revision, and nothing else. Zero rows when the version has no
--    interpretation yet and zero rows for NULL, because the resolvers below
--    join it laterally over the visibility answer.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_public_experience_current_placement_v1(p_experience_version_id uuid)
RETURNS TABLE(experience_version_id uuid, placement_id uuid, placement_revision integer,
              placement_basis text, lens_key text, semantic_label text, recorded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_experience_version_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT sp.experience_version_id, sp.id, sp.placement_revision, sp.placement_basis,
         sp.lens_key, sp.semantic_label, sp.recorded_at
    FROM public.public_experience_semantic_placements sp
   WHERE sp.experience_version_id = p_experience_version_id
   ORDER BY sp.placement_revision DESC
   LIMIT 1;
END$$;

ALTER FUNCTION public.derive_public_experience_current_placement_v1(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 6. RECORD OR CORRECT THE SEMANTIC PLACEMENT OF ONE EXACT VERSION.
--
--    The exact controller, from auth.uid(). The first revision of a version is
--    its INITIAL_INTERPRETATION; every later one is a PUBLISHER_CORRECTION.
--    Nothing but a placement row and its command is written.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.record_public_experience_semantic_placement_v1(
  p_command_id uuid, p_placement_id uuid, p_experience_id uuid, p_experience_version_id uuid,
  p_lens_key text, p_semantic_label text
) RETURNS TABLE(outcome text, placement_id uuid, experience_id uuid, experience_version_id uuid,
                placement_revision integer, placement_basis text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_experience_semantic_placement_commands;
  experience public.public_experiences;
  controller public.public_experience_controllers;
  next_revision integer;
  basis text;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_placement_id IS NULL OR p_experience_id IS NULL
     OR p_experience_version_id IS NULL
     OR p_lens_key IS NULL OR p_lens_key !~ '^[a-z0-9][a-z0-9_.-]{0,63}$'
     OR p_semantic_label IS NULL OR length(btrim(p_semantic_label)) = 0
     OR length(p_semantic_label) > 120 OR p_semantic_label ~ '[\n\r]' THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_SEMANTIC_PLACEMENT_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'experienceVersion=' || lower(p_experience_version_id::text) || E'\n'
   || 'placement=' || lower(p_placement_id::text) || E'\n'
   || 'lens=' || p_lens_key || E'\n'
   || 'label=' || 'sha256:' || encode(sha256(convert_to(btrim(p_semantic_label), 'UTF8')), 'hex'), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS.
  SELECT * INTO committed FROM public.public_experience_semantic_placement_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.placement_id, committed.experience_id,
                        committed.experience_version_id,
                        (SELECT sp.placement_revision FROM public.public_experience_semantic_placements sp
                          WHERE sp.id = committed.placement_id),
                        (SELECT sp.placement_basis FROM public.public_experience_semantic_placements sp
                          WHERE sp.id = committed.placement_id),
                        committed.committed_at;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the exact Experience. No singleton lock: a
  -- placement moves no lifecycle and widens no audience.
  SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;
  -- THE EXACT CONTROLLER, and nobody else: one class with a nonexistent
  -- Experience, so nothing here reveals whether a guessed identifier exists.
  SELECT * INTO controller FROM public.public_experience_controllers c
   WHERE c.experience_id = p_experience_id AND c.controller_user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  SELECT * INTO committed FROM public.public_experience_semantic_placement_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.placement_id, committed.experience_id,
                        committed.experience_version_id,
                        (SELECT sp.placement_revision FROM public.public_experience_semantic_placements sp
                          WHERE sp.id = committed.placement_id),
                        (SELECT sp.placement_basis FROM public.public_experience_semantic_placements sp
                          WHERE sp.id = committed.placement_id),
                        committed.committed_at;
    RETURN;
  END IF;

  -- Interpretation is recorded for a version of a living Experience only: the
  -- three lifecycles this slice serves or prepares to serve.
  IF experience.current_lifecycle NOT IN ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED') THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID' USING ERRCODE='55000';
  END IF;
  -- THE EXACT VERSION OF THIS EXACT EXPERIENCE.
  IF NOT EXISTS (SELECT 1 FROM public.public_experience_versions v
                  WHERE v.id = p_experience_version_id AND v.experience_id = p_experience_id) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT coalesce(max(sp.placement_revision), 0) + 1 INTO next_revision
    FROM public.public_experience_semantic_placements sp
   WHERE sp.experience_version_id = p_experience_version_id;
  basis := CASE WHEN next_revision = 1 THEN 'INITIAL_INTERPRETATION' ELSE 'PUBLISHER_CORRECTION' END;
  instant := clock_timestamp();

  BEGIN
    INSERT INTO public.public_experience_semantic_placements
      (id, experience_id, experience_version_id, placement_revision, placement_basis, lens_key,
       semantic_label, recorded_by_public_identity_ref, recorded_by_user_id, recorded_at)
    VALUES (p_placement_id, p_experience_id, p_experience_version_id, next_revision, basis, p_lens_key,
            btrim(p_semantic_label), controller.controller_public_identity_ref, u, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;
  INSERT INTO public.public_experience_semantic_placement_commands
    (id, placement_id, experience_id, experience_version_id, actor_user_id, request_ref, committed_at)
  VALUES (p_command_id, p_placement_id, p_experience_id, p_experience_version_id, u, request, instant);

  RETURN QUERY SELECT CASE WHEN next_revision = 1 THEN 'PLACEMENT_RECORDED' ELSE 'PLACEMENT_CORRECTED' END::text,
                      p_placement_id, p_experience_id, p_experience_version_id, next_revision, basis, instant;
END$$;

-- ---------------------------------------------------------------------------
-- 7. POST TO THE PUBLIC DISCUSSION OF ONE VISIBLE EXPERIENCE, OR REPLY.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.post_public_discussion_v1(
  p_command_id uuid, p_post_id uuid, p_experience_id uuid, p_parent_post_id uuid, p_post_body text
) RETURNS TABLE(outcome text, post_id uuid, experience_id uuid, target_experience_version_id uuid,
                parent_post_id uuid, post_ordinal bigint, author_public_identity_ref uuid,
                committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_discussion_post_commands;
  identity public.public_identities;
  visible_version uuid;
  next_ordinal bigint;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_post_id IS NULL OR p_experience_id IS NULL
     OR p_post_body IS NULL OR length(btrim(p_post_body)) = 0 OR p_parent_post_id = p_post_id THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_DISCUSSION_POST_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'post=' || lower(p_post_id::text) || E'\n'
   || 'parent=' || coalesce(lower(p_parent_post_id::text), '') || E'\n'
   || 'body=' || 'sha256:' || encode(sha256(convert_to(p_post_body, 'UTF8')), 'hex'), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS.
  SELECT * INTO committed FROM public.public_discussion_post_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.post_id, committed.experience_id,
                        dp.target_experience_version_id, dp.parent_post_id, dp.post_ordinal,
                        dp.author_public_identity_ref, committed.committed_at
      FROM public.public_discussion_posts dp WHERE dp.id = committed.post_id;
    RETURN;
  END IF;

  -- THE AUTHOR'S OWN STABLE PUBLIC IDENTITY, resolved and never supplied. This
  -- is a fact about the ACTOR and is decided before any target is read.
  SELECT * INTO identity FROM public.public_identities i WHERE i.user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the exact Experience, so the visibility
  -- answer below cannot move before the post lands.
  PERFORM 1 FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;

  -- THE TARGET IS PUBLICLY VISIBLE AND THE AUTHOR IS AN ADMITTED VIEWER, through
  -- the canonical truths and nothing else. A target that names nothing, a
  -- DRAFT, a READY_FOR_REVIEW and a viewer the policy does not admit receive
  -- ONE bounded class.
  SELECT vs.visible_experience_version_id INTO visible_version
    FROM public.resolve_public_visibility_state_v1(p_experience_id) vs
    JOIN public.resolve_public_audience_admission_v1(u) ad ON ad.admission = 'ADMITTED'
   WHERE vs.visibility_state = 'PUBLICLY_VISIBLE';
  IF NOT FOUND OR visible_version IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.public_discussion_post_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.post_id, committed.experience_id,
                        dp.target_experience_version_id, dp.parent_post_id, dp.post_ordinal,
                        dp.author_public_identity_ref, committed.committed_at
      FROM public.public_discussion_posts dp WHERE dp.id = committed.post_id;
    RETURN;
  END IF;

  -- A REPLY TARGETS A POST OF THIS EXACT EXPERIENCE AND OF THE CURRENTLY
  -- VISIBLE VERSION. Discussion is exact-version-bound: a post made against an
  -- earlier version is not a reply target once a later version is the visible
  -- one, because successor-version discussion semantics are not decided here
  -- and nothing silently carries one version's conversation into another.
  -- Same bounded class: a parent that does not exist here reveals nothing.
  IF p_parent_post_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.public_discussion_posts dp
     WHERE dp.id = p_parent_post_id AND dp.experience_id = p_experience_id
       AND dp.target_experience_version_id = visible_version) THEN
    RAISE EXCEPTION 'PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT coalesce(max(dp.post_ordinal), 0) + 1 INTO next_ordinal
    FROM public.public_discussion_posts dp WHERE dp.experience_id = p_experience_id;
  instant := clock_timestamp();

  BEGIN
    INSERT INTO public.public_discussion_posts
      (id, experience_id, target_experience_version_id, parent_post_id, post_ordinal,
       author_public_identity_ref, author_user_id, post_body, posted_at)
    VALUES (p_post_id, p_experience_id, visible_version, p_parent_post_id, next_ordinal,
            identity.public_identity_ref, u, p_post_body, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;
  INSERT INTO public.public_discussion_post_commands
    (id, post_id, experience_id, actor_user_id, request_ref, committed_at)
  VALUES (p_command_id, p_post_id, p_experience_id, u, request, instant);

  RETURN QUERY SELECT CASE WHEN p_parent_post_id IS NULL THEN 'POSTED' ELSE 'REPLIED' END::text,
                      p_post_id, p_experience_id, visible_version, p_parent_post_id, next_ordinal,
                      identity.public_identity_ref, instant;
END$$;

-- ---------------------------------------------------------------------------
-- 8. RECORD A PUBLIC QANDEEL RESPONSE.
--
--    Machine state. There is no auth.uid() here and no human author: the
--    producer is the server-side QANDEEL runtime, and this primitive is
--    executable by no application role. The target must be publicly visible.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.record_public_qandeel_response_v1(
  p_command_id uuid, p_response_id uuid, p_experience_id uuid, p_in_reply_to_post_id uuid,
  p_response_body text, p_consumed_post_ids uuid[]
) RETURNS TABLE(outcome text, response_id uuid, experience_id uuid, experience_version_id uuid,
                response_ordinal bigint, context_fingerprint text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  committed public.public_qandeel_response_commands;
  visible_version uuid;
  visible_manifest uuid;
  current_placement integer;
  consumed_scope text;
  next_ordinal bigint;
  context_print text;
  request text;
  instant timestamptz;
BEGIN
  IF p_command_id IS NULL OR p_response_id IS NULL OR p_experience_id IS NULL
     OR p_response_body IS NULL OR length(btrim(p_response_body)) = 0
     OR p_consumed_post_ids IS NULL OR array_position(p_consumed_post_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  consumed_scope := coalesce((SELECT string_agg(lower(x::text), ',' ORDER BY lower(x::text) COLLATE "C")
                                FROM unnest(p_consumed_post_ids) AS x), '');

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_QANDEEL_RESPONSE_COMMAND_V1' || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'response=' || lower(p_response_id::text) || E'\n'
   || 'replyTo=' || coalesce(lower(p_in_reply_to_post_id::text), '') || E'\n'
   || 'consumed=' || consumed_scope || E'\n'
   || 'body=' || 'sha256:' || encode(sha256(convert_to(p_response_body, 'UTF8')), 'hex'), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS.
  SELECT * INTO committed FROM public.public_qandeel_response_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.response_id, committed.experience_id,
                        r.experience_version_id, r.response_ordinal, r.context_fingerprint, committed.committed_at
      FROM public.public_qandeel_responses r WHERE r.id = committed.response_id;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2.
  PERFORM 1 FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;

  -- THE TARGET IS PUBLICLY VISIBLE, through the canonical truth. One bounded
  -- class for a target that names nothing and a target that is not public.
  SELECT vs.visible_experience_version_id, vs.visible_manifest_version_id INTO visible_version, visible_manifest
    FROM public.resolve_public_visibility_state_v1(p_experience_id) vs
   WHERE vs.visibility_state = 'PUBLICLY_VISIBLE';
  IF NOT FOUND OR visible_version IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.public_qandeel_response_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.response_id, committed.experience_id,
                        r.experience_version_id, r.response_ordinal, r.context_fingerprint, committed.committed_at
      FROM public.public_qandeel_responses r WHERE r.id = committed.response_id;
    RETURN;
  END IF;

  -- THE REPLY TARGET AND EVERY CONSUMED POST BELONG TO THIS EXACT EXPERIENCE
  -- AND TO THE CURRENTLY VISIBLE VERSION. Public QANDEEL output is
  -- exact-version-bound: it never replies to or consumes a post made against
  -- an earlier version as if it were part of the current one - successor
  -- semantics are not decided here. One bounded class for every miss.
  IF p_in_reply_to_post_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.public_discussion_posts dp
     WHERE dp.id = p_in_reply_to_post_id AND dp.experience_id = p_experience_id
       AND dp.target_experience_version_id = visible_version) THEN
    RAISE EXCEPTION 'PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_consumed_post_ids) AS x
     WHERE NOT EXISTS (SELECT 1 FROM public.public_discussion_posts dp
                        WHERE dp.id = x AND dp.experience_id = p_experience_id
                          AND dp.target_experience_version_id = visible_version)) THEN
    RAISE EXCEPTION 'PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE CONTEXT FINGERPRINT binds PUBLIC-domain identities only: the exact
  -- Experience, the visible version and manifest, the current interpretation
  -- revision, the reply target and the consumed posts. Never a source, never
  -- sealed provenance.
  SELECT cp.placement_revision INTO current_placement
    FROM public.derive_public_experience_current_placement_v1(visible_version) cp;
  context_print := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_QANDEEL_CONTEXT_V1' || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'experienceVersion=' || lower(visible_version::text) || E'\n'
   || 'manifest=' || lower(visible_manifest::text) || E'\n'
   || 'placementRevision=' || coalesce(current_placement::text, 'NONE') || E'\n'
   || 'replyTo=' || coalesce(lower(p_in_reply_to_post_id::text), '') || E'\n'
   || 'consumed=' || consumed_scope, 'UTF8')), 'hex');

  SELECT coalesce(max(r.response_ordinal), 0) + 1 INTO next_ordinal
    FROM public.public_qandeel_responses r WHERE r.experience_id = p_experience_id;
  instant := clock_timestamp();

  BEGIN
    INSERT INTO public.public_qandeel_responses
      (id, experience_id, experience_version_id, in_reply_to_post_id, producer_kind, response_ordinal,
       response_body, context_fingerprint, produced_at)
    VALUES (p_response_id, p_experience_id, visible_version, p_in_reply_to_post_id, 'PUBLIC_QANDEEL',
            next_ordinal, p_response_body, context_print, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;
  INSERT INTO public.public_qandeel_response_commands
    (id, response_id, experience_id, request_ref, committed_at)
  VALUES (p_command_id, p_response_id, p_experience_id, request, instant);

  RETURN QUERY SELECT 'RESPONSE_RECORDED'::text, p_response_id, p_experience_id, visible_version,
                      next_ordinal, context_print, instant;
END$$;

-- ---------------------------------------------------------------------------
-- 9. THE THREE READ BOUNDARIES: placement, discussion, Public QANDEEL.
--
--    Each composes the ONE visibility derivation with the admission gate and
--    returns zero rows otherwise. None reads sealed provenance or an account.
--    Discussion and Public QANDEEL rows are served for the CURRENTLY VISIBLE
--    version only: every row binds the exact version it was made against, and
--    a row bound to an earlier version is never served as the current
--    version's. What a later reviewed successor publication does with earlier
--    conversation is that slice's decision; nothing here decides it silently.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_public_experience_semantic_placement_v1(p_experience_id uuid, p_viewer_user_id uuid)
RETURNS TABLE(experience_id uuid, experience_version_id uuid, placement_revision integer,
              placement_basis text, lens_key text, semantic_label text, recorded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT vs.experience_id, cp.experience_version_id, cp.placement_revision, cp.placement_basis,
         cp.lens_key, cp.semantic_label, cp.recorded_at
    FROM public.resolve_public_visibility_state_v1(p_experience_id) vs
    JOIN public.resolve_public_audience_admission_v1(p_viewer_user_id) ad ON ad.admission = 'ADMITTED'
    JOIN LATERAL public.derive_public_experience_current_placement_v1(vs.visible_experience_version_id) cp ON true
   WHERE vs.visibility_state = 'PUBLICLY_VISIBLE';
END$$;

CREATE FUNCTION public.resolve_public_discussion_v1(p_experience_id uuid, p_viewer_user_id uuid)
RETURNS TABLE(post_id uuid, experience_id uuid, target_experience_version_id uuid, parent_post_id uuid,
              post_ordinal bigint, author_public_identity_ref uuid, author_label_mode text,
              author_display_label text, post_body text, posted_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT dp.id, dp.experience_id, dp.target_experience_version_id, dp.parent_post_id, dp.post_ordinal,
         dp.author_public_identity_ref, d.label_mode, d.display_label, dp.post_body, dp.posted_at
    FROM public.resolve_public_visibility_state_v1(p_experience_id) vs
    JOIN public.resolve_public_audience_admission_v1(p_viewer_user_id) ad ON ad.admission = 'ADMITTED'
    JOIN public.public_discussion_posts dp ON dp.experience_id = vs.experience_id
     AND dp.target_experience_version_id = vs.visible_experience_version_id
    JOIN public.public_identity_display_state d ON d.public_identity_ref = dp.author_public_identity_ref
   WHERE vs.visibility_state = 'PUBLICLY_VISIBLE'
   ORDER BY dp.post_ordinal;
END$$;

CREATE FUNCTION public.resolve_public_qandeel_responses_v1(p_experience_id uuid, p_viewer_user_id uuid)
RETURNS TABLE(response_id uuid, experience_id uuid, experience_version_id uuid, in_reply_to_post_id uuid,
              response_ordinal bigint, response_body text, produced_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT r.id, r.experience_id, r.experience_version_id, r.in_reply_to_post_id, r.response_ordinal,
         r.response_body, r.produced_at
    FROM public.resolve_public_visibility_state_v1(p_experience_id) vs
    JOIN public.resolve_public_audience_admission_v1(p_viewer_user_id) ad ON ad.admission = 'ADMITTED'
    JOIN public.public_qandeel_responses r ON r.experience_id = vs.experience_id
     AND r.experience_version_id = vs.visible_experience_version_id
   WHERE vs.visibility_state = 'PUBLICLY_VISIBLE'
   ORDER BY r.response_ordinal;
END$$;

-- ---------------------------------------------------------------------------
-- 10. SECURITY POSTURE.
-- ---------------------------------------------------------------------------
ALTER TABLE public.public_experience_semantic_placements OWNER TO postgres;
ALTER TABLE public.public_experience_semantic_placement_commands OWNER TO postgres;
ALTER TABLE public.public_discussion_posts OWNER TO postgres;
ALTER TABLE public.public_discussion_post_commands OWNER TO postgres;
ALTER TABLE public.public_qandeel_responses OWNER TO postgres;
ALTER TABLE public.public_qandeel_response_commands OWNER TO postgres;

ALTER TABLE public.public_experience_semantic_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_experience_semantic_placement_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_discussion_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_discussion_post_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_qandeel_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_qandeel_response_commands ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.public_experience_semantic_placements,
                    public.public_experience_semantic_placement_commands,
                    public.public_discussion_posts,
                    public.public_discussion_post_commands,
                    public.public_qandeel_responses,
                    public.public_qandeel_response_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.public_experience_semantic_placements, public.public_experience_semantic_placement_commands, public.public_discussion_posts, public.public_discussion_post_commands, public.public_qandeel_responses, public.public_qandeel_response_commands FROM service_role';
END IF;END$$;

ALTER FUNCTION public.derive_public_experience_current_placement_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.record_public_experience_semantic_placement_v1(uuid, uuid, uuid, uuid, text, text) OWNER TO postgres;
ALTER FUNCTION public.post_public_discussion_v1(uuid, uuid, uuid, uuid, text) OWNER TO postgres;
ALTER FUNCTION public.record_public_qandeel_response_v1(uuid, uuid, uuid, uuid, text, uuid[]) OWNER TO postgres;
ALTER FUNCTION public.resolve_public_experience_semantic_placement_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_public_discussion_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_public_qandeel_responses_v1(uuid, uuid) OWNER TO postgres;

DO $$
DECLARE
  internal text[] := ARRAY[
    'public.reject_public_semantic_presence_mutation_v1()',
    'public.derive_public_experience_current_placement_v1(uuid)',
    'public.record_public_experience_semantic_placement_v1(uuid, uuid, uuid, uuid, text, text)',
    'public.post_public_discussion_v1(uuid, uuid, uuid, uuid, text)',
    'public.record_public_qandeel_response_v1(uuid, uuid, uuid, uuid, text, uuid[])'];
  resolvers text[] := ARRAY[
    'public.resolve_public_experience_semantic_placement_v1(uuid, uuid)',
    'public.resolve_public_discussion_v1(uuid, uuid)',
    'public.resolve_public_qandeel_responses_v1(uuid, uuid)'];
  fn text;
BEGIN
  FOREACH fn IN ARRAY internal LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY resolvers LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 11. SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  internal text[] := ARRAY[
    'public.derive_public_experience_current_placement_v1(uuid)',
    'public.record_public_experience_semantic_placement_v1(uuid, uuid, uuid, uuid, text, text)',
    'public.post_public_discussion_v1(uuid, uuid, uuid, uuid, text)',
    'public.record_public_qandeel_response_v1(uuid, uuid, uuid, uuid, text, uuid[])'];
  mutating text[] := ARRAY[
    'public.record_public_experience_semantic_placement_v1(uuid, uuid, uuid, uuid, text, text)',
    'public.post_public_discussion_v1(uuid, uuid, uuid, uuid, text)',
    'public.record_public_qandeel_response_v1(uuid, uuid, uuid, uuid, text, uuid[])'];
  resolvers text[] := ARRAY[
    'public.resolve_public_experience_semantic_placement_v1(uuid, uuid)',
    'public.resolve_public_discussion_v1(uuid, uuid)',
    'public.resolve_public_qandeel_responses_v1(uuid, uuid)'];
  placement text := 'public.record_public_experience_semantic_placement_v1(uuid, uuid, uuid, uuid, text, text)';
  discussion text := 'public.post_public_discussion_v1(uuid, uuid, uuid, uuid, text)';
  producer text := 'public.record_public_qandeel_response_v1(uuid, uuid, uuid, uuid, text, uuid[])';
  own_tables text[] := ARRAY['public_experience_semantic_placements', 'public_experience_semantic_placement_commands',
                             'public_discussion_posts', 'public_discussion_post_commands',
                             'public_qandeel_responses', 'public_qandeel_response_commands'];
  presence_tables text[] := ARRAY['public_experience_semantic_placements', 'public_discussion_posts',
                                  'public_qandeel_responses'];
  fn text;
  t text;
  role_name text;
  p record;
BEGIN
  -- POSTURE OF EVERY INTERNAL FUNCTION.
  FOREACH fn IN ARRAY internal LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc,
           pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-05B: % must be owned by postgres', fn; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-05B: % must be SECURITY DEFINER', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-05B: % must pin an empty search_path', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-05B: PUBLIC must not execute % before the frozen CW2-08 Launch Gate exists', fn;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name)
         AND has_function_privilege(role_name, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-05B: % must not execute % before the frozen CW2-08 Launch Gate exists', role_name, fn;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY mutating LOOP
    SELECT pr.provolatile, pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-05B: consequential primitive % must be VOLATILE', fn; END IF;
    IF p.prosrc ~* 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
      RAISE EXCEPTION 'I-05B: % accepts no clock but one read of the database clock', fn;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' OR p.prosrc ~* 'TRUNCATE' THEN
      RAISE EXCEPTION 'I-05B: % locks rows in the canonical order and truncates nothing', fn;
    END IF;
    IF p.prosrc !~ 'FROM public\.public_experiences e WHERE e\.id = p_experience_id FOR UPDATE' THEN
      RAISE EXCEPTION 'I-05B: % must hold the exact Experience row while it decides', fn;
    END IF;
    -- NONE OF THEM CAN PUBLISH, RE-POINT A PUBLICATION, MOVE A LIFECYCLE, MUTATE
    -- A VERSION, A PACKAGE, AN APPROVAL, A CONTROLLER OR ANY PREDECESSOR STATE.
    IF p.prosrc ~ 'SET current_lifecycle' OR p.prosrc ~ 'to_lifecycle' THEN
      RAISE EXCEPTION 'I-05B: % must not be able to write a lifecycle', fn;
    END IF;
    IF p.prosrc ~ '(INSERT INTO|UPDATE|DELETE FROM) public\.(public_experiences|public_experience_versions|public_experience_lifecycle_events|public_experience_publication_state|public_experience_controllers|publication_package|publication_manifest|publication_approval|shared_world|conversation_|users|public_identities|public_identity_display_state)' THEN
      RAISE EXCEPTION 'I-05B: % must write only its own presence family', fn;
    END IF;
    IF p.prosrc ~ 'shared_world_membership_episodes' OR p.prosrc ~ 'shared_world_history_access_grants'
       OR p.prosrc ~ 'publication_package_item_provenance' THEN
      RAISE EXCEPTION 'I-05B: % must read no Shared membership and no sealed provenance', fn;
    END IF;
    IF p.prosrc ~ 'ABSENT_FROM_PUBLIC_WORLD' THEN
      RAISE EXCEPTION 'I-05B: % owns no disappearance lifecycle', fn;
    END IF;
  END LOOP;
  -- NO MUTATION ACCEPTS AN AUTHORITY, APPROVER, AUDIENCE, VISIBILITY, ORDINAL,
  -- REVISION, BASIS OR INSTANT PARAMETER. Declared INPUT names only.
  FOREACH fn IN ARRAY internal LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 'i'
         AND arg.name ~ '(approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|ordinal|revision|basis|fingerprint|author|identity|producer)'
    ) THEN
      RAISE EXCEPTION 'I-05B: % may not accept an authority audience visibility ordinal revision or instant parameter', fn;
    END IF;
  END LOOP;

  -- THE PLACEMENT WRITER: exact controller, exact version of the exact
  -- Experience, additive revisions with a derived basis.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = placement::regprocedure;
  IF p.prosrc !~ 'auth\.uid\(\)' OR p.prosrc !~ 'public_experience_controllers' THEN
    RAISE EXCEPTION 'I-05B: semantic placement requires the exact Experience controller from auth.uid()';
  END IF;
  IF p.prosrc !~ 'INITIAL_INTERPRETATION' OR p.prosrc !~ 'PUBLISHER_CORRECTION'
     OR p.prosrc !~ 'coalesce\(max\(sp\.placement_revision\), 0\) \+ 1' THEN
    RAISE EXCEPTION 'I-05B: a correction must be the next additive revision of the exact version, never a rewrite';
  END IF;
  IF p.prosrc ~ 'publication_manifest_approvals' OR p.prosrc ~ 'publication_manifest_required_approvers' THEN
    RAISE EXCEPTION 'I-05B: semantic placement reads no approval: interpretation is not consent';
  END IF;

  -- THE DISCUSSION WRITER: the author's own Public Identity, a publicly visible
  -- target through the canonical truths, no control and no approval.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = discussion::regprocedure;
  IF p.prosrc !~ 'auth\.uid\(\)' OR p.prosrc !~ 'FROM public\.public_identities i WHERE i\.user_id = u' THEN
    RAISE EXCEPTION 'I-05B: a discussion post binds the author''s own stable Public Identity, resolved from auth.uid()';
  END IF;
  IF p.prosrc !~ 'resolve_public_visibility_state_v1' OR p.prosrc !~ 'resolve_public_audience_admission_v1'
     OR p.prosrc !~ 'PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE' THEN
    RAISE EXCEPTION 'I-05B: a discussion target must resolve through the canonical visibility truth and the admission gate, and refuse with one bounded class';
  END IF;
  IF p.prosrc ~ 'public_experience_controllers' OR p.prosrc ~ 'publication_manifest_approvals'
     OR p.prosrc ~ 'publication_manifest_required_approvers' OR p.prosrc ~ 'current_lifecycle' THEN
    RAISE EXCEPTION 'I-05B: discussion authority is not control, not rights, not approval, and tests no lifecycle for itself';
  END IF;
  IF p.prosrc !~ 'dp\.id = p_parent_post_id AND dp\.experience_id = p_experience_id\s+AND dp\.target_experience_version_id = visible_version' THEN
    RAISE EXCEPTION 'I-05B: a reply must target a post of the currently visible version, never merely a post of the same Experience';
  END IF;

  -- THE PUBLIC QANDEEL WRITER: no human, no consent, a visible target, and a
  -- context fingerprint over public-domain identities only.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = producer::regprocedure;
  IF p.prosrc ~ 'auth\.uid\(\)' THEN
    RAISE EXCEPTION 'I-05B: Public QANDEEL output derives no human: machine state is not human authority';
  END IF;
  IF p.prosrc !~ 'resolve_public_visibility_state_v1' OR p.prosrc !~ 'PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE' THEN
    RAISE EXCEPTION 'I-05B: a Public QANDEEL target must resolve through the canonical visibility truth and refuse with one bounded class';
  END IF;
  IF p.prosrc !~ 'QANDEEL_CWV2_PUBLIC_QANDEEL_CONTEXT_V1' OR p.prosrc ~ 'publication_package_item_provenance'
     OR p.prosrc ~ 'shared_world' OR p.prosrc ~ 'conversation_unit' THEN
    RAISE EXCEPTION 'I-05B: the Public QANDEEL context fingerprint binds public-domain identities only and never a source';
  END IF;
  IF p.prosrc ~ 'public_experience_controllers' OR p.prosrc ~ 'publication_manifest_approvals' THEN
    RAISE EXCEPTION 'I-05B: Public QANDEEL output creates no control and satisfies no approval';
  END IF;
  IF p.prosrc !~ 'dp\.id = p_in_reply_to_post_id AND dp\.experience_id = p_experience_id\s+AND dp\.target_experience_version_id = visible_version'
     OR p.prosrc !~ 'dp\.id = x AND dp\.experience_id = p_experience_id\s+AND dp\.target_experience_version_id = visible_version' THEN
    RAISE EXCEPTION 'I-05B: Public QANDEEL output must reply to and consume posts of the currently visible version only';
  END IF;

  -- EXACT-VERSION CLOSURE OF THE TWO CONVERSATION RESOLVERS: a discussion post
  -- or a Public QANDEEL response bound to an earlier version is never served
  -- as the currently visible version's. Successor-version semantics are left
  -- to a later reviewed slice; nothing here chooses an Experience-wide policy.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = 'public.resolve_public_discussion_v1(uuid, uuid)'::regprocedure;
  IF p.prosrc !~ 'dp\.target_experience_version_id = vs\.visible_experience_version_id' THEN
    RAISE EXCEPTION 'I-05B: the discussion resolver must serve only posts bound to the currently visible version';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = 'public.resolve_public_qandeel_responses_v1(uuid, uuid)'::regprocedure;
  IF p.prosrc !~ 'r\.experience_version_id = vs\.visible_experience_version_id' THEN
    RAISE EXCEPTION 'I-05B: the Public QANDEEL resolver must serve only responses bound to the currently visible version';
  END IF;

  -- THE THREE RESOLVERS: STABLE, service_role-only, both gates, no provenance,
  -- no private identity.
  FOREACH fn IN ARRAY resolvers LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc,
           pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' OR NOT p.prosecdef OR p.provolatile <> 's'
       OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-05B: resolver % must be a postgres-owned STABLE SECURITY DEFINER with an empty search_path', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-05B: resolver % must not be executable by PUBLIC', fn;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name)
         AND has_function_privilege(role_name, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-05B: resolver % must not be executable by %', fn, role_name;
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
       AND NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-05B: service_role must execute resolver %', fn;
    END IF;
    IF p.prosrc !~ 'resolve_public_visibility_state_v1' OR p.prosrc !~ 'resolve_public_audience_admission_v1'
       OR p.prosrc !~ 'visibility_state = ''PUBLICLY_VISIBLE''' OR p.prosrc !~ 'admission = ''ADMITTED''' THEN
      RAISE EXCEPTION 'I-05B: resolver % must consume the canonical visibility state and the audience admission gate', fn;
    END IF;
    IF p.prosrc ~ 'publication_package_item_provenance' OR p.prosrc ~ 'current_lifecycle'
       OR p.prosrc ~ 'INSERT INTO' OR p.prosrc ~ 'UPDATE public' OR p.prosrc ~ 'DELETE FROM' THEN
      RAISE EXCEPTION 'I-05B: resolver % must read no sealed provenance, test no lifecycle for itself and write nothing', fn;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_proc pr,
        unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 't'
         AND arg.name ~ '(user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material_id|history_item|availability|context_ref|world_id|provenance|digest|fingerprint)'
    ) THEN
      RAISE EXCEPTION 'I-05B: resolver % must disclose no private identity and no sealed provenance', fn;
    END IF;
  END LOOP;

  -- STRUCTURE: placement and post bind the exact version of the exact
  -- Experience; a reply binds a post of the same Experience; the response
  -- relation carries no human; nothing here references control, approval or a
  -- source; every presence relation is append-only.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.public_experience_semantic_placements'::regclass
       AND c.conname = 'public_experience_semantic_placements_version_fk'
       AND c.confrelid = 'public.public_experience_versions'::regclass AND c.confdeltype = 'r'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.public_experience_semantic_placements'::regclass
       AND c.conname = 'public_experience_semantic_placements_revision_key' AND c.contype = 'u'
  ) THEN
    RAISE EXCEPTION 'I-05B: semantic placement must bind the exact version by restrictive composite foreign key with deterministic revisions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.public_discussion_posts'::regclass
       AND c.conname = 'public_discussion_posts_parent_fk'
       AND c.confrelid = 'public.public_discussion_posts'::regclass AND c.confdeltype = 'r'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.public_discussion_posts'::regclass
       AND c.conname = 'public_discussion_posts_target_fk'
       AND c.confrelid = 'public.public_experience_versions'::regclass AND c.confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'I-05B: a discussion post must bind the exact visible version and a reply must bind a parent of the same Experience';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
     WHERE a.attrelid = 'public.public_qandeel_responses'::regclass
       AND a.attnum > 0 AND NOT a.attisdropped
       AND a.attname ~ '(user_id|author|approv|control|consent|identity)'
  ) THEN
    RAISE EXCEPTION 'I-05B: Public QANDEEL output must carry no human author, account, approver or consent column';
  END IF;
  FOREACH t IN ARRAY own_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid IN ('public.public_experience_controllers'::regclass,
                             'public.publication_manifest_approvals'::regclass,
                             'public.publication_manifest_required_approvers'::regclass,
                             'public.publication_package_item_provenance'::regclass)
    ) THEN
      RAISE EXCEPTION 'I-05B: relation % must reach no control, no approval and no sealed provenance', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(safety|moderation|launch|entitlement|premium|feature_flag|allow|approv|session|turn|conversation_unit|world_id|shared_|material_id|history_item|email|phone|contact|credential|source_)'
    ) THEN
      RAISE EXCEPTION 'I-05B: relation % may carry no Safety Launch entitlement approval or source column', t;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY presence_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
       WHERE tg.tgrelid = ('public.' || t)::regclass AND NOT tg.tgisinternal
         AND tg.tgfoid = 'public.reject_public_semantic_presence_mutation_v1'::regproc
    ) THEN
      RAISE EXCEPTION 'I-05B: relation % must be append-only for every role', t;
    END IF;
  END LOOP;

  -- THE CANONICAL TRUTHS THIS SLICE CONSUMES MUST STILL EXIST AND STAY SEALED.
  IF has_function_privilege('public', 'public.resolve_public_visibility_state_v1(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I-05B: the canonical visibility derivation must stay internal';
  END IF;

  -- DENY BY DEFAULT ON EVERY RELATION THIS MIGRATION CREATED.
  FOREACH t IN ARRAY own_tables LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-05B: relation % must have row level security enabled', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-05B: relation % must carry zero policies', t;
    END IF;
    IF (SELECT c.relowner FROM pg_class c WHERE c.oid = ('public.' || t)::regclass)
       <> (SELECT r.oid FROM pg_roles r WHERE r.rolname = 'postgres') THEN
      RAISE EXCEPTION 'I-05B: relation % must be postgres-owned', t;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN role_name <> 'public'
                AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name);
      IF has_table_privilege(role_name, ('public.' || t)::regclass, 'SELECT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'INSERT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'UPDATE')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'DELETE') THEN
        RAISE EXCEPTION 'I-05B: relation % must hold no privilege for %', t, role_name;
      END IF;
    END LOOP;
  END LOOP;
END$$;

COMMIT;
