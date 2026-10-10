import {
  auditUnderstandingDetail, auditUnderstandingList, isUnderstandingToken, projectUnderstandingConfidence,
  understandingItemRef, understandingRevision, type UnderstandingConfidenceFacts,
} from './understanding-projection';
import { UnderstandingProjectionInvariantError } from './understanding.types';

const UNCALIBRATED = ['CONFIDENCE_MODEL_UNCALIBRATED'] as const;
const facts = (overrides: Partial<UnderstandingConfidenceFacts> = {}): UnderstandingConfidenceFacts => ({
  status: 'ACTIVE', eligibleSupporting: 1, eligibleContradicting: 0,
  exactVersionMissingInformation: UNCALIBRATED, contested: false, withheld: false, ...overrides,
});

describe('projectUnderstandingConfidence — qualitative, conservative, never calibrated', () => {
  it.each([
    ['an explicit contest wins over everything', facts({ status: 'SUPPORTED', contested: true }), 'MIXED'],
    ['the canonical MIXED lifecycle state', facts({ status: 'MIXED' }), 'MIXED'],
    ['support and contradiction both currently eligible', facts({ eligibleContradicting: 1 }), 'MIXED'],
    ['no exact-current-version Confidence record', facts({ status: 'SUPPORTED', exactVersionMissingInformation: null }), 'NEEDS_MORE'],
    ['WEAK', facts({ status: 'WEAK' }), 'NEEDS_MORE'],
    ['no eligible support', facts({ eligibleSupporting: 0 }), 'NEEDS_MORE'],
    ['NO_ELIGIBLE_EVIDENCE', facts({ exactVersionMissingInformation: ['NO_ELIGIBLE_EVIDENCE', 'CONFIDENCE_MODEL_UNCALIBRATED'] }), 'NEEDS_MORE'],
    ['SUPPORTED with no structural gap', facts({ status: 'SUPPORTED' }), 'CLEAR'],
    ['SUPPORTED with an unverified assumption', facts({ status: 'SUPPORTED', exactVersionMissingInformation: ['UNVERIFIED_ASSUMPTIONS', 'CONFIDENCE_MODEL_UNCALIBRATED'] }), 'TAKING_SHAPE'],
    ['SUPPORTED with an unassessed alternative', facts({ status: 'SUPPORTED', exactVersionMissingInformation: ['COMPETING_HYPOTHESES_UNASSESSED', 'CONFIDENCE_MODEL_UNCALIBRATED'] }), 'TAKING_SHAPE'],
    ['ACTIVE with support is still taking shape, never Clear', facts(), 'TAKING_SHAPE'],
    ['an empty (malformed) record never grounds Clear', facts({ status: 'SUPPORTED', exactVersionMissingInformation: [] }), 'TAKING_SHAPE'],
    ['an unknown status defaults conservatively', facts({ status: 'REOPENED' }), 'NEEDS_MORE'],
    // INTEL-TM-01: a withheld item keeps rules 1-2 and is otherwise NEEDS_MORE, whatever its stored record says.
    ['withheld SUPPORTED with no structural gap is never Clear', facts({ status: 'SUPPORTED', withheld: true }), 'NEEDS_MORE'],
    ['withheld ACTIVE with support is never Taking shape', facts({ withheld: true }), 'NEEDS_MORE'],
    ['withheld with current support and contradiction is not Mixed by rule 3', facts({ eligibleContradicting: 1, withheld: true }), 'NEEDS_MORE'],
    ['a withheld contested item stays Mixed', facts({ status: 'SUPPORTED', contested: true, withheld: true }), 'MIXED'],
    ['a withheld MIXED item stays Mixed', facts({ status: 'MIXED', withheld: true }), 'MIXED'],
  ] as const)('%s', (_name, input, expected) => {
    expect(projectUnderstandingConfidence(input)).toBe(expected);
  });

  it('has no input through which a score, band, weight or extraction confidence could arrive', () => {
    expect(Object.keys(facts()).sort()).toEqual(['contested', 'eligibleContradicting', 'eligibleSupporting', 'exactVersionMissingInformation', 'status', 'withheld']);
  });
});

describe('opaque item tokens', () => {
  const hypothesisId = '4f1c9a70-0b7a-4f55-9d3e-2a8f6b1c0d11';
  it('are stable, reader-bound, version-bound and reveal no identifier', () => {
    const ref = understandingItemRef('user-a', hypothesisId);
    expect(ref).toBe(understandingItemRef('user-a', hypothesisId));
    expect(ref).not.toBe(understandingItemRef('user-b', hypothesisId));
    expect(isUnderstandingToken(ref)).toBe(true);
    expect(ref).not.toContain(hypothesisId.slice(0, 8));
    expect(understandingRevision('user-a', hypothesisId, 2)).not.toBe(understandingRevision('user-a', hypothesisId, 3));
    expect(understandingRevision('user-a', hypothesisId, 2)).not.toBe(ref);
  });
  it('rejects anything that is not a token', () => {
    for (const value of [hypothesisId, '', 'a'.repeat(21), `${'a'.repeat(21)}/`, 22, null]) expect(isUnderstandingToken(value)).toBe(false);
  });
});

describe('outbound audit — planted defects fail closed', () => {
  const detailEvolution = [{ kind: 'FIRST_SEEN', at: '2026-09-30T10:00:00.000+00:00' }];
  const ref = understandingItemRef('user-a', 'h1');
  const summary = { ref, revision: understandingRevision('user-a', 'h1', 1), theme: 'WORK', summary: 'You prepare early.', evidenceChange: 'NONE', confidence: 'TAKING_SHAPE', underReview: false };
  // INTEL-TM-01: the two withheld shapes — no statement, no text, never Clear or Taking shape.
  const withheld = { ...summary, summary: null, evidenceChange: 'REVIEW_PENDING', confidence: 'NEEDS_MORE' };
  const withheldDetail = { ...withheld, evidence: [], contradictions: [], alternatives: [], unresolved: [], evolution: detailEvolution };
  const detail = { ...summary, evidence: ['I plan ahead'], contradictions: [], alternatives: [], unresolved: [], evolution: detailEvolution };

  it('accepts the exact Product shapes', () => {
    expect(() => auditUnderstandingList({ items: [summary] })).not.toThrow();
    expect(() => auditUnderstandingList({ items: [] })).not.toThrow();
    expect(() => auditUnderstandingDetail(detail)).not.toThrow();
    expect(() => auditUnderstandingList({ items: [withheld, { ...withheld, ref: understandingItemRef('user-a', 'h2'), evidenceChange: 'NO_REMAINING_SUPPORT' }] })).not.toThrow();
    expect(() => auditUnderstandingList({ items: [{ ...withheld, confidence: 'MIXED', underReview: true }] })).not.toThrow();
    expect(() => auditUnderstandingDetail(withheldDetail)).not.toThrow();
  });

  it.each([
    ['numeric confidence', { items: [{ ...summary, confidence: 0.72 }] }],
    ['an added numeric score', { items: [{ ...summary, numericScore: 0.7 }] }],
    ['a confidence band', { items: [{ ...summary, confidenceBand: 'HIGH' }] }],
    ['a raw internal identifier', { items: [{ ...summary, id: '4f1c9a70-0b7a-4f55-9d3e-2a8f6b1c0d11' }] }],
    ['a raw identifier as the ref', { items: [{ ...summary, ref: '4f1c9a70-0b7a-4f55-9d3e-2a8f6b1c0d11' }] }],
    ['a raw lifecycle status', { items: [{ ...summary, status: 'SUPPORTED' }] }],
    ['a raw Hypothesis object', { items: [{ ...summary, statement: 'x', scope: 'SESSION:1', version: 3 }] }],
    ['a chain-of-thought field', { items: [{ ...summary, reasoning: 'because…' }] }],
    ['Memory extraction confidence', { items: [{ ...summary, extractionConfidence: 0.9 }] }],
    ['a HIM metric', { items: [{ ...summary, himMetric: 'SELF_AWARENESS' }] }],
    ['an empty taxonomy tab', { items: [], tabs: ['YOU', 'WORK', 'GOALS'] }],
    ['an invented fifth confidence state', { items: [{ ...summary, confidence: 'UNKNOWN' }] }],
    ['an invented theme', { items: [{ ...summary, theme: 'PERSONALITY' }] }],
    ['an empty summary', { items: [{ ...summary, summary: '  ' }] }],
    ['a duplicated item', { items: [summary, summary] }],
    ['an item under review not shown as Mixed', { items: [{ ...summary, underReview: true }] }],
    ['a missing under-review flag', { items: [{ ref: summary.ref, revision: summary.revision, theme: 'WORK', summary: 'x', confidence: 'MIXED' }] }],
    ['a missing evidence change', { items: [{ ref: summary.ref, revision: summary.revision, theme: 'WORK', summary: 'x', confidence: 'MIXED', underReview: false }] }],
    ['an invented evidence change', { items: [{ ...summary, evidenceChange: 'RESTORED' }] }],
    ['a relied-on item without a statement', { items: [{ ...summary, summary: null }] }],
    ['a withheld statement shown', { items: [{ ...withheld, summary: 'You prepare early.' }] }],
    ['a withheld item shown as Clear', { items: [{ ...withheld, confidence: 'CLEAR' }] }],
    ['a withheld item shown as Taking shape', { items: [{ ...withheld, confidence: 'TAKING_SHAPE' }] }],
  ])('list: %s', (_name, payload) => {
    expect(() => auditUnderstandingList(payload)).toThrow(UnderstandingProjectionInvariantError);
  });

  it.each([
    ['an Evidence count', { ...detail, supportingCount: 2 }],
    ['an evidence weight inside the context', { ...detail, evidence: [{ text: 'x', weight: 0.4 }] }],
    ['a policy code in evolution', { ...detail, evolution: [{ kind: 'CONFIDENCE_MODEL_UNCALIBRATED', at: detail.evolution[0].at }] }],
    ['an internal id in evolution', { ...detail, evolution: [{ kind: 'FIRST_SEEN', at: detail.evolution[0].at, id: 'x' }] }],
    ['a hidden rationale field', { ...detail, rationale: 'the model thought' }],
    ['an unbounded context list', { ...detail, evidence: Array.from({ length: 9 }, (_, index) => `item ${index}`) }],
    ['a withheld item with supporting context', { ...withheldDetail, evidence: ['I plan ahead'] }],
    ['a withheld item with contradictory context', { ...withheldDetail, contradictions: ['I left it late'] }],
    ['a withheld item with alternatives', { ...withheldDetail, alternatives: ['You work best under pressure.'] }],
    ['a withheld item with unresolved points', { ...withheldDetail, unresolved: ['Deadlines matter to you.'] }],
    ['a withheld statement in the detail', { ...withheldDetail, summary: 'You prepare early.' }],
  ])('detail: %s', (_name, payload) => {
    expect(() => auditUnderstandingDetail(payload)).toThrow(UnderstandingProjectionInvariantError);
  });
});
