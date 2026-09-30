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

const EVALUATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

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

  /**
   * W3-MEGA-U R2 — the exact-version evaluation ENSURED under a durable evaluation identity the caller owns (an
   * Understanding contest's `confidence_evaluation_id`, migration 0127), so repeated and concurrent requests for the
   * same re-evaluation converge on ONE Confidence row instead of each creating a fresh random one. The identity is the
   * evaluation's primary key: an existing row under it is verified and returned; otherwise the canonical command
   * creates it under that id (every canonical field is still derived by the database, exactly as for
   * evaluateHypothesisVersion); if that create fails because a concurrent request won the key, the SAME id is re-read
   * and verified. A row under the id that is not this exact evaluation is an integrity failure, never a success.
   * General Confidence history is unchanged: this adds no uniqueness over (target, version) and other callers keep
   * their fresh-identity evaluations.
   */
  async ensureHypothesisVersionEvaluation(
    userId: string, token: string, hypothesisId: string, targetVersion: number, evaluationId: string,
  ): Promise<ConfidenceEvaluationRecord> {
    if (!Number.isSafeInteger(targetVersion) || targetVersion < 1) {
      throw new BadRequestException('Invalid confidence target version.');
    }
    if (typeof evaluationId !== 'string' || !EVALUATION_ID.test(evaluationId)) throw new Error('CONFIDENCE_EVALUATION_IDENTITY_INVALID');
    const existing = await this.repository.find(token, userId, evaluationId);
    if (existing) return this.exactEvaluation(existing, userId, hypothesisId, targetVersion, evaluationId);
    const { evaluation } = await this.snapshot(userId, token, hypothesisId);
    let created: ConfidenceEvaluationRecord | undefined;
    try {
      created = await this.repository.create(token, { ...evaluation, id: evaluationId, target_version: targetVersion });
    } catch (error) {
      // A concurrent ensure for the same identity committed first: converge on its row, or report the original failure.
      const winner = await this.repository.find(token, userId, evaluationId);
      if (!winner) throw error;
      return this.exactEvaluation(winner, userId, hypothesisId, targetVersion, evaluationId);
    }
    return this.exactEvaluation(created, userId, hypothesisId, targetVersion, evaluationId);
  }

  async listHistory(userId: string, token: string, hypothesisId: string): Promise<ConfidenceEvaluationRecord[]> {
    await this.hypotheses.find(userId, token, hypothesisId);
    return this.repository.listForTarget(token, userId, hypothesisId);
  }

  private exactEvaluation(
    value: ConfidenceEvaluationRecord | undefined, userId: string, hypothesisId: string, targetVersion: number, evaluationId: string,
  ): ConfidenceEvaluationRecord {
    if (!value || value.id !== evaluationId || value.user_id !== userId || value.target_id !== hypothesisId ||
      value.target_type !== 'HYPOTHESIS' || value.target_version !== targetVersion || value.lifecycle_state !== 'EVALUATED' ||
      value.numeric_score !== null || value.confidence_band !== null || value.calibration_state !== 'UNCALIBRATED' ||
      value.stability !== 'UNASSESSED' || value.policy_version !== CONFIDENCE_POLICY_VERSION ||
      value.provenance !== 'QANDEEL_CONFIDENCE_RUNTIME') {
      throw new Error('CONFIDENCE_TARGET_VERSION_INTEGRITY');
    }
    return value;
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
