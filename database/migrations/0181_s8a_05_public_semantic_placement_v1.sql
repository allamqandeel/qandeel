-- S8A-05 CP3 - Public semantic intelligence and deterministic spatial placement (Controlled Amendment A-4).
--
-- Product authority: the Product Owner's S8A-05 CP3 order (2026-10-27), which applies the WP1 design with its binding
-- WP1-R1 corrections (P-dom, minimum spacing 8,000, placement inside the publication transaction); the S8A-05 CP3
-- controlled amendment (docs/canonical-authority/connected-worlds-v2/architecture/
-- QANDEEL_S8A-05_PUBLIC_SEMANTIC_PLACEMENT_CONTROLLED_AMENDMENT_v1.0.md). The implementation record is
-- docs/e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md (§12 onward).
--
-- ## What is added
--
--   A. AI-COST-01: the feature family PUBLIC_SEMANTIC_INTERPRETATION (the publisher pays for the reading they ask for).
--      Placement has no family: it is deterministic and calls no model.
--   B. public_region_private, a new private schema:
--        sub_regions   the closed vocabulary QANDEEL_PUBLIC_REGIONS_V1: 46 sub-regions of 13 majors, each with its
--                      ordinal (the tie rule) and its centre on the one global lattice. Immutable.
--        region_slots  every slot taken by the layout public_region_dominant_v1: the sub-region, the slot index of its
--                      fixed hexagonal spiral, the lattice point, the world point and the Experience. Append-only; one
--                      Experience per lattice point, so no two places are ever closer than 8,000 units.
--   C. Internal derivations, executable by no application role: the profile rule (1-3 known sub-regions, weights in
--      hundredths >= 10 summing to 100, the dominant one by weight then ordinal), the spiral slot, the title-free
--      24 KB interpreter input, and the slot assignment.
--   D. The server channel (service_role) gains two commands that replace, for the API, the two 0144 ones:
--        read_public_semantic_work_input_v2     the same admissible work, served as ONE bounded text (<= 24,576 bytes)
--        record_public_semantic_work_outcome_v2 the interpreter's answer with a closed region profile; the database
--                                               derives the dominant sub-region and records it as the 0144 lens key
--      The 0144 commands are unchanged and keep their grants (S5-03A's frozen channel). A lens key that is not a
--      sub-region of this vocabulary can never be placed (E).
--   E. The publication-time placement: public_region_private.publish_public_experience_with_placement_v1, executable
--      by NO role. Under the World singleton lock it assigns the reviewed dominant sub-region's first free slot, opens
--      and commits the 0145 placement through the unchanged 0145 request and commit, and then calls the unchanged 0121
--      publication in the SAME transaction. Publication is still closed: the 0095 CW2-08 seam answers NOT_EVALUATED, so
--      the publication raises and the placement rolls back with it. Nothing places an Experience before publication.
--
-- ## What is NOT changed
--
--   No frozen function is replaced; 0144, 0145, 0095 / 0121, 0179 and 0180 are untouched. No seam is opened. No grant
--   is widened beyond the two service_role commands. No coordinate is ever moved.

BEGIN;

-- =====================================================================================================================
-- A. AI-COST-01: the Public semantic interpretation family.
-- =====================================================================================================================
ALTER TABLE public.ai_provider_calls DROP CONSTRAINT ai_provider_calls_feature_family_check;
ALTER TABLE public.ai_provider_calls ADD CONSTRAINT ai_provider_calls_feature_family_check CHECK (feature_family IN (
  'CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION', 'THREAD_FORMATION', 'THREAD_CONTINUITY',
  'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION',
  'PERSONAL_UNDERSTANDING_CAPTURE', 'SHARED_SEMANTIC_READING', 'SHARED_KNOWLEDGE_RECALL', 'SHARED_SPATIAL_PLACEMENT',
  'SHARED_DISCLOSURE_JUDGE', 'PUBLIC_SEMANTIC_INTERPRETATION'));

-- =====================================================================================================================
-- B. THE SCHEMA, THE VOCABULARY AND THE SLOTS.
-- =====================================================================================================================
CREATE SCHEMA public_region_private;

CREATE TABLE public_region_private.sub_regions (
  region_key text NOT NULL,
  major_key text NOT NULL,
  ordinal integer NOT NULL,
  lattice_q bigint NOT NULL,
  lattice_r bigint NOT NULL,
  CONSTRAINT sub_regions_pk PRIMARY KEY (region_key),
  CONSTRAINT sub_regions_ordinal_key UNIQUE (ordinal),
  CONSTRAINT sub_regions_centre_key UNIQUE (lattice_q, lattice_r),
  CONSTRAINT sub_regions_key_check CHECK (region_key ~ '^[a-z]+\.[a-z_]+$' AND region_key LIKE major_key || '.%'),
  CONSTRAINT sub_regions_ordinal_check CHECK (ordinal >= 1)
);
COMMENT ON TABLE public_region_private.sub_regions IS
  'S8A-05 CP3 (A-4): the closed Public region vocabulary QANDEEL_PUBLIC_REGIONS_V1. Internal; never a category a person '
  'sees or picks, and not the browsing sections. Immutable.';

INSERT INTO public_region_private.sub_regions (region_key, major_key, ordinal, lattice_q, lattice_r) VALUES
  ('romance.attraction', 'romance', 1, -365, 594), ('romance.commitment', 'romance', 2, -271, 479),
  ('romance.betrayal', 'romance', 3, -193, 521), ('romance.breakup', 'romance', 4, -286, 636),
  ('marriage.daily_life', 'marriage', 5, -79, 554), ('marriage.conflict', 'marriage', 6, -36, 433),
  ('marriage.in_laws', 'marriage', 7, 78, 412), ('marriage.separation', 'marriage', 8, 36, 533),
  ('parenthood.raising', 'parenthood', 9, 229, 365), ('parenthood.adolescence', 'parenthood', 10, 242, 229),
  ('parenthood.fertility', 'parenthood', 11, 365, 242),
  ('family.parents', 'family', 12, 476, 78), ('family.siblings', 'family', 13, 396, 37),
  ('family.elder_care', 'family', 14, 490, -78), ('family.inheritance', 'family', 15, 569, -37),
  ('social.friendship', 'social', 16, 594, -229), ('social.loneliness', 'social', 17, 479, -208),
  ('social.pressure', 'social', 18, 521, -328), ('social.community', 'social', 19, 636, -350),
  ('work.pressure', 'work', 20, 554, -475), ('work.relations', 'work', 21, 433, -397),
  ('work.job_loss', 'work', 22, 412, -490), ('work.money', 'work', 23, 533, -569),
  ('learning.exams', 'learning', 24, 365, -594), ('learning.choices', 'learning', 25, 229, -471),
  ('learning.first_steps', 'learning', 26, 242, -607),
  ('transitions.migration', 'transitions', 27, 79, -554), ('transitions.relocation', 'transitions', 28, -8, -404),
  ('transitions.big_decision', 'transitions', 29, -71, -490),
  ('meaning.faith', 'meaning', 30, -229, -365), ('meaning.doubt', 'meaning', 31, -242, -229),
  ('meaning.values', 'meaning', 32, -365, -242),
  ('loss.grief', 'loss', 33, -476, -78), ('loss.trauma', 'loss', 34, -412, 8), ('loss.crisis', 'loss', 35, -561, 71),
  ('health.illness', 'health', 36, -594, 229), ('health.disability', 'health', 37, -479, 208),
  ('health.habits', 'health', 38, -521, 328), ('health.addiction', 'health', 39, -636, 350),
  ('inner.anxiety', 'inner', 40, -554, 475), ('inner.sadness', 'inner', 41, -433, 397),
  ('inner.self_worth', 'inner', 42, -412, 490), ('inner.anger', 'inner', 43, -533, 569),
  ('everyday.moments', 'everyday', 44, -43, 87), ('everyday.humor', 'everyday', 45, -43, -43),
  ('everyday.interests', 'everyday', 46, 86, -43);

CREATE TABLE public_region_private.region_slots (
  layout_version text NOT NULL,
  region_key text NOT NULL,
  slot_index bigint NOT NULL,
  lattice_q bigint NOT NULL,
  lattice_r bigint NOT NULL,
  world_x bigint NOT NULL,
  world_y bigint NOT NULL,
  experience_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL,
  CONSTRAINT region_slots_pk PRIMARY KEY (layout_version, region_key, slot_index),
  CONSTRAINT region_slots_point_key UNIQUE (layout_version, lattice_q, lattice_r),
  CONSTRAINT region_slots_experience_key UNIQUE (layout_version, experience_id, region_key),
  CONSTRAINT region_slots_layout_check CHECK (layout_version = 'public_region_dominant_v1'),
  CONSTRAINT region_slots_index_check CHECK (slot_index BETWEEN 0 AND 1000000000000),
  CONSTRAINT region_slots_point_check CHECK (world_x = 8000 * lattice_q + 4000 * lattice_r AND world_y = 6929 * lattice_r),
  CONSTRAINT region_slots_region_fk FOREIGN KEY (region_key) REFERENCES public_region_private.sub_regions (region_key) ON DELETE RESTRICT,
  CONSTRAINT region_slots_experience_fk FOREIGN KEY (experience_id) REFERENCES public.public_experiences (id) ON DELETE RESTRICT
);
COMMENT ON TABLE public_region_private.region_slots IS
  'S8A-05 CP3 (A-4): the slots of the layout public_region_dominant_v1, taken only inside the publication transaction. '
  'Append-only; one Experience per lattice point. No text, no account.';

CREATE FUNCTION public_region_private.reject_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'PUBLIC_REGION_HISTORY_IMMUTABLE' USING ERRCODE = '55000';
END$$;
CREATE TRIGGER sub_regions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public_region_private.sub_regions
  FOR EACH STATEMENT EXECUTE FUNCTION public_region_private.reject_mutation_v1();
CREATE TRIGGER region_slots_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON public_region_private.region_slots
  FOR EACH STATEMENT EXECUTE FUNCTION public_region_private.reject_mutation_v1();

-- =====================================================================================================================
-- C. INTERNAL DERIVATIONS. Executable by no application role.
-- =====================================================================================================================

-- C.1 The profile rule. The dominant sub-region of a well-formed profile, or 22023: 1-3 distinct known sub-regions;
--     weights in hundredths, each >= 10, summing to exactly 100; the highest weight wins, a tie goes to the lower ordinal.
CREATE FUNCTION public_region_private.profile_dominant_v1(p_keys text[], p_weights integer[])
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_dominant text;
BEGIN
  IF p_keys IS NULL OR p_weights IS NULL OR cardinality(p_keys) NOT BETWEEN 1 AND 3
     OR cardinality(p_keys) <> cardinality(p_weights) OR array_ndims(p_keys) <> 1 OR array_ndims(p_weights) <> 1
     OR EXISTS (SELECT 1 FROM unnest(p_weights) w WHERE w IS NULL OR w < 10 OR w > 100)
     OR (SELECT sum(w) FROM unnest(p_weights) w) <> 100
     OR (SELECT count(DISTINCT k) FROM unnest(p_keys) k) <> cardinality(p_keys)
     OR (SELECT count(*) FROM unnest(p_keys) k JOIN public_region_private.sub_regions s ON s.region_key = k) <> cardinality(p_keys) THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_OUTPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT p.k INTO v_dominant
    FROM unnest(p_keys, p_weights) AS p(k, w) JOIN public_region_private.sub_regions s ON s.region_key = p.k
   ORDER BY p.w DESC, s.ordinal
   LIMIT 1;
  RETURN v_dominant;
END$$;

-- C.2 Slot k of the fixed hexagonal spiral around a centre, as an axial offset. Slot 0 is the centre; ring n >= 1 holds
--     slots 3n(n-1)+1 .. 3n(n+1), walked from the corner (-n, n) along (1,0) (1,-1) (0,-1) (-1,0) (-1,1) (0,1).
CREATE FUNCTION public_region_private.hex_slot_v1(p_index bigint, OUT dq bigint, OUT dr bigint)
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  n bigint;
  s bigint;
  side integer;
  step bigint;
BEGIN
  IF p_index IS NULL OR p_index < 0 OR p_index > 1000000000000 THEN
    RAISE EXCEPTION 'PUBLIC_REGION_SLOT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_index = 0 THEN
    dq := 0; dr := 0;
    RETURN;
  END IF;
  n := floor((3 + sqrt(12::numeric * p_index - 3)) / 6)::bigint;
  WHILE 3 * n * (n + 1) + 1 <= p_index LOOP n := n + 1; END LOOP;
  WHILE 3 * n * (n - 1) + 1 > p_index LOOP n := n - 1; END LOOP;
  s := p_index - (3 * n * (n - 1) + 1);
  side := (s / n)::integer;
  step := s % n;
  CASE side
    WHEN 0 THEN dq := -n + step; dr := n;
    WHEN 1 THEN dq := step;      dr := n - step;
    WHEN 2 THEN dq := n;         dr := -step;
    WHEN 3 THEN dq := n - step;  dr := -n;
    WHEN 4 THEN dq := -step;     dr := -n + step;
    ELSE        dq := -n;        dr := step;
  END CASE;
END$$;

-- C.3 A deterministic identity for the publication-time placement request: a retried publication names the same row.
CREATE FUNCTION public_region_private.derive_identity_v1(p_namespace text, p_first uuid, p_second uuid)
RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 3) || substr(h, 21, 12))::uuid
    FROM (SELECT encode(sha256(convert_to('QANDEEL_S8A05_CP3_PUBLIC_REGION_IDENTITY_V1' || E'\n' || p_namespace || E'\n'
                                          || lower(p_first::text) || E'\n' || lower(p_second::text), 'UTF8')), 'hex') AS h) d;
$$;

-- C.4 THE INTERPRETER'S BOUNDED INPUT of one package (<= 24,576 bytes; the 0180 budget). The CP1 amendment A-2(b) keeps
--     the title and the section out of the interpretation, so - unlike 0180's interpreter_input_v1, which begins with
--     the title - nothing here reads either. A sourced package keeps 0180's priority: the written text, the
--     Understanding summary, the emphasized messages, then the conversation from both ends inward; whole items while
--     they fit, the first that does not is cut at a character boundary, nothing after it, all given in display order.
--     A package without a sealed presentation (S5-02) is given its present items in ordinal order under the same rule.
CREATE FUNCTION public_region_private.package_input_v1(p_manifest_version_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_budget constant integer := public_compose_source_private.interpreter_input_bytes_v1();
  v_positions integer[] := ARRAY[]::integer[];
  v_segments text[] := ARRAY[]::text[];
  v_out text[];
  v_used integer := 0;
  v_cut boolean := false;
  v_sourced boolean;
  r record;
BEGIN
  IF p_manifest_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_sourced := EXISTS (SELECT 1 FROM public_compose_source_private.item_presentation ip WHERE ip.manifest_version_id = p_manifest_version_id);
  FOR r IN
    WITH items AS (
      SELECT ip.display_position AS position, ip.item_role, ip.emphasized,
             CASE ip.item_role WHEN 'WRITTEN' THEN 'AUTHOR_TEXT' WHEN 'YOUR_MESSAGE' THEN 'AUTHOR'
                               WHEN 'QANDEEL_REPLY' THEN 'QANDEEL' ELSE 'QANDEEL_UNDERSTANDING' END
               || CASE WHEN ip.emphasized THEN ' [EMPHASIZED]' ELSE '' END || ': ' || b.public_text_body AS segment
        FROM public_compose_source_private.item_presentation ip
        JOIN public.publication_package_manifest_items it
          ON it.manifest_version_id = ip.manifest_version_id AND it.package_item_id = ip.package_item_id
         AND it.content_state = 'CONTENT_PRESENT'
        JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = ip.package_item_id
       WHERE v_sourced AND ip.manifest_version_id = p_manifest_version_id
      UNION ALL
      SELECT it.item_ordinal, 'LEGACY', false,
             CASE it.derivative_classification WHEN 'ANALYTICAL_DERIVATIVE' THEN 'ANALYSIS' ELSE 'SOURCE' END
               || ': ' || b.public_text_body
        FROM public.publication_package_manifest_items it
        JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
       WHERE NOT v_sourced AND it.manifest_version_id = p_manifest_version_id AND it.content_state = 'CONTENT_PRESENT'
    ), ranked AS (
      SELECT i.*, row_number() OVER (PARTITION BY (i.item_role IN ('YOUR_MESSAGE', 'QANDEEL_REPLY') AND NOT i.emphasized)
                                     ORDER BY i.position) AS asc_rank,
                  row_number() OVER (PARTITION BY (i.item_role IN ('YOUR_MESSAGE', 'QANDEEL_REPLY') AND NOT i.emphasized)
                                     ORDER BY i.position DESC) AS desc_rank
        FROM items i
    )
    SELECT r2.position, r2.segment FROM ranked r2
     ORDER BY CASE WHEN r2.item_role = 'WRITTEN' THEN 1 WHEN r2.item_role = 'QANDEEL_UNDERSTANDING' THEN 2
                   WHEN r2.emphasized THEN 3 WHEN r2.item_role = 'LEGACY' THEN 3 ELSE 4 END,
              CASE WHEN r2.item_role IN ('YOUR_MESSAGE', 'QANDEEL_REPLY') AND NOT r2.emphasized
                   THEN least(r2.asc_rank, r2.desc_rank) * 2 + CASE WHEN r2.asc_rank <= r2.desc_rank THEN 0 ELSE 1 END
                   ELSE r2.position END,
              r2.position
  LOOP
    EXIT WHEN v_cut OR v_used + 1 >= v_budget;
    IF v_used + (CASE WHEN v_used = 0 THEN 0 ELSE 1 END) + octet_length(r.segment) <= v_budget THEN
      v_positions := v_positions || r.position;
      v_segments := v_segments || r.segment;
      v_used := v_used + (CASE WHEN v_used = 0 THEN 0 ELSE 1 END) + octet_length(r.segment);
    ELSE
      v_positions := v_positions || r.position;
      v_segments := v_segments || public_compose_source_private.bounded_text_v1(r.segment,
                                    v_budget - v_used - (CASE WHEN v_used = 0 THEN 0 ELSE 1 END));
      v_cut := true;
    END IF;
  END LOOP;
  SELECT array_agg(c.segment ORDER BY c.position) INTO v_out FROM unnest(v_positions, v_segments) AS c(position, segment);
  RETURN coalesce(array_to_string(v_out, E'\n'), '');
END$$;

-- C.5 THE SLOT OF ONE EXPERIENCE in its reviewed dominant sub-region, under the World singleton lock the caller holds:
--     the slot it already has there (a place never moves; WP1-R1 V-11), else the first slot of the sub-region's spiral,
--     from just after its last taken slot, whose lattice point is free. Returns the world point.
CREATE FUNCTION public_region_private.assign_slot_v1(p_experience_id uuid, p_region_key text, OUT world_x bigint, OUT world_y bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_layout constant text := 'public_region_dominant_v1';
  v_centre public_region_private.sub_regions;
  v_k bigint;
  v_q bigint;
  v_r bigint;
  o record;
BEGIN
  SELECT s.* INTO v_centre FROM public_region_private.sub_regions s WHERE s.region_key = p_region_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_PLACEMENT_REGION_UNKNOWN' USING ERRCODE = '55000';
  END IF;
  SELECT rs.world_x, rs.world_y INTO world_x, world_y FROM public_region_private.region_slots rs
   WHERE rs.layout_version = v_layout AND rs.experience_id = p_experience_id AND rs.region_key = p_region_key;
  IF FOUND THEN
    RETURN;
  END IF;
  SELECT coalesce(max(rs.slot_index) + 1, 0) INTO v_k FROM public_region_private.region_slots rs
   WHERE rs.layout_version = v_layout AND rs.region_key = p_region_key;
  LOOP
    SELECT * INTO o FROM public_region_private.hex_slot_v1(v_k);
    v_q := v_centre.lattice_q + o.dq;
    v_r := v_centre.lattice_r + o.dr;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public_region_private.region_slots rs
                           WHERE rs.layout_version = v_layout AND rs.lattice_q = v_q AND rs.lattice_r = v_r);
    v_k := v_k + 1;
  END LOOP;
  world_x := 8000 * v_q + 4000 * v_r;
  world_y := 6929 * v_r;
  IF world_x NOT BETWEEN -4611686018427387904 AND 4611686018427387903
     OR world_y NOT BETWEEN -4611686018427387904 AND 4611686018427387903 THEN
    RAISE EXCEPTION 'PUBLIC_REGION_SLOT_INVALID' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public_region_private.region_slots
    (layout_version, region_key, slot_index, lattice_q, lattice_r, world_x, world_y, experience_id, assigned_at)
  VALUES (v_layout, p_region_key, v_k, v_q, v_r, world_x, world_y, p_experience_id, clock_timestamp());
END$$;

-- =====================================================================================================================
-- D. THE SERVER CHANNEL (service_role; never a client credential).
-- =====================================================================================================================

-- D.1 The interpreter's whole input for one admissible work: the work's kind, the package as ONE bounded text and, for
--     a correction, the publisher's own words as the database stored them. Zero rows exactly when 0144's reader serves
--     none (unknown work, already answered, or no longer admissible).
CREATE FUNCTION public_region_private.read_public_semantic_work_input_v2(p_work_id uuid)
RETURNS TABLE (work_kind text, package_text text, correction_meaning text, correction_primary_themes text[],
               correction_secondary_themes text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_work public_semantic_private.semantic_work;
  v_manifest uuid;
BEGIN
  IF p_work_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public_semantic_private.read_public_semantic_work_input_v1(p_work_id)) THEN
    RETURN;
  END IF;
  SELECT w.* INTO v_work FROM public_semantic_private.semantic_work w WHERE w.id = p_work_id;
  SELECT v.package_manifest_version_id INTO v_manifest FROM public.public_experience_versions v WHERE v.id = v_work.experience_version_id;
  RETURN QUERY SELECT v_work.work_kind, public_region_private.package_input_v1(v_manifest), v_work.correction_meaning,
                      v_work.correction_primary_themes, v_work.correction_secondary_themes;
END$$;

-- D.2 Record the interpreter's answer with its closed region profile: PROPOSED or CONSISTENT carry 1-3 sub-regions and
--     weights, NOT_SUPPORTED carries none. The database derives the dominant sub-region (C.1) and records it as the
--     0144 lens key through the unchanged 0144 command, which keeps its own rules (first answer wins; RECORDED |
--     ALREADY_RECORDED | STALE | UNAVAILABLE). Only the dominant sub-region is stored: the secondary meanings are the
--     themes the panel shows, and nothing else of the profile is kept.
CREATE FUNCTION public_region_private.record_public_semantic_work_outcome_v2(
  p_work_id uuid, p_outcome text, p_region_keys text[], p_region_weights integer[], p_meaning text, p_primary_themes text[],
  p_secondary_themes text[], p_explanation text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_dominant text;
BEGIN
  IF p_outcome IN ('PROPOSED', 'CONSISTENT') THEN
    v_dominant := public_region_private.profile_dominant_v1(p_region_keys, p_region_weights);
  ELSIF p_region_keys IS NOT NULL OR p_region_weights IS NOT NULL THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_OUTPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT o.outcome FROM public_semantic_private.record_public_semantic_work_outcome_v1(
    p_work_id, p_outcome, v_dominant, p_meaning, p_primary_themes, p_secondary_themes, p_explanation) o;
END$$;

-- =====================================================================================================================
-- E. THE PUBLICATION-TIME PLACEMENT. Executable by NO role: Stage 9 (CW2-08) exposes publication; until then the 0095
--    seam answers NOT_EVALUATED, the 0121 publication raises, and everything below rolls back with it.
-- =====================================================================================================================
CREATE FUNCTION public_region_private.publish_public_experience_with_placement_v1(
  p_command_id uuid, p_experience_id uuid, p_experience_version_id uuid
) RETURNS TABLE(outcome text, experience_id uuid, experience_version_id uuid,
                manifest_version_id uuid, current_lifecycle text, effective_approval_count integer,
                authority_request_fingerprint text, committed_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_lifecycle text;
  v_region text;
  v_request uuid;
  v_outcome text;
  v_x bigint;
  v_y bigint;
  r record;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_experience_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  -- CANONICAL LOCK ORDER (0095), STEP 1: the World singleton - every placement of the World serializes here, so the
  -- first free slot is the same whatever the concurrency. Then the Experience.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  SELECT e.current_lifecycle INTO v_lifecycle FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  -- Only a topic about to be published is placed; anything else (a retry after publication, a refused state) is the
  -- unchanged publication's own answer.
  IF v_lifecycle = 'READY_FOR_REVIEW' THEN
    SELECT * INTO r FROM public_spatial_private.derive_public_spatial_readiness_v1(p_experience_id);
    IF r.reason = 'NOT_SEMANTICALLY_READY' OR r.readiness IS NULL THEN
      RAISE EXCEPTION 'PUBLIC_PLACEMENT_NOT_SEMANTICALLY_READY' USING ERRCODE = '55000';
    END IF;
    IF r.experience_version_id IS DISTINCT FROM p_experience_version_id THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE = '40001';
    END IF;
    IF r.readiness <> 'SPATIALLY_READY' THEN
      SELECT ri.semantic_region INTO v_region FROM public_spatial_private.derive_reviewed_interpretation_v1(r.experience_version_id) ri;
      SELECT a.world_x, a.world_y INTO v_x, v_y FROM public_region_private.assign_slot_v1(p_experience_id, v_region) a;
      SELECT q.outcome, q.request_id INTO v_outcome, v_request
        FROM public_spatial_private.request_own_public_spatial_placement_v1(
               public_region_private.derive_identity_v1('PUBLICATION_PLACEMENT', p_command_id, p_experience_version_id),
               p_experience_id) q;
      IF v_outcome IS DISTINCT FROM 'REQUEST_OPEN' THEN
        RAISE EXCEPTION 'PUBLIC_PLACEMENT_NOT_ADMISSIBLE' USING ERRCODE = '55000';
      END IF;
      SELECT c.outcome INTO v_outcome
        FROM public_spatial_private.commit_public_spatial_placement_v1(v_request, 'public_region_dominant_v1', v_x, v_y) c;
      IF v_outcome IS DISTINCT FROM 'PLACED' THEN
        RAISE EXCEPTION 'PUBLIC_PLACEMENT_NOT_ADMISSIBLE' USING ERRCODE = '55000';
      END IF;
    END IF;
  END IF;
  RETURN QUERY SELECT * FROM public.publish_public_experience_v1(p_command_id, p_experience_id, p_experience_version_id);
END$$;

-- =====================================================================================================================
-- F. THE EXPOSED SERVER WRAPPERS (SECURITY INVOKER) AND THE GRANTS.
-- =====================================================================================================================
CREATE FUNCTION public.read_public_semantic_work_input_v2(p_work_id uuid)
RETURNS TABLE (work_kind text, package_text text, correction_meaning text, correction_primary_themes text[],
               correction_secondary_themes text[])
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_region_private.read_public_semantic_work_input_v2(p_work_id);
$$;
CREATE FUNCTION public.record_public_semantic_work_outcome_v2(
  p_work_id uuid, p_outcome text, p_region_keys text[], p_region_weights integer[], p_meaning text, p_primary_themes text[],
  p_secondary_themes text[], p_explanation text)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_region_private.record_public_semantic_work_outcome_v2(
    p_work_id, p_outcome, p_region_keys, p_region_weights, p_meaning, p_primary_themes, p_secondary_themes, p_explanation);
$$;

DO $$
DECLARE
  v_fn text;
  v_server text[] := ARRAY[
    'public.read_public_semantic_work_input_v2(uuid)',
    'public.record_public_semantic_work_outcome_v2(uuid, text, text[], integer[], text, text[], text[], text)',
    'public_region_private.read_public_semantic_work_input_v2(uuid)',
    'public_region_private.record_public_semantic_work_outcome_v2(uuid, text, text[], integer[], text, text[], text[], text)'];
  v_internal text[] := ARRAY[
    'public_region_private.reject_mutation_v1()',
    'public_region_private.profile_dominant_v1(text[], integer[])',
    'public_region_private.hex_slot_v1(bigint)',
    'public_region_private.derive_identity_v1(text, uuid, uuid)',
    'public_region_private.package_input_v1(uuid)',
    'public_region_private.assign_slot_v1(uuid, text)',
    'public_region_private.publish_public_experience_with_placement_v1(uuid, uuid, uuid)'];
BEGIN
  FOREACH v_fn IN ARRAY v_server || v_internal LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', v_fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', v_fn);
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public_region_private.sub_regions', 'public_region_private.region_slots'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', v_fn);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_fn);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', v_fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM service_role', v_fn);
    END IF;
  END LOOP;
  EXECUTE 'REVOKE ALL ON SCHEMA public_region_private FROM PUBLIC';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public_region_private TO service_role';
    FOREACH v_fn IN ARRAY v_server LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn);
    END LOOP;
  END IF;
END$$;

-- =====================================================================================================================
-- G. DEPLOY-TIME SELF-ASSERTIONS: the boundary is what this file says, or the migration fails.
-- =====================================================================================================================
DO $$
DECLARE
  v_writers integer;
  v_count integer;
  p record;
BEGIN
  -- G1. Publication is still closed: the CW2-08 seam answers NOT_EVALUATED.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)'::regprocedure;
  IF p.prosrc !~ 'NOT_EVALUATED' OR p.prosrc ~ '''CLEARED''' THEN
    RAISE EXCEPTION 'S8A-05 CP3: the publication seam must answer NOT_EVALUATED';
  END IF;
  -- G2. Still exactly FIVE functions move a Public Experience lifecycle (as 0179 / 0180 count them).
  SELECT count(*)::integer INTO v_writers
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
     AND (pr.prosrc ~ 'UPDATE public\.public_experiences e\s+SET current_lifecycle = '''
       OR pr.prosrc ~ 'INSERT INTO public\.public_experiences\s+\(id, public_world_singleton');
  IF v_writers <> 5 THEN
    RAISE EXCEPTION 'S8A-05 CP3: exactly five functions may move a Public Experience lifecycle, found %', v_writers;
  END IF;
  -- G3. No application role executes the publication-time placement, the slot assignment or any internal derivation;
  --     no role but service_role executes the two server commands.
  FOR p IN SELECT unnest(ARRAY[
             'public_region_private.publish_public_experience_with_placement_v1(uuid, uuid, uuid)',
             'public_region_private.assign_slot_v1(uuid, text)',
             'public_region_private.package_input_v1(uuid)',
             'public_region_private.profile_dominant_v1(text[], integer[])',
             'public_region_private.hex_slot_v1(bigint)',
             'public_region_private.derive_identity_v1(text, uuid, uuid)',
             'public.publish_public_experience_v1(uuid, uuid, uuid)']) AS fn LOOP
    IF has_function_privilege('public', p.fn, 'EXECUTE')
       OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND has_function_privilege('anon', p.fn, 'EXECUTE'))
       OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AND has_function_privilege('authenticated', p.fn, 'EXECUTE'))
       OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AND has_function_privilege('service_role', p.fn, 'EXECUTE')) THEN
      RAISE EXCEPTION 'S8A-05 CP3: an application role executes %', p.fn;
    END IF;
  END LOOP;
  FOR p IN SELECT unnest(ARRAY['public.read_public_semantic_work_input_v2(uuid)',
             'public.record_public_semantic_work_outcome_v2(uuid, text, text[], integer[], text, text[], text[], text)']) AS fn LOOP
    IF has_function_privilege('public', p.fn, 'EXECUTE')
       OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND has_function_privilege('anon', p.fn, 'EXECUTE'))
       OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AND has_function_privilege('authenticated', p.fn, 'EXECUTE')) THEN
      RAISE EXCEPTION 'S8A-05 CP3: a client role executes %', p.fn;
    END IF;
  END LOOP;
  -- G4. The vocabulary is the record's: 46 sub-regions of 13 majors, ordinals 1..46, centres on distinct lattice points.
  SELECT count(*)::integer INTO v_count FROM public_region_private.sub_regions;
  IF v_count <> 46 OR (SELECT count(DISTINCT major_key) FROM public_region_private.sub_regions) <> 13
     OR (SELECT min(ordinal) FROM public_region_private.sub_regions) <> 1 OR (SELECT max(ordinal) FROM public_region_private.sub_regions) <> 46 THEN
    RAISE EXCEPTION 'S8A-05 CP3: the region vocabulary differs from the record';
  END IF;
  -- G5. The spiral's first rings are the hexagonal ring order (centre, then 6, then 12 distinct points at ring distance).
  IF (SELECT count(DISTINCT (h.dq, h.dr)) FROM generate_series(0, 18) k, public_region_private.hex_slot_v1(k) h) <> 19
     OR EXISTS (SELECT 1 FROM generate_series(1, 18) k, public_region_private.hex_slot_v1(k) h
                 WHERE greatest(abs(h.dq), abs(h.dr), abs(h.dq + h.dr)) <> CASE WHEN k <= 6 THEN 1 ELSE 2 END) THEN
    RAISE EXCEPTION 'S8A-05 CP3: the slot spiral differs from the record';
  END IF;
  -- G6. Nothing here writes a coordinate except through the unchanged 0145 commit.
  IF EXISTS (SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
              WHERE n.nspname = 'public_region_private' AND pr.prosrc ~* '(INSERT INTO|UPDATE|DELETE FROM)\s+public_spatial_private\.') THEN
    RAISE EXCEPTION 'S8A-05 CP3: a region function writes the 0145 tables directly';
  END IF;
END$$;

COMMIT;
