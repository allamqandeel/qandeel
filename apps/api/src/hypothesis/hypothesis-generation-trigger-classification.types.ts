import type { SafetyDisposition } from '../conversation/safety-response-gate.types';

export const MAX_HYPOTHESIS_TRIGGER_INPUT_CHARS = 4_000;

export const HYPOTHESIS_TRIGGER_REASONS = [
  'EXPLICIT_WHY_SELF',
  'RECURRING_PATTERN',
  'INTERNAL_CONTRADICTION',
  'RELATIONAL_PATTERN',
  'OUTCOME_WITH_UNCLEAR_CAUSE',
] as const;
export type HypothesisTriggerReason = (typeof HYPOTHESIS_TRIGGER_REASONS)[number];

export const HYPOTHESIS_NO_TRIGGER_REASONS = [
  'ORDINARY_FACT',
  'PREFERENCE_OR_GOAL',
  'COMMAND_OR_REQUEST',
  'GENERIC_QUESTION',
  'GREETING_OR_ACK',
  'TRANSIENT_STATE_ONLY',
  'QUOTED_OR_THIRD_PARTY',
  'INSUFFICIENT_SIGNAL',
  'SAFETY_INELIGIBLE',
] as const;
export type HypothesisNoTriggerReason = (typeof HYPOTHESIS_NO_TRIGGER_REASONS)[number];

export const HYPOTHESIS_AMBIGUOUS_REASONS = [
  'TRIGGER_LIKE_BUT_UNRESOLVED',
  'INPUT_BOUND_EXCEEDED',
] as const;
export type HypothesisAmbiguousReason = (typeof HYPOTHESIS_AMBIGUOUS_REASONS)[number];

export interface HypothesisGenerationTriggerInput {
  text: string;
  safetyDisposition: SafetyDisposition;
}

export type HypothesisGenerationTriggerClassification =
  | { classification: 'TRIGGER'; reason: HypothesisTriggerReason }
  | { classification: 'NO_TRIGGER'; reason: HypothesisNoTriggerReason }
  | { classification: 'AMBIGUOUS'; reason: HypothesisAmbiguousReason };
