-- I-03B - Shared Standing Context Grant Resolution Boundary v1.
--
-- Opens ONE server-only read boundary from the sealed I-02B Standing Context
-- Grant persistence (migration 0076) into the frozen I-03A resolution type
-- (StandingContextGrantResolution: FOUND | NOT_FOUND | UNRESOLVED). It follows
-- the repository's narrow server-authorized data-access precedent (migration
-- 0037): service-role runtime -> narrow SECURITY DEFINER RPC -> no direct
-- protected-table access.
--
-- The function answers exactly one server-internal question:
--
--   For exact Shared World W and exact human grantor H, what is the currently
--   ACTIVE Standing Context Grant, if any, and what exact explicit audience
--   ceiling belongs to it?
--
-- Semantics:
--   * ACTIVE only. Revoked rows are historical truth (I-02B) and are never
--     selected as "the latest grant"; there is no current pointer to invent.
--     The one-ACTIVE partial unique index of 0076 guarantees at most one row
--     group.
--   * Canonical existence first. Before a successful zero-row answer the
--     function positively verifies that the Shared World and the human exist;
--     a nonexistent World or human raises a bounded error so the API resolver
--     maps it to UNRESOLVED, never to NOT_FOUND. (A branded TypeScript id alone
--     cannot prove canonical database existence.)
--   * Explicit audience ceiling only, via LEFT JOIN to the grant-audience table
--     for that exact grant, so an ACTIVE grant with an empty ceiling is one row
--     with audience_user_id NULL and remains distinguishable from NOT_FOUND.
--     Membership episodes are never read: the ceiling is never derived from
--     current membership (CW2-02 section 18, B13-B14).
--   * Read-only and STABLE: no INSERT / UPDATE / DELETE, no consent event, no
--     audit event, no runtime event. Grant / revoke / extend commands remain a
--     later atomic authority-command slice.
--   * Output carries only grant_id, world_id, grantor_user_id, status and
--     audience_user_id: no private context material, no purpose / scope /
--     permission / disclosure / provenance field, no membership, Matching or
--     Public data.
--
-- Security posture: SECURITY DEFINER, STABLE, search_path = '', fully
-- qualified names, owned by the migration owner. EXECUTE is revoked from
-- PUBLIC, anon and authenticated and granted to service_role ONLY - no client
-- role can call it, no auth.uid() or JWT is consulted, no client-supplied
-- identity is trusted. Migration 0077 grants NO table privilege: after it,
-- anon, authenticated and service_role still hold no direct SELECT / INSERT /
-- UPDATE / DELETE on either Standing Context Grant table. The only new access
-- path is this exact RPC. Migrations 0001-0076 are untouched; no table, view,
-- type, trigger, policy or extension is created.
--
-- I-03A remains the decision law: this function resolves current authority
-- STATE; whether that state is sufficient for a request and audience is
-- decided by evaluateStandingContextAuthority, and never here.

BEGIN;

CREATE FUNCTION public.resolve_shared_world_standing_context_grant_v1(p_world_id uuid, p_grantor_user_id uuid)
RETURNS TABLE(grant_id uuid, world_id uuid, grantor_user_id uuid, status text, audience_user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_world_id IS NULL OR p_grantor_user_id IS NULL THEN
    RAISE EXCEPTION 'Standing Context Grant resolution requires an exact Shared World and an exact human grantor' USING ERRCODE='22023';
  END IF;
  -- Canonical existence checks: a noncanonical World or human is a bounded
  -- error (UNRESOLVED upstream), never a successful "no grant" answer.
  IF NOT EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = p_world_id) THEN
    RAISE EXCEPTION 'Standing Context Grant resolution target is not a canonical Shared World' USING ERRCODE='P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_grantor_user_id) THEN
    RAISE EXCEPTION 'Standing Context Grant resolution grantor is not a canonical human' USING ERRCODE='P0002';
  END IF;
  -- Exact World + exact grantor + ACTIVE only, joined solely to the explicit
  -- audience ceiling of that exact grant. Ordering is transport stability,
  -- not authority meaning.
  RETURN QUERY
    SELECT g.id, g.world_id, g.grantor_user_id, g.status, a.audience_user_id
      FROM public.shared_world_standing_context_grants g
      LEFT JOIN public.shared_world_standing_context_grant_audience a ON a.grant_id = g.id
     WHERE g.world_id = p_world_id
       AND g.grantor_user_id = p_grantor_user_id
       AND g.status = 'ACTIVE'
     ORDER BY a.audience_user_id;
END$$;

REVOKE ALL ON FUNCTION public.resolve_shared_world_standing_context_grant_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_shared_world_standing_context_grant_v1(uuid, uuid) TO service_role;

-- Terminal self-assertions. The migration refuses to deploy a resolver that is
-- client-callable, mutable, unpinned, or that came with any direct table
-- privilege for an application role.
DO $$
DECLARE
  fn text := 'public.resolve_shared_world_standing_context_grant_v1(uuid,uuid)';
  p record;
  target_role text;
  target_table text;
  target_privilege text;
BEGIN
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.proname = 'resolve_shared_world_standing_context_grant_v1') <> 1 THEN
    RAISE EXCEPTION 'I-03B: exactly one Standing Context Grant resolver must exist';
  END IF;
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
  IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-03B: the resolver must be SECURITY DEFINER'; END IF;
  IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-03B: the resolver must be STABLE (read-only)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-03B: the resolver must pin an empty search_path';
  END IF;
  IF p.prosrc ~* 'membership_episodes' OR p.prosrc ~* 'conversation' OR p.prosrc ~* 'auth\.uid' THEN
    RAISE EXCEPTION 'I-03B: the resolver may read only the grant and audience tables';
  END IF;
  IF has_function_privilege('public', fn, 'EXECUTE') THEN RAISE EXCEPTION 'I-03B: PUBLIC must not execute the resolver'; END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-03B: % must not execute the resolver', target_role;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-03B: service_role must be the only executor of the resolver';
  END IF;
  -- The I-02B seal is intact: no application role gained a direct table privilege.
  FOREACH target_table IN ARRAY ARRAY['public.shared_world_standing_context_grants','public.shared_world_standing_context_grant_audience'] LOOP
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-03B: no RLS policy may exist on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-03B: direct table access stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END$$;

COMMIT;
