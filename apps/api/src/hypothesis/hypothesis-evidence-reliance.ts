/**
 * INTEL-TM-01 (PG-02, migration 0151) — whether QANDEEL may rely on a Hypothesis after a Memory it was linked to was
 * forgotten, disabled, corrected or lapsed.
 *
 * The database decides, from committed facts only (the linked Memory rows' standing and the immutable withdrawal
 * records), and answers one value per owned Hypothesis and exact version:
 *
 *   NONE                  nothing known stands against relying on it — the ONLY usable value;
 *   REVIEW_PENDING        it was linked to withdrawn or corrected information, in either role: withheld for good in V1;
 *   NO_REMAINING_SUPPORT  it had support and none of it is currently eligible: withheld.
 *
 * This module only validates that answer and applies it. A malformed answer fails closed (the caller omits the whole
 * context, exactly as for any other invalid canonical read); an answer for another version than the one the list read
 * returned, or no answer at all, makes that one item unusable for this read. Reliance never grants Evidence and never
 * feeds Confidence: it can only withhold.
 */
export const HYPOTHESIS_EVIDENCE_CHANGES = ['NONE', 'REVIEW_PENDING', 'NO_REMAINING_SUPPORT'] as const;
export type HypothesisEvidenceChange = (typeof HYPOTHESIS_EVIDENCE_CHANGES)[number];

/** One row of `hypothesis_evidence_reliance_v1` / `background_hypothesis_evidence_reliance_v1`. */
export interface HypothesisEvidenceRelianceRow {
  hypothesis_id: string;
  hypothesis_version: number;
  evidence_change: HypothesisEvidenceChange;
}

/** The database answers at most this many ids per read (the active-Hypothesis bound). */
export const MAX_RELIANCE_READ_IDS = 32;

export class HypothesisEvidenceRelianceIntegrityError extends Error {
  constructor() { super('HYPOTHESIS_EVIDENCE_RELIANCE_INTEGRITY'); this.name = 'HypothesisEvidenceRelianceIntegrityError'; }
}

/**
 * The version-pinned reliance of exactly the requested items. Only an answer for the SAME version the caller holds is
 * kept; everything else is absent, and an absent item is never usable.
 */
export function projectEvidenceReliance(
  requested: ReadonlyArray<{ readonly id: string; readonly version: number }>, rows: unknown,
): ReadonlyMap<string, HypothesisEvidenceChange> {
  const versions = new Map(requested.map(({ id, version }) => [id, version]));
  if (!Array.isArray(rows) || rows.length > versions.size) throw new HypothesisEvidenceRelianceIntegrityError();
  const reliance = new Map<string, HypothesisEvidenceChange>();
  const seen = new Set<string>();
  for (const row of rows as unknown[]) {
    if (typeof row !== 'object' || row === null) throw new HypothesisEvidenceRelianceIntegrityError();
    const { hypothesis_id: id, hypothesis_version: version, evidence_change: change } = row as Record<string, unknown>;
    if (typeof id !== 'string' || !versions.has(id) || seen.has(id) || !Number.isSafeInteger(version) || (version as number) < 1 ||
      !(HYPOTHESIS_EVIDENCE_CHANGES as readonly unknown[]).includes(change)) throw new HypothesisEvidenceRelianceIntegrityError();
    seen.add(id);
    if (versions.get(id) === version) reliance.set(id, change as HypothesisEvidenceChange);
  }
  return reliance;
}

/** The items QANDEEL may rely on, in their given order. */
export function reliableOnly<T extends { readonly id: string }>(items: readonly T[], reliance: ReadonlyMap<string, HypothesisEvidenceChange>): T[] {
  return items.filter(({ id }) => reliance.get(id) === 'NONE');
}

/** INTEL-TM-01 (CC-4): Hypotheses re-evaluated per housekeeping call at most (the database refuses more). */
export const PERSONAL_EVIDENCE_REEVALUATION_LIMIT = 32;
