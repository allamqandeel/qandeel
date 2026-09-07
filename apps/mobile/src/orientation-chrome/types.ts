/**
 * T-08 — the read-only orientation vocabulary.
 *
 * Five orientation dimensions, kept structurally apart because they are five different questions
 * and collapsing any two of them would make a false answer expressible:
 *
 *   temporal    where the reader stands in conversational time;
 *   spatial     which viewpoint and which disclosure rung the camera is on;
 *   inspection  what was requested, and what this disclosure may legitimately render of it;
 *   live        that Live exists and has moved on — generically, and never where it went;
 *   returns     which of the six frozen return acts is meaningful right now.
 *
 * Nothing in this file computes. It is the shape the model may answer in, and the shape is itself a
 * firewall: the branches that may not name an identity have no field to name one with, so a leak
 * would have to be a type error rather than a mistake in prose.
 *
 * ## The one rule behind the inspection union
 *
 * An identity may be named only where the disclosure says `knowledge != UNKNOWN_AT_TC`. A reader who
 * asked to inspect something may always be shown what they asked for once `K(TC)` confirms it is
 * part of the world at this position — but at a position where the identity is NOT part of `K(TC)`,
 * naming it would confirm a future object exists, which is exactly the historical firewall's job to
 * prevent. So `IDENTITY_UNKNOWN_AT_TC` carries no family, no id, no version, no lineage and no
 * shape: there is nothing on it to render, and nothing target-shaped to leave a hole for.
 *
 * ## Technical states are not semantic ones
 *
 * `PROJECTION_NOT_FETCHED`, `PROJECTION_UNAVAILABLE`, `PROJECTION_STALE`, `INSPECTION_NOT_RESOLVED`
 * and `RESOLUTION_MALFORMED` are five facts about the CLIENT and the transport. None of them is
 * `IDENTITY_UNKNOWN_AT_TC`, none is `DEPTH_WITHHELD`, and none may be presented as an absence in the
 * world. They stay five separate members so no code path can widen one into another.
 */
import type { SemanticDepth, SessionPosition } from '../state';
import type { MapProjectionStaleReason } from '../map';
import type { HistoricalFamily, HistoricalProjectionUnavailableCode } from '../projection';
import type { PreviewSource, TemporalPreview } from '../temporal-navigation';

// ------------------------------------------------------------------------------------------
// Language
// ------------------------------------------------------------------------------------------

/**
 * The Product language the chrome speaks. Class D, presentation configuration, and nothing else.
 *
 * It is NOT canonical state, not `RH`, not `TM`, not `TC`, not `PTC`, not projection authority, not
 * history, not inspection identity and not return authority. Nothing below this line in the file is
 * parameterised by it: the whole orientation answer is derived without knowing which language will
 * be used to say it, which is what makes "the semantic model is identical in Arabic and in English"
 * a structural fact rather than a discipline someone has to keep.
 *
 * It is also NOT the reading direction. `I18nManager.isRTL` says which way the platform lays a
 * surface out; it does not say which language a reader reads. An English reader on an RTL device and
 * an Arabic reader on an LTR one are both ordinary, so the two are separate inputs and neither is
 * inferred from the other anywhere in this layer.
 *
 * Where the preference COMES from is a later task's: T-12 owns the app-level provider. T-08 owns
 * only the honest seam, which is why it is a required prop rather than a defaulted one — defaulting
 * it would silently make one of the two languages the Product's default, and that is not T-08's
 * decision to take.
 */
export type ChromeLanguage = 'ar' | 'en';

// ------------------------------------------------------------------------------------------
// Temporal
// ------------------------------------------------------------------------------------------

/**
 * The transient temporal preview, as orientation.
 *
 * T-06 owns it entirely: this is a read-only view of the snapshot that layer publishes, narrowed to
 * what a reader may be told. It is deliberately not a temporal MODE — `mode` above still has exactly
 * two members and this sits beside it — because a preview is not a commitment. While one is open the
 * committed `TM` is unchanged, the committed effective `TC` is unchanged, and no `RH` entry exists.
 */
export type PreviewChrome =
  | { readonly status: 'IDLE' }
  | {
      readonly status: 'PREVIEWING';
      /** `PTC`: the previewed Session Position. Never a commitment, never a mode, never `TC`. */
      readonly at: SessionPosition;
      /** Which of the reader's own legitimate routes established it. It grants nothing. */
      readonly source: PreviewSource;
    };

/**
 * Where the reader stands in conversational time, and what they are transiently looking at.
 *
 * Entailed by Class A alone. `PINNED` at the Live Head is NOT `FOLLOW_LIVE`: the modes differ, and
 * only one of them advances when Live does. There is no third mode here and nowhere to put one —
 * `preview` is a SIBLING of the committed stance, never a member of it, so a preview can never be
 * expressed as a temporal mode and `PTC` can never be expressed as `TC`.
 */
export interface TemporalChrome {
  /** The COMMITTED stance. A preview never moves it. */
  readonly mode: 'FOLLOW_LIVE' | 'PINNED';
  /** The committed effective `TC`; `null` only while no authoritative Session Position has been mirrored. */
  readonly at: SessionPosition | null;
  /** A pinned position strictly earlier than the current Live Head. Always false under Live. */
  readonly earlierThanLiveHead: boolean;
  readonly liveHeadEstablished: boolean;
  /** Transient, and never canonical. `IDLE` whenever no preview source is supplied at all. */
  readonly preview: PreviewChrome;
}

/**
 * The read-only half of T-06's preview controller, and the only half T-08 is given.
 *
 * The narrowing is the firewall. `preview(...)`, `stepForward(...)`, `cancel()` and `reconcile(...)`
 * are absent from this type, so T-08 cannot start, retarget, commit or cancel a preview even by
 * mistake — a call to any of them is a type error rather than a rule someone has to remember. T-06
 * and T-07 keep the whole of preview precedence, including the cancellation every return act
 * performs for itself.
 */
export interface TemporalPreviewSource {
  getSnapshot(): TemporalPreview;
  subscribe(listener: () => void): () => void;
}

// ------------------------------------------------------------------------------------------
// Spatial
// ------------------------------------------------------------------------------------------

/**
 * The camera's own orientation, read from canonical state and from nothing else. A sparse or empty
 * historical viewport is a correct viewport: emptiness is never evidence that the camera is at the
 * World viewpoint, so `atWorldViewpoint` is a camera fact and never a scene fact.
 */
export interface SpatialChrome {
  readonly depth: SemanticDepth;
  readonly atWorldViewpoint: boolean;
}

// ------------------------------------------------------------------------------------------
// Inspection
// ------------------------------------------------------------------------------------------

/**
 * What one step of a disclosed contextual route is. `RUNG` is a rung of the frozen disclosure
 * lineage that names no identity; `OBJECT` is always the terminal step, the thing being inspected.
 */
export type ContextStepKind = 'WORLD' | 'RUNG' | 'THREAD' | 'THREAD_READING' | 'QUESTION_TURN' | 'OBJECT';

/**
 * One step of the disclosed contextual route.
 *
 * Parsed from the route T-04 minted against `V`, never inferred: no parent is derived from
 * geometry, no ownership is implied by containment, and a route that does not parse yields no path
 * at all rather than a plausible-looking guess.
 */
export interface ContextStep {
  readonly kind: ContextStepKind;
  /** The rung or family name exactly as the disclosed route recorded it. */
  readonly token: string;
  /** The identity this step names, or `null` for a structural rung that names none. */
  readonly id: string | null;
}

/** Whether the requested version is the then-current one, and if not, in which direction. */
export type NoncurrentVersionState = 'PREVALID' | 'SUPERSEDED' | null;

/**
 * `IF_render`: what the SELECTED historical disclosure can legitimately render of `IF_ref` now.
 *
 * `IF_ref` itself lives in canonical state and is never rewritten, rescued or re-elected here; this
 * union only says what may be shown of it at this position, and every member is a different fact.
 */
export type InspectionRenderState =
  | { readonly kind: 'NO_INSPECTION' }
  | {
      readonly kind: 'RENDERABLE';
      readonly family: HistoricalFamily;
      readonly id: string;
      /** The version the reader asked for; `null` means "the then-current one at TC", exactly. */
      readonly versionIntent: number | null;
      readonly noncurrent: NoncurrentVersionState;
      /** The disclosed contextual route. Empty when the request named no contextual appearance. */
      readonly lineage: readonly ContextStep[];
      readonly contextRequested: boolean;
    }
  /** Not part of `K(TC)`. Nothing about it may be named, shaped, counted or held a place for. */
  | { readonly kind: 'IDENTITY_UNKNOWN_AT_TC' }
  /**
   * The identity is part of `K(TC)`; the requested contextual appearance is not. The identity may be
   * named, the unavailable context may not, and no other context is substituted for it.
   */
  | {
      readonly kind: 'CONTEXT_UNAVAILABLE_AT_TC';
      readonly family: HistoricalFamily;
      readonly id: string;
      readonly versionIntent: number | null;
      readonly noncurrent: NoncurrentVersionState;
    }
  /**
   * Known at `TC`, but this rung did not earn the render. Withheld is not absent: the reader is told
   * which rung would disclose it, and no withheld content is exposed.
   */
  | { readonly kind: 'DEPTH_WITHHELD'; readonly family: HistoricalFamily; readonly id: string; readonly requiredDepth: SemanticDepth }
  /** Technical: the client has not obtained a disclosure for this viewpoint. Never an absence. */
  | { readonly kind: 'PROJECTION_NOT_FETCHED' }
  /** Technical: the server refused with a typed code. Never `IDENTITY_UNKNOWN_AT_TC`. */
  | { readonly kind: 'PROJECTION_UNAVAILABLE'; readonly code: HistoricalProjectionUnavailableCode }
  /** Technical: the held disclosure is not this viewpoint's. Retired immediately, never reread. */
  | { readonly kind: 'PROJECTION_STALE'; readonly reason: MapProjectionStaleReason }
  /** Technical: the held disclosure produced no usable scene at all. */
  | { readonly kind: 'PROJECTION_INCOHERENT' }
  /** Technical: this disclosure carries no answer about the current inspection. */
  | { readonly kind: 'INSPECTION_NOT_RESOLVED' }
  /** Technical: the answer is not a legal resolution, or does not agree with canonical state. */
  | { readonly kind: 'RESOLUTION_MALFORMED' };

export interface InspectionChrome {
  /** An `IF_ref` exists in canonical state. It says nothing at all about what that reference names. */
  readonly requested: boolean;
  readonly render: InspectionRenderState;
}

// ------------------------------------------------------------------------------------------
// Live
// ------------------------------------------------------------------------------------------

/**
 * Everything a historical reader may learn about Live, and nothing more.
 *
 * There is deliberately no identity, name, family, category, Home, direction, distance, offscreen
 * side, minimap point, count or set size on this interface. Two positions that differ only in a
 * Live Focus the reader's own `K(TC)` cannot disclose produce an identical value of this type,
 * because there is no field on which they could differ.
 *
 * `focusReturn` is the ONE specific capability, and it is not derived from `LF` at all: it is the
 * answer of the projection-bound query, asked against a projection proven to be this viewpoint's.
 * `UNPROVEN` means the question was never asked — it is not a quieter `UNAVAILABLE`.
 */
export interface LiveChrome {
  readonly liveEstablished: boolean;
  /** The reader is behind Live. Generic: it says Live moved on, never where it moved to. */
  readonly advancedWhileHistorical: boolean;
  readonly routeBackToLiveAvailable: boolean;
  readonly focusReturn: 'AVAILABLE' | 'UNAVAILABLE' | 'UNPROVEN';
}

// ------------------------------------------------------------------------------------------
// Returns
// ------------------------------------------------------------------------------------------

/**
 * The six frozen return identities, in a fixed logical order that no layout direction may reorder.
 * There is no seventh, and no generic `HOME`, `RESET`, `NAVIGATE`, `GO_LIVE`, `BACK_OR_HOME` or
 * `RETURN` that could stand in for several of them.
 */
export const RETURN_OPPORTUNITY_IDS = Object.freeze([
  'BACK_ONE_STEP',
  'EXACT_RETURN',
  'RETURN_LIVE_HEAD',
  'RETURN_LIVE_FOCUS',
  'RETURN_WORLD',
  'GO_LIVE_AND_LOCATE',
] as const);
export type ReturnOpportunityId = (typeof RETURN_OPPORTUNITY_IDS)[number];

/**
 * Which dimensions an act is ALLOWED to write. A classification of its write-set, never a claim
 * that anything will physically change. Four different shapes; none of them is "navigation".
 */
export type ReturnEffect = 'HISTORY' | 'TEMPORAL' | 'SPATIAL' | 'TEMPORAL_AND_SPATIAL';

/**
 * What the act is FOR, as one frozen phrase per identity.
 *
 * Six intents for six acts. This is the thing a reader is actually choosing between, and it is what
 * keeps the six from collapsing: a generic `Home` or `Return` would have to pick one of these and
 * silently mean the others.
 */
export type ReturnIntent =
  | 'RESTORE_LATEST_CAPTURED_VIEWPOINT'
  | 'RESTORE_BOUND_INSPECTION_EXACTLY'
  | 'ESTABLISH_FOLLOW_LIVE'
  | 'LOCATE_LIVE_FOCUS_ONCE'
  | 'RETURN_TO_WORLD_VIEWPOINT'
  | 'GO_LIVE_THEN_LOCATE_ONCE';

/**
 * What one act may promise about ONE dimension — and a boolean is not one of the options.
 *
 * R3-03. `movesTime` / `movesCamera` could each say only "this will change" or "this will not
 * change", and four of the six frozen acts fit neither.
 *
 *   - Back and Exact Return restore a CAPTURED tuple. Whether any individual field physically moves
 *     depends on how it compares with the current one, so the delta is legitimately zero sometimes.
 *     The contract they keep is the target, not the movement.
 *   - Return to Live Focus binds its referent once at activation and attempts the camera once. An
 *     authorization race can legitimately make that attempt a no-op.
 *   - Go Live + Locate binds the Live Focus once at the logical post-live boundary and moves the
 *     camera only if that bound referent is legitimately locatable at `K(LH)`. Where it is `NONE`,
 *     pregeographic, undisclosed, unentitled, ungeographic or ambiguous, or where the live
 *     projection is not fetched or is stale at authorization, the temporal return still succeeds and
 *     the camera does not move. That is a valid result of the one act, not a failure of it.
 *
 * A boolean therefore forced a choice between two lies. At activation T-08 cannot know which will
 * happen — and it must not: knowing would itself require reading a future-relative fact. So the
 * promise is typed rather than asserted, and the copy is written from the type.
 *
 *   `DIRECT`                        the act writes this dimension to a target it owns;
 *   `PRESERVED`                     the act does not write this dimension at all;
 *   `RESTORED_IF_DIFFERENT`         restored from the captured viewpoint; the delta may be zero;
 *   `ONE_SHOT_BOUNDED`              one attempt from the current viewpoint, entitlement- and
 *                                   race-bounded, which may legitimately not land;
 *   `CONDITIONAL_POST_LIVE_LOCATE`  one attempt AFTER the temporal return, whose landing is not
 *                                   knowable in advance and must never be promised.
 */
export type ReturnPromise = 'DIRECT' | 'PRESERVED' | 'RESTORED_IF_DIFFERENT' | 'ONE_SHOT_BOUNDED' | 'CONDITIONAL_POST_LIVE_LOCATE';

/** The three dimensions a return act can touch, each with its own promise. */
export interface ReturnEffects {
  readonly temporal: ReturnPromise;
  readonly spatial: ReturnPromise;
  readonly inspection: ReturnPromise;
}

/**
 * One offered return, and the promises it is allowed to make.
 *
 * There is no `label` and no `hint` here. Words are not semantics: they belong to `product-copy.ts`,
 * which is asked for them at the presentation boundary in the reader's own language. Keeping them
 * out is what makes "the model is deeply equal in Arabic and in English" a structural fact rather
 * than a discipline. Nothing here names a target, a place, a direction or a count.
 *
 * This metadata is descriptive and is never an execution input: which executor runs is decided from
 * the frozen identity alone, so nothing here can become a second authority over what an act does.
 */
export interface ReturnOpportunity {
  readonly id: ReturnOpportunityId;
  readonly effect: ReturnEffect;
  readonly intent: ReturnIntent;
  readonly effects: ReturnEffects;
}

export interface ReturnChrome {
  /**
   * The acts that are meaningful RIGHT NOW, in the frozen logical order — never all six by default.
   *
   * The six meanings stay six: each identity keeps its own effect, promises and wording, and no two
   * are ever merged. What is context-sensitive is which of them a reader is offered, and every input
   * to that decision is knowledge-safe — the reader's own history, their own camera, their own
   * temporal stance, and for Live Focus the projection-bound answer alone. Two viewpoints that
   * differ only in a Live Focus this position cannot disclose therefore offer the SAME set.
   */
  readonly offered: readonly ReturnOpportunity[];
  /** How many of the reader's OWN transactions are reversible. Never a count of anything in the world. */
  readonly checkpointCount: number;
}

// ------------------------------------------------------------------------------------------
// Context
// ------------------------------------------------------------------------------------------

/**
 * One legitimate disclosed appearance of the inspected identity. `current` states where the reader
 * IS; it is not a recommendation, and no option is ever preselected, defaulted or marked preferable.
 */
export interface ContextAppearanceOption {
  /** Position within this chooser. A React key and a test id; never spoken and never drawn. */
  readonly ordinal: number;
  /** The disclosed binding this option switches to. It reaches T-04's executor, never a reader. */
  readonly bindingId: string;
  /** The Moment this appearance was taken up at. Reader-facing Product truth, like any Moment. */
  readonly boundAtMoment: number;
  readonly current: boolean;
}

/**
 * "What am I inside?" — answered from disclosed truth only.
 *
 * The lineage is the exact route the disclosure minted, not a computed hierarchy: no parent is
 * inferred, no ownership is implied, no geometry is consulted and no ranking exists. The chooser says
 * so out loud in the reader's own language, because a list that does not deny being a ranking will be
 * read as one — but that sentence is copy, so it lives in `product-copy.ts` and not on this model.
 *
 * An option carries only `current` and `boundAtMoment`, the two facts the reader already has.
 * Whether two options can be told apart is decided from exactly those, so distinguishability is a
 * semantic question with one answer in every language rather than a property of a rendered string.
 */
export interface ContextChrome {
  readonly lineage: readonly ContextStep[];
  readonly appearances: readonly ContextAppearanceOption[];
  /** Several legitimate appearances exist and none is elected. One appearance needs no chooser. */
  readonly choiceAvailable: boolean;
}

// ------------------------------------------------------------------------------------------
// The projection the whole model is derived through
// ------------------------------------------------------------------------------------------

export type ChromeProjectionState =
  | { readonly status: 'CURRENT' }
  | { readonly status: 'NOT_FETCHED' }
  | { readonly status: 'UNAVAILABLE'; readonly code: HistoricalProjectionUnavailableCode }
  | { readonly status: 'STALE'; readonly reason: MapProjectionStaleReason }
  | { readonly status: 'INCOHERENT' };

/**
 * The whole read-only orientation answer.
 *
 * `projection` is first among equals: every semantic field below it was derived only after the held
 * disclosure was proven to be this viewpoint's, and when it was not, the semantic fields fall back
 * to their generic technical forms rather than to a quieter statement about the world.
 */
export interface OrientationModel {
  readonly projection: ChromeProjectionState;
  readonly temporal: TemporalChrome;
  readonly spatial: SpatialChrome;
  readonly inspection: InspectionChrome;
  readonly live: LiveChrome;
  readonly returns: ReturnChrome;
  readonly context: ContextChrome;
}
