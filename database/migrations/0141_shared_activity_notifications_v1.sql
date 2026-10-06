-- S4-04 — Shared Activity, Notifications & Direct Entry v1.
--
-- Additive and forward-only. Migrations 0001–0140 are untouched: no historical table, column, constraint body, trigger,
-- function body or policy is dropped, replaced or rewritten. It creates NO table, no column and no second event, mute,
-- notification or attention store. The Shared domain stays the source of truth; Activity (0136) stays its projection.
--
-- ## What this adds
--
--   1. ONE server pass for the Shared Activity producer: `public.server_read_shared_activity_source_v1(kind, id)`. Given
--      the identity of ONE durable Shared fact — a committed human text, a governance proposal, an add / rejoin request
--      that now waits on its target, a member acceptance, a World birth, a voluntary leave — it derives, from durable
--      Shared truth ONLY, who may legitimately be told about it now, and the bounded facts the sentence needs. The API
--      supplies nothing else: no recipient, no actor, no World, no Name, no time is ever accepted from a caller. Each
--      recipient is a CURRENT member of the exact World (or, for a request, its exact target), never the actor, and only
--      while the fact still stands:
--        - HUMAN_TEXT — the current members, other than its author, to whom the ONE frozen 0089 material resolver returns
--          this exact material now (so a deleted or invisible message tells nobody anything);
--        - PROPOSAL (by the proposer's command id; the proposal identity is derived from it exactly as 0140 derives
--          it, so a well-formed request that opened nothing tells nobody anything) — exactly the people the proposal waits on, by the S4-03 law (`list_own_shared_world_proposals_v1`):
--          current members of its captured topology, never its proposer, never the excluded removal target, only while
--          its topology is current, its reachability actionable and its act uncommitted;
--        - MEMBER_REQUEST — the add / rejoin target alone, by the S4-03 law (`list_own_shared_membership_requests_v1`):
--          only once the request truly waits on them, with the proposer's Name and NOTHING of the World (no name);
--        - JOINED — the current members other than the human whose acceptance / rejoin this command committed;
--        - BIRTH — the inviter of the born World, while still a current member;
--        - LEFT — the current members after this exact voluntary leave.
--      Names are the person's legitimate Name (the same column every S4 read shows); the World label is its committed
--      name only. No content, body, transcript, count or hidden metadata is returned. `service_role` only. It is a
--      `public` SECURITY DEFINER like the 0136 server passes — `shared_private` grants the server channel nothing new
--      (the 0139 / 0140 verifiers pin exactly three reply-work commands there).
--   2. The reader's per-World alert rows (D34; P3 §12.2): `list_own_shared_world_alerts_v1()` — the reader's CURRENT
--      Worlds (the S4-01 entry law: an OPEN episode in an ACTIVE World), each with whether it is muted. Nothing about an
--      ended, former or foreign World; no count.
--   3. The per-World mute command: `set_own_shared_world_alerts_v1(world, muted)`. It closes the A3-01 gap where the
--      0136 mute command can name only a World the reader's Activity already holds: the Shared domain authorizes the
--      exact World by the SAME current-membership law as its entry verdict, then writes the reader's own row in the ONE
--      existing mute table (`public.activity_context_mutes`, context = the World id). Muting World A mutes no other World;
--      it changes notification / attention presentation only — never membership, material, conversation or authority.
--      Activity gains no access to any Connected Worlds table.
--
-- ## Boundary
--
--   - the two human commands live in `shared_private` as pinned SECURITY DEFINERs deriving the human from `auth.uid()`;
--     their `public` wrappers are SECURITY INVOKER one-liners executable by `authenticated` only;
--   - the server pass is executable by `service_role` only; `anon` runs nothing;
--   - no table grant of any kind is made; no `commit_%` name is added; no frozen primitive is re-granted.

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. The Shared Activity source read (server only).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_read_shared_activity_source_v1(p_source_kind text, p_source_id uuid)
RETURNS TABLE (recipient_user_id uuid, world_id uuid, world_name text, actor_name text, subject_name text,
               operation_kind text, occurred_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_world uuid;
  v_actor uuid;
  v_at timestamptz;
BEGIN
  IF p_source_kind IS NULL OR p_source_id IS NULL
     OR p_source_kind NOT IN ('HUMAN_TEXT', 'PROPOSAL', 'MEMBER_REQUEST', 'JOINED', 'BIRTH', 'LEFT') THEN
    RAISE EXCEPTION 'SHARED_ACTIVITY_SOURCE_INVALID' USING ERRCODE = '22023';
  END IF;

  IF p_source_kind = 'HUMAN_TEXT' THEN
    SELECT m.world_id, m.author_user_id, m.established_at INTO v_world, v_actor, v_at
      FROM public.shared_world_materials m
     WHERE m.id = p_source_id AND m.material_kind = 'HUMAN_TEXT' AND m.producer_kind = 'HUMAN';
    IF v_world IS NULL THEN RETURN; END IF;
    RETURN QUERY
      SELECT e.user_id, v_world, shared_private.shared_activity_world_name_v1(v_world), au.name, NULL::text, NULL::text, v_at
        FROM public.shared_world_membership_episodes e
        JOIN public.shared_worlds w ON w.id = e.world_id AND w.lifecycle = 'ACTIVE'
        LEFT JOIN public.users au ON au.id = v_actor
       WHERE e.world_id = v_world AND e.ended_at IS NULL AND e.user_id <> v_actor
         AND EXISTS (SELECT 1 FROM public.resolve_shared_world_material_v1(v_world, e.user_id) r WHERE r.material_id = p_source_id)
       ORDER BY e.user_id;
    RETURN;
  END IF;

  IF p_source_kind = 'PROPOSAL' THEN
    RETURN QUERY
      SELECT e.user_id, p.world_id, shared_private.shared_activity_world_name_v1(p.world_id), pu.name,
             CASE WHEN p.operation_kind = 'REMOVE_MEMBER' THEN tu.name END, p.operation_kind, p.created_at
        FROM public.shared_world_governance_proposals p
        JOIN shared_private.shared_governance_proposal_origins o ON o.governance_proposal_id = p.id
        JOIN public.shared_world_membership_snapshot_members sm ON sm.membership_snapshot_id = p.membership_snapshot_id
        JOIN public.shared_world_membership_episodes e ON e.id = sm.membership_episode_id AND e.world_id = p.world_id AND e.ended_at IS NULL
        LEFT JOIN public.users pu ON pu.id = o.proposer_user_id
        LEFT JOIN public.shared_world_remove_member_payload_versions rp ON rp.governance_proposal_id = p.id
        LEFT JOIN public.users tu ON tu.id = rp.target_user_id
       WHERE p.id = shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL', p_source_id::text)
         AND p.operation_kind IN ('REMOVE_MEMBER', 'WORLD_SETTINGS_CHANGE', 'END_WORLD', 'ADD_MEMBER', 'REJOIN_MEMBER')
         AND e.user_id <> o.proposer_user_id
         AND e.id IS DISTINCT FROM p.excluded_membership_episode_id
         AND shared_private.is_current_shared_member_v1(p.world_id, e.user_id)
         AND shared_private.is_current_shared_proposal_topology_v1(p.id)
         AND shared_private.is_actionable_shared_reachability_v1(p.id)
         AND NOT shared_private.is_committed_shared_proposal_v1(p.id)
       ORDER BY e.user_id;
    RETURN;
  END IF;

  IF p_source_kind = 'MEMBER_REQUEST' THEN
    -- Exactly the S4-03 target read's predicate, for the request's own target: nothing of the World, ever.
    RETURN QUERY
      SELECT t.target, p.world_id, NULL::text, pu.name, NULL::text, p.operation_kind,
             (SELECT max(a.approved_at) FROM public.shared_world_governance_approvals a WHERE a.proposal_id = p.id)
        FROM public.shared_world_governance_proposals p
        JOIN shared_private.shared_governance_proposal_origins o ON o.governance_proposal_id = p.id
        JOIN public.users pu ON pu.id = o.proposer_user_id
        JOIN public.shared_worlds w ON w.id = p.world_id AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
        CROSS JOIN LATERAL (SELECT shared_private.shared_reachability_target_v1(p.id) AS target) t
       WHERE p.id = p_source_id
         AND p.operation_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER')
         AND t.target IS NOT NULL
         AND shared_private.is_actionable_shared_reachability_v1(p.id)
         AND shared_private.is_current_shared_proposal_topology_v1(p.id)
         AND ((p.operation_kind = 'ADD_MEMBER'
               AND EXISTS (SELECT 1 FROM public.shared_world_member_invitations i
                            WHERE i.governance_proposal_id = p.id AND i.target_user_id = t.target AND i.invitation_state = 'PENDING'))
           OR (p.operation_kind = 'REJOIN_MEMBER'
               AND NOT EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands c WHERE c.governance_proposal_id = p.id)
               AND COALESCE((SELECT pg.approved_count >= pg.required_count FROM shared_private.shared_proposal_progress_v1(p.id) pg), false)));
    RETURN;
  END IF;

  IF p_source_kind = 'JOINED' THEN
    SELECT c.world_id, c.actor_user_id, c.committed_at INTO v_world, v_actor, v_at
      FROM public.shared_world_member_acceptance_commands c WHERE c.id = p_source_id;
    IF v_world IS NULL THEN
      SELECT c.world_id, c.actor_user_id, c.committed_at INTO v_world, v_actor, v_at
        FROM public.shared_world_member_rejoin_commands c WHERE c.id = p_source_id;
    END IF;
  ELSIF p_source_kind = 'BIRTH' THEN
    -- The inviter alone, through the exact birth episode, while it is still open: never a later member.
    RETURN QUERY
      SELECT e.user_id, c.world_id, shared_private.shared_activity_world_name_v1(c.world_id), au.name, NULL::text, NULL::text, c.committed_at
        FROM public.shared_world_direct_acceptance_commands c
        JOIN public.shared_world_membership_episodes e ON e.id = c.inviter_membership_episode_id AND e.world_id = c.world_id AND e.ended_at IS NULL
        JOIN public.shared_worlds w ON w.id = c.world_id AND w.lifecycle = 'ACTIVE'
        LEFT JOIN public.users au ON au.id = c.actor_user_id
       WHERE c.world_id = p_source_id AND e.user_id <> c.actor_user_id;
    RETURN;
  ELSE -- LEFT
    SELECT c.world_id, c.actor_user_id, c.committed_at INTO v_world, v_actor, v_at
      FROM public.shared_world_voluntary_leave_commands c WHERE c.id = p_source_id;
  END IF;
  IF v_world IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT e.user_id, v_world, shared_private.shared_activity_world_name_v1(v_world), au.name, NULL::text, NULL::text, v_at
      FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id AND w.lifecycle = 'ACTIVE'
      LEFT JOIN public.users au ON au.id = v_actor
     WHERE e.world_id = v_world AND e.ended_at IS NULL AND e.user_id <> v_actor
     ORDER BY e.user_id;
END$$;

-- The committed World name (the World label once committed), or NULL. Internal: executable by no application role.
CREATE FUNCTION shared_private.shared_activity_world_name_v1(p_world_id uuid)
RETURNS text
LANGUAGE sql STABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT v.name
    FROM public.shared_world_settings_state s
    JOIN public.shared_world_settings_versions v ON v.id = s.current_settings_version_id AND v.world_id = s.world_id
   WHERE s.world_id = p_world_id;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. The reader's per-World alert rows and the per-World mute (D34).
-- ---------------------------------------------------------------------------------------------------------------------

-- The reader's CURRENT Worlds (the S4-01 entry law), each with whether the reader muted it. Nothing else.
CREATE FUNCTION shared_private.list_own_shared_world_alerts_v1()
RETURNS TABLE (world_id uuid, muted boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT w.id,
           EXISTS (SELECT 1 FROM public.activity_context_mutes m WHERE m.user_id = v_user AND m.context_ref = w.id::text)
      FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE'
     ORDER BY w.born_at, w.id;
END$$;

-- Mute or unmute ONE World the reader is a CURRENT member of, by the same law as the entry verdict. Outcomes: MUTED |
-- UNMUTED | UNAVAILABLE (unknown, never existed, left, removed, ended — one answer, no detail). It writes only the
-- reader's own row of the one existing A3-01 mute table.
CREATE FUNCTION shared_private.set_own_shared_world_alerts_v1(p_world_id uuid, p_muted boolean)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_muted IS NULL THEN
    RAISE EXCEPTION 'SHARED_ALERTS_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.world_id = p_world_id AND e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE'
  ) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  IF p_muted THEN
    INSERT INTO public.activity_context_mutes (user_id, context_ref) VALUES (v_user, p_world_id::text) ON CONFLICT DO NOTHING;
    RETURN QUERY SELECT 'MUTED'::text;
  ELSE
    DELETE FROM public.activity_context_mutes m WHERE m.user_id = v_user AND m.context_ref = p_world_id::text;
    RETURN QUERY SELECT 'UNMUTED'::text;
  END IF;
END$$;

CREATE FUNCTION public.list_own_shared_world_alerts_v1()
RETURNS TABLE (world_id uuid, muted boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.world_id, r.muted FROM shared_private.list_own_shared_world_alerts_v1() r;
$$;
CREATE FUNCTION public.set_own_shared_world_alerts_v1(p_world_id uuid, p_muted boolean)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_private.set_own_shared_world_alerts_v1(p_world_id, p_muted) r;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Privileges, every one explicit (0133 removed the hosted default privileges; nothing here relies on a default).
-- ---------------------------------------------------------------------------------------------------------------------
ALTER FUNCTION public.server_read_shared_activity_source_v1(text, uuid) OWNER TO postgres;
ALTER FUNCTION shared_private.shared_activity_world_name_v1(uuid) OWNER TO postgres;
ALTER FUNCTION shared_private.list_own_shared_world_alerts_v1() OWNER TO postgres;
ALTER FUNCTION shared_private.set_own_shared_world_alerts_v1(uuid, boolean) OWNER TO postgres;
ALTER FUNCTION public.list_own_shared_world_alerts_v1() OWNER TO postgres;
ALTER FUNCTION public.set_own_shared_world_alerts_v1(uuid, boolean) OWNER TO postgres;

REVOKE ALL ON FUNCTION
  public.server_read_shared_activity_source_v1(text, uuid),
  shared_private.shared_activity_world_name_v1(uuid),
  shared_private.list_own_shared_world_alerts_v1(),
  shared_private.set_own_shared_world_alerts_v1(uuid, boolean),
  public.list_own_shared_world_alerts_v1(),
  public.set_own_shared_world_alerts_v1(uuid, boolean)
FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION shared_private.shared_activity_world_name_v1(uuid), shared_private.list_own_shared_world_alerts_v1(), shared_private.set_own_shared_world_alerts_v1(uuid, boolean), public.list_own_shared_world_alerts_v1(), public.set_own_shared_world_alerts_v1(uuid, boolean) FROM service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_read_shared_activity_source_v1(text, uuid) TO service_role';
END IF; END$$;

GRANT EXECUTE ON FUNCTION
  shared_private.list_own_shared_world_alerts_v1(),
  shared_private.set_own_shared_world_alerts_v1(uuid, boolean),
  public.list_own_shared_world_alerts_v1(),
  public.set_own_shared_world_alerts_v1(uuid, boolean)
TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Deploy-time self-assertions: the boundary is what this file says, or the migration fails.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_fn text;
BEGIN
  IF has_function_privilege('authenticated', 'public.server_read_shared_activity_source_v1(text, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.server_read_shared_activity_source_v1(text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'S4-04: a client can run the Shared Activity server pass';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY['shared_private.shared_activity_world_name_v1(uuid)'] LOOP
    IF has_function_privilege('authenticated', v_fn, 'EXECUTE') OR has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S4-04: % is executable by a client', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.list_own_shared_world_alerts_v1()', 'public.set_own_shared_world_alerts_v1(uuid, boolean)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S4-04: % is executable by anon', v_fn;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AND EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'shared_private'
       AND p.proname IN ('shared_activity_world_name_v1', 'list_own_shared_world_alerts_v1', 'set_own_shared_world_alerts_v1')
       AND has_function_privilege('service_role', p.oid, 'EXECUTE')) THEN
    RAISE EXCEPTION 'S4-04: the server channel reaches a shared_private S4-04 function';
  END IF;
END$$;
