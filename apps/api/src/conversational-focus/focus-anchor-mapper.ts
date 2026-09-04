// T-03B1a - the deterministic focus anchor mapper.
//
// Reuses the T-03A1 philosophy and the T-03A1 CODE: the provider proposes
// `{ text, occurrence }`, and the pure monotonic-cursor mapper of
// `cu-anchor-mapper` computes 0-based, half-open Unicode code-point
// coordinates. There is deliberately no second UTF-16 or code-point
// definition in this directory.
//
// Reference, claim and focus-grounding anchors are independent of one another
// and may overlap or appear in any order (e.g. `أحمد` inside `أحمد قال`), so
// every anchor is mapped ALONE against the whole current CU with a frontier of
// zero. No normalization, no fuzzy or embedding matching, no paraphrase: an
// anchor that is not an exact code-point substring has no location.

import { mapAnchorsToSpans, sliceByCodePoints } from '../conversation-unit/cu-anchor-mapper';
import type { AnchorSpan, ExtractiveAnchor, FocusEvaluationRejectionReason, MappedAnchor } from './conversational-focus.types';

export type FocusAnchorMappingResult =
  | { readonly outcome: 'MAPPED'; readonly mapped: MappedAnchor }
  | {
      readonly outcome: 'REJECTED';
      readonly reason: Extract<
        FocusEvaluationRejectionReason,
        'INVALID_PROVIDER_PAYLOAD' | 'NON_EXTRACTIVE_REFERENCE' | 'OCCURRENCE_OUT_OF_RANGE'
      >;
    };

/**
 * Maps ONE extractive anchor onto the current CU's committed text.
 *
 * A unique excerpt named with an occurrence other than 1, and an occurrence
 * beyond the actual repetition count, are both out of range: the named
 * repetition does not exist, and no other repetition is ever substituted.
 */
export function mapFocusAnchor(committedText: string, anchor: ExtractiveAnchor): FocusAnchorMappingResult {
  const result = mapAnchorsToSpans(committedText, [anchor], 0);
  if (result.outcome === 'MAPPED') {
    const span: AnchorSpan = { start: result.spans[0].start, end: result.spans[0].end };
    return { outcome: 'MAPPED', mapped: { anchor: { text: anchor.text, occurrence: anchor.occurrence }, span } };
  }
  switch (result.reason) {
    case 'NON_EXTRACTIVE_ANCHOR':
      return { outcome: 'REJECTED', reason: 'NON_EXTRACTIVE_REFERENCE' };
    case 'AMBIGUOUS_ANCHOR':
    case 'OCCURRENCE_OUT_OF_RANGE':
      return { outcome: 'REJECTED', reason: 'OCCURRENCE_OUT_OF_RANGE' };
    default:
      return { outcome: 'REJECTED', reason: 'INVALID_PROVIDER_PAYLOAD' };
  }
}

/** The exact committed wording a mapped span covers. Test and fixture aid only. */
export function sliceAnchorSpan(committedText: string, span: AnchorSpan): string {
  return sliceByCodePoints(committedText, span);
}

/** Two anchors name the same exact source region iff text and occurrence match. */
export function sameAnchor(left: ExtractiveAnchor, right: ExtractiveAnchor): boolean {
  return left.text === right.text && left.occurrence === right.occurrence;
}
