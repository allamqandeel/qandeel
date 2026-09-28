/**
 * W1A-01 — the paragraph direction of Conversation text, and where each speaker sits.
 *
 * TWO direction facts, kept apart on purpose (G1.1 closure: speaker side and paragraph bidi are
 * independent):
 *
 *   - the SPEAKER SIDE comes from the reader's Product language. The reader's committed turn is
 *     attached to the reader's own screen edge — RIGHT in Arabic, LEFT in English — and QANDEEL
 *     speaks from the opposite edge. A turn never changes side because of what it says.
 *   - the PARAGRAPH DIRECTION comes from the words. It is the canonical G1.1-A1 rule
 *     (`docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/src/bidi.js`), ported verbatim:
 *     not first-strong, which lays «Q3 numbers لسه ما وصلتش» out left-to-right, but the MAJORITY of
 *     words by the script of their first strong letter. A tie, or no letters at all, takes the
 *     reader's direction.
 */
import type { ChromeLanguage } from '../orientation-chrome';

export type ParagraphDirection = 'rtl' | 'ltr';
export type PhysicalSide = 'left' | 'right';

export function paragraphDirection(text: string, fallback: ParagraphDirection): ParagraphDirection {
  let rtl = 0;
  let ltr = 0;
  for (const word of String(text).split(/\s+/u)) {
    for (let i = 0; i < word.length; i += 1) {
      const c = word.charCodeAt(i);
      if ((c >= 0x0590 && c <= 0x08ff) || (c >= 0xfb1d && c <= 0xfdff) || (c >= 0xfe70 && c <= 0xfeff)) {
        rtl += 1;
        break;
      }
      if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0xc0 && c <= 0x24f)) {
        ltr += 1;
        break;
      }
    }
  }
  if (rtl === ltr) return fallback;
  return rtl > ltr ? 'rtl' : 'ltr';
}

/** The reader's own direction: the tie-breaker for paragraphs and the direction of the chrome. */
export function readerDirection(language: ChromeLanguage): ParagraphDirection {
  return language === 'ar' ? 'rtl' : 'ltr';
}

/** The screen edge the reader's committed turn is attached to. QANDEEL is always the other one. */
export function readerSide(language: ChromeLanguage): PhysicalSide {
  return language === 'ar' ? 'right' : 'left';
}

export function oppositeSide(side: PhysicalSide): PhysicalSide {
  return side === 'right' ? 'left' : 'right';
}

/** One paragraph of a turn, with the direction its own words decide. */
export interface DirectedParagraph {
  readonly text: string;
  readonly direction: ParagraphDirection;
}

/**
 * The paragraphs of one turn. Each line the writer broke is its own paragraph with its own
 * direction, so a mixed turn reads correctly line by line. Blank lines are kept as spacing.
 */
export function directedParagraphs(text: string, fallback: ParagraphDirection): readonly DirectedParagraph[] {
  return text.split(/\r?\n/u).map((line) => ({ text: line, direction: paragraphDirection(line, fallback) }));
}

const RLM = String.fromCodePoint(0x200f);
const LRM = String.fromCodePoint(0x200e);

/**
 * The invisible mark that makes a platform's first-strong paragraph resolution agree with the
 * majority rule above: RLM (U+200F) or LRM (U+200E) as the paragraph's first character. Neither is
 * visible and neither is spoken; without it, Android and iOS would both resolve an Arabic sentence
 * that opens with an English word as left-to-right.
 */
export function withDirectionMark(paragraph: DirectedParagraph): string {
  return `${paragraph.direction === 'rtl' ? RLM : LRM}${paragraph.text}`;
}
