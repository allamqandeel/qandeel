import { Injectable } from '@nestjs/common';
import { EvidenceService } from '../memory/evidence.service';
import { ConfidenceRepository, MAX_BULK_CONFIDENCE_ROWS } from './confidence.repository';
import { CONFIDENCE_MISSING_INFORMATION_CODES, CONFIDENCE_POLICY_VERSION, type ConfidenceEvaluationRecord } from './confidence.types';
import { HypothesisService } from './hypothesis.service';
import { HYPOTHESIS_DOMAINS, HYPOTHESIS_ORIGINS, HYPOTHESIS_STATUSES, HYPOTHESIS_TYPES, MAX_ACTIVE_HYPOTHESES, MAX_ASSUMPTIONS, MAX_DISCONFIRMING_CONDITIONS, MAX_EVIDENCE_LINKS_PER_ROLE, MAX_SCOPE_LENGTH, MAX_STATEMENT_LENGTH, MAX_STRUCTURED_TEXT_LENGTH, type HypothesisRecord } from './hypothesis.types';
import { HYPOTHESIS_REASONING_CONTEXT_CONTRACT_VERSION, HypothesisReasoningInvariantError, MAX_HYPOTHESIS_CONTEXT_STRING_CHARS, MAX_MODEL_HYPOTHESES, type HypothesisReasoningContextResult, type HypothesisReasoningItem } from './hypothesis-reasoning-context.types';

@Injectable()
export class HypothesisReasoningContextService {
  constructor(private readonly hypotheses: HypothesisService, private readonly evidence: EvidenceService, private readonly confidence: ConfidenceRepository) {}

  async build(userId: string, token: string): Promise<HypothesisReasoningContextResult> {
    const candidates = await this.hypotheses.listActiveForUser(userId, token);
    if (!Array.isArray(candidates) || candidates.length > MAX_ACTIVE_HYPOTHESES) this.reject();
    if (candidates.length === 0) return { coverageState: 'EMPTY', candidateHypothesisCount: 0 };
    candidates.forEach((value) => this.validateHypothesis(value, userId));
    const [eligibleEvidence, evaluations] = await Promise.all([
      this.evidence.listEligibleForUser(userId, token),
      this.confidence.listExactVersionsForTargets(token, userId, candidates.map(({ id, version }) => ({ id, version }))),
    ]);
    const eligibleIds = new Set(eligibleEvidence.map(({ evidenceId }) => evidenceId));
    if (!Array.isArray(evaluations) || evaluations.length >= MAX_BULK_CONFIDENCE_ROWS) this.reject();
    const evaluationsByTarget = new Map<string, ConfidenceEvaluationRecord>();
    for (const evaluation of evaluations) {
      const target = candidates.find(({ id }) => id === evaluation.target_id);
      if (!target) this.reject();
      this.validateConfidence(evaluation, userId, target);
      if (!evaluationsByTarget.has(evaluation.target_id)) evaluationsByTarget.set(evaluation.target_id, evaluation);
    }
    const included: HypothesisReasoningItem[] = [];
    let chars = 0;
    for (const candidate of candidates) {
      if (included.length === MAX_MODEL_HYPOTHESES) break;
      this.validateLinks(candidate);
      const evaluation = evaluationsByTarget.get(candidate.id);
      const item: HypothesisReasoningItem = {
        statement: candidate.statement, type: candidate.type, domain: candidate.domain, scope: candidate.scope,
        origin: candidate.origin, status: candidate.status, hypothesisVersion: candidate.version,
        currentlyEligibleSupportingEvidenceCount: candidate.supporting_evidence_ids.filter((id) => eligibleIds.has(id)).length,
        currentlyEligibleContradictingEvidenceCount: candidate.contradicting_evidence_ids.filter((id) => eligibleIds.has(id)).length,
        assumptions: [...candidate.assumptions], disconfirmingConditions: [...candidate.disconfirming_conditions],
        confidence: evaluation ? {
          state: 'EXACT_CURRENT_VERSION_EVALUATED', targetVersion: evaluation.target_version,
          numericScore: null, confidenceBand: null, calibrationState: 'UNCALIBRATED', stability: 'UNASSESSED',
          missingInformationCodes: [...evaluation.missing_information_codes], policyVersion: evaluation.policy_version,
        } : { state: 'NOT_EVALUATED_FOR_CURRENT_VERSION', targetVersion: candidate.version },
      };
      const itemChars = stringCharacterCount(item);
      if (chars + itemChars > MAX_HYPOTHESIS_CONTEXT_STRING_CHARS) break;
      included.push(item); chars += itemChars;
    }
    if (included.length === 0) this.reject();
    return { coverageState: 'AVAILABLE', context: {
      contractVersion: HYPOTHESIS_REASONING_CONTEXT_CONTRACT_VERSION,
      source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT', coverageState: 'AVAILABLE',
      candidateHypothesisCount: candidates.length, includedHypothesisCount: included.length,
      truncated: included.length < candidates.length, hypotheses: included,
    } };
  }

  private validateHypothesis(value: HypothesisRecord, userId: string): void {
    const active = HYPOTHESIS_STATUSES.slice(0, 5).concat('REOPENED' as never);
    if (value.user_id !== userId || typeof value.id !== 'string' || !Number.isSafeInteger(value.version) || value.version < 1 ||
      !HYPOTHESIS_TYPES.includes(value.type) || !HYPOTHESIS_DOMAINS.includes(value.domain) || !HYPOTHESIS_ORIGINS.includes(value.origin) || !active.includes(value.status) ||
      !validText(value.statement, MAX_STATEMENT_LENGTH) || !validText(value.scope, MAX_SCOPE_LENGTH) ||
      !validStringList(value.assumptions, MAX_ASSUMPTIONS, MAX_STRUCTURED_TEXT_LENGTH) || !validStringList(value.disconfirming_conditions, MAX_DISCONFIRMING_CONDITIONS, MAX_STRUCTURED_TEXT_LENGTH)) this.reject();
  }
  private validateLinks(value: HypothesisRecord): void {
    const support = value.supporting_evidence_ids, contradict = value.contradicting_evidence_ids;
    if (!validIds(support, MAX_EVIDENCE_LINKS_PER_ROLE) || !validIds(contradict, MAX_EVIDENCE_LINKS_PER_ROLE) || support.some((id) => contradict.includes(id))) this.reject();
  }
  private validateConfidence(value: ConfidenceEvaluationRecord, userId: string, target: HypothesisRecord): void {
    if (value.user_id !== userId || value.target_id !== target.id || value.target_type !== 'HYPOTHESIS' || value.target_version !== target.version ||
      !Number.isSafeInteger(value.version) || value.version < 1 || value.lifecycle_state !== 'EVALUATED' || value.numeric_score !== null || value.confidence_band !== null ||
      value.calibration_state !== 'UNCALIBRATED' || value.stability !== 'UNASSESSED' || value.policy_version !== CONFIDENCE_POLICY_VERSION || value.provenance !== 'QANDEEL_CONFIDENCE_RUNTIME' ||
      !validIds(value.supporting_evidence_ids, MAX_EVIDENCE_LINKS_PER_ROLE) || !validIds(value.contradicting_evidence_ids, MAX_EVIDENCE_LINKS_PER_ROLE) ||
      value.supporting_evidence_ids.some((id) => value.contradicting_evidence_ids.includes(id)) ||
      !validStringList(value.assumptions, MAX_ASSUMPTIONS, MAX_STRUCTURED_TEXT_LENGTH) || !validIds(value.alternative_hypothesis_ids, 16) ||
      !Array.isArray(value.missing_information_codes) || new Set(value.missing_information_codes).size !== value.missing_information_codes.length ||
      value.missing_information_codes.some((code) => !CONFIDENCE_MISSING_INFORMATION_CODES.includes(code))) this.reject();
  }
  private reject(): never { throw new HypothesisReasoningInvariantError(); }
}

function validText(value: unknown, max: number): value is string { return typeof value === 'string' && value.length > 0 && value.trim() === value && [...value].length <= max; }
function validStringList(value: unknown, maxItems: number, maxChars: number): value is string[] { return Array.isArray(value) && value.length <= maxItems && new Set(value).size === value.length && value.every((item) => validText(item, maxChars)); }
function validIds(value: unknown, max: number): value is string[] { return Array.isArray(value) && value.length <= max && new Set(value).size === value.length && value.every((id) => typeof id === 'string' && id.length > 0); }
function stringCharacterCount(value: HypothesisReasoningItem): number { return [value.statement, value.type, value.domain, value.scope, value.origin, value.status, ...value.assumptions, ...value.disconfirmingConditions, value.confidence.state, ...(value.confidence.state === 'EXACT_CURRENT_VERSION_EVALUATED' ? [value.confidence.calibrationState, value.confidence.stability, value.confidence.policyVersion, ...value.confidence.missingInformationCodes] : [])].reduce((sum, text) => sum + [...text].length, 0); }
