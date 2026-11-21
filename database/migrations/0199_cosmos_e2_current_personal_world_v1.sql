-- 0199 — COSMOS E-2 corrections, Slice C (Product Owner decision D-5, Option U, 2026-11-20):
--        the user-level CURRENT Personal World, beside the Session-bound historical projection.
--
-- What the Product Owner decided
--   D-5 (U): a reopened conversation keeps its own historical view (the frozen T-03C availability law, V1 / V2 of
--        0072 / 0198, is NOT changed — no `world_version <= now` amendment); the ONE world the person has NOW is
--        served by a SEPARATE user-level projection, read beside the Session one. History, the timeline and Replay
--        stay Session-scoped. No intelligence engine is duplicated: this read derives nothing — it lists the
--        canonical Threads the caller owns, each with its ONE canonical Home (0068), its served name (the 0198 law:
--        the person's alias, else the grounding wording, else none) and where it was established.
--
-- Temporal honesty (reported, not changed): the Session-bound projection answers "what was known in THIS conversation
-- at TC"; this read answers "which Threads exist for this person NOW". It carries no TC, no Live Head, no lifecycle
-- state and no Reading appearance — those are Session-anchored facts under the frozen temporal authority, and
-- projecting them "currently" across conversations would require a cross-Session ordering that no contract defines.
-- `as_of` is the instant of the read: a marker that this is the present, never a Session Position.
--
-- What this migration adds (additive; nothing is dropped, altered or rewritten)
--   1. `public.get_user_current_personal_world_v1()` — SECURITY DEFINER, `auth.uid()`; FORBIDDEN (42501) with no
--      caller; one row: `as_of`, `threads` (the caller's Threads that carry a Home, ordered by id):
--        { id, home {x, y}, name {text, source}, origin {sessionId, sp} }
--      A person with no Thread receives an empty list (a truthful empty world, not an error).
--
-- Known limitation (recorded, D-5): Threads only. Readings, Emerging Focuses, the Live Focus and lifecycle states are
-- Session-scoped and are not projected here; the person opens the Thread's own conversation ("Open where it began")
-- for them.

BEGIN;

CREATE FUNCTION public.get_user_current_personal_world_v1()
RETURNS TABLE (as_of timestamptz, threads jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT CURRENT_TIMESTAMP AS as_of,
         (SELECT coalesce(jsonb_agg(jsonb_build_object(
                   'id', t.id,
                   'home', jsonb_build_object('x', h.placement_x::text, 'y', h.placement_y::text),
                   'name',
                     CASE
                       WHEN al.alias IS NOT NULL THEN jsonb_build_object('text', al.alias, 'source', 'USER_ALIAS')
                       WHEN gw.wording IS NOT NULL THEN jsonb_build_object('text', gw.wording, 'source', 'GROUNDING_WORDING')
                       ELSE jsonb_build_object('text', NULL, 'source', 'NONE')
                     END,
                   'origin', jsonb_build_object('sessionId', t.established_session_id, 'sp', t.established_sp)
                 ) ORDER BY t.id), '[]'::jsonb)
            FROM public.conversation_threads t
            JOIN public.conversation_thread_homes h ON h.thread_id = t.id
            LEFT JOIN LATERAL (
              SELECT a.alias FROM public.conversation_thread_aliases a
               WHERE a.thread_id = t.id AND a.user_id = caller
               ORDER BY a.id DESC LIMIT 1
            ) al ON true
            LEFT JOIN LATERAL (
              SELECT left(btrim(regexp_replace(r.anchor_text, '\s+', ' ', 'g')), 80) AS wording
                FROM public.conversation_emerging_focuses f
                JOIN public.conversation_reference_resolutions r
                  ON r.resolved_handle_id = f.grounding_handle_id AND r.session_id = f.session_id
               WHERE f.id = t.grounding_emerging_focus_id
                 AND r.session_position <= t.established_sp
                 AND btrim(r.anchor_text) <> ''
               ORDER BY r.session_position, r.same_sp_event_sequence, r.reference_index
               LIMIT 1
            ) gw ON true
           WHERE t.user_id = caller
         ) AS threads;
END;
$$;

-- Ownership and the ACL: the caller's own token, through PostgREST, and nothing else (0030 posture).
ALTER FUNCTION public.get_user_current_personal_world_v1() OWNER TO postgres;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.get_user_current_personal_world_v1() FROM PUBLIC, anon;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.get_user_current_personal_world_v1() FROM service_role;
  END IF;
  GRANT EXECUTE ON FUNCTION public.get_user_current_personal_world_v1() TO authenticated;
END
$$;

-- Self-assertions: the migration proves its own posture before it commits.
DO $$
DECLARE
  fn text := 'public.get_user_current_personal_world_v1()';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = fn::regprocedure AND p.prosecdef
       AND p.proowner = (SELECT oid FROM pg_roles WHERE rolname = 'postgres')
       AND EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%')
  ) THEN
    RAISE EXCEPTION '0199: % must be SECURITY DEFINER, owned by postgres, with a pinned search_path', fn;
  END IF;
  IF has_function_privilege('anon', fn, 'EXECUTE') THEN
    RAISE EXCEPTION '0199: anon must not execute %', fn;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AND has_function_privilege('service_role', fn, 'EXECUTE') THEN
    RAISE EXCEPTION '0199: service_role must not execute %', fn;
  END IF;
  IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
    RAISE EXCEPTION '0199: authenticated must execute %', fn;
  END IF;
END
$$;

COMMIT;
