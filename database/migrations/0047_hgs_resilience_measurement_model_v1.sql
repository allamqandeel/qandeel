-- HGS Resilience Measurement & Calibration v1 (HIM Expansion metric 15/17
-- - the second HGS metric, bound to the reusable owned GOAL/SITUATION
-- measurement-target substrate established by 0013/0014 and reused
-- unchanged ever since).
--
-- hgs.resilience@1 measures target-bound current perceived adaptive
-- recovery/continuity under experienced challenge: in one exact GOAL or
-- SITUATION where the user has actually faced meaningful difficulty,
-- setback, disruption, or sustained challenge, how well the user currently
-- judges they have been able to maintain or regain workable functioning and
-- adapt their approach enough to continue engaging with what matters in
-- that context. The core object is adaptive functioning after or during
-- ACTUAL challenge, never hypothetical toughness, and the construct allows
-- both maintaining workable functioning despite challenge and regaining it
-- after disruption - it never requires returning to exactly how things were
-- before, and adaptation may involve changing approach. It is NOT the
-- absence of stress or distress, low hse.stress, emotional numbness,
-- stoicism, "being strong", a toughness identity, optimism, positive mood,
-- hse.motivation, hse.self-confidence, HBS Consistency, Initiative, or
-- Avoidance, Habit Strength, persistence/grit, continuing rigidly at all
-- costs, success of the GOAL, achievement or performance, recovery speed,
-- instant "bouncing back", post-traumatic growth, clinical recovery, a
-- trauma diagnosis/outcome, HRS Repair, a global personality trait, or a
-- prediction of how the user will handle future adversity. A higher score
-- means only greater self-reported current adaptive continuity/recovery in
-- the exact challenged context - never proof of absent pain or distress,
-- healthy coping in every respect, goal success, better character, greater
-- worth, future resilience, or clinical recovery - and a lower score means
-- only greater reported current disruption, never pathology, weakness,
-- failure, or diagnosis.
--
-- Resilience != Low Stress, != Motivation, != Self-Confidence,
-- != Consistency, != Habit Strength, != Grit/Persistence, != Goal Success,
-- != HRS Repair. High Resilience with high Stress stays fully expressible
-- (still distressed, yet maintaining/regaining workable functioning), high
-- Self-Awareness with low Resilience stays fully expressible (clear inside,
-- not yet adapted), and every other independence combination stays
-- expressible - no formula or constraint forces any two metrics to
-- correlate, and no composite, inverse, or derived value exists.
--
-- The measurement basis is ACTUAL challenge experienced in the target:
-- NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE fails to UNASSESSED/NULL when the
-- target has not yet involved meaningful difficulty (no adversity is NOT
-- high resilience), TOO_EARLY_TO_JUDGE_ADAPTATION fails to UNASSESSED/NULL
-- when a setback happened but the user is still in the immediate disruption
-- (not low resilience by default), and TOO_CHALLENGE_DEPENDENT_TO_RATE
-- fails to UNASSESSED/NULL when adaptation differs materially across
-- challenge kinds (challenge types are never averaged and no resilience
-- subdomain exists in v1). No LLM, Memory, Evidence, or conversation
-- analysis may infer that adversity occurred - the user supplies the
-- structured appraisal.
--
-- The metric is an exactly-one-owned-GOAL-or-SITUATION direct structured
-- current at-report appraisal with a NULL temporal window pair (no
-- seven-day period model, no 30-day recovery period, no time-to-recovery,
-- no longitudinal growth trajectory, no before/after delta, no
-- caller-selected window), no provider/LLM call, and no
-- Memory/Evidence/conversation-text inference. The Foundation semantic
-- mapping deliberately remains UNRESOLVED with a NULL semantic type: no
-- CAPABILITY/TRAIT/STATE/PROGRESS/READINESS mapping is forced and no
-- RESILIENCE or GROWTH semantic type is invented.
--
-- Substrate changes are explicit-union only, exactly as 0040-0046 did: the
-- per-family response vocabulary, observation contract, binding contract,
-- binding-validation function, and current structured read each start from
-- the exact canonical 0046 definition and gain exactly the Resilience
-- branch. The him_measurement_targets and him_measurement_events
-- context-kind unions already carry GOAL and SITUATION since 0013/0014 and
-- are untouched. The five HSE metrics, the four HBS metrics, the four HRS
-- metrics, and hgs.self-awareness remain semantically unchanged,
-- hgs.purpose-alignment and hgs.habit-strength remain uncalibrated, and
-- migrations 0001-0046 remain byte-exact unchanged. HGS measurement grants
-- no HGS Runtime Consumption authority.

BEGIN;

-- 1. Response vocabulary stays an explicit per-family union: the exact
--    0046 HSE, Avoidance, Consistency, Initiative, Reflection, Relationship
--    Trust, Communication, Repair, Emotional Safety, and Self-Awareness
--    vocabularies are preserved byte-for-byte and exactly one Resilience
--    adaptive-recovery vocabulary is added.
--    NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE, TOO_EARLY_TO_JUDGE_ADAPTATION,
--    and TOO_CHALLENGE_DEPENDENT_TO_RATE belong to Resilience only - never
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
 OR
 (metric_key='hrs.communication' AND response_code=ANY(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_TOPIC_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE']))
 OR
 (metric_key='hrs.repair' AND response_code=ANY(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_EPISODE_DEPENDENT_TO_RATE','NOT_SURE']))
 OR
 (metric_key='hrs.emotional-safety' AND response_code=ANY(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_VULNERABILITY_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE']))
 OR
 (metric_key='hgs.self-awareness' AND response_code=ANY(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_FACET_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE']))
 OR
 (metric_key='hgs.resilience' AND response_code=ANY(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE','TOO_EARLY_TO_JUDGE_ADAPTATION','TOO_CHALLENGE_DEPENDENT_TO_RATE','NOT_SURE']))
);

-- 2. Structured observation contract: the exact 0046 union plus exactly one
--    Resilience GOAL/SITUATION branch with the exact server-derived
--    owned-target shape (bounded trimmed label, target kind equal to the
--    GOAL or SITUATION context kind, target ID equal to the context ID).
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
 OR (metric_key='hrs.emotional-safety' AND definition_version=1 AND context_kind='RELATIONSHIP' AND instrument_id='hrs.emotional-safety.direct-relationship-bound-emotional-openness-safety-report' AND instrument_version=1 AND scale_contract_reference='hrs.emotional-safety.openness-safety-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HRS_EMOTIONAL_SAFETY_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
 OR (metric_key='hgs.self-awareness' AND definition_version=1 AND context_kind=ANY(ARRAY['GOAL','SITUATION']) AND instrument_id='hgs.self-awareness.direct-target-bound-self-understanding-clarity-report' AND instrument_version=1 AND scale_contract_reference='hgs.self-awareness.clarity-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HGS_SELF_AWARENESS_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
 OR (metric_key='hgs.resilience' AND definition_version=1 AND context_kind=ANY(ARRAY['GOAL','SITUATION']) AND instrument_id='hgs.resilience.direct-target-bound-adaptive-recovery-report' AND instrument_version=1 AND scale_contract_reference='hgs.resilience.adaptive-recovery-5.v1' AND scale_version=1 AND canonical_provenance='QANDEEL_HGS_RESILIENCE_MEASUREMENT_V1' AND length(target_label) BETWEEN 1 AND 256 AND target_label=btrim(target_label) AND target_context_kind=context_kind AND target_context_id::text=context_id)
);

-- 3. Structured binding contract: the exact 0046 union plus exactly one
--    Resilience GOAL/SITUATION binding branch.
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
 OR (metric_key='hrs.emotional-safety' AND definition_version=1 AND context_kind='RELATIONSHIP' AND instrument_id='hrs.emotional-safety.direct-relationship-bound-emotional-openness-safety-report' AND instrument_version=1 AND scale_contract_reference='hrs.emotional-safety.openness-safety-5.v1' AND scale_version=1)
 OR (metric_key='hgs.self-awareness' AND definition_version=1 AND context_kind=ANY(ARRAY['GOAL','SITUATION']) AND instrument_id='hgs.self-awareness.direct-target-bound-self-understanding-clarity-report' AND instrument_version=1 AND scale_contract_reference='hgs.self-awareness.clarity-5.v1' AND scale_version=1)
 OR (metric_key='hgs.resilience' AND definition_version=1 AND context_kind=ANY(ARRAY['GOAL','SITUATION']) AND instrument_id='hgs.resilience.direct-target-bound-adaptive-recovery-report' AND instrument_version=1 AND scale_contract_reference='hgs.resilience.adaptive-recovery-5.v1' AND scale_version=1)
);

-- 4. Governance artifacts: exactly one ordinal scale, one calibrated
--    production model, one exactly-ten-basis approval, and exactly the two
--    ACTIVE GOAL/SITUATION bindings for hgs.resilience. Nothing is shared
--    with Self-Awareness, Stress, Motivation, Self-Confidence, Consistency,
--    or Repair even though the numeric shape is the same 1-5. No founder
--    questionnaire, external validation, clinical validation,
--    trauma-recovery validation, or psychometric-instrument validation is
--    claimed.
INSERT INTO public.him_scale_contracts VALUES('47000000-0000-4000-8000-000000000001','hgs.resilience.adaptive-recovery-5.v1',1,'ORDINAL',true,false,false,ARRAY[1,2,3,4,5],'{"VERY_LOW":1,"LOW":2,"MODERATE":3,"HIGH":4,"VERY_HIGH":5}'::jsonb,'2026-08-27T00:00:00Z');
INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at)
VALUES('47000000-0000-4000-8000-000000000002','hgs.resilience.direct-structured-current-adaptive-recovery',1,'hgs.resilience',1,'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE','HIM_EXPANSION_HGS_RESILIENCE_MEASUREMENT_MODEL_V1','DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_ADAPTIVE_RECOVERY_REPORT','hgs.resilience.adaptive-recovery-5.v1','{"required":["measurementObservation","explicitTarget"]}'::jsonb,'FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',ARRAY['GOAL','SITUATION'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','hgs-resilience-direct-structured-target-bound-v1','2026-08-27T00:00:00Z','2026-08-27T00:00:00Z');
INSERT INTO public.him_governance_approvals(id,approval_id,approval_version,authority_id,authority_version,model_id,model_version,approval_basis,external_validation_claimed,approved_at,canonical_source)
VALUES('47000000-0000-4000-8000-000000000003','qandeel.him.resilience.foundation-approval',1,'QANDEEL_FOUNDATION_GOVERNANCE',1,'hgs.resilience.direct-structured-current-adaptive-recovery',1,'["HGS_RESILIENCE_CURRENT_TARGET_BOUND_ADAPTIVE_RECOVERY_UNDER_EXPERIENCED_CHALLENGE","DIRECT_STRUCTURED_REPORT","GOAL_SITUATION_ONLY","ACTUAL_CHALLENGE_BASIS_CURRENT_APPRAISAL_NULL_WINDOW","ORDINAL_ADAPTIVE_RECOVERY_5","NO_ADVERSITY_TOO_EARLY_AND_CHALLENGE_DEPENDENCE_FAIL_TO_UNASSESSED","RESILIENCE_NOT_LOW_STRESS_MOTIVATION_CONFIDENCE_CONSISTENCY_GRIT_GOAL_SUCCESS_OR_REPAIR","DETERMINISTIC_CALCULATION","CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY","SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM"]'::jsonb,false,'2026-08-27T00:00:00Z','HIM_EXPANSION_HGS_RESILIENCE_CANONICAL_APPROVAL');
ALTER TABLE public.him_canonical_model_bindings DISABLE TRIGGER him_energy_binding_validate;
INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES
('47000000-0000-4000-8000-000000000004','hgs.resilience',1,'GOAL',1,'ACTIVE','hgs.resilience.direct-structured-current-adaptive-recovery',1,'hgs.resilience.direct-target-bound-adaptive-recovery-report',1,'hgs.resilience.adaptive-recovery-5.v1',1,'qandeel.him.resilience.foundation-approval',1,'2026-08-27T00:00:00Z'),
('47000000-0000-4000-8000-000000000005','hgs.resilience',1,'SITUATION',1,'ACTIVE','hgs.resilience.direct-structured-current-adaptive-recovery',1,'hgs.resilience.direct-target-bound-adaptive-recovery-report',1,'hgs.resilience.adaptive-recovery-5.v1',1,'qandeel.him.resilience.foundation-approval',1,'2026-08-27T00:00:00Z');

-- 5. Definition activation: exactly the Resilience definition moves from
--    UNCALIBRATED to CALIBRATED while its Foundation semantic mapping
--    deliberately stays UNRESOLVED/NULL (no RESILIENCE or GROWTH semantic
--    type exists, and no STATE/TRAIT/READINESS/CAPABILITY/LOAD/PROGRESS
--    mapping is made - the construct is not force-mapped merely because it
--    sounds like an ability or a trait). No dependency edges or consumers
--    appear, and no other definition changes - hgs.self-awareness,
--    hgs.purpose-alignment, hgs.habit-strength, and every HSE/HBS/HRS
--    definition are untouched.
UPDATE public.him_metric_definitions SET calculation_status='CALIBRATED',scale_reference='hgs.resilience.adaptive-recovery-5.v1',required_input_contract='DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_ADAPTIVE_RECOVERY_REPORT_V1' WHERE metric_key='hgs.resilience' AND definition_version=1;

-- 6. Binding validator: the exact 0046 function body plus exactly the
--    Resilience instrument/scale branch. Every historical
--    HSE/HBS/HRS/Self-Awareness branch is preserved byte-for-byte.
CREATE OR REPLACE FUNCTION public.validate_him_canonical_binding() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$DECLARE m public.him_calculation_models;a public.him_governance_approvals;BEGIN SELECT * INTO m FROM public.him_calculation_models WHERE model_id=NEW.model_id AND model_version=NEW.model_version;SELECT * INTO a FROM public.him_governance_approvals WHERE approval_id=NEW.approval_id AND approval_version=NEW.approval_version;IF a.id IS NULL OR a.model_id<>NEW.model_id OR a.model_version<>NEW.model_version THEN RAISE EXCEPTION 'Canonical binding approval does not approve its exact model version' USING ERRCODE='23514';END IF;IF m.id IS NULL OR m.lifecycle<>'CALIBRATED' OR m.environment<>'PRODUCTION' OR m.target_metric_key<>NEW.metric_key OR m.target_definition_version<>NEW.definition_version OR NOT(NEW.context_kind=ANY(m.supported_context_kinds)) OR m.scale_contract_reference<>NEW.scale_contract_reference THEN RAISE EXCEPTION 'Canonical binding model lifecycle, environment, metric, definition, context, or scale mismatch' USING ERRCODE='23514';END IF;IF NOT((NEW.metric_key='hse.energy' AND NEW.context_kind='CONVERSATION_SESSION' AND NEW.instrument_id='hse.energy.ar-eg.right-now' AND NEW.scale_contract_reference='hse.energy.ordinal-5.v1') OR (NEW.metric_key='hse.motivation' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hse.motivation.direct-self-report' AND NEW.scale_contract_reference='hse.motivation.ordinal-5.v1') OR (NEW.metric_key='hse.attention' AND NEW.context_kind=ANY(ARRAY['SITUATION','CONVERSATION_SESSION','DECISION']) AND NEW.instrument_id='hse.attention.direct-self-report' AND NEW.scale_contract_reference='hse.attention.ordinal-5.v1') OR (NEW.metric_key='hse.self-confidence' AND NEW.context_kind=ANY(ARRAY['SITUATION','DECISION']) AND NEW.instrument_id='hse.self-confidence.direct-self-report' AND NEW.scale_contract_reference='hse.self-confidence.ordinal-5.v1') OR (NEW.metric_key='hse.stress' AND NEW.context_kind=ANY(ARRAY['SITUATION','CONVERSATION_SESSION']) AND NEW.instrument_id='hse.stress.direct-self-report' AND NEW.scale_contract_reference='hse.stress.ordinal-5.v1') OR (NEW.metric_key='hbs.avoidance' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hbs.avoidance.direct-target-bound-seven-day-report' AND NEW.scale_contract_reference='hbs.avoidance.frequency-5.v1') OR (NEW.metric_key='hbs.consistency' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hbs.consistency.direct-target-bound-seven-day-report' AND NEW.scale_contract_reference='hbs.consistency.frequency-5.v1') OR (NEW.metric_key='hbs.initiative' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hbs.initiative.direct-target-bound-seven-day-report' AND NEW.scale_contract_reference='hbs.initiative.frequency-5.v1') OR (NEW.metric_key='hbs.reflection' AND NEW.context_kind=ANY(ARRAY['SITUATION','CONVERSATION_SESSION']) AND NEW.instrument_id='hbs.reflection.direct-context-bound-reflective-engagement-report' AND NEW.scale_contract_reference='hbs.reflection.engagement-5.v1') OR (NEW.metric_key='hrs.relationship-trust' AND NEW.context_kind='RELATIONSHIP' AND NEW.instrument_id='hrs.relationship-trust.direct-relationship-bound-reliance-report' AND NEW.scale_contract_reference='hrs.relationship-trust.reliance-5.v1') OR (NEW.metric_key='hrs.communication' AND NEW.context_kind='RELATIONSHIP' AND NEW.instrument_id='hrs.communication.direct-relationship-bound-communication-workability-report' AND NEW.scale_contract_reference='hrs.communication.workability-5.v1') OR (NEW.metric_key='hrs.repair' AND NEW.context_kind='RELATIONSHIP' AND NEW.instrument_id='hrs.repair.direct-relationship-bound-repair-effectiveness-report' AND NEW.scale_contract_reference='hrs.repair.effectiveness-5.v1') OR (NEW.metric_key='hrs.emotional-safety' AND NEW.context_kind='RELATIONSHIP' AND NEW.instrument_id='hrs.emotional-safety.direct-relationship-bound-emotional-openness-safety-report' AND NEW.scale_contract_reference='hrs.emotional-safety.openness-safety-5.v1') OR (NEW.metric_key='hgs.self-awareness' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hgs.self-awareness.direct-target-bound-self-understanding-clarity-report' AND NEW.scale_contract_reference='hgs.self-awareness.clarity-5.v1') OR (NEW.metric_key='hgs.resilience' AND NEW.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND NEW.instrument_id='hgs.resilience.direct-target-bound-adaptive-recovery-report' AND NEW.scale_contract_reference='hgs.resilience.adaptive-recovery-5.v1')) OR NEW.definition_version<>1 OR NEW.instrument_version<>1 OR NEW.scale_version<>1 THEN RAISE EXCEPTION 'Canonical binding instrument or scale contract mismatch' USING ERRCODE='23514';END IF;IF(NEW.status='RETIRED')<>(NEW.retired_at IS NOT NULL)THEN RAISE EXCEPTION 'Canonical binding retirement state is inconsistent' USING ERRCODE='23514';END IF;RETURN NEW;END$$;
ALTER TABLE public.him_canonical_model_bindings ENABLE TRIGGER him_energy_binding_validate;

-- 7. Narrow authenticated Resilience measurement authority. The caller
--    supplies only an owned GOAL or SITUATION target and a response; the
--    server derives identity, the context kind, the label, the event, and
--    the canonical report time. The measurement event carries a NULL
--    temporal window pair: Resilience is an at-report target-bound
--    appraisal grounded in challenge actually experienced in the target -
--    never a period measure, a time-to-recovery, or a growth trajectory,
--    and the metric encodes no retrospective period. Client timestamps stay
--    untrusted diagnostics. The dedicated functions never touch the shared
--    HSE helpers or any sibling HGS/HBS/HRS/HSE function, and the existing
--    GOAL/SITUATION target-creation RPCs from 0013/0014 are reused
--    unchanged - no new target authority and no HGS-specific target table
--    exists.
CREATE FUNCTION public.create_hgs_resilience_measurement_v1(p_target_context_id uuid,p_response_code text,p_client_reported_at_untrusted timestamptz) RETURNS public.him_measurement_observations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$DECLARE u uuid:=auth.uid();e uuid:=gen_random_uuid();canonical_now timestamptz:=clock_timestamp();target public.him_measurement_targets;o public.him_measurement_observations;BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 SELECT * INTO target FROM public.him_measurement_targets WHERE id=p_target_context_id AND user_id=u AND context_kind=ANY(ARRAY['GOAL','SITUATION']);
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown, cross-user, or unsupported Resilience GOAL/SITUATION target' USING ERRCODE='42501';END IF;
 IF p_response_code<>ALL(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE','TOO_EARLY_TO_JUDGE_ADAPTATION','TOO_CHALLENGE_DEPENDENT_TO_RATE','NOT_SURE']) THEN RAISE EXCEPTION 'Invalid Resilience response' USING ERRCODE='22023';END IF;
 INSERT INTO public.him_measurement_events(id,user_id,context_kind,context_id,created_at)VALUES(e,u,target.context_kind,target.id::text,canonical_now);
 INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,client_reported_at_untrusted,locale,source,canonical_provenance,created_at,target_label,target_context_kind,target_context_id)
 VALUES(gen_random_uuid(),u,e,'hgs.resilience',1,'hgs.resilience.direct-target-bound-adaptive-recovery-report',1,'hgs.resilience.adaptive-recovery-5.v1',1,target.context_kind,target.id::text,p_response_code,canonical_now,p_client_reported_at_untrusted,'ar-EG','DIRECT_STRUCTURED_USER_REPORT','QANDEEL_HGS_RESILIENCE_MEASUREMENT_V1',canonical_now,target.display_text,target.context_kind,target.id) RETURNING * INTO o;RETURN o;END$body$;

-- 8. Resilience correction: same measurement event, same exact GOAL or
--    SITUATION target (a correction changes the response, never the
--    target), same immutable NULL event window, advisory-lock serialized in
--    the dedicated Resilience namespace, one correction per observation,
--    and the prior calculated result/current snapshot is superseded through
--    the existing hardened supersession ledger.
CREATE FUNCTION public.correct_hgs_resilience_measurement_v1(p_supersedes_observation_id uuid,p_response_code text,p_client_reported_at_untrusted timestamptz) RETURNS public.him_measurement_observations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$DECLARE u uuid:=auth.uid();canonical_now timestamptz:=clock_timestamp();prior public.him_measurement_observations;o public.him_measurement_observations;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hgs.resilience.observation:'||p_supersedes_observation_id::text,0));
 SELECT * INTO prior FROM public.him_measurement_observations WHERE id=p_supersedes_observation_id AND user_id=u AND metric_key='hgs.resilience';
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.him_measurement_observations WHERE supersedes_observation_id=prior.id) THEN RAISE EXCEPTION 'Unknown, cross-user, cross-metric, or already corrected observation' USING ERRCODE='42501';END IF;
 IF p_response_code<>ALL(ARRAY['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE','TOO_EARLY_TO_JUDGE_ADAPTATION','TOO_CHALLENGE_DEPENDENT_TO_RATE','NOT_SURE']) THEN RAISE EXCEPTION 'Invalid Resilience response' USING ERRCODE='22023';END IF;
 INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,client_reported_at_untrusted,locale,source,supersedes_observation_id,canonical_provenance,created_at,target_label,target_context_kind,target_context_id)
 SELECT gen_random_uuid(),user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,p_response_code,canonical_now,p_client_reported_at_untrusted,locale,source,id,canonical_provenance,canonical_now,target_label,target_context_kind,target_context_id FROM public.him_measurement_observations WHERE id=prior.id RETURNING * INTO o;
 INSERT INTO public.him_energy_calculation_supersessions(id,user_id,measurement_event_id,superseded_observation_id,superseding_observation_id,calculation_result_id,snapshot_id,superseded_at,reason)
 SELECT gen_random_uuid(),u,prior.measurement_event_id,prior.id,o.id,r.id,s.id,canonical_now,'EXPLICIT_MEASUREMENT_CORRECTION' FROM public.him_calculation_results r JOIN public.him_metric_snapshots s ON s.calculation_result_id=r.id WHERE r.measurement_observation_id=prior.id;
 RETURN o;END$body$;

-- 9. Deterministic Resilience calculation. Dedicated to hgs.resilience and
--    structurally unable to score any sibling HGS, HRS, HBS, or HSE
--    observation: the metric filter, instrument, scale, and binding join
--    are all Resilience-exact, and no sibling metric, Memory, Evidence, or
--    conversation text is ever read - the target label is verified as an
--    exact server-derived binding artifact, never interpreted semantically.
--    It re-verifies the exact owned GOAL or SITUATION target, requires the
--    event window pair to be NULL, resolves the exact ACTIVE binding, and
--    is idempotent for the exact observation+binding pair. The snapshot
--    preserves semantic_mapping_status='UNRESOLVED' with a NULL semantic
--    type, carries a NULL temporal window, and stays
--    confidence-UNASSESSED. NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE,
--    TOO_EARLY_TO_JUDGE_ADAPTATION, TOO_CHALLENGE_DEPENDENT_TO_RATE, and
--    NOT_SURE map to UNASSESSED/NULL - never zero, never a midpoint, never
--    low resilience, and never high resilience. The numeric value is never
--    converted into any recovery-time, trait, health-band, or wellbeing
--    conclusion, and no such field exists.
CREATE FUNCTION public.calculate_hgs_resilience_measurement_v1(p_observation_id uuid) RETURNS public.him_metric_snapshots LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$DECLARE u uuid:=auth.uid();o public.him_measurement_observations;e public.him_measurement_events;b public.him_canonical_model_bindings;r public.him_calculation_results;score double precision;state text;next_version integer;s public.him_metric_snapshots;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hgs.resilience.observation:'||p_observation_id::text,0));
 SELECT * INTO o FROM public.him_measurement_observations WHERE id=p_observation_id AND user_id=u AND metric_key='hgs.resilience';
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.him_measurement_observations x WHERE x.supersedes_observation_id=o.id) THEN RAISE EXCEPTION 'Unknown, cross-user, cross-metric, or superseded Resilience observation' USING ERRCODE='42501';END IF;
 IF NOT(o.context_kind=ANY(ARRAY['GOAL','SITUATION']) AND o.target_context_kind=o.context_kind AND o.target_context_id::text=o.context_id AND EXISTS(SELECT 1 FROM public.him_measurement_targets t WHERE t.id=o.target_context_id AND t.user_id=o.user_id AND t.context_kind=o.context_kind AND t.display_text=o.target_label)) THEN RAISE EXCEPTION 'Resilience target/context mismatch' USING ERRCODE='22023';END IF;
 SELECT * INTO e FROM public.him_measurement_events WHERE id=o.measurement_event_id AND user_id=o.user_id;
 IF e.id IS NULL OR e.observation_window_start IS NOT NULL OR e.observation_window_end IS NOT NULL THEN RAISE EXCEPTION 'Resilience observation window must remain NULL' USING ERRCODE='22023';END IF;
 SELECT cb.* INTO b FROM public.him_canonical_model_bindings cb JOIN public.him_calculation_models m ON(m.model_id,m.model_version)=(cb.model_id,cb.model_version) JOIN public.him_governance_approvals a ON(a.approval_id,a.approval_version)=(cb.approval_id,cb.approval_version) WHERE cb.metric_key=o.metric_key AND cb.definition_version=o.definition_version AND cb.context_kind=o.context_kind AND cb.status='ACTIVE' AND m.lifecycle='CALIBRATED' AND m.environment='PRODUCTION' AND (a.model_id,a.model_version)=(m.model_id,m.model_version) AND cb.instrument_id=o.instrument_id AND cb.instrument_version=o.instrument_version AND cb.scale_contract_reference=o.scale_contract_reference AND cb.scale_version=o.scale_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'No exact active canonical Resilience binding' USING ERRCODE='22023';END IF;
 SELECT s0.* INTO s FROM public.him_metric_snapshots s0 JOIN public.him_calculation_results r0 ON r0.id=s0.calculation_result_id WHERE r0.measurement_observation_id=o.id AND r0.canonical_binding_id=b.id;IF FOUND THEN RETURN s;END IF;
 score:=CASE o.response_code WHEN 'VERY_LOW' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'HIGH' THEN 4 WHEN 'VERY_HIGH' THEN 5 ELSE NULL END;state:=CASE WHEN score IS NULL THEN 'UNASSESSED' ELSE 'ASSESSED' END;
 INSERT INTO public.him_calculation_results(id,user_id,metric_key,definition_version,model_id,model_version,context_kind,context_id,result_state,numeric_value,missing_input_keys,contradiction_state,supporting_evidence_refs,contradictory_evidence_refs,provenance,confidence_state,confidence_reference,trace_id,update_reason,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version)
 VALUES(gen_random_uuid(),u,o.metric_key,o.definition_version,b.model_id,b.model_version,o.context_kind,o.context_id,state,score,CASE WHEN score IS NULL THEN ARRAY['scoredResponse'] ELSE ARRAY[]::text[] END,'NONE',ARRAY['measurement-observation:'||o.id::text],ARRAY[]::text[],'QANDEEL_HIM_CALCULATION_RUNTIME_V1','UNASSESSED',NULL,gen_random_uuid()::text,'DIRECT_STRUCTURED_USER_REPORT',o.measurement_event_id,o.id,b.id,o.scale_contract_reference,o.scale_version) RETURNING * INTO r;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||o.metric_key||o.context_kind||o.context_id,0));SELECT coalesce(max(snapshot_version),0)+1 INTO next_version FROM public.him_metric_snapshots WHERE user_id=u AND metric_key=o.metric_key AND context_kind=o.context_kind AND context_id=o.context_id;
 INSERT INTO public.him_metric_snapshots(id,user_id,metric_key,definition_version,semantic_mapping_status,semantic_type,value_state,numeric_value,confidence_state,confidence_reference,supporting_evidence_ids,contradicting_evidence_ids,source_engines,context_kind,context_id,scope,observed_at,validity_status,snapshot_version,descriptive_update_reason,descriptive_update_reference_ids,canonical_provenance,created_at,calculation_result_id,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version)
 VALUES(gen_random_uuid(),u,o.metric_key,o.definition_version,'UNRESOLVED',NULL,state,score,'UNASSESSED',NULL,ARRAY[]::text[],ARRAY[]::text[],ARRAY['QANDEEL_HIM_RUNTIME'],o.context_kind,o.context_id,'exact measurement event',o.reported_at,'VALID',next_version,'DIRECT_STRUCTURED_USER_REPORT',ARRAY[]::text[],'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',CURRENT_TIMESTAMP,r.id,o.measurement_event_id,o.id,b.id,o.scale_contract_reference,o.scale_version) RETURNING * INTO s;RETURN s;END$body$;

-- 10. Current structured read: the supersession-aware view now also carries
--     hgs.resilience so explicit corrections can never leave a stale
--     superseded value as "latest current". The five HSE routes, the four
--     HBS routes, the four HRS routes, and the Self-Awareness route are
--     preserved exactly, and no other HGS metric is routed -
--     hgs.purpose-alignment and hgs.habit-strength remain uncalibrated and
--     unobserved.
CREATE OR REPLACE VIEW public.him_current_structured_measurements WITH(security_invoker=true)AS SELECT s.* FROM public.him_measurement_observations o JOIN public.him_metric_snapshots s ON s.measurement_observation_id=o.id WHERE o.metric_key=ANY(ARRAY['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience'])AND NOT EXISTS(SELECT 1 FROM public.him_measurement_observations newer WHERE newer.supersedes_observation_id=o.id)AND NOT EXISTS(SELECT 1 FROM public.him_energy_calculation_supersessions x WHERE x.snapshot_id=s.id);

REVOKE ALL ON FUNCTION public.create_hgs_resilience_measurement_v1(uuid,text,timestamptz),public.correct_hgs_resilience_measurement_v1(uuid,text,timestamptz),public.calculate_hgs_resilience_measurement_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_hgs_resilience_measurement_v1(uuid,text,timestamptz),public.correct_hgs_resilience_measurement_v1(uuid,text,timestamptz),public.calculate_hgs_resilience_measurement_v1(uuid) TO authenticated;

-- 11. One-time migration-phase inventory invariant: exactly fifteen
--     calibrated (five HSE, four HBS, four HRS, hgs.self-awareness, and
--     hgs.resilience) and exactly two uncalibrated (hgs.purpose-alignment
--     and hgs.habit-strength), Resilience keeps HGS ownership with an
--     unresolved NULL semantic mapping, its exact scale and input
--     contract, and no dependency edges or consumers, the prior
--     HSE/HBS/HRS metrics and hgs.self-awareness remain calibrated and
--     semantically unchanged, and the two remaining HGS metrics remain
--     uncalibrated. The 15/2 phase check runs at migration time only -
--     historical verifiers must never freeze it as a permanent ceiling,
--     must never permanently require the two remaining HGS metrics to stay
--     uncalibrated, and nothing here asserts that a later migration can
--     never exist. The temporal-comparability source (0017) and
--     Intelligence Snapshot v1 (0018) are untouched by this migration:
--     hgs.resilience is deliberately NOT ELIGIBLE for either in v1, and
--     measurement calibration grants no HGS runtime-consumption authority.
DO $$BEGIN
 IF (SELECT count(*) FROM public.him_metric_definitions WHERE calculation_status='CALIBRATED')<>15
  OR (SELECT count(*) FROM public.him_metric_definitions WHERE calculation_status='UNCALIBRATED')<>2
  OR NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hgs.resilience' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HGS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL AND scale_reference='hgs.resilience.adaptive-recovery-5.v1' AND required_input_contract='DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_ADAPTIVE_RECOVERY_REPORT_V1' AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  OR NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hgs.self-awareness' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HGS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL AND scale_reference='hgs.self-awareness.clarity-5.v1' AND required_input_contract='DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_SELF_UNDERSTANDING_CLARITY_REPORT_V1' AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  OR NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hbs.consistency' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HBS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL AND scale_reference='hbs.consistency.frequency-5.v1' AND required_input_contract='DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1' AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  OR NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hrs.repair' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HRS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL AND scale_reference='hrs.repair.effectiveness-5.v1' AND required_input_contract='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT_V1' AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  OR EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key=ANY(ARRAY['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.emotional-safety']) AND calculation_status<>'CALIBRATED')
  OR EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key=ANY(ARRAY['hgs.purpose-alignment','hgs.habit-strength']) AND calculation_status<>'UNCALIBRATED')
 THEN RAISE EXCEPTION 'Fifteen calibrated / two uncalibrated Resilience activation invariant failed';END IF;
END$$;
COMMIT;
