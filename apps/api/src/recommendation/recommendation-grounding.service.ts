import { Injectable } from '@nestjs/common';
import { CONFIDENCE_MISSING_INFORMATION_CODES, CONFIDENCE_POLICY_VERSION } from '../hypothesis/confidence.types';
import { MAX_MODEL_HYPOTHESES, type HypothesisReasoningContext, type HypothesisReasoningItem, type HypothesisReasoningContextResult } from '../hypothesis/hypothesis-reasoning-context.types';
import { RECOMMENDATION_ACTIONABLE_MISSING_INFORMATION_CODES, RECOMMENDATION_GROUNDING_CONTRACT_VERSION, RecommendationGroundingInvariantError, type RecommendationGroundingResult } from './recommendation-grounding.types';

/**
 * Deterministic, read-only Reasoning → Recommendation grounding bridge.
 * Consumes only the canonical HypothesisReasoningContextResult; performs no
 * database, Memory, HIM, Question, Information Gap, or provider access, and
 * derives no ranking, utility, risk, reversibility, readiness, or confidence.
 */
@Injectable()
export class RecommendationGroundingService {
  ground(source: HypothesisReasoningContextResult): RecommendationGroundingResult {
    if (source.coverageState === 'EMPTY') {
      if (source.candidateHypothesisCount !== 0) this.reject();
      return { coverageState: 'EMPTY', reason: 'NO_ACTIVE_HYPOTHESES' };
    }
    const context = source.context;
    this.validateSource(context);
    const evaluatedCodes = new Set<string>();
    for (const item of context.hypotheses) {
      if (item.confidence.state === 'EXACT_CURRENT_VERSION_EVALUATED') {
        for (const code of item.confidence.missingInformationCodes) evaluatedCodes.add(code);
      }
    }
    const evaluatedCount = context.hypotheses.filter((item) => item.confidence.state === 'EXACT_CURRENT_VERSION_EVALUATED').length;
    return { coverageState: 'AVAILABLE', context: {
      contractVersion: RECOMMENDATION_GROUNDING_CONTRACT_VERSION,
      source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT',
      sourceContractVersion: context.contractVersion,
      currentVersionConfidenceCoverage: evaluatedCount === 0 ? 'NONE' : evaluatedCount === context.hypotheses.length ? 'FULL' : 'PARTIAL',
      actionableMissingInformationCodes: RECOMMENDATION_ACTIONABLE_MISSING_INFORMATION_CODES.filter((code) => evaluatedCodes.has(code)),
      unverifiedAssumptionsPresent: context.hypotheses.some((item) => item.assumptions.length > 0),
      contradictingEvidencePresent: context.hypotheses.some((item) => item.currentlyEligibleContradictingEvidenceCount > 0),
      sourceTruncated: context.truncated,
    } };
  }

  private validateSource(context: HypothesisReasoningContext): void {
    if (context.contractVersion !== 1 || context.source !== 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT' ||
      context.coverageState !== 'AVAILABLE' || typeof context.truncated !== 'boolean' ||
      !Array.isArray(context.hypotheses) || context.hypotheses.length === 0 ||
      context.hypotheses.length > MAX_MODEL_HYPOTHESES ||
      context.includedHypothesisCount !== context.hypotheses.length ||
      !Number.isSafeInteger(context.candidateHypothesisCount) ||
      context.candidateHypothesisCount < context.includedHypothesisCount ||
      context.truncated !== (context.includedHypothesisCount < context.candidateHypothesisCount)) this.reject();
    context.hypotheses.forEach((item) => this.validateItem(item));
  }

  private validateItem(item: HypothesisReasoningItem): void {
    if (!Array.isArray(item.assumptions) || !Number.isSafeInteger(item.hypothesisVersion) || item.hypothesisVersion < 1 ||
      !Number.isSafeInteger(item.currentlyEligibleSupportingEvidenceCount) || item.currentlyEligibleSupportingEvidenceCount < 0 ||
      !Number.isSafeInteger(item.currentlyEligibleContradictingEvidenceCount) || item.currentlyEligibleContradictingEvidenceCount < 0) this.reject();
    const confidence = item.confidence;
    if (confidence.state === 'NOT_EVALUATED_FOR_CURRENT_VERSION') {
      if (confidence.targetVersion !== item.hypothesisVersion) this.reject();
      return;
    }
    if (confidence.state !== 'EXACT_CURRENT_VERSION_EVALUATED' || confidence.targetVersion !== item.hypothesisVersion ||
      confidence.numericScore !== null || confidence.confidenceBand !== null ||
      confidence.calibrationState !== 'UNCALIBRATED' || confidence.stability !== 'UNASSESSED' ||
      confidence.policyVersion !== CONFIDENCE_POLICY_VERSION ||
      !Array.isArray(confidence.missingInformationCodes) ||
      confidence.missingInformationCodes.some((code) => !CONFIDENCE_MISSING_INFORMATION_CODES.includes(code))) this.reject();
  }

  private reject(): never { throw new RecommendationGroundingInvariantError(); }
}
