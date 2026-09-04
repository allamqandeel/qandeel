import { codePointLength } from '../conversation-unit/cu-anchor-mapper';
import { mapFocusAnchor, sameAnchor, sliceAnchorSpan } from './focus-anchor-mapper';

const mapped = (text: string, anchor: { text: string; occurrence: number }) => {
  const result = mapFocusAnchor(text, anchor);
  if (result.outcome !== 'MAPPED') throw new Error(`expected MAPPED, got ${result.reason}`);
  return result.mapped;
};
const rejected = (text: string, anchor: { text: string; occurrence: number }) => {
  const result = mapFocusAnchor(text, anchor);
  if (result.outcome !== 'REJECTED') throw new Error('expected REJECTED');
  return result.reason;
};

describe('extractive anchor mapping (fixtures 20-22)', () => {
  const REPEATED = 'خالد قالّي: أحمد زعلان، وأحمد مش عايز يتكلم، وأحمد هيسيب الفريق.';

  it('20. a non-extractive anchor has no location: normalized hamza, paraphrase, translation', () => {
    expect(rejected('أحمد قال إنه مش جاي.', { text: 'احمد', occurrence: 1 })).toBe('NON_EXTRACTIVE_REFERENCE');
    expect(rejected('أحمد قال إنه مش جاي.', { text: 'أحمد مش هيجي', occurrence: 1 })).toBe('NON_EXTRACTIVE_REFERENCE');
    expect(rejected('أحمد قال إنه مش جاي.', { text: 'Ahmed', occurrence: 1 })).toBe('NON_EXTRACTIVE_REFERENCE');
    // No trimming, no case folding, no diacritic stripping.
    expect(rejected('Ahmed told me.', { text: 'ahmed', occurrence: 1 })).toBe('NON_EXTRACTIVE_REFERENCE');
    expect(rejected('Ahmed told me.', { text: ' Ahmed ', occurrence: 1 })).toBe('NON_EXTRACTIVE_REFERENCE');
  });

  it('21. a repeated surface is selected by explicit occurrence and never substituted', () => {
    const first = mapped(REPEATED, { text: 'أحمد', occurrence: 1 });
    const second = mapped(REPEATED, { text: 'أحمد', occurrence: 2 });
    const third = mapped(REPEATED, { text: 'أحمد', occurrence: 3 });
    expect(first.span.start).toBeLessThan(second.span.start);
    expect(second.span.start).toBeLessThan(third.span.start);
    for (const each of [first, second, third]) {
      expect(sliceAnchorSpan(REPEATED, each.span)).toBe('أحمد');
      expect(each.span.end - each.span.start).toBe(codePointLength('أحمد'));
    }
    // The fourth repetition does not exist: rejected, not clamped to the third.
    expect(rejected(REPEATED, { text: 'أحمد', occurrence: 4 })).toBe('OCCURRENCE_OUT_OF_RANGE');
    // A unique surface named as its second occurrence names a repetition that
    // does not exist either.
    expect(rejected(REPEATED, { text: 'خالد', occurrence: 2 })).toBe('OCCURRENCE_OUT_OF_RANGE');
    expect(rejected(REPEATED, { text: 'خالد', occurrence: 0 })).toBe('INVALID_PROVIDER_PAYLOAD');
  });

  it('22. coordinates are Unicode code points, so emoji and Arabic never shift an offset', () => {
    const text = '😂😂 أحمد بعت لي رسالة غريبة 😂';
    const ahmed = mapped(text, { text: 'أحمد', occurrence: 1 });
    // Two astral emoji + one space = 3 code points, but 5 UTF-16 code units.
    expect(ahmed.span).toEqual({ start: 3, end: 7 });
    expect(text.indexOf('أحمد')).toBe(5);
    expect(sliceAnchorSpan(text, ahmed.span)).toBe('أحمد');

    const trailing = mapped(text, { text: '😂', occurrence: 3 });
    expect(trailing.span).toEqual({ start: codePointLength(text) - 1, end: codePointLength(text) });
    expect(sliceAnchorSpan(text, trailing.span)).toBe('😂');
    // Combining marks and tatweel are code points of their own and are never merged.
    const marked = 'أحمدُ قال';
    expect(mapped(marked, { text: 'أحمدُ', occurrence: 1 }).span).toEqual({ start: 0, end: 5 });
    expect(mapped(marked, { text: 'أحمد', occurrence: 1 }).span).toEqual({ start: 0, end: 4 });
  });

  it('mapping is independent per anchor: overlapping and out-of-order anchors are legal', () => {
    const text = 'أحمد قال إنه مش جاي.';
    expect(mapped(text, { text: 'أحمد قال', occurrence: 1 }).span).toEqual({ start: 0, end: 8 });
    expect(mapped(text, { text: 'أحمد', occurrence: 1 }).span).toEqual({ start: 0, end: 4 });
    expect(mapped(text, { text: 'إنه مش جاي', occurrence: 1 }).span).toEqual({ start: 9, end: 19 });
  });

  it('sameAnchor compares exact text and occurrence only', () => {
    expect(sameAnchor({ text: 'أحمد', occurrence: 2 }, { text: 'أحمد', occurrence: 2 })).toBe(true);
    expect(sameAnchor({ text: 'أحمد', occurrence: 1 }, { text: 'أحمد', occurrence: 2 })).toBe(false);
    expect(sameAnchor({ text: 'أحمد', occurrence: 1 }, { text: 'احمد', occurrence: 1 })).toBe(false);
  });
});
