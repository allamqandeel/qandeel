-- S4-03 — Shared Membership Lifecycle, Governance, Settings & Historical Access Production Integration v1.
--
-- Additive and forward-only. Migrations 0001–0139 are untouched: no historical table, column, constraint body, trigger,
-- function body or policy is dropped, replaced or rewritten. This migration consumes the frozen I-04 lifecycle runtime —
-- the 0083 voluntary leave, the 0084 governance substrate (capture / approval / satisfaction), the 0085 governed removal,
-- the 0086 governed settings, the 0087 selective-history package / approval / grant (as 0119 remediated them), the 0088
-- Standard closure and its closed-view entitlement, the 0089 material resolver — through the S4-01 (0138) Shared launch
-- gate, and adds only the reviewed Product execution boundary over them. Its ONE table is the Product origin of a proposal
-- this boundary opens (who proposed it, and — for a reachability act — the target's Shared-ID epoch it was bound to); it
-- is no second membership, governance, settings, history, closure, material or authority model, and it grants nothing.
--
-- ## What this adds
--
--   1. TWO capability scopes on the S4-01 launch gate — `SHARED_GOVERNANCE` (governed removal, settings and World end:
--      the proposal and its approvals) and `SHARED_HISTORY_ACCESS` (audience widening through a history package). The
--      0138 scope CHECK is widened by exactly those two literals; every gate rule stays the 0138 rule and this migration
--      configures nothing (both start closed). Voluntary leave, owner deletion and closed-World reading are NOT bound to
--      either scope: leaving is a human exit right, deletion is a privacy mutation, and a valid closed-view entitlement is
--      not a rollout toggle (CW2-03 §23, §35 / C31, §32–§33).
--   2. Server-derived persistence identities: every identity a frozen primitive needs is derived from the human's command
--      id (or, for the act that a satisfied proposal or package makes, from that proposal / package) under a per-role
--      namespace. No client chooses a proposal, snapshot, payload, approval, manifest, grant, event or command identity.
--   3. Product-safe opaque member handles: a member is addressed by a handle derived from the exact World and the exact
--      human, which the server re-resolves against the World's CURRENT topology. No client sends or receives a user id.
--   4. The reads of one World's management (current members only): its committed settings, its current members with
--      their handles, the CURRENT proposals that wait on THIS human's approval (or that this human already approved),
--      the history-package requests that wait on THIS human's material authority, and the exact candidates for sharing
--      earlier history with one member. Plus: the committed World names (the World label), the closed Worlds the human is
--      entitled to view, their entitled material, and the human's OWN material in Worlds they no longer belong to.
--   5. The human's commands: leave; propose a settings change, a removal or the World's end; propose adding a member or
--      bringing a former member back by the target's CURRENT Shared ID; approve a proposal (the approval that satisfies a
--      proposal also commits its operation — or, for a reachability act, dispatches the invitation / opens the rejoin — in
--      the same transaction, through the frozen core; the operation carries no actor: its authority is the approval set);
--      the target's acceptance; propose sharing earlier history with one current member; approve a history package (the
--      approval that completes the exact required set also commits the grant through the frozen core) — from inside the
--      World as a current member, or through the account / privacy surface as a former member who keeps material authority.
--
-- ## Reachability by CURRENT Shared ID (P1 §5.2–§5.3; Product Owner decision 2026-10-05)
--
--   The proposer types the target's Shared ID. It is normalized and turned into its lookup reference exactly as 0138 does;
--   the target is resolved internally under its credential row (FOR SHARE) and never returned. The proposal is bound to the
--   target's credential EPOCH at that moment. Every later act — each approval, the dispatch, the acceptance, the rejoin —
--   re-reads the target's current epoch under the same row lock and refuses unless it is still the bound one. A rotation
--   therefore makes every not-yet-accepted add / rejoin of an older epoch permanently non-actionable (epochs only grow, so
--   nothing can revive). Every well-formed Shared ID — nobody, a rotated-away one, the caller's own, a current member's —
--   gets the same SUBMITTED answer; nothing about the target is returned or shown before acceptance: approvers see that an
--   exact add / rejoin request exists and who proposed it, and the target sees only who proposed it. The frozen 0085 cores
--   are consumed unchanged.
--
-- ## Deliberately NOT here (reported, not invented)
--
--   - No decline, cancel, withdrawal or expiry of a proposal, a member invitation or a package (none exists in canon or in
--     0084 / 0085 / 0087).
--   - No list of who approved and who did not: a human sees the proposer's Name, their OWN approval and the neutral
--     progress (approved / required) only. The proposer gains no authority.
--   - No grant withdrawal after viewing (deferred frozen policy, CW2-03 §50).
--
-- ## Boundary (continues 0138 / 0139)
--
--   - every privileged part lives in `shared_private` as a pinned SECURITY DEFINER that derives the human from
--     `auth.uid()`; every exposed `public` function is a SECURITY INVOKER one-liner;
--   - `authenticated` executes exactly the S4-03 human commands; `service_role` gains NOTHING; no table grant is made;
--   - no public `commit_%` name is added (the 0071 single-committing-authority census is untouched);
--   - every frozen 0083–0088 primitive stays executable by no application role.
--
-- ## Cross-World binding (applied before ANY replay answer)
--
--   A committed command is answered as committed only after it is proved to belong to the exact supplied World, the exact
--   operation family and the exact request (target / values / item set) and the exact human; anything else is one bounded
--   UNAVAILABLE that names nothing.
--
-- ## Lock order (continues 0138 / 0139 / 0083–0088; never reversed)
--
--   0. the gate row of the capability            (FOR SHARE — inside bind_shared_launch_gate_v1; gated commands only)
--   1. the World row                              (FOR UPDATE — taken by the wrapper, re-taken as a no-op by the cores)
--   2. the reachability target's credential row   (FOR SHARE — add / rejoin only; 0081 rotation takes it FOR UPDATE and
--                                                  never takes a World row, so no cycle can form)
--   3. the proposal / the invitation / the manifest (FOR UPDATE — inside the frozen cores)
--   4. the exact history items (identity order)   / the removal target's episode (inside the frozen cores)
--
-- No advisory lock, table lock or process mutex is used.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. The two additive gate scopes. The constraint is replaced by the same constraint plus two literals; no row, state,
--    event or evidence is touched, and the three earlier scopes keep their exact meaning.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE shared_private.shared_launch_capability_states DROP CONSTRAINT shared_launch_capability_states_scope_check;
ALTER TABLE shared_private.shared_launch_capability_states ADD CONSTRAINT shared_launch_capability_states_scope_check
    CHECK (capability_scope IN ('SHARED_DIRECT_INVITATION', 'SHARED_DIRECT_WORLD_BIRTH', 'SHARED_CONVERSATION',
                                'SHARED_GOVERNANCE', 'SHARED_HISTORY_ACCESS'));

-- ---------------------------------------------------------------------------------------------------------------------
-- 1b. The Product origin of a proposal opened through this boundary. One row per proposal, written in the same
--     transaction as the frozen preparation: the command that opened it, the human who proposed it (shown by Name — the
--     proposer holds no authority; the approval set remains the only authority), and, for ADD_MEMBER / REJOIN_MEMBER only,
--     the target's credential epoch the proposal is bound to and a digest that proves a replay names the exact same
--     Shared ID without keeping it. No Shared ID, lookup reference or target is ever stored here beyond the frozen payload.
--     Sealed: RLS on, no policy, no application role.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE shared_private.shared_governance_proposal_origins (
    governance_proposal_id uuid NOT NULL,
    world_id uuid NOT NULL,
    origin_command_id uuid NOT NULL,
    proposer_user_id uuid NOT NULL,
    operation_kind text NOT NULL,
    target_credential_epoch bigint,
    request_digest uuid,
    created_at timestamptz NOT NULL,
    CONSTRAINT shared_governance_proposal_origins_pk PRIMARY KEY (governance_proposal_id),
    CONSTRAINT shared_governance_proposal_origins_command_key UNIQUE (origin_command_id),
    CONSTRAINT shared_governance_proposal_origins_operation_check
        CHECK (operation_kind IN ('REMOVE_MEMBER', 'WORLD_SETTINGS_CHANGE', 'END_WORLD', 'ADD_MEMBER', 'REJOIN_MEMBER')),
    CONSTRAINT shared_governance_proposal_origins_reachability_check
        CHECK ((operation_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER'))
               = (target_credential_epoch IS NOT NULL AND request_digest IS NOT NULL)),
    CONSTRAINT shared_governance_proposal_origins_epoch_check
        CHECK (target_credential_epoch IS NULL OR target_credential_epoch >= 1),
    CONSTRAINT shared_governance_proposal_origins_proposal_fk
        FOREIGN KEY (governance_proposal_id) REFERENCES public.shared_world_governance_proposals (id) ON DELETE RESTRICT,
    CONSTRAINT shared_governance_proposal_origins_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_governance_proposal_origins_proposer_fk
        FOREIGN KEY (proposer_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);
ALTER TABLE shared_private.shared_governance_proposal_origins OWNER TO postgres;
ALTER TABLE shared_private.shared_governance_proposal_origins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shared_private.shared_governance_proposal_origins FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE shared_private.shared_governance_proposal_origins FROM service_role';
END IF; END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Internal helpers. Executable by no application role.
-- ---------------------------------------------------------------------------------------------------------------------

-- One derived identity: a pure function of a namespace and a key. No actor, no table, no clock.
CREATE FUNCTION shared_private.derive_shared_lifecycle_identity_v1(p_namespace text, p_key text)
RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 3) || substr(h, 21, 12))::uuid
    FROM (SELECT encode(sha256(convert_to('QANDEEL_S4_03_SHARED_LIFECYCLE_IDENTITY_V1' || E'\n' || p_namespace || E'\n'
                                          || lower(p_key), 'UTF8')), 'hex') AS h) d;
$$;

-- The opaque handle of one human in one World: stable for that pair, meaningless anywhere else, never a user id.
CREATE FUNCTION shared_private.shared_member_handle_v1(p_world_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT shared_private.derive_shared_lifecycle_identity_v1('MEMBER_HANDLE', p_world_id::text || ':' || p_user_id::text);
$$;

-- Which S4-03 command family already holds this command id, if any. A command id answers exactly one family.
CREATE FUNCTION shared_private.shared_lifecycle_command_family_v1(p_command_id uuid)
RETURNS text
LANGUAGE sql STABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.shared_world_voluntary_leave_commands c WHERE c.id = p_command_id) THEN 'LEAVE'
    WHEN EXISTS (SELECT 1 FROM public.shared_world_governance_proposals p
                  WHERE p.id = shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL', p_command_id::text)) THEN 'PROPOSAL'
    WHEN EXISTS (SELECT 1 FROM public.shared_world_governance_approvals a
                  WHERE a.id = shared_private.derive_shared_lifecycle_identity_v1('APPROVAL', p_command_id::text)) THEN 'APPROVAL'
    WHEN EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_versions m
                  WHERE m.id = shared_private.derive_shared_lifecycle_identity_v1('HISTORY_MANIFEST', p_command_id::text)) THEN 'HISTORY_PROPOSAL'
    WHEN EXISTS (SELECT 1 FROM public.shared_world_history_package_approvals a
                  WHERE a.id = shared_private.derive_shared_lifecycle_identity_v1('HISTORY_APPROVAL', p_command_id::text)) THEN 'HISTORY_APPROVAL'
    WHEN EXISTS (SELECT 1 FROM public.shared_world_member_acceptance_commands c WHERE c.id = p_command_id)
      OR EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands c WHERE c.id = p_command_id) THEN 'ACCEPTANCE'
  END;
$$;

-- Whether one human holds an OPEN episode in one ACTIVE / STANDARD World. Always a real boolean.
CREATE FUNCTION shared_private.is_current_shared_member_v1(p_world_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM public.shared_world_membership_episodes e JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.world_id = p_world_id AND e.user_id = p_user_id AND e.ended_at IS NULL
       AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'), false);
$$;

-- Whether a proposal's captured topology is EXACTLY the World's current open-episode set, by episode identity, in both
-- directions — the frozen I-04D staleness test, read (never written) for presentation. Always a real boolean.
CREATE FUNCTION shared_private.is_current_shared_proposal_topology_v1(p_proposal_id uuid)
RETURNS boolean
LANGUAGE sql STABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                        WHERE e.world_id = p.world_id AND e.ended_at IS NULL
                          AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_snapshot_members m
                                           WHERE m.membership_snapshot_id = p.membership_snapshot_id AND m.membership_episode_id = e.id))
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_snapshot_members m
                        WHERE m.membership_snapshot_id = p.membership_snapshot_id
                          AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                                           WHERE e.id = m.membership_episode_id AND e.world_id = p.world_id AND e.ended_at IS NULL))
      FROM public.shared_world_governance_proposals p WHERE p.id = p_proposal_id), false);
$$;

-- Whether the act a proposal governs has already happened (by the approval that satisfied it): the removal, settings
-- change or World end is committed; the add-member invitation is dispatched; the rejoin is committed by its target.
CREATE FUNCTION shared_private.is_committed_shared_proposal_v1(p_proposal_id uuid)
RETURNS boolean
LANGUAGE sql STABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(
    EXISTS (SELECT 1 FROM public.shared_world_member_removal_commands c WHERE c.governance_proposal_id = p_proposal_id)
    OR EXISTS (SELECT 1 FROM public.shared_world_settings_change_commands c WHERE c.governance_proposal_id = p_proposal_id)
    OR EXISTS (SELECT 1 FROM public.shared_world_standard_end_commands c WHERE c.governance_proposal_id = p_proposal_id)
    OR EXISTS (SELECT 1 FROM public.shared_world_member_invitations i WHERE i.governance_proposal_id = p_proposal_id)
    OR EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands c WHERE c.governance_proposal_id = p_proposal_id), false);
$$;

-- The neutral progress of one proposal: approvals recorded against its exact captured topology, and the number its rule
-- requires (the captured members, minus the excluded removal target). Counts only — never who.
CREATE FUNCTION shared_private.shared_proposal_progress_v1(p_proposal_id uuid)
RETURNS TABLE (approved_count integer, required_count integer)
LANGUAGE sql STABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT count(*)::integer FROM public.shared_world_governance_approvals a WHERE a.proposal_id = p.id),
         (SELECT count(*)::integer FROM public.shared_world_membership_snapshot_members m
           WHERE m.membership_snapshot_id = p.membership_snapshot_id
             AND m.membership_episode_id IS DISTINCT FROM p.excluded_membership_episode_id)
    FROM public.shared_world_governance_proposals p WHERE p.id = p_proposal_id;
$$;

-- The exact target of an ADD_MEMBER / REJOIN_MEMBER proposal, from the frozen payload (NULL for every other kind).
CREATE FUNCTION shared_private.shared_reachability_target_v1(p_proposal_id uuid)
RETURNS uuid
LANGUAGE sql STABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(
    (SELECT a.target_user_id FROM public.shared_world_add_member_payload_versions a WHERE a.governance_proposal_id = p_proposal_id),
    (SELECT r.target_user_id FROM public.shared_world_rejoin_payload_versions r WHERE r.governance_proposal_id = p_proposal_id));
$$;

-- Whether a proposal may still be acted on as far as REACHABILITY goes: always for a non-reachability kind; for an add /
-- rejoin, only while the target's CURRENT credential epoch is the exact epoch the proposal was bound to (a rotation ends
-- it, permanently) and the target is still eligible (never a member for an add; no open episode for a rejoin). Always a
-- real boolean.
CREATE FUNCTION shared_private.is_actionable_shared_reachability_v1(p_proposal_id uuid)
RETURNS boolean
LANGUAGE sql STABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN p.operation_kind NOT IN ('ADD_MEMBER', 'REJOIN_MEMBER') THEN true
      ELSE EXISTS (
        SELECT 1 FROM shared_private.shared_governance_proposal_origins o
          JOIN public.shared_world_invite_credential_state s
            ON s.user_id = shared_private.shared_reachability_target_v1(p.id) AND s.epoch = o.target_credential_epoch
         WHERE o.governance_proposal_id = p.id AND o.operation_kind = p.operation_kind)
       AND CASE p.operation_kind
             WHEN 'ADD_MEMBER' THEN NOT EXISTS (
               SELECT 1 FROM public.shared_world_membership_episodes e
                WHERE e.world_id = p.world_id AND e.user_id = shared_private.shared_reachability_target_v1(p.id))
             ELSE NOT EXISTS (
               SELECT 1 FROM public.shared_world_membership_episodes e
                WHERE e.world_id = p.world_id AND e.user_id = shared_private.shared_reachability_target_v1(p.id)
                  AND e.ended_at IS NULL)
           END
    END
      FROM public.shared_world_governance_proposals p WHERE p.id = p_proposal_id), false);
$$;

-- The history items a human may put into a package for one grantee: human words the human can see now, whose
-- historical authority is positively RESOLVED to an exact human set (QANDEEL output stays UNRESOLVED and is never
-- offered — CW2-02 §38; I-04G §4), and which the grantee cannot already see. Membership is NOT historical / material
-- authority: an item whose author has since left is still offered, and that former member approves their own words
-- through the account / privacy surface (CW2-03 §24; 0119). Identity and time only.
CREATE FUNCTION shared_private.shared_history_share_candidates_v1(p_world_id uuid, p_reader_id uuid, p_grantee_id uuid)
RETURNS TABLE (material_id uuid, history_item_id uuid)
LANGUAGE sql STABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  WITH grantee_visible AS (
    SELECT g.history_item_id FROM public.resolve_shared_world_history_visibility_v1(p_world_id, p_grantee_id) g
  )
  SELECT m.material_id, m.history_item_id
    FROM public.resolve_shared_world_material_v1(p_world_id, p_reader_id) m
   WHERE m.material_kind = 'HUMAN_TEXT' AND m.text_body IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.shared_world_material_historical_authority a
                  WHERE a.material_id = m.material_id AND a.resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT')
     AND EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra WHERE ra.history_item_id = m.history_item_id)
     AND NOT EXISTS (SELECT 1 FROM grantee_visible g WHERE g.history_item_id = m.history_item_id);
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Presentation hint (CW2-08 §24: client flags never grant authority; every command re-binds the gate itself).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION shared_private.read_shared_governance_capabilities_v1()
RETURNS TABLE (governance_available boolean, history_available boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT
    COALESCE(EXISTS (SELECT 1 FROM shared_private.shared_launch_capability_states s
                      WHERE s.capability_scope = 'SHARED_GOVERNANCE' AND s.feature_flag_state = 'ENABLED'
                        AND s.launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE')), false),
    COALESCE(EXISTS (SELECT 1 FROM shared_private.shared_launch_capability_states s
                      WHERE s.capability_scope = 'SHARED_HISTORY_ACCESS' AND s.feature_flag_state = 'ENABLED'
                        AND s.launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE')), false);
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Product-safe reads of a CURRENT World. A non-member, a former member, a closed World and a World that never existed
--    read the same thing: nothing.
-- ---------------------------------------------------------------------------------------------------------------------

-- The committed World names of the caller's current Worlds (the World label once a name is committed).
CREATE FUNCTION shared_private.list_own_shared_world_names_v1()
RETURNS TABLE (world_id uuid, world_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT s.world_id, v.name
      FROM public.shared_world_settings_state s
      JOIN public.shared_world_settings_versions v ON v.id = s.current_settings_version_id AND v.world_id = s.world_id
     WHERE v.name IS NOT NULL AND shared_private.is_current_shared_member_v1(s.world_id, v_user)
     ORDER BY s.world_id;
END$$;

-- One World's committed settings (one row for a current member; NULL values when nothing is committed yet).
CREATE FUNCTION shared_private.read_own_shared_world_settings_v1(p_world_id uuid)
RETURNS TABLE (world_name text, world_description text, world_topic text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT v.name, v.description, v.topic
      FROM (SELECT 1) one
      LEFT JOIN public.shared_world_settings_state s ON s.world_id = p_world_id
      LEFT JOIN public.shared_world_settings_versions v ON v.id = s.current_settings_version_id AND v.world_id = p_world_id;
END$$;

-- One World's current members, each with their opaque handle, their Name and whether they are the caller.
CREATE FUNCTION shared_private.list_own_shared_world_member_handles_v1(p_world_id uuid)
RETURNS TABLE (member_handle uuid, member_name text, is_self boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT shared_private.shared_member_handle_v1(p_world_id, e.user_id), u.name, COALESCE(e.user_id = v_user, false)
      FROM public.shared_world_membership_episodes e JOIN public.users u ON u.id = e.user_id
     WHERE e.world_id = p_world_id AND e.ended_at IS NULL
     ORDER BY e.joined_at, e.id;
END$$;

-- The CURRENT proposals of one World that require THIS human's approval: the caller's open episode is a REQUIRED member
-- of the exact captured topology (inside it, and never the excluded removal target), the topology is still current, the
-- reachability binding still holds, and the required set is not complete yet. A removal target is never shown the
-- proposal to remove them (they hold no vote on it). Shown: the operation, the proposer's Name (no authority), whether
-- THIS human approved, and the neutral progress. Never who else approved. The removal target's Name is shown (a current,
-- visible member of this exact World); an add / rejoin target is never named, described or counted before acceptance.
CREATE FUNCTION shared_private.list_own_shared_world_proposals_v1(p_world_id uuid)
RETURNS TABLE (proposal_id uuid, operation_kind text, created_at timestamptz, proposer_name text, proposer_is_self boolean,
               target_name text, proposed_name text, proposed_description text, proposed_topic text,
               approved_by_self boolean, approved_count integer, required_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.id, p.operation_kind, p.created_at, pu.name, COALESCE(o.proposer_user_id = v_user, false),
           CASE WHEN p.operation_kind = 'REMOVE_MEMBER' THEN tu.name END,
           sv.name, sv.description, sv.topic,
           COALESCE(EXISTS (SELECT 1 FROM public.shared_world_governance_approvals a
                             WHERE a.proposal_id = p.id AND a.membership_episode_id = mine.id), false),
           COALESCE(pg.approved_count, 0), COALESCE(pg.required_count, 0)
      FROM public.shared_world_governance_proposals p
      JOIN public.shared_world_membership_episodes mine
        ON mine.world_id = p.world_id AND mine.user_id = v_user AND mine.ended_at IS NULL
      JOIN public.shared_world_membership_snapshot_members sm
        ON sm.membership_snapshot_id = p.membership_snapshot_id AND sm.membership_episode_id = mine.id
      CROSS JOIN LATERAL shared_private.shared_proposal_progress_v1(p.id) pg
      LEFT JOIN shared_private.shared_governance_proposal_origins o ON o.governance_proposal_id = p.id
      LEFT JOIN public.users pu ON pu.id = o.proposer_user_id
      LEFT JOIN public.shared_world_remove_member_payload_versions rp ON rp.governance_proposal_id = p.id
      LEFT JOIN public.users tu ON tu.id = rp.target_user_id
      LEFT JOIN public.shared_world_settings_versions sv ON sv.governance_proposal_id = p.id
     WHERE p.world_id = p_world_id
       AND p.operation_kind IN ('REMOVE_MEMBER', 'WORLD_SETTINGS_CHANGE', 'END_WORLD', 'ADD_MEMBER', 'REJOIN_MEMBER')
       AND p.excluded_membership_episode_id IS DISTINCT FROM mine.id
       AND shared_private.is_current_shared_proposal_topology_v1(p.id)
       AND shared_private.is_actionable_shared_reachability_v1(p.id)
       AND NOT shared_private.is_committed_shared_proposal_v1(p.id)
       AND pg.approved_count < pg.required_count
     ORDER BY p.created_at, p.id;
END$$;

-- The earlier history the caller may offer to one current member: exactly the candidates of section 2, newest first, one
-- bounded page at a time (keyset-cursored on the instant and identity of the last row shown, so every older eligible
-- message stays reachable and no page reveals anything about what is not offered), with each author's Name and whether
-- the words are the caller's.
CREATE FUNCTION shared_private.list_own_shared_history_share_candidates_v1(
  p_world_id uuid, p_member_handle uuid, p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE (material_id uuid, established_at timestamptz, is_self boolean, author_name text, text_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_grantee uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_member_handle IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 100
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'SHARED_HISTORY_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN;
  END IF;
  SELECT e.user_id INTO v_grantee FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.ended_at IS NULL AND e.user_id <> v_user
     AND shared_private.shared_member_handle_v1(p_world_id, e.user_id) = p_member_handle;
  IF v_grantee IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.id, m.established_at, COALESCE(m.author_user_id = v_user, false), u.name, b.body_text
      FROM shared_private.shared_history_share_candidates_v1(p_world_id, v_user, v_grantee) c
      JOIN public.shared_world_materials m ON m.id = c.material_id
      JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
      JOIN public.users u ON u.id = m.author_user_id
     WHERE p_before_established_at IS NULL
        OR (m.established_at, m.id) < (p_before_established_at, p_before_material_id)
     ORDER BY m.established_at DESC, m.id DESC
     LIMIT p_limit;
END$$;

-- The history packages of one World that wait on THIS human's material authority: the grantee's Name and exactly the
-- caller's OWN words in the package (what the caller is asked to authorize), whether the caller approved, and nothing
-- about anyone else's words in it. Only a package that is still exact (grantee episode open, every item still at its
-- captured availability) and not yet granted.
CREATE FUNCTION shared_private.list_own_shared_history_share_requests_v1(p_world_id uuid)
RETURNS TABLE (package_id uuid, created_at timestamptz, grantee_name text, approved_by_self boolean,
               material_id uuid, established_at timestamptz, text_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT mv.id, mv.created_at, gu.name,
           COALESCE(EXISTS (SELECT 1 FROM public.shared_world_history_package_approvals a
                             WHERE a.manifest_version_id = mv.id AND a.approver_user_id = v_user), false),
           m.id, m.established_at, b.body_text
      FROM public.shared_world_history_package_manifest_versions mv
      JOIN public.shared_world_history_package_required_approvers ra ON ra.manifest_version_id = mv.id AND ra.approver_user_id = v_user
      JOIN public.users gu ON gu.id = mv.grantee_user_id
      JOIN public.shared_world_membership_episodes ge ON ge.id = mv.grantee_membership_episode_id AND ge.ended_at IS NULL
      JOIN public.shared_world_history_package_manifest_items mi ON mi.manifest_version_id = mv.id
      JOIN public.shared_world_materials m ON m.history_item_id = mi.history_item_id AND m.author_user_id = v_user
      JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
     WHERE mv.world_id = p_world_id
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_access_grants g WHERE g.manifest_version_id = mv.id)
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_items x
                         JOIN public.shared_world_history_items i ON i.id = x.history_item_id
                        WHERE x.manifest_version_id = mv.id
                          AND (i.availability_state <> 'AVAILABLE' OR i.availability_revision <> x.captured_availability_revision))
     ORDER BY mv.created_at, mv.id, m.established_at, m.id;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Product-safe reads of CLOSED Worlds (CW2-03 §32–§33): entitlement, never membership; never gated.
-- ---------------------------------------------------------------------------------------------------------------------

-- The READ_ONLY_CLOSED / STANDARD Worlds the caller holds a closed-view entitlement for, with the committed name.
CREATE FUNCTION shared_private.list_own_closed_shared_worlds_v1()
RETURNS TABLE (world_id uuid, closed_at timestamptz, world_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT w.id, w.closed_at, v.name
      FROM public.shared_world_standard_closed_view_entitlements ent
      JOIN public.shared_worlds w ON w.id = ent.world_id AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'STANDARD'
      LEFT JOIN public.shared_world_settings_state s ON s.world_id = w.id
      LEFT JOIN public.shared_world_settings_versions v ON v.id = s.current_settings_version_id AND v.world_id = w.id
     WHERE ent.user_id = v_user
     ORDER BY w.closed_at, w.id;
END$$;

-- The people entitled to each of the caller's closed Worlds (the members at closure), for the closed World's label.
CREATE FUNCTION shared_private.list_own_closed_shared_world_members_v1()
RETURNS TABLE (world_id uuid, is_self boolean, member_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT other.world_id, COALESCE(other.user_id = v_user, false), u.name
      FROM public.shared_world_standard_closed_view_entitlements mine
      JOIN public.shared_worlds w ON w.id = mine.world_id AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'STANDARD'
      JOIN public.shared_world_standard_closed_view_entitlements other ON other.world_id = mine.world_id
      JOIN public.shared_world_membership_episodes e ON e.id = other.membership_episode_id
      JOIN public.users u ON u.id = other.user_id
     WHERE mine.user_id = v_user
     ORDER BY other.world_id, e.joined_at, e.id;
END$$;

-- The entitled material of one closed World, through the ONE frozen resolver (whose closed branch is the 0088 entitlement
-- snapshot, re-checked against current availability on every read), text form only, newest first, keyset-cursored.
CREATE FUNCTION shared_private.list_own_closed_shared_world_material_v1(
  p_world_id uuid, p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE (material_id uuid, producer_kind text, established_at timestamptz, is_self boolean, author_name text, text_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'SHARED_MATERIAL_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_standard_closed_view_entitlements ent
                   JOIN public.shared_worlds w ON w.id = ent.world_id
                  WHERE ent.world_id = p_world_id AND ent.user_id = v_user
                    AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'STANDARD') THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.material_id,
           CASE WHEN m.author_user_id IS NULL THEN 'QANDEEL' ELSE 'HUMAN' END,
           m.established_at,
           COALESCE(m.author_user_id = v_user, false),
           CASE WHEN m.author_user_id IS NULL THEN NULL ELSE u.name END,
           m.text_body
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
      LEFT JOIN public.users u ON u.id = m.author_user_id
     WHERE m.text_body IS NOT NULL
       AND (p_before_established_at IS NULL
            OR (m.established_at, m.material_id) < (p_before_established_at, p_before_material_id))
     ORDER BY m.established_at DESC, m.material_id DESC
     LIMIT p_limit;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. The caller's OWN words in Worlds they no longer belong to (left, removed, or a World that has ended) — the
--    OWN_MATERIAL_CONTROL of CW2-03 §24 / C21, through the account / privacy surface, without World browsing: only the
--    caller's own text and its instant (and the opaque World identity the owner deletion needs). No surrounding
--    material, member, Name, topic, count or World state. Never gated. Newest first, keyset-cursored.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION shared_private.list_own_former_shared_world_material_v1(
  p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE (material_id uuid, world_id uuid, established_at timestamptz, text_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'SHARED_MATERIAL_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT m.id, m.world_id, m.established_at, b.body_text
      FROM public.shared_world_materials m
      JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
      JOIN public.shared_worlds w ON w.id = m.world_id AND w.phase = 'STANDARD'
     WHERE m.author_user_id = v_user AND m.material_kind = 'HUMAN_TEXT'
       AND NOT shared_private.is_current_shared_member_v1(m.world_id, v_user)
       AND (p_before_established_at IS NULL
            OR (m.established_at, m.id) < (p_before_established_at, p_before_material_id))
     ORDER BY m.established_at DESC, m.id DESC
     LIMIT p_limit;
END$$;

-- The history packages, in Worlds the caller no longer belongs to, that wait on the caller's surviving MATERIAL authority
-- (membership is not material authority: CW2-03 §24; 0119). Exactly the caller's OWN words in each package and whether
-- the caller approved — no grantee, no other words, no member, Name, topic, count or World state, and no World entry.
-- Only a package that is still exact (World ACTIVE / STANDARD, grantee episode open, every item still at its captured
-- availability) and not yet granted. Never gated: it is the account / privacy surface's own-material control.
CREATE FUNCTION shared_private.list_own_former_shared_history_share_requests_v1()
RETURNS TABLE (package_id uuid, world_id uuid, created_at timestamptz, approved_by_self boolean,
               material_id uuid, established_at timestamptz, text_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT mv.id, mv.world_id, mv.created_at,
           COALESCE(EXISTS (SELECT 1 FROM public.shared_world_history_package_approvals a
                             WHERE a.manifest_version_id = mv.id AND a.approver_user_id = v_user), false),
           m.id, m.established_at, b.body_text
      FROM public.shared_world_history_package_manifest_versions mv
      JOIN public.shared_world_history_package_required_approvers ra ON ra.manifest_version_id = mv.id AND ra.approver_user_id = v_user
      JOIN public.shared_worlds w ON w.id = mv.world_id AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
      JOIN public.shared_world_membership_episodes ge ON ge.id = mv.grantee_membership_episode_id AND ge.ended_at IS NULL
      JOIN public.shared_world_history_package_manifest_items mi ON mi.manifest_version_id = mv.id
      JOIN public.shared_world_materials m ON m.history_item_id = mi.history_item_id AND m.author_user_id = v_user
      JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
     WHERE NOT shared_private.is_current_shared_member_v1(mv.world_id, v_user)
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_access_grants g WHERE g.manifest_version_id = mv.id)
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_items x
                         JOIN public.shared_world_history_items i ON i.id = x.history_item_id
                        WHERE x.manifest_version_id = mv.id
                          AND (i.availability_state <> 'AVAILABLE' OR i.availability_revision <> x.captured_availability_revision))
     ORDER BY mv.created_at, mv.id, m.established_at, m.id;
END$$;

-- The add / rejoin requests that wait on THIS human as their exact target: an ADD_MEMBER whose invitation is dispatched
-- and still PENDING, or a REJOIN_MEMBER whose exact approval set is complete and not yet committed — each only while its
-- Shared-ID epoch binding still holds and its topology is still current. Shown: the kind and the proposer's Name (the
-- identity the invitee is legitimately shown, as in S4-01), plus the opaque World identity the acceptance names. Nothing
-- of the World — no name, member, material, count or topic — before acceptance.
CREATE FUNCTION shared_private.list_own_shared_membership_requests_v1()
RETURNS TABLE (request_id uuid, world_id uuid, request_kind text, proposer_name text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.world_id, p.operation_kind, pu.name, p.created_at
      FROM public.shared_world_governance_proposals p
      JOIN shared_private.shared_governance_proposal_origins o ON o.governance_proposal_id = p.id
      JOIN public.users pu ON pu.id = o.proposer_user_id
      JOIN public.shared_worlds w ON w.id = p.world_id AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
     WHERE p.operation_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER')
       AND shared_private.shared_reachability_target_v1(p.id) = v_user
       AND shared_private.is_actionable_shared_reachability_v1(p.id)
       AND shared_private.is_current_shared_proposal_topology_v1(p.id)
       AND ((p.operation_kind = 'ADD_MEMBER'
             AND EXISTS (SELECT 1 FROM public.shared_world_member_invitations i
                          WHERE i.governance_proposal_id = p.id AND i.target_user_id = v_user AND i.invitation_state = 'PENDING'))
         OR (p.operation_kind = 'REJOIN_MEMBER'
             AND NOT EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands c WHERE c.governance_proposal_id = p.id)
             AND COALESCE((SELECT pg.approved_count >= pg.required_count FROM shared_private.shared_proposal_progress_v1(p.id) pg), false)))
     ORDER BY p.created_at, p.id;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Voluntary leave (CW2-03 §23): unilateral, immediate, NOT gated. Outcomes: LEFT (now, or already under this command
--    in this exact World) | UNAVAILABLE (not a current member of an ACTIVE / STANDARD World, unknown World, a command of
--    another human, another World or another family — one answer).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION shared_private.leave_shared_world_v1(p_command_id uuid, p_world_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_family text;
  v_committed public.shared_world_voluntary_leave_commands;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_LEAVE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  -- Exact World, exact family, exact human BEFORE any replay answer.
  v_family := shared_private.shared_lifecycle_command_family_v1(p_command_id);
  IF v_family IS NOT NULL AND v_family <> 'LEAVE' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  SELECT * INTO v_committed FROM public.shared_world_voluntary_leave_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF v_committed.actor_user_id = v_user AND v_committed.world_id = p_world_id THEN
      RETURN QUERY SELECT 'LEFT'::text;
    ELSE
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
    END IF;
    RETURN;
  END IF;
  BEGIN
    -- The frozen core: World row FIRST, then the caller's own open episode; the human is auth.uid().
    PERFORM 1 FROM public.commit_shared_world_standard_voluntary_leave_v1(
      p_command_id, p_world_id, shared_private.derive_shared_lifecycle_identity_v1('MEMBER_LEFT_EVENT', p_command_id::text));
  EXCEPTION
    WHEN no_data_found OR unique_violation THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
      RETURN;
  END;
  RETURN QUERY SELECT 'LEFT'::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. Governance proposals — any current member may propose (Product Definition §12; CW2-03 §16, §25, §30, §31); the
--    proposal is NOT an approval: the proposer approves like every other required member (0084: a proposal never approves
--    itself). Gated by SHARED_GOVERNANCE. Outcomes: PROPOSED (+ the proposal) | UNCHANGED (settings equal to the current
--    ones) | UNAVAILABLE (the capability DENIES; not a current member; an unknown handle; the caller's own removal; the
--    frozen core's bounded refusal; a command of another World, operation, request or family — one answer).
-- ---------------------------------------------------------------------------------------------------------------------

-- Whether a committed proposal answers THIS replay: the same World, the same operation, and the exact human who proposed
-- it (its recorded origin). The operation-specific request equality is checked by each caller.
CREATE FUNCTION shared_private.shared_proposal_replay_matches_v1(p_proposal_id uuid, p_world_id uuid, p_operation_kind text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM public.shared_world_governance_proposals p
      JOIN shared_private.shared_governance_proposal_origins o ON o.governance_proposal_id = p.id
     WHERE p.id = p_proposal_id AND p.world_id = p_world_id AND p.operation_kind = p_operation_kind
       AND o.world_id = p_world_id AND o.operation_kind = p_operation_kind AND o.proposer_user_id = p_user_id), false);
$$;

-- Records the Product origin of a proposal the caller just prepared (same transaction, same canonical instant).
CREATE FUNCTION shared_private.record_shared_proposal_origin_v1(
  p_proposal_id uuid, p_command_id uuid, p_user_id uuid, p_target_epoch bigint, p_request_digest uuid
) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO shared_private.shared_governance_proposal_origins
    (governance_proposal_id, world_id, origin_command_id, proposer_user_id, operation_kind, target_credential_epoch,
     request_digest, created_at)
  SELECT p.id, p.world_id, p_command_id, p_user_id, p.operation_kind, p_target_epoch, p_request_digest, p.created_at
    FROM public.shared_world_governance_proposals p WHERE p.id = p_proposal_id;
$$;

CREATE FUNCTION shared_private.propose_shared_world_settings_v1(
  p_command_id uuid, p_world_id uuid, p_name text, p_description text, p_topic text
) RETURNS TABLE (outcome text, proposal_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_name text := NULLIF(btrim(p_name), '');
  v_description text := NULLIF(btrim(p_description), '');
  v_topic text := NULLIF(btrim(p_topic), '');
  v_proposal uuid;
  v_version uuid;
  v_family text;
  v_gate record;
  v_current public.shared_world_settings_versions;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  -- Engineering input bounds of the Product boundary (the frozen columns carry none).
  IF p_command_id IS NULL OR p_world_id IS NULL OR length(coalesce(v_name, '')) > 80
     OR length(coalesce(v_description, '')) > 500 OR length(coalesce(v_topic, '')) > 120 THEN
    RAISE EXCEPTION 'SHARED_SETTINGS_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_proposal := shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL', p_command_id::text);
  v_version := shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_PAYLOAD', p_command_id::text);

  -- Exact World, operation, request and human BEFORE any replay answer.
  v_family := shared_private.shared_lifecycle_command_family_v1(p_command_id);
  IF v_family IS NOT NULL THEN
    IF v_family = 'PROPOSAL' AND shared_private.shared_proposal_replay_matches_v1(v_proposal, p_world_id, 'WORLD_SETTINGS_CHANGE', v_user)
       AND EXISTS (SELECT 1 FROM public.shared_world_settings_versions v
                    WHERE v.id = v_version AND v.governance_proposal_id = v_proposal AND v.world_id = p_world_id
                      AND v.name IS NOT DISTINCT FROM v_name AND v.description IS NOT DISTINCT FROM v_description
                      AND v.topic IS NOT DISTINCT FROM v_topic) THEN
      RETURN QUERY SELECT 'PROPOSED'::text, v_proposal;
    ELSE
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    END IF;
    RETURN;
  END IF;

  -- LOCK ORDER STEP 0: the governance capability snapshot.
  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_GOVERNANCE');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  -- LOCK ORDER STEP 1: the World row, so the proposer's membership and the current settings are read under it.
  PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  SELECT v.* INTO v_current FROM public.shared_world_settings_state s
    JOIN public.shared_world_settings_versions v ON v.id = s.current_settings_version_id AND v.world_id = s.world_id
   WHERE s.world_id = p_world_id;
  IF v_current.name IS NOT DISTINCT FROM v_name AND v_current.description IS NOT DISTINCT FROM v_description
     AND v_current.topic IS NOT DISTINCT FROM v_topic THEN
    RETURN QUERY SELECT 'UNCHANGED'::text, NULL::uuid;
    RETURN;
  END IF;
  BEGIN
    -- The general visual marker has no Product representation yet: whatever is committed is carried forward unchanged.
    PERFORM 1 FROM public.prepare_shared_world_settings_change_governance_v1(
      v_proposal, shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_SNAPSHOT', p_command_id::text), v_version,
      p_world_id, v_name, v_description, v_topic, v_current.general_visual_marker);
    PERFORM shared_private.record_shared_proposal_origin_v1(v_proposal, p_command_id, v_user, NULL, NULL);
  EXCEPTION
    WHEN no_data_found OR unique_violation THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
      RETURN;
  END;
  RETURN QUERY SELECT 'PROPOSED'::text, v_proposal;
END$$;

CREATE FUNCTION shared_private.propose_shared_world_member_removal_v1(p_command_id uuid, p_world_id uuid, p_member_handle uuid)
RETURNS TABLE (outcome text, proposal_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_proposal uuid;
  v_family text;
  v_gate record;
  v_target uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_member_handle IS NULL THEN
    RAISE EXCEPTION 'SHARED_REMOVAL_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_proposal := shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL', p_command_id::text);

  v_family := shared_private.shared_lifecycle_command_family_v1(p_command_id);
  IF v_family IS NOT NULL THEN
    IF v_family = 'PROPOSAL' AND shared_private.shared_proposal_replay_matches_v1(v_proposal, p_world_id, 'REMOVE_MEMBER', v_user)
       AND EXISTS (SELECT 1 FROM public.shared_world_remove_member_payload_versions rp
                    WHERE rp.governance_proposal_id = v_proposal AND rp.world_id = p_world_id
                      AND shared_private.shared_member_handle_v1(p_world_id, rp.target_user_id) = p_member_handle) THEN
      RETURN QUERY SELECT 'PROPOSED'::text, v_proposal;
    ELSE
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_GOVERNANCE');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  -- The handle re-resolves only against the World's CURRENT topology, and never to the caller (leaving is theirs).
  SELECT e.user_id INTO v_target FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.ended_at IS NULL AND e.user_id <> v_user
     AND shared_private.shared_member_handle_v1(p_world_id, e.user_id) = p_member_handle;
  IF v_target IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  BEGIN
    PERFORM 1 FROM public.prepare_shared_world_remove_member_governance_v1(
      v_proposal, shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_SNAPSHOT', p_command_id::text),
      shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_PAYLOAD', p_command_id::text), p_world_id, v_target);
    PERFORM shared_private.record_shared_proposal_origin_v1(v_proposal, p_command_id, v_user, NULL, NULL);
  EXCEPTION
    WHEN no_data_found OR unique_violation THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
      RETURN;
  END;
  RETURN QUERY SELECT 'PROPOSED'::text, v_proposal;
END$$;

CREATE FUNCTION shared_private.propose_shared_world_end_v1(p_command_id uuid, p_world_id uuid)
RETURNS TABLE (outcome text, proposal_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_proposal uuid;
  v_family text;
  v_gate record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_END_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_proposal := shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL', p_command_id::text);

  v_family := shared_private.shared_lifecycle_command_family_v1(p_command_id);
  IF v_family IS NOT NULL THEN
    IF v_family = 'PROPOSAL' AND shared_private.shared_proposal_replay_matches_v1(v_proposal, p_world_id, 'END_WORLD', v_user) THEN
      RETURN QUERY SELECT 'PROPOSED'::text, v_proposal;
    ELSE
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_GOVERNANCE');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  BEGIN
    PERFORM 1 FROM public.prepare_shared_world_standard_end_governance_v1(
      v_proposal, shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_SNAPSHOT', p_command_id::text),
      shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_PAYLOAD', p_command_id::text), p_world_id);
    PERFORM shared_private.record_shared_proposal_origin_v1(v_proposal, p_command_id, v_user, NULL, NULL);
  EXCEPTION
    WHEN no_data_found OR unique_violation THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
      RETURN;
  END;
  RETURN QUERY SELECT 'PROPOSED'::text, v_proposal;
END$$;

-- Adding a member, or bringing a former member back, by the target's CURRENT Shared ID (P1 §5.2–§5.3). Gated by
-- SHARED_GOVERNANCE. Outcomes: SUBMITTED (the ONE answer for every well-formed Shared ID — nobody, a rotated-away ID, the
-- caller's own, a current member, someone already asked for at this epoch, or a real request opened now; nothing about
-- the target is ever returned) | INVALID_SHARED_ID (not of the Shared ID's shape — a typing error that says nothing about
-- anyone) | UNAVAILABLE (the capability denies; the caller is not a current member; a command of another World, family,
-- request or human). A never-member is an ADD_MEMBER, a former member a REJOIN_MEMBER — the frozen 0085 split; the
-- proposal is bound to the target's credential epoch read under its row lock.
CREATE FUNCTION shared_private.propose_shared_world_member_v1(p_command_id uuid, p_world_id uuid, p_shared_id text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_canonical text;
  v_ref text;
  v_digest uuid;
  v_proposal uuid;
  v_family text;
  v_gate record;
  v_target uuid;
  v_epoch bigint;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_MEMBER_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_proposal := shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL', p_command_id::text);
  v_canonical := account_private.normalize_shared_id_v1(p_shared_id);

  -- Exact World, family, request (the same Shared ID, proven by digest — the ID itself is never kept) and human BEFORE
  -- any replay answer.
  v_family := shared_private.shared_lifecycle_command_family_v1(p_command_id);
  IF v_family IS NOT NULL THEN
    IF v_family = 'PROPOSAL' AND v_canonical IS NOT NULL AND EXISTS (
         SELECT 1 FROM shared_private.shared_governance_proposal_origins o
           JOIN public.shared_world_governance_proposals p ON p.id = o.governance_proposal_id
          WHERE o.governance_proposal_id = v_proposal AND o.world_id = p_world_id AND p.world_id = p_world_id
            AND o.proposer_user_id = v_user AND o.operation_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER')
            AND o.request_digest = shared_private.derive_shared_lifecycle_identity_v1('MEMBER_REQUEST',
                  p_command_id::text || ':' || account_private.shared_id_lookup_ref_v1(v_canonical))) THEN
      RETURN QUERY SELECT 'SUBMITTED'::text;
    ELSE
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
    END IF;
    RETURN;
  END IF;
  IF v_canonical IS NULL THEN
    RETURN QUERY SELECT 'INVALID_SHARED_ID'::text;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_GOVERNANCE');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;

  v_ref := account_private.shared_id_lookup_ref_v1(v_canonical);
  v_digest := shared_private.derive_shared_lifecycle_identity_v1('MEMBER_REQUEST', p_command_id::text || ':' || v_ref);
  -- LOCK ORDER STEP 2: the target's credential row, found by exact CURRENT reference only. A reference that matches
  -- nothing (never issued, or rotated away) is already the bounded non-enumerating answer.
  SELECT s.user_id, s.epoch INTO v_target, v_epoch
    FROM public.shared_world_invite_credential_state s WHERE s.credential_lookup_ref = v_ref FOR SHARE;
  IF NOT FOUND OR v_target = v_user THEN
    RETURN QUERY SELECT 'SUBMITTED'::text;
    RETURN;
  END IF;
  -- Already a current member, or already asked for at this exact epoch by a request that is still live: nothing new.
  IF EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
              WHERE e.world_id = p_world_id AND e.user_id = v_target AND e.ended_at IS NULL)
     OR EXISTS (SELECT 1 FROM shared_private.shared_governance_proposal_origins o
                 WHERE o.world_id = p_world_id AND o.operation_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER')
                   AND o.target_credential_epoch = v_epoch
                   AND shared_private.shared_reachability_target_v1(o.governance_proposal_id) = v_target
                   AND shared_private.is_current_shared_proposal_topology_v1(o.governance_proposal_id)
                   AND NOT EXISTS (SELECT 1 FROM public.shared_world_member_invitations i
                                    WHERE i.governance_proposal_id = o.governance_proposal_id AND i.invitation_state <> 'PENDING')
                   AND NOT EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands c
                                    WHERE c.governance_proposal_id = o.governance_proposal_id)) THEN
    RETURN QUERY SELECT 'SUBMITTED'::text;
    RETURN;
  END IF;
  BEGIN
    IF EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e WHERE e.world_id = p_world_id AND e.user_id = v_target) THEN
      PERFORM 1 FROM public.prepare_shared_world_rejoin_governance_v1(
        v_proposal, shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_SNAPSHOT', p_command_id::text),
        shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_PAYLOAD', p_command_id::text), p_world_id, v_target);
    ELSE
      PERFORM 1 FROM public.prepare_shared_world_add_member_governance_v1(
        v_proposal, shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_SNAPSHOT', p_command_id::text),
        shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_PAYLOAD', p_command_id::text), p_world_id, v_target);
    END IF;
    PERFORM shared_private.record_shared_proposal_origin_v1(v_proposal, p_command_id, v_user, v_epoch, v_digest);
  EXCEPTION
    WHEN no_data_found THEN
      -- The frozen core's bounded refusal: the same answer as every other well-formed Shared ID.
      RETURN QUERY SELECT 'SUBMITTED'::text;
      RETURN;
    WHEN unique_violation THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
      RETURN;
  END;
  RETURN QUERY SELECT 'SUBMITTED'::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. Approval of one proposal. Gated by SHARED_GOVERNANCE. The approving human is auth.uid() inside the frozen 0084
--    primitive (a REQUIRED member of the exact current topology, never the removal target). In the same transaction the
--    frozen operation core is attempted under identities derived from the PROPOSAL, so whichever approval satisfies the
--    rule commits the operation exactly once, and an incomplete set commits nothing (the core's own 55000). For an add the
--    satisfying approval dispatches the one member invitation; for a rejoin it proves the exact set satisfied — the target
--    then accepts (section 9b). An add / rejoin is re-bound to the target's CURRENT Shared-ID epoch under its credential
--    row before anything is recorded: a rotation answers STALE and records nothing.
--    Outcomes: APPROVED (recorded; others still required) | COMMITTED (the operation is applied) | INVITED (the add /
--    rejoin is approved by everyone and now waits for the person) | STALE (the topology moved, or the add / rejoin no longer
--    stands: a new proposal is needed) | UNAVAILABLE (one answer).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION shared_private.approve_shared_world_proposal_v1(p_command_id uuid, p_world_id uuid, p_proposal_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_approval uuid;
  v_family text;
  v_gate record;
  v_kind text;
  v_operation uuid;
  v_event uuid;
  v_payload uuid;
  v_done text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_proposal_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_APPROVAL_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_approval := shared_private.derive_shared_lifecycle_identity_v1('APPROVAL', p_command_id::text);
  -- The proposal must belong to the exact supplied World and be one this boundary governs, before anything else.
  SELECT p.operation_kind, p.proposed_payload_version_id INTO v_kind, v_payload FROM public.shared_world_governance_proposals p
   WHERE p.id = p_proposal_id AND p.world_id = p_world_id
     AND p.operation_kind IN ('REMOVE_MEMBER', 'WORLD_SETTINGS_CHANGE', 'END_WORLD', 'ADD_MEMBER', 'REJOIN_MEMBER');
  IF v_kind IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  -- What a completed set of this proposal is called: an applied operation, or an add / rejoin now waiting for the person.
  v_done := CASE WHEN v_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER') THEN 'INVITED' ELSE 'COMMITTED' END;

  -- Exact World, proposal, family and human BEFORE any replay answer.
  v_family := shared_private.shared_lifecycle_command_family_v1(p_command_id);
  IF v_family IS NOT NULL THEN
    IF v_family = 'APPROVAL' AND EXISTS (
         SELECT 1 FROM public.shared_world_governance_approvals a
           JOIN public.shared_world_membership_episodes e ON e.id = a.membership_episode_id
          WHERE a.id = v_approval AND a.proposal_id = p_proposal_id AND e.world_id = p_world_id AND e.user_id = v_user) THEN
      RETURN QUERY SELECT CASE WHEN shared_private.is_committed_shared_proposal_v1(p_proposal_id)
                                 OR (v_kind = 'REJOIN_MEMBER' AND COALESCE((SELECT pg.approved_count >= pg.required_count
                                       FROM shared_private.shared_proposal_progress_v1(p_proposal_id) pg), false))
                               THEN v_done ELSE 'APPROVED' END;
    ELSE
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_GOVERNANCE');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  -- LOCK ORDER STEP 1: the World row, before the proposal (the frozen primitives re-take it, a no-op here).
  PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF v_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER') THEN
    -- LOCK ORDER STEP 2: the target's credential row (a racing rotation waits or has already committed), then the
    -- exact Shared-ID epoch binding. A rotation ends the request for good; nothing is recorded.
    PERFORM 1 FROM public.shared_world_invite_credential_state s
      WHERE s.user_id = shared_private.shared_reachability_target_v1(p_proposal_id) FOR SHARE;
    IF NOT shared_private.is_actionable_shared_reachability_v1(p_proposal_id) THEN
      RETURN QUERY SELECT 'STALE'::text;
      RETURN;
    END IF;
  END IF;
  -- This human already approved this proposal (under another command): the same truthful answer.
  IF EXISTS (SELECT 1 FROM public.shared_world_governance_approvals a
               JOIN public.shared_world_membership_episodes e ON e.id = a.membership_episode_id
              WHERE a.proposal_id = p_proposal_id AND e.world_id = p_world_id AND e.user_id = v_user AND e.ended_at IS NULL) THEN
    RETURN QUERY SELECT CASE WHEN shared_private.is_committed_shared_proposal_v1(p_proposal_id)
                               OR (v_kind = 'REJOIN_MEMBER' AND COALESCE((SELECT pg.approved_count >= pg.required_count
                                     FROM shared_private.shared_proposal_progress_v1(p_proposal_id) pg), false))
                             THEN v_done ELSE 'APPROVED' END;
    RETURN;
  END IF;
  BEGIN
    PERFORM 1 FROM public.commit_shared_world_governance_approval_v1(v_approval, p_proposal_id);
  EXCEPTION
    WHEN serialization_failure THEN
      RETURN QUERY SELECT 'STALE'::text;
      RETURN;
    WHEN no_data_found OR unique_violation THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
      RETURN;
  END;

  -- The operation, if (and only if) the exact approval set is now complete. Its identities belong to the PROPOSAL.
  v_operation := shared_private.derive_shared_lifecycle_identity_v1('OPERATION_COMMAND', p_proposal_id::text);
  v_event := shared_private.derive_shared_lifecycle_identity_v1('OPERATION_EVENT', p_proposal_id::text);
  BEGIN
    IF v_kind = 'REMOVE_MEMBER' THEN
      PERFORM 1 FROM public.commit_shared_world_member_removal_v1(v_operation, p_proposal_id, v_event);
    ELSIF v_kind = 'WORLD_SETTINGS_CHANGE' THEN
      PERFORM 1 FROM public.commit_shared_world_settings_change_v1(v_operation, p_proposal_id, v_event);
    ELSIF v_kind = 'END_WORLD' THEN
      PERFORM 1 FROM public.commit_shared_world_standard_end_v1(v_operation, p_proposal_id, v_event);
    ELSIF v_kind = 'ADD_MEMBER' THEN
      -- The one effective member invitation of this proposal (the frozen dispatch revalidates the exact approval set).
      PERFORM 1 FROM public.dispatch_shared_world_member_invitation_v1(
        shared_private.derive_shared_lifecycle_identity_v1('MEMBER_INVITATION', p_proposal_id::text), p_proposal_id);
    ELSE
      -- A rejoin has no invitation in the frozen runtime: the satisfied set is proven now; the target commits it.
      PERFORM 1 FROM public.resolve_shared_world_governance_approval_v1(p_proposal_id, 'REJOIN_MEMBER', v_payload);
    END IF;
  EXCEPTION
    WHEN object_not_in_prerequisite_state THEN
      -- SHARED_WORLD_GOVERNANCE_APPROVALS_INCOMPLETE: the approval stands; the operation waits for the others.
      RETURN QUERY SELECT 'APPROVED'::text;
      RETURN;
    WHEN serialization_failure THEN
      RETURN QUERY SELECT 'STALE'::text;
      RETURN;
  END;
  RETURN QUERY SELECT v_done;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9b. The exact target's acceptance of an add / rejoin (CW2-03 §16, §28: nobody is forced into a World). Gated by
--     SHARED_GOVERNANCE. The accepting human is auth.uid() inside the frozen 0085 core — never a parameter. Before the
--     core runs, the target's OWN credential row is held FOR SHARE and the request's epoch binding must still be the
--     current epoch: an acceptance through an old Shared ID is impossible. FROM_JOIN_FORWARD: no history is granted.
--     Outcomes: JOINED (now, or already under this command for this exact request in this exact World) | UNAVAILABLE.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION shared_private.accept_shared_membership_request_v1(p_command_id uuid, p_world_id uuid, p_request_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_family text;
  v_gate record;
  v_kind text;
  v_invitation uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_ACCEPTANCE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT p.operation_kind INTO v_kind FROM public.shared_world_governance_proposals p
   WHERE p.id = p_request_id AND p.world_id = p_world_id AND p.operation_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER');
  IF v_kind IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  v_invitation := shared_private.derive_shared_lifecycle_identity_v1('MEMBER_INVITATION', p_request_id::text);

  -- Exact World, request, family and human BEFORE any replay answer.
  v_family := shared_private.shared_lifecycle_command_family_v1(p_command_id);
  IF v_family IS NOT NULL THEN
    IF v_family = 'ACCEPTANCE' AND (
         EXISTS (SELECT 1 FROM public.shared_world_member_acceptance_commands c
                  WHERE c.id = p_command_id AND c.actor_user_id = v_user AND c.world_id = p_world_id
                    AND c.member_invitation_id = v_invitation)
         OR EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands c
                     WHERE c.id = p_command_id AND c.actor_user_id = v_user AND c.world_id = p_world_id
                       AND c.governance_proposal_id = p_request_id)) THEN
      RETURN QUERY SELECT 'JOINED'::text;
    ELSE
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_GOVERNANCE');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  -- LOCK ORDER STEP 2: the caller's own credential row, then the exact target and the exact epoch binding.
  PERFORM 1 FROM public.shared_world_invite_credential_state s WHERE s.user_id = v_user FOR SHARE;
  IF shared_private.shared_reachability_target_v1(p_request_id) IS DISTINCT FROM v_user
     OR NOT shared_private.is_actionable_shared_reachability_v1(p_request_id) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  BEGIN
    IF v_kind = 'ADD_MEMBER' THEN
      PERFORM 1 FROM public.accept_shared_world_member_invitation_v1(
        p_command_id, v_invitation,
        shared_private.derive_shared_lifecycle_identity_v1('MEMBER_EPISODE', p_command_id::text),
        shared_private.derive_shared_lifecycle_identity_v1('MEMBER_JOINED_EVENT', p_command_id::text));
    ELSE
      PERFORM 1 FROM public.commit_shared_world_member_rejoin_v1(
        p_command_id, p_request_id,
        shared_private.derive_shared_lifecycle_identity_v1('MEMBER_EPISODE', p_command_id::text),
        shared_private.derive_shared_lifecycle_identity_v1('MEMBER_REJOINED_EVENT', p_command_id::text));
    END IF;
  EXCEPTION
    WHEN no_data_found OR unique_violation OR serialization_failure OR object_not_in_prerequisite_state THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
      RETURN;
  END;
  RETURN QUERY SELECT 'JOINED'::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. Selective history sharing (CW2-02 §29, §37–§38; CW2-03 §19–§22). Gated by SHARED_HISTORY_ACCESS. The unit is the
--     item: explicit item-level multi-select — no canonical topic / Session / period grouping source exists (CW01 / CW03
--     leave its schema to later work), so none is invented. A package is 1–20 exact candidates (section 2) for ONE current member; the
--     required approvers are the frozen 0087 derivation (the exact union of the items' human authorities), never chosen.
--     The preparation is not an approval; each required human approves; the approval that completes the exact set also
--     commits the grant through the frozen core. UNRESOLVED material can never enter (the 0090 / 0119 trigger).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION shared_private.propose_shared_world_history_share_v1(
  p_command_id uuid, p_world_id uuid, p_member_handle uuid, p_material_ids uuid[]
) RETURNS TABLE (outcome text, package_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_manifest uuid;
  v_family text;
  v_gate record;
  v_grantee uuid;
  v_items uuid[];
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_member_handle IS NULL OR p_material_ids IS NULL
     OR array_length(p_material_ids, 1) IS NULL OR array_length(p_material_ids, 1) > 20
     OR array_position(p_material_ids, NULL) IS NOT NULL
     OR (SELECT count(DISTINCT s.id) FROM unnest(p_material_ids) AS s(id)) <> array_length(p_material_ids, 1) THEN
    RAISE EXCEPTION 'SHARED_HISTORY_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_count := array_length(p_material_ids, 1);
  v_manifest := shared_private.derive_shared_lifecycle_identity_v1('HISTORY_MANIFEST', p_command_id::text);

  -- Exact World, grantee, item set, family and human BEFORE any replay answer.
  v_family := shared_private.shared_lifecycle_command_family_v1(p_command_id);
  IF v_family IS NOT NULL THEN
    IF v_family = 'HISTORY_PROPOSAL' AND shared_private.is_current_shared_member_v1(p_world_id, v_user) AND EXISTS (
         SELECT 1 FROM public.shared_world_history_package_manifest_versions mv
          WHERE mv.id = v_manifest AND mv.world_id = p_world_id
            AND shared_private.shared_member_handle_v1(p_world_id, mv.grantee_user_id) = p_member_handle)
       AND (SELECT count(*) FROM public.shared_world_history_package_manifest_items mi WHERE mi.manifest_version_id = v_manifest) = v_count
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_items mi
                        WHERE mi.manifest_version_id = v_manifest
                          AND NOT EXISTS (SELECT 1 FROM public.shared_world_materials m
                                           WHERE m.history_item_id = mi.history_item_id AND m.id = ANY(p_material_ids))) THEN
      RETURN QUERY SELECT 'PROPOSED'::text, v_manifest;
    ELSE
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_HISTORY_ACCESS');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  SELECT e.user_id INTO v_grantee FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.ended_at IS NULL AND e.user_id <> v_user
     AND shared_private.shared_member_handle_v1(p_world_id, e.user_id) = p_member_handle;
  IF v_grantee IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  -- Every selected message must be an exact candidate NOW, under the World lock; the server maps it to its history item.
  SELECT array_agg(c.history_item_id ORDER BY c.history_item_id) INTO v_items
    FROM shared_private.shared_history_share_candidates_v1(p_world_id, v_user, v_grantee) c
   WHERE c.material_id = ANY(p_material_ids);
  IF v_items IS NULL OR array_length(v_items, 1) <> v_count THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  BEGIN
    PERFORM 1 FROM public.prepare_shared_world_history_package_v1(v_manifest, p_world_id, v_grantee, v_items);
  EXCEPTION
    WHEN no_data_found OR unique_violation OR object_not_in_prerequisite_state THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
      RETURN;
  END;
  RETURN QUERY SELECT 'PROPOSED'::text, v_manifest;
END$$;

-- Outcomes: APPROVED (recorded; others still required) | GRANTED (the exact set is complete; the grant is committed) |
-- STALE (the grantee's episode or an item moved: a new package is needed) | UNAVAILABLE (one answer).
CREATE FUNCTION shared_private.approve_shared_world_history_share_v1(p_command_id uuid, p_world_id uuid, p_package_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_approval uuid;
  v_family text;
  v_gate record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_package_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_HISTORY_APPROVAL_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_approval := shared_private.derive_shared_lifecycle_identity_v1('HISTORY_APPROVAL', p_command_id::text);
  -- The package must belong to the exact supplied World before anything else.
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_versions mv WHERE mv.id = p_package_id AND mv.world_id = p_world_id) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;

  v_family := shared_private.shared_lifecycle_command_family_v1(p_command_id);
  IF v_family IS NOT NULL THEN
    IF v_family = 'HISTORY_APPROVAL' AND EXISTS (
         SELECT 1 FROM public.shared_world_history_package_approvals a
          WHERE a.id = v_approval AND a.manifest_version_id = p_package_id AND a.approver_user_id = v_user) THEN
      RETURN QUERY SELECT CASE WHEN EXISTS (SELECT 1 FROM public.shared_world_history_access_grants g WHERE g.manifest_version_id = p_package_id)
                               THEN 'GRANTED' ELSE 'APPROVED' END;
    ELSE
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_HISTORY_ACCESS');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  -- MEMBERSHIP IS NOT MATERIAL AUTHORITY (CW2-03 §24; 0119): the approver is whoever the frozen derivation made a REQUIRED
  -- approver of this exact manifest — a current member inside the World, or a former member through the account / privacy
  -- surface — and the frozen core refuses everyone else with the same bounded class. Approving grants the approver no
  -- World entry, browsing or state: this command returns an outcome word and nothing else.
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_required_approvers ra
                  WHERE ra.manifest_version_id = p_package_id AND ra.approver_user_id = v_user) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_package_approvals a WHERE a.manifest_version_id = p_package_id AND a.approver_user_id = v_user) THEN
    RETURN QUERY SELECT CASE WHEN EXISTS (SELECT 1 FROM public.shared_world_history_access_grants g WHERE g.manifest_version_id = p_package_id)
                             THEN 'GRANTED' ELSE 'APPROVED' END;
    RETURN;
  END IF;
  BEGIN
    PERFORM 1 FROM public.commit_shared_world_history_package_approval_v1(v_approval, p_package_id);
  EXCEPTION
    WHEN serialization_failure THEN
      RETURN QUERY SELECT 'STALE'::text;
      RETURN;
    WHEN no_data_found OR unique_violation THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
      RETURN;
  END;
  BEGIN
    PERFORM 1 FROM public.commit_shared_world_history_access_grant_v1(
      shared_private.derive_shared_lifecycle_identity_v1('HISTORY_GRANT_COMMAND', p_package_id::text), p_package_id,
      shared_private.derive_shared_lifecycle_identity_v1('HISTORY_GRANT', p_package_id::text),
      shared_private.derive_shared_lifecycle_identity_v1('HISTORY_GRANT_EVENT', p_package_id::text));
  EXCEPTION
    WHEN object_not_in_prerequisite_state THEN
      RETURN QUERY SELECT 'APPROVED'::text;
      RETURN;
    WHEN serialization_failure THEN
      RETURN QUERY SELECT 'STALE'::text;
      RETURN;
  END;
  RETURN QUERY SELECT 'GRANTED'::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 11. The exposed wrappers: SECURITY INVOKER, each a one-line call into its definer.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.read_shared_governance_capabilities_v1()
RETURNS TABLE (governance_available boolean, history_available boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.governance_available, r.history_available FROM shared_private.read_shared_governance_capabilities_v1() r;
$$;

CREATE FUNCTION public.list_own_shared_world_names_v1()
RETURNS TABLE (world_id uuid, world_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.world_id, r.world_name FROM shared_private.list_own_shared_world_names_v1() r;
$$;

CREATE FUNCTION public.read_own_shared_world_settings_v1(p_world_id uuid)
RETURNS TABLE (world_name text, world_description text, world_topic text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.world_name, r.world_description, r.world_topic FROM shared_private.read_own_shared_world_settings_v1(p_world_id) r;
$$;

CREATE FUNCTION public.list_own_shared_world_member_handles_v1(p_world_id uuid)
RETURNS TABLE (member_handle uuid, member_name text, is_self boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.member_handle, r.member_name, r.is_self FROM shared_private.list_own_shared_world_member_handles_v1(p_world_id) r;
$$;

CREATE FUNCTION public.list_own_shared_world_proposals_v1(p_world_id uuid)
RETURNS TABLE (proposal_id uuid, operation_kind text, created_at timestamptz, proposer_name text, proposer_is_self boolean,
               target_name text, proposed_name text, proposed_description text, proposed_topic text,
               approved_by_self boolean, approved_count integer, required_count integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.proposal_id, r.operation_kind, r.created_at, r.proposer_name, r.proposer_is_self, r.target_name, r.proposed_name,
         r.proposed_description, r.proposed_topic, r.approved_by_self, r.approved_count, r.required_count
    FROM shared_private.list_own_shared_world_proposals_v1(p_world_id) r;
$$;

CREATE FUNCTION public.list_own_shared_history_share_candidates_v1(
  p_world_id uuid, p_member_handle uuid, p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE (material_id uuid, established_at timestamptz, is_self boolean, author_name text, text_body text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.material_id, r.established_at, r.is_self, r.author_name, r.text_body
    FROM shared_private.list_own_shared_history_share_candidates_v1(p_world_id, p_member_handle, p_before_established_at,
                                                                     p_before_material_id, p_limit) r;
$$;

CREATE FUNCTION public.list_own_shared_history_share_requests_v1(p_world_id uuid)
RETURNS TABLE (package_id uuid, created_at timestamptz, grantee_name text, approved_by_self boolean,
               material_id uuid, established_at timestamptz, text_body text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.package_id, r.created_at, r.grantee_name, r.approved_by_self, r.material_id, r.established_at, r.text_body
    FROM shared_private.list_own_shared_history_share_requests_v1(p_world_id) r;
$$;

CREATE FUNCTION public.list_own_closed_shared_worlds_v1()
RETURNS TABLE (world_id uuid, closed_at timestamptz, world_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.world_id, r.closed_at, r.world_name FROM shared_private.list_own_closed_shared_worlds_v1() r;
$$;

CREATE FUNCTION public.list_own_closed_shared_world_members_v1()
RETURNS TABLE (world_id uuid, is_self boolean, member_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.world_id, r.is_self, r.member_name FROM shared_private.list_own_closed_shared_world_members_v1() r;
$$;

CREATE FUNCTION public.list_own_closed_shared_world_material_v1(
  p_world_id uuid, p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE (material_id uuid, producer_kind text, established_at timestamptz, is_self boolean, author_name text, text_body text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.material_id, r.producer_kind, r.established_at, r.is_self, r.author_name, r.text_body
    FROM shared_private.list_own_closed_shared_world_material_v1(p_world_id, p_before_established_at, p_before_material_id, p_limit) r;
$$;

CREATE FUNCTION public.list_own_former_shared_world_material_v1(
  p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE (material_id uuid, world_id uuid, established_at timestamptz, text_body text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.material_id, r.world_id, r.established_at, r.text_body
    FROM shared_private.list_own_former_shared_world_material_v1(p_before_established_at, p_before_material_id, p_limit) r;
$$;

CREATE FUNCTION public.list_own_former_shared_history_share_requests_v1()
RETURNS TABLE (package_id uuid, world_id uuid, created_at timestamptz, approved_by_self boolean,
               material_id uuid, established_at timestamptz, text_body text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.package_id, r.world_id, r.created_at, r.approved_by_self, r.material_id, r.established_at, r.text_body
    FROM shared_private.list_own_former_shared_history_share_requests_v1() r;
$$;

CREATE FUNCTION public.list_own_shared_membership_requests_v1()
RETURNS TABLE (request_id uuid, world_id uuid, request_kind text, proposer_name text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.request_id, r.world_id, r.request_kind, r.proposer_name, r.created_at
    FROM shared_private.list_own_shared_membership_requests_v1() r;
$$;

CREATE FUNCTION public.propose_shared_world_member_v1(p_command_id uuid, p_world_id uuid, p_shared_id text)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_private.propose_shared_world_member_v1(p_command_id, p_world_id, p_shared_id) r;
$$;

CREATE FUNCTION public.accept_shared_membership_request_v1(p_command_id uuid, p_world_id uuid, p_request_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_private.accept_shared_membership_request_v1(p_command_id, p_world_id, p_request_id) r;
$$;

CREATE FUNCTION public.leave_shared_world_v1(p_command_id uuid, p_world_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_private.leave_shared_world_v1(p_command_id, p_world_id) r;
$$;

CREATE FUNCTION public.propose_shared_world_settings_v1(p_command_id uuid, p_world_id uuid, p_name text, p_description text, p_topic text)
RETURNS TABLE (outcome text, proposal_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.proposal_id FROM shared_private.propose_shared_world_settings_v1(p_command_id, p_world_id, p_name, p_description, p_topic) r;
$$;

CREATE FUNCTION public.propose_shared_world_member_removal_v1(p_command_id uuid, p_world_id uuid, p_member_handle uuid)
RETURNS TABLE (outcome text, proposal_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.proposal_id FROM shared_private.propose_shared_world_member_removal_v1(p_command_id, p_world_id, p_member_handle) r;
$$;

CREATE FUNCTION public.propose_shared_world_end_v1(p_command_id uuid, p_world_id uuid)
RETURNS TABLE (outcome text, proposal_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.proposal_id FROM shared_private.propose_shared_world_end_v1(p_command_id, p_world_id) r;
$$;

CREATE FUNCTION public.approve_shared_world_proposal_v1(p_command_id uuid, p_world_id uuid, p_proposal_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_private.approve_shared_world_proposal_v1(p_command_id, p_world_id, p_proposal_id) r;
$$;

CREATE FUNCTION public.propose_shared_world_history_share_v1(p_command_id uuid, p_world_id uuid, p_member_handle uuid, p_material_ids uuid[])
RETURNS TABLE (outcome text, package_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.package_id FROM shared_private.propose_shared_world_history_share_v1(p_command_id, p_world_id, p_member_handle, p_material_ids) r;
$$;

CREATE FUNCTION public.approve_shared_world_history_share_v1(p_command_id uuid, p_world_id uuid, p_package_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_private.approve_shared_world_history_share_v1(p_command_id, p_world_id, p_package_id) r;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 12. Privileges. Ownership; default-deny by name (PUBLIC, anon, authenticated and — on a deployment whose default
--     privileges hand new functions to the server channel — service_role); then exactly the human commands to
--     `authenticated`. The server channel is granted nothing.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  internal constant text[] := ARRAY[
    'shared_private.derive_shared_lifecycle_identity_v1(text,text)',
    'shared_private.shared_member_handle_v1(uuid,uuid)',
    'shared_private.shared_lifecycle_command_family_v1(uuid)',
    'shared_private.is_current_shared_member_v1(uuid,uuid)',
    'shared_private.is_current_shared_proposal_topology_v1(uuid)',
    'shared_private.is_committed_shared_proposal_v1(uuid)',
    'shared_private.shared_history_share_candidates_v1(uuid,uuid,uuid)',
    'shared_private.shared_proposal_replay_matches_v1(uuid,uuid,text,uuid)',
    'shared_private.shared_proposal_progress_v1(uuid)',
    'shared_private.shared_reachability_target_v1(uuid)',
    'shared_private.is_actionable_shared_reachability_v1(uuid)',
    'shared_private.record_shared_proposal_origin_v1(uuid,uuid,uuid,bigint,uuid)'];
  human constant text[] := ARRAY[
    'read_shared_governance_capabilities_v1()',
    'list_own_shared_world_names_v1()',
    'read_own_shared_world_settings_v1(uuid)',
    'list_own_shared_world_member_handles_v1(uuid)',
    'list_own_shared_world_proposals_v1(uuid)',
    'list_own_shared_history_share_candidates_v1(uuid,uuid,timestamptz,uuid,integer)',
    'list_own_shared_history_share_requests_v1(uuid)',
    'list_own_closed_shared_worlds_v1()',
    'list_own_closed_shared_world_members_v1()',
    'list_own_closed_shared_world_material_v1(uuid,timestamptz,uuid,integer)',
    'list_own_former_shared_world_material_v1(timestamptz,uuid,integer)',
    'list_own_former_shared_history_share_requests_v1()',
    'list_own_shared_membership_requests_v1()',
    'leave_shared_world_v1(uuid,uuid)',
    'propose_shared_world_settings_v1(uuid,uuid,text,text,text)',
    'propose_shared_world_member_removal_v1(uuid,uuid,uuid)',
    'propose_shared_world_end_v1(uuid,uuid)',
    'approve_shared_world_proposal_v1(uuid,uuid,uuid)',
    'propose_shared_world_member_v1(uuid,uuid,text)',
    'accept_shared_membership_request_v1(uuid,uuid,uuid)',
    'propose_shared_world_history_share_v1(uuid,uuid,uuid,uuid[])',
    'approve_shared_world_history_share_v1(uuid,uuid,uuid)'];
  fn text;
  has_server boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role');
BEGIN
  FOREACH fn IN ARRAY internal LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF has_server THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn); END IF;
  END LOOP;
  FOREACH fn IN ARRAY human LOOP
    EXECUTE format('ALTER FUNCTION shared_private.%s OWNER TO postgres', fn);
    EXECUTE format('ALTER FUNCTION public.%s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION shared_private.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    IF has_server THEN
      EXECUTE format('REVOKE ALL ON FUNCTION shared_private.%s FROM service_role', fn);
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM service_role', fn);
    END IF;
    -- The human's acts, on the human's own token (USAGE on shared_private was granted to authenticated by 0138).
    EXECUTE format('GRANT EXECUTE ON FUNCTION shared_private.%s TO authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 13. Deploy-time self-assertions: refuse a client- or server-callable frozen primitive, an S4-03 command the server
--     channel could act as a human through, a client-reachable internal helper, an unpinned definer, a human command
--     that does not derive its human, a gated command that does not bind its gate before the World row, a gated exit /
--     privacy / closed read, a pre-opened gate, or a new `commit_%` name.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  r text;
  fn text;
  t text;
  p record;
  world_lock constant text := 'FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE';
  s4_03_definers constant text[] := ARRAY['derive_shared_lifecycle_identity_v1', 'shared_member_handle_v1',
    'shared_lifecycle_command_family_v1', 'is_current_shared_member_v1', 'is_current_shared_proposal_topology_v1',
    'is_committed_shared_proposal_v1', 'shared_history_share_candidates_v1', 'shared_proposal_replay_matches_v1',
    'shared_proposal_progress_v1', 'shared_reachability_target_v1', 'is_actionable_shared_reachability_v1',
    'record_shared_proposal_origin_v1',
    'read_shared_governance_capabilities_v1', 'list_own_shared_world_names_v1', 'read_own_shared_world_settings_v1',
    'list_own_shared_world_member_handles_v1', 'list_own_shared_world_proposals_v1', 'list_own_shared_history_share_candidates_v1',
    'list_own_shared_history_share_requests_v1', 'list_own_closed_shared_worlds_v1', 'list_own_closed_shared_world_members_v1',
    'list_own_closed_shared_world_material_v1', 'list_own_former_shared_world_material_v1',
    'list_own_former_shared_history_share_requests_v1', 'list_own_shared_membership_requests_v1', 'leave_shared_world_v1',
    'propose_shared_world_settings_v1', 'propose_shared_world_member_removal_v1', 'propose_shared_world_end_v1',
    'approve_shared_world_proposal_v1', 'propose_shared_world_member_v1', 'accept_shared_membership_request_v1',
    'propose_shared_world_history_share_v1', 'approve_shared_world_history_share_v1'];
  internal_helpers constant text[] := ARRAY['derive_shared_lifecycle_identity_v1', 'shared_member_handle_v1',
    'shared_lifecycle_command_family_v1', 'is_current_shared_member_v1', 'is_current_shared_proposal_topology_v1',
    'is_committed_shared_proposal_v1', 'shared_history_share_candidates_v1', 'shared_proposal_replay_matches_v1',
    'shared_proposal_progress_v1', 'shared_reachability_target_v1', 'is_actionable_shared_reachability_v1',
    'record_shared_proposal_origin_v1'];
BEGIN
  -- Every frozen 0083–0088 core, and the gate operator and bare binding, stay executable by no application role.
  FOREACH fn IN ARRAY ARRAY[
      'public.commit_shared_world_standard_voluntary_leave_v1(uuid,uuid,uuid)',
      'public.capture_shared_world_governance_proposal_v1(uuid,uuid,uuid,text,uuid,text,uuid)',
      'public.commit_shared_world_governance_approval_v1(uuid,uuid)',
      'public.resolve_shared_world_governance_approval_v1(uuid,text,uuid)',
      'public.prepare_shared_world_add_member_governance_v1(uuid,uuid,uuid,uuid,uuid)',
      'public.prepare_shared_world_remove_member_governance_v1(uuid,uuid,uuid,uuid,uuid)',
      'public.prepare_shared_world_rejoin_governance_v1(uuid,uuid,uuid,uuid,uuid)',
      'public.dispatch_shared_world_member_invitation_v1(uuid,uuid)',
      'public.accept_shared_world_member_invitation_v1(uuid,uuid,uuid,uuid)',
      'public.commit_shared_world_member_removal_v1(uuid,uuid,uuid)',
      'public.commit_shared_world_member_rejoin_v1(uuid,uuid,uuid,uuid)',
      'public.prepare_shared_world_settings_change_governance_v1(uuid,uuid,uuid,uuid,text,text,text,text)',
      'public.commit_shared_world_settings_change_v1(uuid,uuid,uuid)',
      'public.prepare_shared_world_history_package_v1(uuid,uuid,uuid,uuid[])',
      'public.commit_shared_world_history_package_approval_v1(uuid,uuid)',
      'public.commit_shared_world_history_access_grant_v1(uuid,uuid,uuid,uuid)',
      'public.prepare_shared_world_standard_end_governance_v1(uuid,uuid,uuid,uuid)',
      'public.commit_shared_world_standard_end_v1(uuid,uuid,uuid)',
      'public.resolve_shared_world_closed_history_visibility_v1(uuid,uuid)',
      'shared_private.set_shared_launch_capability_v1(text,text,text,text,text)',
      'shared_private.bind_shared_launch_gate_v1(text)'] LOOP
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S4-03: PUBLIC can execute %', fn;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S4-03: % can execute % - it is reachable only through the reviewed wrappers', r, fn;
      END IF;
    END LOOP;
  END LOOP;

  -- Every S4-03 definer exists exactly once, is pinned, is never anonymous and never the server channel's; the internal
  -- helpers are nobody's; the human commands are the human's and derive the human from auth.uid().
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'shared_private' AND pr.proname = ANY(s4_03_definers)) <> array_length(s4_03_definers, 1) THEN
    RAISE EXCEPTION 'S4-03: every S4-03 definer exists exactly once';
  END IF;
  FOR p IN SELECT pr.proname, pr.oid, pr.prosecdef, pr.proconfig, pr.prosrc
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'shared_private' AND pr.proname = ANY(s4_03_definers) LOOP
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'S4-03: shared_private.% must be SECURITY DEFINER', p.proname; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'S4-03: shared_private.% must pin an empty search_path', p.proname;
    END IF;
    IF has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('public', p.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'S4-03: shared_private.% is reachable anonymously', p.proname;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = 'service_role') AND has_function_privilege('service_role', p.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'S4-03: the server channel must not act through shared_private.%', p.proname;
    END IF;
    IF p.proname = ANY(internal_helpers) THEN
      IF has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'S4-03: the internal helper shared_private.% is executable by a client', p.proname;
      END IF;
    ELSE
      IF NOT has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'S4-03: authenticated must execute shared_private.%', p.proname;
      END IF;
      IF p.prosrc !~ 'auth\.uid\(\)' THEN
        RAISE EXCEPTION 'S4-03: shared_private.% must derive the human from auth.uid()', p.proname;
      END IF;
    END IF;
  END LOOP;

  -- Every gated command binds its gate BEFORE it takes the World row; exit, privacy and closed reads bind none.
  FOREACH fn IN ARRAY ARRAY['propose_shared_world_settings_v1', 'propose_shared_world_member_removal_v1',
                            'propose_shared_world_end_v1', 'approve_shared_world_proposal_v1',
                            'propose_shared_world_member_v1', 'accept_shared_membership_request_v1'] LOOP
    SELECT pr.prosrc INTO t FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
     WHERE n.nspname = 'shared_private' AND pr.proname = fn;
    IF strpos(t, 'bind_shared_launch_gate_v1(''SHARED_GOVERNANCE'')') = 0 OR strpos(t, world_lock) = 0
       OR strpos(t, 'bind_shared_launch_gate_v1(''SHARED_GOVERNANCE'')') > strpos(t, world_lock) THEN
      RAISE EXCEPTION 'S4-03: % must bind the governance gate, then take the World row', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY['propose_shared_world_history_share_v1', 'approve_shared_world_history_share_v1'] LOOP
    SELECT pr.prosrc INTO t FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
     WHERE n.nspname = 'shared_private' AND pr.proname = fn;
    IF strpos(t, 'bind_shared_launch_gate_v1(''SHARED_HISTORY_ACCESS'')') = 0 OR strpos(t, world_lock) = 0
       OR strpos(t, 'bind_shared_launch_gate_v1(''SHARED_HISTORY_ACCESS'')') > strpos(t, world_lock) THEN
      RAISE EXCEPTION 'S4-03: % must bind the history-access gate, then take the World row', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY['leave_shared_world_v1', 'list_own_closed_shared_worlds_v1', 'list_own_closed_shared_world_members_v1',
                            'list_own_closed_shared_world_material_v1', 'list_own_former_shared_world_material_v1',
                            'list_own_former_shared_history_share_requests_v1'] LOOP
    SELECT pr.prosrc INTO t FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
     WHERE n.nspname = 'shared_private' AND pr.proname = fn;
    IF t ~ 'bind_shared_launch_gate_v1' THEN
      RAISE EXCEPTION 'S4-03: % is an exit right, a privacy control or an entitlement read; it binds no ordinary gate', fn;
    END IF;
  END LOOP;

  -- The one S4-03 table is sealed: RLS on, no policy, no application role; it holds no Shared ID in clear.
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'shared_private.shared_governance_proposal_origins'::regclass)
     OR EXISTS (SELECT 1 FROM pg_policy policy_row WHERE policy_row.polrelid = 'shared_private.shared_governance_proposal_origins'::regclass) THEN
    RAISE EXCEPTION 'S4-03: the proposal origins are RLS-on and policy-free';
  END IF;
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r)
       AND has_table_privilege(r, 'shared_private.shared_governance_proposal_origins', 'SELECT,INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'S4-03: % must not reach the proposal origins', r;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'shared_private' AND table_name = 'shared_governance_proposal_origins'
                AND column_name ~* '(shared_id|plaintext|clear|lookup_ref)') THEN
    RAISE EXCEPTION 'S4-03: the proposal origins keep no Shared ID or lookup reference';
  END IF;

  -- Every reachability act re-reads the target's credential row FOR SHARE after the World row (the epoch binding).
  FOREACH fn IN ARRAY ARRAY['propose_shared_world_member_v1', 'approve_shared_world_proposal_v1', 'accept_shared_membership_request_v1'] LOOP
    SELECT pr.prosrc INTO t FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
     WHERE n.nspname = 'shared_private' AND pr.proname = fn;
    IF strpos(t, 'FROM public.shared_world_invite_credential_state s') = 0 OR strpos(t, 'FOR SHARE') = 0
       OR strpos(t, 'FOR SHARE') < strpos(t, world_lock) THEN
      RAISE EXCEPTION 'S4-03: % must hold the target credential row FOR SHARE after the World row', fn;
    END IF;
  END LOOP;

  -- No capability is opened by a migration; the widened CHECK carries exactly the five scopes.
  IF EXISTS (SELECT 1 FROM shared_private.shared_launch_capability_states
              WHERE capability_scope IN ('SHARED_GOVERNANCE', 'SHARED_HISTORY_ACCESS')) THEN
    RAISE EXCEPTION 'S4-03: a migration configures no launch capability; the governance and history scopes start closed';
  END IF;
  SELECT pg_get_constraintdef(c.oid) INTO t FROM pg_constraint c
   WHERE c.conrelid = 'shared_private.shared_launch_capability_states'::regclass AND c.conname = 'shared_launch_capability_states_scope_check';
  IF t IS NULL OR t !~ 'SHARED_DIRECT_INVITATION' OR t !~ 'SHARED_DIRECT_WORLD_BIRTH' OR t !~ 'SHARED_CONVERSATION'
     OR t !~ 'SHARED_GOVERNANCE' OR t !~ 'SHARED_HISTORY_ACCESS' THEN
    RAISE EXCEPTION 'S4-03: the gate scope CHECK must carry the three earlier scopes and the two S4-03 scopes';
  END IF;

  -- The T-03D single-committing-authority census is untouched: no S4-03 function is named commit_*.
  IF EXISTS (SELECT 1 FROM unnest(s4_03_definers) d(name) WHERE d.name LIKE 'commit\_%') THEN
    RAISE EXCEPTION 'S4-03: no S4-03 command is named commit_*';
  END IF;
END$$;

COMMIT;
