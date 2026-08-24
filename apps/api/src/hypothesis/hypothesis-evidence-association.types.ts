import type { EvidenceItem } from '../memory/evidence.types';
import type { EvidenceRole, HypothesisDomain, HypothesisType } from './hypothesis.types';
import type { HypothesisUpdateRequest } from './hypothesis-update.types';

export const HYPOTHESIS_EVIDENCE_ASSOCIATION_CONTRACT_VERSION = 1 as const;
export const MAX_ASSOCIATION_HYPOTHESIS_CANDIDATES = 8;
export const MAX_ASSOCIATION_HYPOTHESIS_STRING_CHARACTERS = 24_000;
export const MAX_FRESH_EVIDENCE_ASSOCIATIONS = 4;

export interface FreshEvidenceAssociationItem {
  evidenceId: string;
  evidenceKind: EvidenceItem['evidenceKind'];
  statement: string;
  source: EvidenceItem['source'];
}

export interface HypothesisEvidenceAssociationCandidate {
  hypothesisId: string;
  hypothesisVersion: number;
  statement: string;
  type: HypothesisType;
  domain: HypothesisDomain;
  scope: string;
  assumptions: string[];
  disconfirmingConditions: string[];
  alreadySupporting: boolean;
  alreadyContradicting: boolean;
}

export interface HypothesisEvidenceAssociationSnapshot {
  contractVersion: typeof HYPOTHESIS_EVIDENCE_ASSOCIATION_CONTRACT_VERSION;
  freshEvidence: FreshEvidenceAssociationItem;
  candidateHypotheses: HypothesisEvidenceAssociationCandidate[];
  maxAssociationCount: typeof MAX_FRESH_EVIDENCE_ASSOCIATIONS;
}

export interface HypothesisEvidenceAssociationProposal {
  hypothesisId: string;
  evidenceRole: EvidenceRole;
}

export type HypothesisEvidenceAssociationPreparation =
  | { status: 'PREPARED'; snapshot: HypothesisEvidenceAssociationSnapshot }
  | { status: 'EMPTY'; reason: 'NO_SAME_SESSION_HYPOTHESES' }
  | { status: 'NOT_AUTHORIZED'; reason: 'FRESH_EVIDENCE_NOT_ELIGIBLE' | 'INVARIANT_REJECTED' };

export type HypothesisEvidenceAssociationAuthorization =
  | { status: 'AUTHORIZED'; commands: HypothesisUpdateRequest[] }
  | { status: 'NO_ASSOCIATION' }
  | { status: 'NOT_AUTHORIZED'; reason:
      'FRESH_EVIDENCE_NOT_ELIGIBLE' | 'INVALID_PROVIDER_OUTPUT' | 'TARGET_OUT_OF_UNIVERSE' |
      'DUPLICATE_TARGET' | 'ALREADY_ATTACHED' | 'OPPOSITE_ROLE_CONFLICT' |
      'STALE_HYPOTHESIS_VERSION' | 'BOUND_EXCEEDED' | 'INVARIANT_REJECTED' };
