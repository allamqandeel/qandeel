-- I-06B - Replay Preview / Finalization Runtime v1 (PART B).
--
-- Migration 0102 created the immutable analytical projection and render
-- contract versions, the first complete REPLAY_VERSION, the current-version
-- pointer and the append-only finalization and lifecycle evidence. It cannot
-- write a row. This migration creates the only things that ever do: the
-- durable command history, the deterministic projection canonicalization, the
-- four internal derivation cores, the three human primitives and the ONE
-- creator-exact read boundary.
--
-- ===========================================================================
-- What I-06B can and cannot produce
-- ===========================================================================
--
--   DRAFT -> PREVIEW_READY      one complete immutable Replay Version was
--                               truthfully compiled and passed every internal
--                               truth gate
--   PREVIEW_READY -> FINALIZED  that EXACT version passed final source,
--                               projection and render revalidation
--   -> DRAFT                    the creator explicitly reopened for revision
--
-- PREVIEW_READY and FINALIZED widen NO audience. Neither creates a
-- distribution package, a required approver set, a publish, share or download
-- action, an export sanitization result, a Public Experience or an external
-- artifact; none of those words appears in any function here, and the
-- self-assertions refuse a migration where one does. A finalized Replay may
-- remain private forever. Creation authority and distribution authority are
-- different architecture concepts: distribution is I-06C.
--
-- Nothing here claims SAFETY_ALLOW, MODERATION_ALLOW, ENTITLED,
-- FEATURE_ENABLED, LAUNCH_CLEARED or PUBLIC_LAUNCH_READY, because the frozen
-- CW2-08 integration that could answer any of them is unimplemented. As in
-- every predecessor consequential primitive since I-04B, the mutation surface
-- is executable by NO application role.
--
-- ===========================================================================
-- The analytical projection is CONSUMED, never recomputed
-- ===========================================================================
--
-- `build_replay_analytical_projection_v1` reaches the canonical historical
-- projection - `get_session_historical_projection_v1(session, TC)`, which
-- migration 0072 owns - at the exact represented Session Position of each
-- selected source item, and commits a digest of what it answered. It runs no
-- model, calls no provider, reads no current analytical row as a historical
-- fallback and creates no second temporal authority. There is no path in this
-- migration from "old source" to "current analysis": the ONLY analytical input
-- is that one function's answer at that one coordinate.
--
-- Three refusals, all closed:
--
--   LEGACY_UNCOVERED Session   the canonical projection itself raises, and
--                              every raise of it is a CAPABILITY ABSENCE
--                              rather than an error a caller can read:
--                              REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE. No
--                              history is reconstructed from current rows.
--   the open Live Head         0072 states that its result "is stable for a
--                              sealed TC and may legitimately evolve while TC
--                              is the open head", so an unsealed point is
--                              REPLAY_ANALYTICAL_PROJECTION_OPEN_HEAD and is
--                              retried later rather than frozen as history.
--   SHARED_WORLD / PUBLIC      the repository census found no canonical
--   _EXPERIENCE                time-indexed, knowledge-time-truthful,
--                              version-valid, deterministically revalidatable,
--                              hindsight-free analytical state for either
--                              class. A Shared QANDEEL_ANALYSIS item is SOURCE
--                              CONTENT in a Shared World and a bounded Public
--                              derivative is PUBLIC SOURCE MATERIAL; neither is
--                              a historical analytical projection of QANDEEL.
--                              So preview and finalization fail closed with
--                              REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE, the
--                              I-06A DRAFT stays exactly as valid as it was,
--                              and nothing is synthesized to make the two
--                              classes look renderable for API symmetry.
--
-- ===========================================================================
-- The canonical Replay lock order, preserved
-- ===========================================================================
--
--   1  public.replays                        FOR UPDATE
--   2  public.replay_draft_state             FOR UPDATE   (preview)
--      public.replay_current_version_state   FOR UPDATE   (finalize / reopen)
--   3  the source domain, through the frozen I-06A
--      public.replay_lock_source_manifest_v1(...)   SHARE, in the owning
--      domain's own order
--   4  the canonical historical projection, READ ONLY: it is STABLE, takes no
--      lock and writes nothing, so it adds no edge to the lock graph
--   5  the I-06B component writes
--
-- Replay is always the FIRST lock. No path here takes a source, projection,
-- render or version lock before the Replay row, so no Replay lock can be the
-- second edge of a cycle. No advisory lock, table lock or process mutex exists
-- anywhere in this migration.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- No distribution package, approver set, publish, share, download or export;
-- no Safety, moderation, entitlement, feature flag or Launch Gate decision; no
-- codec, container, bitrate, resolution, media storage, CDN or encoder; no
-- synthetic audio, narration or caption; no source-loss consequence after
-- finalization (I-06D); no route, controller, RPC or mobile surface; no
-- mutation of any Personal, Shared or Public relation - every source relation
-- is read and SHARE-locked only, and the historical substrate is read only. It
-- alters no predecessor table. Migrations 0001-0102 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE DURABLE COMMAND HISTORY.
--
--    One narrow relation per command family, never a generic event engine, in
--    exact parity with the frozen I-06A families. Each row is the idempotency
--    key AND the exact committed answer: an equivalent retry is served from
--    here rather than by re-reading current state, so a later source loss,
--    revision or finalization never makes a historical command answer
--    differently. `request_ref` binds the WHOLE immutable request. The actor is
--    bound to the Replay creator STRUCTURALLY through the 0100 identity key.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_preview_commands (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    resulting_replay_version_id uuid NOT NULL,
    resulting_lifecycle_event_id uuid NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT replay_preview_commands_pk PRIMARY KEY (id),
    -- One committed preview per exact complete Replay Version: two competing
    -- previews can never both commit the same version even if every procedural
    -- check above them were somehow bypassed.
    CONSTRAINT replay_preview_commands_version_key UNIQUE (resulting_replay_version_id),
    CONSTRAINT replay_preview_commands_request_check CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT replay_preview_commands_creator_fk
        FOREIGN KEY (replay_id, actor_user_id)
        REFERENCES public.replays (id, created_by_user_id) ON DELETE RESTRICT,
    CONSTRAINT replay_preview_commands_version_fk
        FOREIGN KEY (resulting_replay_version_id, replay_id)
        REFERENCES public.replay_versions (id, replay_id) ON DELETE RESTRICT,
    CONSTRAINT replay_preview_commands_event_fk
        FOREIGN KEY (resulting_lifecycle_event_id)
        REFERENCES public.replay_lifecycle_events (id) ON DELETE RESTRICT
);

CREATE INDEX replay_preview_commands_replay_idx ON public.replay_preview_commands (replay_id, committed_at);

CREATE TABLE public.replay_finalization_commands (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    replay_version_id uuid NOT NULL,
    resulting_lifecycle_event_id uuid NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT replay_finalization_commands_pk PRIMARY KEY (id),
    -- One committed finalization per exact version.
    CONSTRAINT replay_finalization_commands_version_key UNIQUE (replay_version_id),
    CONSTRAINT replay_finalization_commands_request_check CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT replay_finalization_commands_creator_fk
        FOREIGN KEY (replay_id, actor_user_id)
        REFERENCES public.replays (id, created_by_user_id) ON DELETE RESTRICT,
    -- The exact version, and the append-only evidence that names it.
    CONSTRAINT replay_finalization_commands_version_fk
        FOREIGN KEY (replay_version_id, replay_id)
        REFERENCES public.replay_versions (id, replay_id) ON DELETE RESTRICT,
    CONSTRAINT replay_finalization_commands_evidence_fk
        FOREIGN KEY (replay_version_id)
        REFERENCES public.replay_version_finalizations (replay_version_id) ON DELETE RESTRICT,
    CONSTRAINT replay_finalization_commands_event_fk
        FOREIGN KEY (resulting_lifecycle_event_id)
        REFERENCES public.replay_lifecycle_events (id) ON DELETE RESTRICT
);

CREATE INDEX replay_finalization_commands_replay_idx ON public.replay_finalization_commands (replay_id, committed_at);

CREATE TABLE public.replay_revision_reopen_commands (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    reopened_from_replay_version_id uuid NOT NULL,
    resulting_lifecycle_event_id uuid NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT replay_revision_reopen_commands_pk PRIMARY KEY (id),
    CONSTRAINT replay_revision_reopen_commands_event_key UNIQUE (resulting_lifecycle_event_id),
    CONSTRAINT replay_revision_reopen_commands_request_check CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT replay_revision_reopen_commands_creator_fk
        FOREIGN KEY (replay_id, actor_user_id)
        REFERENCES public.replays (id, created_by_user_id) ON DELETE RESTRICT,
    CONSTRAINT replay_revision_reopen_commands_version_fk
        FOREIGN KEY (reopened_from_replay_version_id, replay_id)
        REFERENCES public.replay_versions (id, replay_id) ON DELETE RESTRICT,
    CONSTRAINT replay_revision_reopen_commands_event_fk
        FOREIGN KEY (resulting_lifecycle_event_id)
        REFERENCES public.replay_lifecycle_events (id) ON DELETE RESTRICT
);

CREATE INDEX replay_revision_reopen_commands_replay_idx
    ON public.replay_revision_reopen_commands (replay_id, committed_at);

ALTER TABLE public.replay_preview_commands OWNER TO postgres;
ALTER TABLE public.replay_finalization_commands OWNER TO postgres;
ALTER TABLE public.replay_revision_reopen_commands OWNER TO postgres;
ALTER TABLE public.replay_preview_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_finalization_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_revision_reopen_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.replay_preview_commands, public.replay_finalization_commands,
                    public.replay_revision_reopen_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.replay_preview_commands, public.replay_finalization_commands, public.replay_revision_reopen_commands FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 2. THE CANONICAL ANALYTICAL PROJECTION CANONICALIZATION.
--
--    ONE family of K(TC), as deterministic text: every element rendered in
--    PostgreSQL's own canonical jsonb form (object keys stored and emitted in a
--    fixed order, numbers as canonical numeric text) and then SORTED by that
--    text under the C collation, so the result is a property of the SET and not
--    of the order the producer happened to emit. `p_drop` removes named keys
--    from every element before both the rendering and the sort.
--
--    This is the whole canonicalization algorithm, and it depends on no
--    language-runtime serializer at all: the truth identity is produced inside
--    PostgreSQL, so no JavaScript object insertion order can ever reach it.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.replay_canonical_projection_family_v1(p_label text, p_elements jsonb, p_drop text[])
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_label || '=' || coalesce((
    SELECT string_agg((e - p_drop)::text, '|' ORDER BY (e - p_drop)::text COLLATE "C")
      FROM jsonb_array_elements(coalesce(p_elements, '[]'::jsonb)) e), '')
$$;

ALTER FUNCTION public.replay_canonical_projection_family_v1(text, jsonb, text[]) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 3. THE ANALYTICAL STATE DIGEST OF ONE REPRESENTED POINT.
--
--    THE SOURCE-EVENT PAYLOAD IS EXCLUDED BY CONSTRUCTION. There is no
--    `moments` parameter here and there never can be one: K(TC)'s `moments`
--    array is the committed source text the source manifest already binds by
--    canonical source-identity digest, and `committedText` is source truth, not
--    analysis. A caller cannot pass it in, a future edit cannot slip it in
--    without changing the signature, and the static contract pins the
--    signature. That is what "excludes raw source-event payload" means here.
--
--    THE WALL-CLOCK EXPIRY MAPPING IS EXCLUDED TOO, and only it. Migration 0072
--    section 13 says a Material's expiry "is a policy fact in the wall-clock
--    domain ... It is NEVER compared to TC", and its PENDING -> SP(LH) mapping
--    legitimately moves with wall time while the sealed TC's historical answer
--    does not. `statusAtTc` - the TC-domain answer that mapping feeds - stays
--    inside the digest, because THAT is what 0072 proves sealed-stable.
--
--    The projection revision facts (`liveHead`, `worldVersion`,
--    `sameSpEventSequence`, `pendingExpiries`) are likewise absent: they are
--    freshness tokens of the live Session, not the historical answer at TC. The
--    points relation records them as the provenance of the derivation.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.replay_analytical_projection_point_digest_v1(
  p_represented_session_position integer,
  p_emerging_focuses jsonb,
  p_live_focus jsonb,
  p_threads jsonb,
  p_thread_reading_appearances jsonb,
  p_readings jsonb,
  p_reading_relations jsonb,
  p_evidence_participations jsonb,
  p_materials jsonb,
  p_gaps jsonb,
  p_questions jsonb,
  p_question_appearances jsonb,
  p_confidences jsonb
) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT 'sha256:' || encode(sha256(convert_to(
       'QANDEEL_REPLAY_ANALYTICAL_PROJECTION_V1' || E'\n'
    || 'tc=' || p_represented_session_position::text || E'\n'
    || 'liveFocus=' || coalesce(p_live_focus::text, 'null') || E'\n'
    || public.replay_canonical_projection_family_v1('emergingFocuses', p_emerging_focuses, ARRAY[]::text[]) || E'\n'
    || public.replay_canonical_projection_family_v1('threads', p_threads, ARRAY[]::text[]) || E'\n'
    || public.replay_canonical_projection_family_v1('threadReadingAppearances', p_thread_reading_appearances, ARRAY[]::text[]) || E'\n'
    || public.replay_canonical_projection_family_v1('readings', p_readings, ARRAY[]::text[]) || E'\n'
    || public.replay_canonical_projection_family_v1('readingRelations', p_reading_relations, ARRAY[]::text[]) || E'\n'
    || public.replay_canonical_projection_family_v1('evidenceParticipations', p_evidence_participations, ARRAY[]::text[]) || E'\n'
    || public.replay_canonical_projection_family_v1('materials', p_materials, ARRAY['expiry']) || E'\n'
    || public.replay_canonical_projection_family_v1('gaps', p_gaps, ARRAY[]::text[]) || E'\n'
    || public.replay_canonical_projection_family_v1('questions', p_questions, ARRAY[]::text[]) || E'\n'
    || public.replay_canonical_projection_family_v1('questionAppearances', p_question_appearances, ARRAY[]::text[]) || E'\n'
    || public.replay_canonical_projection_family_v1('confidences', p_confidences, ARRAY[]::text[]),
    'UTF8')), 'hex')
$$;

ALTER FUNCTION public.replay_analytical_projection_point_digest_v1(
  integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) OWNER TO postgres;

-- The digest of a WHOLE projection: its schema identity, its point count and
-- every point digest in selected order. Deterministic, and it changes when any
-- point, any represented coordinate or the number of points changes.
CREATE FUNCTION public.replay_analytical_projection_version_digest_v1(p_points text[])
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT 'sha256:' || encode(sha256(convert_to(
       'QANDEEL_REPLAY_ANALYTICAL_PROJECTION_V1' || E'\n'
    || 'points=' || cardinality(p_points)::text || E'\n'
    || array_to_string(p_points, E'\n'), 'UTF8')), 'hex')
$$;

ALTER FUNCTION public.replay_analytical_projection_version_digest_v1(text[]) OWNER TO postgres;

-- The digest of a render contract: the exact composition it binds and every
-- exact versioned policy it declares. The builder and the finalization
-- revalidation call THIS function, so the two can never drift.
CREATE FUNCTION public.replay_render_contract_digest_v1(
  p_replay_id uuid, p_source_manifest_version_id uuid, p_selection_spec_version_id uuid,
  p_analytical_projection_version_id uuid, p_projection_digest text, p_contract_schema_id text,
  p_source_medium_class text, p_original_medium_policy text, p_source_text_policy text,
  p_semantic_cut_policy text, p_temporal_discontinuity_policy text, p_timing_integrity_policy text,
  p_analytical_projection_policy text, p_camera_emphasis_policy text, p_motion_policy text,
  p_caption_provenance_policy text, p_accessibility_parity_policy text,
  p_reduced_motion_parity_policy text, p_editorial_annotation_policy text,
  p_discontinuity_count integer, p_point_count integer
) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT 'sha256:' || encode(sha256(convert_to(
       p_contract_schema_id || E'\n'
    || 'replay=' || lower(p_replay_id::text) || E'\n'
    || 'manifest=' || lower(p_source_manifest_version_id::text) || E'\n'
    || 'selection=' || lower(p_selection_spec_version_id::text) || E'\n'
    || 'projection=' || lower(p_analytical_projection_version_id::text) || E'\n'
    || 'projectionDigest=' || p_projection_digest || E'\n'
    || 'points=' || p_point_count::text || E'\n'
    || 'discontinuities=' || p_discontinuity_count::text || E'\n'
    || 'sourceMediumClass=' || p_source_medium_class || E'\n'
    || 'originalMedium=' || p_original_medium_policy || E'\n'
    || 'sourceText=' || p_source_text_policy || E'\n'
    || 'semanticCut=' || p_semantic_cut_policy || E'\n'
    || 'temporalDiscontinuity=' || p_temporal_discontinuity_policy || E'\n'
    || 'timingIntegrity=' || p_timing_integrity_policy || E'\n'
    || 'analyticalProjection=' || p_analytical_projection_policy || E'\n'
    || 'cameraEmphasis=' || p_camera_emphasis_policy || E'\n'
    || 'motion=' || p_motion_policy || E'\n'
    || 'captionProvenance=' || p_caption_provenance_policy || E'\n'
    || 'accessibilityParity=' || p_accessibility_parity_policy || E'\n'
    || 'reducedMotionParity=' || p_reduced_motion_parity_policy || E'\n'
    || 'editorialAnnotation=' || p_editorial_annotation_policy, 'UTF8')), 'hex')
$$;

ALTER FUNCTION public.replay_render_contract_digest_v1(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, integer, integer) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 4. SEMANTIC CUT SAFETY, DERIVED.
--
--    One assessment per selected item of one immutable selection spec, derived
--    from THAT ITEM'S OWN anchor kind and from nothing a caller said. The rule
--    is the conservative one and it is the whole rule:
--
--      WHOLE_ITEM              SAFE - nothing was trimmed, so no negation,
--                              qualification, attribution or clause context
--                              can have been removed
--      TEXT_CODE_POINT_RANGE   UNPROVEN - proving that a partial cut preserves
--                              them needs a canonical deterministic boundary /
--                              attribution substrate, this repository has none,
--                              and no NLP authority is invented here to make
--                              partial ranges pass
--
--    A selection is never silently widened to make a cut safe: an expansion is
--    a NEW explicit selection revision through the frozen I-06A draft path.
--    Re-deriving is a no-op, because a selection spec is immutable.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_replay_semantic_cut_safety_v1(
  p_selection_spec_version_id uuid, p_assessed_at timestamptz
) RETURNS TABLE(assessed_count integer, safe_count integer, unsafe_count integer)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_selection_spec_version_id IS NULL OR p_assessed_at IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.replay_selection_spec_versions sp
      JOIN public.replays r ON r.id = sp.replay_id
     WHERE sp.id = p_selection_spec_version_id AND r.created_by_user_id = u
  ) THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.replay_semantic_cut_assessments
    (selection_spec_version_id, source_item_ordinal, anchor_kind,
     assessment_algorithm, assessment_result, assessed_at)
  SELECT si.selection_spec_version_id, si.source_item_ordinal, si.anchor_kind,
         'QANDEEL_REPLAY_SEMANTIC_CUT_SAFETY_V1',
         CASE WHEN si.anchor_kind = 'WHOLE_ITEM' THEN 'SAFE' ELSE 'UNPROVEN' END,
         p_assessed_at
    FROM public.replay_selection_spec_items si
   WHERE si.selection_spec_version_id = p_selection_spec_version_id
  ON CONFLICT (selection_spec_version_id, source_item_ordinal) DO NOTHING;

  RETURN QUERY
    SELECT count(*)::integer,
           count(*) FILTER (WHERE a.assessment_result = 'SAFE')::integer,
           count(*) FILTER (WHERE a.assessment_result <> 'SAFE')::integer
      FROM public.replay_semantic_cut_assessments a
     WHERE a.selection_spec_version_id = p_selection_spec_version_id;
END$$;

ALTER FUNCTION public.derive_replay_semantic_cut_safety_v1(uuid, timestamptz) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 5. TEMPORAL DISCONTINUITY, DERIVED.
--
--    One row per adjacent selected pair whose captured source-universe ranks
--    are non-consecutive. Every value written is read from the immutable
--    selection and manifest rows; the omitted count is GENERATED by 0102 from
--    the two ranks, so even this writer cannot author it. No omitted item is
--    named and no omitted content is read: the gap is a count of authorized
--    source items that lie between two selected ones and nothing more.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_replay_temporal_discontinuities_v1(p_selection_spec_version_id uuid)
RETURNS TABLE(discontinuity_count integer, omitted_item_total integer)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_selection_spec_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.replay_selection_spec_versions sp
      JOIN public.replays r ON r.id = sp.replay_id
     WHERE sp.id = p_selection_spec_version_id AND r.created_by_user_id = u
  ) THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.replay_temporal_discontinuities
    (selection_spec_version_id, after_selected_ordinal, right_selected_ordinal,
     source_manifest_version_id, left_source_item_ordinal, right_source_item_ordinal,
     left_source_universe_rank, right_source_universe_rank)
  SELECT pair.selection_spec_version_id, pair.left_selected, pair.right_selected,
         pair.source_manifest_version_id, pair.left_ordinal, pair.right_ordinal,
         pair.left_rank, pair.right_rank
    FROM (
      SELECT si.selection_spec_version_id,
             si.selected_ordinal AS left_selected,
             lead(si.selected_ordinal) OVER w AS right_selected,
             si.source_manifest_version_id,
             si.source_item_ordinal AS left_ordinal,
             lead(si.source_item_ordinal) OVER w AS right_ordinal,
             mi.source_universe_rank AS left_rank,
             lead(mi.source_universe_rank) OVER w AS right_rank
        FROM public.replay_selection_spec_items si
        JOIN public.replay_source_manifest_items mi
          ON mi.manifest_version_id = si.source_manifest_version_id
         AND mi.source_item_ordinal = si.source_item_ordinal
       WHERE si.selection_spec_version_id = p_selection_spec_version_id
      WINDOW w AS (ORDER BY si.selected_ordinal)
    ) pair
   WHERE pair.right_selected IS NOT NULL AND pair.right_rank > pair.left_rank + 1
  ON CONFLICT (selection_spec_version_id, after_selected_ordinal) DO NOTHING;

  RETURN QUERY
    SELECT count(*)::integer, coalesce(sum(d.omitted_source_item_count), 0)::integer
      FROM public.replay_temporal_discontinuities d
     WHERE d.selection_spec_version_id = p_selection_spec_version_id;
END$$;

ALTER FUNCTION public.derive_replay_temporal_discontinuities_v1(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 6. THE ANALYTICAL PROJECTION, BUILT FROM THE CANONICAL HISTORICAL TRUTH.
--
--    For every selected source item, in selected order:
--
--      represented TC = the item's canonical Session Position (0065), read
--                       from the immutable manifest row and bound to it by
--                       foreign key when the point is written
--      K(TC)          = public.get_session_historical_projection_v1(session, TC)
--
--    and NOTHING ELSE is an analytical input. There is no model call, no
--    provider, no current-row fallback and no second temporal authority.
--
--    Any raise of the canonical projection is a CAPABILITY ABSENCE, not an
--    error a caller can read: a LEGACY UNCOVERED Session, an unestablished
--    Live Head, a missing baseline or an unaddressable coordinate all reach
--    ONE bounded class, so nothing here reconstructs history from current rows
--    and nothing leaks which of them it was.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.build_replay_analytical_projection_v1(
  p_replay_id uuid,
  p_projection_version_id uuid,
  p_projection_revision integer,
  p_selection_spec_version_id uuid,
  p_projection_instant timestamptz
) RETURNS TABLE(built_point_count integer, built_projection_digest text)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  spec public.replay_selection_spec_versions;
  manifest public.replay_source_manifest_versions;
  item record;
  projected record;
  ordinals integer[] := ARRAY[]::integer[];
  item_ordinals integer[] := ARRAY[]::integer[];
  positions integer[] := ARRAY[]::integer[];
  seals boolean[] := ARRAY[]::boolean[];
  heads integer[] := ARRAY[]::integer[];
  worlds bigint[] := ARRAY[]::bigint[];
  sequences bigint[] := ARRAY[]::bigint[];
  point_digests text[] := ARRAY[]::text[];
  tokens text[] := ARRAY[]::text[];
  point_ref text;
  total text;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_replay_id IS NULL OR p_projection_version_id IS NULL OR p_projection_revision IS NULL
     OR p_selection_spec_version_id IS NULL OR p_projection_instant IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT sp.* INTO spec FROM public.replay_selection_spec_versions sp
    JOIN public.replays r ON r.id = sp.replay_id
   WHERE sp.id = p_selection_spec_version_id AND sp.replay_id = p_replay_id AND r.created_by_user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  SELECT m.* INTO manifest FROM public.replay_source_manifest_versions m
   WHERE m.id = spec.source_manifest_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- THE REPOSITORY CENSUS, AS A REFUSAL. The canonical time-indexed,
  -- knowledge-time-truthful, version-valid, deterministically revalidatable,
  -- hindsight-free analytical state this repository actually has belongs to a
  -- covered Personal Session. A Shared QANDEEL_ANALYSIS history item is SOURCE
  -- CONTENT in a Shared World and a bounded Public derivative is PUBLIC SOURCE
  -- MATERIAL; neither is a historical analytical projection of QANDEEL, and
  -- neither is turned into one here to make the classes look symmetrical. The
  -- I-06A DRAFT of such a Replay stays exactly as valid as it was.
  IF manifest.source_class <> 'MY_WORLD' THEN
    RAISE EXCEPTION 'REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE' USING ERRCODE='0A000',
      DETAIL='No canonical historical analytical projection exists for this source class, and none is invented here: a Replay may remain a valid private draft without one.';
  END IF;

  -- EVERY POINT IS DERIVED FIRST, AND ONLY THEN IS ANYTHING WRITTEN. The
  -- version row carries the digest of the whole projection, so it cannot exist
  -- before every point is known; deriving first and writing once is what keeps
  -- these relations append-only for every role with no guard ever lifted.
  FOR item IN
    SELECT si.selected_ordinal, si.source_item_ordinal, mi.personal_session_position AS represented_tc
      FROM public.replay_selection_spec_items si
      JOIN public.replay_source_manifest_items mi
        ON mi.manifest_version_id = si.source_manifest_version_id
       AND mi.source_item_ordinal = si.source_item_ordinal
     WHERE si.selection_spec_version_id = spec.id
     ORDER BY si.selected_ordinal
  LOOP
    BEGIN
      SELECT * INTO projected
        FROM public.get_session_historical_projection_v1(manifest.personal_session_id, item.represented_tc);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE' USING ERRCODE='0A000',
        DETAIL='The canonical historical projection is unavailable at a represented coordinate of this Replay; no analytical state is reconstructed from current rows.';
    END;
    IF projected.tc IS NULL THEN
      RAISE EXCEPTION 'REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE' USING ERRCODE='0A000';
    END IF;
    -- A SEALED COORDINATE, OR NOTHING. Migration 0072: the result is stable for
    -- a sealed TC and may legitimately evolve while TC is the open head, so an
    -- open head is retried later rather than frozen as history.
    IF NOT projected.sealed THEN
      RAISE EXCEPTION 'REPLAY_ANALYTICAL_PROJECTION_OPEN_HEAD' USING ERRCODE='40001',
        DETAIL='A represented point is the open Live Head, whose canonical analytical answer may still legitimately evolve; it cannot be frozen into an immutable Replay Version.';
    END IF;

    point_ref := public.replay_analytical_projection_point_digest_v1(
      projected.tc, projected.emerging_focuses, projected.live_focus, projected.threads,
      projected.thread_reading_appearances, projected.readings, projected.reading_relations,
      projected.evidence_participations, projected.materials, projected.gaps,
      projected.questions, projected.question_appearances, projected.confidences);

    ordinals := ordinals || item.selected_ordinal;
    item_ordinals := item_ordinals || item.source_item_ordinal;
    positions := positions || item.represented_tc;
    seals := seals || projected.sealed;
    heads := heads || projected.live_head;
    worlds := worlds || (projected.revision ->> 'worldVersion')::bigint;
    sequences := sequences || (projected.revision ->> 'sameSpEventSequence')::bigint;
    point_digests := point_digests || point_ref;
    tokens := tokens || (item.selected_ordinal::text || '@' || item.represented_tc::text || ':' || point_ref);
  END LOOP;

  IF cardinality(tokens) <> spec.selected_item_count THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001',
      DETAIL='The projection covered a different number of points than the selection declares.';
  END IF;
  total := public.replay_analytical_projection_version_digest_v1(tokens);

  INSERT INTO public.replay_analytical_projection_versions
    (id, replay_id, source_manifest_version_id, selection_spec_version_id, projection_revision,
     source_class, projection_capability, projection_schema_id, point_count, projection_digest, created_at)
  VALUES (p_projection_version_id, p_replay_id, manifest.id, spec.id, p_projection_revision,
          'MY_WORLD', 'PERSONAL_SESSION_HISTORICAL_PROJECTION', 'QANDEEL_REPLAY_ANALYTICAL_PROJECTION_V1',
          spec.selected_item_count, total, p_projection_instant);

  INSERT INTO public.replay_analytical_projection_points
    (projection_version_id, selected_ordinal, selection_spec_version_id, source_manifest_version_id,
     source_item_ordinal, represented_session_position, projection_sealed, projection_live_head,
     projection_world_version, projection_same_sp_event_sequence, point_digest)
  -- The canonical projection's OWN sealed answer is carried, never a constant:
  -- an unsealed point raised above, and if that refusal were ever weakened the
  -- 0102 CHECK would still refuse the row rather than freeze an open head.
  SELECT p_projection_version_id, x.ord, spec.id, manifest.id, x.item_ord, x.tc,
         x.is_sealed, x.head, x.world, x.seq, x.point_ref
    FROM unnest(ordinals, item_ordinals, positions, seals, heads, worlds, sequences, point_digests)
         AS x(ord, item_ord, tc, is_sealed, head, world, seq, point_ref);

  RETURN QUERY SELECT spec.selected_item_count, total;
END$$;

ALTER FUNCTION public.build_replay_analytical_projection_v1(uuid, uuid, integer, uuid, timestamptz) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 7. THE RENDER CONTRACT, BUILT FROM THE BOUND COMPOSITION.
--
--    Every policy value is a constant of this migration, every one is
--    CHECK-pinned by 0102, and two of them are refusals rather than choices:
--
--      an audio-bearing source    a Shared voice note's frozen I-04G digest is
--                                 a body-IDENTITY digest over an opaque object
--                                 reference and a transcript. It attests no
--                                 media bytes and grants no media-delivery
--                                 capability, and this repository has no
--                                 authorized media path. Rendering it would
--                                 mean either inventing audio or promoting a
--                                 transcript to "original audio", and both are
--                                 synthetic source events. So it fails closed.
--      an unproven cut            only a WHOLE_ITEM selection can be SAFE, and
--                                 a contract that declared
--                                 WHOLE_ITEM_ONLY_PROVEN_SAFE over an UNPROVEN
--                                 cut would be a false claim.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.build_replay_render_contract_v1(
  p_replay_id uuid,
  p_contract_version_id uuid,
  p_contract_revision integer,
  p_analytical_projection_version_id uuid,
  p_contract_instant timestamptz
) RETURNS TABLE(built_contract_digest text, built_discontinuity_count integer)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  projection public.replay_analytical_projection_versions;
  gaps integer;
  unsafe integer;
  assessed integer;
  nontext integer;
  contract_ref text;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_replay_id IS NULL OR p_contract_version_id IS NULL OR p_contract_revision IS NULL
     OR p_analytical_projection_version_id IS NULL OR p_contract_instant IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT v.* INTO projection FROM public.replay_analytical_projection_versions v
    JOIN public.replays r ON r.id = v.replay_id
   WHERE v.id = p_analytical_projection_version_id AND v.replay_id = p_replay_id
     AND r.created_by_user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- EVERY SELECTED CUT IS PROVEN SAFE, or the contract cannot truthfully claim
  -- WHOLE_ITEM_ONLY_PROVEN_SAFE.
  SELECT count(*)::integer, count(*) FILTER (WHERE a.assessment_result <> 'SAFE')::integer
    INTO assessed, unsafe
    FROM public.replay_semantic_cut_assessments a
   WHERE a.selection_spec_version_id = projection.selection_spec_version_id;
  IF assessed <> projection.point_count OR unsafe > 0 THEN
    RAISE EXCEPTION 'REPLAY_SEMANTIC_CUT_UNSAFE' USING ERRCODE='0A000',
      DETAIL='A selected cut is not proven to preserve negation, qualification, attribution and clause context. Widen the selection through an explicit new draft revision; a Replay never widens a selection silently.';
  END IF;

  -- THE ORIGINAL MEDIUM IS TEXT, or there is no truthful way to render it.
  SELECT count(*)::integer INTO nontext
    FROM public.replay_selection_spec_items si
    JOIN public.replay_source_manifest_items mi
      ON mi.manifest_version_id = si.source_manifest_version_id
     AND mi.source_item_ordinal = si.source_item_ordinal
   WHERE si.selection_spec_version_id = projection.selection_spec_version_id
     AND mi.original_medium <> 'ORIGINAL_TEXT';
  IF nontext > 0 THEN
    RAISE EXCEPTION 'REPLAY_RENDER_MEDIUM_UNAVAILABLE' USING ERRCODE='0A000',
      DETAIL='A selected source item is not original text, and no authorized original-media delivery path exists. An absent original medium is never fabricated, and a transcript is never promoted to an original spoken event.';
  END IF;

  SELECT count(*)::integer INTO gaps FROM public.replay_temporal_discontinuities d
   WHERE d.selection_spec_version_id = projection.selection_spec_version_id;

  contract_ref := public.replay_render_contract_digest_v1(
    p_replay_id, projection.source_manifest_version_id, projection.selection_spec_version_id,
    projection.id, projection.projection_digest, 'QANDEEL_REPLAY_RENDER_CONTRACT_V1',
    'ORIGINAL_TEXT_ONLY', 'PRESERVE_ORIGINAL_MEDIUM_ONLY', 'EXACT_SOURCE_TEXT',
    'WHOLE_ITEM_ONLY_PROVEN_SAFE', 'PERCEPTIBLE_DISCONTINUITY_REQUIRED', 'PRESENTATION_PACING_DECLARED',
    'BOUND_HISTORICAL_PROJECTION_DIGEST', 'EMPHASIS_WITHOUT_MEANING_CREATION', 'EXPLANATORY_MOTION_ONLY',
    'DERIVED_CAPTION_DISTINCT_FROM_SOURCE', 'EQUIVALENT_TRUTH_REQUIRED', 'EQUIVALENT_TRUTH_REQUIRED',
    'NO_EDITORIAL_ANNOTATION', gaps, projection.point_count);

  INSERT INTO public.replay_render_contract_versions
    (id, replay_id, source_manifest_version_id, selection_spec_version_id,
     analytical_projection_version_id, contract_revision, contract_schema_id, source_medium_class,
     original_medium_policy, source_text_policy, semantic_cut_policy, temporal_discontinuity_policy,
     timing_integrity_policy, analytical_projection_policy, camera_emphasis_policy, motion_policy,
     caption_provenance_policy, accessibility_parity_policy, reduced_motion_parity_policy,
     editorial_annotation_policy, discontinuity_count, contract_digest, created_at)
  VALUES (p_contract_version_id, p_replay_id, projection.source_manifest_version_id,
          projection.selection_spec_version_id, projection.id, p_contract_revision,
          'QANDEEL_REPLAY_RENDER_CONTRACT_V1', 'ORIGINAL_TEXT_ONLY',
          'PRESERVE_ORIGINAL_MEDIUM_ONLY', 'EXACT_SOURCE_TEXT', 'WHOLE_ITEM_ONLY_PROVEN_SAFE',
          'PERCEPTIBLE_DISCONTINUITY_REQUIRED', 'PRESENTATION_PACING_DECLARED',
          'BOUND_HISTORICAL_PROJECTION_DIGEST', 'EMPHASIS_WITHOUT_MEANING_CREATION',
          'EXPLANATORY_MOTION_ONLY', 'DERIVED_CAPTION_DISTINCT_FROM_SOURCE',
          'EQUIVALENT_TRUTH_REQUIRED', 'EQUIVALENT_TRUTH_REQUIRED', 'NO_EDITORIAL_ANNOTATION',
          gaps, contract_ref, p_contract_instant);

  RETURN QUERY SELECT contract_ref, gaps;
END$$;

ALTER FUNCTION public.build_replay_render_contract_v1(uuid, uuid, integer, uuid, timestamptz) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 8. THE TRUTH REVALIDATION FINALIZATION RUNS.
--
--    Read-only, STABLE, takes no lock: a caller that needs a stable answer
--    holds the Replay and the source, exactly as the frozen I-06A currency
--    derivation documents. It asks, of ONE exact complete Replay Version,
--    whether every truth it froze is still exactly what it froze:
--
--      PROJECTION_MOVED    re-deriving the canonical historical projection at
--                          a represented coordinate no longer digests to what
--                          the version committed, or a represented point is no
--                          longer sealed, or the projection is no longer
--                          available at all
--      CUT_UNSAFE          a selected cut is no longer proven safe
--      RENDER_CONTRACT     the render contract no longer digests to what it
--      _MOVED              recorded from its own bound composition
--
--    It answers a two-state verdict and an internal cause; the read boundary
--    below returns the verdict only.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_replay_version_truth_currency_v1(p_replay_version_id uuid)
RETURNS TABLE(currency_state text, divergence_class text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  version public.replay_versions;
  projection public.replay_analytical_projection_versions;
  contract public.replay_render_contract_versions;
  manifest public.replay_source_manifest_versions;
  point record;
  projected record;
  recomputed text;
  assessed integer;
  unsafe integer;
BEGIN
  IF p_replay_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT v.* INTO version FROM public.replay_versions v WHERE v.id = p_replay_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT p.* INTO projection FROM public.replay_analytical_projection_versions p
   WHERE p.id = version.analytical_projection_version_id;
  SELECT c.* INTO contract FROM public.replay_render_contract_versions c
   WHERE c.id = version.render_contract_version_id;
  SELECT m.* INTO manifest FROM public.replay_source_manifest_versions m
   WHERE m.id = version.source_manifest_version_id;

  -- Semantic Cut Safety, still complete and still entirely SAFE.
  SELECT count(*)::integer, count(*) FILTER (WHERE a.assessment_result <> 'SAFE')::integer
    INTO assessed, unsafe
    FROM public.replay_semantic_cut_assessments a
   WHERE a.selection_spec_version_id = version.selection_spec_version_id;
  IF assessed <> projection.point_count OR unsafe > 0 THEN
    RETURN QUERY SELECT 'DIVERGED'::text, 'CUT_UNSAFE'::text; RETURN;
  END IF;

  -- The analytical projection, re-derived at every represented coordinate.
  FOR point IN
    SELECT pt.* FROM public.replay_analytical_projection_points pt
     WHERE pt.projection_version_id = projection.id
     ORDER BY pt.selected_ordinal
  LOOP
    BEGIN
      SELECT * INTO projected
        FROM public.get_session_historical_projection_v1(manifest.personal_session_id, point.represented_session_position);
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 'DIVERGED'::text, 'PROJECTION_UNAVAILABLE'::text; RETURN;
    END;
    IF projected IS NULL OR NOT projected.sealed THEN
      RETURN QUERY SELECT 'DIVERGED'::text, 'PROJECTION_UNSEALED'::text; RETURN;
    END IF;
    recomputed := public.replay_analytical_projection_point_digest_v1(
      projected.tc, projected.emerging_focuses, projected.live_focus, projected.threads,
      projected.thread_reading_appearances, projected.readings, projected.reading_relations,
      projected.evidence_participations, projected.materials, projected.gaps,
      projected.questions, projected.question_appearances, projected.confidences);
    IF recomputed IS DISTINCT FROM point.point_digest THEN
      RETURN QUERY SELECT 'DIVERGED'::text, 'PROJECTION_MOVED'::text; RETURN;
    END IF;
  END LOOP;

  -- The render contract, re-derived from its own bound composition.
  recomputed := public.replay_render_contract_digest_v1(
    contract.replay_id, contract.source_manifest_version_id, contract.selection_spec_version_id,
    contract.analytical_projection_version_id, projection.projection_digest, contract.contract_schema_id,
    contract.source_medium_class, contract.original_medium_policy, contract.source_text_policy,
    contract.semantic_cut_policy, contract.temporal_discontinuity_policy, contract.timing_integrity_policy,
    contract.analytical_projection_policy, contract.camera_emphasis_policy, contract.motion_policy,
    contract.caption_provenance_policy, contract.accessibility_parity_policy,
    contract.reduced_motion_parity_policy, contract.editorial_annotation_policy,
    contract.discontinuity_count, projection.point_count);
  IF recomputed IS DISTINCT FROM contract.contract_digest THEN
    RETURN QUERY SELECT 'DIVERGED'::text, 'RENDER_CONTRACT_MOVED'::text; RETURN;
  END IF;
  IF (SELECT count(*)::integer FROM public.replay_temporal_discontinuities d
       WHERE d.selection_spec_version_id = version.selection_spec_version_id)
     <> contract.discontinuity_count THEN
    RETURN QUERY SELECT 'DIVERGED'::text, 'RENDER_CONTRACT_MOVED'::text; RETURN;
  END IF;

  RETURN QUERY SELECT 'CURRENT'::text, NULL::text;
END$$;

ALTER FUNCTION public.derive_replay_version_truth_currency_v1(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 9. PREPARE A PRIVATE REPLAY PREVIEW.
--
--    PREVIEW_READY means exactly this: the current draft has been truthfully
--    compiled into ONE complete immutable Replay Version whose analytical
--    projection and render contract pass every required internal truth gate.
--    It does NOT mean distributed, approved for Public, downloadable, encoded
--    as a final video, launch-cleared, Safety-approved or entitled for export.
--
--    The previewing human is exactly auth.uid() and must be the creator. The
--    caller supplies opaque persistence identities and the draft revision it
--    composed against, and no actor, authority, audience, digest, safety
--    result, discontinuity, coverage or instant. ONE database clock read
--    serves every authoritative moment.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.prepare_replay_preview_v1(
  p_command_id uuid,
  p_replay_id uuid,
  p_expected_draft_revision bigint,
  p_projection_version_id uuid,
  p_render_contract_version_id uuid,
  p_replay_version_id uuid
) RETURNS TABLE(outcome text, committed_replay_id uuid, replay_lifecycle text,
                committed_replay_version_id uuid, replay_version_revision integer,
                projection_point_count integer, semantic_cut_safe_count integer,
                temporal_discontinuity_count integer, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.replay_preview_commands;
  replay public.replays;
  state public.replay_draft_state;
  currency text;
  safety record;
  gaps record;
  projected record;
  built record;
  next_projection integer;
  next_contract integer;
  next_version integer;
  next_event integer;
  event_id uuid;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_replay_id IS NULL OR p_expected_draft_revision IS NULL
     OR p_expected_draft_revision < 1 OR p_projection_version_id IS NULL
     OR p_render_contract_version_id IS NULL OR p_replay_version_id IS NULL
     OR p_replay_id = p_projection_version_id OR p_replay_id = p_render_contract_version_id
     OR p_replay_id = p_replay_version_id
     OR p_projection_version_id = p_render_contract_version_id
     OR p_projection_version_id = p_replay_version_id
     OR p_render_contract_version_id = p_replay_version_id THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_REPLAY_PREVIEW_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'replay=' || lower(p_replay_id::text) || E'\n'
   || 'expectedRevision=' || p_expected_draft_revision::text || E'\n'
   || 'projection=' || lower(p_projection_version_id::text) || E'\n'
   || 'renderContract=' || lower(p_render_contract_version_id::text) || E'\n'
   || 'replayVersion=' || lower(p_replay_version_id::text), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, reading only immutable
  -- command history, so an equivalent retry answers even after the source moved.
  SELECT * INTO committed FROM public.replay_preview_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY
      SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, r.current_lifecycle,
             committed.resulting_replay_version_id, rv.replay_version_revision, pv.point_count,
             pv.point_count, rc.discontinuity_count, committed.committed_at
        FROM public.replays r
        JOIN public.replay_versions rv ON rv.id = committed.resulting_replay_version_id
        JOIN public.replay_analytical_projection_versions pv ON pv.id = rv.analytical_projection_version_id
        JOIN public.replay_render_contract_versions rc ON rc.id = rv.render_contract_version_id
       WHERE r.id = committed.replay_id;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the Replay. The exact creator, and nobody
  -- else - one bounded class for a stranger and a Replay that does not exist.
  SELECT * INTO replay FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE;
  IF NOT FOUND OR replay.created_by_user_id <> u THEN
    RAISE EXCEPTION 'REPLAY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the lock.
  SELECT * INTO committed FROM public.replay_preview_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY
      SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, replay.current_lifecycle,
             committed.resulting_replay_version_id, rv.replay_version_revision, pv.point_count,
             pv.point_count, rc.discontinuity_count, committed.committed_at
        FROM public.replay_versions rv
        JOIN public.replay_analytical_projection_versions pv ON pv.id = rv.analytical_projection_version_id
        JOIN public.replay_render_contract_versions rc ON rc.id = rv.render_contract_version_id
       WHERE rv.id = committed.resulting_replay_version_id;
    RETURN;
  END IF;

  -- ONLY A DRAFT IS PREVIEWED. A second preview of an already PREVIEW_READY or
  -- FINALIZED Replay is the stale loser of a race, and is refused rather than
  -- applied to whatever is current.
  IF replay.current_lifecycle <> 'DRAFT' THEN
    RAISE EXCEPTION 'REPLAY_LIFECYCLE_INVALID' USING ERRCODE='55000',
      DETAIL='A preview is prepared from a DRAFT. Reopen the Replay for revision first.';
  END IF;

  -- STEP 2: the draft composition, and COMPARE AND SWAP on the exact revision
  -- the caller composed against.
  SELECT * INTO state FROM public.replay_draft_state s WHERE s.replay_id = p_replay_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF state.draft_revision <> p_expected_draft_revision THEN
    RAISE EXCEPTION 'REPLAY_DRAFT_STALE' USING ERRCODE='40001',
      DETAIL='The draft moved after this preview was composed; the previous prepared state cannot silently commit.';
  END IF;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of the preview.
  instant := clock_timestamp();

  -- STEP 3: the source, stabilized in its own domain's frozen order and proven
  -- still current before any component may be written. The frozen I-06A
  -- derivation is consumed; no competing source-currency evaluator exists.
  PERFORM public.replay_lock_source_manifest_v1(state.current_source_manifest_version_id);
  SELECT c.currency_state INTO currency
    FROM public.derive_replay_source_manifest_currency_v1(state.current_source_manifest_version_id) c;
  IF currency IS DISTINCT FROM 'CURRENT' THEN
    RAISE EXCEPTION 'REPLAY_SOURCE_STALE' USING ERRCODE='40001',
      DETAIL='A bound source changed, became unavailable, is no longer visible to the creator or is no longer the eligible version; a Replay Version cannot be built over it.';
  END IF;

  -- STEP 4: Semantic Cut Safety, derived and GATED. Only SAFE may enter a
  -- complete Replay Version, and a selection is never widened here.
  SELECT * INTO safety FROM public.derive_replay_semantic_cut_safety_v1(
    state.current_selection_spec_version_id, instant);
  IF safety.unsafe_count > 0 THEN
    RAISE EXCEPTION 'REPLAY_SEMANTIC_CUT_UNSAFE' USING ERRCODE='0A000',
      DETAIL='A selected cut is not proven to preserve negation, qualification, attribution and clause context. Widen the selection through an explicit new draft revision; a Replay never widens a selection silently.';
  END IF;

  -- STEP 5: where the real gaps are.
  SELECT * INTO gaps FROM public.derive_replay_temporal_discontinuities_v1(
    state.current_selection_spec_version_id);

  -- STEP 6 and 7: the analytical projection, then the render contract over it.
  SELECT coalesce(max(v.projection_revision), 0) + 1 INTO next_projection
    FROM public.replay_analytical_projection_versions v WHERE v.replay_id = p_replay_id;
  SELECT * INTO projected FROM public.build_replay_analytical_projection_v1(
    p_replay_id, p_projection_version_id, next_projection, state.current_selection_spec_version_id, instant);

  SELECT coalesce(max(c.contract_revision), 0) + 1 INTO next_contract
    FROM public.replay_render_contract_versions c WHERE c.replay_id = p_replay_id;
  SELECT * INTO built FROM public.build_replay_render_contract_v1(
    p_replay_id, p_render_contract_version_id, next_contract, p_projection_version_id, instant);

  -- STEP 8: THE FIRST COMPLETE REPLAY VERSION - all four components, bound as
  -- ONE composition by the 0102 composite foreign keys.
  SELECT coalesce(max(rv.replay_version_revision), 0) + 1 INTO next_version
    FROM public.replay_versions rv WHERE rv.replay_id = p_replay_id;
  INSERT INTO public.replay_versions
    (id, replay_id, replay_version_revision, source_manifest_version_id, selection_spec_version_id,
     analytical_projection_version_id, render_contract_version_id, created_at)
  VALUES (p_replay_version_id, p_replay_id, next_version, state.current_source_manifest_version_id,
          state.current_selection_spec_version_id, p_projection_version_id,
          p_render_contract_version_id, instant);

  -- STEP 9: the current-version pointer, forward only.
  INSERT INTO public.replay_current_version_state
    (replay_id, current_replay_version_id, pointer_revision, updated_at)
  VALUES (p_replay_id, p_replay_version_id, 1, instant)
  ON CONFLICT (replay_id) DO UPDATE
    SET current_replay_version_id = p_replay_version_id,
        pointer_revision = public.replay_current_version_state.pointer_revision + 1,
        updated_at = instant;

  -- STEP 10: the lifecycle, atomically, with its append-only evidence.
  SELECT coalesce(max(e.event_ordinal), 0) + 1 INTO next_event
    FROM public.replay_lifecycle_events e WHERE e.replay_id = p_replay_id;
  event_id := gen_random_uuid();
  INSERT INTO public.replay_lifecycle_events
    (id, replay_id, event_ordinal, from_lifecycle, to_lifecycle, replay_version_id, actor_user_id, occurred_at)
  VALUES (event_id, p_replay_id, next_event, 'DRAFT', 'PREVIEW_READY', p_replay_version_id, u, instant);
  UPDATE public.replays r SET current_lifecycle = 'PREVIEW_READY' WHERE r.id = p_replay_id;

  -- STEP 11: the durable command answer. PREVIEW_READY WIDENS NOTHING: no
  -- relation naming a package, an approver, a World membership or a public
  -- surface is read or written anywhere above, which the self-assertions check
  -- of this function's own text.
  INSERT INTO public.replay_preview_commands
    (id, replay_id, actor_user_id, resulting_replay_version_id, resulting_lifecycle_event_id,
     request_ref, committed_at)
  VALUES (p_command_id, p_replay_id, u, p_replay_version_id, event_id, request, instant);

  RETURN QUERY SELECT 'REPLAY_PREVIEW_READY'::text, p_replay_id, 'PREVIEW_READY'::text,
                      p_replay_version_id, next_version, projected.built_point_count,
                      safety.safe_count, built.built_discontinuity_count, instant;
END$$;

ALTER FUNCTION public.prepare_replay_preview_v1(uuid, uuid, bigint, uuid, uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 10. FINALIZE ONE EXACT COMPLETE REPLAY VERSION.
--
--     FINALIZED means exactly this: ONE exact complete Replay Version passed
--     final source, projection and render truth revalidation and is frozen as a
--     private finalized version. FINALIZED IS NOT DISTRIBUTED. It creates no
--     package, no approval, no audience and no external artifact, and it
--     reserves no future authority for Public publication, external share or
--     download. A finalized Replay may remain private forever.
--
--     Nothing here regenerates missing source and nothing here builds a new
--     Replay Version: if truth changed, this fails and the creator starts a new
--     draft / version cycle.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.finalize_replay_version_v1(
  p_command_id uuid,
  p_replay_id uuid,
  p_expected_replay_version_id uuid
) RETURNS TABLE(outcome text, committed_replay_id uuid, replay_lifecycle text,
                committed_replay_version_id uuid, replay_version_revision integer,
                committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.replay_finalization_commands;
  replay public.replays;
  pointer public.replay_current_version_state;
  version public.replay_versions;
  currency text;
  divergence text;
  next_event integer;
  event_id uuid;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_replay_id IS NULL OR p_expected_replay_version_id IS NULL
     OR p_replay_id = p_expected_replay_version_id THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_REPLAY_FINALIZATION_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'replay=' || lower(p_replay_id::text) || E'\n'
   || 'replayVersion=' || lower(p_expected_replay_version_id::text), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock.
  SELECT * INTO committed FROM public.replay_finalization_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY
      SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, r.current_lifecycle,
             committed.replay_version_id, rv.replay_version_revision, committed.committed_at
        FROM public.replays r
        JOIN public.replay_versions rv ON rv.id = committed.replay_version_id
       WHERE r.id = committed.replay_id;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the Replay.
  SELECT * INTO replay FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE;
  IF NOT FOUND OR replay.created_by_user_id <> u THEN
    RAISE EXCEPTION 'REPLAY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the lock.
  SELECT * INTO committed FROM public.replay_finalization_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY
      SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, replay.current_lifecycle,
             committed.replay_version_id, rv.replay_version_revision, committed.committed_at
        FROM public.replay_versions rv WHERE rv.id = committed.replay_version_id;
    RETURN;
  END IF;

  IF replay.current_lifecycle <> 'PREVIEW_READY' THEN
    RAISE EXCEPTION 'REPLAY_LIFECYCLE_INVALID' USING ERRCODE='55000',
      DETAIL='Only a PREVIEW_READY Replay is finalized, and exactly once per complete Replay Version.';
  END IF;

  -- STEP 2: the current-version pointer, and the EXACT expected version.
  SELECT * INTO pointer FROM public.replay_current_version_state s
   WHERE s.replay_id = p_replay_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF pointer.current_replay_version_id <> p_expected_replay_version_id THEN
    RAISE EXCEPTION 'REPLAY_VERSION_STALE' USING ERRCODE='40001',
      DETAIL='The Replay Version this finalization names is not the current previewed version.';
  END IF;
  SELECT v.* INTO version FROM public.replay_versions v
   WHERE v.id = p_expected_replay_version_id AND v.replay_id = p_replay_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  instant := clock_timestamp();

  -- STEP 3: the source, stabilized and revalidated exactly as at preview time.
  -- A deleted, changed, invisible or non-current source refuses the
  -- finalization; nothing is regenerated and no shadow copy exists to bypass it.
  PERFORM public.replay_lock_source_manifest_v1(version.source_manifest_version_id);
  SELECT c.currency_state INTO currency
    FROM public.derive_replay_source_manifest_currency_v1(version.source_manifest_version_id) c;
  IF currency IS DISTINCT FROM 'CURRENT' THEN
    RAISE EXCEPTION 'REPLAY_SOURCE_STALE' USING ERRCODE='40001',
      DETAIL='A bound source changed, became unavailable, is no longer visible to the creator or is no longer the eligible version; a stale Replay Version cannot finalize.';
  END IF;

  -- STEP 4: the frozen truth, re-derived and compared.
  SELECT t.divergence_class INTO divergence
    FROM public.derive_replay_version_truth_currency_v1(p_expected_replay_version_id) t
   WHERE t.currency_state = 'DIVERGED';
  IF FOUND THEN
    IF divergence = 'CUT_UNSAFE' THEN
      RAISE EXCEPTION 'REPLAY_SEMANTIC_CUT_UNSAFE' USING ERRCODE='0A000';
    ELSIF divergence = 'RENDER_CONTRACT_MOVED' THEN
      RAISE EXCEPTION 'REPLAY_RENDER_CONTRACT_STALE' USING ERRCODE='40001',
        DETAIL='The render contract no longer matches the composition it recorded; a new validated version is required.';
    ELSE
      RAISE EXCEPTION 'REPLAY_ANALYTICAL_PROJECTION_STALE' USING ERRCODE='40001',
        DETAIL='The canonical historical analytical answer at a represented coordinate is no longer what this Replay Version froze; a new draft and version cycle is required.';
    END IF;
  END IF;

  -- STEP 5: the lifecycle, the exact-version evidence and the durable command,
  -- atomically. FINALIZED WIDENED NO AUDIENCE.
  SELECT coalesce(max(e.event_ordinal), 0) + 1 INTO next_event
    FROM public.replay_lifecycle_events e WHERE e.replay_id = p_replay_id;
  event_id := gen_random_uuid();
  INSERT INTO public.replay_lifecycle_events
    (id, replay_id, event_ordinal, from_lifecycle, to_lifecycle, replay_version_id, actor_user_id, occurred_at)
  VALUES (event_id, p_replay_id, next_event, 'PREVIEW_READY', 'FINALIZED', p_expected_replay_version_id, u, instant);
  UPDATE public.replays r SET current_lifecycle = 'FINALIZED' WHERE r.id = p_replay_id;

  INSERT INTO public.replay_version_finalizations
    (replay_version_id, replay_id, finalized_by_user_id, finalized_at)
  VALUES (p_expected_replay_version_id, p_replay_id, u, instant);

  INSERT INTO public.replay_finalization_commands
    (id, replay_id, actor_user_id, replay_version_id, resulting_lifecycle_event_id, request_ref, committed_at)
  VALUES (p_command_id, p_replay_id, u, p_expected_replay_version_id, event_id, request, instant);

  RETURN QUERY SELECT 'REPLAY_VERSION_FINALIZED'::text, p_replay_id, 'FINALIZED'::text,
                      p_expected_replay_version_id, version.replay_version_revision, instant;
END$$;

ALTER FUNCTION public.finalize_replay_version_v1(uuid, uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 11. REOPEN FOR REVISION.
--
--     The frozen architecture allows later editing to create a NEW Replay
--     Version and never to mutate an old one, so this is the whole seam: an
--     explicit creator-exact command that returns the STABLE Replay to DRAFT.
--
--     The old Replay Version stays immutable, byte for byte. A previously
--     finalized version stays historically finalized - its evidence row is
--     append-only and keyed by that exact version, so returning to DRAFT
--     erases nothing and I-06C can still ask "was THIS version finalized?".
--     The current-version pointer keeps naming the last complete version,
--     because that is still true; a later preview advances it to a NEW one.
--
--     No distribution behaviour exists here for the old or the new version.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reopen_replay_for_revision_v1(
  p_command_id uuid,
  p_replay_id uuid,
  p_expected_replay_version_id uuid
) RETURNS TABLE(outcome text, committed_replay_id uuid, replay_lifecycle text,
                reopened_from_replay_version_id uuid, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.replay_revision_reopen_commands;
  replay public.replays;
  pointer public.replay_current_version_state;
  next_event integer;
  event_id uuid;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_replay_id IS NULL OR p_expected_replay_version_id IS NULL
     OR p_replay_id = p_expected_replay_version_id THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_REPLAY_REVISION_REOPEN_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'replay=' || lower(p_replay_id::text) || E'\n'
   || 'replayVersion=' || lower(p_expected_replay_version_id::text), 'UTF8')), 'hex');

  SELECT * INTO committed FROM public.replay_revision_reopen_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY
      SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, r.current_lifecycle,
             committed.reopened_from_replay_version_id, committed.committed_at
        FROM public.replays r WHERE r.id = committed.replay_id;
    RETURN;
  END IF;

  SELECT * INTO replay FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE;
  IF NOT FOUND OR replay.created_by_user_id <> u THEN
    RAISE EXCEPTION 'REPLAY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.replay_revision_reopen_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, replay.current_lifecycle,
                        committed.reopened_from_replay_version_id, committed.committed_at;
    RETURN;
  END IF;

  IF replay.current_lifecycle NOT IN ('PREVIEW_READY', 'FINALIZED') THEN
    RAISE EXCEPTION 'REPLAY_LIFECYCLE_INVALID' USING ERRCODE='55000',
      DETAIL='A Replay returns to DRAFT only from PREVIEW_READY or FINALIZED, and only through this explicit creator-exact command.';
  END IF;

  SELECT * INTO pointer FROM public.replay_current_version_state s
   WHERE s.replay_id = p_replay_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF pointer.current_replay_version_id <> p_expected_replay_version_id THEN
    RAISE EXCEPTION 'REPLAY_VERSION_STALE' USING ERRCODE='40001',
      DETAIL='The Replay Version this reopen names is not the current one.';
  END IF;

  instant := clock_timestamp();

  SELECT coalesce(max(e.event_ordinal), 0) + 1 INTO next_event
    FROM public.replay_lifecycle_events e WHERE e.replay_id = p_replay_id;
  event_id := gen_random_uuid();
  INSERT INTO public.replay_lifecycle_events
    (id, replay_id, event_ordinal, from_lifecycle, to_lifecycle, replay_version_id, actor_user_id, occurred_at)
  VALUES (event_id, p_replay_id, next_event, replay.current_lifecycle, 'DRAFT',
          p_expected_replay_version_id, u, instant);
  UPDATE public.replays r SET current_lifecycle = 'DRAFT' WHERE r.id = p_replay_id;

  INSERT INTO public.replay_revision_reopen_commands
    (id, replay_id, actor_user_id, reopened_from_replay_version_id, resulting_lifecycle_event_id,
     request_ref, committed_at)
  VALUES (p_command_id, p_replay_id, u, p_expected_replay_version_id, event_id, request, instant);

  RETURN QUERY SELECT 'REPLAY_REOPENED_FOR_REVISION'::text, p_replay_id, 'DRAFT'::text,
                      p_expected_replay_version_id, instant;
END$$;

ALTER FUNCTION public.reopen_replay_for_revision_v1(uuid, uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 12. THE ONE CREATOR-EXACT READ BOUNDARY.
--
--     It answers the exact CREATOR of one Replay and nobody else: a stranger,
--     and a human asking about a Replay that does not exist, receive ZERO ROWS,
--     so the surface discloses nothing. It returns the version composition's
--     SHAPE and whether that exact version is finalized, and NO source
--     identity: no Session, World, material, unit, package item, digest,
--     availability revision, media handle or internal divergence cause. It
--     follows the frozen narrow read-boundary precedent of 0087 / 0089 / 0093 /
--     0101: service_role alone may execute it, and no direct table privilege
--     exists behind it.
--
--     IT DELIBERATELY DOES NOT REPORT ANALYTICAL TRUTH CURRENCY. The frozen
--     I-06A source currency can be a property of the Replay and its creator
--     rather than of whoever asks, because its inputs are owner-scoped columns.
--     The analytical one cannot: the canonical historical projection is
--     owner-scoped on auth.uid() itself, so re-deriving it inside a
--     service-tier read would answer for whoever the session claims to be, and
--     a resolver that reported "your Replay went stale" because the SERVICE
--     asked would be worse than one that stays silent. The truth revalidation
--     therefore happens exactly where the exact human is present and holds the
--     locks: inside finalization.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_replay_current_version_v1(p_replay_id uuid, p_user_id uuid)
RETURNS TABLE(replay_id uuid, current_lifecycle text, replay_version_id uuid,
              replay_version_revision integer, projection_capability text,
              projection_point_count integer, semantic_cut_safe_count integer,
              temporal_discontinuity_count integer, render_contract_revision integer,
              source_medium_class text, timing_integrity_policy text,
              version_finalized boolean, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_replay_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
    SELECT r.id, r.current_lifecycle, rv.id, rv.replay_version_revision, pv.projection_capability,
           pv.point_count,
           (SELECT count(*)::integer FROM public.replay_semantic_cut_assessments a
             WHERE a.selection_spec_version_id = rv.selection_spec_version_id
               AND a.assessment_result = 'SAFE'),
           rc.discontinuity_count, rc.contract_revision, rc.source_medium_class,
           rc.timing_integrity_policy,
           EXISTS (SELECT 1 FROM public.replay_version_finalizations f WHERE f.replay_version_id = rv.id),
           s.updated_at
      FROM public.replays r
      JOIN public.replay_current_version_state s ON s.replay_id = r.id
      JOIN public.replay_versions rv ON rv.id = s.current_replay_version_id
      JOIN public.replay_analytical_projection_versions pv ON pv.id = rv.analytical_projection_version_id
      JOIN public.replay_render_contract_versions rc ON rc.id = rv.render_contract_version_id
     WHERE r.id = p_replay_id AND r.created_by_user_id = p_user_id;
END$$;

ALTER FUNCTION public.resolve_replay_current_version_v1(uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 13. SECURITY POSTURE.
--
--     Every function is postgres-owned, SECURITY DEFINER where it acts, and
--     search_path-pinned. Every mutation, every derivation core and the truth
--     revalidation are executable by NO application role. The ONE read boundary
--     is service_role-executable alone. Preview and finalization are NOT made
--     reachable from the product API to make tests convenient: the frozen
--     CW2-08 Launch Gate that would make them reachable is unimplemented, and a
--     later reviewed launch-gated wrapper preserves the exact human's own
--     session claims and calls these primitives.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  internal text[] := ARRAY[
    'public.replay_canonical_projection_family_v1(text, jsonb, text[])',
    'public.replay_analytical_projection_point_digest_v1(integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)',
    'public.replay_analytical_projection_version_digest_v1(text[])',
    'public.replay_render_contract_digest_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer)',
    'public.derive_replay_semantic_cut_safety_v1(uuid, timestamptz)',
    'public.derive_replay_temporal_discontinuities_v1(uuid)',
    'public.build_replay_analytical_projection_v1(uuid, uuid, integer, uuid, timestamptz)',
    'public.build_replay_render_contract_v1(uuid, uuid, integer, uuid, timestamptz)',
    'public.derive_replay_version_truth_currency_v1(uuid)',
    'public.prepare_replay_preview_v1(uuid, uuid, bigint, uuid, uuid, uuid)',
    'public.finalize_replay_version_v1(uuid, uuid, uuid)',
    'public.reopen_replay_for_revision_v1(uuid, uuid, uuid)'];
  resolver text := 'public.resolve_replay_current_version_v1(uuid, uuid)';
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
-- 14. SELF-ASSERTIONS.
--
--     What must already be true of THIS migration for it to be allowed to
--     deploy. Each is a fact about the objects 0103 owns or the frozen truths
--     it consumes - never a census of the database, and never a ceiling on
--     I-06C / I-06D: no assertion here forbids a later reviewed distribution
--     package, approver set, publish / share / download action, export
--     sanitizer, source-loss record or Launch wrapper from existing anywhere.
--     They are forbidden IN THE FUNCTION BODIES THIS MIGRATION OWNS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  family_fn text := 'public.replay_canonical_projection_family_v1(text, jsonb, text[])';
  point_fn text := 'public.replay_analytical_projection_point_digest_v1(integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)';
  version_digest_fn text := 'public.replay_analytical_projection_version_digest_v1(text[])';
  contract_digest_fn text := 'public.replay_render_contract_digest_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer)';
  cut_fn text := 'public.derive_replay_semantic_cut_safety_v1(uuid, timestamptz)';
  gap_fn text := 'public.derive_replay_temporal_discontinuities_v1(uuid)';
  projection_fn text := 'public.build_replay_analytical_projection_v1(uuid, uuid, integer, uuid, timestamptz)';
  contract_fn text := 'public.build_replay_render_contract_v1(uuid, uuid, integer, uuid, timestamptz)';
  truth_fn text := 'public.derive_replay_version_truth_currency_v1(uuid)';
  preview_fn text := 'public.prepare_replay_preview_v1(uuid, uuid, bigint, uuid, uuid, uuid)';
  finalize_fn text := 'public.finalize_replay_version_v1(uuid, uuid, uuid)';
  reopen_fn text := 'public.reopen_replay_for_revision_v1(uuid, uuid, uuid)';
  resolver text := 'public.resolve_replay_current_version_v1(uuid, uuid)';
  everything text[];
  mutating text[];
  human text[];
  cores text[];
  pure text[];
  own_tables text[] := ARRAY['replay_preview_commands', 'replay_finalization_commands',
                             'replay_revision_reopen_commands'];
  fn text;
  t text;
  role_name text;
  p record;
  replay_pos integer;
  source_pos integer;
  write_pos integer;
BEGIN
  pure := ARRAY[family_fn, point_fn, version_digest_fn, contract_digest_fn];
  cores := ARRAY[cut_fn, gap_fn, projection_fn, contract_fn];
  human := ARRAY[preview_fn, finalize_fn, reopen_fn];
  mutating := cores || human;
  everything := pure || cores || human || ARRAY[truth_fn, resolver];

  -- EVERY FUNCTION IS POSTGRES-OWNED, PINNED, AND EXECUTABLE BY NO APPLICATION
  -- ROLE except the ONE read boundary, which service_role alone may execute.
  FOREACH fn IN ARRAY everything LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-06B: % must be owned by postgres', fn; END IF;
    IF NOT (fn = ANY(pure)) AND NOT p.prosecdef THEN
      RAISE EXCEPTION 'I-06B: % must be SECURITY DEFINER', fn;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-06B: % must pin an empty search_path', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-06B: PUBLIC must not execute % before the frozen CW2-08 Launch Gate exists', fn;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name)
         AND has_function_privilege(role_name, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-06B: % must not execute % before the frozen CW2-08 Launch Gate exists', role_name, fn;
      END IF;
    END LOOP;
    IF fn <> resolver AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
       AND has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-06B: service_role must not execute % : the service tier is an executor, never the human consent principal', fn;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' OR p.prosrc ~* 'TRUNCATE' THEN
      RAISE EXCEPTION 'I-06B: % locks rows in the canonical order, never a table and never an advisory key', fn;
    END IF;
    -- NO I-06B FUNCTION MUTATES A SOURCE RELATION, A PUBLIC RELATION, A HUMAN
    -- OR THE CANONICAL HISTORICAL SUBSTRATE: every one of them is read only.
    IF p.prosrc ~ '(INSERT INTO|UPDATE|DELETE FROM) public\.(conversation_|session_semantic|session_historical|historical_|hypothes|memor|information_gap|question_|confidence_|shared_world|public_experience|public_identit|public_world|publication_|users)' THEN
      RAISE EXCEPTION 'I-06B: % must mutate no Personal Shared Public or historical relation: a Replay binds truth and never writes it', fn;
    END IF;
    -- NO REPLAY FUNCTION REWRITES AN I-06A COMPONENT.
    IF p.prosrc ~ '(UPDATE|DELETE FROM) public\.replay_(source_manifest|selection_spec|draft_state|create_commands|draft_revision)' THEN
      RAISE EXCEPTION 'I-06B: % must never rewrite a frozen I-06A component: a changed source or selection is a NEW version', fn;
    END IF;
    -- PROVENANCE IS NOT A SOURCE-ACCESS ROUTE, and membership is never a
    -- substitute for exact historical visibility.
    IF p.prosrc ~ 'publication_package_item_provenance' THEN
      RAISE EXCEPTION 'I-06B: % must never read the sealed Public provenance', fn;
    END IF;
    IF p.prosrc ~ 'shared_world_membership_episodes|shared_world_history_access_grants|shared_world_standing_context' THEN
      RAISE EXCEPTION 'I-06B: % must not re-implement Shared authorization', fn;
    END IF;
    -- NO DISTRIBUTION, NO PUBLICATION, NO SAFETY OR LAUNCH CLAIM anywhere in an
    -- I-06B function body.
    IF p.prosrc ~ 'PUBLISH_TO_PUBLIC_WORLD|SHARE_EXTERNALLY|DOWNLOAD|DISTRIBUT|EXPORT_PRIVACY|distribution_package|distribution_approval' THEN
      RAISE EXCEPTION 'I-06B: % must carry no distribution action: finalized is not distributed', fn;
    END IF;
    IF p.prosrc ~ 'SAFETY_ALLOW|MODERATION_ALLOW|LAUNCH_CLEARED|ENTITLED|FEATURE_ENABLED|PUBLIC_LAUNCH_READY' THEN
      RAISE EXCEPTION 'I-06B: % must claim no Safety Launch or entitlement clearance: no executable CW2-08 runtime exists', fn;
    END IF;
    -- NO CURRENT-MODEL RE-ANALYSIS PATH, AND NO SYNTHETIC ORIGINAL MEDIUM.
    IF p.prosrc ~* '(openai|anthropic|claude|gpt|llm|prompt|completion|embedding|inference|synthes|text_to_speech|tts_)' THEN
      RAISE EXCEPTION 'I-06B: % must run no model over historical source and synthesize no original medium', fn;
    END IF;
    -- NO WALL-CLOCK CREATION TIME IS EVER A TEMPORAL ANCHOR.
    IF p.prosrc ~ '\.created_at' THEN
      RAISE EXCEPTION 'I-06B: % must never read a wall-clock creation time as a temporal anchor: the anchor is the canonical Session Position', fn;
    END IF;
  END LOOP;

  FOREACH fn IN ARRAY mutating LOOP
    IF (SELECT pr.provolatile FROM pg_proc pr WHERE pr.oid = fn::regprocedure) <> 'v' THEN
      RAISE EXCEPTION 'I-06B: consequential primitive % must be VOLATILE', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY pure LOOP
    IF (SELECT pr.provolatile FROM pg_proc pr WHERE pr.oid = fn::regprocedure) <> 'i' THEN
      RAISE EXCEPTION 'I-06B: the canonicalization % must be IMMUTABLE, or the same truth could digest differently', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[truth_fn, resolver] LOOP
    SELECT pr.provolatile, pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-06B: derivation % must be STABLE', fn; END IF;
    IF p.prosrc ~ 'INSERT INTO' OR p.prosrc ~ 'UPDATE public' OR p.prosrc ~ 'DELETE FROM'
       OR p.prosrc ~ 'FOR UPDATE|FOR SHARE' THEN
      RAISE EXCEPTION 'I-06B: derivation % must write nothing and lock nothing', fn;
    END IF;
  END LOOP;

  -- THE SOURCE-EVENT PAYLOAD IS EXCLUDED FROM THE PROJECTION DIGEST BY
  -- CONSTRUCTION. The canonicalizer's EXACT input list is pinned here, rather
  -- than a ban over its parameter names: a ban would be vacuous for a function
  -- whose `proargmodes` is NULL (every argument IN), and an exact list is
  -- non-vacuous by definition - adding `p_moments`, `p_committed_text` or any
  -- other source payload changes the list and this migration refuses to deploy.
  IF (SELECT pr.proargnames FROM pg_proc pr WHERE pr.oid = point_fn::regprocedure)
     <> ARRAY['p_represented_session_position', 'p_emerging_focuses', 'p_live_focus', 'p_threads',
              'p_thread_reading_appearances', 'p_readings', 'p_reading_relations',
              'p_evidence_participations', 'p_materials', 'p_gaps', 'p_questions',
              'p_question_appearances', 'p_confidences'] THEN
    RAISE EXCEPTION 'I-06B: the analytical projection canonicalization declares an EXACT input list and no source payload: the source body belongs to the manifest, never to the analysis';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = point_fn::regprocedure;
  IF p.prosrc !~ 'QANDEEL_REPLAY_ANALYTICAL_PROJECTION_V1' THEN
    RAISE EXCEPTION 'I-06B: the projection canonicalization must pin its exact schema identity';
  END IF;
  IF p.prosrc !~ 'ARRAY\[''expiry''\]' THEN
    RAISE EXCEPTION 'I-06B: the wall-clock Material expiry mapping must be excluded from the sealed historical digest';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = family_fn::regprocedure;
  IF p.prosrc !~ 'ORDER BY \(e - p_drop\)::text COLLATE "C"' THEN
    RAISE EXCEPTION 'I-06B: the canonicalization must be stable under element ordering';
  END IF;

  -- THE HUMAN IS DERIVED, NEVER SUPPLIED, and no mutation accepts an actor,
  -- authority, audience, safety, digest, discontinuity or coverage parameter.
  FOREACH fn IN ARRAY mutating LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc !~ 'u uuid := auth\.uid\(\);' THEN
      RAISE EXCEPTION 'I-06B: % must derive the human from auth.uid() and never from a parameter', fn;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 'i'
         AND arg.name ~ '(actor|creator|owner|user_id|approver|authority|audience|viewer|visib|publish|distribut|lifecycle|clear|launch|safety|entitle|allow|ordinal|contiguous|digest|fingerprint|medium|availability|sealed|coverage|assessment|result|discontinuit)'
    ) THEN
      RAISE EXCEPTION 'I-06B: % may not accept an actor authority audience safety digest discontinuity or coverage parameter', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY human LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 'i' AND arg.name ~ '(instant|timestamp|_at$)'
    ) THEN
      RAISE EXCEPTION 'I-06B: % accepts no clock: the ONE instant is read from the database', fn;
    END IF;
    IF (length(p.prosrc) - length(replace(p.prosrc, 'clock_timestamp()', ''))) / length('clock_timestamp()') <> 1 THEN
      RAISE EXCEPTION 'I-06B: % must read the database clock exactly once for every authoritative moment', fn;
    END IF;
    IF p.prosrc ~* 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
      RAISE EXCEPTION 'I-06B: % accepts no clock but one read of the database clock', fn;
    END IF;
    IF (length(p.prosrc) - length(replace(p.prosrc, 'WHERE c.id = p_command_id', ''))) / length('WHERE c.id = p_command_id') < 2 THEN
      RAISE EXCEPTION 'I-06B: % must check durable idempotency before any lock and again under it', fn;
    END IF;
    IF p.prosrc !~ 'REPLAY_COMMAND_ID_CONFLICT' OR p.prosrc !~ 'committed\.request_ref' THEN
      RAISE EXCEPTION 'I-06B: % must decide retry equivalence on the whole request identity and refuse a reused command identity', fn;
    END IF;
    -- REPLAY IS THE FIRST LOCK, ALWAYS.
    IF p.prosrc !~ 'FROM public\.replays r WHERE r\.id = p_replay_id FOR UPDATE' THEN
      RAISE EXCEPTION 'I-06B: % must take the Replay row FOR UPDATE first', fn;
    END IF;
    IF p.prosrc !~ 'replay\.created_by_user_id <> u' OR p.prosrc !~ 'REPLAY_NOT_AVAILABLE' THEN
      RAISE EXCEPTION 'I-06B: a stranger and a nonexistent Replay must reach ONE bounded class in %', fn;
    END IF;
    IF p.prosrc !~ 'current_lifecycle' THEN
      RAISE EXCEPTION 'I-06B: % must require an exact current lifecycle', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY cores LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc ~ 'clock_timestamp' THEN
      RAISE EXCEPTION 'I-06B: internal core % reads no clock: the ONE instant is the caller''s', fn;
    END IF;
  END LOOP;

  -- THE PREVIEW: Replay first, source second, truth gates third, writes last.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = preview_fn::regprocedure;
  replay_pos := strpos(p.prosrc, 'FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE');
  source_pos := strpos(p.prosrc, 'public.replay_lock_source_manifest_v1(state.current_source_manifest_version_id)');
  write_pos := strpos(p.prosrc, 'INSERT INTO public.replay_versions');
  IF replay_pos = 0 OR source_pos = 0 OR write_pos = 0 OR replay_pos > source_pos OR source_pos > write_pos THEN
    RAISE EXCEPTION 'I-06B: a preview locks the Replay first, stabilizes the source second and writes the complete version last';
  END IF;
  -- The EXACT CONDITION each gate tests, not only the function it consults or
  -- the class it raises: `IF false THEN` beside an untouched RAISE leaves both
  -- of those in place while the gate never fires.
  IF p.prosrc !~ 'derive_replay_source_manifest_currency_v1' OR p.prosrc !~ 'REPLAY_SOURCE_STALE'
     OR p.prosrc !~ 'IF currency IS DISTINCT FROM ''CURRENT'' THEN' THEN
    RAISE EXCEPTION 'I-06B: a preview must revalidate source currency through the ONE frozen I-06A derivation and refuse stale prepared state';
  END IF;
  IF p.prosrc !~ 'state\.draft_revision <> p_expected_draft_revision' OR p.prosrc !~ 'REPLAY_DRAFT_STALE' THEN
    RAISE EXCEPTION 'I-06B: competing previews must compare and swap the exact draft revision';
  END IF;
  IF p.prosrc !~ 'safety\.unsafe_count > 0' OR p.prosrc !~ 'REPLAY_SEMANTIC_CUT_UNSAFE' THEN
    RAISE EXCEPTION 'I-06B: only a proven-safe cut may enter a complete Replay Version';
  END IF;
  IF p.prosrc !~ 'derive_replay_temporal_discontinuities_v1'
     OR p.prosrc !~ 'build_replay_analytical_projection_v1'
     OR p.prosrc !~ 'build_replay_render_contract_v1' THEN
    RAISE EXCEPTION 'I-06B: a preview must derive the discontinuities, the analytical projection and the render contract';
  END IF;
  IF p.prosrc !~ '''DRAFT'', ''PREVIEW_READY''' OR p.prosrc !~ 'SET current_lifecycle = ''PREVIEW_READY''' THEN
    RAISE EXCEPTION 'I-06B: a preview transitions the stable Replay to PREVIEW_READY with its append-only evidence';
  END IF;
  -- PREVIEW WIDENS NOTHING: it references no relation that could carry a
  -- package, an approver, a World membership or a public surface. Written as
  -- RELATION REFERENCES rather than as a word ban, because a word ban over
  -- `prosrc` is also a ban on the prose inside the function - and a rule that
  -- matches its own explanation is a rule nobody can state accurately.
  IF p.prosrc ~ 'public\.(publication_|public_experience|public_world|public_identit|shared_world_membership|shared_world_history_item)' THEN
    RAISE EXCEPTION 'I-06B: a preview must reference no package approval membership or public surface relation: preview creates no audience';
  END IF;

  -- THE PROJECTION CORE consumes the canonical historical projection and
  -- refuses every class it cannot truthfully answer.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = projection_fn::regprocedure;
  IF p.prosrc !~ 'public\.get_session_historical_projection_v1\(manifest\.personal_session_id, item\.represented_tc\)' THEN
    RAISE EXCEPTION 'I-06B: the Personal analytical projection must consume the canonical historical projection at the exact represented Session Position';
  END IF;
  IF p.prosrc !~ 'manifest\.source_class <> ''MY_WORLD''' OR p.prosrc !~ 'REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE' THEN
    RAISE EXCEPTION 'I-06B: an unsupported source class must fail closed with one bounded capability-unavailable class, never a synthesized projection';
  END IF;
  IF p.prosrc !~ 'NOT projected\.sealed' OR p.prosrc !~ 'REPLAY_ANALYTICAL_PROJECTION_OPEN_HEAD' THEN
    RAISE EXCEPTION 'I-06B: an open Live Head can never be frozen as historical analytical truth';
  END IF;
  IF p.prosrc !~ 'EXCEPTION WHEN OTHERS THEN' THEN
    RAISE EXCEPTION 'I-06B: every raise of the canonical historical projection must fail closed as a capability absence';
  END IF;
  IF p.prosrc ~ 'session_historical_coverage|historical_reading_events|historical_material_events|hypotheses|memories' THEN
    RAISE EXCEPTION 'I-06B: the analytical projection must not read the historical substrate directly: the ONE canonical projection is the only analytical input';
  END IF;

  -- THE RENDER CONTRACT refuses an unproven cut and an undeliverable medium.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = contract_fn::regprocedure;
  IF p.prosrc !~ 'REPLAY_SEMANTIC_CUT_UNSAFE' OR p.prosrc !~ 'REPLAY_RENDER_MEDIUM_UNAVAILABLE' THEN
    RAISE EXCEPTION 'I-06B: a render contract must refuse an unproven cut and a medium with no authorized delivery path';
  END IF;
  IF p.prosrc !~ 'replay_render_contract_digest_v1' THEN
    RAISE EXCEPTION 'I-06B: a render contract must commit the digest of its own bound composition';
  END IF;

  -- FINALIZATION revalidates source, projection and render truth, binds the
  -- EXACT expected version, and appends exact-version evidence.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = finalize_fn::regprocedure;
  IF p.prosrc !~ 'pointer\.current_replay_version_id <> p_expected_replay_version_id'
     OR p.prosrc !~ 'REPLAY_VERSION_STALE' THEN
    RAISE EXCEPTION 'I-06B: finalization must bind the EXACT current previewed version';
  END IF;
  IF p.prosrc !~ 'replay_lock_source_manifest_v1' OR p.prosrc !~ 'derive_replay_source_manifest_currency_v1'
     OR p.prosrc !~ 'REPLAY_SOURCE_STALE' THEN
    RAISE EXCEPTION 'I-06B: finalization must revalidate source availability and currency under lock';
  END IF;
  IF p.prosrc !~ 'derive_replay_version_truth_currency_v1'
     OR p.prosrc !~ 'WHERE t\.currency_state = ''DIVERGED'';'
     OR p.prosrc !~ 'REPLAY_ANALYTICAL_PROJECTION_STALE'
     OR p.prosrc !~ 'REPLAY_RENDER_CONTRACT_STALE' THEN
    RAISE EXCEPTION 'I-06B: finalization must revalidate the analytical projection commitment and the render contract integrity';
  END IF;
  IF p.prosrc !~ 'IF currency IS DISTINCT FROM ''CURRENT'' THEN' THEN
    RAISE EXCEPTION 'I-06B: finalization must refuse on any source currency but CURRENT';
  END IF;
  IF p.prosrc !~ 'INSERT INTO public\.replay_version_finalizations' THEN
    RAISE EXCEPTION 'I-06B: finalization must append exact-version evidence';
  END IF;
  IF p.prosrc ~ 'INSERT INTO public\.replay_analytical_projection|INSERT INTO public\.replay_render_contract|INSERT INTO public\.replay_versions' THEN
    RAISE EXCEPTION 'I-06B: finalization must never silently build a new Replay Version: if truth changed it fails';
  END IF;

  -- REOPEN returns the STABLE Replay to DRAFT and mutates no old version.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = reopen_fn::regprocedure;
  IF p.prosrc !~ 'NOT IN \(''PREVIEW_READY'', ''FINALIZED''\)'
     OR p.prosrc !~ 'SET current_lifecycle = ''DRAFT''' THEN
    RAISE EXCEPTION 'I-06B: a reopen returns to DRAFT only from PREVIEW_READY or FINALIZED';
  END IF;
  IF p.prosrc ~ 'UPDATE public\.replay_versions|DELETE FROM public\.replay_version|UPDATE public\.replay_analytical|UPDATE public\.replay_render' THEN
    RAISE EXCEPTION 'I-06B: a reopen must never mutate an old Replay Version or its finalization evidence';
  END IF;

  -- THE ONE READ BOUNDARY is creator-exact, service_role-only and discloses no
  -- source identity and no internal divergence cause.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = resolver::regprocedure;
  IF p.prosrc !~ 'r\.created_by_user_id = p_user_id' THEN
    RAISE EXCEPTION 'I-06B: the current-version resolver answers the exact creator and nobody else';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
     WHERE pr.oid = resolver::regprocedure AND arg.mode = 't'
       AND arg.name ~ '(user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material|history_item|availability|context_ref|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|experience|staleness|divergence)'
  ) THEN
    RAISE EXCEPTION 'I-06B: the current-version resolver must disclose no source identity no private path and no internal divergence cause';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role', resolver, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-06B: service_role must execute the ONE creator-exact current-version resolver';
  END IF;

  -- THE COMMAND HISTORY IS NARROW, SEALED AND STRUCTURALLY BOUND TO THE CREATOR.
  FOREACH t IN ARRAY own_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid = 'public.replays'::regclass AND cardinality(c.confkey) = 2 AND c.confdeltype = 'r'
    ) THEN
      RAISE EXCEPTION 'I-06B: % must bind its actor to the exact Replay creator through the identity key', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
       WHERE a.attrelid = ('public.' || t)::regclass AND a.attnum > 0 AND NOT a.attisdropped
         AND (a.attname ~ '(body|_text$|transcript|audio|content|payload|reason|note|safety|launch|entitle|approv|allow|world_type|member|distribut|share|download|export)'
              OR ty.typname IN ('json', 'jsonb', 'bytea'))
    ) THEN
      RAISE EXCEPTION 'I-06B: command history % may carry no content reason World distribution or clearance column', t;
    END IF;
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-06B: relation % must have row level security enabled', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-06B: relation % must carry zero policies', t;
    END IF;
    IF (SELECT c.relowner FROM pg_class c WHERE c.oid = ('public.' || t)::regclass)
       <> (SELECT r.oid FROM pg_roles r WHERE r.rolname = 'postgres') THEN
      RAISE EXCEPTION 'I-06B: relation % must be postgres-owned', t;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN role_name <> 'public' AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name);
      IF has_table_privilege(role_name, ('public.' || t)::regclass, 'SELECT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'INSERT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'UPDATE')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'DELETE') THEN
        RAISE EXCEPTION 'I-06B: relation % must hold no privilege for %', t, role_name;
      END IF;
    END LOOP;
  END LOOP;

  -- THE FROZEN TRUTHS THIS RUNTIME CONSUMES MUST STILL BE INTACT.
  IF to_regprocedure('public.get_session_historical_projection_v1(uuid, integer)') IS NULL
     OR to_regprocedure('public.replay_lock_source_manifest_v1(uuid)') IS NULL
     OR to_regprocedure('public.derive_replay_source_manifest_currency_v1(uuid)') IS NULL THEN
    RAISE EXCEPTION 'I-06B: the canonical historical projection and the frozen I-06A source lock and currency derivation must all exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_versions'::regclass
                  AND tg.tgname = 'replay_versions_immutable' AND NOT tg.tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_version_finalizations'::regclass
                     AND tg.tgname = 'replay_version_finalizations_immutable' AND NOT tg.tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replays'::regclass
                     AND tg.tgname = 'replays_lifecycle_transition' AND NOT tg.tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_analytical_projection_versions'::regclass
                     AND tg.tgname = 'replay_analytical_projection_versions_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-06B: the 0102 immutability and lifecycle guards must still be in place';
  END IF;
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)'::regprocedure)
     !~ 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'I-06B: the frozen CW2-08 prerequisite seam must still answer NOT_EVALUATED: I-06B manufactures no launch readiness';
  END IF;
END$$;

COMMIT;
