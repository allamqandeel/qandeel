/**
 * T-03C - the shared server/client historical disclosure wire contract.
 *
 * Stage 6 freezes `K(TC) = TemporalProject(W, TC)` (Layer A, the database)
 * and `V = Disclose(K(TC), semanticDepth, inspectionContext)` (Layer B, the
 * server). These declarations are the ONLY shape in which `V` crosses the
 * server/client boundary. `K(TC)` itself never leaves the server: the client
 * receives exactly the rungs its requested semantic depth discloses, and a
 * rung it did not earn arrives as `DEPTH_WITHHELD` - never as an empty list,
 * so "historically unavailable" (absent from `K(TC)`), "withheld at this
 * depth" and "known but noncurrent" can never be confused.
 *
 * Every value here is an SP-native fact of ONE covered Session at ONE
 * addressable Session Position `TC` (1 <= TC <= LH). Nothing here is a
 * timestamp; a Material's wall-clock expiry arrives only as its R-C5 mapping
 * into Session Position space. The server-internal same-SP event sequence is
 * NOT part of this contract. No score, rank, centrality, importance ordering,
 * label, camera, viewport or spatial hint exists here; a Thread's ONE Home
 * crosses as exact integer text because it is canonical world truth, not a
 * presentation decision.
 *
 * This is a typed input for T-04 / T-07 / T-08 and a passive read for the
 * client. It writes nothing into the T-02 canonical kernel (`K(TC)`, `V`,
 * `IF_render`, divergence and the footprint have no key there by design).
 */

import type { LiveFocusWireValue } from './live-focus';

/** The frozen disclosure lineage World -> Thread -> Session -> Analytical object -> Source / Provenance. */
export type HistoricalSemanticDepth = 'WORLD' | 'THREAD' | 'SESSION' | 'ANALYTICAL_OBJECT' | 'SOURCE_PROVENANCE';

/** A rung the requested depth did not disclose is WITHHELD - never empty, never unknown. */
export type HistoricalRung<T> =
  | { readonly status: 'DISCLOSED'; readonly value: T }
  | { readonly status: 'DEPTH_WITHHELD' };

/** A Material's expiry mapped from the wall-clock domain into Session Position space (R-C5). */
export type HistoricalExpiryMapping = 'NO_EXPIRY' | 'PRE_FIRST_SP' | 'SP' | 'PENDING' | 'NOT_IN_SESSION';

export interface DisclosedMaterialExpiry {
  readonly mapping: HistoricalExpiryMapping;
  /** The Session Position of the same-SP validity transition; only for `SP`. */
  readonly sp: number | null;
}

/**
 * A Thread's Session-local state at TC. `ESTABLISHED_UNBOUND_IN_SESSION` is a
 * Thread this Session knows (through the world baseline) but never bound: it
 * has no Session-local lifecycle here.
 */
export type ThreadStateAtTc = 'ESTABLISHED_ACTIVE' | 'ESTABLISHED_DORMANT' | 'ESTABLISHED_REOPENED' | 'ESTABLISHED_UNBOUND_IN_SESSION';

export interface DisclosedHome {
  /** Exact integer text: canonical world coordinates never pass through a float. */
  readonly x: string;
  readonly y: string;
}

export interface DisclosedThread {
  readonly id: string;
  readonly establishmentPath: string;
  readonly establishedInSession: boolean;
  /** The establishing Session Position when established in THIS Session; otherwise null. */
  readonly establishedSp: number | null;
  readonly groundingEmergingFocusId: string | null;
  readonly home: DisclosedHome;
  readonly state: ThreadStateAtTc;
}

export interface DisclosedLiveFocusAtTc {
  readonly value: LiveFocusWireValue;
  readonly atSp: number | null;
}

export interface DisclosedWorldRung {
  readonly threads: readonly DisclosedThread[];
  readonly liveFocus: DisclosedLiveFocusAtTc;
}

/** The Thread <-> Reading contextual appearance: known by its own bound SP, current by ordinal. */
export interface DisclosedThreadReadingAppearance {
  readonly bindingId: string;
  readonly threadId: string;
  readonly readingId: string;
  readonly boundSp: number;
  readonly current: boolean;
}

export interface DisclosedThreadRung {
  readonly threadReadingAppearances: readonly DisclosedThreadReadingAppearance[];
}

export interface DisclosedMoment {
  readonly id: string;
  readonly sp: number;
  readonly sourceRole: 'USER' | 'ASSISTANT';
  readonly sourceTurnId: string;
  readonly ordinalWithinTurn: number;
  readonly committedText: string;
  readonly spanStart: number;
  readonly spanEnd: number;
}

export interface DisclosedEmergingFocus {
  readonly id: string;
  readonly startedSp: number;
  readonly lastAttentionSp: number | null;
  /** The Thread this focus was promoted to, only once the establishing Moment is itself known. */
  readonly promotedThreadId: string | null;
  readonly state: 'EMERGING_PREGEOGRAPHIC';
}

/** The Formal Question <-> Turn contextual appearance, anchored at the first committed Moment of its exchange. */
export interface DisclosedQuestionAppearance {
  readonly bindingId: string;
  readonly gapId: string;
  readonly gapOpenEpoch: number;
  readonly readingId: string;
  readonly readingVersion: number;
  readonly questionType: string;
  readonly sourceTurnId: string;
  readonly assistantTurnId: string | null;
  readonly appearedAtSp: number;
}

export interface DisclosedSessionRung {
  readonly moments: readonly DisclosedMoment[];
  readonly emergingFocuses: readonly DisclosedEmergingFocus[];
  readonly questionAppearances: readonly DisclosedQuestionAppearance[];
}

export type ReadingLineageStepKind = 'LEGACY_BASELINE' | 'CREATED' | 'STATUS_TRANSITION' | 'VERSION_ADVANCED';

export interface DisclosedReadingLineageStep {
  readonly kind: ReadingLineageStepKind;
  readonly fromStatus: string | null;
  readonly toStatus: string;
  readonly fromVersion: number | null;
  readonly toVersion: number;
}

/** A Reading (Stage 6.5 v3 SDM-03: Reading is the canonical Hypothesis) with its then-current status and version. */
export interface DisclosedReading {
  readonly id: string;
  readonly statement: string;
  readonly type: string;
  readonly domain: string;
  readonly scope: string;
  readonly origin: string;
  readonly assumptions: readonly string[];
  readonly disconfirmingConditions: readonly string[];
  readonly statusAtTc: string;
  readonly versionAtTc: number;
  /** Known lineage up to TC, in order; never mistaken for current. */
  readonly lineage: readonly DisclosedReadingLineageStep[];
}

export interface DisclosedReadingRelation {
  readonly a: string;
  readonly b: string;
}

export interface DisclosedMaterial {
  readonly id: string;
  readonly type: string;
  readonly content: string;
  readonly source: string;
  readonly confidence: number | null;
  readonly importance: number | null;
  readonly version: number;
  readonly supersedesMaterialId: string | null;
  readonly supersededByMaterialId: string | null;
  readonly statusAtTc: string;
  readonly expiry: DisclosedMaterialExpiry;
}

export interface DisclosedGap {
  readonly id: string;
  readonly informationNeeded: string;
  readonly whyItMatters: string | null;
  readonly userAnswerability: string | null;
  readonly preferredQuestionType: string | null;
  readonly readingIds: readonly string[];
  readonly statusAtTc: string;
  readonly openEpochAtTc: number;
  readonly closureReasonAtTc: string | null;
}

export interface DisclosedQuestion {
  readonly id: string;
  readonly gapId: string;
  readonly questionText: string;
  readonly questionType: string;
  readonly answerFormat: string;
  readonly informationNeeded: string;
  readonly targetReadingIds: readonly string[];
}

/** A Confidence evaluation resolved against the Reading's then-current version at TC (Z66-04). */
export type ConfidenceResolutionAtTc = 'CURRENT' | 'SUPERSEDED' | 'PREVALID';

export interface DisclosedConfidence {
  readonly id: string;
  readonly readingId: string;
  readonly targetVersion: number;
  readonly resolution: ConfidenceResolutionAtTc;
  readonly missingInformationCodes: readonly string[];
  readonly supportingEvidenceIds: readonly string[];
  readonly contradictingEvidenceIds: readonly string[];
  readonly assumptions: readonly string[];
  readonly alternativeReadingIds: readonly string[];
}

export interface DisclosedAnalyticalObjectRung {
  readonly readings: readonly DisclosedReading[];
  readonly readingRelations: readonly DisclosedReadingRelation[];
  readonly materials: readonly DisclosedMaterial[];
  readonly gaps: readonly DisclosedGap[];
  readonly questions: readonly DisclosedQuestion[];
  readonly confidences: readonly DisclosedConfidence[];
}

/** The Material <-> Reading provenance appearance: known by its own attach event, both endpoints known. */
export interface DisclosedEvidenceParticipation {
  readonly readingId: string;
  readonly materialId: string;
  readonly evidenceId: string;
  readonly role: 'SUPPORTING' | 'CONTRADICTING';
}

export interface DisclosedSourceProvenanceRung {
  readonly evidenceParticipations: readonly DisclosedEvidenceParticipation[];
}

/** Authoritative inputs only: a sealed TC is stable under any revision; the open head evolves with them. */
export interface HistoricalRevision {
  readonly liveHead: number;
  readonly worldVersion: number;
  readonly pendingExpiries: number;
}

export type HistoricalFamily = 'THREAD' | 'EMERGING_FOCUS' | 'MOMENT' | 'READING' | 'MATERIAL' | 'GAP' | 'QUESTION' | 'CONFIDENCE';

export type HistoricalAppearanceKind = 'THREAD_READING' | 'QUESTION_TURN';

/** The exact requested inspection (`IF_ref` in Layer-B terms), retained exactly even when unavailable at TC. */
export interface HistoricalInspectionRequest {
  readonly family: HistoricalFamily;
  readonly id: string;
  /** Absent means the then-current version at TC. */
  readonly version?: number;
  readonly appearance?: { readonly kind: HistoricalAppearanceKind; readonly bindingId: string };
}

/**
 * Three orthogonal answers about ONE requested inspection at TC:
 * knowledge (is the identity part of K(TC), and is the requested version the
 * then-current one), context (is the requested contextual appearance part of
 * K(TC)), and disclosure (did the requested depth earn it).
 */
export type HistoricalInspectionResolution =
  | { readonly knowledge: 'UNKNOWN_AT_TC' }
  | {
    readonly knowledge: 'KNOWN_AND_CURRENT_AT_TC' | 'KNOWN_NONCURRENT_AT_TC';
    readonly noncurrent: 'PREVALID' | 'SUPERSEDED' | null;
    readonly context: 'NOT_REQUESTED' | 'CONTEXT_AVAILABLE_AT_TC' | 'CONTEXT_UNAVAILABLE_AT_TC';
    readonly disclosure: 'AVAILABLE_AND_RENDERABLE' | 'AVAILABLE_BUT_DEPTH_WITHHELD';
    readonly requiredDepth: HistoricalSemanticDepth;
  };

/** `V = Disclose(K(TC), semanticDepth, inspectionContext)`: the whole client-facing answer for one (Session, TC, depth). */
export interface HistoricalDisclosure {
  readonly sessionId: string;
  readonly liveHead: number;
  readonly tc: number;
  /** `tc < liveHead`: every family below is stable forever. */
  readonly sealed: boolean;
  readonly depth: HistoricalSemanticDepth;
  readonly revision: HistoricalRevision;
  /** The WORLD rung is the floor of every disclosure and is always present. */
  readonly world: DisclosedWorldRung;
  readonly thread: HistoricalRung<DisclosedThreadRung>;
  readonly session: HistoricalRung<DisclosedSessionRung>;
  readonly analyticalObject: HistoricalRung<DisclosedAnalyticalObjectRung>;
  readonly sourceProvenance: HistoricalRung<DisclosedSourceProvenanceRung>;
  readonly inspection: HistoricalInspectionResolution | null;
}

/** The typed reasons a disclosure is refused; each is a technical or coverage condition, never `UNKNOWN_AT_TC`. */
export type HistoricalProjectionUnavailableCode =
  | 'HISTORICAL_COVERAGE_UNAVAILABLE'
  | 'LIVE_HEAD_NOT_ESTABLISHED'
  | 'HISTORICAL_BASELINE_MISSING'
  | 'SESSION_POSITION_NOT_ADDRESSABLE'
  | 'SESSION_NOT_VISIBLE';

export interface HistoricalProjectionUnavailableBody {
  readonly code: HistoricalProjectionUnavailableCode;
}
