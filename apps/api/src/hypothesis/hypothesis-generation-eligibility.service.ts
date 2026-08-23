import { Injectable } from '@nestjs/common';
import type { SafetyDisposition } from '../conversation/safety-response-gate.types';
import { EvidenceService, MAX_ELIGIBLE_EVIDENCE } from '../memory/evidence.service';
import type {
  HypothesisGenerationEligibilityAssessment,
  HypothesisGenerationEligibilityResult,
} from './hypothesis-generation-eligibility.types';
import { HypothesisGenerationTriggerClassificationService } from './hypothesis-generation-trigger-classification.service';

@Injectable()
export class HypothesisGenerationEligibilityService {
  constructor(
    private readonly evidence: EvidenceService,
    private readonly classifier: HypothesisGenerationTriggerClassificationService,
  ) {}

  async evaluate(
    userId: string,
    accessToken: string,
    text: string,
    safetyDisposition: SafetyDisposition,
  ): Promise<HypothesisGenerationEligibilityResult> {
    return (await this.evaluateWithContext(userId, accessToken, text, safetyDisposition)).eligibility;
  }

  async evaluateWithContext(
    userId: string,
    accessToken: string,
    text: string,
    safetyDisposition: SafetyDisposition,
  ): Promise<HypothesisGenerationEligibilityAssessment> {
    if (safetyDisposition !== 'ALLOW') {
      return { eligibility: { status: 'NOT_ELIGIBLE', reason: 'SAFETY_INELIGIBLE' } };
    }

    try {
      const evidence = await this.evidence.listEligibleForUser(userId, accessToken);
      if (!this.isBoundedEvidenceProjection(evidence)) {
        return { eligibility: { status: 'NOT_ELIGIBLE', reason: 'EVALUATION_FAILED' } };
      }

      const classification = this.classifier.classify({ text, safetyDisposition });
      if (classification.classification === 'NO_TRIGGER') {
        return { eligibility: { status: 'NOT_ELIGIBLE', reason: 'NO_TRIGGER' } };
      }
      if (classification.classification === 'AMBIGUOUS') {
        return { eligibility: { status: 'NOT_ELIGIBLE', reason: 'AMBIGUOUS_TRIGGER' } };
      }
      if (evidence.length === 0) {
        return { eligibility: { status: 'NOT_ELIGIBLE', reason: 'NO_ELIGIBLE_EVIDENCE' } };
      }
      return {
        eligibility: { status: 'ELIGIBLE', reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' },
        triggerClassification: classification,
        eligibleEvidence: evidence,
      };
    } catch {
      return { eligibility: { status: 'NOT_ELIGIBLE', reason: 'EVALUATION_FAILED' } };
    }
  }

  private isBoundedEvidenceProjection(value: unknown): value is ReadonlyArray<{ evidenceId: string }> {
    if (!Array.isArray(value) || value.length > MAX_ELIGIBLE_EVIDENCE) return false;
    const ids = value.map((item) => item?.evidenceId);
    return ids.every((id) => typeof id === 'string' && id.startsWith('memory:') && id.length > 7) &&
      new Set(ids).size === ids.length;
  }
}
