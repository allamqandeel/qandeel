-- I-03E - Shared Pre-Model World-State Resolution Boundary v1.
--
-- Opens ONE server-only read boundary from the sealed I-02A Shared World row
-- (migration 0075) into the Shared EffectiveContext pre-model World gate. It
-- follows the repository's narrow service-role resolver precedent (migrations
-- 0037, 0077 and 0079): service-role runtime -> narrow SECURITY DEFINER RPC ->
-- protected table stays directly sealed. It is the first step of the frozen
-- CW2-02 section 21 pre-model sequence ("Resolve World / capability") for the
-- Shared private-reasoning lane.
--
-- The function answers exactly one server-internal question:
--
--   For exact Shared World W, what are its canonical lifecycle and phase?
--
-- Semantics:
--   * Canonical existence first. A nonexistent Shared World raises a bounded
--     error (P0002; NULL input 22023) so the API resolver maps it to
--     UNRESOLVED / CONTRADICTORY_CANONICAL_STATE - never to "closed", never to
--     "empty", never to a zero-row answer: a branded TypeScript id alone cannot
--     prove canonical database existence (the I-03B trust-boundary rule).
--   * Exactly one row: the canonical row's id, lifecycle and phase, nothing
--     else - no born_at, no closed_at, no birth_basis, no membership, no
--     Standing Context state, no Shared material, no Personal context.
--   * Lifecycle is RETURNED, not decided. Whether READ_ONLY_CLOSED blocks an
--     ordinary Shared generation (CW2-03 section 35 / C31: read-only closure
--     blocks ordinary mutation) is decided by the API-side EffectiveContext
--     service from this snapshot; nothing here mutates lifecycle or phase, and
--     no I-04 lifecycle command is invented.
--   * Audience is NOT consulted (I-03D resolves it separately): World state and
--     current occupancy are separate facts (CW2-01 section 14).
--   * Read-only and STABLE: no INSERT / UPDATE / DELETE, no event, no audit
--     write, no lifecycle mutation.
--
-- Security posture: SECURITY DEFINER, STABLE, search_path = '', fully
-- qualified names, owned by the migration owner. EXECUTE is revoked from
-- PUBLIC, anon and authenticated and granted to service_role ONLY - no client
-- role can call it, no auth.uid() or JWT is consulted, no client-supplied
-- lifecycle is trusted (CW2-02 section 4: client-provided claims are never
-- final authority). Migration 0080 grants NO table privilege: after it, anon,
-- authenticated and service_role still hold no direct SELECT / INSERT / UPDATE
-- / DELETE on shared_worlds (the I-02A deny-by-default posture is intact).
-- Migrations 0001-0079 are untouched; no table, view, type, trigger, policy or
-- extension is created.
--
-- I-03A remains the decision law and I-03E's EffectiveContext service the
-- composition: this function resolves World STATE only.

BEGIN;

CREATE FUNCTION public.resolve_shared_world_pre_model_state_v1(p_world_id uuid)
RETURNS TABLE(world_id uuid, lifecycle text, phase text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_world_id IS NULL THEN
    RAISE EXCEPTION 'Shared pre-model World-state resolution requires an exact Shared World' USING ERRCODE='22023';
  END IF;
  -- Canonical existence check: a noncanonical World is a bounded error
  -- (UNRESOLVED upstream), never a zero-row answer and never a closed World.
  IF NOT EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = p_world_id) THEN
    RAISE EXCEPTION 'Shared pre-model World-state resolution target is not a canonical Shared World' USING ERRCODE='P0002';
  END IF;
  -- Exactly the canonical row's identity, lifecycle and phase.
  RETURN QUERY
    SELECT w.id, w.lifecycle, w.phase
      FROM public.shared_worlds w
     WHERE w.id = p_world_id;
END$$;

REVOKE ALL ON FUNCTION public.resolve_shared_world_pre_model_state_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_shared_world_pre_model_state_v1(uuid) TO service_role;

-- Terminal self-assertions. The migration refuses to deploy a resolver that is
-- client-callable, mutable, unpinned, membership-, grant- or material-reading,
-- or that came with any direct shared_worlds privilege for an application role.
DO $$
DECLARE
  fn text := 'public.resolve_shared_world_pre_model_state_v1(uuid)';
  p record;
  target_role text;
  target_table text := 'public.shared_worlds';
  target_privilege text;
  rls_enabled boolean;
BEGIN
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.proname = 'resolve_shared_world_pre_model_state_v1') <> 1 THEN
    RAISE EXCEPTION 'I-03E: exactly one Shared pre-model World-state resolver must exist';
  END IF;
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
  IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-03E: the World-state resolver must be SECURITY DEFINER'; END IF;
  IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-03E: the World-state resolver must be STABLE (read-only)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-03E: the World-state resolver must pin an empty search_path';
  END IF;
  IF p.prosrc !~ 'SELECT w\.id, w\.lifecycle, w\.phase' OR p.prosrc !~ 'FROM public\.shared_worlds w' THEN
    RAISE EXCEPTION 'I-03E: the World-state resolver must return exactly the canonical Shared World row''s identity, lifecycle and phase';
  END IF;
  IF p.prosrc ~* 'membership_episodes' OR p.prosrc ~* 'standing_context' OR p.prosrc ~* 'grant' OR p.prosrc ~* 'consent'
     OR p.prosrc ~* 'conversation' OR p.prosrc ~* 'auth\.uid' OR p.prosrc ~* 'request\.jwt'
     OR p.prosrc ~* 'closed_at' OR p.prosrc ~* 'born_at' OR p.prosrc ~* 'birth_basis' THEN
    RAISE EXCEPTION 'I-03E: the World-state resolver may read only the Shared World row''s lifecycle and phase';
  END IF;
  IF has_function_privilege('public', fn, 'EXECUTE') THEN RAISE EXCEPTION 'I-03E: PUBLIC must not execute the World-state resolver'; END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-03E: % must not execute the World-state resolver', target_role;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-03E: service_role must be the only executor of the World-state resolver';
  END IF;
  -- The I-02A seal is intact: no application role gained a direct shared_worlds privilege.
  SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
  IF NOT rls_enabled THEN RAISE EXCEPTION 'I-03E: row level security must stay enabled on %', target_table; END IF;
  IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
    RAISE EXCEPTION 'I-03E: no RLS policy may exist on %', target_table;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
              WHERE c.oid = target_table::regclass AND privilege.grantee = 0) THEN
    RAISE EXCEPTION 'I-03E: PUBLIC must hold no privilege on %', target_table;
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
      FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
        IF has_table_privilege(target_role, target_table, target_privilege) THEN
          RAISE EXCEPTION 'I-03E: direct Shared World table access stays sealed: % holds % on %', target_role, target_privilege, target_table;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END$$;

COMMIT;
