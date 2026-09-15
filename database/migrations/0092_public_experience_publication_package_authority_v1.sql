-- I-05A - Public Experience Publication Package and Authority v1 (PART B).
--
-- Migration 0091 created the one Public World, the stable Public Identity and
-- the stable Public Experience with its immutable versions. This migration
-- creates the IMMUTABLE PUBLICATION PACKAGE those versions are made of: the
-- manifest, its exact item set, the bounded PUBLIC derivative each item carries,
-- the SEALED internal provenance that says where each item came from, the exact
-- content rightsholder set derived from that provenance, and the manifest-bound
-- human approvals.
--
-- It creates NO writer. Every primitive is migration 0093.
--
-- ===========================================================================
-- Why the public payload and the source provenance are different relations
-- ===========================================================================
--
-- A Public Experience stores a BOUNDED PUBLIC DERIVATIVE, not a live pointer
-- into its source (CW2-01 section 28 / A19, CW2-04 section 5 / D6). Publication
-- never creates navigation or access back into a source World, a source Session,
-- omitted material, adjacent private analysis or future source updates.
--
-- So the split is physical, not conventional:
--
--   publication_package_manifest_items        what the PUBLIC package contains
--   public_experience_text_derivative_bodies  the public bytes themselves
--   publication_package_item_provenance       SEALED: which exact private source
--
-- The item relation carries no source identifier of any kind - not a Session,
-- not a turn, not a conversational unit, not a Shared World, not a Shared
-- material, not a history item. It carries the public body and the public
-- classification. The provenance relation carries the exact source and is sealed
-- against every application role; the ONE review resolver in 0093 never returns
-- a column from it. That is provenance truth without provenance disclosure
-- (CW2-01 section 23 / A16, CW2-02 section 24 / B17, CW2-04 section 32).
--
-- The derivative is a SNAPSHOT. The public body row holds its own bytes, so a
-- later source change cannot rewrite it, and there is no trigger, view, rule or
-- foreign key through which a source edit could reach it.
--
-- ===========================================================================
-- Experience control is not content rights
-- ===========================================================================
--
--   EXPERIENCE_CONTROL_AUTHORITY  public.public_experience_controllers  (0091)
--   CONTENT_RIGHTSHOLDER_SET      public.publication_manifest_required_approvers
--
-- Two relations, no foreign key between them, in either direction (CW2-04
-- section 7 / D8, freeze review F1). Approving the inclusion of your own
-- material never inserts a controller row, and holding a controller row never
-- substitutes for a missing content approval.
--
-- `publication_manifest_approvals` binds its approver into the DERIVED required
-- set by composite foreign key, exactly as the frozen I-04F history package
-- does: it is structurally impossible to record an approval by a human the exact
-- manifest does not require, however the row is produced. No caller supplies an
-- approver.
--
-- ===========================================================================
-- Unresolved source authority cannot be IN a package
-- ===========================================================================
--
-- I-04G records, per committed Shared material, which of three the historical
-- sharing authority actually is:
--
--   RESOLVED_EXACT_HUMAN_REQUIREMENT
--   RESOLVED_NO_HUMAN_REQUIREMENT
--   UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT
--
-- Public World must not reinterpret the third as zero approvers. It does not:
-- `publication_package_item_authority` admits only the two RESOLVED states, so
-- an item whose source authority is unresolved is UNREPRESENTABLE inside a
-- package rather than merely refused by a procedure. Migration 0093's
-- preparation consults the source-side state and fails the whole preparation
-- closed.
--
-- The unresolved state is deliberately NOT re-represented here. It is a property
-- of the SOURCE, it already has exactly one canonical home in
-- `shared_world_material_historical_authority`, and a second copy in the Public
-- domain could drift from it. The representation stays additive: a later
-- reviewed protected-human subject-authority resolver moves the SOURCE row
-- forward to RESOLVED and the same material becomes packageable, with no change
-- to this migration and no source history rewritten.
--
-- ===========================================================================
-- Reserved public body kinds, and why no producer exists for them
-- ===========================================================================
--
-- `public_body_form` admits PUBLIC_TEXT, PUBLIC_VOICE and RESERVED. Only
-- PUBLIC_TEXT has a body relation and only PUBLIC_TEXT has a producer.
--
-- PUBLIC_VOICE is structurally reserved because a public voice derivative needs
-- a reviewed PUBLIC media boundary that mints a public object reference, and no
-- such boundary exists in this repository. There is no durable Personal voice or
-- call source at all: `conversation_units.source_modality` is CHECK-pinned to
-- TEXT and no audio object exists anywhere in the Personal schema. A Shared
-- HUMAN_VOICE_NOTE does have a durable `audio_object_ref`, but that reference is
-- an opaque SERVER-SIDE object handle that I-04G explicitly left for a future
-- reviewed media boundary to resolve - copying it into a public-serving row
-- would put a hidden source identifier in the public payload and turn the
-- derivative into a live pointer into private storage. Inventing a public media
-- provider instead would be engineering inventing missing Product logic
-- (AGENTS.md section 2). So the kind is reserved and reported, not faked.
--
-- RESERVED is the form of a source class that has no producer at all, which is
-- REPLAY_ARTIFACT: no Replay runtime exists, and I-05A fabricates none.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- No writer, no semantic interpretation, placement, coordinate, embedding,
-- ranking, vitality, search, lens or panel; no public serving surface; no
-- discussion, reply or thread; no Replay producer; no media storage provider,
-- upload path or storage credential; no moderation, report, block, entitlement,
-- feature flag or Launch Gate; no route, controller, RPC or mobile surface.
--
-- It alters exactly one predecessor table and only to add one foreign key to a
-- relation this same slice created in 0091. Migrations 0001-0090 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE IMMUTABLE PUBLICATION PACKAGE MANIFEST VERSION.
--
--    One manifest is one exact authorized public payload for one exact
--    Experience, prepared by one exact publisher, targeting the one Public World
--    and the Public World audience (CW2-02 section 37 / B26, CW2-04 section 4 /
--    D5). Changing any protected part of the payload produces a NEW manifest and
--    a new current authority evaluation; old approvals never float to it,
--    because an approval binds a manifest id by foreign key.
--
--    `authority_readiness` is pinned to exactly one value. I-05A proves PRIVACY
--    and OWNERSHIP readiness and NOTHING else: System / Safety policy, the
--    Launch Gate and commercial entitlement are NOT evaluated here and belong to
--    CW2-08. The self-assertion at the end refuses to deploy this migration if
--    any relation it creates ever grows a column that could assert otherwise.
--
--    `prepared_authority_snapshot_version` is the Public World authority
--    snapshot this package was prepared against. It is historical truth. The
--    authority request fingerprint that migration 0093 derives uses the CURRENT
--    snapshot, so a later reviewed change to the Public World envelope stales an
--    in-flight package instead of silently applying to it.
--
--    There is deliberately no manifest JSON blob, no generic payload column and
--    no free-text public metadata field: the protected public metadata of a
--    package is its publisher's stable public identity and its exact ordered
--    item set, both of which are structural here.
-- ---------------------------------------------------------------------------
CREATE TABLE public.publication_package_manifest_versions (
    id uuid NOT NULL,
    experience_id uuid NOT NULL,
    public_world_singleton boolean NOT NULL,
    publisher_public_identity_ref uuid NOT NULL,
    publisher_user_id uuid NOT NULL,
    intended_publication_action text NOT NULL,
    target_audience_class text NOT NULL,
    authority_readiness text NOT NULL,
    prepared_authority_snapshot_version bigint NOT NULL,
    item_count integer NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT publication_package_manifest_versions_pk PRIMARY KEY (id),
    -- Lets an item, a provenance row and an Experience Version all bind
    -- (manifest, Experience) in one constraint rather than re-deciding it.
    CONSTRAINT publication_package_manifest_versions_exp_key UNIQUE (id, experience_id),
    CONSTRAINT publication_package_manifest_versions_pub_key UNIQUE (id, publisher_user_id),
    CONSTRAINT publication_package_manifest_versions_world_check CHECK (public_world_singleton),
    -- THE PROTECTED ACTION THE RIGHTSHOLDERS ARE CONSENTING TO, which is the
    -- frozen audience-expansion action `PUBLISH_TO_PUBLIC_WORLD` and nothing
    -- else. It is NOT the command being executed now: preparing a package is a
    -- command in its own durable namespace and is explicitly NOT audience
    -- expansion, so `PREPARE_PUBLICATION` is not a value this column may hold.
    --
    -- This matters because a frozen authority decision is request-bound and an
    -- approval of one action may not be replayed for another (CW2-02 section 7 /
    -- B6). An approval collected against a preparation command could not lawfully
    -- be used by I-05B to execute publication; an approval bound to
    -- PUBLISH_TO_PUBLIC_WORLD can, once I-05B revalidates the manifest, the
    -- effective approval state and the Safety / Launch / entitlement gates that
    -- I-05A evaluates none of.
    CONSTRAINT publication_package_manifest_versions_action_check
        CHECK (intended_publication_action = 'PUBLISH_TO_PUBLIC_WORLD'),
    CONSTRAINT publication_package_manifest_versions_aud_check
        CHECK (target_audience_class = 'PUBLIC_WORLD_AUDIENCE'),
    -- PRIVACY / OWNERSHIP only. Never Safety, never Launch, never entitlement.
    CONSTRAINT publication_package_manifest_versions_ready_check
        CHECK (authority_readiness = 'PRIVACY_OWNERSHIP_AUTHORITY_ONLY'),
    CONSTRAINT publication_package_manifest_versions_snap_check
        CHECK (prepared_authority_snapshot_version > 0),
    -- A package is never empty.
    CONSTRAINT publication_package_manifest_versions_count_check CHECK (item_count > 0),
    CONSTRAINT publication_package_manifest_versions_world_fk
        FOREIGN KEY (public_world_singleton)
        REFERENCES public.public_world_state (singleton) ON DELETE RESTRICT,
    CONSTRAINT publication_package_manifest_versions_exp_fk
        FOREIGN KEY (experience_id) REFERENCES public.public_experiences (id) ON DELETE RESTRICT,
    -- The publisher's public ref and account are bound together by the identity
    -- relation, so a manifest can never attribute one human's public identity to
    -- another human's account.
    CONSTRAINT publication_package_manifest_versions_pub_fk
        FOREIGN KEY (publisher_public_identity_ref, publisher_user_id)
        REFERENCES public.public_identities (public_identity_ref, user_id) ON DELETE RESTRICT
);

CREATE INDEX publication_package_manifest_versions_exp_idx
    ON public.publication_package_manifest_versions (experience_id, created_at);

COMMENT ON TABLE public.publication_package_manifest_versions IS
  'One immutable PUBLICATION_PACKAGE_MANIFEST_VERSION: the exact authorized '
  'public payload of one Experience, for the one Public World audience. '
  'authority_readiness is PRIVACY_OWNERSHIP_AUTHORITY_ONLY: System / Safety, the '
  'Launch Gate and commercial entitlement are NOT evaluated by I-05A and belong '
  'to CW2-08. No column here may ever assert otherwise.';

-- The bijective binding between a manifest and the Experience Version it
-- produces, added now that both relations exist. UNIQUE
-- (package_manifest_version_id) on the version side is "one manifest produces at
-- most one version"; this composite key is "and both describe the same
-- Experience".
ALTER TABLE public.public_experience_versions
    ADD CONSTRAINT public_experience_versions_manifest_fk
        FOREIGN KEY (package_manifest_version_id, experience_id)
        REFERENCES public.publication_package_manifest_versions (id, experience_id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 2. THE EXACT ITEM SET OF ONE MANIFEST - THE PUBLIC HALF.
--
--    Normalized rows, never a JSON item blob. Every column here is either the
--    package's own structure or PUBLIC meaning:
--
--      item_ordinal                deterministic package order
--      derivative_classification   whether the public payload reproduces human
--                                  source content or is QANDEEL analysis
--                                  (CW2-02 section 27 / B20, CW2-04 section 31)
--      public_body_form            which public body relation carries the bytes
--      public_body_digest          the identity of those exact public bytes
--
--    There is NO source identifier of any kind in this relation. The exact
--    private source lives in section 4 and is sealed.
-- ---------------------------------------------------------------------------
CREATE TABLE public.publication_package_manifest_items (
    manifest_version_id uuid NOT NULL,
    experience_id uuid NOT NULL,
    package_item_id uuid NOT NULL,
    item_ordinal integer NOT NULL,
    derivative_classification text NOT NULL,
    public_body_form text NOT NULL,
    public_body_digest text NOT NULL,
    CONSTRAINT publication_package_manifest_items_pk
        PRIMARY KEY (manifest_version_id, package_item_id),
    -- A package item identity belongs to exactly one manifest, forever.
    CONSTRAINT publication_package_manifest_items_item_key UNIQUE (package_item_id),
    -- THE KIND-TO-BODY BINDING, made structural: a body relation pins its own
    -- form and binds BOTH columns back to here.
    CONSTRAINT publication_package_manifest_items_form_key UNIQUE (package_item_id, public_body_form),
    CONSTRAINT publication_package_manifest_items_order_key UNIQUE (manifest_version_id, item_ordinal),
    CONSTRAINT publication_package_manifest_items_order_check CHECK (item_ordinal >= 1),
    -- The frozen derivative classes (CW2-02 section 27, CW2-04 section 31).
    CONSTRAINT publication_package_manifest_items_class_check
        CHECK (derivative_classification IN ('SOURCE_CONTENT_BEARING_DERIVATIVE', 'ANALYTICAL_DERIVATIVE')),
    CONSTRAINT publication_package_manifest_items_form_check
        CHECK (public_body_form IN ('PUBLIC_TEXT', 'PUBLIC_VOICE', 'RESERVED')),
    CONSTRAINT publication_package_manifest_items_digest_check
        CHECK (public_body_digest ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT publication_package_manifest_items_manifest_fk
        FOREIGN KEY (manifest_version_id, experience_id)
        REFERENCES public.publication_package_manifest_versions (id, experience_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.publication_package_manifest_items IS
  'The exact item set of one immutable publication package - the PUBLIC half. '
  'It carries no source identifier of any kind: no Session, turn, conversational '
  'unit, Shared World, Shared material or history item. The exact private source '
  'is publication_package_item_provenance and is sealed.';

-- ---------------------------------------------------------------------------
-- 3. THE BOUNDED PUBLIC TEXT DERIVATIVE.
--
--    The public bytes themselves, in their own relation so that the package item
--    can exist as non-content structure independently of the body - the same
--    reason migration 0089 keeps Shared bodies out of the envelope.
--
--    This is a SNAPSHOT: it holds its own bytes. No foreign key, trigger, rule
--    or view connects it to a source, so no future source update can rewrite it.
--
--    There is no maximum length, because no frozen contract states a Product
--    copy limit and inventing one here would be inventing Product law.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_experience_text_derivative_bodies (
    package_item_id uuid NOT NULL,
    public_body_form text NOT NULL,
    public_text_body text NOT NULL,
    CONSTRAINT public_experience_text_derivative_bodies_pk PRIMARY KEY (package_item_id),
    CONSTRAINT public_experience_text_derivative_bodies_form_check
        CHECK (public_body_form = 'PUBLIC_TEXT'),
    CONSTRAINT public_experience_text_derivative_bodies_body_check
        CHECK (length(btrim(public_text_body)) > 0),
    CONSTRAINT public_experience_text_derivative_bodies_item_fk
        FOREIGN KEY (package_item_id, public_body_form)
        REFERENCES public.publication_package_manifest_items (package_item_id, public_body_form)
        ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 4. SEALED INTERNAL SOURCE PROVENANCE.
--
--    The exact private source of one package item, and the exact source state
--    captured when the derivative was snapshotted. It is internal truth: it is
--    never returned by any resolver, and no application role can read it.
--
--    The three frozen source classes are kept apart by one exact-shape CHECK, so
--    a Personal row cannot carry Shared identifiers and a Shared row cannot
--    carry Personal ones:
--
--      MY_WORLD         the exact committed conversational unit and its owner
--      SHARED_WORLD     the exact Shared material, its history item, its World,
--                       and the exact availability revision captured at snapshot
--      REPLAY_ARTIFACT  RESERVED. No Replay runtime exists, so there is no
--                       identifier to bind and I-05A fabricates none.
--
--    The Shared foreign keys deliberately reference `shared_world_materials` and
--    `shared_world_history_items`, which survive owner deletion as non-content
--    history, and NEVER a Shared body relation, which owner deletion physically
--    removes. A public package can therefore never keep a Shared body alive, and
--    RESTRICT can never block a human from deleting their own material.
--
--    The Personal foreign key references `conversation_units`, the canonical
--    immutable committed Personal source. `personal_owner_user_id` is derived by
--    the preparation primitive from the locked source row itself and never from
--    a parameter, so it cannot disagree with the unit it names.
-- ---------------------------------------------------------------------------
CREATE TABLE public.publication_package_item_provenance (
    package_item_id uuid NOT NULL,
    manifest_version_id uuid NOT NULL,
    source_class text NOT NULL,
    personal_conversation_unit_id uuid,
    personal_owner_user_id uuid,
    shared_world_id uuid,
    shared_material_id uuid,
    shared_history_item_id uuid,
    captured_availability_state text NOT NULL,
    captured_availability_revision bigint,
    captured_source_digest text NOT NULL,
    CONSTRAINT publication_package_item_provenance_pk PRIMARY KEY (package_item_id),
    CONSTRAINT publication_package_item_provenance_class_check
        CHECK (source_class IN ('MY_WORLD', 'SHARED_WORLD', 'REPLAY_ARTIFACT')),
    -- The canonical availability vocabulary, in exact parity with the merged
    -- I-01A kernel CONTENT_AVAILABILITIES and the frozen I-04F history states.
    CONSTRAINT publication_package_item_provenance_avail_check
        CHECK (captured_availability_state IN ('AVAILABLE', 'DELETED_BY_OWNER', 'UNAVAILABLE')),
    CONSTRAINT publication_package_item_provenance_digest_check
        CHECK (captured_source_digest ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT publication_package_item_provenance_rev_check
        CHECK (captured_availability_revision IS NULL OR captured_availability_revision > 0),
    -- EXACTLY ONE SHAPE PER SOURCE CLASS.
    CONSTRAINT publication_package_item_provenance_shape_check CHECK (
        (source_class = 'MY_WORLD'
            AND personal_conversation_unit_id IS NOT NULL AND personal_owner_user_id IS NOT NULL
            AND shared_world_id IS NULL AND shared_material_id IS NULL AND shared_history_item_id IS NULL
            AND captured_availability_revision IS NULL)
     OR (source_class = 'SHARED_WORLD'
            AND shared_world_id IS NOT NULL AND shared_material_id IS NOT NULL
            AND shared_history_item_id IS NOT NULL AND captured_availability_revision IS NOT NULL
            AND personal_conversation_unit_id IS NULL AND personal_owner_user_id IS NULL)
     OR (source_class = 'REPLAY_ARTIFACT'
            AND personal_conversation_unit_id IS NULL AND personal_owner_user_id IS NULL
            AND shared_world_id IS NULL AND shared_material_id IS NULL
            AND shared_history_item_id IS NULL AND captured_availability_revision IS NULL)),
    CONSTRAINT publication_package_item_provenance_item_fk
        FOREIGN KEY (manifest_version_id, package_item_id)
        REFERENCES public.publication_package_manifest_items (manifest_version_id, package_item_id)
        ON DELETE RESTRICT,
    CONSTRAINT publication_package_item_provenance_unit_fk
        FOREIGN KEY (personal_conversation_unit_id)
        REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
    CONSTRAINT publication_package_item_provenance_owner_fk
        FOREIGN KEY (personal_owner_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT publication_package_item_provenance_material_fk
        FOREIGN KEY (shared_material_id, shared_world_id)
        REFERENCES public.shared_world_materials (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT publication_package_item_provenance_history_fk
        FOREIGN KEY (shared_world_id, shared_history_item_id)
        REFERENCES public.shared_world_history_items (world_id, id) ON DELETE RESTRICT
);

CREATE INDEX publication_package_item_provenance_manifest_idx
    ON public.publication_package_item_provenance (manifest_version_id);

COMMENT ON TABLE public.publication_package_item_provenance IS
  'SEALED internal provenance: the exact private source of one package item and '
  'the exact source state captured at snapshot. Provenance truth is not '
  'provenance disclosure (CW2-01 A16, CW2-02 B17): no resolver returns a column '
  'from this relation and no application role may read it. It grants no source '
  'access and creates no navigation back into a source World or Session.';

-- ---------------------------------------------------------------------------
-- 5. THE PER-ITEM CONTENT AUTHORITY RESOLUTION.
--
--    Why this admits only the two RESOLVED states is the whole point: an item
--    whose exact protected-human authority is NOT resolvable must never be
--    inside a publication package at all, so the unresolved case is
--    UNREPRESENTABLE here rather than refused by a procedure that could later be
--    bypassed. Migration 0093 consults the SOURCE-side state - I-04G's
--    `shared_world_material_historical_authority` for Shared material, and the
--    absence of any reviewed protected-human subject-authority producer for
--    Personal QANDEEL analysis - and fails the whole preparation closed.
--
--    This is NOT reinterpreting unresolved as zero approvers. "We cannot compute
--    the requirement" and "we computed it and there is none" stay different
--    facts: the second is RESOLVED_NO_HUMAN_REQUIREMENT and is written ONLY when
--    the source state explicitly proves it, and the first cannot enter a package.
-- ---------------------------------------------------------------------------
CREATE TABLE public.publication_package_item_authority (
    package_item_id uuid NOT NULL,
    manifest_version_id uuid NOT NULL,
    resolution_state text NOT NULL,
    required_approver_count integer NOT NULL,
    CONSTRAINT publication_package_item_authority_pk PRIMARY KEY (package_item_id),
    CONSTRAINT publication_package_item_authority_state_check
        CHECK (resolution_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT', 'RESOLVED_NO_HUMAN_REQUIREMENT')),
    -- The state and the count agree in BOTH directions, so an exact requirement
    -- can never be recorded as empty and an empty one can never masquerade as
    -- exact.
    CONSTRAINT publication_package_item_authority_count_check
        CHECK ((resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT' AND required_approver_count > 0)
            OR (resolution_state = 'RESOLVED_NO_HUMAN_REQUIREMENT' AND required_approver_count = 0)),
    CONSTRAINT publication_package_item_authority_item_fk
        FOREIGN KEY (manifest_version_id, package_item_id)
        REFERENCES public.publication_package_manifest_items (manifest_version_id, package_item_id)
        ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 6. THE DERIVED CONTENT RIGHTSHOLDER SET OF ONE MANIFEST.
--
--    The exact UNION of the human material authorities of the exact included
--    protected material, and nothing else (CW2-02 section 38 / B27, CW2-04
--    section 6 / D7). Never World membership. Never the current Shared audience.
--    Never a caller-supplied list. Migration 0093's preparation derives it
--    internally and has no approver parameter of any kind.
--
--    Membership alone creates no ownership, no veto and no approval requirement
--    for unincluded material: a human appears here only because material whose
--    authority is theirs is actually IN this package.
-- ---------------------------------------------------------------------------
CREATE TABLE public.publication_manifest_required_approvers (
    manifest_version_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    CONSTRAINT publication_manifest_required_approvers_pk
        PRIMARY KEY (manifest_version_id, approver_user_id),
    CONSTRAINT publication_manifest_required_approvers_manifest_fk
        FOREIGN KEY (manifest_version_id)
        REFERENCES public.publication_package_manifest_versions (id) ON DELETE RESTRICT,
    CONSTRAINT publication_manifest_required_approvers_user_fk
        FOREIGN KEY (approver_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.publication_manifest_required_approvers IS
  'The CONTENT_RIGHTSHOLDER_SET of one exact manifest: the exact union of the '
  'human material authorities of the exact included protected material. It is a '
  'DIFFERENT authority from public_experience_controllers and there is no '
  'foreign key between them in either direction (CW2-04 D8).';

-- ---------------------------------------------------------------------------
-- 7. ONE EXACT HUMAN APPROVAL OF ONE EXACT MANIFEST.
--
--    The composite foreign key into the DERIVED required set is the binding law,
--    exactly as in the frozen I-04F history package: it is structurally
--    impossible to record an approval by a human this exact manifest does not
--    require, however the row is produced. UNIQUE (manifest, approver) is the
--    one-effective-approval rule.
--
--    `bound_authority_fingerprint` is what makes an approval bind the CURRENT
--    source authority and version state rather than merely a manifest id: it is
--    the authority request fingerprint as derived at the moment of approval, and
--    the READY_FOR_REVIEW commit requires every approval to still carry the
--    currently derived value. An approval therefore cannot survive a change to
--    the source authority, the required approver set or the Public World
--    authority snapshot - and it can never authorize a different package,
--    Experience, version, source or audience, because all of those are inside
--    the fingerprint.
--
--    An approval grants no Experience control. There is no foreign key from here
--    into public_experience_controllers and migration 0093's approval primitive
--    never writes that relation.
-- ---------------------------------------------------------------------------
CREATE TABLE public.publication_manifest_approvals (
    id uuid NOT NULL,
    manifest_version_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    bound_authority_fingerprint text NOT NULL,
    approved_at timestamptz NOT NULL,
    CONSTRAINT publication_manifest_approvals_pk PRIMARY KEY (id),
    CONSTRAINT publication_manifest_approvals_one_per_approver_key
        UNIQUE (manifest_version_id, approver_user_id),
    CONSTRAINT publication_manifest_approvals_fingerprint_check
        CHECK (bound_authority_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT publication_manifest_approvals_required_fk
        FOREIGN KEY (manifest_version_id, approver_user_id)
        REFERENCES public.publication_manifest_required_approvers
                   (manifest_version_id, approver_user_id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 8. IMMUTABILITY OF THE WHOLE PACKAGE.
--
--    A manifest, its items, its public bodies, its provenance, its per-item
--    authority, its required approver set and its approvals are all historical
--    truth. A BEFORE trigger rather than privileges alone, because privileges do
--    not bind the table owner.
--
--    This is not a forward ceiling: a changed payload produces a NEW manifest
--    with new rows, which is precisely what CW2-04 section 4 requires and what
--    I-05B's material-update path does.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_publication_package_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'PUBLICATION_PACKAGE_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A publication package manifest, its items, its public bodies, its provenance, its authority resolution, its required approver set and its approvals are append-only: UPDATE and DELETE are refused for every role, including the table owner. A changed payload is a NEW manifest.';
END$$;

ALTER FUNCTION public.reject_publication_package_mutation_v1() OWNER TO postgres;

CREATE TRIGGER publication_package_manifest_versions_immutable
    BEFORE UPDATE OR DELETE ON public.publication_package_manifest_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_publication_package_mutation_v1();
CREATE TRIGGER publication_package_manifest_items_immutable
    BEFORE UPDATE OR DELETE ON public.publication_package_manifest_items
    FOR EACH ROW EXECUTE FUNCTION public.reject_publication_package_mutation_v1();
CREATE TRIGGER public_experience_text_derivative_bodies_immutable
    BEFORE UPDATE OR DELETE ON public.public_experience_text_derivative_bodies
    FOR EACH ROW EXECUTE FUNCTION public.reject_publication_package_mutation_v1();
CREATE TRIGGER publication_package_item_provenance_immutable
    BEFORE UPDATE OR DELETE ON public.publication_package_item_provenance
    FOR EACH ROW EXECUTE FUNCTION public.reject_publication_package_mutation_v1();
CREATE TRIGGER publication_package_item_authority_immutable
    BEFORE UPDATE OR DELETE ON public.publication_package_item_authority
    FOR EACH ROW EXECUTE FUNCTION public.reject_publication_package_mutation_v1();
CREATE TRIGGER publication_manifest_required_approvers_immutable
    BEFORE UPDATE OR DELETE ON public.publication_manifest_required_approvers
    FOR EACH ROW EXECUTE FUNCTION public.reject_publication_package_mutation_v1();
CREATE TRIGGER publication_manifest_approvals_immutable
    BEFORE UPDATE OR DELETE ON public.publication_manifest_approvals
    FOR EACH ROW EXECUTE FUNCTION public.reject_publication_package_mutation_v1();

-- ---------------------------------------------------------------------------
-- 9. DENY-BY-DEFAULT POSTURE.
-- ---------------------------------------------------------------------------
ALTER TABLE public.publication_package_manifest_versions OWNER TO postgres;
ALTER TABLE public.publication_package_manifest_items OWNER TO postgres;
ALTER TABLE public.public_experience_text_derivative_bodies OWNER TO postgres;
ALTER TABLE public.publication_package_item_provenance OWNER TO postgres;
ALTER TABLE public.publication_package_item_authority OWNER TO postgres;
ALTER TABLE public.publication_manifest_required_approvers OWNER TO postgres;
ALTER TABLE public.publication_manifest_approvals OWNER TO postgres;

ALTER TABLE public.publication_package_manifest_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_package_manifest_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_experience_text_derivative_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_package_item_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_package_item_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_manifest_required_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_manifest_approvals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.publication_package_manifest_versions,
                    public.publication_package_manifest_items,
                    public.public_experience_text_derivative_bodies,
                    public.publication_package_item_provenance,
                    public.publication_package_item_authority,
                    public.publication_manifest_required_approvers,
                    public.publication_manifest_approvals
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.publication_package_manifest_versions, public.publication_package_manifest_items, public.public_experience_text_derivative_bodies, public.publication_package_item_provenance, public.publication_package_item_authority, public.publication_manifest_required_approvers, public.publication_manifest_approvals FROM service_role';
END IF;END$$;

REVOKE ALL ON FUNCTION public.reject_publication_package_mutation_v1() FROM PUBLIC;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_publication_package_mutation_v1() FROM anon, authenticated, service_role';
ELSE
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_publication_package_mutation_v1() FROM anon, authenticated';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 10. SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_tables text[] := ARRAY['publication_package_manifest_versions', 'publication_package_manifest_items',
                             'public_experience_text_derivative_bodies', 'publication_package_item_provenance',
                             'publication_package_item_authority', 'publication_manifest_required_approvers',
                             'publication_manifest_approvals'];
  public_tables text[] := ARRAY['publication_package_manifest_items', 'public_experience_text_derivative_bodies'];
  t text;
  banned text;
BEGIN
  -- NO SOURCE IDENTIFIER MAY APPEAR IN A PUBLIC-SERVING RELATION. This is the
  -- source-isolation law made structural: a public package item and a public
  -- body carry the payload, never a route back to where it came from.
  FOREACH t IN ARRAY public_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(session|turn|conversation_unit|world_id|shared_|material_id|history_item|source_id|owner_user|audio_object|transcript|context_ref)'
    ) THEN
      RAISE EXCEPTION 'I-05A: public-serving relation % may carry no source identifier', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid NOT IN ('public.publication_package_manifest_versions'::regclass,
                                 'public.publication_package_manifest_items'::regclass)
    ) THEN
      RAISE EXCEPTION 'I-05A: public-serving relation % may reference nothing outside its own package', t;
    END IF;
  END LOOP;

  -- THE SEALED PROVENANCE BINDS THE EXACT SOURCE, and it binds Shared identity
  -- to relations that SURVIVE owner deletion - never to a body relation that
  -- owner deletion physically removes, which would let a public package block a
  -- human from deleting their own material.
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.publication_package_item_provenance'::regclass
       AND c.contype = 'f'
       AND c.confrelid IN ('public.shared_world_text_material_bodies'::regclass,
                           'public.shared_world_voice_note_material_bodies'::regclass)
  ) THEN
    RAISE EXCEPTION 'I-05A: provenance must never reference a Shared body relation owner deletion destroys';
  END IF;
  FOR banned IN SELECT unnest(ARRAY['publication_package_item_provenance_unit_fk',
                                    'publication_package_item_provenance_material_fk',
                                    'publication_package_item_provenance_history_fk']) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = 'public.publication_package_item_provenance'::regclass
         AND c.conname = banned AND c.confdeltype = 'r'
    ) THEN
      RAISE EXCEPTION 'I-05A: provenance must bind its exact source by restrictive foreign key: % is missing', banned;
    END IF;
  END LOOP;

  -- UNRESOLVED SOURCE AUTHORITY IS UNREPRESENTABLE INSIDE A PACKAGE.
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.publication_package_item_authority'::regclass
       AND c.conname = 'publication_package_item_authority_state_check'
       AND pg_get_constraintdef(c.oid) ~ 'UNRESOLVED'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.publication_package_item_authority'::regclass
       AND c.conname = 'publication_package_item_authority_state_check'
  ) THEN
    RAISE EXCEPTION 'I-05A: an item with unresolved source authority must be unrepresentable inside a package';
  END IF;
  -- And the frozen I-04G source-side state this depends on must still exist.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c WHERE c.oid = 'public.shared_world_material_historical_authority'::regclass
  ) THEN
    RAISE EXCEPTION 'I-05A: the frozen I-04G source historical-authority state must exist';
  END IF;

  -- AN APPROVAL IS STRUCTURALLY IMPOSSIBLE OUTSIDE THE DERIVED REQUIRED SET, and
  -- it grants no Experience control.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.publication_manifest_approvals'::regclass
       AND c.conname = 'publication_manifest_approvals_required_fk'
       AND c.confrelid = 'public.publication_manifest_required_approvers'::regclass
       AND c.confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'I-05A: an approval must bind the DERIVED required approver set by composite foreign key';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE (c.conrelid = 'public.publication_manifest_approvals'::regclass
             AND c.confrelid = 'public.public_experience_controllers'::regclass)
        OR (c.conrelid = 'public.public_experience_controllers'::regclass
             AND c.confrelid IN ('public.publication_manifest_approvals'::regclass,
                                 'public.publication_manifest_required_approvers'::regclass))
  ) THEN
    RAISE EXCEPTION 'I-05A: Experience control and content rights must not reference each other';
  END IF;

  -- A MANIFEST PRODUCES AT MOST ONE EXPERIENCE VERSION, AND BOTH DESCRIBE THE
  -- SAME EXPERIENCE.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.public_experience_versions'::regclass
       AND c.conname = 'public_experience_versions_manifest_fk'
       AND c.confrelid = 'public.publication_package_manifest_versions'::regclass
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.public_experience_versions'::regclass
       AND c.conname = 'public_experience_versions_manifest_key' AND c.contype = 'u'
  ) THEN
    RAISE EXCEPTION 'I-05A: a manifest and its Experience Version must be bijective and same-Experience';
  END IF;

  -- I-05A PROVES PRIVACY AND OWNERSHIP READINESS ONLY. No relation created here
  -- may carry a Safety, Launch Gate or entitlement decision of any kind.
  FOREACH t IN ARRAY own_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(safety|moderation|launch|entitlement|premium|feature_flag|allow)'
    ) THEN
      RAISE EXCEPTION 'I-05A: relation % may carry no Safety Launch or entitlement decision', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(semantic|placement|coordinate|embedding|vitality|ranking|reply|discussion|thread)'
    ) THEN
      RAISE EXCEPTION 'I-05A: relation % may carry no semantic placement or discussion column', t;
    END IF;
  END LOOP;

  -- PART B CREATES NO WRITER. Every primitive is migration 0093, and the ONE
  -- function this migration owns returns `trigger`.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public'
       AND p.proname = 'reject_publication_package_mutation_v1'
       AND p.prorettype = 'trigger'::regtype
  ) THEN
    RAISE EXCEPTION 'I-05A: the ONE function PART B owns must be the append-only trigger function';
  END IF;

  -- EVERY RELATION IS IMMUTABLE AND DENY-BY-DEFAULT.
  FOREACH t IN ARRAY own_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
       WHERE tg.tgrelid = ('public.' || t)::regclass AND NOT tg.tgisinternal
         AND tg.tgfoid = 'public.reject_publication_package_mutation_v1'::regproc
    ) THEN
      RAISE EXCEPTION 'I-05A: relation % must be append-only for every role', t;
    END IF;
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-05A: relation % must have row level security enabled', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-05A: relation % must carry zero policies', t;
    END IF;
    IF (SELECT c.relowner FROM pg_class c WHERE c.oid = ('public.' || t)::regclass)
       <> (SELECT r.oid FROM pg_roles r WHERE r.rolname = 'postgres') THEN
      RAISE EXCEPTION 'I-05A: relation % must be postgres-owned', t;
    END IF;
    FOREACH banned IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN banned <> 'public'
                AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = banned);
      IF has_table_privilege(banned, ('public.' || t)::regclass, 'SELECT')
         OR has_table_privilege(banned, ('public.' || t)::regclass, 'INSERT')
         OR has_table_privilege(banned, ('public.' || t)::regclass, 'UPDATE')
         OR has_table_privilege(banned, ('public.' || t)::regclass, 'DELETE') THEN
        RAISE EXCEPTION 'I-05A: relation % must hold no privilege for %', t, banned;
      END IF;
    END LOOP;
  END LOOP;
END$$;

COMMIT;
