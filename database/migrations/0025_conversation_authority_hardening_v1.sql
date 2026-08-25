-- Finding 02 — Conversation Authority Forgery Hardening v1.
--
-- Before this migration, `authenticated` held direct INSERT/UPDATE on
-- public.conversation_turns (migration 0002) and could EXECUTE the
-- finalize_conversation_turn RPC with caller-controlled ASSISTANT content
-- (migrations 0003/0019/0022). RLS proved tenant ownership but not
-- conversational authority: a user could forge or mutate server-authoritative
-- USER/ASSISTANT/SYSTEM history inside their own tenant, which ContextBuilder
-- then treated as authoritative model history.
--
-- This forward-only migration makes conversational authority server-only:
--   * authenticated keeps SELECT and loses direct INSERT/UPDATE/DELETE;
--   * the permissive INSERT/UPDATE RLS policies are dropped so drift cannot
--     silently reactivate them;
--   * user turn creation moves to a narrow definer RPC that derives identity
--     from auth.uid() and forces the canonical server shape;
--   * claim/finalize/fail become service-role-only definer commands that still
--     validate ownership, role, and state explicitly (never "service_role can
--     do anything");
--   * cancellation remains an authenticated, narrowly-scoped user command.
-- History migration files are left untouched.

BEGIN;

-- 1. Table authority: no role may mutate conversation_turns directly. Clients
--    keep read access; the server REST role (service_role) keeps the SELECT its
--    background-intelligence read path relies on but loses direct write, so
--    possession of the privileged API role is not arbitrary table-mutation
--    authority. All writes flow through the definer commands below.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.conversation_turns FROM authenticated;
REVOKE ALL ON TABLE public.conversation_turns FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.conversation_turns TO authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public.conversation_turns FROM service_role';
  EXECUTE 'GRANT SELECT ON TABLE public.conversation_turns TO service_role';
END IF;END$$;

-- 2. Remove the obsolete permissive write policies so a future GRANT cannot
--    silently re-enable direct client writes. The read policy is retained.
DROP POLICY IF EXISTS conversation_turns_insert_own ON public.conversation_turns;
DROP POLICY IF EXISTS conversation_turns_update_own ON public.conversation_turns;

-- 3. Narrow authenticated user-turn creation. The caller supplies only the row
--    id, the target session, content, and an optional idempotency key. Identity
--    is derived from auth.uid(); role, status, and every server-owned column are
--    forced. Cross-user session creation fails closed. The unique
--    (session_id,user_id,idempotency_key) violation is allowed to surface so the
--    existing 409 idempotency path is preserved.
CREATE FUNCTION public.create_user_conversation_turn(
  p_id uuid, p_session_id uuid, p_content text, p_idempotency_key text DEFAULT NULL
) RETURNS SETOF public.conversation_turns
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := auth.uid(); new_row public.conversation_turns;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=u) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
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

-- 4. Server-only claim: RECEIVED -> GENERATING plus processing path/reason.
--    service_role has no auth.uid(); ownership and state are validated
--    explicitly against the owned session and the owned RECEIVED USER turn.
CREATE FUNCTION public.claim_conversation_turn(
  p_session_id uuid, p_user_id uuid, p_source_turn_id uuid, p_processing_path text, p_routing_reason text
) RETURNS SETOF public.conversation_turns
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'INVALID_USER' USING ERRCODE='22023'; END IF;
  IF NOT((p_processing_path='FAST' AND p_routing_reason='FAST_DEFAULT')
      OR (p_processing_path='DEEP' AND p_routing_reason='INPUT_LENGTH_REQUIRES_DEEP_CONTEXT')) THEN
    RAISE EXCEPTION 'INVALID_ROUTING' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO source_row FROM public.conversation_turns
    WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER' AND status='RECEIVED'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.conversation_turns
    SET status='GENERATING',processing_path=p_processing_path,routing_reason=p_routing_reason,updated_at=CURRENT_TIMESTAMP
    WHERE id=p_source_turn_id RETURNING * INTO source_row;
  RETURN NEXT source_row;
END;$$;

-- 5. Server-only finalization. Same signature and atomic behaviour as migration
--    0022, but the auth.uid() tenant guard is replaced by explicit session
--    ownership validation because the caller is now the server role, and
--    EXECUTE is removed from authenticated so the direct forge path is closed.
DROP FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid);
CREATE FUNCTION public.finalize_conversation_turn(
  p_session_id uuid,p_user_id uuid,p_source_turn_id uuid,p_assistant_turn_id uuid,p_content text,
  p_safety_disposition text,p_event_id uuid,p_correlation_id uuid DEFAULT NULL,p_orchestration_id uuid DEFAULT NULL
) RETURNS TABLE(user_turn jsonb,assistant_turn jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns;assistant_row public.conversation_turns;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'INVALID_USER' USING ERRCODE='22023';END IF;
 IF p_safety_disposition NOT IN ('ALLOW','GUIDED','BLOCK') THEN RAISE EXCEPTION 'INVALID_SAFETY_DISPOSITION' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=p_user_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO source_row FROM public.conversation_turns WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER' AND status='GENERATING' FOR UPDATE;
 IF NOT FOUND THEN RETURN;END IF;
 INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason,source_turn_id,completed_at)
 VALUES(p_assistant_turn_id,p_session_id,p_user_id,'ASSISTANT','COMPLETED',p_content,source_row.processing_path,source_row.routing_reason,p_source_turn_id,CURRENT_TIMESTAMP) RETURNING * INTO assistant_row;
 UPDATE public.conversation_turns SET status='COMPLETED',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=p_source_turn_id RETURNING * INTO source_row;
 INSERT INTO public.runtime_event_outbox(event_id,event_type,event_version,subject_user_id,subject_session_id,subject_turn_id,correlation_id,schema_ref,payload)
 VALUES(p_event_id,'ConversationTurnCompleted','2.0',p_user_id,p_session_id,p_source_turn_id,p_correlation_id,'qandeel.runtime.conversation-turn-completed.v2',jsonb_build_object('user_id',p_user_id,'session_id',p_session_id,'source_turn_id',p_source_turn_id,'terminal_status','COMPLETED','processing_path',source_row.processing_path,'routing_reason',source_row.routing_reason,'orchestration_id',p_orchestration_id,'safety_disposition',p_safety_disposition));
 RETURN QUERY SELECT to_jsonb(source_row),to_jsonb(assistant_row);
END;$$;

-- 6. Server-only failure lifecycle. Same as migration 0019 with explicit
--    session ownership validation and no authenticated EXECUTE.
DROP FUNCTION public.fail_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid);
CREATE FUNCTION public.fail_conversation_turn(
  p_session_id uuid,p_user_id uuid,p_source_turn_id uuid,p_event_id uuid,p_correlation_id uuid DEFAULT NULL,p_orchestration_id uuid DEFAULT NULL
) RETURNS SETOF public.conversation_turns
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'INVALID_USER' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=p_user_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO source_row FROM public.conversation_turns WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER' AND status='GENERATING' FOR UPDATE;
 IF NOT FOUND THEN RETURN;END IF;
 UPDATE public.conversation_turns SET status='FAILED',updated_at=CURRENT_TIMESTAMP WHERE id=p_source_turn_id RETURNING * INTO source_row;
 INSERT INTO public.runtime_event_outbox(event_id,event_type,subject_user_id,subject_session_id,subject_turn_id,correlation_id,schema_ref,payload)
 VALUES(p_event_id,'ConversationTurnFailed',p_user_id,p_session_id,p_source_turn_id,p_correlation_id,'qandeel.runtime.conversation-turn-failed.v1',jsonb_build_object('user_id',p_user_id,'session_id',p_session_id,'source_turn_id',p_source_turn_id,'terminal_status','FAILED','processing_path',source_row.processing_path,'routing_reason',source_row.routing_reason,'orchestration_id',p_orchestration_id));
 RETURN NEXT source_row;
END;$$;

-- 7. Ownership, search_path, and least-privilege ACLs. finalize/fail/claim are
--    server-only; create_user_conversation_turn and the pre-existing
--    cancel_conversation_turn remain authenticated user commands. Direct table
--    mutation is available to no role.
ALTER FUNCTION public.create_user_conversation_turn(uuid,uuid,text,text) OWNER TO postgres;
ALTER FUNCTION public.claim_conversation_turn(uuid,uuid,uuid,text,text) OWNER TO postgres;
ALTER FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.fail_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_user_conversation_turn(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_conversation_turn(uuid,uuid,text,text) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_conversation_turn(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
  public.claim_conversation_turn(uuid,uuid,uuid,text,text),
  public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid),
  public.fail_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid)
  TO service_role;

COMMIT;
