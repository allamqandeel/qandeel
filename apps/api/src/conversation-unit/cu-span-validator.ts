// T-03A1 - deterministic source-span validation.
//
// This is the fail-fast application mirror of the rules the database producer
// enforces authoritatively. It exists so an invalid proposal never reaches the
// durable boundary, NOT as the protection itself: the database re-validates
// every coordinate against the locked canonical source and derives the
// committed wording, role, modality, speaker state and digest itself.
//
// The split matters (REV03A1-06): bounds, strict ascent, pairwise non-overlap
// and identity distinctness are SOURCE-RELATIVE and hold for any batch, while
// the committed source frontier bounds NEW writes only. An existing-batch
// replay is historical identity verification and must never be re-checked
// against today's frontier.

import {
  MAX_UNITS_PER_COMMIT_BATCH,
  type CommitmentRejectionReason,
  type ProposedCommitUnit,
} from './conversation-unit.types';
import { codePointLength } from './cu-anchor-mapper';

export type SpanValidationResult =
  | { readonly outcome: 'VALID' }
  | { readonly outcome: 'REJECTED'; readonly reason: CommitmentRejectionReason; readonly index: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const valid: SpanValidationResult = { outcome: 'VALID' };
const reject = (reason: CommitmentRejectionReason, index: number): SpanValidationResult => ({
  outcome: 'REJECTED',
  reason,
  index,
});

/**
 * Source-relative structural validation. Applies identically to a new commit
 * and to an existing-batch replay.
 */
export function validateUnitStructure(content: string, units: readonly ProposedCommitUnit[]): SpanValidationResult {
  if (!Array.isArray(units) || units.length > MAX_UNITS_PER_COMMIT_BATCH) {
    return reject('INVALID_UNIT_PAYLOAD', -1);
  }
  const sourceLength = codePointLength(content);
  const seen = new Set<string>();
  let cursor = 0;

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    if (
      unit === null ||
      typeof unit !== 'object' ||
      typeof unit.unitId !== 'string' ||
      !UUID.test(unit.unitId) ||
      !Number.isSafeInteger(unit.spanStart) ||
      !Number.isSafeInteger(unit.spanEnd)
    ) {
      return reject('INVALID_UNIT_PAYLOAD', index);
    }
    if (seen.has(unit.unitId.toLowerCase())) return reject('DUPLICATE_UNIT_ID', index);
    seen.add(unit.unitId.toLowerCase());

    if (unit.spanStart < 0 || unit.spanEnd <= unit.spanStart || unit.spanEnd > sourceLength) {
      return reject('SPAN_OUT_OF_RANGE', index);
    }
    // A CU is one contiguous interval, so non-contiguity is unrepresentable
    // rather than rejected; what is rejected is a backward or overlapping unit.
    if (index > 0 && unit.spanStart < cursor) return reject('SPAN_NOT_FORWARD_ORDERED', index);
    cursor = unit.spanEnd;
  }
  return valid;
}

/**
 * The forward-only frontier rule for a NEW batch. `ordinal_within_turn` is
 * global canonical source order across every committed CU of the turn, so a
 * later batch may only append source material after everything already
 * committed. Gaps are allowed; overlap and backward or in-between insertion are
 * not. A zero-CU batch is legal and does not advance the frontier.
 *
 * Never call this on an existing-batch replay.
 */
export function validateNewBatchFrontier(
  units: readonly ProposedCommitUnit[],
  frontier: number,
): SpanValidationResult {
  if (!Number.isSafeInteger(frontier) || frontier < 0) return reject('INVALID_UNIT_PAYLOAD', -1);
  if (units.length === 0) return valid;
  if (units[0].spanStart < frontier) return reject('SPAN_BEFORE_SOURCE_FRONTIER', 0);
  return valid;
}
