-- I-07D - Introduction progressive disclosure and Introduction historical
-- visibility v1 (PART A).
--
-- I-07C committed the atomic Mutual Match and gave two humans one born
-- ACTIVE / INTRODUCTION Shared World, two open membership episodes, an ACTIVE
-- Introduction Record and two HELD claims. What neither of them can do inside
-- that World is the whole point of an Introduction: disclose something about
-- themselves to the other, on purpose, one exact resource at a time.
--
-- This migration owns that, and the historical visibility it needs. Migration
-- 0116 owns the terminal lifecycle and 0117 owns post-Introduction Matching
-- reactivation; the three ship, review and test together as one I-07D slice.
--
-- ===========================================================================
-- A SUGGESTION CREATES ZERO AUTHORITY (CW2-02 / CW2-06)
-- ===========================================================================
--
-- QANDEEL may suggest that a human disclose something. That suggestion is not
-- authority, is not stored here, and has no representation at all: there is no
-- dormant "suggested disclosure" object, no pending grant and no reusable
-- "share everything with this person" permission. The owner's explicit grant
-- and the protected delivery are ONE atomic act, which is what closes the
-- revocation-before-delivery race by design rather than by policy:
--
--   before the owner's exact grant:  nothing is delivered
--   after the atomic grant:          delivery is historical Shared truth
--
-- A later profile, permission or authority change therefore does not silently
-- erase already delivered history. What DOES remove it is the owner's own
-- deletion, through the canonical 0090 capability, which this migration
-- extends by exactly one branch.
--
-- ===========================================================================
-- NO COUNTERPART PARAMETER, EVER
-- ===========================================================================
--
-- The owner is `auth.uid()`. The counterpart is DERIVED from the exact
-- Introduction Record's two matched humans. The command accepts no
-- counterpart, recipient, audience or owner identifier of any kind, so a
-- disclosure cannot be rerouted to a third human however the caller is
-- composed - and the terminal self-assertion at the end of this migration
-- refuses to deploy a command that accepts one.
--
-- ===========================================================================
-- THE BOUNDED v1 RESOURCE VOCABULARY
-- ===========================================================================
--
--   FULL_NAME               text
--   CONTACT_METHOD          text
--   DEEPER_PERSONAL_FIELD   text, with a bounded Product-configurable field key
--   PARTIAL_IMAGE           opaque media object reference
--   FULL_IMAGE              opaque media object reference
--
-- There is no generic RESOURCE_KIND and no JSON/JSONB payload anywhere. The
-- type-to-payload binding is STRUCTURAL rather than procedural: the version
-- carries UNIQUE (id, resource_type), and each payload relation pins the exact
-- types it accepts and binds BOTH columns by composite foreign key. A text
-- payload on an image resource is therefore a constraint violation rather than
-- a bug a reviewer must catch, and one version can never carry both payloads
-- because `resource_type` is one value.
--
-- PARTIAL_IMAGE and FULL_IMAGE are two INDEPENDENT resource versions. One
-- never authorizes the other, because there is no authority object spanning
-- them: each delivery is its own version, its own material and its own grant.
-- The exact cropping / blurring / derivative-rendering algorithm is DEFERRED
-- Product scope and nothing here decides it.
--
-- An image reference is an OPAQUE server-side media object identity, CHECKed
-- exactly as migration 0089 CHECKs a voice note's: not a URL, no query, no
-- fragment, no credential-shaped token, no whitespace, no prose. I-07D builds
-- no storage provider, upload path or credential.
--
-- ===========================================================================
-- A DELIVERED DISCLOSURE IS REAL SHARED HISTORY
-- ===========================================================================
--
-- Migration 0089 reserved `EXPLICIT_DISCLOSURE` with `body_form = RESERVED`
-- and deliberately gave it no producer, because no authority or source
-- contract for one existed. This migration is that one reviewed producer. It
-- composes the existing relations rather than founding a second material
-- system:
--
--   shared_world_history_items              the I-04F visibility identity
--   shared_world_history_item_baseline_viewers   exactly owner + counterpart
--   shared_world_history_item_required_approvers exactly the owner
--   shared_world_materials                  EXPLICIT_DISCLOSURE / HUMAN / RESERVED
--   shared_world_material_dependencies      INDEPENDENT_TARGET_TRUTH
--   shared_world_material_historical_authority   RESOLVED_EXACT_HUMAN_REQUIREMENT
--
-- The Shared material envelope carries no body, because its body form is
-- RESERVED and no 0089 body relation accepts that form. The typed Introduction
-- resource relation owns the bounded payload, which is also what makes owner
-- deletion able to destroy the payload while the envelope, the history item
-- and the audit identity survive as non-content history.
--
-- The provenance edge is INDEPENDENT_TARGET_TRUTH on purpose: the owner's
-- disclosure establishes its own truth. It is NOT a REASONING_DEPENDENCY,
-- because no Matching private reasoning is read to decide what to disclose -
-- the owner supplies and authorizes the exact resource - and recording one
-- would assert an influence that did not happen.
--
-- ===========================================================================
-- NON-RECIPROCITY IS STRUCTURAL
-- ===========================================================================
--
-- A disclosure by A names A as owner and B as counterpart, in one row, in one
-- direction. Nothing in this migration writes a reverse row, a reciprocal
-- authority, a "both reveal" bundle or a paired event: B's own disclosure
-- exists only after B executes the command as themselves. There is no code
-- path that could create it, which is a stronger statement than a rule.
--
-- ===========================================================================
-- INTRODUCTION HISTORICAL VISIBILITY JOINS THE ONE ENTRY POINT
-- ===========================================================================
--
-- Migration 0087 owns the single server-side historical visibility entry point
-- and currently refuses INTRODUCTION with a bounded unsupported class, because
-- I-04F implemented Standard visibility only. That refusal was a truthful
-- statement about what existed, not a ceiling, and this migration extends the
-- SAME entry point forward rather than creating a competing resolver.
--
-- The Standard branches are preserved EXACTLY as 0087 wrote them - the same
-- union of membership-period visibility and explicit history grants, the same
-- temporal bounds, the same availability dominance, the same delegation of
-- READ_ONLY_CLOSED to the closure slice's own reader. The Introduction branch
-- is strictly NARROWER: an exact currently-open matched episode is required,
-- and visibility is the exact baseline-audience conjunction alone. Selective
-- history packages are deliberately NOT extended into INTRODUCTION: at v1 an
-- Introduction has exactly two humans and no add / remove / rejoin flow, so
-- there is no absence period for a package to bridge, and granting package
-- semantics merely because Standard Worlds have them would be inventing
-- Product law.
--
-- Migration 0088's closed reader gains the failed-Introduction branch over the
-- entitlement family this migration creates; its signature is unchanged and
-- its Standard branch is preserved exactly.
--
-- ===========================================================================
-- THE PRE-LAUNCH SECURITY BOUNDARY
-- ===========================================================================
--
-- The disclosure command is fully implemented and executable by NO application
-- role, service_role included, because the frozen CW2-08 Launch Gate does not
-- exist. It additionally requires its own fail-closed prerequisite seam to
-- answer exactly CLEARED as its LAST gate, after every authority and privacy
-- gate, and that seam's only answer in production is NOT_EVALUATED. No
-- permissive row, constant or bypass is added anywhere.
--
-- The one narrow disclosure read resolver is service_role-only and composes
-- the canonical visibility entry point, following the frozen 0077 / 0079 /
-- 0080 / 0087 / 0089 precedent. It opens no direct table privilege.
--
-- ===========================================================================
-- What this migration deliberately does NOT do
-- ===========================================================================
--
-- It commits no terminal Introduction transition, releases no claim, writes no
-- POST_INTRODUCTION or POST_SUCCESS pause, closes no World and closes no
-- membership episode - all of that is 0116's. It reactivates no Matching
-- participation - that is 0117's. It creates no World, no membership, no
-- Standing Context Grant, no Matching Context Grant and no proposal; it reads
-- no Matching private reasoning, no Personal context and no Public state; it
-- adds no route, controller, RPC, mobile surface, Launch Gate, feature flag,
-- entitlement or moderation policy; and it builds no media storage provider or
-- upload path. Every historical migration, 0001-0114 included, is untouched:
-- the three functions replaced below are replaced FORWARD-ONLY through
-- CREATE OR REPLACE, and their files are not edited.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE EXACT IMMUTABLE DISCLOSURE RESOURCE VERSION.
--
--    One row is one delivered disclosure: one exact owner, one exact derived
--    counterpart, one exact resource type, in one exact Introduction of one
--    exact World, bound one-to-one to the exact Shared material and history
--    item it became.
--
--    There is no status, no revocation and no lifecycle column: a delivered
--    disclosure is history, and what narrows it later is source availability,
--    which is the owner's authority and lives on the I-04F history item.
--
--    The three UNIQUE bindings are not redundancy. (id, resource_type) lets
--    each payload relation prove structurally that it belongs to a version
--    whose type actually takes that payload; (id, owner_user_id) lets the
--    grant fact bind the owner as one row; (material_id) is the one-material,
--    one-resource-version rule in both directions.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_disclosure_resource_versions (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    introduction_record_id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    counterpart_user_id uuid NOT NULL,
    resource_type text NOT NULL,
    material_id uuid NOT NULL,
    history_item_id uuid NOT NULL,
    established_at timestamptz NOT NULL,
    CONSTRAINT introduction_disclosure_resource_versions_pk PRIMARY KEY (id),
    CONSTRAINT introduction_disclosure_resource_versions_material_key UNIQUE (material_id),
    CONSTRAINT introduction_disclosure_resource_versions_item_key UNIQUE (history_item_id),
    CONSTRAINT introduction_disclosure_resource_versions_type_key UNIQUE (id, resource_type),
    CONSTRAINT introduction_disclosure_resource_versions_owner_key UNIQUE (id, owner_user_id),
    -- THE FROZEN v1 VOCABULARY, complete and closed. No generic resource kind.
    CONSTRAINT introduction_disclosure_resource_versions_type_check
        CHECK (resource_type IN ('PARTIAL_IMAGE', 'FULL_IMAGE', 'FULL_NAME',
                                 'CONTACT_METHOD', 'DEEPER_PERSONAL_FIELD')),
    -- A disclosure has exactly two distinct humans and it has a direction.
    CONSTRAINT introduction_disclosure_resource_versions_pair_check
        CHECK (owner_user_id <> counterpart_user_id),
    CONSTRAINT introduction_disclosure_resource_versions_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    -- The exact Introduction Record, in the exact same World, structurally.
    CONSTRAINT introduction_disclosure_resource_versions_record_fk
        FOREIGN KEY (introduction_record_id, world_id)
        REFERENCES public.introduction_records (id, world_id) ON DELETE RESTRICT,
    -- The exact Shared material, in the exact same World, structurally.
    CONSTRAINT introduction_disclosure_resource_versions_material_fk
        FOREIGN KEY (material_id, world_id)
        REFERENCES public.shared_world_materials (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT introduction_disclosure_resource_versions_item_fk
        FOREIGN KEY (history_item_id, world_id)
        REFERENCES public.shared_world_history_items (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT introduction_disclosure_resource_versions_owner_fk
        FOREIGN KEY (owner_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT introduction_disclosure_resource_versions_counterpart_fk
        FOREIGN KEY (counterpart_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

-- The two frozen access patterns: one Introduction's disclosures in delivery
-- order, and one owner's own disclosures. Nothing speculative.
CREATE INDEX introduction_disclosure_resource_versions_record_idx
    ON public.introduction_disclosure_resource_versions (introduction_record_id, established_at);
CREATE INDEX introduction_disclosure_resource_versions_owner_idx
    ON public.introduction_disclosure_resource_versions (owner_user_id);

COMMENT ON TABLE public.introduction_disclosure_resource_versions IS
  'One exact delivered progressive disclosure: one owner, one DERIVED '
  'counterpart, one bounded resource type and one exact resource version, bound '
  'one-to-one to the EXPLICIT_DISCLOSURE Shared material and the I-04F history '
  'item it became. A partial image and a full image are two independent '
  'versions and neither authorizes the other. There is no status, no revocation '
  'and no reusable permission: the owner''s grant and the delivery are one '
  'atomic act, and what narrows it later is owner deletion.';

-- ---------------------------------------------------------------------------
-- 2. THE TEXT PAYLOAD.
--
--    The real bounded UTF-8 value of a FULL_NAME, a CONTACT_METHOD or a
--    DEEPER_PERSONAL_FIELD, and the only place a disclosed text value lives.
--    The composite foreign key into (id, resource_type) makes "this payload
--    belongs to a version whose type takes text" structural, and the CHECK
--    above it pins exactly which three types those are.
--
--    `field_key` exists exactly for DEEPER_PERSONAL_FIELD and for nothing
--    else, which is CHECKed against the version's own type carried on this
--    row - so a full name can never acquire a field key and a deeper field can
--    never lose one.
--
--    The key ban is the 0108 Introduction Profile ban, kept for a reason that
--    survives the Match: CONTACT_METHOD is the ONE reviewed way to disclose a
--    contact route, so a deeper personal field must never become a second,
--    unreviewed one under an invented key.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_disclosure_text_payloads (
    resource_version_id uuid NOT NULL,
    resource_type text NOT NULL,
    field_key text,
    text_value text NOT NULL,
    CONSTRAINT introduction_disclosure_text_payloads_pk PRIMARY KEY (resource_version_id),
    CONSTRAINT introduction_disclosure_text_payloads_type_check
        CHECK (resource_type IN ('FULL_NAME', 'CONTACT_METHOD', 'DEEPER_PERSONAL_FIELD')),
    -- A field key exists exactly for the one type that has one.
    CONSTRAINT introduction_disclosure_text_payloads_key_coherence_check
        CHECK ((field_key IS NOT NULL) = (resource_type = 'DEEPER_PERSONAL_FIELD')),
    CONSTRAINT introduction_disclosure_text_payloads_key_shape_check
        CHECK (field_key IS NULL OR field_key ~ '^[a-z][a-z0-9_]{2,47}$'),
    -- A deeper personal field may never name a contact route, a media handle
    -- or an identity document: CONTACT_METHOD is the reviewed type for the
    -- first, and the other two are not disclosure resources at all.
    CONSTRAINT introduction_disclosure_text_payloads_key_ban_check
        CHECK (field_key IS NULL
           OR field_key !~ ('(^|_)(phone|mobile|email|whatsapp|telegram|instagram|snapchat|tiktok'
                         || '|facebook|twitter|linkedin|handle|username|contact|address|street|geo|gps'
                         || '|latitude|longitude|coordinates|url|uri|link|photo|image|avatar|selfie'
                         || '|video|audio|passport|ssn|nid|kyc|password|token|id)(_|$)')),
    -- Bounded UTF-8, non-blank and single-line. The ceiling is a structural
    -- ceiling that keeps this relation from becoming a blob or an output
    -- channel; it freezes no Product copy limit and no field catalogue.
    CONSTRAINT introduction_disclosure_text_payloads_value_check
        CHECK (btrim(text_value) <> '' AND length(text_value) <= 512
           AND text_value !~ '[\n\r]'),
    -- THE TYPE-TO-PAYLOAD BINDING, made structural.
    CONSTRAINT introduction_disclosure_text_payloads_version_fk
        FOREIGN KEY (resource_version_id, resource_type)
        REFERENCES public.introduction_disclosure_resource_versions (id, resource_type) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 3. THE IMAGE PAYLOAD.
--
--    `media_object_ref` is an OPAQUE immutable server-side media object
--    reference, CHECKed exactly as migration 0089 CHECKs a voice note's: a
--    value containing whitespace, a scheme separator, a query or fragment
--    separator or a credential-shaped token is refused. It is not a URL, it
--    carries no credential, signature or embedded authorization, and it
--    carries no user-readable prose.
--
--    I-07D builds no storage provider and no upload path, and image bytes do
--    not live in PostgreSQL. What lives here is the reference a future
--    reviewed media boundary resolves, and the reference is what owner
--    deletion destroys.
--
--    PARTIAL_IMAGE and FULL_IMAGE are both accepted here because both are
--    image-backed. They remain two independent versions: the type lives on the
--    version, one version has one type, and there is no relation joining a
--    partial version to a full one.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_disclosure_media_payloads (
    resource_version_id uuid NOT NULL,
    resource_type text NOT NULL,
    media_object_ref text NOT NULL,
    CONSTRAINT introduction_disclosure_media_payloads_pk PRIMARY KEY (resource_version_id),
    CONSTRAINT introduction_disclosure_media_payloads_type_check
        CHECK (resource_type IN ('PARTIAL_IMAGE', 'FULL_IMAGE')),
    CONSTRAINT introduction_disclosure_media_payloads_opaque_ref_check
        CHECK (length(btrim(media_object_ref)) > 0
           AND length(media_object_ref) <= 512
           AND media_object_ref !~ '\s'
           AND media_object_ref !~ '://'
           AND media_object_ref !~ '[?#]'
           AND media_object_ref !~* '(token|signature|sig=|key=|secret|password|credential|bearer|x-amz|expires|assertion)'),
    CONSTRAINT introduction_disclosure_media_payloads_version_fk
        FOREIGN KEY (resource_version_id, resource_type)
        REFERENCES public.introduction_disclosure_resource_versions (id, resource_type) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 4. THE DURABLE DISCLOSURE_GRANTED FACT.
--
--    Table identity IS the event type, exactly as 0082's direct birth fact and
--    0113's two Match facts. The row carries identity and time only: which
--    World, which Introduction, which exact resource version, which owner
--    authorized it, which exact counterpart received it, and when.
--
--    It records the owner's authority act. Because the grant and the delivery
--    are one transaction, one grant fact exists per delivered resource version
--    and never independently of one.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_disclosure_granted_events (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    introduction_record_id uuid NOT NULL,
    resource_version_id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    counterpart_user_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT introduction_disclosure_granted_events_pk PRIMARY KEY (id),
    -- One resource version carries exactly one grant fact.
    CONSTRAINT introduction_disclosure_granted_events_version_key UNIQUE (resource_version_id),
    -- The exact owner of the exact version is the human who granted it: a
    -- grant fact naming a different human cannot exist.
    CONSTRAINT introduction_disclosure_granted_events_version_fk
        FOREIGN KEY (resource_version_id, owner_user_id)
        REFERENCES public.introduction_disclosure_resource_versions (id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT introduction_disclosure_granted_events_record_fk
        FOREIGN KEY (introduction_record_id, world_id)
        REFERENCES public.introduction_records (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT introduction_disclosure_granted_events_counterpart_fk
        FOREIGN KEY (counterpart_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

CREATE INDEX introduction_disclosure_granted_events_record_idx
    ON public.introduction_disclosure_granted_events (introduction_record_id, occurred_at);

COMMENT ON TABLE public.introduction_disclosure_granted_events IS
  'The durable DISCLOSURE_GRANTED fact. Table identity is the event type: one '
  'delivered resource version carries exactly one row, naming the owner who '
  'authorized it and the exact derived counterpart who received it. A QANDEEL '
  'suggestion produces no row here and has no representation at all.';

-- ---------------------------------------------------------------------------
-- 5. THE DURABLE DISCLOSURE COMMAND.
--
--    One row per delivered disclosure. It is the idempotency key AND the exact
--    committed answer: an equivalent retry is served from here rather than by
--    re-reading current state, so a later terminal transition, World closure
--    or owner deletion can never make a historical command start answering
--    differently.
--
--    `request_ref` binds the WHOLE immutable request - every input that must
--    not differ between a retry and the command it retries, with presence
--    distinguished from value so a NULL and a value can never fingerprint
--    alike. `payload_digest` binds the exact disclosed bytes, which is what
--    makes "equivalent retry" mean something after the owner has legitimately
--    destroyed the payload. Neither is reversible and neither is content.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_disclosure_commands (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    introduction_record_id uuid NOT NULL,
    resource_version_id uuid NOT NULL,
    material_id uuid NOT NULL,
    history_item_id uuid NOT NULL,
    disclosure_granted_event_id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    counterpart_user_id uuid NOT NULL,
    resource_type text NOT NULL,
    payload_digest text NOT NULL,
    request_ref text NOT NULL,
    baseline_viewer_count integer NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT introduction_disclosure_commands_pk PRIMARY KEY (id),
    CONSTRAINT introduction_disclosure_commands_version_key UNIQUE (resource_version_id),
    CONSTRAINT introduction_disclosure_commands_material_key UNIQUE (material_id),
    CONSTRAINT introduction_disclosure_commands_item_key UNIQUE (history_item_id),
    CONSTRAINT introduction_disclosure_commands_event_key UNIQUE (disclosure_granted_event_id),
    CONSTRAINT introduction_disclosure_commands_digest_check
        CHECK (payload_digest ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT introduction_disclosure_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    -- An Introduction disclosure is delivered to exactly the owner and the
    -- exact counterpart: two humans, never one and never three.
    CONSTRAINT introduction_disclosure_commands_viewers_check
        CHECK (baseline_viewer_count = 2),
    -- The exact delivered version, owned by the exact human this command
    -- names, carrying the exact type this command names - as one row.
    CONSTRAINT introduction_disclosure_commands_version_fk
        FOREIGN KEY (resource_version_id, owner_user_id)
        REFERENCES public.introduction_disclosure_resource_versions (id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT introduction_disclosure_commands_type_fk
        FOREIGN KEY (resource_version_id, resource_type)
        REFERENCES public.introduction_disclosure_resource_versions (id, resource_type) ON DELETE RESTRICT,
    CONSTRAINT introduction_disclosure_commands_event_fk
        FOREIGN KEY (disclosure_granted_event_id)
        REFERENCES public.introduction_disclosure_granted_events (id) ON DELETE RESTRICT,
    CONSTRAINT introduction_disclosure_commands_record_fk
        FOREIGN KEY (introduction_record_id, world_id)
        REFERENCES public.introduction_records (id, world_id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 6. THE INTRODUCTION CLOSED-VIEW ENTITLEMENT FAMILY.
--
--    The Standard closure entitlement tables migration 0088 owns are NAMED for
--    Standard closure and are Standard-owned; treating them as generic would
--    make one relation answer for two different closures with different law.
--    So an unsuccessful Introduction gets its own narrow family, created here
--    because the closed reader below must resolve over it, and WRITTEN by
--    migration 0116, which owns the terminal transition.
--
--    An entitlement is historical viewing authority and nothing else. It is
--    not membership, not governance, not a new history grant, not a Standing
--    Context Grant and not private-context reasoning authority; it carries no
--    open or current state of any kind. `membership_episode_id` records WHICH
--    exact episode it derived from, which makes "this human was a matched
--    member at closure, and is not one now" auditable without manufacturing a
--    fake active membership.
--
--    Availability continues to dominate it, which is why the reader re-checks
--    availability on every read rather than trusting the frozen item set: a
--    later valid owner deletion narrows an entitlement that already exists.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_closed_view_entitlements (
    world_id uuid NOT NULL,
    user_id uuid NOT NULL,
    introduction_record_id uuid NOT NULL,
    membership_episode_id uuid NOT NULL,
    entitled_at timestamptz NOT NULL,
    CONSTRAINT introduction_closed_view_entitlements_pk PRIMARY KEY (world_id, user_id),
    CONSTRAINT introduction_closed_view_entitlements_episode_key UNIQUE (membership_episode_id),
    CONSTRAINT introduction_closed_view_entitlements_record_fk
        FOREIGN KEY (introduction_record_id, world_id)
        REFERENCES public.introduction_records (id, world_id) ON DELETE RESTRICT,
    -- The exact episode OF THIS WORLD FOR THIS HUMAN, structurally: an
    -- entitlement can never derive from somebody else's membership.
    CONSTRAINT introduction_closed_view_entitlements_episode_fk
        FOREIGN KEY (membership_episode_id, world_id, user_id)
        REFERENCES public.shared_world_membership_episodes (id, world_id, user_id) ON DELETE RESTRICT,
    CONSTRAINT introduction_closed_view_entitlements_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

CREATE TABLE public.introduction_closed_view_entitlement_items (
    world_id uuid NOT NULL,
    user_id uuid NOT NULL,
    history_item_id uuid NOT NULL,
    CONSTRAINT introduction_closed_view_entitlement_items_pk
        PRIMARY KEY (world_id, user_id, history_item_id),
    CONSTRAINT introduction_closed_view_entitlement_items_holder_fk
        FOREIGN KEY (world_id, user_id)
        REFERENCES public.introduction_closed_view_entitlements (world_id, user_id) ON DELETE RESTRICT,
    CONSTRAINT introduction_closed_view_entitlement_items_item_fk
        FOREIGN KEY (history_item_id, world_id)
        REFERENCES public.shared_world_history_items (id, world_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.introduction_closed_view_entitlements IS
  'The frozen closed-view entitlement of ONE human over ONE unsuccessfully '
  'ended Introduction World, snapshotted while the World was still ACTIVE and '
  'both matched episodes were still open. It is historical viewing authority: '
  'not membership, not governance, not a history grant, not a Standing Context '
  'Grant. A human may legitimately hold one with zero items, and availability '
  'continues to dominate it.';

-- ---------------------------------------------------------------------------
-- 7. Deny-by-default posture for all seven new relations: RLS on, zero
--    policies, every application role revoked from every privilege. There is
--    no direct client read path and no application read boundary except the
--    one narrow disclosure resolver at the end of this migration.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_tables text[] := ARRAY['public.introduction_disclosure_resource_versions',
                             'public.introduction_disclosure_text_payloads',
                             'public.introduction_disclosure_media_payloads',
                             'public.introduction_disclosure_granted_events',
                             'public.introduction_disclosure_commands',
                             'public.introduction_closed_view_entitlements',
                             'public.introduction_closed_view_entitlement_items'];
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY own_tables LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', target_table);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', target_table);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM service_role', target_table);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 8. IMMUTABILITY.
--
--    A delivered disclosure, its payload, its grant fact and its command are
--    durable history. UPDATE and DELETE are refused for every role INCLUDING
--    the table owner, because a privilege does not bind the owner - the reason
--    0108, 0110 and 0113 all use a trigger rather than an ACL alone.
--
--    The two PAYLOAD relations are deliberately NOT in this set: the canonical
--    owner-deletion capability must be able to physically DESTROY a payload
--    row, exactly as it destroys a text or voice-note body. What it may never
--    do is REWRITE one, and that is what the payload guard below enforces:
--    UPDATE is refused, DELETE is allowed. A payload that could be rewritten
--    would let deletion be faked as a replacement.
--
--    The entitlement relations are likewise not frozen here: migration 0116
--    writes them inside the one terminal transaction, and 0116 installs their
--    own guard beside the terminal law they belong to.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_introduction_disclosure_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_IS_DURABLE'
    USING ERRCODE='55000',
          DETAIL='A delivered Introduction disclosure, its grant fact and its durable command are immutable history: UPDATE and DELETE are refused for every role, including the table owner.';
END$$;

ALTER FUNCTION public.reject_introduction_disclosure_mutation_v1() OWNER TO postgres;

CREATE TRIGGER introduction_disclosure_resource_versions_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_disclosure_resource_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_introduction_disclosure_mutation_v1();
CREATE TRIGGER introduction_disclosure_granted_events_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_disclosure_granted_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_introduction_disclosure_mutation_v1();
CREATE TRIGGER introduction_disclosure_commands_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_disclosure_commands
    FOR EACH ROW EXECUTE FUNCTION public.reject_introduction_disclosure_mutation_v1();

-- A payload is destroyed by owner deletion or it is not touched at all. It is
-- never rewritten in place, so "deleted" can never be faked as "replaced".
CREATE FUNCTION public.reject_introduction_payload_rewrite_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_PAYLOAD_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A disclosed Introduction resource payload is never rewritten in place. The owner may DESTROY it through the canonical Shared material owner-deletion capability; nothing may edit it.';
END$$;

ALTER FUNCTION public.reject_introduction_payload_rewrite_v1() OWNER TO postgres;

CREATE TRIGGER introduction_disclosure_text_payloads_immutable
    BEFORE UPDATE ON public.introduction_disclosure_text_payloads
    FOR EACH ROW EXECUTE FUNCTION public.reject_introduction_payload_rewrite_v1();
CREATE TRIGGER introduction_disclosure_media_payloads_immutable
    BEFORE UPDATE ON public.introduction_disclosure_media_payloads
    FOR EACH ROW EXECUTE FUNCTION public.reject_introduction_payload_rewrite_v1();

-- ---------------------------------------------------------------------------
-- 9. THE FAIL-CLOSED CW2-08 SEAM FOR DISCLOSURE DELIVERY.
--
--    I-07D does not implement I-09. This is a seam in exactly the shape of the
--    frozen 0095, 0105 and 0111 seams, and its only answer is NOT_EVALUATED.
--    The disclosure command requires exactly CLEARED from it as its LAST gate,
--    after every authority and privacy gate, so production disclosure fails
--    closed even when every other gate is satisfied.
--
--    The slice that implements CW2-08 replaces this body; nothing that
--    consumes it moves. No permissive row, constant or role bypass is added.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_introduction_disclosure_prerequisites_v1(p_world_id uuid)
RETURNS TABLE(clearance text, basis text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RETURN QUERY SELECT 'NOT_EVALUATED'::text,
    ('CW2-08 safety, moderation, entitlement, feature and Launch Gate evaluation has no canonical '
     || 'runtime in this repository, so Introduction progressive disclosure is not cleared.')::text;
END$$;

ALTER FUNCTION public.resolve_introduction_disclosure_prerequisites_v1(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.resolve_introduction_disclosure_prerequisites_v1(uuid) IS
  'The CW2-08 prerequisite seam for Introduction progressive disclosure '
  'delivery. Its only answer is NOT_EVALUATED, and the disclosure command '
  'requires exactly CLEARED from it as its LAST gate, after every authority and '
  'privacy gate. It never answers CLEARED and it never will until the canonical '
  'gate exists.';

-- ---------------------------------------------------------------------------
-- 10. THE ONE PROGRESSIVE DISCLOSURE WRITE BOUNDARY.
--
--     The owner is `auth.uid()`, derived and never supplied. The caller
--     provides opaque persistence identities, the bounded resource type and
--     the exact payload it is disclosing - and NO owner, counterpart,
--     recipient, audience, authority, episode, audience size or instant of any
--     kind. Every one of those is derived from canonical state under the World
--     lock, or from the database clock.
--
--     THE CANONICAL TRANSACTION, in this exact order:
--       1  the exact payload shape of exactly one bounded type
--       2  the whole immutable request identity
--       3  durable idempotency, BEFORE any lock
--       4  the exact Shared World row, LOCKED FIRST
--       5  durable idempotency again, under the lock
--       6  lifecycle ACTIVE and phase INTRODUCTION
--       7  the exact Introduction Record of that World, LOCKED SECOND, ACTIVE
--       8  the owner is one of the exact two matched humans; the counterpart
--          is the OTHER one, derived
--       9  exactly two open membership episodes, one per matched human
--      10  the CW2-08 prerequisite, LAST
--      11  ONE database-owned instant
--      12  history item + baseline audience + material authority + envelope +
--          provenance + historical authority + resource version + payload +
--          grant fact + command, atomically
--
--     It acquires NO matching_setup_lock. Progressive disclosure is
--     Shared-World-local: after the Match, Shared World lifecycle is
--     independent of Matching, and taking a Matching lock here would re-couple
--     Matching permission to Shared disclosure and invent a deadlock surface
--     that the law does not require.
--
--     The RETURNS TABLE columns are named so that none collides with a column
--     this body reads: an OUT parameter is a plpgsql variable, and an
--     unqualified reference to a same-named column is an execution-time
--     ambiguity error rather than a compile-time one.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_introduction_progressive_disclosure_v1(
  p_command_id uuid, p_world_id uuid, p_resource_version_id uuid, p_material_id uuid,
  p_history_item_id uuid, p_disclosure_granted_event_id uuid,
  p_resource_type text, p_field_key text, p_text_value text, p_media_object_ref text
) RETURNS TABLE(outcome text, command_id uuid, disclosed_world_id uuid,
                disclosed_resource_version_id uuid, disclosed_material_id uuid,
                disclosed_history_item_id uuid, disclosed_resource_type text,
                disclosed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.introduction_disclosure_commands;
  world public.shared_worlds;
  record_row public.introduction_records;
  gate record;
  counterpart uuid;
  digest text;
  request text;
  is_text boolean;
  affected integer;
  viewers integer;
  disclose_at timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_resource_version_id IS NULL
     OR p_material_id IS NULL OR p_history_item_id IS NULL
     OR p_disclosure_granted_event_id IS NULL OR p_resource_type IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- STEP 1. THE EXACT PAYLOAD SHAPE OF EXACTLY ONE BOUNDED TYPE. A text
  -- resource carrying a media reference and an image resource carrying text
  -- are both refused here as well as being unrepresentable in the schema, so a
  -- confused caller gets the bounded invalid-command class rather than a
  -- constraint name.
  IF p_resource_type IN ('FULL_NAME', 'CONTACT_METHOD', 'DEEPER_PERSONAL_FIELD') THEN
    is_text := true;
    IF p_text_value IS NULL OR btrim(p_text_value) = '' OR p_media_object_ref IS NOT NULL THEN
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    IF (p_field_key IS NOT NULL) <> (p_resource_type = 'DEEPER_PERSONAL_FIELD') THEN
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    -- The bounded single-line shapes, checked HERE as well as by the schema, so
    -- a malformed payload reaches the bounded invalid-command class rather than
    -- leaking a constraint name - and so the two-part digest below can never be
    -- made ambiguous by an embedded separator.
    IF length(p_text_value) > 512 OR p_text_value ~ '[\n\r]'
       OR (p_field_key IS NOT NULL AND p_field_key !~ '^[a-z][a-z0-9_]{2,47}$') THEN
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    digest := 'sha256:' || encode(sha256(convert_to(
                coalesce(p_field_key, '') || E'\n' || p_text_value, 'UTF8')), 'hex');
  ELSIF p_resource_type IN ('PARTIAL_IMAGE', 'FULL_IMAGE') THEN
    is_text := false;
    IF p_media_object_ref IS NULL OR btrim(p_media_object_ref) = ''
       OR p_text_value IS NOT NULL OR p_field_key IS NOT NULL THEN
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    digest := 'sha256:' || encode(sha256(convert_to(p_media_object_ref, 'UTF8')), 'hex');
  ELSE
    -- There is no generic resource kind, and an unspelled one is not a new one.
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- STEP 2. THE WHOLE IMMUTABLE REQUEST IDENTITY. Every input that must not
  -- differ between a retry and the command it retries, with presence
  -- distinguished from value so a NULL and a value can never fingerprint
  -- alike. The derived counterpart is deliberately NOT in it: it is a function
  -- of the exact World, which is, so including it would add nothing and would
  -- force a mutable read before the first idempotency pass.
  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_INTRODUCTION_DISCLOSURE_REQUEST_V1' || E'\n'
   || 'world=' || lower(p_world_id::text) || E'\n'
   || 'resourceVersion=' || lower(p_resource_version_id::text) || E'\n'
   || 'material=' || lower(p_material_id::text) || E'\n'
   || 'historyItem=' || lower(p_history_item_id::text) || E'\n'
   || 'grantEvent=' || lower(p_disclosure_granted_event_id::text) || E'\n'
   || 'owner=' || lower(u::text) || E'\n'
   || 'resourceType=' || p_resource_type || E'\n'
   || 'fieldKey=' || CASE WHEN p_field_key IS NULL THEN 'NONE' ELSE p_field_key END || E'\n'
   || 'payload=' || digest || E'\n'
   || 'payloadForm=' || CASE WHEN is_text THEN 'TEXT' ELSE 'MEDIA' END, 'UTF8')), 'hex');

  -- STEP 3. DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent
  -- retry of a command that already committed is answered from immutable
  -- history even after the Introduction has ended, the World has closed or the
  -- owner has since deleted the payload. Nothing on this path reads current
  -- World state, current membership or current availability.
  SELECT * INTO committed FROM public.introduction_disclosure_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.owner_user_id = u AND committed.world_id = p_world_id
       AND committed.resource_version_id = p_resource_version_id
       AND committed.material_id = p_material_id
       AND committed.history_item_id = p_history_item_id
       AND committed.disclosure_granted_event_id = p_disclosure_granted_event_id
       AND committed.request_ref = request THEN
      RETURN QUERY SELECT 'DISCLOSURE_GRANTED'::text, committed.id, committed.world_id,
                          committed.resource_version_id, committed.material_id,
                          committed.history_item_id, committed.resource_type, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- STEP 4. CANONICAL LOCK ORDER, THE WORLD ROW FIRST. Every consequential
  -- Introduction mutation starts here, which is what makes disclosure-versus-END,
  -- disclosure-versus-SUCCESS and disclosure-versus-owner-deletion serialize in
  -- one deterministic order with no deadlock.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- STEP 5. DURABLE IDEMPOTENCY, SECOND PASS, under the World lock, so two
  -- concurrent equivalent disclosures serialize and the loser returns the
  -- committed result instead of attempting a second delivery.
  SELECT * INTO committed FROM public.introduction_disclosure_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.owner_user_id = u AND committed.world_id = p_world_id
       AND committed.resource_version_id = p_resource_version_id
       AND committed.material_id = p_material_id
       AND committed.history_item_id = p_history_item_id
       AND committed.disclosure_granted_event_id = p_disclosure_granted_event_id
       AND committed.request_ref = request THEN
      RETURN QUERY SELECT 'DISCLOSURE_GRANTED'::text, committed.id, committed.world_id,
                          committed.resource_version_id, committed.material_id,
                          committed.history_item_id, committed.resource_type, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- STEP 6. PROGRESSIVE DISCLOSURE IS AN ACTIVE / INTRODUCTION ACT AND NOTHING
  -- ELSE. A successfully completed Introduction is ACTIVE / STANDARD and uses
  -- ordinary Shared material; an ended one is READ_ONLY_CLOSED and admits no
  -- ordinary mutation at all. Both reach the same bounded unavailable class as
  -- a World that does not exist, so this is not a lifecycle oracle.
  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'INTRODUCTION' THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- STEP 7. CANONICAL LOCK ORDER, STEP 2: the exact Introduction Record of
  -- that exact World. `world_id` is UNIQUE on the record, so there is exactly
  -- one, and locking it is what serializes disclosure against the terminal
  -- transitions migration 0116 owns.
  SELECT * INTO record_row FROM public.introduction_records r
   WHERE r.world_id = p_world_id FOR UPDATE;
  IF NOT FOUND OR record_row.introduction_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- STEP 8. THE OWNER IS ONE OF THE EXACT TWO MATCHED HUMANS, AND THE
  -- COUNTERPART IS THE OTHER ONE - DERIVED, never supplied and never
  -- routable. A human who is not in this Introduction reaches the same bounded
  -- class as a World that does not exist.
  IF u NOT IN (record_row.lower_user_id, record_row.higher_user_id) THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  counterpart := CASE WHEN u = record_row.lower_user_id
                      THEN record_row.higher_user_id ELSE record_row.lower_user_id END;

  -- STEP 9. EXACTLY TWO OPEN MATCHED EPISODES, one for each exact human. This
  -- is the delivery audience, derived from canonical membership rather than
  -- accepted from a caller, and it is why the baseline viewer count is two.
  SELECT count(*)::integer INTO affected
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.ended_at IS NULL;
  IF affected <> 2
     OR NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                     WHERE e.world_id = p_world_id AND e.user_id = u AND e.ended_at IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                     WHERE e.world_id = p_world_id AND e.user_id = counterpart AND e.ended_at IS NULL) THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- STEP 10. THE CW2-08 PREREQUISITE, LAST - after every authority and privacy
  -- gate above, so a refusal here can never be read as an authority answer.
  SELECT * INTO gate FROM public.resolve_introduction_disclosure_prerequisites_v1(p_world_id);
  IF gate.clearance <> 'CLEARED' THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL='Introduction progressive disclosure requires the CW2-08 system/safety prerequisite to be CLEARED. It is not, and delivery fails closed.';
  END IF;

  -- STEP 11. THE ONE canonical delivery instant, read from the database clock
  -- exactly once, AFTER every lock wait and every currentness check, and
  -- reused for every moment this transaction persists.
  disclose_at := clock_timestamp();

  BEGIN
    -- STEP 12. The I-04F history identity FIRST, because the envelope, the
    -- audience, the authority and the resource version all bind to it.
    INSERT INTO public.shared_world_history_items
      (id, world_id, occurred_at, authority_requirement_mode, availability_state,
       availability_revision, registered_at)
    VALUES (p_history_item_id, p_world_id, disclose_at, 'EXACT_HUMAN_APPROVER_SET', 'AVAILABLE',
            1, disclose_at);

    -- THE EXACT ORIGINAL HUMAN AUDIENCE: the owner and the exact derived
    -- counterpart, and nobody else. Derived, never supplied.
    INSERT INTO public.shared_world_history_item_baseline_viewers (history_item_id, user_id)
    SELECT p_history_item_id, v.member FROM unnest(ARRAY[u, counterpart]) AS v(member);
    GET DIAGNOSTICS viewers = ROW_COUNT;
    IF viewers <> 2 THEN
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- THE EXACT HUMAN MATERIAL AUTHORITY: the owner, and only the owner.
    -- Receiving a disclosure never creates authority over it.
    INSERT INTO public.shared_world_history_item_required_approvers (history_item_id, approver_user_id)
    VALUES (p_history_item_id, u);

    -- THE RESERVED 0089 MATERIAL KIND, produced for the first time. The
    -- envelope carries no body, because its body form is RESERVED and no 0089
    -- body relation accepts that form; the typed payload below owns it.
    INSERT INTO public.shared_world_materials
      (id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
    VALUES (p_material_id, p_world_id, p_history_item_id, 'EXPLICIT_DISCLOSURE', 'HUMAN', 'RESERVED',
            u, disclose_at);

    -- PROVENANCE. The owner's own disclosure establishes its own truth: there
    -- is no source material and no source context reference. It is NOT a
    -- reasoning dependency, because no private Matching reasoning was read to
    -- decide what to disclose.
    INSERT INTO public.shared_world_material_dependencies
      (id, world_id, dependency_kind, target_material_id, target_established_at)
    VALUES (gen_random_uuid(), p_world_id, 'INDEPENDENT_TARGET_TRUTH', p_material_id, disclose_at);

    -- HISTORICAL-SHARING AUTHORITY. A human's own disclosed resource has
    -- exactly one human authority and it is known: themselves.
    INSERT INTO public.shared_world_material_historical_authority
      (material_id, world_id, history_item_id, resolution_state)
    VALUES (p_material_id, p_world_id, p_history_item_id, 'RESOLVED_EXACT_HUMAN_REQUIREMENT');

    INSERT INTO public.introduction_disclosure_resource_versions
      (id, world_id, introduction_record_id, owner_user_id, counterpart_user_id,
       resource_type, material_id, history_item_id, established_at)
    VALUES (p_resource_version_id, p_world_id, record_row.id, u, counterpart,
            p_resource_type, p_material_id, p_history_item_id, disclose_at);

    IF is_text THEN
      INSERT INTO public.introduction_disclosure_text_payloads
        (resource_version_id, resource_type, field_key, text_value)
      VALUES (p_resource_version_id, p_resource_type, p_field_key, p_text_value);
    ELSE
      INSERT INTO public.introduction_disclosure_media_payloads
        (resource_version_id, resource_type, media_object_ref)
      VALUES (p_resource_version_id, p_resource_type, p_media_object_ref);
    END IF;

    INSERT INTO public.introduction_disclosure_granted_events
      (id, world_id, introduction_record_id, resource_version_id, owner_user_id,
       counterpart_user_id, occurred_at)
    VALUES (p_disclosure_granted_event_id, p_world_id, record_row.id, p_resource_version_id, u,
            counterpart, disclose_at);

    INSERT INTO public.introduction_disclosure_commands
      (id, world_id, introduction_record_id, resource_version_id, material_id, history_item_id,
       disclosure_granted_event_id, owner_user_id, counterpart_user_id, resource_type,
       payload_digest, request_ref, baseline_viewer_count, committed_at)
    VALUES (p_command_id, p_world_id, record_row.id, p_resource_version_id, p_material_id,
            p_history_item_id, p_disclosure_granted_event_id, u, counterpart, p_resource_type,
            digest, request, viewers, disclose_at);
  EXCEPTION WHEN unique_violation THEN
    -- DURABLE IDEMPOTENCY, THIRD PASS. Two equivalent disclosures by the same
    -- human always serialize on the World row above, but two commands sharing
    -- a command id while resolving to DIFFERENT humans do not, and this
    -- conflict is their only serialization point. So durable history is
    -- consulted before any conflict is classified.
    SELECT * INTO committed FROM public.introduction_disclosure_commands c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.owner_user_id = u AND committed.world_id = p_world_id
         AND committed.resource_version_id = p_resource_version_id
         AND committed.material_id = p_material_id
         AND committed.history_item_id = p_history_item_id
         AND committed.disclosure_granted_event_id = p_disclosure_granted_event_id
         AND committed.request_ref = request THEN
        RETURN QUERY SELECT 'DISCLOSURE_GRANTED'::text, committed.id, committed.world_id,
                            committed.resource_version_id, committed.material_id,
                            committed.history_item_id, committed.resource_type, committed.committed_at;
        RETURN;
      END IF;
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- A supplied persistence identity was already taken. The whole delivery
    -- rolls back together, so a refused disclosure never leaves a resource
    -- version without a payload, a history item without its audience, or a
    -- material without its authority.
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'DISCLOSURE_GRANTED'::text, p_command_id, p_world_id, p_resource_version_id,
                      p_material_id, p_history_item_id, p_resource_type, disclose_at;
END$$;

-- ---------------------------------------------------------------------------
-- 11. THE ONE HISTORICAL VISIBILITY ENTRY POINT LEARNS INTRODUCTION.
--
--     This is migration 0087's function, replaced FORWARD-ONLY. It is not a
--     second resolver and it is not a second entry point: it remains the one
--     narrow server-side answer to "what history may this exact human see in
--     this exact Shared World, right now".
--
--     THE STANDARD BRANCHES ARE UNCHANGED. The ACTIVE / STANDARD union of
--     membership-period visibility and explicit history grants is the exact
--     0087 predicate, with the exact 0087 temporal bounds; READ_ONLY_CLOSED
--     still delegates to the closure slice's own reader; availability still
--     dominates every mode; a human with no currently open episode still gets
--     a truthful empty answer rather than a distinguishable error, so this is
--     still not a membership oracle.
--
--     THE INTRODUCTION BRANCH IS STRICTLY NARROWER. It requires an exact
--     currently-open matched episode and returns the exact baseline-audience
--     conjunction alone. Selective history packages are deliberately NOT
--     available in an Introduction: at v1 an Introduction has exactly two
--     humans and no add / remove / rejoin flow, so there is no absence period
--     for a package to bridge, and no hidden placeholder is manufactured.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_shared_world_history_visibility_v1(p_world_id uuid, p_user_id uuid)
RETURNS TABLE(world_id uuid, history_item_id uuid, occurred_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  world public.shared_worlds;
BEGIN
  IF p_world_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- Canonical existence first: a noncanonical World is a bounded error, never a
  -- successful empty history.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- A World mode outside the frozen vocabulary is still unsupported rather
  -- than silently given Standard semantics. Both frozen phases are now
  -- implemented, so this branch is a forward guard rather than a live refusal.
  IF world.phase NOT IN ('STANDARD', 'INTRODUCTION') THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_VISIBILITY_UNSUPPORTED_WORLD_MODE' USING ERRCODE='0A000';
  END IF;
  IF world.lifecycle = 'READ_ONLY_CLOSED' THEN
    RETURN QUERY SELECT c.world_id, c.history_item_id, c.occurred_at
      FROM public.resolve_shared_world_closed_history_visibility_v1(p_world_id, p_user_id) c;
    RETURN;
  END IF;
  -- ACTIVE: an open episode is required before anything is visible, in both
  -- modes. This is what makes a departed human's answer truthfully empty.
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                  WHERE e.world_id = p_world_id AND e.user_id = p_user_id AND e.ended_at IS NULL) THEN
    RETURN;
  END IF;
  -- ACTIVE / INTRODUCTION: the exact baseline-audience conjunction alone. No
  -- history package, no grant, no placeholder.
  IF world.phase = 'INTRODUCTION' THEN
    RETURN QUERY
      SELECT i.world_id, i.id, i.occurred_at
        FROM public.shared_world_history_items i
       WHERE i.world_id = p_world_id
         AND i.availability_state = 'AVAILABLE'
         AND EXISTS (
               SELECT 1 FROM public.shared_world_history_item_baseline_viewers b
                WHERE b.history_item_id = i.id AND b.user_id = p_user_id
                  AND EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                               WHERE e.world_id = i.world_id AND e.user_id = p_user_id
                                 AND i.occurred_at >= e.joined_at
                                 AND (e.ended_at IS NULL OR i.occurred_at <= e.ended_at)))
       ORDER BY i.occurred_at, i.id;
    RETURN;
  END IF;
  -- ACTIVE / STANDARD: exactly the frozen I-04F union, unchanged.
  RETURN QUERY
    SELECT i.world_id, i.id, i.occurred_at
      FROM public.shared_world_history_items i
     WHERE i.world_id = p_world_id
       AND i.availability_state = 'AVAILABLE'
       AND (EXISTS (
              SELECT 1 FROM public.shared_world_history_item_baseline_viewers b
               WHERE b.history_item_id = i.id AND b.user_id = p_user_id
                 AND EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                              WHERE e.world_id = i.world_id AND e.user_id = p_user_id
                                AND i.occurred_at >= e.joined_at
                                AND (e.ended_at IS NULL OR i.occurred_at <= e.ended_at)))
         OR EXISTS (
              SELECT 1 FROM public.shared_world_history_package_manifest_items mi
                JOIN public.shared_world_history_access_grants g
                  ON g.manifest_version_id = mi.manifest_version_id
               WHERE mi.history_item_id = i.id
                 AND g.world_id = i.world_id AND g.grantee_user_id = p_user_id))
     ORDER BY i.occurred_at, i.id;
END$$;

-- ---------------------------------------------------------------------------
-- 12. THE CLOSED-MODE READER LEARNS THE FAILED INTRODUCTION.
--
--     This is migration 0088's internal reader, replaced FORWARD-ONLY. Its
--     SIGNATURE is unchanged, it remains INTERNAL - no application role
--     executes it, service_role included - and its only caller is still the
--     postgres-owned entry point above, which reaches it as its own owner.
--
--     THE STANDARD BRANCH IS UNCHANGED: the exact 0088 entitlement snapshot,
--     with availability re-checked on every read. The Introduction branch is
--     the same law over the Introduction family: active membership is never
--     consulted after closure, a human with no entitlement gets a truthful
--     empty answer rather than a distinguishable error, and a later valid
--     owner deletion still removes source visibility from an entitlement that
--     already exists.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_shared_world_closed_history_visibility_v1(p_world_id uuid, p_user_id uuid)
RETURNS TABLE(world_id uuid, history_item_id uuid, occurred_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  world public.shared_worlds;
BEGIN
  IF p_world_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF world.lifecycle <> 'READ_ONLY_CLOSED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSED_VISIBILITY_UNSUPPORTED_WORLD_MODE' USING ERRCODE='0A000';
  END IF;
  -- READ_ONLY_CLOSED / INTRODUCTION: the exact Introduction closed-view
  -- entitlement snapshot migration 0116 froze at the terminal instant.
  IF world.phase = 'INTRODUCTION' THEN
    RETURN QUERY
      SELECT i.world_id, i.id, i.occurred_at
        FROM public.introduction_closed_view_entitlement_items it
        JOIN public.shared_world_history_items i ON i.id = it.history_item_id
       WHERE it.world_id = p_world_id AND it.user_id = p_user_id
         AND i.availability_state = 'AVAILABLE'
       ORDER BY i.occurred_at, i.id;
    RETURN;
  END IF;
  IF world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSED_VISIBILITY_UNSUPPORTED_WORLD_MODE' USING ERRCODE='0A000';
  END IF;
  -- READ_ONLY_CLOSED / STANDARD: exactly the frozen I-04F snapshot, unchanged.
  RETURN QUERY
    SELECT i.world_id, i.id, i.occurred_at
      FROM public.shared_world_standard_closed_view_entitlement_items it
      JOIN public.shared_world_history_items i ON i.id = it.history_item_id
     WHERE it.world_id = p_world_id AND it.user_id = p_user_id
       AND i.availability_state = 'AVAILABLE'
     ORDER BY i.occurred_at, i.id;
END$$;

-- ---------------------------------------------------------------------------
-- 13. OWNER DELETION LEARNS THE ONE RESERVED BODY IT WAS WAITING FOR.
--
--     This is migration 0090's owner-deletion primitive, replaced
--     FORWARD-ONLY, and the change is exactly one branch: when the material
--     being deleted is an EXPLICIT_DISCLOSURE, its typed Introduction payload
--     is physically removed with the same transaction that removes a text or
--     voice-note body.
--
--     0090 already anticipated this. Its body-count assertion already allowed
--     a RESERVED-form material to remove zero BODY rows, and its comment
--     already said that a later reviewed Introduction producer's material must
--     remain deletable by its own owner without reopening this primitive. What
--     it could not do was destroy a payload relation that did not exist yet.
--
--     Every other behaviour is preserved exactly: the actor is still
--     `auth.uid()` with no owner or actor parameter, the World row is still
--     locked first, phase is still not a gate, READ_ONLY_CLOSED still permits
--     it, the transitive MATERIAL_DEPENDENCY invalidation is unchanged, the
--     terminal DELETED_BY_OWNER transition is unchanged, and no envelope,
--     history item, baseline viewer, required approver, dependency, grant,
--     entitlement, membership episode, resource version or event is ever
--     removed. The resource version SURVIVES its payload, so audit identity
--     remains without source content and the disclosure can never be
--     reconstructed.
--
--     No other reserved or generic material kind becomes deletable through
--     guessed semantics: the new branch tests the exact kind by name.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_shared_world_owned_material_v1(
  p_command_id uuid, p_world_id uuid, p_material_id uuid, p_material_deleted_event_id uuid
) RETURNS TABLE(outcome text, command_id uuid, deleted_world_id uuid, deleted_material_id uuid,
                deleted_history_item_id uuid, deleted_event_id uuid,
                invalidated_targets integer, deleted_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.shared_world_material_delete_commands;
  world public.shared_worlds;
  owned public.shared_world_materials;
  item public.shared_world_history_items;
  targets uuid[];
  invalidating uuid[];
  removed integer;
  invalidated integer;
  affected integer;
  delete_instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_material_id IS NULL
     OR p_material_deleted_event_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent retry is
  -- answered from immutable history even after the World has closed. Nothing on
  -- this path reads current membership or current World state. The committed
  -- answer additionally proves that NO body and NO Introduction payload of the
  -- deleted material survives, which is the whole point of the deletion.
  SELECT * INTO committed FROM public.shared_world_material_delete_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.world_id = p_world_id
       AND committed.material_id = p_material_id
       AND committed.material_deleted_event_id = p_material_deleted_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_material_deleted_events ev
          JOIN public.shared_world_materials m ON m.id = ev.material_id
          JOIN public.shared_world_history_items i ON i.id = ev.history_item_id
         WHERE ev.id = committed.material_deleted_event_id
           AND ev.material_id = committed.material_id AND ev.world_id = committed.world_id
           AND ev.occurred_at = committed.committed_at
           AND m.world_id = committed.world_id AND m.author_user_id = committed.actor_user_id
           AND i.id = m.history_item_id AND i.availability_state = 'DELETED_BY_OWNER'
           AND NOT EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies b
                            WHERE b.material_id = committed.material_id)
           AND NOT EXISTS (SELECT 1 FROM public.shared_world_voice_note_material_bodies b
                            WHERE b.material_id = committed.material_id)
           AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_text_payloads tp
                            JOIN public.introduction_disclosure_resource_versions rv
                              ON rv.id = tp.resource_version_id
                           WHERE rv.material_id = committed.material_id)
           AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_media_payloads mp
                            JOIN public.introduction_disclosure_resource_versions rv
                              ON rv.id = mp.resource_version_id
                           WHERE rv.material_id = committed.material_id)
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'MATERIAL_DELETED'::text, committed.id, committed.world_id, committed.material_id,
                          (SELECT ev.history_item_id FROM public.shared_world_material_deleted_events ev
                            WHERE ev.id = committed.material_deleted_event_id),
                          committed.material_deleted_event_id, committed.invalidated_target_count,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_DELETE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, THE WORLD ROW FIRST, exactly as every other
  -- consequential material mutation does - which is what makes
  -- deletion-versus-grant, deletion-versus-closure, deletion-versus-commit and
  -- deletion-versus-Introduction-END serialize in a single deterministic order
  -- with no deadlock.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the World lock, so two competing
  -- deletes serialize and the loser returns the committed result.
  SELECT * INTO committed FROM public.shared_world_material_delete_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.world_id = p_world_id
       AND committed.material_id = p_material_id
       AND committed.material_deleted_event_id = p_material_deleted_event_id THEN
      RETURN QUERY SELECT 'MATERIAL_DELETED'::text, committed.id, committed.world_id, committed.material_id,
                          (SELECT ev.history_item_id FROM public.shared_world_material_deleted_events ev
                            WHERE ev.id = committed.material_deleted_event_id),
                          committed.material_deleted_event_id, committed.invalidated_target_count,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_DELETE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- A PRIVACY MUTATION IS NOT AN ORDINARY WORLD MUTATION. READ_ONLY_CLOSED does
  -- not block it (CW2-03 section 35 / C31), and this transaction never writes a
  -- lifecycle, a phase or a closure instant, so it cannot reopen anything.
  IF world.lifecycle NOT IN ('ACTIVE', 'READ_ONLY_CLOSED') THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the exact material, then its exact history
  -- item.
  SELECT * INTO owned FROM public.shared_world_materials m WHERE m.id = p_material_id FOR UPDATE;
  IF NOT FOUND OR owned.world_id <> p_world_id THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE ACTOR IS THE EXACT ORIGINAL HUMAN AUTHOR. A different human, and any
  -- human at all against QANDEEL material, reaches the same bounded answer as a
  -- caller naming material that does not exist, so this is not an ownership
  -- oracle either. Membership is never consulted: a former member, a closed
  -- World viewer and a human whose Introduction has ended all keep this
  -- authority (CW2-03 section 24 / C21).
  IF owned.producer_kind <> 'HUMAN' OR owned.author_user_id IS NULL OR owned.author_user_id <> u THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO item FROM public.shared_world_history_items i WHERE i.id = owned.history_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  -- The source must still be AVAILABLE. An already deleted or already
  -- invalidated source is not deletable a second time.
  IF item.availability_state <> 'AVAILABLE' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE TRANSITIVE SOURCE-CONTENT-BEARING CLOSURE. Deterministic, over
  -- MATERIAL_DEPENDENCY edges only: a REASONING_DEPENDENCY target is an
  -- ANALYTICAL derivative and is never erased merely because a source later
  -- disappeared (CW2-02 section 27). UNION rather than UNION ALL, and migration
  -- 0089's strict source-precedes-target rule, make the traversal terminate.
  targets := coalesce((
    WITH RECURSIVE reachable(material_id) AS (
      SELECT d.target_material_id
        FROM public.shared_world_material_dependencies d
       WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY' AND d.source_material_id = p_material_id
      UNION
      SELECT d.target_material_id
        FROM public.shared_world_material_dependencies d
        JOIN reachable step ON d.source_material_id = step.material_id
       WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY'
    )
    SELECT array_agg(r.material_id ORDER BY r.material_id) FROM reachable r
  ), ARRAY[]::uuid[]);
  -- Acyclicity is structural, so the deleted source can never be its own
  -- downstream target. Fail closed rather than mutate it twice if it ever is.
  IF p_material_id = ANY(targets) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  IF array_length(targets, 1) IS NOT NULL THEN
    -- CANONICAL LOCK ORDER, STEP 3: every reachable target, then its history
    -- item, both in deterministic identity order.
    PERFORM 1 FROM public.shared_world_materials m WHERE m.id = ANY(targets) ORDER BY m.id FOR UPDATE;
    PERFORM 1 FROM public.shared_world_history_items i
      WHERE i.id IN (SELECT m.history_item_id FROM public.shared_world_materials m WHERE m.id = ANY(targets))
      ORDER BY i.id FOR UPDATE;
    -- Only targets whose source content is still present are invalidated. One
    -- already terminal by ITS OWN owner's deletion stays exactly as it is, and
    -- one already UNAVAILABLE needs no second transition.
    SELECT array_agg(m.id ORDER BY m.id) INTO invalidating
      FROM public.shared_world_materials m
      JOIN public.shared_world_history_items i ON i.id = m.history_item_id
     WHERE m.id = ANY(targets) AND i.availability_state = 'AVAILABLE';
  END IF;
  invalidating := coalesce(invalidating, ARRAY[]::uuid[]);

  -- THE ONE canonical deletion instant.
  delete_instant := clock_timestamp();

  BEGIN
    -- PHYSICAL REMOVAL OF THE SOURCE BODY. Human text, the audio object
    -- reference and any stored transcript all go with the row: there is nothing
    -- left to reconstruct from, and nothing is copied anywhere first.
    DELETE FROM public.shared_world_text_material_bodies b WHERE b.material_id = p_material_id;
    GET DIAGNOSTICS removed = ROW_COUNT;
    DELETE FROM public.shared_world_voice_note_material_bodies b WHERE b.material_id = p_material_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    removed := removed + affected;
    IF removed <> (CASE WHEN owned.body_form = 'RESERVED' THEN 0 ELSE 1 END) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- THE ONE RESERVED BRANCH: an EXPLICIT_DISCLOSURE keeps its protected
    -- payload in the typed Introduction resource relation rather than in a
    -- 0089 body relation, so that is what is destroyed here. Exactly one
    -- payload row exists per delivered resource version - a text one or a
    -- media one, never both and never neither - and the count is asserted, so
    -- a disclosure whose payload was somehow already gone fails closed rather
    -- than reporting a deletion it did not perform. The resource version, its
    -- grant fact and its durable command all SURVIVE: audit identity remains,
    -- source content does not.
    IF owned.material_kind = 'EXPLICIT_DISCLOSURE' THEN
      DELETE FROM public.introduction_disclosure_text_payloads tp
       WHERE tp.resource_version_id IN (
         SELECT rv.id FROM public.introduction_disclosure_resource_versions rv
          WHERE rv.material_id = p_material_id);
      GET DIAGNOSTICS removed = ROW_COUNT;
      DELETE FROM public.introduction_disclosure_media_payloads mp
       WHERE mp.resource_version_id IN (
         SELECT rv.id FROM public.introduction_disclosure_resource_versions rv
          WHERE rv.material_id = p_material_id);
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF removed + affected <> 1 THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
    END IF;

    -- THE TERMINAL AVAILABILITY TRANSITION, through the frozen I-04F revision
    -- semantics. Migration 0087's trigger makes DELETED_BY_OWNER permanent.
    UPDATE public.shared_world_history_items i
       SET availability_state = 'DELETED_BY_OWNER', availability_revision = i.availability_revision + 1
     WHERE i.id = owned.history_item_id AND i.availability_state = 'AVAILABLE';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- EVERY TRANSITIVELY SOURCE-CONTENT-BEARING TARGET becomes UNAVAILABLE and
    -- loses its body. It is NOT marked DELETED_BY_OWNER: its own owner did not
    -- delete it, and that distinction is historical truth. Its envelope and its
    -- dependency identity survive.
    invalidated := 0;
    IF array_length(invalidating, 1) IS NOT NULL THEN
      DELETE FROM public.shared_world_text_material_bodies b WHERE b.material_id = ANY(invalidating);
      DELETE FROM public.shared_world_voice_note_material_bodies b WHERE b.material_id = ANY(invalidating);
      UPDATE public.shared_world_history_items i
         SET availability_state = 'UNAVAILABLE', availability_revision = i.availability_revision + 1
        FROM public.shared_world_materials m
       WHERE m.id = ANY(invalidating) AND i.id = m.history_item_id
         AND i.availability_state = 'AVAILABLE';
      GET DIAGNOSTICS invalidated = ROW_COUNT;
      IF invalidated <> array_length(invalidating, 1) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
    END IF;

    -- The canonical MATERIAL_DELETED fact, carrying identity and time only.
    INSERT INTO public.shared_world_material_deleted_events
      (id, world_id, material_id, history_item_id, occurred_at)
    VALUES (p_material_deleted_event_id, p_world_id, p_material_id, owned.history_item_id, delete_instant);

    INSERT INTO public.shared_world_material_delete_commands
      (id, world_id, material_id, actor_user_id, material_deleted_event_id,
       invalidated_target_count, committed_at)
    VALUES (p_command_id, p_world_id, p_material_id, u, p_material_deleted_event_id,
            invalidated, delete_instant);
  EXCEPTION WHEN unique_violation THEN
    -- DURABLE IDEMPOTENCY, THIRD PASS: two deletes sharing a command id while
    -- resolving to different humans serialize only here.
    SELECT * INTO committed FROM public.shared_world_material_delete_commands c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.actor_user_id = u AND committed.world_id = p_world_id
         AND committed.material_id = p_material_id
         AND committed.material_deleted_event_id = p_material_deleted_event_id THEN
        RETURN QUERY SELECT 'MATERIAL_DELETED'::text, committed.id, committed.world_id, committed.material_id,
                            (SELECT ev.history_item_id FROM public.shared_world_material_deleted_events ev
                              WHERE ev.id = committed.material_deleted_event_id),
                            committed.material_deleted_event_id, committed.invalidated_target_count,
                            committed.committed_at;
        RETURN;
      END IF;
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_DELETE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- A supplied persistence identity was already taken, or this material was
    -- already deleted under another command. The whole transaction rolls back.
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'MATERIAL_DELETED'::text, p_command_id, p_world_id, p_material_id,
                      owned.history_item_id, p_material_deleted_event_id, invalidated, delete_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 14. THE ONE NARROW INTRODUCTION DISCLOSURE READ BOUNDARY.
--
--     It does not re-decide visibility and does not re-implement it: it
--     CONSUMES the ONE canonical historical visibility entry point and
--     intersects the answer with the disclosure payloads that still exist.
--
--     What it returns is renderable disclosure and nothing else. There is
--     deliberately no row at all for a disclosure whose payload the owner
--     destroyed and no row for one this human may not see - no hidden count,
--     no placeholder, no tombstone - so a deleted or hidden disclosure
--     discloses nothing about its own existence.
--
--     It returns no authority row, no private reason, no source profile or
--     grant identity, no Matching context, no Matching Context Grant, no
--     proposal id, no private provenance and no undisclosed resource version.
--     It reads no Matching relation at all.
--
--     STABLE, SECURITY DEFINER, empty search_path, postgres-owned, and
--     executable by service_role alone - the frozen narrow-resolver precedent
--     of 0077 / 0079 / 0080 / 0087 / 0089. It opens no direct table privilege.
--
--     It works in both terminal directions without a second rule: after a
--     SUCCESS the World is ACTIVE / STANDARD and the entry point answers with
--     Standard semantics over the same history; after an END it is
--     READ_ONLY_CLOSED / INTRODUCTION and the entry point answers from the
--     frozen entitlement. Neither case is special-cased here.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_shared_world_introduction_disclosure_v1(p_world_id uuid, p_user_id uuid)
RETURNS TABLE(world_id uuid, material_id uuid, history_item_id uuid, resource_version_id uuid,
              owner_user_id uuid, resource_type text, field_key text, text_value text,
              media_object_ref text, occurred_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_world_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- The ONE canonical entry point decides visibility, including World
  -- existence, World mode and the ACTIVE / closed branch. Its bounded errors
  -- are its own and propagate unchanged, so this resolver adds no second
  -- answer to a question that entry point already owns.
  RETURN QUERY
    SELECT rv.world_id, rv.material_id, rv.history_item_id, rv.id, rv.owner_user_id,
           rv.resource_type, tp.field_key, tp.text_value, mp.media_object_ref, rv.established_at
      FROM public.resolve_shared_world_history_visibility_v1(p_world_id, p_user_id) visible
      JOIN public.introduction_disclosure_resource_versions rv
        ON rv.history_item_id = visible.history_item_id
      LEFT JOIN public.introduction_disclosure_text_payloads tp ON tp.resource_version_id = rv.id
      LEFT JOIN public.introduction_disclosure_media_payloads mp ON mp.resource_version_id = rv.id
     WHERE rv.world_id = p_world_id
       -- A disclosure whose payload the owner destroyed is not returned at all.
       AND (tp.resource_version_id IS NOT NULL OR mp.resource_version_id IS NOT NULL)
     ORDER BY rv.established_at, rv.id;
END$$;

-- ---------------------------------------------------------------------------
-- 15. Ownership and THE PRE-LAUNCH ACL.
--
--     The disclosure write boundary is executable by NO application role. The
--     ONLY grant in this migration is service_role EXECUTE on the read-only
--     disclosure resolver, which follows the frozen narrow-resolver precedent
--     and opens no direct table privilege of any kind.
--
--     The two replaced predecessor functions keep whatever ACL they already
--     carry: CREATE OR REPLACE preserves both ownership and privileges, so
--     0087's service_role EXECUTE on the entry point survives, 0088's reader
--     stays executable by nobody, and 0090's deletion primitive stays
--     executable by nobody. Nothing here widens any of them.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.commit_introduction_progressive_disclosure_v1(uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.resolve_shared_world_introduction_disclosure_v1(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.commit_introduction_progressive_disclosure_v1(uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_introduction_disclosure_prerequisites_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_shared_world_introduction_disclosure_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_introduction_progressive_disclosure_v1(uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.resolve_introduction_disclosure_prerequisites_v1(uuid) FROM service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.resolve_shared_world_introduction_disclosure_v1(uuid, uuid) TO service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 16. Terminal self-assertions. The migration refuses to deploy a disclosure
--     surface that is application-reachable, policy-bearing, blobbed,
--     counterpart-routable, reciprocal, Matching-coupled, ungated, multi-
--     clocked, lock-disordered or Standard-regressing, so drift cannot pass
--     silently.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  disclose_fn text := 'public.commit_introduction_progressive_disclosure_v1(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text)';
  resolve_fn text := 'public.resolve_shared_world_introduction_disclosure_v1(uuid,uuid)';
  entry_fn text := 'public.resolve_shared_world_history_visibility_v1(uuid,uuid)';
  closed_fn text := 'public.resolve_shared_world_closed_history_visibility_v1(uuid,uuid)';
  delete_fn text := 'public.delete_shared_world_owned_material_v1(uuid,uuid,uuid,uuid)';
  gate_fn text := 'public.resolve_introduction_disclosure_prerequisites_v1(uuid)';
  own_tables text[] := ARRAY['public.introduction_disclosure_resource_versions',
                             'public.introduction_disclosure_text_payloads',
                             'public.introduction_disclosure_media_payloads',
                             'public.introduction_disclosure_granted_events',
                             'public.introduction_disclosure_commands',
                             'public.introduction_closed_view_entitlements',
                             'public.introduction_closed_view_entitlement_items'];
  p record;
  in_names text[];
  in_types text[];
  out_names text[];
  arg_name text;
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
  body text;
  world_pos integer;
  record_pos integer;
  gate_pos integer;
  clock_pos integer;
  write_pos integer;
BEGIN
  -- ===================================================================
  -- THE SEVEN NEW RELATIONS: unreachable, policy-free, blob-free,
  -- role-free, and within the PostgreSQL identifier limit.
  -- ===================================================================
  FOREACH target_table IN ARRAY own_tables LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN RAISE EXCEPTION 'I-07D: row level security must be enabled on %', target_table; END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-07D: no RLS policy may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = target_table::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-07D: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-07D: the disclosure substrate stays sealed: % holds % on %',
              target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
    IF length(split_part(target_table, '.', 2)) > 63 THEN
      RAISE EXCEPTION 'I-07D: relation name % exceeds the PostgreSQL 63-byte identifier limit', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint con
                WHERE con.conrelid = target_table::regclass AND length(con.conname) > 63) THEN
      RAISE EXCEPTION 'I-07D: a constraint name on % exceeds the PostgreSQL 63-byte identifier limit', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class idx JOIN pg_index ix ON ix.indexrelid = idx.oid
                WHERE ix.indrelid = target_table::regclass AND length(idx.relname) > 63) THEN
      RAISE EXCEPTION 'I-07D: an index name on % exceeds the PostgreSQL 63-byte identifier limit', target_table;
    END IF;
  END LOOP;

  -- NO JSON, NO ARRAY, NO BINARY PAYLOAD, and no superior participant
  -- authority column, anywhere in the seven relations. `owner_user_id` is
  -- authorship of a disclosed resource, and is named so it cannot be confused
  -- with a World ownership role.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND ('public.' || c.table_name) = ANY(own_tables)
       AND c.data_type IN ('json','jsonb','ARRAY','bytea')
  ) THEN
    RAISE EXCEPTION 'I-07D: a disclosure payload is a normalized bounded relation, never a universal JSON or binary blob';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND ('public.' || c.table_name) = ANY(own_tables)
       AND c.column_name ~* '(admin|moderator|inviter|creator|initiator|privilege|capability|permission|entitlement_kind|safety|launch|score|rank|relationship|engagement|marriage|exclusiv)'
  ) THEN
    RAISE EXCEPTION 'I-07D: disclosure authority is the exact owner, never a role, a ranking or a relationship status';
  END IF;
  -- NO RECIPROCAL OR REUSABLE PERMISSION OBJECT. A disclosure is one delivered
  -- resource version, and nothing here may represent a standing permission, a
  -- pending suggestion or a reciprocal bundle.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND ('public.' || c.table_name) = ANY(own_tables)
       AND c.column_name ~* '(reciprocal|mutual_disclosure|standing|pending|suggestion|suggested|reusable|revoked|withdrawn)'
  ) THEN
    RAISE EXCEPTION 'I-07D: a disclosure is one atomic delivery, never a standing, pending, suggested or reciprocal permission';
  END IF;

  -- ===================================================================
  -- THE DISCLOSURE WRITE BOUNDARY.
  -- ===================================================================
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pr.proargnames, pr.proargmodes,
         pr.proargtypes, pg_get_userbyid(pr.proowner) AS owner
    INTO p FROM pg_proc pr WHERE pr.oid = disclose_fn::regprocedure;
  IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-07D: % must be owned by postgres', disclose_fn; END IF;
  IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-07D: % must be SECURITY DEFINER', disclose_fn; END IF;
  IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-07D: % mutates and must be VOLATILE', disclose_fn; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-07D: % must pin an empty search_path', disclose_fn;
  END IF;
  -- Argument NAMES from proargnames / proargmodes and TYPES from proargtypes: a
  -- rendered signature folds this function's RETURNS TABLE columns into the same
  -- string, so it is never the authority for a parameter ban.
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
         array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
    INTO in_names, out_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id','p_world_id','p_resource_version_id','p_material_id',
                       'p_history_item_id','p_disclosure_granted_event_id','p_resource_type',
                       'p_field_key','p_text_value','p_media_object_ref'] THEN
    RAISE EXCEPTION 'I-07D: the disclosure command must accept exactly the frozen v1 surface, not %', in_names;
  END IF;
  SELECT array_agg(t.typname::text ORDER BY a.ord) INTO in_types
    FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
    JOIN pg_type t ON t.oid = a.argtype;
  IF in_types <> ARRAY['uuid','uuid','uuid','uuid','uuid','uuid','text','text','text','text'] THEN
    RAISE EXCEPTION 'I-07D: the disclosure command must accept six opaque identities and four bounded texts, not %', in_types;
  END IF;
  -- NO COUNTERPART PARAMETER, NO OWNER PARAMETER, NO ACTOR, NO AUDIENCE, NO
  -- CLOCK. The ban is non-vacuous by construction: the exact list above proves
  -- these really are the parameter names being scanned.
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'counterpart|recipient|audience|viewer|owner|actor|user_id|human|subject|grantee|on_behalf|approver|episode|authority|grant|count|timestamp|instant|_at$|clock|launch|gate' THEN
      RAISE EXCEPTION 'I-07D: the disclosure command must not accept %: the owner is auth.uid() and the counterpart is derived', arg_name;
    END IF;
  END LOOP;
  body := p.prosrc;
  IF body !~ 'u uuid := auth\.uid\(\);' THEN
    RAISE EXCEPTION 'I-07D: the disclosing owner must be derived from the session subject, never supplied';
  END IF;
  -- THE COUNTERPART IS DERIVED FROM THE EXACT INTRODUCTION IDENTITY.
  IF body !~ 'counterpart := CASE WHEN u = record_row\.lower_user_id' THEN
    RAISE EXCEPTION 'I-07D: the counterpart must be derived from the exact Introduction Record, never supplied or searched for';
  END IF;
  -- ONE database-owned instant, read once, AFTER every lock wait.
  IF body ~ 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
    RAISE EXCEPTION 'I-07D: % must persist one database-owned instant, never a transaction clock', disclose_fn;
  END IF;
  IF (length(body) - length(replace(body, 'clock_timestamp()', ''))) / length('clock_timestamp()') <> 1 THEN
    RAISE EXCEPTION 'I-07D: % must read the canonical instant exactly once', disclose_fn;
  END IF;
  -- THE PUBLISHED LOCK ORDER: World, then the exact Introduction Record, then
  -- the gate, then the one instant, then the writes.
  world_pos := strpos(body, 'FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE');
  record_pos := strpos(body, 'WHERE r.world_id = p_world_id FOR UPDATE');
  gate_pos := strpos(body, 'resolve_introduction_disclosure_prerequisites_v1');
  clock_pos := strpos(body, 'disclose_at := clock_timestamp()');
  write_pos := strpos(body, 'INSERT INTO public.shared_world_history_items');
  IF world_pos = 0 OR record_pos = 0 OR gate_pos = 0 OR clock_pos = 0 OR write_pos = 0
     OR world_pos > record_pos OR record_pos > gate_pos OR gate_pos > clock_pos OR clock_pos > write_pos THEN
    RAISE EXCEPTION 'I-07D: the disclosure lock order is World, then the exact Introduction Record, then the gate, then one instant, then the writes';
  END IF;
  -- PROGRESSIVE DISCLOSURE IS SHARED-WORLD-LOCAL. It must not acquire a
  -- Matching setup lock merely because the World was born from Matching, and
  -- it must not read or mutate Matching operational state at all.
  IF body ~ 'matching_setup_locks|pg_advisory|LOCK TABLE' THEN
    RAISE EXCEPTION 'I-07D: disclosure is World-local: no Matching setup lock, no advisory lock and no table lock';
  END IF;
  IF body ~ 'matching_context_grants|pre_match_disclosure|matching_proposal|matching_recipient|matching_private|matching_participation|matching_match_handoff|matching_eligibility' THEN
    RAISE EXCEPTION 'I-07D: no Matching authority, proposal, private reasoning or participation state may cross into Shared disclosure';
  END IF;
  -- IT PRODUCES EXACTLY THE RESERVED KIND, and never a Standing Context Grant,
  -- a membership episode, a World lifecycle change or a second history model.
  IF body !~ '''EXPLICIT_DISCLOSURE'', ''HUMAN'', ''RESERVED''' THEN
    RAISE EXCEPTION 'I-07D: the disclosure producer must write exactly the reserved EXPLICIT_DISCLOSURE / HUMAN / RESERVED envelope';
  END IF;
  IF body ~ 'shared_world_standing_context_grants|INSERT INTO public\.shared_world_membership_episodes|UPDATE public\.shared_world_membership_episodes|UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds' THEN
    RAISE EXCEPTION 'I-07D: a disclosure manufactures no Standing Context Grant, no membership and no World lifecycle change';
  END IF;
  IF body ~ 'DELETE FROM|TRUNCATE' THEN
    RAISE EXCEPTION 'I-07D: a disclosure destroys nothing: owner deletion is the only privacy mutation';
  END IF;
  -- THE BOUNDED RESULT: no counterpart identity, no authority, no private state.
  IF out_names <> ARRAY['outcome','command_id','disclosed_world_id','disclosed_resource_version_id',
                        'disclosed_material_id','disclosed_history_item_id','disclosed_resource_type',
                        'disclosed_at'] THEN
    RAISE EXCEPTION 'I-07D: the disclosure command must return exactly the bounded committed result, not %', out_names;
  END IF;
  FOREACH arg_name IN ARRAY out_names LOOP
    IF arg_name ~* 'counterpart|recipient|audience|viewer|owner|user_id|reason|private|provenance|grant|claim|proposal|score|rank|relationship' THEN
      RAISE EXCEPTION 'I-07D: the disclosure command must not return %', arg_name;
    END IF;
  END LOOP;
  -- THE PRE-LAUNCH SECURITY BOUNDARY, asserted rather than commented.
  IF has_function_privilege('public', disclose_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-07D: PUBLIC must not execute the disclosure command before the launch gate exists';
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
       AND has_function_privilege(target_role, disclose_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-07D: % must not execute the disclosure command before the launch gate exists', target_role;
    END IF;
  END LOOP;

  -- ===================================================================
  -- THE FAIL-CLOSED SEAM: it answers NOT_EVALUATED and nothing else.
  -- ===================================================================
  SELECT pr.prosrc, pr.provolatile INTO p FROM pg_proc pr WHERE pr.oid = gate_fn::regprocedure;
  IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-07D: the disclosure prerequisite seam must be STABLE'; END IF;
  IF p.prosrc ~ '''CLEARED''' THEN
    RAISE EXCEPTION 'I-07D: the disclosure prerequisite seam must never answer CLEARED before CW2-08 exists';
  END IF;
  IF p.prosrc !~ '''NOT_EVALUATED''' THEN
    RAISE EXCEPTION 'I-07D: the disclosure prerequisite seam must answer NOT_EVALUATED';
  END IF;
  IF has_function_privilege('public', gate_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-07D: PUBLIC must not execute the disclosure prerequisite seam';
  END IF;

  -- ===================================================================
  -- THE ONE ENTRY POINT: Introduction is supported, Standard is preserved.
  -- ===================================================================
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
    INTO p FROM pg_proc pr WHERE pr.oid = entry_fn::regprocedure;
  IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-07D: the visibility entry point must stay owned by postgres'; END IF;
  IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-07D: the visibility entry point must stay SECURITY DEFINER'; END IF;
  IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-07D: the visibility entry point must stay STABLE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-07D: the visibility entry point must keep an empty search_path';
  END IF;
  IF p.prosrc ~* 'INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt' THEN
    RAISE EXCEPTION 'I-07D: the visibility entry point must mutate nothing, lock nothing and trust no client claim';
  END IF;
  -- THE FROZEN I-04F GUARANTEES, still proven on the live body.
  IF p.prosrc !~ 'i\.availability_state = ''AVAILABLE''' THEN
    RAISE EXCEPTION 'I-07D: availability must still dominate every visibility mode';
  END IF;
  IF p.prosrc !~ 'i\.occurred_at >= e\.joined_at' OR p.prosrc !~ 'e\.ended_at IS NULL OR i\.occurred_at <= e\.ended_at' THEN
    RAISE EXCEPTION 'I-07D: membership-period visibility must still use truthful temporal bounds';
  END IF;
  IF p.prosrc !~ 'shared_world_history_item_baseline_viewers' THEN
    RAISE EXCEPTION 'I-07D: a membership interval alone is still never historical visibility';
  END IF;
  IF p.prosrc !~ 'resolve_shared_world_closed_history_visibility_v1' THEN
    RAISE EXCEPTION 'I-07D: closed viewing must still delegate to the exact closure entitlement snapshot';
  END IF;
  -- THE STANDARD GRANT BASIS SURVIVES, and the Introduction branch does NOT
  -- have it: two occurrences of the baseline predicate, ONE of the grant join.
  IF (length(p.prosrc) - length(replace(p.prosrc, 'shared_world_history_package_manifest_items', '')))
     / length('shared_world_history_package_manifest_items') <> 1 THEN
    RAISE EXCEPTION 'I-07D: the explicit history-grant basis belongs to STANDARD alone, exactly once';
  END IF;
  IF p.prosrc !~ 'world\.phase = ''INTRODUCTION''' THEN
    RAISE EXCEPTION 'I-07D: the ONE entry point must carry the reviewed Introduction branch';
  END IF;
  IF p.prosrc !~ 'SHARED_WORLD_HISTORY_VISIBILITY_UNSUPPORTED_WORLD_MODE' THEN
    RAISE EXCEPTION 'I-07D: an unspelled World mode must still be refused rather than given Standard semantics';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role', entry_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-07D: service_role must still execute the ONE historical visibility entry point';
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
       AND has_function_privilege(target_role, entry_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-07D: % must not execute the visibility entry point', target_role;
    END IF;
  END LOOP;

  -- ===================================================================
  -- THE CLOSED READER: two exact branches, still internal to everybody.
  -- ===================================================================
  SELECT pr.prosecdef, pr.provolatile, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
    INTO p FROM pg_proc pr WHERE pr.oid = closed_fn::regprocedure;
  IF p.owner <> 'postgres' OR NOT p.prosecdef OR p.provolatile <> 's' THEN
    RAISE EXCEPTION 'I-07D: the closed reader must stay a postgres-owned STABLE SECURITY DEFINER';
  END IF;
  IF p.prosrc !~ 'shared_world_standard_closed_view_entitlement_items' THEN
    RAISE EXCEPTION 'I-07D: the Standard closed branch must be preserved exactly';
  END IF;
  IF p.prosrc !~ 'introduction_closed_view_entitlement_items' THEN
    RAISE EXCEPTION 'I-07D: the closed reader must carry the reviewed Introduction branch';
  END IF;
  IF p.prosrc ~ 'shared_world_membership_episodes' THEN
    RAISE EXCEPTION 'I-07D: closed viewing is entitlement, never active membership, in either mode';
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
       AND has_function_privilege(target_role, closed_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-07D: % must not execute the internal closed reader: there is ONE entry point', target_role;
    END IF;
  END LOOP;

  -- ===================================================================
  -- OWNER DELETION: exactly one new branch, and it names the exact kind.
  -- ===================================================================
  SELECT pr.prosrc, pr.provolatile INTO p FROM pg_proc pr WHERE pr.oid = delete_fn::regprocedure;
  IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-07D: owner deletion must stay VOLATILE'; END IF;
  IF p.prosrc !~ 'u uuid := auth\.uid\(\);' THEN
    RAISE EXCEPTION 'I-07D: owner deletion must still derive its human from auth.uid()';
  END IF;
  IF p.prosrc ~ 'SET lifecycle|SET phase|SET closed_at' THEN
    RAISE EXCEPTION 'I-07D: a privacy material mutation still never reopens or changes World lifecycle';
  END IF;
  IF p.prosrc !~ 'owned\.material_kind = ''EXPLICIT_DISCLOSURE''' THEN
    RAISE EXCEPTION 'I-07D: the new owner-deletion branch must name the exact reserved kind, never a guessed one';
  END IF;
  IF p.prosrc ~ 'WORLD_EVENT_DERIVED_MATERIAL' THEN
    RAISE EXCEPTION 'I-07D: no OTHER reserved material kind becomes deletable through guessed semantics';
  END IF;
  -- EVERY DELETE it issues still targets a BODY or a disclosure PAYLOAD, and
  -- nothing else: no envelope, history item, audience, approver, dependency,
  -- grant, entitlement, episode, resource version or event is ever removed.
  IF EXISTS (
    SELECT 1 FROM regexp_matches(p.prosrc, 'DELETE FROM public\.(\w+)', 'g') AS m(parts)
     WHERE m.parts[1] <> ALL (ARRAY['shared_world_text_material_bodies',
                                    'shared_world_voice_note_material_bodies',
                                    'introduction_disclosure_text_payloads',
                                    'introduction_disclosure_media_payloads'])
  ) THEN
    RAISE EXCEPTION 'I-07D: every DELETE owner deletion issues must target a material body or a disclosure payload, and nothing else';
  END IF;
  IF p.prosrc ~ 'DELETE FROM public\.introduction_disclosure_resource_versions'
     OR p.prosrc ~ 'DELETE FROM public\.introduction_disclosure_granted_events' THEN
    RAISE EXCEPTION 'I-07D: the resource version and its grant fact survive owner deletion as non-content audit identity';
  END IF;

  -- ===================================================================
  -- THE DISCLOSURE READ RESOLVER: composed, bounded, service-role only.
  -- ===================================================================
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pr.proargnames, pr.proargmodes,
         pg_get_userbyid(pr.proowner) AS owner
    INTO p FROM pg_proc pr WHERE pr.oid = resolve_fn::regprocedure;
  IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-07D: % must be owned by postgres', resolve_fn; END IF;
  IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-07D: % must be SECURITY DEFINER', resolve_fn; END IF;
  IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-07D: % is a read boundary and must be STABLE', resolve_fn; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-07D: % must pin an empty search_path', resolve_fn;
  END IF;
  IF p.prosrc ~* 'INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt' THEN
    RAISE EXCEPTION 'I-07D: % mutates nothing, locks nothing and trusts no client claim', resolve_fn;
  END IF;
  IF p.prosrc !~ 'public\.resolve_shared_world_history_visibility_v1\(p_world_id, p_user_id\)' THEN
    RAISE EXCEPTION 'I-07D: % must consume the ONE canonical visibility entry point, never re-implement it', resolve_fn;
  END IF;
  IF p.prosrc ~ 'matching_|introduction_records|introduction_disclosure_commands|shared_world_material_dependencies|shared_world_history_item_required_approvers|shared_world_membership_episodes' THEN
    RAISE EXCEPTION 'I-07D: % must disclose no Matching state, no command history, no provenance, no authority and no membership', resolve_fn;
  END IF;
  IF p.prosrc ~* 'count\(|hidden|placeholder|tombstone|redacted|UNION' THEN
    RAISE EXCEPTION 'I-07D: a hidden or deleted disclosure must produce no row, no count and no placeholder';
  END IF;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
         array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
    INTO in_names, out_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_world_id','p_user_id'] THEN
    RAISE EXCEPTION 'I-07D: % must accept exactly the exact World and the exact human, not %', resolve_fn, in_names;
  END IF;
  IF out_names <> ARRAY['world_id','material_id','history_item_id','resource_version_id','owner_user_id',
                        'resource_type','field_key','text_value','media_object_ref','occurred_at'] THEN
    RAISE EXCEPTION 'I-07D: % must return exactly the bounded renderable disclosure, not %', resolve_fn, out_names;
  END IF;
  IF has_function_privilege('public', resolve_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-07D: PUBLIC must not execute the disclosure resolver';
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
       AND has_function_privilege(target_role, resolve_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-07D: % must not execute the disclosure resolver', target_role;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role', resolve_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-07D: service_role must execute the ONE narrow disclosure resolver';
  END IF;

  -- ===================================================================
  -- EXACTLY ONE LIVE PRODUCER OF THE RESERVED MATERIAL KIND.
  -- ===================================================================
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ '''EXPLICIT_DISCLOSURE''' AND pr.prosrc ~ 'INSERT INTO public\.shared_world_materials') <> 1 THEN
    RAISE EXCEPTION 'I-07D: exactly one reviewed producer may write an EXPLICIT_DISCLOSURE material';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
                  WHERE n.nspname = 'public' AND pr.proname = 'commit_introduction_progressive_disclosure_v1'
                    AND pr.prosrc ~ '''EXPLICIT_DISCLOSURE''') THEN
    RAISE EXCEPTION 'I-07D: and that one producer is the reviewed Introduction disclosure command';
  END IF;
  -- The reserved kind keeps its reserved body form: this slice adds a producer,
  -- it does not relax the 0089 envelope.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.shared_world_materials'::regclass
       AND c.conname = 'shared_world_materials_body_form_check'
       AND pg_get_constraintdef(c.oid) ~ 'EXPLICIT_DISCLOSURE.{0,120}RESERVED'
  ) THEN
    RAISE EXCEPTION 'I-07D: EXPLICIT_DISCLOSURE must keep its frozen RESERVED body form';
  END IF;

  -- ===================================================================
  -- NO RELATIONSHIP, ENGAGEMENT, EXCLUSIVITY OR MARRIAGE INFERENCE, anywhere
  -- in this migration's own vocabulary.
  -- ===================================================================
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = ANY (ARRAY(SELECT x.name::regclass::oid FROM unnest(own_tables) AS x(name)))
       AND pg_get_constraintdef(c.oid) ~* '(relationship|engagement|marriage|married|fiance|exclusiv|boyfriend|girlfriend|partner_status)'
  ) THEN
    RAISE EXCEPTION 'I-07D: no disclosure vocabulary may encode a relationship, engagement, exclusivity or marriage claim';
  END IF;
END$$;

COMMIT;
