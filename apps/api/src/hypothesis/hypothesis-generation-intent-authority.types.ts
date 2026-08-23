import type { EvidenceItem } from '../memory/evidence.types';
import type { HypothesisDomain } from './hypothesis.types';
import type { HypothesisGenerationTriggerClassification } from './hypothesis-generation-trigger-classification.types';

export const MAX_INTENT_EVIDENCE_IDS = 8;
export const INTENT_PROBLEM_SOURCE = 'CURRENT_USER_TURN' as const;
export const INTENT_SCOPE_KIND = 'CONVERSATION_SESSION' as const;

export interface HypothesisGenerationIntentCandidate {
  problem: {
    text: string;
    source: typeof INTENT_PROBLEM_SOURCE;
    sourceTurnId: string;
  };
  domain: HypothesisDomain;
  scope: {
    kind: typeof INTENT_SCOPE_KIND;
    sessionId: string;
  };
  evidenceIds: string[];
}

export interface HypothesisGenerationIntentExtractorInput {
  currentUserTurn: {
    id: string;
    sessionId: string;
    text: string;
  };
  triggerClassification: HypothesisGenerationTriggerClassification;
  eligibleEvidence: ReadonlyArray<EvidenceItem>;
  allowedDomains: ReadonlyArray<HypothesisDomain>;
  bounds: {
    maxProblemCharacters: number;
    maxSelectedEvidence: typeof MAX_INTENT_EVIDENCE_IDS;
  };
}

/** Provider-neutral proposal port only. No concrete extractor is selected in v1. */
export interface HypothesisGenerationIntentCandidateExtractor {
  extract(
    input: HypothesisGenerationIntentExtractorInput,
  ): Promise<HypothesisGenerationIntentCandidate>;
}

export interface AuthorizedHypothesisGenerationIntent {
  problem: {
    text: string;
    source: typeof INTENT_PROBLEM_SOURCE;
    sourceTurnId: string;
  };
  domain: HypothesisDomain;
  scope: {
    kind: typeof INTENT_SCOPE_KIND;
    sessionId: string;
    serialized: string;
  };
  evidenceIds: string[];
}

export const HYPOTHESIS_GENERATION_INTENT_REJECTION_REASONS = [
  'PROBLEM_NOT_GROUNDED',
  'INVALID_DOMAIN',
  'INVALID_SCOPE_AUTHORITY',
  'NO_SELECTED_EVIDENCE',
  'TOO_MANY_SELECTED_EVIDENCE',
  'EVIDENCE_OUT_OF_UNIVERSE',
  'DUPLICATE_EVIDENCE',
  'TURN_PROVENANCE_MISMATCH',
  'SESSION_PROVENANCE_MISMATCH',
  'INVALID_CANDIDATE',
  'INPUT_BOUND_EXCEEDED',
  'EVIDENCE_UNIVERSE_INVALID',
] as const;

export type HypothesisGenerationIntentRejectionReason =
  (typeof HYPOTHESIS_GENERATION_INTENT_REJECTION_REASONS)[number];

export type HypothesisGenerationIntentAuthorityResult =
  | { status: 'AUTHORIZED'; intent: AuthorizedHypothesisGenerationIntent }
  | { status: 'NOT_AUTHORIZED'; reason: HypothesisGenerationIntentRejectionReason };

export interface HypothesisGenerationIntentAuthorityInput {
  eligibility: { status: 'ELIGIBLE'; reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' };
  currentTurn: {
    id: string;
    sessionId: string;
    role: 'USER';
    status: 'COMPLETED';
    text: string;
  };
  eligibleEvidenceUniverse: ReadonlyArray<EvidenceItem>;
  candidate: HypothesisGenerationIntentCandidate;
}
