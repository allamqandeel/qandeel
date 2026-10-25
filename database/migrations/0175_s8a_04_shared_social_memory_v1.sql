-- S8A-04 CP2 — Shared Social Memory, Recall & Living Analysis (QANDEEL_S8A-04_CP2_SHARED_SOCIAL_MEMORY_CONTROLLED_AMENDMENT
-- v1.0, design and Copy Gate approved by the Product Owner, 2026-10-24).
--
-- Forward-only and additive over SHARED-VIS-01 (0148). Migrations 0001–0174 are byte-unchanged. Five existing function
-- bodies are replaced forward (CREATE OR REPLACE, same signature, owner, posture and grants), each with exactly one
-- change, named where it is made: the active and the closed Shared conversation reads, the Public authoring source list
-- and package preparation, and the Replay capture. Nothing else that exists is redefined.
--
-- ## What a saved position is (amendment §2)
--
-- A 0148 Shared semantic place plus its attribution, written in ONE transaction by ONE function:
--   * `semantic_place_attributions` — nature (VIEW | CLAIM; there is no "fact" state), the absent holder's label (text
--     only, never an identity), hedged, and standing (CURRENT → SUPERSEDED, one way, only through a revision);
--   * `semantic_place_people` — the trusted `user_id`s of the World's members who hold, relayed, or are the subject of it;
--   * `semantic_place_revisions` — the later position that replaced or withdrew an earlier one (at most one successor).
-- Speaker tokens and per-reading labels are never stored: the API maps them to `user_id` before the write, and the write
-- refuses a meaning that contains a label the server sent in that reading (an exact match against the server's own list).
--
-- The server re-checks at the write what it can see (§2.2): every person is a member of this World; every holder is the
-- 0089 author of a cited source unless relayers are given, and every relayer is; an absent holder always has its relayer;
-- `revises` names a CURRENT V2 place of this World with no successor that shares a holder (or, for two absent-held
-- positions, a relayer). Anything else refuses the place before anything is written. A deferred constraint trigger refuses,
-- at commit, any V2 place without its attribution, and any attribution whose people break the holder / relayer rule.
--
-- Deletion stays the frozen 0090 closure: a deleted source removes the place's body, and ON DELETE CASCADE removes the place,
-- its attribution, its people and its revision edges in the same statement. An earlier position stays SUPERSEDED when its
-- successor is erased: it is history, never anyone's current position again, and nothing is inferred about what they hold
-- now. Keeping that word holds no content of the deleted message.
--
-- ## Display safety (§2.5, §11 condition 9)
--
-- The bare meaning is never served to a person. `safe_meaning_v1` composes the approved frame (P1–P6) around it in SQL,
-- with the reader's own authorized Names at read time (the existing `shared_person_name_v1`); nothing of the composition is
-- stored. Every function a person's token can execute serves either that composition or no analysis at all: the member
-- reads move to v2 (their v1 are revoked), and the conversation reads, Public authoring and Replay capture exclude it. The
-- bare body stays inside `service_role` reads (the reading context, the knowledge read), which never reach a person.
--
-- ## Accounting (§5)
--
-- `ai_provider_calls` gains `source_world_id` + `source_shared_material_id` (content-free ids, no foreign key, both or
-- neither, never with a Personal session or turn), one begin command that verifies the message is a HUMAN_TEXT of that World
-- whose author is the payer before any call, and two families: SHARED_KNOWLEDGE_RECALL and SHARED_SPATIAL_PLACEMENT.
--
-- No hosted application is authorized by this file: it is applied to the local verification database only until a
-- separate authorization says otherwise.

BEGIN;

-- =====================================================================================================================
-- A. THE 0148 CONTRACT COLUMNS ACCEPT V2 (§2.4). A V1 place keeps its V1 pair; a V2 place is V2 on both.
-- =====================================================================================================================
ALTER TABLE shared_semantic_private.semantic_places
  DROP CONSTRAINT semantic_places_interpretation_check,
  ADD CONSTRAINT semantic_places_interpretation_check
      CHECK (interpretation_contract IN ('SHARED_SEMANTIC_INTERPRETATION_V1', 'SHARED_SEMANTIC_INTERPRETATION_V2')),
  DROP CONSTRAINT semantic_places_spatial_check,
  ADD CONSTRAINT semantic_places_spatial_check
      CHECK (spatial_contract IN ('SHARED_SPATIAL_PLACEMENT_V1', 'SHARED_SPATIAL_PLACEMENT_V2')),
  ADD CONSTRAINT semantic_places_contract_pair_check
      CHECK ((interpretation_contract = 'SHARED_SEMANTIC_INTERPRETATION_V2') = (spatial_contract = 'SHARED_SPATIAL_PLACEMENT_V2')),
  ADD CONSTRAINT semantic_places_world_key UNIQUE (material_id, world_id);

-- =====================================================================================================================
-- B. THE ATTRIBUTION RELATIONS (§2.1). No account foreign key (the 0148 rule): a person is a trusted member `user_id`,
--    checked against this World's membership at the write. They live exactly as long as their place.
-- =====================================================================================================================
CREATE TABLE shared_semantic_private.semantic_place_attributions (
    material_id uuid NOT NULL,
    world_id uuid NOT NULL,
    nature text NOT NULL,
    absent_holder_label text,
    hedged boolean NOT NULL,
    standing text NOT NULL,
    CONSTRAINT semantic_place_attributions_pk PRIMARY KEY (material_id),
    CONSTRAINT semantic_place_attributions_world_key UNIQUE (material_id, world_id),
    CONSTRAINT semantic_place_attributions_place_fk
        FOREIGN KEY (material_id, world_id) REFERENCES shared_semantic_private.semantic_places (material_id, world_id) ON DELETE CASCADE,
    CONSTRAINT semantic_place_attributions_nature_check CHECK (nature IN ('VIEW', 'CLAIM')),
    CONSTRAINT semantic_place_attributions_absent_check
        CHECK (absent_holder_label IS NULL OR shared_semantic_private.is_semantic_text_v1(absent_holder_label, 60)),
    CONSTRAINT semantic_place_attributions_standing_check CHECK (standing IN ('CURRENT', 'SUPERSEDED'))
);

CREATE TABLE shared_semantic_private.semantic_place_people (
    material_id uuid NOT NULL,
    world_id uuid NOT NULL,
    person_role text NOT NULL,
    user_id uuid NOT NULL,
    CONSTRAINT semantic_place_people_pk PRIMARY KEY (material_id, person_role, user_id),
    CONSTRAINT semantic_place_people_attribution_fk
        FOREIGN KEY (material_id, world_id) REFERENCES shared_semantic_private.semantic_place_attributions (material_id, world_id) ON DELETE CASCADE,
    CONSTRAINT semantic_place_people_role_check CHECK (person_role IN ('HOLDER', 'RELAYER', 'ABOUT'))
);
CREATE INDEX semantic_place_people_world_user_idx ON shared_semantic_private.semantic_place_people (world_id, user_id);

CREATE TABLE shared_semantic_private.semantic_place_revisions (
    earlier_material_id uuid NOT NULL,
    later_material_id uuid NOT NULL,
    world_id uuid NOT NULL,
    -- Each position has at most one successor, and each later position revises at most one earlier one.
    CONSTRAINT semantic_place_revisions_pk PRIMARY KEY (earlier_material_id),
    CONSTRAINT semantic_place_revisions_later_key UNIQUE (later_material_id),
    CONSTRAINT semantic_place_revisions_distinct_check CHECK (earlier_material_id <> later_material_id),
    CONSTRAINT semantic_place_revisions_earlier_fk
        FOREIGN KEY (earlier_material_id, world_id) REFERENCES shared_semantic_private.semantic_place_attributions (material_id, world_id) ON DELETE CASCADE,
    CONSTRAINT semantic_place_revisions_later_fk
        FOREIGN KEY (later_material_id, world_id) REFERENCES shared_semantic_private.semantic_place_attributions (material_id, world_id) ON DELETE CASCADE
);

COMMENT ON TABLE shared_semantic_private.semantic_place_attributions IS
  'S8A-04 CP2: whose a Shared semantic place is — VIEW or CLAIM (never a fact), the absent holder''s label (text, never an '
  'identity), whether it was left uncertain, and CURRENT / SUPERSEDED. Written with its place in one transaction; removed '
  'only with it.';

-- B.1 The attribution is history: written once with its place; standing moves CURRENT → SUPERSEDED once, through a revision;
--     every row leaves only with its place (the cascade of the frozen closure).
CREATE FUNCTION shared_semantic_private.guard_semantic_attribution_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'semantic_place_attributions' THEN
    IF TG_OP = 'INSERT' AND NEW.standing = 'CURRENT'
       AND EXISTS (SELECT 1 FROM shared_semantic_private.semantic_places p
                    WHERE p.material_id = NEW.material_id AND p.world_id = NEW.world_id
                      AND p.interpretation_contract = 'SHARED_SEMANTIC_INTERPRETATION_V2') THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.standing = 'CURRENT' AND NEW.standing = 'SUPERSEDED'
       AND (NEW.material_id, NEW.world_id, NEW.nature, NEW.absent_holder_label, NEW.hedged)
           IS NOT DISTINCT FROM (OLD.material_id, OLD.world_id, OLD.nature, OLD.absent_holder_label, OLD.hedged)
       AND EXISTS (SELECT 1 FROM shared_semantic_private.semantic_place_revisions r WHERE r.earlier_material_id = OLD.material_id) THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM shared_semantic_private.semantic_places p WHERE p.material_id = OLD.material_id) THEN
      RETURN OLD;
    END IF;
  ELSIF TG_TABLE_NAME = 'semantic_place_people' THEN
    IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM shared_semantic_private.semantic_place_attributions a
                                     WHERE a.material_id = NEW.material_id AND a.world_id = NEW.world_id) THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM shared_semantic_private.semantic_place_attributions a WHERE a.material_id = OLD.material_id) THEN
      RETURN OLD;
    END IF;
  ELSIF TG_TABLE_NAME = 'semantic_place_revisions' THEN
    IF TG_OP = 'INSERT' THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' AND (NOT EXISTS (SELECT 1 FROM shared_semantic_private.semantic_place_attributions a WHERE a.material_id = OLD.earlier_material_id)
                             OR NOT EXISTS (SELECT 1 FROM shared_semantic_private.semantic_place_attributions a WHERE a.material_id = OLD.later_material_id)) THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'SHARED_SEMANTIC_HISTORY_IS_IMMUTABLE'
    USING ERRCODE = '55000',
          DETAIL = 'A saved position''s attribution is written once with its place; only a revision supersedes it, and it '
                   'leaves only with its place.';
END$$;

CREATE TRIGGER semantic_place_attributions_immutable BEFORE INSERT OR UPDATE OR DELETE ON shared_semantic_private.semantic_place_attributions
    FOR EACH ROW EXECUTE FUNCTION shared_semantic_private.guard_semantic_attribution_v1();
CREATE TRIGGER semantic_place_people_immutable BEFORE INSERT OR UPDATE OR DELETE ON shared_semantic_private.semantic_place_people
    FOR EACH ROW EXECUTE FUNCTION shared_semantic_private.guard_semantic_attribution_v1();
CREATE TRIGGER semantic_place_revisions_immutable BEFORE INSERT OR UPDATE OR DELETE ON shared_semantic_private.semantic_place_revisions
    FOR EACH ROW EXECUTE FUNCTION shared_semantic_private.guard_semantic_attribution_v1();

-- B.2 Refused at commit (§2.3): a V2 place without its attribution, or an attribution whose people break the holder rule
--     (holders XOR an absent holder; an absent holder always with a relayer; nobody both holder and relayer).
CREATE FUNCTION shared_semantic_private.require_semantic_attribution_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid := NEW.material_id;
  a shared_semantic_private.semantic_place_attributions;
  v_holders integer;
  v_relayers integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM shared_semantic_private.semantic_places p
                  WHERE p.material_id = v_id AND p.interpretation_contract = 'SHARED_SEMANTIC_INTERPRETATION_V2') THEN
    RETURN NULL;
  END IF;
  SELECT * INTO a FROM shared_semantic_private.semantic_place_attributions x WHERE x.material_id = v_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_ATTRIBUTION_REQUIRED' USING ERRCODE = '23514',
      DETAIL = 'A V2 Shared semantic place is committed only together with its attribution.';
  END IF;
  SELECT count(*) FILTER (WHERE pp.person_role = 'HOLDER'), count(*) FILTER (WHERE pp.person_role = 'RELAYER')
    INTO v_holders, v_relayers FROM shared_semantic_private.semantic_place_people pp WHERE pp.material_id = v_id;
  IF (v_holders > 0) = (a.absent_holder_label IS NOT NULL)
     OR (a.absent_holder_label IS NOT NULL AND v_relayers = 0)
     OR EXISTS (SELECT 1 FROM shared_semantic_private.semantic_place_people h JOIN shared_semantic_private.semantic_place_people r
                  ON r.material_id = h.material_id AND r.user_id = h.user_id AND r.person_role = 'RELAYER'
                 WHERE h.material_id = v_id AND h.person_role = 'HOLDER') THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_ATTRIBUTION_REQUIRED' USING ERRCODE = '23514',
      DETAIL = 'A saved position has member holders or an absent holder with its relayer, never both and never neither.';
  END IF;
  RETURN NULL;
END$$;

CREATE CONSTRAINT TRIGGER semantic_places_attribution_required AFTER INSERT ON shared_semantic_private.semantic_places
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shared_semantic_private.require_semantic_attribution_v1();
CREATE CONSTRAINT TRIGGER semantic_place_attributions_people_required AFTER INSERT ON shared_semantic_private.semantic_place_attributions
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shared_semantic_private.require_semantic_attribution_v1();

ALTER TABLE shared_semantic_private.semantic_place_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_semantic_private.semantic_place_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_semantic_private.semantic_place_revisions ENABLE ROW LEVEL SECURITY;

-- =====================================================================================================================
-- C. THE SAFE REPRESENTATION (§2.5; the Copy Gate's P1–P6, APPROVED verbatim). Executable by no application role.
-- =====================================================================================================================

-- C.1 Several Names: « و» in Arabic; ", " and " and " in English.
CREATE FUNCTION shared_semantic_private.join_names_v1(p_names text[], p_locale text)
RETURNS text
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN coalesce(cardinality(p_names), 0) = 0 THEN NULL
    WHEN p_locale = 'en' AND cardinality(p_names) > 1
      THEN array_to_string(p_names[1:cardinality(p_names) - 1], ', ') || ' and ' || p_names[cardinality(p_names)]
    WHEN p_locale = 'en' THEN p_names[1]
    ELSE array_to_string(p_names, ' و')
  END;
$$;

-- C.2 The reader's authorized Names of one place's people in one role, in a stable order; NULL when any of them has none
--     (a place whose attribution cannot be shown whole is not shown).
CREATE FUNCTION shared_semantic_private.place_people_names_v1(p_place_id uuid, p_role text, p_reader uuid)
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_names text[];
  v_missing boolean;
BEGIN
  SELECT coalesce(array_agg(x.name ORDER BY x.name COLLATE "C", x.user_id), ARRAY[]::text[]), coalesce(bool_or(x.name IS NULL), false)
    INTO v_names, v_missing
    FROM (SELECT pp.user_id, shared_private.shared_person_name_v1(pp.world_id, pp.user_id, p_reader) AS name
            FROM shared_semantic_private.semantic_place_people pp
           WHERE pp.material_id = p_place_id AND pp.person_role = p_role) x;
  IF v_missing OR EXISTS (SELECT 1 FROM unnest(v_names) n WHERE btrim(n) = '') THEN
    RETURN NULL;
  END IF;
  RETURN v_names;
END$$;

-- C.3 THE COMPOSER. The frame first (P1–P4), so a label that truncates the text keeps it; P5 when hedged; P6 when earlier.
--     NULL when the place has no attribution or a Name is missing: such a place is never served.
CREATE FUNCTION shared_semantic_private.safe_meaning_v1(p_place_id uuid, p_reader uuid, p_locale text)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_locale text := coalesce(p_locale, 'ar');
  a record;
  v_holders text[];
  v_relayers text[];
  v_holder text;
  v_relayer text;
  v_text text;
BEGIN
  IF p_place_id IS NULL OR p_reader IS NULL OR v_locale NOT IN ('ar', 'en') THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT at.nature, at.absent_holder_label, at.hedged, at.standing, b.body_text INTO a
    FROM shared_semantic_private.semantic_place_attributions at
    JOIN shared_semantic_private.semantic_places p ON p.material_id = at.material_id
    JOIN public.shared_world_text_material_bodies b ON b.material_id = at.material_id
   WHERE at.material_id = p_place_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_holders := shared_semantic_private.place_people_names_v1(p_place_id, 'HOLDER', p_reader);
  v_relayers := shared_semantic_private.place_people_names_v1(p_place_id, 'RELAYER', p_reader);
  IF v_holders IS NULL OR v_relayers IS NULL THEN
    RETURN NULL;
  END IF;
  v_holder := coalesce(shared_semantic_private.join_names_v1(v_holders, v_locale), a.absent_holder_label);
  v_relayer := shared_semantic_private.join_names_v1(v_relayers, v_locale);
  IF v_holder IS NULL THEN
    RETURN NULL;
  END IF;
  v_text := CASE
    WHEN a.nature = 'VIEW' AND v_relayer IS NULL AND v_locale = 'en' THEN v_holder || '''s view: '
    WHEN a.nature = 'VIEW' AND v_relayer IS NULL THEN 'رأي ' || v_holder || ': '
    WHEN a.nature = 'VIEW' AND v_locale = 'en' THEN v_holder || '''s view, as relayed by ' || v_relayer || ': '
    WHEN a.nature = 'VIEW' THEN 'رأي ' || v_holder || '، كما نقله ' || v_relayer || ': '
    WHEN v_relayer IS NULL AND v_locale = 'en' THEN 'According to ' || v_holder || ': '
    WHEN v_relayer IS NULL THEN 'بحسب ' || v_holder || ': '
    WHEN v_locale = 'en' THEN 'As relayed by ' || v_relayer || ' from ' || v_holder || ': '
    ELSE 'بحسب ما نقله ' || v_relayer || ' عن ' || v_holder || ': '
  END || a.body_text;
  IF a.hedged THEN
    v_text := v_text || CASE WHEN v_locale = 'en' THEN ' (unconfirmed)' ELSE ' (غير مؤكد)' END;
  END IF;
  IF a.standing = 'SUPERSEDED' THEN
    v_text := CASE WHEN v_locale = 'en' THEN 'Earlier — ' ELSE 'سابقًا — ' END || v_text;
  END IF;
  RETURN v_text;
END$$;

-- C.4 THE ONE V2 VISIBILITY DERIVATION: the 0148 rule (the frozen resolver serves the reader the meaning and every
--     source), restricted to places that carry their attribution (an inner join: a place without it is never served).
CREATE FUNCTION shared_semantic_private.visible_places_v2(p_world_id uuid, p_user uuid)
RETURNS TABLE (material_id uuid, established_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
    SELECT v.material_id, v.established_at
      FROM shared_semantic_private.visible_places_v1(p_world_id, p_user) v
      JOIN shared_semantic_private.semantic_place_attributions a ON a.material_id = v.material_id AND a.world_id = p_world_id;
END$$;

-- =====================================================================================================================
-- D. THE SERVER'S ACTS (service_role only).
-- =====================================================================================================================

-- D.1 Complete ONE saved position under the pass lease (§2.3): the frozen 0090 core commit, the place, its attribution,
--     its people, its revision edge and the earlier position's CURRENT → SUPERSEDED, all or nothing.
--     Outcomes: MATERIAL_COMMITTED (now, or already under this pass and ordinal) | STALE | UNAVAILABLE (as v1) |
--     ATTRIBUTION_REFUSED (a §2.2 check this World's state refuses; nothing is written). A malformed command is 22023.
CREATE FUNCTION shared_semantic_private.complete_shared_semantic_place_v2(
  p_lease_id uuid, p_pass_command_id uuid, p_place_ordinal integer, p_world_id uuid, p_meaning text,
  p_effective_context_ref text, p_output_digest text, p_source_disclosure_gate_ref text,
  p_authority_revalidation_ref text, p_readiness_ref text, p_audience_snapshot_ref text,
  p_material_source_ids uuid[], p_primary_themes text[], p_secondary_themes text[], p_semantic_region text,
  p_world_x bigint, p_world_y bigint, p_nature text, p_holder_user_ids uuid[], p_absent_holder_label text,
  p_relayer_user_ids uuid[], p_about_user_ids uuid[], p_hedged boolean, p_revises_place_id uuid, p_reading_labels text[]
) RETURNS TABLE (outcome text, material_id uuid, established_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_human public.shared_world_material_commit_commands;
  v_committed public.shared_world_material_commit_commands;
  v_command uuid;
  v_material uuid;
  v_item uuid;
  v_gate record;
  v_result record;
  v_sources integer;
  v_people uuid[];
  v_authors uuid[];
  v_earlier shared_semantic_private.semantic_place_attributions;
  v_earlier_holders uuid[];
  v_earlier_relayers uuid[];
  v_absent boolean;
BEGIN
  v_absent := p_absent_holder_label IS NOT NULL;
  IF p_lease_id IS NULL OR p_pass_command_id IS NULL OR p_world_id IS NULL OR p_place_ordinal IS NULL
     OR p_place_ordinal NOT BETWEEN 1 AND 3
     OR NOT shared_semantic_private.is_semantic_text_v1(p_meaning, 120)
     OR p_material_source_ids IS NULL OR coalesce(array_length(p_material_source_ids, 1), 0) NOT BETWEEN 1 AND 24
     OR array_position(p_material_source_ids, NULL::uuid) IS NOT NULL
     OR NOT shared_semantic_private.is_theme_set_v1(p_primary_themes, 1, 3)
     OR NOT shared_semantic_private.is_theme_set_v1(p_secondary_themes, 0, 3)
     OR EXISTS (SELECT 1 FROM unnest(p_primary_themes) AS a(theme), unnest(p_secondary_themes) AS b(theme)
                 WHERE lower(a.theme) = lower(b.theme))
     OR p_semantic_region IS NULL OR p_semantic_region !~ '^[a-z0-9][a-z0-9_.-]{0,63}$'
     OR p_world_x IS NULL OR p_world_y IS NULL
     OR p_world_x NOT BETWEEN -4611686018427387904 AND 4611686018427387903
     OR p_world_y NOT BETWEEN -4611686018427387904 AND 4611686018427387903
     -- The attribution's own shape (§2.1): nature, the people lists, the absent holder and its relayer.
     OR p_nature IS NULL OR p_nature NOT IN ('VIEW', 'CLAIM') OR p_hedged IS NULL
     OR p_holder_user_ids IS NULL OR p_relayer_user_ids IS NULL OR p_about_user_ids IS NULL OR p_reading_labels IS NULL
     OR coalesce(array_length(p_holder_user_ids, 1), 0) > 4 OR coalesce(array_length(p_relayer_user_ids, 1), 0) > 3
     OR coalesce(array_length(p_about_user_ids, 1), 0) > 3
     OR array_position(p_holder_user_ids, NULL::uuid) IS NOT NULL OR array_position(p_relayer_user_ids, NULL::uuid) IS NOT NULL
     OR array_position(p_about_user_ids, NULL::uuid) IS NOT NULL
     OR (SELECT count(DISTINCT x) FROM unnest(p_holder_user_ids) x) <> coalesce(array_length(p_holder_user_ids, 1), 0)
     OR (SELECT count(DISTINCT x) FROM unnest(p_relayer_user_ids) x) <> coalesce(array_length(p_relayer_user_ids, 1), 0)
     OR (SELECT count(DISTINCT x) FROM unnest(p_about_user_ids) x) <> coalesce(array_length(p_about_user_ids, 1), 0)
     OR (v_absent AND NOT shared_semantic_private.is_semantic_text_v1(p_absent_holder_label, 60))
     OR (coalesce(array_length(p_holder_user_ids, 1), 0) > 0) = v_absent
     OR (v_absent AND coalesce(array_length(p_relayer_user_ids, 1), 0) = 0)
     OR p_holder_user_ids && p_relayer_user_ids
     -- Speaker tokens and per-reading labels are never stored: the meaning carries none of the labels this reading sent.
     OR array_position(p_reading_labels, NULL::text) IS NOT NULL
     OR EXISTS (SELECT 1 FROM unnest(p_reading_labels) l(label) WHERE btrim(l.label) = '' OR strpos(p_meaning, l.label) > 0)
     OR (v_absent AND EXISTS (SELECT 1 FROM unnest(p_reading_labels) l(label) WHERE strpos(p_absent_holder_label, l.label) > 0)) THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_command := shared_semantic_private.derive_semantic_identity_v1('PLACE_COMMAND', p_pass_command_id, p_place_ordinal);
  v_material := shared_semantic_private.derive_semantic_identity_v1('PLACE_MATERIAL', p_pass_command_id, p_place_ordinal);
  v_item := shared_semantic_private.derive_semantic_identity_v1('PLACE_HISTORY_ITEM', p_pass_command_id, p_place_ordinal);

  SELECT * INTO v_human FROM public.shared_world_material_commit_commands c WHERE c.id = p_pass_command_id;
  IF NOT FOUND OR v_human.world_id <> p_world_id OR v_human.producer_kind <> 'HUMAN' OR v_human.material_kind <> 'HUMAN_TEXT' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- An already committed place of this pass and ordinal is the answer, whatever is offered now.
  SELECT * INTO v_committed FROM public.shared_world_material_commit_commands c
   WHERE c.id = v_command AND c.world_id = p_world_id AND c.producer_kind = 'QANDEEL';
  IF FOUND THEN
    RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, v_committed.material_id, v_committed.committed_at;
    RETURN;
  END IF;

  -- LOCK ORDER STEP 0 (0148): the conversation-capability snapshot, FOR SHARE until this transaction ends.
  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_CONVERSATION');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- LOCK ORDER STEP 0b: only the holder of this pass's CURRENT lease commits.
  PERFORM 1 FROM shared_semantic_private.semantic_work_leases l
   WHERE l.pass_command_id = p_pass_command_id AND l.lease_id = p_lease_id AND l.world_id = p_world_id
     AND l.expires_at > CURRENT_TIMESTAMP
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- The sources are this World's HUMAN_TEXT only (the 0148 rule, unchanged).
  SELECT count(*)::integer, coalesce(array_agg(DISTINCT m.author_user_id) FILTER (WHERE m.author_user_id IS NOT NULL), ARRAY[]::uuid[])
    INTO v_sources, v_authors FROM public.shared_world_materials m
   WHERE m.id = ANY(p_material_source_ids) AND m.world_id = p_world_id AND m.material_kind = 'HUMAN_TEXT';
  IF v_sources <> array_length(p_material_source_ids, 1) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- §2.2.1 Every person is a member of this World (any membership episode).
  v_people := p_holder_user_ids || p_relayer_user_ids || p_about_user_ids;
  IF EXISTS (SELECT 1 FROM unnest(v_people) u(user_id)
              WHERE NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                                 WHERE e.world_id = p_world_id AND e.user_id = u.user_id)) THEN
    RETURN QUERY SELECT 'ATTRIBUTION_REFUSED'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  -- §2.2.2 Every holder is an author of a cited source unless relayers are given; every relayer is.
  IF NOT (p_relayer_user_ids <@ v_authors)
     OR (coalesce(array_length(p_relayer_user_ids, 1), 0) = 0 AND NOT (p_holder_user_ids <@ v_authors)) THEN
    RETURN QUERY SELECT 'ATTRIBUTION_REFUSED'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  -- §2.2.4 `revises`: a CURRENT V2 place of this World with no successor, held by the same person.
  IF p_revises_place_id IS NOT NULL THEN
    SELECT * INTO v_earlier FROM shared_semantic_private.semantic_place_attributions a
     WHERE a.material_id = p_revises_place_id FOR UPDATE;
    IF NOT FOUND OR v_earlier.world_id <> p_world_id OR v_earlier.standing <> 'CURRENT'
       OR EXISTS (SELECT 1 FROM shared_semantic_private.semantic_place_revisions r WHERE r.earlier_material_id = p_revises_place_id) THEN
      RETURN QUERY SELECT 'ATTRIBUTION_REFUSED'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
    END IF;
    SELECT coalesce(array_agg(pp.user_id) FILTER (WHERE pp.person_role = 'HOLDER'), ARRAY[]::uuid[]),
           coalesce(array_agg(pp.user_id) FILTER (WHERE pp.person_role = 'RELAYER'), ARRAY[]::uuid[])
      INTO v_earlier_holders, v_earlier_relayers
      FROM shared_semantic_private.semantic_place_people pp WHERE pp.material_id = p_revises_place_id;
    IF NOT ((NOT v_absent AND v_earlier.absent_holder_label IS NULL AND p_holder_user_ids && v_earlier_holders)
            OR (v_absent AND v_earlier.absent_holder_label IS NOT NULL AND p_relayer_user_ids && v_earlier_relayers)) THEN
      RETURN QUERY SELECT 'ATTRIBUTION_REFUSED'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
    END IF;
  END IF;

  BEGIN
    SELECT c.committed_material_id, c.material_established_at INTO v_result
      FROM public.commit_shared_world_qandeel_material_v1(
             v_command, p_world_id, v_material, v_item, 'QANDEEL_ANALYSIS', p_meaning,
             p_effective_context_ref, p_output_digest, p_source_disclosure_gate_ref,
             p_authority_revalidation_ref, p_readiness_ref, p_audience_snapshot_ref,
             p_material_source_ids, ARRAY[]::text[]) c;
  EXCEPTION
    WHEN no_data_found THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
    WHEN serialization_failure THEN
      RETURN QUERY SELECT 'STALE'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
  END;

  INSERT INTO shared_semantic_private.semantic_places
    (material_id, world_id, pass_command_id, place_ordinal, interpretation_contract, primary_themes, secondary_themes,
     semantic_region, spatial_contract, layout_version, coordinate_scheme, world_x, world_y, committed_at)
  VALUES (v_result.committed_material_id, p_world_id, p_pass_command_id, p_place_ordinal, 'SHARED_SEMANTIC_INTERPRETATION_V2',
          p_primary_themes, p_secondary_themes, p_semantic_region, 'SHARED_SPATIAL_PLACEMENT_V2', 'shared_field_anchor_v1',
          'QANDEEL_SHARED_FIELD_V1', p_world_x, p_world_y, v_result.material_established_at);
  INSERT INTO shared_semantic_private.semantic_place_attributions (material_id, world_id, nature, absent_holder_label, hedged, standing)
  VALUES (v_result.committed_material_id, p_world_id, p_nature, p_absent_holder_label, p_hedged, 'CURRENT');
  INSERT INTO shared_semantic_private.semantic_place_people (material_id, world_id, person_role, user_id)
  SELECT v_result.committed_material_id, p_world_id, 'HOLDER', u FROM unnest(p_holder_user_ids) u
  UNION ALL SELECT v_result.committed_material_id, p_world_id, 'RELAYER', u FROM unnest(p_relayer_user_ids) u
  UNION ALL SELECT v_result.committed_material_id, p_world_id, 'ABOUT', u FROM unnest(p_about_user_ids) u;
  IF p_revises_place_id IS NOT NULL THEN
    INSERT INTO shared_semantic_private.semantic_place_revisions (earlier_material_id, later_material_id, world_id)
    VALUES (p_revises_place_id, v_result.committed_material_id, p_world_id);
    UPDATE shared_semantic_private.semantic_place_attributions a SET standing = 'SUPERSEDED' WHERE a.material_id = p_revises_place_id;
  END IF;

  RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, v_result.committed_material_id, v_result.material_established_at;
END$$;

-- D.2 The World's saved positions for the reading's context (§3.2.6) and the placer's map (§4.1), under a live lease only:
--     each V2 place with its attribution, people (and the requester's Names for them), revision links, sources and point.
--     The API keeps only those every current recipient may see. Nothing for a V1 place (it has no attribution).
CREATE FUNCTION shared_semantic_private.read_shared_semantic_context_v2(p_lease_id uuid, p_world_id uuid, p_viewer_user_id uuid)
RETURNS TABLE (material_id uuid, meaning text, nature text, absent_holder_label text, hedged boolean, standing text,
               people jsonb, earlier_place_id uuid, later_place_id uuid, source_material_ids uuid[], primary_themes text[],
               semantic_region text, world_x text, world_y text, committed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_lease_id IS NULL OR p_world_id IS NULL OR p_viewer_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM shared_semantic_private.semantic_work_leases l
                  WHERE l.lease_id = p_lease_id AND l.world_id = p_world_id AND l.expires_at > CURRENT_TIMESTAMP)
     OR NOT shared_semantic_private.is_current_member_v1(p_world_id, p_viewer_user_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.material_id, b.body_text, a.nature, a.absent_holder_label, a.hedged, a.standing,
           (SELECT coalesce(jsonb_agg(jsonb_build_object('role', pp.person_role, 'user', pp.user_id,
                      'name', shared_private.shared_person_name_v1(p_world_id, pp.user_id, p_viewer_user_id))
                    ORDER BY pp.person_role, pp.user_id), '[]'::jsonb)
              FROM shared_semantic_private.semantic_place_people pp WHERE pp.material_id = p.material_id),
           (SELECT r.earlier_material_id FROM shared_semantic_private.semantic_place_revisions r WHERE r.later_material_id = p.material_id),
           (SELECT r.later_material_id FROM shared_semantic_private.semantic_place_revisions r WHERE r.earlier_material_id = p.material_id),
           (SELECT array_agg(d.source_material_id ORDER BY d.source_material_id)
              FROM public.shared_world_material_dependencies d
             WHERE d.target_material_id = p.material_id AND d.dependency_kind = 'MATERIAL_DEPENDENCY'),
           p.primary_themes, p.semantic_region, p.world_x::text, p.world_y::text, p.committed_at
      FROM shared_semantic_private.semantic_places p
      JOIN shared_semantic_private.semantic_place_attributions a ON a.material_id = p.material_id AND a.world_id = p.world_id
      JOIN public.shared_world_text_material_bodies b ON b.material_id = p.material_id
     WHERE p.world_id = p_world_id
     ORDER BY p.committed_at, p.material_id
     LIMIT 2000;
END$$;

-- D.3 THE KNOWLEDGE READ (§3.2.1): the World's saved positions that EVERY current recipient may see now — membership read
--     now, nothing cached; the frozen resolver serves every recipient the meaning and every source. CURRENT positions,
--     their SUPERSEDED predecessors, and the SUPERSEDED positions whose successor is gone, in commit order, with the
--     requester's Names for their people. Nothing when the requester is not a current member of the ACTIVE World.
CREATE FUNCTION shared_semantic_private.list_shared_world_knowledge_v1(p_world_id uuid, p_viewer_user_id uuid)
RETURNS TABLE (place_id uuid, meaning text, nature text, absent_holder_label text, hedged boolean, standing text,
               people jsonb, earlier_place_id uuid, later_place_id uuid, semantic_region text, committed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_members integer;
BEGIN
  IF p_world_id IS NULL OR p_viewer_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT shared_semantic_private.is_current_member_v1(p_world_id, p_viewer_user_id) THEN
    RETURN;
  END IF;
  SELECT count(DISTINCT e.user_id)::integer INTO v_members FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.ended_at IS NULL;
  RETURN QUERY
    WITH recipients AS MATERIALIZED (
      SELECT DISTINCT e.user_id FROM public.shared_world_membership_episodes e WHERE e.world_id = p_world_id AND e.ended_at IS NULL
    ), seen AS MATERIALIZED (
      SELECT v.material_id FROM recipients r CROSS JOIN LATERAL shared_semantic_private.visible_places_v2(p_world_id, r.user_id) v
       GROUP BY v.material_id HAVING count(*) = v_members
    )
    SELECT p.material_id, b.body_text, a.nature, a.absent_holder_label, a.hedged, a.standing,
           (SELECT coalesce(jsonb_agg(jsonb_build_object('role', pp.person_role, 'user', pp.user_id,
                      'name', shared_private.shared_person_name_v1(p_world_id, pp.user_id, p_viewer_user_id))
                    ORDER BY pp.person_role, pp.user_id), '[]'::jsonb)
              FROM shared_semantic_private.semantic_place_people pp WHERE pp.material_id = p.material_id),
           (SELECT r.earlier_material_id FROM shared_semantic_private.semantic_place_revisions r WHERE r.later_material_id = p.material_id),
           (SELECT r.later_material_id FROM shared_semantic_private.semantic_place_revisions r WHERE r.earlier_material_id = p.material_id),
           p.semantic_region, p.committed_at
      FROM seen s
      JOIN shared_semantic_private.semantic_places p ON p.material_id = s.material_id AND p.world_id = p_world_id
      JOIN shared_semantic_private.semantic_place_attributions a ON a.material_id = p.material_id
      JOIN public.shared_world_text_material_bodies b ON b.material_id = p.material_id
     ORDER BY p.committed_at, p.material_id
     LIMIT 2000;
END$$;

-- =====================================================================================================================
-- E. THE MEMBER'S READS, V2 (authenticated). The 0148 audience rule, unchanged; the meaning is ONLY the composition.
-- =====================================================================================================================
CREATE FUNCTION shared_semantic_private.list_own_shared_semantic_field_v2(p_world_id uuid, p_locale text)
RETURNS TABLE (place_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR (p_locale IS NOT NULL AND p_locale NOT IN ('ar', 'en')) THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT shared_semantic_private.is_current_member_v1(p_world_id, v_user) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT x.material_id, x.world_x, x.world_y, x.meaning, x.semantic_region
      FROM (SELECT p.material_id, p.world_x::text AS world_x, p.world_y::text AS world_y, p.semantic_region, p.committed_at,
                   shared_semantic_private.safe_meaning_v1(p.material_id, v_user, p_locale) AS meaning
              FROM shared_semantic_private.visible_places_v2(p_world_id, v_user) v
              JOIN shared_semantic_private.semantic_places p ON p.material_id = v.material_id) x
     WHERE x.meaning IS NOT NULL
     ORDER BY x.committed_at, x.material_id
     LIMIT 400;
END$$;

CREATE FUNCTION shared_semantic_private.read_own_shared_semantic_place_v2(p_world_id uuid, p_place_id uuid, p_locale text)
RETURNS TABLE (place_id uuid, world_x text, world_y text, meaning text, semantic_region text,
               primary_themes text[], secondary_themes text[], established_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_place_id IS NULL OR (p_locale IS NOT NULL AND p_locale NOT IN ('ar', 'en')) THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT shared_semantic_private.is_current_member_v1(p_world_id, v_user) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT x.material_id, x.world_x, x.world_y, x.meaning, x.semantic_region, x.primary_themes, x.secondary_themes, x.established_at
      FROM (SELECT p.material_id, p.world_x::text AS world_x, p.world_y::text AS world_y, p.semantic_region, p.primary_themes,
                   p.secondary_themes, v.established_at,
                   shared_semantic_private.safe_meaning_v1(p.material_id, v_user, p_locale) AS meaning
              FROM shared_semantic_private.visible_places_v2(p_world_id, v_user) v
              JOIN shared_semantic_private.semantic_places p ON p.material_id = v.material_id
             WHERE p.material_id = p_place_id) x
     WHERE x.meaning IS NOT NULL;
END$$;

-- The exact sources of one served place: the human words, attributed exactly as the conversation attributes them.
CREATE FUNCTION shared_semantic_private.list_own_shared_semantic_place_sources_v2(p_world_id uuid, p_place_id uuid)
RETURNS TABLE (material_id uuid, producer_kind text, is_self boolean, author_name text, text_body text, established_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_place_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT shared_semantic_private.is_current_member_v1(p_world_id, v_user)
     OR NOT EXISTS (SELECT 1 FROM shared_semantic_private.visible_places_v2(p_world_id, v_user) v WHERE v.material_id = p_place_id)
     OR shared_semantic_private.safe_meaning_v1(p_place_id, v_user, NULL) IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.material_id,
           CASE WHEN m.author_user_id IS NULL THEN 'QANDEEL' ELSE 'HUMAN' END,
           COALESCE(m.author_user_id = v_user, false),
           CASE WHEN m.author_user_id IS NULL THEN NULL ELSE shared_private.shared_person_name_v1(p_world_id, m.author_user_id, v_user) END,
           m.text_body, m.established_at
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
      JOIN public.shared_world_material_dependencies d
        ON d.source_material_id = m.material_id AND d.target_material_id = p_place_id AND d.dependency_kind = 'MATERIAL_DEPENDENCY'
     WHERE m.text_body IS NOT NULL AND m.material_kind = 'HUMAN_TEXT'
     ORDER BY m.established_at, m.material_id;
END$$;

-- =====================================================================================================================
-- F. THE EXPOSED WRAPPERS: SECURITY INVOKER, each a one-line call into its definer.
-- =====================================================================================================================
CREATE FUNCTION public.complete_shared_semantic_place_v2(
  p_lease_id uuid, p_pass_command_id uuid, p_place_ordinal integer, p_world_id uuid, p_meaning text,
  p_effective_context_ref text, p_output_digest text, p_source_disclosure_gate_ref text,
  p_authority_revalidation_ref text, p_readiness_ref text, p_audience_snapshot_ref text,
  p_material_source_ids uuid[], p_primary_themes text[], p_secondary_themes text[], p_semantic_region text,
  p_world_x bigint, p_world_y bigint, p_nature text, p_holder_user_ids uuid[], p_absent_holder_label text,
  p_relayer_user_ids uuid[], p_about_user_ids uuid[], p_hedged boolean, p_revises_place_id uuid, p_reading_labels text[]
) RETURNS TABLE (outcome text, material_id uuid, established_at timestamptz)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.material_id, r.established_at
    FROM shared_semantic_private.complete_shared_semantic_place_v2(
           p_lease_id, p_pass_command_id, p_place_ordinal, p_world_id, p_meaning, p_effective_context_ref, p_output_digest,
           p_source_disclosure_gate_ref, p_authority_revalidation_ref, p_readiness_ref, p_audience_snapshot_ref,
           p_material_source_ids, p_primary_themes, p_secondary_themes, p_semantic_region, p_world_x, p_world_y, p_nature,
           p_holder_user_ids, p_absent_holder_label, p_relayer_user_ids, p_about_user_ids, p_hedged, p_revises_place_id,
           p_reading_labels) r;
$$;

CREATE FUNCTION public.read_shared_semantic_context_v2(p_lease_id uuid, p_world_id uuid, p_viewer_user_id uuid)
RETURNS TABLE (material_id uuid, meaning text, nature text, absent_holder_label text, hedged boolean, standing text,
               people jsonb, earlier_place_id uuid, later_place_id uuid, source_material_ids uuid[], primary_themes text[],
               semantic_region text, world_x text, world_y text, committed_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.material_id, r.meaning, r.nature, r.absent_holder_label, r.hedged, r.standing, r.people, r.earlier_place_id,
         r.later_place_id, r.source_material_ids, r.primary_themes, r.semantic_region, r.world_x, r.world_y, r.committed_at
    FROM shared_semantic_private.read_shared_semantic_context_v2(p_lease_id, p_world_id, p_viewer_user_id) r;
$$;

CREATE FUNCTION public.list_shared_world_knowledge_v1(p_world_id uuid, p_viewer_user_id uuid)
RETURNS TABLE (place_id uuid, meaning text, nature text, absent_holder_label text, hedged boolean, standing text,
               people jsonb, earlier_place_id uuid, later_place_id uuid, semantic_region text, committed_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.place_id, r.meaning, r.nature, r.absent_holder_label, r.hedged, r.standing, r.people, r.earlier_place_id,
         r.later_place_id, r.semantic_region, r.committed_at
    FROM shared_semantic_private.list_shared_world_knowledge_v1(p_world_id, p_viewer_user_id) r;
$$;

CREATE FUNCTION public.list_own_shared_semantic_field_v2(p_world_id uuid, p_locale text)
RETURNS TABLE (place_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.place_id, r.world_x, r.world_y, r.meaning, r.semantic_region FROM shared_semantic_private.list_own_shared_semantic_field_v2(p_world_id, p_locale) r;
$$;

CREATE FUNCTION public.read_own_shared_semantic_place_v2(p_world_id uuid, p_place_id uuid, p_locale text)
RETURNS TABLE (place_id uuid, world_x text, world_y text, meaning text, semantic_region text,
               primary_themes text[], secondary_themes text[], established_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.place_id, r.world_x, r.world_y, r.meaning, r.semantic_region, r.primary_themes, r.secondary_themes, r.established_at
    FROM shared_semantic_private.read_own_shared_semantic_place_v2(p_world_id, p_place_id, p_locale) r;
$$;

CREATE FUNCTION public.list_own_shared_semantic_place_sources_v2(p_world_id uuid, p_place_id uuid)
RETURNS TABLE (material_id uuid, producer_kind text, is_self boolean, author_name text, text_body text, established_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.material_id, r.producer_kind, r.is_self, r.author_name, r.text_body, r.established_at
    FROM shared_semantic_private.list_own_shared_semantic_place_sources_v2(p_world_id, p_place_id) r;
$$;

-- =====================================================================================================================
-- G. ISOLATION (§2.5, §6): five bodies replaced forward, each with exactly one change.
-- =====================================================================================================================

-- G.1 The active Shared conversation read no longer returns QANDEEL_ANALYSIS (§2.5; this is also the fix for the reply's
--     50-row page, which a place no longer takes). One change: `AND m.material_kind <> 'QANDEEL_ANALYSIS'`.
CREATE OR REPLACE FUNCTION shared_private.list_own_shared_world_material_v1(p_world_id uuid, p_before_established_at timestamp with time zone, p_before_material_id uuid, p_limit integer)
 RETURNS TABLE(material_id uuid, material_kind text, producer_kind text, established_at timestamp with time zone, is_self boolean, author_name text, text_body text, can_delete boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'SHARED_MATERIAL_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  -- Current membership (an OPEN episode in an ACTIVE World) is the S4-01 entry law. Anything else reads nothing, and
  -- reads nothing in the same way, so this is not a membership or World-existence oracle.
  IF NOT EXISTS (
    SELECT 1 FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.world_id = p_world_id AND e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.material_id, m.material_kind,
           CASE WHEN m.author_user_id IS NULL THEN 'QANDEEL' ELSE 'HUMAN' END,
           m.established_at,
           COALESCE(m.author_user_id = v_user, false),
           CASE WHEN m.author_user_id IS NULL THEN NULL ELSE shared_private.shared_person_name_v1(p_world_id, m.author_user_id, v_user) END,
           m.text_body,
           m.author_user_id IS NOT NULL AND m.author_user_id = v_user
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
      LEFT JOIN public.users u ON u.id = m.author_user_id
     WHERE m.text_body IS NOT NULL AND m.material_kind <> 'QANDEEL_ANALYSIS'
       AND (p_before_established_at IS NULL
            OR (m.established_at, m.material_id) < (p_before_established_at, p_before_material_id))
     ORDER BY m.established_at DESC, m.material_id DESC
     LIMIT p_limit;
END$function$;

-- G.2 The 0140 closed read, still executable by `authenticated`, excludes it the same way (the API reads the 0148 v2).
CREATE OR REPLACE FUNCTION shared_private.list_own_closed_shared_world_material_v1(p_world_id uuid, p_before_established_at timestamp with time zone, p_before_material_id uuid, p_limit integer)
 RETURNS TABLE(material_id uuid, producer_kind text, established_at timestamp with time zone, is_self boolean, author_name text, text_body text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'SHARED_MATERIAL_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_standard_closed_view_entitlements ent
                   JOIN public.shared_worlds w ON w.id = ent.world_id
                  WHERE ent.world_id = p_world_id AND ent.user_id = v_user
                    AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'STANDARD') THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.material_id,
           CASE WHEN m.author_user_id IS NULL THEN 'QANDEEL' ELSE 'HUMAN' END,
           m.established_at,
           COALESCE(m.author_user_id = v_user, false),
           CASE WHEN m.author_user_id IS NULL THEN NULL ELSE shared_private.shared_person_name_v1(p_world_id, m.author_user_id, v_user) END,
           m.text_body
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
      LEFT JOIN public.users u ON u.id = m.author_user_id
     WHERE m.text_body IS NOT NULL AND m.material_kind <> 'QANDEEL_ANALYSIS'
       AND (p_before_established_at IS NULL
            OR (m.established_at, m.material_id) < (p_before_established_at, p_before_material_id))
     ORDER BY m.established_at DESC, m.material_id DESC
     LIMIT p_limit;
END$function$;

-- G.3 Public authoring sources (S5-02 / 0155): a place is never listed. One change: the kind list loses QANDEEL_ANALYSIS.
CREATE OR REPLACE FUNCTION public_authoring_private.list_own_public_authoring_sources_v1()
 RETURNS TABLE(source_kind text, source_id uuid, world_id uuid, material_kind text, established_at timestamp with time zone, is_self boolean, author_name text, text_body text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_world uuid;
BEGIN
  RETURN QUERY
    SELECT 'PERSONAL'::text, cu.id, NULL::uuid, NULL::text, cu.created_at, true, NULL::text, cu.committed_text
      FROM public.conversation_units cu
     WHERE cu.user_id = v_user AND cu.source_role = 'USER'
     ORDER BY cu.created_at DESC, cu.id DESC
     LIMIT 50;
  FOR v_world IN
    SELECT e.world_id FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE'
     ORDER BY w.born_at, w.id
  LOOP
    RETURN QUERY
      SELECT 'SHARED'::text, m.material_id, m.world_id, m.material_kind, m.established_at,
             coalesce(m.author_user_id = v_user, false),
             CASE WHEN m.author_user_id IS NULL THEN NULL ELSE shared_private.shared_person_name_v1(v_world, m.author_user_id, v_user) END,
             m.text_body
        FROM public.resolve_shared_world_material_v1(v_world, v_user) m
        JOIN public.shared_world_history_items i ON i.id = m.history_item_id AND i.availability_state = 'AVAILABLE'
        JOIN public.shared_world_material_historical_authority ha
          ON ha.material_id = m.material_id
         AND ha.resolution_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT', 'RESOLVED_NO_HUMAN_REQUIREMENT')
        LEFT JOIN public.users u ON u.id = m.author_user_id
       WHERE m.text_body IS NOT NULL AND m.material_kind IN ('HUMAN_TEXT', 'QANDEEL_OUTPUT')
         AND NOT shared_private.is_introduction_era_history_item_v1(v_world, m.history_item_id)
       ORDER BY m.established_at DESC, m.material_id DESC
       LIMIT 50;
  END LOOP;
END$function$;

-- G.4 Public package preparation: a package that names a place by id is refused, before the frozen manifest core.
CREATE OR REPLACE FUNCTION public_authoring_private.prepare_own_public_experience_package_v1(p_command_id uuid, p_experience_id uuid, p_personal_unit_ids uuid[], p_shared_world_ids uuid[], p_shared_material_ids uuid[])
 RETURNS TABLE(outcome text, item_count integer, required_approver_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_personal integer := coalesce(array_length(p_personal_unit_ids, 1), 0);
  v_shared integer := coalesce(array_length(p_shared_material_ids, 1), 0);
  v_personal_items uuid[];
  v_shared_items uuid[];
  v_class text;
  r record;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_personal_unit_ids IS NULL OR p_shared_world_ids IS NULL
     OR p_shared_material_ids IS NULL OR v_shared <> coalesce(array_length(p_shared_world_ids, 1), 0)
     OR v_personal + v_shared < 1 OR v_personal + v_shared > 20 THEN
    RAISE EXCEPTION 'PUBLIC_AUTHORING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(public_authoring_private.derive_authoring_identity_v1('ITEM', v_user, p_command_id, g) ORDER BY g), ARRAY[]::uuid[])
    INTO v_personal_items FROM generate_series(1, v_personal) g;
  SELECT coalesce(array_agg(public_authoring_private.derive_authoring_identity_v1('ITEM', v_user, p_command_id, v_personal + g) ORDER BY g), ARRAY[]::uuid[])
    INTO v_shared_items FROM generate_series(1, v_shared) g;
  BEGIN
    -- S6-02 (D5): Introduction-era Shared material of a Matching-born World is never packaged for the Public World.
    -- The refusal is the class a source this human cannot see gets, so it reveals nothing about the source.
    -- S8A-04 CP2 (0175, §6): a Shared semantic place (QANDEEL_ANALYSIS) is never a Public authoring source. A package that
    -- names one by id is refused with the class a source this human cannot see gets, so it reveals nothing about it.
    IF EXISTS (SELECT 1 FROM unnest(p_shared_world_ids, p_shared_material_ids) AS t(world_id, material_id)
                 JOIN public.shared_world_materials sm ON sm.id = t.material_id AND sm.world_id = t.world_id
                WHERE sm.material_kind = 'QANDEEL_ANALYSIS') THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE = 'P0002';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(p_shared_world_ids, p_shared_material_ids) AS t(world_id, material_id)
                 JOIN public.shared_world_materials sm ON sm.id = t.material_id AND sm.world_id = t.world_id
                WHERE shared_private.is_introduction_era_history_item_v1(sm.world_id, sm.history_item_id)) THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE = 'P0002';
    END IF;
    SELECT d.outcome, d.item_count, d.required_approver_count INTO r
      FROM public.prepare_public_experience_manifest_v1(
             p_command_id, p_experience_id,
             public_authoring_private.derive_authoring_identity_v1('MANIFEST', v_user, p_command_id, 0),
             public_authoring_private.derive_authoring_identity_v1('VERSION', v_user, p_command_id, 0),
             v_personal_items, p_personal_unit_ids, v_shared_items, p_shared_world_ids, p_shared_material_ids) d;
  EXCEPTION WHEN OTHERS THEN
    v_class := public_authoring_private.classify_public_refusal_v1(SQLERRM);
    IF v_class IS NULL THEN RAISE; END IF;
    RETURN QUERY SELECT v_class, NULL::integer, NULL::integer;
    RETURN;
  END;
  RETURN QUERY SELECT CASE WHEN r.outcome = 'PACKAGE_PREPARED' THEN 'PREPARED' ELSE 'ALREADY_PREPARED' END,
                      r.item_count, r.required_approver_count;
END$function$;

-- G.5 Replay capture (S7-01 / 0155): a place is refused by id. Two changes: the admitted kinds lose QANDEEL_ANALYSIS, so a
--     selected place takes the existing REPLAY_SOURCE_KIND_RESERVED refusal (after the visibility check, so a hidden place
--     is still only unavailable); and a place is not part of the universe a Shared Replay is measured against, like
--     Introduction-era material (S6-02), so FULL_SOURCE stays provable in a World that has places and the universe ranks
--     stay contiguous over what Replay may capture.
CREATE OR REPLACE FUNCTION public.replay_capture_source_manifest_v1(p_replay_id uuid, p_source_manifest_version_id uuid, p_manifest_revision integer, p_source_class text, p_source_context_id uuid, p_source_version_id uuid, p_source_item_ids uuid[], p_capture_instant timestamp with time zone)
 RETURNS TABLE(captured_item_count integer, captured_universe_item_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  u uuid := auth.uid();
  requested integer := cardinality(p_source_item_ids);
  locked integer;
  universe integer;
  frontier integer;
  visible uuid[];
  experience public.public_experiences;
  bound_version public.public_experience_versions;
  package public.publication_package_manifest_versions;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_replay_id IS NULL OR p_source_manifest_version_id IS NULL OR p_manifest_revision IS NULL
     OR p_source_class IS NULL OR p_source_context_id IS NULL OR p_capture_instant IS NULL
     OR p_source_item_ids IS NULL OR requested = 0
     OR array_position(p_source_item_ids, NULL) IS NOT NULL
     OR (SELECT count(DISTINCT x) FROM unnest(p_source_item_ids) x) <> requested THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.replays r WHERE r.id = p_replay_id AND r.created_by_user_id = u) THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  IF p_source_class = 'MY_WORLD' THEN
    IF p_source_version_id IS NOT NULL THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    PERFORM 1 FROM public.session_semantic_clocks c
      WHERE c.session_id = p_source_context_id AND c.user_id = u FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    PERFORM 1 FROM public.conversation_units cu
      WHERE cu.session_id = p_source_context_id AND cu.user_id = u AND cu.id = ANY(p_source_item_ids)
      ORDER BY cu.id FOR SHARE;
    GET DIAGNOSTICS locked = ROW_COUNT;
    IF locked <> requested THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    SELECT count(*)::integer, max(cu.session_position) INTO universe, frontier
      FROM public.conversation_units cu
     WHERE cu.session_id = p_source_context_id AND cu.user_id = u;

    INSERT INTO public.replay_source_manifest_versions
      (id, replay_id, manifest_revision, source_class, creation_authority_basis,
       personal_session_id, personal_owner_user_id, personal_frontier_session_position,
       item_count, authorized_universe_item_count, captured_at)
    VALUES (p_source_manifest_version_id, p_replay_id, p_manifest_revision, 'MY_WORLD', 'PERSONAL_SOURCE_OWNERSHIP',
            p_source_context_id, u, frontier, requested, universe, p_capture_instant);

    INSERT INTO public.replay_source_manifest_items
      (manifest_version_id, source_item_ordinal, source_universe_rank, source_class, original_medium,
       captured_source_digest, personal_session_id, personal_conversation_unit_id,
       personal_session_position, personal_source_role)
    SELECT p_source_manifest_version_id,
           (row_number() OVER (ORDER BY cu.session_position))::integer,
           (SELECT count(*) FROM public.conversation_units x
             WHERE x.session_id = cu.session_id AND x.user_id = cu.user_id
               AND x.session_position <= cu.session_position)::integer,
           'MY_WORLD', 'ORIGINAL_TEXT',
           'sha256:' || encode(sha256(convert_to(cu.committed_text, 'UTF8')), 'hex'),
           cu.session_id, cu.id, cu.session_position, cu.source_role
      FROM public.conversation_units cu
     WHERE cu.session_id = p_source_context_id AND cu.user_id = u AND cu.id = ANY(p_source_item_ids);

  ELSIF p_source_class = 'SHARED_WORLD' THEN
    IF p_source_version_id IS NOT NULL THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_source_context_id FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    BEGIN
      SELECT array_agg(v.history_item_id ORDER BY v.occurred_at, v.history_item_id) INTO visible
        FROM public.resolve_shared_world_history_visibility_v1(p_source_context_id, u) v;
    EXCEPTION WHEN SQLSTATE 'P0002' OR SQLSTATE '0A000' THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END;
    -- S6-02 (GATE-35 / D5): Introduction-era material of a Matching-born World is never a Replay source. It leaves the
    -- visible set, so a selected one is refused exactly like an item the creator cannot see, and it is not counted.
    visible := shared_private.without_introduction_era_history_v1(p_source_context_id, visible);
    IF visible IS NULL THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    PERFORM 1 FROM public.shared_world_materials m
      WHERE m.world_id = p_source_context_id AND m.id = ANY(p_source_item_ids) ORDER BY m.id FOR SHARE;
    GET DIAGNOSTICS locked = ROW_COUNT;
    IF locked <> requested THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    PERFORM 1 FROM public.shared_world_history_items i
      WHERE i.id IN (SELECT m.history_item_id FROM public.shared_world_materials m
                      WHERE m.world_id = p_source_context_id AND m.id = ANY(p_source_item_ids))
      ORDER BY i.id FOR SHARE;
    IF EXISTS (
      SELECT 1 FROM public.shared_world_materials m
       WHERE m.world_id = p_source_context_id AND m.id = ANY(p_source_item_ids)
         AND NOT (m.history_item_id = ANY(visible))
    ) THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.shared_world_materials m
       WHERE m.world_id = p_source_context_id AND m.id = ANY(p_source_item_ids)
         AND m.material_kind NOT IN ('HUMAN_TEXT', 'HUMAN_VOICE_NOTE', 'QANDEEL_OUTPUT')
    ) THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_KIND_RESERVED' USING ERRCODE='0A000';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.shared_world_materials m
        JOIN public.shared_world_history_items i ON i.id = m.history_item_id
       WHERE m.world_id = p_source_context_id AND m.id = ANY(p_source_item_ids)
         AND (i.availability_state <> 'AVAILABLE'
              OR NOT EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies t WHERE t.material_id = m.id)
                 AND NOT EXISTS (SELECT 1 FROM public.shared_world_voice_note_material_bodies vn WHERE vn.material_id = m.id))
    ) THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    visible := ARRAY(SELECT v.item FROM unnest(visible) WITH ORDINALITY AS v(item, rank)
                      WHERE NOT EXISTS (SELECT 1 FROM public.shared_world_materials m
                                         WHERE m.world_id = p_source_context_id AND m.history_item_id = v.item
                                           AND m.material_kind = 'QANDEEL_ANALYSIS')
                      ORDER BY v.rank);
    universe := cardinality(visible);

    INSERT INTO public.replay_source_manifest_versions
      (id, replay_id, manifest_revision, source_class, creation_authority_basis, shared_world_id,
       item_count, authorized_universe_item_count, captured_at)
    VALUES (p_source_manifest_version_id, p_replay_id, p_manifest_revision, 'SHARED_WORLD', 'SHARED_HISTORY_VISIBILITY',
            p_source_context_id, requested, universe, p_capture_instant);

    INSERT INTO public.replay_source_manifest_items
      (manifest_version_id, source_item_ordinal, source_universe_rank, source_class, original_medium,
       captured_source_digest, shared_world_id, shared_material_id, shared_history_item_id,
       shared_material_kind, shared_occurred_at, captured_availability_state, captured_availability_revision)
    SELECT p_source_manifest_version_id,
           (row_number() OVER (ORDER BY i.occurred_at, i.id))::integer,
           array_position(visible, i.id),
           'SHARED_WORLD',
           CASE WHEN m.material_kind = 'HUMAN_VOICE_NOTE' THEN 'ORIGINAL_AUDIO' ELSE 'ORIGINAL_TEXT' END,
           'sha256:' || encode(sha256(convert_to(
             CASE WHEN m.material_kind = 'HUMAN_VOICE_NOTE'
                  THEN vn.audio_object_ref || E'\n' || coalesce(vn.transcript_text, '')
                  ELSE t.body_text END, 'UTF8')), 'hex'),
           m.world_id, m.id, i.id, m.material_kind, i.occurred_at, i.availability_state, i.availability_revision
      FROM public.shared_world_materials m
      JOIN public.shared_world_history_items i ON i.id = m.history_item_id
      LEFT JOIN public.shared_world_text_material_bodies t ON t.material_id = m.id
      LEFT JOIN public.shared_world_voice_note_material_bodies vn ON vn.material_id = m.id
     WHERE m.world_id = p_source_context_id AND m.id = ANY(p_source_item_ids);

  ELSIF p_source_class = 'PUBLIC_EXPERIENCE' THEN
    IF p_source_version_id IS NULL THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR SHARE;
    SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_source_context_id FOR SHARE;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                                  WHERE c.experience_id = p_source_context_id AND c.controller_user_id = u) THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    IF experience.current_experience_version_id IS DISTINCT FROM p_source_version_id
       OR experience.current_lifecycle NOT IN ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED') THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_STALE' USING ERRCODE='40001';
    END IF;
    SELECT * INTO bound_version FROM public.public_experience_versions v
     WHERE v.id = p_source_version_id AND v.experience_id = p_source_context_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
    SELECT * INTO package FROM public.publication_package_manifest_versions pm
     WHERE pm.id = bound_version.package_manifest_version_id AND pm.experience_id = p_source_context_id FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
    SELECT count(*)::integer INTO locked FROM public.publication_package_manifest_items it
     WHERE it.manifest_version_id = package.id AND it.package_item_id = ANY(p_source_item_ids);
    IF locked <> requested THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.publication_package_manifest_items it
       WHERE it.manifest_version_id = package.id AND it.package_item_id = ANY(p_source_item_ids)
         AND it.public_body_form <> 'PUBLIC_TEXT'
    ) THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_KIND_RESERVED' USING ERRCODE='0A000';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.publication_package_manifest_items it
       WHERE it.manifest_version_id = package.id AND it.package_item_id = ANY(p_source_item_ids)
         AND NOT EXISTS (SELECT 1 FROM public.public_experience_text_derivative_bodies b
                          WHERE b.package_item_id = it.package_item_id)
    ) THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    universe := package.item_count;

    INSERT INTO public.replay_source_manifest_versions
      (id, replay_id, manifest_revision, source_class, creation_authority_basis,
       public_experience_id, public_experience_version_id, public_manifest_version_id,
       item_count, authorized_universe_item_count, captured_at)
    VALUES (p_source_manifest_version_id, p_replay_id, p_manifest_revision, 'PUBLIC_EXPERIENCE', 'PUBLIC_EXPERIENCE_CONTROL',
            p_source_context_id, bound_version.id, package.id, requested, universe, p_capture_instant);

    INSERT INTO public.replay_source_manifest_items
      (manifest_version_id, source_item_ordinal, source_universe_rank, source_class, original_medium,
       captured_source_digest, public_manifest_version_id, public_package_item_id, public_item_ordinal,
       public_derivative_classification)
    SELECT p_source_manifest_version_id,
           (row_number() OVER (ORDER BY it.item_ordinal))::integer,
           it.item_ordinal, 'PUBLIC_EXPERIENCE', 'ORIGINAL_TEXT', it.public_body_digest,
           package.id, it.package_item_id, it.item_ordinal, it.derivative_classification
      FROM public.publication_package_manifest_items it
     WHERE it.manifest_version_id = package.id AND it.package_item_id = ANY(p_source_item_ids);

  ELSE
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  RETURN QUERY SELECT requested, universe;
END$function$;

-- =====================================================================================================================
-- H. ACCOUNTING (§5): the Shared source columns, the begin command that verifies them, two families.
-- =====================================================================================================================
ALTER TABLE public.ai_provider_calls
  ADD COLUMN source_world_id uuid,
  ADD COLUMN source_shared_material_id uuid,
  ADD CONSTRAINT ai_provider_calls_shared_source_check CHECK (
    (source_world_id IS NULL) = (source_shared_material_id IS NULL)
    AND (source_world_id IS NULL OR (session_id IS NULL AND source_turn_id IS NULL)));
ALTER TABLE public.ai_provider_calls DROP CONSTRAINT ai_provider_calls_feature_family_check;
ALTER TABLE public.ai_provider_calls ADD CONSTRAINT ai_provider_calls_feature_family_check CHECK (feature_family IN (
  'CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION', 'THREAD_FORMATION', 'THREAD_CONTINUITY',
  'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION',
  'PERSONAL_UNDERSTANDING_CAPTURE', 'SHARED_SEMANTIC_READING', 'SHARED_KNOWLEDGE_RECALL', 'SHARED_SPATIAL_PLACEMENT'));
CREATE INDEX ai_provider_calls_shared_attempt_idx ON public.ai_provider_calls (user_id, source_shared_material_id, feature_family)
  WHERE source_shared_material_id IS NOT NULL;

-- Record the intent of ONE external provider attempt for Shared World work, BEFORE it starts. The payer must be the 0089
-- author of the HUMAN_TEXT message of that World that caused it; otherwise FORBIDDEN and no call starts. Attempts are
-- numbered per (payer, message, family); replaying the same begin is idempotent; the same id otherwise is refused.
CREATE FUNCTION public.begin_ai_provider_call_v2(
  p_call_id uuid, p_user_id uuid, p_source_world_id uuid, p_source_shared_material_id uuid, p_provider text,
  p_requested_model text, p_operation text, p_feature_family text, p_processing_path text
) RETURNS TABLE (begin_outcome text, attempt_number integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing public.ai_provider_calls; v_attempt integer;
BEGIN
  IF p_call_id IS NULL OR p_user_id IS NULL OR p_source_world_id IS NULL OR p_source_shared_material_id IS NULL
     OR p_provider IS NULL OR p_requested_model IS NULL OR p_operation IS NULL OR p_feature_family IS NULL THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL' USING ERRCODE = '22023';
  END IF;
  IF p_provider NOT IN ('OPENAI', 'ANTHROPIC', 'GEMINI', 'DEEPSEEK') THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_materials m
                  WHERE m.id = p_source_shared_material_id AND m.world_id = p_source_world_id
                    AND m.material_kind = 'HUMAN_TEXT' AND m.author_user_id = p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.ai-provider-call.v1:' || p_user_id::text, 0));
  SELECT * INTO existing FROM public.ai_provider_calls c WHERE c.id = p_call_id;
  IF existing.id IS NOT NULL THEN
    IF (existing.user_id, existing.session_id, existing.source_turn_id, existing.source_world_id, existing.source_shared_material_id,
        existing.provider, existing.requested_model, existing.operation, existing.feature_family, existing.processing_path)
       IS NOT DISTINCT FROM
       (p_user_id, NULL::uuid, NULL::uuid, p_source_world_id, p_source_shared_material_id, p_provider, p_requested_model,
        p_operation, p_feature_family, p_processing_path) THEN
      RETURN QUERY SELECT 'ALREADY_BEGUN'::text, existing.attempt_number; RETURN;
    END IF;
    RAISE EXCEPTION 'AI_PROVIDER_CALL_IDENTITY_CONFLICT' USING ERRCODE = 'PT409';
  END IF;
  SELECT count(*)::integer + 1 INTO v_attempt FROM public.ai_provider_calls c
   WHERE c.user_id = p_user_id AND c.source_shared_material_id = p_source_shared_material_id AND c.feature_family = p_feature_family;
  INSERT INTO public.ai_provider_calls (id, user_id, session_id, source_turn_id, source_world_id, source_shared_material_id,
                                        provider, requested_model, operation, feature_family, processing_path, attempt_number,
                                        call_state, started_at)
  VALUES (p_call_id, p_user_id, NULL, NULL, p_source_world_id, p_source_shared_material_id, p_provider, p_requested_model,
          p_operation, p_feature_family, p_processing_path, v_attempt, 'PENDING', clock_timestamp());
  RETURN QUERY SELECT 'BEGUN'::text, v_attempt;
END $$;

-- =====================================================================================================================
-- I. ACCOUNT ERASURE COVERAGE (§2.3): the new relations join the SHARED_STANDARD residue class (0164 / 0169 pattern). A
--    place exists only in a Standard World, whose membership the residue census already probes.
-- =====================================================================================================================
INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('shared_semantic_private.semantic_place_attributions', 'SHARED_STANDARD'),
    ('shared_semantic_private.semantic_place_people', 'SHARED_STANDARD'),
    ('shared_semantic_private.semantic_place_revisions', 'SHARED_STANDARD');

-- =====================================================================================================================
-- J. PRIVILEGES. Default-deny for every new function and relation; the v1 writer, context read and member reads are
--    revoked; then the exact grants.
-- =====================================================================================================================
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE (n.nspname = 'shared_semantic_private' AND p.proname IN ('guard_semantic_attribution_v1',
                     'require_semantic_attribution_v1', 'join_names_v1', 'place_people_names_v1', 'safe_meaning_v1',
                     'visible_places_v2', 'complete_shared_semantic_place_v2', 'read_shared_semantic_context_v2',
                     'list_shared_world_knowledge_v1', 'list_own_shared_semantic_field_v2', 'read_own_shared_semantic_place_v2',
                     'list_own_shared_semantic_place_sources_v2',
                     'complete_shared_semantic_place_v1', 'read_shared_semantic_context_v1', 'list_own_shared_semantic_field_v1',
                     'read_own_shared_semantic_place_v1', 'list_own_shared_semantic_place_sources_v1'))
               OR (n.nspname = 'public' AND p.proname IN ('complete_shared_semantic_place_v2', 'read_shared_semantic_context_v2',
                     'list_shared_world_knowledge_v1', 'list_own_shared_semantic_field_v2', 'read_own_shared_semantic_place_v2',
                     'list_own_shared_semantic_place_sources_v2', 'begin_ai_provider_call_v2',
                     'complete_shared_semantic_place_v1', 'read_shared_semantic_context_v1', 'list_own_shared_semantic_field_v1',
                     'read_own_shared_semantic_place_v1', 'list_own_shared_semantic_place_sources_v1')) LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', f.sig);
    END IF;
  END LOOP;
END$$;

ALTER TABLE shared_semantic_private.semantic_place_attributions OWNER TO postgres;
ALTER TABLE shared_semantic_private.semantic_place_people OWNER TO postgres;
ALTER TABLE shared_semantic_private.semantic_place_revisions OWNER TO postgres;
REVOKE ALL ON TABLE shared_semantic_private.semantic_place_attributions, shared_semantic_private.semantic_place_people,
                    shared_semantic_private.semantic_place_revisions
  FROM PUBLIC, anon, authenticated;

DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE shared_semantic_private.semantic_place_attributions, shared_semantic_private.semantic_place_people, shared_semantic_private.semantic_place_revisions FROM service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION shared_semantic_private.complete_shared_semantic_place_v2(uuid, uuid, integer, uuid, text, text, text, text, text, text, text, uuid[], text[], text[], text, bigint, bigint, text, uuid[], text, uuid[], uuid[], boolean, uuid, text[]), shared_semantic_private.read_shared_semantic_context_v2(uuid, uuid, uuid), shared_semantic_private.list_shared_world_knowledge_v1(uuid, uuid), public.complete_shared_semantic_place_v2(uuid, uuid, integer, uuid, text, text, text, text, text, text, text, uuid[], text[], text[], text, bigint, bigint, text, uuid[], text, uuid[], uuid[], boolean, uuid, text[]), public.read_shared_semantic_context_v2(uuid, uuid, uuid), public.list_shared_world_knowledge_v1(uuid, uuid), public.begin_ai_provider_call_v2(uuid, uuid, uuid, uuid, text, text, text, text, text) TO service_role';
END IF; END$$;

GRANT EXECUTE ON FUNCTION
  shared_semantic_private.list_own_shared_semantic_field_v2(uuid, text),
  shared_semantic_private.read_own_shared_semantic_place_v2(uuid, uuid, text),
  shared_semantic_private.list_own_shared_semantic_place_sources_v2(uuid, uuid),
  public.list_own_shared_semantic_field_v2(uuid, text),
  public.read_own_shared_semantic_place_v2(uuid, uuid, text),
  public.list_own_shared_semantic_place_sources_v2(uuid, uuid)
  TO authenticated;

-- =====================================================================================================================
-- K. DEPLOY-TIME SELF-ASSERTIONS.
-- =====================================================================================================================
DO $$
DECLARE
  p record;
  t text;
  r text;
BEGIN
  -- K1. Every private function is a pinned, postgres-owned SECURITY DEFINER; every new exposed wrapper an INVOKER.
  FOR p IN SELECT pr.proname, pr.prosecdef, pr.proconfig, pg_get_userbyid(pr.proowner) AS owner
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace WHERE n.nspname = 'shared_semantic_private' LOOP
    IF NOT p.prosecdef OR p.owner <> 'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN
      RAISE EXCEPTION 'S8A-04 CP2: shared_semantic_private.% must be a pinned postgres-owned definer', p.proname;
    END IF;
  END LOOP;
  FOR p IN SELECT pr.proname, pr.prosecdef FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public' AND pr.proname IN ('complete_shared_semantic_place_v2', 'read_shared_semantic_context_v2',
                  'list_shared_world_knowledge_v1', 'list_own_shared_semantic_field_v2', 'read_own_shared_semantic_place_v2',
                  'list_own_shared_semantic_place_sources_v2') LOOP
    IF p.prosecdef THEN
      RAISE EXCEPTION 'S8A-04 CP2: public.% must be SECURITY INVOKER', p.proname;
    END IF;
  END LOOP;

  -- K2. The new relations are private, RLS-enabled and unreachable by every application role.
  FOREACH t IN ARRAY ARRAY['semantic_place_attributions', 'semantic_place_people', 'semantic_place_revisions'] LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('shared_semantic_private.' || t)::regclass) THEN
      RAISE EXCEPTION 'S8A-04 CP2: % must have row level security', t;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r)
         AND has_table_privilege(r, 'shared_semantic_private.' || t, 'SELECT,INSERT,UPDATE,DELETE') THEN
        RAISE EXCEPTION 'S8A-04 CP2: % must not reach %', r, t;
      END IF;
    END LOOP;
  END LOOP;

  -- K3. Nobody writes a V1 place again, reads the unattributed context, or reads a bare meaning; a client executes no
  --     server act; nobody executes an internal derivation (the composer included).
  FOR p IN SELECT pr.oid::regprocedure AS sig FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname IN ('shared_semantic_private', 'public')
              AND pr.proname IN ('complete_shared_semantic_place_v1', 'read_shared_semantic_context_v1',
                                 'list_own_shared_semantic_field_v1', 'read_own_shared_semantic_place_v1',
                                 'list_own_shared_semantic_place_sources_v1') LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r, p.sig, 'EXECUTE') THEN
        RAISE EXCEPTION 'S8A-04 CP2: % must not execute the revoked %', r, p.sig;
      END IF;
    END LOOP;
  END LOOP;
  FOR p IN SELECT pr.oid::regprocedure AS sig FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE (n.nspname IN ('shared_semantic_private', 'public')
                   AND pr.proname IN ('complete_shared_semantic_place_v2', 'read_shared_semantic_context_v2', 'list_shared_world_knowledge_v1'))
               OR (n.nspname = 'public' AND pr.proname = 'begin_ai_provider_call_v2') LOOP
    IF has_function_privilege('authenticated', p.sig, 'EXECUTE') OR has_function_privilege('anon', p.sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'S8A-04 CP2: a client must not execute %', p.sig;
    END IF;
  END LOOP;
  FOR p IN SELECT pr.oid::regprocedure AS sig FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'shared_semantic_private'
              AND pr.proname IN ('guard_semantic_attribution_v1', 'require_semantic_attribution_v1', 'join_names_v1',
                                 'place_people_names_v1', 'safe_meaning_v1', 'visible_places_v2') LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r, p.sig, 'EXECUTE') THEN
        RAISE EXCEPTION 'S8A-04 CP2: % must not execute the internal %', r, p.sig;
      END IF;
    END LOOP;
  END LOOP;

  -- K4. The frozen 0090 QANDEEL core keeps its ACL: executable by no application role.
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r,
         'public.commit_shared_world_qandeel_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,uuid[],text[])', 'EXECUTE') THEN
      RAISE EXCEPTION 'S8A-04 CP2: % must not execute the frozen QANDEEL core', r;
    END IF;
  END LOOP;

  -- K5. The attribution leaves with its place, and every relation of it is guarded.
  IF (SELECT count(*) FROM pg_constraint c WHERE c.contype = 'f' AND c.confdeltype = 'c'
        AND c.conrelid IN ('shared_semantic_private.semantic_place_attributions'::regclass,
                           'shared_semantic_private.semantic_place_people'::regclass,
                           'shared_semantic_private.semantic_place_revisions'::regclass)) <> 4 THEN
    RAISE EXCEPTION 'S8A-04 CP2: the attribution must be erased with its place';
  END IF;
  IF (SELECT count(*) FROM pg_trigger tg WHERE NOT tg.tgisinternal
        AND tg.tgfoid = 'shared_semantic_private.guard_semantic_attribution_v1()'::regprocedure) <> 3 THEN
    RAISE EXCEPTION 'S8A-04 CP2: every attribution relation must be guarded';
  END IF;
END$$;

COMMIT;
