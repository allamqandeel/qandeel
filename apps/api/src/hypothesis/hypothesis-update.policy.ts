import { BadRequestException } from '@nestjs/common';
import type { HypothesisUpdateRequest } from './hypothesis-update.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVIDENCE_ID = /^memory:[0-9a-f-]{36}$/i;

/**
 * The one canonical Hypothesis Update request validator. The foreground
 * authenticated path (HypothesisUpdateService) and the server-authorized
 * background invocation boundary (BackgroundIntelligenceEnrichmentService)
 * both converge on this policy, so a malformed command can never reach the
 * database from either side and the public error semantics stay identical.
 */
export function validateHypothesisUpdateRequest(request: HypothesisUpdateRequest): void {
  if (!request || !UUID.test(request.hypothesisId) || !EVIDENCE_ID.test(request.evidenceId)) {
    throw new BadRequestException('Malformed hypothesis update identifiers.');
  }
  if (!Number.isSafeInteger(request.expectedVersion) || request.expectedVersion < 1) {
    throw new BadRequestException('Expected version must be a positive integer.');
  }
  if (request.evidenceRole !== 'SUPPORTING' && request.evidenceRole !== 'CONTRADICTING') {
    throw new BadRequestException('Invalid evidence role.');
  }
}
