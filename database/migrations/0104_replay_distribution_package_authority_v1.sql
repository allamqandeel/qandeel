-- I-06C - Replay Distribution Package, Distribution Authority and the Public
-- REPLAY_ARTIFACT bridge (PART A).
--
-- Migrations 0100-0103 built the Replay: the stable identity, the immutable
-- source manifest and selection-spec versions, the analytical projection and
-- render contract, the first complete REPLAY_VERSION and the append-only
-- finalization evidence. None of them widens an audience, and none of them can
-- write a distribution row. This migration creates the persistence that a
-- distribution act needs and NOTHING that can write it: every writer is
-- migration 0105.
--
-- ===========================================================================
-- What a REPLAY_DISTRIBUTION_PACKAGE_VERSION is, and what it is NOT
-- ===========================================================================
--
-- It is the immutable identity of ONE protected distribution request: one exact
-- historically FINALIZED Replay Version, one exact destination action, the
-- exact derived authority requirement of the material that version carries, and
-- the exact sanitized descriptor identity an audience may ever see.
--
-- It is NOT a Replay Version, a render version, a mutable export job, a Public
-- Experience, a file, a URL, a storage object, a download receipt or a World.
-- It holds no source body, no source path, no transcript, no audio handle and
-- no sealed provenance: the payload stays exactly where I-06A bound it, and a
-- distribution package that carried a shadow copy could outlive the deletion it
-- is supposed to respect.
--
-- ===========================================================================
-- Historical finalization is bound, never inferred
-- ===========================================================================
--
-- I-06B deliberately allows a FINALIZED Replay to be reopened to DRAFT while the
-- exact version it left behind stays historically finalized - the evidence row
-- is append-only and keyed by that exact version. So a package NEVER reads
-- `replays.current_lifecycle`. It binds
--
--   (replay_version_id, replay_id) -> replay_version_finalizations
--
-- through the additive candidate key below, so "this exact version of this exact
-- Replay was historically finalized" is ONE row and an unfinalized version is
-- unrepresentable rather than merely refused. A previously finalized version
-- therefore remains a candidate for distribution while the stable Replay is
-- being revised - subject to every distribution-time gate in 0105.
--
-- ===========================================================================
-- Destination is part of package identity
-- ===========================================================================
--
--   PUBLISH_TO_PUBLIC_WORLD    SHARE_EXTERNALLY    DOWNLOAD
--
-- Three separate protected actions, and authority for one never implies
-- another. The destination is a column of an APPEND-ONLY row, so it can never be
-- mutated; `(id, destination_action)` is a candidate key so an approval binds
-- the package AND its destination as ONE row, and an approval collected for
-- Public can never resolve against an external-share package. Changing the
-- destination, the Replay Version, the required set or the sanitized descriptor
-- means a NEW package version - there is no other representable outcome.
--
-- ===========================================================================
-- Unresolved authority is UNREPRESENTABLE inside a package
-- ===========================================================================
--
-- I-04G records three source-authority resolution states and I-05A admits only
-- the two RESOLVED ones inside a publication package, so "we cannot compute the
-- requirement" can never be stored as "we computed it and it is empty". This
-- slice keeps that law exactly, and applies it to BOTH halves of a Replay's
-- authority requirement:
--
--   source_authority_resolution       the human material authority of the exact
--                                     included source manifest items
--   analytical_authority_resolution   the human authority requirement of the
--                                     represented QANDEEL analytical projection
--
-- Each admits only RESOLVED_EXACT_HUMAN_REQUIREMENT and
-- RESOLVED_NO_HUMAN_REQUIREMENT. UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT is not
-- a value either column may hold, so a package whose analytical authority the
-- repository cannot derive cannot exist at all. Migration 0105 consults the ONE
-- analytical-authority seam and fails preparation closed; this migration makes
-- the weaker outcome unrepresentable however the row is produced.
--
-- The representation stays additive: a later reviewed protected-human
-- subject-authority resolver moves the seam forward, and the same package shape
-- becomes reachable with no change here.
--
-- ===========================================================================
-- EXPORT_PRIVACY_SANITIZATION is a positive allowlist relation
-- ===========================================================================
--
-- `replay_distribution_export_descriptors` is the WHOLE audience-visible surface
-- of a distributed Replay, as normalized typed columns - never a JSON blob and
-- never free text a client authored. Every column is either an opaque
-- audience-safe reference, a safe derived count or an exact versioned policy
-- value that the render contract already pinned. There is no private World,
-- Session, account, participant, source, unit, material, history item, package
-- item, provenance, path, URL, filename, storage handle, audio reference or
-- transcript column, and the migration refuses to deploy if one appears.
--
-- ===========================================================================
-- The Public REPLAY_ARTIFACT bridge
-- ===========================================================================
--
-- I-05A reserved `source_class = 'REPLAY_ARTIFACT'` on the sealed publication
-- provenance and `public_body_form = 'RESERVED'` on the public package item,
-- because no Replay runtime existed. I-06C is the first slice allowed to
-- activate that seam, and activates it NARROWLY: one exact Public package item
-- <-> one exact Replay Distribution Package Version <-> one exact Replay
-- Version, through composite foreign keys onto candidate keys that make every
-- half of that chain ONE row. There is no generic `artifact_id`. The Public
-- package item carries no Replay or source identifier of any kind - the bridge
-- relation carries the binding, it is sealed like every other relation here, and
-- the only thing a Public viewer ever receives is the sanitized descriptor.
--
-- ===========================================================================
-- Security posture
-- ===========================================================================
--
-- Every relation is postgres-owned, RLS-enabled with zero policies, and revoked
-- from PUBLIC, anon, authenticated and service_role. Every relation is
-- append-only for every role INCLUDING the table owner, by BEFORE trigger (the
-- 0064 / 0091 / 0100 rule: privileges do not bind the owner). This migration
-- creates no function that is not a trigger function, grants nothing, and writes
-- no row.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- No writer of any kind; no publish, share, download, delivery or export
-- execution; no encoder, codec, container, bitrate, resolution, frame rate,
-- CDN, object store, public file URL, watermark or DRM; no Safety, moderation,
-- entitlement, feature-flag or Launch Gate runtime; no second Public World and
-- no second Public visibility truth; no mutation of any predecessor ROW. It
-- adds exactly four additive candidate keys to frozen relations - each trivially
-- unique because each contains that relation's primary key - so that a binding
-- below can name ONE exact row instead of reaching a parent through independent
-- partial keys. Migrations 0001-0103 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ADDITIVE CANDIDATE KEYS ON FROZEN RELATIONS.
--
--    Each exists so that ONE composite foreign key below can bind an exact row.
--    None adds a column, changes a constraint, drops anything or touches data,
--    and each is trivially unique because it contains a primary key. This is the
--    frozen 0094 / 0095 / 0102 precedent.
-- ---------------------------------------------------------------------------

-- "This exact Replay Version of this exact Replay was historically FINALIZED",
-- as ONE row, so a package never infers finalization from a current lifecycle.
ALTER TABLE public.replay_version_finalizations
  ADD CONSTRAINT replay_version_finalizations_exact_key UNIQUE (replay_version_id, replay_id);

-- A package binds the exact version AND the exact source manifest that version
-- itself binds, so the source class it declares cannot belong to another
-- composition.
ALTER TABLE public.replay_versions
  ADD CONSTRAINT replay_versions_composition_key UNIQUE (id, replay_id, source_manifest_version_id);

-- The Public package item, its manifest and its public body FORM as ONE row, so
-- the bridge can prove the activated item is the RESERVED-form item of the exact
-- manifest through a single key rather than two independent partial ones.
ALTER TABLE public.publication_package_manifest_items
  ADD CONSTRAINT publication_package_manifest_items_exact_key
  UNIQUE (manifest_version_id, package_item_id, public_body_form);

-- And the sealed provenance row of that exact item, with its source class, as
-- ONE row: this is what makes "the reserved REPLAY_ARTIFACT seam was activated
-- for this exact item" structural rather than procedural.
ALTER TABLE public.publication_package_item_provenance
  ADD CONSTRAINT publication_package_item_provenance_class_key UNIQUE (package_item_id, source_class);

-- ---------------------------------------------------------------------------
-- 2. THE IMMUTABLE REPLAY DISTRIBUTION PACKAGE VERSION.
--
--    One exact protected distribution request. Everything about it is derived by
--    migration 0105 from canonical truth and frozen here: a caller supplies
--    opaque identities and a destination, and never an approver, an authority
--    state, a fingerprint, a descriptor or a reference.
--
--    `source_class` is CHECK-pinned to MY_WORLD and READ FROM the manifest by
--    composite foreign key. That is the repository census made structural rather
--    than a preference: a complete REPLAY_VERSION requires an
--    ANALYTICAL_PROJECTION_VERSION (0102, NOT NULL), whose capability is
--    CHECK-pinned to PERSONAL_SESSION_HISTORICAL_PROJECTION over a MY_WORLD
--    manifest, so no SHARED_WORLD or PUBLIC_EXPERIENCE Replay can reach
--    FINALIZED at this baseline and a distribution package over one is
--    unrepresentable. A later reviewed Shared or Public analytical capability
--    relaxes this in its own migration; nothing here is edited to allow it.
--
--    `audience_safe_reference` is the ONLY identity an audience ever receives.
--    It is opaque TEXT in its own shape, structurally distinct from every
--    internal uuid identity, minted at random by the writer and bound to nothing
--    - the mapping stays inside this sealed relation. The trigger in section 9
--    refuses a reference that reproduces any internal identity of its own row.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_distribution_package_versions (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    replay_version_id uuid NOT NULL,
    source_manifest_version_id uuid NOT NULL,
    source_class text NOT NULL,
    destination_action text NOT NULL,
    package_revision integer NOT NULL,
    authority_requirement_state text NOT NULL,
    source_authority_resolution text NOT NULL,
    analytical_authority_resolution text NOT NULL,
    required_approver_count integer NOT NULL,
    authority_request_fingerprint text NOT NULL,
    sanitization_contract_id text NOT NULL,
    audience_safe_reference text NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT replay_distribution_package_versions_pk PRIMARY KEY (id),
    -- The candidate keys each downstream binding needs, all trivially unique.
    CONSTRAINT replay_distribution_package_versions_destination_key
        UNIQUE (id, destination_action),
    CONSTRAINT replay_distribution_package_versions_authorization_key
        UNIQUE (id, destination_action, replay_id, replay_version_id),
    CONSTRAINT replay_distribution_package_versions_artifact_key
        UNIQUE (id, destination_action, replay_version_id, audience_safe_reference),
    CONSTRAINT replay_distribution_package_versions_descriptor_key
        UNIQUE (id, destination_action, audience_safe_reference),
    CONSTRAINT replay_distribution_package_versions_reference_key UNIQUE (audience_safe_reference),
    CONSTRAINT replay_distribution_package_versions_revision_key UNIQUE (replay_id, package_revision),
    CONSTRAINT replay_distribution_package_versions_revision_check CHECK (package_revision >= 1),
    -- THE THREE FROZEN DESTINATION ACTIONS, and nothing else. Preparing a
    -- package is a command in its own durable namespace in 0105 and is
    -- deliberately NOT a value this column may hold: preparation expands no
    -- audience, and consent to one action may never be replayed for another.
    CONSTRAINT replay_distribution_package_versions_destination_check
        CHECK (destination_action IN ('PUBLISH_TO_PUBLIC_WORLD', 'SHARE_EXTERNALLY', 'DOWNLOAD')),
    CONSTRAINT replay_distribution_package_versions_class_check CHECK (source_class = 'MY_WORLD'),
    -- UNRESOLVED IS UNREPRESENTABLE, on both halves and on the union.
    CONSTRAINT replay_distribution_package_versions_state_check
        CHECK (authority_requirement_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT',
                                               'RESOLVED_NO_HUMAN_REQUIREMENT')),
    CONSTRAINT replay_distribution_package_versions_source_authority_check
        CHECK (source_authority_resolution IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT',
                                               'RESOLVED_NO_HUMAN_REQUIREMENT')),
    CONSTRAINT replay_distribution_package_versions_analytical_authority_check
        CHECK (analytical_authority_resolution IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT',
                                                   'RESOLVED_NO_HUMAN_REQUIREMENT')),
    -- The state and the count agree in BOTH directions, so an exact requirement
    -- can never be recorded as empty and an empty one can never masquerade as
    -- exact - the frozen 0092 rule.
    CONSTRAINT replay_distribution_package_versions_count_check
        CHECK ((authority_requirement_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT' AND required_approver_count > 0)
            OR (authority_requirement_state = 'RESOLVED_NO_HUMAN_REQUIREMENT' AND required_approver_count = 0)),
    -- And the union is EXACT whenever either half is, so a resolved-empty union
    -- over a half that names humans is unrepresentable.
    CONSTRAINT replay_distribution_package_versions_union_check
        CHECK (authority_requirement_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT'
            OR (source_authority_resolution = 'RESOLVED_NO_HUMAN_REQUIREMENT'
                AND analytical_authority_resolution = 'RESOLVED_NO_HUMAN_REQUIREMENT')),
    CONSTRAINT replay_distribution_package_versions_fingerprint_check
        CHECK (authority_request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT replay_distribution_package_versions_sanitization_check
        CHECK (sanitization_contract_id = 'QANDEEL_REPLAY_EXPORT_SANITIZATION_V1'),
    -- An opaque audience reference in its own shape: never a uuid, never derived
    -- from one, and structurally not confusable with an internal identity.
    CONSTRAINT replay_distribution_package_versions_reference_check
        CHECK (audience_safe_reference ~ '^rdx1_[0-9a-f]{32}$'),
    CONSTRAINT replay_distribution_package_versions_replay_fk
        FOREIGN KEY (replay_id) REFERENCES public.replays (id) ON DELETE RESTRICT,
    -- HISTORICAL FINALIZATION, AS ONE ROW. Not `replays.current_lifecycle`, which
    -- I-06B legitimately moves back to DRAFT without erasing this evidence.
    CONSTRAINT replay_distribution_package_versions_finalized_fk
        FOREIGN KEY (replay_version_id, replay_id)
        REFERENCES public.replay_version_finalizations (replay_version_id, replay_id) ON DELETE RESTRICT,
    -- THE EXACT COMPLETE REPLAY VERSION AND ITS OWN MANIFEST, AS ONE ROW, so a
    -- package can never pair one Replay's version with another Replay, and never
    -- name a manifest that version does not bind.
    CONSTRAINT replay_distribution_package_versions_version_fk
        FOREIGN KEY (replay_version_id, replay_id, source_manifest_version_id)
        REFERENCES public.replay_versions (id, replay_id, source_manifest_version_id) ON DELETE RESTRICT,
    -- And the declared source class is READ FROM that exact manifest.
    CONSTRAINT replay_distribution_package_versions_class_fk
        FOREIGN KEY (source_manifest_version_id, source_class)
        REFERENCES public.replay_source_manifest_versions (id, source_class) ON DELETE RESTRICT
);

CREATE INDEX replay_distribution_package_versions_replay_idx
    ON public.replay_distribution_package_versions (replay_id, package_revision);
CREATE INDEX replay_distribution_package_versions_version_idx
    ON public.replay_distribution_package_versions (replay_version_id);

COMMENT ON TABLE public.replay_distribution_package_versions IS
  'One immutable REPLAY_DISTRIBUTION_PACKAGE_VERSION: one exact historically '
  'FINALIZED Replay Version, one exact destination action, the exact derived '
  'authority requirement of the material it carries and the opaque '
  'audience-safe reference an audience may see. It is not a Replay Version, an '
  'export job, a file, a URL, a storage object or a World, and it holds no '
  'source body, path, transcript, audio handle or sealed provenance. Preparing '
  'one widens no audience.';

-- ---------------------------------------------------------------------------
-- 3. THE DERIVED REQUIRED_REPLAY_DISTRIBUTION_APPROVER_SET.
--
--    The exact UNION of the human authorities of the protected material and
--    analytical material actually included in this exact package - never World
--    membership, never the current Shared audience, never the Replay creator by
--    convenience and never a caller-supplied list. Migration 0105 derives it
--    internally and has no approver parameter of any kind.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_distribution_required_approvers (
    distribution_package_version_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    CONSTRAINT replay_distribution_required_approvers_pk
        PRIMARY KEY (distribution_package_version_id, approver_user_id),
    CONSTRAINT replay_distribution_required_approvers_package_fk
        FOREIGN KEY (distribution_package_version_id)
        REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT,
    CONSTRAINT replay_distribution_required_approvers_user_fk
        FOREIGN KEY (approver_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.replay_distribution_required_approvers IS
  'The REQUIRED_REPLAY_DISTRIBUTION_APPROVER_SET of one exact package: the exact '
  'union of the human authorities of the protected material and analytical '
  'material actually included. Membership in any World contributes nothing.';

-- ---------------------------------------------------------------------------
-- 4. ONE EXACT HUMAN APPROVAL OF ONE EXACT PACKAGE AND ONE EXACT DESTINATION.
--
--    Two composite foreign keys carry the whole law:
--
--      into the DERIVED required set   an approval by a human this exact package
--                                      does not require is unrepresentable,
--                                      however the row is produced
--      into (package, destination)     an approval can never float from Public
--                                      to external share or to download
--
--    `bound_authority_fingerprint` is the authority request as derived at the
--    moment of approval. The distribution commit re-derives it from CURRENT
--    state and requires exact agreement, so a changed package, a changed
--    required set or a changed linked Public package stales the approval path
--    instead of quietly authorizing a different payload.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_distribution_approvals (
    id uuid NOT NULL,
    distribution_package_version_id uuid NOT NULL,
    destination_action text NOT NULL,
    approver_user_id uuid NOT NULL,
    bound_authority_fingerprint text NOT NULL,
    approved_at timestamptz NOT NULL,
    CONSTRAINT replay_distribution_approvals_pk PRIMARY KEY (id),
    CONSTRAINT replay_distribution_approvals_one_per_approver_key
        UNIQUE (distribution_package_version_id, approver_user_id),
    -- The exact approval identity, so a withdrawal binds id, package and
    -- approver from the SAME immutable row through ONE key - the frozen 0094
    -- precedent, and the reason a withdrawal can never name a different
    -- approval than the id it carries.
    CONSTRAINT replay_distribution_approvals_exact_identity_key
        UNIQUE (id, distribution_package_version_id, approver_user_id),
    CONSTRAINT replay_distribution_approvals_fingerprint_check
        CHECK (bound_authority_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT replay_distribution_approvals_required_fk
        FOREIGN KEY (distribution_package_version_id, approver_user_id)
        REFERENCES public.replay_distribution_required_approvers
                   (distribution_package_version_id, approver_user_id) ON DELETE RESTRICT,
    CONSTRAINT replay_distribution_approvals_destination_fk
        FOREIGN KEY (distribution_package_version_id, destination_action)
        REFERENCES public.replay_distribution_package_versions (id, destination_action) ON DELETE RESTRICT
);

COMMENT ON TABLE public.replay_distribution_approvals IS
  'One immutable human approval of ONE exact Replay Distribution Package Version '
  'for ONE exact destination action. The composite key into the DERIVED required '
  'set makes an approval by a human the package does not require unrepresentable; '
  'the composite key into (package, destination) makes an approval for Public '
  'unusable for external share or download.';

-- ---------------------------------------------------------------------------
-- 5. THE APPEND-ONLY WITHDRAWAL EVENT.
--
--    One effective withdrawal per approval, forever. The historical approval row
--    is NEVER mutated - it stays exactly the evidence it was - and this row says
--    the consent it recorded is no longer effective. A human may withdraw only
--    their OWN approval, which 0105 enforces from auth.uid(); the composite key
--    below makes the recorded approver that approval's own approver.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_distribution_approval_withdrawal_events (
    id uuid NOT NULL,
    approval_id uuid NOT NULL,
    distribution_package_version_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT replay_distribution_approval_withdrawal_events_pk PRIMARY KEY (id),
    CONSTRAINT replay_distribution_approval_withdrawal_events_approval_key UNIQUE (approval_id),
    CONSTRAINT replay_distribution_approval_withdrawal_events_approval_fk
        FOREIGN KEY (approval_id, distribution_package_version_id, approver_user_id)
        REFERENCES public.replay_distribution_approvals (id, distribution_package_version_id, approver_user_id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.replay_distribution_approval_withdrawal_events IS
  'The append-only withdrawal of one exact package-bound Replay distribution '
  'approval by the exact human who gave it. The approval row is never mutated: '
  'it remains immutable evidence, and this row says that evidence is no longer '
  'EFFECTIVE consent. Withdrawal grants no source browsing of any kind.';

-- ---------------------------------------------------------------------------
-- 6. EXPORT_PRIVACY_SANITIZATION - THE WHOLE AUDIENCE-VISIBLE SURFACE.
--
--    A positive allowlist as normalized typed columns, never a blacklist over a
--    JSON blob and never free text a client authored. Exactly three kinds of
--    column exist here:
--
--      the opaque audience-safe reference of its own package
--      safe derived counts (how many segments, how many real gaps)
--      exact versioned policy values the render contract already pinned
--
--    There is NO private World, Session, account, participant, source, unit,
--    material, history item, package item, provenance, path, URL, filename,
--    storage handle, audio reference or transcript column - section 12 refuses
--    to deploy this migration if one appears, by column-name pattern and by
--    column TYPE, so a jsonb escape hatch is refused too.
--
--    `descriptor_digest` is a one-way digest of the sanitized descriptor ITSELF
--    and of no source: it is what the authority fingerprint binds, so a package
--    cannot be approved against one audience-visible surface and exported with a
--    materially different one.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_distribution_export_descriptors (
    distribution_package_version_id uuid NOT NULL,
    destination_action text NOT NULL,
    audience_safe_reference text NOT NULL,
    sanitization_contract_id text NOT NULL,
    coverage_class text NOT NULL,
    selected_segment_count integer NOT NULL,
    temporal_gap_count integer NOT NULL,
    source_medium_class text NOT NULL,
    original_medium_policy text NOT NULL,
    exact_text_policy text NOT NULL,
    semantic_cut_policy text NOT NULL,
    temporal_gap_policy text NOT NULL,
    timing_integrity_policy text NOT NULL,
    analytical_projection_policy text NOT NULL,
    camera_emphasis_policy text NOT NULL,
    motion_policy text NOT NULL,
    caption_policy text NOT NULL,
    accessibility_parity_policy text NOT NULL,
    reduced_motion_parity_policy text NOT NULL,
    editorial_annotation_policy text NOT NULL,
    descriptor_digest text NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT replay_distribution_export_descriptors_pk PRIMARY KEY (distribution_package_version_id),
    CONSTRAINT replay_distribution_export_descriptors_reference_key UNIQUE (audience_safe_reference),
    CONSTRAINT replay_distribution_export_descriptors_sanitization_check
        CHECK (sanitization_contract_id = 'QANDEEL_REPLAY_EXPORT_SANITIZATION_V1'),
    CONSTRAINT replay_distribution_export_descriptors_coverage_check
        CHECK (coverage_class IN ('FULL_SOURCE', 'SELECTED_EXCERPT', 'HIGHLIGHT_SELECTION')),
    CONSTRAINT replay_distribution_export_descriptors_count_check
        CHECK (selected_segment_count >= 1 AND temporal_gap_count >= 0),
    CONSTRAINT replay_distribution_export_descriptors_digest_check
        CHECK (descriptor_digest ~ '^sha256:[0-9a-f]{64}$'),
    -- Every policy is the exact versioned value the frozen 0102 render contract
    -- pins, so an exported descriptor can never advertise a truth policy the
    -- renderer was never bound to.
    CONSTRAINT replay_distribution_export_descriptors_policy_check CHECK (
        source_medium_class = 'ORIGINAL_TEXT_ONLY'
    AND original_medium_policy = 'PRESERVE_ORIGINAL_MEDIUM_ONLY'
    AND exact_text_policy = 'EXACT_SOURCE_TEXT'
    AND semantic_cut_policy = 'WHOLE_ITEM_ONLY_PROVEN_SAFE'
    AND temporal_gap_policy = 'PERCEPTIBLE_DISCONTINUITY_REQUIRED'
    AND timing_integrity_policy = 'PRESENTATION_PACING_DECLARED'
    AND analytical_projection_policy = 'BOUND_HISTORICAL_PROJECTION_DIGEST'
    AND camera_emphasis_policy = 'EMPHASIS_WITHOUT_MEANING_CREATION'
    AND motion_policy = 'EXPLANATORY_MOTION_ONLY'
    AND caption_policy = 'DERIVED_CAPTION_DISTINCT_FROM_SOURCE'
    AND accessibility_parity_policy = 'EQUIVALENT_TRUTH_REQUIRED'
    AND reduced_motion_parity_policy = 'EQUIVALENT_TRUTH_REQUIRED'
    AND editorial_annotation_policy = 'NO_EDITORIAL_ANNOTATION'),
    -- THE DESCRIPTOR BINDS ITS EXACT PACKAGE, ITS DESTINATION AND ITS OWN
    -- AUDIENCE REFERENCE AS ONE ROW, so a sanitized surface can never be moved
    -- onto another package or another destination.
    CONSTRAINT replay_distribution_export_descriptors_package_fk
        FOREIGN KEY (distribution_package_version_id, destination_action, audience_safe_reference)
        REFERENCES public.replay_distribution_package_versions (id, destination_action, audience_safe_reference)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.replay_distribution_export_descriptors IS
  'EXPORT_PRIVACY_SANITIZATION as a positive allowlist: the WHOLE '
  'audience-visible surface of one distributed Replay, as normalized typed '
  'columns. Only an opaque audience reference, safe derived counts and the exact '
  'versioned render-truth policies appear. No private World, Session, account, '
  'participant, source, material, package item, provenance, path, URL, storage '
  'handle, audio reference or transcript column exists, and none may be added.';

-- ---------------------------------------------------------------------------
-- 7. THE PUBLIC REPLAY_ARTIFACT BRIDGE.
--
--    The activation of the seam I-05A reserved, and nothing wider. One row binds:
--
--      the exact Public package item, its manifest and its RESERVED body form
--      that item's sealed provenance row, classed exactly REPLAY_ARTIFACT
--      the exact Public Experience the manifest belongs to
--      the exact Replay Distribution Package Version, its destination, its
--        Replay Version and its audience-safe reference
--
--    each through ONE composite foreign key onto a candidate key, so no half of
--    the chain can name a row belonging to something else. There is no generic
--    artifact id, no source URL, no private source pointer and no sealed
--    provenance traversal: the Public package still stores a bounded public
--    derivative, and the derivative of a Replay is its sanitized descriptor.
--
--    UNIQUE (distribution_package_version_id) is the 1:1 rule that section 22 of
--    the contract requires: one Replay distribution package for Public
--    corresponds to exactly one Public package item, so the two immutable
--    evidence stores can never drift and one human consent act can bind both.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_public_distribution_artifacts (
    package_item_id uuid NOT NULL,
    public_manifest_version_id uuid NOT NULL,
    public_experience_id uuid NOT NULL,
    public_body_form text NOT NULL,
    public_source_class text NOT NULL,
    distribution_package_version_id uuid NOT NULL,
    destination_action text NOT NULL,
    replay_version_id uuid NOT NULL,
    audience_safe_reference text NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT replay_public_distribution_artifacts_pk PRIMARY KEY (package_item_id),
    CONSTRAINT replay_public_distribution_artifacts_package_key UNIQUE (distribution_package_version_id),
    CONSTRAINT replay_public_distribution_artifacts_reference_key UNIQUE (audience_safe_reference),
    -- The reserved Public shapes, activated explicitly and narrowly.
    CONSTRAINT replay_public_distribution_artifacts_form_check CHECK (public_body_form = 'RESERVED'),
    CONSTRAINT replay_public_distribution_artifacts_source_check
        CHECK (public_source_class = 'REPLAY_ARTIFACT'),
    CONSTRAINT replay_public_distribution_artifacts_destination_check
        CHECK (destination_action = 'PUBLISH_TO_PUBLIC_WORLD'),
    CONSTRAINT replay_public_distribution_artifacts_item_fk
        FOREIGN KEY (public_manifest_version_id, package_item_id, public_body_form)
        REFERENCES public.publication_package_manifest_items
                   (manifest_version_id, package_item_id, public_body_form) ON DELETE RESTRICT,
    CONSTRAINT replay_public_distribution_artifacts_provenance_fk
        FOREIGN KEY (package_item_id, public_source_class)
        REFERENCES public.publication_package_item_provenance (package_item_id, source_class)
        ON DELETE RESTRICT,
    CONSTRAINT replay_public_distribution_artifacts_manifest_fk
        FOREIGN KEY (public_manifest_version_id, public_experience_id)
        REFERENCES public.publication_package_manifest_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT replay_public_distribution_artifacts_distribution_fk
        FOREIGN KEY (distribution_package_version_id, destination_action, replay_version_id,
                     audience_safe_reference)
        REFERENCES public.replay_distribution_package_versions
                   (id, destination_action, replay_version_id, audience_safe_reference) ON DELETE RESTRICT
);

CREATE INDEX replay_public_distribution_artifacts_experience_idx
    ON public.replay_public_distribution_artifacts (public_experience_id);

COMMENT ON TABLE public.replay_public_distribution_artifacts IS
  'The narrow activation of the I-05A REPLAY_ARTIFACT seam: one exact Public '
  'package item of RESERVED body form, whose sealed provenance is classed '
  'REPLAY_ARTIFACT, bound 1:1 to one exact Replay Distribution Package Version '
  'and its exact Replay Version. It is not a generic artifact pointer, it names '
  'no private source, and it grants no provenance traversal.';

-- ---------------------------------------------------------------------------
-- 8. THE IMMUTABLE DISTRIBUTION AUTHORIZATION RECORD.
--
--    What exactly was authorized, once every gate passed. It records
--    AUTHORIZATION, never DELIVERY:
--
--      SHARE_EXTERNALLY / DOWNLOAD   AUTHORIZED_FOR_DELIVERY. This repository has
--                                    no encoder, container, object store, CDN,
--                                    public URL or messaging transport, and none
--                                    is invented, so nothing here may claim
--                                    DELIVERED, SHARED or DOWNLOADED.
--      PUBLISH_TO_PUBLIC_WORLD       PUBLIC_PUBLICATION_COMMITTED, and the row
--                                    BINDS the canonical Public publication
--                                    record rather than restating it. The
--                                    canonical Public publication truth stays the
--                                    only Public publication truth.
--
--    The five CW2-08 dimensions are recorded as the seam ANSWERED them and are
--    CHECK-pinned to their positive values, so an authorization row cannot exist
--    with an unevaluated or negative dimension - which is the structural half of
--    "no layer manufactures another". The seam itself answers NOT_EVALUATED at
--    this baseline, so no such row is reachable in production at all.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_distribution_authorizations (
    distribution_package_version_id uuid NOT NULL,
    destination_action text NOT NULL,
    replay_id uuid NOT NULL,
    replay_version_id uuid NOT NULL,
    authorized_by_user_id uuid NOT NULL,
    authority_request_fingerprint text NOT NULL,
    effective_approval_count integer NOT NULL,
    distribution_state text NOT NULL,
    safety_state text NOT NULL,
    moderation_state text NOT NULL,
    entitlement_state text NOT NULL,
    feature_state text NOT NULL,
    launch_state text NOT NULL,
    prerequisite_clearance_basis text NOT NULL,
    published_experience_version_id uuid,
    authorized_at timestamptz NOT NULL,
    CONSTRAINT replay_distribution_authorizations_pk PRIMARY KEY (distribution_package_version_id),
    CONSTRAINT replay_distribution_authorizations_count_check CHECK (effective_approval_count >= 0),
    CONSTRAINT replay_distribution_authorizations_fingerprint_check
        CHECK (authority_request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT replay_distribution_authorizations_basis_check
        CHECK (length(btrim(prerequisite_clearance_basis)) > 0
           AND length(prerequisite_clearance_basis) <= 240),
    -- AUTHORIZATION IS NOT DELIVERY, and a Public publish names the canonical
    -- Public publication it committed while the two transport-free destinations
    -- name nothing at all.
    CONSTRAINT replay_distribution_authorizations_state_check CHECK (
        (destination_action = 'PUBLISH_TO_PUBLIC_WORLD'
            AND distribution_state = 'PUBLIC_PUBLICATION_COMMITTED'
            AND published_experience_version_id IS NOT NULL)
     OR (destination_action = 'SHARE_EXTERNALLY'
            AND distribution_state = 'AUTHORIZED_FOR_DELIVERY'
            AND published_experience_version_id IS NULL)
     OR (destination_action = 'DOWNLOAD'
            AND distribution_state = 'AUTHORIZED_FOR_DELIVERY'
            AND published_experience_version_id IS NULL)),
    -- EVERY APPLICABLE CW2-08 DIMENSION CLEARED, or no row exists.
    CONSTRAINT replay_distribution_authorizations_clearance_check CHECK (
        safety_state = 'SAFETY_ALLOW' AND moderation_state = 'MODERATION_ALLOW'
    AND entitlement_state = 'ENTITLED' AND feature_state = 'FEATURE_ENABLED'
    AND launch_state = 'LAUNCH_CLEARED'),
    -- The exact package, its destination, its Replay and its Replay Version as
    -- ONE row.
    CONSTRAINT replay_distribution_authorizations_package_fk
        FOREIGN KEY (distribution_package_version_id, destination_action, replay_id, replay_version_id)
        REFERENCES public.replay_distribution_package_versions
                   (id, destination_action, replay_id, replay_version_id) ON DELETE RESTRICT,
    CONSTRAINT replay_distribution_authorizations_actor_fk
        FOREIGN KEY (authorized_by_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    -- The canonical Public publication record, BOUND and never restated.
    CONSTRAINT replay_distribution_authorizations_publication_fk
        FOREIGN KEY (published_experience_version_id)
        REFERENCES public.public_experience_publication_state (published_experience_version_id)
        ON DELETE RESTRICT
);

CREATE INDEX replay_distribution_authorizations_replay_idx
    ON public.replay_distribution_authorizations (replay_id, authorized_at);

COMMENT ON TABLE public.replay_distribution_authorizations IS
  'The immutable record that ONE exact Replay Distribution Package Version was '
  'authorized for its exact destination with every human approval effective and '
  'every applicable CW2-08 dimension cleared. It records AUTHORIZATION and never '
  'DELIVERY: with no encoder, container, object store, CDN, public URL or '
  'transport in this repository, an external share or download reaches '
  'AUTHORIZED_FOR_DELIVERY and nothing here ever claims DELIVERED, SHARED or '
  'DOWNLOADED. A Public publish BINDS the canonical Public publication record '
  'rather than competing with it.';

-- ---------------------------------------------------------------------------
-- 9. IMMUTABILITY AND OPACITY TRIGGERS.
--
--    BEFORE triggers rather than privileges alone, for the reason migrations
--    0064, 0091, 0092, 0100 and 0102 established: privileges do not bind the
--    table owner and a future accidental GRANT would otherwise reopen mutation.
--
--    None of these is a forward ceiling. A later slice appends new packages,
--    approvals, withdrawals and authorizations beside these, and I-06D composes
--    its own post-distribution source-loss state beside them; none of that is
--    refused here.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_replay_distribution_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'REPLAY_DISTRIBUTION_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A Replay distribution package version, its required approver set, its approvals, its withdrawals, its sanitized export descriptor, its Public artifact bridge and its authorization record are append-only: UPDATE and DELETE are refused for every role, including the table owner. A changed package, destination, required set or sanitized surface is a NEW package version.';
END$$;

ALTER FUNCTION public.reject_replay_distribution_mutation_v1() OWNER TO postgres;

CREATE TRIGGER replay_distribution_package_versions_immutable
    BEFORE UPDATE OR DELETE ON public.replay_distribution_package_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_distribution_mutation_v1();
CREATE TRIGGER replay_distribution_required_approvers_immutable
    BEFORE UPDATE OR DELETE ON public.replay_distribution_required_approvers
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_distribution_mutation_v1();
CREATE TRIGGER replay_distribution_approvals_immutable
    BEFORE UPDATE OR DELETE ON public.replay_distribution_approvals
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_distribution_mutation_v1();
CREATE TRIGGER replay_distribution_approval_withdrawal_events_immutable
    BEFORE UPDATE OR DELETE ON public.replay_distribution_approval_withdrawal_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_distribution_mutation_v1();
CREATE TRIGGER replay_distribution_export_descriptors_immutable
    BEFORE UPDATE OR DELETE ON public.replay_distribution_export_descriptors
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_distribution_mutation_v1();
CREATE TRIGGER replay_public_distribution_artifacts_immutable
    BEFORE UPDATE OR DELETE ON public.replay_public_distribution_artifacts
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_distribution_mutation_v1();
CREATE TRIGGER replay_distribution_authorizations_immutable
    BEFORE UPDATE OR DELETE ON public.replay_distribution_authorizations
    FOR EACH ROW EXECUTE FUNCTION public.reject_replay_distribution_mutation_v1();

-- THE AUDIENCE REFERENCE IS OPAQUE, STRUCTURALLY.
--
-- The CHECK above pins its SHAPE; it cannot pin that the 32 hex characters are
-- not simply an internal uuid with its dashes removed. A package whose public
-- identity reproduced its own Replay id, Replay Version id, manifest id or
-- package id would be an internal identifier wearing an opaque costume, and
-- every Public and external surface would then be leaking one. This guard makes
-- that unrepresentable for every role including the table owner, and it reads
-- only the row's own columns.
CREATE FUNCTION public.replay_distribution_audience_reference_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  opaque text := substring(NEW.audience_safe_reference from 6);
BEGIN
  IF opaque IN (replace(lower(NEW.id::text), '-', ''),
                replace(lower(NEW.replay_id::text), '-', ''),
                replace(lower(NEW.replay_version_id::text), '-', ''),
                replace(lower(NEW.source_manifest_version_id::text), '-', '')) THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_REFERENCE_NOT_OPAQUE' USING ERRCODE='P0001',
      DETAIL='An audience-safe Replay reference is minted at random and reproduces no internal identity: a public identifier that is an internal uuid in disguise is still an internal uuid.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.replay_distribution_audience_reference_v1() OWNER TO postgres;

CREATE TRIGGER replay_distribution_package_versions_opaque_reference
    BEFORE INSERT ON public.replay_distribution_package_versions
    FOR EACH ROW EXECUTE FUNCTION public.replay_distribution_audience_reference_v1();

-- ---------------------------------------------------------------------------
-- 10. DENY-BY-DEFAULT POSTURE.
-- ---------------------------------------------------------------------------
ALTER TABLE public.replay_distribution_package_versions OWNER TO postgres;
ALTER TABLE public.replay_distribution_required_approvers OWNER TO postgres;
ALTER TABLE public.replay_distribution_approvals OWNER TO postgres;
ALTER TABLE public.replay_distribution_approval_withdrawal_events OWNER TO postgres;
ALTER TABLE public.replay_distribution_export_descriptors OWNER TO postgres;
ALTER TABLE public.replay_public_distribution_artifacts OWNER TO postgres;
ALTER TABLE public.replay_distribution_authorizations OWNER TO postgres;

ALTER TABLE public.replay_distribution_package_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_distribution_required_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_distribution_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_distribution_approval_withdrawal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_distribution_export_descriptors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_public_distribution_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_distribution_authorizations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.replay_distribution_package_versions,
                    public.replay_distribution_required_approvers,
                    public.replay_distribution_approvals,
                    public.replay_distribution_approval_withdrawal_events,
                    public.replay_distribution_export_descriptors,
                    public.replay_public_distribution_artifacts,
                    public.replay_distribution_authorizations
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.replay_distribution_package_versions, public.replay_distribution_required_approvers, public.replay_distribution_approvals, public.replay_distribution_approval_withdrawal_events, public.replay_distribution_export_descriptors, public.replay_public_distribution_artifacts, public.replay_distribution_authorizations FROM service_role';
END IF;END$$;

-- The trigger functions are internal and are invoked directly by nobody.
REVOKE ALL ON FUNCTION public.reject_replay_distribution_mutation_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replay_distribution_audience_reference_v1() FROM PUBLIC;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_replay_distribution_mutation_v1(), public.replay_distribution_audience_reference_v1() FROM anon, authenticated, service_role';
ELSE
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_replay_distribution_mutation_v1(), public.replay_distribution_audience_reference_v1() FROM anon, authenticated';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 11. SELF-ASSERTIONS.
--
--     What must already be true of THIS migration for it to be allowed to
--     deploy. Each is a fact about the objects 0104 owns or the frozen truths it
--     binds - never a census of the database, and never a ceiling on migration
--     0105 or on I-06D: no assertion here forbids a later reviewed source-loss
--     relation, recall record, media provider, Launch wrapper or Shared /
--     Public analytical capability from existing anywhere. What is forbidden is
--     forbidden ON THE RELATIONS THIS MIGRATION OWNS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_tables text[] := ARRAY['replay_distribution_package_versions',
                             'replay_distribution_required_approvers',
                             'replay_distribution_approvals',
                             'replay_distribution_approval_withdrawal_events',
                             'replay_distribution_export_descriptors',
                             'replay_public_distribution_artifacts',
                             'replay_distribution_authorizations'];
  t text;
  needed text;
  n integer;
BEGIN
  FOREACH t IN ARRAY own_tables LOOP
    -- A REPLAY IS NOT A WORLD. Distribution changes audience, never ontology.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(world_type|phase|birth_basis|member|episode|governance|proposal|coordinate|embedding|vitality|ranking|lifecycle)'
    ) THEN
      RAISE EXCEPTION 'I-06C: a Replay is a source-bound artifact, never a World: relation % may carry no World membership governance or lifecycle column', t;
    END IF;
    -- A DISTRIBUTION PACKAGE BINDS TRUTH AND COPIES NONE OF IT. No content
    -- column of any kind, no JSON blob, no binary payload, no private path.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       JOIN pg_type ty ON ty.oid = a.atttypid
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND (a.attname ~ '(body|_text$|^text|transcript|audio|content|payload|blob|document|excerpt|snippet|statement|moment|committed|url|uri|href|path|filename|object_key|bucket|storage|credential|secret|token)'
              OR ty.typname IN ('json', 'jsonb', 'bytea'))
    ) THEN
      RAISE EXCEPTION 'I-06C: relation % may carry no source content no private path and no storage handle: a distribution package binds truth and copies none of it', t;
    END IF;
    -- NO CODEC, CONTAINER, STORAGE OR MEDIA CRAFT IS INVENTED HERE.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(codec|container|bitrate|resolution|frame_rate|framerate|cdn|watermark|drm|template|font|typograph|choreograph|easing|palette|encoder|mime)'
    ) THEN
      RAISE EXCEPTION 'I-06C: relation % may define no codec container storage or media craft column: CW2-05 defers all of it', t;
    END IF;
    -- NO SOURCE BODY RELATION, NO RAW TURN AND NO SEALED PROVENANCE BODY is ever
    -- a parent. The ONE authorized reference into the sealed provenance is the
    -- Public bridge, which binds the RESERVED REPLAY_ARTIFACT class row and
    -- reads no column of it.
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid IN ('public.shared_world_text_material_bodies'::regclass,
                             'public.shared_world_voice_note_material_bodies'::regclass,
                             'public.public_experience_text_derivative_bodies'::regclass,
                             'public.conversation_turns'::regclass,
                             'public.conversation_units'::regclass)
    ) THEN
      RAISE EXCEPTION 'I-06C: relation % must bind no body relation, no raw turn and no committed source unit', t;
    END IF;
    -- Every foreign key this migration installs is restrictive.
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f' AND c.confdeltype <> 'r'
    ) THEN
      RAISE EXCEPTION 'I-06C: every Replay distribution foreign key is restrictive: relation % must never cascade truth away', t;
    END IF;
    -- Every identifier fits the 63-byte limit, so nothing is silently truncated.
    IF length(t) > 63 OR EXISTS (SELECT 1 FROM pg_constraint c
                                  WHERE c.conrelid = ('public.' || t)::regclass AND length(c.conname) > 63)
       OR EXISTS (SELECT 1 FROM pg_class idx JOIN pg_index ix ON ix.indexrelid = idx.oid
                   WHERE ix.indrelid = ('public.' || t)::regclass AND length(idx.relname) > 63) THEN
      RAISE EXCEPTION 'I-06C: an identifier on % exceeds the PostgreSQL 63-byte limit', t;
    END IF;
    -- Append-only for every role, deny by default, and PART A writes no row.
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
       WHERE tg.tgrelid = ('public.' || t)::regclass AND NOT tg.tgisinternal
         AND tg.tgfoid = 'public.reject_replay_distribution_mutation_v1'::regproc
    ) THEN
      RAISE EXCEPTION 'I-06C: relation % must be append-only for every role', t;
    END IF;
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-06C: relation % must have row level security enabled', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-06C: relation % must carry zero policies', t;
    END IF;
    IF (SELECT c.relowner FROM pg_class c WHERE c.oid = ('public.' || t)::regclass)
       <> (SELECT r.oid FROM pg_roles r WHERE r.rolname = 'postgres') THEN
      RAISE EXCEPTION 'I-06C: relation % must be postgres-owned', t;
    END IF;
    FOREACH needed IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN needed <> 'public' AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = needed);
      IF has_table_privilege(needed, ('public.' || t)::regclass, 'SELECT')
         OR has_table_privilege(needed, ('public.' || t)::regclass, 'INSERT')
         OR has_table_privilege(needed, ('public.' || t)::regclass, 'UPDATE')
         OR has_table_privilege(needed, ('public.' || t)::regclass, 'DELETE') THEN
        RAISE EXCEPTION 'I-06C: relation % must hold no privilege for %', t, needed;
      END IF;
    END LOOP;
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n <> 0 THEN
      RAISE EXCEPTION 'I-06C: PART A is persistence and writes no row: % holds %', t, n;
    END IF;
  END LOOP;

  -- EVERY PACKAGE NAMES AN EXACT HISTORICALLY FINALIZED REPLAY VERSION OF ITS
  -- EXACT REPLAY, as ONE row of the append-only evidence rather than through a
  -- current lifecycle a later reopen legitimately moves.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_distribution_package_versions'::regclass
       AND c.conname = 'replay_distribution_package_versions_finalized_fk'
       AND c.confrelid = 'public.replay_version_finalizations'::regclass
       AND cardinality(c.confkey) = 2
  ) THEN
    RAISE EXCEPTION 'I-06C: a distribution package must bind the EXACT historical finalization evidence of its exact Replay Version';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_distribution_package_versions'::regclass
       AND c.conname = 'replay_distribution_package_versions_version_fk'
       AND c.confrelid = 'public.replay_versions'::regclass
       AND cardinality(c.confkey) = 3
  ) THEN
    RAISE EXCEPTION 'I-06C: a distribution package must bind its Replay Version its Replay and that version own manifest as ONE exact row';
  END IF;
  -- And it never consults the stable Replay's CURRENT lifecycle to decide that.
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
     WHERE a.attrelid = 'public.replay_distribution_package_versions'::regclass
       AND a.attnum > 0 AND NOT a.attisdropped AND a.attname ~ 'lifecycle'
  ) THEN
    RAISE EXCEPTION 'I-06C: a distribution package carries no Replay lifecycle: historical finalization is evidence, not a current state';
  END IF;

  -- DESTINATION IS PART OF PACKAGE IDENTITY, and an approval binds it.
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_distribution_package_versions'::regclass
         AND c.conname = 'replay_distribution_package_versions_destination_check')
     !~ 'PUBLISH_TO_PUBLIC_WORLD' THEN
    RAISE EXCEPTION 'I-06C: the three frozen destination actions must be the exact vocabulary';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_distribution_approvals'::regclass
       AND c.conname = 'replay_distribution_approvals_destination_fk'
       AND c.confrelid = 'public.replay_distribution_package_versions'::regclass
       AND cardinality(c.confkey) = 2
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_distribution_approvals'::regclass
       AND c.conname = 'replay_distribution_approvals_required_fk'
       AND c.confrelid = 'public.replay_distribution_required_approvers'::regclass
       AND cardinality(c.confkey) = 2 AND c.confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'I-06C: an approval must bind the exact package AND destination, and must be structurally impossible outside the DERIVED required set';
  END IF;
  -- A WITHDRAWAL NAMES ONE EXACT APPROVAL, through ONE composite key.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_distribution_approval_withdrawal_events'::regclass
       AND c.contype = 'f' AND c.confrelid = 'public.replay_distribution_approvals'::regclass
       AND cardinality(c.confkey) = 3
  ) THEN
    RAISE EXCEPTION 'I-06C: a withdrawal must bind one exact approval: its id, its package and its approver from the SAME immutable row';
  END IF;

  -- UNRESOLVED AUTHORITY IS UNREPRESENTABLE INSIDE A PACKAGE, on both halves.
  FOREACH needed IN ARRAY ARRAY['replay_distribution_package_versions_state_check',
                                'replay_distribution_package_versions_source_authority_check',
                                'replay_distribution_package_versions_analytical_authority_check'] LOOP
    IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
         WHERE c.conrelid = 'public.replay_distribution_package_versions'::regclass
           AND c.conname = needed) ~ 'UNRESOLVED' THEN
      RAISE EXCEPTION 'I-06C: % must admit only the two RESOLVED states: unresolved authority can never enter a package', needed;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                    WHERE c.conrelid = 'public.replay_distribution_package_versions'::regclass
                      AND c.conname = needed) THEN
      RAISE EXCEPTION 'I-06C: the authority resolution constraint % must exist', needed;
    END IF;
  END LOOP;
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_distribution_package_versions'::regclass
         AND c.conname = 'replay_distribution_package_versions_count_check')
     !~ 'required_approver_count > 0' THEN
    RAISE EXCEPTION 'I-06C: an exact human requirement can never be recorded as an empty approver set';
  END IF;

  -- THE SOURCE CLASS IS READ FROM THE EXACT MANIFEST, never asserted.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_distribution_package_versions'::regclass
       AND c.conname = 'replay_distribution_package_versions_class_fk'
       AND c.confrelid = 'public.replay_source_manifest_versions'::regclass
       AND cardinality(c.confkey) = 2
  ) THEN
    RAISE EXCEPTION 'I-06C: the distributed source class must be read from the exact source manifest, never declared';
  END IF;

  -- THE SANITIZED DESCRIPTOR IS A POSITIVE ALLOWLIST. No private identifier
  -- class of any kind may appear as a column of the ONE relation an audience
  -- ever sees, and no column of it may be a JSON escape hatch.
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
     WHERE a.attrelid = 'public.replay_distribution_export_descriptors'::regclass
       AND a.attnum > 0 AND NOT a.attisdropped
       AND a.attname ~ '(session|turn|conversation_unit|world_id|shared_|material|history_item|owner_user|user_id|approver|participant|captured_|manifest_version|selection_spec|projection_version|render_contract|experience|package_item|replay_id|replay_version|provenance_|source_id|source_ref)'
  ) THEN
    RAISE EXCEPTION 'I-06C: the sanitized export descriptor may carry no private identifier of any class';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_distribution_export_descriptors'::regclass
       AND c.conname = 'replay_distribution_export_descriptors_package_fk'
       AND c.confrelid = 'public.replay_distribution_package_versions'::regclass
       AND cardinality(c.confkey) = 3
  ) THEN
    RAISE EXCEPTION 'I-06C: a sanitized descriptor must bind its exact package its destination and its own audience reference as ONE row';
  END IF;
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_distribution_package_versions'::regclass
         AND c.conname = 'replay_distribution_package_versions_reference_check') !~ 'rdx1_' THEN
    RAISE EXCEPTION 'I-06C: the audience-safe reference must have its own opaque shape, structurally distinct from every internal uuid identity';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.replay_distribution_package_versions'::regclass
                    AND tg.tgname = 'replay_distribution_package_versions_opaque_reference'
                    AND NOT tg.tgisinternal
                    AND tg.tgfoid = 'public.replay_distribution_audience_reference_v1'::regproc) THEN
    RAISE EXCEPTION 'I-06C: an audience-safe reference that reproduces an internal identity must be unrepresentable';
  END IF;

  -- THE PUBLIC BRIDGE ACTIVATES THE RESERVED SEAM NARROWLY: four exact bindings,
  -- one Public artifact per Replay distribution package, and no generic pointer.
  FOREACH needed IN ARRAY ARRAY['replay_public_distribution_artifacts_item_fk',
                                'replay_public_distribution_artifacts_provenance_fk',
                                'replay_public_distribution_artifacts_manifest_fk',
                                'replay_public_distribution_artifacts_distribution_fk'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                    WHERE c.conrelid = 'public.replay_public_distribution_artifacts'::regclass
                      AND c.conname = needed AND c.contype = 'f' AND cardinality(c.confkey) >= 2) THEN
      RAISE EXCEPTION 'I-06C: the Public Replay artifact bridge must carry the exact composite binding %', needed;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_public_distribution_artifacts'::regclass
       AND c.conname = 'replay_public_distribution_artifacts_distribution_fk'
       AND cardinality(c.confkey) = 4
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_public_distribution_artifacts'::regclass
       AND c.conname = 'replay_public_distribution_artifacts_package_key' AND c.contype = 'u'
  ) THEN
    RAISE EXCEPTION 'I-06C: one Public package item binds ONE exact Replay distribution package version, its destination, its Replay Version and its audience reference';
  END IF;
  -- The bridge names no private source identifier of its own.
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
     WHERE a.attrelid = 'public.replay_public_distribution_artifacts'::regclass
       AND a.attnum > 0 AND NOT a.attisdropped
       AND a.attname ~ '(session|turn|conversation_unit|world_id|shared_|material|history_item|owner_user|user_id|captured_|selection_spec|projection_version|render_contract|source_manifest)'
  ) THEN
    RAISE EXCEPTION 'I-06C: the Public Replay artifact bridge may carry no private source identifier';
  END IF;

  -- AUTHORIZATION IS NOT DELIVERY, AND NO CLEARANCE IS FABRICATED.
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_distribution_authorizations'::regclass
         AND c.conname = 'replay_distribution_authorizations_state_check')
     !~ 'AUTHORIZED_FOR_DELIVERY' THEN
    RAISE EXCEPTION 'I-06C: an external share or download reaches AUTHORIZED_FOR_DELIVERY and never claims delivery';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
     WHERE a.attrelid = 'public.replay_distribution_authorizations'::regclass
       AND a.attnum > 0 AND NOT a.attisdropped
       AND a.attname ~ '(delivered|shared_at|downloaded|sent_at|recipient|address|email|phone|endpoint)'
  ) THEN
    RAISE EXCEPTION 'I-06C: no column may record a delivery that no transport boundary performed';
  END IF;
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_distribution_authorizations'::regclass
         AND c.conname = 'replay_distribution_authorizations_clearance_check')
     !~ 'SAFETY_ALLOW' THEN
    RAISE EXCEPTION 'I-06C: an authorization row may exist only with every applicable CW2-08 dimension positive';
  END IF;
  -- And the Public destination BINDS the canonical Public publication record.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_distribution_authorizations'::regclass
       AND c.conname = 'replay_distribution_authorizations_publication_fk'
       AND c.confrelid = 'public.public_experience_publication_state'::regclass
  ) THEN
    RAISE EXCEPTION 'I-06C: a Public Replay authorization must bind the canonical Public publication record rather than restate it';
  END IF;

  -- PART A CREATES NO WRITER. Every function this migration owns returns
  -- `trigger` and is callable as nothing else; every writer is migration 0105.
  FOREACH needed IN ARRAY ARRAY['reject_replay_distribution_mutation_v1',
                                'replay_distribution_audience_reference_v1'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
       WHERE ns.nspname = 'public' AND p.proname = needed AND p.prorettype = 'trigger'::regtype
    ) THEN
      RAISE EXCEPTION 'I-06C: % must be a trigger function and nothing else', needed;
    END IF;
  END LOOP;

  -- THE ADDITIVE CANDIDATE KEYS THIS MIGRATION NEEDED EXIST, and every frozen
  -- guard on the relations they were added to is still in place.
  FOREACH needed IN ARRAY ARRAY['replay_version_finalizations_exact_key',
                                'replay_versions_composition_key',
                                'publication_package_manifest_items_exact_key',
                                'publication_package_item_provenance_class_key'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname = needed AND c.contype = 'u') THEN
      RAISE EXCEPTION 'I-06C: the additive candidate key % must exist', needed;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_version_finalizations'::regclass
                  AND tg.tgname = 'replay_version_finalizations_immutable' AND NOT tg.tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_versions'::regclass
                     AND tg.tgname = 'replay_versions_immutable' AND NOT tg.tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.publication_package_manifest_items'::regclass
                     AND tg.tgname = 'publication_package_manifest_items_immutable' AND NOT tg.tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.publication_package_item_provenance'::regclass
                     AND tg.tgname = 'publication_package_item_provenance_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-06C: the frozen I-06B and I-05A append-only guards must still be in place';
  END IF;

  -- THE FROZEN TRUTHS THIS SLICE BINDS MUST STILL BE INTACT: the reserved Public
  -- seam it activates, the exact-version finalization evidence it reads, and the
  -- CW2-08 prerequisite that still answers NOT_EVALUATED.
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.publication_package_item_provenance'::regclass
         AND c.conname = 'publication_package_item_provenance_class_check') !~ 'REPLAY_ARTIFACT' THEN
    RAISE EXCEPTION 'I-06C: the reserved REPLAY_ARTIFACT provenance class this slice activates must still exist';
  END IF;
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.publication_package_manifest_items'::regclass
         AND c.conname = 'publication_package_manifest_items_form_check') !~ 'RESERVED' THEN
    RAISE EXCEPTION 'I-06C: the reserved public body form this slice activates must still exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                  WHERE c.conrelid = 'public.replay_version_finalizations'::regclass
                    AND c.contype = 'p' AND cardinality(c.conkey) = 1) THEN
    RAISE EXCEPTION 'I-06C: finalization evidence must still be keyed by the EXACT Replay Version';
  END IF;
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)'::regprocedure)
     !~ 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'I-06C: the frozen CW2-08 prerequisite seam must still answer NOT_EVALUATED: I-06C manufactures no launch readiness';
  END IF;
END$$;

COMMIT;
