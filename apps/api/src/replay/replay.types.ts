import type {
  DisclosedEmergingFocus,
  DisclosedQuestionAppearance,
  DisclosedReading,
  DisclosedSourceProvenanceRung,
  DisclosedThreadRung,
  DisclosedWorldRung,
  HistoricalRung,
  HistoricalSemanticDepth,
} from '@qandeel/runtime';
import type { DisclosedAnalyticalRungs } from '../historical-projection/historical-disclosure';
import type { DisclosedMaterialAtTc } from '../historical-projection/historical-projection-mapper';

// S7-01 - the Personal Replay wire contract (migration 0169). It is graphics-independent by construction: identity and
// lifecycle, the source / selection / version coordinates, the displayable historical moments, gaps and staleness, and
// the render truth contract a version is bound to. No colour, coordinate of a drawing, component, motion or camera value
// is authored here; a Thread's Home is canonical K(TC) truth, carried exactly as T-03C carries it. No source-internal
// identity crosses: a moment is its ordinal and its Session Position, never a Conversation Unit or a Turn.
//
// The types live in the API module, not in `@qandeel/runtime`: the Replay player is S7-03's, and a client contract is
// published when a client consumes it.

export type ReplayLifecycle = 'DRAFT' | 'PREVIEW_READY' | 'FINALIZED';
/** How much of the conversation the selection covers: all of it, or one contiguous excerpt of whole messages. */
export type ReplayCoverageClass = 'FULL_SOURCE' | 'SELECTED_EXCERPT' | 'HIGHLIGHT_SELECTION';
/** Whether the draft's bound messages are still exactly what they were (I-06A currency). */
export type ReplayDraftSourceState = 'CURRENT' | 'STALE';
export type ReplaySourceLayer = 'DEREFERENCEABLE' | 'NOT_DEREFERENCEABLE';
export type ReplayAnalyticalLayer = 'SEALED_HISTORICAL_EVIDENCE' | 'SEALED_EVIDENCE_INCOMPLETE';
export type ReplayNotViewableClass =
  | 'VERSION_SUPERSEDED'
  | 'SOURCE_STATE_CONTRADICTORY'
  | 'SOURCE_NOT_CURRENTLY_AVAILABLE'
  | 'ANALYTICAL_EVIDENCE_INCOMPLETE';
export type ReplaySourceRole = 'USER' | 'ASSISTANT';
/** The medium the moment was ORIGINALLY committed in. Never a claim that audio exists to be played. */
export type ReplayOriginalMedium = 'ORIGINAL_TEXT' | 'ORIGINAL_AUDIO' | 'MIXED';

export interface ReplayCapabilityView {
  /** Whether a new Replay act would be admitted now. Reading one's own Replays never depends on it. */
  readonly creationAvailable: boolean;
}

export interface ReplaySummary {
  readonly replayId: string;
  readonly lifecycle: ReplayLifecycle;
  readonly createdAt: string;
  readonly currentVersionId: string | null;
  readonly currentVersionFinalized: boolean | null;
}

export interface ReplayDraft {
  readonly revision: number;
  readonly coverageClass: ReplayCoverageClass;
  readonly selectedMomentCount: number;
  readonly firstTc: number;
  readonly lastTc: number;
  readonly sourceState: ReplayDraftSourceState;
  readonly updatedAt: string;
}

export type ReplayView =
  | {
    readonly outcome: 'FOUND';
    readonly replayId: string;
    readonly lifecycle: ReplayLifecycle;
    readonly createdAt: string;
    readonly draft: ReplayDraft;
    readonly currentVersion: { readonly versionId: string; readonly revision: number; readonly finalized: boolean } | null;
  }
  /** Not the caller's, or no such Replay: one answer. */
  | { readonly outcome: 'UNAVAILABLE' };

/** Every policy is an exact versioned value of the frozen I-06B render truth contract the version is bound to. */
export interface ReplayRenderContract {
  readonly revision: number;
  readonly schema: string;
  readonly sourceMediumClass: string;
  readonly policies: {
    readonly originalMedium: string;
    readonly sourceText: string;
    readonly semanticCut: string;
    readonly temporalDiscontinuity: string;
    readonly timingIntegrity: string;
    readonly analyticalProjection: string;
    readonly cameraEmphasis: string;
    readonly motion: string;
    readonly captionProvenance: string;
    readonly accessibilityParity: string;
    readonly reducedMotionParity: string;
    readonly editorialAnnotation: string;
  };
}

export interface ReplayViewing {
  readonly state: 'VIEWABLE' | 'NOT_VIEWABLE';
  /** Exactly one bounded reason when NOT_VIEWABLE; null when VIEWABLE. */
  readonly notViewableClass: ReplayNotViewableClass | null;
  /** Both layers, always reported: the analysis is never presented as a substitute for a missing source. */
  readonly sourceLayer: ReplaySourceLayer;
  readonly analyticalLayer: ReplayAnalyticalLayer;
}

export type ReplayVersionView =
  | {
    readonly outcome: 'FOUND';
    readonly replayId: string;
    readonly versionId: string;
    readonly revision: number;
    readonly createdAt: string;
    readonly isCurrent: boolean;
    readonly finalized: boolean;
    readonly coverageClass: ReplayCoverageClass;
    readonly momentCount: number;
    readonly temporalDiscontinuityCount: number;
    readonly firstTc: number;
    readonly lastTc: number;
    readonly renderContract: ReplayRenderContract;
    readonly viewing: ReplayViewing;
  }
  | { readonly outcome: 'UNAVAILABLE' };

export interface ReplayMoment {
  /** 1 .. momentCount, in canonical chronology. */
  readonly ordinal: number;
  /** The Session Position the moment represents: the TC of its historical analysis. */
  readonly tc: number;
  readonly sourceRole: ReplaySourceRole;
  readonly originalMedium: ReplayOriginalMedium;
  /** How many source messages were omitted immediately before this moment: machine truth about ABSENCE, naming nothing. */
  readonly omittedBefore: number;
  /** The exact committed text, from the source itself, ONLY while the version is viewable; null otherwise. */
  readonly text: string | null;
}

export type ReplayMomentsView =
  | { readonly outcome: 'FOUND'; readonly moments: readonly ReplayMoment[] }
  | { readonly outcome: 'UNAVAILABLE' };

/**
 * A Question's appearance at TC, without the Turns it was asked in: a Turn is a source-internal identity, and the
 * Replay's moments are addressed by ordinal and Session Position alone.
 */
export type ReplayQuestionAppearance = Omit<DisclosedQuestionAppearance, 'sourceTurnId' | 'assistantTurnId'>;

/** The SESSION rung of a Replay moment's analysis: its Moments are the Replay's own source layer, served apart. */
export interface ReplaySessionAnalyticsRung {
  readonly emergingFocuses: readonly DisclosedEmergingFocus[];
  readonly questionAppearances: readonly ReplayQuestionAppearance[];
}

/**
 * S7-05 (F-2): a Reading on the Replay wire. Its scope is the canonical scope's CLASS only, never the Session it names: the
 * moment is addressed by its ordinal and Session Position, and no Session id crosses (the header carries none either).
 */
export type ReplayReading = Omit<DisclosedReading, 'scope'> & { readonly scope: 'CONVERSATION_SESSION' };

/** The ANALYTICAL_OBJECT rung of a Replay moment's analysis: T-03C's, with each Reading's scope narrowed to its class. */
export type ReplayAnalyticalObjectRung =
  Omit<Extract<DisclosedAnalyticalRungs<DisclosedMaterialAtTc>['analyticalObject'], { status: 'DISCLOSED' }>['value'], 'readings'>
  & { readonly readings: readonly ReplayReading[] };

export type ReplayMomentAnalysisView =
  | {
    readonly outcome: 'AVAILABLE';
    readonly ordinal: number;
    readonly tc: number;
    readonly depth: HistoricalSemanticDepth;
    readonly world: DisclosedWorldRung;
    readonly thread: HistoricalRung<DisclosedThreadRung>;
    readonly session: HistoricalRung<ReplaySessionAnalyticsRung>;
    readonly analyticalObject: HistoricalRung<ReplayAnalyticalObjectRung>;
    readonly sourceProvenance: HistoricalRung<DisclosedSourceProvenanceRung>;
  }
  /** The version is not viewable now (see the version's `viewing`): no analysis stands in for it. */
  | { readonly outcome: 'NOT_VIEWABLE'; readonly ordinal: number; readonly tc: number }
  /** The canonical analysis no longer re-derives to exactly what the version froze. */
  | { readonly outcome: 'ANALYSIS_NOT_CURRENTLY_AVAILABLE'; readonly ordinal: number; readonly tc: number }
  | { readonly outcome: 'UNAVAILABLE' };

/** The bounded refusal words of the gated commands (migration 0169 section 3). */
export type ReplayRefusal =
  | 'NOT_AVAILABLE_NOW'
  | 'UNAVAILABLE'
  | 'NOT_WHOLE_MESSAGES'
  | 'CHANGED'
  | 'SOURCE_CHANGED'
  | 'MOMENT_NOT_SEALED'
  | 'ANALYSIS_UNAVAILABLE'
  | 'ANALYSIS_CHANGED'
  | 'LIFECYCLE_NOT_ELIGIBLE'
  | 'SELECTION_NOT_SUPPORTED'
  | 'COMMAND_CONFLICT';

export type ReplayDraftCommandView =
  | {
    readonly outcome: 'CREATED' | 'REVISED';
    readonly replayId: string;
    readonly lifecycle: ReplayLifecycle;
    readonly draftRevision: number;
    readonly coverageClass: ReplayCoverageClass;
    readonly selectedMomentCount: number;
  }
  | { readonly outcome: ReplayRefusal };

export type ReplayPreviewView =
  | {
    readonly outcome: 'PREVIEW_READY';
    readonly replayId: string;
    readonly versionId: string;
    readonly versionRevision: number;
    readonly momentCount: number;
    readonly temporalDiscontinuityCount: number;
  }
  | { readonly outcome: ReplayRefusal };

export type ReplayFinalizeView =
  | { readonly outcome: 'FINALIZED'; readonly replayId: string; readonly versionId: string; readonly versionRevision: number }
  | { readonly outcome: ReplayRefusal };

export type ReplayReopenView =
  | { readonly outcome: 'REOPENED'; readonly replayId: string; readonly lifecycle: ReplayLifecycle; readonly reopenedFromVersionId: string }
  | { readonly outcome: ReplayRefusal };
