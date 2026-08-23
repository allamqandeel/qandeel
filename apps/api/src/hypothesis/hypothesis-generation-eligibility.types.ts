export const HYPOTHESIS_GENERATION_ELIGIBILITY_REASONS = [
  'TRIGGER_AND_EVIDENCE_AVAILABLE',
  'NO_TRIGGER',
  'AMBIGUOUS_TRIGGER',
  'SAFETY_INELIGIBLE',
  'NO_ELIGIBLE_EVIDENCE',
  'REPLAY_OR_DUPLICATE',
  'EVALUATION_FAILED',
] as const;

export type HypothesisGenerationEligibilityReason =
  (typeof HYPOTHESIS_GENERATION_ELIGIBILITY_REASONS)[number];

export type HypothesisGenerationEligibilityResult =
  | { status: 'ELIGIBLE'; reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' }
  | {
      status: 'NOT_ELIGIBLE';
      reason: Exclude<
        HypothesisGenerationEligibilityReason,
        'TRIGGER_AND_EVIDENCE_AVAILABLE'
      >;
    };
