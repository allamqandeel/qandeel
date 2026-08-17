import type { ConfidenceEvaluationRecord } from './confidence.types';
import type { EvidenceRole, HypothesisRecord } from './hypothesis.types';

export const HYPOTHESIS_UPDATE_SOURCE = 'QANDEEL_HYPOTHESIS_UPDATE_LOOP' as const;

export interface HypothesisUpdateRequest {
  hypothesisId: string;
  expectedVersion: number;
  evidenceId: string;
  evidenceRole: EvidenceRole;
}

export interface HypothesisUpdateRecord {
  id: string;
  user_id: string;
  hypothesis_id: string;
  before_version: number;
  after_version: number;
  evidence_id: string;
  evidence_role: EvidenceRole;
  source: typeof HYPOTHESIS_UPDATE_SOURCE;
  created_at: string;
}

export interface HypothesisMutationResult {
  update: HypothesisUpdateRecord;
  hypothesis: HypothesisRecord;
}

export type HypothesisUpdateResult = HypothesisMutationResult & (
  | { confidenceStatus: 'EVALUATED'; confidenceEvaluation: ConfidenceEvaluationRecord }
  | { confidenceStatus: 'PENDING_RETRY'; confidenceEvaluation: null }
);
