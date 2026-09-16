-- I-05B - Public Experience Publication, Canonical Visibility and Serving v1 (PART B).
--
-- This migration creates the ONE protected transition I-05A deliberately did
-- not create - READY_FOR_REVIEW -> PUBLISHED - the immutable record of what
-- exactly was published, the ONE canonical PUBLIC_VISIBILITY_STATE every Public
-- surface must consume, the Public audience admission gate beside it, and the
-- ONE Public World serving resolver.
--
-- ===========================================================================
-- Publication trusts nothing it did not just re-derive
-- ===========================================================================
--
-- A READY_FOR_REVIEW snapshot is a historical fact about the moment the READY
-- commit ran. Publication is explicit audience expansion (CW2-01 A19, CW2-02
-- section 39, CW2-04 D4) and is decided from CURRENT state, under the canonical
-- lock discipline, in one transaction. Before the exact version transitions it
-- revalidates, in this order:
--
--    1  the exact target Experience and the exact controller (one bounded
--       class for a nonexistent Experience and a non-controller alike);
--    2  lifecycle eligibility: READY_FOR_REVIEW and nothing else - DRAFT can
--       never jump, and a second publication is refused;
--    3  the exact immutable version: it belongs to this Experience, it is the
--       Experience's CURRENT version, and it is the version the canonical READY
--       transition actually committed;
--    4  the exact immutable manifest, held FOR SHARE, of this same Experience;
--    5  every included source row, locked in the frozen I-04 relative order;
--    6  current source access: every included Shared history item is CURRENTLY
--       visible to the publishing human through the canonical I-04F entry
--       point `resolve_shared_world_history_visibility_v1`, refused with the
--       SAME class a nonexistent source gets; every included Personal unit is
--       owned by the publishing human exactly;
--    7  the ONE I-05A authority derivation: availability at the captured
--       revision, resolved authority, the exact rightsholder set and the
--       CURRENT authority request fingerprint;
--    8  the stored required set equals the derived one;
--    9  every required approval is currently EFFECTIVE through the ONE 0094
--       derivation - MISSING refuses, WITHDRAWN and SUPERSEDED refuse, and an
--       approval bound to a different fingerprint refuses as stale;
--   10  the READY commit's own recorded fingerprint still equals the current
--       one - a changed source, authority or Public World snapshot since the
--       READY commit is stale, never a false-ready state;
--   11  LAST, the frozen CW2-08 Safety / Launch Gate / commercial-entitlement
--       prerequisite, through the seam below.
--
-- Authority truth is answered BEFORE the launch prerequisite so a refused
-- publication is refused for the true reason; the prerequisite is the final
-- gate and an unresolved prerequisite never lets an earlier gate be skipped.
-- Any failure leaves nothing behind: the lifecycle, the publication state, the
-- transition and the command are one transaction.
--
-- ===========================================================================
-- The CW2-08 prerequisite seam, and why it fails closed
-- ===========================================================================
--
-- No executable canonical runtime for System / Safety policy, the Launch Gate
-- or commercial entitlement exists in this repository: I-05A recorded them as
-- NOT_EVALUATED, the Shared runtime records delivery as NOT_GRANTED_BY_THIS_
-- BOUNDARY, and no relation or function anywhere answers "may this be
-- launched". I-05B manufactures no such decision. It creates ONE seam,
-- `resolve_public_publication_prerequisites_v1`, whose only answer today is
-- NOT_EVALUATED, and the publish boundary requires exactly CLEARED from it. A
-- later reviewed CW2-08 slice replaces the seam with the real canonical gate
-- and nothing in the publish boundary changes. No permissive constant, no
-- launch-ready row, no application-role grant exists to make a test reach
-- PUBLISHED: a verifier may only simulate an affirmative gate by replacing the
-- seam inside a transaction it rolls back, or restores and proves restored.
--
-- ===========================================================================
-- Canonical PUBLIC_VISIBILITY_STATE
-- ===========================================================================
--
-- Raw lifecycle is not the serving truth. `resolve_public_visibility_state_v1`
-- is the ONE derivation, and it answers PUBLICLY_VISIBLE only when the
-- Experience's current lifecycle is PUBLISHED, an immutable publication-state
-- row names a version, that version is the Experience's CURRENT version, its
-- manifest is the manifest the publication recorded, and the manifest exists.
-- Everything else - DRAFT, READY_FOR_REVIEW, a missing publication record, a
-- pointer that moved, a later reviewed non-serving lifecycle - is ONE state,
-- NOT_PUBLICLY_VISIBLE, and so is an identifier that names nothing. The
-- derivation is therefore not an existence oracle, and every I-05B consumer -
-- serving, placement, discussion, Public QANDEEL, vitality, search, lens and
-- panel - reads it rather than testing a lifecycle string for itself.
--
-- Who may VIEW is a different gate: `resolve_public_audience_admission_v1`
-- reads the frozen 0091 PUBLIC_AUDIENCE_POLICY singleton. A signed-out viewer
-- is admitted only when the signed-out policy is ALLOWED - it is UNRESOLVED,
-- so it is not - and a registered viewer is admitted when they are a real
-- account and the registered policy admits them. Visibility of the OBJECT and
-- admission of the VIEWER are composed by every serving surface and decided
-- by neither of them.
--
-- The model is forward-safe for a later reviewed disappearance / source-
-- unavailability slice: a lifecycle that is not PUBLISHED, or an additional
-- gate composed into the ONE derivation, turns every surface dark at once
-- without rewriting the immutable publication record.
--
-- ===========================================================================
-- The I-05B extension of the canonical Public lock order
-- ===========================================================================
--
--   1  public_world_state         FOR UPDATE   publish, withdraw
--   2  public_experiences         FOR UPDATE   publish, withdraw, placement,
--                                              discussion, Public QANDEEL
--                                 FOR SHARE    vitality recompute, projection rebuild
--   3  the exact manifest         FOR SHARE    publish
--   4  shared_worlds              FOR SHARE    publish   (I-04 order)
--   5  shared_world_materials     FOR SHARE    publish
--   6  shared_world_history_items FOR SHARE    publish
--   7  conversation_units         FOR SHARE    publish
--   8  the I-05A rows a primitive writes
--   9  the I-05B rows a primitive writes
--
-- Every I-05B primitive takes a PREFIX of this order and then writes ONE I-05B
-- family; no primitive reads another I-05B family under a lock it does not
-- already hold in this order, so the additions can queue but never cycle. No
-- advisory lock, table lock or process mutex exists.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- No semantic placement, discussion, Public QANDEEL, vitality or projection
-- (0096 / 0097); no lifecycle other than the ONE transition named above; no
-- disappearance, deletion or source-unavailability handling; no Launch, Safety
-- or entitlement policy; no route, controller, RPC or mobile surface; no
-- mutation of any 0091-0094 relation beyond the two I-05A rows the transition
-- itself moves. Migrations 0001-0094 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE DURABLE PUBLISH COMMAND HISTORY.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_experience_publish_commands (
    id uuid NOT NULL,
    experience_id uuid NOT NULL,
    experience_version_id uuid NOT NULL,
    manifest_version_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    effective_approval_count integer NOT NULL,
    authority_request_fingerprint text NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT public_experience_publish_commands_pk PRIMARY KEY (id),
    -- One version is published at most once.
    CONSTRAINT public_experience_publish_commands_version_key UNIQUE (experience_version_id),
    CONSTRAINT public_experience_publish_commands_count_check CHECK (effective_approval_count >= 0),
    CONSTRAINT public_experience_publish_commands_print_check
        CHECK (authority_request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT public_experience_publish_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT public_experience_publish_commands_version_fk
        FOREIGN KEY (experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT public_experience_publish_commands_manifest_fk
        FOREIGN KEY (manifest_version_id, experience_id)
        REFERENCES public.publication_package_manifest_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT public_experience_publish_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 2. THE IMMUTABLE PUBLICATION RECORD.
--
--    What exactly was published: the exact version, the exact manifest, the
--    authority fingerprint every effective approval bound at that instant, and
--    the basis on which the CW2-08 prerequisite seam answered CLEARED. One row
--    per Experience, refused UPDATE and DELETE for every role: nobody can
--    re-point a publication at another version. A later reviewed slice that
--    ends public presence composes its own state beside this record and never
--    rewrites it.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_experience_publication_state (
    experience_id uuid NOT NULL,
    published_experience_version_id uuid NOT NULL,
    published_manifest_version_id uuid NOT NULL,
    version_ordinal integer NOT NULL,
    authority_request_fingerprint text NOT NULL,
    prerequisite_clearance_basis text NOT NULL,
    publication_revision bigint NOT NULL,
    published_at timestamptz NOT NULL,
    CONSTRAINT public_experience_publication_state_pk PRIMARY KEY (experience_id),
    CONSTRAINT public_experience_publication_state_version_key UNIQUE (published_experience_version_id),
    CONSTRAINT public_experience_publication_state_ordinal_check CHECK (version_ordinal >= 1),
    CONSTRAINT public_experience_publication_state_revision_check CHECK (publication_revision > 0),
    CONSTRAINT public_experience_publication_state_print_check
        CHECK (authority_request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT public_experience_publication_state_basis_check
        CHECK (length(btrim(prerequisite_clearance_basis)) > 0 AND length(prerequisite_clearance_basis) <= 240),
    CONSTRAINT public_experience_publication_state_experience_fk
        FOREIGN KEY (experience_id) REFERENCES public.public_experiences (id) ON DELETE RESTRICT,
    CONSTRAINT public_experience_publication_state_version_fk
        FOREIGN KEY (published_experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
    -- The manifest is bound through the version relation's own (manifest,
    -- Experience) key, so the published manifest can only ever be a manifest
    -- of this exact Experience.
    CONSTRAINT public_experience_publication_state_manifest_fk
        FOREIGN KEY (published_manifest_version_id, experience_id)
        REFERENCES public.public_experience_versions (package_manifest_version_id, experience_id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.public_experience_publication_state IS
  'The immutable record of what one Public Experience published: the exact '
  'version and manifest, the authority fingerprint every effective approval '
  'bound, and the basis on which the CW2-08 prerequisite seam cleared it. It is '
  'not by itself the serving truth: resolve_public_visibility_state_v1 is.';

CREATE FUNCTION public.reject_public_publication_state_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'PUBLIC_PUBLICATION_STATE_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='The record of what a Public Experience published is append-only: UPDATE and DELETE are refused for every role, including the table owner.';
END$$;

ALTER FUNCTION public.reject_public_publication_state_mutation_v1() OWNER TO postgres;

CREATE TRIGGER public_experience_publication_state_immutable
    BEFORE UPDATE OR DELETE ON public.public_experience_publication_state
    FOR EACH ROW EXECUTE FUNCTION public.reject_public_publication_state_mutation_v1();

-- ---------------------------------------------------------------------------
-- 3. THE CW2-08 PREREQUISITE SEAM.
--
--    The ONE place the publish boundary asks whether System / Safety policy,
--    the Launch Gate and commercial entitlement clear this exact publication.
--    Today the only truthful answer is NOT_EVALUATED, because no executable
--    canonical gate exists, and NOT_EVALUATED fails the publication closed. It
--    is STABLE, reads nothing, decides nothing and is executable by nobody.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_public_publication_prerequisites_v1(p_experience_id uuid, p_manifest_version_id uuid)
RETURNS TABLE(clearance text, clearance_basis text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_experience_id IS NULL OR p_manifest_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY SELECT 'NOT_EVALUATED'::text,
    'CW2-08 System / Safety policy, Launch Gate and commercial entitlement have no executable canonical runtime in this repository; publication fails closed'::text;
END$$;

ALTER FUNCTION public.resolve_public_publication_prerequisites_v1(uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 4. THE ONE CANONICAL PUBLIC_VISIBILITY_STATE.
--
--    Exactly one row for any non-null identifier, in one of two states. It
--    takes no lock: callers that need a stable answer hold the Experience row.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_public_visibility_state_v1(p_experience_id uuid)
RETURNS TABLE(experience_id uuid, visibility_state text, visible_experience_version_id uuid,
              visible_manifest_version_id uuid, visible_version_ordinal integer)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  found_version uuid;
  found_manifest uuid;
  found_ordinal integer;
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT s.published_experience_version_id, s.published_manifest_version_id, v.version_ordinal
    INTO found_version, found_manifest, found_ordinal
    FROM public.public_experiences e
    JOIN public.public_experience_publication_state s ON s.experience_id = e.id
    JOIN public.public_experience_versions v
      ON v.id = s.published_experience_version_id AND v.experience_id = e.id
    JOIN public.publication_package_manifest_versions m
      ON m.id = v.package_manifest_version_id AND m.experience_id = e.id
   WHERE e.id = p_experience_id
     AND e.current_lifecycle = 'PUBLISHED'
     AND e.current_experience_version_id = s.published_experience_version_id
     AND s.published_manifest_version_id = v.package_manifest_version_id;
  IF FOUND THEN
    RETURN QUERY SELECT p_experience_id, 'PUBLICLY_VISIBLE'::text, found_version, found_manifest, found_ordinal;
  ELSE
    RETURN QUERY SELECT p_experience_id, 'NOT_PUBLICLY_VISIBLE'::text, NULL::uuid, NULL::uuid, NULL::integer;
  END IF;
END$$;

ALTER FUNCTION public.resolve_public_visibility_state_v1(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 5. THE PUBLIC AUDIENCE ADMISSION GATE.
--
--    Who may currently VIEW Public World, from the frozen 0091 policy
--    singleton. A NULL viewer is the signed-out audience. Exactly one row.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_public_audience_admission_v1(p_viewer_user_id uuid)
RETURNS TABLE(admission text, viewer_class text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  audience_policy public.public_audience_policy_state;
BEGIN
  SELECT * INTO audience_policy FROM public.public_audience_policy_state ps WHERE ps.singleton;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_ADMITTED'::text,
      CASE WHEN p_viewer_user_id IS NULL THEN 'SIGNED_OUT' ELSE 'REGISTERED' END::text;
    RETURN;
  END IF;
  IF p_viewer_user_id IS NULL THEN
    RETURN QUERY SELECT CASE WHEN audience_policy.signed_out_viewing_policy = 'ALLOWED'
                             THEN 'ADMITTED' ELSE 'NOT_ADMITTED' END::text,
                        'SIGNED_OUT'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT CASE WHEN audience_policy.registered_viewing_policy IN ('REGISTERED_ONLY', 'REGISTERED_AND_SIGNED_OUT')
                            AND EXISTS (SELECT 1 FROM public.users us WHERE us.id = p_viewer_user_id)
                           THEN 'ADMITTED' ELSE 'NOT_ADMITTED' END::text,
                      'REGISTERED'::text;
END$$;

ALTER FUNCTION public.resolve_public_audience_admission_v1(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 6. PUBLISH: THE ONE PROTECTED TRANSITION READY_FOR_REVIEW -> PUBLISHED.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.publish_public_experience_v1(
  p_command_id uuid, p_experience_id uuid, p_experience_version_id uuid
) RETURNS TABLE(outcome text, experience_id uuid, experience_version_id uuid,
                manifest_version_id uuid, current_lifecycle text, effective_approval_count integer,
                authority_request_fingerprint text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_experience_publish_commands;
  experience public.public_experiences;
  publishing public.public_experience_versions;
  manifest public.publication_package_manifest_versions;
  derived_approvers uuid[];
  derived_count integer;
  derived_fingerprint text;
  stored uuid[];
  effective integer;
  ready_fingerprint text;
  clearance_state text;
  clearance_reason text;
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
      'QANDEEL_CWV2_PUBLIC_PUBLISH_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'experienceVersion=' || lower(p_experience_version_id::text), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock.
  SELECT * INTO committed FROM public.public_experience_publish_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id, committed.experience_version_id,
                        committed.manifest_version_id,
                        (SELECT e.current_lifecycle FROM public.public_experiences e WHERE e.id = committed.experience_id),
                        committed.effective_approval_count, committed.authority_request_fingerprint,
                        committed.committed_at;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEPS 1 AND 2.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  -- GATE 1: THE EXACT CONTROLLER, and nobody else. One bounded class for a
  -- nonexistent Experience and a non-controller alike, so a caller learns
  -- nothing about whether a guessed identifier names anything.
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                                WHERE c.experience_id = p_experience_id AND c.controller_user_id = u) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  SELECT * INTO committed FROM public.public_experience_publish_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id, committed.experience_version_id,
                        committed.manifest_version_id, experience.current_lifecycle,
                        committed.effective_approval_count, committed.authority_request_fingerprint,
                        committed.committed_at;
    RETURN;
  END IF;

  -- GATE 2: LIFECYCLE ELIGIBILITY. READY_FOR_REVIEW and nothing else: DRAFT
  -- never jumps, and an Experience that already published does not publish
  -- again through a different command.
  IF experience.current_lifecycle <> 'READY_FOR_REVIEW' THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID' USING ERRCODE='55000';
  END IF;

  -- GATE 3: THE EXACT IMMUTABLE VERSION - of this Experience, CURRENT, and the
  -- one the canonical READY transition committed.
  SELECT * INTO publishing FROM public.public_experience_versions v
   WHERE v.id = p_experience_version_id AND v.experience_id = p_experience_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF experience.current_experience_version_id IS DISTINCT FROM p_experience_version_id THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;
  SELECT r.authority_request_fingerprint INTO ready_fingerprint
    FROM public.public_experience_review_ready_commands r
   WHERE r.experience_id = p_experience_id AND r.experience_version_id = p_experience_version_id;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.public_experience_lifecycle_events le
     WHERE le.experience_id = p_experience_id AND le.experience_version_id = p_experience_version_id
       AND le.to_lifecycle = 'READY_FOR_REVIEW') THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- GATE 4 / CANONICAL LOCK ORDER, STEP 3: the exact manifest, FOR SHARE.
  SELECT * INTO manifest FROM public.publication_package_manifest_versions m
   WHERE m.id = publishing.package_manifest_version_id FOR SHARE;
  IF NOT FOUND OR manifest.experience_id <> p_experience_id THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- GATE 5 / CANONICAL LOCK ORDER, STEPS 4-7: the exact source rows, in the
  -- SAME relative order every I-04 mutation uses - the Shared World row first,
  -- then materials by id, then history items by id, then the Personal units.
  PERFORM 1 FROM public.shared_worlds w
    WHERE w.id IN (SELECT p.shared_world_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD')
    ORDER BY w.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_materials m
    WHERE m.id IN (SELECT p.shared_material_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD')
    ORDER BY m.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id IN (SELECT p.shared_history_item_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD')
    ORDER BY i.id FOR SHARE;
  PERFORM 1 FROM public.conversation_units cu
    WHERE cu.id IN (SELECT p.personal_conversation_unit_id FROM public.publication_package_item_provenance p
                     WHERE p.manifest_version_id = manifest.id AND p.source_class = 'MY_WORLD')
    ORDER BY cu.id FOR SHARE;

  -- GATE 6: CURRENT SOURCE ACCESS FOR THE PUBLISHING HUMAN. A Shared item the
  -- publisher may no longer SEE - they left, were removed, the World closed
  -- around an entitlement that excludes it - refuses with the SAME class a
  -- nonexistent source gets. The question is answered by the canonical I-04F
  -- entry point, never re-derived here. The Personal adapter is owner-exact.
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
     WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD'
       AND NOT EXISTS (
         SELECT 1 FROM public.resolve_shared_world_history_visibility_v1(p.shared_world_id, u) v
          WHERE v.history_item_id = p.shared_history_item_id)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
     WHERE p.manifest_version_id = manifest.id AND p.source_class = 'MY_WORLD'
       AND p.personal_owner_user_id <> u
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  -- GATE 7 / 8: THE ONE I-05A AUTHORITY DERIVATION, from current state. It
  -- raises on an unavailable source, an unresolved authority and contradictory
  -- metadata; the stored required set must still be the derived one.
  SELECT d.required_approvers, d.required_approver_count, d.authority_fingerprint
    INTO derived_approvers, derived_count, derived_fingerprint
    FROM public.derive_public_publication_authority_v1(manifest.id) d;
  SELECT coalesce(array_agg(ra.approver_user_id ORDER BY ra.approver_user_id), ARRAY[]::uuid[])
    INTO stored FROM public.publication_manifest_required_approvers ra
   WHERE ra.manifest_version_id = manifest.id;
  IF stored <> derived_approvers THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;

  -- GATE 9: EVERY REQUIRED APPROVAL IS CURRENTLY EFFECTIVE, through the ONE
  -- 0094 derivation. Historical rows are never counted: a required approval
  -- that was never given is MISSING, one taken back is WITHDRAWN, one bound to
  -- a package this Experience no longer carries is SUPERSEDED, and one bound
  -- to a different fingerprint is stale. Each refuses. A controller cannot
  -- substitute for any of them.
  IF EXISTS (SELECT 1 FROM public.derive_publication_manifest_effective_approvals_v1(manifest.id) s
              WHERE s.effective_state = 'MISSING') THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_APPROVALS_INCOMPLETE' USING ERRCODE='P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.derive_publication_manifest_effective_approvals_v1(manifest.id) s
              WHERE s.effective_state <> 'EFFECTIVE') THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_APPROVAL_NOT_EFFECTIVE' USING ERRCODE='55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.derive_publication_manifest_effective_approvals_v1(manifest.id) s
              WHERE s.bound_authority_fingerprint IS DISTINCT FROM derived_fingerprint) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;
  SELECT count(*)::integer INTO effective
    FROM public.derive_publication_manifest_effective_approvals_v1(manifest.id) s;
  IF effective <> derived_count THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- GATE 10: THE READY SNAPSHOT IS NOT TRUSTED. Its recorded fingerprint must
  -- still be the current one; anything that moved since is stale.
  IF ready_fingerprint IS DISTINCT FROM derived_fingerprint THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;

  -- GATE 11, LAST: THE FROZEN CW2-08 PREREQUISITE, through the seam. Exactly
  -- CLEARED with a stated basis publishes; NOT_EVALUATED and anything else
  -- fails closed.
  SELECT c.clearance, c.clearance_basis INTO clearance_state, clearance_reason
    FROM public.resolve_public_publication_prerequisites_v1(p_experience_id, manifest.id) c;
  IF clearance_state IS DISTINCT FROM 'CLEARED'
     OR clearance_reason IS NULL OR length(btrim(clearance_reason)) = 0 THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LAUNCH_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000';
  END IF;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of the publication.
  instant := clock_timestamp();

  UPDATE public.public_experiences e
     SET current_lifecycle = 'PUBLISHED', experience_revision = e.experience_revision + 1
   WHERE e.id = p_experience_id;

  INSERT INTO public.public_experience_publication_state
    (experience_id, published_experience_version_id, published_manifest_version_id, version_ordinal,
     authority_request_fingerprint, prerequisite_clearance_basis, publication_revision, published_at)
  VALUES (p_experience_id, p_experience_version_id, manifest.id, publishing.version_ordinal,
          derived_fingerprint, btrim(clearance_reason), 1, instant);

  BEGIN
    INSERT INTO public.public_experience_lifecycle_events
      (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
    VALUES (p_command_id, p_experience_id, p_experience_version_id, 'READY_FOR_REVIEW', 'PUBLISHED', instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  BEGIN
    INSERT INTO public.public_experience_publish_commands
      (id, experience_id, experience_version_id, manifest_version_id, actor_user_id,
       effective_approval_count, authority_request_fingerprint, request_ref, committed_at)
    VALUES (p_command_id, p_experience_id, p_experience_version_id, manifest.id, u,
            effective, derived_fingerprint, request, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'PUBLISHED'::text, p_experience_id, p_experience_version_id, manifest.id,
                      'PUBLISHED'::text, effective, derived_fingerprint, instant;
END$$;

-- ---------------------------------------------------------------------------
-- 7. THE ONE PUBLIC WORLD SERVING RESOLVER.
--
--    It composes the ONE visibility derivation with the audience admission gate
--    and returns the bounded Public derivative and allowed Public metadata of
--    the visible version, in package order. It returns ZERO ROWS for an
--    identifier that names nothing, a DRAFT, a READY_FOR_REVIEW, a publication
--    whose pointer moved, and a viewer the policy does not admit alike - one
--    answer, so it is not an existence oracle. It never reads sealed
--    provenance, and it returns no account identifier, contact endpoint, source
--    identifier, Shared World, Session or storage handle.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_public_experience_serving_v1(p_experience_id uuid, p_viewer_user_id uuid)
RETURNS TABLE(experience_id uuid, experience_version_id uuid, version_ordinal integer,
              publisher_public_identity_ref uuid, publisher_label_mode text, publisher_display_label text,
              published_at timestamptz, package_item_id uuid, item_ordinal integer,
              derivative_classification text, public_body_form text, public_text_body text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT vs.experience_id, vs.visible_experience_version_id, vs.visible_version_ordinal,
         m.publisher_public_identity_ref, d.label_mode, d.display_label, s.published_at,
         it.package_item_id, it.item_ordinal, it.derivative_classification, it.public_body_form,
         b.public_text_body
    FROM public.resolve_public_visibility_state_v1(p_experience_id) vs
    JOIN public.resolve_public_audience_admission_v1(p_viewer_user_id) ad ON ad.admission = 'ADMITTED'
    JOIN public.public_experience_publication_state s ON s.experience_id = vs.experience_id
    JOIN public.publication_package_manifest_versions m ON m.id = vs.visible_manifest_version_id
    JOIN public.public_identity_display_state d ON d.public_identity_ref = m.publisher_public_identity_ref
    JOIN public.publication_package_manifest_items it ON it.manifest_version_id = m.id
    JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
   WHERE vs.visibility_state = 'PUBLICLY_VISIBLE'
   ORDER BY it.item_ordinal;
END$$;

-- ---------------------------------------------------------------------------
-- 8. SECURITY POSTURE.
--
--    The publish boundary, the visibility derivation, the admission gate and
--    the prerequisite seam are internal: postgres-owned, SECURITY DEFINER,
--    search_path-pinned and executable by no application role. The ONE serving
--    resolver is service_role-executable alone, the frozen narrow read-boundary
--    precedent of 0077 / 0079 / 0080 / 0087 / 0089 / 0093: it is read-only,
--    anti-oracle, bounded to Public derivative data, and it enforces the
--    audience policy itself - so opening it to the service tier is not a
--    launch decision, and no direct table privilege exists behind it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.public_experience_publish_commands OWNER TO postgres;
ALTER TABLE public.public_experience_publication_state OWNER TO postgres;
ALTER TABLE public.public_experience_publish_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_experience_publication_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_experience_publish_commands,
                    public.public_experience_publication_state
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.public_experience_publish_commands, public.public_experience_publication_state FROM service_role';
END IF;END$$;

ALTER FUNCTION public.resolve_public_publication_prerequisites_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_public_visibility_state_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_public_audience_admission_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.publish_public_experience_v1(uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_public_experience_serving_v1(uuid, uuid) OWNER TO postgres;

DO $$
DECLARE
  internal text[] := ARRAY[
    'public.reject_public_publication_state_mutation_v1()',
    'public.resolve_public_publication_prerequisites_v1(uuid, uuid)',
    'public.resolve_public_visibility_state_v1(uuid)',
    'public.resolve_public_audience_admission_v1(uuid)',
    'public.publish_public_experience_v1(uuid, uuid, uuid)'];
  resolver text := 'public.resolve_public_experience_serving_v1(uuid, uuid)';
  fn text;
BEGIN
  FOREACH fn IN ARRAY internal LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);
    END IF;
  END LOOP;
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', resolver);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', resolver);
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 9. SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  internal text[] := ARRAY[
    'public.resolve_public_publication_prerequisites_v1(uuid, uuid)',
    'public.resolve_public_visibility_state_v1(uuid)',
    'public.resolve_public_audience_admission_v1(uuid)',
    'public.publish_public_experience_v1(uuid, uuid, uuid)'];
  reading text[] := ARRAY[
    'public.resolve_public_publication_prerequisites_v1(uuid, uuid)',
    'public.resolve_public_visibility_state_v1(uuid)',
    'public.resolve_public_audience_admission_v1(uuid)'];
  publisher text := 'public.publish_public_experience_v1(uuid, uuid, uuid)';
  seam text := 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)';
  visibility text := 'public.resolve_public_visibility_state_v1(uuid)';
  resolver text := 'public.resolve_public_experience_serving_v1(uuid, uuid)';
  own_tables text[] := ARRAY['public_experience_publish_commands', 'public_experience_publication_state'];
  fn text;
  t text;
  role_name text;
  p record;
BEGIN
  -- EVERY INTERNAL FUNCTION IS POSTGRES-OWNED, SECURITY DEFINER, search_path
  -- PINNED, AND EXECUTABLE BY NO APPLICATION ROLE.
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
  FOREACH fn IN ARRAY reading LOOP
    SELECT pr.provolatile, pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-05B: derivation % must be STABLE', fn; END IF;
    IF p.prosrc ~ 'INSERT INTO' OR p.prosrc ~ 'UPDATE public' OR p.prosrc ~ 'DELETE FROM' THEN
      RAISE EXCEPTION 'I-05B: derivation % must write nothing', fn;
    END IF;
  END LOOP;
  IF (SELECT pr.provolatile FROM pg_proc pr WHERE pr.oid = publisher::regprocedure) <> 'v' THEN
    RAISE EXCEPTION 'I-05B: consequential primitive % must be VOLATILE', publisher;
  END IF;

  -- THE PREREQUISITE SEAM FAILS CLOSED. It answers NOT_EVALUATED and can never
  -- answer CLEARED on its own: no permissive constant, no launch-ready row.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = seam::regprocedure;
  IF p.prosrc !~ 'NOT_EVALUATED' OR p.prosrc ~ '''CLEARED''' THEN
    RAISE EXCEPTION 'I-05B: the CW2-08 prerequisite seam must answer NOT_EVALUATED and never CLEARED until the canonical gate exists';
  END IF;
  IF p.prosrc ~ 'public_audience_policy_state' OR p.prosrc ~ 'INSERT INTO' THEN
    RAISE EXCEPTION 'I-05B: the prerequisite seam decides nothing and reads no viewing policy';
  END IF;

  -- THE PUBLISH BOUNDARY REVALIDATES EVERYTHING FRESHLY, AND ITS LAST GATE IS
  -- THE PREREQUISITE SEAM. The needles are plain literals: a PostgreSQL
  -- regular expression matches `.` across newlines.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = publisher::regprocedure;
  IF p.prosrc !~ 'auth\.uid\(\)' THEN
    RAISE EXCEPTION 'I-05B: publication derives the publishing human from auth.uid()';
  END IF;
  IF p.prosrc !~ 'FROM public\.public_world_state w WHERE w\.singleton FOR UPDATE'
     OR p.prosrc !~ 'FROM public\.public_experiences e WHERE e\.id = p_experience_id FOR UPDATE'
     OR p.prosrc !~ 'FROM public\.shared_worlds w'
     OR p.prosrc !~ 'ORDER BY m\.id FOR SHARE' OR p.prosrc !~ 'ORDER BY i\.id FOR SHARE'
     OR p.prosrc !~ 'ORDER BY cu\.id FOR SHARE' THEN
    RAISE EXCEPTION 'I-05B: publication must take the canonical Public lock order and the frozen I-04 source order';
  END IF;
  IF p.prosrc !~ 'public_experience_controllers' THEN
    RAISE EXCEPTION 'I-05B: publication requires the exact Experience controller';
  END IF;
  IF p.prosrc !~ 'current_lifecycle <> ''READY_FOR_REVIEW''' THEN
    RAISE EXCEPTION 'I-05B: publication must require READY_FOR_REVIEW and refuse every other lifecycle';
  END IF;
  IF p.prosrc !~ 'public_experience_review_ready_commands' THEN
    RAISE EXCEPTION 'I-05B: publication must bind the exact version the canonical READY transition committed';
  END IF;
  IF p.prosrc !~ 'resolve_shared_world_history_visibility_v1' THEN
    RAISE EXCEPTION 'I-05B: publication must prove the publishing human may currently SEE each included Shared source through the canonical I-04F entry point';
  END IF;
  IF p.prosrc !~ 'derive_public_publication_authority_v1' THEN
    RAISE EXCEPTION 'I-05B: publication must revalidate the exact rightsholder set and fingerprint through the ONE I-05A derivation';
  END IF;
  IF p.prosrc !~ 'derive_publication_manifest_effective_approvals_v1'
     OR p.prosrc !~ '''MISSING''' OR p.prosrc !~ '<> ''EFFECTIVE''' THEN
    RAISE EXCEPTION 'I-05B: publication must require every required approval to be currently EFFECTIVE through the ONE 0094 derivation';
  END IF;
  IF p.prosrc !~ 'ready_fingerprint IS DISTINCT FROM derived_fingerprint' THEN
    RAISE EXCEPTION 'I-05B: publication must refuse a stale READY snapshot rather than trust it';
  END IF;
  IF p.prosrc !~ 'resolve_public_publication_prerequisites_v1'
     OR p.prosrc !~ 'clearance_state IS DISTINCT FROM ''CLEARED''' THEN
    RAISE EXCEPTION 'I-05B: publication must consume the CW2-08 prerequisite seam and require exactly CLEARED';
  END IF;
  IF p.prosrc !~ 'current_lifecycle = ''PUBLISHED''' THEN
    RAISE EXCEPTION 'I-05B: the publish boundary must write exactly PUBLISHED';
  END IF;
  IF p.prosrc ~ 'ABSENT_FROM_PUBLIC_WORLD' THEN
    RAISE EXCEPTION 'I-05B: the publish boundary owns no disappearance lifecycle';
  END IF;
  IF p.prosrc ~ 'PREPARE_PUBLICATION' THEN
    RAISE EXCEPTION 'I-05B: a preparation command is never publication consent';
  END IF;
  IF p.prosrc ~* 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
    RAISE EXCEPTION 'I-05B: % accepts no clock but one read of the database clock', publisher;
  END IF;
  IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' OR p.prosrc ~* 'TRUNCATE' THEN
    RAISE EXCEPTION 'I-05B: % locks rows in the canonical order and truncates nothing', publisher;
  END IF;
  IF p.prosrc ~ '(INSERT INTO|UPDATE|DELETE FROM) public\.(shared_world|conversation_|users|memories|hypothes|standing_context|matching_|introduction|publication_manifest_approvals|publication_manifest_required_approvers|public_experience_controllers|publication_package)' THEN
    RAISE EXCEPTION 'I-05B: publication must mutate no source, no approval evidence, no control and no package';
  END IF;
  IF p.prosrc ~ 'shared_world_membership_episodes' OR p.prosrc ~ 'shared_world_history_access_grants'
     OR p.prosrc ~ 'shared_world_standard_closed_view_entitlements'
     OR p.prosrc ~ 'shared_world_history_package_manifest_items' THEN
    RAISE EXCEPTION 'I-05B: publication must not re-implement Shared membership or history authorization: consume the canonical I-04F visibility entry point';
  END IF;
  -- NO FUNCTION ACCEPTS AN AUTHORITY, APPROVER, AUDIENCE, VISIBILITY, CLEARANCE
  -- OR INSTANT PARAMETER. Declared INPUT names only (mode 'i').
  FOREACH fn IN ARRAY ARRAY[publisher, seam, visibility] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 'i'
         AND arg.name ~ '(approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|clear|launch|safety|entitle|allow|effective|fingerprint)'
    ) THEN
      RAISE EXCEPTION 'I-05B: % may not accept an authority audience visibility clearance or instant parameter', fn;
    END IF;
  END LOOP;

  -- THE ONE VISIBILITY DERIVATION requires PUBLISHED, the immutable publication
  -- record, and the CURRENT version pointer together; it reads no viewing
  -- policy, because the object's visibility and the viewer's admission are
  -- different gates.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = visibility::regprocedure;
  IF p.prosrc !~ 'current_lifecycle = ''PUBLISHED''' OR p.prosrc !~ 'public_experience_publication_state'
     OR p.prosrc !~ 'current_experience_version_id = s\.published_experience_version_id'
     OR p.prosrc !~ 'NOT_PUBLICLY_VISIBLE' THEN
    RAISE EXCEPTION 'I-05B: the canonical visibility derivation must require PUBLISHED and a consistent immutable publication record, and fail closed to NOT_PUBLICLY_VISIBLE';
  END IF;
  IF p.prosrc ~ 'public_audience_policy_state' THEN
    RAISE EXCEPTION 'I-05B: object visibility and viewer admission are different gates';
  END IF;

  -- THE ONE SERVING RESOLVER IS STABLE, service_role-ONLY, CONSUMES BOTH GATES,
  -- READS NO SEALED PROVENANCE AND DISCLOSES NO PRIVATE IDENTITY.
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc
    INTO p FROM pg_proc pr WHERE pr.oid = resolver::regprocedure;
  IF NOT p.prosecdef OR p.provolatile <> 's'
     OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-05B: the serving resolver must be a STABLE SECURITY DEFINER with an empty search_path';
  END IF;
  IF has_function_privilege('public', resolver, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-05B: the serving resolver must not be executable by PUBLIC';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name)
       AND has_function_privilege(role_name, resolver, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-05B: the serving resolver must not be executable by %', role_name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role', resolver, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-05B: service_role must execute the ONE serving resolver';
  END IF;
  IF p.prosrc !~ 'resolve_public_visibility_state_v1' OR p.prosrc !~ 'resolve_public_audience_admission_v1'
     OR p.prosrc !~ 'visibility_state = ''PUBLICLY_VISIBLE''' OR p.prosrc !~ 'admission = ''ADMITTED''' THEN
    RAISE EXCEPTION 'I-05B: the serving resolver must consume the canonical visibility state and the audience admission gate';
  END IF;
  IF p.prosrc ~ 'publication_package_item_provenance' OR p.prosrc ~ 'current_lifecycle' THEN
    RAISE EXCEPTION 'I-05B: the serving resolver must never read sealed provenance and never test a lifecycle for itself';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc pr,
      unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
     WHERE pr.oid = resolver::regprocedure AND arg.mode = 't'
       AND arg.name ~ '(user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material_id|history_item|availability|context_ref|world_id|provenance|digest|fingerprint)'
  ) THEN
    RAISE EXCEPTION 'I-05B: the serving resolver must disclose no private identity and no sealed provenance';
  END IF;

  -- THE PUBLICATION RECORD IS IMMUTABLE, BOUND TO A VERSION OF ITS OWN
  -- EXPERIENCE, AND CARRIES NO DECISION COLUMN OF ITS OWN.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.public_experience_publication_state'::regclass
                    AND tg.tgname = 'public_experience_publication_state_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05B: the publication record must be append-only for every role';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.public_experience_publication_state'::regclass
       AND c.conname = 'public_experience_publication_state_version_fk'
       AND c.confrelid = 'public.public_experience_versions'::regclass AND c.confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'I-05B: the publication record must bind the exact version of its own Experience by restrictive foreign key';
  END IF;
  FOREACH t IN ARRAY own_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(safety|moderation|launch|entitlement|premium|feature_flag|allow|visib|semantic|placement|vitality|discussion|reply|session|turn|conversation_unit|world_id|shared_|material_id|history_item|email|phone|contact|credential)'
    ) THEN
      RAISE EXCEPTION 'I-05B: relation % may carry no Safety Launch entitlement visibility serving or source column', t;
    END IF;
  END LOOP;

  -- THE FROZEN BOUNDARIES THIS SLICE CONSUMES MUST STILL BE INTACT.
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role',
       'public.resolve_shared_world_history_visibility_v1(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I-05B: the frozen I-04F history visibility entry point must still be reachable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.publication_manifest_approvals'::regclass
                    AND tg.tgname = 'publication_manifest_approvals_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05B: the frozen 0092 approval evidence must still be append-only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.public_experience_lifecycle_events'::regclass
                    AND tg.tgname = 'public_experience_lifecycle_events_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05B: the frozen 0091 lifecycle truth must still be append-only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.public_audience_policy_state ps
                  WHERE ps.singleton AND ps.signed_out_viewing_policy = 'UNRESOLVED') THEN
    RAISE EXCEPTION 'I-05B: the frozen CW2-08 signed-out viewing requirement must remain UNRESOLVED';
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
