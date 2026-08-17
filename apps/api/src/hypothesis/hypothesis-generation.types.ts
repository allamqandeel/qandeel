import type { EvidenceItem } from '../memory/evidence.types';
import type { HypothesisDomain, HypothesisRecord, HypothesisType } from './hypothesis.types';

export const MAX_GENERATED_HYPOTHESIS_CANDIDATES = 5;
export const MAX_GENERATION_EVIDENCE_ITEMS = 32;

export interface HypothesisGenerationInput {
  problem: string;
  domain: HypothesisDomain;
  scope: string;
  evidenceIds: string[];
}

/** Server-created, user-scoped input. Generators must not receive broader runtime context. */
export interface HypothesisGenerationRequest {
  userId: string;
  problem: string;
  domain: HypothesisDomain;
  scope: string;
  eligibleEvidence: ReadonlyArray<EvidenceItem>;
  existingActiveHypotheses: ReadonlyArray<HypothesisRecord>;
  maxCandidateCount: number;
}

export interface HypothesisCandidateProposal {
  statement: string;
  type: HypothesisType;
  domain: HypothesisDomain;
  scope: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  assumptions: string[];
  disconfirmingConditions: string[];
}

export interface HypothesisCandidateGenerator {
  generate(request: HypothesisGenerationRequest): Promise<ReadonlyArray<HypothesisCandidateProposal>>;
}

export type HypothesisCandidateRejectionReason =
  | 'INVALID_CANDIDATE'
  | 'CANDIDATE_LIMIT_EXCEEDED'
  | 'DUPLICATE_IN_BATCH'
  | 'DUPLICATE_ACTIVE_HYPOTHESIS'
  | 'EVIDENCE_OUTSIDE_REQUEST'
  | 'EVIDENCE_ROLE_CONFLICT';

export interface HypothesisGenerationResult {
  accepted: HypothesisRecord[];
  rejected: Array<{ candidateIndex: number; reason: HypothesisCandidateRejectionReason }>;
}
