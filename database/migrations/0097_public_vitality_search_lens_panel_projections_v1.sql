-- I-05B - Public Vitality and Search / Lens / Panel Projections v1 (PART D).
--
-- Derived Public runtime state over the canonical truths of 0095 and 0096.
-- Nothing here is an authority. A projection cannot publish, cannot make an
-- invisible object visible, and cannot outlive the canonical visibility it was
-- derived from; a vitality figure is a count, never a permission.
--
-- ===========================================================================
-- Derived state is rebuilt, never trusted
-- ===========================================================================
--
-- Two writers recompute derived state DETERMINISTICALLY from canonical rows:
--
--   recompute_public_experience_vitality_v1     counts of public discussion and
--                                               Public QANDEEL activity, and the
--                                               latest public activity instant
--   rebuild_public_experience_projection_v1     the search document, lens key
--                                               and semantic label of the
--                                               VISIBLE version
--
-- Each takes the Experience row FOR SHARE, asks the ONE visibility derivation,
-- and writes only when the canonical answer differs from what is stored: the
-- same inputs produce the same row, and a second run reports UNCHANGED. For an
-- Experience that is not publicly visible the vitality recompute writes
-- nothing and the projection rebuild DELETES any projection row, so no
-- projection survives the visibility it was derived from.
--
-- Every read path composes the ONE visibility derivation with the audience
-- admission gate AGAIN and requires the stored row to describe the CURRENTLY
-- visible version. A stale row - a projection of an older version, a vitality
-- figure computed before a publication moved - is therefore never an
-- independent source of truth: it simply does not serve until it is rebuilt.
--
-- ===========================================================================
-- Bounded to Public derivative data
-- ===========================================================================
--
-- The search document is built from the public text derivative bodies of the
-- visible manifest and the current semantic label, and from nothing else. No
-- projection reads sealed provenance, a source identifier, an account or a
-- contact endpoint, and none returns one. Display labels are joined at read
-- time from the mutable display state, never copied into a projection, so an
-- alias change is visible everywhere at once and rewrites nothing.
--
-- Search uses the `simple` text-search configuration: deterministic, language-
-- neutral, no stemming and no stop words, so no Product ranking model is
-- invented here. Rank is a property of the query and the document alone.
--
-- Forward safety: a later reviewed slice that removes or suppresses public
-- presence turns every read here dark through the ONE visibility derivation
-- and clears the projection on its next rebuild, without rewriting any
-- historical discussion, response or placement row.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- No lifecycle transition, no publication, no visibility decision of its own,
-- no placement, discussion or response writer; no deletion, disappearance or
-- source-unavailability handling; no ranking policy, recommendation, feed or
-- notification; no Safety, Launch or entitlement; no route, controller, RPC or
-- mobile surface. Migrations 0001-0096 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. VITALITY STATE, derived and recomputable.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_experience_vitality_state (
    experience_id uuid NOT NULL,
    experience_version_id uuid NOT NULL,
    vitality_revision bigint NOT NULL,
    discussion_post_count integer NOT NULL,
    qandeel_response_count integer NOT NULL,
    latest_public_activity_at timestamptz,
    computed_at timestamptz NOT NULL,
    CONSTRAINT public_experience_vitality_state_pk PRIMARY KEY (experience_id),
    CONSTRAINT public_experience_vitality_state_revision_check CHECK (vitality_revision > 0),
    CONSTRAINT public_experience_vitality_state_counts_check
        CHECK (discussion_post_count >= 0 AND qandeel_response_count >= 0),
    -- The version this figure was computed for, of this exact Experience.
    CONSTRAINT public_experience_vitality_state_version_fk
        FOREIGN KEY (experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.public_experience_vitality_state IS
  'Derived vitality of one publicly visible Experience: counts of public '
  'discussion and Public QANDEEL activity and the latest public activity instant, '
  'recomputed deterministically from canonical rows. It is never an authority: it '
  'publishes nothing and is served only while the canonical visibility truth '
  'serves the version it was computed for.';

-- ---------------------------------------------------------------------------
-- 2. THE SEARCH / LENS PROJECTION, derived and rebuildable.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_experience_search_projection (
    experience_id uuid NOT NULL,
    experience_version_id uuid NOT NULL,
    placement_revision integer,
    lens_key text,
    semantic_label text,
    search_document tsvector NOT NULL,
    projection_revision bigint NOT NULL,
    projected_at timestamptz NOT NULL,
    CONSTRAINT public_experience_search_projection_pk PRIMARY KEY (experience_id),
    CONSTRAINT public_experience_search_projection_revision_check CHECK (projection_revision > 0),
    -- The interpretation triple is present together or absent together.
    CONSTRAINT public_experience_search_projection_placement_check
        CHECK (((placement_revision IS NULL) = (lens_key IS NULL))
               AND ((lens_key IS NULL) = (semantic_label IS NULL))),
    CONSTRAINT public_experience_search_projection_version_fk
        FOREIGN KEY (experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT
);

CREATE INDEX public_experience_search_projection_document_idx
    ON public.public_experience_search_projection USING gin (search_document);
CREATE INDEX public_experience_search_projection_lens_idx
    ON public.public_experience_search_projection (lens_key) WHERE lens_key IS NOT NULL;

COMMENT ON TABLE public.public_experience_search_projection IS
  'Derived search / lens projection of the publicly visible version of one '
  'Experience, built from its public text derivative bodies and current semantic '
  'label only. Rebuilt deterministically; deleted when the Experience is not '
  'publicly visible; served only while it describes the currently visible version.';

-- ---------------------------------------------------------------------------
-- 3. RECOMPUTE VITALITY.
--
--    Machine state: no human, no auth.uid(). FOR SHARE on the Experience row:
--    a recompute changes no Experience state and only needs the visibility
--    answer to hold while it writes. Writes nothing for a non-visible target.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.recompute_public_experience_vitality_v1(p_experience_id uuid)
RETURNS TABLE(outcome text, experience_id uuid, experience_version_id uuid, vitality_revision bigint,
              discussion_post_count integer, qandeel_response_count integer,
              latest_public_activity_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  visible_version uuid;
  post_total integer;
  response_total integer;
  latest_post timestamptz;
  latest_response timestamptz;
  latest_activity timestamptz;
  affected integer;
  current_state public.public_experience_vitality_state;
  instant timestamptz;
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- CANONICAL LOCK ORDER, STEP 2, FOR SHARE.
  PERFORM 1 FROM public.public_experiences e WHERE e.id = p_experience_id FOR SHARE;
  -- BOUNDED BY THE ONE VISIBILITY TRUTH. One answer for a target that names
  -- nothing and a target that is not public; nothing is written for either.
  SELECT vs.visible_experience_version_id INTO visible_version
    FROM public.resolve_public_visibility_state_v1(p_experience_id) vs
   WHERE vs.visibility_state = 'PUBLICLY_VISIBLE';
  IF NOT FOUND OR visible_version IS NULL THEN
    RETURN QUERY SELECT 'NOT_PUBLICLY_VISIBLE'::text, p_experience_id, NULL::uuid, NULL::bigint,
                        NULL::integer, NULL::integer, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT count(*)::integer, max(dp.posted_at) INTO post_total, latest_post
    FROM public.public_discussion_posts dp WHERE dp.experience_id = p_experience_id;
  SELECT count(*)::integer, max(r.produced_at) INTO response_total, latest_response
    FROM public.public_qandeel_responses r WHERE r.experience_id = p_experience_id;
  latest_activity := greatest(latest_post, latest_response);
  instant := clock_timestamp();

  -- Written only when the canonical answer differs from what is stored.
  INSERT INTO public.public_experience_vitality_state AS cur
    (experience_id, experience_version_id, vitality_revision, discussion_post_count,
     qandeel_response_count, latest_public_activity_at, computed_at)
  VALUES (p_experience_id, visible_version, 1, post_total, response_total, latest_activity, instant)
  ON CONFLICT ON CONSTRAINT public_experience_vitality_state_pk DO UPDATE
     SET experience_version_id = EXCLUDED.experience_version_id,
         vitality_revision = cur.vitality_revision + 1,
         discussion_post_count = EXCLUDED.discussion_post_count,
         qandeel_response_count = EXCLUDED.qandeel_response_count,
         latest_public_activity_at = EXCLUDED.latest_public_activity_at,
         computed_at = EXCLUDED.computed_at
   WHERE (cur.experience_version_id, cur.discussion_post_count, cur.qandeel_response_count,
          cur.latest_public_activity_at)
         IS DISTINCT FROM
         (EXCLUDED.experience_version_id, EXCLUDED.discussion_post_count, EXCLUDED.qandeel_response_count,
          EXCLUDED.latest_public_activity_at);
  GET DIAGNOSTICS affected = ROW_COUNT;

  SELECT * INTO current_state FROM public.public_experience_vitality_state st
   WHERE st.experience_id = p_experience_id;
  RETURN QUERY SELECT CASE WHEN affected = 0 THEN 'VITALITY_UNCHANGED' ELSE 'VITALITY_RECOMPUTED' END::text,
                      p_experience_id, current_state.experience_version_id, current_state.vitality_revision,
                      current_state.discussion_post_count, current_state.qandeel_response_count,
                      current_state.latest_public_activity_at;
END$$;

-- ---------------------------------------------------------------------------
-- 4. REBUILD THE SEARCH / LENS PROJECTION.
--
--    Machine state, FOR SHARE. For a non-visible target the projection row is
--    DELETED: no projection outlives canonical visibility.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.rebuild_public_experience_projection_v1(p_experience_id uuid)
RETURNS TABLE(outcome text, experience_id uuid, experience_version_id uuid, projection_revision bigint)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  visible_version uuid;
  visible_manifest uuid;
  placement_rev integer;
  placement_lens text;
  placement_label text;
  search_doc tsvector;
  affected integer;
  current_projection public.public_experience_search_projection;
  instant timestamptz;
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- CANONICAL LOCK ORDER, STEP 2, FOR SHARE.
  PERFORM 1 FROM public.public_experiences e WHERE e.id = p_experience_id FOR SHARE;
  SELECT vs.visible_experience_version_id, vs.visible_manifest_version_id
    INTO visible_version, visible_manifest
    FROM public.resolve_public_visibility_state_v1(p_experience_id) vs
   WHERE vs.visibility_state = 'PUBLICLY_VISIBLE';
  IF NOT FOUND OR visible_version IS NULL THEN
    DELETE FROM public.public_experience_search_projection pr WHERE pr.experience_id = p_experience_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN QUERY SELECT CASE WHEN affected > 0 THEN 'PROJECTION_CLEARED' ELSE 'PROJECTION_ABSENT' END::text,
                        p_experience_id, NULL::uuid, NULL::bigint;
    RETURN;
  END IF;

  -- The current interpretation of the VISIBLE version, if any.
  SELECT cp.placement_revision, cp.lens_key, cp.semantic_label
    INTO placement_rev, placement_lens, placement_label
    FROM public.derive_public_experience_current_placement_v1(visible_version) cp;

  -- The search document: public derivative bodies of the visible manifest in
  -- package order, plus the current semantic label. Nothing else.
  SELECT to_tsvector('pg_catalog.simple',
           coalesce(placement_label, '') || ' '
           || coalesce(string_agg(b.public_text_body, ' ' ORDER BY it.item_ordinal), ''))
    INTO search_doc
    FROM public.publication_package_manifest_items it
    JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
   WHERE it.manifest_version_id = visible_manifest;
  instant := clock_timestamp();

  INSERT INTO public.public_experience_search_projection AS cur
    (experience_id, experience_version_id, placement_revision, lens_key, semantic_label,
     search_document, projection_revision, projected_at)
  VALUES (p_experience_id, visible_version, placement_rev, placement_lens, placement_label,
          search_doc, 1, instant)
  ON CONFLICT ON CONSTRAINT public_experience_search_projection_pk DO UPDATE
     SET experience_version_id = EXCLUDED.experience_version_id,
         placement_revision = EXCLUDED.placement_revision,
         lens_key = EXCLUDED.lens_key,
         semantic_label = EXCLUDED.semantic_label,
         search_document = EXCLUDED.search_document,
         projection_revision = cur.projection_revision + 1,
         projected_at = EXCLUDED.projected_at
   WHERE (cur.experience_version_id, cur.placement_revision, cur.lens_key, cur.semantic_label,
          cur.search_document)
         IS DISTINCT FROM
         (EXCLUDED.experience_version_id, EXCLUDED.placement_revision, EXCLUDED.lens_key,
          EXCLUDED.semantic_label, EXCLUDED.search_document);
  GET DIAGNOSTICS affected = ROW_COUNT;

  SELECT * INTO current_projection FROM public.public_experience_search_projection pr
   WHERE pr.experience_id = p_experience_id;
  RETURN QUERY SELECT CASE WHEN affected = 0 THEN 'PROJECTION_UNCHANGED' ELSE 'PROJECTION_REBUILT' END::text,
                      p_experience_id, current_projection.experience_version_id,
                      current_projection.projection_revision;
END$$;

-- ---------------------------------------------------------------------------
-- 5. THE FOUR READ BOUNDARIES: vitality, search, lens, panel.
--
--    Each composes the ONE visibility derivation with the admission gate, and
--    serves a stored row ONLY when it describes the currently visible version.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_public_experience_vitality_v1(p_experience_id uuid, p_viewer_user_id uuid)
RETURNS TABLE(experience_id uuid, experience_version_id uuid, vitality_revision bigint,
              discussion_post_count integer, qandeel_response_count integer,
              latest_public_activity_at timestamptz, computed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT vs.experience_id, st.experience_version_id, st.vitality_revision, st.discussion_post_count,
         st.qandeel_response_count, st.latest_public_activity_at, st.computed_at
    FROM public.resolve_public_visibility_state_v1(p_experience_id) vs
    JOIN public.resolve_public_audience_admission_v1(p_viewer_user_id) ad ON ad.admission = 'ADMITTED'
    JOIN public.public_experience_vitality_state st
      ON st.experience_id = vs.experience_id
     AND st.experience_version_id = vs.visible_experience_version_id
   WHERE vs.visibility_state = 'PUBLICLY_VISIBLE';
END$$;

CREATE FUNCTION public.search_public_experiences_v1(p_viewer_user_id uuid, p_query text)
RETURNS TABLE(experience_id uuid, experience_version_id uuid, lens_key text, semantic_label text,
              publisher_public_identity_ref uuid, publisher_label_mode text, publisher_display_label text,
              published_at timestamptz, search_rank real)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  query_lexemes tsquery;
BEGIN
  IF p_query IS NULL OR length(btrim(p_query)) = 0 THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  query_lexemes := plainto_tsquery('pg_catalog.simple', p_query);
  RETURN QUERY
  SELECT pr.experience_id, pr.experience_version_id, pr.lens_key, pr.semantic_label,
         m.publisher_public_identity_ref, d.label_mode, d.display_label, s.published_at,
         ts_rank(pr.search_document, query_lexemes)
    FROM public.resolve_public_audience_admission_v1(p_viewer_user_id) ad
    JOIN public.public_experience_search_projection pr ON pr.search_document @@ query_lexemes
    JOIN LATERAL public.resolve_public_visibility_state_v1(pr.experience_id) vs
      ON vs.visibility_state = 'PUBLICLY_VISIBLE'
     AND vs.visible_experience_version_id = pr.experience_version_id
    JOIN public.public_experience_publication_state s ON s.experience_id = vs.experience_id
    JOIN public.publication_package_manifest_versions m ON m.id = vs.visible_manifest_version_id
    JOIN public.public_identity_display_state d ON d.public_identity_ref = m.publisher_public_identity_ref
   WHERE ad.admission = 'ADMITTED'
   ORDER BY ts_rank(pr.search_document, query_lexemes) DESC, pr.experience_id;
END$$;

CREATE FUNCTION public.resolve_public_lens_v1(p_viewer_user_id uuid, p_lens_key text)
RETURNS TABLE(experience_id uuid, experience_version_id uuid, lens_key text, semantic_label text,
              publisher_public_identity_ref uuid, publisher_label_mode text, publisher_display_label text,
              published_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_lens_key IS NULL OR p_lens_key !~ '^[a-z0-9][a-z0-9_.-]{0,63}$' THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT pr.experience_id, pr.experience_version_id, pr.lens_key, pr.semantic_label,
         m.publisher_public_identity_ref, d.label_mode, d.display_label, s.published_at
    FROM public.resolve_public_audience_admission_v1(p_viewer_user_id) ad
    JOIN public.public_experience_search_projection pr ON pr.lens_key = p_lens_key
    JOIN LATERAL public.resolve_public_visibility_state_v1(pr.experience_id) vs
      ON vs.visibility_state = 'PUBLICLY_VISIBLE'
     AND vs.visible_experience_version_id = pr.experience_version_id
    JOIN public.public_experience_publication_state s ON s.experience_id = vs.experience_id
    JOIN public.publication_package_manifest_versions m ON m.id = vs.visible_manifest_version_id
    JOIN public.public_identity_display_state d ON d.public_identity_ref = m.publisher_public_identity_ref
   WHERE ad.admission = 'ADMITTED'
   ORDER BY s.published_at DESC, pr.experience_id;
END$$;

CREATE FUNCTION public.resolve_public_panel_v1(p_experience_id uuid, p_viewer_user_id uuid)
RETURNS TABLE(experience_id uuid, experience_version_id uuid, version_ordinal integer,
              publisher_public_identity_ref uuid, publisher_label_mode text, publisher_display_label text,
              published_at timestamptz, lens_key text, semantic_label text, placement_revision integer,
              discussion_post_count integer, qandeel_response_count integer,
              latest_public_activity_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT vs.experience_id, vs.visible_experience_version_id, vs.visible_version_ordinal,
         m.publisher_public_identity_ref, d.label_mode, d.display_label, s.published_at,
         cp.lens_key, cp.semantic_label, cp.placement_revision,
         coalesce(st.discussion_post_count, 0), coalesce(st.qandeel_response_count, 0),
         st.latest_public_activity_at
    FROM public.resolve_public_visibility_state_v1(p_experience_id) vs
    JOIN public.resolve_public_audience_admission_v1(p_viewer_user_id) ad ON ad.admission = 'ADMITTED'
    JOIN public.public_experience_publication_state s ON s.experience_id = vs.experience_id
    JOIN public.publication_package_manifest_versions m ON m.id = vs.visible_manifest_version_id
    JOIN public.public_identity_display_state d ON d.public_identity_ref = m.publisher_public_identity_ref
    LEFT JOIN LATERAL public.derive_public_experience_current_placement_v1(vs.visible_experience_version_id) cp ON true
    LEFT JOIN public.public_experience_vitality_state st
      ON st.experience_id = vs.experience_id
     AND st.experience_version_id = vs.visible_experience_version_id
   WHERE vs.visibility_state = 'PUBLICLY_VISIBLE';
END$$;

-- ---------------------------------------------------------------------------
-- 6. SECURITY POSTURE.
-- ---------------------------------------------------------------------------
ALTER TABLE public.public_experience_vitality_state OWNER TO postgres;
ALTER TABLE public.public_experience_search_projection OWNER TO postgres;
ALTER TABLE public.public_experience_vitality_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_experience_search_projection ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_experience_vitality_state,
                    public.public_experience_search_projection
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.public_experience_vitality_state, public.public_experience_search_projection FROM service_role';
END IF;END$$;

ALTER FUNCTION public.recompute_public_experience_vitality_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.rebuild_public_experience_projection_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_public_experience_vitality_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.search_public_experiences_v1(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.resolve_public_lens_v1(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.resolve_public_panel_v1(uuid, uuid) OWNER TO postgres;

DO $$
DECLARE
  internal text[] := ARRAY[
    'public.recompute_public_experience_vitality_v1(uuid)',
    'public.rebuild_public_experience_projection_v1(uuid)'];
  resolvers text[] := ARRAY[
    'public.resolve_public_experience_vitality_v1(uuid, uuid)',
    'public.search_public_experiences_v1(uuid, text)',
    'public.resolve_public_lens_v1(uuid, text)',
    'public.resolve_public_panel_v1(uuid, uuid)'];
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
-- 7. SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  internal text[] := ARRAY[
    'public.recompute_public_experience_vitality_v1(uuid)',
    'public.rebuild_public_experience_projection_v1(uuid)'];
  resolvers text[] := ARRAY[
    'public.resolve_public_experience_vitality_v1(uuid, uuid)',
    'public.search_public_experiences_v1(uuid, text)',
    'public.resolve_public_lens_v1(uuid, text)',
    'public.resolve_public_panel_v1(uuid, uuid)'];
  projection_readers text[] := ARRAY[
    'public.search_public_experiences_v1(uuid, text)',
    'public.resolve_public_lens_v1(uuid, text)'];
  rebuild text := 'public.rebuild_public_experience_projection_v1(uuid)';
  recompute text := 'public.recompute_public_experience_vitality_v1(uuid)';
  own_tables text[] := ARRAY['public_experience_vitality_state', 'public_experience_search_projection'];
  fn text;
  t text;
  role_name text;
  p record;
BEGIN
  -- THE TWO WRITERS: postgres-owned, SECURITY DEFINER, pinned, VOLATILE,
  -- executable by nobody, machine-driven, bounded by the ONE visibility truth,
  -- and confined to their own derived family.
  FOREACH fn IN ARRAY internal LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc,
           pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-05B: % must be owned by postgres', fn; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-05B: % must be SECURITY DEFINER', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-05B: % must pin an empty search_path', fn;
    END IF;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-05B: derived-state writer % must be VOLATILE', fn; END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-05B: PUBLIC must not execute % before the frozen CW2-08 Launch Gate exists', fn;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name)
         AND has_function_privilege(role_name, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-05B: % must not execute % before the frozen CW2-08 Launch Gate exists', role_name, fn;
      END IF;
    END LOOP;
    IF p.prosrc ~ 'auth\.uid\(\)' THEN
      RAISE EXCEPTION 'I-05B: derived state % is machine state and derives no human', fn;
    END IF;
    IF p.prosrc !~ 'resolve_public_visibility_state_v1' OR p.prosrc !~ 'visibility_state = ''PUBLICLY_VISIBLE''' THEN
      RAISE EXCEPTION 'I-05B: derived state % must be bounded by the canonical visibility truth', fn;
    END IF;
    IF p.prosrc !~ 'FROM public\.public_experiences e WHERE e\.id = p_experience_id FOR SHARE' THEN
      RAISE EXCEPTION 'I-05B: % must hold the Experience row FOR SHARE while it derives', fn;
    END IF;
    IF p.prosrc ~ 'SET current_lifecycle' OR p.prosrc ~ 'to_lifecycle' OR p.prosrc ~ 'ABSENT_FROM_PUBLIC_WORLD' THEN
      RAISE EXCEPTION 'I-05B: % can move no lifecycle: derived state is never an authority', fn;
    END IF;
    IF p.prosrc ~ '(INSERT INTO|UPDATE|DELETE FROM) public\.(public_experiences|public_experience_versions|public_experience_lifecycle_events|public_experience_publication_state|public_experience_controllers|public_experience_semantic_placements|public_discussion_posts|public_qandeel_responses|publication_package|publication_manifest|publication_approval|shared_world|conversation_|users|public_identities|public_identity_display_state)' THEN
      RAISE EXCEPTION 'I-05B: % must write only its own derived family', fn;
    END IF;
    IF p.prosrc ~ 'publication_package_item_provenance' OR p.prosrc ~ 'shared_world' OR p.prosrc ~ 'conversation_unit' THEN
      RAISE EXCEPTION 'I-05B: % must read no sealed provenance and no source', fn;
    END IF;
    IF p.prosrc ~* 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
      RAISE EXCEPTION 'I-05B: % accepts no clock but one read of the database clock', fn;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' OR p.prosrc ~* 'TRUNCATE' THEN
      RAISE EXCEPTION 'I-05B: % locks rows in the canonical order and truncates nothing', fn;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 'i'
         AND arg.name ~ '(approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|count|revision|heat|rank|document|label|lens)'
    ) THEN
      RAISE EXCEPTION 'I-05B: % may not accept a derived value: it recomputes from canonical rows', fn;
    END IF;
  END LOOP;
  -- NO PROJECTION OUTLIVES VISIBILITY, and a recompute writes nothing for an
  -- invisible target.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = rebuild::regprocedure;
  IF p.prosrc !~ 'DELETE FROM public\.public_experience_search_projection pr WHERE pr\.experience_id = p_experience_id' THEN
    RAISE EXCEPTION 'I-05B: a projection of a non-visible Experience must be cleared on rebuild';
  END IF;
  IF p.prosrc !~ 'public_experience_text_derivative_bodies' OR p.prosrc !~ 'derive_public_experience_current_placement_v1' THEN
    RAISE EXCEPTION 'I-05B: the search projection is built from the public derivative bodies and the current interpretation only';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = recompute::regprocedure;
  IF p.prosrc !~ 'NOT_PUBLICLY_VISIBLE' THEN
    RAISE EXCEPTION 'I-05B: a vitality recompute of a non-visible Experience must report NOT_PUBLICLY_VISIBLE and write nothing';
  END IF;

  -- THE FOUR RESOLVERS: STABLE, service_role-only, both gates, version-matched,
  -- no provenance, no private identity, no writes.
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
  -- A STALE PROJECTION IS NEVER SERVED: search and lens require the stored row
  -- to describe the currently visible version.
  FOREACH fn IN ARRAY projection_readers LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc !~ 'vs\.visible_experience_version_id = pr\.experience_version_id' THEN
      RAISE EXCEPTION 'I-05B: % must serve a projection only while it describes the currently visible version', fn;
    END IF;
  END LOOP;
  IF (SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = 'public.resolve_public_experience_vitality_v1(uuid, uuid)'::regprocedure)
     !~ 'st\.experience_version_id = vs\.visible_experience_version_id' THEN
    RAISE EXCEPTION 'I-05B: vitality is served only for the version it was computed for';
  END IF;

  -- STRUCTURE: derived relations bind the exact version of the exact
  -- Experience, carry no source or decision column, and reach no control,
  -- approval or provenance.
  FOREACH t IN ARRAY own_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid = 'public.public_experience_versions'::regclass AND c.confdeltype = 'r'
    ) THEN
      RAISE EXCEPTION 'I-05B: relation % must bind the exact version it was derived for', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid NOT IN ('public.public_experience_versions'::regclass,
                                 'public.public_experiences'::regclass)
    ) THEN
      RAISE EXCEPTION 'I-05B: derived relation % may reference nothing but the Public Experience and its versions', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(safety|moderation|launch|entitlement|premium|feature_flag|allow|approv|control|consent|user_id|author|session|turn|conversation_unit|world_id|shared_|material_id|history_item|email|phone|contact|credential|source_|display_label)'
    ) THEN
      RAISE EXCEPTION 'I-05B: derived relation % may carry no authority decision source or private identity column', t;
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
