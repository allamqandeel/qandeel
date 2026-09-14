-- I-03D - Shared Human Audience Snapshot Resolution Boundary v1.
--
-- Opens ONE server-only read boundary from the sealed I-02A Shared membership
-- persistence (migration 0075) into the frozen I-03A audience contract
-- (SharedHumanAudienceSnapshot). It follows the repository's narrow
-- service-role resolver precedent (migrations 0037 and 0077): service-role
-- runtime -> narrow SECURITY DEFINER RPC -> protected tables stay directly
-- sealed. It is the second step of the frozen CW2-02 section 21 pre-model
-- sequence ("Resolve exact Audience Snapshot") for exactly one audience family:
--
--   FULL_CURRENT_SHARED_HUMAN_AUDIENCE
--
-- The function answers exactly one server-internal question:
--
--   For exact Shared World W, which humans hold a CURRENTLY OPEN membership
--   episode in W, and under which exact episode identity?
--
-- Semantics:
--   * Current membership is exactly `world_id = p_world_id AND ended_at IS NULL`
--     (CW2-03 section 15: current members are derived from open episodes).
--     Closed historical episodes, "latest episode regardless of ended_at",
--     other Worlds' members and Standing Context grant ceilings contribute
--     nothing; historical and current membership are never unioned. Migration
--     0075's one-open-episode partial unique index guarantees each human at
--     most once in canonical state.
--   * Canonical existence first. A nonexistent Shared World raises a bounded
--     error (P0002; NULL input 22023) so the API resolver maps it to
--     UNRESOLVED, never to an EMPTY audience: a branded TypeScript id alone
--     cannot prove canonical database existence (the I-03B trust-boundary
--     rule). A canonical World with zero open episodes is a successful
--     zero-row answer (EMPTY), distinct from failure.
--   * Lifecycle is NOT consulted. A READ_ONLY_CLOSED World with open episodes
--     resolves exactly as persisted: audience-state resolution is not
--     permission to start a new generation, which a later pre-model execution
--     boundary owns (task I-03D section 11). No I-04 lifecycle semantics are
--     invented here; if a later lifecycle command closes episodes, this
--     resolver naturally reports the resulting state.
--   * Each row carries the membership episode identity. The API-side snapshot
--     fingerprint binds user_id AND membership_episode_id, so a leave followed
--     by a rejoin changes the snapshot even when the human set is identical
--     again (task I-03D section 12, CW2-02 section 48 / B34).
--   * Current membership is NOT historical-material access (CW2-01 A9, CW2-02
--     B21, CW2-03 section 19): nothing here reads Shared material, Sessions,
--     history grants or Standing Context grants, and the output carries only
--     world_id, membership_episode_id and user_id - no join time, no lifecycle,
--     no phase, no material, no grant, no Matching or Public data.
--   * Read-only and STABLE: no INSERT / UPDATE / DELETE, no event, no audit
--     write, no membership or lifecycle mutation.
--   * Ordering (user_id, membership_episode_id) is transport stability only,
--     never audience meaning.
--
-- Security posture: SECURITY DEFINER, STABLE, search_path = '', fully
-- qualified names, owned by the migration owner. EXECUTE is revoked from
-- PUBLIC, anon and authenticated and granted to service_role ONLY - no client
-- role can call it, no auth.uid() or JWT is consulted, no client-supplied
-- audience is trusted (CW2-02 section 44: audience is never inferred from the
-- UI surface). Migration 0079 grants NO table privilege: after it, anon,
-- authenticated and service_role still hold no direct SELECT / INSERT / UPDATE
-- / DELETE on shared_worlds or shared_world_membership_episodes (the I-02A
-- deny-by-default posture is intact). Migrations 0001-0078 are untouched; no
-- table, view, type, trigger, policy or extension is created.
--
-- I-03A remains the decision law: this function resolves audience STATE; the
-- later I-03 slices compose it with grant resolution (I-03B), the I-03A
-- decision and candidate context into an EffectiveContext, and revalidate
-- authority and audience before delivery. None of that happens here.

BEGIN;

CREATE FUNCTION public.resolve_shared_world_human_audience_snapshot_v1(p_world_id uuid)
RETURNS TABLE(world_id uuid, membership_episode_id uuid, user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_world_id IS NULL THEN
    RAISE EXCEPTION 'Shared human audience resolution requires an exact Shared World' USING ERRCODE='22023';
  END IF;
  -- Canonical existence check: a noncanonical World is a bounded error
  -- (UNRESOLVED upstream), never a successful empty audience.
  IF NOT EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = p_world_id) THEN
    RAISE EXCEPTION 'Shared human audience resolution target is not a canonical Shared World' USING ERRCODE='P0002';
  END IF;
  -- Exactly the currently open membership episodes of the exact World.
  -- Lifecycle is deliberately not a filter here.
  RETURN QUERY
    SELECT e.world_id, e.id, e.user_id
      FROM public.shared_world_membership_episodes e
     WHERE e.world_id = p_world_id
       AND e.ended_at IS NULL
     ORDER BY e.user_id, e.id;
END$$;

REVOKE ALL ON FUNCTION public.resolve_shared_world_human_audience_snapshot_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_shared_world_human_audience_snapshot_v1(uuid) TO service_role;

-- Terminal self-assertions. The migration refuses to deploy a resolver that is
-- client-callable, mutable, unpinned, lifecycle-filtering, grant- or
-- material-reading, or that came with any direct membership-table privilege
-- for an application role.
DO $$
DECLARE
  fn text := 'public.resolve_shared_world_human_audience_snapshot_v1(uuid)';
  p record;
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
BEGIN
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.proname = 'resolve_shared_world_human_audience_snapshot_v1') <> 1 THEN
    RAISE EXCEPTION 'I-03D: exactly one Shared human audience resolver must exist';
  END IF;
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
  IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-03D: the audience resolver must be SECURITY DEFINER'; END IF;
  IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-03D: the audience resolver must be STABLE (read-only)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-03D: the audience resolver must pin an empty search_path';
  END IF;
  IF p.prosrc !~ 'e\.ended_at IS NULL' THEN
    RAISE EXCEPTION 'I-03D: current audience must be exactly the open membership episodes';
  END IF;
  IF p.prosrc ~* 'lifecycle' OR p.prosrc ~* 'standing_context' OR p.prosrc ~* 'grant' OR p.prosrc ~* 'conversation'
     OR p.prosrc ~* 'auth\.uid' OR p.prosrc ~* 'request\.jwt' THEN
    RAISE EXCEPTION 'I-03D: the audience resolver may read only the Shared World row and the membership episodes';
  END IF;
  IF has_function_privilege('public', fn, 'EXECUTE') THEN RAISE EXCEPTION 'I-03D: PUBLIC must not execute the audience resolver'; END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-03D: % must not execute the audience resolver', target_role;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-03D: service_role must be the only executor of the audience resolver';
  END IF;
  -- The I-02A seal is intact: no application role gained a direct membership-table privilege.
  FOREACH target_table IN ARRAY ARRAY['public.shared_worlds','public.shared_world_membership_episodes'] LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN RAISE EXCEPTION 'I-03D: row level security must stay enabled on %', target_table; END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-03D: no RLS policy may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = target_table::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-03D: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-03D: direct membership-table access stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END$$;

COMMIT;
