import type { ConfidenceMissingInformationCode } from './confidence.types';
import type { HypothesisDomain, HypothesisOrigin, HypothesisStatus, HypothesisType } from './hypothesis.types';

export const HYPOTHESIS_REASONING_CONTEXT_CONTRACT_VERSION = 1 as const;
export const MAX_MODEL_HYPOTHESES = 8;
export const MAX_HYPOTHESIS_CONTEXT_STRING_CHARS = 24_000;

export interface HypothesisReasoningItem {
  statement: string;
  type: HypothesisType;
  domain: HypothesisDomain;
  scope: string;
  origin: HypothesisOrigin;
  status: HypothesisStatus;
  hypothesisVersion: number;
  currentlyEligibleSupportingEvidenceCount: number;
  currentlyEligibleContradictingEvidenceCount: number;
  assumptions: readonly string[];
  disconfirmingConditions: readonly string[];
  confidence: {
    state: 'EXACT_CURRENT_VERSION_EVALUATED'; targetVersion: number; numericScore: null;
    confidenceBand: null; calibrationState: 'UNCALIBRATED'; stability: 'UNASSESSED';
    missingInformationCodes: readonly ConfidenceMissingInformationCode[]; policyVersion: string;
  } | { state: 'NOT_EVALUATED_FOR_CURRENT_VERSION'; targetVersion: number };
}

export interface HypothesisReasoningContext {
  contractVersion: 1;
  source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT';
  coverageState: 'AVAILABLE';
  candidateHypothesisCount: number;
  includedHypothesisCount: number;
  truncated: boolean;
  hypotheses: readonly HypothesisReasoningItem[];
}

export type HypothesisReasoningContextResult =
  | { coverageState: 'EMPTY'; candidateHypothesisCount: 0 }
  | { coverageState: 'AVAILABLE'; context: HypothesisReasoningContext };

export class HypothesisReasoningInvariantError extends Error {
  constructor() { super('HYPOTHESIS_REASONING_CONTEXT_INVARIANT'); this.name = 'HypothesisReasoningInvariantError'; }
}
