import { arabicWords, canonicalDiacritized, hasDiacritics, replyLanguage, stripDiacritics } from './arabic-text';
import { lexiconReadings, lexiconSpans, type DiacriticsForm, type LexiconMode } from './pronunciation-lexicon';
import { DEFAULT_READINGS, SPEECH_HINT_POLICY, type SpeechHintPolicy, type ValidatedSpeechHint } from './speech-hints';
import { arabicNumberSpans } from './spoken-numbers';

/**
 * S8B-04 (CP1, contract v1.2 §6.10, §9.3) — Speech Rendering: the text Google speaks, derived from the visible reply by a
 * CLOSED list of transforms, each recorded as a span (SPOKEN-ALIGN). The visible, stored and remembered text is never
 * changed (I-1); the spoken version is never stored, logged or sent anywhere but the TTS request (NO-PERSIST).
 *
 *   SR-F1  formatting removed: fences, headings, bullets, quotes, emphasis, backticks; `[text](url)` → text; a bare link
 *          → nothing; the whitespace this leaves at the edges.
 *   SR-F2  `<` / `>` neutralized (AC-03): nothing next to whitespace, a space between two words.
 *   SR-N1  numbers, dates, times, percentages, counted amounts as words (A1), Arabic replies only.
 *   SR-L1  the selective lexicon (A2 / A3), only entries enabled after P-1 in production.
 *   SR-D1  the model's own validated hints (B), only when the hint policy is not OFF.
 *   SR-S1  segmentation at whitespace only (`segmentSpoken`).
 * Conflict rule (C): when SR-L1 and SR-D1 give the same word two different readings, neither applies (counted).
 *
 * BASELINE (PA-3) is F1 + F2 + S1 only. `renderChunk` is the per-sentence entry S8B-05 reuses (§6.9). Pure, synchronous,
 * deterministic; sub-millisecond on a segment (PA-8).
 */

export const SPEECH_RENDERER_VERSION = 'S8B-04-SR-v1';

export interface RenderProfile {
  readonly numbers: boolean;
  readonly lexicon: LexiconMode;
  readonly form: DiacriticsForm;
  readonly hintPolicy: SpeechHintPolicy;
}

/** CP1 production: A1 on (proven 4 / 4 by L-0), lexicon entries only once enabled after P-1 (none), hints OFF. */
export const PRODUCTION_RENDER_PROFILE: RenderProfile = Object.freeze({
  numbers: true, lexicon: 'ENABLED_ONLY', form: 'FULL', hintPolicy: SPEECH_HINT_POLICY,
});

/** The BASELINE spoken version (§6.10): formatting and `<>` only. */
export const BASELINE_RENDER_PROFILE: RenderProfile = Object.freeze({
  numbers: false, lexicon: 'OFF', form: 'FULL', hintPolicy: 'OFF',
});

export type SpokenSpanKind = 'SR-F1' | 'SR-F2' | 'SR-N1' | 'SR-L1' | 'SR-D1';

export interface SpokenSpan {
  readonly start: number;
  readonly end: number;
  readonly kind: SpokenSpanKind;
  readonly spoken: string;
}

export interface RenderCounts {
  readonly numbers: number;
  readonly lexicon: number;
  readonly hints: number;
  readonly conflicts: number;
}

export interface RenderedSpeech {
  readonly spoken: string;
  readonly language: 'ar' | 'en';
  readonly spans: readonly SpokenSpan[];
  readonly counts: RenderCounts;
}

type Candidate = SpokenSpan;

const FORMAT_RULES: ReadonlyArray<{ readonly pattern: RegExp; readonly spoken?: (m: RegExpMatchArray) => string }> = [
  // A code fence line, with its line break.
  { pattern: /^[ \t]*```[^\n]*(?:\r?\n|$)/gmu },
  // A markdown link: its text stays.
  { pattern: /\[([^\]\n]{1,200})\]\(([^()\s]{1,2000})\)/gu, spoken: (m) => m[1].replace(/[<>]/gu, '').trim() },
  // A bare link, with the horizontal space before it (a sentence's final punctuation is not part of the link).
  { pattern: /[ \t]*(?:https?:\/\/|www\.)[^\s<>()]*[^\s<>().,!?؟،:;"'»)]/gu },
  // A heading, a bullet, a numbered item, a quote marker: the marker and its space.
  { pattern: /^[ \t]*#{1,6}[ \t]+/gmu },
  { pattern: /^[ \t]*(?:[-*+•]|\d{1,2}[.)])[ \t]+/gmu },
  { pattern: /^[ \t]*>[ \t]?/gmu },
  // Strong / strike delimiters, and inline code backticks.
  { pattern: /\*\*|__|~~/gu },
  { pattern: /`+/gu },
];
// A single `*` or `_` emphasis pair (both delimiters go; the words between stay).
const EMPHASIS = /(?<![\p{L}\p{N}*_])([*_])(?=[^\s*_])[^*_\n]*?[^\s*_]\1(?![\p{L}\p{N}*_])/gu;

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }): boolean =>
  a.start < b.end && b.start < a.end;

function addIfFree(accepted: Candidate[], candidate: Candidate): boolean {
  if (candidate.end <= candidate.start) return false;
  if (accepted.some((s) => overlaps(s, candidate))) return false;
  accepted.push(candidate);
  return true;
}

/** Two vocalizations of the same letters agree when no letter carries different marks in each (one may carry fewer). */
export function compatibleReadings(a: string, b: string): boolean {
  if (stripDiacritics(a) !== stripDiacritics(b)) return false;
  const marks = (w: string): string[] => {
    const out: string[] = [];
    for (const ch of canonicalDiacritized(w)) {
      if (/[ً-ْٰ]/u.test(ch)) out[out.length - 1] += ch;
      else if (ch !== 'ـ') out.push('');
    }
    return out;
  };
  const ma = marks(a);
  const mb = marks(b);
  return ma.every((m, i) => m === '' || mb[i] === '' || m === mb[i]);
}

/** The spoken version of one piece of visible text (one sentence in a call, the whole reply for Listen). */
export function renderChunk(
  visible: string,
  hints: readonly ValidatedSpeechHint[],
  profile: RenderProfile = PRODUCTION_RENDER_PROFILE,
): RenderedSpeech {
  const language = replyLanguage(visible);
  const spans: Candidate[] = [];

  for (const rule of FORMAT_RULES) {
    for (const m of visible.matchAll(rule.pattern)) {

      addIfFree(spans, { start: m.index, end: m.index + m[0].length, kind: 'SR-F1', spoken: rule.spoken ? rule.spoken(m) : '' });
    }
  }
  for (const m of visible.matchAll(EMPHASIS)) {
    const open = { start: m.index, end: m.index + 1, kind: 'SR-F1' as const, spoken: '' };
    const close = { start: m.index + m[0].length - 1, end: m.index + m[0].length, kind: 'SR-F1' as const, spoken: '' };
    if (!spans.some((s) => overlaps(s, open) || overlaps(s, close))) spans.push(open, close);
  }
  for (const m of visible.matchAll(/[<>]/gu)) {
    const before = m.index > 0 ? visible[m.index - 1] : ' ';
    const after = visible[m.index + 1] ?? ' ';
    addIfFree(spans, { start: m.index, end: m.index + 1, kind: 'SR-F2', spoken: /\s|[<>]/u.test(before) || /\s|[<>]/u.test(after) ? '' : ' ' });
  }

  let numbers = 0;
  if (profile.numbers && language === 'ar') {
    for (const n of arabicNumberSpans(visible)) if (addIfFree(spans, { ...n, kind: 'SR-N1' })) numbers += 1;
  }

  const lexicon = lexiconSpans(visible, { mode: profile.lexicon, form: profile.form });
  const usableHints = profile.hintPolicy === 'OFF' ? [] : hints.filter((h) =>
    profile.hintPolicy === 'B_ALL' || !DEFAULT_READINGS.has(canonicalDiacritized(h.spoken)));
  let conflicts = 0;
  let lexiconCount = 0;
  let hintCount = 0;
  const conflicted = new Set<number>();
  for (const h of usableHints) {
    const l = lexicon.find((x) => x.start === h.start && x.end === h.end);
    if (l && !compatibleReadings(l.spoken, h.spoken)) {
      conflicts += 1;
      conflicted.add(h.start);
    }
  }
  for (const l of lexicon) {
    if (!conflicted.has(l.start) && addIfFree(spans, { start: l.start, end: l.end, kind: 'SR-L1', spoken: l.spoken })) lexiconCount += 1;
  }
  for (const h of usableHints) {
    if (conflicted.has(h.start) || lexicon.some((l) => l.start === h.start)) continue;
    if (addIfFree(spans, { start: h.start, end: h.end, kind: 'SR-D1', spoken: h.spoken })) hintCount += 1;
  }

  spans.sort((a, b) => a.start - b.start);
  const withEdges = trimEdges(visible, spans);
  return {
    spoken: assemble(visible, withEdges),
    language,
    spans: withEdges,
    counts: { numbers, lexicon: lexiconCount, hints: hintCount, conflicts },
  };
}

/** Unspanned text copied verbatim, each span replaced by its output. */
function assemble(visible: string, spans: readonly SpokenSpan[]): string {
  let out = '';
  let cursor = 0;
  for (const s of spans) {
    out += visible.slice(cursor, s.start) + s.spoken;
    cursor = s.end;
  }
  return out + visible.slice(cursor);
}

/** Whitespace left at the very start or end of the spoken text becomes an SR-F1 span (it was never spoken). */
function trimEdges(visible: string, spans: SpokenSpan[]): SpokenSpan[] {
  const out = [...spans];
  const gaps = (): Array<{ start: number; end: number }> => {
    const g: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (const s of out) {
      if (s.start > cursor) g.push({ start: cursor, end: s.start });
      cursor = s.end;
    }
    if (cursor < visible.length) g.push({ start: cursor, end: visible.length });
    return g;
  };
  // Leading: walk the pieces in order while they produce only whitespace.
  for (const gap of gaps()) {
    const before = out.filter((s) => s.end <= gap.start).map((s) => s.spoken).join('');
    if (before.trim() !== '') break;
    const text = visible.slice(gap.start, gap.end);
    const lead = /^\s*/u.exec(text)![0].length;
    if (lead > 0) out.push({ start: gap.start, end: gap.start + lead, kind: 'SR-F1', spoken: '' });
    if (lead < text.length) break;
  }
  out.sort((a, b) => a.start - b.start);
  for (const gap of gaps().reverse()) {
    const after = out.filter((s) => s.start >= gap.end).map((s) => s.spoken).join('');
    if (after.trim() !== '') break;
    const text = visible.slice(gap.start, gap.end);
    const trail = /\s*$/u.exec(text)![0].length;
    if (trail > 0) out.push({ start: gap.end - trail, end: gap.end, kind: 'SR-F1', spoken: '' });
    if (trail < text.length) break;
  }
  return out.sort((a, b) => a.start - b.start);
}

// ── SR-S1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** `PROPOSED` (§9.3): first segment ~120 characters, then ~240, at most 16 per reply. */
export const FIRST_SEGMENT_CHARS = 120;
export const SEGMENT_CHARS = 240;
export const MAX_SEGMENTS = 16;

export type SegmentationResult =
  | { readonly kind: 'OK'; readonly segments: readonly string[] }
  | { readonly kind: 'EMPTY' }
  | { readonly kind: 'TOO_LONG'; readonly segmentCount: number };

/**
 * Cuts the spoken text at whitespace only (the cut follows a whitespace character), preferring a sentence end, so the
 * segments joined give the spoken text back exactly. The text sent for a segment is `segment.trim()`.
 */
export function segmentSpoken(spoken: string): SegmentationResult {
  if (spoken.trim() === '') return { kind: 'EMPTY' };
  const segments: string[] = [];
  let pos = 0;
  while (pos < spoken.length) {
    const limit = segments.length === 0 ? FIRST_SEGMENT_CHARS : SEGMENT_CHARS;
    if (spoken.length - pos <= limit) {
      segments.push(spoken.slice(pos));
      break;
    }
    let cut = -1;
    let anyCut = -1;
    for (let k = pos + limit; k > pos + 1; k -= 1) {
      if (!/\s/u.test(spoken[k - 1]) || /\s/u.test(spoken[k] ?? '')) continue;
      if (anyCut < 0) anyCut = k;
      if (/[.!?؟…]/u.test(spoken[k - 2]) || spoken[k - 1] === '\n') {
        cut = k;
        break;
      }
    }
    if (cut < 0) cut = anyCut;
    if (cut < 0) {
      const next = spoken.slice(pos + limit).search(/\s\S/u);
      cut = next < 0 ? spoken.length : pos + limit + next + 1;
    }
    segments.push(spoken.slice(pos, cut));
    pos = cut;
  }
  if (segments.length > MAX_SEGMENTS) return { kind: 'TOO_LONG', segmentCount: segments.length };
  return { kind: 'OK', segments };
}

/** Listen's whole-reply render: the spoken version and its segments. */
export function renderSpeech(
  visible: string,
  hints: readonly ValidatedSpeechHint[],
  profile: RenderProfile = PRODUCTION_RENDER_PROFILE,
): RenderedSpeech & { readonly segmentation: SegmentationResult } {
  const rendered = renderChunk(visible, hints, profile);
  return { ...rendered, segmentation: segmentSpoken(rendered.spoken) };
}

// ── SPOKEN-ALIGN ─────────────────────────────────────────────────────────────────────────────────────────────────────

const LEXICON_PAIRS = new Set(lexiconReadings().flatMap((r) => r.spoken.map((s) => `${r.written}\u0000${s}`)));

/**
 * The SPOKEN-ALIGN check (§6.10 2): spans in order and inside the text, each of a listed kind and passing its own check,
 * and the unspanned text plus the span outputs giving the spoken version exactly; no `<`, `>` or channel opener in it.
 * Returns the violations (empty = aligned). The Listen path refuses to synthesize a render that is not aligned.
 */
export function spokenAlignmentViolations(visible: string, rendered: RenderedSpeech): string[] {
  const v: string[] = [];
  let cursor = 0;
  const numberSpans = new Map(arabicNumberSpans(visible).map((n) => [`${n.start}:${n.end}`, n.spoken] as const));
  for (const s of rendered.spans) {
    if (s.start < cursor || s.end > visible.length || s.end <= s.start) v.push(`ORDER@${s.start}`);
    cursor = Math.max(cursor, s.end);
    const source = visible.slice(s.start, s.end);
    switch (s.kind) {
      case 'SR-F1':
        if (s.spoken !== '') {
          // Only a markdown link produces words: exactly its own text.
          const link = /^\[([^\]\n]{1,200})\]\(([^()\s]{1,2000})\)$/u.exec(source);
          if (!link || link[1].replace(/[<>]/gu, '').trim() !== s.spoken) v.push(`F1@${s.start}`);
        } else if (/[\p{L}\p{N}]/u.test(source) && !/^[ \t]*(?:```|https?:\/\/|www\.|\d{1,2}[.)][ \t]|\[)/u.test(source)) {
          // A removal takes letters or digits only as a fence's language tag, a bare link or a list number.
          v.push(`F1@${s.start}`);
        }
        break;
      case 'SR-F2':
        if (!/^[<>]$/u.test(source) || !(s.spoken === '' || s.spoken === ' ')) v.push(`F2@${s.start}`);
        break;
      case 'SR-N1':
        if (numberSpans.get(`${s.start}:${s.end}`) !== s.spoken || /[0-9٠-٩]/u.test(s.spoken)) v.push(`N1@${s.start}`);
        break;
      case 'SR-L1':
        if (!LEXICON_PAIRS.has(`${source}\u0000${s.spoken}`) || stripDiacritics(s.spoken) !== source) v.push(`L1@${s.start}`);
        break;
      case 'SR-D1': {
        const oneWord = arabicWords(source).length === 1 && arabicWords(source)[0].text === source;
        if (!oneWord || hasDiacritics(source) || stripDiacritics(s.spoken) !== source) v.push(`D1@${s.start}`);
        break;
      }
      default:
        v.push(`KIND@${s.start}`);
    }
  }
  if (assemble(visible, rendered.spans) !== rendered.spoken) v.push('ASSEMBLY');
  if (/[<>]/u.test(rendered.spoken)) v.push('ANGLE_BRACKET');
  if (/\[\[(?:say|speech):/u.test(rendered.spoken)) v.push('MARKUP');
  return v;
}
