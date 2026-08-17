export const HYPOTHESIS_TYPES = ['CAUSAL', 'BEHAVIORAL', 'MOTIVATIONAL', 'SITUATIONAL', 'RELATIONAL', 'DECISION', 'PREDICTIVE', 'INTERPRETIVE', 'STRATEGIC'] as const;
export type HypothesisType = (typeof HYPOTHESIS_TYPES)[number];
export const HYPOTHESIS_DOMAINS = ['GENERAL', 'RELATIONSHIP', 'WORK', 'DECISION', 'GOAL', 'INTERACTION'] as const;
export type HypothesisDomain = (typeof HYPOTHESIS_DOMAINS)[number];
export const HYPOTHESIS_ORIGINS = ['SYSTEM_GENERATED', 'HUMAN_REVIEWED', 'USER_PROPOSED', 'ADMIN_CONTROLLED'] as const;
export type HypothesisOrigin = (typeof HYPOTHESIS_ORIGINS)[number];
export const HYPOTHESIS_STATUSES = ['CANDIDATE', 'ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK', 'REJECTED', 'RETIRED', 'REOPENED'] as const;
export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];
export const MAX_ACTIVE_HYPOTHESES = 32;
export const MAX_EVIDENCE_LINKS_PER_ROLE = 32;
export const MAX_COMPETING_HYPOTHESES = 16;
export const MAX_ASSUMPTIONS = 8;
export const MAX_DISCONFIRMING_CONDITIONS = 8;
export const MAX_STATEMENT_LENGTH = 2000;
export const MAX_SCOPE_LENGTH = 500;
export const MAX_STRUCTURED_TEXT_LENGTH = 500;

export interface HypothesisRecord {
  id: string; user_id: string; statement: string; type: HypothesisType; domain: HypothesisDomain;
  scope: string; origin: HypothesisOrigin; status: HypothesisStatus; version: number;
  supporting_evidence_ids: string[]; contradicting_evidence_ids: string[];
  competing_hypothesis_ids: string[]; assumptions: string[]; disconfirming_conditions: string[];
  created_at: string; updated_at: string;
}
export interface CreateHypothesisInput {
  statement: string; type: HypothesisType; domain: HypothesisDomain; scope: string; origin: HypothesisOrigin;
  assumptions?: string[]; disconfirmingConditions?: string[];
}
export interface HypothesisView extends HypothesisRecord {
  currentlyEligibleSupportingEvidenceIds: string[];
  currentlyEligibleContradictingEvidenceIds: string[];
}
export type EvidenceRole = 'SUPPORTING' | 'CONTRADICTING';
