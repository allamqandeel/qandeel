-- S8A-05 CP2 - Public World: «Publish from QANDEEL» (a topic from the author's own Personal conversation and from a
-- QANDEEL Understanding item they are shown).
--
-- Product authority: the Product Owner's S8A-05 CP2 order (2026-10-27), which applies the WP1 design with its WP1-R1
-- corrections; the S8A-05 CP2 controlled amendment (docs/canonical-authority/connected-worlds-v2/architecture/
-- QANDEEL_S8A-05_PUBLISH_FROM_QANDEEL_CONTROLLED_AMENDMENT_v1.0.md): CA-S8A05-A3 (personal analytical material in a
-- Public package, WP1-R1 §6.3 verbatim) and the CP2 narrowing of A-2(c) (a never-published topic is discarded whatever
-- its item classes). The implementation record is
-- docs/e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md (§11 onward).
--
-- ## What is added
--
--   1. A draft SOURCE SPECIFICATION on the CP1 private draft (references only, never text):
--        CONVERSATION   {session, first SP, last SP, include QANDEEL, excluded messages, emphasized messages}
--        UNDERSTANDING  {the Understanding item, the exact version the author was shown}
--      and the author's acknowledgement of QANDEEL material, bound to one draft revision. The client never supplies a
--      text, a speaker, an order or an owner: every one is re-derived here from the canonical rows, at preview and again
--      at freeze, through replay_private.resolve_personal_range_v1 (0169) for the conversation.
--   2. Schema public_compose_source_private (not exposed through the Data API; RLS on, no policy, postgres-owned):
--        item_presentation      the SEALED display order of a sourced package: one row per item, its display position,
--                               its role (written / your message / QANDEEL reply / QANDEEL understanding), its true
--                               Session Position, its message, its emphasis and whether a gap precedes it. No text.
--        version_search_documents  ONE bounded search document per sourced version (title + written text + emphasized
--                               messages, ≤ 8 KB), so search never aggregates every body of a long topic.
--      and the commands: set / clear the source, acknowledge, the paged items of my draft (dry-run before freeze, the
--      sealed package after it - one projection), the paged items of a served topic.
--   3. The freeze (0179 D.7) forward-replaced: a draft with a source freezes into ONE package of one item per whole
--      committed unit (A-3: the author's messages SOURCE_CONTENT_BEARING, QANDEEL's replies and the Understanding summary
--      ANALYTICAL_DERIVATIVE, the author the sole approver), the author's own written text (if any) as the first,
--      PUBLIC_AUTHORED item, with the display order sealed in the same transaction. Atomic: everything or nothing.
--      A selection above the PROCESSING ENVELOPE (10,000 units or 8 MB of text) is refused before any write; nothing is
--      ever cut or dropped silently. The freeze stays CLOSED in production (the 0179 seam is unchanged).
--   4. The fifth lifecycle mover, the package guard and the I-05A authority derivation forward-replaced: a never-
--      published topic is discarded whatever its item classes (MY_WORLD and SHARED_WORLD items too; a Replay artifact
--      stays REPLAY-DIST-01's), erasing every body, both digests, the personal source pointers, the title and the
--      search document; an Understanding item's source is its own sealed body.
--   5. Bounded inputs for later checkpoints, executable by no application role: the interpreter input (24 KB, CP3) and
--      the @qandeel topic context (6 KB, CP4). Nothing here calls a model.
--   6. Search (0145 E.2 and 0179 E.3) forward-replaced to read a sourced version's bounded document instead of
--      aggregating its bodies; every other version is searched exactly as before.
--   7. Export My Data (0179 body re-stated) prints each draft's source REFERENCE (never a copied text).
--
-- ## What is deliberately NOT here
--
--   * No publication, placement, semantic request, discussion or model call; the CW2-08 seam is untouched.
--   * No Shared World QANDEEL output (QAN-BL-CW-05), no Replay (REPLAY-DIST-01), no voice (Stage 8B).
--   * No edit of a published topic (CP4).
--
-- Forward-only. Migrations 0001-0179 are byte-unchanged.
BEGIN;

CREATE SCHEMA public_compose_source_private;
ALTER SCHEMA public_compose_source_private OWNER TO postgres;
REVOKE ALL ON SCHEMA public_compose_source_private FROM PUBLIC;

-- =====================================================================================================================
-- A. RELATIONS.
-- =====================================================================================================================

-- A.1 The source specification, on the draft itself: it is the author's private draft, cascades with it and with the
--     account, and holds references only. Every SP list names whole messages by their FIRST Session Position.
ALTER TABLE public_compose_private.topic_drafts
  ADD COLUMN source_kind text,
  ADD COLUMN source_session_id uuid,
  ADD COLUMN source_first_sp integer,
  ADD COLUMN source_last_sp integer,
  ADD COLUMN source_include_qandeel boolean,
  ADD COLUMN source_excluded_sps integer[],
  ADD COLUMN source_emphasized_sps integer[],
  ADD COLUMN source_hypothesis_id uuid,
  ADD COLUMN source_hypothesis_version integer,
  ADD COLUMN source_acknowledged_revision bigint,
  ADD CONSTRAINT topic_drafts_source_check CHECK (
    (source_kind IS NULL
       AND source_session_id IS NULL AND source_first_sp IS NULL AND source_last_sp IS NULL
       AND source_include_qandeel IS NULL AND source_excluded_sps IS NULL AND source_emphasized_sps IS NULL
       AND source_hypothesis_id IS NULL AND source_hypothesis_version IS NULL AND source_acknowledged_revision IS NULL)
    OR (source_kind = 'CONVERSATION'
       AND source_session_id IS NOT NULL AND source_first_sp >= 1 AND source_last_sp >= source_first_sp
       AND source_include_qandeel IS NOT NULL
       AND source_excluded_sps IS NOT NULL AND cardinality(source_excluded_sps) <= 10000
       AND array_position(source_excluded_sps, NULL) IS NULL
       AND source_emphasized_sps IS NOT NULL AND cardinality(source_emphasized_sps) <= 10000
       AND array_position(source_emphasized_sps, NULL) IS NULL
       AND source_hypothesis_id IS NULL AND source_hypothesis_version IS NULL)
    OR (source_kind = 'UNDERSTANDING'
       AND source_session_id IS NULL AND source_first_sp IS NULL AND source_last_sp IS NULL
       AND source_include_qandeel IS NULL AND source_excluded_sps IS NULL AND source_emphasized_sps IS NULL
       AND source_hypothesis_id IS NOT NULL AND source_hypothesis_version >= 1));

-- A.2 The sealed presentation of a sourced package (R1 §5.3 item 4): display order, role, true Session Position,
--     message, emphasis and the honest gap. Immutable; no text, no source identifier.
CREATE TABLE public_compose_source_private.item_presentation (
  manifest_version_id uuid NOT NULL,
  package_item_id uuid NOT NULL,
  display_position integer NOT NULL,
  item_role text NOT NULL,
  source_session_position integer,
  message_ordinal integer,
  emphasized boolean NOT NULL,
  gap_before boolean NOT NULL,
  CONSTRAINT item_presentation_pk PRIMARY KEY (manifest_version_id, display_position),
  CONSTRAINT item_presentation_item_key UNIQUE (package_item_id),
  CONSTRAINT item_presentation_item_fk FOREIGN KEY (manifest_version_id, package_item_id)
    REFERENCES public.publication_package_manifest_items (manifest_version_id, package_item_id) ON DELETE RESTRICT,
  CONSTRAINT item_presentation_position_check CHECK (display_position >= 1),
  CONSTRAINT item_presentation_role_check CHECK (
    (item_role = 'WRITTEN' AND source_session_position IS NULL AND message_ordinal IS NULL AND NOT emphasized AND NOT gap_before)
    OR (item_role = 'QANDEEL_UNDERSTANDING' AND source_session_position IS NULL AND message_ordinal IS NULL
        AND NOT emphasized AND NOT gap_before)
    OR (item_role IN ('YOUR_MESSAGE', 'QANDEEL_REPLY') AND source_session_position >= 1 AND message_ordinal >= 1))
);

-- A.3 One bounded search document per sourced version (R1 §5.3 item 9). Erasable one-way, by the never-published
--     discard of its Experience, at that instant.
CREATE TABLE public_compose_source_private.version_search_documents (
  experience_version_id uuid NOT NULL,
  experience_id uuid NOT NULL,
  document text,
  document_erased_at timestamptz,
  CONSTRAINT version_search_documents_pk PRIMARY KEY (experience_version_id),
  CONSTRAINT version_search_documents_version_fk FOREIGN KEY (experience_version_id, experience_id)
    REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
  CONSTRAINT version_search_documents_shape_check CHECK (
    (document IS NOT NULL AND document_erased_at IS NULL AND octet_length(document) <= 8192)
    OR (document IS NULL AND document_erased_at IS NOT NULL))
);
CREATE INDEX version_search_documents_experience_idx ON public_compose_source_private.version_search_documents (experience_id);

-- A.4 History is history. The presentation is sealed (statement-level, so a long package is not taxed per row); a
--     search document changes exactly once, to erased, at the instant a never-published discard of its Experience proves.
CREATE FUNCTION public_compose_source_private.reject_presentation_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'PUBLIC_COMPOSE_HISTORY_IS_IMMUTABLE'
    USING ERRCODE = '55000', DETAIL = 'A sealed presentation is immutable: UPDATE, DELETE and TRUNCATE are refused.';
END$$;
CREATE TRIGGER item_presentation_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON public_compose_source_private.item_presentation
  FOR EACH STATEMENT EXECUTE FUNCTION public_compose_source_private.reject_presentation_mutation_v1();

CREATE FUNCTION public_compose_source_private.reject_search_document_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.document_erased_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.document IS NOT NULL AND NEW.document IS NULL AND OLD.document_erased_at IS NULL
     AND NEW.document_erased_at IS NOT NULL AND NEW.experience_version_id = OLD.experience_version_id
     AND NEW.experience_id = OLD.experience_id
     AND EXISTS (SELECT 1 FROM public_compose_private.discard_commands d
                  WHERE d.experience_id = OLD.experience_id AND d.occurred_at = NEW.document_erased_at) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'PUBLIC_COMPOSE_HISTORY_IS_IMMUTABLE'
    USING ERRCODE = '55000',
          DETAIL = 'A search document is erased exactly once, by the never-published discard of its Experience, at that instant.';
END$$;
CREATE TRIGGER version_search_documents_immutable BEFORE INSERT OR UPDATE OR DELETE
  ON public_compose_source_private.version_search_documents
  FOR EACH ROW EXECUTE FUNCTION public_compose_source_private.reject_search_document_mutation_v1();
CREATE TRIGGER version_search_documents_no_truncate BEFORE TRUNCATE
  ON public_compose_source_private.version_search_documents
  FOR EACH STATEMENT EXECUTE FUNCTION public_compose_source_private.reject_presentation_mutation_v1();

-- =====================================================================================================================
-- B. INTERNAL HELPERS. Executable by no application role.
-- =====================================================================================================================

-- B.1 The declared limits (WP1-R1 §5.2 / §5.3, D-5). The processing envelope bounds what one freeze may write; it never
--     bounds what a person may choose, and nothing above it is cut: it is refused before any write, with these numbers.
CREATE FUNCTION public_compose_source_private.envelope_units_v1() RETURNS integer
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT 10000 $$;
CREATE FUNCTION public_compose_source_private.envelope_bytes_v1() RETURNS integer
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT 8388608 $$;
CREATE FUNCTION public_compose_source_private.page_size_v1() RETURNS integer
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT 50 $$;
CREATE FUNCTION public_compose_source_private.search_document_bytes_v1() RETURNS integer
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT 8192 $$;
CREATE FUNCTION public_compose_source_private.interpreter_input_bytes_v1() RETURNS integer
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT 24576 $$;
CREATE FUNCTION public_compose_source_private.qandeel_context_bytes_v1() RETURNS integer
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT 6144 $$;

-- B.2 A text cut to at most p_bytes UTF-8 bytes at a character boundary. Used ONLY for bounded derived inputs (the search
--     document, the interpreter input, the @qandeel context) - never for anything a person reads as the topic.
CREATE FUNCTION public_compose_source_private.bounded_text_v1(p_text text, p_bytes integer)
RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  n integer;
BEGIN
  IF p_text IS NULL OR octet_length(p_text) <= p_bytes THEN
    RETURN p_text;
  END IF;
  n := least(char_length(p_text), p_bytes);
  WHILE n > 0 AND octet_length(left(p_text, n)) > p_bytes LOOP
    n := n - greatest(1, (octet_length(left(p_text, n)) - p_bytes + 3) / 4);
  END LOOP;
  RETURN left(p_text, greatest(n, 0));
END$$;

-- B.3 Whether ONE Understanding item is shown to its owner now, exactly as the «فهم قنديل» surface decides it
--     (understanding.service.ts: a current status, its summary not withheld by the evidence change, not under review),
--     at the exact version the author chose (A-3 2(b), D-6). SHOWN | SOURCE_UNAVAILABLE | UNDERSTANDING_CHANGED |
--     UNDERSTANDING_UNDER_REVIEW | UNDERSTANDING_WITHHELD. A stranger's item and a missing one are the same answer.
CREATE FUNCTION public_compose_source_private.understanding_state_v1(p_user uuid, p_hypothesis_id uuid, p_version integer)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_h public.hypotheses;
BEGIN
  SELECT h.* INTO v_h FROM public.hypotheses h WHERE h.id = p_hypothesis_id AND h.user_id = p_user;
  IF NOT FOUND OR v_h.status NOT IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK') THEN
    RETURN 'SOURCE_UNAVAILABLE';
  END IF;
  IF v_h.version <> p_version THEN
    RETURN 'UNDERSTANDING_CHANGED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.understanding_contests c
              WHERE c.hypothesis_id = p_hypothesis_id AND c.user_id = p_user AND c.lifecycle = 'UNDER_REVIEW') THEN
    RETURN 'UNDERSTANDING_UNDER_REVIEW';
  END IF;
  IF NOT public.hypothesis_reliance_usable_v1(p_user, p_hypothesis_id) THEN
    RETURN 'UNDERSTANDING_WITHHELD';
  END IF;
  RETURN 'SHOWN';
END$$;

-- B.4 THE ONE PROJECTION of a draft's items, re-derived from the canonical rows (never from the client): the written
--     text first (if any), then the Understanding summary, then the selected whole committed units of the conversation
--     in true Session Position order. Every unit of a message shares the message's ordinal; a message is excluded or
--     emphasized as a whole, by its first Session Position; QANDEEL's replies only when the author included them; a
--     gap precedes a unit when anything between it and the previous kept unit was left out. A unit whose text is only
--     whitespace has nothing to show and is not an item (it never creates a gap). Preview, freeze and the sealed
--     package all come from this one derivation. It assumes the caller already answered the source outcome.
CREATE FUNCTION public_compose_source_private.draft_source_items_v1(p_user uuid, p_draft public_compose_private.topic_drafts)
RETURNS TABLE (display_position integer, item_role text, source_session_position integer, message_ordinal integer,
               emphasized boolean, gap_before boolean, unit_id uuid, body text)
-- work_mem: the projection's windows and sorts carry every body (up to the 8 MB envelope); at the 4 MB default they
-- spill to disk and the 10,000-unit freeze misses its 3 s gate. 32 MB per node holds the whole envelope in memory.
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' SET work_mem = '32MB' AS $$
  WITH written AS (
    SELECT public_compose_private.public_form_v1(p_draft.body) AS body
  ), head AS (
    SELECT 1 AS k, 'WRITTEN'::text AS role, NULL::integer AS sp, NULL::integer AS msg, false AS emph, false AS gap,
           NULL::uuid AS unit, w.body
      FROM written w WHERE char_length(w.body) > 0
    UNION ALL
    SELECT 2, 'QANDEEL_UNDERSTANDING', NULL, NULL, false, false, NULL, h.statement
      FROM public.hypotheses h
     WHERE p_draft.source_kind = 'UNDERSTANDING' AND h.id = p_draft.source_hypothesis_id AND h.user_id = p_user
  ), units AS (
    SELECT cu.id, cu.session_position AS sp, cu.source_role, cu.committed_text,
           min(cu.session_position) OVER (PARTITION BY cu.source_turn_id) AS msg_first
      FROM public.conversation_units cu
     WHERE p_draft.source_kind = 'CONVERSATION' AND cu.session_id = p_draft.source_session_id AND cu.user_id = p_user
       AND cu.session_position BETWEEN p_draft.source_first_sp AND p_draft.source_last_sp
  ), excluded AS (
    SELECT DISTINCT x AS sp FROM unnest(p_draft.source_excluded_sps) AS x
  ), emphasized AS (
    SELECT DISTINCT x AS sp FROM unnest(p_draft.source_emphasized_sps) AS x
  ), chosen AS (
    SELECT u.*, (m.sp IS NOT NULL) AS emph
      FROM units u
      LEFT JOIN excluded e ON e.sp = u.msg_first
      LEFT JOIN emphasized m ON m.sp = u.msg_first
     WHERE e.sp IS NULL AND (p_draft.source_include_qandeel OR u.source_role = 'USER')
  ), gapped AS (
    SELECT c.*, coalesce(lag(c.sp) OVER (ORDER BY c.sp) <> c.sp - 1, false) AS gap
      FROM chosen c
  ), conversation AS (
    SELECT 3 AS k, CASE g.source_role WHEN 'USER' THEN 'YOUR_MESSAGE' ELSE 'QANDEEL_REPLY' END AS role, g.sp,
           (dense_rank() OVER (ORDER BY g.msg_first))::integer AS msg, g.emph, g.gap, g.id AS unit, g.committed_text AS body
      FROM gapped g WHERE length(btrim(g.committed_text)) > 0
  ), everything AS (
    SELECT * FROM head UNION ALL SELECT * FROM conversation
  )
  SELECT (row_number() OVER (ORDER BY e.k, e.sp))::integer, e.role, e.sp, e.msg, e.emph, e.gap, e.unit, e.body
    FROM everything e
   ORDER BY e.k, e.sp;
$$;

-- B.5 Whether a draft's source resolves now: RESOLVED, or the one refusal (A-3 9's closed list, plus the declared
--     envelope). Read without a lock: a freeze re-establishes it under its own locks.
--       SOURCE_UNAVAILABLE   not the author's conversation, no such positions, a gap, or an Understanding item no longer
--                            current (one answer for each, so another person's source is indistinguishable from none)
--       NOT_WHOLE_MESSAGES   the range starts or ends inside a message
--       SELECTION_INVALID    an excluded or emphasized position is not the first position of a message in the range
--       NOTHING_SELECTED     every message was left out
--       UNDERSTANDING_*      the item changed, is under review, or its summary is withheld (B.3)
--       TOO_LARGE            above the processing envelope (B.1), with nothing written
CREATE FUNCTION public_compose_source_private.draft_source_outcome_v1(p_user uuid, p_draft public_compose_private.topic_drafts)
RETURNS TABLE (outcome text, item_count integer, text_bytes bigint, qandeel_material boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_range record;
  v_state text;
BEGIN
  IF p_draft.source_kind = 'CONVERSATION' THEN
    SELECT * INTO v_range FROM replay_private.resolve_personal_range_v1(p_draft.source_session_id, p_draft.source_first_sp,
                                                                        p_draft.source_last_sp);
    IF v_range.outcome = 'NOT_WHOLE_MESSAGES' THEN
      RETURN QUERY SELECT 'NOT_WHOLE_MESSAGES'::text, NULL::integer, NULL::bigint, NULL::boolean;
      RETURN;
    END IF;
    IF v_range.outcome IS DISTINCT FROM 'RESOLVED' THEN
      RETURN QUERY SELECT 'SOURCE_UNAVAILABLE'::text, NULL::integer, NULL::bigint, NULL::boolean;
      RETURN;
    END IF;
    -- Every named message is a WHOLE message of the range, named by its first position.
    IF EXISTS (
      SELECT 1 FROM unnest(p_draft.source_excluded_sps || p_draft.source_emphasized_sps) AS x(sp)
       WHERE x.sp NOT BETWEEN p_draft.source_first_sp AND p_draft.source_last_sp
          OR NOT EXISTS (
            SELECT 1 FROM public.conversation_units cu
             WHERE cu.session_id = p_draft.source_session_id AND cu.user_id = p_user AND cu.session_position = x.sp
               AND NOT EXISTS (SELECT 1 FROM public.conversation_units o
                                WHERE o.source_turn_id = cu.source_turn_id AND o.session_position < cu.session_position)))
    THEN
      RETURN QUERY SELECT 'SELECTION_INVALID'::text, NULL::integer, NULL::bigint, NULL::boolean;
      RETURN;
    END IF;
  ELSIF p_draft.source_kind = 'UNDERSTANDING' THEN
    v_state := public_compose_source_private.understanding_state_v1(p_user, p_draft.source_hypothesis_id,
                                                                    p_draft.source_hypothesis_version);
    IF v_state <> 'SHOWN' THEN
      RETURN QUERY SELECT v_state, NULL::integer, NULL::bigint, NULL::boolean;
      RETURN;
    END IF;
  ELSE
    RAISE EXCEPTION 'PUBLIC_COMPOSE_CONTRADICTORY_STATE' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
    SELECT CASE WHEN count(*) FILTER (WHERE i.item_role <> 'WRITTEN') = 0 THEN 'NOTHING_SELECTED'
                WHEN count(*) > public_compose_source_private.envelope_units_v1()
                  OR coalesce(sum(octet_length(i.body)), 0) > public_compose_source_private.envelope_bytes_v1() THEN 'TOO_LARGE'
                ELSE 'RESOLVED' END,
           count(*)::integer, coalesce(sum(octet_length(i.body)), 0)::bigint,
           coalesce(bool_or(i.item_role IN ('QANDEEL_REPLY', 'QANDEEL_UNDERSTANDING')), false)
      FROM public_compose_source_private.draft_source_items_v1(p_user, p_draft) i;
END$$;

-- B.6 Whether a sourced draft can be frozen, before its source: READY, or the first thing missing. The written text is
--     optional here (the source is the topic's material); the title and the section are the author's, as in CP1.
CREATE FUNCTION public_compose_source_private.sourced_readiness_v1(p_draft public_compose_private.topic_drafts)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN char_length(public_compose_private.public_form_v1(p_draft.title)) < 8 THEN 'TITLE_TOO_SHORT'
    WHEN p_draft.section_key IS NULL
      OR NOT EXISTS (SELECT 1 FROM public_compose_private.sections s
                      WHERE s.section_key = p_draft.section_key AND s.retired_at IS NULL) THEN 'SECTION_REQUIRED'
    ELSE 'READY' END;
$$;

-- B.7 THE SOURCED PACKAGE: the 0119 preparation sequence (as 0179 C.7 runs it for one authored item) for every item of
--     the one projection (B.4), written set-based in one statement so a long conversation is one pass, with its
--     presentation and its bounded search document sealed beside it. Same lock prefix, same exact-controller and DRAFT
--     rules, same rows at one instant, the authority from the ONE derivation. Item identities are derived from the
--     freeze command and the display position, so a retry names the same rows. Internal: reached only from the freeze,
--     which has already answered the source outcome under its locks.
CREATE FUNCTION public_compose_source_private.prepare_sourced_package_v1(
  p_command_id uuid, p_freeze_command_id uuid, p_experience_id uuid, p_manifest_version_id uuid,
  p_experience_version_id uuid, p_draft public_compose_private.topic_drafts, p_title text, p_item_count integer
) RETURNS TABLE (required_approver_count integer)
-- work_mem as B.4's, for the materialized projection below.
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' SET enable_seqscan = off SET work_mem = '32MB' AS $$
DECLARE
  u uuid := auth.uid();
  v_experience public.public_experiences;
  v_controller public.public_experience_controllers;
  v_ordinal integer;
  v_instant timestamptz;
  v_request text;
  v_approvers uuid[];
  v_count integer;
  v_fingerprint text;
  v_written integer;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_freeze_command_id IS NULL OR p_experience_id IS NULL OR p_manifest_version_id IS NULL
     OR p_experience_version_id IS NULL OR p_draft.user_id IS DISTINCT FROM u OR p_draft.source_kind IS NULL
     OR p_title IS NULL OR p_item_count IS NULL OR p_item_count < 1 THEN
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
  -- The request reference names the package identities and the source SHAPE, never a text or a source identifier.
  v_request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_S8A_05_PUBLIC_SOURCED_PREPARE_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'manifest=' || lower(p_manifest_version_id::text) || E'\n'
   || 'experienceVersion=' || lower(p_experience_version_id::text) || E'\n'
   || 'sourceKind=' || p_draft.source_kind || E'\n'
   || 'itemCount=' || p_item_count::text, 'UTF8')), 'hex');

  INSERT INTO public.publication_package_manifest_versions
    (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
     intended_publication_action, target_audience_class, authority_readiness,
     prepared_authority_snapshot_version, item_count, created_at)
  SELECT p_manifest_version_id, p_experience_id, true, v_controller.controller_public_identity_ref, u,
         'PUBLISH_TO_PUBLIC_WORLD', 'PUBLIC_WORLD_AUDIENCE', 'PRIVACY_OWNERSHIP_AUTHORITY_ONLY',
         w.state_version, p_item_count, v_instant
    FROM public.public_world_state w WHERE w.singleton;

  -- ONE statement: items, bodies, provenance, per-item authority and the sealed presentation of the one projection.
  WITH projected AS MATERIALIZED (
    SELECT i.*,
           -- derive_compose_identity_v1(namespace, u, freeze command), written inline (one expression for 10,000 rows
           -- instead of 10,000 calls): 'ITEM' for the written text, 'ITEM:<display position>' for every other item.
           (substr(h.h, 1, 12) || '4' || substr(h.h, 14, 3) || '8' || substr(h.h, 18, 3) || substr(h.h, 21, 12))::uuid AS item_id,
           'sha256:' || encode(sha256(convert_to(i.body, 'UTF8')), 'hex') AS digest
      FROM public_compose_source_private.draft_source_items_v1(u, p_draft) i
     CROSS JOIN LATERAL (SELECT encode(sha256(convert_to('QANDEEL_S8A_05_PUBLIC_COMPOSE_IDENTITY_V1' || E'\n'
                           || CASE WHEN i.item_role = 'WRITTEN' THEN 'ITEM' ELSE 'ITEM:' || i.display_position::text END
                           || E'\n' || lower(u::text) || E'\n' || lower(p_freeze_command_id::text), 'UTF8')), 'hex') AS h) h
  ), items AS (
    INSERT INTO public.publication_package_manifest_items
      (manifest_version_id, experience_id, package_item_id, item_ordinal, derivative_classification, public_body_form,
       public_body_digest)
    SELECT p_manifest_version_id, p_experience_id, p.item_id, p.display_position,
           CASE WHEN p.item_role IN ('WRITTEN', 'YOUR_MESSAGE') THEN 'SOURCE_CONTENT_BEARING_DERIVATIVE'
                ELSE 'ANALYTICAL_DERIVATIVE' END,
           'PUBLIC_TEXT', p.digest
      FROM projected p
    RETURNING 1
  ), bodies AS (
    INSERT INTO public.public_experience_text_derivative_bodies (package_item_id, public_body_form, public_text_body)
    SELECT p.item_id, 'PUBLIC_TEXT', p.body FROM projected p
    RETURNING 1
  ), provenance AS (
    INSERT INTO public.publication_package_item_provenance
      (package_item_id, manifest_version_id, source_class, personal_conversation_unit_id, personal_owner_user_id,
       shared_world_id, shared_material_id, shared_history_item_id, captured_availability_state,
       captured_availability_revision, captured_source_digest)
    SELECT p.item_id, p_manifest_version_id,
           CASE WHEN p.item_role = 'WRITTEN' THEN 'PUBLIC_AUTHORED' ELSE 'MY_WORLD' END,
           p.unit_id, CASE WHEN p.item_role = 'WRITTEN' THEN NULL ELSE u END,
           NULL, NULL, NULL, 'AVAILABLE', NULL, p.digest
      FROM projected p
    RETURNING 1
  ), authority AS (
    INSERT INTO public.publication_package_item_authority
      (package_item_id, manifest_version_id, resolution_state, required_approver_count)
    SELECT p.item_id, p_manifest_version_id, 'RESOLVED_EXACT_HUMAN_REQUIREMENT', 1 FROM projected p
    RETURNING 1
  ), presentation AS (
    INSERT INTO public_compose_source_private.item_presentation
      (manifest_version_id, package_item_id, display_position, item_role, source_session_position, message_ordinal,
       emphasized, gap_before)
    SELECT p_manifest_version_id, p.item_id, p.display_position, p.item_role, p.source_session_position,
           p.message_ordinal, p.emphasized, p.gap_before
      FROM projected p
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM items)::integer INTO v_written
   WHERE (SELECT count(*) FROM bodies) = (SELECT count(*) FROM provenance)
     AND (SELECT count(*) FROM authority) = (SELECT count(*) FROM presentation)
     AND (SELECT count(*) FROM bodies) = (SELECT count(*) FROM presentation);
  -- All or nothing: the projection is what the freeze resolved under its locks, or the whole freeze is rolled back.
  IF v_written IS DISTINCT FROM p_item_count THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_NOT_PREPARED' USING ERRCODE = 'QC179';
  END IF;

  INSERT INTO public.public_experience_versions (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
  VALUES (p_experience_version_id, p_experience_id, p_manifest_version_id, v_ordinal, v_instant);

  -- The bounded search document: the title, the written text and the emphasized messages, in display order (≤ 8 KB).
  INSERT INTO public_compose_source_private.version_search_documents (experience_version_id, experience_id, document)
  SELECT p_experience_version_id, p_experience_id,
         public_compose_source_private.bounded_text_v1(
           p_title || coalesce(E'\n' || string_agg(b.public_text_body, E'\n' ORDER BY ip.display_position), ''),
           public_compose_source_private.search_document_bytes_v1())
    FROM (SELECT 1) one
    LEFT JOIN public_compose_source_private.item_presentation ip
      ON ip.manifest_version_id = p_manifest_version_id AND (ip.item_role = 'WRITTEN' OR ip.emphasized)
    LEFT JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = ip.package_item_id;

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
          'PREPARE_PUBLICATION', p_item_count, v_count, v_fingerprint, v_request, v_instant);
  RETURN QUERY SELECT v_count;
END$$;

-- =====================================================================================================================
-- C. CA-S8A05-A3 IN THE PACKAGE, AND THE CP2 DISCARD (A-2(c) as narrowed by CP2).
-- =====================================================================================================================

-- C.1 The MY_WORLD provenance shapes. A conversation unit (unchanged); an Understanding summary (A-3 2(b): no unit, its
--     owner the approver, its own sealed body the source); and a Personal item a never-published discard erased (no
--     pointer, no verifier, the erasure instant). Every other class is unchanged; the digest erasure admits MY_WORLD.
ALTER TABLE public.publication_package_item_provenance
  DROP CONSTRAINT publication_package_item_provenance_shape_check,
  DROP CONSTRAINT publication_package_item_provenance_digest_erasure_check;
ALTER TABLE public.publication_package_item_provenance
  ADD CONSTRAINT publication_package_item_provenance_shape_check CHECK (
    (source_class = 'MY_WORLD'
        AND shared_world_id IS NULL AND shared_material_id IS NULL AND shared_history_item_id IS NULL
        AND captured_availability_revision IS NULL
        AND ((personal_conversation_unit_id IS NOT NULL AND personal_owner_user_id IS NOT NULL
              AND captured_source_digest IS NOT NULL)
          OR (personal_conversation_unit_id IS NULL AND personal_owner_user_id IS NOT NULL
              AND captured_source_digest IS NOT NULL)
          OR (personal_conversation_unit_id IS NULL AND personal_owner_user_id IS NULL
              AND captured_source_digest IS NULL AND captured_digest_erased_at IS NOT NULL)))
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
            AND source_class IN ('SHARED_WORLD', 'PUBLIC_AUTHORED', 'MY_WORLD')));

-- C.2 THE ONE I-05A AUTHORITY DERIVATION, forward-replaced from 0179 with three changes, each marked S8A-05 CP2: the
--     conversation-unit digest check reads only rows that name a unit; an Understanding item's source is its own sealed
--     body (as an authored item's); a Personal item whose pointers were erased has no source. The approver set is
--     unchanged: a Personal item's one rightsholder is its owner, the author (CA-S8A05-A3 4).
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
       AND p.personal_conversation_unit_id IS NOT NULL
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
     WHERE p.manifest_version_id = p_manifest_version_id
       AND (p.source_class = 'PUBLIC_AUTHORED'
            -- S8A-05 CP2 (0180), CA-S8A05-A3 2(b): an Understanding summary's source is its own sealed body - the exact
            -- text shown to its owner at the freeze, which verified it was shown, current and not under review.
            OR (p.source_class = 'MY_WORLD' AND p.personal_conversation_unit_id IS NULL))
       AND NOT EXISTS (
         SELECT 1 FROM public.public_experience_text_derivative_bodies b
          WHERE b.package_item_id = p.package_item_id
            AND ('sha256:' || encode(sha256(convert_to(b.public_text_body, 'UTF8')), 'hex'))
                = p.captured_source_digest)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- S8A-05 CP2 (0180): a Personal item whose source pointers a never-published discard erased has no source at all.
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
     WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'MY_WORLD'
       AND (p.personal_owner_user_id IS NULL OR p.captured_source_digest IS NULL)
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
               -- S8A-05 CP2 (0180): an Understanding item has no unit; its token names its own package item.
               WHEN 'MY_WORLD' THEN 'MY_WORLD:' || coalesce(lower(p.personal_conversation_unit_id::text),
                                                            'UNDERSTANDING:' || lower(p.package_item_id::text))
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

-- C.3 THE ONE-WAY PACKAGE GUARD, forward-replaced from 0179 with its never-published discard exception widened to every
--     text class (S8A-05 CP2, A-2(c) as narrowed by CP2): a Personal item also loses its source pointers in the same step,
--     and a Personal or Shared item is admitted only beside the discard command recorded at exactly the erasure instant.
--     The three ASSURE-F05 Shared exceptions and the body rule are byte-for-byte 0179's.
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
    -- S8A-05 (0179): AN AUTHORED ITEM OF A NEVER-PUBLISHED, DISCARDED EXPERIENCE. S8A-05 CP2 (0180), A-2(c) as narrowed
    -- by CP2: an item of ANY text class of such an Experience. A Personal item's source pointers (its unit and its owner)
    -- go to NULL in the same step, and nothing else moves; a Shared item keeps its Shared identifiers (they are not a
    -- Personal source pointer), as an authored item has none.
    prov_new.personal_conversation_unit_id := CASE WHEN OLD.source_class = 'MY_WORLD' THEN OLD.personal_conversation_unit_id
                                                   ELSE prov_new.personal_conversation_unit_id END;
    prov_new.personal_owner_user_id := CASE WHEN OLD.source_class = 'MY_WORLD' THEN OLD.personal_owner_user_id
                                            ELSE prov_new.personal_owner_user_id END;
    IF OLD.captured_source_digest IS NOT NULL AND NEW.captured_source_digest IS NULL
       AND OLD.captured_digest_erased_at IS NULL AND NEW.captured_digest_erased_at IS NOT NULL
       AND NOT (prov_new IS DISTINCT FROM OLD)
       AND OLD.source_class IN ('PUBLIC_AUTHORED', 'MY_WORLD', 'SHARED_WORLD')
       AND (OLD.source_class <> 'MY_WORLD'
            OR (NEW.personal_conversation_unit_id IS NULL AND NEW.personal_owner_user_id IS NULL))
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
    -- S8A-05 CP2 (0180): so may a Personal or Shared item of such an Experience, whose discard command is re-proved here.
    IF OLD.content_state = 'CONTENT_PRESENT' AND NEW.content_state = 'ERASED_BY_OWNER'
       AND OLD.public_body_digest IS NOT NULL AND NEW.public_body_digest IS NULL
       AND OLD.content_erased_at IS NULL AND NEW.content_erased_at IS NOT NULL
       AND NOT (item_new IS DISTINCT FROM OLD)
       AND EXISTS (SELECT 1 FROM public.publication_package_item_provenance p
                    WHERE p.package_item_id = OLD.package_item_id AND p.manifest_version_id = OLD.manifest_version_id
                      AND p.captured_source_digest IS NULL AND p.captured_digest_erased_at = NEW.content_erased_at
                      AND (p.source_class = 'PUBLIC_AUTHORED'
                           OR (p.source_class IN ('MY_WORLD', 'SHARED_WORLD')
                               AND EXISTS (SELECT 1 FROM public_compose_private.discard_commands d
                                            WHERE d.experience_id = OLD.experience_id
                                              AND d.occurred_at = NEW.content_erased_at)))) THEN
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
          DETAIL='A publication package manifest, its items, its public bodies, its provenance, its authority resolution, its required approver set and its approvals are append-only: UPDATE and DELETE are refused for every role, including the table owner. A changed payload is a NEW manifest. The exceptions are one-way erasures proven from canonical truth: a derivative whose Shared source owner deletion physically erased (S5-02, ASSURE-F05), and an item of a never-published topic its author discarded (S8A-05).';
END$$;

ALTER FUNCTION public.reject_publication_package_mutation_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reject_publication_package_mutation_v1() FROM PUBLIC;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_publication_package_mutation_v1() FROM anon, authenticated, service_role';
ELSE
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_publication_package_mutation_v1() FROM anon, authenticated';
END IF;END$$;

-- C.4 THE FIFTH LIFECYCLE MOVER, forward-replaced from 0179 (A-2(c) as narrowed by CP2): a never-published topic is
--     discarded whatever its text item classes; only a Replay artifact (REPLAY-DIST-01) stays NOT_DISCARDABLE. Every
--     Personal source pointer and every bounded search document go at the same instant as the bodies and the title.
CREATE OR REPLACE FUNCTION public.discard_never_published_public_experience_v1(p_command_id uuid, p_experience_id uuid)
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
                 WHERE m.experience_id = p_experience_id AND p.source_class = 'REPLAY_ARTIFACT') THEN
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
     SET captured_source_digest = NULL, captured_digest_erased_at = v_instant,
         -- S8A-05 CP2 (0180): a Personal item keeps no pointer to its private source.
         personal_conversation_unit_id = NULL, personal_owner_user_id = NULL
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

  -- S8A-05 CP2 (0180): and the bounded search document of every sourced version.
  UPDATE public_compose_source_private.version_search_documents s SET document = NULL, document_erased_at = v_instant
   WHERE s.experience_id = p_experience_id AND s.document IS NOT NULL;

  RETURN QUERY SELECT 'DISCARDED'::text, v_instant;
END$$;

-- =====================================================================================================================
-- D. THE FREEZE (0179 D.7), forward-replaced: a draft with a source freezes through B.7; a draft without one is frozen
--    exactly as before. The clearance seam still answers first, and production stays CLOSED.
-- =====================================================================================================================
CREATE OR REPLACE FUNCTION public_compose_private.freeze_own_topic_draft_v1(p_command_id uuid, p_draft_id uuid, p_expected_revision bigint)
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
  v_source record;
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
  IF v_draft.source_kind IS NULL THEN
    v_ready := public_compose_private.draft_readiness_v1(v_draft.title, v_draft.body, v_draft.section_key);
  ELSE
    -- S8A-05 CP2 (0180): a sourced draft. Its written text is optional; its source is re-derived HERE, under the locks
    -- this freeze holds (the draft row FOR UPDATE above; an Understanding item FOR SHARE, so it cannot change, be
    -- contested or be withdrawn before this transaction ends; committed units are immutable).
    v_ready := public_compose_source_private.sourced_readiness_v1(v_draft);
    IF v_ready = 'READY' THEN
      IF v_draft.source_kind = 'UNDERSTANDING' THEN
        PERFORM 1 FROM public.hypotheses h
         WHERE h.id = v_draft.source_hypothesis_id AND h.user_id = v_user FOR SHARE;
      END IF;
      SELECT * INTO v_source FROM public_compose_source_private.draft_source_outcome_v1(v_user, v_draft);
      v_ready := v_source.outcome;
      IF v_ready = 'RESOLVED' THEN
        v_ready := 'READY';
        -- CA-S8A05-A3 6: QANDEEL material is published only after the author's one acknowledgement OF THIS REVISION.
        IF v_source.qandeel_material AND v_draft.source_acknowledged_revision IS DISTINCT FROM v_draft.draft_revision THEN
          v_ready := 'ACKNOWLEDGEMENT_REQUIRED';
        END IF;
      END IF;
    END IF;
  END IF;
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
    IF v_draft.source_kind IS NULL THEN
      PERFORM 1 FROM public_compose_private.prepare_authored_package_v1(
        public_compose_private.derive_compose_identity_v1('PREPARE', v_user, p_command_id), v_experience, v_manifest,
        v_version, public_compose_private.derive_compose_identity_v1('ITEM', v_user, p_command_id), v_body);
    ELSE
      PERFORM 1 FROM public_compose_source_private.prepare_sourced_package_v1(
        public_compose_private.derive_compose_identity_v1('PREPARE', v_user, p_command_id), p_command_id, v_experience,
        v_manifest, v_version, v_draft, v_title, v_source.item_count);
    END IF;
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
    WHEN SQLSTATE 'QC179' OR SQLSTATE '23505' OR SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      -- Everything this block wrote is rolled back with it: no identity, no Experience, no package.
      -- 40001 / PT409 (PROD-RETRY-01, 0150): the frozen cores this block calls answer a stale state or a lost race with
      -- 40001 (or PT409 where 0150 substituted it). Nothing is committed inside a function, so the same rollback holds and
      -- the answer is the bounded NOT_PREPARED; no 40001 reaches the Data API, where PostgREST before v16 would re-run the
      -- whole request without bound.
      RETURN QUERY SELECT 'NOT_PREPARED'::text, NULL::uuid, NULL::text;
      RETURN;
  END;
  RETURN QUERY SELECT 'PREPARED'::text, v_experience, 'READY_FOR_REVIEW'::text;
END$$;


-- =====================================================================================================================
-- E. OWNER COMMANDS ON A DRAFT'S SOURCE (authenticated; the exact human from auth.uid(), admitted as a REGISTERED
--    Public viewer). References in, never text. Nothing here provisions a Public Identity or writes a Public row.
-- =====================================================================================================================

-- E.1 CHOOSE A CONVERSATION as the draft's source: create the draft under a client-chosen id (expected revision 0) or
--     replace its source under compare-and-set. The whole conversation, a contiguous range, separate whole messages
--     (everything else in the range excluded, by each message's first Session Position) and emphasized messages; with
--     or without QANDEEL's replies. The selection is resolved HERE before anything is written, and refused with its one
--     reason. CREATED | SAVED | STALE | NOT_FOUND | PREPARED | LIMIT_REACHED | INVALID | ACCOUNT_DELETION_PENDING |
--     SOURCE_UNAVAILABLE | NOT_WHOLE_MESSAGES | SELECTION_INVALID | NOTHING_SELECTED | TOO_LARGE. A changed source
--     needs a new acknowledgement. An equivalent retry of the write that produced the current revision answers SAVED.
CREATE FUNCTION public_compose_source_private.set_own_topic_conversation_source_v1(
  p_draft_id uuid, p_expected_revision bigint, p_session_id uuid, p_first_sp integer, p_last_sp integer,
  p_include_qandeel boolean, p_excluded_sps integer[], p_emphasized_sps integer[]
) RETURNS TABLE (outcome text, draft_revision bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_draft public_compose_private.topic_drafts;
  v_candidate public_compose_private.topic_drafts;
  v_excluded integer[];
  v_emphasized integer[];
  v_found boolean;
  v_outcome text;
BEGIN
  IF p_draft_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 OR p_session_id IS NULL
     OR p_first_sp IS NULL OR p_last_sp IS NULL OR p_include_qandeel IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_first_sp < 1 OR p_last_sp < p_first_sp
     OR coalesce(cardinality(p_excluded_sps), 0) > 10000 OR coalesce(cardinality(p_emphasized_sps), 0) > 10000
     OR array_position(p_excluded_sps, NULL) IS NOT NULL OR array_position(p_emphasized_sps, NULL) IS NOT NULL THEN
    RETURN QUERY SELECT 'INVALID'::text, NULL::bigint;
    RETURN;
  END IF;
  -- One canonical spelling: each list sorted, without repeats.
  v_excluded := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_excluded_sps, '{}')) AS x ORDER BY x);
  v_emphasized := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_emphasized_sps, '{}')) AS x ORDER BY x);
  IF public_compose_private.account_deletion_pending_v1(v_user) THEN
    RETURN QUERY SELECT 'ACCOUNT_DELETION_PENDING'::text, NULL::bigint;
    RETURN;
  END IF;
  SELECT d.* INTO v_draft FROM public_compose_private.topic_drafts d WHERE d.id = p_draft_id FOR UPDATE;
  v_found := FOUND;
  IF v_found THEN
    IF v_draft.user_id <> v_user THEN
      RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bigint;
      RETURN;
    END IF;
    IF v_draft.prepared_experience_id IS NOT NULL THEN
      RETURN QUERY SELECT 'PREPARED'::text, v_draft.draft_revision;
      RETURN;
    END IF;
    IF v_draft.source_kind IS NOT DISTINCT FROM 'CONVERSATION' AND v_draft.source_session_id = p_session_id
       AND v_draft.source_first_sp = p_first_sp AND v_draft.source_last_sp = p_last_sp
       AND v_draft.source_include_qandeel = p_include_qandeel AND v_draft.source_excluded_sps = v_excluded
       AND v_draft.source_emphasized_sps = v_emphasized
       AND p_expected_revision IN (v_draft.draft_revision, v_draft.draft_revision - 1) THEN
      RETURN QUERY SELECT 'SAVED'::text, v_draft.draft_revision;
      RETURN;
    END IF;
    IF p_expected_revision <> v_draft.draft_revision THEN
      RETURN QUERY SELECT 'STALE'::text, v_draft.draft_revision;
      RETURN;
    END IF;
    v_candidate := v_draft;
  ELSE
    IF p_expected_revision <> 0 THEN
      RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bigint;
      RETURN;
    END IF;
    IF (SELECT count(*) FROM public_compose_private.topic_drafts d WHERE d.user_id = v_user) >= 50 THEN
      RETURN QUERY SELECT 'LIMIT_REACHED'::text, NULL::bigint;
      RETURN;
    END IF;
    v_candidate.id := p_draft_id;
    v_candidate.user_id := v_user;
    v_candidate.title := '';
    v_candidate.body := '';
  END IF;
  v_candidate.source_kind := 'CONVERSATION';
  v_candidate.source_session_id := p_session_id;
  v_candidate.source_first_sp := p_first_sp;
  v_candidate.source_last_sp := p_last_sp;
  v_candidate.source_include_qandeel := p_include_qandeel;
  v_candidate.source_excluded_sps := v_excluded;
  v_candidate.source_emphasized_sps := v_emphasized;
  v_candidate.source_hypothesis_id := NULL;
  v_candidate.source_hypothesis_version := NULL;
  SELECT o.outcome INTO v_outcome FROM public_compose_source_private.draft_source_outcome_v1(v_user, v_candidate) o;
  IF v_outcome <> 'RESOLVED' THEN
    RETURN QUERY SELECT v_outcome, CASE WHEN v_found THEN v_draft.draft_revision END;
    RETURN;
  END IF;
  IF NOT v_found THEN
    INSERT INTO public_compose_private.topic_drafts
      (id, user_id, draft_revision, title, body, section_key, source_kind, source_session_id, source_first_sp,
       source_last_sp, source_include_qandeel, source_excluded_sps, source_emphasized_sps)
    VALUES (p_draft_id, v_user, 1, '', '', NULL, 'CONVERSATION', p_session_id, p_first_sp, p_last_sp, p_include_qandeel,
            v_excluded, v_emphasized);
    RETURN QUERY SELECT 'CREATED'::text, 1::bigint;
    RETURN;
  END IF;
  UPDATE public_compose_private.topic_drafts d
     SET source_kind = 'CONVERSATION', source_session_id = p_session_id, source_first_sp = p_first_sp,
         source_last_sp = p_last_sp, source_include_qandeel = p_include_qandeel, source_excluded_sps = v_excluded,
         source_emphasized_sps = v_emphasized, source_hypothesis_id = NULL, source_hypothesis_version = NULL,
         source_acknowledged_revision = NULL, draft_revision = d.draft_revision + 1, updated_at = clock_timestamp()
   WHERE d.id = p_draft_id;
  RETURN QUERY SELECT 'SAVED'::text, v_draft.draft_revision + 1;
END$$;

-- E.2 CHOOSE A «فهم قنديل» ITEM as the draft's source, at the exact version the author is shown (A-3 2(b)). The client
--     names the item and its version; the summary is read here, never sent. Same outcomes as E.1, with the item's own
--     refusals (SOURCE_UNAVAILABLE | UNDERSTANDING_CHANGED | UNDERSTANDING_UNDER_REVIEW | UNDERSTANDING_WITHHELD).
CREATE FUNCTION public_compose_source_private.set_own_topic_understanding_source_v1(
  p_draft_id uuid, p_expected_revision bigint, p_hypothesis_id uuid, p_hypothesis_version integer
) RETURNS TABLE (outcome text, draft_revision bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_draft public_compose_private.topic_drafts;
  v_found boolean;
  v_outcome text;
BEGIN
  IF p_draft_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 OR p_hypothesis_id IS NULL
     OR p_hypothesis_version IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_hypothesis_version < 1 THEN
    RETURN QUERY SELECT 'INVALID'::text, NULL::bigint;
    RETURN;
  END IF;
  IF public_compose_private.account_deletion_pending_v1(v_user) THEN
    RETURN QUERY SELECT 'ACCOUNT_DELETION_PENDING'::text, NULL::bigint;
    RETURN;
  END IF;
  SELECT d.* INTO v_draft FROM public_compose_private.topic_drafts d WHERE d.id = p_draft_id FOR UPDATE;
  v_found := FOUND;
  IF v_found THEN
    IF v_draft.user_id <> v_user THEN
      RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bigint;
      RETURN;
    END IF;
    IF v_draft.prepared_experience_id IS NOT NULL THEN
      RETURN QUERY SELECT 'PREPARED'::text, v_draft.draft_revision;
      RETURN;
    END IF;
    IF v_draft.source_kind IS NOT DISTINCT FROM 'UNDERSTANDING' AND v_draft.source_hypothesis_id = p_hypothesis_id
       AND v_draft.source_hypothesis_version = p_hypothesis_version
       AND p_expected_revision IN (v_draft.draft_revision, v_draft.draft_revision - 1) THEN
      RETURN QUERY SELECT 'SAVED'::text, v_draft.draft_revision;
      RETURN;
    END IF;
    IF p_expected_revision <> v_draft.draft_revision THEN
      RETURN QUERY SELECT 'STALE'::text, v_draft.draft_revision;
      RETURN;
    END IF;
  ELSE
    IF p_expected_revision <> 0 THEN
      RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bigint;
      RETURN;
    END IF;
    IF (SELECT count(*) FROM public_compose_private.topic_drafts d WHERE d.user_id = v_user) >= 50 THEN
      RETURN QUERY SELECT 'LIMIT_REACHED'::text, NULL::bigint;
      RETURN;
    END IF;
  END IF;
  v_outcome := public_compose_source_private.understanding_state_v1(v_user, p_hypothesis_id, p_hypothesis_version);
  IF v_outcome <> 'SHOWN' THEN
    RETURN QUERY SELECT v_outcome, CASE WHEN v_found THEN v_draft.draft_revision END;
    RETURN;
  END IF;
  IF NOT v_found THEN
    INSERT INTO public_compose_private.topic_drafts
      (id, user_id, draft_revision, title, body, section_key, source_kind, source_hypothesis_id, source_hypothesis_version)
    VALUES (p_draft_id, v_user, 1, '', '', NULL, 'UNDERSTANDING', p_hypothesis_id, p_hypothesis_version);
    RETURN QUERY SELECT 'CREATED'::text, 1::bigint;
    RETURN;
  END IF;
  UPDATE public_compose_private.topic_drafts d
     SET source_kind = 'UNDERSTANDING', source_session_id = NULL, source_first_sp = NULL, source_last_sp = NULL,
         source_include_qandeel = NULL, source_excluded_sps = NULL, source_emphasized_sps = NULL,
         source_hypothesis_id = p_hypothesis_id, source_hypothesis_version = p_hypothesis_version,
         source_acknowledged_revision = NULL, draft_revision = d.draft_revision + 1, updated_at = clock_timestamp()
   WHERE d.id = p_draft_id;
  RETURN QUERY SELECT 'SAVED'::text, v_draft.draft_revision + 1;
END$$;

-- E.3 REMOVE the draft's source (it becomes a written topic again). SAVED | STALE | NOT_FOUND | PREPARED |
--     ACCOUNT_DELETION_PENDING.
CREATE FUNCTION public_compose_source_private.clear_own_topic_source_v1(p_draft_id uuid, p_expected_revision bigint)
RETURNS TABLE (outcome text, draft_revision bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_draft public_compose_private.topic_drafts;
BEGIN
  IF p_draft_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 1 THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF public_compose_private.account_deletion_pending_v1(v_user) THEN
    RETURN QUERY SELECT 'ACCOUNT_DELETION_PENDING'::text, NULL::bigint;
    RETURN;
  END IF;
  SELECT d.* INTO v_draft FROM public_compose_private.topic_drafts d
   WHERE d.id = p_draft_id AND d.user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bigint;
    RETURN;
  END IF;
  IF v_draft.prepared_experience_id IS NOT NULL THEN
    RETURN QUERY SELECT 'PREPARED'::text, v_draft.draft_revision;
    RETURN;
  END IF;
  IF v_draft.source_kind IS NULL AND p_expected_revision IN (v_draft.draft_revision, v_draft.draft_revision - 1) THEN
    RETURN QUERY SELECT 'SAVED'::text, v_draft.draft_revision;
    RETURN;
  END IF;
  IF p_expected_revision <> v_draft.draft_revision THEN
    RETURN QUERY SELECT 'STALE'::text, v_draft.draft_revision;
    RETURN;
  END IF;
  UPDATE public_compose_private.topic_drafts d
     SET source_kind = NULL, source_session_id = NULL, source_first_sp = NULL, source_last_sp = NULL,
         source_include_qandeel = NULL, source_excluded_sps = NULL, source_emphasized_sps = NULL,
         source_hypothesis_id = NULL, source_hypothesis_version = NULL, source_acknowledged_revision = NULL,
         draft_revision = d.draft_revision + 1, updated_at = clock_timestamp()
   WHERE d.id = p_draft_id;
  RETURN QUERY SELECT 'SAVED'::text, v_draft.draft_revision + 1;
END$$;

-- E.4 ACKNOWLEDGE (CA-S8A05-A3 6): QANDEEL material may describe other people, and publishing it is the author's
--     decision. Bound to exactly one draft revision: any later change needs it again. Not an edit (the revision stays).
--     ACKNOWLEDGED | STALE | NOT_FOUND | PREPARED | NO_SOURCE | ACCOUNT_DELETION_PENDING.
CREATE FUNCTION public_compose_source_private.acknowledge_own_topic_source_v1(p_draft_id uuid, p_draft_revision bigint)
RETURNS TABLE (outcome text, draft_revision bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_draft public_compose_private.topic_drafts;
BEGIN
  IF p_draft_id IS NULL OR p_draft_revision IS NULL OR p_draft_revision < 1 THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF public_compose_private.account_deletion_pending_v1(v_user) THEN
    RETURN QUERY SELECT 'ACCOUNT_DELETION_PENDING'::text, NULL::bigint;
    RETURN;
  END IF;
  SELECT d.* INTO v_draft FROM public_compose_private.topic_drafts d
   WHERE d.id = p_draft_id AND d.user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::bigint;
    RETURN;
  END IF;
  IF v_draft.prepared_experience_id IS NOT NULL THEN
    RETURN QUERY SELECT 'PREPARED'::text, v_draft.draft_revision;
    RETURN;
  END IF;
  IF v_draft.source_kind IS NULL THEN
    RETURN QUERY SELECT 'NO_SOURCE'::text, v_draft.draft_revision;
    RETURN;
  END IF;
  IF p_draft_revision <> v_draft.draft_revision THEN
    RETURN QUERY SELECT 'STALE'::text, v_draft.draft_revision;
    RETURN;
  END IF;
  UPDATE public_compose_private.topic_drafts d SET source_acknowledged_revision = d.draft_revision
   WHERE d.id = p_draft_id AND d.source_acknowledged_revision IS DISTINCT FROM d.draft_revision;
  RETURN QUERY SELECT 'ACKNOWLEDGED'::text, v_draft.draft_revision;
END$$;

-- E.5 My draft's source REFERENCE (never a text), so the client restores the selection after leaving. Zero rows for
--     anything not mine.
CREATE FUNCTION public_compose_source_private.read_own_topic_source_v1(p_draft_id uuid)
RETURNS TABLE (draft_revision bigint, source_kind text, session_id uuid, first_sp integer, last_sp integer,
               include_qandeel boolean, excluded_sps integer[], emphasized_sps integer[], hypothesis_id uuid,
               hypothesis_version integer, acknowledged boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
BEGIN
  IF p_draft_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT d.draft_revision, d.source_kind, d.source_session_id, d.source_first_sp, d.source_last_sp,
           d.source_include_qandeel, d.source_excluded_sps, d.source_emphasized_sps, d.source_hypothesis_id,
           d.source_hypothesis_version, d.source_acknowledged_revision IS NOT DISTINCT FROM d.draft_revision
      FROM public_compose_private.topic_drafts d
     WHERE d.id = p_draft_id AND d.user_id = v_user;
END$$;

-- E.6 THE ITEMS OF MY TOPIC, one page of 50 (R1 §5.3 item 8): while EDITING, the dry run of the ONE projection (B.4)
--     the freeze would seal; once PREPARED, the sealed package itself, in its sealed order. The same item shape in both,
--     so what the author previews is what is prepared. outcome = RESOLVED | PREPARED | NO_SOURCE | a source refusal
--     (B.5; then no items). Zero rows for anything not mine.
CREATE FUNCTION public_compose_source_private.read_own_topic_items_v1(p_draft_id uuid, p_page integer)
RETURNS TABLE (draft_revision bigint, draft_state text, outcome text, item_count integer, text_bytes bigint,
               page integer, page_count integer, items jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_draft public_compose_private.topic_drafts;
  v_size integer := public_compose_source_private.page_size_v1();
  v_source record;
  v_manifest uuid;
  v_count integer;
  v_bytes bigint;
  v_items jsonb;
BEGIN
  IF p_draft_id IS NULL OR p_page IS NULL OR p_page < 1 OR p_page > 1000 THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT d.* INTO v_draft FROM public_compose_private.topic_drafts d WHERE d.id = p_draft_id AND d.user_id = v_user;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF v_draft.prepared_experience_id IS NOT NULL THEN
    SELECT v.package_manifest_version_id INTO v_manifest
      FROM public.public_experiences e
      JOIN public.public_experience_versions v ON v.id = e.current_experience_version_id
     WHERE e.id = v_draft.prepared_experience_id;
    SELECT count(*)::integer, coalesce(sum(octet_length(b.public_text_body)), 0)::bigint INTO v_count, v_bytes
      FROM public.publication_package_manifest_items it
      LEFT JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
     WHERE it.manifest_version_id = v_manifest;
    SELECT coalesce(jsonb_agg(x.item ORDER BY x.position), '[]'::jsonb) INTO v_items
      FROM (SELECT it.item_ordinal AS position,
                   jsonb_build_object('position', it.item_ordinal, 'role', coalesce(ip.item_role, 'WRITTEN'),
                                      'sessionPosition', ip.source_session_position, 'message', ip.message_ordinal,
                                      'emphasized', coalesce(ip.emphasized, false),
                                      'gapBefore', coalesce(ip.gap_before, false), 'text', b.public_text_body) AS item
              FROM public.publication_package_manifest_items it
              LEFT JOIN public_compose_source_private.item_presentation ip
                ON ip.manifest_version_id = it.manifest_version_id AND ip.package_item_id = it.package_item_id
              LEFT JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
             WHERE it.manifest_version_id = v_manifest
             ORDER BY it.item_ordinal
             OFFSET (p_page - 1) * v_size LIMIT v_size) x;
    RETURN QUERY SELECT v_draft.draft_revision, 'PREPARED'::text, 'PREPARED'::text, v_count, v_bytes, p_page,
                        ceil(v_count::numeric / v_size)::integer, v_items;
    RETURN;
  END IF;
  IF v_draft.source_kind IS NULL THEN
    RETURN QUERY SELECT v_draft.draft_revision, 'EDITING'::text, 'NO_SOURCE'::text, 0, 0::bigint, p_page, 0, '[]'::jsonb;
    RETURN;
  END IF;
  SELECT * INTO v_source FROM public_compose_source_private.draft_source_outcome_v1(v_user, v_draft);
  IF v_source.outcome <> 'RESOLVED' THEN
    RETURN QUERY SELECT v_draft.draft_revision, 'EDITING'::text, v_source.outcome, v_source.item_count,
                        v_source.text_bytes, p_page, 0, '[]'::jsonb;
    RETURN;
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('position', i.display_position, 'role', i.item_role,
                                               'sessionPosition', i.source_session_position, 'message', i.message_ordinal,
                                               'emphasized', i.emphasized, 'gapBefore', i.gap_before, 'text', i.body)
                            ORDER BY i.display_position), '[]'::jsonb) INTO v_items
    FROM (SELECT * FROM public_compose_source_private.draft_source_items_v1(v_user, v_draft) s
           ORDER BY s.display_position OFFSET (p_page - 1) * v_size LIMIT v_size) i;
  RETURN QUERY SELECT v_draft.draft_revision, 'EDITING'::text, 'RESOLVED'::text, v_source.item_count,
                      v_source.text_bytes, p_page, ceil(v_source.item_count::numeric / v_size)::integer, v_items;
END$$;

-- E.7 THE ITEMS OF A SERVED TOPIC, one page of 50, for an admitted viewer: only while the Experience is a served field
--     entry (the ONE 0145 visible-entry derivation), its text through the ONE canonical serving resolver (0095), in the
--     sealed order and with the sealed roles. A topic prepared before CP2 has no presentation: its items keep their
--     ordinal and their 0145 kind (SOURCE_CONTENT / ANALYSIS). Zero rows for anything not served. A reader is never told
--     where in the author's private conversation a message stood: the Session Position stays the author's (only the
--     message's ordinal within the topic and whether a gap precedes it are public).
CREATE FUNCTION public_compose_source_private.read_public_topic_items_v1(p_experience_id uuid, p_page integer)
RETURNS TABLE (item_count integer, page integer, page_count integer, items jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_viewer uuid;
  v_version uuid;
  v_size integer := public_compose_source_private.page_size_v1();
  v_count integer;
  v_items jsonb;
BEGIN
  IF p_experience_id IS NULL OR p_page IS NULL OR p_page < 1 OR p_page > 1000 THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_viewer := public_spatial_private.admitted_viewer_v1();
  IF v_viewer IS NULL THEN
    RETURN;
  END IF;
  SELECT ve.experience_version_id INTO v_version FROM public_spatial_private.derive_visible_spatial_entry_v1(p_experience_id) ve;
  IF v_version IS NULL THEN
    RETURN;
  END IF;
  WITH served AS MATERIALIZED (
    SELECT sv.* FROM public.resolve_public_experience_serving_v1(p_experience_id, v_viewer) sv
     WHERE sv.experience_version_id = v_version
  )
  SELECT (SELECT count(*)::integer FROM served),
         coalesce((SELECT jsonb_agg(x.item ORDER BY x.position)
                     FROM (SELECT s.item_ordinal AS position,
                                  jsonb_build_object('position', s.item_ordinal,
                                    'role', coalesce(ip.item_role, CASE s.derivative_classification
                                                                   WHEN 'ANALYTICAL_DERIVATIVE' THEN 'ANALYSIS'
                                                                   ELSE 'SOURCE_CONTENT' END),
                                    'message', ip.message_ordinal, 'emphasized', coalesce(ip.emphasized, false),
                                    'gapBefore', coalesce(ip.gap_before, false), 'text', s.public_text_body) AS item
                             FROM served s
                             LEFT JOIN public_compose_source_private.item_presentation ip
                               ON ip.package_item_id = s.package_item_id
                            ORDER BY s.item_ordinal
                            OFFSET (p_page - 1) * v_size LIMIT v_size) x), '[]'::jsonb)
    INTO v_count, v_items;
  IF v_count = 0 THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT v_count, p_page, ceil(v_count::numeric / v_size)::integer, v_items;
END$$;

-- =====================================================================================================================
-- F. THE PREVIEW AND SEARCH, forward-replaced.
-- =====================================================================================================================

-- F.1 PREVIEW (0179 D.6), forward-replaced: a draft without a source is previewed exactly as before. A sourced draft's
--     readiness is its own (B.6), then its source (B.5), then the acknowledgement; its privacy notes read every item the
--     topic would contain (A-3 6: the deterministic contact-data and self-identification warnings). Its items are read
--     page by page through E.6, from the same projection.
CREATE OR REPLACE FUNCTION public_compose_private.preview_own_topic_draft_v1(p_draft_id uuid)
RETURNS TABLE (draft_revision bigint, readiness text, title text, body text, section_key text, publisher_label_mode text,
               publisher_display_label text, privacy_notes text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_draft public_compose_private.topic_drafts;
  v_mode text;
  v_label text;
  v_name text;
  v_ready text;
  v_source record;
  v_text text;
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
  v_text := v_draft.title || E'\n' || v_draft.body;
  IF v_draft.source_kind IS NULL THEN
    v_ready := public_compose_private.draft_readiness_v1(v_draft.title, v_draft.body, v_draft.section_key);
  ELSE
    -- S8A-05 CP2 (0180).
    SELECT * INTO v_source FROM public_compose_source_private.draft_source_outcome_v1(v_user, v_draft);
    IF v_source.outcome = 'RESOLVED' THEN
      SELECT v_text || coalesce(E'\n' || string_agg(i.body, E'\n' ORDER BY i.display_position), '') INTO v_text
        FROM public_compose_source_private.draft_source_items_v1(v_user, v_draft) i WHERE i.item_role <> 'WRITTEN';
    END IF;
    v_ready := public_compose_source_private.sourced_readiness_v1(v_draft);
    IF v_ready = 'READY' THEN
      v_ready := CASE WHEN v_source.outcome <> 'RESOLVED' THEN v_source.outcome
                      WHEN v_source.qandeel_material
                       AND v_draft.source_acknowledged_revision IS DISTINCT FROM v_draft.draft_revision
                        THEN 'ACKNOWLEDGEMENT_REQUIRED'
                      ELSE 'READY' END;
    END IF;
  END IF;
  RETURN QUERY SELECT v_draft.draft_revision, v_ready,
                      public_compose_private.public_form_v1(v_draft.title),
                      public_compose_private.public_form_v1(v_draft.body),
                      v_draft.section_key, v_mode, v_label,
                      public_compose_private.privacy_notes_v1(v_text, v_name, v_mode);
END$$;

-- F.2 SEARCH over the field (0145 E.2), forward-replaced with ONE change: a sourced version is searched through its
--     stored bounded document (A.3) instead of an aggregate of every body; every other version exactly as before.
CREATE OR REPLACE FUNCTION public_spatial_private.search_public_semantic_field_v1(p_query text)
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
                 || ' ' || coalesce(
                   -- S8A-05 CP2 (0180): the bounded document of a sourced version.
                   (SELECT sd.document FROM public_compose_source_private.version_search_documents sd
                     WHERE sd.experience_version_id = ve.experience_version_id AND sd.document IS NOT NULL),
                   (SELECT string_agg(b.public_text_body, ' ' ORDER BY it.item_ordinal)
                      FROM public.publication_package_manifest_items it
                      JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
                     WHERE it.manifest_version_id = ve.manifest_version_id AND it.content_state = 'CONTENT_PRESENT'),
                   '')) AS document) d
     WHERE d.document @@ v_query
     ORDER BY ts_rank(d.document, v_query) DESC, ve.experience_id
     LIMIT 20;
END$$;

-- F.3 SEARCH INSIDE ONE SECTION (0179 E.3), forward-replaced with the same ONE change.
CREATE OR REPLACE FUNCTION public_compose_private.read_public_section_topic_matches_v1(p_query text, p_section_key text)
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
                 || coalesce(
                   -- S8A-05 CP2 (0180): the bounded document of a sourced version.
                   (SELECT sd.document FROM public_compose_source_private.version_search_documents sd
                     WHERE sd.experience_version_id = ve.experience_version_id AND sd.document IS NOT NULL),
                   (SELECT string_agg(b.public_text_body, ' ' ORDER BY it.item_ordinal)
                      FROM public.publication_package_manifest_items it
                      JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
                     WHERE it.manifest_version_id = ve.manifest_version_id AND it.content_state = 'CONTENT_PRESENT'),
                   '')) AS document) d
     WHERE d.document @@ v_query
     ORDER BY ts_rank(d.document, v_query) DESC, ve.experience_id
     LIMIT 20;
END$$;

-- =====================================================================================================================
-- G. BOUNDED INPUTS FOR LATER CHECKPOINTS (R1 §5.3 item 9). Deterministic, no model, executable by no application role.
--    Priority: the title, the written text, the Understanding summary, the emphasized messages, then the conversation
--    from both ends inward (first, last, second, second-to-last, ...). Whole items while they fit; the first that does
--    not is cut at a character boundary, and nothing after it is taken. The chosen items are given in display order.
-- =====================================================================================================================
CREATE FUNCTION public_compose_source_private.bounded_package_input_v1(p_manifest_version_id uuid, p_bytes integer)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_title text;
  v_positions integer[] := ARRAY[]::integer[];
  v_segments text[] := ARRAY[]::text[];
  v_out text[];
  v_used integer;
  v_cut boolean := false;
  r record;
BEGIN
  IF p_manifest_version_id IS NULL OR p_bytes IS NULL OR p_bytes < 1 THEN
    RAISE EXCEPTION 'PUBLIC_COMPOSE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT t.title INTO v_title
    FROM public.public_experience_versions v
    JOIN public_compose_private.version_titles t ON t.experience_version_id = v.id AND t.title IS NOT NULL
   WHERE v.package_manifest_version_id = p_manifest_version_id;
  v_title := public_compose_source_private.bounded_text_v1('TITLE: ' || coalesce(v_title, ''), p_bytes);
  v_used := octet_length(v_title);
  FOR r IN
    WITH items AS (
      SELECT ip.display_position AS position, ip.item_role, ip.emphasized,
             CASE ip.item_role WHEN 'WRITTEN' THEN 'AUTHOR_TEXT' WHEN 'YOUR_MESSAGE' THEN 'AUTHOR'
                               WHEN 'QANDEEL_REPLY' THEN 'QANDEEL' ELSE 'QANDEEL_UNDERSTANDING' END
               || CASE WHEN ip.emphasized THEN ' [EMPHASIZED]' ELSE '' END || ': ' || b.public_text_body AS segment
        FROM public_compose_source_private.item_presentation ip
        JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = ip.package_item_id
       WHERE ip.manifest_version_id = p_manifest_version_id
    ), ranked AS (
      SELECT i.*, row_number() OVER (PARTITION BY (i.item_role IN ('YOUR_MESSAGE', 'QANDEEL_REPLY') AND NOT i.emphasized)
                                     ORDER BY i.position) AS asc_rank,
                  row_number() OVER (PARTITION BY (i.item_role IN ('YOUR_MESSAGE', 'QANDEEL_REPLY') AND NOT i.emphasized)
                                     ORDER BY i.position DESC) AS desc_rank
        FROM items i
    )
    SELECT r2.position, r2.segment FROM ranked r2
     ORDER BY CASE WHEN r2.item_role = 'WRITTEN' THEN 1 WHEN r2.item_role = 'QANDEEL_UNDERSTANDING' THEN 2
                   WHEN r2.emphasized THEN 3 ELSE 4 END,
              CASE WHEN r2.item_role IN ('YOUR_MESSAGE', 'QANDEEL_REPLY') AND NOT r2.emphasized
                   THEN least(r2.asc_rank, r2.desc_rank) * 2 + CASE WHEN r2.asc_rank <= r2.desc_rank THEN 0 ELSE 1 END
                   ELSE r2.position END,
              r2.position
  LOOP
    EXIT WHEN v_cut OR v_used + 1 >= p_bytes;
    IF v_used + 1 + octet_length(r.segment) <= p_bytes THEN
      v_positions := v_positions || r.position;
      v_segments := v_segments || r.segment;
      v_used := v_used + 1 + octet_length(r.segment);
    ELSE
      v_positions := v_positions || r.position;
      v_segments := v_segments || public_compose_source_private.bounded_text_v1(r.segment, p_bytes - v_used - 1);
      v_cut := true;
    END IF;
  END LOOP;
  SELECT array_agg(c.segment ORDER BY c.position) INTO v_out
    FROM unnest(v_positions, v_segments) AS c(position, segment);
  RETURN v_title || coalesce(E'\n' || array_to_string(v_out, E'\n'), '');
END$$;

-- G.1 The CP3 interpreter input (≤ 24 KB) and the CP4 @qandeel topic context (≤ 6 KB) of one prepared package.
CREATE FUNCTION public_compose_source_private.interpreter_input_v1(p_manifest_version_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public_compose_source_private.bounded_package_input_v1(p_manifest_version_id,
                                                                public_compose_source_private.interpreter_input_bytes_v1());
$$;
CREATE FUNCTION public_compose_source_private.qandeel_context_v1(p_manifest_version_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public_compose_source_private.bounded_package_input_v1(p_manifest_version_id,
                                                                public_compose_source_private.qandeel_context_bytes_v1());
$$;

-- =====================================================================================================================
-- H. THE EXPOSED WRAPPERS: SECURITY INVOKER, each a one-line call into its definer.
-- =====================================================================================================================
CREATE FUNCTION public.set_own_topic_conversation_source_v1(
  p_draft_id uuid, p_expected_revision bigint, p_session_id uuid, p_first_sp integer, p_last_sp integer,
  p_include_qandeel boolean, p_excluded_sps integer[], p_emphasized_sps integer[]
) RETURNS TABLE (outcome text, draft_revision bigint)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_source_private.set_own_topic_conversation_source_v1(p_draft_id, p_expected_revision,
    p_session_id, p_first_sp, p_last_sp, p_include_qandeel, p_excluded_sps, p_emphasized_sps);
$$;
CREATE FUNCTION public.set_own_topic_understanding_source_v1(
  p_draft_id uuid, p_expected_revision bigint, p_hypothesis_id uuid, p_hypothesis_version integer
) RETURNS TABLE (outcome text, draft_revision bigint)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_source_private.set_own_topic_understanding_source_v1(p_draft_id, p_expected_revision,
    p_hypothesis_id, p_hypothesis_version);
$$;
CREATE FUNCTION public.clear_own_topic_source_v1(p_draft_id uuid, p_expected_revision bigint)
RETURNS TABLE (outcome text, draft_revision bigint)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_source_private.clear_own_topic_source_v1(p_draft_id, p_expected_revision);
$$;
CREATE FUNCTION public.acknowledge_own_topic_source_v1(p_draft_id uuid, p_draft_revision bigint)
RETURNS TABLE (outcome text, draft_revision bigint)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_source_private.acknowledge_own_topic_source_v1(p_draft_id, p_draft_revision);
$$;
CREATE FUNCTION public.read_own_topic_source_v1(p_draft_id uuid)
RETURNS TABLE (draft_revision bigint, source_kind text, session_id uuid, first_sp integer, last_sp integer,
               include_qandeel boolean, excluded_sps integer[], emphasized_sps integer[], hypothesis_id uuid,
               hypothesis_version integer, acknowledged boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_source_private.read_own_topic_source_v1(p_draft_id);
$$;
CREATE FUNCTION public.read_own_topic_items_v1(p_draft_id uuid, p_page integer)
RETURNS TABLE (draft_revision bigint, draft_state text, outcome text, item_count integer, text_bytes bigint,
               page integer, page_count integer, items jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_source_private.read_own_topic_items_v1(p_draft_id, p_page);
$$;
CREATE FUNCTION public.read_public_topic_items_v1(p_experience_id uuid, p_page integer)
RETURNS TABLE (item_count integer, page integer, page_count integer, items jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public_compose_source_private.read_public_topic_items_v1(p_experience_id, p_page);
$$;

-- =====================================================================================================================
-- I. EXPORT MY DATA (0179 body re-stated with ONE change: each draft in `publicTopicDrafts` gains its `source`).
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
                       'lastChangedAt', d.updated_at,
                       -- S8A-05 CP2 (0180): the draft's source as a REFERENCE only, never a copied text.
                       'source', CASE d.source_kind
                         WHEN 'CONVERSATION' THEN jsonb_build_object(
                           'kind', 'conversation',
                           'conversationStartedAt', (SELECT s.created_at FROM public.conversation_sessions s
                                                      WHERE s.id = d.source_session_id AND s.user_id = p_subject),
                           'firstPosition', d.source_first_sp,
                           'lastPosition', d.source_last_sp,
                           'includesQandeelReplies', d.source_include_qandeel,
                           'excludedMessagePositions', to_jsonb(d.source_excluded_sps),
                           'emphasizedMessagePositions', to_jsonb(d.source_emphasized_sps))
                         WHEN 'UNDERSTANDING' THEN jsonb_build_object(
                           'kind', 'qandeel understanding',
                           'understandingVersion', d.source_hypothesis_version)
                         END)
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
-- J. PRIVILEGES. Ownership; default-deny by name; then the exact grants. Nothing relies on a default (0133).
--    The forward-replaced functions (the freeze, the preview, the section search, the field search, the discard mover,
--    the package guard and the authority derivation) keep their ACLs: CREATE OR REPLACE preserves them.
-- =====================================================================================================================
DO $$
DECLARE
  v_fn text;
  v_rel text;
  v_commands text[] := ARRAY[
    'public_compose_source_private.set_own_topic_conversation_source_v1(uuid, bigint, uuid, integer, integer, boolean, integer[], integer[])',
    'public_compose_source_private.set_own_topic_understanding_source_v1(uuid, bigint, uuid, integer)',
    'public_compose_source_private.clear_own_topic_source_v1(uuid, bigint)',
    'public_compose_source_private.acknowledge_own_topic_source_v1(uuid, bigint)',
    'public_compose_source_private.read_own_topic_source_v1(uuid)',
    'public_compose_source_private.read_own_topic_items_v1(uuid, integer)',
    'public_compose_source_private.read_public_topic_items_v1(uuid, integer)',
    'public.set_own_topic_conversation_source_v1(uuid, bigint, uuid, integer, integer, boolean, integer[], integer[])',
    'public.set_own_topic_understanding_source_v1(uuid, bigint, uuid, integer)',
    'public.clear_own_topic_source_v1(uuid, bigint)',
    'public.acknowledge_own_topic_source_v1(uuid, bigint)',
    'public.read_own_topic_source_v1(uuid)',
    'public.read_own_topic_items_v1(uuid, integer)',
    'public.read_public_topic_items_v1(uuid, integer)'];
  v_internal text[] := ARRAY[
    'public_compose_source_private.reject_presentation_mutation_v1()',
    'public_compose_source_private.reject_search_document_mutation_v1()',
    'public_compose_source_private.envelope_units_v1()',
    'public_compose_source_private.envelope_bytes_v1()',
    'public_compose_source_private.page_size_v1()',
    'public_compose_source_private.search_document_bytes_v1()',
    'public_compose_source_private.interpreter_input_bytes_v1()',
    'public_compose_source_private.qandeel_context_bytes_v1()',
    'public_compose_source_private.bounded_text_v1(text, integer)',
    'public_compose_source_private.understanding_state_v1(uuid, uuid, integer)',
    'public_compose_source_private.draft_source_items_v1(uuid, public_compose_private.topic_drafts)',
    'public_compose_source_private.draft_source_outcome_v1(uuid, public_compose_private.topic_drafts)',
    'public_compose_source_private.sourced_readiness_v1(public_compose_private.topic_drafts)',
    'public_compose_source_private.prepare_sourced_package_v1(uuid, uuid, uuid, uuid, uuid, public_compose_private.topic_drafts, text, integer)',
    'public_compose_source_private.bounded_package_input_v1(uuid, integer)',
    'public_compose_source_private.interpreter_input_v1(uuid)',
    'public_compose_source_private.qandeel_context_v1(uuid)'];
BEGIN
  FOREACH v_fn IN ARRAY v_commands || v_internal LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', v_fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', v_fn);
    END IF;
  END LOOP;
  FOREACH v_rel IN ARRAY ARRAY['public_compose_source_private.item_presentation',
                               'public_compose_source_private.version_search_documents'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', v_rel);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_rel);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', v_rel);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM service_role', v_rel);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    -- The server channel holds nothing here: every act is the human's own, under the human's own token.
    EXECUTE 'REVOKE ALL ON SCHEMA public_compose_source_private FROM service_role';
  END IF;
  EXECUTE 'GRANT USAGE ON SCHEMA public_compose_source_private TO authenticated';
  FOREACH v_fn IN ARRAY v_commands LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_fn);
  END LOOP;
END$$;

-- =====================================================================================================================
-- K. DEPLOY-TIME SELF-ASSERTIONS: the boundary is what this file says, or the migration fails.
-- =====================================================================================================================
DO $$
DECLARE
  v_writers integer;
  v_src text;
  p record;
BEGIN
  -- K1. THE FREEZE IS STILL CLOSED: the 0179 clearance seam answers NOT_EVALUATED, and the freeze asks it first.
  IF public_compose_private.resolve_topic_freeze_clearance_v1() IS DISTINCT FROM 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'S8A-05 CP2: the topic freeze clearance seam must answer NOT_EVALUATED';
  END IF;
  SELECT pr.prosrc INTO v_src FROM pg_proc pr
   WHERE pr.oid = 'public_compose_private.freeze_own_topic_draft_v1(uuid, uuid, bigint)'::regprocedure;
  IF position('resolve_topic_freeze_clearance_v1()' IN v_src) = 0
     OR position('resolve_topic_freeze_clearance_v1()' IN v_src) > position('FOR UPDATE' IN v_src)
     OR position('resolve_topic_freeze_clearance_v1()' IN v_src) > position('draft_source_outcome_v1' IN v_src) THEN
    RAISE EXCEPTION 'S8A-05 CP2: the freeze must ask the clearance seam before it locks or reads anything';
  END IF;
  -- K2. Still exactly FIVE functions move a Public Experience lifecycle (QAN-CW-REM-03 as 0179 re-counted it).
  SELECT count(*)::integer INTO v_writers
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
     AND (pr.prosrc ~ 'UPDATE public\.public_experiences e\s+SET current_lifecycle = '''
       OR pr.prosrc ~ 'INSERT INTO public\.public_experiences\s+\(id, public_world_singleton');
  IF v_writers <> 5 THEN
    RAISE EXCEPTION 'S8A-05 CP2: exactly five functions may move a Public Experience lifecycle, found %', v_writers;
  END IF;
  -- K3. Nothing CP2 owns reaches publication, the CW2-08 seam, placement, a semantic request or a model.
  FOR p IN SELECT n.nspname || '.' || pr.proname AS fn, pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname IN ('public_compose_source_private', 'public_compose_private') LOOP
    IF p.prosrc ~ '(publish_public_experience_v1|resolve_public_publication_prerequisites_v1|commit_public_spatial_placement_v1|request_own_public_spatial_placement_v1|request_own_public_semantic_proposal_v1|''PUBLISHED'')' THEN
      RAISE EXCEPTION 'S8A-05 CP2: % reaches publication, the CW2-08 seam or placement', p.fn;
    END IF;
  END LOOP;
  -- K4. No application role executes the package preparation, the bounded model inputs or any internal helper.
  FOR p IN SELECT unnest(ARRAY[
             'public_compose_source_private.prepare_sourced_package_v1(uuid, uuid, uuid, uuid, uuid, public_compose_private.topic_drafts, text, integer)',
             'public_compose_source_private.draft_source_items_v1(uuid, public_compose_private.topic_drafts)',
             'public_compose_source_private.draft_source_outcome_v1(uuid, public_compose_private.topic_drafts)',
             'public_compose_source_private.understanding_state_v1(uuid, uuid, integer)',
             'public_compose_source_private.bounded_package_input_v1(uuid, integer)',
             'public_compose_source_private.interpreter_input_v1(uuid)',
             'public_compose_source_private.qandeel_context_v1(uuid)',
             'public_compose_private.resolve_topic_freeze_clearance_v1()',
             'public.discard_never_published_public_experience_v1(uuid, uuid)']) AS fn LOOP
    IF has_function_privilege('public', p.fn, 'EXECUTE')
       OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND has_function_privilege('anon', p.fn, 'EXECUTE'))
       OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AND has_function_privilege('authenticated', p.fn, 'EXECUTE'))
       OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AND has_function_privilege('service_role', p.fn, 'EXECUTE')) THEN
      RAISE EXCEPTION 'S8A-05 CP2: an application role executes %', p.fn;
    END IF;
  END LOOP;
  -- K5. The declared limits are the ones the record states.
  IF public_compose_source_private.envelope_units_v1() <> 10000
     OR public_compose_source_private.envelope_bytes_v1() <> 8388608
     OR public_compose_source_private.page_size_v1() <> 50
     OR public_compose_source_private.search_document_bytes_v1() <> 8192
     OR public_compose_source_private.interpreter_input_bytes_v1() <> 24576
     OR public_compose_source_private.qandeel_context_bytes_v1() <> 6144 THEN
    RAISE EXCEPTION 'S8A-05 CP2: a declared limit differs from the record';
  END IF;
END$$;

COMMIT;
