-- I-06A - Replay Authorized Source Capture and Draft Runtime v1 (PART B).
--
-- Migration 0100 created the stable Replay identity, the immutable source
-- manifest and selection-spec versions and the ONE draft composition pointer.
-- Neither of them can write a row. This migration creates the only things that
-- ever do: the durable command history, the internal source-capture core, the
-- internal selection core, the source-currency derivation, the two human
-- primitives and the ONE creator-exact read boundary.
--
-- ===========================================================================
-- What I-06A can and cannot produce
-- ===========================================================================
--
--   DRAFT   the only lifecycle any function here writes
--
-- No function here writes PREVIEW_READY or FINALIZED, creates a REPLAY_VERSION,
-- renders anything, or creates any distribution, publication, share, download
-- or export state. Creating a Replay draft is CREATE_INTERNAL_REPLAY_DRAFT,
-- which the merged I-01A kernel classifies as NO_AUDIENCE_EXPANSION: it creates
-- no audience, reserves no distribution right, requires no distribution
-- approval, and does not become public because its source was public.
--
-- ===========================================================================
-- Creation authority is the exact human, derived, never supplied
-- ===========================================================================
--
-- Both human primitives derive the creator from auth.uid() and accept no actor,
-- creator, owner or user parameter of any kind; the internal cores derive the
-- same session subject again and refuse to act for any other Replay. QANDEEL
-- and the service tier are executors, never the human consent principal. As in
-- every predecessor consequential primitive since I-04B, the mutation surface
-- is executable by NO application role - PUBLIC, anon, authenticated and
-- service_role alike - because the frozen CW2-08 Launch Gate that would make it
-- reachable is unimplemented. A later reviewed launch-gated wrapper preserves
-- the exact human's own session claims and calls these primitives; nothing here
-- forbids one, and nothing here claims SAFETY, LAUNCH or ENTITLEMENT clearance.
--
-- ===========================================================================
-- Three source adapters, one bounded refusal class
-- ===========================================================================
--
-- MY_WORLD           the creator's OWN committed Conversational Units (0064)
--                    of one Session they own. Both delivered human and
--                    delivered QANDEEL text are original source events inside
--                    the owner's private Replay - this is creator-private and
--                    widens no audience. No Personal audio or call source is
--                    fabricated: none exists in this repository.
-- SHARED_WORLD       exact material the creator may currently SEE, decided by
--                    the ONE canonical I-04F entry point
--                    resolve_shared_world_history_visibility_v1 and never
--                    re-derived from membership, member count, material
--                    ownership or a Standing Context Grant. A former member or a
--                    closed-World viewer is eligible exactly when that resolver
--                    says the exact item is visible to them. The four
--                    implemented kinds are bindable; a voice note binds as
--                    original-audio identity WITHOUT copying its opaque media
--                    handle anywhere; the two RESERVED kinds have no producer
--                    and are unselectable.
-- PUBLIC_EXPERIENCE  the exact bounded public package of the CURRENT version of
--                    an Experience the creator CONTROLS. Authority is
--                    EXPERIENCE_CONTROL_AUTHORITY - never public visibility,
--                    viewer admission, having read it or knowing its id - so an
--                    ordinary viewer cannot rebuild somebody else's Experience.
--                    The adapter consumes the public derivative itself and
--                    never traverses the sealed provenance into hidden Personal
--                    or Shared source. A non-current version and an absent
--                    Experience fail closed rather than inventing historical
--                    controller access.
--
-- A nonexistent source, a source owned by another human, Shared history the
-- creator may not see and an Experience the creator does not control all
-- receive ONE bounded class, REPLAY_SOURCE_NOT_AVAILABLE, so no primitive here
-- is an existence, ownership, membership or control oracle. A reserved kind is
-- refused with its own class only after visibility or control is proven.
--
-- ===========================================================================
-- Source currency: a draft goes stale, history is never rewritten
-- ===========================================================================
--
-- Every capture and every revision revalidates current source truth UNDER LOCK
-- before the draft becomes durable. A revision over an existing manifest asks
-- the ONE currency derivation whether every bound source is still available at
-- its captured revision and digest, still visible to the creator (Shared) and
-- still the controlled current version (Public); if not, the old prepared state
-- cannot silently commit. Old manifests are never mutated to "fix" them: a
-- changed source set is a new manifest version. Finalization-time source-loss
-- enforcement belongs to I-06B / I-06D.
--
-- ===========================================================================
-- The canonical Replay lock order
-- ===========================================================================
--
--   1  public.replays                    FOR UPDATE   the Replay being composed
--   2  the source domain, in that domain's OWN frozen relative order, SHARE:
--        MY_WORLD           session_semantic_clocks (owner-scoped)
--                           -> conversation_units by id
--        SHARED_WORLD       shared_worlds -> shared_world_materials by id
--                           -> shared_world_history_items by id
--        PUBLIC_EXPERIENCE  public_world_state -> public_experiences
--                           -> publication_package_manifest_versions
--   3  the Replay rows the primitive writes
--
-- Replay is always the FIRST lock and every source lock is a SHARE lock taken
-- in the order the owning domain already takes: Personal writers take the
-- Session clock first, I-04 mutations take the World row then materials then
-- history items, Public mutations take the singleton then the Experience then
-- the manifest. No predecessor writer ever takes a Replay lock, so no Replay
-- lock can be the second edge of a cycle; a Replay path that locked source then
-- Replay would be the inversion this order exists to forbid, and the
-- self-assertions refuse it. Holding the SHARE locks while deciding AND writing
-- is what stops a visibility, ownership or availability answer going stale
-- between the check and the commit. No advisory lock, table lock or process
-- mutex exists anywhere here.
--
-- ===========================================================================
-- Selection: derived order, proven coverage, no hallucinated source
-- ===========================================================================
--
-- A selection names manifest items by their stable source identities and, per
-- item, either the whole item or a code-point range inside a text item. The
-- selected ORDER is derived from the manifest's canonical order - there is no
-- ordinal parameter - so a caller cannot reverse chronology; the 0100 trigger
-- makes a reversal unrepresentable as well. Contiguity in the captured SOURCE
-- universe is derived and recorded as machine truth. FULL_SOURCE is granted
-- only when the manifest captured the complete authorized universe and every
-- item is selected whole; otherwise the request is refused, never downgraded
-- silently and never accepted on the caller's word. No column says a cut is
-- render-safe: Semantic Cut Safety is I-06B.
--
-- Natural-language selection: the frozen law is that an instruction operates
-- only over authorized existing source, that an unresolved request is UNKNOWN,
-- and that Replay never hallucinates a likely segment. This repository has no
-- reviewed provider seam that could build an authorized bounded universe of
-- opaque handles and hand back only handles from that universe, so no such
-- resolver is faked here: the ONE writer accepts RESOLVED ANCHORS only and
-- records EXPLICIT_RESOLVED_ANCHORS. The vocabulary value for a resolved
-- natural-language selection exists on the 0100 relation for a later reviewed
-- seam and is written by nothing in this migration.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- No REPLAY_VERSION, analytical projection, render contract, preview,
-- finalization, rendering, timing, caption, media, export, distribution
-- package, distribution approval, publish, share or download; no Safety,
-- moderation, entitlement, feature flag or Launch Gate decision; no route,
-- controller, RPC or mobile surface; no mutation of any Personal, Shared or
-- Public relation - every source relation is read and SHARE-locked only. It
-- alters no predecessor table. Migrations 0001-0100 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE DURABLE COMMAND HISTORY.
--
--    One narrow relation per command family, never a generic event engine. Each
--    row is the idempotency key AND the exact committed answer: an equivalent
--    retry is served from here rather than by re-reading current state, so a
--    later source loss or revision never makes a historical command answer
--    differently. `request_ref` binds the WHOLE immutable request, so an
--    equivalent retry and a different request under one identity are
--    distinguishable. The actor is bound to the Replay creator STRUCTURALLY,
--    through the 0100 identity key: a command can never name a human who is
--    not the creator of the Replay it created or revised.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_create_commands (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    source_manifest_version_id uuid NOT NULL,
    selection_spec_version_id uuid NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT replay_create_commands_pk PRIMARY KEY (id),
    CONSTRAINT replay_create_commands_replay_key UNIQUE (replay_id),
    CONSTRAINT replay_create_commands_request_check CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT replay_create_commands_creator_fk
        FOREIGN KEY (replay_id, actor_user_id)
        REFERENCES public.replays (id, created_by_user_id) ON DELETE RESTRICT,
    CONSTRAINT replay_create_commands_manifest_fk
        FOREIGN KEY (source_manifest_version_id, replay_id)
        REFERENCES public.replay_source_manifest_versions (id, replay_id) ON DELETE RESTRICT,
    CONSTRAINT replay_create_commands_selection_fk
        FOREIGN KEY (selection_spec_version_id, source_manifest_version_id)
        REFERENCES public.replay_selection_spec_versions (id, source_manifest_version_id) ON DELETE RESTRICT
);

CREATE TABLE public.replay_draft_revision_commands (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    resulting_draft_revision bigint NOT NULL,
    source_manifest_version_id uuid NOT NULL,
    selection_spec_version_id uuid NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT replay_draft_revision_commands_pk PRIMARY KEY (id),
    -- One committed revision number per Replay: two competing revisions can
    -- never both commit the same step even if every procedural check were
    -- somehow bypassed.
    CONSTRAINT replay_draft_revision_commands_revision_key UNIQUE (replay_id, resulting_draft_revision),
    CONSTRAINT replay_draft_revision_commands_revision_check CHECK (resulting_draft_revision >= 2),
    CONSTRAINT replay_draft_revision_commands_request_check CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT replay_draft_revision_commands_creator_fk
        FOREIGN KEY (replay_id, actor_user_id)
        REFERENCES public.replays (id, created_by_user_id) ON DELETE RESTRICT,
    CONSTRAINT replay_draft_revision_commands_manifest_fk
        FOREIGN KEY (source_manifest_version_id, replay_id)
        REFERENCES public.replay_source_manifest_versions (id, replay_id) ON DELETE RESTRICT,
    CONSTRAINT replay_draft_revision_commands_selection_fk
        FOREIGN KEY (selection_spec_version_id, source_manifest_version_id)
        REFERENCES public.replay_selection_spec_versions (id, source_manifest_version_id) ON DELETE RESTRICT
);

CREATE INDEX replay_draft_revision_commands_replay_idx
    ON public.replay_draft_revision_commands (replay_id, resulting_draft_revision);

ALTER TABLE public.replay_create_commands OWNER TO postgres;
ALTER TABLE public.replay_draft_revision_commands OWNER TO postgres;
ALTER TABLE public.replay_create_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_draft_revision_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.replay_create_commands, public.replay_draft_revision_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.replay_create_commands, public.replay_draft_revision_commands FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 2. THE CANONICAL SELECTION REQUEST TOKEN.
--
--    Sorted `item@start-end` tokens, so the selection half of a request
--    identity is a property of the selection and not of the order a caller
--    happened to supply it in. Presence and value of a range are distinguished,
--    so a whole item and a range over it never fingerprint alike.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.replay_selection_request_token_v1(
  p_selected_source_item_ids uuid[], p_range_starts integer[], p_range_ends integer[]
) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT coalesce((
    SELECT string_agg(lower(s.sid::text) || '@'
                      || CASE WHEN s.rs IS NULL THEN 'WHOLE' ELSE s.rs::text || '-' || s.re::text END,
                      ',' ORDER BY lower(s.sid::text) COLLATE "C")
      FROM unnest(p_selected_source_item_ids, p_range_starts, p_range_ends) AS s(sid, rs, re)), '')
$$;

ALTER FUNCTION public.replay_selection_request_token_v1(uuid[], integer[], integer[]) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 3. THE INTERNAL SOURCE CAPTURE CORE.
--
--    Called only by the two human primitives, which already hold the Replay row
--    FOR UPDATE. It derives the creator again from auth.uid() and refuses to act
--    on a Replay that human did not create, so it can never be turned into a
--    capture on somebody's behalf. It writes one immutable manifest version and
--    its items and NOTHING else; it reads the database clock never - the ONE
--    instant is the caller's.
--
--    Every class: authority is proven, the source rows are SHARE-locked in the
--    owning domain's order, existence and kind and body are re-established from
--    the locked rows, and only then is the binding written. Every derived value
--    - order, universe rank, digest, medium, availability, anchor - comes from
--    the locked rows, never from a parameter.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.replay_capture_source_manifest_v1(
  p_replay_id uuid,
  p_source_manifest_version_id uuid,
  p_manifest_revision integer,
  p_source_class text,
  p_source_context_id uuid,
  p_source_version_id uuid,
  p_source_item_ids uuid[],
  p_capture_instant timestamptz
) RETURNS TABLE(captured_item_count integer, captured_universe_item_count integer)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
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
         AND m.material_kind NOT IN ('HUMAN_TEXT', 'HUMAN_VOICE_NOTE', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS')
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
END$$;

ALTER FUNCTION public.replay_capture_source_manifest_v1(uuid, uuid, integer, text, uuid, uuid, uuid[], timestamptz) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 4. THE INTERNAL SOURCE LOCK FOR AN EXISTING MANIFEST.
--
--    A revision over an existing manifest must stabilize the same source rows
--    a capture stabilizes, in the same order, before it asks whether they are
--    still current. Owner-scoped exactly as the capture is.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.replay_lock_source_manifest_v1(p_source_manifest_version_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  manifest public.replay_source_manifest_versions;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT m.* INTO manifest FROM public.replay_source_manifest_versions m
    JOIN public.replays r ON r.id = m.replay_id
   WHERE m.id = p_source_manifest_version_id AND r.created_by_user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF manifest.source_class = 'MY_WORLD' THEN
    PERFORM 1 FROM public.session_semantic_clocks c
      WHERE c.session_id = manifest.personal_session_id AND c.user_id = u FOR SHARE;
    PERFORM 1 FROM public.conversation_units cu
      WHERE cu.id IN (SELECT i.personal_conversation_unit_id FROM public.replay_source_manifest_items i
                       WHERE i.manifest_version_id = manifest.id)
      ORDER BY cu.id FOR SHARE;
  ELSIF manifest.source_class = 'SHARED_WORLD' THEN
    PERFORM 1 FROM public.shared_worlds w WHERE w.id = manifest.shared_world_id FOR SHARE;
    PERFORM 1 FROM public.shared_world_materials m
      WHERE m.id IN (SELECT i.shared_material_id FROM public.replay_source_manifest_items i
                      WHERE i.manifest_version_id = manifest.id)
      ORDER BY m.id FOR SHARE;
    PERFORM 1 FROM public.shared_world_history_items i
      WHERE i.id IN (SELECT mi.shared_history_item_id FROM public.replay_source_manifest_items mi
                      WHERE mi.manifest_version_id = manifest.id)
      ORDER BY i.id FOR SHARE;
  ELSE
    PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR SHARE;
    PERFORM 1 FROM public.public_experiences e WHERE e.id = manifest.public_experience_id FOR SHARE;
    PERFORM 1 FROM public.publication_package_manifest_versions pm
      WHERE pm.id = manifest.public_manifest_version_id FOR SHARE;
  END IF;
END$$;

ALTER FUNCTION public.replay_lock_source_manifest_v1(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 5. THE ONE SOURCE-CURRENCY DERIVATION.
--
--    Read-only, STABLE, takes no lock: a caller that needs a stable answer holds
--    the source rows, exactly as the frozen Public derivations document. It asks
--    of CURRENT state whether every bound source is still exactly what the
--    manifest captured and still legitimately available to the creator:
--
--      MY_WORLD           the unit still exists, owned by the creator, at the
--                         captured position, with the captured digest
--      SHARED_WORLD       AVAILABLE at the captured availability revision, the
--                         body still digests to the captured value, and the
--                         creator may still SEE it through the ONE canonical
--                         I-04F entry point
--      PUBLIC_EXPERIENCE  the creator still controls the Experience, the bound
--                         version is still its eligible current version, and
--                         the public item still digests to the captured value
--
--    Availability is answered before access, and a raise of the consumed
--    resolver is an access loss rather than an error a caller can read. The
--    bounded staleness class is INTERNAL: the read boundary below returns the
--    two-state currency only. The derived answer never rewrites history - a
--    stale manifest stays exactly as captured.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_replay_source_manifest_currency_v1(p_source_manifest_version_id uuid)
RETURNS TABLE(currency_state text, staleness_class text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  manifest public.replay_source_manifest_versions;
  creator uuid;
  visible uuid[];
BEGIN
  IF p_source_manifest_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT m.* INTO manifest FROM public.replay_source_manifest_versions m
   WHERE m.id = p_source_manifest_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT r.created_by_user_id INTO creator FROM public.replays r WHERE r.id = manifest.replay_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  IF manifest.source_class = 'MY_WORLD' THEN
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
       WHERE i.manifest_version_id = manifest.id
         AND NOT EXISTS (SELECT 1 FROM public.conversation_units cu
                          WHERE cu.id = i.personal_conversation_unit_id
                            AND cu.session_id = i.personal_session_id AND cu.user_id = creator
                            AND cu.session_position = i.personal_session_position)
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_UNAVAILABLE'::text; RETURN;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        JOIN public.conversation_units cu ON cu.id = i.personal_conversation_unit_id
       WHERE i.manifest_version_id = manifest.id
         AND ('sha256:' || encode(sha256(convert_to(cu.committed_text, 'UTF8')), 'hex')) <> i.captured_source_digest
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CHANGED'::text; RETURN;
    END IF;
  ELSIF manifest.source_class = 'SHARED_WORLD' THEN
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        JOIN public.shared_world_history_items h ON h.id = i.shared_history_item_id
       WHERE i.manifest_version_id = manifest.id AND h.availability_state <> 'AVAILABLE'
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_UNAVAILABLE'::text; RETURN;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        JOIN public.shared_world_history_items h ON h.id = i.shared_history_item_id
        JOIN public.shared_world_materials m ON m.id = i.shared_material_id
        LEFT JOIN public.shared_world_text_material_bodies t ON t.material_id = m.id
        LEFT JOIN public.shared_world_voice_note_material_bodies vn ON vn.material_id = m.id
       WHERE i.manifest_version_id = manifest.id
         AND (h.availability_revision <> i.captured_availability_revision
              OR (t.material_id IS NULL AND vn.material_id IS NULL)
              OR ('sha256:' || encode(sha256(convert_to(
                    CASE WHEN m.material_kind = 'HUMAN_VOICE_NOTE'
                         THEN vn.audio_object_ref || E'\n' || coalesce(vn.transcript_text, '')
                         ELSE t.body_text END, 'UTF8')), 'hex')) IS DISTINCT FROM i.captured_source_digest)
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CHANGED'::text; RETURN;
    END IF;
    BEGIN
      SELECT array_agg(v.history_item_id) INTO visible
        FROM public.resolve_shared_world_history_visibility_v1(manifest.shared_world_id, creator) v;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_ACCESS_LOST'::text; RETURN;
    END;
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
       WHERE i.manifest_version_id = manifest.id
         AND NOT (i.shared_history_item_id = ANY(coalesce(visible, ARRAY[]::uuid[])))
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_ACCESS_LOST'::text; RETURN;
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                    WHERE c.experience_id = manifest.public_experience_id AND c.controller_user_id = creator) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_ACCESS_LOST'::text; RETURN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.public_experiences e
                    WHERE e.id = manifest.public_experience_id
                      AND e.current_experience_version_id = manifest.public_experience_version_id
                      AND e.current_lifecycle IN ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED')) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_VERSION_NOT_CURRENT'::text; RETURN;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        LEFT JOIN public.publication_package_manifest_items it
          ON it.manifest_version_id = i.public_manifest_version_id AND it.package_item_id = i.public_package_item_id
        LEFT JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
       WHERE i.manifest_version_id = manifest.id
         AND (it.package_item_id IS NULL OR b.package_item_id IS NULL
              OR it.public_body_digest <> i.captured_source_digest)
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CHANGED'::text; RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT 'CURRENT'::text, NULL::text;
END$$;

ALTER FUNCTION public.derive_replay_source_manifest_currency_v1(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 6. THE INTERNAL SELECTION CORE.
--
--    Called only by the two human primitives, over a manifest they already hold
--    and have just captured or just proven current. It resolves stable manifest
--    identities and exact anchors into one immutable selection-spec version:
--    the selected order is DERIVED from the manifest's canonical order,
--    contiguity is derived from the captured universe ranks, and FULL_SOURCE
--    is granted only when it is provable. It writes the spec and its items and
--    nothing else, and reads no clock.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.replay_resolve_selection_spec_v1(
  p_replay_id uuid,
  p_source_manifest_version_id uuid,
  p_selection_spec_version_id uuid,
  p_selection_revision integer,
  p_selected_source_item_ids uuid[],
  p_range_starts integer[],
  p_range_ends integer[],
  p_requested_coverage_class text,
  p_selection_instant timestamptz
) RETURNS TABLE(resolved_coverage_class text, resolved_selected_item_count integer, resolved_source_contiguous boolean)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  manifest public.replay_source_manifest_versions;
  selected integer := cardinality(p_selected_source_item_ids);
  matched integer;
  whole integer;
  contiguous boolean;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_replay_id IS NULL OR p_source_manifest_version_id IS NULL OR p_selection_spec_version_id IS NULL
     OR p_selection_revision IS NULL OR p_selection_instant IS NULL
     OR p_requested_coverage_class IS NULL
     OR p_requested_coverage_class NOT IN ('FULL_SOURCE', 'SELECTED_EXCERPT', 'HIGHLIGHT_SELECTION')
     OR p_selected_source_item_ids IS NULL OR selected = 0
     OR array_position(p_selected_source_item_ids, NULL) IS NOT NULL
     OR (SELECT count(DISTINCT x) FROM unnest(p_selected_source_item_ids) x) <> selected
     OR p_range_starts IS NULL OR p_range_ends IS NULL
     OR cardinality(p_range_starts) <> selected OR cardinality(p_range_ends) <> selected THEN
    RAISE EXCEPTION 'REPLAY_SELECTION_INVALID' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_range_starts, p_range_ends) AS s(rs, re)
     WHERE (s.rs IS NULL) <> (s.re IS NULL) OR s.rs < 0 OR s.re <= s.rs
  ) THEN
    RAISE EXCEPTION 'REPLAY_SELECTION_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT m.* INTO manifest FROM public.replay_source_manifest_versions m
    JOIN public.replays r ON r.id = m.replay_id
   WHERE m.id = p_source_manifest_version_id AND m.replay_id = p_replay_id AND r.created_by_user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- EVERY SELECTED IDENTITY IS AN ITEM OF THIS EXACT MANIFEST. An identity
  -- outside the authorized universe the manifest captured is not a selection.
  SELECT count(*)::integer INTO matched
    FROM public.replay_source_manifest_items mi
   WHERE mi.manifest_version_id = manifest.id
     AND coalesce(mi.personal_conversation_unit_id, mi.shared_material_id, mi.public_package_item_id)
         = ANY(p_selected_source_item_ids);
  IF matched <> selected THEN
    RAISE EXCEPTION 'REPLAY_SELECTION_INVALID' USING ERRCODE='22023';
  END IF;

  -- A RANGE IS A SOURCE-NATIVE ANCHOR INSIDE A TEXT ITEM, bounded by the exact
  -- current length of that item; audio identity takes no code-point range here.
  IF EXISTS (
    SELECT 1
      FROM unnest(p_selected_source_item_ids, p_range_starts, p_range_ends) AS s(sid, rs, re)
      JOIN public.replay_source_manifest_items mi
        ON mi.manifest_version_id = manifest.id
       AND coalesce(mi.personal_conversation_unit_id, mi.shared_material_id, mi.public_package_item_id) = s.sid
      LEFT JOIN public.conversation_units cu ON cu.id = mi.personal_conversation_unit_id
      LEFT JOIN public.shared_world_text_material_bodies t ON t.material_id = mi.shared_material_id
      LEFT JOIN public.public_experience_text_derivative_bodies pb ON pb.package_item_id = mi.public_package_item_id
     WHERE s.rs IS NOT NULL
       AND (mi.original_medium <> 'ORIGINAL_TEXT'
            OR s.re > coalesce(cu.source_span_end - cu.source_span_start, length(t.body_text), length(pb.public_text_body), -1))
  ) THEN
    RAISE EXCEPTION 'REPLAY_SELECTION_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT count(*)::integer INTO whole FROM unnest(p_range_starts) AS s(rs) WHERE s.rs IS NULL;
  -- CONTIGUITY IN THE CAPTURED SOURCE UNIVERSE, derived: the selected items'
  -- universe ranks form one unbroken run, or they do not.
  SELECT (max(mi.source_universe_rank) - min(mi.source_universe_rank) + 1 = selected) INTO contiguous
    FROM public.replay_source_manifest_items mi
   WHERE mi.manifest_version_id = manifest.id
     AND coalesce(mi.personal_conversation_unit_id, mi.shared_material_id, mi.public_package_item_id)
         = ANY(p_selected_source_item_ids);

  -- FULL_SOURCE IS PROVEN OR REFUSED. Never downgraded silently, never taken on
  -- the caller's word: the manifest must have captured the complete authorized
  -- universe and every item must be selected whole with no gap.
  IF p_requested_coverage_class = 'FULL_SOURCE'
     AND NOT (manifest.universe_complete AND selected = manifest.item_count AND whole = selected AND contiguous) THEN
    RAISE EXCEPTION 'REPLAY_COVERAGE_NOT_PROVABLE' USING ERRCODE='22023',
      DETAIL='FULL_SOURCE requires the complete authorized source universe selected whole and without a gap; a selection that omits source may never claim it.';
  END IF;

  INSERT INTO public.replay_selection_spec_versions
    (id, replay_id, source_manifest_version_id, manifest_universe_complete, selection_revision,
     selection_method, coverage_class, manifest_item_count, selected_item_count, whole_item_count,
     source_contiguous, created_at)
  VALUES (p_selection_spec_version_id, p_replay_id, manifest.id, manifest.universe_complete, p_selection_revision,
          'EXPLICIT_RESOLVED_ANCHORS', p_requested_coverage_class, manifest.item_count, selected, whole,
          contiguous, p_selection_instant);

  INSERT INTO public.replay_selection_spec_items
    (selection_spec_version_id, source_manifest_version_id, source_item_ordinal, selected_ordinal,
     anchor_kind, range_start, range_end)
  SELECT p_selection_spec_version_id, manifest.id, mi.source_item_ordinal,
         (row_number() OVER (ORDER BY mi.source_item_ordinal))::integer,
         CASE WHEN s.rs IS NULL THEN 'WHOLE_ITEM' ELSE 'TEXT_CODE_POINT_RANGE' END,
         s.rs, s.re
    FROM unnest(p_selected_source_item_ids, p_range_starts, p_range_ends) AS s(sid, rs, re)
    JOIN public.replay_source_manifest_items mi
      ON mi.manifest_version_id = manifest.id
     AND coalesce(mi.personal_conversation_unit_id, mi.shared_material_id, mi.public_package_item_id) = s.sid
   ORDER BY mi.source_item_ordinal;

  RETURN QUERY SELECT p_requested_coverage_class, selected, contiguous;
END$$;

ALTER FUNCTION public.replay_resolve_selection_spec_v1(uuid, uuid, uuid, integer, uuid[], integer[], integer[], text, timestamptz) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 7. CREATE A PRIVATE REPLAY DRAFT.
--
--    The creating human is exactly auth.uid(). The caller supplies opaque
--    persistence identities, the source class and context, the exact source
--    items and the exact resolved selection - and no actor, authority,
--    audience, order, digest, medium, coverage proof or instant. ONE database
--    clock read serves every authoritative moment of the birth.
--
--    The birth is atomic: the identity, the first manifest version, the first
--    selection-spec version, the draft pointer at revision 1 and the command
--    commit together or not at all. Creation widens no audience: nothing here
--    reads or writes a distribution, publication, approval or membership row.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.create_replay_draft_v1(
  p_command_id uuid,
  p_replay_id uuid,
  p_source_manifest_version_id uuid,
  p_selection_spec_version_id uuid,
  p_source_class text,
  p_source_context_id uuid,
  p_source_version_id uuid,
  p_source_item_ids uuid[],
  p_selected_source_item_ids uuid[],
  p_range_starts integer[],
  p_range_ends integer[],
  p_requested_coverage_class text
) RETURNS TABLE(outcome text, committed_replay_id uuid, replay_lifecycle text, resulting_draft_revision bigint,
                composed_manifest_version_id uuid, composed_selection_spec_version_id uuid,
                resolved_coverage_class text, captured_item_count integer, resolved_selected_item_count integer,
                resolved_source_contiguous boolean, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.replay_create_commands;
  captured record;
  resolved record;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_replay_id IS NULL OR p_source_manifest_version_id IS NULL
     OR p_selection_spec_version_id IS NULL OR p_source_class IS NULL OR p_source_context_id IS NULL
     OR p_source_class NOT IN ('MY_WORLD', 'SHARED_WORLD', 'PUBLIC_EXPERIENCE')
     OR p_source_item_ids IS NULL OR p_selected_source_item_ids IS NULL
     OR p_range_starts IS NULL OR p_range_ends IS NULL OR p_requested_coverage_class IS NULL
     OR p_replay_id = p_source_manifest_version_id OR p_replay_id = p_selection_spec_version_id
     OR p_source_manifest_version_id = p_selection_spec_version_id THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_REPLAY_CREATE_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'replay=' || lower(p_replay_id::text) || E'\n'
   || 'manifest=' || lower(p_source_manifest_version_id::text) || E'\n'
   || 'selection=' || lower(p_selection_spec_version_id::text) || E'\n'
   || 'sourceClass=' || p_source_class || E'\n'
   || 'sourceContext=' || lower(p_source_context_id::text) || E'\n'
   || 'sourceVersion=' || coalesce(lower(p_source_version_id::text), 'NONE') || E'\n'
   || 'sourceItems=' || coalesce((SELECT string_agg(lower(x::text), ',' ORDER BY lower(x::text) COLLATE "C")
                                    FROM unnest(p_source_item_ids) x), '') || E'\n'
   || 'selectedItems=' || public.replay_selection_request_token_v1(p_selected_source_item_ids, p_range_starts, p_range_ends) || E'\n'
   || 'coverage=' || p_requested_coverage_class, 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, reading only immutable
  -- command history, so an equivalent retry answers even after the source moved.
  SELECT * INTO committed FROM public.replay_create_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY
      SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, r.current_lifecycle, 1::bigint,
             committed.source_manifest_version_id, committed.selection_spec_version_id,
             sp.coverage_class, m.item_count, sp.selected_item_count, sp.source_contiguous, committed.committed_at
        FROM public.replays r
        JOIN public.replay_source_manifest_versions m ON m.id = committed.source_manifest_version_id
        JOIN public.replay_selection_spec_versions sp ON sp.id = committed.selection_spec_version_id
       WHERE r.id = committed.replay_id;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the Replay. A row that already carries this
  -- identity is either this command's own committed birth or somebody else's.
  PERFORM 1 FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO committed FROM public.replay_create_commands c WHERE c.id = p_command_id;
    IF FOUND AND committed.request_ref = request THEN
      RETURN QUERY
        SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, r.current_lifecycle, 1::bigint,
               committed.source_manifest_version_id, committed.selection_spec_version_id,
               sp.coverage_class, m.item_count, sp.selected_item_count, sp.source_contiguous, committed.committed_at
          FROM public.replays r
          JOIN public.replay_source_manifest_versions m ON m.id = committed.source_manifest_version_id
          JOIN public.replay_selection_spec_versions sp ON sp.id = committed.selection_spec_version_id
         WHERE r.id = committed.replay_id;
      RETURN;
    END IF;
    IF FOUND THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RAISE EXCEPTION 'REPLAY_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of the birth.
  instant := clock_timestamp();

  BEGIN
    INSERT INTO public.replays (id, created_by_user_id, current_lifecycle, created_at)
    VALUES (p_replay_id, u, 'DRAFT', instant);

    -- STEP 2: the source, captured under its own domain's lock order.
    SELECT * INTO captured FROM public.replay_capture_source_manifest_v1(
      p_replay_id, p_source_manifest_version_id, 1, p_source_class, p_source_context_id,
      p_source_version_id, p_source_item_ids, instant);

    SELECT * INTO resolved FROM public.replay_resolve_selection_spec_v1(
      p_replay_id, p_source_manifest_version_id, p_selection_spec_version_id, 1,
      p_selected_source_item_ids, p_range_starts, p_range_ends, p_requested_coverage_class, instant);

    -- STEP 3: the composition pointer and the durable command.
    INSERT INTO public.replay_draft_state
      (replay_id, current_source_manifest_version_id, current_selection_spec_version_id, draft_revision, updated_at)
    VALUES (p_replay_id, p_source_manifest_version_id, p_selection_spec_version_id, 1, instant);

    INSERT INTO public.replay_create_commands
      (id, replay_id, actor_user_id, source_manifest_version_id, selection_spec_version_id, request_ref, committed_at)
    VALUES (p_command_id, p_replay_id, u, p_source_manifest_version_id, p_selection_spec_version_id, request, instant);
  EXCEPTION WHEN unique_violation THEN
    -- DURABLE IDEMPOTENCY, THIRD PASS: two equivalent births racing on the same
    -- identities serialize only here. Anything else is a taken identity, and
    -- the whole birth rolls back together.
    SELECT * INTO committed FROM public.replay_create_commands c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.request_ref = request THEN
        RETURN QUERY
          SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, r.current_lifecycle, 1::bigint,
                 committed.source_manifest_version_id, committed.selection_spec_version_id,
                 sp.coverage_class, m.item_count, sp.selected_item_count, sp.source_contiguous, committed.committed_at
            FROM public.replays r
            JOIN public.replay_source_manifest_versions m ON m.id = committed.source_manifest_version_id
            JOIN public.replay_selection_spec_versions sp ON sp.id = committed.selection_spec_version_id
           WHERE r.id = committed.replay_id;
        RETURN;
      END IF;
      RAISE EXCEPTION 'REPLAY_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RAISE EXCEPTION 'REPLAY_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'REPLAY_DRAFT_CREATED'::text, p_replay_id, 'DRAFT'::text, 1::bigint,
                      p_source_manifest_version_id, p_selection_spec_version_id,
                      resolved.resolved_coverage_class, captured.captured_item_count,
                      resolved.resolved_selected_item_count, resolved.resolved_source_contiguous, instant;
END$$;

ALTER FUNCTION public.create_replay_draft_v1(uuid, uuid, uuid, uuid, text, uuid, uuid, uuid[], uuid[], integer[], integer[], text) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 8. REVISE A PRIVATE REPLAY DRAFT.
--
--    The revising human is exactly auth.uid() and must be the creator; anybody
--    else, and a Replay that does not exist, reach ONE bounded class. A revision
--    is compare-and-swap on the draft revision: two competing revisions
--    serialize on the Replay row and the loser is refused as stale rather than
--    silently applied to whatever is current. It never mutates an old
--    component: a changed source set is a NEW manifest version, a changed
--    selection is a NEW selection-spec version, and only the pointer moves.
--
--    With no new manifest, the current manifest is SHARE-locked in its domain
--    order and asked whether it is still current; a source that was deleted,
--    changed, lost to the creator or is no longer the eligible version refuses
--    the revision instead of committing old prepared state.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.revise_replay_draft_v1(
  p_command_id uuid,
  p_replay_id uuid,
  p_expected_draft_revision bigint,
  p_source_manifest_version_id uuid,
  p_selection_spec_version_id uuid,
  p_source_class text,
  p_source_context_id uuid,
  p_source_version_id uuid,
  p_source_item_ids uuid[],
  p_selected_source_item_ids uuid[],
  p_range_starts integer[],
  p_range_ends integer[],
  p_requested_coverage_class text
) RETURNS TABLE(outcome text, committed_replay_id uuid, replay_lifecycle text, resulting_draft_revision bigint,
                composed_manifest_version_id uuid, composed_selection_spec_version_id uuid,
                resolved_coverage_class text, captured_item_count integer, resolved_selected_item_count integer,
                resolved_source_contiguous boolean, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.replay_draft_revision_commands;
  replay public.replays;
  state public.replay_draft_state;
  manifest_id uuid;
  next_manifest_revision integer;
  next_selection_revision integer;
  currency text;
  captured record;
  resolved record;
  item_total integer;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_replay_id IS NULL OR p_expected_draft_revision IS NULL
     OR p_expected_draft_revision < 1 OR p_selection_spec_version_id IS NULL
     OR p_selected_source_item_ids IS NULL OR p_range_starts IS NULL OR p_range_ends IS NULL
     OR p_requested_coverage_class IS NULL
     OR p_replay_id = p_selection_spec_version_id THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- A new source set is named whole or not at all: either a new manifest with
  -- its class, context and items, or none of them and the current manifest.
  IF p_source_manifest_version_id IS NULL THEN
    IF p_source_class IS NOT NULL OR p_source_context_id IS NOT NULL OR p_source_version_id IS NOT NULL
       OR p_source_item_ids IS NOT NULL THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
  ELSE
    IF p_source_class IS NULL OR p_source_class NOT IN ('MY_WORLD', 'SHARED_WORLD', 'PUBLIC_EXPERIENCE')
       OR p_source_context_id IS NULL OR p_source_item_ids IS NULL
       OR p_source_manifest_version_id = p_selection_spec_version_id
       OR p_source_manifest_version_id = p_replay_id THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_REPLAY_DRAFT_REVISION_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'replay=' || lower(p_replay_id::text) || E'\n'
   || 'expectedRevision=' || p_expected_draft_revision::text || E'\n'
   || 'manifest=' || coalesce(lower(p_source_manifest_version_id::text), 'NONE') || E'\n'
   || 'selection=' || lower(p_selection_spec_version_id::text) || E'\n'
   || 'sourceClass=' || coalesce(p_source_class, 'NONE') || E'\n'
   || 'sourceContext=' || coalesce(lower(p_source_context_id::text), 'NONE') || E'\n'
   || 'sourceVersion=' || coalesce(lower(p_source_version_id::text), 'NONE') || E'\n'
   || 'sourceItems=' || coalesce((SELECT string_agg(lower(x::text), ',' ORDER BY lower(x::text) COLLATE "C")
                                    FROM unnest(p_source_item_ids) x), '') || E'\n'
   || 'selectedItems=' || public.replay_selection_request_token_v1(p_selected_source_item_ids, p_range_starts, p_range_ends) || E'\n'
   || 'coverage=' || p_requested_coverage_class, 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock.
  SELECT * INTO committed FROM public.replay_draft_revision_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY
      SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, r.current_lifecycle, committed.resulting_draft_revision,
             committed.source_manifest_version_id, committed.selection_spec_version_id,
             sp.coverage_class, m.item_count, sp.selected_item_count, sp.source_contiguous, committed.committed_at
        FROM public.replays r
        JOIN public.replay_source_manifest_versions m ON m.id = committed.source_manifest_version_id
        JOIN public.replay_selection_spec_versions sp ON sp.id = committed.selection_spec_version_id
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
  SELECT * INTO committed FROM public.replay_draft_revision_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY
      SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, replay.current_lifecycle, committed.resulting_draft_revision,
             committed.source_manifest_version_id, committed.selection_spec_version_id,
             sp.coverage_class, m.item_count, sp.selected_item_count, sp.source_contiguous, committed.committed_at
        FROM public.replay_source_manifest_versions m
        JOIN public.replay_selection_spec_versions sp ON sp.id = committed.selection_spec_version_id
       WHERE m.id = committed.source_manifest_version_id;
    RETURN;
  END IF;

  -- ONLY A DRAFT IS REVISED HERE. Later lifecycles are other slices' objects.
  IF replay.current_lifecycle <> 'DRAFT' THEN
    RAISE EXCEPTION 'REPLAY_LIFECYCLE_INVALID' USING ERRCODE='55000';
  END IF;

  SELECT * INTO state FROM public.replay_draft_state s WHERE s.replay_id = p_replay_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  -- COMPARE AND SWAP: the revision the caller composed against must still be
  -- the current one. A competing revision that committed first wins; this one
  -- is stale, never applied to whatever is current.
  IF state.draft_revision <> p_expected_draft_revision THEN
    RAISE EXCEPTION 'REPLAY_DRAFT_STALE' USING ERRCODE='40001';
  END IF;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of the revision.
  instant := clock_timestamp();

  BEGIN
    IF p_source_manifest_version_id IS NULL THEN
      -- STEP 2: the current manifest's sources, stabilized in their domain order
      -- and proven still current before any old prepared state may commit.
      manifest_id := state.current_source_manifest_version_id;
      PERFORM public.replay_lock_source_manifest_v1(manifest_id);
      SELECT c.currency_state INTO currency FROM public.derive_replay_source_manifest_currency_v1(manifest_id) c;
      IF currency IS DISTINCT FROM 'CURRENT' THEN
        RAISE EXCEPTION 'REPLAY_SOURCE_STALE' USING ERRCODE='40001',
          DETAIL='A bound source changed, became unavailable, is no longer visible to the creator or is no longer the eligible version; the previous prepared state cannot silently commit.';
      END IF;
      SELECT m.item_count INTO item_total FROM public.replay_source_manifest_versions m WHERE m.id = manifest_id;
    ELSE
      -- STEP 2: a NEW manifest version, captured under its domain's lock order.
      SELECT coalesce(max(m.manifest_revision), 0) + 1 INTO next_manifest_revision
        FROM public.replay_source_manifest_versions m WHERE m.replay_id = p_replay_id;
      SELECT * INTO captured FROM public.replay_capture_source_manifest_v1(
        p_replay_id, p_source_manifest_version_id, next_manifest_revision, p_source_class, p_source_context_id,
        p_source_version_id, p_source_item_ids, instant);
      manifest_id := p_source_manifest_version_id;
      item_total := captured.captured_item_count;
    END IF;

    SELECT coalesce(max(sp.selection_revision), 0) + 1 INTO next_selection_revision
      FROM public.replay_selection_spec_versions sp WHERE sp.replay_id = p_replay_id;
    SELECT * INTO resolved FROM public.replay_resolve_selection_spec_v1(
      p_replay_id, manifest_id, p_selection_spec_version_id, next_selection_revision,
      p_selected_source_item_ids, p_range_starts, p_range_ends, p_requested_coverage_class, instant);

    -- STEP 3: the pointer advances exactly one revision; nothing old is touched.
    UPDATE public.replay_draft_state s
       SET current_source_manifest_version_id = manifest_id,
           current_selection_spec_version_id = p_selection_spec_version_id,
           draft_revision = state.draft_revision + 1,
           updated_at = instant
     WHERE s.replay_id = p_replay_id;

    INSERT INTO public.replay_draft_revision_commands
      (id, replay_id, actor_user_id, resulting_draft_revision, source_manifest_version_id,
       selection_spec_version_id, request_ref, committed_at)
    VALUES (p_command_id, p_replay_id, u, state.draft_revision + 1, manifest_id,
            p_selection_spec_version_id, request, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'REPLAY_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'REPLAY_DRAFT_REVISED'::text, p_replay_id, replay.current_lifecycle, state.draft_revision + 1,
                      manifest_id, p_selection_spec_version_id,
                      resolved.resolved_coverage_class, item_total,
                      resolved.resolved_selected_item_count, resolved.resolved_source_contiguous, instant;
END$$;

ALTER FUNCTION public.revise_replay_draft_v1(uuid, uuid, bigint, uuid, uuid, text, uuid, uuid, uuid[], uuid[], integer[], integer[], text) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 9. THE ONE CREATOR-EXACT READ BOUNDARY.
--
--    It answers the exact CREATOR of one Replay and nobody else: a stranger,
--    and a human asking about a Replay that does not exist, receive ZERO ROWS,
--    so the surface discloses nothing. It returns the composition and its
--    derived two-state currency and NO source identity: no Session, World,
--    material, unit, package item, digest, availability revision or media
--    handle. Some creator source access is not a reason to expose private
--    source paths through a DTO. It is STABLE, reads sealed provenance never,
--    and follows the frozen narrow read-boundary precedent of 0087 / 0089 /
--    0093: service_role alone may execute it, and no direct table privilege
--    exists behind it.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_replay_draft_composition_v1(p_replay_id uuid, p_user_id uuid)
RETURNS TABLE(replay_id uuid, current_lifecycle text, draft_revision bigint, source_class text,
              source_manifest_version_id uuid, manifest_revision integer, item_count integer,
              authorized_universe_item_count integer, selection_spec_version_id uuid,
              selection_revision integer, coverage_class text, selection_method text,
              selected_item_count integer, source_contiguous boolean, currency_state text,
              updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_replay_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
    SELECT r.id, r.current_lifecycle, s.draft_revision, m.source_class, m.id, m.manifest_revision,
           m.item_count, m.authorized_universe_item_count, sp.id, sp.selection_revision, sp.coverage_class,
           sp.selection_method, sp.selected_item_count, sp.source_contiguous, cur.currency_state, s.updated_at
      FROM public.replays r
      JOIN public.replay_draft_state s ON s.replay_id = r.id
      JOIN public.replay_source_manifest_versions m ON m.id = s.current_source_manifest_version_id
      JOIN public.replay_selection_spec_versions sp ON sp.id = s.current_selection_spec_version_id
      CROSS JOIN LATERAL public.derive_replay_source_manifest_currency_v1(m.id) cur
     WHERE r.id = p_replay_id AND r.created_by_user_id = p_user_id;
END$$;

ALTER FUNCTION public.resolve_replay_draft_composition_v1(uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 10. SECURITY POSTURE.
--
--     Every function is postgres-owned, SECURITY DEFINER and search_path-pinned.
--     Every mutation, both cores, the lock helper and the currency derivation
--     are executable by NO application role. The ONE read boundary is
--     service_role-executable alone.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  internal text[] := ARRAY[
    'public.replay_selection_request_token_v1(uuid[], integer[], integer[])',
    'public.replay_capture_source_manifest_v1(uuid, uuid, integer, text, uuid, uuid, uuid[], timestamptz)',
    'public.replay_lock_source_manifest_v1(uuid)',
    'public.derive_replay_source_manifest_currency_v1(uuid)',
    'public.replay_resolve_selection_spec_v1(uuid, uuid, uuid, integer, uuid[], integer[], integer[], text, timestamptz)',
    'public.create_replay_draft_v1(uuid, uuid, uuid, uuid, text, uuid, uuid, uuid[], uuid[], integer[], integer[], text)',
    'public.revise_replay_draft_v1(uuid, uuid, bigint, uuid, uuid, text, uuid, uuid, uuid[], uuid[], integer[], integer[], text)'];
  resolver text := 'public.resolve_replay_draft_composition_v1(uuid, uuid)';
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
-- 11. SELF-ASSERTIONS.
--
--     What must already be true of THIS migration for it to be allowed to
--     deploy. Each is a fact about the objects 0101 owns or the frozen truths it
--     consumes - never a census of the database, and never a ceiling on I-06B /
--     I-06C / I-06D: no assertion here forbids a later reviewed REPLAY_VERSION,
--     projection, render contract, distribution package or Launch wrapper.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  capture_fn text := 'public.replay_capture_source_manifest_v1(uuid, uuid, integer, text, uuid, uuid, uuid[], timestamptz)';
  lock_fn text := 'public.replay_lock_source_manifest_v1(uuid)';
  currency_fn text := 'public.derive_replay_source_manifest_currency_v1(uuid)';
  select_fn text := 'public.replay_resolve_selection_spec_v1(uuid, uuid, uuid, integer, uuid[], integer[], integer[], text, timestamptz)';
  create_fn text := 'public.create_replay_draft_v1(uuid, uuid, uuid, uuid, text, uuid, uuid, uuid[], uuid[], integer[], integer[], text)';
  revise_fn text := 'public.revise_replay_draft_v1(uuid, uuid, bigint, uuid, uuid, text, uuid, uuid, uuid[], uuid[], integer[], integer[], text)';
  token_fn text := 'public.replay_selection_request_token_v1(uuid[], integer[], integer[])';
  resolver text := 'public.resolve_replay_draft_composition_v1(uuid, uuid)';
  everything text[];
  mutating text[];
  own_tables text[] := ARRAY['replay_create_commands', 'replay_draft_revision_commands'];
  fn text;
  t text;
  role_name text;
  p record;
  replay_pos integer;
  source_pos integer;
  write_pos integer;
BEGIN
  everything := ARRAY[token_fn, capture_fn, lock_fn, currency_fn, select_fn, create_fn, revise_fn, resolver];
  mutating := ARRAY[capture_fn, lock_fn, select_fn, create_fn, revise_fn];

  -- EVERY FUNCTION IS POSTGRES-OWNED, PINNED, AND EXECUTABLE BY NO APPLICATION
  -- ROLE except the ONE read boundary, which service_role alone may execute.
  FOREACH fn IN ARRAY everything LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-06A: % must be owned by postgres', fn; END IF;
    IF fn <> token_fn AND NOT p.prosecdef THEN RAISE EXCEPTION 'I-06A: % must be SECURITY DEFINER', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-06A: % must pin an empty search_path', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-06A: PUBLIC must not execute % before the frozen CW2-08 Launch Gate exists', fn;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name)
         AND has_function_privilege(role_name, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-06A: % must not execute % before the frozen CW2-08 Launch Gate exists', role_name, fn;
      END IF;
    END LOOP;
    IF fn <> resolver AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
       AND has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-06A: service_role must not execute % : the service tier is an executor, never the human consent principal', fn;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' OR p.prosrc ~* 'TRUNCATE' THEN
      RAISE EXCEPTION 'I-06A: % locks rows in the canonical order, never a table and never an advisory key', fn;
    END IF;
    -- NO REPLAY FUNCTION MUTATES A SOURCE RELATION, A PUBLIC RELATION OR A
    -- HUMAN: every Personal, Shared and Public row is read and SHARE-locked only.
    IF p.prosrc ~ '(INSERT INTO|UPDATE|DELETE FROM) public\.(conversation_|session_semantic|shared_world|public_experience|public_identit|public_world|publication_|users)' THEN
      RAISE EXCEPTION 'I-06A: % must mutate no Personal, Shared or Public relation: a Replay binds source truth and never writes it', fn;
    END IF;
    -- PROVENANCE IS NOT A SOURCE-ACCESS ROUTE, and membership is never a
    -- substitute for exact historical visibility.
    IF p.prosrc ~ 'publication_package_item_provenance' THEN
      RAISE EXCEPTION 'I-06A: % must never read the sealed Public provenance: it is internal audit truth, not a bridge into private source', fn;
    END IF;
    IF p.prosrc ~ 'shared_world_membership_episodes|shared_world_history_access_grants|shared_world_standard_closed_view_entitlements|shared_world_history_package_manifest_items|shared_world_standing_context' THEN
      RAISE EXCEPTION 'I-06A: % must not re-implement Shared authorization: consume the ONE canonical I-04F visibility entry point', fn;
    END IF;
    -- NO DISTRIBUTION, NO PUBLICATION, NO SAFETY OR LAUNCH CLAIM, NO SECOND
    -- LIFECYCLE, NO UNPRODUCED VOCABULARY anywhere in a Replay function body.
    IF p.prosrc ~ 'PUBLISH_TO_PUBLIC_WORLD|SHARE_EXTERNALLY|DOWNLOAD|DISTRIBUT|EXPORT_' THEN
      RAISE EXCEPTION 'I-06A: % must carry no distribution action: creation authority is not distribution authority', fn;
    END IF;
    IF p.prosrc ~ 'SAFETY_ALLOW|LAUNCH_CLEARED|ENTITLED|FEATURE_ENABLED|PUBLIC_LAUNCH_READY|CLEARED' THEN
      RAISE EXCEPTION 'I-06A: % must claim no Safety, Launch or entitlement clearance: no executable CW2-08 runtime exists', fn;
    END IF;
    IF p.prosrc ~ 'PREVIEW_READY|FINALIZED' THEN
      RAISE EXCEPTION 'I-06A: % must produce no lifecycle but DRAFT: preview and finalization belong to I-06B', fn;
    END IF;
    IF p.prosrc ~ 'NATURAL_LANGUAGE' OR p.prosrc ~ '''MIXED''' THEN
      RAISE EXCEPTION 'I-06A: % must write no natural-language selection result and no MIXED medium: no reviewed producer exists for either', fn;
    END IF;
    IF p.prosrc ~ 'ABSENT_FROM_PUBLIC_WORLD|resolve_public_visibility_state_v1|resolve_public_audience_admission_v1' THEN
      RAISE EXCEPTION 'I-06A: % must not derive Replay eligibility from Public visibility or admission: Public source authority is Experience CONTROL', fn;
    END IF;
    IF p.prosrc ~ '\.created_at' THEN
      RAISE EXCEPTION 'I-06A: % must never read a wall-clock creation time as a temporal anchor: the anchors are Session Position, establishment instant and package ordinal', fn;
    END IF;
  END LOOP;

  FOREACH fn IN ARRAY mutating LOOP
    IF (SELECT pr.provolatile FROM pg_proc pr WHERE pr.oid = fn::regprocedure) <> 'v' THEN
      RAISE EXCEPTION 'I-06A: consequential primitive % must be VOLATILE', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[currency_fn, resolver] LOOP
    SELECT pr.provolatile, pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-06A: derivation % must be STABLE', fn; END IF;
    IF p.prosrc ~ 'INSERT INTO' OR p.prosrc ~ 'UPDATE public' OR p.prosrc ~ 'DELETE FROM' OR p.prosrc ~ 'FOR UPDATE|FOR SHARE' THEN
      RAISE EXCEPTION 'I-06A: derivation % must write nothing and lock nothing', fn;
    END IF;
  END LOOP;
  IF (SELECT pr.provolatile FROM pg_proc pr WHERE pr.oid = token_fn::regprocedure) <> 'i' THEN
    RAISE EXCEPTION 'I-06A: the selection request token must be IMMUTABLE';
  END IF;

  -- THE HUMAN IS DERIVED, NEVER SUPPLIED. Both human primitives and both cores
  -- read auth.uid(); no mutation accepts an actor, creator, owner, authority,
  -- audience, order, digest, medium, availability or completeness parameter,
  -- and the two human primitives accept no clock either. Declared INPUT names
  -- only (mode 'i'): a RETURNS TABLE function also lists its result columns.
  FOREACH fn IN ARRAY ARRAY[capture_fn, lock_fn, select_fn, create_fn, revise_fn] LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc !~ 'u uuid := auth\.uid\(\);' THEN
      RAISE EXCEPTION 'I-06A: % must derive the human from auth.uid() and never from a parameter', fn;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 'i'
         AND arg.name ~ '(actor|creator|owner|user_id|approver|authority|audience|viewer|visib|publish|distribut|lifecycle|clear|launch|safety|entitle|allow|ordinal|order|contiguous|method|digest|fingerprint|medium|availability|complete|natural|language)'
    ) THEN
      RAISE EXCEPTION 'I-06A: % may not accept an actor authority audience order digest medium or completeness parameter', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[create_fn, revise_fn] LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 'i' AND arg.name ~ '(instant|timestamp|_at$)'
    ) THEN
      RAISE EXCEPTION 'I-06A: % accepts no clock: the ONE instant is read from the database', fn;
    END IF;
    IF (length(p.prosrc) - length(replace(p.prosrc, 'clock_timestamp()', ''))) / length('clock_timestamp()') <> 1 THEN
      RAISE EXCEPTION 'I-06A: % must read the database clock exactly once for every authoritative moment', fn;
    END IF;
    IF p.prosrc ~* 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
      RAISE EXCEPTION 'I-06A: % accepts no clock but one read of the database clock', fn;
    END IF;
    IF (length(p.prosrc) - length(replace(p.prosrc, 'WHERE c.id = p_command_id', ''))) / length('WHERE c.id = p_command_id') < 2 THEN
      RAISE EXCEPTION 'I-06A: % must check durable idempotency before any lock and again under it', fn;
    END IF;
    IF p.prosrc !~ 'REPLAY_COMMAND_ID_CONFLICT' OR p.prosrc !~ 'committed\.request_ref' THEN
      RAISE EXCEPTION 'I-06A: % must decide retry equivalence on the whole request identity and refuse a reused command identity', fn;
    END IF;
    IF p.prosrc !~ 'replay_selection_request_token_v1' THEN
      RAISE EXCEPTION 'I-06A: % must bind the exact resolved selection into its request identity', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[capture_fn, select_fn, lock_fn] LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc ~ 'clock_timestamp' THEN
      RAISE EXCEPTION 'I-06A: internal core % reads no clock: the ONE instant is the caller''s', fn;
    END IF;
  END LOOP;

  -- THE CAPTURE CORE: exact authority per class, consumed rather than
  -- re-derived, and the source stabilized in its domain's own order.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = capture_fn::regprocedure;
  IF p.prosrc !~ 'FROM public\.session_semantic_clocks c' OR p.prosrc !~ 'c\.user_id = u FOR SHARE'
     OR p.prosrc !~ 'cu\.user_id = u AND cu\.id = ANY\(p_source_item_ids\)' THEN
    RAISE EXCEPTION 'I-06A: the Personal adapter must require the creator to own the exact Session and every exact committed unit';
  END IF;
  IF p.prosrc !~ 'public\.resolve_shared_world_history_visibility_v1\(p_source_context_id, u\)' THEN
    RAISE EXCEPTION 'I-06A: the Shared adapter must consume the ONE canonical I-04F visibility entry point for the creating human';
  END IF;
  IF p.prosrc !~ 'NOT \(m\.history_item_id = ANY\(visible\)\)' THEN
    RAISE EXCEPTION 'I-06A: every Shared item must be inside the exact visible set, or the ONE bounded class is raised';
  END IF;
  IF p.prosrc !~ 'material_kind NOT IN \(''HUMAN_TEXT'', ''HUMAN_VOICE_NOTE'', ''QANDEEL_OUTPUT'', ''QANDEEL_ANALYSIS''\)'
     OR p.prosrc !~ 'REPLAY_SOURCE_KIND_RESERVED' THEN
    RAISE EXCEPTION 'I-06A: the reserved Shared kinds and the unproduced Public forms must be unselectable';
  END IF;
  IF p.prosrc !~ 'public_experience_controllers c' OR p.prosrc !~ 'c\.controller_user_id = u' THEN
    RAISE EXCEPTION 'I-06A: the Public adapter must require EXPERIENCE CONTROL AUTHORITY for the creating human';
  END IF;
  IF p.prosrc !~ 'current_experience_version_id IS DISTINCT FROM p_source_version_id' THEN
    RAISE EXCEPTION 'I-06A: the Public adapter must bind only the exact controlled current version and fail closed for any other';
  END IF;
  IF p.prosrc ~ 'audio_object_ref' AND p.prosrc !~ 'sha256\(convert_to\(\s*CASE WHEN m\.material_kind = ''HUMAN_VOICE_NOTE''' THEN
    RAISE EXCEPTION 'I-06A: a voice-note handle is digested one-way and never stored';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'REPLAY_SOURCE_NOT_AVAILABLE', ''))) / length('REPLAY_SOURCE_NOT_AVAILABLE') < 9 THEN
    RAISE EXCEPTION 'I-06A: a nonexistent source, another human''s source, invisible Shared history and an uncontrolled Experience must share ONE bounded class';
  END IF;
  -- LOCK ORDER inside the Shared branch: World, then materials by id, then
  -- history items by id - the frozen I-04 relative order, SHARE throughout.
  replay_pos := strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = p_source_context_id FOR SHARE');
  source_pos := strpos(p.prosrc, 'ORDER BY m.id FOR SHARE');
  write_pos := strpos(p.prosrc, 'ORDER BY i.id FOR SHARE');
  IF replay_pos = 0 OR source_pos = 0 OR write_pos = 0 OR replay_pos > source_pos OR source_pos > write_pos THEN
    RAISE EXCEPTION 'I-06A: the Shared source must be stabilized World first, then materials, then history items, in SHARE mode';
  END IF;
  replay_pos := strpos(p.prosrc, 'FROM public.public_world_state w WHERE w.singleton FOR SHARE');
  source_pos := strpos(p.prosrc, 'FROM public.public_experiences e WHERE e.id = p_source_context_id FOR SHARE');
  IF replay_pos = 0 OR source_pos = 0 OR replay_pos > source_pos THEN
    RAISE EXCEPTION 'I-06A: the Public source must be stabilized singleton first, then Experience, in SHARE mode';
  END IF;
  IF p.prosrc ~ 'FOR UPDATE' THEN
    RAISE EXCEPTION 'I-06A: a Replay reads source truth and never writes it: every source lock is a SHARE lock';
  END IF;

  -- THE HUMAN PRIMITIVES lock the Replay FIRST and only then reach the source.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = revise_fn::regprocedure;
  replay_pos := strpos(p.prosrc, 'FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE');
  source_pos := strpos(p.prosrc, 'public.replay_lock_source_manifest_v1(manifest_id)');
  write_pos := strpos(p.prosrc, 'UPDATE public.replay_draft_state s');
  IF replay_pos = 0 OR source_pos = 0 OR write_pos = 0 OR replay_pos > source_pos OR source_pos > write_pos THEN
    RAISE EXCEPTION 'I-06A: a revision locks the Replay first, stabilizes the source second and writes last';
  END IF;
  IF p.prosrc !~ 'derive_replay_source_manifest_currency_v1' OR p.prosrc !~ 'REPLAY_SOURCE_STALE' THEN
    RAISE EXCEPTION 'I-06A: a revision over an existing manifest must revalidate source currency and refuse stale prepared state';
  END IF;
  IF p.prosrc !~ 'state\.draft_revision <> p_expected_draft_revision' OR p.prosrc !~ 'REPLAY_DRAFT_STALE' THEN
    RAISE EXCEPTION 'I-06A: competing draft revisions must converge to one winner and one stale loser';
  END IF;
  IF p.prosrc !~ 'replay\.created_by_user_id <> u' OR p.prosrc !~ 'REPLAY_NOT_AVAILABLE' THEN
    RAISE EXCEPTION 'I-06A: a stranger and a nonexistent Replay must reach ONE bounded class';
  END IF;
  IF p.prosrc !~ 'current_lifecycle <> ''DRAFT''' THEN
    RAISE EXCEPTION 'I-06A: only a DRAFT is revised here';
  END IF;
  IF p.prosrc ~ 'UPDATE public\.replay_source_manifest|UPDATE public\.replay_selection_spec|DELETE FROM public\.replay' THEN
    RAISE EXCEPTION 'I-06A: a revision creates new component versions and never rewrites an old one';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = create_fn::regprocedure;
  replay_pos := strpos(p.prosrc, 'FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE');
  source_pos := strpos(p.prosrc, 'public.replay_capture_source_manifest_v1(');
  IF replay_pos = 0 OR source_pos = 0 OR replay_pos > source_pos THEN
    RAISE EXCEPTION 'I-06A: creation stabilizes the Replay identity before it reaches the source';
  END IF;
  IF p.prosrc !~ 'VALUES \(p_replay_id, u, ''DRAFT'', instant\)' THEN
    RAISE EXCEPTION 'I-06A: creation writes exactly DRAFT and binds the exact creating human';
  END IF;
  IF (SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = lock_fn::regprocedure) ~ 'FOR UPDATE' THEN
    RAISE EXCEPTION 'I-06A: the source lock helper takes SHARE locks only';
  END IF;

  -- THE SELECTION CORE: derived order, proven coverage, no fabricated segment.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = select_fn::regprocedure;
  IF p.prosrc !~ 'row_number\(\) OVER \(ORDER BY mi\.source_item_ordinal\)' THEN
    RAISE EXCEPTION 'I-06A: the selected order is derived from the manifest''s canonical order, never supplied';
  END IF;
  IF p.prosrc !~ 'REPLAY_COVERAGE_NOT_PROVABLE' OR p.prosrc !~ 'manifest\.universe_complete AND selected = manifest\.item_count AND whole = selected AND contiguous' THEN
    RAISE EXCEPTION 'I-06A: FULL_SOURCE must be refused unless the complete universe is selected whole without a gap';
  END IF;
  IF p.prosrc !~ 'IF matched <> selected THEN' THEN
    RAISE EXCEPTION 'I-06A: every selected identity must be an item of the exact manifest: nothing outside the authorized universe is a selection';
  END IF;
  IF p.prosrc !~ '''EXPLICIT_RESOLVED_ANCHORS''' THEN
    RAISE EXCEPTION 'I-06A: the ONE writer records resolved anchors and nothing else';
  END IF;
  IF p.prosrc !~ 'max\(mi\.source_universe_rank\) - min\(mi\.source_universe_rank\) \+ 1 = selected' THEN
    RAISE EXCEPTION 'I-06A: contiguity must be derived from the captured source universe as machine truth';
  END IF;
  IF p.prosrc ~* 'render_safe|semantic_safety|cut_safe' THEN
    RAISE EXCEPTION 'I-06A: no selection may be marked render-safe: Semantic Cut Safety belongs to I-06B';
  END IF;

  -- THE CURRENCY DERIVATION consumes the canonical truths and fails closed on
  -- every raise of the consumed resolver.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = currency_fn::regprocedure;
  IF p.prosrc !~ 'resolve_shared_world_history_visibility_v1\(manifest\.shared_world_id, creator\)'
     OR p.prosrc !~ 'WHEN OTHERS THEN' OR p.prosrc !~ 'SOURCE_ACCESS_LOST'
     OR p.prosrc !~ 'availability_revision <> i\.captured_availability_revision'
     OR p.prosrc !~ 'captured_source_digest' OR p.prosrc !~ 'public_experience_controllers'
     OR p.prosrc !~ 'SOURCE_VERSION_NOT_CURRENT' THEN
    RAISE EXCEPTION 'I-06A: source currency must revalidate availability, integrity, creator visibility and Public version eligibility from current truth';
  END IF;
  IF p.prosrc ~ 'auth\.uid' THEN
    RAISE EXCEPTION 'I-06A: source currency is a property of the Replay and its creator, never of whoever asks';
  END IF;

  -- THE ONE READ BOUNDARY is creator-exact, service_role-only and discloses
  -- no source identity: result columns (mode 't') are checked by name.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = resolver::regprocedure;
  IF p.prosrc !~ 'r\.created_by_user_id = p_user_id' THEN
    RAISE EXCEPTION 'I-06A: the composition resolver answers the exact creator and nobody else';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
     WHERE pr.oid = resolver::regprocedure AND arg.mode = 't'
       AND arg.name ~ '(user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material|history_item|availability|context_ref|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|experience|staleness)'
  ) THEN
    RAISE EXCEPTION 'I-06A: the composition resolver must disclose no source identity, no private path and no internal staleness cause';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role', resolver, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-06A: service_role must execute the ONE creator-exact composition resolver';
  END IF;

  -- THE COMMAND HISTORY IS NARROW, SEALED AND STRUCTURALLY BOUND TO THE CREATOR.
  FOREACH t IN ARRAY own_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid = 'public.replays'::regclass AND cardinality(c.confkey) = 2 AND c.confdeltype = 'r'
    ) THEN
      RAISE EXCEPTION 'I-06A: % must bind its actor to the exact Replay creator through the identity key', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
       WHERE a.attrelid = ('public.' || t)::regclass AND a.attnum > 0 AND NOT a.attisdropped
         AND (a.attname ~ '(body|_text$|transcript|audio|content|payload|reason|note|safety|launch|entitle|approv|allow|world_type|member|distribut|share|download|export)'
              OR ty.typname IN ('json', 'jsonb', 'bytea'))
    ) THEN
      RAISE EXCEPTION 'I-06A: command history % may carry no content, reason, World, distribution or clearance column', t;
    END IF;
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
    FOREACH role_name IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN role_name <> 'public' AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name);
      IF has_table_privilege(role_name, ('public.' || t)::regclass, 'SELECT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'INSERT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'UPDATE')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'DELETE') THEN
        RAISE EXCEPTION 'I-06A: relation % must hold no privilege for %', t, role_name;
      END IF;
    END LOOP;
  END LOOP;

  -- THE FROZEN TRUTHS THIS RUNTIME CONSUMES MUST STILL BE INTACT.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_source_manifest_versions'::regclass
                  AND tg.tgname = 'replay_source_manifest_versions_immutable' AND NOT tg.tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_selection_spec_versions'::regclass
                     AND tg.tgname = 'replay_selection_spec_versions_immutable' AND NOT tg.tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = 'public.replay_selection_spec_items'::regclass
                     AND tg.tgname = 'replay_selection_spec_items_chronology' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-06A: the 0100 component immutability and chronology guards must still be in place';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role', 'public.resolve_shared_world_history_visibility_v1(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I-06A: the ONE frozen I-04F visibility entry point must still be reachable';
  END IF;
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)'::regprocedure)
     !~ 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'I-06A: the frozen CW2-08 prerequisite seam must still answer NOT_EVALUATED: I-06A manufactures no launch readiness';
  END IF;
END$$;

COMMIT;
