BEGIN;

CREATE FUNCTION public.background_create_system_hypothesis_v1(
  p_user_id uuid, p_hypothesis_id uuid, p_statement text, p_type text, p_domain text,
  p_scope text, p_assumptions text[], p_disconfirming_conditions text[]
) RETURNS SETOF public.hypotheses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_user_id) THEN RETURN; END IF;
  RETURN QUERY INSERT INTO public.hypotheses(
    id,user_id,statement,type,domain,scope,origin,status,assumptions,disconfirming_conditions
  ) VALUES (
    p_hypothesis_id,p_user_id,p_statement,p_type,p_domain,p_scope,
    'SYSTEM_GENERATED','CANDIDATE',p_assumptions,p_disconfirming_conditions
  ) RETURNING *;
END; $$;

CREATE FUNCTION public.background_attach_hypothesis_evidence_v1(
  p_user_id uuid, p_hypothesis_id uuid, p_evidence_id text, p_role text
) RETURNS SETOF public.hypotheses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_hypothesis public.hypotheses; memory_id uuid;
BEGIN
  IF p_evidence_id !~ '^memory:[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'Invalid evidence ID.' USING ERRCODE='22023'; END IF;
  memory_id:=substring(p_evidence_id FROM 8)::uuid;
  IF NOT EXISTS (SELECT 1 FROM public.memories WHERE id=memory_id AND user_id=p_user_id AND status='ACTIVE' AND source IN ('USER_STATED','USER_CONFIRMED') AND type<>'DERIVED_INSIGHT' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))
  THEN RAISE EXCEPTION 'Evidence is not eligible.' USING ERRCODE='22023'; END IF;
  SELECT * INTO current_hypothesis FROM public.hypotheses WHERE id=p_hypothesis_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF p_evidence_id=ANY(current_hypothesis.supporting_evidence_ids) OR p_evidence_id=ANY(current_hypothesis.contradicting_evidence_ids)
  THEN RAISE EXCEPTION 'Evidence is already attached.' USING ERRCODE='22023'; END IF;
  IF p_role='SUPPORTING' THEN
    RETURN QUERY UPDATE public.hypotheses SET supporting_evidence_ids=array_append(supporting_evidence_ids,p_evidence_id),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=p_hypothesis_id AND user_id=p_user_id RETURNING *;
  ELSIF p_role='CONTRADICTING' THEN
    RETURN QUERY UPDATE public.hypotheses SET contradicting_evidence_ids=array_append(contradicting_evidence_ids,p_evidence_id),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=p_hypothesis_id AND user_id=p_user_id RETURNING *;
  ELSE RAISE EXCEPTION 'Invalid evidence role.' USING ERRCODE='22023'; END IF;
END; $$;

CREATE FUNCTION public.background_link_competing_hypotheses_v1(
  p_user_id uuid, p_hypothesis_id uuid, p_competitor_id uuid
) RETURNS SETOF public.hypotheses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE first_id uuid; second_id uuid; first_h public.hypotheses; second_h public.hypotheses;
BEGIN
  IF p_hypothesis_id=p_competitor_id THEN RAISE EXCEPTION 'Self competition is invalid.' USING ERRCODE='22023'; END IF;
  first_id:=LEAST(p_hypothesis_id,p_competitor_id); second_id:=GREATEST(p_hypothesis_id,p_competitor_id);
  SELECT * INTO first_h FROM public.hypotheses WHERE id=first_id AND user_id=p_user_id FOR UPDATE;
  SELECT * INTO second_h FROM public.hypotheses WHERE id=second_id AND user_id=p_user_id FOR UPDATE;
  IF first_h.id IS NULL OR second_h.id IS NULL THEN RETURN; END IF;
  IF second_id=ANY(first_h.competing_hypothesis_ids) OR first_id=ANY(second_h.competing_hypothesis_ids)
  THEN RAISE EXCEPTION 'Duplicate competition link.' USING ERRCODE='22023'; END IF;
  UPDATE public.hypotheses SET competing_hypothesis_ids=array_append(competing_hypothesis_ids,second_id),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=first_id AND user_id=p_user_id;
  UPDATE public.hypotheses SET competing_hypothesis_ids=array_append(competing_hypothesis_ids,first_id),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=second_id AND user_id=p_user_id;
  RETURN QUERY SELECT * FROM public.hypotheses WHERE id=p_hypothesis_id AND user_id=p_user_id;
END; $$;

CREATE FUNCTION public.background_create_confidence_evaluation_v1(
  p_user_id uuid, p_evaluation_id uuid, p_hypothesis_id uuid, p_target_version integer
) RETURNS SETOF public.confidence_evaluations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target public.hypotheses; canonical_supporting text[]; canonical_contradicting text[]; canonical_missing text[];
BEGIN
  SELECT * INTO target FROM public.hypotheses WHERE id=p_hypothesis_id AND user_id=p_user_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF p_target_version<>target.version THEN RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='22023'; END IF;
  SELECT coalesce(array_agg(link.evidence_id ORDER BY link.ordinality),'{}'::text[]) INTO canonical_supporting
  FROM unnest(target.supporting_evidence_ids) WITH ORDINALITY link(evidence_id,ordinality)
  JOIN public.memories memory ON link.evidence_id='memory:'||memory.id::text
  WHERE memory.user_id=p_user_id AND memory.status='ACTIVE' AND memory.source IN ('USER_STATED','USER_CONFIRMED') AND memory.type<>'DERIVED_INSIGHT' AND (memory.expires_at IS NULL OR memory.expires_at>CURRENT_TIMESTAMP);
  SELECT coalesce(array_agg(link.evidence_id ORDER BY link.ordinality),'{}'::text[]) INTO canonical_contradicting
  FROM unnest(target.contradicting_evidence_ids) WITH ORDINALITY link(evidence_id,ordinality)
  JOIN public.memories memory ON link.evidence_id='memory:'||memory.id::text
  WHERE memory.user_id=p_user_id AND memory.status='ACTIVE' AND memory.source IN ('USER_STATED','USER_CONFIRMED') AND memory.type<>'DERIVED_INSIGHT' AND (memory.expires_at IS NULL OR memory.expires_at>CURRENT_TIMESTAMP);
  canonical_missing:=ARRAY[]::text[];
  IF cardinality(target.competing_hypothesis_ids)>0 THEN canonical_missing:=array_append(canonical_missing,'COMPETING_HYPOTHESES_UNASSESSED'); END IF;
  IF cardinality(target.assumptions)>0 THEN canonical_missing:=array_append(canonical_missing,'UNVERIFIED_ASSUMPTIONS'); END IF;
  IF cardinality(canonical_supporting)+cardinality(canonical_contradicting)=0 THEN canonical_missing:=array_append(canonical_missing,'NO_ELIGIBLE_EVIDENCE'); END IF;
  canonical_missing:=array_append(canonical_missing,'CONFIDENCE_MODEL_UNCALIBRATED');
  RETURN QUERY INSERT INTO public.confidence_evaluations(
    id,user_id,target_id,target_type,target_version,version,lifecycle_state,numeric_score,confidence_band,
    calibration_state,stability,supporting_evidence_ids,contradicting_evidence_ids,assumptions,
    alternative_hypothesis_ids,missing_information_codes,policy_version,provenance
  ) VALUES (
    p_evaluation_id,p_user_id,target.id,'HYPOTHESIS',target.version,1,'EVALUATED',NULL,NULL,
    'UNCALIBRATED','UNASSESSED',canonical_supporting,canonical_contradicting,target.assumptions,
    target.competing_hypothesis_ids,canonical_missing,'confidence-foundation-v1','QANDEEL_CONFIDENCE_RUNTIME'
  ) RETURNING *;
END; $$;

REVOKE ALL ON FUNCTION public.background_create_system_hypothesis_v1(uuid,uuid,text,text,text,text,text[],text[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.background_attach_hypothesis_evidence_v1(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.background_link_competing_hypotheses_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.background_create_confidence_evaluation_v1(uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.background_create_system_hypothesis_v1(uuid,uuid,text,text,text,text,text[],text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.background_attach_hypothesis_evidence_v1(uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.background_link_competing_hypotheses_v1(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.background_create_confidence_evaluation_v1(uuid,uuid,uuid,integer) TO service_role;

COMMIT;
