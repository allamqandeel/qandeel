import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EvidenceService } from '../memory/evidence.service';
import {
  CONFIDENCE_POLICY_VERSION,
  type ConfidenceEvaluationRecord,
  type ConfidenceMissingInformationCode,
  type CreateConfidenceEvaluation,
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
    const { hypothesis, evaluation } = await this.snapshot(userId, token, hypothesisId);
    return this.repository.create(token, { ...evaluation, target_version: hypothesis.version });
  }

  /**
   * Exact-version post-update Confidence (Finding 09, QAN-AUD-07). The target
   * version is the caller's authoritative mutation.update.after_version - it is
   * NEVER rediscovered from the ID-only re-read below, which exists solely to
   * preserve ownership and the evaluation snapshot shape. The exact
   * targetVersion is sent to the canonical database command, whose
   * stale-version guard stays the final authority: if the Hypothesis advanced
   * past targetVersion, the command rejects and this method throws - it never
   * silently substitutes a later version. The returned record's target is
   * defensively re-verified before it is trusted.
   */
  async evaluateHypothesisVersion(
    userId: string, token: string, hypothesisId: string, targetVersion: number,
  ): Promise<ConfidenceEvaluationRecord> {
    if (!Number.isSafeInteger(targetVersion) || targetVersion < 1) {
      throw new BadRequestException('Invalid confidence target version.');
    }
    const { evaluation } = await this.snapshot(userId, token, hypothesisId);
    const created = await this.repository.create(token, { ...evaluation, target_version: targetVersion });
    if (!created || created.target_version !== targetVersion || created.target_id !== hypothesisId ||
      created.user_id !== userId || created.target_type !== 'HYPOTHESIS' || created.provenance !== 'QANDEEL_CONFIDENCE_RUNTIME') {
      throw new Error('CONFIDENCE_TARGET_VERSION_INTEGRITY');
    }
    return created;
  }

  async listHistory(userId: string, token: string, hypothesisId: string): Promise<ConfidenceEvaluationRecord[]> {
    await this.hypotheses.find(userId, token, hypothesisId);
    return this.repository.listForTarget(token, userId, hypothesisId);
  }

  // The one owned evaluation snapshot both evaluation paths share: only the
  // target_version differs (current for general evaluation, the exact caller
  // version for post-update evaluation). The database command re-derives every
  // canonical Evidence and uncertainty field server-side regardless.
  private async snapshot(userId: string, token: string, hypothesisId: string) {
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

    const evaluation: Omit<CreateConfidenceEvaluation, 'target_version'> = {
      id: randomUUID(), user_id: userId, target_id: hypothesis.id, target_type: 'HYPOTHESIS',
      version: 1, lifecycle_state: 'EVALUATED',
      numeric_score: null, confidence_band: null, calibration_state: 'UNCALIBRATED', stability: 'UNASSESSED',
      supporting_evidence_ids: supporting, contradicting_evidence_ids: contradicting,
      assumptions: [...hypothesis.assumptions],
      alternative_hypothesis_ids: [...hypothesis.competing_hypothesis_ids],
      missing_information_codes: missing,
      policy_version: CONFIDENCE_POLICY_VERSION, provenance: 'QANDEEL_CONFIDENCE_RUNTIME',
    };
    return { hypothesis, evaluation };
  }
}
