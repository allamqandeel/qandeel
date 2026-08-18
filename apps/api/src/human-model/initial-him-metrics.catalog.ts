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
  ...common, metricKey, canonicalName, hifOwner, semanticType, validContextKinds,
  canonicalDefinition: `Canonical HIF Part 8 ${hifOwner} metric identity: ${canonicalName}. ${note}`,
  canonicalSource: `HIF Part 8 — Human Intelligence Metrics v0.1 / ${hifOwner}`,
});

/** The single application catalog; migration 0010 is its integrity-enforced persisted projection. */
export const INITIAL_HIM_METRICS = Object.freeze([
  metric('hse.stress', 'Stress', 'HSE', 'STATE', ['SITUATION', 'CONVERSATION_SESSION'], 'No quantitative interpretation is approved.'),
  metric('hse.energy', 'Energy', 'HSE', 'STATE', ['SITUATION', 'CONVERSATION_SESSION'], 'No quantitative interpretation is approved.'),
  metric('hse.motivation', 'Motivation', 'HSE', 'STATE', ['SITUATION', 'GOAL'], 'No quantitative interpretation is approved.'),
  metric('hse.self-confidence', 'Confidence', 'HSE', 'STATE', ['SITUATION', 'DECISION'], 'Human self-confidence in context; not Hypothesis Confidence Runtime.'),
  metric('hse.attention', 'Attention', 'HSE', 'STATE', ['SITUATION', 'CONVERSATION_SESSION', 'DECISION'], 'No quantitative interpretation is approved.'),
  metric('hbs.avoidance', 'Avoidance', 'HBS', 'STATE', ['SITUATION', 'GOAL'], 'Context-bound behavior representation; not a permanent trait.'),
  metric('hbs.consistency', 'Consistency', 'HBS', 'STATE', ['SITUATION', 'GOAL'], 'Context-bound behavior representation; not a permanent trait.'),
  metric('hbs.initiative', 'Initiative', 'HBS', 'STATE', ['SITUATION', 'GOAL'], 'Context-bound behavior representation; not a permanent trait.'),
  metric('hbs.reflection', 'Reflection', 'HBS', 'STATE', ['SITUATION', 'CONVERSATION_SESSION'], 'Context-bound behavior representation; not a permanent trait.'),
  metric('hrs.relationship-trust', 'Trust', 'HRS', 'STATE', ['RELATIONSHIP'], 'Relationship-bound human trust; not SENA, provider, epistemic, or global trust.'),
  metric('hrs.communication', 'Communication', 'HRS', 'STATE', ['RELATIONSHIP'], 'Relationship-bound representation only.'),
  metric('hrs.repair', 'Repair', 'HRS', 'STATE', ['RELATIONSHIP'], 'Relationship-bound representation only.'),
  metric('hrs.emotional-safety', 'Emotional Safety', 'HRS', 'STATE', ['RELATIONSHIP'], 'Relationship-bound representation only.'),
  metric('hgs.self-awareness', 'Self-awareness', 'HGS', 'CAPABILITY', ['GOAL', 'SITUATION'], 'Capability tag only; no score or growth trajectory is defined.'),
  metric('hgs.resilience', 'Resilience', 'HGS', 'CAPABILITY', ['GOAL', 'SITUATION'], 'Capability tag only; no score or growth trajectory is defined.'),
  metric('hgs.purpose-alignment', 'Purpose Alignment', 'HGS', 'ALIGNMENT', ['GOAL'], 'Goal-bound alignment only; no score is defined.'),
  metric('hgs.habit-strength', 'Habit Strength', 'HGS', 'CAPABILITY', ['GOAL', 'SITUATION'], 'Capability tag only; no score or growth trajectory is defined.'),
] satisfies readonly HimMetricDefinition[]);

