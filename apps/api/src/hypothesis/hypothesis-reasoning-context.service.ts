import { Injectable, Optional } from '@nestjs/common';
import { EvidenceService } from '../memory/evidence.service';
import { ConfidenceRepository, MAX_BULK_CONFIDENCE_ROWS } from './confidence.repository';
import { CONFIDENCE_MISSING_INFORMATION_CODES, CONFIDENCE_POLICY_VERSION, type ConfidenceEvaluationRecord } from './confidence.types';
import { HypothesisService } from './hypothesis.service';
import { DISCUSSION_FOCUS_WINDOW_MS, HypothesisUserSignalRepository, type HypothesisDiscussionFocusRow } from './hypothesis-user-signal.repository';
import { HYPOTHESIS_DOMAINS, HYPOTHESIS_ORIGINS, HYPOTHESIS_STATUSES, HYPOTHESIS_TYPES, MAX_ACTIVE_HYPOTHESES, MAX_ASSUMPTIONS, MAX_DISCONFIRMING_CONDITIONS, MAX_EVIDENCE_LINKS_PER_ROLE, MAX_SCOPE_LENGTH, MAX_STATEMENT_LENGTH, MAX_STRUCTURED_TEXT_LENGTH, type HypothesisRecord } from './hypothesis.types';
import { HYPOTHESIS_REASONING_CONTEXT_CONTRACT_VERSION, HypothesisReasoningInvariantError, MAX_HYPOTHESIS_CONTEXT_STRING_CHARS, MAX_MODEL_HYPOTHESES, type HypothesisReasoningContextResult, type HypothesisReasoningItem } from './hypothesis-reasoning-context.types';

@Injectable()
export class HypothesisReasoningContextService {
  constructor(
    private readonly hypotheses: HypothesisService, private readonly evidence: EvidenceService, private readonly confidence: ConfidenceRepository,
    // W3-MEGA-U: the reader's own explicit Understanding signals. Absent only where a caller composes the service
    // without the Hypothesis module (unit tests); the module always provides it.
    @Optional() private readonly signals?: HypothesisUserSignalRepository,
  ) {}

  async build(userId: string, token: string): Promise<HypothesisReasoningContextResult> {
    const candidates = await this.hypotheses.listActiveForUser(userId, token);
    if (!Array.isArray(candidates) || candidates.length > MAX_ACTIVE_HYPOTHESES) this.reject();
    if (candidates.length === 0) return { coverageState: 'EMPTY', candidateHypothesisCount: 0 };
    candidates.forEach((value) => this.validateHypothesis(value, userId));
    const [eligibleEvidence, evaluations, focus, underReview] = await Promise.all([
      this.evidence.listEligibleForUser(userId, token),
      this.confidence.listExactVersionsForTargets(token, userId, candidates.map(({ id, version }) => ({ id, version }))),
      this.signals ? this.signals.readOpenDiscussionFocus(token, userId) : Promise.resolve(null),
      // U3 (PG-01): the reader's explicit disagreements. A contested interpretation is never offered as uncontested.
      this.signals ? this.signals.listUnderReview(token, userId, candidates.map(({ id }) => id)) : Promise.resolve(new Set<string>()),
    ]);
    // W3-MEGA-U U2: the ONE item the reader explicitly chose, from QANDEEL Understanding, to talk about — while its
    // focus is open and recent — is marked and offered first. W3-CORR-U (U-5): every other item the reader explicitly
    // disagreed with and is still under review comes next, ahead of ordinary items, so an active contest never gives
    // way to an ordinary item under the model bound. Both groups are the reader's own explicit acts, not a relevance
    // ranking (that remains QAN-BL-CTX-01): within each group, and for every other item, the repository order is kept.
    const discussedId = this.discussedHypothesisId(focus, candidates);
    const ordered = [
      ...candidates.filter(({ id }) => id === discussedId),
      ...candidates.filter(({ id }) => id !== discussedId && underReview.has(id)),
      ...candidates.filter(({ id }) => id !== discussedId && !underReview.has(id)),
    ];
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
    for (const candidate of ordered) {
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
        ...(candidate.id === discussedId ? { userDiscussion: 'OPENED_FROM_UNDERSTANDING' as const } : {}),
        ...(underReview.has(candidate.id) ? { userContest: 'UNDER_REVIEW' as const } : {}),
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
  private discussedHypothesisId(focus: HypothesisDiscussionFocusRow | null, candidates: readonly HypothesisRecord[]): string | null {
    if (focus === null) return null;
    const openedAt = typeof focus.opened_at === 'string' ? Date.parse(focus.opened_at) : Number.NaN;
    if (typeof focus.hypothesis_id !== 'string' || !Number.isSafeInteger(focus.hypothesis_version) || focus.hypothesis_version < 1 ||
      !Number.isFinite(openedAt)) this.reject();
    if (Date.now() - openedAt > DISCUSSION_FOCUS_WINDOW_MS) return null;
    // R2: the reader chose the EXACT revision they saw. Once that item has advanced, the focus names an interpretation
    // that is no longer current, so it marks nothing — it is never silently moved onto the newer version here. The one
    // lawful move is the database's own (W3-CORR-U, migration 0134): the reader's disagreement re-binds their open focus
    // to the re-evaluated version inside the same transaction, so the exact match below still holds after it.
    return candidates.some(({ id, version }) => id === focus.hypothesis_id && version === focus.hypothesis_version)
      ? focus.hypothesis_id : null;
  }
  private reject(): never { throw new HypothesisReasoningInvariantError(); }
}

function validText(value: unknown, max: number): value is string { return typeof value === 'string' && value.length > 0 && value.trim() === value && [...value].length <= max; }
function validStringList(value: unknown, maxItems: number, maxChars: number): value is string[] { return Array.isArray(value) && value.length <= maxItems && new Set(value).size === value.length && value.every((item) => validText(item, maxChars)); }
function validIds(value: unknown, max: number): value is string[] { return Array.isArray(value) && value.length <= max && new Set(value).size === value.length && value.every((id) => typeof id === 'string' && id.length > 0); }
function stringCharacterCount(value: HypothesisReasoningItem): number { return [value.statement, value.type, value.domain, value.scope, value.origin, value.status, ...value.assumptions, ...value.disconfirmingConditions, value.confidence.state, ...(value.confidence.state === 'EXACT_CURRENT_VERSION_EVALUATED' ? [value.confidence.calibrationState, value.confidence.stability, value.confidence.policyVersion, ...value.confidence.missingInformationCodes] : [])].reduce((sum, text) => sum + [...text].length, 0); }
