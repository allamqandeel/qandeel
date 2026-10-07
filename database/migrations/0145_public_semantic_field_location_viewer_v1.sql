-- S5-03B — Public Semantic Field + Stable Spatial Placement + Viewer Runtime v1.
--
-- Forward-only. No historical migration is edited and no frozen function is replaced. S5-03A ends at a reviewed
-- semantic interpretation of the exact current Experience Version (SEMANTICALLY_READY, derived). This migration adds the
-- two things the Public World still lacks before it can be a World and not a feed:
--
--   1. a STABLE SPATIAL PLACEMENT: canonical world coordinates for ONE exact Experience Version under ONE exact reviewed
--      S5-03A semantic revision, committed once and never moved;
--   2. the PUBLIC VIEWER READ BOUNDARY over the semantic field: the field, search and the contextual panel, each composed
--      from viewer admission + canonical PUBLIC_VISIBILITY_STATE + the exact visible version + its current reviewed
--      S5-03A interpretation + its current valid spatial placement.
--
-- The lifecycle stays where it is. Nothing here publishes; PUBLISHED stays unreachable and the CW2-08 seam still answers
-- NOT_EVALUATED. Production may legitimately read an EMPTY field: nothing is public yet, and nothing stands in for it.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- What is CONSUMED, unchanged
-- ---------------------------------------------------------------------------------------------------------------------
--   * I-05: the Experience / version / immutable package (0091 / 0092); the ONE visibility derivation
--     `resolve_public_visibility_state_v1` as 0098 closed it (continuing eligibility); the audience admission gate
--     `resolve_public_audience_admission_v1`; the ONE serving resolver `resolve_public_experience_serving_v1` (0095);
--     the frozen current-placement derivation `derive_public_experience_current_placement_v1` (0096) — for the CURRENT
--     REVISION'S IDENTITY ONLY; the derived vitality counts (0097); the display state, joined at read time (D12).
--   * S5-02: package wholeness `public_authoring_private.public_package_state_v1`; the actor gate.
--   * S5-03A: `public_semantic_private.derive_public_semantic_readiness_v1` (the ONE readiness boundary it names for this
--     task), the package fingerprint, the package lock, and the reviewed content in `semantic_interpretations` /
--     `semantic_reviews` — READ, never written.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- The 0096 / 0097 reconciliation (S5-03A gap G18)
-- ---------------------------------------------------------------------------------------------------------------------
-- S5-03A fills the immutable 0096 descriptor with two content-free constants (lens `s5-03a.private`, label
-- `S5-03A_PRIVATE_SEMANTIC_INTERPRETATION_V1`); the reviewed meaning, themes and lens key live in the erasable S5-03A
-- row. The frozen I-05 readers that serve that descriptor — `resolve_public_experience_semantic_placement_v1`,
-- `search_public_experiences_v1`, `resolve_public_lens_v1`, `resolve_public_panel_v1` and the 0097 projection whose
-- search document embeds the label — therefore no longer describe Product meaning. They are NOT changed (frozen history)
-- and NOT used by the Product: this boundary is ADDITIVE. It reads the current 0096 revision's IDENTITY and nothing of its
-- descriptor, and takes meaning, themes and the semantic region (the reviewed lens key) from S5-03A. It composes the frozen
-- search FOUNDATION — the `simple` configuration, `plainto_tsquery`, query-only relevance, the visibility + admission
-- composition and the exact-version guard — over a document built at read time from the reviewed meaning, themes and the
-- visible public bodies. That document is stored nowhere: it can neither go stale nor outlive an erasure.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- Stable geography (CW2-04 §14, §15, §17, D16, D17, D27)
-- ---------------------------------------------------------------------------------------------------------------------
--   * A placement binds the exact Experience Version AND the exact reviewed S5-03A revision (the 0096 placement id), by
--     foreign keys; one placement per (version, revision), ever. A retry, a second request, or a later layout model asking
--     again reads the committed coordinates back: nothing recomputes or moves them (`ALREADY_PLACED`).
--   * A new current revision (a correction) makes the old placement STALE simply by no longer being current: it is never
--     moved, mutated or deleted, and it is never served; the new revision receives its own placement. A new Experience
--     Version receives its own interpretation and its own placement: nothing is inherited across versions.
--   * Coordinates are canonical World state of the PUBLIC World, in its own coordinate space `QANDEEL_PUBLIC_FIELD_V1`:
--     exact signed integers within [-(2^62), 2^62 - 1] — the same exact-integer bound the Map's world math uses, so the
--     mobile field projects them exactly, but never the Personal World's Home scheme: the Public field is another World
--     and the Personal Home substrate stays the sole owner of its own. Screen coordinates are presentation, never stored.
--   * Nothing but meaning reaches the placer (below). Popularity, views, discussion, vitality, age, controversy, the
--     publication instant, the alias and the account never touch a coordinate: no function here writes one from them,
--     and both relations are append-only for every role.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- The placer boundary (provider-neutral; Stage 8A owns the provider)
-- ---------------------------------------------------------------------------------------------------------------------
-- The coordinates come from the API's provider-neutral `PublicSpatialPlacer`, through the server channel only. Its whole
-- input is served by ONE function, `read_public_spatial_placement_input_v1`: the reviewed meaning, main and other themes,
-- semantic region and the exact revision identity — read from the S5-03A row and nothing else (no package text, no
-- Personal or Shared truth, no account, no alias, no vitality). A client can supply no coordinate, region, rank, neighbour,
-- distance, model version or readiness: the owner can only REQUEST that the place be prepared; what QANDEEL placed
-- arrives only through `commit_public_spatial_placement_v1`, executable by the server channel alone.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- MATERIAL / REASONING (CW2-02 §27, S5-02 R1, S5-03A R1)
-- ---------------------------------------------------------------------------------------------------------------------
-- The two relations store identities, instants, a contract name, a layout version and two integers. No package text, no
-- meaning, no theme, no explanation, no lens key and no display label is copied here: whatever a reader needs is joined
-- from the authoritative S5-03A row at read time. Coordinates reasoned FROM a meaning are geometry — REASONING state, not
-- content-bearing material — so no new MATERIAL_DEPENDENCY is created and nothing here needs an erasure path. What erasure
-- must do, it does by construction: when ASSURE-F05 erases a package item, S5-03A NULLs the interpretation's content and
-- fingerprint in the same transaction, and every derivation here requires a whole package, a matching fingerprint and
-- unerased reviewed content — so spatial readiness, the field, search and the panel go dark at that instant, with no
-- write of their own. No text is inspected and no threshold is applied.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- The viewer (CW2-04 §27, §28, D28, D29, D30; CW2-07 §24)
-- ---------------------------------------------------------------------------------------------------------------------
-- The viewer is `auth.uid()`, never a parameter, admitted by the frozen audience gate as a REGISTERED viewer (signed-out
-- viewing stays closed: the policy is untouched). Every read re-derives, per Experience, at read time: PUBLICLY_VISIBLE
-- (0098), the visible version, a whole package, the CURRENT 0096 revision of that version, its unerased S5-03A content
-- and review bound to the exact package fingerprint, and the placement of exactly that version and revision. Anything
-- else — a Draft, READY_FOR_REVIEW, a stale revision, a wrong version, an erased package, a withdrawn approval, a guessed
-- id, an unadmitted viewer — is the same answer: nothing. No public tombstone, no existence oracle.
--
-- Lock order: the owner request and the server commit take the exact Experience row FOR UPDATE, then the current
-- package's items FOR SHARE (the S5-03A discipline), then write their own family only. Viewer reads take no lock.

BEGIN;

-- =====================================================================================================================
-- A. THE PRIVATE SCHEMA AND ITS TWO APPEND-ONLY RELATIONS. No column names an account and no foreign key reaches one
--    directly. They are NOT outside QAN-BL-ACCT-01: both bind an Experience Version and an S5-03A interpretation (which
--    binds a 0096 placement and, through it, its recorder's account), ON DELETE RESTRICT — edges of the open blocker.
-- =====================================================================================================================
CREATE SCHEMA public_spatial_private;
REVOKE ALL ON SCHEMA public_spatial_private FROM PUBLIC;

-- A.1 One owner request to prepare the place of ONE exact version under ONE exact reviewed revision. Identities and an
--     instant only: no actor column, no content.
CREATE TABLE public_spatial_private.spatial_requests (
    id uuid NOT NULL,
    experience_id uuid NOT NULL,
    experience_version_id uuid NOT NULL,
    interpretation_id uuid NOT NULL,
    requested_at timestamptz NOT NULL,
    CONSTRAINT spatial_requests_pk PRIMARY KEY (id),
    CONSTRAINT spatial_requests_target_key UNIQUE (id, experience_version_id, interpretation_id),
    CONSTRAINT spatial_requests_version_fk
        FOREIGN KEY (experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT spatial_requests_interpretation_fk
        FOREIGN KEY (interpretation_id)
        REFERENCES public_semantic_private.semantic_interpretations (placement_id) ON DELETE RESTRICT
);
CREATE INDEX spatial_requests_target_idx
    ON public_spatial_private.spatial_requests (experience_version_id, interpretation_id, requested_at);

COMMENT ON TABLE public_spatial_private.spatial_requests IS
  'S5-03B: the exact controller''s request that QANDEEL prepare the stable Public location of ONE exact Experience '
  'Version under ONE exact reviewed S5-03A revision. Identities and an instant only. Append-only. No account.';

-- A.2 THE STABLE SPATIAL PLACEMENT. Canonical Public field coordinates (`QANDEEL_PUBLIC_FIELD_V1`, exact integers) of one
--     exact version under one exact reviewed revision, committed once. No text of any kind.
CREATE TABLE public_spatial_private.spatial_placements (
    id uuid NOT NULL,
    experience_id uuid NOT NULL,
    experience_version_id uuid NOT NULL,
    interpretation_id uuid NOT NULL,
    request_id uuid NOT NULL,
    spatial_contract text NOT NULL,
    layout_version text NOT NULL,
    coordinate_scheme text NOT NULL,
    world_x bigint NOT NULL,
    world_y bigint NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT spatial_placements_pk PRIMARY KEY (id),
    -- ONE placement per exact version and exact revision, ever: a model upgrade cannot write a second one.
    CONSTRAINT spatial_placements_target_key UNIQUE (experience_version_id, interpretation_id),
    CONSTRAINT spatial_placements_contract_check CHECK (spatial_contract = 'PUBLIC_SPATIAL_PLACEMENT_V1'),
    CONSTRAINT spatial_placements_layout_check CHECK (layout_version ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'),
    CONSTRAINT spatial_placements_scheme_check CHECK (coordinate_scheme = 'QANDEEL_PUBLIC_FIELD_V1'),
    CONSTRAINT spatial_placements_bound_check CHECK (
      world_x BETWEEN -4611686018427387904 AND 4611686018427387903
      AND world_y BETWEEN -4611686018427387904 AND 4611686018427387903),
    CONSTRAINT spatial_placements_version_fk
        FOREIGN KEY (experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT spatial_placements_interpretation_fk
        FOREIGN KEY (interpretation_id)
        REFERENCES public_semantic_private.semantic_interpretations (placement_id) ON DELETE RESTRICT,
    -- The placement answers exactly the request it was made for: same version, same revision.
    CONSTRAINT spatial_placements_request_fk
        FOREIGN KEY (request_id, experience_version_id, interpretation_id)
        REFERENCES public_spatial_private.spatial_requests (id, experience_version_id, interpretation_id) ON DELETE RESTRICT
);
CREATE INDEX spatial_placements_field_idx ON public_spatial_private.spatial_placements (world_x, world_y);
CREATE INDEX spatial_placements_experience_idx ON public_spatial_private.spatial_placements (experience_id, experience_version_id);

COMMENT ON TABLE public_spatial_private.spatial_placements IS
  'S5-03B: the stable Public location of ONE exact Experience Version under ONE exact reviewed S5-03A semantic revision — '
  'the Public field''s own canonical coordinates (QANDEEL_PUBLIC_FIELD_V1), the spatial contract and the layout version, '
  'committed once and never moved. '
  'No meaning, theme, lens, label or package text is copied here. Append-only for every role. No account.';

-- A.3 Append-only for every role, the owner included; and an inserted row names a revision OF ITS OWN version (the
--     S5-03A key is the revision id alone, so the version binding is proven here, from canonical truth).
CREATE FUNCTION public_spatial_private.reject_spatial_history_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM public_semantic_private.semantic_interpretations i
                                    WHERE i.placement_id = NEW.interpretation_id
                                      AND i.experience_version_id = NEW.experience_version_id
                                      AND i.experience_id = NEW.experience_id) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'PUBLIC_SPATIAL_HISTORY_IS_IMMUTABLE'
    USING ERRCODE = '55000',
          DETAIL = 'Spatial requests and placements are append-only for every role, and bind a semantic revision of their '
                   'own exact Experience Version. A new revision or version receives its own placement; none is moved.';
END$$;

CREATE TRIGGER spatial_requests_immutable BEFORE INSERT OR UPDATE OR DELETE ON public_spatial_private.spatial_requests
    FOR EACH ROW EXECUTE FUNCTION public_spatial_private.reject_spatial_history_mutation_v1();
CREATE TRIGGER spatial_placements_immutable BEFORE INSERT OR UPDATE OR DELETE ON public_spatial_private.spatial_placements
    FOR EACH ROW EXECUTE FUNCTION public_spatial_private.reject_spatial_history_mutation_v1();

-- =====================================================================================================================
-- B. INTERNAL DERIVATIONS. Executable by no application role.
-- =====================================================================================================================

-- B.1 Deterministic identities: an equivalent retry names the same rows; no caller supplies one.
CREATE FUNCTION public_spatial_private.derive_spatial_identity_v1(p_namespace text, p_first uuid, p_second uuid)
RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 3) || substr(h, 21, 12))::uuid
    FROM (SELECT encode(sha256(convert_to('QANDEEL_S5_03B_PUBLIC_SPATIAL_IDENTITY_V1' || E'\n' || p_namespace || E'\n'
                                          || lower(p_first::text) || E'\n' || lower(p_second::text), 'UTF8')), 'hex') AS h) d;
$$;

-- B.2 THE REVIEWED INTERPRETATION OF ONE EXACT VERSION, at any lifecycle: the CURRENT (highest) 0096 revision of that
--     version, with its S5-03A content unerased and reviewed, both bound to the fingerprint of that version's package as
--     it is NOW, and the package whole. Zero rows otherwise. Only the revision IDENTITY is taken from 0096; meaning,
--     themes and the semantic region come from S5-03A.
CREATE FUNCTION public_spatial_private.derive_reviewed_interpretation_v1(p_experience_version_id uuid)
RETURNS TABLE (interpretation_id uuid, meaning text, primary_themes text[], secondary_themes text[], semantic_region text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_manifest uuid;
  v_fingerprint text;
  v_current uuid;
BEGIN
  IF p_experience_version_id IS NULL THEN
    RETURN;
  END IF;
  SELECT v.package_manifest_version_id INTO v_manifest FROM public.public_experience_versions v WHERE v.id = p_experience_version_id;
  IF NOT FOUND OR public_authoring_private.public_package_state_v1(v_manifest) <> 'INTACT' THEN
    RETURN;
  END IF;
  v_fingerprint := public_semantic_private.derive_package_fingerprint_v1(v_manifest);
  IF v_fingerprint IS NULL THEN
    RETURN;
  END IF;
  SELECT cp.placement_id INTO v_current FROM public.derive_public_experience_current_placement_v1(p_experience_version_id) cp;
  IF v_current IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT i.placement_id, i.meaning, i.primary_themes, i.secondary_themes, i.lens_key
      FROM public_semantic_private.semantic_interpretations i
      JOIN public_semantic_private.semantic_reviews r ON r.placement_id = i.placement_id
     WHERE i.placement_id = v_current AND i.experience_version_id = p_experience_version_id
       AND i.content_erased_at IS NULL AND r.content_erased_at IS NULL
       AND i.package_fingerprint = v_fingerprint AND r.package_fingerprint = v_fingerprint;
END$$;

-- B.3 SPATIAL READINESS of one Experience — the boundary the future Stage-9 publication path consumes beside semantic
--     readiness and CW2-08. Derived on every call, stored nowhere, supplied by no one, fail-closed:
--     SPATIALLY_READY only when S5-03A answers SEMANTICALLY_READY for the exact current version and revision, that
--     revision is still the reviewed current one, and a placement of exactly that version and revision exists.
--     NOT_READY otherwise, with one reason: NOT_SEMANTICALLY_READY | NO_PLACEMENT.
CREATE FUNCTION public_spatial_private.derive_public_spatial_readiness_v1(p_experience_id uuid)
RETURNS TABLE (readiness text, reason text, experience_version_id uuid, interpretation_id uuid, spatial_placement_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s record;
  v_reviewed uuid;
  v_placement uuid;
BEGIN
  SELECT * INTO s FROM public_semantic_private.derive_public_semantic_readiness_v1(p_experience_id);
  IF NOT FOUND OR s.readiness IS DISTINCT FROM 'SEMANTICALLY_READY' THEN
    RETURN QUERY SELECT 'NOT_READY'::text, 'NOT_SEMANTICALLY_READY'::text, s.experience_version_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  SELECT ri.interpretation_id INTO v_reviewed FROM public_spatial_private.derive_reviewed_interpretation_v1(s.experience_version_id) ri;
  IF v_reviewed IS DISTINCT FROM s.interpretation_id THEN
    RETURN QUERY SELECT 'NOT_READY'::text, 'NOT_SEMANTICALLY_READY'::text, s.experience_version_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  SELECT sp.id INTO v_placement FROM public_spatial_private.spatial_placements sp
   WHERE sp.experience_version_id = s.experience_version_id AND sp.interpretation_id = v_reviewed;
  IF v_placement IS NULL THEN
    RETURN QUERY SELECT 'NOT_READY'::text, 'NO_PLACEMENT'::text, s.experience_version_id, v_reviewed, NULL::uuid;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'SPATIALLY_READY'::text, NULL::text, s.experience_version_id, v_reviewed, v_placement;
END$$;

-- B.4 May this request still be placed? ADMISSIBLE only while its version and revision are still the semantically
--     ready, reviewed current ones and no placement of them exists. ALREADY_PLACED | STALE | UNAVAILABLE otherwise.
CREATE FUNCTION public_spatial_private.request_admissibility_v1(p_request_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_request public_spatial_private.spatial_requests;
  r record;
BEGIN
  SELECT q.* INTO v_request FROM public_spatial_private.spatial_requests q WHERE q.id = p_request_id;
  IF NOT FOUND THEN
    RETURN 'UNAVAILABLE';
  END IF;
  IF EXISTS (SELECT 1 FROM public_spatial_private.spatial_placements sp
              WHERE sp.experience_version_id = v_request.experience_version_id
                AND sp.interpretation_id = v_request.interpretation_id) THEN
    RETURN 'ALREADY_PLACED';
  END IF;
  SELECT * INTO r FROM public_spatial_private.derive_public_spatial_readiness_v1(v_request.experience_id);
  IF r.reason IS DISTINCT FROM 'NO_PLACEMENT' THEN
    RETURN 'UNAVAILABLE';
  END IF;
  IF r.experience_version_id IS DISTINCT FROM v_request.experience_version_id
     OR r.interpretation_id IS DISTINCT FROM v_request.interpretation_id THEN
    RETURN 'STALE';
  END IF;
  RETURN 'ADMISSIBLE';
END$$;

-- B.5 THE VISIBLE SPATIAL ENTRY of one Experience: the ONE composition every viewer read uses. Zero rows unless the
--     canonical visibility answers PUBLICLY_VISIBLE, the visible version has a reviewed current interpretation (B.2)
--     and a placement of exactly that version and revision exists. A stale or wrong-version placement never serves.
CREATE FUNCTION public_spatial_private.derive_visible_spatial_entry_v1(p_experience_id uuid)
RETURNS TABLE (experience_id uuid, experience_version_id uuid, version_ordinal integer, manifest_version_id uuid,
               interpretation_id uuid, meaning text, primary_themes text[], secondary_themes text[], semantic_region text,
               world_x bigint, world_y bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v record;
BEGIN
  IF p_experience_id IS NULL THEN
    RETURN;
  END IF;
  SELECT vs.visible_experience_version_id AS version_id, vs.visible_version_ordinal AS ordinal, vs.visible_manifest_version_id AS manifest_id
    INTO v
    FROM public.resolve_public_visibility_state_v1(p_experience_id) vs
   WHERE vs.visibility_state = 'PUBLICLY_VISIBLE';
  IF NOT FOUND OR v.version_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p_experience_id, v.version_id, v.ordinal, v.manifest_id, ri.interpretation_id, ri.meaning, ri.primary_themes,
           ri.secondary_themes, ri.semantic_region, sp.world_x, sp.world_y
      FROM public_spatial_private.derive_reviewed_interpretation_v1(v.version_id) ri
      JOIN public_spatial_private.spatial_placements sp
        ON sp.experience_version_id = v.version_id AND sp.interpretation_id = ri.interpretation_id
       AND sp.experience_id = p_experience_id;
END$$;

-- B.6 The admitted viewer: auth.uid(), admitted as a REGISTERED viewer of the ONE Public World by the frozen gate. NULL
--     when not admitted — every viewer read then answers nothing (never why). Signed-out viewing stays closed.
CREATE FUNCTION public_spatial_private.admitted_viewer_v1()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_WORLD_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.public_world_state w WHERE w.singleton AND w.world_type = 'PUBLIC_WORLD')
     AND EXISTS (SELECT 1 FROM public.resolve_public_audience_admission_v1(v_user) a
                  WHERE a.admission = 'ADMITTED' AND a.viewer_class = 'REGISTERED') THEN
    RETURN v_user;
  END IF;
  RETURN NULL;
END$$;

-- B.7 The candidates for a field read: Experiences with a placement of their CURRENT version. A prefilter only — every
--     candidate is re-derived through B.5 before anything is served.
CREATE FUNCTION public_spatial_private.field_candidates_v1()
RETURNS TABLE (experience_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT sp.experience_id
    FROM public_spatial_private.spatial_placements sp
    JOIN public.public_experiences e ON e.id = sp.experience_id AND e.current_experience_version_id = sp.experience_version_id;
$$;

-- =====================================================================================================================
-- C. THE OWNER COMMANDS (authenticated, the exact controller from auth.uid()). Nothing here takes or returns a coordinate.
-- =====================================================================================================================

-- C.1 THE CONTROLLER'S VIEW OF THE PREPARATION of one Experience. Zero rows for anyone else or an Experience no longer
--     authorable (no oracle). NOT_SEMANTICALLY_READY | NOT_PLACED | PLACED — never where.
CREATE FUNCTION public_spatial_private.read_own_public_spatial_preparation_v1(p_experience_id uuid)
RETURNS TABLE (preparation_state text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  r record;
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SPATIAL_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.public_experiences e
                   JOIN public.public_experience_controllers c ON c.experience_id = e.id AND c.controller_user_id = v_user
                  WHERE e.id = p_experience_id AND e.current_lifecycle IN ('DRAFT', 'READY_FOR_REVIEW')) THEN
    RETURN;
  END IF;
  SELECT * INTO r FROM public_spatial_private.derive_public_spatial_readiness_v1(p_experience_id);
  RETURN QUERY SELECT CASE WHEN r.readiness = 'SPATIALLY_READY' THEN 'PLACED'
                           WHEN r.reason = 'NO_PLACEMENT' THEN 'NOT_PLACED'
                           ELSE 'NOT_SEMANTICALLY_READY' END::text;
END$$;

-- C.2 ASK QANDEEL TO PREPARE THE STABLE PUBLIC LOCATION of the exact current version under its exact reviewed revision.
--     It writes a request and nothing else; the server channel then serves the meaning-only input, runs the placer and
--     commits what it answered. One request per revision: a later command for the same revision resumes it.
--       REQUEST_OPEN            a request the server may place (new, this command's retry, or the revision's open one)
--       ALREADY_PLACED          this exact version and revision already has its place — nothing is recomputed
--       NOT_SEMANTICALLY_READY  S5-03A has no reviewed interpretation of the exact current version
--       STALE                   this command was for an earlier revision or version
--       UNAVAILABLE             not the controller, or nothing there
CREATE FUNCTION public_spatial_private.request_own_public_spatial_placement_v1(p_command_id uuid, p_experience_id uuid)
RETURNS TABLE (outcome text, request_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_request uuid;
  v_existing public_spatial_private.spatial_requests;
  v_retry boolean;
  v_open uuid;
  r record;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SPATIAL_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_request := public_spatial_private.derive_spatial_identity_v1('REQUEST', v_user, p_command_id);
  -- CANONICAL LOCK ORDER, STEP 2: the exact Experience; then the current package's items (the S5-03A discipline).
  PERFORM 1 FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  PERFORM public_semantic_private.lock_current_package_v1(p_experience_id);
  IF NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                  WHERE c.experience_id = p_experience_id AND c.controller_user_id = v_user) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  SELECT q.* INTO v_existing FROM public_spatial_private.spatial_requests q WHERE q.id = v_request;
  v_retry := FOUND;
  IF v_retry AND v_existing.experience_id <> p_experience_id THEN
    RAISE EXCEPTION 'PUBLIC_SPATIAL_COMMAND_ID_CONFLICT' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO r FROM public_spatial_private.derive_public_spatial_readiness_v1(p_experience_id);
  IF r.readiness = 'SPATIALLY_READY' THEN
    RETURN QUERY SELECT 'ALREADY_PLACED'::text, NULL::uuid;
    RETURN;
  END IF;
  IF r.reason IS DISTINCT FROM 'NO_PLACEMENT' THEN
    RETURN QUERY SELECT 'NOT_SEMANTICALLY_READY'::text, NULL::uuid;
    RETURN;
  END IF;
  IF v_retry THEN
    IF v_existing.experience_version_id <> r.experience_version_id OR v_existing.interpretation_id <> r.interpretation_id THEN
      RETURN QUERY SELECT 'STALE'::text, NULL::uuid;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'REQUEST_OPEN'::text, v_existing.id;
    RETURN;
  END IF;
  SELECT q.id INTO v_open FROM public_spatial_private.spatial_requests q
   WHERE q.experience_version_id = r.experience_version_id AND q.interpretation_id = r.interpretation_id
   ORDER BY q.requested_at, q.id LIMIT 1;
  IF v_open IS NOT NULL THEN
    RETURN QUERY SELECT 'REQUEST_OPEN'::text, v_open;
    RETURN;
  END IF;
  INSERT INTO public_spatial_private.spatial_requests (id, experience_id, experience_version_id, interpretation_id, requested_at)
  VALUES (v_request, p_experience_id, r.experience_version_id, r.interpretation_id, clock_timestamp());
  RETURN QUERY SELECT 'REQUEST_OPEN'::text, v_request;
END$$;

-- =====================================================================================================================
-- D. THE SERVER CHANNEL (service_role; never a client credential).
-- =====================================================================================================================

-- D.1 THE PLACER'S WHOLE INPUT for one admissible request: the reviewed meaning, main and other themes, the semantic
--     region and the exact revision identity — from the S5-03A row and nothing else. No package text, no account, no
--     alias, no vitality, no Personal or Shared truth. Zero rows when the request is not admissible.
CREATE FUNCTION public_spatial_private.read_public_spatial_placement_input_v1(p_request_id uuid)
RETURNS TABLE (interpretation_id uuid, meaning text, primary_themes text[], secondary_themes text[], semantic_region text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_request public_spatial_private.spatial_requests;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SPATIAL_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT q.* INTO v_request FROM public_spatial_private.spatial_requests q WHERE q.id = p_request_id;
  IF NOT FOUND OR public_spatial_private.request_admissibility_v1(p_request_id) <> 'ADMISSIBLE' THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT ri.interpretation_id, ri.meaning, ri.primary_themes, ri.secondary_themes, ri.semantic_region
      FROM public_spatial_private.derive_reviewed_interpretation_v1(v_request.experience_version_id) ri
     WHERE ri.interpretation_id = v_request.interpretation_id;
END$$;

-- D.2 COMMIT WHAT THE PLACER ANSWERED for one admissible request. First placement wins, forever: a later answer — a
--     retry, a different layout model — reads ALREADY_PLACED and moves nothing. A malformed answer is refused (22023).
--     PLACED | ALREADY_PLACED | STALE | UNAVAILABLE.
CREATE FUNCTION public_spatial_private.commit_public_spatial_placement_v1(
  p_request_id uuid, p_layout_version text, p_world_x bigint, p_world_y bigint)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_request public_spatial_private.spatial_requests;
  v_admissible text;
BEGIN
  IF p_request_id IS NULL OR p_layout_version IS NULL OR p_layout_version !~ '^[a-z0-9][a-z0-9_.-]{0,63}$'
     OR p_world_x IS NULL OR p_world_y IS NULL
     OR p_world_x NOT BETWEEN -4611686018427387904 AND 4611686018427387903
     OR p_world_y NOT BETWEEN -4611686018427387904 AND 4611686018427387903 THEN
    RAISE EXCEPTION 'PUBLIC_SPATIAL_OUTPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT q.* INTO v_request FROM public_spatial_private.spatial_requests q WHERE q.id = p_request_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  -- CANONICAL LOCK ORDER, STEP 2, then the package items: a correction, a version change or an erasure serializes.
  PERFORM 1 FROM public.public_experiences e WHERE e.id = v_request.experience_id FOR UPDATE;
  PERFORM public_semantic_private.lock_current_package_v1(v_request.experience_id);
  v_admissible := public_spatial_private.request_admissibility_v1(p_request_id);
  IF v_admissible <> 'ADMISSIBLE' THEN
    RETURN QUERY SELECT v_admissible;
    RETURN;
  END IF;
  INSERT INTO public_spatial_private.spatial_placements
    (id, experience_id, experience_version_id, interpretation_id, request_id, spatial_contract, layout_version,
     coordinate_scheme, world_x, world_y, committed_at)
  VALUES (public_spatial_private.derive_spatial_identity_v1('PLACEMENT', v_request.experience_version_id, v_request.interpretation_id),
          v_request.experience_id, v_request.experience_version_id, v_request.interpretation_id, v_request.id,
          'PUBLIC_SPATIAL_PLACEMENT_V1', p_layout_version, 'QANDEEL_PUBLIC_FIELD_V1', p_world_x, p_world_y, clock_timestamp());
  RETURN QUERY SELECT 'PLACED'::text;
END$$;

-- =====================================================================================================================
-- E. THE VIEWER READ BOUNDARY (authenticated; the viewer is auth.uid(), admitted by the frozen gate). Every row is a
--    PUBLICLY_VISIBLE Experience's visible version, its reviewed meaning and its current placement. Coordinates cross as
--    exact integer text. No account, no Public ref, no sealed provenance, no lens placeholder, no rank number.
-- =====================================================================================================================

-- E.1 THE FIELD within one bounded world rectangle: at most 400 Experiences, in a fixed spatial order (never by
--     popularity, activity, age or publication instant).
CREATE FUNCTION public_spatial_private.read_public_semantic_field_v1(p_min_x bigint, p_min_y bigint, p_max_x bigint, p_max_y bigint)
RETURNS TABLE (experience_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_min_x IS NULL OR p_min_y IS NULL OR p_max_x IS NULL OR p_max_y IS NULL OR p_min_x > p_max_x OR p_min_y > p_max_y THEN
    RAISE EXCEPTION 'PUBLIC_SPATIAL_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF public_spatial_private.admitted_viewer_v1() IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT ve.experience_id, ve.world_x::text, ve.world_y::text, ve.meaning, ve.semantic_region
      FROM public_spatial_private.field_candidates_v1() c
      CROSS JOIN LATERAL public_spatial_private.derive_visible_spatial_entry_v1(c.experience_id) ve
     WHERE ve.world_x BETWEEN p_min_x AND p_max_x AND ve.world_y BETWEEN p_min_y AND p_max_y
     ORDER BY ve.world_x, ve.world_y, ve.experience_id
     LIMIT 400;
END$$;

-- E.2 SEARCH over the SAME field: at most 20 visible Experiences whose reviewed meaning, themes or public text match the
--     query (the frozen `simple` configuration), ordered by query relevance alone, each with its place in the field so
--     the viewer is guided to it there. The document is built at read time and stored nowhere.
CREATE FUNCTION public_spatial_private.search_public_semantic_field_v1(p_query text)
RETURNS TABLE (experience_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_query tsquery;
BEGIN
  IF p_query IS NULL OR p_query <> btrim(p_query) OR length(p_query) NOT BETWEEN 1 AND 120 OR p_query ~ '[\n\r\t]' THEN
    RAISE EXCEPTION 'PUBLIC_SPATIAL_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF public_spatial_private.admitted_viewer_v1() IS NULL THEN
    RETURN;
  END IF;
  v_query := plainto_tsquery('pg_catalog.simple', p_query);
  IF numnode(v_query) = 0 THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT ve.experience_id, ve.world_x::text, ve.world_y::text, ve.meaning, ve.semantic_region
      FROM public_spatial_private.field_candidates_v1() c
      CROSS JOIN LATERAL public_spatial_private.derive_visible_spatial_entry_v1(c.experience_id) ve
      CROSS JOIN LATERAL (
        SELECT to_tsvector('pg_catalog.simple',
                 ve.meaning || ' ' || array_to_string(ve.primary_themes, ' ') || ' ' || array_to_string(ve.secondary_themes, ' ')
                 || ' ' || coalesce(string_agg(b.public_text_body, ' ' ORDER BY it.item_ordinal), '')) AS document
          FROM public.publication_package_manifest_items it
          JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
         WHERE it.manifest_version_id = ve.manifest_version_id AND it.content_state = 'CONTENT_PRESENT') d
     WHERE d.document @@ v_query
     ORDER BY ts_rank(d.document, v_query) DESC, ve.experience_id
     LIMIT 20;
END$$;

-- E.3 THE CONTEXTUAL PANEL of one visible Experience: its reviewed meaning and themes, the publisher's CURRENT public
--     display (joined now — an alias change moves nothing), the publication instant of the visible version's record, the
--     permitted vitality counts of exactly that version (0 when none was computed), and its place. Zero rows for
--     anything not served (hidden, stale, guessed, unadmitted) — one neutral absence.
CREATE FUNCTION public_spatial_private.read_public_semantic_experience_v1(p_experience_id uuid)
RETURNS TABLE (experience_id uuid, version_ordinal integer, meaning text, primary_themes text[], secondary_themes text[],
               semantic_region text, publisher_label_mode text, publisher_display_label text, published_at timestamptz,
               discussion_post_count integer, qandeel_response_count integer, world_x text, world_y text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SPATIAL_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF public_spatial_private.admitted_viewer_v1() IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT ve.experience_id, ve.version_ordinal, ve.meaning, ve.primary_themes, ve.secondary_themes, ve.semantic_region,
           d.label_mode, d.display_label, s.published_at,
           coalesce(st.discussion_post_count, 0), coalesce(st.qandeel_response_count, 0),
           ve.world_x::text, ve.world_y::text
      FROM public_spatial_private.derive_visible_spatial_entry_v1(p_experience_id) ve
      JOIN public.public_experience_publication_state s
        ON s.experience_id = ve.experience_id AND s.published_experience_version_id = ve.experience_version_id
      JOIN public.publication_package_manifest_versions m ON m.id = ve.manifest_version_id
      JOIN public.public_identity_display_state d ON d.public_identity_ref = m.publisher_public_identity_ref
      LEFT JOIN public.public_experience_vitality_state st
        ON st.experience_id = ve.experience_id AND st.experience_version_id = ve.experience_version_id;
END$$;

-- E.4 THE PUBLIC CONTENT of one visible Experience, through the ONE canonical serving resolver (0095) for this viewer,
--     and only while the Experience is a served field entry. Item order, whether the item is source content or
--     QANDEEL's analysis, and its public text.
CREATE FUNCTION public_spatial_private.read_public_semantic_experience_content_v1(p_experience_id uuid)
RETURNS TABLE (item_ordinal integer, item_kind text, item_text text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_viewer uuid;
  v_version uuid;
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SPATIAL_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_viewer := public_spatial_private.admitted_viewer_v1();
  IF v_viewer IS NULL THEN
    RETURN;
  END IF;
  SELECT ve.experience_version_id INTO v_version FROM public_spatial_private.derive_visible_spatial_entry_v1(p_experience_id) ve;
  IF v_version IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT sv.item_ordinal,
           CASE sv.derivative_classification WHEN 'ANALYTICAL_DERIVATIVE' THEN 'ANALYSIS' ELSE 'SOURCE_CONTENT' END,
           sv.public_text_body
      FROM public.resolve_public_experience_serving_v1(p_experience_id, v_viewer) sv
     WHERE sv.experience_version_id = v_version
     ORDER BY sv.item_ordinal;
END$$;

-- E.5 A VERY SMALL NEARBY CONTEXT: at most 3 other served Experiences nearest to a served one in the field, by canonical
--     spatial distance alone (exact, in numeric). Nothing for anything not served.
CREATE FUNCTION public_spatial_private.read_public_semantic_nearby_v1(p_experience_id uuid)
RETURNS TABLE (experience_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_focus record;
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SPATIAL_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF public_spatial_private.admitted_viewer_v1() IS NULL THEN
    RETURN;
  END IF;
  SELECT ve.world_x AS x, ve.world_y AS y INTO v_focus FROM public_spatial_private.derive_visible_spatial_entry_v1(p_experience_id) ve;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT ve.experience_id, ve.world_x::text, ve.world_y::text, ve.meaning, ve.semantic_region
      FROM public_spatial_private.field_candidates_v1() c
      CROSS JOIN LATERAL public_spatial_private.derive_visible_spatial_entry_v1(c.experience_id) ve
     WHERE ve.experience_id <> p_experience_id
     ORDER BY (ve.world_x::numeric - v_focus.x::numeric) ^ 2 + (ve.world_y::numeric - v_focus.y::numeric) ^ 2, ve.experience_id
     LIMIT 3;
END$$;

-- =====================================================================================================================
-- F. THE EXPOSED WRAPPERS: SECURITY INVOKER, each a one-line call into its definer.
-- =====================================================================================================================
CREATE FUNCTION public.read_own_public_spatial_preparation_v1(p_experience_id uuid)
RETURNS TABLE (preparation_state text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.preparation_state FROM public_spatial_private.read_own_public_spatial_preparation_v1(p_experience_id) r;
$$;
CREATE FUNCTION public.request_own_public_spatial_placement_v1(p_command_id uuid, p_experience_id uuid)
RETURNS TABLE (outcome text, request_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.request_id FROM public_spatial_private.request_own_public_spatial_placement_v1(p_command_id, p_experience_id) r;
$$;
CREATE FUNCTION public.read_public_spatial_placement_input_v1(p_request_id uuid)
RETURNS TABLE (interpretation_id uuid, meaning text, primary_themes text[], secondary_themes text[], semantic_region text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.interpretation_id, r.meaning, r.primary_themes, r.secondary_themes, r.semantic_region
    FROM public_spatial_private.read_public_spatial_placement_input_v1(p_request_id) r;
$$;
CREATE FUNCTION public.commit_public_spatial_placement_v1(p_request_id uuid, p_layout_version text, p_world_x bigint, p_world_y bigint)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM public_spatial_private.commit_public_spatial_placement_v1(p_request_id, p_layout_version, p_world_x, p_world_y) r;
$$;
CREATE FUNCTION public.read_public_semantic_field_v1(p_min_x bigint, p_min_y bigint, p_max_x bigint, p_max_y bigint)
RETURNS TABLE (experience_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.experience_id, r.world_x, r.world_y, r.meaning, r.semantic_region
    FROM public_spatial_private.read_public_semantic_field_v1(p_min_x, p_min_y, p_max_x, p_max_y) r;
$$;
CREATE FUNCTION public.search_public_semantic_field_v1(p_query text)
RETURNS TABLE (experience_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.experience_id, r.world_x, r.world_y, r.meaning, r.semantic_region
    FROM public_spatial_private.search_public_semantic_field_v1(p_query) r;
$$;
CREATE FUNCTION public.read_public_semantic_experience_v1(p_experience_id uuid)
RETURNS TABLE (experience_id uuid, version_ordinal integer, meaning text, primary_themes text[], secondary_themes text[],
               semantic_region text, publisher_label_mode text, publisher_display_label text, published_at timestamptz,
               discussion_post_count integer, qandeel_response_count integer, world_x text, world_y text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.experience_id, r.version_ordinal, r.meaning, r.primary_themes, r.secondary_themes, r.semantic_region,
         r.publisher_label_mode, r.publisher_display_label, r.published_at, r.discussion_post_count, r.qandeel_response_count,
         r.world_x, r.world_y
    FROM public_spatial_private.read_public_semantic_experience_v1(p_experience_id) r;
$$;
CREATE FUNCTION public.read_public_semantic_experience_content_v1(p_experience_id uuid)
RETURNS TABLE (item_ordinal integer, item_kind text, item_text text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.item_ordinal, r.item_kind, r.item_text FROM public_spatial_private.read_public_semantic_experience_content_v1(p_experience_id) r;
$$;
CREATE FUNCTION public.read_public_semantic_nearby_v1(p_experience_id uuid)
RETURNS TABLE (experience_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.experience_id, r.world_x, r.world_y, r.meaning, r.semantic_region
    FROM public_spatial_private.read_public_semantic_nearby_v1(p_experience_id) r;
$$;

-- =====================================================================================================================
-- G. PRIVILEGES. Ownership; default-deny by name; then the exact grants. Nothing relies on a default (0133).
-- =====================================================================================================================
ALTER TABLE public_spatial_private.spatial_requests OWNER TO postgres;
ALTER TABLE public_spatial_private.spatial_placements OWNER TO postgres;
ALTER TABLE public_spatial_private.spatial_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_spatial_private.spatial_placements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public_spatial_private.spatial_requests, public_spatial_private.spatial_placements
  FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_fn text;
  v_owner_commands text[] := ARRAY[
    'public_spatial_private.read_own_public_spatial_preparation_v1(uuid)',
    'public_spatial_private.request_own_public_spatial_placement_v1(uuid, uuid)',
    'public_spatial_private.read_public_semantic_field_v1(bigint, bigint, bigint, bigint)',
    'public_spatial_private.search_public_semantic_field_v1(text)',
    'public_spatial_private.read_public_semantic_experience_v1(uuid)',
    'public_spatial_private.read_public_semantic_experience_content_v1(uuid)',
    'public_spatial_private.read_public_semantic_nearby_v1(uuid)',
    'public.read_own_public_spatial_preparation_v1(uuid)',
    'public.request_own_public_spatial_placement_v1(uuid, uuid)',
    'public.read_public_semantic_field_v1(bigint, bigint, bigint, bigint)',
    'public.search_public_semantic_field_v1(text)',
    'public.read_public_semantic_experience_v1(uuid)',
    'public.read_public_semantic_experience_content_v1(uuid)',
    'public.read_public_semantic_nearby_v1(uuid)'];
  v_server_commands text[] := ARRAY[
    'public_spatial_private.read_public_spatial_placement_input_v1(uuid)',
    'public_spatial_private.commit_public_spatial_placement_v1(uuid, text, bigint, bigint)',
    'public.read_public_spatial_placement_input_v1(uuid)',
    'public.commit_public_spatial_placement_v1(uuid, text, bigint, bigint)'];
  v_internal text[] := ARRAY[
    'public_spatial_private.reject_spatial_history_mutation_v1()',
    'public_spatial_private.derive_spatial_identity_v1(text, uuid, uuid)',
    'public_spatial_private.derive_reviewed_interpretation_v1(uuid)',
    'public_spatial_private.derive_public_spatial_readiness_v1(uuid)',
    'public_spatial_private.request_admissibility_v1(uuid)',
    'public_spatial_private.derive_visible_spatial_entry_v1(uuid)',
    'public_spatial_private.admitted_viewer_v1()',
    'public_spatial_private.field_candidates_v1()'];
BEGIN
  FOREACH v_fn IN ARRAY v_owner_commands || v_server_commands || v_internal LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', v_fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', v_fn);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON TABLE public_spatial_private.spatial_requests, public_spatial_private.spatial_placements FROM service_role';
    EXECUTE 'GRANT USAGE ON SCHEMA public_spatial_private TO service_role';
    FOREACH v_fn IN ARRAY v_server_commands LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn);
    END LOOP;
  END IF;
  EXECUTE 'GRANT USAGE ON SCHEMA public_spatial_private TO authenticated';
  FOREACH v_fn IN ARRAY v_owner_commands LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_fn);
  END LOOP;
END$$;

-- =====================================================================================================================
-- H. DEPLOY-TIME SELF-ASSERTIONS: the boundary is what this file says, or the migration fails.
-- =====================================================================================================================
DO $$
DECLARE
  v_fn text;
  v_role text;
  p record;
BEGIN
  -- H1. No application role executes a frozen I-05 primitive, a frozen I-05 reader that serves the 0096 descriptor, or a
  --     readiness derivation.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.record_public_experience_semantic_placement_v1(uuid, uuid, uuid, uuid, text, text)',
    'public.derive_public_experience_current_placement_v1(uuid)',
    'public.publish_public_experience_v1(uuid, uuid, uuid)',
    'public.resolve_public_publication_prerequisites_v1(uuid, uuid)',
    'public.commit_public_experience_ready_for_review_v1(uuid, uuid, uuid)',
    'public.rebuild_public_experience_projection_v1(uuid)',
    'public.recompute_public_experience_vitality_v1(uuid)',
    'public_semantic_private.derive_public_semantic_readiness_v1(uuid)',
    'public_spatial_private.derive_public_spatial_readiness_v1(uuid)'] LOOP
    IF has_function_privilege('public', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S5-03B: PUBLIC executes %', v_fn;
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = v_role) AND has_function_privilege(v_role, v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S5-03B: % executes %', v_role, v_fn;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY[
    'public.resolve_public_experience_semantic_placement_v1(uuid, uuid)', 'public.search_public_experiences_v1(uuid, text)',
    'public.resolve_public_lens_v1(uuid, text)', 'public.resolve_public_panel_v1(uuid, uuid)'] LOOP
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_function_privilege(v_role, v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S5-03B: % executes the frozen descriptor reader %', v_role, v_fn;
      END IF;
    END LOOP;
  END LOOP;

  -- H2. Publication stays impossible: the CW2-08 seam answers NOT_EVALUATED.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)'::regprocedure;
  IF p.prosrc !~ 'NOT_EVALUATED' OR p.prosrc ~ '''CLEARED''' THEN
    RAISE EXCEPTION 'S5-03B: the CW2-08 prerequisite seam must still answer NOT_EVALUATED';
  END IF;

  -- H3. Nothing S5-03B owns publishes, reaches discussion or Public QANDEEL writers, private truth, the account, the 0096
  --     descriptor, or the frozen descriptor readers; it never writes S5-03A or any frozen relation.
  FOR p IN SELECT pr.proname, pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public_spatial_private'
               OR (n.nspname = 'public' AND pr.proname IN ('read_own_public_spatial_preparation_v1',
                   'request_own_public_spatial_placement_v1', 'read_public_spatial_placement_input_v1',
                   'commit_public_spatial_placement_v1', 'read_public_semantic_field_v1', 'search_public_semantic_field_v1',
                   'read_public_semantic_experience_v1', 'read_public_semantic_experience_content_v1',
                   'read_public_semantic_nearby_v1')) LOOP
    IF p.prosrc ~ '(publish_public_experience_v1|resolve_public_publication_prerequisites_v1|''PUBLISHED''|ABSENT_FROM_PUBLIC_WORLD|post_public_discussion|record_public_qandeel|provenance|shared_world|conversation_|memor|human_model|(^|[^a-z])him_|hypothes|matching|introduction|public\.users|semantic_label|s5-03a\.private|S5-03A_PRIVATE|resolve_public_experience_semantic_placement_v1|search_public_experiences_v1|resolve_public_lens_v1|resolve_public_panel_v1|public_experience_search_projection|personal_owner)' THEN
      RAISE EXCEPTION 'S5-03B: % reaches beyond the Public semantic field boundary', p.proname;
    END IF;
    IF p.prosrc ~* '(INSERT INTO|UPDATE|DELETE FROM)\s+public(_semantic_private|_authoring_private|_world_private)?\.' THEN
      RAISE EXCEPTION 'S5-03B: % writes outside its own family', p.proname;
    END IF;
  END LOOP;

  -- H3a. The placer's input reader reads the reviewed meaning and nothing that identifies or ranks anyone.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public_spatial_private.read_public_spatial_placement_input_v1(uuid)'::regprocedure;
  IF p.prosrc ~ '(public_identit|display_label|label_mode|vitality|discussion|qandeel_response|published_at|text_derivative_bodies|auth\.uid)' THEN
    RAISE EXCEPTION 'S5-03B: the placer input reaches beyond the reviewed meaning';
  END IF;

  -- H4. Every S5-03B private function is a pinned postgres-owned SECURITY DEFINER.
  FOR p IN SELECT pr.proname, pr.prosecdef, pr.proconfig, pg_get_userbyid(pr.proowner) AS owner
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace WHERE n.nspname = 'public_spatial_private' LOOP
    IF NOT p.prosecdef OR p.owner <> 'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN
      RAISE EXCEPTION 'S5-03B: public_spatial_private.% must be a pinned postgres-owned definer', p.proname;
    END IF;
  END LOOP;

  -- H5. Both relations are append-only; no text column exists beyond the contract, layout version and scheme names.
  IF (SELECT count(*) FROM pg_trigger tg WHERE NOT tg.tgisinternal
        AND tg.tgfoid = 'public_spatial_private.reject_spatial_history_mutation_v1()'::regprocedure) <> 2 THEN
    RAISE EXCEPTION 'S5-03B: both spatial relations must be append-only';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public_spatial_private' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
                AND a.atttypid IN ('text'::regtype, 'text[]'::regtype, 'varchar'::regtype, 'jsonb'::regtype, 'tsvector'::regtype)
                AND a.attname NOT IN ('spatial_contract', 'layout_version', 'coordinate_scheme')) THEN
    RAISE EXCEPTION 'S5-03B: a spatial relation must not hold semantic or package text';
  END IF;

  -- H6. No DIRECT account reference (the version / interpretation bindings are QAN-BL-ACCT-01 edges; see A).
  IF EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
              WHERE n.nspname = 'public_spatial_private' AND c.contype = 'f'
                AND c.confrelid IN ('public.users'::regclass, 'public.public_identities'::regclass)) THEN
    RAISE EXCEPTION 'S5-03B: a spatial relation must not reference an account or a Public identity';
  END IF;

  -- H7. Still one Public World, the signed-out policy untouched, and no Experience published.
  IF (SELECT count(*) FROM public.public_world_state) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.public_audience_policy_state p2 WHERE p2.signed_out_viewing_policy = 'UNRESOLVED') THEN
    RAISE EXCEPTION 'S5-03B: one Public World, and the signed-out policy still UNRESOLVED';
  END IF;
END$$;

COMMIT;
