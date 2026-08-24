BEGIN;

ALTER TABLE public.runtime_event_outbox DROP CONSTRAINT runtime_event_outbox_event_version_check;
ALTER TABLE public.runtime_event_outbox ADD CONSTRAINT runtime_event_outbox_event_version_check CHECK (
  (event_type='ConversationTurnCompleted' AND event_version IN ('1.0','2.0')) OR
  (event_type IN ('ConversationTurnFailed','ConversationTurnCancelled') AND event_version='1.0')
);

DROP FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,uuid,uuid,uuid);
CREATE FUNCTION public.finalize_conversation_turn(
 p_session_id uuid,p_user_id uuid,p_source_turn_id uuid,p_assistant_turn_id uuid,p_content text,
 p_safety_disposition text,p_event_id uuid,p_correlation_id uuid DEFAULT NULL,p_orchestration_id uuid DEFAULT NULL
) RETURNS TABLE(user_turn jsonb,assistant_turn jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns;assistant_row public.conversation_turns;
BEGIN
 IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_safety_disposition NOT IN ('ALLOW','GUIDED','BLOCK') THEN RAISE EXCEPTION 'INVALID_SAFETY_DISPOSITION' USING ERRCODE='22023';END IF;
 SELECT * INTO source_row FROM public.conversation_turns WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER' AND status='GENERATING' FOR UPDATE;
 IF NOT FOUND THEN RETURN;END IF;
 INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason,source_turn_id,completed_at)
 VALUES(p_assistant_turn_id,p_session_id,p_user_id,'ASSISTANT','COMPLETED',p_content,source_row.processing_path,source_row.routing_reason,p_source_turn_id,CURRENT_TIMESTAMP) RETURNING * INTO assistant_row;
 UPDATE public.conversation_turns SET status='COMPLETED',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=p_source_turn_id RETURNING * INTO source_row;
 INSERT INTO public.runtime_event_outbox(event_id,event_type,event_version,subject_user_id,subject_session_id,subject_turn_id,correlation_id,schema_ref,payload)
 VALUES(p_event_id,'ConversationTurnCompleted','2.0',p_user_id,p_session_id,p_source_turn_id,p_correlation_id,'qandeel.runtime.conversation-turn-completed.v2',jsonb_build_object('user_id',p_user_id,'session_id',p_session_id,'source_turn_id',p_source_turn_id,'terminal_status','COMPLETED','processing_path',source_row.processing_path,'routing_reason',source_row.routing_reason,'orchestration_id',p_orchestration_id,'safety_disposition',p_safety_disposition));
 RETURN QUERY SELECT to_jsonb(source_row),to_jsonb(assistant_row);
END;$$;
ALTER FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid) TO authenticated;

CREATE TABLE public.post_response_intelligence_executions(
 id uuid PRIMARY KEY,event_id uuid NOT NULL UNIQUE,user_id uuid NOT NULL,session_id uuid NOT NULL,source_turn_id uuid NOT NULL UNIQUE,
 event_version text NOT NULL CHECK(event_version IN('1.0','2.0')),processing_path text CHECK(processing_path IN('FAST','DEEP')),
 safety_disposition text CHECK(safety_disposition IN('ALLOW','GUIDED','BLOCK')),
 state text NOT NULL CHECK(state IN('RUNNING','COMPLETED','SKIPPED','QUARANTINED','FAILED')),
 attempt_count integer NOT NULL DEFAULT 1 CHECK(attempt_count BETWEEN 1 AND 5),current_stage text NOT NULL,
 outcome_code text CHECK(outcome_code IS NULL OR outcome_code IN('COMPLETED','SAFETY_SKIPPED','NOT_ELIGIBLE','INTENT_NOT_AUTHORIZED','ASSEMBLY_NOT_READY','AUTHORITY_REJECTED','CANONICAL_MISMATCH','LEGACY_UNSUPPORTED','POISON_EVENT','MAX_ATTEMPTS','INDETERMINATE_EFFECT','EXECUTION_FAILED')),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,terminal_at timestamptz,
 CHECK((state='RUNNING')=(terminal_at IS NULL)),CHECK((event_version='2.0')=(safety_disposition IS NOT NULL))
);
CREATE TABLE public.post_response_intelligence_effects(
 execution_id uuid NOT NULL REFERENCES public.post_response_intelligence_executions(id) ON DELETE RESTRICT,
 effect_key text NOT NULL CHECK(effect_key IN('MEMORY_WRITE','INTENT_PROVIDER','CANDIDATE_PROVIDER','HYPOTHESIS_PERSISTENCE','CONFIDENCE_BATCH')),
 state text NOT NULL CHECK(state IN('CLAIMED','COMPLETED')),claimed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,completed_at timestamptz,
 PRIMARY KEY(execution_id,effect_key),CHECK((state='COMPLETED')=(completed_at IS NOT NULL))
);
ALTER TABLE public.post_response_intelligence_executions OWNER TO postgres;ALTER TABLE public.post_response_intelligence_effects OWNER TO postgres;
ALTER TABLE public.post_response_intelligence_executions ENABLE ROW LEVEL SECURITY;ALTER TABLE public.post_response_intelligence_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.post_response_intelligence_executions,public.post_response_intelligence_effects FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.acquire_post_response_intelligence_execution_v1(p_id uuid,p_event_id uuid,p_user_id uuid,p_session_id uuid,p_source_turn_id uuid,p_event_version text,p_processing_path text,p_safety_disposition text)
RETURNS SETOF public.post_response_intelligence_executions LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current public.post_response_intelligence_executions;
BEGIN
 INSERT INTO public.post_response_intelligence_executions(id,event_id,user_id,session_id,source_turn_id,event_version,processing_path,safety_disposition,state,current_stage)
 VALUES(p_id,p_event_id,p_user_id,p_session_id,p_source_turn_id,p_event_version,p_processing_path,p_safety_disposition,'RUNNING','ACQUIRED')
 ON CONFLICT(source_turn_id)DO NOTHING;
 SELECT * INTO current FROM public.post_response_intelligence_executions WHERE source_turn_id=p_source_turn_id FOR UPDATE;
 IF current.event_id<>p_event_id OR current.user_id<>p_user_id OR current.session_id<>p_session_id THEN RAISE EXCEPTION 'EXECUTION_IDENTITY_MISMATCH' USING ERRCODE='22023';END IF;
 IF current.state='RUNNING' AND current.id<>p_id THEN UPDATE public.post_response_intelligence_executions SET attempt_count=LEAST(attempt_count+1,5),updated_at=CURRENT_TIMESTAMP WHERE id=current.id RETURNING * INTO current;END IF;
 RETURN NEXT current;
END;$$;
CREATE FUNCTION public.claim_post_response_intelligence_effect_v1(p_execution_id uuid,p_effect_key text)RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state)SELECT p_execution_id,p_effect_key,'CLAIMED' FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' ON CONFLICT DO NOTHING;RETURN FOUND;END;$$;
CREATE FUNCTION public.complete_post_response_intelligence_effect_v1(p_execution_id uuid,p_effect_key text)RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP WHERE execution_id=p_execution_id AND effect_key=p_effect_key AND state='CLAIMED';RETURN FOUND;END;$$;
CREATE FUNCTION public.finish_post_response_intelligence_execution_v1(p_execution_id uuid,p_state text,p_outcome_code text,p_stage text)RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN IF p_state NOT IN('COMPLETED','SKIPPED','QUARANTINED','FAILED')THEN RAISE EXCEPTION 'INVALID_TERMINAL_STATE' USING ERRCODE='22023';END IF;UPDATE public.post_response_intelligence_executions SET state=p_state,outcome_code=p_outcome_code,current_stage=left(p_stage,64),terminal_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=p_execution_id AND state='RUNNING';RETURN FOUND;END;$$;
CREATE FUNCTION public.list_post_response_intelligence_effects_v1(p_execution_id uuid)RETURNS SETOF public.post_response_intelligence_effects LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT * FROM public.post_response_intelligence_effects WHERE execution_id=p_execution_id ORDER BY effect_key$$;

ALTER FUNCTION public.acquire_post_response_intelligence_execution_v1(uuid,uuid,uuid,uuid,uuid,text,text,text) OWNER TO postgres;ALTER FUNCTION public.claim_post_response_intelligence_effect_v1(uuid,text) OWNER TO postgres;ALTER FUNCTION public.complete_post_response_intelligence_effect_v1(uuid,text) OWNER TO postgres;ALTER FUNCTION public.finish_post_response_intelligence_execution_v1(uuid,text,text,text) OWNER TO postgres;ALTER FUNCTION public.list_post_response_intelligence_effects_v1(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.acquire_post_response_intelligence_execution_v1(uuid,uuid,uuid,uuid,uuid,text,text,text),public.claim_post_response_intelligence_effect_v1(uuid,text),public.complete_post_response_intelligence_effect_v1(uuid,text),public.finish_post_response_intelligence_execution_v1(uuid,text,text,text),public.list_post_response_intelligence_effects_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_post_response_intelligence_execution_v1(uuid,uuid,uuid,uuid,uuid,text,text,text),public.claim_post_response_intelligence_effect_v1(uuid,text),public.complete_post_response_intelligence_effect_v1(uuid,text),public.finish_post_response_intelligence_execution_v1(uuid,text,text,text),public.list_post_response_intelligence_effects_v1(uuid) TO service_role;
COMMIT;
