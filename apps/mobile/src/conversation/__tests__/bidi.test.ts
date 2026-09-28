/**
 * W1A-01 — speaker side and paragraph direction are two independent facts (G1.1 closure).
 */
import { directedParagraphs, paragraphDirection, readerDirection, readerSide, withDirectionMark } from '..';

describe('W1A-01 — the speaker side comes from the reader’s language, never from the words', () => {
  it('the reader’s own edge is RIGHT in Arabic and LEFT in English', () => {
    expect(readerSide('ar')).toBe('right');
    expect(readerSide('en')).toBe('left');
    expect(readerDirection('ar')).toBe('rtl');
    expect(readerDirection('en')).toBe('ltr');
  });
});

describe('W1A-01 — the paragraph direction comes from the words, by majority, not first-strong', () => {
  it.each([
    ['السلام عليكم', 'rtl'],
    ['Hello there', 'ltr'],
    // First-strong would lay these out left-to-right; the majority of words is Arabic.
    ['Q3 numbers لسه ما وصلتش', 'rtl'],
    ['الـclient مش راضي عن الـdeadline', 'rtl'],
    // And the mirror case: an English sentence that opens with an Arabic word.
    ['قنديل is the name of the product', 'ltr'],
  ] as const)('%s → %s', (text, direction) => {
    expect(paragraphDirection(text, 'ltr')).toBe(direction);
    expect(paragraphDirection(text, 'rtl')).toBe(direction);
  });

  it('a tie, or a paragraph with no letters, takes the reader’s direction', () => {
    expect(paragraphDirection('12:30', 'rtl')).toBe('rtl');
    expect(paragraphDirection('12:30', 'ltr')).toBe('ltr');
    expect(paragraphDirection('نعم yes', 'rtl')).toBe('rtl');
    expect(paragraphDirection('نعم yes', 'ltr')).toBe('ltr');
  });

  it('each line of a mixed turn is its own paragraph with its own direction', () => {
    expect(directedParagraphs('السلام عليكم\nHow are you today?\n\nتمام', 'rtl').map((p) => p.direction)).toEqual(['rtl', 'ltr', 'rtl', 'rtl']);
  });

  it('the direction mark is the invisible RLM or LRM that makes the platform agree with the majority rule', () => {
    const [arabic, english] = directedParagraphs('Q3 numbers لسه ما وصلتش\nplain English', 'ltr');
    expect(withDirectionMark(arabic).codePointAt(0)).toBe(0x200f);
    expect(withDirectionMark(english).codePointAt(0)).toBe(0x200e);
    expect(withDirectionMark(arabic).slice(1)).toBe('Q3 numbers لسه ما وصلتش');
  });
});
