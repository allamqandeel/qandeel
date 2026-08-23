import type { EvidenceItem } from '../memory/evidence.types';
import type {
  AuthorizedHypothesisGenerationIntent,
  HypothesisGenerationIntentRejectionReason,
} from './hypothesis-generation-intent-authority.types';
import type { HypothesisTriggerReason } from './hypothesis-generation-trigger-classification.types';

export type HypothesisGenerationIntentExtractionFailureReason =
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'INVALID_PROVIDER_OUTPUT'
  | 'PROVIDER_FAILED'
  | 'AUTHORITY_REJECTED';

export type HypothesisGenerationIntentExtractionResult =
  | { status: 'AUTHORIZED'; intent: AuthorizedHypothesisGenerationIntent }
  | {
      status: 'NOT_AUTHORIZED';
      reason: HypothesisGenerationIntentExtractionFailureReason;
      authorityReason?: HypothesisGenerationIntentRejectionReason;
    };

export interface HypothesisGenerationIntentExtractionInput {
  currentTurn: {
    id: string;
    sessionId: string;
    role: 'USER';
    status: 'COMPLETED';
    text: string;
  };
  eligibility: { status: 'ELIGIBLE'; reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' };
  triggerReason: HypothesisTriggerReason;
  eligibleEvidence: ReadonlyArray<EvidenceItem>;
}
