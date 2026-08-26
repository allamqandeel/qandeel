// Typed result of the ONE service-role post-response Information Gap
// synchronization command (migration 0038). The command derives every source
// from the execution's durable typed Confidence effects, so the result carries
// canonical identities only: no raw Confidence payload, no Evidence ID or
// content, no Memory content, no Question text, no provider metadata, no
// hidden reasoning and no arbitrary error text.
export const INFORMATION_GAP_MISSING_INFORMATION_CODES = [
  'NO_ELIGIBLE_EVIDENCE',
  'UNVERIFIED_ASSUMPTIONS',
  'COMPETING_HYPOTHESES_UNASSESSED',
] as const;
export type InformationGapMissingInformationCode = (typeof INFORMATION_GAP_MISSING_INFORMATION_CODES)[number];

// The bounded result set implied by the current contracts: 4 update receipts
// + 5 generation receipts, at most 3 actionable codes each.
export const MAX_INFORMATION_GAP_SYNC_GAPS = 27;

/**
 * One synchronized automatic Information Gap: its canonical durable identity
 * and the exact source tuple it materialized from. The exact durable target
 * version is authoritative - a later Hypothesis version is never substituted.
 */
export interface InformationGapSyncGap {
  ordinal: number;
  informationGapId: string;
  hypothesisId: string;
  targetVersion: number;
  missingInformationCode: InformationGapMissingInformationCode;
}

export type InformationGapSyncResult =
  | { status: 'NO_INFORMATION_GAPS'; gaps: [] }
  | { status: 'INFORMATION_GAPS_AVAILABLE'; gaps: InformationGapSyncGap[] }
  | { status: 'QUARANTINED'; reason: 'SOURCE_INTEGRITY_FAILURE' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const GAP_KEYS = ['ordinal', 'informationGapId', 'hypothesisId', 'targetVersion', 'missingInformationCode'] as const;

/**
 * Strict parser for the synchronization command's transport result. An HTTP
 * 2xx is never trusted alone: anything that is not exactly one of the three
 * canonical result shapes - an unknown status, an unknown field, a bad UUID, a
 * bad ordinal, a duplicate source tuple, an over-bound payload - returns
 * undefined and the caller must treat the call as failed. Repeated Hypothesis
 * IDs are canonical when their missing-information codes or target versions
 * differ; the exact (hypothesisId, targetVersion, missingInformationCode)
 * tuple and the gap identity itself must be unique.
 */
export function parseInformationGapSyncResult(value: unknown): InformationGapSyncResult | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result = value as Record<string, unknown>;
  if (result.status === 'QUARANTINED') {
    if (Object.keys(result).length !== 2 || result.reason !== 'SOURCE_INTEGRITY_FAILURE') return undefined;
    return { status: 'QUARANTINED', reason: 'SOURCE_INTEGRITY_FAILURE' };
  }
  if (result.status !== 'NO_INFORMATION_GAPS' && result.status !== 'INFORMATION_GAPS_AVAILABLE') return undefined;
  if (Object.keys(result).length !== 2 || !Array.isArray(result.gaps)) return undefined;
  if (result.status === 'NO_INFORMATION_GAPS') {
    return result.gaps.length === 0 ? { status: 'NO_INFORMATION_GAPS', gaps: [] } : undefined;
  }
  if (result.gaps.length < 1 || result.gaps.length > MAX_INFORMATION_GAP_SYNC_GAPS) return undefined;
  const gapIds = new Set<string>();
  const sourceTuples = new Set<string>();
  const gaps: InformationGapSyncGap[] = [];
  for (let index = 0; index < result.gaps.length; index += 1) {
    const entry = result.gaps[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
    const gap = entry as Record<string, unknown>;
    if (Object.keys(gap).length !== GAP_KEYS.length || GAP_KEYS.some((key) => !(key in gap))) return undefined;
    if (gap.ordinal !== index + 1) return undefined;
    if (typeof gap.informationGapId !== 'string' || !UUID.test(gap.informationGapId)) return undefined;
    if (typeof gap.hypothesisId !== 'string' || !UUID.test(gap.hypothesisId)) return undefined;
    if (typeof gap.targetVersion !== 'number' || !Number.isSafeInteger(gap.targetVersion) || gap.targetVersion < 1) return undefined;
    if (typeof gap.missingInformationCode !== 'string' ||
      !(INFORMATION_GAP_MISSING_INFORMATION_CODES as readonly string[]).includes(gap.missingInformationCode)) return undefined;
    const gapKey = gap.informationGapId.toLowerCase();
    if (gapIds.has(gapKey)) return undefined;
    gapIds.add(gapKey);
    const tupleKey = `${gap.hypothesisId.toLowerCase()}:${gap.targetVersion}:${gap.missingInformationCode}`;
    if (sourceTuples.has(tupleKey)) return undefined;
    sourceTuples.add(tupleKey);
    gaps.push({
      ordinal: index + 1,
      informationGapId: gap.informationGapId,
      hypothesisId: gap.hypothesisId,
      targetVersion: gap.targetVersion,
      missingInformationCode: gap.missingInformationCode as InformationGapMissingInformationCode,
    });
  }
  return { status: 'INFORMATION_GAPS_AVAILABLE', gaps };
}
