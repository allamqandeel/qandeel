-- I-06C - Replay Distribution Runtime, Export Privacy Sanitization and the
-- Public REPLAY_ARTIFACT bridge (PART B).
--
-- Migration 0104 created the immutable distribution package, the derived
-- required approver set, the package-bound approvals and withdrawals, the
-- sanitized export descriptor, the Public artifact bridge and the authorization
-- record. None of them can write a row. This migration creates the only things
-- that ever do: the durable command history, the two fail-closed seams, the ONE
-- authority derivation, the ONE export sanitization derivation, the effective
-- approval state, the three human primitives and the two read boundaries.
--
-- ===========================================================================
-- What I-06C can and cannot produce at this baseline
-- ===========================================================================
--
-- PRODUCTION DISTRIBUTION IS FAIL-CLOSED, on two independent seams, and the
-- report says so rather than manufacturing a demo path:
--
--   the analytical authority seam   CW2-02 requires a redistributable QANDEEL
--                                   analysis to carry an AUTHORITY_REQUIREMENT
--                                   _SET derived from the protected human
--                                   material AND SUBJECTS actually implicated.
--                                   Migration 0090 records the canonical finding
--                                   that the SUBJECT half has no reviewed
--                                   server-owned producer in this repository,
--                                   and encodes the rule that QANDEEL material
--                                   carrying ANY reasoning dependency is
--                                   UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT
--                                   rather than approval-free. Migration 0093
--                                   applies the same rule to Personal QANDEEL
--                                   analysis and fails it closed. An I-06B
--                                   ANALYTICAL_PROJECTION_VERSION is exactly
--                                   that kind of reasoning - Readings,
--                                   Confidences, Gaps, Questions, Materials and
--                                   Threads over a Personal Session - so its
--                                   exact human authority requirement is NOT
--                                   derivable from canonical truth here, and
--                                   `resolve_replay_analytical_distribution
--                                   _authority_v1` answers
--                                   UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT.
--                                   Package preparation fails closed on it.
--   the CW2-08 prerequisite seam    no executable canonical Safety, moderation,
--                                   entitlement, feature-flag or Launch Gate
--                                   runtime exists, so
--                                   `resolve_replay_distribution_prerequisites
--                                   _v1` answers NOT_EVALUATED on every
--                                   dimension and the distribution commit fails
--                                   closed on it.
--
-- Unresolved is NEVER reinterpreted as zero approvers: migration 0104 makes the
-- weaker outcome unrepresentable, and this migration refuses before it writes.
-- Both seams are narrow, both are honest about being unimplemented, and both are
-- replaced forward by a later reviewed slice without editing anything here.
--
-- ===========================================================================
-- Creation is not distribution, and preparation is not distribution
-- ===========================================================================
--
-- PREPARE_REPLAY_DISTRIBUTION_PACKAGE binds one exact finalized Replay Version
-- to one exact destination, revalidates current source truth, derives the exact
-- required approver set, mints the opaque audience reference, records the
-- sanitized descriptor and - for Public - prepares the bounded Public package
-- item under the canonical Public runtime. It publishes nothing, shares nothing,
-- downloads nothing, delivers nothing and clears nothing. A package may exist
-- forever without ever being distributed.
--
-- ===========================================================================
-- One human consent act, two immutable evidence stores
-- ===========================================================================
--
-- A Public Replay needs BOTH the Replay distribution approval and the canonical
-- Public manifest approval, because both subsystems own immutable authority
-- evidence and neither may be bypassed. Asking the same human twice for the same
-- immutable payload would be duplicate consent, so `approve_replay_distribution
-- _v1` is ONE act that writes both rows in ONE transaction, for the same
-- auth.uid(), over a Public package bound 1:1 to the Replay package. The Replay
-- authority fingerprint BINDS the linked Public authority fingerprint, so a
-- changed Public package stales the Replay approval path and vice versa.
--
-- The canonical Public authority derivation is EXTENDED additively rather than
-- duplicated: `derive_public_publication_authority_v1` keeps its signature, its
-- result columns and every rule it had, and gains the REPLAY_ARTIFACT branch the
-- reserved seam always needed. Without that branch a REPLAY_ARTIFACT provenance
-- row would contribute nothing to the union and the Public package would read as
-- requiring ZERO humans - which is precisely the reinterpretation the frozen
-- rule forbids. The branch closes it both ways: an unbridged REPLAY_ARTIFACT
-- item fails closed, and a bridged one contributes the exact required set of its
-- Replay distribution package.
--
-- ===========================================================================
-- Authorization is not delivery
-- ===========================================================================
--
-- This repository has no encoder, container, bitrate, object store, CDN, public
-- file URL, messaging transport, watermark or DRM, and this slice invents none.
-- So SHARE_EXTERNALLY and DOWNLOAD reach AUTHORIZED_FOR_DELIVERY and nothing
-- claims DELIVERED, SHARED or DOWNLOADED. PUBLISH_TO_PUBLIC_WORLD is different
-- only because a real audience boundary exists: the canonical
-- `publish_public_experience_v1` performs it, the canonical publication record
-- remains the ONE Public publication truth, and the I-06C record BINDS it.
--
-- ===========================================================================
-- The canonical I-06C lock order
-- ===========================================================================
--
--   1  public.replays                                FOR UPDATE
--   2  public.replay_distribution_package_versions    FOR SHARE
--   3  public.replay_versions                         FOR SHARE
--   4  the source domain, through the frozen I-06A
--      public.replay_lock_source_manifest_v1(...)     SHARE, domain order
--   5  public.replay_distribution_approvals           FOR SHARE, ORDER BY approver
--   6  the destination subsystem, in ITS canonical order:
--        public.public_world_state                    FOR UPDATE
--        public.public_experiences                    FOR UPDATE
--   7  the I-06C writes
--
-- Replay is ALWAYS the first lock. No predecessor Public or Shared writer takes
-- a Replay lock, so no I-06C path can be the second edge of a cycle, and no path
-- inverts source or Public before Replay. Every source lock is a SHARE lock. No
-- advisory lock, table lock or process mutex exists anywhere here.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- No encoder, codec, container, bitrate, resolution, frame rate, storage
-- provider, CDN, public file URL, email / SMS / social transport, watermark or
-- DRM; no Safety, moderation, entitlement, feature-flag or Launch Gate runtime;
-- no second Public World, second Public visibility truth or second Public
-- publication record; no post-distribution source-loss consequence, external
-- recall or mandatory Public withdrawal (I-06D); no route, controller, RPC or
-- mobile surface; no mutation of any Personal, Shared, historical or Replay
-- truth relation. It alters no predecessor table. The ONE predecessor object it
-- replaces is the canonical Public authority derivation, additively, through the
-- repository's canonical forward method - migrations 0001-0104 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE DURABLE COMMAND HISTORY.
--
--    One narrow relation per command family, never a generic event engine, in
--    exact parity with the frozen I-06A / I-06B families. Each row is the
--    idempotency key AND the exact committed answer: an equivalent retry is
--    served from here rather than by re-reading current state, so a later source
--    loss, withdrawal or authority change never makes a historical command
--    answer differently. `request_ref` binds the WHOLE immutable request.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_distribution_prepare_commands (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    distribution_package_version_id uuid NOT NULL,
    destination_action text NOT NULL,
    required_approver_count integer NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT replay_distribution_prepare_commands_pk PRIMARY KEY (id),
    CONSTRAINT replay_distribution_prepare_commands_package_key UNIQUE (distribution_package_version_id),
    CONSTRAINT replay_distribution_prepare_commands_count_check CHECK (required_approver_count >= 0),
    CONSTRAINT replay_distribution_prepare_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    -- The actor is the exact Replay creator, structurally, through the 0100 key.
    CONSTRAINT replay_distribution_prepare_commands_creator_fk
        FOREIGN KEY (replay_id, actor_user_id)
        REFERENCES public.replays (id, created_by_user_id) ON DELETE RESTRICT,
    CONSTRAINT replay_distribution_prepare_commands_package_fk
        FOREIGN KEY (distribution_package_version_id, destination_action)
        REFERENCES public.replay_distribution_package_versions (id, destination_action) ON DELETE RESTRICT
);

CREATE INDEX replay_distribution_prepare_commands_replay_idx
    ON public.replay_distribution_prepare_commands (replay_id, committed_at);

CREATE TABLE public.replay_distribution_withdrawal_commands (
    id uuid NOT NULL,
    approval_id uuid NOT NULL,
    distribution_package_version_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT replay_distribution_withdrawal_commands_pk PRIMARY KEY (id),
    CONSTRAINT replay_distribution_withdrawal_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    -- The approval, its package and its actor are ONE exact row of the immutable
    -- evidence: the actor IS the approver of the exact approval named.
    CONSTRAINT replay_distribution_withdrawal_commands_approval_fk
        FOREIGN KEY (approval_id, distribution_package_version_id, actor_user_id)
        REFERENCES public.replay_distribution_approvals (id, distribution_package_version_id, approver_user_id)
        ON DELETE RESTRICT
);

CREATE INDEX replay_distribution_withdrawal_commands_approval_idx
    ON public.replay_distribution_withdrawal_commands (approval_id);

CREATE TABLE public.replay_distribution_authorization_commands (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    distribution_package_version_id uuid NOT NULL,
    destination_action text NOT NULL,
    effective_approval_count integer NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT replay_distribution_authorization_commands_pk PRIMARY KEY (id),
    -- One committed authorization per exact package: two competing commands can
    -- never both commit even if every procedural check were somehow bypassed.
    CONSTRAINT replay_distribution_authorization_commands_package_key
        UNIQUE (distribution_package_version_id),
    CONSTRAINT replay_distribution_authorization_commands_count_check
        CHECK (effective_approval_count >= 0),
    CONSTRAINT replay_distribution_authorization_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT replay_distribution_authorization_commands_creator_fk
        FOREIGN KEY (replay_id, actor_user_id)
        REFERENCES public.replays (id, created_by_user_id) ON DELETE RESTRICT,
    CONSTRAINT replay_distribution_authorization_commands_record_fk
        FOREIGN KEY (distribution_package_version_id)
        REFERENCES public.replay_distribution_authorizations (distribution_package_version_id)
        ON DELETE RESTRICT,
    CONSTRAINT replay_distribution_authorization_commands_package_fk
        FOREIGN KEY (distribution_package_version_id, destination_action)
        REFERENCES public.replay_distribution_package_versions (id, destination_action) ON DELETE RESTRICT
);

CREATE INDEX replay_distribution_authorization_commands_replay_idx
    ON public.replay_distribution_authorization_commands (replay_id, committed_at);

ALTER TABLE public.replay_distribution_prepare_commands OWNER TO postgres;
ALTER TABLE public.replay_distribution_withdrawal_commands OWNER TO postgres;
ALTER TABLE public.replay_distribution_authorization_commands OWNER TO postgres;
ALTER TABLE public.replay_distribution_prepare_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_distribution_withdrawal_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_distribution_authorization_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.replay_distribution_prepare_commands,
                    public.replay_distribution_withdrawal_commands,
                    public.replay_distribution_authorization_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.replay_distribution_prepare_commands, public.replay_distribution_withdrawal_commands, public.replay_distribution_authorization_commands FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 2. THE ONE ANALYTICAL-LAYER DISTRIBUTION AUTHORITY SEAM.
--
--    The single place this runtime asks what human authority the represented
--    QANDEEL analytical projection carries. It is STABLE, reads only canonical
--    truth, writes nothing, decides nothing about the actor and is executable by
--    nobody.
--
--    THE CENSUS IT ENCODES. CW2-02 derives a redistributable QANDEEL analysis's
--    AUTHORITY_REQUIREMENT_SET from the protected human material AND the
--    SUBJECTS actually implicated. Migration 0090 states the canonical finding
--    for the first time in this repository: the material half is computable and
--    the SUBJECT half is not, because no reviewed server-owned producer of a
--    protected-human subject authority exists - the whole I-03 chain terminates
--    at NOT_GRANTED / SEALED and produces no protected-subject authority set at
--    all. So 0090 records reasoning-bearing QANDEEL material as
--    UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT and 0093 refuses Personal QANDEEL
--    analysis for publication on the same ground.
--
--    An I-06B analytical projection is reasoning of exactly that kind. Its
--    digest commits Readings, reading relations, evidence participations,
--    Materials, Gaps, Questions, question appearances, Confidences, Threads and
--    focuses - QANDEEL's understanding, not the creator's own words. That every
--    family is owner-scoped to the creator proves no OTHER HUMAN'S ROW can enter
--    it; it does not prove that no other human is a SUBJECT of it, and the
--    repository's own canonical position is that the second question is not
--    answerable here. Answering it anyway would be inventing Product logic.
--
--    So the only truthful answer today is UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT
--    and preparation fails closed. A later reviewed subject-authority resolver
--    replaces this body forward and the same package shape becomes reachable
--    with no change to migration 0104 and none to the primitives below.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_replay_analytical_distribution_authority_v1(
  p_analytical_projection_version_id uuid
) RETURNS TABLE(resolution_state text, required_approvers uuid[], resolution_basis text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_analytical_projection_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY SELECT 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'::text, NULL::uuid[],
    'The protected-human SUBJECT authority of a QANDEEL analytical projection has no reviewed server-owned producer in this repository; unresolved never means approval-free'::text;
END$$;

ALTER FUNCTION public.resolve_replay_analytical_distribution_authority_v1(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.resolve_replay_analytical_distribution_authority_v1(uuid) IS
  'The ONE analytical-layer distribution authority seam. At this baseline it '
  'answers UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT, which fails Replay '
  'distribution package preparation closed, because the protected-human SUBJECT '
  'half of a QANDEEL analysis AUTHORITY_REQUIREMENT_SET has no canonical '
  'producer here. It is never reinterpreted as zero approvers.';

-- ---------------------------------------------------------------------------
-- 3. THE CW2-08 PREREQUISITE SEAM FOR A REPLAY DISTRIBUTION.
--
--    The ONE place the distribution commit asks whether System / Safety policy,
--    moderation, commercial entitlement, the feature gate and the Launch Gate
--    clear this exact package for this exact destination. Each dimension is
--    answered separately so no layer can manufacture another, and today the only
--    truthful answer on every one of them is NOT_EVALUATED - which fails the
--    distribution closed. It is STABLE, reads nothing, decides nothing and is
--    executable by nobody.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_replay_distribution_prerequisites_v1(
  p_distribution_package_version_id uuid, p_destination_action text
) RETURNS TABLE(clearance text, safety_state text, moderation_state text, entitlement_state text,
                feature_state text, launch_state text, clearance_basis text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_distribution_package_version_id IS NULL OR p_destination_action IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY SELECT 'NOT_EVALUATED'::text, 'NOT_EVALUATED'::text, 'NOT_EVALUATED'::text,
    'NOT_EVALUATED'::text, 'NOT_EVALUATED'::text, 'NOT_EVALUATED'::text,
    'CW2-08 System / Safety policy, moderation, commercial entitlement, the feature gate and the Launch Gate have no executable canonical runtime in this repository; Replay distribution fails closed'::text;
END$$;

ALTER FUNCTION public.resolve_replay_distribution_prerequisites_v1(uuid, text) OWNER TO postgres;

COMMENT ON FUNCTION public.resolve_replay_distribution_prerequisites_v1(uuid, text) IS
  'The ONE CW2-08 prerequisite seam for a Replay distribution. Every dimension '
  'is answered separately and every one is NOT_EVALUATED at this baseline, so a '
  'protected distribution commit fails closed. No dimension is ever inferred '
  'from another and none is accepted from a caller.';

-- ---------------------------------------------------------------------------
-- 4. EXPORT_PRIVACY_SANITIZATION.
--
--    The digest of the WHOLE audience-visible surface, over the sanitized values
--    and NOTHING else. No internal identity of any kind reaches it - not the
--    Replay, not the Replay Version, not the manifest, selection, projection or
--    render contract, and not the package - because a digest is bound into the
--    Public package item and the authority fingerprint, and a digest computed
--    over private identifiers would be a private identifier with extra steps.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.replay_export_descriptor_digest_v1(
  p_destination_action text, p_audience_safe_reference text, p_sanitization_contract_id text,
  p_coverage_class text, p_selected_segment_count integer, p_temporal_gap_count integer,
  p_source_medium_class text, p_original_medium_policy text, p_exact_text_policy text,
  p_semantic_cut_policy text, p_temporal_gap_policy text, p_timing_integrity_policy text,
  p_analytical_projection_policy text, p_camera_emphasis_policy text, p_motion_policy text,
  p_caption_policy text, p_accessibility_parity_policy text, p_reduced_motion_parity_policy text,
  p_editorial_annotation_policy text
) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT 'sha256:' || encode(sha256(convert_to(
       p_sanitization_contract_id || E'\n'
    || 'destination=' || p_destination_action || E'\n'
    || 'reference=' || p_audience_safe_reference || E'\n'
    || 'coverage=' || p_coverage_class || E'\n'
    || 'segments=' || p_selected_segment_count::text || E'\n'
    || 'gaps=' || p_temporal_gap_count::text || E'\n'
    || 'sourceMediumClass=' || p_source_medium_class || E'\n'
    || 'originalMedium=' || p_original_medium_policy || E'\n'
    || 'exactText=' || p_exact_text_policy || E'\n'
    || 'semanticCut=' || p_semantic_cut_policy || E'\n'
    || 'temporalGap=' || p_temporal_gap_policy || E'\n'
    || 'timingIntegrity=' || p_timing_integrity_policy || E'\n'
    || 'analyticalProjection=' || p_analytical_projection_policy || E'\n'
    || 'cameraEmphasis=' || p_camera_emphasis_policy || E'\n'
    || 'motion=' || p_motion_policy || E'\n'
    || 'caption=' || p_caption_policy || E'\n'
    || 'accessibilityParity=' || p_accessibility_parity_policy || E'\n'
    || 'reducedMotionParity=' || p_reduced_motion_parity_policy || E'\n'
    || 'editorialAnnotation=' || p_editorial_annotation_policy, 'UTF8')), 'hex')
$$;

ALTER FUNCTION public.replay_export_descriptor_digest_v1(
  text, text, text, text, integer, integer, text, text, text, text, text, text, text, text, text,
  text, text, text, text) OWNER TO postgres;

-- THE SANITIZER ITSELF: the exact audience-visible surface of ONE exact Replay
-- Version, derived from the immutable selection spec and the immutable render
-- contract that version binds, and from nothing a caller said.
--
-- It is a POSITIVE ALLOWLIST. Every value it produces is either the opaque
-- reference it was handed, a safe derived count, or a policy value the frozen
-- render contract already pinned. It reads no body relation, no sealed
-- provenance, no source manifest item, no Session, World, material, history item
-- or package item, and it produces no identity of any of them - so there is no
-- private identifier for the caller to strip and none to forget to strip.
--
-- Deterministic by construction: the Replay Version and everything it binds are
-- append-only, so re-deriving at distribution time reproduces the exact digest
-- the package was approved against, and a mismatch is a refusal rather than a
-- silently different export.
CREATE FUNCTION public.derive_replay_export_descriptor_v1(
  p_replay_version_id uuid, p_destination_action text, p_audience_safe_reference text
) RETURNS TABLE(coverage_class text, selected_segment_count integer, temporal_gap_count integer,
                source_medium_class text, original_medium_policy text, exact_text_policy text,
                semantic_cut_policy text, temporal_gap_policy text, timing_integrity_policy text,
                analytical_projection_policy text, camera_emphasis_policy text, motion_policy text,
                caption_policy text, accessibility_parity_policy text, reduced_motion_parity_policy text,
                editorial_annotation_policy text, descriptor_digest text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  safe record;
BEGIN
  IF p_replay_version_id IS NULL OR p_destination_action IS NULL
     OR p_audience_safe_reference IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT sp.coverage_class AS coverage, sp.selected_item_count AS segments,
         rc.discontinuity_count AS gaps, rc.source_medium_class AS medium,
         rc.original_medium_policy AS original, rc.source_text_policy AS exact_text,
         rc.semantic_cut_policy AS cut, rc.temporal_discontinuity_policy AS gap_policy,
         rc.timing_integrity_policy AS timing, rc.analytical_projection_policy AS projection,
         rc.camera_emphasis_policy AS camera, rc.motion_policy AS motion,
         rc.caption_provenance_policy AS caption, rc.accessibility_parity_policy AS accessibility,
         rc.reduced_motion_parity_policy AS reduced_motion,
         rc.editorial_annotation_policy AS editorial
    INTO safe
    FROM public.replay_versions rv
    JOIN public.replay_selection_spec_versions sp ON sp.id = rv.selection_spec_version_id
    JOIN public.replay_render_contract_versions rc ON rc.id = rv.render_contract_version_id
   WHERE rv.id = p_replay_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  RETURN QUERY SELECT safe.coverage, safe.segments, safe.gaps, safe.medium, safe.original,
    safe.exact_text, safe.cut, safe.gap_policy, safe.timing, safe.projection, safe.camera,
    safe.motion, safe.caption, safe.accessibility, safe.reduced_motion, safe.editorial,
    public.replay_export_descriptor_digest_v1(
      p_destination_action, p_audience_safe_reference, 'QANDEEL_REPLAY_EXPORT_SANITIZATION_V1',
      safe.coverage, safe.segments, safe.gaps, safe.medium, safe.original, safe.exact_text,
      safe.cut, safe.gap_policy, safe.timing, safe.projection, safe.camera, safe.motion,
      safe.caption, safe.accessibility, safe.reduced_motion, safe.editorial);
END$$;

ALTER FUNCTION public.derive_replay_export_descriptor_v1(uuid, text, text) OWNER TO postgres;

COMMENT ON FUNCTION public.derive_replay_export_descriptor_v1(uuid, text, text) IS
  'EXPORT_PRIVACY_SANITIZATION as a positive allowlist: the exact '
  'audience-visible surface of one exact Replay Version, derived from its own '
  'immutable selection spec and render contract. It produces no World, Session, '
  'account, participant, source, material, history item, package item, path, '
  'URL, storage handle, audio reference or transcript - a client cannot author '
  'any part of it, and there is nothing private to forget to strip.';

-- ---------------------------------------------------------------------------
-- 5. THE ONE AUTHORITY REQUEST FINGERPRINT.
--
--    What makes ONE human consent specific to ONE payload. Preparation, approval,
--    the effective-state evaluation and the distribution commit all derive it the
--    same way, so it cannot drift between them, and it is derived from canonical
--    truth rather than supplied - there is no fingerprint parameter on any human
--    primitive below.
--
--    It binds the protected action, the exact Replay and Replay Version, the
--    exact package, the exact four truth components and their committed digests,
--    the sanitization contract and the sanitized descriptor digest, both halves
--    of the authority resolution, the exact derived approver set, and - for a
--    Public destination - the exact linked Public manifest. So a changed package,
--    destination, required set, sanitized surface or linked Public package stales
--    every approval bound to the old value instead of quietly authorizing a
--    different payload. It is not a bearer token: it authorizes nothing by itself
--    and is never accepted as input.
--
--    IT BINDS THE LINKED PUBLIC MANIFEST IDENTITY AND NOT THE PUBLIC
--    FINGERPRINT, deliberately. The canonical Public fingerprint already binds
--    this exact Replay distribution package and Replay Version (through the
--    source scope) and this exact required approver set, so including it here
--    would be a cycle rather than a stronger binding: each would have to be
--    computed from the other. The pair is bound both ways instead - the Replay
--    fingerprint names the Public manifest, the Public fingerprint names the
--    Replay package - and the distribution commit requires BOTH sides to still
--    hold, the Public side through the canonical publish boundary's own gates.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.replay_distribution_authority_fingerprint_v1(
  p_destination_action text, p_replay_id uuid, p_replay_version_id uuid,
  p_distribution_package_version_id uuid, p_source_manifest_version_id uuid,
  p_selection_spec_version_id uuid, p_analytical_projection_version_id uuid,
  p_projection_digest text, p_render_contract_version_id uuid, p_contract_digest text,
  p_sanitization_contract_id text, p_descriptor_digest text,
  p_source_authority_resolution text, p_analytical_authority_resolution text,
  p_authority_requirement_state text, p_required_approvers uuid[],
  p_linked_public_manifest_version_id uuid
) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT 'sha256:' || encode(sha256(convert_to(
       'QANDEEL_CWV2_REPLAY_DISTRIBUTION_AUTHORITY_REQUEST_V1' || E'\n'
    || 'action=' || p_destination_action || E'\n'
    || 'replay=' || lower(p_replay_id::text) || E'\n'
    || 'replayVersion=' || lower(p_replay_version_id::text) || E'\n'
    || 'package=' || lower(p_distribution_package_version_id::text) || E'\n'
    || 'manifest=' || lower(p_source_manifest_version_id::text) || E'\n'
    || 'selection=' || lower(p_selection_spec_version_id::text) || E'\n'
    || 'projection=' || lower(p_analytical_projection_version_id::text) || E'\n'
    || 'projectionDigest=' || p_projection_digest || E'\n'
    || 'renderContract=' || lower(p_render_contract_version_id::text) || E'\n'
    || 'contractDigest=' || p_contract_digest || E'\n'
    || 'sanitization=' || p_sanitization_contract_id || E'\n'
    || 'descriptorDigest=' || p_descriptor_digest || E'\n'
    || 'sourceAuthority=' || p_source_authority_resolution || E'\n'
    || 'analyticalAuthority=' || p_analytical_authority_resolution || E'\n'
    || 'authorityState=' || p_authority_requirement_state || E'\n'
    || 'requiredApprovers=' || coalesce((SELECT string_agg(lower(a::text), ',' ORDER BY lower(a::text) COLLATE "C")
                                           FROM unnest(p_required_approvers) a), '') || E'\n'
    || 'publicManifest=' || coalesce(lower(p_linked_public_manifest_version_id::text), 'NONE'), 'UTF8')), 'hex')
$$;

ALTER FUNCTION public.replay_distribution_authority_fingerprint_v1(
  text, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, text, text, text, uuid[],
  uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 6. THE ONE REQUIRED-APPROVER DERIVATION.
--
--    Read-only, STABLE, takes no lock: a caller that needs a stable answer holds
--    the Replay and the source, exactly as the frozen I-06A currency derivation
--    and the frozen I-05A authority derivation document.
--
--    It answers, for ONE exact complete Replay Version, what the exact union of
--    human authorities of the material that version carries currently is - and
--    FAILS CLOSED rather than returning a partial answer. It is the only place
--    the two halves are decided:
--
--    SOURCE MATERIAL. A MY_WORLD manifest binds the creating human's own Session
--    through the frozen 0100 identity key, so the human material authority of
--    every included committed unit is the creator, exactly and only. A unit whose
--    source role is not the human's own is QANDEEL-authored Personal analysis,
--    and migration 0093 already records the canonical finding that its exact
--    protected-human authority requirement is NOT resolvable from current
--    reviewed repository truth: it fails closed here for the same reason and with
--    its own bounded class, never as an empty requirement.
--
--    ANALYTICAL MATERIAL. Delegated whole to the ONE analytical seam above. Any
--    answer but the two RESOLVED states fails the whole derivation closed.
--
--    There is no SHARED_WORLD or PUBLIC_EXPERIENCE branch, and that is a census
--    result rather than an omission: a complete REPLAY_VERSION requires an
--    ANALYTICAL_PROJECTION_VERSION, whose capability is CHECK-pinned to a
--    MY_WORLD manifest, so no Shared or Public Replay can reach FINALIZED at
--    this baseline and a distribution package over one is unrepresentable
--    (migration 0104, `..._class_check` and `..._class_fk`). Writing an approver
--    derivation for a subject that cannot exist would be unreachable code
--    claiming to protect something. When a later reviewed slice gives those
--    classes an analytical capability, it adds the branch with its own proofs and
--    consumes `shared_world_history_item_required_approvers` and
--    `shared_world_material_historical_authority` exactly as I-05A does.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_replay_distribution_required_approvers_v1(p_replay_version_id uuid)
RETURNS TABLE(source_authority_resolution text, analytical_authority_resolution text,
              authority_requirement_state text, required_approvers uuid[],
              required_approver_count integer)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  version public.replay_versions;
  manifest public.replay_source_manifest_versions;
  creator uuid;
  analytical record;
  source_state text;
  approvers uuid[];
BEGIN
  IF p_replay_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT v.* INTO version FROM public.replay_versions v WHERE v.id = p_replay_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT m.* INTO manifest FROM public.replay_source_manifest_versions m
   WHERE m.id = version.source_manifest_version_id;
  IF NOT FOUND OR manifest.source_class <> 'MY_WORLD' OR manifest.personal_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  SELECT r.created_by_user_id INTO creator FROM public.replays r WHERE r.id = version.replay_id;
  IF NOT FOUND OR creator IS DISTINCT FROM manifest.personal_owner_user_id THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- THE SOURCE HALF. Every SELECTED item of the exact selection this version
  -- binds, and only the selected ones: a manifest may capture more than a
  -- selection distributes, and authority follows what is actually included.
  IF EXISTS (
    SELECT 1 FROM public.replay_selection_spec_items si
      JOIN public.replay_source_manifest_items mi
        ON mi.manifest_version_id = si.source_manifest_version_id
       AND mi.source_item_ordinal = si.source_item_ordinal
     WHERE si.selection_spec_version_id = version.selection_spec_version_id
       AND (mi.personal_conversation_unit_id IS NULL OR mi.personal_source_role IS DISTINCT FROM 'USER')
  ) THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_SOURCE_AUTHORITY_UNRESOLVED' USING ERRCODE='55000',
      DETAIL='A distributed segment is QANDEEL-authored Personal material whose exact protected-human authority requirement is not resolvable from canonical truth; unresolved never means approval-free.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.replay_selection_spec_items si
     WHERE si.selection_spec_version_id = version.selection_spec_version_id
  ) THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  source_state := 'RESOLVED_EXACT_HUMAN_REQUIREMENT';
  approvers := ARRAY[creator];

  -- THE ANALYTICAL HALF, delegated whole to the ONE seam. Anything but a RESOLVED
  -- answer fails the derivation closed, and a RESOLVED_EXACT answer with no named
  -- human is contradictory rather than permissive.
  SELECT a.resolution_state, a.required_approvers INTO analytical
    FROM public.resolve_replay_analytical_distribution_authority_v1(version.analytical_projection_version_id) a;
  IF NOT FOUND OR analytical.resolution_state NOT IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT',
                                                      'RESOLVED_NO_HUMAN_REQUIREMENT') THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_ANALYTICAL_AUTHORITY_UNRESOLVED' USING ERRCODE='55000',
      DETAIL='The exact human authority requirement of the represented QANDEEL analytical projection is not derivable from canonical truth; a Replay distribution package may not be prepared over it.';
  END IF;
  IF analytical.resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT'
     AND coalesce(cardinality(analytical.required_approvers), 0) = 0 THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001',
      DETAIL='An exact analytical human requirement that names nobody is contradictory metadata, never an empty requirement.';
  END IF;
  IF analytical.resolution_state = 'RESOLVED_NO_HUMAN_REQUIREMENT'
     AND coalesce(cardinality(analytical.required_approvers), 0) <> 0 THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001',
      DETAIL='An empty analytical human requirement that still names approvers is contradictory metadata.';
  END IF;

  SELECT coalesce(array_agg(DISTINCT x ORDER BY x), ARRAY[]::uuid[]) INTO approvers
    FROM unnest(approvers || coalesce(analytical.required_approvers, ARRAY[]::uuid[])) x;

  RETURN QUERY SELECT source_state, analytical.resolution_state,
    CASE WHEN cardinality(approvers) > 0 THEN 'RESOLVED_EXACT_HUMAN_REQUIREMENT'
         ELSE 'RESOLVED_NO_HUMAN_REQUIREMENT' END,
    approvers, cardinality(approvers);
END$$;

ALTER FUNCTION public.derive_replay_distribution_required_approvers_v1(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.derive_replay_distribution_required_approvers_v1(uuid) IS
  'The ONE REQUIRED_REPLAY_DISTRIBUTION_APPROVER_SET derivation: the exact union '
  'of the human authorities of the protected material and the analytical '
  'material actually included in one exact Replay Version. It reads no World '
  'membership of any kind, accepts no approver parameter, and fails closed on '
  'unresolved or contradictory authority rather than answering an empty set.';

-- ---------------------------------------------------------------------------
-- 7. THE ONE PACKAGE AUTHORITY DERIVATION.
--
--    The same truth as section 6, asked of an EXISTING package and carried
--    through to the fingerprint every approval binds. Approval, the effective
--    state evaluation and the distribution commit all call this one, so there is
--    exactly one derivation of Replay distribution authority and it cannot drift.
--
--    It re-derives the required set from CURRENT canonical truth rather than
--    reading the stored one, so that the commit can compare the two and refuse a
--    package whose authority moved after preparation. It fails closed on every
--    raise of what it consumes, and it takes no lock: its callers hold them.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_replay_distribution_authority_v1(p_distribution_package_version_id uuid)
RETURNS TABLE(authority_requirement_state text, required_approvers uuid[],
              required_approver_count integer, authority_fingerprint text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  package public.replay_distribution_package_versions;
  version public.replay_versions;
  projection_digest text;
  contract_digest text;
  descriptor text;
  derived record;
  linked_manifest uuid;
BEGIN
  IF p_distribution_package_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT p.* INTO package FROM public.replay_distribution_package_versions p
   WHERE p.id = p_distribution_package_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT v.* INTO version FROM public.replay_versions v WHERE v.id = package.replay_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  SELECT pv.projection_digest INTO projection_digest
    FROM public.replay_analytical_projection_versions pv
   WHERE pv.id = version.analytical_projection_version_id;
  SELECT rc.contract_digest INTO contract_digest
    FROM public.replay_render_contract_versions rc WHERE rc.id = version.render_contract_version_id;
  IF projection_digest IS NULL OR contract_digest IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- The sanitized surface, RE-DERIVED rather than read back, so a stored
  -- descriptor that no longer matches the Replay Version it claims cannot carry
  -- a consent forward.
  SELECT d.descriptor_digest INTO descriptor
    FROM public.derive_replay_export_descriptor_v1(
           package.replay_version_id, package.destination_action, package.audience_safe_reference) d;

  -- The linked Public package, when this destination has one: its exact manifest
  -- identity is part of the Replay fingerprint, so a Replay consent can never be
  -- carried onto a different Public package.
  SELECT a.public_manifest_version_id INTO linked_manifest
    FROM public.replay_public_distribution_artifacts a
   WHERE a.distribution_package_version_id = package.id;

  SELECT * INTO derived
    FROM public.derive_replay_distribution_required_approvers_v1(package.replay_version_id);

  RETURN QUERY SELECT derived.authority_requirement_state, derived.required_approvers,
    derived.required_approver_count,
    public.replay_distribution_authority_fingerprint_v1(
      package.destination_action, package.replay_id, package.replay_version_id, package.id,
      version.source_manifest_version_id, version.selection_spec_version_id,
      version.analytical_projection_version_id, projection_digest,
      version.render_contract_version_id, contract_digest,
      package.sanitization_contract_id, descriptor,
      derived.source_authority_resolution, derived.analytical_authority_resolution,
      derived.authority_requirement_state, derived.required_approvers, linked_manifest);
END$$;

ALTER FUNCTION public.derive_replay_distribution_authority_v1(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 8. EFFECTIVE APPROVAL STATE.
--
--    Read-only, STABLE, and the only place the vocabulary is decided. For ONE
--    exact approval, from current state:
--
--      WITHDRAWN    a withdrawal event exists. A human act dominates every
--                   structural fact, so it is reported first.
--      SUPERSEDED   the approval binds an authority fingerprint that is not the
--                   one its own immutable package recorded. The primitives below
--                   cannot produce that, and it is answered anyway: defence in
--                   depth, exactly as the frozen I-06A currency derivation
--                   refuses a contradictory binding it also makes unrepresentable.
--      EFFECTIVE    neither.
--
--    Zero rows for an approval that does not exist and for a NULL identifier: the
--    package-level view joins this LATERALLY over a LEFT JOIN, so a required
--    human who never approved reaches it with NULL, and a derivation that raised
--    there would turn "no approval was ever given" into an error instead of the
--    truthful MISSING. It is not an existence oracle.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_replay_distribution_approval_effective_state_v1(p_approval_id uuid)
RETURNS TABLE(approval_id uuid, approved_distribution_package_version_id uuid, approving_user_id uuid,
              effective_state text, bound_authority_fingerprint text, withdrawn_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_approval_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT a.id, a.distribution_package_version_id, a.approver_user_id,
         CASE WHEN w.id IS NOT NULL THEN 'WITHDRAWN'
              WHEN a.bound_authority_fingerprint IS DISTINCT FROM p.authority_request_fingerprint
                THEN 'SUPERSEDED'
              ELSE 'EFFECTIVE' END::text,
         a.bound_authority_fingerprint, w.occurred_at
    FROM public.replay_distribution_approvals a
    JOIN public.replay_distribution_package_versions p ON p.id = a.distribution_package_version_id
    LEFT JOIN public.replay_distribution_approval_withdrawal_events w ON w.approval_id = a.id
   WHERE a.id = p_approval_id;
END$$;

ALTER FUNCTION public.derive_replay_distribution_approval_effective_state_v1(uuid) OWNER TO postgres;

-- One row per human the exact package REQUIRES, carrying the effective state of
-- that human's approval - or MISSING when no approval row exists at all. This is
-- what the distribution commit consumes: it never counts approval rows, it reads
-- effective states, and MISSING / WITHDRAWN / SUPERSEDED each refuse.
CREATE FUNCTION public.derive_replay_distribution_effective_approvals_v1(
  p_distribution_package_version_id uuid
) RETURNS TABLE(approving_user_id uuid, approval_id uuid, effective_state text,
                bound_authority_fingerprint text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_distribution_package_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT ra.approver_user_id, a.id, coalesce(s.effective_state, 'MISSING')::text,
         s.bound_authority_fingerprint
    FROM public.replay_distribution_required_approvers ra
    LEFT JOIN public.replay_distribution_approvals a
      ON a.distribution_package_version_id = ra.distribution_package_version_id
     AND a.approver_user_id = ra.approver_user_id
    LEFT JOIN LATERAL public.derive_replay_distribution_approval_effective_state_v1(a.id) s
      ON a.id IS NOT NULL
   WHERE ra.distribution_package_version_id = p_distribution_package_version_id
   ORDER BY ra.approver_user_id;
END$$;

ALTER FUNCTION public.derive_replay_distribution_effective_approvals_v1(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 9. THE CANONICAL PUBLIC AUTHORITY DERIVATION, EXTENDED ADDITIVELY.
--
--    `derive_public_publication_authority_v1` remains the ONE derivation of
--    publication authority in the Public domain, with the identical signature,
--    the identical result columns and every rule it already had. Migration 0093
--    is NOT edited: this is the repository's canonical forward method, a
--    CREATE OR REPLACE in a later migration, exactly as migration 0098 extended
--    the canonical visibility derivation.
--
--    WHY IT MUST BE EXTENDED RATHER THAN DUPLICATED. I-05A reserved
--    `source_class = 'REPLAY_ARTIFACT'` on the sealed provenance with no producer,
--    so the union below and the source scope simply had no branch for it. The
--    moment I-06C gives that class a producer, an unextended derivation would
--    answer "this Public package requires ZERO humans" for a package whose whole
--    payload is a Replay - which is precisely the reinterpretation of an
--    unresolved requirement as an empty one that the frozen rule forbids, and it
--    would become reachable for real the day a CW2-08 runtime lands. So the
--    branch closes it in BOTH directions:
--
--      an unbridged REPLAY_ARTIFACT item   PUBLIC_EXPERIENCE_SOURCE_AUTHORITY
--                                          _UNRESOLVED, the frozen class for
--                                          exactly this situation
--      a bridged one                       contributes the EXACT required
--                                          approver set of its Replay
--                                          distribution package, and its exact
--                                          package and Replay Version identity
--                                          to the source scope
--
--    Nothing else changes. The Personal and Shared halves, the availability and
--    integrity revalidation, the unresolved and contradictory refusals and the
--    fingerprint composition are carried over unchanged, and the scope token
--    stays inside a one-way digest and reaches no surface.
-- ---------------------------------------------------------------------------
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
  -- Replay distribution package derived, and nothing else.
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

ALTER FUNCTION public.derive_public_publication_authority_v1(uuid) OWNER TO postgres;

-- Replacing a function preserves its ACL, but the revoke is re-stated rather
-- than assumed, for the reason every predecessor states one: an invariant nobody
-- verifies is an invariant nobody notices losing.
DO $$BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.derive_public_publication_authority_v1(uuid) FROM PUBLIC, anon, authenticated';
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.derive_public_publication_authority_v1(uuid) FROM service_role';
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 10. THE INTERNAL PUBLIC BRIDGE CORE.
--
--     Called only by the preparation primitive, which already holds the Replay,
--     the Public World singleton and the exact Experience. It creates the
--     bounded Public package of ONE Replay artifact under the CANONICAL Public
--     runtime - the same manifest, version, item, sealed provenance, per-item
--     authority and rightsholder relations every Public package uses - and adds
--     the narrow bridge row that binds it to the exact Replay distribution
--     package.
--
--     WHAT THE PUBLIC PACKAGE STORES. The item's public body form is the
--     RESERVED form I-05A defined for a source class with no text derivative, so
--     there is no public body row and the canonical text-serving resolver has
--     nothing to serve - which is correct: a Replay artifact is not public text.
--     Its `public_body_digest` is the SANITIZED DESCRIPTOR digest, which is a
--     one-way digest of the audience-visible surface and of no source. Its sealed
--     provenance row is the reserved REPLAY_ARTIFACT shape: every source
--     identifier column NULL, because a Replay artifact's provenance is the
--     Replay distribution package and that binding lives in the bridge, sealed,
--     never in a public payload row.
--
--     WHAT IT DELIBERATELY DOES NOT WRITE. It writes no controller row - Public
--     Experience control is a different authority and is never granted by
--     content. It writes no approval - the ONE human consent act does that. It
--     writes no lifecycle event and no publication record - the canonical READY
--     and PUBLISH primitives own those and are not bypassed. And it writes no
--     `publication_package_prepare_commands` row, because that relation records
--     that `prepare_public_experience_manifest_v1` was CALLED, and it was not:
--     fabricating a command history for a command nobody issued would be false
--     history, and this slice's own command relation records what really happened.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.replay_prepare_public_distribution_artifact_v1(
  p_distribution_package_version_id uuid,
  p_public_experience_id uuid,
  p_public_manifest_version_id uuid,
  p_public_experience_version_id uuid,
  p_public_package_item_id uuid,
  p_prepare_instant timestamptz
) RETURNS TABLE(bound_public_manifest_version_id uuid, bound_public_experience_version_id uuid,
                bound_public_version_ordinal integer)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  package public.replay_distribution_package_versions;
  experience public.public_experiences;
  controller public.public_experience_controllers;
  descriptor public.replay_distribution_export_descriptors;
  approver_total integer;
  next_ordinal integer;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_distribution_package_version_id IS NULL OR p_public_experience_id IS NULL
     OR p_public_manifest_version_id IS NULL OR p_public_experience_version_id IS NULL
     OR p_public_package_item_id IS NULL OR p_prepare_instant IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT p.* INTO package FROM public.replay_distribution_package_versions p
    JOIN public.replays r ON r.id = p.replay_id
   WHERE p.id = p_distribution_package_version_id AND r.created_by_user_id = u;
  IF NOT FOUND OR package.destination_action <> 'PUBLISH_TO_PUBLIC_WORLD' THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  SELECT d.* INTO descriptor FROM public.replay_distribution_export_descriptors d
   WHERE d.distribution_package_version_id = package.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- THE EXACT EXPERIENCE CONTROLLER, and nobody else. A Replay creator who does
  -- not control the Experience reaches the ONE bounded class, so this path is not
  -- an Experience existence or control oracle either.
  SELECT e.* INTO experience FROM public.public_experiences e WHERE e.id = p_public_experience_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT c.* INTO controller FROM public.public_experience_controllers c
   WHERE c.experience_id = p_public_experience_id AND c.controller_user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- A package is prepared for a DRAFT Experience only, exactly as the canonical
  -- Public preparation requires: this slice owns no Public lifecycle transition.
  IF experience.current_lifecycle <> 'DRAFT' THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_PUBLIC_LIFECYCLE_INVALID' USING ERRCODE='55000',
      DETAIL='A Public Replay package is prepared for a DRAFT Public Experience; every Public lifecycle transition stays with the canonical Public primitives.';
  END IF;

  SELECT coalesce(max(v.version_ordinal), 0) + 1 INTO next_ordinal
    FROM public.public_experience_versions v WHERE v.experience_id = p_public_experience_id;

  INSERT INTO public.publication_package_manifest_versions
    (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
     intended_publication_action, target_audience_class, authority_readiness,
     prepared_authority_snapshot_version, item_count, created_at)
  SELECT p_public_manifest_version_id, p_public_experience_id, true,
         controller.controller_public_identity_ref, u,
         'PUBLISH_TO_PUBLIC_WORLD', 'PUBLIC_WORLD_AUDIENCE', 'PRIVACY_OWNERSHIP_AUTHORITY_ONLY',
         w.state_version, 1, p_prepare_instant
    FROM public.public_world_state w WHERE w.singleton;

  INSERT INTO public.public_experience_versions
    (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
  VALUES (p_public_experience_version_id, p_public_experience_id, p_public_manifest_version_id,
          next_ordinal, p_prepare_instant);

  -- The bounded public derivative of a Replay is its SANITIZED DESCRIPTOR, and
  -- the item says so: the RESERVED body form has no body relation at all.
  INSERT INTO public.publication_package_manifest_items
    (manifest_version_id, experience_id, package_item_id, item_ordinal,
     derivative_classification, public_body_form, public_body_digest)
  VALUES (p_public_manifest_version_id, p_public_experience_id, p_public_package_item_id, 1,
          'SOURCE_CONTENT_BEARING_DERIVATIVE', 'RESERVED', descriptor.descriptor_digest);

  -- The reserved sealed-provenance shape, activated: every source identifier
  -- column NULL, because a Replay artifact names its Replay distribution package
  -- and nothing else, and that binding belongs in the sealed bridge.
  INSERT INTO public.publication_package_item_provenance
    (package_item_id, manifest_version_id, source_class, personal_conversation_unit_id,
     personal_owner_user_id, shared_world_id, shared_material_id, shared_history_item_id,
     captured_availability_state, captured_availability_revision, captured_source_digest)
  VALUES (p_public_package_item_id, p_public_manifest_version_id, 'REPLAY_ARTIFACT', NULL, NULL,
          NULL, NULL, NULL, 'AVAILABLE', NULL, descriptor.descriptor_digest);

  -- THE BRIDGE: the exact Public item, its RESERVED form, its REPLAY_ARTIFACT
  -- provenance, its Experience and the exact Replay distribution package, each
  -- through ONE composite key.
  INSERT INTO public.replay_public_distribution_artifacts
    (package_item_id, public_manifest_version_id, public_experience_id, public_body_form,
     public_source_class, distribution_package_version_id, destination_action, replay_version_id,
     audience_safe_reference, created_at)
  VALUES (p_public_package_item_id, p_public_manifest_version_id, p_public_experience_id, 'RESERVED',
          'REPLAY_ARTIFACT', package.id, 'PUBLISH_TO_PUBLIC_WORLD', package.replay_version_id,
          package.audience_safe_reference, p_prepare_instant);

  -- The per-item authority mirrors the Replay package's own resolution exactly:
  -- only the two RESOLVED states are representable in either place, so an
  -- unresolved Replay authority could never have reached this point.
  SELECT count(*)::integer INTO approver_total
    FROM public.replay_distribution_required_approvers ra
   WHERE ra.distribution_package_version_id = package.id;
  INSERT INTO public.publication_package_item_authority
    (package_item_id, manifest_version_id, resolution_state, required_approver_count)
  VALUES (p_public_package_item_id, p_public_manifest_version_id,
          CASE WHEN approver_total > 0 THEN 'RESOLVED_EXACT_HUMAN_REQUIREMENT'
               ELSE 'RESOLVED_NO_HUMAN_REQUIREMENT' END, approver_total);

  -- THE CANONICAL PUBLIC RIGHTSHOLDER SET, from the ONE canonical derivation over
  -- the rows just written - which now reaches the bridge and therefore the exact
  -- Replay required set. It is never copied from a caller and never assumed.
  INSERT INTO public.publication_manifest_required_approvers (manifest_version_id, approver_user_id)
  SELECT p_public_manifest_version_id, a.approver
    FROM public.derive_public_publication_authority_v1(p_public_manifest_version_id) d
    CROSS JOIN LATERAL unnest(d.required_approvers) AS a(approver);

  -- The Experience moves forward one revision and points at the new prospective
  -- version. Its LIFECYCLE does not change: preparing widens no audience.
  UPDATE public.public_experiences e
     SET current_experience_version_id = p_public_experience_version_id,
         experience_revision = e.experience_revision + 1
   WHERE e.id = p_public_experience_id;

  RETURN QUERY SELECT p_public_manifest_version_id, p_public_experience_version_id, next_ordinal;
END$$;

ALTER FUNCTION public.replay_prepare_public_distribution_artifact_v1(
  uuid, uuid, uuid, uuid, uuid, timestamptz) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 11. PREPARE ONE REPLAY DISTRIBUTION PACKAGE.
--
--     PREPARE_REPLAY_DISTRIBUTION_PACKAGE. It binds one exact historically
--     FINALIZED Replay Version to one exact destination and NOTHING is
--     distributed: nothing is published, shared, downloaded, delivered or
--     cleared, no audience of any kind is widened, and a prepared package may
--     exist forever without ever being distributed.
--
--     The preparing human is exactly auth.uid() and must be the Replay creator.
--     The caller supplies opaque persistence identities and a destination, and no
--     actor, authority, approver, fingerprint, descriptor, sanitization result,
--     Safety, entitlement, feature, launch or clock parameter. ONE database clock
--     read serves every authoritative moment.
--
--     It fails closed, before writing anything, on: a Replay that is not the
--     caller's, a Replay Version that was never historically finalized, a bound
--     source that is no longer current, a source authority that is not resolvable
--     and an ANALYTICAL authority that is not resolvable - which is the state of
--     this repository, so production preparation fails closed today.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.prepare_replay_distribution_package_v1(
  p_command_id uuid,
  p_replay_id uuid,
  p_replay_version_id uuid,
  p_distribution_package_version_id uuid,
  p_destination_action text,
  p_public_experience_id uuid,
  p_public_manifest_version_id uuid,
  p_public_experience_version_id uuid,
  p_public_package_item_id uuid
) RETURNS TABLE(outcome text, committed_replay_id uuid, distribution_package_version_id uuid,
                destination_action text, package_revision integer,
                authority_requirement_state text, required_approver_count integer,
                audience_safe_reference text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.replay_distribution_prepare_commands;
  replay public.replays;
  version public.replay_versions;
  projection_digest text;
  contract_digest text;
  derived record;
  safe record;
  reference text;
  currency text;
  next_revision integer;
  fingerprint text;
  confirm record;
  stored uuid[];
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_replay_id IS NULL OR p_replay_version_id IS NULL
     OR p_distribution_package_version_id IS NULL OR p_destination_action IS NULL
     OR p_destination_action NOT IN ('PUBLISH_TO_PUBLIC_WORLD', 'SHARE_EXTERNALLY', 'DOWNLOAD')
     OR p_replay_id = p_replay_version_id OR p_replay_id = p_distribution_package_version_id
     OR p_replay_version_id = p_distribution_package_version_id THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- The Public identities are named WHOLE or not at all: either a Public
  -- destination with its exact Experience, manifest, version and item, or none of
  -- them and one of the two transport-free destinations.
  IF p_destination_action = 'PUBLISH_TO_PUBLIC_WORLD' THEN
    IF p_public_experience_id IS NULL OR p_public_manifest_version_id IS NULL
       OR p_public_experience_version_id IS NULL OR p_public_package_item_id IS NULL
       OR p_public_manifest_version_id = p_public_experience_version_id
       OR p_public_manifest_version_id = p_public_package_item_id
       OR p_public_experience_version_id = p_public_package_item_id THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
  ELSIF p_public_experience_id IS NOT NULL OR p_public_manifest_version_id IS NOT NULL
     OR p_public_experience_version_id IS NOT NULL OR p_public_package_item_id IS NOT NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_REPLAY_DISTRIBUTION_PREPARE_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'replay=' || lower(p_replay_id::text) || E'\n'
   || 'replayVersion=' || lower(p_replay_version_id::text) || E'\n'
   || 'package=' || lower(p_distribution_package_version_id::text) || E'\n'
   || 'destination=' || p_destination_action || E'\n'
   || 'publicExperience=' || coalesce(lower(p_public_experience_id::text), 'NONE') || E'\n'
   || 'publicManifest=' || coalesce(lower(p_public_manifest_version_id::text), 'NONE') || E'\n'
   || 'publicVersion=' || coalesce(lower(p_public_experience_version_id::text), 'NONE') || E'\n'
   || 'publicItem=' || coalesce(lower(p_public_package_item_id::text), 'NONE'), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, reading only immutable
  -- command history, so an equivalent retry answers even after the source moved.
  SELECT * INTO committed FROM public.replay_distribution_prepare_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY
      SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, committed.distribution_package_version_id,
             committed.destination_action, p.package_revision, p.authority_requirement_state,
             committed.required_approver_count, p.audience_safe_reference, committed.committed_at
        FROM public.replay_distribution_package_versions p
       WHERE p.id = committed.distribution_package_version_id;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the Replay. The exact creator, and nobody else
  -- - one bounded class for a stranger and a Replay that does not exist.
  SELECT * INTO replay FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE;
  IF NOT FOUND OR replay.created_by_user_id <> u THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the lock.
  SELECT * INTO committed FROM public.replay_distribution_prepare_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY
      SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, committed.distribution_package_version_id,
             committed.destination_action, p.package_revision, p.authority_requirement_state,
             committed.required_approver_count, p.audience_safe_reference, committed.committed_at
        FROM public.replay_distribution_package_versions p
       WHERE p.id = committed.distribution_package_version_id;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the exact complete Replay Version, and the
  -- HISTORICAL FINALIZATION EVIDENCE that names it. The stable Replay's CURRENT
  -- lifecycle is deliberately not consulted: I-06B may legitimately have reopened
  -- it to DRAFT, and that erases no finalization.
  SELECT v.* INTO version FROM public.replay_versions v
   WHERE v.id = p_replay_version_id AND v.replay_id = p_replay_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.replay_version_finalizations f
                  WHERE f.replay_version_id = p_replay_version_id AND f.replay_id = p_replay_id) THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_VERSION_NOT_FINALIZED' USING ERRCODE='55000',
      DETAIL='A distribution package binds a Replay Version that was historically FINALIZED; a preview-ready or draft composition is not a distributable artifact.';
  END IF;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of this preparation.
  instant := clock_timestamp();

  -- CANONICAL LOCK ORDER, STEP 3: the source, stabilized in its own domain's
  -- frozen order through the ONE I-06A helper and proven still current. No
  -- competing source-currency evaluator exists anywhere in this slice.
  PERFORM public.replay_lock_source_manifest_v1(version.source_manifest_version_id);
  SELECT c.currency_state INTO currency
    FROM public.derive_replay_source_manifest_currency_v1(version.source_manifest_version_id) c;
  IF currency IS DISTINCT FROM 'CURRENT' THEN
    RAISE EXCEPTION 'REPLAY_SOURCE_STALE' USING ERRCODE='40001',
      DETAIL='A bound source changed, became unavailable, is no longer visible to the creator or is no longer the eligible version; a distribution package cannot be prepared over it.';
  END IF;

  -- THE EXACT REQUIRED APPROVER SET, derived. Unresolved source authority and
  -- unresolved analytical authority each raise here, before any row is written.
  SELECT * INTO derived
    FROM public.derive_replay_distribution_required_approvers_v1(p_replay_version_id);

  SELECT pv.projection_digest INTO projection_digest
    FROM public.replay_analytical_projection_versions pv
   WHERE pv.id = version.analytical_projection_version_id;
  SELECT rc.contract_digest INTO contract_digest
    FROM public.replay_render_contract_versions rc WHERE rc.id = version.render_contract_version_id;

  -- THE OPAQUE AUDIENCE REFERENCE, minted at random and derived from nothing.
  reference := 'rdx1_' || replace(gen_random_uuid()::text, '-', '');
  SELECT * INTO safe FROM public.derive_replay_export_descriptor_v1(
    p_replay_version_id, p_destination_action, reference);

  SELECT coalesce(max(p.package_revision), 0) + 1 INTO next_revision
    FROM public.replay_distribution_package_versions p WHERE p.replay_id = p_replay_id;

  fingerprint := public.replay_distribution_authority_fingerprint_v1(
    p_destination_action, p_replay_id, p_replay_version_id, p_distribution_package_version_id,
    version.source_manifest_version_id, version.selection_spec_version_id,
    version.analytical_projection_version_id, projection_digest,
    version.render_contract_version_id, contract_digest,
    'QANDEEL_REPLAY_EXPORT_SANITIZATION_V1', safe.descriptor_digest,
    derived.source_authority_resolution, derived.analytical_authority_resolution,
    derived.authority_requirement_state, derived.required_approvers, p_public_manifest_version_id);

  BEGIN
    INSERT INTO public.replay_distribution_package_versions
      (id, replay_id, replay_version_id, source_manifest_version_id, source_class, destination_action,
       package_revision, authority_requirement_state, source_authority_resolution,
       analytical_authority_resolution, required_approver_count, authority_request_fingerprint,
       sanitization_contract_id, audience_safe_reference, created_at)
    VALUES (p_distribution_package_version_id, p_replay_id, p_replay_version_id,
            version.source_manifest_version_id, 'MY_WORLD', p_destination_action, next_revision,
            derived.authority_requirement_state, derived.source_authority_resolution,
            derived.analytical_authority_resolution, derived.required_approver_count, fingerprint,
            'QANDEEL_REPLAY_EXPORT_SANITIZATION_V1', reference, instant);

    INSERT INTO public.replay_distribution_required_approvers
      (distribution_package_version_id, approver_user_id)
    SELECT p_distribution_package_version_id, a.approver
      FROM unnest(derived.required_approvers) AS a(approver);

    INSERT INTO public.replay_distribution_export_descriptors
      (distribution_package_version_id, destination_action, audience_safe_reference,
       sanitization_contract_id, coverage_class, selected_segment_count, temporal_gap_count,
       source_medium_class, original_medium_policy, exact_text_policy, semantic_cut_policy,
       temporal_gap_policy, timing_integrity_policy, analytical_projection_policy,
       camera_emphasis_policy, motion_policy, caption_policy, accessibility_parity_policy,
       reduced_motion_parity_policy, editorial_annotation_policy, descriptor_digest, created_at)
    VALUES (p_distribution_package_version_id, p_destination_action, reference,
            'QANDEEL_REPLAY_EXPORT_SANITIZATION_V1', safe.coverage_class, safe.selected_segment_count,
            safe.temporal_gap_count, safe.source_medium_class, safe.original_medium_policy,
            safe.exact_text_policy, safe.semantic_cut_policy, safe.temporal_gap_policy,
            safe.timing_integrity_policy, safe.analytical_projection_policy,
            safe.camera_emphasis_policy, safe.motion_policy, safe.caption_policy,
            safe.accessibility_parity_policy, safe.reduced_motion_parity_policy,
            safe.editorial_annotation_policy, safe.descriptor_digest, instant);

    -- CANONICAL LOCK ORDER, STEP 4: the destination subsystem, in ITS canonical
    -- order - the ONE Public World, then the exact Experience - and only then the
    -- bounded Public package under the canonical Public runtime.
    IF p_destination_action = 'PUBLISH_TO_PUBLIC_WORLD' THEN
      PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
      PERFORM 1 FROM public.public_experiences e WHERE e.id = p_public_experience_id FOR UPDATE;
      PERFORM public.replay_prepare_public_distribution_artifact_v1(
        p_distribution_package_version_id, p_public_experience_id, p_public_manifest_version_id,
        p_public_experience_version_id, p_public_package_item_id, instant);
    END IF;

    INSERT INTO public.replay_distribution_prepare_commands
      (id, replay_id, actor_user_id, distribution_package_version_id, destination_action,
       required_approver_count, request_ref, committed_at)
    VALUES (p_command_id, p_replay_id, u, p_distribution_package_version_id, p_destination_action,
            derived.required_approver_count, request, instant);
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO committed FROM public.replay_distribution_prepare_commands c WHERE c.id = p_command_id;
    IF FOUND AND committed.request_ref = request THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_ID_CONFLICT' USING ERRCODE='23505';
  END;

  -- THE DERIVATION THE COMMIT WILL USE MUST ALREADY REPRODUCE WHAT PREPARATION
  -- STORED. Two paths that compute one authority identity are two places for it
  -- to drift, so preparation ends by asking the ONE package derivation - the same
  -- one approval and the distribution commit call - and refuses its own work if
  -- the answers differ.
  SELECT * INTO confirm
    FROM public.derive_replay_distribution_authority_v1(p_distribution_package_version_id);
  SELECT coalesce(array_agg(ra.approver_user_id ORDER BY ra.approver_user_id), ARRAY[]::uuid[])
    INTO stored FROM public.replay_distribution_required_approvers ra
   WHERE ra.distribution_package_version_id = p_distribution_package_version_id;
  IF confirm.authority_fingerprint IS DISTINCT FROM fingerprint
     OR stored IS DISTINCT FROM confirm.required_approvers THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001',
      DETAIL='The package authority derivation the distribution commit uses does not reproduce what preparation stored.';
  END IF;

  RETURN QUERY SELECT 'REPLAY_DISTRIBUTION_PACKAGE_PREPARED'::text, p_replay_id,
                      p_distribution_package_version_id, p_destination_action, next_revision,
                      derived.authority_requirement_state, derived.required_approver_count,
                      reference, instant;
END$$;

ALTER FUNCTION public.prepare_replay_distribution_package_v1(
  uuid, uuid, uuid, uuid, text, uuid, uuid, uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 12. THE ONE HUMAN CONSENT ACT.
--
--     The approving human is exactly auth.uid(). There is no approver parameter,
--     and the composite key into the DERIVED required set makes an approval by a
--     human this exact package does not require structurally impossible.
--
--     ONE ACT, TWO IMMUTABLE EVIDENCE STORES. A Public Replay needs both the
--     Replay distribution approval and the canonical Public manifest approval,
--     because both subsystems own immutable authority evidence and neither may be
--     bypassed. Asking the same human twice for the same immutable payload would
--     be duplicate consent, so this ONE act writes both rows in ONE transaction,
--     for the same auth.uid(), over a Public package bound 1:1 to the Replay
--     package - and the Public row is written through the canonical relation with
--     the canonical composite key into the canonical rightsholder set, bound to
--     the CANONICAL Public authority fingerprint. Nothing is bypassed and nothing
--     is fabricated: the same human really did consent to exactly this payload.
--
--     Approving grants NO source browsing, NO Experience control and NO
--     distribution: it records consent, and the distribution commit is a separate
--     act with its own gates.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.approve_replay_distribution_v1(
  p_approval_id uuid, p_distribution_package_version_id uuid, p_public_approval_id uuid
) RETURNS TABLE(outcome text, approval_id uuid, approved_distribution_package_version_id uuid,
                approving_user_id uuid, bound_authority_fingerprint text,
                linked_public_approval_id uuid, approved_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.replay_distribution_approvals;
  package public.replay_distribution_package_versions;
  version public.replay_versions;
  bridge public.replay_public_distribution_artifacts;
  experience public.public_experiences;
  derived record;
  public_fingerprint text;
  currency text;
  stored uuid[];
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_approval_id IS NULL OR p_distribution_package_version_id IS NULL
     OR p_approval_id = p_distribution_package_version_id THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: an approval IS its own immutable record.
  SELECT * INTO committed FROM public.replay_distribution_approvals a WHERE a.id = p_approval_id;
  IF FOUND THEN
    IF committed.distribution_package_version_id = p_distribution_package_version_id
       AND committed.approver_user_id = u THEN
      RETURN QUERY SELECT 'ALREADY_APPROVED'::text, committed.id,
                          committed.distribution_package_version_id, committed.approver_user_id,
                          committed.bound_authority_fingerprint,
                          (SELECT pa.id FROM public.publication_manifest_approvals pa
                            WHERE pa.id = p_public_approval_id), committed.approved_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- Only enough of the immutable package is pre-read to discover which Replay
  -- this consent belongs to; the Replay is still the first LOCK.
  SELECT p.* INTO package FROM public.replay_distribution_package_versions p
   WHERE p.id = p_distribution_package_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT a.* INTO bridge FROM public.replay_public_distribution_artifacts a
   WHERE a.distribution_package_version_id = package.id;
  -- The linked Public approval identity is named exactly when there is a linked
  -- Public package, and never otherwise.
  IF (bridge.package_item_id IS NULL) <> (p_public_approval_id IS NULL) THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the Replay.
  PERFORM 1 FROM public.replays r WHERE r.id = package.replay_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO committed FROM public.replay_distribution_approvals a WHERE a.id = p_approval_id;
  IF FOUND THEN
    IF committed.distribution_package_version_id = p_distribution_package_version_id
       AND committed.approver_user_id = u THEN
      RETURN QUERY SELECT 'ALREADY_APPROVED'::text, committed.id,
                          committed.distribution_package_version_id, committed.approver_user_id,
                          committed.bound_authority_fingerprint, p_public_approval_id,
                          committed.approved_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2 AND 3: the immutable package and its exact
  -- Replay Version, in SHARE mode - the hierarchy documented rather than a column
  -- defended, exactly as the frozen Public approval takes its manifest.
  PERFORM 1 FROM public.replay_distribution_package_versions p WHERE p.id = package.id FOR SHARE;
  SELECT v.* INTO version FROM public.replay_versions v WHERE v.id = package.replay_version_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- STEP 4: the source, revalidated. A human is never asked to consent to a
  -- payload whose source already moved.
  --
  -- It does NOT take the frozen I-06A source lock, and that is deliberate rather
  -- than an omission: `replay_lock_source_manifest_v1` is CREATOR-scoped by
  -- design - it refuses any human who did not create the Replay - and an
  -- approver need not be the creator. Calling it here would give a required
  -- rightsholder, and a stranger, a distinguishable refusal from a path whose
  -- whole purpose is to be bounded. The Replay row held FOR UPDATE above is the
  -- serialization point every Replay path shares, the currency derivation is a
  -- property of the Replay rather than of whoever asks, and the act that widens
  -- an audience - the distribution commit - revalidates under the full lock.
  SELECT c.currency_state INTO currency
    FROM public.derive_replay_source_manifest_currency_v1(package.source_manifest_version_id) c;
  IF currency IS DISTINCT FROM 'CURRENT' THEN
    RAISE EXCEPTION 'REPLAY_SOURCE_STALE' USING ERRCODE='40001';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 6: the destination subsystem, in ITS canonical
  -- order, before anything Public is read for authority.
  IF bridge.package_item_id IS NOT NULL THEN
    PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
    SELECT e.* INTO experience FROM public.public_experiences e
     WHERE e.id = bridge.public_experience_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
    IF experience.current_lifecycle <> 'DRAFT' THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_PUBLIC_LIFECYCLE_INVALID' USING ERRCODE='55000';
    END IF;
  END IF;

  -- THE ONE PACKAGE AUTHORITY DERIVATION, from CURRENT state. A changed required
  -- set or a changed authority identity stales the package: the answer is a NEW
  -- package version, never an approval quietly attached to the old one.
  SELECT * INTO derived
    FROM public.derive_replay_distribution_authority_v1(p_distribution_package_version_id);
  SELECT coalesce(array_agg(ra.approver_user_id ORDER BY ra.approver_user_id), ARRAY[]::uuid[])
    INTO stored FROM public.replay_distribution_required_approvers ra
   WHERE ra.distribution_package_version_id = p_distribution_package_version_id;
  IF stored IS DISTINCT FROM derived.required_approvers
     OR derived.authority_fingerprint IS DISTINCT FROM package.authority_request_fingerprint THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_STALE' USING ERRCODE='40001',
      DETAIL='The authority this package recorded is no longer the authority current truth derives; a new package version is required.';
  END IF;
  -- A HUMAN THIS PACKAGE DOES NOT REQUIRE REACHES THE SAME BOUNDED CLASS a
  -- nonexistent package reaches, so this surface is not an existence, ownership
  -- or required-set oracle.
  IF NOT (u = ANY(derived.required_approvers)) THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- ONE DATABASE-OWNED INSTANT for both halves of the one consent act.
  instant := clock_timestamp();

  BEGIN
    INSERT INTO public.replay_distribution_approvals
      (id, distribution_package_version_id, destination_action, approver_user_id,
       bound_authority_fingerprint, approved_at)
    VALUES (p_approval_id, p_distribution_package_version_id, package.destination_action, u,
            derived.authority_fingerprint, instant);

    -- THE SAME ACT, IN THE CANONICAL PUBLIC EVIDENCE STORE. The canonical
    -- derivation supplies the Public fingerprint and the canonical composite key
    -- refuses a human the Public manifest does not require, so nothing here
    -- weakens the Public authority contract - it fulfils it once instead of twice.
    IF bridge.package_item_id IS NOT NULL THEN
      SELECT pa.authority_fingerprint INTO public_fingerprint
        FROM public.derive_public_publication_authority_v1(bridge.public_manifest_version_id) pa;
      INSERT INTO public.publication_manifest_approvals
        (id, manifest_version_id, approver_user_id, bound_authority_fingerprint, approved_at)
      VALUES (p_public_approval_id, bridge.public_manifest_version_id, u, public_fingerprint, instant);
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'REPLAY_DISTRIBUTION_APPROVED'::text, p_approval_id,
                      p_distribution_package_version_id, u, derived.authority_fingerprint,
                      p_public_approval_id, instant;
END$$;

ALTER FUNCTION public.approve_replay_distribution_v1(uuid, uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 13. WITHDRAW ONE EXACT APPROVAL.
--
--     The withdrawing human is exactly auth.uid() and must be the immutable
--     approver of the exact approval. There is no approver parameter, no package
--     parameter and no reason parameter. The historical approval row is never
--     touched; this appends the fact that the consent it recorded is no longer
--     effective, and withdrawing grants NO source browsing of any kind.
--
--     ONE ACT, BOTH EVIDENCE STORES, exactly as the consent was: a Public-linked
--     withdrawal also withdraws the canonical Public approval, through the frozen
--     `withdraw_publication_approval_v1`, so consent cannot be half-taken-back.
--     The canonical Public consequence of a withdrawn publication approval is
--     I-05C's and is not re-implemented here.
--
--     A withdrawal already recorded answers ALREADY_WITHDRAWN and still records
--     the command that asked, so a repeated withdrawal is not an error and is not
--     a second event.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.withdraw_replay_distribution_approval_v1(
  p_command_id uuid, p_approval_id uuid, p_public_command_id uuid
) RETURNS TABLE(outcome text, approval_id uuid, approved_distribution_package_version_id uuid,
                effective_state text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.replay_distribution_withdrawal_commands;
  approval public.replay_distribution_approvals;
  package public.replay_distribution_package_versions;
  bridge public.replay_public_distribution_artifacts;
  linked_approval uuid;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_approval_id IS NULL OR p_command_id = p_approval_id THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_REPLAY_DISTRIBUTION_WITHDRAWAL_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'approval=' || lower(p_approval_id::text) || E'\n'
   || 'publicCommand=' || coalesce(lower(p_public_command_id::text), 'NONE'), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock.
  SELECT * INTO committed FROM public.replay_distribution_withdrawal_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.approval_id,
                        committed.distribution_package_version_id,
                        (SELECT s.effective_state
                           FROM public.derive_replay_distribution_approval_effective_state_v1(committed.approval_id) s),
                        committed.committed_at;
    RETURN;
  END IF;

  -- THE EXACT APPROVAL AND THE EXACT HUMAN WHO GAVE IT. Anyone else - and a
  -- caller naming an approval that does not exist - receives ONE bounded class,
  -- so the error never says whether a guessed identifier is real. The approval
  -- row is immutable, so reading it before the lock is safe.
  SELECT a.* INTO approval FROM public.replay_distribution_approvals a WHERE a.id = p_approval_id;
  IF NOT FOUND OR approval.approver_user_id <> u THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT p.* INTO package FROM public.replay_distribution_package_versions p
   WHERE p.id = approval.distribution_package_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  SELECT a.* INTO bridge FROM public.replay_public_distribution_artifacts a
   WHERE a.distribution_package_version_id = package.id;
  IF (bridge.package_item_id IS NULL) <> (p_public_command_id IS NULL) THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1, then the destination subsystem in ITS order, so
  -- a withdrawal and a distribution can never interleave: whichever commits first
  -- is the truth the other sees.
  PERFORM 1 FROM public.replays r WHERE r.id = package.replay_id FOR UPDATE;
  IF bridge.package_item_id IS NOT NULL THEN
    PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
    PERFORM 1 FROM public.public_experiences e WHERE e.id = bridge.public_experience_id FOR UPDATE;
  END IF;

  SELECT * INTO committed FROM public.replay_distribution_withdrawal_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.approval_id,
                        committed.distribution_package_version_id,
                        (SELECT s.effective_state
                           FROM public.derive_replay_distribution_approval_effective_state_v1(committed.approval_id) s),
                        committed.committed_at;
    RETURN;
  END IF;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of this command.
  instant := clock_timestamp();

  IF EXISTS (SELECT 1 FROM public.replay_distribution_approval_withdrawal_events w
              WHERE w.approval_id = p_approval_id) THEN
    INSERT INTO public.replay_distribution_withdrawal_commands
      (id, approval_id, distribution_package_version_id, actor_user_id, request_ref, committed_at)
    VALUES (p_command_id, p_approval_id, package.id, u, request, instant);
    RETURN QUERY SELECT 'ALREADY_WITHDRAWN'::text, p_approval_id, package.id, 'WITHDRAWN'::text, instant;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.replay_distribution_approval_withdrawal_events
      (id, approval_id, distribution_package_version_id, approver_user_id, occurred_at)
    VALUES (p_command_id, p_approval_id, package.id, u, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  -- THE SAME ACT, IN THE CANONICAL PUBLIC EVIDENCE STORE. Consent given once is
  -- taken back once, and the canonical primitive owns the Public half entirely.
  IF bridge.package_item_id IS NOT NULL THEN
    SELECT pa.id INTO linked_approval FROM public.publication_manifest_approvals pa
     WHERE pa.manifest_version_id = bridge.public_manifest_version_id AND pa.approver_user_id = u;
    IF FOUND THEN
      PERFORM public.withdraw_publication_approval_v1(p_public_command_id, linked_approval);
    END IF;
  END IF;

  INSERT INTO public.replay_distribution_withdrawal_commands
    (id, approval_id, distribution_package_version_id, actor_user_id, request_ref, committed_at)
  VALUES (p_command_id, p_approval_id, package.id, u, request, instant);

  RETURN QUERY SELECT 'REPLAY_DISTRIBUTION_APPROVAL_WITHDRAWN'::text, p_approval_id, package.id,
                      'WITHDRAWN'::text, instant;
END$$;

ALTER FUNCTION public.withdraw_replay_distribution_approval_v1(uuid, uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 14. AUTHORIZE ONE EXACT DISTRIBUTION.
--
--     The ONE protected commit, and the only place an audience can widen. It
--     revalidates EVERYTHING immediately before committing, in this order:
--
--       the exact creator                     a stranger reaches one bounded class
--       the exact historical finalization     still present
--       CURRENT SOURCE TRUTH                  through the ONE frozen I-06A path
--       the CURRENT required approver set     must still be the stored one
--       the CURRENT authority fingerprint     must still be the package's own
--       every required approval EFFECTIVE     MISSING, WITHDRAWN and SUPERSEDED
--                                             each refuse, and every approval must
--                                             still bind the derived fingerprint
--       the SANITIZED SURFACE                 re-derived and compared, so a
--                                             package approved against one
--                                             audience-visible surface can never
--                                             be exported with another
--       the CW2-08 PREREQUISITE, LAST         every dimension positive, or refuse
--
--     Only then does the destination act: a Public publish through the CANONICAL
--     `publish_public_experience_v1`, which runs every Public gate again on its
--     own and owns the Public publication record; an external share or a download
--     through nothing at all, because no transport exists, so the record says
--     AUTHORIZED_FOR_DELIVERY and never claims a delivery that did not happen.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.authorize_replay_distribution_v1(
  p_command_id uuid, p_distribution_package_version_id uuid, p_public_publish_command_id uuid
) RETURNS TABLE(outcome text, committed_replay_id uuid, distribution_package_version_id uuid,
                destination_action text, distribution_state text,
                effective_approval_count integer, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.replay_distribution_authorization_commands;
  package public.replay_distribution_package_versions;
  replay public.replays;
  version public.replay_versions;
  descriptor public.replay_distribution_export_descriptors;
  bridge public.replay_public_distribution_artifacts;
  experience public.public_experiences;
  derived record;
  gate record;
  published record;
  publishing_version uuid;
  published_version uuid;
  recomputed text;
  currency text;
  stored uuid[];
  effective integer;
  state text;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_distribution_package_version_id IS NULL
     OR p_command_id = p_distribution_package_version_id THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_REPLAY_DISTRIBUTION_AUTHORIZATION_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'package=' || lower(p_distribution_package_version_id::text) || E'\n'
   || 'publicPublishCommand=' || coalesce(lower(p_public_publish_command_id::text), 'NONE'), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, reading only immutable
  -- command history, so an equivalent retry answers even after the source moved.
  SELECT * INTO committed FROM public.replay_distribution_authorization_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY
      SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, committed.distribution_package_version_id,
             committed.destination_action, z.distribution_state, committed.effective_approval_count,
             committed.committed_at
        FROM public.replay_distribution_authorizations z
       WHERE z.distribution_package_version_id = committed.distribution_package_version_id;
    RETURN;
  END IF;

  SELECT p.* INTO package FROM public.replay_distribution_package_versions p
   WHERE p.id = p_distribution_package_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT a.* INTO bridge FROM public.replay_public_distribution_artifacts a
   WHERE a.distribution_package_version_id = package.id;
  IF (bridge.package_item_id IS NULL) <> (p_public_publish_command_id IS NULL) THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the Replay. The exact creator, and nobody else.
  SELECT r.* INTO replay FROM public.replays r WHERE r.id = package.replay_id FOR UPDATE;
  IF NOT FOUND OR replay.created_by_user_id <> u THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.replay_distribution_authorization_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY
      SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, committed.distribution_package_version_id,
             committed.destination_action, z.distribution_state, committed.effective_approval_count,
             committed.committed_at
        FROM public.replay_distribution_authorizations z
       WHERE z.distribution_package_version_id = committed.distribution_package_version_id;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEPS 2 AND 3, and the historical finalization the
  -- package binds must still be there.
  PERFORM 1 FROM public.replay_distribution_package_versions p WHERE p.id = package.id FOR SHARE;
  SELECT v.* INTO version FROM public.replay_versions v WHERE v.id = package.replay_version_id FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.replay_version_finalizations f
                               WHERE f.replay_version_id = package.replay_version_id
                                 AND f.replay_id = package.replay_id) THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of this distribution.
  instant := clock_timestamp();

  -- CANONICAL LOCK ORDER, STEP 4: the source, stabilized and revalidated. Nothing
  -- is reconstructed and no shadow copy exists to rescue a stale distribution.
  PERFORM public.replay_lock_source_manifest_v1(package.source_manifest_version_id);
  SELECT c.currency_state INTO currency
    FROM public.derive_replay_source_manifest_currency_v1(package.source_manifest_version_id) c;
  IF currency IS DISTINCT FROM 'CURRENT' THEN
    RAISE EXCEPTION 'REPLAY_SOURCE_STALE' USING ERRCODE='40001',
      DETAIL='A bound source changed, became unavailable, is no longer visible to the creator or is no longer the eligible version; a stale distribution cannot commit.';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 5: the approval rows, in a deterministic order, so
  -- two commits and a withdrawal can never take them in different orders.
  PERFORM 1 FROM public.replay_distribution_approvals a
    WHERE a.distribution_package_version_id = package.id ORDER BY a.approver_user_id FOR SHARE;

  -- THE CURRENT AUTHORITY, RE-DERIVED. A changed required set or a changed
  -- authority identity is a STALE PACKAGE and the answer is a new package
  -- version, never a quiet adjustment of this one.
  SELECT * INTO derived
    FROM public.derive_replay_distribution_authority_v1(p_distribution_package_version_id);
  SELECT coalesce(array_agg(ra.approver_user_id ORDER BY ra.approver_user_id), ARRAY[]::uuid[])
    INTO stored FROM public.replay_distribution_required_approvers ra
   WHERE ra.distribution_package_version_id = p_distribution_package_version_id;
  IF stored IS DISTINCT FROM derived.required_approvers
     OR derived.authority_fingerprint IS DISTINCT FROM package.authority_request_fingerprint THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_STALE' USING ERRCODE='40001';
  END IF;

  -- EVERY REQUIRED APPROVAL IS CURRENTLY EFFECTIVE. Historical rows are never
  -- counted: one never given is MISSING, one taken back is WITHDRAWN, one bound
  -- to an authority this package no longer carries is SUPERSEDED. Each refuses.
  IF EXISTS (SELECT 1 FROM public.derive_replay_distribution_effective_approvals_v1(package.id) s
              WHERE s.effective_state = 'MISSING') THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_APPROVALS_INCOMPLETE' USING ERRCODE='P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.derive_replay_distribution_effective_approvals_v1(package.id) s
              WHERE s.effective_state <> 'EFFECTIVE') THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_APPROVAL_NOT_EFFECTIVE' USING ERRCODE='55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.derive_replay_distribution_effective_approvals_v1(package.id) s
              WHERE s.bound_authority_fingerprint IS DISTINCT FROM derived.authority_fingerprint) THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_STALE' USING ERRCODE='40001';
  END IF;
  SELECT count(*)::integer INTO effective
    FROM public.derive_replay_distribution_effective_approvals_v1(package.id) s;
  IF effective <> derived.required_approver_count THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- THE SANITIZED SURFACE, RE-DERIVED AND COMPARED. A package approved against
  -- one audience-visible surface can never be exported with another.
  SELECT d.* INTO descriptor FROM public.replay_distribution_export_descriptors d
   WHERE d.distribution_package_version_id = package.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  SELECT s.descriptor_digest INTO recomputed
    FROM public.derive_replay_export_descriptor_v1(
           package.replay_version_id, package.destination_action, package.audience_safe_reference) s;
  IF recomputed IS DISTINCT FROM descriptor.descriptor_digest THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_STALE' USING ERRCODE='40001',
      DETAIL='The sanitized export descriptor no longer matches the Replay Version it was derived from.';
  END IF;

  -- THE CW2-08 PREREQUISITE, LAST, AFTER EVERY PRIVACY AND OWNERSHIP GATE. No
  -- layer manufactures another: every dimension must be positive on its own, and
  -- a single NOT_EVALUATED refuses the whole distribution.
  SELECT * INTO gate FROM public.resolve_replay_distribution_prerequisites_v1(
    package.id, package.destination_action);
  IF gate.clearance IS DISTINCT FROM 'CLEARED'
     OR gate.safety_state IS DISTINCT FROM 'SAFETY_ALLOW'
     OR gate.moderation_state IS DISTINCT FROM 'MODERATION_ALLOW'
     OR gate.entitlement_state IS DISTINCT FROM 'ENTITLED'
     OR gate.feature_state IS DISTINCT FROM 'FEATURE_ENABLED'
     OR gate.launch_state IS DISTINCT FROM 'LAUNCH_CLEARED'
     OR gate.clearance_basis IS NULL OR length(btrim(gate.clearance_basis)) = 0 THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL='Safety, moderation, commercial entitlement, the feature gate and the Launch Gate must each clear this exact distribution; an unevaluated dimension is a refusal.';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 6: the destination subsystem, in ITS canonical
  -- order. A Public publish is performed by the CANONICAL Public boundary, which
  -- re-runs every Public gate itself and owns the Public publication record; this
  -- slice creates no second Public publication truth.
  IF bridge.package_item_id IS NOT NULL THEN
    PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
    SELECT e.* INTO experience FROM public.public_experiences e
     WHERE e.id = bridge.public_experience_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
    IF experience.current_lifecycle <> 'READY_FOR_REVIEW' THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_PUBLIC_LIFECYCLE_INVALID' USING ERRCODE='55000',
        DETAIL='The linked Public Experience must have reached READY_FOR_REVIEW through the canonical Public primitive before a Replay may be published to the Public World.';
    END IF;
    SELECT v.id INTO publishing_version FROM public.public_experience_versions v
     WHERE v.package_manifest_version_id = bridge.public_manifest_version_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
    SELECT * INTO published FROM public.publish_public_experience_v1(
      p_public_publish_command_id, bridge.public_experience_id, publishing_version);
    IF published.outcome IS DISTINCT FROM 'PUBLISHED' THEN
      RAISE EXCEPTION 'REPLAY_DISTRIBUTION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
    published_version := publishing_version;
    state := 'PUBLIC_PUBLICATION_COMMITTED';
  ELSE
    -- NO TRANSPORT EXISTS, SO NOTHING IS DELIVERED. The truthful state is that
    -- this exact immutable package is authorized, and a later reviewed delivery
    -- boundary is the only thing that could ever say more.
    state := 'AUTHORIZED_FOR_DELIVERY';
  END IF;

  BEGIN
    INSERT INTO public.replay_distribution_authorizations
      (distribution_package_version_id, destination_action, replay_id, replay_version_id,
       authorized_by_user_id, authority_request_fingerprint, effective_approval_count,
       distribution_state, safety_state, moderation_state, entitlement_state, feature_state,
       launch_state, prerequisite_clearance_basis, published_experience_version_id, authorized_at)
    VALUES (package.id, package.destination_action, package.replay_id, package.replay_version_id, u,
            derived.authority_fingerprint, effective, state, gate.safety_state, gate.moderation_state,
            gate.entitlement_state, gate.feature_state, gate.launch_state, btrim(gate.clearance_basis),
            published_version, instant);

    INSERT INTO public.replay_distribution_authorization_commands
      (id, replay_id, actor_user_id, distribution_package_version_id, destination_action,
       effective_approval_count, request_ref, committed_at)
    VALUES (p_command_id, package.replay_id, u, package.id, package.destination_action, effective,
            request, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'REPLAY_DISTRIBUTION_AUTHORIZED'::text, package.replay_id, package.id,
                      package.destination_action, state, effective, instant;
END$$;

ALTER FUNCTION public.authorize_replay_distribution_v1(uuid, uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 15. THE TWO READ BOUNDARIES.
--
--     THE CREATOR BOUNDARY answers the exact Replay creator and nobody else: a
--     stranger, and a human asking about a package that does not exist, receive
--     ZERO ROWS, so the surface discloses nothing. It returns the bounded
--     actionable state a creator needs to understand whether the package is
--     distributable - how many approvals are required, how many are effective,
--     how many are missing, withdrawn or superseded - and NO approver identity,
--     no source identity, no authority fingerprint, no descriptor digest and no
--     refusal reason. A Shared participant learns nothing about a private
--     approver's account, and the creator learns counts rather than names.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_replay_distribution_package_v1(
  p_distribution_package_version_id uuid, p_user_id uuid
) RETURNS TABLE(distribution_package_version_id uuid, replay_id uuid, replay_version_id uuid,
                destination_action text, package_revision integer, authority_requirement_state text,
                required_approver_count integer, effective_approval_count integer,
                missing_approval_count integer, withdrawn_approval_count integer,
                superseded_approval_count integer, audience_safe_reference text,
                linked_public_artifact boolean, distribution_state text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_distribution_package_version_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
    SELECT p.id, p.replay_id, p.replay_version_id, p.destination_action, p.package_revision,
           p.authority_requirement_state, p.required_approver_count,
           (SELECT count(*)::integer FROM public.derive_replay_distribution_effective_approvals_v1(p.id) s
             WHERE s.effective_state = 'EFFECTIVE'),
           (SELECT count(*)::integer FROM public.derive_replay_distribution_effective_approvals_v1(p.id) s
             WHERE s.effective_state = 'MISSING'),
           (SELECT count(*)::integer FROM public.derive_replay_distribution_effective_approvals_v1(p.id) s
             WHERE s.effective_state = 'WITHDRAWN'),
           (SELECT count(*)::integer FROM public.derive_replay_distribution_effective_approvals_v1(p.id) s
             WHERE s.effective_state = 'SUPERSEDED'),
           p.audience_safe_reference,
           EXISTS (SELECT 1 FROM public.replay_public_distribution_artifacts a
                    WHERE a.distribution_package_version_id = p.id),
           (SELECT z.distribution_state FROM public.replay_distribution_authorizations z
             WHERE z.distribution_package_version_id = p.id),
           p.created_at
      FROM public.replay_distribution_package_versions p
      JOIN public.replays r ON r.id = p.replay_id
     WHERE p.id = p_distribution_package_version_id AND r.created_by_user_id = p_user_id;
END$$;

ALTER FUNCTION public.resolve_replay_distribution_package_v1(uuid, uuid) OWNER TO postgres;

-- THE PUBLIC BOUNDARY serves the SANITIZED DESCRIPTOR of a published Replay
-- artifact and nothing else. It is addressed by the OPAQUE audience reference,
-- never by an internal identity, and it composes the ONE canonical Public
-- visibility derivation with the canonical audience admission gate - so an
-- Experience that was never published, one whose pointer moved, one that I-05C
-- made ABSENT_FROM_PUBLIC_WORLD, one whose consent was withdrawn, an unknown
-- reference and a viewer the policy does not admit all receive the SAME answer:
-- zero rows. It is not an existence oracle, it resurrects nothing, and it is not
-- a database reader over Replay internals: it returns no Replay id, no Replay
-- Version, no manifest, selection, projection or render contract identity, no
-- distribution package identity, no source of any kind and no provenance. A
-- Public viewer receives the distributable descriptor and no capability.
CREATE FUNCTION public.resolve_public_replay_artifact_v1(
  p_audience_safe_reference text, p_viewer_user_id uuid
) RETURNS TABLE(audience_safe_reference text, public_experience_id uuid, public_version_ordinal integer,
                publisher_public_identity_ref uuid, publisher_label_mode text,
                publisher_display_label text, published_at timestamptz,
                coverage_class text, selected_segment_count integer, temporal_gap_count integer,
                source_medium_class text, original_medium_policy text, exact_text_policy text,
                semantic_cut_policy text, temporal_gap_policy text, timing_integrity_policy text,
                analytical_projection_policy text, camera_emphasis_policy text, motion_policy text,
                caption_policy text, accessibility_parity_policy text,
                reduced_motion_parity_policy text, editorial_annotation_policy text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_audience_safe_reference IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
    SELECT d.audience_safe_reference, vs.experience_id, vs.visible_version_ordinal,
           m.publisher_public_identity_ref, pd.label_mode, pd.display_label, s.published_at,
           d.coverage_class, d.selected_segment_count, d.temporal_gap_count, d.source_medium_class,
           d.original_medium_policy, d.exact_text_policy, d.semantic_cut_policy, d.temporal_gap_policy,
           d.timing_integrity_policy, d.analytical_projection_policy, d.camera_emphasis_policy,
           d.motion_policy, d.caption_policy, d.accessibility_parity_policy,
           d.reduced_motion_parity_policy, d.editorial_annotation_policy
      FROM public.replay_distribution_export_descriptors d
      JOIN public.replay_public_distribution_artifacts a
        ON a.distribution_package_version_id = d.distribution_package_version_id
      JOIN public.replay_distribution_authorizations z
        ON z.distribution_package_version_id = d.distribution_package_version_id
      CROSS JOIN LATERAL public.resolve_public_visibility_state_v1(a.public_experience_id) vs
      JOIN public.resolve_public_audience_admission_v1(p_viewer_user_id) ad ON ad.admission = 'ADMITTED'
      JOIN public.public_experience_publication_state s ON s.experience_id = vs.experience_id
      JOIN public.publication_package_manifest_versions m ON m.id = vs.visible_manifest_version_id
      JOIN public.public_identity_display_state pd
        ON pd.public_identity_ref = m.publisher_public_identity_ref
     WHERE d.audience_safe_reference = p_audience_safe_reference
       AND vs.visibility_state = 'PUBLICLY_VISIBLE'
       AND vs.visible_manifest_version_id = a.public_manifest_version_id;
END$$;

ALTER FUNCTION public.resolve_public_replay_artifact_v1(text, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 16. SECURITY POSTURE.
--
--     Every function is postgres-owned, SECURITY DEFINER where it acts, and
--     search_path-pinned. Every mutation, every derivation, both seams and the
--     Public bridge core are executable by NO application role: the frozen
--     CW2-08 Launch Gate that would make a distribution reachable is
--     unimplemented, and test convenience is not launch authority. The two read
--     boundaries are service_role-executable alone, the frozen narrow-resolver
--     precedent of 0087 / 0089 / 0093 / 0095 / 0101 / 0103 - the Public one
--     enforces the canonical audience policy itself, so opening it to the service
--     tier is not a launch decision, and no direct table privilege exists behind
--     either of them.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  internal text[] := ARRAY[
    'public.resolve_replay_analytical_distribution_authority_v1(uuid)',
    'public.resolve_replay_distribution_prerequisites_v1(uuid, text)',
    'public.replay_export_descriptor_digest_v1(text, text, text, text, integer, integer, text, text, text, text, text, text, text, text, text, text, text, text, text)',
    'public.derive_replay_export_descriptor_v1(uuid, text, text)',
    'public.replay_distribution_authority_fingerprint_v1(text, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, text, text, text, uuid[], uuid)',
    'public.derive_replay_distribution_required_approvers_v1(uuid)',
    'public.derive_replay_distribution_authority_v1(uuid)',
    'public.derive_replay_distribution_approval_effective_state_v1(uuid)',
    'public.derive_replay_distribution_effective_approvals_v1(uuid)',
    'public.replay_prepare_public_distribution_artifact_v1(uuid, uuid, uuid, uuid, uuid, timestamptz)',
    'public.prepare_replay_distribution_package_v1(uuid, uuid, uuid, uuid, text, uuid, uuid, uuid, uuid)',
    'public.approve_replay_distribution_v1(uuid, uuid, uuid)',
    'public.withdraw_replay_distribution_approval_v1(uuid, uuid, uuid)',
    'public.authorize_replay_distribution_v1(uuid, uuid, uuid)'];
  resolvers text[] := ARRAY[
    'public.resolve_replay_distribution_package_v1(uuid, uuid)',
    'public.resolve_public_replay_artifact_v1(text, uuid)'];
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
-- 17. SELF-ASSERTIONS.
--
--     What must already be true of THIS migration for it to be allowed to
--     deploy. Each is a fact about the objects 0105 owns or the frozen truths it
--     consumes - never a census of the database, and never a ceiling on I-06D:
--     no assertion here forbids a later reviewed source-loss record, recall
--     reconciliation, media or transport provider, Safety runtime, entitlement
--     runtime, Launch wrapper or Shared / Public analytical capability from
--     existing anywhere. What is forbidden is forbidden IN THE FUNCTION BODIES
--     THIS MIGRATION OWNS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  analytical_fn text := 'public.resolve_replay_analytical_distribution_authority_v1(uuid)';
  gate_fn text := 'public.resolve_replay_distribution_prerequisites_v1(uuid, text)';
  descriptor_digest_fn text := 'public.replay_export_descriptor_digest_v1(text, text, text, text, integer, integer, text, text, text, text, text, text, text, text, text, text, text, text, text)';
  descriptor_fn text := 'public.derive_replay_export_descriptor_v1(uuid, text, text)';
  fingerprint_fn text := 'public.replay_distribution_authority_fingerprint_v1(text, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, text, text, text, uuid[], uuid)';
  approvers_fn text := 'public.derive_replay_distribution_required_approvers_v1(uuid)';
  authority_fn text := 'public.derive_replay_distribution_authority_v1(uuid)';
  state_fn text := 'public.derive_replay_distribution_approval_effective_state_v1(uuid)';
  effective_fn text := 'public.derive_replay_distribution_effective_approvals_v1(uuid)';
  bridge_fn text := 'public.replay_prepare_public_distribution_artifact_v1(uuid, uuid, uuid, uuid, uuid, timestamptz)';
  prepare_fn text := 'public.prepare_replay_distribution_package_v1(uuid, uuid, uuid, uuid, text, uuid, uuid, uuid, uuid)';
  approve_fn text := 'public.approve_replay_distribution_v1(uuid, uuid, uuid)';
  withdraw_fn text := 'public.withdraw_replay_distribution_approval_v1(uuid, uuid, uuid)';
  authorize_fn text := 'public.authorize_replay_distribution_v1(uuid, uuid, uuid)';
  package_resolver text := 'public.resolve_replay_distribution_package_v1(uuid, uuid)';
  public_resolver text := 'public.resolve_public_replay_artifact_v1(text, uuid)';
  public_authority_fn text := 'public.derive_public_publication_authority_v1(uuid)';
  pure text[];
  derivations text[];
  human text[];
  mutating text[];
  resolvers text[];
  everything text[];
  command_human text[];
  own_tables text[] := ARRAY['replay_distribution_prepare_commands',
                             'replay_distribution_withdrawal_commands',
                             'replay_distribution_authorization_commands'];
  fn text;
  t text;
  role_name text;
  p record;
  replay_pos integer;
  source_pos integer;
  destination_pos integer;
  write_pos integer;
BEGIN
  pure := ARRAY[descriptor_digest_fn, fingerprint_fn];
  derivations := ARRAY[analytical_fn, gate_fn, descriptor_fn, approvers_fn, authority_fn,
                       state_fn, effective_fn];
  human := ARRAY[prepare_fn, approve_fn, withdraw_fn, authorize_fn];
  mutating := ARRAY[bridge_fn, prepare_fn, approve_fn, withdraw_fn, authorize_fn];
  resolvers := ARRAY[package_resolver, public_resolver];
  command_human := ARRAY[prepare_fn, withdraw_fn, authorize_fn];
  everything := pure || derivations || mutating || resolvers;

  -- EVERY FUNCTION IS POSTGRES-OWNED, PINNED, AND EXECUTABLE BY NO APPLICATION
  -- ROLE except the two read boundaries, which service_role alone may execute.
  FOREACH fn IN ARRAY everything LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-06C: % must be owned by postgres', fn; END IF;
    IF NOT (fn = ANY(pure)) AND NOT p.prosecdef THEN
      RAISE EXCEPTION 'I-06C: % must be SECURITY DEFINER', fn;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-06C: % must pin an empty search_path', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-06C: PUBLIC must not execute % before the frozen CW2-08 Launch Gate exists', fn;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name)
         AND has_function_privilege(role_name, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-06C: % must not execute % before the frozen CW2-08 Launch Gate exists', role_name, fn;
      END IF;
    END LOOP;
    IF NOT (fn = ANY(resolvers)) AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
       AND has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-06C: service_role must not execute % : the service tier is an executor, never the human consent principal', fn;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' OR p.prosrc ~* 'TRUNCATE' THEN
      RAISE EXCEPTION 'I-06C: % locks rows in the canonical order, never a table and never an advisory key', fn;
    END IF;
    -- NO I-06C FUNCTION MUTATES A PERSONAL, SHARED, HISTORICAL OR REPLAY-TRUTH
    -- RELATION: distribution binds truth and writes none of it. A distribution is
    -- never allowed to rewrite the Replay it distributes.
    IF p.prosrc ~ '(INSERT INTO|UPDATE|DELETE FROM) public\.(conversation_|session_|historical_|hypothes|memor|information_gap|question_|confidence_|shared_world|users|replays|replay_source_manifest|replay_selection_spec|replay_draft_state|replay_analytical|replay_semantic_cut|replay_temporal|replay_render_contract|replay_versions|replay_current_version|replay_version_finalizations|replay_lifecycle|replay_preview_commands|replay_finalization_commands)' THEN
      RAISE EXCEPTION 'I-06C: % must mutate no Personal Shared historical or Replay truth relation', fn;
    END IF;
    -- NO MODEL RUNS ANYWHERE, AND NO ABSENT MEDIUM IS MANUFACTURED.
    IF p.prosrc ~* '(openai|anthropic|claude|gpt|llm|prompt|completion|embedding|inference|synthes|text_to_speech|tts_)' THEN
      RAISE EXCEPTION 'I-06C: % must run no model and manufacture no absent medium', fn;
    END IF;
    -- NO CODEC, CONTAINER, STORAGE, CDN, URL OR TRANSPORT IS INVENTED.
    IF p.prosrc ~* '(codec|bitrate|framerate|frame_rate|https?://|s3://|cloudfront|bucket|object_key|watermark|\bdrm\b)' THEN
      RAISE EXCEPTION 'I-06C: % must invent no codec container storage endpoint or transport: CW2-05 defers all of it', fn;
    END IF;
  END LOOP;

  FOREACH fn IN ARRAY mutating LOOP
    IF (SELECT pr.provolatile FROM pg_proc pr WHERE pr.oid = fn::regprocedure) <> 'v' THEN
      RAISE EXCEPTION 'I-06C: consequential primitive % must be VOLATILE', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY pure LOOP
    IF (SELECT pr.provolatile FROM pg_proc pr WHERE pr.oid = fn::regprocedure) <> 'i' THEN
      RAISE EXCEPTION 'I-06C: the canonicalization % must be IMMUTABLE, or one truth could digest differently', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY derivations LOOP
    SELECT pr.provolatile, pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-06C: derivation % must be STABLE', fn; END IF;
    IF p.prosrc ~ 'INSERT INTO' OR p.prosrc ~ 'UPDATE public' OR p.prosrc ~ 'DELETE FROM'
       OR p.prosrc ~ 'FOR UPDATE|FOR SHARE' THEN
      RAISE EXCEPTION 'I-06C: derivation % must write nothing and lock nothing', fn;
    END IF;
    -- A REPLAY-SIDE DERIVATION NEVER READS THE SEALED PUBLIC PROVENANCE. The ONE
    -- authorized reader of that relation stays the canonical Public derivation.
    IF p.prosrc ~ 'publication_package_item_provenance' THEN
      RAISE EXCEPTION 'I-06C: % must never read the sealed Public provenance: it is internal audit truth, not a bridge into private source', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY resolvers LOOP
    SELECT pr.provolatile, pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-06C: read boundary % must be STABLE', fn; END IF;
    IF p.prosrc ~ 'INSERT INTO' OR p.prosrc ~ 'UPDATE public' OR p.prosrc ~ 'DELETE FROM' THEN
      RAISE EXCEPTION 'I-06C: read boundary % must write nothing', fn;
    END IF;
    IF p.prosrc ~ 'publication_package_item_provenance' THEN
      RAISE EXCEPTION 'I-06C: read boundary % must never read the sealed Public provenance', fn;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
       AND NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-06C: service_role must execute the read boundary %', fn;
    END IF;
  END LOOP;

  -- THE TWO SEAMS ARE HONEST ABOUT BEING UNIMPLEMENTED, and neither fabricates a
  -- clearance or an approver set.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = analytical_fn::regprocedure;
  IF p.prosrc !~ 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT' THEN
    RAISE EXCEPTION 'I-06C: the analytical authority seam must answer the canonical unresolved state';
  END IF;
  IF p.prosrc ~ 'RESOLVED_EXACT_HUMAN_REQUIREMENT' OR p.prosrc ~ 'RESOLVED_NO_HUMAN_REQUIREMENT' THEN
    RAISE EXCEPTION 'I-06C: the analytical authority seam must not manufacture a resolved human requirement it cannot derive';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = gate_fn::regprocedure;
  IF p.prosrc !~ 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'I-06C: the CW2-08 prerequisite seam must answer NOT_EVALUATED';
  END IF;
  IF p.prosrc ~ 'SAFETY_ALLOW' OR p.prosrc ~ 'MODERATION_ALLOW' OR p.prosrc ~ 'ENTITLED'
     OR p.prosrc ~ 'FEATURE_ENABLED' OR p.prosrc ~ 'LAUNCH_CLEARED' OR p.prosrc ~ '''CLEARED''' THEN
    RAISE EXCEPTION 'I-06C: the CW2-08 prerequisite seam must claim no clearance: no executable canonical runtime exists';
  END IF;

  -- UNRESOLVED AUTHORITY FAILS THE DERIVATION CLOSED, and the union is derived
  -- rather than assumed. Membership of any kind contributes nothing.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = approvers_fn::regprocedure;
  IF p.prosrc !~ 'resolve_replay_analytical_distribution_authority_v1'
     OR p.prosrc !~ 'REPLAY_DISTRIBUTION_ANALYTICAL_AUTHORITY_UNRESOLVED'
     OR p.prosrc !~ 'NOT IN \(''RESOLVED_EXACT_HUMAN_REQUIREMENT'',' THEN
    RAISE EXCEPTION 'I-06C: the required approver derivation must consume the ONE analytical seam and fail closed on any answer but a RESOLVED one';
  END IF;
  IF p.prosrc !~ 'REPLAY_DISTRIBUTION_SOURCE_AUTHORITY_UNRESOLVED'
     OR p.prosrc !~ 'personal_source_role IS DISTINCT FROM ''USER''' THEN
    RAISE EXCEPTION 'I-06C: QANDEEL-authored Personal material must fail closed exactly as the frozen Public preparation refuses it';
  END IF;
  IF p.prosrc ~ 'shared_world_membership_episodes|shared_world_history_access_grants|shared_world_standing_context|public_experience_controllers' THEN
    RAISE EXCEPTION 'I-06C: the required approver derivation must read no membership and no control: neither is distribution authority';
  END IF;

  -- THE AUTHORITY FINGERPRINT IS DERIVED FROM ONE PLACE and binds every truth
  -- that makes a consent specific.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fingerprint_fn::regprocedure;
  FOREACH t IN ARRAY ARRAY['action=', 'replay=', 'replayVersion=', 'package=', 'manifest=',
                           'selection=', 'projection=', 'projectionDigest=', 'renderContract=',
                           'contractDigest=', 'sanitization=', 'descriptorDigest=',
                           'sourceAuthority=', 'analyticalAuthority=', 'authorityState=',
                           'requiredApprovers=', 'publicManifest='] LOOP
    IF position(t IN p.prosrc) = 0 THEN
      RAISE EXCEPTION 'I-06C: the distribution authority fingerprint must bind %', t;
    END IF;
  END LOOP;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = authority_fn::regprocedure;
  IF p.prosrc !~ 'replay_distribution_authority_fingerprint_v1'
     OR p.prosrc !~ 'derive_replay_distribution_required_approvers_v1'
     OR p.prosrc !~ 'derive_replay_export_descriptor_v1' THEN
    RAISE EXCEPTION 'I-06C: the package authority derivation must re-derive the required set and the sanitized surface through the ONE derivation of each';
  END IF;

  -- THE SANITIZER PRODUCES NO PRIVATE IDENTITY AND READS NO PRIVATE SOURCE.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = descriptor_fn::regprocedure;
  IF p.prosrc ~ 'conversation_units|shared_world_|public_experience_text_derivative_bodies|replay_source_manifest_items|session_id|audio_object_ref|transcript_text|body_text|committed_text' THEN
    RAISE EXCEPTION 'I-06C: the export sanitizer must read no source body and no private source identity';
  END IF;
  IF p.prosrc !~ 'replay_export_descriptor_digest_v1' THEN
    RAISE EXCEPTION 'I-06C: the export sanitizer must commit the digest of its own audience-visible surface';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = descriptor_digest_fn::regprocedure;
  IF p.prosrc ~ 'replay=|replayVersion=|manifest=|selection=|projection=|package=' THEN
    RAISE EXCEPTION 'I-06C: the exported descriptor digest must cover the sanitized surface and no internal identity';
  END IF;

  -- THE EFFECTIVE-STATE VOCABULARY IS DECIDED IN EXACTLY ONE PLACE.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = state_fn::regprocedure;
  IF p.prosrc !~ 'WITHDRAWN' OR p.prosrc !~ 'SUPERSEDED' OR p.prosrc !~ 'EFFECTIVE' THEN
    RAISE EXCEPTION 'I-06C: the approval effective state must distinguish WITHDRAWN SUPERSEDED and EFFECTIVE';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = effective_fn::regprocedure;
  IF p.prosrc !~ '''MISSING''' OR p.prosrc !~ 'replay_distribution_required_approvers' THEN
    RAISE EXCEPTION 'I-06C: a required human who never approved must be MISSING rather than absent from the answer';
  END IF;

  -- THE HUMAN IS DERIVED, NEVER SUPPLIED, and no mutation accepts an actor,
  -- authority, approver, fingerprint, descriptor, clearance or clock parameter.
  FOREACH fn IN ARRAY mutating LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc !~ 'u uuid := auth\.uid\(\);' THEN
      RAISE EXCEPTION 'I-06C: % must derive the human from auth.uid() and never from a parameter', fn;
    END IF;
    -- DECLARED INPUT NAMES ONLY (mode 'i'). A RETURNS TABLE function also lists
    -- its RESULT columns in `proargnames`, and several of those legitimately name
    -- the authority this slice reports - so a ban over the whole list would
    -- refuse every primitive here. The mode filter is non-vacuous precisely
    -- because every function in this list returns a table, which is asserted
    -- rather than assumed: `proargmodes` is NULL for an all-IN scalar function,
    -- and a mode-filtered ban over one of those checks nothing at all.
    IF (SELECT pr.proargmodes FROM pg_proc pr WHERE pr.oid = fn::regprocedure) IS NULL THEN
      RAISE EXCEPTION 'I-06C: % must declare argument modes, or the parameter ban below is vacuous', fn;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 'i'
         AND arg.name ~ '(actor|creator|owner|_user_id|approver|authority|audience|viewer|visib|safety|moderation|entitle|launch|clearance|feature|allow|fingerprint|digest|descriptor|sanitiz|_reference|required|resolution)'
    ) THEN
      RAISE EXCEPTION 'I-06C: % may not accept an actor authority approver fingerprint descriptor or clearance parameter', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY human LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 'i' AND arg.name ~ '(instant|timestamp|_at$)'
    ) THEN
      RAISE EXCEPTION 'I-06C: % accepts no clock: the ONE instant is read from the database', fn;
    END IF;
    IF (length(p.prosrc) - length(replace(p.prosrc, 'clock_timestamp()', ''))) / length('clock_timestamp()') <> 1 THEN
      RAISE EXCEPTION 'I-06C: % must read the database clock exactly once for every authoritative moment', fn;
    END IF;
    IF p.prosrc ~* 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
      RAISE EXCEPTION 'I-06C: % accepts no clock but one read of the database clock', fn;
    END IF;
    IF p.prosrc !~ 'REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT' THEN
      RAISE EXCEPTION 'I-06C: % must refuse a reused command identity carrying a different request', fn;
    END IF;
    -- REPLAY IS THE FIRST LOCK, ALWAYS.
    IF p.prosrc !~ 'FROM public\.replays r WHERE r\.id = [a-z_.]+ FOR UPDATE' THEN
      RAISE EXCEPTION 'I-06C: % must take the Replay row FOR UPDATE first', fn;
    END IF;
    IF p.prosrc !~ 'REPLAY_DISTRIBUTION_NOT_AVAILABLE' THEN
      RAISE EXCEPTION 'I-06C: a stranger and a nonexistent target must reach ONE bounded class in %', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY command_human LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF (length(p.prosrc) - length(replace(p.prosrc, 'WHERE c.id = p_command_id', ''))) / length('WHERE c.id = p_command_id') < 2 THEN
      RAISE EXCEPTION 'I-06C: % must check durable idempotency before any lock and again under it', fn;
    END IF;
    IF p.prosrc !~ 'committed\.request_ref' THEN
      RAISE EXCEPTION 'I-06C: % must decide retry equivalence on the whole request identity', fn;
    END IF;
  END LOOP;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = approve_fn::regprocedure;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'WHERE a.id = p_approval_id', ''))) / length('WHERE a.id = p_approval_id') < 2 THEN
    RAISE EXCEPTION 'I-06C: an approval IS its own durable record and must be checked before any lock and again under it';
  END IF;

  -- PREPARATION: Replay first, historical finalization proven, source second,
  -- authority third, the destination subsystem fourth, writes last - and it
  -- publishes, shares, downloads and delivers NOTHING.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = prepare_fn::regprocedure;
  replay_pos := strpos(p.prosrc, 'FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE');
  source_pos := strpos(p.prosrc, 'public.replay_lock_source_manifest_v1(version.source_manifest_version_id)');
  destination_pos := strpos(p.prosrc, 'FROM public.public_world_state w WHERE w.singleton FOR UPDATE');
  write_pos := strpos(p.prosrc, 'INSERT INTO public.replay_distribution_package_versions');
  IF replay_pos = 0 OR source_pos = 0 OR destination_pos = 0 OR write_pos = 0
     OR replay_pos > source_pos OR source_pos > write_pos OR write_pos > destination_pos THEN
    RAISE EXCEPTION 'I-06C: preparation locks the Replay first, stabilizes the source second, writes its own package third and reaches the destination subsystem last';
  END IF;
  IF p.prosrc !~ 'replay_version_finalizations' OR p.prosrc !~ 'REPLAY_DISTRIBUTION_VERSION_NOT_FINALIZED' THEN
    RAISE EXCEPTION 'I-06C: preparation must bind historical finalization evidence and refuse a version that never had it';
  END IF;
  IF p.prosrc !~ 'derive_replay_source_manifest_currency_v1' OR p.prosrc !~ 'REPLAY_SOURCE_STALE'
     OR p.prosrc !~ 'IF currency IS DISTINCT FROM ''CURRENT'' THEN' THEN
    RAISE EXCEPTION 'I-06C: preparation must revalidate source currency through the ONE frozen I-06A derivation';
  END IF;
  IF p.prosrc !~ 'derive_replay_distribution_required_approvers_v1'
     OR p.prosrc !~ 'derive_replay_export_descriptor_v1'
     OR p.prosrc !~ 'replay_distribution_authority_fingerprint_v1' THEN
    RAISE EXCEPTION 'I-06C: preparation must derive the required set, the sanitized surface and the authority identity';
  END IF;
  IF p.prosrc !~ 'rdx1_'' \|\| replace\(gen_random_uuid\(\)::text' THEN
    RAISE EXCEPTION 'I-06C: the audience-safe reference must be minted at random and derived from no internal identity';
  END IF;
  IF p.prosrc ~ 'INSERT INTO public\.replay_distribution_authorizations'
     OR p.prosrc ~ 'publish_public_experience_v1'
     OR p.prosrc ~ 'INSERT INTO public\.public_experience_publication_state'
     OR p.prosrc ~ 'INSERT INTO public\.public_experience_lifecycle_events'
     OR p.prosrc ~ 'INSERT INTO public\.publication_manifest_approvals' THEN
    RAISE EXCEPTION 'I-06C: preparing a package expands no audience: it publishes nothing, records no approval and authorizes nothing';
  END IF;

  -- THE PUBLIC BRIDGE CORE activates the reserved seam and grants nothing else.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = bridge_fn::regprocedure;
  IF p.prosrc !~ '''REPLAY_ARTIFACT''' OR p.prosrc !~ '''RESERVED'''
     OR p.prosrc !~ 'INSERT INTO public\.replay_public_distribution_artifacts' THEN
    RAISE EXCEPTION 'I-06C: the Public bridge core must activate the reserved REPLAY_ARTIFACT and RESERVED shapes explicitly';
  END IF;
  IF p.prosrc !~ 'derive_public_publication_authority_v1' THEN
    RAISE EXCEPTION 'I-06C: the Public rightsholder set must come from the ONE canonical Public derivation';
  END IF;
  IF p.prosrc ~ 'INSERT INTO public\.public_experience_controllers'
     OR p.prosrc ~ 'INSERT INTO public\.publication_manifest_approvals'
     OR p.prosrc ~ 'INSERT INTO public\.public_experience_lifecycle_events'
     OR p.prosrc ~ 'INSERT INTO public\.public_experience_publication_state'
     OR p.prosrc ~ 'SET current_lifecycle' THEN
    RAISE EXCEPTION 'I-06C: the Public bridge core grants no Experience control, records no approval and moves no Public lifecycle';
  END IF;
  IF p.prosrc !~ 'current_lifecycle <> ''DRAFT''' THEN
    RAISE EXCEPTION 'I-06C: a Public Replay package is prepared for a DRAFT Experience only';
  END IF;

  -- ONE HUMAN CONSENT ACT, BOTH EVIDENCE STORES, NEITHER BYPASSED.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = approve_fn::regprocedure;
  IF p.prosrc !~ 'INSERT INTO public\.replay_distribution_approvals'
     OR p.prosrc !~ 'INSERT INTO public\.publication_manifest_approvals'
     OR p.prosrc !~ 'derive_public_publication_authority_v1' THEN
    RAISE EXCEPTION 'I-06C: one human consent act must write both immutable evidence rows, the Public one through the canonical derivation';
  END IF;
  IF p.prosrc !~ 'NOT \(u = ANY\(derived\.required_approvers\)\)' THEN
    RAISE EXCEPTION 'I-06C: a human the package does not require must never record a valid approval';
  END IF;
  IF p.prosrc !~ 'REPLAY_DISTRIBUTION_STALE' THEN
    RAISE EXCEPTION 'I-06C: an approval over a package whose authority moved must be refused as stale';
  END IF;

  -- WITHDRAWAL IS APPEND-ONLY, OWN-APPROVAL ONLY, AND TAKES BACK BOTH HALVES.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = withdraw_fn::regprocedure;
  IF p.prosrc !~ 'approval\.approver_user_id <> u' THEN
    RAISE EXCEPTION 'I-06C: a human may withdraw only their OWN approval';
  END IF;
  IF p.prosrc !~ 'INSERT INTO public\.replay_distribution_approval_withdrawal_events'
     OR p.prosrc !~ 'withdraw_publication_approval_v1' THEN
    RAISE EXCEPTION 'I-06C: a withdrawal must append its own event and take back the canonical Public half through the frozen primitive';
  END IF;
  IF p.prosrc ~ '(UPDATE|DELETE FROM) public\.replay_distribution_approvals' THEN
    RAISE EXCEPTION 'I-06C: a withdrawal must never mutate the immutable approval it withdraws';
  END IF;

  -- THE DISTRIBUTION COMMIT revalidates everything, in order, and the CW2-08
  -- prerequisite is the LAST gate rather than a substitute for any other.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = authorize_fn::regprocedure;
  replay_pos := strpos(p.prosrc, 'FROM public.replays r WHERE r.id = package.replay_id FOR UPDATE');
  source_pos := strpos(p.prosrc, 'public.replay_lock_source_manifest_v1(package.source_manifest_version_id)');
  destination_pos := strpos(p.prosrc, 'FROM public.public_world_state w WHERE w.singleton FOR UPDATE');
  write_pos := strpos(p.prosrc, 'INSERT INTO public.replay_distribution_authorizations');
  IF replay_pos = 0 OR source_pos = 0 OR destination_pos = 0 OR write_pos = 0
     OR replay_pos > source_pos OR source_pos > destination_pos OR destination_pos > write_pos THEN
    RAISE EXCEPTION 'I-06C: the distribution commit locks the Replay first, the source second, the destination subsystem third and writes last';
  END IF;
  FOREACH t IN ARRAY ARRAY['derive_replay_source_manifest_currency_v1',
                           'derive_replay_distribution_authority_v1',
                           'derive_replay_distribution_effective_approvals_v1',
                           'derive_replay_export_descriptor_v1',
                           'resolve_replay_distribution_prerequisites_v1',
                           'ORDER BY a.approver_user_id FOR SHARE',
                           'replay_version_finalizations',
                           'REPLAY_DISTRIBUTION_APPROVALS_INCOMPLETE',
                           'REPLAY_DISTRIBUTION_APPROVAL_NOT_EFFECTIVE',
                           'REPLAY_DISTRIBUTION_PREREQUISITE_UNRESOLVED',
                           'REPLAY_DISTRIBUTION_STALE', 'REPLAY_SOURCE_STALE'] LOOP
    IF position(t IN p.prosrc) = 0 THEN
      RAISE EXCEPTION 'I-06C: the distribution commit must revalidate through %', t;
    END IF;
  END LOOP;
  IF strpos(p.prosrc, 'derive_replay_distribution_effective_approvals_v1')
     > strpos(p.prosrc, 'resolve_replay_distribution_prerequisites_v1') THEN
    RAISE EXCEPTION 'I-06C: the CW2-08 prerequisite is the LAST gate, after every privacy and ownership gate';
  END IF;
  -- THE EXACT CONDITION EACH GATE TESTS, not merely the function it consults and
  -- the class it raises: `IF false THEN` beside an untouched RAISE leaves both of
  -- those in place while the gate never fires again.
  IF p.prosrc !~ 'WHERE s\.effective_state = ''MISSING'''
     OR p.prosrc !~ 'WHERE s\.effective_state <> ''EFFECTIVE'''
     OR p.prosrc !~ 's\.bound_authority_fingerprint IS DISTINCT FROM derived\.authority_fingerprint'
     OR p.prosrc !~ 'stored IS DISTINCT FROM derived\.required_approvers'
     OR p.prosrc !~ 'derived\.authority_fingerprint IS DISTINCT FROM package\.authority_request_fingerprint'
     OR p.prosrc !~ 'recomputed IS DISTINCT FROM descriptor\.descriptor_digest'
     OR p.prosrc !~ 'IF currency IS DISTINCT FROM ''CURRENT'' THEN' THEN
    RAISE EXCEPTION 'I-06C: the distribution commit must test the EXACT condition of every gate, never merely consult the function that answers it';
  END IF;
  IF p.prosrc !~ 'gate\.safety_state IS DISTINCT FROM ''SAFETY_ALLOW'''
     OR p.prosrc !~ 'gate\.moderation_state IS DISTINCT FROM ''MODERATION_ALLOW'''
     OR p.prosrc !~ 'gate\.entitlement_state IS DISTINCT FROM ''ENTITLED'''
     OR p.prosrc !~ 'gate\.feature_state IS DISTINCT FROM ''FEATURE_ENABLED'''
     OR p.prosrc !~ 'gate\.launch_state IS DISTINCT FROM ''LAUNCH_CLEARED''' THEN
    RAISE EXCEPTION 'I-06C: every CW2-08 dimension must clear on its own: no layer manufactures another';
  END IF;
  IF p.prosrc !~ 'publish_public_experience_v1' THEN
    RAISE EXCEPTION 'I-06C: a Public Replay publication must go through the CANONICAL Public publish boundary';
  END IF;
  IF p.prosrc ~ 'INSERT INTO public\.public_experience_publication_state'
     OR p.prosrc ~ 'UPDATE public\.public_experiences' THEN
    RAISE EXCEPTION 'I-06C: the canonical Public publication record is the ONE Public publication truth and this slice never writes it directly';
  END IF;
  IF p.prosrc !~ '''AUTHORIZED_FOR_DELIVERY''' THEN
    RAISE EXCEPTION 'I-06C: with no transport boundary an external share or download is authorized and never delivered';
  END IF;

  -- THE READ BOUNDARIES are exact, bounded and disclose nothing private. Result
  -- columns (mode 't') are checked by name.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = package_resolver::regprocedure;
  IF p.prosrc !~ 'r\.created_by_user_id = p_user_id' THEN
    RAISE EXCEPTION 'I-06C: the package resolver answers the exact Replay creator and nobody else';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
     WHERE pr.oid = package_resolver::regprocedure AND arg.mode = 't'
       AND arg.name ~ '(user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material|history_item|availability|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|experience|approver_user|basis|reason)'
  ) THEN
    RAISE EXCEPTION 'I-06C: the package resolver must disclose no approver identity no source identity and no refusal reason';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = public_resolver::regprocedure;
  IF p.prosrc !~ 'resolve_public_visibility_state_v1' OR p.prosrc !~ 'resolve_public_audience_admission_v1' THEN
    RAISE EXCEPTION 'I-06C: the Public Replay artifact resolver must compose the canonical visibility state and the canonical audience admission gate';
  END IF;
  IF p.prosrc !~ 'd\.audience_safe_reference = p_audience_safe_reference' THEN
    RAISE EXCEPTION 'I-06C: a Public Replay artifact is addressed by its opaque audience reference and never by an internal identity';
  END IF;
  IF p.prosrc ~ 'current_lifecycle' THEN
    RAISE EXCEPTION 'I-06C: the Public Replay artifact resolver tests no lifecycle for itself: the canonical visibility derivation owns that';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
     WHERE pr.oid = public_resolver::regprocedure AND arg.mode = 't'
       AND arg.name ~ '(user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material|history_item|availability|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|replay|manifest|selection|render_contract|distribution)'
  ) THEN
    RAISE EXCEPTION 'I-06C: the Public Replay artifact resolver must expose no Replay no source and no distribution identity';
  END IF;

  -- THE CANONICAL PUBLIC AUTHORITY DERIVATION KEPT EVERY RULE IT HAD, and gained
  -- exactly the reserved branch - closed in BOTH directions.
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
    INTO p FROM pg_proc pr WHERE pr.oid = public_authority_fn::regprocedure;
  IF p.owner <> 'postgres' OR NOT p.prosecdef OR p.provolatile <> 's' THEN
    RAISE EXCEPTION 'I-06C: the canonical Public authority derivation must stay postgres-owned SECURITY DEFINER and STABLE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-06C: the canonical Public authority derivation must keep its empty search_path';
  END IF;
  FOREACH t IN ARRAY ARRAY['manifest.intended_publication_action',
                           'availability_state <> ''AVAILABLE''',
                           'availability_revision <> p.captured_availability_revision',
                           'captured_source_digest',
                           'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED',
                           'shared_world_material_historical_authority',
                           'shared_world_history_item_required_approvers',
                           'replay_public_distribution_artifacts',
                           'replay_distribution_required_approvers',
                           'REPLAY_ARTIFACT'] LOOP
    IF position(t IN p.prosrc) = 0 THEN
      RAISE EXCEPTION 'I-06C: the extended canonical Public authority derivation must keep or gain %', t;
    END IF;
  END LOOP;
  IF p.prosrc ~ 'PREPARE_PUBLICATION' THEN
    RAISE EXCEPTION 'I-06C: a preparation command is never publication consent';
  END IF;
  IF p.prosrc ~ 'INSERT INTO' OR p.prosrc ~ 'UPDATE public' OR p.prosrc ~ 'DELETE FROM' THEN
    RAISE EXCEPTION 'I-06C: the canonical Public authority derivation must still write nothing';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['public', 'anon', 'authenticated'] LOOP
    IF has_function_privilege(role_name, public_authority_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-06C: % must not execute the canonical Public authority derivation', role_name;
    END IF;
  END LOOP;

  -- THE COMMAND HISTORY IS NARROW, SEALED AND STRUCTURALLY BOUND TO THE CREATOR.
  FOREACH t IN ARRAY own_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
       WHERE a.attrelid = ('public.' || t)::regclass AND a.attnum > 0 AND NOT a.attisdropped
         AND (a.attname ~ '(body|_text$|transcript|audio|content|payload|reason|note|safety|moderation|launch|entitle|allow|world_type|member|url|uri|path|filename|storage)'
              OR ty.typname IN ('json', 'jsonb', 'bytea'))
    ) THEN
      RAISE EXCEPTION 'I-06C: command history % may carry no content reason clearance or transport column', t;
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
    FOREACH role_name IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN role_name <> 'public' AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name);
      IF has_table_privilege(role_name, ('public.' || t)::regclass, 'SELECT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'INSERT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'UPDATE')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'DELETE') THEN
        RAISE EXCEPTION 'I-06C: relation % must hold no privilege for %', t, role_name;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['replay_distribution_prepare_commands',
                           'replay_distribution_authorization_commands'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid = 'public.replays'::regclass AND cardinality(c.confkey) = 2 AND c.confdeltype = 'r'
    ) THEN
      RAISE EXCEPTION 'I-06C: % must bind its actor to the exact Replay creator through the identity key', t;
    END IF;
  END LOOP;

  -- THE FROZEN TRUTHS THIS RUNTIME CONSUMES MUST STILL BE INTACT.
  IF to_regprocedure('public.replay_lock_source_manifest_v1(uuid)') IS NULL
     OR to_regprocedure('public.derive_replay_source_manifest_currency_v1(uuid)') IS NULL
     OR to_regprocedure('public.publish_public_experience_v1(uuid, uuid, uuid)') IS NULL
     OR to_regprocedure('public.withdraw_publication_approval_v1(uuid, uuid)') IS NULL
     OR to_regprocedure('public.resolve_public_visibility_state_v1(uuid)') IS NULL
     OR to_regprocedure('public.resolve_public_audience_admission_v1(uuid)') IS NULL THEN
    RAISE EXCEPTION 'I-06C: the frozen I-06A source path and the canonical Public publish visibility admission and withdrawal boundaries must all exist';
  END IF;
  FOREACH t IN ARRAY ARRAY['replay_distribution_package_versions', 'replay_distribution_approvals',
                           'replay_distribution_approval_withdrawal_events',
                           'replay_distribution_export_descriptors',
                           'replay_public_distribution_artifacts',
                           'replay_distribution_authorizations'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
       WHERE tg.tgrelid = ('public.' || t)::regclass AND NOT tg.tgisinternal
         AND tg.tgfoid = 'public.reject_replay_distribution_mutation_v1'::regproc
    ) THEN
      RAISE EXCEPTION 'I-06C: the 0104 append-only guard on % must still be in place', t;
    END IF;
  END LOOP;
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)'::regprocedure)
     !~ 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'I-06C: the frozen CW2-08 Public prerequisite seam must still answer NOT_EVALUATED';
  END IF;
END$$;

COMMIT;
