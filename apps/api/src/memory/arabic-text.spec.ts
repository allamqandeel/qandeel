import { lightArabicStem, normalizeArabicComparison } from './arabic-text';

// MEM-AR-01A (F-2): the shared comparison normalizer. Every operation is enumerated by code point so that 01C can
// mirror it one-to-one in SQL; this table is the TypeScript side of that parity.
describe('MEM-AR-01A Arabic comparison normalizer', () => {
  it.each([
    ['tatweel', 'أنا بحب الشــاي', 'انا بحب الشاي'],
    ['harakat and superscript alef', 'أَنَا بُحِبُّ الشَّاي وَهٰذا', 'انا بحب الشاي وهذا'],
    ['alef forms', 'أحمد إسلام آمال', 'احمد اسلام امال'],
    ['alef maksura and ta marbuta', 'على مدينة', 'علي مدينه'],
    ['Arabic-Indic digits', 'عندي ٢٩ سنة', 'عندي 29 سنه'],
    ['all ten Arabic-Indic digits', '٠١٢٣٤٥٦٧٨٩', '0123456789'],
    ['ASCII case fold', 'I Live In CAIRO', 'i live in cairo'],
    ['NFKC: full-width letters fold, then case-fold', 'ＣＡＩＲＯ', 'cairo'],
    ['NFKC: Arabic presentation forms', '\u{FEE3}\u{FEA0}\u{FEE8}\u{FEEE}\u{FEE5}', 'مجنون'],
    ['white space: tabs, no-break, ideographic, line separators', '\tأنا\u{00A0}\u{00A0}ساكن\u{3000}في\u{2028}طنطا\u{0085} ', 'انا ساكن في طنطا'],
    ['terminal punctuation run', 'أنا بحب القهوة؟!.', 'انا بحب القهوه'],
    ['Arabic comma, semicolon and question mark at the end', 'هدفي السفر،؛؟', 'هدفي السفر'],
    ['only the contiguous terminal run, as before 01A', 'هدفي السفر، ؛', 'هدفي السفر،'],
    ['inner punctuation stays', 'أنا، بحب: القهوة', 'انا، بحب: القهوه'],
  ])('%s', (_label, input, expected) => {
    expect(normalizeArabicComparison(input)).toBe(expected);
  });

  it('makes the U2 Unicode variants one comparison key', () => {
    expect(normalizeArabicComparison('أنا بحب الشــاي')).toBe(normalizeArabicComparison('أنا بحب الشاي.'));
    expect(normalizeArabicComparison('عندي ٢٩ سنة')).toBe(normalizeArabicComparison('عندي 29 سنة'));
  });

  it('is idempotent and keeps different words different', () => {
    for (const text of ['أنا ساكنة في مدينة نصر.', 'Speak to me in Egyptian Arabic.', 'عندي ٢٩ سنة', '  ']) {
      const once = normalizeArabicComparison(text);
      expect(normalizeArabicComparison(once)).toBe(once);
    }
    expect(normalizeArabicComparison('أنا ساكنة في طنطا')).not.toBe(normalizeArabicComparison('أنا ساكن في طنطا'));
    expect(normalizeArabicComparison('بحب الشاي')).not.toBe(normalizeArabicComparison('بحب القهوة'));
  });

  it('folds ASCII case only and keeps U+FEFF (it is not White_Space): the SQL mirror needs no collation', () => {
    expect(normalizeArabicComparison('ÉCOLE')).toBe('École');
    expect(normalizeArabicComparison('\u{FEFF}x')).toBe('\u{FEFF}x');
  });
});

describe('MEM-AR-01A light Arabic stem (moved unchanged from the W3-MEGA-M resolution)', () => {
  it.each([
    ['ساكنه', 'ساكن'], ['ساكن', 'ساكن'], ['للهدوء', 'هدوء'], ['الهدوء', 'هدوء'], ['شغلي', 'شغل'], ['بالشغل', 'شغل'],
    ['بحب', 'بحب'], ['قهوه', 'قهو'], ['القهوه', 'قهو'], ['jobs', 'job'], ['class', 'class'], ['is', 'is'],
  ])('%s → %s', (token, stem) => {
    expect(lightArabicStem(token)).toBe(stem);
  });
});
