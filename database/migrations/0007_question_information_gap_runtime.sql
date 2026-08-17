BEGIN;

ALTER TABLE public.confidence_evaluations ADD CONSTRAINT confidence_evaluations_id_user_unique UNIQUE(id,user_id);

CREATE TABLE public.information_gaps (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 information_needed text NOT NULL CHECK(length(btrim(information_needed)) BETWEEN 1 AND 2000),
 why_it_matters text NOT NULL CHECK(length(btrim(why_it_matters)) BETWEEN 1 AND 2000),
 related_hypothesis_ids uuid[] NOT NULL DEFAULT '{}' CHECK(cardinality(related_hypothesis_ids)<=16),
 confidence_evaluation_id uuid, user_answerability text NOT NULL DEFAULT 'UNASSESSED',
 preferred_question_type text, status text NOT NULL DEFAULT 'OPEN', version integer NOT NULL DEFAULT 1,
 provenance text NOT NULL DEFAULT 'QANDEEL_QUESTION_RUNTIME', created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT information_gap_answerability_check CHECK(user_answerability IN ('UNASSESSED','USER_CAN_ANSWER','USER_CANNOT_ANSWER')),
 CONSTRAINT information_gap_question_type_check CHECK(preferred_question_type IS NULL OR preferred_question_type IN ('CLARIFICATION','FACT_FINDING','DIAGNOSTIC','DISCRIMINATING','REFLECTIVE','PREFERENCE','DECISION','VALIDATION','PREDICTION','OUTCOME','SAFETY_CRITICAL','FOLLOW_UP')),
 CONSTRAINT information_gap_foundation_check CHECK(status='OPEN' AND version=1 AND provenance='QANDEEL_QUESTION_RUNTIME'),
 CONSTRAINT information_gap_confidence_owner_fk FOREIGN KEY(confidence_evaluation_id,user_id) REFERENCES public.confidence_evaluations(id,user_id) ON DELETE RESTRICT,
 UNIQUE(id,user_id)
);
CREATE TABLE public.information_gap_hypotheses (
 gap_id uuid NOT NULL, hypothesis_id uuid NOT NULL, user_id uuid NOT NULL,
 PRIMARY KEY(gap_id,hypothesis_id), FOREIGN KEY(gap_id,user_id) REFERENCES public.information_gaps(id,user_id) ON DELETE RESTRICT,
 FOREIGN KEY(hypothesis_id,user_id) REFERENCES public.hypotheses(id,user_id) ON DELETE RESTRICT
);
CREATE TABLE public.question_candidates (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 information_gap_id uuid NOT NULL, question_text text NOT NULL CHECK(length(btrim(question_text)) BETWEEN 1 AND 1000),
 normalized_question_text text NOT NULL, question_type text NOT NULL, target_hypothesis_ids uuid[] NOT NULL DEFAULT '{}',
 information_needed text NOT NULL CHECK(length(btrim(information_needed)) BETWEEN 1 AND 2000), answer_format text NOT NULL,
 dependency_ids uuid[] NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'VALIDATED', version integer NOT NULL DEFAULT 1,
 expected_information_gain double precision, question_utility double precision, ranking_state text NOT NULL DEFAULT 'UNASSESSED',
 provenance text NOT NULL DEFAULT 'QANDEEL_QUESTION_RUNTIME', created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(information_gap_id,user_id) REFERENCES public.information_gaps(id,user_id) ON DELETE RESTRICT,
 CONSTRAINT question_candidate_type_check CHECK(question_type IN ('CLARIFICATION','FACT_FINDING','DIAGNOSTIC','DISCRIMINATING','REFLECTIVE','PREFERENCE','DECISION','VALIDATION','PREDICTION','OUTCOME','SAFETY_CRITICAL','FOLLOW_UP')),
 CONSTRAINT question_candidate_answer_format_check CHECK(answer_format IN ('FREE_TEXT','YES_NO','SINGLE_CHOICE','MULTIPLE_CHOICE','NUMBER','DATE')),
 CONSTRAINT question_candidate_bounds_check CHECK(cardinality(target_hypothesis_ids)<=16 AND cardinality(dependency_ids)<=16),
 CONSTRAINT question_candidate_uncalibrated_check CHECK(expected_information_gain IS NULL AND question_utility IS NULL AND ranking_state='UNASSESSED'),
 CONSTRAINT question_candidate_lifecycle_check CHECK(status='VALIDATED' AND version=1 AND provenance='QANDEEL_QUESTION_RUNTIME'),
 UNIQUE(information_gap_id,normalized_question_text)
);

ALTER TABLE public.information_gaps ENABLE ROW LEVEL SECURITY; ALTER TABLE public.information_gap_hypotheses ENABLE ROW LEVEL SECURITY; ALTER TABLE public.question_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.information_gaps,public.information_gap_hypotheses,public.question_candidates FROM anon,authenticated;
GRANT SELECT ON public.information_gaps,public.question_candidates TO authenticated;
CREATE POLICY information_gaps_select_own ON public.information_gaps FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY question_candidates_select_own ON public.question_candidates FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

CREATE FUNCTION public.create_information_gap(p_gap jsonb) RETURNS SETOF public.information_gaps LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE canonical_user uuid := (SELECT auth.uid()); DECLARE hypothesis_id uuid; DECLARE confidence public.confidence_evaluations; DECLARE result public.information_gaps;
BEGIN
 IF canonical_user IS NULL THEN RETURN; END IF;
 IF cardinality(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_gap->'related_hypothesis_ids','[]'::jsonb))))>16 THEN RAISE EXCEPTION 'Too many hypotheses' USING ERRCODE='22023'; END IF;
 FOREACH hypothesis_id IN ARRAY ARRAY(SELECT jsonb_array_elements_text(coalesce(p_gap->'related_hypothesis_ids','[]'::jsonb))::uuid) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.hypotheses WHERE id=hypothesis_id AND user_id=canonical_user) THEN RAISE EXCEPTION 'Invalid hypothesis target' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF nullif(p_gap->>'confidence_evaluation_id','') IS NOT NULL THEN
  SELECT * INTO confidence FROM public.confidence_evaluations WHERE id=(p_gap->>'confidence_evaluation_id')::uuid AND user_id=canonical_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid confidence target' USING ERRCODE='42501'; END IF;
  IF confidence.target_type='HYPOTHESIS' AND NOT confidence.target_id=ANY(ARRAY(SELECT jsonb_array_elements_text(p_gap->'related_hypothesis_ids')::uuid)) THEN RAISE EXCEPTION 'Inconsistent confidence target' USING ERRCODE='22023'; END IF;
  IF confidence.missing_information_codes=ARRAY['CONFIDENCE_MODEL_UNCALIBRATED']::text[] THEN RAISE EXCEPTION 'Calibration is not a user gap' USING ERRCODE='22023'; END IF;
 END IF;
 INSERT INTO public.information_gaps(id,user_id,information_needed,why_it_matters,related_hypothesis_ids,confidence_evaluation_id,user_answerability,preferred_question_type)
 VALUES((p_gap->>'id')::uuid,canonical_user,p_gap->>'information_needed',p_gap->>'why_it_matters',ARRAY(SELECT jsonb_array_elements_text(coalesce(p_gap->'related_hypothesis_ids','[]'::jsonb))::uuid),nullif(p_gap->>'confidence_evaluation_id','')::uuid,coalesce(p_gap->>'user_answerability','UNASSESSED'),nullif(p_gap->>'preferred_question_type','')) RETURNING * INTO result;
 INSERT INTO public.information_gap_hypotheses(gap_id,hypothesis_id,user_id) SELECT result.id,id,canonical_user FROM unnest(result.related_hypothesis_ids) id;
 RETURN NEXT result;
END $$;

CREATE FUNCTION public.create_validated_question_candidate(p_candidate jsonb) RETURNS SETOF public.question_candidates LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE canonical_user uuid := (SELECT auth.uid()); DECLARE gap public.information_gaps; DECLARE targets uuid[]; DECLARE deps uuid[];
BEGIN
 SELECT * INTO gap FROM public.information_gaps WHERE id=(p_candidate->>'informationGapId')::uuid AND user_id=canonical_user; IF NOT FOUND THEN RETURN; END IF;
 targets:=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_candidate->'targetHypothesisIds','[]'::jsonb))::uuid); deps:=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_candidate->'dependencyIds','[]'::jsonb))::uuid);
 IF cardinality(targets)>16 OR cardinality(deps)>16 OR NOT targets<@gap.related_hypothesis_ids THEN RAISE EXCEPTION 'Invalid candidate links' USING ERRCODE='22023'; END IF;
 RETURN QUERY INSERT INTO public.question_candidates(id,user_id,information_gap_id,question_text,normalized_question_text,question_type,target_hypothesis_ids,information_needed,answer_format,dependency_ids)
 VALUES((p_candidate->>'id')::uuid,canonical_user,gap.id,btrim(p_candidate->>'questionText'),lower(regexp_replace(btrim(p_candidate->>'questionText'),'\s+',' ','g')),p_candidate->>'questionType',targets,p_candidate->>'informationNeeded',p_candidate->>'answerFormat',deps) RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.create_information_gap(jsonb),public.create_validated_question_candidate(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_information_gap(jsonb),public.create_validated_question_candidate(jsonb) TO authenticated;
COMMIT;
