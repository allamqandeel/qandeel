-- S8A-04 CP3-C — Personal Knowledge in Shared World: the owner's permission surface by member names
-- (QANDEEL_S8A-04_CP3_PERSONAL_KNOWLEDGE_IN_SHARED_WORLD_CONTROLLED_AMENDMENT_v1.0 §7 CG-1 – CG-5, approved 6/6 by the Product
-- Owner on 2026-10-25 with the CP3-C authorization §3: every operation under the user's own identity, protection in the
-- server and the database).
--
-- Forward-only and additive. Migrations 0001–0176 are byte-unchanged in effect and no existing function body is replaced.
-- Nothing here is applied to any hosted database.
--
-- ## Why a v2 surface
--
-- The 0176 owner read returns, and its ALLOW commands take, the audience ceiling as user ids. No Shared route takes or
-- returns a user id (the S4-01 route doctrine): the owner is shown the other members by NAME (CG-1 «{members}», CG-3 the
-- new members, CG-4 the Allow-now confirmation), and answers about the audience they were shown. So:
--   * `list_own_shared_knowledge_v2` is the 0176 owner read with the ceiling replaced by names — the other current members
--     (S6-02's one name projection, `shared_person_name_v1`, in join order), the members a reconfirmation is about (current
--     members outside the ceiling) — and an opaque `audience_ref` of the current audience; plus the CG-5 «left this World»
--     ending of an earlier membership episode's permission, shown to a rejoined owner until they decide afresh;
--   * `answer_own_shared_knowledge_request_v2` and `allow_own_shared_knowledge_v2` take that `audience_ref` instead of ids:
--     only the reference of the audience NOW stands for the ceiling, and the unchanged 0176 command decides (its own
--     exact-ceiling rule, replay, conflict and UNAVAILABLE answers). A stale reference is AUDIENCE_CHANGED and writes
--     nothing, so the client shows the new list.
-- Withdrawal takes no audience and stays `revoke_own_shared_knowledge_v1`.
--
-- The 0176 owner read and the two ALLOW commands that carry user ids are then RETIRED for a person (§D.2): the v1 read
-- returns the co-members' user ids, which no other member-facing read exposes (0138 names members only). They remain the
-- private building blocks the v2 functions call as their owner; a person reaches the surface through v2 only.
--
-- The grantor is always auth.uid(); `service_role` executes none of this; no grant is written here except through the
-- 0176 owner commands (whose consent writer is unchanged). Product Owner decision D1 (2026-10-25): the local relevance read
-- stays server-only and purpose-bound; this file widens nothing of it.

BEGIN;

-- =====================================================================================================================
-- A. THE DERIVATION. Executable by no application role.
-- =====================================================================================================================

-- A.1 The opaque reference of a World's exact current human audience: what the owner was shown, without naming anyone.
CREATE FUNCTION shared_knowledge_private.audience_ref_v2(p_world uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 'sha256:' || encode(pg_catalog.sha256(convert_to(
           'QANDEEL_S8A04_CP3_SHARED_KNOWLEDGE_AUDIENCE_V2' || E'\n' || 'world=' || lower(p_world::text) || E'\n' || 'members='
           || coalesce((SELECT string_agg(lower(a::text), ',' ORDER BY lower(a::text))
                          FROM unnest(shared_knowledge_private.audience_v1(p_world)) a), ''), 'UTF8')), 'hex');
$$;

-- =====================================================================================================================
-- B. THE OWNER'S READ AND COMMANDS (authenticated). Names and a reference, never an id of anyone.
-- =====================================================================================================================

-- B.1 The owner's own view of one World (CG-1, CG-3, CG-4, CG-5). The 0176 view's sections, words and endings, unchanged;
--     `member_names` the other current members; `new_member_names` (NEEDS_RECONFIRMATION only) the current members the
--     ceiling does not cover; `audience_ref` the current audience. A permission of an earlier membership episode that was
--     still in force when the owner left is ENDED / LEFT, until the owner decides about that item in this episode.
CREATE FUNCTION shared_knowledge_private.list_own_shared_knowledge_v2(p_world_id uuid)
RETURNS TABLE (section text, memory_id uuid, content text, request_id uuid, ended_reason text, member_names text[],
               new_member_names text[], audience_ref text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := (SELECT auth.uid()); v_episode uuid; v_others text[]; v_ref text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_world_id IS NULL THEN RAISE EXCEPTION 'SHARED_KNOWLEDGE_READ_INVALID' USING ERRCODE = '22023'; END IF;
  v_episode := shared_knowledge_private.open_episode_v1(p_world_id, v_user);
  IF v_episode IS NULL THEN RETURN; END IF;
  -- A name the projection cannot give stays NULL: the API never asks for consent over an audience it cannot name.
  SELECT coalesce(array_agg(shared_private.shared_person_name_v1(p_world_id, e.user_id, v_user) ORDER BY e.joined_at, e.id), ARRAY[]::text[])
    INTO v_others
    FROM unnest(shared_knowledge_private.audience_v1(p_world_id)) a(user_id)
    JOIN public.shared_world_membership_episodes e ON e.world_id = p_world_id AND e.user_id = a.user_id AND e.ended_at IS NULL
   WHERE a.user_id <> v_user;
  v_ref := shared_knowledge_private.audience_ref_v2(p_world_id);
  RETURN QUERY
  WITH current_view AS (
    SELECT v.section, v.memory_id, v.content, v.request_id, v.ended_reason, v.ceiling_user_ids
      FROM shared_knowledge_private.list_own_shared_knowledge_v1(p_world_id) v
  ), earlier AS (
    SELECT DISTINCT ON (r.memory_id) r.memory_id
      FROM shared_knowledge_private.reasoning_grants r
     WHERE r.world_id = p_world_id AND r.owner_user_id = v_user AND r.membership_episode_id <> v_episode AND r.status = 'ACTIVE'
       AND NOT EXISTS (SELECT 1 FROM shared_knowledge_private.consent_events e
                        WHERE e.world_id = p_world_id AND e.owner_user_id = v_user AND e.membership_episode_id = v_episode
                          AND e.memory_id = r.memory_id)
       AND NOT EXISTS (SELECT 1 FROM shared_knowledge_private.requests q
                        WHERE q.world_id = p_world_id AND q.owner_user_id = v_user AND q.membership_episode_id = v_episode
                          AND q.memory_id = r.memory_id)
     ORDER BY r.memory_id, r.created_at DESC, r.id DESC
  )
  SELECT c.section, c.memory_id, c.content, c.request_id, c.ended_reason, v_others,
         CASE WHEN c.section = 'NEEDS_RECONFIRMATION' THEN
           (SELECT coalesce(array_agg(shared_private.shared_person_name_v1(p_world_id, e.user_id, v_user) ORDER BY e.joined_at, e.id), ARRAY[]::text[])
              FROM unnest(shared_knowledge_private.audience_v1(p_world_id)) a(user_id)
              JOIN public.shared_world_membership_episodes e ON e.world_id = p_world_id AND e.user_id = a.user_id AND e.ended_at IS NULL
             WHERE a.user_id <> v_user AND NOT (a.user_id = ANY (c.ceiling_user_ids)))
         END,
         v_ref
    FROM current_view c
  UNION ALL
  SELECT 'ENDED'::text, x.memory_id, i.content, NULL::uuid, 'LEFT'::text, v_others, NULL::text[], v_ref
    FROM earlier x CROSS JOIN LATERAL shared_knowledge_private.item_v1(v_user, x.memory_id) i
  ORDER BY 1, 2;
END$$;

-- B.2 Answer one open request (CG-1 / CG-2) about the audience the owner was shown. ALLOW: the reference must be the
--     current audience's, and the 0176 command then decides with that exact audience. DECLINE takes no reference.
CREATE FUNCTION shared_knowledge_private.answer_own_shared_knowledge_request_v2(p_command_id uuid, p_request_id uuid, p_decision text,
                                                                               p_audience_ref text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := (SELECT auth.uid()); v_world uuid; v_ceiling uuid[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_command_id IS NULL OR p_request_id IS NULL OR p_decision IS NULL OR p_decision NOT IN ('ALLOW', 'DECLINE')
     OR (p_decision = 'ALLOW' AND (p_audience_ref IS NULL OR p_audience_ref !~ '^sha256:[0-9a-f]{64}$'))
     OR (p_decision = 'DECLINE' AND p_audience_ref IS NOT NULL) THEN
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'ALLOW' THEN
    -- Only the caller's own request names a World here; anyone else's is UNAVAILABLE in the 0176 command.
    SELECT r.world_id INTO v_world FROM shared_knowledge_private.requests r WHERE r.id = p_request_id AND r.owner_user_id = v_user;
    -- A stale or foreign reference stands for no audience: the empty ceiling, which the 0176 rule answers AUDIENCE_CHANGED.
    v_ceiling := CASE WHEN v_world IS NOT NULL AND p_audience_ref = shared_knowledge_private.audience_ref_v2(v_world)
                      THEN shared_knowledge_private.audience_v1(v_world) ELSE ARRAY[]::uuid[] END;
  END IF;
  RETURN QUERY SELECT a.outcome
    FROM shared_knowledge_private.answer_own_shared_knowledge_request_v1(p_command_id, p_request_id, p_decision, v_ceiling) a;
END$$;

-- B.3 Allow an item already decided about here (CG-3 «اسمح للجميع», CG-4 «اسمح الآن») about the audience the owner was
--     shown. Same reference rule; the 0176 command decides.
CREATE FUNCTION shared_knowledge_private.allow_own_shared_knowledge_v2(p_command_id uuid, p_world_id uuid, p_memory_id uuid, p_audience_ref text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_memory_id IS NULL OR p_audience_ref IS NULL
     OR p_audience_ref !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT a.outcome
    FROM shared_knowledge_private.allow_own_shared_knowledge_v1(p_command_id, p_world_id, p_memory_id,
           CASE WHEN p_audience_ref = shared_knowledge_private.audience_ref_v2(p_world_id)
                THEN shared_knowledge_private.audience_v1(p_world_id) ELSE ARRAY[]::uuid[] END) a;
END$$;

-- =====================================================================================================================
-- C. THE EXPOSED WRAPPERS: SECURITY INVOKER, each a one-line call into its definer.
-- =====================================================================================================================
CREATE FUNCTION public.list_own_shared_knowledge_v2(p_world_id uuid)
RETURNS TABLE (section text, memory_id uuid, content text, request_id uuid, ended_reason text, member_names text[],
               new_member_names text[], audience_ref text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.section, r.memory_id, r.content, r.request_id, r.ended_reason, r.member_names, r.new_member_names, r.audience_ref
    FROM shared_knowledge_private.list_own_shared_knowledge_v2(p_world_id) r;
$$;
CREATE FUNCTION public.answer_own_shared_knowledge_request_v2(p_command_id uuid, p_request_id uuid, p_decision text, p_audience_ref text)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_knowledge_private.answer_own_shared_knowledge_request_v2(p_command_id, p_request_id, p_decision, p_audience_ref) r;
$$;
CREATE FUNCTION public.allow_own_shared_knowledge_v2(p_command_id uuid, p_world_id uuid, p_memory_id uuid, p_audience_ref text)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_knowledge_private.allow_own_shared_knowledge_v2(p_command_id, p_world_id, p_memory_id, p_audience_ref) r;
$$;

-- =====================================================================================================================
-- D. PRIVILEGES. Default-deny; then the owner's three for `authenticated` only.
-- =====================================================================================================================
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE (n.nspname = 'shared_knowledge_private' AND p.proname IN ('audience_ref_v2', 'list_own_shared_knowledge_v2',
                     'answer_own_shared_knowledge_request_v2', 'allow_own_shared_knowledge_v2'))
               OR (n.nspname = 'public' AND p.proname IN ('list_own_shared_knowledge_v2', 'answer_own_shared_knowledge_request_v2',
                     'allow_own_shared_knowledge_v2')) LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', f.sig);
    END IF;
  END LOOP;
END$$;

GRANT EXECUTE ON FUNCTION
  shared_knowledge_private.list_own_shared_knowledge_v2(uuid),
  shared_knowledge_private.answer_own_shared_knowledge_request_v2(uuid, uuid, text, text),
  shared_knowledge_private.allow_own_shared_knowledge_v2(uuid, uuid, uuid, text),
  public.list_own_shared_knowledge_v2(uuid),
  public.answer_own_shared_knowledge_request_v2(uuid, uuid, text, text),
  public.allow_own_shared_knowledge_v2(uuid, uuid, uuid, text)
  TO authenticated;

-- D.2 The 0176 owner read and the two commands taking a ceiling of user ids: retired for a person (header). The v2 definers
--     call them as their owner; nothing else does. `revoke_own_shared_knowledge_v1` takes no user id and stays the owner's.
REVOKE ALL ON FUNCTION
  public.list_own_shared_knowledge_v1(uuid),
  public.answer_own_shared_knowledge_request_v1(uuid, uuid, text, uuid[]),
  public.allow_own_shared_knowledge_v1(uuid, uuid, uuid, uuid[]),
  shared_knowledge_private.list_own_shared_knowledge_v1(uuid),
  shared_knowledge_private.answer_own_shared_knowledge_request_v1(uuid, uuid, text, uuid[]),
  shared_knowledge_private.allow_own_shared_knowledge_v1(uuid, uuid, uuid, uuid[])
  FROM PUBLIC, anon, authenticated;

-- =====================================================================================================================
-- E. DEPLOY-TIME SELF-ASSERTIONS.
-- =====================================================================================================================
DO $$
DECLARE p record; r text;
BEGIN
  -- E1. Pinned postgres-owned definers; invoker wrappers.
  FOR p IN SELECT pr.proname, pr.prosecdef, pr.proconfig, pg_get_userbyid(pr.proowner) AS owner
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'shared_knowledge_private' AND pr.proname LIKE '%\_v2' LOOP
    IF NOT p.prosecdef OR p.owner <> 'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN
      RAISE EXCEPTION 'S8A-04 CP3-C: shared_knowledge_private.% must be a pinned postgres-owned definer', p.proname;
    END IF;
  END LOOP;
  FOR p IN SELECT pr.proname, pr.prosecdef FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public' AND pr.proname IN ('list_own_shared_knowledge_v2', 'answer_own_shared_knowledge_request_v2',
                  'allow_own_shared_knowledge_v2') LOOP
    IF p.prosecdef THEN RAISE EXCEPTION 'S8A-04 CP3-C: public.% must be SECURITY INVOKER', p.proname; END IF;
  END LOOP;
  -- E2. The reference derivation is executable by no application role; the server and anon execute no owner command.
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r)
       AND has_function_privilege(r, 'shared_knowledge_private.audience_ref_v2(uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'S8A-04 CP3-C: % must not execute the internal audience reference', r;
    END IF;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['anon', 'service_role'] LOOP
    FOR p IN SELECT pr.oid::regprocedure AS sig FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
              WHERE n.nspname IN ('shared_knowledge_private', 'public')
                AND pr.proname IN ('list_own_shared_knowledge_v2', 'answer_own_shared_knowledge_request_v2', 'allow_own_shared_knowledge_v2') LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r, p.sig, 'EXECUTE') THEN
        RAISE EXCEPTION 'S8A-04 CP3-C: % must not execute the owner''s %', r, p.sig;
      END IF;
    END LOOP;
  END LOOP;
  -- E2b. No application role executes the retired v1 read or the two v1 commands that carry user ids.
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    FOR p IN SELECT pr.oid::regprocedure AS sig FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
              WHERE n.nspname IN ('shared_knowledge_private', 'public')
                AND pr.proname IN ('list_own_shared_knowledge_v1', 'answer_own_shared_knowledge_request_v1', 'allow_own_shared_knowledge_v1') LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r, p.sig, 'EXECUTE') THEN
        RAISE EXCEPTION 'S8A-04 CP3-C: % must not execute the retired %', r, p.sig;
      END IF;
    END LOOP;
  END LOOP;
  -- E3. No grant is written here: the v2 commands reach the consent writer only through the 0176 owner commands.
  FOR p IN SELECT pr.proname, pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'shared_knowledge_private'
              AND pr.proname IN ('audience_ref_v2', 'list_own_shared_knowledge_v2', 'answer_own_shared_knowledge_request_v2',
                                 'allow_own_shared_knowledge_v2')
              AND (pr.prosrc ~ 'write_grant_v1\(' OR pr.prosrc ~* 'INSERT\s+INTO' OR pr.prosrc ~* 'UPDATE\s+shared_knowledge_private') LOOP
    RAISE EXCEPTION 'S8A-04 CP3-C: % must write nothing itself', p.proname;
  END LOOP;
END$$;

COMMIT;
