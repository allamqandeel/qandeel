-- 0198 — COSMOS E-2 corrections, Slice A (Product Owner decisions D-3 / D-4, 2026-11-20):
--        Personal topic identity — the grounding wording, the person's own alias, the Thread's origin.
--
-- What the Product Owner decided
--   D-3: a Personal topic is shown under the person's OWN wording — the user-authored anchor text with which
--        the subject was resolved when the Thread was established ("GROUNDING_WORDING") — and the person may
--        name it themselves ("USER_ALIAS"), which then takes precedence. No AI-crafted topic title (N4 is not
--        authorised), no fabricated thematic group, no count or statistic as a name.
--   D-4: Controlled Personal Projection V2 — ADDITIVE. The frozen V1 read (`get_session_historical_projection_v1`,
--        0072) is untouched and byte-identical; V2 wraps it and adds, per Thread, `name {text, source}` and
--        `origin {sessionId, sp}`. The alias lives in a SEPARATE append-only, owner-scoped ledger: the canonical
--        Thread row stays immutable (0068: no mutable label column, ever).
--
-- What this migration adds (all additive; nothing is dropped, altered or rewritten)
--   1. `public.conversation_thread_aliases` — append-only alias ledger (one row per rename; the newest row is the
--      alias). Identity id orders the ledger inside one transaction too. RLS enabled, no table grants: it is reached
--      only through the two functions below. Deleting the Thread deletes its aliases (ON DELETE CASCADE).
--   2. `public.set_conversation_thread_alias_v1(p_thread_id, p_alias)` — appends the caller's alias for a Thread
--      the caller owns (42501 FORBIDDEN otherwise: no existence oracle); whitespace-normalised, 1..60 characters
--      (22023 INVALID_ALIAS otherwise).
--   3. `public.get_session_historical_projection_v2(p_session_id, p_tc)` — the V1 row with its `threads` column
--      enriched per Thread:
--        name.source = 'USER_ALIAS'        name.text = the newest alias of the caller for that Thread
--                   | 'GROUNDING_WORDING'  name.text = the first RESOLVED anchor text of the Thread's grounding
--                                           focus handle in the establishing Session, at or before the establishing
--                                           Session Position (the person's own words, normalised, at most 80 chars)
--                   | 'NONE'               name.text = null (nothing truthful to show; the client says so, honestly)
--        origin = { sessionId: established_session_id, sp: established_sp } — the caller's own Session, always.
--      Temporal honesty: the grounding wording is bounded by the establishing Session Position (<= TC when the
--      Thread was established in this Session); the alias is the person's CURRENT name for the topic and is not a
--      historical fact at TC — it is shown as such. Everything else in the row is V1's, unchanged.
--
-- Known limitation (recorded, D-3): the grounding wording is what the person said when the subject was resolved,
-- not a crafted title. It may be short or a fragment; the alias exists so the person can name the topic better.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The alias ledger
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE public.conversation_thread_aliases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.conversation_threads (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT conversation_thread_aliases_alias_check CHECK (length(alias) BETWEEN 1 AND 60)
);

CREATE INDEX conversation_thread_aliases_thread_newest ON public.conversation_thread_aliases (thread_id, id DESC);

CREATE FUNCTION public.reject_conversation_thread_alias_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'conversation_thread_aliases is append-only' USING ERRCODE='55000';
END;
$$;

CREATE TRIGGER conversation_thread_aliases_append_only
  BEFORE UPDATE ON public.conversation_thread_aliases
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_thread_alias_mutation();

ALTER TABLE public.conversation_thread_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conversation_thread_aliases FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. The alias: the person's own name for a topic they own
-- ---------------------------------------------------------------------------------------------------------------

CREATE FUNCTION public.set_conversation_thread_alias_v1(p_thread_id uuid, p_alias text)
RETURNS TABLE (thread_id uuid, alias text, created_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  caller uuid := auth.uid();
  normalised text;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF p_thread_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_THREAD_ID' USING ERRCODE='22023';
  END IF;
  normalised := btrim(regexp_replace(coalesce(p_alias, ''), '\s+', ' ', 'g'));
  IF length(normalised) < 1 OR length(normalised) > 60 THEN
    RAISE EXCEPTION 'INVALID_ALIAS' USING ERRCODE='22023',
      DETAIL='An alias is 1..60 characters after whitespace normalisation.';
  END IF;
  -- Ownership, with no existence oracle: an unknown Thread and another person's Thread answer alike.
  IF NOT EXISTS (SELECT 1 FROM public.conversation_threads t WHERE t.id = p_thread_id AND t.user_id = caller) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    INSERT INTO public.conversation_thread_aliases (thread_id, user_id, alias)
    VALUES (p_thread_id, caller, normalised)
    RETURNING conversation_thread_aliases.thread_id, conversation_thread_aliases.alias, conversation_thread_aliases.created_at;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Controlled Personal Projection V2 — V1, with each Thread's name and origin added
-- ---------------------------------------------------------------------------------------------------------------

CREATE FUNCTION public.get_session_historical_projection_v2(p_session_id uuid, p_tc integer)
RETURNS TABLE(
  session_id uuid,
  live_head integer,
  tc integer,
  sealed boolean,
  revision jsonb,
  moments jsonb,
  emerging_focuses jsonb,
  live_focus jsonb,
  threads jsonb,
  thread_reading_appearances jsonb,
  readings jsonb,
  reading_relations jsonb,
  evidence_participations jsonb,
  materials jsonb,
  gaps jsonb,
  questions jsonb,
  question_appearances jsonb,
  confidences jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  -- V1 decides visibility, coverage, sealing and every rung; it refuses exactly as before. Nothing is re-derived.
  RETURN QUERY
  SELECT v.session_id, v.live_head, v.tc, v.sealed, v.revision, v.moments, v.emerging_focuses, v.live_focus,
         (SELECT coalesce(jsonb_agg(
                   e.value || jsonb_build_object(
                     'name',
                       CASE
                         WHEN al.alias IS NOT NULL THEN jsonb_build_object('text', al.alias, 'source', 'USER_ALIAS')
                         WHEN gw.wording IS NOT NULL THEN jsonb_build_object('text', gw.wording, 'source', 'GROUNDING_WORDING')
                         ELSE jsonb_build_object('text', NULL, 'source', 'NONE')
                       END,
                     'origin', jsonb_build_object('sessionId', t.established_session_id, 'sp', t.established_sp)
                   ) ORDER BY e.ordinality), '[]'::jsonb)
            FROM jsonb_array_elements(v.threads) WITH ORDINALITY AS e(value, ordinality)
            JOIN public.conversation_threads t ON t.id = (e.value ->> 'id')::uuid AND t.user_id = caller
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
         ) AS threads,
         v.thread_reading_appearances, v.readings, v.reading_relations, v.evidence_participations, v.materials,
         v.gaps, v.questions, v.question_appearances, v.confidences
    FROM public.get_session_historical_projection_v1(p_session_id, p_tc) v;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Ownership and the ACL: the caller's own token, through PostgREST, and nothing else (0030 posture)
-- ---------------------------------------------------------------------------------------------------------------

ALTER FUNCTION public.reject_conversation_thread_alias_mutation() OWNER TO postgres;
ALTER FUNCTION public.set_conversation_thread_alias_v1(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.get_session_historical_projection_v2(uuid, integer) OWNER TO postgres;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.set_conversation_thread_alias_v1(uuid, text)',
    'public.get_session_historical_projection_v2(uuid, integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
  REVOKE ALL ON FUNCTION public.reject_conversation_thread_alias_mutation() FROM PUBLIC, anon, authenticated;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.reject_conversation_thread_alias_mutation() FROM service_role;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Self-assertions: the migration proves its own posture before it commits
-- ---------------------------------------------------------------------------------------------------------------

DO $$
DECLARE
  fn text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'conversation_thread_aliases_thread_newest') THEN
    RAISE EXCEPTION '0198: the alias ledger index is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'conversation_thread_aliases_append_only' AND NOT tgisinternal) THEN
    RAISE EXCEPTION '0198: the alias ledger is not append-only';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.conversation_thread_aliases'::regclass) THEN
    RAISE EXCEPTION '0198: RLS is not enabled on the alias ledger';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
              WHERE table_schema = 'public' AND table_name = 'conversation_thread_aliases'
                AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')) THEN
    RAISE EXCEPTION '0198: the alias ledger must carry no table grants';
  END IF;
  FOREACH fn IN ARRAY ARRAY[
    'public.set_conversation_thread_alias_v1(uuid, text)',
    'public.get_session_historical_projection_v2(uuid, integer)'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
       WHERE p.oid = fn::regprocedure AND p.prosecdef
         AND p.proowner = (SELECT oid FROM pg_roles WHERE rolname = 'postgres')
         AND EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%')
    ) THEN
      RAISE EXCEPTION '0198: % must be SECURITY DEFINER, owned by postgres, with a pinned search_path', fn;
    END IF;
    IF has_function_privilege('anon', fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0198: anon must not execute %', fn;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AND has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0198: service_role must not execute %', fn;
    END IF;
    IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0198: authenticated must execute %', fn;
    END IF;
  END LOOP;
  -- V2 returns exactly V1's columns, in V1's order and types: additive inside `threads`, identical everywhere else.
  IF (SELECT pg_get_function_result('public.get_session_historical_projection_v2(uuid, integer)'::regprocedure))
     IS DISTINCT FROM
     (SELECT pg_get_function_result('public.get_session_historical_projection_v1(uuid, integer)'::regprocedure)) THEN
    RAISE EXCEPTION '0198: V2 must return V1''s row shape';
  END IF;
END
$$;

COMMIT;
