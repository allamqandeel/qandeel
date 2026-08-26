import type { EvidenceItem } from '../memory/evidence.types';
import type { HimHypothesisGenerationContext } from './him-hypothesis-generation-context';
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
  /**
   * HIM Runtime Consumption v1: minimized advisory HIM structured state.
   * Optional ONLY to preserve frozen callers/tests that do not yet supply HIM;
   * the production background generation path supplies it for every fresh
   * Candidate Generator call. It is input context only - never Evidence, never
   * part of the proposal/output schema, never persisted.
   */
  himContext?: HimHypothesisGenerationContext;
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
