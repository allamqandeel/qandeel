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
DECLARE target public.hypotheses;
DECLARE canonical_supporting text[]; canonical_contradicting text[]; canonical_missing text[];
BEGIN
  SELECT * INTO target FROM public.hypotheses
    WHERE id=(p_evaluation->>'target_id')::uuid AND user_id=(SELECT auth.uid());
  IF NOT FOUND THEN RETURN; END IF;
  IF (p_evaluation->>'target_version')::integer<>target.version THEN
    RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='22023';
  END IF;
  SELECT coalesce(array_agg(link.evidence_id ORDER BY link.ordinality), '{}'::text[])
    INTO canonical_supporting
    FROM unnest(target.supporting_evidence_ids) WITH ORDINALITY link(evidence_id, ordinality)
    JOIN public.memories memory ON link.evidence_id='memory:' || memory.id::text
    WHERE memory.user_id=(SELECT auth.uid()) AND memory.status='ACTIVE'
      AND memory.source IN ('USER_STATED','USER_CONFIRMED') AND memory.type<>'DERIVED_INSIGHT'
      AND (memory.expires_at IS NULL OR memory.expires_at>CURRENT_TIMESTAMP);
  SELECT coalesce(array_agg(link.evidence_id ORDER BY link.ordinality), '{}'::text[])
    INTO canonical_contradicting
    FROM unnest(target.contradicting_evidence_ids) WITH ORDINALITY link(evidence_id, ordinality)
    JOIN public.memories memory ON link.evidence_id='memory:' || memory.id::text
    WHERE memory.user_id=(SELECT auth.uid()) AND memory.status='ACTIVE'
      AND memory.source IN ('USER_STATED','USER_CONFIRMED') AND memory.type<>'DERIVED_INSIGHT'
      AND (memory.expires_at IS NULL OR memory.expires_at>CURRENT_TIMESTAMP);
  canonical_missing := ARRAY[]::text[];
  IF cardinality(target.competing_hypothesis_ids)>0 THEN canonical_missing:=array_append(canonical_missing,'COMPETING_HYPOTHESES_UNASSESSED'); END IF;
  IF cardinality(target.assumptions)>0 THEN canonical_missing:=array_append(canonical_missing,'UNVERIFIED_ASSUMPTIONS'); END IF;
  IF cardinality(canonical_supporting)+cardinality(canonical_contradicting)=0 THEN canonical_missing:=array_append(canonical_missing,'NO_ELIGIBLE_EVIDENCE'); END IF;
  canonical_missing:=array_append(canonical_missing,'CONFIDENCE_MODEL_UNCALIBRATED');
  RETURN QUERY INSERT INTO public.confidence_evaluations (
    id,user_id,target_id,target_type,target_version,version,lifecycle_state,numeric_score,confidence_band,
    calibration_state,stability,supporting_evidence_ids,contradicting_evidence_ids,assumptions,
    alternative_hypothesis_ids,missing_information_codes,policy_version,provenance
  ) VALUES (
    (p_evaluation->>'id')::uuid,(SELECT auth.uid()),target.id,'HYPOTHESIS',target.version,1,
    'EVALUATED',NULL,NULL,'UNCALIBRATED','UNASSESSED',canonical_supporting,canonical_contradicting,
    target.assumptions,target.competing_hypothesis_ids,canonical_missing,
    'confidence-foundation-v1','QANDEEL_CONFIDENCE_RUNTIME'
  ) RETURNING *;
END; $$;

REVOKE ALL ON FUNCTION public.create_confidence_evaluation(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_confidence_evaluation(jsonb) TO authenticated;

COMMIT;
