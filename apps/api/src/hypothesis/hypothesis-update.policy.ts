import { BadRequestException } from '@nestjs/common';
import { HYPOTHESIS_UPDATE_SOURCE } from './hypothesis-update.types';
import type { HypothesisMutationResult, HypothesisUpdateRequest } from './hypothesis-update.types';

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

/**
 * The one canonical Hypothesis Update mutation-integrity policy (Finding 09).
 * The foreground authenticated path (HypothesisUpdateService) and the
 * server-authorized background invocation boundary
 * (BackgroundIntelligenceEnrichmentService) both verify the returned mutation
 * tuple here before any post-update Confidence runs, so the two callers can
 * never drift: the tuple must be exactly the canonical mutation the invocation
 * asked for - context owner, target Hypothesis, Evidence identity and role,
 * before/after versions around the exact expected version, the audit update
 * UUID this invocation generated, and the immutable audit source. Anything
 * else fails closed - never a retry, never a repair. In particular,
 * update.after_version of a coherent tuple is the ONLY authoritative
 * post-update Confidence target: it is never rediscovered from a later
 * ID-only re-read.
 */
export function isCanonicalHypothesisUpdateMutation(
  mutation: HypothesisMutationResult, userId: string, updateId: string, request: HypothesisUpdateRequest,
): boolean {
  const { update, hypothesis } = mutation;
  return !!update && !!hypothesis
    && update.id === updateId
    && update.user_id === userId && hypothesis.user_id === userId
    && update.hypothesis_id === request.hypothesisId && hypothesis.id === request.hypothesisId
    && update.evidence_id === request.evidenceId
    && update.evidence_role === request.evidenceRole
    && update.before_version === request.expectedVersion
    && update.after_version === request.expectedVersion + 1
    && hypothesis.version === update.after_version
    && update.source === HYPOTHESIS_UPDATE_SOURCE;
}
