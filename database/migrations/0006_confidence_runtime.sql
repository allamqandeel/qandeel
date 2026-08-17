BEGIN;

CREATE TABLE public.confidence_evaluations (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    target_id uuid NOT NULL,
    target_type text NOT NULL DEFAULT 'HYPOTHESIS',
    target_version integer NOT NULL,
    version integer NOT NULL DEFAULT 1,
    lifecycle_state text NOT NULL DEFAULT 'EVALUATED',
    numeric_score double precision,
    confidence_band text,
    calibration_state text NOT NULL DEFAULT 'UNCALIBRATED',
    stability text NOT NULL DEFAULT 'UNASSESSED',
    supporting_evidence_ids text[] NOT NULL DEFAULT '{}',
    contradicting_evidence_ids text[] NOT NULL DEFAULT '{}',
    assumptions text[] NOT NULL DEFAULT '{}',
    alternative_hypothesis_ids uuid[] NOT NULL DEFAULT '{}',
    missing_information_codes text[] NOT NULL DEFAULT '{}',
    policy_version text NOT NULL,
    provenance text NOT NULL DEFAULT 'QANDEEL_CONFIDENCE_RUNTIME',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT confidence_target_owner_fk FOREIGN KEY (target_id, user_id) REFERENCES public.hypotheses (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT confidence_target_type_check CHECK (target_type = 'HYPOTHESIS'),
    CONSTRAINT confidence_target_version_check CHECK (target_version > 0),
    CONSTRAINT confidence_version_check CHECK (version > 0),
    CONSTRAINT confidence_lifecycle_check CHECK (lifecycle_state = 'EVALUATED'),
    CONSTRAINT confidence_score_unassigned_check CHECK (numeric_score IS NULL),
    CONSTRAINT confidence_band_unassigned_check CHECK (confidence_band IS NULL),
    CONSTRAINT confidence_calibration_check CHECK (calibration_state = 'UNCALIBRATED'),
    CONSTRAINT confidence_stability_check CHECK (stability = 'UNASSESSED'),
    CONSTRAINT confidence_supporting_bound CHECK (public.bounded_nonempty_text_array(supporting_evidence_ids, 32, 64)),
    CONSTRAINT confidence_contradicting_bound CHECK (public.bounded_nonempty_text_array(contradicting_evidence_ids, 32, 64)),
    CONSTRAINT confidence_evidence_roles_disjoint CHECK (NOT supporting_evidence_ids && contradicting_evidence_ids),
    CONSTRAINT confidence_assumptions_bound CHECK (public.bounded_nonempty_text_array(assumptions, 8, 500)),
    CONSTRAINT confidence_alternatives_bound CHECK (cardinality(alternative_hypothesis_ids) <= 16),
    CONSTRAINT confidence_missing_information_check CHECK (
      cardinality(missing_information_codes) <= 4 AND
      missing_information_codes <@ ARRAY['NO_ELIGIBLE_EVIDENCE','UNVERIFIED_ASSUMPTIONS','COMPETING_HYPOTHESES_UNASSESSED','CONFIDENCE_MODEL_UNCALIBRATED']::text[]
    ),
    CONSTRAINT confidence_policy_version_check CHECK (policy_version = 'confidence-foundation-v1'),
    CONSTRAINT confidence_provenance_check CHECK (provenance = 'QANDEEL_CONFIDENCE_RUNTIME')
);

CREATE INDEX confidence_evaluations_target_history_idx ON public.confidence_evaluations (user_id, target_id, created_at DESC, id);
ALTER TABLE public.confidence_evaluations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.confidence_evaluations FROM anon, authenticated;
GRANT SELECT ON TABLE public.confidence_evaluations TO authenticated;
CREATE POLICY confidence_evaluations_select_own ON public.confidence_evaluations FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.create_confidence_evaluation(p_evaluation jsonb)
RETURNS SETOF public.confidence_evaluations LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target public.hypotheses; evidence_id text; memory_id uuid;
BEGIN
  SELECT * INTO target FROM public.hypotheses
    WHERE id=(p_evaluation->>'target_id')::uuid AND user_id=(SELECT auth.uid());
  IF NOT FOUND OR p_evaluation->>'user_id'<>(SELECT auth.uid())::text THEN RETURN; END IF;
  IF (p_evaluation->>'target_version')::integer<>target.version THEN
    RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='22023';
  END IF;
  FOR evidence_id IN SELECT jsonb_array_elements_text(p_evaluation->'supporting_evidence_ids') LOOP
    IF evidence_id !~ '^memory:[0-9a-fA-F-]{36}$' OR
       NOT evidence_id=ANY(target.supporting_evidence_ids) THEN
      RAISE EXCEPTION 'Supporting evidence role is invalid.' USING ERRCODE='22023';
    END IF;
    memory_id:=substring(evidence_id FROM 8)::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.memories WHERE id=memory_id AND user_id=(SELECT auth.uid())
      AND status='ACTIVE' AND source IN ('USER_STATED','USER_CONFIRMED') AND type<>'DERIVED_INSIGHT'
      AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)) THEN
      RAISE EXCEPTION 'Evidence is not currently eligible.' USING ERRCODE='22023';
    END IF;
  END LOOP;
  FOR evidence_id IN SELECT jsonb_array_elements_text(p_evaluation->'contradicting_evidence_ids') LOOP
    IF evidence_id !~ '^memory:[0-9a-fA-F-]{36}$' OR
       NOT evidence_id=ANY(target.contradicting_evidence_ids) THEN
      RAISE EXCEPTION 'Contradicting evidence role is invalid.' USING ERRCODE='22023';
    END IF;
    memory_id:=substring(evidence_id FROM 8)::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.memories WHERE id=memory_id AND user_id=(SELECT auth.uid())
      AND status='ACTIVE' AND source IN ('USER_STATED','USER_CONFIRMED') AND type<>'DERIVED_INSIGHT'
      AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)) THEN
      RAISE EXCEPTION 'Evidence is not currently eligible.' USING ERRCODE='22023';
    END IF;
  END LOOP;
  RETURN QUERY INSERT INTO public.confidence_evaluations (
    id,user_id,target_id,target_type,target_version,version,lifecycle_state,numeric_score,confidence_band,
    calibration_state,stability,supporting_evidence_ids,contradicting_evidence_ids,assumptions,
    alternative_hypothesis_ids,missing_information_codes,policy_version,provenance
  ) VALUES (
    (p_evaluation->>'id')::uuid,(p_evaluation->>'user_id')::uuid,(p_evaluation->>'target_id')::uuid,
    p_evaluation->>'target_type',(p_evaluation->>'target_version')::integer,(p_evaluation->>'version')::integer,
    p_evaluation->>'lifecycle_state',NULL,NULL,p_evaluation->>'calibration_state',p_evaluation->>'stability',
    ARRAY(SELECT jsonb_array_elements_text(p_evaluation->'supporting_evidence_ids')),
    ARRAY(SELECT jsonb_array_elements_text(p_evaluation->'contradicting_evidence_ids')),
    ARRAY(SELECT jsonb_array_elements_text(p_evaluation->'assumptions')),
    ARRAY(SELECT jsonb_array_elements_text(p_evaluation->'alternative_hypothesis_ids'))::uuid[],
    ARRAY(SELECT jsonb_array_elements_text(p_evaluation->'missing_information_codes')),
    p_evaluation->>'policy_version',p_evaluation->>'provenance'
  ) RETURNING *;
END; $$;

REVOKE ALL ON FUNCTION public.create_confidence_evaluation(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_confidence_evaluation(jsonb) TO authenticated;

COMMIT;
