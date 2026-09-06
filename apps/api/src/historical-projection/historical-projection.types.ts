// T-03C - the historical projection boundary types.
//
// `K(TC)` (Layer A) is produced by the database
// (`get_session_historical_projection_v1`) and mapped here into ONE typed,
// family-aware, fail-closed value. `V` (Layer B) is derived from it by
// `historical-disclosure.ts` and is the only thing that leaves the server.
// Nothing here is stored in the client kernel: `K(TC)`, `V`, `IF_render`,
// divergence and the footprint have no key in the T-02 `CanonicalState` by
// design (Stage 6.5 v3 section 9-11), and no Product action (no RH entry) is
// ever produced by a projection.

import type {
  DisclosedConfidence,
  DisclosedEmergingFocus,
  DisclosedEvidenceParticipation,
  DisclosedGap,
  DisclosedLiveFocusAtTc,
  DisclosedMaterial,
  DisclosedMoment,
  DisclosedQuestion,
  DisclosedQuestionAppearance,
  DisclosedReading,
  DisclosedReadingRelation,
  DisclosedThread,
  DisclosedThreadReadingAppearance,
  HistoricalProjectionUnavailableCode,
  HistoricalRevision,
} from '@qandeel/runtime';

/**
 * `K(TC)`: everything ONE covered Session knows at ONE addressable Session
 * Position, typed per family. Every family is gated by its OWN availability
 * anchor in the database; the server adds no inference, no fallback and no
 * ranking. Known noncurrent lineage stays known and is never current.
 */
export interface HistoricalKnowledge {
  readonly sessionId: string;
  readonly liveHead: number;
  readonly tc: number;
  readonly sealed: boolean;
  readonly revision: HistoricalRevision;
  readonly moments: readonly DisclosedMoment[];
  readonly emergingFocuses: readonly DisclosedEmergingFocus[];
  readonly liveFocus: DisclosedLiveFocusAtTc;
  readonly threads: readonly DisclosedThread[];
  readonly threadReadingAppearances: readonly DisclosedThreadReadingAppearance[];
  readonly readings: readonly DisclosedReading[];
  readonly readingRelations: readonly DisclosedReadingRelation[];
  readonly evidenceParticipations: readonly DisclosedEvidenceParticipation[];
  readonly materials: readonly DisclosedMaterial[];
  readonly gaps: readonly DisclosedGap[];
  readonly questions: readonly DisclosedQuestion[];
  readonly questionAppearances: readonly DisclosedQuestionAppearance[];
  readonly confidences: readonly DisclosedConfidence[];
}

/** A malformed or incoherent projection row: transport absence or corruption, NEVER epistemic absence. */
export class HistoricalProjectionIntegrityError extends Error {
  constructor(readonly code: 'HISTORICAL_PROJECTION_ROW_MALFORMED' | 'HISTORICAL_PROJECTION_INCOHERENT', readonly detail: string) {
    super(`${code}: ${detail}`);
    this.name = 'HistoricalProjectionIntegrityError';
  }
}

/**
 * The database refused the projection for a typed technical or coverage
 * reason. Each code is a fail-closed condition (Z66-05): a LEGACY UNCOVERED
 * SESSION, no addressable Session Position yet, a missing baseline, a TC
 * outside [1, LH], or a Session this caller cannot see.
 */
export class HistoricalProjectionUnavailableError extends Error {
  constructor(readonly code: HistoricalProjectionUnavailableCode) {
    super(code);
    this.name = 'HistoricalProjectionUnavailableError';
  }
}
