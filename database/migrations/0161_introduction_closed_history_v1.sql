-- S6-05 - the closed Introduction history v1 (CP4: Introduction END & Closed History Integration).
--
-- Product authority: the Product Owner's S6-05 Task Contract v1.0 and its decisions D1-D7, the CP0 rulings R-1 ... R-8
-- (R-5: owner deletion in the active AND the closed Introduction World), the approved IW-28a rev.2 / IW-31 copy and the
-- CP4 authorization (2026-10-16). The execution record is docs/e2e/QANDEEL_S6_05_IMPLEMENTATION_RECORD_v1.md. This
-- migration is that task's CP4 database part, and nothing more.
--
-- After END (S6-02, end_own_introduction_v1 over the frozen 0116 core) each of the two humans holds a frozen closed-view
-- entitlement (0115 / 0116): the exact items they could see at the terminal instant, written before any membership was
-- destroyed. Nothing lets them read it: the CP3 read (0160) answers a member one empty ENDED row, and every Stage 4 closed
-- reader is fenced to STANDARD (S6-02). This migration adds the one missing reader. It changes no existing function.
--
-- ## What is added
--
--   read_my_introduction_history_v1(world, before instant, before id, limit)  NEW, authenticated only
--       One newest-first keyset page of the human words the CALLER is entitled to keep from one Introduction that END
--       closed, as one consistent snapshot:
--         no row                        no closed-view entitlement of the caller over this World - an outsider, a member
--                                       of another Introduction, an unknown World, an Introduction still live, a World
--                                       SUCCESS made Standard (one answer, decided before anything of the World is read:
--                                       no oracle, no existence or ending leak)
--         ENDED rows                    the page, newest first
--         one ENDED row, no message     an entitled human with nothing (left) on this page - the truthful empty answer
--
-- ## Authority, reused and not rebuilt
--
-- The authority is the caller's OWN frozen entitlement (public.introduction_closed_view_entitlements), never active
-- membership: after END both membership episodes are ended and nothing about them is consulted. What the caller sees is
-- decided by the frozen material resolver (0089) over the ONE historical visibility entry point (0119), which delegates a
-- READ_ONLY_CLOSED World to resolve_shared_world_closed_history_visibility_v1 - its Introduction branch reads exactly this
-- caller's entitlement items and re-checks availability on every read. So:
--   * each human reads their own entitlement, independently of the other's;
--   * a later owner deletion (the existing route, R-5) removes the message for BOTH, because availability dominates the
--     frozen set and the body is destroyed;
--   * nothing outside the snapshot can ever appear: no entitlement is created, widened or copied here.
-- Human words only, exactly as the CP3 read: no QANDEEL, analysis or disclosure material is a message.
--
-- ## What is deliberately NOT here
--
-- No change to any existing function, table, seam, policy or privilege (0001-0160 are byte-unchanged); no new END (the
-- S6-02 route is the one END) and no new deletion (the existing Shared owner deletion is reused, R-5); no write of any
-- kind - the reader is STABLE; no Stage 4 fence is lifted; no mobile surface (CP5); no forward producer
-- (QAN-BL-MATCH-06, S6-07); no Activity or Push (S6-07, R-7); no AI of any kind (Stage 8A). Forward-only.
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. READING THE CLOSED HISTORY - one page of what the caller is entitled to keep.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.read_my_introduction_history_v1(
  p_world_id uuid, p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE(introduction_state text, material_id uuid, established_at timestamptz, is_self boolean, text_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'INTRODUCTION_HISTORY_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  -- The caller's OWN frozen closed-view entitlement over an Introduction END closed, or no row - exactly as for an
  -- unknown World, before anything of the World is read. Membership is never consulted: it ended with the Introduction.
  PERFORM 1
     FROM public.introduction_closed_view_entitlements ent
     JOIN public.introduction_records r ON r.id = ent.introduction_record_id AND r.world_id = ent.world_id
     JOIN public.shared_worlds w ON w.id = ent.world_id
    WHERE ent.world_id = p_world_id AND ent.user_id = v_user
      AND r.introduction_status = 'CLOSED' AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'INTRODUCTION';
  IF NOT FOUND THEN
    RETURN;
  END IF;
  -- The frozen material resolver over the one historical entry point decides visibility: for this READ_ONLY_CLOSED
  -- Introduction, resolve_shared_world_closed_history_visibility_v1 - this caller's entitlement items, available now.
  -- Human words only: a deleted message has no body and is not shown; no QANDEEL, analysis or disclosure material.
  RETURN QUERY
    SELECT 'ENDED'::text, m.material_id, m.established_at, m.author_user_id = v_user, m.text_body
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
     WHERE m.material_kind = 'HUMAN_TEXT' AND m.author_user_id IS NOT NULL AND m.text_body IS NOT NULL
       AND (p_before_established_at IS NULL
            OR (m.established_at, m.material_id) < (p_before_established_at, p_before_material_id))
     ORDER BY m.established_at DESC, m.material_id DESC
     LIMIT p_limit;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ENDED'::text, NULL::uuid, NULL::timestamptz, NULL::boolean, NULL::text;
  END IF;
END$$;

COMMENT ON FUNCTION public.read_my_introduction_history_v1(uuid, timestamptz, uuid, integer) IS
  'S6-05 CP4: one newest-first page of the human words the caller is entitled to keep from one Introduction END closed '
  '(their own frozen 0116 closed-view entitlement; availability dominates, so an owner deletion removes it for both). '
  'No row: no entitlement / unknown / not an ended Introduction. ENDED rows (one empty ENDED row for an empty page). '
  'authenticated only.';

-- ---------------------------------------------------------------------------
-- 2. OWNERSHIP AND ACL.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.read_my_introduction_history_v1(uuid, timestamptz, uuid, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.read_my_introduction_history_v1(uuid, timestamptz, uuid, integer) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.read_my_introduction_history_v1(uuid, timestamptz, uuid, integer) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.read_my_introduction_history_v1(uuid, timestamptz, uuid, integer) FROM service_role;
  END IF;
END$$;
GRANT EXECUTE ON FUNCTION public.read_my_introduction_history_v1(uuid, timestamptz, uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn text := 'public.read_my_introduction_history_v1(uuid,timestamptz,uuid,integer)';
  -- the frozen authority it composes keeps its posture: executable by no client role
  hidden text[] := ARRAY[
    'public.resolve_shared_world_closed_history_visibility_v1(uuid,uuid)'];
  r text;
  src text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef AND p.provolatile = 's'
                   AND pg_get_userbyid(p.proowner) = 'postgres' AND p.proconfig @> ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'S6-05: % must be postgres-owned, STABLE, SECURITY DEFINER and search_path-pinned', fn;
  END IF;
  IF has_function_privilege('public', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'S6-05: PUBLIC must not execute %', fn;
  END IF;
  FOREACH r IN ARRAY ARRAY['anon', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S6-05: % must not execute %', r, fn;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AND NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'S6-05: authenticated must execute %', fn;
  END IF;
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO src FROM pg_proc p WHERE p.oid = fn::regprocedure;
  -- Human words only: nothing here reaches a reply, weaving, analysis, Activity, a launch gate, an account Name, a
  -- grant, Personal Context or membership; nothing writes or runs dynamic SQL.
  IF src ~* '(qandeel|semantic|analysis|activity|alert|push|launch_gate|_capability|public\.users|context_grant|personal|memory|membership_episodes)' THEN
    RAISE EXCEPTION 'S6-05: % reaches no reply, weaving, analysis, Activity, Push, gate, account Name, grant, Personal Context or membership', fn;
  END IF;
  IF src ~* '(INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|EXECUTE\s|RAISE;|ISOLATION|FOR\s+UPDATE)' THEN
    RAISE EXCEPTION 'S6-05: % writes nothing, locks nothing, runs no dynamic SQL and re-raises nothing', fn;
  END IF;
  -- The entitlement answer comes before the World's history is read, and visibility is the frozen resolver's.
  IF strpos(src, 'public.introduction_closed_view_entitlements ent') = 0
     OR strpos(src, 'public.introduction_closed_view_entitlements ent') > strpos(src, 'public.resolve_shared_world_material_v1(p_world_id, v_user)')
     OR NOT substr(src, strpos(src, 'public.introduction_closed_view_entitlements ent'),
                   strpos(src, 'public.resolve_shared_world_material_v1(p_world_id, v_user)') - strpos(src, 'public.introduction_closed_view_entitlements ent'))
            ~ 'IF NOT FOUND THEN\s+RETURN;' THEN
    RAISE EXCEPTION 'S6-05: % must answer a caller with no entitlement before it reads the history', fn;
  END IF;
  FOREACH fn IN ARRAY hidden LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-05: % must not execute %', r, fn;
      END IF;
    END LOOP;
  END LOOP;
END$$;

COMMIT;
