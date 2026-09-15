-- I-04E - Governed Shared Settings v1 (PART B).
--
-- The fourth and last governed Standard operation this slice implements. CW2-03
-- section 30 freezes that World-level settings affecting all participants
-- require exact unanimous CURRENT-member governance:
--
--   WORLD_SETTINGS_CHANGE -> ALL_CURRENT_MEMBERS
--
-- It lives in its own migration rather than beside the membership lifecycle of
-- 0085 because settings and membership topology have different durable
-- ownership: a settings change does not move topology, terminalizes no member
-- invitation, and a later reviewed settings extension must be able to evolve
-- this table without reopening the membership lifecycle.
--
-- ===========================================================================
-- THE MINIMAL CONCRETE SETTINGS SURFACE
-- ===========================================================================
--
-- Architecture freezes exactly four optional fields for v1:
--
--   name                   nullable text
--   description            nullable text
--   topic                  nullable text
--   general_visual_marker  nullable text
--
-- All four are optional, and a World with NO current settings row is the
-- neutral/default state rather than an error or an implicit empty version. The
-- columns are REAL COLUMNS: there is deliberately no JSON blob, no generic
-- key/value settings store and no common-metadata table, because a generic
-- settings engine would be exactly the polymorphic structure I-04D refused to
-- invent for payloads, and it would make every future reviewed setting invisible
-- to the schema. A later reviewed setting is an ADDITIVE column or an additive
-- table, which this slice forbids nowhere.
--
-- No avatar or media storage decision is taken here: general_visual_marker is a
-- text marker, and where any future image actually lives is a question this
-- slice does not answer. No commercial, safety, moderation, entitlement, block
-- or launch-gate setting exists here at all - CW2-08 owns those - and there is
-- no owner, admin, creator or moderator column, because settings authority is
-- unanimity and never a role.
--
-- ===========================================================================
-- AN OLD APPROVAL IS NEVER A REUSABLE SETTINGS PERMISSION
-- ===========================================================================
--
-- CW2-02 section 31 / B20 binds an approval to an exact operation AND an exact
-- proposed payload version. So a settings version is IMMUTABLE and is proposed
-- once: changing a value - even back to a value some earlier version already
-- carried - is a NEW immutable version under a NEW proposal with NEWLY collected
-- approvals. The frozen I-04D resolver enforces it directly, because the commit
-- must name the exact payload version it is about to apply, and version A's
-- approvals can never satisfy version B.
--
-- The current pointer is the only mutable row, it holds exactly one version per
-- World, and every version it ever pointed at stays exactly as it was.
--
-- ===========================================================================
-- THE PRE-LAUNCH SECURITY BOUNDARY, THE LOCK ORDER AND THE ONE INSTANT
-- ===========================================================================
--
-- As in 0082, 0083, 0084 and 0085: both primitives are fully implemented and
-- executable by NO application role, because the Connected Worlds launch gate
-- does not exist yet. The World row is the canonical first lock, so a settings
-- commit racing a membership topology change has exactly two canonical outcomes
-- and cannot deadlock: the topology change wins and the settings proposal
-- becomes stale, or the settings commit wins and changes no topology at all. One
-- database-owned instant is read once per committed transaction and reused for
-- every moment it persists; no client timestamp is accepted.
--
-- ===========================================================================
-- What this slice deliberately does NOT do
-- ===========================================================================
--
-- It mutates no membership episode, terminalizes no member invitation (topology
-- did not change, so 0085's triggers never fire), touches no grant, audience
-- ceiling or consent history, reads no Personal context, creates and ends no
-- World, and writes no history-access or closed-World entitlement of any kind.
-- Every historical migration, 0001-0085 included, is untouched: this migration
-- alters no predecessor table at all.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE IMMUTABLE PROPOSED SETTINGS VERSION.
--
--    The primary key IS the opaque proposed_payload_version_id I-04D's proposal
--    carries, so there is no second identity to disagree with it, and the
--    four-column composite foreign key makes "this is the exact settings version
--    of that exact WORLD_SETTINGS_CHANGE proposal, in that exact World"
--    structural rather than procedural.
--
--    created_at is database-owned and is the proposal's own capture instant, so
--    one preparation writes exactly one moment. The row is never updated: a
--    changed value is a new version.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_settings_versions (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    governance_operation_kind text NOT NULL,
    name text,
    description text,
    topic text,
    general_visual_marker text,
    created_at timestamptz NOT NULL,
    CONSTRAINT shared_world_settings_versions_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_settings_versions_operation_check
        CHECK (governance_operation_kind = 'WORLD_SETTINGS_CHANGE'),
    CONSTRAINT shared_world_settings_versions_proposal_key UNIQUE (governance_proposal_id),
    -- Lets the current pointer bind (world, version) structurally, so a World can
    -- never point at another World's settings version.
    CONSTRAINT shared_world_settings_versions_world_version_key UNIQUE (world_id, id),
    CONSTRAINT shared_world_settings_versions_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_settings_versions_proposal_fk
        FOREIGN KEY (governance_proposal_id, world_id, governance_operation_kind, id)
        REFERENCES public.shared_world_governance_proposals (id, world_id, operation_kind, proposed_payload_version_id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 2. THE CURRENT SETTINGS POINTER.
--
--    One row per World, and NO row is the neutral/default state. This is the
--    only mutable relation in this migration, and the only thing it can be moved
--    to is another immutable version of the same World.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_settings_state (
    world_id uuid NOT NULL,
    current_settings_version_id uuid NOT NULL,
    changed_at timestamptz NOT NULL,
    CONSTRAINT shared_world_settings_state_pk PRIMARY KEY (world_id),
    CONSTRAINT shared_world_settings_state_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_settings_state_version_fk
        FOREIGN KEY (world_id, current_settings_version_id)
        REFERENCES public.shared_world_settings_versions (world_id, id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 3. The append-only SETTING_CHANGED fact and its durable command history.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_setting_changed_events (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    settings_version_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT shared_world_setting_changed_events_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_setting_changed_events_version_key UNIQUE (settings_version_id),
    CONSTRAINT shared_world_setting_changed_events_proposal_key UNIQUE (governance_proposal_id),
    CONSTRAINT shared_world_setting_changed_events_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_setting_changed_events_version_fk
        FOREIGN KEY (world_id, settings_version_id)
        REFERENCES public.shared_world_settings_versions (world_id, id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_setting_changed_events_proposal_fk
        FOREIGN KEY (governance_proposal_id) REFERENCES public.shared_world_governance_proposals (id) ON DELETE RESTRICT
);

CREATE TABLE public.shared_world_settings_change_commands (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    governance_proposal_id uuid NOT NULL,
    settings_version_id uuid NOT NULL,
    setting_changed_event_id uuid NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT shared_world_settings_change_commands_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_settings_change_commands_proposal_key UNIQUE (governance_proposal_id),
    CONSTRAINT shared_world_settings_change_commands_version_key UNIQUE (settings_version_id),
    CONSTRAINT shared_world_settings_change_commands_event_key UNIQUE (setting_changed_event_id),
    CONSTRAINT shared_world_settings_change_commands_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_settings_change_commands_proposal_fk
        FOREIGN KEY (governance_proposal_id) REFERENCES public.shared_world_governance_proposals (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_settings_change_commands_version_fk
        FOREIGN KEY (world_id, settings_version_id)
        REFERENCES public.shared_world_settings_versions (world_id, id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_settings_change_commands_event_fk
        FOREIGN KEY (setting_changed_event_id) REFERENCES public.shared_world_setting_changed_events (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 4. Deny-by-default posture for all four new tables.
-- ---------------------------------------------------------------------------
ALTER TABLE public.shared_world_settings_versions OWNER TO postgres;
ALTER TABLE public.shared_world_settings_state OWNER TO postgres;
ALTER TABLE public.shared_world_setting_changed_events OWNER TO postgres;
ALTER TABLE public.shared_world_settings_change_commands OWNER TO postgres;
ALTER TABLE public.shared_world_settings_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_settings_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_setting_changed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_settings_change_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_world_settings_versions,
                    public.shared_world_settings_state,
                    public.shared_world_setting_changed_events,
                    public.shared_world_settings_change_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.shared_world_settings_versions, public.shared_world_settings_state, public.shared_world_setting_changed_events, public.shared_world_settings_change_commands FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 5. SETTINGS GOVERNANCE PREPARATION.
--
--    Creates the exact immutable proposed version and captures the exact
--    WORLD_SETTINGS_CHANGE / ALL_CURRENT_MEMBERS proposal over the exact current
--    topology. It mutates no current settings, records no proposer, and reads no
--    clock of its own: the canonical instant is the one the frozen capture
--    primitive owns. A retry under the exact same identities and the exact same
--    four values is answered from immutable history.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.prepare_shared_world_settings_change_governance_v1(
  p_proposal_id uuid, p_membership_snapshot_id uuid, p_settings_version_id uuid, p_world_id uuid,
  p_name text, p_description text, p_topic text, p_general_visual_marker text
) RETURNS TABLE(outcome text, prepared_proposal_id uuid, prepared_snapshot_id uuid,
                prepared_world_id uuid, prepared_operation_kind text, prepared_settings_version_id uuid,
                prepared_approval_rule text, prepared_required_approval_count integer,
                prepared_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_settings_versions;
  captured record;
  world public.shared_worlds;
  historical_required integer;
BEGIN
  IF p_proposal_id IS NULL OR p_membership_snapshot_id IS NULL OR p_settings_version_id IS NULL
     OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, answered from immutable
  -- history. All four values must match exactly, NULLs included: a different
  -- proposed value is a different version and never an equivalent retry.
  SELECT * INTO committed FROM public.shared_world_settings_versions c WHERE c.id = p_settings_version_id;
  IF FOUND THEN
    IF committed.governance_proposal_id = p_proposal_id AND committed.world_id = p_world_id
       AND committed.name IS NOT DISTINCT FROM p_name
       AND committed.description IS NOT DISTINCT FROM p_description
       AND committed.topic IS NOT DISTINCT FROM p_topic
       AND committed.general_visual_marker IS NOT DISTINCT FROM p_general_visual_marker
       AND EXISTS (SELECT 1 FROM public.shared_world_governance_proposals pr
                    WHERE pr.id = committed.governance_proposal_id
                      AND pr.membership_snapshot_id = p_membership_snapshot_id
                      AND pr.proposed_payload_version_id = committed.id
                      AND pr.created_at = committed.created_at) THEN
      SELECT count(*)::integer INTO historical_required
        FROM public.shared_world_membership_snapshot_members m
       WHERE m.membership_snapshot_id = p_membership_snapshot_id;
      IF historical_required = 0 THEN
        RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'PREPARED'::text, committed.governance_proposal_id, p_membership_snapshot_id,
                          committed.world_id, committed.governance_operation_kind, committed.id,
                          'ALL_CURRENT_MEMBERS'::text, historical_required, committed.created_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the exact World row.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO captured FROM public.capture_shared_world_governance_proposal_v1(
    p_proposal_id, p_membership_snapshot_id, p_world_id, 'WORLD_SETTINGS_CHANGE', p_settings_version_id,
    'ALL_CURRENT_MEMBERS', NULL);
  IF captured.outcome <> 'CAPTURED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  BEGIN
    INSERT INTO public.shared_world_settings_versions
      (id, world_id, governance_proposal_id, governance_operation_kind, name, description, topic,
       general_visual_marker, created_at)
    VALUES (p_settings_version_id, p_world_id, p_proposal_id, 'WORLD_SETTINGS_CHANGE', p_name,
            p_description, p_topic, p_general_visual_marker, captured.snapshot_captured_at);
  EXCEPTION WHEN unique_violation THEN
    -- The whole preparation - the captured topology and the proposal included -
    -- rolls back together, so a refused preparation leaves no orphan proposal.
    RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'PREPARED'::text, p_proposal_id, p_membership_snapshot_id, p_world_id,
                      'WORLD_SETTINGS_CHANGE'::text, p_settings_version_id, 'ALL_CURRENT_MEMBERS'::text,
                      captured.required_approval_count, captured.snapshot_captured_at;
END$$;

-- ---------------------------------------------------------------------------
-- 6. THE SETTINGS COMMIT.
--
--    Consumes one CURRENTLY satisfied exact WORLD_SETTINGS_CHANGE proposal and
--    moves the current pointer to that exact immutable version, appends one
--    SETTING_CHANGED fact and persists one durable command - all under the World
--    lock, all on one database-owned instant.
--
--    It carries no actor, exactly as the governed removal does: the authority is
--    the unanimous approval set I-04D recorded, and inventing a "changer"
--    identity would manufacture an initiation authority canon denies. It mutates
--    no membership, so no member invitation is terminalized: the topology did not
--    change, and 0085's triggers fire on membership episodes alone.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_shared_world_settings_change_v1(
  p_command_id uuid, p_proposal_id uuid, p_setting_changed_event_id uuid
) RETURNS TABLE(outcome text, settings_command_id uuid, settings_world_id uuid,
                settings_proposal_id uuid, applied_settings_version_id uuid,
                settings_event_id uuid, settings_changed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_settings_change_commands;
  settings_version public.shared_world_settings_versions;
  world public.shared_worlds;
  proof record;
  target_world uuid;
  change_instant timestamptz;
BEGIN
  IF p_command_id IS NULL OR p_proposal_id IS NULL OR p_setting_changed_event_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS. The committed answer is historical: a later
  -- reviewed settings change may legitimately have moved the current pointer on,
  -- and this command must not start answering differently because of that. What
  -- must still hold is that the immutable facts it wrote remain coherent.
  SELECT * INTO committed FROM public.shared_world_settings_change_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.governance_proposal_id = p_proposal_id
       AND committed.setting_changed_event_id = p_setting_changed_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_setting_changed_events ev
         WHERE ev.id = committed.setting_changed_event_id
           AND ev.settings_version_id = committed.settings_version_id
           AND ev.governance_proposal_id = committed.governance_proposal_id
           AND ev.world_id = committed.world_id
           AND ev.occurred_at = committed.committed_at
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'SETTINGS_CHANGED'::text, committed.id, committed.world_id,
                          committed.governance_proposal_id, committed.settings_version_id,
                          committed.setting_changed_event_id, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- WORLD-FIRST ORDER: pre-read only enough of the proposal to discover the
  -- World, then lock the World before anything else.
  SELECT pr.world_id INTO target_world FROM public.shared_world_governance_proposals pr WHERE pr.id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.shared_world_settings_change_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.governance_proposal_id = p_proposal_id
       AND committed.setting_changed_event_id = p_setting_changed_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_setting_changed_events ev
         WHERE ev.id = committed.setting_changed_event_id
           AND ev.settings_version_id = committed.settings_version_id
           AND ev.governance_proposal_id = committed.governance_proposal_id
           AND ev.world_id = committed.world_id
           AND ev.occurred_at = committed.committed_at
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'SETTINGS_CHANGED'::text, committed.id, committed.world_id,
                          committed.governance_proposal_id, committed.settings_version_id,
                          committed.setting_changed_event_id, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT * INTO settings_version FROM public.shared_world_settings_versions v
   WHERE v.governance_proposal_id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE CURRENT GOVERNANCE PROOF, revalidated in the SAME transaction as the
  -- mutation: exact operation, exact version, exact topology, every required
  -- approval, ACTIVE / STANDARD only. Version A's approvals can never apply
  -- version B, so an old approval is never a reusable settings permission.
  SELECT * INTO proof FROM public.resolve_shared_world_governance_approval_v1(
    p_proposal_id, 'WORLD_SETTINGS_CHANGE', settings_version.id);
  IF proof.outcome <> 'SATISFIED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  change_instant := clock_timestamp();

  BEGIN
    -- The pointer is created on the first committed change and moved on every
    -- later one, atomically, under the World lock. No row at all is the neutral
    -- state, and a moved pointer rewrites no version it ever pointed at.
    INSERT INTO public.shared_world_settings_state (world_id, current_settings_version_id, changed_at)
    VALUES (settings_version.world_id, settings_version.id, change_instant)
    ON CONFLICT ON CONSTRAINT shared_world_settings_state_pk
      DO UPDATE SET current_settings_version_id = settings_version.id, changed_at = change_instant;

    INSERT INTO public.shared_world_setting_changed_events
      (id, world_id, settings_version_id, governance_proposal_id, occurred_at)
    VALUES (p_setting_changed_event_id, settings_version.world_id, settings_version.id, p_proposal_id, change_instant);

    INSERT INTO public.shared_world_settings_change_commands
      (id, world_id, governance_proposal_id, settings_version_id, setting_changed_event_id, committed_at)
    VALUES (p_command_id, settings_version.world_id, p_proposal_id, settings_version.id, p_setting_changed_event_id, change_instant);
  EXCEPTION WHEN unique_violation THEN
    -- A supplied persistence identity was already taken, or this exact version
    -- was already applied under another command id. The whole change rolls back.
    RAISE EXCEPTION 'SHARED_WORLD_SETTINGS_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'SETTINGS_CHANGED'::text, p_command_id, settings_version.world_id, p_proposal_id,
                      settings_version.id, p_setting_changed_event_id, change_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 7. Ownership and THE PRE-LAUNCH ACL. There is no GRANT statement here either.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.prepare_shared_world_settings_change_governance_v1(uuid, uuid, uuid, uuid, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.commit_shared_world_settings_change_v1(uuid, uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.prepare_shared_world_settings_change_governance_v1(uuid, uuid, uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_shared_world_settings_change_v1(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.prepare_shared_world_settings_change_governance_v1(uuid, uuid, uuid, uuid, text, text, text, text) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_settings_change_v1(uuid, uuid, uuid) FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 8. Terminal self-assertions. The migration refuses to deploy a settings
--    surface that is application-executable, generic, caller-identified,
--    unpinned, wrongly ordered, multi-clocked, membership-mutating,
--    invitation-terminalizing, grant-touching or role-bearing.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  prepare_fn text := 'public.prepare_shared_world_settings_change_governance_v1(uuid,uuid,uuid,uuid,text,text,text,text)';
  commit_fn text := 'public.commit_shared_world_settings_change_v1(uuid,uuid,uuid)';
  own_tables text[] := ARRAY['public.shared_world_settings_versions',
                             'public.shared_world_settings_state',
                             'public.shared_world_setting_changed_events',
                             'public.shared_world_settings_change_commands'];
  fn_name text;
  p record;
  in_names text[];
  in_types text[];
  out_names text[];
  arg_name text;
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
  world_pos integer;
  pointer_pos integer;
  settings_columns text[];
BEGIN
  FOREACH fn_name IN ARRAY ARRAY[prepare_fn, commit_fn] LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn_name::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-04E: % must be owned by postgres', fn_name; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-04E: % must be SECURITY DEFINER', fn_name; END IF;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-04E: % mutates or locks and must be VOLATILE', fn_name; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-04E: % must pin an empty search_path', fn_name;
    END IF;
    IF has_function_privilege('public', fn_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04E: PUBLIC must not execute the governed settings surface before the launch gate exists';
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, fn_name, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-04E: % must not execute the governed settings surface before the launch gate exists', target_role;
      END IF;
    END LOOP;

    IF p.prosrc ~* 'conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|consent|matching|introduction' THEN
      RAISE EXCEPTION 'I-04E: % must not read Personal context or touch grant and consent state', fn_name;
    END IF;
    IF p.prosrc ~* 'DELETE FROM' OR p.prosrc ~* 'TRUNCATE' THEN
      RAISE EXCEPTION 'I-04E: % may never delete canonical history', fn_name;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' THEN
      RAISE EXCEPTION 'I-04E: % locks rows in the canonical order, never a table and never an advisory key', fn_name;
    END IF;
    -- SETTINGS CHANGE NOTHING ELSE: no membership, no invitation, no World, no
    -- governance, no history access.
    IF p.prosrc ~ 'INSERT INTO public\.shared_world_membership_episodes|UPDATE public\.shared_world_membership_episodes' THEN
      RAISE EXCEPTION 'I-04E: % must open and close no membership episode', fn_name;
    END IF;
    IF p.prosrc ~ 'public\.shared_world_member_invitations' THEN
      RAISE EXCEPTION 'I-04E: % must terminalize no member invitation: a settings change moves no topology', fn_name;
    END IF;
    IF p.prosrc ~ 'UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds' THEN
      RAISE EXCEPTION 'I-04E: % must not create, close or mutate a Shared World', fn_name;
    END IF;
    IF p.prosrc ~ 'INSERT INTO public\.shared_world_governance_approvals|UPDATE public\.shared_world_governance_approvals'
       OR p.prosrc ~ 'INSERT INTO public\.shared_world_governance_proposals|UPDATE public\.shared_world_governance_proposals'
       OR p.prosrc ~ 'INSERT INTO public\.shared_world_membership_snapshot' THEN
      RAISE EXCEPTION 'I-04E: % must never manufacture governance: proposals and approvals belong to I-04D', fn_name;
    END IF;
    IF p.prosrc ~ 'READ_ONLY_CLOSED|closed_at|birth_basis|WORLD_ENDED|HISTORY_ACCESS_GRANT|CLOSED_WORLD_VIEW_ENTITLEMENT' THEN
      RAISE EXCEPTION 'I-04E: % must not write a closure, history-access or entitlement literal it does not own', fn_name;
    END IF;
    -- SETTINGS AUTHORITY IS UNANIMITY, NEVER A ROLE: no actor of any kind is
    -- derived or recorded, in either primitive.
    IF p.prosrc ~ 'auth\.uid' THEN
      RAISE EXCEPTION 'I-04E: % records no settings actor: the authority is the exact unanimous approval set', fn_name;
    END IF;
    IF p.prosrc ~ 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp' THEN
      RAISE EXCEPTION 'I-04E: % must persist one database-owned instant, never a second clock read', fn_name;
    END IF;
    -- WORLD-FIRST, in both primitives.
    IF strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = ') = 0
       OR p.prosrc !~ 'FOR UPDATE' THEN
      RAISE EXCEPTION 'I-04E: % must lock the exact World row', fn_name;
    END IF;
    IF (length(p.prosrc) - length(replace(p.prosrc, 'FOR UPDATE', ''))) / length('FOR UPDATE') <> 1 THEN
      RAISE EXCEPTION 'I-04E: % takes exactly one row lock of its own, and it is the World row', fn_name;
    END IF;
  END LOOP;

  -- ===================================================================
  -- PREPARATION: it consumes I-04D's capture, mutates no current settings and
  -- reads no clock of its own.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes, pr.proargtypes INTO p
    FROM pg_proc pr WHERE pr.oid = prepare_fn::regprocedure;
  -- Argument NAMES from proargnames / proargmodes and TYPES from proargtypes: a
  -- rendered signature folds this function's RETURNS TABLE columns into the same
  -- string, so it is not the authority.
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
         array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
    INTO in_names, out_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_proposal_id','p_membership_snapshot_id','p_settings_version_id','p_world_id',
                       'p_name','p_description','p_topic','p_general_visual_marker'] THEN
    RAISE EXCEPTION 'I-04E: the settings preparation must accept exactly the frozen v1 surface, not %', in_names;
  END IF;
  SELECT array_agg(t.typname::text ORDER BY a.ord) INTO in_types
    FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
    JOIN pg_type t ON t.oid = a.argtype;
  IF in_types <> ARRAY['uuid','uuid','uuid','uuid','text','text','text','text'] THEN
    RAISE EXCEPTION 'I-04E: the settings preparation must accept four identities and four optional texts, not %', in_types;
  END IF;
  -- The ban is non-vacuous by construction: the exact list above proves these
  -- really are the parameter names being scanned. No caller may supply a
  -- topology, an approver, a count, a clock or any authority.
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'initiator|proposer|actor|owner|admin|approver|approval_set|member_ids|episode|audience|count|launch|gate|timestamp|instant|_at$' THEN
      RAISE EXCEPTION 'I-04E: the settings preparation must not accept a topology, approver, count, clock or authority parameter';
    END IF;
  END LOOP;
  IF p.prosrc !~ 'public\.capture_shared_world_governance_proposal_v1\(' THEN
    RAISE EXCEPTION 'I-04E: the settings preparation must capture its proposal through the frozen I-04D primitive';
  END IF;
  IF p.prosrc !~ '''WORLD_SETTINGS_CHANGE'', p_settings_version_id,\s*\n\s*''ALL_CURRENT_MEMBERS'', NULL\)' THEN
    RAISE EXCEPTION 'I-04E: a settings proposal is exactly WORLD_SETTINGS_CHANGE under ALL_CURRENT_MEMBERS with no exclusion';
  END IF;
  IF p.prosrc ~ 'clock_timestamp\(\)' THEN
    RAISE EXCEPTION 'I-04E: the settings preparation must reuse the capture instant, never read a second clock';
  END IF;
  IF p.prosrc !~ 'captured\.snapshot_captured_at' THEN
    RAISE EXCEPTION 'I-04E: the settings preparation must persist the exact instant the frozen capture owned';
  END IF;
  IF p.prosrc ~ 'public\.shared_world_settings_state' THEN
    RAISE EXCEPTION 'I-04E: preparing a settings change must not move the current settings pointer';
  END IF;
  -- Every proposed value is compared exactly, NULLs included: a different value
  -- is a different version and never an equivalent retry.
  FOREACH arg_name IN ARRAY ARRAY['name','description','topic','general_visual_marker'] LOOP
    IF strpos(p.prosrc, 'committed.' || arg_name || ' IS NOT DISTINCT FROM p_' || arg_name) = 0 THEN
      RAISE EXCEPTION 'I-04E: an equivalent settings retry must match % exactly, NULL included', arg_name;
    END IF;
  END LOOP;

  -- ===================================================================
  -- COMMIT: exact proposal and version, current governance, one pointer.
  -- ===================================================================
  SELECT pr.prosrc, pr.proargnames, pr.proargmodes, pr.proargtypes INTO p
    FROM pg_proc pr WHERE pr.oid = commit_fn::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
         array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
    INTO in_names, out_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id','p_proposal_id','p_setting_changed_event_id'] THEN
    RAISE EXCEPTION 'I-04E: the settings commit must accept exactly three opaque identities, not %', in_names;
  END IF;
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'user_id|actor|approver|member|episode|snapshot|timestamp|instant|count|name|description|topic|marker|_at$' THEN
      RAISE EXCEPTION 'I-04E: the settings commit must not accept an actor, a value or a clock parameter';
    END IF;
  END LOOP;
  IF p.prosrc !~ 'public\.resolve_shared_world_governance_approval_v1\(\s*\n?\s*p_proposal_id, ''WORLD_SETTINGS_CHANGE'', settings_version\.id\)' THEN
    RAISE EXCEPTION 'I-04E: a settings commit must revalidate the exact operation AND the exact version it is about to apply';
  END IF;
  IF p.prosrc !~ 'change_instant := clock_timestamp\(\);' THEN
    RAISE EXCEPTION 'I-04E: the settings commit instant must come from the database clock, never from a caller';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'change_instant := ', ''))) / length('change_instant := ') <> 1 THEN
    RAISE EXCEPTION 'I-04E: the canonical settings instant must be captured exactly once';
  END IF;
  -- The pointer is written only AFTER the World lock and the governance proof.
  world_pos := strpos(p.prosrc, 'FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
  pointer_pos := strpos(p.prosrc, 'INSERT INTO public.shared_world_settings_state');
  IF world_pos = 0 OR pointer_pos = 0 OR world_pos > pointer_pos
     OR strpos(p.prosrc, 'public.resolve_shared_world_governance_approval_v1') > pointer_pos THEN
    RAISE EXCEPTION 'I-04E: a settings commit must lock the World and prove current governance before it moves the pointer';
  END IF;
  -- An immutable version is never rewritten by the commit that applies it.
  IF p.prosrc ~ 'UPDATE public\.shared_world_settings_versions' THEN
    RAISE EXCEPTION 'I-04E: a committed settings version is immutable: a changed value is a NEW version';
  END IF;

  -- ===================================================================
  -- The four new tables: unreachable, policy-free, trigger-free, and neither a
  -- generic settings engine nor a role record.
  -- ===================================================================
  FOREACH target_table IN ARRAY own_tables LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN RAISE EXCEPTION 'I-04E: row level security must be enabled on %', target_table; END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04E: no RLS policy may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION 'I-04E: migration 0086 installs no trigger on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = target_table::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-04E: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04E: direct table access stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  -- NOT A GENERIC SETTINGS ENGINE, and not a role record.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_world_settings_versions','shared_world_settings_state',
                            'shared_world_setting_changed_events','shared_world_settings_change_commands')
       AND (c.column_name ~* '(owner|admin|creator|initiator|proposer|moderator|privilege|capability|permission|entitlement|commercial|safety|moderation|flag|metadata|settings_json|payload|blob|document)'
            OR c.data_type IN ('json','jsonb','ARRAY'))
  ) THEN
    RAISE EXCEPTION 'I-04E: Shared settings are exact columns under unanimity, never a JSON blob, a role or a policy engine';
  END IF;
  -- The exact frozen v1 surface, each field optional, on the immutable version.
  SELECT array_agg(c.column_name::text ORDER BY c.ordinal_position) INTO settings_columns
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = 'shared_world_settings_versions';
  IF settings_columns[1:9] <> ARRAY['id','world_id','governance_proposal_id','governance_operation_kind',
                                    'name','description','topic','general_visual_marker','created_at'] THEN
    RAISE EXCEPTION 'I-04E: the frozen v1 settings surface must be exactly these columns, in place, not %', settings_columns;
  END IF;
  FOREACH arg_name IN ARRAY ARRAY['name','description','topic','general_visual_marker'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = 'shared_world_settings_versions'
         AND c.column_name = arg_name AND c.data_type = 'text' AND c.is_nullable = 'YES'
         AND c.column_default IS NULL
    ) THEN
      RAISE EXCEPTION 'I-04E: the % setting must be optional nullable text with no default', arg_name;
    END IF;
  END LOOP;
  -- The settings version binds its exact proposal, World, operation and version.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
     WHERE con.conrelid = 'public.shared_world_settings_versions'::regclass AND con.contype = 'f'
       AND con.confrelid = 'public.shared_world_governance_proposals'::regclass
       AND pg_get_constraintdef(con.oid) LIKE '%(governance_proposal_id, world_id, governance_operation_kind, id)%'
  ) THEN
    RAISE EXCEPTION 'I-04E: a settings version must bind its exact proposal, World, operation and version structurally';
  END IF;
  -- A World can never point at another World's settings version.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
     WHERE con.conrelid = 'public.shared_world_settings_state'::regclass AND con.contype = 'f'
       AND con.confrelid = 'public.shared_world_settings_versions'::regclass
       AND pg_get_constraintdef(con.oid) LIKE '%(world_id, current_settings_version_id)%'
  ) THEN
    RAISE EXCEPTION 'I-04E: the current settings pointer must bind its World and version together';
  END IF;

  -- ===================================================================
  -- Migration 0086 alters no predecessor table and installs no trigger anywhere.
  -- ===================================================================
  FOREACH target_table IN ARRAY ARRAY['public.shared_worlds','public.shared_world_membership_episodes',
                                      'public.shared_world_member_invitations',
                                      'public.shared_world_governance_proposals',
                                      'public.shared_world_governance_approvals',
                                      'public.shared_world_standing_context_grants',
                                      'public.shared_world_standing_context_grant_audience'] LOOP
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04E: no RLS policy may be added to %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04E: the Shared substrate stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  -- The canonical membership table still carries exactly the two reviewed I-04E
  -- topology triggers migration 0085 installed, and 0086 added none of its own.
  IF (SELECT count(*) FROM pg_trigger t JOIN pg_proc pr ON pr.oid = t.tgfoid
       WHERE t.tgrelid = 'public.shared_world_membership_episodes'::regclass AND NOT t.tgisinternal
         AND pr.proname = 'terminalize_stale_shared_world_member_invitations_v1') <> 2 THEN
    RAISE EXCEPTION 'I-04E: the two reviewed topology triggers migration 0085 owns must still be in place';
  END IF;
END$$;

COMMIT;
