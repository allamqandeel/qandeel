import type { EvidenceKind } from '../memory/evidence.types';
import type { HypothesisDomain } from './hypothesis.types';
import type { HypothesisTriggerReason } from './hypothesis-generation-trigger-classification.types';

export const HYPOTHESIS_INTENT_EXTRACTION_PROVIDER = Symbol('HYPOTHESIS_INTENT_EXTRACTION_PROVIDER');
export const HYPOTHESIS_INTENT_EXTRACTION_SCHEMA_VERSION = 1 as const;
export const MAX_EXTRACTION_EVIDENCE_UNIVERSE = 64;
export const MAX_EXTRACTION_EVIDENCE_TEXT_CHARS = 1_000;
export const MAX_EXTRACTION_TOTAL_EVIDENCE_TEXT_CHARS = 16_000;

export interface HypothesisIntentExtractionProviderRequest {
  currentUserText: string;
  triggerReason: HypothesisTriggerReason;
  allowedDomains: ReadonlyArray<HypothesisDomain>;
  eligibleEvidence: ReadonlyArray<{
    evidenceId: string;
    evidenceKind: EvidenceKind;
    statement: string;
  }>;
  maxSelectedEvidence: number;
  schemaVersion: typeof HYPOTHESIS_INTENT_EXTRACTION_SCHEMA_VERSION;
}

export interface HypothesisIntentExtractionProviderOutput {
  problemText: string;
  domain: HypothesisDomain;
  selectedEvidenceIds: string[];
}

export interface HypothesisIntentExtractionProvider {
  extract(
    request: HypothesisIntentExtractionProviderRequest,
  ): Promise<HypothesisIntentExtractionProviderOutput>;
}

export type HypothesisIntentExtractionProviderErrorCode =
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'INVALID_STRUCTURED_OUTPUT'
  | 'PROVIDER_ERROR';

export class HypothesisIntentExtractionProviderError extends Error {
  constructor(readonly code: HypothesisIntentExtractionProviderErrorCode) {
    super('Hypothesis intent extraction provider failed.');
    this.name = 'HypothesisIntentExtractionProviderError';
  }
}
