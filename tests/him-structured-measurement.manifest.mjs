export const HIM_CONTEXTS=['GLOBAL','CONVERSATION_SESSION','GOAL','SITUATION','DECISION','RELATIONSHIP'];
/**
 * The FROZEN canonical HIM v1 structured-measurement proof: exactly the
 * seventeen historical `metricKey@1` identities and their approved
 * measurement-model contracts.
 *
 * This is a closed HISTORICAL claim, never the complete current or future
 * application inventory. The application catalog may legitimately grow with a
 * later version of one of these metrics (`hse.energy@2`) or with an entirely
 * new reviewed metric, calibrated or uncalibrated; no such definition belongs
 * in this manifest and none of them may be added here to make a test pass.
 *
 * Every entry carries its EXACT identity - `metricKey` AND
 * `definitionVersion` - so a later version can never satisfy, nor be mistaken
 * for, a canonical v1 requirement.
 */
export const CANONICAL_V1_STRUCTURED_METRICS=Object.freeze([
  {metricKey:'hse.energy',definitionVersion:1,model:'hse-energy.model.ts',migration:'0012_hse_energy_measurement_model_v1.sql',approved:['CONVERSATION_SESSION'],sqlPositive:[/CHECK\(context_kind='CONVERSATION_SESSION'\)/]},
  {metricKey:'hse.motivation',definitionVersion:1,model:'hse-motivation.model.ts',migration:'0013_hse_motivation_measurement_model_v1.sql',approved:['GOAL','SITUATION'],sqlPositive:[/ARRAY\['GOAL','SITUATION'\]/,/target\.context_kind/]},
  {metricKey:'hse.attention',definitionVersion:1,model:'hse-attention.model.ts',migration:'0014_hse_attention_measurement_model_v1.sql',approved:['SITUATION','CONVERSATION_SESSION','DECISION'],sqlPositive:[/p_context_kind='CONVERSATION_SESSION'THEN/,/ELSIF p_context_kind=ANY\(ARRAY\['SITUATION','DECISION'\]\)THEN/]},
  {metricKey:'hse.self-confidence',definitionVersion:1,model:'hse-self-confidence.model.ts',migration:'0015_hse_self_confidence_measurement_model_v1.sql',approved:['SITUATION','DECISION'],sqlPositive:[/IF p_context_kind=ANY\(ARRAY\['SITUATION','DECISION'\]\)THEN/]},
  {metricKey:'hse.stress',definitionVersion:1,model:'hse-stress.model.ts',migration:'0016_hse_stress_measurement_model_v1.sql',approved:['SITUATION','CONVERSATION_SESSION'],sqlPositive:[/p_context_kind='CONVERSATION_SESSION'THEN/,/ELSIF p_context_kind='SITUATION'THEN/]},
  {metricKey:'hbs.avoidance',definitionVersion:1,model:'hbs-avoidance.model.ts',migration:'0040_hbs_avoidance_measurement_model_v1.sql',approved:['GOAL','SITUATION'],sqlPositive:[/context_kind=ANY\(ARRAY\['GOAL','SITUATION'\]\)/,/observation_window_end-e\.observation_window_start<>interval '7 days'/,/canonical_now-interval '7 days',canonical_now/]},
  {metricKey:'hbs.consistency',definitionVersion:1,model:'hbs-consistency.model.ts',migration:'0041_hbs_consistency_initiative_measurement_models_v1.sql',approved:['GOAL','SITUATION'],sqlPositive:[/Unknown, cross-user, or unsupported Consistency measurement target/,/INSUFFICIENT_REPEATED_OPPORTUNITIES/,/Consistency seven-day observation window mismatch/,/canonical_now-interval '7 days',canonical_now/]},
  {metricKey:'hbs.initiative',definitionVersion:1,model:'hbs-initiative.model.ts',migration:'0041_hbs_consistency_initiative_measurement_models_v1.sql',approved:['GOAL','SITUATION'],sqlPositive:[/Unknown, cross-user, or unsupported Initiative measurement target/,/NO_CLEAR_SELF_OWNED_OPPORTUNITY/,/Initiative seven-day observation window mismatch/,/canonical_now-interval '7 days',canonical_now/]},
  {metricKey:'hbs.reflection',definitionVersion:1,model:'hbs-reflection.model.ts',migration:'0042_hbs_reflection_measurement_model_v1.sql',approved:['SITUATION','CONVERSATION_SESSION'],sqlPositive:[/Unknown, cross-user, or unsupported Reflection SITUATION target/,/Unknown or cross-user Reflection conversation session/,/NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT/,/Reflection observation window must remain NULL/]},
  {metricKey:'hrs.relationship-trust',definitionVersion:1,model:'hrs-relationship-trust.model.ts',migration:'0043_hrs_relationship_trust_measurement_model_v1.sql',approved:['RELATIONSHIP'],sqlPositive:[/Unknown, cross-user, or unsupported Relationship Trust RELATIONSHIP target/,/TOO_CONTEXT_DEPENDENT_TO_RATE/,/INSUFFICIENT_BASIS_TO_JUDGE/,/Relationship Trust observation window must remain NULL/,/create_him_relationship_measurement_target_v1/]},
  {metricKey:'hrs.communication',definitionVersion:1,model:'hrs-communication.model.ts',migration:'0044_hrs_communication_repair_measurement_models_v1.sql',approved:['RELATIONSHIP'],sqlPositive:[/Unknown, cross-user, or unsupported Communication RELATIONSHIP target/,/TOO_TOPIC_DEPENDENT_TO_RATE/,/Communication observation window must remain NULL/]},
  {metricKey:'hrs.repair',definitionVersion:1,model:'hrs-repair.model.ts',migration:'0044_hrs_communication_repair_measurement_models_v1.sql',approved:['RELATIONSHIP'],sqlPositive:[/Unknown, cross-user, or unsupported Repair RELATIONSHIP target/,/NO_MEANINGFUL_REPAIR_OPPORTUNITY/,/TOO_EPISODE_DEPENDENT_TO_RATE/,/Repair observation window must remain NULL/]},
  {metricKey:'hrs.emotional-safety',definitionVersion:1,model:'hrs-emotional-safety.model.ts',migration:'0045_hrs_emotional_safety_measurement_model_v1.sql',approved:['RELATIONSHIP'],sqlPositive:[/Unknown, cross-user, or unsupported Emotional Safety RELATIONSHIP target/,/TOO_VULNERABILITY_DEPENDENT_TO_RATE/,/INSUFFICIENT_BASIS_TO_JUDGE/,/Emotional Safety observation window must remain NULL/]},
  {metricKey:'hgs.self-awareness',definitionVersion:1,model:'hgs-self-awareness.model.ts',migration:'0046_hgs_self_awareness_measurement_model_v1.sql',approved:['GOAL','SITUATION'],sqlPositive:[/Unknown, cross-user, or unsupported Self-Awareness GOAL\/SITUATION target/,/TOO_FACET_DEPENDENT_TO_RATE/,/INSUFFICIENT_BASIS_TO_JUDGE/,/Self-Awareness observation window must remain NULL/]},
  {metricKey:'hgs.resilience',definitionVersion:1,model:'hgs-resilience.model.ts',migration:'0047_hgs_resilience_measurement_model_v1.sql',approved:['GOAL','SITUATION'],sqlPositive:[/Unknown, cross-user, or unsupported Resilience GOAL\/SITUATION target/,/NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE/,/TOO_EARLY_TO_JUDGE_ADAPTATION/,/TOO_CHALLENGE_DEPENDENT_TO_RATE/,/Resilience observation window must remain NULL/]},
  {metricKey:'hgs.purpose-alignment',definitionVersion:1,model:'hgs-purpose-alignment.model.ts',migration:'0048_hgs_purpose_alignment_measurement_model_v1.sql',approved:['GOAL'],sqlPositive:[/Unknown, cross-user, or unsupported Purpose Alignment GOAL target/,/TOO_VALUE_CONFLICTED_TO_RATE/,/INSUFFICIENT_PERSONAL_DIRECTION_BASIS_TO_JUDGE/,/Purpose Alignment observation window must remain NULL/]},
  {metricKey:'hgs.habit-strength',definitionVersion:1,model:'hgs-habit-strength.model.ts',migration:'0049_hgs_habit_strength_measurement_model_v1.sql',approved:['GOAL','SITUATION'],sqlPositive:[/Unknown, cross-user, or unsupported Habit Strength GOAL\/SITUATION target/,/INSUFFICIENT_REPETITION_HISTORY_TO_JUDGE/,/NO_SINGLE_RECURRING_PATTERN_TO_RATE/,/TOO_CUE_DEPENDENT_TO_RATE/,/Habit Strength observation window must remain NULL/]},
]);
/**
 * Canonical-v1-only compatibility alias, kept so the QHIM-008 Trend guard and
 * any other existing canonical-v1 consumer stay byte-exact. It names the SAME
 * frozen seventeen `metricKey@1` identities above and carries EXACTLY their
 * scope: it is the canonical v1 calibrated subset, never the complete current
 * or future catalog, and it may never be read as one.
 */
export const CALIBRATED_STRUCTURED_METRICS=CANONICAL_V1_STRUCTURED_METRICS;
// The global `EXPECTED_UNCALIBRATED_COUNT` future-universe ceiling is retired.
// Canonical v1 calibration is proven directly by exact identity coverage, and a
// separately reviewed later definition may legitimately sit UNCALIBRATED in the
// application catalog without falsifying any canonical v1 fact.
