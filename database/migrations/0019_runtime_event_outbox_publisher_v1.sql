BEGIN;

CREATE TABLE public.runtime_event_outbox (
  event_id uuid PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('ConversationTurnCompleted','ConversationTurnFailed','ConversationTurnCancelled')),
  event_version text NOT NULL DEFAULT '1.0' CHECK (event_version = '1.0'),
  occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  producer text NOT NULL DEFAULT 'conversation-service' CHECK (producer = 'conversation-service'),
  subject_user_id uuid NOT NULL,
  subject_session_id uuid NOT NULL,
  subject_turn_id uuid NOT NULL,
  correlation_id uuid,
  causation_id uuid,
  classification text NOT NULL DEFAULT 'SENSITIVE' CHECK (classification = 'SENSITIVE'),
  schema_ref text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  contains_content boolean NOT NULL DEFAULT false CHECK (contains_content = false),
  retention_class text NOT NULL DEFAULT 'OPERATIONAL_EVENT_V1' CHECK (retention_class = 'OPERATIONAL_EVENT_V1'),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','IN_FLIGHT','RETRY','PUBLISHED','QUARANTINED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claim_token uuid,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  published_at timestamptz,
  transport_message_id text,
  last_error_code text CHECK (last_error_code IS NULL OR last_error_code IN ('TRANSPORT_UNAVAILABLE','TRANSPORT_TIMEOUT','INVALID_EVENT','MAX_ATTEMPTS_EXCEEDED','CLAIM_CONFLICT')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (event_type, subject_turn_id),
  CHECK ((status = 'IN_FLIGHT') = (claim_token IS NOT NULL AND claimed_at IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK ((status = 'PUBLISHED') = (published_at IS NOT NULL AND transport_message_id IS NOT NULL)),
  CHECK (causation_id IS NULL OR causation_id <> event_id)
);
CREATE INDEX runtime_event_outbox_claim_idx ON public.runtime_event_outbox (status,next_attempt_at,lease_expires_at,created_at,event_id);
ALTER TABLE public.runtime_event_outbox OWNER TO postgres;
ALTER TABLE public.runtime_event_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.runtime_event_outbox FROM PUBLIC, anon, authenticated;

DROP FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text);
CREATE FUNCTION public.finalize_conversation_turn(
 p_session_id uuid,p_user_id uuid,p_source_turn_id uuid,p_assistant_turn_id uuid,p_content text,
 p_event_id uuid,p_correlation_id uuid DEFAULT NULL,p_orchestration_id uuid DEFAULT NULL
) RETURNS TABLE(user_turn jsonb,assistant_turn jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns;assistant_row public.conversation_turns;
BEGIN
 IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO source_row FROM public.conversation_turns WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER' AND status='GENERATING' FOR UPDATE;
 IF NOT FOUND THEN RETURN;END IF;
 INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason,source_turn_id,completed_at)
 VALUES(p_assistant_turn_id,p_session_id,p_user_id,'ASSISTANT','COMPLETED',p_content,source_row.processing_path,source_row.routing_reason,p_source_turn_id,CURRENT_TIMESTAMP) RETURNING * INTO assistant_row;
 UPDATE public.conversation_turns SET status='COMPLETED',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=p_source_turn_id RETURNING * INTO source_row;
 INSERT INTO public.runtime_event_outbox(event_id,event_type,subject_user_id,subject_session_id,subject_turn_id,correlation_id,schema_ref,payload)
 VALUES(p_event_id,'ConversationTurnCompleted',p_user_id,p_session_id,p_source_turn_id,p_correlation_id,'qandeel.runtime.conversation-turn-completed.v1',jsonb_build_object('user_id',p_user_id,'session_id',p_session_id,'source_turn_id',p_source_turn_id,'terminal_status','COMPLETED','processing_path',source_row.processing_path,'routing_reason',source_row.routing_reason,'orchestration_id',p_orchestration_id));
 RETURN QUERY SELECT to_jsonb(source_row),to_jsonb(assistant_row);
END;$$;

CREATE FUNCTION public.fail_conversation_turn(p_session_id uuid,p_user_id uuid,p_source_turn_id uuid,p_event_id uuid,p_correlation_id uuid DEFAULT NULL,p_orchestration_id uuid DEFAULT NULL)
RETURNS SETOF public.conversation_turns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns;
BEGIN
 IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO source_row FROM public.conversation_turns WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER' AND status='GENERATING' FOR UPDATE;
 IF NOT FOUND THEN RETURN;END IF;
 UPDATE public.conversation_turns SET status='FAILED',updated_at=CURRENT_TIMESTAMP WHERE id=p_source_turn_id RETURNING * INTO source_row;
 INSERT INTO public.runtime_event_outbox(event_id,event_type,subject_user_id,subject_session_id,subject_turn_id,correlation_id,schema_ref,payload)
 VALUES(p_event_id,'ConversationTurnFailed',p_user_id,p_session_id,p_source_turn_id,p_correlation_id,'qandeel.runtime.conversation-turn-failed.v1',jsonb_build_object('user_id',p_user_id,'session_id',p_session_id,'source_turn_id',p_source_turn_id,'terminal_status','FAILED','processing_path',source_row.processing_path,'routing_reason',source_row.routing_reason,'orchestration_id',p_orchestration_id));
 RETURN NEXT source_row;
END;$$;

CREATE FUNCTION public.cancel_conversation_turn(p_session_id uuid,p_user_id uuid,p_source_turn_id uuid,p_event_id uuid,p_correlation_id uuid DEFAULT NULL,p_orchestration_id uuid DEFAULT NULL)
RETURNS SETOF public.conversation_turns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns;
BEGIN
 IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO source_row FROM public.conversation_turns WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER' AND status IN ('RECEIVED','VALIDATED','CONTEXT_BUILDING','PROCESSING','GENERATING','STREAMING') FOR UPDATE;
 IF NOT FOUND THEN RETURN;END IF;
 UPDATE public.conversation_turns SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE id=p_source_turn_id RETURNING * INTO source_row;
 INSERT INTO public.runtime_event_outbox(event_id,event_type,subject_user_id,subject_session_id,subject_turn_id,correlation_id,schema_ref,payload)
 VALUES(p_event_id,'ConversationTurnCancelled',p_user_id,p_session_id,p_source_turn_id,p_correlation_id,'qandeel.runtime.conversation-turn-cancelled.v1',jsonb_build_object('user_id',p_user_id,'session_id',p_session_id,'source_turn_id',p_source_turn_id,'terminal_status','CANCELLED','processing_path',source_row.processing_path,'routing_reason',source_row.routing_reason,'orchestration_id',p_orchestration_id));
 RETURN NEXT source_row;
END;$$;

CREATE FUNCTION public.claim_runtime_events(p_batch_size integer,p_lease_seconds integer,p_claim_token uuid)
RETURNS SETOF public.runtime_event_outbox LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 WITH eligible AS (SELECT event_id FROM public.runtime_event_outbox WHERE (status IN ('PENDING','RETRY') AND next_attempt_at<=CURRENT_TIMESTAMP) OR (status='IN_FLIGHT' AND lease_expires_at<=CURRENT_TIMESTAMP) ORDER BY created_at,event_id FOR UPDATE SKIP LOCKED LIMIT LEAST(GREATEST(p_batch_size,1),100))
 UPDATE public.runtime_event_outbox o SET status='IN_FLIGHT',attempt_count=attempt_count+1,claim_token=p_claim_token,claimed_at=CURRENT_TIMESTAMP,lease_expires_at=CURRENT_TIMESTAMP+make_interval(secs=>LEAST(GREATEST(p_lease_seconds,1),300)),updated_at=CURRENT_TIMESTAMP FROM eligible e WHERE o.event_id=e.event_id RETURNING o.*;
$$;
CREATE FUNCTION public.ack_runtime_event(p_event_id uuid,p_claim_token uuid,p_transport_message_id text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN UPDATE public.runtime_event_outbox SET status='PUBLISHED',published_at=CURRENT_TIMESTAMP,transport_message_id=left(p_transport_message_id,256),claim_token=NULL,claimed_at=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE event_id=p_event_id AND status='IN_FLIGHT' AND claim_token=p_claim_token;RETURN FOUND;END;$$;
CREATE FUNCTION public.retry_runtime_event(p_event_id uuid,p_claim_token uuid,p_error_code text,p_next_attempt_at timestamptz) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN IF p_error_code NOT IN ('TRANSPORT_UNAVAILABLE','TRANSPORT_TIMEOUT','CLAIM_CONFLICT') THEN RAISE EXCEPTION 'INVALID_ERROR_CODE';END IF;UPDATE public.runtime_event_outbox SET status='RETRY',next_attempt_at=p_next_attempt_at,claim_token=NULL,claimed_at=NULL,lease_expires_at=NULL,last_error_code=p_error_code,updated_at=CURRENT_TIMESTAMP WHERE event_id=p_event_id AND status='IN_FLIGHT' AND claim_token=p_claim_token;RETURN FOUND;END;$$;
CREATE FUNCTION public.quarantine_runtime_event(p_event_id uuid,p_claim_token uuid,p_error_code text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN IF p_error_code NOT IN ('INVALID_EVENT','MAX_ATTEMPTS_EXCEEDED') THEN RAISE EXCEPTION 'INVALID_ERROR_CODE';END IF;UPDATE public.runtime_event_outbox SET status='QUARANTINED',claim_token=NULL,claimed_at=NULL,lease_expires_at=NULL,last_error_code=p_error_code,updated_at=CURRENT_TIMESTAMP WHERE event_id=p_event_id AND status='IN_FLIGHT' AND claim_token=p_claim_token;RETURN FOUND;END;$$;

ALTER FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.fail_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.cancel_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.claim_runtime_events(integer,integer,uuid) OWNER TO postgres;
ALTER FUNCTION public.ack_runtime_event(uuid,uuid,text) OWNER TO postgres;
ALTER FUNCTION public.retry_runtime_event(uuid,uuid,text,timestamptz) OWNER TO postgres;
ALTER FUNCTION public.quarantine_runtime_event(uuid,uuid,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cancel_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,uuid,uuid,uuid),public.fail_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid),public.cancel_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.claim_runtime_events(integer,integer,uuid),public.ack_runtime_event(uuid,uuid,text),public.retry_runtime_event(uuid,uuid,text,timestamptz),public.quarantine_runtime_event(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role')THEN EXECUTE 'REVOKE ALL ON FUNCTION public.claim_runtime_events(integer,integer,uuid), public.ack_runtime_event(uuid,uuid,text), public.retry_runtime_event(uuid,uuid,text,timestamptz), public.quarantine_runtime_event(uuid,uuid,text) FROM service_role';EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_runtime_events(integer,integer,uuid), public.ack_runtime_event(uuid,uuid,text), public.retry_runtime_event(uuid,uuid,text,timestamptz), public.quarantine_runtime_event(uuid,uuid,text) TO service_role';END IF;END$$;
COMMIT;
