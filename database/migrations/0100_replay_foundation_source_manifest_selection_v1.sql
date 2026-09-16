-- I-06A - Replay Foundation: stable identity, immutable source manifest and
-- selection-spec versions, and the creator-private draft composition (PART A).
--
-- I-05 completed the Public World. This migration opens `I-06 - Replay
-- Runtime` with persistence only: it creates the stable REPLAY identity, the
-- immutable REPLAY_SOURCE_MANIFEST_VERSION, the immutable
-- REPLAY_SELECTION_SPEC_VERSION and the ONE mutable draft composition pointer.
-- It creates NO writer. Every primitive is migration 0101.
--
-- ===========================================================================
-- What a Replay IS here, and what it deliberately is NOT
-- ===========================================================================
--
-- The Product law is that the sound is what happened and the picture is how
-- QANDEEL understood it. A Replay is therefore a SOURCE-BOUND, temporally
-- truthful DERIVED ARTIFACT (CW2-01 section 31 / A22, CW2-05):
--
--   architectureClass = MATERIAL_ARTIFACT
--   kind              = REPLAY_ARTIFACT
--
-- exactly as the merged I-01A kernel classifies it
-- (apps/api/src/connected-worlds/kernel/material.types.ts, `ReplayArtifact`,
-- and world.types.ts `NON_WORLD_KINDS`). Exactly three World types exist -
-- MY_WORLD, SHARED_WORLD, PUBLIC_WORLD - and a Replay is none of them. So:
--
--   * no generic `worlds` table, no `world_type`, `phase`, `birth_basis`,
--     `lifecycle` of a World, membership, governance, semantic coordinate or
--     World lifecycle appears on any relation here, and the migration refuses
--     to deploy with one;
--   * no distribution state appears on the Replay identity: no public / share /
--     download flag, no distribution approver, no Premium, Safety or Launch
--     column. The frozen kernel already separates the two authorities -
--     `CREATE_INTERNAL_REPLAY_DRAFT` is NO_AUDIENCE_EXPANSION and
--     `DISTRIBUTE_REPLAY_EXTERNALLY` is AUDIENCE_EXPANSION (authority.types.ts)
--     - and I-06A implements REPLAY_CREATION_AUTHORITY only. Distribution is
--     I-06C.
--
-- ===========================================================================
-- Why there is NO REPLAY_VERSION relation in this migration
-- ===========================================================================
--
-- The frozen Replay invariants require every canonical REPLAY_VERSION to bind
-- ALL truth-relevant components: REPLAY_SOURCE_MANIFEST_VERSION,
-- REPLAY_SELECTION_SPEC_VERSION, ANALYTICAL_PROJECTION_VERSION and
-- RENDER_CONTRACT_VERSION. I-06A owns the first two. The analytical projection
-- and the render contract are I-06B. A REPLAY_VERSION that bound two components
-- and two placeholders would be a fake truth version, so none is created here:
-- the stable Replay carries a private DRAFT composition - the current manifest
-- version, the current selection-spec version and a draft revision - and the
-- first complete REPLAY_VERSION belongs to the slice that can bind all four
-- truthfully. The seam is additive: I-06B adds its relations beside these and
-- binds the exact component versions this migration makes immutable.
--
-- ===========================================================================
-- The source manifest is a binding, never a copy
-- ===========================================================================
--
-- Replay remains SOURCE-BOUND. A manifest item identifies exact authorized
-- source truth - the source class, the exact object identity, the exact
-- version / availability revision, the original medium, the canonical temporal
-- anchor and a one-way digest of the exact source bytes - and it identifies
-- NOTHING BY CONTENT. There is no body, text, transcript, audio reference,
-- payload or JSON column anywhere in this migration, no foreign key to a Shared
-- body relation that owner deletion destroys, and no reference at all to the
-- sealed Public provenance relation. A later owner deletion or unavailability
-- therefore makes a draft STALE (migration 0101 derives that) instead of being
-- defeated by a private shadow copy. Preserving provenance identity after
-- deletion is allowed; reconstructing deleted content is not.
--
-- The three source classes are kept apart BY STRUCTURE, exactly as the frozen
-- 0089 provenance and 0092 sealed provenance keep theirs: one exact-shape CHECK
-- per relation, class-specific restrictive foreign keys, and composite foreign
-- keys that bind every item to its own manifest's exact source context, so a
-- Personal item can never carry a Shared identifier and an item can never name
-- a World or Session its manifest does not.
--
--   MY_WORLD           the exact committed Conversational Unit (0064) at its
--                      exact Session Position (0065) in a Session the creator
--                      owns; the manifest binds (Session, owner) -> the creator
--                      through the Replay row itself
--   SHARED_WORLD       the exact I-04G material, its exact I-04F history item,
--                      its material kind and the exact availability revision
--                      captured, in one exact Shared World
--   PUBLIC_EXPERIENCE  the exact bounded public package item of the exact
--                      Experience Version the controller is authorized to use
--                      - bound to (version, Experience, manifest) as ONE row
--                      through the additive 0095 candidate key
--
-- ===========================================================================
-- Temporal truth: anchors, not clocks
-- ===========================================================================
--
-- Migration 0072 owns the canonical temporal / no-hindsight constitution and
-- this migration creates no competing clock. A Personal item binds the
-- Session Position (`conversation_units.session_position`, the canonical
-- intra-Session order of committed units); a Shared item binds the frozen
-- Shared-World establishment instant (`shared_world_history_items.occurred_at`,
-- 0087 COMMENT ON COLUMN); a Public item binds the package's deterministic
-- item ordinal. `created_at` never decides anything. Every item also carries
-- its rank inside the authorized source universe that was captured, which is
-- the machine truth migration 0101 uses to derive whether a selection is
-- contiguous in the SOURCE and whether FULL_SOURCE is provable at all.
--
-- ===========================================================================
-- Selection is structure, not a timeline editor
-- ===========================================================================
--
-- A selection-spec version binds stable manifest item identities, a derived
-- chronological order, exact source-native anchors (whole item, or a code-point
-- range inside a text item) and a coverage class. The order of selected items
-- is DERIVED from the manifest's canonical order and a BEFORE INSERT trigger
-- makes a chronology reversal unrepresentable, not merely refused. FULL_SOURCE
-- is representable only when every manifest item is selected whole AND the
-- manifest captured the complete authorized universe - the second half is a
-- generated column on the manifest bound by composite foreign key, so a caller
-- cannot self-assert completeness however the row is produced. No column says
-- a cut is render-safe: Semantic Cut Safety belongs to I-06B.
--
-- ===========================================================================
-- Security posture
-- ===========================================================================
--
-- Every relation is postgres-owned, RLS-enabled with zero policies, and revoked
-- from PUBLIC, anon, authenticated and service_role. The four component
-- relations are append-only for every role including the table owner, by
-- BEFORE trigger (the 0064 / 0091 rule: privileges do not bind the owner). The
-- Replay identity refuses to be re-bound to another creator, and the draft
-- pointer moves forward only. This migration creates no function that is not
-- a trigger function, grants nothing, and writes no row.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- No REPLAY_VERSION, ANALYTICAL_PROJECTION_VERSION or RENDER_CONTRACT_VERSION;
-- no PREVIEW_READY or FINALIZED writer; no rendering, timing, camera, caption,
-- codec, media storage or export; no distribution package, approval, publish,
-- share or download; no Safety, moderation, entitlement, feature flag or Launch
-- Gate; no Matching, Introduction, route, controller, RPC or mobile surface; no
-- Personal audio or call source (none exists in this repository:
-- `conversation_units.source_modality` is CHECK-pinned to TEXT). It alters no
-- predecessor table. Migrations 0001-0099 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE STABLE REPLAY IDENTITY.
--
--    One row per Replay, stable across every draft revision and every future
--    complete Replay Version. The exact human creator is bound at birth and can
--    never be re-bound (section 8). The lifecycle vocabulary is complete so
--    I-06B is additive, but no I-06A writer produces anything but DRAFT.
--
--    UNIQUE (id, created_by_user_id) exists so a component that must belong to
--    the creator's OWN source can bind (replay, creator) structurally: the
--    Personal manifest below binds its Session owner to this pair.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replays (
    id uuid NOT NULL,
    created_by_user_id uuid NOT NULL,
    current_lifecycle text NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT replays_pk PRIMARY KEY (id),
    CONSTRAINT replays_creator_key UNIQUE (id, created_by_user_id),
    -- The complete forward-safe lifecycle vocabulary. PREVIEW_READY and
    -- FINALIZED are representable so I-06B is additive; NO I-06A writer
    -- produces either, which migration 0101 proves of its own text.
    CONSTRAINT replays_lifecycle_check
        CHECK (current_lifecycle IN ('DRAFT', 'PREVIEW_READY', 'FINALIZED')),
    CONSTRAINT replays_creator_fk
        FOREIGN KEY (created_by_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

CREATE INDEX replays_creator_idx ON public.replays (created_by_user_id, created_at);

COMMENT ON TABLE public.replays IS
  'The stable REPLAY identity: a MATERIAL_ARTIFACT of kind REPLAY_ARTIFACT '
  '(I-01A kernel), never a World. It carries the exact human creator, the '
  'current lifecycle and nothing else: no distribution, share, download, '
  'Premium, Safety or Launch state, no World type, membership or governance. '
  'Creation authority and distribution authority are different architecture '
  'concepts and live nowhere near each other.';

-- ---------------------------------------------------------------------------
-- 2. THE IMMUTABLE REPLAY SOURCE MANIFEST VERSION.
--
--    One exact authorized source context per manifest version - one Personal
--    Session, one Shared World, or one exact Public Experience Version - so
--    that "the complete authorized universe" has exactly one meaning and
--    FULL_SOURCE can be proven rather than asserted. A changed source set is a
--    NEW manifest version; nothing here is ever updated.
--
--    `authorized_universe_item_count` is the size of the authorized universe
--    the creator could have selected from at capture (every committed unit of
--    the Session; every history item the canonical I-04F resolver made visible;
--    every public item of the exact version). `universe_complete` is GENERATED
--    from it and the item count, and UNIQUE (id, universe_complete) exists only
--    so the selection spec can bind it by composite foreign key.
--
--    `creation_authority_basis` records which frozen authority the writer
--    exercised, pinned to its class by CHECK: Personal source ownership, exact
--    Shared history visibility, or exact Public Experience control. None of
--    them is distribution authority.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_source_manifest_versions (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    manifest_revision integer NOT NULL,
    source_class text NOT NULL,
    creation_authority_basis text NOT NULL,
    personal_session_id uuid,
    personal_owner_user_id uuid,
    personal_frontier_session_position integer,
    shared_world_id uuid,
    public_experience_id uuid,
    public_experience_version_id uuid,
    public_manifest_version_id uuid,
    item_count integer NOT NULL,
    authorized_universe_item_count integer NOT NULL,
    universe_complete boolean GENERATED ALWAYS AS (item_count = authorized_universe_item_count) STORED,
    captured_at timestamptz NOT NULL,
    CONSTRAINT replay_source_manifest_versions_pk PRIMARY KEY (id),
    CONSTRAINT replay_source_manifest_versions_replay_key UNIQUE (id, replay_id),
    CONSTRAINT replay_source_manifest_versions_revision_key UNIQUE (replay_id, manifest_revision),
    -- Context candidate keys: every item binds (manifest, context) as one row.
    CONSTRAINT replay_source_manifest_versions_personal_key UNIQUE (id, personal_session_id),
    CONSTRAINT replay_source_manifest_versions_shared_key UNIQUE (id, shared_world_id),
    CONSTRAINT replay_source_manifest_versions_public_key UNIQUE (id, public_manifest_version_id),
    -- The completeness candidate key the selection spec binds.
    CONSTRAINT replay_source_manifest_versions_complete_key UNIQUE (id, universe_complete),
    CONSTRAINT replay_source_manifest_versions_revision_check CHECK (manifest_revision >= 1),
    -- The three frozen source contexts. No Replay-of-Replay, no operational or
    -- Safety state, no hidden private provenance.
    CONSTRAINT replay_source_manifest_versions_class_check
        CHECK (source_class IN ('MY_WORLD', 'SHARED_WORLD', 'PUBLIC_EXPERIENCE')),
    CONSTRAINT replay_source_manifest_versions_basis_check CHECK (
        (source_class = 'MY_WORLD' AND creation_authority_basis = 'PERSONAL_SOURCE_OWNERSHIP')
     OR (source_class = 'SHARED_WORLD' AND creation_authority_basis = 'SHARED_HISTORY_VISIBILITY')
     OR (source_class = 'PUBLIC_EXPERIENCE' AND creation_authority_basis = 'PUBLIC_EXPERIENCE_CONTROL')),
    -- EXACTLY ONE CONTEXT SHAPE PER SOURCE CLASS.
    CONSTRAINT replay_source_manifest_versions_shape_check CHECK (
        (source_class = 'MY_WORLD'
            AND personal_session_id IS NOT NULL AND personal_owner_user_id IS NOT NULL
            AND personal_frontier_session_position IS NOT NULL
            AND shared_world_id IS NULL AND public_experience_id IS NULL
            AND public_experience_version_id IS NULL AND public_manifest_version_id IS NULL)
     OR (source_class = 'SHARED_WORLD'
            AND shared_world_id IS NOT NULL
            AND personal_session_id IS NULL AND personal_owner_user_id IS NULL
            AND personal_frontier_session_position IS NULL
            AND public_experience_id IS NULL AND public_experience_version_id IS NULL
            AND public_manifest_version_id IS NULL)
     OR (source_class = 'PUBLIC_EXPERIENCE'
            AND public_experience_id IS NOT NULL AND public_experience_version_id IS NOT NULL
            AND public_manifest_version_id IS NOT NULL
            AND personal_session_id IS NULL AND personal_owner_user_id IS NULL
            AND personal_frontier_session_position IS NULL AND shared_world_id IS NULL)),
    CONSTRAINT replay_source_manifest_versions_count_check
        CHECK (item_count >= 1 AND authorized_universe_item_count >= item_count),
    CONSTRAINT replay_source_manifest_versions_frontier_check
        CHECK (personal_frontier_session_position IS NULL OR personal_frontier_session_position >= 1),
    CONSTRAINT replay_source_manifest_versions_replay_fk
        FOREIGN KEY (replay_id) REFERENCES public.replays (id) ON DELETE RESTRICT,
    -- A Personal manifest binds the Session the CREATOR owns, structurally: the
    -- Session owner must be the Replay creator, through the identity row.
    CONSTRAINT replay_source_manifest_versions_personal_creator_fk
        FOREIGN KEY (replay_id, personal_owner_user_id)
        REFERENCES public.replays (id, created_by_user_id) ON DELETE RESTRICT,
    CONSTRAINT replay_source_manifest_versions_personal_session_fk
        FOREIGN KEY (personal_session_id, personal_owner_user_id)
        REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT replay_source_manifest_versions_shared_world_fk
        FOREIGN KEY (shared_world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    -- The exact Public Experience Version, its Experience and its manifest are
    -- ONE exact version row, through the additive 0095 candidate key.
    CONSTRAINT replay_source_manifest_versions_public_version_fk
        FOREIGN KEY (public_experience_version_id, public_experience_id, public_manifest_version_id)
        REFERENCES public.public_experience_versions (id, experience_id, package_manifest_version_id)
        ON DELETE RESTRICT
);

CREATE INDEX replay_source_manifest_versions_replay_idx
    ON public.replay_source_manifest_versions (replay_id, manifest_revision);

COMMENT ON TABLE public.replay_source_manifest_versions IS
  'One immutable REPLAY_SOURCE_MANIFEST_VERSION: exactly one authorized source '
  'context (a Personal Session the creator owns, one Shared World, or one exact '
  'Public Experience Version), the exact item count and the size of the '
  'authorized universe captured. A changed source set is a NEW version. It '
  'copies no content: a Replay is source-bound, and a later owner deletion '
  'stales it instead of being defeated by a shadow copy.';

-- ---------------------------------------------------------------------------
-- 3. THE EXACT ITEM SET OF ONE MANIFEST.
--
--    Normalized rows in canonical source order, never a JSON manifest blob.
--    `source_item_ordinal` is the canonical order inside the manifest and
--    `source_universe_rank` is the item's rank inside the captured authorized
--    universe - both derived by the writer, never supplied. Every item carries
--    a one-way digest of the exact source bytes and the original medium, and
--    nothing that could hold content.
--
--    The composite foreign keys onto (manifest, context) make "this item names
--    the exact Session / World / package of its own manifest" structural, and
--    the class-specific foreign keys bind the exact source rows that SURVIVE
--    owner deletion - never a body relation.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_source_manifest_items (
    manifest_version_id uuid NOT NULL,
    source_item_ordinal integer NOT NULL,
    source_universe_rank integer NOT NULL,
    source_class text NOT NULL,
    original_medium text NOT NULL,
    captured_source_digest text NOT NULL,
    personal_session_id uuid,
    personal_conversation_unit_id uuid,
    personal_session_position integer,
    personal_source_role text,
    shared_world_id uuid,
    shared_material_id uuid,
    shared_history_item_id uuid,
    shared_material_kind text,
    shared_occurred_at timestamptz,
    captured_availability_state text,
    captured_availability_revision bigint,
    public_manifest_version_id uuid,
    public_package_item_id uuid,
    public_item_ordinal integer,
    public_derivative_classification text,
    CONSTRAINT replay_source_manifest_items_pk PRIMARY KEY (manifest_version_id, source_item_ordinal),
    CONSTRAINT replay_source_manifest_items_rank_key UNIQUE (manifest_version_id, source_universe_rank),
    CONSTRAINT replay_source_manifest_items_ordinal_check CHECK (source_item_ordinal >= 1),
    CONSTRAINT replay_source_manifest_items_rank_check CHECK (source_universe_rank >= 1),
    CONSTRAINT replay_source_manifest_items_class_check
        CHECK (source_class IN ('MY_WORLD', 'SHARED_WORLD', 'PUBLIC_EXPERIENCE')),
    -- The original medium vocabulary is forward-safe for a reviewed mixed
    -- source; no I-06A writer produces MIXED, and no Personal writer can
    -- produce ORIGINAL_AUDIO because no durable Personal audio source exists.
    CONSTRAINT replay_source_manifest_items_medium_check
        CHECK (original_medium IN ('ORIGINAL_TEXT', 'ORIGINAL_AUDIO', 'MIXED')),
    CONSTRAINT replay_source_manifest_items_digest_check
        CHECK (captured_source_digest ~ '^sha256:[0-9a-f]{64}$'),
    -- The canonical availability vocabulary, in exact parity with the merged
    -- I-01A kernel and the frozen I-04F history states.
    CONSTRAINT replay_source_manifest_items_availability_check
        CHECK (captured_availability_state IS NULL
            OR captured_availability_state IN ('AVAILABLE', 'DELETED_BY_OWNER', 'UNAVAILABLE')),
    CONSTRAINT replay_source_manifest_items_revision_check
        CHECK (captured_availability_revision IS NULL OR captured_availability_revision > 0),
    CONSTRAINT replay_source_manifest_items_personal_role_check
        CHECK (personal_source_role IS NULL OR personal_source_role IN ('USER', 'ASSISTANT')),
    CONSTRAINT replay_source_manifest_items_personal_position_check
        CHECK (personal_session_position IS NULL OR personal_session_position >= 1),
    -- Only kinds with a real producer and a real body are bindable; the two
    -- RESERVED Shared kinds have neither and are unrepresentable here.
    CONSTRAINT replay_source_manifest_items_shared_kind_check
        CHECK (shared_material_kind IS NULL
            OR shared_material_kind IN ('HUMAN_TEXT', 'HUMAN_VOICE_NOTE', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS')),
    -- A Shared voice note IS original audio identity; text kinds are original
    -- text. No transcript is ever promoted to audio and no text to audio.
    CONSTRAINT replay_source_manifest_items_shared_medium_check
        CHECK (shared_material_kind IS NULL
            OR ((shared_material_kind = 'HUMAN_VOICE_NOTE') = (original_medium = 'ORIGINAL_AUDIO'))),
    CONSTRAINT replay_source_manifest_items_public_ordinal_check
        CHECK (public_item_ordinal IS NULL OR public_item_ordinal >= 1),
    CONSTRAINT replay_source_manifest_items_public_class_check
        CHECK (public_derivative_classification IS NULL
            OR public_derivative_classification IN ('SOURCE_CONTENT_BEARING_DERIVATIVE', 'ANALYTICAL_DERIVATIVE')),
    -- EXACTLY ONE SHAPE PER SOURCE CLASS. A source class can never carry an
    -- identifier belonging to another class.
    CONSTRAINT replay_source_manifest_items_shape_check CHECK (
        (source_class = 'MY_WORLD'
            AND personal_session_id IS NOT NULL AND personal_conversation_unit_id IS NOT NULL
            AND personal_session_position IS NOT NULL AND personal_source_role IS NOT NULL
            AND original_medium = 'ORIGINAL_TEXT'
            AND shared_world_id IS NULL AND shared_material_id IS NULL AND shared_history_item_id IS NULL
            AND shared_material_kind IS NULL AND shared_occurred_at IS NULL
            AND captured_availability_state IS NULL AND captured_availability_revision IS NULL
            AND public_manifest_version_id IS NULL AND public_package_item_id IS NULL
            AND public_item_ordinal IS NULL AND public_derivative_classification IS NULL)
     OR (source_class = 'SHARED_WORLD'
            AND shared_world_id IS NOT NULL AND shared_material_id IS NOT NULL
            AND shared_history_item_id IS NOT NULL AND shared_material_kind IS NOT NULL
            AND shared_occurred_at IS NOT NULL
            AND captured_availability_state IS NOT NULL AND captured_availability_revision IS NOT NULL
            AND personal_session_id IS NULL AND personal_conversation_unit_id IS NULL
            AND personal_session_position IS NULL AND personal_source_role IS NULL
            AND public_manifest_version_id IS NULL AND public_package_item_id IS NULL
            AND public_item_ordinal IS NULL AND public_derivative_classification IS NULL)
     OR (source_class = 'PUBLIC_EXPERIENCE'
            AND public_manifest_version_id IS NOT NULL AND public_package_item_id IS NOT NULL
            AND public_item_ordinal IS NOT NULL AND public_derivative_classification IS NOT NULL
            AND original_medium = 'ORIGINAL_TEXT'
            AND personal_session_id IS NULL AND personal_conversation_unit_id IS NULL
            AND personal_session_position IS NULL AND personal_source_role IS NULL
            AND shared_world_id IS NULL AND shared_material_id IS NULL AND shared_history_item_id IS NULL
            AND shared_material_kind IS NULL AND shared_occurred_at IS NULL
            AND captured_availability_state IS NULL AND captured_availability_revision IS NULL)),
    CONSTRAINT replay_source_manifest_items_manifest_fk
        FOREIGN KEY (manifest_version_id)
        REFERENCES public.replay_source_manifest_versions (id) ON DELETE RESTRICT,
    -- An item names the exact context of ITS OWN manifest, structurally.
    CONSTRAINT replay_source_manifest_items_personal_context_fk
        FOREIGN KEY (manifest_version_id, personal_session_id)
        REFERENCES public.replay_source_manifest_versions (id, personal_session_id) ON DELETE RESTRICT,
    CONSTRAINT replay_source_manifest_items_shared_context_fk
        FOREIGN KEY (manifest_version_id, shared_world_id)
        REFERENCES public.replay_source_manifest_versions (id, shared_world_id) ON DELETE RESTRICT,
    CONSTRAINT replay_source_manifest_items_public_context_fk
        FOREIGN KEY (manifest_version_id, public_manifest_version_id)
        REFERENCES public.replay_source_manifest_versions (id, public_manifest_version_id) ON DELETE RESTRICT,
    -- The exact source rows, and only rows that survive owner deletion.
    CONSTRAINT replay_source_manifest_items_personal_unit_fk
        FOREIGN KEY (personal_conversation_unit_id)
        REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
    -- The canonical Session Position of that unit, bound through the frozen
    -- 0065 candidate key: the temporal anchor is a real position, never a clock.
    CONSTRAINT replay_source_manifest_items_personal_position_fk
        FOREIGN KEY (personal_session_id, personal_session_position)
        REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
    CONSTRAINT replay_source_manifest_items_shared_material_fk
        FOREIGN KEY (shared_material_id, shared_world_id)
        REFERENCES public.shared_world_materials (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT replay_source_manifest_items_shared_history_fk
        FOREIGN KEY (shared_world_id, shared_history_item_id)
        REFERENCES public.shared_world_history_items (world_id, id) ON DELETE RESTRICT,
    -- The bounded public package item of the exact manifest - the public
    -- derivative itself, never the sealed provenance behind it.
    CONSTRAINT replay_source_manifest_items_public_item_fk
        FOREIGN KEY (public_manifest_version_id, public_package_item_id)
        REFERENCES public.publication_package_manifest_items (manifest_version_id, package_item_id)
        ON DELETE RESTRICT
);

-- One item per exact source identity per manifest, per class.
CREATE UNIQUE INDEX replay_source_manifest_items_personal_unit_idx
    ON public.replay_source_manifest_items (manifest_version_id, personal_conversation_unit_id)
    WHERE personal_conversation_unit_id IS NOT NULL;
CREATE UNIQUE INDEX replay_source_manifest_items_shared_material_idx
    ON public.replay_source_manifest_items (manifest_version_id, shared_material_id)
    WHERE shared_material_id IS NOT NULL;
CREATE UNIQUE INDEX replay_source_manifest_items_public_item_idx
    ON public.replay_source_manifest_items (manifest_version_id, public_package_item_id)
    WHERE public_package_item_id IS NOT NULL;
-- The access patterns source-loss enforcement (I-06D) needs: which manifests
-- name this exact source.
CREATE INDEX replay_source_manifest_items_personal_source_idx
    ON public.replay_source_manifest_items (personal_conversation_unit_id)
    WHERE personal_conversation_unit_id IS NOT NULL;
CREATE INDEX replay_source_manifest_items_shared_source_idx
    ON public.replay_source_manifest_items (shared_history_item_id)
    WHERE shared_history_item_id IS NOT NULL;
CREATE INDEX replay_source_manifest_items_public_source_idx
    ON public.replay_source_manifest_items (public_package_item_id)
    WHERE public_package_item_id IS NOT NULL;

COMMENT ON TABLE public.replay_source_manifest_items IS
  'The exact item set of one immutable Replay source manifest, in canonical '
  'source order: source class, exact object identity, exact version or '
  'availability revision, original medium, canonical temporal anchor and a '
  'one-way digest of the exact source bytes. It carries NO content: no body, '
  'text, transcript or audio reference, no foreign key to a body relation, and '
  'no reference to the sealed Public provenance. A binding here grants no '
  'access to the source it names.';

-- ---------------------------------------------------------------------------
-- 4. THE IMMUTABLE REPLAY SELECTION SPEC VERSION.
--
--    One resolved selection over one exact manifest version. The counts and the
--    contiguity flag are DERIVED by the writer from the manifest's canonical
--    order and the captured universe ranks; the coverage class is declared, and
--    FULL_SOURCE is representable ONLY when every manifest item is selected
--    whole (CHECK) AND the manifest captured the complete authorized universe
--    (the composite foreign key onto the generated `universe_complete`). No
--    caller can self-assert completeness however the row is produced.
--
--    `selection_method` is forward-safe for a reviewed bounded natural-language
--    resolver that operates over an authorized universe of opaque handles; no
--    I-06A writer produces it, and no provider free text is ever a source id.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_selection_spec_versions (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    source_manifest_version_id uuid NOT NULL,
    manifest_universe_complete boolean NOT NULL,
    selection_revision integer NOT NULL,
    selection_method text NOT NULL,
    coverage_class text NOT NULL,
    manifest_item_count integer NOT NULL,
    selected_item_count integer NOT NULL,
    whole_item_count integer NOT NULL,
    source_contiguous boolean NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT replay_selection_spec_versions_pk PRIMARY KEY (id),
    CONSTRAINT replay_selection_spec_versions_replay_key UNIQUE (id, replay_id),
    CONSTRAINT replay_selection_spec_versions_manifest_key UNIQUE (id, source_manifest_version_id),
    CONSTRAINT replay_selection_spec_versions_revision_key UNIQUE (replay_id, selection_revision),
    CONSTRAINT replay_selection_spec_versions_revision_check CHECK (selection_revision >= 1),
    CONSTRAINT replay_selection_spec_versions_method_check
        CHECK (selection_method IN ('EXPLICIT_RESOLVED_ANCHORS', 'NATURAL_LANGUAGE_RESOLVED')),
    CONSTRAINT replay_selection_spec_versions_coverage_check
        CHECK (coverage_class IN ('FULL_SOURCE', 'SELECTED_EXCERPT', 'HIGHLIGHT_SELECTION')),
    CONSTRAINT replay_selection_spec_versions_counts_check
        CHECK (selected_item_count >= 1 AND manifest_item_count >= selected_item_count
           AND whole_item_count >= 0 AND whole_item_count <= selected_item_count),
    -- FULL_SOURCE: every manifest item, every one of them whole, no gap, over a
    -- manifest that captured the complete authorized universe.
    CONSTRAINT replay_selection_spec_versions_full_source_check
        CHECK (coverage_class <> 'FULL_SOURCE'
            OR (manifest_universe_complete AND selected_item_count = manifest_item_count
                AND whole_item_count = selected_item_count AND source_contiguous)),
    CONSTRAINT replay_selection_spec_versions_manifest_fk
        FOREIGN KEY (source_manifest_version_id, replay_id)
        REFERENCES public.replay_source_manifest_versions (id, replay_id) ON DELETE RESTRICT,
    -- Completeness is read from the manifest row, structurally, never asserted.
    CONSTRAINT replay_selection_spec_versions_complete_fk
        FOREIGN KEY (source_manifest_version_id, manifest_universe_complete)
        REFERENCES public.replay_source_manifest_versions (id, universe_complete) ON DELETE RESTRICT
);

CREATE INDEX replay_selection_spec_versions_replay_idx
    ON public.replay_selection_spec_versions (replay_id, selection_revision);

COMMENT ON TABLE public.replay_selection_spec_versions IS
  'One immutable REPLAY_SELECTION_SPEC_VERSION over one exact source manifest '
  'version: a declared coverage class, derived counts and the derived machine '
  'truth of whether the selection is contiguous in the source. FULL_SOURCE is '
  'representable only when every item is selected whole over a manifest that '
  'captured the complete authorized universe. No column claims a cut is '
  'render-safe: Semantic Cut Safety belongs to I-06B.';

-- ---------------------------------------------------------------------------
-- 5. THE SELECTED ITEMS OF ONE SELECTION SPEC.
--
--    Each row names one manifest item by its stable identity and carries the
--    exact source-native anchor: the whole item, or a half-open code-point range
--    inside a text item. `selected_ordinal` is the DERIVED chronological rank,
--    and the trigger below makes an order that disagrees with the manifest's
--    canonical order unrepresentable. Nothing here says the cut is safe.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_selection_spec_items (
    selection_spec_version_id uuid NOT NULL,
    source_manifest_version_id uuid NOT NULL,
    source_item_ordinal integer NOT NULL,
    selected_ordinal integer NOT NULL,
    anchor_kind text NOT NULL,
    range_start integer,
    range_end integer,
    CONSTRAINT replay_selection_spec_items_pk PRIMARY KEY (selection_spec_version_id, selected_ordinal),
    CONSTRAINT replay_selection_spec_items_source_key UNIQUE (selection_spec_version_id, source_item_ordinal),
    CONSTRAINT replay_selection_spec_items_selected_check CHECK (selected_ordinal >= 1),
    CONSTRAINT replay_selection_spec_items_anchor_check
        CHECK (anchor_kind IN ('WHOLE_ITEM', 'TEXT_CODE_POINT_RANGE')),
    CONSTRAINT replay_selection_spec_items_range_check CHECK (
        (anchor_kind = 'WHOLE_ITEM' AND range_start IS NULL AND range_end IS NULL)
     OR (anchor_kind = 'TEXT_CODE_POINT_RANGE' AND range_start IS NOT NULL AND range_end IS NOT NULL
         AND range_start >= 0 AND range_end > range_start)),
    CONSTRAINT replay_selection_spec_items_spec_fk
        FOREIGN KEY (selection_spec_version_id, source_manifest_version_id)
        REFERENCES public.replay_selection_spec_versions (id, source_manifest_version_id) ON DELETE RESTRICT,
    CONSTRAINT replay_selection_spec_items_manifest_item_fk
        FOREIGN KEY (source_manifest_version_id, source_item_ordinal)
        REFERENCES public.replay_source_manifest_items (manifest_version_id, source_item_ordinal)
        ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 6. THE ONE MUTABLE DRAFT COMPOSITION POINTER.
--
--    One row per Replay: the current manifest version, the current selection
--    spec version and the draft revision. It moves only through a controlled
--    transaction (0101) and only forward; every old component version remains
--    immutable historical truth. The selection is bound TO the manifest it was
--    resolved over as one exact pair, so the pointer can never name a selection
--    over one manifest beside a different manifest.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_draft_state (
    replay_id uuid NOT NULL,
    current_source_manifest_version_id uuid NOT NULL,
    current_selection_spec_version_id uuid NOT NULL,
    draft_revision bigint NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT replay_draft_state_pk PRIMARY KEY (replay_id),
    CONSTRAINT replay_draft_state_revision_check CHECK (draft_revision >= 1),
    CONSTRAINT replay_draft_state_replay_fk
        FOREIGN KEY (replay_id) REFERENCES public.replays (id) ON DELETE RESTRICT,
    CONSTRAINT replay_draft_state_manifest_fk
        FOREIGN KEY (current_source_manifest_version_id, replay_id)
        REFERENCES public.replay_source_manifest_versions (id, replay_id) ON DELETE RESTRICT,
    CONSTRAINT replay_draft_state_selection_fk
        FOREIGN KEY (current_selection_spec_version_id, current_source_manifest_version_id)
        REFERENCES public.replay_selection_spec_versions (id, source_manifest_version_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.replay_draft_state IS
  'The ONE mutable Replay draft composition: the current source manifest '
  'version, the current selection spec version and the draft revision. It '
  'moves forward only, through a controlled transaction, and never rewrites '
  'the immutable component versions it points at. It is not a REPLAY_VERSION: '
  'the first complete one binds the analytical projection and the render '
  'contract too, and belongs to I-06B.';

-- ---------------------------------------------------------------------------
-- 7. IMMUTABILITY AND TRUTH TRIGGERS.
--
--    BEFORE triggers rather than privileges alone, for the reason migrations
--    0064 and 0091 established: privileges do not bind the table owner and a
--    future accidental GRANT would otherwise reopen mutation.
--
--    None of these is a forward ceiling: a later slice appends new component
--    versions, moves the pointer forward and transitions the lifecycle; none of
--    those is refused here.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_replay_component_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'REPLAY_COMPONENT_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A Replay source manifest version, its items, a selection spec version and its items are append-only: UPDATE and DELETE are refused for every role, including the table owner. A changed source set or selection is a NEW version.';
END$$;

ALTER FUNCTION public.reject_replay_component_mutation_v1() OWNER TO postgres;

CREATE TRIGGER replay_source_manifest_versions_immutable
    BEFORE UPDATE OR DELETE ON public.replay_source_manifest_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_component_mutation_v1();
CREATE TRIGGER replay_source_manifest_items_immutable
    BEFORE UPDATE OR DELETE ON public.replay_source_manifest_items
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_component_mutation_v1();
CREATE TRIGGER replay_selection_spec_versions_immutable
    BEFORE UPDATE OR DELETE ON public.replay_selection_spec_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_component_mutation_v1();
CREATE TRIGGER replay_selection_spec_items_immutable
    BEFORE UPDATE OR DELETE ON public.replay_selection_spec_items
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_component_mutation_v1();

-- The Replay identity can never be re-bound: id, creator and birth instant are
-- frozen at birth. The lifecycle is deliberately NOT frozen here - I-06B owns
-- its later transitions - and DELETE is deliberately not decided here either.
CREATE FUNCTION public.replay_identity_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.created_by_user_id <> OLD.created_by_user_id
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'REPLAY_IDENTITY_IS_IMMUTABLE' USING ERRCODE='55000',
      DETAIL='A Replay identity, its exact human creator and its birth instant can never be re-bound.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.replay_identity_truth_v1() OWNER TO postgres;

CREATE TRIGGER replays_identity_truth
    BEFORE UPDATE ON public.replays
    FOR EACH ROW EXECUTE FUNCTION public.replay_identity_truth_v1();

-- The draft pointer moves forward only, one revision at a time, and never
-- changes which Replay it belongs to.
CREATE FUNCTION public.replay_draft_state_forward_only_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.replay_id <> OLD.replay_id THEN
    RAISE EXCEPTION 'REPLAY_DRAFT_STATE_IS_BOUND' USING ERRCODE='55000';
  END IF;
  IF NEW.draft_revision <> OLD.draft_revision + 1 THEN
    RAISE EXCEPTION 'REPLAY_DRAFT_REVISION_MUST_ADVANCE' USING ERRCODE='55000',
      DETAIL='The Replay draft composition moves forward exactly one revision per controlled transaction.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.replay_draft_state_forward_only_v1() OWNER TO postgres;

CREATE TRIGGER replay_draft_state_forward_only
    BEFORE UPDATE ON public.replay_draft_state
    FOR EACH ROW EXECUTE FUNCTION public.replay_draft_state_forward_only_v1();

-- CHRONOLOGY IS UNREPRESENTABLE TO REVERSE. The selected order of two items
-- must agree with the manifest's canonical source order; a row that would
-- place a later source item before an earlier one is refused however it is
-- produced. A gap between selected items is legal and is recorded as machine
-- truth by the writer; a reversal is not a gap.
CREATE FUNCTION public.replay_selection_chronology_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.replay_selection_spec_items i
     WHERE i.selection_spec_version_id = NEW.selection_spec_version_id
       AND sign(i.selected_ordinal - NEW.selected_ordinal)
           <> sign(i.source_item_ordinal - NEW.source_item_ordinal)
  ) THEN
    RAISE EXCEPTION 'REPLAY_SELECTION_CHRONOLOGY_REVERSED' USING ERRCODE='P0001',
      DETAIL='Selected Replay segments keep canonical source chronology: a selection may omit real moments but may never reorder them into a false story.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.replay_selection_chronology_v1() OWNER TO postgres;

CREATE TRIGGER replay_selection_spec_items_chronology
    BEFORE INSERT ON public.replay_selection_spec_items
    FOR EACH ROW EXECUTE FUNCTION public.replay_selection_chronology_v1();

-- ---------------------------------------------------------------------------
-- 8. DENY-BY-DEFAULT POSTURE.
-- ---------------------------------------------------------------------------
ALTER TABLE public.replays OWNER TO postgres;
ALTER TABLE public.replay_source_manifest_versions OWNER TO postgres;
ALTER TABLE public.replay_source_manifest_items OWNER TO postgres;
ALTER TABLE public.replay_selection_spec_versions OWNER TO postgres;
ALTER TABLE public.replay_selection_spec_items OWNER TO postgres;
ALTER TABLE public.replay_draft_state OWNER TO postgres;

ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_source_manifest_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_source_manifest_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_selection_spec_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_selection_spec_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_draft_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.replays,
                    public.replay_source_manifest_versions,
                    public.replay_source_manifest_items,
                    public.replay_selection_spec_versions,
                    public.replay_selection_spec_items,
                    public.replay_draft_state
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.replays, public.replay_source_manifest_versions, public.replay_source_manifest_items, public.replay_selection_spec_versions, public.replay_selection_spec_items, public.replay_draft_state FROM service_role';
END IF;END$$;

-- The trigger functions are internal and are invoked directly by nobody.
REVOKE ALL ON FUNCTION public.reject_replay_component_mutation_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replay_identity_truth_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replay_draft_state_forward_only_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replay_selection_chronology_v1() FROM PUBLIC;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_replay_component_mutation_v1(), public.replay_identity_truth_v1(), public.replay_draft_state_forward_only_v1(), public.replay_selection_chronology_v1() FROM anon, authenticated, service_role';
ELSE
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_replay_component_mutation_v1(), public.replay_identity_truth_v1(), public.replay_draft_state_forward_only_v1(), public.replay_selection_chronology_v1() FROM anon, authenticated';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 9. SELF-ASSERTIONS.
--
--    What must already be true of THIS migration for it to be allowed to
--    deploy. Each is a fact about the objects 0100 owns or the frozen truths it
--    binds - never a census of the database, and never a ceiling on migration
--    0101 or on the later I-06B / I-06C / I-06D slices: no assertion here names
--    a REPLAY_VERSION, a projection, a render contract, a distribution package
--    or a Launch wrapper as forbidden.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_tables text[] := ARRAY['replays', 'replay_source_manifest_versions', 'replay_source_manifest_items',
                             'replay_selection_spec_versions', 'replay_selection_spec_items',
                             'replay_draft_state'];
  component_tables text[] := ARRAY['replay_source_manifest_versions', 'replay_source_manifest_items',
                                   'replay_selection_spec_versions', 'replay_selection_spec_items'];
  t text;
  banned text;
  n integer;
BEGIN
  -- A REPLAY IS NOT A WORLD. No relation this migration owns may carry a World
  -- type, a World lifecycle, a phase, a birth basis, membership, governance or a
  -- semantic coordinate.
  FOREACH t IN ARRAY own_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(world_type|phase|birth_basis|member|episode|governance|proposal|approv|semantic|coordinate|embedding|placement|vitality|ranking)'
    ) THEN
      RAISE EXCEPTION 'I-06A: a Replay is a source-bound artifact, never a World: relation % may carry no World, membership, governance or semantic column', t;
    END IF;
    -- CREATION AUTHORITY IS NOT DISTRIBUTION AUTHORITY. No distribution, export,
    -- share, download, Premium, Safety, moderation, entitlement or Launch column.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(public_flag|is_public|is_shared|shareable|share_flag|share_link|sharing|download|distribut|export|premium|safety|moderation|entitle|launch|clearance|feature_flag|allow|approver)'
    ) THEN
      RAISE EXCEPTION 'I-06A: creation authority is not distribution authority: relation % may carry no distribution Safety or Launch column', t;
    END IF;
    -- A REPLAY MANIFEST IS A BINDING, NEVER A COPY. No content column of any
    -- kind, no JSON blob, no binary payload.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       JOIN pg_type ty ON ty.oid = a.atttypid
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND (a.attname ~ '(body|_text$|^text|transcript|audio_object|content|payload|blob|document|excerpt|snippet|caption|render|projection)'
              OR ty.typname IN ('json', 'jsonb', 'bytea'))
    ) THEN
      RAISE EXCEPTION 'I-06A: a Replay source manifest identifies source truth and copies none of it: relation % may carry no content column', t;
    END IF;
    -- No sealed Public provenance, no Shared body relation and no Personal turn
    -- is ever a Replay parent: the source rows bound are exactly the ones that
    -- survive owner deletion, and provenance is not a source-access route.
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid IN ('public.publication_package_item_provenance'::regclass,
                             'public.shared_world_text_material_bodies'::regclass,
                             'public.shared_world_voice_note_material_bodies'::regclass,
                             'public.public_experience_text_derivative_bodies'::regclass,
                             'public.conversation_turns'::regclass)
    ) THEN
      RAISE EXCEPTION 'I-06A: relation % must bind no body relation, no sealed provenance and no raw turn', t;
    END IF;
    -- Every foreign key this migration installs is restrictive.
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f' AND c.confdeltype <> 'r'
    ) THEN
      RAISE EXCEPTION 'I-06A: every Replay foreign key is restrictive: relation % must never cascade source or Replay truth away', t;
    END IF;
    -- Every identifier fits the 63-byte limit, so nothing is silently truncated.
    IF length(t) > 63 OR EXISTS (SELECT 1 FROM pg_constraint c
                                  WHERE c.conrelid = ('public.' || t)::regclass AND length(c.conname) > 63)
       OR EXISTS (SELECT 1 FROM pg_class idx JOIN pg_index ix ON ix.indexrelid = idx.oid
                   WHERE ix.indrelid = ('public.' || t)::regclass AND length(idx.relname) > 63) THEN
      RAISE EXCEPTION 'I-06A: an identifier on % exceeds the PostgreSQL 63-byte limit', t;
    END IF;
  END LOOP;

  -- THE SOURCE CLASSES ARE STRUCTURALLY SEPARATE, on the manifest and on its
  -- items, and the exact source bindings exist.
  FOR banned IN SELECT unnest(ARRAY['replay_source_manifest_versions_shape_check',
                                    'replay_source_manifest_versions_basis_check',
                                    'replay_source_manifest_versions_class_check',
                                    'replay_source_manifest_versions_personal_creator_fk',
                                    'replay_source_manifest_versions_personal_session_fk',
                                    'replay_source_manifest_versions_shared_world_fk',
                                    'replay_source_manifest_versions_public_version_fk',
                                    'replay_source_manifest_versions_complete_key']) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                    WHERE c.conrelid = 'public.replay_source_manifest_versions'::regclass AND c.conname = banned) THEN
      RAISE EXCEPTION 'I-06A: the manifest must carry %', banned;
    END IF;
  END LOOP;
  FOR banned IN SELECT unnest(ARRAY['replay_source_manifest_items_shape_check',
                                    'replay_source_manifest_items_shared_kind_check',
                                    'replay_source_manifest_items_shared_medium_check',
                                    'replay_source_manifest_items_digest_check',
                                    'replay_source_manifest_items_personal_context_fk',
                                    'replay_source_manifest_items_shared_context_fk',
                                    'replay_source_manifest_items_public_context_fk',
                                    'replay_source_manifest_items_personal_unit_fk',
                                    'replay_source_manifest_items_personal_position_fk',
                                    'replay_source_manifest_items_shared_material_fk',
                                    'replay_source_manifest_items_shared_history_fk',
                                    'replay_source_manifest_items_public_item_fk']) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                    WHERE c.conrelid = 'public.replay_source_manifest_items'::regclass AND c.conname = banned) THEN
      RAISE EXCEPTION 'I-06A: the manifest items must carry %', banned;
    END IF;
  END LOOP;
  -- The Public binding is ONE exact version row through the additive 0095
  -- candidate key, never independent partial keys.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_source_manifest_versions'::regclass
       AND c.conname = 'replay_source_manifest_versions_public_version_fk'
       AND c.confrelid = 'public.public_experience_versions'::regclass
       AND cardinality(c.confkey) = 3
  ) THEN
    RAISE EXCEPTION 'I-06A: a Public source manifest must bind version, Experience and manifest as ONE exact row';
  END IF;
  -- The Personal manifest binds the Session owner to the Replay creator.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_source_manifest_versions'::regclass
       AND c.conname = 'replay_source_manifest_versions_personal_creator_fk'
       AND c.confrelid = 'public.replays'::regclass AND cardinality(c.confkey) = 2
  ) THEN
    RAISE EXCEPTION 'I-06A: a Personal source manifest must bind its Session owner to the exact Replay creator';
  END IF;

  -- FULL_SOURCE IS PROVEN, NEVER ASSERTED: the CHECK and the completeness key.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_selection_spec_versions'::regclass
       AND c.conname = 'replay_selection_spec_versions_full_source_check'
       AND pg_get_constraintdef(c.oid) ~ 'manifest_universe_complete'
       AND pg_get_constraintdef(c.oid) ~ 'selected_item_count = manifest_item_count'
       AND pg_get_constraintdef(c.oid) ~ 'whole_item_count = selected_item_count'
       AND pg_get_constraintdef(c.oid) ~ 'source_contiguous'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_selection_spec_versions'::regclass
       AND c.conname = 'replay_selection_spec_versions_complete_fk'
       AND c.confrelid = 'public.replay_source_manifest_versions'::regclass
  ) THEN
    RAISE EXCEPTION 'I-06A: FULL_SOURCE must be representable only over a complete manifest selected whole, contiguously and completely';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute a
     WHERE a.attrelid = 'public.replay_source_manifest_versions'::regclass
       AND a.attname = 'universe_complete' AND a.attgenerated = 's'
  ) THEN
    RAISE EXCEPTION 'I-06A: manifest completeness must be GENERATED from the captured counts, never written';
  END IF;

  -- COVERAGE, MEDIUM, METHOD AND LIFECYCLE VOCABULARIES ARE EXACT.
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_selection_spec_versions'::regclass
         AND c.conname = 'replay_selection_spec_versions_coverage_check')
     !~ 'FULL_SOURCE' THEN
    RAISE EXCEPTION 'I-06A: every selection spec must declare a coverage class';
  END IF;
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replays'::regclass AND c.conname = 'replays_lifecycle_check')
     !~ 'DRAFT' THEN
    RAISE EXCEPTION 'I-06A: the Replay lifecycle vocabulary must admit DRAFT';
  END IF;

  -- THE COMPONENT RELATIONS ARE APPEND-ONLY FOR EVERY ROLE, the identity cannot
  -- be re-bound, the pointer moves forward only, and chronology is guarded.
  FOREACH t IN ARRAY component_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
       WHERE tg.tgrelid = ('public.' || t)::regclass AND NOT tg.tgisinternal
         AND tg.tgfoid = 'public.reject_replay_component_mutation_v1'::regproc
    ) THEN
      RAISE EXCEPTION 'I-06A: relation % must be append-only for every role', t;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replays'::regclass
                  AND tg.tgname = 'replays_identity_truth' AND NOT tg.tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_draft_state'::regclass
                     AND tg.tgname = 'replay_draft_state_forward_only' AND NOT tg.tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_selection_spec_items'::regclass
                     AND tg.tgname = 'replay_selection_spec_items_chronology' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-06A: the identity truth, forward-only pointer and chronology triggers must be installed';
  END IF;

  -- PART A CREATES NO WRITER. Every function this migration owns returns
  -- `trigger` and is callable as nothing else; the writers are migration 0101,
  -- which proves of its own text what it creates.
  FOREACH banned IN ARRAY ARRAY['reject_replay_component_mutation_v1', 'replay_identity_truth_v1',
                                'replay_draft_state_forward_only_v1', 'replay_selection_chronology_v1'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
       WHERE ns.nspname = 'public' AND p.proname = banned AND p.prorettype = 'trigger'::regtype
    ) THEN
      RAISE EXCEPTION 'I-06A: % must be a trigger function and nothing else', banned;
    END IF;
  END LOOP;

  -- DENY BY DEFAULT ON EVERY RELATION THIS MIGRATION CREATED, AND NO ROW WRITTEN.
  FOREACH t IN ARRAY own_tables LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-06A: relation % must have row level security enabled', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-06A: relation % must carry zero policies', t;
    END IF;
    IF (SELECT c.relowner FROM pg_class c WHERE c.oid = ('public.' || t)::regclass)
       <> (SELECT r.oid FROM pg_roles r WHERE r.rolname = 'postgres') THEN
      RAISE EXCEPTION 'I-06A: relation % must be postgres-owned', t;
    END IF;
    FOREACH banned IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN banned <> 'public'
                AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = banned);
      IF has_table_privilege(banned, ('public.' || t)::regclass, 'SELECT')
         OR has_table_privilege(banned, ('public.' || t)::regclass, 'INSERT')
         OR has_table_privilege(banned, ('public.' || t)::regclass, 'UPDATE')
         OR has_table_privilege(banned, ('public.' || t)::regclass, 'DELETE') THEN
        RAISE EXCEPTION 'I-06A: relation % must hold no privilege for %', t, banned;
      END IF;
    END LOOP;
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n <> 0 THEN
      RAISE EXCEPTION 'I-06A: PART A is persistence and writes no row: % holds %', t, n;
    END IF;
  END LOOP;

  -- THE FROZEN SOURCE TRUTHS THIS MIGRATION BINDS MUST STILL BE INTACT.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.conversation_units'::regclass
                  AND tg.tgname = 'conversation_units_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-06A: the frozen committed Personal source must still be append-only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = 'public.conversation_units'::regclass
                  AND c.conname = 'conversation_units_session_sp_unique') THEN
    RAISE EXCEPTION 'I-06A: the frozen 0065 Session Position key must still exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.shared_world_history_items'::regclass
                  AND tg.tgname = 'shared_world_history_item_immutable_truth' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-06A: the frozen I-04F availability truth must still be guarded';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = 'public.public_experience_versions'::regclass
                  AND c.conname = 'public_experience_versions_exact_identity_key') THEN
    RAISE EXCEPTION 'I-06A: the frozen 0095 exact version identity key must still exist';
  END IF;
END$$;

COMMIT;
