import { Injectable } from '@nestjs/common';
import { EvidenceService } from '../memory/evidence.service';
import type { EvidenceItem } from '../memory/evidence.types';
import {
  HYPOTHESIS_DOMAINS, HYPOTHESIS_STATUSES, HYPOTHESIS_TYPES, MAX_ACTIVE_HYPOTHESES,
  MAX_ASSUMPTIONS, MAX_DISCONFIRMING_CONDITIONS, MAX_EVIDENCE_LINKS_PER_ROLE,
  MAX_SCOPE_LENGTH, MAX_STATEMENT_LENGTH, MAX_STRUCTURED_TEXT_LENGTH, type HypothesisRecord,
} from './hypothesis.types';
import { HypothesisService } from './hypothesis.service';
import {
  HYPOTHESIS_EVIDENCE_ASSOCIATION_CONTRACT_VERSION,
  MAX_ASSOCIATION_HYPOTHESIS_CANDIDATES,
  MAX_ASSOCIATION_HYPOTHESIS_STRING_CHARACTERS,
  MAX_FRESH_EVIDENCE_ASSOCIATIONS,
  type HypothesisEvidenceAssociationAuthorization,
  type HypothesisEvidenceAssociationCandidate,
  type HypothesisEvidenceAssociationPreparation,
  type HypothesisEvidenceAssociationProposal,
  type HypothesisEvidenceAssociationSnapshot,
} from './hypothesis-evidence-association.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_STATUSES = new Set([...HYPOTHESIS_STATUSES.slice(0, 5), 'REOPENED']);

@Injectable()
export class HypothesisEvidenceAssociationAuthorityService {
  constructor(private readonly evidence: EvidenceService, private readonly hypotheses: HypothesisService) {}

  async prepare(
    userId: string, token: string, sessionId: string, freshEvidenceId: string,
  ): Promise<HypothesisEvidenceAssociationPreparation> {
    if (!UUID.test(sessionId) || !/^memory:[0-9a-f-]{36}$/i.test(freshEvidenceId)) {
      return { status: 'NOT_AUTHORIZED', reason: 'INVARIANT_REJECTED' };
    }
    const [eligibleEvidence, activeHypotheses] = await Promise.all([
      this.evidence.listEligibleForUser(userId, token),
      this.hypotheses.listActiveForUser(userId, token),
    ]);
    return this.prepareFromCanonicalState(userId, sessionId, freshEvidenceId, eligibleEvidence, activeHypotheses);
  }

  prepareFromCanonicalState(
    userId: string, sessionId: string, freshEvidenceId: string,
    eligibleEvidence: ReadonlyArray<EvidenceItem>, activeHypotheses: ReadonlyArray<HypothesisRecord>,
  ): HypothesisEvidenceAssociationPreparation {
    if (!UUID.test(sessionId) || !/^memory:[0-9a-f-]{36}$/i.test(freshEvidenceId)) {
      return { status: 'NOT_AUTHORIZED', reason: 'INVARIANT_REJECTED' };
    }
    const freshEvidence = eligibleEvidence.find(({ evidenceId }) => evidenceId === freshEvidenceId);
    if (!freshEvidence) return { status: 'NOT_AUTHORIZED', reason: 'FRESH_EVIDENCE_NOT_ELIGIBLE' };
    if (!Array.isArray(activeHypotheses) || activeHypotheses.length > MAX_ACTIVE_HYPOTHESES ||
      activeHypotheses.some((item) => !this.validActive(item, userId))) {
      return { status: 'NOT_AUTHORIZED', reason: 'INVARIANT_REJECTED' };
    }
    const scope = `CONVERSATION_SESSION:${sessionId}`;
    const sameSession = activeHypotheses.filter((item) => item.scope === scope);
    if (sameSession.length === 0) return { status: 'EMPTY', reason: 'NO_SAME_SESSION_HYPOTHESES' };

    const candidates: HypothesisEvidenceAssociationCandidate[] = [];
    let characters = 0;
    for (const hypothesis of sameSession) {
      if (candidates.length === MAX_ASSOCIATION_HYPOTHESIS_CANDIDATES) break;
      const candidate = this.project(hypothesis, freshEvidenceId);
      const candidateCharacters = this.characterCount(candidate);
      if (characters + candidateCharacters > MAX_ASSOCIATION_HYPOTHESIS_STRING_CHARACTERS) break;
      candidates.push(candidate);
      characters += candidateCharacters;
    }
    if (candidates.length === 0) return { status: 'EMPTY', reason: 'NO_SAME_SESSION_HYPOTHESES' };
    return { status: 'PREPARED', snapshot: {
      contractVersion: HYPOTHESIS_EVIDENCE_ASSOCIATION_CONTRACT_VERSION,
      freshEvidence: {
        evidenceId: freshEvidence.evidenceId, evidenceKind: freshEvidence.evidenceKind,
        statement: freshEvidence.statement, source: freshEvidence.source,
      },
      candidateHypotheses: candidates,
      maxAssociationCount: MAX_FRESH_EVIDENCE_ASSOCIATIONS,
    } };
  }

  async authorize(
    userId: string, token: string, sessionId: string,
    snapshot: HypothesisEvidenceAssociationSnapshot, proposals: unknown,
  ): Promise<HypothesisEvidenceAssociationAuthorization> {
    if (!this.validSnapshot(snapshot, sessionId)) return { status: 'NOT_AUTHORIZED', reason: 'INVARIANT_REJECTED' };
    if (!Array.isArray(proposals)) return { status: 'NOT_AUTHORIZED', reason: 'INVALID_PROVIDER_OUTPUT' };
    if (proposals.length === 0) return { status: 'NO_ASSOCIATION' };
    if (proposals.length > MAX_FRESH_EVIDENCE_ASSOCIATIONS) return { status: 'NOT_AUTHORIZED', reason: 'BOUND_EXCEEDED' };
    const parsed: HypothesisEvidenceAssociationProposal[] = [];
    const seen = new Set<string>();
    for (const value of proposals) {
      if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).length !== 2 || !('hypothesisId' in value) || !('evidenceRole' in value) ||
        typeof value.hypothesisId !== 'string' ||
        (value.evidenceRole !== 'SUPPORTING' && value.evidenceRole !== 'CONTRADICTING')) {
        return { status: 'NOT_AUTHORIZED', reason: 'INVALID_PROVIDER_OUTPUT' };
      }
      if (seen.has(value.hypothesisId)) return { status: 'NOT_AUTHORIZED', reason: 'DUPLICATE_TARGET' };
      seen.add(value.hypothesisId);
      parsed.push(value as HypothesisEvidenceAssociationProposal);
    }
    const supplied = new Map(snapshot.candidateHypotheses.map((item) => [item.hypothesisId, item]));
    if (parsed.some(({ hypothesisId }) => !supplied.has(hypothesisId))) {
      return { status: 'NOT_AUTHORIZED', reason: 'TARGET_OUT_OF_UNIVERSE' };
    }
    const [currentlyEligibleEvidence, current] = await Promise.all([
      this.evidence.listEligibleForUser(userId, token),
      this.hypotheses.listActiveForUser(userId, token),
    ]);
    return this.authorizeFromCanonicalState(userId, sessionId, snapshot, proposals, currentlyEligibleEvidence, current);
  }

  authorizeFromCanonicalState(
    userId: string, sessionId: string, snapshot: HypothesisEvidenceAssociationSnapshot, proposals: unknown,
    currentlyEligibleEvidence: ReadonlyArray<EvidenceItem>, current: ReadonlyArray<HypothesisRecord>,
  ): HypothesisEvidenceAssociationAuthorization {
    if (!this.validSnapshot(snapshot, sessionId)) return { status: 'NOT_AUTHORIZED', reason: 'INVARIANT_REJECTED' };
    if (!Array.isArray(proposals)) return { status: 'NOT_AUTHORIZED', reason: 'INVALID_PROVIDER_OUTPUT' };
    if (proposals.length === 0) return { status: 'NO_ASSOCIATION' };
    if (proposals.length > MAX_FRESH_EVIDENCE_ASSOCIATIONS) return { status: 'NOT_AUTHORIZED', reason: 'BOUND_EXCEEDED' };
    const parsed: HypothesisEvidenceAssociationProposal[] = [];
    const seen = new Set<string>();
    for (const value of proposals) {
      if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).length !== 2 || !('hypothesisId' in value) || !('evidenceRole' in value) ||
        typeof value.hypothesisId !== 'string' ||
        (value.evidenceRole !== 'SUPPORTING' && value.evidenceRole !== 'CONTRADICTING')) {
        return { status: 'NOT_AUTHORIZED', reason: 'INVALID_PROVIDER_OUTPUT' };
      }
      if (seen.has(value.hypothesisId)) return { status: 'NOT_AUTHORIZED', reason: 'DUPLICATE_TARGET' };
      seen.add(value.hypothesisId);
      parsed.push(value as HypothesisEvidenceAssociationProposal);
    }
    const supplied = new Map(snapshot.candidateHypotheses.map((item) => [item.hypothesisId, item]));
    if (parsed.some(({ hypothesisId }) => !supplied.has(hypothesisId))) {
      return { status: 'NOT_AUTHORIZED', reason: 'TARGET_OUT_OF_UNIVERSE' };
    }
    if (!currentlyEligibleEvidence.some(({ evidenceId }) => evidenceId === snapshot.freshEvidence.evidenceId)) {
      return { status: 'NOT_AUTHORIZED', reason: 'FRESH_EVIDENCE_NOT_ELIGIBLE' };
    }
    if (!Array.isArray(current) || current.length > MAX_ACTIVE_HYPOTHESES ||
      current.some((item) => !this.validActive(item, userId))) {
      return { status: 'NOT_AUTHORIZED', reason: 'INVARIANT_REJECTED' };
    }
    const currentById = new Map(current.map((item) => [item.id, item]));
    const commands = [];
    const scope = `CONVERSATION_SESSION:${sessionId}`;
    for (const proposal of parsed) {
      const candidate = supplied.get(proposal.hypothesisId)!;
      const target = currentById.get(proposal.hypothesisId);
      if (!target || target.scope !== scope || target.version !== candidate.hypothesisVersion) {
        return { status: 'NOT_AUTHORIZED', reason: 'STALE_HYPOTHESIS_VERSION' };
      }
      const own = proposal.evidenceRole === 'SUPPORTING' ? target.supporting_evidence_ids : target.contradicting_evidence_ids;
      const opposite = proposal.evidenceRole === 'SUPPORTING' ? target.contradicting_evidence_ids : target.supporting_evidence_ids;
      if (own.includes(snapshot.freshEvidence.evidenceId)) return { status: 'NOT_AUTHORIZED', reason: 'ALREADY_ATTACHED' };
      if (opposite.includes(snapshot.freshEvidence.evidenceId)) return { status: 'NOT_AUTHORIZED', reason: 'OPPOSITE_ROLE_CONFLICT' };
      commands.push({
        hypothesisId: target.id, expectedVersion: target.version,
        evidenceId: snapshot.freshEvidence.evidenceId, evidenceRole: proposal.evidenceRole,
      });
    }
    return { status: 'AUTHORIZED', commands };
  }

  private project(value: HypothesisRecord, evidenceId: string): HypothesisEvidenceAssociationCandidate {
    return {
      hypothesisId: value.id, hypothesisVersion: value.version, statement: value.statement,
      type: value.type, domain: value.domain, scope: value.scope, assumptions: [...value.assumptions],
      disconfirmingConditions: [...value.disconfirming_conditions],
      alreadySupporting: value.supporting_evidence_ids.includes(evidenceId),
      alreadyContradicting: value.contradicting_evidence_ids.includes(evidenceId),
    };
  }

  private characterCount(value: HypothesisEvidenceAssociationCandidate): number {
    return [value.statement, value.type, value.domain, value.scope,
      ...value.assumptions, ...value.disconfirmingConditions]
      .reduce((total, text) => total + [...text].length, 0);
  }

  private validActive(value: HypothesisRecord, userId: string): boolean {
    return value.user_id === userId && UUID.test(value.id) && Number.isSafeInteger(value.version) && value.version > 0 &&
      ACTIVE_STATUSES.has(value.status) && HYPOTHESIS_TYPES.includes(value.type) &&
      HYPOTHESIS_DOMAINS.includes(value.domain) && validText(value.statement, MAX_STATEMENT_LENGTH) &&
      validText(value.scope, MAX_SCOPE_LENGTH) && validIds(value.supporting_evidence_ids, MAX_EVIDENCE_LINKS_PER_ROLE) &&
      validIds(value.contradicting_evidence_ids, MAX_EVIDENCE_LINKS_PER_ROLE) &&
      !value.supporting_evidence_ids.some((id) => value.contradicting_evidence_ids.includes(id)) &&
      validTextList(value.assumptions, MAX_ASSUMPTIONS) &&
      validTextList(value.disconfirming_conditions, MAX_DISCONFIRMING_CONDITIONS);
  }

  private validSnapshot(value: HypothesisEvidenceAssociationSnapshot, sessionId: string): boolean {
    return UUID.test(sessionId) && value?.contractVersion === HYPOTHESIS_EVIDENCE_ASSOCIATION_CONTRACT_VERSION &&
      value.maxAssociationCount === MAX_FRESH_EVIDENCE_ASSOCIATIONS &&
      /^memory:[0-9a-f-]{36}$/i.test(value.freshEvidence?.evidenceId) &&
      Array.isArray(value.candidateHypotheses) &&
      value.candidateHypotheses.length <= MAX_ASSOCIATION_HYPOTHESIS_CANDIDATES &&
      value.candidateHypotheses.every((item) => item.scope === `CONVERSATION_SESSION:${sessionId}`);
  }
}

function validText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value && [...value].length <= maximum;
}
function validTextList(value: unknown, maximumItems: number): value is string[] {
  return Array.isArray(value) && value.length <= maximumItems && new Set(value).size === value.length &&
    value.every((item) => validText(item, MAX_STRUCTURED_TEXT_LENGTH));
}
function validIds(value: unknown, maximumItems: number): value is string[] {
  return Array.isArray(value) && value.length <= maximumItems && new Set(value).size === value.length &&
    value.every((item) => typeof item === 'string' && item.length > 0);
}
