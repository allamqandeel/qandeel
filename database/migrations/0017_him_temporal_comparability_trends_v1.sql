BEGIN;
CREATE FUNCTION public.read_him_trend_source_v1(p_user_id uuid,p_metric_key text,p_definition_version integer,p_context_kind text,p_context_id text,p_window_start timestamptz,p_window_end timestamptz)
RETURNS TABLE(points jsonb,excluded_observation_count integer,active_binding jsonb)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE u uuid:=auth.uid();owned boolean:=false;b public.him_canonical_model_bindings;
BEGIN
 IF u IS NULL OR p_user_id IS DISTINCT FROM u THEN RAISE EXCEPTION 'Unknown or unowned HIM trend context' USING ERRCODE='42501';END IF;
 IF p_window_start IS NULL OR p_window_end IS NULL OR p_window_start>=p_window_end THEN RAISE EXCEPTION 'Explicit valid trend window required' USING ERRCODE='22023';END IF;
 IF p_context_kind='CONVERSATION_SESSION' THEN SELECT EXISTS(SELECT 1 FROM public.conversation_sessions c WHERE c.id::text=p_context_id AND c.user_id=u) INTO owned;
 ELSIF p_context_kind=ANY(ARRAY['GOAL','SITUATION','DECISION']) THEN SELECT EXISTS(SELECT 1 FROM public.him_measurement_targets t WHERE t.id::text=p_context_id AND t.user_id=u AND t.context_kind=p_context_kind) INTO owned;
 END IF;
 IF NOT owned THEN RAISE EXCEPTION 'Unknown or unowned HIM trend context' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM public.him_canonical_model_bindings x WHERE x.metric_key=p_metric_key AND x.definition_version=p_definition_version AND x.context_kind=p_context_kind AND x.status='ACTIVE';
 RETURN QUERY WITH source AS(
   SELECT s.*,cb.instrument_id,cb.instrument_version,cb.model_id,cb.model_version,cb.metric_key binding_metric_key,cb.definition_version binding_definition_version,cb.context_kind binding_context_kind
   FROM public.him_current_structured_measurements s LEFT JOIN public.him_canonical_model_bindings cb ON cb.id=s.canonical_binding_id
   WHERE s.user_id=u AND s.metric_key=p_metric_key AND s.definition_version=p_definition_version AND s.context_kind=p_context_kind AND s.context_id=p_context_id AND s.observed_at>=p_window_start AND s.observed_at<p_window_end
 ),candidate AS(SELECT * FROM source WHERE value_state='ASSESSED' ORDER BY observed_at,id LIMIT 129)
 SELECT coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.observed_at,c.id)FROM candidate c),'[]'::jsonb),least((SELECT count(*) FROM source WHERE value_state<>'ASSESSED'),128)::integer,
   CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object('id',b.id,'metricKey',b.metric_key,'definitionVersion',b.definition_version,'contextKind',b.context_kind,'instrumentId',b.instrument_id,'instrumentVersion',b.instrument_version,'scaleReference',b.scale_contract_reference,'scaleVersion',b.scale_version,'modelId',b.model_id,'modelVersion',b.model_version)END;
END$$;
REVOKE ALL ON FUNCTION public.read_him_trend_source_v1(uuid,text,integer,text,text,timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_him_trend_source_v1(uuid,text,integer,text,text,timestamptz,timestamptz) TO authenticated;
COMMIT;
