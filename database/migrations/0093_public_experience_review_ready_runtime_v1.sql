-- I-05A - Public Experience Draft / Approval / READY_FOR_REVIEW Runtime v1 (PART C).
--
-- Migrations 0091 and 0092 created the Public World, the Public Identity, the
-- Experience with its immutable versions, and the immutable publication package.
-- Neither of them can write a single row: this migration creates the only things
-- that ever do.
--
-- ===========================================================================
-- What I-05A can and cannot produce
-- ===========================================================================
--
--   DRAFT              created by create_public_experience_draft_v1
--   READY_FOR_REVIEW   committed by commit_public_experience_ready_for_review_v1
--
-- and NOTHING else. No primitive here writes `PUBLISHED` or
-- `ABSENT_FROM_PUBLIC_WORLD`, no primitive creates a public serving surface, and
-- there is no resolver any public audience can reach. DRAFT and READY_FOR_REVIEW
-- are NOT publication: publication is explicit audience expansion (CW2-01 A19,
-- CW2-02 section 39, CW2-04 section 3 / D4), and nothing in this migration
-- widens an audience at all.
--
-- The one read boundary, resolve_public_experience_review_v1, answers the exact
-- CONTROLLER of one Experience and nobody else. It is not the Public World
-- serving resolver; I-05B creates that.
--
-- ===========================================================================
-- The canonical Public mutation lock order
-- ===========================================================================
--
--   1  public_world_state        the singleton, FOR UPDATE
--   2  public_experiences        the exact Experience row, FOR UPDATE
--   3  the exact manifest        FOR SHARE (a manifest is immutable)
--   4  shared_worlds             FOR SHARE, by id
--   5  shared_world_materials    FOR SHARE, by id
--   6  shared_world_history_items FOR SHARE, by id
--   7  conversation_units        FOR SHARE, by id
--   8  the package / approval / command rows it writes
--
-- Steps 4-6 are not free, and step 4 is load-bearing. Every I-04 consequential
-- mutation that can change what a human may SEE - leave, removal, rejoin, a
-- history grant, Standard closure, owner deletion - locks `shared_worlds` FIRST,
-- then `shared_world_materials` by id, then `shared_world_history_items` by id.
-- This migration takes the SAME relative order over those three relations, so a
-- Public preparation and any Shared mutation queue behind each other and can
-- never form a cycle: I-04 never takes a Public lock, so no Public lock can ever
-- be the second edge of one.
--
-- Holding the Shared World row is what makes source-view authority mean
-- something. Without it, the visibility answer resolved in step 4 could go stale
-- between resolution and the moment the body is copied, and a human who had just
-- lost access could still have their loss raced. Public source locks are SHARE
-- locks throughout: Public reads Shared truth, must not let it change underneath,
-- and never writes it.
--
-- The Personal source is locked last and is `conversation_units`, which migration
-- 0064 makes append-only for every role including the table owner - so no I-04 or
-- Personal path can ever contend with it.
--
-- The two Public Identity primitives deliberately do NOT take the singleton lock.
-- They touch one identity's own rows and nothing else, so serializing every
-- display-label change in the product behind one global row would be a
-- bottleneck with no correctness benefit. That an alias change cannot mutate a
-- package is proven by the rows each one writes, not by making them queue.
--
-- ===========================================================================
-- The authority request fingerprint
-- ===========================================================================
--
-- `derive_public_publication_authority_v1` is the ONE derivation of publication
-- authority. It is read-only, it is called by preparation, approval and the
-- READY commit alike, and it computes from CURRENT state:
--
--   * that every included source is still available at the exact captured
--     revision;
--   * that no included source carries unresolved additional human authority;
--   * that the source authority metadata agrees in BOTH directions;
--   * the exact CONTENT_RIGHTSHOLDER_SET;
--   * the AUTHORITY_REQUEST_FINGERPRINT.
--
-- The fingerprint binds the INTENDED PROTECTED ACTION, the target Public World,
-- the Public World audience class, the privacy/ownership readiness, the exact
-- Experience, the exact prospective Experience Version, the exact manifest, the
-- exact publisher identity, the exact source scope, the exact derived
-- rightsholder set and the Public World authority snapshot version. It is DERIVED
-- and never supplied, so it is not a bearer token: it cannot authorize another
-- package, Experience, version, source or audience, and it changes the moment the
-- authority it describes changes.
--
-- The action it binds is `PUBLISH_TO_PUBLIC_WORLD`, NOT the command being run.
-- Preparing a package is `PREPARE_PUBLICATION`, it lives in the prepare command's
-- own durable namespace, and it is explicitly NOT audience expansion. What a
-- rightsholder consents to when they approve an exact immutable package is the
-- future publication of that package - so that is what their approval is bound
-- to, and a preparation request reference is never a publication consent token.
-- A frozen authority decision is request-bound and may not be replayed for a
-- different action (CW2-02 section 7 / B6), which is precisely why I-05B can
-- revalidate THIS approval before executing PUBLISHED instead of having to
-- collect every human's consent a second time.
--
-- Binding the future action changes nothing about what I-05A does: committing
-- READY_FOR_REVIEW performs no publication, widens no audience and creates no
-- public visibility. I-05B must still revalidate the exact manifest-bound
-- authority, the EFFECTIVE approval state, and the Safety / Launch / entitlement
-- gates this slice evaluates none of, before any PUBLISHED transition.
--
-- It deliberately does NOT bind PUBLIC_AUDIENCE_POLICY. Who may currently view
-- Public World is a gate, not the identity of a package (CW2-04 D13), so a
-- later policy change must not stale an in-flight package and a package must
-- not pin a viewing policy.
--
-- I-05A proves PRIVACY and OWNERSHIP readiness ONLY. System / Safety policy, the
-- Launch Gate and commercial entitlement are NOT_EVALUATED and belong to CW2-08
-- (CW2-02 section 46 / B30 / B31, CW2-08 section 1 / H1). No value produced here
-- says otherwise.
--
-- ===========================================================================
-- Source adapters, and the boundaries they keep
-- ===========================================================================
--
-- MY_WORLD. The canonical durable Personal source in this repository is
-- `public.conversation_units` - the committed Conversational Unit of migration
-- 0064, append-only and immutable for every role. The actor must own it exactly.
--   * source_role = USER      human-authored Personal text. The exact owning
--                             human is the content authority.
--   * source_role = ASSISTANT Personal QANDEEL analysis. FAILS CLOSED. No
--                             reviewed server-owned producer of a protected-human
--                             subject authority exists in this repository, so the
--                             exact public authority requirement is NOT resolvable
--                             - and "we cannot compute it" is not "we computed it
--                             and it is empty" (CW2-02 section 26). Accepting an
--                             approver set from the caller would be exactly the
--                             app-supplied authority claim the frozen contract
--                             forbids, and manufacturing one would be engineering
--                             inventing Product logic (AGENTS.md section 2).
--   There is no durable Personal voice or call source at all: `source_modality`
--   is CHECK-pinned to TEXT in 0064 and no audio object exists anywhere in the
--   Personal schema. So no Personal voice adapter is written, and none is faked.
--
-- SHARED_WORLD. Two INDEPENDENT rights are checked, and neither substitutes for
-- the other:
--
--   SOURCE-ACCESS AUTHORITY      may the initiating human currently SEE this
--                                exact history item? Answered by the canonical
--                                I-04F entry point, never re-derived here.
--   CONTENT-RIGHTSHOLDER AUTHORITY  whose consent widens this material to the
--                                Public audience? Derived from I-04G's exact
--                                material authority for the exact item.
--
-- A rightsholder approving the widening of THEIR material says nothing about
-- whether the human assembling the package was ever entitled to see it, so the
-- source-view check runs FIRST and before any body is read. Conversely a former
-- member whose material authority survived their departure may still approve
-- their own included material without regaining any browsing. Publication
-- consent is not a source-retrieval permit, and material authority is not a
-- membership restoration.
--
-- The exact I-04G material, its exact I-04F history item and its exact
-- availability revision.
--   * HUMAN_TEXT, QANDEEL_OUTPUT, QANDEEL_ANALYSIS carry a text body and are
--     publishable when their authority resolves.
--   * HUMAN_VOICE_NOTE is REFUSED: its durable `audio_object_ref` is an opaque
--     server-side handle for a future reviewed media boundary, and copying it
--     into a public payload would put a hidden source identifier in a public row.
--   * EXPLICIT_DISCLOSURE and WORLD_EVENT_DERIVED_MATERIAL are RESERVED in I-04G
--     with no producer, so they are refused here too.
--   The required approvers are I-04G's EXACT material authority set for the exact
--   included item. World membership contributes nothing: a human who is or was a
--   Shared member appears in the rightsholder set only when material whose
--   authority is theirs is actually in this package - and a FORMER member whose
--   material authority survived their departure may approve their own included
--   material without regaining any Shared browsing access, because no primitive
--   here reads membership at all.
--
-- REPLAY_ARTIFACT. Reserved in the schema. No Replay runtime exists and I-05A
-- fabricates no producer, so no parameter here can name one.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- No PUBLISHED transition, no public serving, no semantic interpretation,
-- placement, coordinate, embedding, vitality, ranking, search, lens or panel; no
-- discussion, reply, thread or Public QANDEEL; no Replay producer; no media
-- storage provider, upload path or storage credential; no moderation, report,
-- block, entitlement, feature flag or Launch Gate; no route, controller, RPC or
-- mobile surface; no Shared membership, lifecycle, governance, grant or material
-- mutation of any kind; no Personal mutation of any kind. Migrations 0001-0090
-- are untouched, and no application role may execute a single consequential
-- primitive created here.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE DURABLE COMMAND HISTORY.
--
--    One narrow relation per command family, never a generic event engine. Each
--    row is the idempotency key AND the exact committed answer: an equivalent
--    retry is served from here rather than by re-reading current state, so a
--    later preparation, a later approval or a later source change can never make
--    a historical command start answering differently.
--
--    `request_ref` binds the whole immutable request, so an equivalent retry and
--    a different request under the same command identity are distinguishable.
--    There is deliberately no approval command relation: an approval IS its own
--    durable record, exactly as the frozen I-04F history package approval is.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_identity_commands (
    id uuid NOT NULL,
    command_kind text NOT NULL,
    actor_user_id uuid NOT NULL,
    public_identity_ref uuid NOT NULL,
    label_revision bigint NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT public_identity_commands_pk PRIMARY KEY (id),
    CONSTRAINT public_identity_commands_kind_check
        CHECK (command_kind IN ('ENSURE_PUBLIC_IDENTITY', 'UPDATE_PUBLIC_DISPLAY_LABEL')),
    CONSTRAINT public_identity_commands_revision_check CHECK (label_revision > 0),
    CONSTRAINT public_identity_commands_request_check CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT public_identity_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT public_identity_commands_identity_fk
        FOREIGN KEY (public_identity_ref, actor_user_id)
        REFERENCES public.public_identities (public_identity_ref, user_id) ON DELETE RESTRICT
);

CREATE TABLE public.public_experience_draft_commands (
    id uuid NOT NULL,
    experience_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    created_by_public_identity_ref uuid NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT public_experience_draft_commands_pk PRIMARY KEY (id),
    CONSTRAINT public_experience_draft_commands_experience_key UNIQUE (experience_id),
    CONSTRAINT public_experience_draft_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT public_experience_draft_commands_experience_fk
        FOREIGN KEY (experience_id, created_by_public_identity_ref)
        REFERENCES public.public_experiences (id, created_by_public_identity_ref) ON DELETE RESTRICT,
    CONSTRAINT public_experience_draft_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

-- THE COMMAND EXECUTED NOW IS NOT THE PROTECTED ACTION IT PREPARES.
--
-- `command_action` is `PREPARE_PUBLICATION`, in this relation's own durable
-- namespace. The protected audience-expansion action the rightsholders consent
-- to is `intended_publication_action` on the manifest, and it is
-- `PUBLISH_TO_PUBLIC_WORLD`. Keeping them in two relations, with two pinned
-- vocabularies, is what stops a preparation request reference from ever reading
-- as a publication consent token: preparing is explicitly NOT audience expansion,
-- and an approval of one action may not be replayed for another (CW2-02 B6).
CREATE TABLE public.publication_package_prepare_commands (
    id uuid NOT NULL,
    experience_id uuid NOT NULL,
    manifest_version_id uuid NOT NULL,
    experience_version_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    command_action text NOT NULL,
    item_count integer NOT NULL,
    required_approver_count integer NOT NULL,
    authority_request_fingerprint text NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT publication_package_prepare_commands_pk PRIMARY KEY (id),
    -- The command namespace, pinned, and deliberately disjoint from the
    -- manifest's intended publication action.
    CONSTRAINT publication_package_prepare_commands_action_check
        CHECK (command_action = 'PREPARE_PUBLICATION'),
    CONSTRAINT publication_package_prepare_commands_manifest_key UNIQUE (manifest_version_id),
    CONSTRAINT publication_package_prepare_commands_version_key UNIQUE (experience_version_id),
    CONSTRAINT publication_package_prepare_commands_count_check
        CHECK (item_count > 0 AND required_approver_count >= 0),
    CONSTRAINT publication_package_prepare_commands_print_check
        CHECK (authority_request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT publication_package_prepare_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT publication_package_prepare_commands_manifest_fk
        FOREIGN KEY (manifest_version_id, experience_id)
        REFERENCES public.publication_package_manifest_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT publication_package_prepare_commands_version_fk
        FOREIGN KEY (experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT publication_package_prepare_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

CREATE TABLE public.public_experience_review_ready_commands (
    id uuid NOT NULL,
    experience_id uuid NOT NULL,
    experience_version_id uuid NOT NULL,
    manifest_version_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    satisfied_approval_count integer NOT NULL,
    authority_request_fingerprint text NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT public_experience_review_ready_commands_pk PRIMARY KEY (id),
    -- One version reaches READY_FOR_REVIEW at most once.
    CONSTRAINT public_experience_review_ready_commands_version_key UNIQUE (experience_version_id),
    CONSTRAINT public_experience_review_ready_commands_count_check
        CHECK (satisfied_approval_count >= 0),
    CONSTRAINT public_experience_review_ready_commands_print_check
        CHECK (authority_request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT public_experience_review_ready_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT public_experience_review_ready_commands_version_fk
        FOREIGN KEY (experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT public_experience_review_ready_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

ALTER TABLE public.public_identity_commands OWNER TO postgres;
ALTER TABLE public.public_experience_draft_commands OWNER TO postgres;
ALTER TABLE public.publication_package_prepare_commands OWNER TO postgres;
ALTER TABLE public.public_experience_review_ready_commands OWNER TO postgres;

ALTER TABLE public.public_identity_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_experience_draft_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_package_prepare_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_experience_review_ready_commands ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.public_identity_commands,
                    public.public_experience_draft_commands,
                    public.publication_package_prepare_commands,
                    public.public_experience_review_ready_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.public_identity_commands, public.public_experience_draft_commands, public.publication_package_prepare_commands, public.public_experience_review_ready_commands FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 2. THE ONE PUBLICATION AUTHORITY DERIVATION.
--
--    Read-only. It decides nothing about who the actor is and writes nothing; it
--    answers "what does this exact package currently require, and what is the
--    authority-relevant identity of that request". Preparation, approval and the
--    READY commit all call it, so there is exactly one derivation of publication
--    authority in the Public domain and it cannot drift between them.
--
--    It FAILS CLOSED rather than returning a partial answer: an unavailable
--    source, a source whose additional human authority is unresolved, a source
--    with no authority metadata at all, and source metadata that contradicts
--    itself each raise. Missing metadata is never an empty requirement.
--
--    Callers must already hold the canonical locks. This function takes none:
--    taking a lock inside a STABLE read would hide the lock order from the
--    primitive that owns it.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_public_publication_authority_v1(p_manifest_version_id uuid)
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
  -- current audience, never a caller-supplied list.
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
    ) x;

  -- THE EXACT SOURCE SCOPE, canonically ordered so the fingerprint is a property
  -- of the package rather than of the order a caller happened to supply.
  SELECT coalesce(string_agg(s.token, ',' ORDER BY s.token COLLATE "C"), '') INTO scope
    FROM (
      SELECT CASE p.source_class
               WHEN 'MY_WORLD' THEN 'MY_WORLD:' || lower(p.personal_conversation_unit_id::text)
               WHEN 'SHARED_WORLD' THEN 'SHARED_WORLD:' || lower(p.shared_world_id::text)
                                        || ':' || lower(p.shared_material_id::text)
               ELSE p.source_class || ':RESERVED' END AS token
        FROM public.publication_package_item_provenance p
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

-- ---------------------------------------------------------------------------
-- 2b. THE ONE PACKAGE ITEM RESOLUTION.
--
--     The bounded public derivative, the derivative classification, the sealed
--     provenance and the per-item authority of one selection - all derived from
--     the exact locked source rows, in ONE canonical order, by ONE query.
--
--     It exists as a function rather than as a repeated common table expression
--     because preparation writes four relations from the same resolution, and
--     four copies of one derivation is four places for it to drift. It writes
--     nothing and locks nothing: the primitive that calls it already holds the
--     canonical locks and has already refused every source it must refuse.
--
--     `item_ordinal` is DERIVED from the canonical source token order, never
--     supplied, so the same selection always produces the same package shape.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_public_package_items_v1(
  p_personal_package_item_ids uuid[],
  p_personal_source_unit_ids uuid[],
  p_shared_package_item_ids uuid[],
  p_shared_source_world_ids uuid[],
  p_shared_source_material_ids uuid[]
) RETURNS TABLE(package_item_id uuid, item_ordinal integer, source_class text,
                derivative_classification text, public_body_digest text, public_text_body text,
                personal_conversation_unit_id uuid, personal_owner_user_id uuid,
                shared_world_id uuid, shared_material_id uuid, shared_history_item_id uuid,
                captured_availability_revision bigint, item_required_approver_count integer)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path='' AS $$
  WITH selected AS (
    SELECT 'MY_WORLD'::text AS src_class, t.pi AS item_id,
           t.su AS unit_id, NULL::uuid AS world_id, NULL::uuid AS material_id
      FROM unnest(p_personal_package_item_ids, p_personal_source_unit_ids) AS t(pi, su)
    UNION ALL
    SELECT 'SHARED_WORLD'::text, t.pi, NULL::uuid, t.w, t.m
      FROM unnest(p_shared_package_item_ids, p_shared_source_world_ids,
                  p_shared_source_material_ids) AS t(pi, w, m)
  ), resolved AS (
    SELECT s.item_id,
           s.src_class,
           CASE s.src_class
             WHEN 'MY_WORLD' THEN 'MY_WORLD:' || lower(s.unit_id::text)
             ELSE 'SHARED_WORLD:' || lower(s.world_id::text) || ':' || lower(s.material_id::text)
           END AS token,
           CASE s.src_class WHEN 'MY_WORLD' THEN cu.committed_text ELSE b.body_text END AS body,
           CASE s.src_class
             WHEN 'MY_WORLD' THEN 'SOURCE_CONTENT_BEARING_DERIVATIVE'
             ELSE CASE WHEN sm.material_kind IN ('HUMAN_TEXT', 'HUMAN_VOICE_NOTE')
                       THEN 'SOURCE_CONTENT_BEARING_DERIVATIVE' ELSE 'ANALYTICAL_DERIVATIVE' END
           END AS classification,
           s.unit_id,
           CASE s.src_class WHEN 'MY_WORLD' THEN cu.user_id ELSE NULL::uuid END AS owner_id,
           s.world_id,
           s.material_id,
           sm.history_item_id AS history_id,
           i.availability_revision AS revision,
           CASE s.src_class WHEN 'MY_WORLD' THEN 1
             ELSE (SELECT count(*)::integer FROM public.shared_world_history_item_required_approvers ra
                    WHERE ra.history_item_id = sm.history_item_id) END AS approver_count
      FROM selected s
      LEFT JOIN public.conversation_units cu ON cu.id = s.unit_id
      LEFT JOIN public.shared_world_materials sm ON sm.id = s.material_id AND sm.world_id = s.world_id
      LEFT JOIN public.shared_world_history_items i ON i.id = sm.history_item_id
      LEFT JOIN public.shared_world_text_material_bodies b ON b.material_id = sm.id
  )
  SELECT r.item_id,
         (row_number() OVER (ORDER BY r.token COLLATE "C"))::integer,
         r.src_class,
         r.classification,
         'sha256:' || encode(sha256(convert_to(r.body, 'UTF8')), 'hex'),
         r.body,
         r.unit_id,
         r.owner_id,
         r.world_id,
         r.material_id,
         r.history_id,
         r.revision,
         r.approver_count
    FROM resolved r;
$$;

ALTER FUNCTION public.resolve_public_package_items_v1(uuid[], uuid[], uuid[], uuid[], uuid[]) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 3. THE PUBLIC IDENTITY PRIMITIVES.
--
--    The human is exactly auth.uid(), derived and never supplied. Creating a
--    Public Identity requires choosing how it will be displayed, because a
--    Public Identity with no label cannot be rendered and inventing a default
--    label would be inventing Product copy.
--
--    `ensure` is get-or-create and never changes an existing label: changing a
--    label is the other primitive's job, and conflating them would let a
--    creation retry silently rewrite a chosen alias.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.ensure_public_identity_v1(
  p_command_id uuid, p_public_identity_ref uuid, p_label_mode text, p_display_label text
) RETURNS TABLE(outcome text, public_identity_ref uuid, label_mode text,
                display_label text, label_revision bigint, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_identity_commands;
  existing public.public_identities;
  display public.public_identity_display_state;
  request text;
  conflict text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_public_identity_ref IS NULL
     OR p_label_mode IS NULL OR p_label_mode NOT IN ('PSEUDONYM', 'REAL_NAME')
     OR p_display_label IS NULL OR length(btrim(p_display_label)) = 0 OR length(p_display_label) > 64
     OR p_public_identity_ref = u THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_IDENTITY_COMMAND_V1' || E'\n'
   || 'kind=ENSURE_PUBLIC_IDENTITY' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'identity=' || lower(p_public_identity_ref::text) || E'\n'
   || 'mode=' || p_label_mode || E'\n'
   || 'label=' || 'sha256:' || encode(sha256(convert_to(p_display_label, 'UTF8')), 'hex'), 'UTF8')), 'hex');

  SELECT * INTO committed FROM public.public_identity_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    SELECT * INTO display FROM public.public_identity_display_state d
     WHERE d.public_identity_ref = committed.public_identity_ref;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.public_identity_ref,
                        display.label_mode, display.display_label, display.label_revision,
                        committed.committed_at;
    RETURN;
  END IF;

  -- The identity's own row is the serialization point. Two concurrent first
  -- creations collide on UNIQUE (user_id) and the loser re-reads.
  SELECT * INTO existing FROM public.public_identities i WHERE i.user_id = u FOR UPDATE;
  instant := clock_timestamp();
  IF FOUND THEN
    SELECT * INTO display FROM public.public_identity_display_state d
     WHERE d.public_identity_ref = existing.public_identity_ref;
    INSERT INTO public.public_identity_commands
      (id, command_kind, actor_user_id, public_identity_ref, label_revision, request_ref, committed_at)
    VALUES (p_command_id, 'ENSURE_PUBLIC_IDENTITY', u, existing.public_identity_ref,
            display.label_revision, request, instant);
    RETURN QUERY SELECT 'ALREADY_PRESENT'::text, existing.public_identity_ref,
                        display.label_mode, display.display_label, display.label_revision, instant;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.public_identities (public_identity_ref, user_id, created_at)
    VALUES (p_public_identity_ref, u, instant);
  EXCEPTION WHEN unique_violation THEN
    -- Two different failures wear the same SQLSTATE, and telling them apart is
    -- the difference between "retry" and "choose another identity": a concurrent
    -- first creation by the same human lost the race on UNIQUE (user_id), while a
    -- reused public ref belongs to somebody else already.
    --
    -- The item is CONSTRAINT_NAME. PostgreSQL's `PG_EXCEPTION_` prefix exists for
    -- DETAIL, HINT and CONTEXT only; the constraint, column, table and schema
    -- items are unprefixed, and an invented name is not a syntax error the
    -- surrounding SQL reveals - plpgsql rejects it when the FUNCTION is created,
    -- and reports it at the line of the closing END.
    GET STACKED DIAGNOSTICS conflict = CONSTRAINT_NAME;
    IF conflict = 'public_identities_user_key' THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
    END IF;
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;
  INSERT INTO public.public_identity_display_state
    (public_identity_ref, label_mode, display_label, label_revision, updated_at)
  VALUES (p_public_identity_ref, p_label_mode, btrim(p_display_label), 1, instant);
  INSERT INTO public.public_identity_commands
    (id, command_kind, actor_user_id, public_identity_ref, label_revision, request_ref, committed_at)
  VALUES (p_command_id, 'ENSURE_PUBLIC_IDENTITY', u, p_public_identity_ref, 1, request, instant);

  RETURN QUERY SELECT 'CREATED'::text, p_public_identity_ref, p_label_mode,
                      btrim(p_display_label), 1::bigint, instant;
END$$;

CREATE FUNCTION public.update_public_display_label_v1(
  p_command_id uuid, p_label_mode text, p_display_label text
) RETURNS TABLE(outcome text, public_identity_ref uuid, label_mode text,
                display_label text, label_revision bigint, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_identity_commands;
  owned public.public_identities;
  display public.public_identity_display_state;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_label_mode IS NULL OR p_label_mode NOT IN ('PSEUDONYM', 'REAL_NAME')
     OR p_display_label IS NULL OR length(btrim(p_display_label)) = 0 OR length(p_display_label) > 64 THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_IDENTITY_COMMAND_V1' || E'\n'
   || 'kind=UPDATE_PUBLIC_DISPLAY_LABEL' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'mode=' || p_label_mode || E'\n'
   || 'label=' || 'sha256:' || encode(sha256(convert_to(p_display_label, 'UTF8')), 'hex'), 'UTF8')), 'hex');

  SELECT * INTO committed FROM public.public_identity_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    SELECT * INTO display FROM public.public_identity_display_state d
     WHERE d.public_identity_ref = committed.public_identity_ref;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.public_identity_ref,
                        display.label_mode, display.display_label, committed.label_revision,
                        committed.committed_at;
    RETURN;
  END IF;

  -- THE ACTOR OWNS THE PUBLIC IDENTITY EXACTLY. There is no identity parameter,
  -- so one human can never rename another human's public presentation.
  SELECT * INTO owned FROM public.public_identities i WHERE i.user_id = u FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  instant := clock_timestamp();
  UPDATE public.public_identity_display_state d
     SET label_mode = p_label_mode, display_label = btrim(p_display_label),
         label_revision = d.label_revision + 1, updated_at = instant
   WHERE d.public_identity_ref = owned.public_identity_ref
  RETURNING * INTO display;

  INSERT INTO public.public_identity_commands
    (id, command_kind, actor_user_id, public_identity_ref, label_revision, request_ref, committed_at)
  VALUES (p_command_id, 'UPDATE_PUBLIC_DISPLAY_LABEL', u, owned.public_identity_ref,
          display.label_revision, request, instant);

  RETURN QUERY SELECT 'UPDATED'::text, owned.public_identity_ref, display.label_mode,
                      display.display_label, display.label_revision, instant;
END$$;

-- ---------------------------------------------------------------------------
-- 4. CREATE A DRAFT PUBLIC EXPERIENCE.
--
--    The creating human is exactly auth.uid(). Their stable Public Identity is
--    RESOLVED from that, never supplied, so nobody can create an Experience
--    attributed to another human's public identity.
--
--    Creation gives control to the exact creating human and to nobody else. It
--    creates no package, no version, no public visibility, no contact path and
--    no semantic placement.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.create_public_experience_draft_v1(
  p_command_id uuid, p_experience_id uuid
) RETURNS TABLE(outcome text, experience_id uuid, created_by_public_identity_ref uuid,
                current_lifecycle text, experience_revision bigint, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_experience_draft_commands;
  identity public.public_identities;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_EXPERIENCE_DRAFT_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, and reading only immutable
  -- command history.
  SELECT * INTO committed FROM public.public_experience_draft_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        committed.created_by_public_identity_ref,
                        (SELECT e.current_lifecycle FROM public.public_experiences e
                          WHERE e.id = committed.experience_id),
                        (SELECT e.experience_revision FROM public.public_experiences e
                          WHERE e.id = committed.experience_id),
                        committed.committed_at;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the ONE Public World.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;

  SELECT * INTO committed FROM public.public_experience_draft_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        committed.created_by_public_identity_ref,
                        (SELECT e.current_lifecycle FROM public.public_experiences e
                          WHERE e.id = committed.experience_id),
                        (SELECT e.experience_revision FROM public.public_experiences e
                          WHERE e.id = committed.experience_id),
                        committed.committed_at;
    RETURN;
  END IF;

  -- THE ACTOR'S STABLE PUBLIC IDENTITY, RESOLVED. No parameter names it.
  SELECT * INTO identity FROM public.public_identities i WHERE i.user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of this creation.
  instant := clock_timestamp();

  BEGIN
    INSERT INTO public.public_experiences
      (id, public_world_singleton, created_by_public_identity_ref, current_lifecycle,
       current_experience_version_id, experience_revision, created_at)
    VALUES (p_experience_id, true, identity.public_identity_ref, 'DRAFT', NULL, 1, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  -- EXPERIENCE CONTROL, to the exact creating human. A content rightsholder is
  -- never inserted here by any approval.
  INSERT INTO public.public_experience_controllers
    (experience_id, controller_public_identity_ref, controller_user_id, control_basis, established_at)
  VALUES (p_experience_id, identity.public_identity_ref, u, 'EXPERIENCE_CREATION', instant);

  -- The lifecycle event reuses the command identity, so a caller that reuses one
  -- uuid across two different command families is refused with a bounded class
  -- rather than a raw constraint name.
  BEGIN
    INSERT INTO public.public_experience_lifecycle_events
      (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
    VALUES (p_command_id, p_experience_id, NULL, NULL, 'DRAFT', instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  INSERT INTO public.public_experience_draft_commands
    (id, experience_id, actor_user_id, created_by_public_identity_ref, request_ref, committed_at)
  VALUES (p_command_id, p_experience_id, u, identity.public_identity_ref, request, instant);

  RETURN QUERY SELECT 'DRAFT_CREATED'::text, p_experience_id, identity.public_identity_ref,
                      'DRAFT'::text, 1::bigint, instant;
END$$;

-- ---------------------------------------------------------------------------
-- 5. PREPARE AN IMMUTABLE PUBLICATION PACKAGE.
--
--    The caller selects WHICH source items to include and supplies opaque
--    persistence identities. The caller supplies NO approver, NO authority, NO
--    rightsholder, NO audience, NO visibility, NO public body, NO classification,
--    NO ordinal and NO instant: every one of those is derived from canonical
--    state under the canonical locks, or read once from the database clock.
--
--    The public derivative is the exact committed source text. Sub-item portion
--    selection is deliberately not invented: a publisher selects which committed
--    units to include, and the public body is provably a faithful copy of
--    authorized source rather than free text a caller could substitute for it.
--
--    Item order is DERIVED canonically from the source scope, not supplied, so
--    the same selection always produces the same package identity.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.prepare_public_experience_manifest_v1(
  p_command_id uuid,
  p_experience_id uuid,
  p_manifest_version_id uuid,
  p_experience_version_id uuid,
  p_personal_package_item_ids uuid[],
  p_personal_source_unit_ids uuid[],
  p_shared_package_item_ids uuid[],
  p_shared_source_world_ids uuid[],
  p_shared_source_material_ids uuid[]
) RETURNS TABLE(outcome text, manifest_version_id uuid, experience_version_id uuid,
                version_ordinal integer, item_count integer, required_approver_count integer,
                authority_request_fingerprint text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.publication_package_prepare_commands;
  experience public.public_experiences;
  controller public.public_experience_controllers;
  personal_count integer := coalesce(array_length(p_personal_package_item_ids, 1), 0);
  shared_count integer := coalesce(array_length(p_shared_package_item_ids, 1), 0);
  total integer;
  next_ordinal integer;
  derived_approvers uuid[];
  derived_count integer;
  derived_fingerprint text;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_manifest_version_id IS NULL
     OR p_experience_version_id IS NULL
     OR p_personal_package_item_ids IS NULL OR p_personal_source_unit_ids IS NULL
     OR p_shared_package_item_ids IS NULL OR p_shared_source_world_ids IS NULL
     OR p_shared_source_material_ids IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- Aligned arrays of equal length, with no NULL element, and a NON-EMPTY package.
  IF personal_count <> coalesce(array_length(p_personal_source_unit_ids, 1), 0)
     OR shared_count <> coalesce(array_length(p_shared_source_world_ids, 1), 0)
     OR shared_count <> coalesce(array_length(p_shared_source_material_ids, 1), 0)
     OR array_position(p_personal_package_item_ids, NULL) IS NOT NULL
     OR array_position(p_personal_source_unit_ids, NULL) IS NOT NULL
     OR array_position(p_shared_package_item_ids, NULL) IS NOT NULL
     OR array_position(p_shared_source_world_ids, NULL) IS NOT NULL
     OR array_position(p_shared_source_material_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  total := personal_count + shared_count;
  IF total = 0 THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- Distinct package item identities, distinct Personal sources and distinct
  -- Shared sources: an item may appear in a package exactly once.
  IF (SELECT count(DISTINCT x) FROM unnest(p_personal_package_item_ids || p_shared_package_item_ids) x) <> total
     OR (SELECT count(DISTINCT x) FROM unnest(p_personal_source_unit_ids) x) <> personal_count
     OR (SELECT count(*) FROM (SELECT DISTINCT w, m
           FROM unnest(p_shared_source_world_ids, p_shared_source_material_ids) t(w, m)) d) <> shared_count THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_PACKAGE_PREPARE_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'manifest=' || lower(p_manifest_version_id::text) || E'\n'
   || 'experienceVersion=' || lower(p_experience_version_id::text) || E'\n'
   || 'personal=' || coalesce((SELECT string_agg(lower(t.pi::text) || '@' || lower(t.su::text), ','
                                 ORDER BY lower(t.pi::text) COLLATE "C")
                                 FROM unnest(p_personal_package_item_ids, p_personal_source_unit_ids)
                                   AS t(pi, su)), '') || E'\n'
   || 'shared=' || coalesce((SELECT string_agg(lower(t.pi::text) || '@' || lower(t.w::text)
                                               || ':' || lower(t.m::text), ','
                               ORDER BY lower(t.pi::text) COLLATE "C")
                               FROM unnest(p_shared_package_item_ids, p_shared_source_world_ids,
                                           p_shared_source_material_ids) AS t(pi, w, m)), ''), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS.
  SELECT * INTO committed FROM public.publication_package_prepare_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.manifest_version_id,
                        committed.experience_version_id,
                        (SELECT v.version_ordinal FROM public.public_experience_versions v
                          WHERE v.id = committed.experience_version_id),
                        committed.item_count, committed.required_approver_count,
                        committed.authority_request_fingerprint, committed.committed_at;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the ONE Public World.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  -- CANONICAL LOCK ORDER, STEP 2: the exact Experience.
  SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.publication_package_prepare_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.manifest_version_id,
                        committed.experience_version_id,
                        (SELECT v.version_ordinal FROM public.public_experience_versions v
                          WHERE v.id = committed.experience_version_id),
                        committed.item_count, committed.required_approver_count,
                        committed.authority_request_fingerprint, committed.committed_at;
    RETURN;
  END IF;

  -- THE EXACT CONTROLLER, and nobody else. A content rightsholder does not gain
  -- this, and there is no controller parameter.
  SELECT * INTO controller FROM public.public_experience_controllers c
   WHERE c.experience_id = p_experience_id AND c.controller_user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;
  -- I-05A prepares packages for a DRAFT Experience only. It owns no transition
  -- back out of READY_FOR_REVIEW and no public lifecycle at all.
  IF experience.current_lifecycle <> 'DRAFT' THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID' USING ERRCODE='55000';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 4: the exact source rows, in the SAME relative
  -- order every I-04 consequential mutation uses - the Shared World row, then
  -- materials by id, then history items by id. SHARE locks throughout: Public
  -- reads Shared truth and never writes it.
  --
  -- The Shared World row is the synchronization point source-view authority
  -- needs. Every I-04 mutation that can change what this human may see - leave,
  -- removal, rejoin, a history grant, closure, owner deletion - takes
  -- `shared_worlds FOR UPDATE` FIRST, so a SHARE lock here means the visibility
  -- answer resolved below cannot go stale before the body is copied. Taking it
  -- creates no cycle: I-04 never takes a Public lock, and Public acquires the
  -- three Shared relations in I-04's own order.
  PERFORM 1 FROM public.shared_worlds w
    WHERE w.id = ANY(p_shared_source_world_ids) ORDER BY w.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_materials m
    WHERE m.id = ANY(p_shared_source_material_ids) ORDER BY m.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id IN (SELECT m.history_item_id FROM public.shared_world_materials m
                    WHERE m.id = ANY(p_shared_source_material_ids))
    ORDER BY i.id FOR SHARE;
  PERFORM 1 FROM public.conversation_units cu
    WHERE cu.id = ANY(p_personal_source_unit_ids) ORDER BY cu.id FOR SHARE;

  -- ===================== THE PERSONAL SOURCE ADAPTER =====================
  -- Every named unit exists.
  IF EXISTS (SELECT 1 FROM unnest(p_personal_source_unit_ids) s(id)
              WHERE NOT EXISTS (SELECT 1 FROM public.conversation_units cu WHERE cu.id = s.id)) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- The actor owns it exactly. Another human cannot prepare it.
  IF EXISTS (SELECT 1 FROM public.conversation_units cu
              WHERE cu.id = ANY(p_personal_source_unit_ids) AND cu.user_id <> u) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;
  -- PERSONAL QANDEEL ANALYSIS FAILS CLOSED. The exact protected-human authority
  -- requirement is not resolvable from current reviewed repository truth, and
  -- unresolved never means approval-free.
  IF EXISTS (SELECT 1 FROM public.conversation_units cu
              WHERE cu.id = ANY(p_personal_source_unit_ids) AND cu.source_role <> 'USER') THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED' USING ERRCODE='55000';
  END IF;

  -- ====================== THE SHARED SOURCE ADAPTER ======================
  -- Every named material exists in the exact named World.
  IF EXISTS (
    SELECT 1 FROM unnest(p_shared_source_world_ids, p_shared_source_material_ids) t(w, m)
     WHERE NOT EXISTS (SELECT 1 FROM public.shared_world_materials sm
                        WHERE sm.id = t.m AND sm.world_id = t.w)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- ============ SOURCE-ACCESS AUTHORITY, BEFORE ANY BODY IS READ ============
  --
  -- Content publication authority is NOT source-access authority. A rightsholder
  -- approving the widening of THEIR material says nothing about whether the human
  -- assembling the package was ever entitled to SEE it. Without this check, a
  -- controller who merely knew valid Shared identifiers could make this
  -- SECURITY DEFINER path copy hidden bytes into their own DRAFT and then read
  -- them back through the controller review boundary - before any rightsholder
  -- approval, and before any audience expansion existed to be refused.
  --
  -- The entitlement question belongs to I-04F and is NOT re-implemented here.
  -- This consumes the canonical entry point,
  -- `resolve_shared_world_history_visibility_v1(world, human)`, which already
  -- owns the whole meaning: the ACTIVE union of membership-period visibility and
  -- explicit history grants, the READ_ONLY_CLOSED delegation to the exact frozen
  -- closure entitlement, the requirement of an open episode, availability
  -- dominating every basis, and a truthful EMPTY answer rather than a
  -- distinguishable error for a human with no standing - so it is not a
  -- membership oracle and neither is this.
  --
  -- A former member keeps material authority to APPROVE their own included
  -- material (proven separately below). That is a different right from browsing,
  -- and this check is what keeps preparation from becoming the backdoor.
  --
  -- The denial class is deliberately the SAME one a nonexistent material gets, so
  -- a caller cannot learn from the error whether a hidden source id exists. It is
  -- also evaluated BEFORE the kind, availability and authority checks below, so
  -- none of those can answer that question either.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_materials sm
     WHERE sm.id = ANY(p_shared_source_material_ids)
       AND NOT EXISTS (
         SELECT 1 FROM public.resolve_shared_world_history_visibility_v1(sm.world_id, u) v
          WHERE v.history_item_id = sm.history_item_id)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- Only a kind that has a PUBLIC body form may be included. HUMAN_VOICE_NOTE
  -- has no reviewed public media boundary; EXPLICIT_DISCLOSURE and
  -- WORLD_EVENT_DERIVED_MATERIAL have no producer at all.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_materials sm
     WHERE sm.id = ANY(p_shared_source_material_ids)
       AND sm.material_kind NOT IN ('HUMAN_TEXT', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS')
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_KIND_RESERVED' USING ERRCODE='0A000';
  END IF;
  -- The source must be currently available, and its body must still exist.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_materials sm
      JOIN public.shared_world_history_items i ON i.id = sm.history_item_id
     WHERE sm.id = ANY(p_shared_source_material_ids) AND i.availability_state <> 'AVAILABLE'
  ) OR EXISTS (
    SELECT 1 FROM public.shared_world_materials sm
     WHERE sm.id = ANY(p_shared_source_material_ids)
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies b
                        WHERE b.material_id = sm.id)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- UNRESOLVED ADDITIONAL HUMAN AUTHORITY FAILS CLOSED FOR PACKAGE INCLUSION,
  -- and so does the absence of any source-side authority metadata.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_materials sm
     WHERE sm.id = ANY(p_shared_source_material_ids)
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_material_historical_authority ha
                        WHERE ha.material_id = sm.id
                          AND ha.resolution_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT',
                                                      'RESOLVED_NO_HUMAN_REQUIREMENT'))
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED' USING ERRCODE='55000';
  END IF;

  -- THE NEXT VERSION ORDINAL of this exact Experience, under its own lock.
  SELECT coalesce(max(v.version_ordinal), 0) + 1 INTO next_ordinal
    FROM public.public_experience_versions v WHERE v.experience_id = p_experience_id;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of this preparation.
  instant := clock_timestamp();

  BEGIN
    INSERT INTO public.publication_package_manifest_versions
      (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
       intended_publication_action, target_audience_class, authority_readiness,
       prepared_authority_snapshot_version, item_count, created_at)
    SELECT p_manifest_version_id, p_experience_id, true, controller.controller_public_identity_ref, u,
           'PUBLISH_TO_PUBLIC_WORLD', 'PUBLIC_WORLD_AUDIENCE', 'PRIVACY_OWNERSHIP_AUTHORITY_ONLY',
           w.state_version, total, instant
      FROM public.public_world_state w WHERE w.singleton;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  -- THE ITEMS, THEIR PUBLIC BODIES, THEIR SEALED PROVENANCE AND THEIR PER-ITEM
  -- AUTHORITY, all from the ONE item resolution over the exact locked source.
  INSERT INTO public.publication_package_manifest_items
    (manifest_version_id, experience_id, package_item_id, item_ordinal,
     derivative_classification, public_body_form, public_body_digest)
  SELECT p_manifest_version_id, p_experience_id, r.package_item_id, r.item_ordinal,
         r.derivative_classification, 'PUBLIC_TEXT', r.public_body_digest
    FROM public.resolve_public_package_items_v1(
           p_personal_package_item_ids, p_personal_source_unit_ids, p_shared_package_item_ids,
           p_shared_source_world_ids, p_shared_source_material_ids) r;

  INSERT INTO public.public_experience_text_derivative_bodies
    (package_item_id, public_body_form, public_text_body)
  SELECT r.package_item_id, 'PUBLIC_TEXT', r.public_text_body
    FROM public.resolve_public_package_items_v1(
           p_personal_package_item_ids, p_personal_source_unit_ids, p_shared_package_item_ids,
           p_shared_source_world_ids, p_shared_source_material_ids) r;

  INSERT INTO public.publication_package_item_provenance
    (package_item_id, manifest_version_id, source_class, personal_conversation_unit_id,
     personal_owner_user_id, shared_world_id, shared_material_id, shared_history_item_id,
     captured_availability_state, captured_availability_revision, captured_source_digest)
  SELECT r.package_item_id, p_manifest_version_id, r.source_class, r.personal_conversation_unit_id,
         r.personal_owner_user_id, r.shared_world_id, r.shared_material_id, r.shared_history_item_id,
         'AVAILABLE', r.captured_availability_revision, r.public_body_digest
    FROM public.resolve_public_package_items_v1(
           p_personal_package_item_ids, p_personal_source_unit_ids, p_shared_package_item_ids,
           p_shared_source_world_ids, p_shared_source_material_ids) r;

  INSERT INTO public.publication_package_item_authority
    (package_item_id, manifest_version_id, resolution_state, required_approver_count)
  SELECT r.package_item_id, p_manifest_version_id,
         CASE WHEN r.item_required_approver_count > 0
              THEN 'RESOLVED_EXACT_HUMAN_REQUIREMENT' ELSE 'RESOLVED_NO_HUMAN_REQUIREMENT' END,
         r.item_required_approver_count
    FROM public.resolve_public_package_items_v1(
           p_personal_package_item_ids, p_personal_source_unit_ids, p_shared_package_item_ids,
           p_shared_source_world_ids, p_shared_source_material_ids) r;

  -- THE PROSPECTIVE EXPERIENCE VERSION, bijective with this exact manifest.
  BEGIN
    INSERT INTO public.public_experience_versions
      (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
    VALUES (p_experience_version_id, p_experience_id, p_manifest_version_id, next_ordinal, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  -- THE DERIVED CONTENT RIGHTSHOLDER SET AND THE AUTHORITY REQUEST FINGERPRINT,
  -- from the ONE derivation, over the rows just written. The three results are
  -- read into explicitly typed scalars rather than a record, so every expression
  -- built from them has a type the planner knows without inferring one.
  SELECT d.required_approvers, d.required_approver_count, d.authority_fingerprint
    INTO derived_approvers, derived_count, derived_fingerprint
    FROM public.derive_public_publication_authority_v1(p_manifest_version_id) d;

  INSERT INTO public.publication_manifest_required_approvers (manifest_version_id, approver_user_id)
  SELECT p_manifest_version_id, a.approver FROM unnest(derived_approvers) AS a(approver);

  -- The Experience moves forward one revision and points at the new prospective
  -- version. Its lifecycle does NOT change: preparing a package is not a
  -- lifecycle transition and widens no audience.
  UPDATE public.public_experiences e
     SET current_experience_version_id = p_experience_version_id,
         experience_revision = e.experience_revision + 1
   WHERE e.id = p_experience_id;

  INSERT INTO public.publication_package_prepare_commands
    (id, experience_id, manifest_version_id, experience_version_id, actor_user_id, command_action,
     item_count, required_approver_count, authority_request_fingerprint, request_ref, committed_at)
  VALUES (p_command_id, p_experience_id, p_manifest_version_id, p_experience_version_id, u,
          'PREPARE_PUBLICATION', total, derived_count, derived_fingerprint, request, instant);

  RETURN QUERY SELECT 'PACKAGE_PREPARED'::text, p_manifest_version_id, p_experience_version_id,
                      next_ordinal, total, derived_count, derived_fingerprint, instant;
END$$;

-- ---------------------------------------------------------------------------
-- 6. APPROVE AN EXACT PUBLICATION PACKAGE.
--
--    The approving human is exactly auth.uid(). There is no approver parameter,
--    and the composite foreign key into the DERIVED required set makes an
--    approval by a human this manifest does not require structurally impossible.
--
--    A former Shared member whose material authority survived their departure
--    may approve their own included material here. Nothing on this path reads
--    membership, so approving restores no Shared browsing access whatsoever.
--
--    An approval grants NO Experience control: this function writes no controller
--    row of any kind.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.approve_public_experience_manifest_v1(
  p_approval_id uuid, p_manifest_version_id uuid
) RETURNS TABLE(outcome text, approval_id uuid, approved_manifest_version_id uuid,
                approving_user_id uuid, bound_authority_fingerprint text, approved_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.publication_manifest_approvals;
  manifest public.publication_package_manifest_versions;
  experience public.public_experiences;
  target_experience uuid;
  derived_approvers uuid[];
  derived_count integer;
  derived_fingerprint text;
  stored uuid[];
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_approval_id IS NULL OR p_manifest_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: an approval IS its own immutable record.
  SELECT * INTO committed FROM public.publication_manifest_approvals a WHERE a.id = p_approval_id;
  IF FOUND THEN
    IF committed.manifest_version_id = p_manifest_version_id AND committed.approver_user_id = u THEN
      RETURN QUERY SELECT 'ALREADY_APPROVED'::text, committed.id, committed.manifest_version_id,
                          committed.approver_user_id, committed.bound_authority_fingerprint,
                          committed.approved_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- WORLD-FIRST ORDER. Only enough of the manifest is pre-read to discover which
  -- Experience this approval belongs to; the manifest is never locked first.
  SELECT m.experience_id INTO target_experience
    FROM public.publication_package_manifest_versions m WHERE m.id = p_manifest_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEPS 1 AND 2.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  SELECT * INTO experience FROM public.public_experiences e WHERE e.id = target_experience FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.publication_manifest_approvals a WHERE a.id = p_approval_id;
  IF FOUND THEN
    IF committed.manifest_version_id = p_manifest_version_id AND committed.approver_user_id = u THEN
      RETURN QUERY SELECT 'ALREADY_APPROVED'::text, committed.id, committed.manifest_version_id,
                          committed.approver_user_id, committed.bound_authority_fingerprint,
                          committed.approved_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  IF experience.current_lifecycle <> 'DRAFT' THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID' USING ERRCODE='55000';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 3: the exact manifest. It is immutable, so this
  -- is a SHARE lock that documents the hierarchy rather than defending a column.
  SELECT * INTO manifest FROM public.publication_package_manifest_versions m
   WHERE m.id = p_manifest_version_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF manifest.experience_id <> target_experience THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 4: the exact source rows, same relative order -
  -- the Shared World row first, exactly as every I-04 mutation takes it.
  PERFORM 1 FROM public.shared_worlds w
    WHERE w.id IN (SELECT p.shared_world_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'SHARED_WORLD')
    ORDER BY w.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_materials m
    WHERE m.id IN (SELECT p.shared_material_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'SHARED_WORLD')
    ORDER BY m.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id IN (SELECT p.shared_history_item_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'SHARED_WORLD')
    ORDER BY i.id FOR SHARE;
  PERFORM 1 FROM public.conversation_units cu
    WHERE cu.id IN (SELECT p.personal_conversation_unit_id FROM public.publication_package_item_provenance p
                     WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'MY_WORLD')
    ORDER BY cu.id FOR SHARE;

  -- REVALIDATE THE EXACT SOURCE AUTHORITY AND AVAILABILITY, from the ONE
  -- derivation. It raises on an unavailable source, an unresolved authority and
  -- contradictory metadata.
  SELECT d.required_approvers, d.required_approver_count, d.authority_fingerprint
    INTO derived_approvers, derived_count, derived_fingerprint
    FROM public.derive_public_publication_authority_v1(p_manifest_version_id) d;

  SELECT coalesce(array_agg(ra.approver_user_id ORDER BY ra.approver_user_id), ARRAY[]::uuid[])
    INTO stored FROM public.publication_manifest_required_approvers ra
   WHERE ra.manifest_version_id = p_manifest_version_id;
  IF stored <> derived_approvers THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;
  IF NOT (u = ANY(derived_approvers)) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  instant := clock_timestamp();
  BEGIN
    INSERT INTO public.publication_manifest_approvals
      (id, manifest_version_id, approver_user_id, bound_authority_fingerprint, approved_at)
    VALUES (p_approval_id, p_manifest_version_id, u, derived_fingerprint, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'APPROVED'::text, p_approval_id, p_manifest_version_id, u,
                      derived_fingerprint, instant;
END$$;

-- ---------------------------------------------------------------------------
-- 7. COMMIT READY_FOR_REVIEW.
--
--    DRAFT -> READY_FOR_REVIEW and nothing else. No synthetic human approver, no
--    public visibility, no public serving and no PUBLISHED state: this function
--    writes the string READY_FOR_REVIEW and never any other lifecycle value.
--
--    A changed package, a changed source, a changed authority or a changed
--    Public World authority snapshot each stale the attempt, because the
--    fingerprint every approval is bound to is re-derived here from current
--    state and must still match.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_public_experience_ready_for_review_v1(
  p_command_id uuid, p_experience_id uuid, p_experience_version_id uuid
) RETURNS TABLE(outcome text, experience_id uuid, experience_version_id uuid,
                manifest_version_id uuid, current_lifecycle text, satisfied_approval_count integer,
                authority_request_fingerprint text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_experience_review_ready_commands;
  experience public.public_experiences;
  committing public.public_experience_versions;
  manifest public.publication_package_manifest_versions;
  derived_approvers uuid[];
  derived_count integer;
  derived_fingerprint text;
  stored uuid[];
  satisfied integer;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_experience_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_REVIEW_READY_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'experienceVersion=' || lower(p_experience_version_id::text), 'UTF8')), 'hex');

  SELECT * INTO committed FROM public.public_experience_review_ready_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        committed.experience_version_id, committed.manifest_version_id,
                        (SELECT e.current_lifecycle FROM public.public_experiences e
                          WHERE e.id = committed.experience_id),
                        committed.satisfied_approval_count,
                        committed.authority_request_fingerprint, committed.committed_at;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEPS 1 AND 2.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.public_experience_review_ready_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        committed.experience_version_id, committed.manifest_version_id,
                        experience.current_lifecycle, committed.satisfied_approval_count,
                        committed.authority_request_fingerprint, committed.committed_at;
    RETURN;
  END IF;

  -- THE EXACT CONTROLLER. A content rightsholder never acquires this, and a
  -- controller can never bypass a missing content approval below.
  IF NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                  WHERE c.experience_id = p_experience_id AND c.controller_user_id = u) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;
  IF experience.current_lifecycle <> 'DRAFT' THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID' USING ERRCODE='55000';
  END IF;

  -- THE EXACT VERSION, and it must still be the Experience's current one: a
  -- newer preparation stales this attempt rather than committing an old package.
  SELECT * INTO committing FROM public.public_experience_versions v
   WHERE v.id = p_experience_version_id AND v.experience_id = p_experience_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF experience.current_experience_version_id IS DISTINCT FROM p_experience_version_id THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 3.
  SELECT * INTO manifest FROM public.publication_package_manifest_versions m
   WHERE m.id = committing.package_manifest_version_id FOR SHARE;
  IF NOT FOUND OR manifest.experience_id <> p_experience_id THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 4: the exact source rows, same relative order -
  -- the Shared World row first, exactly as every I-04 mutation takes it.
  PERFORM 1 FROM public.shared_worlds w
    WHERE w.id IN (SELECT p.shared_world_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD')
    ORDER BY w.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_materials m
    WHERE m.id IN (SELECT p.shared_material_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD')
    ORDER BY m.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id IN (SELECT p.shared_history_item_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD')
    ORDER BY i.id FOR SHARE;
  PERFORM 1 FROM public.conversation_units cu
    WHERE cu.id IN (SELECT p.personal_conversation_unit_id FROM public.publication_package_item_provenance p
                     WHERE p.manifest_version_id = manifest.id AND p.source_class = 'MY_WORLD')
    ORDER BY cu.id FOR SHARE;

  -- REVALIDATE EVERYTHING, from the ONE derivation.
  SELECT d.required_approvers, d.required_approver_count, d.authority_fingerprint
    INTO derived_approvers, derived_count, derived_fingerprint
    FROM public.derive_public_publication_authority_v1(manifest.id) d;

  SELECT coalesce(array_agg(ra.approver_user_id ORDER BY ra.approver_user_id), ARRAY[]::uuid[])
    INTO stored FROM public.publication_manifest_required_approvers ra
   WHERE ra.manifest_version_id = manifest.id;
  IF stored <> derived_approvers THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;

  -- EVERY REQUIRED APPROVAL IS PRESENT. A controller cannot substitute for one.
  SELECT count(*)::integer INTO satisfied FROM public.publication_manifest_approvals a
   WHERE a.manifest_version_id = manifest.id;
  IF satisfied <> derived_count THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_APPROVALS_INCOMPLETE' USING ERRCODE='P0002';
  END IF;
  -- AND EVERY APPROVAL STILL BINDS THE CURRENT AUTHORITY. An approval collected
  -- against a different source authority, required set or Public World authority
  -- snapshot cannot float forward onto this commit.
  IF EXISTS (SELECT 1 FROM public.publication_manifest_approvals a
              WHERE a.manifest_version_id = manifest.id
                AND a.bound_authority_fingerprint <> derived_fingerprint) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;

  instant := clock_timestamp();

  UPDATE public.public_experiences e
     SET current_lifecycle = 'READY_FOR_REVIEW', experience_revision = e.experience_revision + 1
   WHERE e.id = p_experience_id;

  BEGIN
    INSERT INTO public.public_experience_lifecycle_events
      (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
    VALUES (p_command_id, p_experience_id, p_experience_version_id, 'DRAFT', 'READY_FOR_REVIEW', instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  BEGIN
    INSERT INTO public.public_experience_review_ready_commands
      (id, experience_id, experience_version_id, manifest_version_id, actor_user_id,
       satisfied_approval_count, authority_request_fingerprint, request_ref, committed_at)
    VALUES (p_command_id, p_experience_id, p_experience_version_id, manifest.id, u,
            satisfied, derived_fingerprint, request, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'READY_FOR_REVIEW'::text, p_experience_id, p_experience_version_id,
                      manifest.id, 'READY_FOR_REVIEW'::text, satisfied,
                      derived_fingerprint, instant;
END$$;

-- ---------------------------------------------------------------------------
-- 8. THE ONE REVIEW READ BOUNDARY.
--
--    It answers the exact CONTROLLER of one Experience and nobody else. A
--    non-controller - and a human asking about an Experience that does not exist
--    - receives ZERO ROWS rather than an error, so the surface discloses nothing
--    about the existence of anything.
--
--    It returns the bounded PUBLIC derivative, the publisher's stable public ref
--    and current display label, the manifest and version identities, and the
--    approval completion state. It returns NO private account identifier, NO
--    contact endpoint, NO source identifier of any kind, NO source World or
--    Session, NO sealed provenance and NO material not included in the package.
--
--    It is NOT the Public World serving resolver: it requires an exact
--    controller, so a DRAFT or a READY_FOR_REVIEW Experience has no public
--    audience at all. I-05B creates public serving.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_public_experience_review_v1(p_experience_id uuid, p_user_id uuid)
RETURNS TABLE(experience_id uuid, current_lifecycle text, experience_version_id uuid,
              version_ordinal integer, manifest_version_id uuid, publisher_public_identity_ref uuid,
              publisher_label_mode text, publisher_display_label text, package_item_id uuid,
              item_ordinal integer, derivative_classification text, public_body_form text,
              public_text_body text, required_approver_count integer,
              satisfied_approval_count integer, approvals_complete boolean)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_experience_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT e.id, e.current_lifecycle, v.id, v.version_ordinal, m.id,
         m.publisher_public_identity_ref, d.label_mode, d.display_label,
         it.package_item_id, it.item_ordinal, it.derivative_classification, it.public_body_form,
         b.public_text_body,
         (SELECT count(*)::integer FROM public.publication_manifest_required_approvers ra
           WHERE ra.manifest_version_id = m.id),
         (SELECT count(*)::integer FROM public.publication_manifest_approvals a
           WHERE a.manifest_version_id = m.id),
         (SELECT count(*) FROM public.publication_manifest_approvals a
           WHERE a.manifest_version_id = m.id)
         = (SELECT count(*) FROM public.publication_manifest_required_approvers ra
             WHERE ra.manifest_version_id = m.id)
    FROM public.public_experiences e
    JOIN public.public_experience_controllers c
      ON c.experience_id = e.id AND c.controller_user_id = p_user_id
    JOIN public.public_experience_versions v ON v.id = e.current_experience_version_id
    JOIN public.publication_package_manifest_versions m ON m.id = v.package_manifest_version_id
    JOIN public.public_identity_display_state d ON d.public_identity_ref = m.publisher_public_identity_ref
    JOIN public.publication_package_manifest_items it ON it.manifest_version_id = m.id
    JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
   WHERE e.id = p_experience_id
   ORDER BY it.item_ordinal;
END$$;

-- ---------------------------------------------------------------------------
-- 9. SECURITY POSTURE.
--
--    Every consequential primitive is postgres-owned, SECURITY DEFINER, VOLATILE,
--    search_path-pinned, and executable by NO application role: not PUBLIC, not
--    anon, not authenticated, not service_role. The frozen CW2-08 Launch Gate
--    precondition that would make any of them reachable is unimplemented, so
--    granting EXECUTE now would be manufacturing a launch decision I-05A has no
--    authority to make.
--
--    The authority derivation is internal in the same way: it is the input to
--    those primitives, not a surface.
--
--    The ONE review resolver is service_role-executable alone, the frozen narrow
--    resolver precedent of 0077 / 0079 / 0080 / 0087 / 0089.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.ensure_public_identity_v1(uuid, uuid, text, text) OWNER TO postgres;
ALTER FUNCTION public.update_public_display_label_v1(uuid, text, text) OWNER TO postgres;
ALTER FUNCTION public.create_public_experience_draft_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.prepare_public_experience_manifest_v1(uuid, uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], uuid[]) OWNER TO postgres;
ALTER FUNCTION public.approve_public_experience_manifest_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.commit_public_experience_ready_for_review_v1(uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_public_experience_review_v1(uuid, uuid) OWNER TO postgres;

DO $$
DECLARE
  internal text[] := ARRAY[
    'public.derive_public_publication_authority_v1(uuid)',
    'public.resolve_public_package_items_v1(uuid[], uuid[], uuid[], uuid[], uuid[])',
    'public.ensure_public_identity_v1(uuid, uuid, text, text)',
    'public.update_public_display_label_v1(uuid, text, text)',
    'public.create_public_experience_draft_v1(uuid, uuid)',
    'public.prepare_public_experience_manifest_v1(uuid, uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], uuid[])',
    'public.approve_public_experience_manifest_v1(uuid, uuid)',
    'public.commit_public_experience_ready_for_review_v1(uuid, uuid, uuid)'];
  resolver text := 'public.resolve_public_experience_review_v1(uuid, uuid)';
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
-- 10. SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  -- Every function I-05A owns, and the exact subset that mutates.
  internal text[] := ARRAY[
    'public.derive_public_publication_authority_v1(uuid)',
    'public.resolve_public_package_items_v1(uuid[], uuid[], uuid[], uuid[], uuid[])',
    'public.ensure_public_identity_v1(uuid, uuid, text, text)',
    'public.update_public_display_label_v1(uuid, text, text)',
    'public.create_public_experience_draft_v1(uuid, uuid)',
    'public.prepare_public_experience_manifest_v1(uuid, uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], uuid[])',
    'public.approve_public_experience_manifest_v1(uuid, uuid)',
    'public.commit_public_experience_ready_for_review_v1(uuid, uuid, uuid)'];
  mutating text[] := ARRAY[
    'public.ensure_public_identity_v1(uuid, uuid, text, text)',
    'public.update_public_display_label_v1(uuid, text, text)',
    'public.create_public_experience_draft_v1(uuid, uuid)',
    'public.prepare_public_experience_manifest_v1(uuid, uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], uuid[])',
    'public.approve_public_experience_manifest_v1(uuid, uuid)',
    'public.commit_public_experience_ready_for_review_v1(uuid, uuid, uuid)'];
  reading text[] := ARRAY[
    'public.derive_public_publication_authority_v1(uuid)',
    'public.resolve_public_package_items_v1(uuid[], uuid[], uuid[], uuid[], uuid[])'];
  resolver text := 'public.resolve_public_experience_review_v1(uuid, uuid)';
  preparer text := 'public.prepare_public_experience_manifest_v1(uuid, uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], uuid[])';
  own_tables text[] := ARRAY['public_identity_commands', 'public_experience_draft_commands',
                             'publication_package_prepare_commands',
                             'public_experience_review_ready_commands'];
  fn text;
  t text;
  role_name text;
  p record;
BEGIN
  -- EVERY FUNCTION IS POSTGRES-OWNED, SECURITY DEFINER, search_path PINNED, AND
  -- EXECUTABLE BY NO APPLICATION ROLE.
  FOREACH fn IN ARRAY internal LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pr.proargnames,
           pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-05A: % must be owned by postgres', fn; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-05A: % must be SECURITY DEFINER', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-05A: % must pin an empty search_path', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-05A: PUBLIC must not execute % before the frozen CW2-08 Launch Gate exists', fn;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name)
         AND has_function_privilege(role_name, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-05A: % must not execute % before the frozen CW2-08 Launch Gate exists', role_name, fn;
      END IF;
    END LOOP;
  END LOOP;

  -- THE MUTATIONS ARE VOLATILE; THE TWO DERIVATIONS ARE STABLE AND WRITE NOTHING.
  FOREACH fn IN ARRAY mutating LOOP
    IF (SELECT pr.provolatile FROM pg_proc pr WHERE pr.oid = fn::regprocedure) <> 'v' THEN
      RAISE EXCEPTION 'I-05A: consequential primitive % must be VOLATILE', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY reading LOOP
    SELECT pr.provolatile, pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.provolatile <> 's' THEN
      RAISE EXCEPTION 'I-05A: derivation % must be STABLE', fn;
    END IF;
    IF p.prosrc ~ 'INSERT INTO' OR p.prosrc ~ 'UPDATE public' OR p.prosrc ~ 'DELETE FROM' THEN
      RAISE EXCEPTION 'I-05A: derivation % must write nothing', fn;
    END IF;
  END LOOP;

  -- THE ONE REVIEW RESOLVER IS STABLE AND service_role-ONLY.
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc
    INTO p FROM pg_proc pr WHERE pr.oid = resolver::regprocedure;
  IF NOT p.prosecdef OR p.provolatile <> 's'
     OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-05A: the review resolver must be a STABLE SECURITY DEFINER with an empty search_path';
  END IF;
  IF has_function_privilege('public', resolver, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-05A: the review resolver must not be executable by PUBLIC';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name)
       AND has_function_privilege(role_name, resolver, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-05A: the review resolver must not be executable by %', role_name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role', resolver, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-05A: service_role must execute the ONE review resolver';
  END IF;
  -- AND IT DISCLOSES NO PRIVATE IDENTITY, NO CONTACT ENDPOINT AND NO SEALED
  -- PROVENANCE. This reads the declared OUT columns, which is mode 't' in
  -- `proargmodes`: for a RETURNS TABLE function `proargnames` holds the INPUT
  -- parameters AND the result columns in one array, and a check that ignored the
  -- mode would be asking a question about the wrong half.
  IF EXISTS (
    SELECT 1 FROM pg_proc pr,
      unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
     WHERE pr.oid = resolver::regprocedure AND arg.mode = 't'
       AND arg.name ~ '(user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material_id|history_item|availability|context_ref|world_id)'
  ) THEN
    RAISE EXCEPTION 'I-05A: the review resolver must disclose no private identity and no sealed provenance';
  END IF;
  IF (SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = resolver::regprocedure)
     ~ 'publication_package_item_provenance' THEN
    RAISE EXCEPTION 'I-05A: the review resolver must never read sealed provenance';
  END IF;

  -- NO I-05A PRIMITIVE CAN PRODUCE A PUBLIC LIFECYCLE. The needles are plain
  -- literals: a PostgreSQL regular expression matches `.` ACROSS newlines, so a
  -- wildcard here would silently run past the line it was meant to describe.
  FOREACH fn IN ARRAY internal LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc ~ 'PUBLISHED' OR p.prosrc ~ 'ABSENT_FROM_PUBLIC_WORLD' THEN
      RAISE EXCEPTION 'I-05A: % must not be able to produce a public lifecycle', fn;
    END IF;
  END LOOP;
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.commit_public_experience_ready_for_review_v1(uuid, uuid, uuid)'::regprocedure)
     !~ 'current_lifecycle = ''READY_FOR_REVIEW''' THEN
    RAISE EXCEPTION 'I-05A: the READY commit must write exactly READY_FOR_REVIEW';
  END IF;

  -- THE APPROVAL BINDS THE PROTECTED ACTION, NOT THE COMMAND. A manifest may
  -- only ever intend `PUBLISH_TO_PUBLIC_WORLD`, the prepare command may only ever
  -- be `PREPARE_PUBLICATION`, and the two vocabularies are disjoint - so a
  -- preparation request can never read as publication consent, and an approval
  -- collected here is bound to the action I-05B will actually execute.
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.publication_package_manifest_versions'::regclass
         AND c.conname = 'publication_package_manifest_versions_action_check') ~ 'PREPARE_PUBLICATION' THEN
    RAISE EXCEPTION 'I-05A: a manifest must not intend PREPARE_PUBLICATION: preparing is not audience expansion';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.publication_package_manifest_versions'::regclass
       AND c.conname = 'publication_package_manifest_versions_action_check'
       AND pg_get_constraintdef(c.oid) ~ 'PUBLISH_TO_PUBLIC_WORLD'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.publication_package_prepare_commands'::regclass
       AND c.conname = 'publication_package_prepare_commands_action_check'
       AND pg_get_constraintdef(c.oid) ~ 'PREPARE_PUBLICATION'
  ) THEN
    RAISE EXCEPTION 'I-05A: the intended publication action and the prepare command action must each be pinned';
  END IF;
  -- And the fingerprint must actually hash the intended action, or binding it
  -- would be a column nobody consults.
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.derive_public_publication_authority_v1(uuid)'::regprocedure)
     !~ 'intended_publication_action' THEN
    RAISE EXCEPTION 'I-05A: the authority request fingerprint must bind the intended publication action';
  END IF;

  -- NO FUNCTION ACCEPTS AN AUTHORITY, APPROVER, AUDIENCE, VISIBILITY, BODY,
  -- ORDINAL OR INSTANT PARAMETER. Two things make this assertion mean what it
  -- says. It reads only mode 'i' - the INPUT parameters - because for a RETURNS
  -- TABLE function `proargnames` also holds the result column names, and every
  -- one of these primitives RETURNS a version ordinal and an approver count it
  -- derived: a mode-blind check would refuse this migration for reporting the
  -- very values it proves no caller supplied. And it compares DECLARED argument
  -- names rather than matching a pattern against this migration's own text, so
  -- it can never accidentally match itself.
  --
  -- It covers every function, not only the mutations: the item resolution and the
  -- authority derivation are what the mutations TRUST, so a caller-supplied
  -- approver set smuggled into either of them would be the same forged authority
  -- arriving one call later.
  FOREACH fn IN ARRAY internal LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 'i'
         AND arg.name ~ '(approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|body_text|ordinal|count|classification|revision|fingerprint)'
    ) THEN
      RAISE EXCEPTION 'I-05A: % may not accept an authority audience visibility body ordinal or instant parameter', fn;
    END IF;
  END LOOP;

  -- NO MUTATION READS THE CALLER'S CLOCK, TAKES AN ADVISORY OR TABLE LOCK, OR
  -- MUTATES ANY PREDECESSOR DOMAIN.
  FOREACH fn IN ARRAY mutating LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc ~* 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
      RAISE EXCEPTION 'I-05A: % accepts no clock but one read of the database clock', fn;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' OR p.prosrc ~* 'TRUNCATE' THEN
      RAISE EXCEPTION 'I-05A: % locks rows in the canonical order and truncates nothing', fn;
    END IF;
    IF p.prosrc ~ '(INSERT INTO|UPDATE|DELETE FROM) public\.(shared_world|conversation_|users|memories|hypothes|standing_context|matching_|introduction)' THEN
      RAISE EXCEPTION 'I-05A: % must mutate no Shared Personal or predecessor state', fn;
    END IF;
    -- SOURCE-ACCESS AUTHORITY IS CONSUMED, NEVER RE-IMPLEMENTED. What is banned
    -- is a Public primitive deciding Shared entitlement for itself out of
    -- membership episodes, history grants or closed-World entitlements - the
    -- exact semantics I-04F and I-04G already own. Consuming the canonical
    -- visibility entry point is not only allowed, it is REQUIRED below.
    IF p.prosrc ~ 'shared_world_membership_episodes'
       OR p.prosrc ~ 'shared_world_history_access_grants'
       OR p.prosrc ~ 'shared_world_standard_closed_view_entitlements'
       OR p.prosrc ~ 'shared_world_history_package_manifest_items' THEN
      RAISE EXCEPTION 'I-05A: % must not re-implement Shared membership or history authorization: consume the canonical I-04F visibility entry point', fn;
    END IF;
  END LOOP;

  -- THE ONE PLACE A SHARED BODY IS COPIED MUST PROVE SOURCE-VIEW AUTHORITY, and
  -- it must do so through the canonical entry point rather than by inventing a
  -- second answer to a question I-04F already owns.
  IF (SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = preparer::regprocedure)
     !~ 'resolve_shared_world_history_visibility_v1' THEN
    RAISE EXCEPTION 'I-05A: publication preparation must prove the initiator may currently SEE each selected Shared history item';
  END IF;
  -- And it must hold the Shared World row while it does, or the answer can go
  -- stale between resolution and the copy.
  IF (SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = preparer::regprocedure)
     !~ 'FROM public\.shared_worlds w' THEN
    RAISE EXCEPTION 'I-05A: publication preparation must synchronize on the exact Shared World row before resolving source visibility';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role',
       'public.resolve_shared_world_history_visibility_v1(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I-05A: the frozen I-04F history visibility entry point must still be reachable';
  END IF;

  -- THE FROZEN PREDECESSOR BOUNDARIES THIS SLICE CONSUMES MUST STILL BE INTACT.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.conversation_units'::regclass
                    AND tg.tgname = 'conversation_units_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05A: the frozen committed Personal source must still be append-only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.shared_world_history_package_manifest_items'::regclass
                    AND tg.tgname = 'shared_world_material_historical_widening_gate'
                    AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05A: the frozen I-04G historical widening gate must still be in place';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role', 'public.resolve_shared_world_material_v1(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I-05A: the frozen I-04G material resolver must still be reachable';
  END IF;

  -- DENY BY DEFAULT ON EVERY COMMAND RELATION.
  FOREACH t IN ARRAY own_tables LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-05A: relation % must have row level security enabled', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-05A: relation % must carry zero policies', t;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN role_name <> 'public'
                AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name);
      IF has_table_privilege(role_name, ('public.' || t)::regclass, 'SELECT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'INSERT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'UPDATE')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'DELETE') THEN
        RAISE EXCEPTION 'I-05A: relation % must hold no privilege for %', t, role_name;
      END IF;
    END LOOP;
  END LOOP;
END$$;

COMMIT;
