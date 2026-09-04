import {
  codePointLength,
  mapAnchorsToSpans,
  sliceByCodePoints,
  toCodePoints,
  type SourceAnchor,
} from './cu-anchor-mapper';

// Stage 1.2 worked cases are used verbatim as fixtures.
const E1 = 'أنا سبت الشغل امبارح. وبالمناسبة أحمد كلمني. ممكن نرجع لموضوع السفر؟';
const CODE_SWITCH = 'أنا كنت okay في الأول بس then I panicked لما المدير كلمني.';
const SELF_CORRECTION = 'أنا كلمت أحمد امبارح... لا، قصدي حسام.';
const REPEATED = 'أحمد كلمني امبارح. بعدها خالد سافر. أحمد كلمني امبارح.';
const EMOJI = 'الاجتماع كان 😀 كويس. بس المدير زعل 👍 بعدين.';

const anchor = (text: string, occurrence = 1): SourceAnchor => ({ text, occurrence });
const mapped = (result: ReturnType<typeof mapAnchorsToSpans>) => {
  if (result.outcome !== 'MAPPED') throw new Error(`expected MAPPED, got ${result.reason}`);
  return result.spans;
};
const rejected = (result: ReturnType<typeof mapAnchorsToSpans>) => {
  if (result.outcome !== 'REJECTED') throw new Error('expected REJECTED');
  return result;
};

describe('code-point semantics (REV03A1-05)', () => {
  it('counts code points, never UTF-16 code units', () => {
    expect('\u{1F600}'.repeat(500).length).toBe(1000);
    expect(codePointLength('\u{1F600}'.repeat(500))).toBe(500);
  });

  it('slices Arabic and supplementary-plane content by code point', () => {
    const points = toCodePoints(EMOJI);
    expect(points).toContain('😀');
    const start = points.indexOf('😀');
    expect(sliceByCodePoints(EMOJI, { start, end: start + 1 })).toBe('😀');
  });

  it('maps anchors across a supplementary-plane character without drift', () => {
    const spans = mapped(mapAnchorsToSpans(EMOJI, [anchor('الاجتماع كان 😀 كويس.'), anchor('بس المدير زعل 👍 بعدين.')], 0));
    expect(spans).toHaveLength(2);
    expect(sliceByCodePoints(EMOJI, spans[0])).toBe('الاجتماع كان 😀 كويس.');
    expect(sliceByCodePoints(EMOJI, spans[1])).toBe('بس المدير زعل 👍 بعدين.');
    // The second span begins after the first: no UTF-16 surrogate drift.
    expect(spans[1].start).toBeGreaterThanOrEqual(spans[0].end);
  });
});

describe('extractive mapping (REV03A1-04)', () => {
  it('maps Stage 1.2 case E1 to three ordered, non-overlapping spans', () => {
    const spans = mapped(
      mapAnchorsToSpans(
        E1,
        [anchor('أنا سبت الشغل امبارح.'), anchor('وبالمناسبة أحمد كلمني.'), anchor('ممكن نرجع لموضوع السفر؟')],
        0,
      ),
    );
    expect(spans).toHaveLength(3);
    expect(spans.map((span) => sliceByCodePoints(E1, span))).toEqual([
      'أنا سبت الشغل امبارح.',
      'وبالمناسبة أحمد كلمني.',
      'ممكن نرجع لموضوع السفر؟',
    ]);
    for (let i = 1; i < spans.length; i += 1) expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end);
  });

  it('keeps a code-switching report as one span: language change alone is not a boundary', () => {
    const spans = mapped(mapAnchorsToSpans(CODE_SWITCH, [anchor(CODE_SWITCH)], 0));
    expect(spans).toEqual([{ start: 0, end: codePointLength(CODE_SWITCH) }]);
  });

  it('preserves genuine self-correction as committed source (Stage 1.2 D6)', () => {
    const spans = mapped(
      mapAnchorsToSpans(SELF_CORRECTION, [anchor('أنا كلمت أحمد امبارح...'), anchor('لا، قصدي حسام.')], 0),
    );
    expect(spans.map((span) => sliceByCodePoints(SELF_CORRECTION, span))).toEqual([
      'أنا كلمت أحمد امبارح...',
      'لا، قصدي حسام.',
    ]);
  });

  it('accepts an empty proposal as the legal zero-CU result', () => {
    expect(mapped(mapAnchorsToSpans(E1, [], 0))).toEqual([]);
  });
});

describe('duplicate-substring disambiguation (REV03A1-04)', () => {
  it('resolves a repeated identical phrase by the explicit occurrence index', () => {
    const first = mapped(mapAnchorsToSpans(REPEATED, [anchor('أحمد كلمني امبارح.', 1)], 0));
    const second = mapped(mapAnchorsToSpans(REPEATED, [anchor('أحمد كلمني امبارح.', 2)], 0));
    expect(first[0].start).toBe(0);
    expect(second[0].start).toBeGreaterThan(first[0].start);
    expect(sliceByCodePoints(REPEATED, second[0])).toBe('أحمد كلمني امبارح.');
  });

  it('maps both repetitions in one ordered batch', () => {
    const spans = mapped(
      mapAnchorsToSpans(
        REPEATED,
        [anchor('أحمد كلمني امبارح.', 1), anchor('بعدها خالد سافر.'), anchor('أحمد كلمني امبارح.', 2)],
        0,
      ),
    );
    expect(spans).toHaveLength(3);
    expect(spans[0].end).toBeLessThanOrEqual(spans[1].start);
    expect(spans[1].end).toBeLessThanOrEqual(spans[2].start);
  });

  it('never silently substitutes another occurrence when the choice goes backwards', () => {
    const result = rejected(
      mapAnchorsToSpans(REPEATED, [anchor('أحمد كلمني امبارح.', 2), anchor('أحمد كلمني امبارح.', 1)], 0),
    );
    expect(result.reason).toBe('ANCHOR_BEFORE_CURSOR');
    expect(result.index).toBe(1);
  });

  it('rejects a repetition index on a phrase that occurs exactly once', () => {
    expect(rejected(mapAnchorsToSpans(E1, [anchor('أنا سبت الشغل امبارح.', 2)], 0)).reason).toBe('AMBIGUOUS_ANCHOR');
  });

  it('rejects an occurrence index beyond the available repetitions', () => {
    expect(rejected(mapAnchorsToSpans(REPEATED, [anchor('أحمد كلمني امبارح.', 3)], 0)).reason).toBe(
      'OCCURRENCE_OUT_OF_RANGE',
    );
  });
});

describe('fail-closed anchor rejection', () => {
  it('rejects a paraphrase: invented wording has no location in canonical source', () => {
    expect(rejected(mapAnchorsToSpans(E1, [anchor('the user left work yesterday')], 0)).reason).toBe(
      'NON_EXTRACTIVE_ANCHOR',
    );
  });

  it('rejects Arabic-normalized wording: only the committed surface form can commit (Stage 1.2 D8)', () => {
    // Alef-hamza normalized to bare alef. Analysis-friendly, but not the
    // committed surface wording, so it has no location and cannot become a CU.
    const normalized = 'انا سبت الشغل امبارح.';
    expect(normalized).not.toBe('أنا سبت الشغل امبارح.');
    expect(rejected(mapAnchorsToSpans(E1, [anchor(normalized)], 0)).reason).toBe('NON_EXTRACTIVE_ANCHOR');
  });

  it('rejects out-of-order units', () => {
    const result = rejected(
      mapAnchorsToSpans(E1, [anchor('ممكن نرجع لموضوع السفر؟'), anchor('أنا سبت الشغل امبارح.')], 0),
    );
    expect(result.reason).toBe('ANCHOR_BEFORE_CURSOR');
    expect(result.index).toBe(1);
  });

  it('rejects an anchor that starts before the committed source frontier', () => {
    const frontier = codePointLength('أنا سبت الشغل امبارح.');
    expect(rejected(mapAnchorsToSpans(E1, [anchor('أنا سبت الشغل امبارح.')], frontier)).reason).toBe(
      'ANCHOR_BEFORE_CURSOR',
    );
  });

  it('permits a suffix anchor at or after the frontier', () => {
    const frontier = codePointLength('أنا سبت الشغل امبارح.');
    const spans = mapped(mapAnchorsToSpans(E1, [anchor('ممكن نرجع لموضوع السفر؟')], frontier));
    expect(spans[0].start).toBeGreaterThanOrEqual(frontier);
  });

  it('rejects a malformed anchor payload', () => {
    for (const bad of [
      { text: '', occurrence: 1 },
      { text: 'أنا', occurrence: 0 },
      { text: 'أنا', occurrence: 1.5 },
      { text: 42 as unknown as string, occurrence: 1 },
    ]) {
      expect(rejected(mapAnchorsToSpans(E1, [bad as SourceAnchor], 0)).reason).toBe('INVALID_ANCHOR_PAYLOAD');
    }
  });

  it('rejects more anchors than a batch may carry', () => {
    const many = Array.from({ length: 65 }, () => anchor('أ'));
    expect(rejected(mapAnchorsToSpans(E1, many, 0)).reason).toBe('INVALID_ANCHOR_PAYLOAD');
  });
});
