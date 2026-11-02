// S8B-04 (CP2, Fast Voice Path, the Product Owner's D-S2 decision of 2026-11-01) — the incremental release guard.
//
// The whole-candidate guard (model-output-release-guard.ts) releases a reply only when it is complete. On the spoken
// voice-note path a sentence may be spoken before the reply is complete, so this guard decides, while the model is still
// writing, which leading sentences may already leave the server. It is the VA-2 design (S8B-01 amendment), narrowed for a
// VOICE NOTE reply by D-S2:
//
//   - a piece is released only when it ends on a sentence boundary (a clause boundary only for a first sentence that is
//     still running past FIRST_CLAUSE_MIN_CHARS) and only while the accumulated text passes every existing check:
//     UNREADABLE, INTERNAL_CONTAINER, and no unclosed `<`;
//   - GUIDANCE_ECHO holdback: the longest suffix of the accumulated text that occurs inside any server-authored sentence
//     stays withheld, so a verbatim echo can never be partly released; a full echo is detected while still withheld;
//   - the speech markup goes through the ONE parser's stream (SpeechMarkupStream): a marker, or a part of one, is never
//     released; a piece is released only from text no later chunk can change;
//   - early release is OFF for a turn whose Safety disposition is GUIDED, and it stops for good (the reply is then
//     released whole at the end, or not at all) as soon as it cannot stay safe: a check fails, the markup is held past
//     its limit, or a `<` stays open past its limit. "If safe early release is not possible, wait for the complete reply."
//
// At the end the WHOLE candidate passes the unchanged whole-candidate guard and the unchanged markup parser. Then:
//   - COMPLETE: the visible reply is exactly what the non-streaming path stores (byte for byte); `tail` is the part not
//     released yet;
//   - WITHHELD_TAIL: the whole failed AFTER something was released — the released prefix is kept as what it is (it may
//     already have been heard) and the tail is withheld; the caller records it under the controlled contract;
//   - WITHHELD: nothing was released — the turn fails exactly as today.
//
// Deterministic, provider-neutral, log-free; it keeps nothing after the turn. Not a content classifier.
import { SENTENCE_END } from '../speech-rendering/arabic-text';
import { SpeechMarkupStream, type SpeechHintCandidate } from '../speech-rendering/speech-markup';
import type { SpeechExpression } from '../speech-rendering/speech-styles';
import {
  collapse,
  ModelOutputWithheldError,
  releaseModelOutput,
  serverAuthoredSentences,
  type ModelOutputWithheldReason,
} from './model-output-release-guard';

/** A first sentence still running past this many characters may be released at a clause boundary (latency). */
export const FIRST_CLAUSE_MIN_CHARS = 120;
/** An opened `<` that stays unclosed past this many characters stops early release (the reply is then released whole). */
export const OPEN_ANGLE_HOLD_LIMIT = 80;

const UNREADABLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F�]/u;
const INTERNAL_CONTAINER_HINT = /<\s*\/?\s*[a-z_]+\s*>/iu;
const CLAUSE_END = /[،,؛;:]/u;

export type EarlyReleaseStop = 'SAFETY_GUIDED' | 'CHECK_FAILED' | 'MARKUP_HELD' | 'OPEN_ANGLE' | 'GUIDANCE_ECHO';

export type IncrementalReleaseOutcome =
  | {
    readonly kind: 'COMPLETE';
    /** The visible reply, identical to the non-streaming path's. */
    readonly text: string;
    /** The part of `text` that was not released while streaming (released now). */
    readonly tail: string;
    readonly expression: SpeechExpression;
    readonly hints: readonly SpeechHintCandidate[];
  }
  | {
    readonly kind: 'WITHHELD_TAIL';
    /** Exactly the text released while streaming. */
    readonly released: string;
    readonly reason: ModelOutputWithheldReason | 'MARKUP_MALFORMED';
  }
  | { readonly kind: 'WITHHELD'; readonly reason: ModelOutputWithheldReason | 'MARKUP_MALFORMED' };

export interface IncrementalReleaseOptions {
  readonly serverGuidance: string;
  readonly safetyGuided: boolean;
}

export class IncrementalReleaseGuard {
  private raw = '';
  private visible = '';
  private released = 0;
  private stopped: EarlyReleaseStop | null;
  private readonly markup: SpeechMarkupStream;
  private readonly sentences: readonly string[];
  private readonly longestSentence: number;

  constructor(private readonly options: IncrementalReleaseOptions) {
    this.markup = new SpeechMarkupStream({ safetyGuided: options.safetyGuided });
    this.sentences = serverAuthoredSentences(options.serverGuidance);
    this.longestSentence = this.sentences.reduce((max, sentence) => Math.max(max, sentence.length), 0);
    this.stopped = options.safetyGuided ? 'SAFETY_GUIDED' : null;
  }

  /** Why early release is off, or null while it is on. */
  get earlyReleaseStop(): EarlyReleaseStop | null {
    return this.stopped;
  }

  /** Everything released so far, in order. */
  get releasedText(): string {
    return this.visible.slice(0, this.released);
  }

  /**
   * The expression and the hint candidates of the released text (offsets in `releasedText`), as the one parser reads the
   * decided prefix; a released piece is spoken with them. Validation against each sentence stays the caller's (CP1 rule).
   */
  get releasedSpeech(): { readonly expression: SpeechExpression; readonly hints: readonly SpeechHintCandidate[] } {
    const { expression, hints } = this.markup.prefix;
    return { expression, hints: hints.filter((hint) => hint.at <= this.released) };
  }

  /** One model delta; returns the newly released piece ('' when nothing new may leave the server). */
  push(delta: string): string {
    this.raw += delta;
    this.visible += this.markup.push(delta);
    if (this.stopped !== null) return '';
    if (this.markup.overHold) return this.stop('MARKUP_HELD');
    if (UNREADABLE.test(this.visible) || INTERNAL_CONTAINER_HINT.test(this.visible)) return this.stop('CHECK_FAILED');

    let limit = this.visible.length;
    const open = this.visible.lastIndexOf('<');
    if (open > this.visible.lastIndexOf('>')) {
      if (this.visible.length - open > OPEN_ANGLE_HOLD_LIMIT) return this.stop('OPEN_ANGLE');
      limit = Math.min(limit, open);
    }
    // The echo holdback is computed only when a new piece could leave at all (it reads every server sentence).
    if (this.boundaryAtOrBefore(limit) <= this.released) return '';
    const echo = this.echoState();
    if (echo === 'FULL') return this.stop('GUIDANCE_ECHO');
    limit = Math.min(limit, this.visible.length - this.uncollapsedSuffixLength(echo));

    const cut = this.boundaryAtOrBefore(limit);
    if (cut <= this.released) return '';
    const piece = this.visible.slice(this.released, cut);
    this.released = cut;
    return piece;
  }

  /** The model finished: the whole candidate is decided by the unchanged guard and parser. */
  end(): IncrementalReleaseOutcome {
    const released = this.releasedText;
    const fail = (reason: ModelOutputWithheldReason | 'MARKUP_MALFORMED'): IncrementalReleaseOutcome =>
      released.length > 0 ? { kind: 'WITHHELD_TAIL', released, reason } : { kind: 'WITHHELD', reason };
    try {
      releaseModelOutput(this.raw, this.options.serverGuidance);
    } catch (error) {
      if (error instanceof ModelOutputWithheldError) return fail(error.reason);
      throw error;
    }
    const whole = this.markup.end();
    if (whole.kind !== 'OK') return fail('MARKUP_MALFORMED');
    // Every piece pushed is a prefix of the parser's whole text (SpeechMarkupStream's contract); checked, not assumed.
    if (!whole.text.startsWith(released)) return fail('MARKUP_MALFORMED');
    return { kind: 'COMPLETE', text: whole.text, tail: whole.text.slice(released.length), expression: whole.expression, hints: whole.hints };
  }

  private stop(reason: EarlyReleaseStop): string {
    this.stopped = reason;
    return '';
  }

  /** 'FULL' when a whole server sentence is already in the text; else the collapsed length of the suffix to hold back. */
  private echoState(): 'FULL' | number {
    if (this.sentences.length === 0) return 0;
    const text = collapse(this.visible);
    if (this.sentences.some((sentence) => text.includes(sentence))) return 'FULL';
    // The longest suffix of the text that occurs inside a server sentence (it could still grow into an echo).
    let longest = 0;
    for (let start = Math.max(0, text.length - this.longestSentence); start < text.length; start += 1) {
      const suffix = text.slice(start);
      if (suffix.length <= longest) break;
      if (this.sentences.some((sentence) => sentence.includes(suffix))) {
        longest = suffix.length;
        break;
      }
    }
    return longest;
  }

  /** The uncollapsed length of the visible text's tail whose collapsed form has `collapsedLength` characters. */
  private uncollapsedSuffixLength(collapsedLength: number): number {
    if (collapsedLength <= 0) return 0;
    let count = 0;
    let index = this.visible.length;
    while (index > 0 && count < collapsedLength) {
      index -= 1;
      const ch = this.visible[index];
      if (/\s/u.test(ch)) {
        while (index > 0 && /\s/u.test(this.visible[index - 1])) index -= 1;
      }
      count += 1;
    }
    return this.visible.length - index;
  }

  /** The last release point at or before `limit`: just after a sentence end that is followed by whitespace. */
  private boundaryAtOrBefore(limit: number): number {
    for (let i = Math.min(limit, this.visible.length - 1); i > this.released; i -= 1) {
      if (SENTENCE_END.test(this.visible[i - 1]) && /\s/u.test(this.visible[i]) && this.visible[i - 1] !== '\n') return i;
      if (this.visible[i - 1] === '\n') return i;
    }
    // A long first sentence: a clause boundary, so the first audio does not wait for a very long sentence.
    if (this.released === 0) {
      for (let i = Math.min(limit, this.visible.length - 1); i >= FIRST_CLAUSE_MIN_CHARS; i -= 1) {
        if (CLAUSE_END.test(this.visible[i - 1]) && /\s/u.test(this.visible[i])) return i;
      }
    }
    return this.released;
  }
}
