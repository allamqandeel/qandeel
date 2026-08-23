BEGIN;
CREATE TABLE public.him_calculation_models(
 id uuid PRIMARY KEY, model_id text NOT NULL, model_version integer NOT NULL CHECK(model_version>0), target_metric_key text NOT NULL, target_definition_version integer NOT NULL,
 lifecycle text NOT NULL CHECK(lifecycle=ANY(ARRAY['DRAFT','VALIDATED','CALIBRATED','RETIRED'])), environment text NOT NULL CHECK(environment=ANY(ARRAY['PRODUCTION','TEST_ONLY'])),
 canonical_owner text NOT NULL CHECK(length(canonical_owner) BETWEEN 1 AND 128), canonical_source text NOT NULL CHECK(length(canonical_source) BETWEEN 1 AND 256), method_type text NOT NULL,
 scale_contract_reference text NOT NULL, required_input_contract jsonb NOT NULL CHECK(jsonb_typeof(required_input_contract)='object'), required_evidence_contract text NOT NULL,
 supported_context_kinds text[] NOT NULL CHECK(cardinality(supported_context_kinds)>0), missing_data_behavior text NOT NULL CHECK(missing_data_behavior='UNASSESSED'),
 contradiction_behavior text NOT NULL CHECK(contradiction_behavior='UNASSESSED_PRESERVE_CONFLICT'), confidence_contract text NOT NULL CHECK(confidence_contract='UNRESOLVED_METRIC_CONFIDENCE'),
 implementation_id text NOT NULL, created_at timestamptz NOT NULL, versioned_at timestamptz NOT NULL, retired_at timestamptz, superseded_by text,
 UNIQUE(model_id,model_version), FOREIGN KEY(target_metric_key,target_definition_version) REFERENCES public.him_metric_definitions(metric_key,definition_version),
 CHECK((environment='TEST_ONLY' AND target_metric_key LIKE 'test.synthetic.%') OR (environment='PRODUCTION' AND target_metric_key NOT LIKE 'test.synthetic.%'))
);
CREATE TABLE public.him_calculation_results(
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,metric_key text NOT NULL,definition_version integer NOT NULL,model_id text NOT NULL,model_version integer NOT NULL,
 context_kind text NOT NULL,context_id text NOT NULL,result_state text NOT NULL CHECK(result_state=ANY(ARRAY['ASSESSED','UNASSESSED'])),numeric_value double precision,
 missing_input_keys text[] NOT NULL,contradiction_state text NOT NULL CHECK(contradiction_state=ANY(ARRAY['NONE','PRESENT_UNRESOLVED'])),supporting_evidence_refs text[] NOT NULL,contradictory_evidence_refs text[] NOT NULL,
 calculated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,provenance text NOT NULL CHECK(provenance='QANDEEL_HIM_CALCULATION_RUNTIME_V1'),confidence_state text NOT NULL CHECK(confidence_state='UNASSESSED'),confidence_reference text,
 trace_id text NOT NULL,update_reason text NOT NULL,FOREIGN KEY(model_id,model_version) REFERENCES public.him_calculation_models(model_id,model_version),
 FOREIGN KEY(metric_key,definition_version) REFERENCES public.him_metric_definitions(metric_key,definition_version),CHECK((result_state='UNASSESSED' AND numeric_value IS NULL) OR (result_state='ASSESSED' AND numeric_value IS NOT NULL)),CHECK(NOT supporting_evidence_refs&&contradictory_evidence_refs)
);
CREATE TABLE public.him_calibration_evaluations(
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,model_id text NOT NULL,model_version integer NOT NULL,metric_key text NOT NULL,definition_version integer NOT NULL,
 context_kind text NOT NULL,context_id text NOT NULL,calculation_result_id uuid NOT NULL REFERENCES public.him_calculation_results(id),reference_outcome jsonb NOT NULL CHECK(jsonb_typeof(reference_outcome)='object'),
 comparison_status text NOT NULL CHECK(comparison_status='RECORDED_NOT_EVALUATED'),bias_state text NOT NULL CHECK(bias_state='UNASSESSED'),confidence_calibration_state text NOT NULL CHECK(confidence_calibration_state='UNASSESSED'),
 evaluated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,provenance text NOT NULL CHECK(provenance='QANDEEL_HIM_CALIBRATION_RUNTIME_V1'),evaluator_id text NOT NULL,evaluator_version integer NOT NULL CHECK(evaluator_version>0),
 FOREIGN KEY(model_id,model_version) REFERENCES public.him_calculation_models(model_id,model_version),FOREIGN KEY(metric_key,definition_version) REFERENCES public.him_metric_definitions(metric_key,definition_version)
);
ALTER TABLE public.him_calculation_models ENABLE ROW LEVEL SECURITY;ALTER TABLE public.him_calculation_results ENABLE ROW LEVEL SECURITY;ALTER TABLE public.him_calibration_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY him_calculation_results_owner_select ON public.him_calculation_results FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY him_calibration_owner_select ON public.him_calibration_evaluations FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
REVOKE ALL ON public.him_calculation_models,public.him_calculation_results,public.him_calibration_evaluations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.him_calculation_results,public.him_calibration_evaluations TO authenticated;
CREATE FUNCTION public.reject_him_runtime_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN RAISE EXCEPTION 'HIM calculation/calibration history is immutable' USING ERRCODE='55000';END$$;
CREATE TRIGGER him_results_immutable BEFORE UPDATE OR DELETE ON public.him_calculation_results FOR EACH ROW EXECUTE FUNCTION public.reject_him_runtime_mutation();
CREATE TRIGGER him_calibration_immutable BEFORE UPDATE OR DELETE ON public.him_calibration_evaluations FOR EACH ROW EXECUTE FUNCTION public.reject_him_runtime_mutation();
-- No authenticated write RPC exists. Promotion is deliberately reserved to a future protected governance function.
DO $$BEGIN IF EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE calculation_status<>'UNCALIBRATED') THEN RAISE EXCEPTION 'Production HIM metric calibration drift';END IF;END$$;
COMMIT;
