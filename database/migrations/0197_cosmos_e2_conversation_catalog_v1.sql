-- COSMOS E-2 corrections, Slice B — the Personal conversation catalog: several conversations per person, under the
-- Product Owner's decision D-2 of 2026-11-20 (the controlled T-13 / T-12P amendment: the catalog is SERVER-AUTHORITATIVE,
-- "New Chat" is the approved fresh-start action, a new conversation never erases or replaces an existing one). Not
-- hosted: nothing here is applied to a hosted database (the hosted project lacks migrations >= 0152).
--
-- ## What is added
--
--   A. public.conversation_sessions.client_request_id (nullable text, 1..128) with a partial UNIQUE index on
--      (user_id, client_request_id): the persisted client request identity that makes Session creation IDEMPOTENT. The
--      0030 command create_conversation_session_v1 is untouched (its rows keep client_request_id NULL).
--   B. public.conversation_session_titles: the owner-scoped, APPEND-ONLY manual-title ledger. A rename appends one row;
--      the newest row (the highest ledger id) is the title; no row is ever rewritten (BEFORE UPDATE guard) and no client role holds any table
--      privilege on it. A row leaves only with its Session (ON DELETE CASCADE, the 0130 account-deletion path). No
--      column of public.conversation_sessions or public.conversation_turns is changed for it.
--   C. Three authenticated definers, auth.uid()-derived like 0030, EXECUTE to authenticated only:
--        create_conversation_session_v2(p_id, p_client_request_id)   the idempotent creation: the same person and the
--                                                                     same request identity answer the EARLIER Session,
--                                                                     never a second one; otherwise exactly 0030's shape
--        list_conversation_sessions_v1(p_limit)                      the person's own Sessions, newest ACTIVITY first
--                                                                     (the newest turn, else the creation), with the
--                                                                     current manual title, the opening (the first user
--                                                                     message, at most 120 characters, as a safe
--                                                                     non-AI suggested title), the last turn instant and
--                                                                     the turn count; at most 100
--        set_conversation_session_title_v1(p_session_id, p_title)    appends a title (1..80 characters after whitespace
--                                                                     normalisation) to a Session the caller owns;
--                                                                     another person's Session is FORBIDDEN (42501),
--                                                                     never "not found"
--
-- ## What is deliberately NOT here
--
--   * No AI-generated title: the "suggested title" is the person's own first message, excerpted, and nothing else.
--   * No change to turn admission, to last_activity_at, to the Session lifecycle states, to the temporal clock (SP / LH),
--     to Thread identity, to Replay, to Voice or to the 0130 export / deletion bodies (the export does not yet carry the
--     title ledger: recorded as residue in the COSMOS contract §32, not silently absorbed).
--   * No service_role privilege on the ledger and no hosted deployment.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE CLIENT REQUEST IDENTITY (A).
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.conversation_sessions ADD COLUMN client_request_id text;
ALTER TABLE public.conversation_sessions ADD CONSTRAINT conversation_sessions_client_request_id_check
  CHECK (client_request_id IS NULL OR length(client_request_id) BETWEEN 1 AND 128);
CREATE UNIQUE INDEX conversation_sessions_user_client_request_unique
  ON public.conversation_sessions (user_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE TITLE LEDGER (B).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE public.conversation_session_titles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT conversation_session_titles_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE CASCADE,
  CONSTRAINT conversation_session_titles_title_check CHECK (length(title) BETWEEN 1 AND 80)
);
CREATE INDEX conversation_session_titles_session_order_idx
  ON public.conversation_session_titles (session_id, id DESC);

CREATE FUNCTION public.reject_conversation_session_title_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'conversation_session_titles is append-only' USING ERRCODE = '55000';
END$$;
CREATE TRIGGER conversation_session_titles_append_only
  BEFORE UPDATE ON public.conversation_session_titles FOR EACH ROW
  EXECUTE FUNCTION public.reject_conversation_session_title_mutation();

ALTER TABLE public.conversation_session_titles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conversation_session_titles FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.conversation_session_titles FROM %I', r);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE IDEMPOTENT CREATION (C).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.create_conversation_session_v2(p_id uuid, p_client_request_id text)
RETURNS SETOF public.conversation_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); new_row public.conversation_sessions; earlier public.conversation_sessions;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF p_id IS NULL THEN RAISE EXCEPTION 'INVALID_SESSION_ID' USING ERRCODE = '22023'; END IF;
  IF p_client_request_id IS NULL OR length(p_client_request_id) < 1 OR length(p_client_request_id) > 128 THEN
    RAISE EXCEPTION 'INVALID_CLIENT_REQUEST_ID' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users usr WHERE usr.id = u) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.conversation_sessions (id, user_id, status, channel, created_at, updated_at, last_activity_at, closed_at, client_request_id)
  VALUES (p_id, u, 'ACTIVE', 'TEXT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, p_client_request_id)
  ON CONFLICT (user_id, client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING
  RETURNING * INTO new_row;
  IF new_row.id IS NOT NULL THEN
    RETURN NEXT new_row;
    RETURN;
  END IF;
  -- The same person already created a Session for this request: that Session is the answer, never a second one.
  -- A concurrent creation of the same request is waited for by ON CONFLICT and, once committed, is visible to this
  -- statement (READ COMMITTED); under REPEATABLE READ the INSERT itself refuses an invisible conflict. So the earlier
  -- Session can be missing here only when it was deleted in between, and the one path that deletes a Session is the 0130
  -- account deletion, which removes the person in the same transaction: the caller no longer exists, which is FORBIDDEN
  -- exactly like the identity check above. Never 40001: PROD-RETRY-01 (0150) admits no new retryable escape.
  SELECT * INTO earlier FROM public.conversation_sessions s WHERE s.user_id = u AND s.client_request_id = p_client_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  RETURN NEXT earlier;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE CATALOG READ (C).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.list_conversation_sessions_v1(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid, status text, channel text, created_at timestamptz, updated_at timestamptz, last_activity_at timestamptz,
  closed_at timestamptz, client_request_id text, title text, title_at timestamptz, opening text,
  last_turn_at timestamptz, turn_count integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT s.id, s.status, s.channel, s.created_at, s.updated_at, s.last_activity_at, s.closed_at, s.client_request_id,
           t.title, t.created_at, o.opening, a.last_turn_at, a.turn_count
      FROM public.conversation_sessions s
      LEFT JOIN LATERAL (
        SELECT l.title, l.created_at FROM public.conversation_session_titles l
         WHERE l.session_id = s.id AND l.user_id = s.user_id
         ORDER BY l.id DESC LIMIT 1) t ON true
      LEFT JOIN LATERAL (
        SELECT left(btrim(regexp_replace(c.content, '\s+', ' ', 'g')), 120) AS opening FROM public.conversation_turns c
         WHERE c.session_id = s.id AND c.user_id = s.user_id AND c.role = 'USER'
         ORDER BY c.created_at ASC, c.id ASC LIMIT 1) o ON true
      LEFT JOIN LATERAL (
        SELECT max(c.created_at) AS last_turn_at, count(*)::integer AS turn_count FROM public.conversation_turns c
         WHERE c.session_id = s.id AND c.user_id = s.user_id) a ON true
     WHERE s.user_id = u
     ORDER BY coalesce(a.last_turn_at, s.created_at) DESC, s.id DESC
     LIMIT least(greatest(coalesce(p_limit, 50), 1), 100);
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. THE MANUAL TITLE (C).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.set_conversation_session_title_v1(p_session_id uuid, p_title text)
RETURNS TABLE (session_id uuid, title text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); normalized text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF p_session_id IS NULL THEN RAISE EXCEPTION 'INVALID_SESSION_ID' USING ERRCODE = '22023'; END IF;
  normalized := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'));
  IF length(normalized) < 1 OR length(normalized) > 80 THEN RAISE EXCEPTION 'INVALID_TITLE' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_sessions s WHERE s.id = p_session_id AND s.user_id = u) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  RETURN QUERY INSERT INTO public.conversation_session_titles (session_id, user_id, title) VALUES (p_session_id, u, normalized)
    RETURNING conversation_session_titles.session_id, conversation_session_titles.title, conversation_session_titles.created_at;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. OWNERSHIP AND ACL: the three definers to authenticated only; the guard to nobody.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fns text[] := ARRAY[
    'public.create_conversation_session_v2(uuid,text)',
    'public.list_conversation_sessions_v1(integer)',
    'public.set_conversation_session_title_v1(uuid,text)'];
  fn text; r text;
BEGIN
  FOREACH fn IN ARRAY fns || ARRAY['public.reject_conversation_session_title_mutation()'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    FOREACH fn IN ARRAY fns LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn); END LOOP;
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE fn text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'conversation_sessions_user_client_request_unique') THEN
    RAISE EXCEPTION 'COSMOS E-2 Slice B: the client request identity is not unique per person';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'conversation_session_titles_append_only' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'COSMOS E-2 Slice B: the title ledger is not append-only';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'public' AND g.table_name = 'conversation_session_titles'
                AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')) THEN
    RAISE EXCEPTION 'COSMOS E-2 Slice B: a client role holds a privilege on the title ledger';
  END IF;
  FOREACH fn IN ARRAY ARRAY['public.create_conversation_session_v2(uuid,text)', 'public.list_conversation_sessions_v1(integer)',
                            'public.set_conversation_session_title_v1(uuid,text)'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef AND p.proowner = 'postgres'::regrole
                      AND EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%')) THEN
      RAISE EXCEPTION 'COSMOS E-2 Slice B: % is not a postgres-owned, search_path-pinned definer', fn;
    END IF;
    IF has_function_privilege('anon', fn, 'EXECUTE') OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AND has_function_privilege('service_role', fn, 'EXECUTE')) THEN
      RAISE EXCEPTION 'COSMOS E-2 Slice B: % is reachable by anon or service_role', fn;
    END IF;
    IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'COSMOS E-2 Slice B: % is not reachable by the person', fn;
    END IF;
  END LOOP;
END$$;

COMMIT;
