-- I-06B - Replay Analytical Projection, Render Truth Contract and the FIRST
-- COMPLETE REPLAY_VERSION (PART A).
--
-- Migration 0100 created the stable Replay identity, the immutable source
-- manifest and selection-spec versions and the ONE draft composition pointer;
-- 0101 created the only things that write them. Neither could create a
-- canonical REPLAY_VERSION, because the frozen invariant E3 requires every
-- Replay Version to bind ALL FOUR truth-relevant components and I-06A owned
-- two of them. This migration creates the missing two - the immutable
-- ANALYTICAL_PROJECTION_VERSION and the immutable RENDER_CONTRACT_VERSION -
-- and therefore the first complete REPLAY_VERSION, plus the append-only
-- lifecycle and finalization evidence the later slices read.
--
-- It creates NO writer. Every primitive is migration 0103.
--
-- ===========================================================================
-- What an ANALYTICAL_PROJECTION_VERSION is, and what it deliberately is NOT
-- ===========================================================================
--
-- The Product law is that the sound is what happened and the picture is how
-- QANDEEL understood it. The picture is therefore an immutable commitment to
-- THE ACTUAL QANDEEL ANALYTICAL STATE that was legitimately available and
-- projection-valid at each represented source point - never a prompt result,
-- never a summary generated now, never a current model re-run over old source,
-- and never source text copied into an "analysis" blob.
--
-- The canonical temporal / no-hindsight constitution already exists: migration
-- 0072 owns it, and `get_session_historical_projection_v1(session, TC)` is
-- K(TC). This migration creates NO competing clock, NO Replay-specific
-- historical substrate and NO second projection authority. What it persists is
-- a COMMITMENT to what that canonical function answered at an exact
-- represented coordinate:
--
--   represented TC   the selected source item's canonical Session Position
--                    (0065), bound to the exact manifest item BY FOREIGN KEY
--                    through the additive candidate key below - never a
--                    wall-clock timestamp, and never a coordinate a caller
--                    supplies
--   sealed           the canonical projection's own `sealed` answer, pinned
--                    TRUE by CHECK: see below
--   digest           a deterministic, versioned canonicalization of the
--                    truth-relevant analytical families of K(TC)
--
-- ===========================================================================
-- Why only a SEALED represented point may ever be bound
-- ===========================================================================
--
-- Migration 0072 states its own stability contract exactly: "The result is
-- stable for a sealed TC and may legitimately evolve while TC is the open
-- head." A Replay Version must never freeze an analytical state whose
-- historical answer can still legitimately change under the same represented
-- coordinate, so the open Live Head is REFUSED rather than frozen, and
-- `projection_sealed` is CHECK-pinned TRUE here so an unsealed point is
-- unrepresentable however the row is produced. `projection_live_head` is
-- recorded and CHECK-pinned strictly greater than the represented position,
-- which is exactly what 0072 means by sealed.
--
-- ===========================================================================
-- What the projection digest covers, and what it structurally cannot
-- ===========================================================================
--
-- The digest covers the ANALYTICAL families of K(TC). It excludes two things,
-- and it excludes them BY CONSTRUCTION rather than by omission - the
-- canonicalizer in 0103 has no parameter for either, so neither can reach a
-- digest however the function is called:
--
--   the Moments     `moments` is the committed source-event payload, including
--                   `committedText`. It is governed by the source manifest,
--                   which already binds each item's canonical source-identity
--                   digest. Persisting it again as "analysis" would be exactly
--                   the source/analysis confusion the Product law forbids.
--   the wall-clock  a Material's `expiry` is, in 0072's own words, "a policy
--   expiry payload  fact in the wall-clock domain ... NEVER compared to TC",
--                   and its PENDING -> SP(LH) mapping legitimately moves with
--                   wall time while the sealed TC's historical answer does
--                   not. The TC-domain answer it feeds - `statusAtTc` - stays
--                   inside the digest, because THAT is sealed-stable.
--
-- The projection revision facts (`liveHead`, `worldVersion`,
-- `sameSpEventSequence`) are recorded on the point as the provenance of the
-- derivation and are deliberately NOT part of the truth digest: they are
-- freshness tokens that advance while the sealed historical answer does not.
--
-- ===========================================================================
-- What a RENDER_CONTRACT_VERSION is, and what it is not
-- ===========================================================================
--
-- The truth contract a renderer must obey, as a set of exact versioned
-- policies: original-medium preservation, exact source text, semantic-cut
-- safety, temporal-discontinuity treatment, timing integrity, the analytical
-- projection commitment, camera and motion truth, caption provenance,
-- accessibility and reduced-motion parity, and editorial-annotation
-- separation. It is NOT final visual craft: no codec, container, bitrate,
-- resolution, frame rate, storage provider, CDN, watermark, DRM, social
-- template, typography or choreography column exists here, and the migration
-- refuses to deploy with one.
--
-- ===========================================================================
-- Semantic Cut Safety, conservatively and structurally
-- ===========================================================================
--
-- The frozen law is that Replay may never turn real source fragments into a
-- false utterance. I-06A persisted anchors and claimed nothing; I-06B owns the
-- decision, and owns it CONSERVATIVELY: a WHOLE_ITEM selection trimmed nothing
-- and is SAFE; a TEXT_CODE_POINT_RANGE can be proven safe only by a canonical
-- deterministic boundary / attribution substrate, and this repository has
-- none, so it is UNPROVEN or REJECTED and can never enter a complete Replay
-- Version. That is a CHECK on the assessment relation, bound to the exact
-- anchor kind of the exact selected item through an additive candidate key, so
-- "a partial range was marked safe" is unrepresentable rather than merely
-- refused. No NLP semantic-cut authority is invented to make partial ranges
-- pass.
--
-- ===========================================================================
-- Temporal discontinuity: where the gaps are, never what was omitted
-- ===========================================================================
--
-- I-06A recorded WHETHER the selection is source-contiguous. This migration
-- records WHERE every real gap is: one row per adjacent selected pair whose
-- captured source-universe ranks are non-consecutive, binding the exact left
-- and right selected anchors, with the omitted count GENERATED from the two
-- ranks. No omitted identity, body, text, digest or classification is copied:
-- a gap is machine truth about ABSENCE, and the renderer must make it
-- perceptible without ever disclosing what it hid.
--
-- ===========================================================================
-- Additive candidate keys on the I-06A relations
-- ===========================================================================
--
-- Six UNIQUE constraints are ADDED to the frozen I-06A relations. They add no
-- column, rewrite no row, change no existing constraint and remove nothing:
-- they exist so that this migration can bind an exact source row rather than
-- reach it through several independent partial keys that could each be
-- satisfied by a different parent. This is the frozen 0095 precedent that
-- I-06A itself consumed for the Public Experience Version binding.
--
-- ===========================================================================
-- Security posture
-- ===========================================================================
--
-- Every relation is postgres-owned, RLS-enabled with zero policies, and
-- revoked from PUBLIC, anon, authenticated and service_role. Every truth
-- component is append-only for every role INCLUDING the table owner, by BEFORE
-- trigger. The Replay lifecycle may now move, and moves only along the frozen
-- transitions, by BEFORE trigger. This migration creates no function that is
-- not a trigger function, grants nothing, and writes no row.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- No preview or finalization writer (0103); no rendering, codec, media,
-- storage or export; no distribution package, distribution approval, publish,
-- share or download; no Safety, moderation, entitlement, feature flag or
-- Launch Gate; no Shared or Public analytical projection, because no canonical
-- historical analytical substrate exists for either source class and none is
-- invented here; no current-model re-analysis of old source anywhere. It
-- rewrites no predecessor: migrations 0001-0101 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ADDITIVE CANDIDATE KEYS ON THE FROZEN I-06A RELATIONS.
--
--    Each one exists so a truth component below can bind an exact source row
--    as ONE row. None adds a column, changes a constraint or touches data.
-- ---------------------------------------------------------------------------
ALTER TABLE public.replay_source_manifest_versions
  ADD CONSTRAINT replay_source_manifest_versions_class_key UNIQUE (id, source_class);

-- The represented TC of a Personal projection point IS the canonical Session
-- Position of the exact manifest item it represents, structurally.
ALTER TABLE public.replay_source_manifest_items
  ADD CONSTRAINT replay_source_manifest_items_position_key
  UNIQUE (manifest_version_id, source_item_ordinal, personal_session_position);

-- A discontinuity's recorded ranks are the exact captured ranks of the exact
-- items it names, structurally.
ALTER TABLE public.replay_source_manifest_items
  ADD CONSTRAINT replay_source_manifest_items_rank_order_key
  UNIQUE (manifest_version_id, source_item_ordinal, source_universe_rank);

-- A projection point and a discontinuity endpoint name one selected item, its
-- selected ordinal, its manifest and its source ordinal as ONE row.
ALTER TABLE public.replay_selection_spec_items
  ADD CONSTRAINT replay_selection_spec_items_exact_key
  UNIQUE (selection_spec_version_id, selected_ordinal, source_manifest_version_id, source_item_ordinal);

-- A Semantic Cut Safety assessment names one selected item AND its exact
-- anchor kind as ONE row, which is what lets the CHECK below make "a partial
-- range was marked SAFE" unrepresentable.
ALTER TABLE public.replay_selection_spec_items
  ADD CONSTRAINT replay_selection_spec_items_anchor_key
  UNIQUE (selection_spec_version_id, source_item_ordinal, anchor_kind);

-- A projection version binds its selection, that selection's manifest, its
-- Replay AND its own point count as ONE row, so a projection that named
-- another Replay's selection, another selection's manifest or a different
-- number of points than the selection has is unrepresentable.
ALTER TABLE public.replay_selection_spec_versions
  ADD CONSTRAINT replay_selection_spec_versions_exact_key
  UNIQUE (id, source_manifest_version_id, replay_id, selected_item_count);

-- ---------------------------------------------------------------------------
-- 2. THE IMMUTABLE ANALYTICAL PROJECTION VERSION.
--
--    One immutable commitment per (Replay, selection composition). It binds
--    the exact selection spec and the exact manifest it was resolved over as
--    ONE row, declares the exact source class it projected (read FROM the
--    manifest by composite foreign key, never asserted), names the exact
--    capability it exercised, pins the canonicalization schema identity, and
--    carries the deterministic digest of the whole projection.
--
--    `projection_capability` carries exactly one value at this baseline:
--    PERSONAL_SESSION_HISTORICAL_PROJECTION. That is not pessimism, it is the
--    repository census: the canonical time-indexed, knowledge-time-truthful,
--    version-valid, deterministically revalidatable, hindsight-free analytical
--    state that migration 0072 owns exists for a covered Personal Session and
--    for nothing else. A Shared history item of kind QANDEEL_ANALYSIS is
--    SOURCE CONTENT in a Shared World, and a bounded Public Experience
--    derivative is PUBLIC SOURCE MATERIAL; neither is a historical analytical
--    projection of QANDEEL, and neither is turned into one here. The
--    `source_class` binding below is what makes that structural rather than
--    procedural.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_analytical_projection_versions (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    source_manifest_version_id uuid NOT NULL,
    selection_spec_version_id uuid NOT NULL,
    projection_revision integer NOT NULL,
    source_class text NOT NULL,
    projection_capability text NOT NULL,
    projection_schema_id text NOT NULL,
    point_count integer NOT NULL,
    projection_digest text NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT replay_analytical_projection_versions_pk PRIMARY KEY (id),
    CONSTRAINT replay_analytical_projection_versions_replay_key UNIQUE (id, replay_id),
    CONSTRAINT replay_analytical_projection_versions_selection_key UNIQUE (id, selection_spec_version_id),
    CONSTRAINT replay_analytical_projection_versions_revision_key UNIQUE (replay_id, projection_revision),
    -- The composition candidate key the render contract and the Replay Version
    -- bind, so a projection can never be paired with another Replay's
    -- selection or another selection's manifest.
    CONSTRAINT replay_analytical_projection_versions_composition_key
        UNIQUE (id, selection_spec_version_id, source_manifest_version_id, replay_id),
    CONSTRAINT replay_analytical_projection_versions_revision_check CHECK (projection_revision >= 1),
    CONSTRAINT replay_analytical_projection_versions_count_check CHECK (point_count >= 1),
    CONSTRAINT replay_analytical_projection_versions_digest_check
        CHECK (projection_digest ~ '^sha256:[0-9a-f]{64}$'),
    -- The exact canonicalization identity, pinned. A later reviewed
    -- canonicalization is a NEW schema identity and a NEW projection version,
    -- never a silent reinterpretation of an existing digest.
    CONSTRAINT replay_analytical_projection_versions_schema_check
        CHECK (projection_schema_id = 'QANDEEL_REPLAY_ANALYTICAL_PROJECTION_V1'),
    -- THE CAPABILITY MATRIX, AS A CONSTRAINT. Exactly the capability whose
    -- canonical substrate this repository actually has, bound to the exact
    -- source class it belongs to.
    CONSTRAINT replay_analytical_projection_versions_capability_check
        CHECK (projection_capability = 'PERSONAL_SESSION_HISTORICAL_PROJECTION' AND source_class = 'MY_WORLD'),
    CONSTRAINT replay_analytical_projection_versions_replay_fk
        FOREIGN KEY (replay_id) REFERENCES public.replays (id) ON DELETE RESTRICT,
    -- ONE EXACT SELECTION ROW: the selection, its own manifest, its own Replay
    -- and its own selected count, all read from the SAME selection-spec row
    -- rather than through independent partial keys. A projection that skipped a
    -- selected item, or named another Replay's selection, is unrepresentable.
    CONSTRAINT replay_analytical_projection_versions_selection_fk
        FOREIGN KEY (selection_spec_version_id, source_manifest_version_id, replay_id, point_count)
        REFERENCES public.replay_selection_spec_versions
          (id, source_manifest_version_id, replay_id, selected_item_count) ON DELETE RESTRICT,
    -- The declared source class is READ FROM the manifest, structurally: a
    -- Shared or Public manifest can never carry a Personal historical
    -- projection however the row is produced.
    CONSTRAINT replay_analytical_projection_versions_class_fk
        FOREIGN KEY (source_manifest_version_id, source_class)
        REFERENCES public.replay_source_manifest_versions (id, source_class) ON DELETE RESTRICT
);

CREATE INDEX replay_analytical_projection_versions_replay_idx
    ON public.replay_analytical_projection_versions (replay_id, projection_revision);

COMMENT ON TABLE public.replay_analytical_projection_versions IS
  'One immutable ANALYTICAL_PROJECTION_VERSION: a commitment to the actual '
  'QANDEEL analytical state that was legitimately available and '
  'projection-valid at each represented source point, derived from the '
  'canonical historical projection migration 0072 owns and from nothing else. '
  'It is never a prompt result, a summary generated now, a current-model rerun '
  'over old source, or source text copied into an analysis blob. Its '
  'capability is PERSONAL_SESSION_HISTORICAL_PROJECTION because that is the '
  'only canonical historical analytical substrate this repository has.';

-- ---------------------------------------------------------------------------
-- 3. THE POINTS OF ONE PROJECTION VERSION.
--
--    One row per selected item. Each binds the exact selected item, its exact
--    manifest item, and the represented TC - which IS that item's canonical
--    Session Position, through the additive candidate key above rather than
--    through a value a writer chose. Each carries the canonical projection's
--    own sealed answer and revision facts, and the deterministic digest of the
--    analytical state at that exact coordinate.
--
--    NOTHING HERE CAN HOLD CONTENT. There is no body, text, transcript, audio,
--    statement, caption, payload or JSON column anywhere: the analytical truth
--    is committed as a one-way digest, and the migration refuses to deploy
--    with a content column.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_analytical_projection_points (
    projection_version_id uuid NOT NULL,
    selected_ordinal integer NOT NULL,
    selection_spec_version_id uuid NOT NULL,
    source_manifest_version_id uuid NOT NULL,
    source_item_ordinal integer NOT NULL,
    represented_session_position integer NOT NULL,
    projection_sealed boolean NOT NULL,
    projection_live_head integer NOT NULL,
    projection_world_version bigint NOT NULL,
    projection_same_sp_event_sequence bigint NOT NULL,
    point_digest text NOT NULL,
    CONSTRAINT replay_analytical_projection_points_pk
        PRIMARY KEY (projection_version_id, selected_ordinal),
    CONSTRAINT replay_analytical_projection_points_ordinal_check CHECK (selected_ordinal >= 1),
    CONSTRAINT replay_analytical_projection_points_tc_check CHECK (represented_session_position >= 1),
    -- ONLY A SEALED REPRESENTED POINT MAY EVER BE BOUND. 0072 states its own
    -- stability contract: a sealed TC is stable, the open head may still
    -- legitimately evolve. An unsealed point is therefore unrepresentable, and
    -- `sealed` means exactly TC < Live Head, which is checked here too.
    CONSTRAINT replay_analytical_projection_points_sealed_check CHECK (projection_sealed),
    CONSTRAINT replay_analytical_projection_points_live_head_check
        CHECK (projection_live_head > represented_session_position),
    CONSTRAINT replay_analytical_projection_points_version_check
        CHECK (projection_world_version >= 0 AND projection_same_sp_event_sequence >= 0),
    CONSTRAINT replay_analytical_projection_points_digest_check
        CHECK (point_digest ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT replay_analytical_projection_points_version_fk
        FOREIGN KEY (projection_version_id)
        REFERENCES public.replay_analytical_projection_versions (id) ON DELETE RESTRICT,
    -- A point belongs to its own version's exact selection.
    CONSTRAINT replay_analytical_projection_points_composition_fk
        FOREIGN KEY (projection_version_id, selection_spec_version_id)
        REFERENCES public.replay_analytical_projection_versions (id, selection_spec_version_id) ON DELETE RESTRICT,
    -- The selected item, its selected ordinal, its manifest and its source
    -- ordinal are ONE exact selected row.
    CONSTRAINT replay_analytical_projection_points_selected_item_fk
        FOREIGN KEY (selection_spec_version_id, selected_ordinal, source_manifest_version_id, source_item_ordinal)
        REFERENCES public.replay_selection_spec_items
          (selection_spec_version_id, selected_ordinal, source_manifest_version_id, source_item_ordinal)
        ON DELETE RESTRICT,
    -- AND THE REPRESENTED TC IS THAT EXACT ITEM'S CANONICAL SESSION POSITION.
    -- Not a clock, not a parameter, not a value the writer chose: the same row.
    CONSTRAINT replay_analytical_projection_points_manifest_position_fk
        FOREIGN KEY (source_manifest_version_id, source_item_ordinal, represented_session_position)
        REFERENCES public.replay_source_manifest_items
          (manifest_version_id, source_item_ordinal, personal_session_position)
        ON DELETE RESTRICT
);

CREATE INDEX replay_analytical_projection_points_position_idx
    ON public.replay_analytical_projection_points (projection_version_id, represented_session_position);

COMMENT ON TABLE public.replay_analytical_projection_points IS
  'One point of one immutable analytical projection: the exact selected item, '
  'the represented TC bound BY FOREIGN KEY to that item''s canonical Session '
  'Position, the canonical projection''s own sealed answer and revision facts, '
  'and the deterministic digest of the analytical state at that coordinate. '
  'Only a SEALED represented point is representable. It carries no content at '
  'all: no source text, no analytical statement, no caption and no payload.';

-- ---------------------------------------------------------------------------
-- 4. SEMANTIC CUT SAFETY, ASSESSED PER SELECTED ITEM.
--
--    One assessment per selected item of one immutable selection spec, bound
--    to that item AND its exact anchor kind as ONE row. The result vocabulary
--    is complete so a later reviewed boundary/attribution substrate is
--    additive, but the two CHECKs below make the conservative rule structural
--    at this baseline:
--
--      SAFE requires WHOLE_ITEM        nothing was trimmed, so no negation,
--                                      qualification, attribution or clause
--                                      context can have been removed
--      TEXT_CODE_POINT_RANGE is        this repository contains no canonical
--      UNPROVEN or REJECTED            deterministic boundary / attribution
--                                      substrate that could prove the frozen
--                                      rule, and none is invented to make
--                                      partial ranges pass
--
--    No result is ever caller-authored: 0103 derives every row from the
--    immutable anchor kind of the selection spec, and the composite foreign
--    key means a row that claimed a different anchor kind would not resolve.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_semantic_cut_assessments (
    selection_spec_version_id uuid NOT NULL,
    source_item_ordinal integer NOT NULL,
    anchor_kind text NOT NULL,
    assessment_algorithm text NOT NULL,
    assessment_result text NOT NULL,
    assessed_at timestamptz NOT NULL,
    CONSTRAINT replay_semantic_cut_assessments_pk
        PRIMARY KEY (selection_spec_version_id, source_item_ordinal),
    CONSTRAINT replay_semantic_cut_assessments_ordinal_check CHECK (source_item_ordinal >= 1),
    CONSTRAINT replay_semantic_cut_assessments_algorithm_check
        CHECK (assessment_algorithm = 'QANDEEL_REPLAY_SEMANTIC_CUT_SAFETY_V1'),
    CONSTRAINT replay_semantic_cut_assessments_result_check
        CHECK (assessment_result IN ('SAFE', 'UNPROVEN', 'REQUIRES_EXPANSION', 'REJECTED')),
    CONSTRAINT replay_semantic_cut_assessments_anchor_check
        CHECK (anchor_kind IN ('WHOLE_ITEM', 'TEXT_CODE_POINT_RANGE')),
    -- ONLY AN UNTRIMMED ITEM CAN BE SAFE.
    CONSTRAINT replay_semantic_cut_assessments_safe_check
        CHECK (assessment_result <> 'SAFE' OR anchor_kind = 'WHOLE_ITEM'),
    -- AND A PARTIAL RANGE CAN BE NOTHING BUT UNPROVEN OR REJECTED at a
    -- baseline with no canonical boundary / attribution substrate.
    CONSTRAINT replay_semantic_cut_assessments_partial_check
        CHECK (anchor_kind <> 'TEXT_CODE_POINT_RANGE' OR assessment_result IN ('UNPROVEN', 'REJECTED')),
    -- The selected item and its anchor kind are ONE exact row.
    CONSTRAINT replay_semantic_cut_assessments_item_fk
        FOREIGN KEY (selection_spec_version_id, source_item_ordinal, anchor_kind)
        REFERENCES public.replay_selection_spec_items
          (selection_spec_version_id, source_item_ordinal, anchor_kind)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.replay_semantic_cut_assessments IS
  'One immutable Semantic Cut Safety assessment per selected item: only an '
  'untrimmed WHOLE_ITEM selection can be SAFE, and a TEXT_CODE_POINT_RANGE is '
  'UNPROVEN or REJECTED because this repository has no canonical deterministic '
  'boundary or attribution substrate that could prove a partial cut preserves '
  'negation, qualification, attribution and clause context. Only SAFE may '
  'enter a complete Replay Version.';

-- ---------------------------------------------------------------------------
-- 5. TEMPORAL DISCONTINUITY: WHERE THE GAPS ARE.
--
--    One row per adjacent selected pair whose captured source-universe ranks
--    are non-consecutive. The two endpoints are bound as exact selected rows,
--    their captured ranks are bound as exact manifest rows, and the omitted
--    count is GENERATED from those two ranks - so nothing here is a value a
--    writer chose, and a fabricated gap over a contiguous pair is refused by
--    the generated column's own CHECK.
--
--    IT COPIES NO OMITTED CONTENT AND NAMES NO OMITTED ITEM. A gap is machine
--    truth about ABSENCE: how many authorized source items lie between two
--    selected ones, and nothing about what they contain, who produced them or
--    when. Coverage truth does not require exposing what omitted private
--    material holds.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_temporal_discontinuities (
    selection_spec_version_id uuid NOT NULL,
    after_selected_ordinal integer NOT NULL,
    right_selected_ordinal integer NOT NULL,
    source_manifest_version_id uuid NOT NULL,
    left_source_item_ordinal integer NOT NULL,
    right_source_item_ordinal integer NOT NULL,
    left_source_universe_rank integer NOT NULL,
    right_source_universe_rank integer NOT NULL,
    omitted_source_item_count integer
        GENERATED ALWAYS AS (right_source_universe_rank - left_source_universe_rank - 1) STORED,
    CONSTRAINT replay_temporal_discontinuities_pk
        PRIMARY KEY (selection_spec_version_id, after_selected_ordinal),
    CONSTRAINT replay_temporal_discontinuities_ordinal_check CHECK (after_selected_ordinal >= 1),
    -- The right endpoint is the NEXT selected item, and nothing else.
    CONSTRAINT replay_temporal_discontinuities_adjacent_check
        CHECK (right_selected_ordinal = after_selected_ordinal + 1),
    -- A DISCONTINUITY IS A REAL GAP. A pair with consecutive captured ranks
    -- cannot be recorded as one, because the generated count would be zero.
    CONSTRAINT replay_temporal_discontinuities_gap_check
        CHECK (omitted_source_item_count > 0),
    -- Chronology, again, from the captured universe.
    CONSTRAINT replay_temporal_discontinuities_order_check
        CHECK (right_source_item_ordinal > left_source_item_ordinal
           AND right_source_universe_rank > left_source_universe_rank),
    -- Both endpoints are exact selected rows of the exact selection.
    CONSTRAINT replay_temporal_discontinuities_left_item_fk
        FOREIGN KEY (selection_spec_version_id, after_selected_ordinal,
                     source_manifest_version_id, left_source_item_ordinal)
        REFERENCES public.replay_selection_spec_items
          (selection_spec_version_id, selected_ordinal, source_manifest_version_id, source_item_ordinal)
        ON DELETE RESTRICT,
    CONSTRAINT replay_temporal_discontinuities_right_item_fk
        FOREIGN KEY (selection_spec_version_id, right_selected_ordinal,
                     source_manifest_version_id, right_source_item_ordinal)
        REFERENCES public.replay_selection_spec_items
          (selection_spec_version_id, selected_ordinal, source_manifest_version_id, source_item_ordinal)
        ON DELETE RESTRICT,
    -- And the recorded ranks are those exact items' captured ranks.
    CONSTRAINT replay_temporal_discontinuities_left_rank_fk
        FOREIGN KEY (source_manifest_version_id, left_source_item_ordinal, left_source_universe_rank)
        REFERENCES public.replay_source_manifest_items
          (manifest_version_id, source_item_ordinal, source_universe_rank)
        ON DELETE RESTRICT,
    CONSTRAINT replay_temporal_discontinuities_right_rank_fk
        FOREIGN KEY (source_manifest_version_id, right_source_item_ordinal, right_source_universe_rank)
        REFERENCES public.replay_source_manifest_items
          (manifest_version_id, source_item_ordinal, source_universe_rank)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.replay_temporal_discontinuities IS
  'One immutable temporal discontinuity per adjacent selected pair whose '
  'captured source-universe ranks are non-consecutive: the exact left and '
  'right selected anchors and the GENERATED count of omitted authorized source '
  'items. It copies no omitted content and names no omitted item. The render '
  'contract requires every one of these to be perceptible: a gap may never '
  'masquerade as continuous source time.';

-- ---------------------------------------------------------------------------
-- 6. THE IMMUTABLE RENDER CONTRACT VERSION.
--
--    The truth contract a renderer must obey, bound to the exact analytical
--    projection, selection and manifest composition it was built for. Every
--    policy is an exact versioned vocabulary value, and every vocabulary is
--    pinned to what this repository can actually honour:
--
--      source_medium_class     ORIGINAL_TEXT_ONLY, and only that. A Shared
--                              voice note's I-04G digest is a body-IDENTITY
--                              digest over an opaque object reference and a
--                              transcript: it attests no media bytes and
--                              grants no media-delivery capability. Without an
--                              authorized media path there is no truthful way
--                              to render original audio, and the alternative -
--                              promoting a transcript to "original audio" - is
--                              exactly the synthetic source event the frozen
--                              invariants forbid. So it fails closed here.
--      timing_integrity_policy PRESENTATION_PACING_DECLARED, because the
--                              durable Personal source is text-only
--                              (`conversation_units.source_modality` is
--                              CHECK-pinned to TEXT) and a text event has no
--                              original voice timing to preserve. Pacing is
--                              declared as PRESENTATION behaviour and is never
--                              presented as original conversational timing.
--
--    NO CODEC, CONTAINER, BITRATE, RESOLUTION, FRAME RATE, STORAGE PROVIDER,
--    CDN, WATERMARK, DRM, TEMPLATE, TYPOGRAPHY OR CHOREOGRAPHY COLUMN exists
--    here. Those are deferred by CW2-05 section 50 and are not this task's.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_render_contract_versions (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    source_manifest_version_id uuid NOT NULL,
    selection_spec_version_id uuid NOT NULL,
    analytical_projection_version_id uuid NOT NULL,
    contract_revision integer NOT NULL,
    contract_schema_id text NOT NULL,
    source_medium_class text NOT NULL,
    original_medium_policy text NOT NULL,
    source_text_policy text NOT NULL,
    semantic_cut_policy text NOT NULL,
    temporal_discontinuity_policy text NOT NULL,
    timing_integrity_policy text NOT NULL,
    analytical_projection_policy text NOT NULL,
    camera_emphasis_policy text NOT NULL,
    motion_policy text NOT NULL,
    caption_provenance_policy text NOT NULL,
    accessibility_parity_policy text NOT NULL,
    reduced_motion_parity_policy text NOT NULL,
    editorial_annotation_policy text NOT NULL,
    discontinuity_count integer NOT NULL,
    contract_digest text NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT replay_render_contract_versions_pk PRIMARY KEY (id),
    CONSTRAINT replay_render_contract_versions_replay_key UNIQUE (id, replay_id),
    CONSTRAINT replay_render_contract_versions_revision_key UNIQUE (replay_id, contract_revision),
    CONSTRAINT replay_render_contract_versions_composition_key
        UNIQUE (id, analytical_projection_version_id, selection_spec_version_id,
                source_manifest_version_id, replay_id),
    CONSTRAINT replay_render_contract_versions_revision_check CHECK (contract_revision >= 1),
    CONSTRAINT replay_render_contract_versions_count_check CHECK (discontinuity_count >= 0),
    CONSTRAINT replay_render_contract_versions_digest_check
        CHECK (contract_digest ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT replay_render_contract_versions_schema_check
        CHECK (contract_schema_id = 'QANDEEL_REPLAY_RENDER_CONTRACT_V1'),
    -- ORIGINAL MEDIUM. Text only, for the reason stated above.
    CONSTRAINT replay_render_contract_versions_medium_check
        CHECK (source_medium_class = 'ORIGINAL_TEXT_ONLY'
           AND original_medium_policy = 'PRESERVE_ORIGINAL_MEDIUM_ONLY'
           AND source_text_policy = 'EXACT_SOURCE_TEXT'),
    -- TIMING SEMANTIC INTEGRITY. A text event has no original voice timing, so
    -- pacing is declared as presentation behaviour and never as source timing.
    CONSTRAINT replay_render_contract_versions_timing_check
        CHECK (timing_integrity_policy = 'PRESENTATION_PACING_DECLARED'),
    -- THE TRUTH POLICIES, each an exact versioned value.
    CONSTRAINT replay_render_contract_versions_truth_check CHECK (
        semantic_cut_policy = 'WHOLE_ITEM_ONLY_PROVEN_SAFE'
    AND temporal_discontinuity_policy = 'PERCEPTIBLE_DISCONTINUITY_REQUIRED'
    AND analytical_projection_policy = 'BOUND_HISTORICAL_PROJECTION_DIGEST'
    AND camera_emphasis_policy = 'EMPHASIS_WITHOUT_MEANING_CREATION'
    AND motion_policy = 'EXPLANATORY_MOTION_ONLY'
    AND caption_provenance_policy = 'DERIVED_CAPTION_DISTINCT_FROM_SOURCE'
    AND accessibility_parity_policy = 'EQUIVALENT_TRUTH_REQUIRED'
    AND reduced_motion_parity_policy = 'EQUIVALENT_TRUTH_REQUIRED'
    AND editorial_annotation_policy = 'NO_EDITORIAL_ANNOTATION'),
    CONSTRAINT replay_render_contract_versions_replay_fk
        FOREIGN KEY (replay_id) REFERENCES public.replays (id) ON DELETE RESTRICT,
    -- THE WHOLE COMPOSITION, AS ONE EXACT ROW: this render contract belongs to
    -- this exact analytical projection over this exact selection over this
    -- exact manifest of this exact Replay.
    CONSTRAINT replay_render_contract_versions_projection_fk
        FOREIGN KEY (analytical_projection_version_id, selection_spec_version_id,
                     source_manifest_version_id, replay_id)
        REFERENCES public.replay_analytical_projection_versions
          (id, selection_spec_version_id, source_manifest_version_id, replay_id)
        ON DELETE RESTRICT
);

CREATE INDEX replay_render_contract_versions_replay_idx
    ON public.replay_render_contract_versions (replay_id, contract_revision);

COMMENT ON TABLE public.replay_render_contract_versions IS
  'One immutable RENDER_CONTRACT_VERSION: the exact versioned truth policies a '
  'renderer of this exact composition must obey - original-medium '
  'preservation, exact source text, semantic-cut safety, perceptible temporal '
  'discontinuity, declared presentation pacing, the bound analytical '
  'projection, camera and motion truth, caption provenance, accessibility and '
  'reduced-motion parity and editorial-annotation separation. It defines NO '
  'codec, container, bitrate, resolution, storage provider, CDN, watermark, '
  'DRM, template, typography or choreography: those are deferred by CW2-05.';

-- ---------------------------------------------------------------------------
-- 7. THE FIRST COMPLETE REPLAY VERSION.
--
--    Every row binds ALL FOUR truth-relevant components, every one of them NOT
--    NULL, and binds them as ONE composition through composite foreign keys
--    rather than four independent references that could each name a row of a
--    different Replay:
--
--      manifest    belongs to this exact Replay
--      selection   belongs to this exact manifest
--      projection  belongs to this exact selection / manifest / Replay
--      contract    belongs to this exact projection / selection / manifest /
--                  Replay
--
--    There is no nullable truth component, no placeholder, no PENDING
--    projection and no partial version. A truth or material change creates a
--    NEW Replay Version; nothing here is ever mutated.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_versions (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    replay_version_revision integer NOT NULL,
    source_manifest_version_id uuid NOT NULL,
    selection_spec_version_id uuid NOT NULL,
    analytical_projection_version_id uuid NOT NULL,
    render_contract_version_id uuid NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT replay_versions_pk PRIMARY KEY (id),
    CONSTRAINT replay_versions_replay_key UNIQUE (id, replay_id),
    CONSTRAINT replay_versions_revision_key UNIQUE (replay_id, replay_version_revision),
    -- One complete Replay Version per exact render contract: a second version
    -- over the identical composition would be a duplicate truth, not a new one.
    CONSTRAINT replay_versions_contract_key UNIQUE (render_contract_version_id),
    CONSTRAINT replay_versions_revision_check CHECK (replay_version_revision >= 1),
    CONSTRAINT replay_versions_replay_fk
        FOREIGN KEY (replay_id) REFERENCES public.replays (id) ON DELETE RESTRICT,
    CONSTRAINT replay_versions_manifest_fk
        FOREIGN KEY (source_manifest_version_id, replay_id)
        REFERENCES public.replay_source_manifest_versions (id, replay_id) ON DELETE RESTRICT,
    CONSTRAINT replay_versions_selection_fk
        FOREIGN KEY (selection_spec_version_id, source_manifest_version_id)
        REFERENCES public.replay_selection_spec_versions (id, source_manifest_version_id) ON DELETE RESTRICT,
    CONSTRAINT replay_versions_projection_fk
        FOREIGN KEY (analytical_projection_version_id, selection_spec_version_id,
                     source_manifest_version_id, replay_id)
        REFERENCES public.replay_analytical_projection_versions
          (id, selection_spec_version_id, source_manifest_version_id, replay_id) ON DELETE RESTRICT,
    CONSTRAINT replay_versions_contract_fk
        FOREIGN KEY (render_contract_version_id, analytical_projection_version_id,
                     selection_spec_version_id, source_manifest_version_id, replay_id)
        REFERENCES public.replay_render_contract_versions
          (id, analytical_projection_version_id, selection_spec_version_id,
           source_manifest_version_id, replay_id) ON DELETE RESTRICT
);

CREATE INDEX replay_versions_replay_idx ON public.replay_versions (replay_id, replay_version_revision);
-- The access pattern I-06D source-loss enforcement needs: which complete Replay
-- Versions bind this exact source manifest.
CREATE INDEX replay_versions_manifest_idx ON public.replay_versions (source_manifest_version_id);

COMMENT ON TABLE public.replay_versions IS
  'The first canonical complete REPLAY_VERSION: one immutable row binding ALL '
  'FOUR truth-relevant components - the source manifest version, the selection '
  'spec version, the analytical projection version and the render contract '
  'version - as ONE composition, with no nullable component, no placeholder '
  'and no partial version. A truth or material change creates a NEW Replay '
  'Version and never mutates an old one. It is not a distribution artifact: '
  'finalized is not distributed.';

-- ---------------------------------------------------------------------------
-- 8. THE ONE MUTABLE CURRENT-VERSION POINTER.
--
--    One row per Replay that has reached PREVIEW_READY at least once: which
--    complete Replay Version is current. It moves forward only, one pointer
--    revision at a time, and never rewrites the immutable version it names.
--    It is NOT a lifecycle: the lifecycle lives on the stable Replay and its
--    append-only history below.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_current_version_state (
    replay_id uuid NOT NULL,
    current_replay_version_id uuid NOT NULL,
    pointer_revision bigint NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT replay_current_version_state_pk PRIMARY KEY (replay_id),
    CONSTRAINT replay_current_version_state_revision_check CHECK (pointer_revision >= 1),
    CONSTRAINT replay_current_version_state_replay_fk
        FOREIGN KEY (replay_id) REFERENCES public.replays (id) ON DELETE RESTRICT,
    CONSTRAINT replay_current_version_state_version_fk
        FOREIGN KEY (current_replay_version_id, replay_id)
        REFERENCES public.replay_versions (id, replay_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.replay_current_version_state IS
  'The ONE mutable pointer to the current complete Replay Version of one '
  'Replay. It moves forward only, through a controlled transaction, and never '
  'rewrites the immutable version it names.';

-- ---------------------------------------------------------------------------
-- 9. APPEND-ONLY FINALIZATION EVIDENCE, BOUND TO THE EXACT VERSION.
--
--    A later lifecycle transition must never rewrite whether a specific Replay
--    Version was finalized. The exact version is the PRIMARY KEY, so:
--
--      * finalization is idempotent by construction;
--      * I-06C can ask "was THIS exact version finalized?" with one key
--        lookup, and never has to infer historical finalization from the
--        stable Replay's CURRENT lifecycle;
--      * returning a Replay to DRAFT, or finalizing a later version, leaves
--        this row exactly as it was.
--
--    The finalizing human is bound to the Replay creator STRUCTURALLY, through
--    the 0100 identity key.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_version_finalizations (
    replay_version_id uuid NOT NULL,
    replay_id uuid NOT NULL,
    finalized_by_user_id uuid NOT NULL,
    finalized_at timestamptz NOT NULL,
    CONSTRAINT replay_version_finalizations_pk PRIMARY KEY (replay_version_id),
    CONSTRAINT replay_version_finalizations_version_fk
        FOREIGN KEY (replay_version_id, replay_id)
        REFERENCES public.replay_versions (id, replay_id) ON DELETE RESTRICT,
    CONSTRAINT replay_version_finalizations_creator_fk
        FOREIGN KEY (replay_id, finalized_by_user_id)
        REFERENCES public.replays (id, created_by_user_id) ON DELETE RESTRICT
);

CREATE INDEX replay_version_finalizations_replay_idx
    ON public.replay_version_finalizations (replay_id, finalized_at);

COMMENT ON TABLE public.replay_version_finalizations IS
  'Append-only evidence that ONE EXACT complete Replay Version was finalized '
  'by its exact creator at an exact instant. The exact version is the primary '
  'key, so finalization is idempotent and a later edit can never rewrite it: a '
  'previously finalized version stays historically finalized forever. '
  'FINALIZED is not distributed - it creates no audience, no package and no '
  'approval.';

-- ---------------------------------------------------------------------------
-- 10. THE APPEND-ONLY LIFECYCLE HISTORY.
--
--     Every transition of the stable Replay, in order, with the exact version
--     it concerned. The transition CHECK admits exactly the frozen lifecycle
--     and nothing else, so an impossible history is unrepresentable:
--
--       DRAFT         -> PREVIEW_READY   a complete Replay Version was built
--       PREVIEW_READY -> FINALIZED       that exact version was finalized
--       PREVIEW_READY -> DRAFT           the creator reopened for revision
--       FINALIZED     -> DRAFT           the creator reopened for revision
--
--     A reopen names the version it left behind, so the history says WHICH
--     version the Replay returned from without mutating that version.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_lifecycle_events (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    event_ordinal integer NOT NULL,
    from_lifecycle text NOT NULL,
    to_lifecycle text NOT NULL,
    replay_version_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT replay_lifecycle_events_pk PRIMARY KEY (id),
    CONSTRAINT replay_lifecycle_events_ordinal_key UNIQUE (replay_id, event_ordinal),
    CONSTRAINT replay_lifecycle_events_ordinal_check CHECK (event_ordinal >= 1),
    -- EXACTLY THE FROZEN TRANSITIONS, AND NOTHING ELSE.
    CONSTRAINT replay_lifecycle_events_transition_check CHECK (
        (from_lifecycle = 'DRAFT' AND to_lifecycle = 'PREVIEW_READY')
     OR (from_lifecycle = 'PREVIEW_READY' AND to_lifecycle = 'FINALIZED')
     OR (from_lifecycle = 'PREVIEW_READY' AND to_lifecycle = 'DRAFT')
     OR (from_lifecycle = 'FINALIZED' AND to_lifecycle = 'DRAFT')),
    CONSTRAINT replay_lifecycle_events_replay_fk
        FOREIGN KEY (replay_id) REFERENCES public.replays (id) ON DELETE RESTRICT,
    -- The exact version the transition concerned, of this exact Replay.
    CONSTRAINT replay_lifecycle_events_version_fk
        FOREIGN KEY (replay_version_id, replay_id)
        REFERENCES public.replay_versions (id, replay_id) ON DELETE RESTRICT,
    -- The acting human is the Replay creator, structurally.
    CONSTRAINT replay_lifecycle_events_creator_fk
        FOREIGN KEY (replay_id, actor_user_id)
        REFERENCES public.replays (id, created_by_user_id) ON DELETE RESTRICT
);

CREATE INDEX replay_lifecycle_events_replay_idx
    ON public.replay_lifecycle_events (replay_id, event_ordinal);

COMMENT ON TABLE public.replay_lifecycle_events IS
  'The append-only lifecycle history of one stable Replay: every transition, '
  'in order, with the exact complete Replay Version it concerned and the exact '
  'creator who caused it. Only the frozen transitions are representable.';

-- ---------------------------------------------------------------------------
-- 11. IMMUTABILITY AND LIFECYCLE TRIGGERS.
--
--     BEFORE triggers rather than privileges alone, for the reason migrations
--     0064, 0091 and 0100 established: privileges do not bind the table owner,
--     and a future accidental GRANT would otherwise reopen mutation.
--
--     None of these is a forward ceiling. A later slice appends new component
--     versions, moves the pointer forward, finalizes a later version and
--     builds a distribution package beside all of this; none of that is
--     refused here.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_replay_version_component_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'REPLAY_VERSION_COMPONENT_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='An analytical projection version and its points, a semantic-cut assessment, a temporal discontinuity, a render contract version, a complete Replay Version, a finalization record and a lifecycle event are append-only: UPDATE and DELETE are refused for every role, including the table owner. A changed truth is a NEW Replay Version.';
END$$;

ALTER FUNCTION public.reject_replay_version_component_mutation_v1() OWNER TO postgres;

CREATE TRIGGER replay_analytical_projection_versions_immutable
    BEFORE UPDATE OR DELETE ON public.replay_analytical_projection_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_version_component_mutation_v1();
CREATE TRIGGER replay_analytical_projection_points_immutable
    BEFORE UPDATE OR DELETE ON public.replay_analytical_projection_points
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_version_component_mutation_v1();
CREATE TRIGGER replay_semantic_cut_assessments_immutable
    BEFORE UPDATE OR DELETE ON public.replay_semantic_cut_assessments
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_version_component_mutation_v1();
CREATE TRIGGER replay_temporal_discontinuities_immutable
    BEFORE UPDATE OR DELETE ON public.replay_temporal_discontinuities
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_version_component_mutation_v1();
CREATE TRIGGER replay_render_contract_versions_immutable
    BEFORE UPDATE OR DELETE ON public.replay_render_contract_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_version_component_mutation_v1();
CREATE TRIGGER replay_versions_immutable
    BEFORE UPDATE OR DELETE ON public.replay_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_version_component_mutation_v1();
CREATE TRIGGER replay_version_finalizations_immutable
    BEFORE UPDATE OR DELETE ON public.replay_version_finalizations
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_version_component_mutation_v1();
CREATE TRIGGER replay_lifecycle_events_immutable
    BEFORE UPDATE OR DELETE ON public.replay_lifecycle_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_version_component_mutation_v1();

-- The current-version pointer moves forward only, one revision at a time, and
-- never changes which Replay it belongs to.
CREATE FUNCTION public.replay_current_version_forward_only_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.replay_id <> OLD.replay_id THEN
    RAISE EXCEPTION 'REPLAY_CURRENT_VERSION_IS_BOUND' USING ERRCODE='55000';
  END IF;
  IF NEW.pointer_revision <> OLD.pointer_revision + 1 THEN
    RAISE EXCEPTION 'REPLAY_CURRENT_VERSION_MUST_ADVANCE' USING ERRCODE='55000',
      DETAIL='The current complete Replay Version pointer moves forward exactly one revision per controlled transaction.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.replay_current_version_forward_only_v1() OWNER TO postgres;

CREATE TRIGGER replay_current_version_state_forward_only
    BEFORE UPDATE ON public.replay_current_version_state
    FOR EACH ROW EXECUTE FUNCTION public.replay_current_version_forward_only_v1();

-- THE LIFECYCLE MOVES ONLY ALONG THE FROZEN TRANSITIONS. Migration 0100
-- deliberately left the lifecycle free so I-06B could own its transitions;
-- this is I-06B owning them, for every role including the table owner. A jump
-- from DRAFT straight to FINALIZED is unrepresentable rather than refused by a
-- procedure somebody could bypass.
CREATE FUNCTION public.replay_lifecycle_transition_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.current_lifecycle = OLD.current_lifecycle THEN
    RETURN NEW;
  END IF;
  IF NOT ((OLD.current_lifecycle = 'DRAFT' AND NEW.current_lifecycle = 'PREVIEW_READY')
       OR (OLD.current_lifecycle = 'PREVIEW_READY' AND NEW.current_lifecycle = 'FINALIZED')
       OR (OLD.current_lifecycle = 'PREVIEW_READY' AND NEW.current_lifecycle = 'DRAFT')
       OR (OLD.current_lifecycle = 'FINALIZED' AND NEW.current_lifecycle = 'DRAFT')) THEN
    RAISE EXCEPTION 'REPLAY_LIFECYCLE_TRANSITION_INVALID' USING ERRCODE='55000',
      DETAIL='A Replay moves DRAFT -> PREVIEW_READY -> FINALIZED, and returns to DRAFT only through an explicit creator-exact revision. No other transition exists.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.replay_lifecycle_transition_v1() OWNER TO postgres;

CREATE TRIGGER replays_lifecycle_transition
    BEFORE UPDATE ON public.replays
    FOR EACH ROW EXECUTE FUNCTION public.replay_lifecycle_transition_v1();

-- ---------------------------------------------------------------------------
-- 12. DENY-BY-DEFAULT POSTURE.
-- ---------------------------------------------------------------------------
ALTER TABLE public.replay_analytical_projection_versions OWNER TO postgres;
ALTER TABLE public.replay_analytical_projection_points OWNER TO postgres;
ALTER TABLE public.replay_semantic_cut_assessments OWNER TO postgres;
ALTER TABLE public.replay_temporal_discontinuities OWNER TO postgres;
ALTER TABLE public.replay_render_contract_versions OWNER TO postgres;
ALTER TABLE public.replay_versions OWNER TO postgres;
ALTER TABLE public.replay_current_version_state OWNER TO postgres;
ALTER TABLE public.replay_version_finalizations OWNER TO postgres;
ALTER TABLE public.replay_lifecycle_events OWNER TO postgres;

ALTER TABLE public.replay_analytical_projection_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_analytical_projection_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_semantic_cut_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_temporal_discontinuities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_render_contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_current_version_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_version_finalizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_lifecycle_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.replay_analytical_projection_versions,
                    public.replay_analytical_projection_points,
                    public.replay_semantic_cut_assessments,
                    public.replay_temporal_discontinuities,
                    public.replay_render_contract_versions,
                    public.replay_versions,
                    public.replay_current_version_state,
                    public.replay_version_finalizations,
                    public.replay_lifecycle_events
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.replay_analytical_projection_versions, public.replay_analytical_projection_points, public.replay_semantic_cut_assessments, public.replay_temporal_discontinuities, public.replay_render_contract_versions, public.replay_versions, public.replay_current_version_state, public.replay_version_finalizations, public.replay_lifecycle_events FROM service_role';
END IF;END$$;

-- The trigger functions are internal and are invoked directly by nobody.
REVOKE ALL ON FUNCTION public.reject_replay_version_component_mutation_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replay_current_version_forward_only_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replay_lifecycle_transition_v1() FROM PUBLIC;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_replay_version_component_mutation_v1(), public.replay_current_version_forward_only_v1(), public.replay_lifecycle_transition_v1() FROM anon, authenticated, service_role';
ELSE
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_replay_version_component_mutation_v1(), public.replay_current_version_forward_only_v1(), public.replay_lifecycle_transition_v1() FROM anon, authenticated';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 13. SELF-ASSERTIONS.
--
--     What must already be true of THIS migration for it to be allowed to
--     deploy. Each is a fact about the objects 0102 owns or the frozen truths
--     it binds - never a census of the database, and never a ceiling on
--     migration 0103 or on the later I-06C / I-06D slices: no assertion here
--     names a distribution package, an approver set, a publish / share /
--     download action, a source-loss record or a Launch wrapper as forbidden
--     anywhere in the database. They are forbidden ON THE RELATIONS THIS
--     MIGRATION OWNS, which is a contract about this slice and not a ceiling
--     on the roadmap.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_tables text[] := ARRAY['replay_analytical_projection_versions', 'replay_analytical_projection_points',
                             'replay_semantic_cut_assessments', 'replay_temporal_discontinuities',
                             'replay_render_contract_versions', 'replay_versions',
                             'replay_current_version_state', 'replay_version_finalizations',
                             'replay_lifecycle_events'];
  append_only text[] := ARRAY['replay_analytical_projection_versions', 'replay_analytical_projection_points',
                              'replay_semantic_cut_assessments', 'replay_temporal_discontinuities',
                              'replay_render_contract_versions', 'replay_versions',
                              'replay_version_finalizations', 'replay_lifecycle_events'];
  t text;
  needed text;
  n integer;
  guard text;
BEGIN
  FOREACH t IN ARRAY own_tables LOOP
    -- A REPLAY IS NOT A WORLD.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(world_type|phase|birth_basis|member|episode|governance|proposal|approv|coordinate|embedding|vitality|ranking)'
    ) THEN
      RAISE EXCEPTION 'I-06B: a Replay is a source-bound artifact, never a World: relation % may carry no World membership governance or approval column', t;
    END IF;
    -- CREATION IS NOT DISTRIBUTION, AND NOTHING HERE CLAIMS SAFETY OR LAUNCH.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(public_flag|is_public|is_shared|shareable|share_flag|share_link|sharing|download|distribut|export|premium|safety|moderation|entitle|launch|clearance|feature_flag|approver|audience)'
    ) THEN
      RAISE EXCEPTION 'I-06B: relation % may carry no distribution Safety Launch or entitlement column: finalized is not distributed', t;
    END IF;
    -- A TRUTH COMPONENT IS A COMMITMENT, NEVER A COPY. No content column of
    -- any kind, no JSON blob, no binary payload: the analytical commitment is
    -- a one-way digest and the source body stays where the manifest bound it.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       JOIN pg_type ty ON ty.oid = a.atttypid
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND (a.attname ~ '(body|_text$|^text|transcript|audio|content|payload|blob|document|excerpt|snippet|caption_text|statement|moment|committed)'
              OR ty.typname IN ('json', 'jsonb', 'bytea'))
    ) THEN
      RAISE EXCEPTION 'I-06B: relation % may carry no source or analytical content column: a projection commits a digest and copies nothing', t;
    END IF;
    -- A RENDER CONTRACT IS A TRUTH CONTRACT, NEVER A CODEC.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(codec|container|bitrate|resolution|frame_rate|framerate|cdn|storage_|bucket|object_key|watermark|drm|template|font|typograph|choreograph|easing|palette)'
    ) THEN
      RAISE EXCEPTION 'I-06B: relation % may define no codec container storage or visual craft column: CW2-05 defers all of it', t;
    END IF;
    -- No body relation, no sealed provenance and no raw turn is ever a parent.
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid IN ('public.publication_package_item_provenance'::regclass,
                             'public.shared_world_text_material_bodies'::regclass,
                             'public.shared_world_voice_note_material_bodies'::regclass,
                             'public.public_experience_text_derivative_bodies'::regclass,
                             'public.conversation_turns'::regclass)
    ) THEN
      RAISE EXCEPTION 'I-06B: relation % must bind no body relation no sealed provenance and no raw turn', t;
    END IF;
    -- Every foreign key this migration installs is restrictive.
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f' AND c.confdeltype <> 'r'
    ) THEN
      RAISE EXCEPTION 'I-06B: every Replay foreign key is restrictive: relation % must never cascade truth away', t;
    END IF;
    -- Every identifier fits the 63-byte limit, so nothing is silently truncated.
    IF length(t) > 63 OR EXISTS (SELECT 1 FROM pg_constraint c
                                  WHERE c.conrelid = ('public.' || t)::regclass AND length(c.conname) > 63)
       OR EXISTS (SELECT 1 FROM pg_class idx JOIN pg_index ix ON ix.indexrelid = idx.oid
                   WHERE ix.indrelid = ('public.' || t)::regclass AND length(idx.relname) > 63) THEN
      RAISE EXCEPTION 'I-06B: an identifier on % exceeds the PostgreSQL 63-byte limit', t;
    END IF;
    -- Deny by default, and PART A writes no row.
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
    FOREACH needed IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN needed <> 'public' AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = needed);
      IF has_table_privilege(needed, ('public.' || t)::regclass, 'SELECT')
         OR has_table_privilege(needed, ('public.' || t)::regclass, 'INSERT')
         OR has_table_privilege(needed, ('public.' || t)::regclass, 'UPDATE')
         OR has_table_privilege(needed, ('public.' || t)::regclass, 'DELETE') THEN
        RAISE EXCEPTION 'I-06B: relation % must hold no privilege for %', t, needed;
      END IF;
    END LOOP;
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n <> 0 THEN
      RAISE EXCEPTION 'I-06B: PART A is persistence and writes no row: % holds %', t, n;
    END IF;
  END LOOP;

  -- EVERY TRUTH COMPONENT IS APPEND-ONLY FOR EVERY ROLE, including the owner.
  FOREACH t IN ARRAY append_only LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
       WHERE tg.tgrelid = ('public.' || t)::regclass AND NOT tg.tgisinternal
         AND tg.tgfoid = 'public.reject_replay_version_component_mutation_v1'::regproc
    ) THEN
      RAISE EXCEPTION 'I-06B: relation % must be append-only for every role', t;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_current_version_state'::regclass
                  AND tg.tgname = 'replay_current_version_state_forward_only' AND NOT tg.tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replays'::regclass
                     AND tg.tgname = 'replays_lifecycle_transition' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-06B: the forward-only pointer and the lifecycle transition guards must be installed';
  END IF;

  -- A COMPLETE REPLAY VERSION BINDS ALL FOUR COMPONENTS, NOT NULL, AS ONE
  -- COMPOSITION. Each component column is NOT NULL and each composite key
  -- reaches the exact parent with the exact number of columns.
  FOREACH needed IN ARRAY ARRAY['source_manifest_version_id', 'selection_spec_version_id',
                                'analytical_projection_version_id', 'render_contract_version_id'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = 'public.replay_versions'::regclass AND a.attname = needed
         AND a.attnotnull AND NOT a.attisdropped
    ) THEN
      RAISE EXCEPTION 'I-06B: a complete Replay Version must bind % and it can never be null', needed;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_versions'::regclass
       AND c.conname = 'replay_versions_projection_fk'
       AND c.confrelid = 'public.replay_analytical_projection_versions'::regclass
       AND cardinality(c.confkey) = 4
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_versions'::regclass
       AND c.conname = 'replay_versions_contract_fk'
       AND c.confrelid = 'public.replay_render_contract_versions'::regclass
       AND cardinality(c.confkey) = 5
  ) THEN
    RAISE EXCEPTION 'I-06B: a complete Replay Version must bind its projection and render contract as ONE exact composition, never through independent partial keys';
  END IF;
  -- AND THE PROJECTION BINDS ITS SELECTION THE SAME WAY: the selection, its
  -- manifest, its Replay and its selected count from ONE selection-spec row.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_analytical_projection_versions'::regclass
       AND c.conname = 'replay_analytical_projection_versions_selection_fk'
       AND c.confrelid = 'public.replay_selection_spec_versions'::regclass
       AND cardinality(c.confkey) = 4
  ) THEN
    RAISE EXCEPTION 'I-06B: an analytical projection must bind its selection its manifest its Replay and its point count as ONE exact selection row';
  END IF;

  -- THE REPRESENTED TC IS THE SELECTED ITEM'S OWN CANONICAL SESSION POSITION,
  -- and only a SEALED point is representable.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_analytical_projection_points'::regclass
       AND c.conname = 'replay_analytical_projection_points_manifest_position_fk'
       AND c.confrelid = 'public.replay_source_manifest_items'::regclass
       AND cardinality(c.confkey) = 3
  ) THEN
    RAISE EXCEPTION 'I-06B: a projection point must bind its represented TC to the exact manifest item canonical Session Position';
  END IF;
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_analytical_projection_points'::regclass
         AND c.conname = 'replay_analytical_projection_points_sealed_check') !~ 'projection_sealed'
     OR (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
          WHERE c.conrelid = 'public.replay_analytical_projection_points'::regclass
            AND c.conname = 'replay_analytical_projection_points_live_head_check')
        !~ 'projection_live_head > represented_session_position' THEN
    RAISE EXCEPTION 'I-06B: only a SEALED represented point may be frozen: the open Live Head must be unrepresentable';
  END IF;

  -- SEMANTIC CUT SAFETY IS CONSERVATIVE, STRUCTURALLY.
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_semantic_cut_assessments'::regclass
         AND c.conname = 'replay_semantic_cut_assessments_safe_check') !~ 'WHOLE_ITEM'
     OR (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
          WHERE c.conrelid = 'public.replay_semantic_cut_assessments'::regclass
            AND c.conname = 'replay_semantic_cut_assessments_partial_check') !~ 'UNPROVEN' THEN
    RAISE EXCEPTION 'I-06B: only an untrimmed WHOLE_ITEM selection may be SAFE and a partial range may be nothing but UNPROVEN or REJECTED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_semantic_cut_assessments'::regclass
       AND c.conname = 'replay_semantic_cut_assessments_item_fk'
       AND c.confrelid = 'public.replay_selection_spec_items'::regclass
       AND cardinality(c.confkey) = 3
  ) THEN
    RAISE EXCEPTION 'I-06B: a semantic-cut assessment must bind the exact selected item AND its exact anchor kind as ONE row';
  END IF;

  -- A DISCONTINUITY IS A DERIVED GAP AND CARRIES NO OMITTED CONTENT.
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute a
     WHERE a.attrelid = 'public.replay_temporal_discontinuities'::regclass
       AND a.attname = 'omitted_source_item_count' AND a.attgenerated = 's'
  ) THEN
    RAISE EXCEPTION 'I-06B: the omitted count must be GENERATED from the two captured ranks, never written';
  END IF;
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_temporal_discontinuities'::regclass
         AND c.conname = 'replay_temporal_discontinuities_gap_check') !~ 'omitted_source_item_count > 0' THEN
    RAISE EXCEPTION 'I-06B: a contiguous pair can never be recorded as a discontinuity';
  END IF;

  -- THE RENDER CONTRACT IS A TRUTH CONTRACT WITH EXACT VERSIONED POLICIES.
  FOREACH needed IN ARRAY ARRAY['original_medium_policy', 'source_text_policy', 'semantic_cut_policy',
                                'temporal_discontinuity_policy', 'timing_integrity_policy',
                                'analytical_projection_policy', 'camera_emphasis_policy', 'motion_policy',
                                'caption_provenance_policy', 'accessibility_parity_policy',
                                'reduced_motion_parity_policy', 'editorial_annotation_policy'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = 'public.replay_render_contract_versions'::regclass
         AND a.attname = needed AND a.attnotnull AND NOT a.attisdropped
    ) THEN
      RAISE EXCEPTION 'I-06B: every render contract must declare %', needed;
    END IF;
  END LOOP;
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_render_contract_versions'::regclass
         AND c.conname = 'replay_render_contract_versions_medium_check') !~ 'ORIGINAL_TEXT_ONLY'
     OR (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
          WHERE c.conrelid = 'public.replay_render_contract_versions'::regclass
            AND c.conname = 'replay_render_contract_versions_timing_check') !~ 'PRESENTATION_PACING_DECLARED' THEN
    RAISE EXCEPTION 'I-06B: original audio cannot be rendered without an authorized media path and a text event has no original voice timing';
  END IF;

  -- THE ANALYTICAL PROJECTION IS THE CANONICAL PERSONAL ONE, BOUND TO THE
  -- MANIFEST CLASS STRUCTURALLY: the census found no equivalent canonical
  -- historical analytical substrate for SHARED_WORLD or PUBLIC_EXPERIENCE, and
  -- none is invented, so a Shared or Public manifest cannot carry one.
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_analytical_projection_versions'::regclass
         AND c.conname = 'replay_analytical_projection_versions_capability_check')
     !~ 'PERSONAL_SESSION_HISTORICAL_PROJECTION'
     OR NOT EXISTS (
       SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'public.replay_analytical_projection_versions'::regclass
          AND c.conname = 'replay_analytical_projection_versions_class_fk'
          AND c.confrelid = 'public.replay_source_manifest_versions'::regclass
          AND cardinality(c.confkey) = 2) THEN
    RAISE EXCEPTION 'I-06B: the analytical projection capability must be the canonical Personal one and its source class must be read from the exact manifest';
  END IF;
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_analytical_projection_versions'::regclass
         AND c.conname = 'replay_analytical_projection_versions_schema_check')
     !~ 'QANDEEL_REPLAY_ANALYTICAL_PROJECTION_V1' THEN
    RAISE EXCEPTION 'I-06B: the analytical projection canonicalization schema identity must be pinned';
  END IF;

  -- FINALIZATION EVIDENCE IS EXACT-VERSION BOUND AND CANNOT BE REBOUND.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_version_finalizations'::regclass
       AND c.contype = 'p' AND cardinality(c.conkey) = 1
       AND (SELECT a.attname FROM pg_attribute a
             WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]) = 'replay_version_id'
  ) THEN
    RAISE EXCEPTION 'I-06B: finalization evidence must be keyed by the EXACT Replay Version, so I-06C never infers it from a current lifecycle';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_version_finalizations'::regclass AND c.contype = 'f'
       AND c.confrelid = 'public.replays'::regclass AND cardinality(c.confkey) = 2
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_lifecycle_events'::regclass AND c.contype = 'f'
       AND c.confrelid = 'public.replays'::regclass AND cardinality(c.confkey) = 2
  ) THEN
    RAISE EXCEPTION 'I-06B: finalization and lifecycle evidence must bind the acting human to the exact Replay creator through the identity key';
  END IF;
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_lifecycle_events'::regclass
         AND c.conname = 'replay_lifecycle_events_transition_check') !~ 'PREVIEW_READY' THEN
    RAISE EXCEPTION 'I-06B: the lifecycle history must admit exactly the frozen transitions';
  END IF;
  guard := (SELECT p.prosrc FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
             WHERE ns.nspname = 'public' AND p.proname = 'replay_lifecycle_transition_v1');
  IF guard !~ 'DRAFT'' AND NEW\.current_lifecycle = ''PREVIEW_READY'
     OR guard !~ 'PREVIEW_READY'' AND NEW\.current_lifecycle = ''FINALIZED'
     OR guard !~ 'FINALIZED'' AND NEW\.current_lifecycle = ''DRAFT' THEN
    RAISE EXCEPTION 'I-06B: the lifecycle guard must admit exactly the frozen transitions and no jump';
  END IF;

  -- PART A CREATES NO WRITER. Every function this migration owns returns
  -- `trigger` and is callable as nothing else; the writers are migration 0103.
  FOREACH needed IN ARRAY ARRAY['reject_replay_version_component_mutation_v1',
                                'replay_current_version_forward_only_v1',
                                'replay_lifecycle_transition_v1'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
       WHERE ns.nspname = 'public' AND p.proname = needed AND p.prorettype = 'trigger'::regtype
    ) THEN
      RAISE EXCEPTION 'I-06B: % must be a trigger function and nothing else', needed;
    END IF;
  END LOOP;

  -- THE ADDITIVE CANDIDATE KEYS THIS MIGRATION NEEDED ARE PRESENT, AND THE
  -- I-06A RELATIONS THEY WERE ADDED TO STILL CARRY EVERY GUARD THEY HAD.
  FOREACH needed IN ARRAY ARRAY['replay_source_manifest_versions_class_key',
                                'replay_source_manifest_items_position_key',
                                'replay_source_manifest_items_rank_order_key',
                                'replay_selection_spec_items_exact_key',
                                'replay_selection_spec_items_anchor_key',
                                'replay_selection_spec_versions_exact_key'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname = needed AND c.contype = 'u') THEN
      RAISE EXCEPTION 'I-06B: the additive candidate key % must exist', needed;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_source_manifest_versions'::regclass
                  AND tg.tgname = 'replay_source_manifest_versions_immutable' AND NOT tg.tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_selection_spec_items'::regclass
                     AND tg.tgname = 'replay_selection_spec_items_chronology' AND NOT tg.tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_source_manifest_items'::regclass
                     AND tg.tgname = 'replay_source_manifest_items_one_row' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-06B: the frozen I-06A immutability chronology and same-row guards must still be in place';
  END IF;

  -- THE CANONICAL HISTORICAL CONSTITUTION THIS SLICE CONSUMES MUST BE INTACT,
  -- and this migration must have created no competing clock or projection.
  IF to_regprocedure('public.get_session_historical_projection_v1(uuid, integer)') IS NULL THEN
    RAISE EXCEPTION 'I-06B: the canonical Personal historical projection must exist: I-06B reuses it and creates no Replay-specific historical clock';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = 'public.session_historical_coverage'::regclass
                  AND c.conname = 'session_historical_coverage_state_check'
                  AND pg_get_constraintdef(c.oid) ~ 'LEGACY_UNCOVERED') THEN
    RAISE EXCEPTION 'I-06B: the canonical coverage decision must still distinguish a LEGACY UNCOVERED Session';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public' AND c.relkind = 'r'
       AND c.relname ~ '^replay_.*(semantic_clock|world_version|baseline|coverage)'
  ) THEN
    RAISE EXCEPTION 'I-06B: a Replay may not own a historical clock baseline or coverage of its own: migration 0072 is the ONE temporal constitution';
  END IF;
END$$;

COMMIT;
