-- HRS Communication + Repair Measurement & Calibration v1 (HIM Expansion
-- metrics 11-12/17 - the second and third HRS metrics, both bound to the
-- reusable owned RELATIONSHIP measurement-target substrate established by
-- 0043).
--
-- Activates exactly two metrics as two fully independent measurement
-- systems that deliberately share one migration only because the owned
-- RELATIONSHIP substrate already exists - the constructs, vocabularies,
-- instruments, scales, models, approvals, bindings, RPC families, and lock
-- namespaces are never shared, and no composite, inverse, or
-- "relationship health" value exists.
--
-- hrs.communication@1 measures relationship-bound current communication
-- workability: based on what the user has actually experienced in one exact
-- relationship, the user's current appraisal of how workable communication
-- is when something important needs to be expressed, heard, clarified, and
-- understood well enough for the exchange to continue constructively,
-- including when the two people do not initially agree. It is dyadic as
-- perceived by the user, never an objective judgment about the other
-- person. It is NOT amount or frequency of talking, sociability,
-- extraversion, verbosity, agreement, absence of conflict, relationship
-- satisfaction, love, closeness, intimacy, affection, hrs.relationship-trust,
-- hrs.repair, hrs.emotional-safety, honesty, objective communication skill,
-- conflict resolution success, persuasion, compliance, compatibility, a
-- clinical construct, a safety verdict, or Recommendation authority. When
-- communication differs sharply by topic, TOO_TOPIC_DEPENDENT_TO_RATE fails
-- to UNASSESSED/NULL instead of collapsing topics into a misleading scalar,
-- and INSUFFICIENT_BASIS_TO_JUDGE fails to UNASSESSED/NULL when too few
-- meaningful exchanges exist - never zero and never poor communication.
--
-- hrs.repair@1 measures relationship-bound current repair effectiveness
-- after meaningful interpersonal rupture: based on repair opportunities the
-- user has actually experienced in one exact relationship, the user's
-- current appraisal of how effectively the relationship can reduce the
-- unresolved impact of hurt, tension, misunderstanding, or conflict and
-- restore workable connection through acknowledgment, clarification,
-- de-escalation, accountability, or corrective action. The core object is
-- repair after a rupture, not whether conflict exists: repair can happen
-- without full agreement, can be partial, and requires no forgiveness -
-- calming down alone and forgetting/avoiding the issue are not
-- automatically repair. It is NOT conflict frequency, absence of conflict,
-- never arguing, generic Communication quality, hrs.relationship-trust,
-- hrs.emotional-safety, forgiveness, reconciliation, staying in the
-- relationship, relationship satisfaction, love, attachment style, moral
-- blame, whether one person apologized, whether the issue was objectively
-- solved, whether the other person is safe, an abuse-risk assessment, a
-- clinical construct, or a stay/leave Recommendation. When the user has
-- experienced no meaningful rupture requiring repair,
-- NO_MEANINGFUL_REPAIR_OPPORTUNITY fails to UNASSESSED/NULL - absence of
-- conflict is never evidence of repair ability and never becomes a high or
-- low score - and TOO_EPISODE_DEPENDENT_TO_RATE fails to UNASSESSED/NULL
-- when episodes repair too differently for one scalar.
--
-- Both metrics are exactly-one-owned-RELATIONSHIP direct structured current
-- at-report appraisals with a NULL temporal window pair (no seven-day HBS
-- period model, no caller-selected window), no provider/LLM call, and no
-- Memory/Evidence/conversation-text inference. Every logically possible
-- combination of Trust, Communication, Repair, and Emotional Safety values
-- stays expressible: high Communication may coexist with low Trust, high
-- Communication with poor Repair, low Communication with high Emotional
-- Safety, and low Trust with strong Repair. Both Foundation semantic
-- mappings deliberately remain UNRESOLVED with NULL semantic types.
--
-- Substrate changes are explicit-union only, exactly as 0040-0043 did: the
-- per-family response vocabulary, observation contract, binding contract,
-- binding-validation function, and current structured read each start from
-- the exact canonical 0043 definition and gain exactly the Communication
-- and Repair branches. The him_measurement_targets and
-- him_measurement_events context-kind unions already carry RELATIONSHIP
-- from 0043 and are untouched. The five HSE metrics, the four HBS metrics,
-- and hrs.relationship-trust remain semantically unchanged,
-- hrs.emotional-safety remains entirely uncalibrated and unobserved, and
-- migrations 0001-0043 remain byte-exact unchanged.

BEGIN;

-- 1. Response vocabulary stays an explicit per-family union: the exact
--    0043 HSE, Avoidance, Consistency, Initiative, Reflection, and
--    Relationship Trust vocabularies are preserved byte-for-byte and
--    exactly one Communication workability vocabulary and one Repair
--    effectiveness vocabulary are added. TOO_TOPIC_DEPENDENT_TO_RATE and
--    INSUFFICIENT_BASIS_TO_JUDGE belong to Communication only;
--    NO_MEANINGFUL_REPAIR_OPPORTUNITY and TOO_EPISODE_DEPENDENT_TO_RATE
--    belong to Repair only - never a permissive "any text" or shared-code
--    check.
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
 OR
 (metric_key='hrs.communication' AND response_code=ANY(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_TOPIC_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE']))
 OR
 (metric_key='hrs.repair' AND response_code=ANY(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_EPISODE_DEPENDENT_TO_RATE','NOT_SURE']))
);

-- 2. Structured observation contract: the exact 0043 union plus exactly one
--    Communication RELATIONSHIP branch and one Repair RELATIONSHIP branch,
--    each with the exact server-derived owned-target shape (bounded trimmed
--    label, target kind equal to the RELATIONSHIP context kind, target ID
--    equal to the context ID).
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
 OR (metric_key='hrs.communication' AND definition_version=1 AND context_kind='RELATIONSHIP' AND instrument_id='hrs.communication.direct-relationship-bound-communication-workability-report' AND instrument_version=1 AND scale_contract_reference='hrs.communication.workability-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HRS_COMMUNICATION_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
 OR (metric_key='hrs.repair' AND definition_version=1 AND context_kind='RELATIONSHIP' AND instrument_id='hrs.repair.direct-relationship-bound-repair-effectiveness-report' AND instrument_version=1 AND scale_contract_reference='hrs.repair.effectiveness-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HRS_REPAIR_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
);

-- 3. Structured binding contract: the exact 0043 union plus exactly one
--    Communication RELATIONSHIP binding branch and one Repair RELATIONSHIP
--    binding branch.
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
 OR (metric_key='hrs.communication' AND definition_version=1 AND context_kind='RELATIONSHIP' AND instrument_id='hrs.communication.direct-relationship-bound-communication-workability-report' AND instrument_version=1 AND scale_contract_reference='hrs.communication.workability-5.v1' AND scale_version=1)
 OR (metric_key='hrs.repair' AND definition_version=1 AND context_kind='RELATIONSHIP' AND instrument_id='hrs.repair.direct-relationship-bound-repair-effectiveness-report' AND instrument_version=1 AND scale_contract_reference='hrs.repair.effectiveness-5.v1' AND scale_version=1)
);

-- 4. Governance artifacts: for EACH metric separately - one ordinal scale,
--    one calibrated production model, one exactly-ten-basis approval, and
--    exactly one ACTIVE RELATIONSHIP binding. Nothing is shared between
--    Communication and Repair even though both use the same 1-5 numeric
--    shape. No founder questionnaire, external validation, or clinical
--    validation is claimed.
INSERT INTO public.him_scale_contracts VALUES('44000000-0000-4000-8000-000000000001','hrs.communication.workability-5.v1',1,'ORDINAL',true,false,false,ARRAY[1,2,3,4,5],'{"VERY_LOW":1,"LOW":2,"MODERATE":3,"HIGH":4,"VERY_HIGH":5}'::jsonb,'2026-08-27T00:00:00Z');
INSERT INTO public.him_scale_contracts VALUES('44000000-0000-4000-8000-000000000005','hrs.repair.effectiveness-5.v1',1,'ORDINAL',true,false,false,ARRAY[1,2,3,4,5],'{"VERY_LOW":1,"LOW":2,"MODERATE":3,"HIGH":4,"VERY_HIGH":5}'::jsonb,'2026-08-27T00:00:00Z');
INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at)
VALUES('44000000-0000-4000-8000-000000000002','hrs.communication.direct-structured-current-communication-workability',1,'hrs.communication',1,'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE','HIM_EXPANSION_HRS_COMMUNICATION_MEASUREMENT_MODEL_V1','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_COMMUNICATION_WORKABILITY_REPORT','hrs.communication.workability-5.v1','{"required":["measurementObservation","relationshipTarget"]}'::jsonb,'FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',ARRAY['RELATIONSHIP'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','hrs-communication-direct-structured-relationship-bound-v1','2026-08-27T00:00:00Z','2026-08-27T00:00:00Z');
INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at)
VALUES('44000000-0000-4000-8000-000000000006','hrs.repair.direct-structured-current-repair-effectiveness',1,'hrs.repair',1,'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE','HIM_EXPANSION_HRS_REPAIR_MEASUREMENT_MODEL_V1','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT','hrs.repair.effectiveness-5.v1','{"required":["measurementObservation","relationshipTarget"]}'::jsonb,'FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',ARRAY['RELATIONSHIP'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','hrs-repair-direct-structured-relationship-bound-v1','2026-08-27T00:00:00Z','2026-08-27T00:00:00Z');
INSERT INTO public.him_governance_approvals(id,approval_id,approval_version,authority_id,authority_version,model_id,model_version,approval_basis,external_validation_claimed,approved_at,canonical_source)
VALUES('44000000-0000-4000-8000-000000000003','qandeel.him.communication.foundation-approval',1,'QANDEEL_FOUNDATION_GOVERNANCE',1,'hrs.communication.direct-structured-current-communication-workability',1,'["HRS_COMMUNICATION_CURRENT_WORKABILITY_OF_IMPORTANT_EXCHANGE","DIRECT_STRUCTURED_REPORT","RELATIONSHIP_BOUND_ONLY","EXPERIENCE_GROUNDED_CURRENT_APPRAISAL_NULL_WINDOW","ORDINAL_WORKABILITY_5","TOPIC_DEPENDENCE_AND_INSUFFICIENT_BASIS_FAIL_TO_UNASSESSED","COMMUNICATION_NOT_TRUST_REPAIR_EMOTIONAL_SAFETY_AGREEMENT_OR_SATISFACTION","DETERMINISTIC_CALCULATION","CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY","SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM"]'::jsonb,false,'2026-08-27T00:00:00Z','HIM_EXPANSION_HRS_COMMUNICATION_CANONICAL_APPROVAL');
INSERT INTO public.him_governance_approvals(id,approval_id,approval_version,authority_id,authority_version,model_id,model_version,approval_basis,external_validation_claimed,approved_at,canonical_source)
VALUES('44000000-0000-4000-8000-000000000007','qandeel.him.repair.foundation-approval',1,'QANDEEL_FOUNDATION_GOVERNANCE',1,'hrs.repair.direct-structured-current-repair-effectiveness',1,'["HRS_REPAIR_CURRENT_EFFECTIVENESS_AFTER_MEANINGFUL_RUPTURE","DIRECT_STRUCTURED_REPORT","RELATIONSHIP_BOUND_ONLY","EXPERIENCE_GROUNDED_CURRENT_APPRAISAL_NULL_WINDOW","ORDINAL_EFFECTIVENESS_5","NO_REPAIR_OPPORTUNITY_AND_EPISODE_DEPENDENCE_FAIL_TO_UNASSESSED","REPAIR_NOT_TRUST_COMMUNICATION_EMOTIONAL_SAFETY_FORGIVENESS_OR_CONFLICT_ABSENCE","DETERMINISTIC_CALCULATION","CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY","SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM"]'::jsonb,false,'2026-08-27T00:00:00Z','HIM_EXPANSION_HRS_REPAIR_CANONICAL_APPROVAL');
ALTER TABLE public.him_canonical_model_bindings DISABLE TRIGGER him_energy_binding_validate;
INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES
('44000000-0000-4000-8000-000000000004','hrs.communication',1,'RELATIONSHIP',1,'ACTIVE','hrs.communication.direct-structured-current-communication-workability',1,'hrs.communication.direct-relationship-bound-communication-workability-report',1,'hrs.communication.workability-5.v1',1,'qandeel.him.communication.foundation-approval',1,'2026-08-27T00:00:00Z');
INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES
('44000000-0000-4000-8000-000000000008','hrs.repair',1,'RELATIONSHIP',1,'ACTIVE','hrs.repair.direct-structured-current-repair-effectiveness',1,'hrs.repair.direct-relationship-bound-repair-effectiveness-report',1,'hrs.repair.effectiveness-5.v1',1,'qandeel.him.repair.foundation-approval',1,'2026-08-27T00:00:00Z');

-- 5. Definition activation: exactly the Communication and Repair
--    definitions move from UNCALIBRATED to CALIBRATED while both Foundation
--    semantic mappings deliberately stay UNRESOLVED/NULL (no RELATIONSHIP,
--    COMMUNICATION, or REPAIR semantic type exists, and no
--    STATE/TRAIT/READINESS/CAPABILITY mapping is made). No dependency edges
--    or consumers appear, and no other definition changes -
--    hrs.relationship-trust and hrs.emotional-safety are untouched.
UPDATE public.him_metric_definitions SET calculation_status='CALIBRATED',scale_reference='hrs.communication.workability-5.v1',required_input_contract='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_COMMUNICATION_WORKABILITY_REPORT_V1' WHERE metric_key='hrs.communication' AND definition_version=1;
UPDATE public.him_metric_definitions SET calculation_status='CALIBRATED',scale_reference='hrs.repair.effectiveness-5.v1',required_input_contract='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT_V1' WHERE metric_key='hrs.repair' AND definition_version=1;

-- 6. Binding validator: the exact 0043 function body plus exactly the
--    Communication and Repair instrument/scale branches. Every historical
--    HSE/HBS/Relationship-Trust branch is preserved byte-for-byte.
CREATE OR REPLACE FUNCTION public.validate_him_canonical_binding() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$DECLARE m public.him_calculation_models;a public.him_governance_approvals;BEGIN SELECT * INTO m FROM public.him_calculation_models WHERE model_id=NEW.model_id AND model_version=NEW.model_version;SELECT * INTO a FROM public.him_governance_approvals WHERE approval_id=NEW.approval_id AND approval_version=NEW.approval_version;IF a.id IS NULL OR a.model_id<>NEW.model_id OR a.model_version<>NEW.model_version THEN RAISE EXCEPTION 'Canonical binding approval does not approve its exact model version' USING ERRCODE='23514';END IF;IF m.id IS NULL OR m.lifecycle<>'CALIBRATED' OR m.environment<>'PRODUCTION' OR m.target_metric_key<>NEW.metric_key OR m.target_definition_version<>NEW.definition_version OR NOT(NEW.context_kind=ANY(m.supported_context_kinds)) OR m.scale_contract_reference<>NEW.scale_contract_reference THEN RAISE EXCEPTION 'Canonical binding model lifecycle, environment, metric, definition, context, or scale mismatch' USING ERRCODE='23514';END IF;IF NOT((NEW.metric_key='hse.energy' AND NEW.context_kind='CONVERSATION_SESSION' AND NEW.instrument_id='hse.energy.ar-eg.right-now' AND NEW.scale_contract_reference='hse.energy.ordinal-5.v1') OR (NEW.metric_key='hse.motivation' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hse.motivation.direct-self-report' AND NEW.scale_contract_reference='hse.motivation.ordinal-5.v1') OR (NEW.metric_key='hse.attention' AND NEW.context_kind=ANY(ARRAY['SITUATION','CONVERSATION_SESSION','DECISION']) AND NEW.instrument_id='hse.attention.direct-self-report' AND NEW.scale_contract_reference='hse.attention.ordinal-5.v1') OR (NEW.metric_key='hse.self-confidence' AND NEW.context_kind=ANY(ARRAY['SITUATION','DECISION']) AND NEW.instrument_id='hse.self-confidence.direct-self-report' AND NEW.scale_contract_reference='hse.self-confidence.ordinal-5.v1') OR (NEW.metric_key='hse.stress' AND NEW.context_kind=ANY(ARRAY['SITUATION','CONVERSATION_SESSION']) AND NEW.instrument_id='hse.stress.direct-self-report' AND NEW.scale_contract_reference='hse.stress.ordinal-5.v1') OR (NEW.metric_key='hbs.avoidance' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hbs.avoidance.direct-target-bound-seven-day-report' AND NEW.scale_contract_reference='hbs.avoidance.frequency-5.v1') OR (NEW.metric_key='hbs.consistency' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hbs.consistency.direct-target-bound-seven-day-report' AND NEW.scale_contract_reference='hbs.consistency.frequency-5.v1') OR (NEW.metric_key='hbs.initiative' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hbs.initiative.direct-target-bound-seven-day-report' AND NEW.scale_contract_reference='hbs.initiative.frequency-5.v1') OR (NEW.metric_key='hbs.reflection' AND NEW.context_kind=ANY(ARRAY['SITUATION','CONVERSATION_SESSION']) AND NEW.instrument_id='hbs.reflection.direct-context-bound-reflective-engagement-report' AND NEW.scale_contract_reference='hbs.reflection.engagement-5.v1') OR (NEW.metric_key='hrs.relationship-trust' AND NEW.context_kind='RELATIONSHIP' AND NEW.instrument_id='hrs.relationship-trust.direct-relationship-bound-reliance-report' AND NEW.scale_contract_reference='hrs.relationship-trust.reliance-5.v1') OR (NEW.metric_key='hrs.communication' AND NEW.context_kind='RELATIONSHIP' AND NEW.instrument_id='hrs.communication.direct-relationship-bound-communication-workability-report' AND NEW.scale_contract_reference='hrs.communication.workability-5.v1') OR (NEW.metric_key='hrs.repair' AND NEW.context_kind='RELATIONSHIP' AND NEW.instrument_id='hrs.repair.direct-relationship-bound-repair-effectiveness-report' AND NEW.scale_contract_reference='hrs.repair.effectiveness-5.v1')) OR NEW.definition_version<>1 OR NEW.instrument_version<>1 OR NEW.scale_version<>1 THEN RAISE EXCEPTION 'Canonical binding instrument or scale contract mismatch' USING ERRCODE='23514';END IF;IF(NEW.status='RETIRED')<>(NEW.retired_at IS NOT NULL)THEN RAISE EXCEPTION 'Canonical binding retirement state is inconsistent' USING ERRCODE='23514';END IF;RETURN NEW;END$$;
ALTER TABLE public.him_canonical_model_bindings ENABLE TRIGGER him_energy_binding_validate;

-- 7. Narrow authenticated Communication measurement authority. The caller
--    supplies only an owned RELATIONSHIP target and a response; the server
--    derives identity, the RELATIONSHIP context, the label, the event, and
--    the canonical report time. The measurement event carries a NULL
--    temporal window pair: Communication is an at-report
--    relationship-bound appraisal, never a period measure. Client
--    timestamps stay untrusted diagnostics. The dedicated functions never
--    touch the shared HSE helpers or any sibling HBS/HRS function, and
--    the existing create_him_relationship_measurement_target_v1 RPC from
--    0043 is reused unchanged - no new target authority exists.
CREATE FUNCTION public.create_hrs_communication_measurement_v1(p_target_context_id uuid,p_response_code text,p_client_reported_at_untrusted timestamptz) RETURNS public.him_measurement_observations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$DECLARE u uuid:=auth.uid();e uuid:=gen_random_uuid();canonical_now timestamptz:=clock_timestamp();target public.him_measurement_targets;o public.him_measurement_observations;BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 SELECT * INTO target FROM public.him_measurement_targets WHERE id=p_target_context_id AND user_id=u AND context_kind='RELATIONSHIP';
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown, cross-user, or unsupported Communication RELATIONSHIP target' USING ERRCODE='42501';END IF;
 IF p_response_code<>ALL(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_TOPIC_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE']) THEN RAISE EXCEPTION 'Invalid Communication response' USING ERRCODE='22023';END IF;
 INSERT INTO public.him_measurement_events(id,user_id,context_kind,context_id,created_at)VALUES(e,u,target.context_kind,target.id::text,canonical_now);
 INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,client_reported_at_untrusted,locale,source,canonical_provenance,created_at,target_label,target_context_kind,target_context_id)
 VALUES(gen_random_uuid(),u,e,'hrs.communication',1,'hrs.communication.direct-relationship-bound-communication-workability-report',1,'hrs.communication.workability-5.v1',1,target.context_kind,target.id::text,p_response_code,canonical_now,p_client_reported_at_untrusted,'ar-EG','DIRECT_STRUCTURED_USER_REPORT','QANDEEL_HRS_COMMUNICATION_MEASUREMENT_V1',canonical_now,target.display_text,target.context_kind,target.id) RETURNING * INTO o;RETURN o;END$body$;

-- 8. Communication correction: same measurement event, same exact
--    RELATIONSHIP target (a correction changes the response, never the
--    relationship), same immutable NULL event window, advisory-lock
--    serialized in the dedicated Communication namespace, one correction
--    per observation, and the prior calculated result/current snapshot is
--    superseded through the existing hardened supersession ledger.
CREATE FUNCTION public.correct_hrs_communication_measurement_v1(p_supersedes_observation_id uuid,p_response_code text,p_client_reported_at_untrusted timestamptz) RETURNS public.him_measurement_observations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$DECLARE u uuid:=auth.uid();canonical_now timestamptz:=clock_timestamp();prior public.him_measurement_observations;o public.him_measurement_observations;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hrs.communication.observation:'||p_supersedes_observation_id::text,0));
 SELECT * INTO prior FROM public.him_measurement_observations WHERE id=p_supersedes_observation_id AND user_id=u AND metric_key='hrs.communication';
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.him_measurement_observations WHERE supersedes_observation_id=prior.id) THEN RAISE EXCEPTION 'Unknown, cross-user, cross-metric, or already corrected observation' USING ERRCODE='42501';END IF;
 IF p_response_code<>ALL(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_TOPIC_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE']) THEN RAISE EXCEPTION 'Invalid Communication response' USING ERRCODE='22023';END IF;
 INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,client_reported_at_untrusted,locale,source,supersedes_observation_id,canonical_provenance,created_at,target_label,target_context_kind,target_context_id)
 SELECT gen_random_uuid(),user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,p_response_code,canonical_now,p_client_reported_at_untrusted,locale,source,id,canonical_provenance,canonical_now,target_label,target_context_kind,target_context_id FROM public.him_measurement_observations WHERE id=prior.id RETURNING * INTO o;
 INSERT INTO public.him_energy_calculation_supersessions(id,user_id,measurement_event_id,superseded_observation_id,superseding_observation_id,calculation_result_id,snapshot_id,superseded_at,reason)
 SELECT gen_random_uuid(),u,prior.measurement_event_id,prior.id,o.id,r.id,s.id,canonical_now,'EXPLICIT_MEASUREMENT_CORRECTION' FROM public.him_calculation_results r JOIN public.him_metric_snapshots s ON s.calculation_result_id=r.id WHERE r.measurement_observation_id=prior.id;
 RETURN o;END$body$;

-- 9. Deterministic Communication calculation. Dedicated to
--    hrs.communication and structurally unable to score any sibling HRS,
--    HBS, or HSE observation: the metric filter, instrument, scale, and
--    binding join are all Communication-exact, and no sibling metric,
--    Memory, Evidence, or conversation text is ever read - the relationship
--    target label is verified as an exact server-derived binding artifact,
--    never interpreted semantically. It re-verifies the exact owned
--    RELATIONSHIP target, requires the event window pair to be NULL,
--    resolves the exact ACTIVE binding, and is idempotent for the exact
--    observation+binding pair. The snapshot preserves
--    semantic_mapping_status='UNRESOLVED' with a NULL semantic type,
--    carries a NULL temporal window, and stays confidence-UNASSESSED.
--    TOO_TOPIC_DEPENDENT_TO_RATE, INSUFFICIENT_BASIS_TO_JUDGE, and NOT_SURE
--    map to UNASSESSED/NULL, never zero and never poor communication.
CREATE FUNCTION public.calculate_hrs_communication_measurement_v1(p_observation_id uuid) RETURNS public.him_metric_snapshots LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$DECLARE u uuid:=auth.uid();o public.him_measurement_observations;e public.him_measurement_events;b public.him_canonical_model_bindings;r public.him_calculation_results;score double precision;state text;next_version integer;s public.him_metric_snapshots;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hrs.communication.observation:'||p_observation_id::text,0));
 SELECT * INTO o FROM public.him_measurement_observations WHERE id=p_observation_id AND user_id=u AND metric_key='hrs.communication';
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.him_measurement_observations x WHERE x.supersedes_observation_id=o.id) THEN RAISE EXCEPTION 'Unknown, cross-user, cross-metric, or superseded Communication observation' USING ERRCODE='42501';END IF;
 IF NOT(o.context_kind='RELATIONSHIP' AND o.target_context_kind=o.context_kind AND o.target_context_id::text=o.context_id AND EXISTS(SELECT 1 FROM public.him_measurement_targets t WHERE t.id=o.target_context_id AND t.user_id=o.user_id AND t.context_kind='RELATIONSHIP' AND t.display_text=o.target_label)) THEN RAISE EXCEPTION 'Communication target/context mismatch' USING ERRCODE='22023';END IF;
 SELECT * INTO e FROM public.him_measurement_events WHERE id=o.measurement_event_id AND user_id=o.user_id;
 IF e.id IS NULL OR e.observation_window_start IS NOT NULL OR e.observation_window_end IS NOT NULL THEN RAISE EXCEPTION 'Communication observation window must remain NULL' USING ERRCODE='22023';END IF;
 SELECT cb.* INTO b FROM public.him_canonical_model_bindings cb JOIN public.him_calculation_models m ON(m.model_id,m.model_version)=(cb.model_id,cb.model_version) JOIN public.him_governance_approvals a ON(a.approval_id,a.approval_version)=(cb.approval_id,cb.approval_version) WHERE cb.metric_key=o.metric_key AND cb.definition_version=o.definition_version AND cb.context_kind=o.context_kind AND cb.status='ACTIVE' AND m.lifecycle='CALIBRATED' AND m.environment='PRODUCTION' AND (a.model_id,a.model_version)=(m.model_id,m.model_version) AND cb.instrument_id=o.instrument_id AND cb.instrument_version=o.instrument_version AND cb.scale_contract_reference=o.scale_contract_reference AND cb.scale_version=o.scale_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'No exact active canonical Communication binding' USING ERRCODE='22023';END IF;
 SELECT s0.* INTO s FROM public.him_metric_snapshots s0 JOIN public.him_calculation_results r0 ON r0.id=s0.calculation_result_id WHERE r0.measurement_observation_id=o.id AND r0.canonical_binding_id=b.id;IF FOUND THEN RETURN s;END IF;
 score:=CASE o.response_code WHEN 'VERY_LOW' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'HIGH' THEN 4 WHEN 'VERY_HIGH' THEN 5 ELSE NULL END;state:=CASE WHEN score IS NULL THEN 'UNASSESSED' ELSE 'ASSESSED' END;
 INSERT INTO public.him_calculation_results(id,user_id,metric_key,definition_version,model_id,model_version,context_kind,context_id,result_state,numeric_value,missing_input_keys,contradiction_state,supporting_evidence_refs,contradictory_evidence_refs,provenance,confidence_state,confidence_reference,trace_id,update_reason,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version)
 VALUES(gen_random_uuid(),u,o.metric_key,o.definition_version,b.model_id,b.model_version,o.context_kind,o.context_id,state,score,CASE WHEN score IS NULL THEN ARRAY['scoredResponse'] ELSE ARRAY[]::text[] END,'NONE',ARRAY['measurement-observation:'||o.id::text],ARRAY[]::text[],'QANDEEL_HIM_CALCULATION_RUNTIME_V1','UNASSESSED',NULL,gen_random_uuid()::text,'DIRECT_STRUCTURED_USER_REPORT',o.measurement_event_id,o.id,b.id,o.scale_contract_reference,o.scale_version) RETURNING * INTO r;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||o.metric_key||o.context_kind||o.context_id,0));SELECT coalesce(max(snapshot_version),0)+1 INTO next_version FROM public.him_metric_snapshots WHERE user_id=u AND metric_key=o.metric_key AND context_kind=o.context_kind AND context_id=o.context_id;
 INSERT INTO public.him_metric_snapshots(id,user_id,metric_key,definition_version,semantic_mapping_status,semantic_type,value_state,numeric_value,confidence_state,confidence_reference,supporting_evidence_ids,contradicting_evidence_ids,source_engines,context_kind,context_id,scope,observed_at,validity_status,snapshot_version,descriptive_update_reason,descriptive_update_reference_ids,canonical_provenance,created_at,calculation_result_id,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version)
 VALUES(gen_random_uuid(),u,o.metric_key,o.definition_version,'UNRESOLVED',NULL,state,score,'UNASSESSED',NULL,ARRAY[]::text[],ARRAY[]::text[],ARRAY['QANDEEL_HIM_RUNTIME'],o.context_kind,o.context_id,'exact measurement event',o.reported_at,'VALID',next_version,'DIRECT_STRUCTURED_USER_REPORT',ARRAY[]::text[],'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',CURRENT_TIMESTAMP,r.id,o.measurement_event_id,o.id,b.id,o.scale_contract_reference,o.scale_version) RETURNING * INTO s;RETURN s;END$body$;

-- 10. Narrow authenticated Repair measurement authority: fully independent
--     of Communication - its own vocabulary, instrument, scale, and
--     provenance. Absence of a repair opportunity is missing basis:
--     NO_MEANINGFUL_REPAIR_OPPORTUNITY is accepted as a response and later
--     fails to UNASSESSED/NULL, never a high score and never a low score.
CREATE FUNCTION public.create_hrs_repair_measurement_v1(p_target_context_id uuid,p_response_code text,p_client_reported_at_untrusted timestamptz) RETURNS public.him_measurement_observations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$DECLARE u uuid:=auth.uid();e uuid:=gen_random_uuid();canonical_now timestamptz:=clock_timestamp();target public.him_measurement_targets;o public.him_measurement_observations;BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 SELECT * INTO target FROM public.him_measurement_targets WHERE id=p_target_context_id AND user_id=u AND context_kind='RELATIONSHIP';
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown, cross-user, or unsupported Repair RELATIONSHIP target' USING ERRCODE='42501';END IF;
 IF p_response_code<>ALL(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_EPISODE_DEPENDENT_TO_RATE','NOT_SURE']) THEN RAISE EXCEPTION 'Invalid Repair response' USING ERRCODE='22023';END IF;
 INSERT INTO public.him_measurement_events(id,user_id,context_kind,context_id,created_at)VALUES(e,u,target.context_kind,target.id::text,canonical_now);
 INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,client_reported_at_untrusted,locale,source,canonical_provenance,created_at,target_label,target_context_kind,target_context_id)
 VALUES(gen_random_uuid(),u,e,'hrs.repair',1,'hrs.repair.direct-relationship-bound-repair-effectiveness-report',1,'hrs.repair.effectiveness-5.v1',1,target.context_kind,target.id::text,p_response_code,canonical_now,p_client_reported_at_untrusted,'ar-EG','DIRECT_STRUCTURED_USER_REPORT','QANDEEL_HRS_REPAIR_MEASUREMENT_V1',canonical_now,target.display_text,target.context_kind,target.id) RETURNING * INTO o;RETURN o;END$body$;

-- 11. Repair correction: same measurement event, same exact RELATIONSHIP
--     target, same immutable NULL event window, advisory-lock serialized in
--     the dedicated Repair namespace, one correction per observation, and
--     supersession through the existing hardened ledger.
CREATE FUNCTION public.correct_hrs_repair_measurement_v1(p_supersedes_observation_id uuid,p_response_code text,p_client_reported_at_untrusted timestamptz) RETURNS public.him_measurement_observations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$DECLARE u uuid:=auth.uid();canonical_now timestamptz:=clock_timestamp();prior public.him_measurement_observations;o public.him_measurement_observations;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hrs.repair.observation:'||p_supersedes_observation_id::text,0));
 SELECT * INTO prior FROM public.him_measurement_observations WHERE id=p_supersedes_observation_id AND user_id=u AND metric_key='hrs.repair';
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.him_measurement_observations WHERE supersedes_observation_id=prior.id) THEN RAISE EXCEPTION 'Unknown, cross-user, cross-metric, or already corrected observation' USING ERRCODE='42501';END IF;
 IF p_response_code<>ALL(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_EPISODE_DEPENDENT_TO_RATE','NOT_SURE']) THEN RAISE EXCEPTION 'Invalid Repair response' USING ERRCODE='22023';END IF;
 INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,client_reported_at_untrusted,locale,source,supersedes_observation_id,canonical_provenance,created_at,target_label,target_context_kind,target_context_id)
 SELECT gen_random_uuid(),user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,p_response_code,canonical_now,p_client_reported_at_untrusted,locale,source,id,canonical_provenance,canonical_now,target_label,target_context_kind,target_context_id FROM public.him_measurement_observations WHERE id=prior.id RETURNING * INTO o;
 INSERT INTO public.him_energy_calculation_supersessions(id,user_id,measurement_event_id,superseded_observation_id,superseding_observation_id,calculation_result_id,snapshot_id,superseded_at,reason)
 SELECT gen_random_uuid(),u,prior.measurement_event_id,prior.id,o.id,r.id,s.id,canonical_now,'EXPLICIT_MEASUREMENT_CORRECTION' FROM public.him_calculation_results r JOIN public.him_metric_snapshots s ON s.calculation_result_id=r.id WHERE r.measurement_observation_id=prior.id;
 RETURN o;END$body$;

-- 12. Deterministic Repair calculation. Dedicated to hrs.repair and
--     structurally unable to score any sibling HRS, HBS, or HSE
--     observation: the metric filter, instrument, scale, and binding join
--     are all Repair-exact, and no sibling metric, Memory, Evidence, or
--     conversation text is ever read - the relationship target label is
--     verified as an exact server-derived binding artifact, never
--     interpreted semantically. NO_MEANINGFUL_REPAIR_OPPORTUNITY,
--     TOO_EPISODE_DEPENDENT_TO_RATE, and NOT_SURE map to UNASSESSED/NULL:
--     the absence of conflict is never converted into a high repair score,
--     and missing repair opportunity is never converted into a low one.
CREATE FUNCTION public.calculate_hrs_repair_measurement_v1(p_observation_id uuid) RETURNS public.him_metric_snapshots LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$DECLARE u uuid:=auth.uid();o public.him_measurement_observations;e public.him_measurement_events;b public.him_canonical_model_bindings;r public.him_calculation_results;score double precision;state text;next_version integer;s public.him_metric_snapshots;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hrs.repair.observation:'||p_observation_id::text,0));
 SELECT * INTO o FROM public.him_measurement_observations WHERE id=p_observation_id AND user_id=u AND metric_key='hrs.repair';
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.him_measurement_observations x WHERE x.supersedes_observation_id=o.id) THEN RAISE EXCEPTION 'Unknown, cross-user, cross-metric, or superseded Repair observation' USING ERRCODE='42501';END IF;
 IF NOT(o.context_kind='RELATIONSHIP' AND o.target_context_kind=o.context_kind AND o.target_context_id::text=o.context_id AND EXISTS(SELECT 1 FROM public.him_measurement_targets t WHERE t.id=o.target_context_id AND t.user_id=o.user_id AND t.context_kind='RELATIONSHIP' AND t.display_text=o.target_label)) THEN RAISE EXCEPTION 'Repair target/context mismatch' USING ERRCODE='22023';END IF;
 SELECT * INTO e FROM public.him_measurement_events WHERE id=o.measurement_event_id AND user_id=o.user_id;
 IF e.id IS NULL OR e.observation_window_start IS NOT NULL OR e.observation_window_end IS NOT NULL THEN RAISE EXCEPTION 'Repair observation window must remain NULL' USING ERRCODE='22023';END IF;
 SELECT cb.* INTO b FROM public.him_canonical_model_bindings cb JOIN public.him_calculation_models m ON(m.model_id,m.model_version)=(cb.model_id,cb.model_version) JOIN public.him_governance_approvals a ON(a.approval_id,a.approval_version)=(cb.approval_id,cb.approval_version) WHERE cb.metric_key=o.metric_key AND cb.definition_version=o.definition_version AND cb.context_kind=o.context_kind AND cb.status='ACTIVE' AND m.lifecycle='CALIBRATED' AND m.environment='PRODUCTION' AND (a.model_id,a.model_version)=(m.model_id,m.model_version) AND cb.instrument_id=o.instrument_id AND cb.instrument_version=o.instrument_version AND cb.scale_contract_reference=o.scale_contract_reference AND cb.scale_version=o.scale_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'No exact active canonical Repair binding' USING ERRCODE='22023';END IF;
 SELECT s0.* INTO s FROM public.him_metric_snapshots s0 JOIN public.him_calculation_results r0 ON r0.id=s0.calculation_result_id WHERE r0.measurement_observation_id=o.id AND r0.canonical_binding_id=b.id;IF FOUND THEN RETURN s;END IF;
 score:=CASE o.response_code WHEN 'VERY_LOW' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'HIGH' THEN 4 WHEN 'VERY_HIGH' THEN 5 ELSE NULL END;state:=CASE WHEN score IS NULL THEN 'UNASSESSED' ELSE 'ASSESSED' END;
 INSERT INTO public.him_calculation_results(id,user_id,metric_key,definition_version,model_id,model_version,context_kind,context_id,result_state,numeric_value,missing_input_keys,contradiction_state,supporting_evidence_refs,contradictory_evidence_refs,provenance,confidence_state,confidence_reference,trace_id,update_reason,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version)
 VALUES(gen_random_uuid(),u,o.metric_key,o.definition_version,b.model_id,b.model_version,o.context_kind,o.context_id,state,score,CASE WHEN score IS NULL THEN ARRAY['scoredResponse'] ELSE ARRAY[]::text[] END,'NONE',ARRAY['measurement-observation:'||o.id::text],ARRAY[]::text[],'QANDEEL_HIM_CALCULATION_RUNTIME_V1','UNASSESSED',NULL,gen_random_uuid()::text,'DIRECT_STRUCTURED_USER_REPORT',o.measurement_event_id,o.id,b.id,o.scale_contract_reference,o.scale_version) RETURNING * INTO r;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||o.metric_key||o.context_kind||o.context_id,0));SELECT coalesce(max(snapshot_version),0)+1 INTO next_version FROM public.him_metric_snapshots WHERE user_id=u AND metric_key=o.metric_key AND context_kind=o.context_kind AND context_id=o.context_id;
 INSERT INTO public.him_metric_snapshots(id,user_id,metric_key,definition_version,semantic_mapping_status,semantic_type,value_state,numeric_value,confidence_state,confidence_reference,supporting_evidence_ids,contradicting_evidence_ids,source_engines,context_kind,context_id,scope,observed_at,validity_status,snapshot_version,descriptive_update_reason,descriptive_update_reference_ids,canonical_provenance,created_at,calculation_result_id,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version)
 VALUES(gen_random_uuid(),u,o.metric_key,o.definition_version,'UNRESOLVED',NULL,state,score,'UNASSESSED',NULL,ARRAY[]::text[],ARRAY[]::text[],ARRAY['QANDEEL_HIM_RUNTIME'],o.context_kind,o.context_id,'exact measurement event',o.reported_at,'VALID',next_version,'DIRECT_STRUCTURED_USER_REPORT',ARRAY[]::text[],'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',CURRENT_TIMESTAMP,r.id,o.measurement_event_id,o.id,b.id,o.scale_contract_reference,o.scale_version) RETURNING * INTO s;RETURN s;END$body$;

-- 13. Current structured read: the supersession-aware view now also carries
--     hrs.communication and hrs.repair so explicit corrections can never
--     leave a stale superseded value as "latest current". The five HSE
--     routes, the four HBS routes, and the Relationship Trust route are
--     preserved exactly, and hrs.emotional-safety is NOT routed - it
--     remains entirely uncalibrated and unobserved.
CREATE OR REPLACE VIEW public.him_current_structured_measurements WITH(security_invoker=true)AS SELECT s.* FROM public.him_measurement_observations o JOIN public.him_metric_snapshots s ON s.measurement_observation_id=o.id WHERE o.metric_key=ANY(ARRAY['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair'])AND NOT EXISTS(SELECT 1 FROM public.him_measurement_observations newer WHERE newer.supersedes_observation_id=o.id)AND NOT EXISTS(SELECT 1 FROM public.him_energy_calculation_supersessions x WHERE x.snapshot_id=s.id);

REVOKE ALL ON FUNCTION public.create_hrs_communication_measurement_v1(uuid,text,timestamptz),public.correct_hrs_communication_measurement_v1(uuid,text,timestamptz),public.calculate_hrs_communication_measurement_v1(uuid),public.create_hrs_repair_measurement_v1(uuid,text,timestamptz),public.correct_hrs_repair_measurement_v1(uuid,text,timestamptz),public.calculate_hrs_repair_measurement_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_hrs_communication_measurement_v1(uuid,text,timestamptz),public.correct_hrs_communication_measurement_v1(uuid,text,timestamptz),public.calculate_hrs_communication_measurement_v1(uuid),public.create_hrs_repair_measurement_v1(uuid,text,timestamptz),public.correct_hrs_repair_measurement_v1(uuid,text,timestamptz),public.calculate_hrs_repair_measurement_v1(uuid) TO authenticated;

-- 14. One-time migration-phase inventory invariant: exactly twelve
--     calibrated (five HSE plus the four HBS metrics plus
--     hrs.relationship-trust, hrs.communication, and hrs.repair), exactly
--     five uncalibrated (hrs.emotional-safety and the four HGS metrics),
--     Communication and Repair each keep HRS ownership with an unresolved
--     NULL semantic mapping, their exact separate scales and input
--     contracts, and no dependency edges or consumers, the prior HSE/HBS
--     metrics and hrs.relationship-trust remain calibrated and semantically
--     unchanged, and hrs.emotional-safety and all four HGS metrics remain
--     uncalibrated. This 12/5 phase check runs at migration time only -
--     historical verifiers must never freeze it as a permanent ceiling, and
--     nothing here asserts that a later migration can never exist. The
--     temporal-comparability source (0017) and Intelligence Snapshot v1
--     (0018) are untouched by this migration: hrs.communication and
--     hrs.repair are deliberately NOT ELIGIBLE for either in v1.
DO $$BEGIN
 IF (SELECT count(*) FROM public.him_metric_definitions WHERE calculation_status='CALIBRATED')<>12
  OR (SELECT count(*) FROM public.him_metric_definitions WHERE calculation_status='UNCALIBRATED')<>5
  OR NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hrs.communication' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HRS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL AND scale_reference='hrs.communication.workability-5.v1' AND required_input_contract='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_COMMUNICATION_WORKABILITY_REPORT_V1' AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  OR NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hrs.repair' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HRS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL AND scale_reference='hrs.repair.effectiveness-5.v1' AND required_input_contract='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT_V1' AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  OR NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hrs.relationship-trust' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HRS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL AND scale_reference='hrs.relationship-trust.reliance-5.v1' AND required_input_contract='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT_V1' AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  OR EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key=ANY(ARRAY['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection']) AND calculation_status<>'CALIBRATED')
  OR EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key=ANY(ARRAY['hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength']) AND calculation_status<>'UNCALIBRATED')
 THEN RAISE EXCEPTION 'Twelve calibrated / five uncalibrated Communication and Repair activation invariant failed';END IF;
END$$;
COMMIT;
