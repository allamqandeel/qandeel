-- HRS Relationship Trust Measurement & Calibration v1 (HIM Expansion metric
-- 10/17 - the first HRS metric and the first RELATIONSHIP-bound measurement
-- substrate).
--
-- Activates exactly one metric: hrs.relationship-trust@1 becomes a
-- CALIBRATED, exactly-one-RELATIONSHIP-bound, direct structured measurement
-- while its Foundation semantic mapping deliberately remains UNRESOLVED with
-- a NULL semantic type. The construct is narrow: relationship-bound current
-- reliance trust - based on what the user has actually experienced in one
-- exact relationship, how willing the user currently feels to reasonably
-- rely on the other person when something important to the user depends on
-- that person's word, follow-through, or good-faith handling of that
-- reliance. It measures the user's own current at-report reliance appraisal
-- under meaningful interpersonal vulnerability/uncertainty, never the other
-- person's objective trustworthiness. It is NOT a global propensity to
-- trust, a personality trait, attachment style, love, closeness, affection,
-- loyalty, dependency, relationship satisfaction, commitment, forgiveness,
-- hrs.communication, hrs.repair, hrs.emotional-safety, physical-safety or
-- abuse-risk assessment, a truth detector, a prediction the person will act
-- well, SENA/QANDEEL trust, epistemic Confidence Runtime, self-confidence,
-- or a clinical inference. Direction is not correctness or health: a higher
-- score never means the relationship is healthier, the reliance is
-- justified, or the other person is honest, and no recommendation or safety
-- decision may be derived from this score.
--
-- Relationship Trust deliberately does NOT reuse the seven-day HBS period
-- model: it is one exact RELATIONSHIP-bound at-report reliance appraisal.
-- Its measurement events carry a NULL temporal window pair (the durable
-- 0040 window columns stay NULL, exactly like the HSE right-now and
-- Reflection events), no caller-selected window exists, and the
-- server-authoritative report time is the measurement time. When the user's
-- reliance differs substantially by what they would be relying on the
-- person for, TOO_CONTEXT_DEPENDENT_TO_RATE fails to UNASSESSED/NULL
-- instead of collapsing domains into a misleading scalar, and
-- INSUFFICIENT_BASIS_TO_JUDGE fails to UNASSESSED/NULL when the user lacks
-- enough relevant experience - never zero and never low trust.
--
-- This migration also establishes the minimal reusable owned RELATIONSHIP
-- measurement-target substrate: him_measurement_targets is generalized by
-- explicit union (GOAL/SITUATION plus RELATIONSHIP) with unchanged
-- ownership, immutability, and provenance semantics. A RELATIONSHIP target
-- is a private, user-owned HIM measurement context artifact identifying one
-- relationship for measurement purposes only - never a social graph,
-- contact record, other-user link, mutual relationship object, or verified
-- real-world identity. Substrate changes are explicit-union only, exactly
-- as 0040/0041/0042 did: the per-family response vocabulary, observation
-- contract, binding contract, binding-validation function, and current
-- structured read gain exactly the Relationship Trust branches. The five
-- HSE metrics and the four HBS metrics remain semantically unchanged, and
-- migrations 0001-0042 remain byte-exact unchanged.

BEGIN;

-- 1. Minimal reusable RELATIONSHIP measurement-target substrate: the owned
--    target table gains exactly the RELATIONSHIP kind by explicit union.
--    Ownership, the trimmed 1-256 label rule, immutability, and canonical
--    provenance are untouched, and existing GOAL/SITUATION target creation
--    behavior (the Motivation-named RPC) remains byte-identical: it still
--    rejects RELATIONSHIP.
ALTER TABLE public.him_measurement_targets DROP CONSTRAINT him_measurement_targets_context_kind_check;
ALTER TABLE public.him_measurement_targets ADD CONSTRAINT him_measurement_targets_context_kind_check CHECK(context_kind=ANY(ARRAY['GOAL','SITUATION','RELATIONSHIP']));

-- 2. Measurement-event context authority gains exactly RELATIONSHIP by
--    explicit union over the 0014 kinds.
ALTER TABLE public.him_measurement_events DROP CONSTRAINT him_measurement_event_context_kind_check;
ALTER TABLE public.him_measurement_events ADD CONSTRAINT him_measurement_event_context_kind_check CHECK(context_kind=ANY(ARRAY['CONVERSATION_SESSION','GOAL','SITUATION','DECISION','RELATIONSHIP']));

-- 3. Response vocabulary stays an explicit per-family union: the exact HSE,
--    Avoidance, Consistency, Initiative, and Reflection vocabularies are
--    preserved byte-for-byte and exactly one Relationship Trust reliance
--    vocabulary is added. TOO_CONTEXT_DEPENDENT_TO_RATE and
--    INSUFFICIENT_BASIS_TO_JUDGE belong to Relationship Trust only - never
--    a permissive "any text" or shared-code check.
ALTER TABLE public.him_measurement_observations DROP CONSTRAINT him_structured_response_vocabulary_check;
ALTER TABLE public.him_measurement_observations ADD CONSTRAINT him_structured_response_vocabulary_check CHECK(
 (metric_key=ANY(ARRAY['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress']) AND response_code=ANY(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NOT_SURE']))
 OR
 (metric_key='hbs.avoidance' AND response_code=ANY(ARRAY['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_OPPORTUNITY','NOT_SURE']))
 OR
 (metric_key='hbs.consistency' AND response_code=ANY(ARRAY['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','INSUFFICIENT_REPEATED_OPPORTUNITIES','NOT_SURE']))
 OR
 (metric_key='hbs.initiative' AND response_code=ANY(ARRAY['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_SELF_OWNED_OPPORTUNITY','NOT_SURE']))
 OR
 (metric_key='hbs.reflection' AND response_code=ANY(ARRAY['NOT_AT_ALL','A_LITTLE','SOMEWHAT','QUITE_A_BIT','A_GREAT_DEAL','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NOT_SURE']))
 OR
 (metric_key='hrs.relationship-trust' AND response_code=ANY(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_CONTEXT_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE']))
);

-- 4. Structured observation contract: the exact 0042 union plus exactly one
--    Relationship Trust RELATIONSHIP branch with the exact server-derived
--    owned-target shape (bounded trimmed label, target kind equal to the
--    RELATIONSHIP context kind, target ID equal to the context ID).
ALTER TABLE public.him_measurement_observations DROP CONSTRAINT him_structured_observation_contract;
ALTER TABLE public.him_measurement_observations ADD CONSTRAINT him_structured_observation_contract CHECK(
 (metric_key='hse.energy' AND definition_version=1 AND context_kind='CONVERSATION_SESSION' AND instrument_id='hse.energy.ar-eg.right-now' AND instrument_version=1 AND scale_contract_reference='hse.energy.ordinal-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HSE_ENERGY_MEASUREMENT_V1' AND target_label IS NULL AND target_context_kind IS NULL AND target_context_id IS NULL)
 OR (metric_key='hse.motivation' AND definition_version=1 AND context_kind=ANY(ARRAY['GOAL','SITUATION']) AND instrument_id='hse.motivation.direct-self-report' AND instrument_version=1 AND scale_contract_reference='hse.motivation.ordinal-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HSE_MOTIVATION_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
 OR (metric_key='hse.attention' AND definition_version=1 AND context_kind='CONVERSATION_SESSION' AND instrument_id='hse.attention.direct-self-report' AND instrument_version=1 AND scale_contract_reference='hse.attention.ordinal-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HSE_ATTENTION_MEASUREMENT_V1' AND target_label IS NULL AND target_context_kind IS NULL AND target_context_id IS NULL)
 OR (metric_key='hse.attention' AND definition_version=1 AND context_kind=ANY(ARRAY['SITUATION','DECISION']) AND instrument_id='hse.attention.direct-self-report' AND instrument_version=1 AND scale_contract_reference='hse.attention.ordinal-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HSE_ATTENTION_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
 OR (metric_key='hse.self-confidence' AND definition_version=1 AND context_kind=ANY(ARRAY['SITUATION','DECISION']) AND instrument_id='hse.self-confidence.direct-self-report' AND instrument_version=1 AND scale_contract_reference='hse.self-confidence.ordinal-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HSE_SELF_CONFIDENCE_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
 OR (metric_key='hse.stress' AND definition_version=1 AND context_kind='CONVERSATION_SESSION' AND instrument_id='hse.stress.direct-self-report' AND instrument_version=1 AND scale_contract_reference='hse.stress.ordinal-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HSE_STRESS_MEASUREMENT_V1' AND target_label IS NULL AND target_context_kind IS NULL AND target_context_id IS NULL)
 OR (metric_key='hse.stress' AND definition_version=1 AND context_kind='SITUATION' AND instrument_id='hse.stress.direct-self-report' AND instrument_version=1 AND scale_contract_reference='hse.stress.ordinal-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HSE_STRESS_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
 OR (metric_key='hbs.avoidance' AND definition_version=1 AND context_kind=ANY(ARRAY['GOAL','SITUATION']) AND instrument_id='hbs.avoidance.direct-target-bound-seven-day-report' AND instrument_version=1 AND scale_contract_reference='hbs.avoidance.frequency-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HBS_AVOIDANCE_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
 OR (metric_key='hbs.consistency' AND definition_version=1 AND context_kind=ANY(ARRAY['GOAL','SITUATION']) AND instrument_id='hbs.consistency.direct-target-bound-seven-day-report' AND instrument_version=1 AND scale_contract_reference='hbs.consistency.frequency-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HBS_CONSISTENCY_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
 OR (metric_key='hbs.initiative' AND definition_version=1 AND context_kind=ANY(ARRAY['GOAL','SITUATION']) AND instrument_id='hbs.initiative.direct-target-bound-seven-day-report' AND instrument_version=1 AND scale_contract_reference='hbs.initiative.frequency-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HBS_INITIATIVE_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
 OR (metric_key='hbs.reflection' AND definition_version=1 AND context_kind='CONVERSATION_SESSION' AND instrument_id='hbs.reflection.direct-context-bound-reflective-engagement-report' AND instrument_version=1 AND scale_contract_reference='hbs.reflection.engagement-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HBS_REFLECTION_MEASUREMENT_V1' AND target_label IS NULL AND target_context_kind IS NULL AND target_context_id IS NULL)
 OR (metric_key='hbs.reflection' AND definition_version=1 AND context_kind='SITUATION' AND instrument_id='hbs.reflection.direct-context-bound-reflective-engagement-report' AND instrument_version=1 AND scale_contract_reference='hbs.reflection.engagement-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HBS_REFLECTION_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
 OR (metric_key='hrs.relationship-trust' AND definition_version=1 AND context_kind='RELATIONSHIP' AND instrument_id='hrs.relationship-trust.direct-relationship-bound-reliance-report' AND instrument_version=1 AND scale_contract_reference='hrs.relationship-trust.reliance-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HRS_RELATIONSHIP_TRUST_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
);

-- 5. Structured binding contract: the exact 0042 union plus exactly one
--    Relationship Trust RELATIONSHIP binding branch.
ALTER TABLE public.him_canonical_model_bindings DROP CONSTRAINT him_structured_binding_contract;
ALTER TABLE public.him_canonical_model_bindings ADD CONSTRAINT him_structured_binding_contract CHECK(
 (metric_key='hse.energy' AND definition_version=1 AND context_kind='CONVERSATION_SESSION' AND instrument_id='hse.energy.ar-eg.right-now' AND instrument_version=1 AND scale_contract_reference='hse.energy.ordinal-5.v1' AND scale_version=1)
 OR (metric_key='hse.motivation' AND definition_version=1 AND context_kind=ANY(ARRAY['GOAL','SITUATION']) AND instrument_id='hse.motivation.direct-self-report' AND instrument_version=1 AND scale_contract_reference='hse.motivation.ordinal-5.v1' AND scale_version=1)
 OR (metric_key='hse.attention' AND definition_version=1 AND context_kind=ANY(ARRAY['SITUATION','CONVERSATION_SESSION','DECISION']) AND instrument_id='hse.attention.direct-self-report' AND instrument_version=1 AND scale_contract_reference='hse.attention.ordinal-5.v1' AND scale_version=1)
 OR (metric_key='hse.self-confidence' AND definition_version=1 AND context_kind=ANY(ARRAY['SITUATION','DECISION']) AND instrument_id='hse.self-confidence.direct-self-report' AND instrument_version=1 AND scale_contract_reference='hse.self-confidence.ordinal-5.v1' AND scale_version=1)
 OR (metric_key='hse.stress' AND definition_version=1 AND context_kind=ANY(ARRAY['SITUATION','CONVERSATION_SESSION']) AND instrument_id='hse.stress.direct-self-report' AND instrument_version=1 AND scale_contract_reference='hse.stress.ordinal-5.v1' AND scale_version=1)
 OR (metric_key='hbs.avoidance' AND definition_version=1 AND context_kind=ANY(ARRAY['GOAL','SITUATION']) AND instrument_id='hbs.avoidance.direct-target-bound-seven-day-report' AND instrument_version=1 AND scale_contract_reference='hbs.avoidance.frequency-5.v1' AND scale_version=1)
 OR (metric_key='hbs.consistency' AND definition_version=1 AND context_kind=ANY(ARRAY['GOAL','SITUATION']) AND instrument_id='hbs.consistency.direct-target-bound-seven-day-report' AND instrument_version=1 AND scale_contract_reference='hbs.consistency.frequency-5.v1' AND scale_version=1)
 OR (metric_key='hbs.initiative' AND definition_version=1 AND context_kind=ANY(ARRAY['GOAL','SITUATION']) AND instrument_id='hbs.initiative.direct-target-bound-seven-day-report' AND instrument_version=1 AND scale_contract_reference='hbs.initiative.frequency-5.v1' AND scale_version=1)
 OR (metric_key='hbs.reflection' AND definition_version=1 AND context_kind=ANY(ARRAY['SITUATION','CONVERSATION_SESSION']) AND instrument_id='hbs.reflection.direct-context-bound-reflective-engagement-report' AND instrument_version=1 AND scale_contract_reference='hbs.reflection.engagement-5.v1' AND scale_version=1)
 OR (metric_key='hrs.relationship-trust' AND definition_version=1 AND context_kind='RELATIONSHIP' AND instrument_id='hrs.relationship-trust.direct-relationship-bound-reliance-report' AND instrument_version=1 AND scale_contract_reference='hrs.relationship-trust.reliance-5.v1' AND scale_version=1)
);

-- 6. Governance artifacts: one ordinal reliance scale, one calibrated
--    production model, one exactly-ten-basis approval, and exactly the one
--    ACTIVE RELATIONSHIP binding. No founder questionnaire, external
--    validation, or clinical validation is claimed.
INSERT INTO public.him_scale_contracts VALUES('43000000-0000-4000-8000-000000000001','hrs.relationship-trust.reliance-5.v1',1,'ORDINAL',true,false,false,ARRAY[1,2,3,4,5],'{"VERY_LOW":1,"LOW":2,"MODERATE":3,"HIGH":4,"VERY_HIGH":5}'::jsonb,'2026-08-27T00:00:00Z');
INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at)
VALUES('43000000-0000-4000-8000-000000000002','hrs.relationship-trust.direct-structured-current-reliance',1,'hrs.relationship-trust',1,'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE','HIM_EXPANSION_HRS_RELATIONSHIP_TRUST_MEASUREMENT_MODEL_V1','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT','hrs.relationship-trust.reliance-5.v1','{"required":["measurementObservation","relationshipTarget"]}'::jsonb,'FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',ARRAY['RELATIONSHIP'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','hrs-relationship-trust-direct-structured-relationship-bound-v1','2026-08-27T00:00:00Z','2026-08-27T00:00:00Z');
INSERT INTO public.him_governance_approvals(id,approval_id,approval_version,authority_id,authority_version,model_id,model_version,approval_basis,external_validation_claimed,approved_at,canonical_source)
VALUES('43000000-0000-4000-8000-000000000003','qandeel.him.relationship-trust.foundation-approval',1,'QANDEEL_FOUNDATION_GOVERNANCE',1,'hrs.relationship-trust.direct-structured-current-reliance',1,'["HRS_RELATIONSHIP_TRUST_CURRENT_RELIANCE_UNDER_VULNERABILITY","DIRECT_STRUCTURED_REPORT","RELATIONSHIP_BOUND_ONLY","EXPERIENCE_GROUNDED_CURRENT_APPRAISAL","ORDINAL_RELIANCE_5","DOMAIN_DEPENDENCE_AND_INSUFFICIENT_BASIS_FAIL_TO_UNASSESSED","TRUST_NOT_EMOTIONAL_SAFETY_COMMUNICATION_REPAIR_OR_OBJECTIVE_TRUSTWORTHINESS","DETERMINISTIC_CALCULATION","CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY","SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM"]'::jsonb,false,'2026-08-27T00:00:00Z','HIM_EXPANSION_HRS_RELATIONSHIP_TRUST_CANONICAL_APPROVAL');
ALTER TABLE public.him_canonical_model_bindings DISABLE TRIGGER him_energy_binding_validate;
INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES
('43000000-0000-4000-8000-000000000004','hrs.relationship-trust',1,'RELATIONSHIP',1,'ACTIVE','hrs.relationship-trust.direct-structured-current-reliance',1,'hrs.relationship-trust.direct-relationship-bound-reliance-report',1,'hrs.relationship-trust.reliance-5.v1',1,'qandeel.him.relationship-trust.foundation-approval',1,'2026-08-27T00:00:00Z');

-- 7. Definition activation: exactly the Relationship Trust definition moves
--    from UNCALIBRATED to CALIBRATED while its Foundation semantic mapping
--    deliberately stays UNRESOLVED/NULL (no RELATIONSHIP or TRUST semantic
--    type exists, and no STATE/TRAIT/READINESS/CAPABILITY mapping is made).
--    No dependency edges or consumers appear, and no other definition
--    changes.
UPDATE public.him_metric_definitions SET calculation_status='CALIBRATED',scale_reference='hrs.relationship-trust.reliance-5.v1',required_input_contract='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT_V1' WHERE metric_key='hrs.relationship-trust' AND definition_version=1;

CREATE OR REPLACE FUNCTION public.validate_him_canonical_binding() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$DECLARE m public.him_calculation_models;a public.him_governance_approvals;BEGIN SELECT * INTO m FROM public.him_calculation_models WHERE model_id=NEW.model_id AND model_version=NEW.model_version;SELECT * INTO a FROM public.him_governance_approvals WHERE approval_id=NEW.approval_id AND approval_version=NEW.approval_version;IF a.id IS NULL OR a.model_id<>NEW.model_id OR a.model_version<>NEW.model_version THEN RAISE EXCEPTION 'Canonical binding approval does not approve its exact model version' USING ERRCODE='23514';END IF;IF m.id IS NULL OR m.lifecycle<>'CALIBRATED' OR m.environment<>'PRODUCTION' OR m.target_metric_key<>NEW.metric_key OR m.target_definition_version<>NEW.definition_version OR NOT(NEW.context_kind=ANY(m.supported_context_kinds)) OR m.scale_contract_reference<>NEW.scale_contract_reference THEN RAISE EXCEPTION 'Canonical binding model lifecycle, environment, metric, definition, context, or scale mismatch' USING ERRCODE='23514';END IF;IF NOT((NEW.metric_key='hse.energy' AND NEW.context_kind='CONVERSATION_SESSION' AND NEW.instrument_id='hse.energy.ar-eg.right-now' AND NEW.scale_contract_reference='hse.energy.ordinal-5.v1') OR (NEW.metric_key='hse.motivation' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hse.motivation.direct-self-report' AND NEW.scale_contract_reference='hse.motivation.ordinal-5.v1') OR (NEW.metric_key='hse.attention' AND NEW.context_kind=ANY(ARRAY['SITUATION','CONVERSATION_SESSION','DECISION']) AND NEW.instrument_id='hse.attention.direct-self-report' AND NEW.scale_contract_reference='hse.attention.ordinal-5.v1') OR (NEW.metric_key='hse.self-confidence' AND NEW.context_kind=ANY(ARRAY['SITUATION','DECISION']) AND NEW.instrument_id='hse.self-confidence.direct-self-report' AND NEW.scale_contract_reference='hse.self-confidence.ordinal-5.v1') OR (NEW.metric_key='hse.stress' AND NEW.context_kind=ANY(ARRAY['SITUATION','CONVERSATION_SESSION']) AND NEW.instrument_id='hse.stress.direct-self-report' AND NEW.scale_contract_reference='hse.stress.ordinal-5.v1') OR (NEW.metric_key='hbs.avoidance' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hbs.avoidance.direct-target-bound-seven-day-report' AND NEW.scale_contract_reference='hbs.avoidance.frequency-5.v1') OR (NEW.metric_key='hbs.consistency' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hbs.consistency.direct-target-bound-seven-day-report' AND NEW.scale_contract_reference='hbs.consistency.frequency-5.v1') OR (NEW.metric_key='hbs.initiative' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hbs.initiative.direct-target-bound-seven-day-report' AND NEW.scale_contract_reference='hbs.initiative.frequency-5.v1') OR (NEW.metric_key='hbs.reflection' AND NEW.context_kind=ANY(ARRAY['SITUATION','CONVERSATION_SESSION']) AND NEW.instrument_id='hbs.reflection.direct-context-bound-reflective-engagement-report' AND NEW.scale_contract_reference='hbs.reflection.engagement-5.v1') OR (NEW.metric_key='hrs.relationship-trust' AND NEW.context_kind='RELATIONSHIP' AND NEW.instrument_id='hrs.relationship-trust.direct-relationship-bound-reliance-report' AND NEW.scale_contract_reference='hrs.relationship-trust.reliance-5.v1')) OR NEW.definition_version<>1 OR NEW.instrument_version<>1 OR NEW.scale_version<>1 THEN RAISE EXCEPTION 'Canonical binding instrument or scale contract mismatch' USING ERRCODE='23514';END IF;IF(NEW.status='RETIRED')<>(NEW.retired_at IS NOT NULL)THEN RAISE EXCEPTION 'Canonical binding retirement state is inconsistent' USING ERRCODE='23514';END IF;RETURN NEW;END$$;
ALTER TABLE public.him_canonical_model_bindings ENABLE TRIGGER him_energy_binding_validate;

-- 8. Narrow authenticated RELATIONSHIP target creation. The caller supplies
--    only a bounded trimmed display label; the server derives the owner,
--    the RELATIONSHIP context kind, the UUID, canonical provenance, and the
--    created time. The historical Motivation-named target RPC is not
--    broadened and still rejects RELATIONSHIP.
CREATE FUNCTION public.create_him_relationship_measurement_target_v1(p_display_text text) RETURNS public.him_measurement_targets LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE u uuid:=auth.uid();t public.him_measurement_targets;BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 IF p_display_text IS NULL OR length(p_display_text) NOT BETWEEN 1 AND 256 OR p_display_text<>btrim(p_display_text) THEN RAISE EXCEPTION 'Invalid RELATIONSHIP measurement target' USING ERRCODE='22023';END IF;
 INSERT INTO public.him_measurement_targets(id,user_id,context_kind,display_text,canonical_provenance) VALUES(gen_random_uuid(),u,'RELATIONSHIP',p_display_text,'QANDEEL_HIM_MEASUREMENT_TARGET_V1') RETURNING * INTO t;RETURN t;END$$;

-- 9. Narrow authenticated Relationship Trust measurement authority. The
--    caller supplies only an owned RELATIONSHIP target and a response; the
--    server derives identity, the RELATIONSHIP context, the label, the
--    event, and the canonical report time. The measurement event carries a
--    NULL temporal window pair: Relationship Trust is an at-report
--    relationship-bound appraisal, never a period measure. Client
--    timestamps stay untrusted diagnostics. The dedicated functions never
--    touch the shared HSE helpers or any sibling HBS/HRS function.
CREATE FUNCTION public.create_hrs_relationship_trust_measurement_v1(p_target_context_id uuid,p_response_code text,p_client_reported_at_untrusted timestamptz) RETURNS public.him_measurement_observations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$DECLARE u uuid:=auth.uid();e uuid:=gen_random_uuid();canonical_now timestamptz:=clock_timestamp();target public.him_measurement_targets;o public.him_measurement_observations;BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 SELECT * INTO target FROM public.him_measurement_targets WHERE id=p_target_context_id AND user_id=u AND context_kind='RELATIONSHIP';
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown, cross-user, or unsupported Relationship Trust RELATIONSHIP target' USING ERRCODE='42501';END IF;
 IF p_response_code<>ALL(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_CONTEXT_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE']) THEN RAISE EXCEPTION 'Invalid Relationship Trust response' USING ERRCODE='22023';END IF;
 INSERT INTO public.him_measurement_events(id,user_id,context_kind,context_id,created_at)VALUES(e,u,target.context_kind,target.id::text,canonical_now);
 INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,client_reported_at_untrusted,locale,source,canonical_provenance,created_at,target_label,target_context_kind,target_context_id)
 VALUES(gen_random_uuid(),u,e,'hrs.relationship-trust',1,'hrs.relationship-trust.direct-relationship-bound-reliance-report',1,'hrs.relationship-trust.reliance-5.v1',1,target.context_kind,target.id::text,p_response_code,canonical_now,p_client_reported_at_untrusted,'ar-EG','DIRECT_STRUCTURED_USER_REPORT','QANDEEL_HRS_RELATIONSHIP_TRUST_MEASUREMENT_V1',canonical_now,target.display_text,target.context_kind,target.id) RETURNING * INTO o;RETURN o;END$body$;

-- 10. Relationship Trust correction: same measurement event, same exact
--     RELATIONSHIP target (a correction changes the response, never the
--     relationship), same immutable NULL event window, advisory-lock
--     serialized in its own namespace, one correction per observation, and
--     the prior calculated result/current snapshot is superseded through
--     the existing hardened supersession ledger.
CREATE FUNCTION public.correct_hrs_relationship_trust_measurement_v1(p_supersedes_observation_id uuid,p_response_code text,p_client_reported_at_untrusted timestamptz) RETURNS public.him_measurement_observations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$DECLARE u uuid:=auth.uid();canonical_now timestamptz:=clock_timestamp();prior public.him_measurement_observations;o public.him_measurement_observations;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hrs.relationship-trust.observation:'||p_supersedes_observation_id::text,0));
 SELECT * INTO prior FROM public.him_measurement_observations WHERE id=p_supersedes_observation_id AND user_id=u AND metric_key='hrs.relationship-trust';
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.him_measurement_observations WHERE supersedes_observation_id=prior.id) THEN RAISE EXCEPTION 'Unknown, cross-user, cross-metric, or already corrected observation' USING ERRCODE='42501';END IF;
 IF p_response_code<>ALL(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_CONTEXT_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE']) THEN RAISE EXCEPTION 'Invalid Relationship Trust response' USING ERRCODE='22023';END IF;
 INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,client_reported_at_untrusted,locale,source,supersedes_observation_id,canonical_provenance,created_at,target_label,target_context_kind,target_context_id)
 SELECT gen_random_uuid(),user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,p_response_code,canonical_now,p_client_reported_at_untrusted,locale,source,id,canonical_provenance,canonical_now,target_label,target_context_kind,target_context_id FROM public.him_measurement_observations WHERE id=prior.id RETURNING * INTO o;
 INSERT INTO public.him_energy_calculation_supersessions(id,user_id,measurement_event_id,superseded_observation_id,superseding_observation_id,calculation_result_id,snapshot_id,superseded_at,reason)
 SELECT gen_random_uuid(),u,prior.measurement_event_id,prior.id,o.id,r.id,s.id,canonical_now,'EXPLICIT_MEASUREMENT_CORRECTION' FROM public.him_calculation_results r JOIN public.him_metric_snapshots s ON s.calculation_result_id=r.id WHERE r.measurement_observation_id=prior.id;
 RETURN o;END$body$;

-- 11. Deterministic Relationship Trust calculation. Dedicated to
--     hrs.relationship-trust and structurally unable to score any sibling
--     HRS, HBS, or HSE observation: the metric filter, instrument, scale,
--     and binding join are all Relationship-Trust-exact, and no sibling
--     metric, Memory, Evidence, or conversation text is ever read - the
--     relationship target label is verified as an exact server-derived
--     binding artifact, never interpreted semantically. It re-verifies the
--     exact owned RELATIONSHIP target, requires the event window pair to be
--     NULL, resolves the exact ACTIVE binding, and is idempotent for the
--     exact observation+binding pair. The snapshot preserves
--     semantic_mapping_status='UNRESOLVED' with a NULL semantic type,
--     carries a NULL temporal window, and stays confidence-UNASSESSED.
--     TOO_CONTEXT_DEPENDENT_TO_RATE, INSUFFICIENT_BASIS_TO_JUDGE, and
--     NOT_SURE map to UNASSESSED/NULL, never zero and never low trust.
CREATE FUNCTION public.calculate_hrs_relationship_trust_measurement_v1(p_observation_id uuid) RETURNS public.him_metric_snapshots LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$DECLARE u uuid:=auth.uid();o public.him_measurement_observations;e public.him_measurement_events;b public.him_canonical_model_bindings;r public.him_calculation_results;score double precision;state text;next_version integer;s public.him_metric_snapshots;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hrs.relationship-trust.observation:'||p_observation_id::text,0));
 SELECT * INTO o FROM public.him_measurement_observations WHERE id=p_observation_id AND user_id=u AND metric_key='hrs.relationship-trust';
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.him_measurement_observations x WHERE x.supersedes_observation_id=o.id) THEN RAISE EXCEPTION 'Unknown, cross-user, cross-metric, or superseded Relationship Trust observation' USING ERRCODE='42501';END IF;
 IF NOT(o.context_kind='RELATIONSHIP' AND o.target_context_kind=o.context_kind AND o.target_context_id::text=o.context_id AND EXISTS(SELECT 1 FROM public.him_measurement_targets t WHERE t.id=o.target_context_id AND t.user_id=o.user_id AND t.context_kind='RELATIONSHIP' AND t.display_text=o.target_label)) THEN RAISE EXCEPTION 'Relationship Trust target/context mismatch' USING ERRCODE='22023';END IF;
 SELECT * INTO e FROM public.him_measurement_events WHERE id=o.measurement_event_id AND user_id=o.user_id;
 IF e.id IS NULL OR e.observation_window_start IS NOT NULL OR e.observation_window_end IS NOT NULL THEN RAISE EXCEPTION 'Relationship Trust observation window must remain NULL' USING ERRCODE='22023';END IF;
 SELECT cb.* INTO b FROM public.him_canonical_model_bindings cb JOIN public.him_calculation_models m ON(m.model_id,m.model_version)=(cb.model_id,cb.model_version) JOIN public.him_governance_approvals a ON(a.approval_id,a.approval_version)=(cb.approval_id,cb.approval_version) WHERE cb.metric_key=o.metric_key AND cb.definition_version=o.definition_version AND cb.context_kind=o.context_kind AND cb.status='ACTIVE' AND m.lifecycle='CALIBRATED' AND m.environment='PRODUCTION' AND (a.model_id,a.model_version)=(m.model_id,m.model_version) AND cb.instrument_id=o.instrument_id AND cb.instrument_version=o.instrument_version AND cb.scale_contract_reference=o.scale_contract_reference AND cb.scale_version=o.scale_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'No exact active canonical Relationship Trust binding' USING ERRCODE='22023';END IF;
 SELECT s0.* INTO s FROM public.him_metric_snapshots s0 JOIN public.him_calculation_results r0 ON r0.id=s0.calculation_result_id WHERE r0.measurement_observation_id=o.id AND r0.canonical_binding_id=b.id;IF FOUND THEN RETURN s;END IF;
 score:=CASE o.response_code WHEN 'VERY_LOW' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'HIGH' THEN 4 WHEN 'VERY_HIGH' THEN 5 ELSE NULL END;state:=CASE WHEN score IS NULL THEN 'UNASSESSED' ELSE 'ASSESSED' END;
 INSERT INTO public.him_calculation_results(id,user_id,metric_key,definition_version,model_id,model_version,context_kind,context_id,result_state,numeric_value,missing_input_keys,contradiction_state,supporting_evidence_refs,contradictory_evidence_refs,provenance,confidence_state,confidence_reference,trace_id,update_reason,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version)
 VALUES(gen_random_uuid(),u,o.metric_key,o.definition_version,b.model_id,b.model_version,o.context_kind,o.context_id,state,score,CASE WHEN score IS NULL THEN ARRAY['scoredResponse'] ELSE ARRAY[]::text[] END,'NONE',ARRAY['measurement-observation:'||o.id::text],ARRAY[]::text[],'QANDEEL_HIM_CALCULATION_RUNTIME_V1','UNASSESSED',NULL,gen_random_uuid()::text,'DIRECT_STRUCTURED_USER_REPORT',o.measurement_event_id,o.id,b.id,o.scale_contract_reference,o.scale_version) RETURNING * INTO r;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||o.metric_key||o.context_kind||o.context_id,0));SELECT coalesce(max(snapshot_version),0)+1 INTO next_version FROM public.him_metric_snapshots WHERE user_id=u AND metric_key=o.metric_key AND context_kind=o.context_kind AND context_id=o.context_id;
 INSERT INTO public.him_metric_snapshots(id,user_id,metric_key,definition_version,semantic_mapping_status,semantic_type,value_state,numeric_value,confidence_state,confidence_reference,supporting_evidence_ids,contradicting_evidence_ids,source_engines,context_kind,context_id,scope,observed_at,validity_status,snapshot_version,descriptive_update_reason,descriptive_update_reference_ids,canonical_provenance,created_at,calculation_result_id,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version)
 VALUES(gen_random_uuid(),u,o.metric_key,o.definition_version,'UNRESOLVED',NULL,state,score,'UNASSESSED',NULL,ARRAY[]::text[],ARRAY[]::text[],ARRAY['QANDEEL_HIM_RUNTIME'],o.context_kind,o.context_id,'exact measurement event',o.reported_at,'VALID',next_version,'DIRECT_STRUCTURED_USER_REPORT',ARRAY[]::text[],'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',CURRENT_TIMESTAMP,r.id,o.measurement_event_id,o.id,b.id,o.scale_contract_reference,o.scale_version) RETURNING * INTO s;RETURN s;END$body$;

-- 12. Current structured read: the supersession-aware view now also carries
--     hrs.relationship-trust so explicit corrections can never leave a
--     stale superseded trust value as "latest current". The five HSE routes
--     and the four HBS routes are preserved exactly, and no other HRS
--     metric is routed.
CREATE OR REPLACE VIEW public.him_current_structured_measurements WITH(security_invoker=true)AS SELECT s.* FROM public.him_measurement_observations o JOIN public.him_metric_snapshots s ON s.measurement_observation_id=o.id WHERE o.metric_key=ANY(ARRAY['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust'])AND NOT EXISTS(SELECT 1 FROM public.him_measurement_observations newer WHERE newer.supersedes_observation_id=o.id)AND NOT EXISTS(SELECT 1 FROM public.him_energy_calculation_supersessions x WHERE x.snapshot_id=s.id);

REVOKE ALL ON FUNCTION public.create_him_relationship_measurement_target_v1(text),public.create_hrs_relationship_trust_measurement_v1(uuid,text,timestamptz),public.correct_hrs_relationship_trust_measurement_v1(uuid,text,timestamptz),public.calculate_hrs_relationship_trust_measurement_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_him_relationship_measurement_target_v1(text),public.create_hrs_relationship_trust_measurement_v1(uuid,text,timestamptz),public.correct_hrs_relationship_trust_measurement_v1(uuid,text,timestamptz),public.calculate_hrs_relationship_trust_measurement_v1(uuid) TO authenticated;

-- 13. One-time migration-phase inventory invariant: exactly ten calibrated
--     (five HSE plus the four HBS metrics plus hrs.relationship-trust),
--     exactly seven uncalibrated, Relationship Trust keeps HRS ownership
--     with an unresolved NULL semantic mapping, its exact scale and input
--     contract, and no dependency edges or consumers, the prior HSE/HBS
--     metrics remain calibrated and semantically unchanged, and the other
--     three HRS metrics and all four HGS metrics remain uncalibrated. This
--     10/7 phase check runs at migration time only - historical verifiers
--     must never freeze it as a permanent ceiling. The
--     temporal-comparability source (0017) and Intelligence Snapshot v1
--     (0018) are untouched by this migration: hrs.relationship-trust is
--     deliberately NOT ELIGIBLE for either in v1.
DO $$BEGIN
 IF (SELECT count(*) FROM public.him_metric_definitions WHERE calculation_status='CALIBRATED')<>10
  OR (SELECT count(*) FROM public.him_metric_definitions WHERE calculation_status='UNCALIBRATED')<>7
  OR NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hrs.relationship-trust' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HRS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL AND scale_reference='hrs.relationship-trust.reliance-5.v1' AND required_input_contract='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT_V1' AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  OR NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hbs.avoidance' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HBS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL AND scale_reference='hbs.avoidance.frequency-5.v1' AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  OR NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hbs.consistency' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HBS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL AND scale_reference='hbs.consistency.frequency-5.v1' AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  OR NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hbs.initiative' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HBS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL AND scale_reference='hbs.initiative.frequency-5.v1' AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  OR NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hbs.reflection' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HBS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL AND scale_reference='hbs.reflection.engagement-5.v1' AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  OR EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key=ANY(ARRAY['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress']) AND calculation_status<>'CALIBRATED')
  OR EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key=ANY(ARRAY['hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength']) AND calculation_status<>'UNCALIBRATED')
 THEN RAISE EXCEPTION 'Ten calibrated / seven uncalibrated Relationship Trust activation invariant failed';END IF;
END$$;
COMMIT;
