import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EvidenceService } from '../memory/evidence.service';
import {
  CONFIDENCE_POLICY_VERSION,
  type ConfidenceEvaluationRecord,
  type ConfidenceMissingInformationCode,
} from './confidence.types';
import { ConfidenceRepository } from './confidence.repository';
import { HypothesisService } from './hypothesis.service';

@Injectable()
export class ConfidenceService {
  constructor(
    private readonly hypotheses: HypothesisService,
    private readonly evidence: EvidenceService,
    private readonly repository: ConfidenceRepository,
  ) {}

  async evaluateHypothesis(userId: string, token: string, hypothesisId: string): Promise<ConfidenceEvaluationRecord> {
    const [hypothesis, eligibleEvidence] = await Promise.all([
      this.hypotheses.find(userId, token, hypothesisId),
      this.evidence.listEligibleForUser(userId, token),
    ]);
    const eligibleIds = new Set(eligibleEvidence.map((item) => item.evidenceId));
    const supporting = hypothesis.supporting_evidence_ids.filter((id) => eligibleIds.has(id));
    const contradicting = hypothesis.contradicting_evidence_ids.filter((id) => eligibleIds.has(id));
    const missing: ConfidenceMissingInformationCode[] = ['CONFIDENCE_MODEL_UNCALIBRATED'];
    if (supporting.length + contradicting.length === 0) missing.unshift('NO_ELIGIBLE_EVIDENCE');
    if (hypothesis.assumptions.length > 0) missing.unshift('UNVERIFIED_ASSUMPTIONS');
    if (hypothesis.competing_hypothesis_ids.length > 0) missing.unshift('COMPETING_HYPOTHESES_UNASSESSED');

    return this.repository.create(token, {
      id: randomUUID(), user_id: userId, target_id: hypothesis.id, target_type: 'HYPOTHESIS',
      target_version: hypothesis.version, version: 1, lifecycle_state: 'EVALUATED',
      numeric_score: null, confidence_band: null, calibration_state: 'UNCALIBRATED', stability: 'UNASSESSED',
      supporting_evidence_ids: supporting, contradicting_evidence_ids: contradicting,
      assumptions: [...hypothesis.assumptions],
      alternative_hypothesis_ids: [...hypothesis.competing_hypothesis_ids],
      missing_information_codes: missing,
      policy_version: CONFIDENCE_POLICY_VERSION, provenance: 'QANDEEL_CONFIDENCE_RUNTIME',
    });
  }

  async listHistory(userId: string, token: string, hypothesisId: string): Promise<ConfidenceEvaluationRecord[]> {
    await this.hypotheses.find(userId, token, hypothesisId);
    return this.repository.listForTarget(token, userId, hypothesisId);
  }
}
