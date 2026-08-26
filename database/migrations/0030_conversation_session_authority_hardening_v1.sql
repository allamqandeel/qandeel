-- Finding 07 — Conversation Session Authority Hardening v1 (QAN-AUD-08).
--
-- Before this migration, `authenticated` held direct INSERT/UPDATE on
-- public.conversation_sessions (migration 0002) with owner-only RLS. That
-- proved tenant ownership but not Session authority: an authenticated client
-- could bypass the product API and manufacture or rewrite server-significant
-- lifecycle fields (status, channel, created_at, updated_at, last_activity_at,
-- closed_at) inside its own tenant, while the canonical product API only ever
-- creates ACTIVE/TEXT sessions with DB-owned timestamps. In the same boundary,
-- create_user_conversation_turn (migration 0025) verified only owned-session
-- existence, so a user text turn could be admitted into an IDLE/CLOSED/EXPIRED
-- or VOICE session.
--
-- This forward-only migration closes both sides of that boundary:
--   * authenticated keeps owner-scoped SELECT and loses direct
--     INSERT/UPDATE/DELETE on conversation_sessions;
--   * the permissive 0002 INSERT/UPDATE RLS policies are dropped so drift
--     cannot silently reactivate them;
--   * service_role keeps SELECT for canonical background reads but holds no
--     direct Session DML (consistent with hardened conversation_turns,
--     memories, and hypotheses);
--   * session creation moves to one narrow authenticated definer command that
--     accepts only the server-generated UUID and derives owner from
--     auth.uid(), forcing ACTIVE/TEXT and database timestamps;
--   * create_user_conversation_turn keeps its exact signature and Finding-02
--     semantics, but new user text turns are admitted only into an owned
--     ACTIVE/TEXT session.
-- No historical session row is rewritten, and no session lifecycle command
-- (close/reopen/expire/set-channel/update) is invented. History migration
-- files are left untouched.

BEGIN;

-- 1. Table authority: no role may mutate conversation_sessions directly.
--    Clients keep owner-scoped read access; the server REST role
--    (service_role) keeps the SELECT its background-intelligence read path
--    relies on but holds no direct write, so possession of the privileged API
--    role is not arbitrary session-mutation authority. The only write path is
--    the narrow definer command below.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.conversation_sessions FROM authenticated;
REVOKE ALL ON TABLE public.conversation_sessions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.conversation_sessions TO authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public.conversation_sessions FROM service_role';
  EXECUTE 'GRANT SELECT ON TABLE public.conversation_sessions TO service_role';
END IF;END$$;

-- 2. Remove the obsolete permissive write policies so a future accidental
--    GRANT cannot silently re-enable direct client writes. The owner-scoped
--    read policy is retained; no DELETE policy is introduced.
DROP POLICY IF EXISTS conversation_sessions_insert_own ON public.conversation_sessions;
DROP POLICY IF EXISTS conversation_sessions_update_own ON public.conversation_sessions;

-- 3. Narrow authenticated session creation. The caller supplies only the
--    server/application-generated session UUID. Owner identity is derived from
--    auth.uid(); status, channel, every timestamp, and closed_at are forced to
--    the canonical creation shape (ACTIVE/TEXT, database clock, NULL). There is
--    no p_user_id, p_status, p_channel, timestamp, or JSON parameter, so no
--    caller can choose owner or lifecycle state. A duplicate id fails
--    atomically through the primary-key unique violation (PostgREST -> 409).
CREATE FUNCTION public.create_conversation_session_v1(p_id uuid)
RETURNS SETOF public.conversation_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := auth.uid(); new_row public.conversation_sessions;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL THEN RAISE EXCEPTION 'INVALID_SESSION_ID' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users usr WHERE usr.id=u) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  INSERT INTO public.conversation_sessions(
    id,user_id,status,channel,created_at,updated_at,last_activity_at,closed_at
  ) VALUES(p_id,u,'ACTIVE','TEXT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL)
  RETURNING * INTO new_row;
  RETURN NEXT new_row;
END;$$;

-- 4. Harden user-turn admission without changing the external signature or any
--    Finding-02 semantics. The only functional change is the session-admission
--    predicate: the target session must exist, belong to auth.uid(), and be
--    ACTIVE/TEXT. Ownership is checked first on the owned row alone, so a
--    cross-user or nonexistent session still fails closed as FORBIDDEN and the
--    lifecycle error can never leak another tenant's session existence. An
--    owned but IDLE/CLOSED/EXPIRED or VOICE session is rejected with one
--    deterministic bounded error and no side effect: the session is not
--    reactivated, its channel is not changed, and last_activity_at is not
--    touched. Content/idempotency validation, the forced USER/RECEIVED shape,
--    and the observable unique-violation idempotency path are unchanged.
CREATE OR REPLACE FUNCTION public.create_user_conversation_turn(
  p_id uuid, p_session_id uuid, p_content text, p_idempotency_key text DEFAULT NULL
) RETURNS SETOF public.conversation_turns
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := auth.uid(); session_row public.conversation_sessions; new_row public.conversation_turns;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO session_row FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=u;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF session_row.status<>'ACTIVE' OR session_row.channel<>'TEXT' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE_TEXT' USING ERRCODE='55000'; END IF;
  IF p_content IS NULL OR length(btrim(p_content))=0 OR length(p_content)>20000 THEN
    RAISE EXCEPTION 'INVALID_CONTENT' USING ERRCODE='22023'; END IF;
  IF p_idempotency_key IS NOT NULL AND (length(p_idempotency_key)<1 OR length(p_idempotency_key)>128) THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE='22023'; END IF;
  INSERT INTO public.conversation_turns(
    id,session_id,user_id,role,status,content,processing_path,routing_reason,source_turn_id,idempotency_key,completed_at
  ) VALUES(p_id,p_session_id,u,'USER','RECEIVED',p_content,NULL,NULL,NULL,p_idempotency_key,NULL)
  RETURNING * INTO new_row;
  RETURN NEXT new_row;
END;$$;

-- 5. Ownership, search_path, and least-privilege ACLs. Session creation is an
--    authenticated-only command: EXECUTE is revoked from PUBLIC/anon (and from
--    service_role, which has no canonical runtime path that creates foreground
--    sessions) and granted only to authenticated. The hardened turn command
--    keeps its existing authenticated-only effective ACL; CREATE OR REPLACE
--    preserves it, and ownership is re-asserted explicitly.
ALTER FUNCTION public.create_conversation_session_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.create_user_conversation_turn(uuid,uuid,text,text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_conversation_session_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_conversation_session_v1(uuid) TO authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.create_conversation_session_v1(uuid) FROM service_role';
END IF;END$$;

COMMIT;
