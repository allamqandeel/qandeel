import { MAX_INFORMATION_GAP_SYNC_GAPS, parseInformationGapSyncResult } from './information-gap-sync-result';

const gapId = (index: number) => `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const hypothesisId = (index: number) => `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const gap = (overrides: Record<string, unknown> = {}) => ({
  ordinal: 1,
  informationGapId: gapId(1),
  hypothesisId: hypothesisId(1),
  targetVersion: 2,
  missingInformationCode: 'UNVERIFIED_ASSUMPTIONS',
  ...overrides,
});

describe('parseInformationGapSyncResult', () => {
  it('accepts the exact NO_INFORMATION_GAPS result', () => {
    expect(parseInformationGapSyncResult({ status: 'NO_INFORMATION_GAPS', gaps: [] }))
      .toEqual({ status: 'NO_INFORMATION_GAPS', gaps: [] });
  });

  it('accepts the exact bounded QUARANTINED result', () => {
    expect(parseInformationGapSyncResult({ status: 'QUARANTINED', reason: 'SOURCE_INTEGRITY_FAILURE' }))
      .toEqual({ status: 'QUARANTINED', reason: 'SOURCE_INTEGRITY_FAILURE' });
  });

  it('accepts a canonical bounded INFORMATION_GAPS_AVAILABLE result and strips nothing extra in', () => {
    const parsed = parseInformationGapSyncResult({ status: 'INFORMATION_GAPS_AVAILABLE', gaps: [gap()] });
    expect(parsed).toEqual({ status: 'INFORMATION_GAPS_AVAILABLE', gaps: [gap()] });
    // The parsed gap carries exactly the five canonical identity fields: no raw
    // Confidence payload, Evidence content or Question text can pass through.
    expect(Object.keys((parsed as { gaps: object[] }).gaps[0]).sort())
      .toEqual(['hypothesisId', 'informationGapId', 'missingInformationCode', 'ordinal', 'targetVersion']);
  });

  it('accepts the maximum bounded payload of 27 gaps', () => {
    const gaps = Array.from({ length: MAX_INFORMATION_GAP_SYNC_GAPS }, (_ignored, index) => gap({
      ordinal: index + 1,
      informationGapId: gapId(index + 1),
      hypothesisId: hypothesisId(Math.floor(index / 3) + 1),
      missingInformationCode: ['NO_ELIGIBLE_EVIDENCE', 'UNVERIFIED_ASSUMPTIONS', 'COMPETING_HYPOTHESES_UNASSESSED'][index % 3],
    }));
    expect(parseInformationGapSyncResult({ status: 'INFORMATION_GAPS_AVAILABLE', gaps }))
      .toEqual({ status: 'INFORMATION_GAPS_AVAILABLE', gaps });
  });

  it('accepts repeated Hypothesis IDs when the missing-information codes differ', () => {
    const gaps = [
      gap(),
      gap({ ordinal: 2, informationGapId: gapId(2), missingInformationCode: 'NO_ELIGIBLE_EVIDENCE' }),
    ];
    expect(parseInformationGapSyncResult({ status: 'INFORMATION_GAPS_AVAILABLE', gaps }))
      .toEqual({ status: 'INFORMATION_GAPS_AVAILABLE', gaps });
  });

  it('accepts repeated Hypothesis IDs when the exact target versions differ', () => {
    const gaps = [gap(), gap({ ordinal: 2, informationGapId: gapId(2), targetVersion: 3 })];
    expect(parseInformationGapSyncResult({ status: 'INFORMATION_GAPS_AVAILABLE', gaps }))
      .toEqual({ status: 'INFORMATION_GAPS_AVAILABLE', gaps });
  });

  it.each([
    ['a non-object value', 'INFORMATION_GAPS_AVAILABLE'],
    ['an array value', []],
    ['a null value', null],
    ['an unknown status', { status: 'GAPS_READY', gaps: [gap()] }],
    ['an unknown top-level field', { status: 'INFORMATION_GAPS_AVAILABLE', gaps: [gap()], confidence: {} }],
    ['a QUARANTINED result with an unknown reason', { status: 'QUARANTINED', reason: 'DATABASE_DOWN' }],
    ['a QUARANTINED result with an extra field', { status: 'QUARANTINED', reason: 'SOURCE_INTEGRITY_FAILURE', detail: 'x' }],
    ['a NO_INFORMATION_GAPS result carrying gaps', { status: 'NO_INFORMATION_GAPS', gaps: [gap()] }],
    ['a NO_INFORMATION_GAPS result missing the gaps array', { status: 'NO_INFORMATION_GAPS' }],
    ['an empty INFORMATION_GAPS_AVAILABLE list', { status: 'INFORMATION_GAPS_AVAILABLE', gaps: [] }],
  ])('rejects %s', (_label, value) => {
    expect(parseInformationGapSyncResult(value)).toBeUndefined();
  });

  it.each([
    ['an unknown gap field', gap({ questionText: 'What happened?' })],
    ['a missing gap field', (() => { const { targetVersion: _ignored, ...rest } = gap(); return rest; })()],
    ['a non-canonical gap UUID', gap({ informationGapId: 'not-a-uuid' })],
    ['a non-canonical Hypothesis UUID', gap({ hypothesisId: 'not-a-uuid' })],
    ['a zero-based ordinal', gap({ ordinal: 0 })],
    ['a non-numeric ordinal', gap({ ordinal: '1' })],
    ['a zero target version', gap({ targetVersion: 0 })],
    ['a fractional target version', gap({ targetVersion: 1.5 })],
    ['an unknown missing-information code', gap({ missingInformationCode: 'CONFIDENCE_MODEL_UNCALIBRATED' })],
  ])('rejects %s', (_label, entry) => {
    expect(parseInformationGapSyncResult({ status: 'INFORMATION_GAPS_AVAILABLE', gaps: [entry] })).toBeUndefined();
  });

  it('rejects a non-sequential ordinal', () => {
    expect(parseInformationGapSyncResult({
      status: 'INFORMATION_GAPS_AVAILABLE',
      gaps: [gap(), gap({ ordinal: 3, informationGapId: gapId(2), missingInformationCode: 'NO_ELIGIBLE_EVIDENCE' })],
    })).toBeUndefined();
  });

  it('rejects a duplicate exact source tuple even under a different gap identity', () => {
    expect(parseInformationGapSyncResult({
      status: 'INFORMATION_GAPS_AVAILABLE',
      gaps: [gap(), gap({ ordinal: 2, informationGapId: gapId(2) })],
    })).toBeUndefined();
  });

  it('rejects a gap identity bound to two source tuples', () => {
    expect(parseInformationGapSyncResult({
      status: 'INFORMATION_GAPS_AVAILABLE',
      gaps: [gap(), gap({ ordinal: 2, missingInformationCode: 'NO_ELIGIBLE_EVIDENCE' })],
    })).toBeUndefined();
  });

  it('rejects an over-bound payload', () => {
    const gaps = Array.from({ length: MAX_INFORMATION_GAP_SYNC_GAPS + 1 }, (_ignored, index) => gap({
      ordinal: index + 1,
      informationGapId: gapId(index + 1),
      hypothesisId: hypothesisId(index + 1),
    }));
    expect(parseInformationGapSyncResult({ status: 'INFORMATION_GAPS_AVAILABLE', gaps })).toBeUndefined();
  });
});
