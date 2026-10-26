-- S8A-05 CP1 - Public World: «Write your topic» (direct authored topics, private drafts, sections, human titles).
--
-- Product authority: the Product Owner's S8A-05 CP1 order (2026-10-26), which approves the WP1 design with its WP1-R1
-- corrections as the implementation basis, and the S8A-05 controlled amendment it records
-- (docs/canonical-authority/connected-worlds-v2/architecture/
-- QANDEEL_S8A-05_PUBLIC_AUTHORED_TOPICS_CONTROLLED_AMENDMENT_v1.0.md): A-1 (direct writing is a primary Public path,
-- with a human title and a user-chosen section; QANDEEL's understanding stays behind the scenes) and A-2 (a fourth
-- source class PUBLIC_AUTHORED; bounded public metadata = a version-bound title and an Experience-bound section, both
-- outside interpretation and placement; one-way erasure of a never-published topic on discard). The implementation
-- record is docs/e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md.
--
-- ## What is added
--
--   1. Schema public_compose_private (not exposed through the Data API; RLS on every relation, no policy):
--        sections                    the server-owned catalogue: 12 sections + `open` («حكايات مفتوحة»). Names are
--                                    client copy (Copy Gate); a retired section keeps its topics and is not offered.
--        topic_drafts                the author's PRIVATE drafts: title (≤ 100), text (≤ 5,000), an optional section,
--                                    a revision for compare-and-set, and the Experience it was prepared as, if any.
--                                    user_id → public.users ON DELETE CASCADE (coverage ACCOUNT_CASCADE).
--        version_titles              the human title of exactly one Experience Version (A-2(b)); erasable one-way.
--        experience_sections         the section of one Experience (the container, not a version) and its revision;
--        experience_section_events   append-only history of section changes. Neither is read by interpretation or
--                                    placement, so a section change never moves a topic.
--        discard_commands            the proof of a never-published discard, read by the package guard.
--        freeze clearance seam       resolve_topic_freeze_clearance_v1() answers NOT_EVALUATED: preparing a topic for
--                                    publication (which provisions the one Public Identity) stays CLOSED in every
--                                    environment until Stage 9 opens the CW2-08 publication gates. Only a controlled
--                                    verifier replaces it, inside a transaction it rolls back.
--   2. The fourth source class PUBLIC_AUTHORED (A-2(a)): the provenance class / shape / digest-erasure CHECKs re-added
--      with it; derive_public_publication_authority_v1 forward-replaced with one more digest check, one more approver
--      branch (the author, who is the manifest's publisher) and one more source-scope token. An authored item is
--      SOURCE_CONTENT_BEARING_DERIVATIVE / PUBLIC_TEXT whose body IS the author's text; its sole approver is its author.
--   3. public.discard_never_published_public_experience_v1 - the FIFTH lifecycle mover (A-2(c), R1-03): DRAFT |
--      READY_FOR_REVIEW → ABSENT_FROM_PUBLIC_WORLD for an Experience that was never published and whose every item is
--      PUBLIC_AUTHORED, with its immutable lifecycle event under the command identity, and the one-way erasure of every
--      public body, both content verifiers, the human title and (by the 0144 trigger) every semantic text derived from
--      it. The 0092 / 0143 package guard is forward-replaced with exactly this second exception, proven from the
--      discard command at the same instant. MY_WORLD / SHARED_WORLD topics are not discardable here (S8A-05 CP2).
--   4. Owner commands (authenticated; the human from auth.uid() only): list / read / save / delete drafts, preview,
--      freeze (gated), discard, change section. Viewer reads (admitted REGISTERED viewers only; visible Experiences
--      only): the human title and section of served topics, title search, and search inside one section (title,
--      meaning, themes and public text).
--   5. Export My Data (0168 body re-stated) gains ONE section, `publicTopicDrafts`: the reader's own drafts.
--
-- ## What is deliberately NOT here
--
--   * No publication, no placement, no semantic request, no Public discussion. Nothing here reaches PUBLISHED, the
--     CW2-08 seam (resolve_public_publication_prerequisites_v1) or the 0145 placement.
--   * No Public Identity is created by drafting, saving, reading, previewing or listing. Only a freeze does it, and a
--     freeze is closed here.
--   * No change to the 0145 field / search / panel reads: the title is served by its own reads and merged in the API.
--
-- ## Deletion
--
-- topic_drafts is the only relation here that names an account; it cascades from public.users and nothing references
-- it with RESTRICT, so drafts never block account deletion. A prepared (frozen) topic exists only after the closed gate
-- opens, and then follows the Public residue owner (QAN-BL-ACCT-DEL-02), exactly as any S5-02 Draft does.
--
-- Forward-only. Migrations 0001-0178 are byte-unchanged.
BEGIN;

CREATE SCHEMA public_compose_private;
ALTER SCHEMA public_compose_private OWNER TO postgres;
REVOKE ALL ON SCHEMA public_compose_private FROM PUBLIC;

-- =====================================================================================================================
-- A. RELATIONS.
-- =====================================================================================================================

-- A.1 The section catalogue (WP1 §2.2, PO-approved list). Keys are stable; names are client copy.
CREATE TABLE public_compose_private.sections (
  section_key text NOT NULL,
  display_order smallint NOT NULL,
  retired_at timestamptz,
  CONSTRAINT sections_pk PRIMARY KEY (section_key),
  CONSTRAINT sections_order_key UNIQUE (display_order),
  CONSTRAINT sections_key_check CHECK (section_key ~ '^[a-z][a-z_]{1,31}$')
);
INSERT INTO public_compose_private.sections (section_key, display_order) VALUES
  ('love', 1), ('marriage', 2), ('family', 3), ('parenting', 4), ('people', 5), ('work_money', 6),
  ('study_future', 7), ('inner_self', 8), ('health_body', 9), ('loss_crisis', 10), ('faith_meaning', 11),
  ('life_changes', 12), ('open', 13);

-- A.2 The author's private drafts. While prepared_experience_id is set the draft is read-only (its content is the
--     prepared topic); a discard of that never-published topic returns it to editing.
CREATE TABLE public_compose_private.topic_drafts (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  draft_revision bigint NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  section_key text,
  prepared_experience_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT topic_drafts_pk PRIMARY KEY (id),
  CONSTRAINT topic_drafts_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT topic_drafts_section_fk FOREIGN KEY (section_key)
    REFERENCES public_compose_private.sections (section_key) ON DELETE RESTRICT,
  CONSTRAINT topic_drafts_experience_fk FOREIGN KEY (prepared_experience_id)
    REFERENCES public.public_experiences (id) ON DELETE RESTRICT,
  CONSTRAINT topic_drafts_experience_key UNIQUE (prepared_experience_id),
  CONSTRAINT topic_drafts_revision_check CHECK (draft_revision >= 1),
  CONSTRAINT topic_drafts_title_check CHECK (char_length(title) <= 100 AND title !~ '[[:cntrl:]]'),
  -- Line breaks and tabs are text; every other control character is not.
  CONSTRAINT topic_drafts_body_check CHECK (char_length(body) <= 5000 AND body !~ '[\x01-\x08\x0B-\x1F\x7F]')
);
CREATE INDEX topic_drafts_user_idx ON public_compose_private.topic_drafts (user_id, updated_at DESC);

-- A.3 The never-published discard proof: one per Experience, at one instant.
CREATE TABLE public_compose_private.discard_commands (
  id uuid NOT NULL,
  experience_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  CONSTRAINT discard_commands_pk PRIMARY KEY (id),
  CONSTRAINT discard_commands_experience_key UNIQUE (experience_id),
  CONSTRAINT discard_commands_experience_fk FOREIGN KEY (experience_id)
    REFERENCES public.public_experiences (id) ON DELETE RESTRICT
);

-- A.4 The human title of exactly one Experience Version (A-2(b)).
CREATE TABLE public_compose_private.version_titles (
  experience_version_id uuid NOT NULL,
  experience_id uuid NOT NULL,
  title text,
  title_erased_at timestamptz,
  created_at timestamptz NOT NULL,
  CONSTRAINT version_titles_pk PRIMARY KEY (experience_version_id),
  CONSTRAINT version_titles_version_fk FOREIGN KEY (experience_version_id, experience_id)
    REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
  CONSTRAINT version_titles_shape_check CHECK (
    (title IS NOT NULL AND title_erased_at IS NULL AND char_length(title) BETWEEN 8 AND 100
       AND title = btrim(title) AND title !~ '[[:cntrl:]]')
    OR (title IS NULL AND title_erased_at IS NOT NULL))
);
CREATE INDEX version_titles_experience_idx ON public_compose_private.version_titles (experience_id);

-- A.5 The section of one Experience (the container) and its append-only history.
CREATE TABLE public_compose_private.experience_sections (
  experience_id uuid NOT NULL,
  section_key text NOT NULL,
  section_revision bigint NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT experience_sections_pk PRIMARY KEY (experience_id),
  CONSTRAINT experience_sections_experience_fk FOREIGN KEY (experience_id)
    REFERENCES public.public_experiences (id) ON DELETE RESTRICT,
  CONSTRAINT experience_sections_section_fk FOREIGN KEY (section_key)
    REFERENCES public_compose_private.sections (section_key) ON DELETE RESTRICT,
  CONSTRAINT experience_sections_revision_check CHECK (section_revision >= 1)
);
CREATE TABLE public_compose_private.experience_section_events (
  id uuid NOT NULL,
  experience_id uuid NOT NULL,
  section_key text NOT NULL,
  section_revision bigint NOT NULL,
  occurred_at timestamptz NOT NULL,
  CONSTRAINT experience_section_events_pk PRIMARY KEY (id),
  CONSTRAINT experience_section_events_revision_key UNIQUE (experience_id, section_revision),
  CONSTRAINT experience_section_events_experience_fk FOREIGN KEY (experience_id)
    REFERENCES public.public_experiences (id) ON DELETE RESTRICT,
  CONSTRAINT experience_section_events_section_fk FOREIGN KEY (section_key)
    REFERENCES public_compose_private.sections (section_key) ON DELETE RESTRICT
);

-- A.6 History is history: the section events and the discard proofs are append-only for every role; a version title
--     changes exactly once, to erased, at the instant a never-published discard of its Experience proves.
CREATE FUNCTION public_compose_private.reject_compose_history_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'version_titles' THEN
    IF TG_OP = 'INSERT' AND NEW.title_erased_at IS NULL THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.title IS NOT NULL AND NEW.title IS NULL
       AND OLD.title_erased_at IS NULL AND NEW.title_erased_at IS NOT NULL
       AND NEW.experience_version_id = OLD.experience_version_id AND NEW.experience_id = OLD.experience_id
       AND NEW.created_at = OLD.created_at
       AND EXISTS (SELECT 1 FROM public_compose_private.discard_commands d
                    WHERE d.experience_id = OLD.experience_id AND d.occurred_at = NEW.title_erased_at) THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'PUBLIC_COMPOSE_HISTORY_IS_IMMUTABLE'
    USING ERRCODE = '55000',
          DETAIL = 'Section history and discard proofs are append-only. A version title is erased exactly once, by the '
                   'never-published discard of its Experience, at that instant.';
END$$;
CREATE TRIGGER version_titles_immutable BEFORE INSERT OR UPDATE OR DELETE ON public_compose_private.version_titles
  FOR EACH ROW EXECUTE FUNCTION public_compose_private.reject_compose_history_mutation_v1();
CREATE TRIGGER experience_section_events_immutable BEFORE INSERT OR UPDATE OR DELETE
  ON public_compose_private.experience_section_events
  FOR EACH ROW EXECUTE FUNCTION public_compose_private.reject_compose_history_mutation_v1();
CREATE TRIGGER discard_commands_immutable BEFORE INSERT OR UPDATE OR DELETE ON public_compose_private.discard_commands
  FOR EACH ROW EXECUTE FUNCTION public_compose_private.reject_compose_history_mutation_v1();

INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
  ('public_compose_private.topic_drafts', 'ACCOUNT_CASCADE');

-- =====================================================================================================================
-- B. THE FOURTH SOURCE CLASS, PUBLIC_AUTHORED (A-2(a)).
-- =====================================================================================================================

-- B.1 The class, its exact shape (no source identifier: the author is the manifest's publisher, bound there by the
--     0092 identity foreign key) and its one-way digest erasure.
ALTER TABLE public.publication_package_item_provenance
  DROP CONSTRAINT publication_package_item_provenance_class_check,
  DROP CONSTRAINT publication_package_item_provenance_shape_check,
  DROP CONSTRAINT publication_package_item_provenance_digest_erasure_check;
ALTER TABLE public.publication_package_item_provenance
  ADD CONSTRAINT publication_package_item_provenance_class_check
    CHECK (source_class IN ('MY_WORLD', 'SHARED_WORLD', 'REPLAY_ARTIFACT', 'PUBLIC_AUTHORED')),
  ADD CONSTRAINT publication_package_item_provenance_shape_check CHECK (
    (source_class = 'MY_WORLD'
        AND personal_conversation_unit_id IS NOT NULL AND personal_owner_user_id IS NOT NULL
        AND shared_world_id IS NULL AND shared_material_id IS NULL AND shared_history_item_id IS NULL
        AND captured_availability_revision IS NULL)
 OR (source_class = 'SHARED_WORLD'
        AND shared_world_id IS NOT NULL AND shared_material_id IS NOT NULL
        AND shared_history_item_id IS NOT NULL AND captured_availability_revision IS NOT NULL
        AND personal_conversation_unit_id IS NULL AND personal_owner_user_id IS NULL)
 OR (source_class IN ('REPLAY_ARTIFACT', 'PUBLIC_AUTHORED')
        AND personal_conversation_unit_id IS NULL AND personal_owner_user_id IS NULL
        AND shared_world_id IS NULL AND shared_material_id IS NULL
        AND shared_history_item_id IS NULL AND captured_availability_revision IS NULL)),
  ADD CONSTRAINT publication_package_item_provenance_digest_erasure_check
    CHECK ((captured_source_digest IS NOT NULL AND captured_digest_erased_at IS NULL)
        OR (captured_source_digest IS NULL AND captured_digest_erased_at IS NOT NULL
            AND source_class IN ('SHARED_WORLD', 'PUBLIC_AUTHORED')));

-- B.2 THE ONE I-05A AUTHORITY DERIVATION, forward-replaced from 0105 with three additions, each marked S8A-05.
CREATE OR REPLACE FUNCTION public.derive_public_publication_authority_v1(p_manifest_version_id uuid)
RETURNS TABLE(required_approvers uuid[], required_approver_count integer, authority_fingerprint text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  manifest public.publication_package_manifest_versions;
  prospective public.public_experience_versions;
  snapshot bigint;
  approvers uuid[];
  scope text;
BEGIN
  IF p_manifest_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO manifest FROM public.publication_package_manifest_versions m WHERE m.id = p_manifest_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO prospective FROM public.public_experience_versions v
   WHERE v.package_manifest_version_id = p_manifest_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  SELECT w.state_version INTO snapshot FROM public.public_world_state w WHERE w.singleton;

  -- EVERY INCLUDED SHARED SOURCE MUST STILL BE AVAILABLE AT THE EXACT CAPTURED
  -- REVISION. Owner deletion transitions the history item to DELETED_BY_OWNER
  -- and a transitively source-content-bearing target to UNAVAILABLE, and BOTH
  -- bump the revision - so a package prepared before either one goes stale here.
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
      JOIN public.shared_world_history_items i ON i.id = p.shared_history_item_id
     WHERE p.manifest_version_id = p_manifest_version_id
       AND p.source_class = 'SHARED_WORLD'
       AND (i.availability_state <> 'AVAILABLE'
            OR i.availability_revision <> p.captured_availability_revision)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- A Shared body that owner deletion physically removed is simply not there,
  -- and one whose bytes are not the bytes this package snapshotted is not the
  -- same source either.
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
     WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'SHARED_WORLD'
       AND NOT EXISTS (
         SELECT 1 FROM public.shared_world_text_material_bodies b
          WHERE b.material_id = p.shared_material_id
            AND ('sha256:' || encode(sha256(convert_to(b.body_text, 'UTF8')), 'hex'))
                = p.captured_source_digest)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- The Personal source is append-only committed truth, so its digest must still
  -- match exactly. This is checked rather than assumed: an invariant nobody
  -- verifies is an invariant nobody notices losing.
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
     WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'MY_WORLD'
       AND NOT EXISTS (
         SELECT 1 FROM public.conversation_units cu
          WHERE cu.id = p.personal_conversation_unit_id
            AND cu.user_id = p.personal_owner_user_id
            AND ('sha256:' || encode(sha256(convert_to(cu.committed_text, 'UTF8')), 'hex'))
                = p.captured_source_digest)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- S8A-05 (0179), A-2(a): AN AUTHORED ITEM'S SOURCE IS ITS OWN PUBLIC BODY - the
  -- author's text, written for the Public World. The body must still exist and be
  -- exactly the bytes captured; a discarded (erased) topic has no source at all.
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
     WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'PUBLIC_AUTHORED'
       AND NOT EXISTS (
         SELECT 1 FROM public.public_experience_text_derivative_bodies b
          WHERE b.package_item_id = p.package_item_id
            AND ('sha256:' || encode(sha256(convert_to(b.public_text_body, 'UTF8')), 'hex'))
                = p.captured_source_digest)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- I-06C, ADDITIVE: A REPLAY_ARTIFACT ITEM WITH NO EXACT REPLAY DISTRIBUTION
  -- BINDING HAS NO DERIVABLE AUTHORITY AT ALL, and an item with no derivable
  -- authority may not be inside a package. The reserved class contributed
  -- nothing before it had a producer; it must never contribute an EMPTY
  -- requirement now that it has one.
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
     WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'REPLAY_ARTIFACT'
       AND NOT EXISTS (SELECT 1 FROM public.replay_public_distribution_artifacts a
                        WHERE a.package_item_id = p.package_item_id)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED' USING ERRCODE='55000';
  END IF;

  -- UNRESOLVED ADDITIONAL HUMAN AUTHORITY FAILS CLOSED, and so does its absence.
  -- Public World does not reinterpret "we cannot resolve it" as zero approvers.
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
     WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'SHARED_WORLD'
       AND NOT EXISTS (
         SELECT 1 FROM public.shared_world_material_historical_authority ha
          WHERE ha.material_id = p.shared_material_id
            AND ha.resolution_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT',
                                        'RESOLVED_NO_HUMAN_REQUIREMENT'))
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED' USING ERRCODE='55000';
  END IF;

  -- THE SOURCE AUTHORITY METADATA AGREES IN BOTH DIRECTIONS, or it fails closed:
  -- an exact requirement with no approver row, an empty requirement that still
  -- names approvers, and a resolution state that disagrees with the I-04F
  -- authority mode are each contradictory rather than permissive.
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
      JOIN public.shared_world_history_items i ON i.id = p.shared_history_item_id
      JOIN public.shared_world_material_historical_authority ha ON ha.material_id = p.shared_material_id
     WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'SHARED_WORLD'
       AND ((i.authority_requirement_mode = 'EXACT_HUMAN_APPROVER_SET'
              AND (ha.resolution_state <> 'RESOLVED_EXACT_HUMAN_REQUIREMENT'
                   OR NOT EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                                   WHERE ra.history_item_id = i.id)))
         OR (i.authority_requirement_mode = 'NO_HUMAN_APPROVAL_REQUIRED'
              AND (ha.resolution_state <> 'RESOLVED_NO_HUMAN_REQUIREMENT'
                   OR EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                               WHERE ra.history_item_id = i.id))))
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- THE EXACT CONTENT RIGHTSHOLDER SET: the union of the exact human material
  -- authorities of the exact INCLUDED material. Never World membership, never a
  -- current audience, never a caller-supplied list. I-06C adds the third branch:
  -- a bridged Replay artifact contributes the EXACT required approver set its own
  -- Replay distribution package derived, and nothing else. S8A-05 (0179) adds the
  -- fourth: an authored item's one rightsholder is its author, the publisher.
  SELECT coalesce(array_agg(x.approver ORDER BY x.approver), ARRAY[]::uuid[]) INTO approvers
    FROM (
      SELECT ra.approver_user_id AS approver
        FROM public.publication_package_item_provenance p
        JOIN public.shared_world_history_item_required_approvers ra
          ON ra.history_item_id = p.shared_history_item_id
       WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'SHARED_WORLD'
      UNION
      SELECT p.personal_owner_user_id AS approver
        FROM public.publication_package_item_provenance p
       WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'MY_WORLD'
      UNION
      SELECT dra.approver_user_id AS approver
        FROM public.publication_package_item_provenance p
        JOIN public.replay_public_distribution_artifacts a ON a.package_item_id = p.package_item_id
        JOIN public.replay_distribution_required_approvers dra
          ON dra.distribution_package_version_id = a.distribution_package_version_id
       WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'REPLAY_ARTIFACT'
      UNION
      SELECT manifest.publisher_user_id AS approver
       WHERE EXISTS (SELECT 1 FROM public.publication_package_item_provenance p
                      WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'PUBLIC_AUTHORED')
    ) x;

  -- THE EXACT SOURCE SCOPE, canonically ordered so the fingerprint is a property
  -- of the package rather than of the order a caller happened to supply. It lives
  -- inside a one-way digest and reaches no surface.
  SELECT coalesce(string_agg(s.token, ',' ORDER BY s.token COLLATE "C"), '') INTO scope
    FROM (
      SELECT CASE p.source_class
               WHEN 'MY_WORLD' THEN 'MY_WORLD:' || lower(p.personal_conversation_unit_id::text)
               WHEN 'SHARED_WORLD' THEN 'SHARED_WORLD:' || lower(p.shared_world_id::text)
                                        || ':' || lower(p.shared_material_id::text)
               WHEN 'REPLAY_ARTIFACT' THEN 'REPLAY_ARTIFACT:' || lower(a.distribution_package_version_id::text)
                                        || ':' || lower(a.replay_version_id::text)
               WHEN 'PUBLIC_AUTHORED' THEN 'PUBLIC_AUTHORED:' || lower(p.package_item_id::text)
               ELSE p.source_class || ':RESERVED' END AS token
        FROM public.publication_package_item_provenance p
        LEFT JOIN public.replay_public_distribution_artifacts a ON a.package_item_id = p.package_item_id
       WHERE p.manifest_version_id = p_manifest_version_id
    ) s;

  RETURN QUERY SELECT approvers,
    coalesce(array_length(approvers, 1), 0)::integer,
    'sha256:' || encode(sha256(convert_to(
        'QANDEEL_CWV2_PUBLIC_PUBLICATION_AUTHORITY_REQUEST_V1' || E'\n'
     || 'action=' || manifest.intended_publication_action || E'\n'
     || 'target=PUBLIC_WORLD' || E'\n'
     || 'audienceClass=' || manifest.target_audience_class || E'\n'
     || 'readiness=' || manifest.authority_readiness || E'\n'
     || 'experience=' || lower(manifest.experience_id::text) || E'\n'
     || 'experienceVersion=' || lower(prospective.id::text) || E'\n'
     || 'versionOrdinal=' || prospective.version_ordinal::text || E'\n'
     || 'manifest=' || lower(manifest.id::text) || E'\n'
     || 'publisher=' || lower(manifest.publisher_public_identity_ref::text) || E'\n'
     || 'itemCount=' || manifest.item_count::text || E'\n'
     || 'sourceScope=' || scope || E'\n'
     || 'requiredApprovers=' || coalesce(array_to_string(approvers, ','), '') || E'\n'
     || 'authoritySnapshot=' || snapshot::text, 'UTF8')), 'hex');
END$$;

-- B.3 THE ONE-WAY PACKAGE GUARD, forward-replaced from 0143 with exactly ONE added exception (S8A-05, A-2(c)): the
--     erasure of an AUTHORED item of an Experience that was never published, proven HERE from the never-published
--     discard command recorded at exactly the erasure instant, the Experience now ABSENT_FROM_PUBLIC_WORLD, and no
--     publication record for it ever. The three ASSURE-F05 Shared exceptions are byte-for-byte 0143's.
CREATE OR REPLACE FUNCTION public.reject_publication_package_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  prov_new public.publication_package_item_provenance;
  item_new public.publication_package_manifest_items;
BEGIN
  IF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'publication_package_item_provenance' AND TG_OP = 'UPDATE' THEN
    -- The captured digest goes, the erasure instant arrives, and NOTHING else moves.
    prov_new := NEW;
    prov_new.captured_source_digest := OLD.captured_source_digest;
    prov_new.captured_digest_erased_at := OLD.captured_digest_erased_at;
    IF OLD.captured_source_digest IS NOT NULL AND NEW.captured_source_digest IS NULL
       AND OLD.captured_digest_erased_at IS NULL AND NEW.captured_digest_erased_at IS NOT NULL
       AND NOT (prov_new IS DISTINCT FROM OLD)
       AND OLD.source_class = 'SHARED_WORLD'
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies b WHERE b.material_id = OLD.shared_material_id)
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_voice_note_material_bodies b WHERE b.material_id = OLD.shared_material_id)
       AND (
         -- THE DELETED SOURCE ITSELF: terminal, with its own MATERIAL_DELETED fact at exactly this instant.
         (EXISTS (SELECT 1 FROM public.shared_world_history_items i
                   WHERE i.id = OLD.shared_history_item_id AND i.world_id = OLD.shared_world_id
                     AND i.availability_state = 'DELETED_BY_OWNER')
          AND EXISTS (SELECT 1 FROM public.shared_world_material_deleted_events ev
                       WHERE ev.material_id = OLD.shared_material_id AND ev.world_id = OLD.shared_world_id
                         AND ev.history_item_id = OLD.shared_history_item_id
                         AND ev.occurred_at = NEW.captured_digest_erased_at))
         -- OR A TARGET IN ITS MATERIAL_DEPENDENCY CLOSURE: UNAVAILABLE, and a MATERIAL_DELETED fact at exactly this
         -- instant names a material upstream of it through MATERIAL_DEPENDENCY edges only. A REASONING_DEPENDENCY
         -- edge is never followed, so a reasoning target can never qualify.
         OR (EXISTS (SELECT 1 FROM public.shared_world_history_items i
                      WHERE i.id = OLD.shared_history_item_id AND i.world_id = OLD.shared_world_id
                        AND i.availability_state = 'UNAVAILABLE')
             AND EXISTS (
               WITH RECURSIVE upstream(material_id) AS (
                 SELECT d.source_material_id FROM public.shared_world_material_dependencies d
                  WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY' AND d.target_material_id = OLD.shared_material_id
                 UNION
                 SELECT d.source_material_id FROM public.shared_world_material_dependencies d
                   JOIN upstream u ON d.target_material_id = u.material_id
                  WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY'
               )
               SELECT 1 FROM public.shared_world_material_deleted_events ev
                 JOIN upstream u ON u.material_id = ev.material_id
                WHERE ev.world_id = OLD.shared_world_id AND ev.occurred_at = NEW.captured_digest_erased_at))) THEN
      RETURN NEW;
    END IF;
    -- S8A-05 (0179): AN AUTHORED ITEM OF A NEVER-PUBLISHED, DISCARDED EXPERIENCE.
    IF OLD.captured_source_digest IS NOT NULL AND NEW.captured_source_digest IS NULL
       AND OLD.captured_digest_erased_at IS NULL AND NEW.captured_digest_erased_at IS NOT NULL
       AND NOT (prov_new IS DISTINCT FROM OLD)
       AND OLD.source_class = 'PUBLIC_AUTHORED'
       AND EXISTS (SELECT 1 FROM public.publication_package_manifest_versions m
                     JOIN public_compose_private.discard_commands d ON d.experience_id = m.experience_id
                     JOIN public.public_experiences e ON e.id = m.experience_id
                    WHERE m.id = OLD.manifest_version_id AND d.occurred_at = NEW.captured_digest_erased_at
                      AND e.current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD'
                      AND NOT EXISTS (SELECT 1 FROM public.public_experience_publication_state s
                                       WHERE s.experience_id = m.experience_id)) THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'publication_package_manifest_items' AND TG_OP = 'UPDATE' THEN
    item_new := NEW;
    item_new.content_state := OLD.content_state;
    item_new.public_body_digest := OLD.public_body_digest;
    item_new.content_erased_at := OLD.content_erased_at;
    IF OLD.content_state = 'CONTENT_PRESENT' AND NEW.content_state = 'ERASED_BY_OWNER'
       AND OLD.public_body_digest IS NOT NULL AND NEW.public_body_digest IS NULL
       AND OLD.content_erased_at IS NULL AND NEW.content_erased_at IS NOT NULL
       AND NOT (item_new IS DISTINCT FROM OLD)
       -- The sealed provenance of THIS item already proved the physical Shared erasure, at THIS instant. The item's
       -- historical classification is not consulted: Shared erasure, not the Public label, decides (S5-02 R1, G16).
       AND EXISTS (SELECT 1 FROM public.publication_package_item_provenance p
                     JOIN public.shared_world_history_items i
                       ON i.id = p.shared_history_item_id AND i.world_id = p.shared_world_id
                    WHERE p.package_item_id = OLD.package_item_id AND p.manifest_version_id = OLD.manifest_version_id
                      AND p.source_class = 'SHARED_WORLD' AND p.captured_source_digest IS NULL
                      AND p.captured_digest_erased_at = NEW.content_erased_at
                      AND i.availability_state IN ('DELETED_BY_OWNER', 'UNAVAILABLE')) THEN
      RETURN NEW;
    END IF;
    -- S8A-05 (0179): the sealed provenance of THIS authored item already proved the never-published discard erasure.
    IF OLD.content_state = 'CONTENT_PRESENT' AND NEW.content_state = 'ERASED_BY_OWNER'
       AND OLD.public_body_digest IS NOT NULL AND NEW.public_body_digest IS NULL
       AND OLD.content_erased_at IS NULL AND NEW.content_erased_at IS NOT NULL
       AND NOT (item_new IS DISTINCT FROM OLD)
       AND EXISTS (SELECT 1 FROM public.publication_package_item_provenance p
                    WHERE p.package_item_id = OLD.package_item_id AND p.manifest_version_id = OLD.manifest_version_id
                      AND p.source_class = 'PUBLIC_AUTHORED' AND p.captured_source_digest IS NULL
                      AND p.captured_digest_erased_at = NEW.content_erased_at) THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'public_experience_text_derivative_bodies' AND TG_OP = 'DELETE' THEN
    -- The bytes go only once their own item records the erasure.
    IF EXISTS (SELECT 1 FROM public.publication_package_manifest_items it
                WHERE it.package_item_id = OLD.package_item_id AND it.content_state = 'ERASED_BY_OWNER') THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'PUBLICATION_PACKAGE_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A publication package manifest, its items, its public bodies, its provenance, its authority resolution, its required approver set and its approvals are append-only: UPDATE and DELETE are refused for every role, including the table owner. A changed payload is a NEW manifest. The exceptions are one-way erasures proven from canonical truth: a derivative whose Shared source owner deletion physically erased (S5-02, ASSURE-F05), and an authored item of a never-published topic its author discarded (S8A-05).';
END$$;

ALTER FUNCTION public.reject_publication_package_mutation_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reject_publication_package_mutation_v1() FROM PUBLIC;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_publication_package_mutation_v1() FROM anon, authenticated, service_role';
ELSE
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_publication_package_mutation_v1() FROM anon, authenticated';
END IF;END$$;

-- B.4 THE FIFTH LIFECYCLE MOVER (A-2(c), R1-03): discard a NEVER-PUBLISHED topic. Frozen-primitive posture: the actor
--     is auth.uid(), the exact controller; no application role executes it (the compose definers call it). Canonical
--     Public lock prefix (the ONE Public World, then the exact Experience). DISCARDED | ALREADY_DISCARDED | UNAVAILABLE
--     (not this human's, or no such Experience: one neutral answer) | NOT_DISCARDABLE (ever published, already
--     absent, without a package, or holding any non-authored item - those are S8A-05 CP2 / the 0099 removal).
CREATE FUNCTION public.discard_never_published_public_experience_v1(p_command_id uuid, p_experience_id uuid)
RETURNS TABLE (outcome text, discarded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  v_experience public.public_experiences;
  v_prior public_compose_private.discard_commands;
  v_instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  SELECT e.* INTO v_experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                               WHERE c.experience_id = p_experience_id AND c.controller_user_id = u) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::timestamptz;
    RETURN;
  END IF;
  SELECT d.* INTO v_prior FROM public_compose_private.discard_commands d WHERE d.experience_id = p_experience_id;
  IF FOUND THEN
    RETURN QUERY SELECT 'ALREADY_DISCARDED'::text, v_prior.occurred_at;
    RETURN;
  END IF;
  IF v_experience.current_lifecycle NOT IN ('DRAFT', 'READY_FOR_REVIEW')
     OR v_experience.current_experience_version_id IS NULL
     OR EXISTS (SELECT 1 FROM public.public_experience_publication_state s WHERE s.experience_id = p_experience_id)
     OR EXISTS (SELECT 1 FROM public.publication_package_item_provenance p
                  JOIN public.publication_package_manifest_versions m ON m.id = p.manifest_version_id
                 WHERE m.experience_id = p_experience_id AND p.source_class <> 'PUBLIC_AUTHORED') THEN
    RETURN QUERY SELECT 'NOT_DISCARDABLE'::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- ONE DATABASE-OWNED INSTANT for the proof, the transition and every erasure.
  v_instant := clock_timestamp();
  BEGIN
    INSERT INTO public_compose_private.discard_commands (id, experience_id, occurred_at)
    VALUES (p_command_id, p_experience_id, v_instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;
  UPDATE public.public_experiences e SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD',
         experience_revision = e.experience_revision + 1
   WHERE e.id = p_experience_id;
  INSERT INTO public.public_experience_lifecycle_events
    (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
  VALUES (p_command_id, p_experience_id, v_experience.current_experience_version_id, v_experience.current_lifecycle,
          'ABSENT_FROM_PUBLIC_WORLD', v_instant);

  -- THE ERASURE, in the order the guard proves it: the content verifiers, then the items, then the bytes. The 0144
  -- trigger erases every semantic text derived from these packages at this same instant.
  UPDATE public.publication_package_item_provenance p
     SET captured_source_digest = NULL, captured_digest_erased_at = v_instant
    FROM public.publication_package_manifest_versions m
   WHERE m.id = p.manifest_version_id AND m.experience_id = p_experience_id AND p.captured_source_digest IS NOT NULL;
  UPDATE public.publication_package_manifest_items it
     SET content_state = 'ERASED_BY_OWNER', public_body_digest = NULL, content_erased_at = v_instant
   WHERE it.experience_id = p_experience_id AND it.content_state = 'CONTENT_PRESENT';
  DELETE FROM public.public_experience_text_derivative_bodies b
   USING public.publication_package_manifest_items it
   WHERE it.package_item_id = b.package_item_id AND it.experience_id = p_experience_id;
  UPDATE public_compose_private.version_titles t SET title = NULL, title_erased_at = v_instant
   WHERE t.experience_id = p_experience_id AND t.title IS NOT NULL;

  RETURN QUERY SELECT 'DISCARDED'::text, v_instant;
END$$;

-- =====================================================================================================================
-- C. INTERNAL HELPERS. Executable by no application role.
-- =====================================================================================================================

-- C.1 THE FREEZE CLEARANCE SEAM. Preparing a topic for publication provisions the ONE Public Identity and creates the
--     Public Experience, so it opens only with publication itself (Stage 9, CW2-08). Until a reviewed migration
--     replaces this body, every freeze answers PUBLICATION_NOT_OPEN before it reads, locks or writes anything.
CREATE FUNCTION public_compose_private.resolve_topic_freeze_clearance_v1()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 'NOT_EVALUATED'::text;
$$;

-- C.2 Deterministic sub-command identities from the human and their freeze command.
CREATE FUNCTION public_compose_private.derive_compose_identity_v1(p_namespace text, p_actor uuid, p_command_id uuid)
RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 3) || substr(h, 21, 12))::uuid
    FROM (SELECT encode(sha256(convert_to('QANDEEL_S8A_05_PUBLIC_COMPOSE_IDENTITY_V1' || E'\n' || p_namespace || E'\n'
                                          || lower(p_actor::text) || E'\n' || lower(p_command_id::text), 'UTF8')), 'hex') AS h) d;
$$;

-- C.3 The owner's account is being deleted: no new draft write.
CREATE FUNCTION public_compose_private.account_deletion_pending_v1(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- The account row first, shared: a deletion request or the erasure (FOR UPDATE) serializes with the write.
  PERFORM 1 FROM public.users u WHERE u.id = p_user FOR KEY SHARE;
  -- One owner draft command at a time, so the draft bound and a create retry are decided once.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel:public-compose:' || p_user::text, 0));
  RETURN EXISTS (SELECT 1 FROM personal_data_private.account_deletions d
                  WHERE d.user_id = p_user AND d.status IN ('SCHEDULED', 'BLOCKED', 'ERASED', 'COMPLETED'));
END$$;

-- C.4 The public form of a draft field: its outer whitespace trimmed. What the preview shows is exactly this.
CREATE FUNCTION public_compose_private.public_form_v1(p_text text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT btrim(p_text, E' \t\n');
$$;

-- C.5 Whether a draft can be prepared: READY, or the first thing missing.
CREATE FUNCTION public_compose_private.draft_readiness_v1(p_title text, p_body text, p_section_key text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN char_length(public_compose_private.public_form_v1(p_title)) < 8 THEN 'TITLE_TOO_SHORT'
    WHEN char_length(public_compose_private.public_form_v1(p_body)) = 0 THEN 'TEXT_REQUIRED'
    WHEN p_section_key IS NULL THEN 'SECTION_REQUIRED'
    WHEN NOT EXISTS (SELECT 1 FROM public_compose_private.sections s
                      WHERE s.section_key = p_section_key AND s.retired_at IS NULL) THEN 'SECTION_REQUIRED'
    ELSE 'READY' END;
$$;

-- C.6 The deterministic privacy notes of the preview (no model, nothing stored): a phone-like number, an email
--     address, a link, the author's own account Name while they would appear under their Public ID, and appearing
--     under their real Name at all. Notes, never a block: the author decides.
CREATE FUNCTION public_compose_private.privacy_notes_v1(p_text text, p_real_name text, p_label_mode text)
RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_text text := translate(coalesce(p_text, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  v_name text := btrim(coalesce(p_real_name, ''));
  v_first text;
  v_notes text[] := ARRAY[]::text[];
BEGIN
  IF v_text ~ '([0-9][ .-]?){7,}[0-9]' THEN
    v_notes := array_append(v_notes, 'CONTACT_NUMBER');
  END IF;
  IF v_text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' THEN
    v_notes := array_append(v_notes, 'EMAIL_ADDRESS');
  END IF;
  IF v_text ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|io|me|info)([/?#]|[[:space:]]|$))' THEN
    v_notes := array_append(v_notes, 'LINK');
  END IF;
  IF p_label_mode = 'PSEUDONYM' AND char_length(v_name) >= 3 THEN
    v_first := split_part(v_name, ' ', 1);
    IF position(lower(v_name) IN lower(v_text)) > 0
       OR (char_length(v_first) >= 3 AND lower(v_text) ~ ('(^|[[:space:][:punct:]])'
             || regexp_replace(lower(v_first), '([[:punct:]])', '\\\1', 'g') || '([[:space:][:punct:]]|$)')) THEN
      v_notes := array_append(v_notes, 'OWN_NAME');
    END IF;
  END IF;
  IF p_label_mode = 'REAL_NAME' THEN
    v_notes := array_append(v_notes, 'SHOWN_UNDER_REAL_NAME');
  END IF;
  RETURN v_notes;
END$$;

-- C.7 THE AUTHORED PACKAGE: the 0119 preparation sequence for exactly ONE PUBLIC_AUTHORED item whose body is the
--     author's text. Same lock prefix, same exact-controller and DRAFT rules, same rows at one instant, the authority
--     from the ONE derivation. Internal: reached only from the freeze.
CREATE FUNCTION public_compose_private.prepare_authored_package_v1(
  p_command_id uuid, p_experience_id uuid, p_manifest_version_id uuid, p_experience_version_id uuid,
  p_package_item_id uuid, p_body text
) RETURNS TABLE (required_approver_count integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u uuid := auth.uid();
  v_experience public.public_experiences;
  v_controller public.public_experience_controllers;
  v_ordinal integer;
  v_instant timestamptz;
  v_digest text;
  v_request text;
  v_approvers uuid[];
  v_count integer;
  v_fingerprint text;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_manifest_version_id IS NULL OR p_experience_version_id IS NULL
     OR p_package_item_id IS NULL OR p_body IS NULL OR length(btrim(p_body)) = 0 OR char_length(p_body) > 5000 THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.publication_package_prepare_commands c WHERE c.id = p_command_id) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  SELECT e.* INTO v_experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT c.* INTO v_controller FROM public.public_experience_controllers c
   WHERE c.experience_id = p_experience_id AND c.controller_user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;
  IF v_experience.current_lifecycle <> 'DRAFT' THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID' USING ERRCODE='55000';
  END IF;

  SELECT coalesce(max(v.version_ordinal), 0) + 1 INTO v_ordinal
    FROM public.public_experience_versions v WHERE v.experience_id = p_experience_id;
  v_instant := clock_timestamp();
  v_digest := 'sha256:' || encode(sha256(convert_to(p_body, 'UTF8')), 'hex');
  -- The request reference names the package identities, never the text.
  v_request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_S8A_05_PUBLIC_AUTHORED_PREPARE_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'manifest=' || lower(p_manifest_version_id::text) || E'\n'
   || 'experienceVersion=' || lower(p_experience_version_id::text) || E'\n'
   || 'authored=' || lower(p_package_item_id::text), 'UTF8')), 'hex');

  INSERT INTO public.publication_package_manifest_versions
    (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
     intended_publication_action, target_audience_class, authority_readiness,
     prepared_authority_snapshot_version, item_count, created_at)
  SELECT p_manifest_version_id, p_experience_id, true, v_controller.controller_public_identity_ref, u,
         'PUBLISH_TO_PUBLIC_WORLD', 'PUBLIC_WORLD_AUDIENCE', 'PRIVACY_OWNERSHIP_AUTHORITY_ONLY',
         w.state_version, 1, v_instant
    FROM public.public_world_state w WHERE w.singleton;
  INSERT INTO public.publication_package_manifest_items
    (manifest_version_id, experience_id, package_item_id, item_ordinal, derivative_classification, public_body_form,
     public_body_digest)
  VALUES (p_manifest_version_id, p_experience_id, p_package_item_id, 1, 'SOURCE_CONTENT_BEARING_DERIVATIVE',
          'PUBLIC_TEXT', v_digest);
  INSERT INTO public.public_experience_text_derivative_bodies (package_item_id, public_body_form, public_text_body)
  VALUES (p_package_item_id, 'PUBLIC_TEXT', p_body);
  INSERT INTO public.publication_package_item_provenance
    (package_item_id, manifest_version_id, source_class, personal_conversation_unit_id, personal_owner_user_id,
     shared_world_id, shared_material_id, shared_history_item_id, captured_availability_state,
     captured_availability_revision, captured_source_digest)
  VALUES (p_package_item_id, p_manifest_version_id, 'PUBLIC_AUTHORED', NULL, NULL, NULL, NULL, NULL, 'AVAILABLE',
          NULL, v_digest);
  INSERT INTO public.publication_package_item_authority
    (package_item_id, manifest_version_id, resolution_state, required_approver_count)
  VALUES (p_package_item_id, p_manifest_version_id, 'RESOLVED_EXACT_HUMAN_REQUIREMENT', 1);
  INSERT INTO public.public_experience_versions (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
  VALUES (p_experience_version_id, p_experience_id, p_manifest_version_id, v_ordinal, v_instant);

  SELECT d.required_approvers, d.required_approver_count, d.authority_fingerprint
    INTO v_approvers, v_count, v_fingerprint
    FROM public.derive_public_publication_authority_v1(p_manifest_version_id) d;
  INSERT INTO public.publication_manifest_required_approvers (manifest_version_id, approver_user_id)
  SELECT p_manifest_version_id, a.approver FROM unnest(v_approvers) AS a(approver);

  UPDATE public.public_experiences e
     SET current_experience_version_id = p_experience_version_id,
         experience_revision = e.experience_revision + 1
   WHERE e.id = p_experience_id;
  INSERT INTO public.publication_package_prepare_commands
    (id, experience_id, manifest_version_id, experience_version_id, actor_user_id, command_action,
     item_count, required_approver_count, authority_request_fingerprint, request_ref, committed_at)
  VALUES (p_command_id, p_experience_id, p_manifest_version_id, p_experience_version_id, u,
          'PREPARE_PUBLICATION', 1, v_count, v_fingerprint, v_request, v_instant);
  RETURN QUERY SELECT v_count;
END$$;

-- =====================================================================================================================
-- D. OWNER COMMANDS (authenticated; the exact human from auth.uid(), admitted as a REGISTERED Public viewer).
--    No draft command provisions a Public Identity or touches any Public relation.
-- =====================================================================================================================

-- D.1 My drafts, newest change first (a technical bound of 50, which is also the most a human may keep).
CREATE FUNCTION public_compose_private.list_own_topic_drafts_v1()
RETURNS TABLE (draft_id uuid, draft_revision bigint, title text, section_key text, text_length integer, draft_state text,
               experience_id uuid, experience_lifecycle text, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
BEGIN
  RETURN QUERY
    SELECT d.id, d.draft_revision, d.title, d.section_key, char_length(d.body),
           CASE WHEN d.prepared_experience_id IS NULL THEN 'EDITING' ELSE 'PREPARED' END,
           d.prepared_experience_id, e.current_lifecycle, d.updated_at
      FROM public_compose_private.topic_drafts d
      LEFT JOIN public.public_experiences e ON e.id = d.prepared_experience_id
     WHERE d.user_id = v_user
     ORDER BY d.updated_at DESC, d.id
     LIMIT 50;
END$$;

-- D.2 One draft of mine. Zero rows for anything else (no oracle).
CREATE FUNCTION public_compose_private.read_own_topic_draft_v1(p_draft_id uuid)
RETURNS TABLE (draft_id uuid, draft_revision bigint, title text, body text, section_key text, draft_state text,
               experience_id uuid, experience_lifecycle text, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
BEGIN
  IF p_draft_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT d.id, d.draft_revision, d.title, d.body, d.section_key,
           CASE WHEN d.prepared_experience_id IS NULL THEN 'EDITING' ELSE 'PREPARED' END,
           d.prepared_experience_id, e.current_lifecycle, d.created_at, d.updated_at
      FROM public_compose_private.topic_drafts d
      LEFT JOIN public.public_experiences e ON e.id = d.prepared_experience_id
     WHERE d.id = p_draft_id AND d.user_id = v_user;
END$$;

-- D.3 SAVE a draft: create it under a client-chosen id (expected revision 0) or replace its fields under
--     compare-and-set. CREATED | SAVED | STALE | NOT_FOUND | PREPARED (read-only while prepared) | LIMIT_REACHED |
--     INVALID | ACCOUNT_DELETION_PENDING. An equivalent retry of the save that produced the current revision answers
--     SAVED with that revision.
CREATE FUNCTION public_compose_private.save_own_topic_draft_v1(
  p_draft_id uuid, p_expected_revision bigint, p_title text, p_body text, p_section_key text
) RETURNS TABLE (outcome text, draft_revision bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_draft public_compose_private.topic_drafts;
BEGIN
  IF p_draft_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 OR p_title IS NULL OR p_body IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF char_length(p_title) > 100 OR p_title ~ '[[:cntrl:]]' OR char_length(p_body) > 5000
     OR p_body ~ '[\x01-\x08\x0B-\x1F\x7F]'
     OR (p_section_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public_compose_private.sections s
                                                   WHERE s.section_key = p_section_key AND s.retired_at IS NULL)) THEN
    RETURN QUERY SELECT 'INVALID'::text, NULL::bigint;
    RETURN;
  END IF;
  IF public_compose_private.account_deletion_pending_v1(v_user) THEN
    RETURN QUERY SELECT 'ACCOUNT_DELETION_PENDING'::text, NULL::bigint;
    RETURN;
  END IF;
  SELECT d.* INTO v_draft FROM public_compose_private.topic_drafts d WHERE d.id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected_revision <> 0 THEN
      RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bigint;
      RETURN;
    END IF;
    IF (SELECT count(*) FROM public_compose_private.topic_drafts d WHERE d.user_id = v_user) >= 50 THEN
      RETURN QUERY SELECT 'LIMIT_REACHED'::text, NULL::bigint;
      RETURN;
    END IF;
    INSERT INTO public_compose_private.topic_drafts (id, user_id, draft_revision, title, body, section_key)
    VALUES (p_draft_id, v_user, 1, p_title, p_body, p_section_key);
    RETURN QUERY SELECT 'CREATED'::text, 1::bigint;
    RETURN;
  END IF;
  IF v_draft.user_id <> v_user THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bigint;
    RETURN;
  END IF;
  IF v_draft.prepared_experience_id IS NOT NULL THEN
    RETURN QUERY SELECT 'PREPARED'::text, v_draft.draft_revision;
    RETURN;
  END IF;
  IF v_draft.title = p_title AND v_draft.body = p_body AND v_draft.section_key IS NOT DISTINCT FROM p_section_key
     AND p_expected_revision IN (v_draft.draft_revision, v_draft.draft_revision - 1) THEN
    RETURN QUERY SELECT 'SAVED'::text, v_draft.draft_revision;
    RETURN;
  END IF;
  IF p_expected_revision <> v_draft.draft_revision THEN
    RETURN QUERY SELECT 'STALE'::text, v_draft.draft_revision;
    RETURN;
  END IF;
  UPDATE public_compose_private.topic_drafts d
     SET title = p_title, body = p_body, section_key = p_section_key, draft_revision = d.draft_revision + 1,
         updated_at = clock_timestamp()
   WHERE d.id = p_draft_id;
  RETURN QUERY SELECT 'SAVED'::text, v_draft.draft_revision + 1;
END$$;

-- D.4 DISCARD a never-published topic and return its draft to editing. DISCARDED | ALREADY_DISCARDED | UNAVAILABLE |
--     NOT_DISCARDABLE. The draft keeps the author's private text; the Public copy is erased.
CREATE FUNCTION public_compose_private.discard_own_unpublished_topic_v1(p_command_id uuid, p_experience_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_outcome text;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT d.outcome INTO v_outcome FROM public.discard_never_published_public_experience_v1(p_command_id, p_experience_id) d;
  IF v_outcome IN ('DISCARDED', 'ALREADY_DISCARDED') THEN
    UPDATE public_compose_private.topic_drafts d
       SET prepared_experience_id = NULL, draft_revision = d.draft_revision + 1, updated_at = clock_timestamp()
     WHERE d.prepared_experience_id = p_experience_id AND d.user_id = v_user;
  END IF;
  RETURN QUERY SELECT v_outcome;
END$$;

-- D.5 DELETE a draft. A prepared (never-published) topic is discarded first, in the same transaction, so deleting a
--     draft never leaves its words anywhere. DELETED | NOT_FOUND | NOT_DISCARDABLE | ACCOUNT_DELETION_PENDING.
CREATE FUNCTION public_compose_private.delete_own_topic_draft_v1(p_command_id uuid, p_draft_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_draft public_compose_private.topic_drafts;
  v_outcome text;
BEGIN
  IF p_command_id IS NULL OR p_draft_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF public_compose_private.account_deletion_pending_v1(v_user) THEN
    RETURN QUERY SELECT 'ACCOUNT_DELETION_PENDING'::text;
    RETURN;
  END IF;
  SELECT d.* INTO v_draft FROM public_compose_private.topic_drafts d WHERE d.id = p_draft_id AND d.user_id = v_user;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text;
    RETURN;
  END IF;
  IF v_draft.prepared_experience_id IS NOT NULL THEN
    SELECT d.outcome INTO v_outcome
      FROM public.discard_never_published_public_experience_v1(p_command_id, v_draft.prepared_experience_id) d;
    IF v_outcome NOT IN ('DISCARDED', 'ALREADY_DISCARDED') THEN
      RETURN QUERY SELECT v_outcome;
      RETURN;
    END IF;
  END IF;
  DELETE FROM public_compose_private.topic_drafts d WHERE d.id = p_draft_id AND d.user_id = v_user;
  RETURN QUERY SELECT 'DELETED'::text;
END$$;

-- D.6 PREVIEW what the Public World would see: the public form of the title and text, the section, the author's
--     CURRENT public display (derived, never provisioned), and the deterministic privacy notes. Zero rows for anything
--     not mine. readiness = READY or the first thing missing.
CREATE FUNCTION public_compose_private.preview_own_topic_draft_v1(p_draft_id uuid)
RETURNS TABLE (draft_revision bigint, readiness text, title text, body text, section_key text, publisher_label_mode text,
               publisher_display_label text, privacy_notes text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_draft public_compose_private.topic_drafts;
  v_mode text;
  v_label text;
  v_name text;
BEGIN
  IF p_draft_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT d.* INTO v_draft FROM public_compose_private.topic_drafts d WHERE d.id = p_draft_id AND d.user_id = v_user;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT x.label_mode, x.display_label INTO v_mode, v_label FROM public_world_private.derive_account_public_display_v1(v_user) x;
  SELECT u.name INTO v_name FROM public.users u WHERE u.id = v_user;
  RETURN QUERY SELECT v_draft.draft_revision,
                      public_compose_private.draft_readiness_v1(v_draft.title, v_draft.body, v_draft.section_key),
                      public_compose_private.public_form_v1(v_draft.title),
                      public_compose_private.public_form_v1(v_draft.body),
                      v_draft.section_key, v_mode, v_label,
                      public_compose_private.privacy_notes_v1(v_draft.title || E'\n' || v_draft.body, v_name, v_mode);
END$$;

-- D.7 FREEZE (prepare for publication): in ONE transaction, provision the one Public Identity, start the Experience,
--     prepare its authored package from exactly the previewed revision, record its title and section, approve it as
--     its author and commit READY_FOR_REVIEW; then the draft becomes read-only. CLOSED: the clearance seam answers
--     first, before any read or write. PREPARED | ALREADY_PREPARED | PUBLICATION_NOT_OPEN | STALE | NOT_FOUND |
--     TITLE_TOO_SHORT | TEXT_REQUIRED | SECTION_REQUIRED | NOT_PREPARED | ACCOUNT_DELETION_PENDING. Nothing publishes.
CREATE FUNCTION public_compose_private.freeze_own_topic_draft_v1(p_command_id uuid, p_draft_id uuid, p_expected_revision bigint)
RETURNS TABLE (outcome text, experience_id uuid, current_lifecycle text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_draft public_compose_private.topic_drafts;
  v_ready text;
  v_title text;
  v_body text;
  v_experience uuid;
  v_manifest uuid;
  v_version uuid;
  v_step text;
BEGIN
  IF p_command_id IS NULL OR p_draft_id IS NULL OR p_expected_revision IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  -- THE GATE FIRST.
  IF public_compose_private.resolve_topic_freeze_clearance_v1() IS DISTINCT FROM 'CLEARED' THEN
    RETURN QUERY SELECT 'PUBLICATION_NOT_OPEN'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  IF public_compose_private.account_deletion_pending_v1(v_user) THEN
    RETURN QUERY SELECT 'ACCOUNT_DELETION_PENDING'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  SELECT d.* INTO v_draft FROM public_compose_private.topic_drafts d
   WHERE d.id = p_draft_id AND d.user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  IF v_draft.prepared_experience_id IS NOT NULL THEN
    RETURN QUERY SELECT 'ALREADY_PREPARED'::text, v_draft.prepared_experience_id,
                        (SELECT e.current_lifecycle FROM public.public_experiences e WHERE e.id = v_draft.prepared_experience_id);
    RETURN;
  END IF;
  IF p_expected_revision <> v_draft.draft_revision THEN
    RETURN QUERY SELECT 'STALE'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  v_ready := public_compose_private.draft_readiness_v1(v_draft.title, v_draft.body, v_draft.section_key);
  IF v_ready <> 'READY' THEN
    RETURN QUERY SELECT v_ready, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  v_title := public_compose_private.public_form_v1(v_draft.title);
  v_body := public_compose_private.public_form_v1(v_draft.body);

  BEGIN
    SELECT s.experience_id, s.outcome INTO v_experience, v_step
      FROM public_authoring_private.start_own_public_experience_draft_v1(
             public_compose_private.derive_compose_identity_v1('START', v_user, p_command_id)) s;
    IF v_step <> 'CREATED' THEN
      RAISE EXCEPTION 'PUBLIC_COMPOSE_NOT_PREPARED' USING ERRCODE = 'QC179';
    END IF;
    v_manifest := public_compose_private.derive_compose_identity_v1('MANIFEST', v_user, p_command_id);
    v_version := public_compose_private.derive_compose_identity_v1('VERSION', v_user, p_command_id);
    PERFORM 1 FROM public_compose_private.prepare_authored_package_v1(
      public_compose_private.derive_compose_identity_v1('PREPARE', v_user, p_command_id), v_experience, v_manifest,
      v_version, public_compose_private.derive_compose_identity_v1('ITEM', v_user, p_command_id), v_body);
    INSERT INTO public_compose_private.version_titles (experience_version_id, experience_id, title, created_at)
    VALUES (v_version, v_experience, v_title, clock_timestamp());
    INSERT INTO public_compose_private.experience_sections (experience_id, section_key, section_revision, updated_at)
    VALUES (v_experience, v_draft.section_key, 1, clock_timestamp());
    INSERT INTO public_compose_private.experience_section_events (id, experience_id, section_key, section_revision, occurred_at)
    VALUES (public_compose_private.derive_compose_identity_v1('SECTION', v_user, p_command_id), v_experience,
            v_draft.section_key, 1, clock_timestamp());
    SELECT a.outcome INTO v_step FROM public_authoring_private.approve_own_public_package_v1(
      public_compose_private.derive_compose_identity_v1('APPROVE', v_user, p_command_id), v_manifest) a;
    IF v_step <> 'APPROVED' THEN
      RAISE EXCEPTION 'PUBLIC_COMPOSE_NOT_PREPARED' USING ERRCODE = 'QC179';
    END IF;
    SELECT c.outcome INTO v_step FROM public_authoring_private.commit_own_public_experience_ready_v1(
      public_compose_private.derive_compose_identity_v1('READY', v_user, p_command_id), v_experience) c;
    IF v_step <> 'READY_FOR_REVIEW' THEN
      RAISE EXCEPTION 'PUBLIC_COMPOSE_NOT_PREPARED' USING ERRCODE = 'QC179';
    END IF;
    UPDATE public_compose_private.topic_drafts d SET prepared_experience_id = v_experience, updated_at = clock_timestamp()
     WHERE d.id = p_draft_id;
  EXCEPTION
    WHEN SQLSTATE 'QC179' OR SQLSTATE '23505' THEN
      -- Everything this block wrote is rolled back with it: no identity, no Experience, no package.
      RETURN QUERY SELECT 'NOT_PREPARED'::text, NULL::uuid, NULL::text;
      RETURN;
  END;
  RETURN QUERY SELECT 'PREPARED'::text, v_experience, 'READY_FOR_REVIEW'::text;
END$$;

-- D.8 CHANGE THE SECTION of my topic (the container). No new version, no interpretation, no placement, no discussion
--     or relation is touched. CHANGED | UNCHANGED | UNAVAILABLE | INVALID.
CREATE FUNCTION public_compose_private.set_own_topic_section_v1(p_command_id uuid, p_experience_id uuid, p_section_key text)
RETURNS TABLE (outcome text, section_revision bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_current public_compose_private.experience_sections;
  v_revision bigint;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_section_key IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public_compose_private.sections s WHERE s.section_key = p_section_key AND s.retired_at IS NULL) THEN
    RETURN QUERY SELECT 'INVALID'::text, NULL::bigint;
    RETURN;
  END IF;
  -- The exact Experience, shared: a discard or removal (FOR UPDATE) serializes with the change.
  PERFORM 1 FROM public.public_experiences e
    JOIN public.public_experience_controllers c ON c.experience_id = e.id AND c.controller_user_id = v_user
   WHERE e.id = p_experience_id AND e.current_lifecycle <> 'ABSENT_FROM_PUBLIC_WORLD' FOR SHARE OF e;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::bigint;
    RETURN;
  END IF;
  SELECT s.* INTO v_current FROM public_compose_private.experience_sections s WHERE s.experience_id = p_experience_id FOR UPDATE;
  IF FOUND AND v_current.section_key = p_section_key THEN
    RETURN QUERY SELECT 'UNCHANGED'::text, v_current.section_revision;
    RETURN;
  END IF;
  IF FOUND THEN
    v_revision := v_current.section_revision + 1;
    UPDATE public_compose_private.experience_sections s
       SET section_key = p_section_key, section_revision = v_revision, updated_at = clock_timestamp()
     WHERE s.experience_id = p_experience_id;
  ELSE
    v_revision := 1;
    INSERT INTO public_compose_private.experience_sections (experience_id, section_key, section_revision, updated_at)
    VALUES (p_experience_id, p_section_key, 1, clock_timestamp());
  END IF;
  INSERT INTO public_compose_private.experience_section_events (id, experience_id, section_key, section_revision, occurred_at)
  VALUES (public_compose_private.derive_compose_identity_v1('SECTION', v_user, p_command_id), p_experience_id, p_section_key,
          v_revision, clock_timestamp());
  RETURN QUERY SELECT 'CHANGED'::text, v_revision;
END$$;

-- =====================================================================================================================
-- E. VIEWER READS (authenticated; an admitted REGISTERED viewer; served Experiences only, through the ONE 0145
--    visible-entry derivation, so nothing hidden, stale, unpublished or discarded ever answers).
-- =====================================================================================================================

-- E.1 The human title (of exactly the visible version) and the section of up to 400 served topics.
CREATE FUNCTION public_compose_private.read_public_topic_headers_v1(p_experience_ids uuid[])
RETURNS TABLE (experience_id uuid, title text, section_key text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_experience_ids IS NULL OR coalesce(array_length(p_experience_ids, 1), 0) > 400 THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF public_spatial_private.admitted_viewer_v1() IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT ve.experience_id, t.title, s.section_key
      FROM (SELECT DISTINCT x.id FROM unnest(p_experience_ids) AS x(id) WHERE x.id IS NOT NULL) ids
      CROSS JOIN LATERAL public_spatial_private.derive_visible_spatial_entry_v1(ids.id) ve
      LEFT JOIN public_compose_private.version_titles t
        ON t.experience_version_id = ve.experience_version_id AND t.title IS NOT NULL
      LEFT JOIN public_compose_private.experience_sections s ON s.experience_id = ve.experience_id
     ORDER BY ve.experience_id;
END$$;

-- E.2 Title search over the same field: at most 20 served topics whose human title matches (the frozen `simple`
--     configuration, the 0145 query rules), each with its place in the field.
CREATE FUNCTION public_compose_private.read_public_topic_title_matches_v1(p_query text)
RETURNS TABLE (experience_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_query tsquery;
BEGIN
  IF p_query IS NULL OR p_query <> btrim(p_query) OR length(p_query) NOT BETWEEN 1 AND 120 OR p_query ~ '[\n\r\t]' THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
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
      JOIN public_compose_private.version_titles t
        ON t.experience_version_id = ve.experience_version_id AND t.title IS NOT NULL
     WHERE to_tsvector('pg_catalog.simple', t.title) @@ v_query
     ORDER BY ts_rank(to_tsvector('pg_catalog.simple', t.title), v_query) DESC, ve.experience_id
     LIMIT 20;
END$$;

-- E.3 Search INSIDE ONE SECTION (the reader's section view, WP1 §2.5 item 4): at most 20 served topics of that section
--     whose human title, reviewed meaning, themes or public text match - the one 0145 document plus the title, built at
--     read time and stored nowhere, ordered by relevance alone. A section is the reader's choice over the same field: it
--     ranks nothing and moves nothing. An unknown section is invalid; a retired one still has its topics.
CREATE FUNCTION public_compose_private.read_public_section_topic_matches_v1(p_query text, p_section_key text)
RETURNS TABLE (experience_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_query tsquery;
BEGIN
  IF p_query IS NULL OR p_query <> btrim(p_query) OR length(p_query) NOT BETWEEN 1 AND 120 OR p_query ~ '[\n\r\t]'
     OR p_section_key IS NULL
     OR NOT EXISTS (SELECT 1 FROM public_compose_private.sections s WHERE s.section_key = p_section_key) THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
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
      JOIN public_compose_private.experience_sections es ON es.experience_id = c.experience_id AND es.section_key = p_section_key
      CROSS JOIN LATERAL public_spatial_private.derive_visible_spatial_entry_v1(c.experience_id) ve
      LEFT JOIN public_compose_private.version_titles t
        ON t.experience_version_id = ve.experience_version_id AND t.title IS NOT NULL
      CROSS JOIN LATERAL (
        SELECT to_tsvector('pg_catalog.simple',
                 coalesce(t.title, '') || ' ' || ve.meaning || ' ' || array_to_string(ve.primary_themes, ' ') || ' '
                 || array_to_string(ve.secondary_themes, ' ') || ' '
                 || coalesce(string_agg(b.public_text_body, ' ' ORDER BY it.item_ordinal), '')) AS document
          FROM public.publication_package_manifest_items it
          JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
         WHERE it.manifest_version_id = ve.manifest_version_id AND it.content_state = 'CONTENT_PRESENT') d
     WHERE d.document @@ v_query
     ORDER BY ts_rank(d.document, v_query) DESC, ve.experience_id
     LIMIT 20;
END$$;

-- =====================================================================================================================
-- F. THE EXPOSED WRAPPERS: SECURITY INVOKER, each a one-line call into its definer.
-- =====================================================================================================================
CREATE FUNCTION public.list_own_topic_drafts_v1()
RETURNS TABLE (draft_id uuid, draft_revision bigint, title text, section_key text, text_length integer, draft_state text,
               experience_id uuid, experience_lifecycle text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_private.list_own_topic_drafts_v1();
$$;
CREATE FUNCTION public.read_own_topic_draft_v1(p_draft_id uuid)
RETURNS TABLE (draft_id uuid, draft_revision bigint, title text, body text, section_key text, draft_state text,
               experience_id uuid, experience_lifecycle text, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_private.read_own_topic_draft_v1(p_draft_id);
$$;
CREATE FUNCTION public.save_own_topic_draft_v1(
  p_draft_id uuid, p_expected_revision bigint, p_title text, p_body text, p_section_key text
) RETURNS TABLE (outcome text, draft_revision bigint)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_private.save_own_topic_draft_v1(p_draft_id, p_expected_revision, p_title, p_body, p_section_key);
$$;
CREATE FUNCTION public.delete_own_topic_draft_v1(p_command_id uuid, p_draft_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_private.delete_own_topic_draft_v1(p_command_id, p_draft_id);
$$;
CREATE FUNCTION public.preview_own_topic_draft_v1(p_draft_id uuid)
RETURNS TABLE (draft_revision bigint, readiness text, title text, body text, section_key text, publisher_label_mode text,
               publisher_display_label text, privacy_notes text[])
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_private.preview_own_topic_draft_v1(p_draft_id);
$$;
CREATE FUNCTION public.freeze_own_topic_draft_v1(p_command_id uuid, p_draft_id uuid, p_expected_revision bigint)
RETURNS TABLE (outcome text, experience_id uuid, current_lifecycle text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_private.freeze_own_topic_draft_v1(p_command_id, p_draft_id, p_expected_revision);
$$;
CREATE FUNCTION public.discard_own_unpublished_topic_v1(p_command_id uuid, p_experience_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_private.discard_own_unpublished_topic_v1(p_command_id, p_experience_id);
$$;
CREATE FUNCTION public.set_own_topic_section_v1(p_command_id uuid, p_experience_id uuid, p_section_key text)
RETURNS TABLE (outcome text, section_revision bigint)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_private.set_own_topic_section_v1(p_command_id, p_experience_id, p_section_key);
$$;
CREATE FUNCTION public.read_public_topic_headers_v1(p_experience_ids uuid[])
RETURNS TABLE (experience_id uuid, title text, section_key text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_private.read_public_topic_headers_v1(p_experience_ids);
$$;
CREATE FUNCTION public.read_public_topic_title_matches_v1(p_query text)
RETURNS TABLE (experience_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_private.read_public_topic_title_matches_v1(p_query);
$$;
CREATE FUNCTION public.read_public_section_topic_matches_v1(p_query text, p_section_key text)
RETURNS TABLE (experience_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_private.read_public_section_topic_matches_v1(p_query, p_section_key);
$$;

-- =====================================================================================================================
-- G. EXPORT MY DATA (0168 body re-stated with ONE added section, `publicTopicDrafts`, before `notYetIncluded`).
-- =====================================================================================================================
CREATE OR REPLACE FUNCTION personal_data_private.build_personal_export_v1(p_subject uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'format', 'qandeel.personal-data-export.v1',
        'preparedAt', clock_timestamp(),
        'account', (
            SELECT jsonb_build_object(
                'name', u.name,
                'loginId', u.login_id,
                'publicId', u.public_id,
                'accountCreatedAt', u.created_at)
              FROM public.users u WHERE u.id = p_subject),
        'conversations', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'startedAt', s.created_at,
                       'lastActivityAt', s.last_activity_at,
                       'turns', coalesce((
                           SELECT jsonb_agg(jsonb_build_object(
                                      'speaker', CASE t.role WHEN 'USER' THEN 'you' ELSE 'qandeel' END,
                                      'text', t.content,
                                      'at', t.created_at,
                                      'state', lower(t.status))
                                  ORDER BY t.created_at, t.id)
                             FROM public.conversation_turns t
                            WHERE t.session_id = s.id AND t.user_id = p_subject
                              AND (t.role = 'USER' OR (t.role = 'ASSISTANT' AND t.status = 'COMPLETED'))), '[]'::jsonb))
                   ORDER BY s.created_at, s.id)
              FROM public.conversation_sessions s WHERE s.user_id = p_subject), '[]'::jsonb),
        'memory', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'text', m.content,
                       'kind', lower(m.type),
                       'state', CASE m.status WHEN 'ACTIVE' THEN 'active'
                                              WHEN 'DISABLED' THEN 'not relied on'
                                              WHEN 'DELETED' THEN 'forgotten'
                                              WHEN 'SUPERSEDED' THEN 'replaced by a correction'
                                              ELSE lower(m.status) END,
                       'rememberedAt', m.created_at,
                       'lastChangedAt', m.updated_at,
                       'expiresAt', m.expires_at)
                   ORDER BY m.created_at, m.id)
              FROM public.memories m WHERE m.user_id = p_subject), '[]'::jsonb),
        'understanding', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'statement', h.statement,
                       'status', CASE WHEN h.status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK') THEN 'current'
                                      WHEN h.status = 'REOPENED' THEN 'being reconsidered'
                                      ELSE 'withdrawn' END,
                       'firstFormedAt', h.created_at,
                       'lastChangedAt', h.updated_at,
                       'yourDisagreements', coalesce((
                           SELECT jsonb_agg(c.created_at ORDER BY c.created_at)
                             FROM public.understanding_contests c
                            WHERE c.hypothesis_id = h.id AND c.user_id = p_subject), '[]'::jsonb))
                   ORDER BY h.created_at, h.id)
              FROM public.hypotheses h
             WHERE h.user_id = p_subject
               -- Only an interpretation the owner could have been shown: current now (the statuses the Understanding
               -- surface lists), or current at some point before it was reconsidered or withdrawn. A CANDIDATE, or one
               -- withdrawn before it was ever admitted, is QANDEEL's own unshown reasoning (hypothesis restraint).
               AND (h.status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK')
                    OR (h.status IN ('REOPENED', 'REJECTED', 'RETIRED')
                        AND EXISTS (SELECT 1 FROM public.hypothesis_lifecycle_transitions t
                                     WHERE t.hypothesis_id = h.id AND t.user_id = p_subject
                                       AND t.after_status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK'))))), '[]'::jsonb),
        -- IP-IMP-01 (0153): the owner's four durable interaction preferences, in readable words. No row: all automatic.
        'interactionPreferences', (
            SELECT jsonb_build_object(
                       'replyLength', CASE coalesce(p.reply_length, 'DEFAULT') WHEN 'ALWAYS_BRIEF' THEN 'always brief' ELSE 'automatic' END,
                       'replyLanguage', CASE coalesce(p.reply_language, 'DEFAULT')
                                            WHEN 'EGYPTIAN_ARABIC' THEN 'Egyptian Arabic'
                                            WHEN 'MODERN_STANDARD_ARABIC' THEN 'Modern Standard Arabic'
                                            WHEN 'LEVANTINE_ARABIC' THEN 'Levantine Arabic'
                                            WHEN 'GULF_ARABIC' THEN 'Gulf Arabic'
                                            WHEN 'MAGHREBI_ARABIC' THEN 'Maghrebi Arabic'
                                            WHEN 'ENGLISH' THEN 'English'
                                            ELSE 'automatic' END,
                       'humour', CASE coalesce(p.humour, 'DEFAULT') WHEN 'WELCOME' THEN 'welcome' WHEN 'DECLINED' THEN 'no humour' ELSE 'automatic' END,
                       'explanationStyle', CASE coalesce(p.explanation_style, 'DEFAULT')
                                               WHEN 'SIMPLER' THEN 'simpler'
                                               WHEN 'DIRECT' THEN 'direct'
                                               WHEN 'SIMPLER_AND_DIRECT' THEN 'simple and direct'
                                               ELSE 'automatic' END,
                       'lastChangedAt', p.updated_at)
              FROM (SELECT 1) AS one LEFT JOIN public.interaction_preferences p ON p.user_id = p_subject),
        -- S6-07 (0168): the reader's OWN Matching and Introductions data, in readable words (QAN-BL-PRIV-04, CA-EXP).
        -- Every sub-select is keyed on p_subject as owner, author, actor or bound recipient. Nothing names, quotes or
        -- describes another human; no internal identifier, digest, score, reason, role or proposal state is printed; a
        -- proposal appears only once it was delivered to the reader, and never with the instant it arrived (Q9).
        'matchingAndIntroductions', jsonb_build_object(
            'preparation', jsonb_build_object(
                'draft', (
                    SELECT jsonb_build_object(
                               'shortIntroduction', d.short_introduction,
                               'workField', lower(replace(d.work_field, '_', ' ')),
                               'requirements', jsonb_build_object('answer', lower(replace(d.hard_answer, '_', ' ')), 'items', d.hard_items),
                               'preferences', jsonb_build_object('answer', lower(replace(d.soft_answer, '_', ' ')), 'items', d.soft_items),
                               'skippedSteps', (SELECT coalesce(jsonb_agg(lower(replace(s.step, '_', ' ')) ORDER BY s.step), '[]'::jsonb)
                                                  FROM unnest(d.skipped_steps) AS s(step)),
                               'reviewedAt', d.reviewed_at,
                               'startedAt', d.created_at,
                               'lastChangedAt', d.updated_at)
                      FROM introductions_preparation_private.drafts d WHERE d.user_id = p_subject),
                'declaredFacts', (
                    SELECT jsonb_build_object(
                               'firstName', CASE WHEN f.first_name IS NULL THEN NULL ELSE jsonb_build_object(
                                   'value', f.first_name, 'state', lower(f.first_name_state), 'confirmedAt', f.first_name_confirmed_at) END,
                               'sex', CASE WHEN f.sex IS NULL THEN NULL ELSE jsonb_build_object(
                                   'value', lower(f.sex), 'state', lower(f.sex_state), 'confirmedAt', f.sex_confirmed_at) END,
                               'birth', CASE WHEN f.birth_year IS NULL THEN NULL ELSE jsonb_build_object(
                                   'year', f.birth_year, 'month', f.birth_month, 'state', lower(f.birth_state), 'confirmedAt', f.birth_confirmed_at) END,
                               'area', CASE WHEN f.country_code IS NULL THEN NULL ELSE jsonb_build_object(
                                   'country', f.country_code, 'region', f.region_code, 'state', lower(f.area_state), 'confirmedAt', f.area_confirmed_at) END,
                               'maritalStatus', CASE WHEN f.marital_status IS NULL THEN NULL ELSE jsonb_build_object(
                                   'value', lower(replace(f.marital_status, '_', ' ')), 'state', lower(f.marital_state), 'confirmedAt', f.marital_confirmed_at) END)
                      FROM introductions_preparation_private.declared_facts f WHERE f.user_id = p_subject),
                'notes', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'kind', lower(replace(n.kind, '_', ' ')),
                               'origin', CASE n.origin WHEN 'USER_AUTHORED' THEN 'written by you'
                                                       WHEN 'CONFIRMED_FROM_PRIOR_UNDERSTANDING' THEN 'confirmed by you'
                                                       ELSE 'corrected by you' END,
                               'text', n.body,
                               'writtenAt', n.created_at)
                           ORDER BY n.created_at, n.id)
                      FROM introductions_preparation_private.notes n WHERE n.user_id = p_subject), '[]'::jsonb),
                'earlierUnderstandingDecisions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object('decision', lower(replace(p.decision, '_', ' ')), 'decidedAt', p.decided_at)
                           ORDER BY p.decided_at, p.memory_id)
                      FROM introductions_preparation_private.prior_understanding_decisions p WHERE p.user_id = p_subject), '[]'::jsonb),
                'assistanceConsents', coalesce((
                    SELECT jsonb_agg(jsonb_build_object('version', c.consent_version, 'givenAt', c.granted_at, 'withdrawnAt', c.revoked_at)
                           ORDER BY c.granted_at, c.id)
                      FROM introductions_preparation_private.assistance_consents c WHERE c.user_id = p_subject), '[]'::jsonb)),
            'enrollment', jsonb_build_object(
                'acts', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'act', CASE a.act_kind WHEN 'ENROLL' THEN 'enrolled' WHEN 'CORRECTION' THEN 'corrected'
                                                      WHEN 'RESUME' THEN 'resumed' ELSE 'consent given again' END,
                               'at', a.committed_at,
                               'reviewedDraftVersion', a.draft_version,
                               'consentVersions', jsonb_build_object(
                                   'participation', a.participation_consent_version,
                                   'contextGrant', a.context_consent_version,
                                   'disclosureAuthority', a.disclosure_consent_version))
                           ORDER BY a.committed_at, a.command_id)
                      FROM matching_enrollment_private.enrollment_acts a WHERE a.user_id = p_subject), '[]'::jsonb),
                'participation', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'act', lower(replace(e.participation_act, '_', ' ')),
                               'state', lower(e.resulting_state),
                               'pauseReason', lower(replace(e.resulting_pause_reason, '_', ' ')),
                               'entry', lower(replace(e.activation_entry_channel, '_', ' ')),
                               'at', e.occurred_at)
                           ORDER BY e.occurred_at, e.id)
                      FROM public.matching_participation_events e WHERE e.participant_user_id = p_subject), '[]'::jsonb),
                'contextGrant', coalesce((
                    SELECT jsonb_agg(jsonb_build_object('event', lower(e.event_type), 'at', e.occurred_at) ORDER BY e.occurred_at, e.id)
                      FROM public.matching_context_consent_events e WHERE e.grantor_user_id = p_subject), '[]'::jsonb),
                'disclosureAuthority', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'event', lower(e.event_type),
                               'at', e.occurred_at,
                               'approvedFields', CASE WHEN e.event_type = 'REVOKED' THEN NULL ELSE coalesce((
                                   SELECT jsonb_agg(lower(replace(af.field_key, '_', ' ')) ORDER BY af.field_key)
                                     FROM public.pre_match_disclosure_authority_fields af
                                    WHERE af.authority_id = e.subject_authority_id), '[]'::jsonb) END)
                           ORDER BY e.occurred_at, e.id)
                      FROM public.pre_match_disclosure_authority_events e WHERE e.grantor_user_id = p_subject), '[]'::jsonb),
                'introductionProfileVersions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'createdAt', v.created_at,
                               'fields', coalesce((
                                   SELECT jsonb_agg(jsonb_build_object('field', lower(replace(fv.field_key, '_', ' ')), 'value', fv.field_value)
                                          ORDER BY fv.field_key)
                                     FROM public.introduction_profile_field_values fv WHERE fv.profile_version_id = v.id), '[]'::jsonb))
                           ORDER BY v.created_at, v.id)
                      FROM public.introduction_profile_versions v WHERE v.owner_user_id = p_subject), '[]'::jsonb),
                'requirementVersions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'createdAt', v.created_at,
                               'items', coalesce((
                                   SELECT jsonb_agg(jsonb_build_object(
                                              'requirement', lower(replace(i.requirement_key, '_', ' ')),
                                              'strength', CASE i.requirement_strength WHEN 'HARD_DEALBREAKER' THEN 'required' ELSE 'preferred' END,
                                              'value', i.requirement_value)
                                          ORDER BY i.requirement_strength, i.requirement_key)
                                     FROM public.matching_requirement_items i WHERE i.requirement_version_id = v.id), '[]'::jsonb))
                           ORDER BY v.created_at, v.id)
                      FROM public.matching_requirement_versions v WHERE v.owner_user_id = p_subject), '[]'::jsonb)),
            'confirmedFacts', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'firstName', f.first_name,
                           'sex', lower(f.sex),
                           'birthYear', f.birth_year,
                           'birthMonth', f.birth_month,
                           'country', f.country_code,
                           'region', f.region_code,
                           'maritalStatus', lower(replace(f.marital_status, '_', ' ')),
                           'confirmedAt', jsonb_build_object(
                               'firstName', f.first_name_confirmed_at, 'sex', f.sex_confirmed_at, 'birth', f.birth_confirmed_at,
                               'area', f.area_confirmed_at, 'maritalStatus', f.marital_confirmed_at),
                           'recordedAt', f.recorded_at)
                       ORDER BY f.recorded_at, f.id)
                  FROM public.matching_confirmed_fact_versions f WHERE f.owner_user_id = p_subject), '[]'::jsonb),
            -- A proposal only once it was DELIVERED to the reader (CW2-06 §53): the one neutral word their own proposal
            -- screen shows (resolve_my_matching_proposal_presentation_v1's mapping, a live one past its deadline or no
            -- longer valid included) and the reader's own decisions. Never the other human, a conclusion, a role, a
            -- state, a reason, a deadline or when it arrived.
            'proposals', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'outcome', (
                               SELECT CASE CASE WHEN n.neutral_outcome NOT IN ('AWAITING_YOU', 'IN_PROGRESS') THEN n.neutral_outcome
                                                WHEN p.expires_at <= clock_timestamp() THEN 'NO_LONGER_AVAILABLE'
                                                WHEN (SELECT v.still_valid FROM public.resolve_matching_proposal_validity_v1(p.id) v) IS NOT TRUE
                                                  THEN 'NO_LONGER_AVAILABLE'
                                                ELSE n.neutral_outcome END
                                        WHEN 'AWAITING_YOU' THEN 'awaiting you'
                                        WHEN 'IN_PROGRESS' THEN 'in progress'
                                        WHEN 'CLOSED_BY_YOU' THEN 'closed by you'
                                        WHEN 'MATCH_CONCLUDED' THEN 'matched'
                                        ELSE 'no longer available' END
                                 FROM public.matching_proposals p
                                 CROSS JOIN LATERAL public.resolve_matching_proposal_neutral_outcome_v1(p.id, p_subject) n
                                WHERE p.id = x.proposal_id),
                           'yourDecisions', coalesce((
                               SELECT jsonb_agg(jsonb_build_object('decision', own.decision, 'at', own.at) ORDER BY own.at, own.decision)
                                 FROM (SELECT 'approved'::text AS decision, fa.bound_at AS at
                                         FROM public.matching_forward_approval_view_bindings fa
                                        WHERE fa.proposal_id = x.proposal_id AND fa.approver_user_id = p_subject
                                       UNION ALL
                                       SELECT CASE db.decision_state WHEN 'WITHDRAWN' THEN 'withdrawn' ELSE 'declined' END, db.bound_at
                                         FROM public.matching_proposal_decision_view_bindings db
                                        WHERE db.proposal_id = x.proposal_id AND db.decider_user_id = p_subject
                                       UNION ALL
                                       SELECT 'accepted', mc.committed_at
                                         FROM public.matching_match_commits mc
                                        WHERE mc.proposal_id = x.proposal_id AND mc.candidate_user_id = p_subject) own), '[]'::jsonb))
                       ORDER BY x.first_delivered, x.proposal_id)
                  FROM (SELECT b.proposal_id, min(b.bound_at) AS first_delivered
                          FROM public.matching_proposal_delivery_view_bindings b
                         WHERE b.recipient_user_id = p_subject
                         GROUP BY b.proposal_id) x), '[]'::jsonb),
            -- Each Introduction the reader is one of the two humans of: what the reader themselves wrote, shared and
            -- decided in it - never the other human's words, shares, photo or name, and never who ended it when the
            -- reader did not. Messages are the Introduction era only (after a valid SUCCESS the World is a Shared World,
            -- whose export is QAN-BL-PRIV-05's). A message, share or stage its owner deleted has no body and is absent.
            'introductions', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'startedAt', r.started_at,
                           'state', CASE r.introduction_status WHEN 'ACTIVE' THEN 'active'
                                                               WHEN 'COMPLETED' THEN 'continued as a shared world'
                                                               ELSE 'ended' END,
                           'endedAt', CASE WHEN r.introduction_status = 'CLOSED' THEN r.ended_at END,
                           'endedByYou', CASE WHEN r.introduction_status = 'CLOSED' THEN EXISTS (
                               SELECT 1 FROM public.introduction_ended_events e
                                WHERE e.introduction_record_id = r.id AND e.actor_user_id = p_subject) END,
                           'continuedAt', CASE WHEN r.introduction_status = 'COMPLETED' THEN r.ended_at END,
                           'yourMessages', coalesce((
                               SELECT jsonb_agg(jsonb_build_object('text', b.body_text, 'at', m.established_at) ORDER BY m.established_at, m.id)
                                 FROM public.shared_world_materials m
                                 JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
                                WHERE m.world_id = r.world_id AND m.author_user_id = p_subject AND m.material_kind = 'HUMAN_TEXT'
                                  AND shared_private.is_introduction_era_history_item_v1(m.world_id, m.history_item_id)), '[]'::jsonb),
                           'yourShares', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'kind', lower(replace(v.resource_type, '_', ' ')),
                                          'field', lower(replace(t.field_key, '_', ' ')),
                                          'text', t.text_value,
                                          'sharedAt', v.established_at)
                                      ORDER BY v.established_at, v.id)
                                 FROM public.introduction_disclosure_resource_versions v
                                 JOIN public.introduction_disclosure_text_payloads t ON t.resource_version_id = v.id
                                WHERE v.introduction_record_id = r.id AND v.world_id = r.world_id AND v.owner_user_id = p_subject), '[]'::jsonb),
                           -- The reader's own photo: its state and the derived renditions that still exist (the upload itself
                           -- is never stored), each stage shared or not; the files themselves travel beside the package.
                           'yourPhotos', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'state', CASE WHEN s.series_state IN ('READY', 'DISCLOSING') THEN 'live'
                                                        WHEN EXISTS (SELECT 1 FROM introduction_sharing_private.image_renditions kept
                                                                      WHERE kept.series_id = s.id) THEN 'shared'
                                                        ELSE 'removed' END,
                                          'stages', coalesce((
                                              SELECT jsonb_agg(jsonb_build_object('stage', rr.stage, 'shared', vis.at IS NOT NULL, 'sharedAt', vis.at)
                                                     ORDER BY rr.stage)
                                                FROM introduction_sharing_private.image_renditions rr
                                                LEFT JOIN LATERAL (
                                                    SELECT dv.established_at AS at
                                                      FROM introduction_sharing_private.image_stage_disclosures sd
                                                      JOIN public.introduction_disclosure_media_payloads mp ON mp.resource_version_id = sd.resource_version_id
                                                      JOIN public.introduction_disclosure_resource_versions dv ON dv.id = sd.resource_version_id
                                                     WHERE sd.series_id = rr.series_id AND sd.stage = rr.stage) vis ON true
                                               WHERE rr.series_id = s.id), '[]'::jsonb))
                                      ORDER BY (s.series_state IN ('READY', 'DISCLOSING')), s.id)
                                 FROM introduction_sharing_private.image_series s
                                WHERE s.introduction_record_id = r.id AND s.world_id = r.world_id AND s.owner_user_id = p_subject
                                  AND s.series_state <> 'PENDING'), '[]'::jsonb),
                           'yourNameDisplay', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'act', CASE e.display_act WHEN 'GRANT' THEN 'full name shown' ELSE 'first name shown again' END,
                                          'at', e.occurred_at)
                                      ORDER BY e.occurred_at, e.id)
                                 FROM introduction_sharing_private.name_display_events e
                                WHERE e.world_id = r.world_id AND e.owner_user_id = p_subject), '[]'::jsonb),
                           'yourContinuationApprovals', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'act', CASE e.approval_act WHEN 'APPROVE' THEN 'approved' ELSE 'approval withdrawn' END,
                                          'at', e.occurred_at)
                                      ORDER BY e.occurred_at, e.id)
                                 FROM public.introduction_success_approval_events e
                                 JOIN public.introduction_success_transition_versions tv ON tv.id = e.transition_version_id
                                WHERE tv.introduction_record_id = r.id AND e.approver_user_id = p_subject), '[]'::jsonb))
                       ORDER BY r.started_at, r.world_id)
                  FROM public.introduction_records r WHERE p_subject IN (r.lower_user_id, r.higher_user_id)), '[]'::jsonb),
            -- An ended Introduction whose other human erased their account: the reader's own words they keep (0164).
            'keptIntroductions', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'startedAt', w.born_at,
                           'state', 'ended',
                           'keptAt', rv.retained_at,
                           'yourMessages', coalesce((
                               SELECT jsonb_agg(jsonb_build_object('text', b.body_text, 'at', m.established_at) ORDER BY m.established_at, m.id)
                                 FROM public.introduction_retained_view_items it
                                 JOIN public.shared_world_materials m ON m.history_item_id = it.history_item_id AND m.world_id = it.world_id
                                 JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
                                WHERE it.world_id = rv.world_id AND it.user_id = p_subject
                                  AND m.author_user_id = p_subject AND m.material_kind = 'HUMAN_TEXT'), '[]'::jsonb))
                       ORDER BY w.born_at, rv.world_id)
                  FROM public.introduction_retained_views rv
                  JOIN public.shared_worlds w ON w.id = rv.world_id
                 WHERE rv.user_id = p_subject), '[]'::jsonb),
            'resumedAfterIntroductions', coalesce((
                SELECT jsonb_agg(jsonb_build_object('act', own.act, 'at', own.at) ORDER BY own.at, own.act)
                  FROM (SELECT lower(c.reactivation_act) AS act, c.committed_at AS at
                          FROM public.matching_introduction_reactivation_commands c WHERE c.participant_user_id = p_subject
                        UNION ALL
                        SELECT lower(c.reactivation_act), c.committed_at
                          FROM public.matching_counterpart_erasure_reactivation_commands c WHERE c.participant_user_id = p_subject
                        UNION ALL
                        SELECT 'free to resume', rl.released_at
                          FROM public.matching_counterpart_erasure_releases rl WHERE rl.participant_user_id = p_subject) own), '[]'::jsonb)),
        -- S8A-05 (0179): the reader's OWN private Public topic drafts, as written (title, text, section key). A draft
        -- prepared as a topic says so; nothing of the Public copy, its identity or its review is printed here.
        'publicTopicDrafts', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'title', d.title,
                       'text', d.body,
                       'section', d.section_key,
                       'state', CASE WHEN d.prepared_experience_id IS NULL THEN 'editing' ELSE 'prepared for publication' END,
                       'createdAt', d.created_at,
                       'lastChangedAt', d.updated_at)
                   ORDER BY d.created_at, d.id)
              FROM public_compose_private.topic_drafts d WHERE d.user_id = p_subject), '[]'::jsonb),
        'notYetIncluded', jsonb_build_array('shared', 'public', 'replay'));
$$;

ALTER FUNCTION personal_data_private.build_personal_export_v1(uuid) OWNER TO postgres;
-- CREATE OR REPLACE keeps the ACL; it is revoked again explicitly so no default privilege can ever reach the builder.
REVOKE ALL ON FUNCTION personal_data_private.build_personal_export_v1(uuid) FROM PUBLIC;
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION personal_data_private.build_personal_export_v1(uuid) FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION personal_data_private.build_personal_export_v1(uuid) FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION personal_data_private.build_personal_export_v1(uuid) FROM service_role; END IF;
END$$;

-- =====================================================================================================================
-- H. PRIVILEGES. Ownership; default-deny by name; then the exact grants. Nothing relies on a default (0133).
-- =====================================================================================================================
DO $$
DECLARE
  v_fn text;
  v_rel text;
  v_commands text[] := ARRAY[
    'public_compose_private.list_own_topic_drafts_v1()',
    'public_compose_private.read_own_topic_draft_v1(uuid)',
    'public_compose_private.save_own_topic_draft_v1(uuid, bigint, text, text, text)',
    'public_compose_private.delete_own_topic_draft_v1(uuid, uuid)',
    'public_compose_private.preview_own_topic_draft_v1(uuid)',
    'public_compose_private.freeze_own_topic_draft_v1(uuid, uuid, bigint)',
    'public_compose_private.discard_own_unpublished_topic_v1(uuid, uuid)',
    'public_compose_private.set_own_topic_section_v1(uuid, uuid, text)',
    'public_compose_private.read_public_topic_headers_v1(uuid[])',
    'public_compose_private.read_public_topic_title_matches_v1(text)',
    'public_compose_private.read_public_section_topic_matches_v1(text, text)',
    'public.list_own_topic_drafts_v1()',
    'public.read_own_topic_draft_v1(uuid)',
    'public.save_own_topic_draft_v1(uuid, bigint, text, text, text)',
    'public.delete_own_topic_draft_v1(uuid, uuid)',
    'public.preview_own_topic_draft_v1(uuid)',
    'public.freeze_own_topic_draft_v1(uuid, uuid, bigint)',
    'public.discard_own_unpublished_topic_v1(uuid, uuid)',
    'public.set_own_topic_section_v1(uuid, uuid, text)',
    'public.read_public_topic_headers_v1(uuid[])',
    'public.read_public_topic_title_matches_v1(text)',
    'public.read_public_section_topic_matches_v1(text, text)'];
  v_internal text[] := ARRAY[
    'public.discard_never_published_public_experience_v1(uuid, uuid)',
    'public_compose_private.reject_compose_history_mutation_v1()',
    'public_compose_private.resolve_topic_freeze_clearance_v1()',
    'public_compose_private.derive_compose_identity_v1(text, uuid, uuid)',
    'public_compose_private.account_deletion_pending_v1(uuid)',
    'public_compose_private.public_form_v1(text)',
    'public_compose_private.draft_readiness_v1(text, text, text)',
    'public_compose_private.privacy_notes_v1(text, text, text)',
    'public_compose_private.prepare_authored_package_v1(uuid, uuid, uuid, uuid, uuid, text)'];
BEGIN
  FOREACH v_fn IN ARRAY v_commands || v_internal LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', v_fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', v_fn);
    END IF;
  END LOOP;
  -- derive_public_publication_authority_v1 keeps the 0093 / 0105 ACL (CREATE OR REPLACE preserves it).
  FOREACH v_rel IN ARRAY ARRAY['public_compose_private.sections', 'public_compose_private.topic_drafts',
    'public_compose_private.discard_commands', 'public_compose_private.version_titles',
    'public_compose_private.experience_sections', 'public_compose_private.experience_section_events'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', v_rel);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_rel);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', v_rel);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM service_role', v_rel);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    -- The server channel holds nothing here: every act is the human's own, under the human's own token.
    EXECUTE 'REVOKE ALL ON SCHEMA public_compose_private FROM service_role';
  END IF;
  EXECUTE 'GRANT USAGE ON SCHEMA public_compose_private TO authenticated';
  FOREACH v_fn IN ARRAY v_commands LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_fn);
  END LOOP;
END$$;

-- =====================================================================================================================
-- I. DEPLOY-TIME SELF-ASSERTIONS: the boundary is what this file says, or the migration fails.
-- =====================================================================================================================
DO $$
DECLARE
  v_writers integer;
  p record;
BEGIN
  -- I1. THE FREEZE IS CLOSED: the clearance seam answers NOT_EVALUATED.
  IF public_compose_private.resolve_topic_freeze_clearance_v1() IS DISTINCT FROM 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'S8A-05: the topic freeze clearance seam must answer NOT_EVALUATED';
  END IF;
  -- I2. QAN-CW-REM-03, re-counted: exactly FIVE functions move a Public Experience lifecycle (0121's four and the
  --     never-published discard), and every one writes the immutable lifecycle event.
  SELECT count(*)::integer INTO v_writers
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
     AND (pr.prosrc ~ 'UPDATE public\.public_experiences e\s+SET current_lifecycle = '''
       OR pr.prosrc ~ 'INSERT INTO public\.public_experiences\s+\(id, public_world_singleton');
  IF v_writers <> 5 THEN
    RAISE EXCEPTION 'S8A-05: exactly five functions may move a Public Experience lifecycle, found %', v_writers;
  END IF;
  FOR p IN SELECT pr.* FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
              AND (pr.prosrc ~ 'UPDATE public\.public_experiences e\s+SET current_lifecycle = '''
                OR pr.prosrc ~ 'INSERT INTO public\.public_experiences\s+\(id, public_world_singleton') LOOP
    IF p.prosrc !~ 'INSERT INTO public\.public_experience_lifecycle_events' THEN
      RAISE EXCEPTION 'S8A-05: % moves a Public Experience lifecycle without writing the immutable event', p.proname;
    END IF;
  END LOOP;
  -- I3. Nothing S8A-05 owns reaches publication, the CW2-08 seam or placement.
  FOR p IN SELECT n.nspname || '.' || pr.proname AS fn, pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public_compose_private'
               OR (n.nspname = 'public' AND pr.proname = 'discard_never_published_public_experience_v1') LOOP
    IF p.prosrc ~ '(publish_public_experience_v1|resolve_public_publication_prerequisites_v1|commit_public_spatial_placement_v1|request_own_public_spatial_placement_v1|request_own_public_semantic_proposal_v1|''PUBLISHED'')' THEN
      RAISE EXCEPTION 'S8A-05: % reaches publication, the CW2-08 seam or placement', p.fn;
    END IF;
  END LOOP;
  -- I4. No application role executes the discard primitive or any internal helper; no frozen primitive is widened.
  FOR p IN SELECT unnest(ARRAY['public.discard_never_published_public_experience_v1(uuid, uuid)',
                                'public_compose_private.resolve_topic_freeze_clearance_v1()',
                                'public_compose_private.prepare_authored_package_v1(uuid, uuid, uuid, uuid, uuid, text)',
                                'public.create_public_experience_draft_v1(uuid, uuid)',
                                'public.prepare_public_experience_manifest_v1(uuid, uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], uuid[])',
                                'public.publish_public_experience_v1(uuid, uuid, uuid)']) AS fn LOOP
    IF has_function_privilege('public', p.fn, 'EXECUTE')
       OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND has_function_privilege('anon', p.fn, 'EXECUTE'))
       OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AND has_function_privilege('authenticated', p.fn, 'EXECUTE'))
       OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AND has_function_privilege('service_role', p.fn, 'EXECUTE')) THEN
      RAISE EXCEPTION 'S8A-05: an application role executes %', p.fn;
    END IF;
  END LOOP;
END$$;

COMMIT;
