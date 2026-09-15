-- I-04F - Selective Historical Access v1 (PART A).
--
-- Two frozen Shared laws are still missing from persistence after I-04E. This
-- migration implements the first of them:
--
--   membership != historical access
--
-- CW2-01 A9 / A25, CW2-02 B21 / B22 and CW2-03 sections 19-22 and 29 freeze that
-- a new member defaults to FROM_JOIN_FORWARD, that past access is a separate
-- explicit authority object, and that the authority to expose old history derives
-- from the EXACT included material rather than from World membership. Migration
-- 0088 implements the second law - unanimous Standard archival closure - and the
-- two ship, review and test together as one I-04F slice.
--
-- ===========================================================================
-- A HISTORY-VISIBILITY PROJECTION, NOT A MATERIAL ENGINE
-- ===========================================================================
--
-- I-04G has not yet created Shared text / voice / QANDEEL material persistence.
-- But historical visibility, original audience, material-authority requirements,
-- availability, package manifests, grants and closure entitlements all need an
-- exact thing to bind to. So this slice creates the MINIMAL projection that can
-- answer authority and visibility questions, and nothing else:
--
--   public.shared_world_history_items
--
-- An opaque history-visible item identity carrying only: which World, when it
-- occurred, how its human material authority is expressed, whether its source is
-- still available, and at which availability revision. There is deliberately NO
-- message text, transcript, audio, analysis body, generic JSON payload,
-- provenance payload, content blob, model context, Replay body or Public
-- material anywhere in this migration, and no column that could hold one. I-04G
-- will later bind actual Shared material and event persistence to this item
-- identity atomically; that is the whole reason the identity exists now.
--
-- This slice also deliberately implements NO application writer for the
-- projection. There is no material commit runtime and no owner-delete command
-- here: the reviewed real writer belongs to I-04G. The three relations that
-- describe an item - the item, its exact baseline human audience and its exact
-- required human material authorities - are postgres-owned, RLS-enabled, policy
-- free and reachable by no application role at all, and the real-PostgreSQL
-- verifier seeds and mutates them as the database owner to prove semantics.
--
-- ===========================================================================
-- AUTHORITY METADATA IS EXACT, OR IT FAILS CLOSED
-- ===========================================================================
--
-- An empty required-approver relation must never ambiguously mean EITHER "no
-- human approval is needed" OR "authority metadata is missing". So the item
-- carries the meaning explicitly, in exactly two writer vocabularies:
--
--   EXACT_HUMAN_APPROVER_SET     >= 1 item-level required approver must exist
--   NO_HUMAN_APPROVAL_REQUIRED   exactly 0 item-level required approvers exist
--
-- Both directions are validated at preparation AND re-validated at grant commit,
-- and a contradiction is refused rather than interpreted. A package may derive a
-- zero required-approver set ONLY when every included item explicitly says
-- NO_HUMAN_APPROVAL_REQUIRED. Missing authority metadata is never approval-free
-- (CW2-02 B4: UNKNOWN fails closed).
--
-- ===========================================================================
-- WHAT occurred_at MEANS, FROZEN
-- ===========================================================================
--
-- shared_world_history_items.occurred_at is THE CANONICAL SHARED-WORLD
-- ESTABLISHMENT / COMMIT INSTANT OF THIS HISTORY ITEM: the moment the item became
-- Shared truth in this exact World. That is the only reading under which
-- comparing it against a human's membership episode is correct, and this slice
-- compares it against exactly that.
--
-- It is NOT an underlying recalled event time, a source-event semantic timestamp
-- or a provenance event time. Those belong to I-04G material / provenance and
-- must never be written here. The distinction is load-bearing rather than
-- cosmetic:
--
--   at t2, while B is a member, A says "last week at t1 I changed jobs"
--
-- The history item is established at t2 and B really did receive it. Storing t1
-- here would hide from B a statement B actually received, by making the item look
-- as though it predated B's membership. A later slice that needs t1 adds its own
-- column for it; it does not reinterpret this one.
--
-- ===========================================================================
-- BASELINE VISIBILITY IS NOT "WAS A MEMBER"
-- ===========================================================================
--
-- A membership interval alone cannot reconstruct historical visibility: Shared
-- material may have had a narrower authorized audience than the whole World, and
-- rejoin and closure must not turn "was a member at the time" into "could see
-- everything that existed at the time". So the ordinary historical-membership
-- basis is the CONJUNCTION
--
--   membership interval  AND  baseline viewer membership
--
-- over the item's exact original human audience. There is no generic audience
-- JSON and no inferred all-members shortcut. I-04G will populate this exact
-- baseline audience from canonical audience state when it creates real material.
--
-- ===========================================================================
-- THE MANIFEST IS THE EXACT ITEM SET, BOUND TO THE EXACT GRANTEE EPISODE
-- ===========================================================================
--
-- Selective history is exact-package authority (CW2-02 sections 29 and 37,
-- CW2-03 section 21). A manifest version is immutable, holds a normalized exact
-- item set rather than a JSON blob or a predicate language, captures each item's
-- exact availability revision, and binds the grantee's EXACT OPEN EPISODE at
-- preparation time. That episode binding is what makes
--
--   prepare under episode E1 -> grantee leaves -> grantee rejoins under E2
--
-- fail rather than revive: a fresh episode requires a fresh manifest, exactly as
-- CW2-02 section 34 binds governance approval to an exact membership snapshot.
-- Changing the package content is a NEW manifest with NEWLY collected approvals;
-- old approvals can never authorize changed content.
--
-- Preparation is not authority and reserves nothing (CW2-02 section 9 / B8).
-- Current canonical state is revalidated at approval and again at grant commit.
--
-- ===========================================================================
-- MATERIAL AUTHORITY SURVIVES MEMBERSHIP LOSS
-- ===========================================================================
--
-- CW2-03 section 24 / C21 freezes that losing World access does not erase
-- authority over one's own material. So the approval primitive deliberately does
-- NOT require the approver to be a current World member: it requires only that
-- they are in the exact derived required-approver set. Approving does not restore
-- World browsing either - the approval writes no membership episode, and the
-- visibility resolver still requires a currently open episode before it returns
-- anything at all for an ACTIVE World.
--
-- ===========================================================================
-- NO WITHDRAWAL SEMANTICS
-- ===========================================================================
--
-- CW2-02 section 32 and CW2-03 section 50 explicitly DEFER "History Access Grant
-- withdrawal after already viewed" to later Shared domain policy. This slice
-- therefore invents no revoke, expire, rescind, retroactive erasure or policy
-- status lifecycle: a committed grant has no mutable status column at all, so a
-- future reviewed withdrawal contract can be added without rewriting this
-- history. What DOES narrow visibility today is source availability, which is
-- owner authority rather than grant policy.
--
-- ===========================================================================
-- THE ONE VISIBILITY RESOLVER AND ITS CLOSED BRANCH
-- ===========================================================================
--
-- public.resolve_shared_world_history_visibility_v1 is the single narrow
-- server-only entry point for "what history may this exact human see in this
-- exact Shared World". It returns history item IDENTITY and TIME only, never
-- content, and never a hidden count, name or placeholder (CW2-03 section 20 /
-- C16). It follows the frozen I-03 narrow resolver precedent of migrations 0077,
-- 0079 and 0080: SECURITY DEFINER, STABLE, empty search_path, service_role-only
-- EXECUTE, direct tables still sealed.
--
-- Its READ_ONLY_CLOSED / STANDARD branch delegates to
-- public.resolve_shared_world_closed_history_visibility_v1, because the closed
-- view is the exact entitlement snapshot migration 0088 OWNS - this migration
-- neither creates that snapshot nor guesses its shape. The delegation is inert
-- until 0088 is applied: no reviewed writer in migrations 0001-0087 can produce a
-- READ_ONLY_CLOSED Shared World, so the branch is unreachable before the closure
-- slice that implements it exists, and the two migrations deploy together.
--
-- ===========================================================================
-- THE PRE-LAUNCH SECURITY BOUNDARY, THE LOCK ORDER AND THE ONE INSTANT
-- ===========================================================================
--
-- As in 0082, 0083, 0084, 0085 and 0086: all three consequential primitives are
-- fully implemented and executable by NO application role, because the Connected
-- Worlds launch gate does not exist yet. The only GRANT in this migration is
-- service_role EXECUTE on the read-only visibility resolver. Every consequential
-- mutation takes the exact World row FIRST and then, where it needs them, the
-- manifest and the exact selected history items in deterministic UUID identity
-- order - no advisory lock, no table lock, no process-local mutex - so the whole
-- Shared mutation domain keeps one lock hierarchy and a future I-04G owner
-- availability writer can follow World first -> exact history item. One
-- database-owned instant is read once per committed transaction and reused for
-- every moment it persists; no client timestamp is accepted anywhere.
--
-- ===========================================================================
-- What this slice deliberately does NOT do
-- ===========================================================================
--
-- It creates and closes no World, opens and closes no membership episode,
-- terminalizes no member invitation, touches no Standing Context Grant, audience
-- ceiling or consent history, reads no Personal context, alters no predecessor
-- table, adds no route, controller, RPC, mobile surface, Launch Gate, feature
-- flag, entitlement policy or safety / moderation policy, and mutates no
-- Personal, Public, Replay, Matching or Introduction state. Every historical
-- migration, 0001-0086 included, is untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE HISTORY-VISIBILITY PROJECTION.
--
--    Identity, World and time are immutable; availability is the only
--    future-evolvable state represented here. There is no content column of any
--    kind, and no author, owner, admin or role column: material authority is the
--    exact required-approver relation below, never a single superior principal.
--
--    occurred_at is the canonical Shared-World ESTABLISHMENT / COMMIT instant of
--    the item, never an underlying recalled or source event time - see the frozen
--    note above, and the deployed COMMENT ON COLUMN that carries it into the
--    catalog where a later slice will actually read it.
--
--    UNIQUE (world_id, id) exists for exactly one reason: it lets every consumer
--    of an item - the manifest items here, and the closed-view entitlement items
--    migration 0088 adds - carry a COMPOSITE foreign key, which turns "this item
--    really belongs to this exact World" from a procedural check into a
--    structural one.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_history_items (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    authority_requirement_mode text NOT NULL,
    availability_state text NOT NULL,
    availability_revision bigint NOT NULL,
    registered_at timestamptz NOT NULL,
    CONSTRAINT shared_world_history_items_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_history_items_world_item_key UNIQUE (world_id, id),
    -- Exactly two writer meanings, so an empty approver relation is never ambiguous.
    CONSTRAINT shared_world_history_items_authority_mode_check
        CHECK (authority_requirement_mode IN ('EXACT_HUMAN_APPROVER_SET', 'NO_HUMAN_APPROVAL_REQUIRED')),
    -- The canonical availability vocabulary, in exact parity with the merged
    -- I-01A kernel (apps/api/src/connected-worlds/kernel/material.types.ts
    -- CONTENT_AVAILABILITIES) and CW2-01 section 25 / CW2-03 section 37.
    CONSTRAINT shared_world_history_items_availability_check
        CHECK (availability_state IN ('AVAILABLE', 'DELETED_BY_OWNER', 'UNAVAILABLE')),
    CONSTRAINT shared_world_history_items_revision_check
        CHECK (availability_revision > 0),
    CONSTRAINT shared_world_history_items_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT
);

-- The one frozen access pattern: a World's history in time order. Nothing speculative.
CREATE INDEX shared_world_history_items_world_time_idx
    ON public.shared_world_history_items (world_id, occurred_at);

-- The frozen meaning of occurred_at, deployed into the catalog rather than left in
-- a comment only, so the slice that later writes this column reads the rule where
-- it works instead of where it was once documented.
COMMENT ON COLUMN public.shared_world_history_items.occurred_at IS
  'The canonical Shared-World establishment/commit instant of this history item: '
  'the moment it became Shared truth in this exact World, and the only instant '
  'history visibility compares against a membership episode. NOT an underlying '
  'recalled event time, source-event semantic timestamp or provenance event time '
  '- those belong to I-04G material/provenance and must never be written here.';

-- ---------------------------------------------------------------------------
-- 2. THE EXACT ORIGINAL HUMAN AUDIENCE OF ONE HISTORY ITEM.
--
--    The humans who actually possessed visibility of this item when it became
--    Shared truth. The primary key IS the membership, so one item can never name
--    one human twice.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_history_item_baseline_viewers (
    history_item_id uuid NOT NULL,
    user_id uuid NOT NULL,
    CONSTRAINT shared_world_history_item_baseline_viewers_pk
        PRIMARY KEY (history_item_id, user_id),
    CONSTRAINT shared_world_history_item_baseline_viewers_item_fk
        FOREIGN KEY (history_item_id) REFERENCES public.shared_world_history_items (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_history_item_baseline_viewers_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

CREATE INDEX shared_world_history_item_baseline_viewers_user_idx
    ON public.shared_world_history_item_baseline_viewers (user_id);

-- ---------------------------------------------------------------------------
-- 3. THE EXACT HUMAN MATERIAL AUTHORITIES OF ONE HISTORY ITEM.
--
--    Whose approval is required to expose this exact item as selective old
--    history. Membership is not enough; one item may require several humans; and
--    QANDEEL is never here, because a system actor is never a consent provider
--    (CW2-01 section 7 / A3). These rows are immutable historical authority
--    metadata - no caller supplies them and no primitive in this migration
--    writes them. I-04G derives and binds them when it creates real material.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_history_item_required_approvers (
    history_item_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    CONSTRAINT shared_world_history_item_required_approvers_pk
        PRIMARY KEY (history_item_id, approver_user_id),
    CONSTRAINT shared_world_history_item_required_approvers_item_fk
        FOREIGN KEY (history_item_id) REFERENCES public.shared_world_history_items (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_history_item_required_approvers_user_fk
        FOREIGN KEY (approver_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 4. THE IMMUTABLE HISTORY PACKAGE MANIFEST VERSION.
--
--    One exact grantee, in one exact World, under one exact OPEN membership
--    episode. The two extra unique bindings are not redundancy: they are what
--    let the manifest items bind (manifest, World) and the committed grant bind
--    (manifest, World, grantee, episode) structurally rather than procedurally.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_history_package_manifest_versions (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    grantee_user_id uuid NOT NULL,
    grantee_membership_episode_id uuid NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT shared_world_history_package_manifest_versions_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_history_package_manifest_versions_world_key UNIQUE (id, world_id),
    CONSTRAINT shared_world_history_package_manifest_versions_grantee_key
        UNIQUE (id, world_id, grantee_user_id, grantee_membership_episode_id),
    CONSTRAINT shared_world_history_package_manifest_versions_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_history_package_manifest_versions_grantee_fk
        FOREIGN KEY (grantee_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_history_package_manifest_versions_episode_fk
        FOREIGN KEY (grantee_membership_episode_id)
        REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 5. THE EXACT ITEM SET OF ONE MANIFEST, WITH THE EXACT CAPTURED AVAILABILITY.
--
--    Normalized rows, never a JSON manifest blob and never a generic predicate
--    or query language: a Product-level topic / period / Session / event
--    selection resolves into this exact set BEFORE preparation. The two
--    composite foreign keys make "every item belongs to the exact same World as
--    the manifest" structural.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_history_package_manifest_items (
    manifest_version_id uuid NOT NULL,
    world_id uuid NOT NULL,
    history_item_id uuid NOT NULL,
    captured_availability_revision bigint NOT NULL,
    CONSTRAINT shared_world_history_package_manifest_items_pk
        PRIMARY KEY (manifest_version_id, history_item_id),
    CONSTRAINT shared_world_history_package_manifest_items_revision_check
        CHECK (captured_availability_revision > 0),
    CONSTRAINT shared_world_history_package_manifest_items_manifest_fk
        FOREIGN KEY (manifest_version_id, world_id)
        REFERENCES public.shared_world_history_package_manifest_versions (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_history_package_manifest_items_item_fk
        FOREIGN KEY (history_item_id, world_id)
        REFERENCES public.shared_world_history_items (id, world_id) ON DELETE RESTRICT
);

CREATE INDEX shared_world_history_package_manifest_items_item_idx
    ON public.shared_world_history_package_manifest_items (history_item_id);

-- ---------------------------------------------------------------------------
-- 6. THE DERIVED REQUIRED APPROVER SET OF ONE MANIFEST.
--
--    The exact UNION of the included items' required human material authorities
--    (CW2-02 section 38 / B27). The preparation primitive derives it internally;
--    no caller supplies an approver identity, an approval count or any authority.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_history_package_required_approvers (
    manifest_version_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    CONSTRAINT shared_world_history_package_required_approvers_pk
        PRIMARY KEY (manifest_version_id, approver_user_id),
    CONSTRAINT shared_world_history_package_required_approvers_manifest_fk
        FOREIGN KEY (manifest_version_id)
        REFERENCES public.shared_world_history_package_manifest_versions (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_history_package_required_approvers_user_fk
        FOREIGN KEY (approver_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 7. ONE EXACT HUMAN APPROVAL OF ONE EXACT MANIFEST.
--
--    The composite foreign key into the DERIVED required set is the binding law:
--    it is structurally impossible to record an approval by a human the exact
--    manifest does not require, however the row is produced. UNIQUE (manifest,
--    approver) is the one-effective-approval rule, so one human can never cover
--    another human's requirement under a second approval id.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_history_package_approvals (
    id uuid NOT NULL,
    manifest_version_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    approved_at timestamptz NOT NULL,
    CONSTRAINT shared_world_history_package_approvals_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_history_package_approvals_one_per_approver_key
        UNIQUE (manifest_version_id, approver_user_id),
    CONSTRAINT shared_world_history_package_approvals_required_fk
        FOREIGN KEY (manifest_version_id, approver_user_id)
        REFERENCES public.shared_world_history_package_required_approvers
                   (manifest_version_id, approver_user_id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 8. THE HISTORY ACCESS GRANT.
--
--    An independent history authority object. It is NOT membership, NOT a
--    Standing Context Grant, NOT material ownership, NOT World governance and
--    NOT current audience membership. It carries no mutable status column at
--    all, because grant withdrawal after viewing is explicitly deferred frozen
--    policy. UNIQUE (manifest_version_id) is the "one manifest commits at most
--    one grant" rule.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_history_access_grants (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    grantee_user_id uuid NOT NULL,
    grantee_membership_episode_id uuid NOT NULL,
    manifest_version_id uuid NOT NULL,
    granted_at timestamptz NOT NULL,
    CONSTRAINT shared_world_history_access_grants_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_history_access_grants_manifest_key UNIQUE (manifest_version_id),
    CONSTRAINT shared_world_history_access_grants_world_key UNIQUE (id, world_id),
    CONSTRAINT shared_world_history_access_grants_manifest_fk
        FOREIGN KEY (manifest_version_id, world_id, grantee_user_id, grantee_membership_episode_id)
        REFERENCES public.shared_world_history_package_manifest_versions
                   (id, world_id, grantee_user_id, grantee_membership_episode_id) ON DELETE RESTRICT
);

CREATE INDEX shared_world_history_access_grants_world_grantee_idx
    ON public.shared_world_history_access_grants (world_id, grantee_user_id);

-- ---------------------------------------------------------------------------
-- 9. The append-only HISTORY_GRANTED fact and its durable command history
--    (CW2-03 section 46).
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_history_granted_events (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    history_access_grant_id uuid NOT NULL,
    manifest_version_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT shared_world_history_granted_events_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_history_granted_events_grant_key UNIQUE (history_access_grant_id),
    CONSTRAINT shared_world_history_granted_events_manifest_key UNIQUE (manifest_version_id),
    CONSTRAINT shared_world_history_granted_events_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_history_granted_events_grant_fk
        FOREIGN KEY (history_access_grant_id, world_id)
        REFERENCES public.shared_world_history_access_grants (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_history_granted_events_manifest_fk
        FOREIGN KEY (manifest_version_id)
        REFERENCES public.shared_world_history_package_manifest_versions (id) ON DELETE RESTRICT
);

CREATE TABLE public.shared_world_history_grant_commands (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    manifest_version_id uuid NOT NULL,
    history_access_grant_id uuid NOT NULL,
    history_granted_event_id uuid NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT shared_world_history_grant_commands_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_history_grant_commands_manifest_key UNIQUE (manifest_version_id),
    CONSTRAINT shared_world_history_grant_commands_grant_key UNIQUE (history_access_grant_id),
    CONSTRAINT shared_world_history_grant_commands_event_key UNIQUE (history_granted_event_id),
    CONSTRAINT shared_world_history_grant_commands_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_history_grant_commands_grant_fk
        FOREIGN KEY (history_access_grant_id, world_id)
        REFERENCES public.shared_world_history_access_grants (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_history_grant_commands_manifest_fk
        FOREIGN KEY (manifest_version_id)
        REFERENCES public.shared_world_history_package_manifest_versions (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_history_grant_commands_event_fk
        FOREIGN KEY (history_granted_event_id)
        REFERENCES public.shared_world_history_granted_events (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 10. Deny-by-default posture for all nine new tables: RLS on, zero policies,
--     every application role revoked from every privilege. There is no direct
--     client read path and no application read boundary except the one narrow
--     resolver at the end of this migration.
-- ---------------------------------------------------------------------------
ALTER TABLE public.shared_world_history_items OWNER TO postgres;
ALTER TABLE public.shared_world_history_item_baseline_viewers OWNER TO postgres;
ALTER TABLE public.shared_world_history_item_required_approvers OWNER TO postgres;
ALTER TABLE public.shared_world_history_package_manifest_versions OWNER TO postgres;
ALTER TABLE public.shared_world_history_package_manifest_items OWNER TO postgres;
ALTER TABLE public.shared_world_history_package_required_approvers OWNER TO postgres;
ALTER TABLE public.shared_world_history_package_approvals OWNER TO postgres;
ALTER TABLE public.shared_world_history_access_grants OWNER TO postgres;
ALTER TABLE public.shared_world_history_granted_events OWNER TO postgres;
ALTER TABLE public.shared_world_history_grant_commands OWNER TO postgres;
ALTER TABLE public.shared_world_history_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_history_item_baseline_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_history_item_required_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_history_package_manifest_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_history_package_manifest_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_history_package_required_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_history_package_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_history_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_history_granted_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_history_grant_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_world_history_items,
                    public.shared_world_history_item_baseline_viewers,
                    public.shared_world_history_item_required_approvers,
                    public.shared_world_history_package_manifest_versions,
                    public.shared_world_history_package_manifest_items,
                    public.shared_world_history_package_required_approvers,
                    public.shared_world_history_package_approvals,
                    public.shared_world_history_access_grants,
                    public.shared_world_history_granted_events,
                    public.shared_world_history_grant_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.shared_world_history_items, public.shared_world_history_item_baseline_viewers, public.shared_world_history_item_required_approvers, public.shared_world_history_package_manifest_versions, public.shared_world_history_package_manifest_items, public.shared_world_history_package_required_approvers, public.shared_world_history_package_approvals, public.shared_world_history_access_grants, public.shared_world_history_granted_events, public.shared_world_history_grant_commands FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 11. TEMPORAL TRUTH IS IMMUTABLE.
--
--     CW2-03 section 22 / C18 freezes that later visibility changes visibility
--     ONLY: it never changes event time, membership time or original knowledge
--     time, and a later grantee must never appear to have been present when the
--     material was created. This narrow trigger makes that structural for the
--     projection: identity, World, time, registration and the authority
--     requirement MODE can never be rewritten in place, and availability - the
--     one future-evolvable state here - may change only forward, with a strictly
--     increasing revision whenever the state itself changes.
--
--     It constrains the future reviewed I-04G availability writer in exactly the
--     way frozen canon already constrains it, and forbids nothing that canon
--     permits: I-04G binds real material to this identity and transitions
--     availability; it does not rewrite when something happened.
--
--     OWNER DELETION IS TERMINAL. CW2-01 A18 and CW2-03 section 37 freeze that
--     owner-deleted material is unavailable for future use and can never be
--     reconstructed. A higher revision must therefore not be able to resurrect it
--     as AVAILABLE, and must not be able to relabel it as UNAVAILABLE either - the
--     historical truth that its OWNER deleted it is part of what must survive. So
--     once availability_state is DELETED_BY_OWNER, both availability fields this
--     migration owns are frozen exactly as they are.
--
--     The rule is scoped to those two owned fields on purpose: it is NOT a table
--     freeze. A later reviewed slice may still append columns to this relation and
--     write them on an owner-deleted item, which is that slice's business. And
--     whether UNAVAILABLE is permanently terminal is deliberately NOT decided here,
--     because frozen canon does not require it: an item that is merely unavailable
--     may legitimately become available again.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.shared_world_history_item_temporal_truth_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.world_id <> OLD.world_id
     OR NEW.occurred_at <> OLD.occurred_at OR NEW.registered_at <> OLD.registered_at
     OR NEW.authority_requirement_mode <> OLD.authority_requirement_mode THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_TEMPORAL_TRUTH_IMMUTABLE' USING ERRCODE='P0001';
  END IF;
  -- OWNER DELETION IS TERMINAL, whatever revision is offered.
  IF OLD.availability_state = 'DELETED_BY_OWNER'
     AND (NEW.availability_state <> 'DELETED_BY_OWNER'
          OR NEW.availability_revision <> OLD.availability_revision) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_OWNER_DELETION_TERMINAL' USING ERRCODE='P0001';
  END IF;
  IF NEW.availability_revision < OLD.availability_revision THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_AVAILABILITY_REVISION_REGRESSED' USING ERRCODE='P0001';
  END IF;
  IF NEW.availability_state IS DISTINCT FROM OLD.availability_state
     AND NEW.availability_revision <= OLD.availability_revision THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_AVAILABILITY_REVISION_REQUIRED' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER shared_world_history_item_immutable_truth
  BEFORE UPDATE ON public.shared_world_history_items
  FOR EACH ROW EXECUTE FUNCTION public.shared_world_history_item_temporal_truth_v1();

-- ---------------------------------------------------------------------------
-- 12. PRIMITIVE A - prepare the exact immutable history package manifest.
--
--     The caller supplies four things and no authority at all: an opaque
--     manifest identity, the exact World, the exact grantee human, and the exact
--     normalized selected item identities. It supplies NO approver set, NO
--     approval count, NO membership episode, NO availability state or revision,
--     NO instant and NO authority outcome - every one of those is derived from
--     canonical state under the World lock, or from the database clock.
--
--     No current topology snapshot of ALL members is taken, deliberately:
--     selective historical material authority is NOT World governance
--     (CW2-01 A25), so an unrelated member joining or leaving must not stale a
--     package that does not depend on them. What DOES stale it is exactly what
--     this manifest binds: the grantee's own episode, and the exact items.
--
--     Preparation is not authority and reserves nothing (CW2-02 B8).
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.prepare_shared_world_history_package_v1(
  p_manifest_version_id uuid, p_world_id uuid, p_grantee_user_id uuid, p_history_item_ids uuid[]
) RETURNS TABLE(outcome text, prepared_manifest_version_id uuid, prepared_world_id uuid,
                prepared_grantee_user_id uuid, prepared_grantee_episode_id uuid,
                prepared_item_count integer, prepared_required_approver_count integer,
                prepared_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_history_package_manifest_versions;
  world public.shared_worlds;
  selected uuid[];
  items integer;
  approvers integer;
  grantee_episode uuid;
  affected integer;
  prepare_instant timestamptz;
BEGIN
  IF p_manifest_version_id IS NULL OR p_world_id IS NULL OR p_grantee_user_id IS NULL
     OR p_history_item_ids IS NULL OR array_length(p_history_item_ids, 1) IS NULL
     OR array_position(p_history_item_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- The selection is an exact SET. A repeated identity is refused rather than
  -- silently folded, so "the exact item set" means the same thing to the caller,
  -- to the idempotency comparison below and to every later revalidation.
  IF (SELECT count(DISTINCT s.item) FROM unnest(p_history_item_ids) AS s(item))
     <> array_length(p_history_item_ids, 1) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT array_agg(s.item ORDER BY s.item) INTO selected FROM unnest(p_history_item_ids) AS s(item);
  items := array_length(selected, 1);

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent retry of a
  -- manifest that already committed is answered from immutable history even after
  -- the grantee has left or rejoined. Nothing below this point reads CURRENT
  -- topology: a historical answer must not start differing because a human moved.
  SELECT * INTO committed FROM public.shared_world_history_package_manifest_versions c
   WHERE c.id = p_manifest_version_id;
  IF FOUND THEN
    IF committed.world_id = p_world_id AND committed.grantee_user_id = p_grantee_user_id
       AND (SELECT count(*) FROM public.shared_world_history_package_manifest_items mi
             WHERE mi.manifest_version_id = committed.id) = items
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_items mi
                        WHERE mi.manifest_version_id = committed.id
                          AND NOT (mi.history_item_id = ANY(selected))) THEN
      SELECT count(*)::integer INTO approvers
        FROM public.shared_world_history_package_required_approvers pa
       WHERE pa.manifest_version_id = committed.id;
      RETURN QUERY SELECT 'PREPARED'::text, committed.id, committed.world_id, committed.grantee_user_id,
                          committed.grantee_membership_episode_id, items, approvers, committed.created_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the exact World row, before anything else.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the World lock, so two concurrent
  -- equivalent preparations serialize and the loser returns committed history.
  SELECT * INTO committed FROM public.shared_world_history_package_manifest_versions c
   WHERE c.id = p_manifest_version_id;
  IF FOUND THEN
    IF committed.world_id = p_world_id AND committed.grantee_user_id = p_grantee_user_id
       AND (SELECT count(*) FROM public.shared_world_history_package_manifest_items mi
             WHERE mi.manifest_version_id = committed.id) = items
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_items mi
                        WHERE mi.manifest_version_id = committed.id
                          AND NOT (mi.history_item_id = ANY(selected))) THEN
      SELECT count(*)::integer INTO approvers
        FROM public.shared_world_history_package_required_approvers pa
       WHERE pa.manifest_version_id = committed.id;
      RETURN QUERY SELECT 'PREPARED'::text, committed.id, committed.world_id, committed.grantee_user_id,
                          committed.grantee_membership_episode_id, items, approvers, committed.created_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- Selective history is an ordinary Shared mutation: ACTIVE / STANDARD only. An
  -- archived World blocks it (CW2-03 section 35 / C31) and a paired World has its
  -- own terminal transition, which this slice neither implements nor guesses.
  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE GRANTEE'S OWN EXACT CURRENT OPEN EPISODE, resolved from canonical state
  -- under the World lock rather than from any parameter. Migration 0075's partial
  -- unique index already guarantees at most one; zero reaches the same bounded
  -- class as every other unavailable case, so no future wrapper can turn this
  -- primitive into a membership oracle.
  IF (SELECT count(*) FROM public.shared_world_membership_episodes probe
       WHERE probe.world_id = p_world_id AND probe.user_id = p_grantee_user_id
         AND probe.ended_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT e.id INTO grantee_episode
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.user_id = p_grantee_user_id AND e.ended_at IS NULL;

  -- CANONICAL LOCK ORDER, STEP 2: the exact selected history items, in
  -- deterministic UUID identity order. LockRows sits above the sort, so the rows
  -- really are locked in that order and two packages sharing items cannot
  -- deadlock against each other.
  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id = ANY(selected) ORDER BY i.id FOR UPDATE;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> items THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- Every selected item must belong to the exact same World and still be
  -- AVAILABLE. A deleted or unavailable source is never packaged.
  IF EXISTS (SELECT 1 FROM public.shared_world_history_items i
              WHERE i.id = ANY(selected)
                AND (i.world_id <> p_world_id OR i.availability_state <> 'AVAILABLE')) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- AUTHORITY METADATA IS EXACT, IN BOTH DIRECTIONS, OR IT FAILS CLOSED. An item
  -- claiming EXACT_HUMAN_APPROVER_SET with no approver is missing metadata, and
  -- an item claiming NO_HUMAN_APPROVAL_REQUIRED while carrying one is
  -- contradictory. Neither is ever interpreted as approval-free.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_history_items i
     WHERE i.id = ANY(selected)
       AND ((i.authority_requirement_mode = 'EXACT_HUMAN_APPROVER_SET'
             AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                              WHERE ra.history_item_id = i.id))
         OR (i.authority_requirement_mode = 'NO_HUMAN_APPROVAL_REQUIRED'
             AND EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                          WHERE ra.history_item_id = i.id)))
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- THE ONE canonical instant, read from the database clock exactly once.
  prepare_instant := clock_timestamp();

  BEGIN
    INSERT INTO public.shared_world_history_package_manifest_versions
      (id, world_id, grantee_user_id, grantee_membership_episode_id, created_at)
    VALUES (p_manifest_version_id, p_world_id, p_grantee_user_id, grantee_episode, prepare_instant);

    -- The exact item set, with each item's exact availability revision captured.
    INSERT INTO public.shared_world_history_package_manifest_items
      (manifest_version_id, world_id, history_item_id, captured_availability_revision)
    SELECT p_manifest_version_id, i.world_id, i.id, i.availability_revision
      FROM public.shared_world_history_items i WHERE i.id = ANY(selected);
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> items THEN
      RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- THE DERIVED REQUIRED APPROVER SET: the exact UNION over the included items,
    -- never a caller-supplied list and never World membership.
    INSERT INTO public.shared_world_history_package_required_approvers
      (manifest_version_id, approver_user_id)
    SELECT DISTINCT p_manifest_version_id, ra.approver_user_id
      FROM public.shared_world_history_item_required_approvers ra
     WHERE ra.history_item_id = ANY(selected);
    GET DIAGNOSTICS approvers = ROW_COUNT;
  EXCEPTION WHEN unique_violation THEN
    -- A manifest identity already committed for THIS World would have been
    -- answered above under the World lock, so the only remaining collision is the
    -- same identity committed for a DIFFERENT World, which can never be an
    -- equivalent retry. The whole preparation - manifest, item set and derived
    -- approver set - rolls back together, so a refused preparation leaves no
    -- orphan manifest behind.
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'PREPARED'::text, p_manifest_version_id, p_world_id, p_grantee_user_id,
                      grantee_episode, items, approvers, prepare_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 13. PRIMITIVE B - one exact human material-authority approval.
--
--     The approving human is exactly the session subject, derived rather than
--     supplied: there is no actor parameter, no approver parameter and no instant
--     parameter, so no caller - including a future launch-gated wrapper, and
--     including QANDEEL - can manufacture a human approval or record one on
--     somebody's behalf. An unauthenticated call fails closed.
--
--     The actor does NOT need current World membership: material authority
--     survives membership loss (CW2-03 section 24 / C21). Approving restores no
--     World browsing - this body writes no membership episode and no grant.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_shared_world_history_package_approval_v1(
  p_approval_id uuid, p_manifest_version_id uuid
) RETURNS TABLE(outcome text, committed_approval_id uuid, approved_manifest_version_id uuid,
                approving_user_id uuid, approval_committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.shared_world_history_package_approvals;
  manifest public.shared_world_history_package_manifest_versions;
  world public.shared_worlds;
  target_world uuid;
  approval_instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_approval_id IS NULL OR p_manifest_version_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent retry by
  -- the same exact human is answered from immutable history even after the
  -- manifest has gone stale. Every row read here is immutable.
  SELECT * INTO committed FROM public.shared_world_history_package_approvals a WHERE a.id = p_approval_id;
  IF FOUND THEN
    IF committed.manifest_version_id = p_manifest_version_id AND committed.approver_user_id = u THEN
      RETURN QUERY SELECT 'APPROVED'::text, committed.id, committed.manifest_version_id,
                          committed.approver_user_id, committed.approved_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- WORLD-FIRST ORDER. Only enough of the manifest is pre-read to discover which
  -- World this approval belongs to; the manifest itself is never locked first.
  SELECT m.world_id INTO target_world
    FROM public.shared_world_history_package_manifest_versions m WHERE m.id = p_manifest_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the exact World row.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.shared_world_history_package_approvals a WHERE a.id = p_approval_id;
  IF FOUND THEN
    IF committed.manifest_version_id = p_manifest_version_id AND committed.approver_user_id = u THEN
      RETURN QUERY SELECT 'APPROVED'::text, committed.id, committed.manifest_version_id,
                          committed.approver_user_id, committed.approved_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the exact manifest.
  SELECT * INTO manifest FROM public.shared_world_history_package_manifest_versions m
   WHERE m.id = p_manifest_version_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF manifest.world_id <> target_world THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 3: the exact selected items, in identity order.
  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id IN (SELECT mi.history_item_id
                     FROM public.shared_world_history_package_manifest_items mi
                    WHERE mi.manifest_version_id = manifest.id)
    ORDER BY i.id FOR UPDATE;

  -- THE EXACT GRANTEE EPISODE IS STILL CURRENT. A leave stales the manifest, and
  -- a later rejoin under a NEW episode never revives it: this compares episode
  -- IDENTITY, which a rejoining human does not inherit.
  IF NOT EXISTS (
    SELECT 1 FROM public.shared_world_membership_episodes e
     WHERE e.id = manifest.grantee_membership_episode_id
       AND e.world_id = manifest.world_id AND e.user_id = manifest.grantee_user_id
       AND e.ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_STALE' USING ERRCODE='40001';
  END IF;
  -- THE EXACT ITEM SET IS STILL COHERENT: non-empty, same World, still AVAILABLE,
  -- and still at the exact availability revision the manifest captured.
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_items mi
                  WHERE mi.manifest_version_id = manifest.id) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.shared_world_history_package_manifest_items mi
      JOIN public.shared_world_history_items i ON i.id = mi.history_item_id
     WHERE mi.manifest_version_id = manifest.id
       AND (i.world_id <> manifest.world_id
            OR i.availability_state <> 'AVAILABLE'
            OR i.availability_revision <> mi.captured_availability_revision)
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_STALE' USING ERRCODE='40001';
  END IF;

  -- THE ACTOR IS IN THE EXACT DERIVED REQUIRED SET, and nothing else qualifies:
  -- not World membership, not authorship of an adjacent item, not governance.
  -- A human who is not required reaches the same bounded class as a caller naming
  -- a manifest that does not exist.
  IF NOT EXISTS (
    SELECT 1 FROM public.shared_world_history_package_required_approvers pa
     WHERE pa.manifest_version_id = manifest.id AND pa.approver_user_id = u
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  approval_instant := clock_timestamp();

  BEGIN
    INSERT INTO public.shared_world_history_package_approvals
      (id, manifest_version_id, approver_user_id, approved_at)
    VALUES (p_approval_id, p_manifest_version_id, u, approval_instant);
  EXCEPTION WHEN unique_violation THEN
    -- Either the approval identity is already taken for a different manifest or
    -- actor, or this exact human already approved this exact manifest under
    -- another id. A second effective approval is refused rather than created.
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'APPROVED'::text, p_approval_id, p_manifest_version_id, u, approval_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 14. PRIMITIVE C - commit the HISTORY_ACCESS_GRANT.
--
--     There is no granting actor and no synthetic granter: the authority IS the
--     completed exact material-authority set, exactly as the governed removal and
--     the governed settings change of I-04E derive no actor from their unanimous
--     approval sets. The commit copies no material, alters no item time, alters
--     no membership, widens no Standing Context Grant and creates no ghost
--     history.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_shared_world_history_access_grant_v1(
  p_command_id uuid, p_manifest_version_id uuid, p_history_access_grant_id uuid,
  p_history_granted_event_id uuid
) RETURNS TABLE(outcome text, history_command_id uuid, granted_world_id uuid,
                granted_manifest_version_id uuid, committed_grant_id uuid,
                committed_event_id uuid, history_granted_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_history_grant_commands;
  manifest public.shared_world_history_package_manifest_versions;
  world public.shared_worlds;
  target_world uuid;
  required integer;
  recorded integer;
  grant_instant timestamptz;
BEGIN
  IF p_command_id IS NULL OR p_manifest_version_id IS NULL OR p_history_access_grant_id IS NULL
     OR p_history_granted_event_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS. The committed answer is historical: an item
  -- may legitimately have become unavailable since, and this command must not
  -- start answering differently because of that. What must still hold is that the
  -- immutable facts it wrote remain coherent.
  SELECT * INTO committed FROM public.shared_world_history_grant_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.manifest_version_id = p_manifest_version_id
       AND committed.history_access_grant_id = p_history_access_grant_id
       AND committed.history_granted_event_id = p_history_granted_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_history_granted_events ev
          JOIN public.shared_world_history_access_grants g ON g.id = ev.history_access_grant_id
         WHERE ev.id = committed.history_granted_event_id
           AND ev.history_access_grant_id = committed.history_access_grant_id
           AND ev.manifest_version_id = committed.manifest_version_id
           AND ev.world_id = committed.world_id
           AND ev.occurred_at = committed.committed_at
           AND g.manifest_version_id = committed.manifest_version_id
           AND g.world_id = committed.world_id
           AND g.granted_at = committed.committed_at
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'HISTORY_GRANTED'::text, committed.id, committed.world_id,
                          committed.manifest_version_id, committed.history_access_grant_id,
                          committed.history_granted_event_id, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- WORLD-FIRST ORDER.
  SELECT m.world_id INTO target_world
    FROM public.shared_world_history_package_manifest_versions m WHERE m.id = p_manifest_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.shared_world_history_grant_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.manifest_version_id = p_manifest_version_id
       AND committed.history_access_grant_id = p_history_access_grant_id
       AND committed.history_granted_event_id = p_history_granted_event_id THEN
      RETURN QUERY SELECT 'HISTORY_GRANTED'::text, committed.id, committed.world_id,
                          committed.manifest_version_id, committed.history_access_grant_id,
                          committed.history_granted_event_id, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO manifest FROM public.shared_world_history_package_manifest_versions m
   WHERE m.id = p_manifest_version_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF manifest.world_id <> target_world THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id IN (SELECT mi.history_item_id
                     FROM public.shared_world_history_package_manifest_items mi
                    WHERE mi.manifest_version_id = manifest.id)
    ORDER BY i.id FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.shared_world_membership_episodes e
     WHERE e.id = manifest.grantee_membership_episode_id
       AND e.world_id = manifest.world_id AND e.user_id = manifest.grantee_user_id
       AND e.ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_STALE' USING ERRCODE='40001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_items mi
                  WHERE mi.manifest_version_id = manifest.id) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.shared_world_history_package_manifest_items mi
      JOIN public.shared_world_history_items i ON i.id = mi.history_item_id
     WHERE mi.manifest_version_id = manifest.id
       AND (i.world_id <> manifest.world_id
            OR i.availability_state <> 'AVAILABLE'
            OR i.availability_revision <> mi.captured_availability_revision)
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_STALE' USING ERRCODE='40001';
  END IF;

  -- THE COMPLETED EXACT MATERIAL-AUTHORITY SET. Every derived required human
  -- carries an approval of THIS exact manifest, and the unique binding makes at
  -- least one mean exactly one.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_history_package_required_approvers pa
     WHERE pa.manifest_version_id = manifest.id
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_approvals a
                        WHERE a.manifest_version_id = pa.manifest_version_id
                          AND a.approver_user_id = pa.approver_user_id)
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_APPROVALS_INCOMPLETE' USING ERRCODE='55000';
  END IF;
  SELECT count(*)::integer INTO required
    FROM public.shared_world_history_package_required_approvers pa
   WHERE pa.manifest_version_id = manifest.id;
  SELECT count(*)::integer INTO recorded
    FROM public.shared_world_history_package_approvals a
   WHERE a.manifest_version_id = manifest.id;
  IF recorded <> required THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_APPROVALS_INCOMPLETE' USING ERRCODE='55000';
  END IF;

  -- PER-ITEM AUTHORITY METADATA IS STILL EXACT, in both directions. A zero
  -- required set is authority ONLY for a manifest whose every item explicitly
  -- says NO_HUMAN_APPROVAL_REQUIRED; missing metadata is never approval-free.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_history_package_manifest_items mi
      JOIN public.shared_world_history_items i ON i.id = mi.history_item_id
     WHERE mi.manifest_version_id = manifest.id
       AND ((i.authority_requirement_mode = 'EXACT_HUMAN_APPROVER_SET'
             AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                              WHERE ra.history_item_id = i.id))
         OR (i.authority_requirement_mode = 'NO_HUMAN_APPROVAL_REQUIRED'
             AND EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                          WHERE ra.history_item_id = i.id)))
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF required = 0 AND EXISTS (
    SELECT 1 FROM public.shared_world_history_package_manifest_items mi
      JOIN public.shared_world_history_items i ON i.id = mi.history_item_id
     WHERE mi.manifest_version_id = manifest.id
       AND i.authority_requirement_mode <> 'NO_HUMAN_APPROVAL_REQUIRED'
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  -- The derived set must STILL equal the exact union over the included items, so
  -- an item that gained a required human after preparation cannot be granted
  -- under the narrower set that was approved.
  IF EXISTS (
    SELECT ra.approver_user_id FROM public.shared_world_history_item_required_approvers ra
     WHERE ra.history_item_id IN (SELECT mi.history_item_id
                                    FROM public.shared_world_history_package_manifest_items mi
                                   WHERE mi.manifest_version_id = manifest.id)
    EXCEPT
    SELECT pa.approver_user_id FROM public.shared_world_history_package_required_approvers pa
     WHERE pa.manifest_version_id = manifest.id
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_STALE' USING ERRCODE='40001';
  END IF;

  grant_instant := clock_timestamp();

  BEGIN
    INSERT INTO public.shared_world_history_access_grants
      (id, world_id, grantee_user_id, grantee_membership_episode_id, manifest_version_id, granted_at)
    VALUES (p_history_access_grant_id, manifest.world_id, manifest.grantee_user_id,
            manifest.grantee_membership_episode_id, manifest.id, grant_instant);

    INSERT INTO public.shared_world_history_granted_events
      (id, world_id, history_access_grant_id, manifest_version_id, occurred_at)
    VALUES (p_history_granted_event_id, manifest.world_id, p_history_access_grant_id,
            manifest.id, grant_instant);

    INSERT INTO public.shared_world_history_grant_commands
      (id, world_id, manifest_version_id, history_access_grant_id, history_granted_event_id, committed_at)
    VALUES (p_command_id, manifest.world_id, manifest.id, p_history_access_grant_id,
            p_history_granted_event_id, grant_instant);
  EXCEPTION WHEN unique_violation THEN
    -- A supplied persistence identity was already taken, or this exact manifest
    -- already committed its one grant. The whole commit rolls back together.
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'HISTORY_GRANTED'::text, p_command_id, manifest.world_id, manifest.id,
                      p_history_access_grant_id, p_history_granted_event_id, grant_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 15. THE ONE HISTORICAL VISIBILITY RESOLVER.
--
--     It answers exactly one server-internal question: which history items may
--     this exact human see in this exact Shared World, right now. It returns item
--     IDENTITY and TIME only - never content, never a hidden count, name or
--     placeholder, and never a row for anything it is not returning, so hidden
--     history discloses nothing about its own existence (CW2-03 section 20 / C16).
--
--     ACTIVE / STANDARD is the exact UNION of two independent bases:
--
--       A. membership-period visibility - the human is in the item's exact
--          baseline audience AND the item occurred inside one of that human's
--          membership episodes in this exact World, with truthful temporal
--          bounds. This is what makes rejoin restore authorized prior
--          membership-period history without treating absence as presence;
--       B. explicit history grants - the item is included in a committed
--          HISTORY_ACCESS_GRANT to that exact human in that exact World. This is
--          how absence-period and pre-join history stays available across a later
--          rejoin.
--
--     A human with no currently open episode gets no active-World browsing at
--     all, however many old grants they hold - and they get a truthful empty
--     answer rather than a distinguishable error, so this resolver is not a
--     membership oracle either.
--
--     READ_ONLY_CLOSED / STANDARD never uses active membership: the closed view
--     is the exact entitlement snapshot migration 0088 owns, so that branch
--     delegates to the closure slice's own reader rather than guessing its shape.
--
--     INTRODUCTION is not implemented by I-04F and is refused with a bounded
--     unsupported class rather than silently given Standard semantics.
--
--     Availability always dominates every mode: an item that is no longer
--     AVAILABLE is never returned, whatever grant or entitlement exists, so no
--     entitlement can reconstruct owner-deleted source (CW2-01 A18, CW2-03
--     section 37).
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_shared_world_history_visibility_v1(p_world_id uuid, p_user_id uuid)
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
  IF world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_VISIBILITY_UNSUPPORTED_WORLD_MODE' USING ERRCODE='0A000';
  END IF;
  IF world.lifecycle = 'READ_ONLY_CLOSED' THEN
    RETURN QUERY SELECT c.world_id, c.history_item_id, c.occurred_at
      FROM public.resolve_shared_world_closed_history_visibility_v1(p_world_id, p_user_id) c;
    RETURN;
  END IF;
  -- ACTIVE / STANDARD: an open episode is required before anything is visible.
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                  WHERE e.world_id = p_world_id AND e.user_id = p_user_id AND e.ended_at IS NULL) THEN
    RETURN;
  END IF;
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
-- 16. Ownership and THE PRE-LAUNCH ACL. All three consequential primitives are
--     executable by no application role at all. The ONLY grant in this migration
--     is service_role EXECUTE on the read-only resolver, which follows the frozen
--     narrow resolver precedent of 0077 / 0079 / 0080 and opens no direct table
--     privilege of any kind.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.shared_world_history_item_temporal_truth_v1() OWNER TO postgres;
ALTER FUNCTION public.prepare_shared_world_history_package_v1(uuid, uuid, uuid, uuid[]) OWNER TO postgres;
ALTER FUNCTION public.commit_shared_world_history_package_approval_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.commit_shared_world_history_access_grant_v1(uuid, uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_shared_world_history_visibility_v1(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.shared_world_history_item_temporal_truth_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_shared_world_history_package_v1(uuid, uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_shared_world_history_package_approval_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_shared_world_history_access_grant_v1(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_shared_world_history_visibility_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.shared_world_history_item_temporal_truth_v1() FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.prepare_shared_world_history_package_v1(uuid, uuid, uuid, uuid[]) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_history_package_approval_v1(uuid, uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_history_access_grant_v1(uuid, uuid, uuid, uuid) FROM service_role';
END IF;END$$;
GRANT EXECUTE ON FUNCTION public.resolve_shared_world_history_visibility_v1(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 17. Terminal self-assertions. The migration refuses to deploy a selective
--     history surface that is application-executable, content-bearing, generic,
--     caller-authorized, unpinned, wrongly ordered, multi-clocked,
--     membership-mutating, World-mutating, governance-manufacturing,
--     grant-withdrawing or policy-bearing.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  prepare_fn text := 'public.prepare_shared_world_history_package_v1(uuid,uuid,uuid,uuid[])';
  approve_fn text := 'public.commit_shared_world_history_package_approval_v1(uuid,uuid)';
  grant_fn text := 'public.commit_shared_world_history_access_grant_v1(uuid,uuid,uuid,uuid)';
  resolve_fn text := 'public.resolve_shared_world_history_visibility_v1(uuid,uuid)';
  truth_fn text := 'public.shared_world_history_item_temporal_truth_v1()';
  own_tables text[] := ARRAY['public.shared_world_history_items',
                             'public.shared_world_history_item_baseline_viewers',
                             'public.shared_world_history_item_required_approvers',
                             'public.shared_world_history_package_manifest_versions',
                             'public.shared_world_history_package_manifest_items',
                             'public.shared_world_history_package_required_approvers',
                             'public.shared_world_history_package_approvals',
                             'public.shared_world_history_access_grants',
                             'public.shared_world_history_granted_events',
                             'public.shared_world_history_grant_commands'];
  fn_name text;
  p record;
  in_names text[];
  in_types text[];
  arg_name text;
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
  world_pos integer;
  manifest_pos integer;
  item_pos integer;
  write_pos integer;
BEGIN
  -- ===================================================================
  -- Every consequential primitive: ownership, security, pinning, volatility and
  -- the PRE-LAUNCH SECURITY BOUNDARY asserted rather than commented.
  -- ===================================================================
  FOREACH fn_name IN ARRAY ARRAY[prepare_fn, approve_fn, grant_fn] LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn_name::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-04F: % must be owned by postgres', fn_name; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-04F: % must be SECURITY DEFINER', fn_name; END IF;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-04F: % mutates or locks and must be VOLATILE', fn_name; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-04F: % must pin an empty search_path', fn_name;
    END IF;
    IF has_function_privilege('public', fn_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04F: PUBLIC must not execute the selective history surface before the launch gate exists';
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, fn_name, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-04F: % must not execute the selective history surface before the launch gate exists', target_role;
      END IF;
    END LOOP;

    IF p.prosrc ~* 'conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|consent|matching|introduction' THEN
      RAISE EXCEPTION 'I-04F: % must not read Personal context or touch Standing Context and Matching state', fn_name;
    END IF;
    IF p.prosrc ~* 'DELETE FROM' OR p.prosrc ~* 'TRUNCATE' THEN
      RAISE EXCEPTION 'I-04F: % may never delete canonical history', fn_name;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' THEN
      RAISE EXCEPTION 'I-04F: % locks rows in the canonical order, never a table and never an advisory key', fn_name;
    END IF;
    -- SELECTIVE HISTORY CHANGES NOTHING ELSE: no membership, no World lifecycle,
    -- no governance, no grant or consent state, no closure, no entitlement.
    IF p.prosrc ~ 'INSERT INTO public\.shared_world_membership_episodes|UPDATE public\.shared_world_membership_episodes' THEN
      RAISE EXCEPTION 'I-04F: % must open and close no membership episode: a history grant is not membership', fn_name;
    END IF;
    IF p.prosrc ~ 'UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds' THEN
      RAISE EXCEPTION 'I-04F: % must not create, close or mutate a Shared World', fn_name;
    END IF;
    IF p.prosrc ~ 'public\.shared_world_member_invitations' THEN
      RAISE EXCEPTION 'I-04F: % must terminalize no member invitation: a history grant moves no topology', fn_name;
    END IF;
    IF p.prosrc ~ 'INSERT INTO public\.shared_world_governance_|UPDATE public\.shared_world_governance_'
       OR p.prosrc ~ 'INSERT INTO public\.shared_world_membership_snapshot' THEN
      RAISE EXCEPTION 'I-04F: % must never manufacture governance: World governance is not material authority', fn_name;
    END IF;
    IF p.prosrc ~ 'READ_ONLY_CLOSED|closed_at|WORLD_ENDED|CLOSED_WORLD_VIEW_ENTITLEMENT|closed_view_entitlement' THEN
      RAISE EXCEPTION 'I-04F: % must not write a closure or entitlement literal migration 0087 does not own', fn_name;
    END IF;
    -- A COMMITTED GRANT HAS NO WITHDRAWAL SEMANTICS: frozen canon defers it.
    IF p.prosrc ~* 'revoke[d_]|withdraw|rescind|expire[sd]?\M|retroactive' THEN
      RAISE EXCEPTION 'I-04F: % must invent no history-grant withdrawal: frozen canon defers that policy', fn_name;
    END IF;
    IF p.prosrc ~ 'UPDATE public\.shared_world_history_access_grants|UPDATE public\.shared_world_history_granted_events'
       OR p.prosrc ~ 'UPDATE public\.shared_world_history_package_' THEN
      RAISE EXCEPTION 'I-04F: % must rewrite no committed manifest, approval or grant: they are immutable history', fn_name;
    END IF;
    -- ONE database-owned instant per committed transaction, never a client clock
    -- and never a second read.
    IF p.prosrc ~ 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp' THEN
      RAISE EXCEPTION 'I-04F: % must persist one database-owned instant, never a second clock', fn_name;
    END IF;
    IF (length(p.prosrc) - length(replace(p.prosrc, 'clock_timestamp()', ''))) / length('clock_timestamp()') <> 1 THEN
      RAISE EXCEPTION 'I-04F: % must read the canonical instant exactly once', fn_name;
    END IF;
    -- WORLD-FIRST, in every consequential primitive.
    IF strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = ') = 0 OR p.prosrc !~ 'FOR UPDATE' THEN
      RAISE EXCEPTION 'I-04F: % must lock the exact World row', fn_name;
    END IF;
  END LOOP;

  -- ===================================================================
  -- PREPARATION: the caller supplies four things and no authority at all.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes, pr.proargtypes INTO p
    FROM pg_proc pr WHERE pr.oid = prepare_fn::regprocedure;
  -- Argument NAMES from proargnames / proargmodes and TYPES from proargtypes: a
  -- rendered signature folds this function's RETURNS TABLE columns into the same
  -- string, so it is not the authority.
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i') INTO in_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_manifest_version_id','p_world_id','p_grantee_user_id','p_history_item_ids'] THEN
    RAISE EXCEPTION 'I-04F: the package preparation must accept exactly the frozen v1 surface, not %', in_names;
  END IF;
  SELECT array_agg(t.typname::text ORDER BY a.ord) INTO in_types
    FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
    JOIN pg_type t ON t.oid = a.argtype;
  IF in_types <> ARRAY['uuid','uuid','uuid','_uuid'] THEN
    RAISE EXCEPTION 'I-04F: the package preparation must accept three identities and one exact item-identity array, not %', in_types;
  END IF;
  -- The ban is non-vacuous by construction: the exact list above proves these
  -- really are the parameter names being scanned.
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'initiator|proposer|actor|owner|admin|approver|approval|authority|episode|availability|revision|count|audience|launch|gate|timestamp|instant|_at$' THEN
      RAISE EXCEPTION 'I-04F: the package preparation must not accept an approver, authority, episode, availability, count or clock parameter';
    END IF;
  END LOOP;
  -- PostgreSQL ARE matches newlines with `.` by default, so a bounded `.` span is
  -- the portable way to cross the line break here. Two PostgreSQL-only rules apply:
  -- `[\s\S]` is illegal inside a bracket expression, and a repetition bound may
  -- never exceed 255.
  IF p.prosrc !~ 'INSERT INTO public\.shared_world_history_package_required_approvers.{0,200}SELECT DISTINCT' THEN
    RAISE EXCEPTION 'I-04F: the required approver set must be DERIVED as the exact union over the included items';
  END IF;
  IF p.prosrc !~ 'ORDER BY i\.id FOR UPDATE' THEN
    RAISE EXCEPTION 'I-04F: the selected history items must be locked in deterministic identity order';
  END IF;
  IF p.prosrc !~ 'probe\.ended_at IS NULL' THEN
    RAISE EXCEPTION 'I-04F: the grantee episode must be resolved from the exact CURRENT open episode';
  END IF;
  IF p.prosrc ~ 'public\.shared_world_history_access_grants' THEN
    RAISE EXCEPTION 'I-04F: preparing a package must commit no grant: preparation is not authority';
  END IF;

  -- ===================================================================
  -- APPROVAL: exactly the session subject, and no membership requirement.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes INTO p FROM pg_proc pr WHERE pr.oid = approve_fn::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i') INTO in_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_approval_id','p_manifest_version_id'] THEN
    RAISE EXCEPTION 'I-04F: the history approval must accept exactly two opaque identities, not %', in_names;
  END IF;
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'user_id|actor|approver|initiator|owner|admin|episode|member|timestamp|instant|_at$' THEN
      RAISE EXCEPTION 'I-04F: the history approval must not accept an actor, member or clock parameter';
    END IF;
  END LOOP;
  IF p.prosrc !~ 'u uuid := auth\.uid\(\);' THEN
    RAISE EXCEPTION 'I-04F: the approving human must be derived from the session subject, never supplied';
  END IF;
  IF p.prosrc ~ 'e\.user_id = u|user_id = u AND' THEN
    RAISE EXCEPTION 'I-04F: material authority survives membership loss: the approver must not be required to be a current member';
  END IF;
  IF p.prosrc !~ 'public\.shared_world_history_package_required_approvers pa.{0,200}pa\.approver_user_id = u' THEN
    RAISE EXCEPTION 'I-04F: the approver must be in the exact DERIVED required set, and nothing else may qualify';
  END IF;

  -- ===================================================================
  -- GRANT COMMIT: no actor at all, and the exact completed authority set.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes INTO p FROM pg_proc pr WHERE pr.oid = grant_fn::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i') INTO in_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id','p_manifest_version_id','p_history_access_grant_id','p_history_granted_event_id'] THEN
    RAISE EXCEPTION 'I-04F: the history grant commit must accept exactly four opaque identities, not %', in_names;
  END IF;
  IF p.prosrc ~ 'auth\.uid' THEN
    RAISE EXCEPTION 'I-04F: the history grant commit derives no granting actor: the authority is the exact completed material-authority set';
  END IF;
  IF p.prosrc !~ 'SHARED_WORLD_HISTORY_APPROVALS_INCOMPLETE' THEN
    RAISE EXCEPTION 'I-04F: the grant commit must refuse an incomplete required-approval set';
  END IF;
  IF p.prosrc !~ 'required = 0 AND EXISTS' THEN
    RAISE EXCEPTION 'I-04F: a zero required set is authority ONLY for an explicitly approval-free manifest';
  END IF;
  IF p.prosrc !~ 'i\.availability_revision <> mi\.captured_availability_revision' THEN
    RAISE EXCEPTION 'I-04F: the grant commit must refuse an item whose availability revision changed after preparation';
  END IF;
  -- WORLD -> MANIFEST -> ITEMS -> WRITE, in that exact order.
  world_pos := strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
  manifest_pos := strpos(p.prosrc, 'WHERE m.id = p_manifest_version_id FOR UPDATE');
  item_pos := strpos(p.prosrc, 'ORDER BY i.id FOR UPDATE');
  write_pos := strpos(p.prosrc, 'INSERT INTO public.shared_world_history_access_grants');
  IF world_pos = 0 OR manifest_pos = 0 OR item_pos = 0 OR write_pos = 0
     OR world_pos > manifest_pos OR manifest_pos > item_pos OR item_pos > write_pos THEN
    RAISE EXCEPTION 'I-04F: the canonical lock order is World, then manifest, then the exact items, then the write';
  END IF;

  -- ===================================================================
  -- THE RESOLVER: read-only, pinned, service-role-only, content-free.
  -- ===================================================================
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
    INTO p FROM pg_proc pr WHERE pr.oid = resolve_fn::regprocedure;
  IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-04F: the visibility resolver must be owned by postgres'; END IF;
  IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-04F: the visibility resolver must be SECURITY DEFINER'; END IF;
  IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-04F: the visibility resolver must be STABLE (read-only)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-04F: the visibility resolver must pin an empty search_path';
  END IF;
  IF p.prosrc ~* 'INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt' THEN
    RAISE EXCEPTION 'I-04F: the visibility resolver must mutate nothing, lock nothing and trust no client claim';
  END IF;
  IF p.prosrc !~ 'i\.availability_state = ''AVAILABLE''' THEN
    RAISE EXCEPTION 'I-04F: availability must dominate every visibility mode';
  END IF;
  IF p.prosrc !~ 'i\.occurred_at >= e\.joined_at' OR p.prosrc !~ 'e\.ended_at IS NULL OR i\.occurred_at <= e\.ended_at' THEN
    RAISE EXCEPTION 'I-04F: membership-period visibility must use truthful temporal bounds';
  END IF;
  IF p.prosrc !~ 'shared_world_history_item_baseline_viewers' THEN
    RAISE EXCEPTION 'I-04F: a membership interval alone is never historical visibility: the exact baseline audience is required';
  END IF;
  IF p.prosrc !~ 'resolve_shared_world_closed_history_visibility_v1' THEN
    RAISE EXCEPTION 'I-04F: closed viewing is the exact closure entitlement snapshot, never active membership';
  END IF;
  IF has_function_privilege('public', resolve_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-04F: PUBLIC must not execute the visibility resolver';
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
       AND has_function_privilege(target_role, resolve_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04F: % must not execute the visibility resolver', target_role;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role', resolve_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-04F: service_role must be the only executor of the visibility resolver';
  END IF;

  -- ===================================================================
  -- TEMPORAL TRUTH AND TERMINAL OWNER DELETION, asserted rather than commented.
  -- ===================================================================
  SELECT pr.prosrc, pg_get_userbyid(pr.proowner) AS owner INTO p
    FROM pg_proc pr WHERE pr.oid = truth_fn::regprocedure;
  IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-04F: the immutability trigger must be owned by postgres'; END IF;
  IF p.prosrc !~ 'NEW\.occurred_at <> OLD\.occurred_at' THEN
    RAISE EXCEPTION 'I-04F: a history item time can never be rewritten in place';
  END IF;
  IF p.prosrc !~ 'OLD\.availability_state = ''DELETED_BY_OWNER''' THEN
    RAISE EXCEPTION 'I-04F: owner deletion must be terminal: a higher revision may never resurrect or relabel it';
  END IF;
  IF p.prosrc !~ 'SHARED_WORLD_HISTORY_OWNER_DELETION_TERMINAL' THEN
    RAISE EXCEPTION 'I-04F: the terminal owner-deletion rule must fail closed with its own bounded class';
  END IF;
  -- The frozen meaning of occurred_at is deployed into the catalog, so the later
  -- slice that writes this column meets the rule where it works.
  IF coalesce(col_description('public.shared_world_history_items'::regclass,
                              (SELECT c.ordinal_position::int FROM information_schema.columns c
                                WHERE c.table_schema = 'public' AND c.table_name = 'shared_world_history_items'
                                  AND c.column_name = 'occurred_at')), '')
     !~ 'establishment/commit instant' THEN
    RAISE EXCEPTION 'I-04F: occurred_at must carry its frozen Shared-World establishment meaning in the catalog';
  END IF;

  -- ===================================================================
  -- The ten new relations: unreachable, policy-free, and NOT a material store.
  -- ===================================================================
  FOREACH target_table IN ARRAY own_tables LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN RAISE EXCEPTION 'I-04F: row level security must be enabled on %', target_table; END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04F: no RLS policy may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = target_table::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-04F: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04F: direct table access stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
    -- Every identifier this migration introduces fits PostgreSQL's 63-byte limit,
    -- so nothing is silently truncated into a collision.
    IF length(split_part(target_table, '.', 2)) > 63 THEN
      RAISE EXCEPTION 'I-04F: relation name % exceeds the PostgreSQL 63-byte identifier limit', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint con
                WHERE con.conrelid = target_table::regclass AND length(con.conname) > 63) THEN
      RAISE EXCEPTION 'I-04F: a constraint name on % exceeds the PostgreSQL 63-byte identifier limit', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class idx JOIN pg_index ix ON ix.indexrelid = idx.oid
                WHERE ix.indrelid = target_table::regclass AND length(idx.relname) > 63) THEN
      RAISE EXCEPTION 'I-04F: an index name on % exceeds the PostgreSQL 63-byte identifier limit', target_table;
    END IF;
  END LOOP;
  -- NOT A MATERIAL STORE, and not a role record or a policy engine. The history
  -- item is an opaque visibility identity: no body, transcript, audio, analysis,
  -- payload, blob, provenance or model context may live in any of these columns.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = ANY(ARRAY['shared_world_history_items',
                                    'shared_world_history_item_baseline_viewers',
                                    'shared_world_history_item_required_approvers',
                                    'shared_world_history_package_manifest_versions',
                                    'shared_world_history_package_manifest_items',
                                    'shared_world_history_package_required_approvers',
                                    'shared_world_history_package_approvals',
                                    'shared_world_history_access_grants',
                                    'shared_world_history_granted_events',
                                    'shared_world_history_grant_commands'])
       AND (c.column_name ~* '(body|text|transcript|audio|content|payload|blob|document|analysis|message|provenance|context|summary|title|label|metadata|owner|admin|creator|initiator|moderator|privilege|capability|permission|entitlement|commercial|safety|moderation|status|state_flag)'
            OR c.data_type IN ('json','jsonb'))
  ) THEN
    RAISE EXCEPTION 'I-04F: the history projection carries visibility and authority metadata only, never material content, a role or a status lifecycle';
  END IF;

  -- ===================================================================
  -- Migration 0087 alters no predecessor table and installs exactly ONE trigger,
  -- on a relation it created itself.
  -- ===================================================================
  IF (SELECT count(*) FROM pg_trigger t
       WHERE t.tgrelid = 'public.shared_world_history_items'::regclass AND NOT t.tgisinternal) <> 1 THEN
    RAISE EXCEPTION 'I-04F: the history projection carries exactly one reviewed immutability trigger';
  END IF;
  FOREACH target_table IN ARRAY ARRAY['public.shared_worlds','public.shared_world_membership_episodes',
                                      'public.shared_world_member_invitations',
                                      'public.shared_world_governance_proposals',
                                      'public.shared_world_governance_approvals',
                                      'public.shared_world_settings_versions',
                                      'public.shared_world_settings_state',
                                      'public.shared_world_standing_context_grants',
                                      'public.shared_world_standing_context_grant_audience'] LOOP
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04F: no RLS policy may be added to %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04F: the Shared substrate stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  -- The canonical membership table still carries exactly the two reviewed I-04E
  -- topology triggers migration 0085 owns, and 0087 added none of its own.
  IF (SELECT count(*) FROM pg_trigger t JOIN pg_proc pr ON pr.oid = t.tgfoid
       WHERE t.tgrelid = 'public.shared_world_membership_episodes'::regclass AND NOT t.tgisinternal
         AND pr.proname = 'terminalize_stale_shared_world_member_invitations_v1') <> 2 THEN
    RAISE EXCEPTION 'I-04F: the two reviewed topology triggers migration 0085 owns must still be in place';
  END IF;
END$$;

COMMIT;
