-- I-05A - Public World / Public Identity / Public Experience Foundation v1 (PART A).
--
-- This is the first Public World persistence in the repository. It creates the
-- ONE logical Public World, the stable Public Identity a public authorship binds
-- to, the mutable display label a public rendering later uses, the stable Public
-- Experience, its control authority, its immutable versions, and the append-only
-- lifecycle truth of those versions.
--
-- ===========================================================================
-- What a Public World IS here, and what it deliberately is NOT
-- ===========================================================================
--
-- `PUBLIC_WORLD` is ONE logical singleton semantic World (CW2-01 section 6,
-- CW2-04 section 1 / D1). It is not a feed, not a collection of user-owned
-- communities, and not a World instance per publisher. That is enforced
-- STRUCTURALLY rather than by convention: `public_world_state` is keyed on a
-- boolean that a CHECK pins to `true`, so the relation can hold exactly one row
-- and a second Public World is unrepresentable. Every Public object binds to the
-- World through that same boolean by foreign key, so "belongs to the one Public
-- World" is a constraint rather than an assertion.
--
-- There is deliberately no `public_world_id uuid`. The merged I-01A kernel
-- already says so: `PublicWorldRef` in
-- apps/api/src/connected-worlds/kernel/world.types.ts carries `architectureClass`
-- and `worldType` and NO identifier at all, because the singleton needs none. A
-- uuid here would be the first step towards a second one.
--
-- A `PUBLIC_EXPERIENCE` is an OBJECT inside this World, never a World (CW2-01
-- section 6 / A2, CW2-04 D2). It is not a row in `shared_worlds`, it carries no
-- `world_type`, no lifecycle vocabulary of the Shared World, no membership, no
-- phase and no governance.
--
-- ===========================================================================
-- Three identities that must never collapse into one
-- ===========================================================================
--
--   PUBLIC_EXPERIENCE            stable identity, survives every version
--   PUBLIC_EXPERIENCE_VERSION    immutable, one per prepared package
--   PUBLICATION_PACKAGE_MANIFEST immutable, migration 0092
--
-- (CW2-04 section 2 / D3.) Material change creates a new package and a new
-- version while the Experience identity is unchanged. Versions are protected by
-- an append-only trigger rather than by privilege alone, because privilege does
-- not bind the table owner.
--
-- ===========================================================================
-- Public Identity is stable; the display label is not
-- ===========================================================================
--
-- Public authorship binds internally to a stable opaque `public_identity_ref`;
-- public rendering later uses a mutable `PUBLIC_DISPLAY_LABEL` which may be a
-- pseudonym or a chosen real name (CW2-04 section 9 / D10, Freeze review F2).
--
-- The ref is NOT the private account identifier, and that is CHECKed rather than
-- documented: `public_identities_ref_not_account_check` refuses a row whose
-- public ref equals its own `user_id`. It is not a contact endpoint and not the
-- Shared invitation credential (D11): no relation here carries an email, a phone
-- number, an address or any credential column, and nothing in this migration
-- references `shared_world_invite_credential_state` at all - Public does not
-- depend on Shared identity, membership or credential state.
--
-- Display labels are deliberately NOT unique. Two humans may choose the same
-- pseudonym; a uniqueness constraint would invent a public namespace that no
-- frozen contract states. Historical alias-label rendering is explicitly
-- deferred (CW2-04 section 9), so there is no label history relation - only the
-- current state and a monotonic `label_revision`.
--
-- ===========================================================================
-- Lifecycle
-- ===========================================================================
--
--   DRAFT
--   READY_FOR_REVIEW
--   PUBLISHED                    forward-safe; NO I-05A path reaches it
--   ABSENT_FROM_PUBLIC_WORLD     forward-safe; NO I-05A path reaches it
--
-- The vocabulary is complete so that I-05B and I-05C are additive, but I-05A
-- creates no writer at all: every writer is migration 0093, and 0093 writes only
-- `DRAFT` and `READY_FOR_REVIEW`. Nothing here is a ceiling on the later
-- transitions - there is no trigger refusing `PUBLISHED`, because a guard that a
-- later authorized slice would have to remove is a ceiling on the roadmap rather
-- than an invariant of this one.
--
-- ===========================================================================
-- Public audience policy is a GATE, not World identity
-- ===========================================================================
--
-- `public_audience_policy_state` records the current viewing direction and the
-- unresolved signed-out policy (CW2-04 section 11 / D13, Freeze review F3,
-- CW2-08 sections 28 and 31). It is a separate singleton with NO foreign key to
-- or from the World, the Identity, the Experience or any version: changing who
-- may view Public World later must not redesign Experience identity. Migration
-- 0092 binds the authority request fingerprint to the World's authority snapshot
-- version and deliberately NOT to this policy, so a policy change cannot stale a
-- prepared package and a package cannot pin a viewing policy.
--
-- ===========================================================================
-- Security posture
-- ===========================================================================
--
-- Every relation is postgres-owned, RLS-enabled with zero policies, and revoked
-- from PUBLIC, anon, authenticated and service_role. This migration creates NO
-- function of any kind: it is persistence, and every primitive belongs to 0093.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- It creates no semantic placement, coordinate, embedding, vitality, ranking,
-- search, lens or panel state; no public discussion, reply or thread; no public
-- serving surface; no Replay producer; no moderation, report, block, entitlement,
-- feature flag or Launch Gate; no route, controller, RPC or mobile surface. It
-- alters no predecessor table, adds no column to one, installs no trigger on one
-- and writes to none. Migrations 0001-0090 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE ONE LOGICAL PUBLIC WORLD.
--
--    `singleton` is the primary key AND is CHECKed to be true, so exactly one
--    row is representable. `state_version` is the Public World's authority
--    snapshot version: every prepared publication package binds it, so a later
--    reviewed change to the Public World envelope stales in-flight packages
--    instead of silently applying to them.
--
--    There is no owner, no member relation, no semantic coordinate, no feed
--    ordering and no audience policy here.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_world_state (
    singleton boolean NOT NULL,
    world_type text NOT NULL,
    state_version bigint NOT NULL,
    established_at timestamptz NOT NULL,
    CONSTRAINT public_world_state_pk PRIMARY KEY (singleton),
    -- Exactly one logical row is REPRESENTABLE, not merely expected.
    CONSTRAINT public_world_state_singleton_check CHECK (singleton),
    -- The exact frozen World type, in parity with the merged I-01A kernel
    -- WORLD_TYPES. This relation can never describe MY_WORLD or SHARED_WORLD.
    CONSTRAINT public_world_state_type_check CHECK (world_type = 'PUBLIC_WORLD'),
    CONSTRAINT public_world_state_version_check CHECK (state_version > 0)
);

COMMENT ON TABLE public.public_world_state IS
  'The ONE logical PUBLIC_WORLD. Keyed on a boolean pinned true so a second '
  'Public World is unrepresentable. It carries no owner, no member list, no '
  'semantic coordinate, no feed ordering and no audience policy: viewing '
  'eligibility is PUBLIC_AUDIENCE_POLICY and is a separate gate (CW2-04 D13).';

INSERT INTO public.public_world_state (singleton, world_type, state_version, established_at)
VALUES (true, 'PUBLIC_WORLD', 1, CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------------------
-- 2. THE PUBLIC AUDIENCE POLICY GATE.
--
--    Separate from World identity on purpose (CW2-04 section 11 / D13). The
--    current Product direction is registered membership; signed-out viewing
--    remains an OPEN launch requirement (CW2-08 sections 31 and 44), so it is
--    recorded as UNRESOLVED and fails closed rather than being guessed.
--
--    No object in this schema has a foreign key to this relation, and nothing
--    in I-05A reads it to make an authority decision. It exists so the frozen
--    separation is a fact in the catalog rather than a sentence in a document.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_audience_policy_state (
    singleton boolean NOT NULL,
    registered_viewing_policy text NOT NULL,
    signed_out_viewing_policy text NOT NULL,
    policy_revision bigint NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT public_audience_policy_state_pk PRIMARY KEY (singleton),
    CONSTRAINT public_audience_policy_singleton_check CHECK (singleton),
    CONSTRAINT public_audience_policy_registered_check
        CHECK (registered_viewing_policy IN ('REGISTERED_ONLY', 'REGISTERED_AND_SIGNED_OUT')),
    -- The frozen CW2-08 SIGNED_OUT_PUBLIC_VIEW_POLICY launch requirement. A
    -- required UNKNOWN fails closed (CW2-08 H4 / section 40), so the only
    -- value I-05A writes is UNRESOLVED.
    CONSTRAINT public_audience_policy_signed_out_check
        CHECK (signed_out_viewing_policy IN ('UNRESOLVED', 'ALLOWED', 'DENIED')),
    CONSTRAINT public_audience_policy_revision_check CHECK (policy_revision > 0)
);

COMMENT ON TABLE public.public_audience_policy_state IS
  'PUBLIC_AUDIENCE_POLICY: who may currently view Public World. It is a GATE, '
  'never World or Experience identity (CW2-04 section 11 / D13, freeze review '
  'F3). Nothing references it by foreign key and no I-05A authority decision '
  'reads it, so changing signed-out eligibility later creates no new World and '
  'alters no Experience identity, version, manifest or fingerprint.';

INSERT INTO public.public_audience_policy_state
    (singleton, registered_viewing_policy, signed_out_viewing_policy, policy_revision, updated_at)
VALUES (true, 'REGISTERED_ONLY', 'UNRESOLVED', 1, CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------------------
-- 3. THE STABLE PUBLIC IDENTITY.
--
--    One stable Public Identity per human account in v1. The ref is opaque and
--    is structurally NOT the private account identifier.
--
--    There is no email, phone, address, handle, invite credential or any other
--    contact column here, and no foreign key into Shared invitation state:
--    public identity presentation is not contact authority (CW2-04 section 23 /
--    D11) and Public does not depend on Shared.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_identities (
    public_identity_ref uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT public_identities_pk PRIMARY KEY (public_identity_ref),
    -- One stable Public Identity per human in v1.
    CONSTRAINT public_identities_user_key UNIQUE (user_id),
    -- Lets every dependant bind the public ref and the human together, so a
    -- controller or a publisher can never name one human's public ref beside
    -- another human's account id.
    CONSTRAINT public_identities_ref_user_key UNIQUE (public_identity_ref, user_id),
    -- The opaque ref is not the private account identifier. Collapsing the two
    -- would publish the account id under another name.
    CONSTRAINT public_identities_ref_not_account_check CHECK (public_identity_ref <> user_id),
    CONSTRAINT public_identities_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

COMMENT ON COLUMN public.public_identities.public_identity_ref IS
  'The stable opaque PUBLIC_IDENTITY_REF public authorship binds to. It is not '
  'the private account identifier (CHECKed), not a contact endpoint and not the '
  'Shared invitation credential (CW2-04 section 9 / D10 / D11).';

-- ---------------------------------------------------------------------------
-- 4. THE MUTABLE PUBLIC DISPLAY STATE.
--
--    Exactly one current display state per Public Identity. Changing it is a
--    display change and nothing else: this relation has no foreign key to an
--    Experience, a version or a manifest, and migration 0093's label primitive
--    writes this row alone. An alias change therefore cannot create an
--    Experience version, mutate a package manifest, alter semantic meaning or
--    reserve semantic placement (CW2-04 section 10 / D12).
--
--    Labels are NOT unique: a uniqueness constraint would invent a public
--    namespace no frozen contract states.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_identity_display_state (
    public_identity_ref uuid NOT NULL,
    label_mode text NOT NULL,
    display_label text NOT NULL,
    label_revision bigint NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT public_identity_display_state_pk PRIMARY KEY (public_identity_ref),
    -- The two frozen label modes. Identity verification and KYC are explicitly
    -- not implemented: REAL_NAME means the human chose to display a real name,
    -- never that anything verified it.
    CONSTRAINT public_identity_display_mode_check
        CHECK (label_mode IN ('PSEUDONYM', 'REAL_NAME')),
    CONSTRAINT public_identity_display_label_check
        CHECK (length(btrim(display_label)) > 0 AND length(display_label) <= 64),
    CONSTRAINT public_identity_display_revision_check CHECK (label_revision > 0),
    CONSTRAINT public_identity_display_state_identity_fk
        FOREIGN KEY (public_identity_ref)
        REFERENCES public.public_identities (public_identity_ref) ON DELETE RESTRICT
);

COMMENT ON TABLE public.public_identity_display_state IS
  'The current mutable PUBLIC_DISPLAY_LABEL of one stable Public Identity. It '
  'has no foreign key to an Experience, a version or a manifest, so an alias '
  'change creates no version and mutates no package (CW2-04 section 10 / D12). '
  'Historical alias-label rendering is deferred, so there is no label history.';

-- ---------------------------------------------------------------------------
-- 5. THE STABLE PUBLIC EXPERIENCE.
--
--    An object inside the one Public World, bound to it by the singleton
--    boolean. Its identity is stable across every version; no source content
--    lives on this row.
--
--    `experience_revision` is the Experience's staleness token: migration 0093
--    bumps it on every mutation of this row, so a package prepared against one
--    revision cannot be committed after a newer preparation replaced it.
--
--    `current_experience_version_id` is the current version POINTER. It never
--    makes a historical version mutable: versions carry an append-only trigger
--    that refuses UPDATE and DELETE for every role including the owner.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_experiences (
    id uuid NOT NULL,
    public_world_singleton boolean NOT NULL,
    created_by_public_identity_ref uuid NOT NULL,
    current_lifecycle text NOT NULL,
    current_experience_version_id uuid,
    experience_revision bigint NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT public_experiences_pk PRIMARY KEY (id),
    -- Lets a version bind (version, experience) and a manifest bind
    -- (manifest, experience) without ever re-deciding which Experience is meant.
    CONSTRAINT public_experiences_creator_key UNIQUE (id, created_by_public_identity_ref),
    CONSTRAINT public_experiences_world_check CHECK (public_world_singleton),
    -- The complete frozen lifecycle vocabulary (CW2-04 section 3). PUBLISHED and
    -- ABSENT_FROM_PUBLIC_WORLD are representable so I-05B and I-05C are purely
    -- additive; NO I-05A writer produces either.
    CONSTRAINT public_experiences_lifecycle_check
        CHECK (current_lifecycle IN ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD')),
    CONSTRAINT public_experiences_revision_check CHECK (experience_revision > 0),
    -- Every Experience belongs to the ONE Public World, structurally.
    CONSTRAINT public_experiences_world_fk
        FOREIGN KEY (public_world_singleton)
        REFERENCES public.public_world_state (singleton) ON DELETE RESTRICT,
    CONSTRAINT public_experiences_creator_fk
        FOREIGN KEY (created_by_public_identity_ref)
        REFERENCES public.public_identities (public_identity_ref) ON DELETE RESTRICT
);

CREATE INDEX public_experiences_creator_idx
    ON public.public_experiences (created_by_public_identity_ref, created_at);

COMMENT ON TABLE public.public_experiences IS
  'A PUBLIC_EXPERIENCE: a bounded object inside the one Public World, never a '
  'World (CW2-01 A2, CW2-04 D2). Stable identity survives every version. No '
  'source content, no semantic coordinate, no vitality and no discussion lives '
  'here.';

-- ---------------------------------------------------------------------------
-- 6. EXPERIENCE CONTROL AUTHORITY.
--
--    EXPERIENCE_CONTROL_AUTHORITY governs the public container. It is a
--    DIFFERENT authority from the CONTENT_RIGHTSHOLDER_SET over included source
--    portions (CW2-04 section 7 / D8, freeze review F1), and the two are kept
--    apart by being different relations with no foreign key between them:
--    migration 0092's `publication_manifest_required_approvers` is the content
--    rightsholder set, and nothing in 0092 or 0093 ever inserts into this
--    relation from an approval.
--
--    I-05A gives control to the exact creating human at creation. The
--    representation is normalized - (experience, controller) rows, not an owner
--    column - so a later reviewed multi-controller or transfer semantics is
--    additive. I-05A invents neither.
--
--    `control_basis` is deliberately NOT a closed vocabulary: no frozen contract
--    enumerates control bases, so pinning one here would force a later reviewed
--    transfer to reopen this migration. I-05A's writer only ever produces
--    EXPERIENCE_CREATION, which its own static contract proves.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_experience_controllers (
    experience_id uuid NOT NULL,
    controller_public_identity_ref uuid NOT NULL,
    controller_user_id uuid NOT NULL,
    control_basis text NOT NULL,
    established_at timestamptz NOT NULL,
    CONSTRAINT public_experience_controllers_pk
        PRIMARY KEY (experience_id, controller_public_identity_ref),
    -- The human side of the same control row, for the auth.uid() checks every
    -- consequential primitive performs.
    CONSTRAINT public_experience_controllers_user_key UNIQUE (experience_id, controller_user_id),
    CONSTRAINT public_experience_controllers_basis_check
        CHECK (length(btrim(control_basis)) > 0 AND length(control_basis) <= 64),
    CONSTRAINT public_experience_controllers_experience_fk
        FOREIGN KEY (experience_id) REFERENCES public.public_experiences (id) ON DELETE RESTRICT,
    -- The public ref and the human account are bound together by the identity
    -- relation itself, so a controller row can never pair one human's public
    -- identity with another human's account.
    CONSTRAINT public_experience_controllers_identity_fk
        FOREIGN KEY (controller_public_identity_ref, controller_user_id)
        REFERENCES public.public_identities (public_identity_ref, user_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.public_experience_controllers IS
  'EXPERIENCE_CONTROL_AUTHORITY over the public container. It is NOT the '
  'CONTENT_RIGHTSHOLDER_SET (CW2-04 section 7 / D8): approving inclusion of '
  'your own material never inserts a row here, and holding a row here never '
  'substitutes for a missing content approval.';

-- ---------------------------------------------------------------------------
-- 7. THE IMMUTABLE PUBLIC EXPERIENCE VERSION.
--
--    One version per prepared publication package, in strict ordinal order
--    within its Experience. The version and its manifest are BIJECTIVE:
--    UNIQUE (package_manifest_version_id) is "one manifest produces at most one
--    version", and the composite foreign key migration 0092 adds binds the two
--    to the same Experience.
--
--    There are deliberately NO semantic coordinate, placement, embedding,
--    ranking or vitality columns: semantic interpretation binds to the exact
--    version and belongs to I-05B (CW2-04 sections 12 and 14 / D14 / D16).
--
--    There is no lifecycle column either. A version is immutable, and a mutable
--    lifecycle on an immutable row is a contradiction; the container's current
--    state lives on `public_experiences.current_lifecycle` and the append-only
--    transition truth lives in section 8 below.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_experience_versions (
    id uuid NOT NULL,
    experience_id uuid NOT NULL,
    package_manifest_version_id uuid NOT NULL,
    version_ordinal integer NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT public_experience_versions_pk PRIMARY KEY (id),
    -- One manifest produces at most one Experience Version.
    CONSTRAINT public_experience_versions_manifest_key UNIQUE (package_manifest_version_id),
    -- Deterministic predecessor relation within one stable Experience.
    CONSTRAINT public_experience_versions_ordinal_key UNIQUE (experience_id, version_ordinal),
    -- Lets a commit bind (version, experience) in one constraint.
    CONSTRAINT public_experience_versions_experience_key UNIQUE (id, experience_id),
    -- Lets migration 0092 bind (manifest, experience) to (version, experience).
    CONSTRAINT public_experience_versions_manifest_experience_key
        UNIQUE (package_manifest_version_id, experience_id),
    CONSTRAINT public_experience_versions_ordinal_check CHECK (version_ordinal >= 1),
    CONSTRAINT public_experience_versions_experience_fk
        FOREIGN KEY (experience_id) REFERENCES public.public_experiences (id) ON DELETE RESTRICT
);

CREATE INDEX public_experience_versions_experience_idx
    ON public.public_experience_versions (experience_id, version_ordinal);

-- The current version pointer, added after the version relation exists. It never
-- makes a historical version mutable: the trigger below refuses UPDATE and
-- DELETE on a version row for every role, the table owner included.
ALTER TABLE public.public_experiences
    ADD CONSTRAINT public_experiences_current_version_fk
        FOREIGN KEY (current_experience_version_id, id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 8. APPEND-ONLY EXPERIENCE LIFECYCLE TRUTH.
--
--    One row per committed lifecycle transition. `from_lifecycle` is NULL for
--    the birth of a DRAFT Experience, which has no predecessor state.
--    `experience_version_id` is NULL where the transition concerns no version -
--    again, birth - and is the exact version otherwise.
--
--    The CHECK admits the complete frozen vocabulary on BOTH sides so that I-05B
--    appends `READY_FOR_REVIEW -> PUBLISHED` and I-05C appends
--    `PUBLISHED -> ABSENT_FROM_PUBLIC_WORLD` with no change here. I-05A's own
--    writers produce only `-> DRAFT` and `DRAFT -> READY_FOR_REVIEW`, which its
--    static contract and its real-PostgreSQL verifier both prove.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_experience_lifecycle_events (
    id uuid NOT NULL,
    experience_id uuid NOT NULL,
    experience_version_id uuid,
    from_lifecycle text,
    to_lifecycle text NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT public_experience_lifecycle_events_pk PRIMARY KEY (id),
    CONSTRAINT public_experience_lifecycle_events_from_check
        CHECK (from_lifecycle IS NULL OR from_lifecycle IN
              ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD')),
    CONSTRAINT public_experience_lifecycle_events_to_check
        CHECK (to_lifecycle IN ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD')),
    CONSTRAINT public_experience_lifecycle_events_move_check
        CHECK (from_lifecycle IS NULL OR from_lifecycle <> to_lifecycle),
    -- Birth has no version; every other transition names one.
    CONSTRAINT public_experience_lifecycle_events_birth_check
        CHECK ((from_lifecycle IS NULL AND experience_version_id IS NULL AND to_lifecycle = 'DRAFT')
            OR (from_lifecycle IS NOT NULL AND experience_version_id IS NOT NULL)),
    CONSTRAINT public_experience_lifecycle_events_experience_fk
        FOREIGN KEY (experience_id) REFERENCES public.public_experiences (id) ON DELETE RESTRICT,
    CONSTRAINT public_experience_lifecycle_events_version_fk
        FOREIGN KEY (experience_version_id, experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT
);

CREATE INDEX public_experience_lifecycle_events_experience_idx
    ON public.public_experience_lifecycle_events (experience_id, occurred_at);

-- ---------------------------------------------------------------------------
-- 9. IMMUTABILITY OF VERSION AND LIFECYCLE TRUTH.
--
--    A BEFORE trigger rather than privileges alone, for the reason migration
--    0064 already established for committed conversational units: privileges do
--    not bind the table owner, and a future accidental GRANT would otherwise
--    reopen mutation. A version and a committed transition are historical truth.
--
--    This is NOT a forward ceiling. It refuses only UPDATE and DELETE of rows
--    this slice owns the meaning of; a later slice appends new versions and new
--    transitions freely, which is exactly what I-05B and I-05C do.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_public_experience_history_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'PUBLIC_EXPERIENCE_HISTORY_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A Public Experience Version and a committed lifecycle transition are append-only: UPDATE and DELETE are refused for every role, including the table owner.';
END$$;

ALTER FUNCTION public.reject_public_experience_history_mutation_v1() OWNER TO postgres;

CREATE TRIGGER public_experience_versions_immutable
    BEFORE UPDATE OR DELETE ON public.public_experience_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_public_experience_history_mutation_v1();

CREATE TRIGGER public_experience_lifecycle_events_immutable
    BEFORE UPDATE OR DELETE ON public.public_experience_lifecycle_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_public_experience_history_mutation_v1();

-- ---------------------------------------------------------------------------
-- 10. DENY-BY-DEFAULT POSTURE.
--
--     RLS on with zero policies, every application role revoked from every
--     privilege, every relation postgres-owned. There is no direct client read
--     path and no application read boundary in PART A at all: the one narrow
--     review resolver belongs to migration 0093, and no I-05A relation is ever
--     directly readable by an application role.
-- ---------------------------------------------------------------------------
ALTER TABLE public.public_world_state OWNER TO postgres;
ALTER TABLE public.public_audience_policy_state OWNER TO postgres;
ALTER TABLE public.public_identities OWNER TO postgres;
ALTER TABLE public.public_identity_display_state OWNER TO postgres;
ALTER TABLE public.public_experiences OWNER TO postgres;
ALTER TABLE public.public_experience_controllers OWNER TO postgres;
ALTER TABLE public.public_experience_versions OWNER TO postgres;
ALTER TABLE public.public_experience_lifecycle_events OWNER TO postgres;

ALTER TABLE public.public_world_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_audience_policy_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_identity_display_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_experience_controllers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_experience_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_experience_lifecycle_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.public_world_state,
                    public.public_audience_policy_state,
                    public.public_identities,
                    public.public_identity_display_state,
                    public.public_experiences,
                    public.public_experience_controllers,
                    public.public_experience_versions,
                    public.public_experience_lifecycle_events
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.public_world_state, public.public_audience_policy_state, public.public_identities, public.public_identity_display_state, public.public_experiences, public.public_experience_controllers, public.public_experience_versions, public.public_experience_lifecycle_events FROM service_role';
END IF;END$$;

-- The trigger function is internal. It is never invoked directly by anyone.
REVOKE ALL ON FUNCTION public.reject_public_experience_history_mutation_v1() FROM PUBLIC;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_public_experience_history_mutation_v1() FROM anon, authenticated, service_role';
ELSE
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_public_experience_history_mutation_v1() FROM anon, authenticated';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 11. SELF-ASSERTIONS.
--
--     What must already be true of THIS migration for it to be allowed to
--     deploy. Each is a fact about objects 0091 owns, never a census of the
--     database and never a ceiling on a later slice.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_tables text[] := ARRAY['public_world_state', 'public_audience_policy_state', 'public_identities',
                             'public_identity_display_state', 'public_experiences',
                             'public_experience_controllers', 'public_experience_versions',
                             'public_experience_lifecycle_events'];
  t text;
  banned text;
  n integer;
BEGIN
  -- EXACTLY ONE LOGICAL PUBLIC WORLD EXISTS, and a second is unrepresentable.
  SELECT count(*) INTO n FROM public.public_world_state;
  IF n <> 1 THEN
    RAISE EXCEPTION 'I-05A: exactly one logical Public World must exist; found %', n;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.public_world_state'::regclass
       AND c.conname = 'public_world_state_singleton_check'
  ) THEN
    RAISE EXCEPTION 'I-05A: a second Public World must be unrepresentable, not merely absent';
  END IF;
  SELECT count(*) INTO n FROM public.public_audience_policy_state;
  IF n <> 1 THEN
    RAISE EXCEPTION 'I-05A: exactly one Public audience policy envelope must exist; found %', n;
  END IF;

  -- THE SIGNED-OUT LAUNCH REQUIREMENT IS UNRESOLVED AND FAILS CLOSED. I-05A
  -- neither resolves it nor guesses it (CW2-08 sections 31 and 44).
  IF NOT EXISTS (SELECT 1 FROM public.public_audience_policy_state p
                  WHERE p.signed_out_viewing_policy = 'UNRESOLVED') THEN
    RAISE EXCEPTION 'I-05A: SIGNED_OUT_PUBLIC_VIEW_POLICY must remain UNRESOLVED';
  END IF;

  -- THE AUDIENCE POLICY IS A GATE, NOT IDENTITY: nothing may reference it.
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.contype = 'f'
       AND c.confrelid = 'public.public_audience_policy_state'::regclass
  ) THEN
    RAISE EXCEPTION 'I-05A: Public audience policy is a gate; no object may bind its identity to it';
  END IF;

  -- EVERY PUBLIC OBJECT BELONGS TO THE ONE PUBLIC WORLD, STRUCTURALLY.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.public_experiences'::regclass
       AND c.conname = 'public_experiences_world_fk'
       AND c.confrelid = 'public.public_world_state'::regclass
       AND c.confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'I-05A: a Public Experience must bind the ONE Public World by restrictive foreign key';
  END IF;

  -- A PUBLIC EXPERIENCE IS NOT A WORLD ROW. It must not carry a world type, a
  -- lifecycle of the Shared World, membership, a phase or governance.
  FOR banned IN SELECT unnest(ARRAY['world_type', 'phase', 'birth_basis', 'member_count',
                                    'membership_episode_id', 'world_id']) LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = 'public.public_experiences'::regclass
         AND a.attnum > 0 AND NOT a.attisdropped AND a.attname = banned
    ) THEN
      RAISE EXCEPTION 'I-05A: a Public Experience is an object, never a World: column % is refused', banned;
    END IF;
  END LOOP;

  -- THE PUBLIC IDENTITY REF IS NOT THE PRIVATE ACCOUNT IDENTIFIER, and no
  -- relation created here carries a contact endpoint or a credential.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.public_identities'::regclass
       AND c.conname = 'public_identities_ref_not_account_check'
  ) THEN
    RAISE EXCEPTION 'I-05A: the Public Identity ref must be structurally distinct from the account id';
  END IF;
  FOREACH t IN ARRAY own_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(email|phone|msisdn|address|contact|credential|invite|secret|token|password)'
    ) THEN
      RAISE EXCEPTION 'I-05A: Public identity is not contact authority: relation % may carry no contact or credential column', t;
    END IF;
  END LOOP;

  -- EXPERIENCE CONTROL AND CONTENT RIGHTS ARE DIFFERENT AUTHORITIES. The
  -- controller relation must not be reachable from an approval by foreign key.
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
     WHERE a.attrelid = 'public.public_experience_controllers'::regclass
       AND a.attnum > 0 AND NOT a.attisdropped
       AND a.attname ~ '(approv|manifest|rightsholder|package)'
  ) THEN
    RAISE EXCEPTION 'I-05A: Experience control must not be derived from a content approval';
  END IF;

  -- NO SEMANTIC PLACEMENT, VITALITY, RANKING, DISCUSSION OR SERVING STATE IS
  -- CREATED HERE. Those belong to I-05B and are bound to the exact version there.
  FOREACH t IN ARRAY own_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(semantic|placement|coordinate|embedding|vitality|ranking|reply|discussion|thread|visibility)'
    ) THEN
      RAISE EXCEPTION 'I-05A: relation % may carry no semantic placement serving or discussion column', t;
    END IF;
  END LOOP;

  -- A VERSION AND A COMMITTED TRANSITION ARE IMMUTABLE FOR EVERY ROLE.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
     WHERE tg.tgrelid = 'public.public_experience_versions'::regclass
       AND tg.tgname = 'public_experience_versions_immutable' AND NOT tg.tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
     WHERE tg.tgrelid = 'public.public_experience_lifecycle_events'::regclass
       AND tg.tgname = 'public_experience_lifecycle_events_immutable' AND NOT tg.tgisinternal
  ) THEN
    RAISE EXCEPTION 'I-05A: Experience versions and lifecycle transitions must be append-only';
  END IF;

  -- PART A CREATES NO CONSEQUENTIAL PRIMITIVE. The ONE function it owns is the
  -- append-only trigger above, and it returns `trigger` - so it is callable as
  -- nothing else. That 0091 created no other function is proven from 0091's own
  -- text by its static contract; asserting it from a catalog sweep here would be
  -- a census of the whole schema rather than a fact about this migration.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public'
       AND p.proname = 'reject_public_experience_history_mutation_v1'
       AND p.prorettype = 'trigger'::regtype
  ) THEN
    RAISE EXCEPTION 'I-05A: the ONE function PART A owns must be the append-only trigger function';
  END IF;

  -- DENY BY DEFAULT ON EVERY RELATION THIS MIGRATION CREATED.
  FOREACH t IN ARRAY own_tables LOOP
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
