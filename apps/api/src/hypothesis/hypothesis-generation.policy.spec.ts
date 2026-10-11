import { validateHypothesisCandidate } from './hypothesis-generation.policy';
import type { HypothesisCandidateProposal, HypothesisGenerationRequest } from './hypothesis-generation.types';

// MEM-AR-01C CC-H1 (H-1): a generated Hypothesis needs at least one eligible supporting Evidence id. The check sits
// after EVIDENCE_OUTSIDE_REQUEST and EVIDENCE_ROLE_CONFLICT, so their precedence is unchanged.
const SELF = 'memory:00000000-0000-4000-8000-000000000001';
const OUTSIDE = 'memory:00000000-0000-4000-8000-000000000009';
const request = {
  userId: 'user-1', problem: 'Choosing between two jobs', domain: 'WORK', scope: 'Current work decision',
  eligibleEvidence: [{ evidenceId: SELF }, { evidenceId: 'memory:00000000-0000-4000-8000-000000000002' }],
  existingActiveHypotheses: [], maxCandidateCount: 3,
} as unknown as HypothesisGenerationRequest;
const candidate = (overrides: Partial<HypothesisCandidateProposal> = {}): HypothesisCandidateProposal => ({
  statement: 'Stability matters more than salary here.', type: 'CAUSAL', domain: 'WORK', scope: 'Current work decision',
  supportingEvidenceIds: [SELF], contradictingEvidenceIds: [], assumptions: [], disconfirmingConditions: [], ...overrides,
} as HypothesisCandidateProposal);
const validate = (proposal: HypothesisCandidateProposal) => validateHypothesisCandidate(proposal, request, new Set(), new Set());

describe('Hypothesis generation policy - MEM-AR-01C CC-H1 (H-1)', () => {
  it('rejects a candidate with no supporting Evidence', () => {
    expect(validate(candidate({ supportingEvidenceIds: [] }))).toBe('NO_SUPPORTING_EVIDENCE');
  });

  it('rejects a contradiction-only candidate: contradicting Evidence is not support', () => {
    expect(validate(candidate({ supportingEvidenceIds: [], contradictingEvidenceIds: [SELF] }))).toBe('NO_SUPPORTING_EVIDENCE');
  });

  it('accepts a supported candidate', () => {
    expect(validate(candidate())).toBeUndefined();
  });

  it('keeps the earlier reasons first: Evidence outside the request and a role conflict win over missing support', () => {
    expect(validate(candidate({ supportingEvidenceIds: [], contradictingEvidenceIds: [OUTSIDE] }))).toBe('EVIDENCE_OUTSIDE_REQUEST');
    expect(validate(candidate({ supportingEvidenceIds: [SELF], contradictingEvidenceIds: [SELF] }))).toBe('EVIDENCE_ROLE_CONFLICT');
    expect(validate(candidate({ supportingEvidenceIds: [], statement: '' }))).toBe('INVALID_CANDIDATE');
  });
});
