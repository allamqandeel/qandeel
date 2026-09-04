import type { ProposedCommitUnit } from './conversation-unit.types';
import { validateNewBatchFrontier, validateUnitStructure } from './cu-span-validator';

const SOURCE = 'أنا سبت الشغل امبارح. وبالمناسبة أحمد كلمني. ممكن نرجع لموضوع السفر؟';
const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

const unit = (unitId: string, spanStart: number, spanEnd: number): ProposedCommitUnit => ({ unitId, spanStart, spanEnd });
const reason = (result: ReturnType<typeof validateUnitStructure>) => {
  if (result.outcome !== 'REJECTED') throw new Error('expected REJECTED');
  return result.reason;
};

describe('source-relative structural validation', () => {
  it('accepts ordered, non-overlapping, in-bounds units', () => {
    expect(validateUnitStructure(SOURCE, [unit(ID_A, 0, 21), unit(ID_B, 22, 44)])).toEqual({ outcome: 'VALID' });
  });

  it('accepts a zero-unit batch', () => {
    expect(validateUnitStructure(SOURCE, [])).toEqual({ outcome: 'VALID' });
  });

  it('accepts a gap between units', () => {
    expect(validateUnitStructure(SOURCE, [unit(ID_A, 0, 10), unit(ID_B, 30, 40)])).toEqual({ outcome: 'VALID' });
  });

  it('rejects an out-of-range span', () => {
    expect(reason(validateUnitStructure(SOURCE, [unit(ID_A, 0, 100_000)]))).toBe('SPAN_OUT_OF_RANGE');
    expect(reason(validateUnitStructure(SOURCE, [unit(ID_A, 5, 5)]))).toBe('SPAN_OUT_OF_RANGE');
    expect(reason(validateUnitStructure(SOURCE, [unit(ID_A, 8, 4)]))).toBe('SPAN_OUT_OF_RANGE');
    expect(reason(validateUnitStructure(SOURCE, [unit(ID_A, -1, 4)]))).toBe('SPAN_OUT_OF_RANGE');
  });

  it('rejects intra-batch overlap and backward order', () => {
    expect(reason(validateUnitStructure(SOURCE, [unit(ID_A, 0, 21), unit(ID_B, 10, 30)]))).toBe('SPAN_NOT_FORWARD_ORDERED');
    expect(reason(validateUnitStructure(SOURCE, [unit(ID_A, 22, 44), unit(ID_B, 0, 21)]))).toBe('SPAN_NOT_FORWARD_ORDERED');
  });

  it('rejects duplicate unit identities inside one batch', () => {
    expect(reason(validateUnitStructure(SOURCE, [unit(ID_A, 0, 10), unit(ID_A, 20, 30)]))).toBe('DUPLICATE_UNIT_ID');
  });

  it('rejects a malformed unit payload', () => {
    expect(reason(validateUnitStructure(SOURCE, [unit('not-a-uuid', 0, 10)]))).toBe('INVALID_UNIT_PAYLOAD');
    expect(reason(validateUnitStructure(SOURCE, [unit(ID_A, 0.5, 10)]))).toBe('INVALID_UNIT_PAYLOAD');
    expect(reason(validateUnitStructure(SOURCE, Array.from({ length: 65 }, () => unit(ID_A, 0, 1))))).toBe(
      'INVALID_UNIT_PAYLOAD',
    );
  });

  it('is frontier-independent: structure never consults the committed frontier (REV03A1-06)', () => {
    // A historical batch whose spans sit entirely before today's frontier is
    // still structurally valid, which is what makes an exact replay possible.
    expect(validateUnitStructure(SOURCE, [unit(ID_A, 0, 21)])).toEqual({ outcome: 'VALID' });
  });
});

describe('forward-only frontier rule for a NEW batch (REV03A1-01)', () => {
  it('permits a first batch from position zero', () => {
    expect(validateNewBatchFrontier([unit(ID_A, 0, 21)], 0)).toEqual({ outcome: 'VALID' });
  });

  it('permits a later suffix batch after a gap', () => {
    expect(validateNewBatchFrontier([unit(ID_B, 45, 68)], 44)).toEqual({ outcome: 'VALID' });
  });

  it('rejects a later disjoint-but-earlier batch', () => {
    const result = validateNewBatchFrontier([unit(ID_B, 0, 10)], 20);
    expect(result).toEqual({ outcome: 'REJECTED', reason: 'SPAN_BEFORE_SOURCE_FRONTIER', index: 0 });
  });

  it('rejects a later batch landing in an earlier source gap before the frontier', () => {
    expect(reason(validateNewBatchFrontier([unit(ID_B, 12, 18)], 30))).toBe('SPAN_BEFORE_SOURCE_FRONTIER');
  });

  it('treats a zero-unit batch as valid and frontier-neutral', () => {
    expect(validateNewBatchFrontier([], 44)).toEqual({ outcome: 'VALID' });
  });
});
