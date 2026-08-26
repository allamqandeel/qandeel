-- Finding 03 - Memory Authority Forgery Hardening v1.
--
-- Before this migration, `authenticated` held direct INSERT/UPDATE on
-- public.memories (migration 0004) and could EXECUTE the SECURITY INVOKER
-- supersede_memory RPC. The ownership RLS boundary only proved
-- `user_id = auth.uid()`, which is tenant isolation, not Memory authority: an
-- authenticated client could bypass the application runtime and manufacture or
-- rewrite an owned Memory while choosing server-significant fields - source
-- (including USER_CONFIRMED / ADMIN_CONTROLLED / SYSTEM_DERIVED), status,
-- version, confidence, importance, lifecycle timestamps, expiry and
-- supersession state. Forged rows then flow into Evidence projection,
-- Hypothesis generation/association, model context and Confidence.
--
-- This forward-only migration makes Memory write authority server-only:
--   * authenticated keeps owner-scoped SELECT and loses direct
--     INSERT/UPDATE/DELETE; DELETE was never granted and stays unavailable;
--   * the permissive INSERT/UPDATE RLS policies are dropped so privilege drift
--     cannot silently reactivate a write path;
--   * the legacy generic supersede_memory RPC loses EXECUTE for every
--     application and Data API role - PUBLIC, anon, authenticated and
--     service_role - so it can no longer be used as an equivalent authority
--     bypass whatever ACL state the installation started from;
--   * create / mark-deleted / supersede move to three narrow, purpose-specific
--     SECURITY DEFINER commands that validate owner, vocabulary and lineage
--     explicitly and derive every server-owned column in the database (never
--     "service_role can do anything"). They change who may write, not what a
--     legitimate internal write may do: the existing Memory lifecycle semantics
--     are preserved exactly;
--   * the server REST role keeps the owner-scoped SELECT the background read
--     path relies on but loses direct table write, so possession of the
--     privileged API role is not arbitrary table-mutation authority.
--
-- Existing Memory rows are not read, rewritten or reinterpreted here. This is
-- authority hardening, not historical data repair. Migration 0004's historical
-- text is left untouched.

BEGIN;

-- 1. Table authority. No role may mutate public.memories directly any more.
--    Clients keep owner-scoped read access (Memory Retrieval / Evidence
--    projection); the server REST role keeps SELECT for the background
--    intelligence read path. Every write flows through the definer commands
--    created below.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.memories FROM authenticated;
REVOKE ALL ON TABLE public.memories FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.memories TO authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public.memories FROM service_role';
  EXECUTE 'GRANT SELECT ON TABLE public.memories TO service_role';
END IF;END$$;

-- 2. Remove the obsolete permissive write policies. They now grant an authority
--    that has no legitimate write path behind it, and leaving them advertised
--    would let a future GRANT silently re-open direct client writes. The
--    owner-scoped read policy (memories_select_own) is retained unchanged.
DROP POLICY IF EXISTS memories_insert_own ON public.memories;
DROP POLICY IF EXISTS memories_update_own ON public.memories;

-- 3. Close the legacy generic mutation RPC. public.supersede_memory is
--    SECURITY INVOKER, so with table writes revoked it can no longer mutate
--    anything; EXECUTE is revoked as well so the historical definition is
--    retained without remaining a reachable authority bypass. The revoke names
--    service_role explicitly alongside PUBLIC, anon and authenticated: a
--    Supabase installation may carry an explicit or default EXECUTE grant for
--    the server REST role, and this contract must not depend on
--    environment-specific ACL state. After this statement no application or
--    Data API role can execute it, and it is re-granted to nobody. The function
--    body is unchanged, the function is not dropped, and historical rows are
--    not touched.
REVOKE ALL ON FUNCTION public.supersede_memory(uuid, uuid, text, text, text, double precision, double precision, text, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

-- 4. Shared canonical-shape guard for the two creating commands. It repeats the
--    table vocabulary and bounds deliberately: the server commands must fail
--    closed on malformed trusted input rather than depend only on table CHECK
--    constraints. It reads no rows, mutates nothing, and is SECURITY INVOKER so
--    it can never itself be an authority escalation.
CREATE FUNCTION public.assert_canonical_memory_shape_v1(
  p_type text, p_content text, p_source text, p_confidence double precision,
  p_importance double precision, p_status text, p_expires_at timestamptz
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF p_type IS NULL OR p_type NOT IN (
    'STABLE_PREFERENCE','PERSONAL_FACT','GOAL','DECISION_COMMITMENT',
    'RELATIONSHIP_CONTEXT','INTERACTION_PREFERENCE','TEMPORARY_STATE','DERIVED_INSIGHT'
  ) THEN RAISE EXCEPTION 'INVALID_MEMORY_TYPE' USING ERRCODE='22023'; END IF;
  IF p_source IS NULL OR p_source NOT IN (
    'USER_STATED','USER_CONFIRMED','SYSTEM_DERIVED','IMPORTED','ADMIN_CONTROLLED'
  ) THEN RAISE EXCEPTION 'INVALID_MEMORY_SOURCE' USING ERRCODE='22023'; END IF;
  IF p_status IS NULL OR p_status NOT IN (
    'ACTIVE','SUPERSEDED','EXPIRED','DELETED','DISABLED','PENDING_CONFIRMATION'
  ) THEN RAISE EXCEPTION 'INVALID_MEMORY_STATUS' USING ERRCODE='22023'; END IF;
  IF p_source='SYSTEM_DERIVED' AND p_status='ACTIVE' THEN
    RAISE EXCEPTION 'INVALID_MEMORY_STATUS' USING ERRCODE='22023'; END IF;
  IF p_content IS NULL OR length(btrim(p_content))=0 THEN
    RAISE EXCEPTION 'INVALID_MEMORY_CONTENT' USING ERRCODE='22023'; END IF;
  -- BETWEEN also rejects NaN and infinity, which PostgreSQL orders above every
  -- finite value rather than treating as incomparable.
  IF p_confidence IS NULL OR p_importance IS NULL
     OR NOT (p_confidence BETWEEN 0 AND 1) OR NOT (p_importance BETWEEN 0 AND 1) THEN
    RAISE EXCEPTION 'INVALID_MEMORY_SCORE' USING ERRCODE='22023'; END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'INVALID_MEMORY_EXPIRATION' USING ERRCODE='22023'; END IF;
END;$$;

-- 5. Server-only Memory creation. The caller is trusted internal code, so the
--    canonical semantic values (type/content/source/confidence/importance/
--    status/expiry) are accepted, but the owner is verified, the vocabulary is
--    re-enforced here rather than trusted, and every authoritative column that
--    a client previously could choose is forced: scope, version, lineage and
--    both timestamps are derived in the database. The canonical Memory UUID is
--    supplied by the runtime and returned unchanged so `memory:<uuid>` Evidence
--    identity is preserved exactly.
CREATE FUNCTION public.server_create_memory_v1(
  p_user_id uuid, p_memory_id uuid, p_type text, p_content text, p_source text,
  p_confidence double precision, p_importance double precision, p_status text,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS SETOF public.memories
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE new_row public.memories;
BEGIN
  IF p_user_id IS NULL OR p_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_IDENTITY' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=p_user_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, p_source, p_confidence, p_importance, p_status, p_expires_at);
  INSERT INTO public.memories(
    id, user_id, scope, type, content, source, confidence, importance, status,
    version, created_at, updated_at, expires_at, supersedes_memory_id
  ) VALUES (
    p_memory_id, p_user_id, 'USER', p_type, btrim(p_content), p_source, p_confidence, p_importance, p_status,
    1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, p_expires_at, NULL
  ) RETURNING * INTO new_row;
  RETURN NEXT new_row;
END;$$;

-- 6. Server-only lifecycle deletion. This command changes the authority for the
--    write, not the lifecycle semantics: exactly as before hardening, any
--    existing Memory row owned by p_user_id is a legitimate target whatever its
--    current status, and the only columns that move are status and updated_at.
--    Provenance, scoring, version, lineage, content and created_at are
--    preserved, so a superseded predecessor can be marked deleted while keeping
--    its row, content and lineage, and re-marking an already deleted owned row
--    still returns that row. No physical DELETE is introduced. A nonexistent or
--    wrong-user target returns no row, and malformed input fails closed.
CREATE FUNCTION public.server_mark_memory_deleted_v1(
  p_user_id uuid, p_memory_id uuid
) RETURNS SETOF public.memories
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target public.memories;
BEGIN
  IF p_user_id IS NULL OR p_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_IDENTITY' USING ERRCODE='22023'; END IF;
  SELECT * INTO target FROM public.memories m
    WHERE m.id=p_memory_id AND m.user_id=p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.memories m SET status='DELETED', updated_at=CURRENT_TIMESTAMP
    WHERE m.id=target.id AND m.user_id=p_user_id RETURNING * INTO target;
  RETURN NEXT target;
END;$$;

-- 7. Server-only atomic supersession, replacing the authenticated
--    supersede_memory path. Ownership is validated against the supplied user
--    instead of auth.uid() because the caller is now the server role. The
--    successor inherits owner and scope from the locked predecessor, so
--    ownership can never be transferred, and version/lineage are derived here.
--    Successor insert and predecessor transition happen in one function, so
--    they succeed together or not at all. Self-supersession fails closed;
--    cross-user supersession finds no predecessor and returns empty; the
--    memories_one_successor_unique constraint still enforces the
--    single-successor invariant.
CREATE FUNCTION public.server_supersede_memory_v1(
  p_user_id uuid, p_old_memory_id uuid, p_new_memory_id uuid, p_type text, p_content text,
  p_source text, p_confidence double precision, p_importance double precision, p_status text,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS SETOF public.memories
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE predecessor public.memories; successor public.memories;
BEGIN
  IF p_user_id IS NULL OR p_old_memory_id IS NULL OR p_new_memory_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_MEMORY_IDENTITY' USING ERRCODE='22023'; END IF;
  IF p_old_memory_id = p_new_memory_id THEN
    RAISE EXCEPTION 'A memory cannot supersede itself.' USING ERRCODE='22023'; END IF;
  PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, p_source, p_confidence, p_importance, p_status, p_expires_at);
  SELECT * INTO predecessor FROM public.memories m
    WHERE m.id=p_old_memory_id AND m.user_id=p_user_id AND m.status='ACTIVE'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.memories(
    id, user_id, scope, type, content, source, confidence, importance, status,
    version, created_at, updated_at, expires_at, supersedes_memory_id
  ) VALUES (
    p_new_memory_id, predecessor.user_id, predecessor.scope, p_type, btrim(p_content), p_source,
    p_confidence, p_importance, p_status, predecessor.version + 1,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, p_expires_at, predecessor.id
  ) RETURNING * INTO successor;
  UPDATE public.memories m SET status='SUPERSEDED', updated_at=CURRENT_TIMESTAMP WHERE m.id=predecessor.id;
  RETURN NEXT successor;
END;$$;

-- 8. Ownership, fixed search_path posture, and least-privilege ACLs. All three
--    Memory mutation commands and the shape guard are server-only: PUBLIC, anon
--    and authenticated hold no EXECUTE, and only the server REST role can run
--    them. No broad "update arbitrary columns" RPC is introduced, and no role
--    regains direct table write.
ALTER FUNCTION public.server_create_memory_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz) OWNER TO postgres;
ALTER FUNCTION public.server_mark_memory_deleted_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.server_supersede_memory_v1(uuid,uuid,uuid,text,text,text,double precision,double precision,text,timestamptz) OWNER TO postgres;
ALTER FUNCTION public.assert_canonical_memory_shape_v1(text,text,text,double precision,double precision,text,timestamptz) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.server_create_memory_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.server_mark_memory_deleted_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.server_supersede_memory_v1(uuid,uuid,uuid,text,text,text,double precision,double precision,text,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.assert_canonical_memory_shape_v1(text,text,text,double precision,double precision,text,timestamptz) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION
  public.server_create_memory_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz),
  public.server_mark_memory_deleted_v1(uuid,uuid),
  public.server_supersede_memory_v1(uuid,uuid,uuid,text,text,text,double precision,double precision,text,timestamptz)
  TO service_role;

COMMIT;
