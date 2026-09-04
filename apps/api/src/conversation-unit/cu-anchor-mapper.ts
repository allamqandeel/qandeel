// T-03A1 - the source-anchored boundary mapper.
//
// The segmentation provider proposes EXTRACTIVE source anchors, never offsets:
// a language model cannot be trusted to count raw Unicode positions across a
// long mixed Arabic/English source, and a silently shifted span is exactly the
// class of error a canonical source substrate must not admit. This module - not
// the model - calculates every final offset, deterministically and with no I/O.
//
// Because an anchor that is not an exact code-point substring of the canonical
// source has no location, a paraphrase or any invented wording cannot become a
// span and therefore cannot become a committed CU. Extractiveness is proven by
// construction rather than instructed in a prompt.
//
// Coordinates are Unicode CODE POINTS, 0-based, half-open [start, end), over
// the source exactly as stored. JavaScript's `String.length` counts UTF-16 code
// units and is never used here: `'\u{1F600}'.repeat(500)` has `.length === 1000`
// but 500 code points, and one such character would shift every later offset.

import {
  MAX_SOURCE_EXCERPT_CHARS,
  MAX_UNITS_PER_COMMIT_BATCH,
  type SourceSpan,
} from './conversation-unit.types';

/** One provider-proposed extractive anchor. */
export interface SourceAnchor {
  readonly text: string;
  /** 1-based index selecting WHICH occurrence of `text` in the source is meant. */
  readonly occurrence: number;
}

export type AnchorMappingFailure =
  | 'INVALID_ANCHOR_PAYLOAD'
  | 'NON_EXTRACTIVE_ANCHOR'
  | 'AMBIGUOUS_ANCHOR'
  | 'OCCURRENCE_OUT_OF_RANGE'
  | 'ANCHOR_BEFORE_CURSOR';

export type AnchorMappingResult =
  | { readonly outcome: 'MAPPED'; readonly spans: readonly SourceSpan[] }
  | { readonly outcome: 'REJECTED'; readonly reason: AnchorMappingFailure; readonly index: number };

/** Splits a string into Unicode code points. Never use `String.length` instead. */
export function toCodePoints(value: string): readonly string[] {
  return Array.from(value);
}

/** Code-point length of a string. */
export function codePointLength(value: string): number {
  return toCodePoints(value).length;
}

/**
 * Slices canonical source by code-point span. Used for validation and fixtures
 * only: the durable committed wording is always sliced by the database from the
 * locked canonical source, never sent by an application caller.
 */
export function sliceByCodePoints(content: string, span: SourceSpan): string {
  return toCodePoints(content).slice(span.start, span.end).join('');
}

/** Every start offset at which `needle` occurs in `haystack`, ascending. */
function occurrencesOf(haystack: readonly string[], needle: readonly string[]): readonly number[] {
  const found: number[] = [];
  if (needle.length === 0 || needle.length > haystack.length) return found;
  const last = haystack.length - needle.length;
  for (let start = 0; start <= last; start += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) found.push(start);
  }
  return found;
}

/**
 * Maps ordered extractive anchors onto canonical source spans.
 *
 * `cursor` starts at the committed source frontier of the turn, so a mapped
 * batch is always forward-only, strictly ascending and pairwise non-overlapping
 * by construction. Duplicate identical substrings are disambiguated by the
 * explicit 1-based `occurrence` index, cross-checked by the monotonic cursor -
 * a different occurrence is NEVER silently substituted. Every failure rejects
 * the whole batch.
 *
 * The residual is bounded and stated: if a phrase repeats and the provider
 * names a later valid repetition that still satisfies monotonicity, that
 * repetition is accepted. It can only ever select a different exact region of
 * canonical source - never invented wording, an out-of-bounds span, an overlap
 * or an out-of-order unit.
 */
export function mapAnchorsToSpans(
  content: string,
  anchors: readonly SourceAnchor[],
  frontier: number,
): AnchorMappingResult {
  if (!Array.isArray(anchors) || anchors.length > MAX_UNITS_PER_COMMIT_BATCH) {
    return { outcome: 'REJECTED', reason: 'INVALID_ANCHOR_PAYLOAD', index: -1 };
  }
  if (!Number.isSafeInteger(frontier) || frontier < 0) {
    return { outcome: 'REJECTED', reason: 'INVALID_ANCHOR_PAYLOAD', index: -1 };
  }

  const source = toCodePoints(content);
  if (frontier > source.length) {
    return { outcome: 'REJECTED', reason: 'INVALID_ANCHOR_PAYLOAD', index: -1 };
  }

  const spans: SourceSpan[] = [];
  let cursor = frontier;

  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index];
    if (
      anchor === null ||
      typeof anchor !== 'object' ||
      typeof anchor.text !== 'string' ||
      anchor.text.length === 0 ||
      typeof anchor.occurrence !== 'number' ||
      !Number.isSafeInteger(anchor.occurrence) ||
      anchor.occurrence < 1
    ) {
      return { outcome: 'REJECTED', reason: 'INVALID_ANCHOR_PAYLOAD', index };
    }

    const needle = toCodePoints(anchor.text);
    if (needle.length > MAX_SOURCE_EXCERPT_CHARS) {
      return { outcome: 'REJECTED', reason: 'INVALID_ANCHOR_PAYLOAD', index };
    }

    const found = occurrencesOf(source, needle);
    if (found.length === 0) {
      // The excerpt is not present in the canonical source: a paraphrase,
      // normalized wording, or otherwise invented text.
      return { outcome: 'REJECTED', reason: 'NON_EXTRACTIVE_ANCHOR', index };
    }
    // Checked before the range test so both codes stay reachable and
    // diagnostic: a unique phrase carrying a repetition index means the
    // provider is confused about uniqueness, not merely out of range.
    if (found.length === 1 && anchor.occurrence !== 1) {
      return { outcome: 'REJECTED', reason: 'AMBIGUOUS_ANCHOR', index };
    }
    if (anchor.occurrence > found.length) {
      return { outcome: 'REJECTED', reason: 'OCCURRENCE_OUT_OF_RANGE', index };
    }

    const start = found[anchor.occurrence - 1];
    const end = start + needle.length;
    if (start < cursor) {
      // Before the committed source frontier, or behind an earlier unit of this
      // batch: a backward or overlapping proposal, never silently re-resolved.
      return { outcome: 'REJECTED', reason: 'ANCHOR_BEFORE_CURSOR', index };
    }

    spans.push({ start, end });
    cursor = end;
  }

  return { outcome: 'MAPPED', spans };
}
