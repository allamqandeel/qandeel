import { stripDiacritics, arabicWords, SENTENCE_END } from './arabic-text';
import {
  constrainSpeechExpression, DEFAULT_SPEECH_EXPRESSION, isSpeechExpression, type SpeechExpression,
} from './speech-styles';

/**
 * S8B-04 (CP1, contract v1.2 §7.4 as narrowed by the Product Owner's CP1 brief, item C) — the speech channel of a
 * voice-note reply, separated from the words the person sees.
 *
 * The model writes two kinds of marker into its own reply: the delivery line `[[speech:STYLE]]` first (TM-01) and, when
 * the hint policy asks for them (TM-03), `[[say:WORD]]` after a sentence. This module is the ONE parser
 * (`stripSpeechMarkup`). It is called for VOICE_NOTE replies only; a typed turn's reply never passes through it.
 *
 * The rule (Product Owner, CP1 brief C):
 *   1. Only a marker that is PROVEN to be one is removed: one of the two exact openers (`[[say:` / `[[speech:`, case
 *      sensitive), content in its own format (§7.4: a hint is 1–60 characters with no space, line break or bracket; a
 *      delivery value is `[A-Z_]{1,16}`) and its own closing `]]`. Both delimiters bound it, so removing it can never
 *      take a word of the reply with it. Any other `[[` (a `[[wiki]]`, a `[[ say:`, a `[[Say:`) and any lone `]]` are
 *      the reply's own text and are never touched. An opener whose content is not in its format is not separated.
 *   2. A removal never merges two words: a marker with a letter or digit on both sides cannot be separated with certainty.
 *   3. Whatever cannot be separated with certainty fails CLOSED: an opener left without its closing (except the one
 *      certain case below), or a marker inside a word, makes the whole reply MALFORMED. The caller then withholds the
 *      reply exactly like any other withheld model output — nothing is stored, nothing is shown, no extra model call is
 *      made and no substitute wording is invented (the approved generation-failure path).
 *   4. The one unclosed case removed with certainty: an opener at the very END of the reply followed only by a valid
 *      hint token (Arabic letters and diacritics, at least one diacritic, its letters a word of the last sentence) — the
 *      stream ended inside the marker. It yields no hint.
 *
 * What a removal takes: the marker, plus ONE horizontal space before it; a marker alone on its line takes the line and
 * its line break. The delivery line counts only when it opens the reply and is followed by a line break, a space or the
 * end; any other delivery marker, or an unknown value, is removed and the expression is CALM.
 *
 * `assertNoSpeechMarkup` is the tripwire before a turn is finalized: the parser removes every opener itself, so an opener
 * found there is a defect of the parser, and the turn fails (counted, never with the text).
 */

const OPENERS = ['[[say:', '[[speech:'] as const;
const CLOSED_MARKER = /\[\[(?:say:([^\s[\]]{1,60})|speech:([A-Z_]{1,16}))\]\]/gu;
const CLOSED_MARKER_AT = /^\[\[(?:say:[^\s[\]]{1,60}|speech:[A-Z_]{1,16})\]\]/u;
const DELIVERY_LINE = /^\[\[speech:([A-Z_]{1,16})\]\]([ \t]*\r?\n|[ \t]+|$)/u;
const ANY_OPENER = /\[\[(?:say|speech):/u;
const TAIL_TOKEN = /^\[\[say:([ء-يً-ْٰ|]{1,60})[ \t]*$/u;
const WORD_CHAR = /[\p{L}\p{N}ً-ْٰ]/u;

/** The longest a marker can be held while a stream decides it (§7.4 streaming; the longest closed marker is 68). */
export const SPEECH_MARKUP_HOLD_LIMIT = 80;

export interface SpeechHintCandidate {
  /** The marker's content exactly as written (validated later against its sentence; see speech-hints.ts). */
  readonly word: string;
  /** The offset in the visible text where the marker stood: its hint belongs to the sentence ending there. */
  readonly at: number;
}

export interface SpeechMarkupCounts {
  readonly markers: number;
  readonly deliveryLine: boolean;
  readonly unknownDelivery: number;
  readonly misplacedDelivery: number;
  readonly truncatedTail: number;
}

export type SpeechMarkupMalformed = 'UNCLOSED_MARKER' | 'MARKER_INSIDE_WORD';

export type SpeechMarkupResult =
  | {
    readonly kind: 'OK';
    /** The words the person sees and the conversation stores. */
    readonly text: string;
    readonly expression: SpeechExpression;
    readonly hints: readonly SpeechHintCandidate[];
    readonly counts: SpeechMarkupCounts;
  }
  | { readonly kind: 'MALFORMED'; readonly reason: SpeechMarkupMalformed };

export interface StripSpeechMarkupOptions {
  /** The turn's Safety disposition is GUIDED: PLAYFUL / JOY become CALM (AC-06). */
  readonly safetyGuided: boolean;
  /** The whole reply is present (the end-of-reply rule applies). A stream passes false for its safe prefixes. */
  readonly final?: boolean;
}

const isWordChar = (ch: string | undefined): boolean => ch !== undefined && WORD_CHAR.test(ch);

/** The sentence that ends at `at` in `text` (the hint channel is sentence-scoped). */
export function sentenceBefore(text: string, at: number): string {
  let end = at;
  while (end > 0 && /[\s.!?؟…]/u.test(text[end - 1])) end -= 1;
  let start = end;
  while (start > 0 && !SENTENCE_END.test(text[start - 1])) start -= 1;
  return text.slice(start, end);
}

/** A hint token: Arabic letters and diacritics only, a diacritic in each part, each part's letters a word of `sentence`. */
export function isValidHintToken(token: string, sentence: string): boolean {
  const parts = token.split('|');
  if (parts.length > 2) return false;
  const words = new Set(arabicWords(sentence).map((w) => stripDiacritics(w.text)));
  return parts.every((part) => /^[ء-يً-ْٰ]{1,30}$/u.test(part)
    && /[ً-ْٰ]/u.test(part) && words.has(stripDiacritics(part)));
}

/** Separates the speech channel from the visible reply. Pure; never throws. */
export function stripSpeechMarkup(raw: string, options: StripSpeechMarkupOptions): SpeechMarkupResult {
  const final = options.final ?? true;
  let source = raw;
  let deliveryLine = false;
  let expression: SpeechExpression = DEFAULT_SPEECH_EXPRESSION;
  let unknownDelivery = 0;
  let misplacedDelivery = 0;

  const line = DELIVERY_LINE.exec(source);
  if (line) {
    deliveryLine = true;
    if (isSpeechExpression(line[1])) expression = line[1];
    else unknownDelivery += 1;
    source = source.slice(line[0].length);
  }

  let out = '';
  let cursor = 0;
  const hints: SpeechHintCandidate[] = [];
  let markers = deliveryLine ? 1 : 0;
  for (const match of source.matchAll(CLOSED_MARKER)) {
    const start = match.index;
    const end = start + match[0].length;
    // Rule 2: a marker with a word character on both sides cannot be separated with certainty.
    if (isWordChar(start > 0 ? source[start - 1] : undefined) && isWordChar(source[end])) return { kind: 'MALFORMED', reason: 'MARKER_INSIDE_WORD' };
    let gap = source.slice(cursor, start);
    let next = end;
    const lineStart = /(^|\n)[ \t]*$/u.exec(out + gap);
    const restOfLine = /^[ \t]*(\r?\n|$)/u.exec(source.slice(end));
    if (lineStart && restOfLine) {
      // The marker is alone on its line: the line goes with its line break.
      gap = gap.replace(/[ \t]*$/u, '');
      if (restOfLine[1] !== '') next = end + restOfLine[0].length;
      else {
        next = end + restOfLine[0].length;
        gap = gap.replace(/\r?\n$/u, '');
        if (gap === '' && /\r?\n$/u.test(out)) out = out.replace(/\r?\n$/u, '');
      }
    } else if (/[ \t]$/u.test(gap)) {
      gap = gap.slice(0, -1);
    } else if (gap === '' && /[ \t]$/u.test(out)) {
      out = out.slice(0, -1);
    }
    out += gap;
    markers += 1;
    if (match[1] !== undefined) hints.push({ word: match[1], at: out.length });
    else misplacedDelivery += 1;
    cursor = next;
  }
  out += source.slice(cursor);

  let truncatedTail = 0;
  const leftover = out.search(ANY_OPENER);
  if (leftover >= 0) {
    const tail = TAIL_TOKEN.exec(out.slice(leftover));
    const lastOpener = Math.max(...OPENERS.map((o) => out.lastIndexOf(o)));
    if (!final || !tail || lastOpener !== leftover || !isValidHintToken(tail[1], sentenceBefore(out, leftover))) {
      return { kind: 'MALFORMED', reason: 'UNCLOSED_MARKER' };
    }
    out = out.slice(0, leftover).replace(/[ \t]$/u, '');
    truncatedTail = 1;
    markers += 1;
  }

  if (misplacedDelivery > 0 || unknownDelivery > 0) expression = DEFAULT_SPEECH_EXPRESSION;
  return {
    kind: 'OK',
    text: out,
    expression: constrainSpeechExpression(expression, options.safetyGuided),
    hints,
    counts: { markers, deliveryLine, unknownDelivery, misplacedDelivery, truncatedTail },
  };
}

/** Thrown by the tripwire. It carries no text. */
export class SpeechMarkupLeakError extends Error {
  constructor() {
    super('SPEECH_MARKUP_LEAK');
    this.name = 'SpeechMarkupLeakError';
  }
}

/** The tripwire before finalization (§7.4): removes nothing; an opener here is a parser defect. */
export function assertNoSpeechMarkup(text: string): void {
  if (ANY_OPENER.test(text)) throw new SpeechMarkupLeakError();
}

/**
 * The same parser over a stream (§7.4 streaming, for S8B-05 and any progressive display): `push` returns only visible text
 * that no later chunk can change; a possible marker is held until it is decided, at most SPEECH_MARKUP_HOLD_LIMIT
 * characters (`overHold` reports a longer hold). `end()` is exactly `stripSpeechMarkup` of the whole reply (P-f), and when
 * it is OK every pushed piece is a prefix of its text; when it is MALFORMED the caller discards what it showed.
 */
export class SpeechMarkupStream {
  private acc = '';
  private emitted = 0;
  overHold = false;

  constructor(private readonly options: { readonly safetyGuided: boolean }) {}

  push(chunk: string): string {
    this.acc += chunk;
    const cut = safeCut(this.acc);
    if (this.acc.length - cut > SPEECH_MARKUP_HOLD_LIMIT && ANY_OPENER.test(this.acc.slice(cut))) this.overHold = true;
    const prefix = stripSpeechMarkup(this.acc.slice(0, cut), { ...this.options, final: false });
    if (prefix.kind !== 'OK' || prefix.text.length <= this.emitted) return '';
    const piece = prefix.text.slice(this.emitted);
    this.emitted = prefix.text.length;
    return piece;
  }

  end(): SpeechMarkupResult {
    return stripSpeechMarkup(this.acc, { ...this.options, final: true });
  }
}

/** The longest prefix of `acc` whose stripped text no later input can change. */
function safeCut(acc: string): number {
  let cut = acc.length;
  for (let j = acc.indexOf('['); j >= 0 && j < cut; j = acc.indexOf('[', j + 1)) {
    const rest = acc.slice(j);
    const partial = OPENERS.some((o) => rest.length < o.length && o.startsWith(rest));
    let unresolved = partial;
    if (!partial && OPENERS.some((o) => rest.startsWith(o))) {
      const closed = CLOSED_MARKER_AT.exec(rest);
      // A closed marker is decided once the character after it is known (the line and in-word rules read it).
      unresolved = closed ? j + closed[0].length >= acc.length : true;
    }
    if (unresolved) {
      cut = j;
      break;
    }
  }
  while (cut > 0 && /[ \t]/u.test(acc[cut - 1])) cut -= 1;
  if (cut > 0 && acc[cut - 1] === '\n') cut -= 1;
  if (cut > 0 && acc[cut - 1] === '\r') cut -= 1;
  while (cut > 0 && /\s/u.test(acc[cut - 1])) cut -= 1;
  return cut;
}
