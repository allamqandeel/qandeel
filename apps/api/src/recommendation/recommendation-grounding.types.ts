export const RECOMMENDATION_GROUNDING_CONTRACT_VERSION = 1 as const;

/** Canonical output order; calibration state is deliberately not an actionable code. */
export const RECOMMENDATION_ACTIONABLE_MISSING_INFORMATION_CODES = [
  'NO_ELIGIBLE_EVIDENCE',
  'UNVERIFIED_ASSUMPTIONS',
  'COMPETING_HYPOTHESES_UNASSESSED',
] as const;
export type RecommendationActionableMissingInformationCode =
  (typeof RECOMMENDATION_ACTIONABLE_MISSING_INFORMATION_CODES)[number];

export type RecommendationConfidenceCoverage = 'NONE' | 'PARTIAL' | 'FULL';

/**
 * Minimized structural decision-support constraints derived from the canonical
 * HypothesisReasoningContext. Coverage is not confidence strength; booleans are
 * structural presence only. No IDs, statements, counts, scores, or ranks.
 */
export interface RecommendationGroundingContext {
  readonly contractVersion: 1;
  readonly source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT';
  readonly sourceContractVersion: 1;
  readonly currentVersionConfidenceCoverage: RecommendationConfidenceCoverage;
  readonly actionableMissingInformationCodes: readonly RecommendationActionableMissingInformationCode[];
  readonly unverifiedAssumptionsPresent: boolean;
  readonly contradictingEvidencePresent: boolean;
  readonly sourceTruncated: boolean;
}

export type RecommendationGroundingResult =
  | { readonly coverageState: 'EMPTY'; readonly reason: 'NO_ACTIVE_HYPOTHESES' }
  | { readonly coverageState: 'AVAILABLE'; readonly context: RecommendationGroundingContext };

export class RecommendationGroundingInvariantError extends Error {
  constructor() { super('RECOMMENDATION_GROUNDING_INVARIANT'); this.name = 'RecommendationGroundingInvariantError'; }
}
