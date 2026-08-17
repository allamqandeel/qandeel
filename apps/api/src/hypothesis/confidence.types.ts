export const CONFIDENCE_TARGET_TYPES = ['HYPOTHESIS'] as const;
export type ConfidenceTargetType = (typeof CONFIDENCE_TARGET_TYPES)[number];

export const CONFIDENCE_BANDS = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

export const CONFIDENCE_MISSING_INFORMATION_CODES = [
  'NO_ELIGIBLE_EVIDENCE',
  'UNVERIFIED_ASSUMPTIONS',
  'COMPETING_HYPOTHESES_UNASSESSED',
  'CONFIDENCE_MODEL_UNCALIBRATED',
] as const;
export type ConfidenceMissingInformationCode = (typeof CONFIDENCE_MISSING_INFORMATION_CODES)[number];

export const CONFIDENCE_POLICY_VERSION = 'confidence-foundation-v1';
export const MAX_CONFIDENCE_EVIDENCE_PER_ROLE = 32;
export const MAX_CONFIDENCE_ASSUMPTIONS = 8;
export const MAX_CONFIDENCE_ALTERNATIVES = 16;

/** Internal assessment. A null score/band is intentional until canonical calibration exists. */
export interface ConfidenceEvaluationRecord {
  id: string;
  user_id: string;
  target_id: string;
  target_type: ConfidenceTargetType;
  target_version: number;
  version: number;
  lifecycle_state: 'EVALUATED';
  numeric_score: null;
  confidence_band: null;
  calibration_state: 'UNCALIBRATED';
  stability: 'UNASSESSED';
  supporting_evidence_ids: string[];
  contradicting_evidence_ids: string[];
  assumptions: string[];
  alternative_hypothesis_ids: string[];
  missing_information_codes: ConfidenceMissingInformationCode[];
  policy_version: typeof CONFIDENCE_POLICY_VERSION;
  provenance: 'QANDEEL_CONFIDENCE_RUNTIME';
  created_at: string;
  updated_at: string;
}

export type CreateConfidenceEvaluation = Omit<
  ConfidenceEvaluationRecord,
  'created_at' | 'updated_at'
>;
