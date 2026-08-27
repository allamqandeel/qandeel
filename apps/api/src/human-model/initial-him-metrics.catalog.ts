import type { HimMetricDefinition } from './him.types';

const common = {
  definitionVersion: 1,
  calculationStatus: 'UNCALIBRATED' as const,
  scaleReference: 'UNCALIBRATED_NO_PRODUCTION_SCALE',
  requiredInputContract: 'APPROVED_MEASUREMENT_MODEL_REQUIRED',
  confidenceRequirementReference: 'UNRESOLVED_METRIC_CONFIDENCE_MODEL',
  consumers: [] as string[],
  sourceMetadata: ['HIF_PART_8_HUMAN_INTELLIGENCE_METRICS_V0_1'],
  dependencyIds: [] as string[],
};

const metric = (
  metricKey: string, canonicalName: string, hifOwner: HimMetricDefinition['hifOwner'],
  semanticType: HimMetricDefinition['semanticType'], validContextKinds: HimMetricDefinition['validContextKinds'],
  note: string,
): HimMetricDefinition => ({
  ...common, metricKey, canonicalName, hifOwner, semanticType,
  semanticMappingStatus: semanticType === null ? 'UNRESOLVED' : 'RESOLVED', validContextKinds,
  canonicalDefinition: `Canonical HIF Part 8 ${hifOwner} metric identity: ${canonicalName}. ${note}`,
  canonicalSource: `HIF Part 8 — Human Intelligence Metrics v0.1 / ${hifOwner}`,
});

/** The single application catalog; migration 0010 is its integrity-enforced persisted projection. */
export const INITIAL_HIM_METRICS = Object.freeze([
  {...metric('hse.stress','Stress','HSE','STATE',['SITUATION','CONVERSATION_SESSION'],'Direct structured RIGHT_NOW subjective psychological-pressure self-report is approved for exact owned contexts only.'),calculationStatus:'CALIBRATED',scaleReference:'hse.stress.ordinal-5.v1',requiredInputContract:'DIRECT_STRUCTURED_AUTHORIZED_CONTEXT_USER_REPORT_RIGHT_NOW_V1'},
  {...metric('hse.energy','Energy','HSE','STATE',['SITUATION','CONVERSATION_SESSION'],'Direct structured ar-EG RIGHT_NOW self-report is approved for CONVERSATION_SESSION only.'),calculationStatus:'CALIBRATED',scaleReference:'hse.energy.ordinal-5.v1',requiredInputContract:'DIRECT_STRUCTURED_USER_REPORT_AR_EG_RIGHT_NOW_V1'},
  {...metric('hse.motivation','Motivation','HSE','STATE',['SITUATION','GOAL'],'Direct structured RIGHT_NOW target-bound self-report is approved for GOAL and SITUATION only.'),calculationStatus:'CALIBRATED',scaleReference:'hse.motivation.ordinal-5.v1',requiredInputContract:'DIRECT_STRUCTURED_TARGET_BOUND_USER_REPORT_RIGHT_NOW_V1'},
  {...metric('hse.self-confidence','Confidence','HSE','STATE',['SITUATION','DECISION'],'Direct structured RIGHT_NOW self-report is approved for exact owned SITUATION and DECISION contexts only; not Hypothesis Confidence Runtime.'),calculationStatus:'CALIBRATED',scaleReference:'hse.self-confidence.ordinal-5.v1',requiredInputContract:'DIRECT_STRUCTURED_AUTHORIZED_CONTEXT_USER_REPORT_RIGHT_NOW_V1'},
  {...metric('hse.attention','Attention','HSE','STATE',['SITUATION','CONVERSATION_SESSION','DECISION'],'Direct structured RIGHT_NOW self-report is approved for exact owned contexts only.'),calculationStatus:'CALIBRATED',scaleReference:'hse.attention.ordinal-5.v1',requiredInputContract:'DIRECT_STRUCTURED_AUTHORIZED_CONTEXT_USER_REPORT_RIGHT_NOW_V1'},
  {...metric('hbs.avoidance','Avoidance','HBS',null,['SITUATION','GOAL'],'Direct structured target-bound seven-day retrospective behavioral-frequency self-report is approved for exact owned GOAL and SITUATION targets only; semantic mapping remains unresolved and it is not a permanent trait.'),calculationStatus:'CALIBRATED',scaleReference:'hbs.avoidance.frequency-5.v1',requiredInputContract:'DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1'},
  {...metric('hbs.consistency','Consistency','HBS',null,['SITUATION','GOAL'],'Direct structured target-bound seven-day retrospective follow-through-frequency self-report is approved for exact owned GOAL and SITUATION targets only; semantic mapping remains unresolved, it is not a permanent trait, and it is independent of Initiative and Avoidance.'),calculationStatus:'CALIBRATED',scaleReference:'hbs.consistency.frequency-5.v1',requiredInputContract:'DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1'},
  {...metric('hbs.initiative','Initiative','HBS',null,['SITUATION','GOAL'],'Direct structured target-bound seven-day retrospective self-initiated-start-frequency self-report is approved for exact owned GOAL and SITUATION targets only; semantic mapping remains unresolved, it is not a permanent trait, and it is independent of Consistency and Avoidance.'),calculationStatus:'CALIBRATED',scaleReference:'hbs.initiative.frequency-5.v1',requiredInputContract:'DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1'},
  metric('hbs.reflection', 'Reflection', 'HBS', null, ['SITUATION', 'CONVERSATION_SESSION'], 'Foundation semantic mapping is unresolved; not a permanent trait.'),
  metric('hrs.relationship-trust', 'Trust', 'HRS', null, ['RELATIONSHIP'], 'Foundation semantic mapping is unresolved; not SENA, provider, epistemic, or global trust.'),
  metric('hrs.communication', 'Communication', 'HRS', null, ['RELATIONSHIP'], 'Foundation semantic mapping is unresolved; relationship-bound only.'),
  metric('hrs.repair', 'Repair', 'HRS', null, ['RELATIONSHIP'], 'Foundation semantic mapping is unresolved; relationship-bound only.'),
  metric('hrs.emotional-safety', 'Emotional Safety', 'HRS', null, ['RELATIONSHIP'], 'Foundation semantic mapping is unresolved; relationship-bound only.'),
  metric('hgs.self-awareness', 'Self-awareness', 'HGS', null, ['GOAL', 'SITUATION'], 'Foundation semantic mapping is unresolved; no score or growth trajectory is defined.'),
  metric('hgs.resilience', 'Resilience', 'HGS', null, ['GOAL', 'SITUATION'], 'Foundation semantic mapping is unresolved; no score or growth trajectory is defined.'),
  metric('hgs.purpose-alignment', 'Purpose Alignment', 'HGS', 'ALIGNMENT', ['GOAL'], 'Goal-bound alignment only; no score is defined.'),
  metric('hgs.habit-strength', 'Habit Strength', 'HGS', null, ['GOAL', 'SITUATION'], 'Foundation semantic mapping is unresolved; no score or growth trajectory is defined.'),
] satisfies readonly HimMetricDefinition[]);

