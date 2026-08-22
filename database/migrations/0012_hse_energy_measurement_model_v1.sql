BEGIN;

CREATE TABLE public.him_scale_contracts(
 id uuid PRIMARY KEY,scale_contract_id text NOT NULL,scale_version integer NOT NULL CHECK(scale_version>0),scale_kind text NOT NULL CHECK(scale_kind='ORDINAL'),
 ordered boolean NOT NULL CHECK(ordered),interval_operations boolean NOT NULL CHECK(NOT interval_operations),ratio_operations boolean NOT NULL CHECK(NOT ratio_operations),
 allowed_codes integer[] NOT NULL CHECK(allowed_codes=ARRAY[1,2,3,4,5]),categories jsonb NOT NULL CHECK(jsonb_typeof(categories)='object'),created_at timestamptz NOT NULL,UNIQUE(scale_contract_id,scale_version)
);
CREATE TABLE public.him_measurement_events(
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,context_kind text NOT NULL CHECK(context_kind='CONVERSATION_SESSION'),context_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(id,user_id,context_kind,context_id)
);
CREATE TABLE public.him_measurement_observations(
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,measurement_event_id uuid NOT NULL,metric_key text NOT NULL,definition_version integer NOT NULL,
 instrument_id text NOT NULL,instrument_version integer NOT NULL CHECK(instrument_version>0),scale_contract_reference text NOT NULL,scale_version integer NOT NULL CHECK(scale_version>0),
 context_kind text NOT NULL CHECK(context_kind='CONVERSATION_SESSION'),context_id uuid NOT NULL,response_code text NOT NULL CHECK(response_code=ANY(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NOT_SURE'])),
 reported_at timestamptz NOT NULL,locale text NOT NULL CHECK(locale='ar-EG'),source text NOT NULL CHECK(source='DIRECT_STRUCTURED_USER_REPORT'),supersedes_observation_id uuid,
 canonical_provenance text NOT NULL CHECK(canonical_provenance='QANDEEL_HSE_ENERGY_MEASUREMENT_V1'),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(measurement_event_id,user_id,context_kind,context_id) REFERENCES public.him_measurement_events(id,user_id,context_kind,context_id),
 FOREIGN KEY(metric_key,definition_version) REFERENCES public.him_metric_definitions(metric_key,definition_version),FOREIGN KEY(scale_contract_reference,scale_version) REFERENCES public.him_scale_contracts(scale_contract_id,scale_version),
 FOREIGN KEY(supersedes_observation_id) REFERENCES public.him_measurement_observations(id),CHECK(metric_key='hse.energy' AND definition_version=1),
 CHECK(instrument_id='hse.energy.ar-eg.right-now' AND instrument_version=1),CHECK(scale_contract_reference='hse.energy.ordinal-5.v1' AND scale_version=1)
);
CREATE UNIQUE INDEX him_energy_one_correction_per_observation ON public.him_measurement_observations(supersedes_observation_id) WHERE supersedes_observation_id IS NOT NULL;

CREATE TABLE public.him_governance_approvals(
 id uuid PRIMARY KEY,approval_id text NOT NULL,approval_version integer NOT NULL CHECK(approval_version>0),authority_id text NOT NULL,authority_version integer NOT NULL CHECK(authority_version>0),
 model_id text NOT NULL,model_version integer NOT NULL,approval_basis jsonb NOT NULL CHECK(jsonb_typeof(approval_basis)='array' AND jsonb_array_length(approval_basis)=10),
 external_validation_claimed boolean NOT NULL CHECK(NOT external_validation_claimed),approved_at timestamptz NOT NULL,canonical_source text NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(approval_id,approval_version),FOREIGN KEY(model_id,model_version) REFERENCES public.him_calculation_models(model_id,model_version)
);
CREATE TABLE public.him_canonical_model_bindings(
 id uuid PRIMARY KEY,metric_key text NOT NULL,definition_version integer NOT NULL,context_kind text NOT NULL,binding_version integer NOT NULL CHECK(binding_version>0),status text NOT NULL CHECK(status=ANY(ARRAY['ACTIVE','RETIRED'])),
 model_id text NOT NULL,model_version integer NOT NULL,instrument_id text NOT NULL,instrument_version integer NOT NULL,scale_contract_reference text NOT NULL,scale_version integer NOT NULL,
 approval_id text NOT NULL,approval_version integer NOT NULL,effective_at timestamptz NOT NULL,retired_at timestamptz,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(metric_key,definition_version,context_kind,binding_version),FOREIGN KEY(metric_key,definition_version) REFERENCES public.him_metric_definitions(metric_key,definition_version),
 FOREIGN KEY(model_id,model_version) REFERENCES public.him_calculation_models(model_id,model_version),FOREIGN KEY(scale_contract_reference,scale_version) REFERENCES public.him_scale_contracts(scale_contract_id,scale_version),
 FOREIGN KEY(approval_id,approval_version) REFERENCES public.him_governance_approvals(approval_id,approval_version),CHECK(context_kind='CONVERSATION_SESSION'),
 CHECK(instrument_id='hse.energy.ar-eg.right-now' AND instrument_version=1)
);
CREATE UNIQUE INDEX him_one_active_canonical_binding ON public.him_canonical_model_bindings(metric_key,definition_version,context_kind) WHERE status='ACTIVE';

ALTER TABLE public.him_calculation_results ADD COLUMN measurement_event_id uuid,ADD COLUMN measurement_observation_id uuid REFERENCES public.him_measurement_observations(id),ADD COLUMN canonical_binding_id uuid REFERENCES public.him_canonical_model_bindings(id),ADD COLUMN scale_contract_reference text,ADD COLUMN scale_version integer;
ALTER TABLE public.him_metric_snapshots ADD COLUMN calculation_result_id uuid REFERENCES public.him_calculation_results(id),ADD COLUMN measurement_event_id uuid,ADD COLUMN measurement_observation_id uuid REFERENCES public.him_measurement_observations(id),ADD COLUMN canonical_binding_id uuid REFERENCES public.him_canonical_model_bindings(id),ADD COLUMN scale_contract_reference text,ADD COLUMN scale_version integer;

INSERT INTO public.him_scale_contracts VALUES('12000000-0000-4000-8000-000000000001','hse.energy.ordinal-5.v1',1,'ORDINAL',true,false,false,ARRAY[1,2,3,4,5],'{"VERY_LOW":1,"LOW":2,"MODERATE":3,"HIGH":4,"VERY_HIGH":5}'::jsonb,'2026-08-22T00:00:00Z');
INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at)
VALUES('12000000-0000-4000-8000-000000000002','hse.energy.direct-structured-user-report',1,'hse.energy',1,'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE','ISSUE_56_HSE_ENERGY_MEASUREMENT_MODEL_V1','DIRECT_STRUCTURED_USER_REPORT','hse.energy.ordinal-5.v1','{"required":["measurementObservation"]}'::jsonb,'FIRST_CLASS_HIM_MEASUREMENT_OBSERVATION_V1',ARRAY['CONVERSATION_SESSION'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','hse-energy-direct-structured-v1','2026-08-22T00:00:00Z','2026-08-22T00:00:00Z');
INSERT INTO public.him_governance_approvals(id,approval_id,approval_version,authority_id,authority_version,model_id,model_version,approval_basis,external_validation_claimed,approved_at,canonical_source)
VALUES('12000000-0000-4000-8000-000000000003','qandeel.him.energy.foundation-approval',1,'QANDEEL_FOUNDATION_GOVERNANCE',1,'hse.energy.direct-structured-user-report',1,'["HSE_CONSTRUCT","DIRECT_REPORT","RIGHT_NOW","CONVERSATION_SESSION","ORDINAL_5","FOUNDER_DESIGN_F1_F2","DETERMINISTIC","EVENT_CORRECTION_MISSINGNESS","SECURITY_BINDING","NO_EXTERNAL_VALIDATION_CLAIM"]'::jsonb,false,'2026-08-22T00:00:00Z','ISSUE_56_CANONICAL_APPROVAL');
INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at)
VALUES('12000000-0000-4000-8000-000000000004','hse.energy',1,'CONVERSATION_SESSION',1,'ACTIVE','hse.energy.direct-structured-user-report',1,'hse.energy.ar-eg.right-now',1,'hse.energy.ordinal-5.v1',1,'qandeel.him.energy.foundation-approval',1,'2026-08-22T00:00:00Z');
UPDATE public.him_metric_definitions SET calculation_status='CALIBRATED',scale_reference='hse.energy.ordinal-5.v1',required_input_contract='DIRECT_STRUCTURED_USER_REPORT_AR_EG_RIGHT_NOW_V1' WHERE metric_key='hse.energy' AND definition_version=1;

CREATE FUNCTION public.reject_him_energy_immutable_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN RAISE EXCEPTION 'HIM Energy canonical history is immutable' USING ERRCODE='55000';END$$;
CREATE TRIGGER him_energy_observation_immutable BEFORE UPDATE OR DELETE ON public.him_measurement_observations FOR EACH ROW EXECUTE FUNCTION public.reject_him_energy_immutable_mutation();
CREATE TRIGGER him_energy_event_immutable BEFORE UPDATE OR DELETE ON public.him_measurement_events FOR EACH ROW EXECUTE FUNCTION public.reject_him_energy_immutable_mutation();
CREATE TRIGGER him_energy_approval_immutable BEFORE UPDATE OR DELETE ON public.him_governance_approvals FOR EACH ROW EXECUTE FUNCTION public.reject_him_energy_immutable_mutation();
CREATE TRIGGER him_energy_binding_immutable BEFORE UPDATE OR DELETE ON public.him_canonical_model_bindings FOR EACH ROW EXECUTE FUNCTION public.reject_him_energy_immutable_mutation();

CREATE FUNCTION public.guard_him_assessed_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF NEW.value_state='ASSESSED' AND (NEW.calculation_result_id IS NULL OR NEW.measurement_observation_id IS NULL OR NEW.measurement_event_id IS NULL OR NEW.canonical_binding_id IS NULL) THEN RAISE EXCEPTION 'Assessed HIM snapshots require trusted calculation provenance' USING ERRCODE='42501';END IF;RETURN NEW;END$$;
CREATE TRIGGER him_assessed_snapshot_trusted BEFORE INSERT ON public.him_metric_snapshots FOR EACH ROW EXECUTE FUNCTION public.guard_him_assessed_snapshot();

CREATE FUNCTION public.create_hse_energy_measurement(p_context_id uuid,p_response_code text,p_reported_at timestamptz) RETURNS public.him_measurement_observations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE u uuid:=auth.uid();e uuid:=gen_random_uuid();o public.him_measurement_observations;BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 IF p_response_code<>ALL(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NOT_SURE']) OR p_reported_at IS NULL THEN RAISE EXCEPTION 'Invalid Energy response' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_context_id AND s.user_id=u) THEN RAISE EXCEPTION 'Unknown or cross-user conversation session' USING ERRCODE='42501';END IF;
 INSERT INTO public.him_measurement_events(id,user_id,context_kind,context_id)VALUES(e,u,'CONVERSATION_SESSION',p_context_id);
 INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,locale,source,canonical_provenance)
 VALUES(gen_random_uuid(),u,e,'hse.energy',1,'hse.energy.ar-eg.right-now',1,'hse.energy.ordinal-5.v1',1,'CONVERSATION_SESSION',p_context_id,p_response_code,p_reported_at,'ar-EG','DIRECT_STRUCTURED_USER_REPORT','QANDEEL_HSE_ENERGY_MEASUREMENT_V1') RETURNING * INTO o;RETURN o;END$$;
CREATE FUNCTION public.correct_hse_energy_measurement(p_supersedes_observation_id uuid,p_response_code text,p_reported_at timestamptz) RETURNS public.him_measurement_observations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE u uuid:=auth.uid();prior public.him_measurement_observations;o public.him_measurement_observations;BEGIN
 SELECT * INTO prior FROM public.him_measurement_observations WHERE id=p_supersedes_observation_id AND user_id=u;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.him_measurement_observations WHERE supersedes_observation_id=prior.id) THEN RAISE EXCEPTION 'Unknown, cross-user, or already corrected observation' USING ERRCODE='42501';END IF;
 IF p_response_code<>ALL(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NOT_SURE']) OR p_reported_at IS NULL THEN RAISE EXCEPTION 'Invalid Energy correction' USING ERRCODE='22023';END IF;
 INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,locale,source,supersedes_observation_id,canonical_provenance)
 SELECT gen_random_uuid(),user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,p_response_code,p_reported_at,locale,source,id,'QANDEEL_HSE_ENERGY_MEASUREMENT_V1' FROM public.him_measurement_observations WHERE id=prior.id RETURNING * INTO o;RETURN o;END$$;

CREATE FUNCTION public.calculate_hse_energy_measurement(p_observation_id uuid) RETURNS public.him_metric_snapshots LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE u uuid:=auth.uid();o public.him_measurement_observations;b public.him_canonical_model_bindings;r public.him_calculation_results;score double precision;state text;next_version integer;s public.him_metric_snapshots;BEGIN
 SELECT * INTO o FROM public.him_measurement_observations WHERE id=p_observation_id AND user_id=u;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.him_measurement_observations x WHERE x.supersedes_observation_id=o.id) THEN RAISE EXCEPTION 'Unknown, cross-user, or superseded Energy observation' USING ERRCODE='42501';END IF;
 SELECT cb.* INTO b FROM public.him_canonical_model_bindings cb JOIN public.him_calculation_models m ON(m.model_id,m.model_version)=(cb.model_id,cb.model_version) WHERE cb.metric_key=o.metric_key AND cb.definition_version=o.definition_version AND cb.context_kind=o.context_kind AND cb.status='ACTIVE' AND m.lifecycle='CALIBRATED' AND cb.instrument_id=o.instrument_id AND cb.instrument_version=o.instrument_version AND cb.scale_contract_reference=o.scale_contract_reference AND cb.scale_version=o.scale_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'No exact active canonical Energy binding' USING ERRCODE='22023';END IF;
 score:=CASE o.response_code WHEN 'VERY_LOW' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'HIGH' THEN 4 WHEN 'VERY_HIGH' THEN 5 ELSE NULL END;state:=CASE WHEN score IS NULL THEN 'UNASSESSED' ELSE 'ASSESSED' END;
 INSERT INTO public.him_calculation_results(id,user_id,metric_key,definition_version,model_id,model_version,context_kind,context_id,result_state,numeric_value,missing_input_keys,contradiction_state,supporting_evidence_refs,contradictory_evidence_refs,provenance,confidence_state,confidence_reference,trace_id,update_reason,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version)
 VALUES(gen_random_uuid(),u,o.metric_key,o.definition_version,b.model_id,b.model_version,o.context_kind,o.context_id::text,state,score,CASE WHEN score IS NULL THEN ARRAY['scoredResponse'] ELSE ARRAY[]::text[] END,'NONE',ARRAY['measurement-observation:'||o.id::text],ARRAY[]::text[],'QANDEEL_HIM_CALCULATION_RUNTIME_V1','UNASSESSED',NULL,gen_random_uuid()::text,'DIRECT_STRUCTURED_USER_REPORT',o.measurement_event_id,o.id,b.id,o.scale_contract_reference,o.scale_version) RETURNING * INTO r;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||o.metric_key||o.context_kind||o.context_id::text,0));SELECT coalesce(max(snapshot_version),0)+1 INTO next_version FROM public.him_metric_snapshots WHERE user_id=u AND metric_key=o.metric_key AND context_kind=o.context_kind AND context_id=o.context_id::text;
 INSERT INTO public.him_metric_snapshots(id,user_id,metric_key,definition_version,semantic_mapping_status,semantic_type,value_state,numeric_value,confidence_state,confidence_reference,supporting_evidence_ids,contradicting_evidence_ids,source_engines,context_kind,context_id,scope,observed_at,validity_status,snapshot_version,descriptive_update_reason,descriptive_update_reference_ids,canonical_provenance,created_at,calculation_result_id,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version)
 VALUES(gen_random_uuid(),u,o.metric_key,o.definition_version,'RESOLVED','STATE',state,score,'UNASSESSED',NULL,ARRAY[]::text[],ARRAY[]::text[],ARRAY['QANDEEL_HIM_RUNTIME'],o.context_kind,o.context_id::text,'exact measurement event',o.reported_at,'VALID',next_version,'DIRECT_STRUCTURED_USER_REPORT',ARRAY[]::text[],'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',CURRENT_TIMESTAMP,r.id,o.measurement_event_id,o.id,b.id,o.scale_contract_reference,o.scale_version) RETURNING * INTO s;RETURN s;END$$;

ALTER TABLE public.him_scale_contracts ENABLE ROW LEVEL SECURITY;ALTER TABLE public.him_measurement_events ENABLE ROW LEVEL SECURITY;ALTER TABLE public.him_measurement_observations ENABLE ROW LEVEL SECURITY;ALTER TABLE public.him_governance_approvals ENABLE ROW LEVEL SECURITY;ALTER TABLE public.him_canonical_model_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY him_measurement_events_owner_select ON public.him_measurement_events FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY him_measurement_observations_owner_select ON public.him_measurement_observations FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
REVOKE ALL ON public.him_scale_contracts,public.him_measurement_events,public.him_measurement_observations,public.him_governance_approvals,public.him_canonical_model_bindings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.him_measurement_events,public.him_measurement_observations TO authenticated;
REVOKE ALL ON FUNCTION public.create_hse_energy_measurement(uuid,text,timestamptz),public.correct_hse_energy_measurement(uuid,text,timestamptz),public.calculate_hse_energy_measurement(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_hse_energy_measurement(uuid,text,timestamptz),public.correct_hse_energy_measurement(uuid,text,timestamptz),public.calculate_hse_energy_measurement(uuid) TO authenticated;

DO $$BEGIN IF (SELECT count(*) FROM public.him_metric_definitions WHERE calculation_status='CALIBRATED')<>1 OR NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hse.energy' AND calculation_status='CALIBRATED') THEN RAISE EXCEPTION 'Energy-only calibration invariant failed';END IF;END$$;
COMMIT;

