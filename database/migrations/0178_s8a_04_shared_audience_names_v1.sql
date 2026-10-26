-- S8A-04 CP3-D V2 — Trusted Claim Spans: the Names a reply may write for its owners (Controlled Amendment R4, §11 R4-2 step
-- 1; the Product Owner's CP3-D V2 Final Implementation Contract of 2026-10-26, §3, option A).
--
-- Forward-only and additive. Migrations 0001–0177 are byte-unchanged in effect and no existing function body is replaced.
-- Nothing here is applied to any hosted database.
--
-- ## What this is
--
-- Under R4 a personal fact is stated only inside a claim span, and the SERVER writes the owner's Name in front of it. That
-- Name must be the one EVERY member who will read the reply is shown for that owner, or the reply would name a person to
-- someone by a Name they were never shown. Names are viewer-relative (S6-02, 0155 `shared_private.shared_person_name_v1`):
-- an ACCEPTED_INVITATION World answers the account Name; a Matching-born World answers only the first name its own Mutual
-- Match presented to that exact viewer, and otherwise NULL.
--
-- `list_shared_audience_names_v1(world)` therefore returns, for every member of the World's exact current human audience
-- (the frozen 0079 snapshot: every open membership, silent members included — no one is left out for not having spoken),
-- the Name that every OTHER member of that audience is shown for them, when it is the same non-blank value for all of them;
-- otherwise NULL. A member alone in the audience has no other viewer: NULL. NULL means only that this member's consented item
-- can never be STATED in this reply; it may still inform it (R4-1). Identity stays the member id, server-side; the Name is
-- presentation, never a key.
--
-- ## What this is not
--
-- No new consent, scope or grant; no write of any kind; no widening of who reads what — the server already reads every one of
-- these Names to render the Shared surfaces (0138 – 0141) for these same members. `service_role` only (the reply composition
-- in the API server); no person, `anon` or client executes it, and no route returns it.

BEGIN;

-- =====================================================================================================================
-- A. THE READ (service_role only, through the public invoker wrapper).
-- =====================================================================================================================

CREATE FUNCTION shared_knowledge_private.list_shared_audience_names_v1(p_world_id uuid)
RETURNS TABLE (user_id uuid, name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_world_id IS NULL THEN RAISE EXCEPTION 'SHARED_AUDIENCE_NAMES_READ_INVALID' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
  WITH audience AS (
    SELECT DISTINCT a.user_id FROM public.resolve_shared_world_human_audience_snapshot_v1(p_world_id) a
  ), shown AS (
    -- What each other member of this audience is shown for each member (blank is no Name).
    SELECT s.user_id AS subject, nullif(btrim(shared_private.shared_person_name_v1(p_world_id, s.user_id, v.user_id)), '') AS shown_name
      FROM audience s JOIN audience v ON v.user_id <> s.user_id
  )
  SELECT a.user_id,
         (SELECT CASE WHEN count(*) > 0 AND count(sh.shown_name) = count(*) AND count(DISTINCT sh.shown_name) = 1
                      THEN min(sh.shown_name) END
            FROM shown sh WHERE sh.subject = a.user_id) AS name
    FROM audience a
   ORDER BY a.user_id;
END;
$$;

CREATE FUNCTION public.list_shared_audience_names_v1(p_world_id uuid)
RETURNS TABLE (user_id uuid, name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.user_id, r.name FROM shared_knowledge_private.list_shared_audience_names_v1(p_world_id) r;
$$;

-- =====================================================================================================================
-- B. PRIVILEGES. Default-deny; then the exact grant.
-- =====================================================================================================================
ALTER FUNCTION shared_knowledge_private.list_shared_audience_names_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.list_shared_audience_names_v1(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION shared_knowledge_private.list_shared_audience_names_v1(uuid), public.list_shared_audience_names_v1(uuid)
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  EXECUTE 'GRANT EXECUTE ON FUNCTION shared_knowledge_private.list_shared_audience_names_v1(uuid), public.list_shared_audience_names_v1(uuid) TO service_role';
END IF; END$$;

-- =====================================================================================================================
-- C. DEPLOY-TIME SELF-ASSERTIONS.
-- =====================================================================================================================
DO $$
DECLARE p record; r text;
BEGIN
  -- C1. A pinned postgres-owned definer behind an invoker wrapper.
  SELECT pr.prosecdef, pr.proconfig, pg_get_userbyid(pr.proowner) AS owner, pr.provolatile, pr.prosrc INTO p
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'shared_knowledge_private' AND pr.proname = 'list_shared_audience_names_v1';
  IF NOT p.prosecdef OR p.owner <> 'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] OR p.provolatile <> 's' THEN
    RAISE EXCEPTION 'S8A-04 CP3-D: shared_knowledge_private.list_shared_audience_names_v1 must be a pinned, STABLE, postgres-owned definer';
  END IF;
  -- C2. It writes nothing.
  IF p.prosrc ~* '(INSERT\s+INTO|UPDATE\s+[a-z_]+\.|DELETE\s+FROM|write_grant_v1\()' THEN
    RAISE EXCEPTION 'S8A-04 CP3-D: list_shared_audience_names_v1 must write nothing';
  END IF;
  IF (SELECT pr.prosecdef FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.proname = 'list_shared_audience_names_v1') THEN
    RAISE EXCEPTION 'S8A-04 CP3-D: public.list_shared_audience_names_v1 must be SECURITY INVOKER';
  END IF;
  -- C3. No person and no anonymous caller executes it.
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r)
       AND (has_function_privilege(r, 'shared_knowledge_private.list_shared_audience_names_v1(uuid)', 'EXECUTE')
            OR has_function_privilege(r, 'public.list_shared_audience_names_v1(uuid)', 'EXECUTE')) THEN
      RAISE EXCEPTION 'S8A-04 CP3-D: % must not execute list_shared_audience_names_v1', r;
    END IF;
  END LOOP;
END$$;

COMMIT;
