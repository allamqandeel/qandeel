// QHIA-001 HSE Current-State Interaction Adaptation v1.
//
// Server-owned deterministic policy state derived from the validated session
// HimReasoningContext. This is NOT a new measurement: no numeric score, no
// weighted score, no average, no composite wellbeing/readiness/capacity score,
// no probability, and no invented confidence.

export type HimInteractionAdaptationDriver =
  | 'STRESS_HIGH_OR_VERY_HIGH'
  | 'ENERGY_LOW_OR_VERY_LOW'
  | 'ATTENTION_LOW_OR_VERY_LOW';

export interface HimInteractionAdaptationDirectives {
  responseDensity: 'DEFAULT' | 'COMPACT';
  cognitiveLoad: 'DEFAULT' | 'REDUCED';
  branching: 'DEFAULT' | 'SINGLE_TRACK';
  steeringPressure: 'DEFAULT' | 'REDUCED';
  deliveryPacing: 'DEFAULT' | 'CALMER';
  stepBatching: 'DEFAULT' | 'ONE_AT_A_TIME';
}

export interface HimInteractionAdaptation {
  contractVersion: 1;
  source: 'HIM_REASONING_CONTEXT';
  sourceSnapshotContractVersion: 1;
  contextKind: 'CONVERSATION_SESSION';
  contextId: string;

  adaptationState: 'NONE' | 'ACTIVE';

  directives: HimInteractionAdaptationDirectives;

  drivers: HimInteractionAdaptationDriver[];
}
