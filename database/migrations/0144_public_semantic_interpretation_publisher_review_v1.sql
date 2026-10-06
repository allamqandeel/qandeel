-- S5-03A — Public Semantic Interpretation + Publisher Review v1.
--
-- Forward-only. No historical migration is edited and no frozen function is replaced. S5-02 ends at READY_FOR_REVIEW;
-- this migration builds the semantic stage BEFORE publication, on the frozen I-05 runtime:
--
--   READY_FOR_REVIEW
--   → the exact immutable Public package of the exact current Experience Version, and nothing else, as the input
--   → QANDEEL's semantic proposal (machine output, produced by the server channel only)
--   → the exact controller's review
--   → accept, OR a truth-constrained correction (checked by QANDEEL against the same package)
--   → a committed interpretation, appended as a revision of the frozen 0096 semantic placement of that exact version
--   → semantic readiness for that exact version, derived, fail-closed, never stored and never supplied
--
-- The lifecycle stays READY_FOR_REVIEW. Nothing here publishes, and nothing here decides coordinates.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- What is CONSUMED, unchanged (I-05, 0091–0099; S5-02, 0143)
-- ---------------------------------------------------------------------------------------------------------------------
--   * the Experience / controller / version / immutable package (0091 / 0092), READY_FOR_REVIEW (0093 / 0121 / 0143);
--   * the 0096 semantic placement family: version-bound, append-only revisions, `INITIAL_INTERPRETATION` for revision 1
--     and `PUBLISHER_CORRECTION` for every later one, written ONLY through the frozen
--     `record_public_experience_semantic_placement_v1` (exact controller from auth.uid(), Experience lock), and read
--     ONLY through the frozen `derive_public_experience_current_placement_v1` (the highest revision). Revision 1 is
--     QANDEEL's proposal; a publisher correction is the next revision. The frozen descriptor (`lens_key`,
--     `semantic_label` ≤ 120) carries the meaning and the structured placement intent S5-03B will consume;
--   * the S5-02 actor gate (`require_authoring_actor_v1`) and package wholeness (`public_package_state_v1`: an
--     ASSURE-F05-erased item, a missing body or a source the ONE 0093 derivation no longer accepts is not whole).
--
-- ---------------------------------------------------------------------------------------------------------------------
-- What is ADDED (the gap the frozen family does not hold)
-- ---------------------------------------------------------------------------------------------------------------------
-- One private schema, `public_semantic_private`, with four append-only relations and no reference to any account:
--   semantic_work               one requested interpretation or correction, bound to the exact version and to a
--                               server-derived fingerprint of its exact package; a correction carries the publisher's
--                               own words (meaning, themes) — human input, nothing else;
--   semantic_work_outcomes      the interpreter's structured answer for one work (machine state): PROPOSED (meaning,
--                               primary / secondary themes, a publisher-facing explanation, a lens key), CONSISTENT (a
--                               correction the package supports, with the lens key QANDEEL maps it to) or NOT_SUPPORTED;
--   semantic_interpretations    the themes and explanation of one committed 0096 revision, and which work produced it
--                               (QANDEEL_PROPOSAL ⇔ revision 1, PUBLISHER_CORRECTION ⇔ a later revision);
--   semantic_reviews            the publisher's review of one exact revision: ACCEPTED (a QANDEEL proposal) or
--                               CORRECTED (the publisher's own correction, reviewed by its making).
-- The frozen descriptor has no room for themes or an explanation and records no review; those are the only reasons
-- these relations exist. There is no second interpretation history: the revision order IS the 0096 one.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- PUBLIC PACKAGE ONLY — structural, not a prompt instruction (CW2-04 §12 / D14, D12)
-- ---------------------------------------------------------------------------------------------------------------------
-- The interpreter's input is served by ONE function, `read_public_semantic_work_input_v1`, executable by the server
-- channel only. Its body reads the work, the Experience, the version, the package items and their public bodies — and
-- nothing else: no sealed provenance, no Shared World, no Personal conversation, no memory, no human model, no
-- hypothesis, no Matching, no account, no Public identity or display label (an alias never shapes meaning, D12). The
-- deploy-time assertion below and the verifier hold every function of this schema to that ban by its source text.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- WHO MAY DO WHAT
-- ---------------------------------------------------------------------------------------------------------------------
--   authenticated (the human's own token; the exact controller, from auth.uid(), admitted by the frozen gate):
--     read_own_public_semantic_review_v1, request_own_public_semantic_proposal_v1,
--     request_own_public_semantic_correction_v1, commit_own_public_semantic_work_v1, accept_own_public_semantic_proposal_v1
--   service_role (the server channel; never a client credential):
--     read_public_semantic_work_input_v1, record_public_semantic_work_outcome_v1
-- A client can therefore never write what QANDEEL proposed: the content of a proposal arrives only through the server
-- channel, and the human's commit can only adopt an outcome the server recorded for that exact work. No command accepts
-- a user, a Public ref, a controller, an approver, an audience, a lifecycle, a visibility, a readiness, a fingerprint, a
-- digest, a lens, a coordinate, a rank, a proximity target or a vector.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- TRUTH-CONSTRAINED CORRECTION (CW2-04 §13 / D15)
-- ---------------------------------------------------------------------------------------------------------------------
-- The publisher corrects the MEANING — a short statement and its themes — never the map. QANDEEL then assesses the
-- correction against the same exact package: CONSISTENT commits a PUBLISHER_CORRECTION revision whose lens key QANDEEL
-- (not the publisher) assigns; NOT_SUPPORTED commits nothing. A correction changes no version, package, approval,
-- right or control, and needs no new version. A correction that would need different public content is not a
-- correction: it is a new package through the frozen preparation path, which READY_FOR_REVIEW does not reopen here.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- NOT A COPY (ASSURE-F05 stays closed)
-- ---------------------------------------------------------------------------------------------------------------------
-- A 0096 revision is immutable for every role, so it could never be erased if it quoted a human's words. Every meaning,
-- theme and explanation — QANDEEL's and the publisher's — is therefore refused if it contains a 32-character run of the
-- package text (case and whitespace folded). An interpretation is an analytical derivative (CW2-02 §27), not a copy.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- STALE AND ERASED
-- ---------------------------------------------------------------------------------------------------------------------
-- Every work, outcome, revision and review binds the fingerprint of its exact package (manifest, ordinals,
-- classifications, public digests). An ASSURE-F05 erasure NULLs a digest, so the package is no longer whole and the
-- fingerprint no longer derives: no input is served, no outcome is recorded, no commit lands, the review shows no
-- interpretation, and readiness answers PACKAGE_UNAVAILABLE. Nothing is rebuilt from anything private.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- Lock order
-- ---------------------------------------------------------------------------------------------------------------------
-- Every writer takes the exact Experience row FOR UPDATE (step 2 of the canonical order) and then writes its own family
-- only — the same lock the frozen placement primitive takes inside the same transaction. None takes the Public World
-- singleton: none moves a lifecycle or widens an audience.
--
-- What stays impossible, and is asserted at the end: PUBLISHED, the CW2-08 seam (still NOT_EVALUATED), any frozen I-05
-- primitive for an application role, discussion, Public QANDEEL, coordinates.

BEGIN;

-- =====================================================================================================================
-- A. THE PRIVATE SCHEMA AND ITS SHAPE RULES.
-- =====================================================================================================================
CREATE SCHEMA public_semantic_private;
REVOKE ALL ON SCHEMA public_semantic_private FROM PUBLIC;

-- A.1 A meaning (≤ 120, the frozen 0096 label bound), a theme (≤ 40) or an explanation (≤ 280): already trimmed, one
--     line, and naming no identifier — a semantic statement cannot point at another Experience.
CREATE FUNCTION public_semantic_private.semantic_text_is_well_formed_v1(p_text text, p_max integer)
RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_text IS NOT NULL AND p_text = btrim(p_text) AND length(p_text) BETWEEN 1 AND p_max
     AND p_text !~ '[\n\r\t]'
     AND p_text !~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
$$;

-- A.2 A theme set: p_min..p_max well-formed themes, distinct ignoring case.
CREATE FUNCTION public_semantic_private.semantic_themes_are_well_formed_v1(p_themes text[], p_min integer, p_max integer)
RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_themes IS NOT NULL AND coalesce(array_ndims(p_themes), 1) = 1
     AND cardinality(p_themes) BETWEEN p_min AND p_max
     AND NOT EXISTS (SELECT 1 FROM unnest(p_themes) t
                      WHERE NOT coalesce(public_semantic_private.semantic_text_is_well_formed_v1(t, 40), false))
     AND (SELECT count(DISTINCT lower(t)) FROM unnest(p_themes) t) = cardinality(p_themes);
$$;

-- A.3 A primary and a secondary theme are never the same theme.
CREATE FUNCTION public_semantic_private.semantic_themes_are_disjoint_v1(p_primary text[], p_secondary text[])
RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest(p_primary) a JOIN unnest(p_secondary) b ON lower(a) = lower(b));
$$;

-- =====================================================================================================================
-- B. THE FOUR APPEND-ONLY RELATIONS. No account reference anywhere (QAN-BL-ACCT-01 gains no new edge).
-- =====================================================================================================================
CREATE TABLE public_semantic_private.semantic_work (
    id uuid NOT NULL,
    work_kind text NOT NULL,
    experience_id uuid NOT NULL,
    experience_version_id uuid NOT NULL,
    package_fingerprint text NOT NULL,
    corrects_placement_id uuid,
    correction_meaning text,
    correction_primary_themes text[],
    correction_secondary_themes text[],
    request_ref text NOT NULL,
    requested_at timestamptz NOT NULL,
    CONSTRAINT semantic_work_pk PRIMARY KEY (id),
    CONSTRAINT semantic_work_kind_key UNIQUE (id, work_kind),
    CONSTRAINT semantic_work_kind_check CHECK (work_kind IN ('PROPOSAL', 'CORRECTION')),
    CONSTRAINT semantic_work_fingerprint_check CHECK (package_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT semantic_work_request_check CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    -- A correction names the exact revision it corrects and carries the publisher's own words; a proposal carries none.
    CONSTRAINT semantic_work_shape_check CHECK (
      CASE work_kind
        WHEN 'PROPOSAL' THEN corrects_placement_id IS NULL AND correction_meaning IS NULL
                             AND correction_primary_themes IS NULL AND correction_secondary_themes IS NULL
        ELSE corrects_placement_id IS NOT NULL
             AND public_semantic_private.semantic_text_is_well_formed_v1(correction_meaning, 120)
             AND public_semantic_private.semantic_themes_are_well_formed_v1(correction_primary_themes, 1, 3)
             AND public_semantic_private.semantic_themes_are_well_formed_v1(correction_secondary_themes, 0, 3)
             AND public_semantic_private.semantic_themes_are_disjoint_v1(correction_primary_themes, correction_secondary_themes)
      END),
    CONSTRAINT semantic_work_version_fk
        FOREIGN KEY (experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT semantic_work_corrects_fk
        FOREIGN KEY (corrects_placement_id)
        REFERENCES public.public_experience_semantic_placements (id) ON DELETE RESTRICT
);
CREATE INDEX semantic_work_version_idx ON public_semantic_private.semantic_work (experience_version_id, requested_at);

COMMENT ON TABLE public_semantic_private.semantic_work IS
  'S5-03A: one requested semantic interpretation (PROPOSAL) or publisher correction (CORRECTION) of ONE exact Public '
  'Experience Version, bound to a server-derived fingerprint of its exact immutable package. Append-only. No account.';

CREATE TABLE public_semantic_private.semantic_work_outcomes (
    work_id uuid NOT NULL,
    work_kind text NOT NULL,
    outcome text NOT NULL,
    lens_key text,
    meaning text,
    primary_themes text[],
    secondary_themes text[],
    explanation text,
    interpreter_contract text NOT NULL,
    produced_at timestamptz NOT NULL,
    CONSTRAINT semantic_work_outcomes_pk PRIMARY KEY (work_id),
    CONSTRAINT semantic_work_outcomes_work_fk
        FOREIGN KEY (work_id, work_kind) REFERENCES public_semantic_private.semantic_work (id, work_kind) ON DELETE RESTRICT,
    CONSTRAINT semantic_work_outcomes_contract_check CHECK (interpreter_contract = 'PUBLIC_SEMANTIC_INTERPRETATION_V1'),
    -- A proposal is answered by a proposal; a correction by an assessment.
    CONSTRAINT semantic_work_outcomes_kind_check CHECK (
      (work_kind = 'PROPOSAL' AND outcome = 'PROPOSED')
      OR (work_kind = 'CORRECTION' AND outcome IN ('CONSISTENT', 'NOT_SUPPORTED'))),
    CONSTRAINT semantic_work_outcomes_lens_check CHECK (lens_key IS NULL OR lens_key ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'),
    CONSTRAINT semantic_work_outcomes_shape_check CHECK (
      CASE outcome
        WHEN 'PROPOSED' THEN lens_key IS NOT NULL
             AND public_semantic_private.semantic_text_is_well_formed_v1(meaning, 120)
             AND public_semantic_private.semantic_themes_are_well_formed_v1(primary_themes, 1, 3)
             AND public_semantic_private.semantic_themes_are_well_formed_v1(secondary_themes, 0, 3)
             AND public_semantic_private.semantic_themes_are_disjoint_v1(primary_themes, secondary_themes)
             AND public_semantic_private.semantic_text_is_well_formed_v1(explanation, 280)
        WHEN 'CONSISTENT' THEN lens_key IS NOT NULL AND meaning IS NULL AND primary_themes IS NULL
             AND secondary_themes IS NULL AND explanation IS NULL
        ELSE lens_key IS NULL AND meaning IS NULL AND primary_themes IS NULL AND secondary_themes IS NULL
             AND explanation IS NULL
      END)
);

COMMENT ON TABLE public_semantic_private.semantic_work_outcomes IS
  'S5-03A: the semantic interpreter''s structured answer for one work. Machine state written by the server channel only: '
  'no author, no account, no approver. Append-only.';

CREATE TABLE public_semantic_private.semantic_interpretations (
    placement_id uuid NOT NULL,
    work_id uuid NOT NULL,
    work_kind text NOT NULL,
    experience_id uuid NOT NULL,
    experience_version_id uuid NOT NULL,
    origin text NOT NULL,
    primary_themes text[] NOT NULL,
    secondary_themes text[] NOT NULL,
    explanation text,
    package_fingerprint text NOT NULL,
    recorded_at timestamptz NOT NULL,
    CONSTRAINT semantic_interpretations_pk PRIMARY KEY (placement_id),
    CONSTRAINT semantic_interpretations_work_key UNIQUE (work_id),
    CONSTRAINT semantic_interpretations_origin_key UNIQUE (placement_id, origin),
    CONSTRAINT semantic_interpretations_origin_check CHECK (origin IN ('QANDEEL_PROPOSAL', 'PUBLISHER_CORRECTION')),
    CONSTRAINT semantic_interpretations_origin_kind_check CHECK ((origin = 'QANDEEL_PROPOSAL') = (work_kind = 'PROPOSAL')),
    -- QANDEEL explains its proposal to the publisher; a publisher's own correction needs no explanation.
    CONSTRAINT semantic_interpretations_explanation_check CHECK (
      CASE origin WHEN 'QANDEEL_PROPOSAL' THEN public_semantic_private.semantic_text_is_well_formed_v1(explanation, 280)
                  ELSE explanation IS NULL END),
    CONSTRAINT semantic_interpretations_themes_check CHECK (
      public_semantic_private.semantic_themes_are_well_formed_v1(primary_themes, 1, 3)
      AND public_semantic_private.semantic_themes_are_well_formed_v1(secondary_themes, 0, 3)
      AND public_semantic_private.semantic_themes_are_disjoint_v1(primary_themes, secondary_themes)),
    CONSTRAINT semantic_interpretations_fingerprint_check CHECK (package_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT semantic_interpretations_placement_fk
        FOREIGN KEY (placement_id) REFERENCES public.public_experience_semantic_placements (id) ON DELETE RESTRICT,
    CONSTRAINT semantic_interpretations_work_fk
        FOREIGN KEY (work_id, work_kind) REFERENCES public_semantic_private.semantic_work (id, work_kind) ON DELETE RESTRICT,
    CONSTRAINT semantic_interpretations_version_fk
        FOREIGN KEY (experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public_semantic_private.semantic_interpretations IS
  'S5-03A: the themes and explanation of ONE committed revision of the frozen 0096 semantic placement, and the work '
  'that produced it. QANDEEL_PROPOSAL is revision 1 (INITIAL_INTERPRETATION); PUBLISHER_CORRECTION a later revision.';

CREATE TABLE public_semantic_private.semantic_reviews (
    placement_id uuid NOT NULL,
    origin text NOT NULL,
    decision text NOT NULL,
    package_fingerprint text NOT NULL,
    request_ref text NOT NULL,
    reviewed_at timestamptz NOT NULL,
    CONSTRAINT semantic_reviews_pk PRIMARY KEY (placement_id),
    CONSTRAINT semantic_reviews_decision_check CHECK (decision IN ('ACCEPTED', 'CORRECTED')),
    -- A QANDEEL proposal is accepted; a publisher correction is reviewed by its making. Never crossed.
    CONSTRAINT semantic_reviews_decision_origin_check CHECK ((decision = 'ACCEPTED') = (origin = 'QANDEEL_PROPOSAL')),
    CONSTRAINT semantic_reviews_fingerprint_check CHECK (package_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT semantic_reviews_request_check CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT semantic_reviews_interpretation_fk
        FOREIGN KEY (placement_id, origin)
        REFERENCES public_semantic_private.semantic_interpretations (placement_id, origin) ON DELETE RESTRICT
);

COMMENT ON TABLE public_semantic_private.semantic_reviews IS
  'S5-03A: the exact controller''s review of ONE exact interpretation revision: ACCEPTED (QANDEEL''s proposal) or '
  'CORRECTED (their own truth-constrained correction). Append-only. Readiness is derived from it, never stored.';

-- B.1 Append-only, for every role including the table owner.
CREATE FUNCTION public_semantic_private.reject_semantic_history_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'PUBLIC_SEMANTIC_HISTORY_IS_IMMUTABLE'
    USING ERRCODE = '55000',
          DETAIL = 'Semantic work, outcomes, interpretations and reviews are append-only: a correction is a new revision.';
END$$;

CREATE TRIGGER semantic_work_immutable BEFORE UPDATE OR DELETE ON public_semantic_private.semantic_work
    FOR EACH ROW EXECUTE FUNCTION public_semantic_private.reject_semantic_history_mutation_v1();
CREATE TRIGGER semantic_work_outcomes_immutable BEFORE UPDATE OR DELETE ON public_semantic_private.semantic_work_outcomes
    FOR EACH ROW EXECUTE FUNCTION public_semantic_private.reject_semantic_history_mutation_v1();
CREATE TRIGGER semantic_interpretations_immutable BEFORE UPDATE OR DELETE ON public_semantic_private.semantic_interpretations
    FOR EACH ROW EXECUTE FUNCTION public_semantic_private.reject_semantic_history_mutation_v1();
CREATE TRIGGER semantic_reviews_immutable BEFORE UPDATE OR DELETE ON public_semantic_private.semantic_reviews
    FOR EACH ROW EXECUTE FUNCTION public_semantic_private.reject_semantic_history_mutation_v1();

-- =====================================================================================================================
-- C. INTERNAL DERIVATIONS. Executable by no application role.
-- =====================================================================================================================

-- C.1 Deterministic identities from the actor and the caller's command (or the work), so an equivalent retry names the
--     same rows and no caller supplies a work, placement or command identity.
CREATE FUNCTION public_semantic_private.derive_semantic_identity_v1(p_namespace text, p_actor uuid, p_seed uuid)
RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 3) || substr(h, 21, 12))::uuid
    FROM (SELECT encode(sha256(convert_to('QANDEEL_S5_03A_PUBLIC_SEMANTIC_IDENTITY_V1' || E'\n' || p_namespace || E'\n'
                                          || lower(p_actor::text) || E'\n' || lower(p_seed::text), 'UTF8')), 'hex') AS h) d;
$$;

-- C.2 The fingerprint of one exact package: its manifest, and every item's ordinal, classification and PUBLIC digest.
--     NULL when the package is empty or any item was erased (ASSURE-F05 NULLs the digest): an erased package has no
--     fingerprint, so nothing bound to the whole package can match it again.
CREATE FUNCTION public_semantic_private.derive_package_fingerprint_v1(p_manifest_version_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN count(*) = 0 OR bool_or(it.public_body_digest IS NULL OR it.content_state <> 'CONTENT_PRESENT') THEN NULL
         ELSE 'sha256:' || encode(sha256(convert_to(
                'QANDEEL_S5_03A_PUBLIC_SEMANTIC_PACKAGE_V1' || E'\n' || 'manifest=' || lower(p_manifest_version_id::text) || E'\n'
             || string_agg(it.item_ordinal::text || ':' || it.derivative_classification || ':' || it.public_body_digest,
                           E'\n' ORDER BY it.item_ordinal), 'UTF8')), 'hex') END
    FROM public.publication_package_manifest_items it
   WHERE it.manifest_version_id = p_manifest_version_id;
$$;

-- C.3 The semantic target of one Experience: CURRENT only for READY_FOR_REVIEW with a whole package of its exact
--     current version. NOT_READY_FOR_REVIEW (a Draft) | PACKAGE_UNAVAILABLE | UNAVAILABLE (nothing there).
CREATE FUNCTION public_semantic_private.resolve_semantic_target_v1(
  p_experience_id uuid, OUT target_state text, OUT current_lifecycle text, OUT experience_version_id uuid,
  OUT version_ordinal integer, OUT manifest_version_id uuid, OUT package_fingerprint text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_experience public.public_experiences;
BEGIN
  SELECT e.* INTO v_experience FROM public.public_experiences e WHERE e.id = p_experience_id;
  IF NOT FOUND THEN
    target_state := 'UNAVAILABLE';
    RETURN;
  END IF;
  current_lifecycle := v_experience.current_lifecycle;
  IF v_experience.current_lifecycle <> 'READY_FOR_REVIEW' OR v_experience.current_experience_version_id IS NULL THEN
    target_state := CASE WHEN v_experience.current_lifecycle = 'DRAFT' THEN 'NOT_READY_FOR_REVIEW' ELSE 'UNAVAILABLE' END;
    RETURN;
  END IF;
  SELECT v.id, v.version_ordinal, v.package_manifest_version_id INTO experience_version_id, version_ordinal, manifest_version_id
    FROM public.public_experience_versions v WHERE v.id = v_experience.current_experience_version_id;
  IF public_authoring_private.public_package_state_v1(manifest_version_id) <> 'INTACT' THEN
    target_state := 'PACKAGE_UNAVAILABLE';
    RETURN;
  END IF;
  package_fingerprint := public_semantic_private.derive_package_fingerprint_v1(manifest_version_id);
  target_state := CASE WHEN package_fingerprint IS NULL THEN 'PACKAGE_UNAVAILABLE' ELSE 'CURRENT' END;
END$$;

-- C.4 NOT A COPY: does this text contain a 32-character run of the package text (case and whitespace folded)?
CREATE FUNCTION public_semantic_private.copies_package_text_v1(p_text text, p_manifest_version_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_needle text := lower(regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g'));
  v_haystack text;
  v_at integer;
BEGIN
  IF length(v_needle) < 32 THEN
    RETURN false;
  END IF;
  SELECT string_agg(lower(regexp_replace(btrim(b.public_text_body), '\s+', ' ', 'g')), E'\n' ORDER BY it.item_ordinal)
    INTO v_haystack
    FROM public.publication_package_manifest_items it
    JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
   WHERE it.manifest_version_id = p_manifest_version_id;
  IF v_haystack IS NULL THEN
    RETURN false;
  END IF;
  FOR v_at IN 1 .. length(v_needle) - 31 LOOP
    IF strpos(v_haystack, substr(v_needle, v_at, 32)) > 0 THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END$$;

CREATE FUNCTION public_semantic_private.interpretation_copies_package_v1(
  p_meaning text, p_primary text[], p_secondary text[], p_explanation text, p_manifest_version_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public_semantic_private.copies_package_text_v1(p_meaning, p_manifest_version_id)
      OR public_semantic_private.copies_package_text_v1(p_explanation, p_manifest_version_id)
      OR EXISTS (SELECT 1 FROM unnest(coalesce(p_primary, '{}'::text[]) || coalesce(p_secondary, '{}'::text[])) t
                  WHERE public_semantic_private.copies_package_text_v1(t, p_manifest_version_id));
$$;

-- C.5 The request identity of one work: the actor, the kind, the exact target and package, and (for a correction) the
--     exact revision corrected and digests of the publisher's words. A commit re-derives it from auth.uid(), so only the
--     human who requested a work can adopt it.
CREATE FUNCTION public_semantic_private.derive_work_request_ref_v1(
  p_actor uuid, p_kind text, p_experience_id uuid, p_experience_version_id uuid, p_fingerprint text,
  p_corrects uuid, p_meaning text, p_primary text[], p_secondary text[])
RETURNS text
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_S5_03A_PUBLIC_SEMANTIC_WORK_V1' || E'\n'
   || 'actor=' || lower(p_actor::text) || E'\n'
   || 'kind=' || p_kind || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'experienceVersion=' || lower(p_experience_version_id::text) || E'\n'
   || 'package=' || p_fingerprint || E'\n'
   || 'corrects=' || coalesce(lower(p_corrects::text), '') || E'\n'
   || 'meaning=' || coalesce('sha256:' || encode(sha256(convert_to(p_meaning, 'UTF8')), 'hex'), '') || E'\n'
   || 'primary=' || coalesce('sha256:' || encode(sha256(convert_to(array_to_string(p_primary, E'\n'), 'UTF8')), 'hex'), '') || E'\n'
   || 'secondary=' || coalesce('sha256:' || encode(sha256(convert_to(array_to_string(p_secondary, E'\n'), 'UTF8')), 'hex'), ''),
   'UTF8')), 'hex');
$$;

-- C.6 May this work still receive an interpretation? ADMISSIBLE only while its exact package is still the whole,
--     current package of a READY_FOR_REVIEW Experience, and — for a proposal — no interpretation exists yet, or — for a
--     correction — the revision it corrects is still the current one. STALE otherwise; UNAVAILABLE when the package is
--     no longer whole or nothing is there.
CREATE FUNCTION public_semantic_private.work_admissibility_v1(p_work_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_work public_semantic_private.semantic_work;
  t record;
  v_current uuid;
BEGIN
  SELECT w.* INTO v_work FROM public_semantic_private.semantic_work w WHERE w.id = p_work_id;
  IF NOT FOUND THEN
    RETURN 'UNAVAILABLE';
  END IF;
  SELECT * INTO t FROM public_semantic_private.resolve_semantic_target_v1(v_work.experience_id);
  IF t.target_state = 'NOT_READY_FOR_REVIEW' OR t.target_state = 'UNAVAILABLE' OR t.target_state = 'PACKAGE_UNAVAILABLE' THEN
    RETURN 'UNAVAILABLE';
  END IF;
  IF t.experience_version_id <> v_work.experience_version_id OR t.package_fingerprint <> v_work.package_fingerprint THEN
    RETURN 'STALE';
  END IF;
  SELECT cp.placement_id INTO v_current FROM public.derive_public_experience_current_placement_v1(v_work.experience_version_id) cp;
  IF v_work.work_kind = 'PROPOSAL' AND v_current IS NOT NULL THEN
    RETURN 'STALE';
  END IF;
  IF v_work.work_kind = 'CORRECTION' AND v_current IS DISTINCT FROM v_work.corrects_placement_id THEN
    RETURN 'STALE';
  END IF;
  RETURN 'ADMISSIBLE';
END$$;

-- C.7 SEMANTIC READINESS of one Experience — the ONE boundary later tasks consume (S5-03B placement, the Stage-9
--     publication path) to ask: does this exact Experience Version carry a reviewed interpretation eligible for spatial
--     placement? Derived on every call, never stored, never supplied, fail-closed. SEMANTICALLY_READY only when the
--     Experience is READY_FOR_REVIEW, its exact current package is whole, the CURRENT (highest) 0096 revision of that
--     exact version was committed by S5-03A against that exact package, and the controller reviewed exactly that
--     revision against that exact package. Every other case is NOT_READY with one reason.
CREATE FUNCTION public_semantic_private.derive_public_semantic_readiness_v1(p_experience_id uuid)
RETURNS TABLE (readiness text, reason text, experience_version_id uuid, interpretation_id uuid, interpretation_revision integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t record;
  cp record;
  v_interpretation public_semantic_private.semantic_interpretations;
  v_review public_semantic_private.semantic_reviews;
BEGIN
  SELECT * INTO t FROM public_semantic_private.resolve_semantic_target_v1(p_experience_id);
  IF t.target_state <> 'CURRENT' THEN
    RETURN QUERY SELECT 'NOT_READY'::text, t.target_state, t.experience_version_id, NULL::uuid, NULL::integer;
    RETURN;
  END IF;
  SELECT * INTO cp FROM public.derive_public_experience_current_placement_v1(t.experience_version_id);
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_READY'::text, 'NO_INTERPRETATION'::text, t.experience_version_id, NULL::uuid, NULL::integer;
    RETURN;
  END IF;
  SELECT i.* INTO v_interpretation FROM public_semantic_private.semantic_interpretations i
   WHERE i.placement_id = cp.placement_id AND i.experience_version_id = t.experience_version_id;
  IF NOT FOUND THEN
    -- A revision this boundary did not commit is not a reviewed interpretation.
    RETURN QUERY SELECT 'NOT_READY'::text, 'UNREVIEWED_REVISION'::text, t.experience_version_id, cp.placement_id, cp.placement_revision;
    RETURN;
  END IF;
  IF v_interpretation.package_fingerprint <> t.package_fingerprint THEN
    RETURN QUERY SELECT 'NOT_READY'::text, 'STALE'::text, t.experience_version_id, cp.placement_id, cp.placement_revision;
    RETURN;
  END IF;
  SELECT r.* INTO v_review FROM public_semantic_private.semantic_reviews r WHERE r.placement_id = cp.placement_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_READY'::text, 'AWAITING_REVIEW'::text, t.experience_version_id, cp.placement_id, cp.placement_revision;
    RETURN;
  END IF;
  IF v_review.package_fingerprint <> t.package_fingerprint THEN
    RETURN QUERY SELECT 'NOT_READY'::text, 'STALE'::text, t.experience_version_id, cp.placement_id, cp.placement_revision;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'SEMANTICALLY_READY'::text, NULL::text, t.experience_version_id, cp.placement_id, cp.placement_revision;
END$$;

-- =====================================================================================================================
-- D. THE OWNER COMMANDS (authenticated, the exact controller from auth.uid()).
-- =====================================================================================================================

-- D.1 THE CONTROLLER'S SEMANTIC REVIEW of one Experience. Zero rows for a non-controller or an Experience that does not
--     exist or is no longer authorable (no oracle). One row otherwise:
--       NOT_READY_FOR_REVIEW  a Draft: the semantic stage begins at READY_FOR_REVIEW;
--       UNAVAILABLE           the package is no longer whole, or the current revision has no S5-03A record — no meaning,
--                             no theme, nothing of it is shown;
--       NO_PROPOSAL           QANDEEL has not proposed an interpretation of this exact version yet;
--       AWAITING_REVIEW       QANDEEL's proposal, waiting for the publisher to accept or correct it;
--       REVIEWED              the current revision was accepted or is the publisher's own correction.
--     The interpretation id is the current revision's — an id this boundary returns to this caller to bind accept and
--     correct to the exact revision seen. No lens key, no account, no Public ref, no package text leaves here.
CREATE FUNCTION public_semantic_private.read_own_public_semantic_review_v1(p_experience_id uuid)
RETURNS TABLE (semantic_state text, current_lifecycle text, version_ordinal integer, interpretation_id uuid,
               interpretation_revision integer, interpretation_origin text, meaning text, primary_themes text[],
               secondary_themes text[], explanation text, review_decision text, semantically_ready boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  t record;
  cp record;
  v_interpretation public_semantic_private.semantic_interpretations;
  v_decision text;
  v_ready boolean;
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.public_experiences e
                   JOIN public.public_experience_controllers c ON c.experience_id = e.id AND c.controller_user_id = v_user
                  WHERE e.id = p_experience_id AND e.current_lifecycle IN ('DRAFT', 'READY_FOR_REVIEW')) THEN
    RETURN;
  END IF;
  SELECT * INTO t FROM public_semantic_private.resolve_semantic_target_v1(p_experience_id);
  IF t.target_state = 'NOT_READY_FOR_REVIEW' THEN
    RETURN QUERY SELECT 'NOT_READY_FOR_REVIEW'::text, t.current_lifecycle, NULL::integer, NULL::uuid, NULL::integer, NULL::text,
                        NULL::text, NULL::text[], NULL::text[], NULL::text, NULL::text, false;
    RETURN;
  END IF;
  IF t.target_state <> 'CURRENT' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, t.current_lifecycle, t.version_ordinal, NULL::uuid, NULL::integer, NULL::text,
                        NULL::text, NULL::text[], NULL::text[], NULL::text, NULL::text, false;
    RETURN;
  END IF;
  SELECT * INTO cp FROM public.derive_public_experience_current_placement_v1(t.experience_version_id);
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NO_PROPOSAL'::text, t.current_lifecycle, t.version_ordinal, NULL::uuid, NULL::integer, NULL::text,
                        NULL::text, NULL::text[], NULL::text[], NULL::text, NULL::text, false;
    RETURN;
  END IF;
  SELECT i.* INTO v_interpretation FROM public_semantic_private.semantic_interpretations i
   WHERE i.placement_id = cp.placement_id AND i.experience_version_id = t.experience_version_id
     AND i.package_fingerprint = t.package_fingerprint;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, t.current_lifecycle, t.version_ordinal, NULL::uuid, NULL::integer, NULL::text,
                        NULL::text, NULL::text[], NULL::text[], NULL::text, NULL::text, false;
    RETURN;
  END IF;
  SELECT r.decision INTO v_decision FROM public_semantic_private.semantic_reviews r
   WHERE r.placement_id = cp.placement_id AND r.package_fingerprint = t.package_fingerprint;
  SELECT d.readiness = 'SEMANTICALLY_READY' INTO v_ready FROM public_semantic_private.derive_public_semantic_readiness_v1(p_experience_id) d;
  RETURN QUERY SELECT CASE WHEN v_decision IS NULL THEN 'AWAITING_REVIEW' ELSE 'REVIEWED' END::text,
                      t.current_lifecycle, t.version_ordinal, cp.placement_id, cp.placement_revision, v_interpretation.origin,
                      cp.semantic_label, v_interpretation.primary_themes, v_interpretation.secondary_themes,
                      v_interpretation.explanation, v_decision, coalesce(v_ready, false);
END$$;

-- D.2 ASK QANDEEL FOR ITS PROPOSAL of one exact READY_FOR_REVIEW version. This writes a work row and nothing else; the
--     server channel then serves the package-only input, runs the interpreter and records its outcome, and the human's
--     commit (D.4) adopts it as revision 1.
--       WORK_OPEN            a work the server may interpret (a new one, or this command's own retry)
--       WORK_STAGED          QANDEEL already answered a work for exactly this package; commit it, recompute nothing
--       ALREADY_INTERPRETED  this exact version already has an interpretation
--       NOT_READY_FOR_REVIEW | UNAVAILABLE (not the controller, nothing there, the package no longer whole) | STALE |
--       LIMITED              12 semantic works for one version within a day: the bound on interpreter spend
CREATE FUNCTION public_semantic_private.request_own_public_semantic_proposal_v1(p_command_id uuid, p_experience_id uuid)
RETURNS TABLE (outcome text, work_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_work uuid;
  v_existing public_semantic_private.semantic_work;
  v_retry boolean;
  v_staged uuid;
  v_request text;
  t record;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_work := public_semantic_private.derive_semantic_identity_v1('WORK', v_user, p_command_id);
  -- CANONICAL LOCK ORDER, STEP 2: the exact Experience.
  PERFORM 1 FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                               WHERE c.experience_id = p_experience_id AND c.controller_user_id = v_user) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  SELECT w.* INTO v_existing FROM public_semantic_private.semantic_work w WHERE w.id = v_work;
  v_retry := FOUND;
  IF v_retry AND (v_existing.experience_id <> p_experience_id OR v_existing.work_kind <> 'PROPOSAL') THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_COMMAND_ID_CONFLICT' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO t FROM public_semantic_private.resolve_semantic_target_v1(p_experience_id);
  IF t.target_state = 'NOT_READY_FOR_REVIEW' THEN
    RETURN QUERY SELECT 'NOT_READY_FOR_REVIEW'::text, NULL::uuid;
    RETURN;
  END IF;
  IF t.target_state <> 'CURRENT' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.derive_public_experience_current_placement_v1(t.experience_version_id)) THEN
    RETURN QUERY SELECT 'ALREADY_INTERPRETED'::text, NULL::uuid;
    RETURN;
  END IF;
  v_request := public_semantic_private.derive_work_request_ref_v1(v_user, 'PROPOSAL', p_experience_id, t.experience_version_id,
                 t.package_fingerprint, NULL, NULL, NULL, NULL);
  -- QANDEEL already answered for exactly this package and this human: adopt that answer, never pay for a second one.
  SELECT w.id INTO v_staged
    FROM public_semantic_private.semantic_work w
    JOIN public_semantic_private.semantic_work_outcomes o ON o.work_id = w.id
   WHERE w.experience_version_id = t.experience_version_id AND w.work_kind = 'PROPOSAL' AND w.request_ref = v_request
   ORDER BY o.produced_at, w.id
   LIMIT 1;
  IF v_staged IS NOT NULL THEN
    RETURN QUERY SELECT 'WORK_STAGED'::text, v_staged;
    RETURN;
  END IF;
  IF v_retry THEN
    IF v_existing.request_ref <> v_request THEN
      RETURN QUERY SELECT 'STALE'::text, NULL::uuid;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'WORK_OPEN'::text, v_existing.id;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM public_semantic_private.semantic_work w
       WHERE w.experience_version_id = t.experience_version_id
         AND w.requested_at > clock_timestamp() - interval '1 day') >= 12 THEN
    RETURN QUERY SELECT 'LIMITED'::text, NULL::uuid;
    RETURN;
  END IF;
  INSERT INTO public_semantic_private.semantic_work
    (id, work_kind, experience_id, experience_version_id, package_fingerprint, request_ref, requested_at)
  VALUES (v_work, 'PROPOSAL', p_experience_id, t.experience_version_id, t.package_fingerprint, v_request, clock_timestamp());
  RETURN QUERY SELECT 'WORK_OPEN'::text, v_work;
END$$;

-- D.3 ASK TO CORRECT the meaning of the exact current revision, in the publisher's own words: a short meaning and 1–3
--     primary / 0–3 secondary themes. Never a coordinate, a location, a rank, a weight, a neighbour or a vector — the
--     signature has no room for one. QANDEEL then assesses the correction against the same package (server channel)
--     and D.4 commits it only when it is CONSISTENT.
--       WORK_OPEN | WORK_STAGED | UNCHANGED (identical to the current revision) | QUOTES_CONTENT (copies the package
--       text: an interpretation is not a copy) | NO_PROPOSAL | STALE (not the current revision) |
--       NOT_READY_FOR_REVIEW | UNAVAILABLE | LIMITED
CREATE FUNCTION public_semantic_private.request_own_public_semantic_correction_v1(
  p_command_id uuid, p_experience_id uuid, p_interpretation_id uuid, p_meaning text, p_primary_themes text[],
  p_secondary_themes text[])
RETURNS TABLE (outcome text, work_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_work uuid;
  v_existing public_semantic_private.semantic_work;
  v_retry boolean;
  v_request text;
  t record;
  cp record;
  v_interpretation public_semantic_private.semantic_interpretations;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_interpretation_id IS NULL
     OR NOT coalesce(public_semantic_private.semantic_text_is_well_formed_v1(p_meaning, 120), false)
     OR NOT coalesce(public_semantic_private.semantic_themes_are_well_formed_v1(p_primary_themes, 1, 3), false)
     OR NOT coalesce(public_semantic_private.semantic_themes_are_well_formed_v1(p_secondary_themes, 0, 3), false)
     OR NOT public_semantic_private.semantic_themes_are_disjoint_v1(p_primary_themes, p_secondary_themes) THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_work := public_semantic_private.derive_semantic_identity_v1('WORK', v_user, p_command_id);
  PERFORM 1 FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                               WHERE c.experience_id = p_experience_id AND c.controller_user_id = v_user) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  SELECT w.* INTO v_existing FROM public_semantic_private.semantic_work w WHERE w.id = v_work;
  v_retry := FOUND;
  IF v_retry AND (v_existing.experience_id <> p_experience_id OR v_existing.work_kind <> 'CORRECTION') THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_COMMAND_ID_CONFLICT' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO t FROM public_semantic_private.resolve_semantic_target_v1(p_experience_id);
  IF t.target_state = 'NOT_READY_FOR_REVIEW' THEN
    RETURN QUERY SELECT 'NOT_READY_FOR_REVIEW'::text, NULL::uuid;
    RETURN;
  END IF;
  IF t.target_state <> 'CURRENT' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  v_request := public_semantic_private.derive_work_request_ref_v1(v_user, 'CORRECTION', p_experience_id, t.experience_version_id,
                 t.package_fingerprint, p_interpretation_id, p_meaning, p_primary_themes, p_secondary_themes);
  IF v_retry THEN
    IF v_existing.request_ref <> v_request THEN
      RAISE EXCEPTION 'PUBLIC_SEMANTIC_COMMAND_ID_CONFLICT' USING ERRCODE = '23505';
    END IF;
    IF EXISTS (SELECT 1 FROM public_semantic_private.semantic_work_outcomes o WHERE o.work_id = v_existing.id) THEN
      RETURN QUERY SELECT 'WORK_STAGED'::text, v_existing.id;
      RETURN;
    END IF;
  END IF;
  SELECT * INTO cp FROM public.derive_public_experience_current_placement_v1(t.experience_version_id);
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NO_PROPOSAL'::text, NULL::uuid;
    RETURN;
  END IF;
  IF cp.placement_id <> p_interpretation_id THEN
    RETURN QUERY SELECT 'STALE'::text, NULL::uuid;
    RETURN;
  END IF;
  SELECT i.* INTO v_interpretation FROM public_semantic_private.semantic_interpretations i
   WHERE i.placement_id = cp.placement_id AND i.package_fingerprint = t.package_fingerprint;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  IF v_retry THEN
    RETURN QUERY SELECT 'WORK_OPEN'::text, v_existing.id;
    RETURN;
  END IF;
  IF p_meaning = cp.semantic_label AND p_primary_themes = v_interpretation.primary_themes
     AND p_secondary_themes = v_interpretation.secondary_themes THEN
    RETURN QUERY SELECT 'UNCHANGED'::text, NULL::uuid;
    RETURN;
  END IF;
  IF public_semantic_private.interpretation_copies_package_v1(p_meaning, p_primary_themes, p_secondary_themes, NULL,
                                                              t.manifest_version_id) THEN
    RETURN QUERY SELECT 'QUOTES_CONTENT'::text, NULL::uuid;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM public_semantic_private.semantic_work w
       WHERE w.experience_version_id = t.experience_version_id
         AND w.requested_at > clock_timestamp() - interval '1 day') >= 12 THEN
    RETURN QUERY SELECT 'LIMITED'::text, NULL::uuid;
    RETURN;
  END IF;
  INSERT INTO public_semantic_private.semantic_work
    (id, work_kind, experience_id, experience_version_id, package_fingerprint, corrects_placement_id, correction_meaning,
     correction_primary_themes, correction_secondary_themes, request_ref, requested_at)
  VALUES (v_work, 'CORRECTION', p_experience_id, t.experience_version_id, t.package_fingerprint, p_interpretation_id, p_meaning,
          p_primary_themes, p_secondary_themes, v_request, clock_timestamp());
  RETURN QUERY SELECT 'WORK_OPEN'::text, v_work;
END$$;

-- D.4 COMMIT what QANDEEL answered for one of this human's own works. The work's request identity is re-derived from
--     auth.uid(): only the human who requested it can adopt it. Under the Experience lock the exact package must still
--     be the whole current one; then:
--       a PROPOSED proposal   → revision 1 (INITIAL_INTERPRETATION) through the frozen 0096 primitive, + its themes
--       a CONSISTENT correction → the next revision (PUBLISHER_CORRECTION) through the frozen primitive, + its themes,
--                                 + the review CORRECTED (the publisher's own words are their review)
--     PROPOSED | CORRECTED | ALREADY_COMMITTED | NOT_SUPPORTED (QANDEEL found the correction unsupported by the package;
--     nothing is written) | PENDING (no answer yet) | STALE | NOT_READY_FOR_REVIEW | UNAVAILABLE
CREATE FUNCTION public_semantic_private.commit_own_public_semantic_work_v1(p_work_id uuid)
RETURNS TABLE (outcome text, interpretation_id uuid, interpretation_revision integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_work public_semantic_private.semantic_work;
  v_outcome public_semantic_private.semantic_work_outcomes;
  v_done public_semantic_private.semantic_interpretations;
  v_admissible text;
  v_placement uuid;
  v_meaning text;
  v_primary text[];
  v_secondary text[];
  t record;
  r record;
  v_instant timestamptz;
BEGIN
  IF p_work_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT w.* INTO v_work FROM public_semantic_private.semantic_work w WHERE w.id = p_work_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::integer;
    RETURN;
  END IF;
  -- CANONICAL LOCK ORDER, STEP 2: the exact Experience — the lock the frozen primitive takes again below.
  PERFORM 1 FROM public.public_experiences e WHERE e.id = v_work.experience_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                  WHERE c.experience_id = v_work.experience_id AND c.controller_user_id = v_user)
     OR v_work.request_ref <> public_semantic_private.derive_work_request_ref_v1(
          v_user, v_work.work_kind, v_work.experience_id, v_work.experience_version_id, v_work.package_fingerprint,
          v_work.corrects_placement_id, v_work.correction_meaning, v_work.correction_primary_themes,
          v_work.correction_secondary_themes) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::integer;
    RETURN;
  END IF;
  -- An equivalent retry answers from the committed truth, even after the package changed.
  SELECT i.* INTO v_done FROM public_semantic_private.semantic_interpretations i WHERE i.work_id = v_work.id;
  IF FOUND THEN
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, v_done.placement_id,
                        (SELECT sp.placement_revision FROM public.derive_public_experience_current_placement_v1(v_work.experience_version_id) sp
                          WHERE sp.placement_id = v_done.placement_id);
    RETURN;
  END IF;
  SELECT * INTO t FROM public_semantic_private.resolve_semantic_target_v1(v_work.experience_id);
  IF t.target_state = 'NOT_READY_FOR_REVIEW' THEN
    RETURN QUERY SELECT 'NOT_READY_FOR_REVIEW'::text, NULL::uuid, NULL::integer;
    RETURN;
  END IF;
  v_admissible := public_semantic_private.work_admissibility_v1(v_work.id);
  IF v_admissible <> 'ADMISSIBLE' THEN
    RETURN QUERY SELECT v_admissible, NULL::uuid, NULL::integer;
    RETURN;
  END IF;
  SELECT o.* INTO v_outcome FROM public_semantic_private.semantic_work_outcomes o WHERE o.work_id = v_work.id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'PENDING'::text, NULL::uuid, NULL::integer;
    RETURN;
  END IF;
  IF v_outcome.outcome = 'NOT_SUPPORTED' THEN
    RETURN QUERY SELECT 'NOT_SUPPORTED'::text, NULL::uuid, NULL::integer;
    RETURN;
  END IF;
  IF v_work.work_kind = 'PROPOSAL' THEN
    v_meaning := v_outcome.meaning;
    v_primary := v_outcome.primary_themes;
    v_secondary := v_outcome.secondary_themes;
  ELSE
    v_meaning := v_work.correction_meaning;
    v_primary := v_work.correction_primary_themes;
    v_secondary := v_work.correction_secondary_themes;
  END IF;
  -- NOT A COPY, re-proven against the exact package at the moment of commit.
  IF public_semantic_private.interpretation_copies_package_v1(v_meaning, v_primary, v_secondary, v_outcome.explanation,
                                                              t.manifest_version_id) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::integer;
    RETURN;
  END IF;
  v_placement := public_semantic_private.derive_semantic_identity_v1('PLACEMENT', v_user, v_work.id);
  SELECT d.placement_revision, d.placement_basis INTO r
    FROM public.record_public_experience_semantic_placement_v1(
           public_semantic_private.derive_semantic_identity_v1('PLACEMENT_COMMAND', v_user, v_work.id), v_placement,
           v_work.experience_id, v_work.experience_version_id, v_outcome.lens_key, v_meaning) d;
  -- The frozen basis must be exactly the origin: revision 1 is QANDEEL's proposal, a later one the publisher's.
  IF (v_work.work_kind = 'PROPOSAL') <> (r.placement_basis = 'INITIAL_INTERPRETATION') THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_REVISION_ORDER_VIOLATED' USING ERRCODE = '55000';
  END IF;
  v_instant := clock_timestamp();
  INSERT INTO public_semantic_private.semantic_interpretations
    (placement_id, work_id, work_kind, experience_id, experience_version_id, origin, primary_themes, secondary_themes,
     explanation, package_fingerprint, recorded_at)
  VALUES (v_placement, v_work.id, v_work.work_kind, v_work.experience_id, v_work.experience_version_id,
          CASE WHEN v_work.work_kind = 'PROPOSAL' THEN 'QANDEEL_PROPOSAL' ELSE 'PUBLISHER_CORRECTION' END,
          v_primary, v_secondary, CASE WHEN v_work.work_kind = 'PROPOSAL' THEN v_outcome.explanation END,
          v_work.package_fingerprint, v_instant);
  IF v_work.work_kind = 'CORRECTION' THEN
    INSERT INTO public_semantic_private.semantic_reviews
      (placement_id, origin, decision, package_fingerprint, request_ref, reviewed_at)
    VALUES (v_placement, 'PUBLISHER_CORRECTION', 'CORRECTED', v_work.package_fingerprint, v_work.request_ref, v_instant);
    RETURN QUERY SELECT 'CORRECTED'::text, v_placement, r.placement_revision;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'PROPOSED'::text, v_placement, r.placement_revision;
END$$;

-- D.5 ACCEPT QANDEEL's proposal — exactly the current revision the publisher saw, against the exact current package.
--     ACCEPTED | ALREADY_ACCEPTED | ALREADY_REVIEWED (the current revision is the publisher's own correction) |
--     STALE (not the current revision) | NO_PROPOSAL | NOT_READY_FOR_REVIEW | UNAVAILABLE
CREATE FUNCTION public_semantic_private.accept_own_public_semantic_proposal_v1(
  p_command_id uuid, p_experience_id uuid, p_interpretation_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  t record;
  cp record;
  v_interpretation public_semantic_private.semantic_interpretations;
  v_review public_semantic_private.semantic_reviews;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_interpretation_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                               WHERE c.experience_id = p_experience_id AND c.controller_user_id = v_user) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  SELECT * INTO t FROM public_semantic_private.resolve_semantic_target_v1(p_experience_id);
  IF t.target_state = 'NOT_READY_FOR_REVIEW' THEN
    RETURN QUERY SELECT 'NOT_READY_FOR_REVIEW'::text;
    RETURN;
  END IF;
  IF t.target_state <> 'CURRENT' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  SELECT * INTO cp FROM public.derive_public_experience_current_placement_v1(t.experience_version_id);
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NO_PROPOSAL'::text;
    RETURN;
  END IF;
  IF cp.placement_id <> p_interpretation_id THEN
    RETURN QUERY SELECT 'STALE'::text;
    RETURN;
  END IF;
  SELECT i.* INTO v_interpretation FROM public_semantic_private.semantic_interpretations i
   WHERE i.placement_id = cp.placement_id AND i.package_fingerprint = t.package_fingerprint;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  SELECT r.* INTO v_review FROM public_semantic_private.semantic_reviews r WHERE r.placement_id = cp.placement_id;
  IF FOUND THEN
    RETURN QUERY SELECT CASE WHEN v_review.decision = 'ACCEPTED' THEN 'ALREADY_ACCEPTED' ELSE 'ALREADY_REVIEWED' END::text;
    RETURN;
  END IF;
  IF v_interpretation.origin <> 'QANDEEL_PROPOSAL' THEN
    RETURN QUERY SELECT 'ALREADY_REVIEWED'::text;
    RETURN;
  END IF;
  INSERT INTO public_semantic_private.semantic_reviews (placement_id, origin, decision, package_fingerprint, request_ref, reviewed_at)
  VALUES (cp.placement_id, 'QANDEEL_PROPOSAL', 'ACCEPTED', t.package_fingerprint,
          'sha256:' || encode(sha256(convert_to('QANDEEL_S5_03A_PUBLIC_SEMANTIC_ACCEPT_V1' || E'\n'
            || 'actor=' || lower(v_user::text) || E'\n' || 'command=' || lower(p_command_id::text) || E'\n'
            || 'interpretation=' || lower(cp.placement_id::text) || E'\n' || 'package=' || t.package_fingerprint, 'UTF8')), 'hex'),
          clock_timestamp());
  RETURN QUERY SELECT 'ACCEPTED'::text;
END$$;

-- =====================================================================================================================
-- E. THE SERVER CHANNEL (service_role only): the package-only input, and the interpreter's recorded answer.
-- =====================================================================================================================

-- E.1 THE INTERPRETER'S ENTIRE INPUT for one admissible work without an answer: the exact package items of the exact
--     version — ordinal, whether the item is source content or QANDEEL analysis, and its exact public text — and, for a
--     correction, the publisher's own words. Nothing else exists for the interpreter: this body reads no provenance, no
--     Shared World, no Personal conversation, no account, no identity and no display label. Zero rows otherwise.
CREATE FUNCTION public_semantic_private.read_public_semantic_work_input_v1(p_work_id uuid)
RETURNS TABLE (work_kind text, item_ordinal integer, item_kind text, item_text text, correction_meaning text,
               correction_primary_themes text[], correction_secondary_themes text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_work public_semantic_private.semantic_work;
BEGIN
  IF p_work_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT w.* INTO v_work FROM public_semantic_private.semantic_work w WHERE w.id = p_work_id;
  IF NOT FOUND
     OR EXISTS (SELECT 1 FROM public_semantic_private.semantic_work_outcomes o WHERE o.work_id = p_work_id)
     OR public_semantic_private.work_admissibility_v1(p_work_id) <> 'ADMISSIBLE' THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT v_work.work_kind, it.item_ordinal,
           CASE it.derivative_classification WHEN 'ANALYTICAL_DERIVATIVE' THEN 'ANALYSIS' ELSE 'SOURCE_CONTENT' END,
           b.public_text_body, v_work.correction_meaning, v_work.correction_primary_themes, v_work.correction_secondary_themes
      FROM public.public_experience_versions v
      JOIN public.publication_package_manifest_items it ON it.manifest_version_id = v.package_manifest_version_id
      JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
     WHERE v.id = v_work.experience_version_id AND it.content_state = 'CONTENT_PRESENT'
     ORDER BY it.item_ordinal;
END$$;

-- E.2 RECORD THE INTERPRETER'S ANSWER for one admissible work, first answer wins. The shape is the work's own: a
--     proposal is PROPOSED (lens key, meaning, themes, explanation); a correction is CONSISTENT (lens key) or
--     NOT_SUPPORTED. A malformed answer is refused (22023) and records nothing; an answer that copies the package text
--     is COPIES_PACKAGE and records nothing. RECORDED | ALREADY_RECORDED | COPIES_PACKAGE | STALE | UNAVAILABLE.
CREATE FUNCTION public_semantic_private.record_public_semantic_work_outcome_v1(
  p_work_id uuid, p_outcome text, p_lens_key text, p_meaning text, p_primary_themes text[], p_secondary_themes text[],
  p_explanation text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_work public_semantic_private.semantic_work;
  v_existing public_semantic_private.semantic_work_outcomes;
  v_admissible text;
  v_manifest uuid;
BEGIN
  IF p_work_id IS NULL OR p_outcome IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_OUTPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT w.* INTO v_work FROM public_semantic_private.semantic_work w WHERE w.id = p_work_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  -- The answer must be the work's own kind, well formed, before anything is locked or written.
  IF NOT (CASE
            WHEN v_work.work_kind = 'PROPOSAL' AND p_outcome = 'PROPOSED' THEN
              p_lens_key IS NOT NULL AND p_lens_key ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'
              AND coalesce(public_semantic_private.semantic_text_is_well_formed_v1(p_meaning, 120), false)
              AND coalesce(public_semantic_private.semantic_themes_are_well_formed_v1(p_primary_themes, 1, 3), false)
              AND coalesce(public_semantic_private.semantic_themes_are_well_formed_v1(p_secondary_themes, 0, 3), false)
              AND public_semantic_private.semantic_themes_are_disjoint_v1(p_primary_themes, p_secondary_themes)
              AND coalesce(public_semantic_private.semantic_text_is_well_formed_v1(p_explanation, 280), false)
            WHEN v_work.work_kind = 'CORRECTION' AND p_outcome = 'CONSISTENT' THEN
              p_lens_key IS NOT NULL AND p_lens_key ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'
              AND p_meaning IS NULL AND p_primary_themes IS NULL AND p_secondary_themes IS NULL AND p_explanation IS NULL
            WHEN v_work.work_kind = 'CORRECTION' AND p_outcome = 'NOT_SUPPORTED' THEN
              p_lens_key IS NULL AND p_meaning IS NULL AND p_primary_themes IS NULL AND p_secondary_themes IS NULL
              AND p_explanation IS NULL
            ELSE false END) THEN
    RAISE EXCEPTION 'PUBLIC_SEMANTIC_OUTPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  -- CANONICAL LOCK ORDER, STEP 2.
  PERFORM 1 FROM public.public_experiences e WHERE e.id = v_work.experience_id FOR UPDATE;
  SELECT o.* INTO v_existing FROM public_semantic_private.semantic_work_outcomes o WHERE o.work_id = p_work_id;
  IF FOUND THEN
    RETURN QUERY SELECT CASE WHEN v_existing.outcome = p_outcome AND v_existing.lens_key IS NOT DISTINCT FROM p_lens_key
                                  AND v_existing.meaning IS NOT DISTINCT FROM p_meaning
                                  AND v_existing.primary_themes IS NOT DISTINCT FROM p_primary_themes
                                  AND v_existing.secondary_themes IS NOT DISTINCT FROM p_secondary_themes
                                  AND v_existing.explanation IS NOT DISTINCT FROM p_explanation
                             THEN 'ALREADY_RECORDED' ELSE 'STALE' END::text;
    RETURN;
  END IF;
  v_admissible := public_semantic_private.work_admissibility_v1(p_work_id);
  IF v_admissible <> 'ADMISSIBLE' THEN
    RETURN QUERY SELECT v_admissible;
    RETURN;
  END IF;
  SELECT v.package_manifest_version_id INTO v_manifest FROM public.public_experience_versions v WHERE v.id = v_work.experience_version_id;
  IF p_outcome = 'PROPOSED'
     AND public_semantic_private.interpretation_copies_package_v1(p_meaning, p_primary_themes, p_secondary_themes, p_explanation, v_manifest) THEN
    RETURN QUERY SELECT 'COPIES_PACKAGE'::text;
    RETURN;
  END IF;
  INSERT INTO public_semantic_private.semantic_work_outcomes
    (work_id, work_kind, outcome, lens_key, meaning, primary_themes, secondary_themes, explanation, interpreter_contract, produced_at)
  VALUES (p_work_id, v_work.work_kind, p_outcome, p_lens_key, p_meaning, p_primary_themes, p_secondary_themes, p_explanation,
          'PUBLIC_SEMANTIC_INTERPRETATION_V1', clock_timestamp());
  RETURN QUERY SELECT 'RECORDED'::text;
END$$;

-- =====================================================================================================================
-- F. THE EXPOSED WRAPPERS: SECURITY INVOKER, each a one-line call into its definer.
-- =====================================================================================================================
CREATE FUNCTION public.read_own_public_semantic_review_v1(p_experience_id uuid)
RETURNS TABLE (semantic_state text, current_lifecycle text, version_ordinal integer, interpretation_id uuid,
               interpretation_revision integer, interpretation_origin text, meaning text, primary_themes text[],
               secondary_themes text[], explanation text, review_decision text, semantically_ready boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.semantic_state, r.current_lifecycle, r.version_ordinal, r.interpretation_id, r.interpretation_revision,
         r.interpretation_origin, r.meaning, r.primary_themes, r.secondary_themes, r.explanation, r.review_decision,
         r.semantically_ready
    FROM public_semantic_private.read_own_public_semantic_review_v1(p_experience_id) r;
$$;
CREATE FUNCTION public.request_own_public_semantic_proposal_v1(p_command_id uuid, p_experience_id uuid)
RETURNS TABLE (outcome text, work_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.work_id FROM public_semantic_private.request_own_public_semantic_proposal_v1(p_command_id, p_experience_id) r;
$$;
CREATE FUNCTION public.request_own_public_semantic_correction_v1(
  p_command_id uuid, p_experience_id uuid, p_interpretation_id uuid, p_meaning text, p_primary_themes text[],
  p_secondary_themes text[])
RETURNS TABLE (outcome text, work_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.work_id
    FROM public_semantic_private.request_own_public_semantic_correction_v1(p_command_id, p_experience_id, p_interpretation_id,
           p_meaning, p_primary_themes, p_secondary_themes) r;
$$;
CREATE FUNCTION public.commit_own_public_semantic_work_v1(p_work_id uuid)
RETURNS TABLE (outcome text, interpretation_id uuid, interpretation_revision integer)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.interpretation_id, r.interpretation_revision FROM public_semantic_private.commit_own_public_semantic_work_v1(p_work_id) r;
$$;
CREATE FUNCTION public.accept_own_public_semantic_proposal_v1(p_command_id uuid, p_experience_id uuid, p_interpretation_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM public_semantic_private.accept_own_public_semantic_proposal_v1(p_command_id, p_experience_id, p_interpretation_id) r;
$$;
CREATE FUNCTION public.read_public_semantic_work_input_v1(p_work_id uuid)
RETURNS TABLE (work_kind text, item_ordinal integer, item_kind text, item_text text, correction_meaning text,
               correction_primary_themes text[], correction_secondary_themes text[])
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.work_kind, r.item_ordinal, r.item_kind, r.item_text, r.correction_meaning, r.correction_primary_themes,
         r.correction_secondary_themes
    FROM public_semantic_private.read_public_semantic_work_input_v1(p_work_id) r;
$$;
CREATE FUNCTION public.record_public_semantic_work_outcome_v1(
  p_work_id uuid, p_outcome text, p_lens_key text, p_meaning text, p_primary_themes text[], p_secondary_themes text[],
  p_explanation text)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome
    FROM public_semantic_private.record_public_semantic_work_outcome_v1(p_work_id, p_outcome, p_lens_key, p_meaning,
           p_primary_themes, p_secondary_themes, p_explanation) r;
$$;

-- =====================================================================================================================
-- G. PRIVILEGES. Ownership; default-deny by name; then the exact grants. Nothing relies on a default (0133).
-- =====================================================================================================================
ALTER TABLE public_semantic_private.semantic_work OWNER TO postgres;
ALTER TABLE public_semantic_private.semantic_work_outcomes OWNER TO postgres;
ALTER TABLE public_semantic_private.semantic_interpretations OWNER TO postgres;
ALTER TABLE public_semantic_private.semantic_reviews OWNER TO postgres;
ALTER TABLE public_semantic_private.semantic_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_semantic_private.semantic_work_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_semantic_private.semantic_interpretations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_semantic_private.semantic_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public_semantic_private.semantic_work, public_semantic_private.semantic_work_outcomes,
                    public_semantic_private.semantic_interpretations, public_semantic_private.semantic_reviews
  FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_fn text;
  v_owner_commands text[] := ARRAY[
    'public_semantic_private.read_own_public_semantic_review_v1(uuid)',
    'public_semantic_private.request_own_public_semantic_proposal_v1(uuid, uuid)',
    'public_semantic_private.request_own_public_semantic_correction_v1(uuid, uuid, uuid, text, text[], text[])',
    'public_semantic_private.commit_own_public_semantic_work_v1(uuid)',
    'public_semantic_private.accept_own_public_semantic_proposal_v1(uuid, uuid, uuid)',
    'public.read_own_public_semantic_review_v1(uuid)',
    'public.request_own_public_semantic_proposal_v1(uuid, uuid)',
    'public.request_own_public_semantic_correction_v1(uuid, uuid, uuid, text, text[], text[])',
    'public.commit_own_public_semantic_work_v1(uuid)',
    'public.accept_own_public_semantic_proposal_v1(uuid, uuid, uuid)'];
  v_server_commands text[] := ARRAY[
    'public_semantic_private.read_public_semantic_work_input_v1(uuid)',
    'public_semantic_private.record_public_semantic_work_outcome_v1(uuid, text, text, text, text[], text[], text)',
    'public.read_public_semantic_work_input_v1(uuid)',
    'public.record_public_semantic_work_outcome_v1(uuid, text, text, text, text[], text[], text)'];
  v_internal text[] := ARRAY[
    'public_semantic_private.semantic_text_is_well_formed_v1(text, integer)',
    'public_semantic_private.semantic_themes_are_well_formed_v1(text[], integer, integer)',
    'public_semantic_private.semantic_themes_are_disjoint_v1(text[], text[])',
    'public_semantic_private.reject_semantic_history_mutation_v1()',
    'public_semantic_private.derive_semantic_identity_v1(text, uuid, uuid)',
    'public_semantic_private.derive_package_fingerprint_v1(uuid)',
    'public_semantic_private.resolve_semantic_target_v1(uuid)',
    'public_semantic_private.copies_package_text_v1(text, uuid)',
    'public_semantic_private.interpretation_copies_package_v1(text, text[], text[], text, uuid)',
    'public_semantic_private.derive_work_request_ref_v1(uuid, text, uuid, uuid, text, uuid, text, text[], text[])',
    'public_semantic_private.work_admissibility_v1(uuid)',
    'public_semantic_private.derive_public_semantic_readiness_v1(uuid)'];
BEGIN
  FOREACH v_fn IN ARRAY v_owner_commands || v_server_commands || v_internal LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', v_fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', v_fn);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON TABLE public_semantic_private.semantic_work, public_semantic_private.semantic_work_outcomes, public_semantic_private.semantic_interpretations, public_semantic_private.semantic_reviews FROM service_role';
    EXECUTE 'GRANT USAGE ON SCHEMA public_semantic_private TO service_role';
    FOREACH v_fn IN ARRAY v_server_commands LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn);
    END LOOP;
  END IF;
  EXECUTE 'GRANT USAGE ON SCHEMA public_semantic_private TO authenticated';
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
  -- H1. No application role executes a frozen I-05 primitive, the placement primitive included.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.record_public_experience_semantic_placement_v1(uuid, uuid, uuid, uuid, text, text)',
    'public.derive_public_experience_current_placement_v1(uuid)',
    'public.publish_public_experience_v1(uuid, uuid, uuid)',
    'public.resolve_public_publication_prerequisites_v1(uuid, uuid)',
    'public.commit_public_experience_ready_for_review_v1(uuid, uuid, uuid)',
    'public.post_public_discussion_v1(uuid, uuid, uuid, uuid, text)',
    'public.record_public_qandeel_response_v1(uuid, uuid, uuid, uuid, text, uuid[])'] LOOP
    IF has_function_privilege('public', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S5-03A: PUBLIC executes the frozen primitive %', v_fn;
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = v_role) AND has_function_privilege(v_role, v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S5-03A: % executes the frozen primitive %', v_role, v_fn;
      END IF;
    END LOOP;
  END LOOP;

  -- H2. Publication stays impossible: the CW2-08 seam answers NOT_EVALUATED.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)'::regprocedure;
  IF p.prosrc !~ 'NOT_EVALUATED' OR p.prosrc ~ '''CLEARED''' THEN
    RAISE EXCEPTION 'S5-03A: the CW2-08 prerequisite seam must still answer NOT_EVALUATED';
  END IF;

  -- H3. PUBLIC PACKAGE ONLY, and nothing beyond READY_FOR_REVIEW: no S5-03A function names publication, the seam, a
  --     public lifecycle, discussion, Public QANDEEL, sealed provenance, a Shared World, a Personal conversation,
  --     memory, the human model, a hypothesis, Matching, an account, a Public identity or a display label.
  FOR p IN SELECT pr.proname, pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public_semantic_private'
               OR (n.nspname = 'public' AND pr.proname IN ('read_own_public_semantic_review_v1',
                   'request_own_public_semantic_proposal_v1', 'request_own_public_semantic_correction_v1',
                   'commit_own_public_semantic_work_v1', 'accept_own_public_semantic_proposal_v1',
                   'read_public_semantic_work_input_v1', 'record_public_semantic_work_outcome_v1')) LOOP
    IF p.prosrc ~ '(publish_public_experience_v1|resolve_public_publication_prerequisites_v1|''PUBLISHED''|ABSENT_FROM_PUBLIC_WORLD|public_discussion|public_qandeel|provenance|shared_world|conversation_|memor|human_model|(^|[^a-z])him_|hypothes|matching|introduction|public\.users|public_identit|display_label|label_mode|personal_owner)' THEN
      RAISE EXCEPTION 'S5-03A: % reaches beyond the exact public package or beyond READY_FOR_REVIEW', p.proname;
    END IF;
  END LOOP;

  -- H4. Every S5-03A private function is a pinned postgres-owned SECURITY DEFINER.
  FOR p IN SELECT pr.proname, pr.prosecdef, pr.proconfig, pg_get_userbyid(pr.proowner) AS owner
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace WHERE n.nspname = 'public_semantic_private' LOOP
    IF NOT p.prosecdef OR p.owner <> 'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN
      RAISE EXCEPTION 'S5-03A: public_semantic_private.% must be a pinned postgres-owned definer', p.proname;
    END IF;
  END LOOP;

  -- H5. The four relations are append-only, and the frozen 0096 placement keeps its own guard.
  IF (SELECT count(*) FROM pg_trigger tg WHERE NOT tg.tgisinternal
        AND tg.tgfoid = 'public_semantic_private.reject_semantic_history_mutation_v1()'::regprocedure) <> 4 THEN
    RAISE EXCEPTION 'S5-03A: all four semantic relations must be append-only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE NOT tg.tgisinternal
                   AND tg.tgrelid = 'public.public_experience_semantic_placements'::regclass
                   AND tg.tgfoid = 'public.reject_public_semantic_presence_mutation_v1()'::regprocedure) THEN
    RAISE EXCEPTION 'S5-03A: the frozen 0096 placement must keep its append-only guard';
  END IF;

  -- H6. No account reference: the semantic relations add no edge to QAN-BL-ACCT-01.
  IF EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
              WHERE n.nspname = 'public_semantic_private' AND c.contype = 'f'
                AND c.confrelid IN ('public.users'::regclass, 'public.public_identities'::regclass)) THEN
    RAISE EXCEPTION 'S5-03A: a semantic relation must not reference an account or a Public identity';
  END IF;

  -- H7. Still one Public World, the signed-out policy untouched, and no Experience published.
  IF (SELECT count(*) FROM public.public_world_state) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.public_audience_policy_state p2 WHERE p2.signed_out_viewing_policy = 'UNRESOLVED') THEN
    RAISE EXCEPTION 'S5-03A: one Public World, and the signed-out policy still UNRESOLVED';
  END IF;
END$$;

COMMIT;
